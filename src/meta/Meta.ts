/**
 * Meta-progresi: mata uang permanen (shard), upgrade, dan statistik.
 * Disimpan di localStorage, dipakai antar run.
 */
export type UpgradeId = 'vitality' | 'sharp' | 'lucky' | 'hoarder';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  icon: string;
  maxLevel: number;
  cost: (level: number) => number;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  vitality: { id: 'vitality', name: 'Vitalitas', desc: '+10 HP maksimum tiap level.', icon: 'heart', maxLevel: 5, cost: (l) => [30, 60, 100, 160, 250][l] ?? 9999 },
  sharp: { id: 'sharp', name: 'Dadu Tajam', desc: '+1 damage serangan tiap level.', icon: 'sword', maxLevel: 5, cost: (l) => [40, 80, 140, 220, 320][l] ?? 9999 },
  lucky: { id: 'lucky', name: 'Keberuntungan', desc: '+1 nilai dadu tiap level.', icon: 'clover', maxLevel: 3, cost: (l) => [50, 110, 200][l] ?? 9999 },
  hoarder: { id: 'hoarder', name: 'Serakah', desc: '+15% emas tiap level.', icon: 'coin', maxLevel: 3, cost: (l) => [40, 90, 170][l] ?? 9999 },
};

export interface MetaState {
  shards: number;
  upgrades: Record<UpgradeId, number>;
  bestFloor: number;
  bestGold: number;
  totalRuns: number;
  totalKills: number;
  totalGold: number;
  wins: number;
}

const KEY = 'dd.meta.v1';

export function defaultMeta(): MetaState {
  return {
    shards: 0,
    upgrades: { vitality: 0, sharp: 0, lucky: 0, hoarder: 0 },
    bestFloor: 0,
    bestGold: 0,
    totalRuns: 0,
    totalKills: 0,
    totalGold: 0,
    wins: 0,
  };
}

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    return { ...defaultMeta(), ...parsed, upgrades: { ...defaultMeta().upgrades, ...(parsed.upgrades ?? {}) } };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    // localStorage penuh/ditolak: abaikan.
  }
}

export function upgradeLevel(meta: MetaState, id: UpgradeId): number {
  return meta.upgrades[id] ?? 0;
}

export function canAfford(meta: MetaState, id: UpgradeId): boolean {
  const def = UPGRADES[id];
  const lvl = upgradeLevel(meta, id);
  if (lvl >= def.maxLevel) return false;
  return meta.shards >= def.cost(lvl);
}

export function buyUpgrade(meta: MetaState, id: UpgradeId): boolean {
  if (!canAfford(meta, id)) return false;
  const def = UPGRADES[id];
  const lvl = upgradeLevel(meta, id);
  meta.shards -= def.cost(lvl);
  meta.upgrades[id] = lvl + 1;
  saveMeta(meta);
  return true;
}

/** Bonus run dari meta. */
export interface RunBonuses {
  maxHp: number;
  damage: number;
  diceBonus: number;
  goldMultiplier: number;
}

export function runBonuses(meta: MetaState): RunBonuses {
  return {
    maxHp: 30 + upgradeLevel(meta, 'vitality') * 10,
    damage: upgradeLevel(meta, 'sharp'),
    diceBonus: upgradeLevel(meta, 'lucky'),
    goldMultiplier: 1 + upgradeLevel(meta, 'hoarder') * 0.15,
  };
}

/** Konversi hasil run menjadi shard permanen. */
export function runRewards(floor: number, gold: number, kills: number, won: boolean): number {
  const base = 5 + floor * 4 + kills * 2;
  const goldBonus = Math.floor(gold / 20);
  const winBonus = won ? 15 : 0;
  return base + goldBonus + winBonus;
}

