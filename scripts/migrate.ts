/**
 * Applies the committed SQL migrations in ./drizzle to DATABASE_URL.
 * Runs before `next build` so a Vercel deploy can never ship code ahead of
 * its schema; skips (without failing) when no database is configured, so
 * a plain local build still works.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] DATABASE_URL not set — skipping migrations");
    return;
  }
  const started = Date.now();
  await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
  console.log(`[migrate] schema up to date (${Date.now() - started}ms)`);
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
