"use client";

import { useEffect, useState } from "react";
import type { EpisodeInfo, ShowDisplay, ShowInfo } from "@/lib/shows";
import type { WatchedMap } from "@/lib/shows-watched";

const PIN_KEY = "digest:settingsPin:v1";

function getPin(): string {
  try {
    return localStorage.getItem(PIN_KEY) ?? "";
  } catch {
    return "";
  }
}

const SERVICE_STYLES: Record<string, string> = {
  HBO: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  "Paramount+": "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  "Apple TV": "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
  "Comedy Central": "bg-amber-500/15 text-amber-600 dark:text-amber-300",
};

function ServicePill({ service }: { service: string | null }) {
  if (!service) return null;
  const cls = SERVICE_STYLES[service] ?? "bg-zinc-500/15 text-zinc-500";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{service}</span>;
}

/** "S2E3", or "S4 Special" for a special (number === null). Matches src/lib/shows.ts episodeLabel. */
function episodeLabel(ep: EpisodeInfo): string {
  return ep.number === null ? `S${ep.season} Special` : `S${ep.season}E${ep.number}`;
}

interface Row {
  info: ShowInfo;
  display: ShowDisplay;
}

export function ShowsView({
  rows,
  marks,
  fetchedAt,
  stale,
}: {
  rows: Row[];
  marks: WatchedMap;
  fetchedAt: string | null;
  stale: boolean;
}) {
  const [isOwner, setIsOwner] = useState(false);
  const [unwatched, setUnwatched] = useState<Set<number>>(
    () => new Set(rows.filter((r) => r.display.unwatched).map((r) => r.info.tvmazeId)),
  );
  const [watchedLabel, setWatchedLabel] = useState<Record<number, string>>(() => {
    const out: Record<number, string> = {};
    for (const r of rows) {
      const mark = marks[r.info.tvmazeId];
      if (mark?.label) out[r.info.tvmazeId] = mark.label;
    }
    return out;
  });
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [allPending, setAllPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsOwner(!!getPin());
  }, []);

  const setPendingFor = (id: number, on: boolean) =>
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function post(body: unknown): Promise<boolean> {
    try {
      const res = await fetch("/api/shows/watched", {
        method: "POST",
        headers: { "content-type": "application/json", "x-settings-pin": getPin() },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setIsOwner(false);
        setError("Set your PIN in ⚙︎ Settings to mark episodes");
        return false;
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "failed");
      return true;
    } catch {
      setError("Couldn't save — try again.");
      return false;
    }
  }

  async function markWatched(row: Row) {
    const { info } = row;
    if (!info.latest || pending.has(info.tvmazeId) || allPending) return;
    const label = episodeLabel(info.latest);
    setPendingFor(info.tvmazeId, true);
    setError(null);
    setUnwatched((prev) => {
      const next = new Set(prev);
      next.delete(info.tvmazeId);
      return next;
    });
    setWatchedLabel((prev) => ({ ...prev, [info.tvmazeId]: label }));

    const ok = await post({
      action: "watch",
      tvmazeId: info.tvmazeId,
      episode: { id: info.latest.id, airdate: info.latest.airdate, label },
    });
    setPendingFor(info.tvmazeId, false);
    if (!ok) {
      setUnwatched((prev) => new Set(prev).add(info.tvmazeId));
      setWatchedLabel((prev) => {
        const next = { ...prev };
        delete next[info.tvmazeId];
        return next;
      });
    }
  }

  async function undoWatched(row: Row) {
    const { info } = row;
    if (pending.has(info.tvmazeId) || allPending) return;
    const prevLabel = watchedLabel[info.tvmazeId];
    setPendingFor(info.tvmazeId, true);
    setError(null);
    setUnwatched((prev) => new Set(prev).add(info.tvmazeId));
    setWatchedLabel((prev) => {
      const next = { ...prev };
      delete next[info.tvmazeId];
      return next;
    });

    const ok = await post({ action: "unwatch", tvmazeId: info.tvmazeId });
    setPendingFor(info.tvmazeId, false);
    if (!ok) {
      setUnwatched((prev) => {
        const next = new Set(prev);
        next.delete(info.tvmazeId);
        return next;
      });
      if (prevLabel) setWatchedLabel((prev) => ({ ...prev, [info.tvmazeId]: prevLabel }));
    }
  }

  async function markAllWatched() {
    if (allPending) return;
    const items = rows
      .filter((r) => unwatched.has(r.info.tvmazeId) && r.info.latest)
      .map((r) => ({
        tvmazeId: r.info.tvmazeId,
        episode: {
          id: r.info.latest!.id,
          airdate: r.info.latest!.airdate,
          label: episodeLabel(r.info.latest!),
        },
      }));
    if (!items.length) return;
    setAllPending(true); // blocks individual row taps until this settles, so they can't race the batch write
    setError(null);
    const prevUnwatched = new Set(unwatched);
    const prevLabels = { ...watchedLabel };
    setUnwatched(new Set());
    setWatchedLabel((prev) => {
      const next = { ...prev };
      for (const it of items) next[it.tvmazeId] = it.episode.label;
      return next;
    });

    const ok = await post({ action: "watchAll", items });
    setAllPending(false);
    if (!ok) {
      setUnwatched(prevUnwatched);
      setWatchedLabel(prevLabels);
    }
  }

  if (!rows.length) {
    return (
      <p className="py-10 text-center text-black/50 dark:text-white/50">
        Couldn&apos;t reach TVmaze right now. Try again shortly.
      </p>
    );
  }

  const unwatchedCount = rows.filter((r) => unwatched.has(r.info.tvmazeId)).length;

  return (
    <div>
      {isOwner && unwatchedCount >= 2 && (
        <div className="mb-3">
          <button
            type="button"
            disabled={allPending}
            onClick={markAllWatched}
            className="text-sm text-black/50 hover:underline disabled:opacity-60 dark:text-white/50"
          >
            {allPending ? "Marking all watched…" : "Mark all watched"}
          </button>
        </div>
      )}
      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul>
        {rows.map((row) => {
          const { info, display } = row;
          const rowUnwatched = unwatched.has(info.tvmazeId);
          const isPending = pending.has(info.tvmazeId);
          return (
            <li
              key={info.tvmazeId}
              className="flex items-start gap-3 border-b border-black/5 py-3 last:border-0 dark:border-white/10"
            >
              {info.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={info.image}
                  alt=""
                  loading="lazy"
                  className="aspect-[2/3] w-10 shrink-0 rounded object-cover sm:w-12"
                />
              ) : (
                <div className="aspect-[2/3] w-10 shrink-0 rounded bg-black/10 dark:bg-white/10 sm:w-12" />
              )}
              <div className="min-w-0 flex-1 break-words">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{info.name}</span>
                  <ServicePill service={info.service} />
                  {rowUnwatched && (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                      NEW
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-sm text-black/70 dark:text-white/60 ${!rowUnwatched ? "opacity-60" : ""}`}>
                  {display.latestLabel}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    info.error ? "text-amber-600 dark:text-amber-400" : "text-black/40 dark:text-white/40"
                  }`}
                >
                  {display.statusLabel}
                </p>
              </div>
              {isOwner && info.latest && (
                <div className="shrink-0">
                  {rowUnwatched ? (
                    <button
                      type="button"
                      disabled={isPending || allPending}
                      onClick={() => markWatched(row)}
                      className="min-h-9 rounded-full border border-black/10 px-3 text-sm hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
                    >
                      ✓ Watched
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending || allPending}
                      onClick={() => undoWatched(row)}
                      className="text-xs text-black/40 hover:underline disabled:opacity-60 dark:text-white/40"
                    >
                      Watched {watchedLabel[info.tvmazeId] ?? episodeLabel(info.latest)} · Undo
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="mt-8 border-t border-black/10 pt-4 text-xs text-black/40 dark:border-white/10 dark:text-white/40">
        Schedule from{" "}
        <a
          href="https://www.tvmaze.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          TVmaze
        </a>
        {fetchedAt &&
          ` · updated ${new Date(fetchedAt).toLocaleString(undefined, { timeZone: "America/New_York" })}`}
        {stale && " · TVmaze unavailable, showing saved data"}
      </footer>
    </div>
  );
}
