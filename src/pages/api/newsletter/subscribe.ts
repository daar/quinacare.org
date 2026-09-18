export const prerender = false;

import type { APIRoute } from "astro";
import { subscribe, isLocale, normaliseEmail } from "../../../lib/subscribers";

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const { email, locale, name } = await request.json();

  if (!normaliseEmail(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), {
      status: 400,
    });
  }

  // The locale is written into a comma-separated set, so an unchecked
  // value here would let a crafted request inject arbitrary text or extra
  // delimiters into that column. The widget only ever sends the page
  // language, which is always one of the three.
  if (!isLocale(locale)) {
    return new Response(JSON.stringify({ error: "Invalid locale" }), {
      status: 400,
    });
  }

  const result = await subscribe({
    email,
    locale,
    name,
    source: "website",
    // Kept as evidence that the signup was a real act by a real visitor.
    ip: clientAddress ?? null,
  });

  if (!result) {
    return new Response(JSON.stringify({ error: "Invalid email" }), {
      status: 400,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
