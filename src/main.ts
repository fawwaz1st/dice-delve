import { Renderer } from './core/Renderer.js';
import { Loop } from './core/Loop.js';
import { detectPlatform } from './core/Platform.js';
import { createScene } from './render/Scene.js';
import { DiceManager } from './gameplay/Dice.js';
import { Board } from './gameplay/Board.js';
import { Game } from './gameplay/Game.js';
import { todaySeed } from './gameplay/Board.js';
import './ui/styles.css';
import { audio } from './audio/AudioEngine.js';

async function boot(): Promise<void> {
  const platform = detectPlatform();
  const canvas = document.createElement('canvas');
  document.getElementById('app')!.appendChild(canvas);

  const renderer = await Renderer.create(canvas, platform.tier);
  const rig = createScene();

  // Papan prosedural dari seed hari ini.
  const board = new Board(todaySeed());
  rig.root.add(board.group);

  const dice = new DiceManager();
  await dice.init();

  // HUD
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = `
    <div class="hud__top">
      <div>
        <h1 class="hud__title">Dice Delve</h1>
        <p class="hud__hint">Lempar dadu · jelajahi papan · kalahkan bos</p>
      </div>
      <div class="hud__stats">
        <div class="readout"><div class="readout__value" id="hp">30</div><div class="readout__label">HP</div></div>
        <div class="readout"><div class="readout__value" id="gold">0</div><div class="readout__label">Emas</div></div>
        <div class="readout"><div class="readout__value" id="floor">1</div><div class="readout__label">Lantai</div></div>
      </div>
    </div>
    <div class="hud__bottom">
      <div class="readout readout--wide"><div class="readout__value" id="dice-value">1</div><div class="readout__label">Dadu</div></div>
      <button class="btn" id="roll-btn" type="button">Lempar Dadu</button>
    </div>
    <div class="log" id="combat-log"></div>
    <div class="toast-stack" id="toast-stack" aria-hidden="true"></div>
    <div class="endpanel" id="end-panel" hidden>
      <h2 class="endpanel__title" id="end-title"></h2>
      <p class="endpanel__text" id="end-text"></p>
      <button class="btn" id="end-btn" type="button"></button>
    </div>
  `;
  document.body.appendChild(hud);

  // Layar judul: run dimulai saat pemain menekan Mulai.
  const titleScreen = document.createElement('div');
  titleScreen.className = 'titlescreen';
  titleScreen.innerHTML = `
    <h1 class="titlescreen__title">Dice <em>Delve</em></h1>
    <p class="titlescreen__tag">Board-roguelike 3D stylized. Lempar dadu, jelajahi papan prosedural, kumpulkan kartu, dan kalahkan bos.</p>
    <button class="btn" id="start-btn" type="button">Mulai</button>
    <p class="titlescreen__how">Lempar dadu · Bergerak · Bertarung · Tahankan kartu</p>
  `;
  document.body.appendChild(titleScreen);

  const endPanel = document.getElementById('end-panel')!;
  const endTitle = document.getElementById('end-title')!;
  const endText = document.getElementById('end-text')!;
  const endBtn = document.getElementById('end-btn') as HTMLButtonElement;

  const el = {
    hp: document.getElementById('hp')!,
    gold: document.getElementById('gold')!,
    floor: document.getElementById('floor')!,
    diceValue: document.getElementById('dice-value')!,
    rollBtn: document.getElementById('roll-btn') as HTMLButtonElement,
    log: document.getElementById('combat-log')!,
    toasts: document.getElementById('toast-stack')!,
  };

  function toast(message: string, kind: string): void {
    const slip = document.createElement('div');
    slip.className = 'toast toast--' + kind;
    slip.textContent = message;
    el.toasts.appendChild(slip);
    setTimeout(() => slip.remove(), 3200);
  }

  function log(text: string): void {
    const line = document.createElement('div');
    line.className = 'log__line';
    line.textContent = text;
    el.log.prepend(line);
    while (el.log.children.length > 5) el.log.lastChild?.remove();
  }

  // Fungsi pemutakhir UI: dipanggil setiap giliran DAN setelah ganti papan.
  const updateUI = (): void => {
      const s = game.run.state;
      // Satu-satunya sumber kebenaran untuk panel akhir.
      if ((s.status === 'won' || s.status === 'dead') && !game.busy) {
        endPanel.hidden = false;
        if (s.status === 'won') {
          endTitle.textContent = 'Lantai ' + s.floor + ' Selesai!';
          endText.textContent = 'Emas: ' + s.gold + ' · Kartu: ' + s.cards.length + ' · Bunuh: ' + s.kills;
          endBtn.textContent = 'Lantai Berikutnya';
          endBtn.onclick = () => {
            endPanel.hidden = true;
            const nb = game.nextFloor();
            rig.root.add(nb.group);
            updateUI();
          };
        } else {
          endTitle.textContent = 'Kamu Tumbang';
          endText.textContent = 'Lantai ' + s.floor + ' · Emas: ' + s.gold + ' · Bunuh: ' + s.kills;
          endBtn.textContent = 'Coba Lagi';
          endBtn.onclick = () => {
            endPanel.hidden = true;
            const nb = game.restartBoard();
            rig.root.add(nb.group);
            updateUI();
          };
        }
      } else {
        endPanel.hidden = true;
      }
      // HUD selalu mencerminkan state terkini.
      el.hp.textContent = String(s.hp);
      el.gold.textContent = String(s.gold);
      el.floor.textContent = String(s.floor);
      el.diceValue.textContent = String(game.lastRoll);
      el.rollBtn.disabled = game.busy || s.status === 'won' || s.status === 'dead';
  };

  const game = new Game(dice, board, {
    onState: updateUI,
    onToast: toast,
    onCombat: (text) => {
      log(text);
    },
  });

  rig.root.add(game.piece.group);
  rig.root.add(game.tomb);

  // Tampilkan papan saja di belakang layar judul; run mulai saat Mulai.
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  startBtn.addEventListener('click', () => {
    audio.unlock();
    titleScreen.hidden = true;
    game.start();
    updateUI();
  });

  el.rollBtn.addEventListener('click', () => {
    audio.unlock();
    game.rollTurn().catch((err) => console.error(err));
  });

  // Tombol bisu.
  const muteBtn = document.createElement('button');
  muteBtn.className = 'btn btn--ghost btn--mute';
  muteBtn.type = 'button';
  muteBtn.textContent = 'Suara: Nyala';
  muteBtn.setAttribute('aria-pressed', 'false');
  muteBtn.addEventListener('click', () => {
    audio.unlock();
    audio.setMuted(!audio.isMuted);
    muteBtn.textContent = audio.isMuted ? 'Suara: Mati' : 'Suara: Nyala';
    muteBtn.setAttribute('aria-pressed', String(audio.isMuted));
  });
  hud.appendChild(muteBtn);

  function resize(): void {
    renderer.setSize(window.innerWidth, window.innerHeight);
    rig.camera.aspect = window.innerWidth / window.innerHeight;
    rig.camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const loop = new Loop(
    () => {
      dice.update();
      rig.update();
    },
    () => {
      renderer.render(rig.scene, rig.camera);
    },
  );
  loop.start();

  // Sembunyikan loader.
  const loader = document.getElementById('loader')!;
  loader.style.opacity = '0';
  setTimeout(() => { loader.hidden = true; }, 420);

  (window as unknown as Record<string, unknown>).__diceDelve = {
    renderer: { backend: renderer.backend, tier: platform.tier, drawCalls: renderer.drawCalls },
    game,
  };
}

boot().catch((err) => {
  console.error('[Dice Delve] boot gagal:', err);
  const text = document.querySelector('.loader__text');
  if (text) text.textContent = 'Gagal memuat: ' + String(err);
});

