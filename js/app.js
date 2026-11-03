/**
 * REBRUNCH // Republic Sport Village - Main Application Controller (js/app.js)
 * Manages Game Boy Color LCD screens, dynamic form logic, pixel-art hero illustration,
 * Pokémon-style Professor Oak dialogues, localStorage persistence, and Hall of Fame API.
 */

import { sound } from './game/audio.js';
import { InputController } from './game/touch.js';
import { PadelGameEngine } from './game/engine.js';

const STORAGE_PLAYER_KEY = 'rebrunch_gbc_player_v1';

// Ironic Pokémon-style messages when pressing shell buttons outside a match
const OAK_QUOTES = [
    'PROF. OAK: "C\'è un tempo e un luogo per ogni cosa, ma non ora!"',
    'DJ SET: "🎵 Bassline 8-bit a 128 BPM in corso al Republic!"',
    'ARBITRO: "Iscriviti al REBRUNCH del 29 Novembre per scendere in campo!"',
    'CHEF BRUNCH: "Avocado Toast, Club Sandwich e Pancake ti aspettano dalle 10:00!"',
    'CONSIGLIO PRO: "A rete premi [ROSSO] sulle palle alte per lo SMASH X3!"'
];

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // 1. DOM ELEMENTS
    // ------------------------------------------------------------------------
    const viewIntro   = document.getElementById('view-intro');
    const viewForm    = document.getElementById('view-form');
    const viewGame    = document.getElementById('view-game');
    const curtainEl   = document.getElementById('lcd-curtain');
    const pokeToast   = document.getElementById('poke-toast');
    const ledRed      = document.getElementById('led-red');
    const ledGreen    = document.getElementById('led-green');
    const btnAudio    = document.getElementById('btn-audio-toggle');

    // Intro buttons
    const btnGoForm      = document.getElementById('btn-go-form');
    const btnAlreadyReg  = document.getElementById('btn-already-reg');
    const btnBackIntro   = document.getElementById('btn-back-intro');
    const btnBackFromGame = document.getElementById('btn-game-menu');

    // Form elements
    const regForm        = document.getElementById('rebrunch-form');
    const padelSubpanel  = document.getElementById('padel-subpanel');
    const brunchSubpanel = document.getElementById('brunch-subpanel');
    const formErrorEl    = document.getElementById('form-error-msg');

    // Game & Hall of Fame elements
    const padelCanvas     = document.getElementById('padel-canvas');
    const hudScoreEl      = document.getElementById('hud-score');
    const hudPlayerNameEl = document.getElementById('hud-player-name');
    const matchModal      = document.getElementById('match-over-modal');
    const modalTitleEl    = document.getElementById('modal-result-title');
    const modalScoreEl    = document.getElementById('modal-result-score');
    const btnSaveScore    = document.getElementById('btn-save-hof');
    const btnRematch      = document.getElementById('btn-play-again');
    const hofListEl       = document.getElementById('hof-list');

    let currentView = 'intro';
    let toastTimer = null;
    let lastMatchResult = null;

    // ------------------------------------------------------------------------
    // 2. DRAW PIXEL-ART HERO ILLUSTRATION (PANCAKES, TOAST, RACQUETS)
    // ------------------------------------------------------------------------
    drawHeroPixelIllustration(document.getElementById('hero-art-canvas'));

    // ------------------------------------------------------------------------
    // 3. FLOATING POKÉMON TOAST DIALOGUE
    // ------------------------------------------------------------------------
    function showPokeToast(message, duration = 3200) {
        if (!pokeToast) return;
        pokeToast.innerHTML = `${message} <span style="color:#d33636;">▼</span>`;
        pokeToast.classList.add('visible');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            pokeToast.classList.remove('visible');
        }, duration);
    }

    // ------------------------------------------------------------------------
    // 4. INITIALIZE INPUT CONTROLLER & SUPER PADEL DX 2v2 ENGINE
    // ------------------------------------------------------------------------
    const inputCtrl = new InputController((key, label) => {
        // When user clicks physical D-Pad or Arcade Buttons outside the game:
        if (currentView === 'intro' && key === 'hit') {
            switchView('form', 'CARICAMENTO SCHEDA...');
            return;
        }
        const quote = OAK_QUOTES[Math.floor(Math.random() * OAK_QUOTES.length)];
        showPokeToast(`[${label}] ${quote}`);
    });

    const gameEngine = new PadelGameEngine(padelCanvas, inputCtrl, {
        onScoreUpdate(pScore, cScore) {
            hudScoreEl.textContent = `NOI ${pScore} - ${cScore} LORO`;
        },
        onSmash() {
            ledRed?.classList.add('pulse');
            setTimeout(() => ledRed?.classList.remove('pulse'), 900);
        },
        onMatchEnd(result) {
            lastMatchResult = result;
            modalTitleEl.textContent = result.won ? '🏆 VITTORIA EPICA!' : '💥 FINE PARTITA!';
            modalTitleEl.style.color = result.won ? '#6bc947' : '#f5b82e';
            modalScoreEl.textContent = `PUNTEGGIO FINALE: NOI ${result.playerScore} - LORO ${result.cpuScore}`;
            btnSaveScore.disabled = false;
            btnSaveScore.textContent = '[ 🏆 REGISTRA NELLA HALL OF FAME ]';
            matchModal.classList.add('active');
        }
    });

    // ------------------------------------------------------------------------
    // 5. LCD VIEW TRANSITION WITH ARCADE CURTAIN
    // ------------------------------------------------------------------------
    function switchView(targetView, curtainText = 'LOADING...') {
        sound.playButtonA();
        curtainEl.textContent = curtainText;
        curtainEl.classList.add('closing');

        setTimeout(() => {
            viewIntro.classList.toggle('active', targetView === 'intro');
            viewForm.classList.toggle('active', targetView === 'form');
            viewGame.classList.toggle('active', targetView === 'game');
            currentView = targetView;

            if (targetView === 'game') {
                const saved = getSavedPlayer();
                if (saved) {
                    hudPlayerNameEl.textContent = saved.full_name.split(' ')[0].toUpperCase();
                    gameEngine.configurePlayerNames(saved.full_name, saved.partner_name);
                }
                matchModal.classList.remove('active');
                gameEngine.startNewMatch();
                ledGreen?.classList.add('pulse');
                loadHallOfFame();
            } else {
                gameEngine.stop();
                ledGreen?.classList.remove('pulse');
            }

            setTimeout(() => {
                curtainEl.classList.remove('closing');
            }, 180);
        }, 360);
    }

    // ------------------------------------------------------------------------
    // 6. LOCALSTORAGE CHECK & FORM DYNAMIC FIELDS
    // ------------------------------------------------------------------------
    function getSavedPlayer() {
        try {
            const raw = localStorage.getItem(STORAGE_PLAYER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function updateSavedPlayerUI() {
        const saved = getSavedPlayer();
        if (saved && btnAlreadyReg) {
            btnAlreadyReg.style.display = 'block';
            btnAlreadyReg.textContent = `🎮 GIÀ ISCRITTO (${saved.full_name.split(' ')[0].toUpperCase()})? VAI AL CAMPO!`;
        }
    }
    updateSavedPlayerUI();

    // Dynamic radio listeners for Activity (Padel Doppio / Tennis Singolo / Solo Brunch)
    document.querySelectorAll('input[name="activity"]').forEach(radio => {
        radio.addEventListener('change', () => {
            sound.playDpadClick();
            const val = document.querySelector('input[name="activity"]:checked')?.value;
            padelSubpanel.style.display = val === 'padel' ? 'block' : 'none';

            // If user picks "Solo Brunch", auto-enable Brunch section
            if (val === 'brunch_only') {
                const brunchYes = document.querySelector('input[name="join_brunch"][value="1"]');
                if (brunchYes) {
                    brunchYes.checked = true;
                    brunchSubpanel.style.display = 'block';
                }
            }
        });
    });

    // Dynamic radio listeners for Brunch (Sì / No)
    document.querySelectorAll('input[name="join_brunch"]').forEach(radio => {
        radio.addEventListener('change', () => {
            sound.playDpadClick();
            const val = document.querySelector('input[name="join_brunch"]:checked')?.value;
            brunchSubpanel.style.display = val === '1' ? 'block' : 'none';
        });
    });

    // Navigation buttons
    btnGoForm?.addEventListener('click', () => switchView('form', 'APERTURA SCHEDA GIOCATORE...'));
    btnAlreadyReg?.addEventListener('click', () => switchView('game', 'SBLOCCO SUPER PADEL DX 2V2...'));
    btnBackIntro?.addEventListener('click', () => switchView('intro', 'RITORNO ALLA LOCANDINA...'));
    btnBackFromGame?.addEventListener('click', () => switchView('intro', 'PAUSA PARTITA...'));

    btnAudio?.addEventListener('click', () => {
        const on = sound.toggle();
        btnAudio.textContent = on ? '🔊 AUDIO: ON' : '🔇 AUDIO: OFF';
    });

    // ------------------------------------------------------------------------
    // 7. FORM SUBMISSION -> API/REGISTER.PHP -> UNLOCK GAME
    // ------------------------------------------------------------------------
    regForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        formErrorEl.style.display = 'none';

        const formData = new FormData(regForm);
        const payload = {
            full_name:      (formData.get('full_name') || '').toString().trim(),
            phone:          (formData.get('phone') || '').toString().trim(),
            activity:       (formData.get('activity') || 'padel').toString(),
            padel_category: (formData.get('padel_category') || 'Misto').toString(),
            partner_name:   (formData.get('partner_name') || '').toString().trim(),
            join_brunch:    formData.get('join_brunch') === '1',
            brunch_seats:   Number(formData.get('brunch_seats') || 1),
            dietary_notes:  (formData.get('dietary_notes') || '').toString().trim()
        };

        if (!payload.full_name || !payload.phone) {
            formErrorEl.textContent = '⚠️ INSERISCI NOME E TELEFONO!';
            formErrorEl.style.display = 'block';
            sound.playPoint(false);
            return;
        }

        try {
            const res = await fetch('api/register.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Errore di registrazione');
            }

            localStorage.setItem(STORAGE_PLAYER_KEY, JSON.stringify(data.player));
            updateSavedPlayerUI();
            sound.playLevelUpJingle();
            switchView('game', '🎉 ISCRIZIONE COMPLETATA! SBLOCCO SUPER PADEL DX...');
            setTimeout(() => {
                showPokeToast(`BENVENUTO IN CAMPO, ${data.player.full_name.toUpperCase()}!`);
            }, 900);
        } catch (err) {
            // Fallback if offline: still save in localStorage and unlock game
            localStorage.setItem(STORAGE_PLAYER_KEY, JSON.stringify(payload));
            updateSavedPlayerUI();
            sound.playLevelUpJingle();
            switchView('game', '🎉 SBLOCCO SUPER PADEL DX 2V2...');
        }
    });

    // ------------------------------------------------------------------------
    // 8. HALL OF FAME (API/SAVE_MATCH.PHP)
    // ------------------------------------------------------------------------
    async function loadHallOfFame() {
        try {
            const res = await fetch(`api/save_match.php?_=${Date.now()}`);
            const data = await res.json();
            if (data.ok && Array.isArray(data.leaderboard)) {
                renderHallOfFame(data.leaderboard);
            }
        } catch (e) {
            console.warn('Hall of fame offline:', e);
        }
    }

    function renderHallOfFame(list) {
        if (!hofListEl) return;
        if (!list.length) {
            hofListEl.innerHTML = '<div style="text-align:center; padding:6px;">NESSUN PUNTEGGIO REGISTRATO. SII IL PRIMO!</div>';
            return;
        }
        hofListEl.innerHTML = list.map((item, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            return `
                <div class="hof-item">
                    <span>${medal} <strong>${escapeHtml(item.player_name)}</strong></span>
                    <span>NOI ${item.player_score} - ${item.cpu_score} CPU</span>
                </div>
            `;
        }).join('');
    }

    btnSaveScore?.addEventListener('click', async () => {
        if (!lastMatchResult) return;
        btnSaveScore.disabled = true;
        btnSaveScore.textContent = 'SALVATAGGIO IN CORSO...';

        const savedPlayer = getSavedPlayer();
        const playerName = savedPlayer?.full_name || 'SOCIO REPUBLIC';

        try {
            const res = await fetch('api/save_match.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_name: playerName,
                    opponent_name: 'ALEJANDRO & COELLO8BIT',
                    player_score: lastMatchResult.playerScore,
                    cpu_score: lastMatchResult.cpuScore
                })
            });
            const data = await res.json();
            if (data.ok && Array.isArray(data.leaderboard)) {
                renderHallOfFame(data.leaderboard);
            }
            sound.playButtonA();
            btnSaveScore.textContent = '✔ SALVATO NELLA HALL OF FAME!';
            showPokeToast('PUNTEGGIO REGISTRATO NELLA CLASSIFICA DEL CIRCOLO!');
        } catch (e) {
            btnSaveScore.textContent = 'ERRORE RETE (RIPROVA)';
            btnSaveScore.disabled = false;
        }
    });

    btnRematch?.addEventListener('click', () => {
        sound.playButtonA();
        matchModal.classList.remove('active');
        gameEngine.startNewMatch();
    });

    loadHallOfFame();
});

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, s => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
}

/**
 * Draws the 8-bit pixel-art centerpiece from the REBRUNCH poster:
 * Club Sandwich, Avocado Toast with Fried Egg, Berry Pancakes, and Crossed Tennis & Padel Racquets + Balls
 */
function drawHeroPixelIllustration(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const px = (x, y, w, h, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    // 1. Club Sandwich (Back Left-Center)
    px(72, 16, 46, 36, '#10141d'); // Outline
    px(75, 19, 40, 10, '#e3a857'); // Top toasted bread
    px(75, 29, 40, 4,  '#d33636'); // Tomato layer
    px(75, 33, 40, 4,  '#6bc947'); // Lettuce layer
    px(75, 37, 40, 4,  '#f5b82e'); // Cheese layer
    px(75, 41, 40, 8,  '#d69542'); // Bottom bread
    // Toothpick + Red Olive on top
    px(94, 6,  3, 14, '#e6e6e6');
    px(91, 4,  9, 7,  '#10141d');
    px(93, 6,  5, 4,  '#d33636');

    // 2. Avocado Toast with Egg on White Plate (Front Left)
    px(22, 48, 66, 22, '#10141d');
    px(25, 51, 60, 16, '#eef5f0'); // White plate
    px(30, 40, 50, 18, '#10141d');
    px(33, 43, 44, 12, '#8c5828'); // Crust
    px(35, 39, 40, 11, '#6bc947'); // Mashed Avocado
    px(41, 35, 28, 9,  '#ffffff'); // Egg white
    px(49, 32, 12, 8,  '#f5b82e'); // Sunny Egg Yolk
    px(51, 33, 3,  2,  '#ffffff'); // Yolk shine

    // 3. Stack of Pancakes with Strawberry & Blueberries (Center)
    px(98, 38, 46, 32, '#10141d');
    px(101, 42, 40, 7, '#e09b42'); // Pancake 1
    px(101, 50, 40, 7, '#d18832'); // Pancake 2
    px(101, 58, 40, 7, '#e09b42'); // Pancake 3
    // Maple syrup drips
    px(108, 42, 6, 18, '#8a4816');
    px(122, 42, 5, 14, '#8a4816');
    // Strawberry & blueberries on top
    px(112, 31, 10, 9, '#d33636');
    px(123, 34, 6,  6, '#2b59c3');
    px(129, 36, 5,  5, '#3b73e0');

    // 4. Tennis Racquet (Center-Right)
    ctx.save();
    ctx.translate(168, 36);
    ctx.rotate(-0.35);
    px(-18, -22, 36, 42, '#10141d');
    px(-15, -19, 30, 36, '#d98a3c'); // Wooden/ Gold frame
    px(-11, -15, 22, 28, '#263342'); // String bed bg
    // Strings mesh
    for (let sx = -9; sx <= 9; sx += 4) px(sx, -15, 1, 28, '#cfd8e3');
    for (let sy = -13; sy <= 11; sy += 4) px(-11, sy, 22, 1, '#cfd8e3');
    px(-3, 20, 6, 18, '#10141d');
    px(-2, 20, 4, 16, '#c77b30'); // Handle
    ctx.restore();

    // 5. Padel Racquet (Right - Perforated Carbon Head)
    ctx.save();
    ctx.translate(212, 38);
    ctx.rotate(0.38);
    px(-18, -22, 36, 40, '#10141d');
    px(-15, -19, 30, 34, '#4e5d73'); // Outer frame
    px(-12, -16, 24, 28, '#6c7c94'); // Face
    // Padel holes grid
    for (let hx = -8; hx <= 8; hx += 5) {
        for (let hy = -11; hy <= 6; hy += 5) {
            px(hx, hy, 2, 2, '#10141d');
        }
    }
    px(-4, 18, 8, 18, '#10141d');
    px(-2, 18, 4, 16, '#39445b'); // Grip
    ctx.restore();

    // 6. Neon Yellow Tennis / Padel Balls
    const drawBall = (bx, by) => {
        px(bx, by, 14, 14, '#10141d');
        px(bx + 2, by + 2, 10, 10, '#c7f23a');
        px(bx + 4, by + 3, 6, 2, '#ffffff');
    };
    drawBall(188, 12);
    drawBall(152, 48);
    drawBall(163, 56);
    drawBall(216, 56);
}
