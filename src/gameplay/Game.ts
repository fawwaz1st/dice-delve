import { Group, Mesh, IcosahedronGeometry, Vector3 } from 'three/webgpu';
import { Board, todaySeed } from './Board.js';
import { Piece } from './Piece.js';
import { Run } from './Run.js';
import { DiceManager, type Dice } from './Dice.js';
import { toonMaterial, addOutline } from '../render/Materials.js';
import { tween, Ease } from '../utils/tween.js';
import { CARDS } from './Cards.js';
import { audio } from '../audio/AudioEngine.js';

type ToastKind = 'info' | 'success' | 'warning' | 'error';

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
  busy = false;
  lastRoll = 1;

  constructor(dice: DiceManager, board: Board, events: GameEvents) {
    this.dice = dice;
    this.board = board;
    this.events = events;
    this.run = new Run();
    this.piece = new Piece();
    this.tomb = this.spawnTomb();
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

  start(): void {
    this.run.start(todaySeed());
    this.piece.place(this.tileWorld(0));
    this.die = this.dice.spawn(new Vector3(4, 4, 4));
  }

  /** Bangun ulang papan 3D dari seed run saat ini. */
  rebuildBoard(): Board {
    const newBoard = new Board(this.run.state.seed);
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

  restartBoard(): Board {
    this.run.start(this.run.state.seed);
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

  async rollTurn(): Promise<void> {
    if (this.busy) return;
    const st = this.run.state;
    if (st.status === 'won' || st.status === 'dead') return;
    this.busy = true;
    this.run.beginRoll();
    audio.roll();
    this.events.onState();
    // Nilai ditentukan dadu; animasi tween menyelesaikan tepat pada muka itu.
    const diceValue = await this.dice.roll(this.die);
    this.lastRoll = diceValue;
    const rolled = this.run.applyCardRoll(diceValue);
    this.events.onCombat('Lempar dadu: ' + rolled.value + (rolled.doubled ? ' (ganda!)' : ''));
    await this.movePiece(rolled.value);
    await this.resolveTile();
    this.busy = false;
    this.events.onState();
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
        this.piece.hop(fromPos, toPos, 300, step);
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
        await this.combat(tile.type as 'monster' | 'elite' | 'boss');
        break;
      case 'treasure': {
        const res = this.run.resolveTreasure(Math.random);
        audio.coin();
        if (res.card) audio.card();
        this.toastAt(res.card ? 'Harta: +' + res.gold + ' emas, kartu ' + CARDS[res.card].name + '!' : 'Harta: +' + res.gold + ' emas.', res.card ? 'success' : 'info');
        break;
      }
      case 'trap': {
        const dmg = this.run.resolveTrap(Math.random);
        audio.hurt();
        this.toastAt('Jebakan! Kamu menerima ' + dmg + ' damage.', 'error');
        break;
      }
      case 'shop': {
        const card = this.run.resolveShop(Math.random);
        if (card) audio.card();
        this.toastAt(card ? 'Membeli ' + CARDS[card].name + ' (25 emas).' : 'Tidak ada yang bisa dibeli (butuh 25 emas).', card ? 'info' : 'warning');
        break;
      }
      case 'rest':
        this.run.heal(8);
        this.toastAt('Istirahat: +8 HP.', 'success');
        break;
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

  private async combat(tier: 'monster' | 'elite' | 'boss'): Promise<void> {
    const st = this.run.state;
    const m = this.run.makeMonster(tier);
    st.monster = m;
    st.status = 'combat';
    const here = this.tileWorld(st.position).clone();
    this.tomb.visible = true;
    this.tomb.position.set(here.x + 1.6, 0, here.z);
    this.tomb.rotation.y = -Math.PI / 2;
    this.toastAt('Menghadapi ' + m.name + ' (HP ' + m.maxHp + ', ATK ' + m.atk + ', DEF ' + m.def + ').', 'warning');
    while (m.hp > 0 && st.hp > 0) {
      const combatValue = await this.dice.roll(this.die);
      this.lastRoll = combatValue;
      const res = this.run.combatRound(combatValue);
      audio.hit();
      this.flashMonster();
      this.events.onCombat(res.playerDamage > 0 ? m.name + ' menerima ' + res.playerDamage + ' damage. Sisa ' + m.hp + '/' + m.maxHp + '.' : m.name + ' menahan serangan (DEF ' + m.def + ').');
      await this.hitStop(120);
      if (m.hp <= 0) break;
      if (res.monsterDamage > 0) {
        audio.hurt();
        this.events.onCombat(m.name + ' menyerang: kamu menerima ' + res.monsterDamage + ' damage.');
        this.shakePiece();
      }
      await this.hitStop(100);
    }
    if (m.hp <= 0 && st.hp > 0) {
      this.run.onMonsterDefeated(tier);
      this.events.onState();
    }
    this.tomb.visible = false;
    st.monster = null;
  }

  private flashMonster(): void {
    const tomb = this.tomb;
    tween({ duration: 220, ease: Ease.outCubic, onUpdate: (t) => {
      const s = 1 + Math.sin(t * Math.PI) * 0.18;
      tomb.scale.set(s, s, s);
    }, onDone: () => tomb.scale.set(1, 1, 1) });
  }

  private shakePiece(): void {
    tween({ duration: 260, ease: Ease.outQuart, onUpdate: (t) => {
      this.piece.group.position.x += (Math.random() - 0.5) * 0.06 * (1 - t);
    } });
  }

  private hitStop(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private toastAt(message: string, kind: ToastKind): void {
    this.events.onToast(message, kind);
  }
}

