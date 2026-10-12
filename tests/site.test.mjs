// The whole page as a visitor gets it: every file it asks for downloads from inside the site
// folder, every image shows, in-page links have a target, and nothing errors. Runs on the local
// copy (served from /H-H-lab/ like GitHub Pages) and, with SITE_URL set, on the real site after
// each deploy (.github/workflows/live.yml).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openPage, waitForState } from './helpers.mjs';

const SCENES = ['logo-intro', 'exploded-case', 'case-viewer'];
let server, browser;

before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); await server?.close(); });

// Scrolls from top to bottom so lazy images and every 3D scene load, as for a visitor.
async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((ok) => setTimeout(ok, 120));
    }
  });
}

for (const [label, options] of [['desktop', {}], ['phone', { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }]]) {
  test(`${label}: every file downloads from the site folder, every image shows, the 3D loads, no errors`, async () => {
    const page = await openPage(browser, `${server.url}/`, options);
    await scrollThrough(page);
    for (const id of SCENES) await waitForState(page, id, 'ready');
    // Images that are on screen (not hidden by the layout) and have finished loading.
    await page.waitForFunction(() => [...document.images].filter((img) => img.getClientRects().length).every((img) => img.complete), null, { timeout: 30000 });

    const site = new URL(server.url);
    const ours = page.requests.filter((u) => new URL(u).origin === site.origin);
    assert.deepEqual(ours.filter((u) => !u.startsWith(`${server.url}/`)), [], 'no file is asked for outside the site folder');
    // For each failure, also how often that file was asked for and how often it loaded.
    const count = (list, url) => list.filter((u) => u === url).length;
    const failed = page.failedRequests.filter((r) => new URL(r.url).origin === site.origin)
      .map((r) => ({ ...r, requested: count(page.requests, r.url), finished: count(page.finishedRequests, r.url) }));
    assert.deepEqual(failed, [], 'every file of the site downloads');
    const broken = await page.evaluate(() => [...document.images]
      .filter((img) => img.getClientRects().length && !img.naturalWidth)
      .map((img) => img.currentSrc || img.src));
    assert.deepEqual(broken, [], 'every visible image shows');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

test('every in-page link and icon points at something on the page', async () => {
  const page = await openPage(browser, `${server.url}/`);
  const missing = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"], use[href^="#"]')]
    .map((el) => el.getAttribute('href').slice(1))
    .filter((id) => id && !document.getElementById(id)));
  assert.deepEqual(missing, []);
  await page.context().close();
});
