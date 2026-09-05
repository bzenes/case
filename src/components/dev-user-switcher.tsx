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
    onSuccess: async (_result, variables) => {
      await utils.auth.me.invalidate();
      const target = users.data?.find((user) => user.id === variables.userId);
      router.push(target?.role === "admin" ? "/admin/campaigns" : "/creator/campaigns");
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
      {users.isLoading && <p className="text-sm text-muted-foreground">Loading users...</p>}
      {users.error && (
        <p className="text-sm text-destructive" role="alert">
          Couldn&apos;t load users: {users.error.message}
        </p>
      )}
      {switchUser.error && (
        <p className="text-sm text-destructive" role="alert">
          Couldn&apos;t switch user: {switchUser.error.message}
        </p>
      )}
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
