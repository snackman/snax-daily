"use client";

import Link from "next/link";

// Mirrors the News/Podcasts toggle inside DigestView (src/components/digest-view.tsx),
// for use on pages outside the digest view (currently just /shows). News/Podcasts
// navigate home and set the view DigestView reads on mount; Shows is this page.

const VIEW_KEY = "digest:view:v1";

const inactive = "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white";
const active = "bg-black/[0.06] text-black dark:bg-white/10 dark:text-white";

function setView(v: "news" | "podcasts") {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* ignore */
  }
}

export function ViewTabs({ active: activeTab }: { active: "news" | "podcasts" | "shows" }) {
  return (
    <div className="mb-4 inline-flex rounded-xl border border-black/10 p-0.5 text-sm dark:border-white/15">
      <Link
        href="/"
        onClick={() => setView("news")}
        className={`rounded-lg px-2.5 py-1.5 font-medium transition sm:px-3 ${activeTab === "news" ? active : inactive}`}
      >
        📰 News
      </Link>
      <Link
        href="/"
        onClick={() => setView("podcasts")}
        className={`rounded-lg px-2.5 py-1.5 font-medium transition sm:px-3 ${activeTab === "podcasts" ? active : inactive}`}
      >
        🎧 Podcasts
      </Link>
      <Link
        href="/shows"
        className={`rounded-lg px-2.5 py-1.5 font-medium transition sm:px-3 ${activeTab === "shows" ? active : inactive}`}
      >
        📺 Shows
      </Link>
    </div>
  );
}
