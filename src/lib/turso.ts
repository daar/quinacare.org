// Turso (libSQL) client. Reads credentials from `TURSO_DATABASE_URL`
// and `TURSO_AUTH_TOKEN` in the environment (.env at the repo root).
// Throws at call time if either is missing so the API route can return
// a 500 with a useful message instead of bricking at import time.

import { createClient, type Client } from "@libsql/client";

let cached: Client | undefined;

export function getTurso(): Client {
  if (cached) return cached;
  const url = import.meta.env.TURSO_DATABASE_URL;
  const authToken = import.meta.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error(
      "Turso not configured: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env",
    );
  }
  cached = createClient({ url, authToken });
  return cached;
}
