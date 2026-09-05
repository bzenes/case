import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

export async function resetDb() {
  const db = await getDb();
  await db.execute(
    sql`TRUNCATE TABLE submission_metrics, submissions, campaigns, users RESTART IDENTITY CASCADE`,
  );
}
