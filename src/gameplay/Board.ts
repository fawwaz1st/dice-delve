import { Group, Mesh, BoxGeometry, SphereGeometry, MeshStandardMaterial, Color, Vector3 } from 'three/webgpu';
import { toonMaterial } from '../render/Materials.js';

export type TileType = 'start' | 'monster' | 'elite' | 'treasure' | 'trap' | 'shop' | 'rest' | 'boss';

export interface Tile {
  index: number;
  gx: number;
  gz: number;
  type: TileType;
  mesh: Mesh;
}

const TILE_STYLE: Record<TileType, { color: string; emissive?: string; emissiveIntensity?: number }> = {
  start: { color: '#3a2d20', emissive: '#ffb000', emissiveIntensity: 0.25 },
  monster: { color: '#4a2430', emissive: '#ff3b5c', emissiveIntensity: 0.12 },
  elite: { color: '#4a1f3a', emissive: '#8f6bff', emissiveIntensity: 0.18 },
  treasure: { color: '#3a3320', emissive: '#ffb000', emissiveIntensity: 0.2 },
  trap: { color: '#3a2a2a', emissive: '#ff6a2a', emissiveIntensity: 0.12 },
  shop: { color: '#2a3340', emissive: '#6f8cff', emissiveIntensity: 0.15 },
  rest: { color: '#243028', emissive: '#7ddc3f', emissiveIntensity: 0.15 },
  boss: { color: '#401a1a', emissive: '#ff3b5c', emissiveIntensity: 0.35 },
};

const TILE_SIZE = 1.9;

/** RNG deterministik (xorshift) supaya seed harian bisa dibagikan. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
}

export function todaySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Hasilkan jalur papan via DFS dengan backtracking: dijamin panjang target
 * selama masih ada ruang (tidak buntu di tengah).
 */
export function generateTiles(seed: number, length = 34): Array<{ gx: number; gz: number; type: TileType }> {
  const rng = makeRng(seed);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  };

  // Coba beberapa kali dengan arah awal berbeda sampai cukup panjang.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const path: Array<{ gx: number; gz: number; type: TileType }> = [];
    const occupied = new Set<string>();
    const key = (x: number, z: number) => x + ',' + z;

    const walk = (x: number, z: number): boolean => {
      path.push({ gx: x, gz: z, type: 'monster' });
      occupied.add(key(x, z));
      if (path.length >= length) return true;
      const options: Array<readonly [number, number]> = shuffle(
        DIRS.filter(([dx, dz]) => {
          const nx = x + dx;
          const nz = z + dz;
          return nx >= 0 && nx <= 9 && nz >= 0 && nz <= 9 && !occupied.has(key(nx, nz));
        }),
      );
      for (const [dx, dz] of options) {
        if (walk(x + dx, z + dz)) return true;
      }
      path.pop();
      occupied.delete(key(x, z));
      return false;
    };

    if (walk(0, 0)) {
      return assignTypes(path, rng);
    }
  }

  // Cadangan: jalur zig-zag penuh (jarang tercapai).
  return zigzag(length);
}

function assignTypes(path: Array<{ gx: number; gz: number; type: TileType }>, rng: () => number): Array<{ gx: number; gz: number; type: TileType }> {
  const weights: Array<[TileType, number]> = [
    ['monster', 0.34], ['treasure', 0.18], ['trap', 0.12],
    ['shop', 0.08], ['rest', 0.08], ['elite', 0.08],
  ];
  const pickType = (): TileType => {
    let r = rng();
    for (const [type, w] of weights) {
      r -= w;
      if (r <= 0) return type;
    }
    return 'monster';
  };
  path[0]!.type = 'start';
  for (let i = 1; i < path.length; i += 1) {
    path[i]!.type = i === path.length - 1 ? 'boss' : pickType();
  }
  return path;
}

function zigzag(length: number): Array<{ gx: number; gz: number; type: TileType }> {
  const path: Array<{ gx: number; gz: number; type: TileType }> = [];
  for (let z = 0; z < 10 && path.length < length; z += 1) {
    const xs = z % 2 === 0 ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    for (const x of xs) {
      if (path.length >= length) break;
      path.push({ gx: x, gz: z, type: 'monster' });
    }
  }
  path[0]!.type = 'start';
  path[path.length - 1]!.type = 'boss';
  return path;
}

export class Board {
  readonly group = new Group();
  readonly tiles: Tile[] = [];
  private readonly tileGeo = new BoxGeometry(TILE_SIZE, 0.26, TILE_SIZE);

  constructor(seed: number) {
    const layout = generateTiles(seed);
    layout.forEach((t, index) => {
      const style = TILE_STYLE[t.type];
      const opts: { emissive?: string; emissiveIntensity?: number } = { emissiveIntensity: style.emissiveIntensity ?? 0.15 };
      if (style.emissive) opts.emissive = style.emissive;
      const mat = toonMaterial(style.color, opts);
      const mesh = new Mesh(this.tileGeo, mat);
      mesh.position.copy(this.worldPos(t.gx, t.gz));
      mesh.position.y = 0.13;
      mesh.receiveShadow = true;
      mesh.userData.tileIndex = index;
      this.group.add(mesh);
      this.tiles.push({ index, gx: t.gx, gz: t.gz, type: t.type, mesh });
    });
    this.decorate();
  }

  worldPos(gx: number, gz: number): Vector3 {
    return new Vector3((gx - 4.5) * 2, 0, (gz - 4.5) * 2);
  }

  private decorate(): void {
    const dotGeo = new SphereGeometry(0.11, 8, 6);
    const dotMat = new MeshStandardMaterial({ color: new Color('#ffb000'), emissive: new Color('#ffb000'), emissiveIntensity: 0.5, roughness: 0.4 });
    for (let i = 0; i < this.tiles.length - 1; i += 1) {
      const a = this.tiles[i]!.mesh.position;
      const b = this.tiles[i + 1]!.mesh.position;
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y = 0.3;
      const dot = new Mesh(dotGeo, dotMat);
      dot.position.copy(mid);
      this.group.add(dot);
    }
  }
}

