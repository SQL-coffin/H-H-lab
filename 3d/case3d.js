// Scroll-driven exploded view of one implant case: working model, gingiva mask, implant bridge.
// The section is a tall scroll track with a sticky stage. As the visitor scrolls, the camera
// swings from a three-quarter view to the front, the bridge and then the gingiva mask lift
// off the model, a light panel wipes in and each layer gets a label.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';

const section = document.querySelector('[data-case3d]');
const stage = section.querySelector('.case3d-stage');
const canvas = section.querySelector('canvas');
const loading = section.querySelector('[data-case3d-loading]');
const captions = [...section.querySelectorAll('[data-from]')];
const labels = [...section.querySelectorAll('[data-layer-label]')];

// How far each layer lifts when fully exploded, in mm along the occlusal direction,
// and the scroll window (0..1) in which it lifts: the bridge goes first, the mask follows.
const LIFT = { tissue: 11, bridge: 26 };
const LIFT_WINDOW = { bridge: [0.28, 0.58], tissue: [0.36, 0.66] };
const LABEL_HEIGHT = { bridge: 0.5, tissue: 0.55, model: 0.2 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

function fail() {
  section.classList.add('case3d--fallback');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  fail();
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(28, 1, 1, 2000);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(60, 120, 90);
  const rim = new THREE.DirectionalLight(0xe0ad5a, 2.6);
  rim.position.set(-90, 40, -120);
  const fill = new THREE.HemisphereLight(0xfff4e6, 0x101010, 0.6);
  scene.add(key, rim, fill);

  const materials = {
    model: new THREE.MeshStandardMaterial({ color: 0x7d8691, roughness: 0.85, metalness: 0 }),
    tissue: new THREE.MeshPhysicalMaterial({ color: 0xc9707a, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    bridge: new THREE.MeshPhysicalMaterial({ color: 0xe9dcc6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: new THREE.Color(0xfff6e8) }),
  };

  // spin (turntable) > root (model frame: +z is occlusal, turned so it points up) > layers.
  // With spin = PI the labial side of the bridge faces the camera.
  const spin = new THREE.Group();
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  spin.add(root);
  scene.add(spin);
  const layers = {};
  const layerBoxes = {};

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const load = (name) => loader.loadAsync(new URL(`models/${name}.glb`, import.meta.url).href).then((gltf) => {
    const layer = new THREE.Group();
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.material = materials[name];
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      }
    });
    layer.add(gltf.scene);
    root.add(layer);
    layers[name] = layer;
  });

  let radius = 40;
  Promise.all(['model', 'tissue', 'bridge'].map(load)).then(() => {
    // Centre the assembled case on the turntable axis.
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    root.position.sub(box.getCenter(new THREE.Vector3()));
    radius = box.getSize(new THREE.Vector3()).length() / 2;
    // Label anchors: each layer's bounding box in its own space (the layers only translate).
    root.updateMatrixWorld(true);
    for (const name of ['model', 'tissue', 'bridge']) {
      const b = new THREE.Box3().setFromObject(layers[name]);
      layerBoxes[name] = new THREE.Box3(layers[name].worldToLocal(b.min.clone()), layers[name].worldToLocal(b.max.clone()));
    }
    loading.hidden = true;
    section.classList.add('case3d--ready');
    resize();
    readScroll();
    start();
  }).catch(fail);

  let target = 0;
  let progress = 0;
  const pointer = { x: 0, y: 0 };
  const lean = { x: 0, y: 0 };

  function readScroll() {
    const r = section.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    target = clamp01(-r.top / Math.max(1, total));
  }

  // A slight lean toward the mouse on desktop.
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  });
  stage.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const tmp = new THREE.Vector3();
  function frame(p) {
    const lift = {
      bridge: smooth(...LIFT_WINDOW.bridge, p),
      tissue: smooth(...LIFT_WINDOW.tissue, p),
    };
    layers.bridge.position.z = LIFT.bridge * lift.bridge;
    layers.tissue.position.z = LIFT.tissue * lift.tissue;

    // Three-quarter view -> front view; camera drops to eye level, zooms in, then backs off to fit the stack.
    const turn = smooth(0.1, 0.62, p);
    lean.x += (pointer.x - lean.x) * 0.06;
    lean.y += (pointer.y - lean.y) * 0.06;
    spin.rotation.y = mix(Math.PI - 0.55, Math.PI, turn) + lean.x * 0.25;

    // Distances are fitted to the window so the case never runs into the text:
    // fw / fh = share of the half-width / half-height the case's bounding sphere may fill.
    const portrait = camera.aspect < 0.9;
    const av = THREE.MathUtils.degToRad(camera.fov / 2);
    const ah = Math.atan(Math.tan(av) * camera.aspect);
    const fit = (fw, fh, r) => Math.max(r / (fw * Math.tan(ah)), r / (fh * Math.tan(av)));
    const startDist = fit(portrait ? 1 : 0.6, portrait ? 0.56 : 0.85, radius);
    const endDist = fit(portrait ? 0.95 : 0.8, portrait ? 0.66 : 0.95, radius + LIFT.bridge * 0.5);
    const dist = mix(mix(startDist, startDist * 0.9, smooth(0, 0.3, p)), endDist, smooth(0.3, 0.7, p));
    const elev = THREE.MathUtils.degToRad(mix(34, 7, turn) - lean.y * 6);
    const lookY = mix(0, LIFT.bridge * 0.42, smooth(0.28, 0.66, p));
    // Wide screens: the case starts in the right half (headline on the left) and ends centred.
    // Phones: the case sits in the upper part, captions take the bottom; at the end it moves left
    // to leave room for the layer labels.
    const shiftX = portrait ? mix(0, 0.17, smooth(0.66, 0.8, p)) : mix(-0.16, 0, smooth(0.3, 0.7, p));
    const shiftY = portrait ? 0.14 : 0;
    const vw = 1000;
    const vh = vw / camera.aspect;
    camera.setViewOffset(vw, vh, shiftX * vw, shiftY * vh, vw, vh);
    camera.position.set(0, lookY + Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix();

    // Light panel wipes in from the right near the end.
    section.style.setProperty('--wipe', smooth(0.66, 0.8, p).toFixed(4));
    section.classList.toggle('is-light', p > 0.73);

    captions.forEach((c) => {
      c.classList.toggle('is-on', p >= +c.dataset.from && p < +c.dataset.to);
    });

    // Per-layer labels sit just right of their layer on screen once the stack is open.
    const showLabels = p > 0.76;
    scene.updateMatrixWorld(true);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const placed = labels.map((el) => {
      const name = el.dataset.layerLabel;
      const box = layerBoxes[name];
      let maxX = -Infinity;
      for (let i = 0; i < 8; i++) {
        tmp.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
        layers[name].localToWorld(tmp).project(camera);
        maxX = Math.max(maxX, tmp.x);
      }
      // Vertical anchor: part-way up the layer (low on the model so it does not crowd the mask).
      const c = box.getCenter(new THREE.Vector3());
      c.z = box.min.z + (box.max.z - box.min.z) * LABEL_HEIGHT[name];
      layers[name].localToWorld(c).project(camera);
      return { el, x: ((maxX + 1) / 2) * w + 8, y: ((1 - c.y) / 2) * h };
    });
    // Keep labels at least MIN_GAP px apart, top to bottom.
    placed.sort((a, b) => a.y - b.y);
    const minGap = w < 760 ? 46 : 40;
    for (let i = 1; i < placed.length; i++) placed[i].y = Math.max(placed[i].y, placed[i - 1].y + minGap);
    placed.forEach(({ el, x, y }) => {
      const left = Math.min(x, w - el.offsetWidth - 8);
      el.style.transform = `translate(${left}px, ${y}px) translateY(-50%)`;
      el.classList.toggle('is-on', showLabels);
    });
  }

  let running = false;
  let visible = false;
  function tick() {
    if (!visible) { running = false; return; }
    progress += (target - progress) * 0.1;
    if (Math.abs(target - progress) < 0.0005) progress = target;
    frame(progress);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  function start() {
    if (running || !visible || !layers.bridge) return;
    running = true;
    requestAnimationFrame(tick);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) { readScroll(); start(); }
  }).observe(section);

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', () => { resize(); readScroll(); });
}
