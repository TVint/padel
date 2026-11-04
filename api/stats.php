<?php
// api/stats.php - Admin Statistics, Leaderboard Filtering, Delete & CSV Export
declare(strict_types=1);
session_start();
require_once __DIR__ . '/db.php';

$pdo = get_db();
$action = $_GET['action'] ?? 'summary';

// Public summary for LCD Hall of Fame
if ($action === 'public') {
    $leaderboard = $pdo->query("SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC LIMIT 15")->fetchAll();
    json_response([
        'ok'          => true,
        'leaderboard' => $leaderboard,
    ]);
}

// Check Admin Session or Token
$isAuthed = !empty($_SESSION['rebrunch_admin']) || (($_GET['key'] ?? '') === 'padel2026');
if (!$isAuthed) {
    json_response(['ok' => false, 'error' => 'Non autorizzato'], 401);
}

if ($action === 'delete_score' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = (int)($_POST['id'] ?? $_GET['id'] ?? 0);
    if ($id > 0) {
        $stmt = $pdo->prepare("DELETE FROM leaderboard WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }
    json_response(['ok' => true, 'deleted_id' => $id]);
}

if ($action === 'export_csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="rebrunch_leaderboard_' . date('Ymd_His') . '.csv"');
    $out = fopen('php://output', 'w');
    fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM
    fputcsv($out, ['ID', 'Giocatore', 'Punteggio', 'Data']);
    $rows = $pdo->query("SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC")->fetchAll();
    foreach ($rows as $r) {
        fputcsv($out, [$r['id'], $r['name'], $r['score'], $r['date']]);
    }
    fclose($out);
    exit;
}

$dateFilter = trim((string)($_GET['date'] ?? ''));
if ($dateFilter !== '') {
    $stmt = $pdo->prepare("SELECT id, name, score, date FROM leaderboard WHERE substr(date, 1, 10) = :d ORDER BY score DESC, id DESC");
    $stmt->execute([':d' => $dateFilter]);
    $leaderboard = $stmt->fetchAll();
} else {
    $leaderboard = $pdo->query("SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC")->fetchAll();
}

$clickStatsRows = $pdo->query("SELECT id, area_clicked, click_count FROM click_stats ORDER BY id ASC")->fetchAll();
$clickMap = [
    'green_brunch'  => 0,
    'red_aperitivo' => 0,
    'yellow_torneo' => 0,
    'play_game'     => 0,
];
foreach ($clickStatsRows as $r) {
    $clickMap[$r['area_clicked']] = (int)$r['click_count'];
}

json_response([
    'ok'          => true,
    'leaderboard' => $leaderboard,
    'click_stats' => $clickStatsRows,
    'click_map'   => $clickMap,
]);
