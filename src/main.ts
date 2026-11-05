import { Renderer } from './core/Renderer.js';
import { Loop } from './core/Loop.js';
import { detectPlatform } from './core/Platform.js';
import { createScene } from './render/Scene.js';
import { DiceManager } from './gameplay/Dice.js';
import { Board, themeForFloor } from './gameplay/Board.js';
import { Game } from './gameplay/Game.js';
import { todaySeed } from './gameplay/Board.js';
import './ui/styles.css';
import { audio } from './audio/AudioEngine.js';
import { Particles } from './fx/Particles.js';
import { DamageNumbers } from './fx/DamageNumbers.js';
import { CameraRig } from './fx/CameraRig.js';
import { loadMeta, saveMeta, runBonuses, runRewards, buyUpgrade, upgradeLevel, canAfford, UPGRADES, type UpgradeId } from './meta/Meta.js';
import { CARD_POOL, CARDS, type CardId } from './gameplay/Cards.js';
import { icon } from './ui/icons.js';

async function boot(): Promise<void> {
  const platform = detectPlatform();
  let meta = loadMeta();
  const canvas = document.createElement('canvas');
  document.getElementById('app')!.appendChild(canvas);

  const renderer = await Renderer.create(canvas, platform.tier);
  const rig = createScene();

  // Papan prosedural dari seed hari ini.
  const board = new Board(todaySeed(), themeForFloor(1));
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
    <div class="skillbar" id="skillbar"></div>
    <div class="combatpanel" id="combat-panel" hidden>
      <div class="combatpanel__info">
        <div class="combatpanel__name" id="monster-name">Monster</div>
        <div class="combatpanel__intent" id="monster-intent"></div>
        <div class="combatpanel__bar"><span id="monster-hp-bar"></span></div>
        <div class="combatpanel__nums" id="monster-hp-nums">0/0</div>
      </div>
      <div class="combatpanel__actions">
        <button class="btn btn--mini" data-action="attack" type="button">Serang</button>
        <button class="btn btn--mini btn--ghost" data-action="defend" type="button">Bertahan</button>
        <button class="btn btn--mini btn--ghost" data-action="flee" type="button">Kabur</button>
      </div>
    </div>
    <div class="log" id="combat-log"></div>
    <div class="toast-stack" id="toast-stack" aria-live="polite"></div>
    <div class="endpanel" id="end-panel" hidden>
      <h2 class="endpanel__title" id="end-title"></h2>
      <p class="endpanel__text" id="end-text"></p>
      <button class="btn" id="end-btn" type="button"></button>
      <button class="btn btn--secondary" id="end-hub-btn" type="button" style="margin-top:8px">Ke Hub</button>
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

  // Hub: upgrade permanen + statistik + mulai run.
  const hubScreen = document.createElement('div');
  hubScreen.className = 'hub';
  hubScreen.hidden = true;
  hubScreen.innerHTML = `
    <div class="hub__inner">
      <h1 class="hub__title">Hub</h1>
      <div class="hub__shards">Shard: <strong id="hub-shards">0</strong></div>
      <div class="hub__stats">
        <div class="hub__stat"><div class="hub__stat-value" id="hub-best-floor">0</div><div class="hub__stat-label">Lantai Terbaik</div></div>
        <div class="hub__stat"><div class="hub__stat-value" id="hub-runs">0</div><div class="hub__stat-label">Run</div></div>
        <div class="hub__stat"><div class="hub__stat-value" id="hub-kills">0</div><div class="hub__stat-label">Bunuh</div></div>
        <div class="hub__stat"><div class="hub__stat-value" id="hub-gold">0</div><div class="hub__stat-label">Emas Total</div></div>
      </div>
      <div class="hub__upgrades" id="hub-upgrades"></div>
      <button class="btn" id="hub-run-btn" type="button">Run Baru</button>
    </div>
  `;
  document.body.appendChild(hubScreen);

  // Draft kartu awal.
  const draftScreen = document.createElement('div');
  draftScreen.className = 'draft';
  draftScreen.hidden = true;
  draftScreen.innerHTML = `
    <h2 class="draft__title">Pilih Kartu Awal</h2>
    <p class="draft__sub">Satu kartu untuk run ini</p>
    <div class="draft__row" id="draft-row"></div>
  `;
  document.body.appendChild(draftScreen);
  const draftRow = document.getElementById('draft-row')!;
  const hubUpgrades = document.getElementById('hub-upgrades')!;

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

  // Tombol skill aktif untuk kartu yang dimiliki.
  const skillbar = document.getElementById('skillbar')!;
  function renderSkills(): void {
    const s = game.run.state;
    skillbar.replaceChildren();
    s.cards.forEach((id) => {
      const def = CARDS[id];
      const active = def.active;
      if (!active) return;
      const cd = s.cooldowns[id] ?? 0;
      const btn = document.createElement('button');
      btn.className = 'skillbtn' + (cd > 0 ? ' skillbtn--cd' : '');
      btn.type = 'button';
      btn.dataset.card = id;
      btn.title = active.name + ': ' + active.desc + ' (cooldown ' + active.cooldown + ')';
      btn.innerHTML = '<span class="skillbtn__ico">' + icon(def.icon as never) + '</span><span class="skillbtn__name">' + active.name + '</span>' + (cd > 0 ? '<span class="skillbtn__cd">' + cd + '</span>' : '');
      if (cd <= 0 && !game.busy) {
        btn.addEventListener('click', () => {
          game.useSkill(id).catch((err) => console.error(err));
        });
      } else {
        btn.disabled = true;
      }
      skillbar.appendChild(btn);
    });
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
            const nb = game.restartBoard(runBonuses(meta));
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
      renderSkills();
      // Panel combat: HP bar + tombol aksi.
      const inCombat = s.status === 'combat' && s.monster;
      combatPanel.hidden = !inCombat;
      if (inCombat && s.monster) {
        monsterName.textContent = s.monster.name;
        const intentMap: Record<string, string> = { normal: '', heavy: 'Serangan Berat!', shield: 'Perisai', dodge: 'Mengelak' };
        (document.getElementById('monster-intent') as HTMLElement).textContent = intentMap[s.monster.intent] ?? '';
        const pct = Math.max(0, Math.min(100, (s.monster.hp / s.monster.maxHp) * 100));
        monsterHpBar.style.width = pct.toFixed(1) + '%';
        monsterHpNums.textContent = s.monster.hp + '/' + s.monster.maxHp;
        combatPanel.querySelectorAll('[data-action]').forEach((b) => {
          (b as HTMLButtonElement).disabled = game.busy;
        });
      }
  };

  // ---- Hub & aliran ----

  function renderHub(): void {
    (document.getElementById('hub-shards') as HTMLElement).textContent = String(meta.shards);
    (document.getElementById('hub-best-floor') as HTMLElement).textContent = String(meta.bestFloor);
    (document.getElementById('hub-runs') as HTMLElement).textContent = String(meta.totalRuns);
    (document.getElementById('hub-kills') as HTMLElement).textContent = String(meta.totalKills);
    (document.getElementById('hub-gold') as HTMLElement).textContent = String(meta.totalGold);
    hubUpgrades.replaceChildren();
    (Object.keys(UPGRADES) as UpgradeId[]).forEach((id) => {
      const def = UPGRADES[id];
      const lvl = upgradeLevel(meta, id);
      const row = document.createElement('div');
      row.className = 'upgrade';
      const maxed = lvl >= def.maxLevel;
      const affordable = canAfford(meta, id);
      const cost = maxed ? 0 : def.cost(lvl);
      row.innerHTML = `
        <div class="upgrade__ico">${icon(def.icon as never)}</div>
        <div class="upgrade__info">
          <p class="upgrade__name">${def.name}</p>
          <p class="upgrade__desc">${def.desc}</p>
          <p class="upgrade__level">Level ${lvl}/${def.maxLevel}</p>
        </div>
        <button class="upgrade__buy" type="button" ${maxed || !affordable ? 'disabled' : ''}>${maxed ? 'Maks' : cost + ' shard'}</button>
      `;
      const buyBtn = row.querySelector('.upgrade__buy') as HTMLButtonElement;
      buyBtn.addEventListener('click', () => {
        if (buyUpgrade(meta, id)) {
          toast('Membeli ' + def.name + ' Lv ' + (lvl + 1) + '.', 'success');
          audio.unlock();
          renderHub();
        }
      });
      hubUpgrades.appendChild(row);
    });
  }

  function enterHub(): void {
    renderHub();
    hubScreen.hidden = false;
  }

  function startRun(): void {
    hubScreen.hidden = true;
    showDraft(runBonuses(meta));
  }

  function showDraft(bonuses: { maxHp: number; damage: number; diceBonus: number; goldMultiplier: number }): void {
    draftRow.replaceChildren();
    const pool = [...CARD_POOL];
    const picks: CardId[] = [];
    while (picks.length < 3 && pool.length > 0) {
      const i = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(i, 1)[0]!);
    }
    picks.forEach((id) => {
      const def = CARDS[id];
      const card = document.createElement('button');
      card.className = 'draft-card';
      card.type = 'button';
      card.innerHTML = `
        <div class="draft-card__icon drafting-icon">${icon(def.icon as never)}</div>
        <p class="draft-card__name">${def.name}</p>
        <p class="draft-card__rarity draft-card__rarity--${def.rarity}">${def.rarity}</p>
        <p class="draft-card__desc">${def.desc}</p>
      `;
      card.addEventListener('click', () => {
        draftScreen.hidden = true;
        game.start(bonuses);
        game.run.state.cards.push(id);
        meta.totalRuns += 1;
        saveMeta(meta);
        updateUI();
        toast('Memilih ' + def.name + '.', 'success');
      });
      draftRow.appendChild(card);
    });
    draftScreen.hidden = false;
  }

  function endRunToHub(): void {
    const s = game.run.state;
    const won = s.status === 'won';
    const reward = runRewards(s.floor, s.gold, s.kills, won);
    meta.shards += reward;
    meta.bestFloor = Math.max(meta.bestFloor, s.floor);
    meta.bestGold = Math.max(meta.bestGold, s.gold);
    meta.totalKills += s.kills;
    meta.totalGold += s.gold;
    if (won) meta.wins += 1;
    saveMeta(meta);
    endPanel.hidden = true;
    enterHub();
    toast('Run selesai: +' + reward + ' shard.', 'success');
  }

  const combatPanel = document.getElementById('combat-panel')!;
  const monsterName = document.getElementById('monster-name')!;
  const monsterHpBar = document.getElementById('monster-hp-bar')!;
  const monsterHpNums = document.getElementById('monster-hp-nums')!;
  combatPanel.querySelectorAll('[data-action]').forEach((b) => {
    b.addEventListener('click', () => {
      const action = (b as HTMLElement).dataset.action as 'attack' | 'defend' | 'flee';
      game.doCombatAction(action).catch((err) => console.error(err));
    });
  });

  const endHubBtn = document.getElementById('end-hub-btn') as HTMLButtonElement;
  endHubBtn.addEventListener('click', () => {
    endRunToHub();
  });

  const hubRunBtn = document.getElementById('hub-run-btn') as HTMLButtonElement;
  hubRunBtn.addEventListener('click', () => {
    audio.unlock();
    startRun();
  });

  // FX: partikel, angka melayang, kamera.
  const particles = new Particles();
  rig.root.add(particles.points);
  const dmgLayer = document.createElement('div');
  dmgLayer.className = 'dmg-layer';
  document.body.appendChild(dmgLayer);
  const dmg = new DamageNumbers(dmgLayer, rig.camera);
  const cam = new CameraRig(rig.camera, canvas);

  const game = new Game(dice, board, {
    onState: updateUI,
    onToast: toast,
    onCombat: (text) => {
      log(text);
    },
  }, { particles, dmg, cam });

  rig.root.add(game.piece.group);
  rig.root.add(game.tomb);

  // Tampilkan papan saja di belakang layar judul; run mulai saat Mulai.
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  startBtn.addEventListener('click', () => {
    audio.unlock();
    titleScreen.hidden = true;
    enterHub();
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

  // Tooltip petak (raycast hover).
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  {
    const { Raycaster, Vector2 } = await import('three/webgpu');
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    let tipMove = 0;
    canvas.addEventListener('pointermove', (e) => {
      if (game.busy) { tip.hidden = true; return; }
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, rig.camera);
      const hit = raycaster.intersectObjects(game.board.tiles.map((t) => t.mesh))[0];
      if (hit) {
        const tileIndex = (hit.object as unknown as { userData: { tileIndex: number } }).userData.tileIndex;
        const tile = game.run.state.tiles[tileIndex];
        if (tile) {
          tip.textContent = 'Petak ' + (tileIndex + 1) + ' · ' + tile.type;
          tip.style.left = e.clientX + 'px';
          tip.style.top = e.clientY + 'px';
          tip.hidden = false;
        }
      } else {
        tip.hidden = true;
      }
      tipMove = e.clientX;
      void tipMove;
    });
    canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
  }

  let lastFrame = performance.now();
  const loop = new Loop(
    () => {
      dice.update();
      rig.update();
    },
    () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      particles.update(dt);
      dmg.update(dt);
      cam.update(dt);
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

