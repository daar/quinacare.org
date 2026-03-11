export const prerender = false;

import type { APIRoute } from "astro";
import { getFundraiserStats } from "../../../lib/donations";

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
    });
  }

  const stats = await getFundraiserStats(slug);

  return new Response(JSON.stringify(stats), {
    headers: { "Content-Type": "application/json" },
  });
};
