"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitClipForm } from "@/components/submit-clip-form";
import { trpc } from "@/lib/trpc";

export default function BrowseCampaignsPage() {
  const campaigns = trpc.campaigns.listActive.useQuery();
  const [openFor, setOpenFor] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Active campaigns</h1>
      {campaigns.isLoading && <p className="text-muted-foreground">Loading...</p>}
      {campaigns.error && (
        <p className="text-destructive" role="alert">
          Couldn&apos;t load campaigns: {campaigns.error.message}
        </p>
      )}
      {campaigns.data?.length === 0 && (
        <p className="text-muted-foreground">No active campaigns right now.</p>
      )}
      <div className="flex flex-col gap-4">
        {campaigns.data?.map((campaign) => (
          <div key={campaign.id} className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{campaign.title}</p>
                <p className="text-sm text-muted-foreground">
                  {campaign.platforms.join(", ")} &middot; $
                  {(campaign.payoutPer1kViews / 100).toFixed(2)} / 1k views &middot; ends{" "}
                  {campaign.endsAt}
                </p>
              </div>
              <Button
                size="sm"
                variant={openFor === campaign.id ? "outline" : "default"}
                aria-expanded={openFor === campaign.id}
                onClick={() => setOpenFor(openFor === campaign.id ? null : campaign.id)}
              >
                {openFor === campaign.id ? "Cancel" : "Submit a clip"}
              </Button>
            </div>
            {openFor === campaign.id && (
              <div className="pt-3">
                <SubmitClipForm
                  campaignId={campaign.id}
                  platforms={campaign.platforms}
                  onDone={() => setOpenFor(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
