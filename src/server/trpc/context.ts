import { getCurrentUser } from "@/server/current-user";
import { getDb } from "@/server/db/client";

export type { SessionUser } from "@/server/current-user";

export async function createContext() {
  const [db, user] = await Promise.all([getDb(), getCurrentUser()]);
  return { db, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
