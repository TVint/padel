#!/usr/bin/env python3
"""
REBRUNCH // Republic Sport Village - Local HTTP + SQLite Server
Provides seamless local execution on macOS when PHP CLI is not installed,
using the exact same `database/event.sqlite` database schema as the PHP 8 endpoints.
"""
import csv
import io
import json
import os
import sqlite3
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE_DIR, "database")
DB_PATH = os.path.join(DB_DIR, "event.sqlite")
ADMIN_PASSWORDS = {"PADEL2026", "GBCPADEL2026"}


def get_db() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
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
        """
    )
    conn.commit()
    return conn


class RebrunchHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _send_json(self, payload: dict, status: int = 200):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(raw)

    def _read_body_data(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                return data
        except Exception:
            pass
        parsed = parse_qs(raw)
        return {k: v[0] for k, v in parsed.items()}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = {k: v[0] for k, v in parse_qs(parsed.query).items()}

        if path == "/admin.php":
            self._serve_admin_html()
            return
        if path == "/api/save_match.php":
            self._handle_save_match(is_post=False)
            return
        if path == "/api/stats.php":
            self._handle_stats(qs)
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = {k: v[0] for k, v in parse_qs(parsed.query).items()}

        if path == "/api/register.php":
            self._handle_register()
            return
        if path == "/api/save_match.php":
            self._handle_save_match(is_post=True)
            return
        if path == "/api/stats.php":
            self._handle_stats(qs)
            return

        self._send_json({"ok": False, "error": "Endpoint non trovato"}, 404)

    def _serve_admin_html(self):
        admin_path = os.path.join(BASE_DIR, "admin.php")
        with open(admin_path, "r", encoding="utf-8") as f:
            content = f.read()
        # Strip top PHP declaration block so browser renders pure HTML/JS
        if content.startswith("<?php"):
            end_idx = content.find("?>")
            if end_idx != -1:
                content = content[end_idx + 2 :].lstrip()
        raw = content.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _handle_register(self):
        data = self._read_body_data()
        full_name = str(data.get("full_name", "")).strip()
        phone = str(data.get("phone", "")).strip()
        activity = str(data.get("activity", "padel")).strip()
        padel_category = str(data.get("padel_category", "")).strip()
        partner_name = str(data.get("partner_name", "")).strip()
        raw_brunch = data.get("join_brunch", False)
        join_brunch = 1 if raw_brunch and str(raw_brunch).lower() not in ("0", "no", "false") else 0
        try:
            brunch_seats = max(1, min(5, int(data.get("brunch_seats", 1) or 1))) if join_brunch else 0
        except ValueError:
            brunch_seats = 1 if join_brunch else 0
        dietary_notes = str(data.get("dietary_notes", "")).strip() if join_brunch else ""

        if not full_name or not phone:
            self._send_json({"ok": False, "error": "Inserisci Nome, Cognome e Telefono!"}, 422)
            return

        if activity not in ("padel", "tennis", "brunch_only"):
            activity = "padel"

        if activity == "padel":
            if padel_category not in ("Maschile", "Femminile", "Misto"):
                padel_category = "Misto"
        else:
            padel_category = None
            partner_name = ""

        if activity == "brunch_only" and not join_brunch:
            join_brunch = 1
            brunch_seats = max(1, brunch_seats or 1)

        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO registrations (
                full_name, phone, activity, padel_category, partner_name,
                join_brunch, brunch_seats, dietary_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                full_name,
                phone,
                activity,
                padel_category,
                partner_name if partner_name else None,
                join_brunch,
                brunch_seats,
                dietary_notes if dietary_notes else None,
            ),
        )
        conn.commit()
        new_id = cur.lastrowid
        conn.close()

        self._send_json(
            {
                "ok": True,
                "message": "ISCRIZIONE REGISTRATA NEL POKÉDEX DEL TORNEO!",
                "player": {
                    "id": new_id,
                    "full_name": full_name,
                    "phone": phone,
                    "activity": activity,
                    "padel_category": padel_category,
                    "partner_name": partner_name if partner_name else "CERCA PARTNER",
                    "join_brunch": bool(join_brunch),
                    "brunch_seats": brunch_seats,
                    "dietary_notes": dietary_notes,
                },
            }
        )

    def _handle_save_match(self, is_post: bool):
        conn = get_db()
        cur = conn.cursor()
        if is_post:
            data = self._read_body_data()
            player_name = str(data.get("player_name", "ALLENATORE PADEL")).strip() or "ALLENATORE PADEL"
            opponent_name = str(data.get("opponent_name", "PRO CPU DUO")).strip() or "PRO CPU DUO"
            try:
                player_score = max(0, min(99, int(data.get("player_score", 0))))
            except ValueError:
                player_score = 0
            try:
                cpu_score = max(0, min(99, int(data.get("cpu_score", 0))))
            except ValueError:
                cpu_score = 0
            won = 1 if player_score > cpu_score else 0

            cur.execute(
                """
                INSERT INTO matches (player_name, opponent_name, player_score, cpu_score, won)
                VALUES (?, ?, ?, ?, ?)
                """,
                (player_name, opponent_name, player_score, cpu_score, won),
            )
            conn.commit()

        rows = cur.execute(
            """
            SELECT id, player_name, opponent_name, player_score, cpu_score, won, created_at
            FROM matches
            ORDER BY won DESC, (player_score - cpu_score) DESC, player_score DESC, id DESC
            LIMIT 25
            """
        ).fetchall()
        conn.close()
        self._send_json({"ok": True, "leaderboard": [dict(r) for r in rows]})

    def _handle_stats(self, qs: dict):
        body = self._read_body_data() if self.command == "POST" else {}
        key = qs.get("key") or body.get("key") or self.headers.get("X-Admin-Key", "")
        if key not in ADMIN_PASSWORDS:
            self._send_json({"ok": False, "error": "ACCESSO NEGATO. Password Admin richiesta."}, 401)
            return

        conn = get_db()
        cur = conn.cursor()

        action = qs.get("action") or body.get("action") or ""
        if action == "delete_registration":
            rec_id = int(qs.get("id") or body.get("id") or 0)
            if rec_id > 0:
                cur.execute("DELETE FROM registrations WHERE id = ?", (rec_id,))
                conn.commit()
            conn.close()
            self._send_json({"ok": True, "deleted_id": rec_id})
            return

        if action == "delete_match":
            rec_id = int(qs.get("id") or body.get("id") or 0)
            if rec_id > 0:
                cur.execute("DELETE FROM matches WHERE id = ?", (rec_id,))
                conn.commit()
            conn.close()
            self._send_json({"ok": True, "deleted_id": rec_id})
            return

        registrations = [dict(r) for r in cur.execute("SELECT * FROM registrations ORDER BY id DESC").fetchall()]

        if qs.get("export") == "csv":
            conn.close()
            out = io.StringIO()
            out.write("\ufeff")
            writer = csv.writer(out)
            writer.writerow([
                "ID", "Nome e Cognome", "Telefono", "Attività", "Categoria Padel",
                "Partner Padel", "Partecipa Brunch", "Posti Brunch", "Note / Intolleranze", "Data Iscrizione"
            ])
            for r in registrations:
                writer.writerow([
                    r["id"],
                    r["full_name"],
                    r["phone"],
                    r["activity"],
                    r["padel_category"] or "-",
                    r["partner_name"] or ("CERCA PARTNER" if r["activity"] == "padel" else "-"),
                    "SI" if r["join_brunch"] else "NO",
                    r["brunch_seats"],
                    r["dietary_notes"] or "",
                    r["created_at"],
                ])
            raw_csv = out.getvalue().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="rebrunch_iscrizioni.csv"')
            self.send_header("Content-Length", str(len(raw_csv)))
            self.end_headers()
            self.wfile.write(raw_csv)
            return

        matches = [dict(m) for m in cur.execute("SELECT * FROM matches ORDER BY id DESC LIMIT 100").fetchall()]
        conn.close()

        counts = {
            "total_registrations": len(registrations),
            "padel_total": 0,
            "padel_maschile": 0,
            "padel_femminile": 0,
            "padel_misto": 0,
            "padel_seeking_partner": 0,
            "tennis_total": 0,
            "brunch_only_total": 0,
            "brunch_total_seats": 0,
            "matches_played": len(matches),
        }

        for r in registrations:
            act = r["activity"]
            if act == "padel":
                counts["padel_total"] += 1
                cat = r["padel_category"]
                if cat == "Maschile":
                    counts["padel_maschile"] += 1
                elif cat == "Femminile":
                    counts["padel_femminile"] += 1
                else:
                    counts["padel_misto"] += 1
                if not (r["partner_name"] or "").strip():
                    counts["padel_seeking_partner"] += 1
            elif act == "tennis":
                counts["tennis_total"] += 1
            elif act == "brunch_only":
                counts["brunch_only_total"] += 1

            if r["join_brunch"]:
                counts["brunch_total_seats"] += int(r["brunch_seats"] or 0)

        self._send_json(
            {
                "ok": True,
                "counts": counts,
                "registrations": registrations,
                "matches": matches,
            }
        )


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    get_db().close()
    server = ThreadingHTTPServer(("127.0.0.1", port), RebrunchHandler)
    print(f"REBRUNCH GBC Server active on http://localhost:{port}")
    server.serve_forever()
