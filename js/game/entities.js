// js/game/entities.js - 4 Padel Players with Selectable Character Skins, Tasto A / Tasto B / Dash & Magnetic Assist

import { COURT } from './physics.js';
import { sound } from './audio.js';

const SPRITE_FRAMES = [
  [
    "....11111111....",
    "...1111111111...",
    "...1333333331...",
    "...2221221222...",
    "....22222222....",
    "..111111111111..",
    ".11111133111111.",
    ".22.11111111.223",
    ".22.11111111.233",
    "....11111111..33",
    "....22222222....",
    "...222....222...",
    "...22......22...",
    "..111......111..",
    "................",
    "................"
  ],
  [
    "....11111111....",
    "...1111111111...",
    "...1333333331...",
    "...2221221222...",
    "....22222222....",
    "..111111111111..",
    ".11111133111111.",
    "22..11111111..23",
    "....11111111..33",
    "....11111111....",
    "...222222222....",
    "..222......22...",
    "..111.......11..",
    "................",
    "................",
    "................"
  ]
];

export const CHARACTER_SKINS = {
  classic: { label: 'REPUBLIC CLASSIC', 1: '#7dd3fc', 2: '#fed7aa', 3: '#f7c11e' },
  bomber:  { label: 'BOMBER VERDE',     1: '#9ad932', 2: '#fed7aa', 3: '#111827' },
  queen:   { label: 'PINK QUEEN',       1: '#ec4899', 2: '#fbcfe8', 3: '#fde047' },
  c64:     { label: 'RETRO C64',        1: '#a855f7', 2: '#e9d5ff', 3: '#38bdf8' },
};

export const PALETTES = {
  human:     CHARACTER_SKINS.classic,
  partner:   { 1: '#9ad932', 2: '#fed7aa', 3: '#ffffff' },
  cpuLeft:   { 1: '#ef4444', 2: '#fecdd3', 3: '#fde047' },
  cpuRight:  { 1: '#f59e0b', 2: '#fde68a', 3: '#38bdf8' },
};

export class PadelPlayer {
  constructor({ id, name, team, side, x, y, isHuman = false, palette }) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.side = side;
    this.homeX = x;
    this.homeY = y;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.speed = isHuman ? 2.65 : 2.1;
    this.isHuman = isHuman;
    this.palette = palette;

    // Animation & Action States
    this.animFrame = 0;
    this.animTimer = 0;
    this.charge = 0;
    this.isCharging = false;
    this.diveTimer = 0;
    this.dashCooldown = 0;
    this.swingTimer = 0;
    this.calloutText = '';
    this.calloutTimer = 0;

    // Forgiving hitbox constants
    this.hitRadius = isHuman ? 40 : 28;
    this.diveHitRadius = isHuman ? 56 : 39;
  }

  setSkin(skinKey) {
    if (CHARACTER_SKINS[skinKey]) {
      this.palette = CHARACTER_SKINS[skinKey];
    }
  }

  resetPosition() {
    this.x = this.homeX;
    this.y = this.homeY;
    this.vx = 0;
    this.vy = 0;
    this.charge = 0;
    this.isCharging = false;
    this.diveTimer = 0;
    this.dashCooldown = 0;
    this.swingTimer = 0;
  }

  say(text, frames = 50) {
    this.calloutText = text;
    this.calloutTimer = frames;
  }

  triggerDashOrDive(dirX, dirY, isDiveToBall = false) {
    if (this.diveTimer > 0 || this.dashCooldown > 0) return;
    this.diveTimer = 15;
    this.dashCooldown = 26;
    const mag = Math.hypot(dirX, dirY) || 1;
    this.vx = (dirX / mag) * 4.7;
    this.vy = (dirY / mag) * 4.0;
    sound.dashSwoosh();
    this.say(isDiveToBall ? 'TUFFO!' : 'DASH! ⚡', 26);
  }

  canReachBall(ball) {
    const reach = this.diveTimer > 0 ? this.diveHitRadius : this.hitRadius;
    const maxZ = this.isHuman ? 40 : 33;
    const dist = Math.hypot(ball.x - this.x, ball.y - this.y);
    return dist <= reach && ball.z <= maxZ;
  }

  updateHuman(input, ball) {
    if (this.calloutTimer > 0) this.calloutTimer--;
    if (this.swingTimer > 0) this.swingTimer--;
    if (this.dashCooldown > 0) this.dashCooldown--;

    if (this.diveTimer > 0) {
      this.diveTimer--;
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.88;
      this.vy *= 0.88;
      this._clampToHalfCourt();
      return null;
    }

    let dx = 0;
    let dy = 0;
    if (input.keys.left) dx -= 1;
    if (input.keys.right) dx += 1;
    if (input.keys.up) dy -= 1;
    if (input.keys.down) dy += 1;

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    const moveFactor = this.isCharging ? 0.84 : 1.0;
    this.vx = dx * this.speed * moveFactor;
    this.vy = dy * this.speed * moveFactor;

    // Subtle Magnetic Ball-Assist when ball is incoming on human's side
    if (ball.inPlay && ball.lastHitterTeam === 'cpu' && ball.landingTarget.y > COURT.NET_Y) {
      const distToLanding = Math.hypot(ball.landingTarget.x - this.x, ball.landingTarget.y - this.y);
      if (distToLanding > 6 && distToLanding < 76 && (dx !== 0 || dy !== 0)) {
        this.vx += ((ball.landingTarget.x - this.x) / distToLanding) * 0.42;
        this.vy += ((ball.landingTarget.y - this.y) / distToLanding) * 0.36;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
    this._clampToHalfCourt();

    if (Math.hypot(this.vx, this.vy) > 0.2) {
      this.animTimer++;
      if (this.animTimer % 6 === 0) {
        this.animFrame = (this.animFrame + 1) % 2;
      }
    } else {
      this.animFrame = 0;
    }

    // 1. TASTO A (Green Button / Space): Charge Shot (Drive / Bandeja / Vibora / Smash)
    if (input.keys.actionA) {
      this.isCharging = true;
      this.charge = Math.min(100, this.charge + 3.2);

      if (ball.inPlay && ball.lastHitterTeam !== this.team && this.canReachBall(ball) && this.charge >= 88) {
        const firedCharge = this.charge;
        this.isCharging = false;
        this.charge = 0;
        this.swingTimer = 14;
        return { type: 'charged_shot', charge: firedCharge, aimX: dx };
      }
    } else if (this.isCharging) {
      const firedCharge = this.charge;
      this.isCharging = false;
      this.charge = 0;
      this.swingTimer = 14;
      return { type: 'charged_shot', charge: firedCharge, aimX: dx };
    }

    // 2. TASTO B (Red Button / Z): Pallonetto / Lob
    if (input.keys.actionB) {
      input.keys.actionB = false;
      this.swingTimer = 14;
      return { type: 'lob', charge: 55, aimX: dx };
    }

    // 3. DASH (Yellow Button / X): Sprint Dash or Dive Recupero toward Ball
    if (input.keys.actionDash) {
      input.keys.actionDash = false;
      const dist = Math.hypot(ball.x - this.x, ball.y - this.y);
      if (ball.inPlay && dist > 12 && dist < 96) {
        this.triggerDashOrDive(ball.x - this.x, ball.y - this.y, true);
        this.swingTimer = 14;
        return { type: 'dive_shot', charge: 42, aimX: dx };
      } else {
        const dashDirX = dx !== 0 ? dx : (ball.x > this.x ? 1 : -1);
        const dashDirY = dy !== 0 ? dy : -0.35;
        this.triggerDashOrDive(dashDirX, dashDirY, false);
      }
    }

    return null;
  }

  _clampToHalfCourt() {
    this.x = Math.max(COURT.LEFT + 10, Math.min(COURT.RIGHT - 10, this.x));
    if (this.team === 'player') {
      this.y = Math.max(COURT.NET_Y + 14, Math.min(COURT.BOTTOM - 8, this.y));
    } else {
      this.y = Math.max(COURT.TOP + 8, Math.min(COURT.NET_Y - 14, this.y));
    }
  }

  draw(ctx) {
    const px = Math.round(this.x - 8);
    const py = Math.round(this.y - 12);

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(px + 2, py + 13, 12, 4);

    // Subtle strike-zone ring for human player
    if (this.isHuman) {
      ctx.strokeStyle = this.isCharging ? 'rgba(247, 193, 30, 0.65)' : 'rgba(154, 217, 50, 0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.round(this.x), Math.round(this.y), 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    const matrix = SPRITE_FRAMES[this.animFrame];
    for (let r = 0; r < 16; r++) {
      const rowStr = matrix[r];
      for (let c = 0; c < 16; c++) {
        const ch = rowStr[c];
        if (ch === '.') continue;
        ctx.fillStyle = this.palette[ch] || '#fff';
        const drawX = this.diveTimer > 0 ? px + r : px + c;
        const drawY = this.diveTimer > 0 ? py + c : py + r;
        ctx.fillRect(drawX, drawY, 1, 1);
      }
    }

    // Perforated Padel Racket (Pala)
    ctx.fillStyle = this.swingTimer > 0 ? '#f7c11e' : '#cbd5e1';
    const palaX = this.x + (this.swingTimer > 0 ? 9 : 7);
    const palaY = this.y - (this.swingTimer > 0 ? 7 : 3);
    ctx.fillRect(Math.round(palaX), Math.round(palaY), 5, 6);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(Math.round(palaX + 1), Math.round(palaY + 1), 1, 1);
    ctx.fillRect(Math.round(palaX + 3), Math.round(palaY + 1), 1, 1);
    ctx.fillRect(Math.round(palaX + 2), Math.round(palaY + 3), 1, 1);

    // Charge Meter Bar above player (0..100)
    if (this.isCharging && this.charge > 2) {
      const barW = 24;
      const fillW = Math.round((this.charge / 100) * barW);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(px - 4, py - 7, barW + 2, 5);
      ctx.fillStyle = this.charge > 72 ? '#ef4444' : (this.charge <= 25 ? '#38bdf8' : '#f7c11e');
      ctx.fillRect(px - 3, py - 6, fillW, 3);
    }

    // Speech Bubble ("MIA!", "VAI TU!", "CHIQUITA!")
    if (this.calloutTimer > 0 && this.calloutText) {
      ctx.font = '6px "Press Start 2P", monospace';
      const tw = ctx.measureText(this.calloutText).width;
      const bx = Math.round(this.x - tw / 2 - 3);
      const by = Math.round(py - 15);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(bx, by, tw + 6, 10);
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, tw + 6, 10);
      ctx.fillStyle = '#090d16';
      ctx.fillText(this.calloutText, bx + 3, by + 7);
    }
  }
}
