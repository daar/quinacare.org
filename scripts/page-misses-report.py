#!/usr/bin/env python3
"""
Top 404 paths from the Quina Care page_misses table.

Pure stdlib — talks to Turso over its HTTP pipeline API, no
pip install required.

Usage:
  python page-misses-report.py [--since YYYY-MM-DD]
                               [--limit N]
                               [--include-bots]

Credentials (CLI flags win; otherwise env):
  --url URL       Turso database URL (libsql:// or https://)
  --token TOKEN   Turso auth token
  TURSO_DATABASE_URL / TURSO_AUTH_TOKEN environment variables

Default scope: human traffic, last 30 days, top 50 paths.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone


def parse_args():
    p = argparse.ArgumentParser(description="Top 404 paths")
    p.add_argument("--url", help="Turso database URL (or TURSO_DATABASE_URL env)")
    p.add_argument("--token", help="Turso auth token (or TURSO_AUTH_TOKEN env)")
    p.add_argument(
        "--since",
        help="Only include hits on/after this ISO date (default: last 30 days)",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Top N paths to show (default: 50)",
    )
    p.add_argument(
        "--include-bots",
        action="store_true",
        help="Also show the top bot-tagged paths in a separate table",
    )
    return p.parse_args()


def _typed_arg(a):
    if a is None:
        return {"type": "null", "value": None}
    if isinstance(a, int):
        return {"type": "integer", "value": str(a)}
    return {"type": "text", "value": str(a)}


def _parse_cell(cell):
    t = cell.get("type")
    if t == "null":
        return None
    v = cell.get("value")
    if t == "integer":
        return int(v)
    if t in ("float", "real"):
        return float(v)
    return v


def execute(url, token, sql, args=None):
    if url.startswith("libsql://"):
        url = "https://" + url[len("libsql://") :]
    payload = json.dumps(
        {
            "requests": [
                {
                    "type": "execute",
                    "stmt": {"sql": sql, "args": [_typed_arg(a) for a in (args or [])]},
                },
                {"type": "close"},
            ]
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{url.rstrip('/')}/v2/pipeline",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Turso HTTP {e.code}: {e.read().decode('utf-8', 'replace')}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Turso connection failed: {e.reason}")
    res = data["results"][0]
    if res.get("type") == "error":
        raise SystemExit(f"Turso error: {res.get('error', {}).get('message', res)}")
    cols = [c["name"] for c in res["response"]["result"]["cols"]]
    return [
        {cols[i]: _parse_cell(r[i]) for i in range(len(cols))}
        for r in res["response"]["result"]["rows"]
    ]


def top_paths(url, token, since, limit, is_bot):
    rows = execute(
        url,
        token,
        """
        SELECT path,
               COUNT(*) AS hits,
               COUNT(DISTINCT user_agent) AS distinct_ua,
               MAX(created_at) AS last_seen
        FROM page_misses
        WHERE created_at >= ? AND is_bot = ?
        GROUP BY path
        ORDER BY hits DESC
        LIMIT ?
        """,
        [since, 1 if is_bot else 0, limit],
    )
    return rows


def fmt_table(title, rows):
    out = [title, "=" * len(title), ""]
    if not rows:
        out.append("  (none)")
        return "\n".join(out)
    out.append(
        f"  {'hits':>6}  {'UAs':>4}  {'last seen':<19}  path",
    )
    out.append(f"  {'-' * 6}  {'-' * 4}  {'-' * 19}  {'-' * 60}")
    for r in rows:
        out.append(
            f"  {r['hits']:>6}  {r['distinct_ua']:>4}  "
            f"{(r['last_seen'] or '')[:19]:<19}  {r['path']}"
        )
    return "\n".join(out)


def main():
    args = parse_args()
    url = args.url or os.environ.get("TURSO_DATABASE_URL")
    token = args.token or os.environ.get("TURSO_AUTH_TOKEN")
    if not url or not token:
        sys.exit("missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN")

    if args.since:
        since = args.since
    else:
        since = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")

    print(f"Quina Care 404 report — since {since} UTC\n")

    humans = top_paths(url, token, since, args.limit, is_bot=False)
    print(fmt_table(f"Top {args.limit} 404s (human traffic)", humans))

    if args.include_bots:
        print()
        bots = top_paths(url, token, since, args.limit, is_bot=True)
        print(fmt_table(f"Top {args.limit} 404s (bot traffic)", bots))


if __name__ == "__main__":
    main()
