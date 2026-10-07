# Tasks

Stages: todo · doing · stuck · review · done · skip — Priority: P1 (highest) … P4

## Open

| ID | Task | Stage | Priority | Due | Lead | Tags | Plan | PR | Notes |
|----|------|-------|----------|-----|------|------|------|----|-------|
| settings-pin-fail-closed | Make the SETTINGS_PIN check fail closed: if the PIN env var is missing, reject writes instead of allowing everyone (/api/settings, /api/state, /api/shows/watched) | todo | P3 | | Snax | security | | | Currently `!pin \|\| header === pin`. SETTINGS_PIN is set in all envs as of 2026-10-07. |

## Done

| ID | Task | Priority | Done | PR | Notes |
|----|------|----------|------|----|-------|
| shows-tab | Shows tab tracking new episodes of Sam's TV shows (TVmaze, watched state) | P3 | 2026-10-07 | #1 | |
