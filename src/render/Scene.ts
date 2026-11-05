import {
  Scene, PerspectiveCamera, Color, Fog,
  HemisphereLight, DirectionalLight, AmbientLight,
  Mesh, BoxGeometry, ConeGeometry, IcosahedronGeometry, Group,
} from 'three/webgpu';
import { PALETTE, toonMaterial } from './Materials.js';

export interface SceneRig {
  scene: Scene;
  camera: PerspectiveCamera;
  root: Group;
  update(): void;
}

/** RNG deterministik untuk penempatan dekorasi. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
}

export function createScene(): SceneRig {
  const scene = new Scene();
  scene.background = new Color(PALETTE.bg);
  scene.fog = new Fog(new Color(PALETTE.bg), 16, 44);

  const camera = new PerspectiveCamera(42, 1, 0.1, 140);
  camera.position.set(0, 9.5, 13.5);
  camera.lookAt(0, 0.6, -1);

  // Pencahayaan: key hangat berkontras + rim dingin + fill lembut.
  const hemi = new HemisphereLight(new Color('#ffe8c4'), new Color('#1e140c'), 0.7);
  scene.add(hemi);

  const key = new DirectionalLight(new Color('#ffd9a0'), 3.0);
  key.position.set(6, 12, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  // Rim dingin dari belakang untuk memisahkan silhouette.
  const rim = new DirectionalLight(new Color('#7d9bff'), 0.9);
  rim.position.set(-6, 6, -9);
  scene.add(rim);

  // Fill lembut dari depan bawah.
  const fill = new DirectionalLight(new Color('#ffcc99'), 0.35);
  fill.position.set(-4, 3, 9);
  scene.add(fill);

  scene.add(new AmbientLight(new Color('#483826'), 0.3));

  const root = new Group();
  scene.add(root);

  // Meja kayu (bidang tanah).
  const tableMat = toonMaterial(PALETTE.table);
  const table = new Mesh(new BoxGeometry(36, 1.2, 36), tableMat);
  table.position.y = -0.6;
  table.receiveShadow = true;
  root.add(table);

  // Bingkai papan (4 rel).
  const frameMat = toonMaterial(PALETTE.tableEdge);
  const railGeo = new BoxGeometry(21.6, 0.6, 1.0);
  for (const [x, z] of [[0, -10.3], [0, 10.3], [-10.3, 0], [10.3, 0]] as const) {
    const rail = new Mesh(railGeo, frameMat);
    rail.position.set(x, 0.1, z);
    rail.rotation.y = Math.abs(x) > 0 ? Math.PI / 2 : 0;
    rail.receiveShadow = true;
    root.add(rail);
  }

  // Dekorasi lingkungan: pohon kerucut, kristal, batu (low-poly stylized).
  addDecor(root);

  // Kamera dikendalikan CameraRig. update() untuk ambient.
  function update(): void {
    // efek ambient ditangani sistem partikel di modul fx.
  }

  return { scene, camera, root, update };
}

function addDecor(root: Group): void {
  const rand = rng(20261105);
  const decor = new Group();
  const trunkMat = toonMaterial('#5a3c24');
  const leafMat = toonMaterial('#3f6632', { emissive: '#5a8a3a', emissiveIntensity: 0.15 });
  const crystalMat = toonMaterial('#5a4a8a', { emissive: '#8f6bff', emissiveIntensity: 0.65 });
  const rockMat = toonMaterial('#4a4440');
  const trunkGeo = new BoxGeometry(0.35, 0.9, 0.35);
  const leafGeo = new ConeGeometry(0.9, 2.2, 8);
  const crystalGeo = new IcosahedronGeometry(0.5, 0);
  const rockGeo = new IcosahedronGeometry(0.55, 0);

  // Sebar di luar papan (radius > 11), hindari tengah.
  for (let i = 0; i < 42; i += 1) {
    const ang = rand() * Math.PI * 2;
    const rad = 11.5 + rand() * 6;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const kind = rand();
    let obj: Mesh;
    if (kind < 0.42) {
      // Pohon: batang + kerucut daun.
      const tree = new Group();
      const trunk = new Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.45;
      trunk.castShadow = true;
      tree.add(trunk);
      const leaf = new Mesh(leafGeo, leafMat);
      leaf.position.y = 1.6;
      leaf.castShadow = true;
      tree.add(leaf);
      const s = 0.8 + rand() * 0.8;
      tree.scale.setScalar(s);
      tree.position.set(x, 0, z);
      tree.rotation.y = rand() * Math.PI;
      decor.add(tree);
      continue;
    } else if (kind < 0.7) {
      // Kristal memendar.
      obj = new Mesh(crystalGeo, crystalMat);
      obj.scale.setScalar(0.7 + rand() * 0.9);
      obj.castShadow = true;
    } else {
      // Batu.
      obj = new Mesh(rockGeo, rockMat);
      obj.scale.setScalar(0.6 + rand() * 0.8);
      obj.castShadow = true;
    }
    obj.position.set(x, 0.3, z);
    obj.rotation.y = rand() * Math.PI;
    decor.add(obj);
  }

  root.add(decor);
}

