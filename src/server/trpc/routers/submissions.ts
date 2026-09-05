import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { earnings } from "@/lib/payout";
import { submissionFormSchema } from "@/lib/schemas/submission";
import { schema } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { latestViewsForSubmissions } from "@/server/db/latest-metrics";
import { approvalError } from "../approval-error";
import { adminProcedure, creatorProcedure, protectedProcedure, router } from "../trpc";

export const submissionsRouter = router({
  /**
   * A creator can only read their own submissions - checked here, not just
   * hidden in the UI (SPEC.md 4.1). Returns NOT_FOUND rather than FORBIDDEN
   * for someone else's row, so a hand-crafted id doesn't confirm it exists.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [submission] = await ctx.db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.id, input.id))
        .limit(1);

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found." });
      }
      if (ctx.user.role === "creator" && submission.creatorId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found." });
      }

      return submission;
    }),

  /** SPEC.md 4.3 "My submissions": status, current views, estimated earnings. */
  listMine: creatorProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: schema.submissions.id,
        campaignId: schema.submissions.campaignId,
        campaignTitle: schema.campaigns.title,
        payoutPer1kViews: schema.campaigns.payoutPer1kViews,
        postUrl: schema.submissions.postUrl,
        platform: schema.submissions.platform,
        status: schema.submissions.status,
        rejectionReason: schema.submissions.rejectionReason,
        createdAt: schema.submissions.createdAt,
      })
      .from(schema.submissions)
      .innerJoin(schema.campaigns, eq(schema.campaigns.id, schema.submissions.campaignId))
      .where(eq(schema.submissions.creatorId, ctx.user.id))
      .orderBy(desc(schema.submissions.createdAt));

    const latestViews = await latestViewsForSubmissions(
      ctx.db,
      rows.map((row) => row.id),
    );

    return rows.map((row) => {
      const views = latestViews.get(row.id) ?? 0;
      return { ...row, views, estimatedEarnings: earnings(views, row.payoutPer1kViews) };
    });
  }),

  /** Admin review queue for one campaign - pending submissions only. */
  reviewQueue: adminProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: schema.submissions.id,
          creatorEmail: schema.users.email,
          postUrl: schema.submissions.postUrl,
          platform: schema.submissions.platform,
          createdAt: schema.submissions.createdAt,
        })
        .from(schema.submissions)
        .innerJoin(schema.users, eq(schema.users.id, schema.submissions.creatorId))
        .where(
          and(
            eq(schema.submissions.campaignId, input.campaignId),
            eq(schema.submissions.status, "pending"),
          ),
        )
        .orderBy(asc(schema.submissions.createdAt));
    }),

  /**
   * creatorId is always ctx.user.id (server-derived), never the client
   * input - CLAUDE.md: never trust a client-supplied userId.
   */
  create: creatorProcedure.input(submissionFormSchema).mutation(async ({ ctx, input }) => {
    const [campaign] = await ctx.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, input.campaignId))
      .limit(1);

    if (!campaign) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });
    }
    if (campaign.status !== "active") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This campaign isn't accepting submissions right now.",
      });
    }
    if (!campaign.platforms.includes(input.platform)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This campaign doesn't accept that platform.",
      });
    }

    try {
      const [submission] = await ctx.db
        .insert(schema.submissions)
        .values({
          campaignId: input.campaignId,
          creatorId: ctx.user.id,
          postUrl: input.postUrl,
          platform: input.platform,
        })
        .returning();
      return submission;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This URL has already been submitted to this campaign.",
        });
      }
      throw err;
    }
  }),
  /**
   * Implements BUDGET_CONCURRENCY.md exactly: SELECT ... FOR UPDATE on the
   * campaign row serializes concurrent approvals for the same campaign, the
   * spend/budget check happens inside that same locked transaction, and the
   * submission UPDATE's WHERE status = 'pending' guard is the
   * belt-and-suspenders check against double-approving one submission.
   */
  approve: adminProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [submission] = await tx
          .select()
          .from(schema.submissions)
          .where(eq(schema.submissions.id, input.submissionId))
          .limit(1);

        if (!submission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found." });
        }
        if (submission.status !== "pending") {
          throw approvalError("ALREADY_REVIEWED", "This submission has already been reviewed.");
        }

        // Lock the campaign row: any concurrent approval against the same
        // campaign blocks here until this transaction commits or rolls
        // back, instead of reading a stale budget figure.
        const [campaign] = await tx
          .select()
          .from(schema.campaigns)
          .where(eq(schema.campaigns.id, submission.campaignId))
          .for("update");

        if (!campaign) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });
        }

        // Already-committed spend, computed inside the lock so it can't go
        // stale between this read and the UPDATE below.
        const latestMetricPerSubmission = await tx.execute<{
          submission_id: string;
          views: number;
        }>(sql`
          SELECT DISTINCT ON (sm.submission_id) sm.submission_id, sm.views
          FROM submission_metrics sm
          JOIN submissions s ON s.id = sm.submission_id
          WHERE s.campaign_id = ${campaign.id} AND s.status IN ('approved', 'paid')
          ORDER BY sm.submission_id, sm.captured_at DESC
        `);

        const spendSoFar = latestMetricPerSubmission.rows.reduce(
          (sum, row) => sum + earnings(row.views, campaign.payoutPer1kViews),
          0,
        );

        const [ownLatestMetric] = await tx
          .select({ views: schema.submissionMetrics.views })
          .from(schema.submissionMetrics)
          .where(eq(schema.submissionMetrics.submissionId, submission.id))
          .orderBy(desc(schema.submissionMetrics.capturedAt))
          .limit(1);

        const thisPayout = earnings(ownLatestMetric?.views ?? 0, campaign.payoutPer1kViews);

        if (spendSoFar + thisPayout > campaign.totalBudget) {
          throw approvalError(
            "BUDGET_EXCEEDED",
            "Approving this submission would exceed the campaign's remaining budget.",
          );
        }

        const [updatedSubmission] = await tx
          .update(schema.submissions)
          .set({ status: "approved", updatedAt: new Date() })
          .where(
            and(eq(schema.submissions.id, submission.id), eq(schema.submissions.status, "pending")),
          )
          .returning();

        if (!updatedSubmission) {
          // Someone else reviewed it between our read above and this
          // UPDATE (e.g. two clicks on the same row) - the WHERE guard
          // caught it.
          throw approvalError("ALREADY_REVIEWED", "This submission has already been reviewed.");
        }

        const remainingBudget = campaign.totalBudget - (spendSoFar + thisPayout);
        let campaignCompleted = false;
        if (remainingBudget === 0) {
          await tx
            .update(schema.campaigns)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(schema.campaigns.id, campaign.id));
          campaignCompleted = true;
        }

        return { submission: updatedSubmission, campaignCompleted };
      });
    }),

  reject: adminProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        rejectionReason: z.string().min(1, "A rejection reason is required."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(schema.submissions)
        .set({
          status: "rejected",
          rejectionReason: input.rejectionReason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.submissions.id, input.submissionId),
            eq(schema.submissions.status, "pending"),
          ),
        )
        .returning();

      if (!updated) {
        const [existing] = await ctx.db
          .select({ id: schema.submissions.id })
          .from(schema.submissions)
          .where(eq(schema.submissions.id, input.submissionId))
          .limit(1);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found." });
        }
        throw approvalError("ALREADY_REVIEWED", "This submission has already been reviewed.");
      }

      return updated;
    }),
});
