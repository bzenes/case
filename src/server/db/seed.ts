import "../load-env";
import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "./client";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;
const today = new Date();
const daysAgo = (n: number) => isoDate(new Date(today.getTime() - n * DAY_MS));
const daysFromNow = (n: number) => isoDate(new Date(today.getTime() + n * DAY_MS));

function threeDayMetrics(submissionId: string, startViews: number, dailyIncrease: number) {
  return [2, 1, 0].map((daysBack, idx) => {
    const views = startViews + idx * dailyIncrease;
    return {
      submissionId,
      capturedAt: daysAgo(daysBack),
      views,
      likes: Math.round(views * 0.05),
      comments: Math.round(views * 0.01),
    };
  });
}

async function main() {
  const db = await getDb();

  // Idempotent: safe to re-run, always resets to the same known fixture set.
  await db.execute(
    sql`TRUNCATE TABLE submission_metrics, submissions, campaigns, users RESTART IDENTITY CASCADE`,
  );

  const [admin, creator1, creator2, creator3] = await db
    .insert(schema.users)
    .values([
      { email: "admin@example.com", role: "admin" },
      { email: "creator1@example.com", role: "creator" },
      { email: "creator2@example.com", role: "creator" },
      { email: "creator3@example.com", role: "creator" },
    ])
    .returning();

  if (!admin || !creator1 || !creator2 || !creator3) {
    throw new Error("Seed failed: user insert did not return expected rows");
  }

  const [acme, summer, draftWinter, pausedSpring, completedHoliday] = await db
    .insert(schema.campaigns)
    .values([
      {
        title: "Acme Product Launch",
        platforms: ["tiktok", "instagram"],
        payoutPer1kViews: 500,
        totalBudget: 100_000,
        status: "active",
        startsAt: daysAgo(14),
        endsAt: daysFromNow(14),
      },
      {
        title: "Summer Sale Clips",
        platforms: ["youtube"],
        payoutPer1kViews: 300,
        totalBudget: 50_000,
        status: "active",
        startsAt: daysAgo(7),
        endsAt: daysFromNow(21),
      },
      {
        title: "Draft Winter Campaign",
        platforms: ["tiktok"],
        payoutPer1kViews: 400,
        totalBudget: 20_000,
        status: "draft",
        startsAt: daysFromNow(30),
        endsAt: daysFromNow(60),
      },
      {
        title: "Paused Spring Promo",
        platforms: ["instagram", "youtube"],
        payoutPer1kViews: 600,
        totalBudget: 30_000,
        status: "paused",
        startsAt: daysAgo(60),
        endsAt: daysAgo(30),
      },
      {
        title: "Completed Holiday Push",
        platforms: ["tiktok"],
        payoutPer1kViews: 200,
        totalBudget: 10_000,
        status: "completed",
        startsAt: daysAgo(90),
        endsAt: daysAgo(10),
      },
    ])
    .returning();

  if (!acme || !summer || !draftWinter || !pausedSpring || !completedHoliday) {
    throw new Error("Seed failed: campaign insert did not return expected rows");
  }

  const [
    acmeApproved,
    acmePending,
    acmeRejected,
    summerPending,
    summerApproved,
    holidayPaid,
  ] = await db
    .insert(schema.submissions)
    .values([
      {
        campaignId: acme.id,
        creatorId: creator1.id,
        postUrl: "https://www.tiktok.com/@creator1/video/7123456789012345678",
        platform: "tiktok",
        status: "approved",
      },
      {
        campaignId: acme.id,
        creatorId: creator2.id,
        postUrl: "https://www.instagram.com/reel/Cabc123XYZ/",
        platform: "instagram",
        status: "pending",
      },
      {
        campaignId: acme.id,
        creatorId: creator3.id,
        postUrl: "https://www.tiktok.com/@creator3/video/7987654321098765432",
        platform: "tiktok",
        status: "rejected",
        rejectionReason: "Low quality clip, doesn't feature the product.",
      },
      {
        campaignId: summer.id,
        creatorId: creator1.id,
        postUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
        platform: "youtube",
        status: "pending",
      },
      {
        campaignId: summer.id,
        creatorId: creator2.id,
        postUrl: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
        platform: "youtube",
        status: "approved",
      },
      {
        campaignId: completedHoliday.id,
        creatorId: creator3.id,
        postUrl: "https://www.tiktok.com/@creator3/video/7111111111111111111",
        platform: "tiktok",
        status: "paid",
      },
    ])
    .returning();

  if (
    !acmeApproved ||
    !acmePending ||
    !acmeRejected ||
    !summerPending ||
    !summerApproved ||
    !holidayPaid
  ) {
    throw new Error("Seed failed: submission insert did not return expected rows");
  }

  await db.insert(schema.submissionMetrics).values([
    ...threeDayMetrics(acmeApproved.id, 21_000, 2_000),
    ...threeDayMetrics(summerApproved.id, 6_500, 750),
    ...threeDayMetrics(holidayPaid.id, 48_000, 1_000),
  ]);

  console.log("Seeded 4 users, 5 campaigns, 6 submissions, metrics for 3 approved/paid submissions.");
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
