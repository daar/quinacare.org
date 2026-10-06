export const prerender = false;

import type { APIRoute } from "astro";
import { getDb, ensureSchema } from "../../../lib/db";
import { subscribe, isLocale } from "../../../lib/subscribers";

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const { name, email, newsletter, locale } = await request.json();

  if (!name || !email || typeof email !== "string") {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
    });
  }

  await ensureSchema();
  const db = getDb();

  await db.execute({
    sql: `INSERT INTO donor_thanks (name, email, locale) VALUES (?, ?, ?)`,
    args: [name.trim(), email.toLowerCase().trim(), locale ?? "nl"],
  });

  // Only when the box was ticked — it is unchecked by default, which is
  // what makes this consent rather than something bundled with the gift.
  if (newsletter) {
    await subscribe({
      email,
      locale: isLocale(locale) ? locale : "nl",
      // They have just typed their name for the thank-you note, so the
      // newsletter list gets one too without asking for it twice.
      name,
      source: "donation-thanks",
      ip: clientAddress ?? null,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
