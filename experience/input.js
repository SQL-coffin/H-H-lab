// Experience layer: turns scroll, mouse and touch into experience state.
// Scenes are tall sections; a scene's target progress is how far the page has scrolled through it
// (0 when its top reaches the top of the window, 1 when its bottom reaches the bottom).
import { addScene } from './state.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// onChange is called whenever something may need a new frame (scroll, resize, a scene coming into view).
export function createInput(state, onChange) {
  const tracked = [];

  function measure() {
    const vh = window.innerHeight;
    state.viewport.width = window.innerWidth;
    state.viewport.height = vh;
    const doc = document.documentElement;
    state.page.progress = clamp01(window.scrollY / Math.max(1, doc.scrollHeight - vh));

    let current = null;
    let cover = 0;
    for (const { id, el } of tracked) {
      const r = el.getBoundingClientRect();
      state.scenes[id].target = clamp01(-r.top / Math.max(1, r.height - vh));
      const c = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (c > cover) { cover = c; current = id; }
    }
    state.current = current;
    onChange();
  }

  window.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', measure);

  return {
    measure,

    // el: the scene's section (scroll track); stage: the element that reacts to the mouse.
    track(id, el, stage) {
      const scene = addScene(state, id);
      tracked.push({ id, el });

      new IntersectionObserver(([entry]) => {
        scene.visible = entry.isIntersecting;
        measure();
      }).observe(el);

      // A slight lean toward the mouse on desktop; touch does not lean.
      stage.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = stage.getBoundingClientRect();
        state.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        state.pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
        state.pointer.over = id;
      });
      stage.addEventListener('pointerleave', () => {
        state.pointer.x = 0;
        state.pointer.y = 0;
        state.pointer.over = null;
      });

      measure();
      return scene;
    },
  };
}
