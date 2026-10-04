export const prerender = false;

import type { APIRoute } from "astro";
import {
  getFundraiserStats,
  getCurrentEurToUsdRate,
} from "../../../lib/donations";

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
    });
  }

  // `rate` is always the live EUR->USD rate (see getCurrentEurToUsdRate) —
  // EN/ES pages use it to display the EUR-tracked total converted to USD.
  const [stats, rate] = await Promise.all([
    getFundraiserStats(slug),
    getCurrentEurToUsdRate(),
  ]);

  return new Response(JSON.stringify({ ...stats, rate }), {
    headers: { "Content-Type": "application/json" },
  });
};
