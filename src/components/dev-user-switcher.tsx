"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export function DevUserSwitcher() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const users = trpc.auth.listDevUsers.useQuery();
  const me = trpc.auth.me.useQuery();
  const switchUser = trpc.auth.switchUser.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      router.refresh();
    },
  });
  const signOut = trpc.auth.signOut.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <p className="text-sm text-muted-foreground">
        Dev user switcher (no real auth) - signed in as:{" "}
        <span className="font-medium text-foreground">
          {me.data ? `${me.data.email} (${me.data.role})` : "nobody"}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {users.data?.map((user) => (
          <Button
            key={user.id}
            variant={me.data?.id === user.id ? "default" : "outline"}
            size="sm"
            disabled={switchUser.isPending}
            onClick={() => switchUser.mutate({ userId: user.id })}
          >
            {user.email} ({user.role})
          </Button>
        ))}
        {me.data && (
          <Button
            variant="ghost"
            size="sm"
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
          >
            Sign out
          </Button>
        )}
      </div>
    </div>
  );
}
