// Scroll-driven exploded view of one implant case: working model, gingiva mask, implant bridge.
// The section is tall; the stage inside it is sticky. Scroll progress (0..1) drives rotation,
// the explode amount and which caption is shown.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';

const section = document.querySelector('[data-case3d]');
const canvas = section.querySelector('canvas');
const loading = section.querySelector('[data-case3d-loading]');
const captions = [...section.querySelectorAll('[data-from]')];

// How far each layer travels when fully exploded, in mm along the occlusal direction.
const LIFT = { model: 0, tissue: 9, bridge: 20 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function explodeAt(p) {
  return smooth(0.18, 0.42, p) * (1 - smooth(0.74, 0.94, p));
}

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

  // spin (turntable) > root (model frame: +z is occlusal, turned so it points up) > layers
  const spin = new THREE.Group();
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  spin.add(root);
  scene.add(spin);
  const layers = {};

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
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    radius = box.getSize(new THREE.Vector3()).length() / 2;
    loading.hidden = true;
    section.classList.add('case3d--ready');
    resize();
    start();
  }).catch(fail);

  let target = 0;
  let progress = 0;

  function readScroll() {
    const r = section.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    target = clamp01(-r.top / Math.max(1, total));
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // On wide screens push the case to the right half so the captions on the left stay clear.
    if (w > 760) camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function frame(p) {
    const e = explodeAt(p);
    layers.tissue.position.z = LIFT.tissue * e;
    layers.bridge.position.z = LIFT.bridge * e;

    // One full turn over the whole scroll: starts and ends on the same three-quarter view.
    spin.rotation.y = -0.6 + p * Math.PI * 2;

    // Camera rises to look into the intaglio while exploded; pulls back to fit the lifted layers.
    const elev = THREE.MathUtils.degToRad(18 + 16 * e);
    const portrait = camera.aspect < 0.9;
    const dist = radius * (portrait ? 7.2 : 3.4) * (1 + 0.28 * e);
    const lookY = (LIFT.bridge * 0.45) * e;
    camera.position.set(0, lookY + Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(0, lookY, 0);

    captions.forEach((c) => {
      const on = p >= +c.dataset.from && p < +c.dataset.to;
      c.classList.toggle('is-on', on);
    });
  }

  let running = false;
  let visible = false;
  function tick() {
    if (!visible) { running = false; return; }
    progress += (target - progress) * 0.12;
    if (Math.abs(target - progress) < 0.0005) progress = target;
    frame(progress);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  function start() {
    if (running || !layers.bridge) return;
    running = true;
    requestAnimationFrame(tick);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) { readScroll(); start(); }
  }).observe(section);

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', () => { resize(); readScroll(); });
  readScroll();
}
