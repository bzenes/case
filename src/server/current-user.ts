import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/session";
import { getDb, schema } from "@/server/db/client";

export type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "creator";
};

/** Shared by the tRPC context and Server Component route gating. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const db = await getDb();
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return row ? { id: row.id, email: row.email, role: row.role } : null;
}
