# CAPADEX 2.0 — Phase 1.23: Competency Intelligence Constitution (onto_* Genome + Competency Graph + Competency Intelligence Engine)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Competency Intelligence Constitution. **Do not rebuild, do not create a second competency engine, do not replace the `onto_*` genome, do not create onto_v2 / Competency V2, do not fork competencies, do not activate dormant competency capabilities, do not modify business logic, do not bypass Assessment / Behaviour / Decision / Learning / Career Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via **exact `SELECT COUNT(*)`** (live `DATABASE_URL` + repo on 2026-06-28 — NOT `n_live_tup`, see Measurement-Integrity Correction below); *judgement* = DERIVED. Competency Intelligence is the canonical capability layer. **Competency ≠ Skill ≠ Knowledge ≠ Experience ≠ Performance ≠ Capability · Competency ≠ Employability · Evidence ≠ Confidence · Confidence ≠ Competence · Competence ≠ Mastery · Mastery ≠ Expertise · Ontology ≠ Runtime · Seeded Taxonomy ≠ Competency Ecosystem · AI ≠ Competency Evaluator.** built ≠ activated; flag-ON ≠ runtime-active; null ≠ 0. Human remains responsible. Competencies describe capability; they do not predict destiny.
> **Basis:** exact-count audit of the `onto_*`/`competency_*` genome + Phase 1.2–1.22 constitutions + memory (`competency-ontology-architecture`, `competency-framework-intelligence-phase1-index`, `competency-vs-lbi-separation`, `competency-ei-dimension-mapping`, `role-title-crosswalk`, `onto-competency-type-map-not-null`, `n-live-tup-stale-population-audit`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.23.

---

## ⚠️ MEASUREMENT-INTEGRITY CORRECTION (MEASURED — affects Phases 1.18–1.22)

This phase was measured with exact `SELECT COUNT(*)`. In doing so it surfaced that the **prior phases 1.18–1.22 were measured with `pg_stat_user_tables.n_live_tup`, which reads 0 for bulk-seeded tables until autovacuum analyzes them** — so those phases **under-reported population and wrongly classified live tables as EMPTY / DORMANT.** Honesty over optimism cuts both ways: reporting *empty when full* is as much a fabrication as reporting *full when empty*. Corrected exact counts:

| Table | Phase | Reported (n_live_tup) | **Actual (COUNT\*)** | Correction |
|---|---|---|---|---|
| `onto_competencies` | 1.23 basis | 0 (stale) | **422** | genome LIVE |
| `map_role_competency` | 1.22 | 0 | **52,362** | matching crosswalk LIVE |
| `frp_role_evolution` | 1.22 | 770 | **10,185** | under-counted |
| `onto_role_competency_profiles` | 1.22 | "empty → abstains" | **76** | role-DNA match LIVE |
| `onto_role_weights` | 1.22 | 0 | **121** | LIVE |
| `role_dna_master_profiles` | 1.22 | 0 | **38** | LIVE |
| `career_match_history` | 1.22 | 0 | **11** | matches HAVE run |
| `cp_passport` | 1.22 | 0 | **1** | passport published |
| `employer_jobs` | 1.22 | 0 | **2** | jobs exist |
| `skills` | 1.21 | 0 | **131** | skill graph LIVE |
| `lip_catalog_courses` | 1.21 | 0 | **15** | catalog populated |
| `cg_user_learning_recs` | 1.21 | 0 | **29** | recs LIVE |
| `learn_outcomes` | 1.21 | 0 | **54** | outcomes recorded |

**Consequence (DERIVED):** Phase 1.21 (Learning) and Phase 1.22 (Career) "almost entirely dormant" / "matching genome empty" findings are **materially wrong and should be regenerated with exact counts.** Phases 1.18–1.20 (Pragati / WC-3 / RIE) likewise need re-verification (their runtime tables may genuinely be 0, but the method that measured them was unreliable). Phase 1.17 used exact COUNT(*) and stands. **Durable fix:** all population verdicts use exact `COUNT(*)` — `.agents/memory/n-live-tup-stale-population-audit.md`.

---

## PART 1 — Current Competency Intelligence Audit (MEASURED, exact COUNT\*)

| Component | Table(s) | **Live count** | Class |
|---|---|---|---|
| Competency genome | `onto_competencies` | **422** | **LIVE** |
| Domains / families | `onto_domains` **6** · `onto_families` **33** | 6 / 33 | **LIVE** |
| Indicators / aliases / proficiency | `onto_indicators` **66** · `onto_aliases` **19** · `onto_proficiency_levels` **5** | 66 / 19 / 5 | **LIVE** |
| Competency relationships | `onto_relationships` | **7** | **PARTIAL** (sparse) |
| Role genome | `onto_roles` **15** · `onto_dna_profiles` **15** · `onto_role_competency_profiles` **76** · `onto_role_weights` **121** | LIVE | **LIVE** |
| Role-competency crosswalk | `map_role_competency` | **52,362** | **LIVE** (dense) |
| Role-DNA master | `role_dna_master_profiles` | **38** | **LIVE** |
| Runtime weights | `competency_runtime_weights` | **106** | **LIVE** |
| Question bank (V1) | `competency_question_templates` | **2,665** | **LIVE** |
| **Runtime scoring ledger** | `onto_competency_profiles` **46** (runtime) · `onto_competency_score_runs` **24** (normalized) | LIVE | **LIVE** |
| Type map | `onto_competency_type_map` | **419** | **LIVE** |
| Governance | `gov_audit_framework` **4** · `gov_workflows`/`gov_ontology_reviews`/`gov_explainability_logs` 0 | partial | **PARTIAL** |
| Legacy competency shells | `competency_domains`/`competency_clusters`/`competency_catalog`/`competency_library` | **0** | EMPTY (by design — `onto_*` is canonical) |
| Scaffolded-unactivated | `onto_capability_models`/`onto_complexity_models`/`onto_competency_versions`/`onto_industries`/`onto_functions` | **0** | DORMANT |
| Alt namespace `ont_*` | `ont_roles`/`ont_industries`/`ont_benchmarks`/… | **0** | EMPTY (NOT the canonical match target) |
| Competency engines | `services/competency-*.ts`, `services/ontology-*.ts` (~50 files) | present | **LIVE** (code) |
| Competency routes | `routes/competency-*.ts`, `routes/*ontology*.ts` (~37 files) | present | **LIVE** (code) |

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **Competency Intelligence is the LIVEST, most populated, most canonical layer in the entire platform — it is the genome every other layer references.** Unlike the runtime layers (Pragati / WC-3 / RIE) and unlike what 1.21/1.22 wrongly implied, the competency genome is densely populated and operationally wired: a 422-competency genome across 6 domains / 33 families / 66 indicators, a role genome (15 roles, 15 DNA profiles, 76 role-competency profiles, 121 role weights, 38 role-DNA masters), a **52,362-row role↔competency crosswalk** (`map_role_competency`), a 2,665-row question bank, and — critically — a **LIVE runtime scoring ledger** (`onto_competency_profiles`=46 runtime + `onto_competency_score_runs`=24 normalized + `onto_competency_type_map`=419). This is the dual-ledger scorer described in `replit.md` actually carrying data. **So the canonical match target `onto_role_competency_profiles` is NOT empty (76 rows) — Career matching in Phase 1.22 does NOT abstain; it has a real role genome to score against.** Honest gaps remain: `onto_relationships`=7 is sparse (the competency *graph* edges are thin relative to 422 nodes), governance tables are mostly empty (`gov_workflows`/`gov_ontology_reviews`/`gov_explainability_logs`=0 — review/explainability workflow not exercised), capability/complexity/version models are scaffolded-but-empty, and the legacy `competency_*` + `ont_*` namespaces are intentionally empty shells (the `onto_*` genome is canonical — admin reads fall back to `onto_*`). **No new competency namespace may be added — extend `onto_*`.**

**Strengths (DERIVED):** the genome is the real, dense, canonical spine — 422 competencies with a 52k-row role crosswalk and a live scoring ledger; dual ledger (runtime `onto_competency_profiles` ⟂ normalized `onto_competency_score_runs`) preserved; ~50 engines + ~37 routes all extend the single genome (no fork); type map (419) bridges scorer canonical keys to render tokens. **Technical debt / GAPS (DERIVED):** competency-graph edges sparse (`onto_relationships`=7 → prerequisite/transferability paths thin); governance/explainability workflow tables empty (audit logged but review loop unexercised); capability/complexity/version/industry-function models scaffolded-empty; two `question_type` vocabularies coexist by design (canonical scorer keys ↔ short render tokens via `mapQuestionType`); option-less rows force Likert render regardless of type. **Dormant:** capability/complexity/version models + governance review workflow + `ont_*` alt namespace — documented, not activated. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Competency Philosophy

Competency Intelligence exists to Define · Measure · Develop · Validate · Strengthen · Transfer · Evolve · Explain. **It never guarantees performance, employment, promotion, leadership, or success. Competencies describe capability — they do not predict destiny.**

## PART 3 — Competency Domain Architecture

Domains: Competency Core · `onto_*` Genome · Competency Intelligence · Competency Graph · Relationships · Evolution · Evidence · Analytics · Reports · AI · Governance. **Every competency capability belongs to ONE domain.**

## PART 4 — onto_* Genome Constitution

The `onto_*` framework remains **the only canonical competency genome. Never replace `onto_*` · never create onto_v2 · never fork competencies · never duplicate competency ontology — enhance only.** Protect Competencies · Domains · Clusters · Categories · Relationships · Inheritance · Mappings · Evolution. Binding: legacy `competency_*` and `ont_*` are EMPTY shells; admin reads fall back to `onto_*`; new work extends `onto_*` (`competency-framework-intelligence-phase1-index`).

## PART 5 — Competency Graph Constitution

Protect Competency nodes · Relationships · Dependencies · Paths · Evolution · Provenance · Timeline. **Graph remains canonical.** Binding: `onto_relationships`=7 is SPARSE relative to 422 nodes — the graph is real but thin; densifying edges is a separate approved phase, never fabricated.

## PART 6 — Competency Relationship Constitution

Protect Prerequisites · Dependencies · Transferability · Complementary competencies · Role / Learning / Behaviour / Career relationships. Binding: CAPADEX bridge via `concern_bridge_tag` (NOT `concern_id` — disjoint spaces).

## PART 7 — Competency Evolution Constitution

Track Competency development · Progress · Reinforcement · Decay · History · Versions. **Append-only.** Binding: never overwrite; `onto_competency_versions`=0 (versioning scaffolded, unexercised).

## PART 8 — Competency Mapping Constitution

Support mappings between Behaviour · Learning · Career · Assessment · Decision · Role DNA · Career DNA · Interview · Resume. **Never duplicate mappings.** Binding: `map_role_competency` (52,362) is the canonical role↔competency crosswalk — extend it, never create a parallel map.

## PART 9 — Competency Evidence Constitution

Evidence originates from Assessment · Behaviour · Learning · Projects · Experience · Career · Achievements · Historical evidence; contains Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 10 — Competency Recommendation Constitution

Every recommendation evaluates Behaviour · Assessment · Learning · Career · Evidence · Confidence · Transferability · Dependencies. **Never recommend without evidence.**

## PART 11 — Competency Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Capability · Mastery · Competence · Trust. **Never combine into one metric.** Binding: Confidence ≠ Competence; Competence ≠ Mastery; Mastery ≠ Expertise.

## PART 12 — Competency Explainability Constitution

Every competency explains Why · Evidence · Dependencies · Relationships · Confidence · Alternatives · Limitations · Expected development.

## PART 13 — Competency AI Constitution

**AI explains · maps · summarizes · supports · personalizes. AI never invents competencies · never fabricates mastery · never bypasses governance.** Binding: AI ≠ Competency Evaluator; `onto_competency_type_map` confidence/evidence NOT NULL — manual/bulk = confidence 'high' + real evidence + needs_review=true.

## PART 14 — Competency Analytics Constitution

Protect Competency KPIs · Growth · Distribution · Coverage · Trends · Transferability · Development velocity. **Honest gap:** runtime scoring ledger small (46 profiles / 24 runs) → growth/velocity provisional, below cohort floor.

## PART 15 — Competency Report Constitution

Every report contains Competency summary · Competency graph · Evidence · Confidence · Relationships · Recommendations · Next development.

## PART 16 — Longitudinal Competency Constitution

Protect Competency history · Evolution · Growth · Transferability · Development timeline. **Never overwrite competency history.** Binding: append-only (`p4_competency_history`, `m3_*` history never mutated in place).

## PART 17 — Enterprise Competency Constitution

Support Competency frameworks · Role frameworks · Leadership / Department competencies · Capability planning · Competency benchmarking. **Human approval required.** Binding: k-anonymity ≥30; tenant isolation; `ont_benchmarks`=0.

## PART 18 — SuperAdmin Competency Constitution

Support Competency libraries · Ontology management · Competency rules · Relationships · Policies · Analytics · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`; ontology edits are the only genome-changing op.

## PART 19 — Competency Security Constitution

Protect Competency data · Evidence · Mappings · Reports · Permissions · Consent · PII · Tenant isolation. Binding: per-framework admin gate covers `/api/<fw>/admin/*`; PII masked in audit artifacts.

## PART 20 — Competency Observability

Monitor Competency engine · Ontology · Graph · Mappings · Latency · Failures · Coverage · Quality. **Honest gap:** governance/explainability log tables empty = review loop unexercised, not healthy-zero.

## PART 21 — Competency Testing Constitution

Standardize Ontology · Relationship · Graph · Mapping · Regression · Performance tests.

## PART 22 — Competency Documentation

Maintain Competency catalog · Ontology catalog · Relationship catalog + Competency API guide + Analytics guide. SSOT: `docs/COMPETENCY_ASSESSMENT.md`, `docs/COMPETENCY_AND_ADAPTIVE_INTELLIGENCE.md`, `reports/competency_framework_review.md`, `docs/phase-history.md` + `.agents/memory/*`.

## PART 23 — Competency Governance

Every enhancement answers: Why is Competency changing? · What existing capability is reused? · Does this duplicate `onto_*`? · Does this improve competency science? · Does this preserve Behaviour Intelligence?

## PART 24 — Competency Quality Gates

Verify `onto_*` reused · Behaviour reused · Assessment reused · Learning reused · Career reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 25 — Competency Review Board

```
Founder[ ] CompetencyArchitect[ ] BehaviourScientist[ ] LearningArchitect[ ] CareerArchitect[ ] OntologyArchitect[ ] AIArchitect[ ]
Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 26 — Competency Definition of Done

- [ ] Existing `onto_*` reused · [ ] Competency Graph preserved · [ ] Mappings preserved · [ ] Relationships preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] History preserved · [ ] Documentation updated · [ ] No regressions.

## PART 27 — Competency Maturity Model

| Component | Current (DERIVED, exact-count) | Target |
|---|---|---|
| `onto_*` Genome | **L4 Intelligent** (422 comps, dense, canonical, live ledger) | L5 Continuous |
| Competency Graph | L2 Guided (real but sparse edges, `onto_relationships`=7) | L4 Intelligent |
| Relationships | L2 Guided | L4 Intelligent |
| Mappings | **L4 Intelligent** (`map_role_competency`=52,362) | L5 Continuous |
| Evolution | L1 Operational (versions scaffolded-empty) | L3 Adaptive |
| Analytics | L2 Guided (ledger small: 46/24) | L4 Intelligent |
| Reports | L2 Guided | L4 Intelligent |
| Enterprise Competencies | L1 Operational (benchmarks empty) | L3 Adaptive |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Continuous Competency Intelligence. **Roadmap:** (separate approved phases) densify the competency graph edges (`onto_relationships` thin vs 422 nodes) → exercise the governance/explainability review loop (`gov_*` empty) → activate capability/complexity/version models → grow the runtime scoring ledger past cohort floor for honest growth/velocity analytics → keep ONE genome (`onto_*`), append-only history, multi-axis confidence, AI-never-evaluates. **Competencies describe capability; they do not predict destiny.**

## PART 28 — Competency Scientific Validation

Document Competency science · Ontology engineering · Knowledge representation · Capability modeling · Behaviour science · Learning science · Evidence quality · Bias review · Ethics · Population applicability.

## PART 29 — Competency Evolution Strategy

Future evolution supports New competency / ontology / role-framework / industry-competency / AI-mapping models · new enterprise competency programs — **without breaking** Assessment · Behaviour · Conversation · Decision · Intervention · Learning · Career · Life · Enterprise Intelligence. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 30 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Competency Intelligence Constitution | all | 13 | Competency Analytics Constitution | P14 |
| 02 | Repository Competency Audit | P1 | 14 | Competency Report Constitution | P15 |
| 03 | onto_* Constitution | P4 | 15 | Longitudinal Competency Constitution | P16 |
| 04 | Competency Graph Constitution | P5 | 16 | Enterprise Competency Constitution | P17 |
| 05 | Competency Relationship Constitution | P6 | 17 | SuperAdmin Competency Constitution | P18 |
| 06 | Competency Evolution Constitution | P7 | 18 | Competency Governance Constitution | P23 |
| 07 | Competency Mapping Constitution | P8 | 19 | Competency Quality Gates | P24 |
| 08 | Competency Evidence Constitution | P9 | 20 | Competency Review Board | P25 |
| 09 | Competency Recommendation Constitution | P10 | 21 | Competency Definition of Done | P26 |
| 10 | Competency Confidence Constitution | P11 | 22 | Competency Scientific Validation | P28 |
| 11 | Competency Explainability Constitution | P12 | 23 | Competency Evolution Strategy | P29 |
| 12 | Competency AI Constitution | P13 | 24 | Competency Maturity Assessment | P27 |

---

**STOP — Phase 1.23 complete; Competency Intelligence Constitution ready to FREEZE on approval. `onto_*` not modified, Competency Intelligence not replaced, no second competency engine created, no dormant competency capabilities activated, business logic not changed, Assessment + Behaviour + Decision + Learning + Career Intelligence not bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (NOT `n_live_tup`). **Competency Intelligence is the LIVEST, most populated, most canonical layer** — a 422-competency genome (6 domains / 33 families / 66 indicators) with a role genome (76 role-competency profiles, 121 weights, 38 role-DNA masters), a 52,362-row role↔competency crosswalk, a 2,665-row question bank, and a LIVE runtime scoring ledger (46 profiles / 24 runs / 419 type-map). Ontology ≠ Runtime, but here BOTH are populated. Honest gaps: competency-graph edges sparse (`onto_relationships`=7), governance/explainability review loop unexercised (`gov_*` empty), capability/complexity/version models scaffolded-empty, legacy `competency_*` + `ont_*` are intentional empty shells (extend `onto_*`, never fork). **IMPORTANT:** this phase's exact-count method exposed that Phases 1.18–1.22 used the unreliable `n_live_tup` estimate and under-reported population — 1.21 (Learning) and 1.22 (Career) "dormant/empty" findings are materially wrong (e.g. `map_role_competency`=52,362 reported as 0; `skills`=131, `learn_outcomes`=54 reported as 0) and should be regenerated with exact counts; 1.18–1.20 need re-verification; 1.17 (exact-count) stands. Competency ≠ Skill ≠ Capability; AI ≠ Competency Evaluator; human remains responsible; competencies describe capability, not destiny.
