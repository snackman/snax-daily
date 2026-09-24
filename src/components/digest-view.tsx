"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Digest, DigestStory, PodcastEpisode } from "@/lib/types";

const TOPIC_STYLES: Record<string, string> = {
  AI: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  Tech: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  Science: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  Space: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
  Quantum: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
  Biotech: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  Nuclear: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  Fusion: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-300",
  Energy: "bg-lime-500/15 text-lime-600 dark:text-lime-300",
  Blockchain: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
  Apple: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
  Nintendo: "bg-red-500/15 text-red-600 dark:text-red-300",
};

const READ_KEY = "digest:read:v2";
const STAR_KEY = "digest:starred:v1";
const HIDE_KEY = "digest:hideRead:v1";
const HIDDEN_TOPICS_KEY = "digest:hiddenTopics:v1";
const VIEW_KEY = "digest:view:v1";
const PIN_KEY = "digest:settingsPin:v1";

function getPin(): string {
  try {
    return localStorage.getItem(PIN_KEY) ?? "";
  } catch {
    return "";
  }
}

type View = "news" | "podcasts";

type ItemMeta = { link: string; topic: string; source: string };

function loadLS(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function saveLS(key: string, arr: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

/**
 * Read + starred state. For the owner (has a valid PIN) it syncs to the server
 * so it follows them across devices. For everyone else it's local-only — a
 * visitor's reads never touch the owner's store.
 */
function useReaderState(meta: Map<string, ItemMeta>) {
  const [read, setRead] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const owner = useRef(false); // true once the server accepts our PIN

  useEffect(() => {
    // Instant paint from localStorage.
    setRead(new Set(loadLS(READ_KEY)));
    setStarred(new Set(loadLS(STAR_KEY)));
    setHydrated(true);

    // Only the owner (with the PIN) reconciles with the server store.
    const pin = getPin();
    if (!pin) return;
    fetch("/api/state", { headers: { "x-settings-pin": pin } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unauthorized"))))
      .then((d) => {
        owner.current = true;
        if (Array.isArray(d?.read)) {
          setRead(new Set(d.read));
          saveLS(READ_KEY, d.read);
        }
        if (Array.isArray(d?.starred)) {
          setStarred(new Set(d.starred));
          saveLS(STAR_KEY, d.starred);
        }
      })
      .catch(() => {
        owner.current = false; // wrong PIN → stay local-only
      });
  }, []);

  const post = (body: unknown) => {
    if (!owner.current) return; // visitors don't write to the owner's store
    fetch("/api/state", {
      method: "POST",
      headers: { "content-type": "application/json", "x-settings-pin": getPin() },
      body: JSON.stringify(body),
    }).catch(() => {});
  };

  const mutate = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Set<string>>>,
      key: string,
      link: string,
      turnOn: boolean | "toggle",
      onAction: string,
      offAction: string,
    ) => {
      setter((prev) => {
        const has = prev.has(link);
        const on = turnOn === "toggle" ? !has : turnOn;
        if (on === has) return prev;
        const next = new Set(prev);
        if (on) next.add(link);
        else next.delete(link);
        saveLS(key, [...next]);
        const m = meta.get(link);
        post({ action: on ? onAction : offAction, link, topic: m?.topic, source: m?.source });
        return next;
      });
    },
    [meta],
  );

  const toggleRead = useCallback((l: string) => mutate(setRead, READ_KEY, l, "toggle", "read", "unread"), [mutate]);
  const markRead = useCallback((l: string) => mutate(setRead, READ_KEY, l, true, "read", "unread"), [mutate]);
  const toggleStar = useCallback((l: string) => mutate(setStarred, STAR_KEY, l, "toggle", "star", "unstar"), [mutate]);

  const markAllRead = useCallback(() => {
    const items = [...meta.values()];
    setRead(() => {
      const next = new Set(items.map((i) => i.link));
      saveLS(READ_KEY, [...next]);
      return next;
    });
    post({ action: "markAllRead", items });
  }, [meta]);

  return { read, starred, hydrated, toggleRead, markRead, toggleStar, markAllRead };
}

function TopicBadge({ topic }: { topic: string }) {
  const cls = TOPIC_STYLES[topic] ?? "bg-zinc-500/15 text-zinc-500";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{topic}</span>;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function ReadToggle({ isRead, onToggle }: { isRead: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isRead ? "Mark as unread" : "Mark as read"}
      title={isRead ? "Mark as unread (u)" : "Mark as read (m)"}
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${
        isRead
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-black/25 text-transparent hover:border-black/50 dark:border-white/30 dark:hover:border-white/60"
      }`}
    >
      ✓
    </button>
  );
}

function StarToggle({ isStar, onToggle }: { isStar: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isStar ? "Unsave" : "Save"}
      title={isStar ? "Unsave (s)" : "Save for later (s)"}
      className={`shrink-0 text-sm leading-none transition-colors ${
        isStar ? "text-amber-500" : "text-black/25 hover:text-amber-500 dark:text-white/30"
      }`}
    >
      {isStar ? "★" : "☆"}
    </button>
  );
}

interface RowCtx {
  isRead: boolean;
  isStar: boolean;
  isCursor: boolean;
  onToggleRead: (l: string) => void;
  onToggleStar: (l: string) => void;
  onOpen: (l: string) => void;
  register: (l: string, el: HTMLElement | null) => void;
}

const cursorRing = "rounded-lg ring-2 ring-sky-500/70 ring-offset-2 ring-offset-[var(--background)]";

function StoryRow({ story, ctx }: { story: DigestStory; ctx: RowCtx }) {
  return (
    <li
      ref={(el) => ctx.register(story.link, el)}
      className={`group flex items-start gap-2.5 border-b border-black/5 py-3 last:border-0 dark:border-white/10 ${
        ctx.isRead ? "opacity-45" : ""
      } ${ctx.isCursor ? cursorRing : ""}`}
    >
      <ReadToggle isRead={ctx.isRead} onToggle={() => ctx.onToggleRead(story.link)} />
      <a
        href={story.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => ctx.onOpen(story.link)}
        className="min-w-0 flex-1"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-medium leading-snug group-hover:underline ${ctx.isRead ? "line-through" : ""}`}>
            {story.headline}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            <StarToggle isStar={ctx.isStar} onToggle={() => ctx.onToggleStar(story.link)} />
            <TopicBadge topic={story.topic} />
          </div>
        </div>
        <p className="mt-1 text-sm text-black/70 dark:text-white/60">{story.oneLiner}</p>
        <p className="mt-1 text-xs text-black/40 dark:text-white/40">
          {story.sourceName} · {hostOf(story.link)}
        </p>
      </a>
    </li>
  );
}

function PickCard({ story, rank, ctx }: { story: DigestStory; rank: number; ctx: RowCtx }) {
  return (
    <li
      ref={(el) => ctx.register(story.link, el)}
      className={`flex items-start gap-2.5 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03] ${
        ctx.isRead ? "opacity-45" : ""
      } ${ctx.isCursor ? cursorRing : ""}`}
    >
      <ReadToggle isRead={ctx.isRead} onToggle={() => ctx.onToggleRead(story.link)} />
      <span className="mt-0.5 text-lg font-bold tabular-nums text-black/30 dark:text-white/30">{rank}</span>
      <a
        href={story.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => ctx.onOpen(story.link)}
        className="min-w-0 flex-1"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-semibold leading-snug hover:underline ${ctx.isRead ? "line-through" : ""}`}>
            {story.headline}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            <StarToggle isStar={ctx.isStar} onToggle={() => ctx.onToggleStar(story.link)} />
            <TopicBadge topic={story.topic} />
          </div>
        </div>
        <p className="mt-1 text-sm text-black/70 dark:text-white/70">{story.oneLiner}</p>
        <p className="mt-1 text-xs text-black/40 dark:text-white/40">
          {story.sourceName} · {hostOf(story.link)}
        </p>
      </a>
    </li>
  );
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.38-1.32 9.78-.66 13.5 1.62.42.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.1 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.32-1.32 11.4-1.02 15.9 1.62.54.3.72 1.02.42 1.56-.3.48-1.02.66-1.56.36z" />
    </svg>
  );
}

function PodcastRow({ ep, ctx }: { ep: PodcastEpisode; ctx: RowCtx }) {
  // Direct episode link when the Spotify API resolved one; else fall back to an
  // episode-title search so the exact episode is the top result (one tap away).
  const spotifyUrl =
    ep.spotifyUrl ??
    `https://open.spotify.com/search/${encodeURIComponent(`${ep.episodeTitle} ${ep.show}`)}/episodes`;
  return (
    <li
      ref={(el) => ctx.register(ep.link, el)}
      className={`group flex items-start gap-2.5 border-b border-black/5 py-3 last:border-0 dark:border-white/10 ${
        ctx.isRead ? "opacity-45" : ""
      } ${ctx.isCursor ? cursorRing : ""}`}
    >
      <ReadToggle isRead={ctx.isRead} onToggle={() => ctx.onToggleRead(ep.link)} />
      <a
        href={ep.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => ctx.onOpen(ep.link)}
        className="min-w-0 flex-1"
      >
        <span className="text-sm font-medium text-black/60 dark:text-white/60">{ep.show}</span>
        <h3 className={`font-medium leading-snug group-hover:underline ${ctx.isRead ? "line-through" : ""}`}>
          {ep.episodeTitle}
        </h3>
        {ep.oneLiner && <p className="mt-1 text-sm text-black/60 dark:text-white/50">{ep.oneLiner}</p>}
      </a>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <TopicBadge topic={ep.topic} />
        <div className="flex items-center gap-2">
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${ep.show} in Spotify`}
            aria-label={`Open ${ep.show} in Spotify`}
            className="flex items-center gap-1 rounded-full bg-[#1DB954]/15 px-2 py-0.5 text-xs font-medium text-[#1DB954] hover:bg-[#1DB954]/25"
          >
            <SpotifyIcon />
            Spotify
          </a>
          <StarToggle isStar={ctx.isStar} onToggle={() => ctx.onToggleStar(ep.link)} />
        </div>
      </div>
    </li>
  );
}

export function DigestView({ digest }: { digest: Digest }) {
  // Flat metadata (link -> topic/source) for state + keyboard actions.
  const meta = useMemo(() => {
    const m = new Map<string, ItemMeta>();
    for (const s of digest.topPicks) m.set(s.link, { link: s.link, topic: s.topic, source: s.sourceName });
    for (const arr of Object.values(digest.byTopic))
      for (const s of arr) m.set(s.link, { link: s.link, topic: s.topic, source: s.sourceName });
    for (const p of digest.podcasts) m.set(p.link, { link: p.link, topic: p.topic, source: p.show });
    return m;
  }, [digest]);

  const { read, starred, hydrated, toggleRead, markRead, toggleStar, markAllRead } = useReaderState(meta);

  const [hideRead, setHideRead] = useState(true);
  const [savedOnly, setSavedOnly] = useState(false);
  const [view, setView] = useState<View>("news");
  const [hiddenTopics, setHiddenTopics] = useState<Set<string>>(new Set());
  const [restocking, setRestocking] = useState(false);
  const [restockMsg, setRestockMsg] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    try {
      setHideRead(localStorage.getItem(HIDE_KEY) !== "0");
      setHiddenTopics(new Set(loadLS(HIDDEN_TOPICS_KEY)));
      if (localStorage.getItem(VIEW_KEY) === "podcasts") setView("podcasts");
    } catch {
      /* ignore */
    }
  }, []);

  const chooseView = (v: View) => {
    setView(v);
    setCursor(-1);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const setHide = (v: boolean) => {
    setHideRead(v);
    try {
      localStorage.setItem(HIDE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  const toggleTopic = (t: string) =>
    setHiddenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      saveLS(HIDDEN_TOPICS_KEY, [...next]);
      return next;
    });

  const restock = async () => {
    setRestocking(true);
    setRestockMsg(null);
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const data = await res.json();
      if (data.throttled) {
        setRestockMsg(`Just refreshed — try again in ${data.retryAfterSec}s.`);
        setRestocking(false);
        return;
      }
      if (!data.ok) throw new Error(data.error || "failed");
      window.location.reload();
    } catch {
      setRestockMsg("Restock failed — try again.");
      setRestocking(false);
    }
  };

  const allLinks = useMemo(() => [...meta.keys()], [meta]);
  const readCount = allLinks.filter((l) => read.has(l)).length;
  const starCount = starred.size;

  const show = useCallback(
    (link: string, topic: string) => {
      if (hiddenTopics.has(topic)) return false;
      if (savedOnly) return starred.has(link);
      if (hideRead && read.has(link)) return false;
      return true;
    },
    [hiddenTopics, savedOnly, hideRead, read, starred],
  );

  const topicsPresent = useMemo(() => {
    const set = new Set<string>();
    for (const m of meta.values()) set.add(m.topic);
    return [...set];
  }, [meta]);

  const newsMode = view === "news";
  const visiblePicks = newsMode ? digest.topPicks.filter((s) => show(s.link, s.topic)) : [];
  const visibleTopics = newsMode
    ? Object.entries(digest.byTopic)
        .map(([topic, stories]) => [topic, stories.filter((s) => show(s.link, s.topic))] as const)
        .filter(([, stories]) => stories.length > 0)
    : [];
  const visiblePods = !newsMode ? digest.podcasts.filter((p) => show(p.link, p.topic)) : [];

  // Ordered list of visible links for keyboard navigation.
  const visibleLinks = useMemo(() => {
    const links: string[] = [];
    visiblePicks.forEach((s) => links.push(s.link));
    visibleTopics.forEach(([, stories]) => stories.forEach((s) => links.push(s.link)));
    visiblePods.forEach((p) => links.push(p.link));
    return links;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digest, read, starred, hiddenTopics, savedOnly, hideRead, view]);

  const register = useCallback((link: string, el: HTMLElement | null) => {
    if (el) rowRefs.current.set(link, el);
    else rowRefs.current.delete(link);
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const move = (delta: number) => {
        setCursor((c) => {
          const n = Math.max(0, Math.min(visibleLinks.length - 1, (c < 0 ? -1 : c) + delta));
          const link = visibleLinks[n];
          if (link) rowRefs.current.get(link)?.scrollIntoView({ block: "center", behavior: "smooth" });
          return n;
        });
      };
      const current = () => (cursor >= 0 ? visibleLinks[cursor] : undefined);
      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault(); move(1); break;
        case "k":
        case "ArrowUp":
          e.preventDefault(); move(-1); break;
        case "o":
        case "Enter": {
          const l = current();
          if (l) { window.open(l, "_blank", "noopener"); markRead(l); }
          break;
        }
        case "m": { const l = current(); if (l) toggleRead(l); break; }
        case "u": { const l = current(); if (l) toggleRead(l); break; }
        case "s": { const l = current(); if (l) toggleStar(l); break; }
        case "?": setShowHelp((v) => !v); break;
        case "Escape": setCursor(-1); setShowHelp(false); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleLinks, cursor, markRead, toggleRead, toggleStar]);

  // Keep cursor in range as items appear/disappear.
  useEffect(() => {
    if (cursor >= visibleLinks.length) setCursor(visibleLinks.length - 1);
  }, [visibleLinks, cursor]);

  const cursorLink = cursor >= 0 ? visibleLinks[cursor] : undefined;
  const mkCtx = (link: string): RowCtx => ({
    isRead: read.has(link),
    isStar: starred.has(link),
    isCursor: link === cursorLink,
    onToggleRead: toggleRead,
    onToggleStar: toggleStar,
    onOpen: markRead,
    register,
  });

  const digestEmpty =
    !digest.topPicks.length && !Object.keys(digest.byTopic).length && !digest.podcasts.length;
  const nothingVisible = !visiblePicks.length && !visibleTopics.length && !visiblePods.length;

  const newsCount = digest.topPicks.length + Object.values(digest.byTopic).flat().length;
  const podCount = digest.podcasts.length;

  return (
    <div>
      {!digestEmpty && (
        <>
          {/* News / Podcasts view toggle */}
          <div className="mb-4 inline-flex rounded-xl border border-black/10 p-0.5 text-sm dark:border-white/15">
            <button
              type="button"
              onClick={() => chooseView("news")}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                newsMode
                  ? "bg-black/[0.06] text-black dark:bg-white/10 dark:text-white"
                  : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
              }`}
            >
              📰 News{newsCount ? ` (${newsCount})` : ""}
            </button>
            <button
              type="button"
              onClick={() => chooseView("podcasts")}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                !newsMode
                  ? "bg-black/[0.06] text-black dark:bg-white/10 dark:text-white"
                  : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
              }`}
            >
              🎧 Podcasts{podCount ? ` (${podCount})` : ""}
            </button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setHide(!hideRead)}
              className="rounded-lg border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              {hideRead ? "Show read" : "Hide read"}
            </button>
            <button
              type="button"
              onClick={() => setSavedOnly((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 ${
                savedOnly
                  ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                  : "border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              }`}
            >
              ★ Saved{starCount ? ` (${starCount})` : ""}
            </button>
            <span className="text-black/40 dark:text-white/40">
              {hydrated ? `${readCount} of ${allLinks.length} read` : `${allLinks.length} stories`}
            </span>
            {restockMsg && <span className="text-black/40 dark:text-white/40">{restockMsg}</span>}
            <div className="ml-auto flex items-center gap-3">
              <button type="button" onClick={markAllRead} className="text-black/50 hover:underline dark:text-white/50">
                Mark all read
              </button>
              <button
                type="button"
                onClick={restock}
                disabled={restocking}
                className="rounded-lg border border-black/10 px-3 py-1.5 font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
              >
                {restocking ? "Restocking…" : "↻ Restock"}
              </button>
            </div>
          </div>

          {/* Topic filters */}
          <div className="mb-6 flex flex-wrap items-center gap-1.5">
            {topicsPresent.map((t) => {
              const off = hiddenTopics.has(t);
              const cls = TOPIC_STYLES[t] ?? "bg-zinc-500/15 text-zinc-500";
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTopic(t)}
                  title={off ? `Show ${t}` : `Hide ${t}`}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                    off ? "bg-black/5 text-black/30 line-through dark:bg-white/5 dark:text-white/30" : cls
                  }`}
                >
                  {t}
                </button>
              );
            })}
            <span className="ml-1 hidden text-xs text-black/30 dark:text-white/30 sm:inline">
              · press <kbd className="rounded bg-black/10 px-1 dark:bg-white/10">?</kbd> for keys
            </span>
          </div>
        </>
      )}

      {showHelp && (
        <div className="mb-6 rounded-xl border border-black/10 bg-black/[0.02] p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-1 font-semibold">Keyboard</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-black/70 dark:text-white/70 sm:grid-cols-3">
            <span><kbd>j</kbd>/<kbd>k</kbd> move</span>
            <span><kbd>o</kbd>/<kbd>Enter</kbd> open</span>
            <span><kbd>m</kbd> read/unread</span>
            <span><kbd>s</kbd> save</span>
            <span><kbd>Esc</kbd> clear</span>
            <span><kbd>?</kbd> toggle help</span>
          </div>
        </div>
      )}

      {newsMode && digest.brief && (
        <div className="mb-8 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
            The brief
          </div>
          <p className="text-[15px] leading-relaxed text-black/80 dark:text-white/80">{digest.brief}</p>
        </div>
      )}

      {visiblePicks.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Top picks
          </h2>
          <ol className="space-y-3">
            {visiblePicks.map((s) => (
              <PickCard key={s.link} story={s} rank={digest.topPicks.indexOf(s) + 1} ctx={mkCtx(s.link)} />
            ))}
          </ol>
        </section>
      )}

      {visibleTopics.length > 0 && (
        <section className="mb-10">
          {visibleTopics.map(([topic, stories]) => (
            <div key={topic} className="mb-6">
              <div className="mb-1 flex items-center gap-2">
                <TopicBadge topic={topic} />
                <span className="text-xs text-black/40 dark:text-white/40">{stories.length}</span>
              </div>
              <ul>
                {stories.map((s) => (
                  <StoryRow key={s.link} story={s} ctx={mkCtx(s.link)} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {visiblePods.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            🎧 New podcast episodes
          </h2>
          <ul>
            {visiblePods.map((ep) => (
              <PodcastRow key={ep.link} ep={ep} ctx={mkCtx(ep.link)} />
            ))}
          </ul>
        </section>
      )}

      {digestEmpty && <p className="text-black/50 dark:text-white/50">No stories in this digest.</p>}
      {!digestEmpty && nothingVisible && (
        <p className="py-10 text-center text-black/50 dark:text-white/50">
          {savedOnly ? "No saved items yet — tap ☆ on anything to save it." : "🎉 All caught up."}
        </p>
      )}

      <footer className="mt-8 border-t border-black/10 pt-4 text-xs text-black/40 dark:border-white/10 dark:text-white/40">
        Generated {new Date(digest.generatedAt).toLocaleString()} · {digest.stats.itemsFetched} items from{" "}
        {digest.stats.feedsOk} feeds
        {digest.stats.feedsFailed > 0 && ` · ${digest.stats.feedsFailed} feed(s) unavailable`}
      </footer>
    </div>
  );
}

export function DateNav({ date, dates }: { date: string; dates: string[] }) {
  const idx = dates.indexOf(date);
  const newer = idx > 0 ? dates[idx - 1] : null;
  const older = idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : null;
  const fmt = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Snax Daily 🍿</h1>
        <p className="text-black/50 dark:text-white/50">{fmt(date)}</p>
      </div>
      <div className="flex gap-2 text-sm">
        {older ? (
          <Link
            href={`/archive/${older}`}
            className="rounded-lg border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            ← Older
          </Link>
        ) : null}
        {newer ? (
          <Link
            href={newer === dates[0] ? "/" : `/archive/${newer}`}
            className="rounded-lg border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Newer →
          </Link>
        ) : null}
        <Link
          href="/settings"
          title="Settings"
          className="rounded-lg border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          ⚙︎
        </Link>
      </div>
    </div>
  );
}
