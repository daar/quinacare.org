// Newsletter subscribers: signing up, opting out, and letting people
// correct their own details.
//
// The SQL itself lives in subscribersSql.mjs, shared with the scripts.
// This module adds what only the server can do: validation, the consent
// record, the event log, and the signed links that let someone manage a
// subscription without an account.

import crypto from "node:crypto";
import { getDb, ensureSchema } from "./db";
import {
  LOCALES,
  UPSERT_SUBSCRIBER_CONSENT,
  canonicalLocales,
} from "./subscribersSql.mjs";

export type Locale = "nl" | "en" | "es";

/** The languages in canonical order, for rendering choices. */
export const LOCALES_ORDER = LOCALES as Locale[];

/** Where a subscription came from. Never overwritten once recorded. */
export type SubscriberSource =
  "website" | "donation-thanks" | "wordpress" | "mailerlite" | "manual";

export interface Subscriber {
  id: number;
  email: string;
  name: string;
  locales: Locale[];
  status: string;
  source: string;
  subscribedAt: string;
  unsubscribedAt: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_NAME = 100;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return null;
  return email;
}

export function normaliseName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_NAME) : "";
}

// --- signed links ---------------------------------------------------
//
// Every management link is derived, never stored. That means the 651
// people already on the list get a working unsubscribe link without a
// backfill, and sending a newsletter needs no write. The token is keyed
// on the row id rather than the address so no email ever appears in a
// URL, a referrer header or a campaign report. Ids come from
// AUTOINCREMENT and are never reused, so a token cannot transfer to
// someone else. To rotate, change the secret.

function secret(): string {
  const value = import.meta.env.NEWSLETTER_TOKEN_SECRET;
  if (!value) {
    // Deliberately fatal rather than falling back to a default: a
    // guessable secret here would let anyone unsubscribe anyone.
    throw new Error("NEWSLETTER_TOKEN_SECRET is not configured");
  }
  return value;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url")
    .slice(0, 22);
}

function matches(expected: string, given: unknown): boolean {
  if (typeof given !== "string" || given.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

/** Link that identifies a subscriber for unsubscribe and preferences. */
export function subscriberToken(id: number): string {
  return sign(`sub:${id}`);
}

export function verifySubscriberToken(id: number, token: unknown): boolean {
  return matches(subscriberToken(id), token);
}

/**
 * A separate token for confirming a new address, bound to both the row
 * and the address being moved to. The management link was issued to the
 * old address, so on its own it must not be enough to redirect someone's
 * mail elsewhere — the new address has to prove it wants it.
 */
export function emailChangeToken(id: number, email: string): string {
  return sign(`email:${id}:${email.trim().toLowerCase()}`);
}

export function verifyEmailChangeToken(
  id: number,
  email: string,
  token: unknown,
): boolean {
  return matches(emailChangeToken(id, email), token);
}

// --- reading --------------------------------------------------------

export async function getSubscriber(id: number): Promise<Subscriber | null> {
  await ensureSchema();
  const { rows } = await getDb().execute({
    sql: `SELECT id, email, name, locale, status, source, subscribed_at, unsubscribed_at
          FROM subscribers WHERE id = ?`,
    args: [id],
  });
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    email: String(row.email),
    name: String(row.name ?? ""),
    locales: canonicalLocales(row.locale) as Locale[],
    status: String(row.status),
    source: String(row.source),
    subscribedAt: String(row.subscribed_at),
    unsubscribedAt: row.unsubscribed_at ? String(row.unsubscribed_at) : null,
  };
}

// --- the event log --------------------------------------------------

/**
 * Best-effort: a failure to write history must never fail the thing that
 * actually mattered to the visitor. Same stance as reporting an error.
 */
export async function logSubscriberEvent(
  subscriberId: number,
  eventType: string,
  source: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await getDb().execute({
      sql: `INSERT INTO subscriber_events (subscriber_id, event_type, source, payload)
            VALUES (?, ?, ?, ?)`,
      args: [subscriberId, eventType, source, JSON.stringify(payload)],
    });
  } catch {
    // swallowed on purpose
  }
}

// --- writing --------------------------------------------------------

export interface SubscribeInput {
  email: string;
  locale: Locale;
  name?: string;
  source: SubscriberSource;
  ip?: string | null;
}

export interface SubscribeResult {
  id: number;
  status: string;
  /** True when this call created the row rather than updating one. */
  created: boolean;
}

/**
 * Record an act of consent. Adds a language to an existing subscriber
 * rather than rejecting them as a duplicate, and reactivates someone who
 * had unsubscribed — they have just asked for mail again.
 */
export async function subscribe(
  input: SubscribeInput,
): Promise<SubscribeResult | null> {
  const email = normaliseEmail(input.email);
  if (!email || !isLocale(input.locale)) return null;

  await ensureSchema();
  const db = getDb();

  const before = await db.execute({
    sql: `SELECT id, status, locale FROM subscribers WHERE email = ?`,
    args: [email],
  });
  const existing = before.rows[0];

  await db.execute({
    sql: UPSERT_SUBSCRIBER_CONSENT,
    args: [
      email,
      normaliseName(input.name),
      input.locale,
      input.source,
      input.ip ?? "",
    ],
  });

  const after = await db.execute({
    sql: `SELECT id, status FROM subscribers WHERE email = ?`,
    args: [email],
  });
  const row = after.rows[0];
  if (!row) return null;

  const id = Number(row.id);
  const eventType = !existing
    ? "subscribed"
    : String(existing.status) !== "active"
      ? "resubscribed"
      : canonicalLocales(existing.locale).includes(input.locale)
        ? "subscribed"
        : "list_added";

  await logSubscriberEvent(id, eventType, input.source, {
    locale: input.locale,
    consent_ip: input.ip ?? "",
  });

  return { id, status: String(row.status), created: !existing };
}

/** Tag the row rather than deleting it, so we know not to mail again. */
export async function unsubscribe(id: number, source: string): Promise<void> {
  await ensureSchema();
  await getDb().execute({
    sql: `UPDATE subscribers
          SET status = 'unsubscribed',
              unsubscribed_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ? AND status != 'unsubscribed'`,
    args: [id],
  });
  await logSubscriberEvent(id, "unsubscribed", source);
}

export interface PreferencesInput {
  name?: string;
  locales: Locale[];
}

/**
 * Apply what someone changed on their own preference page. Clearing every
 * language is an unsubscribe rather than an empty list — there is no such
 * thing as being subscribed to nothing.
 */
export async function updatePreferences(
  id: number,
  input: PreferencesInput,
): Promise<"updated" | "unsubscribed"> {
  await ensureSchema();
  const locales = LOCALES.filter((l: string) =>
    input.locales.includes(l as Locale),
  );

  if (locales.length === 0) {
    await unsubscribe(id, "preferences");
    return "unsubscribed";
  }

  await getDb().execute({
    sql: `UPDATE subscribers
          SET name = ?, locale = ?, status = 'active', unsubscribed_at = NULL,
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [normaliseName(input.name), locales.join(","), id],
  });
  await logSubscriberEvent(id, "updated", "preferences", {
    locales: locales.join(","),
  });
  return "updated";
}

/**
 * Move a subscription to a new address, once that address has confirmed.
 * Returns false when the address is already on the list — merging two
 * subscribers is a decision for a person, not a side effect of a form.
 */
export async function changeEmail(
  id: number,
  newEmail: string,
): Promise<boolean> {
  const email = normaliseEmail(newEmail);
  if (!email) return false;

  await ensureSchema();
  const db = getDb();

  const taken = await db.execute({
    sql: `SELECT id FROM subscribers WHERE email = ? AND id != ?`,
    args: [email, id],
  });
  if (taken.rows.length > 0) return false;

  const current = await getSubscriber(id);
  if (!current) return false;

  await db.execute({
    sql: `UPDATE subscribers SET email = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [email, id],
  });
  await logSubscriberEvent(id, "email_changed", "preferences", {
    from: current.email,
    to: email,
  });
  return true;
}

// --- the links that go in a newsletter -------------------------------

/** Where each language's preference centre lives. */
export const PREFERENCES_PATH: Record<Locale, string> = {
  nl: "/nieuwsbrief/voorkeuren",
  en: "/en/newsletter/preferences",
  es: "/es/boletin/preferencias",
};

const SITE = "https://quinacare.org";

/** "Manage your subscription" — the link for a newsletter footer. */
export function preferencesUrl(id: number, lang: Locale, site = SITE): string {
  const token = subscriberToken(id);
  return `${site}${PREFERENCES_PATH[lang]}?u=${id}&t=${token}`;
}

/** One-click unsubscribe, also used for the List-Unsubscribe header. */
export function unsubscribeUrl(id: number, lang: Locale, site = SITE): string {
  const token = subscriberToken(id);
  return `${site}/api/newsletter/unsubscribe?u=${id}&t=${token}&lang=${lang}`;
}

/**
 * Headers that let a mail client offer its own unsubscribe button, and
 * honour it without the reader ever opening the mail. RFC 8058.
 */
export function listUnsubscribeHeaders(
  id: number,
  lang: Locale,
  site = SITE,
): Record<string, string> {
  return {
    "List-Unsubscribe": `<mailto:care@quinacare.org?subject=unsubscribe>, <${unsubscribeUrl(id, lang, site)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
