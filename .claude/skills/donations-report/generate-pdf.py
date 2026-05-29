#!/usr/bin/env python3
"""
Run the donations-report and save both a .txt and a .pdf to the repo
root. Reads Turso creds from this directory's .env.

Page 1 of the PDF is a glossary explaining the statuses, fault paths
and event types so the table on subsequent pages reads on its own.

Used by the donations-report skill when the user asks for a PDF.

Pass-through filters mirror scripts/donations-report.py:
  --since YYYY-MM-DD   --until YYYY-MM-DD   --from-id N
"""

import argparse
import importlib.util
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).parent
REPO_ROOT = HERE.parents[2]


# ---------------------------------------------------------------------------
# Env / args
# ---------------------------------------------------------------------------


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def parse_args():
    p = argparse.ArgumentParser(description="Donations report PDF generator")
    p.add_argument("--since", help="Only include donations created on/after this ISO date")
    p.add_argument("--until", help="Only include donations created on/before this ISO date")
    p.add_argument("--from-id", dest="from_id", type=int, help="Only include donations with id >= N")
    return p.parse_args()


def load_donations_module():
    script_path = REPO_ROOT / "scripts" / "donations-report.py"
    spec = importlib.util.spec_from_file_location("donations_report", script_path)
    if spec is None or spec.loader is None:
        sys.exit(f"could not load {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# Glossary content
# ---------------------------------------------------------------------------

STATUSES = [
    ("paid", "Mollie confirmed the payment completed."),
    ("pending", "Payment not yet confirmed. Could be in progress, abandoned, or a webhook miss the cron has not picked up yet."),
    ("expired", "Mollie expired the payment (donor did not complete within Mollie's window, typically minutes to hours)."),
    ("canceled", "Donor explicitly canceled on Mollie's checkout page."),
    ("failed", "Payment was attempted but rejected (card decline, 3DS failure, etc.)."),
    ("open", "Bank-transfer payments awaiting receipt of funds (intermediate Mollie state)."),
]

FAULT_PATHS = [
    ("completed", "Donation reached the paid state. All good."),
    ("pre_instrumentation", "Donation predates the donation_events audit table. No funnel signal exists for it. These rows shrink over time as old pendings expire and the cron reconciles them."),
    ("no_mollie_id_recorded", "The donation row was inserted but no Mollie payment id was recorded. Either Mollie create() was never reached (server crash mid-request), or it failed silently. Strong signal that the create-payment path for that method needs investigation."),
    ("mollie_create_failed", "An explicit mollie_payment_failed event was logged. Mollie create() threw an exception."),
    ("no_checkout_beacon", "Mollie payment was created but the checkout_redirected beacon never fired. Either the browser blocked sendBeacon (ad-blocker / strict privacy) or the page navigated before the beacon could send."),
    ("abandoned_at_checkout", "Donor reached Mollie's checkout page (checkout_redirected fired) but never returned to the thank-you page and Mollie status is still pending. They closed the tab or walked away."),
    ("returned_but_no_webhook", "Donor returned to the thank-you page (return_page_loaded fired) but no webhook event has confirmed paid yet. Either Mollie still processing or the webhook was dropped. The cron will resolve it within an hour."),
    ("expired_at_checkout", "Mollie expired the payment AND the donor had reached checkout (but never came back to confirm)."),
    ("expired_after_return", "Mollie expired the payment AND the donor had returned to the thank-you page. Rare: usually means they clicked back from Mollie without completing."),
    ("expired_before_redirect", "Mollie expired and the donor never even reached the checkout page. Very rare; suggests a stalled redirect."),
    ("user_canceled_at_mollie", "Donor reached checkout and explicitly clicked cancel on Mollie's page."),
    ("canceled_before_redirect", "Canceled status arrived without a checkout_redirected event. Odd timing, or a pre-instrumentation row."),
    ("payment_failed", "Mollie reports a failed payment (typically a card decline or 3-DS failure)."),
    ("no_mollie_event", "A created event exists but no mollie_payment_created followed. Server crashed between the DB insert and the Mollie API call."),
    ("unknown", "Catch-all for unexpected state/event combinations. If you see this, the classifier needs another rule."),
]

EVENT_TYPES = [
    ("created", "Donation row inserted (form submitted on the site)."),
    ("mollie_payment_created", "Mollie's API returned a paymentId. The donor is about to be redirected to Mollie."),
    ("mollie_payment_failed", "Mollie create() threw. Donor sees an error; no Mollie payment exists."),
    ("checkout_redirected", "Client-side beacon: browser is about to navigate to Mollie's checkout page."),
    ("return_page_loaded", "Client-side beacon: donor landed back on the thank-you page (regardless of outcome)."),
    ("verify_payment", "Server-side: the verify-payment endpoint was hit from the return page to confirm status with Mollie."),
    ("webhook", "Mollie called our webhook with a status update. Records previous status and new Mollie status."),
    ("reconciliation", "Hourly cron checked Mollie's current status for a stale pending and updated the row if it changed."),
    ("abandoned", "Cron declared the donation abandoned with a precise reason classification."),
]

KEY_FINDINGS_GUIDANCE = (
    "How to read the report:\n"
    "  1. Look at the summary block first to see overall paid/pending split.\n"
    "  2. Scan the 'Fault paths' table: high counts on rows other than 'completed' "
    "and 'pre_instrumentation' are the issues to fix.\n"
    "  3. The conversion-by-method table flags payment methods that consistently fail "
    "to complete - a 0% method is almost certainly broken end to end.\n"
    "  4. For any specific row of interest, rerun with --verbose to see its event timeline."
)


# ---------------------------------------------------------------------------
# PDF rendering
# ---------------------------------------------------------------------------


def asciify(text: str) -> str:
    return (
        text.replace("€", "EUR ")  # €
        .replace("→", "->")  # →
        .replace("…", "...")  # …
        .replace("≥", ">=")  # ≥
        .replace("—", "-")  # —
        .replace("–", "-")  # –
        .replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
    )


def build_glossary_text(filter_summary: str) -> str:
    import textwrap

    out: list = []
    out.append("Quina Care donations report - legend")
    out.append("=" * 50)
    out.append("")
    out.append("This report classifies every donation by where it sits in the funnel.")
    out.append("The 'state' column reflects the donations row's current status; the")
    out.append("'fault path' column pinpoints what happened along the way using the")
    out.append("append-only donation_events audit table.")
    if filter_summary:
        out.append("")
        out.append(f"Filter applied to this report: {filter_summary}")
    out.append("")

    def section(title: str, items: list) -> None:
        out.append(f"### {title}")
        out.append("")
        for key, desc in items:
            out.append(f"  {key}")
            wrapped = textwrap.wrap(
                desc, width=88, initial_indent="      ", subsequent_indent="      "
            )
            out.extend(wrapped)
            out.append("")

    section("Statuses (donations.status column)", STATUSES)
    section("Fault paths (derived per row)", FAULT_PATHS)
    section("Event types (donation_events.event_type column)", EVENT_TYPES)

    out.append("### How to read this report")
    out.append("")
    for line in KEY_FINDINGS_GUIDANCE.split("\n"):
        out.append(line)

    return "\n".join(out)


def render_text_page(pdf, text: str) -> None:
    """Render plain text on a fresh page using Courier 8pt."""
    pdf.add_page()
    pdf.set_font("Courier", size=8)
    line_height = 3.5
    for line in asciify(text).splitlines():
        if len(line) > 130:
            # Hard-wrap obscenely long lines so multi_cell never has to.
            for i in range(0, len(line), 130):
                pdf.cell(0, line_height, line[i : i + 130])
                pdf.ln(line_height)
        else:
            pdf.cell(0, line_height, line)
            pdf.ln(line_height)


# ---------------------------------------------------------------------------
# Filenames
# ---------------------------------------------------------------------------


def suffix_for_filters(args) -> str:
    bits = []
    if args.from_id is not None:
        bits.append(f"from-{args.from_id}")
    if args.since:
        bits.append(f"since-{args.since.replace(':', '').replace(' ', 'T')}")
    if args.until:
        bits.append(f"until-{args.until.replace(':', '').replace(' ', 'T')}")
    return ("-" + "-".join(bits)) if bits else ""


def filter_summary_for_pdf(args) -> str:
    bits = []
    if args.from_id is not None:
        bits.append(f"id >= {args.from_id}")
    if args.since:
        bits.append(f"since {args.since}")
    if args.until:
        bits.append(f"until {args.until}")
    return ", ".join(bits)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    args = parse_args()
    load_env_file(HERE / ".env")

    url = os.environ.get("TURSO_DATABASE_URL")
    token = os.environ.get("TURSO_AUTH_TOKEN")
    if not url or not token:
        sys.exit("missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN (set in .env or env)")

    dr = load_donations_module()

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
    donations = dr.execute(url, token, sql, params)

    events_by_donation: dict = defaultdict(list)
    if donations:
        ids = ",".join(str(d["id"]) for d in donations)
        events = dr.execute(
            url,
            token,
            f"SELECT * FROM donation_events WHERE donation_id IN ({ids}) ORDER BY donation_id, id",
        )
        for e in events:
            events_by_donation[e["donation_id"]].append(e)

    report = dr.report_text(
        donations,
        events_by_donation,
        args.since,
        args.until,
        verbose=False,
        from_id=args.from_id,
    )

    date = datetime.now().strftime("%Y-%m-%d")
    suffix = suffix_for_filters(args)
    txt_path = REPO_ROOT / f"donations-report-{date}{suffix}.txt"
    pdf_path = REPO_ROOT / f"donations-report-{date}{suffix}.pdf"

    txt_path.write_text(report, encoding="utf-8")
    print(f"text saved: {txt_path}")

    try:
        from fpdf import FPDF
    except ImportError:
        sys.exit("fpdf2 not installed - run: python -m pip install fpdf2")

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=10)
    render_text_page(pdf, build_glossary_text(filter_summary_for_pdf(args)))
    render_text_page(pdf, report)
    pdf.output(str(pdf_path))
    print(f"pdf saved:  {pdf_path}")


if __name__ == "__main__":
    main()
