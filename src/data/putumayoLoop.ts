// Multi-edition data for the Putumayo Loop landing pages.
// Will be swapped for a Turso-backed source later; keep the helper
// functions (getCurrentEdition, getEditionByYear, getPastEditions) as
// the public surface so callers don't depend on the array shape.

export interface Hub {
  id: string;
  name: string;
  city: string;
  country: string;
  coords: [number, number]; // [lat, lng]
  captain?: string;
}

export interface Subscriber {
  id: string;
  firstName?: string;
  lastName?: string;
  hubId?: string; // empty / undefined = individual runner
  coords: [number, number];
  signedUpAt: string; // ISO timestamp
  /**
   * For past editions where we only have aggregate per-city counts,
   * this entry stands in for N runners at one location. Defaults to 1.
   */
  count?: number;
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
  slug: string; // used in URL, e.g. "2025"
  fundraiserSlug: string; // used in the Mollie payment description
  title: string;
  runDate: string; // ISO
  status: EditionStatus;
  hubs: Hub[];
  subscribers: Subscriber[];
  donations: DonationStats;
  /** Final participant count, for past editions where not every runner is in `subscribers`. */
  totalRunners?: number;
  /** i18n key for an optional story paragraph shown on past edition pages. */
  storyKey?: string;
  /** Optional YouTube video ID embedded on the past edition page. */
  youtubeId?: string;
}

// 2026 — current edition.
const subscribers2026: Subscriber[] = [
  {
    id: "s1",
    firstName: "Pietje",
    lastName: "Bell",
    hubId: "hulst",
    coords: [51.281, 4.052],
    signedUpAt: "2026-05-22T09:30:00Z",
  },
  {
    id: "s2",
    firstName: "Sofía",
    lastName: "Ramírez",
    hubId: "putumayo",
    coords: [0.12, -75.91],
    signedUpAt: "2026-05-21T14:12:00Z",
  },
  {
    id: "s3",
    firstName: "Yvonne",
    lastName: "van der Ende",
    hubId: "den-haag",
    coords: [52.071, 4.301],
    signedUpAt: "2026-05-21T18:45:00Z",
  },
  {
    id: "s4",
    firstName: "Marco",
    lastName: "Bianchi",
    coords: [45.4642, 9.19],
    signedUpAt: "2026-05-20T07:00:00Z",
  },
  {
    id: "s5",
    firstName: "Hans",
    lastName: "Schmidt",
    hubId: "maastricht",
    coords: [50.852, 5.691],
    signedUpAt: "2026-05-19T16:22:00Z",
  },
  {
    id: "s6",
    firstName: "Akiko",
    lastName: "Tanaka",
    coords: [35.6762, 139.6503],
    signedUpAt: "2026-05-19T11:00:00Z",
  },
  {
    id: "s7",
    firstName: "Lucas",
    lastName: "Smit",
    hubId: "den-haag",
    coords: [52.072, 4.31],
    signedUpAt: "2026-05-18T08:30:00Z",
  },
  {
    id: "s8",
    firstName: "María",
    lastName: "González",
    hubId: "putumayo",
    coords: [0.125, -75.905],
    signedUpAt: "2026-05-17T13:15:00Z",
  },
  {
    id: "s9",
    firstName: "Tom",
    lastName: "Berger",
    coords: [-33.8688, 151.2093],
    signedUpAt: "2026-05-16T10:00:00Z",
  },
  {
    id: "s10",
    firstName: "Karin",
    lastName: "Martens",
    hubId: "hulst",
    coords: [51.279, 4.054],
    signedUpAt: "2026-05-15T19:45:00Z",
  },
  {
    id: "s11",
    firstName: "Femke",
    lastName: "Visser",
    hubId: "maastricht",
    coords: [50.85, 5.692],
    signedUpAt: "2026-05-14T07:15:00Z",
  },
  {
    id: "s12",
    firstName: "Diego",
    lastName: "Hernández",
    coords: [40.4168, -3.7038],
    signedUpAt: "2026-05-13T17:00:00Z",
  },
  {
    id: "s13",
    firstName: "Anneke",
    lastName: "Jansen",
    hubId: "den-haag",
    coords: [52.08, 4.305],
    signedUpAt: "2026-05-12T09:00:00Z",
  },
  {
    id: "s14",
    firstName: "James",
    lastName: "O'Connor",
    coords: [53.3498, -6.2603],
    signedUpAt: "2026-05-11T20:00:00Z",
  },
  {
    id: "s15",
    firstName: "Carla",
    lastName: "Mendoza",
    hubId: "putumayo",
    coords: [0.115, -75.92],
    signedUpAt: "2026-05-10T06:30:00Z",
  },
];

export const editions: Edition[] = [
  {
    year: 2025,
    slug: "2025",
    fundraiserSlug: "putumayo-loop-2025",
    title: "Putumayo Loop 2025",
    runDate: "2025-10-26",
    status: "past",
    hubs: [],
    // Aggregate counts per location (no individual names tracked for
    // past editions). totalRunners is derived from the sum of `count`.
    subscribers: [
      {
        id: "p25-puertocarmen",
        coords: [0.118, -75.91],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 150,
      }, // Puerto el Carmen
      {
        id: "p25-den-haag",
        coords: [52.0705, 4.3007],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 4,
      }, // Den Haag
      {
        id: "p25-groningen",
        coords: [53.2194, 6.5665],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 4,
      }, // Groningen
      {
        id: "p25-singapore",
        coords: [1.3521, 103.8198],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 4,
      }, // Singapore
      {
        id: "p25-bangkok",
        coords: [13.7563, 100.5018],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 2,
      }, // Thailand
      {
        id: "p25-amersfoort",
        coords: [52.1561, 5.3878],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 2,
      }, // Amersfoort
      {
        id: "p25-amsterdam",
        coords: [52.3676, 4.9041],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 2,
      }, // Amsterdam
      {
        id: "p25-eindhoven",
        coords: [51.4416, 5.4697],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 2,
      }, // Eindhoven
      {
        id: "p25-paris",
        coords: [48.8566, 2.3522],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 1,
      }, // Paris
      {
        id: "p25-hulst",
        coords: [51.2802, 4.0521],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 1,
      }, // Hulst
      {
        id: "p25-new-york",
        coords: [40.7128, -74.006],
        signedUpAt: "2025-10-26T13:00:00Z",
        count: 1,
      }, // New York
    ],
    donations: { raised: 3000, target: 3000, donors: 62, currency: "EUR" },
    storyKey: "putumayoLoop.story2025",
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
        country: "Ecuador",
        coords: [0.118, -75.91],
        captain: "Dr. Andrés López",
      },
      {
        id: "den-haag",
        name: "Den Haag",
        city: "Den Haag",
        country: "Nederland",
        coords: [52.0705, 4.3007],
        captain: "Sven Hendriks",
      },
      {
        id: "hulst",
        name: "Hulst",
        city: "Hulst",
        country: "Nederland",
        coords: [51.2802, 4.0521],
        captain: "Marleen de Kok",
      },
      {
        id: "maastricht",
        name: "Maastricht",
        city: "Maastricht",
        country: "Nederland",
        coords: [50.8514, 5.6909],
        captain: "Sanne van der Meer",
      },
    ],
    subscribers: subscribers2026,
    donations: { raised: 1234, target: 10000, donors: 47, currency: "EUR" },
  },
];

export function getCurrentEdition(): Edition {
  return (
    editions.find((e) => e.status === "active" || e.status === "upcoming") ||
    editions[editions.length - 1]
  );
}

export function getEditionByYear(year: number): Edition | undefined {
  return editions.find((e) => e.year === year);
}

export function getPastEditions(): Edition[] {
  return editions
    .filter((e) => e.status === "past")
    .sort((a, b) => b.year - a.year);
}

export function getAllEditions(): Edition[] {
  return [...editions].sort((a, b) => b.year - a.year);
}
