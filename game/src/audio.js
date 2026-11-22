// VAULTBREAK sound: all effects are synthesized with WebAudio, no audio files.
// A tiny synth so the game stays fully offline and self-contained.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.alarmNodes = null;
  }

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopAlarmLoop();
    return this.muted;
  }

  tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  pickup() { this.tone(880, 0.09, 'sine', 0.16); this.tone(1318, 0.12, 'sine', 0.14, 0.07); }
  gold() { this.tone(659, 0.1, 'triangle', 0.18); this.tone(988, 0.1, 'triangle', 0.16, 0.08); this.tone(1318, 0.16, 'triangle', 0.14, 0.16); }
  vault() { this.tone(220, 0.25, 'square', 0.1, 0, 110); this.tone(440, 0.2, 'sine', 0.16, 0.2); this.tone(660, 0.3, 'sine', 0.16, 0.35); }
  door() { this.tone(180, 0.18, 'sawtooth', 0.07, 0, 320); }
  spotted() { this.tone(620, 0.14, 'square', 0.16); this.tone(466, 0.2, 'square', 0.16, 0.12); }
  busted() { this.tone(330, 0.3, 'sawtooth', 0.18, 0, 110); this.tone(220, 0.4, 'sawtooth', 0.16, 0.25, 90); }
  emp() { this.tone(1200, 0.35, 'sine', 0.14, 0, 120); }
  smoke() { this.tone(300, 0.4, 'sine', 0.1, 0, 60); }
  click() { this.tone(700, 0.05, 'square', 0.08); }
  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.16, i * 0.13));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, i * 0.16));
  }

  // Looping two-tone alarm while the heat meter is in the red.
  startAlarmLoop() {
    if (this.muted || this.alarmNodes) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 520;
    lfo.type = 'square';
    lfo.frequency.value = 1.4;
    lfoGain.gain.value = 140;
    gain.gain.value = 0.045;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    lfo.start();
    this.alarmNodes = { osc, lfo, gain };
  }

  stopAlarmLoop() {
    if (!this.alarmNodes) return;
    try { this.alarmNodes.osc.stop(); this.alarmNodes.lfo.stop(); } catch (e) {}
    this.alarmNodes = null;
  }
}
