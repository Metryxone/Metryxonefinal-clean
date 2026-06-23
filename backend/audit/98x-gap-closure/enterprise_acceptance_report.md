# MetryxOne — Enterprise Acceptance Criteria: PASS / FAIL Report

**Date:** 2026-06-23
**Scope:** Evidence-backed adjudication of the *Additional Enterprise Success Criteria* spec.
**Method:** Read-only. Live shared PostgreSQL `count(*)` / structure queries
(`backend/scripts/audit-enterprise-acceptance.ts`) + code-flow traces. Every verdict cites
evidence. **Honesty contract:** Coverage (data exists) and Confidence (trustworthy / realized)
are reported as **separate axes**; nothing is fabricated; absence is reported as absence.

**Legend:** ✅ PASS · 🟡 PARTIAL · ❌ FAIL

---

## Headline verdict: 🟡 CONDITIONAL — strong architecture, NOT yet "Enterprise Ready"

The intelligence spine is architecturally connected end-to-end (Role DNA → blueprint → scoring →
employability → career/employer/passport), and the **taxonomy scale targets are met** (1040 roles,
206 industries). Blocking gaps remain: **adaptive difficulty is shadow-mode only (❌)**, **Role DNA
carries no role benchmarks and uses O\*NET-native competency types rather than the 5 normalized
genome types (🟡)**, **the validation loop has zero realized outcomes (🟡 by design)**, and several
consuming flows run **behind default-OFF flags** so the legacy paths are what execute by default.

---

## 1. ROLE RESOLUTION — 🟡 PARTIAL

**Required:** Industry → Function → Department → Role Family → Role resolves; no orphans at any level; 95%+ resolution.

| Check | Verdict | Evidence (live DB) |
|---|---|---|
| No orphan roles | ✅ | `0` roles with NULL/invalid `role_family_id` (of 1040) |
| No orphan role families | ✅ | `0` families with NULL/invalid `department_id` (of 31) |
| No orphan departments | ✅ | `0` departments with NULL/invalid `function_id` (of 43) |
| No orphan functions | 🟡 | `ont_functions` has **no `industry_id` FK column**; 13/30 flagged `is_cross_industry` — functions are intentionally industry-agnostic, so the **Industry→Function edge is not modeled** |
| No orphan industries | ✅ | 206 industries, all `is_active` |
| Full chain resolves | 🟡 | Role→Family→Dept→Function = **1040/1040 (100%)**; the top **Industry→Function** hop is absent by design |
| 95%+ resolution | 🟡 | **Hierarchy integrity only:** Function→Department→Role-Family→Role = **100%** (0 FK orphans); Industry→Function hop unmodelled. *(Competency-link coverage 1021/1040 is a Role-DNA metric — see §2, not hierarchy resolution.)* |

**Finding:** The lower 4-level hierarchy is fully referential-integrity clean. The single honest gap is
that **Industry→Function is not a hard relationship** (cross-industry model) — strict 5-level resolution
is therefore not enforceable without redefining functions as industry-scoped.

---

## 2. ROLE DNA — 🟡 PARTIAL

**Required per role:** Behavioral/Functional/Technical/Cognitive/Future-Skills competencies, required
proficiency, weights, benchmarks, readiness targets. **100%** competency / proficiency / weight inheritance.

| Check | Verdict | Evidence |
|---|---|---|
| Role DNA generated | 🟡 | **600** snapshots in `role_dna_expansion_snapshots`, all `confidence_band='high'`; **1021/1040 (98.2%)** roles have competency links — **19 roles have none** |
| 100% weight inheritance | 🟡 | `map_role_competency`: **0 NULL `weight`** across 52,362 active rows → 100% *for linked roles*, 98.2% of all roles |
| 100% proficiency inheritance | 🟡 | **0 NULL `min_proficiency` / `target_proficiency`** (52,362 rows) → same 98.2% role coverage |
| 100% competency inheritance | 🟡 | 1021/1040 roles inherit competencies; **19 unlinked** |
| 5 competency types per role | 🟡 | DNA `requirements[].competencyType` are **O\*NET-native** (`core` 12,340 · `functional` 10,409 · `behavioral` 9,357 · `domain` 5,408) — **not normalized** to the 5 genome types (behavioral/functional/technical/cognitive/future_skills); `technical`/`future_skills`/`cognitive` not distinctly tagged in DNA |
| Role benchmarks | ❌ | **0/600** DNA profiles carry a benchmark (`dna.benchmark.available=false` for all 600); `ti_role_benchmarks` holds only **60** rows, keyed by role-family (`rf_id`), not attached to the 1040 roles |
| Role readiness targets | 🟡 | Per-competency `targetProficiency` present on every requirement; **role-level** readiness target exists only via the 60 family benchmarks |

**Finding:** Inheritance of competencies/weights/proficiency is structurally perfect *where links exist*
(zero NULLs), but coverage is 98.2% not 100%, the **5-type normalization is incomplete** (O\*NET taxonomy
is passed through), and **per-role benchmarks are absent**.

---

## 3. O*NET INTELLIGENCE — 🟡 PARTIAL

**Required:** O\*NET Role/Competency/Industry/Function/Department/Role-Family mapping; 500+ validated
crosswalks; confidence scoring; manual-override framework; crosswalk governance; O\*NET as **reference,
not scoring**.

| Check | Verdict | Evidence |
|---|---|---|
| O\*NET Role mapping | ✅ | `map_role_competency`: 1021 roles mapped |
| O\*NET Competency mapping | ✅ | 52,362 role↔competency rows (159 distinct competencies) |
| O\*NET Industry/Function/Dept/Role-Family mapping | ❌ | O\*NET supplies **roles + competencies only**; the industry/function/dept/family hierarchy is curated/derived, **not O\*NET-sourced** |
| 500+ validated crosswalks | 🟡 | **Definition-dependent.** If "crosswalk" = **Role-DNA profile** (O\*NET role→competency): **600** confidence-scored profiles, target met. If "crosswalk" = **curated↔O\*NET role bridge** (`map_ont_onto_role`): only **5 rows (3 resolved)**, capped at curated `onto_roles`=5 — far below 500. Verdict 🟡 because the two readings diverge sharply; the 500+ target is met only under the broader Role-DNA reading. |
| Confidence scoring | ✅ | Every snapshot carries `confidence` + `confidence_band` |
| Manual override framework | 🟡 | Reversible `resolveCuratedBridges` / `rollbackBridgeResolution` exist; no admin UI for per-crosswalk override |
| Crosswalk governance | 🟡 | Provenance-stamped (`98x_phase1_expansion`) + reversible; no formal review/approval workflow |
| O\*NET reference not scoring | ✅ | Scoring authority is `onto_*` competency-runtime / `employabilityEngine.ts`; O\*NET only enriches Role-DNA requirements |

---

## 4. ASSESSMENT BLUEPRINT — ✅ PASS

**Required:** Blueprint generated from Role DNA (not question bank); Role→DNA→Competencies→Levels→Blueprint→Questions; no reverse generation.

- ✅ `services/blueprint-builder.ts` `deriveDimensionMix` / `buildBlueprint` derives a 5-dimension mix
  **from competency weights** in `onto_blueprint_competency_map` → `onto_blueprint_dimension_mix`;
  `competency-runtime.ts` `generateAssessment` then selects questions to fill it.
- ✅ Direction is forward (Role DNA → blueprint → questions); questions are selected *into* the blueprint,
  not the reverse.

**Finding:** The blueprint is genuinely Role-DNA-driven. PASS.

---

## 5. QUESTION GENERATION — ✅ PASS (with proficiency caveat)

**Required:** Each question has competency ref, competency type, difficulty, proficiency, question type,
scoring weight. No orphan questions / no missing competency / difficulty / scoring rule.

| Check | Verdict | Evidence |
|---|---|---|
| No orphan questions (competency) | ✅ | **0** rows with NULL/empty `competency_code` (74 total) |
| No questions without difficulty | ✅ | **0** rows with NULL `difficulty_band` |
| No questions without question type | ✅ | **0** NULL `question_type` (likert 35 · multiple_choice 31 · situational_judgment 8) |
| No questions without scoring rules | ✅ | Scoring weights authored at option level (`deriveOptions`, `competency-runtime.ts`) |
| Explicit proficiency level | 🟡 | No dedicated `proficiency_level` column — `difficulty_band` serves as proxy |

**Finding:** All four mandated orphan validations PASS. Caveats (not blocking the stated criteria):
bank is **small (74 templates, 43 approved)** and proficiency is a difficulty proxy.

---

## 6. ADAPTIVE ASSESSMENT — ❌ FAIL

**Required:** Difficulty adapts by Role Level / Experience / Role DNA / Required Proficiency; Junior /
Mid / Senior / Leadership produce **different difficulty distributions**.

- ❌ `services/adaptive-branching-engine.ts` is explicitly **"Phase 4, shadow-mode … Never affects
  assessment scoring or UI."**
- ❌ Runtime selection (`routes/competency-questions.ts` `selectQuestions`) uses **affinity scoring**
  (role/industry/stage tags), **not** difficulty adaptation by role level or proficiency.
- 🟡 Admins can manually author "stretch" difficulty variants (`generateDrafts`) — a content tool, not
  runtime adaptation.

**Finding:** No operative adaptive difficulty. Junior/Mid/Senior/Leadership do **not** produce different
runtime difficulty distributions. **This is the single clearest FAIL.**

---

## 7. SCORING — 🟡 PARTIAL

**Required:** Each assessment produces competency/category/readiness/gap/role-readiness/employability
scores; no scoring outside the approved framework; **single scoring authority**.

| Check | Verdict | Evidence |
|---|---|---|
| Score families produced | ✅ | competency + domain + readiness + gap (`competency-runtime.ts`); EI/employability (`employability-scoring-engine.ts`, Phase 3.3) |
| Single math authority | ✅ | EI formulas single-sourced in `employabilityEngine.ts` (per engineering canon); classifiers not duplicated inline |
| No duplicate scoring paths | 🟡 | **Dual persistence ledger**: `onto_competency_profiles` (runtime, append-only) + `onto_competency_score_runs` (normalized). Mitigated by `resolveUnifiedCompetencyProfile` which **UNIONs both** at read time |
| Live volume | — | `onto_competency_score_runs`=2 subjects; `onto_competency_profiles`=38 rows / 36 subjects (dev/demo) |

**Finding:** Scoring **math** has a single authority; **persistence** has two ledgers, reconciled at the
consumption layer (the Phase-2 unified contract). Honest PARTIAL.

---

## 8. CAREER BUILDER — 🟡 PARTIAL (architecture present · live execution unproven)

**Required:** Assessment Results → Competency Profile → Gap → Recommendations → Development Plan executes; no broken flow.

- ✅ Chain implemented: `competency-runtime.ts` (profile → readiness → gap minor/moderate/severe) →
  `lbi-recommendation-engine.ts` / `mei-recommendation-engine.ts` → development plan.
- ⚪ **Coverage axis:** `career_seeker_profiles`=0, `cg_user_recommendations`=0,
  `career_recommendation_history`=0 → no live executions yet (honest empty, not a break).

---

## 9. EMPLOYER INTELLIGENCE — 🟡 PARTIAL (competency-driven path present but default-OFF · data-empty)

**Required:** Assessment → Competency Profile → Role Match → Candidate Match → Hiring Rec; must **consume
competency intelligence**; no isolated hiring path.

- ✅ `services/employer-competency-hiring.ts` (Phase 3) `computeCompetencyDrivenMatch` consumes
  `resolveUnifiedCompetencyProfile` + `generateRoleDNA`; **fail-closed** to `heuristic_fallback` if no
  profile (never fabricates a match).
- 🟡 **Default-OFF flag** `employerCompetencyHiring` — so by default the **legacy heuristic**
  (`employer-hiring-intelligence.ts`) runs; the "no isolated hiring path" guarantee holds **only when the
  flag is ON**.
- ⚪ `employer_candidates`=0, `employer_jobs`=0 (no live employer data).

---

## 10. PASSPORT — ✅ PASS

**Required:** Assessment → Competency Intelligence → Career Passport synchronizes.

- ✅ `services/career-passport-bridge.ts` `syncPassportFromPlatform` aggregates CAPADEX + competency
  (P4) + employability (LBI) into a hashed snapshot; `POST /api/career-passport/:subject/snapshot`.
- ✅ `career_passport_snapshots` = **4 snapshots** present (sync has executed); companion `cpi_*` tables present.

---

## 11. VALIDATION LOOP — 🟡 PARTIAL (architected, zero realized outcomes — honest)

**Required:** Assessment → Hiring → Performance → Promotion → Retention → Outcome; future predictive
models traceable to outcomes.

- ✅ Architecture present: `career_outcomes`, `hiring_outcomes`, `interview_outcomes`,
  `ti_outcome_predictions`, `wc3_outcome_state/actions/models`, `pil_intervention_outcomes`,
  `tig_calibration` (Brier/ECE), `employer_candidates.predicted_prob_at_decision`.
- ✅ **Honest by design:** `services/pil/prediction-validation.ts` explicitly makes **no accuracy claim**
  until realized data exists (internal-validity checks only).
- ❌ **Coverage:** every outcome/calibration table is **0 rows** → no realized Hiring/Performance/Promotion/Retention outcomes captured yet.

**Finding:** The loop is fully architected and traceable; it cannot be validated empirically until real
outcomes accrue. Reported honestly as PARTIAL, not inflated.

---

## 12. ENTERPRISE SCALE — ✅ PASS

| Target | Verdict | Evidence |
|---|---|---|
| 1000+ Roles | ✅ | `ont_roles` = **1040** |
| 100+ Industries | ✅ | `ont_industries` = **206** |
| Multi-Tenant | ✅ | `tenants`=4 + `tenant_relationships` / `tenant_category_assignments` (Phase 6.11) + opt-in RLS (`tenant-isolation-enforcement.ts`) |
| Multi-Employer | ✅ | `employer_id` scoping across `employer_candidates`/`employer_jobs`/`employer_organizations` |
| Multi-Country | 🟡 | `region`/`country`/`location`/`currency` columns exist (INR default, USD/EUR supported); not full localization |
| Enterprise/University/Staffing/Government segments | ✅ | `comm_plans`/`comm_customers` segment logic: `career_builder`/`employer`/`institution`/`enterprise`/`government` |

---

## 13. FINAL ACCEPTANCE CRITERIA

| # | Criterion | Verdict | Basis |
|---|---|---|---|
| 1 | Role DNA drives assessment generation | ✅ | §4 blueprint-builder derives from DNA |
| 2 | Competencies drive questions | ✅ | §4/§5 dim-mix → competency-keyed selection |
| 3 | Proficiency levels drive difficulty | ❌ | §6 difficulty is a proxy; no proficiency→difficulty adaptation |
| 4 | Assessment drives scoring | ✅ | §7 competency-runtime |
| 5 | Scoring drives employability | ✅ | §7 employability-scoring-engine consumes competency scores |
| 6 | Employability drives career intelligence | ✅ | §8 career builder chain |
| 7 | Career intelligence drives development planning | ✅ | §8 dev plan in chain |
| 8 | Competency intelligence drives employer intelligence | 🟡 | §9 PASS but behind default-OFF flag |
| 9 | Passport receives competency intelligence | ✅ | §10 bridge |
| 10 | O\*NET enriches Role DNA | ✅ | §2/§3 DNA requirements sourced from O\*NET |
| 11 | No disconnected intelligence flows | 🟡 | flows connected; adaptive disconnected (§6); key consumers default-OFF |
| 12 | No duplicate scoring paths | 🟡 | §7 dual ledger, unified at read |
| 13 | No orphan competency mappings | ✅ | 0 NULL inheritance in 52,362 rows |
| 14 | No orphan role mappings | 🟡 | 0 FK orphans; 19/1040 roles lack competency links |
| 15 | No orphan question mappings | ✅ | §5 0 orphan questions |

**Tally:** 9 ✅ · 5 🟡 · 1 ❌ → **CONDITIONAL: not yet Enterprise Ready.**

---

## Remediation backlog to reach full PASS (priority order)

1. **❌ Adaptive assessment (§6):** promote `adaptive-branching-engine.ts` out of shadow-mode; key
   difficulty selection on role seniority + required proficiency so Junior/Mid/Senior/Leadership yield
   distinct difficulty distributions. *Largest single gap.*
2. **❌ Role benchmarks (§2):** attach per-role benchmarks (extend `ti_role_benchmarks` beyond 60 family
   rows, or derive role benchmarks) so `dna.benchmark.available` becomes true.
3. **🟡 5-type normalization (§2):** map O\*NET-native `core/domain` competency types onto the genome's
   5 types (behavioral/functional/technical/cognitive/future_skills) inside Role DNA.
4. **🟡 Role coverage (§1/§2/§13):** link the **19** unlinked roles to reach 100% inheritance.
5. **🟡 Flag activation (§9/§13):** enable `employerCompetencyHiring` (after volume) so the competency-driven
   hiring path is the default, not the legacy heuristic.
6. **🟡 Scoring ledger (§7):** continue routing all reads through `resolveUnifiedCompetencyProfile`; consider
   a single materialized scoring view to retire the dual-write perception.
7. **🟡 Validation loop (§11):** begin capturing real `hiring_outcomes` / `career_outcomes` so calibration
   (Brier/ECE) can move from internal-validity to empirical accuracy.
8. **🟡 Question bank scale (§5):** grow the 74-template bank to enterprise volume per competency × difficulty.

---

## Evidence reproducibility

All counts regenerate from `backend/scripts/audit-enterprise-acceptance.ts` (read-only). No data was
mutated by this audit. Code-flow verdicts (§4–§11) trace to the files cited inline.
