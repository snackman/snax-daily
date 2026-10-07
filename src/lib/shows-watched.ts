import { promises as fs } from "node:fs";
import path from "node:path";
import { KEYS, redis, useRedis } from "./redis";
import { SHOWS } from "./shows";

// Watched state for the Shows tab: "watched up to" per show, one mark pointing
// at the latest episode Snax marked. See plans/shows-tab.md "Watched state" for
// the model, and "backlog starts as watched" for how a show with NO mark yet is
// treated (src/lib/shows.ts WATCHED_BASELINE / isUnwatched).

export interface WatchedMark {
  /** Present for a normal "watched up to this episode" mark. */
  episodeId?: number;
  airdate?: string; // YYYY-MM-DD
  label?: string; // e.g. "S2E3"
  /**
   * True = explicitly NOT watched, overriding WATCHED_BASELINE regardless of
   * episode data. Written by `unwatch` when there's no prior mark to restore
   * (e.g. Undo on a show that's only "watched" because of the baseline) — without
   * this, deleting the field would just fall back to the baseline and could
   * silently re-hide the NEW badge on the next load instead of honoring the undo.
   */
  unwatched?: boolean;
  ts: string; // when this mark was set
  prev?: Omit<WatchedMark, "prev" | "ts">; // one-level undo
}

export type WatchedMap = Record<number, WatchedMark>; // tvmazeId -> mark

const LOCAL = path.join(process.cwd(), ".data", "shows-watched.json");
const AIRDATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const trackedIds = new Set(SHOWS.map((s) => s.tvmazeId));

/** Thrown for bad input (→ 400), as opposed to storage failures (→ 500). */
export class ValidationError extends Error {}

/** Reads the watched map. A Redis outage degrades to "no marks" rather than crashing /shows. */
export async function getWatched(): Promise<WatchedMap> {
  if (useRedis) {
    try {
      const raw = await redis().hgetall<Record<string, WatchedMark>>(KEYS.showsWatched);
      return raw ? normalize(raw) : {};
    } catch (err) {
      console.error("[shows-watched] Redis read failed, treating as no marks:", err);
      return {};
    }
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

/** Previous-state snapshot for a mark's one-level undo (drops `prev`/`ts`, keeps everything else). */
function toPrev(mark: WatchedMark | undefined): WatchedMark["prev"] {
  if (!mark) return undefined;
  const { prev, ts, ...rest } = mark;
  return rest;
}

async function setMark(tvmazeId: number, mark: WatchedMark): Promise<void> {
  return setMarks({ [tvmazeId]: mark });
}

/** Writes several marks in one atomic HSET (used by watchAll so rows can't race each other). */
async function setMarks(entries: WatchedMap): Promise<void> {
  const ids = Object.keys(entries);
  if (!ids.length) return;
  if (useRedis) {
    await redis().hset(KEYS.showsWatched, entries as unknown as Record<string, WatchedMark>);
    return;
  }
  const all = await getWatched();
  Object.assign(all, entries);
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

/** Narrows + validates the top-level action shape. Throws ValidationError (→ 400) on anything malformed, including `null`. */
function validateAction(raw: unknown): WatchedAction {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ValidationError("missing action");
  const action = (raw as { action?: unknown }).action;
  if (action !== "watch" && action !== "unwatch" && action !== "watchAll") {
    throw new ValidationError("unknown action");
  }
  return raw as WatchedAction;
}

/** Apply a watched mutation and persist. Throws ValidationError on invalid input. Returns the updated map. */
export async function applyWatchedAction(raw: unknown, now: string): Promise<WatchedMap> {
  const a = validateAction(raw);
  switch (a.action) {
    case "watch": {
      const tvmazeId = validateTvmazeId(a.tvmazeId);
      const episode = validateEpisode(a.episode);
      const existing = (await getWatched())[tvmazeId];
      const prev = toPrev(existing);
      await setMark(tvmazeId, { episodeId: episode.id, airdate: episode.airdate, label: episode.label, ts: now, prev });
      break;
    }
    case "unwatch": {
      const tvmazeId = validateTvmazeId(a.tvmazeId);
      const existing = (await getWatched())[tvmazeId];
      if (existing?.prev) {
        await setMark(tvmazeId, { ...existing.prev, ts: now });
      } else {
        // No prior mark to restore. Writing an explicit "unwatched" mark (rather than
        // deleting the field) makes the NEW badge persist across a reload even when
        // WATCHED_BASELINE would otherwise have called this episode already-watched.
        await setMark(tvmazeId, { unwatched: true, ts: now });
      }
      break;
    }
    case "watchAll": {
      if (!a.items || !Array.isArray(a.items)) throw new ValidationError("invalid items");
      // Validate everything before writing anything, then write all fields in one
      // atomic HSET so a tap on an individual row mid-flight can't race this.
      const validated = a.items.map((item) => ({
        tvmazeId: validateTvmazeId(item?.tvmazeId),
        episode: validateEpisode(item?.episode),
      }));
      const current = await getWatched();
      const toWrite: WatchedMap = {};
      for (const { tvmazeId, episode } of validated) {
        toWrite[tvmazeId] = {
          episodeId: episode.id,
          airdate: episode.airdate,
          label: episode.label,
          ts: now,
          prev: toPrev(current[tvmazeId]),
        };
      }
      await setMarks(toWrite);
      break;
    }
  }
  return getWatched();
}
