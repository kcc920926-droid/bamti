const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const sources = ['i18n/messages', 'i18n/i18n', 'core/context', 'core/signals', 'prose/english-rules', 'prose/prose', 'core/score'].map(f => fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const origin = process.env.BAMTI_TEST_URL || 'http://127.0.0.1:8777';
(async () => {
  const browser = await chromium.launch(); let passed = 0;
  const check = (name, condition) => { assert(condition, name); passed++; console.log('PASS: ' + name); };
  try {
    const page = await browser.newPage();
    await page.route('**/*', r => r.abort());
    const scan = async (html, locale = 'ko') => {
      await page.setContent('<!doctype html><title>Review</title><style>body{font:16px Arial}h1{font-size:40px}h2{font-size:24px}small,.k{font-size:12px}section{margin:20px 0}</style>' + html);
      for (const source of sources) await page.evaluate(source);
      return page.evaluate(locale => { BAMTI._nodes = new Map(); return BAMTI.run({ doc: document, locale }); }, locale);
    };
    const review = r => r.taste.find(s => s.id === 'eyebrow-microlabel');
    let r = await scan('<section><p class="k">Tools for uncertain terrain.</p><h1>주식, 어렵지 않게</h1></section>');
    check('one mixed-case label without wide tracking produces a review', review(r)?.count === 1);
    check('label review stays outside the scored evidence', !r.signals.some(s => s.id === 'eyebrow-microlabel'));
    r = await scan('<section><div><p class="k">FIBO 가격의 지형</p><span>→</span></div><div><h2>가격 구간 계산</h2><p>설명</p></div></section>');
    check('arrow and separate heading wrapper do not hide a label', review(r)?.count === 1);
    check('service-like identifiers get context guidance, not a delete verdict', review(r)?.evidence.includes('문맥 확인') && review(r)?.hint.includes('이름은 유지'));
    r = await scan('<section><p class="k"><span>FIBO</span> 가격의 지형</p><h2>가격 구간 계산</h2></section>');
    check('inline markup is one complete label, not multiple signals', review(r)?.count === 1 && review(r).targets[0].tag === 'p');
    r = await scan('<section><p class="k">FOR MAKERS</p><h2>만든 서비스가 있나요?</h2></section>');
    check('audience labels are described as context checks', review(r)?.evidence.includes('문맥 확인'));
    r = await scan('<section><small>For developers</small><h2>Build your project</h2></section>');
    check('mixed-case audience labels retain their semantic role', review(r)?.evidence.includes('문맥 확인'));
    r = await scan('<section><small>A label to review</small><div style="display:contents"><h2>Heading</h2></div></section>');
    check('display-contents heading wrappers remain traversable', review(r)?.count === 1);
    r = await scan('<section><time><small>September update</small></time><h2>Release notes</h2></section><section><div role="status"><small>Available now</small></div><h2>Service status</h2></section>');
    check('dates and status indicators are not decorative-label findings', !review(r));
    r = await scan([1,2,3].map(i => `<section><p class="k">서비스 ${i}의 미래</p><h2>기능 ${i}</h2></section>`).join(''), 'en');
    check('three distinct headings get a repeated-structure review', review(r)?.count === 3 && review(r).label === 'Review repeated decorative labels');
    check('generated English advice is translated but source text is preserved', !/[가-힣]/.test(review(r).hint) && review(r).evidence.includes('서비스'));
    r = await scan('<section><p class="brand-tagline service-name">Ordinary description text.</p><h2>Title</h2></section>');
    check('class names alone never trigger the rule', !review(r));
    r = await scan('<nav><small>MENU</small><h2>Navigation</h2></nav><form><small>REQUIRED</small><h2>Account</h2></form><table><tr><th>PLAN</th></tr></table>');
    check('navigation and semantic form/table labels stay excluded', !review(r));
    r = await scan('<section><p class="k" hidden>Hidden label</p><h2>Visible heading</h2></section>');
    check('hidden labels do not produce reviews', !review(r));
    r = await scan('<section><small>Other column</small><h2 style="margin-left:700px">Heading</h2></section>');
    check('a heading in a different column is not paired', !review(r));
    r = await scan('<section><small>Far label</small><h2 style="margin-top:180px">Heading</h2></section>');
    check('distant headings are not paired', !review(r));
    r = await scan('<section><small>Label</small><p>Intervening explanation must not be ignored.</p><h2>Heading</h2></section>');
    check('meaningful intervening text prevents pairing', !review(r));
    r = await scan('<div><h2>Earlier card</h2><small>Caption below the heading</small></div><div><h2>Next card</h2></div>');
    check('a caption cannot attach to a neighboring card', !review(r));
    r = await scan('<main><input type="search"><button>Search</button><button>Profile</button><button>Settings</button><small>LIBRARY</small><h1>Videos</h1></main>');
    check('application screens do not get marketing label reviews', r.pageType.key === 'application' && !review(r));
    for (const locale of ['ko-KR', 'en-US']) {
      const panel = await browser.newPage({ viewport: { width: 320, height: 950 }, locale });
      await panel.goto(origin + '/test/panel-preview.html#label-review');
      await panel.waitForFunction(() => typeof lastReport !== 'undefined' && lastReport && !document.getElementById('rescan').disabled);
      const row = panel.locator('#list [data-signal-id="eyebrow-microlabel"]');
      check(locale + ' review is in main results, not hidden in references', await row.isVisible() && await panel.locator('#tastelist [data-signal-id="eyebrow-microlabel"]').count() === 0);
      await row.locator('summary').click();
      await row.getByRole('button', { name: /곳 표시|Highlight/ }).click();
      check(locale + ' label locations can be highlighted', await panel.evaluate(() => __lastMsg.signalId === 'eyebrow-microlabel'));
      check(locale + ' narrow panel fits', await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await panel.screenshot({ path: '/tmp/bamti-label-review-' + locale + '.png' });
      await panel.close();
    }
    console.log(passed + ' label review checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
