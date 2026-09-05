import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "creator"]);
export const platformEnum = pgEnum("platform", [
  "tiktok",
  "instagram",
  "youtube",
]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  // Postgres array of the platform enum rather than a join table: a campaign's
  // platform set is small, fixed-cardinality, and never queried relationally
  // (no "find campaigns sharing a platform with X"), so the array avoids a
  // needless join table. See NOTES.md for the tradeoff.
  platforms: platformEnum("platforms").array().notNull(),
  payoutPer1kViews: integer("payout_per_1k_views").notNull(),
  totalBudget: integer("total_budget").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  startsAt: date("starts_at").notNull(),
  endsAt: date("ends_at").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    postUrl: text("post_url").notNull(),
    platform: platformEnum("platform").notNull(),
    status: submissionStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("submissions_campaign_id_post_url_unique").on(
      table.campaignId,
      table.postUrl,
    ),
    check(
      "rejection_reason_required_when_rejected",
      sql`(status <> 'rejected') OR (rejection_reason IS NOT NULL)`,
    ),
  ],
);

export const submissionMetrics = pgTable(
  "submission_metrics",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "restrict" }),
    capturedAt: date("captured_at").notNull(),
    views: integer("views").notNull(),
    likes: integer("likes").notNull(),
    comments: integer("comments").notNull(),
  },
  (table) => [
    unique("submission_metrics_submission_id_captured_at_unique").on(
      table.submissionId,
      table.capturedAt,
    ),
  ],
);
