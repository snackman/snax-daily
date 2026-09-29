import { promises as fs } from "node:fs";
import path from "node:path";
import type { Digest } from "./types";
import { KEYS, redis, useRedis } from "./redis";

// Storage strategy:
//   - With Upstash Redis credentials (KV_REST_API_URL/TOKEN) → Redis.
//     Each digest is one key (digest:<date>) plus a `digests` sorted set that
//     indexes dates, so every read is a direct GET / ZRANGE (no scans).
//   - Locally → JSON files under .data/digests/ so you can build/run with zero
//     cloud setup. Both expose the same read/write/list interface.

const LOCAL_DIR = path.join(process.cwd(), ".data", "digests");

/** Sorted-set score for a YYYY-MM-DD date (falls back to 0 if unparsable). */
const scoreFor = (date: string) => {
  const t = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(t) ? t : 0;
};

export async function saveDigest(digest: Digest): Promise<void> {
  if (useRedis) {
    const body = JSON.stringify(digest);
    const p = redis().pipeline();
    p.set(KEYS.digest(digest.date), body);
    p.zadd(KEYS.digestIndex, { score: scoreFor(digest.date), member: digest.date });
    await p.exec();
    return;
  }
  const body = JSON.stringify(digest, null, 2);
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, `${digest.date}.json`), body, "utf8");
}

export async function getDigest(date: string): Promise<Digest | null> {
  if (useRedis) {
    // The client auto-deserializes JSON strings.
    return (await redis().get<Digest>(KEYS.digest(date))) ?? null;
  }
  try {
    const raw = await fs.readFile(path.join(LOCAL_DIR, `${date}.json`), "utf8");
    return JSON.parse(raw) as Digest;
  } catch {
    return null;
  }
}

/** List available digest dates, newest first. */
export async function listDigestDates(): Promise<string[]> {
  if (useRedis) {
    const dates = await redis().zrange<string[]>(KEYS.digestIndex, 0, -1, { rev: true });
    // Members are dates; sort lexically too in case of score ties/oddities.
    return dates.map(String).sort().reverse();
  }
  try {
    const files = await fs.readdir(LOCAL_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** The most recent digest, or null if none exist yet. */
export async function getLatestDigest(): Promise<Digest | null> {
  if (useRedis) {
    const [latest] = await redis().zrange<string[]>(KEYS.digestIndex, 0, 0, { rev: true });
    return latest ? getDigest(String(latest)) : null;
  }
  const dates = await listDigestDates();
  return dates.length ? getDigest(dates[0]) : null;
}
