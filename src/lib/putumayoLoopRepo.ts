// Putumayo Loop — read access.
//
// Editions, hubs, target goals, story copy etc. live in
// src/data/putumayoLoop.ts. Subscribers (live signups) come from
// Turso (putumayo_loop_subscribers). Raised amount + donor count are
// computed live from the `donations` table via getFundraiserStats.
// This module stitches the three sources into the Edition shape the
// pages consume.

import type { Edition, EditionConfig, Subscriber } from "../data/putumayoLoop";
import { editions } from "../data/putumayoLoop";
import { getTurso } from "./turso";
import { getFundraiserStats } from "./donations";

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
  distance: string | null;
  signed_up_at: string;
};

function rowToSubscriber(r: SubscriberRow): Subscriber {
  const distance = (["10k", "half", "full"] as const).find(
    (d) => d === r.distance,
  );
  return {
    id: r.external_id ?? String(r.signed_up_at),
    firstName: r.first_name ?? undefined,
    lastName: r.last_name ?? undefined,
    hubId: r.hub_id ?? undefined,
    coords: [r.lat ?? 0, r.lng ?? 0],
    signedUpAt: r.signed_up_at,
    count: r.count,
    distance,
  };
}

async function fetchSubscribers(year: number): Promise<Subscriber[]> {
  const db = getTurso();
  // Only return rows with coords — the map can't plot without them.
  const res = await db.execute({
    sql: `
      SELECT external_id, edition_year, first_name, last_name, hub_id,
             lat, lng, location, count, distance, signed_up_at
      FROM putumayo_loop_subscribers
      WHERE edition_year = ? AND lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY signed_up_at DESC
    `,
    args: [year],
  });
  return (res.rows as unknown as SubscriberRow[]).map(rowToSubscriber);
}

async function hydrate(config: EditionConfig): Promise<Edition> {
  const [subscribers, stats] = await Promise.all([
    fetchSubscribers(config.year),
    getFundraiserStats(config.fundraiserSlug),
  ]);
  return {
    year: config.year,
    slug: config.slug,
    fundraiserSlug: config.fundraiserSlug,
    title: config.title,
    runDate: config.runDate,
    status: config.status,
    hubs: config.hubs,
    subscribers,
    donations: {
      raised: Math.round(stats.raised_cents / 100),
      target: config.target,
      donors: stats.donor_count,
      currency: "EUR",
    },
    totalRunners: config.totalRunners,
    story: config.story,
    youtubeId: config.youtubeId,
  };
}

async function hydrateAll(configs: EditionConfig[]): Promise<Edition[]> {
  return Promise.all(configs.map(hydrate));
}

export async function getAllEditions(): Promise<Edition[]> {
  return hydrateAll([...editions].sort((a, b) => b.year - a.year));
}

export async function getCurrentEdition(): Promise<Edition> {
  const found =
    editions.find((e) => e.status === "active" || e.status === "upcoming") ??
    editions[editions.length - 1];
  return hydrate(found);
}

export async function getEditionByYear(
  year: number,
): Promise<Edition | undefined> {
  const found = editions.find((e) => e.year === year);
  return found ? hydrate(found) : undefined;
}

export async function getPastEditions(): Promise<Edition[]> {
  return hydrateAll(
    editions.filter((e) => e.status === "past").sort((a, b) => b.year - a.year),
  );
}
