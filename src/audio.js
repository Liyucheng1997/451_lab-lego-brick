// 全部声音由 WebAudio 实时合成：积木咔哒声、界面音效、温柔的八音盒背景音乐
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.musicVol = 0.5;
    this.timeOfDay = 'day';
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxOn ? 0.8 : 0;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicOn ? this.musicVol * 0.5 : 0;
    this.music.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet);
    wet.connect(this.master);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(this.reverb);
    this.noiseBuf = this.makeNoise();
    this.startMusic();
    return true;
  }

  impulse(sec) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }
  makeNoise() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfx) this.sfx.gain.value = on ? 0.8 : 0;
  }
  setMusic(on) {
    this.musicOn = on;
    if (this.music) this.music.gain.setTargetAtTime(on ? this.musicVol * 0.5 : 0, this.ctx.currentTime, 0.4);
  }

  // ---------- 基础发声 ----------
  tone(freq, dur, { type = 'sine', gain = 0.2, attack = 0.005, out, when = 0, slideTo, reverb = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out || this.sfx);
    if (reverb) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      g.connect(s);
      s.connect(this.reverbSend);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  noise(dur, { freq = 2500, q = 1, gain = 0.3, type = 'bandpass', when = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.02);
  }

  // ---------- 音效 ----------
  place() {
    if (!this.ensure()) return;
    const r = 0.9 + Math.random() * 0.2;
    this.noise(0.035, { freq: 3200 * r, q: 1.4, gain: 0.55 });
    this.noise(0.05, { freq: 1200 * r, q: 2, gain: 0.25, when: 0.012 });
    this.tone(240 * r, 0.08, { gain: 0.25, slideTo: 140 });
    this.tone(1900 * r, 0.03, { type: 'triangle', gain: 0.06, when: 0.014 });
  }
  remove() {
    if (!this.ensure()) return;
    this.tone(500, 0.12, { gain: 0.16, slideTo: 900 });
    this.noise(0.05, { freq: 4000, q: 0.8, gain: 0.25 });
  }
  paint() {
    if (!this.ensure()) return;
    this.tone(520, 0.16, { gain: 0.12, slideTo: 780, type: 'triangle', reverb: 0.3 });
  }
  rotate() {
    if (!this.ensure()) return;
    this.tone(1400, 0.04, { type: 'triangle', gain: 0.06 });
    this.noise(0.02, { freq: 5000, gain: 0.08 });
  }
  ui() {
    if (!this.ensure()) return;
    this.tone(880, 0.09, { gain: 0.07, type: 'sine', reverb: 0.2 });
  }
  error() {
    if (!this.ensure()) return;
    this.tone(260, 0.1, { gain: 0.1, type: 'triangle' });
    this.tone(200, 0.14, { gain: 0.1, type: 'triangle', when: 0.1 });
  }
  musicBox(n, when = 0, gain = 0.12, out) {
    const f = midi(n);
    this.tone(f, 1.4, { gain, when, out: out || this.sfx, reverb: 0.6 });
    this.tone(f * 3, 0.5, { gain: gain * 0.2, when, out: out || this.sfx });
    this.tone(f * 4.2, 0.25, { gain: gain * 0.08, when, out: out || this.sfx });
  }
  step() {
    if (!this.ensure()) return;
    this.musicBox(84, 0, 0.08);
    this.musicBox(91, 0.08, 0.06);
  }
  star() {
    if (!this.ensure()) return;
    [88, 91, 96, 100].forEach((n, i) => this.musicBox(n, i * 0.06, 0.07));
  }
  success() {
    if (!this.ensure()) return;
    [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => this.musicBox(n, i * 0.11, 0.11));
  }

  // ---------- 背景音乐（生成式八音盒 + 柔和铺底）----------
  startMusic() {
    const ctx = this.ctx;
    // Fmaj7 - Em7 - Dm7 - Cmaj7(add9)
    this.chords = [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59],
    ];
    this.scale = [72, 74, 76, 79, 81, 84, 86, 88];
    this.beat = 0;
    this.bpm = 64;
    this.nextTime = ctx.currentTime + 0.3;
    this.lastNote = 76;
    this.timer = setInterval(() => this.schedule(), 120);
  }
  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const spb = 60 / this.bpm;
    while (this.nextTime < ctx.currentTime + 0.4) {
      const when = this.nextTime - ctx.currentTime;
      const bar = Math.floor(this.beat / 4);
      const chord = this.chords[Math.floor(bar / 2) % 4];
      if (this.beat % 8 === 0) {
        // 铺底和弦
        for (const n of chord) this.pad(midi(n), spb * 8.2, when);
        this.pad(midi(chord[0] - 12), spb * 8, when, 0.05);
      }
      // 八音盒旋律
      const play = this.beat % 2 === 0 ? Math.random() < 0.75 : Math.random() < 0.3;
      if (play) {
        let idx = this.scale.indexOf(this.lastNote);
        if (idx < 0) idx = 2;
        idx = Math.max(0, Math.min(this.scale.length - 1, idx + Math.floor(Math.random() * 5) - 2));
        let n = this.scale[idx];
        if (this.beat % 4 === 0 && Math.random() < 0.6) n = chord[Math.floor(Math.random() * 4)] + 24;
        this.lastNote = n;
        this.musicBox(n, when, 0.05, this.music);
        if (Math.random() < 0.18) this.musicBox(n + 12, when + spb / 2, 0.025, this.music);
      }
      // 白天偶尔有鸟鸣，夜晚有蟋蟀
      if (this.beat % 4 === 2 && Math.random() < 0.12) {
        if (this.timeOfDay === 'day') this.chirp(when);
        else if (this.timeOfDay === 'night') this.cricket(when);
      }
      this.nextTime += spb;
      this.beat++;
    }
  }
  pad(freq, dur, when, gain = 0.035) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    o.detune.value = (Math.random() - 0.5) * 8;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 1.6);
    g.gain.linearRampToValueAtTime(gain * 0.7, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
    o.connect(f);
    f.connect(g);
    g.connect(this.music);
    const s = ctx.createGain();
    s.gain.value = 0.5;
    g.connect(s);
    s.connect(this.reverbSend);
    o.start(t);
    o.stop(t + dur + 1.6);
  }
  chirp(when) {
    const base = 3000 + Math.random() * 1200;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      this.tone(base, 0.09, { gain: 0.018, when: when + i * 0.13, slideTo: base * 1.35, out: this.music, reverb: 0.4 });
    }
  }
  cricket(when) {
    for (let i = 0; i < 6; i++) this.tone(4300, 0.025, { gain: 0.01, when: when + i * 0.05, type: 'triangle', out: this.music });
  }
}
