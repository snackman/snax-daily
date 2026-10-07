import Link from "next/link";
import type { Metadata } from "next";
import { getShows, sortShows } from "@/lib/shows";
import { getWatched } from "@/lib/shows-watched";
import { todayInTz } from "@/lib/date";
import { ShowsView } from "@/components/shows-view";
import { ViewTabs } from "@/components/view-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shows · Snax Daily",
};

export default async function ShowsPage() {
  const [{ snapshot, stale }, marks] = await Promise.all([getShows(), getWatched()]);
  const today = todayInTz();
  const rows = snapshot ? sortShows(snapshot.shows, marks, today) : [];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Snax Daily 🍿</h1>
          <p className="text-black/50 dark:text-white/50">TV shows</p>
        </div>
        <Link
          href="/settings"
          title="Settings"
          className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          ⚙︎
        </Link>
      </div>

      <ViewTabs active="shows" />

      <ShowsView rows={rows} marks={marks} fetchedAt={snapshot?.fetchedAt ?? null} stale={stale} />
    </main>
  );
}
