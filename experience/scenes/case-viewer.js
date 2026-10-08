// Scene: product viewer for the implant case. Pose buttons in the HTML pick a pose (seated,
// layers, intaglio, close-up); the case glides into it. Visitors can also drag to turn it.
// Every pose is a handful of numbers, and the scene eases all of them toward the chosen pose.
import * as THREE from 'three';
import { buildCase } from './lib/implant-case.js';

const LIFT = { tissue: 11, bridge: 26 };

// explode  0..1   bridge and mask lift off the model (LIFT mm at 1)
// flip     0..1   bridge turns over so its fitting surface faces the camera
// fade     0..1   model and mask fade back so the bridge stands alone
// focus    0..1   camera frames the whole case (0) or just the bridge (1)
// yaw, pitch      camera angle in degrees (yaw 0 = labial side to the camera)
// fit             share of the screen the framed object may fill
const POSES = {
  seated:   { explode: 0,    flip: 0, fade: 0, focus: 0,   yaw: -32, pitch: 24, fit: 0.86 },
  layers:   { explode: 1,    flip: 0, fade: 0, focus: 0,   yaw: -8,  pitch: 10, fit: 0.9 },
  intaglio: { explode: 0.9,  flip: 1, fade: 1, focus: 1,   yaw: -10, pitch: 58, fit: 0.66 },
  closeup:  { explode: 0.14, flip: 0, fade: 0, focus: 1,   yaw: -18, pitch: 4,  fit: 0.7 },
};
const FIRST = 'seated';
const EASE_RATE = 4.5; // per second
const FLIP_ANGLE = -Math.PI; // a half turn about the arch's long axis: the fitting surface faces up

const mix = (a, b, t) => a + (b - a) * t;

export default {
  id: 'case-viewer',

  async setup({ engine }) {
    const { scene, spin, layers, layerBoxes, radius, materials } = await buildCase(engine);
    const camera = new THREE.PerspectiveCamera(28, 1, 1, 2000);

    // Turn the bridge about its own centre: move its contents so the layer's origin is the centre.
    // (The rotation into the model frame can swap min and max, so rebuild the box from its corners.)
    const bridgeBox = new THREE.Box3().setFromPoints([layerBoxes.bridge.min, layerBoxes.bridge.max]);
    const bridgeCenter = bridgeBox.getCenter(new THREE.Vector3());
    const bridgeRadius = bridgeBox.getSize(new THREE.Vector3()).length() / 2;
    layers.bridge.children[0].position.sub(bridgeCenter);

    for (const name of ['model', 'tissue']) materials[name].transparent = true;

    const cur = { ...POSES[FIRST] };
    const turn = { x: 0, y: 0 }; // eased copy of the visitor's drag
    const focusPoint = new THREE.Vector3();
    const caseCenter = new THREE.Vector3();

    return {
      scene,
      camera,
      exposure: 0.85,

      resize(width, height) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      },

      update(p, state, size) {
        const own = state.scenes['case-viewer'];
        const goal = POSES[own.pose] || POSES[FIRST];
        const k = state.reducedMotion ? 1 : 1 - Math.exp(-state.dt * EASE_RATE);
        for (const key of Object.keys(cur)) cur[key] += (goal[key] - cur[key]) * k;
        turn.x += (own.drag.x - turn.x) * (state.reducedMotion ? 1 : 1 - Math.exp(-state.dt * 10));
        turn.y += (own.drag.y - turn.y) * (state.reducedMotion ? 1 : 1 - Math.exp(-state.dt * 10));

        // Layers
        layers.bridge.position.set(bridgeCenter.x, bridgeCenter.y, bridgeCenter.z + LIFT.bridge * cur.explode);
        layers.bridge.rotation.x = FLIP_ANGLE * cur.flip;
        layers.tissue.position.z = LIFT.tissue * cur.explode - 6 * cur.fade;
        layers.model.position.z = -6 * cur.fade;
        materials.model.opacity = 1 - cur.fade;
        materials.tissue.opacity = 1 - cur.fade;
        layers.model.visible = materials.model.opacity > 0.02;
        layers.tissue.visible = materials.tissue.opacity > 0.02;

        // Camera: angle from the pose plus the drag and a slight lean toward the mouse.
        spin.rotation.y = Math.PI + THREE.MathUtils.degToRad(cur.yaw) + turn.x * Math.PI * 1.6 + state.pointer.smoothX * 0.12;
        const pitch = THREE.MathUtils.degToRad(Math.max(-35, Math.min(70, cur.pitch + turn.y * 70 - state.pointer.smoothY * 4)));

        // Frame either the whole case (centre rises with the lifted layers) or the bridge.
        scene.updateMatrixWorld(true);
        caseCenter.set(0, LIFT.bridge * 0.45 * cur.explode * (1 - cur.focus), 0);
        layers.bridge.getWorldPosition(focusPoint);
        focusPoint.lerp(caseCenter, 1 - cur.focus);
        const r = mix(radius + LIFT.bridge * 0.5 * cur.explode, bridgeRadius, cur.focus);

        // Wide screens: the pose list sits on the left, so the case is framed in the right part.
        const portrait = camera.aspect < 0.9;
        const av = THREE.MathUtils.degToRad(camera.fov / 2);
        const ah = Math.atan(Math.tan(av) * camera.aspect);
        const fw = (portrait ? 0.92 : 0.6) * cur.fit / 0.86;
        const fh = (portrait ? 0.5 : 0.82) * cur.fit / 0.86;
        const dist = Math.max(r / (fw * Math.tan(ah)), r / (fh * Math.tan(av)));
        const vw = 1000;
        const vh = vw / camera.aspect;
        camera.setViewOffset(vw, vh, portrait ? 0 : -0.17 * vw, portrait ? 0.06 * vh : 0, vw, vh);
        camera.position.set(focusPoint.x, focusPoint.y + Math.sin(pitch) * dist, focusPoint.z + Math.cos(pitch) * dist);
        camera.lookAt(focusPoint);
        camera.updateProjectionMatrix();

        return {};
      },
    };
  },
};
