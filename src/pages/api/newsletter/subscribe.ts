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

  try {
    await db.execute({
      sql: `INSERT INTO subscribers (email, locale) VALUES (?, ?)`,
      args: [email.toLowerCase().trim(), locale ?? "nl"],
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("UNIQUE")) {
      // Already subscribed — treat as success
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw e;
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
