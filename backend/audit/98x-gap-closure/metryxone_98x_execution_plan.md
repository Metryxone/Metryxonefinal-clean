# MetryxOne 98% Execution Plan (Gap Closure)

**Task:** MX-98X-GAP-CLOSURE-IMPLEMENTATION · Phase 8 + Final Output
**Date:** 2026-06-23 · Master plan over Phases 1–7. All items additive, backward-compatible, reversible, flag-gated.

## 1. Gap Closure Plan (per capability)

| # | Capability | Current | Target | Implementation | Deps | Risk | Impact | Priority | Success criteria |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Architecture connectivity | 78% struct / 28% activ | 98% | wire phases below | — | L | very high | P0 | downstream consumers read canonical competency profile |
| 2 | Competency Framework | canonical, 419 comps | maintain | no change (preserve) | — | L | — | — | genome untouched |
| 3 | Role DNA | 5/1040 surfaced | ≥95% coverage | **Phase 1** engine (coverage+confidence+inherit+DNA gen+materialize) | — | M | very high | **P0** | confidence-scored DNA for O*NET roles w/ links |
| 4 | Assessment | operational | maintain + route employer/CB through it | Phase 3/4 | P2 | L | high | P1 | candidate scored via `onto_assessment_blueprints` |
| 5 | Scoring | dual ledger | unified read | **Phase 2** contracts | — | L | high | **P0** | UNION resolver; no parallel recompute |
| 6 | Employability Index | operational | maintain (formulas frozen) | no change (preserve) | — | L | — | — | EI math untouched |
| 7 | Career Builder | content seeded, user empty | generate per-user | **Phase 4** activation + hook | P1,P2 | M | high | P1 | `cg_user_*` populated |
| 8 | Career Passport | architecture exists | maintain + sync | reuse `syncPassportFromPlatform` | P4 | L | med | P2 | passport reflects new intelligence |
| 9 | Employer Intelligence | heuristic, 0 competency | competency-driven | **Phase 3** | P1,P2 | M | high | P1 | match reads `onto_*`, not lbi/cra |
| 10 | Workforce Intelligence | pilot tenants | real-tenant scaffolding | Phase 7 | P7 | M | med | P2 | tenant capability profiles populated |
| 11 | Market Intelligence | signals exist, unused | cross-feed into DNA | Phase 1→3 cross-feed | P1 | L | med | P2 | `m3_*`/`frp_*` feed role intelligence |
| 12 | Predictive Intelligence | built, unvalidated | validated loop | **Phase 6** | P3 | M | high | P1 | models calibrated on real outcomes |
| 13 | Competency→Skill | no crosswalk | mapped chain | **Phase 5** | — | L | med | P2 | confidence-scored comp↔skill map |
| 14 | Global Scale | multi-tenant, single-locale | international layer | **Phase 7** | — | M | med | P3 | country/occupation crosswalk + currency |

## 2. Architecture Impact Assessment
- All phases add **new** services + flag-gated route modules that **compose** existing engines. Zero edits to canonical engines (genome, EI formulas, Career Builder core UI, scoring math). Each flag-OFF path is byte-identical to today.

## 3. Data Impact Assessment
- **No destructive migrations. No existing column altered.** New work is either read-only (Phase 2) or writes to **new dedicated tables** (Phases 1,5,6,7) / **existing-but-empty** `cg_user_*` (Phase 4), always stamped with provenance for reversibility. Curated `onto_*`, O*NET `ont_*`/`map_role_competency`, and EI tables are never mutated.
- Lazy ensure-schema runs **only on write/POST paths**; GETs use `to_regclass` probe + degrade (no DDL on reads).

## 4. API Impact Assessment
- All new endpoints under `/api/v2/*`, additive, flag-OFF → 503. No existing route signature, base, or response shape changes. IDOR guards (`resolveEffectiveUserId` / session scope) applied at route level.

## 5. Rollback Strategy
- **Per phase:** set its flag OFF → routes 503, hooks no-op → byte-identical legacy behaviour.
- **Data:** delete generated rows by `provenance` stamp; drop net-new tables. No reverse migration needed (no existing schema changed).
- **Order:** roll back in reverse dependency order (7→1) if needed.

## 6. Success Metrics (platform)
- Role DNA coverage ≥95% of competency-linked O*NET roles (Phase 1).
- 0 parallel scoring recomputation; unified read correctness (Phase 2).
- Employer matches + Career Builder users backed by real `onto_*` profiles (Phases 3,4).
- Real outcomes captured → models move to `calibrated` (Phase 6).
- 100% flag-OFF parity on all pre-existing routes (query-spy proof) across phases.
- 0 fabricated metrics (every absence surfaced as null/UNCLASSIFIED/provisional).

## 7. Expected Maturity Improvement
| Horizon | Activation maturity |
|---|---|
| Now | ~28% |
| +30d (Phase 1 + Phase 2) | ~45% |
| +90d (Phases 3–5) | ~70% |
| +180d (Phases 6–7 + real data depth) | **~95–98%** |

**Maturity percentages are reasoned estimates from the measured Structural/Activation axes — directional, not load-tested metrics.** True predictive-accuracy and real-data-depth maturity are time-and-data-gated and must not be overclaimed.

## Sequencing (MoSCoW)
- **Must (P0, now):** Phase 1 Role DNA, Phase 2 spine contracts.
- **Should (P1):** Phase 3 employer, Phase 4 Career Builder, Phase 6 validation.
- **Could (P2):** Phase 5 comp→skill, Phase 8 passport sync, workforce/market cross-feed.
- **Won't-yet (P3):** Phase 7 global scale depth (scaffolding only until real multi-country tenants).

## Evidence ledger
- All counts → live shared-DB `count(*)`, 2026-06-23 session. Engine facts → explorer trace this session + memory + prior `backend/audit/competency-onet-validation/*.md` (`da07dd93`). Priorities/risk/impact/maturity are author estimates, not measured metrics.
