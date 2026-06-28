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
                             [--format html|text|json] [--out-dir DIR]
                             [--out FILE] [--stdout] [--verbose]

Default: writes a self-contained HTML dashboard (inline SVG charts, no
dependencies) into reports/donations/. Use --format text for the console
funnel report, or --stdout to stream html/json instead of writing a file.

Credentials (CLI flags win; otherwise env):
  --url URL       Turso database URL (libsql:// or https://)
  --token TOKEN   Turso auth token
  TURSO_DATABASE_URL / TURSO_AUTH_TOKEN environment variables
"""

import argparse
import html as _html
import json
import os
import statistics
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT_DIR = os.path.join(REPO_ROOT, "reports", "donations")


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
        choices=["html", "text", "json"],
        default="html",
        help="Output format (default: html — a self-contained dashboard)",
    )
    p.add_argument(
        "--out",
        help="Write the report to this file path (html/json). Overrides --out-dir.",
    )
    p.add_argument(
        "--out-dir",
        dest="out_dir",
        default=DEFAULT_OUT_DIR,
        help=f"Folder for generated reports (default: {DEFAULT_OUT_DIR})",
    )
    p.add_argument(
        "--stdout",
        action="store_true",
        help="Print to stdout instead of writing a file (html/json)",
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
# HTML dashboard (self-contained: inline SVG charts, no dependencies)
# ---------------------------------------------------------------------------

STATE_COLORS = {
    "paid": "#16a34a",
    "pending": "#3b82f6",
    "expired": "#f59e0b",
    "canceled": "#9ca3af",
    "failed": "#dc2626",
}
PALETTE = ["#b91c1c", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2"]
LOCALE_LABEL = {
    "nl": "Netherlands · EUR",
    "en": "USA · USD",
    "es": "Ecuador · USD",
}
AMOUNT_TIERS = [
    (0, 1000, "< €10"),
    (1000, 2500, "10–24"),
    (2500, 5000, "25–49"),
    (5000, 10000, "50–99"),
    (10000, 25000, "100–249"),
    (25000, 50000, "250–499"),
    (50000, 10 ** 12, "500+"),
]


def _e(s):
    return _html.escape(str(s if s is not None else ""))


WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
# Monthly-equivalent factor for recurring revenue (MRR).
MRR_FACTOR = {"monthly": 1.0, "quarterly": 1 / 3, "yearly": 1 / 12, "one-time": 0.0}
# The ordered funnel stages, each keyed by the event_type that proves a
# donation reached it (the last stage is the paid state, not an event).
FUNNEL = [
    ("Started (created)", "created"),
    ("Mollie payment created", "mollie_payment_created"),
    ("Redirected to checkout", "checkout_redirected"),
    ("Returned to site", "return_page_loaded"),
    ("Paid", None),
]


def _minutes_between(a_str, b_str):
    try:
        a = datetime.strptime(a_str[:19], "%Y-%m-%d %H:%M:%S")
        b = datetime.strptime(b_str[:19], "%Y-%m-%d %H:%M:%S")
        return (b - a).total_seconds() / 60
    except (ValueError, TypeError):
        return None


def _aggregate(donations, events_by_donation):
    a = {
        "total": len(donations),
        "by_state": defaultdict(int),
        "by_fault": defaultdict(int),
        "method_total": defaultdict(int),
        "method_paid": defaultdict(int),
        "method_paid_cents": defaultdict(int),
        "locale_total": defaultdict(int),
        "locale_paid": defaultdict(int),
        "locale_paid_cents": defaultdict(int),
        "freq_total": defaultdict(int),
        "context_total": defaultdict(int),
        "context_paid": defaultdict(int),
        "paid_by_currency": defaultdict(int),
        "lost_by_currency": defaultdict(int),  # expired+failed+canceled
        "tier_total": defaultdict(int),
        "tier_paid": defaultdict(int),
        "by_day_total": defaultdict(int),
        "by_day_paid": defaultdict(int),
        "by_weekday_total": defaultdict(int),
        "by_weekday_paid": defaultdict(int),
        "funnel": defaultdict(int),  # event_type -> count of donations reaching it
        "mrr_by_currency": defaultdict(float),
        "recurring_paid": 0,
        "paid_values": [],  # major units, mixed currency
        "complete_minutes": [],  # created->paid latency for paid donations
        "customers": set(),
        "customer_paid_counts": defaultdict(int),
    }
    for d in donations:
        events = events_by_donation.get(d["id"], [])
        state, fault = classify(d, events)
        a["by_state"][state] += 1
        a["by_fault"][fault] += 1
        method = d.get("payment_method") or "unknown"
        locale = d.get("locale") or "unknown"
        freq = d.get("frequency") or "one-time"
        ctx = d.get("context") or "unknown"
        cents = d.get("amount_cents") or 0
        cur = d.get("currency") or "EUR"
        a["method_total"][method] += 1
        a["locale_total"][locale] += 1
        a["freq_total"][freq] += 1
        a["context_total"][ctx] += 1
        for lo, hi, label in AMOUNT_TIERS:
            if lo <= cents < hi:
                a["tier_total"][label] += 1
                break
        day_local = _utc_to_local(d.get("created_at") or "")
        day = day_local[:10]
        a["by_day_total"][day] += 1
        try:
            wd = datetime.strptime(day, "%Y-%m-%d").weekday()
            a["by_weekday_total"][wd] += 1
        except ValueError:
            wd = None
        # Funnel: which stages did this donation reach?
        types = {e["event_type"] for e in events}
        for _, ev in FUNNEL:
            if ev and ev in types:
                a["funnel"][ev] += 1
        cust = d.get("mollie_customer_id")
        if cust:
            a["customers"].add(cust)
        if state == "paid":
            a["funnel"]["__paid__"] += 1
            a["method_paid"][method] += 1
            a["method_paid_cents"][method] += cents
            a["locale_paid"][locale] += 1
            a["locale_paid_cents"][locale] += cents
            a["context_paid"][ctx] += 1
            a["paid_by_currency"][cur] += cents
            a["by_day_paid"][day] += 1
            if wd is not None:
                a["by_weekday_paid"][wd] += 1
            for lo, hi, label in AMOUNT_TIERS:
                if lo <= cents < hi:
                    a["tier_paid"][label] += 1
                    break
            a["paid_values"].append(cents / 100)
            factor = MRR_FACTOR.get(freq, 0.0)
            if factor:
                a["mrr_by_currency"][cur] += cents * factor
                a["recurring_paid"] += 1
            if cust:
                a["customer_paid_counts"][cust] += 1
            mins = _minutes_between(d.get("created_at"), d.get("updated_at"))
            if mins is not None and mins >= 0:
                a["complete_minutes"].append(mins)
        elif state in ("expired", "failed", "canceled"):
            a["lost_by_currency"][cur] += cents
    return a


def _svg_hbars(rows, accent, w=560, label_w=150):
    """rows: list of (label, value, right_annotation). Bars scaled to max."""
    if not rows:
        return "<p class='muted'>No data.</p>"
    maxv = max([r[1] for r in rows]) or 1
    bar_area = w - label_w - 70
    row_h = 30
    h = row_h * len(rows) + 6
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" height="{h}" role="img">']
    y = 3
    for label, value, ann in rows:
        bw = bar_area * (value / maxv)
        out.append(f'<text x="0" y="{y + 20}" class="lbl">{_e(label)}</text>')
        out.append(
            f'<rect x="{label_w}" y="{y + 7}" width="{bar_area}" height="15" rx="3" class="track"/>'
        )
        out.append(
            f'<rect x="{label_w}" y="{y + 7}" width="{bw:.1f}" height="15" rx="3" fill="{accent}"/>'
        )
        out.append(
            f'<text x="{w}" y="{y + 20}" text-anchor="end" class="val">{_e(ann)}</text>'
        )
        y += row_h
    out.append("</svg>")
    return "".join(out)


def _svg_stacked(segments, w=560, h=30):
    """segments: list of (label, value, color). Returns SVG + HTML legend."""
    total = sum(v for _, v, _ in segments) or 1
    x = 0.0
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" height="{h}" role="img">']
    for label, value, color in segments:
        sw = w * value / total
        out.append(
            f'<rect x="{x:.1f}" y="0" width="{sw:.1f}" height="{h}" fill="{color}">'
            f"<title>{_e(label)}: {value} ({value / total * 100:.0f}%)</title></rect>"
        )
        x += sw
    out.append("</svg>")
    legend = ['<div class="legend">']
    for label, value, color in segments:
        if not value:
            continue
        legend.append(
            f'<span><i style="background:{color}"></i>{_e(label)} '
            f'<b>{value}</b> ({value / total * 100:.0f}%)</span>'
        )
    legend.append("</div>")
    return "".join(out) + "".join(legend)


def _svg_columns(days, w=720, h=170, axis=None):
    """days: list of (label, total, paid). Column chart, paid overlaid."""
    if not days:
        return "<p class='muted'>No data.</p>"
    if axis is None:
        axis = lambda s: s[8:]  # noqa: E731 — default: day-of-month
    maxv = max([d[1] for d in days]) or 1
    n = len(days)
    gap = 6
    col_w = (w - gap * (n + 1)) / n
    base = h - 24
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" height="{h}" role="img">']
    for i, (label, total, paid) in enumerate(days):
        x = gap + i * (col_w + gap)
        th = base * total / maxv
        ph = base * paid / maxv
        out.append(
            f'<rect x="{x:.1f}" y="{base - th:.1f}" width="{col_w:.1f}" height="{th:.1f}" rx="2" class="track">'
            f"<title>{_e(label)}: {total} total</title></rect>"
        )
        out.append(
            f'<rect x="{x:.1f}" y="{base - ph:.1f}" width="{col_w:.1f}" height="{ph:.1f}" rx="2" fill="#16a34a">'
            f"<title>{paid} paid</title></rect>"
        )
        out.append(
            f'<text x="{x + col_w / 2:.1f}" y="{h - 8}" text-anchor="middle" class="axis">{_e(axis(label))}</text>'
        )
    out.append("</svg>")
    return "".join(out)


def _fmt_dur(minutes):
    if minutes is None:
        return "—"
    if minutes < 90:
        return f"{minutes:.0f}m"
    return f"{minutes / 60:.1f}h"


def _money_pair(eur_cents, usd_cents):
    parts = []
    if eur_cents:
        parts.append(f"€{eur_cents / 100:,.0f}")
    if usd_cents:
        parts.append(f"${usd_cents / 100:,.0f}")
    return " + ".join(parts) if parts else "€0"


def _card(big, small):
    return f'<div class="kpi"><div class="kpi-big">{big}</div><div class="kpi-small">{_e(small)}</div></div>'


def _section(title, body):
    return f'<section class="card"><h2>{_e(title)}</h2>{body}</section>'


def report_html(donations, events_by_donation, since, until, from_id=None):
    a = _aggregate(donations, events_by_donation)
    now_local = datetime.now().astimezone()
    filters = []
    if from_id is not None:
        filters.append(f"id ≥ {from_id}")
    if since:
        filters.append(f"since {since}")
    if until:
        filters.append(f"until {until}")
    window = ", ".join(filters) if filters else "full history"

    total = a["total"] or 1
    paid_n = a["by_state"]["paid"]
    paid_pct = paid_n / total * 100
    eur = a["paid_by_currency"].get("EUR", 0)
    usd = a["paid_by_currency"].get("USD", 0)
    avg = (statistics.mean(a["paid_values"]) if a["paid_values"] else 0)
    med = (statistics.median(a["paid_values"]) if a["paid_values"] else 0)
    mrr_eur = a["mrr_by_currency"].get("EUR", 0)
    mrr_usd = a["mrr_by_currency"].get("USD", 0)
    lost_eur = a["lost_by_currency"].get("EUR", 0)
    lost_usd = a["lost_by_currency"].get("USD", 0)
    med_min = statistics.median(a["complete_minutes"]) if a["complete_minutes"] else None
    known = len(a["customers"])
    repeat = sum(1 for n in a["customer_paid_counts"].values() if n > 1)

    # KPI strip
    kpis = [
        _card(str(a["total"]), "donations in scope"),
        _card(f'{paid_n} <span class="pct">{paid_pct:.0f}%</span>', "paid (conversion)"),
        _card(f"€{eur / 100:,.0f}", "raised · NL (EUR)"),
        _card(f"${usd / 100:,.0f}", "raised · US/EC (USD)"),
        _card(_money_pair(mrr_eur, mrr_usd) + "<span class='pct'>/mo</span>", "recurring revenue (MRR)"),
        _card(str(a["recurring_paid"]), "recurring donations (paid)"),
        _card(f"{avg:,.0f} / {med:,.0f}", "avg / median gift"),
        _card(_money_pair(lost_eur, lost_usd), "lost (expired/failed/canceled)"),
        _card(_fmt_dur(med_min), "median time to pay"),
        _card(f"{repeat} <span class='pct'>/ {known}</span>", "repeat / known donors"),
    ]

    # Conversion funnel (drop-off)
    funnel_first = a["funnel"].get(FUNNEL[0][1], 0) or 1
    funnel_rows = []
    for label, ev in FUNNEL:
        c = a["funnel"]["__paid__"] if ev is None else a["funnel"].get(ev, 0)
        funnel_rows.append((label, c, f"{c} · {c / funnel_first * 100:.0f}%"))

    # Success vs failure
    state_segs = [
        (s, a["by_state"][s], STATE_COLORS[s])
        for s in ("paid", "pending", "expired", "canceled", "failed")
        if a["by_state"][s]
    ]
    fault_rows = [
        (f, c, str(c)) for f, c in sorted(a["by_fault"].items(), key=lambda kv: -kv[1])
    ]

    # Payment methods (conversion)
    method_rows = []
    for m, tried in sorted(a["method_total"].items(), key=lambda kv: -kv[1]):
        paid = a["method_paid"].get(m, 0)
        rate = paid / tried * 100 if tried else 0
        method_rows.append((m, rate, f"{paid}/{tried} · {rate:.0f}%"))

    # Conversion by gift size
    tier_conv_rows = []
    for (_, _, label) in AMOUNT_TIERS:
        tried = a["tier_total"].get(label, 0)
        if not tried:
            continue
        paid = a["tier_paid"].get(label, 0)
        rate = paid / tried * 100
        tier_conv_rows.append((label, rate, f"{paid}/{tried} · {rate:.0f}%"))

    # Geography & currency
    locale_segs = []
    avg_geo_rows = []
    for i, (lo, n) in enumerate(sorted(a["locale_total"].items(), key=lambda kv: -kv[1])):
        locale_segs.append((LOCALE_LABEL.get(lo, lo), n, PALETTE[i % len(PALETTE)]))
        paid = a["locale_paid"].get(lo, 0)
        if paid:
            avg_c = a["locale_paid_cents"].get(lo, 0) / paid
            sym = "€" if lo == "nl" else "$"
            avg_geo_rows.append((LOCALE_LABEL.get(lo, lo), avg_c, f"{sym}{avg_c / 100:,.0f}"))

    # Frequency
    freq_segs = []
    for i, (f, n) in enumerate(sorted(a["freq_total"].items(), key=lambda kv: -kv[1])):
        freq_segs.append((f, n, PALETTE[i % len(PALETTE)]))

    # By context (conversion)
    context_rows = []
    for ctx, tried in sorted(a["context_total"].items(), key=lambda kv: -kv[1]):
        paid = a["context_paid"].get(ctx, 0)
        rate = paid / tried * 100 if tried else 0
        context_rows.append((ctx, rate, f"{paid}/{tried} · {rate:.0f}%"))

    # Day-of-week pattern
    weekday_rows = [
        (WEEKDAYS[wd], a["by_weekday_total"].get(wd, 0), a["by_weekday_paid"].get(wd, 0))
        for wd in range(7)
    ]

    # Daily trend
    days = sorted(a["by_day_total"].keys())
    day_rows = [(d, a["by_day_total"][d], a["by_day_paid"].get(d, 0)) for d in days]

    css = """
    :root{--ink:#1a1a1a;--muted:#6b7280;--line:#e5e7eb;--accent:#b91c1c}
    *{box-sizing:border-box}
    body{margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arimo,Helvetica,Arial,sans-serif;color:var(--ink);background:#f6f7f9}
    .wrap{max-width:960px;margin:0 auto;padding:32px 20px 64px}
    header h1{margin:0 0 4px;font-size:24px;letter-spacing:-.02em}
    header .meta{color:var(--muted);font-size:13px}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:22px 0}
    .kpi{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}
    .kpi-big{font-size:22px;font-weight:700;letter-spacing:-.02em}
    .kpi-big .pct{font-size:14px;color:#16a34a;font-weight:600}
    .kpi-small{color:var(--muted);font-size:12px;margin-top:2px}
    .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:14px 0}
    .card h2{margin:0 0 12px;font-size:16px;letter-spacing:-.01em}
    .card h3{margin:16px 0 6px;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    text.lbl{font:600 13px sans-serif;fill:#374151}
    text.val{font:13px sans-serif;fill:#6b7280}
    text.axis{font:10px sans-serif;fill:#9ca3af}
    rect.track{fill:#eef0f2}
    .legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-size:13px;color:#374151}
    .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:middle}
    .muted{color:var(--muted)}
    footer{color:var(--muted);font-size:12px;margin-top:24px;text-align:center}
    @media print{body{background:#fff}.card,.kpi{break-inside:avoid}}
    @media (max-width:760px){.kpis{grid-template-columns:repeat(2,1fr)}.grid2{grid-template-columns:1fr}}
    """

    head = (
        f'<header><h1>Quina Care — donations dashboard</h1>'
        f'<div class="meta">Window: {_e(window)} · {a["total"]} donations · '
        f'generated {now_local.strftime("%Y-%m-%d %H:%M")} {_local_tz_label()}</div></header>'
    )
    def _grid2(*cards):
        return '<div class="grid2">' + "".join(cards) + "</div>"

    doc = (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>Quina Care donations dashboard</title>"
        f"<style>{css}</style></head><body><div class='wrap'>"
        + head
        + '<div class="kpis">'
        + "".join(kpis)
        + "</div>"
        + _section(
            "Conversion funnel (% of started)", _svg_hbars(funnel_rows, "#b91c1c")
        )
        + _grid2(
            _section("Success vs failure", _svg_stacked(state_segs)),
            _section("Fault paths", _svg_hbars(fault_rows, "#9ca3af")),
        )
        + _grid2(
            _section("Payment methods — conversion", _svg_hbars(method_rows, "#b91c1c")),
            _section("Conversion by gift size", _svg_hbars(tier_conv_rows, "#7c3aed")),
        )
        + _grid2(
            _section("Geography & currency", _svg_stacked(locale_segs)),
            _section("Average gift by geography", _svg_hbars(avg_geo_rows, "#059669")),
        )
        + _grid2(
            _section("Frequency", _svg_stacked(freq_segs)),
            _section("Conversion by context", _svg_hbars(context_rows, "#0891b2")),
        )
        + _section(
            "Day of week (green = paid)",
            _svg_columns(weekday_rows, axis=lambda s: s),
        )
        + _section("Donations over time (green = paid)", _svg_columns(day_rows))
        + "<footer>Read-only snapshot from the Turso production database · "
        "scripts/donations-report.py · known-donor metrics cover only rows "
        "with a Mollie customer id (mostly recurring)</footer>"
        + "</div></body></html>"
    )
    return doc


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

    if args.format == "text":
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
        return

    if args.format == "json":
        content = json.dumps(
            report_json_obj(donations, events_by_donation), indent=2, default=str
        )
        ext = "json"
    else:  # html (default)
        content = report_html(
            donations, events_by_donation, args.since, args.until, from_id=args.from_id
        )
        ext = "html"

    if args.stdout:
        print(content)
        return

    # Write to a file in the dedicated reports folder.
    if args.out:
        out_path = args.out
        os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    else:
        os.makedirs(args.out_dir, exist_ok=True)
        stamp = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
        out_path = os.path.join(args.out_dir, f"donations-{stamp}.{ext}")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Wrote {ext.upper()} report → {out_path}")


if __name__ == "__main__":
    main()
