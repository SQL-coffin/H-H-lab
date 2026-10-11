// "Take a closer look" viewer: the four pose buttons, drag to turn, and touch scrolling.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openPage, waitForState, scrollScene, litPixels, canvasFingerprint, difference, settle } from './helpers.mjs';

const ID = 'case-viewer';
const POSES = ['seated', 'layers', 'intaglio', 'closeup'];
let server, browser;

before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); await server?.close(); });

async function openViewer(options) {
  const page = await openPage(browser, `${server.url}/`, options);
  await scrollScene(page, ID);
  await waitForState(page, ID, 'ready');
  await settle(page);
  return page;
}

test('each pose button selects its pose, shows its caption and changes the picture', async () => {
  const page = await openViewer();
  const pictures = {};
  for (const pose of POSES) {
    await page.click(`[data-scene="${ID}"] [data-pose="${pose}"]`);
    await settle(page, 5000);
    const ui = await page.evaluate((s) => {
      const el = document.querySelector(`[data-scene="${s}"]`);
      return {
        pressed: [...el.querySelectorAll('[data-pose]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.pose),
        captions: [...el.querySelectorAll('[data-pose-caption].is-on')].map((c) => c.dataset.poseCaption),
      };
    }, ID);
    assert.deepEqual(ui.pressed, [pose], `${pose}: only its button is pressed`);
    assert.deepEqual(ui.captions, [pose], `${pose}: only its caption is shown`);
    assert.ok(await litPixels(page, ID) > 300, `${pose}: the case is visible on the canvas`);
    pictures[pose] = await canvasFingerprint(page, ID);
  }
  for (let i = 0; i < POSES.length; i++) {
    for (let j = i + 1; j < POSES.length; j++) {
      assert.ok(difference(pictures[POSES[i]], pictures[POSES[j]]) > 1, `${POSES[i]} and ${POSES[j]} look different`);
    }
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('pose buttons work from the keyboard', async () => {
  const page = await openViewer();
  await page.focus(`[data-scene="${ID}"] [data-pose="seated"]`);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const pressed = await page.evaluate((s) => document.querySelector(`[data-scene="${s}"] [data-pose][aria-pressed="true"]`).dataset.pose, ID);
  assert.equal(pressed, 'layers');
  await page.context().close();
});

test('dragging turns the case', async () => {
  const page = await openViewer();
  const before = await canvasFingerprint(page, ID);
  const box = await page.locator(`[data-scene="${ID}"] [data-3d-stage]`).boundingBox();
  const x = box.x + box.width * 0.65;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - box.width * 0.25, y, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  assert.ok(difference(before, await canvasFingerprint(page, ID)) > 1, 'the picture changed after dragging');
  assert.ok(await litPixels(page, ID) > 300, 'the case is still on screen');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('on touch screens a vertical swipe over the viewer still scrolls the page', async () => {
  const page = await openViewer({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const touchAction = await page.evaluate((s) => getComputedStyle(document.querySelector(`[data-scene="${s}"] [data-3d-stage]`)).touchAction, ID);
  assert.equal(touchAction, 'pan-y', 'the stage only claims horizontal pans');
  const box = await page.locator(`[data-scene="${ID}"] [data-3d-stage]`).boundingBox();
  const startY = await page.evaluate(() => window.scrollY);
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const y0 = box.y + box.height * 0.6;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - i * 30 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(page, 1500);
  assert.ok(await page.evaluate(() => window.scrollY) - startY > 100, 'the page scrolled');
  await page.context().close();
});
