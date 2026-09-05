import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/server/current-user";

export default async function CreatorLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "creator") {
    redirect("/");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <nav className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex gap-4">
          <Link href="/creator/campaigns" className="text-lg font-semibold">
            Campaigns
          </Link>
          <Link
            href="/creator/submissions"
            className="text-lg font-semibold text-muted-foreground hover:text-foreground"
          >
            My submissions
          </Link>
        </div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          Switch user
        </Link>
      </nav>
      {children}
    </div>
  );
}
