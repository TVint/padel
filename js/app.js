// js/app.js - REBRUNCH // Republic Sport Village - GBC Advergame Frontend Controller

import { sound } from './game/audio.js';
import { GBCInputController } from './game/touch.js';
import { PadelGameEngine } from './game/engine.js';

const input = new GBCInputController();
let gameEngine = null;
let currentView = 'view-intro';
let lastMatchScore = 0;
let volumeOsdTimeout = null;

// =========================================================
// 1. CLICK ANALYTICS TRACKING (api/click.php)
// =========================================================
async function trackAreaClick(areaClicked) {
  try {
    await fetch('api/click.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area_clicked: areaClicked }),
    });
  } catch (_) {
    // Non-blocking analytics
  }
}

// =========================================================
// 2. LCD VIEW NAVIGATION
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
    loadHallOfFame();
  }
}

function openBrunchView() {
  sound.btnClick();
  trackAreaClick('green_brunch');
  showView('view-brunch');
}

function openAperitivoView() {
  sound.btnClick();
  trackAreaClick('red_aperitivo');
  showView('view-aperitivo');
}

function openTorneoView() {
  sound.btnClick();
  trackAreaClick('yellow_torneo');
  showView('view-torneo');
}

function startPadelAdvergame() {
  sound.btnClick();
  sound.startBGM();
  trackAreaClick('play_game');
  showView('view-game');
}

// =========================================================
// 3. PIXEL-ART INTRO SCENE & ANIMATED DJ SCENE
// =========================================================
function initIntroCanvas() {
  const canvas = document.getElementById('intro-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let frame = 0;

  function drawIntro() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sky & Sun
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, 296, 78);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(246, 10, 26, 26);

    // Lawn
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, 78, 296, 50);

    // Mini Padel Court (Left)
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(14, 52, 128, 62);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 52, 128, 62);

    // Net
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(77, 52, 2, 62);

    // Animated Padel Ball
    const t = (Math.sin(frame * 0.07) + 1) / 2;
    const bx = 28 + t * 96;
    const by = 82 - Math.sin(t * Math.PI) * 20;
    ctx.fillStyle = '#fde047';
    ctx.fillRect(Math.round(bx), Math.round(by), 5, 5);

    // Players
    const bounce = frame % 24 < 12 ? 0 : 2;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(24, 76 - bounce, 8, 14);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(122, 78 + bounce, 8, 14);

    // DJ Console & Brunch Table (Right)
    ctx.fillStyle = '#78350f';
    ctx.fillRect(166, 74, 114, 34);
    ctx.strokeStyle = '#090d16';
    ctx.strokeRect(166, 74, 114, 34);

    // DJ Character
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(212, 48 + bounce, 18, 26);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(215, 38 + bounce, 12, 11);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(213, 39 + bounce, 3, 7);
    ctx.fillRect(226, 39 + bounce, 3, 7);

    // Turntables & Burger/Spritz icons
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(204, 68, 34, 6);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(176, 64, 12, 10);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(254, 62, 10, 12);

    // Floating musical notes
    ctx.fillStyle = '#090d16';
    ctx.font = '8px "Press Start 2P", monospace';
    const noteOffset = Math.floor(frame / 15) % 2 === 0 ? 0 : 4;
    ctx.fillText('♪', 194, 42 - noteOffset);
    ctx.fillText('♫', 242, 38 + noteOffset);

    requestAnimationFrame(drawIntro);
  }

  drawIntro();
}

function initDjSceneCanvas() {
  const canvas = document.getElementById('dj-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let tick = 0;

  function drawDj() {
    tick++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Club Background
    ctx.fillStyle = '#090a10';
    ctx.fillRect(0, 0, 280, 136);

    // Laser beams
    ctx.strokeStyle = tick % 20 < 10 ? 'rgba(244, 63, 94, 0.45)' : 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, 6);
    ctx.lineTo(20 + (tick * 3) % 240, 134);
    ctx.moveTo(140, 6);
    ctx.lineTo(260 - (tick * 3) % 240, 134);
    ctx.stroke();

    // 8-Bit Spectrum Equalizer Bars in Background
    const barColors = ['#22c55e', '#eab308', '#ef4444', '#38bdf8', '#a855f7'];
    for (let i = 0; i < 16; i++) {
      const wave = Math.abs(Math.sin(tick * 0.11 + i * 0.7));
      const h = Math.round(10 + wave * 42);
      const bx = 14 + i * 16;
      const by = 74 - h;
      ctx.fillStyle = barColors[i % barColors.length];
      ctx.fillRect(bx, by, 11, h);
    }

    // Animated Pixel-Art DJ Behind Decks
    const bob = tick % 16 < 8 ? 0 : 2;
    const djX = 116;
    const djY = 34 + bob;

    // Headphones Band
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(djX + 6, djY - 4, 36, 5);
    ctx.fillRect(djX + 2, djY + 1, 7, 14);
    ctx.fillRect(djX + 39, djY + 1, 7, 14);

    // DJ Head & Sunglasses
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(djX + 9, djY + 1, 30, 22);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(djX + 11, djY + 7, 11, 6);
    ctx.fillRect(djX + 26, djY + 7, 11, 6);
    ctx.fillRect(djX + 22, djY + 9, 4, 2);
    // Neon visor glint
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(djX + 13, djY + 8, 4, 2);
    ctx.fillRect(djX + 28, djY + 8, 4, 2);

    // Torso / Acid Jacket
    ctx.fillStyle = '#facc15';
    ctx.fillRect(djX + 4, djY + 23, 40, 28);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(djX + 16, djY + 23, 16, 28);

    // Animated Hand Scratching Vinyl
    const handShift = tick % 12 < 6 ? -3 : 3;
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(djX - 6 + handShift, djY + 38, 10, 7);
    ctx.fillRect(djX + 44 - handShift, djY + 38, 10, 7);

    // DJ Booth & Twin Technics Turntables
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(28, 84, 224, 46);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 84, 224, 46);

    // Left & Right Vinyl Platters
    [76, 204].forEach((cx, idx) => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(cx - 24, 76, 48, 9);
      ctx.fillStyle = (tick + idx * 5) % 10 < 5 ? '#ef4444' : '#facc15';
      ctx.fillRect(cx - 8, 78, 16, 4);
    });

    // Mixer Sliders
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(128, 78, 24, 7);

    // Booth Front Neon Sign
    ctx.fillStyle = '#090d16';
    ctx.fillRect(52, 95, 176, 24);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.strokeRect(52, 95, 176, 24);

    ctx.fillStyle = tick % 24 < 12 ? '#4ade80' : '#facc15';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('REPUBLIC ACID DJ', 74, 111);

    // Floating 8-Bit Musical Notes
    ctx.fillStyle = '#fde047';
    ctx.fillText('♪', 48, 36 - (tick % 14));
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('♫', 218, 40 - ((tick + 7) % 14));

    requestAnimationFrame(drawDj);
  }

  drawDj();
}

// =========================================================
// 4. HARDWARE VOLUME KEYS (VolumeUp / VolumeDown) + OSD
// =========================================================
function showVolumeOsd(vol, isEasterEgg = false) {
  const osd = document.getElementById('volume-osd');
  const titleEl = document.getElementById('vol-osd-title');
  const barsEl = document.getElementById('vol-osd-bars');
  if (!osd || !barsEl || !titleEl) return;

  const filled = Math.round(vol * 10);
  const bars = '█'.repeat(filled) + '░'.repeat(10 - filled);
  titleEl.textContent = isEasterEgg ? '🔥 TURBO BASS MAX! 🔥' : `VOL CHIPTUNE ${Math.round(vol * 100)}%`;
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
    }
  });
}

// =========================================================
// 5. SUPER PADEL DX 2V2 & ARCADE SCORE SUBMISSION
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

function handleMatchEnd(summary) {
  lastMatchScore = summary.score || 0;
  const modal = document.getElementById('match-over-modal');
  const title = document.getElementById('match-over-title');
  const scoreLine = document.getElementById('match-over-score');
  const feedback = document.getElementById('arcade-save-feedback');
  const saveBtn = document.getElementById('btn-save-score');

  if (title) {
    title.textContent = summary.won ? '🏆 VITTORIA EPICA!' : 'FINE PARTITA!';
  }
  if (scoreLine) {
    scoreLine.textContent = `PUNTEGGIO: ${lastMatchScore} PTS (SET ${summary.gamesPlayer}-${summary.gamesCpu})`;
  }
  if (feedback) {
    feedback.textContent = '';
  }
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'SALVA';
  }
  if (modal) {
    modal.style.display = 'flex';
  }
}

function bindArcadeScoreForm() {
  const form = document.getElementById('arcade-score-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('arcade-name-input');
    const feedback = document.getElementById('arcade-save-feedback');
    const saveBtn = document.getElementById('btn-save-score');

    const rawName = (inputEl ? inputEl.value : 'AAA').trim().toUpperCase() || 'AAA';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '...';
    }

    try {
      const res = await fetch('api/save_match.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rawName,
          score: lastMatchScore,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        sound.pointJingle(true);
        if (feedback) feedback.textContent = `✔ SALVATO: ${rawName} (${lastMatchScore} PTS)`;
        if (saveBtn) saveBtn.textContent = 'OK!';
        await loadHallOfFame();
      } else {
        if (feedback) feedback.textContent = 'ERRORE SALVATAGGIO';
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'SALVA';
        }
      }
    } catch (_) {
      if (feedback) feedback.textContent = 'ERRORE DI RETE';
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'SALVA';
      }
    }
  });
}

// =========================================================
// 6. HALL OF FAME (LEADERBOARD) FETCHER
// =========================================================
async function loadHallOfFame() {
  const matchesContainer = document.getElementById('hof-matches-list');
  if (!matchesContainer) return;

  try {
    const res = await fetch('api/stats.php?action=public');
    const data = await res.json();
    if (!data.ok) return;

    const rows = data.leaderboard || [];
    if (rows.length === 0) {
      matchesContainer.innerHTML = '<div class="hof-empty">Nessun punteggio registrato. Gioca ora!</div>';
    } else {
      matchesContainer.innerHTML = rows
        .slice(0, 10)
        .map((m, idx) => {
          return `
            <div class="hof-item">
              <span>#${idx + 1} <strong>${escapeHtml(m.name)}</strong></span>
              <span style="color:#fde047;">${Number(m.score)} PTS</span>
            </div>
          `;
        })
        .join('');
    }
  } catch (_) {
    // Non-blocking
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =========================================================
// 7. SHELL & UI BUTTON BINDINGS
// =========================================================
function bindUiControls() {
  // Colored Pills & Back Buttons inside LCD
  document.querySelectorAll('[data-open-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-open-view');
      const trackArea = btn.getAttribute('data-track-area');
      sound.btnClick();
      if (trackArea) trackAreaClick(trackArea);
      if (targetView) showView(targetView);
    });
  });

  // Intro CTA ("PREMI IL TASTO GIOCA PER INIZIARE!")
  document.getElementById('intro-play-cta')?.addEventListener('click', () => {
    startPadelAdvergame();
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
    if (btn === 'GIOCA') {
      if (currentView !== 'view-game') {
        startPadelAdvergame();
      } else {
        trackAreaClick('play_game');
      }
      return;
    }

    // When NOT in an active Padel rally (or when outside view-game),
    // the 3 colored buttons open their dedicated LCD screens:
    // GREEN -> Brunch, RED -> Aperitivo, YELLOW -> Torneo
    const inActiveGame = currentView === 'view-game' && gameEngine && !gameEngine.matchOver;
    if (!inActiveGame) {
      if (btn === 'GREEN') openBrunchView();
      else if (btn === 'RED') openAperitivoView();
      else if (btn === 'YELLOW') openTorneoView();
    }
  };

  // Audio SFX toggle
  const btnAudio = document.getElementById('btn-audio-toggle');
  btnAudio?.addEventListener('click', () => {
    const on = sound.toggleMute();
    btnAudio.textContent = on ? '♪ SFX:ON' : '♪ SFX:OFF';
    if (on) sound.btnClick();
  });

  // CRT Scanlines toggle
  const btnCrt = document.getElementById('btn-crt-toggle');
  const lcdScreen = document.getElementById('lcd-screen');
  btnCrt?.addEventListener('click', () => {
    sound.btnClick();
    lcdScreen?.classList.toggle('scanlines');
    const hasCrt = lcdScreen?.classList.contains('scanlines');
    btnCrt.textContent = hasCrt ? 'CRT:ON' : 'CRT:OFF';
  });

  // Match Over Modal actions
  document.getElementById('btn-play-again')?.addEventListener('click', () => {
    sound.btnClick();
    const modal = document.getElementById('match-over-modal');
    if (modal) modal.style.display = 'none';
    gameEngine?.startNewMatch();
  });

  document.getElementById('btn-scroll-rank')?.addEventListener('click', () => {
    sound.btnClick();
    const modal = document.getElementById('match-over-modal');
    if (modal) modal.style.display = 'none';
    document.getElementById('hall-of-fame')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btn-refresh-hof')?.addEventListener('click', () => {
    sound.btnClick();
    loadHallOfFame();
  });
}

// =========================================================
// BOOTSTRAP
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
  initIntroCanvas();
  initDjSceneCanvas();
  bindHardwareVolumeKeys();
  bindArcadeScoreForm();
  bindUiControls();
  loadHallOfFame();
});
