---
name: EI Dashboard engine (Phase 3.10)
description: Consolidated EI dashboard that composes every prior EI engine once + a trend sub-engine, projected into candidate/admin audience views.
---

# EI Dashboard (compose-once, two audience projections)

The dashboard is a **pure composition layer** over the prior EI engines. One
`buildEiDashboard` calls each upstream engine **exactly once**
(buildEiProfile, computeRoleReadinessV2, listIndustryReadiness,
listFunctionReadiness, computeEmployabilitySignals,
computeEmployabilityRecommendations) plus `listEiProfileHistory` for trend.

**Rule: candidate/admin views are PURE projections of one composed result —
they must NOT re-call the engines.** `buildCandidateEiDashboard` /
`buildAdminEiDashboard` call `buildEiDashboard` once then `projectCandidate` /
`projectAdmin` (pure, no pool). This is the compose-never-recompute contract.

**Why:** re-deriving per audience would double DB load and risk drift between
the two views; a single composition guarantees both audiences see the same
numbers, differing only in redaction.

## Trend Analysis honesty (computeEiTrend, pure)
- Anchors a trend on **measured** snapshots only (`ei_score != null`). NULL stays
  NULL — never coerced to a fake 0 datapoint (a NULL snapshot is NOT a measured 0).
- `< 2` measured points → `status:'insufficient_history'`, `direction/delta null`.
  Never fabricate a slope from one point.
- Snapshots are **user-captured** (explicit POST), so trend reflects captured
  history, not a continuous stream — disclosed in the `message`.
- `STABLE_BAND = 1.0` pt: |delta| ≤ 1 → stable, else improving/declining.

## Audience redaction boundary
- **candidate**: encouraging headline, top-3 strengths/focus areas, readiness
  bests, fired signals as supportive insights, emitted recs, trend points,
  a developmental-only disclaimer. **No `diagnostics` key.** Unmeasured →
  honest `status:'unmeasured'` friendly copy (never fabricated).
- **admin**: full composed object + a `diagnostics` block (per-section coverage,
  ledger counts, `data_availability[]` with reason). Coverage vs firing stay
  SEPARATE axes.

## How to apply
- Each engine call is `.catch`-guarded with a section fallback → never-throws;
  one bad engine degrades only its own section.
- The engine defines **NO schema/DDL** — byte-identical flag-OFF is enforced by
  the route gate (`gate → requireAuth → requireSuperAdmin`).
- Field names matter: dimensions use `ei_dimension_id`/`dimension_name`; signals
  use `signal_id`/`name`/`polarity`/`rationale`; recs use `title`/`description`.
  Don't guess camelCase aliases.
