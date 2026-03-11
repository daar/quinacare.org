export const prerender = false;

import type { APIRoute } from "astro";
import { getDb, ensureSchema } from "../../../lib/db";

export const POST: APIRoute = async ({ request }) => {
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

  if (newsletter) {
    try {
      await db.execute({
        sql: `INSERT INTO subscribers (email, locale) VALUES (?, ?)`,
        args: [email.toLowerCase().trim(), locale ?? "nl"],
      });
    } catch {
      // already subscribed — ignore
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
