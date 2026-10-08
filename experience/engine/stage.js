// Visual engine: one WebGL renderer and one canvas for the whole page.
// The canvas is mounted inside the stage of the 3D scene that is on screen (into its
// [data-3d-canvas] slot), so page content can sit both behind it (backgrounds, panels) and in
// front of it (captions, labels). Frames are only drawn while a scene is visible.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from '../vendor/jsm/environments/RoomEnvironment.js';
import { advance } from '../state.js';

// Returns null when the browser cannot do WebGL; the caller then shows the fallback content.
export function createEngine(state) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');

  // Shared studio lighting environment for reflections.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Models load once per URL (relative to the page), meshopt-compressed GLB.
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = new Map();
  function load(path) {
    const url = new URL(path, document.baseURI).href;
    if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
    return cache.get(url);
  }

  const entries = []; // { id, el, slot, instance, ui }
  let mounted = null; // the slot the canvas is in
  const size = { width: 1, height: 1 };

  const resizeObserver = new ResizeObserver(() => resize());

  function mountInto(slot) {
    if (mounted === slot) return;
    if (mounted) resizeObserver.unobserve(mounted);
    slot.appendChild(canvas);
    mounted = slot;
    resizeObserver.observe(slot);
    resize();
  }

  function resize() {
    if (!mounted) return;
    size.width = Math.max(1, mounted.clientWidth);
    size.height = Math.max(1, mounted.clientHeight);
    renderer.setSize(size.width, size.height, false);
    for (const e of entries) if (e.slot === mounted) e.instance.resize(size.width, size.height);
  }

  // The scene to draw: the one filling most of the window if it is ready, else any visible one.
  function active() {
    const visible = entries.filter((e) => state.scenes[e.id].visible);
    return visible.find((e) => e.id === state.current) || visible[0] || null;
  }

  let running = false;
  let last = 0;
  function tick(now) {
    const entry = active();
    if (!entry) { running = false; return; }
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    advance(state, dt);
    mountInto(entry.slot);
    const scene = state.scenes[entry.id];
    const out = entry.instance.update(scene.progress, state, size);
    entry.ui.apply(scene.progress, out, size);
    renderer.toneMappingExposure = entry.instance.exposure ?? 1;
    renderer.render(entry.instance.scene, entry.instance.camera);
    requestAnimationFrame(tick);
  }

  return {
    environment,
    load,

    // Put the (still empty) canvas into a stage early, so it can fade in once the scene is ready.
    prepare(slot) {
      if (!mounted) mountInto(slot);
    },

    // instance: { scene, camera, exposure?, resize(w, h), update(progress, state, size) -> output }
    add(entry) {
      entries.push(entry);
      if (entry.slot === mounted) entry.instance.resize(size.width, size.height);
      this.wake();
    },

    // Start drawing if a scene is visible; safe to call often.
    wake() {
      if (running || !active()) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    },
  };
}
