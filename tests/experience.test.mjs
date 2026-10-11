// The scroll-driven exploded view, the shared canvas, resizing, and the fallbacks.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openPage, sceneState, waitForState, scrollScene, litPixels, settle, NO_WEBGL } from './helpers.mjs';

let server, browser;

before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); await server?.close(); });

const open = (options) => openPage(browser, `${server.url}/`, options);

test('both 3D scenes load and the exploded view follows the scroll', async () => {
  const page = await open();
  await scrollScene(page, 'exploded-case');
  await waitForState(page, 'exploded-case', 'ready');
  await scrollScene(page, 'exploded-case', 0.02);
  await settle(page);
  const start = await page.evaluate(() => {
    const el = document.querySelector('[data-scene="exploded-case"]');
    return { intro: el.querySelector('.cap-intro').classList.contains('is-on'), wipe: +getComputedStyle(el).getPropertyValue('--wipe') || 0 };
  });
  assert.ok(start.intro, 'opening caption shows at the start');
  assert.ok(start.wipe < 0.01, 'light panel is not in yet');
  assert.ok(await litPixels(page, 'exploded-case') > 300, 'the case is drawn');

  await scrollScene(page, 'exploded-case', 0.95);
  await settle(page, 5000);
  const end = await page.evaluate(() => {
    const el = document.querySelector('[data-scene="exploded-case"]');
    return {
      final: el.querySelector('.cap-final').classList.contains('is-on'),
      wipe: +getComputedStyle(el).getPropertyValue('--wipe'),
      labels: [...el.querySelectorAll('[data-anchor].is-on')].length,
      labelBoxes: [...el.querySelectorAll('[data-anchor]')].map((l) => l.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom, right: r.right })),
    };
  });
  assert.ok(end.final, 'closing caption shows at the end');
  assert.ok(end.wipe > 0.99, 'light panel is in');
  assert.equal(end.labels, 3, 'all three layer labels are shown');
  for (const r of end.labelBoxes) assert.ok(r.top >= 0 && r.bottom <= 800 && r.right <= 1280, 'labels stay on screen');

  await scrollScene(page, 'case-viewer');
  await waitForState(page, 'case-viewer', 'ready');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the shared canvas moves to whichever 3D scene is on screen, also when jumping quickly', async () => {
  const page = await open();
  await scrollScene(page, 'case-viewer');
  await waitForState(page, 'case-viewer', 'ready');
  await waitForState(page, 'exploded-case', 'ready');
  const where = () => page.evaluate(() => document.querySelector('canvas')?.closest('[data-scene]')?.dataset.scene);
  for (let i = 0; i < 6; i++) {
    const target = i % 2 ? 'exploded-case' : 'case-viewer';
    await scrollScene(page, target, target === 'exploded-case' ? 0.5 : 0);
    await page.waitForTimeout(150);
  }
  await scrollScene(page, 'case-viewer');
  await settle(page);
  assert.equal(await page.evaluate(() => document.querySelectorAll('canvas').length), 1, 'there is one canvas');
  assert.equal(await where(), 'case-viewer');
  assert.ok(await litPixels(page, 'case-viewer') > 300, 'viewer is drawn after the jumps');
  await scrollScene(page, 'exploded-case', 0.5);
  await settle(page);
  assert.equal(await where(), 'exploded-case');
  assert.ok(await litPixels(page, 'exploded-case') > 300, 'exploded view is drawn after the jumps');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('after resizing or rotating, the canvas matches its stage and the case stays in view', async () => {
  const page = await open();
  await scrollScene(page, 'case-viewer');
  await waitForState(page, 'case-viewer', 'ready');
  for (const [w, h] of [[1024, 700], [800, 1100], [390, 800], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await scrollScene(page, 'case-viewer');
    await settle(page);
    const size = await page.evaluate(() => {
      const slot = document.querySelector('[data-scene="case-viewer"] [data-3d-canvas]');
      const c = slot.querySelector('canvas');
      return { slotW: slot.clientWidth, slotH: slot.clientHeight, cssW: c.clientWidth, cssH: c.clientHeight, bufW: c.width, dpr: Math.min(devicePixelRatio, 2) };
    });
    assert.equal(size.cssW, size.slotW, `${w}x${h}: canvas fills the stage width`);
    assert.equal(size.cssH, size.slotH, `${w}x${h}: canvas fills the stage height`);
    assert.equal(size.bufW, Math.round(size.slotW * size.dpr), `${w}x${h}: drawing buffer matches`);
    assert.ok(await litPixels(page, 'case-viewer') > 200, `${w}x${h}: the case is visible`);
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

for (const [label, pattern] of [['a model', '**/bridge.glb'], ['three.js', '**/three.module.min.js'], ['the experience script', '**/experience/main.js']]) {
  test(`if ${label} fails to download, both scenes show their still image`, async () => {
    const page = await open({ route: (p) => p.route(pattern, (r) => r.abort()) });
    await scrollScene(page, 'exploded-case');
    await waitForState(page, 'exploded-case', 'fallback', 60000);
    await waitForState(page, 'case-viewer', 'fallback', 60000);
    const posters = await page.evaluate(() => [...document.querySelectorAll('[data-scene] .case3d-poster')].map((img) => getComputedStyle(img).display !== 'none'));
    assert.deepEqual(posters, [true, true], 'still images are shown');
    await page.context().close();
  });
}

test('a slow model download shows the loading text, then the 3D', async () => {
  const page = await open({ route: (p) => p.route('**/bridge.glb', async (r) => { await new Promise((ok) => setTimeout(ok, 4000)); r.continue(); }) });
  await scrollScene(page, 'case-viewer');
  assert.equal(await sceneState(page, 'case-viewer'), 'loading');
  assert.ok(await page.isVisible('[data-scene="case-viewer"] [data-3d-loading]'), 'loading text is visible');
  await waitForState(page, 'case-viewer', 'ready');
  assert.equal(await page.isVisible('[data-scene="case-viewer"] [data-3d-loading]'), false, 'loading text is gone');
  await page.context().close();
});

test('without WebGL both scenes show their still image', async () => {
  const noGl = await launch(NO_WEBGL);
  const page = await openPage(noGl, `${server.url}/`);
  await waitForState(page, 'exploded-case', 'fallback', 30000);
  await waitForState(page, 'case-viewer', 'fallback', 30000);
  assert.equal(await page.isVisible('[data-scene="case-viewer"] .viewer3d-poses'), false, 'pose buttons are hidden');
  await noGl.close();
});
