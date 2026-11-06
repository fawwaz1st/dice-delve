import { Mesh, BoxGeometry, Group, Vector3, Quaternion, CircleGeometry, MeshBasicMaterial, Color, Object3D } from 'three/webgpu';
import { toonMaterial, addOutline } from '../render/Materials.js';
import { tween, Ease } from '../utils/tween.js';

/** Nilai per muka: indeks material BoxGeometry = [+X, -X, +Y, -Y, +Z, -Z]. */
const FACE_VALUES = [3, 4, 1, 6, 2, 5] as const;

/** Normal lokal tiap muka (urutan sama dengan FACE_VALUES). */
const FACE_NORMALS = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
] as const;

/** Pola pip standar dalam grid 3x3 (offset -1..1). */
const PIP_PATTERNS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** Tambahkan pip hitam pada setiap muka dadu agar nilai terbaca. */
function addPips(parent: Object3D, size: number): void {
  const pipMat = new MeshBasicMaterial({ color: new Color('#241a10') });
  const half = size / 2;
  const spacing = size * 0.26;
  const pipGeo = new CircleGeometry(size * 0.085, 16);
  for (let i = 0; i < 6; i += 1) {
    const value = FACE_VALUES[i] ?? 1;
    const normal = FACE_NORMALS[i] ?? new Vector3(0, 1, 0);
    const pattern = PIP_PATTERNS[value] ?? [];
    // Basis lokal muka: T dan B tegak lurus normal.
    const ref = Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const t = new Vector3().crossVectors(normal, ref).normalize();
    const b = new Vector3().crossVectors(normal, t).normalize();
    const orient = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
    for (const [u, v] of pattern) {
      const pip = new Mesh(pipGeo, pipMat);
      pip.quaternion.copy(orient);
      pip.position.copy(t.clone().multiplyScalar(u * spacing));
      pip.position.add(b.clone().multiplyScalar(v * spacing));
      pip.position.add(normal.clone().multiplyScalar(half + 0.005));
      parent.add(pip);
    }
  }
}

/** Nilai muka -> orientasi target (muka menghadap ke atas). */
function targetOrientation(value: number): Quaternion {
  const idx = FACE_VALUES.indexOf(value as (typeof FACE_VALUES)[number]);
  const normal = FACE_NORMALS[idx] ?? FACE_NORMALS[2];
  const q = new Quaternion().setFromUnitVectors(normal, new Vector3(0, 1, 0));
  // Rotasi acak di sekitar sumbu Y agar variasi.
  const spin = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.random() * Math.PI * 2);
  return spin.multiply(q);
}

export interface Dice {
  mesh: Group;
  value: number;
  rolling: boolean;
}

/** Dadu: animasi tween deterministik (andal, tidak bergantung fisika frame rate). */
export class DiceManager {
  private dice: Dice[] = [];
  private readonly size = 1.1;
  private rngState = 1;

  async init(): Promise<void> {
    // Tanpa fisika eksternal: dadu dianimate via tween.
  }

  /** Set seed agar dadu konsisten dengan papan (klaim seed harian terpenuhi). */
  setSeed(seed: number): void {
    this.rngState = (seed >>> 0) || 1;
  }

  private next(): number {
    let s = this.rngState;
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    this.rngState = s;
    return s / 0xffffffff;
  }

  spawn(position: Vector3): Dice {
    const geo = new BoxGeometry(this.size, this.size, this.size);
    // Warna seragam (tulang) + pip gelap agar nilai terbaca jelas.
    const mat = toonMaterial('#f3e3c3');
    const mesh = new Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new Group();
    group.add(mesh);
    addPips(mesh, this.size);
    addOutline(mesh, 1.05, '#241a10');
    group.position.copy(position);
    const dice: Dice = { mesh: group, value: 1, rolling: false };
    this.dice.push(dice);
    return dice;
  }

  /** Lempar dadu: tentukan nilai (ter-seed), animasikan, selesaikan dengan janji. */
  roll(dice: Dice): Promise<number> {
    const mesh = dice?.mesh;
    if (!mesh) return Promise.resolve(1 + Math.floor(this.next() * 6));
    const value = 1 + Math.floor(this.next() * 6);
    dice.value = value;
    dice.rolling = true;
    const target = targetOrientation(value);
    const startPos = mesh.position.clone();
    const startQuat = mesh.quaternion.clone();

    return new Promise((resolve) => {
      // Watchdog: jangan pernah macet meski tween terganggu.
      let settled = false;
      const settleOne = (v: number): void => {
        if (settled) return;
        settled = true;
        dice.rolling = false;
        resolve(v);
      };
      const watchdog = window.setTimeout(() => settleOne(value), 4000);
      // Fase 1: putar cepat di udara.
      tween({
        duration: 700,
        ease: Ease.outCubic,
        onUpdate: (t) => {
          dice.mesh.position.y = startPos.y + Math.sin(t * Math.PI) * 1.2;
          dice.mesh.rotation.x += 0.35;
          dice.mesh.rotation.y += 0.42;
          dice.mesh.rotation.z += 0.28;
        },
        onDone: () => {
          // Fase 2: mendarat tepat pada muka yang ditentukan.
          const landStart = dice.mesh.position.clone();
          tween({
            duration: 420,
            ease: Ease.outBack,
            onUpdate: (t) => {
              dice.mesh.position.copy(landStart).lerp(startPos, t);
              dice.mesh.quaternion.slerpQuaternions(startQuat, target, t);
            },
            onDone: () => {
              dice.mesh.position.copy(startPos);
              dice.mesh.quaternion.copy(target);
              window.clearTimeout(watchdog);
              settleOne(value);
            },
          });
        },
      });
    });
  }

  update(): void {
    // Dadu digerakkan tween; tidak ada fisika per frame.
  }
}
