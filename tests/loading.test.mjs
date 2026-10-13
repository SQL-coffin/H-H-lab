// 3D sections load when the visitor gets near them (issue #8): opening the page downloads only the
// model the logo intro needs, the exploded view and the viewer start loading about two screens
// before the visitor reaches them, and without 3D they still show their still image.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openPage, sceneState, waitForState, scrollScene, litPixels, settle, NO_WEBGL } from './helpers.mjs';

const PHONE = { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true };
let server, browser;

before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); await server?.close(); });

// The 3D models (file names) the page has asked for so far.
const models = (page) => [...new Set(page.requests.filter((u) => u.endsWith('.glb')).map((u) => u.split('/').pop()))].sort();

// Scrolls (instantly) so the scene's section starts `screens` window heights below the bottom of
// the window: the visitor still has that far to scroll before it comes into view.
async function scrollBefore(page, id, screens) {
  await page.evaluate(([s, n]) => {
    const top = document.querySelector(`[data-scene="${s}"]`).getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - innerHeight * (1 + n), behavior: 'instant' });
  }, [id, screens]);
}

// How many window heights below the bottom of the window the scene's section still starts.
const screensAway = (page, id) => page.evaluate((s) => document.querySelector(`[data-scene="${s}"]`).getBoundingClientRect().top / innerHeight - 1, id);

for (const [label, options] of [['desktop', {}], ['phone', PHONE]]) {
  test(`${label}: opening the page downloads only bridge.glb for the intro, not model.glb or tissue.glb`, async () => {
    const page = await openPage(browser, `${server.url}/`, options);
    await waitForState(page, 'logo-intro', 'ready');
    await settle(page, 3000);
    assert.deepEqual(models(page), ['bridge.glb'], 'only the intro model is downloaded');
    // Not loaded yet is not broken: the sections wait for the visitor, they do not show the still image.
    assert.equal(await sceneState(page, 'exploded-case'), 'loading');
    assert.equal(await sceneState(page, 'case-viewer'), 'loading');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test(`${label}: a 3D section starts loading about two screens before the visitor reaches it and shows the 3D on arrival`, async () => {
    const page = await openPage(browser, `${server.url}/`, options);
    await waitForState(page, 'logo-intro', 'ready');

    // Exploded view: still well over two screens away, nothing is downloaded for it.
    await scrollBefore(page, 'exploded-case', 3.5);
    await settle(page, 2000);
    assert.deepEqual(models(page), ['bridge.glb'], 'exploded view: nothing downloaded while far away');
    assert.equal(await sceneState(page, 'exploded-case'), 'loading');
    // Within two screens: it loads before the visitor gets there.
    await scrollBefore(page, 'exploded-case', 1.5);
    await waitForState(page, 'exploded-case', 'ready');
    assert.deepEqual(models(page), ['bridge.glb', 'model.glb', 'tissue.glb'], 'exploded view: its models are downloaded');
    assert.ok(await screensAway(page, 'exploded-case') > 1, 'exploded view: ready while still below the window');
    await scrollScene(page, 'exploded-case');
    assert.equal(await sceneState(page, 'exploded-case'), 'ready', 'exploded view: 3D on arrival');
    await settle(page, 2000);
    assert.ok(await litPixels(page, 'exploded-case') > 300, 'exploded view: the case is drawn');

    // Viewer: the same, although its models are already downloaded by now.
    await scrollBefore(page, 'case-viewer', 3.5);
    await settle(page, 2000);
    assert.equal(await sceneState(page, 'case-viewer'), 'loading', 'viewer: not built while far away');
    await scrollBefore(page, 'case-viewer', 1.5);
    await waitForState(page, 'case-viewer', 'ready');
    assert.ok(await screensAway(page, 'case-viewer') > 1, 'viewer: ready while still below the window');
    await scrollScene(page, 'case-viewer');
    assert.equal(await sceneState(page, 'case-viewer'), 'ready', 'viewer: 3D on arrival');
    await settle(page, 2000);
    assert.ok(await litPixels(page, 'case-viewer') > 300, 'viewer: the case is drawn');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

for (const [label, how] of [['a model fails to download', 'model'], ['the browser has no WebGL', 'webgl']]) {
  test(`if ${label}, scrolling to each 3D section shows its still image`, async () => {
    const noGl = how === 'webgl' ? await launch(NO_WEBGL) : null;
    const page = await openPage(noGl || browser, `${server.url}/`, how === 'model' ? { route: (p) => p.route('**/model.glb', (r) => r.abort()) } : {});
    for (const id of ['exploded-case', 'case-viewer']) {
      await scrollScene(page, id);
      await waitForState(page, id, 'fallback', 60000);
      const poster = await page.evaluate((s) => getComputedStyle(document.querySelector(`[data-scene="${s}"] .case3d-poster`)).display !== 'none', id);
      assert.ok(poster, `${id}: the still image is shown`);
    }
    await (noGl ? noGl.close() : page.context().close());
  });
}
