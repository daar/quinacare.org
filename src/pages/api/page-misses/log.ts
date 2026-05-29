export const prerender = false;

import type { APIRoute } from "astro";
import { logPageMiss } from "../../../lib/pageMisses";

interface Body {
  path?: string;
  referrer?: string;
}

const MAX_BODY = 4000;
const MAX_PER_MIN = 120; // 404 beacons can spike; keep the cap roomy

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
 * Client beacon endpoint for the 404 page. The browser POSTs the
 * requested path and document.referrer; the server enriches with the
 * User-Agent and Accept-Language headers (more reliable than client-
 * supplied) before writing to page_misses.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!allow()) return new Response("Rate limit", { status: 429 });

  let body: Body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return new Response("Too big", { status: 413 });
    body = JSON.parse(text) as Body;
  } catch {
    return new Response("Bad", { status: 400 });
  }

  if (!body.path || typeof body.path !== "string") {
    return new Response("Bad", { status: 400 });
  }

  await logPageMiss({
    path: body.path,
    referrer: body.referrer ?? null,
    userAgent: request.headers.get("user-agent"),
    language: request.headers.get("accept-language"),
  });

  return new Response("OK", { status: 200 });
};
