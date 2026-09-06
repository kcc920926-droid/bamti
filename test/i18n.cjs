// Run with the local server and Playwright: node test/i18n.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = process.env.BAMTI_TEST_URL || 'http://127.0.0.1:8777';
const scripts = ['i18n/messages', 'i18n/i18n', 'core/context', 'core/signals', 'prose/english-rules', 'prose/prose', 'core/score', 'scan/scan'];
const sources = scripts.map(file => fs.readFileSync(path.join(root, 'src', file + '.js'), 'utf8'));
const hangul = /[가-힣]/;

(async () => {
  const browser = await chromium.launch();
  try {
    // Native manifest translations have the same keys and no unresolved placeholders.
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
    const ko = JSON.parse(fs.readFileSync(path.join(root, '_locales/ko/messages.json')));
    const en = JSON.parse(fs.readFileSync(path.join(root, '_locales/en/messages.json')));
    assert.equal(manifest.default_locale, 'en');
    assert.deepEqual(Object.keys(ko).sort(), Object.keys(en).sort());
    for (const match of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) assert(en[match[1]]?.message && ko[match[1]]?.message);

    const engine = await browser.newPage();
    await engine.route('**/*', r => r.request().url().startsWith(origin) ? r.continue() : r.abort());
    await engine.goto(origin + '/test/fixtures/slop-landing.html');
    for (const source of sources) await engine.evaluate(source);
    const reports = await engine.evaluate(() => {
      const korean = JSON.parse(JSON.stringify(BAMTI.scan('ko')));
      const english = JSON.parse(JSON.stringify(BAMTI.scan('en')));
      return { korean, english, definitions: BAMTI.SIGNALS.map(s => ({ id: s.id, label: s.label, hint: s.hint })) };
    });
    assert.equal(reports.korean.score, reports.english.score);
    const facts = r => [...r.signals, ...r.taste].map(s => [s.id, s.count, s.weight]);
    assert.deepEqual(facts(reports.korean), facts(reports.english));
    assert.deepEqual(reports.english.errors, []);
    assert.equal(reports.definitions.length, 34);
    for (const definition of reports.definitions) {
      assert(!hangul.test(definition.label), definition.id + ' label');
      assert(!hangul.test(definition.hint), definition.id + ' hint');
    }
    for (const s of [...reports.english.signals, ...reports.english.taste]) assert(!hangul.test(s.evidence), s.id + ' evidence');
    await engine.evaluate(() => BAMTI.highlightAll(BAMTI.scan('en').signals));
    assert(!hangul.test(await engine.locator('[id^="bamti-overlay-"]').innerText()));
    const data = await engine.evaluate(() => {
      const raw = '<img onerror=alert(1)> 한국어 원문 {0}';
      return { raw, translated: BAMTI.I18N.t`<title>이 "${raw}"` };
    });
    assert.equal(data.translated, `The <title> is "${data.raw}"`);
    console.log('PASS: all 34 rule labels/hints, evidence, real overlays, unchanged scores and verbatim page data');

    for (const [locale, expected] of [['ko-KR', 'ko'], ['en-US', 'en'], ['en-GB', 'en'], ['fr-FR', 'en']]) {
      const page = await browser.newPage({ viewport: { width: 360, height: 1000 }, locale });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', r => r.request().url().startsWith(origin) ? r.continue() : r.abort());
      await page.goto(origin + '/test/panel-preview.html');
      await page.locator('#report').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.getElementById('rescan').disabled);
      assert.equal(await page.locator('html').getAttribute('lang'), expected);
      assert.equal(await page.evaluate(() => lastReport.locale), expected);
      assert.equal(await page.locator('#language').inputValue(), 'auto');
      if (expected === 'en') {
        const owned = await page.evaluate(() => {
          const parts = [...document.querySelectorAll('header,main')].map(n => n.cloneNode(true));
          for (const part of parts) part.querySelectorAll('select').forEach(n => n.remove());
          return parts.map(n => n.textContent).join('\n');
        });
        assert(!hangul.test(owned), 'English panel still contains untranslated UI');
        for (const width of [280, 360, 480]) {
          await page.setViewportSize({ width, height: 1000 });
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `English layout at ${width}px`);
        }
        await page.locator('#search').fill('placeholder');
        assert(await page.locator('#list .sig').count() > 0);
        await page.locator('#search').fill('');
        await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copied = text; } } }));
        await page.locator('#copyreport').click();
        assert.match(await page.evaluate(() => window.copied), /Evidence:.*\nSuggestion:/s);
        assert(!hangul.test(await page.evaluate(() => window.copied)));
      }
      // Override and persistence across full reload; restore browser-following mode.
      const next = expected === 'en' ? 'ko' : 'en';
      await page.locator('#language').selectOption(next);
      await page.waitForFunction(lang => document.documentElement.lang === lang, next);
      await page.locator('#report').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => lastReport.locale), next);
      await page.reload();
      await page.locator('#report').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#language').inputValue(), next);
      assert.equal(await page.locator('html').getAttribute('lang'), next);
      await page.locator('#language').selectOption('auto');
      await page.waitForFunction(lang => document.documentElement.lang === lang, expected);
      await page.locator('#report').waitFor({ state: 'visible' });
      assert.deepEqual(errors, []);
      console.log(`PASS: ${locale} → ${expected}; language override, persistence, restore, layout and copy`);
      await page.close();
    }

    const page = await browser.newPage({ locale: 'en-US', viewport: { width: 420, height: 1100 } });
    await page.route('**/*', r => r.request().url().startsWith(origin) ? r.continue() : r.abort());
    await page.goto(origin + '/test/panel-preview.html');
    await page.locator('#report').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.getElementById('rescan').disabled);
    await page.evaluate(() => {
      chrome.tabs.get = async id => ({ id, windowId: 7, url: 'file:///tmp/example.html' });
      chrome.extension.isAllowedFileSchemeAccess = cb => cb(false);
    });
    await page.locator('#rescan').click();
    await page.locator('#error').waitFor({ state: 'visible' });
    assert.match(await page.locator('#errmsg').innerText(), /Allow access to file URLs/);
    assert.equal(await page.locator('#erraction').innerText(), 'Open file access settings');
    await page.evaluate(() => { chrome.tabs.get = async id => ({ id, windowId: 7, url: 'chrome://newtab/' }); });
    await page.locator('#rescan').click();
    await page.locator('#empty').waitFor({ state: 'visible' });
    assert.match(await page.locator('#emptymsg').innerText(), /Internal browser pages/);
    console.log('PASS: English file-access and restricted-page states');

    // Native extension smoke test: locale catalogs, saved preference and bootstrap without a shim.
    const native = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
    });
    try {
      const worker = native.serviceWorkers()[0] || await native.waitForEvent('serviceworker', { timeout: 15000 });
      const meta = await worker.evaluate(() => ({ name: chrome.runtime.getManifest().name, title: chrome.i18n.getMessage('actionTitle') }));
      assert(!meta.name.includes('__MSG_') && meta.title.length > 10);
      await worker.evaluate(() => chrome.storage.local.set({ bamtiLanguage: 'en' }));
      const panel = await native.newPage();
      const nativeErrors = []; panel.on('pageerror', e => nativeErrors.push(e.message));
      await panel.goto(`chrome-extension://${new URL(worker.url()).hostname}/src/panel/panel.html`);
      await panel.waitForFunction(() => document.documentElement.lang === 'en' && document.querySelector('.brand').textContent === 'Bamti');
      await panel.locator('#language').selectOption('ko');
      await panel.waitForFunction(() => document.documentElement.lang === 'ko' && document.querySelector('.brand').textContent === '밤티');
      assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('bamtiLanguage')).bamtiLanguage), 'ko');
      assert.deepEqual(nativeErrors, []);
      console.log('PASS: native extension catalogs, English bootstrap, Korean override and Chrome storage');
    } finally { await native.close(); }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
