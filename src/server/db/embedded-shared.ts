import EmbeddedPostgres from "embedded-postgres";

/**
 * Shared factory for both the dev (embedded-dev.ts) and test
 * (tests/setup/global-setup.ts) embedded Postgres instances.
 *
 * `--locale=C` is forced explicitly: initdb otherwise inherits the OS
 * locale, and on a non-English Windows locale (e.g. Turkish) it fails with
 * "locale name contains non-ASCII characters".
 */
export function createEmbeddedPostgres(opts: {
  databaseDir: string;
  port: number;
  persistent: boolean;
}): EmbeddedPostgres {
  return new EmbeddedPostgres({
    databaseDir: opts.databaseDir,
    port: opts.port,
    user: "postgres",
    password: "postgres",
    persistent: opts.persistent,
    initdbFlags: ["--locale=C", "--encoding=UTF8"],
  });
}

export function isDuplicateDatabaseError(err: unknown): boolean {
  return err instanceof Error && /already exists/i.test(err.message);
}
