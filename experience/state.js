// Experience state: the single source of truth that the input layer writes and the 3D scenes
// and the content layer read. Plain data, no framework.
//
//   viewport        current window size
//   page.progress   scroll position over the whole page, 0..1
//   pointer         mouse position over a scene stage, -1..1 (0 when the mouse is elsewhere),
//                   plus a smoothed copy for gentle motion
//   scenes[id]      per scene: target (where the scroll is), progress (eased toward target),
//                   visible (on screen at all)
//   current         id of the scene that fills most of the viewport, or null
//   reducedMotion   the visitor asked the system for less motion

export function createState() {
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    page: { progress: 0 },
    pointer: { x: 0, y: 0, smoothX: 0, smoothY: 0, over: null },
    scenes: {},
    current: null,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
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
  const kp = 1 - Math.exp(-dt * PROGRESS_RATE);
  for (const s of Object.values(state.scenes)) {
    s.progress += (s.target - s.progress) * kp;
    if (Math.abs(s.target - s.progress) < 0.0005) s.progress = s.target;
  }
  const km = 1 - Math.exp(-dt * POINTER_RATE);
  state.pointer.smoothX += (state.pointer.x - state.pointer.smoothX) * km;
  state.pointer.smoothY += (state.pointer.y - state.pointer.smoothY) * km;
}
