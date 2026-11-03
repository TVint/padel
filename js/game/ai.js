/**
 * REBRUNCH // Super Padel DX 2v2 - Partner & CPU 2v2 AI (js/game/ai.js)
 * Implements "Tergicristallo" (windshield wiper) partner positioning
 * and coordinated 2v2 CPU net/baseline tactics.
 */

import { COURT, computeLandingPrediction } from './physics.js';
import { sound } from './audio.js';

export function updateAIPartner(partner, human, ball, rallyActive, triggerCallout) {
    if (!rallyActive) return;

    // 1. "Tergicristallo" (Wiper) Positioning:
    // If human is on the left half, partner covers the right half (and vice versa).
    const humanOnLeft = human.x < COURT.centerX;
    let desiredX = humanOnLeft ? COURT.centerX + 46 : COURT.centerX - 46;
    // Slight lateral shift toward the ball
    desiredX += (ball.x - COURT.centerX) * 0.22;

    // Vertical complement: if human goes deep, partner holds net; if human charges net, partner guards middle/base
    let desiredY = human.y > COURT.netY + 80 ? COURT.netY + 42 : COURT.bottom - 48;

    // 2. Intercept incoming ball if it lands on partner's side of the bottom court!
    const ballComingToBottom = ball.vy > 0 || ball.targetY > COURT.netY;
    const distHumanToTarget = Math.hypot(human.x - ball.targetX, human.y - ball.targetY);
    const distPartnerToTarget = Math.hypot(partner.x - ball.targetX, partner.y - ball.targetY);

    if (ballComingToBottom && ball.targetY > COURT.netY + 8 && distPartnerToTarget < distHumanToTarget + 12) {
        desiredX = ball.targetX;
        desiredY = Math.max(COURT.netY + 22, Math.min(COURT.bottom - 14, ball.targetY));
    }

    moveTowards(partner, desiredX, desiredY, COURT.netY + 20, COURT.bottom - 12);

    // 3. Auto-return shot if ball is in partner's reach and coming from CPU
    if (ball.lastHitterTeam === 'cpu' && ball.y > COURT.netY + 8) {
        const dist = Math.hypot(partner.x - ball.x, partner.y - ball.y);
        if (dist < 22 && ball.z < 24 && partner.swingTimer === 0) {
            partner.swingTimer = 14;
            const aimX = (Math.random() < 0.5 ? COURT.left + 38 : COURT.right - 38) - ball.x;
            ball.vx = (aimX / 52) + (Math.random() - 0.5) * 0.5;
            ball.vy = -3.45;
            ball.vz = 3.1;
            ball.bounces = 0;
            ball.isSmash = false;
            ball.lastHitterTeam = 'player';
            computeLandingPrediction(ball);
            sound.playHit(1.05);
            triggerCallout('SOCIO!', partner.x, partner.y - 18, '#6bc947');
        }
    }
}

export function updateCPUOpponents(cpu1, cpu2, ball, rallyActive, triggerCallout) {
    if (!rallyActive) return;

    const ballHeadingTop = ball.vy < 0 || ball.targetY < COURT.netY;

    // Decide which CPU chases the ball
    const d1 = Math.hypot(cpu1.x - ball.targetX, cpu1.y - ball.targetY);
    const d2 = Math.hypot(cpu2.x - ball.targetX, cpu2.y - ball.targetY);
    const chaser = d1 <= d2 ? cpu1 : cpu2;
    const cover  = d1 <= d2 ? cpu2 : cpu1;

    if (ballHeadingTop && ball.targetY < COURT.netY - 6) {
        moveTowards(chaser, ball.targetX, Math.max(COURT.top + 14, ball.targetY - 4), COURT.top + 12, COURT.netY - 20);
        // Teammate covers opposite side in wiper sync
        const coverX = chaser.x < COURT.centerX ? COURT.centerX + 46 : COURT.centerX - 46;
        const coverY = chaser.y < COURT.top + 65 ? COURT.netY - 42 : COURT.top + 38;
        moveTowards(cover, coverX, coverY, COURT.top + 12, COURT.netY - 20);
    } else {
        // Default balanced 2v2 defense (1 baseline left, 1 net right)
        moveTowards(cpu1, COURT.centerX - 45 + (ball.x - COURT.centerX) * 0.2, COURT.top + 42, COURT.top + 12, COURT.netY - 20);
        moveTowards(cpu2, COURT.centerX + 45 + (ball.x - COURT.centerX) * 0.2, COURT.netY - 44, COURT.top + 12, COURT.netY - 20);
    }

    // Check CPU Shot Execution
    [cpu1, cpu2].forEach(cpu => {
        if (ball.lastHitterTeam === 'player' && ball.y < COURT.netY - 6 && cpu.swingTimer === 0) {
            const dist = Math.hypot(cpu.x - ball.x, cpu.y - ball.y);
            if (dist < 22 && ball.z < 26) {
                cpu.swingTimer = 15;
                const useLob = cpu.y < COURT.top + 38 && Math.random() < 0.32;
                const targetX = COURT.left + 36 + Math.random() * (COURT.right - COURT.left - 72);

                if (useLob) {
                    ball.vx = (targetX - ball.x) / 68;
                    ball.vy = 2.45;
                    ball.vz = 5.1; // High lob!
                    sound.playLob();
                    triggerCallout('GLOBO CPU!', cpu.x, cpu.y - 14, '#59b8d9');
                } else {
                    ball.vx = (targetX - ball.x) / 50;
                    ball.vy = 3.55 + Math.random() * 0.55;
                    ball.vz = 2.85;
                    sound.playHit(1.0);
                }

                ball.bounces = 0;
                ball.isSmash = false;
                ball.lastHitterTeam = 'cpu';
                computeLandingPrediction(ball);
            }
        }
    });
}

function moveTowards(entity, targetX, targetY, minY, maxY) {
    const dx = targetX - entity.x;
    const dy = targetY - entity.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 2.5) {
        entity.vx = (dx / dist) * entity.speed;
        entity.vy = (dy / dist) * entity.speed;
        entity.x += entity.vx;
        entity.y += entity.vy;
    } else {
        entity.vx = 0;
        entity.vy = 0;
    }

    entity.x = Math.max(COURT.left + 10, Math.min(COURT.right - 10, entity.x));
    entity.y = Math.max(minY, Math.min(maxY, entity.y));
}
