/**
 * REBRUNCH // Super Padel DX 2v2 - Core Game Engine (js/game/engine.js)
 * 60fps Pixel-Art Game Loop, Serve/Rally State Machine, Smash X3 Screen-Shake,
 * and Hall of Fame Match Completion Callback.
 */

import { COURT, createBall, computeLandingPrediction, stepBallPhysics } from './physics.js';
import { createPlayers, drawPadelCourt, drawLandingReticle, drawPlayerSprite, drawBall25D } from './entities.js';
import { updateAIPartner, updateCPUOpponents } from './ai.js';
import { sound } from './audio.js';

export class PadelGameEngine {
    constructor(canvas, input, callbacks = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.callbacks = callbacks;

        this.players = createPlayers('TU', 'SOCIO IA');
        this.ball = createBall();
        this.callouts = [];
        this.particles = [];

        this.playerScore = 0;
        this.cpuScore = 0;
        this.targetWinScore = 4; // First to 4 points wins the match

        this.state = 'SERVE'; // 'SERVE' | 'RALLY' | 'POINT_PAUSE' | 'MATCH_OVER'
        this.serverTeam = 'player';
        this.pauseTimer = 0;
        this.frameTick = 0;
        this.shakeFrames = 0;
        this.running = false;
        this.rafId = null;
    }

    configurePlayerNames(playerName, partnerName) {
        this.players = createPlayers(playerName || 'TU', partnerName || 'SOCIO IA');
    }

    startNewMatch() {
        this.playerScore = 0;
        this.cpuScore = 0;
        this.serverTeam = 'player';
        this.callouts = [];
        this.particles = [];
        this.setupServe('player');
        this._notifyScore();

        if (!this.running) {
            this.running = true;
            this.input.isGameActive = true;
            this._loop();
        }
    }

    stop() {
        this.running = false;
        this.input.isGameActive = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    setupServe(serverTeam = 'player') {
        this.state = 'SERVE';
        this.serverTeam = serverTeam;

        // Reset player positions
        const [human, partner, cpu1, cpu2] = this.players;
        human.x = COURT.centerX - 46;
        human.y = COURT.bottom - 34;
        human.charge = 0;
        human.dashTimer = 0;

        partner.x = COURT.centerX + 46;
        partner.y = COURT.netY + 46;

        cpu1.x = COURT.centerX - 46;
        cpu1.y = COURT.top + 38;

        cpu2.x = COURT.centerX + 46;
        cpu2.y = COURT.netY - 46;

        this.ball = createBall();
        if (serverTeam === 'player') {
            this.ball.x = human.x + 10;
            this.ball.y = human.y - 6;
            this.ball.z = 12;
        } else {
            this.ball.x = cpu1.x + 8;
            this.ball.y = cpu1.y + 8;
            this.ball.z = 12;
            this.pauseTimer = 45; // CPU auto-serves after 45 frames
        }
    }

    addCallout(text, x, y, color = '#f5b82e') {
        this.callouts.push({ text, x, y, color, life: 42 });
    }

    spawnParticles(x, y, color = '#f5b82e', count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const spd = 1 + Math.random() * 2.2;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                color,
                life: 18 + Math.random() * 10
            });
        }
    }

    _notifyScore() {
        if (typeof this.callbacks.onScoreUpdate === 'function') {
            this.callbacks.onScoreUpdate(this.playerScore, this.cpuScore);
        }
    }

    _updateHuman(human) {
        const keys = this.input.keys;

        // Dash / Dive (Yellow Button / X)
        if (keys.dash && human.dashCooldown <= 0 && human.dashTimer <= 0) {
            human.dashTimer = 11;
            human.dashCooldown = 36;
            sound.playBlip(480, 0.05, 'triangle', 0.12);
            this.addCallout('SCATTO!', human.x, human.y - 18, '#f5b82e');
        }

        if (human.dashTimer > 0) human.dashTimer--;
        if (human.dashCooldown > 0) human.dashCooldown--;
        if (human.swingTimer > 0) human.swingTimer--;

        const spd = human.dashTimer > 0 ? human.speed * 1.95 : human.speed;
        let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);

        if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
        }

        human.vx = dx * spd;
        human.vy = dy * spd;
        human.x = Math.max(COURT.left + 10, Math.min(COURT.right - 10, human.x + human.vx));
        human.y = Math.max(COURT.netY + 16, Math.min(COURT.bottom - 10, human.y + human.vy));

        // Serve Trigger
        if (this.state === 'SERVE' && this.serverTeam === 'player') {
            this.ball.x = human.x + 10;
            this.ball.y = human.y - 6;
            if (keys.hit || keys.lob) {
                this.state = 'RALLY';
                this.ball.vx = 1.35 + (keys.right ? 0.5 : keys.left ? -0.5 : 0);
                this.ball.vy = -3.6;
                this.ball.vz = keys.lob ? 4.4 : 2.9;
                this.ball.bounces = 0;
                this.ball.lastHitterTeam = 'player';
                computeLandingPrediction(this.ball);
                human.swingTimer = 14;
                sound.playHit(1.1);
                this.addCallout('SERVIZIO!', human.x, human.y - 18, '#f5b82e');
                keys.hit = false;
                keys.lob = false;
            }
            return;
        }

        if (this.state !== 'RALLY') return;

        // Charge shot while holding Red Button / Space
        if (keys.hit) {
            human.charge = Math.min(1, human.charge + 0.045);
        } else if (human.charge > 0) {
            human.charge = Math.max(0, human.charge - 0.08);
        }

        // Check if ball is within human strike zone
        const dist = Math.hypot(human.x - this.ball.x, human.y - this.ball.y);
        const canHit = dist < 25 && this.ball.z < 30 && this.ball.y > COURT.netY - 4;

        if (canHit && human.swingTimer === 0 && (keys.hit || keys.lob || human.charge > 0.25)) {
            human.swingTimer = 15;
            const aimDir = (keys.right ? 1.4 : keys.left ? -1.4 : ((COURT.centerX - human.x) / 60));

            // Check for SMASH X3 condition (near net + high ball + Red Hit button)
            const isSmashOpportunity = !keys.lob && human.y < COURT.netY + 92 && this.ball.z > 15;

            if (keys.lob) {
                // Pallonetto / Lob (Green Button / Z)
                this.ball.vx = aimDir;
                this.ball.vy = -2.55;
                this.ball.vz = 5.25;
                this.ball.isSmash = false;
                sound.playLob();
                this.addCallout('LOB!', human.x, human.y - 20, '#6bc947');
            } else if (isSmashOpportunity) {
                // SMASH X3!
                this.ball.vx = aimDir * 1.45;
                this.ball.vy = -4.95;
                this.ball.vz = 3.85;
                this.ball.isSmash = true;
                this.shakeFrames = 14;
                sound.playSmash();
                this.spawnParticles(this.ball.x, this.ball.y, '#d33636', 14);
                this.addCallout('🔥 SMASH X3!', human.x, human.y - 22, '#d33636');
                if (typeof this.callbacks.onSmash === 'function') {
                    this.callbacks.onSmash();
                }
            } else {
                // Standard / Charged Drive
                const powerBoost = 1 + human.charge * 0.35;
                this.ball.vx = aimDir * 1.25;
                this.ball.vy = -3.65 * powerBoost;
                this.ball.vz = 2.85;
                this.ball.isSmash = false;
                sound.playHit(powerBoost);
                if (human.charge > 0.65) {
                    this.addCallout('VIBORA!', human.x, human.y - 18, '#f5b82e');
                }
            }

            human.charge = 0;
            this.ball.bounces = 0;
            this.ball.lastHitterTeam = 'player';
            computeLandingPrediction(this.ball);
            keys.hit = false;
            keys.lob = false;
        }
    }

    _awardPoint(winnerTeam, reason) {
        this.state = 'POINT_PAUSE';
        this.pauseTimer = 75;
        this.shakeFrames = 8;

        if (winnerTeam === 'player') {
            this.playerScore++;
            sound.playPoint(true);
            this.addCallout(`PUNTO NOI! (${reason})`, COURT.centerX, COURT.netY - 12, '#6bc947');
        } else {
            this.cpuScore++;
            sound.playPoint(false);
            this.addCallout(`PUNTO CPU! (${reason})`, COURT.centerX, COURT.netY - 12, '#d33636');
        }

        this.spawnParticles(this.ball.x, this.ball.y, winnerTeam === 'player' ? '#6bc947' : '#d33636', 12);
        this._notifyScore();
    }

    _update() {
        this.frameTick++;
        const [human, partner, cpu1, cpu2] = this.players;

        // Tick down swing timers on AI players
        [partner, cpu1, cpu2].forEach(p => {
            if (p.swingTimer > 0) p.swingTimer--;
        });

        this._updateHuman(human);

        // CPU Auto-Serve
        if (this.state === 'SERVE' && this.serverTeam === 'cpu') {
            this.pauseTimer--;
            if (this.pauseTimer <= 0) {
                this.state = 'RALLY';
                this.ball.vx = 1.2;
                this.ball.vy = 3.45;
                this.ball.vz = 2.9;
                this.ball.bounces = 0;
                this.ball.lastHitterTeam = 'cpu';
                computeLandingPrediction(this.ball);
                cpu1.swingTimer = 14;
                sound.playHit(1.0);
                this.addCallout('SERVIZIO CPU!', cpu1.x, cpu1.y + 14, '#f5b82e');
            }
        }

        if (this.state === 'RALLY') {
            updateAIPartner(partner, human, this.ball, true, (t, x, y, c) => this.addCallout(t, x, y, c));
            updateCPUOpponents(cpu1, cpu2, this.ball, true, (t, x, y, c) => this.addCallout(t, x, y, c));

            const evt = stepBallPhysics(this.ball);
            if (evt) {
                if (evt.type === 'bounce') {
                    sound.playBounce();
                } else if (evt.type === 'glass_valid') {
                    sound.playGlassWall();
                    this.spawnParticles(this.ball.x, this.ball.y, '#59b8d9', 7);
                    this.addCallout('SPONDA VETRO!', this.ball.x, this.ball.y, '#59b8d9');
                } else if (evt.type === 'point') {
                    this._awardPoint(evt.winner, evt.reason);
                }
            }
        } else if (this.state === 'POINT_PAUSE') {
            this.pauseTimer--;
            if (this.pauseTimer <= 0) {
                if (this.playerScore >= this.targetWinScore || this.cpuScore >= this.targetWinScore) {
                    this.state = 'MATCH_OVER';
                    const won = this.playerScore > this.cpuScore;
                    if (won) sound.playLevelUpJingle();
                    if (typeof this.callbacks.onMatchEnd === 'function') {
                        this.callbacks.onMatchEnd({
                            playerScore: this.playerScore,
                            cpuScore: this.cpuScore,
                            won
                        });
                    }
                } else {
                    const nextServer = (this.playerScore + this.cpuScore) % 2 === 0 ? 'player' : 'cpu';
                    this.setupServe(nextServer);
                }
            }
        }

        // Update particles & floating callouts
        this.particles.forEach(pt => {
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life--;
        });
        this.particles = this.particles.filter(pt => pt.life > 0);

        this.callouts.forEach(c => {
            c.y -= 0.35;
            c.life--;
        });
        this.callouts = this.callouts.filter(c => c.life > 0);
    }

    _draw() {
        const ctx = this.ctx;
        ctx.save();

        // Screen-shake effect on Smash X3 / Point
        if (this.shakeFrames > 0) {
            this.shakeFrames--;
            const sx = (Math.random() - 0.5) * 6;
            const sy = (Math.random() - 0.5) * 6;
            ctx.translate(sx, sy);
        }

        drawPadelCourt(ctx, this.frameTick);

        if (this.state === 'RALLY') {
            drawLandingReticle(ctx, this.ball, this.frameTick);
        }

        // Sort players by Y so foreground overlaps background naturally
        const sortedPlayers = [...this.players].sort((a, b) => a.y - b.y);
        sortedPlayers.forEach(p => drawPlayerSprite(ctx, p, this.frameTick));

        drawBall25D(ctx, this.ball);

        // Draw particles
        this.particles.forEach(pt => {
            ctx.fillStyle = pt.color;
            ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 3, 3);
        });

        // Draw floating pixel callouts
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        this.callouts.forEach(c => {
            const cx = Math.max(55, Math.min(COURT.width - 55, Math.round(c.x)));
            const cy = Math.max(24, Math.min(COURT.height - 16, Math.round(c.y)));
            ctx.fillStyle = '#10141d';
            ctx.fillText(c.text, cx + 1, cy + 1);
            ctx.fillStyle = c.color;
            ctx.fillText(c.text, cx, cy);
        });

        // Serve prompt banner
        if (this.state === 'SERVE' && this.serverTeam === 'player') {
            if ((this.frameTick % 36) < 26) {
                ctx.fillStyle = 'rgba(16, 20, 29, 0.85)';
                ctx.fillRect(28, COURT.netY + 14, COURT.width - 56, 22);
                ctx.strokeStyle = '#f5b82e';
                ctx.strokeRect(28, COURT.netY + 14, COURT.width - 56, 22);
                ctx.fillStyle = '#f5b82e';
                ctx.font = '7px "Press Start 2P", monospace';
                ctx.fillText('PREMI [ROSSO / SPACE] PER SERVIRE!', COURT.centerX, COURT.netY + 28);
            }
        }

        ctx.restore();
    }

    _loop() {
        if (!this.running) return;
        this._update();
        this._draw();
        this.rafId = requestAnimationFrame(() => this._loop());
    }
}
