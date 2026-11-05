/* ==========================================================================
   Ular Tangga Modern — audio.js
   Suara disintesis dengan Web Audio API, dipilih agar cocok dengan material:
   ketukan kayu, gesekan kertas, gulungan dadu di atas meja.

   Semua pemanggilan aman dilakukan kapan saja; audio baru benar-benar
   berbunyi setelah interaksi pertama pengguna (kebijakan browser).
   ========================================================================== */

(function () {
  'use strict';

  const UT = window.UT;

  let ctx = null;
  let master = null;
  let sfx = null;
  let bgm = null;

  let musicOn = false;
  let musicTimer = null;
  let musicStep = 0;
  let musicTrack = null;
  // Intensitas musik: calm (tenang) | normal | tense (tegang). Berubah
  // sesuai keadaan permainan (selisih posisi, zona sprint).
  let musicIntensity = 'normal';
  let beatMultiplier = 1;

  const MUSIC_LEVEL = 0.14;
  const SFX_LEVEL = 0.42;

  /* Melodi pendek bernuansa kotak musik, bukan arpeggio acak. */
  const TRACKS = [
    { notes: [262, 330, 392, 330, 294, 349, 392, 349], beat: 560, wave: 'triangle' },
    { notes: [220, 277, 330, 277, 247, 294, 330, 294], beat: 620, wave: 'sine' },
    { notes: [294, 370, 440, 370, 330, 392, 440, 392], beat: 520, wave: 'triangle' },
  ];

  function boot() {
    if (ctx) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;

      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);

      sfx = ctx.createGain();
      sfx.gain.value = SFX_LEVEL;
      sfx.connect(master);

      bgm = ctx.createGain();
      bgm.gain.value = 0;
      bgm.connect(master);
      return true;
    } catch (err) {
      console.warn('[UT.Audio] Web Audio tidak tersedia:', err);
      ctx = null;
      return false;
    }
  }

  const settings = () => UT.getSettings();

  /* ----------------------------------------------------------------------
     Pembangkit suara
     ---------------------------------------------------------------------- */

  /** Nada pendek dengan amplop cepat. */
  function blip(freq, dur, { wave = 'sine', vol = 0.5, at = 0, glide = null } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t0 + dur);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  /** Ketukan kayu: derau pendek yang difilter, bukan nada. */
  function knock(vol = 0.5, at = 0, cutoff = 1400) {
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const dur = 0.09;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frames; i += 1) {
      // Derau yang meredam cepat, menyerupai benturan kayu.
      const decay = Math.pow(1 - i / frames, 3.4);
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 1.1;

    const g = ctx.createGain();
    g.gain.value = vol;

    src.connect(filter);
    filter.connect(g);
    g.connect(sfx);
    src.start(t0);
  }

  const VOICE = {
    /* UI */
    press: () => knock(0.5, 0, 1900),
    reject: () => { blip(150, 0.16, { wave: 'square', vol: 0.3 }); knock(0.35, 0, 700); },

    /* Dadu: beberapa ketukan tidak beraturan lalu satu ketukan tegas. */
    roll() {
      for (let i = 0; i < 8; i += 1) {
        knock(0.28, i * 0.055, 900 + Math.random() * 900);
      }
      knock(0.62, 0.5, 1500);
    },

    /* Pion melompat: ketukan ringan. */
    hop: () => knock(0.34, 0, 2100),

    /* Naik tangga: nada menanjak pendek. */
    ladder() {
      [392, 494, 587, 698].forEach((f, i) => {
        blip(f, 0.15, { wave: 'triangle', vol: 0.32, at: i * 0.075 });
      });
    },

    /* Kena ular: gelincir menurun. */
    snake() {
      blip(560, 0.62, { wave: 'sawtooth', vol: 0.2, glide: 120 });
      knock(0.3, 0.05, 600);
    },

    /* Skill aktif: kilau pendek. */
    skill() {
      [523, 659, 784].forEach((f, i) => {
        blip(f, 0.17, { wave: 'sine', vol: 0.3, at: i * 0.065 });
      });
    },

    /* Ganti giliran: ketukan lembut. */
    turn: () => knock(0.3, 0, 1100),

    /* Menang: fanfare pendek. */
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        blip(f, 0.34, { wave: 'triangle', vol: 0.38, at: i * 0.15 });
      });
    },

    /* Kalah: nada menurun, lembut — bukan kegagalan, hanya "coba lagi". */
    lose() {
      [659, 523, 392].forEach((f, i) => {
        blip(f, 0.26, { wave: 'triangle', vol: 0.22, at: i * 0.18 });
      });
      knock(0.2, 0.62, 800);
    },

    /* Hampir menang: chime singkat. */
    nearwin() {
      [784, 988, 1319].forEach((f, i) => {
        blip(f, 0.16, { wave: 'sine', vol: 0.26, at: i * 0.08 });
      });
    },

    /* Skill siap lagi: ping kecil. */
    skillready() {
      blip(880, 0.12, { wave: 'sine', vol: 0.2 });
      blip(1320, 0.08, { wave: 'sine', vol: 0.14, at: 0.09 });
    },

    /* Langkah pion AI: lebih pelan agar tidak berisik. */
    step: () => knock(0.2, 0, 1500),

    /* Combo: dua nada menanjak. */
    combo() {
      blip(523, 0.12, { wave: 'triangle', vol: 0.24 });
      blip(784, 0.14, { wave: 'triangle', vol: 0.28, at: 0.1 });
    },

    /* Giliranmu: dua ketukan lembut yang khas. */
    yourturn() {
      knock(0.22, 0, 1600);
      knock(0.28, 0.14, 2100);
    },
  };

  /* ----------------------------------------------------------------------
     Musik latar
     ---------------------------------------------------------------------- */

  function musicStepPlay() {
    if (!musicOn || !ctx) return;
    const track = musicTrack;
    const freq = track.notes[musicStep % track.notes.length];
    musicStep += 1;

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = track.wave;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
    osc.connect(g);
    g.connect(bgm);
    osc.start(t0);
    osc.stop(t0 + 0.95);

    // Bass lembut tiap empat ketukan supaya tidak monoton.
    if (musicStep % 4 === 0) {
      const b = ctx.createOscillator();
      const bg = ctx.createGain();
      b.type = 'sine';
      b.frequency.value = freq / 2;
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.linearRampToValueAtTime(0.45, t0 + 0.07);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
      b.connect(bg);
      bg.connect(bgm);
      b.start(t0);
      b.stop(t0 + 1.4);
    }

    musicTimer = setTimeout(musicStepPlay, Math.round(track.beat * beatMultiplier));
  }

  function startMusic() {
    if (!boot() || musicOn) return;
    if (!settings().music) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    musicTrack = UT.pick(musicIntensity === 'tense' ? [TRACKS[2]] : musicIntensity === 'calm' ? [TRACKS[1]] : TRACKS);
    beatMultiplier = musicIntensity === 'calm' ? 1.25 : musicIntensity === 'tense' ? 0.72 : 1;
    musicStep = 0;
    musicOn = true;
    bgm.gain.cancelScheduledValues(ctx.currentTime);
    bgm.gain.linearRampToValueAtTime(MUSIC_LEVEL, ctx.currentTime + 1.1);
    musicStepPlay();
  }

  function stopMusic() {
    if (!ctx) return;
    musicOn = false;
    clearTimeout(musicTimer);
    musicTimer = null;
    bgm.gain.cancelScheduledValues(ctx.currentTime);
    bgm.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
  }

  /* ----------------------------------------------------------------------
     API
     ---------------------------------------------------------------------- */

  /** Ubah intensitas musik. Dipanggil dari game.js sesuai keadaan. */
  function setIntensity(level) {
    // Simpan dulu: bila ctx belum dibuat, terapkan saat boot/startMusic.
    if (level === musicIntensity) return;
    musicIntensity = level;
    if (!ctx) return;
    if (level === 'calm') beatMultiplier = 1.25;
    else if (level === 'tense') beatMultiplier = 0.72;
    else beatMultiplier = 1;
    // Pilih trek yang cocok dengan intensitas. Reset langkah agar
    // perpindahan tidak melompat ke index nada baru.
    if (musicOn) {
      musicTrack = UT.pick(level === 'tense' ? [TRACKS[2]] : level === 'calm' ? [TRACKS[1]] : TRACKS);
      musicStep = 0;
    }
  }

  UT.Audio = {
    play(name) {
      if (!settings().sound) return;
      if (!boot()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const fn = VOICE[name];
      if (fn) fn();
    },

    startMusic,
    stopMusic,
    setIntensity,

    /** Terapkan preferensi musik terkini setelah pengaturan berubah. */
    syncMusic() {
      if (settings().music) startMusic();
      else stopMusic();
    },

    /** Dipanggil dari interaksi pertama pengguna. */
    unlock() {
      if (!boot()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (settings().music) startMusic();
    },
  };

  const unlockOnce = () => {
    UT.Audio.unlock();
    window.removeEventListener('pointerdown', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce, { once: true });
  window.addEventListener('keydown', unlockOnce, { once: true });
})();
