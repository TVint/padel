<?php
/**
 * REBRUNCH // Republic Sport Village - Admin Dashboard ("PC DI BILL" 8-BIT EDITION)
 * Password configurabile qui sotto: PADEL2026 o GBCPADEL2026
 */
declare(strict_types=1);
const ADMIN_PASSWORDS = ['PADEL2026', 'GBCPADEL2026'];
?>
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PC DI BILL // REBRUNCH ADMIN DASHBOARD</title>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/retro.css">
<style>
    body.admin-body {
        background: #1b2230;
        color: #f0f4e8;
        font-family: 'Press Start 2P', monospace;
        min-height: 100vh;
        padding: 24px 16px 60px;
        display: block;
        overflow-y: auto;
    }
    .pc-shell {
        max-width: 1180px;
        margin: 0 auto;
        background: #39445b;
        border: 6px solid #141923;
        box-shadow:
            inset 4px 4px 0 #576582,
            inset -4px -4px 0 #232b3b,
            0 12px 0 #0e121a;
        padding: 20px;
    }
    .pc-header {
        background: #5b7c68;
        border: 4px solid #141923;
        color: #101e14;
        padding: 16px;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        box-shadow: inset 3px 3px 0 #7aa089;
    }
    .pc-title {
        font-size: 15px;
        line-height: 1.5;
        color: #ffde3b;
        text-shadow: 2px 2px 0 #141923;
    }
    .pc-sub {
        font-size: 9px;
        color: #e6f5ea;
        margin-top: 4px;
    }
    .login-box {
        max-width: 480px;
        margin: 50px auto;
        background: #5b7c68;
        border: 4px solid #141923;
        padding: 24px;
        color: #101e14;
        text-align: center;
        box-shadow: 8px 8px 0 #141923;
    }
    .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
        margin-bottom: 22px;
    }
    .kpi-card {
        background: #273042;
        border: 4px solid #141923;
        padding: 14px;
        box-shadow: inset 3px 3px 0 #3f4c66;
    }
    .kpi-label {
        font-size: 9px;
        color: #9bb8a6;
        margin-bottom: 10px;
        line-height: 1.4;
    }
    .kpi-val {
        font-size: 24px;
        color: #f5b82e;
        text-shadow: 2px 2px 0 #141923;
        margin-bottom: 8px;
    }
    .kpi-sub {
        font-size: 8px;
        color: #d6e4da;
        line-height: 1.6;
    }
    .admin-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }
    .tab-group {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .pix-btn {
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        padding: 10px 12px;
        border: 3px solid #141923;
        background: #f5b82e;
        color: #141923;
        cursor: pointer;
        box-shadow: 3px 3px 0 #141923;
        text-decoration: none;
        display: inline-block;
    }
    .pix-btn:hover { filter: brightness(1.1); }
    .pix-btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #141923; }
    .pix-btn.active { background: #6bc947; color: #0e1d0b; }
    .pix-btn.danger { background: #d33636; color: #fff; padding: 6px 8px; font-size: 8px; }
    .pix-btn.secondary { background: #7aa089; color: #101e14; }

    .table-wrap {
        background: #5b7c68;
        border: 4px solid #141923;
        padding: 12px;
        overflow-x: auto;
    }
    table.retro-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 9px;
        color: #101e14;
    }
    table.retro-table th {
        background: #273042;
        color: #f5b82e;
        padding: 10px 8px;
        text-align: left;
        border: 2px solid #141923;
        white-space: nowrap;
    }
    table.retro-table td {
        padding: 9px 8px;
        border: 2px solid #2b4234;
        background: #dcebe1;
        line-height: 1.5;
        vertical-align: middle;
    }
    table.retro-table tr:nth-child(even) td {
        background: #c7dfd0;
    }
    .badge {
        display: inline-block;
        padding: 3px 6px;
        font-size: 8px;
        border: 2px solid #141923;
    }
    .badge-padel { background: #6bc947; color: #101e14; }
    .badge-tennis { background: #f5b82e; color: #101e14; }
    .badge-brunch { background: #48b8d0; color: #101e14; }
    .badge-warn { background: #d33636; color: #ffffff; animation: blink-anim 1s step-end infinite; }
    .badge-ok { background: #273042; color: #6bc947; }
    .retro-input {
        font-family: 'Press Start 2P', monospace;
        font-size: 11px;
        padding: 10px;
        width: 100%;
        border: 3px solid #141923;
        background: #e6f5ea;
        color: #101e14;
        margin: 12px 0;
    }
</style>
</head>
<body class="admin-body">

<div class="pc-shell">
    <div class="pc-header">
        <div>
            <div class="pc-title">💾 SISTEMA PC DI BILL // REBRUNCH ADMIN</div>
            <div class="pc-sub">REPUBLIC SPORT VILLAGE - DOMENICA 29 NOVEMBRE (10:00 - 14:30)</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
            <a href="index.html" class="pix-btn secondary">◄ CONSOLE GBC</a>
            <button id="btn-logout" class="pix-btn danger" style="display:none;">ESCI</button>
        </div>
    </div>

    <!-- LOGIN PANEL -->
    <div id="login-panel" class="login-box">
        <div style="font-size:12px; margin-bottom:10px;">🔒 ACCESSO ORGANIZZATORI</div>
        <p style="font-size:8px; line-height:1.6; margin-bottom:10px;">
            INSERISCI LA PASSWORD SEGRETA DEL CIRCOLO<br>(Default: <strong>PADEL2026</strong> o <strong>GBCPADEL2026</strong>)
        </p>
        <form id="login-form">
            <input type="password" id="admin-pass" class="retro-input" placeholder="PASSWORD..." required autocomplete="current-password">
            <button type="submit" class="pix-btn active" style="width:100%;">[ ACCEDI AL PC DI BILL ]</button>
            <div id="login-err" style="color:#d33636; font-size:8px; margin-top:10px; display:none;">PASSWORD ERRATA!</div>
        </form>
    </div>

    <!-- DASHBOARD PANEL -->
    <div id="dashboard-panel" style="display:none;">
        <!-- KPI CARDS -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">TOTALE ISCRITTI</div>
                <div class="kpi-val" id="kpi-total">0</div>
                <div class="kpi-sub" id="kpi-total-sub">Schede giocatore registrate</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">TORNEO PADEL DOPPIO</div>
                <div class="kpi-val" id="kpi-padel" style="color:#6bc947;">0</div>
                <div class="kpi-sub" id="kpi-padel-sub">M: 0 | F: 0 | MISTO: 0<br>Cerca Partner: 0</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">TORNEO TENNIS SINGOLO</div>
                <div class="kpi-val" id="kpi-tennis" style="color:#48b8d0;">0</div>
                <div class="kpi-sub">Tabellone singolare</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">TOTALE COPERTI BRUNCH</div>
                <div class="kpi-val" id="kpi-brunch" style="color:#ff6b6b;">0</div>
                <div class="kpi-sub" id="kpi-brunch-sub">Somma posti prenotati (1-5/iscritto)</div>
            </div>
        </div>

        <!-- TOOLBAR & FILTERS -->
        <div class="admin-toolbar">
            <div class="tab-group">
                <button class="pix-btn active" data-filter="all">TUTTI GLI ISCRITTI</button>
                <button class="pix-btn" data-filter="padel">TORNEO PADEL</button>
                <button class="pix-btn" data-filter="tennis">TORNEO TENNIS</button>
                <button class="pix-btn" data-filter="brunch">PRENOTAZIONI BRUNCH</button>
                <button class="pix-btn" data-filter="matches">🏆 HALL OF FAME (MINIGAME)</button>
            </div>
            <div style="display:flex; gap:8px;">
                <button id="btn-refresh" class="pix-btn secondary">↻ AGGIORNA</button>
                <a id="btn-export-csv" href="#" class="pix-btn">[ ESPORTA CSV ]</a>
            </div>
        </div>

        <!-- REGISTRATIONS TABLE -->
        <div class="table-wrap" id="reg-table-wrap">
            <table class="retro-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>GIOCATORE</th>
                        <th>TELEFONO</th>
                        <th>ATTIVITÀ</th>
                        <th>CAT. PADEL / PARTNER</th>
                        <th>BRUNCH (POSTI)</th>
                        <th>NOTE / INTOLLERANZE</th>
                        <th>DATA</th>
                        <th>AZIONI</th>
                    </tr>
                </thead>
                <tbody id="reg-tbody">
                    <tr><td colspan="9" style="text-align:center;">CARICAMENTO DATI DAL POKÉDEX...</td></tr>
                </tbody>
            </table>
        </div>

        <!-- MATCHES TABLE -->
        <div class="table-wrap" id="matches-table-wrap" style="display:none;">
            <table class="retro-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>GIOCATORE</th>
                        <th>AVVERSARIO</th>
                        <th>PUNTEGGIO</th>
                        <th>ESITO</th>
                        <th>DATA MATCH</th>
                        <th>AZIONI</th>
                    </tr>
                </thead>
                <tbody id="matches-tbody">
                    <tr><td colspan="7" style="text-align:center;">NESSUNA PARTITA REGISTRATA</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
(() => {
    const STORAGE_KEY = 'rebrunch_admin_key';
    let adminKey = sessionStorage.getItem(STORAGE_KEY) || '';
    let currentFilter = 'all';
    let cachedData = { registrations: [], matches: [], counts: {} };

    const loginPanel = document.getElementById('login-panel');
    const dashPanel  = document.getElementById('dashboard-panel');
    const loginForm  = document.getElementById('login-form');
    const passInput  = document.getElementById('admin-pass');
    const loginErr   = document.getElementById('login-err');
    const btnLogout  = document.getElementById('btn-logout');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnCsv     = document.getElementById('btn-export-csv');
    const regTbody   = document.getElementById('reg-tbody');
    const matchTbody = document.getElementById('matches-tbody');
    const regWrap    = document.getElementById('reg-table-wrap');
    const matchWrap  = document.getElementById('matches-table-wrap');

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, s => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[s]));
    }

    async function fetchStats(keyToTry) {
        const res = await fetch(`api/stats.php?key=${encodeURIComponent(keyToTry)}&_=${Date.now()}`);
        if (!res.ok) throw new Error('Unauthorized');
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Errore');
        return data;
    }

    function renderKPIs(c) {
        document.getElementById('kpi-total').textContent = c.total_registrations ?? 0;
        document.getElementById('kpi-total-sub').textContent =
            `Solo Brunch/Tifo: ${c.brunch_only_total ?? 0}`;
        document.getElementById('kpi-padel').textContent = c.padel_total ?? 0;
        document.getElementById('kpi-padel-sub').innerHTML =
            `M: ${c.padel_maschile ?? 0} | F: ${c.padel_femminile ?? 0} | MISTO: ${c.padel_misto ?? 0}<br>` +
            `🔍 Cerca Partner: <strong>${c.padel_seeking_partner ?? 0}</strong>`;
        document.getElementById('kpi-tennis').textContent = c.tennis_total ?? 0;
        document.getElementById('kpi-brunch').textContent = c.brunch_total_seats ?? 0;
    }

    function renderTables() {
        if (currentFilter === 'matches') {
            regWrap.style.display = 'none';
            matchWrap.style.display = 'block';
            const matches = cachedData.matches || [];
            if (matches.length === 0) {
                matchTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">NESSUN MATCH GIOCATO FINORA</td></tr>';
                return;
            }
            matchTbody.innerHTML = matches.map(m => `
                <tr>
                    <td>#${m.id}</td>
                    <td><strong>${escapeHtml(m.player_name)}</strong></td>
                    <td>${escapeHtml(m.opponent_name)}</td>
                    <td><strong>NOI ${m.player_score} - ${m.cpu_score} CPU</strong></td>
                    <td>${Number(m.won) ? '<span class="badge badge-padel">VITTORIA</span>' : '<span class="badge badge-tennis">SCONFITTA</span>'}</td>
                    <td>${escapeHtml(m.created_at)}</td>
                    <td><button class="pix-btn danger" data-del-match="${m.id}">ELIMINA</button></td>
                </tr>
            `).join('');
            return;
        }

        regWrap.style.display = 'block';
        matchWrap.style.display = 'none';

        let rows = cachedData.registrations || [];
        if (currentFilter === 'padel') {
            rows = rows.filter(r => r.activity === 'padel');
        } else if (currentFilter === 'tennis') {
            rows = rows.filter(r => r.activity === 'tennis');
        } else if (currentFilter === 'brunch') {
            rows = rows.filter(r => Number(r.join_brunch) === 1);
        }

        if (rows.length === 0) {
            regTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">NESSUN ISCRITTO IN QUESTA CATEGORIA</td></tr>';
            return;
        }

        regTbody.innerHTML = rows.map(r => {
            let actBadge = '<span class="badge badge-brunch">SOLO BRUNCH</span>';
            if (r.activity === 'padel') actBadge = '<span class="badge badge-padel">PADEL DOPPIO</span>';
            if (r.activity === 'tennis') actBadge = '<span class="badge badge-tennis">TENNIS SINGOLO</span>';

            let partnerCell = '-';
            if (r.activity === 'padel') {
                const pName = (r.partner_name || '').trim();
                const partnerBadge = pName
                    ? `<span class="badge badge-ok">CON: ${escapeHtml(pName)}</span>`
                    : `<span class="badge badge-warn">CERCA PARTNER!</span>`;
                partnerCell = `<div><strong>${escapeHtml(r.padel_category || 'Misto')}</strong></div><div style="margin-top:4px;">${partnerBadge}</div>`;
            }

            const brunchCell = Number(r.join_brunch)
                ? `<span class="badge badge-padel">SÌ (${r.brunch_seats} POSTI)</span>`
                : `<span class="badge">NO</span>`;

            const notesCell = (r.dietary_notes || '').trim()
                ? `<strong style="color:#b31b1b;">⚠️ ${escapeHtml(r.dietary_notes)}</strong>`
                : '-';

            return `
                <tr>
                    <td>#${r.id}</td>
                    <td><strong>${escapeHtml(r.full_name)}</strong></td>
                    <td>${escapeHtml(r.phone)}</td>
                    <td>${actBadge}</td>
                    <td>${partnerCell}</td>
                    <td>${brunchCell}</td>
                    <td>${notesCell}</td>
                    <td>${escapeHtml(r.created_at)}</td>
                    <td><button class="pix-btn danger" data-del-reg="${r.id}">ELIMINA</button></td>
                </tr>
            `;
        }).join('');
    }

    async function loadDashboard(key) {
        try {
            const data = await fetchStats(key);
            adminKey = key;
            sessionStorage.setItem(STORAGE_KEY, key);
            cachedData = data;

            loginPanel.style.display = 'none';
            dashPanel.style.display  = 'block';
            btnLogout.style.display  = 'inline-block';
            btnCsv.href = `api/stats.php?export=csv&key=${encodeURIComponent(adminKey)}`;

            renderKPIs(data.counts || {});
            renderTables();
        } catch (err) {
            loginPanel.style.display = 'block';
            dashPanel.style.display  = 'none';
            if (key) {
                loginErr.style.display = 'block';
            }
        }
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loginErr.style.display = 'none';
        loadDashboard(passInput.value.trim());
    });

    btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem(STORAGE_KEY);
        adminKey = '';
        dashPanel.style.display = 'none';
        btnLogout.style.display = 'none';
        loginPanel.style.display = 'block';
        passInput.value = '';
    });

    btnRefresh.addEventListener('click', () => loadDashboard(adminKey));

    document.querySelectorAll('.tab-group .pix-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-group .pix-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTables();
        });
    });

    document.addEventListener('click', async (e) => {
        const delRegBtn = e.target.closest('[data-del-reg]');
        if (delRegBtn) {
            const id = delRegBtn.getAttribute('data-del-reg');
            if (confirm(`Eliminare definitivamente l'iscrizione #${id}?`)) {
                await fetch(`api/stats.php?action=delete_registration&id=${id}&key=${encodeURIComponent(adminKey)}`, { method: 'POST' });
                loadDashboard(adminKey);
            }
        }
        const delMatchBtn = e.target.closest('[data-del-match]');
        if (delMatchBtn) {
            const id = delMatchBtn.getAttribute('data-del-match');
            if (confirm(`Eliminare il match #${id} dalla Hall of Fame?`)) {
                await fetch(`api/stats.php?action=delete_match&id=${id}&key=${encodeURIComponent(adminKey)}`, { method: 'POST' });
                loadDashboard(adminKey);
            }
        }
    });

    if (adminKey) {
        loadDashboard(adminKey);
    }
})();
</script>
</body>
</html>
