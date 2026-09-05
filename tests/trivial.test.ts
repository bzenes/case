import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";

describe("scaffold", () => {
  it("connects to the test database", async () => {
    const db = await getDb();
    const result = await db.execute(sql`SELECT 1 as one`);
    expect(result.rows[0]).toEqual({ one: 1 });
  });
});
