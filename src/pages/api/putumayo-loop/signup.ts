// POST /api/putumayo-loop/signup
//
// Receives a Putumayo Loop runner registration from the public signup
// modal. Writes the row to Turso (putumayo_loop_subscribers, the same
// table the seed data lives in) and notifies the run manager (see
// `runManager` in src/data/putumayoLoop.ts) by email.
//
// Schema is created by scripts/migrate-putumayo-loop.mjs; live signups
// leave external_id NULL so they don't collide with seed rows. Lat/lng
// stay NULL until a geocoding step turns the `location` string into
// coords — until then those signups simply don't appear as map pins.

export const prerender = false;

import type { APIRoute } from "astro";
import { getTurso } from "../../../lib/turso";
import { sendMail } from "../../../lib/mailer";
import { geocode } from "../../../lib/geocode";
import { runManager, editions } from "../../../data/putumayoLoop";

const ALLOWED_MODES = new Set(["individual", "hub"]);
const ALLOWED_DISTANCES = new Set(["10k", "half", "full"]);

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
  const distance = String(body.distance ?? "");
  const editionYear = Number(body.editionYear);

  if (
    !firstName ||
    !lastName ||
    !email ||
    !ALLOWED_MODES.has(mode) ||
    !ALLOWED_DISTANCES.has(distance) ||
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

  // Best-effort geocoding for individual signups so they appear as a pin
  // on the map. Hub signups already use the hub's coords as a fallback
  // (see putumayoLoopRepo.rowToSubscriber), so we don't geocode for them.
  let lat: number | null = null;
  let lng: number | null = null;
  if (mode === "individual" && location) {
    const geo = await geocode(location);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
    }
  }

  try {
    const db = getTurso();
    // Insert directly — the table is created by the migration script. If
    // it's missing we want a loud 500 rather than a silent CREATE in the
    // hot path.
    await db.execute({
      sql: `
        INSERT INTO putumayo_loop_subscribers
          (external_id, edition_year, first_name, last_name, email,
           hub_id, lat, lng, location, count, distance, signed_up_at)
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
      `,
      args: [
        editionYear,
        firstName,
        lastName,
        email,
        hubId,
        lat,
        lng,
        location,
        distance,
      ],
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

  // Hub signups only: also notify the hub captain if their email is on
  // record. This is independent of the runManager mail above — either
  // can fail without affecting the other.
  if (mode === "hub" && hubId) {
    const edition = editions.find((e) => e.year === editionYear);
    const hub = edition?.hubs.find((h) => h.id === hubId);
    if (hub?.captainEmail) {
      try {
        await sendMail({
          to: hub.captainEmail,
          subject: `[Putumayo Loop ${editionYear} — ${hub.name}] New runner joined your hub`,
          text: `${firstName} ${lastName} <${email}> just signed up for the Putumayo Loop ${editionYear} via your hub (${hub.name}, ${hub.city}).`,
          replyTo: `${firstName} ${lastName} <${email}>`,
        });
      } catch (err) {
        console.error("[putumayo-loop/signup] hub captain mail failed:", err);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
