import "../load-env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "./client";

async function main() {
  const db = await getDb();
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
