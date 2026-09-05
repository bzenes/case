import { describe, expect, it } from "vitest";
import { urlMatchesPlatform } from "@/lib/schemas/submission";

describe("urlMatchesPlatform", () => {
  it("accepts a well-formed TikTok video URL", () => {
    expect(urlMatchesPlatform("https://www.tiktok.com/@creator/video/7123456789012345678", "tiktok")).toBe(
      true,
    );
  });

  it("accepts a TikTok short link", () => {
    expect(urlMatchesPlatform("https://vm.tiktok.com/ZMabcdefg/", "tiktok")).toBe(true);
  });

  it("rejects a TikTok-hostname URL that isn't shaped like a video/short-link", () => {
    expect(urlMatchesPlatform("https://www.tiktok.com/discover/trending", "tiktok")).toBe(false);
  });

  it("accepts a well-formed Instagram reel URL", () => {
    expect(urlMatchesPlatform("https://www.instagram.com/reel/Cabc123XYZ/", "instagram")).toBe(true);
  });

  it("rejects an Instagram profile URL (not a /reel/ or /p/ path)", () => {
    expect(urlMatchesPlatform("https://www.instagram.com/someuser/", "instagram")).toBe(false);
  });

  it("accepts a well-formed YouTube watch URL", () => {
    expect(urlMatchesPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube")).toBe(true);
  });

  it("accepts a YouTube shorts URL", () => {
    expect(urlMatchesPlatform("https://www.youtube.com/shorts/abc123XYZ", "youtube")).toBe(true);
  });

  it("accepts a youtu.be short link", () => {
    expect(urlMatchesPlatform("https://youtu.be/dQw4w9WgXcQ", "youtube")).toBe(true);
  });

  it("rejects a URL for the wrong platform entirely (YouTube URL claimed as TikTok)", () => {
    expect(urlMatchesPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "tiktok")).toBe(false);
  });

  it("rejects a malformed/non-URL string", () => {
    expect(urlMatchesPlatform("not a url", "tiktok")).toBe(false);
  });

  it("rejects a non-http(s) protocol", () => {
    expect(urlMatchesPlatform("ftp://www.tiktok.com/@creator/video/123", "tiktok")).toBe(false);
  });
});
