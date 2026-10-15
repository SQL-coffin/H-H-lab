// Accessibility: once the whole page has loaded, the axe checker (axe-core, the engine behind
// many accessibility tools) finds no problems on desktop or phone; and the floating WhatsApp
// button keeps its look and its place, fixed in the bottom-right corner.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startServer, launch, openPage, waitForState } from './helpers.mjs';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const SCENES = ['logo-intro', 'exploded-case', 'case-viewer'];
const DEVICES = [['desktop', {}], ['phone', { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }]];
let server, browser;

before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); await server?.close(); });

// Opens the site for one test and closes it when the test ends, also when it fails, so a failed
// test does not leave a 3D page running that slows down the next ones.
async function open(t, options) {
  const page = await openPage(browser, `${server.url}/`, options);
  t.after(() => page.context().close());
  return page;
}

// Scrolls from top to bottom so lazy images and every 3D scene load, as for a visitor.
async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((ok) => setTimeout(ok, 120));
    }
  });
}

for (const [label, options] of DEVICES) {
  test(`${label}: axe finds no accessibility problems once the page has loaded`, async (t) => {
    const page = await open(t, options);
    await scrollThrough(page);
    for (const id of SCENES) await waitForState(page, id, 'ready');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.addScriptTag({ path: AXE });
    // One line per problem: the rule, what it means, and the elements that break it.
    const problems = await page.evaluate(async () => (await window.axe.run(document)).violations
      .map((v) => `${v.id} (${v.help}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
    assert.deepEqual(problems, []);
  });
}

// How the button looked before it moved for the axe check (measured on the site before the change).
const FLOAT = {
  label: 'Chat on WhatsApp', width: 56, height: 56, right: 20, bottom: 20, position: 'fixed',
  background: 'rgb(37, 211, 102)', color: 'rgb(255, 255, 255)', radius: '50%', shadow: 'rgba(0, 0, 0, 0.5) 0px 6px 18px 0px',
  icon: { width: 28, height: 28, offsetX: 0, offsetY: 0 }, onTop: true,
};

for (const [label, options] of DEVICES) {
  test(`${label}: the floating WhatsApp button looks the same and stays fixed in the bottom-right corner`, async (t) => {
    const page = await open(t, options);
    for (const at of [0, 0.5, 1]) {
      const float = await page.evaluate(async (fraction) => {
        window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * fraction, behavior: 'instant' });
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
        const links = document.querySelectorAll('a.wa-float');
        const a = links[0];
        const r = a.getBoundingClientRect();
        const icon = a.querySelector('svg').getBoundingClientRect();
        const s = getComputedStyle(a);
        return {
          count: links.length, label: a.getAttribute('aria-label'),
          width: r.width, height: r.height, right: document.documentElement.clientWidth - r.right, bottom: innerHeight - r.bottom, position: s.position,
          background: s.backgroundColor, color: s.color, radius: s.borderRadius, shadow: s.boxShadow,
          icon: { width: icon.width, height: icon.height, offsetX: icon.x + icon.width / 2 - (r.x + r.width / 2), offsetY: icon.y + icon.height / 2 - (r.y + r.height / 2) },
          // Nothing covers it.
          onTop: a.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
        };
      }, at);
      assert.deepEqual(float, { count: 1, ...FLOAT }, `scrolled ${at * 100}% down the page`);
    }
  });
}
