# CAPADEX 2.0 — Phase 1.10: Behaviour Intelligence Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Behaviour Intelligence Constitution. **Do not rebuild, do not replace the Behaviour engine, do not create a second behaviour model, do not regenerate the ontology, do not recreate Concern Master, do not replace Competencies, do not rebuild the Behaviour graph, do not activate dormant capabilities, do not change behaviour science, do not change business logic.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Behaviour Intelligence is the core IP — never duplicate, never bypass, never regenerate. **Strengths come ONLY from positive factors, never from raw concern-signal magnitude.** Coverage (data exists) ⟂ Confidence (trustworthy) kept SEPARATE; null ≠ 0; built ≠ activated; seeded-in-design ≠ populated-in-this-DB.
> **Basis:** live behaviour-substrate audit + Phase 1.2–1.9 constitutions + memory (`competency-ontology-architecture`, `concern-signal-mapping`, `bridge-tag-coverage`, `clarity-bridge-tag-classifier`, `atomic-bridge-general-concern`, `kg-table-name-collision`, `merged-task-data-not-in-live-db`, `behaviour-graph-consumer`, `peer-benchmarking`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.10.

---

## PART 1 — Current Behaviour Intelligence Audit (MEASURED)

| Substrate | Design/seed scale (replit.md) | **This live shared DB** | Note |
|---|---|---|---|
| Competency genome `onto_competencies` | 419-genome | **422** | POPULATED — canonical authority |
| Ontology domains `onto_domains` | 20 | **6** | partial in live DB |
| Ontology families `onto_families` | 400 | **33** | partial in live DB |
| Concern Master `capadex_concerns_master` | ~2,489 | **0** | EMPTY here (seeded in isolated/seed envs) |
| Clarity questions `capadex_clarity_questions` | ~30,638 | **0** | EMPTY here |
| Atomic signals `capadex_atomic_signals` | 15,972 | **0** | EMPTY here |
| Concern→Signal map `capadex_concern_signal_map` | curated | **0** | EMPTY here |
| Concern→Clarity map `capadex_concern_clarity_map` | curated | **0** | EMPTY here |
| Behaviour graph `kg_*` | live Employability graph | **1 table present** | ⚠️ `pil_kg_*` is the SEPARATE PIL graph |
| Runtime behaviour `capadex_session_*` | spine | **6 tables present** | composite/pattern/intervention spine |

**CRITICAL HONEST FINDING (DERIVED):** the competency genome is populated in this live DB, but the **CAPADEX concern / clarity / atomic-signal masters read 0 here.** Per the "merged backfills don't reach the live DB" canon, task-agent seeds land in isolated envs; merge carries DDL not rows. So "table exists + design says ~2,489" ≠ "populated in this DB." **Coverage of the behaviour substrate in this environment is partial; this is an honest finding, never to be papered over with the design-scale numbers.** Re-seed is an explicit, approved operation — NOT performed here.

**Strengths (DERIVED):** world-class 4-tier signal ontology design; curated concern↔signal↔clarity bridges; append-only history; strengths-canon discipline; behaviour graph + runtime spine. **Technical debt (DERIVED):** live-DB population gap (above); bridge joins are convention-only and partly DISJOINT (`clarity.concern_id` 0% join — only `master_bridge_tag` works); `GENERAL_CONCERN` catch-all (mostly positive strengths, correct-not-bug); name-collision risk (`pil_kg_*` vs bare `kg_*`). **Dormant:** several `competency_graph_*/propagation/fusion/ucip_*/sci_*` phases scaffolded-but-unactivated (empty → parkable) — DOCUMENT, never activate.

---

## PART 2 — Behaviour Philosophy

Behaviour is the foundation of CAPADEX. Assessment measures it · AI understands it · Decision uses it · Journey improves it · Learning develops it · Career reflects it · Life evolves it · Enterprise understands it · Reports explain it. **Nothing bypasses Behaviour Intelligence.**

## PART 3 — Behaviour Domain Architecture

Domains: Behaviour Core · Ontology · Intelligence · Analytics · Reports · Journey · Prediction · Recommendation · Benchmark · Evolution · Evidence · Confidence · Explainability · Governance. **Every behaviour capability belongs to ONE domain.**

## PART 4 — Behaviour Ontology Constitution

Protect Ontology · Competencies · Signals · Relationships · Hierarchy · Dimensions · Factors · Weights · Mappings · Dependencies. **Never regenerate; never replace; extend only; version every enhancement.** Binding: the competency framework IS the `onto_*` genome + `competency_question_templates` + `competency-runtime(-v2)` scoring; legacy `competency_*` are EMPTY shells (reads fall back to `onto_*`) — extend canonical surfaces, never a parallel namespace.

## PART 5 — Signal Architecture Constitution

Protect Behaviour · Concern · Composite · Positive · Risk · Growth · Context · Temporal · Environmental signals. Every signal documents Origin · Meaning · Evidence · Confidence · Consumers · Dependencies. Binding: 4-tier (20 domains · 400 families · 20 signals · 15,972 atomic) by design; runtime keys off `atomic_signal_id` NOT bridge tag; the atomic catch-all is mostly POSITIVE strengths (correct).

## PART 6 — Concern Intelligence Constitution

Protect Concern Master · Taxonomy · Categories · Hierarchy · Relationships · Bridge tags · Dependencies · Evolution · Trends · Mapping. **Never duplicate; never regenerate; enhance incrementally.** ⚠️ Binding: clarity↔master join is bucket-level (`master_bridge_tag = relational_bridge_tag`); `concern_id` is DISJOINT (0% join); token-semantic matching is PRIMARY, orphans flagged never fabricated; one shared resolver (runtime + tooling import the SAME one).

## PART 7 — Competency Intelligence Constitution

Protect Behaviour · Learning · Career · Leadership · Enterprise · Role · Future competencies + Evolution · Relationships · Benchmarks. Binding: 12-layer hierarchy (`ont_/map_/ref_/ver_/lfc_/gov_`); CAPADEX bridge via `concern_bridge_tag` NOT `concern_id`; dual ledger (`onto_competency_profiles` runtime / `onto_competency_score_runs` normalized).

## PART 8 — Behaviour DNA Constitution

Behaviour DNA = unique behavioural identity. Protect Profile · Signature · Pattern · Evolution · Traits · Relationships · Strengths · Development. **Never fabricate DNA; never overwrite history.** Binding: runtime persona ≠ user-selected; behaviour NULL when no graph (never derived from a score).

## PART 9 — Behaviour Graph Constitution

Protect Nodes · Edges · Relationships · Communities · Dependencies · Influences · Strength · Direction · Evolution · Graph history · Explainability. **Every graph relationship must be explainable.** ⚠️ Binding: `pil_kg_*` namespace ONLY — NEVER bare `kg_*` (bare `kg_*` is the live Employability graph; a PIL materialize against it would WIPE it).

## PART 10 — Behaviour Evidence Constitution

Evidence comes from Assessments · Signals · Historical behaviour · Journey · Learning · Career · AI · Enterprise · Longitudinal progress. Evidence always includes Source · Timestamp · Quality · Reliability · Coverage · Confidence. **Never fabricate evidence.**

## PART 11 — Behaviour Confidence Constitution

**Separate** Evidence · Coverage · Confidence · Probability · Trust. **Confidence never guessed; confidence always explains itself.** Binding: Coverage (data exists) ⟂ Confidence (trustworthy/sufficient) NEVER composited; abstain below k_min=30; pg `COUNT()` returns STRINGS (`Number()` before compare); null over score cols → NaN before `isFinite` (never 0).

## PART 12 — Behaviour Explainability Constitution

Every behaviour insight explains Why · Evidence · Signals · Concerns · Competencies · Alternatives · Confidence · Limitations · Historical comparison · Future projection. Binding: empty-spine concerns get ONE low-confidence general-support insight built read-only at `/explain` (never seeded → can't inflate composites/patterns).

## PART 13 — Behaviour Evolution Constitution

Track Historical behaviour · Change · Growth · Regression · Stability · Trends · Milestones · Timeline. **Never replace history.** Binding: append-only history (`p4_competency_history`, `m3_*`, `ei_profile_snapshots`) never mutated in place; risk dims invert direction; ≥2 MEASURED gate before a trend.

## PART 14 — Longitudinal Behaviour Constitution

Protect Timeline · Growth · Assessments · Learning · Career · Life · Behaviour history · Recommendations · Decision history. **Every longitudinal record is immutable.** Binding: 0 snapshots → 0% honest; longitudinal denom = longitudinal users, not all sessions.

## PART 15 — Behaviour Prediction Constitution

Predictions require Evidence · Confidence · Behaviour trends · Journey · Learning · Career · Life · Enterprise; explain Why · Confidence · Limitations · Alternatives. **Never fabricate predictions.** Binding: outputs are developmental signals only — NEVER hiring/promotion/suitability predictions (allowed/disallowed term lists on every envelope).

## PART 16 — Behaviour Recommendation Constitution

Every recommendation includes Behaviour drivers · Evidence · Confidence · Journey/Learning/Career/Life/Enterprise impact · Priority · Next action. Binding: recommendation confidence deterministic (gap/transferability/mobility); abstain rather than fabricate.

## PART 17 — Behaviour Benchmark Constitution

Protect Peer · Industry · Institution · Role · Age · Career · Learning benchmarks + Benchmark confidence + coverage. **Never compare insufficient populations** — k-anonymity suppresses below k_min=30; cohort responses aggregate-only.

## PART 18 — Behaviour Analytics Constitution

Protect Behaviour KPIs · Trends · Distribution · Clusters · Heatmaps · Forecasts · Adoption · Outcomes. **Never mix measured and derived metrics** (Coverage ⟂ Confidence). Most analytics recomputed read-time (MV opportunity per 1.7 P22).

## PART 19 — Behaviour Report Constitution

Every behaviour report contains Behaviour summary · DNA · Evidence · Confidence · Journey · Learning · Career · Recommendations · Benchmarks · Explainability · Next steps. Binding: report tone hopeful/light; preview ↔ report share ONE visual canon.

## PART 20 — Behaviour Journey Constitution

Every behaviour profile creates Behaviour · Growth · Learning · Career · Leadership · Life · Enterprise journeys. **The behaviour journey never ends.** Growth-plan EXISTS in M5 (wire, don't rebuild).

## PART 21 — Behaviour AI Constitution

**AI consumes behaviour; AI never creates behaviour. AI explains behaviour; AI recommends improvements. AI cannot modify behaviour evidence.** (Cross-ref Phase 1.9 P9.)

## PART 22 — Behaviour Security Constitution

Protect Behaviour data · PII · Evidence · Confidence · Predictions · Recommendations · Enterprise behaviour · Permissions · Consent · Privacy. Binding: tenant-scope every read; audit-artifact PII masked to `user_<sha256>`; consent gates (parent/enterprise) on distinct axes.

## PART 23 — Behaviour Observability

Monitor Behaviour engine · Signal processing · Ontology · Confidence · Evidence · Predictions · Recommendations · Latency · Failures · Quality. **Honest gap:** no central behaviour-engine observability dashboard today — TARGET; existence ≠ population (live-substrate gap from P1 is the first thing to surface).

## PART 24 — Behaviour Testing

Standardize Signal · Ontology · Graph · Confidence · Evidence · Recommendation · Prediction · Regression tests. Current: simulation harness exists (allowed to FAIL — never tune to force a pass). Grounding/regression coverage is partial (GAP).

## PART 25 — Behaviour Documentation

Maintain Ontology · Signal · Concern · Competency catalogs + Behaviour DNA · Evidence · Confidence · Prediction · Recommendation guides. SSOT: `docs/CAPADEX.md` + `docs/phase-history.md` Phase Index Tables + `.agents/memory/*`.

## PART 26 — Behaviour Governance

Every behaviour enhancement answers: Why is behaviour changing? · What existing capability is reused? · Does this duplicate behaviour logic? · Does this improve scientific validity? · Does this preserve behaviour history? · Does this improve user outcomes?

## PART 27 — Behaviour Quality Gates

Verify Behaviour engine reused · Ontology reused · Concern Master reused · Competencies reused · Signals reused · Evidence exposed · Confidence exposed · Explainability complete · History preserved · Documentation updated.

## PART 28 — Behaviour Review Board

```
Founder[ ] BehaviourScientist[ ] ChiefPsychologist[ ] AIArchitect[ ] Product[ ]
Enterprise[ ] Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 29 — Behaviour Definition of Done

- [ ] Existing behaviour reused · [ ] Ontology preserved · [ ] Signals preserved · [ ] Concern Master preserved · [ ] Competencies preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] History preserved · [ ] Recommendations validated · [ ] Documentation updated · [ ] No regressions.

## PART 30 — Behaviour Maturity Model

| Domain | Current (DERIVED) | Target |
|---|---|---|
| Behaviour engine | L3 Explainable | L4 Predictive |
| Ontology | L3 Explainable (design) / L2 in live DB | L4 Predictive |
| Signals | L2 Measured (live-substrate gap) | L4 Predictive |
| Concern Intelligence | L2 Measured (live 0) | L3 Explainable |
| Competency Intelligence | L3 Explainable | L4 Predictive |
| Behaviour graph | L3 Explainable | L4 Predictive |
| Behaviour DNA | L2 Measured | L3 Explainable |
| Predictions | L2 Measured | L3 Explainable |
| Recommendations | L3 Explainable | L4 Predictive |
| Reports | L3 Explainable | L4 Predictive |
| Enterprise behaviour | L2 Measured | L4 Predictive |

Levels: 1 Operational · 2 Measured · 3 Explainable · 4 Predictive · 5 Behaviour Intelligence Excellence. **Roadmap:** (separate approved op) re-seed the live concern/clarity/atomic substrate so live ≈ design scale → behaviour-engine observability (surface coverage gaps) → grounding/regression test coverage → retire `GENERAL_CONCERN` by sibling remap (never bulk-gen) → (separate approved phase) activate dormant competency-graph phases.

## PART 31 — Behaviour Scientific Validation

Every behaviour enhancement documents Scientific basis · Behaviour theory · Psychological basis · Measurement validity · Reliability · Norms · Bias review · Cultural validation · Population applicability · Ethical considerations. **No behaviour model may be introduced without scientific justification.**

## PART 32 — Behaviour Evolution Strategy

Future evolution supports New behaviour models · concern domains · competencies · ontology extensions · industries · age groups · enterprise models · AI capabilities · longitudinal models — **without breaking** existing engine · history · reports · journeys · assessments · AI. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 33 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Behaviour Intelligence Constitution | all | 15 | Behaviour Recommendation Constitution | P16 |
| 02 | Behaviour Architecture Report | P1 | 16 | Behaviour Benchmark Constitution | P17 |
| 03 | Behaviour Ontology Constitution | P4 | 17 | Behaviour Analytics Constitution | P18 |
| 04 | Signal Architecture Constitution | P5 | 18 | Behaviour Report Constitution | P19 |
| 05 | Concern Intelligence Constitution | P6 | 19 | Behaviour Journey Constitution | P20 |
| 06 | Competency Intelligence Constitution | P7 | 20 | Behaviour AI Constitution | P21 |
| 07 | Behaviour DNA Constitution | P8 | 21 | Behaviour Security Constitution | P22 |
| 08 | Behaviour Graph Constitution | P9 | 22 | Behaviour Governance Constitution | P26 |
| 09 | Behaviour Evidence Constitution | P10 | 23 | Behaviour Quality Gates | P27 |
| 10 | Behaviour Confidence Constitution | P11 | 24 | Behaviour Review Board | P28 |
| 11 | Behaviour Explainability Constitution | P12 | 25 | Behaviour Definition of Done | P29 |
| 12 | Behaviour Evolution Constitution | P13 | 26 | Behaviour Scientific Validation | P31 |
| 13 | Longitudinal Behaviour Constitution | P14 | 27 | Behaviour Evolution Strategy | P32 |
| 14 | Behaviour Prediction Constitution | P15 | 28 | Behaviour Maturity Assessment | P30 |

---

**STOP — Phase 1.10 complete; Behaviour Intelligence Constitution ready to FREEZE on approval. No behaviour engine modified, no ontology regenerated, no Concern Master recreated, no competencies replaced, no behaviour graph rebuilt, no dormant behaviour intelligence activated, no behaviour science changed, no business logic changed.**
Honesty caveats: counts are MEASURED from the live shared Postgres today — competency genome IS populated (`onto_competencies` 422 / `onto_domains` 6 / `onto_families` 33) but the **CAPADEX concern / clarity / atomic-signal masters and their bridge maps read 0 in THIS DB** (design/seed scale ~2,489 / ~30,638 / 15,972 lives in isolated/seeded envs — merge carries DDL not rows). This live-substrate population gap is an HONEST finding, never to be replaced with design-scale numbers; re-seeding is a separate approved operation, NOT done here. Dormant competency-graph phases are documented, not activated.
