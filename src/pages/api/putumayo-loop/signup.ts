// POST /api/putumayo-loop/signup
//
// Receives a Putumayo Loop runner registration from the public signup
// modal. Writes the row to Turso and notifies the run manager
// (see `runManager` in src/data/putumayoLoop.ts) by email.

export const prerender = false;

import type { APIRoute } from "astro";
import { getTurso } from "../../../lib/turso";
import { sendMail } from "../../../lib/mailer";
import { runManager } from "../../../data/putumayoLoop";

const ALLOWED_MODES = new Set(["individual", "hub"]);

async function ensureTable() {
  const db = getTurso();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS putumayo_loop_signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edition_year INTEGER NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('individual', 'hub')),
      hub_id TEXT,
      location TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const mode = String(body.mode ?? "");
  const hubId = body.hubId ? String(body.hubId).trim() : null;
  const location = body.location ? String(body.location).trim() : null;
  const editionYear = Number(body.editionYear);

  if (
    !firstName ||
    !lastName ||
    !email ||
    !ALLOWED_MODES.has(mode) ||
    !Number.isFinite(editionYear)
  ) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid fields" }),
      {
        status: 400,
      },
    );
  }
  if (mode === "hub" && !hubId) {
    return new Response(JSON.stringify({ error: "Hub id required" }), {
      status: 400,
    });
  }
  if (mode === "individual" && !location) {
    return new Response(JSON.stringify({ error: "Location required" }), {
      status: 400,
    });
  }

  try {
    const db = getTurso();
    await ensureTable();
    await db.execute({
      sql: `
        INSERT INTO putumayo_loop_signups
          (edition_year, first_name, last_name, email, mode, hub_id, location)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [editionYear, firstName, lastName, email, mode, hubId, location],
    });
  } catch (err) {
    console.error("[putumayo-loop/signup] Turso insert failed:", err);
    return new Response(
      JSON.stringify({ error: "Could not save your signup" }),
      { status: 500 },
    );
  }

  // Best-effort: notify the run manager. We don't block the success
  // response on the mail; if it fails, the signup is still recorded.
  try {
    const where =
      mode === "hub" ? `joining hub: ${hubId}` : `running from: ${location}`;
    await sendMail({
      to: runManager.email,
      subject: `[Putumayo Loop ${editionYear}] New signup — ${firstName} ${lastName}`,
      text: `${firstName} ${lastName} <${email}> just signed up for the Putumayo Loop ${editionYear}.\n\n${where}`,
      replyTo: `${firstName} ${lastName} <${email}>`,
    });
  } catch (err) {
    console.error("[putumayo-loop/signup] notification mail failed:", err);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
