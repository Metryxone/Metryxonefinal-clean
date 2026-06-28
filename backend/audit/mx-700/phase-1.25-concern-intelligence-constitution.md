# CAPADEX 2.0 — Phase 1.25: Concern Intelligence Constitution (Concern Master + Bridge Tags + Clarity Engine + Concern Graph)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Concern Intelligence Constitution. **Do not rebuild, do not create a second concern engine, do not replace Concern Master, do not create Concern V2, do not fork concern ontology, do not modify business logic, do not activate dormant concern capabilities, do not bypass Behaviour / Assessment / Bridge Tags / Decision / Learning Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via **exact `SELECT COUNT(*)`** (live `DATABASE_URL` + repo on 2026-06-28 — **NEVER `n_live_tup`**, per spec PART 1); *judgement* = DERIVED. Concern Intelligence is the semantic interpretation layer (concern↔clarity↔bridge-tag↔behavioural-evidence↔context↔longitudinal). **Concern ≠ Behaviour ≠ Diagnosis ≠ Disorder ≠ Risk ≠ Identity ≠ Personality ≠ Emotion · Concern Severity ≠ Behaviour Strength · Bridge Tag ≠ Concern ID · Concern Master ≠ Runtime Concern · Clarity Question ≠ Concern · Concern Resolution ≠ Treatment · Evidence ≠ Confidence · Confidence ≠ Accuracy · Coverage ≠ Confidence · AI ≠ Mental Health Professional.** built ≠ activated; flag-ON ≠ runtime-active; null ≠ 0. Human remains responsible. Concern Intelligence explains concerns; it never defines people, diagnoses, labels, creates disorders, assigns identity, or guarantees outcomes.
> **Basis:** exact-count audit of the concern/clarity/bridge substrate + Phase 1.24 (Behaviour) + memory (`concern-resolver-repair`, `capadex-concern-routing-fallback`, `capadex-clarity-picker-filters`, `clarity-bridge-tag-classifier`, `bridge-tag-coverage`, `concern-signal-mapping`, `orphan-concern-fallback`, `bridge-tag-orphan-remap-leakage`, `clarity-xlsx-import-quality`, `n-live-tup-stale-population-audit`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.25.

---

## PART 1 — Current Concern Intelligence Audit (MEASURED, exact COUNT\*; n_live_tup NOT used)

### Repository implementation (code)
| Component | Files | Class |
|---|---|---|
| Concern resolver | `services/concern-resolver-engine.ts` (keyword fallback, never 404s) | **LIVE (code)** |
| Clarity bridge classifier | `services/clarity-bridge-classifier.ts` (curated prefix → token heuristic → UNMAPPED) | **LIVE (code)** |
| Concern↔clarity mapping | `services/concern-clarity-mapping-engine.ts` | **LIVE (code)** |
| Concern↔signal mapping | `services/concern-signal-mapping-engine.ts` · `concern-signal-chain-validator.ts` · `concern-signal-coverage-service.ts` · `concern-signal-seeding.ts` | **LIVE (code)** |
| Fallback insight | `services/concern-fallback-insight.ts` (one low-confidence general-support insight when spine empty) | **LIVE (code)** |
| Concern routes | `routes/capadex-concerns-master.ts` · `capadex-clarity-questions.ts` · `capadex-concern-intelligence.ts` · `capadex-concern-signal-map.ts` · `concern-intelligence-admin.ts` · `ontology-concerns-mapping.ts` · `talent-concern-intelligence.ts` | **LIVE (code)** |

### Database population (exact COUNT\*)
| Component | Table | **Live count** | Class |
|---|---|---|---|
| Concern Master | `capadex_concerns_master` | **0** | **EMPTY** (docs claim ~2,489 — NOT present live) |
| Clarity Questions | `capadex_clarity_questions` | **0** | **EMPTY** (docs claim ~30,638 — NOT present live) |
| Concern↔clarity map | `capadex_concern_clarity_map` | **0** | **EMPTY** |
| Concern↔signal map | `capadex_concern_signal_map` | **0** | **EMPTY** |
| Bridge-tag signal grounding | `capadex_bridge_tag_signal_grounding` | **0** | **EMPTY** |
| Concern categories / families | `concern_areas` **0** · `concern_families` **0** · `concern_classification` **0** | **0** | **EMPTY** |
| Normalized concern ontology | `normalized_concern_ontology` **0** · `ont_concerns` **0** | **0** | **EMPTY** |
| Concern mappings | `archetype_concern_map` **0** · `map_concern_indicator` **0** · `map_micro_concern` **0** · `omega_concern_map` **0** | **0** | **EMPTY** |
| Concern↔competency hierarchy | `ti_concern_competency_hierarchy` **0** · `capability_problem_behavior_map` **0** | **0** | **EMPTY** |
| Signal↔concern map (TI side) | `ti_signal_concern_map` | **10** | **SEEDED** (tiny) |

### Runtime activation · missing imports · duplicates · broken mappings (explicit, per spec PART 1)
- **Runtime activation:** DORMANT — with Concern Master + Clarity + bridge grounding all at 0, the runtime resolver operates **entirely on deterministic keyword fallback** (`resolveCapadexConcern` never 404s by design), NOT on the canonical ontology. "Never 404s" ≠ "ontology active."
- **Missing ontology imports:** the CAPADEX concern + clarity + bridge ontology (documented ~2,489 / ~30,638) is **NOT imported into this live DB** — the xlsx import / seed has not been run in this environment (`clarity-xlsx-import-quality`). The tables EXIST; they are empty.
- **Duplicate concern structures:** multiple concern-namespace tables coexist (`capadex_concerns_master`, `normalized_concern_ontology`, `ont_concerns`, `concern_classification`, `archetype_concern_map`, `omega_concern_map`) — canonical is `capadex_concerns_master` + bridge tags; others are alt/empty. No active duplication (all empty), but the namespace is fragmented.
- **Broken mappings:** documented structural trap — `concern_id` is **DISJOINT** from `concerns_master` (0% join); the only working join is `master_bridge_tag` (bucket-level). With the bank empty, **neither** path carries data.

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **Concern Intelligence is the most extreme *built ≠ activated* case in the platform — a complete, sophisticated engine layer over an entirely EMPTY live data substrate.** Every canonical concern table (master, clarity, bridge grounding, categories, families, normalized ontology, all mappings) reads **0** by exact count; the only non-zero table is `ti_signal_concern_map`=10 (Talent-Intelligence side, tiny). The engines are deliberately designed to degrade gracefully — the resolver returns a keyword-matched concern and never 404s, and a single low-confidence general-support insight is built read-only when the spine is empty — **so the runtime appears to "work" while running 100% on fallback, with the canonical ontology absent.** The documented population (~2,489 concerns / ~30,638 clarity questions per `replit.md`) **is not present in the live shared DB**; reporting those design numbers as live would be fabrication. This is the data-side complement to Phase 1.24 (Behaviour): the concern + clarity + bridge ontology — the semantic heart of CAPADEX — is built and import-ready but **un-imported and un-activated here.**

**Strengths (DERIVED):** the engine layer is complete and honest-by-design (never-404 fallback, never-fabricate, orphan flagging, IDF-weighted resolver with concern_id as LAST tiebreak, fallback insight emitted ONLY when spine fully empty); bridge-tag-canonical separation enforced in code (`concern_id` never the join). **Technical debt / GAPS (DERIVED):** canonical ontology empty in live DB (import never run here); fragmented concern namespace (≥6 alt tables); concern→signal grounding empty; runtime runs on fallback only. **Dormant:** Concern Master, Clarity Engine bank, bridge grounding, concern graph, mappings — present in code + schema, 0 rows. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Concern Philosophy

Concern Intelligence exists to Understand · Clarify · Categorize · Contextualize · Relate · Prioritize · Explain · Guide. **It never diagnoses, labels people, creates disorders, assigns identity, or guarantees outcomes. It explains concerns — it never defines people.**

## PART 3 — Concern Domain Architecture

Domains: Concern Core · Concern Master · Bridge Tags · Master Bridge Tags · Concern Graph · Relationships · Ontology · Clarity Engine · Analytics · Reports · AI · Governance.

## PART 4 — Concern Master Constitution

Concern Master remains **the only canonical concern ontology. Never replace it · never create Concern Master V2 · never fork concern ontology — enhance only.** Protect Categories · Families · Domains · Hierarchy · Relationships · Evolution. Binding: canonical = `capadex_concerns_master` (empty live — import required); alt namespaces are empty shells, do not promote them.

## PART 5 — Bridge Tag Constitution

Bridge Tags remain **the only canonical integration mechanism. Never replace bridge tags · never join directly using `concern_id` · never duplicate bridge structures.** Protect Master bridge tags · relationships · mapping · provenance · evolution. Binding: `concern_id` is DISJOINT from `concerns_master`; the working join is `master_bridge_tag` (`clarity-bridge-tag-classifier`, `bridge-tag-coverage`).

## PART 6 — Clarity Engine Constitution

Protect Clarity questions · clarification flow · logic · categories · relationships · provenance · binding rules. **Questions clarify; questions never diagnose.** Binding: 3-tier picker (`pickQuestionsFromMaster` → `pickQuestionsFromDB` → static) with `clarity_source` provenance; with the bank empty, runtime falls to the static tier (`capadex-clarity-picker-filters`).

## PART 7 — Concern Graph Constitution

Protect Concern nodes · relationships · dependencies · evolution · timeline · provenance. **Graph remains canonical.** Binding: graph empty live — build only from imported ontology + real evidence, never fabricate nodes.

## PART 8 — Concern Relationship Constitution

Protect Concern dependencies · hierarchies · families · cross-domain · bridge · behaviour · competency relationships.

## PART 9 — Concern Evolution Constitution

Track Concern history · changes · progression · resolution · stability · timeline. **History remains append-only. Never overwrite concern history.**

## PART 10 — Concern Evidence Constitution

Evidence originates from Assessments · Behaviour · Signals · Patterns · Bridge tags · Clarity · Learning · Career · Longitudinal history; contains Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 11 — Concern Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Concern stability · Concern severity · Trust. **Never combine into one metric.** Binding: Concern Severity ≠ Behaviour Strength (independent axes); Confidence ≠ Accuracy.

## PART 12 — Concern Explainability Constitution

Every concern explanation includes Why · Evidence · Signals · Bridge tags · Relationships · Confidence · Alternatives · Limitations. Binding: fallback insight is explicitly low-confidence + general-support, emitted only when the spine is empty (`orphan-concern-fallback`).

## PART 13 — Concern AI Constitution

**AI explains · clarifies · summarizes · supports · personalizes. AI never diagnoses · never labels people · never invents concerns · never bypasses governance.** Binding: AI ≠ Mental Health Professional.

## PART 14 — Concern Analytics Constitution

Protect Concern KPIs · trends · distribution · evolution · resolution · population analytics. **Honest gap:** ontology empty + runtime fallback-only = no population analytics; abstain, never synthesize.

## PART 15 — Concern Report Constitution

Every report contains Concern summary · Concern graph · Relationships · Bridge tags · Evidence · Confidence · Recommendations · Next development.

## PART 16 — Longitudinal Concern Constitution

Protect Concern history · evolution · stability · timeline · resolution. **Never overwrite concern history.**

## PART 17 — Behaviour Integration Constitution

**Behaviour and Concern remain separate systems.** Binding chain: Signals → Patterns → Bridge Tags → Constructs → **Concern**. **Never derive Behaviour from Concern · never derive Strength from Concern Severity. Concern Intelligence CONSUMES Behaviour Intelligence** (one direction only). Binding: this is the load-bearing strengths-canon partner to Phase 1.24 PART 10.

## PART 18 — Enterprise Concern Constitution

Support Organization / Team / Learning / Career concerns · population analytics · benchmarking. **Human approval required.** Binding: k-anonymity ≥30; tenant isolation.

## PART 19 — SuperAdmin Concern Constitution

Support Concern Master · Bridge tags · Ontology rules · Concern policies · Analytics · Reports · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`; ontology import is the only canonical-population op.

## PART 20 — Concern Security Constitution

Protect Concern data · Bridge tags · Evidence · Reports · Permissions · Consent · PII · Tenant isolation. Binding: concern data is sensitive — PII masked in audit artifacts; consent-gated.

## PART 21 — Concern Observability

Monitor Concern engine · Bridge engine · Clarity engine · Concern graph · Latency · Failures · Coverage · Quality. **Honest gap:** empty ontology = coverage/quality have nothing to surface; absence ≠ healthy-zero.

## PART 22 — Concern Testing Constitution

Standardize Bridge tag · Concern · Graph · Ontology · Regression · Performance tests.

## PART 23 — Concern Documentation

Maintain Concern catalog · Bridge tag catalog · Clarity catalog + Concern API guide + Analytics guide. SSOT: `docs/CAPADEX.md` §18/§20 + `.agents/memory/*`.

## PART 24 — Concern Governance

Every enhancement answers: Why is Concern changing? · What existing capability is reused? · Does this duplicate Concern Intelligence? · Does this preserve Behaviour Intelligence? · Does this preserve Bridge Tag integrity?

## PART 25 — Concern Quality Gates

Verify Concern Master reused · Bridge tags reused · Behaviour reused · Assessment reused · Signals reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 26 — Concern Review Board

```
Founder[ ] ConcernArchitect[ ] BehaviourScientist[ ] AssessmentArchitect[ ] OntologyArchitect[ ] AIArchitect[ ]
Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 27 — Concern Definition of Done

- [ ] Existing Concern Master reused · [ ] Bridge Tags preserved · [ ] Clarity Engine preserved · [ ] Concern Graph preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] History preserved · [ ] Documentation updated · [ ] No regressions.

## PART 28 — Concern Maturity Model

| Component | Current (DERIVED, exact-count) | Target |
|---|---|---|
| Concern Master | L1 Operational (empty live; engine ready) | L4 Intelligent |
| Bridge Tags | L1 Operational (grounding empty) | L4 Intelligent |
| Clarity Engine | L2 Guided (3-tier picker built; bank empty → static tier) | L4 Intelligent |
| Concern Graph | L1 Operational (empty) | L4 Intelligent |
| Relationships | L1 Operational (mappings empty) | L3 Adaptive |
| Analytics | L1 Operational (no population) | L4 Intelligent |
| Reports | L2 Guided (composers built) | L4 Intelligent |
| Enterprise Concerns | L1 Operational | L3 Adaptive |
| **Concern engine code** | **L4 Intelligent** (resolver/classifier/fallback complete) | L5 Continuous |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Continuous Concern Intelligence. **Roadmap (separate approved phases):** import the canonical concern + clarity + bridge ontology into the live DB (engines ready; data absent) → re-run bridge-tag classifier on import + backfill `master_bridge_tag` → exercise concern→signal grounding from real runtime → consolidate the fragmented concern namespace onto `capadex_concerns_master` + bridge tags → keep ONE Concern Master, bridge-tags-canonical, append-only history, multi-axis confidence, concern-consumes-behaviour (never the reverse), AI-never-diagnoses. **Concern explains; it never defines people.**

## PART 29 — Concern Scientific Validation

Document Cognitive psychology · Behaviour science · Concern taxonomy · Ontology engineering · Knowledge representation · Semantic networks · Evidence quality · Bias review · Ethics · Population applicability.

## PART 30 — Concern Evolution Strategy

Future evolution supports New concern / bridge-tag / clarity / concern-graph models · new AI assistants · new enterprise concern programs — **without breaking** Assessment · Behaviour · Competency · Decision · Learning · Career · Intervention · Enterprise Intelligence. (Additive + flag-gated; byte-identical flag-OFF.)

---

## PART 31 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Concern Intelligence Constitution | all | 14 | Concern Report Constitution | P15 |
| 02 | Repository Concern Audit | P1 | 15 | Longitudinal Concern Constitution | P16 |
| 03 | Concern Master Constitution | P4 | 16 | Behaviour Integration Constitution | P17 |
| 04 | Bridge Tag Constitution | P5 | 17 | Enterprise Concern Constitution | P18 |
| 05 | Clarity Engine Constitution | P6 | 18 | SuperAdmin Concern Constitution | P19 |
| 06 | Concern Graph Constitution | P7 | 19 | Concern Governance Constitution | P24 |
| 07 | Concern Relationship Constitution | P8 | 20 | Concern Quality Gates | P25 |
| 08 | Concern Evolution Constitution | P9 | 21 | Concern Review Board | P26 |
| 09 | Concern Evidence Constitution | P10 | 22 | Concern Definition of Done | P27 |
| 10 | Concern Confidence Constitution | P11 | 23 | Concern Scientific Validation | P29 |
| 11 | Concern Explainability Constitution | P12 | 24 | Concern Evolution Strategy | P30 |
| 12 | Concern AI Constitution | P13 | 25 | Concern Maturity Assessment | P28 |
| 13 | Concern Analytics Constitution | P14 | | | |

---

**STOP — Phase 1.25 complete; Concern Intelligence Constitution ready to FREEZE on approval. Concern Master not modified, Concern Intelligence not replaced, no second concern engine created, no dormant concern capabilities activated, business logic not changed, Behaviour + Assessment + Bridge Tags + Decision + Learning Intelligence not bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (`n_live_tup` NOT used, per spec). **Concern Intelligence is the most extreme *built ≠ activated* case in the platform** — a complete engine layer (resolver/classifier/fallback, never-404 by design) over an **entirely EMPTY live concern data substrate**: Concern Master, Clarity Questions, bridge grounding, categories, families, normalized ontology, and all mappings read **0**; only `ti_signal_concern_map`=10. The documented ontology (~2,489 concerns / ~30,638 clarity per `replit.md`) is **NOT present in the live DB** — the import has not been run here, and reporting those numbers as live would be fabrication. The runtime "never 404s" because it runs 100% on deterministic fallback, NOT the canonical ontology. Bridge Tag ≠ Concern ID (`concern_id` disjoint from `concerns_master`); Concern Severity ≠ Behaviour Strength (independent axes); Concern consumes Behaviour, never the reverse; AI ≠ Mental Health Professional; human remains responsible; concern explains, it never defines people.
