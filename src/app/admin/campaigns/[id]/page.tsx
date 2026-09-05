"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { campaignStatusVariant } from "@/lib/status-badge";
import { trpc } from "@/lib/trpc";

function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ReviewQueueRow({
  submission,
  campaignId,
}: {
  submission: { id: string; creatorEmail: string; postUrl: string; platform: string };
  campaignId: string;
}) {
  const utils = trpc.useUtils();
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  function refresh() {
    return Promise.all([
      utils.submissions.reviewQueue.invalidate({ campaignId }),
      utils.campaigns.overview.invalidate({ campaignId }),
      utils.campaigns.getById.invalidate({ id: campaignId }),
    ]);
  }

  const approve = trpc.submissions.approve.useMutation({ onSuccess: refresh });
  const reject = trpc.submissions.reject.useMutation({ onSuccess: refresh });

  const approveErrorMessage =
    approve.error?.data?.reason === "BUDGET_EXCEEDED"
      ? "Approving this would exceed the campaign's remaining budget."
      : approve.error?.data?.reason === "ALREADY_REVIEWED"
        ? "This submission was already reviewed (refresh the queue)."
        : approve.error?.message;

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="p-3">{submission.creatorEmail}</td>
      <td className="p-3">
        <a
          href={submission.postUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          {submission.platform}
        </a>
      </td>
      <td className="p-3">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={approve.isPending}
              onClick={() => approve.mutate({ submissionId: submission.id })}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={reject.isPending}
              onClick={() => setShowReject((s) => !s)}
            >
              Reject
            </Button>
          </div>
          {approveErrorMessage && (
            <p className="text-sm text-destructive">{approveErrorMessage}</p>
          )}
          {showReject && (
            <div className="flex flex-col gap-2">
              <Textarea
                placeholder="Rejection reason (required)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={reject.isPending || rejectionReason.trim().length === 0}
                  onClick={() =>
                    reject.mutate({
                      submissionId: submission.id,
                      rejectionReason: rejectionReason.trim(),
                    })
                  }
                >
                  Confirm reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>
                  Cancel
                </Button>
              </div>
              {reject.error && (
                <p className="text-sm text-destructive">{reject.error.message}</p>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const campaign = trpc.campaigns.getById.useQuery({ id });
  const overview = trpc.campaigns.overview.useQuery({ campaignId: id });
  const reviewQueue = trpc.submissions.reviewQueue.useQuery({ campaignId: id });

  if (campaign.isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }
  if (!campaign.data) {
    return <p className="text-destructive">Campaign not found.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{campaign.data.title}</h1>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant={campaignStatusVariant(campaign.data.status)}>
              {campaign.data.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {campaign.data.startsAt} &ndash; {campaign.data.endsAt}
            </span>
          </div>
        </div>
        <Link href={`/admin/campaigns/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
          Edit
        </Link>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Overview</h2>
        {overview.isLoading && <p className="text-muted-foreground">Loading...</p>}
        {overview.data && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Total approved views</p>
                <p className="text-xl font-semibold">
                  {overview.data.totalApprovedViews.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Budget spent</p>
                <p className="text-xl font-semibold">
                  {centsToDollars(overview.data.budgetSpent)}
                </p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Budget remaining</p>
                <p className="text-xl font-semibold">
                  {centsToDollars(overview.data.budgetRemaining)}
                </p>
              </div>
            </div>

            <div className="h-64 rounded-md border border-border p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overview.data.dailyViews}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="views" stroke="#2563eb" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Review queue</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Creator</th>
                <th className="p-3 font-medium">Platform</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewQueue.data?.length === 0 && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={3}>
                    No pending submissions.
                  </td>
                </tr>
              )}
              {reviewQueue.data?.map((submission) => (
                <ReviewQueueRow key={submission.id} submission={submission} campaignId={id} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
