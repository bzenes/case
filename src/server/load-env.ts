import { existsSync } from "node:fs";
import process from "node:process";

// Standalone scripts run via tsx (migrate/seed/ingest) don't get Next.js's
// automatic .env loading, so they import this first to load it manually.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
