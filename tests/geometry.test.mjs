// Bug 1 regression: layer bounding boxes must be valid boxes in each layer's own space,
// and the centres used for framing and labels must be real numbers inside the model.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openPage } from './helpers.mjs';

let server, browser, geometry;

before(async () => {
  server = await startServer();
  browser = await launch();
  const page = await openPage(browser, `${server.url}/tests/fixtures/geometry.html`);
  await page.waitForFunction(() => window.__geometry, null, { timeout: 120000 });
  geometry = await page.evaluate(() => window.__geometry);
  assert.deepEqual(page.errors, [], 'no errors while building the case');
});
after(async () => { await browser?.close(); await server?.close(); });

test('the case builds (all three GLB models load)', () => {
  assert.ok(geometry.ok, geometry.error);
  assert.deepEqual(Object.keys(geometry.layers).sort(), ['bridge', 'model', 'tissue']);
  for (const [name, l] of Object.entries(geometry.layers)) assert.ok(l.vertices > 1000, `${name} has geometry`);
  assert.ok(Number.isFinite(geometry.radius) && geometry.radius > 10, 'case radius is a sensible number of mm');
});

test('every layer box has min <= max on every axis and is not empty', () => {
  for (const [name, l] of Object.entries(geometry.layers)) {
    assert.equal(l.empty, false, `${name} box is not empty`);
    for (let axis = 0; axis < 3; axis++) assert.ok(l.min[axis] <= l.max[axis], `${name} axis ${'xyz'[axis]}: ${l.min[axis]} <= ${l.max[axis]}`);
  }
});

test('layer boxes match the exact vertex bounds (within 0.5 mm)', () => {
  for (const [name, l] of Object.entries(geometry.layers)) {
    for (let axis = 0; axis < 3; axis++) {
      // The box may be a little looser than the vertices (it is built from mesh boxes), never tighter.
      assert.ok(l.min[axis] <= l.exactMin[axis] + 1e-6 && l.exactMin[axis] - l.min[axis] < 0.5, `${name} min ${'xyz'[axis]}`);
      assert.ok(l.max[axis] >= l.exactMax[axis] - 1e-6 && l.max[axis] - l.exactMax[axis] < 0.5, `${name} max ${'xyz'[axis]}`);
    }
  }
});

test('centres are finite and inside each layer, sizes are positive', () => {
  for (const [name, l] of Object.entries(geometry.layers)) {
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Number.isFinite(l.center[axis]), `${name} centre ${'xyz'[axis]} is finite`);
      assert.ok(l.center[axis] > l.exactMin[axis] && l.center[axis] < l.exactMax[axis], `${name} centre ${'xyz'[axis]} is inside the layer`);
      assert.ok(l.size[axis] > 0, `${name} size ${'xyz'[axis]} > 0`);
    }
  }
  // The bridge centre is not the origin (the old bug returned 0,0,0 for an "empty" box).
  assert.ok(Math.hypot(...geometry.layers.bridge.center) > 5, 'bridge centre is not (0,0,0)');
});

test('boxInOwnSpace stays valid under an arbitrarily rotated parent', () => {
  const r = geometry.rotated;
  assert.equal(r.empty, false);
  for (let axis = 0; axis < 3; axis++) assert.ok(r.min[axis] < r.max[axis]);
});
