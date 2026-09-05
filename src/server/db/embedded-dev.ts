import { existsSync } from "node:fs";
import path from "node:path";
import { createEmbeddedPostgres, isDuplicateDatabaseError } from "./embedded-shared";

/**
 * No Docker/local Postgres install is available in the dev environment this
 * project was built in, so local dev uses `embedded-postgres` (downloads and
 * runs a real Postgres binary, no Docker/admin rights needed) instead of the
 * docker-compose.yml PLAN.md suggests. See NOTES.md "Assumptions".
 *
 * This module is dev/test tooling only - never imported by production code
 * paths. It is a no-op unless USE_EMBEDDED_PG=true (set in .env for local
 * dev; unset/false when DATABASE_URL points at a real Postgres).
 */

const DATA_DIR = path.resolve(process.cwd(), ".pgdata");
export const DEV_PG_PORT = 54329;
export const DEV_PG_DATABASE = "app";

declare global {
  var __devEmbeddedPgReady: Promise<void> | undefined;
}

export function ensureDevEmbeddedPostgres(): Promise<void> {
  if (process.env.USE_EMBEDDED_PG !== "true") {
    return Promise.resolve();
  }

  if (!globalThis.__devEmbeddedPgReady) {
    globalThis.__devEmbeddedPgReady = (async () => {
      const pg = createEmbeddedPostgres({
        databaseDir: DATA_DIR,
        port: DEV_PG_PORT,
        persistent: true,
      });

      if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
        await pg.initialise();
      }
      await pg.start();

      try {
        await pg.createDatabase(DEV_PG_DATABASE);
      } catch (err) {
        if (!isDuplicateDatabaseError(err)) {
          throw err;
        }
      }
    })();
  }

  return globalThis.__devEmbeddedPgReady;
}
