import { getDb, ensureSchema } from "./db";

/**
 * Safety-net EUR->USD rate, used only if the database has no observed
 * conversion yet or the lookup fails — see getCurrentEurToUsdRate, which
 * is always preferred and reflects the real rate Mollie actually applied
 * to the most recent USD donation. Update occasionally; this constant is
 * not the source of truth and is never used while live data is reachable.
 * Last synced to the observed rate on 2026-10-04.
 */
const FALLBACK_EUR_TO_USD_RATE = 1.17;

export type DonationContext = "donate" | "yura-boom" | "fundraiser";
export type DonationFrequency = "one-time" | "monthly" | "quarterly" | "yearly";

export interface DonationRecord {
  id?: number;
  mollie_id: string | null;
  status: string;
  amount_cents: number;
  amount_eur_cents: number | null;
  currency: string;
  frequency: DonationFrequency;
  payment_method: string;
  locale: string;
  context: DonationContext;
  metadata: Record<string, unknown>;
  mollie_customer_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDonationInput {
  amount_cents: number;
  currency: string;
  frequency: DonationFrequency;
  payment_method: string;
  locale: string;
  context: DonationContext;
  metadata?: Record<string, unknown>;
}

/** Insert a pending donation and return the row ID. */
export async function insertDonation(
  input: CreateDonationInput,
): Promise<number> {
  await ensureSchema();
  const db = getDb();
  // EUR donations need no conversion, so the EUR amount is already known
  // at creation time. Non-EUR donations only learn their real EUR value
  // once Mollie reports it (settlementAmount) on the "paid" webhook — see
  // updateDonationStatus.
  const amountEurCents = input.currency === "EUR" ? input.amount_cents : null;
  const result = await db.execute({
    sql: `INSERT INTO donations (status, amount_cents, amount_eur_cents, currency, frequency, payment_method, locale, context, metadata)
          VALUES ('pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.amount_cents,
      amountEurCents,
      input.currency,
      input.frequency,
      input.payment_method,
      input.locale,
      input.context,
      JSON.stringify(input.metadata ?? {}),
    ],
  });
  return Number(result.lastInsertRowid);
}

/** Link a Mollie payment ID to an existing donation row. */
export async function setMollieId(
  donationId: number,
  mollieId: string,
): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `UPDATE donations SET mollie_id = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [mollieId, donationId],
  });
}

/**
 * Update donation status (called from webhook). `amountEurCents`, when
 * given, records the real EUR value of a non-EUR payment once Mollie
 * reports it — see the `amount_eur_cents` column comment in db.ts.
 */
export async function updateDonationStatus(
  mollieId: string,
  status: string,
  customerId?: string,
  amountEurCents?: number,
): Promise<void> {
  await ensureSchema();
  const db = getDb();
  const args: (string | number | null)[] = [
    status,
    customerId ?? null,
    amountEurCents ?? null,
    mollieId,
  ];
  await db.execute({
    sql: `UPDATE donations SET status = ?, mollie_customer_id = COALESCE(?, mollie_customer_id),
          amount_eur_cents = COALESCE(?, amount_eur_cents), updated_at = datetime('now')
          WHERE mollie_id = ?`,
    args,
  });
}

/** Get fundraiser stats (total raised + donor count) for a given slug. */
export async function getFundraiserStats(
  slug: string,
): Promise<{ raised_cents: number; donor_count: number }> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT COALESCE(SUM(COALESCE(amount_eur_cents, amount_cents)), 0) AS raised_cents,
                 COUNT(*) AS donor_count
          FROM donations
          WHERE context = 'fundraiser'
            AND status = 'paid'
            AND json_extract(metadata, '$.fundraiser_slug') = ?`,
    args: [slug],
  });
  const row = result.rows[0];
  return {
    raised_cents: Number(row?.raised_cents ?? 0),
    donor_count: Number(row?.donor_count ?? 0),
  };
}

/**
 * The real EUR->USD rate, taken from the most recently settled USD
 * donation (Mollie's own settlementAmount — see the amount_eur_cents
 * column). EN/ES donors pay in USD while fundraiser totals are tracked
 * internally in EUR, so multiply a EUR amount by this to show its
 * USD-equivalent on EN/ES pages. Always queried live — never cached or
 * hardcoded — so a stale rate never lingers; falls back to
 * FALLBACK_EUR_TO_USD_RATE only if the database has no USD donation
 * with a known EUR value yet, or the query fails.
 */
export async function getCurrentEurToUsdRate(): Promise<number> {
  try {
    await ensureSchema();
    const db = getDb();
    const result = await db.execute(
      `SELECT amount_cents * 1.0 / amount_eur_cents AS rate
       FROM donations
       WHERE currency = 'USD' AND amount_eur_cents IS NOT NULL AND amount_eur_cents > 0
       ORDER BY created_at DESC
       LIMIT 1`,
    );
    const rate = result.rows[0]?.rate;
    return typeof rate === "number" && rate > 0
      ? rate
      : FALLBACK_EUR_TO_USD_RATE;
  } catch {
    return FALLBACK_EUR_TO_USD_RATE;
  }
}

/** Get individual donations for a fundraiser (for activity timeline). */
export async function getDonationsByFundraiser(
  slug: string,
  limit: number = 50,
): Promise<
  Array<{
    amount_cents: number;
    firstName?: string;
    donatedAt: string;
  }>
> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT COALESCE(amount_eur_cents, amount_cents) AS amount_cents, metadata, created_at
          FROM donations
          WHERE context = 'fundraiser'
            AND status = 'paid'
            AND json_extract(metadata, '$.fundraiser_slug') = ?
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [slug, limit],
  });

  return result.rows.map((row: Record<string, unknown>) => {
    const metadata =
      typeof row.metadata === "string"
        ? JSON.parse(row.metadata as string)
        : row.metadata;
    const metaRecord = metadata as Record<string, unknown>;
    const firstName = (metaRecord.first_name || metaRecord.firstName) as
      string | undefined;
    return {
      amount_cents: Number(row.amount_cents),
      firstName,
      donatedAt: (row.created_at as string) || new Date().toISOString(),
    };
  });
}

/** Get a donation by Mollie payment ID. */
export async function getDonationByMollieId(
  mollieId: string,
): Promise<DonationRecord | null> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM donations WHERE mollie_id = ? LIMIT 1`,
    args: [mollieId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as number,
    mollie_id: row.mollie_id as string | null,
    status: row.status as string,
    amount_cents: row.amount_cents as number,
    amount_eur_cents: row.amount_eur_cents as number | null,
    currency: row.currency as string,
    frequency: row.frequency as DonationFrequency,
    payment_method: row.payment_method as string,
    locale: row.locale as string,
    context: row.context as DonationContext,
    metadata: JSON.parse((row.metadata as string) || "{}"),
    mollie_customer_id: row.mollie_customer_id as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ---- donation_events ----

export type DonationEventType =
  | "created"
  | "mollie_payment_created"
  | "mollie_payment_failed"
  | "checkout_redirected"
  | "return_page_loaded"
  | "verify_payment"
  | "webhook"
  | "reconciliation"
  | "abandoned";

export type DonationEventSource = "server" | "client" | "webhook" | "cron";

export interface LogEventInput {
  donationId: number;
  type: DonationEventType;
  source: DonationEventSource;
  mollieStatus?: string;
  previousStatus?: string;
  payload?: Record<string, unknown>;
}

/**
 * Append-only audit log: every observable event in a donation's life
 * (form submitted, Mollie created, redirected, returned, webhook fired,
 * cron reconciled) goes here. Lets us reconstruct the funnel for any
 * row without overwriting the live `status` column. Failures are
 * swallowed so logging never breaks a real operation.
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    await ensureSchema();
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO donation_events
              (donation_id, event_type, source, mollie_status, previous_status, payload)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        input.donationId,
        input.type,
        input.source,
        input.mollieStatus ?? null,
        input.previousStatus ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    });
  } catch (err) {
    console.error("[donations] logEvent failed:", input.type, err);
  }
}

/** Lean lookup by Mollie payment id — returns id + current status only. */
export async function getDonationIdAndStatusByMollieId(
  mollieId: string,
): Promise<{ id: number; status: string; mollie_id: string } | null> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, status, mollie_id FROM donations WHERE mollie_id = ? LIMIT 1`,
    args: [mollieId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as number,
    status: row.status as string,
    mollie_id: row.mollie_id as string,
  };
}

/** Lean lookup by internal donation id — returns id + status + mollie_id. */
export async function getDonationById(
  donationId: number,
): Promise<{ id: number; status: string; mollie_id: string | null } | null> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, status, mollie_id FROM donations WHERE id = ? LIMIT 1`,
    args: [donationId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as number,
    status: row.status as string,
    mollie_id: row.mollie_id as string | null,
  };
}
