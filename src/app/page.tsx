import { DevUserSwitcher } from "@/components/dev-user-switcher";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Clipping Campaign Marketplace</h1>
      <DevUserSwitcher />
    </main>
  );
}
