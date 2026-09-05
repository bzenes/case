import { getDb, schema } from "@/server/db/client";

export async function createUser(overrides: Partial<typeof schema.users.$inferInsert> = {}) {
  const db = await getDb();
  const [user] = await db
    .insert(schema.users)
    .values({
      email: overrides.email ?? `user-${crypto.randomUUID()}@example.com`,
      role: overrides.role ?? "creator",
      ...overrides,
    })
    .returning();
  if (!user) throw new Error("Failed to create fixture user");
  return user;
}

export async function createCampaign(
  overrides: Partial<typeof schema.campaigns.$inferInsert> = {},
) {
  const db = await getDb();
  const [campaign] = await db
    .insert(schema.campaigns)
    .values({
      title: overrides.title ?? "Fixture Campaign",
      platforms: overrides.platforms ?? ["tiktok"],
      payoutPer1kViews: overrides.payoutPer1kViews ?? 500,
      totalBudget: overrides.totalBudget ?? 100_000,
      status: overrides.status ?? "active",
      startsAt: overrides.startsAt ?? "2026-01-01",
      endsAt: overrides.endsAt ?? "2026-12-31",
      ...overrides,
    })
    .returning();
  if (!campaign) throw new Error("Failed to create fixture campaign");
  return campaign;
}

export async function createSubmission(
  overrides: Partial<typeof schema.submissions.$inferInsert> & {
    campaignId: string;
    creatorId: string;
  },
) {
  const db = await getDb();
  const [submission] = await db
    .insert(schema.submissions)
    .values({
      postUrl: `https://www.tiktok.com/@fixture/video/${crypto.randomUUID().replace(/-/g, "")}`,
      platform: "tiktok",
      status: "pending",
      ...overrides,
    })
    .returning();
  if (!submission) throw new Error("Failed to create fixture submission");
  return submission;
}

export async function addMetric(
  submissionId: string,
  views: number,
  capturedAt = "2026-01-02",
) {
  const db = await getDb();
  const [metric] = await db
    .insert(schema.submissionMetrics)
    .values({
      submissionId,
      capturedAt,
      views,
      likes: Math.round(views * 0.05),
      comments: Math.round(views * 0.01),
    })
    .returning();
  if (!metric) throw new Error("Failed to create fixture metric");
  return metric;
}
