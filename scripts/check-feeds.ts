// Validates every feed in src/lib/sources.ts by actually fetching + parsing it.
// Run with:  npx tsx scripts/check-feeds.ts
//
// Prints an OK/FAIL line per source and a summary of failures so bad URLs can
// be fixed. This is a dev tool, not part of the runtime digest pipeline.

import Parser from "rss-parser";
import { SOURCES as ALL_SOURCES } from "../src/lib/sources";

// Only RSS/Atom sources are RSS-parseable; custom kinds (e.g. hfpapers = a JSON
// API) are fetched differently by the app and can't be checked here.
const SOURCES = ALL_SOURCES.filter((s) => s.kind !== "hfpapers");

const parser = new Parser({
  timeout: 15000,
  maxRedirects: 5,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) daily-digest/1.0",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
});

type Result = { name: string; url: string; ok: boolean; items?: number; error?: string };

async function check(url: string): Promise<{ ok: boolean; items?: number; error?: string }> {
  try {
    const feed = await parser.parseURL(url);
    return { ok: true, items: feed.items?.length ?? 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  console.log(`Checking ${SOURCES.length} feeds...\n`);
  const results: Result[] = [];

  // Small concurrency so we don't hammer hosts.
  const CONCURRENCY = 6;
  let i = 0;
  async function worker() {
    while (i < SOURCES.length) {
      const s = SOURCES[i++];
      const r = await check(s.url);
      results.push({ name: s.name, url: s.url, ...r });
      const tag = r.ok ? `OK   ${String(r.items).padStart(3)} items` : "FAIL          ";
      console.log(`${r.ok ? "✅" : "❌"} ${tag}  ${s.name}`);
      if (!r.ok) console.log(`     ↳ ${s.url}\n     ↳ ${r.error}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} feeds OK.`);
  if (failed.length) {
    console.log(`\n${failed.length} FAILED:`);
    for (const f of failed) console.log(`  - ${f.name}: ${f.url}`);
  }
  // Sockets kept alive by keep-alive agents can prevent a clean exit.
  process.exit(failed.length ? 1 : 0);
}

main();
