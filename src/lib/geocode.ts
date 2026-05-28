// Best-effort geocoding via Nominatim (OpenStreetMap).
//
// Free to use under the OSM acceptable-use policy (1 req/sec, attribution,
// identify the app via User-Agent). The signup endpoint calls this once
// per individual signup; failures are silent — the row goes in with
// lat/lng NULL and the runner just skips the map until coords arrive.

export interface Geo {
  lat: number;
  lng: number;
  /** ISO 3166-1 alpha-2, uppercase. Undefined if Nominatim didn't return one. */
  countryCode?: string;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

interface NominatimHit {
  lat: string;
  lon: string;
  address?: { country_code?: string };
}

export async function geocode(
  query: string,
  signal?: AbortSignal,
): Promise<Geo | null> {
  const q = query.trim();
  if (!q) return null;

  // `addressdetails=1` adds the structured address block we need for
  // country_code so callers can fill in a missing country on the typed
  // location string.
  const url =
    `${NOMINATIM}?format=json&limit=1&addressdetails=1` +
    `&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim's policy: identify the app + a contact address.
        "User-Agent": "QuinaCare-Putumayo-Loop/1.0 (care@quinacare.org)",
        Accept: "application/json",
      },
      signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as NominatimHit[];
    if (!Array.isArray(body) || body.length === 0) return null;
    const first = body[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const cc = first.address?.country_code?.toUpperCase();
    return { lat, lng, countryCode: cc || undefined };
  } catch {
    /* network / abort / parse — caller treats as "no result" */
  }
  return null;
}
