import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const QUERY_TIMEOUT_MS = 10_000;
const RETRIES = 2;

/**
 * Neon's HTTP driver makes one fetch per query, with no timeout and no
 * retry. Observed while testing on a slow connection: a single dropped
 * request failed a render midway, and because the rollback query failed
 * the same way, the project was left stuck in `rendering`. Retrying
 * network-level failures (never HTTP responses — those are real query
 * errors) with a short backoff makes a blip invisible.
 */
async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (err) {
      lastError = err;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
neonConfig.fetchFunction = resilientFetch;

let instance: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Lazily created so a missing DATABASE_URL fails the request that needs it
 * with a clear message, instead of crashing module evaluation at build time.
 * Neon's HTTP driver is stateless (one fetch per query), which suits
 * serverless — no connection pool to exhaust across cold starts.
 */
export function db(): NeonHttpDatabase<typeof schema> {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — add your Neon connection string to .env.local");
  }
  instance = drizzle(neon(url), { schema });
  return instance;
}

export * from "./schema";
