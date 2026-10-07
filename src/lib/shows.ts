import { promises as fs } from "node:fs";
import path from "node:path";
import { KEYS, redis, useRedis } from "./redis";
import type { WatchedMark } from "./shows-watched";

// TVmaze-backed "Shows" tab: tracks Sam's TV shows and the latest/next
// episode for each, fetched live (not via the digest cron — see plans/shows-tab.md
// Decision 1). An episode is NEW until marked watched; there is no time window,
// except for the backlog baseline below.

export interface TrackedShow {
  tvmazeId: number;
  name: string;
  /** Airs ~daily (e.g. a nightly show): only the latest episode is ever shown, sorted after weeklies. */
  daily?: boolean;
}

export const SHOWS: TrackedShow[] = [
  { tvmazeId: 75026, name: "MobLand" },
  { tvmazeId: 263, name: "Last Week Tonight" },
  { tvmazeId: 44458, name: "Ted Lasso" },
  { tvmazeId: 44776, name: "Lanterns" },
  { tvmazeId: 53777, name: "Landman" },
  { tvmazeId: 75605, name: "The Studio" },
  { tvmazeId: 66198, name: "The Daily Show", daily: true },
  { tvmazeId: 59344, name: "Tulsa King" },
  { tvmazeId: 86587, name: "War" },
];

/**
 * Backlog baseline (America/New_York): episodes that aired before this date count
 * as watched for a show with no stored watched mark, so the first run isn't a wall
 * of 9 "NEW" shows (Snax's call — see plans/shows-tab.md). A stored mark always
 * takes precedence over the baseline. "Mark all watched" still exists for shows
 * added later or episodes airing after launch that Snax wants to bulk-clear.
 */
export const WATCHED_BASELINE = "2026-10-08";

export interface EpisodeInfo {
  id: number; // TVmaze episode id (watched marker)
  season: number;
  number: number | null; // null = special
  name: string;
  airdate: string; // YYYY-MM-DD, network-local
}

/** Raw TVmaze facts, cached as-is. Labels and sorting are derived at render time. */
export interface ShowInfo {
  tvmazeId: number;
  name: string;
  daily: boolean;
  service: string | null; // network.name ?? webChannel.name
  status: string; // Running | Ended | To Be Determined | In Development
  image: string | null; // image.medium (poster thumb)
  latest: EpisodeInfo | null;
  next: EpisodeInfo | null;
  latestSeasonEpisodes: number | null; // episodeOrder of latest.season (finale detection)
  announcedSeason: number | null; // later season listed with no premiereDate
  error?: string; // fetch failed and no stale copy existed
}

export interface ShowsSnapshot {
  fetchedAt: string;
  ids: number[];
  shows: ShowInfo[];
}

const SHOWS_TTL_MS = 3_600_000; // 1h soft TTL
const LOCAL = path.join(process.cwd(), ".data", "shows.json");

interface TvmazeEpisode {
  id: number;
  name: string;
  season: number;
  number: number | null;
  airdate: string;
}

interface TvmazeSeason {
  number: number;
  episodeOrder: number | null;
  premiereDate: string | null;
}

interface TvmazeShow {
  id: number;
  name: string;
  status: string;
  network: { name: string } | null;
  webChannel: { name: string } | null;
  image: { medium: string } | null;
  _embedded?: {
    previousepisode?: TvmazeEpisode;
    nextepisode?: TvmazeEpisode;
    seasons?: TvmazeSeason[];
  };
}

function toEpisodeInfo(ep: TvmazeEpisode | undefined): EpisodeInfo | null {
  if (!ep) return null;
  return { id: ep.id, season: ep.season, number: ep.number, name: ep.name, airdate: ep.airdate };
}

/** Fetch one show's facts from TVmaze. Throws on network/parse failure or 404. */
export async function fetchShow(tracked: TrackedShow): Promise<ShowInfo> {
  const url = `https://api.tvmaze.com/shows/${tracked.tvmazeId}?embed[]=previousepisode&embed[]=nextepisode&embed[]=seasons`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
    headers: { "User-Agent": "snax-daily/1.0" },
  });
  if (!res.ok) throw new Error(`TVmaze ${res.status} for show ${tracked.tvmazeId}`);
  const data = (await res.json()) as TvmazeShow;

  const seasons = data._embedded?.seasons ?? [];
  const latest = toEpisodeInfo(data._embedded?.previousepisode);
  const next = toEpisodeInfo(data._embedded?.nextepisode);

  let latestSeasonEpisodes: number | null = null;
  let announcedSeason: number | null = null;
  if (latest) {
    const latestSeason = seasons.find((s) => s.number === latest.season);
    latestSeasonEpisodes = latestSeason?.episodeOrder ?? null;
    const later = seasons.find((s) => s.number > latest.season && !s.premiereDate);
    announcedSeason = later?.number ?? null;
  }

  return {
    tvmazeId: tracked.tvmazeId,
    name: tracked.name,
    daily: !!tracked.daily,
    service: data.network?.name ?? data.webChannel?.name ?? null,
    status: data.status,
    image: data.image?.medium ?? null,
    latest,
    next,
    latestSeasonEpisodes,
    announcedSeason,
  };
}

async function readCached(): Promise<ShowsSnapshot | null> {
  if (useRedis) {
    const raw = await redis().get<ShowsSnapshot>(KEYS.shows);
    return raw ?? null;
  }
  try {
    return JSON.parse(await fs.readFile(LOCAL, "utf8")) as ShowsSnapshot;
  } catch {
    return null;
  }
}

async function writeCached(snapshot: ShowsSnapshot): Promise<void> {
  const body = JSON.stringify(snapshot);
  if (useRedis) {
    await redis().set(KEYS.shows, body);
  } else {
    await fs.mkdir(path.dirname(LOCAL), { recursive: true });
    await fs.writeFile(LOCAL, body, "utf8");
  }
}

const trackedIds = () => SHOWS.map((s) => s.tvmazeId);
const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Returns the current shows snapshot: the cached copy if it's fresh and still
 * matches the SHOWS list, otherwise a fresh fetch (falling back per-show to the
 * old snapshot, or an error stub, on failure). Never throws: TVmaze outages
 * degrade to stale data, and total failure degrades to `snapshot: null`.
 */
export async function getShows(): Promise<{ snapshot: ShowsSnapshot | null; stale: boolean }> {
  const cached = await readCached();
  const ids = trackedIds();
  const fresh = cached && sameIds(cached.ids, ids) && Date.now() - Date.parse(cached.fetchedAt) < SHOWS_TTL_MS;
  if (fresh) return { snapshot: cached, stale: false };

  const prevById = new Map((cached?.shows ?? []).map((s) => [s.tvmazeId, s]));
  const results = await Promise.allSettled(SHOWS.map((s) => fetchShow(s)));

  let anyOk = false;
  const shows: ShowInfo[] = results.map((r, i) => {
    const tracked = SHOWS[i];
    if (r.status === "fulfilled") {
      anyOk = true;
      return r.value;
    }
    console.error(`[shows] fetch failed for ${tracked.name} (${tracked.tvmazeId}):`, r.reason);
    const prev = prevById.get(tracked.tvmazeId);
    if (prev) return prev;
    return {
      tvmazeId: tracked.tvmazeId,
      name: tracked.name,
      daily: !!tracked.daily,
      service: null,
      status: "Unknown",
      image: null,
      latest: null,
      next: null,
      latestSeasonEpisodes: null,
      announcedSeason: null,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  if (!anyOk && cached) {
    // Total outage: keep serving the stale snapshot, don't overwrite it.
    return { snapshot: cached, stale: true };
  }

  const snapshot: ShowsSnapshot = { fetchedAt: new Date().toISOString(), ids, shows };
  try {
    await writeCached(snapshot);
  } catch (err) {
    console.error("[shows] failed to cache snapshot:", err);
  }
  return { snapshot, stale: !anyOk };
}

/**
 * Whether `latest` should show the NEW badge, given this show's watched mark (if
 * any) and the backlog baseline. A mark always takes precedence: once Snax has
 * marked a show, the baseline no longer matters for it.
 */
export function isUnwatched(latest: EpisodeInfo | null, mark: WatchedMark | undefined): boolean {
  if (!latest) return false;
  if (mark) return !(latest.id === mark.episodeId || latest.airdate < mark.airdate);
  return latest.airdate >= WATCHED_BASELINE;
}

export interface ShowDisplay {
  unwatched: boolean;
  group: number;
  latestLabel: string;
  statusLabel: string;
}

function episodeLabel(ep: EpisodeInfo): string {
  return ep.number === null ? `S${ep.season} Special` : `S${ep.season}E${ep.number}`;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(airdate: string, today: string): number {
  const a = Date.parse(`${airdate}T00:00:00`);
  const t = Date.parse(`${today}T00:00:00`);
  return Math.round((a - t) / 86_400_000);
}

function relativeSuffix(airdate: string, today: string): string {
  const d = daysUntil(airdate, today);
  if (d === 0) return " · tonight";
  if (d === 1) return " · tomorrow";
  if (d > 1 && d <= 7) return ` · in ${d} days`;
  return "";
}

/** Derived display info for one show, computed fresh on every render. */
export function describeShow(info: ShowInfo, mark: WatchedMark | undefined, today: string): ShowDisplay {
  const unwatched = isUnwatched(info.latest, mark);

  let latestLabel: string;
  if (!info.latest) {
    latestLabel = "Not aired yet";
  } else {
    const parts = [episodeLabel(info.latest), info.latest.name, fmtDate(info.latest.airdate)].filter(Boolean);
    const agedDays = daysUntil(info.latest.airdate, today) * -1;
    latestLabel =
      agedDays > 60
        ? `Last aired ${new Date(`${info.latest.airdate}T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
        : parts.join(" · ");
  }

  let statusLabel: string;
  if (info.next) {
    if (info.next.number === 1) {
      statusLabel = `Season ${info.next.season} premieres ${fmtDate(info.next.airdate)}${relativeSuffix(info.next.airdate, today)}`;
    } else {
      statusLabel = `Next: ${episodeLabel(info.next)} · ${fmtDate(info.next.airdate)}${relativeSuffix(info.next.airdate, today)}`;
    }
  } else if (info.status === "Ended") {
    statusLabel = "Series ended";
  } else if (info.announcedSeason) {
    statusLabel = `Season ${info.announcedSeason} announced · no date yet`;
  } else if (info.latest && info.latest.number !== null && info.latest.number === info.latestSeasonEpisodes) {
    statusLabel = `Season ${info.latest.season} finale aired · no return date`;
    if (info.status === "To Be Determined") statusLabel += " · renewal TBD";
  } else {
    statusLabel = "Next episode not scheduled yet";
  }

  // Sort groups:
  //   0 unwatched, non-daily   1 unwatched, daily
  //   2 watched, next scheduled  3 watched, no next date
  //   4 ended   5 errored
  let group: number;
  if (info.error) group = 5;
  else if (unwatched) group = info.daily ? 1 : 0;
  else if (info.next) group = 2;
  else if (info.status === "Ended") group = 4;
  else group = 3;

  return { unwatched, group, latestLabel, statusLabel };
}

/** Sort shows for display. Computed once at render time (see plan: no re-sort on tap). */
export function sortShows(
  shows: ShowInfo[],
  marks: Record<number, WatchedMark>,
  today: string,
): { info: ShowInfo; display: ShowDisplay }[] {
  const rows = shows.map((info) => ({ info, display: describeShow(info, marks[info.tvmazeId], today) }));
  return rows.sort((a, b) => {
    if (a.display.group !== b.display.group) return a.display.group - b.display.group;
    switch (a.display.group) {
      case 0:
        return (b.info.latest?.airdate ?? "").localeCompare(a.info.latest?.airdate ?? "");
      case 2:
        return (a.info.next?.airdate ?? "").localeCompare(b.info.next?.airdate ?? "");
      case 3:
        return (b.info.latest?.airdate ?? "").localeCompare(a.info.latest?.airdate ?? "");
      default:
        return a.info.name.localeCompare(b.info.name);
    }
  });
}
