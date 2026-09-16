import { SOURCES } from "./sources";
import { fetchAllSources, clusterConsensus } from "./fetch";
import { rankAndSummarize, type PreferenceSignal } from "./rank";
import { webSearchFill } from "./websearch";
import { saveDigest } from "./storage";
import { getState, saveState, seenBefore, type ReaderState } from "./state";
import { getSettings } from "./settings";
import type { Digest, DigestStory, FeedItem, PodcastEpisode } from "./types";

/** Today's date as YYYY-MM-DD in the given IANA timezone. */
export function todayInTz(tz = process.env.DIGEST_TZ ?? "America/New_York"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA formats as YYYY-MM-DD
}

/** Build the lightweight podcast section: newest episodes, description as one-liner. */
function buildPodcasts(podcastItems: FeedItem[], slots: number): PodcastEpisode[] {
  const sorted = [...podcastItems].sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  // At most one (newest) episode per show, then cap the whole section.
  const perShow = new Map<string, PodcastEpisode>();
  for (const it of sorted) {
    if (perShow.has(it.sourceName)) continue;
    perShow.set(it.sourceName, {
      show: it.sourceName,
      episodeTitle: it.title,
      oneLiner: it.snippet ? it.snippet.slice(0, 200) : "New episode.",
      link: it.link,
      topic: it.topic,
      publishedAt: it.publishedAt,
    });
  }
  return [...perShow.values()].slice(0, slots);
}

/** Derive a taste signal from what the reader has opened/starred. */
function preferenceSignal(state: ReaderState): PreferenceSignal {
  const tally = (entries: Record<string, { topic?: string; source?: string }>) => {
    const topics: Record<string, number> = {};
    const sources: Record<string, number> = {};
    for (const e of Object.values(entries)) {
      if (e.topic) topics[e.topic] = (topics[e.topic] ?? 0) + 1;
      if (e.source) sources[e.source] = (sources[e.source] ?? 0) + 1;
    }
    const top = (m: Record<string, number>, n: number) =>
      Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
    return { topics: top(topics, 5), sources: top(sources, 6) };
  };
  const read = tally(state.read);
  const starred = tally(state.starred);
  return {
    readTopics: read.topics,
    readSources: read.sources,
    starredTopics: starred.topics,
    starredSources: starred.sources,
  };
}

/**
 * Run the full pipeline and persist the digest for the given date.
 * Applies cross-day de-duplication (skip stories shown on earlier days) and a
 * learn-from-behavior signal, then records what was shown today.
 */
export async function generateDigest(date = todayInTz()): Promise<Digest> {
  const nowIso = new Date().toISOString();
  const settings = await getSettings();

  const [{ items, failedSources, feedsOk }, state, webItems] = await Promise.all([
    fetchAllSources({
      articleHours: settings.articleHours,
      podcastDays: settings.podcastDays,
      mutedSources: settings.mutedSources,
      blocklist: settings.blocklist,
    }),
    getState(),
    webSearchFill(nowIso, { enabled: settings.webSearch, model: settings.model }),
  ]);

  const hidden = new Set(settings.hiddenTopics);

  // Cross-day dedup + hidden-topic exclusion.
  const staleShown = seenBefore(state, date);
  const fresh = items.filter((i) => !staleShown.has(i.link) && !hidden.has(i.topic));

  // Merge web-search finds into the article pool, then re-cluster so they
  // dedupe against (and lend consensus to) the RSS items.
  const freshWeb = webItems.filter((i) => !staleShown.has(i.link) && !hidden.has(i.topic));
  const articles = clusterConsensus([
    ...fresh.filter((i) => i.type === "article"),
    ...freshWeb,
  ]);
  const podcastItems = fresh.filter((i) => i.type === "podcast");

  const [{ brief, topPicks, byTopic, itemsConsidered }, podcasts] = [
    await rankAndSummarize(articles, preferenceSignal(state), {
      model: settings.model,
      topPicks: settings.topPicks,
      maxGrouped: settings.maxGrouped,
      extraInterests: settings.extraInterests,
    }),
    buildPodcasts(podcastItems, settings.podcastSlots),
  ];

  const digest: Digest = {
    date,
    generatedAt: new Date().toISOString(),
    brief,
    topPicks,
    byTopic,
    podcasts,
    stats: {
      feedsOk,
      feedsFailed: failedSources.length,
      itemsFetched: items.length + webItems.length,
      itemsConsidered,
      failedSources,
    },
  };

  await saveDigest(digest);

  // Record everything shown today so it won't resurface on later days, and
  // prune dedup entries older than 30 days so the store can't grow unbounded.
  const shownLinks: string[] = [
    ...topPicks.map((s: DigestStory) => s.link),
    ...Object.values(byTopic).flat().map((s) => s.link),
    ...podcasts.map((p) => p.link),
  ];
  for (const link of shownLinks) state.seen[link] ??= date;
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const [link, day] of Object.entries(state.seen)) {
    if (day < cutoff) delete state.seen[link];
  }
  await saveState(state);

  return digest;
}

export const SOURCE_COUNT = SOURCES.length;
