/* Precision tests against the real rendered-DOM engine.
 * node test/engine-precision.cjs [--live]
 * --live additionally reads the two publicly accessible URLs reported by the user.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const sources = ['context', 'signals', 'score'].map(name => fs.readFileSync(path.join(root, 'src/core', `${name}.js`), 'utf8'));
const chrome = '<title>Example interface</title><link rel="icon" href="https://example.test/favicon.ico"><meta name="description" content="Example"><meta property="og:title" content="Example"><meta property="og:image" content="example.png">';
const style = '<style>body{font:16px Arial;margin:24px}button,input,select{min-width:40px;min-height:30px}section{padding:50px}h1{font-size:40px}</style>';
const shell = body => `<!doctype html><html><head>${chrome}${style}</head><body>${body}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  let passed = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('**/*', route => route.abort());
    async function scan(body) {
      await page.setContent(shell(body));
      for (const source of sources) await page.evaluate(source);
      return page.evaluate(() => {
        BAMTI._nodes = new Map();
        return BAMTI.run({ doc: document });
      });
    }
    const tells = report => report.signals.map(x => x.id);
    const check = (name, condition) => { assert(condition, name); passed++; console.log(`PASS: ${name}`); };

    const ordinary = '<main><h1>My workspace</h1><a id="section-anchor">Section marker</a><button>Open</button></main>';
    let r = await scan(ordinary);
    check('normal favicon.ico and named anchors are not defects', !tells(r).includes('missing-favicon') && !tells(r).includes('dead-links'));
    check('system fonts are reference patterns, not scored evidence', r.score === 0 && r.taste.some(s => s.id === 'no-custom-typeface'));

    r = await scan(`${ordinary}<div hidden>${'<a href="#">Lorem ipsum</a>'.repeat(6500)}</div><details><summary>Help</summary><p>Lorem ipsum</p><a href="#">Hidden action</a></details><div style="display:none"><h2>Pricing</h2><a href="#">Recommended $19</a></div>`);
    check('hidden templates and closed disclosure content do not create signals', r.score === 0 && !tells(r).includes('placeholder-copy'));
    check('hidden subtree does not exhaust the visible-element budget', r.truncated === 0 && r.domSize < 30);

    r = await scan(`${ordinary}<a href="#" onclick="event.preventDefault()">Toggle details</a><a href="#" role="button" aria-controls="panel">Open panel</a><a><button>Settings</button></a><div id="panel">Panel</div>`);
    check('declared action controls are not called dead links', !tells(r).includes('dead-links'));
    r = await scan('<main><h1>Contact</h1><a href="#">Request a quote</a></main>');
    check('one visible placeholder destination is found even on a small page', tells(r).includes('dead-links'));

    const controls = '<input aria-label="Search" type="search"><button>Search</button><button>Account</button><button>Settings</button>';
    r = await scan(`<main>${controls}<h1>Video library</h1><h2>Pricing software tutorial</h2><p>Recommended videos</p><footer><a href="/contact">문의하기</a></footer></main>`);
    check('service UI is classified from controls without a known hostname', r.pageType.key === 'application');
    check('unrelated pricing words and footer actions do not trigger landing rules', r.score === 0 && !tells(r).includes('three-tier-pricing') && !tells(r).includes('generic-cta-copy'));
    check('limited scope explicitly reports excluded rules', r.skipped.length > 0 && r.bandLabel !== '깨끗함' && r.scopeNote.includes('제외'));

    r = await scan(`<main><h1>Mix allocations</h1><label>First<input type="number"></label><label>Second<input type="number"></label><button>1 year</button><button>3 years</button><button>Compare</button></main>`);
    check('a compact calculator is not judged by landing composition rules', r.pageType.key === 'application' && r.score === 0);
    r = await scan(`<main>${controls}<h1>Video library</h1><p>Lorem ipsum placeholder</p><a href="#">Broken export destination</a></main>`);
    check('application context still catches visible unfinished content', tells(r).includes('placeholder-copy') && tells(r).includes('dead-links'));
    r = await scan('<h1>Draft</h1><p>Lorem <strong>ipsum</strong> dolor sit amet.</p>');
    check('placeholder text split across inline markup is still detected', tells(r).includes('placeholder-copy'));

    r = await scan('<h1 style="background-clip:text;background-image:none">Solid heading</h1><div style="background-image:linear-gradient(90deg,#7c3aed,#3b82f6);background-clip:text">Non-heading decoration</div>');
    check('text clipping outside a real gradient heading is not a gradient headline', !tells(r).includes('gradient-text-heading'));
    r = await scan('<h1><span style="background-image:linear-gradient(90deg,#7c3aed,#3b82f6);background-clip:text">Gradient heading</span></h1>');
    check('nested gradient heading remains detectable', tells(r).includes('gradient-text-heading'));

    const tier = (name, price) => `<div><h3>${name}</h3><p>${price}</p><a href="/signup">Choose plan</a></div>`;
    r = await scan(`<h1>Project plans</h1><section><h2>Pricing</h2><div>${tier('Starter','$0')}${tier('Pro — Most Popular','$29')}${tier('Enterprise','Contact sales')}</div></section>`);
    check('actual three-tier pricing with middle recommendation remains detectable', tells(r).includes('three-tier-pricing'));

    r = await scan('<h1>Component collection</h1><button data-slot="button">Open</button><button data-slot="button">Save</button><button data-slot="button">Close</button>');
    check('library attributes do not imply an unmodified theme', r.score === 0 && r.taste.some(s => s.id === 'shadcn-defaults'));
    r = await scan('<h1>Portfolio</h1><img src="https://images.unsplash.com/photo-example" width="300" height="200" alt="Studio"><img src="https://picsum.photos.attacker.test/image" width="300" height="200" alt="Project">');
    check('stock photography and hostname substrings are not dummy-image evidence', !tells(r).includes('placeholder-images'));

    await page.setContent(shell('<div id="host"></div>'));
    await page.evaluate(() => { document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML = 'Widget text<h1>Widget</h1><p>Lorem ipsum</p>'; });
    for (const source of sources) await page.evaluate(source);
    r = await page.evaluate(() => { BAMTI._nodes = new Map(); return BAMTI.run({ doc: document }); });
    check('visible open-shadow content is inspected', tells(r).includes('placeholder-copy'));

    r = await scan(`${ordinary}<div>${'<span style="display:block">Visible content</span>'.repeat(6010)}</div>`);
    check('large visible pages report a bounded, partial sample', r.domSize === 6000 && r.truncated > 0);

    if (process.argv.includes('--live')) {
      for (const url of ['https://www.youtube.com/', 'https://mix.olvend.com/']) {
        const live = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
        await live.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await live.waitForTimeout(2000);
        for (const source of sources) await live.evaluate(source);
        const report = await live.evaluate(() => { BAMTI._nodes = new Map(); return BAMTI.run({ doc: document }); });
        console.log(JSON.stringify({ url, title: report.title, score: report.score, type: report.pageType, signals: tells(report), references: report.taste.map(s => s.id), errors: report.errors }, null, 2));
        await live.close();
      }
    }
    console.log(`${passed} precision checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
