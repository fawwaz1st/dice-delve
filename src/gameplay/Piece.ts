import { Group, Mesh, CapsuleGeometry, SphereGeometry, RingGeometry } from 'three/webgpu';
import { toonMaterial, addOutline } from '../render/Materials.js';
import { tween, Ease } from '../utils/tween.js';
import type { Vector3 } from 'three/webgpu';

export class Piece {
  readonly group = new Group();
  private readonly body: Mesh;

  constructor() {
    const geo = new CapsuleGeometry(0.4, 0.5, 6, 12);
    this.body = new Mesh(geo, toonMaterial('#f3e3c3', { emissive: '#ffb000', emissiveIntensity: 0.35 }));
    this.body.castShadow = true;
    this.body.position.y = 0.7;
    this.group.add(this.body);

    const head = new Mesh(
      new SphereGeometry(0.3, 16, 12),
      toonMaterial('#f3e3c3', { emissive: '#ffb000', emissiveIntensity: 0.5 }),
    );
    head.castShadow = true;
    head.position.y = 1.35;
    this.group.add(head);

    const ringGeo = new RingGeometry(0.55, 0.72, 24);
    const ringMat = toonMaterial('#ffb000', { emissive: '#ffb000', emissiveIntensity: 0.9 });
    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    this.group.add(ring);

    // Outline ink untuk kesan stylized.
    addOutline(this.group, 1.08, '#241a10');
  }

  hop(fromPos: Vector3, toPos: Vector3, duration = 340, done?: () => void): void {
    this.group.position.copy(fromPos);
    const peak = fromPos.clone().lerp(toPos, 0.5);
    peak.y = Math.max(fromPos.y, toPos.y) + 0.75;

    tween({
      duration,
      ease: Ease.inOutCubic,
      onUpdate: (t) => {
        if (t < 0.5) {
          const k = t * 2;
          this.group.position.copy(fromPos).lerp(peak, Ease.outCubic(k));
        } else {
          const k = (t - 0.5) * 2;
          this.group.position.copy(peak).lerp(toPos, Ease.outCubic(k));
        }
        const squash = t > 0.82 ? 1 - (t - 0.82) * 2.4 : 1;
        const stretch = t < 0.2 ? 1 + (0.2 - t) * 0.7 : 1;
        this.body.scale.set(
          1 / stretch + (1 - squash) * 0.4,
          squash * stretch,
          1 / stretch + (1 - squash) * 0.4,
        );
      },
      onDone: () => {
        this.body.scale.set(1, 1, 1);
        done?.();
      },
    });
  }

  place(at: Vector3): void {
    this.group.position.copy(at);
    this.body.scale.set(1, 1, 1);
  }
}
