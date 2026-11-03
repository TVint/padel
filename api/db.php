<?php
/**
 * REBRUNCH // Republic Sport Village - SQLite Database Helper
 * Auto-creates database/event.sqlite and schema on first run.
 */
declare(strict_types=1);

function get_db(): PDO {
    $dbDir = __DIR__ . '/../database';
    if (!is_dir($dbDir)) {
        mkdir($dbDir, 0775, true);
    }
    $dbPath = $dbDir . '/event.sqlite';
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            activity TEXT NOT NULL,
            padel_category TEXT DEFAULT NULL,
            partner_name TEXT DEFAULT NULL,
            join_brunch INTEGER NOT NULL DEFAULT 0,
            brunch_seats INTEGER NOT NULL DEFAULT 0,
            dietary_notes TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            opponent_name TEXT NOT NULL DEFAULT 'CPU PRO TEAM',
            player_score INTEGER NOT NULL DEFAULT 0,
            cpu_score INTEGER NOT NULL DEFAULT 0,
            won INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    return $pdo;
}

function send_json(array $payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}
