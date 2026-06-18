import crypto from "node:crypto";
import { getDb, ensureSchema } from "./db";
import { isLikelyBot } from "./pageMisses";

// Salt for the IP hash. We never store the raw IP — only a salted hash,
// used purely to de-duplicate a click to one per visitor per 24h. A
// dedicated env var can override the (non-secret) default.
const SALT = import.meta.env.VIEW_COUNTER_SALT || "quina-care-post-views";

function hashIp(ip: string): string {
  return crypto
    .createHash("sha256")
    .update(`${SALT}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export interface RecordViewInput {
  slug: string;
  lang: string;
  ip: string | null;
  userAgent?: string | null;
}

/**
 * Record one view for a post, de-duplicated to a single click per hashed
 * IP per 24h. Bots are skipped. Best-effort: a failure must never bubble
 * up into the request handler.
 */
export async function recordView(input: RecordViewInput): Promise<void> {
  if (!input.slug || !input.ip) return;
  if (isLikelyBot(input.userAgent)) return;
  try {
    await ensureSchema();
    const db = getDb();
    const ipHash = hashIp(input.ip);
    const existing = await db.execute({
      sql: `SELECT 1 FROM post_views
            WHERE slug = ? AND ip_hash = ? AND created_at > datetime('now', '-1 day')
            LIMIT 1`,
      args: [input.slug, ipHash],
    });
    if (existing.rows.length > 0) return;
    await db.execute({
      sql: `INSERT INTO post_views (slug, lang, ip_hash) VALUES (?, ?, ?)`,
      args: [
        input.slug.slice(0, 200),
        (input.lang || "nl").slice(0, 5),
        ipHash,
      ],
    });
  } catch (err) {
    console.warn("[post-views] recordView failed:", err);
  }
}

export interface PopularPost {
  slug: string;
  views: number;
}

/**
 * Top `limit` posts by view count over the trailing `days` window, for a
 * given language, most-viewed first. Returns [] on any failure (e.g.
 * Turso not configured in local dev).
 */
export async function getPopular(
  lang: string,
  limit = 5,
  days = 30,
): Promise<PopularPost[]> {
  try {
    await ensureSchema();
    const db = getDb();
    const res = await db.execute({
      sql: `SELECT slug, COUNT(*) AS views
            FROM post_views
            WHERE lang = ? AND created_at > datetime('now', ?)
            GROUP BY slug
            ORDER BY views DESC, slug ASC
            LIMIT ?`,
      args: [lang, `-${days} days`, limit],
    });
    return res.rows.map((r) => ({
      slug: String(r.slug),
      views: Number(r.views),
    }));
  } catch (err) {
    console.warn("[post-views] getPopular failed:", err);
    return [];
  }
}
