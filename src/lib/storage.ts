import { promises as fs } from "node:fs";
import path from "node:path";
import type { Digest } from "./types";

// Storage strategy:
//   - On Vercel (BLOB_READ_WRITE_TOKEN present) → Vercel Blob.
//   - Locally → JSON files under .data/digests/ so you can build/run with zero
//     cloud setup. Both expose the same read/write/list interface.

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_DIR = path.join(process.cwd(), ".data", "digests");
const BLOB_PREFIX = "digests/";

const key = (date: string) => `${BLOB_PREFIX}${date}.json`;

export async function saveDigest(digest: Digest): Promise<void> {
  const body = JSON.stringify(digest, null, 2);
  if (useBlob) {
    const { put } = await import("@vercel/blob");
    await put(key(digest.date), body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      // Public blobs default to a ~1-month CDN cache; keep it short so a
      // re-generated digest (same-day refresh, cron re-run) propagates fast.
      cacheControlMaxAge: 60,
    });
  } else {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, `${digest.date}.json`), body, "utf8");
  }
}

export async function getDigest(date: string): Promise<Digest | null> {
  if (useBlob) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: key(date) });
    const match = blobs.find((b) => b.pathname === key(date));
    if (!match) return null;
    const res = await fetch(match.url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Digest;
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
  if (useBlob) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    return blobs
      .map((b) => b.pathname.replace(BLOB_PREFIX, "").replace(/\.json$/, ""))
      .sort()
      .reverse();
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
  const dates = await listDigestDates();
  return dates.length ? getDigest(dates[0]) : null;
}
