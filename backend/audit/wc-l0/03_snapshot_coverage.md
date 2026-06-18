# Deliverable 3 — Lever 3: Longitudinal Snapshot Engine
_Generated 2026-06-08T16:14:33.115Z_

Ensures every completed assessment has at least one longitudinal snapshot, delegating to the existing
`captureLongitudinalSnapshot` (history capture only) — captures only when none exists, so sequential
re-runs add no duplicates (presence is guaranteed; the append-only table has no uniqueness constraint).

## Metrics (completed sessions, N=9)
| Metric | Value | Definition |
|---|---|---|
| Snapshot Coverage | **9/9 (100.0%)** | completed session has a snapshot row |
| Snapshot Integrity | **9/9 (100.0%)** | snapshot has required fields (concern + score) |

> Snapshot Coverage reaches the target because the required inputs (concern / stage / score) are
> already stored for every completed session — the snapshot composes existing data, never fabricated.
> Multi-session TREND analytics remain a downstream consumer (needs ≥2 snapshots per user); this
> foundation guarantees the snapshots exist so trends can form as users return.
