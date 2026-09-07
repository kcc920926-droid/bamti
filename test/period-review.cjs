const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const sources = ['i18n/messages','i18n/i18n','core/context','core/signals','prose/english-rules','prose/prose','core/score'].map(f => fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const origin = process.env.BAMTI_TEST_URL || 'http://127.0.0.1:8777';
(async () => {
  const browser = await chromium.launch(); let passed = 0;
  const check = (name, ok) => { assert(ok, name); passed++; console.log('PASS: ' + name); };
  try {
    const page = await browser.newPage();
    await page.route('**/*', r => r.abort());
    const scan = async html => {
      await page.setContent('<!doctype html><title>Period fixture</title><style>body{font:18px Arial}</style>' + html);
      for (const source of sources) await page.evaluate(source);
      return page.evaluate(() => { BAMTI._nodes = new Map(); return BAMTI.run({ doc: document }); });
    };
    const review = r => r.taste.find(s => s.id === 'headline-terminal-period');
    for (const html of ['<h1>핵심 개념.</h1>', '<h2>시험 일정.</h2>', '<p>핵심 개념.</p>', '<button>시험 일정.</button>', '<a href="/help">학습 자료.</a>', '<h2>Small parts. Clear systems.</h2>', '<p>핵심 개념。</p>', '<h2>Fast．</h2>']) {
      const r = await scan(html);
      check('single noun-style phrase is reviewed: ' + html, review(r)?.count === 1 && !r.signals.some(s => s.id === 'headline-terminal-period'));
    }
    for (const [html, count] of [
      ['<p id="a">시험별 문제를 풀고 핵심 개념을 복습하세요.</p><p id="b">접수일과 시험일도 함께 확인합니다.</p>', 2],
      ['<h1>복습하세요.</h1><h2>접수일을 확인합니다.</h2><p>복습해.</p>', 3],
      ['<h1>We check your schedule.</h1><p>The app works.</p><button>Save your changes.</button>', 3],
      ['<p>시험별 문제를 풀고 핵심 개념을 복습하세요.<br>접수일과 시험일도 함께 확인합니다.</p>', 1],
    ]) check('complete sentences in separate UI copy are reviewed', review(await scan(html))?.count === count);
    for (const html of [
      '<p>시험별 문제를 풀고 핵심 개념을 복습하세요. 접수일과 시험일도 함께 확인합니다.</p>',
      '<p><span>복습하세요.</span> <span>시험일도 확인합니다.</span></p>',
      '<p>We check your schedule. We also track deadlines.</p>',
      '<p>' + '긴 설명을 이어서 작성하는 본문입니다 '.repeat(6) + '마지막 내용을 확인합니다.</p>',
      '<h2>OpenAI Inc.</h2><p>Dr. Kim.</p><p>U.S.A.</p>',
      '<h2>가격 3.14.</h2><p>Version v0.3.0.</p><p>1.</p>',
      '<h2>example.com.</h2><p>name@example.org.</p>',
      '<h2>준비 중...</h2><p>준비 중…</p><p>Loading。。</p>',
      '<blockquote><h2>핵심 개념.</h2></blockquote><p>“핵심 개념.”</p>',
      '<nav><h2>학습 자료.</h2></nav><div role="status">준비 완료.</div><div hidden><h2>시험 일정.</h2></div>',
      '<div contenteditable><h2>학습 자료.</h2></div><pre>npm install.</pre>',
    ]) check('normal or excluded punctuation stays unflagged: ' + html.slice(0, 45), !review(await scan(html)));
    const nested = review(await scan('<h2 id="title"><span>핵심 개념<span>.</span></span></h2>'));
    check('inline spans produce one locatable finding', nested?.count === 1 && nested.targets[0].selector === '#title');
    for (const locale of ['ko-KR', 'en-US']) {
      const panel = await browser.newPage({ viewport: { width: 320, height: 950 }, locale });
      await panel.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
      await panel.goto(origin + '/test/panel-preview.html#period-review');
      await panel.waitForFunction(() => typeof lastReport !== 'undefined' && lastReport && !document.getElementById('rescan').disabled);
      const row = panel.locator('#list [data-signal-id="headline-terminal-period"]');
      check(locale + ' period review is visible in main results', await row.isVisible());
      check(locale + ' screenshot UI sentences are included, continuous prose is not', await panel.evaluate(() => {
        const s = lastReport.taste.find(s => s.id === 'headline-terminal-period');
        return s.count === 6 && ['screenshot-1', 'screenshot-2'].every(id => s.targets.some(t => t.id === id));
      }));
      await row.locator('summary').click();
      await row.getByRole('button', { name: /곳 표시|Highlight/ }).click();
      check(locale + ' highlight routing uses the period rule', await panel.evaluate(() => __lastMsg.signalId === 'headline-terminal-period'));
      await panel.locator('#copyreport').click();
      const copied = await panel.evaluate(() => navigator.clipboard.readText());
      check(locale + ' full copy includes period advice', /마침표 검토|Review periods/.test(copied));
      check(locale + ' panel does not overflow', await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await panel.close();
    }
    console.log(passed + ' period review checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
