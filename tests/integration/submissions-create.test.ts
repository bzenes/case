import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { createCaller } from "../setup/caller";
import { createCampaign, createSubmission, createUser } from "../setup/fixtures";
import { resetDb } from "../setup/reset-db";

describe("submissions.create", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects a second submission of the same URL to the same campaign with a typed conflict", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({ status: "active", platforms: ["tiktok"] });
    const postUrl = "https://www.tiktok.com/@creator/video/1234567890";
    await createSubmission({ campaignId: campaign.id, creatorId: creator.id, postUrl, platform: "tiktok" });

    const caller = await createCaller({ id: creator.id, email: creator.email, role: "creator" });

    let thrown: unknown;
    try {
      await caller.submissions.create({ campaignId: campaign.id, postUrl, platform: "tiktok" });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(TRPCError);
    expect((thrown as TRPCError).code).toBe("CONFLICT");
  });

  it("rejects a submission to a platform the campaign doesn't accept", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({ status: "active", platforms: ["youtube"] });
    const caller = await createCaller({ id: creator.id, email: creator.email, role: "creator" });

    await expect(
      caller.submissions.create({
        campaignId: campaign.id,
        postUrl: "https://www.tiktok.com/@creator/video/1234567890",
        platform: "tiktok",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a submission to a non-active campaign", async () => {
    const creator = await createUser({ role: "creator" });
    const campaign = await createCampaign({ status: "draft", platforms: ["tiktok"] });
    const caller = await createCaller({ id: creator.id, email: creator.email, role: "creator" });

    await expect(
      caller.submissions.create({
        campaignId: campaign.id,
        postUrl: "https://www.tiktok.com/@creator/video/1234567890",
        platform: "tiktok",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("creates a pending submission with the creatorId taken from the session, not client input", async () => {
    const creator = await createUser({ role: "creator" });
    const impersonated = await createUser({ role: "creator" });
    const campaign = await createCampaign({ status: "active", platforms: ["tiktok"] });
    const caller = await createCaller({ id: creator.id, email: creator.email, role: "creator" });

    const result = await caller.submissions.create({
      campaignId: campaign.id,
      postUrl: "https://www.tiktok.com/@creator/video/1234567890",
      platform: "tiktok",
      // @ts-expect-error - creatorId isn't part of the input schema; this proves it's ignored even if smuggled in.
      creatorId: impersonated.id,
    });

    expect(result?.creatorId).toBe(creator.id);
    expect(result?.status).toBe("pending");
  });
});
