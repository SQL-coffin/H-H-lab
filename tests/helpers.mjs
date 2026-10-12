// Shared test helpers: a tiny static server for the repo and a headless Chromium with software
// WebGL (works on CI machines without a GPU).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
};

// Locally the site is served from a sub-folder, as GitHub Pages serves it
// (sql-coffin.github.io/H-H-lab/), so a path that only works from the domain root fails here too.
const BASE = '/H-H-lab';

// Serves the repository under BASE on a free port. With SITE_URL set (the live check after a
// deploy, see .github/workflows/live.yml), the tests use that address instead.
// Returns { url, close }; url has no trailing slash.
export async function startServer() {
  if (process.env.SITE_URL) return { url: new URL(process.env.SITE_URL).href.replace(/\/+$/, ''), close: async () => {} };
  const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    if (!pathname.startsWith(BASE + '/')) return res.writeHead(404).end('not found');
    const path = normalize(decodeURIComponent(pathname.slice(BASE.length))).replace(/^(\.\.[/\\])+/, '');
    const file = join(ROOT, path.endsWith('/') ? path + 'index.html' : path);
    try {
      const body = await readFile(file);
      // no-cache, not no-store: Chromium can report a no-store fetch that is read as a stream
      // (as three.js loads models) as net::ERR_ABORTED although every byte arrived
      // (microsoft/playwright#42742). GitHub Pages does not send no-store either.
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}${BASE}`, close: () => new Promise((r) => server.close(r)) };
}

export const WEBGL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export const NO_WEBGL = ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl', '--disable-3d-apis'];

export function launch(args = WEBGL) {
  return chromium.launch({ args });
}

// Opens a page and records page errors and console errors (GPU driver chatter is ignored), every
// request it makes, the ones that finished, and the ones that failed or got an error status.
export async function openPage(browser, url, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
  const page = await context.newPage();
  page.errors = [];
  page.requests = [];
  page.finishedRequests = [];
  page.failedRequests = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|GPU stall/.test(m.text())) page.errors.push(m.text()); });
  const started = Date.now();
  page.on('request', (r) => page.requests.push(r.url()));
  page.on('requestfinished', (r) => page.finishedRequests.push(r.url()));
  page.on('requestfailed', (r) => page.failedRequests.push({ url: r.url(), why: r.failure()?.errorText, type: r.resourceType(), at: Date.now() - started }));
  page.on('response', (r) => { if (r.status() >= 400) page.failedRequests.push({ url: r.url(), why: `HTTP ${r.status()}`, type: r.request().resourceType(), at: Date.now() - started }); });
  // Tests read the canvas back, which WebGL only allows when the drawing buffer is kept.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      if (/webgl/.test(type)) attrs = { ...attrs, preserveDrawingBuffer: true };
      return getContext.call(this, type, attrs);
    };
  });
  if (options.route) await options.route(page);
  await page.goto(url);
  return page;
}

export const sceneState = (page, id) => page.evaluate((s) => document.querySelector(`[data-scene="${s}"]`).dataset.state, id);

export async function waitForState(page, id, state, timeout = 120000) {
  await page.waitForFunction(([s, want]) => document.querySelector(`[data-scene="${s}"]`)?.dataset.state === want, [id, state], { timeout });
}

// Scrolls (instantly, not with the site's smooth scrolling) so that `fraction` (0..1) of the
// scene's scroll track has been passed. Fraction 0 puts the section's top at the top of the window.
export async function scrollScene(page, id, fraction = 0) {
  await page.evaluate(([s, f]) => {
    const el = document.querySelector(`[data-scene="${s}"]`);
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + Math.max(0, el.offsetHeight - window.innerHeight) * f, behavior: 'instant' });
  }, [id, fraction]);
}

// How many pixels of the scene's canvas are clearly lit (not background). Software WebGL is slow,
// so this polls until the picture has settled.
export async function litPixels(page, id) {
  return page.evaluate(async (s) => {
    const canvas = document.querySelector(`[data-scene="${s}"] [data-3d-canvas] canvas`);
    if (!canvas) return 0;
    const copy = document.createElement('canvas');
    copy.width = 160; copy.height = Math.round(160 * canvas.height / canvas.width) || 1;
    const ctx = copy.getContext('2d');
    ctx.drawImage(canvas, 0, 0, copy.width, copy.height);
    const d = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] > 180) n++;
    return n;
  }, id);
}

// A small fingerprint of the canvas picture, to tell whether two views differ.
export async function canvasFingerprint(page, id) {
  return page.evaluate((s) => {
    const canvas = document.querySelector(`[data-scene="${s}"] [data-3d-canvas] canvas`);
    const copy = document.createElement('canvas');
    copy.width = 32; copy.height = 20;
    const ctx = copy.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 32, 20);
    return Array.from(ctx.getImageData(0, 0, 32, 20).data.filter((_, i) => i % 4 !== 3));
  }, id);
}

export const difference = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;

export const settle = (page, ms = 4000) => page.waitForTimeout(ms);
