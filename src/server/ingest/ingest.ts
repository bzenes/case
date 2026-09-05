import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "@/server/db/client";

export type MetricGenerator = (params: {
  submissionId: string;
  priorViews: number;
}) => { views: number; likes: number; comments: number };

function randomViewIncrement(): number {
  return Math.floor(Math.random() * 500) + 50;
}

/** The "third-party sync" being simulated - the one seam a test can override. */
export const defaultMetricGenerator: MetricGenerator = ({ priorViews }) => {
  const views = priorViews + randomViewIncrement();
  return { views, likes: Math.round(views * 0.05), comments: Math.round(views * 0.01) };
};

export type IngestFailure = { submissionId: string; error: string };
export type IngestResult = {
  date: string;
  succeeded: string[];
  failed: IngestFailure[];
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function ingestOne(
  db: NodePgDatabase<typeof schema>,
  submissionId: string,
  date: string,
  generateMetric: MetricGenerator,
): Promise<void> {
  const [latestOverall] = await db
    .select({ views: schema.submissionMetrics.views })
    .from(schema.submissionMetrics)
    .where(eq(schema.submissionMetrics.submissionId, submissionId))
    .orderBy(desc(schema.submissionMetrics.capturedAt))
    .limit(1);

  const [existingForDate] = await db
    .select({ views: schema.submissionMetrics.views })
    .from(schema.submissionMetrics)
    .where(
      and(
        eq(schema.submissionMetrics.submissionId, submissionId),
        eq(schema.submissionMetrics.capturedAt, date),
      ),
    )
    .limit(1);

  // Never invent a lower number than any existing row, this day's or the
  // last known one - views are monotonically non-decreasing across runs.
  const priorViews = Math.max(latestOverall?.views ?? 0, existingForDate?.views ?? 0);
  const generated = generateMetric({ submissionId, priorViews });

  await db
    .insert(schema.submissionMetrics)
    .values({
      submissionId,
      capturedAt: date,
      views: generated.views,
      likes: generated.likes,
      comments: generated.comments,
    })
    .onConflictDoUpdate({
      target: [schema.submissionMetrics.submissionId, schema.submissionMetrics.capturedAt],
      set: { views: generated.views, likes: generated.likes, comments: generated.comments },
    });
}

/**
 * SPEC.md 4.5: one submission_metric row per approved submission per
 * calendar day, upserted (idempotent), with per-submission failures
 * isolated and collected rather than aborting the whole batch.
 */
export async function runIngest(
  db: NodePgDatabase<typeof schema>,
  opts?: { date?: string; generateMetric?: MetricGenerator },
): Promise<IngestResult> {
  const date = opts?.date ?? isoDate(new Date());
  const generateMetric = opts?.generateMetric ?? defaultMetricGenerator;

  const approvedSubmissions = await db
    .select({ id: schema.submissions.id })
    .from(schema.submissions)
    .where(eq(schema.submissions.status, "approved"));

  const succeeded: string[] = [];
  const failed: IngestFailure[] = [];

  for (const submission of approvedSubmissions) {
    try {
      await ingestOne(db, submission.id, date, generateMetric);
      succeeded.push(submission.id);
    } catch (err) {
      failed.push({
        submissionId: submission.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { date, succeeded, failed };
}
