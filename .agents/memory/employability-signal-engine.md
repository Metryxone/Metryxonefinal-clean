---
name: Employability Signal Engine (Phase 3.8)
description: How higher-order employability signals are composed from domain-proxy competency scores, and the honesty rules that keep them from firing on partial evidence.
---

# Employability Signal Engine (competency-ei Phase 3.8)

Composes measured competency strengths/weaknesses into curated higher-order signals
(Leadership Potential, Innovation Potential, Career Risk). Same `competencyEi` /
`FF_COMPETENCY_EI` flag as the rest of the 3.x chain.

## Architecture decisions (durable)
- **library + rules are CODE-defined catalogs, NOT DB tables.** This is the only way to
  keep flag-OFF byte-identical with ZERO DDL — consistent with every 3.4–3.7 engine in
  this chain. Do not "promote" them to tables to add a signal; just edit the catalog.
- **No `ei_dimensions` table exists.** Proficiency is read via the SAME domain-PROXY the
  role/industry/function readiness engines use: competency → `onto_competencies.domain_id`
  → subject's measured `onto_domain` scaled_score (gated by `MEASURABLE_ONTO_DOMAINS`).
  Mirror `function-readiness-engine.ts` exactly (it uses `d.level`; signals use
  `d.scaled_score` — both are real `DomainScore` fields).
- Multiple competencies can collapse to ONE domain proxy (the Leadership trio
  Communication/Collaboration/Leadership all map to `dom_interpersonal`). Disclose via
  per-signal `distinct_domains`, never hide it — until finer-grained competency scoring
  is populated those competencies share a score.

## Honesty contract (the part that's easy to get wrong)
- A signal NEVER fires on partial evidence. Status precedence in `computeEmployabilitySignals`:
  `unmeasured` (0 measured) → `not_met` (any MEASURED condition fails — wins even if others
  unmeasured, because it can never fire) → `indeterminate` (no measured failure but some
  unmeasured) → `fired` (all measured AND satisfied). Get the not_met-over-indeterminate
  precedence right or you over-claim.
- Coverage (measured/total conditions) and firing are SEPARATE axes. Unmeasured condition →
  `actual_score: null`, never a fabricated 0.
- never-throws: a `getProfile` / metadata lookup failure degrades to an honest unmeasured
  payload. Confidence is INHERITED from `buildEiProfile`, never invented.

**Why:** the platform-wide rule is Coverage (data exists) vs firing/Confidence are distinct,
null+reason never fake-0, and developmental signals are NEVER hiring/promotion verdicts.

## Surface
- `backend/services/{signal-library,signal-rules,employability-signal-engine}.ts`.
- Routes in `backend/routes/competency-ei.ts`: `GET /api/competency-ei/signal-catalog`
  (read-only, no DB) + `GET /api/competency-ei/employability-signals/:subject`, both
  `gate → requireAuth → requireSuperAdmin → wrap`.
- UI section in `EiProfileDashboardPanel.tsx` (after Function Readiness).
- Verified live: demo_subj_pm & t4-precise-demo FIRE Leadership Potential; demo_subj_swe is
  unmeasured/indeterminate/not_met. Thresholds: strong ≥65, low <50.
