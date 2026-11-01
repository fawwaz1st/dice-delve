/* ==========================================================================
   Ular Tangga Modern — skills.js
   Katalog skill, cooldown, efek aktif, dan eksekusi. Logika murni:
   tidak menyentuh DOM. Bergantung pada core.js.
   ========================================================================== */

(function () {
  'use strict';

  const UT = window.UT;

  /* ----------------------------------------------------------------------
     Katalog. `icon` adalah nama simbol di icons.js, bukan emoji.
     ---------------------------------------------------------------------- */

  const CATALOG = [
    {
      id: 'double_roll',
      name: 'Dadu Ganda',
      icon: 'dice-pair',
      rarity: 'common',
      cooldown: 3,
      desc: 'Lemparan berikutnya dikocok dua kali, dipakai hasil terbaik.',
    },
    {
      id: 'dice_boost',
      name: 'Dorongan Dadu',
      icon: 'rocket',
      rarity: 'uncommon',
      cooldown: 3,
      desc: 'Lemparan berikutnya ditambah 2 (maksimal 6).',
    },
    {
      id: 'lucky_seven',
      name: 'Pasti Enam',
      icon: 'clover',
      rarity: 'rare',
      cooldown: 4,
      desc: 'Lemparan berikutnya dijamin keluar angka 6.',
    },
    {
      id: 'ladder_boost',
      name: 'Pacu Tangga',
      icon: 'ladder',
      rarity: 'uncommon',
      cooldown: 4,
      desc: 'Tangga berikutnya memberi 3 langkah ekstra.',
    },
    {
      id: 'snake_immunity',
      name: 'Perisai Ular',
      icon: 'shield',
      rarity: 'rare',
      cooldown: 5,
      desc: 'Kebal terhadap ular berikutnya.',
    },
    {
      id: 'extra_turn',
      name: 'Giliran Tambahan',
      icon: 'clock',
      rarity: 'rare',
      cooldown: 5,
      desc: 'Setelah giliran ini, langsung mendapat giliran lagi.',
    },
    {
      id: 'teleport',
      name: 'Teleportasi',
      icon: 'sparkles',
      rarity: 'epic',
      cooldown: 6,
      desc: 'Melompat maju 5 sampai 15 petak seketika.',
    },
    {
      id: 'swap_positions',
      name: 'Tukar Posisi',
      icon: 'swap',
      rarity: 'legendary',
      cooldown: 7,
      desc: 'Bertukar posisi dengan lawan yang paling unggul.',
    },
    {
      id: 'backward_move',
      name: 'Dorong Mundur',
      icon: 'backward',
      rarity: 'uncommon',
      cooldown: 4,
      desc: 'Lawan yang paling unggul didorong mundur 4 petak.',
    },
    {
      id: 'shield_break',
      name: 'Hancurkan Efek',
      icon: 'burst',
      rarity: 'epic',
      cooldown: 6,
      desc: 'Menghapus semua efek aktif milik seluruh lawan.',
    },
  ];

  const BY_ID = Object.fromEntries(CATALOG.map((s) => [s.id, s]));

  const HUMAN_HAND = 3;
  const AI_HAND = 2;

  /* ----------------------------------------------------------------------
     State
     ---------------------------------------------------------------------- */

  let hands = {};      // playerId -> skillId[]
  let cooldowns = {};  // playerId -> { skillId: sisaGiliran }
  let live = {};       // playerId -> Set(kunci efek aktif)

  /* ----------------------------------------------------------------------
     Inisialisasi
     ---------------------------------------------------------------------- */

  function init(players) {
    hands = {};
    cooldowns = {};
    live = {};

    players.forEach((p) => {
      const size = p.isAI ? AI_HAND : HUMAN_HAND;
      hands[p.id] = UT.shuffle(CATALOG).slice(0, size).map((s) => s.id);
      cooldowns[p.id] = {};
      live[p.id] = new Set();
    });
  }

  /* ----------------------------------------------------------------------
     Kueri
     ---------------------------------------------------------------------- */

  const getSkills = (id) => (hands[id] || []).map((sid) => BY_ID[sid]).filter(Boolean);
  const getCooldown = (id, sid) => (cooldowns[id] && cooldowns[id][sid]) || 0;
  const getLive = (id) => Array.from(live[id] || []);
  const hasLive = (id, key) => Boolean(live[id] && live[id].has(key));

  function consume(id, key) {
    if (hasLive(id, key)) {
      live[id].delete(key);
      return true;
    }
    return false;
  }

  /* ----------------------------------------------------------------------
     Kait efek (dipanggil game.js)
     ---------------------------------------------------------------------- */

  /**
   * Petak pendaratan untuk sejumlah langkah, mengikuti aturan pantul di
   * petak akhir. Dipakai untuk memastikan efek tidak pernah merugikan:
   * di petak 96, "dadu +2" dengan lemparan 4 justru mengubah kemenangan
   * menjadi pantul ke 98.
   */
  function landing(pos, steps, finish) {
    const remaining = finish - pos;
    return steps <= remaining ? pos + steps : finish - (steps - remaining);
  }

  /**
   * Terapkan efek pada nilai dadu. Mengembalikan nilai akhir.
   *
   * Tiga efek berdeskripsi "lemparan berikutnya" (Dadu Ganda, Dorongan Dadu,
   * Pasti Enam) dihitung dalam SATU lintasan supaya tidak ada yang bocor ke
   * giliran berikutnya. Efek hanya dikonsumsi bila benar-benar berkontribusi,
   * dan bila nilai berbuff mendarat lebih jauh dari finish daripada nilai asli
   * (efek merugikan), nilai asli yang dipakai dan efeknya tetap tersimpan.
   *
   * @param {{pos?: number, finish?: number}} [ctx] posisi pemain saat ini
   */
  function modifyDice(playerId, value, ctx) {
    const finish = ctx && ctx.finish ? ctx.finish : 100;
    const pos = ctx && typeof ctx.pos === 'number' ? ctx.pos : 1;

    const hasSeven = hasLive(playerId, 'lucky_seven');
    const hasDouble = hasLive(playerId, 'double_roll');
    const hasBoost = hasLive(playerId, 'dice_boost');
    if (!hasSeven && !hasDouble && !hasBoost) return value;

    let out = value;
    let usedDouble = false;
    let usedBoost = false;
    let usedSeven = false;

    if (hasDouble) {
      const second = UT.randInt(1, 6);
      if (second > out) { out = second; usedDouble = true; }
    }
    if (hasBoost && out < 6) { out = Math.min(6, out + 2); usedBoost = true; }
    if (hasSeven) { out = 6; usedSeven = true; }

    // Efek tidak boleh merugikan: bandingkan pendaratan akhir.
    if (out !== value && landing(pos, out, finish) < landing(pos, value, finish)) {
      return value; // efek tetap aktif untuk lemparan berikutnya
    }

    if (usedSeven) consume(playerId, 'lucky_seven');
    if (usedDouble) live[playerId].delete('double_roll');
    if (usedBoost) consume(playerId, 'dice_boost');
    return out;
  }

  /** Bonus langkah dari tangga; 0 bila tidak ada efek. */
  const takeLadderBonus = (id) => (consume(id, 'ladder_boost') ? 3 : 0);

  /** true bila ular berhasil dinegasikan. */
  const takeSnakeShield = (id) => consume(id, 'snake_immunity');

  /** true bila pemain mendapat giliran ekstra. */
  const takeExtraTurn = (id) => consume(id, 'extra_turn');

  /**
   * Beri satu kartu bonus acak kepada pemain yang tertinggal jauh.
   * Hanya bila tangan belum penuh (maks 4) dan kartu belum dimiliki.
   * @returns {object|null} skill yang diberikan, atau null
   */
  function grantBonus(playerId) {
    if (!hands[playerId]) return null;
    if (hands[playerId].length >= 4) return null;
    const owned = new Set(hands[playerId]);
    const pool = CATALOG.filter((s) => !owned.has(s.id));
    if (pool.length === 0) return null;
    const pick = UT.pick(pool);
    hands[playerId].push(pick.id);
    if (!cooldowns[playerId]) cooldowns[playerId] = {};
    cooldowns[playerId][pick.id] = 0;
    return pick;
  }

  /** Akhir giliran: turunkan semua cooldown pemain ini. */
  function endTurn(playerId) {
    const cd = cooldowns[playerId];
    if (!cd) return;
    Object.keys(cd).forEach((sid) => {
      cd[sid] = Math.max(0, cd[sid] - 1);
    });
  }

  function clearEffectsOf(playerId) {
    const n = live[playerId] ? live[playerId].size : 0;
    live[playerId] = new Set();
    return n;
  }

  /* ----------------------------------------------------------------------
     Cuplikan keadaan (dipakai simpan & lanjutkan)
     ---------------------------------------------------------------------- */

  function snapshot() {
    return {
      hands,
      cooldowns,
      live: Object.fromEntries(Object.entries(live).map(([id, set]) => [id, Array.from(set)])),
    };
  }

  /**
   * Mengembalikan true bila cuplikan valid dan dipakai.
   * Setiap pemain dinormalisasi: save lama/rusak yang kehilangan bagian
   * `live` atau `cooldowns` tidak boleh membuat useSkill melempar TypeError.
   */
  function restoreState(data) {
    if (!data || typeof data !== 'object' || !data.hands) return false;

    hands = {};
    cooldowns = {};
    live = {};

    Object.entries(data.hands).forEach(([id, list]) => {
      const key = String(id);
      hands[key] = Array.isArray(list) ? list.filter((sid) => BY_ID[sid]) : [];

      const cd = data.cooldowns && data.cooldowns[key];
      cooldowns[key] = cd && typeof cd === 'object' ? { ...cd } : {};

      const arr = data.live && data.live[key];
      live[key] = new Set(Array.isArray(arr) ? arr.filter((k) => typeof k === 'string') : []);
    });

    return true;
  }

  /* ----------------------------------------------------------------------
     Eksekusi
     ---------------------------------------------------------------------- */

  /**
   * Pakai skill.
   * `api` disediakan game.js:
   * { getPlayers, nameOf, finishCell, moveTo, swapWith, pushBack,
   *   clearOpponentEffects, refreshUI, isBusy }
   *
   * @returns {{ok: boolean, message: string}}
   */
  function useSkill(playerId, skillId, api) {
    const skill = BY_ID[skillId];
    if (!skill) return { ok: false, message: 'Skill tidak ditemukan.' };
    if (!(hands[playerId] || []).includes(skillId)) {
      return { ok: false, message: 'Skill ini bukan milikmu.' };
    }
    if (api.isBusy && api.isBusy()) {
      return { ok: false, message: 'Tunggu giliran selesai dulu.' };
    }
    const cd = getCooldown(playerId, skillId);
    if (cd > 0) {
      return { ok: false, message: `Masih cooldown ${cd} giliran.` };
    }

    const res = run(playerId, skill, api);
    if (res.ok) {
      cooldowns[playerId][skillId] = skill.cooldown;
      api.refreshUI();
    }
    return res;
  }

  function run(playerId, skill, api) {
    const all = api.getPlayers();
    const self = all.find((p) => p.id === playerId);
    if (!self) return { ok: false, message: 'Pemain tidak ditemukan.' };

    const rivals = all.filter((p) => p.id !== playerId);
    const leader = rivals.slice().sort((a, b) => b.pos - a.pos)[0];

    switch (skill.id) {
      case 'double_roll':
        live[playerId].add('double_roll');
        return { ok: true, message: 'Dadu Ganda siap untuk lemparan berikutnya.' };

      case 'dice_boost':
        live[playerId].add('dice_boost');
        return { ok: true, message: 'Lemparan berikutnya ditambah 2.' };

      case 'lucky_seven':
        live[playerId].add('lucky_seven');
        return { ok: true, message: 'Lemparan berikutnya pasti 6.' };

      case 'ladder_boost':
        live[playerId].add('ladder_boost');
        return { ok: true, message: 'Tangga berikutnya memberi 3 langkah ekstra.' };

      case 'snake_immunity':
        live[playerId].add('snake_immunity');
        return { ok: true, message: 'Perisai Ular aktif untuk ular berikutnya.' };

      case 'extra_turn':
        live[playerId].add('extra_turn');
        return { ok: true, message: 'Giliran tambahan disiapkan.' };

      case 'teleport': {
        const dest = UT.clamp(self.pos + UT.randInt(5, 15), 1, api.finishCell());
        if (dest === self.pos) {
          return { ok: false, message: 'Sudah di petak akhir, teleportasi tidak berguna.' };
        }
        api.moveTo(playerId, dest, `${self.name} berteleportasi ke petak ${dest}.`);
        return { ok: true, message: `Teleportasi ke petak ${dest}.` };
      }

      case 'swap_positions': {
        if (!leader || leader.pos <= 1) {
          return { ok: false, message: 'Belum ada lawan yang bisa ditukar.' };
        }
        api.swapWith(playerId, leader.id);
        return { ok: true, message: `Bertukar posisi dengan ${leader.name}.` };
      }

      case 'backward_move': {
        if (!leader || leader.pos <= 1) {
          return { ok: false, message: 'Belum ada lawan yang bisa didorong.' };
        }
        api.pushBack(leader.id, 4);
        return { ok: true, message: `${leader.name} terdorong mundur 4 petak.` };
      }

      case 'shield_break': {
        const n = api.clearOpponentEffects(playerId);
        if (n === 0) return { ok: false, message: 'Tidak ada efek lawan yang aktif.' };
        return { ok: true, message: `${n} efek lawan dihapus.` };
      }

      default:
        return { ok: false, message: 'Efek skill tidak dikenal.' };
    }
  }

  /**
   * AI memilih skill dengan penilaian situasi, bukan acak murni.
   *
   * Sejak papan dibuka lewat api.getBoard(), AI tidak lagi buta: ia tahu
   * tangga/ular di depannya dan menyesuaikan bobot. Ambang agresivitas kini
   * kontinu, dan efek dadu tidak dipakai bila justru mendekatkan ke pantulan.
   *
   * @returns {boolean} true bila benar-benar memakai skill
   */
  function aiPlay(playerId, api) {
    const ready = getSkills(playerId).filter((s) => getCooldown(playerId, s.id) === 0);
    if (ready.length === 0) return false;

    const all = api.getPlayers();
    const self = all.find((p) => p.id === playerId);
    if (!self) return false;

    const leader = all.filter((p) => p.id !== playerId).sort((a, b) => b.pos - a.pos)[0];
    const behind = leader ? leader.pos - self.pos : 0;
    const finish = api.finishCell ? api.finishCell() : 100;
    const board = api.getBoard ? api.getBoard() : { ladders: {}, snakes: {} };

    /** Apakah sejumlah langkah dari posisi kini mendarat di kepala ular? */
    const landsOnSnake = (steps) => Boolean(board.snakes[landing(self.pos, steps, finish)]);
    /** Apakah mendarat di kaki tangga? */
    const landsOnLadder = (steps) => Boolean(board.ladders[landing(self.pos, steps, finish)]);
    /** Apakah langkah ini langsung menang? */
    const wins = (steps) => landing(self.pos, steps, finish) >= finish;

    /* Agresivitas kontinu: makin tertinggal, makin sering memakai skill.
       Kepribadian menggeser baseline: agresif +0.12, hati-hati -0.12. */
    const pers = self.personality || 'seimbang';
    const baseAggr = pers === 'agresif' ? 0.46 : pers === 'hati-hati' ? 0.22 : 0.34;
    const aggression = UT.clamp(baseAggr + behind * 0.022, 0.18, 0.82);
    if (Math.random() > aggression) return false;

    const weight = {
      lucky_seven: 60,
      extra_turn: 64,
      double_roll: 52,
      dice_boost: 50,
      ladder_boost: 42,
      snake_immunity: 46,
      teleport: behind > 8 ? 86 : 28,
      swap_positions: behind > 10 ? 92 : 16,
      backward_move: behind > 0 ? 46 + behind * 3 : 24,
      shield_break: 28,
    };

    /* Kepribadian mempengaruhi preferensi kartu. */
    if (pers === 'agresif') {
      weight.teleport += 12; weight.backward_move += 10; weight.dice_boost += 6;
      weight.snake_immunity -= 8;
    } else if (pers === 'hati-hati') {
      weight.snake_immunity += 14; weight.extra_turn += 10; weight.ladder_boost += 8;
      weight.teleport -= 10; weight.backward_move -= 6;
    }

    /* Penyesuaian sadar-papan. */
    if (landsOnLadder(6)) weight.lucky_seven += 25;
    if (landsOnLadder(6) || landsOnLadder(5)) weight.dice_boost += 12;
    if (wins(6) && self.pos >= finish - 6) weight.lucky_seven += 40;
    // Jangan bakar dadu kalau semua hasil justru menabrak ular.
    if ([1, 2, 3, 4, 5, 6].every(landsOnSnake)) {
      weight.lucky_seven -= 30;
      weight.dice_boost -= 20;
      weight.double_roll -= 20;
    }
    // Perisai ular bernilai bila ular ada tak jauh di depan.
    if (Object.keys(board.snakes).some((n) => Number(n) > self.pos && Number(n) <= self.pos + 12)) {
      weight.snake_immunity += 26;
    }
    // Pacu tangga hanya berguna bila masih ada tangga di depan.
    const ladderAhead = Object.keys(board.ladders).some((n) => Number(n) > self.pos);
    if (!ladderAhead) weight.ladder_boost = 0;
    // Efek dadu beracun bila di zona pantul dan buff malah merugikan.
    if (self.pos > finish - 6) {
      weight.dice_boost -= 25;
      weight.double_roll -= 15;
    }

    const scored = ready
      .map((s) => ({ skill: s, w: Math.max(0, weight[s.id] || 40) }))
      .filter((x) => x.w > 0)
      .sort((a, b) => b.w - a.w);
    if (scored.length === 0) return false;

    const total = scored.reduce((sum, x) => sum + x.w, 0);
    const draw = Math.random() * total;
    let acc = 0;
    let choice = scored[0];
    for (const x of scored) {
      acc += x.w;
      if (draw <= acc) { choice = x; break; }
    }

    const res = useSkill(playerId, choice.skill.id, api);
    if (res.ok) {
      UT.toast(`${api.nameOf(playerId)} memakai ${choice.skill.name}.`, 'info');
      return true;
    }
    return false;
  }

  /* ----------------------------------------------------------------------
     Ekspor
     ---------------------------------------------------------------------- */

  UT.Skills = {
    init,
    getSkills,
    getCooldown,
    getLive,
    modifyDice,
    takeLadderBonus,
    takeSnakeShield,
    takeExtraTurn,
    grantBonus,
    endTurn,
    useSkill,
    aiPlay,
    clearEffectsOf,
    snapshot,
    restoreState,
  };
})();
