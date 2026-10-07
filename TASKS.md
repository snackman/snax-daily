# Tasks

Stages: todo · doing · stuck · review · done · skip — Priority: P1 (highest) … P4

## Open

| ID | Task | Stage | Priority | Due | Lead | Tags | Plan | PR | Notes |
|----|------|-------|----------|-----|------|------|------|----|-------|
| shows-tab | Separate Shows tab tracking new episodes of Sam's TV shows: MobLand, Last Week Tonight, Ted Lasso, Lanterns, Landman, The Bear, The Studio, The Daily Show, Tulsa King | review | P3 | | Snax | ui, tv | plans/shows-tab.md | #1 | Use TVmaze API (free, no key) for latest/next air dates. Daily Show airs Mon–Thu, so show only its latest episode. Maybe later: War (HBO). |
| settings-pin-fail-closed | Make the SETTINGS_PIN check fail closed: if the PIN env var is missing, reject writes instead of allowing everyone (/api/settings, /api/state, /api/shows/watched) | todo | P3 | | Snax | security | | | Currently `!pin \|\| header === pin`. SETTINGS_PIN is set in all envs as of 2026-10-07. |

## Done

| ID | Task | Priority | Done | PR | Notes |
|----|------|----------|------|----|-------|
