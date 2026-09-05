import { TRPCError } from "@trpc/server";

/**
 * Typed error contract for the approve/reject flow (BUDGET_CONCURRENCY.md):
 * carried in `error.cause.reason` server-side and re-exposed on
 * `error.data.reason` (see the errorFormatter in ./trpc.ts) so the client
 * can branch on it instead of pattern-matching an error message string.
 */
export type ApprovalErrorReason = "BUDGET_EXCEEDED" | "ALREADY_REVIEWED";

export function approvalError(reason: ApprovalErrorReason, message: string): TRPCError {
  return new TRPCError({ code: "CONFLICT", message, cause: { reason } });
}
