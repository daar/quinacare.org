import { getDb, ensureSchema } from "./db";

export type DonationContext = "donate" | "yura-boom" | "fundraiser";
export type DonationFrequency = "one-time" | "monthly" | "yearly";
export type DonationSource = "astro" | "dmm" | "paytium";

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
  donor_name?: string | null;
  donor_email?: string | null;
  donor_phone?: string | null;
  donor_company?: string | null;
  donor_message?: string | null;
  project?: string | null;
  source?: DonationSource;
  wp_donation_id?: string | null;
  mollie_subscription_id?: string | null;
  settlement_currency?: string | null;
  settlement_amount_cents?: number | null;
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

export interface DonorRecord {
  id?: number;
  mollie_customer_id: string;
  mode?: string | null;
  name?: string | null;
  email?: string | null;
  locale?: string | null;
  source?: DonationSource;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionRecord {
  id?: number;
  mollie_subscription_id: string;
  mollie_customer_id?: string | null;
  mode?: string | null;
  currency: string;
  amount_cents: number;
  settlement_currency?: string | null;
  settlement_amount_cents?: number | null;
  times?: number | null;
  interval?: string | null;
  description?: string | null;
  method?: string | null;
  status: string;
  source?: DonationSource;
  created_at?: string;
  updated_at?: string;
}

// ── Donations ──────────────────────────────────────────────

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
    donor_name: row.donor_name as string | null,
    donor_email: row.donor_email as string | null,
    source: (row.source as DonationSource) ?? "astro",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ── Donors ─────────────────────────────────────────────────

/** Upsert a donor by Mollie customer ID. */
export async function upsertDonor(
  customerId: string,
  name?: string | null,
  email?: string | null,
): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO donors (mollie_customer_id, name, email)
          VALUES (?, ?, ?)
          ON CONFLICT(mollie_customer_id)
          DO UPDATE SET name = COALESCE(excluded.name, name),
                        email = COALESCE(excluded.email, email),
                        updated_at = datetime('now')`,
    args: [customerId, name ?? null, email ?? null],
  });
}

/** Get a donor by Mollie customer ID. */
export async function getDonorByCustomerId(
  customerId: string,
): Promise<DonorRecord | null> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM donors WHERE mollie_customer_id = ? LIMIT 1`,
    args: [customerId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as number,
    mollie_customer_id: row.mollie_customer_id as string,
    mode: row.mode as string | null,
    name: row.name as string | null,
    email: row.email as string | null,
    locale: row.locale as string | null,
    source: (row.source as DonationSource) ?? "astro",
    metadata: JSON.parse((row.metadata as string) || "{}"),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ── Subscriptions ──────────────────────────────────────────

/** Upsert a subscription by Mollie subscription ID. */
export async function upsertSubscription(input: {
  mollie_subscription_id: string;
  mollie_customer_id?: string;
  currency?: string;
  amount_cents?: number;
  interval?: string;
  description?: string;
  method?: string;
  status?: string;
}): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO subscriptions (mollie_subscription_id, mollie_customer_id, currency, amount_cents, interval, description, method, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(mollie_subscription_id)
          DO UPDATE SET status = COALESCE(excluded.status, status),
                        updated_at = datetime('now')`,
    args: [
      input.mollie_subscription_id,
      input.mollie_customer_id ?? null,
      input.currency ?? "EUR",
      input.amount_cents ?? 0,
      input.interval ?? null,
      input.description ?? null,
      input.method ?? null,
      input.status ?? "active",
    ],
  });
}

/** Get subscriptions for a Mollie customer. */
export async function getSubscriptionsByCustomerId(
  customerId: string,
): Promise<SubscriptionRecord[]> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM subscriptions WHERE mollie_customer_id = ? ORDER BY created_at DESC`,
    args: [customerId],
  });
  return result.rows.map((row) => ({
    id: row.id as number,
    mollie_subscription_id: row.mollie_subscription_id as string,
    mollie_customer_id: row.mollie_customer_id as string | null,
    currency: row.currency as string,
    amount_cents: row.amount_cents as number,
    interval: row.interval as string | null,
    description: row.description as string | null,
    method: row.method as string | null,
    status: row.status as string,
    source: (row.source as DonationSource) ?? "astro",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}
