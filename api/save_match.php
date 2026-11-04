<?php
// api/save_match.php - Save Arcade Padel Score to Leaderboard & Fetch Hall of Fame
declare(strict_types=1);
require_once __DIR__ . '/db.php';

$pdo = get_db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = $pdo->query("SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC LIMIT 20")->fetchAll();
    json_response(['ok' => true, 'leaderboard' => $rows]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method Not Allowed'], 405);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '{}', true);
if (!is_array($input) || empty($input)) {
    $input = $_POST;
}

$name = strtoupper(trim((string)($input['name'] ?? 'AAA')));
$name = preg_replace('/[^A-Z0-9 _\-\.]/', '', $name);
if ($name === '') {
    $name = 'AAA';
}
$name = mb_substr($name, 0, 12);

$score = max(0, (int)($input['score'] ?? 0));

$stmt = $pdo->prepare("
    INSERT INTO leaderboard (name, score, date)
    VALUES (:name, :score, datetime('now', 'localtime'))
");
$stmt->execute([
    ':name'  => $name,
    ':score' => $score,
]);

$id = (int)$pdo->lastInsertId();
$rows = $pdo->query("SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC LIMIT 20")->fetchAll();

json_response([
    'ok'          => true,
    'entry_id'    => $id,
    'leaderboard' => $rows,
]);
