# WC-P2 — D08: Longitudinal Readiness
Generated: 2026-06-10T13:48:42.827Z

## Verdict: ❌ NONE — No Longitudinal Infrastructure

LBI has no longitudinal (trend / snapshot / historical) capability in any of its three systems.

## System A Longitudinal State

| Aspect | State |
|--------|-------|
| lbi_scores table | Single UPSERT per user — previous values **overwritten** on each recalculation |
| History table | DOES NOT EXIST (`lbi_score_history`, `lbi_snapshots`, etc. — none created) |
| Snapshot trigger | None — no hook calls calculateLBI() automatically |
| Trend computation | No endpoint or engine |
| Score deltas | Not tracked |

**Impact**: When calculateLBI() is eventually called for an existing user, the previous
score is silently overwritten. There is no way to show a user "your LBI went from 45 → 68
over 3 months."

## System B Longitudinal State

| Aspect | State |
|--------|-------|
| lbi_domain_scores | 0 rows — single-session scores, no history |
| lbi_subdomain_scores | 0 rows |
| lbi_overall_index | 0 rows |
| Version tracking | lbi_versions = 0 rows — no versioned score history |
| Trend engine | Not implemented |

## System C Longitudinal State

Session history exists conceptually (multiple sessions per student possible) but:
- 6-month lockout prevents frequent re-assessment by design
- No trend aggregation route (e.g. `GET /api/lbi/students/:id/trend`)
- student_assessment_sessions has created_at but no trend engine consumes it
- 0 sessions → moot

## Comparison with WC-P1 (Employability Index)

| Feature | EI | LBI |
|---------|-----|-----|
| Snapshot table | ei_snapshot_versions | None |
| Auto-snapshot trigger | Coded but not called | Not coded |
| Trend route | Exists | Not implemented |
| Longitudinal snapshots | 0 | 0 |

LBI is behind EI: EI has a snapshot mechanism that is not called; LBI has no snapshot
mechanism at all.

## Longitudinal Readiness: 0%
No snapshot, no history, no trend engine exists. This is a greenfield build requirement.
