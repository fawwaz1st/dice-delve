import { DataTexture, RedFormat, NearestFilter, MeshStandardMaterial, MeshBasicMaterial, BackSide, Color, Mesh, Group } from 'three/webgpu';

/** Palet 60/30/10: base gelap desaturated + aksen emissive saturasi tinggi. */
export const PALETTE = {
  bg: '#14110f',
  table: '#2a1f18',
  tableEdge: '#3b2c20',
  board: '#1d1712',
  boardLine: '#4a382a',
  tile: '#33261b',
  tileAlt: '#2a1f16',
  tileEdge: '#6b5233',
  stone: '#4a4440',
  gold: '#ffb000',
  ember: '#ff6a2a',
  arcane: '#8f6bff',
  venom: '#7ddc3f',
  blood: '#ff3b5c',
  bone: '#f3e3c3',
} as const;

let gradient: DataTexture | null = null;

/** Ramp 4 band untuk cel shading (siap dipakai saat kembali ke toon). */
export function getToonGradient(): DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([120, 170, 220, 255]);
  gradient = new DataTexture(data, data.length, 1, RedFormat);
  gradient.minFilter = NearestFilter;
  gradient.magFilter = NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export function toonMaterial(
  color: string,
  opts: { emissive?: string; emissiveIntensity?: number } = {},
): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 0.85,
    metalness: 0.0,
  });
  if (opts.emissive) {
    mat.emissive = new Color(opts.emissive);
    mat.emissiveIntensity = opts.emissiveIntensity ?? 0.6;
  }
  return mat;
}

/**
 * Tambahkan outline (inverted hull) pada mesh anak grup.
 * Memberi kesan ink/stylized yang deliberat, bukan default.
 */
export function addOutline(target: Group | Mesh, scale = 1.06, color = '#17110c'): void {
  const outlineMat = new MeshBasicMaterial({ color: new Color(color), side: BackSide });
  // Kumpulkan mesh target DULU sebelum menambah outline; kalau tidak,
  // traverse akan mengunjungi outline yang baru ditambah dan me-recurse
  // tanpa akhir (maksimal stack).
  const meshes: Mesh[] = [];
  if (target instanceof Mesh) {
    meshes.push(target);
  } else {
    target.traverse((child) => { if (child instanceof Mesh) meshes.push(child); });
  }
  for (const obj of meshes) {
    const outline = new Mesh(obj.geometry, outlineMat);
    outline.scale.setScalar(scale);
    outline.raycast = () => {};
    obj.add(outline);
  }
}
