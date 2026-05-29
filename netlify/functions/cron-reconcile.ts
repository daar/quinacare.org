// Netlify Scheduled Function — fires the reconciliation cron hourly by
// calling the protected Astro endpoint. The endpoint does the real
// work; this file exists only so Netlify will schedule it.
//
// Requires URL (set by Netlify automatically) and CRON_SECRET (set in
// the site env). Without CRON_SECRET this is a no-op so the endpoint
// stays unreachable from outside.
//
// Discoverability: this file relies on netlify.toml's [functions]
// directory block. Without that, the @astrojs/netlify adapter's
// .netlify/v1/ output can shadow netlify/functions/ at deploy time
// and this scheduled function is never registered.

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_URL;
  const secret = process.env.CRON_SECRET;
  if (!base) {
    console.warn("[cron-reconcile] URL/DEPLOY_URL missing, skipping");
    return new Response("URL missing", { status: 503 });
  }
  if (!secret) {
    console.warn(
      "[cron-reconcile] CRON_SECRET not set in Netlify env, skipping",
    );
    return new Response("CRON_SECRET missing", { status: 503 });
  }
  const target = `${base}/api/cron/reconcile`;
  console.log(`[cron-reconcile] POST ${target}`);
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "x-cron-secret": secret,
        // Astro's default CSRF check rejects POST/PUT/PATCH/DELETE whose
        // Origin doesn't match the site origin ("Cross-site POST form
        // submissions are forbidden"). Node's fetch sends no Origin by
        // default, so the cron's own call would 403 before our handler
        // ever runs. Setting Origin to the site URL satisfies the check;
        // the per-route x-cron-secret remains the real authentication.
        Origin: base,
      },
    });
    const body = await res.text();
    console.log(`[cron-reconcile] ${res.status} ${body}`);
    return new Response(body, { status: res.status });
  } catch (err) {
    console.error("[cron-reconcile] fetch failed:", err);
    return new Response("fetch failed", { status: 502 });
  }
};

// Use canonical 5-field cron over "@hourly" — Netlify documents the
// 5-field form as the supported syntax; the @-shorthand is best-effort.
export const config = { schedule: "0 * * * *" };
