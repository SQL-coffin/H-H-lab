// Experience state: the single source of truth. The input layer writes it, the frame loop eases
// it, and scenes read it (each scene uses what it needs). Plain data, no framework.
//
//   viewport        current window size
//   page.progress   scroll position over the whole page, 0..1
//   pointer         mouse position over a scene stage, -1..1 (0 when the mouse is elsewhere),
//                   which scene's stage it is over, and a smoothed copy for gentle motion
//   scenes[id]      per scene: target (where the scroll is), progress (eased toward target),
//                   visible (on screen at all)
//   current         id of the scene that fills most of the viewport, or null
//   reducedMotion   the visitor asked the system for less motion: progress follows the scroll
//                   without gliding and the pointer lean is off

export function createState() {
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    page: { progress: 0 },
    pointer: { x: 0, y: 0, smoothX: 0, smoothY: 0, over: null },
    scenes: {},
    current: null,
    reducedMotion: motionQuery.matches,
  };
  motionQuery.addEventListener('change', () => { state.reducedMotion = motionQuery.matches; });
  return state;
}

export function addScene(state, id) {
  state.scenes[id] = { id, target: 0, progress: 0, visible: false };
  return state.scenes[id];
}

// Once per animation frame. Eases by elapsed time, not per frame, so the experience keeps up
// with the scroll at any frame rate (slow phones included).
const PROGRESS_RATE = 7;
const POINTER_RATE = 5;

export function advance(state, dt) {
  if (state.reducedMotion) {
    for (const s of Object.values(state.scenes)) s.progress = s.target;
    state.pointer.smoothX = 0;
    state.pointer.smoothY = 0;
    return;
  }
  const kp = 1 - Math.exp(-dt * PROGRESS_RATE);
  for (const s of Object.values(state.scenes)) {
    s.progress += (s.target - s.progress) * kp;
    if (Math.abs(s.target - s.progress) < 0.0005) s.progress = s.target;
  }
  const km = 1 - Math.exp(-dt * POINTER_RATE);
  state.pointer.smoothX += (state.pointer.x - state.pointer.smoothX) * km;
  state.pointer.smoothY += (state.pointer.y - state.pointer.smoothY) * km;
}
