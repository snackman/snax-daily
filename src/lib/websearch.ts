import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { TOPICS, type Topic } from "./sources";
import type { FeedItem } from "./types";

// Agentic discovery: each run, an LLM with web search hunts for important
// developments the fixed feeds might have missed, and returns them as items.

const WEBSEARCH_MODEL = process.env.WEBSEARCH_MODEL ?? "gpt-4o-mini";
const TOPIC_SET = new Set<string>(TOPICS);

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Pull the first JSON array out of a possibly-chatty response. */
function extractItems(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown[];
  } catch {
    return [];
  }
}

/**
 * Run a web search for breaking/important items across the interest areas.
 * Best-effort: returns [] on any failure so it never breaks generation.
 */
export async function webSearchFill(
  nowIso: string,
  opts: { enabled?: boolean; model?: string } = {},
): Promise<FeedItem[]> {
  if (opts.enabled === false || process.env.ENABLE_WEBSEARCH === "0") return [];
  const model = opts.model ?? WEBSEARCH_MODEL;

  const prompt = `Use web search to find the most important, genuinely interesting developments from roughly the LAST 48 HOURS across: AI/ML & robotics, neural interfaces / brain-computer interfaces, nuclear & fusion energy, energy/batteries/grid, biotech, space & commercial spaceflight, quantum computing, and frontier technology. Focus on substance — research results, launches that matter, policy/industry shifts. Skip rumors, minor product updates, marketing, and car/automotive news.

Return ONLY a JSON array (no prose, no markdown) of up to 12 items, each exactly:
{"title": string, "url": string, "topic": one of [${TOPICS.join(", ")}], "oneLiner": string}
Use real, working source URLs from your search. "oneLiner" = one sentence on why it matters.`;

  let text: string;
  try {
    const res = await generateText({
      model: openai.responses(model),
      tools: { web_search: openai.tools.webSearch() },
      prompt,
    });
    text = res.text;
  } catch (err) {
    console.warn("[websearch] failed:", err instanceof Error ? err.message : err);
    return [];
  }

  const raw = extractItems(text);
  const items: FeedItem[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const url = typeof o.url === "string" ? o.url.trim() : "";
    const topic = typeof o.topic === "string" && TOPIC_SET.has(o.topic) ? (o.topic as Topic) : "Tech";
    const oneLiner = typeof o.oneLiner === "string" ? o.oneLiner.trim() : "";
    if (!title || !url.startsWith("http") || seen.has(url)) continue;
    seen.add(url);
    items.push({
      title,
      link: url,
      snippet: oneLiner,
      publishedAt: nowIso,
      sourceName: `Web search · ${hostOf(url) || "web"}`,
      sourceHomepage: `https://${hostOf(url)}`,
      topic,
      type: "article",
    });
  }
  return items;
}
