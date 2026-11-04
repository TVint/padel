<?php
// admin.php - REBRUNCH // Republic Sport Village - Admin Dashboard (Leaderboard & GBC Click Heatmap)
declare(strict_types=1);
session_start();
require_once __DIR__ . '/api/db.php';

$ADMIN_PASS = 'padel2026';
$loginError = '';

if (isset($_GET['logout'])) {
    unset($_SESSION['rebrunch_admin']);
    header('Location: admin.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if ($_POST['password'] === $ADMIN_PASS) {
        $_SESSION['rebrunch_admin'] = true;
        header('Location: admin.php');
        exit;
    } else {
        $loginError = 'PASSWORD ERRATA! RIPROVA.';
    }
}

$isAuthed = !empty($_SESSION['rebrunch_admin']);
$pdo = get_db();

if ($isAuthed && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_score_id'])) {
    $delId = (int)$_POST['delete_score_id'];
    if ($delId > 0) {
        $stmt = $pdo->prepare("DELETE FROM leaderboard WHERE id = :id");
        $stmt->execute([':id' => $delId]);
    }
    $redirectDate = isset($_GET['date']) && $_GET['date'] !== '' ? '?date=' . urlencode((string)$_GET['date']) : '';
    header('Location: admin.php' . $redirectDate);
    exit;
}

$dateFilter = trim((string)($_GET['date'] ?? ''));
$leaderboard = [];
$clickMap = [
    'green_brunch'  => 0,
    'red_aperitivo' => 0,
    'yellow_torneo' => 0,
    'play_game'     => 0,
];
$totalClicks = 0;

if ($isAuthed) {
    if ($dateFilter !== '') {
        $stmt = $pdo->prepare("SELECT id, name, score, date FROM leaderboard WHERE substr(date, 1, 10) = :d ORDER BY score DESC, id DESC");
        $stmt->execute([':d' => $dateFilter]);
        $leaderboard = $stmt->fetchAll();
    } else {
        $leaderboard = $pdo->query("SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC")->fetchAll();
    }

    $clickRows = $pdo->query("SELECT area_clicked, click_count FROM click_stats")->fetchAll();
    foreach ($clickRows as $r) {
        $clickMap[$r['area_clicked']] = (int)$r['click_count'];
        $totalClicks += (int)$r['click_count'];
    }
}

function heat_alpha(int $count, int $maxCount): string {
    if ($maxCount <= 0 || $count <= 0) return '0.25';
    $ratio = min(1.0, max(0.25, $count / $maxCount));
    return number_format($ratio, 2, '.', '');
}
$maxClick = max(1, max($clickMap));
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ADMIN // REBRUNCH GBC ADVERGAME</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0c0d14;
      --card: #16192b;
      --border: #38bdf8;
      --gold: #facc15;
      --green: #22c55e;
      --red: #ef4444;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at top, #1e1b4b 0%, #090a10 100%);
      color: var(--text);
      font-family: 'Press Start 2P', monospace;
      min-height: 100vh;
      padding: 24px 16px 60px;
      line-height: 1.5;
    }
    .container { max-width: 1180px; margin: 0 auto; }
    .top-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: var(--card);
      border: 4px solid var(--gold);
      box-shadow: 0 6px 0 #000;
      margin-bottom: 24px;
    }
    .top-bar h1 { font-size: 13px; color: var(--gold); }
    .top-bar .sub { font-size: 8px; color: var(--border); margin-top: 4px; }
    .btn {
      display: inline-block;
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      padding: 10px 14px;
      background: var(--green);
      color: #052e16;
      border: 3px solid #fff;
      text-decoration: none;
      cursor: pointer;
      box-shadow: 0 4px 0 #000;
    }
    .btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #000; }
    .btn-red { background: var(--red); color: #fff; }
    .btn-blue { background: var(--border); color: #082f49; }

    .login-box {
      max-width: 420px;
      margin: 80px auto;
      background: var(--card);
      border: 4px solid var(--gold);
      padding: 28px 24px;
      text-align: center;
      box-shadow: 0 10px 0 #000;
    }
    .login-box h2 { font-size: 12px; color: var(--gold); margin-bottom: 16px; }
    .login-box input {
      width: 100%;
      padding: 12px;
      font-family: 'Press Start 2P', monospace;
      font-size: 10px;
      background: #090a10;
      color: #fff;
      border: 3px solid var(--border);
      margin-bottom: 16px;
      text-align: center;
    }
    .err { color: var(--red); font-size: 9px; margin-bottom: 12px; }

    .admin-grid {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 24px;
      align-items: start;
    }
    @media (max-width: 920px) {
      .admin-grid { grid-template-columns: 1fr; }
    }

    .panel {
      background: var(--card);
      border: 4px solid #334155;
      padding: 18px;
      box-shadow: 0 6px 0 #000;
    }
    .panel h2 {
      font-size: 11px;
      color: var(--gold);
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Stylized Game Boy Color Heatmap */
    .gbc-heatmap-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .gbc-mini-shell {
      position: relative;
      width: 280px;
      height: 450px;
      background: linear-gradient(165deg, #fbbf24 0%, #f59e0b 55%, #d97706 100%);
      border-radius: 18px 18px 42px 18px;
      border: 5px solid #1e293b;
      box-shadow: inset 0 4px 0 rgba(255,255,255,0.45), 0 10px 0 #000;
      padding: 16px;
      user-select: none;
    }
    .gbc-mini-lens {
      background: #1e293b;
      border-radius: 10px 10px 24px 10px;
      padding: 12px;
      border: 3px solid #0f172a;
    }
    .gbc-mini-lcd {
      background: #0f380f;
      border: 3px solid #000;
      height: 155px;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 8px;
      color: #9bbc0f;
    }
    .gbc-mini-lcd .lcd-title { font-size: 9px; color: #facc15; margin-bottom: 6px; }
    .gbc-mini-lcd .lcd-sub { font-size: 7px; color: #8bac0f; line-height: 1.6; }
    .gbc-mini-brand {
      text-align: center;
      font-size: 8px;
      color: #1e293b;
      margin-top: 8px;
      letter-spacing: 1px;
    }
    .gbc-mini-controls {
      position: relative;
      height: 210px;
      margin-top: 10px;
    }
    /* Mini D-Pad */
    .mini-dpad {
      position: absolute;
      left: 14px;
      top: 34px;
      width: 68px;
      height: 68px;
    }
    .mini-dpad::before, .mini-dpad::after {
      content: '';
      position: absolute;
      background: #1e293b;
      border: 2px solid #000;
      border-radius: 3px;
    }
    .mini-dpad::before { left: 22px; top: 0; width: 24px; height: 68px; }
    .mini-dpad::after  { left: 0; top: 22px; width: 68px; height: 24px; }

    /* Heatmap Hotspot Badges on Buttons */
    .heat-node {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 3px solid #fff;
      color: #fff;
      font-size: 8px;
      text-shadow: 1px 1px 0 #000;
      box-shadow: 0 4px 0 #000;
      transition: transform 0.15s;
    }
    .heat-node:hover { transform: scale(1.08); z-index: 5; }
    .heat-node .count {
      font-size: 10px;
      font-weight: bold;
      color: #fff;
    }
    .heat-node .lbl {
      font-size: 6px;
      margin-top: 2px;
      color: #f8fafc;
    }

    /* Red Button (Aperitivo) */
    .heat-red {
      right: 12px;
      top: 16px;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 22px rgba(239, 68, 68, <?= heat_alpha($clickMap['red_aperitivo'], $maxClick) ?>), 0 4px 0 #000;
    }
    /* Green Button (Brunch) */
    .heat-green {
      right: 74px;
      top: 40px;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 22px rgba(34, 197, 94, <?= heat_alpha($clickMap['green_brunch'], $maxClick) ?>), 0 4px 0 #000;
    }
    /* Yellow Button (Torneo) */
    .heat-yellow {
      right: 36px;
      top: 86px;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: #eab308;
      color: #000;
      box-shadow: 0 0 22px rgba(234, 179, 8, <?= heat_alpha($clickMap['yellow_torneo'], $maxClick) ?>), 0 4px 0 #000;
    }
    /* GIOCA Horizontal Button */
    .heat-play {
      left: 50%;
      bottom: 12px;
      transform: translateX(-50%);
      width: 156px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(180deg, #ef4444 0%, #991b1b 100%);
      box-shadow: 0 0 24px rgba(239, 68, 68, <?= heat_alpha($clickMap['play_game'], $maxClick) ?>), 0 4px 0 #000;
    }
    .heat-play:hover { transform: translateX(-50%) scale(1.06); }

    .click-legend {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 8px;
    }
    .legend-item {
      background: #0f172a;
      border: 2px solid #334155;
      padding: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Filter Bar & Table */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 16px;
      background: #0f172a;
      padding: 12px;
      border: 2px solid #334155;
    }
    .filter-bar label { font-size: 8px; color: var(--muted); }
    .filter-bar input[type="date"] {
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      padding: 8px 10px;
      background: #16192b;
      color: #fff;
      border: 2px solid var(--border);
    }

    .table-wrap { overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }
    th, td {
      padding: 12px 10px;
      border-bottom: 2px solid #1e293b;
      text-align: left;
    }
    th {
      background: #090a10;
      color: var(--border);
      font-size: 8px;
      text-transform: uppercase;
    }
    tr:hover td { background: rgba(56, 189, 248, 0.06); }
    .badge-score {
      display: inline-block;
      padding: 4px 8px;
      background: #052e16;
      color: #4ade80;
      border: 2px solid #22c55e;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-bar">
      <div>
        <h1>🕹️ REBRUNCH // ADMIN &amp; CLICK HEATMAP</h1>
        <div class="sub">REPUBLIC SPORT VILLAGE - PADEL ADVERGAME ANALYTICS</div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a class="btn btn-blue" href="index.html">⬅ TORNA AL GAME BOY</a>
        <?php if ($isAuthed): ?>
          <a class="btn" href="api/stats.php?action=export_csv">⬇ EXPORT CSV</a>
          <a class="btn btn-red" href="admin.php?logout=1">ESCI</a>
        <?php endif; ?>
      </div>
    </div>

    <?php if (!$isAuthed): ?>
      <div class="login-box">
        <h2>🔒 ACCESSO ORGANIZZATORI</h2>
        <?php if ($loginError): ?>
          <div class="err"><?= htmlspecialchars($loginError) ?></div>
        <?php endif; ?>
        <form method="POST" action="admin.php">
          <input type="password" name="password" placeholder="PASSWORD ADMIN" required autofocus />
          <button type="submit" class="btn" style="width:100%;">ENTRA NELLA DASHBOARD</button>
        </form>
        <p style="font-size:7px; color:#64748b; margin-top:14px;">Password demo: padel2026</p>
      </div>
    <?php else: ?>
      <div class="admin-grid">
        <!-- LEFT COLUMN: GAME BOY MINI-GRAPHIC CLICK HEATMAP -->
        <div class="panel">
          <h2>
            <span>🔥 GBC CLICK HEATMAP</span>
            <span style="font-size:8px; color:var(--border);">TOT: <?= (int)$totalClicks ?></span>
          </h2>
          <div class="gbc-heatmap-wrap">
            <div class="gbc-mini-shell">
              <div class="gbc-mini-lens">
                <div class="gbc-mini-lcd">
                  <div class="lcd-title">REBRUNCH 29.11</div>
                  <div class="lcd-sub">HEATMAP INTERAZIONI<br>PULSANTI CONSOLE</div>
                </div>
              </div>
              <div class="gbc-mini-brand">GAME BOY COLOR</div>

              <div class="gbc-mini-controls">
                <div class="mini-dpad" title="D-Pad"></div>

                <!-- RED BUTTON: APERITIVO -->
                <div class="heat-node heat-red" title="Pulsante Rosso (Aperitivo)">
                  <span class="count"><?= (int)$clickMap['red_aperitivo'] ?></span>
                  <span class="lbl">APERITIVO</span>
                </div>

                <!-- GREEN BUTTON: BRUNCH -->
                <div class="heat-node heat-green" title="Pulsante Verde (Brunch)">
                  <span class="count"><?= (int)$clickMap['green_brunch'] ?></span>
                  <span class="lbl">BRUNCH</span>
                </div>

                <!-- YELLOW BUTTON: TORNEO -->
                <div class="heat-node heat-yellow" title="Pulsante Giallo (Torneo)">
                  <span class="count"><?= (int)$clickMap['yellow_torneo'] ?></span>
                  <span class="lbl">TORNEO</span>
                </div>

                <!-- GIOCA BUTTON -->
                <div class="heat-node heat-play" title="Tasto GIOCA (Avvio Partita)">
                  <span class="count">🕹️ <?= (int)$clickMap['play_game'] ?></span>
                  <span class="lbl">TASTO GIOCA</span>
                </div>
              </div>
            </div>

            <div class="click-legend">
              <div class="legend-item">
                <span style="color:#4ade80;">🟢 BRUNCH</span>
                <strong><?= (int)$clickMap['green_brunch'] ?></strong>
              </div>
              <div class="legend-item">
                <span style="color:#f87171;">🔴 APERITIVO</span>
                <strong><?= (int)$clickMap['red_aperitivo'] ?></strong>
              </div>
              <div class="legend-item">
                <span style="color:#facc15;">🟡 TORNEO</span>
                <strong><?= (int)$clickMap['yellow_torneo'] ?></strong>
              </div>
              <div class="legend-item">
                <span style="color:#fb923c;">🕹️ GIOCA</span>
                <strong><?= (int)$clickMap['play_game'] ?></strong>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: LEADERBOARD TABLE WITH DATE FILTER & DELETE -->
        <div class="panel">
          <h2>
            <span>🏆 CLASSIFICA ADVERGAME (<?= count($leaderboard) ?>)</span>
          </h2>

          <form method="GET" action="admin.php" class="filter-bar">
            <label for="filter-date">FILTRA PER DATA:</label>
            <input type="date" id="filter-date" name="date" value="<?= htmlspecialchars($dateFilter) ?>" />
            <button type="submit" class="btn btn-blue">FILTRA</button>
            <?php if ($dateFilter !== ''): ?>
              <a href="admin.php" class="btn btn-red">RESET</a>
            <?php endif; ?>
          </form>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>ID</th>
                  <th>GIOCATORE</th>
                  <th>PUNTEGGIO</th>
                  <th>DATA &amp; ORA</th>
                  <th>AZIONI</th>
                </tr>
              </thead>
              <tbody>
                <?php if (empty($leaderboard)): ?>
                  <tr>
                    <td colspan="6" style="text-align:center; color:#64748b; padding:24px;">
                      NESSUN PUNTEGGIO REGISTRATO PER QUESTA DATA.
                    </td>
                  </tr>
                <?php else: foreach ($leaderboard as $idx => $row): ?>
                  <tr>
                    <td style="color:var(--gold);">#<?= $idx + 1 ?></td>
                    <td><?= (int)$row['id'] ?></td>
                    <td style="color:#fff; font-weight:bold;"><?= htmlspecialchars($row['name']) ?></td>
                    <td><span class="badge-score"><?= (int)$row['score'] ?> PTS</span></td>
                    <td style="color:#94a3b8; font-size:8px;"><?= htmlspecialchars($row['date']) ?></td>
                    <td>
                      <form method="POST" action="admin.php<?= $dateFilter !== '' ? '?date=' . urlencode($dateFilter) : '' ?>" onsubmit="return confirm('Eliminare questo punteggio dalla classifica?');" style="display:inline;">
                        <input type="hidden" name="delete_score_id" value="<?= (int)$row['id'] ?>" />
                        <button type="submit" class="btn btn-red" style="padding:6px 10px; font-size:8px;">ELIMINA</button>
                      </form>
                    </td>
                  </tr>
                <?php endforeach; endif; ?>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
