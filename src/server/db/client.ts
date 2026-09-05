import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ensureDevEmbeddedPostgres } from "./embedded-dev";
import * as schema from "./schema";

let pool: Pool | undefined;
let dbPromise: Promise<NodePgDatabase<typeof schema>> | undefined;

export function getDb(): Promise<NodePgDatabase<typeof schema>> {
  if (!dbPromise) {
    dbPromise = (async () => {
      await ensureDevEmbeddedPostgres();
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
      }
      pool = new Pool({ connectionString });
      return drizzle(pool, { schema });
    })();
  }
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  dbPromise = undefined;
}

export { schema };
