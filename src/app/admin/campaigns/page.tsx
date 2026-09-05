"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CAMPAIGN_STATUS_VALUES } from "@/lib/schemas/campaign";
import { campaignStatusVariant } from "@/lib/status-badge";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 10;

export default function AdminCampaignsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");

  const query = trpc.campaigns.list.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    status: (status || undefined) as (typeof CAMPAIGN_STATUS_VALUES)[number] | undefined,
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Campaigns</h1>
        <Link href="/admin/campaigns/new" className={buttonVariants()}>
          New campaign
        </Link>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search by title..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="max-w-40"
        >
          <option value="">All statuses</option>
          {CAMPAIGN_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Budget</th>
              <th className="p-3 font-medium">Payout / 1k</th>
              <th className="p-3 font-medium">Dates</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>
                  Loading...
                </td>
              </tr>
            )}
            {query.data?.rows.length === 0 && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>
                  No campaigns match.
                </td>
              </tr>
            )}
            {query.data?.rows.map((campaign) => (
              <tr key={campaign.id} className="border-b border-border last:border-0">
                <td className="p-3">
                  <Link
                    href={`/admin/campaigns/${campaign.id}`}
                    className="font-medium hover:underline"
                  >
                    {campaign.title}
                  </Link>
                </td>
                <td className="p-3">
                  <Badge variant={campaignStatusVariant(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </td>
                <td className="p-3">${(campaign.totalBudget / 100).toFixed(2)}</td>
                <td className="p-3">${(campaign.payoutPer1kViews / 100).toFixed(2)}</td>
                <td className="p-3 text-muted-foreground">
                  {campaign.startsAt} &ndash; {campaign.endsAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages} ({query.data?.total ?? 0} total)
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
