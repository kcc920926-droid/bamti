// Single-expression editing regression: Playwright + a local preview server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const origin = process.env.BAMTI_TEST_URL || 'http://127.0.0.1:8777';
const sources = ['i18n/messages', 'i18n/i18n', 'core/context', 'core/signals', 'prose/english-rules', 'prose/prose', 'core/score', 'scan/scan'].map(f => fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
(async () => {
  const browser = await chromium.launch();
  let passed = 0;
  const check = (name, condition) => { assert(condition, name); passed++; console.log('PASS: ' + name); };
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => r.abort());
    const scan = async (html, locale = 'ko') => {
      await page.setContent('<!doctype html><title>Expression fixture</title><style>body{font:18px Arial}button{font:inherit}</style>' + html);
      for (const source of sources) await page.evaluate(source);
      return page.evaluate(l => BAMTI.scan(l), locale);
    };
    const fragments = r => r.prose.fragments.signals;
    for (const [html, id, level] of [
      ['<h1>혁신적인 경험</h1>', 'ko-D-4', 'suggestion'],
      ['<p>업무에 있어서</p>', 'ko-A-3', 'suggestion'],
      ['<div>가능성이 있을 수 있습니다</div>', 'ko-G-2', 'suggestion'],
      ['<span>자료를 통해</span>', 'ko-A-2', 'context'],
      ['<h2>Cutting-edge</h2>', 'en-cutting-edge', 'suggestion'],
      ['<a href="/work">Seamless workflows</a>', 'en-seamless', 'suggestion'],
      ['<button>Transformative</button>', 'en-transformative', 'suggestion'],
      ['<header><h1>A game-changer</h1></header>', 'en-game-changer', 'suggestion'],
      ['<div role="button">Elevate</div>', 'en-elevate', 'suggestion'],
      ['<p>A robust mutex</p>', 'en-robust', 'context'],
    ]) {
      const r = await scan(html);
      const s = fragments(r).find(s => s.id === 'prose-fragment-' + id);
      check('one short expression: ' + id, s?.occurrences === 1 && s.count === 1 && s.reviewLevel === level && s.targets.length === 1);
      check('no repetition gate for ' + id, r.prose.signals.length === 0 && s.analysisScopes[0] === 'fragment' && s.weight === 0);
    }
    let r = await scan('<h1 id="split"><span>Cutting-</span><strong>edge</strong></h1>');
    check('inline DOM fragments reconstruct one real phrase', fragments(r).length === 1 && fragments(r)[0].examples[0].text === 'Cutting-edge' && fragments(r)[0].targets[0].selector === '#split');
    r = await scan('<p id="inline">A cutting-<a href="/docs">edge</a> product</p>');
    check('inline links preserve real phrase boundaries', fragments(r).some(s => s.ruleId === 'cutting-edge' && s.targets[0].selector === '#inline'));
    r = await scan('<div>cutting <p>ordinary content</p>edge</div>');
    check('independent block text is not spliced into invented phrases', !fragments(r).some(s => s.ruleId === 'cutting-edge'));
    r = await scan('<h1>cutting <code>example</code>edge</h1>');
    check('excluded inline content breaks the phrase rather than joining around it', !fragments(r).some(s => s.ruleId === 'cutting-edge'));
    r = await scan('<main><h2>가격 안내</h2><p>문의는 이메일로 보내주세요.</p><button>Save</button><a href="/docs">Documentation</a></main>');
    check('ordinary short UI copy produces no suggestions', fragments(r).length === 0);
    r = await scan('<nav><h2>Seamless</h2></nav><footer>Transformative</footer><div role="feed"><h2>Cutting-edge</h2></div><div hidden>혁신적</div><code>Elevate</code><blockquote>획기적</blockquote><input placeholder="Game-changer"><div contenteditable>압도적</div><p>“Seamless”</p>');
    check('navigation, feeds, hidden text, code, quotes and editing fields stay excluded', fragments(r).length === 0);
    r = await scan('<p>In the realm of design</p>', 'en');
    check('overlapping phrase and vocabulary matches are counted once', fragments(r).length === 1 && fragments(r)[0].occurrences === 1 && fragments(r)[0].ruleId === 'in-the-realm');
    r = await scan('<h2>Seamless</h2><h2>Seamless</h2>');
    check('the same suggestion groups distinct locations without hiding them', fragments(r).length === 1 && fragments(r)[0].count === 2 && fragments(r)[0].occurrences === 2);
    const dense = "In today's fast-paced world, unlock your potential with our cutting-edge platform. Leverage seamless workflows to empower your team and elevate every experience.";
    r = await scan('<p>' + dense + '</p>');
    check('existing repeated evidence suppresses duplicate fragment cards', r.prose.signals.some(s => s.id === 'prose-en-vocabulary') && fragments(r).length === 0);
    r = await scan('<h1>혁신적인 경험</h1><p>자료를 통해</p><h2>Cutting-edge</h2>', 'en');
    check('fragment advice is English while page evidence stays verbatim', fragments(r).every(s => !/[가-힣]/.test(s.hint)) && fragments(r).some(s => s.examples[0].text === '혁신적'));
    check('fragment findings remain outside UI score accounting', !r.signals.some(s => s.id.startsWith('prose-')) && fragments(r).every(s => s.weight === 0));
    const highlighted = await page.evaluate(() => { const r = BAMTI.scan('en'), s = r.prose.fragments.signals[0]; BAMTI.highlight(s.id, s); return !!document.querySelector('[id^="bamti-overlay-"]'); });
    check('one-expression suggestions support real page highlights', highlighted);
    await page.evaluate(() => { const host = document.createElement('div'); document.body.replaceChildren(host); host.attachShadow({ mode: 'open' }).innerHTML = '<h2>Seamless</h2>'; });
    r = await page.evaluate(() => BAMTI.scan());
    check('single expressions inside open shadow roots are inspected', fragments(r).some(s => s.ruleId === 'seamless'));
    r = await scan('<div>' + '<h2>Seamless</h2>'.repeat(320) + '</div>');
    check('fragment pass is bounded and discloses incomplete coverage', r.prose.fragments.limited && r.prose.fragments.inspectedBlocks <= 300 && fragments(r).every(s => s.examples.length <= 8 && s.targets.length <= 12));
    check('no engine errors', errors.length === 0 && r.errors.length === 0);

    const panel = await browser.newPage({ viewport: { width: 360, height: 1000 }, locale: 'en-US' });
    panel.on('pageerror', e => errors.push(e.message));
    await panel.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await panel.goto(origin + '/test/panel-preview.html#prose-fragments');
    await panel.waitForFunction(() => typeof lastReport !== 'undefined' && lastReport && !document.getElementById('rescan').disabled);
    check('single expressions are visible by default, without any sensitivity switch', await panel.locator('#proselist .sig').count() === 6 && (await panel.locator('#prosesummary').innerText()).includes('6 items'));
    check('context checks do not masquerade as strong findings', (await panel.locator('#proselist').innerText()).includes('Check context: robust'));
    check('fragment-only pages are not called insufficient prose', !(await panel.locator('#prosestatus').innerText()).includes('No Korean or English text'));
    const single = panel.locator('[data-signal-id="prose-fragment-en-cutting-edge"]');
    await single.locator('summary').click();
    await single.getByRole('button', { name: /Highlight/ }).click();
    check('panel routes individual fragment highlights', await panel.evaluate(() => __lastMsg.signalId === 'prose-fragment-en-cutting-edge'));
    await panel.locator('#copyreport').click();
    check('whole-report copy includes single expressions and context advice', (await panel.evaluate(() => navigator.clipboard.readText())).includes('Check context: robust'));
    await panel.locator('#search').fill('Cutting-edge');
    check('fragment suggestions participate in search', await panel.locator('#proselist .sig').count() === 1);
    await panel.locator('#search').fill('');
    for (const width of [280, 360, 480]) {
      await panel.setViewportSize({ width, height: 1000 });
      check('fragment panel fits ' + width + 'px', await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await panel.locator('#language').selectOption('ko');
    await panel.waitForFunction(() => document.documentElement.lang === 'ko' && typeof lastReport !== 'undefined' && lastReport?.locale === 'ko');
    check('Korean panel distinguishes suggestions and contextual review', (await panel.locator('#proselist').innerText()).includes('표현 제안:') && (await panel.locator('#proselist').innerText()).includes('문맥 확인:'));
    await panel.locator('#jumpprose').click();
    await panel.screenshot({ path: '/tmp/bamti-prose-fragments-ko.png' });
    check('no panel errors', errors.length === 0);
    console.log(passed + ' fragment checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
