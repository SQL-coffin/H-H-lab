// Scene: exploded view of one implant case — working model, gingiva mask, implant bridge.
// As the visitor scrolls through the section, the camera swings from a three-quarter view to the
// front, the bridge and then the gingiva mask lift off the model, a light panel wipes in and each
// layer gets a label (the labels and captions themselves live in index.html).
import * as THREE from 'three';

const MODELS = {
  model: 'assets/models/model.glb',
  tissue: 'assets/models/tissue.glb',
  bridge: 'assets/models/bridge.glb',
};

// How far each layer lifts when fully exploded, in mm along the occlusal direction,
// and the scroll window (0..1) in which it lifts: the bridge goes first, the mask follows.
const LIFT = { tissue: 11, bridge: 26 };
const LIFT_WINDOW = { bridge: [0.28, 0.58], tissue: [0.36, 0.66] };
// Where on each layer its label points, as a share of the layer's height (low on the model so
// it does not crowd the mask).
const LABEL_HEIGHT = { bridge: 0.5, tissue: 0.55, model: 0.2 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

export default {
  id: 'exploded-case',

  async setup({ engine }) {
    const scene = new THREE.Scene();
    scene.environment = engine.environment;
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
    await Promise.all(Object.entries(MODELS).map(async ([name, path]) => {
      const gltf = await engine.load(path);
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.material = materials[name];
          if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
        }
      });
      const layer = new THREE.Group();
      layer.add(gltf.scene);
      layers[name] = layer;
    }));
    // Add in a fixed order so drawing order does not depend on which file arrived first.
    for (const name of Object.keys(MODELS)) root.add(layers[name]);

    // Centre the assembled case on the turntable axis.
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    root.position.sub(box.getCenter(new THREE.Vector3()));
    const radius = box.getSize(new THREE.Vector3()).length() / 2;

    // Label anchors: each layer's bounding box in its own space (the layers only translate).
    root.updateMatrixWorld(true);
    const layerBoxes = {};
    for (const name of Object.keys(MODELS)) {
      const b = new THREE.Box3().setFromObject(layers[name]);
      layerBoxes[name] = new THREE.Box3(layers[name].worldToLocal(b.min.clone()), layers[name].worldToLocal(b.max.clone()));
    }

    const tmp = new THREE.Vector3();
    const toScreen = (v, size) => ({ x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height });

    return {
      scene,
      camera,
      exposure: 0.85,

      resize(width, height) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      },

      update(p, state, size) {
        layers.bridge.position.z = LIFT.bridge * smooth(...LIFT_WINDOW.bridge, p);
        layers.tissue.position.z = LIFT.tissue * smooth(...LIFT_WINDOW.tissue, p);

        // Three-quarter view -> front view; the camera drops to eye level, zooms in, then backs off
        // to fit the stack. It also leans a little toward the mouse.
        const turn = smooth(0.1, 0.62, p);
        const lean = { x: state.pointer.smoothX, y: state.pointer.smoothY };
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
        // Phones: the case sits in the upper part, captions take the bottom; at the end it moves
        // left to leave room for the layer labels.
        const shiftX = portrait ? mix(0, 0.17, smooth(0.66, 0.8, p)) : mix(-0.16, 0, smooth(0.3, 0.7, p));
        const shiftY = portrait ? 0.14 : 0;
        const vw = 1000;
        const vh = vw / camera.aspect;
        camera.setViewOffset(vw, vh, shiftX * vw, shiftY * vh, vw, vh);
        camera.position.set(0, lookY + Math.sin(elev) * dist, Math.cos(elev) * dist);
        camera.lookAt(0, lookY, 0);
        camera.updateProjectionMatrix();

        // Label anchors: right edge of each layer on screen, part-way up the layer.
        scene.updateMatrixWorld(true);
        const anchors = {};
        for (const name of Object.keys(MODELS)) {
          const b = layerBoxes[name];
          let maxX = -Infinity;
          for (let i = 0; i < 8; i++) {
            tmp.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
            layers[name].localToWorld(tmp).project(camera);
            maxX = Math.max(maxX, tmp.x);
          }
          b.getCenter(tmp);
          tmp.z = b.min.z + (b.max.z - b.min.z) * LABEL_HEIGHT[name];
          layers[name].localToWorld(tmp).project(camera);
          anchors[name] = { x: toScreen({ x: maxX, y: 0 }, size).x, y: toScreen(tmp, size).y };
        }

        return {
          // Light panel wipes in from the right near the end.
          vars: { wipe: smooth(0.66, 0.8, p).toFixed(4) },
          classes: { 'is-light': p > 0.73 },
          anchors,
          showAnchors: p > 0.76,
        };
      },
    };
  },
};
