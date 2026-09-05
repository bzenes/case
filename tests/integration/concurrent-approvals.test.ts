import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { earnings } from "@/lib/payout";
import { getDb, schema } from "@/server/db/client";
import { createCaller } from "../setup/caller";
import { addMetric, createCampaign, createSubmission, createUser } from "../setup/fixtures";
import { resetDb } from "../setup/reset-db";

describe("concurrent approvals against a shared budget", () => {
  // Repeated in-process (not just a single run) to rule out flakiness, per
  // PLAN.md's "run 5-10x locally to shake out flakiness" for this exact test.
  it("lets exactly one of two equal-cost approvals succeed, every time", async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      await resetDb();

      const admin = await createUser({ role: "admin" });
      const creator1 = await createUser({ role: "creator" });
      const creator2 = await createUser({ role: "creator" });
      const campaign = await createCampaign({ totalBudget: 10_000, payoutPer1kViews: 10_000 });
      const submissionA = await createSubmission({
        campaignId: campaign.id,
        creatorId: creator1.id,
      });
      const submissionB = await createSubmission({
        campaignId: campaign.id,
        creatorId: creator2.id,
      });
      await addMetric(submissionA.id, 1000);
      await addMetric(submissionB.id, 1000);

      const caller = await createCaller({ id: admin.id, email: admin.email, role: "admin" });

      // Started together, not awaited one-at-a-time: this is what actually
      // exercises the FOR UPDATE lock instead of two sequential calls.
      const results = await Promise.allSettled([
        caller.submissions.approve({ submissionId: submissionA.id }),
        caller.submissions.approve({ submissionId: submissionB.id }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );

      expect(fulfilled, `attempt ${attempt}`).toHaveLength(1);
      expect(rejected, `attempt ${attempt}`).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(TRPCError);
      expect((rejected[0]?.reason as TRPCError).cause).toMatchObject({
        reason: "BUDGET_EXCEEDED",
      });

      const db = await getDb();
      const submissions = await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.campaignId, campaign.id));

      const approved = submissions.filter((s) => s.status === "approved");
      const pending = submissions.filter((s) => s.status === "pending");
      expect(approved, `attempt ${attempt}`).toHaveLength(1);
      expect(pending, `attempt ${attempt}`).toHaveLength(1);

      const totalApprovedSpend = approved.length * earnings(1000, campaign.payoutPer1kViews);
      expect(totalApprovedSpend, `attempt ${attempt}`).toBeLessThanOrEqual(campaign.totalBudget);

      const [updatedCampaign] = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id));
      expect(updatedCampaign?.status, `attempt ${attempt}`).toBe("completed");
    }
  });
});
