/**
 * REBRUNCH // Super Padel DX 2v2 - Keyboard & GBC Shell Touch Controller (js/game/touch.js)
 * Maps both desktop keyboard (WASD/Arrows + Space/Z/X) and the physical Game Boy Color
 * D-Pad & 3 diagonal Arcade Buttons (Green=Lob, Red=Colpo/Smash, Yellow=Scatto).
 */

import { sound } from './audio.js';

export class InputController {
    constructor(onShellButtonOutOfGame) {
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            hit: false,   // Red Button / Space
            lob: false,   // Green Button / Z
            dash: false   // Yellow Button / X
        };
        this.isGameActive = false;
        this.onShellButtonOutOfGame = onShellButtonOutOfGame;

        this._bindKeyboard();
        this._bindShellButtons();
    }

    _bindKeyboard() {
        window.addEventListener('keydown', (e) => {
            // Do not hijack typing inside form inputs!
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                return;
            }

            switch (e.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.keys.up = true;
                    if (this.isGameActive) e.preventDefault();
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.keys.down = true;
                    if (this.isGameActive) e.preventDefault();
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    this.keys.left = true;
                    if (this.isGameActive) e.preventDefault();
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.keys.right = true;
                    if (this.isGameActive) e.preventDefault();
                    break;
                case 'Space':
                case 'Enter':
                    this.keys.hit = true;
                    if (this.isGameActive) e.preventDefault();
                    break;
                case 'KeyZ':
                    this.keys.lob = true;
                    if (this.isGameActive) e.preventDefault();
                    break;
                case 'KeyX':
                case 'ShiftLeft':
                    this.keys.dash = true;
                    if (this.isGameActive) e.preventDefault();
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.keys.up = false;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.keys.down = false;
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    this.keys.left = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.keys.right = false;
                    break;
                case 'Space':
                case 'Enter':
                    this.keys.hit = false;
                    break;
                case 'KeyZ':
                    this.keys.lob = false;
                    break;
                case 'KeyX':
                case 'ShiftLeft':
                    this.keys.dash = false;
                    break;
            }
        });
    }

    _bindShellButtons() {
        const map = [
            { id: 'dpad-up',           key: 'up',    label: 'D-PAD SU' },
            { id: 'dpad-down',         key: 'down',  label: 'D-PAD GIÙ' },
            { id: 'dpad-left',         key: 'left',  label: 'D-PAD SX' },
            { id: 'dpad-right',        key: 'right', label: 'D-PAD DX' },
            { id: 'btn-arcade-green',  key: 'lob',   label: 'APERITIVO / LOB' },
            { id: 'btn-arcade-red',    key: 'hit',   label: 'SPORT / SMASH' },
            { id: 'btn-arcade-yellow', key: 'dash',  label: 'BRUNCH / SCATTO' }
        ];

        map.forEach(({ id, key, label }) => {
            const el = document.getElementById(id);
            if (!el) return;

            const press = (e) => {
                e.preventDefault();
                el.classList.add('pressed');
                this.keys[key] = true;

                if (!this.isGameActive) {
                    if (key === 'hit') sound.playButtonA();
                    else if (key === 'lob' || key === 'dash') sound.playButtonB();
                    else sound.playDpadClick();

                    if (typeof this.onShellButtonOutOfGame === 'function') {
                        this.onShellButtonOutOfGame(key, label);
                    }
                }
            };

            const release = (e) => {
                e.preventDefault();
                el.classList.remove('pressed');
                this.keys[key] = false;
            };

            el.addEventListener('pointerdown', press);
            el.addEventListener('pointerup', release);
            el.addEventListener('pointerleave', release);
            el.addEventListener('pointercancel', release);
        });
    }
}
