export const prerender = false;

import type { APIRoute } from "astro";
import {
  unsubscribe,
  verifySubscriberToken,
  isLocale,
  PREFERENCES_PATH,
  type Locale,
} from "../../../lib/subscribers";

function parse(url: URL): { id: number; token: string; lang: Locale } {
  const lang = url.searchParams.get("lang");
  return {
    id: Number(url.searchParams.get("u")),
    token: url.searchParams.get("t") ?? "",
    lang: isLocale(lang) ? lang : "nl",
  };
}

async function apply(url: URL): Promise<boolean> {
  const { id, token } = parse(url);
  if (!Number.isInteger(id) || id <= 0) return false;
  try {
    // A missing secret throws: treat that as a failure, never as success.
    if (!verifySubscriberToken(id, token)) return false;
  } catch {
    return false;
  }
  await unsubscribe(id, "link");
  return true;
}

/**
 * Clicking the link in a newsletter. Yes, a GET that changes something:
 * that is exactly what "click to unsubscribe" means, and putting a
 * confirm button in front of it works against the promise. The landing
 * page offers an undo instead.
 */
export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const { id, token, lang } = parse(url);
  const ok = await apply(url);

  // A bad token must not reveal whether the id exists, so both cases land
  // on the same page and it simply tells them to mail us instead.
  const target = ok
    ? `${PREFERENCES_PATH[lang]}?u=${id}&t=${encodeURIComponent(token)}&status=unsubscribed`
    : `${PREFERENCES_PATH[lang]}?status=error`;
  return redirect(target, 302);
};

/**
 * RFC 8058 one-click, used by the mail client itself. checkOrigin is
 * disabled globally in astro.config.mjs, so a POST arriving without an
 * Origin header is not rejected.
 */
export const POST: APIRoute = async ({ request }) => {
  await apply(new URL(request.url));
  // Always 200: the sender must not learn whether the address was known.
  return new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
};
