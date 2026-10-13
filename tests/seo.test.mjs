// What link previews (WhatsApp, Facebook, LinkedIn) and search engines read from the page: the
// share card, the site's one official address, the lab's details for Google, and the icons.
// Preview bots read the HTML without running scripts, so the page is opened with JavaScript off.
// Runs on the local copy and, with SITE_URL set, on the real site after each deploy
// (.github/workflows/live.yml).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openPage } from './helpers.mjs';

let server, browser, pageInfo, decoder;

before(async () => {
  server = await startServer();
  browser = await launch();
  pageInfo = await readPage(await openPage(browser, `${server.url}/`, { javaScriptEnabled: false }));
  // A blank tab that decodes the downloaded images.
  decoder = await browser.newPage();
});
after(async () => { await browser?.close(); await server?.close(); });

// Everything the tests compare, read once: the share tags and canonical address as written, the
// icons as the browser would fetch them, the structured data, the contact links and the visible
// text of the page.
function readPage(tab) {
  return tab.evaluate(() => {
    const meta = {};
    for (const m of document.querySelectorAll('meta[property], meta[name]')) meta[m.getAttribute('property') || m.getAttribute('name')] = m.content;
    const links = (rel) => [...document.querySelectorAll('link')].filter((l) => l.relList.contains(rel))
      .map((l) => ({ href: l.href, sizes: l.getAttribute('sizes') }));
    const hrefs = (selector) => [...document.querySelectorAll(selector)].map((a) => a.getAttribute('href'));
    return {
      meta,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      icons: links('icon'),
      appleIcons: links('apple-touch-icon'),
      structuredData: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
      whatsapp: hrefs('a[href*="wa.me/"]').map((h) => new URL(h).pathname.slice(1)),
      emails: hrefs('a[href^="mailto:"]').map((h) => h.slice('mailto:'.length)),
      instagram: hrefs('a[href*="instagram.com/"]'),
      text: document.body.innerText.replace(/\s+/g, ' '),
    };
  }).finally(() => tab.context().close());
}

const unique = (list) => [...new Set(list)];

// Share tags and structured data must hold full addresses (apps that build a preview do not work
// them out from the page's address), so they point at the real site. Locally that site is not
// reachable, so the same path is fetched from the test server instead; in the live check the test
// server is the real site, so nothing changes.
function onSite(url, what) {
  assert.ok(pageInfo.canonical, 'the page names its canonical address');
  assert.match(url ?? '', /^https:\/\//, `${what} is a full https address`);
  assert.ok(url.startsWith(pageInfo.canonical), `${what} (${url}) is on this site (${pageInfo.canonical})`);
  return `${server.url}/${url.slice(pageInfo.canonical.length)}`;
}

async function download(url) {
  const res = await fetch(url);
  assert.equal(res.status, 200, `${url} downloads`);
  return { contentType: res.headers.get('content-type') ?? '', bytes: Buffer.from(await res.arrayBuffer()) };
}

// The first bytes of each file format, to tell a real JPEG or PNG from a file that only has the name.
const SIGNATURES = { jpeg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] };

// Downloads an image and has the browser decode it, which proves it shows and gives its size.
async function downloadImage(url) {
  const { contentType, bytes } = await download(url);
  const size = await decoder.evaluate((src) => {
    const img = new Image();
    img.src = src;
    return img.decode().then(() => ({ width: img.naturalWidth, height: img.naturalHeight }), () => null);
  }, `data:${contentType.split(';')[0]};base64,${bytes.toString('base64')}`);
  assert.ok(size, `${url} is an image the browser can show`);
  const format = Object.keys(SIGNATURES).find((f) => SIGNATURES[f].every((b, i) => bytes[i] === b)) ?? 'other';
  return { contentType, bytes, format, ...size };
}

test('a shared link shows a preview: title, description, address, site name and a 1200×630 JPEG image', async () => {
  const { meta } = pageInfo;
  for (const key of ['og:title', 'og:description', 'og:site_name', 'og:image:alt']) assert.ok(meta[key]?.trim(), `${key} is filled in`);
  assert.equal(meta['og:type'], 'website');
  assert.equal(meta['og:url'], pageInfo.canonical, 'og:url is the canonical address');
  assert.equal(meta['twitter:card'], 'summary_large_image', 'X / Twitter shows the large image');

  const image = await downloadImage(onSite(meta['og:image'], 'og:image'));
  assert.match(image.contentType, /^image\/jpeg/);
  assert.deepEqual([image.format, image.width, image.height], ['jpeg', 1200, 630], 'the share image is a JPEG of 1200×630');
  assert.ok(image.bytes.length < 300 * 1024, `the share image is under 300 KB (WhatsApp skips bigger ones), not ${Math.round(image.bytes.length / 1024)} KB`);
  assert.deepEqual([meta['og:image:type'], meta['og:image:width'], meta['og:image:height']], ['image/jpeg', String(image.width), String(image.height)],
    'og:image:type, og:image:width and og:image:height describe the real file');
});

test('canonical and og:url are the site address (in the live check: the address being checked)', () => {
  assert.match(pageInfo.canonical ?? '', /^https:\/\/[^?#\s]+\/$/, 'the canonical address is a full https address ending in /');
  assert.equal(pageInfo.meta['og:url'], pageInfo.canonical, 'og:url is the canonical address');
  // So that a move to another address (e.g. the lab's own domain) fails the live check until the
  // tags are updated.
  if (process.env.SITE_URL) assert.equal(pageInfo.canonical, new URL(process.env.SITE_URL).href.replace(/\/*$/, '/'), 'the tags name the address the site is at');
});

test('sitemap.xml lists the canonical address', async () => {
  const sitemap = await download(onSite(`${pageInfo.canonical}sitemap.xml`, 'the sitemap'));
  assert.match(sitemap.contentType, /xml/);
  const xml = sitemap.bytes.toString('utf8');
  assert.match(xml, /<urlset[^>]+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/, 'it is a sitemap');
  const listed = [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((m) => m[1]);
  assert.ok(listed.includes(pageInfo.canonical), `${pageInfo.canonical} is in ${JSON.stringify(listed)}`);
});

test('Google gets LocalBusiness data that matches the contact details on the page', async () => {
  assert.equal(pageInfo.structuredData.length, 1, 'the page has one block of structured data (JSON-LD)');
  const lab = JSON.parse(pageInfo.structuredData[0]);
  assert.equal(lab['@context'], 'https://schema.org');
  assert.equal(lab['@type'], 'LocalBusiness');
  assert.ok(lab.name && pageInfo.text.includes(lab.name), `the name "${lab.name}" is the lab's name on the page`);
  assert.equal(lab.url, pageInfo.canonical, 'url is the canonical address');

  assert.ok(lab.telephone && pageInfo.text.includes(lab.telephone), `the phone number "${lab.telephone}" is written as on the page`);
  assert.deepEqual(unique(pageInfo.whatsapp), [lab.telephone.replace(/\D/g, '')], 'the phone number is the WhatsApp number of the page links');
  assert.deepEqual(unique(pageInfo.emails), [lab.email], 'the email is the one the page links to');
  for (const link of unique(pageInfo.instagram)) assert.ok([].concat(lab.sameAs ?? []).includes(link), `sameAs lists the page's Instagram ${link}`);

  const address = lab.address ?? {};
  assert.equal(address['@type'], 'PostalAddress');
  assert.equal(address.addressCountry, 'MY');
  assert.ok(address.streetAddress && pageInfo.text.includes(address.streetAddress), `the street "${address.streetAddress}" is the address on the page`);
  assert.ok(address.postalCode && address.addressLocality && pageInfo.text.includes(`${address.postalCode} ${address.addressLocality}`),
    `"${address.postalCode} ${address.addressLocality}" is the postcode and town on the page`);

  for (const key of ['logo', 'image']) {
    const image = await downloadImage(onSite(lab[key], key));
    assert.match(image.contentType, /^image\//, `${key} is an image`);
    assert.ok(Math.min(image.width, image.height) >= 112, `${key} is at least 112×112 (Google's minimum for a logo)`);
  }
});

test('the browser tab icon is square and iPhones get a 180×180 home-screen icon', async () => {
  assert.ok(pageInfo.icons.length, 'the page names a tab icon');
  // Locally the icons are on the test server already; an icon written as a full address on the
  // real site is fetched from the test server, like the share image.
  const fetchable = (url) => (pageInfo.canonical && url.startsWith(pageInfo.canonical) ? onSite(url, 'the icon') : url);
  for (const icon of pageInfo.icons) {
    const image = await downloadImage(fetchable(icon.href));
    assert.ok(image.width > 0 && image.width === image.height, `${icon.href} is square, not ${image.width}×${image.height}`);
    if (icon.sizes) assert.equal(icon.sizes, `${image.width}x${image.height}`, `${icon.href} is the size its sizes attribute says`);
  }
  assert.equal(pageInfo.appleIcons.length, 1, 'the page names one iPhone home-screen icon (apple-touch-icon)');
  const apple = await downloadImage(fetchable(pageInfo.appleIcons[0].href));
  assert.deepEqual([apple.format, apple.width, apple.height], ['png', 180, 180], 'the iPhone icon is a PNG of 180×180');
});
