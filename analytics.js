// Website analytics (Google Analytics 4): which contact links visitors click, which views they
// pick in the 3D viewer, and how far down the page they get.
//
// index.html holds the measurement ID: <meta name="ga-id" content="G-XXXXXXX">. While it is empty,
// no Google Analytics code is downloaded and no analytics data is sent; the events below only wait
// in memory (window.dataLayer) until the visitor leaves.
//
//   whatsapp_click, instagram_click, email_click, map_click
//                   a contact link was clicked (or opened in a new tab with the middle button);
//                   link_location = where it is, from the link's data-track (header, hero, float...)
//   viewer_pose     a "Take a closer look" pose button was pressed; pose = its data-pose name.
//                   The pose shown when the page opens is chosen by the code, not a press, so it
//                   is not counted.
//   section_view    a part of the page marked data-track-view="name" stayed in view for half a
//                   second (at least half of it, or half the screen when it is taller); section =
//                   name. Once per visit each. Parts that only fly past, as the header menu's smooth
//                   jump to Contact passes the 3D, are not counted.
//
// With an ID it also shows the footer's note that the site uses Google Analytics cookies (Google's
// terms ask for it).
//
// Nothing here stops a click or a link, and errors are caught, so analytics can never break the
// page: with Google blocked (ad blockers) or unreachable, everything else works the same.

const ID_FORMAT = /^G-[A-Z0-9]+$/;

// The standard gtag() queue: Google's script, once loaded, reads the commands from dataLayer,
// including the ones queued before it arrived. It only reads them as `arguments` objects.
window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}
window.gtag = gtag;

const id = (document.querySelector('meta[name="ga-id"]')?.getAttribute('content') || '').trim();
const on = ID_FORMAT.test(id);
if (on) {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.append(script);
  gtag('js', new Date());
  gtag('config', id);
} else if (id) {
  console.warn(`Google Analytics is off: the ga-id "${id}" in index.html should look like G-XXXXXXX`);
}

// Which event a link records, from its address; null for every other link.
function contactEvent(link) {
  let url;
  try {
    url = new URL(link.href);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (url.protocol === 'mailto:') return 'email_click';
  if (/(^|\.)(wa\.me|whatsapp\.com)$/.test(host)) return 'whatsapp_click';
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram_click';
  if ((/^(www\.)?google\.com$/.test(host) && url.pathname.startsWith('/maps')) || /^maps\.(google\.com|app\.goo\.gl)$/.test(host)) return 'map_click';
  return null;
}

// One listener for the whole page (in the capture phase, so it hears every click first, and only
// listens). A middle click opens a link in a new tab and arrives as auxclick; a right click only
// opens the browser's menu, so it is not counted.
function onClick(event) {
  try {
    if (event.type === 'auxclick' && event.button !== 1) return;
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]');
    const name = link && contactEvent(link);
    if (name) {
      gtag('event', name, { link_location: link.dataset.track || 'other' });
      return;
    }
    const pose = event.type === 'click' && event.target.closest('[data-pose]');
    if (pose) gtag('event', 'viewer_pose', { pose: pose.dataset.pose });
  } catch (err) {
    console.warn('Analytics could not record a click', err);
  }
}
document.addEventListener('click', onClick, true);
document.addEventListener('auxclick', onClick, true);

// Many visibility steps (every 1%), so that a part much taller than the screen is still checked
// often enough while it scrolls by.
const STEPS = Array.from({ length: 101 }, (_, i) => i / 100);

// How long a part must stay in view to count as seen. A smooth jump from the header menu to
// Contact passes the 3D and the viewer in a fraction of a second, without the visitor seeing them.
const LOOK_MS = 500;

// Enough of a part is in view when at least half of it shows, or half the screen when it is taller.
const enoughInView = (shown, height, screen) => shown >= Math.min(height, screen) / 2;

function watchSections() {
  const parts = document.querySelectorAll('[data-track-view]');
  if (!parts.length || !('IntersectionObserver' in window)) return;
  const seen = new Set();
  const timers = new Map(); // part -> its half-second timer, while it is in view and not yet counted

  const record = (part) => {
    observer.unobserve(part);
    const name = part.dataset.trackView;
    if (seen.has(name)) return;
    seen.add(name);
    gtag('event', 'section_view', { section: name });
  };

  // When the half second is up, look once more at the next frame, where the scroll position is
  // the latest: while the 3D loads, the page can be too busy to run this timer on time, and by
  // then a part that was only passing by has long gone.
  const lookAgain = (part) => {
    timers.delete(part);
    requestAnimationFrame(() => {
      const box = part.getBoundingClientRect();
      const screen = window.innerHeight;
      if (enoughInView(Math.min(box.bottom, screen) - Math.max(box.top, 0), box.height, screen)) record(part);
    });
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const part = entry.target;
      const screen = entry.rootBounds ? entry.rootBounds.height : window.innerHeight;
      const inView = entry.isIntersecting && enoughInView(entry.intersectionRect.height, entry.boundingClientRect.height, screen);
      if (inView && !timers.has(part)) timers.set(part, setTimeout(() => lookAgain(part), LOOK_MS));
      if (!inView && timers.has(part)) {
        clearTimeout(timers.get(part));
        timers.delete(part);
      }
    }
  }, { threshold: STEPS });
  parts.forEach((el) => observer.observe(el));
}

// Google's terms ask sites that use Google Analytics to say so: the footer's note (hidden in
// index.html) shows only while it is on.
function showNotice() {
  const note = document.querySelector('[data-analytics-notice]');
  if (note) note.hidden = false;
}

function start() {
  watchSections();
  if (on) showNotice();
}

// The script loads with async (so a slow 3D download never delays it), which can be before the
// rest of the page has been read.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
