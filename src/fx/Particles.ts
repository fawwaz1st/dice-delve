import { Points, BufferGeometry, PointsMaterial, BufferAttribute, AdditiveBlending, Vector3, Color } from 'three/webgpu';

/**
 * Sistem partikel ringan: satu Points dengan pool, burst berwarna.
 * Digerakkan update(dt) yang dipanggil dari loop.
 */
const MAX = 600;

interface Particle {
  alive: boolean;
  life: number;
  maxLife: number;
  vx: number; vy: number; vz: number;
  color: Color;
  size: number;
  gravity: number;
}

export class Particles {
  readonly points: Points;
  private readonly particles: Particle[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private readonly geo: BufferGeometry;
  private cursor = 0;

  constructor() {
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new BufferAttribute(this.colors, 3));
    const mat = new PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new Points(this.geo, mat);
    this.points.frustumCulled = false;
    for (let i = 0; i < MAX; i += 1) {
      this.particles.push({ alive: false, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, color: new Color(), size: 1, gravity: -3 });
      this.positions[i * 3 + 1] = -100;
    }
    this.geo.setDrawRange(0, MAX);
  }

  /** Ledakan partikel di posisi tertentu. */
  burst(at: Vector3, opts: { count?: number; color?: string; speed?: number; up?: number; life?: number; gravity?: number } = {}): void {
    const count = opts.count ?? 24;
    const baseColor = opts.color ?? '#ffb000';
    const speed = opts.speed ?? 3;
    const up = opts.up ?? 2.5;
    const life = opts.life ?? 0.7;
    const gravity = opts.gravity ?? -3;
    for (let i = 0; i < count; i += 1) {
      const p = this.particles[this.cursor];
      if (!p) continue;
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      p.alive = true;
      p.life = life * (0.6 + Math.random() * 0.7);
      p.maxLife = p.life;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      p.vx = Math.cos(a) * r;
      p.vy = up * (0.5 + Math.random() * 0.8);
      p.vz = Math.sin(a) * r;
      p.gravity = gravity;
      p.color.set(baseColor).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
      this.positions[idx * 3] = at.x;
      this.positions[idx * 3 + 1] = at.y;
      this.positions[idx * 3 + 2] = at.z;
      this.colors[idx * 3] = p.color.r;
      this.colors[idx * 3 + 1] = p.color.g;
      this.colors[idx * 3 + 2] = p.color.b;
    }
  }

  /** Konsumsi partikel ambient (melayang pelan). */
  motes(at: Vector3, count = 8): void {
    this.burst(at, { count, color: '#8f6bff', speed: 0.6, up: 0.8, life: 1.6, gravity: 0.3 });
  }

  update(dt: number): void {
    const pos = this.positions;
    const col = this.colors;
    let anyAlive = false;
    for (let i = 0; i < MAX; i += 1) {
      const p = this.particles[i];
      if (!p || !p.alive) {
        pos[i * 3 + 1] = -100;
        continue;
      }
      anyAlive = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        pos[i * 3 + 1] = -100;
        continue;
      }
      p.vy += p.gravity * dt;
      pos[i * 3] = (pos[i * 3] ?? 0) + p.vx * dt;
      pos[i * 3 + 1] = (pos[i * 3 + 1] ?? 0) + p.vy * dt;
      pos[i * 3 + 2] = (pos[i * 3 + 2] ?? 0) + p.vz * dt;
      const fade = p.life / p.maxLife;
      col[i * 3] = p.color.r * fade;
      col[i * 3 + 1] = p.color.g * fade;
      col[i * 3 + 2] = p.color.b * fade;
    }
    if (anyAlive) {
      const posAttr = this.geo.attributes.position;
      const colAttr = this.geo.attributes.color;
      if (posAttr) posAttr.needsUpdate = true;
      if (colAttr) colAttr.needsUpdate = true;
    }
  }
}

