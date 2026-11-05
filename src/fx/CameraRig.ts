import { PerspectiveCamera, Vector3 } from 'three/webgpu';

/**
 * Kamera mengikuti target dengan pelonggaran halus + guncangan
 * arah Perlin-like (trauma decay) dan mode fokus combat.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  private readonly baseOffset = new Vector3(0, 9.5, 13.5);
  private target = new Vector3(0, 0.6, -1);
  private currentLook = new Vector3(0, 0.6, -1);
  private trauma = 0;
  private focusDistance = 1.0;
  private focusTarget = 1.0;

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  /** Target kamera (posisi pion). */
  follow(world: Vector3): void {
    this.target.set(world.x * 0.35, 0.6, world.z * 0.35);
  }

  /** Perbesar dekat saat combat (1 = normal, 0.6 = dekat). */
  setFocus(zoom: number): void {
    this.focusTarget = zoom;
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    // Pelonggaran halus menuju target.
    this.currentLook.lerp(this.target, Math.min(1, dt * 3.5));
    this.focusDistance += (this.focusTarget - this.focusDistance) * Math.min(1, dt * 4);

    const d = this.baseOffset.clone().multiplyScalar(this.focusDistance);
    // Offset relatif terhadap target (agar selalu dari arah yang sama).
    const desired = new Vector3(this.currentLook.x, d.y, this.currentLook.z + d.z);
    this.camera.position.lerp(desired, Math.min(1, dt * 5));

    // Guncangan: trauma decays, offset Perlin-like.
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    if (this.trauma > 0) {
      const t = performance.now() * 0.03;
      const shake = this.trauma * this.trauma * 0.35;
      this.camera.position.x += Math.sin(t * 1.7) * shake;
      this.camera.position.y += Math.sin(t * 2.3 + 1.3) * shake * 0.7;
      this.camera.position.z += Math.cos(t * 1.9) * shake;
    }
    this.camera.lookAt(this.currentLook);
  }
}

