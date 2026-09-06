// NODE_PATH=<Playwright install>/node_modules node test/prose.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.BAMTI_TEST_URL || 'http://127.0.0.1:8777';
const files = ['i18n/messages', 'i18n/i18n', 'core/context', 'core/signals', 'prose/english-rules', 'prose/prose', 'core/score', 'scan/scan'];
const sources = files.map(f => fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const en = "In today's fast-paced world, unlock your potential with our cutting-edge platform. Leverage seamless workflows to empower your team and elevate every experience. Moreover, this transformative solution is a game-changer for organizations ready to streamline their work.";
const ko = '혁신적인 플랫폼을 통해 업무의 미래를 경험하세요. 획기적인 자동화를 통해 모든 팀이 새로운 가능성을 발견할 수 있습니다. 압도적인 기술을 통해 복잡한 과정을 간단하게 바꿀 수 있습니다. 또한 협업의 새로운 기준을 제시합니다. 나아가 업무의 가능성을 넓힙니다. 아울러 누구나 업무의 미래를 만들어갑니다.';
const normalKo = '회의는 목요일 오후 두 시에 시작합니다. 자료를 통해 지난달 주문 내역을 확인할 수 있습니다. 변경한 항목은 파란색으로 표시했습니다. 담당자는 회의 전에 누락된 주문 두 건을 확인해 주세요.';
const normalEn = 'The test harness uses a robust mutex to protect shared state. Workers unlock the queue after each write. We leverage the existing test fixtures to check recovery after a timeout. No records were lost in the last run.';
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
(async () => {
  const browser = await chromium.launch();
  let passed = 0;
  const check = (name, ok) => { assert(ok, name); passed++; console.log('PASS: ' + name); };
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => r.abort());
    async function scan(html, locale = 'ko') {
      await page.setContent('<!doctype html><title>Writing fixture</title><style>body{font:16px Arial;margin:30px}p{max-width:700px}</style>' + html);
      for (const s of sources) await page.evaluate(s);
      return page.evaluate(l => BAMTI.scan(l), locale);
    }
    let r = await scan('<main><p id="ko">' + ko + '</p><p id="en">' + en + '</p></main>');
    check('both source engines fire and report their revisions', r.prose.signals.some(s => s.language === 'ko') && r.prose.signals.some(s => s.language === 'en') && r.prose.sources.every(s => s.revision.length === 40));
    check('only the two real paragraphs are inspected', r.prose.inspectedBlocks === 2 && r.prose.signals.every(s => s.count === 1));
    check('Korean thresholds detect through/hype/connectors', ['A-2', 'D-4', 'H-1'].every(id => r.prose.signals.some(s => s.id === 'prose-ko-' + id)));
    check('English keeps exact upstream IDs in evidence', r.prose.signals.find(s => s.language === 'en').examples.some(e => e.ruleId === 'fast-paced-world'));
    check('prose is excluded from all UI score accounting', r.prose.signals.every(s => s.weight === 0) && !r.signals.some(s => s.cat === 'prose') && r.totalSignals === 23);
    const scoreWithoutProse = await page.evaluate(() => { const fn = BAMTI.scanProse; BAMTI.scanProse = () => ({ signals: [] }); const n = BAMTI.scan().score; BAMTI.scanProse = fn; return n; });
    check('enabling the new engine does not change UI score', scoreWithoutProse === r.score);
    const english = await page.evaluate(() => BAMTI.scan('en'));
    check('panel locale does not change detection IDs/counts or text languages', JSON.stringify(r.prose.signals.map(s => [s.id, s.occurrences])) === JSON.stringify(english.prose.signals.map(s => [s.id, s.occurrences])) && english.prose.languages.length === 2);
    check('all generated English labels and suggestions are translated', english.prose.signals.every(s => !/[가-힣]/.test(s.label + s.hint)) && !/[가-힣]/.test(english.prose.note));
    check('raw Korean source excerpts survive English localization', english.prose.signals.some(s => s.examples.some(e => /[가-힣]/.test(e.excerpt))));
    const overlay = await page.evaluate(() => { const s = BAMTI.scan('en').prose.signals.find(x => x.language === 'en'); BAMTI.highlight(s.id, s); return document.querySelector('[id^="bamti-overlay-"]')?.textContent; });
    check('real page overlay locates prose paragraphs', overlay?.includes('Clustered English'));

    r = await scan('<p>' + normalKo + '</p><p>' + normalEn + '</p>');
    check('ordinary formal Korean and technical English are not flagged', r.prose.status === 'checked' && r.prose.signals.length === 0);
    r = await scan('<p>A robust system — that is what we tested today. We saved each record twice and checked every result against yesterday’s database export.</p>');
    check('one normal adjective and an em dash do not trigger', r.prose.signals.length === 0);
    r = await scan('<p>Unlock seamless workflows.</p><p>Leverage cutting-edge tools.</p><p>Empower every team.</p>');
    check('short UI copy is not concatenated into a fake prose paragraph', r.prose.status === 'insufficient' && !r.prose.signals.length);
    r = await scan('<main>' + ['h1', 'h2', 'h3', 'a'].map(t => '<' + t + '>' + en + '</' + t + '>').join('') + '</main>');
    check('headings and bare navigation links cannot pool into prose', r.prose.status === 'insufficient' && !r.prose.signals.length);
    r = await scan('<p>' + en.replace('seamless', '<a href="/docs">seamless</a>') + '</p>');
    check('inline links inside real prose keep their text', r.prose.signals.some(s => s.language === 'en'));
    r = await scan('<main><input type="search"><button>Search</button><button>Account</button><button>Settings</button><nav><p>' + en + '</p></nav><div role="feed"><article><h2>Recommended</h2><p>' + en + '</p></article></div></main>');
    check('YouTube-home-like navigation and feed copy do not fire prose rules', r.pageType.key === 'application' && !r.prose.signals.length && r.prose.status === 'insufficient');
    r = await scan('<p>' + normalKo + '</p>' + ['nav', 'header', 'footer', 'aside', 'button', 'pre', 'code', 'blockquote', 'q'].map(t => '<' + t + '>' + en + '</' + t + '>').join('') + '<div hidden><p>' + en + '</p></div><div contenteditable>' + en + '</div><details><summary>More</summary><p>' + en + '</p></details>');
    check('hidden content, editing controls, code and quotations are excluded', r.prose.inspectedBlocks === 1 && !r.prose.signals.length);
    r = await scan('<p>' + normalEn + ' “' + en + '”</p>');
    check('inline attributed/quoted stock phrases are masked', !r.prose.signals.length);
    r = await scan('<p>' + en.replace('cutting-edge', '<strong>cutting-</strong>edge') + '</p>');
    check('inline formatting preserves source match positions', r.prose.signals[0].examples.some(x => x.text === 'cutting-edge' && en.slice(x.start, x.end) === x.text));
    r = await scan('<p>' + ko + ' ' + en + '</p>');
    check('both languages are checked inside a mixed paragraph', r.prose.languages.includes('ko') && r.prose.languages.includes('en') && r.prose.signals.some(s => s.language === 'en'));
    await page.evaluate(text => { const host = document.createElement('div'); document.body.replaceChildren(host); host.attachShadow({ mode: 'open' }).innerHTML = '<p>' + text + '</p>'; }, en);
    r = await page.evaluate(() => BAMTI.scan());
    check('open shadow-root prose is detected', r.prose.signals.some(s => s.language === 'en'));

    // Positive fixture for every Korean pattern family and at/below-threshold check.
    const examples = [
      ['A-1', '자료에 대해 설명합니다.', 3], ['A-2', '자료를 통해 설명합니다.', 3],
      ['A-3', '업무에 있어서 검토합니다.', 2], ['A-4', '새롭다는 말이라는 점에서 확인합니다.', 3],
      ['A-8', '결과가 검토되어진다.', 2], ['A-10', '담당자가 확인할 수 있습니다.', 4],
      ['A-19', '회의에서의 발언을 적습니다.', 3], ['C-8', '기능이 아니라 경험입니다.', 2],
      ['C-11', '자료를 검토하고, 의견을 적습니다.', 6], ['D-1', '결론적으로 계획을 확인합니다.', 4],
      ['D-4', '혁신적인 도구입니다.', 3], ['G-2', '가능성이 있을 수 있습니다.', 2],
      ['H-1', '또한 자료를 확인합니다.', 3],
    ];
    for (const [id, phrase, min] of examples) {
      const result = await page.evaluate(({ id, phrase, min, base }) => {
        const yes = BAMTI.PROSE.analyzeBlock((phrase + ' ').repeat(min) + base);
        const no = BAMTI.PROSE.analyzeBlock((phrase + ' ').repeat(min - 1) + base);
        return yes.findings.some(s => s.id === 'prose-ko-' + id) && !no.findings.some(s => s.id === 'prose-ko-' + id);
      }, { id, phrase, min, base: normalKo });
      // normalKo contains one through/possibility occurrence: use an unrelated padding paragraph for those.
      if (id === 'A-2' || id === 'A-10') continue;
      check('Korean boundary: ' + id, result);
    }
    for (const [id, phrase, min] of examples.filter(x => ['A-2','A-10'].includes(x[0]))) {
      const result = await page.evaluate(({ id, phrase, min }) => {
        const base = '창문 옆 책상에 자료를 두었습니다. 담당자는 변경한 날짜를 파란색으로 표시했습니다. 오후에는 주문 내역과 재고 수량을 비교합니다. 문제가 있으면 다음 회의에서 다시 논의합니다.';
        return BAMTI.PROSE.analyzeBlock((phrase + ' ').repeat(min) + base).findings.some(s => s.id === 'prose-ko-' + id) && !BAMTI.PROSE.analyzeBlock((phrase + ' ').repeat(min - 1) + base).findings.some(s => s.id === 'prose-ko-' + id);
      }, { id, phrase, min });
      check('Korean boundary: ' + id, result);
    }
    const metrics = await page.evaluate(() => BAMTI.PROSE.koreanMetrics('자료를 읽고, 보고서를 적습니다. 사진을 보고 의견을 냅니다.'));
    check('ported Korean comma metrics have expected exact values', metrics.commaInclusionRate === 0.5 && metrics.commaUsageRate === 0.5 && metrics.endingCommaRate === 0.5);
    const count = await page.evaluate(() => BAMTI.EN_PROSE_PACK.rules.length);
    check('all 39 upstream English vocabulary rules are bundled', count === 39);
    r = await scan('<p>' + en.repeat(100) + '</p>' + ('<p>' + normalKo + '</p>').repeat(310));
    check('long documents have bounded cost and disclose partial coverage', r.prose.limited && r.prose.inspectedBlocks <= 300 && r.prose.characters <= 60000 && r.prose.signals.every(s => s.examples.length <= 8));
    check('no scanner runtime errors', errors.length === 0 && r.errors.length === 0);

    // Real panel with transport shim only; engine, rendering and copy code are unchanged.
    const panel = await browser.newPage({ viewport: { width: 360, height: 1000 }, locale: 'en-US' });
    await panel.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await panel.goto(origin + '/test/panel-preview.html#prose-bilingual');
    await panel.locator('#report').waitFor({ state: 'visible' });
    await panel.waitForFunction(() => !document.getElementById('rescan').disabled);
    check('panel exposes both language results and nearby jump link', await panel.locator('#proselist .sig').count() >= 4 && /Writing style/.test(await panel.locator('#jumpprose').innerText()));
    await panel.locator('#jumpprose').click();
    await panel.locator('#proselist .sig').last().locator('summary').click();
    check('panel displays upstream attribution and verbatim excerpts', await panel.locator('#proselist .sig').last().locator('.prose-source').getAttribute('href') === 'https://github.com/hwajongpark/slop-gate' && await panel.locator('#proselist .sig').last().locator('.prose-examples li').count() > 0);
    await panel.locator('#proselist .sig').last().getByRole('button', { name: /Highlight/ }).click();
    check('panel highlight sends prose ID to the real scanner route', (await panel.evaluate(() => __lastMsg.signalId)) === 'prose-en-vocabulary');
    await panel.locator('#copyreport').click();
    const copied = await panel.evaluate(() => navigator.clipboard.readText());
    check('full copy includes writing results, not only UI findings', copied.includes('Writing style') && copied.includes('Clustered English stock phrases'));
    await panel.locator('#search').fill('unmatched-writing-xyz');
    check('search filters prose cards', await panel.locator('#proselist .sig').count() === 0);
    await panel.locator('#search').fill('');
    for (const width of [280, 360, 480]) {
      await panel.setViewportSize({ width, height: 1000 });
      check('writing results fit width ' + width, await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await panel.locator('#language').selectOption('ko');
    await panel.waitForFunction(() => document.documentElement.lang === 'ko' && typeof lastReport !== 'undefined' && lastReport?.locale === 'ko');
    check('Korean override also translates English writing advice', (await panel.locator('#proselist').innerText()).includes('영어 상투 표현 밀집'));
    await panel.locator('#jumpprose').click();
    await panel.screenshot({ path: '/tmp/bamti-prose-ko.png' });
    await panel.locator('#language').selectOption('en');
    await panel.waitForFunction(() => document.documentElement.lang === 'en' && typeof lastReport !== 'undefined' && lastReport?.locale === 'en');
    await panel.locator('#jumpprose').click();
    await panel.screenshot({ path: '/tmp/bamti-prose-en.png' });
    console.log(passed + ' writing-style checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
