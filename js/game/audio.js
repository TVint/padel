/**
 * REBRUNCH // Super Padel DX 2v2 - 8-Bit Chiptune Audio Synthesizer (js/game/audio.js)
 * Pure Web Audio API | Zero external audio files required
 */

export class RetroAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
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

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.init();
            this.playBlip(660, 0.06, 'square');
        }
        return this.enabled;
    }

    playBlip(freq = 440, duration = 0.06, type = 'square', gainVal = 0.12) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.01);
    }

    playDpadClick() {
        this.playBlip(320, 0.035, 'square', 0.08);
    }

    playButtonA() {
        this.playBlip(587.33, 0.05, 'square', 0.12);
        setTimeout(() => this.playBlip(880, 0.07, 'square', 0.12), 45);
    }

    playButtonB() {
        this.playBlip(392, 0.06, 'square', 0.1);
    }

    /**
     * Classic Pokémon / Game Boy Level-Up / Registration Complete Jingle
     */
    playLevelUpJingle() {
        if (!this.enabled) return;
        this.init();
        const notes = [
            { f: 523.25, d: 0.09, t: 0 },
            { f: 523.25, d: 0.09, t: 100 },
            { f: 523.25, d: 0.09, t: 200 },
            { f: 523.25, d: 0.22, t: 300 },
            { f: 415.30, d: 0.22, t: 530 },
            { f: 466.16, d: 0.22, t: 760 },
            { f: 523.25, d: 0.14, t: 990 },
            { f: 466.16, d: 0.09, t: 1150 },
            { f: 523.25, d: 0.45, t: 1260 },
        ];
        notes.forEach(n => {
            setTimeout(() => this.playBlip(n.f, n.d, 'square', 0.15), n.t);
        });
    }

    playHit(power = 1) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220 * power, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.09);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playSmash() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.22);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
    }

    playLob() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.14);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playBounce() {
        this.playBlip(170, 0.04, 'triangle', 0.1);
    }

    playGlassWall() {
        this.playBlip(980, 0.06, 'sine', 0.14);
        setTimeout(() => this.playBlip(1320, 0.05, 'sine', 0.1), 35);
    }

    playPoint(won = true) {
        if (won) {
            this.playBlip(523.25, 0.08, 'square', 0.14);
            setTimeout(() => this.playBlip(659.25, 0.08, 'square', 0.14), 90);
            setTimeout(() => this.playBlip(783.99, 0.18, 'square', 0.16), 180);
        } else {
            this.playBlip(311.13, 0.12, 'sawtooth', 0.12);
            setTimeout(() => this.playBlip(233.08, 0.22, 'sawtooth', 0.12), 130);
        }
    }
}

export const sound = new RetroAudio();
