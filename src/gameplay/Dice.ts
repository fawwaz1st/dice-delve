import { Mesh, BoxGeometry, Group, Vector3, Quaternion } from 'three/webgpu';
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

  async init(): Promise<void> {
    // Tanpa fisika eksternal: dadu dianimate via tween.
  }

  spawn(position: Vector3): Dice {
    const geo = new BoxGeometry(this.size, this.size, this.size);
    const colors = ['#f3e3c3', '#f3e3c3', '#ffb000', '#ff6a2a', '#8f6bff', '#7ddc3f'];
    const mats = colors.map((c) => toonMaterial(c));
    const mesh = new Mesh(geo, mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new Group();
    group.add(mesh);
    addOutline(mesh, 1.05, '#241a10');
    group.position.copy(position);
    const dice: Dice = { mesh: group, value: 1, rolling: false };
    this.dice.push(dice);
    return dice;
  }

  /** Lempar dadu: tentukan nilai, animasikan, selesaikan dengan janji. */
  roll(dice: Dice): Promise<number> {
    const value = 1 + Math.floor(Math.random() * 6);
    dice.value = value;
    dice.rolling = true;
    const target = targetOrientation(value);
    const startPos = dice.mesh.position.clone();
    const startQuat = dice.mesh.quaternion.clone();

    return new Promise((resolve) => {
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
              dice.rolling = false;
              resolve(value);
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

