"use client";

import { use } from "react";
import { CampaignForm } from "@/components/campaign-form";
import { trpc } from "@/lib/trpc";

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const campaign = trpc.campaigns.getById.useQuery({ id });

  if (campaign.isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }
  if (!campaign.data) {
    return <p className="text-destructive">Campaign not found.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Edit campaign</h1>
      <CampaignForm
        mode="edit"
        campaignId={id}
        defaultValues={{
          title: campaign.data.title,
          platforms: campaign.data.platforms,
          payoutPer1kViews: campaign.data.payoutPer1kViews,
          totalBudget: campaign.data.totalBudget,
          status: campaign.data.status,
          startsAt: campaign.data.startsAt,
          endsAt: campaign.data.endsAt,
        }}
      />
    </div>
  );
}
