#!/usr/bin/env node
// One-time migration: copy everything from the old Vercel Blob store into
// Upstash Redis using the app's key scheme (see src/lib/redis.ts).
//
//   Blob pathname               → Redis key (prefixed with REDIS_PREFIX)
//   digests/<YYYY-MM-DD>.json   → digest:<date>  (+ ZADD digests <epoch ms> <date>)
//   settings/settings.json      → settings
//   state/reader.json           → state
//
// Usage (needs BLOB_READ_WRITE_TOKEN + KV_REST_API_URL/KV_REST_API_TOKEN):
//   node --env-file=.env.local scripts/migrate-blob-to-redis.mjs --dry-run
//   node --env-file=.env.local scripts/migrate-blob-to-redis.mjs
//
// Idempotent: re-running overwrites the same keys with the same values.
// Pass --no-overwrite to skip keys that already exist in Redis (so data written
// by the new Redis-backed app is never clobbered by older Blob copies).

import { list } from "@vercel/blob";
import { Redis } from "@upstash/redis";

const DEFAULT_PREFIX = "news:";
const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const NO_OVERWRITE = args.has("--no-overwrite");

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = process.env.REDIS_PREFIX ?? DEFAULT_PREFIX;

if (!blobToken) {
  console.error("Missing BLOB_READ_WRITE_TOKEN");
  process.exit(1);
}
if (!DRY && !(url && token)) {
  console.error("Missing KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN)");
  process.exit(1);
}

const redis = url && token ? new Redis({ url, token }) : null;
const k = (s) => `${PREFIX}${s}`;
const scoreFor = (date) => {
  const t = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(t) ? t : 0;
};

/** Map a blob pathname to its Redis target, or null to skip. */
function target(pathname) {
  const m = pathname.match(/^digests\/(.+)\.json$/);
  if (m) return { key: k(`digest:${m[1]}`), date: m[1] };
  if (pathname === "settings/settings.json") return { key: k("settings") };
  if (pathname === "state/reader.json") return { key: k("state") };
  return null;
}

async function listAll() {
  const out = [];
  let cursor;
  do {
    const page = await list({ token: blobToken, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

const blobs = await listAll();
console.log(`Found ${blobs.length} blob(s). Prefix: "${PREFIX}"${DRY ? " (dry run)" : ""}`);

let written = 0;
let skipped = 0;
for (const b of blobs) {
  const t = target(b.pathname);
  if (!t) {
    console.log(`  skip   ${b.pathname} (unknown path)`);
    skipped++;
    continue;
  }
  const res = await fetch(`${b.url}?ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) {
    console.error(`  FAIL   ${b.pathname}: HTTP ${res.status}`);
    skipped++;
    continue;
  }
  const text = await res.text();
  try {
    JSON.parse(text);
  } catch {
    console.error(`  FAIL   ${b.pathname}: not valid JSON`);
    skipped++;
    continue;
  }
  if (DRY) {
    console.log(`  would  ${b.pathname} → ${t.key}${t.date ? ` (+ zadd ${k("digests")})` : ""}`);
    written++;
    continue;
  }
  if (NO_OVERWRITE && (await redis.exists(t.key))) {
    console.log(`  exists ${t.key} (kept)`);
    if (t.date) await redis.zadd(k("digests"), { score: scoreFor(t.date), member: t.date });
    skipped++;
    continue;
  }
  const p = redis.pipeline();
  p.set(t.key, text);
  if (t.date) p.zadd(k("digests"), { score: scoreFor(t.date), member: t.date });
  await p.exec();
  console.log(`  wrote  ${b.pathname} → ${t.key}`);
  written++;
}

console.log(`Done. ${DRY ? "Would write" : "Wrote"} ${written}, skipped ${skipped}.`);
