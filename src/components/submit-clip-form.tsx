"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { submissionFormSchema, type SubmissionFormValues } from "@/lib/schemas/submission";
import { trpc } from "@/lib/trpc";

export function SubmitClipForm({
  campaignId,
  platforms,
  onDone,
}: {
  campaignId: string;
  platforms: readonly string[];
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubmissionFormValues>({
    resolver: zodResolver(submissionFormSchema),
    defaultValues: {
      campaignId,
      postUrl: "",
      platform: platforms[0] as SubmissionFormValues["platform"],
    },
  });

  const create = trpc.submissions.create.useMutation({
    onSuccess: async () => {
      await utils.submissions.listMine.invalidate();
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => create.mutate({ ...values, campaignId }))}
      className="flex flex-col gap-3 rounded-md border border-border p-4"
    >
      <div>
        <Label htmlFor={`platform-${campaignId}`}>Platform</Label>
        <Select id={`platform-${campaignId}`} {...register("platform")}>
          {platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`postUrl-${campaignId}`}>Post URL</Label>
        <Input
          id={`postUrl-${campaignId}`}
          placeholder="https://..."
          {...register("postUrl")}
        />
        {errors.postUrl && <p className="text-sm text-destructive">{errors.postUrl.message}</p>}
      </div>
      {create.error && <p className="text-sm text-destructive">{create.error.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={create.isPending}>
          Submit
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
