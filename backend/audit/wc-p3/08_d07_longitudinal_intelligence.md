# WC-P3 D07 — Longitudinal Intelligence Readiness

> Generated: 2026-06-10T14:15:54.253Z  
> Verdict: **EMPTY**

## Scores

| Axis | Score |
|------|-------|
| Structural Coverage | **15%** |
| Activation Confidence | **0%** |

### Coverage Rationale
progressLedger pure function exists. behavioural-memory route (DB-backed) exists with requireAuth ✅. career_memory_snapshots and career_trajectory_history tables exist in schema. CRITICAL: career-memory.ts uses an IN-MEMORY Map<string, Snapshot[]> — data resets on every server restart. Career memory snapshots never written to DB. trajectory/benchmarks history tables all 0.

### Confidence Rationale
career_memory_snapshots=0, career_trajectory_history=0, career_benchmarks_history=0, career_growth_patterns=0. behavioural_memory=0. All longitudinal tables empty. progressLedger returns null for all users (needs ≥2 snapshots). Career Memory tab shows in-memory data only.

## Gaps

- [ ] CRITICAL: career-memory.ts uses in-memory Map — data lost on every server restart
- [ ] career_memory_snapshots: 0 rows (DB table exists but is never written)
- [ ] progressLedger requires ≥2 DB snapshots — currently 0 for all users
- [ ] career_trajectory_history: 0 rows
- [ ] career_benchmarks_history: 0 rows
- [ ] career_growth_patterns: 0 rows
- [ ] No snapshot-write trigger anywhere in career builder flows

---
*Coverage = structural completeness; Confidence = real data activation (separate axes).*
