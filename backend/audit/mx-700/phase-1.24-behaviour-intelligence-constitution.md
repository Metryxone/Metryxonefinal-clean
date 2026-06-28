# CAPADEX 2.0 — Phase 1.24: Behaviour Intelligence Constitution (Behaviour Genome + Behaviour Graph + Behaviour Intelligence Engine)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Behaviour Intelligence Constitution. **Do not rebuild, do not create a second behaviour engine, do not replace the Behaviour Engine, do not create Behaviour V2, do not modify business logic, do not activate dormant behaviour capabilities, do not bypass Assessment / Concern / Decision / Learning / Career Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via **exact `SELECT COUNT(*)`** (live `DATABASE_URL` + repo on 2026-06-28 — **NEVER `n_live_tup`**, per spec PART 1); *judgement* = DERIVED. Behaviour Intelligence is the scientific foundation of the platform (Signals→Patterns→Constructs→Models→Graph→Intelligence→downstream). **Behaviour ≠ Personality ≠ Emotion · Emotion ≠ Mood · Mood ≠ Mental Health · Behaviour ≠ Diagnosis · Concern ≠ Behaviour · Signal ≠ Behaviour · Pattern ≠ Behaviour · Behaviour ≠ Prediction · Prediction ≠ Outcome · Evidence ≠ Confidence · Confidence ≠ Accuracy · Coverage ≠ Confidence · Behaviour Strength ≠ Concern Severity · Positive Behaviour ≠ Absence of Concern · AI ≠ Behaviour Scientist.** built ≠ activated; flag-ON ≠ runtime-active; null ≠ 0. Human remains responsible. Behaviour never diagnoses, labels people, defines identity, or guarantees outcomes; behaviour is dynamic and continuously evolves.
> **Basis:** exact-count audit of the behaviour/signal/pattern/concern substrate + Phase 1.18–1.23 constitutions + memory (`behaviour-namespace-alignment`, `atomic-bridge-general-concern`, `concern-signal-mapping`, `bridge-tag-coverage`, `capadex-composite-activation`, `capadex-ontology-self-bootstrap`, `clarity-xlsx-import-quality`, `n-live-tup-stale-population-audit`; strengths canon = `replit.md` + `behavior-graph-consumer`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.24.

---

## PART 1 — Current Behaviour Intelligence Audit (MEASURED, exact COUNT\*; n_live_tup NOT used)

| Component | Table(s) / files | **Live count** | Class |
|---|---|---|---|
| Behaviour engines (code) | `services/behavioral-signal-engine.ts`, `pattern-engine.ts`, `behavior-graph-service.ts`, `composite-signal-engine.ts`, `behavioural-memory.ts`, `signal-*`, `concern-signal-*` (~30 files) | present | **LIVE (code)** |
| Behaviour routes (code) | `routes/behavioural-intelligence.ts`, `behavioural-signals.ts`, `signal-capture.ts`, `behavioural-memory.ts`, `capadex-concern-signal-map.ts` | present | **LIVE (code)** |
| Signal genome — TI side | `ti_signal_master` **300** · `ti_signal_competency_map` **45** | populated | **LIVE** |
| Signal genome — CAPADEX seed | `capadex_signals` | **21** | **SEEDED** (small) |
| Atomic / linguistic signal ontology | `capadex_atomic_signals` **0** · `capadex_linguistic_signals` **0** · `capadex_signal_profiles` **0** | **0** | **EMPTY** (docs claim ~15,972 atomic — NOT present live) |
| Concern ontology hub | `capadex_concerns_master` **0** · `capadex_clarity_questions` **0** · `capadex_concern_clarity_map` **0** · `concern_areas`/`concern_families`/`normalized_concern_ontology` **0** | **0** | **EMPTY** (docs claim ~2,489 concerns / ~30,638 clarity — NOT present live) |
| Pattern engine (materialized) | `signal_patterns` **0** · `longitudinal_patterns` **0** · `longitudinal_pattern_events` **0** | **0** | **DORMANT** |
| Behaviour graph | `capadex_behavior_graph` | **1** | **SEEDED** (seed node only) |
| Behaviour memory | `capadex_behavioural_memory` **3** · `behavioural_memory` **0** | 3 / 0 | **PARTIAL** |
| Insights / hypotheses | `behavioural_insights` **0** · `behavioural_hypotheses` **0** · `behavioural_signals` **1** · `signal_history` **1** | ~0 | **DORMANT** |
| Runtime session spine (Postgres) | `capadex_sessions` **0** · `capadex_session_signals` **1** · `capadex_session_patterns` **0** · `capadex_session_composites` **0** · `capadex_session_interventions` **0** · `capadex_session_telemetry` **2** | ~0 | **DORMANT** |
| Alt ontology graph | `omega_ontology_nodes` **40** · `omega_ontology_edges` **26** | populated-small | **PARTIAL** |
| Concern→signal mapping | `capadex_concern_signal_map` **0** · `capadex_bridge_tag_signal_grounding` **0** | **0** | **EMPTY** |
| Behaviour taxonomy (alt) | `behavior_categories`/`behavior_library`/`archetype_behavior_profile` | **0** | EMPTY |

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **Behaviour Intelligence is the exact inverse of Competency Intelligence (Phase 1.23): its ENGINE CODE is the richest layer in the platform (~30 signal/pattern/graph/memory/concern engines + dedicated routes), but its live DATA substrate is largely EMPTY / DORMANT.** Specifically — the documented CAPADEX behaviour ontology (`replit.md`: ~2,489 concerns master · ~30,638 clarity questions · 4-tier signal hub with ~15,972 atomic signals) **is NOT present in the live shared Postgres** (`capadex_concerns_master`=0, `capadex_clarity_questions`=0, `capadex_atomic_signals`=0). These tables EXIST but hold zero rows — a textbook *table-existence ≠ population* gap; **reporting the documented design counts as if they were live would be fabrication.** The runtime behaviour spine is dormant (`capadex_sessions`=0; signals/patterns/composites/interventions ≈ 0), the behaviour graph is seed-only (1 node), and patterns are unmaterialized (0). The genuinely populated behaviour-signal substrate is the **Talent-Intelligence signal master** (`ti_signal_master`=300, `ti_signal_competency_map`=45), a small CAPADEX signal seed (21), and a small OMEGA ontology graph (40 nodes / 26 edges). **So Behaviour Intelligence is BUILT (code LIVE) but largely UNACTIVATED at the data layer** — consistent with the runtime-dormant findings of Phases 1.18–1.20 (which, despite using the discredited `n_live_tup`, were directionally correct for the runtime spine; this phase confirms it by exact count and additionally exposes the ontology-hub emptiness).

**⚠️ MEASUREMENT CAVEAT (Mongo not measurable here):** part of the CAPADEX behaviour runtime is **MongoDB-resident**, and `MONGODB_URI` is **absent in this environment**. This audit therefore measures the **Postgres substrate only**; any Mongo-resident sessions/signals are **NOT measurable** and are neither counted as present nor asserted as empty. The "runtime DORMANT" verdict is scoped to Postgres. (`capadex_session_telemetry`=2 and `capadex_session_signals`=1 confirm at least some runtime is Postgres-side and near-zero.)

**Strengths (DERIVED):** the engine/code layer is the most complete in the platform (signal capture → pattern → composite → graph → memory → concern-signal mapping all implemented); strengths-canon is enforced in code (strengths derive ONLY from positive behaviour evidence / positive growth — NEVER from concern severity or negative signal magnitude, per spec PART 10 and `replit.md`); concern ≠ behaviour and bridge-tags-canonical separation is honoured (PART 17); `ti_signal_master`=300 is a real, populated signal taxonomy. **Technical debt / GAPS (DERIVED):** CAPADEX concern/clarity/atomic ontology empty in live DB (docs describe a populated state not present here — import/seed never run in this env, see `clarity-xlsx-import-quality`); runtime spine dormant (≈0 completed sessions Postgres-side); behaviour graph seed-only; patterns unmaterialized; concern→signal grounding empty; Mongo runtime unmeasurable. **Dormant:** runtime session pipeline, pattern materialization, behaviour graph aggregation, insights/hypotheses — present in code, ~0 rows. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Behaviour Philosophy

Behaviour Intelligence exists to Observe · Understand · Measure · Explain · Predict · Guide · Improve · Evolve. **It never diagnoses, labels people, defines identity, or guarantees outcomes. Behaviour is dynamic and continuously evolves.**

## PART 3 — Behaviour Domain Architecture

Domains: Behaviour Core · Engine · Graph · Genome · Signals · Patterns · Models · Analytics · Reports · AI · Governance.

## PART 4 — Behaviour Engine Constitution

The Behaviour Engine remains **the only Behaviour Intelligence Engine. Never replace it · never create Behaviour V2 · never duplicate Behaviour Intelligence — enhance only.** Protect Behaviour logic · memory · pipeline · explainability. Binding: ~30 engines extend ONE pipeline (signal→pattern→composite→graph→memory); no fork.

## PART 5 — Behaviour Signal Constitution

Protect Signal capture · processing · weighting · provenance · quality · timeline · evolution. **Signals are immutable observations.** Binding: runtime keys off `atomic_signal_id` not bridge tag (`atomic-bridge-general-concern`); the populated signal taxonomy today is `ti_signal_master` (300) + CAPADEX seed (21); CAPADEX atomic ontology empty live.

## PART 6 — Behaviour Pattern Constitution

Protect Pattern detection · recognition · relationships · evolution · confidence · timeline. **Patterns originate from Signals. Never fabricate patterns.** Binding: pattern tables unmaterialized (0) — patterns are computed on demand, not persisted; honest gap, not a defect to "fill."

## PART 7 — Behaviour Graph Constitution

Protect Behaviour nodes · relationships · dependencies · evolution · timeline · provenance. **Graph remains canonical.** Binding: `capadex_behavior_graph`=1 (seed) — graph aggregator built but unexercised; densify only via real captured signals, never fabricate nodes.

## PART 8 — Behaviour Genome Constitution

Protect Behaviour dimensions · factors · constructs · clusters · relationships · taxonomy. **Never duplicate behaviour taxonomy.** Binding: projection routes concern keys → construct dims as deficit with NEUTRAL CAP (≤50, never a strength); positive evidence wins (`behaviour-namespace-alignment`).

## PART 9 — Behaviour Evidence Constitution

Evidence originates from Assessments · Behaviour signals · Patterns · Learning · Career · Longitudinal history · Validated outcomes; contains Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 10 — Behaviour Strength Constitution

**Strengths originate ONLY from positive behaviour evidence, positive growth, validated strength factors. NEVER from concern severity, negative signal magnitude, or risk scores. Behaviour strengths and concern severity remain independent axes.** Binding: this is the platform's load-bearing strengths-canon (`replit.md` + `behavior-graph-consumer`) — any enhancement that derives a strength from a concern signal is a violation.

## PART 11 — Behaviour Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Behaviour stability · Behaviour consistency · Trust. **Never combine into one metric.** Binding: Confidence ≠ Accuracy; Coverage ≠ Confidence.

## PART 12 — Behaviour Explainability Constitution

Every behaviour explanation includes Why · Evidence · Signals · Patterns · Relationships · Confidence · Alternatives · Limitations.

## PART 13 — Behaviour AI Constitution

**AI explains · summarizes · compares · supports · personalizes. AI never diagnoses · never labels people · never invents behaviour · never bypasses governance.** Binding: AI ≠ Behaviour Scientist; AI-inert paths return null≠0.

## PART 14 — Behaviour Analytics Constitution

Protect Behaviour KPIs · Trends · Growth · Stability · Distribution · Evolution · Population analytics. **Honest gap:** with runtime dormant + ontology empty live, population analytics are below any cohort floor — abstain, never synthesize.

## PART 15 — Behaviour Report Constitution

Every report contains Behaviour summary · Behaviour graph · Signals · Patterns · Evidence · Confidence · Recommendations · Next development.

## PART 16 — Longitudinal Behaviour Constitution

Protect Behaviour history · evolution · stability · growth · timeline. **Never overwrite behaviour history.** Binding: append-only; longitudinal tables empty live (no longitudinal series yet).

## PART 17 — Concern Relationship Constitution

Protect the relationship between Behaviour · Concern · Clarity · Signals · Bridge tags · Constructs · Binding rules. **Concern IDs never replace Bridge Tags · Bridge Tags remain canonical · Concern Severity never equals Behaviour Strength.** Binding: `concern_id` is DISJOINT from `concerns_master` (only working join is `master_bridge_tag`); concern→signal grounding empty live (`concern-signal-mapping`, `bridge-tag-coverage`).

## PART 18 — Enterprise Behaviour Constitution

Support Behaviour analytics · Leadership / Team / Organization behaviour · Benchmarking · Development. **Human approval required.** Binding: k-anonymity ≥30; tenant isolation.

## PART 19 — SuperAdmin Behaviour Constitution

Support Behaviour models · Signal rules · Pattern rules · Behaviour policies · Analytics · Reports · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`.

## PART 20 — Behaviour Security Constitution

Protect Behaviour data · Evidence · Reports · Permissions · Consent · PII · Tenant isolation. Binding: PII masked in audit artifacts.

## PART 21 — Behaviour Observability

Monitor Behaviour engine · Signal engine · Pattern engine · Graph · Latency · Failures · Coverage · Quality. **Honest gap:** empty runtime = observability has nothing to surface yet; absence ≠ healthy-zero.

## PART 22 — Behaviour Testing Constitution

Standardize Signal · Pattern · Graph · Behaviour · Regression · Performance tests.

## PART 23 — Behaviour Documentation

Maintain Behaviour catalog · Signal catalog · Pattern catalog + Behaviour API guide + Analytics guide. SSOT: `docs/CAPADEX.md` + `.agents/memory/*`.

## PART 24 — Behaviour Governance

Every enhancement answers: Why is Behaviour changing? · What existing capability is reused? · Does this duplicate Behaviour Intelligence? · Does this preserve Behaviour Science? · Does this preserve Concern Intelligence?

## PART 25 — Behaviour Quality Gates

Verify Behaviour engine reused · Signals reused · Patterns reused · Behaviour graph reused · Assessment reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 26 — Behaviour Review Board

```
Founder[ ] BehaviourScientist[ ] BehaviourArchitect[ ] AssessmentArchitect[ ] DecisionArchitect[ ] LearningArchitect[ ] AIArchitect[ ]
Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 27 — Behaviour Definition of Done

- [ ] Existing Behaviour Engine reused · [ ] Signals preserved · [ ] Patterns preserved · [ ] Behaviour Graph preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] History preserved · [ ] Documentation updated · [ ] No regressions.

## PART 28 — Behaviour Maturity Model

| Component | Current (DERIVED, exact-count) | Target |
|---|---|---|
| Behaviour Engine (code) | **L4 Intelligent** (richest code layer) | L5 Continuous |
| Behaviour Graph | L1 Operational (seed node only) | L4 Intelligent |
| Signals | L2 Guided (TI master 300 live; CAPADEX atomic empty) | L4 Intelligent |
| Patterns | L1 Operational (unmaterialized) | L4 Intelligent |
| Behaviour Models | L1 Operational (runtime dormant) | L3 Adaptive |
| Analytics | L1 Operational (no cohort) | L4 Intelligent |
| Reports | L2 Guided (composers built) | L4 Intelligent |
| Enterprise Behaviour | L1 Operational | L3 Adaptive |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Continuous Behaviour Intelligence. **Roadmap (separate approved phases):** seed/import the CAPADEX concern + clarity + atomic ontology into the live DB (the engines are ready; the data is absent) → drive real runtime sessions so signals/patterns/composites/graph materialize → grow longitudinal series past cohort floor for honest analytics → keep ONE engine, immutable signals, append-only history, multi-axis confidence, strengths-from-positive-only, AI-never-diagnoses. **Behaviour describes capability over time; it does not define identity or destiny.**

## PART 29 — Behaviour Scientific Validation

Document Behaviour science · Behavioural psychology · Cognitive science · Behaviour analytics · Measurement · Longitudinal behaviour science · Evidence quality · Bias review · Ethics · Population applicability.

## PART 30 — Behaviour Evolution Strategy

Future evolution supports New behaviour / graph / signal / pattern models · new AI behaviour assistants · new enterprise behaviour programs — **without breaking** Assessment · Conversation · Decision · Learning · Career · Intervention · Concern · Enterprise Intelligence. (Additive + flag-gated; byte-identical flag-OFF.)

---

## PART 31 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Behaviour Intelligence Constitution | all | 14 | Behaviour Report Constitution | P15 |
| 02 | Repository Behaviour Audit | P1 | 15 | Longitudinal Behaviour Constitution | P16 |
| 03 | Behaviour Engine Constitution | P4 | 16 | Concern Relationship Constitution | P17 |
| 04 | Behaviour Signal Constitution | P5 | 17 | Enterprise Behaviour Constitution | P18 |
| 05 | Behaviour Pattern Constitution | P6 | 18 | SuperAdmin Behaviour Constitution | P19 |
| 06 | Behaviour Graph Constitution | P7 | 19 | Behaviour Governance Constitution | P24 |
| 07 | Behaviour Genome Constitution | P8 | 20 | Behaviour Quality Gates | P25 |
| 08 | Behaviour Evidence Constitution | P9 | 21 | Behaviour Review Board | P26 |
| 09 | Behaviour Strength Constitution | P10 | 22 | Behaviour Definition of Done | P27 |
| 10 | Behaviour Confidence Constitution | P11 | 23 | Behaviour Scientific Validation | P29 |
| 11 | Behaviour Explainability Constitution | P12 | 24 | Behaviour Evolution Strategy | P30 |
| 12 | Behaviour AI Constitution | P13 | 25 | Behaviour Maturity Assessment | P28 |
| 13 | Behaviour Analytics Constitution | P14 | | | |

---

**STOP — Phase 1.24 complete; Behaviour Intelligence Constitution ready to FREEZE on approval. Behaviour Engine not modified, Behaviour Intelligence not replaced, no second behaviour engine created, no dormant behaviour capabilities activated, business logic not changed, Assessment + Concern + Decision + Learning + Career Intelligence not bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (`n_live_tup` NOT used, per spec). **Behaviour Intelligence is BUILT but largely UNACTIVATED at the data layer** — the engine code is the richest in the platform, but the documented CAPADEX concern/clarity/atomic ontology (~2,489 / ~30,638 / ~15,972 per `replit.md`) is **NOT present in the live DB (0/0/0)**, the runtime session spine is dormant (Postgres ≈0), the behaviour graph is seed-only (1 node), and patterns are unmaterialized. The genuinely populated signal substrate is `ti_signal_master`=300 (+ `ti_signal_competency_map`=45), a small CAPADEX seed (21), and OMEGA ontology (40/26). **Mongo caveat:** `MONGODB_URI` is absent, so MongoDB-resident runtime is NOT measurable — the runtime verdict is Postgres-scoped only. Signal ≠ Behaviour; Pattern ≠ Behaviour; Behaviour Strength ≠ Concern Severity (independent axes); AI ≠ Behaviour Scientist; human remains responsible; behaviour is dynamic and does not define identity.
