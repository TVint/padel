// js/app.js - REBRUNCH // Republic Sport Village - Static GitHub Pages Controller (Event/Game Mode, LocalStorage, Sunny BGM & Secret Admin)

import { sound } from './game/audio.js';
import { GBCInputController } from './game/touch.js';
import { PadelGameEngine } from './game/engine.js';

const STORAGE_KEYS = {
  LEADERBOARD: 'rebrunch_leaderboard_v2',
  CLICK_STATS: 'rebrunch_click_stats_v2',
  SKIN:        'rebrunch_gbc_skin',
};

const DEFAULT_LEADERBOARD = [
  { id: 1, name: 'REP', score: 1250, mode: 'classic', date: '2026-11-29 10:30' },
  { id: 2, name: 'MIR', score: 980,  mode: 'classic', date: '2026-11-29 11:00' },
  { id: 3, name: 'MAR', score: 840,  mode: 'classic', date: '2026-11-29 11:15' },
];

const DEFAULT_CLICKS = {
  green_brunch:  0,
  red_aperitivo: 0,
  yellow_torneo: 0,
  play_game:     0,
  wa_daniele:    0,
  wa_mirko:      0,
  wa_mario:      0,
};

const input = new GBCInputController();
let gameEngine = null;
let appMode = 'event'; // 'event' | 'game'
let currentView = 'view-intro';
let lastMatchScore = 0;
let volumeOsdTimeout = null;

// =========================================================
// 1. LOCALSTORAGE DATA LAYER (ZERO PHP FOR GITHUB PAGES)
// =========================================================
function getStoredLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEADERBOARD);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(DEFAULT_LEADERBOARD));
      return [...DEFAULT_LEADERBOARD];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_LEADERBOARD];
  } catch (_) {
    return [...DEFAULT_LEADERBOARD];
  }
}

function saveScoreToLocalStorage(name, score, mode = 'classic') {
  const cleanName = String(name || 'AAA')
    .toUpperCase()
    .replace(/[^A-Z0-9 _\-\.]/g, '')
    .slice(0, 10) || 'AAA';
  const cleanScore = Math.max(0, Math.round(Number(score) || 0));
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const list = getStoredLeaderboard();
  const entry = {
    id: Date.now(),
    name: cleanName,
    score: cleanScore,
    mode,
    date: nowStr,
  };
  list.push(entry);
  list.sort((a, b) => b.score - a.score || b.id - a.id);
  const trimmed = list.slice(0, 30);

  try {
    localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(trimmed));
  } catch (_) {}

  renderPauseLeaderboard();
  renderAdminDashboard();
  return trimmed;
}

function deleteScoreFromLocalStorage(id) {
  const list = getStoredLeaderboard().filter((item) => String(item.id) !== String(id));
  try {
    localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(list));
  } catch (_) {}
  renderPauseLeaderboard();
  renderAdminDashboard();
}

function getStoredClickStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLICK_STATS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CLICK_STATS, JSON.stringify(DEFAULT_CLICKS));
      return { ...DEFAULT_CLICKS };
    }
    return { ...DEFAULT_CLICKS, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULT_CLICKS };
  }
}

function trackAreaClick(areaClicked) {
  const stats = getStoredClickStats();
  stats[areaClicked] = (Number(stats[areaClicked]) || 0) + 1;
  try {
    localStorage.setItem(STORAGE_KEYS.CLICK_STATS, JSON.stringify(stats));
  } catch (_) {}
  renderAdminDashboard();
}

function resetAllLocalStats() {
  try {
    localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(DEFAULT_LEADERBOARD));
    localStorage.setItem(STORAGE_KEYS.CLICK_STATS, JSON.stringify(DEFAULT_CLICKS));
  } catch (_) {}
  renderPauseLeaderboard();
  renderAdminDashboard();
}

// =========================================================
// 2. EVENT MODE <-> GAME MODE TRANSITION & 8-BIT BUTTON MORPH
// =========================================================
function setAppMode(targetMode) {
  const nextMode = targetMode === 'game' ? 'game' : 'event';
  const changed = appMode !== nextMode;
  appMode = nextMode;

  document.body.setAttribute('data-app-mode', appMode);
  const shell = document.getElementById('gbc-shell');
  if (shell) shell.setAttribute('data-app-mode', appMode);

  // Trigger 8-bit CSS flip animation on the 3 physical colored buttons
  const plate = document.getElementById('action-buttons-plate');
  if (plate && changed) {
    plate.classList.remove('mode-switching');
    void plate.offsetWidth; // reflow
    plate.classList.add('mode-switching');
    sound.modeSwitchJingle();
  }

  // Update physical button captions:
  // Event Mode: Brunch / Aperitivo / Torneo + Horizontal button "🕹️ GIOCA"
  // Game Mode:  Tasto A / Tasto B / Dash   + Horizontal button "✖ ESCI"
  const lblGreen = document.getElementById('lbl-btn-green');
  const lblRed = document.getElementById('lbl-btn-red');
  const lblYellow = document.getElementById('lbl-btn-yellow');
  const giocaLabel = document.getElementById('gioca-btn-label');

  if (appMode === 'game') {
    if (lblGreen) lblGreen.textContent = 'Tasto A';
    if (lblRed) lblRed.textContent = 'Tasto B';
    if (lblYellow) lblYellow.textContent = 'Dash';
    if (giocaLabel) giocaLabel.textContent = '✖ ESCI';
  } else {
    if (lblGreen) lblGreen.textContent = 'Brunch';
    if (lblRed) lblRed.textContent = 'Aperitivo';
    if (lblYellow) lblYellow.textContent = 'Torneo';
    if (giocaLabel) giocaLabel.textContent = '🕹️ GIOCA';
  }
}

function enterGameMode() {
  trackAreaClick('play_game');
  setAppMode('game');
  sound.startBGM();
  showView('view-game');
}

function exitGameModeToEvent() {
  if (gameEngine) {
    gameEngine.togglePause(true);
  }
  const pauseModal = document.getElementById('game-pause-modal');
  if (pauseModal) pauseModal.style.display = 'none';
  setAppMode('event');
  showView('view-intro');
}

// =========================================================
// 3. GAME BOY 3-SKIN SWITCHER (CLASSICA / UOMO / DONNA)
// =========================================================
function applySkin(skinName) {
  const validSkins = ['classic', 'uomo', 'donna'];
  const chosen = validSkins.includes(skinName) ? skinName : 'classic';

  document.body.setAttribute('data-skin', chosen);
  const shell = document.getElementById('gbc-shell');
  if (shell) shell.setAttribute('data-skin', chosen);

  document.querySelectorAll('[data-set-skin]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-set-skin') === chosen);
  });

  try {
    localStorage.setItem(STORAGE_KEYS.SKIN, chosen);
  } catch (_) {}
}

function initSkinSwitcher() {
  let saved = 'classic';
  try {
    saved = localStorage.getItem(STORAGE_KEYS.SKIN) || 'classic';
  } catch (_) {}
  applySkin(saved);

  document.querySelectorAll('[data-set-skin]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetSkin = btn.getAttribute('data-set-skin');
      sound.btnClick();
      applySkin(targetSkin);
    });
  });
}

// =========================================================
// 4. LCD VIEW NAVIGATION
// =========================================================
function showView(viewId) {
  currentView = viewId;
  document.querySelectorAll('.lcd-view').forEach((el) => {
    el.classList.toggle('active', el.id === viewId);
  });

  const lcd = document.getElementById('lcd-screen');
  if (lcd) lcd.scrollTop = 0;

  if (viewId === 'view-aperitivo') {
    sound.startBGM();
  } else if (viewId === 'view-game') {
    ensureGameStarted();
    gameEngine?.togglePause(false);
    renderPauseLeaderboard();
  } else if (viewId === 'view-admin') {
    renderAdminDashboard();
  }
}

function openBrunchView() {
  sound.btnClick();
  trackAreaClick('green_brunch');
  setAppMode('event');
  showView('view-brunch');
}

function openAperitivoView() {
  sound.btnClick();
  trackAreaClick('red_aperitivo');
  setAppMode('event');
  showView('view-aperitivo');
}

function openTorneoView() {
  sound.btnClick();
  trackAreaClick('yellow_torneo');
  setAppMode('event');
  showView('view-torneo');
}

// =========================================================
// 5. CHILL SUNNY AFTERNOON PIXEL-ART SCENE (APERITIVO VIEW)
// =========================================================
function initChillAperitivoScene() {
  const canvas = document.getElementById('dj-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let tick = 0;

  // Slow drifting clouds
  const clouds = [
    { x: 18, y: 18, w: 38, spd: 0.14 },
    { x: 122, y: 12, w: 46, spd: 0.1 },
    { x: 215, y: 24, w: 34, spd: 0.16 },
  ];

  // Flocks of birds
  const birds = [
    { x: 40, y: 34, spd: 0.35, phase: 0 },
    { x: 52, y: 30, spd: 0.35, phase: 2 },
    { x: 62, y: 36, spd: 0.35, phase: 4 },
    { x: 180, y: 26, spd: 0.28, phase: 1 },
    { x: 192, y: 22, spd: 0.28, phase: 3 },
  ];

  function drawChillScene() {
    tick++;
    const W = canvas.width;  // 288
    const H = canvas.height; // 196
    ctx.clearRect(0, 0, W, H);

    // 1. Sunny Afternoon Sky Gradient (Azure -> Warm Horizon)
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, W, 56);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(0, 56, W, 36);
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(0, 92, W, 24);

    // 2. Warm Golden Sun (Top Right)
    const sunPulse = Math.floor(tick / 25) % 2;
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(236 - sunPulse, 12 - sunPulse, 28 + sunPulse * 2, 28 + sunPulse * 2);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(240, 16, 20, 20);

    // 3. Slowly Drifting Fluffy Pixel Clouds
    ctx.fillStyle = '#ffffff';
    clouds.forEach((c) => {
      c.x += c.spd;
      if (c.x > W + 10) c.x = -c.w - 10;
      const cx = Math.round(c.x);
      ctx.fillRect(cx, c.y + 4, c.w, 8);
      ctx.fillRect(cx + 6, c.y, c.w - 12, 6);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(cx + 2, c.y + 10, c.w - 4, 2);
      ctx.fillStyle = '#ffffff';
    });

    // 4. Flocks of V-Shaped Pixel Birds
    ctx.fillStyle = '#1e293b';
    birds.forEach((b) => {
      b.x += b.spd;
      if (b.x > W + 12) b.x = -15;
      const bx = Math.round(b.x);
      const by = Math.round(b.y + Math.sin((tick + b.phase * 8) * 0.08) * 2);
      const wingUp = Math.floor((tick + b.phase * 4) / 10) % 2 === 0;
      if (wingUp) {
        ctx.fillRect(bx - 3, by - 2, 2, 2);
        ctx.fillRect(bx + 2, by - 2, 2, 2);
        ctx.fillRect(bx - 1, by, 3, 1);
      } else {
        ctx.fillRect(bx - 3, by + 1, 2, 1);
        ctx.fillRect(bx + 2, by + 1, 2, 1);
        ctx.fillRect(bx - 1, by - 1, 3, 2);
      }
    });

    // 5. Lush Green Club Lawn & Hedges
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, 114, W, 82);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 142, W, 54);

    // 6. Relaxed DJ in Outdoor Console (Center Midground)
    const bob = Math.floor(tick / 18) % 2 === 0 ? 0 : 1;
    const djX = 124;
    const djY = 66 + bob;

    // Striped Sun Umbrella over DJ Booth
    ctx.fillStyle = '#78350f';
    ctx.fillRect(142, 40, 3, 58);
    ctx.fillStyle = '#f7c11e';
    ctx.fillRect(102, 34, 84, 9);
    ctx.fillStyle = '#ffffff';
    for (let ux = 106; ux < 182; ux += 16) {
      ctx.fillRect(ux, 34, 8, 9);
    }

    // Relaxed DJ Character (Summer Polo + Sunglasses + Headphones)
    ctx.fillStyle = '#78350f'; // hair
    ctx.fillRect(djX + 10, djY - 2, 20, 5);
    ctx.fillStyle = '#fed7aa'; // head
    ctx.fillRect(djX + 10, djY + 3, 20, 15);
    ctx.fillStyle = '#0f172a'; // chill sunglasses
    ctx.fillRect(djX + 12, djY + 7, 7, 4);
    ctx.fillRect(djX + 21, djY + 7, 7, 4);
    ctx.fillRect(djX + 19, djY + 8, 2, 1);
    // Relaxed smile
    ctx.fillRect(djX + 16, djY + 14, 8, 1);

    // Summer Linen / Mint Shirt
    ctx.fillStyle = '#a7f3d0';
    ctx.fillRect(djX + 6, djY + 18, 28, 20);
    ctx.fillStyle = '#f7c11e';
    ctx.fillRect(djX + 16, djY + 18, 8, 18);

    // Wooden Outdoor DJ Console
    ctx.fillStyle = '#92400e';
    ctx.fillRect(88, 96, 112, 36);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2;
    ctx.strokeRect(88, 96, 112, 36);

    // Turntables & Laptop
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(98, 90, 28, 6);
    ctx.fillRect(162, 90, 28, 6);
    ctx.fillStyle = '#f7c11e';
    ctx.fillRect(136, 88, 16, 8);

    // Console Front Banner: "MORNING SET"
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(100, 104, 88, 18);
    ctx.strokeStyle = '#451a03';
    ctx.strokeRect(100, 104, 88, 18);
    ctx.fillStyle = '#b45309';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText('MORNING SET', 111, 116);

    // Floating Chill Musical Notes
    ctx.fillStyle = '#0f172a';
    const noteLift = Math.floor(tick / 14) % 6;
    ctx.fillText('♪', 82, 82 - noteLift);
    ctx.fillText('♫', 198, 78 - ((noteLift + 3) % 6));

    // =========================================================
    // 7. FOREGROUND SILHOUETTES BELOW CONSOLE (y: 138..192)
    // =========================================================

    // A) LEFT FOREGROUND: People Playing Padel on Mini Sunlit Court
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(10, 148, 78, 38);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 148, 78, 38);
    // Mini Net
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(48, 148, 2, 38);

    // Two Padel Players Silhouettes Rallying
    const pBounce = Math.floor(tick / 10) % 2;
    ctx.fillStyle = '#0f172a';
    // Left player
    ctx.fillRect(18, 156 - pBounce, 5, 5);
    ctx.fillRect(17, 161 - pBounce, 7, 10);
    ctx.fillRect(24, 160 - pBounce, 4, 3); // racket
    // Right player
    ctx.fillRect(74, 158 + pBounce, 5, 5);
    ctx.fillRect(73, 163 + pBounce, 7, 10);
    ctx.fillRect(69, 162 + pBounce, 4, 3); // racket

    // Bouncing Padel Ball between them
    const rallyT = (Math.sin(tick * 0.06) + 1) / 2;
    const ballX = Math.round(24 + rallyT * 46);
    const ballY = Math.round(162 - Math.sin(rallyT * Math.PI) * 12);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(ballX, ballY, 3, 3);

    // B) CENTER FOREGROUND: Friends Eating Brunch at Table
    const tblX = 114;
    const tblY = 166;
    // Table
    ctx.fillStyle = '#78350f';
    ctx.fillRect(tblX + 12, tblY + 4, 36, 4);
    ctx.fillRect(tblX + 28, tblY + 8, 4, 14);
    // Seated Left Person eating Brunch
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tblX + 2, tblY - 6, 6, 6);
    ctx.fillRect(tblX + 1, tblY, 8, 14);
    // Seated Right Person eating Brunch
    ctx.fillRect(tblX + 52, tblY - 6, 6, 6);
    ctx.fillRect(tblX + 51, tblY, 8, 14);
    // Brunch Plates & Pancakes on Table
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(tblX + 16, tblY, 8, 4);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(tblX + 34, tblY - 1, 8, 5);

    // C) RIGHT FOREGROUND: People Chatting & Drinking Spritz in Peace
    const drX = 212;
    const drY = 156;
    const toastLift = Math.floor(tick / 20) % 2 === 0 ? 0 : -2;
    // Person 1 (left)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(drX, drY, 6, 6);
    ctx.fillRect(drX - 1, drY + 6, 8, 18);
    // Person 2 (right)
    ctx.fillRect(drX + 36, drY + 1, 6, 6);
    ctx.fillRect(drX + 35, drY + 7, 8, 17);
    // Arms holding orange Spritz glasses
    ctx.fillRect(drX + 7, drY + 9 + toastLift, 8, 2);
    ctx.fillRect(drX + 27, drY + 9 + toastLift, 8, 2);
    // Glowing Orange Spritz Glasses
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(drX + 14, drY + 5 + toastLift, 4, 5);
    ctx.fillRect(drX + 24, drY + 5 + toastLift, 4, 5);

    requestAnimationFrame(drawChillScene);
  }

  drawChillScene();
}

// =========================================================
// 6. IN-GAME PAUSE MENU & END-OF-MATCH ARCADE SCORE FORM
// =========================================================
function ensureGameStarted() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  if (!gameEngine) {
    gameEngine = new PadelGameEngine(canvas, input, {
      onMatchEnd: handleMatchEnd,
    });
    gameEngine.startNewMatch();
  }
}

function togglePauseMenu(forceOpen = null) {
  if (!gameEngine || currentView !== 'view-game') return;
  const modal = document.getElementById('game-pause-modal');
  if (!modal) return;

  const isPaused = gameEngine.togglePause(forceOpen);
  modal.style.display = isPaused ? 'flex' : 'none';
  if (isPaused) {
    renderPauseLeaderboard();
  }
}

function renderPauseLeaderboard() {
  const container = document.getElementById('pause-leaderboard-list');
  if (!container) return;

  const rows = getStoredLeaderboard().slice(0, 5);
  container.innerHTML = rows
    .map(
      (r, idx) => `
      <div class="pause-lb-row">
        <span>#${idx + 1} <strong>${escapeHtml(r.name)}</strong></span>
        <span style="color:#f7c11e;">${Number(r.score)} PTS</span>
      </div>
    `
    )
    .join('');
}

function renderMatchOverLeaderboard(highlightName = null, highlightScore = null) {
  const container = document.getElementById('match-leaderboard-list');
  if (!container) return;

  const rows = getStoredLeaderboard().slice(0, 5);
  let highlightedOnce = false;
  container.innerHTML = rows
    .map((r, idx) => {
      const isMatch = !highlightedOnce && highlightName && r.name === highlightName && Number(r.score) === Number(highlightScore);
      if (isMatch) highlightedOnce = true;
      return `
        <div class="pause-lb-row ${isMatch ? 'highlighted' : ''}">
          <span>#${idx + 1} <strong>${escapeHtml(r.name)}</strong> ${isMatch ? '★ TU' : ''}</span>
          <span style="color:#f7c11e;">${Number(r.score)} PTS</span>
        </div>
      `;
    })
    .join('');
}

function handleMatchEnd(summary) {
  lastMatchScore = summary.score || 0;
  const modal = document.getElementById('match-over-modal');
  const title = document.getElementById('match-over-title');
  const scoreLine = document.getElementById('match-over-score');
  const inputEl = document.getElementById('arcade-name-input');
  const entryPhase = document.getElementById('match-score-entry-phase');
  const lbPhase = document.getElementById('match-score-leaderboard-phase');
  const saveBtn = document.getElementById('btn-save-score');

  if (title) {
    title.textContent = summary.won ? '🏆 VITTORIA EPICA!' : '🏆 PARTITA CONCLUSA!';
  }
  if (scoreLine) {
    scoreLine.textContent = `PUNTEGGIO TOTALE: ${lastMatchScore} PTS`;
  }
  if (entryPhase) entryPhase.style.display = 'block';
  if (lbPhase) lbPhase.style.display = 'none';

  if (inputEl) {
    inputEl.value = '';
    setTimeout(() => inputEl.focus(), 80);
  }
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = '✔ CONFERMA E REGISTRA';
  }
  if (modal) {
    modal.style.display = 'flex';
  }
}

function bindArcadeScoreForm() {
  const form = document.getElementById('arcade-score-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('arcade-name-input');
    const feedback = document.getElementById('arcade-save-feedback');
    const entryPhase = document.getElementById('match-score-entry-phase');
    const lbPhase = document.getElementById('match-score-leaderboard-phase');

    const rawName = (inputEl ? inputEl.value : '').trim().toUpperCase() || 'GIOCATORE';
    saveScoreToLocalStorage(rawName, lastMatchScore, gameEngine?.gameMode || 'classic');

    sound.pointJingle(true);

    if (entryPhase) entryPhase.style.display = 'none';
    if (lbPhase) lbPhase.style.display = 'block';
    if (feedback) {
      feedback.textContent = `✔ RISULTATO REGISTRATO: ${rawName} (${lastMatchScore} PTS)`;
    }
    renderMatchOverLeaderboard(rawName, lastMatchScore);
  });
}

// =========================================================
// 7. SECRET ADMIN SHORTCUT & PASSWORD ("GiulioBasciano")
// =========================================================
function openSecretAdminPrompt() {
  sound.btnClick();
  const modal = document.getElementById('admin-login-modal');
  const errEl = document.getElementById('admin-login-error');
  const inputEl = document.getElementById('admin-password-input');
  if (errEl) errEl.textContent = '';
  if (inputEl) inputEl.value = '';
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => inputEl?.focus(), 60);
  }
}

function bindSecretAdminAccess() {
  // 1. Dedicated Hidden Button on Game Boy Shell: bottom-right corner screw
  const btnSecretAdmin = document.getElementById('btn-secret-admin');
  btnSecretAdmin?.addEventListener('click', (e) => {
    e.preventDefault();
    openSecretAdminPrompt();
  });

  // Fallback triggers: Republic logo or Center LEDs
  const triggers = [
    document.getElementById('republic-secret-trigger'),
    document.getElementById('leds-secret-trigger'),
  ];

  triggers.forEach((el) => {
    if (!el) return;
    let pressTimer = null;
    let clickCount = 0;
    let clickTimer = null;

    el.addEventListener('pointerdown', () => {
      pressTimer = setTimeout(() => {
        openSecretAdminPrompt();
      }, 750);
    });

    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };
    el.addEventListener('pointerup', cancelPress);
    el.addEventListener('pointerleave', cancelPress);

    el.addEventListener('click', () => {
      clickCount++;
      if (clickTimer) clearTimeout(clickTimer);
      if (clickCount >= 3) {
        clickCount = 0;
        openSecretAdminPrompt();
      } else {
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 600);
      }
    });
  });

  // 2. Keyboard shortcut Ctrl+Shift+A (Desktop power-users)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyA') {
      e.preventDefault();
      openSecretAdminPrompt();
    }
  });

  // Password Form Submission ("GiulioBasciano")
  const form = document.getElementById('admin-login-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('admin-password-input');
    const errEl = document.getElementById('admin-login-error');
    const val = (inputEl ? inputEl.value : '').trim();

    if (val === 'GiulioBasciano') {
      sound.pointJingle(true);
      const modal = document.getElementById('admin-login-modal');
      if (modal) modal.style.display = 'none';
      setAppMode('event');
      showView('view-admin');
    } else {
      sound.pointJingle(false);
      if (errEl) errEl.textContent = 'PASSWORD ERRATA!';
    }
  });

  document.getElementById('btn-close-admin-login')?.addEventListener('click', () => {
    sound.btnClick();
    const modal = document.getElementById('admin-login-modal');
    if (modal) modal.style.display = 'none';
  });

  document.getElementById('btn-admin-reset-stats')?.addEventListener('click', () => {
    sound.btnClick();
    resetAllLocalStats();
  });
}

function renderAdminDashboard() {
  const heatGrid = document.getElementById('admin-heatmap-grid');
  const scoresList = document.getElementById('admin-scores-list');
  if (!heatGrid || !scoresList) return;

  const stats = getStoredClickStats();
  const labels = [
    { key: 'green_brunch',  label: '🟢 BRUNCH',     color: '#9ad932' },
    { key: 'red_aperitivo', label: '🔴 APERITIVO',  color: '#f87171' },
    { key: 'yellow_torneo', label: '🟡 TORNEO',     color: '#f7c11e' },
    { key: 'play_game',     label: '🕹️ GIOCA',      color: '#38bdf8' },
    { key: 'wa_daniele',    label: '💬 WA DANIELE', color: '#4ade80' },
    { key: 'wa_mirko',      label: '💬 WA MIRKO',   color: '#fde047' },
    { key: 'wa_mario',      label: '💬 WA MARIO',   color: '#fb923c' },
  ];

  heatGrid.innerHTML = labels
    .map(
      (item) => `
      <div class="admin-heat-card">
        <span style="color:${item.color};">${item.label}</span>
        <strong>${Number(stats[item.key] || 0)}</strong>
      </div>
    `
    )
    .join('');

  const leaderboard = getStoredLeaderboard();
  if (leaderboard.length === 0) {
    scoresList.innerHTML = '<div class="hof-empty">Nessun punteggio in localStorage.</div>';
  } else {
    scoresList.innerHTML = leaderboard
      .map(
        (row, idx) => `
        <div class="admin-score-row">
          <span>#${idx + 1} <strong>${escapeHtml(row.name)}</strong> (${Number(row.score)} PT)</span>
          <button type="button" class="admin-del-btn" data-del-score="${escapeHtml(row.id)}">✖</button>
        </div>
      `
      )
      .join('');

    scoresList.querySelectorAll('[data-del-score]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.btnClick();
        deleteScoreFromLocalStorage(btn.getAttribute('data-del-score'));
      });
    });
  }
}

// =========================================================
// 8. HARDWARE VOLUME KEYS + UI BINDINGS
// =========================================================
function showVolumeOsd(vol, isEasterEgg = false) {
  const osd = document.getElementById('volume-osd');
  const titleEl = document.getElementById('vol-osd-title');
  const barsEl = document.getElementById('vol-osd-bars');
  if (!osd || !barsEl || !titleEl) return;

  const filled = Math.round(vol * 10);
  const bars = '█'.repeat(filled) + '░'.repeat(10 - filled);
  titleEl.textContent = isEasterEgg ? '🔥 SUNNY BASS MAX! 🔥' : `VOL CHIPTUNE ${Math.round(vol * 100)}%`;
  barsEl.textContent = bars;

  osd.classList.add('show');
  if (volumeOsdTimeout) clearTimeout(volumeOsdTimeout);
  volumeOsdTimeout = setTimeout(() => {
    osd.classList.remove('show');
  }, 1800);
}

function bindHardwareVolumeKeys() {
  window.addEventListener('keydown', (e) => {
    const isVolUp =
      e.key === 'VolumeUp' ||
      e.key === 'AudioVolumeUp' ||
      e.code === 'VolumeUp' ||
      e.code === 'AudioVolumeUp' ||
      e.key === '+' ||
      e.key === '=';

    const isVolDown =
      e.key === 'VolumeDown' ||
      e.key === 'AudioVolumeDown' ||
      e.code === 'VolumeDown' ||
      e.code === 'AudioVolumeDown' ||
      e.key === '-';

    if (isVolUp) {
      const v = sound.adjustVolume(0.1);
      showVolumeOsd(v, v >= 1.0);
    } else if (isVolDown) {
      const v = sound.adjustVolume(-0.1);
      showVolumeOsd(v, false);
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (appMode === 'game' && currentView === 'view-game') {
        togglePauseMenu();
      }
    }
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bindUiControls() {
  // Back buttons inside LCD views
  document.querySelectorAll('[data-open-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-open-view');
      sound.btnClick();
      if (targetView === 'view-intro') {
        setAppMode('event');
      }
      if (targetView) showView(targetView);
    });
  });

  // Side Labels next to the 3 physical colored buttons
  document.querySelectorAll('[data-btn-proxy]').forEach((lbl) => {
    lbl.addEventListener('click', () => {
      const code = lbl.getAttribute('data-btn-proxy');
      handleShellButton(code);
    });
  });

  // Hero illustration click starts Game Mode
  document.querySelector('.poster-hero-art')?.addEventListener('click', () => {
    enterGameMode();
  });

  // Track WhatsApp clicks in LocalStorage
  document.getElementById('btn-wa-daniele')?.addEventListener('click', () => {
    trackAreaClick('wa_daniele');
  });
  document.getElementById('wa-link-mirko')?.addEventListener('click', () => {
    trackAreaClick('wa_mirko');
  });
  document.getElementById('wa-link-mario')?.addEventListener('click', () => {
    trackAreaClick('wa_mario');
  });

  // WhatsApp 8-Bit Button Submenu Toggle in Torneo View
  const waBtn = document.getElementById('btn-wa-toggle');
  const waSubmenu = document.getElementById('wa-submenu');
  waBtn?.addEventListener('click', () => {
    sound.btnClick();
    waSubmenu?.classList.toggle('open');
  });

  // Physical Shell Buttons Routing
  input.onButtonPress = (btn) => {
    handleShellButton(btn);
  };

  // In-Game Pause Button & Pause Menu Controls
  document.getElementById('btn-game-pause')?.addEventListener('click', () => {
    sound.btnClick();
    togglePauseMenu();
  });

  document.getElementById('btn-resume-game')?.addEventListener('click', () => {
    sound.btnClick();
    togglePauseMenu(false);
  });

  document.getElementById('btn-restart-match')?.addEventListener('click', () => {
    sound.btnClick();
    togglePauseMenu(false);
    gameEngine?.startNewMatch();
  });

  // Character Skin Selector inside Pause Menu
  document.querySelectorAll('[data-char-skin]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const skinKey = btn.getAttribute('data-char-skin');
      sound.btnClick();
      document.querySelectorAll('[data-char-skin]').forEach((b) => b.classList.toggle('active', b === btn));
      gameEngine?.setCharacterSkin(skinKey);
    });
  });

  // Game Mode Selector inside Pause Menu
  document.querySelectorAll('[data-game-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modeKey = btn.getAttribute('data-game-mode');
      sound.btnClick();
      document.querySelectorAll('[data-game-mode]').forEach((b) => b.classList.toggle('active', b === btn));
      gameEngine?.setGameMode(modeKey);
      togglePauseMenu(false);
    });
  });

  // MUSIC: ON / OFF ("Sunny" Boney M. Chiptune Loop)
  const btnMusic = document.getElementById('btn-music-toggle');
  btnMusic?.addEventListener('click', () => {
    const on = sound.toggleMusic();
    btnMusic.textContent = on ? 'MUSIC:ON' : 'MUSIC:OFF';
    btnMusic.classList.toggle('active', on);
  });

  // SFX: ON / OFF
  const btnAudio = document.getElementById('btn-audio-toggle');
  btnAudio?.addEventListener('click', () => {
    const on = sound.toggleMute();
    btnAudio.textContent = on ? 'SFX:ON' : 'SFX:OFF';
    btnAudio.classList.toggle('active', on);
    if (on) sound.btnClick();
  });

  // CRT Scanlines toggle
  const btnCrt = document.getElementById('btn-crt-toggle');
  const lcdScreen = document.getElementById('lcd-screen');
  btnCrt?.addEventListener('click', () => {
    sound.btnClick();
    lcdScreen?.classList.toggle('scanlines');
  });

  // Match Over Modal actions
  document.getElementById('btn-play-again')?.addEventListener('click', () => {
    sound.btnClick();
    const modal = document.getElementById('match-over-modal');
    if (modal) modal.style.display = 'none';
    gameEngine?.startNewMatch();
  });

  document.getElementById('btn-exit-to-event')?.addEventListener('click', () => {
    sound.btnClick();
    const modal = document.getElementById('match-over-modal');
    if (modal) modal.style.display = 'none';
    exitGameModeToEvent();
  });

  document.getElementById('btn-skip-score')?.addEventListener('click', () => {
    sound.btnClick();
    const modal = document.getElementById('match-over-modal');
    if (modal) modal.style.display = 'none';
    gameEngine?.startNewMatch();
  });

  document.getElementById('btn-open-pause-rank')?.addEventListener('click', () => {
    sound.btnClick();
    const modal = document.getElementById('match-over-modal');
    if (modal) modal.style.display = 'none';
    togglePauseMenu(true);
  });
}

function handleShellButton(btn) {
  if (btn === 'GIOCA') {
    if (appMode === 'event') {
      enterGameMode();
    } else {
      exitGameModeToEvent();
    }
    return;
  }

  // In Event Mode, the 3 colored buttons open Brunch / Aperitivo / Torneo
  if (appMode === 'event') {
    if (btn === 'GREEN') openBrunchView();
    else if (btn === 'RED') openAperitivoView();
    else if (btn === 'YELLOW') openTorneoView();
  }
}

// =========================================================
// BOOTSTRAP
// =========================================================
function initApp() {
  initSkinSwitcher();
  initChillAperitivoScene();
  bindHardwareVolumeKeys();
  bindArcadeScoreForm();
  bindSecretAdminAccess();
  bindUiControls();
  renderPauseLeaderboard();
  renderAdminDashboard();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
