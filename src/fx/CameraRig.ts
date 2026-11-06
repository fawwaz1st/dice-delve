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
  /** Orbit manual (azimuth) + zoom pemakai; 0 = dari selatan. */
  private azimuth = 0;
  private azimuthTarget = 0;
  private userZoom = 1.0;
  private userZoomTarget = 1.0;
  private slowmo = 1.0;
  private slowmoTarget = 1.0;
  private pitch = 0;
  private pitchTarget = 0;

  constructor(camera: PerspectiveCamera, canvas?: HTMLCanvasElement) {
    this.camera = camera;
    if (canvas) this.bindInput(canvas);
  }

  /** Orbit (drag) dan zoom (roda/pinch) manual. */
  private bindInput(canvas: HTMLCanvasElement): void {
    let dragging = false;
    let lastX = 0;
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      this.azimuthTarget += dx * 0.005;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.userZoomTarget = Math.min(1.8, Math.max(0.6, this.userZoomTarget + Math.sign(e.deltaY) * 0.12));
    }, { passive: false });
    // double click: kembalikan orbit
    canvas.addEventListener('dblclick', () => { this.azimuthTarget = 0; this.userZoomTarget = 1.0; });
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

  /** Slow-motion sinematik (1 = normal, <1 = lambat). */
  setSlowmo(scale: number): void {
    this.slowmoTarget = scale;
  }

  /** Faktor slow-mo aktif (1 = normal, <1 = lambat) untuk update di luar. */
  get slowmoScale(): number {
    return this.slowmo;
  }

  /** Elevasi orbit (radian dari horizontal). */
  setPitch(value: number): void {
    this.pitchTarget = value;
  }

  update(dt: number): void {
    // Pelonggaran halus menuju target.
    this.currentLook.lerp(this.target, Math.min(1, dt * 3.5));
    this.focusDistance += (this.focusTarget - this.focusDistance) * Math.min(1, dt * 4);

    // Azimuth + zoom + pitch + slow-mo (halus).
    this.azimuth += (this.azimuthTarget - this.azimuth) * Math.min(1, dt * 6);
    this.userZoom += (this.userZoomTarget - this.userZoom) * Math.min(1, dt * 6);
    this.pitch += (this.pitchTarget - this.pitch) * Math.min(1, dt * 6);
    this.slowmo += (this.slowmoTarget - this.slowmo) * Math.min(1, dt * 4);
    const dist = Math.hypot(this.baseOffset.x, this.baseOffset.z) * this.focusDistance * this.userZoom;
    const baseY = this.baseOffset.y * this.focusDistance * (0.7 + 0.3 * this.userZoom);
    const az = this.azimuth;
    const pitch = this.pitch;
    const desired = new Vector3(
      this.currentLook.x + Math.sin(az) * dist * Math.cos(pitch),
      this.currentLook.y + baseY + Math.sin(pitch) * dist * 0.4,
      this.currentLook.z + Math.cos(az) * dist * Math.cos(pitch),
    );
    this.camera.position.lerp(desired, Math.min(1, dt * 5 * this.slowmo));

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

