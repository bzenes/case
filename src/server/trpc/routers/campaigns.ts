import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { eachDateInRange } from "@/lib/date-range";
import { earnings } from "@/lib/payout";
import {
  CAMPAIGN_STATUS_VALUES,
  campaignFormSchema,
  campaignUpdateSchema,
} from "@/lib/schemas/campaign";
import { schema } from "@/server/db/client";
import { adminProcedure, protectedProcedure, router } from "../trpc";

const listInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(CAMPAIGN_STATUS_VALUES).optional(),
});

export const campaignsRouter = router({
  /** Server-side paginated, searchable, filterable - SPEC.md 4.2. Admin-only. */
  list: adminProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    const conditions = [
      input.search ? ilike(schema.campaigns.title, `%${input.search}%`) : undefined,
      input.status ? eq(schema.campaigns.status, input.status) : undefined,
    ].filter((c) => c !== undefined);
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, totalRow] = await Promise.all([
      ctx.db
        .select()
        .from(schema.campaigns)
        .where(where)
        .orderBy(desc(schema.campaigns.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      ctx.db.select({ total: count() }).from(schema.campaigns).where(where),
    ]);

    return {
      rows,
      total: totalRow[0]?.total ?? 0,
      page: input.page,
      pageSize: input.pageSize,
    };
  }),

  /** Creator browse: active campaigns only - SPEC.md 4.3. */
  listActive: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.status, "active"))
      .orderBy(desc(schema.campaigns.createdAt));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, input.id))
        .limit(1);
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });
      }
      return campaign;
    }),

  create: adminProcedure.input(campaignFormSchema).mutation(async ({ ctx, input }) => {
    const [campaign] = await ctx.db.insert(schema.campaigns).values(input).returning();
    return campaign;
  }),

  update: adminProcedure.input(campaignUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const [campaign] = await ctx.db
      .update(schema.campaigns)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(schema.campaigns.id, id))
      .returning();
    if (!campaign) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });
    }
    return campaign;
  }),

  /**
   * SPEC.md 4.2: total approved views, budget spent/remaining, and a daily
   * views chart across [starts_at, ends_at] with no-data days rendered as
   * zero rather than skipped. Admin-only (budget figures are internal).
   */
  overview: adminProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, input.campaignId))
        .limit(1);
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });
      }

      const latestPerSubmission = await ctx.db.execute<{ views: number }>(sql`
        SELECT DISTINCT ON (sm.submission_id) sm.views
        FROM submission_metrics sm
        JOIN submissions s ON s.id = sm.submission_id
        WHERE s.campaign_id = ${campaign.id} AND s.status IN ('approved', 'paid')
        ORDER BY sm.submission_id, sm.captured_at DESC
      `);

      const totalApprovedViews = latestPerSubmission.rows.reduce(
        (sum, row) => sum + row.views,
        0,
      );
      const budgetSpent = latestPerSubmission.rows.reduce(
        (sum, row) => sum + earnings(row.views, campaign.payoutPer1kViews),
        0,
      );

      const dailyRows = await ctx.db.execute<{ captured_at: string; views: string }>(sql`
        SELECT sm.captured_at::text AS captured_at, SUM(sm.views)::bigint AS views
        FROM submission_metrics sm
        JOIN submissions s ON s.id = sm.submission_id
        WHERE s.campaign_id = ${campaign.id}
        GROUP BY sm.captured_at
      `);
      const viewsByDate = new Map(
        dailyRows.rows.map((row) => [row.captured_at, Number(row.views)]),
      );

      const dailyViews = eachDateInRange(campaign.startsAt, campaign.endsAt).map((date) => ({
        date,
        views: viewsByDate.get(date) ?? 0,
      }));

      return {
        totalApprovedViews,
        budgetSpent,
        budgetRemaining: campaign.totalBudget - budgetSpent,
        dailyViews,
      };
    }),
});
