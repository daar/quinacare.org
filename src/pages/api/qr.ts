import type { APIRoute } from "astro";
import { generateQrDataUri } from "../../lib/qr";

const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30;
const TIME_WINDOW = 60 * 1000; // 1 minute

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const current = requestCounts.get(clientIp);

  if (!current || now > current.resetTime) {
    requestCounts.set(clientIp, { count: 1, resetTime: now + TIME_WINDOW });
    return true;
  }

  if (current.count >= RATE_LIMIT) {
    return false;
  }

  current.count++;
  return true;
}

export const GET: APIRoute = async ({ request, site }) => {
  try {
    const clientIp = getClientIp(request);

    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const requestUrl = new URL(request.url);
    let pageParam = requestUrl.searchParams.get("page");

    if (!pageParam) {
      return new Response(
        JSON.stringify({
          error: "Missing page parameter",
          hint: "Usage: /api/qr?page=/path/to/page",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const fullUrl = new URL(pageParam, site).href;
    const qrDataUri = await generateQrDataUri(fullUrl);

    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    }
    a {
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
    a:hover {
      background: #B91C1C;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>QR Code</h1>
    <p>Scan to visit the page</p>
    <img src="${qrDataUri}" alt="QR code" />
    <p>
      <a href="${qrDataUri}" download="quinacare-qr.png">Download QR Code</a>
    </p>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=UTF-8" },
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
