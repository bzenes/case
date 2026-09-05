import { CampaignForm } from "@/components/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">New campaign</h1>
      <CampaignForm mode="create" />
    </div>
  );
}
