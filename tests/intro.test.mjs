// Logo intro: scrolling flies through the logo's frame into the bridge.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openPage, waitForState, scrollScene, litPixels, canvasFingerprint, difference, settle, NO_WEBGL } from './helpers.mjs';

const ID = 'logo-intro';
let server, browser;

before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); await server?.close(); });

for (const [label, viewport, extra] of [['desktop', { width: 1440, height: 900 }, {}], ['phone', { width: 390, height: 800 }, { hasTouch: true, isMobile: true }]]) {
  test(`${label}: starts on the logo and ends on the lit bridge`, async () => {
    const page = await openPage(browser, `${server.url}/`, { viewport, ...extra });
    await waitForState(page, ID, 'ready');
    await scrollScene(page, ID, 0);
    await settle(page);
    const start = await page.evaluate((s) => {
      const el = document.querySelector(`[data-scene="${s}"]`);
      const name = el.querySelector('.logo-name');
      return { nameOpacity: +getComputedStyle(name.parentElement).opacity, endOn: el.querySelector('.intro3d-end').classList.contains('is-on') };
    }, ID);
    assert.ok(start.nameOpacity > 0.9, 'the lab name shows under the logo at the start');
    assert.equal(start.endOn, false, 'the closing line is hidden at the start');
    assert.ok(await litPixels(page, ID) > 150, 'the 3D logo is drawn');
    const startPicture = await canvasFingerprint(page, ID);

    await scrollScene(page, ID, 0.45);
    await settle(page);
    assert.ok(difference(startPicture, await canvasFingerprint(page, ID)) > 2, 'the view changes while flying');

    await scrollScene(page, ID, 1);
    await settle(page, 5000);
    const end = await page.evaluate((s) => {
      const el = document.querySelector(`[data-scene="${s}"]`);
      return { nameOpacity: +getComputedStyle(el.querySelector('.intro3d-band')).opacity, endOn: el.querySelector('.intro3d-end').classList.contains('is-on') };
    }, ID);
    assert.ok(end.nameOpacity < 0.05, 'the lab name has faded out');
    assert.ok(end.endOn, 'the closing line shows at the end');
    assert.ok(await litPixels(page, ID) > 400, 'the lit bridge fills the view');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

test('without WebGL the intro is the plain logo band', async () => {
  const noGl = await launch(NO_WEBGL);
  const page = await openPage(noGl, `${server.url}/`);
  await waitForState(page, ID, 'fallback', 30000);
  const band = await page.evaluate((s) => {
    const el = document.querySelector(`[data-scene="${s}"]`);
    const logo = el.querySelector('.logo');
    return { height: el.offsetHeight, logoVisible: getComputedStyle(logo).visibility === 'visible' && logo.offsetWidth > 100, vh: innerHeight };
  }, ID);
  assert.ok(band.logoVisible, 'the logo image shows');
  assert.ok(band.height < band.vh, 'no long empty scroll track');
  await noGl.close();
});

test('if the logo image fails to load as a texture, the intro falls back to the logo band', async () => {
  const page = await openPage(browser, `${server.url}/`, { route: (p) => p.route('**/images/logo.webp', (r) => r.abort()) });
  await waitForState(page, ID, 'fallback', 60000);
  await page.context().close();
});
