// Putumayo Loop — local editions + hubs config + types.
//
// Editions, hubs, raise goals, story copy, YouTube IDs and any other
// edition-level configuration live here. Subscribers (live signups)
// come from Turso; raised amount and donor count are computed live
// from the `donations` table via getFundraiserStats. The repo at
// `src/lib/putumayoLoopRepo.ts` joins the three sources.

export interface Hub {
  id: string;
  name: string;
  city: string;
  /** ISO 3166-1 alpha-2 country code (e.g. "NL", "EC"). Display strings
   *  are derived per-locale via Intl.DisplayNames. */
  country: string;
  coords: [number, number]; // [lat, lng]
  captain?: string;
  /**
   * When set, the hub captain also receives a notification email every
   * time a runner signs up for THIS hub. Leave unset to keep the
   * runManager as the sole recipient.
   */
  captainEmail?: string;
}

export interface Subscriber {
  id: string;
  firstName?: string;
  lastName?: string;
  hubId?: string;
  /**
   * Map pin coordinates. Optional because new signups land in the DB
   * with NULL lat/lng until a geocoding step turns the free-text
   * `location` field into coords. Hub signups still get a pin (the
   * repo falls back to the hub's own coords), individuals without
   * geocoded coords skip the map but still count in the totals.
   */
  coords?: [number, number];
  signedUpAt: string;
  /** Aggregate count — one entry can stand in for N runners (past editions). */
  count?: number;
  /** Distance picked at signup. */
  distance?: "10k" | "half" | "full";
  /**
   * Free-text "City, country" supplied by individual runners at signup.
   * Used by the live signup feed; un-set for hub signups (the hub
   * provides the location context instead).
   */
  location?: string;
}

export interface DonationStats {
  raised: number;
  target: number;
  donors: number;
  currency: "EUR";
}

export type EditionStatus = "upcoming" | "active" | "past";

export interface Edition {
  year: number;
  slug: string;
  fundraiserSlug: string;
  title: string;
  runDate: string;
  status: EditionStatus;
  hubs: Hub[];
  subscribers: Subscriber[];
  donations: DonationStats;
  totalRunners?: number;
  story?: Partial<Record<"nl" | "en" | "es", string>>;
  youtubeId?: string;
}

// ─── Edition configuration ────────────────────────────────────────────
//
// Edit this list to add a new edition or tweak a past one. The repo
// reads from here and merges in subscribers + live donation totals.

export interface EditionConfig {
  year: number;
  slug: string;
  /** Used in the Mollie payment description and metadata.fundraiser_slug. */
  fundraiserSlug: string;
  title: string;
  /** ISO date (YYYY-MM-DD). */
  runDate: string;
  status: EditionStatus;
  /** Hubs participating in this edition. */
  hubs: Hub[];
  /** Raise goal in whole euros. */
  target: number;
  /** Final participant count for past editions where subscribers may be incomplete. */
  totalRunners?: number;
  /** Optional per-language story shown on the past edition page. */
  story?: Partial<Record<"nl" | "en" | "es", string>>;
  /** Optional YouTube video ID embedded on the past edition page. */
  youtubeId?: string;
  /**
   * Past-edition overrides: when set, hydrate uses these canonical
   * totals (and the subscribers list below) instead of querying Turso.
   * Lets historical editions ship their final numbers inline so the
   * page does not depend on live data that may never have been
   * imported. Active editions leave these unset and use live queries.
   */
  raised?: number;
  donors?: number;
  /** Static per-location subscribers for the map (past editions). */
  subscribers?: Subscriber[];
}

export const editions: EditionConfig[] = [
  {
    year: 2025,
    slug: "2025",
    fundraiserSlug: "putumayo-loop-2025",
    title: "Putumayo Loop 2025",
    runDate: "2025-10-26",
    status: "past",
    hubs: [],
    target: 3000,
    totalRunners: 173,
    raised: 3000,
    donors: 62,
    // Aggregated per-city counts (no individual names tracked for past
    // editions). 173 runners across 11 cities = the actual total; the
    // story below rounds to "over 170".
    subscribers: [
      {
        id: "p25-puertocarmen",
        coords: [0.118, -75.91],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 150,
      },
      {
        id: "p25-den-haag",
        coords: [52.0705, 4.3007],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 4,
      },
      {
        id: "p25-groningen",
        coords: [53.2194, 6.5665],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 4,
      },
      {
        id: "p25-singapore",
        coords: [1.3521, 103.8198],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 4,
      },
      {
        id: "p25-bangkok",
        coords: [13.7563, 100.5018],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 2,
      },
      {
        id: "p25-amersfoort",
        coords: [52.1561, 5.3878],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 2,
      },
      {
        id: "p25-amsterdam",
        coords: [52.3676, 4.9041],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 2,
      },
      {
        id: "p25-eindhoven",
        coords: [51.4416, 5.4697],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 2,
      },
      {
        id: "p25-paris",
        coords: [48.8566, 2.3522],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 1,
      },
      {
        id: "p25-hulst",
        coords: [51.2802, 4.0521],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 1,
      },
      {
        id: "p25-new-york",
        coords: [40.7128, -74.006],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 1,
      },
    ],
    story: {
      nl: "In 2025 vierden we het lustrum van de Putumayo Loop. Voor het eerst werd op meerdere plekken in de wereld tegelijk gelopen met in totaal meer dan 170 deelnemers. Een dag om nooit te vergeten.",
      en: "In 2025 we celebrated the fifth anniversary of the Putumayo Loop. For the first time runners gathered in multiple cities at once with more than 170 participants in total. A day to remember.",
      es: "En 2025 celebramos el quinto aniversario del Putumayo Loop. Por primera vez se corrió simultáneamente en varias ciudades con más de 170 participantes en total. Un día para recordar.",
    },
    youtubeId: "Fc6XaeLGLdw",
  },
  {
    year: 2026,
    slug: "2026",
    fundraiserSlug: "putumayo-loop-2026",
    title: "Putumayo Loop 2026",
    runDate: "2026-10-18",
    status: "active",
    hubs: [
      {
        id: "putumayo",
        name: "Putumayo",
        city: "Puerto el Carmen",
        country: "EC",
        coords: [0.118, -75.91],
        captain: "Jacob van der Ende",
        captainEmail: "hospitalsanmiguel@quinacare.org",
      },
      {
        id: "den-haag",
        name: "Den Haag",
        city: "Den Haag",
        country: "NL",
        coords: [52.0705, 4.3007],
        captain: "Sarah Blaszyk",
        captainEmail: "smmblaszyk@gmail.com",
      },
      {
        id: "hulst",
        name: "Hulst",
        city: "Hulst",
        country: "NL",
        coords: [51.28039231477035, 4.0526885572096605],
        captain: "Cindy Martens",
        captainEmail: "cindymartens@live.nl",
      },
    ],
    target: 25000,
  },
];

// The Putumayo Loop run manager — receives signup notifications and
// "organize your own hub" inquiries. Edit if the role changes hands.
export const runManager = {
  name: "Yvonne van der Ende",
  email: "yvonne.vanderende@quinacare.org",
} as const;
