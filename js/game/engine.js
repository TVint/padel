// js/game/engine.js - Super Padel DX 2v2 Game Engine, Calibrated Charge Shots & Arcade Score

import { COURT, BallPhysics, computeChargedShotVelocity } from './physics.js';
import { PadelPlayer, PALETTES } from './entities.js';
import { PadelTeamAI } from './ai.js';
import { sound } from './audio.js';

const TENNIS_POINTS = ['0', '15', '30', '40', 'AD'];

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
      y: 198,
      isHuman: true,
      palette: PALETTES.human,
    });

    this.partner = new PadelPlayer({
      id: 'p2',
      name: 'SOCIO',
      team: 'player',
      side: 'right',
      x: 208,
      y: 198,
      isHuman: false,
      palette: PALETTES.partner,
    });

    this.cpuLeft = new PadelPlayer({
      id: 'c1',
      name: 'PRO-1',
      team: 'cpu',
      side: 'left',
      x: 112,
      y: 56,
      isHuman: false,
      palette: PALETTES.cpuLeft,
    });

    this.cpuRight = new PadelPlayer({
      id: 'c2',
      name: 'PRO-2',
      team: 'cpu',
      side: 'right',
      x: 208,
      y: 56,
      isHuman: false,
      palette: PALETTES.cpuRight,
    });

    this.players = [this.human, this.partner, this.cpuLeft, this.cpuRight];

    // Match State & Arcade Score
    this.ptsPlayer = 0;
    this.ptsCpu = 0;
    this.gamesPlayer = 0;
    this.gamesCpu = 0;
    this.targetGames = 2; // Best of 2 games mini-set
    this.arcadeScore = 0; // Points sent to leaderboard at match end
    this.rallyHits = 0;
    this.waitingForServe = true;
    this.serveTimer = 0;
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

  loop() {
    if (!this.running) return;
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  update() {
    if (this.matchOver) return;
    if (this.bannerTimer > 0) this.bannerTimer--;

    const action = this.human.updateHuman(this.input, this.ball);

    // Serve trigger (press or release A/B or GIOCA while waiting for serve)
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
        this.ball.launch(shot.vx, shot.vy, shot.vz, 'player', false, shot.spin);
        this._syncHud('SERVIZIO!');
      }
      return;
    }

    // Human strikes the ball in play
    if (this.ball.inPlay && this.ball.lastHitterTeam !== 'player') {
      const canReach = this.human.canReachBall(this.ball);
      if (canReach && (action || this.input.keys.actionA || this.ball.z < 15)) {
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

    // Linearly map charge (0-100) to shot velocity (vx, vy, vz)
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
    } else {
      sound.paddleHit(0.8 + (charge / 100) * 0.9);
      this.arcadeScore += 25;
    }

    this.rallyHits++;
    this.human.say(shot.shotType.replace('🔥 ', '').replace('⚡ ', ''), 32);
    this.ball.launch(shot.vx, shot.vy, shot.vz, 'player', shot.isSmash, shot.spin);
    this._syncHud(shot.shotType);
  }

  _handlePointOutcome(result) {
    this.ball.inPlay = false;

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
      this._syncHud(`🟢 ${reasonLabel}`);
    } else {
      this.ptsCpu++;
      this.arcadeScore += 35; // participation rally bonus
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

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    // 1. Exterior Surroundings (Out-of-court turf)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, COURT.WIDTH, COURT.HEIGHT);

    // 2. Blue WPT Padel Turf
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(COURT.LEFT, COURT.TOP, COURT.RIGHT - COURT.LEFT, COURT.BOTTOM - COURT.TOP);

    // Checkerboard 8-bit turf texture
    ctx.fillStyle = '#0369a1';
    for (let y = COURT.TOP; y < COURT.BOTTOM; y += 16) {
      ctx.fillRect(COURT.LEFT, y, COURT.RIGHT - COURT.LEFT, 8);
    }

    // 3. White Court Lines
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.strokeRect(COURT.LEFT, COURT.TOP, COURT.RIGHT - COURT.LEFT, COURT.BOTTOM - COURT.TOP);

    // Service lines
    ctx.beginPath();
    ctx.moveTo(COURT.LEFT, COURT.SERVICE_TOP);
    ctx.lineTo(COURT.RIGHT, COURT.SERVICE_TOP);
    ctx.moveTo(COURT.LEFT, COURT.SERVICE_BOTTOM);
    ctx.lineTo(COURT.RIGHT, COURT.SERVICE_BOTTOM);
    // Center service line
    ctx.moveTo(160, COURT.SERVICE_TOP);
    ctx.lineTo(160, COURT.SERVICE_BOTTOM);
    ctx.stroke();

    // 4. Glass Walls (Cyan Glow) vs Metallic Mesh (Center Side Walls)
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 4;
    ctx.strokeRect(COURT.LEFT - 2, COURT.TOP - 2, COURT.RIGHT - COURT.LEFT + 4, COURT.BOTTOM - COURT.TOP + 4);

    // Metallic central mesh segments
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(COURT.LEFT - 2, COURT.NET_Y - 40);
    ctx.lineTo(COURT.LEFT - 2, COURT.NET_Y + 40);
    ctx.moveTo(COURT.RIGHT + 2, COURT.NET_Y - 40);
    ctx.lineTo(COURT.RIGHT + 2, COURT.NET_Y + 40);
    ctx.stroke();

    // 5. Landing Target Crosshair (Mario Tennis GBC style)
    if (this.ball.inPlay) {
      const tx = Math.round(this.ball.landingTarget.x);
      const ty = Math.round(this.ball.landingTarget.y);
      ctx.strokeStyle = this.ball.isSmash ? '#ef4444' : '#fde047';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx - 5, ty - 5, 10, 10);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(tx - 1, ty - 1, 2, 2);
    }

    // 6. Top Players (CPU)
    this.cpuLeft.draw(ctx);
    this.cpuRight.draw(ctx);

    // 7. Central Net with 8-bit Mesh Pattern
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(COURT.LEFT - 4, COURT.NET_Y - 2, COURT.RIGHT - COURT.LEFT + 8, 5);
    ctx.fillStyle = '#f8fafc';
    for (let x = COURT.LEFT; x < COURT.RIGHT; x += 6) {
      ctx.fillRect(x, COURT.NET_Y - 3, 4, 2);
    }

    // 8. Bottom Players (Human + Partner)
    this.partner.draw(ctx);
    this.human.draw(ctx);

    // 9. Ball Shadow + 2.5D Ball
    const bx = Math.round(this.ball.x);
    const by = Math.round(this.ball.y);
    const bz = Math.round(this.ball.z);

    // Trail for Smash
    if (this.ball.isSmash) {
      this.ball.trail.forEach((t, i) => {
        ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#fde047';
        ctx.fillRect(Math.round(t.x - 2), Math.round(t.y - t.z - 2), 3, 3);
      });
    }

    // Ground shadow at (x, y)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(bx - 2, by - 1, 5, 3);

    // Elevated Ball at (x, y - z)
    const size = bz > 22 ? 6 : 5;
    ctx.fillStyle = this.ball.isSmash ? '#fb923c' : '#bef264';
    ctx.fillRect(bx - 2, by - bz - 2, size, size);
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 2, by - bz - 2, size, size);

    // 10. Retro Event Banner
    if (this.bannerTimer > 0 && this.bannerText) {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.fillRect(26, 108, 268, 28);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.strokeRect(26, 108, 268, 28);

      ctx.fillStyle = '#fde047';
      ctx.font = '7px "Press Start 2P", monospace';
      const tw = ctx.measureText(this.bannerText).width;
      ctx.fillText(this.bannerText, Math.round(160 - tw / 2), 125);
    }
  }
}
