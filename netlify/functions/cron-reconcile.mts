// Netlify Scheduled Function — fires the reconciliation cron hourly by
// calling the protected Astro endpoint. The endpoint does the real
// work; this file exists only so Netlify will schedule it.
//
// Requires URL (set by Netlify automatically) and CRON_SECRET (set in
// the site env). Without CRON_SECRET this is a no-op so the endpoint
// stays unreachable from outside.

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("[cron-reconcile] URL or CRON_SECRET not set, skipping");
    return new Response("Not configured", { status: 503 });
  }
  const res = await fetch(`${base}/api/cron/reconcile`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
  const body = await res.text();
  console.log(`[cron-reconcile] ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config = { schedule: "@hourly" };
