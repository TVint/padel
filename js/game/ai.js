// js/game/ai.js - 2v2 Padel Team AI ("Tergicristallo" Wiper Scaling, Callouts & Opponents)

import { COURT } from './physics.js';
import { sound } from './audio.js';

export class PadelTeamAI {
  constructor() {
    this.lastCalloutTick = 0;
    this.tick = 0;
  }

  updatePartner(partner, human, ball, speedMult = 1.0) {
    this.tick++;
    if (partner.calloutTimer > 0) partner.calloutTimer--;
    if (partner.swingTimer > 0) partner.swingTimer--;

    const centerX = 160;
    const humanOffset = human.x - centerX;
    let targetX = centerX - humanOffset * 0.65;
    if (partner.side === 'right') {
      targetX = Math.max(centerX + 12, Math.min(COURT.RIGHT - 20, targetX + 36));
    } else {
      targetX = Math.max(COURT.LEFT + 20, Math.min(centerX - 12, targetX - 36));
    }

    let targetY = human.y < COURT.SERVICE_BOTTOM ? human.y + 6 : 284;

    const ballComingToPlayerSide = ball.inPlay && (ball.vy > 0 || ball.landingTarget.y > COURT.NET_Y);
    if (ballComingToPlayerSide) {
      const distPartner = Math.hypot(ball.landingTarget.x - partner.x, ball.landingTarget.y - partner.y);
      const distHuman = Math.hypot(ball.landingTarget.x - human.x, ball.landingTarget.y - human.y);

      if (distPartner < distHuman - 6 || ball.landingTarget.x > 176) {
        targetX = ball.landingTarget.x;
        targetY = Math.max(COURT.NET_Y + 18, Math.min(COURT.BOTTOM - 12, ball.landingTarget.y));

        if (this.tick - this.lastCalloutTick > 95) {
          partner.say('MIA!', 42);
          this.lastCalloutTick = this.tick;
        }
      } else if (this.tick - this.lastCalloutTick > 110) {
        partner.say('VAI TU!', 40);
        this.lastCalloutTick = this.tick;
      }
    }

    this._moveAgent(partner, targetX, targetY);

    if (ball.inPlay && ball.lastHitterTeam !== 'player' && partner.canReachBall(ball) && ball.z < 27) {
      partner.swingTimer = 14;
      sound.paddleHit(1.05);
      const aimX = (Math.random() - 0.5) * 2.0;
      const vy = (-3.45 - Math.random() * 0.55) * speedMult;
      const vz = ball.z > 16 ? 2.0 : 2.65;
      ball.launch(aimX, vy, vz, 'player', false, (Math.random() - 0.5) * 0.25);
    }
  }

  updateOpponents(cpuLeft, cpuRight, ball, speedMult = 1.0) {
    [cpuLeft, cpuRight].forEach((cpu) => {
      if (cpu.calloutTimer > 0) cpu.calloutTimer--;
      if (cpu.swingTimer > 0) cpu.swingTimer--;
    });

    const ballHeadingTop = ball.inPlay && (ball.vy < 0 || ball.landingTarget.y < COURT.NET_Y);

    let leftTargetX = 112;
    let leftTargetY = 88;
    let rightTargetX = 208;
    let rightTargetY = 88;

    if (ballHeadingTop) {
      const tx = ball.landingTarget.x;
      const ty = Math.max(COURT.TOP + 12, Math.min(COURT.NET_Y - 18, ball.landingTarget.y));

      if (tx < 160) {
        leftTargetX = tx;
        leftTargetY = ty;
        rightTargetX = Math.min(242, tx + 88);
        rightTargetY = Math.min(COURT.NET_Y - 24, ty + 14);
      } else {
        rightTargetX = tx;
        rightTargetY = ty;
        leftTargetX = Math.max(78, tx - 88);
        leftTargetY = Math.min(COURT.NET_Y - 24, ty + 14);
      }
    } else {
      const shift = (ball.x - 160) * 0.22;
      leftTargetX = 112 + shift;
      rightTargetX = 208 + shift;
      leftTargetY = 92;
      rightTargetY = 92;
    }

    this._moveAgent(cpuLeft, leftTargetX, leftTargetY, speedMult);
    this._moveAgent(cpuRight, rightTargetX, rightTargetY, speedMult);

    [cpuLeft, cpuRight].forEach((cpu) => {
      if (ball.inPlay && ball.lastHitterTeam !== 'cpu' && cpu.canReachBall(ball) && ball.z < 28) {
        cpu.swingTimer = 14;
        const isHighNearNet = ball.z > 18 && cpu.y > COURT.SERVICE_TOP;
        if (isHighNearNet && Math.random() < 0.32) {
          sound.smashHit();
          cpu.say('VAMOS!', 35);
          ball.launch((Math.random() - 0.5) * 2.2, 4.05 * speedMult, -0.95, 'cpu', true, 0.25);
        } else if (Math.random() < 0.24) {
          sound.paddleHit(0.85);
          cpu.say('GLOBO!', 35);
          ball.launch((Math.random() - 0.5) * 1.5, 2.65 * speedMult, 4.85, 'cpu', false, 0);
        } else {
          sound.paddleHit(1.0);
          const targetVx = ((160 - cpu.x) / 92) + (Math.random() - 0.5) * 1.55;
          ball.launch(targetVx, (3.3 + Math.random() * 0.55) * speedMult, 2.55, 'cpu', false, (Math.random() - 0.5) * 0.2);
        }
      }
    });
  }

  _moveAgent(agent, tx, ty, speedMult = 1.0) {
    const dx = tx - agent.x;
    const dy = ty - agent.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 2.2) {
      agent.vx = (dx / dist) * agent.speed * speedMult;
      agent.vy = (dy / dist) * agent.speed * speedMult;
      agent.x += agent.vx;
      agent.y += agent.vy;
      agent._clampToHalfCourt();
      agent.animTimer++;
      if (agent.animTimer % 7 === 0) {
        agent.animFrame = (agent.animFrame + 1) % 2;
      }
    } else {
      agent.vx = 0;
      agent.vy = 0;
      agent.animFrame = 0;
    }
  }
}
