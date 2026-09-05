import { rmSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import {
  createEmbeddedPostgres,
  isDuplicateDatabaseError,
} from "../../src/server/db/embedded-shared";
import { TEST_DATABASE_URL, TEST_PG_DATABASE, TEST_PG_PORT } from "./test-db";

const DATA_DIR = path.resolve(process.cwd(), ".pgdata-test");

/**
 * Vitest globalSetup: runs once before the whole test run, in the main
 * process, so setting process.env here is visible to every test file.
 * Spins up a throwaway embedded Postgres (real transactions, required for
 * the concurrency/ingest tests - see TESTING.md) instead of Docker, since
 * Docker isn't available in this dev environment (see NOTES.md).
 */
export default async function setup() {
  rmSync(DATA_DIR, { recursive: true, force: true });

  const pg = createEmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: TEST_PG_PORT,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase(TEST_PG_DATABASE);
  } catch (err) {
    if (!isDuplicateDatabaseError(err)) throw err;
  }

  process.env.USE_EMBEDDED_PG = "false";
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.SESSION_SECRET = "test-secret";

  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();

  return async () => {
    // persistent: false means stop() also deletes DATA_DIR.
    await pg.stop();
  };
}
