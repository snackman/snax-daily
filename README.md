# Snax Daily 🍿

A personal daily news digest. Every morning it pulls from ~95 curated sources —
RSS feeds, podcasts, Reddit, Hugging Face papers, plus an agentic web search —
across **AI, tech, science, space, quantum, biotech, nuclear, fusion, energy,
blockchain, Apple, and Nintendo**, has an LLM rank and summarize the standouts,
and publishes a scannable digest (a daily brief + headline/one-liner per story)
to a web dashboard. New podcast episodes get their own section.

Features: cross-day de-duplication, learn-from-behavior ranking, HN-score and
cross-source consensus signals, mark-as-read + save-for-later (owner syncs
across devices via a PIN; visitors are local-only), topic filters, keyboard
shortcuts, an on-demand "Restock" button, and an editable settings page.

## How it works

```
Vercel Cron (7:45 AM ET)
  └─ GET /api/generate
       ├─ fetch ~40 RSS feeds concurrently        (src/lib/fetch.ts)
       │    → skips dead/blocked feeds, dedupes by title
       ├─ rank + summarize articles via Claude     (src/lib/rank.ts)
       │    → 5 top picks + 15-25 grouped by topic
       ├─ collect newest podcast episodes          (src/lib/digest.ts)
       └─ save digest JSON                          (src/lib/storage.ts)

Dashboard
  ├─ /                     → latest digest         (src/app/page.tsx)
  └─ /archive/[date]       → any past day
```

- **Sources** live in [`src/lib/sources.ts`](src/lib/sources.ts) — edit this to
  add/remove feeds or podcasts. Each is tagged by topic and `article`/`podcast`.
- **Storage** auto-selects: Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set,
  otherwise local JSON files under `.data/digests/`.

## Local setup

```bash
npm install
cp .env.example .env.local        # add OPENAI_API_KEY
npm run check-feeds               # verify every feed URL resolves
npm run generate                  # build today's digest into .data/digests/
npm run dev                       # view it at http://localhost:3000
```

`npm run generate` needs an `OPENAI_API_KEY` (ranking uses `gpt-4o-mini` by
default; override with `DIGEST_MODEL`). Everything else (fetching, the
dashboard) runs without one.

## Deploying to Vercel

1. Push to a Git repo and import into Vercel.
2. Add a **Blob** store (Storage tab) — sets `BLOB_READ_WRITE_TOKEN` automatically.
3. Set env vars: `OPENAI_API_KEY` and a `CRON_SECRET`.
4. The cron in [`vercel.json`](vercel.json) runs `/api/generate` daily at
   **11:45 UTC** (≈ 7:45 AM Eastern, so the digest is ready by 8).
   Adjust the schedule for your timezone / DST preference.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run check-feeds` | Fetch every feed and report OK/broken URLs |
| `npm run generate` | Run the full pipeline and write today's digest |
| `npm run dev` / `build` | Next.js dev server / production build |

## Roadmap / deferred

- **Email digest** (Resend) — the digest is already structured data, so this is
  a small isolated add.
- **Web-search fill** for breaking stories beyond RSS.
- **Podcast transcription + summarization** (currently lightweight: episode
  title + feed description only).
