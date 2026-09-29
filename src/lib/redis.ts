import { Redis } from "@upstash/redis";

// Single Upstash Redis client for the app.
//
// Credentials come from the Vercel Upstash integration (KV_REST_API_*) or a
// plain Upstash database (UPSTASH_REDIS_REST_*). When neither is set, the
// storage helpers fall back to local JSON files under .data/ so the app still
// builds and runs with zero cloud setup.
//
// One Redis database may be shared by several apps, so every key is namespaced
// with REDIS_PREFIX (default "news:").

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const useRedis = !!(url && token);

export const REDIS_PREFIX = process.env.REDIS_PREFIX ?? "news:";

/** Namespace a key with the app prefix. */
export const rkey = (k: string) => `${REDIS_PREFIX}${k}`;

let client: Redis | null = null;

/** Lazily construct the client so nothing touches Redis at import/build time. */
export function redis(): Redis {
  if (!useRedis) throw new Error("Redis is not configured (KV_REST_API_URL / KV_REST_API_TOKEN)");
  client ??= new Redis({ url, token });
  return client;
}

// Key scheme (all prefixed with REDIS_PREFIX):
//   digest:<YYYY-MM-DD>  string  — digest JSON for that day
//   digests              zset    — member = date, score = epoch ms of that date (index/listing)
//   settings             string  — settings JSON
//   state                string  — reader state JSON (read/starred/seen)
export const KEYS = {
  digest: (date: string) => rkey(`digest:${date}`),
  digestIndex: rkey("digests"),
  settings: rkey("settings"),
  state: rkey("state"),
} as const;
