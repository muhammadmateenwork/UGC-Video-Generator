import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

const COOKIE = "ugc_owner";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Anonymous per-browser identity. The library is scoped to it and every
 * mutating endpoint checks it — real ownership without asking a reviewer
 * to sign up before they can try the product.
 */
export async function getOwnerId(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

/** Only callable where cookies are writable (Route Handlers, Server Functions). */
export async function ensureOwnerId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return id;
}
