export type CardId = 'ember' | 'stone' | 'feather' | 'clover' | 'eye' | 'spark' | 'surge' | 'magnet' | 'bulwark' | 'grave';

export interface CardDef {
  id: CardId;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare';
  desc: string;
  icon: string;
  /** Modifikasi saat melempar dadu. */
  modifyRoll?: (roll: number, ctx: { turn: number }) => number;
  /** Bonus damage saat combat. */
  damageBonus?: number;
  /** HP pulih tiap giliran. */
  regen?: number;
  /** Peluang menggandakan hasil dadu. */
  doubleChance?: number;
  /** Peluang menghindar. */
  dodge?: number;
  /** Pengali emas (digabung dengan meta). */
  goldMul?: number;
  /** Kurangi damage masuk. */
  damageReduction?: number;
  /** HP pulih saat membunuh monster. */
  healOnKill?: number;
  /** Kemampuan aktif yang bisa dipakai pemain (dengan cooldown giliran). */
  active?: { name: string; desc: string; cooldown: number; kind: 'damage' | 'heal' | 'skip' | 'fixroll'; amount: number };
}

export const CARDS: Record<CardId, CardDef> = {
  ember: {
    id: 'ember', name: 'Bara Api', rarity: 'common', icon: 'flame',
    desc: '+1 damage untuk setiap serangan.', damageBonus: 1,
    active: { name: 'Ledakan', desc: '8 damage ke monster.', cooldown: 3, kind: 'damage', amount: 8 },
  },
  stone: {
    id: 'stone', name: 'Batu Karat', rarity: 'common', icon: 'shield',
    desc: 'Kurangi 1 damage yang kamu terima.', damageReduction: 1,
  },
  feather: {
    id: 'feather', name: 'Bulu Angin', rarity: 'uncommon', icon: 'wind',
    desc: '25% peluang mengulang dadu sekali.', doubleChance: 0.25,
    active: { name: 'Sapuan', desc: '5 damage, lalu hindari serangan berikutnya.', cooldown: 3, kind: 'damage', amount: 5 },
  },
  clover: {
    id: 'clover', name: 'Semanggi', rarity: 'common', icon: 'clover',
    desc: 'Pulihkan 2 HP tiap giliran.', regen: 2,
  },
  eye: {
    id: 'eye', name: 'Mata Ketiga', rarity: 'rare', icon: 'eye',
    desc: '15% peluang menghindar dari serangan.', dodge: 0.15,
    active: { name: 'Tatapan', desc: 'Monster melewati serangan berikutnya.', cooldown: 4, kind: 'skip', amount: 1 },
  },
  spark: {
    id: 'spark', name: 'Pijar', rarity: 'rare', icon: 'spark',
    desc: 'Dadu minimum 4.', modifyRoll: (r) => Math.max(r, 4),
    active: { name: 'Terjang', desc: 'Dadu berikutnya menjadi 6.', cooldown: 3, kind: 'fixroll', amount: 6 },
  },
  surge: {
    id: 'surge', name: 'Gelombang', rarity: 'rare', icon: 'wave',
    desc: '+2 damage serangan.', damageBonus: 2,
  },
  magnet: {
    id: 'magnet', name: 'Magnet Emas', rarity: 'uncommon', icon: 'magnet',
    desc: '+25% emas dari semua sumber.', goldMul: 1.25,
  },
  bulwark: {
    id: 'bulwark', name: 'Benteng', rarity: 'uncommon', icon: 'wall',
    desc: 'Kurangi 1 damage yang diterima.', damageReduction: 1,
  },
  grave: {
    id: 'grave', name: 'Pusaka', rarity: 'rare', icon: 'tomb',
    desc: 'Pulihkan 4 HP saat membunuh monster.', healOnKill: 4,
  },
};

export const CARD_POOL: CardId[] = ['ember', 'stone', 'clover', 'feather', 'eye', 'spark', 'surge', 'magnet', 'bulwark', 'grave'];

export function rollCard(rng: () => number): CardId {
  // Bobot: common 60%, uncommon 28%, rare 12%.
  const r = rng();
  const rarity = r < 0.6 ? 'common' : r < 0.88 ? 'uncommon' : 'rare';
  const pool = CARD_POOL.filter((id) => CARDS[id].rarity === rarity);
  const pick = pool[Math.floor(rng() * pool.length)];
  return pick ?? 'ember';
}
