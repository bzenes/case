import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import type { ApprovalErrorReason } from "./approval-error";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    const reason: ApprovalErrorReason | undefined =
      cause && typeof cause === "object" && "reason" in cause
        ? (cause as { reason: ApprovalErrorReason }).reason
        : undefined;
    return {
      ...shape,
      data: {
        ...shape.data,
        reason,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires a resolved session user (any role). */
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Admin-only procedures (campaign CRUD, review queue, approve/reject). */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

/** Creator-only procedures. Per-row ownership is still checked in the resolver. */
export const creatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "creator") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});
