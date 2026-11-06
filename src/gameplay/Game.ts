import { Group, Mesh, IcosahedronGeometry, Vector3, Color, MeshStandardMaterial } from 'three/webgpu';
import { Board, todaySeed, themeForFloor } from './Board.js';
import { Piece } from './Piece.js';
import { Run } from './Run.js';
import { DiceManager, type Dice } from './Dice.js';
import { toonMaterial, addOutline } from '../render/Materials.js';
import { tween, Ease } from '../utils/tween.js';
import { CARDS, type CardId } from './Cards.js';
import { audio } from '../audio/AudioEngine.js';
import { Particles } from '../fx/Particles.js';
import { DamageNumbers } from '../fx/DamageNumbers.js';
import { CameraRig } from '../fx/CameraRig.js';

type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface GameFX {
  particles: Particles;
  dmg: DamageNumbers;
  cam: CameraRig;
}

export interface GameEvents {
  onState: () => void;
  onToast: (message: string, kind: ToastKind) => void;
  onCombat: (text: string) => void;
}

export class Game {
  readonly board: Board;
  readonly piece: Piece;
  readonly run: Run;
  private readonly dice: DiceManager;
  private die!: Dice;
  readonly tomb: Group;
  private readonly events: GameEvents;
  readonly fx: GameFX;
  busy = false;
  lastRoll = 1;
  pendingDice = 0;
  choosing = false;
  private choiceResolver: ((steps: number) => void) | null = null;
  private eventResolver: ((choice: 'safe' | 'risky') => void) | null = null;

  constructor(dice: DiceManager, board: Board, events: GameEvents, fx: GameFX) {
    this.dice = dice;
    this.board = board;
    this.events = events;
    this.fx = fx;
    this.run = new Run();
    this.piece = new Piece();
    this.tomb = this.spawnTomb();
  }

  /** Warna/skala monster mengikuti kepribadian (agresif merah, penjaga biru, licik ungu). */
  private setMonsterLook(behavior: 'aggressive' | 'guardian' | 'sly', tier: 'monster' | 'elite' | 'boss'): void {
    const body = this.tomb.children[0] as Mesh;
    const bodyMat = body.material as MeshStandardMaterial;
    const color = behavior === 'aggressive' ? '#7a1f2e' : behavior === 'guardian' ? '#1f3a7a' : '#4a2a6a';
    bodyMat.color = new Color(color);
    const scale = behavior === 'aggressive' ? 1.25 : behavior === 'guardian' ? 1.1 : 0.9;
    this.tomb.scale.setScalar(scale);
    void tier;
  }

  private spawnTomb(): Group {
    const g = new Group();
    const eyeMat = toonMaterial('#ff3b5c', { emissive: '#ff3b5c', emissiveIntensity: 1.2 });
    const body = new Mesh(new IcosahedronGeometry(0.55, 0), toonMaterial('#4a2a3a'));
    body.castShadow = true;
    body.position.y = 0.7;
    g.add(body);
    for (const [x, z] of [[-0.16, 0.45], [0.16, 0.45]] as const) {
      const eye = new Mesh(new IcosahedronGeometry(0.09, 0), eyeMat);
      eye.position.set(x, 0.78, z);
      g.add(eye);
    }
    const spikes = new Mesh(new IcosahedronGeometry(0.18, 0), toonMaterial('#2a1a24'));
    spikes.position.y = 1.25;
    g.add(spikes);
    addOutline(g, 1.09, '#170d14');
    g.visible = false;
    return g;
  }

  start(bonuses?: { maxHp: number; damage: number; diceBonus: number; goldMultiplier: number }): void {
    this.run.start(todaySeed());
    if (bonuses) this.run.applyMetaBonuses(bonuses.maxHp, bonuses.damage, bonuses.diceBonus, bonuses.goldMultiplier);
    this.dice.setSeed(this.run.state.seed);
    this.piece.place(this.tileWorld(0));
    const near = this.tileWorld(0).clone();
    near.x += 2.2;
    near.z += 0.5;
    near.y = 3;
    this.die = this.dice.spawn(near);
  }

  /** Bangun ulang papan 3D dari seed run saat ini. */
  rebuildBoard(): Board {
    const newBoard = new Board(this.run.state.seed, themeForFloor(this.run.state.floor));
    if (this.board.group.parent) this.board.group.parent.remove(this.board.group);
    (this as unknown as { board: Board }).board = newBoard;
    return newBoard;
  }

  /** Lanjut ke lantai berikut: papan baru, posisi reset. */
  nextFloor(): Board {
    this.run.nextFloor();
    const newBoard = this.rebuildBoard();
    this.piece.place(this.tileWorld(0));
    return newBoard;
  }

  /** Mulai ulang run dari awal (seed harian). */
  restart(): void {
    this.run.start(todaySeed());
    this.piece.place(this.tileWorld(0));
  }

  restartBoard(bonuses?: { maxHp: number; damage: number; diceBonus: number; goldMultiplier: number }): Board {
    this.run.start(this.run.state.seed);
    if (bonuses) this.run.applyMetaBonuses(bonuses.maxHp, bonuses.damage, bonuses.diceBonus, bonuses.goldMultiplier);
    const newBoard = this.rebuildBoard();
    this.piece.place(this.tileWorld(0));
    this.run.start(this.run.state.seed);
    return newBoard;
  }

  tileWorld(index: number): Vector3 {
    const t = this.board.tiles[index];
    if (!t) return new Vector3();
    return this.board.worldPos(t.gx, t.gz).setY(0.25);
  }

  /** Set posisi: logika dan papan 3D bergerak bersamaan. */
  setPosition(index: number): void {
    this.run.state.position = index;
    this.piece.place(this.tileWorld(index));
  }

  async rollTurn(): Promise<void> {
    if (this.busy) return;
    const st = this.run.state;
    if (st.status === 'won' || st.status === 'dead') return;
    this.busy = true;
    // Tangkap sebelum beginRoll menimpa status menjadi 'rolling'.
    const wasCombat = st.status === 'combat';
    this.run.beginRoll();
    audio.roll();
    this.events.onState();

    if (wasCombat) {
      // Dalam combat: satu ronde per klik (pemain yang menggerakkan).
      await this.doCombatRound();
    } else {
      // Nilai ditentukan dadu; animasi tween menyelesaikan pada muka itu.
      const diceValue = await this.dice.roll(this.die);
      this.lastRoll = diceValue;
      const rolled = this.run.applyCardRoll(diceValue);
      this.events.onCombat('Dadu ' + rolled.value + (rolled.doubled ? ' (ganda!)' : '') + '. Pilih langkah 1-' + rolled.value + '.');
      // PEMAIN MEMILIH langkah (agency) — bukan jalan otomatis.
      const steps = await this.waitForStepChoice(rolled.value);
      await this.movePiece(steps);
      await this.resolveTile();
    }
    this.busy = false;
    this.events.onState();
  }

  /** Peristiwa pilihan: hasil bergantung pilihan risiko pemain. */
  resolveEvent(): Promise<void> {
    const st = this.run.state;
    this.events.onCombat('Peristiwa! Pilih tindakanmu.');
    this.toastAt('Peristiwa terdeteksi. Klik tombol untuk menilai risiko.', 'info');
    this.events.onState();
    return new Promise((resolve) => {
      this.eventResolver = (choice: 'safe' | 'risky') => {
        this.eventResolver = null;
        const res = this.run.resolveChoiceEvent(Math.random, choice);
        const kind = res.kind;
        this.toastAt(res.text, kind === 'curse' || kind === 'blood' ? 'warning' : 'success');
        this.events.onCombat(res.text);
        if (res.gold > 0) {
          const p = this.tileWorld(st.position).setY(0.6);
          this.fx.particles.burst(p, { count: 26, color: '#ffb000', speed: 3, up: 3 });
          this.fx.dmg.spawn(p, res.gold, 'gold');
          audio.coin();
        }
        if (res.hp > 0) {
          const p = this.tileWorld(st.position).setY(0.6);
          this.fx.particles.burst(p, { count: 22, color: '#7ddc3f', speed: 2.5, up: 2.5 });
          this.fx.dmg.spawn(p, res.hp, 'heal');
        }
        if (res.hp < 0) {
          audio.hurt();
          this.fx.cam.addTrauma(0.35);
          this.toastAt('Peristiwa berdampak -' + Math.abs(res.hp) + ' HP.', 'error');
        }
        st.status = 'idle';
        resolve();
      };
    });
  }

  /** Dipanggil tombol UI saat peristiwa. */
  chooseEvent(choice: 'safe' | 'risky'): void {
    if (this.eventResolver) this.eventResolver(choice);
  }

  /** Tunggu pemain memilih langkah 1..maxSteps dengan klik petak. */
  private waitForStepChoice(maxSteps: number): Promise<number> {
    this.pendingDice = maxSteps;
    this.choosing = true;
    this.events.onState();
    return new Promise((resolve) => {
      this.choiceResolver = (steps: number) => {
        this.choiceResolver = null;
        this.choosing = false;
        this.pendingDice = 0;
        resolve(steps);
      };
    });
  }

  /** Dipanggil saat pemain klik petak dalam mode pilih. */
  chooseTile(targetIndex: number): void {
    if (!this.choosing || !this.choiceResolver) return;
    const st = this.run.state;
    const steps = targetIndex - st.position;
    if (steps < 1 || steps > this.pendingDice) return;
    this.choiceResolver(steps);
  }

  private movePiece(steps: number): Promise<void> {
    const st = this.run.state;
    const from = st.position;
    const dest = this.run.move(steps);
    let i = from;
    return new Promise((resolve) => {
      const step = () => {
        if (i >= dest) { resolve(); return; }
        i += 1;
        const fromPos = this.tileWorld(i - 1);
        const toPos = this.tileWorld(i);
        audio.hop();
        this.fx.cam.follow(toPos);
        // Dadu ikut pion (tetap kelihatan) + durasi hop bervariasi.
        const near = toPos.clone();
        near.x += 1.8;
        near.z += 0.4;
        near.y = 3;
        this.die.mesh.position.copy(near);
        const dur = 170 + Math.random() * 200;
        this.piece.hop(fromPos, toPos, dur, step);
      };
      step();
    });
  }

  private async resolveTile(): Promise<void> {
    const st = this.run.state;
    const tile = this.run.currentTile();
    if (!tile) return;
    switch (tile.type) {
      case 'monster':
      case 'elite':
      case 'boss':
        this.enterCombat(tile.type as 'monster' | 'elite' | 'boss');
        return;
      case 'event':
        await this.resolveEvent();
        return;
      case 'treasure': {
        const res = this.run.resolveTreasure(Math.random);
        audio.coin();
        if (res.card) audio.card();
        const p = this.tileWorld(st.position).setY(0.6);
        this.fx.particles.burst(p, { count: 30, color: '#ffb000', speed: 3, up: 3 });
        this.fx.dmg.spawn(p, res.gold, 'gold');
        this.toastAt(res.card ? 'Harta: +' + res.gold + ' emas, kartu ' + CARDS[res.card].name + '!' : 'Harta: +' + res.gold + ' emas.', res.card ? 'success' : 'info');
        break;
      }
      case 'trap': {
        const dmg = this.run.resolveTrap(Math.random);
        audio.hurt();
        const tp = this.tileWorld(st.position).setY(0.6);
        this.fx.particles.burst(tp, { count: 22, color: '#ff6a2a', speed: 3 });
        this.fx.dmg.spawn(tp, dmg, 'hurt');
        this.fx.cam.addTrauma(0.4);
        this.toastAt('Jebakan! Kamu menerima ' + dmg + ' damage.', 'error');
        break;
      }
      case 'shop': {
        const card = this.run.resolveShop(Math.random);
        if (card) audio.card();
        this.toastAt(card ? 'Membeli ' + CARDS[card].name + ' (25 emas).' : 'Tidak ada yang bisa dibeli (butuh 25 emas).', card ? 'info' : 'warning');
        break;
      }
      case 'rest': {
        const before = st.hp;
        this.run.heal(8);
        const healed = st.hp - before;
        const rp = this.tileWorld(st.position).setY(0.6);
        this.fx.particles.burst(rp, { count: 20, color: '#7ddc3f', speed: 1.5, up: 2.5, life: 1.1, gravity: 0.5 });
        if (healed > 0) this.fx.dmg.spawn(rp, healed, 'heal');
        this.toastAt('Istirahat: +8 HP.', 'success');
        break;
      }
      case 'start':
        break;
    }
    if (st.hp <= 0) {
      st.status = 'dead';
      audio.death();
      this.toastAt('Kamu tumbang di petak ' + (st.position + 1) + '. Run selesai.', 'error');
      return;
    }
    if (st.position >= st.tiles.length - 1) {
      st.status = 'won';
      audio.fanfare();
      this.toastAt('Kamu menembus papan! Lanjut ke lantai ' + (st.floor + 1) + '.', 'success');
      return;
    }
    st.status = 'idle';
  }

  /** Pakai skill aktif kartu (dengan FX). */
  async useSkill(id: CardId): Promise<void> {
    if (this.busy) return;
    const res = this.run.useSkill(id);
    if (!res.ok) {
      this.toastAt(res.message, 'warning');
      return;
    }
    this.toastAt(res.message, res.kind === 'damage' ? 'success' : 'info');
    if (res.kind === 'damage' && this.tomb.visible) {
      audio.hit();
      this.flashMonster();
      const mp = this.tomb.position.clone().setY(0.7);
      this.fx.particles.burst(mp, { count: 30, color: '#ff6a2a', speed: 4, up: 2.5 });
      this.fx.dmg.spawn(mp, res.amount, 'player');
      this.events.onCombat(res.message + ' Sisa ' + (this.run.state.monster?.hp ?? 0) + '/' + (this.run.state.monster?.maxHp ?? 0) + '.');
    }
    this.busy = true;
    await this.hitStop(250);
    // Periksa akhir combat (menang dari skill, atau tetap combat).
    await this.checkCombatEnd();
    this.busy = false;
    this.events.onState();
  }

  /** Memasuki combat: monster muncul, pemain yang menggerakkan tiap ronde. */
  enterCombat(tier: 'monster' | 'elite' | 'boss'): void {
    const st = this.run.state;
    const m = this.run.makeMonster(tier);
    this.setMonsterLook(m.behavior, tier);
    st.monster = m;
    st.status = 'combat';
    const here = this.tileWorld(st.position).clone();
    this.tomb.visible = true;
    this.tomb.position.set(here.x + 1.6, 0, here.z);
    this.tomb.rotation.y = -Math.PI / 2;
    this.fx.cam.setFocus(0.62);
    this.fx.cam.follow(here.clone().lerp(new Vector3(here.x + 1.6, 0, here.z), 0.5));
    this.fx.cam.setSlowmo(0.6);
    window.setTimeout(() => this.fx.cam.setSlowmo(1), 600);
    this.fx.particles.motes(new Vector3(here.x + 1.6, 0.8, here.z), 10);
    audio.setIntensity(2);
    const pers = m.behavior === 'aggressive' ? 'Agresif' : m.behavior === 'guardian' ? 'Penjaga' : 'Licik';
    this.toastAt('Menghadapi ' + m.name + ' [' + pers + '] (HP ' + m.maxHp + ', ATK ' + m.atk + ', DEF ' + m.def + ').', 'warning');
  }

  /** Keluar dari combat setelah ada yang menang. */
  private exitCombat(): void {
    this.tomb.visible = false;
    this.fx.cam.setFocus(1.0);
    audio.setIntensity(1);
    this.run.state.monster = null;
  }

  /** Satu ronde combat: attack, defend, atau flee. */
  async doCombatAction(action: 'attack' | 'defend' | 'flee'): Promise<void> {
    if (this.busy) return;
    const st = this.run.state;
    if (st.status !== 'combat') return;
    this.busy = true;
    this.run.beginRoll();
    this.events.onState();
    await this.doCombatRound(action);
    this.busy = false;
    this.events.onState();
  }

  /** Satu ronde combat yang digerakkan oleh klik Lempar. */
  private async doCombatRound(action: 'attack' | 'defend' | 'flee' = 'attack'): Promise<void> {
    const st = this.run.state;
    const m = st.monster;
    if (!m || m.hp <= 0) return;
    const combatValue = await this.dice.roll(this.die);
    this.lastRoll = combatValue;
    const res = this.run.combatRound(combatValue, action);
    if (res.playerDamage > 0) this.fovKick(3);
    if (res.fled) {
      this.exitCombat();
      this.piece.place(this.tileWorld(st.position));
      this.toastAt('Kabur! Mundur ke petak ' + (st.position + 1) + '.', 'info');
      return;
    }
    audio.hit();
    this.flashMonster();
    if (res.playerDamage > 0) {
      const mp = this.tomb.position.clone().setY(0.7);
      this.fx.particles.burst(mp, { count: 26, color: '#ff6a2a', speed: 3.5, up: 2 });
      this.fx.dmg.spawn(mp, res.playerDamage, 'player');
      this.events.onCombat(m.name + ' menerima ' + res.playerDamage + ' damage. Sisa ' + m.hp + '/' + m.maxHp + '.');
    } else {
      this.events.onCombat(m.name + ' menahan serangan (DEF ' + m.def + ').');
    }
    await this.hitStop(120);
    if (m.hp > 0 && res.monsterDamage > 0) {
      audio.hurt();
      this.fx.cam.addTrauma(0.55);
      this.fovKick(6);
      this.fx.dmg.spawn(this.piece.group.position.clone().setY(1.2), res.monsterDamage, 'hurt');
      this.fx.particles.burst(this.piece.group.position.clone().setY(0.7), { count: 14, color: '#ff3b5c', speed: 2 });
      this.fx.cam.addTrauma(0.55);
      this.events.onCombat(m.name + ' menyerang: kamu menerima ' + res.monsterDamage + ' damage.');
      if (m.intent === 'enrage') {
        const body = this.tomb.children[0] as Mesh;
        (body.material as MeshStandardMaterial).emissive = new Color('#ff3b5c');
        (body.material as MeshStandardMaterial).emissiveIntensity = 1.4;
      }
      this.shakePiece();
    }
    await this.hitStop(100);
    await this.checkCombatEnd();
  }

  /** Periksa akhir combat: menang -> keluar, kalah -> dead, else tetap combat. */
  private async checkCombatEnd(): Promise<void> {
    const st = this.run.state;
    const m = st.monster;
    // Slow-mo saat critical (HP monster kritis) atau menang.
    const critical = m && m.hp <= m.maxHp * 0.25;
    this.fx.cam.setSlowmo(critical ? 0.35 : 1);
    if (critical) window.setTimeout(() => this.fx.cam.setSlowmo(1), 800);
    if (m && m.hp <= 0 && st.hp > 0) {
      const tier = (this.run.currentTile()?.type as 'monster' | 'elite' | 'boss') ?? 'monster';
      this.run.onMonsterDefeated(tier);
      const ep = this.tomb.position.clone().setY(0.6);
      this.fx.particles.burst(ep, { count: 40, color: '#8f6bff', speed: 4, up: 4, life: 1.2 });
      this.fx.cam.addTrauma(0.35);
      this.exitCombat();
      if (st.position >= st.tiles.length - 1) {
        st.status = 'won';
        audio.fanfare();
        this.toastAt('Kamu menembus papan! Lanjut ke lantai ' + (st.floor + 1) + '.', 'success');
      } else {
        st.status = 'idle';
      }
      return;
    }
    if (st.hp <= 0) {
      st.status = 'dead';
      audio.death();
      this.exitCombat();
      this.toastAt('Kamu tumbang di petak ' + (st.position + 1) + '. Run selesai.', 'error');
    }
    // else: masih combat, menunggu aksi pemain berikutnya.
  }

  /** FOV kick singkat (game feel). */
  private fovKick(amount: number): void {
    const target = this.fx.cam.camera;
    const start = (target as unknown as { fov: number }).fov;
    if (!start) return;
    (target as unknown as { fov: number }).fov = start + amount;
    window.setTimeout(() => {
      (target as unknown as { fov: number }).fov = start;
      (target as unknown as { updateProjectionMatrix?: () => void }).updateProjectionMatrix?.();
    }, 90);
    (target as unknown as { updateProjectionMatrix?: () => void }).updateProjectionMatrix?.();
  }

  private flashMonster(): void {
    const tomb = this.tomb;
    tween({ duration: 220, ease: Ease.outCubic, onUpdate: (t) => {
      const s = 1 + Math.sin(t * Math.PI) * 0.18;
      tomb.scale.set(s, s, s);
    }, onDone: () => tomb.scale.set(1, 1, 1) });
  }

  private shakePiece(): void {
    // Offset dari posisi dasar (tidak akumulasi permanen/drift).
    const base = this.piece.group.position.clone();
    tween({ duration: 260, ease: Ease.outQuart, onUpdate: (t) => {
      this.piece.group.position.set(
        base.x + (Math.random() - 0.5) * 0.06 * (1 - t),
        base.y,
        base.z,
      );
    }, onDone: () => {
      this.piece.group.position.copy(base);
    } });
  }

  private hitStop(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private toastAt(message: string, kind: ToastKind): void {
    this.events.onToast(message, kind);
  }
}

