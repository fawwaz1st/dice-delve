export type CardId = 'ember' | 'stone' | 'feather' | 'clover' | 'eye' | 'spark';

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
  /** HP pulih saat damage diterima. */
  thorns?: number;
  /** HP pulih tiap giliran. */
  regen?: number;
  /** Peluang menggandakan hasil dadu. */
  doubleChance?: number;
  /** Peluang menghindar. */
  dodge?: number;
}

export const CARDS: Record<CardId, CardDef> = {
  ember: {
    id: 'ember', name: 'Bara Api', rarity: 'common', icon: 'flame',
    desc: 'Dadu +1 tiap giliran.', damageBonus: 1,
  },
  stone: {
    id: 'stone', name: 'Batu Karat', rarity: 'common', icon: 'shield',
    desc: 'Kurangi 1 damage yang kamu terima.', thorns: 0,
  },
  feather: {
    id: 'feather', name: 'Bulu Angin', rarity: 'uncommon', icon: 'wind',
    desc: '25% peluang melempar dadu dua kali.', doubleChance: 0.25,
  },
  clover: {
    id: 'clover', name: 'Semanggi', rarity: 'common', icon: 'clover',
    desc: 'Pulihkan 2 HP tiap giliran.', regen: 2,
  },
  eye: {
    id: 'eye', name: 'Mata Ketiga', rarity: 'rare', icon: 'eye',
    desc: '15% peluang menghindar dari serangan.', dodge: 0.15,
  },
  spark: {
    id: 'spark', name: 'Pijar', rarity: 'rare', icon: 'spark',
    desc: 'Dadu minimum 4.', modifyRoll: (r) => Math.max(r, 4),
  },
};

export const CARD_POOL: CardId[] = ['ember', 'stone', 'clover', 'feather', 'eye', 'spark'];

export function rollCard(rng: () => number): CardId {
  // Bobot: common 60%, uncommon 28%, rare 12%.
  const r = rng();
  const rarity = r < 0.6 ? 'common' : r < 0.88 ? 'uncommon' : 'rare';
  const pool = CARD_POOL.filter((id) => CARDS[id].rarity === rarity);
  const pick = pool[Math.floor(rng() * pool.length)];
  return pick ?? 'ember';
}
