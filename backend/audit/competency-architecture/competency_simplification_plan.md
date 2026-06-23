# Competency Simplification Plan (Step 5)

> Every module classified **KEEP / SIMPLIFY / MERGE / HIDE / REMOVE**, with the reason and the risk. This is a *plan*, not an executed change — nothing here has been touched. Sequencing favours reversible, flag-gated, zero-data-loss moves first.

## Classification key
- **KEEP** — canonical, live, earns its place.
- **SIMPLIFY** — keep but reduce/relabel/finish.
- **MERGE** — fold into a canonical surface, retire the duplicate.
- **HIDE** — keep the table/code (no data loss) but remove from admin UI until activated.
- **REMOVE** — empty + no consumer + superseded → drop (after a backup/migration).

---

## 1. Curated genome & core (the spine)
| Module | Class | Action |
|---|---|---|
| Curated Competency Genome (`onto_competencies` 419 + domains/families/indicators) | **KEEP** | Canonical. This is the source of truth. |
| Micro Competency Framework (`onto_competency_hierarchy` 277) | **KEEP** | Recently improved (import/export shipped). |
| Competency Types & Type Map (`onto_competency_type_map` 419) | **KEEP** | 5-type weighting backbone. |
| Proficiency Levels | **SIMPLIFY** | Pick ONE table (`onto_proficiency_levels` vs `ref_proficiency_levels`); relabel "Levels" vs "Level Profiles" → "Proficiency Scale" vs "Level Descriptors". |

## 2. O*NET reference layer
| Module | Class | Action |
|---|---|---|
| O*NET runtime core (`ont_roles`, `ont_competencies`, `map_role_competency`, `map_ont_onto_role`, `ont_industries`, `ont_functions`) | **KEEP** | The real O*NET value (role-requirement estimation). |
| O*NET reference display (`ont_layers`, `ont_competency_clusters`, `ont_indicators`, `ont_role_families`, segments) | **SIMPLIFY** | Keep, but **visually separate from the curated genome** and label "O*NET Reference". Surface that `ont_layers.scoring_weight` is not consumed. |
| `ont_micro_competencies` (20) | **MERGE/ARCHIVE** | Superseded by curated micro fw; no consumer. |
| `ont_assessment_questions` (16) + `ont_question_options` | **MERGE** | Fold into the single question bank; not referenced by runtime. |
| `ont_career_paths`/`tracks`/`learning_paths` (+ milestones/steps, all 0) | **HIDE → ARCHIVE** | Empty; superseded by `cg_*`. Hide UI now, archive tables after backup. |
| `ont_future_skills` (0) | **HIDE** | Empty until populated. |
| `ont_benchmarks`/`ont_benchmark_items` (0) | **KEEP (parked)** | Wired but no data; activate when norms exist. |

## 3. Role architecture (biggest cleanup)
| Module | Class | Action |
|---|---|---|
| Curated Role DNA (`onto_roles` 5, `onto_role_weights` 44, `onto_role_competency_profiles` 14) | **KEEP / SIMPLIFY** | Canonical but thin — grow role coverage. |
| O*NET role library (`ont_roles` 1,040) | **KEEP** | Reference + bridge source. |
| Career Graph roles (`cg_roles` 200, `cg_role_edges` 500) | **KEEP** | Separate CGI product. |
| **GRO taxonomy** (`gro_*`, all 0) | **REMOVE** | A second complete role/industry taxonomy, 0 rows, no consumer. Pure dead weight. |
| **M3 market roles** (`m3_*`, all 0) | **HIDE → REMOVE** | Market-signal layer, 0 rows, no consumer. Hide now; remove if no roadmap. |
| Legacy role shells (`role_catalog`, `role_definitions` 10, `role_families`, `role_dna_profiles_v2`, `wos_roles`, `cra_*`, `eios_competency_roles`, `employer_competency_roles`, `ep98_role_intelligence`) | **REMOVE** | Empty/superseded duplicates of curated roles. |

## 4. Assessment factory, questions, scoring
| Module | Class | Action |
|---|---|---|
| Assessment Factory & Blueprints (`onto_assessment_blueprints` 6, `onto_question_blueprints` 7) | **KEEP / SIMPLIFY** | Make the runtime actually consume the precise blueprint (close Gap 1). |
| Competency Runtime & Scoring (`onto_assessment_instances` 45, responses 54, score_runs 2, profiles 38) | **KEEP** | Live spine; document the dual ledger. |
| Question Bank UI (3 surfaces: `QuestionBankPanel`, `CompetencyQuestionsPanel`, `FrameworkPanel.questions`) | **MERGE** | Choose ONE primary admin surface; demote the rest. |
| `assessment_*` v2/proctoring/integrity/templates (all 0 except `assessment_template_questions` 150) | **HIDE → REMOVE** | Parallel namespace the live `onto_assessment_*` path doesn't use. |

## 5. Analytics & "advanced intelligence" scaffold
| Module | Class | Action |
|---|---|---|
| P4 Competency Intelligence (`p4_competency_history`, `p4_benchmark_trends`, heatmaps, `competency_forecasts` 120, `competency_ei_mapping` 67) | **KEEP** *(verify)* | Populated — but **confirm the rows are real vs seeded demo** before trusting in production. |
| Competency graph/fusion/propagation/entropy/validity/readiness/confidence/etc. (all 0) | **HIDE** | ~20 parked tables. Keep code (flag-off byte-identical) but remove empty panels from the wizard. |
| Legacy `competency_catalog`/`library`/`clusters`/`domains` (0) | **REMOVE** | Empty shells duplicating the genome; reads already fall back to `onto_*`. |
| Benchmark duplicates (`ti_role_benchmarks` 60, `competency_percentile_distributions_v2` 0, `bench_role_alignment_scores` 0) | **SIMPLIFY** | Keep one benchmark home; remove empties. |

## 6. Separate products (out of scope to merge — keep boundaries)
| Module | Class | Action |
|---|---|---|
| LBI (`lbi_*`) | **KEEP** | Independent student product (never bridge to `onto_*`). |
| SDI / CAPADEX (`sdi_items` 680, concerns) | **KEEP** | Independent behavioural product. |

---

## Net effect (counts)
- **KEEP:** the curated genome + micro fw + types + O*NET runtime core + Role DNA + runtime/scoring + P4 analytics + LBI + SDI ≈ the real working platform.
- **SIMPLIFY/MERGE:** ~6 surfaces (proficiency levels, O*NET reference labelling, question-bank UI, blueprint consumption, benchmark home, micro/question merges).
- **HIDE:** M3, assessment_* v2 namespace, ~20 competency_* scaffold tables, empty O*NET path tables (~30+ tables out of the UI).
- **REMOVE:** GRO taxonomy + legacy competency/role shells (~30+ permanently-empty tables).

Roughly **~60–70 of the ~250 competency-related tables are empty-and-unconsumed** → candidates for HIDE/REMOVE with zero functional impact (flag-off / no-consumer paths are byte-identical today).

## Execution guardrails (per `replit.md`)
1. **Reversible first**: HIDE (UI-only) before REMOVE (DDL). HIDE = conditional-spread the nav tab; data untouched.
2. **REMOVE requires a backup** (`pg_dump` of the table) + a migration, since this DB is PROD.
3. **Flag-gated**: every change ships behind a flag; flag-off path byte-identical.
4. **Stop for approval** before any merge/deploy (user preference).
5. **Verify P4 data provenance** before relying on it (may be seeded demo per memory).
