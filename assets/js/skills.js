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

  /** Terapkan efek pada nilai dadu. Mengembalikan nilai akhir. */
  function modifyDice(playerId, value) {
    if (consume(playerId, 'lucky_seven')) return 6;

    let out = value;
    if (hasLive(playerId, 'double_roll')) {
      live[playerId].delete('double_roll');
      out = Math.max(out, UT.randInt(1, 6));
    }
    if (consume(playerId, 'dice_boost')) out = Math.min(6, out + 2);
    return out;
  }

  /** Bonus langkah dari tangga; 0 bila tidak ada efek. */
  const takeLadderBonus = (id) => (consume(id, 'ladder_boost') ? 3 : 0);

  /** true bila ular berhasil dinegasikan. */
  const takeSnakeShield = (id) => consume(id, 'snake_immunity');

  /** true bila pemain mendapat giliran ekstra. */
  const takeExtraTurn = (id) => consume(id, 'extra_turn');

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

  /** Mengembalikan true bila cuplikan valid dan dipakai. */
  function restoreState(data) {
    if (!data || typeof data !== 'object' || !data.hands) return false;
    hands = data.hands;
    cooldowns = data.cooldowns || {};
    live = {};
    Object.entries(data.live || {}).forEach(([id, arr]) => {
      live[id] = new Set(Array.isArray(arr) ? arr : []);
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
   * AI memilih skill dengan penilaian situasi, bukan acak murni:
   * tertinggal jauh -> efek lompat bernilai tinggi; unggul -> efek
   * lompat justru berbahaya. Dipilih dengan roulette berbobot.
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

    /* Makin tertinggal, makin sering memakai skill. */
    const desperation = behind > 10 ? 0.7 : behind > 4 ? 0.58 : 0.46;
    if (Math.random() > desperation) return false;

    const WEIGHT = {
      lucky_seven: 70,
      extra_turn: 64,
      double_roll: 55,
      dice_boost: 50,
      ladder_boost: 42,
      snake_immunity: 44,
      teleport: behind > 8 ? 88 : 30,
      swap_positions: behind > 10 ? 92 : 18,
      backward_move: behind > 0 ? 48 + behind * 3 : 26,
      shield_break: 28,
    };

    const scored = ready
      .map((s) => ({ skill: s, w: WEIGHT[s.id] || 40 }))
      .sort((a, b) => b.w - a.w);
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
    endTurn,
    useSkill,
    aiPlay,
    clearEffectsOf,
    snapshot,
    restoreState,
  };
})();
