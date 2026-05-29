import { getDb, ensureSchema } from "./db";

export type ErrorLevel = "error" | "warning";

export interface LogErrorInput {
  source: string;
  level?: ErrorLevel;
  message: string;
  context?: Record<string, unknown>;
}

/** Extract a usable string from anything that might be thrown. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Persist an error to Turso. Best-effort: any failure is swallowed
 * with console.warn so a logging blip cannot crash an error handler
 * (which is itself usually running because something already broke).
 */
export async function logError(input: LogErrorInput): Promise<void> {
  try {
    await ensureSchema();
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO app_errors (source, level, message, context)
            VALUES (?, ?, ?, ?)`,
      args: [
        input.source,
        input.level ?? "error",
        input.message.slice(0, 1000),
        JSON.stringify(input.context ?? {}).slice(0, 4000),
      ],
    });
  } catch (err) {
    // Bottom of the chain — only console.warn (not console.error) so
    // we never recursively retry this through reportError.
    console.warn("[errors] logError failed:", err);
  }
}

/**
 * Drop-in replacement for console.error that ALSO persists the error
 * to Turso. Use everywhere a console.error would have gone — in
 * production console output is invisible, this is our only window
 * into what went wrong.
 *
 * Sync and fire-and-forget — does not block the caller on the DB
 * write, and `void` on the inner promise tells lint we mean it.
 *
 *   reportError("api/mollie/webhook", "verify failed", err, { paymentId });
 */
export function reportError(
  source: string,
  message: string,
  err?: unknown,
  extra?: Record<string, unknown>,
): void {
  if (err !== undefined) {
    console.error(`[${source}] ${message}:`, err);
  } else {
    console.error(`[${source}] ${message}`);
  }
  void logError({
    source,
    message,
    context: {
      ...(extra ?? {}),
      error: err !== undefined ? errorMessage(err) : undefined,
    },
  });
}
