// js/game/audio.js - 8-Bit Game Boy Color Chiptune Synthesizer + Hardware Volume Control

export class ChiptuneAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.7; // 0.0 to 1.0 (controlled by hardware VolumeUp/VolumeDown)
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.step = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  adjustVolume(delta) {
    this.init();
    this.volume = Math.max(0, Math.min(1, Math.round((this.volume + delta) * 10) / 10));
    if (this.volume > 0 && !this.enabled) {
      this.enabled = true;
    }
    this.playTone(520 + this.volume * 440, 0.06, 'square', 0.14);
    return this.volume;
  }

  playTone(freq, duration = 0.08, type = 'square', gainVal = 0.12, slideFreq = null) {
    if (!this.enabled || this.volume <= 0) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const scaledGain = Math.max(0.001, gainVal * this.volume);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideFreq) {
      osc.frequency.linearRampToValueAtTime(slideFreq, now + duration);
    }

    gain.gain.setValueAtTime(scaledGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  playNoise(duration = 0.08, gainVal = 0.1) {
    if (!this.enabled || this.volume <= 0) return;
    this.init();
    if (!this.ctx) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.001, gainVal * this.volume), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  btnClick() {
    this.playTone(720, 0.045, 'square', 0.11, 980);
  }

  paddleHit(power = 1) {
    const base = power > 1.3 ? 210 : 320;
    this.playTone(base, 0.07, 'square', 0.16, base * 1.65);
    this.playNoise(0.04, 0.08);
  }

  smashHit() {
    this.playNoise(0.14, 0.2);
    this.playTone(150, 0.18, 'sawtooth', 0.2, 620);
  }

  groundBounce() {
    this.playTone(180, 0.045, 'triangle', 0.12, 110);
  }

  glassBounce() {
    this.playTone(920, 0.06, 'square', 0.1, 1360);
  }

  meshBounce() {
    this.playNoise(0.09, 0.14);
    this.playTone(410, 0.07, 'sawtooth', 0.09, 250);
  }

  pointJingle(won = true) {
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 349.23, 329.63, 261.63];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.11, 'square', 0.14), idx * 90);
    });
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stopBGM();
    }
    return this.enabled;
  }

  startBGM() {
    if (!this.enabled || this.bgmPlaying) return;
    this.init();
    this.bgmPlaying = true;
    const bassline = [130.81, 164.81, 196.0, 220.0, 196.0, 164.81, 146.83, 196.0];
    this.bgmTimer = setInterval(() => {
      if (!this.enabled || !this.bgmPlaying) return;
      const freq = bassline[this.step % bassline.length];
      this.playTone(freq, 0.09, 'triangle', 0.05);
      this.step++;
    }, 220);
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const sound = new ChiptuneAudio();
