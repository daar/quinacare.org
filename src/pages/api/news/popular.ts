export const prerender = false;

import type { APIRoute } from "astro";
import { getPopular } from "../../../lib/postViews";

/**
 * Returns the most-viewed news posts for a language over the last 30
 * days (top 5, most-viewed first) as JSON. Read-only; safe to call in
 * any environment (returns [] when there's no data / Turso is absent).
 */
export const GET: APIRoute = async ({ url }) => {
  const lang = (url.searchParams.get("lang") || "nl").slice(0, 5);
  const posts = await getPopular(lang, 5, 30);
  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
    },
  });
};
