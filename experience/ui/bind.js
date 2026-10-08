// Content layer: applies a scene's progress and output to its HTML section, once per frame.
// HTML declares what shows when; this file only toggles classes and writes CSS variables.
//
//   section            gets --p (progress 0..1) plus any vars the scene returns (e.g. --wipe)
//                      and any classes it returns (e.g. is-light)
//   [data-from][data-to]  gets .is-on while from <= progress < to
//   [data-anchor="x"]     is placed just right of the screen point the scene reports for anchor x,
//                         at least a minimum gap below the label above it, and gets .is-on when
//                         the scene shows its anchors
export function bindScene(section) {
  const timed = [...section.querySelectorAll('[data-from][data-to]')];
  const anchored = [...section.querySelectorAll('[data-anchor]')];

  function placeAnchors(points, show, size) {
    const placed = anchored
      .filter((el) => points[el.dataset.anchor])
      .map((el) => ({ el, ...points[el.dataset.anchor] }));
    placed.sort((a, b) => a.y - b.y);
    const minGap = size.width < 760 ? 46 : 40;
    for (let i = 1; i < placed.length; i++) placed[i].y = Math.max(placed[i].y, placed[i - 1].y + minGap);
    for (const { el, x, y } of placed) {
      const left = Math.min(x + 8, size.width - el.offsetWidth - 8);
      el.style.transform = `translate(${left}px, ${y}px) translateY(-50%)`;
      el.classList.toggle('is-on', !!show);
    }
  }

  return {
    apply(progress, out = {}, size) {
      section.style.setProperty('--p', progress.toFixed(4));
      for (const [name, value] of Object.entries(out.vars || {})) section.style.setProperty(`--${name}`, value);
      for (const [name, on] of Object.entries(out.classes || {})) section.classList.toggle(name, !!on);
      for (const el of timed) el.classList.toggle('is-on', progress >= +el.dataset.from && progress < +el.dataset.to);
      if (out.anchors) placeAnchors(out.anchors, out.showAnchors, size);
    },
  };
}

// Pose buttons: [data-pose="name"] buttons in a section pick the pose of its scene; the matching
// [data-pose-caption="name"] gets .is-on. Works before the 3D has loaded, so the captions read
// correctly from the start. onSelect(name) is called with the chosen pose.
export function bindPoseControls(section, onSelect) {
  const buttons = [...section.querySelectorAll('[data-pose]')];
  const captions = [...section.querySelectorAll('[data-pose-caption]')];
  if (!buttons.length) return;

  function select(name) {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.pose === name));
    for (const c of captions) c.classList.toggle('is-on', c.dataset.poseCaption === name);
    onSelect(name);
  }
  for (const b of buttons) b.addEventListener('click', () => select(b.dataset.pose));
  const initial = buttons.find((b) => b.getAttribute('aria-pressed') === 'true') || buttons[0];
  select(initial.dataset.pose);
}
