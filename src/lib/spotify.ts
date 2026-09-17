// Resolve direct Spotify EPISODE links via the Spotify Web API (client
// credentials flow). Needs SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET.
// Best-effort: every function returns null on any failure so the digest still
// generates (the UI falls back to a show-search link).

interface PodcastRef {
  show: string;
  episodeTitle: string;
}

let tokenCache: { token: string; exp: number } | null = null;

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

export function spotifyEnabled(): boolean {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Token overlap ratio between two strings (0–1). */
function similarity(a: string, b: string): number {
  const at = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const bt = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (!at.size || !bt.size) return 0;
  let shared = 0;
  for (const t of at) if (bt.has(t)) shared++;
  return shared / Math.min(at.size, bt.size);
}

/** Find the direct Spotify URL for a specific episode, or null. */
export async function findSpotifyEpisode(show: string, episodeTitle: string): Promise<string | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const q = encodeURIComponent(`${episodeTitle} ${show}`.slice(0, 100));
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=episode&limit=5&market=US`,
      { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      episodes?: { items?: Array<{ name?: string; external_urls?: { spotify?: string } } | null> };
    };
    const items = (j.episodes?.items ?? []).filter(Boolean) as Array<{
      name?: string;
      external_urls?: { spotify?: string };
    }>;
    if (!items.length) return null;
    // Prefer the item whose title best matches; require a reasonable match.
    let best = items[0];
    let bestScore = similarity(episodeTitle, best.name ?? "");
    for (const it of items.slice(1)) {
      const sc = similarity(episodeTitle, it.name ?? "");
      if (sc > bestScore) {
        best = it;
        bestScore = sc;
      }
    }
    if (bestScore < 0.4) return null; // too weak a match — fall back to search
    return best.external_urls?.spotify ?? null;
  } catch {
    return null;
  }
}

/** Resolve Spotify episode URLs for a batch of episodes (best-effort). */
export async function resolveSpotifyLinks(episodes: PodcastRef[]): Promise<(string | null)[]> {
  if (!spotifyEnabled()) return episodes.map(() => null);
  return Promise.all(episodes.map((e) => findSpotifyEpisode(e.show, e.episodeTitle)));
}
