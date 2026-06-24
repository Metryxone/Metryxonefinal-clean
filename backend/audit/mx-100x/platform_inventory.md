# Section 1 — Platform Inventory & Activation State

**Scope:** the entire MetryxOne platform (1,360 live tables). **Method:** evidence-based, real
`COUNT(*)` (see `_evidence.md`). **Lens:** every domain classified on the three axes —
Architecture (exists), Activation (fed + reachable), Usage/Outcomes (real users + realized results).

## Activation legend
- **ACTIVATED** — structure complete + fed with real/reference data + reachable.
- **PARTIALLY ACTIVATED** — structure complete; data is demo/seed-only, single-org, or shallow.
- **DORMANT** — structure complete; effectively unfed in the live DB (by design or by gap).
- **DEPRECATED / LEGACY** — superseded shell kept for back-compat (reads fall back elsewhere).

## Domain inventory (14 domains)

| # | Domain | State | Evidence (live counts) |
|---|---|---|---|
| 1 | **Competency Framework** | ACTIVATED | genome 419, type-map 419 (100%), profiles 38, score-runs 23; question coverage 7/419 (1.7%) |
| 2 | **O*NET Intelligence** | ACTIVATED | map_role_competency 52,362; ont_roles 1,040; industries 206; competencies 160 |
| 3 | **Role DNA** | PARTIALLY ACTIVATED | onto_dna_profiles 5, onto_roles 5, role_weights 44 — curated set is small |
| 4 | **Assessment Intelligence** | PARTIALLY ACTIVATED | templates 15, template_questions 150, bank 88; runtime sessions 0 |
| 5 | **Adaptive Assessment** | DORMANT (engine built) | question_pools 7; all runtime/selection/state tables 0 |
| 6 | **Readiness / Employability Index** | PARTIALLY ACTIVATED | ei_profile_snapshots 2; scoring_runs 0; cra 0 |
| 7 | **Employer Intelligence / TIG** | PARTIALLY ACTIVATED (demo) | 40 demo candidates (@example.com), tig_nodes 72 / edges 1,680 — 1 org |
| 8 | **Career Builder / Career Graph** | PARTIALLY ACTIVATED | cg_roles 200; all cg_user_* 0; career_seeker_profiles 1 |
| 9 | **Career Passport** | PARTIALLY ACTIVATED | career_passport_snapshots 4 |
| 10 | **Validation Intelligence** | DORMANT (by design) | validation_loop_outcomes 0 → no accuracy claimable |
| 11 | **Global Intelligence** | PARTIALLY ACTIVATED | global_region_content 2,089; country profiles 5; regional reference 5–7 |
| 12 | **Workforce / Enterprise (m5/EIOS)** | PARTIALLY ACTIVATED (demo) | m5 succession/capability seed (5s, 1 org); forecasts/scenarios 0; EIOS mostly 0 |
| 13 | **Governance / Super Admin** | ACTIVATED (struct) / DORMANT (ops) | RBAC groups 8, hierarchies 9, AIG models 4, workflow_runs 71; approvals/events/reviews 0 |
| 14 | **Future Readiness (FRP)** | ACTIVATED (content) | skill_library 41, taxonomy 27, ai_impact 41, automation_risk 25; user_readiness 0 |

### Supporting subsystems
- **Benchmark engine** — ACTIVATED (competency_benchmarks 195, cohorts 19, statistics 15); role-alignment 0.
- **Report Factory** — PARTIALLY ACTIVATED (rf_master 15, templates 4); generated_reports 0.
- **CAPADEX behavioral runtime** — DORMANT **in this shared DB** (sessions/ontology all 0). Structurally one of the richest subsystems (39 tables); its concern/clarity ontology is seeded in isolated task-agent environments and never merged as rows ("merged-backfill" pattern). **UNFED-here ≠ non-existent.**
- **Student banks (LBI/SDI)** — SDI items 680 seeded; LBI banks UNFED-here; no responses.

## Real-usage snapshot (the Usage axis)
- **users 2 · completed CAPADEX sessions 0 · cg_user activation 0 · career-seeker activity 0 · validation outcomes 0.**
- **Conclusion:** the platform has not yet been exercised by real end users at any volume. Every "activated" surface above is reference data or demo/seed data. **Usage is effectively pre-launch.**

## Headline classification
- **Architecture:** 14/14 domains present and substantial → **complete**.
- **Activation:** ~3 ACTIVATED, ~7 PARTIAL, ~2 DORMANT-by-build, ~2 mixed → **partial, demo-weighted**.
- **Usage/Outcomes:** **near-zero** → no outcome or accuracy claims are supportable today.
