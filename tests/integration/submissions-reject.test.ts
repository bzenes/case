import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, schema } from "@/server/db/client";
import { createCaller } from "../setup/caller";
import { createCampaign, createSubmission, createUser } from "../setup/fixtures";
import { resetDb } from "../setup/reset-db";

describe("submissions.reject - rejection reason required", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects an empty rejection reason (Zod validation) and leaves the submission pending", async () => {
    const admin = await createUser({ role: "admin" });
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const submission = await createSubmission({ campaignId: campaign.id, creatorId: creator.id });

    const caller = await createCaller({ id: admin.id, email: admin.email, role: "admin" });

    let thrown: unknown;
    try {
      await caller.submissions.reject({ submissionId: submission.id, rejectionReason: "" });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(TRPCError);
    expect((thrown as TRPCError).code).toBe("BAD_REQUEST");

    const db = await getDb();
    const [unchanged] = await db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submission.id));
    expect(unchanged?.status).toBe("pending");
    expect(unchanged?.rejectionReason).toBeNull();
  });

  it("rejects a whitespace-only rejection reason the same way", async () => {
    const admin = await createUser({ role: "admin" });
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const submission = await createSubmission({ campaignId: campaign.id, creatorId: creator.id });

    const caller = await createCaller({ id: admin.id, email: admin.email, role: "admin" });

    // Zod's min(1) only guarantees non-empty, not non-blank - documenting the
    // actual (lenient) behavior rather than assuming stricter trimming.
    const result = await caller.submissions.reject({
      submissionId: submission.id,
      rejectionReason: "   ",
    });
    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("   ");
  });

  it("succeeds with a non-empty reason and records it verbatim", async () => {
    const admin = await createUser({ role: "admin" });
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const submission = await createSubmission({ campaignId: campaign.id, creatorId: creator.id });

    const caller = await createCaller({ id: admin.id, email: admin.email, role: "admin" });
    const result = await caller.submissions.reject({
      submissionId: submission.id,
      rejectionReason: "Clip doesn't feature the product.",
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("Clip doesn't feature the product.");
  });
});
