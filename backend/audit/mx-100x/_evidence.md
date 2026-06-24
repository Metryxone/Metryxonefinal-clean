# MX-100X — Evidence Ledger (single source of truth)

**Method:** real `COUNT(*)` on the SHARED live database (NOT `pg_stat`/`reltuples` estimators —
known to misreport). Captured 2026-06-24. Platform = **1,360 base tables** (`public` schema).

> Read this ledger as the evidentiary basis for every certification in this folder. Where a
> certification cites a number, it traces here. `0` = genuinely empty in THIS database (honest),
> never "unknown". Some ontologies are seeded in isolated task-agent environments and do not reach
> this shared DB (the "merged-backfill" pattern) — flagged inline as **UNFED-here**.

## Three axes (kept separate everywhere)
- **Architecture** — does the table/route/engine exist? (structure)
- **Activation** — is it fed with data and reachable behind its flag? (demo/seed vs real)
- **Usage / Outcomes** — have real (non-demo) users exercised it and produced realized outcomes?

## Competency Framework
| Table | Count | Note |
|---|---:|---|
| onto_competencies | 419 | canonical genome |
| onto_competency_type_map | 419 | **100%** type coverage |
| onto_competency_question_map | 25 | only **7 distinct** competencies mapped → **1.7%** question coverage |
| onto_competency_profiles | 38 | runtime ledger (append-only) |
| onto_competency_score_runs | 23 | normalized scoring ledger |
| onto_dna_profiles | 5 | Role DNA (curated) — small |
| onto_roles | 5 | curated roles |
| onto_role_weights | 44 | |
| onto_role_competency_profiles | 14 | |
| onto_blueprint_dimension_mix | 0 | empty |
| competency_question_templates | 88 | V1 bank |

## O*NET Intelligence (ont_ / map_)
| Table | Count | Note |
|---|---:|---|
| map_role_competency | 52,362 | 1,021 distinct roles × 159 distinct competencies |
| ont_roles | 1,040 | O*NET role library |
| ont_industries | 206 | |
| ont_competencies | 160 | |
| ont_role_families | 31 | |
| ont_functions | 30 | |
| ont_departments | 43 | |
| ont_concerns | 0 | mirror-sync target, empty here |

## Assessment Intelligence
| Table | Count | Note |
|---|---:|---|
| assessment_templates | 15 | |
| assessment_template_questions | 150 | |
| competency_question_templates | 88 | |
| assessment_blueprints / _v2 | 0 / 0 | runtime blueprints unfed |
| assessment_runtime_sessions_v2 | 0 | no runtime sessions |
| assessment_invites | 0 | |

## Adaptive Assessment
| Table | Count | Note |
|---|---:|---|
| adaptive_question_pools | 7 | only fed table |
| adaptive_blueprint_rules / _targets / _sessions | 0 | engine built, **not exercised** |
| adaptive_question_selections / _runtime_state / _intelligence_events / _ontology_edges | 0 | |

## Readiness / Employability Index (EI)
| Table | Count |
|---|---:|
| ei_profile_snapshots | 2 |
| ei_calculation_logs | 0 |
| employability_scoring_runs | 0 |
| cra_profiles / cra_scores | 0 / 0 |

## Career Builder / Career Graph (cg_)
| Table | Count | Note |
|---|---:|---|
| cg_roles | 200 | catalog |
| cg_user_role_readiness / _skill_gaps / _recommendations / _career_path / _activation_runs | 0 | **zero user activation** |
| career_seeker_profiles | 1 | |
| career_seeker_jobs / _goals / career_recommendations / career_outcomes / career_simulation_runs | 0 | |
| career_passport_snapshots | 4 | |

## Employer Intelligence / TIG
| Table | Count | Note |
|---|---:|---|
| employer_candidates | 40 | **all 40 @example.com (demo)** |
| employer_jobs | 1 | |
| employer_organizations / _members / _interviews / _offers / _competency_roles | 0 | |
| tig_nodes | 72 | 1 org (demo) |
| tig_edges | 1,680 | |
| tig_intelligence | 40 | |
| tig_calibration | 5 | <30 outcomes → uncalibrated |
| tig_clusters | 2 | |

## Validation Intelligence
| Table | Count | Note |
|---|---:|---|
| validation_loop_outcomes | 0 | **DORMANT by design** — abstains until ≥30 realized non-demo outcomes. **No accuracy is claimable platform-wide.** |

## Workforce Intelligence (m5_) — single org (demo)
| Table | Count | Table | Count |
|---|---:|---|---:|
| m5_succession_candidates | 5 | m5_succession_readiness | 0 |
| m5_critical_role_successors | 5 | m5_workforce_readiness_scores | 0 |
| m5_organizational_capabilities | 5 | m5_workforce_transformation_scenarios | 0 |
| m5_organizational_skill_gaps | 5 | m5_future_capability_forecasts | 0 |
| m5_enterprise_capability_indices | 5 | m5_department_capability_scores | 4 |
| m5_executive_recommendations | 3 | m5_organizational_simulations | 3 |
| m5_strategic_workforce_risks | 3 | | |

## EIOS (workforce campaigns)
| Table | Count |
|---|---:|
| eios_competency_roles | 6 |
| eios_campaigns / _scenarios / _workforce_plans / _employee_profiles / _outcome_tracking | 0 |

## Mobility / Capability
| Table | Count | Table | Count |
|---|---:|---|---:|
| mobility_role_transitions | 8 | mobility_role_mobility_scores | 0 |
| mobility_career_paths | 3 | mobility_competency_gaps | 0 |
| capability_master | 12 | capability_cluster_master | 6 |

## Global Intelligence
| Table | Count | Table | Count |
|---|---:|---|---:|
| global_region_content | 2,089 | m4_country_workforce_profiles | 5 |
| nhda_regions | 15 | m4_localization_weights | 5 |
| m4_regional_competency_expectations | 7 | m4_regional_leadership_models | 5 |
| m4_regional_language_policies | 5 | | |

## Governance / Super Admin
| Table | Count | Table | Count |
|---|---:|---|---:|
| rbac_permission_groups | 8 | rbac_role_hierarchies | 9 |
| aig_models | 4 | aig_workflow_runs | 71 |
| gov_methodology_versions | 7 | gov_review_schedules | 7 |
| rbac_approval_requests | 0 | governance_events | 0 |
| gov_review_instances | 0 | | |

## Future Readiness (frp_) — natively seeded, rich
| Table | Count | Table | Count |
|---|---:|---|---:|
| frp_skill_library | 41 | frp_ai_impact | 41 |
| frp_skill_taxonomy | 27 | frp_automation_risk | 25 |
| frp_industry_forecast | 10 | frp_user_readiness | 0 |

## Benchmark / Report Factory
| Table | Count | Table | Count |
|---|---:|---|---:|
| bench_competency_benchmarks | 195 | bench_cohorts | 19 |
| bench_cohort_statistics | 15 | bench_role_alignment_scores | 0 |
| rf_master | 15 | rf_templates | 4 |
| rf_generated_reports | 0 | | |

## CAPADEX behavioral runtime — **UNFED-here** (data in isolated envs)
| Table | Count | Table | Count |
|---|---:|---|---:|
| capadex_sessions | 0 | capadex_responses | 0 |
| capadex_reports | 0 | capadex_users | 0 |
| capadex_concerns_master | 0 | capadex_clarity_questions | 0 |
| capadex_domains / _families / _signals / _atomic_signals | 0 | capadex_question_registry | 0 |

## Student banks
| Table | Count | Note |
|---|---:|---|
| sdi_items | 680 | seeded |
| sdi_user_responses / sdi_domains | 0 | |
| lbi_question_bank / _sessions / _scores / _domains | 0 | **UNFED-here** |

## Real users / usage
| Metric | Count |
|---|---:|
| users | 2 |
| children / student_subscriptions | 0 / 0 |
| capadex_sessions (completed) | 0 |
| candidate_pipeline / candidate_ranking | 0 / 0 |

## Cross-cutting honest conclusions
1. **Architecture is vast and complete** — 1,360 tables across ~14 domains; every certified domain exists structurally.
2. **Reference/ontology data is rich where natively seeded** — O*NET (52k crosswalk), competency genome (419+419), benchmarks (195), FRP skill intelligence, regional content (2,089), SDI items (680), assessment templates.
3. **Activation is demo/seed-only and single-org** where present (TIG 1 org, m5 1 org, 40 demo candidates).
4. **Usage ≈ 0** — 2 users, 0 completed sessions, 0 cg_user activation, 0 career-seeker activity. The platform is not yet exercised by real users (not production-deployed for end users).
5. **Validation Loop is empty (0 outcomes)** → **no predictive accuracy may be claimed anywhere**. This is the platform's honesty anchor.
6. **Question coverage is the systemic competency gap** — 7/419 competencies (1.7%) have mapped questions.
7. **Some ontologies are UNFED in this shared DB** (CAPADEX concerns/clarity, LBI banks) — structurally present; data resides in isolated task-agent environments and never merged as rows.
