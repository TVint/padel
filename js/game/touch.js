// js/game/touch.js - Ergonomic 40% Larger D-Pad, Colored Buttons & GIOCA Button Controller

import { sound } from './audio.js';

export class GBCInputController {
  constructor() {
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      actionA: false,   // Green / Red (Charge & Drive / Power Shot)
      actionB: false,   // Yellow (Lob / Dive)
      start: false,     // GIOCA button
    };

    this.onButtonPress = null; // Callback for UI navigation & click tracking
    this._bindKeyboard();
    this._bindShellButtons();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (isInput && e.key !== 'Escape') return;

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.keys.up = true;
          this._highlight('btn-up', true);
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'KeyS':
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
          if (!this.keys.actionA) this._triggerCallback('A');
          this.keys.actionA = true;
          this._highlight('btn-red', true);
          e.preventDefault();
          break;
        case 'KeyZ':
        case 'KeyX':
        case 'KeyJ':
          if (!this.keys.actionB) this._triggerCallback('B');
          this.keys.actionB = true;
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
          this._highlight('btn-red', false);
          break;
        case 'KeyZ':
        case 'KeyX':
        case 'KeyJ':
          this.keys.actionB = false;
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

      const press = (e) => {
        e.preventDefault();
        sound.btnClick();
        if (navigator.vibrate) navigator.vibrate(14);
        this.keys[keyProp] = true;
        el.classList.add('pressed');
        this._triggerCallback(codeName);
      };

      const release = (e) => {
        e.preventDefault();
        this.keys[keyProp] = false;
        el.classList.remove('pressed');
      };

      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('pointercancel', release);
    };

    bindHold('btn-up', 'up', 'UP');
    bindHold('btn-down', 'down', 'DOWN');
    bindHold('btn-left', 'left', 'LEFT');
    bindHold('btn-right', 'right', 'RIGHT');

    // 3 Colored Shell Buttons:
    // - RED: Aperitivo view (or Power Shot inside match)
    // - GREEN: Brunch view (or Drive Shot inside match)
    // - YELLOW: Torneo view (or Lob/Dive inside match)
    bindHold('btn-red', 'actionA', 'RED');
    bindHold('btn-green', 'actionA', 'GREEN');
    bindHold('btn-yellow', 'actionB', 'YELLOW');

    // Single Large Horizontal GIOCA Button
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
