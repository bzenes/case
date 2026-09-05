export type BadgeVariant = "default" | "success" | "warning" | "destructive";

export function submissionStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "approved":
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "destructive";
    default:
      return "default";
  }
}

export function campaignStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "warning";
    default:
      return "default";
  }
}
