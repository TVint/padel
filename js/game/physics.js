// js/game/physics.js - 2.5D Padel Ball Physics (x, y, z), Wall Rebound Tracking & Linear Charge Interpolation

import { sound } from './audio.js';

export const COURT = {
  WIDTH: 320,
  HEIGHT: 264,
  LEFT: 38,
  RIGHT: 282,
  TOP: 50,
  BOTTOM: 246,
  NET_Y: 148,
  SERVICE_TOP: 92,
  SERVICE_BOTTOM: 204,
};

/**
 * Linearly interpolates shot velocity (vx, vy, vz) based on player charge (0-100).
 * - Quick tap (low charge 0..25): short ball ("chiquita" or drop shot) that softly clears the net.
 * - Medium charge (26..75): controlled deep drive / bandeja.
 * - Max charge (76..100): deep power shot to the back glass or smash X3.
 */
export function computeChargedShotVelocity({
  charge = 0,
  dirY = -1,
  aimX = 0,
  playerY = 212,
  ballZ = 10,
  isLob = false,
}) {
  const clampedCharge = Math.max(0, Math.min(100, Number(charge) || 0));
  const t = clampedCharge / 100; // 0.0 -> 1.0 linear interpolation factor

  if (isLob) {
    const lobSpeedY = 1.95 + t * 1.05;
    const lobVx = aimX * (1.05 + t * 1.15);
    return {
      vx: lobVx,
      vy: dirY * lobSpeedY,
      vz: 4.85 + t * 0.85,
      spin: 0,
      shotType: 'PALLONETTO!',
      isSmash: false,
    };
  }

  // Linearly interpolate horizontal & vertical speed from charge (0..100)
  const minVy = 1.62;
  const maxVy = 4.55;
  const speedY = minVy + t * (maxVy - minVy);

  const minVxScale = 0.85;
  const maxVxScale = 2.65;
  const vx = aimX * (minVxScale + t * (maxVxScale - minVxScale));

  const nearNet = dirY < 0 ? playerY < COURT.NET_Y + 46 : playerY > COURT.NET_Y - 46;

  // High ball near net + high charge => SMASH X3!
  if (clampedCharge >= 72 && (ballZ > 14 || nearNet)) {
    return {
      vx: vx * 1.08,
      vy: dirY * (speedY * 1.06),
      vz: -1.3,
      spin: (Math.random() - 0.5) * 0.45,
      shotType: '🔥 SMASH X3!',
      isSmash: true,
    };
  }

  // Quick tap (low charge <= 25) => Short ball (Chiquita / Drop Shot)
  if (clampedCharge <= 25) {
    return {
      vx: vx * 0.75,
      vy: dirY * (1.52 + t * 1.15),
      vz: 1.92 + t * 0.55,
      spin: aimX * 0.15,
      shotType: 'CHIQUITA!',
      isSmash: false,
    };
  }

  // Medium charge (26..70) => Drive / Bandeja
  if (clampedCharge <= 70) {
    return {
      vx,
      vy: dirY * speedY,
      vz: 2.3 + (1 - t) * 0.45,
      spin: aimX * 0.25,
      shotType: 'BANDEJA!',
      isSmash: false,
    };
  }

  // High charge (71..100) from baseline => Deep glass shot (Vibora / Bajada)
  return {
    vx,
    vy: dirY * speedY,
    vz: 2.02,
    spin: aimX * 0.35,
    shotType: '⚡ VIBORA A VETRO!',
    isSmash: false,
  };
}

export class BallPhysics {
  constructor() {
    this.reset(160, 214, -1);
  }

  reset(x = 160, y = 214, serveDir = -1) {
    this.x = x;
    this.y = y;
    this.z = 12;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.spin = 0;
    this.gravity = 0.145;
    this.inPlay = false;
    this.serveDir = serveDir;
    this.bouncesOnCurrentSide = 0;
    this.lastHitterTeam = null; // 'player' or 'cpu'
    this.isSmash = false;
    this.outOfCage = false;
    this.landingTarget = { x: x, y: y };
    this.trail = [];
    this.lastWallHit = null;    // { x, y, wall, isMesh, timer }
    this.lastGroundBounce = null; // { x, y, timer }
  }

  launch(vx, vy, vz, hitterTeam, isSmash = false, spin = 0) {
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.spin = spin;
    this.inPlay = true;
    this.lastHitterTeam = hitterTeam;
    this.bouncesOnCurrentSide = 0;
    this.isSmash = isSmash;
    this.outOfCage = false;
    this.computeLandingPrediction();
  }

  update() {
    if (this.lastWallHit && this.lastWallHit.timer > 0) {
      this.lastWallHit.timer--;
    }
    if (this.lastGroundBounce && this.lastGroundBounce.timer > 0) {
      this.lastGroundBounce.timer--;
    }

    if (!this.inPlay) return null;

    if (Math.random() < 0.7) {
      this.trail.push({ x: this.x, y: this.y, z: this.z });
      if (this.trail.length > 8) this.trail.shift();
    }

    const prevY = this.y;
    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;
    this.vz -= this.gravity;

    // Reset bounce counter when crossing the net
    if ((prevY > COURT.NET_Y && this.y <= COURT.NET_Y) || (prevY < COURT.NET_Y && this.y >= COURT.NET_Y)) {
      if (this.z < 9.5) {
        sound.meshBounce();
        this.vy *= -0.25;
        this.vx *= 0.4;
        return { event: 'net_fault', faultTeam: this.lastHitterTeam };
      }
      this.bouncesOnCurrentSide = 0;
    }

    // Ground bounce (z <= 0)
    if (this.z <= 0) {
      this.z = 0;
      this.bouncesOnCurrentSide++;
      sound.groundBounce();
      this.lastGroundBounce = { x: this.x, y: this.y, timer: 12 };

      this.vx += this.spin * 0.55;

      if (this.isSmash && Math.abs(this.vy) > 3.0) {
        this.vz = 5.3;
      } else {
        this.vz = Math.max(1.85, Math.abs(this.vz) * 0.68);
      }

      this.vx *= 0.88;
      this.vy *= 0.86;

      if (this.bouncesOnCurrentSide >= 2) {
        const ballOnTop = this.y < COURT.NET_Y;
        const winner = ballOnTop ? 'player' : 'cpu';
        return { event: 'double_bounce', winner };
      }

      this.computeLandingPrediction();
    }

    // Side Walls (Glass near baseline, Metallic Mesh near net)
    if (this.x <= COURT.LEFT || this.x >= COURT.RIGHT) {
      const hitLeft = this.x <= COURT.LEFT;
      if (this.z > 31 && this.isSmash) {
        this.outOfCage = true;
        const winner = this.lastHitterTeam;
        return { event: 'smash_x3', winner };
      }

      if (this.bouncesOnCurrentSide === 0) {
        const winner = this.lastHitterTeam === 'player' ? 'cpu' : 'player';
        return { event: 'wall_fault', winner };
      }

      this.x = hitLeft ? COURT.LEFT + 1 : COURT.RIGHT - 1;
      const nearNetZone = Math.abs(this.y - COURT.NET_Y) < 38;

      this.lastWallHit = {
        x: hitLeft ? COURT.LEFT : COURT.RIGHT,
        y: this.y,
        wall: hitLeft ? 'left' : 'right',
        isMesh: nearNetZone,
        timer: 16,
      };

      if (nearNetZone) {
        sound.meshBounce();
        this.vx = -this.vx * (0.55 + Math.random() * 0.35);
        this.vy += (Math.random() - 0.5) * 1.35;
      } else {
        sound.glassBounce();
        this.vx = -this.vx * 0.78;
      }
      this.computeLandingPrediction();
    }

    // Back Glass Walls (Top and Bottom)
    if (this.y <= COURT.TOP || this.y >= COURT.BOTTOM) {
      const hitTop = this.y <= COURT.TOP;
      if (this.bouncesOnCurrentSide === 0) {
        const winner = this.lastHitterTeam === 'player' ? 'cpu' : 'player';
        return { event: 'out_fault', winner };
      }

      sound.glassBounce();
      this.lastWallHit = {
        x: this.x,
        y: hitTop ? COURT.TOP : COURT.BOTTOM,
        wall: hitTop ? 'top' : 'bottom',
        isMesh: false,
        timer: 18,
      };

      this.y = hitTop ? COURT.TOP + 1 : COURT.BOTTOM - 1;
      this.vy = -this.vy * 0.72;
      this.vz = Math.max(this.vz, 1.85);
      this.computeLandingPrediction();
    }

    return null;
  }

  computeLandingPrediction() {
    let simX = this.x;
    let simY = this.y;
    let simZ = Math.max(0.1, this.z);
    let simVx = this.vx;
    let simVy = this.vy;
    let simVz = this.vz;

    for (let i = 0; i < 120; i++) {
      simX += simVx;
      simY += simVy;
      simZ += simVz;
      simVz -= this.gravity;

      if (simX <= COURT.LEFT || simX >= COURT.RIGHT) simVx *= -0.75;
      if (simY <= COURT.TOP || simY >= COURT.BOTTOM) simVy *= -0.7;

      if (simZ <= 0) {
        break;
      }
    }

    this.landingTarget.x = Math.max(COURT.LEFT + 8, Math.min(COURT.RIGHT - 8, simX));
    this.landingTarget.y = Math.max(COURT.TOP + 8, Math.min(COURT.BOTTOM - 8, simY));
  }
}
