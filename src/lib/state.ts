import { promises as fs } from "node:fs";
import path from "node:path";

// Server-side reader state — shared across devices/browsers. Small JSON blob.
//   read/starred: link -> { ts, topic, source }
//   seen:         link -> YYYY-MM-DD it was first shown (for cross-day dedup)

export interface StateEntry {
  ts: string;
  topic?: string;
  source?: string;
}

export interface ReaderState {
  read: Record<string, StateEntry>;
  starred: Record<string, StateEntry>;
  seen: Record<string, string>;
}

const EMPTY: ReaderState = { read: {}, starred: {}, seen: {} };

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_KEY = "state/reader.json";
const LOCAL = path.join(process.cwd(), ".data", "reader-state.json");

function normalize(raw: Partial<ReaderState> | null): ReaderState {
  return {
    read: raw?.read ?? {},
    starred: raw?.starred ?? {},
    seen: raw?.seen ?? {},
  };
}

export async function getState(): Promise<ReaderState> {
  if (useBlob) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_KEY });
    const match = blobs.find((b) => b.pathname === BLOB_KEY);
    if (!match) return { ...EMPTY };
    const res = await fetch(`${match.url}?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { ...EMPTY };
    return normalize(await res.json());
  }
  try {
    return normalize(JSON.parse(await fs.readFile(LOCAL, "utf8")));
  } catch {
    return { ...EMPTY };
  }
}

export async function saveState(state: ReaderState): Promise<void> {
  const body = JSON.stringify(state);
  if (useBlob) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_KEY, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0, // mutable — never cache at the edge
    });
  } else {
    await fs.mkdir(path.dirname(LOCAL), { recursive: true });
    await fs.writeFile(LOCAL, body, "utf8");
  }
}

export type StateAction =
  | { action: "read" | "unread" | "star" | "unstar"; link: string; topic?: string; source?: string }
  | { action: "markAllRead"; items: { link: string; topic?: string; source?: string }[] }
  | { action: "resetRead" };

/** Apply a mutation and persist. Returns the updated state. */
export async function applyAction(a: StateAction, now: string): Promise<ReaderState> {
  const s = await getState();
  switch (a.action) {
    case "read":
      s.read[a.link] = { ts: now, topic: a.topic, source: a.source };
      break;
    case "unread":
      delete s.read[a.link];
      break;
    case "star":
      s.starred[a.link] = { ts: now, topic: a.topic, source: a.source };
      break;
    case "unstar":
      delete s.starred[a.link];
      break;
    case "markAllRead":
      for (const it of a.items) s.read[it.link] = { ts: now, topic: it.topic, source: it.source };
      break;
    case "resetRead":
      s.read = {};
      break;
  }
  await saveState(s);
  return s;
}

/** Links shown on a day strictly before `today` (YYYY-MM-DD). */
export function seenBefore(state: ReaderState, today: string): Set<string> {
  const out = new Set<string>();
  for (const [link, day] of Object.entries(state.seen)) {
    if (day < today) out.add(link);
  }
  return out;
}
