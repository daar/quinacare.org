// GET /api/putumayo-loop/stats
//
// Live headline numbers for the current Putumayo Loop edition — how many
// locations are running (organized hubs + distinct individual signup
// spots) and how many runners are signed up in total. Used by the
// homepage announcement popup, which can't read Turso itself since the
// homepage is prerendered static output.
//
// Every homepage visitor's popup hits this route, so the response is
// cached at Netlify's CDN for 30 min (see src/pages/api/statistics.ts for
// the same pattern) rather than querying Turso on every single view.

export const prerender = false;

import type { APIRoute } from "astro";
import { getCurrentEdition } from "../../../lib/putumayoLoopRepo";

export const GET: APIRoute = async () => {
  const edition = await getCurrentEdition();

  const runners = edition.subscribers.reduce(
    (sum, s) => sum + (s.count ?? 1),
    0,
  );

  // Distinct individual (non-hub) signup spots, grouped the same way the
  // map's anonymous mode buckets pins: rounded coords when geocoded,
  // else the free-text location string, so an un-geocoded signup still
  // counts as a location rather than being silently dropped.
  const individualLocations = new Set(
    edition.subscribers
      .filter((s) => !s.hubId)
      .map((s) =>
        s.coords
          ? `${s.coords[0].toFixed(2)},${s.coords[1].toFixed(2)}`
          : s.location?.trim().toLowerCase(),
      )
      .filter((key): key is string => !!key),
  ).size;

  return new Response(
    JSON.stringify({
      year: edition.year,
      runDate: edition.runDate,
      locations: edition.hubs.length + individualLocations,
      runners,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800",
        "Netlify-CDN-Cache-Control":
          "public, durable, s-maxage=1800, stale-while-revalidate=3600",
      },
    },
  );
};
