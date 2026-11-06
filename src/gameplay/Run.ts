import { generateTiles, todaySeed, type TileType } from './Board.js';
import { CARDS, rollCard, type CardId } from './Cards.js';

export type Monster_behavior = 'aggressive' | 'guardian' | 'sly';
export interface MonsterBehavior { name: string; hpBonus: number; atkBonus: number; defBonus: number; dodge: number; }

export type MonsterIntent = 'normal' | 'heavy' | 'shield' | 'dodge' | 'enrage';
export interface MonsterState {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  behavior: Monster_behavior;
  intent: MonsterIntent;
  /** Ronde sejak spawn (untuk pola). */
rounds: number;
  phase: 1 | 2 | 3;
}

export interface RunState {
  cooldowns: Partial<Record<CardId, number>>;
  skipNextMonster: boolean;
  fixedRollNext: boolean;
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
      cooldowns: {},
      skipNextMonster: false,
      fixedRollNext: false,
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

  /* ---- Skill aktif ---- */

  /** Kartu yang memilih skill aktif yang siap dipakai. */
  readySkills(): CardId[] {
    return this.state.cards.filter((id) => {
      const c = CARDS[id];
      return c && c.active && (this.state.cooldowns[id] ?? 0) <= 0;
    });
  }

  canUseSkill(id: CardId): boolean {
    const c = CARDS[id];
    return !!c && !!c.active && (this.state.cooldowns[id] ?? 0) <= 0 && this.state.status !== 'dead';
  }

  /** Pakai skill: mengembalikan deskripsi efek untuk UI/log. */
  useSkill(id: CardId): { ok: boolean; message: string; kind: 'damage' | 'skip' | 'heal' | 'fixroll' | 'none'; amount: number } {
    const c = CARDS[id];
    if (!c || !c.active || !this.canUseSkill(id)) return { ok: false, message: 'Skill belum siap.', kind: 'none', amount: 0 };
    this.state.cooldowns[id] = c.active.cooldown;
    const amt = c.active.amount;
    if (c.active.kind === 'damage' && this.state.monster) {
      this.state.monster.hp = Math.max(0, this.state.monster.hp - amt);
      return { ok: true, message: c.active.name + ': ' + amt + ' damage ke ' + this.state.monster.name + '.', kind: 'damage', amount: amt };
    }
    if (c.active.kind === 'skip') {
      this.state.skipNextMonster = true;
      return { ok: true, message: c.active.name + ': monster melewati serangan.', kind: 'skip', amount: amt };
    }
    if (c.active.kind === 'fixroll') {
      this.state.fixedRollNext = true;
      return { ok: true, message: c.active.name + ': dadu berikutnya 6.', kind: 'fixroll', amount: amt };
    }
    return { ok: false, message: 'Skill tidak berlaku di sini.', kind: 'none', amount: 0 };
  }

  /* ---- Giliran ---- */

  beginRoll(): void {
    this.state.status = 'rolling';
    this.state.turn += 1;
    for (const id of Object.keys(this.state.cooldowns) as CardId[]) {
      const v = this.state.cooldowns[id] ?? 0;
      if (v > 0) this.state.cooldowns[id] = v - 1;
    }
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
    const behaviors: Monster_behavior[] = ['aggressive', 'guardian', 'sly'];
    // Boss berotasi deterministik per lantai (terbaca), monster biasa acak.
    const behavior = tier === 'boss'
      ? behaviors[(floor - 1) % 3]!
      : behaviors[Math.floor(Math.random() * 3)]!;
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
intent: 'normal',
      phase: 1,
      rounds: 0,
    };
  }

  /** Satu ronde combat dengan pilihan aksi. */
  combatRound(roll: number, action: 'attack' | 'defend' | 'flee' = 'attack'): { playerWins: boolean; playerDamage: number; monsterDamage: number; them: string; fled: boolean } {
    const m = this.state.monster;
    if (!m) return { playerWins: false, playerDamage: 0, monsterDamage: 0, them: 'tidak ada', fled: false };
    m.rounds += 1;
    // Tentukan serangan monster ronde ini berdasar perilaku (telegraphable).
    const frac = m.hp / m.maxHp;
    m.phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    m.intent = m.phase === 3 && m.behavior === 'aggressive' ? 'enrage'
      : m.behavior === 'aggressive' ? (m.rounds % 3 === 0 ? 'heavy' : 'normal')
      : m.behavior === 'guardian' ? (m.rounds % 3 === 0 ? 'shield' : 'normal')
      : (m.rounds % 3 === 0 ? 'dodge' : 'normal');

    // Kabur: lempar koin untuk mundur 1 petak; gagal = serangan penuh.
    if (action === 'flee') {
      if (Math.random() < 0.5) {
        this.state.position = Math.max(0, this.state.position - 1);
        return { playerWins: false, playerDamage: 0, monsterDamage: 0, them: 'kabur', fled: true };
      }
      // gagal kabur: monster menyerang penuh.
    }
    let rollValue = roll;
    if (this.state.fixedRollNext) { rollValue = 6; this.state.fixedRollNext = false; }
    const { value } = this.applyCardRoll(rollValue);
    const bonus = this.diceBonus() + (this.state.bonusDamage ?? 0);
    // Licik menghindari lagi saat bertahan juga tidak terlalu kuat.
    const dodged = m.behavior === 'sly' && Math.random() < 0.2;
    let dealtBase = dodged ? 0 : (value + bonus >= m.def ? value + bonus : 0);
    // Bertahan: damage setengah (aman tapi lambat).
    const dealt = action === 'defend' ? Math.floor(dealtBase / 2) : dealtBase;
    m.hp = Math.max(0, m.hp - dealt);

    let taken = 0;
    if (m.hp > 0) {
      if (this.state.skipNextMonster) {
        this.state.skipNextMonster = false;
        taken = 0;
      } else if (m.intent === 'dodge') {
        taken = 0;
      } else if (Math.random() < this.dodgeChance()) {
        taken = 0;
      } else {
        taken = Math.max(0, m.atk - this.cardDamageReduction());
        if (m.intent === 'heavy') taken = Math.floor(taken * 1.6);
        if (m.intent === 'enrage') taken = Math.floor(taken * 2.2);
        if (m.intent === 'shield') taken = Math.floor(taken * 0.3);
        if (action === 'defend') taken = Math.floor(taken / 2);
      }
      this.state.hp = Math.max(0, this.state.hp - taken);
    }

    let them = 'tidak ada';
    if (m.hp <= 0) {
      this.state.kills += 1;
      them = 'menang';
      return { playerWins: true, playerDamage: dealt, monsterDamage: taken, them, fled: false };
    }
    if (this.state.hp <= 0) {
      them = 'kalah';
      return { playerWins: false, playerDamage: dealt, monsterDamage: taken, them, fled: false };
    }
    return { playerWins: false, playerDamage: dealt, monsterDamage: taken, them: 'bertahan', fled: false };
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

  /** Peristiwa risiko/hadiah: hasil bergantung pilihan risiko pemain. */
  resolveChoiceEvent(rng: () => number, choice: 'safe' | 'risky' = 'safe'): { kind: 'blessing' | 'curse' | 'jackpot' | 'blood' | 'wisdom'; text: string; hp: number; gold: number; card?: CardId } {
    // Pilihan 'risky' menggeser peluang ke jackpot/kutuk/darah.
    const r01 = rng();
    if (choice === 'risky') {
      if (r01 < 0.34) {
        const gold = Math.round((30 + Math.floor(rng() * 40)) * (this.state.goldMul ?? 1) * this.cardGoldMul());
        this.state.gold += gold;
        return { kind: 'jackpot', text: 'Risiko membayar: +' + gold + ' emas', hp: 0, gold };
      }
      if (r01 < 0.66) {
        const dmg = 6 + Math.floor(rng() * 6);
        this.state.hp = Math.max(0, this.state.hp - dmg);
        return { kind: 'curse', text: 'Risiko gagal: -' + dmg + ' HP', hp: -dmg, gold: 0 };
      }
      const card = rollCard(rng);
      this.state.cards.push(card);
      return { kind: 'wisdom', text: 'Risiko berharga: kartu ' + CARDS[card].name, hp: 0, gold: 0, card };
    }
    if (r01 < 0.30) {
      this.heal(8);
      return { kind: 'blessing', text: 'Berkah: +8 HP', hp: 8, gold: 0 };
    }
    if (r01 < 0.55) {
      const dmg = 5 + Math.floor(rng() * 5);
      this.state.hp = Math.max(0, this.state.hp - dmg);
      return { kind: 'curse', text: 'Kutuk: -' + dmg + ' HP', hp: -dmg, gold: 0 };
    }
    if (r01 < 0.80) {
      const gold = Math.round((25 + Math.floor(rng() * 30)) * (this.state.goldMul ?? 1) * this.cardGoldMul());
      this.state.gold += gold;
      return { kind: 'jackpot', text: 'Jackpot: +' + gold + ' emas', hp: 0, gold };
    }
    if (r01 < 0.92) {
      const card = rollCard(rng);
      this.state.cards.push(card);
      return { kind: 'wisdom', text: 'Wisaya: kartu ' + CARDS[card].name, hp: 0, gold: 0, card };
    }
    const cost = Math.min(this.state.hp - 1, 4);
    if (cost > 0) {
      this.state.hp -= cost;
      const gold = Math.round(35 * (this.state.goldMul ?? 1) * this.cardGoldMul());
      this.state.gold += gold;
      return { kind: 'blood', text: 'Darah ditukar emas: -' + cost + ' HP, +' + gold + ' emas', hp: -cost, gold };
    }
    this.heal(4);
    return { kind: 'blessing', text: 'Berkah kecil: +4 HP', hp: 4, gold: 0 };
  }

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
