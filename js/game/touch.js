// js/game/touch.js - GBC Input Controller with Event Mode vs Game Mode (Tasto A / Tasto B / Dash)

import { sound } from './audio.js';

export class GBCInputController {
  constructor() {
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      actionA: false,    // Green Button in Game Mode: Tasto A (Shot / Charge)
      actionB: false,    // Red Button in Game Mode: Tasto B (Lob / Pallonetto)
      actionDash: false, // Yellow Button in Game Mode: Dash (Sprint / Dive)
      start: false,      // GIOCA / ESCI button
    };

    this.onButtonPress = null;
    this.dpadSequence = [];
    this.onSecretSequence = null;

    this._bindKeyboard();
    this._bindShellButtons();
  }

  _recordDpad(dir) {
    this.dpadSequence.push(dir);
    if (this.dpadSequence.length > 6) {
      this.dpadSequence.shift();
    }
    // Secret D-Pad combo: UP, UP, DOWN, DOWN
    const tail = this.dpadSequence.slice(-4).join(',');
    if (tail === 'UP,UP,DOWN,DOWN' && typeof this.onSecretSequence === 'function') {
      this.dpadSequence = [];
      this.onSecretSequence();
    }
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (isInput && e.key !== 'Escape') return;

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          if (!this.keys.up) this._recordDpad('UP');
          this.keys.up = true;
          this._highlight('btn-up', true);
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'KeyS':
          if (!this.keys.down) this._recordDpad('DOWN');
          this.keys.down = true;
          this._highlight('btn-down', true);
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.keys.left = true;
          this._highlight('btn-left', true);
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.keys.right = true;
          this._highlight('btn-right', true);
          e.preventDefault();
          break;
        case 'Space':
        case 'KeyK':
          if (!this.keys.actionA) this._triggerCallback('GREEN');
          this.keys.actionA = true;
          this._highlight('btn-green', true);
          e.preventDefault();
          break;
        case 'KeyZ':
        case 'KeyJ':
          if (!this.keys.actionB) this._triggerCallback('RED');
          this.keys.actionB = true;
          this._highlight('btn-red', true);
          e.preventDefault();
          break;
        case 'KeyX':
        case 'ShiftLeft':
        case 'ShiftRight':
          if (!this.keys.actionDash) this._triggerCallback('YELLOW');
          this.keys.actionDash = true;
          this._highlight('btn-yellow', true);
          e.preventDefault();
          break;
        case 'Enter':
          if (!this.keys.start) this._triggerCallback('GIOCA');
          this.keys.start = true;
          this._highlight('btn-play-game', true);
          e.preventDefault();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.keys.up = false;
          this._highlight('btn-up', false);
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.keys.down = false;
          this._highlight('btn-down', false);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.keys.left = false;
          this._highlight('btn-left', false);
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.keys.right = false;
          this._highlight('btn-right', false);
          break;
        case 'Space':
        case 'KeyK':
          this.keys.actionA = false;
          this._highlight('btn-green', false);
          break;
        case 'KeyZ':
        case 'KeyJ':
          this.keys.actionB = false;
          this._highlight('btn-red', false);
          break;
        case 'KeyX':
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.actionDash = false;
          this._highlight('btn-yellow', false);
          break;
        case 'Enter':
          this.keys.start = false;
          this._highlight('btn-play-game', false);
          break;
      }
    });
  }

  _bindShellButtons() {
    const bindHold = (id, keyProp, codeName) => {
      const el = document.getElementById(id);
      if (!el) return;

      let pointerActive = false;

      const press = (e) => {
        if (e && e.cancelable && e.type !== 'click') e.preventDefault();
        pointerActive = true;
        sound.btnClick();
        if (navigator.vibrate) {
          try { navigator.vibrate(14); } catch (_) {}
        }
        this.keys[keyProp] = true;
        el.classList.add('pressed');
        if (codeName === 'UP' || codeName === 'DOWN') {
          this._recordDpad(codeName);
        }
        this._triggerCallback(codeName);
      };

      const release = (e) => {
        if (e && e.cancelable && e.type !== 'click') e.preventDefault();
        this.keys[keyProp] = false;
        el.classList.remove('pressed');
        setTimeout(() => { pointerActive = false; }, 80);
      };

      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('pointercancel', release);

      // Support mouse click / synthetic click / accessibility
      el.addEventListener('click', (e) => {
        if (pointerActive) return;
        press(e);
        setTimeout(() => release(e), 120);
      });
    };

    bindHold('btn-up', 'up', 'UP');
    bindHold('btn-down', 'down', 'DOWN');
    bindHold('btn-left', 'left', 'LEFT');
    bindHold('btn-right', 'right', 'RIGHT');

    // 3 Colored Shell Buttons:
    // Event Mode: GREEN=Brunch, RED=Aperitivo, YELLOW=Torneo
    // Game Mode:  GREEN=Tasto A (Tiro/Carica), RED=Tasto B (Lob), YELLOW=Dash (Scatto/Tuffo)
    bindHold('btn-green', 'actionA', 'GREEN');
    bindHold('btn-red', 'actionB', 'RED');
    bindHold('btn-yellow', 'actionDash', 'YELLOW');

    // Horizontal Button: GIOCA (Event Mode) <-> ESCI (Game Mode)
    bindHold('btn-play-game', 'start', 'GIOCA');
  }

  _highlight(id, active) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('pressed', active);
  }

  _triggerCallback(btnName) {
    if (typeof this.onButtonPress === 'function') {
      this.onButtonPress(btnName);
    }
  }
}
