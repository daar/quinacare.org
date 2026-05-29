import { getDb, ensureSchema } from "./db";

// User-Agent fragments that strongly indicate non-human traffic.
// Conservative on purpose — false positives are cheap (we still keep
// every row), false negatives are the only thing that pollutes the
// "human" view. Refine the regex over time as Turso shows new actors.
const BOT_UA =
  /bot|crawler|spider|slurp|curl|wget|python|node-fetch|axios|httpclient|java\/|go-http|libwww|lighthouse|headlesschrome|puppeteer|playwright|httrack|scanner|monitor|facebookexternalhit|twitterbot|telegram|whatsapp|line\/|skypeuripreview|discordbot|monitis|pingdom|uptimerobot|ahrefs|semrush|moz\.com|petalbot|mj12bot|bytespider|nuclei|nikto|zgrab|masscan|sqlmap|go-resty|okhttp|apache-httpclient/i;

/**
 * Tag a User-Agent as bot or human. Conservative — empty/missing UA
 * is treated as bot (real browsers always send one). This is just a
 * stored hint; the raw UA is also kept so the classification can be
 * revisited at query time.
 */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return BOT_UA.test(userAgent);
}

export interface LogPageMissInput {
  /** Pathname plus query string of the missed URL. */
  path: string;
  /** document.referrer from the client, if any. */
  referrer?: string | null;
  /** User-Agent header (server-supplied, not client). */
  userAgent?: string | null;
  /** Accept-Language header. */
  language?: string | null;
}

/**
 * Append a 404 hit to the page_misses table. Best-effort: a logging
 * failure must never propagate out of the beacon handler.
 */
export async function logPageMiss(input: LogPageMissInput): Promise<void> {
  try {
    await ensureSchema();
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO page_misses
              (path, referrer, user_agent, language, is_bot)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        input.path.slice(0, 2000),
        input.referrer ? input.referrer.slice(0, 2000) : null,
        input.userAgent ? input.userAgent.slice(0, 500) : null,
        input.language ? input.language.slice(0, 100) : null,
        isLikelyBot(input.userAgent) ? 1 : 0,
      ],
    });
  } catch (err) {
    // Bottom of the chain — only console.warn so we never recurse.
    console.warn("[page-misses] logPageMiss failed:", err);
  }
}
