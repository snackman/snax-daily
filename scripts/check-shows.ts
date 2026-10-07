// Live-fetches every show in src/lib/shows.ts from TVmaze and prints what each
// resolves to, so a new SHOWS entry (or an ID typo) can be caught before it ships.
// Run with:  npx tsx scripts/check-shows.ts

import { SHOWS, fetchShow } from "../src/lib/shows";

async function main() {
  console.log(`Checking ${SHOWS.length} shows against TVmaze...\n`);

  const results = await Promise.allSettled(SHOWS.map((s) => fetchShow(s)));

  let failed = 0;
  results.forEach((r, i) => {
    const s = SHOWS[i];
    if (r.status === "rejected") {
      failed++;
      console.log(`❌ ${s.name} (id ${s.tvmazeId}): ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      return;
    }
    const info = r.value;
    const latest = info.latest
      ? `S${info.latest.season}E${info.latest.number ?? "special"} ${info.latest.airdate}`
      : "not aired yet";
    const next = info.next ? ` · next S${info.next.season}E${info.next.number} ${info.next.airdate}` : "";
    console.log(
      `✅ ${info.name} (id ${info.tvmazeId}) · ${info.service ?? "no service"} · ${info.status} · latest ${latest}${next}`,
    );
  });

  console.log(`\n${results.length - failed}/${results.length} shows OK.`);
  process.exit(failed ? 1 : 0);
}

main();
