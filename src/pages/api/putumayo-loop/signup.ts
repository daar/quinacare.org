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
import { countryName } from "../../../lib/countryName";
import {
  useTranslations,
  getDateLocale,
  type Lang,
  type TranslationKey,
} from "../../../i18n";
import {
  runManager,
  editions,
  hubDistances,
  type Distance,
} from "../../../data/putumayoLoop";
import { reportError } from "../../../lib/errors";

const SOURCE = "api/putumayo-loop/signup";

const ALLOWED_MODES = new Set(["individual", "hub"]);
const ALLOWED_DISTANCES = new Set(["10k", "half", "full"]);
const ALLOWED_LANGS = new Set<Lang>(["nl", "en", "es"]);

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
  let location = body.location ? String(body.location).trim() : null;
  const distance = String(body.distance ?? "");
  const editionYear = Number(body.editionYear);
  const rawLang = String(body.lang ?? "nl").toLowerCase() as Lang;
  const lang: Lang = ALLOWED_LANGS.has(rawLang) ? rawLang : "nl";

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
  // A hub only offers a subset of distances (e.g. Hulst skips the full
  // marathon). Reject a distance the chosen hub doesn't run, so a tampered
  // request can't bypass the UI's per-hub filtering.
  if (mode === "hub" && hubId) {
    const hub = editions
      .find((e) => e.year === editionYear)
      ?.hubs.find((h) => h.id === hubId);
    if (hub && !hubDistances(hub).includes(distance as Distance)) {
      return new Response(
        JSON.stringify({ error: "Distance not available for this hub" }),
        { status: 400 },
      );
    }
  }
  if (mode === "individual" && !location) {
    return new Response(JSON.stringify({ error: "Location required" }), {
      status: 400,
    });
  }

  // Best-effort geocoding for individual signups so they appear as a pin
  // on the map. Hub signups already use the hub's coords as a fallback
  // (see putumayoLoopRepo.rowToSubscriber), so we don't geocode for them.
  // Also backfill the country: when the runner types just "Amsterdam"
  // we append ", Nederland" / ", Netherlands" / ", Países Bajos" so the
  // feed shows a proper "City, country" matching the page locale.
  let lat: number | null = null;
  let lng: number | null = null;
  if (mode === "individual" && location) {
    const geo = await geocode(location);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      if (geo.countryCode && !location.includes(",")) {
        location = `${location}, ${countryName(geo.countryCode, lang)}`;
      }
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
    reportError(SOURCE, "Turso insert failed", err, { email, editionYear });
    return new Response(
      JSON.stringify({ error: "Could not save your signup" }),
      { status: 500 },
    );
  }

  // Resolve everything the three notification mails need once: the
  // edition (so we can format the run date), the hub (if any) and the
  // human-readable distance + date + where labels. The operational
  // mails (run manager, hub captain) get the English labels; the
  // runner confirmation gets the locale they signed up from.
  const edition = editions.find((e) => e.year === editionYear);
  const hub =
    mode === "hub" && hubId
      ? edition?.hubs.find((h) => h.id === hubId)
      : undefined;

  const tEn = useTranslations("en");
  const distanceKey: TranslationKey =
    distance === "10k"
      ? "putumayoLoop.distance10k"
      : distance === "half"
        ? "putumayoLoop.distanceHalf"
        : "putumayoLoop.distanceFull";
  const distanceLabelEn = tEn(distanceKey);
  const dateLabelEn = edition
    ? new Date(edition.runDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : String(editionYear);
  const whereLabelEn = hub
    ? `Hub ${hub.name} in ${hub.city}`
    : (location ?? "—");

  // Operational detail block reused in both the run manager and hub
  // captain mails. Plain text bullets keep it scannable in any client.
  const detailsEn = [
    `Runner: ${firstName} ${lastName} <${email}>`,
    `Edition: Putumayo Loop ${editionYear}`,
    `Date: ${dateLabelEn}`,
    `Distance: ${distanceLabelEn}`,
    `Where: ${whereLabelEn}`,
    `Mode: ${mode === "hub" ? "Hub" : "Individual"}`,
    `Signup language: ${lang}`,
  ].join("\n");

  // Best-effort: notify the run manager. We don't block the success
  // response on the mail; if it fails, the signup is still recorded.
  try {
    await sendMail({
      to: runManager.email,
      subject: `[Putumayo Loop ${editionYear}] New signup — ${firstName} ${lastName}`,
      text: `${firstName} ${lastName} just signed up for the Putumayo Loop ${editionYear}.\n\n${detailsEn}`,
      replyTo: `${firstName} ${lastName} <${email}>`,
    });
  } catch (err) {
    reportError(SOURCE, "run-manager notification mail failed", err);
  }

  // Hub signups only: also notify the hub captain if their email is on
  // record. This is independent of the runManager mail above — either
  // can fail without affecting the other.
  if (hub?.captainEmail) {
    try {
      await sendMail({
        to: hub.captainEmail,
        subject: `[Putumayo Loop ${editionYear} — ${hub.name}] New runner joined your hub`,
        text: `${firstName} ${lastName} just signed up for the Putumayo Loop ${editionYear} via your hub (${hub.name}, ${hub.city}).\n\n${detailsEn}`,
        replyTo: `${firstName} ${lastName} <${email}>`,
      });
    } catch (err) {
      reportError(SOURCE, "hub-captain mail failed", err, { hubId });
    }
  }

  // Confirmation mail to the runner, localised to the page they signed up
  // from. Pulls the human distance label + run date + "where" (hub or
  // free-text location) so they get a tidy receipt of what we recorded.
  try {
    const t = useTranslations(lang);
    const tk = (key: string) => t(key as TranslationKey);
    const distanceLabel = tk(distanceKey);
    const dateLabel = edition
      ? new Date(edition.runDate).toLocaleDateString(getDateLocale(lang), {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : String(editionYear);
    const whereLabel = hub
      ? tk("putumayoLoop.emailHubWhere")
          .replace("{hub}", hub.name)
          .replace("{city}", hub.city)
      : (location ?? "—");
    const subject = tk("putumayoLoop.emailSubject").replace(
      "{year}",
      String(editionYear),
    );
    const text = tk("putumayoLoop.emailBody")
      .replace("{name}", firstName)
      .replace("{year}", String(editionYear))
      .replace("{date}", dateLabel)
      .replace("{distance}", distanceLabel)
      .replace("{where}", whereLabel)
      .replace("{contactEmail}", runManager.email);

    await sendMail({
      to: email,
      subject,
      text,
      replyTo: runManager.email,
    });
  } catch (err) {
    reportError(SOURCE, "runner-confirmation mail failed", err, { email });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
