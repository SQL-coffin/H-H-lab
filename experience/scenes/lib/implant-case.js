// The implant case shared by the scenes that show it: working model, gingiva mask and
// implant bridge, with their materials, lighting and a turntable to spin them on.
import * as THREE from 'three';

export const MODELS = {
  model: 'assets/models/model.glb',
  tissue: 'assets/models/tissue.glb',
  bridge: 'assets/models/bridge.glb',
};

// Builds a Three.js scene holding the case. Returns:
//   scene, spin     spin is the turntable (rotate on y); spin = PI puts the labial side toward +z
//   layers[name]    one group per layer; move it on z to lift it along the occlusal direction
//   layerBoxes      each layer's bounding box in its own space (the layers only translate)
//   radius          radius of the assembled case's bounding sphere, in mm
//   materials       the materials in use, so a scene can fade them
export async function buildCase(engine) {
  const scene = new THREE.Scene();
  scene.environment = engine.environment;
  scene.environmentIntensity = 0.55;

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

  root.updateMatrixWorld(true);
  const layerBoxes = {};
  for (const name of Object.keys(MODELS)) {
    const b = new THREE.Box3().setFromObject(layers[name]);
    layerBoxes[name] = new THREE.Box3(layers[name].worldToLocal(b.min.clone()), layers[name].worldToLocal(b.max.clone()));
  }

  return { scene, spin, root, layers, layerBoxes, radius, materials };
}
