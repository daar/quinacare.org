import type { APIRoute } from "astro";
import { generateQrDataUri } from "../../../lib/qr";

export const prerender = false;

const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30;
const TIME_WINDOW = 60 * 1000; // 1 minute

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Best-effort per-IP throttle. The counter lives in module memory, so it is
 * per function instance: a cold start or a second concurrent instance starts
 * its own window. That is fine here — the endpoint only ever encodes a
 * same-origin URL, so this exists to damp abuse, not to enforce a hard quota.
 *
 * Returns the seconds until the window resets when the caller is over budget,
 * or null when the request is allowed.
 */
function checkRateLimit(clientIp: string): number | null {
  const now = Date.now();

  // Drop expired windows so the map does not grow once per IP forever.
  for (const [ip, entry] of requestCounts) {
    if (now > entry.resetTime) requestCounts.delete(ip);
  }

  const current = requestCounts.get(clientIp);

  if (!current) {
    requestCounts.set(clientIp, { count: 1, resetTime: now + TIME_WINDOW });
    return null;
  }

  if (current.count >= RATE_LIMIT) {
    return Math.max(1, Math.ceil((current.resetTime - now) / 1000));
  }

  current.count++;
  return null;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

export const GET: APIRoute = async ({ request, site, params }) => {
  try {
    const clientIp = getClientIp(request);

    const retryAfter = checkRateLimit(clientIp);
    if (retryAfter !== null) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      });
    }

    // Dropping empty segments keeps the target same-origin: a value like
    // "//evil.com" collapses to "/evil.com" instead of resolving to
    // another host, so the code can only ever encode a quinacare.org URL.
    const segments = (params.page ?? "").split("/").filter(Boolean);

    if (segments.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Missing page path",
          hint: "Usage: /api/qr/doneer or /api/qr/acties/putumayo-bootcamp",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const origin = site ?? new URL(request.url).origin;
    const target = new URL(`/${segments.join("/")}`, origin);
    const qrDataUri = await generateQrDataUri(target.href);
    const filename = `quinacare-${segments[segments.length - 1]}-qr.png`;

    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>QR Code</title>
  <style>
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .container {
      text-align: center;
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      max-width: 90vw;
    }
    img {
      max-width: 400px;
      width: 100%;
      height: auto;
      margin: 1rem 0;
    }
    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
      color: #333;
    }
    p {
      margin: 0.5rem 0 1rem 0;
      color: #666;
      font-size: 0.9rem;
      word-break: break-all;
    }
    a.download {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      background: #DC2626;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
      transition: background 0.2s;
    }
    a.download:hover {
      background: #B91C1C;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>QR Code</h1>
    <p>${escapeHtml(target.href)}</p>
    <img src="${qrDataUri}" alt="QR code for ${escapeHtml(target.href)}" />
    <p>
      <a class="download" href="${qrDataUri}" download="${escapeHtml(filename)}">Download QR Code</a>
    </p>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          "Cache-Control": "public, max-age=3600",
        },
      },
    );
  } catch (error) {
    console.error("QR generation error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate QR code" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
