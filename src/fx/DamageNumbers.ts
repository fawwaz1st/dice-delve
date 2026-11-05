/** Angka damage melayang (HTML overlay yang diprojeksikan dari 3D). */
import { Vector3, Camera } from 'three/webgpu';

type Kind = 'player' | 'hurt' | 'heal' | 'gold';

const KIND_CLASS: Record<Kind, string> = {
  player: 'dmg dmg--player',
  hurt: 'dmg dmg--hurt',
  heal: 'dmg dmg--heal',
  gold: 'dmg dmg--gold',
};

const KIND_PREFIX: Record<Kind, string> = {
  player: '',
  hurt: '-',
  heal: '+',
  gold: '+',
};

export class DamageNumbers {
  private readonly layer: HTMLElement;
  private readonly camera: Camera;
  private readonly active: Array<{ el: HTMLElement; world: Vector3; life: number; vy: number }> = [];

  constructor(layer: HTMLElement, camera: Camera) {
    this.layer = layer;
    this.camera = camera;
  }

  spawn(world: Vector3, value: number, kind: Kind): void {
    const el = document.createElement('span');
    el.className = KIND_CLASS[kind];
    el.textContent = KIND_PREFIX[kind] + String(value);
    this.layer.appendChild(el);
    this.active.push({ el, world: world.clone(), life: 1.1, vy: 1.6 });
    window.setTimeout(() => el.remove(), 1200);
  }

  update(dt: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = new Vector3();
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const item = this.active[i];
      if (!item) continue;
      item.life -= dt;
      item.world.y += item.vy * dt;
      v.copy(item.world).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      item.el.style.left = x.toFixed(1) + 'px';
      item.el.style.top = y.toFixed(1) + 'px';
      item.el.style.opacity = Math.max(0, item.life / 1.1).toFixed(2);
      if (item.life <= 0) this.active.splice(i, 1);
    }
  }
}

