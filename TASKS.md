# Tasks

Stages: todo · doing · stuck · review · done · skip — Priority: P1 (highest) … P4

## Open

| ID | Task | Stage | Priority | Due | Lead | Tags | Plan | PR | Notes |
|----|------|-------|----------|-----|------|------|------|----|-------|
| article-images | Digest: lead images on story cards (feed media/enclosure/<img>, og:image fallback for picked stories) | review | P3 | | Snax | digest | | #5 | |
| shows-streaming-times | Shows: default release time per streaming service when TVmaze has no airtime (Paramount+ 12 AM PT / 3 AM ET; verify Apple TV etc.) | todo | P3 | | Snax | shows | | | |
| shows-digest-line | Shows: add a shows line to the daily digest ("Tonight: War S1E4 · 9 PM", "Out now: MobLand S2E6") | todo | P3 | | Snax | shows | | | |
| shows-calendar-feed | Shows: subscribable .ics calendar feed of upcoming episodes with air times | todo | P3 | | Snax | shows | | | |
| shows-behind-count | Shows: "N behind" count from the watched mark vs. TVmaze episode list | todo | P3 | | Snax | shows | | | |
| shows-return-alerts | Shows: flag when an ended/on-break show (Landman S3, The Studio S2, Ted Lasso) gets a premiere date from TVmaze (highlight row / surface in digest) | todo | P3 | | Snax | shows | | | |
| shows-manage-settings | Shows: add/remove tracked shows from Settings via TVmaze search (PIN-gated), stored in Redis instead of the hard-coded SHOWS list | todo | P3 | | Snax | shows | | | |
| shows-cache-bust-deploy | Shows: invalidate the cached TVmaze snapshot on deploy (e.g. build ID / schema version in the cache key) so data-shape changes show immediately | todo | P3 | | Snax | shows | | | |
| shows-daily-show-latest | Shows: for daily shows (The Daily Show), show only the latest episode and quiet the near-permanent NEW badge | todo | P3 | | Snax | shows | | | |

## Done

| ID | Task | Priority | Done | PR | Notes |
|----|------|----------|------|----|-------|
| shows-tab | Shows tab tracking new episodes of Sam's TV shows (TVmaze, watched state) | P3 | 2026-10-07 | #1 | |
| settings-pin-fail-closed | Owner PIN check fails closed (shared hasOwnerPin in src/lib/pin.ts) | P3 | 2026-10-07 | #2 | |
