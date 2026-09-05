export const prerender = false;

import type { APIRoute } from "astro";
import { getDb, ensureSchema } from "../../../lib/db";

export const POST: APIRoute = async ({ request }) => {
  const { email, locale } = await request.json();

  if (
    !email ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return new Response(JSON.stringify({ error: "Invalid email" }), {
      status: 400,
    });
  }

  await ensureSchema();
  const db = getDb();

  // Someone already on one language list who signs up on another gets
  // that language added to their set, rather than the signup being
  // silently dropped as a duplicate. Re-subscribing to the same list is
  // a no-op.
  await db.execute({
    sql: `INSERT INTO subscribers (email, locale) VALUES (?, ?)
         ON CONFLICT(email) DO UPDATE SET locale =
           CASE
             WHEN ',' || locale || ',' LIKE '%,' || excluded.locale || ',%'
               THEN locale
             ELSE locale || ',' || excluded.locale
           END`,
    args: [email.toLowerCase().trim(), locale ?? "nl"],
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
