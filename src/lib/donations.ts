import { getDb, ensureSchema } from "./db";

export type DonationContext = "donate" | "yura-boom" | "fundraiser";
export type DonationFrequency = "one-time" | "monthly" | "yearly";

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
