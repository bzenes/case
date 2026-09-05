import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { createCaller } from "../setup/caller";
import { createCampaign, createSubmission, createUser } from "../setup/fixtures";
import { resetDb } from "../setup/reset-db";

describe("access control", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("404s a creator fetching another creator's submission by id, even by hand-crafted id", async () => {
    const creatorA = await createUser({ role: "creator" });
    const creatorB = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const submissionB = await createSubmission({
      campaignId: campaign.id,
      creatorId: creatorB.id,
    });

    const callerA = await createCaller({ id: creatorA.id, email: creatorA.email, role: "creator" });

    let thrown: unknown;
    try {
      await callerA.submissions.getById({ id: submissionB.id });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(TRPCError);
    expect((thrown as TRPCError).code).toBe("NOT_FOUND");
  });

  it("lets a creator fetch their own submission by id", async () => {
    const creatorA = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const own = await createSubmission({ campaignId: campaign.id, creatorId: creatorA.id });

    const callerA = await createCaller({ id: creatorA.id, email: creatorA.email, role: "creator" });
    const result = await callerA.submissions.getById({ id: own.id });
    expect(result.id).toBe(own.id);
  });

  it("only returns the calling creator's own rows from listMine, even when others have submissions on the same campaign", async () => {
    const creatorA = await createUser({ role: "creator" });
    const creatorB = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    await createSubmission({ campaignId: campaign.id, creatorId: creatorA.id });
    await createSubmission({ campaignId: campaign.id, creatorId: creatorB.id });
    await createSubmission({ campaignId: campaign.id, creatorId: creatorA.id });

    const callerA = await createCaller({ id: creatorA.id, email: creatorA.email, role: "creator" });
    const mine = await callerA.submissions.listMine();

    expect(mine).toHaveLength(2);
    expect(mine.every((s) => s.campaignId === campaign.id)).toBe(true);
  });

  it("rejects a creator calling approve/reject outright, regardless of ownership", async () => {
    const admin = await createUser({ role: "admin" });
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign();
    const submission = await createSubmission({ campaignId: campaign.id, creatorId: creator.id });
    void admin;

    const callerCreator = await createCaller({
      id: creator.id,
      email: creator.email,
      role: "creator",
    });

    await expect(
      callerCreator.submissions.approve({ submissionId: submission.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      callerCreator.submissions.reject({
        submissionId: submission.id,
        rejectionReason: "not allowed anyway",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a creator creating or editing a campaign (admin-only)", async () => {
    const creator = await createUser({ role: "creator" });
    const existing = await createCampaign();

    const callerCreator = await createCaller({
      id: creator.id,
      email: creator.email,
      role: "creator",
    });

    await expect(
      callerCreator.campaigns.create({
        title: "Hostile Campaign",
        platforms: ["tiktok"],
        payoutPer1kViews: 100,
        totalBudget: 1000,
        status: "draft",
        startsAt: "2026-01-01",
        endsAt: "2026-02-01",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      callerCreator.campaigns.update({
        id: existing.id,
        title: "Hijacked title",
        platforms: existing.platforms,
        payoutPer1kViews: existing.payoutPer1kViews,
        totalBudget: existing.totalBudget,
        status: existing.status,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a creator listing the admin campaign list", async () => {
    const creator = await createUser({ role: "creator" });
    const callerCreator = await createCaller({
      id: creator.id,
      email: creator.email,
      role: "creator",
    });

    await expect(callerCreator.campaigns.list({ page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects any unauthenticated caller from protected procedures", async () => {
    const anonymousCaller = await createCaller(null);
    await expect(anonymousCaller.submissions.listMine()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
