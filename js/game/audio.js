// js/game/audio.js - 8-Bit Web Audio API Synthesizer with 3-Channel "Sunny" (Boney M.) Loop

// Note frequencies (Hz) for the 3-channel "Sunny" (Boney M.) arrangement in E minor
const NOTE = {
  REST: 0,
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, FS2: 92.50, G2: 98.00, A2: 110.00, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, FS3: 185.00, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, DS4: 311.13, E4: 329.63, F4: 349.23, FS4: 369.99, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, DS5: 622.25, E5: 659.25, F5: 698.46, FS5: 739.99, G5: 783.99, A5: 880.00, B5: 987.77,
};

// 32-step (2-bar 16th-note) loop of "Sunny" (Boney M.)
// Progression: Em7 (8 steps) | G7 (8 steps) | Cmaj7 (8 steps) | F#m7b5 -> B7 (8 steps)
const SUNNY_MELODY = [
  // Bar 1: Em7 ("Sun-ny...") -> G7 ("...yesterday my life was filled with rain")
  NOTE.B4, NOTE.E5, NOTE.E5, NOTE.REST, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.B4,
  NOTE.D5, NOTE.G5, NOTE.G5, NOTE.REST, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.D5,
  // Bar 2: Cmaj7 ("Sun-ny...") -> F#m7b5 / B7 ("...you smiled at me and really eased the pain")
  NOTE.E5, NOTE.G5, NOTE.G5, NOTE.REST, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.C5,
  NOTE.FS5, NOTE.FS5, NOTE.E5, NOTE.DS5, NOTE.FS5, NOTE.B4, NOTE.REST, NOTE.D5,
];

// Disco octave-jumping bassline (Triangle channel)
const SUNNY_BASS = [
  // Em7
  NOTE.E2, NOTE.E3, NOTE.E2, NOTE.E3, NOTE.E2, NOTE.E3, NOTE.F2, NOTE.FS2,
  // G7
  NOTE.G2, NOTE.G3, NOTE.G2, NOTE.G3, NOTE.G2, NOTE.D3, NOTE.B2, NOTE.D3,
  // Cmaj7
  NOTE.C2, NOTE.C3, NOTE.C2, NOTE.C3, NOTE.C2, NOTE.C3, NOTE.D2, NOTE.E2,
  // F#m7b5 -> B7
  NOTE.FS2, NOTE.FS3, NOTE.FS2, NOTE.FS3, NOTE.B2, NOTE.B3, NOTE.A2, NOTE.FS2,
];

// Chord arpeggio stabs (Square sub-voice on off-beats)
const SUNNY_CHORDS = [
  NOTE.G4, NOTE.B4, NOTE.D5, NOTE.B4, NOTE.G4, NOTE.B4, NOTE.D5, NOTE.B4,
  NOTE.B4, NOTE.D5, NOTE.F5, NOTE.D5, NOTE.B4, NOTE.D5, NOTE.F5, NOTE.D5,
  NOTE.E4, NOTE.G4, NOTE.B4, NOTE.G4, NOTE.E4, NOTE.G4, NOTE.B4, NOTE.G4,
  NOTE.A4, NOTE.C5, NOTE.E5, NOTE.C5, NOTE.A4, NOTE.DS5, NOTE.FS5, NOTE.B4,
];

export class ChiptuneAudio {
  constructor() {
    this.ctx = null;
    this.sfxEnabled = true;
    this.musicEnabled = true;
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
    if (this.volume > 0 && !this.sfxEnabled) {
      this.sfxEnabled = true;
    }
    this.playTone(520 + this.volume * 440, 0.06, 'square', 0.14);
    return this.volume;
  }

  playTone(freq, duration = 0.08, type = 'square', gainVal = 0.12, slideFreq = null, isMusic = false) {
    if (this.volume <= 0) return;
    if (isMusic && !this.musicEnabled) return;
    if (!isMusic && !this.sfxEnabled) return;

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

  playNoise(duration = 0.08, gainVal = 0.1, filterFreq = 1200, isMusic = false) {
    if (this.volume <= 0) return;
    if (isMusic && !this.musicEnabled) return;
    if (!isMusic && !this.sfxEnabled) return;

    this.init();
    if (!this.ctx) return;

    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;

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

  modeSwitchJingle() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.065, 'square', 0.11), idx * 55);
    });
  }

  paddleHit(power = 1) {
    const base = power > 1.3 ? 210 : 320;
    this.playTone(base, 0.07, 'square', 0.16, base * 1.65);
    this.playNoise(0.04, 0.08, 1400);
  }

  smashHit() {
    this.playNoise(0.14, 0.2, 950);
    this.playTone(150, 0.18, 'sawtooth', 0.2, 620);
  }

  dashSwoosh() {
    this.playNoise(0.06, 0.12, 2200);
    this.playTone(300, 0.06, 'triangle', 0.1, 660);
  }

  groundBounce() {
    this.playTone(180, 0.045, 'triangle', 0.12, 110);
  }

  glassBounce() {
    this.playTone(920, 0.06, 'square', 0.1, 1360);
  }

  meshBounce() {
    this.playNoise(0.09, 0.14, 1100);
    this.playTone(410, 0.07, 'sawtooth', 0.09, 250);
  }

  pointJingle(won = true) {
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 349.23, 329.63, 261.63];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.11, 'square', 0.14), idx * 90);
    });
  }

  toggleMute() {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
    return this.musicEnabled;
  }

  /**
   * Starts the 3-Channel Chiptune Loop of "Sunny" (Boney M.)
   * Channel 1: Square (Lead Melody + Off-beat Chord Stabs)
   * Channel 2: Triangle (Disco Octave Bassline)
   * Channel 3: Noise (Disco Hi-Hat & Snare Backbeat)
   */
  startBGM() {
    if (!this.musicEnabled || this.bgmPlaying) return;
    this.init();
    this.bgmPlaying = true;

    // 124 BPM -> ~120ms per 16th-note step
    this.bgmTimer = setInterval(() => {
      if (!this.musicEnabled || !this.bgmPlaying) return;

      const idx = this.step % 32;

      // CHANNEL 1: Lead Square Melody + Offbeat Chord Stabs
      const melFreq = SUNNY_MELODY[idx];
      if (melFreq > 0) {
        this.playTone(melFreq, 0.11, 'square', 0.055, null, true);
      } else if (idx % 2 === 1) {
        const chordFreq = SUNNY_CHORDS[idx];
        if (chordFreq > 0) {
          this.playTone(chordFreq, 0.06, 'square', 0.028, null, true);
        }
      }

      // CHANNEL 2: Triangle Disco Walking Bassline
      const bassFreq = SUNNY_BASS[idx];
      if (bassFreq > 0) {
        this.playTone(bassFreq, 0.105, 'triangle', 0.085, null, true);
      }

      // CHANNEL 3: Noise Percussion (Kick/Snare/Disco Hi-Hat)
      if (idx % 4 === 2) {
        // Snare / Clap on backbeat + open disco hat
        this.playNoise(0.065, 0.05, 1600, true);
      } else if (idx % 2 === 1) {
        // Off-beat open disco hi-hat ("tss")
        this.playNoise(0.04, 0.032, 4200, true);
      } else {
        // Closed tick
        this.playNoise(0.02, 0.018, 5200, true);
      }

      this.step++;
    }, 122);
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
