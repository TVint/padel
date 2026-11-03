<?php
/**
 * POST /api/register.php
 * Saves player registration for REBRUNCH (Padel Doppio, Tennis Singolo, or Solo Brunch)
 */
declare(strict_types=1);
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['ok' => false, 'error' => 'Metodo non consentito. Usa POST.'], 405);
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '{}', true);
if (!is_array($data) || empty($data)) {
    $data = $_POST;
}

$fullName = trim((string)($data['full_name'] ?? ''));
$phone    = trim((string)($data['phone'] ?? ''));
$activity = trim((string)($data['activity'] ?? 'padel'));
$padelCategory = trim((string)($data['padel_category'] ?? ''));
$partnerName   = trim((string)($data['partner_name'] ?? ''));
$joinBrunch    = !empty($data['join_brunch']) && $data['join_brunch'] !== 'no' && $data['join_brunch'] !== '0' ? 1 : 0;
$brunchSeats   = $joinBrunch ? max(1, min(5, (int)($data['brunch_seats'] ?? 1))) : 0;
$dietaryNotes  = $joinBrunch ? trim((string)($data['dietary_notes'] ?? '')) : '';

if ($fullName === '' || $phone === '') {
    send_json(['ok' => false, 'error' => 'Inserisci Nome, Cognome e Telefono!'], 422);
}

$allowedActivities = ['padel', 'tennis', 'brunch_only'];
if (!in_array($activity, $allowedActivities, true)) {
    $activity = 'padel';
}

if ($activity === 'padel') {
    $allowedCats = ['Maschile', 'Femminile', 'Misto'];
    if (!in_array($padelCategory, $allowedCats, true)) {
        $padelCategory = 'Misto';
    }
} else {
    $padelCategory = null;
    $partnerName   = null;
}

if ($activity === 'brunch_only' && !$joinBrunch) {
    $joinBrunch  = 1;
    $brunchSeats = max(1, (int)($data['brunch_seats'] ?? 1));
}

try {
    $pdo = get_db();
    $stmt = $pdo->prepare("
        INSERT INTO registrations (
            full_name, phone, activity, padel_category, partner_name,
            join_brunch, brunch_seats, dietary_notes
        ) VALUES (
            :full_name, :phone, :activity, :padel_category, :partner_name,
            :join_brunch, :brunch_seats, :dietary_notes
        )
    ");
    $stmt->execute([
        ':full_name'      => $fullName,
        ':phone'          => $phone,
        ':activity'       => $activity,
        ':padel_category' => $padelCategory,
        ':partner_name'   => $partnerName !== '' ? $partnerName : null,
        ':join_brunch'    => $joinBrunch,
        ':brunch_seats'   => $brunchSeats,
        ':dietary_notes'  => $dietaryNotes !== '' ? $dietaryNotes : null,
    ]);

    $id = (int)$pdo->lastInsertId();

    send_json([
        'ok' => true,
        'message' => 'ISCRIZIONE REGISTRATA NEL POKÉDEX DEL TORNEO!',
        'player' => [
            'id'             => $id,
            'full_name'      => $fullName,
            'phone'          => $phone,
            'activity'       => $activity,
            'padel_category' => $padelCategory,
            'partner_name'   => $partnerName !== '' ? $partnerName : 'CERCA PARTNER',
            'join_brunch'    => (bool)$joinBrunch,
            'brunch_seats'   => $brunchSeats,
            'dietary_notes'  => $dietaryNotes,
        ]
    ]);
} catch (Throwable $e) {
    send_json(['ok' => false, 'error' => 'Errore salvataggio DB: ' . $e->getMessage()], 500);
}
