/* Run against the local server: node test/panel-ux.cjs
 * Requires Playwright. BAMTI_TEST_URL defaults to http://127.0.0.1:8777.
 * Uses the real panel and scanner; Chrome APIs are simulated in panel-preview.html.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const origin = process.env.BAMTI_TEST_URL || 'http://127.0.0.1:8777';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 900 }, locale: 'ko-KR' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Fixtures need no external services. Keep runs deterministic and local.
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(`${origin}/test/panel-preview.html`);
    await page.locator('#report').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.getElementById('rescan').disabled);
    assert(await page.locator('#list .sig').count() > 0);
    assert.equal(await page.locator('.diagnostics').getAttribute('open'), null);
    assert.equal(await page.locator('#tastegroup').getAttribute('open'), null);
    assert.equal(await page.locator('#showall').isVisible(), false);

    await page.locator('[data-category="unfinished"]').click();
    assert.equal(await page.locator('#list .grp').count(), 1);
    assert.match(await page.locator('#list .grp').innerText(), /미완성/);
    await page.locator('#search').fill('존재하지않는검색어');
    assert.equal(await page.locator('#list .sig').count(), 0);
    assert.equal(await page.locator('#noresults').isVisible(), true);
    await page.locator('#clearsearch').click();
    await page.locator('#expandall').click();
    assert.equal(await page.locator('#list details[open]').count(), await page.locator('#list .sig').count());
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copied = text; } } }));
    await page.locator('#copyreport').click();
    assert.match(await page.evaluate(() => window.__copied), /개선 방향:/);
    assert.match(await page.evaluate(() => window.__copied), /AI 생성 확률이 아닙니다/);
    await page.locator('#list .body button').filter({ hasText: '개선 제안 복사' }).first().click();
    assert.match(await page.evaluate(() => window.__copied), /근거:/);
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
    await page.locator('#copyreport').click();
    assert.equal(await page.locator('#copyfallback').isVisible(), true);

    await page.locator('#overlay').click();
    await page.locator('#list button').filter({ hasText: '곳 표시' }).first().click();
    assert.equal(await page.locator('#overlay').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#showall').innerText(), '선택 해제');
    await page.locator('#showall').click();
    assert.equal(await page.evaluate(() => window.__lastMsg.type), 'bamti:clear');
    assert.equal(await page.locator('#overlay').getAttribute('aria-pressed'), 'false');
    console.log('PASS: filtering, empty search, expansion, copy/fallback, highlight state');

    // Keep real report data while controlling API timing and failures.
    await page.evaluate(() => {
      window.__report = lastReport;
      window.__active = 1;
      window.__deferred = new Map();
      window.__mode = 'normal';
      chrome.tabs.query = async () => [{ id: window.__active, windowId: 7 }];
      chrome.tabs.get = async id => ({ id, windowId: 7, url: window.__mode === 'file' ? 'file:///demo.html' : window.__mode === 'blocked' ? 'chrome://newtab/' : `http://localhost/demo-${id}` });
      chrome.scripting.executeScript = async () => {
        if (window.__mode === 'permission') throw new Error('Cannot access contents of url');
        if (window.__mode === 'error') throw new Error('Unfriendly internal exception');
      };
      chrome.tabs.sendMessage = async (id, msg) => {
        if (msg.type !== 'bamti:scan') return { ok: true, n: 2 };
        const report = { ...window.__report, title: `Page ${id}`, url: `http://localhost/demo-${id}` };
        if (window.__mode === 'deferred') return new Promise(resolve => window.__deferred.set(id, () => resolve({ ok: true, report })));
        return { ok: true, report };
      };
    });
    await page.evaluate(() => { window.__mode = 'deferred'; window.__active = 2; window.__onActivated({ tabId: 2, windowId: 7 }); });
    await page.waitForFunction(() => window.__deferred.has(2));
    await page.evaluate(() => { window.__active = 3; window.__onActivated({ tabId: 3, windowId: 7 }); window.__deferred.get(2)(); });
    await page.waitForFunction(() => window.__deferred.has(3));
    assert.equal(await page.locator('#report').isVisible(), false, 'previous tab must never flash while new tab is pending');
    await page.evaluate(() => window.__deferred.get(3)());
    await page.waitForFunction(() => document.getElementById('pagetext').textContent.includes('Page 3') && !document.getElementById('rescan').disabled);
    assert.equal(await page.locator('#search').inputValue(), '');

    // In-flight scan invalidation on navigation, including same-tab reload.
    await page.evaluate(() => { window.__deferred.delete(3); scan(3); });
    await page.waitForFunction(() => window.__deferred.has(3));
    await page.evaluate(() => window.__onUpdated(3, { status: 'loading' }));
    await page.evaluate(() => window.__deferred.get(3)());
    await page.waitForFunction(() => !document.getElementById('rescan').disabled);
    assert.equal(await page.locator('#copyreport').isEnabled(), false);
    await page.evaluate(() => { window.__mode = 'normal'; window.__onUpdated(3, { status: 'complete' }); });
    await page.waitForFunction(() => !document.getElementById('copyreport').disabled);
    await page.evaluate(() => window.__onActivated({ tabId: 99, windowId: 999 }));
    assert.match(await page.locator('#pagetext').innerText(), /Page 3/);
    console.log('PASS: rapid tab switch, stale-result rejection, reload recovery, window isolation');

    await page.evaluate(() => { window.__mode = 'permission'; });
    await page.locator('#rescan').click();
    await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#erraction').innerText(), '이 사이트 항상 허용');
    await page.evaluate(() => { chrome.permissions.request = async request => { window.__permission = request; return false; }; });
    await page.locator('#erraction').click();
    assert.deepEqual(await page.evaluate(() => window.__permission.origins), ['http://localhost/*']);
    assert.match(await page.locator('#status').innerText(), /권한을 변경하지/);
    await page.evaluate(() => { window.__mode = 'file'; chrome.extension.isAllowedFileSchemeAccess = cb => cb(false); });
    await page.locator('#retry').click();
    await page.waitForFunction(() => document.getElementById('erraction').textContent === '파일 접근 설정 열기');
    await page.evaluate(() => { window.__mode = 'error'; });
    await page.locator('#retry').click();
    await page.waitForFunction(() => document.getElementById('errmsg').textContent.includes('페이지와 연결'));
    assert.equal(await page.locator('#erraction').isVisible(), false);
    await page.evaluate(() => { window.__mode = 'blocked'; });
    await page.locator('#retry').click();
    await page.locator('#empty').waitFor({ state: 'visible' });
    await page.evaluate(() => {
      window.__mode = 'normal';
      window.__report = { ...window.__report, signals: [], taste: [], firedCount: 0, errors: [{ id: 'test' }], truncated: 7000 };
      for (const c of Object.values(window.__report.byCat)) { c.count = 0; c.pct = 0; }
    });
    await page.locator('#rescan').click();
    await page.locator('#report').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#noresults').isVisible(), true);
    assert.equal(await page.locator('#coverage').isVisible(), true);
    assert.equal(await page.locator('#tastegroup').isVisible(), false);
    assert.equal(await page.locator('#expandall').isEnabled(), false);
    console.log('PASS: denied permission, file settings label, retry, restricted page, partial/zero results');

    for (const width of [280, 360, 480]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow at ${width}px`);
    }
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    assert.equal(await page.locator('#busy .spin').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: 280/360/480px layout, reduced motion, no panel runtime errors');

    // Real scanner message routing must use the current injected functions and one overlay.
    const scanner = await browser.newPage();
    await scanner.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await scanner.goto(`${origin}/test/fixtures/slop.html`);
    await scanner.evaluate(() => {
      window.__handlers = [];
      window.chrome = { runtime: { onMessage: { addListener: fn => window.__handlers.push(fn) } } };
      window.__request = msg => new Promise(resolve => window.__handlers[0](msg, {}, resolve));
    });
    for (let n = 0; n < 3; n++) {
      for (const file of ['i18n/messages.js', 'i18n/i18n.js', 'core/context.js', 'core/signals.js', 'prose/english-rules.js', 'prose/prose.js', 'core/score.js', 'scan/scan.js']) await scanner.addScriptTag({ url: `${origin}/src/${file}?run=${n}` });
      const result = await scanner.evaluate(async () => {
        const { report } = await window.__request({ type: 'bamti:scan' });
        const sig = report.signals.find(s => s.count > 0);
        await window.__request({ type: 'bamti:highlight', signalId: sig.id });
        return { handlers: window.__handlers.length, layers: document.querySelectorAll('[id^="bamti-overlay-"]').length, errors: report.errors.length };
      });
      assert.deepEqual(result, { handlers: 1, layers: 1, errors: 0 });
      await scanner.evaluate(() => window.__request({ type: 'bamti:clear' }));
      assert.equal(await scanner.locator('[id^="bamti-overlay-"] > *').count(), 0);
    }
    console.log('PASS: repeated real scanner injection, one message listener, one removable overlay');
    await page.goto(`${origin}/test/regression.html`);
    await page.waitForFunction(() => window.__done, null, { timeout: 60000 });
    const regression = await page.locator('#out').innerText();
    console.log(regression);
    assert.match(regression, /14 PASS \/ 0 FAIL/);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
