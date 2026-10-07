import { promises as fs } from "node:fs";
import path from "node:path";
import { KEYS, redis, useRedis } from "./redis";
import { SHOWS } from "./shows";

// Watched state for the Shows tab: "watched up to" per show, one mark pointing
// at the latest episode Snax marked. See plans/shows-tab.md "Watched state" for
// the model, and "backlog starts as watched" for how a show with NO mark yet is
// treated (src/lib/shows.ts WATCHED_BASELINE / isUnwatched).

export interface WatchedMark {
  episodeId: number;
  airdate: string; // YYYY-MM-DD
  label: string; // e.g. "S2E3"
  ts: string; // when this mark was set
  prev?: Omit<WatchedMark, "prev" | "ts">; // one-level undo
}

export type WatchedMap = Record<number, WatchedMark>; // tvmazeId -> mark

const LOCAL = path.join(process.cwd(), ".data", "shows-watched.json");
const AIRDATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const trackedIds = new Set(SHOWS.map((s) => s.tvmazeId));

/** Thrown for bad input (→ 400), as opposed to storage failures (→ 500). */
export class ValidationError extends Error {}

export async function getWatched(): Promise<WatchedMap> {
  if (useRedis) {
    const raw = await redis().hgetall<Record<string, WatchedMark>>(KEYS.showsWatched);
    return raw ? normalize(raw) : {};
  }
  try {
    return normalize(JSON.parse(await fs.readFile(LOCAL, "utf8")));
  } catch {
    return {};
  }
}

function normalize(raw: Record<string, WatchedMark>): WatchedMap {
  const out: WatchedMap = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);
    if (Number.isFinite(id) && v) out[id] = v;
  }
  return out;
}

async function setMark(tvmazeId: number, mark: WatchedMark): Promise<void> {
  if (useRedis) {
    await redis().hset(KEYS.showsWatched, { [tvmazeId]: mark });
    return;
  }
  const all = await getWatched();
  all[tvmazeId] = mark;
  await writeLocal(all);
}

async function deleteMark(tvmazeId: number): Promise<void> {
  if (useRedis) {
    await redis().hdel(KEYS.showsWatched, String(tvmazeId));
    return;
  }
  const all = await getWatched();
  delete all[tvmazeId];
  await writeLocal(all);
}

async function writeLocal(all: WatchedMap): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL), { recursive: true });
  await fs.writeFile(LOCAL, JSON.stringify(all, null, 2), "utf8");
}

interface EpisodeRef {
  id: number;
  airdate: string;
  label: string;
}

export type WatchedAction =
  | { action: "watch"; tvmazeId: number; episode: EpisodeRef }
  | { action: "unwatch"; tvmazeId: number }
  | { action: "watchAll"; items: { tvmazeId: number; episode: EpisodeRef }[] };

function validateEpisode(ep: unknown): EpisodeRef {
  if (!ep || typeof ep !== "object") throw new ValidationError("missing episode");
  const { id, airdate, label } = ep as Record<string, unknown>;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) throw new ValidationError("invalid episode.id");
  if (typeof airdate !== "string" || !AIRDATE_RE.test(airdate)) throw new ValidationError("invalid episode.airdate");
  if (typeof label !== "string" || label.length > 20) throw new ValidationError("invalid episode.label");
  return { id, airdate, label };
}

function validateTvmazeId(id: unknown): number {
  if (typeof id !== "number" || !trackedIds.has(id)) throw new ValidationError("unknown tvmazeId");
  return id;
}

/** Apply a watched mutation and persist. Throws on invalid input. Returns the updated map. */
export async function applyWatchedAction(a: WatchedAction, now: string): Promise<WatchedMap> {
  switch (a.action) {
    case "watch": {
      const tvmazeId = validateTvmazeId(a.tvmazeId);
      const episode = validateEpisode(a.episode);
      const existing = (await getWatched())[tvmazeId];
      const prev = existing ? { episodeId: existing.episodeId, airdate: existing.airdate, label: existing.label } : undefined;
      await setMark(tvmazeId, { episodeId: episode.id, airdate: episode.airdate, label: episode.label, ts: now, prev });
      break;
    }
    case "unwatch": {
      const tvmazeId = validateTvmazeId(a.tvmazeId);
      const existing = (await getWatched())[tvmazeId];
      if (existing?.prev) {
        await setMark(tvmazeId, { ...existing.prev, ts: now });
      } else {
        await deleteMark(tvmazeId);
      }
      break;
    }
    case "watchAll": {
      if (!Array.isArray(a.items)) throw new ValidationError("invalid items");
      for (const item of a.items) {
        const tvmazeId = validateTvmazeId(item.tvmazeId);
        const episode = validateEpisode(item.episode);
        const existing = (await getWatched())[tvmazeId];
        const prev = existing ? { episodeId: existing.episodeId, airdate: existing.airdate, label: existing.label } : undefined;
        await setMark(tvmazeId, { episodeId: episode.id, airdate: episode.airdate, label: episode.label, ts: now, prev });
      }
      break;
    }
    default:
      throw new ValidationError("unknown action");
  }
  return getWatched();
}
