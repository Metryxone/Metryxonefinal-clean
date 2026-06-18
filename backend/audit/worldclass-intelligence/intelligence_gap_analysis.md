# MetryxOne — Intelligence Gap Analysis
### MX-WORLDCLASS-INTELLIGENCE-01 · 18 June 2026

Gap = distance between **current measured state** and the **world-class targets** in the mission brief. Each row cites live evidence (DB counts 18 Jun 2026 + engine inspection). "Gap type" classifies *why* the gap exists, because the fix differs sharply by type:

- **MISSING** — the content/data does not exist (build it).
- **DORMANT** — the engine exists and works but no real data flows through it (activate it).
- **SEEDED** — values exist but are authored constants, not empirically derived (earn them).
- **UNVALIDATED** — outputs exist but have never been checked for reliability or predictive accuracy (validate them).

> **One-line root cause:** MetryxOne built *machinery* ahead of *evidence*. Most gaps are SEEDED / DORMANT / UNVALIDATED — not MISSING engineering. The exceptions are the competency ontology (genuinely MISSING) and realized outcomes (genuinely absent).

---

## WS1 — Competency Ontology (target > 95%)
| Target | Current | Gap | Type |
|---|---|---|---|
| 1000+ competencies | largest single source = 45 (`mei_competencies`); ontology tables = 0; ~90 distinct across fragmented sources | **~91–95% short** | MISSING + fragmentation |
| 5000+ relationships | ≈56 (`cb_competency_mapping`=48, `capability_dependency_master`=8, all `map_*`=0) | **~99% short** | MISSING |
| Industry benchmarks | `ti_industry_benchmarks`=66 — seeded constants | structurally present, **not empirical** | SEEDED |
| Role benchmarks | `ti_role_benchmarks`=60 — seeded constants | structurally present, **not empirical** | SEEDED |

**Root cause:** competency content is scattered across five incompatible schemas (`mei_*`, `capability_*`, `ont_*`, `cb_*`, `competency_dna_*`) with no unifying canonical layer; the canonical layer (`ont_competencies`) was created but never populated. There is no O*NET/ESCO import to reach scale.

## WS2 — Employability Intelligence (target > 90%)
| Target | Current | Gap | Type |
|---|---|---|---|
| Industry readiness | real formula + `mei_industry_calibration`=50 (seed multipliers) | works, **0 user scores** | DORMANT + SEEDED |
| Role readiness | `mei_role_calibration`=30 (seed) | works, **0 user scores** | DORMANT + SEEDED |
| Future readiness | FRP 5-signal index (real) + seeded catalogs; `frp_user_readiness`=8 | engine real, **thin activation**, automation-risk = static constants | SEEDED + DORMANT |
| Skill-gap intelligence | `cg_user_skill_gaps`=6, `talent_gaps`=0 | logic exists, **near-zero data** | DORMANT |
| (implicit) empirical norms | `mei-benchmark-engine` computes cohort stats at k≥10 | **`mei_scores`=0 → never fires** | DORMANT |

**Root cause:** the best engine in the platform is starved — no user has a persisted `mei_score`, so neither the score nor its empirical benchmark exists for anyone.

## WS3 — Learning Behavior Intelligence (target > 90%)
| Target | Current | Gap | Type |
|---|---|---|---|
| Learning profiles | template-level; `lbi_clusters`=0 | no learning genome | MISSING |
| Learning risks | "score < 40%"; no model; `lbi_subdomain_norms`=0 | no validated risk model | MISSING + UNVALIDATED |
| Interventions | `lbi_learning_mappings`=0 | no evidence-based library | MISSING |
| Teacher / student insights | dashboards exist, data empty (`lbi_score_history`=8) | nothing real to surface | DORMANT |
| (core) the score itself | AI-generated number in a fixed band | **not a measurement** | UNVALIDATED |

**Root cause:** LBI was never built as a measurement engine; it delegates the number to an LLM and lacks norms, signals, and clusters.

## WS4 — CAPADEX Intelligence (target > 90%)
| Target | Current | Gap | Type |
|---|---|---|---|
| Archetypes | **no archetype table in live schema** | absent for customers | MISSING |
| Behavior models | signals captured (98) + behaviour graph (58); composites=0 | model layer **unfired** | DORMANT |
| Pattern intelligence | `capadex_session_patterns`=0 | wired, **never produces rows** | DORMANT |
| Growth intelligence | no growth/longitudinal CAPADEX table populated | absent | MISSING |
| (cross) construct validity | no α / norming / factor structure | unproven | UNVALIDATED |

**Root cause:** the deeper-intelligence layer (patterns/composites/recommendations/interventions/archetypes) is built but does not fire post-session; constructs were never psychometrically validated.

## WS5 — Career Intelligence (target > 90%)
| Target | Current | Gap | Type |
|---|---|---|---|
| Career graph | 200 roles / 500 edges / 711 skill reqs | real but **sub-O*NET scale** | MISSING (depth) |
| Career paths | tracks=15, waypoints=76; `ont_career_paths`=0 | mostly 1-step; no rich multi-hop | MISSING (depth) |
| Transition intelligence | rules (`lateral`=25, `promotion`=40); `cg_user_career_path`=1 | rule-based, **not learned/validated** | UNVALIDATED |
| Future-role prediction | `ti_outcome_predictions`=8 **`[DEMO]`** | no real predictions | DORMANT + UNVALIDATED |

**Root cause:** the graph is curated and shallow; transition probabilities are heuristic and never validated against real career moves.

## WS6 — Outcome Intelligence (target = established)
| Target | Current | Gap | Type |
|---|---|---|---|
| Placements | `employer_offers`=0; hiring loop closed in code | mechanism real, **0 data** | DORMANT |
| Performance | `eios_outcome_tracking`=0 (ingest path exists) | **0 data** | DORMANT |
| Promotions | scaffold `"pending_90_day_reviews"` | **0 data + partial wiring** | DORMANT |
| Retention | scaffold `"pending_outcome_correlation"` | **0 data + partial wiring** | DORMANT |
| Learning improvements | `rie_outcomes`=0 (`delta`/`success` schema exists) | **0 data** | DORMANT |
| Validation framework | Brier/ECE/isotonic/trust-states in `employer-tig.ts` | **established as code, never run on real data** | DORMANT (not MISSING) |

**Root cause:** the validation framework is genuinely built but no realized outcome has ever been recorded; the other four products' predictions are not yet routed through it.

---

## Cross-cutting (foundation) gaps — these gate everything above
1. **No empirical grounding (where data exists).** The benchmark/weight rows that are *currently populated* (ti_* percentiles with literal sample_size=50/200, FRP automation-risk, mei calibration multipliers) are **predominantly seed constants**, not statistics computed from respondents. Empirical paths do exist — notably MEI's `refreshCohortBenchmark` — but they are **dormant** (e.g. `mei_scores=0`), so no live benchmark is yet earned from data. World-class intelligence is computed from respondents; MetryxOne's populated values are mostly authored. *(SEEDED + DORMANT)*
2. **No reliability/validity evidence anywhere.** No α, test–retest, or factor structure for any instrument (CAPADEX, Competency, LBI). *(UNVALIDATED)*
3. **No realized-outcome data — but the loop exists.** This is the cheapest high-impact gap: the calibration engine is already written. *(DORMANT)*
4. **Fragmented competency ontology far below scale.** *(MISSING)*

## Gap-type summary (where the work actually is)
| Gap type | Share of gaps | Implication |
|---|---|---|
| DORMANT (activate existing engine) | **largest** | cheapest, fastest score gains — compute MEI scores, fire CAPADEX patterns, capture outcomes |
| SEEDED (replace constants w/ empirical) | large | requires data volume first, then recompute benchmarks |
| UNVALIDATED (run validity studies) | medium | the only lever that moves Scientific/Predictive readiness above ~40 |
| MISSING (build new content) | concentrated in WS1 + LBI | ontology import + LBI rebuild are the genuine net-new builds |

**Implication for sequencing:** activate the DORMANT machinery and capture outcomes *first* (weeks, high ROI), because that data is the prerequisite for de-SEEDING benchmarks and running VALIDATION. Building MISSING ontology in parallel. Detailed order in `intelligence_roadmap.md`.
