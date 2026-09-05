import { getDb } from "@/server/db/client";
import type { SessionUser } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/routers/_app";

/** Invokes procedures in-process (no HTTP), as the given session user or signed out. */
export async function createCaller(user: SessionUser | null) {
  const db = await getDb();
  return appRouter.createCaller({ db, user });
}
