"use client";

import { Badge } from "@/components/ui/badge";
import { submissionStatusVariant } from "@/lib/status-badge";
import { trpc } from "@/lib/trpc";

export default function MySubmissionsPage() {
  const submissions = trpc.submissions.listMine.useQuery();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">My submissions</h1>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3 font-medium">Campaign</th>
              <th className="p-3 font-medium">Platform</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Views</th>
              <th className="p-3 font-medium">Est. earnings</th>
            </tr>
          </thead>
          <tbody>
            {submissions.isLoading && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>
                  Loading...
                </td>
              </tr>
            )}
            {submissions.data?.length === 0 && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>
                  No submissions yet.
                </td>
              </tr>
            )}
            {submissions.data?.map((submission) => (
              <tr key={submission.id} className="border-b border-border last:border-0 align-top">
                <td className="p-3">{submission.campaignTitle}</td>
                <td className="p-3">{submission.platform}</td>
                <td className="p-3">
                  <Badge variant={submissionStatusVariant(submission.status)}>
                    {submission.status}
                  </Badge>
                  {submission.status === "rejected" && submission.rejectionReason && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      {submission.rejectionReason}
                    </p>
                  )}
                </td>
                <td className="p-3">{submission.views.toLocaleString()}</td>
                <td className="p-3">${(submission.estimatedEarnings / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
