/**
 * REBRUNCH // Super Padel DX 2v2 - Entities & Pixel-Art Renderer (js/game/entities.js)
 */

import { COURT } from './physics.js';

export function createPlayers(playerName = 'TU', partnerName = 'SOCIO IA') {
    return [
        // 0: Human Player (Bottom Left)
        {
            id: 'p1',
            name: playerName.slice(0, 10),
            team: 'player',
            isHuman: true,
            x: COURT.centerX - 48,
            y: COURT.bottom - 38,
            vx: 0,
            vy: 0,
            speed: 2.35,
            dashTimer: 0,
            dashCooldown: 0,
            charge: 0,
            isCharging: false,
            swingTimer: 0,
            animFrame: 0,
            shirtColor: '#d33636',
            hairColor: '#f5b82e',
            skinColor: '#ffcc99'
        },
        // 1: AI Partner (Bottom Right - Wiper movement)
        {
            id: 'p2',
            name: (partnerName && partnerName !== 'CERCA PARTNER' ? partnerName : 'SOCIO IA').slice(0, 10),
            team: 'player',
            isHuman: false,
            role: 'net',
            x: COURT.centerX + 48,
            y: COURT.netY + 46,
            vx: 0,
            vy: 0,
            speed: 2.05,
            dashTimer: 0,
            dashCooldown: 0,
            charge: 0,
            isCharging: false,
            swingTimer: 0,
            animFrame: 0,
            shirtColor: '#6bc947',
            hairColor: '#222831',
            skinColor: '#f5c296'
        },
        // 2: CPU Opponent 1 (Top Left - Baseline)
        {
            id: 'cpu1',
            name: 'ALEJANDRO',
            team: 'cpu',
            isHuman: false,
            role: 'base',
            x: COURT.centerX - 48,
            y: COURT.top + 42,
            vx: 0,
            vy: 0,
            speed: 2.1,
            dashTimer: 0,
            dashCooldown: 0,
            charge: 0,
            isCharging: false,
            swingTimer: 0,
            animFrame: 0,
            shirtColor: '#f5b82e',
            hairColor: '#4e2a14',
            skinColor: '#f0b888'
        },
        // 3: CPU Opponent 2 (Top Right - Net)
        {
            id: 'cpu2',
            name: 'COELLO8BIT',
            team: 'cpu',
            isHuman: false,
            role: 'net',
            x: COURT.centerX + 48,
            y: COURT.netY - 46,
            vx: 0,
            vy: 0,
            speed: 2.15,
            dashTimer: 0,
            dashCooldown: 0,
            charge: 0,
            isCharging: false,
            swingTimer: 0,
            animFrame: 0,
            shirtColor: '#59b8d9',
            hairColor: '#10141d',
            skinColor: '#f5c296'
        }
    ];
}

export function drawPadelCourt(ctx, frameTick) {
    // Outer floor surround
    ctx.fillStyle = '#1f2838';
    ctx.fillRect(0, 0, COURT.width, COURT.height);

    // WPT Blue Padel Turf with 8-bit stripes
    for (let y = COURT.top; y < COURT.bottom; y += 14) {
        ctx.fillStyle = ((y / 14) | 0) % 2 === 0 ? '#1b6ca8' : '#175e94';
        ctx.fillRect(COURT.left, y, COURT.right - COURT.left, 14);
    }

    // Back Tempered Glass Walls (Cyan translucent top & bottom)
    ctx.fillStyle = '#59b8d9';
    ctx.fillRect(COURT.left - 4, COURT.top - 10, (COURT.right - COURT.left) + 8, 10);
    ctx.fillRect(COURT.left - 4, COURT.bottom, (COURT.right - COURT.left) + 8, 10);

    // Glass wall panel dividers
    ctx.fillStyle = '#10141d';
    for (let x = COURT.left; x <= COURT.right; x += 44) {
        ctx.fillRect(x, COURT.top - 10, 2, 10);
        ctx.fillRect(x, COURT.bottom, 2, 10);
    }

    // Side Metallic Mesh Fences (Left & Right)
    for (let y = COURT.top; y < COURT.bottom; y += 8) {
        const isCornerGlass = y < COURT.top + 48 || y > COURT.bottom - 48;
        ctx.fillStyle = isCornerGlass ? '#59b8d9' : ((y / 8) % 2 === 0 ? '#8c9bb5' : '#58667d');
        ctx.fillRect(COURT.left - 6, y, 6, 7);
        ctx.fillRect(COURT.right, y, 6, 7);
    }

    // White Court Lines
    ctx.fillStyle = '#eef5f9';
    // Outer boundary
    ctx.fillRect(COURT.left, COURT.top, COURT.right - COURT.left, 2);
    ctx.fillRect(COURT.left, COURT.bottom - 2, COURT.right - COURT.left, 2);
    ctx.fillRect(COURT.left, COURT.top, 2, COURT.bottom - COURT.top);
    ctx.fillRect(COURT.right - 2, COURT.top, 2, COURT.bottom - COURT.top);

    // Service Lines
    ctx.fillRect(COURT.left, COURT.serviceTop, COURT.right - COURT.left, 2);
    ctx.fillRect(COURT.left, COURT.serviceBottom, COURT.right - COURT.left, 2);

    // Center Service T-Line
    ctx.fillRect(COURT.centerX - 1, COURT.serviceTop, 2, COURT.serviceBottom - COURT.serviceTop);

    // Net Shadow & Padel Net
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(COURT.left, COURT.netY + 3, COURT.right - COURT.left, 4);

    // Net mesh
    ctx.fillStyle = '#222938';
    ctx.fillRect(COURT.left - 2, COURT.netY - 3, (COURT.right - COURT.left) + 4, 6);
    ctx.fillStyle = '#f5f7fa';
    ctx.fillRect(COURT.left - 2, COURT.netY - 3, (COURT.right - COURT.left) + 4, 2);

    // Net sponsor pixels ("REBRUNCH")
    if ((frameTick >> 5) % 2 === 0) {
        ctx.fillStyle = '#f5b82e';
    } else {
        ctx.fillStyle = '#7fd141';
    }
    ctx.fillRect(COURT.centerX - 24, COURT.netY - 1, 48, 2);
}

export function drawLandingReticle(ctx, ball, frameTick) {
    if (Math.abs(ball.vx) + Math.abs(ball.vy) < 0.1) return;
    const blink = (frameTick % 12) < 7;
    const tx = Math.round(ball.targetX);
    const ty = Math.round(ball.targetY);

    // Smash Opportunity Star if near net and ball is high
    const isHighLob = ball.z > 18 && ball.y > COURT.netY && ball.y < COURT.netY + 95;
    if (isHighLob) {
        ctx.fillStyle = blink ? '#f5b82e' : '#d33636';
        ctx.fillRect(tx - 7, ty - 1, 15, 3);
        ctx.fillRect(tx - 1, ty - 7, 3, 15);
        ctx.strokeStyle = '#f5b82e';
        ctx.strokeRect(tx - 5, ty - 5, 11, 11);
        return;
    }

    // Standard [+] blinking target reticle
    ctx.fillStyle = blink ? '#f5b82e' : '#ffffff';
    // Brackets [ + ]
    ctx.fillRect(tx - 6, ty - 4, 2, 9);
    ctx.fillRect(tx - 6, ty - 4, 4, 2);
    ctx.fillRect(tx - 6, ty + 3, 4, 2);

    ctx.fillRect(tx + 5, ty - 4, 2, 9);
    ctx.fillRect(tx + 3, ty - 4, 4, 2);
    ctx.fillRect(tx + 3, ty + 3, 4, 2);

    // Center cross +
    ctx.fillRect(tx - 2, ty, 5, 1);
    ctx.fillRect(tx, ty - 2, 1, 5);
}

export function drawPlayerSprite(ctx, p, frameTick) {
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const isMoving = Math.abs(p.vx) + Math.abs(p.vy) > 0.15;
    const stepOffset = isMoving ? (((frameTick >> 2) % 2 === 0) ? -2 : 2) : 0;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.fillRect(px - 7, py + 6, 14, 4);

    // Human controlled ring indicator
    if (p.isHuman) {
        ctx.strokeStyle = (frameTick % 20 < 10) ? '#f5b82e' : '#6bc947';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px - 9, py + 4, 18, 6);
    }

    // Dash trail aura
    if (p.dashTimer > 0) {
        ctx.fillStyle = 'rgba(245, 184, 46, 0.45)';
        ctx.fillRect(px - 8 - p.vx * 2, py - 8 - p.vy * 2, 16, 16);
    }

    // Feet / Shoes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - 5, py + 3 + stepOffset, 4, 3);
    ctx.fillRect(px + 1, py + 3 - stepOffset, 4, 3);

    // Shorts
    ctx.fillStyle = '#182030';
    ctx.fillRect(px - 5, py - 1, 10, 4);

    // Jersey / Torso
    ctx.fillStyle = p.shirtColor;
    ctx.fillRect(px - 6, py - 8, 12, 7);

    // Head
    ctx.fillStyle = p.skinColor;
    ctx.fillRect(px - 5, py - 15, 10, 7);

    // Hair / Headband
    ctx.fillStyle = p.hairColor;
    ctx.fillRect(px - 5, py - 17, 10, 3);
    ctx.fillStyle = p.isHuman ? '#f5b82e' : '#ffffff';
    ctx.fillRect(px - 5, py - 14, 10, 2); // Sweatband

    // Eyes (facing net)
    ctx.fillStyle = '#10141d';
    if (p.team === 'cpu') {
        ctx.fillRect(px - 3, py - 11, 2, 2);
        ctx.fillRect(px + 1, py - 11, 2, 2);
    }

    // Padel Racquet (perforated pixel head)
    const swingShift = p.swingTimer > 0 ? -5 : 0;
    const rx = p.team === 'player' ? px + 7 : px - 12;
    const ry = py - 9 + swingShift;

    ctx.fillStyle = '#10141d';
    ctx.fillRect(rx, ry, 6, 7);
    ctx.fillStyle = p.swingTimer > 0 ? '#f5b82e' : '#7fd141';
    ctx.fillRect(rx + 1, ry + 1, 4, 5);
    // Padel holes
    ctx.fillStyle = '#10141d';
    ctx.fillRect(rx + 2, ry + 2, 1, 1);
    ctx.fillRect(rx + 3, ry + 4, 1, 1);

    // Power Charge Bar above human player
    if (p.isHuman && p.charge > 0.05) {
        const barW = 18;
        const fillW = Math.min(barW, Math.round(p.charge * barW));
        ctx.fillStyle = '#10141d';
        ctx.fillRect(px - 9, py - 23, barW + 2, 5);
        ctx.fillStyle = p.charge > 0.8 ? '#d33636' : '#f5b82e';
        ctx.fillRect(px - 8, py - 22, fillW, 3);
    }
}

export function drawBall25D(ctx, ball) {
    // Draw Smash flame trail
    if (ball.isSmash) {
        for (let i = 0; i < ball.trail.length; i++) {
            const t = ball.trail[i];
            ctx.fillStyle = i % 2 === 0 ? 'rgba(211, 54, 54, 0.55)' : 'rgba(245, 184, 46, 0.55)';
            ctx.fillRect(Math.round(t.x) - 2, Math.round(t.y - t.z * 0.75) - 2, 4, 4);
        }
    }

    const bx = Math.round(ball.x);
    const by = Math.round(ball.y);
    const visualY = Math.round(ball.y - ball.z * 0.78);
    const size = Math.min(8, Math.max(4, Math.round(4 + ball.z * 0.09)));

    // Shadow on floor at (x, y)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(bx - 2, by - 1, 5, 3);

    // Ball body elevated by z
    ctx.fillStyle = '#10141d';
    ctx.fillRect(bx - (size >> 1) - 1, visualY - (size >> 1) - 1, size + 2, size + 2);
    ctx.fillStyle = ball.isSmash ? '#ff5252' : '#d4ff33';
    ctx.fillRect(bx - (size >> 1), visualY - (size >> 1), size, size);
}
