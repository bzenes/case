import { z } from "zod";
import { PLATFORM_VALUES } from "./campaign";

export type Platform = (typeof PLATFORM_VALUES)[number];

const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "vm.tiktok.com"]);
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "youtu.be"]);

/**
 * Reasonable heuristic per SPEC.md "URL validation" - not a live check
 * against the platform's API.
 */
function matchesPlatform(url: URL, platform: Platform): boolean {
  switch (platform) {
    case "tiktok":
      if (!TIKTOK_HOSTS.has(url.hostname)) return false;
      if (url.hostname === "vm.tiktok.com") return /^\/[A-Za-z0-9]+\/?$/.test(url.pathname);
      return /^\/@[\w.-]+\/video\/\d+/.test(url.pathname);
    case "instagram":
      if (!INSTAGRAM_HOSTS.has(url.hostname)) return false;
      return url.pathname.startsWith("/reel/") || url.pathname.startsWith("/p/");
    case "youtube":
      if (!YOUTUBE_HOSTS.has(url.hostname)) return false;
      if (url.hostname === "youtu.be") return /^\/[\w-]+/.test(url.pathname);
      return (url.pathname === "/watch" && url.searchParams.has("v")) || url.pathname.startsWith("/shorts/");
  }
}

export function urlMatchesPlatform(rawUrl: string, platform: Platform): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return matchesPlatform(url, platform);
}

/** Shared by the creator submit-clip form (RHF) and the tRPC create input. */
export const submissionFormSchema = z
  .object({
    campaignId: z.string().uuid(),
    postUrl: z.string().trim().url("Must be a valid URL"),
    platform: z.enum(PLATFORM_VALUES),
  })
  .refine((data) => urlMatchesPlatform(data.postUrl, data.platform), {
    message: "That URL doesn't look like a real post URL for the selected platform.",
    path: ["postUrl"],
  });

export type SubmissionFormValues = z.infer<typeof submissionFormSchema>;
