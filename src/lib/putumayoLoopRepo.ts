// Putumayo Loop — Turso-backed read access.
//
// Used by the landing page, the per-year archive page, and the edition
// navigator. Writes (live signups) go through the API endpoint at
// src/pages/api/putumayo-loop/signup.ts which inserts into the same
// putumayo_loop_subscribers table.
//
// Schema lives in scripts/migrate-putumayo-loop.mjs.

import type {
  Edition,
  EditionStatus,
  Hub,
  Subscriber,
} from "../data/putumayoLoop";
import { getTurso } from "./turso";

type EditionRow = {
  year: number;
  slug: string;
  fundraiser_slug: string;
  title: string;
  run_date: string;
  status: EditionStatus;
  raised_amount: number;
  target_amount: number;
  donors: number;
  currency: string;
  total_runners: number | null;
  story_key: string | null;
  story_nl: string | null;
  story_en: string | null;
  story_es: string | null;
  youtube_id: string | null;
};

type HubRow = {
  edition_year: number;
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  captain: string | null;
  display_order: number;
};

type SubscriberRow = {
  external_id: string | null;
  edition_year: number;
  first_name: string | null;
  last_name: string | null;
  hub_id: string | null;
  lat: number | null;
  lng: number | null;
  location: string | null;
  count: number;
  signed_up_at: string;
};

function rowToEdition(
  r: EditionRow,
  hubs: Hub[],
  subscribers: Subscriber[],
): Edition {
  return {
    year: r.year,
    slug: r.slug,
    fundraiserSlug: r.fundraiser_slug,
    title: r.title,
    runDate: r.run_date,
    status: r.status,
    hubs,
    subscribers,
    donations: {
      raised: r.raised_amount,
      target: r.target_amount,
      donors: r.donors,
      currency: "EUR",
    },
    totalRunners: r.total_runners ?? undefined,
    story: {
      nl: r.story_nl ?? undefined,
      en: r.story_en ?? undefined,
      es: r.story_es ?? undefined,
    },
    youtubeId: r.youtube_id ?? undefined,
  };
}

function rowToHub(r: HubRow): Hub {
  return {
    id: r.id,
    name: r.name,
    city: r.city,
    country: r.country,
    coords: [r.lat, r.lng],
    captain: r.captain ?? undefined,
  };
}

function rowToSubscriber(r: SubscriberRow): Subscriber {
  // Map only finishes successfully if lat/lng are present (live signups
  // without geocoding won't show as pins until they have coords).
  return {
    id: r.external_id ?? String(r.signed_up_at),
    firstName: r.first_name ?? undefined,
    lastName: r.last_name ?? undefined,
    hubId: r.hub_id ?? undefined,
    coords: [r.lat ?? 0, r.lng ?? 0],
    signedUpAt: r.signed_up_at,
    count: r.count,
  };
}

async function fetchHubs(year: number): Promise<Hub[]> {
  const db = getTurso();
  const res = await db.execute({
    sql: `
      SELECT edition_year, id, name, city, country, lat, lng, captain, display_order
      FROM putumayo_loop_hubs
      WHERE edition_year = ?
      ORDER BY display_order ASC, id ASC
    `,
    args: [year],
  });
  return (res.rows as unknown as HubRow[]).map(rowToHub);
}

async function fetchSubscribers(year: number): Promise<Subscriber[]> {
  const db = getTurso();
  // Only return rows with coords — the map can't plot without them.
  const res = await db.execute({
    sql: `
      SELECT external_id, edition_year, first_name, last_name, hub_id,
             lat, lng, location, count, signed_up_at
      FROM putumayo_loop_subscribers
      WHERE edition_year = ? AND lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY signed_up_at DESC
    `,
    args: [year],
  });
  return (res.rows as unknown as SubscriberRow[]).map(rowToSubscriber);
}

async function hydrate(rows: EditionRow[]): Promise<Edition[]> {
  return Promise.all(
    rows.map(async (r) => {
      const [hubs, subs] = await Promise.all([
        fetchHubs(r.year),
        fetchSubscribers(r.year),
      ]);
      return rowToEdition(r, hubs, subs);
    }),
  );
}

export async function getAllEditions(): Promise<Edition[]> {
  const db = getTurso();
  const res = await db.execute(
    `SELECT * FROM putumayo_loop_editions ORDER BY year DESC`,
  );
  return hydrate(res.rows as unknown as EditionRow[]);
}

export async function getCurrentEdition(): Promise<Edition> {
  const db = getTurso();
  const res = await db.execute(`
    SELECT * FROM putumayo_loop_editions
    WHERE status IN ('active', 'upcoming')
    ORDER BY year DESC
    LIMIT 1
  `);
  const row = res.rows[0] as unknown as EditionRow | undefined;
  if (!row) {
    // Fall back to the most recent past edition so the page can still
    // render in the off-season between editions.
    const fallback = await db.execute(
      `SELECT * FROM putumayo_loop_editions ORDER BY year DESC LIMIT 1`,
    );
    return (await hydrate(fallback.rows as unknown as EditionRow[]))[0];
  }
  return (await hydrate([row]))[0];
}

export async function getEditionByYear(
  year: number,
): Promise<Edition | undefined> {
  const db = getTurso();
  const res = await db.execute({
    sql: `SELECT * FROM putumayo_loop_editions WHERE year = ?`,
    args: [year],
  });
  const row = res.rows[0] as unknown as EditionRow | undefined;
  if (!row) return undefined;
  return (await hydrate([row]))[0];
}

export async function getPastEditions(): Promise<Edition[]> {
  const db = getTurso();
  const res = await db.execute(`
    SELECT * FROM putumayo_loop_editions
    WHERE status = 'past'
    ORDER BY year DESC
  `);
  return hydrate(res.rows as unknown as EditionRow[]);
}
