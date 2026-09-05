import { describe, expect, it } from "vitest";
import { earnings } from "@/lib/payout";

describe("earnings", () => {
  it("returns 0 for 0 views", () => {
    expect(earnings(0, 500)).toBe(0);
  });

  it("floors instead of ceiling for views below 1000", () => {
    expect(earnings(999, 500)).toBe(0);
  });

  it("pays exactly one unit at exactly 1000 views", () => {
    expect(earnings(1000, 500)).toBe(500);
  });

  it("floors partial units instead of rounding (2500 views is 2x, not 2.5x)", () => {
    expect(earnings(2500, 500)).toBe(1000);
  });

  it("stays an exact integer for large view counts", () => {
    const result = earnings(10_000_000, 500);
    expect(result).toBe(5_000_000);
    expect(Number.isInteger(result)).toBe(true);
  });
});
