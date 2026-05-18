export const prerender = false;

import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const apiKey = import.meta.env.EMR_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "EMR_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch("https://emr.quinacare.org/api/statistics", {
    headers: { "X-Api-Key": apiKey },
  });

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `EMR upstream returned ${upstream.status}` }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const json = (await upstream.json()) as { data?: Record<string, number> };
  const stats = json.data ?? json;

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
};
