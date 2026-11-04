#!/usr/bin/env python3
"""
Local Dev Server that serves static files + executes the SQLite backend endpoints
(api/save_match.php, api/click.php, api/stats.php, admin.php) against database/event.sqlite
so the refactored advergame can be tested locally even when the PHP CLI binary is not installed.
"""
import csv
import html
import io
import json
import os
import re
import sqlite3
from datetime import datetime
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse, urlencode

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(ROOT, "database")
DB_PATH = os.path.join(DB_DIR, "event.sqlite")
SESSIONS = set()


def get_db():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Drop legacy tables
    cur.execute("DROP TABLE IF EXISTS registrations;")
    cur.execute("DROP TABLE IF EXISTS matches;")

    # Create leaderboard table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL DEFAULT 0,
            date TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );
    """)

    # Create click_stats table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS click_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            area_clicked TEXT UNIQUE NOT NULL,
            click_count INTEGER NOT NULL DEFAULT 0
        );
    """)

    for area in ("green_brunch", "red_aperitivo", "yellow_torneo", "play_game"):
        cur.execute(
            "INSERT OR IGNORE INTO click_stats (area_clicked, click_count) VALUES (?, 0)",
            (area,),
        )

    cur.execute("SELECT COUNT(*) FROM leaderboard")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO leaderboard (name, score, date) VALUES
            ('REP', 1250, datetime('now', 'localtime', '-2 hours')),
            ('MIR', 980, datetime('now', 'localtime', '-1 hour')),
            ('MAR', 840, datetime('now', 'localtime', '-30 minutes'));
        """)

    conn.commit()
    return conn


def rows_to_dicts(rows):
    return [dict(r) for r in rows]


class PadelHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        parsed = urlparse(path).path
        return os.path.join(ROOT, parsed.lstrip("/"))

    def send_json(self, data, status=200):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def read_body_json(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else ""
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except Exception:
            parsed = parse_qs(raw)
            return {k: v[0] for k, v in parsed.items()}

    def is_authed(self, query):
        if query.get("key", [""])[0] == "padel2026":
            return True
        cookie_hdr = self.headers.get("Cookie", "")
        c = cookies.SimpleCookie()
        c.load(cookie_hdr)
        sid = c.get("REBRUNCH_SID")
        return bool(sid and sid.value in SESSIONS)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/api/save_match.php":
            conn = get_db()
            rows = rows_to_dicts(
                conn.execute(
                    "SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC LIMIT 20"
                ).fetchall()
            )
            conn.close()
            return self.send_json({"ok": True, "leaderboard": rows})

        if path == "/api/click.php":
            conn = get_db()
            rows = rows_to_dicts(
                conn.execute(
                    "SELECT id, area_clicked, click_count FROM click_stats ORDER BY id ASC"
                ).fetchall()
            )
            conn.close()
            return self.send_json({"ok": True, "click_stats": rows})

        if path == "/api/stats.php":
            action = query.get("action", ["summary"])[0]
            conn = get_db()
            if action == "public":
                leaderboard = rows_to_dicts(
                    conn.execute(
                        "SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC LIMIT 15"
                    ).fetchall()
                )
                conn.close()
                return self.send_json({"ok": True, "leaderboard": leaderboard})

            if not self.is_authed(query):
                conn.close()
                return self.send_json({"ok": False, "error": "Non autorizzato"}, 401)

            if action == "export_csv":
                rows = rows_to_dicts(
                    conn.execute(
                        "SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC"
                    ).fetchall()
                )
                conn.close()
                buf = io.StringIO()
                buf.write("\ufeff")
                writer = csv.writer(buf)
                writer.writerow(["ID", "Giocatore", "Punteggio", "Data"])
                for r in rows:
                    writer.writerow([r["id"], r["name"], r["score"], r["date"]])
                raw = buf.getvalue().encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header(
                    "Content-Disposition",
                    'attachment; filename="rebrunch_leaderboard.csv"',
                )
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
                return

            date_filter = query.get("date", [""])[0].strip()
            if date_filter:
                leaderboard = rows_to_dicts(
                    conn.execute(
                        "SELECT id, name, score, date FROM leaderboard WHERE substr(date, 1, 10) = ? ORDER BY score DESC, id DESC",
                        (date_filter,),
                    ).fetchall()
                )
            else:
                leaderboard = rows_to_dicts(
                    conn.execute(
                        "SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC"
                    ).fetchall()
                )

            click_stats = rows_to_dicts(
                conn.execute(
                    "SELECT id, area_clicked, click_count FROM click_stats ORDER BY id ASC"
                ).fetchall()
            )
            conn.close()
            click_map = {
                "green_brunch": 0,
                "red_aperitivo": 0,
                "yellow_torneo": 0,
                "play_game": 0,
            }
            for r in click_stats:
                click_map[r["area_clicked"]] = int(r["click_count"])
            return self.send_json(
                {
                    "ok": True,
                    "leaderboard": leaderboard,
                    "click_stats": click_stats,
                    "click_map": click_map,
                }
            )

        if path == "/admin.php":
            if "logout" in query:
                SESSIONS.clear()
                self.send_response(302)
                self.send_header("Location", "admin.php")
                self.end_headers()
                return
            return self.render_admin(
                authed=self.is_authed(query),
                error="",
                date_filter=query.get("date", [""])[0].strip(),
            )

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        data = self.read_body_json()

        if path == "/api/save_match.php":
            raw_name = str(data.get("name", "AAA")).strip().upper()
            name = re.sub(r"[^A-Z0-9 _\-\.]", "", raw_name)[:12] or "AAA"
            try:
                score = max(0, int(data.get("score", 0)))
            except Exception:
                score = 0

            conn = get_db()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO leaderboard (name, score, date) VALUES (?, ?, datetime('now', 'localtime'))",
                (name, score),
            )
            entry_id = cur.lastrowid
            conn.commit()
            rows = rows_to_dicts(
                conn.execute(
                    "SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC LIMIT 20"
                ).fetchall()
            )
            conn.close()
            return self.send_json(
                {"ok": True, "entry_id": entry_id, "leaderboard": rows}
            )

        if path == "/api/click.php":
            area = str(data.get("area_clicked", "")).strip()
            allowed = ("green_brunch", "red_aperitivo", "yellow_torneo", "play_game")
            if area not in allowed:
                return self.send_json(
                    {"ok": False, "error": "Invalid area_clicked"}, 400
                )
            conn = get_db()
            conn.execute(
                """
                INSERT INTO click_stats (area_clicked, click_count)
                VALUES (?, 1)
                ON CONFLICT(area_clicked) DO UPDATE SET click_count = click_count + 1
                """,
                (area,),
            )
            conn.commit()
            rows = rows_to_dicts(
                conn.execute(
                    "SELECT id, area_clicked, click_count FROM click_stats ORDER BY id ASC"
                ).fetchall()
            )
            conn.close()
            return self.send_json(
                {"ok": True, "area_clicked": area, "click_stats": rows}
            )

        if path == "/api/stats.php":
            if not self.is_authed(query):
                return self.send_json({"ok": False, "error": "Non autorizzato"}, 401)
            action = query.get("action", [""])[0]
            if action == "delete_score":
                del_id = int(data.get("id", query.get("id", [0])[0]) or 0)
                conn = get_db()
                conn.execute("DELETE FROM leaderboard WHERE id = ?", (del_id,))
                conn.commit()
                conn.close()
                return self.send_json({"ok": True, "deleted_id": del_id})

        if path == "/admin.php":
            if "password" in data:
                if data.get("password") == "padel2026":
                    sid = "admin_ok"
                    SESSIONS.add(sid)
                    self.send_response(302)
                    self.send_header("Set-Cookie", f"REBRUNCH_SID={sid}; Path=/")
                    self.send_header("Location", "admin.php")
                    self.end_headers()
                    return
                else:
                    return self.render_admin(
                        authed=False, error="PASSWORD ERRATA! RIPROVA."
                    )
            if "delete_score_id" in data and self.is_authed(query):
                del_id = int(data["delete_score_id"])
                conn = get_db()
                conn.execute("DELETE FROM leaderboard WHERE id = ?", (del_id,))
                conn.commit()
                conn.close()
                date_q = query.get("date", [""])[0].strip()
                loc = f"admin.php?{urlencode({'date': date_q})}" if date_q else "admin.php"
                self.send_response(302)
                self.send_header("Location", loc)
                self.end_headers()
                return

        self.send_json({"ok": False, "error": "Not found"}, 404)

    def render_admin(self, authed=False, error="", date_filter=""):
        conn = get_db()
        if date_filter:
            leaderboard = rows_to_dicts(
                conn.execute(
                    "SELECT id, name, score, date FROM leaderboard WHERE substr(date, 1, 10) = ? ORDER BY score DESC, id DESC",
                    (date_filter,),
                ).fetchall()
            )
        else:
            leaderboard = rows_to_dicts(
                conn.execute(
                    "SELECT id, name, score, date FROM leaderboard ORDER BY score DESC, id DESC"
                ).fetchall()
            )

        click_rows = rows_to_dicts(
            conn.execute("SELECT area_clicked, click_count FROM click_stats").fetchall()
        )
        conn.close()

        click_map = {
            "green_brunch": 0,
            "red_aperitivo": 0,
            "yellow_torneo": 0,
            "play_game": 0,
        }
        total_clicks = 0
        for r in click_rows:
            c = int(r["click_count"])
            click_map[r["area_clicked"]] = c
            total_clicks += c

        if not authed:
            err_html = f'<div class="err">{html.escape(error)}</div>' if error else ""
            body = f"""
            <div class="login-box">
              <h2>🔒 ACCESSO ORGANIZZATORI</h2>
              {err_html}
              <form method="POST" action="admin.php">
                <input type="password" name="password" placeholder="PASSWORD ADMIN" required autofocus />
                <button type="submit" class="btn" style="width:100%;">ENTRA NELLA DASHBOARD</button>
              </form>
              <p style="font-size:7px; color:#64748b; margin-top:14px;">Password demo: padel2026</p>
            </div>
            """
            top_btns = '<a class="btn btn-blue" href="index.html">⬅ TORNA AL GAME BOY</a>'
        else:
            top_btns = """
              <a class="btn btn-blue" href="index.html">⬅ TORNA AL GAME BOY</a>
              <a class="btn" href="api/stats.php?action=export_csv">⬇ EXPORT CSV</a>
              <a class="btn btn-red" href="admin.php?logout=1">ESCI</a>
            """
            rows_html = ""
            if not leaderboard:
                rows_html = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:24px;">NESSUN PUNTEGGIO REGISTRATO PER QUESTA DATA.</td></tr>'
            else:
                action_url = f"admin.php?date={html.escape(date_filter)}" if date_filter else "admin.php"
                for idx, r in enumerate(leaderboard):
                    rows_html += f"""
                    <tr>
                      <td style="color:var(--gold);">#{idx + 1}</td>
                      <td>{r['id']}</td>
                      <td style="color:#fff; font-weight:bold;">{html.escape(str(r['name']))}</td>
                      <td><span class="badge-score">{int(r['score'])} PTS</span></td>
                      <td style="color:#94a3b8; font-size:8px;">{html.escape(str(r['date']))}</td>
                      <td>
                        <form method="POST" action="{action_url}" style="display:inline;">
                          <input type="hidden" name="delete_score_id" value="{r['id']}" />
                          <button type="submit" class="btn btn-red" style="padding:6px 10px; font-size:8px;">ELIMINA</button>
                        </form>
                      </td>
                    </tr>
                    """
            reset_btn = '<a href="admin.php" class="btn btn-red">RESET</a>' if date_filter else ""
            body = f"""
            <div class="admin-grid">
              <div class="panel">
                <h2>
                  <span>🔥 GBC CLICK HEATMAP</span>
                  <span style="font-size:8px; color:var(--border);">TOT: {total_clicks}</span>
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
                      <div class="heat-node heat-red" title="Pulsante Rosso (Aperitivo)">
                        <span class="count">{click_map['red_aperitivo']}</span>
                        <span class="lbl">APERITIVO</span>
                      </div>
                      <div class="heat-node heat-green" title="Pulsante Verde (Brunch)">
                        <span class="count">{click_map['green_brunch']}</span>
                        <span class="lbl">BRUNCH</span>
                      </div>
                      <div class="heat-node heat-yellow" title="Pulsante Giallo (Torneo)">
                        <span class="count">{click_map['yellow_torneo']}</span>
                        <span class="lbl">TORNEO</span>
                      </div>
                      <div class="heat-node heat-play" title="Tasto GIOCA">
                        <span class="count">🕹️ {click_map['play_game']}</span>
                        <span class="lbl">TASTO GIOCA</span>
                      </div>
                    </div>
                  </div>
                  <div class="click-legend">
                    <div class="legend-item"><span style="color:#4ade80;">🟢 BRUNCH</span><strong>{click_map['green_brunch']}</strong></div>
                    <div class="legend-item"><span style="color:#f87171;">🔴 APERITIVO</span><strong>{click_map['red_aperitivo']}</strong></div>
                    <div class="legend-item"><span style="color:#facc15;">🟡 TORNEO</span><strong>{click_map['yellow_torneo']}</strong></div>
                    <div class="legend-item"><span style="color:#fb923c;">🕹️ GIOCA</span><strong>{click_map['play_game']}</strong></div>
                  </div>
                </div>
              </div>

              <div class="panel">
                <h2><span>🏆 CLASSIFICA ADVERGAME ({len(leaderboard)})</span></h2>
                <form method="GET" action="admin.php" class="filter-bar">
                  <label for="filter-date">FILTRA PER DATA:</label>
                  <input type="date" id="filter-date" name="date" value="{html.escape(date_filter)}" />
                  <button type="submit" class="btn btn-blue">FILTRA</button>
                  {reset_btn}
                </form>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr><th>#</th><th>ID</th><th>GIOCATORE</th><th>PUNTEGGIO</th><th>DATA &amp; ORA</th><th>AZIONI</th></tr>
                    </thead>
                    <tbody>{rows_html}</tbody>
                  </table>
                </div>
              </div>
            </div>
            """

        page = f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ADMIN // REBRUNCH GBC ADVERGAME</title>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    :root {{ --bg:#0c0d14; --card:#16192b; --border:#38bdf8; --gold:#facc15; --green:#22c55e; --red:#ef4444; --text:#f8fafc; --muted:#94a3b8; }}
    * {{ box-sizing:border-box; margin:0; padding:0; }}
    body {{ background:radial-gradient(circle at top, #1e1b4b 0%, #090a10 100%); color:var(--text); font-family:'Press Start 2P', monospace; min-height:100vh; padding:24px 16px 60px; line-height:1.5; }}
    .container {{ max-width:1180px; margin:0 auto; }}
    .top-bar {{ display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; padding:16px 20px; background:var(--card); border:4px solid var(--gold); box-shadow:0 6px 0 #000; margin-bottom:24px; }}
    .top-bar h1 {{ font-size:13px; color:var(--gold); }}
    .top-bar .sub {{ font-size:8px; color:var(--border); margin-top:4px; }}
    .btn {{ display:inline-block; font-family:'Press Start 2P', monospace; font-size:9px; padding:10px 14px; background:var(--green); color:#052e16; border:3px solid #fff; text-decoration:none; cursor:pointer; box-shadow:0 4px 0 #000; }}
    .btn-red {{ background:var(--red); color:#fff; }}
    .btn-blue {{ background:var(--border); color:#082f49; }}
    .login-box {{ max-width:420px; margin:80px auto; background:var(--card); border:4px solid var(--gold); padding:28px 24px; text-align:center; box-shadow:0 10px 0 #000; }}
    .login-box h2 {{ font-size:12px; color:var(--gold); margin-bottom:16px; }}
    .login-box input {{ width:100%; padding:12px; font-family:'Press Start 2P', monospace; font-size:10px; background:#090a10; color:#fff; border:3px solid var(--border); margin-bottom:16px; text-align:center; }}
    .err {{ color:var(--red); font-size:9px; margin-bottom:12px; }}
    .admin-grid {{ display:grid; grid-template-columns:380px 1fr; gap:24px; align-items:start; }}
    @media (max-width: 920px) {{ .admin-grid {{ grid-template-columns:1fr; }} }}
    .panel {{ background:var(--card); border:4px solid #334155; padding:18px; box-shadow:0 6px 0 #000; }}
    .panel h2 {{ font-size:11px; color:var(--gold); margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; }}
    .gbc-heatmap-wrap {{ display:flex; flex-direction:column; align-items:center; gap:14px; }}
    .gbc-mini-shell {{ position:relative; width:280px; height:450px; background:linear-gradient(165deg, #fbbf24 0%, #f59e0b 55%, #d97706 100%); border-radius:18px 18px 42px 18px; border:5px solid #1e293b; box-shadow:inset 0 4px 0 rgba(255,255,255,0.45), 0 10px 0 #000; padding:16px; }}
    .gbc-mini-lens {{ background:#1e293b; border-radius:10px 10px 24px 10px; padding:12px; border:3px solid #0f172a; }}
    .gbc-mini-lcd {{ background:#0f380f; border:3px solid #000; height:155px; border-radius:4px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:8px; color:#9bbc0f; }}
    .gbc-mini-lcd .lcd-title {{ font-size:9px; color:#facc15; margin-bottom:6px; }}
    .gbc-mini-lcd .lcd-sub {{ font-size:7px; color:#8bac0f; line-height:1.6; }}
    .gbc-mini-brand {{ text-align:center; font-size:8px; color:#1e293b; margin-top:8px; letter-spacing:1px; }}
    .gbc-mini-controls {{ position:relative; height:210px; margin-top:10px; }}
    .mini-dpad {{ position:absolute; left:14px; top:34px; width:68px; height:68px; }}
    .mini-dpad::before, .mini-dpad::after {{ content:''; position:absolute; background:#1e293b; border:2px solid #000; border-radius:3px; }}
    .mini-dpad::before {{ left:22px; top:0; width:24px; height:68px; }}
    .mini-dpad::after {{ left:0; top:22px; width:68px; height:24px; }}
    .heat-node {{ position:absolute; display:flex; flex-direction:column; align-items:center; justify-content:center; border:3px solid #fff; color:#fff; font-size:8px; text-shadow:1px 1px 0 #000; box-shadow:0 4px 0 #000; }}
    .heat-node .count {{ font-size:10px; font-weight:bold; color:#fff; }}
    .heat-node .lbl {{ font-size:6px; margin-top:2px; color:#f8fafc; }}
    .heat-red {{ right:12px; top:16px; width:54px; height:54px; border-radius:50%; background:#ef4444; box-shadow:0 0 18px rgba(239,68,68,0.85), 0 4px 0 #000; }}
    .heat-green {{ right:74px; top:40px; width:54px; height:54px; border-radius:50%; background:#22c55e; box-shadow:0 0 18px rgba(34,197,94,0.85), 0 4px 0 #000; }}
    .heat-yellow {{ right:36px; top:86px; width:54px; height:54px; border-radius:50%; background:#eab308; box-shadow:0 0 18px rgba(234,179,8,0.85), 0 4px 0 #000; }}
    .heat-play {{ left:50%; bottom:12px; transform:translateX(-50%); width:156px; height:40px; border-radius:10px; background:linear-gradient(180deg, #ef4444 0%, #991b1b 100%); box-shadow:0 0 20px rgba(239,68,68,0.9), 0 4px 0 #000; }}
    .click-legend {{ width:100%; display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:8px; }}
    .legend-item {{ background:#0f172a; border:2px solid #334155; padding:8px; display:flex; justify-content:space-between; align-items:center; }}
    .filter-bar {{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:16px; background:#0f172a; padding:12px; border:2px solid #334155; }}
    .filter-bar label {{ font-size:8px; color:var(--muted); }}
    .filter-bar input[type="date"] {{ font-family:'Press Start 2P', monospace; font-size:9px; padding:8px 10px; background:#16192b; color:#fff; border:2px solid var(--border); }}
    .table-wrap {{ overflow-x:auto; }}
    table {{ width:100%; border-collapse:collapse; font-size:9px; }}
    th, td {{ padding:12px 10px; border-bottom:2px solid #1e293b; text-align:left; }}
    th {{ background:#090a10; color:var(--border); font-size:8px; }}
    .badge-score {{ display:inline-block; padding:4px 8px; background:#052e16; color:#4ade80; border:2px solid #22c55e; font-size:9px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="top-bar">
      <div>
        <h1>🕹️ REBRUNCH // ADMIN &amp; CLICK HEATMAP</h1>
        <div class="sub">REPUBLIC SPORT VILLAGE - PADEL ADVERGAME ANALYTICS</div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">{top_btns}</div>
    </div>
    {body}
  </div>
</body>
</html>"""
        raw = page.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


if __name__ == "__main__":
    get_db().close()
    server = ThreadingHTTPServer(("0.0.0.0", 8000), PadelHandler)
    print("Serving REBRUNCH GBC Advergame on http://localhost:8000")
    server.serve_forever()
