import { z } from "zod";

export const PLATFORM_VALUES = ["tiktok", "instagram", "youtube"] as const;
export const CAMPAIGN_STATUS_VALUES = ["draft", "active", "paused", "completed"] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

function endsAfterStarts(data: { startsAt: string; endsAt: string }) {
  return data.startsAt <= data.endsAt;
}
const endsAfterStartsRefinement = {
  message: "End date must be on or after the start date",
  path: ["endsAt"],
};

const campaignBaseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  platforms: z
    .array(z.enum(PLATFORM_VALUES))
    .min(1, "Select at least one platform"),
  payoutPer1kViews: z.coerce
    .number()
    .int("Must be a whole number of cents")
    .positive("Must be a positive integer (cents)"),
  totalBudget: z.coerce
    .number()
    .int("Must be a whole number of cents")
    .positive("Must be a positive integer (cents)"),
  status: z.enum(CAMPAIGN_STATUS_VALUES),
  startsAt: isoDate,
  endsAt: isoDate,
});

/** Shared by the admin create/edit form (RHF) and the tRPC create input. */
export const campaignFormSchema = campaignBaseSchema.refine(
  endsAfterStarts,
  endsAfterStartsRefinement,
);

/** Same fields plus the id being edited - shared by the edit form and the tRPC update input. */
export const campaignUpdateSchema = campaignBaseSchema
  .extend({ id: z.string().uuid() })
  .refine(endsAfterStarts, endsAfterStartsRefinement);

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
export type CampaignUpdateValues = z.infer<typeof campaignUpdateSchema>;
