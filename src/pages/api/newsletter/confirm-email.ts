export const prerender = false;

import type { APIRoute } from "astro";
import {
  changeEmail,
  subscriberToken,
  verifyEmailChangeToken,
  isLocale,
  PREFERENCES_PATH,
  type Locale,
} from "../../../lib/subscribers";

/**
 * The second half of an address change: proof that the new address wants
 * the mail. Until this link is clicked nothing has moved.
 */
export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("u"));
  const email = url.searchParams.get("e") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const langRaw = url.searchParams.get("lang");
  const lang: Locale = isLocale(langRaw) ? langRaw : "nl";
  const back = PREFERENCES_PATH[lang];

  let ok: boolean;
  try {
    ok =
      Number.isInteger(id) &&
      id > 0 &&
      verifyEmailChangeToken(id, email, token) &&
      (await changeEmail(id, email));
  } catch {
    ok = false;
  }

  if (!ok) {
    // Also the path for "that address is already on the list" — merging
    // two subscribers is a decision for a person, not a form.
    return redirect(`${back}?status=email-failed`, 302);
  }

  return redirect(
    `${back}?u=${id}&t=${encodeURIComponent(subscriberToken(id))}&status=email-changed`,
    302,
  );
};
