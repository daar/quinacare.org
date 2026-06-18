export const prerender = false;

import type { APIRoute } from "astro";
import { recordView } from "../../../lib/postViews";

interface Body {
  slug?: string;
  lang?: string;
}

const MAX_BODY = 2000;
const MAX_PER_MIN = 240;

let count = 0;
let windowStart = Date.now();
function allow(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    count = 0;
  }
  if (count >= MAX_PER_MIN) return false;
  count++;
  return true;
}

/**
 * View-counter beacon for news posts. The post page POSTs its slug+lang;
 * the server resolves the client IP and records one view per hashed IP
 * per 24h. Writes happen only in production builds — local dev is a
 * no-op so it never pollutes the counter.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!import.meta.env.PROD) {
    return new Response("OK (dev no-op)", { status: 200 });
  }
  if (!allow()) return new Response("Rate limit", { status: 429 });

  let body: Body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return new Response("Too big", { status: 413 });
    body = JSON.parse(text) as Body;
  } catch {
    return new Response("Bad", { status: 400 });
  }

  if (!body.slug || typeof body.slug !== "string") {
    return new Response("Bad", { status: 400 });
  }

  let ip: string | null = null;
  try {
    ip = clientAddress || null;
  } catch {
    ip = null;
  }
  if (!ip) {
    ip =
      request.headers.get("x-nf-client-connection-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
  }

  await recordView({
    slug: body.slug,
    lang: body.lang || "nl",
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  return new Response("OK", { status: 200 });
};
