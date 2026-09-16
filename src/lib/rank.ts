import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { TOPICS, type Topic } from "./sources";
import type { DigestStory, FeedItem } from "./types";

// Ranking uses OpenAI directly (via OPENAI_API_KEY) — cheaper than the Vercel
// AI Gateway and reuses the key already on the account. gpt-4o-mini is plenty
// for ranking/summarizing a daily digest; override with DIGEST_MODEL.
const DIGEST_MODEL = process.env.DIGEST_MODEL ?? "gpt-4o-mini";

// Cap how many items we send to the model to keep token cost bounded.
const MAX_ITEMS_TO_RANK = 160;

const INTERESTS = `The reader is interested in: cutting-edge technology, scientific
developments, AI/ML, robotics, neural interfaces / brain-computer interfaces,
space & commercial spaceflight, quantum computing, fusion energy, energy &
batteries / grid, blockchain/crypto, Apple, Nintendo, nuclear energy, and biotech.
They value substance and genuine importance over hype, press releases, or
incremental product churn.

They do NOT care about car / automotive news (vehicle models, reviews, EVs as
consumer products). Exclude it — UNLESS the real story is robotics, AI autonomy,
or a battery/energy breakthrough that happens to involve a vehicle.`;

const selectionSchema = z.object({
  brief: z
    .string()
    .describe(
      "A 2-3 sentence editor's brief synthesizing the day's most important themes across the picks. Conversational, specific, no filler.",
    ),
  topPicks: z
    .array(
      z.object({
        index: z.number().int().describe("Index of the source item this refers to"),
        headline: z.string().describe("A tight, factual headline (rewrite if the original is clickbait)"),
        oneLiner: z.string().describe("One sentence on why it matters. No fluff."),
      }),
    )
    .describe("The single most important/interesting stories of the day, best first"),
  grouped: z
    .array(
      z.object({
        index: z.number().int(),
        headline: z.string(),
        oneLiner: z.string(),
      }),
    )
    .describe("More noteworthy stories (excluding the top picks), best first"),
});

export interface RankResult {
  brief: string;
  topPicks: DigestStory[];
  byTopic: Record<string, DigestStory[]>;
  itemsConsidered: number;
}

export interface RankOptions {
  model?: string;
  topPicks?: number;
  maxGrouped?: number;
  extraInterests?: string;
}

function sortByRecency(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });
}

/** A summary of the reader's revealed taste, from what they open and star. */
export interface PreferenceSignal {
  readTopics: string[];
  readSources: string[];
  starredTopics: string[];
  starredSources: string[];
}

function preferenceBlock(p?: PreferenceSignal): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.starredSources.length || p.starredTopics.length)
    parts.push(
      `Explicitly SAVED (strong signal) — topics: ${p.starredTopics.join(", ") || "—"}; sources: ${p.starredSources.join(", ") || "—"}.`,
    );
  if (p.readSources.length || p.readTopics.length)
    parts.push(
      `Frequently opens — topics: ${p.readTopics.join(", ") || "—"}; sources: ${p.readSources.join(", ") || "—"}.`,
    );
  if (!parts.length) return "";
  return `\nREADER TASTE (revealed by behavior — nudge toward these, but never drop genuinely important news to do so):\n${parts.join("\n")}\n`;
}

/** Rank + summarize article items into top picks and topic groups via the LLM. */
export async function rankAndSummarize(
  articleItems: FeedItem[],
  preference?: PreferenceSignal,
  opts: RankOptions = {},
): Promise<RankResult> {
  const model = opts.model ?? DIGEST_MODEL;
  const nPicks = opts.topPicks ?? 5;
  const nGrouped = opts.maxGrouped ?? 22;
  const candidates = sortByRecency(articleItems).slice(0, MAX_ITEMS_TO_RANK);

  if (candidates.length === 0) {
    return { brief: "", topPicks: [], byTopic: {}, itemsConsidered: 0 };
  }

  const list = candidates
    .map((it, i) => {
      const signals: string[] = [];
      if (it.hn) signals.push(`HN ${it.hn.points}pts/${it.hn.comments}c`);
      if (it.coverage && it.coverage > 1)
        signals.push(`covered by ${it.coverage} sources${it.alsoSources?.length ? ` (${it.alsoSources.slice(0, 3).join(", ")})` : ""}`);
      const sig = signals.length ? ` {${signals.join("; ")}}` : "";
      return `[${i}] (${it.topic} · ${it.sourceName})${sig} ${it.title}\n    ${it.snippet}`;
    })
    .join("\n");

  const extra = opts.extraInterests?.trim()
    ? `\nADDITIONAL READER NOTES: ${opts.extraInterests.trim()}\n`
    : "";

  const { object } = await generateObject({
    model: openai(model),
    schema: selectionSchema,
    prompt: `${INTERESTS}
${extra}${preferenceBlock(preference)}
Below are today's candidate stories, each with an [index], topic, source, title, and snippet.

Write a "brief" (2-3 sentence editor's synthesis of the day) and select the standout stories:
- Pick the ${nPicks} most important/interesting overall as "topPicks" (most significant first).
- Then pick up to ${nGrouped} more noteworthy items as "grouped" (do NOT repeat topPicks).
- Skip minor product updates, rumors, listicles, and pure marketing.
- Prefer genuine developments: research results, launches that matter, policy/industry shifts.
- Signals in {curly braces} are importance hints: "HN 340pts" = heavily discussed on Hacker News; "covered by N sources" = multiple outlets independently covered it (consensus). Weight these up, but don't let raw popularity override genuine substance.
- Headlines: factual and tight. One-liners: one sentence on why it matters.
- Only reference indices that exist below.

CANDIDATES:
${list}`,
  });

  const toStory = (sel: { index: number; headline: string; oneLiner: string }): DigestStory | null => {
    const src = candidates[sel.index];
    if (!src) return null; // guard against hallucinated indices
    return {
      headline: sel.headline.trim(),
      oneLiner: sel.oneLiner.trim(),
      link: src.link,
      sourceName: src.sourceName,
      topic: src.topic,
    };
  };

  const topPicks = object.topPicks.map(toStory).filter((s): s is DigestStory => s !== null);

  const usedLinks = new Set(topPicks.map((s) => s.link));
  const byTopic: Record<string, DigestStory[]> = {};
  for (const sel of object.grouped) {
    const story = toStory(sel);
    if (!story || usedLinks.has(story.link)) continue;
    usedLinks.add(story.link);
    (byTopic[story.topic] ??= []).push(story);
  }

  // Keep topic groups in the canonical TOPICS order.
  const ordered: Record<string, DigestStory[]> = {};
  for (const t of TOPICS as readonly Topic[]) {
    if (byTopic[t]?.length) ordered[t] = byTopic[t];
  }

  return {
    brief: object.brief?.trim() ?? "",
    topPicks,
    byTopic: ordered,
    itemsConsidered: candidates.length,
  };
}
