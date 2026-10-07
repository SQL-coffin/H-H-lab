// Exploded view of one implant case: working model, gingiva mask, implant bridge.
// Hovering the stage (or tapping it on touch screens) lifts the layers apart like a stack;
// leaving it puts them back. The case turns slowly on its own and follows the pointer a little.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';

const section = document.querySelector('[data-case3d]');
const stage = section.querySelector('.case3d-stage');
const canvas = section.querySelector('canvas');
const loading = section.querySelector('[data-case3d-loading]');

// How far each layer travels when fully exploded, in mm along the occlusal direction,
// and how quickly it follows (the bridge leads, the gingiva follows, like a stack lifting).
const LIFT = { tissue: 10, bridge: 24 };
const FOLLOW = { tissue: 0.06, bridge: 0.09 };
const SPIN_SPEED = 0.12; // radians per second
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    root.position.sub(box.getCenter(new THREE.Vector3()));
    radius = box.getSize(new THREE.Vector3()).length() / 2;
    loading.hidden = true;
    section.classList.add('case3d--ready');
    resize();
    start();
  }).catch(fail);

  // Interaction state
  let open = false;
  const lift = { tissue: 0, bridge: 0 };
  const pointer = { x: 0, y: 0 };
  const look = { x: 0, y: 0 };
  let angle = -0.6;

  function setOpen(v) {
    open = v;
    section.classList.toggle('is-open', open);
    start();
  }

  stage.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setOpen(true); });
  stage.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') setOpen(false);
    pointer.x = 0;
    pointer.y = 0;
  });
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  });
  // Touch screens have no hover: a tap toggles.
  stage.addEventListener('click', (e) => { if (e.pointerType !== 'mouse') setOpen(!open); });

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

  function frame(dt) {
    for (const name of ['tissue', 'bridge']) {
      lift[name] += ((open ? 1 : 0) - lift[name]) * FOLLOW[name];
      layers[name].position.z = LIFT[name] * lift[name];
    }
    const e = lift.bridge;

    if (!reduceMotion) angle += SPIN_SPEED * dt;
    look.x += (pointer.x - look.x) * 0.06;
    look.y += (pointer.y - look.y) * 0.06;
    spin.rotation.y = angle + look.x * 0.5;

    // Camera rises to look into the intaglio while exploded and pulls back to fit the lifted layers.
    const elev = THREE.MathUtils.degToRad(18 + 16 * e - look.y * 10);
    const portrait = camera.aspect < 0.9;
    const dist = radius * (portrait ? 7.2 : 3.4) * (1 + 0.3 * e);
    const lookY = LIFT.bridge * 0.45 * e;
    camera.position.set(0, lookY + Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(0, lookY, 0);
  }

  let running = false;
  let visible = false;
  let last = 0;
  function tick(now) {
    if (!visible) { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  function start() {
    if (running || !visible || !layers.bridge) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  }).observe(section);

  window.addEventListener('resize', resize);
}
