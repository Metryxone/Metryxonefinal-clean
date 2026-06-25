# MX-201 — Competency Genome Completion · Phase 1+2 Audit

_Read-only audit generated 2026-06-25T05:28:40.146Z. No data was written or fabricated._

**Canonical genome:** `onto_competencies` — **419 live competencies** (TEXT ids, e.g. `comp_accountability`).

## Headline

- **Average competency health (authorable native set, 11 attributes):** 68.4%
- ⚠️ **Read avg health with care — it is buoyed by structural identity/governance fields that are ~100% filled.** Structural identity coverage: **100%** · knowledge-DEPTH coverage (indicators, proficiency levels, role-relevance, scoring, benchmark, role-DNA): **42.2%**. The three genuinely empty depth attributes are the real authoring backlog: Behavioural Indicators 3.1%, Proficiency Levels 1.7%, Role/Role-DNA 5.7%.
- **Classification:** Complete 3 · Nearly Complete 29 · Partial 387 · Missing 0 (of 419)
- **Verdict:** PARTIAL — genome is NOT 419/419 complete

## 1 · The 18 attributes — real backing & coverage

Each attribute is classified by how it attaches to the canonical genome. **NATIVE** = a joinable `onto_*` field/table (authorable). **GLOBAL** = one table applies to all competencies. **DISJOINT** = exists only in the `ont_*`/INT O*NET namespace or has 0 rows — it does **not** attach to the 419. **ABSENT** = no backing field exists anywhere.

| # | Attribute | Backing | Source | Coverage | Notes |
|---|---|---|---|---|---|
| 1 | Definition | NATIVE | `onto_competencies.definition` | 419/419 (100%) |  |
| 2 | Description | NATIVE | `onto_competencies.definition` | 419/419 (100%) | No separate business-description field; definition is the only descriptive field. |
| 3 | Behavioural Indicators | NATIVE | `onto_indicators.indicator` | 13/419 (3.1%) |  |
| 4 | Observable Behaviours | NATIVE | `onto_indicators.indicator` | 13/419 (3.1%) | No distinct field; onto_indicators rows ARE the observable behaviours (shared with #3). |
| 5 | Proficiency / Required Levels | NATIVE | `onto_indicators.proficiency_level` | 7/419 (1.7%) | Per-competency levels = ≥2 distinct proficiency_level values among its indicators. |
| 6 | Level Descriptors | GLOBAL | `onto_proficiency_levels.description` | 419/419 (100%) | Global 1–5 level descriptors apply to every competency; not authored per-competency. |
| 7 | Evidence Requirements | DISJOINT | `map_competency_proficiency.sample_evidence` | 0 (not attached) | 0 rows AND INT-keyed (O*NET ont_ namespace) — does not attach to the canonical genome. (rows=0) |
| 8 | Learning Outcomes | ABSENT | `(none)` | — (no field) | No learning-outcomes field anywhere in the ontology. |
| 9 | Industry Mapping | DISJOINT | `map_industry_competency` | 0 (not attached) | 0 rows AND INT-keyed (O*NET ont_ namespace) — not attached to the 419. (rows=0) |
| 10 | Function Mapping | ABSENT | `(none direct)` | — (no field) | onto_functions exists but no competency→function map for the canonical genome. |
| 11 | Department Mapping | ABSENT | `(none)` | — (no field) | No department dimension in the genome. |
| 12 | Role Family Mapping | NATIVE | `onto_competencies.family_id → onto_families` | 419/419 (100%) | family_id is the COMPETENCY family; role-family is a separate (role-side) dimension. |
| 13 | Role Mapping | NATIVE | `onto_role_competency_profiles` | 24/419 (5.7%) | Same source as Role DNA (#15). |
| 14 | O*NET Mapping | ABSENT | `(none direct)` | — (no field) | No external_ref column on onto_competencies; only an indirect bridge-by-name to ont_competencies. |
| 15 | Role DNA Mapping | NATIVE | `onto_role_competency_profiles` | 24/419 (5.7%) |  |
| 16 | Assessment Strategy | NATIVE | `onto_competencies.scoring_metadata` | 419/419 (100%) | scoring_metadata JSONB is the canonical scoring/assessment config; ont_competencies.assessment_methods is the disjoint O*NET copy. |
| 17 | Learning Resources | DISJOINT | `cg_skill_resource_map.skill_key` | 7/419 (1.7%) | Keyed by skill_key (TEXT) — measured by name/slug overlap with the genome (reported separately). |
| 18 | Certification Mapping | ABSENT | `rr_certifications (role-keyed)` | — (no field) | Certifications attach to roles, not competencies — no competency-level mapping. |

## 2 · Per-competency health distribution

Health is scored ONLY over the authorable native attributes (you cannot author into a field that does not exist).

| Class | Definition | Count | % of genome |
|---|---|---|---|
| Complete | 100% of native attributes | 3 | 0.7% |
| Nearly Complete | ≥80% | 29 | 6.9% |
| Partial | ≥40% | 387 | 92.4% |
| Missing | <40% | 0 | 0% |

### Native attribute coverage (the authoring backlog)

| Attribute | Present | Coverage |
|---|---|---|
| Definition | 419/419 | 100% |
| Domain | 419/419 | 100% |
| Family | 419/419 | 100% |
| Scientific Type | 419/419 | 100% |
| Governance Ext | 419/419 | 100% |
| Behavioural Indicators | 13/419 | 3.1% |
| Proficiency Levels | 7/419 | 1.7% |
| Role Relevance | 299/419 | 71.4% |
| Assessment Strategy (scoring_metadata) | 419/419 | 100% |
| Benchmark Metadata | 299/419 | 71.4% |
| Role / Role-DNA Mapping | 24/419 | 5.7% |

## 3 · Schema-gap report (NOT an authoring gap)

These attributes cannot be filled by knowledge-authoring alone — they need schema and/or a crosswalk first. Reporting them as "0% authored" would be dishonest; they have no canonical home on the 419.

| Attribute | Status | Reason |
|---|---|---|
| Evidence Requirements | DISJOINT NAMESPACE | 0 rows AND INT-keyed (O*NET ont_ namespace) — does not attach to the canonical genome. (rows=0) |
| Learning Outcomes | NO FIELD | No learning-outcomes field anywhere in the ontology. |
| Industry Mapping | DISJOINT NAMESPACE | 0 rows AND INT-keyed (O*NET ont_ namespace) — not attached to the 419. (rows=0) |
| Function Mapping | NO FIELD | onto_functions exists but no competency→function map for the canonical genome. |
| Department Mapping | NO FIELD | No department dimension in the genome. |
| O*NET Mapping | NO FIELD | No external_ref column on onto_competencies; only an indirect bridge-by-name to ont_competencies. |
| Learning Resources | DISJOINT NAMESPACE | Keyed by skill_key (TEXT) — measured by name/slug overlap with the genome (reported separately). |
| Certification Mapping | NO FIELD | Certifications attach to roles, not competencies — no competency-level mapping. |

Supporting counts: `map_competency_proficiency`=0 rows · `map_industry_competency`=0 rows · `map_competency_learning_path`=0 rows · learning-resource name-overlap=7/419 competencies.

**Disjointness proof (this run):** `map_role_competency` holds **52362 rows** but joins to **0** canonical `onto_competencies` (INT `competency_id` cast to TEXT) — it is the O*NET `ont_` namespace and does **not** attach to the 419-competency genome. This is measured per-run, not asserted.

## 4 · Downstream readiness (eligibility ⟂ data sufficiency)

A competency is "ready" for a consumer only when it is both eligible (governance flag) AND has sufficient data.

| Consumer | Ready competencies | Coverage |
|---|---|---|
| Assessment (eligible + indicators + levels) | 7/419 | 1.7% |
| Role DNA (in role profiles) | 24/419 | 5.7% |
| Employer Matching (eligible + role-DNA) | 24/419 | 5.7% |
| Career Builder (eligible) | 419/419 | 100% |
| Employability (EI eligible) | 419/419 | 100% |
| Reporting (definition + domain + family) | 419/419 | 100% |

## 5 · Worst-covered competencies (authoring priority — bottom 25)

| Competency | Health | Class | Missing native attributes |
|---|---|---|---|
| Achievement/Effort | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Active Learning | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Adaptability/Flexibility | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Administration and Management | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Administrative | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Arm-Hand Steadiness | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Auditory Attention | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Biology | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Building and Construction | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Category Flexibility | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Chemistry | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Communications and Media | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Complex Problem Solving | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Computers and Electronics | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Concern for Others | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Control Precision | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Cooperation | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Coordination | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Customer and Personal Service | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Deductive Reasoning | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Depth Perception | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Design | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Dynamic Flexibility | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Dynamic Strength | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |
| Economics and Accounting | 54.5% | Partial | Behavioural Indicators, Proficiency Levels, Role Relevance, Benchmark Metadata, Role / Role-DNA Mapping |

## Honesty notes

- Health is measured over the **authorable native** attribute set; structurally-absent and namespace-disjoint attributes are excluded from per-competency health and reported separately in §3 — so no competency is penalised for a field that does not exist, and no disjoint O*NET data is credited to the canonical genome.
- All rates with a zero/absent denominator are shown as `n/m` ("not measurable"), never a fabricated 0%/100%.
- This is Phase 1+2 (audit + health scoring + gap reports). **No metadata was authored** — Phase 3 (governed, draft-only authoring) STOPS for founder approval, and §3 shows it is not pure knowledge-engineering: ~half of the 18 attributes need schema/crosswalk work first.