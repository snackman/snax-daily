# Plan: shows-tab — "Shows" tab tracking new TV episodes

Task: `shows-tab` (P3) · Branch: `task/shows-tab` · Planned 2026-10-07 · **Rev 3** (implemented — backlog-starts-watched decision applied)

## Goal

Add a **📺 Shows** tab next to the existing 📰 News / 🎧 Podcasts toggle. It lists Sam's TV shows. For each one it shows
the latest aired episode (SxEy, title, air date), the next episode date if scheduled (or a clear between-seasons/ended
status), and the network or streaming service. An episode is **NEW until Snax marks it watched**, except for the
one-time launch backlog below. Unwatched new episodes sort first. Data comes from the TVmaze API (free, no key).

**Resolved (open question 2, answered by Snax): the backlog starts as watched.** Episodes that aired before launch day
(`WATCHED_BASELINE = "2026-10-08"`, America/New_York, in `src/lib/shows.ts`) count as watched for a show with no stored
mark, so day one isn't 9 shows all showing NEW (including The Studio's finale from May 2025). A stored watched mark
always takes precedence over the baseline — once Snax marks (or unmarks) a show, the baseline no longer applies to it.
"Mark all watched" is kept regardless, since it's still useful for a show added later or an episode that airs the same
day it's added. See `isUnwatched()` in `src/lib/shows.ts` for the exact rule.

## Decisions

1. **Fetch when the page is requested, cache in Redis with a 1h soft TTL (keep the stale copy if TVmaze fails). Don't use the cron.**
   - Episodes air in the evening (Daily Show/LWT 11pm ET, HBO 9pm ET), after the 7:45am cron.
   - TVmaze gives streaming drops placeholder airstamps of `12:00Z`, which is also after the 11:45Z cron. Ted Lasso S4E10 is dated today.
   - A cron snapshot would lag by up to about 24h. Using the cron would also tie shows to the 300s LLM pipeline and the Restock throttle.
   - It's cheap: 10 parallel GETs. TVmaze sends `cache-control: max-age=3600` and allows about 20 req/10s per IP.
   - Next's fetch cache doesn't apply because every page here is `force-dynamic`, which forces `no-store`. See
     `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`; `cacheComponents` is off.
2. **The show list is a code constant** (`SHOWS` in `src/lib/shows.ts`), not a setting. Adding or removing a show is one line.
3. **Use a separate route `/shows`**, linked as a third item in the existing segmented toggle. It doesn't appear on archive pages,
   and `digest-view.tsx` (791 lines) barely grows.
4. **Watched state = "watched up to" per show** in a separate Redis hash, writes gated by the owner PIN (see below).
5. **Rows are not links.** The only interactive element in a row is the watched control.

## Verified TVmaze IDs (queried live 2026-10-07)

Each was checked with `GET https://api.tvmaze.com/shows/:id?embed[]=previousepisode&embed[]=nextepisode`.

| Show | TVmaze ID | Service | TVmaze status | Latest (prev) | Next | Notes |
|---|---|---|---|---|---|---|
| MobLand | **75026** | Paramount+ (webChannel) | Running | S2E3 2026-10-02 | S2E4 2026-10-09 | weekly |
| Last Week Tonight | **263** | HBO | Running | S13E25 2026-10-04 | — (not listed yet) | TVmaze lists next ep late |
| Ted Lasso | **44458** | Apple TV (webChannel) | Running | S4E10 2026-10-07 | — | S4 finale today |
| Lanterns | **44776** | HBO | To Be Determined | S1E8 2026-10-04 | — | S1 = 8 eps, done. Not the Green Lantern shows (3585, 85889) |
| Landman | **53777** | Paramount+ (webChannel) | Running | S2E10 2026-01-18 | — | seasons embed lists S3 (10 eps), no dates |
| The Studio | **75605** | Apple TV (webChannel) | Running | S1E10 2025-05-21 | — | S2 not in TVmaze yet |
| The Daily Show | **66198** | Comedy Central | Running | S4E112 2026-10-06 | S4E113 2026-10-07 | Mon–Thu. Not 249/3928 (old Stewart/Noah entries) |
| Tulsa King | **59344** | Paramount+ (webChannel) | Running | S3E10 2025-11-23 | **S4E1 2026-10-16** | premiere scheduled |
| War | **86587** | HBO | Running | S1E1 2026-10-01 | S1E2 2026-10-08 | added per Snax. Not the Egyptian "War" (68204) |

~~The Bear (54198)~~ is dropped per Snax (TVmaze has it as Ended after S5).

Observations that shape the code:
- Service = `network.name ?? webChannel.name`. Streaming shows have `network: null`.
- Streaming `airstamp` is a placeholder (`T12:00:00+00:00`), so **display `airdate`**, never a time.
- `embed[]=seasons` works in the same call (`number`, `episodeOrder`, `premiereDate`). It drives the "finale aired" and
  "Season N announced, no date" labels.
- Unknown IDs return 404.

**One call per show:** `GET https://api.tvmaze.com/shows/{id}?embed[]=previousepisode&embed[]=nextepisode&embed[]=seasons`

## Data model (`src/lib/shows.ts`)

```ts
export interface TrackedShow { tvmazeId: number; name: string; /** airs ~daily: only latest ep, sorted after weeklies */ daily?: boolean }

export const SHOWS: TrackedShow[] = [
  { tvmazeId: 75026, name: "MobLand" },
  { tvmazeId: 263,   name: "Last Week Tonight" },
  { tvmazeId: 44458, name: "Ted Lasso" },
  { tvmazeId: 44776, name: "Lanterns" },
  { tvmazeId: 53777, name: "Landman" },
  { tvmazeId: 75605, name: "The Studio" },
  { tvmazeId: 66198, name: "The Daily Show", daily: true },
  { tvmazeId: 59344, name: "Tulsa King" },
  { tvmazeId: 86587, name: "War" },
];

export interface EpisodeInfo {
  id: number;                               // TVmaze episode id (watched marker)
  season: number; number: number | null;    // null = special
  name: string; airdate: string;            // YYYY-MM-DD, network-local
}

/** Raw TVmaze facts, cached as-is. Labels and sorting are derived at render time. */
export interface ShowInfo {
  tvmazeId: number; name: string; daily: boolean;
  service: string | null;                   // network.name ?? webChannel.name
  status: string;                           // Running | Ended | To Be Determined | In Development
  image: string | null;                     // image.medium (poster thumb)
  latest: EpisodeInfo | null;
  next: EpisodeInfo | null;
  latestSeasonEpisodes: number | null;      // episodeOrder of latest.season (finale detection)
  announcedSeason: number | null;           // later season listed with no premiereDate
  error?: string;                           // fetch failed and no stale copy existed
}
export interface ShowsSnapshot { fetchedAt: string; ids: number[]; shows: ShowInfo[] }
```

There's no `link`/`officialSite` field because rows are not links. Display names are our own (TVmaze's "Last Week Tonight with
John Oliver" is too long for mobile).

### Watched state (`src/lib/shows-watched.ts`)

```ts
export interface WatchedMark { episodeId: number; airdate: string; label: string /* "S2E3" */; ts: string;
                               prev?: Omit<WatchedMark, "prev" | "ts"> }   // one-level undo
export type WatchedMap = Record<number /* tvmazeId */, WatchedMark>;
```

- **Model: "watched up to" per show.** One mark per show, pointing at the latest episode Snax marked. We only ever *show* the
  latest episode, so marking it covers every older one by definition, and there's no per-episode list to maintain.
- **Unwatched rule** (pure function `isUnwatched(latest, mark)` in `src/lib/shows.ts`): if there's a mark, `!(latest.id ===
  mark.episodeId || latest.airdate < mark.airdate)`; if there's no mark, `latest.airdate >= WATCHED_BASELINE` (the backlog
  decision above — a show with nothing marked yet is NEW only once an episode airs on/after launch day). A mark always
  wins over the baseline. When a newer episode airs (new id with an airdate on or after the mark), it becomes NEW again
  with no extra logic. The Daily Show works the same way: marking clears it until the next episode flips into TVmaze's
  `previousepisode`.
- **Storage:** Redis **hash** `KEYS.showsWatched = rkey("shows:watched")`, one field per tvmazeId whose value is the `WatchedMark` JSON.
  Writes with `HSET`/`HDEL` are atomic per show, so fast taps on different rows can't overwrite each other. That's safer than the
  single-JSON read-modify-write that `state.ts` uses. Reads use `HGETALL` (Upstash auto-deserializes).
  Local fallback is `.data/shows-watched.json` (whole map, same dual pattern as `settings.ts`/`state.ts`). The key is separate from the TVmaze
  cache key `KEYS.shows = rkey("shows")`. Both go in the key-scheme comment in `redis.ts`.
- **Actions:**
  - `watch {tvmazeId, episode: {id, airdate, label}}`: saves the new mark with `prev` = the old mark (without its `prev`).
  - `unwatch {tvmazeId}`: restores `prev` if there is one, otherwise deletes the field. This is the undo.
  - `watchAll {items: [...]}`: marks the current latest episode of every listed show (for the first-run backlog).
  - Validate input: the id must be in `SHOWS`, `episode.id` a positive int, `airdate` matching `/^\d{4}-\d{2}-\d{2}$/`, and `label` ≤ 20 chars.

### Write protection (matches the existing pattern, flagged)

`/api/settings` POST and `/api/state` GET/POST gate on `process.env.SETTINGS_PIN` checked against the `x-settings-pin` header. The client sends
`localStorage["digest:settingsPin:v1"]`, which is set on the settings page. The new route **copies this exactly**, including the `authed()` helper from
`src/app/api/state/route.ts`.

> ⚠️ **Flag:** the existing check **fails open**: `return !pin || header === pin`. If `SETTINGS_PIN` is not set in the
> Vercel production env, settings, reader state, and now watched marks are **publicly writable**. The implementer should
> confirm it's set with `VERCEL_TOKEN="$(vercel-token)" vercel env ls` (it needs to be set for Production *and* Preview, or preview
> testing of watch marks will 401). Fixing the fail-open for the existing routes is out of scope. Raise it with Snax rather than
> changing it silently.

Reads aren't gated. The `/shows` page reads the watched map on the server and renders the owner's NEW/watched state for everyone,
since watched marks aren't sensitive. Visitors without a PIN see the state but not the controls (see UI).

## Caching (TVmaze snapshot)

- `getShows(): Promise<{ snapshot: ShowsSnapshot | null; stale: boolean }>` in `src/lib/shows.ts`:
  1. Read the cached snapshot (Redis `KEYS.shows` / `.data/shows.json`).
  2. Return it if it's younger than `SHOWS_TTL_MS = 3_600_000` **and** `ids` equals `SHOWS.map(s => s.tvmazeId)`. Editing the
     list (dropping The Bear, adding War) busts the cache.
  3. Otherwise, run `Promise.allSettled` over the per-show fetches (`AbortSignal.timeout(6000)`, `cache: "no-store"`, UA `snax-daily/1.0`).
     A failed show reuses its entry from the old snapshot, or gets an `error` stub if there isn't one.
  4. If **every** fetch fails and an old snapshot exists, return it with `stale: true` and don't overwrite it. Otherwise save, best-effort
     (try/catch, log `[shows]`).
- Don't set a Redis TTL. The stale copy is the outage fallback. No cron, `vercel.json`, or settings changes.

## Derived display logic (pure, at render time)

`describeShow(info, mark, today)` returns `{ unwatched, group, latestLabel, statusLabel }`. `today` is the YYYY-MM-DD date in
`America/New_York`. Copy `todayInTz` into a tiny `src/lib/date.ts` (and have `digest.ts` import it) so `/shows` doesn't pull in
`digest.ts`'s AI/RSS deps.

- **latestLabel**: "S2E3 · Bonzo Goes to Bitburg · Fri, Oct 2". A special reads "S4 Special · …". If the episode aired more than 60 days ago, it reads "Last aired Jan 2026".
  If there's no latest episode, it reads "Not aired yet".
- **statusLabel** (first match wins):
  1. If `next` exists and `next.number === 1`: "Season 4 premieres Fri, Oct 16 · in 9 days". Otherwise "Next: S2E4 · Fri, Oct 9" plus
     "tonight"/"tomorrow"/"in N days" when it's within 7 days.
  2. `status === "Ended"`: "Series ended".
  3. `announcedSeason`: "Season 3 announced · no date yet" (Landman).
  4. `latest.number === latestSeasonEpisodes`: "Season 1 finale aired · no return date", plus " · renewal TBD" when the status is TBD.
  5. Otherwise: "Next episode not scheduled yet".
- **Sort groups:**
  - (0) unwatched, non-daily, by `latest.airdate` desc
  - (1) unwatched daily shows (Daily Show)
  - (2) watched with `next` scheduled, by `next.airdate` asc
  - (3) watched with no date, by `latest.airdate` desc
  - (4) ended
  - (5) errored
- **Sort is computed on page load only.** When Snax taps watched, the row stays in place (no jumping under his thumb) and moves on
  the next load.

## UI

**`src/app/shows/page.tsx`** (server, `export const dynamic = "force-dynamic"`, `metadata.title = "Shows · Snax Daily"`):
- Calls `Promise.all([getShows(), getWatched()])` and computes `today`.
- Pre-sorts with `sortShows()` (step above) and passes the ordered list, marks, and `today` to `<ShowsView>`.
- Layout matches the home page: `<main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">`.
- Header styled like `DateNav`: "Snax Daily 🍿" h1, "TV shows" subtitle, ⚙︎ settings link.
- Then `<ViewTabs active="shows" />`.

**`src/components/shows-view.tsx`** (`"use client"`, because it holds watched state for optimistic updates):
- State: `marks` (initialized from props) and `isOwner`. `isOwner` is set after mount: true if a PIN exists in localStorage.
  On a 401, set it to false and show "Set your PIN in ⚙︎ Settings to mark episodes".
- **Rows** (`<li>`, not links, no hover underline): `flex items-start gap-3 border-b border-black/5 py-3 last:border-0`.
  - **Poster thumb:** `w-10 sm:w-12 aspect-[2/3] rounded object-cover`. Use a plain `<img loading="lazy" alt="">` from `image.medium`, with an
    eslint-disable for `@next/next/no-img-element` so there's no `remotePatterns` config or image quota. If there's no image, render a neutral block instead.
  - **Line 1:** name (font-medium) + service pill (TopicBadge-style color map: HBO purple, Paramount+ blue, Apple TV
    zinc, Comedy Central amber, fallback zinc) + **NEW** pill (`bg-emerald-500/15 text-emerald-600`) when unwatched.
  - **Line 2:** latestLabel (`text-sm text-black/70 dark:text-white/60`). Line 3: statusLabel (`text-xs text-black/40`).
    Long titles wrap (`min-w-0 break-words`).
  - When watched, line 2 is muted (`opacity-60`), the same idea as `opacity-45` on read stories.
- **Watched control** (the only tap target, owner only, right-aligned, `shrink-0`):
  - Unwatched: a pill button "✓ Watched", `min-h-9 px-3` for a ≥36px touch target. On tap it **optimistically** sets the
    mark and POSTs `watch`. On failure it reverts and shows a small inline error.
  - Watched: a quiet "Watched S2E3 · Undo" text button. Tapping Undo POSTs `unwatch` (restores `prev`) and flips NEW back on. Always
    visible, so unmarking needs no special mode.
  - Shows with no latest episode get no control.
- **"Mark all watched"** small text button above the list (owner only, shown when there are ≥2 unwatched shows; mirrors "Mark all
  read"). The launch-day backlog is handled by `WATCHED_BASELINE` instead (see Goal), but this stays useful for a show
  added later, or several episodes airing the same day, that Snax wants to bulk-clear.
- Footer: "Schedule from [TVmaze](https://www.tvmaze.com) · updated {time}", plus " · TVmaze unavailable, showing saved data" when
  `stale`. The TVmaze link here is attribution, not a row link.
- Empty state (no snapshot at all): "Couldn't reach TVmaze right now. Try again shortly."

**`src/app/api/shows/watched/route.ts`** (new, `force-dynamic`): POST only, with the PIN gate copied from `api/state`. It does
bad json → 400, bad input → 400, ok → `{ ok: true, marks }`, and errors → 500 with a `[shows-watched]` log. It always sends `cache-control: no-store`.

**Tabs (no count on Shows):**
- `src/components/view-tabs.tsx` (`"use client"`) is used on `/shows`. 📰 News and 🎧 Podcasts are `<Link href="/">`. Their `onClick`
  writes `localStorage["digest:view:v1"]` = `"news"`/`"podcasts"`, which `DigestView` already reads on mount.
  The 📺 Shows tab is the active style with no count.
- `digest-view.tsx`: add a third `<Link href="/shows">📺 Shows</Link>` with the same inactive classes to the existing toggle.
  Change the tab padding to `px-2.5 sm:px-3` so all three fit on one line at 320px.
- `src/app/page.tsx`: add a "📺 Shows" link to the no-digest empty state.

## Files to change

| File | Change |
|---|---|
| `src/lib/shows.ts` | **new**: `SHOWS`, types, `fetchShow`, `getShows` (cache/stale), `describeShow`, `isUnwatched`, `sortShows` |
| `src/lib/shows-watched.ts` | **new**: `getWatched`, `applyWatchedAction` (Redis hash / `.data` fallback) |
| `src/lib/date.ts` | **new**: `todayInTz` moved here; `digest.ts` re-imports it |
| `src/lib/redis.ts` | `KEYS.shows`, `KEYS.showsWatched` + key-scheme comment lines |
| `src/app/shows/page.tsx` | **new** server page |
| `src/app/api/shows/watched/route.ts` | **new** PIN-gated POST |
| `src/components/shows-view.tsx` | **new** client list + watched controls |
| `src/components/view-tabs.tsx` | **new** tabs for `/shows` |
| `src/components/digest-view.tsx` | Shows link in the toggle; `px-2.5 sm:px-3` |
| `src/app/page.tsx` | Shows link in the empty state |
| `scripts/check-shows.ts` + `package.json` | **new** `npm run check-shows`: live-fetch every `SHOWS` entry and print id/name/service/latest/status |
| `README.md` | "Shows tab" section: adding a show (find the ID via `api.tvmaze.com/singlesearch/shows?q=…`, verify, add to `SHOWS`), how watched works, note that it needs `SETTINGS_PIN` |

## Edge cases

- **TVmaze down:** use the stale snapshot per show, with a footer note when all shows failed. If there's never been a snapshot, show the empty state. The page never throws.
- **Missing embeds:** no `previousepisode` means "Not aired yet" and no watch control. No `seasons` means skip the finale/announced labels.
- **Specials** (`number: null`) read "S{n} Special". A missing episode name means the title is omitted.
- **Mark points at an episode TVmaze later renumbers or deletes:** the airdate comparison still works. If TVmaze moves an airdate
  earlier, the worst case is an episode wrongly showing as watched, and Undo or a new episode fixes it.
- **Daily Show:** only `previousepisode` is used, so there's never more than one episode. After marking, it reads "Watched S4E112" and sorts into group 2
  ("Next: S4E113 tonight"). When TVmaze flips it, it's NEW again.
- **Two taps in flight on the same show:** disable that row's button while its POST is pending.
- **Writes without a PIN, or the wrong PIN:** 401, the UI reverts and shows the PIN hint. If `SETTINGS_PIN` is unset, writes are public (flagged above).
- **Removed show** (e.g. The Bear) leaves orphan hash fields. They're ignored, and `watchAll`/`watch` only accept ids in `SHOWS`.

## Verification

Local:
1. `npm run check-shows`: all 9 resolve and the services/statuses match the table.
2. `npx tsc --noEmit`, `npm run lint`, `npm run build`. The build must not call TVmaze.
3. `npm run dev` with no Redis env, on `/shows`:
   - `.data/shows.json` is written, and a reload doesn't refetch (log the fetch).
   - With `WATCHED_BASELINE` in the past relative to every show's latest episode (the normal case once launch day has
     passed), nothing starts NEW. Hand-edit a mark's `airdate`/`episodeId` to simulate a new episode airing (step 4
     below), mark it watched, and confirm `.data/shows-watched.json` is written.
   - Reload: the show sits in the watched group with no NEW badge.
   - Undo, then reload: NEW again.
   - "Mark all watched" clears any that are NEW.
4. Hand-edit a mark's `airdate`/`episodeId` to an older episode and confirm NEW reappears (this simulates a new episode airing).
5. PIN: set `SETTINGS_PIN=x` in `.env.local`:
   - With no PIN in localStorage, the controls are hidden.
   - With a wrong PIN, the POST returns 401 and the UI reverts.
   - With the right PIN, it works.
   - `curl -X POST /api/shows/watched` without the header returns 401.
6. Simulate an outage: break the TVmaze base URL temporarily. The stale data and footer note show. Delete `.data/shows.json` and the empty state shows.
7. Tabs: `/` → Shows → Podcasts lands on podcasts. The Shows tab has no count. Archive pages also have the link.

Vercel preview (via `/ship`):
8. Confirm `SETTINGS_PIN` is set for Preview and Production (`vercel env ls`).
9. `/shows` loads. Mark and unmark with the PIN set on the preview's settings page. Check the Redis keys `news:shows` and
   `news:shows:watched`. `vercel inspect <url> --logs` shows no `[shows]` errors.
   Note: if preview and prod share the Redis DB and prefix, marks made on the preview are real. That's harmless, but tell Snax.
10. `/mobile-check` at 375 and 320px:
    - The tab bar stays on one line.
    - The watched button is easy to tap and doesn't squeeze the title.
    - Long titles wrap.
    - Posters are aligned.
    - Dark mode looks right.
11. Spot-check rows against tvmaze.com (e.g. Tulsa King "Season 4 premieres Fri, Oct 16", War "Next: S1E2 · Thu, Oct 8").

## Alternatives considered

- **Cron snapshot:** rejected because of same-day staleness and coupling to the digest pipeline.
- **ISR `/shows` (`revalidate = 3600`):** less code, but it hits TVmaze at build time, and the per-request watched state forces the page
  to be dynamic anyway.
- **Per-episode watched set** (store every watched episode id): rejected. Only the latest episode is shown, so "watched up to" is
  simpler and clears older episodes automatically.
- **Single-JSON watched map** (like `state.ts`): workable, but a hash gives atomic per-show writes for free.
- **Watched state in localStorage only:** rejected because Snax wants it to persist across devices.
- **Third in-page view in `DigestView` / show list in Settings:** rejected (see Decisions 2–3).

## Risks

- **Fail-open PIN gate** (see flag). This is the main thing to check before shipping.
- **TVmaze data quality:** streaming drop times are approximate, and LWT's next episode is often listed late. The labels say "not scheduled yet" rather than guessing.
- **Attribution:** TVmaze asks for attribution (CC BY-SA), which the footer link covers. Posters are hotlinked from `static.tvmaze.com`, which TVmaze permits.

## Remaining open questions for Snax

1. Is `SETTINGS_PIN` set in Vercel (Production + Preview)? If not, watched marks, like settings today, are publicly writable.
   Should the gate fail closed in production as a follow-up task?
2. ~~First run: every show starts NEW...~~ **Resolved:** backlog starts as watched (`WATCHED_BASELINE`), see Goal above.
