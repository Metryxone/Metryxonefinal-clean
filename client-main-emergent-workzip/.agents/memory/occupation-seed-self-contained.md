---
name: Occupation seed self-contained pattern
description: Occupation-graph-seed.ts must insert base occupation+skill rows itself (not rely on reference-intelligence-seed.ts being manually triggered) or new occupations silently skip at link-time.
---

## Rule
`occupation-graph-seed.ts` (called lazily at route-registration) must also insert any NEW base `occupations` and `skills` rows via ON CONFLICT DO NOTHING before creating the `occupation_skills`/`occupation_pathways` links.

## Why
`reference-intelligence-seed.ts` is only called by an admin trigger (not on startup). If new occupations/skills are only declared there, the link-phase JOINs silently skip them at first startup.

## How to apply
When adding a new domain (e.g. Security, Design, Legal):
1. Add the new `occupations` + `skills` rows to `NEW_OCCUPATIONS` / `NEW_SKILLS` arrays in `occupation-graph-seed.ts` with ON CONFLICT DO NOTHING.
2. Add the `OCCUPATION_SKILLS` mappings and `PATHWAYS` as usual.
3. Also mirror the new rows in `reference-intelligence-seed.ts` SKILLS/OCCUPATIONS arrays so admin-triggered re-seeds are consistent.

## W9 data gap context (honest, 2026-06-10)
Manual seed ceiling: ~100 occupations / ~150 skills. Targets (300/1000) require O*NET/ESCO bulk import — 2–3 engineering days with API credentials. Engineering is complete; only data sourcing is pending.
