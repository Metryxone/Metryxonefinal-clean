---
name: P-X1 Shared Product Foundation
description: Cross-product audit finding — CAPADEX has built the shared intelligence infrastructure; EI and LBI do not consume it; CB consumes it partially.
---

## The central finding
CAPADEX has fully built the layers all three products need (WC-L5 memory 94 rows, WC-L0 user intelligence 9 rows, WC-L1 trend engine, career-behavior-adapter, intervention_library). EI and LBI are not consuming any of it. CB consumes it partially via career-behavior-adapter (data-starved but wired).

## Live DB facts (confirmed probe, 2026-06-10)
- `ei_snapshot_versions` = 0 (EI snapshots never taken; `takeSnapshot()` fn exists, no trigger)
- `lbi_scores` = 0 (calculateLBI() never called; G2 quick-win: add post-completion hook)
- `lbi_score_history` = TABLE ABSENT (longitudinal impossible)
- `wcl5_memory` = 94 rows, 7 types (CAPADEX memory: complete and ready to share)
- `wcl0_user_intelligence` = 9 rows (user store built for CAPADEX users)
- `career_recommendations` — `user_id` column ABSENT (session-keyed; bridge inactive)
- `career_memory_snapshots` = 0 rows (table may be absent; career-memory.ts is in-memory Map)
- `wc7c_*` tables = 0 tables exist (commercial activation layer not persisted)

## Baseline scores (from published audit scorecards)
- EI: 32% coverage / 23% confidence
- LBI: 25% coverage / 0% confidence
- Career Builder: 37% coverage / 17% confidence
- Post-F4 engineering ceiling (no data actions): EI ~49%, LBI ~50%, CB ~53%

## 10 shared capabilities (ranked by impact/effort)
Highest leverage (dims/day):
1. S3 Trend Engine flags (30 min, enables trends for 2 existing users)
2. S10 Auth Hardening + S8 Identity Hook (2-3 days, unblocks LBI scoring + CB bridge)
3. S6 User Intelligence Store consumer APIs (2 days, connects EI+LBI to wcl0)

Lowest leverage: S9 Report Integrity (product-specific, no reuse)

## Roadmap phases
- F1 (~6 days): Auth (S10) + Identity hook (S8) + LBI report tables
- F2 (~7 days): Snapshot + Persistence for EI/LBI/CB (S1+S2) + recs bridge (S4)
- F3 (~7 days): Intelligence activation — wcl0 consumers, personalization, memory, trend flags
- F4 (~7 days): Report integrity — EI formula reconciliation (CRITICAL), LBI AI guard, CB report

## Product-specific blockers (no shared-platform solution)
- EI: formula divergence (3 divergent formulas; GAP-1 CRITICAL) — requires reconciliation decision
- LBI: framework not seeded (19 domains, 0 rows; G1 CRITICAL) — requires content work
- CB: 0 job postings + 0 mentors (market/BD action; engineering cannot substitute)

## Why 70% is not reachable by engineering alone
70% coverage requires the data/market actions above PLUS all 4 engineering phases.
Engineering ceiling post-F4: EI ~49%, LBI ~50%, CB ~53%.

**Why:** The gap between engineering ceiling (~50%) and 70% target is filled only by real user data volume, occupation graph expansion, LBI framework content, and job/mentor supply — none of which are code problems.
