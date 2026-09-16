import { promises as fs } from "node:fs";
import path from "node:path";

// User-editable settings that the generation pipeline reads at run time, so the
// digest can be tuned from the /settings page without touching code.

export interface Settings {
  /** Extra free-text interests appended to the ranker's base prompt. */
  extraInterests: string;
  /** Additional terms to exclude (beyond the built-in car filter). */
  blocklist: string[];
  /** Source names to skip entirely. */
  mutedSources: string[];
  /** Topics to exclude entirely from the digest. */
  hiddenTopics: string[];
  /** How many top picks to select. */
  topPicks: number;
  /** Max grouped (non-pick) stories. */
  maxGrouped: number;
  /** Max podcast episodes shown. */
  podcastSlots: number;
  /** OpenAI model for ranking/brief. */
  model: string;
  /** Whether agentic web-search runs. */
  webSearch: boolean;
  /** Article lookback window (hours). */
  articleHours: number;
  /** Podcast lookback window (days). */
  podcastDays: number;
}

export const DEFAULT_SETTINGS: Settings = {
  extraInterests: "",
  blocklist: [],
  mutedSources: [],
  hiddenTopics: [],
  topPicks: 5,
  maxGrouped: 22,
  podcastSlots: 24,
  model: "gpt-4o-mini",
  webSearch: true,
  articleHours: 48,
  podcastDays: 7,
};

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_KEY = "settings/settings.json";
const LOCAL = path.join(process.cwd(), ".data", "settings.json");

function coerce(raw: Partial<Settings> | null): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  // Clamp numbers into sane ranges.
  s.topPicks = Math.max(0, Math.min(15, Number(s.topPicks) || DEFAULT_SETTINGS.topPicks));
  s.maxGrouped = Math.max(0, Math.min(60, Number(s.maxGrouped) || DEFAULT_SETTINGS.maxGrouped));
  s.podcastSlots = Math.max(0, Math.min(40, Number(s.podcastSlots) || DEFAULT_SETTINGS.podcastSlots));
  s.articleHours = Math.max(6, Math.min(168, Number(s.articleHours) || DEFAULT_SETTINGS.articleHours));
  s.podcastDays = Math.max(1, Math.min(30, Number(s.podcastDays) || DEFAULT_SETTINGS.podcastDays));
  s.blocklist = Array.isArray(s.blocklist) ? s.blocklist.filter(Boolean) : [];
  s.mutedSources = Array.isArray(s.mutedSources) ? s.mutedSources.filter(Boolean) : [];
  s.hiddenTopics = Array.isArray(s.hiddenTopics) ? s.hiddenTopics.filter(Boolean) : [];
  s.webSearch = Boolean(s.webSearch);
  s.model = typeof s.model === "string" && s.model ? s.model : DEFAULT_SETTINGS.model;
  s.extraInterests = typeof s.extraInterests === "string" ? s.extraInterests : "";
  return s;
}

export async function getSettings(): Promise<Settings> {
  if (useBlob) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_KEY });
    const match = blobs.find((b) => b.pathname === BLOB_KEY);
    if (!match) return { ...DEFAULT_SETTINGS };
    const res = await fetch(`${match.url}?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { ...DEFAULT_SETTINGS };
    return coerce(await res.json());
  }
  try {
    return coerce(JSON.parse(await fs.readFile(LOCAL, "utf8")));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(input: Partial<Settings>): Promise<Settings> {
  const merged = coerce(input);
  const body = JSON.stringify(merged, null, 2);
  if (useBlob) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_KEY, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
  } else {
    await fs.mkdir(path.dirname(LOCAL), { recursive: true });
    await fs.writeFile(LOCAL, body, "utf8");
  }
  return merged;
}
