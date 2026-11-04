// js/game/engine.js - Super Padel DX 2v2 with 2.5D Padel Cage Walls & Commodore 64 Animated Crowd

import { COURT, BallPhysics, computeChargedShotVelocity } from './physics.js';
import { PadelPlayer, PALETTES } from './entities.js';
import { PadelTeamAI } from './ai.js';
import { sound } from './audio.js';

const TENNIS_POINTS = ['0', '15', '30', '40', 'AD'];

// Classic Commodore 64 16-Color Inspired Palette for Stadium Spectators
const C64_SHIRTS = [
  '#58b8e8', '#f7c11e', '#9ad932', '#e53935',
  '#ec4899', '#a855f7', '#ffffff', '#fb923c',
];
const C64_HAIR = ['#1e1b18', '#78350f', '#facc15', '#b91c1c', '#475569'];

export class PadelGameEngine {
  constructor(canvas, input, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.callbacks = callbacks;

    this.ball = new BallPhysics();
    this.ai = new PadelTeamAI();

    this.human = new PadelPlayer({
      id: 'p1',
      name: 'TU',
      team: 'player',
      side: 'left',
      x: 112,
      y: 214,
      isHuman: true,
      palette: PALETTES.human,
    });

    this.partner = new PadelPlayer({
      id: 'p2',
      name: 'SOCIO',
      team: 'player',
      side: 'right',
      x: 208,
      y: 214,
      isHuman: false,
      palette: PALETTES.partner,
    });

    this.cpuLeft = new PadelPlayer({
      id: 'c1',
      name: 'PRO-1',
      team: 'cpu',
      side: 'left',
      x: 112,
      y: 78,
      isHuman: false,
      palette: PALETTES.cpuLeft,
    });

    this.cpuRight = new PadelPlayer({
      id: 'c2',
      name: 'PRO-2',
      team: 'cpu',
      side: 'right',
      x: 208,
      y: 78,
      isHuman: false,
      palette: PALETTES.cpuRight,
    });

    this.players = [this.human, this.partner, this.cpuLeft, this.cpuRight];

    // Generate Commodore 64 Stadium Bleacher Crowd (2 rows of spectators)
    this.crowdFans = [];
    for (let row = 0; row < 2; row++) {
      const count = row === 0 ? 15 : 16;
      for (let i = 0; i < count; i++) {
        this.crowdFans.push({
          row,
          x: 22 + i * 18 + (row % 2) * 7,
          baseY: row === 0 ? 8 : 19,
          shirt: C64_SHIRTS[(i + row * 3) % C64_SHIRTS.length],
          hair: C64_HAIR[(i * 2 + row) % C64_HAIR.length],
          phase: (i * 3 + row * 5) % 16,
          hasScarf: (i + row) % 5 === 0,
        });
      }
    }

    // Visual FX (Sparks & Confetti)
    this.particles = [];
    this.frameTick = 0;
    this.crowdCheerTimer = 0;

    // Match State & Arcade Score
    this.ptsPlayer = 0;
    this.ptsCpu = 0;
    this.gamesPlayer = 0;
    this.gamesCpu = 0;
    this.targetGames = 2;
    this.arcadeScore = 0;
    this.rallyHits = 0;
    this.waitingForServe = true;
    this.bannerText = 'PREMI VERDE/ROSSO PER SERVIRE!';
    this.bannerTimer = 90;
    this.matchOver = false;
    this.running = false;
  }

  startNewMatch() {
    this.ptsPlayer = 0;
    this.ptsCpu = 0;
    this.gamesPlayer = 0;
    this.gamesCpu = 0;
    this.arcadeScore = 0;
    this.rallyHits = 0;
    this.matchOver = false;
    this.crowdCheerTimer = 45;
    this.resetRally('TOCCA A TE SERVIRE!');
    this._syncHud('READY!');
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(() => this.loop());
    }
  }

  resetRally(message = 'PRONTI!') {
    this.players.forEach((p) => p.resetPosition());
    this.ball.reset(this.human.x + 6, this.human.y - 8, -1);
    this.waitingForServe = true;
    this.rallyHits = 0;
    this.bannerText = message;
    this.bannerTimer = 75;
  }

  _spawnSparks(x, y, color = '#f7c11e', count = 7) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 0.8 + Math.random() * 1.8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        life: 14 + Math.floor(Math.random() * 8),
      });
    }
  }

  loop() {
    if (!this.running) return;
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  update() {
    this.frameTick++;
    if (this.crowdCheerTimer > 0) this.crowdCheerTimer--;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.matchOver) return;
    if (this.bannerTimer > 0) this.bannerTimer--;

    const action = this.human.updateHuman(this.input, this.ball);

    // Serve trigger
    if (this.waitingForServe) {
      this.ball.x = this.human.x + 6;
      this.ball.y = this.human.y - 6;
      this.ball.z = 11;

      if (action || this.input.keys.start) {
        this.input.keys.start = false;
        this.waitingForServe = false;
        const serveCharge = action && typeof action.charge === 'number' ? action.charge : 45;
        const aimX = (this.input.keys.left ? -0.9 : 0) + (this.input.keys.right ? 0.9 : 0);
        const shot = computeChargedShotVelocity({
          charge: serveCharge,
          dirY: -1,
          aimX: aimX || 0.35,
          playerY: this.human.y,
          ballZ: this.ball.z,
          isLob: action?.type === 'lob',
        });
        sound.paddleHit(1 + serveCharge / 100);
        this._spawnSparks(this.ball.x, this.ball.y - this.ball.z, '#9ad932', 6);
        this.ball.launch(shot.vx, shot.vy, shot.vz, 'player', false, shot.spin);
        this._syncHud('SERVIZIO!');
      }
      return;
    }

    // Human strikes the ball in play
    if (this.ball.inPlay && this.ball.lastHitterTeam !== 'player') {
      const canReach = this.human.canReachBall(this.ball);
      if (canReach && (action || this.input.keys.actionA || this.ball.z < 16)) {
        const isLob = action?.type === 'lob';
        const charge = action && typeof action.charge === 'number'
          ? action.charge
          : (this.human.isCharging ? this.human.charge : 18);

        this.human.isCharging = false;
        this.human.charge = 0;
        this.human.swingTimer = 14;
        this._executeHumanShot(charge, isLob);
      }
    }

    // Update Partner & Opponents AI
    this.ai.updatePartner(this.partner, this.human, this.ball);
    this.ai.updateOpponents(this.cpuLeft, this.cpuRight, this.ball);

    // Update 2.5D Ball Physics
    const result = this.ball.update();
    if (result) {
      this._handlePointOutcome(result);
    }
  }

  _executeHumanShot(charge, isLob = false) {
    let aimX = 0;
    if (this.input.keys.left) aimX = -1.0;
    else if (this.input.keys.right) aimX = 1.0;
    else aimX = (Math.random() - 0.5) * 0.65;

    const shot = computeChargedShotVelocity({
      charge,
      dirY: -1,
      aimX,
      playerY: this.human.y,
      ballZ: this.ball.z,
      isLob,
    });

    if (shot.isSmash) {
      sound.smashHit();
      this.arcadeScore += 60;
      this.crowdCheerTimer = 70;
      this._spawnSparks(this.ball.x, this.ball.y - this.ball.z, '#ef4444', 12);
    } else {
      sound.paddleHit(0.8 + (charge / 100) * 0.9);
      this.arcadeScore += 25;
      this._spawnSparks(this.ball.x, this.ball.y - this.ball.z, '#f7c11e', 7);
    }

    this.rallyHits++;
    this.human.say(shot.shotType.replace('🔥 ', '').replace('⚡ ', ''), 32);
    this.ball.launch(shot.vx, shot.vy, shot.vz, 'player', shot.isSmash, shot.spin);
    this._syncHud(shot.shotType);
  }

  _handlePointOutcome(result) {
    this.ball.inPlay = false;
    this.crowdCheerTimer = 110; // C64 crowd erupts on every point!

    let winner = result.winner;
    if (result.event === 'net_fault') {
      winner = result.faultTeam === 'player' ? 'cpu' : 'player';
    }

    let reasonLabel = 'PUNTO!';
    if (result.event === 'smash_x3') reasonLabel = 'FUORI GABBIA X3!!';
    else if (result.event === 'net_fault') reasonLabel = 'FALLO DI RETE!';
    else if (result.event === 'wall_fault' || result.event === 'out_fault') reasonLabel = 'FUORI DIRETTA!';
    else if (result.event === 'double_bounce') reasonLabel = 'DOPPIO RIMBALZO!';

    if (winner === 'player') {
      this.ptsPlayer++;
      this.arcadeScore += 180 + this.rallyHits * 15;
      sound.pointJingle(true);
      this._spawnSparks(160, 42, '#9ad932', 14);
      this._syncHud(`🟢 ${reasonLabel}`);
    } else {
      this.ptsCpu++;
      this.arcadeScore += 35;
      sound.pointJingle(false);
      this._syncHud(`🔴 ${reasonLabel}`);
    }

    // Check game win
    if (this.ptsPlayer >= 4 && this.ptsPlayer - this.ptsCpu >= 2) {
      this.gamesPlayer++;
      this.arcadeScore += 350;
      this.ptsPlayer = 0;
      this.ptsCpu = 0;
      reasonLabel = 'GAME VINTI DA TE!';
    } else if (this.ptsCpu >= 4 && this.ptsCpu - this.ptsPlayer >= 2) {
      this.gamesCpu++;
      this.ptsPlayer = 0;
      this.ptsCpu = 0;
      reasonLabel = 'GAME AI MAESTRI!';
    }

    this._syncHud(reasonLabel);

    // Check match end
    if (this.gamesPlayer >= this.targetGames || this.gamesCpu >= this.targetGames) {
      this.matchOver = true;
      const playerWon = this.gamesPlayer > this.gamesCpu;
      if (playerWon) {
        this.arcadeScore += 500;
      } else {
        this.arcadeScore = Math.max(120, this.arcadeScore);
      }

      if (typeof this.callbacks.onMatchEnd === 'function') {
        this.callbacks.onMatchEnd({
          won: playerWon,
          gamesPlayer: this.gamesPlayer,
          gamesCpu: this.gamesCpu,
          score: this.arcadeScore,
        });
      }
      return;
    }

    setTimeout(() => {
      if (!this.matchOver) {
        this.resetRally(reasonLabel);
      }
    }, 1050);
  }

  _formatTennisScore(p1, p2) {
    if (p1 >= 3 && p2 >= 3) {
      if (p1 === p2) return ['40', '40'];
      return p1 > p2 ? ['AD', '40'] : ['40', 'AD'];
    }
    return [TENNIS_POINTS[Math.min(3, p1)], TENNIS_POINTS[Math.min(3, p2)]];
  }

  _syncHud(shotBadgeText) {
    const [s1, s2] = this._formatTennisScore(this.ptsPlayer, this.ptsCpu);
    const elS1 = document.getElementById('hud-score-p1');
    const elS2 = document.getElementById('hud-score-cpu');
    const elG1 = document.getElementById('hud-games-p1');
    const elG2 = document.getElementById('hud-games-cpu');
    const elBadge = document.getElementById('hud-shot-badge');

    if (elS1) elS1.textContent = s1;
    if (elS2) elS2.textContent = s2;
    if (elG1) elG1.textContent = `G:${this.gamesPlayer}`;
    if (elG2) elG2.textContent = `G:${this.gamesCpu}`;
    if (elBadge && shotBadgeText) elBadge.textContent = `${shotBadgeText} (${this.arcadeScore}PT)`;
  }

  // =========================================================
  // COMMODORE 64 ANIMATED STADIUM TRIBUNA (BLEACHER CROWD)
  // =========================================================
  _drawCommodore64Crowd(ctx) {
    const isCheering = this.crowdCheerTimer > 0;
    const speedDiv = isCheering ? 5 : 14;

    // Concrete Stadium Tiers (2 C64 Bleacher Steps)
    ctx.fillStyle = '#1e2436';
    ctx.fillRect(0, 0, COURT.WIDTH, 34);
    ctx.fillStyle = '#2b334a';
    ctx.fillRect(8, 3, 304, 13);
    ctx.fillRect(8, 17, 304, 14);

    // Bleacher Guardrail & C64 Club Banners
    ctx.fillStyle = '#0f141f';
    ctx.fillRect(8, 30, 304, 4);

    // Draw each 8-bit C64 Spectator Sprite
    for (let i = 0; i < this.crowdFans.length; i++) {
      const fan = this.crowdFans[i];
      const animStep = Math.floor((this.frameTick + fan.phase) / speedDiv) % 2;
      const jumpY = isCheering ? (animStep === 0 ? -2 : 0) : (animStep === 0 ? -1 : 0);
      const fx = fan.x;
      const fy = fan.baseY + jumpY;

      // Hair & Head (4x4 pixel block)
      ctx.fillStyle = fan.hair;
      ctx.fillRect(fx + 2, fy, 5, 2);
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(fx + 2, fy + 2, 5, 3);
      // Eyes (C64 1-pixel eyes)
      ctx.fillStyle = '#090d16';
      ctx.fillRect(fx + 3, fy + 3, 1, 1);
      ctx.fillRect(fx + 5, fy + 3, 1, 1);

      // Torso (Jersey)
      ctx.fillStyle = fan.shirt;
      ctx.fillRect(fx + 1, fy + 5, 7, 5);

      // C64 Waving Arms (Frame 0: arms up cheering, Frame 1: arms down/clapping)
      if (animStep === 0) {
        ctx.fillStyle = fan.shirt;
        ctx.fillRect(fx - 1, fy + 2, 2, 4);
        ctx.fillRect(fx + 8, fy + 2, 2, 4);
        ctx.fillStyle = '#fed7aa';
        ctx.fillRect(fx - 1, fy + 1, 2, 1);
        ctx.fillRect(fx + 8, fy + 1, 2, 1);

        // Some fans wave a yellow/green Republic scarf overhead!
        if (fan.hasScarf && isCheering) {
          ctx.fillStyle = '#f7c11e';
          ctx.fillRect(fx - 1, fy - 1, 11, 2);
          ctx.fillStyle = '#9ad932';
          ctx.fillRect(fx + 2, fy - 1, 5, 2);
        }
      } else {
        ctx.fillStyle = fan.shirt;
        ctx.fillRect(fx - 1, fy + 5, 2, 3);
        ctx.fillRect(fx + 8, fy + 5, 2, 3);
      }
    }

    // Random Stadium Camera Flashbulb in the Bleachers during rallies/points
    if (isCheering && this.frameTick % 9 === 0) {
      const flashX = 32 + ((this.frameTick * 37) % 250);
      const flashY = 6 + ((this.frameTick * 13) % 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(flashX - 2, flashY - 2, 5, 5);
    }
  }

  // =========================================================
  // 2.5D PADEL CAGE WALLS (TEMPERED GLASS + METALLIC MESH)
  // =========================================================
  _drawPadelCageWalls(ctx) {
    const wallHit = this.ball.lastWallHit;

    // 1. NORTH BACK GLASS WALL (y: 34..50)
    for (let x = COURT.LEFT; x < COURT.RIGHT; x += 40) {
      const panelW = Math.min(40, COURT.RIGHT - x);
      const isHitPanel =
        wallHit &&
        wallHit.timer > 0 &&
        wallHit.wall === 'top' &&
        Math.abs(wallHit.x - (x + panelW / 2)) < 28;

      // Translucent Crystal Glass Panel
      ctx.fillStyle = isHitPanel
        ? 'rgba(247, 193, 30, 0.55)'
        : 'rgba(125, 211, 252, 0.24)';
      ctx.fillRect(x, 34, panelW, 16);

      // Diagonal Pixel Specular Glint on Glass
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fillRect(x + 6, 37, 8, 2);
      ctx.fillRect(x + 10, 39, 8, 2);

      // Steel Structural Pillar (Montante)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, 33, 3, 17);
    }
    // Rightmost pillar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(COURT.RIGHT - 2, 33, 3, 17);

    // Top horizontal steel rail of the glass wall
    ctx.fillStyle = '#334155';
    ctx.fillRect(COURT.LEFT - 2, 33, COURT.RIGHT - COURT.LEFT + 4, 2);

    // Sponsor Banner along North Wall Base ("REPUBLIC // REBRUNCH")
    ctx.fillStyle = '#111520';
    ctx.fillRect(COURT.LEFT + 34, 42, 176, 8);
    ctx.fillStyle = '#f7c11e';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText('REPUBLIC * REBRUNCH * JESOLO', COURT.LEFT + 42, 48);

    // 2. LEFT & RIGHT 2.5D SIDE WALLS (Glass at ends + Metallic Mesh near Net)
    const wallThickness = 14;
    // Left Wall Strip (x: COURT.LEFT - wallThickness .. COURT.LEFT)
    // Right Wall Strip (x: COURT.RIGHT .. COURT.RIGHT + wallThickness)
    for (let y = COURT.TOP; y < COURT.BOTTOM; y += 28) {
      const segH = Math.min(28, COURT.BOTTOM - y);
      const midY = y + segH / 2;
      const isMeshZone = Math.abs(midY - COURT.NET_Y) < 38;

      const leftHit =
        wallHit &&
        wallHit.timer > 0 &&
        wallHit.wall === 'left' &&
        Math.abs(wallHit.y - midY) < 22;
      const rightHit =
        wallHit &&
        wallHit.timer > 0 &&
        wallHit.wall === 'right' &&
        Math.abs(wallHit.y - midY) < 22;

      // Left Side Panel
      ctx.fillStyle = leftHit
        ? 'rgba(247, 193, 30, 0.65)'
        : isMeshZone
          ? 'rgba(148, 163, 184, 0.28)'
          : 'rgba(125, 211, 252, 0.25)';
      ctx.fillRect(COURT.LEFT - wallThickness, y, wallThickness, segH);

      // Right Side Panel
      ctx.fillStyle = rightHit
        ? 'rgba(247, 193, 30, 0.65)'
        : isMeshZone
          ? 'rgba(148, 163, 184, 0.28)'
          : 'rgba(125, 211, 252, 0.25)';
      ctx.fillRect(COURT.RIGHT, y, wallThickness, segH);

      // Draw Cross-Hatched Metallic Wire Mesh Pattern in the Central Zone
      if (isMeshZone) {
        ctx.fillStyle = '#94a3b8';
        for (let my = y + 2; my < y + segH - 2; my += 4) {
          ctx.fillRect(COURT.LEFT - wallThickness + 3, my, wallThickness - 5, 1);
          ctx.fillRect(COURT.RIGHT + 2, my, wallThickness - 5, 1);
        }
      } else {
        // Glass reflection glint on side glass panels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(COURT.LEFT - wallThickness + 3, y + 5, 3, 8);
        ctx.fillRect(COURT.RIGHT + wallThickness - 6, y + 5, 3, 8);
      }

      // Steel Structural Post between side panels
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(COURT.LEFT - wallThickness, y, wallThickness, 2);
      ctx.fillRect(COURT.RIGHT, y, wallThickness, 2);
    }

    // Outer Side Cage Borders
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2;
    ctx.strokeRect(COURT.LEFT - wallThickness, COURT.TOP, wallThickness, COURT.BOTTOM - COURT.TOP);
    ctx.strokeRect(COURT.RIGHT, COURT.TOP, wallThickness, COURT.BOTTOM - COURT.TOP);

    // 3. SOUTH BOTTOM FOREGROUND GLASS WALL (y: COURT.BOTTOM .. COURT.BOTTOM + 10)
    const southHit = wallHit && wallHit.timer > 0 && wallHit.wall === 'bottom';
    ctx.fillStyle = southHit ? 'rgba(247, 193, 30, 0.5)' : 'rgba(125, 211, 252, 0.22)';
    ctx.fillRect(COURT.LEFT, COURT.BOTTOM, COURT.RIGHT - COURT.LEFT, 9);
    for (let x = COURT.LEFT; x <= COURT.RIGHT; x += 40) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 1, COURT.BOTTOM, 3, 10);
    }

    // 4. Wall Impact Shockwave Ring if recently hit
    if (wallHit && wallHit.timer > 0) {
      const r = (18 - wallHit.timer) * 1.2;
      ctx.strokeStyle = wallHit.isMesh ? '#f7c11e' : '#67e8f9';
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(wallHit.x - r), Math.round(wallHit.y - r), Math.round(r * 2), Math.round(r * 2));
    }
  }

  // =========================================================
  // SHOT TRAJECTORY PREVIEW ARC WHILE CHARGING
  // =========================================================
  _drawChargeTrajectoryPreview(ctx) {
    if (!this.human.isCharging || this.human.charge < 5) return;

    const t = this.human.charge / 100;
    let aimX = 0;
    if (this.input.keys.left) aimX = -1.0;
    else if (this.input.keys.right) aimX = 1.0;

    const color = this.human.charge > 72 ? '#ef4444' : (this.human.charge <= 25 ? '#38bdf8' : '#f7c11e');
    const distY = 48 + t * 92;
    const targetX = Math.max(COURT.LEFT + 12, Math.min(COURT.RIGHT - 12, this.human.x + aimX * (25 + t * 48)));
    const targetY = Math.max(COURT.TOP + 10, this.human.y - distY);

    ctx.fillStyle = color;
    for (let step = 1; step <= 6; step++) {
      const s = step / 6;
      const px = Math.round(this.human.x + (targetX - this.human.x) * s);
      const py = Math.round(this.human.y - 8 + (targetY - (this.human.y - 8)) * s);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    // 1. Exterior Surroundings (Sky-Blue / Slate Apron from Republic Moodboard)
    ctx.fillStyle = '#1b2436';
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    // 2. Commodore 64 Animated Stadium Bleacher Crowd at Top
    this._drawCommodore64Crowd(ctx);

    // 3. Sage-Emerald Padel Turf (Matching Republic Reference Palette)
    ctx.fillStyle = '#3b8c66';
    ctx.fillRect(COURT.LEFT, COURT.TOP, COURT.RIGHT - COURT.LEFT, COURT.BOTTOM - COURT.TOP);

    // Checkerboard 8-bit turf stripes
    ctx.fillStyle = '#337a58';
    for (let y = COURT.TOP; y < COURT.BOTTOM; y += 16) {
      ctx.fillRect(COURT.LEFT, y, COURT.RIGHT - COURT.LEFT, 8);
    }

    // Blue Service Apron Bands (Matching Moodboard "GAMEPLAY & PADEL")
    ctx.fillStyle = '#3898d4';
    ctx.fillRect(COURT.LEFT, COURT.TOP, COURT.RIGHT - COURT.LEFT, COURT.SERVICE_TOP - COURT.TOP);
    ctx.fillRect(COURT.LEFT, COURT.SERVICE_BOTTOM, COURT.RIGHT - COURT.LEFT, COURT.BOTTOM - COURT.SERVICE_BOTTOM);

    // 4. Crisp White Court Lines
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.strokeRect(COURT.LEFT, COURT.TOP, COURT.RIGHT - COURT.LEFT, COURT.BOTTOM - COURT.TOP);

    ctx.beginPath();
    ctx.moveTo(COURT.LEFT, COURT.SERVICE_TOP);
    ctx.lineTo(COURT.RIGHT, COURT.SERVICE_TOP);
    ctx.moveTo(COURT.LEFT, COURT.SERVICE_BOTTOM);
    ctx.lineTo(COURT.RIGHT, COURT.SERVICE_BOTTOM);
    ctx.moveTo(160, COURT.SERVICE_TOP);
    ctx.lineTo(160, COURT.SERVICE_BOTTOM);
    ctx.stroke();

    // 5. 2.5D Padel Cage Walls (Tempered Glass + Metallic Mesh + Impact Flash)
    this._drawPadelCageWalls(ctx);

    // 6. Ground Bounce Dust Ring
    if (this.ball.lastGroundBounce && this.ball.lastGroundBounce.timer > 0) {
      const gb = this.ball.lastGroundBounce;
      const rad = (13 - gb.timer) * 0.9;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(gb.x - rad), Math.round(gb.y - rad), Math.round(rad * 2), Math.round(rad * 2));
    }

    // 7. Landing Target Crosshair (Mario Tennis GBC style)
    if (this.ball.inPlay) {
      const tx = Math.round(this.ball.landingTarget.x);
      const ty = Math.round(this.ball.landingTarget.y);
      ctx.strokeStyle = this.ball.isSmash ? '#ef4444' : '#f7c11e';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx - 5, ty - 5, 10, 10);
      ctx.fillStyle = '#f7c11e';
      ctx.fillRect(tx - 1, ty - 1, 2, 2);
    }

    // 8. Top Players (CPU)
    this.cpuLeft.draw(ctx);
    this.cpuRight.draw(ctx);

    // 9. Central Padel Net with Posts & 8-bit Mesh Pattern
    // Net Posts
    ctx.fillStyle = '#64748b';
    ctx.fillRect(COURT.LEFT - 4, COURT.NET_Y - 5, 4, 9);
    ctx.fillRect(COURT.RIGHT, COURT.NET_Y - 5, 4, 9);
    // Net Mesh & White Tape
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(COURT.LEFT - 2, COURT.NET_Y - 2, COURT.RIGHT - COURT.LEFT + 4, 5);
    ctx.fillStyle = '#f8fafc';
    for (let x = COURT.LEFT; x < COURT.RIGHT; x += 6) {
      ctx.fillRect(x, COURT.NET_Y - 3, 4, 2);
    }

    // 10. Shot Trajectory Preview Arc while Charging
    this._drawChargeTrajectoryPreview(ctx);

    // 11. Bottom Players (Human + Partner)
    this.partner.draw(ctx);
    this.human.draw(ctx);

    // 12. Ball Shadow + 2.5D Ball
    const bx = Math.round(this.ball.x);
    const by = Math.round(this.ball.y);
    const bz = Math.round(this.ball.z);

    if (this.ball.isSmash) {
      this.ball.trail.forEach((t, i) => {
        ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#f7c11e';
        ctx.fillRect(Math.round(t.x - 2), Math.round(t.y - t.z - 2), 3, 3);
      });
    }

    // Ground shadow at (x, y)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(bx - 2, by - 1, 5, 3);

    // Elevated Ball at (x, y - z)
    const size = bz > 22 ? 6 : 5;
    ctx.fillStyle = this.ball.isSmash ? '#fb923c' : '#d9f99d';
    ctx.fillRect(bx - 2, by - bz - 2, size, size);
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 2, by - bz - 2, size, size);

    // 13. Hit Sparks & Confetti Particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }

    // 14. Retro Event Banner
    if (this.bannerTimer > 0 && this.bannerText) {
      ctx.fillStyle = 'rgba(17, 21, 32, 0.88)';
      ctx.fillRect(26, 124, 268, 28);
      ctx.strokeStyle = '#f7c11e';
      ctx.lineWidth = 2;
      ctx.strokeRect(26, 124, 268, 28);

      ctx.fillStyle = '#f7c11e';
      ctx.font = '7px "Press Start 2P", monospace';
      const tw = ctx.measureText(this.bannerText).width;
      ctx.fillText(this.bannerText, Math.round(160 - tw / 2), 141);
    }
  }
}
