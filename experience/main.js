// Entry point of the immersive experience.
//
//   input.js        scroll / mouse / touch  ->  state.js (progress, current scene, pointer)
//   state.js        read every frame by the engine, the scenes and the content layer
//   engine/stage.js one WebGL renderer + canvas, model loading, the frame loop
//   scenes/*.js     one file per 3D scene: builds its Three.js scene and moves it with progress
//   ui/bind.js      writes progress into the scene's HTML (CSS variables, classes, label positions)
//
// A scene is declared in index.html as <section data-scene="id"> with a [data-3d-stage] inside
// (the sticky frame that reacts to the mouse) and a [data-3d-canvas] slot for the canvas.
// Its lifecycle is shown on the section as data-state="loading" | "ready" | "fallback".
import { createState } from './state.js';
import { createInput } from './input.js';
import { createEngine } from './engine/stage.js';
import { bindScene } from './ui/bind.js';
import explodedCase from './scenes/exploded-case.js';

const SCENES = [explodedCase];

const sections = [...document.querySelectorAll('[data-scene]')];

if (sections.length) {
  const state = createState();
  const engine = createEngine(state);
  const input = createInput(state, () => engine && engine.wake());

  for (const el of sections) {
    const def = SCENES.find((s) => s.id === el.dataset.scene);
    if (!def) continue;
    const fallback = () => { el.dataset.state = 'fallback'; };
    if (!engine) { fallback(); continue; }

    const slot = el.querySelector('[data-3d-canvas]');
    el.dataset.state = 'loading';
    engine.prepare(slot);
    input.track(def.id, el, el.querySelector('[data-3d-stage]') || el);

    def.setup({ engine, el, state }).then((instance) => {
      const loading = el.querySelector('[data-3d-loading]');
      if (loading) loading.hidden = true;
      engine.add({ id: def.id, el, slot, instance, ui: bindScene(el) });
      el.dataset.state = 'ready';
      input.measure();
    }).catch((err) => {
      console.error(`3D scene "${def.id}" failed to load`, err);
      fallback();
    });
  }
}
