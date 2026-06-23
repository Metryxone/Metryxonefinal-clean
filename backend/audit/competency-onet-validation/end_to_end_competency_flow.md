# End-to-End Competency Flow

**Task:** MX-COMPETENCY-ONET-ARCHITECTURE-VALIDATION · Section 3
**Date:** 2026-06-23 · Read-only. Live row counts inline.

Tracing the canonical chain stage by stage. For each: **Tables · Service · API · Runtime consumer · Status**. Status = ✅ working · 🟡 partial/weak link · ⬜ missing/empty.

```
Industry → Function → Department → Role Family → Role → Competency Profile →
Assessment Blueprint → Question Mapping → Assessment → Scoring →
Employability Index → Career Builder → Career Passport → Employer Portal
```

---

## Stage-by-stage

### 1. Industry  🟡
- **Tables:** `onto_industries` (**2**) canonical · `ont_industries` (**206**) reference
- **Service/API:** `competency-framework-intelligence.ts` `getTaxonomy` · `/api/ontology/taxonomy`
- **Consumer:** search/discovery, market intelligence
- **Link health:** modelled correctly; **curated side is seed-starved (2 rows)** — real breadth only on the O*NET reference side.

### 2. Function  🟡
- **Tables:** `onto_functions` (**3**) · `ont_functions` (**30**)
- Same service/API as above. Same seed gap.

### 3. Department  🟡 **(naming conflict)**
- **Tables:** `onto_subfunctions` (**4**) canonical · `ont_departments` (**43**) reference
- **Broken link:** the SAME tier is called **"subfunction"** on the curated side and **"department"** on the O*NET side. `getTaxonomy` maps them as one tier, but any UI or new join that assumes a single name will mis-traverse. **Rename to one canonical label.**

### 4. Role Family  ✅ (thin)
- **Tables:** `onto_role_families` (**4**) · `ont_role_families` (**31**) · LEGACY `role_families` (10), `gro_role_families` (0)
- **Duplicate link:** 4 role-family namespaces. Curated path works but is thin.

### 5. Role  ✅ + 🟡 bridge
- **Tables:** `onto_roles` (**5**) canonical · `ont_roles` (**1,040**) reference · `cg_roles` (200) Career Graph · LEGACY `role_definitions` (10), `gro_canonical_roles` (12), `m3_market_roles` (5), `wos_roles` (5)
- **Service:** `role-crosswalk.ts` (title/id → `ont_roles` code), `map_ont_onto_role` (**5** rows)
- **Weak link:** only **5 of 1,040** O*NET roles bridged to curated → 99.5% of the O*NET library cannot reach the scoring path. **The crosswalk is the chokepoint of the whole flow.**

### 6. Competency Profile (role → required competencies)  ✅ (pilot) + 🟡 dual source
- **Tables:** `onto_role_competency_profiles` (**14**) canonical requirements · `map_role_competency` (**52,362**) O*NET estimation
- **Service:** `role-competency-profile.ts` `getRoleProfile`
- **Consumer:** role readiness, role fit, blueprint generation
- **Duplicate link:** two role→competency sources (curated 14 vs O*NET 52,362) that **don't reconcile** (only 5 roles overlap via the crosswalk). The runtime reads the curated 14; the rich O*NET 52,362 is mostly unreachable for scoring.

### 7. Assessment Blueprint  ✅ + 🟡 shadowed
- **Tables:** `onto_assessment_blueprints` (**6**) + `onto_question_blueprints` (**7**) canonical · LEGACY `assessment_blueprints` (0), `assessment_templates` (15), `assessment_template_questions` (150)
- **Weak link:** the precise blueprint exists but is **shadowed by a legacy "domain-proxy" shortcut** in the runtime (the 7-code bank crosswalks DOWN to 5 onto-domains instead of using the per-question blueprint). Role-level → question-difficulty is **not enforced**.

### 8. Question Mapping  ✅ (pilot)
- **Tables:** `onto_question_competency_mapping` (**23**), `competency_question_templates` (**74**), `onto_question_blueprints` (7)
- **Consumer:** `GET /api/competency/questions/select` → static `ADAPTIVE_QUESTION_BANK_V2` fallback
- **Duplicate link:** 3 "questions" surfaces (V1 bank, O*NET `ont_assessment_questions`=16 unused, legacy `assessment_template_questions`=150). Canonical path is the V1 bank.

### 9. Assessment (runtime)  ✅ pilot-scale
- **Tables:** `onto_assessment_instances` (**45**), `onto_assessment_responses` (**66**)
- **Service:** `competency-assessment-runtime.ts`, `competency-runtime(-v2).ts`
- **Weak link:** runtime still uses a hardcoded `COMPETENCY_META` map in places instead of reading the genome. Volume is pilot-grade (45 instances).

### 10. Scoring  ✅ (dual ledger)
- **Tables:** `onto_competency_score_runs` (**2**, rich scorer) + `onto_competency_profiles` (**38**, runtime `scoreInstance`)
- **Trap:** two ledgers — any "scored subjects" metric must **union both** or runtime-scored subjects read as unscored.

### 11. Employability Index  ✅
- **Service:** `employabilityEngine.ts` (single 8-dim formula authority)
- **Consumer:** EI dashboard, trajectory
- **Link health:** consumes scoring output cleanly; no table sprawl. Good.

### 12. Career Builder  🟡 one-way
- **Tables/Service:** `cg_*`, `useCareerBrain.ts`, `lib/intelligence/*`
- **Link health:** **reads** competency intelligence but does **not write back** — there is no Career-Builder → competency-framework return edge. Acceptable today, but means Career Builder activity never enriches the genome.

### 13. Career Passport  ✅
- **Tables:** `cp_*` (12) · **Service:** `syncPassportFromPlatform`
- **Link health:** bridges competency/frp/capadex into the passport snapshot; visibility-gated. Working.

### 14. Employer Portal  ⬜ disjoint + empty
- **Tables:** `employer_jobs` (**0**), `employer_candidates` (**0**), `employer_company_profiles` (**0**)
- **Service:** `employer-hiring-intelligence.ts` (`analyzeRole`, `generateInterviewBlueprint`), TIG (`tig_*` = 0)
- **Broken link (architectural):** the employer hiring path consumes `lbi_scores` (0) + `cra_scores` (0) + a hardcoded `DEPT_BEHAVIORAL_PROFILES` heuristic — **NOT** `onto_competency_profiles`. So the candidate's *actual competency assessment result does not flow into the employer's hiring view.* This is the single biggest broken link in the chain. Detail in `employer_customization_readiness.md`.

---

## Link-health summary

| Link | Status |
|---|---|
| Industry→Function→Department→RoleFamily→Role | 🟡 modelled, curated seed-starved + department naming conflict |
| Role → O*NET library (crosswalk) | 🟡 only 5/1,040 bridged — **chokepoint** |
| Role → Competency Profile | 🟡 two unreconciled sources (14 curated vs 52,362 O*NET) |
| Blueprint → Question → Assessment | 🟡 blueprint shadowed by domain-proxy; level→difficulty not enforced |
| Assessment → Scoring → EI | ✅ working (pilot volume, dual ledger) |
| EI → Career Builder → Passport | ✅ / 🟡 (Career Builder one-way) |
| **Scoring → Employer Portal** | ⬜ **broken** — employer uses LBI/CRA/heuristic, not the competency score |

## The 3 missing links worth fixing (in priority order)
1. **Scoring → Employer Portal:** route `onto_competency_profiles` into `employer_candidates.competency_profile` so assessed competency flows to hiring. (Highest value.)
2. **Crosswalk expansion:** `map_ont_onto_role` 5 → many, so the 1,040-role O*NET library reaches role-requirement estimation.
3. **Blueprint enforcement:** retire the domain-proxy shortcut so role level drives question difficulty.

## The 2 broken/duplicate links worth resolving
- **Department naming conflict** (`onto_subfunctions` vs `ont_departments`).
- **Two role→competency sources** that don't reconcile — declare curated canonical, O*NET estimation-only, in the UI.
