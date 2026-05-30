export const prerender = false;

import type { APIRoute } from "astro";
import { logError } from "../../../lib/errors";

interface Body {
  source?: string;
  message?: string;
  context?: Record<string, unknown>;
}

const MAX_BODY = 8000; // bytes — clients shouldn't send huge stacks
const MAX_PER_MIN = 60; // per cold start; floods get capped

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
 * Client-side error sink — the browser fires beacons here from the
 * global window.error / unhandledrejection listeners in Layout.astro
 * and from any in-component try/catch that wants to be analyzable
 * later. Logs land in the same app_errors table as server-side
 * reportError calls, with source prefixed `client:` so they're easy
 * to filter.
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

  if (!body.source || !body.message) {
    return new Response("Bad", { status: 400 });
  }

  const source = body.source.startsWith("client:")
    ? body.source
    : `client:${body.source}`;

  // Browsers emit the literal "Script error." with a null stack when a
  // cross-origin script throws and the upstream isn't sending CORS
  // headers we can read. There's nothing actionable in those rows —
  // tag them as `warning` so dashboards can filter the noise out and
  // real, fixable errors stay visible.
  const messageStr = String(body.message);
  const ctx = (body.context ?? {}) as Record<string, unknown>;
  const isCorsStripped =
    messageStr === "Script error." &&
    (ctx.stack === null || ctx.stack === undefined);
  const level: "warning" | "error" = isCorsStripped ? "warning" : "error";

  await logError({
    source,
    level,
    message: messageStr.slice(0, 1000),
    context: {
      ...ctx,
      userAgent: request.headers.get("user-agent") ?? undefined,
      referer: request.headers.get("referer") ?? undefined,
    },
  });

  return new Response("OK", { status: 200 });
};
