import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, schema } from "@/server/db/client";
import { defaultMetricGenerator, runIngest } from "@/server/ingest/ingest";
import { createCampaign, createSubmission, createUser } from "../setup/fixtures";
import { resetDb } from "../setup/reset-db";

const TODAY = "2026-06-15";

describe("ingest idempotency", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("upserts exactly one row per (submission, day) across repeated runs, views never decreasing", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const submission = await createSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
    });

    const db = await getDb();

    const first = await runIngest(db, { date: TODAY });
    expect(first.succeeded).toEqual([submission.id]);
    expect(first.failed).toHaveLength(0);

    const rowsAfterFirst = await db
      .select()
      .from(schema.submissionMetrics)
      .where(
        and(
          eq(schema.submissionMetrics.submissionId, submission.id),
          eq(schema.submissionMetrics.capturedAt, TODAY),
        ),
      );
    expect(rowsAfterFirst).toHaveLength(1);
    expect(rowsAfterFirst[0]?.views).toBeGreaterThan(0);
    const viewsAfterFirst = rowsAfterFirst[0]?.views ?? 0;

    await runIngest(db, { date: TODAY });
    const rowsAfterSecond = await db
      .select()
      .from(schema.submissionMetrics)
      .where(
        and(
          eq(schema.submissionMetrics.submissionId, submission.id),
          eq(schema.submissionMetrics.capturedAt, TODAY),
        ),
      );
    expect(rowsAfterSecond).toHaveLength(1);
    expect(rowsAfterSecond[0]?.views).toBeGreaterThanOrEqual(viewsAfterFirst);

    await runIngest(db, { date: TODAY });
    const allSubmissionsRowCounts = await db
      .select()
      .from(schema.submissionMetrics)
      .where(eq(schema.submissionMetrics.capturedAt, TODAY));
    const rowsForThisSubmission = allSubmissionsRowCounts.filter(
      (row) => row.submissionId === submission.id,
    );
    expect(rowsForThisSubmission).toHaveLength(1);
  });

  it("isolates a per-submission failure: the others still get their metric row and the failure is reported", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const a = await createSubmission({ campaignId: campaign.id, creatorId: creator.id, status: "approved" });
    const b = await createSubmission({ campaignId: campaign.id, creatorId: creator.id, status: "approved" });
    const c = await createSubmission({ campaignId: campaign.id, creatorId: creator.id, status: "approved" });

    const db = await getDb();

    const result = await runIngest(db, {
      date: TODAY,
      generateMetric: (params) => {
        if (params.submissionId === b.id) {
          throw new Error("Simulated malformed metric for submission B");
        }
        return defaultMetricGenerator(params);
      },
    });

    expect(result.succeeded.sort()).toEqual([a.id, c.id].sort());
    expect(result.failed).toEqual([
      { submissionId: b.id, error: "Simulated malformed metric for submission B" },
    ]);

    const rows = await db
      .select()
      .from(schema.submissionMetrics)
      .where(eq(schema.submissionMetrics.capturedAt, TODAY));
    const bySubmission = new Set(rows.map((r) => r.submissionId));
    expect(bySubmission.has(a.id)).toBe(true);
    expect(bySubmission.has(c.id)).toBe(true);
    expect(bySubmission.has(b.id)).toBe(false);
  });
});
