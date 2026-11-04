<?php
// api/click.php - Track button clicks on the Game Boy Color shell
declare(strict_types=1);
require_once __DIR__ . '/db.php';

$pdo = get_db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = $pdo->query("SELECT id, area_clicked, click_count FROM click_stats ORDER BY id ASC")->fetchAll();
    json_response(['ok' => true, 'click_stats' => $rows]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method Not Allowed'], 405);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input) || empty($input)) {
    $input = $_POST;
}

$area = trim((string)($input['area_clicked'] ?? ''));
$allowed = ['green_brunch', 'red_aperitivo', 'yellow_torneo', 'play_game'];
if (!in_array($area, $allowed, true)) {
    json_response(['ok' => false, 'error' => 'Invalid area_clicked'], 400);
}

$stmt = $pdo->prepare("
    INSERT INTO click_stats (area_clicked, click_count)
    VALUES (:area, 1)
    ON CONFLICT(area_clicked) DO UPDATE SET click_count = click_count + 1
");
$stmt->execute([':area' => $area]);

$rows = $pdo->query("SELECT id, area_clicked, click_count FROM click_stats ORDER BY id ASC")->fetchAll();
json_response([
    'ok'          => true,
    'area_clicked'=> $area,
    'click_stats' => $rows,
]);
