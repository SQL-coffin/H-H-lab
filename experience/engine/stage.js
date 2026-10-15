// Visual engine: one WebGL renderer and one canvas for the whole page.
// The canvas is mounted inside the stage of the 3D scene that is on screen (into its
// [data-3d-canvas] slot), so page content can sit both behind it (backgrounds, panels) and in
// front of it (captions, labels). Frames are only drawn while a scene is visible and something
// moves: once the scroll, the mouse lean and the scene's own motion have settled, the loop stops
// and the canvas keeps showing the last frame; wake() starts it again.
// Only one scene is drawn at a time, so scene sections should be separated by at least one
// screen of other content.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from '../vendor/jsm/environments/RoomEnvironment.js';
import { advance, isSettled } from '../state.js';

const MAX_PIXEL_RATIO = 2;

// Returns null when the browser cannot do WebGL; the caller then shows the fallback content.
export function createEngine(state) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  // The slot decides the size; the canvas always fills it.
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  // Shared studio lighting environment for reflections. It lives on the GPU, so it is rebuilt
  // if the browser drops and restores the WebGL context (phones do this under memory pressure).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const makeEnvironment = () => pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  let environment = makeEnvironment();
  // Environments from a lost context; a scene still holding one (including a scene that was
  // loading during the loss and is added later) is switched to the current one.
  const stale = new WeakSet();
  const refreshEnvironment = (entry) => {
    if (stale.has(entry.instance.scene.environment)) entry.instance.scene.environment = environment;
  };
  // A restored context starts out blank, so draw again even if nothing else moves.
  canvas.addEventListener('webglcontextrestored', () => {
    stale.add(environment);
    environment = makeEnvironment();
    for (const e of entries) refreshEnvironment(e);
    wake();
  });

  // Models are downloaded and parsed once per URL (relative to the page, meshopt-compressed GLB).
  // Every caller gets its own copy of the scene graph, so two scenes can use the same file;
  // geometry and the original materials are shared, so replace materials rather than edit them.
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = new Map();
  function load(path) {
    const url = new URL(path, document.baseURI).href;
    if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
    return cache.get(url).then((gltf) => {
      const scene = gltf.scene.clone(true);
      return { ...gltf, scene, scenes: [scene] };
    });
  }

  const entries = []; // { id, el, slot, instance, ui }
  let mounted = null; // the slot the canvas is in
  const size = { width: 1, height: 1 };

  // Resizing the canvas clears it, so whenever the size changes outside the frame loop (also while
  // the loop is stopped) the current frame is drawn again straight away; otherwise the browser
  // would show an empty stage.
  const resizeObserver = new ResizeObserver(() => {
    if (resize()) draw(active());
  });

  function mountInto(slot) {
    if (mounted === slot) return;
    if (mounted) resizeObserver.unobserve(mounted);
    slot.appendChild(canvas);
    mounted = slot;
    resizeObserver.observe(slot);
    resize(true);
  }

  // Matches the canvas to its slot and the screen's pixel ratio. Returns true if anything changed.
  function resize(force = false) {
    if (!mounted) return false;
    const width = Math.max(1, mounted.clientWidth);
    const height = Math.max(1, mounted.clientHeight);
    const ratio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
    if (!force && width === size.width && height === size.height && ratio === renderer.getPixelRatio()) return false;
    size.width = width;
    size.height = height;
    if (ratio !== renderer.getPixelRatio()) renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    for (const e of entries) if (e.slot === mounted) e.instance.resize(width, height);
    return true;
  }

  // Browser zoom and moving the window to another screen change the pixel ratio, sometimes
  // without changing the CSS size; re-check whenever it changes.
  function watchPixelRatio() {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', () => {
      if (resize()) draw(active());
      watchPixelRatio();
    }, { once: true });
  }
  watchPixelRatio();

  // The scene to draw: the one filling most of the window, else any visible one.
  function active() {
    const visible = entries.filter((e) => state.scenes[e.id].visible);
    return visible.find((e) => e.id === state.current) || visible[0] || null;
  }

  // Draws one frame of a scene at its current progress (does not move time forward).
  // Returns true if the scene says it is still moving on its own (update() returned busy: true).
  function draw(entry) {
    if (!entry || entry.slot !== mounted) return false;
    const scene = state.scenes[entry.id];
    const out = entry.instance.update(scene.progress, state, size) || {};
    entry.ui.apply(scene.progress, out, size);
    renderer.toneMappingExposure = entry.instance.exposure ?? 1;
    renderer.render(entry.instance.scene, entry.instance.camera);
    return !!out.busy;
  }

  let running = false;
  let last = 0;
  function tick(now) {
    const entry = active();
    if (!entry) { stop(); return; }
    // wake() may run after this frame's timestamp was taken (a scroll event in the same frame),
    // so dt is never negative; after a long pause it is capped.
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
    last = now;
    advance(state, dt);
    mountInto(entry.slot);
    resize();
    const busy = draw(entry);
    // Keep going while anything still moves; otherwise this frame stays on screen until wake().
    if (busy || !isSettled(state)) requestAnimationFrame(tick);
    else stop();
  }

  function stop() {
    running = false;
    state.dt = 0; // a frame drawn while stopped (after a resize) does not move time forward
  }

  // Start drawing if a scene is visible; safe to call often. Everything that can change the
  // picture calls it: input.js (scroll, resize, mouse, drag, the reduce-motion setting), the pose
  // buttons, a scene being added, a restored WebGL context.
  function wake() {
    if (running || !active()) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  return {
    get environment() { return environment; },
    load,

    // Put the (still empty) canvas into a stage early, so it can fade in once the scene is ready.
    prepare(slot) {
      if (!mounted) mountInto(slot);
    },

    // instance: { scene, camera, exposure?, resize(w, h), update(progress, state, size) -> output }
    // output may include busy: true while the scene is still moving on its own (e.g. easing into
    // a pose); the loop then keeps drawing even if the scroll and the mouse are still.
    add(entry) {
      refreshEnvironment(entry);
      entries.push(entry);
      if (entry.slot === mounted) entry.instance.resize(size.width, size.height);
      wake(); // the loop may be stopped; draw the new scene if it is on screen
    },

    wake,
  };
}
