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

  /* Glyph pion: warna saja tidak cukup untuk pengguna buta warna.
     Double-coding (warna + bentuk) sesuai praktik aksesibilitas 2026. */
  const PIECE_GLYPH = ['person', 'robot', 'token-triangle', 'token-square'];

  /* kepribadian AI: mempengaruhi agresivitas dan gaya bermain. */
  const PERSONALITIES = ['agresif', 'hati-hati', 'seimbang'];
  const PERSONALITY_LABEL = { agresif: 'Agresif', 'hati-hati': 'Hati-hati', seimbang: 'Seimbang' };

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
    gen: 0,          // token generasi: loop async lama berhenti saat papan diganti
  };

  /**
   * Naikkan generasi setiap kali permainan diganti. Semua loop async
   * (walk/settle/runAI/roll) memeriksa token ini setelah setiap await;
   * tanpa ini, klik "Papan baru" di tengah animasi membuat loop lama
   * menulis ke permainan baru (pion jalan sendiri, kemenangan palsu,
   * dua loop AI paralel).
   */
  const newGeneration = () => { state.gen += 1; return state.gen; };
  const stale = (gen) => gen !== state.gen;

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
    el.diceResult = document.getElementById('dice-result');
    el.hand = document.getElementById('skill-hand');
    el.scoreList = document.getElementById('score-list');
    el.tip = document.getElementById('skill-tip');
    el.winModal = document.getElementById('win-modal');
    el.winTitle = document.getElementById('win-title');
    el.winText = document.getElementById('win-text');
    el.resultPanel = document.getElementById('result-panel');
    el.resultText = document.getElementById('result-text');
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
    if (wakeLock || !('wakeLock' in navigator)) return;
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
    // Acak tetap acak, tapi dijamin adil (validator):
    //  - minimal satu tangga menembus zona akhir (> 78) supaya 20-an petak
    //    terakhir bukan sekadar lempar dadu;
    //  - kepala ular dibatasi satu per tercil 20 petak agar tidak menumpuk;
    //  - ular tidak boleh mendarat tepat di kaki tangga (jebakan tak adil).
    const ladders = {};
    const snakes = {};
    const used = new Set([1, FINISH]);
    const free = (n) => n >= 2 && n < FINISH && !used.has(n);

    const ladderAt = (n) => Object.hasOwn(ladders, n);
    const snakeAt = (n) => Object.hasOwn(snakes, n);

    let guard = 0;
    while (Object.keys(ladders).length < LADDERS && guard < 4000) {
      guard += 1;
      // Terakhir: paksa satu tangga ke zona tinggi.
      const lastLadder = Object.keys(ladders).length === LADDERS - 1
        && !Object.values(ladders).some((to) => to > 78);
      const from = lastLadder ? UT.randInt(52, 76) : UT.randInt(3, 78);
      const to = from + UT.randInt(7, 21);
      if (to >= FINISH || !free(from) || !free(to)) continue;
      if (lastLadder && to <= 78) continue;
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
      // Maksimal satu kepala ular per tercil 20 petak (80-98 zona akhir).
      const band = Math.floor(from / 20);
      const crowded = Object.keys(snakes).some((n) => Math.floor(Number(n) / 20) === band);
      if (crowded) continue;
      // Jangan letakkan ular tepat di kaki tangga.
      if (ladderAt(from)) continue;
      snakes[from] = to;
      used.add(from);
      used.add(to);
    }

    // Jaminan tangga zona akhir gagal terpenuhi? Regenerasi dari awal.
    if (!Object.values(ladders).some((to) => to > 78) && guard < 3900) {
      return buildBoard();
    }

    state.ladders = ladders;
    state.snakes = snakes;
    // Bentuk lengkung ular diacak SEKALI per papan, bukan tiap resize.
    state.snakeBend = {};
    Object.keys(snakes).forEach((n) => { state.snakeBend[n] = Math.random() < 0.5 ? 1 : -1; });
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

    /* Fase baca dulu (satu batch, tanpa interupsi tulis): menghindari
       layout thrash — sebelumnya baca/tulis berselang-seling 28 kali,
       tiap kali memicu reflow sinkron. */
    const laddersToPaint = [];
    const snakesToPaint = [];

    Object.entries(state.ladders).forEach(([a, b]) => {
      const from = centerOf(Number(a), rect);
      const to = centerOf(Number(b), rect);
      if (from && to) laddersToPaint.push([from, to]);
    });

    Object.entries(state.snakes).forEach(([a, b]) => {
      const from = centerOf(Number(a), rect);
      const to = centerOf(Number(b), rect);
      if (from && to) snakesToPaint.push([from, to, a]);
    });

    /* Fase tulis: bangun semua di fragment, append sekali. */
    const frag = document.createDocumentFragment();
    laddersToPaint.forEach(([from, to]) => paintLadder(from, to, frag));
    snakesToPaint.forEach(([from, to, key]) => paintSnake(from, to, key, frag));
    el.lines.appendChild(frag);
  }

  function paintLadder(from, to, frag) {
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

    frag.appendChild(g);
  }

  function paintSnake(from, to, key, frag) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    // Arah lengkung dari seed papan: ular tidak berubah bentuk saat resize.
    const bendDir = (state.snakeBend && state.snakeBend[key]) || (Math.random() < 0.5 ? 1 : -1);
    const bend = UT.clamp(len * 0.24, 12, 44) * bendDir;
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

    frag.appendChild(g);
  }

  /* ----------------------------------------------------------------------
     Pion
     ---------------------------------------------------------------------- */

  function drawPieces() {
    el.pieces.innerHTML = '';
    state.players.forEach((p, idx) => {
      const piece = document.createElement('div');
      piece.className = 'piece';
      piece.id = `piece-${p.id}`;
      piece.dataset.color = p.color;
      piece.dataset.no = String(p.id);
      const glyph = PIECE_GLYPH[idx % PIECE_GLYPH.length];
      piece.appendChild(UT.icon(glyph));

      // Lencana angka: cadangan non-warna yang tak ambigu di kotak kecil.
      const no = document.createElement('span');
      no.className = 'piece__no';
      no.textContent = String(p.id);
      no.setAttribute('aria-hidden', 'true');
      piece.appendChild(no);

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

    // Bersihkan tooltip yang mungkin tertinggal (renderAll dipanggil berkali-kali).
    closeTip();
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
      const blocked = cd > 0 || !canUse;
      card.setAttribute('aria-disabled', String(blocked));
      card.setAttribute('aria-label', `${skill.name}: ${skill.desc}`);

      card.appendChild(UT.icon(skill.icon));

      // Nama skill tercetak di wajah kartu: pemain baru tidak perlu
      // menebak dari ikon saja (masalah onboarding utama).
      const nameEl = document.createElement('span');
      nameEl.className = 'skill-card__name';
      nameEl.textContent = skill.name.split(' ').slice(0, 2).join(' ');
      card.appendChild(nameEl);

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

      // Konfirmasi 2-tap di layar sentuh: tap pertama = intip, tap kedua
      // (dalam 2 detik) = pakai. Di desktop, hover sudah cukup intip.
      let primed = false;
      let primeTimer = null;

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

        // Deteksi layar sentuh: tanpa hover, tap pertama tidak memakai.
        const touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
        if (touch && !primed) {
          primed = true;
          card.classList.add('is-primed');
          showTip();
          if (primeTimer) clearTimeout(primeTimer);
          primeTimer = setTimeout(() => {
            primed = false;
            card.classList.remove('is-primed');
            closeTip();
          }, 2000);
          return;
        }

        if (primeTimer) clearTimeout(primeTimer);
        primed = false;
        card.classList.remove('is-primed');
        closeTip();

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
    state.players.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'score-item';
      li.id = `score-${p.id}`;

      const disc = document.createElement('span');
      disc.className = 'score-item__disc';
      disc.dataset.color = p.color;
      disc.appendChild(UT.icon(PIECE_GLYPH[i % PIECE_GLYPH.length]));

      const body = document.createElement('span');
      body.className = 'score-item__body';

      const who = document.createElement('span');
      who.className = 'score-item__who';
      who.textContent = p.name;
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = p.isAI ? 'AI' : 'Kamu';
      who.appendChild(tag);
      if (p.isAI && p.personality) {
        const pers = document.createElement('span');
        pers.className = 'tag tag--pers';
        pers.textContent = PERSONALITY_LABEL[p.personality];
        who.appendChild(pers);
      }

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
    const grid = document.getElementById('board-grid');
    if (grid) {
      const summary = state.players.map((p) => `${p.name} di ${p.pos}`).join(', ');
      grid.setAttribute('aria-label', `Papan 10 kali 10. ${summary}.`);
    }

    // Banner "hampir menang": momen paling menegangkan di ular tangga.
    const banner = document.getElementById('almost-banner');
    if (banner && !state.over) {
      const near = state.players.filter((p) => p.pos >= 94 && p.pos < FINISH);
      if (near.length) {
        banner.hidden = false;
        banner.textContent = near.map((p) => `${p.name} butuh ${FINISH - p.pos}+ untuk menang!`).join(' ');
      } else {
        banner.hidden = true;
      }
    }
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
    // AI butuh papan untuk menilai langkah; tanpa ini ia menembak buta.
    getBoard: () => ({ ladders: state.ladders, snakes: state.snakes }),
    isBusy: () => state.phase === 'rolling' || state.phase === 'moving',

    moveTo(playerId, dest, message) {
      const p = playerById(playerId);
      if (!p) return;
      p.pos = UT.clamp(dest, 1, FINISH);
      placePiece(playerId);
      if (message) UT.toast(message, 'info');
      state.pending = settle(playerId, state.gen); // cek ular/tangga di tujuan
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
      // Aturan harus konsisten: pemain yang berpindah ke kepala ular tetap
      // tergigit, dan yang mendarat di kaki tangga tetap naik.
      state.pending = settle(b.id, state.gen);
    },

    pushBack(targetId, steps) {
      const t = playerById(targetId);
      if (!t) return;
      t.pos = Math.max(1, t.pos - steps);
      placePiece(targetId);
      UT.toast(`${t.name} mundur ke petak ${t.pos}.`, 'warning');
      state.pending = settle(targetId, state.gen);
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

    // Intensitas musik mengikuti keadaan: tenang bila pemimpin jauh di depan,
    // tegang bila ada yang di zona sprint.
    const leader = state.players.slice().sort((a, b) => b.pos - a.pos)[0];
    const human = state.players.find((p) => !p.isAI);
    const gap = leader && human ? leader.pos - human.pos : 0;
    const sprint = state.players.some((p) => p.pos >= 90 && p.pos < FINISH);
    if (UT.Audio && UT.Audio.setIntensity) {
      UT.Audio.setIntensity(sprint ? 'tense' : gap > 15 ? 'calm' : 'normal');
    }

    if (p && p.isAI) runAI();
  }

  function passTurn() {
    const p = active();
    if (p) UT.Skills.endTurn(p.id);

    // Comeback mechanic: pemain yang tertinggal jauh mendapat satu kartu
    // bonus acak. Mencegah "formalitas menonton 15 menit" di 4 pemain.
    const human = state.players.find((pp) => !pp.isAI);
    const leader = state.players.slice().sort((a, b) => b.pos - a.pos)[0];
    if (human && leader && leader.id !== human.id && leader.pos - human.pos >= 20) {
      const bonus = UT.Skills.grantBonus(human.id);
      if (bonus) {
        UT.Audio.play('skillready');
        UT.toast(`Kamu tertinggal jauh — dapat kartu bonus: ${bonus.name}.`, 'info', 2600);
        UT.narrate(`Kamu mendapat kartu bonus ${bonus.name}.`);
      }
    }

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

  async function walk(playerId, path, gen) {
    const quiet = UT.reducedMotion();

    for (const cell of path) {
      if (stale(gen)) return; // papan sudah diganti; hentikan langkah lama
      const p = playerById(playerId);
      const piece = document.getElementById(`piece-${playerId}`);
      if (!p || !piece) return;

      p.pos = cell;
      placePiece(playerId);
      if (!quiet) {
        piece.classList.remove('is-hopping');
        void piece.offsetWidth; // mulai ulang animasi
        piece.classList.add('is-hopping');
      }
      UT.Audio.play('hop');
      await wait(quiet ? 60 : 215);
    }
  }

  /** Tangani ular/tangga. true bila permainan berakhir. */
  async function settle(playerId, gen) {
    const p = playerById(playerId);
    if (!p) return false;

    // Hampir menang: bunyi chime + banner.
    if (p.pos >= 94 && p.pos < FINISH) {
      UT.Audio.play('nearwin');
    }

    await wait(250);
    if (stale(gen)) return false;

    if (state.ladders[p.pos]) {
      const bonus = UT.Skills.takeLadderBonus(playerId);
      const top = state.ladders[p.pos];
      const dest = UT.clamp(top + bonus, 1, FINISH);
      UT.Audio.play('ladder');
      UT.haptic([22, 40, 34]);
      UT.narrate(`${p.name} naik tangga ke petak ${dest}.`);
      const ladderTexts = bonus > 0
        ? [`${p.name} naik tangga ke ${top}, ditambah ${bonus} jadi ${dest}.`]
        : [`${p.name} naik tangga ke petak ${dest}.`, `Tangga ${p.pos} seperti ditunggu-tunggu — ${p.name} ke ${dest}.`];
      UT.toast(ladderTexts[UT.randInt(0, ladderTexts.length - 1)], 'success');
      p.pos = dest;
      placePiece(playerId);
      renderAll();
      await wait(400);
      if (stale(gen)) return false;

      // Bonus Pacu Tangga bisa mendaratkan pion tepat di kepala ular.
      // Tanpa pemeriksaan ini, pemain lolos dari gigitan ular.
      if (state.snakes[p.pos] && !UT.Skills.takeSnakeShield(playerId)) {
        const bite = state.snakes[p.pos];
        UT.Audio.play('snake');
        shakeFrame();
        UT.haptic([70, 50, 110]);
        UT.narrate(`${p.name} mendarat di kepala ular, turun ke petak ${bite}.`);
        UT.toast(`${p.name} mendarat di kepala ular, turun ke petak ${bite}.`, 'warning');
        p.pos = bite;
        placePiece(playerId);
        renderAll();
        await wait(400);
        if (stale(gen)) return false;
      }
    } else if (state.snakes[p.pos]) {
      // Zona Sprint (petak >= 90): ular "tidur" — hanya memundurkan 3,
      // bukan 7-21. Akhir permainan harus terasa seperti akhir, bukan siksa.
      if (p.pos >= 90) {
        UT.Audio.play('snake');
        UT.toast(`${p.name} melewati ular tidur di petak ${p.pos}, mundur 3.`, 'info');
        p.pos = Math.max(1, p.pos - 3);
        placePiece(playerId);
        renderAll();
        await wait(300);
        if (stale(gen)) return false;
      } else if (UT.Skills.takeSnakeShield(playerId)) {
        UT.Audio.play('skill');
        UT.toast(`${p.name} terlindung dari ular di petak ${p.pos}.`, 'info');
        UT.narrate(`${p.name} terlindung dari ular di petak ${p.pos}.`);
        renderAll();
      } else {
        const dest = state.snakes[p.pos];
        UT.Audio.play('snake');
        shakeFrame();
        UT.haptic([70, 50, 110]);
        // Hit-stop: jeda singkat agar gigitan terasa berat.
        if (!UT.reducedMotion()) await wait(80);
        const snakeTexts = [
          `${p.name} kena ular, turun ke petak ${dest}.`,
          `Ular di petak ${p.pos} rupanya lapar — ${p.name} turun ke ${dest}.`,
          `${p.name} digigit ular, meluncur ke petak ${dest}.`,
        ];
        UT.narrate(snakeTexts[0]);
        UT.toast(snakeTexts[UT.randInt(0, snakeTexts.length - 1)], 'warning');
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

    const gen = state.gen;

    // Tunggu resolusi skill yang masih berjalan (mis. teleportasi).
    if (state.pending) {
      await state.pending;
      state.pending = null;
      if (state.over || stale(gen)) return;
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
      if (stale(gen)) return;
      setFace(UT.randInt(1, 6));
      await wait(78);
    }
    el.dice.classList.remove('is-tumbling');

    const raw = UT.randInt(1, 6);
    const value = UT.Skills.modifyDice(p.id, raw, { pos: p.pos, finish: FINISH });
    setFace(value);
    UT.haptic(26);
    UT.narrate(`${p.name} melempar dadu: ${value}.`);
    if (el.diceResult) {
      el.diceResult.textContent = String(value);
      el.diceResult.classList.remove('is-showing');
      void el.diceResult.offsetWidth;
      el.diceResult.classList.add('is-showing');
    }

    // Hentakan mendarat: hanya bila gerakan diizinkan.
    if (!UT.reducedMotion()) {
      el.dice.classList.add('is-landing');
      setTimeout(() => el.dice && el.dice.classList.remove('is-landing'), 300);
    }

    el.diceLog.textContent = value !== raw
      ? `${p.name}: ${value} (dadu ${raw}, ditambah efek)`
      : `${p.name} mendapat ${value}.`;

    await wait(300);
    if (stale(gen)) return;

    state.phase = 'moving';
    renderAll();

    await walk(p.id, route(p.pos, value), gen);
    if (stale(gen)) return;
    renderAll();

    const done = await settle(p.id, gen);
    if (stale(gen)) return;
    if (done) return;

    if (UT.Skills.takeExtraTurn(p.id)) {
      UT.toast(`${p.name} mendapat giliran tambahan.`, 'info');
      beginTurn();
      return;
    }

    passTurn();
  }

  async function runAI() {
    const gen = state.gen;
    const p = active();
    if (!p || !p.isAI || state.over) return;

    state.phase = 'ai';
    renderAll();

    // Mode Cepat memangkas jeda berpikir AI, bukan hanya animasi.
    await wait(state.mode === 'speed' ? 260 : 680);
    if (state.over || stale(gen)) return;

    // Jangan bermain di belakang dialog yang sedang dibuka pemain.
    if (document.querySelector('.modal.show')) {
      state.phase = 'awaiting';
      renderAll();
      return;
    }

    UT.Skills.aiPlay(p.id, skillApi);
    if (state.pending) {
      await state.pending;
      state.pending = null;
    }
    if (state.over || stale(gen)) return;

    await wait(state.mode === 'speed' ? 240 : 600);
    if (state.over || stale(gen)) return;
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

    const humanWins = !winner.isAI;
    if (humanWins) {
      UT.Audio.play('win');
      UT.haptic([90, 60, 90, 60, 160]);
      if (window.UT.confetti) UT.confetti.burst();
    } else {
      UT.Audio.play('lose');
      UT.haptic([120, 80, 180]);
    }

    const human = state.players.find((p) => !p.isAI);
    const gap = human ? Math.max(0, FINISH - human.pos) : 0;
    const title = humanWins ? 'Kamu juara!' : `${winner.name} sampai duluan`;
    const text = humanWins
      ? `Mencapai petak ${FINISH} dalam ${state.turns} giliran.`
      : `Kamu tertinggal ${gap} petak. Coba lagi?`;

    if (el.winTitle) el.winTitle.textContent = title;
    if (el.winText) el.winText.textContent = text;

    // Tutup dialog lain dulu agar tidak menumpuk dua aria-modal=true.
    UT.$$('.modal.show').forEach(UT.closeModal);
    if (el.winModal) UT.openModal(el.winModal);

    // Panel hasil permanen di zona giliran: menutup modal tidak jadi jalan buntu.
    if (el.resultPanel) {
      if (el.resultText) el.resultText.textContent = `${title} — ${state.turns} giliran.`;
      el.resultPanel.hidden = false;
    }

    UT.narrate(`${winner.name} menang! Permainan selesai dalam ${state.turns} giliran.`);
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
    state.players = data.players.map((p) => ({ ...p }));
    state.turn = UT.clamp(parseInt(data.turn, 10) || 0, 0, state.players.length - 1);
    state.turns = Math.max(0, parseInt(data.turns, 10) || 0);
    state.ladders = data.ladders || {};
    state.snakes = data.snakes || {};
    state.snakeBend = {};
    Object.keys(state.snakes).forEach((n) => { state.snakeBend[n] = Math.random() < 0.5 ? 1 : -1; });
    state.over = false;
    state.pending = null;
    state.winner = null;
    newGeneration(); // simpanan lama tidak boleh menghidupkan kembali loop async lama
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
      personality: i === 0 ? null : PERSONALITIES[(i - 1) % PERSONALITIES.length],
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
    newGeneration();

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
    if (el.resultPanel) el.resultPanel.hidden = true;
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
      // Mengganti papan di tengah animasi membuat loop lama menulis ke
      // permainan baru. Tunggu giliran benar-benar selesai.
      if (state.phase === 'rolling' || state.phase === 'moving' || state.phase === 'ai') {
        UT.Audio.play('reject');
        UT.toast('Tunggu giliran ini selesai dulu.', 'warning', 1600);
        return;
      }
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
      // Tutup saja: simpanan tetap ada. Hapus hanya lewat pilihan eksplisit.
      if (!el.resumeModal || !el.resumeModal.classList.contains('show')) return false;
      UT.closeModal(el.resumeModal);
      return true;
    };

    UT.$$('.modal').forEach((m) => {
      m.addEventListener('click', (e) => {
        if (e.target !== m) return;
        if (m === el.resumeModal) {
          // Tidak boleh ditutup sembarangan: pilih lanjut atau mulai baru.
          return;
        }
        if (m === el.winModal && state.over) {
          // Izinkan menutup kartu menang, panel hasil tetap muncul.
          UT.closeModal(m);
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

    const resultAgain = byId('btn-result-again');
    if (resultAgain) resultAgain.addEventListener('click', () => { startFresh(); });
    const resultMenu = byId('btn-result-menu');
    if (resultMenu) resultMenu.addEventListener('click', () => { window.location.href = 'menu.html'; });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (el.resumeModal && el.resumeModal.classList.contains('show')) {
          // Escape diabaikan: wajib pilih Lanjutkan / Mulai Baru.
          return;
        }
        if (el.winModal && el.winModal.classList.contains('show')) {
          UT.closeModal(el.winModal);
          return;
        }
        UT.$$('.modal.show').forEach(UT.closeModal);
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        toggleMusic();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        if (state.phase === 'rolling' || state.phase === 'moving' || state.phase === 'ai') return;
        if (confirm('Papan baru? Progres saat ini hilang.')) {
          UT.Audio.play('press');
          startFresh();
        }
        return;
      }
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        if (!humanCanRoll()) return;
        const idx = parseInt(e.key, 10) - 1;
        const cards = el.hand ? Array.from(el.hand.querySelectorAll('.skill-card')) : [];
        if (cards[idx] && cards[idx].getAttribute('aria-disabled') !== 'true') cards[idx].click();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        // Dialog terbuka = konteks milik dialog. Jangan lempar dadu di baliknya.
        if (document.querySelector('.modal.show')) return;
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag === 'BUTTON' || tag === 'A') return;
        if (humanCanRoll()) {
          e.preventDefault();
          roll();
        }
      }
    });

    const relayout = UT.debounce(() => {
      // Koreksi posisi harus instan, bukan dianimasikan — kalau tidak, pion
      // terlihat "melayang" meluncur ke tempatnya setelah rotasi/resize.
      el.pieces.classList.add('is-relayout');
      drawLines();
      placeAllPieces();
      void el.pieces.offsetWidth;
      el.pieces.classList.remove('is-relayout');
    }, 80);
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

      const params = new URLSearchParams(window.location.search);
      if (params.get('resume') === '1') {
        // Niat sudah dinyatakan di menu: lanjutkan tanpa menanyakan lagi.
        beginTurn();
        UT.toast('Melanjutkan permainan tersimpan.', 'info');
      } else {
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
      }
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
