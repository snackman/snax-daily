// Resolve the EXACT Spotify episode for each podcast episode in the digest, via
// the Spotify Web API (client-credentials). We prefer the episode's own
// external_urls.spotify rather than constructing URLs by hand, and match by
// title + publication date (never "just the latest", since Spotify ingestion
// can lag). Resolved ids/urls are saved with the digest so we don't re-resolve
// on every page load.
//
// Requires SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET, and (per Spotify's current
// policy) an active Premium subscription on the owner account — otherwise the
// API returns 403 and every function here returns null (links stay hidden).

export interface EpisodeMatch {
  id: string;
  url: string;
}

export interface EpisodeQuery {
  show: string;
  episodeTitle: string;
  /** ISO publish date from the RSS feed, used to match the right episode. */
  publishedAt: string | null;
  /** Optional Spotify show id — if known, we list its episodes and match. */
  spotifyShowId?: string;
}

interface SpotifyEpisode {
  id?: string;
  name?: string;
  release_date?: string;
  external_urls?: { spotify?: string };
}

const API = "https://api.spotify.com/v1";
let tokenCache: { token: string; exp: number } | null = null;

export function spotifyEnabled(): boolean {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function getToken(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (tokenCache && tokenCache.exp > Date.now()) return tokenCache.token;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    tokenCache = { token: j.access_token, exp: Date.now() + ((j.expires_in ?? 3600) - 60) * 1000 };
    return j.access_token;
  } catch {
    return null;
  }
}

async function api<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null; // 403 (no Premium), 404, rate-limit, etc.
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Token-overlap similarity between two titles (0–1). */
function titleSim(a: string, b: string): number {
  const at = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const bt = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (!at.size || !bt.size) return 0;
  let shared = 0;
  for (const t of at) if (bt.has(t)) shared++;
  return shared / Math.min(at.size, bt.size);
}

function daysApart(a: string | null, b?: string): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.abs(ta - tb) / (24 * 60 * 60 * 1000);
}

/**
 * Pick the best-matching episode from candidates using title similarity and
 * publish-date proximity. Requires a genuine match so we never link the wrong
 * (or merely latest) episode.
 */
function pickBest(candidates: SpotifyEpisode[], q: EpisodeQuery): EpisodeMatch | null {
  let best: { ep: SpotifyEpisode; score: number } | null = null;
  for (const ep of candidates) {
    if (!ep?.id || !ep.external_urls?.spotify) continue;
    const sim = titleSim(q.episodeTitle, ep.name ?? "");
    const dd = daysApart(q.publishedAt, ep.release_date);
    // Date must be close when we know it (guards against wrong/older episodes).
    if (dd !== null && dd > 4) continue;
    // Score favors title match; a close date is a tie-breaker bonus.
    const score = sim + (dd !== null ? Math.max(0, 0.2 - dd * 0.05) : 0);
    // Require a real title match (looser when the date lines up exactly).
    const threshold = dd !== null && dd <= 1 ? 0.45 : 0.6;
    if (sim < threshold) continue;
    if (!best || score > best.score) best = { ep, score };
  }
  if (!best) return null;
  return { id: best.ep.id!, url: best.ep.external_urls!.spotify! };
}

/** Resolve a single episode to its exact Spotify id + url, or null. */
export async function resolveEpisode(q: EpisodeQuery): Promise<EpisodeMatch | null> {
  const token = await getToken();
  if (!token) return null;

  // Preferred: if we know the show, list its recent episodes and match.
  if (q.spotifyShowId) {
    const data = await api<{ items?: SpotifyEpisode[] }>(
      `/shows/${q.spotifyShowId}/episodes?limit=20&market=US`,
      token,
    );
    const match = pickBest(data?.items ?? [], q);
    if (match) return match;
  }

  // Fallback: search Spotify's episode catalog by title + show.
  const query = encodeURIComponent(`${q.episodeTitle} ${q.show}`.slice(0, 100));
  const data = await api<{ episodes?: { items?: SpotifyEpisode[] } }>(
    `/search?q=${query}&type=episode&limit=10&market=US`,
    token,
  );
  return pickBest(data?.episodes?.items ?? [], q);
}

/** Resolve a batch of episodes (best-effort; [] of nulls without creds/Premium). */
export async function resolveSpotifyLinks(queries: EpisodeQuery[]): Promise<(EpisodeMatch | null)[]> {
  if (!spotifyEnabled()) return queries.map(() => null);
  return Promise.all(queries.map((q) => resolveEpisode(q)));
}
