import {
  Scene, PerspectiveCamera, Color, Fog,
  HemisphereLight, DirectionalLight, AmbientLight,
  Mesh, BoxGeometry, Group, Vector3,
} from 'three/webgpu';
import { PALETTE, toonMaterial } from './Materials.js';

export interface SceneRig {
  scene: Scene;
  camera: PerspectiveCamera;
  root: Group;
  update(): void;
}

export function createScene(): SceneRig {
  const scene = new Scene();
  scene.background = new Color(PALETTE.bg);
  scene.fog = new Fog(new Color(PALETTE.bg), 18, 46);

  const camera = new PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(0, 9.5, 13.5);
  camera.lookAt(0, 0, -1);

  // Cahaya: hemisphere lembut + directional dengan shadow (1 lampu saja).
  const hemi = new HemisphereLight(new Color('#fff1d6'), new Color('#241a12'), 0.85);
  scene.add(hemi);

  const key = new DirectionalLight(new Color('#ffd9a0'), 2.8);
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

  // Rim light dingin dari belakang untuk memisahkan silhouette.
  const rim = new DirectionalLight(new Color('#6f8cff'), 0.7);
  rim.position.set(-6, 6, -9);
  scene.add(rim);

  scene.add(new AmbientLight(new Color('#4a3a2a'), 0.25));

  const root = new Group();
  scene.add(root);

  // Meja kayu (tanah di mana semua berdiri).
  const tableMat = toonMaterial(PALETTE.table);
  const table = new Mesh(new BoxGeometry(34, 1.2, 34), tableMat);
  table.position.y = -0.6;
  table.receiveShadow = true;
  root.add(table);

  // Papan 10x10: kotak-kotak tiles.
  const tileGeo = new BoxGeometry(1.9, 0.24, 1.9);
  const tileMatA = toonMaterial(PALETTE.tile);
  const tileMatB = toonMaterial(PALETTE.tileAlt);
  const board = new Group();
  const half = 5;
  for (let x = 0; x < 10; x += 1) {
    for (let z = 0; z < 10; z += 1) {
      const tile = new Mesh(tileGeo, (x + z) % 2 === 0 ? tileMatA : tileMatB);
      tile.position.set((x - half + 0.5) * 2, 0.12, (z - half + 0.5) * 2);
      tile.receiveShadow = true;
      tile.castShadow = false;
      board.add(tile);
    }
  }
  root.add(board);

  // Bingkai papan.
  const frameMat = toonMaterial(PALETTE.tableEdge);
  const frame = new Mesh(new BoxGeometry(21.4, 0.5, 21.4), frameMat);
  frame.position.y = 0.02;
  frame.receiveShadow = true;
  // Lubang tengah bingkai: pakai 4 balok.
  frame.visible = false;
  root.add(frame);
  const railGeo = new BoxGeometry(21.6, 0.6, 1.0);
  for (const [x, z] of [[0, -10.3], [0, 10.3], [-10.3, 0], [10.3, 0]] as const) {
    const rail = new Mesh(railGeo, frameMat);
    rail.position.set(x, 0.1, z);
    rail.rotation.y = Math.abs(x) > 0 ? Math.PI / 2 : 0;
    rail.receiveShadow = true;
    root.add(rail);
  }

  // ... wajah dadu & pion akan ditambahkan modul gameplay.
  const cameraTarget = new Vector3(0, 0.6, -1);

  function update(): void {
    // Kamera orbit halus (placeholder; nanti digerakkan input).
    const t = performance.now() * 0.0001;
    camera.position.x = Math.sin(t) * 0.4;
    camera.lookAt(cameraTarget);
  }

  return { scene, camera, root, update };
}
