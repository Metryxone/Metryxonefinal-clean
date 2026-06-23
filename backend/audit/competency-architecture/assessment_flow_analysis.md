# Assessment Flow Analysis (Step 3)

> End-to-end trace of the competency assessment pipeline, with the concrete file/function/table at each hop and the missing/broken links. Source: code trace + live row counts (2026-06-23).

## The intended flow
```
Role
 ↓  resolveBestOntRole (role-crosswalk.ts)
Competency Profile (role requirements)
 ↓  getRoleCompetencyProfile (role-competency-profile.ts)
Question Selection
 ↓  buildAssessment (assessment-assembly.ts)
Assessment Blueprint
 ↓  getBlueprint (assessment-foundation-mapping.ts)
Assessment Execution
 ↓  generateAssessment (competency-runtime.ts)
Scoring
 ↓  scoreAssessmentRun (competency-scoring.ts)
Employability Index (EI)
 ↓  computeEmployabilityIntelligence (competency-employability-engine.ts)
Career Builder
     buildCareerIntelligence (career-intelligence-bridge.ts)
```

## Hop-by-hop, with live data

| # | Stage | Implementation | Table(s) (rows) | Healthy? |
|---|---|---|---|---|
| 1 | **Role** | `role-crosswalk.ts → resolveBestOntRole` | `onto_roles` (5), `ont_roles` (1,040) | ⚠️ Only 5 curated roles. O*NET has 1,040 but they reach scoring only via name-bridge. |
| 2 | **Competency Profile** | `role-competency-profile.ts → getRoleCompetencyProfile` | `onto_role_competency_profiles` (14), `onto_role_weights` (44) | ⚠️ 14 profiles for 5 roles — thin but functional. |
| 3 | **Blueprint** | `assessment-foundation-mapping.ts → getBlueprint` | `onto_assessment_blueprints` (6), `onto_blueprint_competency_map` | ✅ present |
| 4 | **Question Selection** | `assessment-assembly.ts → buildAssessment` | `onto_question_blueprints` (7), `onto_question_competency_mapping` (23), `competency_question_templates` (74) | ⚠️ **Loosely coupled** (see Gap 1). |
| 5 | **Execution** | `competency-runtime.ts → generateAssessment` | `onto_assessment_instances` (45), `onto_assembled_assessments` | ✅ runs |
| 6 | **Scoring** | `competency-scoring.ts → scoreAssessmentRun` | `onto_assessment_responses` (54), `onto_competency_score_runs` (2), `onto_competency_profiles` (38) | ⚠️ **Dual ledger** (see Gap 4). |
| 7 | **Employability Index** | `competency-employability-engine.ts → computeEmployabilityIntelligence` | `cei_employability_snapshots`, `dimension_weight_rules` | ✅ composes |
| 8 | **Career Builder** | `career-intelligence-bridge.ts → buildCareerIntelligence` | read-only; snapshot in `ei_profile_snapshots` | ⚠️ **Read-only, no writeback** (see Gap 3). |

---

## Missing / broken links

### Gap 1 — Blueprints are authored but only partially consumed
`onto_question_competency_mapping` (the precise blueprint→question link) exists, but `competency-runtime.ts` still falls back to a **legacy "domain-proxy" path** (COG/COM/… 7-code crosswalk down to 5 onto-domains) for much of execution. The precise blueprint is bypassed unless `onto_competency_question_map` (25 rows) is fully populated. **Effect:** the carefully authored blueprint isn't fully what drives the delivered test. (Matches memory: "domain_proxy score auto-upgrades when `onto_competency_question_map` populated.")

### Gap 2 — Role *required levels* don't constrain question *difficulty*
`onto_role_competency_profiles` defines required proficiency per competency, but `assessment-assembly.ts` allocates questions by blueprint composition, not by matching question difficulty to the role's required level. The link is *informational*, not *enforced*. **Effect:** a Senior-role assessment isn't guaranteed to be harder than a Junior one.

### Gap 3 — Career Builder is a read-only terminus
`career-intelligence-bridge.ts` composes EI/competency into the Career Builder but does **not** write progression back into the Career Seeker profile without an explicit snapshot capture. **Effect:** completing a competency assessment does not automatically advance a candidate's career-builder state — a human/explicit step is required.

### Gap 4 — Two scoring ledgers must be unioned
Rich scorer writes `onto_competency_score_runs` (2); runtime `scoreInstance` writes `onto_competency_profiles` (38). Any "how many subjects scored?" query that hits only one ledger under-counts. Not a break, but a reporting trap (documented in memory).

### Gap 5 — Volume is pilot-scale, not production
45 instances / 54 responses / 2 score-runs total. The pipeline **works** but has barely been exercised. Norms, benchmarks (`ont_benchmarks`=0), and percentile distributions (`competency_percentile_distributions_v2`=0) are therefore empty — any benchmark output is currently un-grounded.

---

## Honest verdict
The **happy path is wired end-to-end and demonstrably runs** (instances + responses + scores exist). The weaknesses are (a) the precise blueprint is shadowed by a legacy domain-proxy, (b) role-required-level → question-difficulty is not enforced, (c) Career Builder doesn't auto-advance, and (d) everything is pilot-volume so norms are empty. None of these require a rebuild — they are *finishing* tasks on an existing spine.
