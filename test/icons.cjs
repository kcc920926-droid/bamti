// Real Chrome extension loading + PNG decode/visibility regression.
// Requires Playwright with Chromium installed: node test/icons.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

(async () => {
  for (const size of [16, 24, 32, 48, 128]) assert(manifest.action.default_icon[size], `toolbar ${size}px`);
  for (const size of [16, 32, 48, 128]) assert(manifest.icons[size], `management ${size}px`);
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
    const loaded = await worker.evaluate(() => chrome.runtime.getManifest());
    assert.deepEqual(loaded.action.default_icon, manifest.action.default_icon);
    const extensionOrigin = new URL(worker.url()).origin;
    const id = new URL(worker.url()).hostname;
    // URL.origin is "null" for this nonstandard scheme in Node.
    const origin = extensionOrigin === 'null' ? `chrome-extension://${id}` : extensionOrigin;
    const page = await context.newPage();
    for (const [size, file] of Object.entries({ ...manifest.icons, ...manifest.action.default_icon })) {
      assert(fs.existsSync(path.join(root, file)), file);
      await page.goto(`${origin}/${file}`);
      const pixels = await page.evaluate(async () => {
        const img = document.querySelector('img');
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let opaque = 0, transparent = 0;
        const colors = new Set();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 32) transparent++;
          if (data[i + 3] > 200) { opaque++; colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`); }
        }
        return { width: canvas.width, height: canvas.height, opaque, transparent, colors: colors.size };
      });
      assert.equal(pixels.width, Number(size)); assert.equal(pixels.height, Number(size));
      assert(pixels.opaque > size * size * 0.25, `${file}: visible artwork`);
      assert(pixels.transparent > size * size * 0.05, `${file}: genuine transparent background`);
      assert(pixels.colors > 12, `${file}: not a solid placeholder`);
      console.log(`PASS: ${file} loaded by Chrome, ${size}×${size}, visible artwork and alpha`);
    }
    console.log('PASS: extension service worker and toolbar icon manifest loaded');
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
