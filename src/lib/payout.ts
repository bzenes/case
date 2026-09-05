/**
 * A submission earns per-1,000-views, rounded down - never ceiling, never
 * fractional cents. `payoutPer1kViews` and the result are both integer
 * cents (see SPEC.md 4.4 / CLAUDE.md "money is always integer cents").
 */
export function earnings(views: number, payoutPer1kViews: number): number {
  return Math.floor(views / 1000) * payoutPer1kViews;
}
