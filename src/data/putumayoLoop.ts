// Putumayo Loop — shared types + the run-manager constant.
//
// All edition / hub / subscriber data now lives in Turso. Read it via
// `src/lib/putumayoLoopRepo.ts` (getAllEditions, getCurrentEdition,
// getEditionByYear, getPastEditions). Writes (live signups) go through
// `src/pages/api/putumayo-loop/signup.ts`. The seed snapshot used to
// populate Turso lives in `scripts/migrate-putumayo-loop.mjs`.

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
  /**
   * Per-language story text for the past edition page. Filled in for
   * editions where we wrote a recap; the page falls back to nothing
   * (skipping the section) when none of the languages is populated.
   */
  story?: Partial<Record<"nl" | "en" | "es", string>>;
  /** Optional YouTube video ID embedded on the past edition page. */
  youtubeId?: string;
}

// The Putumayo Loop run manager — receives signup notifications and
// "organize your own hub" inquiries. Edit this if the role changes
// hands. The email must be deliverable.
export const runManager = {
  name: "Yvonne van der Ende",
  email: "yvonne.vanderende@quinacare.org",
} as const;
