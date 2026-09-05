import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/server/current-user";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <nav className="flex items-center justify-between border-b border-border pb-4">
        <Link href="/admin/campaigns" className="text-lg font-semibold">
          Admin
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          Switch user
        </Link>
      </nav>
      {children}
    </div>
  );
}
