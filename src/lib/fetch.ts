import Parser from "rss-parser";
import { SOURCES, type Source } from "./sources";
import { isExcluded } from "./filters";
import type { Topic } from "./sources";
import type { FeedItem } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) daily-digest/1.0";

const parser = new Parser({
  timeout: 15000,
  maxRedirects: 5,
  headers: {
    "User-Agent": UA,
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
});

// No single source may contribute more than this many items — keeps high-volume
// feeds (Reddit, HF papers, CoinDesk) from crowding out curated sources.
const PER_SOURCE_CAP = 15;

// Subreddit -> topic for the combined Reddit feed.
const REDDIT_TOPIC: Record<string, Topic> = {
  localllama: "AI",
  machinelearning: "AI",
  singularity: "AI",
  nuclear: "Nuclear",
  space: "Space",
  biotechnology: "Biotech",
  quantumcomputing: "Quantum",
};

/** Strip HTML tags and collapse whitespace from a feed snippet. */
function clean(text: string | undefined, max = 400): string {
  if (!text) return "";
  const stripped = text
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > max ? stripped.slice(0, max) + "…" : stripped;
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** hnrss embeds "Points: N" and "# Comments: N" in the item body. */
function parseHnSignal(content: string | undefined): FeedItem["hn"] | undefined {
  if (!content) return undefined;
  const pts = content.match(/Points:\s*(\d+)/i);
  const cm = content.match(/Comments:\s*(\d+)/i);
  if (!pts && !cm) return undefined;
  return { points: pts ? Number(pts[1]) : 0, comments: cm ? Number(cm[1]) : 0 };
}

export interface FetchResult {
  items: FeedItem[];
  failedSources: string[];
  feedsOk: number;
}

/** Hugging Face Daily Papers — curated frontier ML papers (JSON API). */
async function fetchHfPapers(source: Source, sinceMs: number): Promise<FeedItem[]> {
  const res = await fetch(source.url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Array<{
    paper?: { id?: string; title?: string; summary?: string };
    title?: string;
    summary?: string;
    publishedAt?: string;
  }>;
  const items: FeedItem[] = [];
  for (const d of data ?? []) {
    const id = d.paper?.id;
    const title = (d.paper?.title ?? d.title)?.trim();
    if (!id || !title) continue;
    const publishedAt = parseDate(d.publishedAt);
    if (publishedAt && Date.parse(publishedAt) < sinceMs) continue;
    items.push({
      title,
      link: `https://huggingface.co/papers/${id}`,
      snippet: clean(d.paper?.summary ?? d.summary, 300),
      publishedAt,
      sourceName: source.name,
      sourceHomepage: source.homepage,
      topic: source.topic,
      type: "article",
    });
  }
  return items;
}

async function fetchSource(
  source: Source,
  sinceMsByType: Record<Source["type"], number>,
): Promise<FeedItem[]> {
  const sinceMs = sinceMsByType[source.type];

  if (source.kind === "hfpapers") {
    // Curated papers stay relevant longer than breaking news.
    const papersSince = Date.now() - 21 * 24 * 60 * 60 * 1000;
    return fetchHfPapers(source, papersSince).then((i) => i.slice(0, PER_SOURCE_CAP));
  }

  const feed = await parser.parseURL(source.url);
  const items: FeedItem[] = [];
  const isHN = source.name.startsWith("Hacker News");
  const isReddit = source.kind === "reddit";

  for (const entry of feed.items ?? []) {
    const link = entry.link?.trim();
    const title = entry.title?.trim();
    if (!link || !title) continue;

    const publishedAt = parseDate(entry.isoDate ?? entry.pubDate);
    if (publishedAt && Date.parse(publishedAt) < sinceMs) continue;

    // Reddit: remap topic from the item's subreddit.
    let topic = source.topic;
    if (isReddit) {
      const sub = link.match(/reddit\.com\/r\/([^/]+)/i)?.[1]?.toLowerCase();
      topic = (sub && REDDIT_TOPIC[sub]) || source.topic;
    }

    items.push({
      title,
      link,
      snippet: clean(entry.contentSnippet ?? entry.content ?? entry.summary),
      publishedAt,
      sourceName: source.name,
      sourceHomepage: source.homepage,
      topic,
      type: source.type,
      hn: isHN ? parseHnSignal(entry.content ?? entry.contentSnippet) : undefined,
    });
    if (items.length >= PER_SOURCE_CAP) break;
  }
  return items;
}

export interface FetchOptions {
  articleHours?: number;
  podcastDays?: number;
  /** Source names to skip. */
  mutedSources?: string[];
  /** Extra terms to exclude (beyond the built-in car filter). */
  blocklist?: string[];
}

/**
 * Fetch every configured source concurrently. Dead/blocked feeds are skipped
 * and reported rather than aborting the whole run.
 */
export async function fetchAllSources(opts: FetchOptions = {}): Promise<FetchResult> {
  const articleHours = opts.articleHours ?? 48;
  const podcastHours = (opts.podcastDays ?? 7) * 24;
  const muted = new Set(opts.mutedSources ?? []);
  const active = SOURCES.filter((s) => !muted.has(s.name));

  const now = Date.now();
  const sinceMsByType: Record<Source["type"], number> = {
    article: now - articleHours * 60 * 60 * 1000,
    podcast: now - podcastHours * 60 * 60 * 1000,
  };
  const failedSources: string[] = [];
  let feedsOk = 0;

  const settled = await Promise.allSettled(active.map((s) => fetchSource(s, sinceMsByType)));

  const items: FeedItem[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      feedsOk++;
      items.push(...result.value);
    } else {
      failedSources.push(active[i].name);
      console.warn(`[fetch] ${active[i].name} failed:`, result.reason?.message ?? result.reason);
    }
  });

  const blockRe = buildBlockRegex(opts.blocklist);

  // Drop excluded categories (car news + user blocklist). Podcasts are exempt —
  // an excluded word in a long episode blurb shouldn't hide a whole episode.
  const filtered = items.filter((it) => {
    if (it.type === "podcast") return true;
    const text = `${it.title} ${it.snippet}`;
    if (isExcluded(text)) return false;
    if (blockRe && blockRe.test(text)) return false;
    return true;
  });

  return { items: clusterConsensus(filtered), failedSources, feedsOk };
}

function buildBlockRegex(terms?: string[]): RegExp | null {
  const clean = (terms ?? []).map((t) => t.trim()).filter(Boolean);
  if (!clean.length) return null;
  const esc = clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${esc.join("|")})\\b`, "i");
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "over", "after",
  "your", "have", "will", "what", "when", "just", "about", "than", "they",
  "their", "says", "say", "new", "how", "why", "its", "are", "was", "not",
]);

/** Significant lowercase tokens (len ≥ 4, non-stopword) from a title. */
function sigTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
  );
}

function similar(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  if (shared >= 4) return true;
  const min = Math.min(a.size, b.size) || 1;
  return shared >= 3 && shared / min >= 0.6;
}

/**
 * Collapse near-duplicate stories (same story across outlets) into one, and
 * annotate each survivor with how many distinct sources covered it — a
 * consensus/importance signal for the ranker. Podcasts are left untouched.
 */
export function clusterConsensus(items: FeedItem[]): FeedItem[] {
  const pods = items.filter((i) => i.type === "podcast");
  const arts = items.filter((i) => i.type === "article");

  const reps: FeedItem[] = [];
  const tokens: Set<string>[] = [];
  const sources: Set<string>[] = [];

  for (const item of arts) {
    const toks = sigTokens(item.title);
    if (toks.size === 0) {
      reps.push(item);
      tokens.push(toks);
      sources.push(new Set([item.sourceName]));
      continue;
    }
    let merged = false;
    for (let i = 0; i < reps.length; i++) {
      if (reps[i].topic === item.topic && similar(toks, tokens[i])) {
        sources[i].add(item.sourceName);
        // keep the entry with the richer snippet as representative
        if (item.snippet.length > reps[i].snippet.length) {
          const keepSources = sources[i];
          reps[i] = item;
          tokens[i] = toks;
          sources[i] = keepSources;
        }
        merged = true;
        break;
      }
    }
    if (!merged) {
      reps.push(item);
      tokens.push(toks);
      sources.push(new Set([item.sourceName]));
    }
  }

  const deduped = reps.map((r, i) => ({
    ...r,
    coverage: sources[i].size,
    alsoSources: [...sources[i]].filter((s) => s !== r.sourceName),
  }));

  return [...deduped, ...pods];
}
