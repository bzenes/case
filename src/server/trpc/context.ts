import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/session";
import { getDb, schema } from "@/server/db/client";

export type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "creator";
};

export async function createContext() {
  const db = await getDb();
  const userId = await getSessionUserId();

  let user: SessionUser | null = null;
  if (userId) {
    const [row] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (row) {
      user = { id: row.id, email: row.email, role: row.role };
    }
  }

  return { db, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
