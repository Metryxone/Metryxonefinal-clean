# §1 — Enterprise Acceptance Gap Closure

**Task:** MX-99X Enterprise Competency Certification · **Date:** 2026-06-23
**Method:** Read-only. Live counts from `backend/scripts/audit-99x-certification.ts`. Honesty-first:
Coverage (data exists) and Confidence (trustworthy / realized) are **separate axes**; nothing fabricated.

---

## Headline: target PASS=12/12 is NOT honestly attainable today

The spec sets **PASS=15 / PARTIAL=0 / FAIL=0**. After re-evaluation against live evidence, the honest
12-domain certification rollup is **PASS 3 · PARTIAL 8 · FAIL 1**. Several gaps are closable by additive,
flag-gated work; **but the Validation Loop cannot reach PASS by code at all** — it requires *realized*
hiring/performance/promotion/retention outcomes, and those tables are empty (0 rows). Fabricating them
would violate the platform's first rule. That axis stays an honest PARTIAL until real production data accrues.

> **Reconciliation with MX-98X:** the prior audit's *9 PASS / 5 PARTIAL / 1 FAIL* was scored across the
> **15 final-acceptance drive-link checks** (mostly architectural "X drives Y" claims). This report scores
> the **12 enterprise domains** with **data + activation weighted equally to architecture** — a stricter
> lens, hence more PARTIALs. Both tallies are honest; they measure different things.

---

## 12-domain certification verdicts

| # | Domain | Verdict | Evidence (live) |
|---|---|---|---|
| 1 | Role Resolution | 🟡 PARTIAL | Function→Dept→Family→Role **100%** (0 orphans); Industry→Function hop **unmodelled** (`ont_functions` has no `industry_id` FK) |
| 2 | Role DNA | 🟡 PARTIAL | Inheritance 0-NULL for **1021/1040** linked roles; **600/1040** have expansion snapshots; **0/600 benchmarks**; 19 unlinked |
| 3 | O\*NET Intelligence | 🟡 PARTIAL | Role+competency mapping strong (52,362 rows); hierarchy **not O\*NET-sourced**; curated crosswalk **5 rows, 0 verified** |
| 4 | Assessment Blueprint | ✅ PASS | Blueprint derived from Role DNA competency weights (`blueprint-builder.ts`), forward direction |
| 5 | Question Mapping | 🟡 PARTIAL | **Integrity PASS** (0 orphan/no-difficulty/no-type of 74); **Coverage low** — only **14** distinct competencies have questions |
| 6 | Adaptive Assessment | ❌ FAIL | `adaptive-branching-engine.ts` is **shadow-mode**; no runtime difficulty adaptation by role level |
| 7 | Scoring | 🟡 PARTIAL | Single math authority; **dual persistence ledger** unified at read; live volume low (2 runs / 38 profiles) |
| 8 | Career Builder | 🟡 PARTIAL | Chain implemented; **0 live executions** (`career_seeker_profiles`=0) |
| 9 | Career Passport | ✅ PASS | Sync bridge present; **4 snapshots** materialized |
| 10 | Employer Intelligence | 🟡 PARTIAL | Competency-driven path present but **default-OFF** flag; employer data 0 |
| 11 | Validation Loop | 🟡 PARTIAL | Outcome→Calibration→Prediction wired; **all outcome tables 0 rows**; no accuracy claimed (honest) |
| 12 | Enterprise Scale | ✅ PASS | **1040** roles ≥1000; **206** industries ≥100; multi-tenant/employer/segment |

**Tally: PASS 3 · PARTIAL 8 · FAIL 1.**

---

## Gap closure: closable-by-code vs data-gated

### A. Closable additively (flag-gated, reversible) — engineering, can move to PASS
*(Report § = the section report covering this gap, to avoid collision with the 12-domain numbering above.)*

| Gap | Action | Report § |
|---|---|---|
| Adaptive inactive (FAIL) | Promote `adaptive-branching-engine` out of shadow-mode; key difficulty on role seniority + required proficiency | §5 (adaptive) |
| 0/600 benchmarks | Derive per-role benchmarks (extend `ti_role_benchmarks` beyond 60 family rows) so `dna.benchmark.available=true` | §2 (role DNA) |
| `future_skills`=0, `technical`=18 | Author/curate members for the sparse types (never fabricate — curate from genome) | §6 (normalization) |
| 19 unlinked roles | Run inheritance for the 19 roles to reach 100% | §2 (role DNA) |
| Question coverage 14 competencies | Expand `competency_question_templates` per competency × difficulty | §4 (assessment) |
| Snapshot coverage 600/1040 | Expand Role-DNA snapshots to all 1040 roles | §2 (role DNA) |
| Employer path default-OFF | Enable `employerCompetencyHiring` (after volume) | §9 (employer) |

### B. Data-gated — NO code can close these; require real production usage over time
| Gap | Why code cannot fix it |
|---|---|
| Validation loop = 0 realized outcomes | Needs real hires + performance/promotion/retention events captured longitudinally |
| Calibration uncalibrated | Brier/ECE require **≥30 realized outcomes** |
| Predictive empirical accuracy | Cannot be claimed until realized outcomes exist (engine correctly abstains) |
| Career/Employer live execution | Requires real candidates/jobs/seekers using the platform |

**Conclusion:** Domain rollup can credibly reach **PASS ~8–9 / PARTIAL ~3–4 / FAIL 0** after the
Section-A additive phases (each stop-for-approval). The remaining PARTIALs are **honest data-maturity
gaps**, not defects — they close only as the platform is used in production.

*Evidence regenerates from `backend/scripts/audit-99x-certification.ts` (read-only).*
