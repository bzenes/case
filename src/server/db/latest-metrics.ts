import { inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "./client";

/** Latest (by captured_at) views per submission id, for the given ids. */
export async function latestViewsForSubmissions(
  db: NodePgDatabase<typeof schema>,
  submissionIds: string[],
): Promise<Map<string, number>> {
  if (submissionIds.length === 0) return new Map();

  // A plain JS array interpolated into `sql` expands to positional params
  // (`ANY(($1, $2))`, a row list, not an array) rather than a real Postgres
  // array - `inArray` builds the correct `IN (...)` fragment instead.
  const result = await db.execute<{ submission_id: string; views: number }>(sql`
    SELECT DISTINCT ON (submission_id) submission_id, views
    FROM submission_metrics
    WHERE ${inArray(schema.submissionMetrics.submissionId, submissionIds)}
    ORDER BY submission_id, captured_at DESC
  `);

  return new Map(result.rows.map((row) => [row.submission_id, row.views]));
}
