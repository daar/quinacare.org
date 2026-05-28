#!/usr/bin/env node
/**
 * Putumayo Loop — Turso schema + seed.
 *
 * Idempotent: creates `putumayo_loop_editions`, `putumayo_loop_hubs`, and
 * `putumayo_loop_subscribers` if they don't exist, then upserts the
 * editions and hubs from the snapshot below and re-imports the seed
 * subscribers (keyed on `external_id`). Live signups (rows where
 * external_id IS NULL) are never touched.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-putumayo-loop.mjs
 */

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in env");
  process.exit(1);
}

const db = createClient({ url, authToken });

// ── snapshot (mirror of what src/data/putumayoLoop.ts used to hold) ───

const editions = [
  {
    year: 2025,
    slug: "2025",
    fundraiser_slug: "putumayo-loop-2025",
    title: "Putumayo Loop 2025",
    run_date: "2025-10-26",
    status: "past",
    raised_amount: 3000,
    target_amount: 3000,
    donors: 62,
    currency: "EUR",
    total_runners: null, // derived from sum(count) on the page
    story_key: null,
    story_nl:
      "In 2025 vierden we het lustrum van de Putumayo Loop. Voor het eerst werd op meerdere plekken in de wereld tegelijk gelopen — Putumayo, Den Haag en Hulst — met in totaal meer dan 150 deelnemers. Een dag om nooit te vergeten.",
    story_en:
      "In 2025 we celebrated the fifth anniversary of the Putumayo Loop. For the first time runners gathered in multiple cities at once — Putumayo, The Hague and Hulst — with more than 150 participants in total. A day to remember.",
    story_es:
      "En 2025 celebramos el quinto aniversario del Putumayo Loop. Por primera vez se corrió simultáneamente en varias ciudades — Putumayo, La Haya y Hulst — con más de 150 participantes en total. Un día para recordar.",
    youtube_id: "Fc6XaeLGLdw",
  },
  {
    year: 2026,
    slug: "2026",
    fundraiser_slug: "putumayo-loop-2026",
    title: "Putumayo Loop 2026",
    run_date: "2026-10-18",
    status: "active",
    raised_amount: 1234,
    target_amount: 10000,
    donors: 47,
    currency: "EUR",
    total_runners: null,
    story_key: null,
    story_nl: null,
    story_en: null,
    story_es: null,
    youtube_id: null,
  },
];

// Hubs — 2025 had no published hubs; 2026 has three with named organisers.
const hubs = [
  {
    edition_year: 2026,
    id: "putumayo",
    name: "Putumayo",
    city: "Puerto el Carmen",
    country: "Ecuador",
    lat: 0.118,
    lng: -75.91,
    captain: "Jacob van der Ende",
    display_order: 0,
  },
  {
    edition_year: 2026,
    id: "den-haag",
    name: "Den Haag",
    city: "Den Haag",
    country: "Nederland",
    lat: 52.0705,
    lng: 4.3007,
    captain: "Sarah Blaszyk",
    display_order: 1,
  },
];

const subscribers = [
  // 2025 — aggregate counts per location, no individual names tracked.
  {
    external_id: "p25-puertocarmen",
    edition_year: 2025,
    lat: 0.118,
    lng: -75.91,
    count: 150,
    signed_up_at: "2025-10-26T13:00:00Z",
  },
  {
    external_id: "p25-den-haag",
    edition_year: 2025,
    lat: 52.0705,
    lng: 4.3007,
    count: 4,
    signed_up_at: "2025-10-26T13:00:00Z",
  },
  {
    external_id: "p25-groningen",
    edition_year: 2025,
    lat: 53.2194,
    lng: 6.5665,
    count: 4,
    signed_up_at: "2025-10-26T13:00:00Z",
  },
  {
    external_id: "p25-singapore",
    edition_year: 2025,
    lat: 1.3521,
    lng: 103.8198,
    count: 4,
    signed_up_at: "2025-10-26T13:00:00Z",
  },
  {
    external_id: "p25-bangkok",
    edition_year: 2025,
    lat: 13.7563,
    lng: 100.5018,
    count: 2,
    signed_up_at: "2025-10-26T13:00:00Z",
  },
  {
    external_id: "p25-amersfoort",
    edition_year: 2025,
    lat: 52.1561,
    lng: 5.3878,
    count: 2,
    signed_up_at: "2025-10-26T13:00:00Z",
  },
  {
    external_id: "p25-amsterdam",
    edition_year: 2025,
    lat: 52.3676,
    lng: 4.9041,
    count: 2,
    signed_up_at: "2025-10-26T13:00:00Z",
  },
  {
    external_id: "p25-eindhoven",
    edition_year: 2025,
    lat: 51.4416,
    lng: 5.4697,
    count: 2,
    signed_up_at: "2025-10-26T13:00:00Z",
  },
  {
    external_id: "p25-paris",
    edition_year: 2025,
    lat: 48.8566,
    lng: 2.3522,
    count: 1,
    signed_up_at: "2025-10-26T13:00:00Z",
  },
  {
    external_id: "p25-hulst",
    edition_year: 2025,
    lat: 51.2802,
    lng: 4.0521,
    count: 1,
    signed_up_at: "2025-10-26T13:00:00Z",
  },
  {
    external_id: "p25-new-york",
    edition_year: 2025,
    lat: 40.7128,
    lng: -74.006,
    count: 1,
    signed_up_at: "2025-10-26T13:00:00Z",
  },

  // 2026 — mock individual signups (named, with hubs).
  {
    external_id: "s1",
    edition_year: 2026,
    first_name: "Pietje",
    last_name: "Bell",
    hub_id: "hulst",
    lat: 51.281,
    lng: 4.052,
    signed_up_at: "2026-05-22T09:30:00Z",
  },
  {
    external_id: "s2",
    edition_year: 2026,
    first_name: "Sofía",
    last_name: "Ramírez",
    hub_id: "putumayo",
    lat: 0.12,
    lng: -75.91,
    signed_up_at: "2026-05-21T14:12:00Z",
  },
  {
    external_id: "s3",
    edition_year: 2026,
    first_name: "Yvonne",
    last_name: "van der Ende",
    hub_id: "den-haag",
    lat: 52.071,
    lng: 4.301,
    signed_up_at: "2026-05-21T18:45:00Z",
  },
  {
    external_id: "s4",
    edition_year: 2026,
    first_name: "Marco",
    last_name: "Bianchi",
    lat: 45.4642,
    lng: 9.19,
    signed_up_at: "2026-05-20T07:00:00Z",
  },
  {
    external_id: "s5",
    edition_year: 2026,
    first_name: "Hans",
    last_name: "Schmidt",
    hub_id: "hulst",
    lat: 50.852,
    lng: 5.691,
    signed_up_at: "2026-05-19T16:22:00Z",
  },
  {
    external_id: "s6",
    edition_year: 2026,
    first_name: "Akiko",
    last_name: "Tanaka",
    lat: 35.6762,
    lng: 139.6503,
    signed_up_at: "2026-05-19T11:00:00Z",
  },
  {
    external_id: "s7",
    edition_year: 2026,
    first_name: "Lucas",
    last_name: "Smit",
    hub_id: "den-haag",
    lat: 52.072,
    lng: 4.31,
    signed_up_at: "2026-05-18T08:30:00Z",
  },
  {
    external_id: "s8",
    edition_year: 2026,
    first_name: "María",
    last_name: "González",
    hub_id: "putumayo",
    lat: 0.125,
    lng: -75.905,
    signed_up_at: "2026-05-17T13:15:00Z",
  },
  {
    external_id: "s9",
    edition_year: 2026,
    first_name: "Tom",
    last_name: "Berger",
    lat: -33.8688,
    lng: 151.2093,
    signed_up_at: "2026-05-16T10:00:00Z",
  },
  {
    external_id: "s10",
    edition_year: 2026,
    first_name: "Karin",
    last_name: "Martens",
    hub_id: "hulst",
    lat: 51.279,
    lng: 4.054,
    signed_up_at: "2026-05-15T19:45:00Z",
  },
  {
    external_id: "s11",
    edition_year: 2026,
    first_name: "Femke",
    last_name: "Visser",
    hub_id: "hulst",
    lat: 50.85,
    lng: 5.692,
    signed_up_at: "2026-05-14T07:15:00Z",
  },
  {
    external_id: "s12",
    edition_year: 2026,
    first_name: "Diego",
    last_name: "Hernández",
    lat: 40.4168,
    lng: -3.7038,
    signed_up_at: "2026-05-13T17:00:00Z",
  },
  {
    external_id: "s13",
    edition_year: 2026,
    first_name: "Anneke",
    last_name: "Jansen",
    hub_id: "den-haag",
    lat: 52.08,
    lng: 4.305,
    signed_up_at: "2026-05-12T09:00:00Z",
  },
  {
    external_id: "s14",
    edition_year: 2026,
    first_name: "James",
    last_name: "O'Connor",
    lat: 53.3498,
    lng: -6.2603,
    signed_up_at: "2026-05-11T20:00:00Z",
  },
  {
    external_id: "s15",
    edition_year: 2026,
    first_name: "Carla",
    last_name: "Mendoza",
    hub_id: "putumayo",
    lat: 0.115,
    lng: -75.92,
    signed_up_at: "2026-05-10T06:30:00Z",
  },
];

// ── schema ────────────────────────────────────────────────────────────

async function tryAlter(sql) {
  try {
    await db.execute(sql);
  } catch (e) {
    if (!/duplicate column|already exists/i.test(String(e?.message ?? e)))
      throw e;
  }
}

async function ensureSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS putumayo_loop_editions (
      year            INTEGER PRIMARY KEY,
      slug            TEXT NOT NULL UNIQUE,
      fundraiser_slug TEXT NOT NULL,
      title           TEXT NOT NULL,
      run_date        TEXT NOT NULL,
      status          TEXT NOT NULL CHECK (status IN ('upcoming','active','past')),
      raised_amount   INTEGER NOT NULL,
      target_amount   INTEGER NOT NULL,
      donors          INTEGER NOT NULL DEFAULT 0,
      currency        TEXT NOT NULL DEFAULT 'EUR',
      total_runners   INTEGER,
      story_key       TEXT,
      story_nl        TEXT,
      story_en        TEXT,
      story_es        TEXT,
      youtube_id      TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS putumayo_loop_hubs (
      edition_year  INTEGER NOT NULL,
      id            TEXT NOT NULL,
      name          TEXT NOT NULL,
      city          TEXT NOT NULL,
      country       TEXT NOT NULL,
      lat           REAL NOT NULL,
      lng           REAL NOT NULL,
      captain       TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (edition_year, id),
      FOREIGN KEY (edition_year) REFERENCES putumayo_loop_editions(year)
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS putumayo_loop_subscribers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id   TEXT UNIQUE,
      edition_year  INTEGER NOT NULL,
      first_name    TEXT,
      last_name     TEXT,
      email         TEXT,
      hub_id        TEXT,
      lat           REAL,
      lng           REAL,
      location      TEXT,
      count         INTEGER NOT NULL DEFAULT 1,
      signed_up_at  TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (edition_year) REFERENCES putumayo_loop_editions(year)
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_subscribers_edition ON putumayo_loop_subscribers (edition_year)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_hubs_edition ON putumayo_loop_hubs (edition_year)`,
  );
  // Idempotent column additions for pre-existing tables.
  await tryAlter(`ALTER TABLE putumayo_loop_editions ADD COLUMN story_nl TEXT`);
  await tryAlter(`ALTER TABLE putumayo_loop_editions ADD COLUMN story_en TEXT`);
  await tryAlter(`ALTER TABLE putumayo_loop_editions ADD COLUMN story_es TEXT`);
}

// ── seed ──────────────────────────────────────────────────────────────

async function upsertEditions() {
  for (const e of editions) {
    await db.execute({
      sql: `
        INSERT INTO putumayo_loop_editions
          (year, slug, fundraiser_slug, title, run_date, status,
           raised_amount, target_amount, donors, currency,
           total_runners, story_key, youtube_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(year) DO UPDATE SET
          slug=excluded.slug,
          fundraiser_slug=excluded.fundraiser_slug,
          title=excluded.title,
          run_date=excluded.run_date,
          status=excluded.status,
          raised_amount=excluded.raised_amount,
          target_amount=excluded.target_amount,
          donors=excluded.donors,
          currency=excluded.currency,
          total_runners=excluded.total_runners,
          story_key=excluded.story_key,
          youtube_id=excluded.youtube_id
      `,
      args: [
        e.year,
        e.slug,
        e.fundraiser_slug,
        e.title,
        e.run_date,
        e.status,
        e.raised_amount,
        e.target_amount,
        e.donors,
        e.currency,
        e.total_runners,
        e.story_key,
        e.youtube_id,
      ],
    });
  }
}

async function upsertHubs() {
  // Wipe each edition's hub set then re-insert the declared list, so
  // hubs removed from the snapshot are also removed from the DB.
  const years = Array.from(new Set(hubs.map((h) => h.edition_year)));
  for (const year of years) {
    await db.execute({
      sql: `DELETE FROM putumayo_loop_hubs WHERE edition_year = ?`,
      args: [year],
    });
  }
  for (const h of hubs) {
    await db.execute({
      sql: `
        INSERT INTO putumayo_loop_hubs
          (edition_year, id, name, city, country, lat, lng, captain, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(edition_year, id) DO UPDATE SET
          name=excluded.name,
          city=excluded.city,
          country=excluded.country,
          lat=excluded.lat,
          lng=excluded.lng,
          captain=excluded.captain,
          display_order=excluded.display_order
      `,
      args: [
        h.edition_year,
        h.id,
        h.name,
        h.city,
        h.country,
        h.lat,
        h.lng,
        h.captain,
        h.display_order,
      ],
    });
  }
}

async function upsertSubscribers() {
  for (const s of subscribers) {
    await db.execute({
      sql: `
        INSERT INTO putumayo_loop_subscribers
          (external_id, edition_year, first_name, last_name, email,
           hub_id, lat, lng, location, count, signed_up_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(external_id) DO UPDATE SET
          edition_year=excluded.edition_year,
          first_name=excluded.first_name,
          last_name=excluded.last_name,
          email=excluded.email,
          hub_id=excluded.hub_id,
          lat=excluded.lat,
          lng=excluded.lng,
          location=excluded.location,
          count=excluded.count,
          signed_up_at=excluded.signed_up_at
      `,
      args: [
        s.external_id,
        s.edition_year,
        s.first_name ?? null,
        s.last_name ?? null,
        s.email ?? null,
        s.hub_id ?? null,
        s.lat ?? null,
        s.lng ?? null,
        s.location ?? null,
        s.count ?? 1,
        s.signed_up_at,
      ],
    });
  }
}

// ── main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("ensuring schema…");
  await ensureSchema();
  console.log("upserting editions…");
  await upsertEditions();
  console.log("upserting hubs…");
  await upsertHubs();
  console.log("upserting subscribers…");
  await upsertSubscribers();

  // Quick stats so the operator can sanity-check.
  for (const t of [
    "putumayo_loop_editions",
    "putumayo_loop_hubs",
    "putumayo_loop_subscribers",
  ]) {
    const r = await db.execute(`SELECT count(*) AS n FROM ${t}`);
    console.log(`  ${t.padEnd(30)} -> ${r.rows[0].n} rows`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
