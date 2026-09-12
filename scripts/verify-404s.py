#!/usr/bin/env python3
"""Check which logged 404s are still broken, by asking the live site.

The `page_misses` table records every 404 a visitor hit, but a row only
says a path failed *once, in the past*. Paths get fixed — a draft is
published, a redirect is added, an endpoint learns to resolve nested
paths — and the old rows stay behind. Acting on the log alone means
proposing redirects for routes that already work, which is how you end
up shadowing a live feature with a redirect.

So this asks the site instead of guessing. It reads the log, normalises
and de-duplicates the paths, requests each one, and reports what the
server actually says today. The result is JSON on stdout: the facts,
for a human or an agent to act on.

Pure stdlib — talks to Turso over its HTTP pipeline API, same as
page-misses-report.py. Read-only: it never writes to the database.

Usage:
  python3 scripts/verify-404s.py                     # reads .env
  python3 scripts/verify-404s.py --base https://deploy-preview-107--quinacare.netlify.app
  python3 scripts/verify-404s.py --include-bots --jobs 16
  python3 scripts/verify-404s.py --out /tmp/404s.json
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

DEFAULT_BASE = "https://quinacare.org"

# Referrers that mean someone's dev machine, not a visitor.
LOCAL_REFERRER = re.compile(r"localhost|127\.0\.0\.1|0\.0\.0\.0|\.local")

# Paths that are never a content problem: build artefacts, feeds the old
# WordPress site served, and probes for software we do not run.
NOISE = re.compile(
    r"""^/(?:_astro/|wp-admin|wp-login|wp-content/plugins|xmlrpc\.php|go\.php)
        |/feed/?$|/comments/feed/?$|\.(?:php|aspx|env|git)$""",
    re.X,
)


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", help="Turso database URL (libsql:// or https://)")
    p.add_argument("--token", help="Turso auth token")
    p.add_argument("--base", default=DEFAULT_BASE, help=f"site to probe (default {DEFAULT_BASE})")
    p.add_argument("--include-bots", action="store_true", help="include rows flagged as bot traffic")
    p.add_argument("--include-noise", action="store_true", help="include feeds, wp-* probes and build artefacts")
    p.add_argument("--jobs", type=int, default=8, help="parallel requests (default 8)")
    p.add_argument("--timeout", type=int, default=20, help="per-request timeout in seconds")
    p.add_argument(
        "--snapshot",
        help="read rows from a JSON file (e.g. /tmp/404-snapshot.json) instead of Turso, "
        "so a cleared log can still be checked and a run can be reproduced",
    )
    p.add_argument("--out", help="write JSON here instead of stdout")
    return p.parse_args()


def load_env(path=".env"):
    env = {}
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env


# --- Turso ----------------------------------------------------------------


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


def execute(url, token, sql):
    if url.startswith("libsql://"):
        url = "https://" + url[len("libsql://") :]
    payload = json.dumps(
        {"requests": [{"type": "execute", "stmt": {"sql": sql}}, {"type": "close"}]}
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{url.rstrip('/')}/v2/pipeline",
        data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
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


# --- normalising ----------------------------------------------------------


def normalise(path):
    """One canonical form per route, so the same page is probed once.

    Drops the query string and fragment, decodes percent-escapes so
    /es/campa%C3%B1as and /es/campañas collapse together, and strips the
    trailing slash (the site redirects to add it back).
    """
    if not path:
        return None
    path = path.split("#", 1)[0].split("?", 1)[0]
    if not path.startswith("/"):
        return None
    try:
        path = urllib.parse.unquote(path)
    except Exception:
        pass
    path = re.sub(r"/{2,}", "/", path)
    return path.rstrip("/") or "/"


# --- probing --------------------------------------------------------------


def probe(base, path, timeout):
    """GET the path and report what the server says, following redirects."""
    url = base.rstrip("/") + urllib.parse.quote(path, safe="/:@&=+$,~*!'()")
    req = urllib.request.Request(
        url,
        method="GET",
        headers={"User-Agent": "quinacare-404-check/1.0 (+repo scripts/verify-404s.py)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            final = resp.geturl()
            return {
                "status": resp.status,
                "final_url": final,
                "redirected": urllib.parse.urlparse(final).path.rstrip("/") != path.rstrip("/"),
                "content_type": resp.headers.get("Content-Type", "").split(";")[0] or None,
            }
    except urllib.error.HTTPError as e:
        return {
            "status": e.code,
            "final_url": e.url,
            "redirected": False,
            "content_type": (e.headers.get("Content-Type", "") or "").split(";")[0] or None,
        }
    except urllib.error.URLError as e:
        return {"status": None, "final_url": None, "redirected": False, "error": str(e.reason)}


def main():
    args = parse_args()
    if args.snapshot:
        with open(args.snapshot, encoding="utf-8") as fh:
            rows = json.load(fh)
    else:
        env = load_env()
        url = args.url or os.environ.get("TURSO_DATABASE_URL") or env.get("TURSO_DATABASE_URL")
        token = args.token or os.environ.get("TURSO_AUTH_TOKEN") or env.get("TURSO_AUTH_TOKEN")
        if not url or not token:
            raise SystemExit("Turso not configured: set TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (.env or flags).")
        rows = execute(
            url,
            token,
            "SELECT path, referrer, user_agent, is_bot, created_at FROM page_misses",
        )

    # Fold the raw rows into one entry per canonical path.
    seen = {}
    skipped = {"local": 0, "bot": 0, "noise": 0, "unusable": 0}
    for r in rows:
        if LOCAL_REFERRER.search(r.get("referrer") or ""):
            skipped["local"] += 1
            continue
        if r.get("is_bot") and not args.include_bots:
            skipped["bot"] += 1
            continue
        path = normalise(r.get("path"))
        if not path:
            skipped["unusable"] += 1
            continue
        if NOISE.search(path) and not args.include_noise:
            skipped["noise"] += 1
            continue
        e = seen.setdefault(path, {"path": path, "hits": 0, "first_seen": None, "last_seen": None})
        e["hits"] += 1
        ts = r.get("created_at")
        if ts:
            if not e["first_seen"] or ts < e["first_seen"]:
                e["first_seen"] = ts
            if not e["last_seen"] or ts > e["last_seen"]:
                e["last_seen"] = ts

    entries = sorted(seen.values(), key=lambda e: (-e["hits"], e["path"]))

    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        results = list(pool.map(lambda e: probe(args.base, e["path"], args.timeout), entries))
    for e, res in zip(entries, results):
        e.update(res)

    broken = [e for e in entries if e.get("status") != 200]
    fixed = [e for e in entries if e.get("status") == 200]

    out = {
        "base": args.base,
        "source": args.snapshot or "turso:page_misses",
        "rows_in_log": len(rows),
        "skipped": skipped,
        "distinct_paths_checked": len(entries),
        "still_broken": len(broken),
        "already_working": len(fixed),
        "broken": broken,
        "working": fixed,
    }
    text = json.dumps(out, indent=2, ensure_ascii=False)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
        print(
            f"{len(entries)} distinct paths checked against {args.base}: "
            f"{len(broken)} still broken, {len(fixed)} already working -> {args.out}",
            file=sys.stderr,
        )
    else:
        print(text)


if __name__ == "__main__":
    main()
