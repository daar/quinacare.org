import { getDb, ensureSchema } from "./db";

export type DonationContext = "donate" | "yura-boom" | "fundraiser";
export type DonationFrequency = "one-time" | "monthly" | "quarterly" | "yearly";

export interface DonationRecord {
  id?: number;
  mollie_id: string | null;
  status: string;
  amount_cents: number;
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
  const result = await db.execute({
    sql: `INSERT INTO donations (status, amount_cents, currency, frequency, payment_method, locale, context, metadata)
          VALUES ('pending', ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.amount_cents,
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

/** Update donation status (called from webhook). */
export async function updateDonationStatus(
  mollieId: string,
  status: string,
  customerId?: string,
): Promise<void> {
  await ensureSchema();
  const db = getDb();
  const args: (string | null)[] = [status, customerId ?? null, mollieId];
  await db.execute({
    sql: `UPDATE donations SET status = ?, mollie_customer_id = COALESCE(?, mollie_customer_id), updated_at = datetime('now')
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
    sql: `SELECT COALESCE(SUM(amount_cents), 0) AS raised_cents,
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
