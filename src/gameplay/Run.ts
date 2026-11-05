import { generateTiles, todaySeed, type TileType } from './Board.js';
import { CARDS, rollCard, type CardId } from './Cards.js';

export type Monster_behavior = 'aggressive' | 'guardian' | 'sly';
export interface MonsterBehavior { name: string; hpBonus: number; atkBonus: number; defBonus: number; dodge: number; }

export interface MonsterState {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  behavior: Monster_behavior;
}

export interface RunState {
  seed: number;
  tiles: Array<{ gx: number; gz: number; type: TileType }>;
  position: number;
  hp: number;
  maxHp: number;
  gold: number;
  cards: CardId[];
  turn: number;
  floor: number;
  kills: number;
  status: 'idle' | 'rolling' | 'moving' | 'combat' | 'won' | 'dead';
  monster: MonsterState | null;
  log: string[];
  /** Bonus permanen dari meta-upgrade. */
  bonusDice: number;
  bonusDamage: number;
  goldMul: number;
}

const MONSTER_NAMES = ['Golem Lumut', 'Golem Batu', 'Raksasa Kabut', 'Siluman Bayangan', 'Setan Mara'];
const BOSS_NAMES = ['Penjaga Gerbang', 'Raja Rongga', 'Bertapa Batu'];

export class Run {
  state: RunState;

  constructor() {
    this.state = this.freshState(todaySeed());
  }

  private freshState(seed: number): RunState {
    return {
      seed,
      tiles: generateTiles(seed),
      position: 0,
      hp: 30,
      maxHp: 30,
      gold: 0,
      cards: ['ember'],
      turn: 0,
      floor: 1,
      kills: 0,
      status: 'idle',
      monster: null,
      log: [],
      bonusDice: 0,
      bonusDamage: 0,
      goldMul: 1,
    };
  }

  start(seed?: number): void {
    this.state = this.freshState(seed ?? todaySeed());
  }

  /** Terapkan bonus permanen dari hub (maks HP, damage, dadu, emas). */
  applyMetaBonuses(maxHp: number, damage: number, diceBonus: number, goldMultiplier: number): void {
    const s = this.state;
    s.maxHp = maxHp;
    s.hp = maxHp;
    s.bonusDamage = damage;
    s.bonusDice = diceBonus;
    s.goldMul = goldMultiplier;
  }

  /* ---- Modifikasi dari kartu ---- */

  diceBonus(): number {
    let bonus = this.state.bonusDice ?? 0;
    for (const id of this.state.cards) {
      const c = CARDS[id];
      if (c && c.damageBonus) bonus += c.damageBonus;
    }
    return bonus;
  }

  regenAmount(): number {
    let regen = 0;
    for (const id of this.state.cards) {
      const c = CARDS[id];
      if (c && c.regen) regen += c.regen;
    }
    return regen;
  }

  dodgeChance(): number {
    let chance = 0;
    for (const id of this.state.cards) {
      const c = CARDS[id];
      if (c && c.dodge) chance += c.dodge;
    }
    return Math.min(chance, 0.5);
  }

  /** Terapkan efek kartu pada nilai dadu (di dalam run ini). */
  applyCardRoll(roll: number): { value: number; doubled: boolean } {
    let value = roll;
    let doubled = false;
    for (const id of this.state.cards) {
      const c = CARDS[id];
      if (!c) continue;
      if (c.modifyRoll) value = c.modifyRoll(value, { turn: this.state.turn });
      if (c.doubleChance && Math.random() < c.doubleChance) {
        value = Math.max(value, 1 + Math.floor(Math.random() * 6));
        doubled = true;
      }
    }
    return { value, doubled };
  }

  /* ---- Giliran ---- */

  beginRoll(): void {
    this.state.status = 'rolling';
    this.state.turn += 1;
    const regen = this.regenAmount();
    if (regen > 0 && this.state.hp > 0) {
      this.state.hp = Math.min(this.state.maxHp, this.state.hp + regen);
      this.state.log.push('Semanggi memulihkan ' + regen + ' HP.');
    }
  }

  /** Bergerak maju sejumlah langkah. Mengembalikan petak tujuan. */
  move(steps: number): number {
    const last = this.state.tiles.length - 1;
    this.state.position = Math.min(last, this.state.position + steps);
    this.state.status = 'moving';
    return this.state.position;
  }

  currentTile(): { gx: number; gz: number; type: TileType } | undefined {
    return this.state.tiles[this.state.position];
  }

  isAtBoss(): boolean {
    const t = this.currentTile();
    return t?.type === 'boss';
  }

  isAtEnd(): boolean {
    return this.state.position >= this.state.tiles.length - 1;
  }

  /* ---- Combat ---- */

  makeMonster(tier: 'monster' | 'elite' | 'boss'): MonsterState {
    const floor = this.state.floor;
    const names = tier === 'boss' ? BOSS_NAMES : MONSTER_NAMES;
    const name = names[Math.floor(Math.random() * names.length)]!;
    // Kepribadian: agresif (ATK tinggi), penjaga (DEF/HP tinggi), licik (menghindar).
    const behavior: Monster_behavior = tier === 'boss'
      ? (['aggressive', 'guardian', 'sly'] as Monster_behavior[])[Math.floor(Math.random() * 3)]!
      : (['aggressive', 'guardian', 'sly'] as Monster_behavior[])[Math.floor(Math.random() * 3)]!;
    const b: MonsterBehavior = behavior === 'aggressive'
      ? { name: 'Agresif', hpBonus: -3, atkBonus: 3, defBonus: 0, dodge: 0 }
      : behavior === 'guardian'
      ? { name: 'Penjaga', hpBonus: 5, atkBonus: -1, defBonus: 2, dodge: 0 }
      : { name: 'Licik', hpBonus: 0, atkBonus: 1, defBonus: 0, dodge: 0.2 };
    const base = tier === 'boss' ? 22 : tier === 'elite' ? 13 : 8;
    const hp = Math.max(4, base + floor * 4 + b.hpBonus);
    const atkBase = Math.floor(4 + floor * 1 + (tier === 'elite' ? 2 : tier === 'boss' ? 4 : 0));
    return {
      name,
      hp,
      maxHp: hp,
      atk: Math.max(1, atkBase + b.atkBonus),
      def: Math.max(0, (tier === 'boss' ? 4 : tier === 'elite' ? 2 : 0) + b.defBonus),
      behavior,
    };
  }

  /** Satu ronde combat. Mengembalikan hasil. */
  combatRound(roll: number): { playerWins: boolean; playerDamage: number; monsterDamage: number; them: string } {
    const m = this.state.monster;
    if (!m) return { playerWins: false, playerDamage: 0, monsterDamage: 0, them: 'tidak ada' };
    const { value } = this.applyCardRoll(roll);
    const bonus = this.diceBonus() + (this.state.bonusDamage ?? 0);
    // Licik: peluang menghindar dari serangan.
    const dodged = m.behavior === 'sly' && Math.random() < 0.2;
    const dealt = dodged ? 0 : (value + bonus >= m.def ? value + bonus : 0);
    m.hp = Math.max(0, m.hp - dealt);

    let taken = 0;
    if (m.hp > 0) {
      if (Math.random() < this.dodgeChance()) {
        taken = 0;
      } else {
        taken = Math.max(0, m.atk - this.cardDamageReduction());
      }
      this.state.hp = Math.max(0, this.state.hp - taken);
    }

    let them = 'tidak ada';
    if (m.hp <= 0) {
      this.state.kills += 1;
      them = 'menang';
      return { playerWins: true, playerDamage: dealt, monsterDamage: taken, them };
    }
    if (this.state.hp <= 0) {
      them = 'kalah';
      return { playerWins: false, playerDamage: dealt, monsterDamage: taken, them };
    }
    return { playerWins: false, playerDamage: dealt, monsterDamage: taken, them: 'bertahan' };
  }

  cardGoldMul(): number {
    let mul = 1;
    for (const id of this.state.cards) {
      const c = CARDS[id];
      if (c && c.goldMul) mul *= c.goldMul;
    }
    return mul;
  }

  cardDamageReduction(): number {
    let r = 0;
    for (const id of this.state.cards) {
      const c = CARDS[id];
      if (c && c.damageReduction) r += c.damageReduction;
    }
    return r;
  }

  cardHealOnKill(): number {
    let h = 0;
    for (const id of this.state.cards) {
      const c = CARDS[id];
      if (c && c.healOnKill) h += c.healOnKill;
    }
    return h;
  }

  onMonsterDefeated(tier: 'monster' | 'elite' | 'boss'): void {
    const gold = Math.round((tier === 'boss' ? 60 + this.state.floor * 10 : tier === 'elite' ? 30 : 15) * (this.state.goldMul ?? 1) * this.cardGoldMul());
    const heal = this.cardHealOnKill();
    if (heal > 0) this.heal(heal);
    if (heal > 0) this.state.log.push('Pusaka memulihkan ' + heal + ' HP.');
    this.state.gold += gold;
    this.state.monster = null;
    this.state.log.push('Mengalahkan ' + (tier === 'boss' ? 'bos' : 'monster') + ': +' + gold + ' emas.');
  }

  /* ---- Petak non-combat ---- */

  resolveTreasure(rng: () => number): { gold: number; card?: CardId } {
    const gold = Math.round((10 + Math.floor(rng() * 20)) * (this.state.goldMul ?? 1) * this.cardGoldMul());
    this.state.gold += gold;
    const result: { gold: number; card?: CardId } = { gold };
    if (rng() < 0.5) {
      const card = rollCard(rng);
      this.state.cards.push(card);
      result.card = card;
    }
    return result;
  }

  resolveTrap(rng: () => number): number {
    const dmg = 4 + Math.floor(rng() * 4);
    this.state.hp = Math.max(0, this.state.hp - dmg);
    return dmg;
  }

  resolveShop(rng: () => number): CardId | null {
    // Belanja sederhana: kartu termurah yang belum dimiliki.
    const owned = new Set<CardId>(this.state.cards);
    const pool = (Object.keys(CARDS) as CardId[]).filter((id) => !owned.has(id));
    if (pool.length === 0 || this.state.gold < 25) return null;
    const pick = pool[Math.floor(rng() * pool.length)]!;
    this.state.gold -= 25;
    this.state.cards.push(pick);
    return pick;
  }

  heal(amount: number): void {
    this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
  }

  /** Lanjut ke lantai berikut: papan baru, posisi reset, HP/emas/kartu dipertahankan. */
  nextFloor(): void {
    const s = this.state;
    s.floor += 1;
    s.seed += s.floor * 7919;
    s.tiles = generateTiles(s.seed);
    s.position = 0;
    s.status = 'idle';
    s.monster = null;
    s.log.push('Masuk lantai ' + s.floor + '.');
  }
}
