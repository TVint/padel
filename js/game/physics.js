/**
 * REBRUNCH // Super Padel DX 2v2 - 2.5D Padel Physics & Rules (js/game/physics.js)
 * Implements 3D ball trajectory (x, y, z), landing target prediction [+],
 * and official Padel glass/cage rebound rules.
 */

export const COURT = {
    width: 320,
    height: 350,
    left: 28,
    right: 292,
    top: 26,
    bottom: 324,
    netY: 175,
    serviceTop: 82,
    serviceBottom: 268,
    centerX: 160,
    gravity: 0.17
};

export function createBall() {
    return {
        x: COURT.centerX,
        y: COURT.bottom - 35,
        z: 14,
        vx: 0,
        vy: 0,
        vz: 0,
        spin: 0,
        bounces: 0,
        lastHitterTeam: 'player', // 'player' (bottom) or 'cpu' (top)
        isSmash: false,
        targetX: COURT.centerX,
        targetY: COURT.top + 60,
        trail: []
    };
}

/**
 * Predicts where the ball will next touch the court floor (z = 0)
 * so the blinking [+] reticle and AI players can position themselves.
 */
export function computeLandingPrediction(ball) {
    let simX = ball.x;
    let simY = ball.y;
    let simZ = Math.max(0.1, ball.z);
    let vx = ball.vx;
    let vy = ball.vy;
    let vz = ball.vz;

    for (let step = 0; step < 180; step++) {
        simX += vx;
        simY += vy;
        vz -= COURT.gravity;
        simZ += vz;

        // Lateral mesh bounce during flight
        if (simX < COURT.left + 4) {
            simX = COURT.left + 4;
            vx = -vx * 0.72;
        } else if (simX > COURT.right - 4) {
            simX = COURT.right - 4;
            vx = -vx * 0.72;
        }

        if (simZ <= 0) {
            break;
        }
    }

    ball.targetX = Math.max(COURT.left + 8, Math.min(COURT.right - 8, simX));
    ball.targetY = Math.max(COURT.top + 8, Math.min(COURT.bottom - 8, simY));
}

/**
 * Advances ball physics by 1 frame and returns any Padel rule event:
 * - null (rally continues)
 * - { type: 'bounce' }
 * - { type: 'glass_valid', wall: 'top'|'bottom'|'side' }
 * - { type: 'point', winner: 'player'|'cpu', reason: string }
 */
export function stepBallPhysics(ball) {
    // Save trail for Smash / fast shots
    ball.trail.push({ x: ball.x, y: ball.y, z: ball.z });
    if (ball.trail.length > 7) ball.trail.shift();

    const prevY = ball.y;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vz -= COURT.gravity;
    ball.z += ball.vz;

    // 1. Check Net Collision when crossing netY
    if ((prevY - COURT.netY) * (ball.y - COURT.netY) <= 0) {
        if (ball.z < 11) {
            // Hit the net!
            ball.vy = -ball.vy * 0.25;
            ball.vx *= 0.4;
            ball.vz = 1.2;
            const winner = ball.lastHitterTeam === 'player' ? 'cpu' : 'player';
            return { type: 'point', winner, reason: 'RETE!' };
        }
    }

    // 2. Lateral Metallic Fence / Side Glass (x boundaries)
    if (ball.x <= COURT.left + 4 || ball.x >= COURT.right - 4) {
        ball.x = ball.x <= COURT.left + 4 ? COURT.left + 4 : COURT.right - 4;
        ball.vx = -ball.vx * 0.75;

        // Direct side wall hit before bouncing on opponent's floor = OUT
        const onOpponentSide =
            (ball.lastHitterTeam === 'player' && ball.y < COURT.netY) ||
            (ball.lastHitterTeam === 'cpu' && ball.y > COURT.netY);

        if (onOpponentSide && ball.bounces === 0) {
            const winner = ball.lastHitterTeam === 'player' ? 'cpu' : 'player';
            return { type: 'point', winner, reason: 'FALLO GRIGLIA DIRETTA!' };
        }
        computeLandingPrediction(ball);
        return { type: 'glass_valid', wall: 'side' };
    }

    // 3. Back Tempered Glass Walls (top & bottom y boundaries)
    if (ball.y <= COURT.top + 4 || ball.y >= COURT.bottom - 4) {
        const hitTopWall = ball.y <= COURT.top + 4;
        ball.y = hitTopWall ? COURT.top + 4 : COURT.bottom - 4;

        // If ball hasn't bounced on the floor yet -> Direct Glass Fault (OUT!)
        if (ball.bounces === 0) {
            const winner = ball.lastHitterTeam === 'player' ? 'cpu' : 'player';
            return { type: 'point', winner, reason: 'OUT! VETRO DIRETTO' };
        }

        // Smash X3 over the back glass wall!
        if (ball.isSmash && ball.z > 28) {
            const winner = ball.lastHitterTeam;
            return { type: 'point', winner, reason: 'SMASH X3 FUORI GABBIA!' };
        }

        // Valid Padel Rebound off back glass!
        ball.vy = -ball.vy * 0.68;
        ball.vz = Math.max(ball.vz, 1.6);
        computeLandingPrediction(ball);
        return { type: 'glass_valid', wall: hitTopWall ? 'top' : 'bottom' };
    }

    // 4. Floor Bounce (z <= 0)
    if (ball.z <= 0) {
        ball.z = 0;
        ball.bounces += 1;

        // Check if first bounce was on hitter's own side of the court
        if (ball.bounces === 1) {
            const bouncedOwnSide =
                (ball.lastHitterTeam === 'player' && ball.y > COURT.netY) ||
                (ball.lastHitterTeam === 'cpu' && ball.y < COURT.netY);

            if (bouncedOwnSide) {
                const winner = ball.lastHitterTeam === 'player' ? 'cpu' : 'player';
                return { type: 'point', winner, reason: 'RIMBALZO NEL PROPRIO CAMPO!' };
            }
        }

        // Double bounce -> Point scored!
        if (ball.bounces >= 2) {
            const winner = ball.lastHitterTeam;
            return {
                type: 'point',
                winner,
                reason: ball.isSmash ? 'PUNTO SMASH!' : 'DOPPIO RIMBALZO!'
            };
        }

        // First valid floor bounce
        ball.vz = Math.max(2.6, Math.abs(ball.vz) * 0.72);
        ball.vx *= 0.88;
        ball.vy *= 0.88;
        computeLandingPrediction(ball);
        return { type: 'bounce' };
    }

    return null;
}
