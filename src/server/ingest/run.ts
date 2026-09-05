import "../load-env";
import { closeDb, getDb } from "@/server/db/client";
import { runIngest } from "./ingest";

async function main() {
  const db = await getDb();
  const result = await runIngest(db);

  console.log(
    `Ingest for ${result.date}: ${result.succeeded.length} succeeded, ${result.failed.length} failed.`,
  );
  for (const failure of result.failed) {
    console.error(`  FAILED submission ${failure.submissionId}: ${failure.error}`);
  }

  await closeDb();
  process.exit(result.failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
