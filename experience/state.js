// Experience state: the single source of truth. The input layer writes it, the frame loop eases
// it, and scenes read it (each scene uses what it needs). Plain data, no framework.
//
//   viewport        current window size
//   page.progress   scroll position over the whole page, 0..1
//   pointer         mouse position over a scene stage, -1..1 (0 when the mouse is elsewhere),
//                   which scene's stage it is over, and a smoothed copy for gentle motion
//   scenes[id]      per scene: target (where the scroll is), progress (eased toward target),
//                   visible (on screen at all), pose (the pose picked with the scene's pose
//                   buttons, or null) and drag (how far the visitor has turned it by dragging)
//   dt              seconds since the previous frame, for scenes that ease things themselves
//                   (0 for a frame drawn while the loop is stopped, e.g. after a resize)
//   current         id of the scene that fills most of the viewport, or null
//   reducedMotion   the visitor asked the system for less motion: progress follows the scroll
//                   without gliding and the pointer lean is off

// The system setting for less motion, as a media query (input.js also listens to it).
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export function createState() {
  const motionQuery = window.matchMedia(REDUCED_MOTION);
  const state = {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    page: { progress: 0 },
    pointer: { x: 0, y: 0, smoothX: 0, smoothY: 0, over: null },
    scenes: {},
    current: null,
    reducedMotion: motionQuery.matches,
    dt: 0,
  };
  motionQuery.addEventListener('change', () => { state.reducedMotion = motionQuery.matches; });
  return state;
}

export function addScene(state, id) {
  state.scenes[id] = { id, target: 0, progress: 0, visible: false, pose: null, drag: { x: 0, y: 0 } };
  return state.scenes[id];
}

// Once per animation frame. Eases by elapsed time, not per frame, so the experience keeps up
// with the scroll at any frame rate (slow phones included). A value that is close enough snaps
// onto its goal, so the easing really ends and the frame loop can stop (see isSettled).
const PROGRESS_RATE = 7;
const POINTER_RATE = 5;
const SNAP = 0.0005;

// Moves value toward goal by the share k (0..1) and lands exactly on goal once it is close.
// Scenes that ease things themselves use it too, so their easing also ends.
export function ease(value, goal, k) {
  const next = value + (goal - value) * k;
  return Math.abs(goal - next) < SNAP ? goal : next;
}

export function advance(state, dt) {
  state.dt = dt;
  if (state.reducedMotion) {
    for (const s of Object.values(state.scenes)) s.progress = s.target;
    state.pointer.smoothX = 0;
    state.pointer.smoothY = 0;
    return;
  }
  const kp = 1 - Math.exp(-dt * PROGRESS_RATE);
  for (const s of Object.values(state.scenes)) s.progress = ease(s.progress, s.target, kp);
  const km = 1 - Math.exp(-dt * POINTER_RATE);
  state.pointer.smoothX = ease(state.pointer.smoothX, state.pointer.x, km);
  state.pointer.smoothY = ease(state.pointer.smoothY, state.pointer.y, km);
}

// True when nothing is easing any more: every scene's progress has reached its target and the
// smoothed pointer has caught up with the mouse (with reduced motion there is no lean to catch up).
// The frame loop stops drawing then, until something changes.
export function isSettled(state) {
  const { pointer } = state;
  return Object.values(state.scenes).every((s) => s.progress === s.target)
    && (state.reducedMotion || (pointer.smoothX === pointer.x && pointer.smoothY === pointer.y));
}
