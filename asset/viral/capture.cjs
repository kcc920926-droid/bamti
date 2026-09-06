const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1320},deviceScaleFactor:1.5,colorScheme:'light'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const origin=process.env.BAMTI_DEMO_URL||'http://127.0.0.1:8777';
    await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
    await page.goto(origin+'/asset/viral/index.html');
    const panel=page.frameLocator('#panel');
    await panel.locator('#report').waitFor({state:'visible'});
    await panel.locator('[data-category="unfinished"]').click();
    await panel.locator('#expandall').click();
    const dead=panel.locator('.sig').filter({hasText:'목적지가 비어 있는 링크'});
    await dead.getByRole('button',{name:/이 항목만/}).click();
    // Highlight selection is an actual panel action; return to the hero for the photo.
    const site=page.frames().find(f=>f.url().endsWith('/slop-demo.html'));
    await site.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0);});
    await page.waitForTimeout(700);
    await site.evaluate(()=>window.scrollTo(0,0));
    const panelFrame=page.frames().find(f=>f.url().endsWith('/panel.html'));
    await panelFrame.evaluate(()=>window.scrollTo(0,document.querySelector('.verdict').offsetTop-document.querySelector('header').offsetHeight-10));
    const report=await page.evaluate(()=>window.demoReport);
    assert(report.score>=30);assert(report.signals.some(s=>s.id==='dead-links'));assert(report.signals.some(s=>s.id==='placeholder-copy'));
    assert.deepEqual(report.errors,[]);assert.deepEqual(errors,[]);
    const poster=page.locator('.poster');
    await poster.screenshot({path:path.join(__dirname,'bamti-use-case.png')});
    fs.writeFileSync(path.join(__dirname,'scan-report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({score:report.score,signals:report.signals.map(s=>({id:s.id,count:s.count})),image:path.join(__dirname,'bamti-use-case.png')},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
