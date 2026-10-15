// Website analytics (analytics.js, Google Analytics 4): contact link clicks, the 3D viewer's pose
// buttons and how far down the page a visitor gets are recorded as events, and Google's script is
// only downloaded when index.html has a measurement ID. Runs on the local copy and, with SITE_URL
// set, on the real site. Nothing really reaches Google (openPage in helpers.mjs answers its
// addresses with empty replies) or the contact sites (answered here with a stand-in page).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openPage, waitForState, scrollScene } from './helpers.mjs';

const GA_ID = /^G-[A-Z0-9]+$/;
const TEST_ID = 'G-TEST12345';
const SCENES = ['logo-intro', 'exploded-case', 'case-viewer'];
const PHONE = { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true };
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

const gtagUrl = (id) => `https://www.googletagmanager.com/gtag/js?id=${id}`;

// Requests to Google other than the web fonts: what "downloading Google's program" would show.
const googleRequests = (page) => page.requests.filter((u) => {
  const host = new URL(u).hostname;
  return /(^|\.)(google|googleapis|gstatic|googletagmanager|google-analytics|doubleclick)\./.test(host)
    && !/^fonts\.(googleapis|gstatic)\.com$/.test(host);
});

// The contact sites answer with a stand-in page, so a clicked link opens its tab without leaving
// this machine (and without messaging the lab).
const CONTACT_SITES = /^https:\/\/(wa\.me|(www\.)?instagram\.com|www\.google\.com\/maps)\//;
const standInContactSites = (page) => page.context().route((url) => CONTACT_SITES.test(url.href),
  (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Stand-in</title>' }));

// Serves the home page with `id` in its <meta name="ga-id"> (works on the local copy and on the
// real site). Sets meta.found to whether the page had that tag to fill in.
function serveWithGaId(page, id, meta) {
  const tag = /<meta name="ga-id" content="[^"]*">/;
  return page.route((url) => url.href === `${server.url}/`, async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    meta.found = tag.test(html);
    await route.fulfill({ status: response.status(), contentType: 'text/html; charset=utf-8', body: html.replace(tag, `<meta name="ga-id" content="${id}">`) });
  });
}

// Which event a link should record, read from its address alone.
function contactEvent(href) {
  const url = new URL(href);
  if (url.protocol === 'mailto:') return 'email_click';
  if (url.hostname === 'wa.me') return 'whatsapp_click';
  if (/(^|\.)instagram\.com$/.test(url.hostname)) return 'instagram_click';
  if (/^(www\.)?google\.com$/.test(url.hostname) && url.pathname.startsWith('/maps')) return 'map_click';
  return null;
}

// Every contact link on the page, with its position among all links (to click it), what it
// should record and where it says it is (data-track).
async function contactLinks(page) {
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a, index) => ({
    index, href: a.href, newTab: a.target === '_blank', location: a.dataset.track,
    name: `${a.textContent.trim() || a.getAttribute('aria-label')} (link ${index + 1})`,
  })));
  return links.map((link) => ({ ...link, event: contactEvent(link.href) })).filter((link) => link.event);
}

// The gtag() events waiting in window.dataLayer, as [name, params]; only those whose name matches.
const events = (page, match = /./) => page.evaluate((source) => (window.dataLayer || [])
  .map((entry) => Array.from(entry))
  .filter(([command, name]) => command === 'event' && new RegExp(source).test(name))
  .map(([, name, params]) => [name, params]), match.source);

// Waits until the browser has drawn the page (and so checked what is on screen) twice.
const nextFrames = (page) => page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(ok, 30)))));

// A part of the page counts as seen (section_view) once it has stayed on screen for half a second.
// LOOK is a little longer than that.
const LOOK = 700;

// Stays where the page is long enough for what is on screen to count as seen: the browser draws
// it, LOOK passes, and it draws one more frame (where the page takes its last look before counting).
const lookAround = (page) => page.evaluate(async (look) => {
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(ok, 30))));
  await new Promise((ok) => setTimeout(ok, look));
  await new Promise((ok) => requestAnimationFrame(ok));
}, LOOK);

// Scrolls the whole page from the top to the bottom (or back up) most of a screen at a time,
// letting each position be drawn; with `look`, also staying at each one for that long (ms), like
// a visitor reading the page.
async function scrollPage(page, direction, look = 0) {
  await page.evaluate(async ([down, look]) => {
    const frames = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(ok, 30))));
    const bottom = () => document.documentElement.scrollHeight - innerHeight;
    const step = innerHeight * 0.8;
    for (let y = down ? 0 : bottom(); ; y = down ? Math.min(y + step, bottom()) : Math.max(y - step, 0)) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await frames();
      if (look) {
        await new Promise((ok) => setTimeout(ok, look));
        await new Promise((ok) => requestAnimationFrame(ok));
      }
      if (down ? y >= bottom() : y <= 0) break;
    }
  }, [direction === 'down', look]);
}

async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (!(await check()) && Date.now() < end) await new Promise((ok) => setTimeout(ok, 100));
}

// Clicks a link (with the given mouse button) and returns the address that opened: the new tab's
// for links that open one, the address handed to the mail program for an email link.
async function clickAndSeeWhatOpens(page, link, button = 'left') {
  const locator = page.locator('a[href]').nth(link.index);
  if (link.newTab || button === 'middle') {
    const [tab] = await Promise.all([page.context().waitForEvent('page'), locator.click({ button })]);
    await tab.waitForURL((url) => url.href !== 'about:blank');
    const opened = tab.url();
    await tab.close();
    return opened;
  }
  const asked = page.requests.length;
  await locator.click({ button });
  await until(() => page.requests.slice(asked).includes(link.href), 5000);
  return page.requests.slice(asked).find((u) => u === link.href) || null;
}

test('as published, Google Analytics is downloaded only when index.html has an ID, and then with that ID', async (t) => {
  const page = await open(t);
  const id = await page.evaluate(() => document.querySelector('meta[name="ga-id"]')?.getAttribute('content'));
  assert.equal(typeof id, 'string', 'index.html has a <meta name="ga-id" content="">');
  if (id.trim() === '') {
    await nextFrames(page);
    assert.deepEqual(googleRequests(page), [], 'no ID: nothing is asked of Google');
  } else {
    assert.match(id.trim(), GA_ID, 'the ID looks like G-XXXXXXX');
    await until(() => googleRequests(page).length);
    assert.deepEqual(googleRequests(page), [gtagUrl(id.trim())], 'Google Analytics is loaded with this ID');
  }
  assert.deepEqual(page.errors, []);
});

test('without an ID no Google Analytics code is downloaded, and the page and its links work as before', async (t) => {
  const meta = {};
  const page = await open(t, { route: (p) => Promise.all([serveWithGaId(p, '', meta), standInContactSites(p)]) });
  assert.ok(meta.found, 'index.html has a <meta name="ga-id"> for the ID');
  const whatsapp = (await contactLinks(page)).find((l) => l.event === 'whatsapp_click');
  assert.equal(await clickAndSeeWhatOpens(page, whatsapp), whatsapp.href, 'a WhatsApp link still opens');
  await page.click('[data-scene="case-viewer"] [data-pose="layers"]');
  await scrollPage(page, 'down');
  for (const id of SCENES) await waitForState(page, id, 'ready');
  assert.deepEqual(googleRequests(page), [], 'nothing is asked of Google');
  assert.equal(await page.evaluate(() => document.querySelectorAll('script[src*="googletagmanager"]').length), 0, 'no Google script on the page');
  assert.deepEqual(page.errors, []);
});

test('an ID that is not a Google Analytics 4 ID (G-...) is ignored: no Google Analytics code is downloaded', async (t) => {
  const meta = {};
  const page = await open(t, { route: (p) => serveWithGaId(p, 'UA-12345678-1', meta) });
  assert.ok(meta.found, 'index.html has a <meta name="ga-id"> for the ID');
  await nextFrames(page);
  assert.deepEqual(googleRequests(page), []);
  assert.deepEqual(page.errors, []);
});

test('with an ID in index.html, Google Analytics loads with that ID and gets every event', async (t) => {
  const meta = {};
  const page = await open(t, { route: (p) => Promise.all([serveWithGaId(p, TEST_ID, meta), standInContactSites(p)]) });
  assert.ok(meta.found, 'index.html has a <meta name="ga-id"> for the ID');
  const whatsapp = (await contactLinks(page)).find((l) => l.event === 'whatsapp_click');
  await clickAndSeeWhatOpens(page, whatsapp);
  await page.click('[data-scene="case-viewer"] [data-pose="layers"]');
  await scrollPage(page, 'down');
  // The contact details at the bottom count once they have been on screen for half a second.
  await until(async () => (await events(page, /^section_view$/)).length);

  await until(() => googleRequests(page).length);
  assert.deepEqual(googleRequests(page), [gtagUrl(TEST_ID)], 'Google Analytics is downloaded once, with this ID');
  assert.equal(await page.evaluate(() => document.querySelector('script[src*="googletagmanager"]')?.async), true, 'it loads without holding up the page');
  // gtag.js reads its commands from window.dataLayer, and only as `arguments` objects.
  const queue = await page.evaluate(() => (window.dataLayer || []).map((entry) => ({
    command: entry[0], value: entry[1] instanceof Date ? 'a date' : entry[1], isArguments: Object.prototype.toString.call(entry) === '[object Arguments]',
  })));
  assert.deepEqual(queue.slice(0, 2), [{ command: 'js', value: 'a date', isArguments: true }, { command: 'config', value: TEST_ID, isArguments: true }], 'set up with this ID first');
  const sent = queue.slice(2).filter((c) => c.command === 'event');
  for (const name of ['whatsapp_click', 'viewer_pose', 'section_view']) assert.ok(sent.some((c) => c.value === name), `${name} is sent`);
  assert.ok(queue.every((c) => c.isArguments), 'every command is in the form gtag.js reads');
  assert.deepEqual(page.errors, []);
});

test('clicking any WhatsApp, Instagram, email or map link records one event with where the link is, and the link still opens', async (t) => {
  const page = await open(t, { route: standInContactSites });
  const links = await contactLinks(page);
  assert.deepEqual([...new Set(links.map((l) => l.event))].sort(), ['email_click', 'instagram_click', 'map_click', 'whatsapp_click'], 'the page has every kind of contact link');

  const results = [];
  for (const link of links) {
    const before = (await events(page, /_click$/)).length;
    const opened = await clickAndSeeWhatOpens(page, link);
    results.push({ link: link.name, recorded: (await events(page, /_click$/)).slice(before), opened });
  }
  assert.deepEqual(results, links.map((l) => ({ link: l.name, recorded: [[l.event, { link_location: l.location }]], opened: l.href })));

  const missing = links.filter((l) => !l.location).map((l) => l.name);
  assert.deepEqual(missing, [], 'every contact link says where it is (data-track)');
  const places = links.map((l) => `${l.event} ${l.location}`);
  assert.deepEqual(places.filter((p, i) => places.indexOf(p) !== i), [], 'no two links of the same kind share a location');
  for (const place of ['header', 'hero', 'float']) assert.ok(places.includes(`whatsapp_click ${place}`), `a WhatsApp link in the ${place}`);
  assert.deepEqual(page.errors, []);
});

test('opening a contact link in a new tab with the middle button is recorded too, a right-click is not', async (t) => {
  const page = await open(t, { route: standInContactSites });
  const header = (await contactLinks(page)).find((l) => l.location === 'header' && l.event === 'whatsapp_click');
  assert.ok(header, 'the header has a WhatsApp link marked data-track="header"');
  assert.equal(await clickAndSeeWhatOpens(page, header, 'middle'), header.href, 'the link opens in a new tab');
  await page.locator('a[href]').nth(header.index).click({ button: 'right' });
  await nextFrames(page);
  assert.deepEqual(await events(page, /_click$/), [['whatsapp_click', { link_location: 'header' }]]);
});

test('pressing a "Take a closer look" pose button records viewer_pose with the pose name; the pose shown at load is not counted', async (t) => {
  const page = await open(t);
  await scrollScene(page, 'case-viewer');
  await waitForState(page, 'case-viewer', 'ready');
  assert.deepEqual(await events(page, /^viewer_pose$/), [], 'the pose chosen when the page opens is not counted');
  for (const pose of ['layers', 'intaglio', 'closeup', 'seated']) await page.click(`[data-scene="case-viewer"] [data-pose="${pose}"]`);
  await page.focus('[data-scene="case-viewer"] [data-pose="seated"]');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  assert.deepEqual(await events(page, /^viewer_pose$/), ['layers', 'intaglio', 'closeup', 'seated', 'layers'].map((pose) => ['viewer_pose', { pose }]));
  assert.deepEqual(page.errors, []);
});

for (const [label, options] of [['desktop', {}], ['phone', PHONE]]) {
  test(`${label}: scrolling down the page records one section_view each for the hero, the end of the 3D exploded view, the viewer and the contact details, also after scrolling back`, async (t) => {
    const page = await open(t, options);
    const views = async () => (await events(page, /^section_view$/)).map(([, params]) => params);
    await lookAround(page);
    assert.deepEqual(await views(), [], 'nothing is counted at the top, where only the logo intro shows');
    await scrollScene(page, 'exploded-case', 0.9);
    await lookAround(page);
    assert.deepEqual(await views(), [], 'the 3D exploded view is not finished part-way through');
    await scrollScene(page, 'exploded-case', 1);
    await lookAround(page);
    assert.deepEqual(await views(), [{ section: 'case3d_end' }], 'the end of the 3D exploded view is counted');

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await scrollPage(page, 'down', LOOK);
    await scrollPage(page, 'up', LOOK);
    assert.deepEqual(await views(), ['case3d_end', 'hero', 'viewer', 'contact'].map((section) => ({ section })), 'each part once, however often it is passed');
    assert.deepEqual(page.errors, []);
  });
}

test('desktop: parts of the page that only fly past are not counted: the header menu\'s smooth jump to Contact records only the contact details, and the end of the 3D on screen for a moment records nothing', async (t) => {
  const page = await open(t);
  const views = async () => (await events(page, /^section_view$/)).map(([, params]) => params);
  await nextFrames(page);

  // Like a visitor at the top: the menu link, with the site's smooth scrolling, passes the hero,
  // the 3D exploded view and the viewer on its way down.
  await page.click('header nav a[href="#contact"]');
  await until(async () => (await views()).length);
  await lookAround(page);
  assert.deepEqual(await views(), [{ section: 'contact' }], 'only where the jump stops is counted');

  // The end of the 3D comes into view and, as soon as the browser has seen it there, the page
  // moves on to the bottom: on screen for a moment, not half a second.
  await page.evaluate(() => {
    const end = document.querySelector('[data-track-view="case3d_end"]');
    const watch = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      watch.disconnect();
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      window.flewPast = true;
    });
    watch.observe(end);
  });
  await scrollScene(page, 'exploded-case', 1);
  await page.waitForFunction(() => window.flewPast === true);
  await lookAround(page);
  assert.deepEqual(await views(), [{ section: 'contact' }], 'the end of the 3D, seen for a moment, is not counted');
  assert.deepEqual(page.errors, []);
});
