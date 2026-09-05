import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
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
});
