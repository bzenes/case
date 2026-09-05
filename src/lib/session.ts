import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "session";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function sign(userId: string): string {
  const hmac = createHmac("sha256", getSecret()).update(userId).digest("hex");
  return `${userId}.${hmac}`;
}

function verify(signedValue: string): string | null {
  const dotIndex = signedValue.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const userId = signedValue.slice(0, dotIndex);
  const providedHmac = signedValue.slice(dotIndex + 1);
  const expectedHmac = createHmac("sha256", getSecret())
    .update(userId)
    .digest("hex");

  const providedBuf = Buffer.from(providedHmac, "hex");
  const expectedBuf = Buffer.from(expectedHmac, "hex");
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

  return userId;
}

/** Signed cookie only - no real auth provider, per SPEC.md 4.1. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return verify(raw);
}

export async function setSessionUserId(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
