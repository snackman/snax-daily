// Generate today's digest locally (writes to .data/digests/<date>.json).
// Requires an AI Gateway credential in the environment:
//   AI_GATEWAY_API_KEY=...   (get one at https://vercel.com/ai-gateway)
// Run with:  npm run generate
import { generateDigest } from "../src/lib/digest";

async function main() {
  const digest = await generateDigest();
  console.log(
    `\n✅ Digest ${digest.date} generated:\n` +
      `   top picks: ${digest.topPicks.length}\n` +
      `   topics:    ${Object.keys(digest.byTopic).join(", ") || "(none)"}\n` +
      `   podcasts:  ${digest.podcasts.length}\n` +
      `   feeds:     ${digest.stats.feedsOk} ok / ${digest.stats.feedsFailed} failed\n` +
      `   items:     ${digest.stats.itemsFetched} fetched, ${digest.stats.itemsConsidered} ranked`,
  );
  process.exit(0);
}

main();
