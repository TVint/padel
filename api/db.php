<?php
// api/db.php - SQLite3 Connection & Auto-Schema Generator (Advergame & Click Stats)
declare(strict_types=1);

function get_db(): PDO {
    $dbDir = __DIR__ . '/../database';
    if (!is_dir($dbDir)) {
        mkdir($dbDir, 0775, true);
    }
    $dbPath = $dbDir . '/event.sqlite';
    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    // Drop legacy tables if present
    $pdo->exec("DROP TABLE IF EXISTS registrations;");
    $pdo->exec("DROP TABLE IF EXISTS matches;");

    // 1. Leaderboard Table (id, name, score, date)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL DEFAULT 0,
            date TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );
    ");

    // 2. Click Stats Table (id, area_clicked, click_count)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS click_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            area_clicked TEXT UNIQUE NOT NULL,
            click_count INTEGER NOT NULL DEFAULT 0
        );
    ");

    // Ensure the 4 tracked Game Boy areas exist in click_stats
    $areas = ['green_brunch', 'red_aperitivo', 'yellow_torneo', 'play_game'];
    $stmt = $pdo->prepare("INSERT OR IGNORE INTO click_stats (area_clicked, click_count) VALUES (:area, 0)");
    foreach ($areas as $area) {
        $stmt->execute([':area' => $area]);
    }

    // Seed initial arcade leaderboard entries if empty
    $count = (int)$pdo->query("SELECT COUNT(*) FROM leaderboard")->fetchColumn();
    if ($count === 0) {
        $pdo->exec("
            INSERT INTO leaderboard (name, score, date) VALUES
            ('REP', 1250, datetime('now', 'localtime', '-2 hours')),
            ('MIR', 980, datetime('now', 'localtime', '-1 hour')),
            ('MAR', 840, datetime('now', 'localtime', '-30 minutes'));
        ");
    }

    return $pdo;
}

function json_response(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
