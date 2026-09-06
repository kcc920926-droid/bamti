// node test/site-access.cjs (Playwright + local server required for panel checks)
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
require('../src/panel/site-access.js');
const { parse, rows } = globalThis.BAMTI.SITES;
const pair = host => [`http://${host}/*`, `https://${host}/*`];
for (const value of ['*.*', '*', '*://*/*', ' *.* ']) assert.deepEqual(parse(value), pair('*'));
assert.deepEqual(parse('*.Example.com'), pair('*.example.com'));
assert.deepEqual(parse('example.com/'), pair('example.com'));
assert.deepEqual(parse('localhost'), pair('localhost'));
assert.deepEqual(parse('127.0.0.1'), pair('127.0.0.1'));
assert.deepEqual(parse('https://*.example.com/*'), ['https://*.example.com/*']);
assert.deepEqual(parse('https://*.*'), ['https://*/*']);
assert.deepEqual(parse('한글.kr'), pair(new URL('https://한글.kr').hostname));
for (const value of ['', 'example.*', 'foo*bar.com', '*.com', '*.127.0.0.1', 'https://example.com/private', 'example.com:3000', 'https://example.com:443', 'https://user@example.com', 'ftp://example.com', '<all_urls>', 'file:///*', 'example.com?x=1', 'example.com#x', 'example.com\\evil', '%65xample.com', '-bad.com', 'good..com']) assert.throws(() => parse(value), value);
assert.deepEqual(rows([...pair('*'), 'file:///*', ...pair('example.com')]), [
  { label: '*.*', origins: pair('*') }, { label: 'file:///*', origins: ['file:///*'] }, { label: 'example.com', origins: pair('example.com') },
]);
assert.deepEqual(rows(['*://*.example.com/*'])[0].origins, ['*://*.example.com/*']);
console.log('PASS: parser, scope normalization, invalid/broadening inputs, paired grants');

(async () => {
  const browser = await chromium.launch();
  const origin = process.env.BAMTI_TEST_URL || 'http://127.0.0.1:8777';
  try {
    for (const locale of ['ko-KR', 'en-US']) {
      const page = await browser.newPage({ viewport: { width: 320, height: 950 }, locale });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', r => r.request().url().startsWith(origin) ? r.continue() : r.abort());
      const load = async () => {
        await page.goto(origin + '/test/panel-preview.html');
        await page.locator('#report').waitFor({ state: 'visible' });
        await page.waitForFunction(() => !document.getElementById('rescan').disabled && document.getElementById('siteaccess-count').textContent !== '…');
        await page.locator('#siteaccess > summary').click();
      };
      await load();
      assert(await page.locator('#siteaccess-empty').isVisible());
      const add = async value => {
        await page.locator('#siteaccess-input').fill(value);
        await page.locator('#siteaccess-input').press('Enter');
        await page.waitForFunction(() => !document.getElementById('siteaccess-input').disabled);
      };
      await add('*.*');
      assert.deepEqual(await page.evaluate(async () => (await chrome.permissions.getAll()).origins), pair('*'));
      assert.equal(await page.locator('#siteaccess-list li').count(), 1);
      assert.equal(await page.locator('#siteaccess-list strong').innerText(), '*.*');
      await page.waitForFunction(() => !document.getElementById('allow').disabled && document.getElementById('allow').dataset.granted === '1');
      await page.locator('#siteaccess > summary').click();
      await page.locator('#allow').click();
      assert.equal(await page.locator('#siteaccess').getAttribute('open'), '');
      assert.deepEqual(await page.evaluate(async () => (await chrome.permissions.getAll()).origins), pair('*'), 'per-site button must not silently remove broad access');
      await load();
      assert.equal(await page.locator('#siteaccess-list strong').innerText(), '*.*', 'grants survive reload');
      // A file grant and overlapping narrower web grant must survive deleting *.*.
      await page.evaluate(async () => chrome.permissions.request({ origins: ['file:///*', 'https://*.example.com/*'] }));
      await page.waitForFunction(() => document.getElementById('siteaccess-list').children.length === 3);
      await page.locator('#siteaccess-list li').filter({ has: page.locator('strong', { hasText: /^\*\.\*$/ }) }).locator('button').click();
      await page.waitForFunction(() => document.getElementById('siteaccess-list').children.length === 2);
      assert.deepEqual(await page.evaluate(async () => (await chrome.permissions.getAll()).origins), ['file:///*', 'https://*.example.com/*']);
      assert.deepEqual(await page.evaluate(async () => Promise.all(['https://example.com/*', 'https://a.example.com/*', 'https://evil-example.com/*', 'http://example.com/*'].map(o => chrome.permissions.contains({ origins: [o] })))), [true, true, false, false]);
      // Denial and thrown API error never create phantom saved entries.
      await page.evaluate(() => { window.originalRequest = chrome.permissions.request; chrome.permissions.request = async () => false; });
      await add('denied.example');
      assert.equal(await page.locator('#siteaccess-input').inputValue(), 'denied.example');
      assert.equal(await page.locator('#siteaccess-list li').count(), 2);
      assert.match(await page.locator('#siteaccess-status').innerText(), /기존 목록|unchanged/);
      await page.evaluate(() => { chrome.permissions.request = async () => { throw Error('API failure'); }; });
      await add('error.example');
      assert.match(await page.locator('#siteaccess-status').innerText(), /요청하지 못|Could not request/);
      await add('https://example.com/private');
      assert.match(await page.locator('#siteaccess-status').innerText(), /경로·포트|Paths and explicit ports/);
      await page.evaluate(() => { window.originalRemove = chrome.permissions.remove; chrome.permissions.remove = async () => false; });
      await page.locator('#siteaccess-list button').first().click();
      await page.waitForFunction(() => !document.getElementById('siteaccess-input').disabled);
      assert.equal(await page.locator('#siteaccess-list li').count(), 2);
      assert.match(await page.locator('#siteaccess-status').innerText(), /삭제하지 못|Could not remove/);
      // An unreadable list must not be misrepresented as an empty list.
      await page.evaluate(() => { window.originalGetAll = chrome.permissions.getAll; chrome.permissions.getAll = async () => { throw Error('API failure'); }; });
      await page.locator('#siteaccess-refresh').click();
      await page.waitForFunction(() => document.getElementById('siteaccess-count').textContent === '?');
      assert.equal(await page.locator('#siteaccess-empty').isVisible(), false);
      await page.evaluate(() => { chrome.permissions.getAll = window.originalGetAll; chrome.permissions.remove = window.originalRemove; });
      await page.locator('#siteaccess-refresh').click();
      await page.waitForFunction(() => document.getElementById('siteaccess-count').textContent === '2');
      // External permission removal is reflected without reloading the panel.
      await page.evaluate(async () => chrome.permissions.remove({ origins: ['https://*.example.com/*'] }));
      await page.waitForFunction(() => document.getElementById('siteaccess-count').textContent === '1');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (locale === 'en-US') assert(!/[가-힣]/.test(await page.locator('#siteaccess').innerText()));
      await page.screenshot({ path: `/tmp/bamti-site-access-${locale}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`PASS: ${locale}, wildcard approval, persistence, safe revocation, overlap, denial/errors, events, 320px layout`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
