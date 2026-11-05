/** Mesin audio: SFX disintesis Web Audio API (tanpa berkas). */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private musicOn = false;
  private intensity = 0; // 0 tenang, 1 normal, 2 tegang
  private musicGain: GainNode | null = null;
  private beat = 0;

  /** Harus dipanggil setelah gestur pengguna (kebijakan autoplay). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.startMusic();
    // Perbarui skala saat intensitas berubah (timer ringan).
  }

  /** 0 = tenang, 1 = normal, 2 = tegang (combat). */
  setIntensity(level: 0 | 1 | 2): void {
    this.intensity = level;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.9;
  }

  get isMuted(): boolean { return this.muted; }

  /* ---- SFX ---- */

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; glide?: number } = {}): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glide), t0 + dur);
    const vol = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, opts: { gain?: number; freq?: number; type?: BiquadFilterType; delay?: number } = {}): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.frequency.value = opts.freq ?? 800;
    filter.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  roll(): void {
    this.noise(0.09, { gain: 0.25, freq: 1200 });
    this.noise(0.09, { gain: 0.2, freq: 900, delay: 0.09 });
    this.noise(0.1, { gain: 0.22, freq: 1400, delay: 0.18 });
  }

  hop(): void {
    this.tone(180, 0.09, { type: 'sine', gain: 0.18, glide: 110 });
    this.noise(0.05, { gain: 0.1, freq: 500 });
  }

  hit(): void {
    this.noise(0.14, { gain: 0.4, freq: 300, type: 'lowpass' });
    this.tone(90, 0.16, { type: 'square', gain: 0.12, glide: 55 });
  }

  hurt(): void {
    this.tone(220, 0.15, { type: 'sawtooth', gain: 0.12, glide: 140 });
  }

  coin(): void {
    this.tone(880, 0.1, { type: 'square', gain: 0.12 });
    this.tone(1320, 0.22, { type: 'square', gain: 0.1, delay: 0.08 });
  }

  fanfare(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', gain: 0.18, delay: i * 0.1 }));
  }

  death(): void {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone(f, 0.28, { type: 'triangle', gain: 0.16, delay: i * 0.14 }));
  }

  card(): void {
    this.tone(1175, 0.12, { type: 'sine', gain: 0.14 });
    this.tone(1568, 0.18, { type: 'sine', gain: 0.1, delay: 0.06 });
  }

  /* ---- Musik adaptif sederhana (loop pentatonik) ---- */

  private startMusic(): void {
    if (!this.ctx || !this.master || this.musicOn) return;
    this.musicOn = true;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.06;
    this.musicGain.connect(this.master);
    // Skala berkisar per intensitas (makin tegang makin atas/nada).
    const scaleFor = (i: number): number[] => (i === 0 ? [220, 262, 294, 330] : i === 1 ? [262, 294, 330, 392, 440] : [330, 392, 440, 523, 659, 784]);
    const step = () => {
      if (!this.ctx || !this.musicGain || !this.musicOn) return;
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const scale = scaleFor(this.intensity);
      const freq = scale[Math.floor(Math.random() * scale.length)] ?? 220;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.5, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t0);
      osc.stop(t0 + 0.85);
      this.beat += 1;
      // Lapis harmoni saat tegang: nada tinggi atas melodi.
      if (this.intensity === 2) {
        const osc3 = this.ctx.createOscillator();
        const g3 = this.ctx.createGain();
        osc3.type = 'sine';
        const hiScale = scaleFor(2);
        const hi = hiScale[Math.floor(Math.random() * hiScale.length)] ?? 659;
        osc3.frequency.setValueAtTime(hi * 2, t0);
        g3.gain.setValueAtTime(0.1, t0);
        g3.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        osc3.connect(g3);
        g3.connect(this.musicGain);
        osc3.start(t0);
        osc3.stop(t0 + 0.55);
      }
      if (this.beat % 4 === 0) {
        // Bass rendah tiap 4 ketuk.
        const osc2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(110, t0);
        g2.gain.setValueAtTime(0.3, t0);
        g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
        osc2.connect(g2);
        g2.connect(this.musicGain);
        osc2.start(t0);
        osc2.stop(t0 + 0.65);
      }
    };
    step();
    window.setInterval(step, 700);
  }
}

export const audio = new AudioEngine();

