"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CAMPAIGN_STATUS_VALUES,
  campaignFormSchema,
  type CampaignFormValues,
  PLATFORM_VALUES,
} from "@/lib/schemas/campaign";
import { trpc } from "@/lib/trpc";

type Props =
  | { mode: "create" }
  | { mode: "edit"; campaignId: string; defaultValues: CampaignFormValues };

export function CampaignForm(props: Props) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            title: "",
            platforms: [],
            payoutPer1kViews: 0,
            totalBudget: 0,
            status: "draft",
            startsAt: "",
            endsAt: "",
          },
  });

  const create = trpc.campaigns.create.useMutation({
    onSuccess: async (campaign) => {
      await utils.campaigns.list.invalidate();
      if (campaign) router.push(`/admin/campaigns/${campaign.id}`);
    },
  });
  const update = trpc.campaigns.update.useMutation({
    onSuccess: async (campaign) => {
      await utils.campaigns.list.invalidate();
      if (campaign) {
        await utils.campaigns.getById.invalidate({ id: campaign.id });
        router.push(`/admin/campaigns/${campaign.id}`);
      }
    },
  });

  const selectedPlatforms = watch("platforms");
  const mutation = props.mode === "create" ? create : update;

  const onSubmit = (values: CampaignFormValues) => {
    if (props.mode === "create") {
      create.mutate(values);
    } else {
      update.mutate({ id: props.campaignId, ...values });
    }
  };

  function togglePlatform(platform: (typeof PLATFORM_VALUES)[number]) {
    const next = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter((p) => p !== platform)
      : [...selectedPlatforms, platform];
    setValue("platforms", next, { shouldValidate: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-lg flex-col gap-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div>
        <Label>Platforms</Label>
        <div className="flex gap-4 pt-1">
          {PLATFORM_VALUES.map((platform) => (
            <label key={platform} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                onChange={() => togglePlatform(platform)}
              />
              {platform}
            </label>
          ))}
        </div>
        {errors.platforms && (
          <p className="text-sm text-destructive">{errors.platforms.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="payoutPer1kViews">Payout per 1,000 views (cents)</Label>
        <Input id="payoutPer1kViews" type="number" {...register("payoutPer1kViews")} />
        {errors.payoutPer1kViews && (
          <p className="text-sm text-destructive">{errors.payoutPer1kViews.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="totalBudget">Total budget (cents)</Label>
        <Input id="totalBudget" type="number" {...register("totalBudget")} />
        {errors.totalBudget && (
          <p className="text-sm text-destructive">{errors.totalBudget.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select id="status" {...register("status")}>
          {CAMPAIGN_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Label htmlFor="startsAt">Starts at</Label>
          <Input id="startsAt" type="date" {...register("startsAt")} />
          {errors.startsAt && (
            <p className="text-sm text-destructive">{errors.startsAt.message}</p>
          )}
        </div>
        <div className="flex-1">
          <Label htmlFor="endsAt">Ends at</Label>
          <Input id="endsAt" type="date" {...register("endsAt")} />
          {errors.endsAt && <p className="text-sm text-destructive">{errors.endsAt.message}</p>}
        </div>
      </div>

      {mutation.error && <p className="text-sm text-destructive">{mutation.error.message}</p>}

      <Button type="submit" disabled={isSubmitting || mutation.isPending}>
        {props.mode === "create" ? "Create campaign" : "Save changes"}
      </Button>
    </form>
  );
}
