#!/usr/bin/env python3
"""
Quina Care donations funnel report.

Pulls every donation and its donation_events audit trail from the
Turso production database, classifies the funnel state and fault path
of each payment, and prints a readable report.

Pure stdlib — talks to Turso over its HTTP pipeline API, no
pip install required.

Usage:
  python donations-report.py [--since YYYY-MM-DD] [--until YYYY-MM-DD]
                             [--format text|json] [--verbose]

Credentials (CLI flags win; otherwise env):
  --url URL       Turso database URL (libsql:// or https://)
  --token TOKEN   Turso auth token
  TURSO_DATABASE_URL / TURSO_AUTH_TOKEN environment variables
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone


def parse_args():
    p = argparse.ArgumentParser(
        description="Quina Care donations funnel report",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--url", help="Turso database URL (or TURSO_DATABASE_URL env)")
    p.add_argument("--token", help="Turso auth token (or TURSO_AUTH_TOKEN env)")
    p.add_argument(
        "--since",
        help="Only include donations created on/after this ISO date or datetime (UTC)",
    )
    p.add_argument(
        "--until",
        help="Only include donations created on/before this ISO date or datetime (UTC)",
    )
    p.add_argument(
        "--from-id",
        dest="from_id",
        type=int,
        help="Only include donations with id >= N (overrides nothing else; combines with --since/--until)",
    )
    p.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text)",
    )
    p.add_argument(
        "--verbose",
        action="store_true",
        help="Include per-donation event timelines in the text report",
    )
    return p.parse_args()


# ---------------------------------------------------------------------------
# Turso HTTP pipeline client (Hrana v2)
# ---------------------------------------------------------------------------


def _typed_arg(a):
    if a is None:
        return {"type": "null", "value": None}
    if isinstance(a, bool):
        return {"type": "integer", "value": "1" if a else "0"}
    if isinstance(a, int):
        return {"type": "integer", "value": str(a)}
    if isinstance(a, float):
        return {"type": "float", "value": a}
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
    return v  # text / blob / other — leave as-is


def execute(url, token, sql, args=None):
    """Run a single statement, return list[dict] of rows."""
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
        body = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Turso HTTP {e.code}: {body}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Turso connection failed: {e.reason}")

    results = data.get("results") or []
    if not results:
        raise SystemExit(f"unexpected Turso response: {data}")
    first = results[0]
    if first.get("type") == "error":
        msg = first.get("error", {}).get("message") or str(first)
        raise SystemExit(f"Turso error: {msg}")
    res = first["response"]["result"]
    cols = [c["name"] for c in res["cols"]]
    return [{cols[i]: _parse_cell(r[i]) for i in range(len(cols))} for r in res["rows"]]


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------


def classify(donation, events):
    """Return (state, fault_path) for a donation given its event timeline."""
    status = donation.get("status")
    types = {e["event_type"] for e in events}

    if status == "paid":
        return ("paid", "completed")
    if status == "failed":
        return ("failed", "payment_failed")
    if status == "canceled":
        if "checkout_redirected" in types:
            return ("canceled", "user_canceled_at_mollie")
        return ("canceled", "canceled_before_redirect")
    if status == "expired":
        if "return_page_loaded" in types:
            return ("expired", "expired_after_return")
        if "checkout_redirected" in types:
            return ("expired", "expired_at_checkout")
        return ("expired", "expired_before_redirect")

    # Still pending — pinpoint how far the funnel got.
    has_mollie_id = bool(donation.get("mollie_id"))
    if "mollie_payment_failed" in types:
        return ("pending", "mollie_create_failed")
    if not has_mollie_id:
        return ("pending", "no_mollie_id_recorded")
    if not types:
        # Row predates the donation_events table — no funnel signal.
        return ("pending", "pre_instrumentation")
    if "return_page_loaded" in types:
        return ("pending", "returned_but_no_webhook")
    if "checkout_redirected" in types:
        return ("pending", "abandoned_at_checkout")
    if "mollie_payment_created" in types:
        return ("pending", "no_checkout_beacon")
    if "created" in types:
        return ("pending", "no_mollie_event")
    return ("pending", "unknown")


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def fmt_money(cents, currency="EUR"):
    sym = {"EUR": "€", "USD": "$", "GBP": "£"}.get(currency, (currency or "") + " ")
    return f"{sym}{(cents or 0) / 100:.2f}"


def _local_tz_label() -> str:
    """Return a 'UTC+HH:MM' label for the system's current local offset."""
    offset = datetime.now().astimezone().utcoffset()
    if offset is None:
        return "UTC"
    total = int(offset.total_seconds() / 60)
    sign = "+" if total >= 0 else "-"
    return f"UTC{sign}{abs(total) // 60:02d}:{abs(total) % 60:02d}"


def _utc_to_local(s):
    """Convert an SQLite UTC datetime string to system-local time string."""
    if not s:
        return s
    try:
        dt = datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        return dt.astimezone().strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        return s


def report_text(donations, events_by_donation, since, until, verbose=False, from_id=None):
    lines = []
    lines.append("Quina Care donations funnel report")
    now_local = datetime.now().astimezone()
    lines.append(
        f"Generated: {now_local.strftime('%Y-%m-%d %H:%M')} {_local_tz_label()}"
    )
    filters = []
    if from_id is not None:
        filters.append(f"id >= {from_id}")
    if since:
        filters.append(f"since {since}")
    if until:
        filters.append(f"until {until}")
    if filters:
        lines.append(f"Filter:    {', '.join(filters)}")
    lines.append(f"Scope:     {len(donations)} donations")
    lines.append("")

    if not donations:
        lines.append("(no donations in scope)")
        return "\n".join(lines)

    by_state = defaultdict(int)
    by_fault = defaultdict(int)
    by_method_total = defaultdict(int)
    by_method_paid = defaultdict(int)
    by_context_total = defaultdict(int)
    by_context_paid = defaultdict(int)
    paid_cents = 0
    pending_cents = 0
    classified = []

    for d in donations:
        events = events_by_donation.get(d["id"], [])
        state, fault = classify(d, events)
        classified.append((d, events, state, fault))
        by_state[state] += 1
        by_fault[fault] += 1
        method = d.get("payment_method") or "unknown"
        context = d.get("context") or "unknown"
        by_method_total[method] += 1
        by_context_total[context] += 1
        if state == "paid":
            paid_cents += d.get("amount_cents") or 0
            by_method_paid[method] += 1
            by_context_paid[context] += 1
        elif state == "pending":
            pending_cents += d.get("amount_cents") or 0

    total = len(donations)
    lines.append("=== Summary ===")
    for state in ("paid", "pending", "expired", "canceled", "failed"):
        n = by_state[state]
        pct = (n / total * 100) if total else 0
        lines.append(f"  {state:<9} {n:>5}  ({pct:>5.1f}%)")
    lines.append("")
    lines.append(f"  Paid amount:    {fmt_money(paid_cents)}")
    lines.append(f"  Pending amount: {fmt_money(pending_cents)} (potential)")
    lines.append("")

    if by_fault:
        lines.append("=== Fault paths (descending) ===")
        for fault, count in sorted(by_fault.items(), key=lambda kv: -kv[1]):
            lines.append(f"  {count:>5}  {fault}")
        lines.append("")

    lines.append("=== Conversion by payment method ===")
    lines.append(f"  {'method':<12} {'paid':>5} / {'tried':>5}   {'rate':>6}")
    for method, tried in sorted(by_method_total.items(), key=lambda kv: -kv[1]):
        paid = by_method_paid.get(method, 0)
        rate = (paid / tried * 100) if tried else 0
        lines.append(f"  {method:<12} {paid:>5} / {tried:>5}   {rate:>5.1f}%")
    lines.append("")

    lines.append("=== Conversion by context ===")
    lines.append(f"  {'context':<12} {'paid':>5} / {'tried':>5}   {'rate':>6}")
    for context, tried in sorted(by_context_total.items(), key=lambda kv: -kv[1]):
        paid = by_context_paid.get(context, 0)
        rate = (paid / tried * 100) if tried else 0
        lines.append(f"  {context:<12} {paid:>5} / {tried:>5}   {rate:>5.1f}%")
    lines.append("")

    lines.append("=== Donations ===")
    created_header = f"created ({_local_tz_label()})"
    lines.append(
        f"  {'id':>4}  {created_header:<19}  {'method':<11}  {'amount':>9}  {'state':<9}  fault path"
    )
    lines.append(
        f"  {'-' * 4}  {'-' * 19}  {'-' * 11}  {'-' * 9}  {'-' * 9}  {'-' * 40}"
    )
    for d, events, state, fault in classified:
        amount = fmt_money(d.get("amount_cents") or 0, d.get("currency") or "EUR")
        method = (d.get("payment_method") or "-")[:11]
        created = _utc_to_local(d.get("created_at") or "")[:19]
        lines.append(
            f"  {d['id']:>4}  {created:<19}  {method:<11}  {amount:>9}  {state:<9}  {fault}"
        )

    if verbose:
        lines.append("")
        lines.append("=== Event timelines (verbose) ===")
        for d, events, state, fault in classified:
            if not events:
                continue
            lines.append("")
            lines.append(f"#{d['id']}  status={d['status']}  state={state}  {fault}")
            for e in events:
                payload = e.get("payload") or ""
                short = (payload[:80] + "…") if len(payload) > 80 else payload
                ms = e.get("mollie_status") or ""
                prev = e.get("previous_status") or ""
                trans = f"  [{prev} → {ms}]" if (ms or prev) else ""
                lines.append(
                    f"  {_utc_to_local(e['created_at'])}  {e['event_type']:<22}  ({e['source']}){trans}  {short}"
                )

    return "\n".join(lines)


def report_json_obj(donations, events_by_donation):
    out = []
    for d in donations:
        events = events_by_donation.get(d["id"], [])
        state, fault = classify(d, events)
        out.append(
            {
                "id": d["id"],
                "mollie_id": d.get("mollie_id"),
                "status": d.get("status"),
                "state": state,
                "fault_path": fault,
                "amount_cents": d.get("amount_cents"),
                "currency": d.get("currency"),
                "payment_method": d.get("payment_method"),
                "frequency": d.get("frequency"),
                "locale": d.get("locale"),
                "context": d.get("context"),
                "created_at": d.get("created_at"),
                "updated_at": d.get("updated_at"),
                "events": [
                    {
                        "event_type": e["event_type"],
                        "source": e["source"],
                        "mollie_status": e.get("mollie_status"),
                        "previous_status": e.get("previous_status"),
                        "payload": e.get("payload"),
                        "created_at": e["created_at"],
                    }
                    for e in events
                ],
            }
        )
    return out


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    args = parse_args()
    url = args.url or os.environ.get("TURSO_DATABASE_URL")
    token = args.token or os.environ.get("TURSO_AUTH_TOKEN")

    if not url:
        sys.exit("error: TURSO_DATABASE_URL not set and --url not provided")
    if not token:
        sys.exit("error: TURSO_AUTH_TOKEN not set and --token not provided")

    where = ["1=1"]
    params = []
    if args.from_id is not None:
        where.append("id >= ?")
        params.append(args.from_id)
    if args.since:
        where.append("created_at >= ?")
        params.append(args.since)
    if args.until:
        where.append("created_at <= ?")
        params.append(args.until)
    sql = f"SELECT * FROM donations WHERE {' AND '.join(where)} ORDER BY id"
    donations = execute(url, token, sql, params)

    events_by_donation = defaultdict(list)
    if donations:
        # IN (...) with literal ids — they came from the same query so they
        # are trusted integers, no injection risk.
        ids = ",".join(str(d["id"]) for d in donations)
        events = execute(
            url,
            token,
            f"SELECT * FROM donation_events WHERE donation_id IN ({ids}) ORDER BY donation_id, id",
        )
        for e in events:
            events_by_donation[e["donation_id"]].append(e)

    if args.format == "json":
        print(json.dumps(report_json_obj(donations, events_by_donation), indent=2, default=str))
    else:
        print(
            report_text(
                donations,
                events_by_donation,
                args.since,
                args.until,
                verbose=args.verbose,
                from_id=args.from_id,
            )
        )


if __name__ == "__main__":
    main()
