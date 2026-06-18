# WC-L0F · Deliverable 1 — Behaviour Coverage Report
_Generated 2026-06-10T02:58:51.179Z. Emails one-way sha256-masked._

## Headline (reconciled — the "~22%" premise is STALE)
- Behaviour coverage (completed sessions with >=1 numeric construct dim): **7/9 = 77.8%** (before this run: 7/9 = 77.8%).
- The 22% figure is the PRE-WC-L0E state. The WC-L0E signal backfill is **already applied** — 5 sessions carry `wcl0e_backfill` provenance — which lifted coverage to its current level before WC-L0F began.
- **Honest ceiling = 7/9 = 77.8%.** The remaining 2 session(s) have **0 responses** → no evidence → permanently un-backfillable (a concern-seed-only graph would fabricate behaviour and is refused). 80%+ is NOT reachable on this base without fabrication.

## Per-dimension presence (of 9 completed sessions)
- motivation: 3/9
- confidence: 6/9
- risk: 4/9
- engagement: 6/9
- adaptability: 1/9
- learning_style (categorical, never trended): 6/9

## Per-session detail
| session | type | resp | graph | #dims | mot/conf/risk/eng/adapt | learning_style |
|---|---|---|---|---|---|---|
| 0731f92c | owned | 10 | Y | 3 | 50/50/·/49/· | High emotional load |
| b883418d | owned | 10 | Y | 2 | ·/50/·/50/· | High emotional load |
| 7828d7a3 | owned | 10 | Y | 2 | ·/50/·/50/· | High emotional load |
| 4349237c | anon | 3 | Y | 3 | ·/39/50/37/· | High emotional load |
| 4c9b6c0b | anon | 3 | Y | 3 | ·/39/50/37/· | High emotional load |
| d0f54fc4 | anon | 0 | · | 0 | ·/·/·/·/· | · |
| a0924499 | anon | 0 | · | 0 | ·/·/·/·/· | · |
| 11111111 | owned | 0 | Y | 3 | 18/·/50/·/40 | · |
| 1cd9ca07 | owned | 10 | Y | 4 | 44/44/50/32/· | High emotional load |

**Coverage vs Confidence:** coverage = a dim value exists; it does NOT assert the value is high-confidence. Deficit-coded dims are capped at the neutral 50 (a concern signal may mark a construct impaired, never assert a strength).
