<?php
/**
 * GET / POST /api/stats.php
 * Admin statistics, CSV export, and record deletion.
 */
declare(strict_types=1);
require_once __DIR__ . '/db.php';

session_start();

const ADMIN_PASSWORDS = ['PADEL2026', 'GBCPADEL2026'];

$providedKey = $_GET['key'] ?? $_POST['key'] ?? ($_SERVER['HTTP_X_ADMIN_KEY'] ?? '');
$isAuthed = !empty($_SESSION['rebrunch_admin_authed']) || in_array($providedKey, ADMIN_PASSWORDS, true);

if (!$isAuthed) {
    send_json(['ok' => false, 'error' => 'ACCESSO NEGATO. Password Admin richiesta.'], 401);
}

try {
    $pdo = get_db();

    // Handle delete action
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    if ($action === 'delete_registration') {
        $id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id > 0) {
            $stmt = $pdo->prepare("DELETE FROM registrations WHERE id = :id");
            $stmt->execute([':id' => $id]);
        }
        send_json(['ok' => true, 'deleted_id' => $id]);
    }
    if ($action === 'delete_match') {
        $id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id > 0) {
            $stmt = $pdo->prepare("DELETE FROM matches WHERE id = :id");
            $stmt->execute([':id' => $id]);
        }
        send_json(['ok' => true, 'deleted_id' => $id]);
    }

    $registrations = $pdo->query("
        SELECT * FROM registrations ORDER BY id DESC
    ")->fetchAll();

    // Handle CSV export
    if (($_GET['export'] ?? '') === 'csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="rebrunch_iscrizioni_' . date('Y-m-d_His') . '.csv"');
        $out = fopen('php://output', 'w');
        // UTF-8 BOM for Excel compatibility
        fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, [
            'ID', 'Nome e Cognome', 'Telefono', 'Attività', 'Categoria Padel',
            'Partner Padel', 'Partecipa Brunch', 'Posti Brunch', 'Note / Intolleranze', 'Data Iscrizione'
        ]);
        foreach ($registrations as $r) {
            fputcsv($out, [
                $r['id'],
                $r['full_name'],
                $r['phone'],
                $r['activity'],
                $r['padel_category'] ?? '-',
                $r['partner_name'] ?: ($r['activity'] === 'padel' ? 'CERCA PARTNER' : '-'),
                $r['join_brunch'] ? 'SI' : 'NO',
                $r['brunch_seats'],
                $r['dietary_notes'] ?? '',
                $r['created_at']
            ]);
        }
        fclose($out);
        exit;
    }

    $matches = $pdo->query("
        SELECT * FROM matches ORDER BY id DESC LIMIT 100
    ")->fetchAll();

    // Compute aggregate counters
    $counts = [
        'total_registrations' => count($registrations),
        'padel_total'         => 0,
        'padel_maschile'      => 0,
        'padel_femminile'     => 0,
        'padel_misto'         => 0,
        'padel_seeking_partner' => 0,
        'tennis_total'        => 0,
        'brunch_only_total'   => 0,
        'brunch_total_seats'  => 0,
        'matches_played'      => count($matches),
    ];

    foreach ($registrations as $r) {
        if ($r['activity'] === 'padel') {
            $counts['padel_total']++;
            if ($r['padel_category'] === 'Maschile') $counts['padel_maschile']++;
            elseif ($r['padel_category'] === 'Femminile') $counts['padel_femminile']++;
            else $counts['padel_misto']++;

            if (empty(trim((string)$r['partner_name']))) {
                $counts['padel_seeking_partner']++;
            }
        } elseif ($r['activity'] === 'tennis') {
            $counts['tennis_total']++;
        } elseif ($r['activity'] === 'brunch_only') {
            $counts['brunch_only_total']++;
        }

        if (!empty($r['join_brunch'])) {
            $counts['brunch_total_seats'] += (int)$r['brunch_seats'];
        }
    }

    send_json([
        'ok'            => true,
        'counts'        => $counts,
        'registrations' => $registrations,
        'matches'       => $matches
    ]);
} catch (Throwable $e) {
    send_json(['ok' => false, 'error' => $e->getMessage()], 500);
}
