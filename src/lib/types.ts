import type { Topic, SourceType } from "./sources";

/** A raw item pulled from a feed, normalized across RSS/Atom shapes. */
export interface FeedItem {
  title: string;
  link: string;
  /** Plain-text snippet from the feed (may be empty). */
  snippet: string;
  /** ISO date string, or null if the feed omitted it. */
  publishedAt: string | null;
  sourceName: string;
  sourceHomepage: string;
  topic: Topic;
  type: SourceType;
  /** Hacker News popularity, when the item comes from HN. */
  hn?: { points: number; comments: number };
  /** How many distinct sources covered this story (consensus signal). */
  coverage?: number;
  /** Other sources that also covered it (excludes the primary). */
  alsoSources?: string[];
}

/** A single curated story after Claude ranking + summarization. */
export interface DigestStory {
  headline: string;
  /** One-sentence "why it matters". */
  oneLiner: string;
  link: string;
  sourceName: string;
  topic: Topic;
}

/** A new podcast episode surfaced in the lightweight podcast section. */
export interface PodcastEpisode {
  show: string;
  episodeTitle: string;
  oneLiner: string;
  link: string;
  topic: Topic;
  publishedAt: string | null;
}

/** The full curated digest for a single day. */
export interface Digest {
  /** Digest date, YYYY-MM-DD (the day it represents). */
  date: string;
  /** ISO timestamp of when it was generated. */
  generatedAt: string;
  /** 2-3 sentence editor's synthesis of the day (optional). */
  brief?: string;
  /** The day's most important stories, already ranked. */
  topPicks: DigestStory[];
  /** Remaining stories grouped by topic. */
  byTopic: Record<string, DigestStory[]>;
  /** New podcast episodes (lightweight, not summarized from audio). */
  podcasts: PodcastEpisode[];
  /** Diagnostics for the run. */
  stats: {
    feedsOk: number;
    feedsFailed: number;
    itemsFetched: number;
    itemsConsidered: number;
    failedSources: string[];
  };
}
