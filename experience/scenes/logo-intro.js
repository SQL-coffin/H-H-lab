// Scene: the page opens on the H&H logo; scrolling flies the camera through the gold frame of
// the logo into a close-up of the implant bridge waiting behind it.
//
// The logo is a flat plane textured with the logo image. It is drawn additively, so its black
// background disappears and only the gold and white lines show. The bridge sits in the dark
// behind it and is lit up as the camera passes through the frame. Gold specks streaming past
// give a sense of speed.
import * as THREE from 'three';
import { addStudioLights, createMaterials, boxInOwnSpace } from './lib/implant-case.js';

const LOGO = { path: 'images/logo.webp', width: 60, aspect: 767 / 658 };
// The point the camera flies through: the empty space inside the frame below the letters,
// in logo image pixels (767 x 658).
const AIM_PX = { x: 300, y: 472 };
const BRIDGE_DEPTH = 140; // how far behind the logo the bridge sits

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

function loadTexture(path) {
  return new THREE.TextureLoader().loadAsync(new URL(path, document.baseURI).href);
}

export default {
  id: 'logo-intro',

  async setup({ engine }) {
    const scene = new THREE.Scene();
    scene.environment = engine.environment;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);

    // Lights (dimmed until the camera reaches the bridge).
    const lights = new THREE.Group();
    addStudioLights(lights);
    scene.add(lights);
    const baseIntensity = lights.children.map((l) => l.intensity);

    // Logo plane.
    const logoHeight = LOGO.width / LOGO.aspect;
    const texture = await loadTexture(LOGO.path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const logoMaterial = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(LOGO.width, logoHeight), logoMaterial);
    scene.add(logo);
    const aim = new THREE.Vector2(
      (AIM_PX.x / 767 - 0.5) * LOGO.width,
      (0.5 - AIM_PX.y / 658) * logoHeight,
    );

    // Bridge behind the logo, centred on the aim line. spin turns it; root puts occlusal up.
    const gltf = await engine.load('assets/models/bridge.glb');
    const material = createMaterials().bridge;
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.material = material;
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      }
    });
    const holder = new THREE.Group();
    holder.add(gltf.scene);
    const box = boxInOwnSpace(holder);
    gltf.scene.position.sub(box.getCenter(new THREE.Vector3()));
    const bridgeRadius = box.getSize(new THREE.Vector3()).length() / 2;
    const root = new THREE.Group();
    root.rotation.x = -Math.PI / 2;
    root.add(holder);
    const spin = new THREE.Group();
    spin.add(root);
    spin.position.set(aim.x, aim.y, -BRIDGE_DEPTH);
    scene.add(spin);

    // Gold specks in a loose tunnel along the flight path.
    const SPECKS = 320;
    const positions = new Float32Array(SPECKS * 3);
    for (let i = 0; i < SPECKS; i++) {
      // Deterministic spread (no Math.random) so every visit looks the same.
      const a = i * 2.39996;
      const r = 14 + ((i * 37) % 97) / 97 * 46;
      positions[i * 3] = aim.x + Math.cos(a) * r;
      positions[i * 3 + 1] = aim.y + Math.sin(a) * r * 0.75;
      positions[i * 3 + 2] = 70 - ((i * 53) % 211) / 211 * (BRIDGE_DEPTH + 40);
    }
    const speckGeometry = new THREE.BufferGeometry();
    speckGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const speckMaterial = new THREE.PointsMaterial({
      color: 0xe0ad5a, size: 0.35, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    scene.add(new THREE.Points(speckGeometry, speckMaterial));

    // Distance at which an object of half-width hw and half-height hh fills fw / fh of the view.
    const fitDistance = (hw, hh, fw, fh) => {
      const av = THREE.MathUtils.degToRad(camera.fov / 2);
      const ah = Math.atan(Math.tan(av) * camera.aspect);
      return Math.max(hw / (fw * Math.tan(ah)), hh / (fh * Math.tan(av)));
    };

    return {
      scene,
      camera,
      exposure: 0.85,

      resize(width, height) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      },

      update(p, state) {
        const portrait = camera.aspect < 0.9;
        const startZ = fitDistance(LOGO.width / 2, logoHeight / 2, portrait ? 0.86 : 0.4, portrait ? 0.4 : 0.52);
        const endZ = -BRIDGE_DEPTH + fitDistance(bridgeRadius, bridgeRadius, portrait ? 0.95 : 0.62, portrait ? 0.5 : 0.8);

        // Flight: hold on the logo, then accelerate through the frame and settle on the bridge.
        const fly = smooth(0.06, 0.66, p);
        const z = mix(startZ, endZ, fly);
        // Line up with the aim point well before reaching the logo plane.
        const align = smooth(0, 1, (startZ - z) / Math.max(1, startZ - 14));
        const lean = { x: state.pointer.smoothX, y: state.pointer.smoothY };
        camera.position.set(mix(0, aim.x, align) + lean.x * 0.6, mix(0, aim.y, align) - lean.y * 0.4, z);
        camera.lookAt(camera.position.x, camera.position.y, z - 10);
        // At the start the logo sits in the upper part of the screen, the name below it.
        const vw = 1000;
        const vh = vw / camera.aspect;
        camera.setViewOffset(vw, vh, 0, mix(portrait ? 0.08 : 0.06, 0, align) * vh, vw, vh);
        camera.updateProjectionMatrix();

        // Logo fades as the camera reaches it, so it never fills the screen as a blur.
        logoMaterial.opacity = smooth(1.5, 16, z);
        logo.visible = logoMaterial.opacity > 0.01;

        // Specks show while flying.
        speckMaterial.opacity = 0.9 * smooth(0.1, 0.3, p) * (1 - smooth(0.62, 0.8, p));

        // The bridge is lit as the camera comes through, and turns a little to the front.
        const light = smooth(0.28, 0.6, p);
        lights.children.forEach((l, i) => { l.intensity = baseIntensity[i] * light; });
        scene.environmentIntensity = 0.55 * light;
        spin.rotation.y = Math.PI + THREE.MathUtils.degToRad(mix(-38, -8, smooth(0.3, 1, p))) + lean.x * 0.15;
        spin.rotation.x = THREE.MathUtils.degToRad(mix(18, 8, smooth(0.3, 1, p)));

        return { classes: { 'is-through': p > 0.5 } };
      },
    };
  },
};
