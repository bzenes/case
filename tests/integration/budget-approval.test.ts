import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, schema } from "@/server/db/client";
import { createCaller } from "../setup/caller";
import { addMetric, createCampaign, createSubmission, createUser } from "../setup/fixtures";
import { resetDb } from "../setup/reset-db";

describe("budget ceiling on approval", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("approves and completes the campaign when payout exactly equals remaining budget", async () => {
    const admin = await createUser({ role: "admin" });
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({ totalBudget: 10_000, payoutPer1kViews: 10_000 });
    const submission = await createSubmission({ campaignId: campaign.id, creatorId: creator.id });
    await addMetric(submission.id, 1000);

    const caller = await createCaller({ id: admin.id, email: admin.email, role: "admin" });
    const result = await caller.submissions.approve({ submissionId: submission.id });

    expect(result.submission.status).toBe("approved");
    expect(result.campaignCompleted).toBe(true);

    const db = await getDb();
    const [updatedCampaign] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaign.id));
    expect(updatedCampaign?.status).toBe("completed");
  });

  it("fails with BUDGET_EXCEEDED when payout is 1 cent over remaining budget, leaving submission pending and campaign active", async () => {
    const admin = await createUser({ role: "admin" });
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({ totalBudget: 10_000, payoutPer1kViews: 10_001 });
    const submission = await createSubmission({ campaignId: campaign.id, creatorId: creator.id });
    await addMetric(submission.id, 1000);

    const caller = await createCaller({ id: admin.id, email: admin.email, role: "admin" });

    let thrown: unknown;
    try {
      await caller.submissions.approve({ submissionId: submission.id });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(TRPCError);
    expect((thrown as TRPCError).code).toBe("CONFLICT");
    expect((thrown as TRPCError).cause).toMatchObject({ reason: "BUDGET_EXCEEDED" });

    const db = await getDb();
    const [updatedSubmission] = await db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submission.id));
    expect(updatedSubmission?.status).toBe("pending");

    const [updatedCampaign] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaign.id));
    expect(updatedCampaign?.status).toBe("active");
  });
});
