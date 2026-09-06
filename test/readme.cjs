// Checks the README's portable SVGs; Playwright must be installed.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const screenshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bamti-archify-'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const files = ['ko','en'].flatMap(lang => ['','-mobile'].map(s => 'docs/architecture/bamti-' + lang + s + '.svg'));

(async () => {
  execFileSync(process.execPath, ['docs/architecture/build.mjs','--check'], { cwd: root, stdio: 'inherit' });
  for (const file of ['README.md', 'docs/guide.md', 'docs/architecture-evidence.md']) {
    const md = read(file);
    assert(!md.includes('§') && !md.includes('/Users/splendor'), 'template or private path leaked: ' + file);
    const links = [...md.matchAll(/\]\(([^)]+)\)|(?:src|srcset)="([^"]+)"/g)].map(m => m[1] || m[2]);
    for(const link of links) {
      if (/^(?:https?:|#)/.test(link)) continue;
      const target = path.resolve(root, path.dirname(file), link.split('#')[0]);
      assert(fs.existsSync(target), file + ': broken link ' + link);
      const line = link.match(/#L(\d+)$/)?.[1];
      if(line) assert(+line <= fs.readFileSync(target,'utf8').split('\n').length, 'out-of-range source line');
    }
  }
  console.log('PASS: documentation links, source locations and portable paths');
  const browser = await chromium.launch();
  try {
    const seenIds = new Set();
    for (const file of files) {
      const svg = read(file);
      for (const [,id] of svg.matchAll(/\bid="([^"]+)"/g)) {
        assert(!seenIds.has(id), 'duplicate SVG id: ' + id);
        seenIds.add(id);
      }
      assert(!/<(?:script|image|foreignObject)\b/.test(svg), 'external or executable SVG content');
      assert(!/\b(?:href|src)=/.test(svg), 'SVG should have no external dependencies');
      for (const theme of ['light','dark']) {
        const width = file.includes('mobile') ? 360 : 736;
        const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: theme });
        await page.setContent('<!doctype html><style>body{margin:0}svg{display:block;width:100%;height:auto}</style>' + svg);
        const result = await page.evaluate(source => {
          const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
          if(doc.querySelector('parsererror')) return { error: doc.querySelector('parsererror').textContent };
          const s=document.querySelector('svg'), v=s.viewBox.baseVal, violations=[];
          for(const text of s.querySelectorAll('text')) {
            const b=text.getBBox();
            if(b.x < -0.5 || b.y < -0.5 || b.x+b.width>v.width+0.5 || b.y+b.height>v.height+0.5) violations.push('canvas: '+text.textContent);
            const group=text.closest('[data-box]');
            if(group){
              const [x,y,w,h]=group.dataset.box.split(',').map(Number);
              if(b.x<x+7 || b.x+b.width>x+w-7 || b.y<y || b.y+b.height>y+h-3) violations.push('node: '+text.textContent);
            }
            if(parseFloat(getComputedStyle(text).fontSize)*s.getBoundingClientRect().width/v.width<11) violations.push('small: '+text.textContent);
          }
          // Check text colors against their actual card/background, including risk panels.
          const rgb = s => (s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
          const luminance = color => rgb(color).map(v => v/255).map(v => v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
          let minContrast = Infinity;
          for(const text of s.querySelectorAll('text')){
            const b=text.getBBox(), x=b.x+b.width/2, y=b.y+b.height/2;
            let bg = getComputedStyle(s).getPropertyValue('--bg').trim();
            for(const rect of s.querySelectorAll('rect')){
              const r=rect.getBBox(), fill=getComputedStyle(rect).fill;
              if(fill!=='none' && x>=r.x && x<=r.x+r.width && y>=r.y && y<=r.y+r.height) bg=fill;
            }
            const probe=document.createElement('span'); probe.style.color=bg; document.body.append(probe);
            const bgl=luminance(getComputedStyle(probe).color); probe.remove();
            const fgl=luminance(getComputedStyle(text).fill);
            minContrast=Math.min(minContrast,(Math.max(bgl,fgl)+0.05)/(Math.min(bgl,fgl)+0.05));
          }
          return { violations, minContrast, width: v.width, height: v.height };
        }, svg);
        assert(!result.error, result.error);
        assert.deepEqual(result.violations, [], file + ' ' + theme);
        assert(result.minContrast >= 4.5, file + ' contrast ' + result.minContrast);
        await page.screenshot({ path: path.join(screenshotDir,path.basename(file,'.svg')+'-'+theme+'.png'), fullPage: true });
        console.log('PASS:', file, theme, result.width+'×'+result.height, 'contrast >= '+result.minContrast.toFixed(2));
        await page.close();
      }
    }
    // Render README picture markup as embedded images, including responsive source selection.
    const pictures = read('README.md').match(/<picture>[\s\S]*?<\/picture>/g);
    for (const width of [360, 736]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.route('https://bamti-docs.test/**', route => {
        const relative = new URL(route.request().url()).pathname.slice(1);
        return route.fulfill({ contentType:'image/svg+xml', body:read(relative) });
      });
      await page.setContent('<!doctype html><base href="https://bamti-docs.test/"><style>body{margin:16px}img{max-width:100%;height:auto}</style>' + pictures.join(''));
      await page.waitForFunction(() => [...document.images].every(i=>i.complete && i.naturalWidth));
      assert(await page.evaluate(() => [...document.images].every(i=>i.currentSrc.includes('-mobile') === (innerWidth<=600))));
      assert(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
      console.log('PASS: README picture selection and no overflow at',width);
      await page.close();
    }
    console.log('Screenshots:', screenshotDir);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
