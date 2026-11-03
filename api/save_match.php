<?php
/**
 * GET / POST /api/save_match.php
 * Saves completed Super Padel DX 2v2 matches & returns Hall of Fame leaderboard.
 */
declare(strict_types=1);
require_once __DIR__ . '/db.php';

try {
    $pdo = get_db();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw ?: '{}', true);
        if (!is_array($data) || empty($data)) {
            $data = $_POST;
        }

        $playerName   = trim((string)($data['player_name'] ?? 'ALLENATORE PADEL'));
        $opponentName = trim((string)($data['opponent_name'] ?? 'PRO CPU DUO'));
        $playerScore  = max(0, min(99, (int)($data['player_score'] ?? 0)));
        $cpuScore     = max(0, min(99, (int)($data['cpu_score'] ?? 0)));
        $won          = $playerScore > $cpuScore ? 1 : 0;

        if ($playerName === '') {
            $playerName = 'ALLENATORE PADEL';
        }

        $stmt = $pdo->prepare("
            INSERT INTO matches (player_name, opponent_name, player_score, cpu_score, won)
            VALUES (:player_name, :opponent_name, :player_score, :cpu_score, :won)
        ");
        $stmt->execute([
            ':player_name'   => $playerName,
            ':opponent_name' => $opponentName,
            ':player_score'  => $playerScore,
            ':cpu_score'     => $cpuScore,
            ':won'           => $won,
        ]);
    }

    $leaders = $pdo->query("
        SELECT id, player_name, opponent_name, player_score, cpu_score, won, created_at
        FROM matches
        ORDER BY won DESC, (player_score - cpu_score) DESC, player_score DESC, id DESC
        LIMIT 25
    ")->fetchAll();

    send_json([
        'ok' => true,
        'leaderboard' => $leaders
    ]);
} catch (Throwable $e) {
    send_json(['ok' => false, 'error' => 'Errore Hall of Fame: ' . $e->getMessage()], 500);
}
