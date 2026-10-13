// The 3D stops drawing when nothing moves (issue #9): once the scroll, the mouse lean and the
// scene's own motion have settled, no new frame is drawn and the canvas keeps its last picture.
// Scrolling, the mouse, the pose buttons, dragging and resizing start it again at once, and a pose
// change runs to the end before it stops.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, launch, openPage, waitForState, scrollScene, litPixels, canvasFingerprint, difference,
  drawCalls, waitForStill,
} from './helpers.mjs';

const PHONE = { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true };
const VIEWER = 'case-viewer';
let server, browser;

before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); await server?.close(); });

const open = (options) => openPage(browser, `${server.url}/`, options);

async function goTo(page, id, fraction = 0) {
  await scrollScene(page, id, fraction);
  await waitForState(page, id, 'ready');
}

// With the 3D stopped, does `action` and reports whether frames were drawn within a second
// (drew), and how much the picture differs once it has stopped again (change).
async function wakeBy(page, id, what, action) {
  assert.ok(await waitForStill(page), `${what}: the 3D has stopped before`);
  const picture = await canvasFingerprint(page, id);
  const calls = await drawCalls(page);
  await action();
  await page.waitForTimeout(1000);
  const drew = await drawCalls(page) - calls;
  assert.ok(await waitForStill(page), `${what}: the 3D stops again afterwards`);
  return { drew, change: difference(picture, await canvasFingerprint(page, id)) };
}

// The viewer's canvas fills its stage and its drawing buffer matches (as after any resize).
async function canvasFitsStage(page) {
  return page.evaluate((s) => {
    const slot = document.querySelector(`[data-scene="${s}"] [data-3d-canvas]`);
    const c = slot.querySelector('canvas');
    return c.clientWidth === slot.clientWidth && c.clientHeight === slot.clientHeight && c.width === Math.round(slot.clientWidth * Math.min(devicePixelRatio, 2));
  }, VIEWER);
}

for (const [label, options] of [['desktop', {}], ['phone', PHONE]]) {
  test(`${label}: when nothing moves, each 3D section stops redrawing once it has settled (no new frame for 2 seconds) and keeps its last picture`, async () => {
    const page = await open(options);
    for (const [id, fraction, lit] of [['logo-intro', 0, 150], ['exploded-case', 0.3, 300], [VIEWER, 0, 300]]) {
      await goTo(page, id, fraction);
      assert.ok(await waitForStill(page), `${id}: drawing stops once everything has settled`);
      const picture = await canvasFingerprint(page, id);
      const calls = await drawCalls(page);
      await page.waitForTimeout(2000);
      assert.equal(await drawCalls(page) - calls, 0, `${id}: no new frame for 2 seconds`);
      assert.ok(await litPixels(page, id) > lit, `${id}: the picture is still there, not blank`);
      assert.ok(difference(picture, await canvasFingerprint(page, id)) < 0.5, `${id}: the picture is unchanged`);
    }
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

test('desktop: after the 3D has stopped, scrolling, the mouse, a pose button, dragging and resizing the window each start drawing again at once and the picture follows', async () => {
  const page = await open();

  await goTo(page, 'exploded-case', 0.3);
  let r = await wakeBy(page, 'exploded-case', 'scrolling', () => scrollScene(page, 'exploded-case', 0.45));
  assert.ok(r.drew > 0, 'scrolling: draws again');
  assert.ok(r.change > 1, 'scrolling: the picture follows the scroll');

  await goTo(page, VIEWER);
  const stage = await page.locator(`[data-scene="${VIEWER}"] [data-3d-stage]`).boundingBox();
  assert.ok(await waitForStill(page), 'viewer: the 3D has stopped');
  const upright = await canvasFingerprint(page, VIEWER);
  r = await wakeBy(page, VIEWER, 'moving the mouse', () => page.mouse.move(stage.x + stage.width * 0.95, stage.y + stage.height * 0.3));
  assert.ok(r.drew > 0, 'moving the mouse: draws again');
  assert.ok(r.change > 1, 'moving the mouse: the case leans toward it');
  r = await wakeBy(page, VIEWER, 'the mouse leaving', () => page.mouse.move(stage.x + stage.width * 0.5, stage.y + stage.height + 40));
  assert.ok(r.drew > 0, 'the mouse leaving: draws again');
  assert.ok(difference(upright, await canvasFingerprint(page, VIEWER)) < 0.5, 'the mouse leaving: the case stands up straight again');

  r = await wakeBy(page, VIEWER, 'a pose button', () => page.click(`[data-scene="${VIEWER}"] [data-pose="layers"]`));
  assert.ok(r.drew > 0, 'a pose button: draws again');
  assert.ok(r.change > 1, 'a pose button: the case moves to the pose');

  r = await wakeBy(page, VIEWER, 'dragging', async () => {
    const x = stage.x + stage.width * 0.65;
    const y = stage.y + stage.height * 0.5;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - stage.width * 0.25, y, { steps: 8 });
    await page.mouse.up();
  });
  assert.ok(r.drew > 0, 'dragging: draws again');
  assert.ok(r.change > 1, 'dragging: the case turns');

  r = await wakeBy(page, VIEWER, 'resizing the window', async () => {
    await page.setViewportSize({ width: 1024, height: 700 });
    await scrollScene(page, VIEWER);
  });
  assert.ok(r.drew > 0, 'resizing the window: draws again');
  assert.ok(await canvasFitsStage(page), 'resizing the window: the canvas fits the stage');
  assert.ok(await litPixels(page, VIEWER) > 200, 'resizing the window: the case is drawn, not blank');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('phone: after the 3D has stopped, scrolling, tapping a pose button and turning the phone each start drawing again and the picture follows', async () => {
  const page = await open(PHONE);

  await goTo(page, 'exploded-case', 0.3);
  let r = await wakeBy(page, 'exploded-case', 'scrolling', () => scrollScene(page, 'exploded-case', 0.45));
  assert.ok(r.drew > 0, 'scrolling: draws again');
  assert.ok(r.change > 1, 'scrolling: the picture follows the scroll');

  await goTo(page, VIEWER);
  r = await wakeBy(page, VIEWER, 'tapping a pose button', () => page.tap(`[data-scene="${VIEWER}"] [data-pose="layers"]`));
  assert.ok(r.drew > 0, 'tapping a pose button: draws again');
  assert.ok(r.change > 1, 'tapping a pose button: the case moves to the pose');

  for (const [turn, size] of [['landscape', { width: 800, height: 390 }], ['portrait', { width: 390, height: 800 }]]) {
    r = await wakeBy(page, VIEWER, `turning the phone to ${turn}`, async () => {
      await page.setViewportSize(size);
      await scrollScene(page, VIEWER);
    });
    assert.ok(r.drew > 0, `${turn}: draws again`);
    assert.ok(await canvasFitsStage(page), `${turn}: the canvas fits the stage`);
    assert.ok(await litPixels(page, VIEWER) > 200, `${turn}: the case is drawn, not blank`);
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('turning on "reduce motion" in the system settings while the 3D has stopped redraws it at once', async () => {
  const page = await open();
  await goTo(page, VIEWER);
  const stage = await page.locator(`[data-scene="${VIEWER}"] [data-3d-stage]`).boundingBox();
  // Lean the case toward the mouse; with reduced motion there is no lean.
  await page.mouse.move(stage.x + stage.width * 0.95, stage.y + stage.height * 0.3);
  const r = await wakeBy(page, VIEWER, 'reduce motion', () => page.emulateMedia({ reducedMotion: 'reduce' }));
  assert.ok(r.drew > 0, 'draws again');
  assert.ok(r.change > 1, 'the lean is gone');
  await page.context().close();
});

test('after a pose button, the 3D keeps drawing until the case has reached the new pose', async () => {
  const page = await open();
  await goTo(page, VIEWER);
  assert.ok(await waitForStill(page), 'the 3D has stopped');
  const seated = await canvasFingerprint(page, VIEWER);
  // From the keyboard, so the mouse does not move (its lean would keep the loop running a while).
  await page.focus(`[data-scene="${VIEWER}"] [data-pose="intaglio"]`);
  await page.keyboard.press('Enter');
  assert.ok(await waitForStill(page), 'drawing stops after the pose change');
  const stopped = await canvasFingerprint(page, VIEWER);
  assert.ok(difference(seated, stopped) > 1, 'the case moved');
  // Reference picture of the pose itself: with reduced motion the viewer jumps straight into it.
  const calls = await drawCalls(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.ok(await waitForStill(page), 'drawing stops again');
  assert.ok(await drawCalls(page) - calls > 0, 'the reference was drawn');
  assert.ok(difference(stopped, await canvasFingerprint(page, VIEWER)) < 0.5, 'the case had reached its pose when drawing stopped');
  await page.context().close();
});
