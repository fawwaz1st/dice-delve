/* ==========================================================================
   Ular Tangga Modern — game.js
   Mesin permainan: papan, dadu, giliran, ular & tangga, AI, skill, simpanan.

   Bergantung pada: core.js, icons.js, audio.js, skills.js
   ========================================================================== */

(function () {
  'use strict';

  const UT = window.UT;

  const SIZE = 10;
  const FINISH = SIZE * SIZE;
  const LADDERS = 7;
  const SNAKES = 7;

  const COLORS = ['p1', 'p2', 'p3', 'p4'];

  /* Pola pip dadu: indeks 0-8 pada grid 3x3. */
  const PIPS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ----------------------------------------------------------------------
     State
     ---------------------------------------------------------------------- */

  const state = {
    players: [],
    turn: 0,
    phase: 'idle',   // idle | awaiting | rolling | moving | ai | over
    over: false,
    winner: null,    // { name, isAI } untuk tombol bagikan
    mode: 'classic',
    ladders: {},
    snakes: {},
    turns: 0,        // jumlah giliran, dipakai untuk statistik
    pending: null,   // janji resolusi pendaratan setelah skill
  };

  const el = {};

  function cache() {
    el.loading = document.getElementById('loading-overlay');
    el.modeTag = document.getElementById('mode-tag');
    el.musicBtn = document.getElementById('music-btn');
    el.paper = document.getElementById('board-paper');
    el.grid = document.getElementById('board-grid');
    el.lines = document.getElementById('board-lines');
    el.pieces = document.getElementById('board-pieces');
    el.frame = document.getElementById('board-frame');
    el.turnDisc = document.getElementById('turn-disc');
    el.turnWho = document.getElementById('turn-who');
    el.turnHint = document.getElementById('turn-hint');
    el.diceBtn = document.getElementById('dice-btn');
    el.dice = document.getElementById('dice-cube');
    el.diceLog = document.getElementById('dice-log');
    el.hand = document.getElementById('skill-hand');
    el.scoreList = document.getElementById('score-list');
    el.tip = document.getElementById('skill-tip');
    el.winModal = document.getElementById('win-modal');
    el.winTitle = document.getElementById('win-title');
    el.winText = document.getElementById('win-text');
    el.rulesModal = document.getElementById('rules-modal');
    el.resumeModal = document.getElementById('resume-modal');
  }

  /* ----------------------------------------------------------------------
     Pembantu
     ---------------------------------------------------------------------- */

  const pace = () => (state.mode === 'speed' ? 0.45 : 1);
  const wait = (ms) => UT.sleep(Math.round(ms * pace()));

  const playerById = (id) => state.players.find((p) => p.id === id);
  const active = () => state.players[state.turn];
  const nameOf = (id) => (playerById(id) || { name: '?' }).name;

  const humanCanRoll = () => {
    const p = active();
    return !state.over && state.phase === 'awaiting' && p && !p.isAI;
  };

  /* ----------------------------------------------------------------------
     Layar tetap menyala (Wake Lock API). Papan ini dimainkan bersama di
     satu layar; layar yang meredup di tengah giliran merusak suasana.
     Tanpa UI: peningkatan progresif yang gagal secara senyap.
     ---------------------------------------------------------------------- */

  let wakeLock = null;
  let wakeGranted = false;

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeGranted = true;
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (err) {
      /* Butuh aktivasi pengguna atau dokumen tak terlihat; biarkan senyap. */
    }
  }

  function releaseWakeLock() {
    try { if (wakeLock) wakeLock.release(); } catch (err) { /* senyap */ }
    wakeLock = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wakeGranted && !state.over) {
      requestWakeLock();
    }
  });
  window.addEventListener('pagehide', releaseWakeLock);

  /* ----------------------------------------------------------------------
     Papan: susun ular & tangga
     ---------------------------------------------------------------------- */

  function buildBoard() {
    const ladders = {};
    const snakes = {};
    const used = new Set([1, FINISH]);
    const free = (n) => n >= 2 && n < FINISH && !used.has(n);

    let guard = 0;
    while (Object.keys(ladders).length < LADDERS && guard < 4000) {
      guard += 1;
      const from = UT.randInt(3, 78);
      const to = from + UT.randInt(7, 21);
      if (to >= FINISH || !free(from) || !free(to)) continue;
      ladders[from] = to;
      used.add(from);
      used.add(to);
    }

    guard = 0;
    while (Object.keys(snakes).length < SNAKES && guard < 4000) {
      guard += 1;
      const from = UT.randInt(24, FINISH - 2);
      const to = from - UT.randInt(7, 21);
      if (to < 2 || !free(from) || !free(to)) continue;
      snakes[from] = to;
      used.add(from);
      used.add(to);
    }

    state.ladders = ladders;
    state.snakes = snakes;
  }

  /* ----------------------------------------------------------------------
     Papan: gambar kotak
     ---------------------------------------------------------------------- */

  function drawGrid() {
    const frag = document.createDocumentFragment();

    for (let row = 0; row < SIZE; row += 1) {
      const boardRow = SIZE - 1 - row; // 0 = baris bawah
      for (let col = 0; col < SIZE; col += 1) {
        const n = boardRow % 2 === 0
          ? boardRow * SIZE + col + 1
          : boardRow * SIZE + (SIZE - 1 - col) + 1;

        const sq = document.createElement('div');
        sq.className = 'sq';
        sq.dataset.cell = String(n);

        if (n === 1) sq.classList.add('sq--start');
        if (n === FINISH) sq.classList.add('sq--finish');
        if (state.ladders[n]) sq.classList.add('sq--ladder');
        if (state.snakes[n]) sq.classList.add('sq--snake');

        const num = document.createElement('span');
        num.className = 'sq__no';
        num.textContent = String(n);
        sq.appendChild(num);

        if (state.ladders[n]) sq.appendChild(markIcon('ladder-mark', 'sq__mark'));
        else if (state.snakes[n]) sq.appendChild(markIcon('snake-mark', 'sq__mark'));
        else if (n === FINISH) sq.appendChild(markIcon('flag', 'sq__mark'));

        frag.appendChild(sq);
      }
    }

    el.grid.innerHTML = '';
    el.grid.appendChild(frag);
  }

  function markIcon(name, cls) {
    const span = document.createElement('span');
    span.className = cls;
    const svg = UT.icon(name);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    span.appendChild(svg);
    return span;
  }

  /* ----------------------------------------------------------------------
     Papan: gambar jalur ular & tangga
     ---------------------------------------------------------------------- */

  const svgNode = (tag, attrs) => {
    const node = document.createElementNS(SVGNS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    return node;
  };

  /** Pusat sebuah kotak, relatif terhadap kertas papan. */
  function centerOf(cellNo, paperRect) {
    const sq = el.grid.querySelector(`[data-cell="${cellNo}"]`);
    if (!sq) return null;
    const r = sq.getBoundingClientRect();
    return {
      x: r.left - paperRect.left + r.width / 2,
      y: r.top - paperRect.top + r.height / 2,
      w: r.width,
      h: r.height,
    };
  }

  function drawLines() {
    const rect = el.paper.getBoundingClientRect();
    if (!rect.width) return;

    el.lines.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    el.lines.innerHTML = '';

    Object.entries(state.ladders).forEach(([a, b]) => {
      const from = centerOf(Number(a), rect);
      const to = centerOf(Number(b), rect);
      if (from && to) paintLadder(from, to);
    });

    Object.entries(state.snakes).forEach(([a, b]) => {
      const from = centerOf(Number(a), rect);
      const to = centerOf(Number(b), rect);
      if (from && to) paintSnake(from, to);
    });
  }

  function paintLadder(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy; // normal
    const ny = ux;
    const gap = Math.max(4, from.w * 0.17);

    const g = svgNode('g', {});

    [-1, 1].forEach((side) => {
      g.appendChild(svgNode('line', {
        x1: from.x + nx * gap * side,
        y1: from.y + ny * gap * side,
        x2: to.x + nx * gap * side,
        y2: to.y + ny * gap * side,
        stroke: '#a16207',
        'stroke-width': Math.max(2.4, from.w * 0.085),
        'stroke-linecap': 'round',
        opacity: 0.92,
      }));
    });

    const steps = Math.max(3, Math.round(len / (from.h * 0.62)));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / (steps + 1);
      const cx = from.x + dx * t;
      const cy = from.y + dy * t;
      g.appendChild(svgNode('line', {
        x1: cx - nx * gap,
        y1: cy - ny * gap,
        x2: cx + nx * gap,
        y2: cy + ny * gap,
        stroke: '#ca8a04',
        'stroke-width': Math.max(1.8, from.w * 0.07),
        'stroke-linecap': 'round',
      }));
    }

    el.lines.appendChild(g);
  }

  function paintSnake(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const bend = UT.clamp(len * 0.24, 12, 44) * (Math.random() < 0.5 ? 1 : -1);
    const cx = (from.x + to.x) / 2 + nx * bend;
    const cy = (from.y + to.y) / 2 + ny * bend;
    const d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;

    const g = svgNode('g', {});

    // Badan: garis gelap tipis di bawah, badan terang di atas.
    g.appendChild(svgNode('path', {
      d,
      fill: 'none',
      stroke: '#7f1d1d',
      'stroke-width': Math.max(6.5, from.w * 0.2),
      'stroke-linecap': 'round',
      opacity: 0.85,
    }));
    g.appendChild(svgNode('path', {
      d,
      fill: 'none',
      stroke: '#dc2626',
      'stroke-width': Math.max(4, from.w * 0.125),
      'stroke-linecap': 'round',
    }));

    // Kepala di petak awal, ekor di petak tujuan.
    g.appendChild(svgNode('circle', {
      cx: from.x,
      cy: from.y,
      r: Math.max(5, from.w * 0.22),
      fill: '#b91c1c',
      stroke: '#7f1d1d',
      'stroke-width': 1.6,
    }));

    [-1, 1].forEach((side) => {
      g.appendChild(svgNode('circle', {
        cx: from.x + ux * from.w * 0.07 + nx * side * from.w * 0.09,
        cy: from.y + uy * from.h * 0.07 + ny * side * from.h * 0.09,
        r: Math.max(1.2, from.w * 0.04),
        fill: '#fff8e7',
      }));
    });

    g.appendChild(svgNode('circle', {
      cx: to.x,
      cy: to.y,
      r: Math.max(2.6, from.w * 0.09),
      fill: '#dc2626',
    }));

    el.lines.appendChild(g);
  }

  /* ----------------------------------------------------------------------
     Pion
     ---------------------------------------------------------------------- */

  function drawPieces() {
    el.pieces.innerHTML = '';
    state.players.forEach((p) => {
      const piece = document.createElement('div');
      piece.className = 'piece';
      piece.id = `piece-${p.id}`;
      piece.dataset.color = p.color;
      piece.appendChild(UT.icon(p.isAI ? 'robot' : 'person'));
      el.pieces.appendChild(piece);
    });
    state.players.forEach((p) => placePiece(p.id));
  }

  function placePiece(id) {
    const p = playerById(id);
    const piece = document.getElementById(`piece-${id}`);
    if (!p || !piece) return;

    const sq = el.grid.querySelector(`[data-cell="${p.pos}"]`);
    if (!sq) return;

    const paperRect = el.paper.getBoundingClientRect();
    const r = sq.getBoundingClientRect();

    // Pion yang berbagi kotak disebar sedikit agar tidak saling menutup.
    const sharing = state.players
      .filter((x) => x.pos === p.pos)
      .sort((a, b) => a.id - b.id);
    const idx = sharing.findIndex((x) => x.id === id);
    const n = sharing.length;

    let dx = 0;
    let dy = 0;
    if (n > 1) {
      const spread = r.width * 0.2;
      dx = (idx - (n - 1) / 2) * spread;
      if (n > 2) dy = (idx % 2 === 0 ? 0.5 : -0.5) * r.height * 0.18;
    }

    piece.style.left = `${r.left - paperRect.left + r.width / 2 + dx}px`;
    piece.style.top = `${r.top - paperRect.top + r.height / 2 + dy}px`;
  }

  const placeAllPieces = () => state.players.forEach((p) => placePiece(p.id));

  /* ----------------------------------------------------------------------
     Dadu
     ---------------------------------------------------------------------- */

  function buildDice() {
    el.dice.innerHTML = '';
    for (let i = 0; i < 9; i += 1) {
      const pip = document.createElement('span');
      pip.className = 'pip';
      el.dice.appendChild(pip);
    }
    setFace(1);
  }

  function setFace(value) {
    const on = PIPS[value] || PIPS[1];
    Array.from(el.dice.children).forEach((pip, i) => {
      pip.classList.toggle('is-on', on.includes(i));
    });
  }

  /* ----------------------------------------------------------------------
     UI: giliran, dadu, skill, skor
     ---------------------------------------------------------------------- */

  function hintText() {
    const p = active();
    if (!p) return '';
    if (state.over) return 'Permainan selesai.';
    switch (state.phase) {
      case 'rolling': return 'Mengocok dadu...';
      case 'moving': return 'Pion berjalan...';
      case 'ai': return 'Menimbang langkah...';
      case 'awaiting': return p.isAI ? 'Menunggu AI...' : 'Klik dadu untuk melempar.';
      default: return '';
    }
  }

  function renderTurn() {
    const p = active();
    if (!p) return;
    el.turnDisc.dataset.color = p.color;
    el.turnDisc.innerHTML = '';
    el.turnDisc.appendChild(UT.icon(p.isAI ? 'robot' : 'person'));
    el.turnWho.textContent = p.name;
    el.turnHint.textContent = hintText();
  }

  function renderDice() {
    const can = humanCanRoll();
    el.diceBtn.disabled = !can;
    el.diceBtn.setAttribute('aria-disabled', String(!can));
  }

  function renderHand() {
    const me = state.players.find((p) => !p.isAI);
    if (!me || !el.hand) return;

    el.hand.innerHTML = '';
    const live = UT.Skills.getLive(me.id);
    const canUse = humanCanRoll();

    UT.Skills.getSkills(me.id).forEach((skill) => {
      const cd = UT.Skills.getCooldown(me.id, skill.id);
      const isLive = live.includes(skill.id);

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'skill-card';
      card.dataset.rarity = skill.rarity;
      card.dataset.skill = skill.id;
      // aria-disabled, bukan disabled: kartu tetap bisa diberi keterangan.
      const blocked = cd > 0 || !canUse;
      card.setAttribute('aria-disabled', String(blocked));
      card.setAttribute('aria-label', `${skill.name}: ${skill.desc}`);
      card.appendChild(UT.icon(skill.icon));

      if (cd > 0) {
        const badge = document.createElement('span');
        badge.className = 'skill-card__cd';
        badge.textContent = String(cd);
        card.appendChild(badge);
      }
      if (isLive) {
        card.classList.add('is-live');
        const mark = document.createElement('span');
        mark.className = 'skill-card__live';
        mark.textContent = '!';
        card.appendChild(mark);
      }

      const showTip = () => openTip(card, skill, cd, isLive);
      card.addEventListener('mouseenter', showTip);
      card.addEventListener('focus', showTip);
      card.addEventListener('mouseleave', closeTip);
      card.addEventListener('blur', closeTip);

      card.addEventListener('click', () => {
        if (!humanCanRoll()) {
          UT.toast('Skill hanya bisa dipakai saat giliranmu.', 'warning', 1800);
          return;
        }
        if (cd > 0) {
          UT.Audio.play('reject');
          UT.toast(`Masih cooldown ${cd} giliran.`, 'warning', 1800);
          return;
        }
        const res = UT.Skills.useSkill(me.id, skill.id, skillApi);
        UT.Audio.play(res.ok ? 'skill' : 'reject');
        UT.toast(res.message, res.ok ? 'success' : 'warning');
      });

      el.hand.appendChild(card);
    });
  }

  function openTip(anchor, skill, cd, isLive) {
    if (!el.tip) return;
    el.tip.innerHTML = `
      <b>${skill.name}</b>
      ${skill.desc}
      <span class="skill-tip__meta">${isLive ? 'AKTIF &middot; ' : ''}${cd > 0 ? `Cooldown ${cd} giliran` : 'Siap dipakai'}</span>
    `;
    el.tip.classList.add('show');

    const a = anchor.getBoundingClientRect();
    const t = el.tip.getBoundingClientRect();
    let left = a.left + a.width / 2 - t.width / 2;
    let top = a.top - t.height - 10;
    left = UT.clamp(left, 8, window.innerWidth - t.width - 8);
    if (top < 8) top = a.bottom + 10;
    el.tip.style.left = `${left}px`;
    el.tip.style.top = `${top}px`;
  }

  function closeTip() {
    if (el.tip) el.tip.classList.remove('show');
  }

  function buildScores() {
    el.scoreList.innerHTML = '';
    state.players.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'score-item';
      li.id = `score-${p.id}`;

      const disc = document.createElement('span');
      disc.className = 'score-item__disc';
      disc.dataset.color = p.color;
      disc.appendChild(UT.icon(p.isAI ? 'robot' : 'person'));

      const body = document.createElement('span');
      body.className = 'score-item__body';

      const who = document.createElement('span');
      who.className = 'score-item__who';
      who.textContent = p.name;
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = p.isAI ? 'AI' : 'Kamu';
      who.appendChild(tag);

      const track = document.createElement('span');
      track.className = 'score-item__track';
      const fill = document.createElement('span');
      fill.className = 'score-item__fill';
      track.appendChild(fill);

      body.appendChild(who);
      body.appendChild(track);

      const pos = document.createElement('span');
      pos.className = 'score-item__pos';
      pos.textContent = '1';

      li.appendChild(disc);
      li.appendChild(body);
      li.appendChild(pos);
      el.scoreList.appendChild(li);
    });
  }

  function renderScores() {
    state.players.forEach((p) => {
      const row = document.getElementById(`score-${p.id}`);
      if (!row) return;
      row.querySelector('.score-item__pos').textContent = String(p.pos);
      row.querySelector('.score-item__fill').style.width = `${(p.pos / FINISH) * 100}%`;
      const isTurn = !state.over && active() && active().id === p.id;
      row.classList.toggle('is-turn', Boolean(isTurn));
      row.classList.toggle('is-won', state.over && p.pos >= FINISH);
    });
  }

  function renderAll() {
    renderTurn();
    renderDice();
    renderHand();
    renderScores();
    state.players.forEach((p) => {
      const piece = document.getElementById(`piece-${p.id}`);
      if (piece) {
        piece.classList.toggle('is-active', !state.over && active() && active().id === p.id);
      }
    });
  }

  /* ----------------------------------------------------------------------
     API untuk sistem skill
     ---------------------------------------------------------------------- */

  const skillApi = {
    getPlayers: () => state.players,
    nameOf,
    finishCell: () => FINISH,
    isBusy: () => state.phase === 'rolling' || state.phase === 'moving',

    moveTo(playerId, dest, message) {
      const p = playerById(playerId);
      if (!p) return;
      p.pos = UT.clamp(dest, 1, FINISH);
      placePiece(playerId);
      if (message) UT.toast(message, 'info');
      state.pending = settle(playerId); // tetap cek ular/tangga di petak tujuan
    },

    swapWith(playerId, otherId) {
      const a = playerById(playerId);
      const b = playerById(otherId);
      if (!a || !b) return;
      const tmp = a.pos;
      a.pos = b.pos;
      b.pos = tmp;
      placePiece(a.id);
      placePiece(b.id);
      UT.toast(`${a.name} bertukar posisi dengan ${b.name}.`, 'info');
    },

    pushBack(targetId, steps) {
      const t = playerById(targetId);
      if (!t) return;
      t.pos = Math.max(1, t.pos - steps);
      placePiece(targetId);
      UT.toast(`${t.name} mundur ke petak ${t.pos}.`, 'warning');
    },

    clearOpponentEffects(playerId) {
      let n = 0;
      state.players.forEach((p) => {
        if (p.id !== playerId) n += UT.Skills.clearEffectsOf(p.id);
      });
      return n;
    },

    refreshUI: renderAll,
  };

  /* ----------------------------------------------------------------------
     Giliran
     ---------------------------------------------------------------------- */

  function beginTurn() {
    state.phase = 'awaiting';
    renderAll();
    save();
    const p = active();
    if (p && !state.over) UT.narrate(`Giliran ${p.name}${p.isAI ? ' (AI)' : ''}.`);
    if (p && p.isAI) runAI();
  }

  function passTurn() {
    const p = active();
    if (p) UT.Skills.endTurn(p.id);
    state.turn = (state.turn + 1) % state.players.length;
    state.turns += 1;
    UT.Audio.play('turn');
    beginTurn();
  }

  /** Rute langkah dari posisi sekarang; memantul bila melewati petak 100. */
  function route(start, steps) {
    const out = [];
    let pos = start;
    for (let i = 0; i < steps; i += 1) {
      pos = pos < FINISH ? pos + 1 : pos - 1;
      out.push(pos);
    }
    return out;
  }

  async function walk(playerId, path) {
    const p = playerById(playerId);
    const piece = document.getElementById(`piece-${playerId}`);
    const quiet = UT.reducedMotion();

    for (const cell of path) {
      p.pos = cell;
      placePiece(playerId);
      if (piece && !quiet) {
        piece.classList.remove('is-hopping');
        void piece.offsetWidth; // mulai ulang animasi
        piece.classList.add('is-hopping');
      }
      UT.Audio.play('hop');
      await wait(quiet ? 60 : 215);
    }
  }

  /** Tangani ular/tangga. true bila permainan berakhir. */
  async function settle(playerId) {
    const p = playerById(playerId);
    if (!p) return false;

    await wait(250);

    if (state.ladders[p.pos]) {
      const bonus = UT.Skills.takeLadderBonus(playerId);
      const top = state.ladders[p.pos];
      const dest = UT.clamp(top + bonus, 1, FINISH);
      UT.Audio.play('ladder');
      UT.haptic([22, 40, 34]);
      UT.narrate(`${p.name} naik tangga ke petak ${dest}.`);
      UT.toast(
        bonus > 0
          ? `${p.name} naik tangga ke ${top}, ditambah ${bonus} jadi ${dest}.`
          : `${p.name} naik tangga ke petak ${dest}.`,
        'success'
      );
      p.pos = dest;
      placePiece(playerId);
      renderAll();
      await wait(400);
    } else if (state.snakes[p.pos]) {
      if (UT.Skills.takeSnakeShield(playerId)) {
        UT.Audio.play('skill');
        UT.toast(`${p.name} terlindung dari ular di petak ${p.pos}.`, 'info');
        UT.narrate(`${p.name} terlindung dari ular di petak ${p.pos}.`);
        renderAll();
      } else {
        const dest = state.snakes[p.pos];
        UT.Audio.play('snake');
        shakeFrame();
        UT.haptic([70, 50, 110]);
        UT.narrate(`${p.name} kena ular, turun ke petak ${dest}.`);
        UT.toast(`${p.name} kena ular, turun ke petak ${dest}.`, 'warning');
        p.pos = dest;
        placePiece(playerId);
        renderAll();
        await wait(400);
      }
    }

    if (p.pos >= FINISH) {
      finish(p);
      return true;
    }
    return false;
  }

  /** Getaran papan saat kena ular: umpan balik fisik, bukan hiasan. */
  function shakeFrame() {
    if (!el.frame || UT.reducedMotion()) return;
    el.frame.classList.remove('is-shaking');
    void el.frame.offsetWidth;
    el.frame.classList.add('is-shaking');
    setTimeout(() => el.frame && el.frame.classList.remove('is-shaking'), 420);
  }

  async function roll() {
    if (state.over) return;

    // Tunggu resolusi skill yang masih berjalan (mis. teleportasi).
    if (state.pending) {
      await state.pending;
      state.pending = null;
      if (state.over) return;
    }

    const p = active();
    if (!p || (state.phase !== 'awaiting' && state.phase !== 'ai')) return;

    state.phase = 'rolling';
    renderAll();
    el.diceLog.textContent = '...';

    UT.Audio.play('roll');
    el.dice.classList.add('is-tumbling');

    const spins = state.mode === 'speed' ? 6 : 10;
    for (let i = 0; i < spins; i += 1) {
      setFace(UT.randInt(1, 6));
      await wait(78);
    }
    el.dice.classList.remove('is-tumbling');

    const raw = UT.randInt(1, 6);
    const value = UT.Skills.modifyDice(p.id, raw);
    setFace(value);
    UT.haptic(26);
    UT.narrate(`${p.name} melempar dadu: ${value}.`);

    // Hentakan mendarat: hanya bila gerakan diizinkan.
    if (!UT.reducedMotion()) {
      el.dice.classList.add('is-landing');
      setTimeout(() => el.dice && el.dice.classList.remove('is-landing'), 300);
    }

    el.diceLog.textContent = value !== raw
      ? `${p.name}: ${value} (dadu ${raw}, ditambah efek)`
      : `${p.name} mendapat ${value}.`;

    await wait(300);

    state.phase = 'moving';
    renderAll();

    await walk(p.id, route(p.pos, value));
    renderAll();

    const done = await settle(p.id);
    if (done) return;

    if (UT.Skills.takeExtraTurn(p.id)) {
      UT.toast(`${p.name} mendapat giliran tambahan.`, 'info');
      beginTurn();
      return;
    }

    passTurn();
  }

  async function runAI() {
    const p = active();
    if (!p || !p.isAI || state.over) return;

    state.phase = 'ai';
    renderAll();
    await wait(680);
    if (state.over) return;

    UT.Skills.aiPlay(p.id, skillApi);
    if (state.pending) {
      await state.pending;
      state.pending = null;
    }
    if (state.over) return;

    await wait(600);
    if (state.over) return;
    await roll();
  }

  /* ----------------------------------------------------------------------
     Menang
     ---------------------------------------------------------------------- */

  function finish(winner) {
    state.over = true;
    state.phase = 'over';
    state.winner = { name: winner.name, isAI: Boolean(winner.isAI) };

    UT.recordResult(winner, state.turns);
    UT.clearGame();
    UT.Audio.play('win');
    UT.haptic([90, 60, 90, 60, 160]);
    UT.narrate(`${winner.name} menang! Permainan selesai dalam ${state.turns} giliran.`);
    if (window.UT.confetti) UT.confetti.burst();

    if (el.winTitle) el.winTitle.textContent = `${winner.name} menang!`;
    if (el.winText) {
      el.winText.textContent = `Mencapai petak ${FINISH} dalam ${state.turns} giliran.`;
    }
    if (el.winModal) UT.openModal(el.winModal);

    renderAll();
  }

  /* Bagikan hasil (Web Share API) dengan fallback salin ke clipboard.
     Wajib dipanggil dari dalam penanganan klik pengguna. */
  function shareResult() {
    const who = state.winner ? state.winner.name : 'Seseorang';
    const text = `${who} juara Ular Tangga Modern dalam ${state.turns} giliran! Berani kalahkan?`;
    const url = new URL('../', window.location.href).href;

    if (navigator.canShare && navigator.canShare({ text, url })) {
      navigator.share({ title: 'Ular Tangga Modern', text, url }).catch(() => {});
      return;
    }

    const full = `${text} ${url}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(full)
        .then(() => UT.toast('Hasil permainan disalin. Tempel ke chat temanmu!', 'success'))
        .catch(() => UT.toast('Gagal menyalin hasil permainan.', 'error'));
      return;
    }
    UT.toast('Fitur bagikan tidak tersedia di browser ini.', 'warning');
  }

  /* ----------------------------------------------------------------------
     Simpan & lanjutkan
     ---------------------------------------------------------------------- */

  function save() {
    if (state.over) return;
    UT.saveGame({
      v: 2,
      mode: state.mode,
      players: state.players.map((p) => ({
        id: p.id, name: p.name, isAI: p.isAI, color: p.color, pos: p.pos,
      })),
      turn: state.turn,
      turns: state.turns,
      ladders: state.ladders,
      snakes: state.snakes,
      skills: UT.Skills.snapshot(),
      at: Date.now(),
    });
  }

  function restore(data) {
    state.mode = data.mode === 'speed' ? 'speed' : 'classic';
    state.players = data.players.map((p) => ({ ...p, icon: p.isAI ? 'ai' : 'human' }));
    state.turn = UT.clamp(parseInt(data.turn, 10) || 0, 0, state.players.length - 1);
    state.turns = Math.max(0, parseInt(data.turns, 10) || 0);
    state.ladders = data.ladders || {};
    state.snakes = data.snakes || {};
    state.over = false;
    state.pending = null;
    state.winner = null;
  }

  /* ----------------------------------------------------------------------
     Permainan baru
     ---------------------------------------------------------------------- */

  function makePlayers(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: i === 0 ? 'Pemain 1' : `AI ${i}`,
      isAI: i > 0,
      color: COLORS[i % COLORS.length],
      icon: i === 0 ? 'human' : 'ai',
      pos: 1,
    }));
  }

  function startFresh() {
    const cfg = UT.getSettings();
    state.mode = cfg.mode;
    state.players = makePlayers(cfg.players);
    state.turn = 0;
    state.turns = 0;
    state.over = false;
    state.pending = null;
    state.winner = null;
    state.phase = 'idle';

    buildBoard();
    renderStatic();
    UT.Skills.init(state.players);
    beginTurn();
  }

  function renderStatic() {
    drawGrid();
    drawLines();
    drawPieces();
    buildScores();
    if (el.modeTag) el.modeTag.textContent = state.mode === 'speed' ? 'Cepat' : 'Klasik';
    if (el.winModal) el.winModal.classList.remove('show');
    if (el.diceLog) el.diceLog.textContent = 'Lempar dadu untuk mulai.';
    setFace(1);
    syncMusicBtn();
  }

  /* ----------------------------------------------------------------------
     Musik
     ---------------------------------------------------------------------- */

  function syncMusicBtn() {
    if (!el.musicBtn) return;
    const on = UT.getSettings().music;
    el.musicBtn.innerHTML = '';
    el.musicBtn.appendChild(UT.icon(on ? 'music-on' : 'music-off'));
    el.musicBtn.classList.toggle('is-off', !on);
    const label = on ? 'Matikan musik' : 'Nyalakan musik';
    el.musicBtn.title = label;
    el.musicBtn.setAttribute('aria-label', label);
    el.musicBtn.setAttribute('aria-pressed', String(on));
  }

  function toggleMusic() {
    const now = UT.getSettings();
    UT.saveSettings({ music: !now.music });
    UT.Audio.syncMusic();
    syncMusicBtn();
    UT.toast(UT.getSettings().music ? 'Musik dinyalakan.' : 'Musik dimatikan.', 'info', 1500);
  }

  /* Modal dibuka lewat UT.openModal / UT.closeModal (core.js):
     dilengkapi jebakan fokus agar navigasi Tab tetap di dalam dialog. */

  /* ----------------------------------------------------------------------
     Ikat peristiwa
     ---------------------------------------------------------------------- */

  function bind() {
    el.diceBtn.addEventListener('click', () => {
      if (state.over) return;
      if (state.phase === 'rolling' || state.phase === 'moving' || state.phase === 'ai') return;
      if (!humanCanRoll()) {
        UT.Audio.play('reject');
        UT.toast('Belum giliranmu.', 'warning', 1500);
        return;
      }
      roll();
    });

    el.musicBtn.addEventListener('click', toggleMusic);

    const byId = (id) => document.getElementById(id);

    byId('btn-back').addEventListener('click', () => { window.location.href = 'menu.html'; });
    byId('btn-reset').addEventListener('click', () => {
      UT.Audio.play('press');
      UT.toast('Papan baru disiapkan.', 'info', 1500);
      startFresh();
    });
    byId('btn-rules').addEventListener('click', () => UT.openModal(el.rulesModal));
    byId('btn-share').addEventListener('click', shareResult);

    // Wake lock juga diminta pada interaksi pertama (butuh aktivasi pengguna).
    const firstGesture = () => { requestWakeLock(); };
    window.addEventListener('pointerdown', firstGesture, { once: true });
    window.addEventListener('keydown', firstGesture, { once: true });

    UT.$$('[data-close-modal]').forEach((b) => {
      b.addEventListener('click', () => UT.closeModal(byId(b.dataset.closeModal)));
    });

    // Menutup dialog lanjutkan tanpa memilih tidak boleh menyisakan layar kosong.
    const dismissResume = () => {
      if (!el.resumeModal || !el.resumeModal.classList.contains('show')) return false;
      UT.closeModal(el.resumeModal);
      UT.clearGame();
      startFresh();
      return true;
    };

    UT.$$('.modal').forEach((m) => {
      m.addEventListener('click', (e) => {
        if (e.target !== m) return;
        if (m === el.resumeModal) {
          dismissResume();
          return;
        }
        UT.closeModal(m);
      });
    });

    byId('btn-again').addEventListener('click', () => {
      UT.closeModal(el.winModal);
      startFresh();
    });
    byId('btn-menu').addEventListener('click', () => { window.location.href = 'menu.html'; });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (el.resumeModal && el.resumeModal.classList.contains('show')) {
          UT.closeModal(el.resumeModal);
          UT.clearGame();
          startFresh();
          return;
        }
        UT.$$('.modal.show').forEach(UT.closeModal);
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag === 'BUTTON' || tag === 'A') return;
        if (humanCanRoll()) {
          e.preventDefault();
          roll();
        }
      }
    });

    const relayout = UT.debounce(() => {
      drawLines();
      placeAllPieces();
    }, 130);
    window.addEventListener('resize', relayout);
    if ('ResizeObserver' in window && el.frame) {
      new ResizeObserver(relayout).observe(el.frame);
    }
  }

  /* ----------------------------------------------------------------------
     Mulai
     ---------------------------------------------------------------------- */

  function init() {
    cache();
    if (!el.grid) return; // bukan halaman permainan

    buildDice();
    bind();
    requestWakeLock();

    const saved = UT.loadGame();

    if (saved) {
      // Tampilkan papan yang tersimpan di belakang dialog, lalu tawarkan pilihan.
      restore(saved);
      renderStatic();
      if (!UT.Skills.restoreState(saved.skills)) UT.Skills.init(state.players);
      state.phase = 'idle';
      renderAll();
      UT.openModal(el.resumeModal);

      document.getElementById('btn-resume').addEventListener('click', () => {
        UT.closeModal(el.resumeModal);
        beginTurn();
        UT.toast('Melanjutkan permainan tersimpan.', 'info');
      });

      document.getElementById('btn-restart').addEventListener('click', () => {
        UT.closeModal(el.resumeModal);
        UT.clearGame();
        startFresh();
      });
    } else {
      startFresh();
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { drawLines(); placeAllPieces(); }).catch(() => {});
    }

    setTimeout(() => { if (el.loading) el.loading.classList.remove('show'); }, 320);
  }

  /** Cuplikan keadaan untuk pengujian otomatis. */
  UT.peek = () => ({
    phase: state.phase,
    turn: active() ? active().id : null,
    over: state.over,
    mode: state.mode,
    turns: state.turns,
    players: state.players.map((p) => ({ id: p.id, name: p.name, isAI: p.isAI, pos: p.pos })),
    ladders: { ...state.ladders },
    snakes: { ...state.snakes },
  });

  document.addEventListener('DOMContentLoaded', init);
})();
