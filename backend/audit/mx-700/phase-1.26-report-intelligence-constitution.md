# CAPADEX 2.0 — Phase 1.26: Report Intelligence Constitution (Report Factory + Living Reports + Insight Engine + Report Orchestration)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Report Intelligence Constitution. **Do not rebuild, do not create a second report engine, do not replace Report Factory, do not create Report V2, do not duplicate reporting, do not modify business logic, do not activate dormant report capabilities, do not bypass Assessment / Behaviour / Concern / Competency / Decision / Learning / Career Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via **exact `SELECT COUNT(*)`** (live `DATABASE_URL` + repo on 2026-06-28 — **NEVER `n_live_tup`**, per spec PART 1); *judgement* = DERIVED. **Reports never create intelligence; reports communicate intelligence.** **Report ≠ Intelligence ≠ Decision ≠ Recommendation ≠ Evidence · Visualization ≠ Insight · Dashboard ≠ Analytics · PDF ≠ Living Report · Summary ≠ Explanation · Explanation ≠ Evidence · Evidence ≠ Confidence · Confidence ≠ Accuracy · Coverage ≠ Confidence · AI ≠ Report Author.** built ≠ activated; flag-ON ≠ runtime-active; null ≠ 0. Human remains responsible. Reports never diagnose, decide, guarantee outcomes, or create evidence.
> **Basis:** exact-count audit of the Report Factory substrate + Phase 1.23–1.25 + memory (`report-factory-engines`, `peer-benchmarking`, `mx301-demo-report-pack`, `n-live-tup-stale-population-audit`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.26.

---

## PART 1 — Current Report Intelligence Audit (MEASURED, exact COUNT\*; n_live_tup NOT used)

### Repository implementation (code) — Report Factory is the canonical engine
| Component | Files | Class |
|---|---|---|
| Report Factory + pipeline | `routes/report-factory.ts` · `services/report-factory-schema.ts` · `services/report-pack.ts` | **LIVE (code)** |
| PDF / render engine | `services/pdf-renderer.ts` (pdfkit, `/tmp/rf_exports`, fire-and-forget `setImmediate`) | **LIVE (code)** |
| Benchmark engines | `services/benchmark-engine.ts` · `peer-benchmark.ts` · `adaptive-benchmark.ts` · `mei-benchmark-engine.ts` · `m5-org-benchmark.ts` (k=30 suppression) | **LIVE (code)** |
| Visualization resolver | `services/viz-data-resolver.ts` (6 data_source dispatchers) | **LIVE (code)** |
| Insight / synthesis | `services/capadex-report-synthesis.ts` · `report-intelligence-assembler.ts` | **LIVE (code)** |
| Alt/legacy report builders | `routes/dynamic-report.ts` · `omega-report.ts` · `vx-report-intelligence.ts` · `services/lbi-report-generator.ts` · `lbi-stakeholder-report.ts` · `omega-report-builder.ts` | **LIVE (code)** (parallel paths) |

### Database population (exact COUNT\*)
| Component | Table(s) | **Live count** | Class |
|---|---|---|---|
| Report Factory master | `rf_master` | **15** | **LIVE** |
| Templates / sections | `rf_templates` **21** · `rf_template_sections` **35** | populated | **LIVE** |
| Blueprint / role mapping | `rf_blueprint_mapping` **47** · `rf_role_mapping` **0** | mixed | **LIVE / EMPTY** |
| Insight rules | `rf_insight_rules` **11** | populated | **LIVE** |
| Narrative blocks | `rf_narrative_blocks` **17** | populated | **LIVE** |
| Visualization configs | `rf_visualization_configs` **11** | populated | **LIVE** |
| Benchmark configs | `rf_benchmark_configs` **4** | populated | **LIVE** (small) |
| Language / white-label | `rf_language_packs` **9** · `rf_white_label_configs` **1** | populated | **LIVE** |
| **Generated reports (runtime)** | `rf_generated_reports` | **51** | **LIVE (runtime-active)** |
| **Export jobs (runtime)** | `rf_export_jobs` | **10** | **LIVE (runtime-active)** |
| Insight library | `insight_templates` | **375** | **LIVE** |
| Legacy report master | `report_template_master` **5** · `report_section_master` **9** · `report_narrative_rules` **7** | populated | **LIVE** (alt) |
| Generation log | `report_generation_log` | **0** | **DORMANT** (51 reports but 0 log rows) |
| AI report generation | `ai_report_generations` | **0** | **DORMANT** |
| CAPADEX report store | `capadex_reports` | **0** | **EMPTY** |
| Comparison reports | `comparison_reports` | **0** | **EMPTY** |
| Psychometric / fairness reports | `psychometric_reports` **0** · `fairness_reports` **0** | **0** | **EMPTY** |
| Behavioural insights | `behavioural_insights` | **0** | **EMPTY** (consistent w/ 1.24) |

### Runtime activation · duplicates · broken generation · missing templates (explicit, per spec PART 1)
- **Runtime activation:** **ACTIVE** — `rf_generated_reports`=51 + `rf_export_jobs`=10 prove the Report Factory pipeline has actually run and exported. This is the **first runtime-active layer in this audit run alongside Competency (1.23)**.
- **Duplicate report systems:** multiple report subsystems coexist — canonical **Report Factory (`rf_*`)** vs legacy `report_*_master` (5/9/7, populated) vs `capadex_reports` (0) vs OMEGA / dynamic / vx / lbi-stakeholder builders. Per spec PART 4 the canonical engine is **Report Factory**; the others are pre-existing parallel paths (not actively duplicating output today, but the namespace is fragmented — consolidate, never fork further).
- **Broken / gap generation:** `report_generation_log`=0 while `rf_generated_reports`=51 → **observability gap** (generations are not being logged); `ai_report_generations`=0 → AI report path dormant; `rf_role_mapping`=0 → role-targeted reports not configured.
- **Missing templates:** `comparison_reports`, `psychometric_reports`, `fairness_reports` stores empty — those report types are scaffolded but unpopulated.

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **Report Intelligence is genuinely LIVE and runtime-active — the strongest activation seen in this run after Competency (1.23), and the opposite of Behaviour (1.24) and Concern (1.25).** The Report Factory is the canonical reporting engine with a fully populated configuration layer (`rf_master`=15, `rf_templates`=21, `rf_template_sections`=35, `rf_blueprint_mapping`=47, `rf_insight_rules`=11, `rf_narrative_blocks`=17, `rf_visualization_configs`=11) **and a proven runtime** (`rf_generated_reports`=51, `rf_export_jobs`=10), backed by a large insight library (`insight_templates`=375). **Honest gaps remain:** generation logging is dormant (`report_generation_log`=0 despite 51 generated reports — an observability blind spot, not a generation failure); the AI report path (`ai_report_generations`=0), comparison reports, psychometric/fairness report stores, and role mapping are all empty; and the benchmark config layer is thin (4 configs) with k≥30 suppression meaning population/peer benchmarks abstain in this low-volume DB. The reporting namespace is also fragmented across several parallel builders (OMEGA / dynamic / vx / lbi) — canonical is Report Factory, and consolidation (not forking) is the governed path. **No fabrication:** empty report-type stores are reported as EMPTY, not back-filled from config counts.

**Strengths (DERIVED):** Report Factory is real, configured, and exercised end-to-end (config → generate → export); insight library substantial (375); benchmark engine enforces k_min=30 abstention (no fabricated peer cohorts); honest "zero rows in dev" semantics already encoded in the engines. **Technical debt / GAPS (DERIVED):** generation logging dormant (observability); AI/comparison/psychometric/fairness report types empty; role mapping empty; fragmented report namespace (≥4 parallel builders). **Dormant:** AI report generation, comparison reports, generation log, behavioural insights. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Report Philosophy

Report Intelligence exists to Explain · Visualize · Summarize · Compare · Track · Guide · Educate · Support. **Reports never diagnose, decide, guarantee outcomes, or create evidence. Reports communicate existing intelligence.**

## PART 3 — Report Domain Architecture

Domains: Report Core · Report Factory · Report Builder · Insight Engine · Visualization Engine · Benchmark Engine · Comparison Engine · Templates · PDF Engine · Living Reports · Enterprise Reports · Analytics · Governance.

## PART 4 — Report Factory Constitution

Report Factory remains **the only canonical reporting engine. Never replace it · never create Report Factory V2 · never duplicate reporting — enhance only.** Protect Pipeline · Templates · Builders · Sections · Composers · Output contracts. Binding: canonical = `rf_*`; legacy/alt builders (OMEGA/dynamic/vx/lbi) are pre-existing — consolidate toward Report Factory, never fork.

## PART 5 — Report Template Constitution

Protect Assessment · Behaviour · Concern · Competency · Learning · Career · Enterprise · Executive templates. **Templates remain reusable.** Binding: `rf_templates`=21 + `rf_template_sections`=35 + `report_template_master`=5 (legacy) populated.

## PART 6 — Living Report Constitution

Living Reports remain **the strategic direction.** Protect Dynamic reports · continuous updates · longitudinal views · interactive insights · progress tracking · history. **Static PDFs remain supported; Living Reports extend them.** Binding: PDF path LIVE (`pdf-renderer.ts`); Living/interactive layer is the forward roadmap.

## PART 7 — Insight Engine Constitution

Protect Insight generation · ranking · prioritization · relationships · timeline · provenance. **Insights originate from intelligence layers. Never fabricate insights.** Binding: `insight_templates`=375 + `rf_insight_rules`=11 populated; insights compose upstream intelligence, never invent it.

## PART 8 — Visualization Constitution

Protect Charts · heatmaps · radar · spider · timeline · distribution · benchmarks · comparisons. **Visualizations explain data; never replace evidence.** Binding: `rf_visualization_configs`=11; `viz-data-resolver.ts` dispatches per data_source; radar/heatmap read REAL fields only (`mx301-demo-report-pack`).

## PART 9 — Benchmark Constitution

Protect Peer · industry · historical · enterprise · population benchmarks. **Binding: abstain below k_min = 30.** Binding: `rf_benchmark_configs`=4; benchmark engine suppresses cohorts < 30 (`peer-benchmarking`) — low-volume DB ⇒ benchmarks legitimately abstain (null≠0).

## PART 10 — Report Evidence Constitution

Evidence originates from Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Enterprise · Longitudinal history; contains Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 11 — Report Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Visualization confidence · Benchmark confidence · Report confidence · Trust. Binding: Confidence ≠ Accuracy; Coverage ≠ Confidence.

## PART 12 — Report Explainability Constitution

Every report explains Why · Evidence · Source · Relationships · Confidence · Limitations · Alternatives · Next actions.

## PART 13 — Report AI Constitution

**AI summarizes · explains · personalizes · formats · translates · supports. AI never fabricates reports · never invents evidence · never bypasses governance.** Binding: AI ≠ Report Author; `ai_report_generations`=0 (AI path dormant, honestly inert without `OPENAI_API_KEY`).

## PART 14 — Report Analytics Constitution

Protect Report usage · completion · downloads · reading time · interaction · feedback · quality. **Honest gap:** `report_generation_log`=0 — report analytics have no event substrate yet despite 51 generated reports.

## PART 15 — Longitudinal Report Constitution

Protect Historical · progress · trend · evolution · journey reports. **History remains immutable.**

## PART 16 — Enterprise Report Constitution

Support Executive · leadership · department · institution · university · corporate reports. **Human approval required.** Binding: k-anonymity ≥30; tenant isolation; enterprise benchmark tables (`m5_*`) present.

## PART 17 — SuperAdmin Report Constitution

Support Report templates · sections · builders · policies · analytics · monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`.

## PART 18 — Report Security Constitution

Protect Report data · Evidence · PII · Permissions · Consent · Tenant isolation · Downloads · Sharing. Binding: PII masked in audit/exported artifacts (`audit-artifact-pii-masking`).

## PART 19 — Report Observability

Monitor Report Factory · Builders · Generation time · Rendering · Failures · Latency · Quality. **Honest gap:** generation log dormant — observability is the first activation lever.

## PART 20 — Report Testing Constitution

Standardize Template · Builder · Rendering · Regression · Performance tests.

## PART 21 — Report Documentation

Maintain Report catalog · Template catalog · Builder catalog + API guide + Analytics guide. SSOT: `docs/CAPADEX.md` + `docs/phase-history.md` + `.agents/memory/*`.

## PART 22 — Report Governance

Every enhancement answers: Why is Report changing? · What existing capability is reused? · Does this duplicate Report Factory? · Does this improve explainability? · Does this preserve intelligence integrity?

## PART 23 — Report Quality Gates

Verify Report Factory reused · Templates reused · Insights reused · Evidence exposed · Confidence exposed · Benchmarks validated · Explainability complete · Documentation updated.

## PART 24 — Report Review Board

```
Founder[ ] ReportArchitect[ ] BehaviourScientist[ ] UXArchitect[ ] DataVizArchitect[ ] AIArchitect[ ]
Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 25 — Report Definition of Done

- [ ] Existing Report Factory reused · [ ] Templates preserved · [ ] Builders preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] History preserved · [ ] Documentation updated · [ ] No regressions.

## PART 26 — Report Maturity Model

| Component | Current (DERIVED, exact-count) | Target |
|---|---|---|
| Report Factory | **L4 Intelligent** (configured + runtime-active, 51 generated) | L5 Continuous |
| Living Reports | L2 Guided (PDF live; interactive roadmap) | L4 Intelligent |
| Templates | **L4 Intelligent** (21 templates / 35 sections) | L5 Continuous |
| Insights | **L4 Intelligent** (375 templates, 11 rules) | L5 Continuous |
| Visualization | L3 Adaptive (11 configs, 6 dispatchers) | L4 Intelligent |
| Benchmarks | L2 Guided (4 configs, k≥30 abstains) | L4 Intelligent |
| Enterprise Reports | L2 Guided (m5 benchmark tables present) | L4 Intelligent |
| Analytics | L1 Operational (generation log empty) | L4 Intelligent |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Continuous Report Intelligence. **Roadmap (separate approved phases):** activate generation logging + report analytics (close the observability gap) → extend Living/interactive reports over the proven PDF path → grow benchmark cohorts past k_min=30 → enable the AI report path when `OPENAI_API_KEY` present (inert otherwise) → consolidate parallel builders onto Report Factory → keep ONE Report Factory, reusable templates, k≥30 abstention, AI-never-fabricates, history immutable.

## PART 27 — Report Scientific Validation

Document Information visualization · Cognitive psychology · Decision support · Human-computer interaction · Dashboard design · Evidence communication · Bias review · Ethics.

## PART 28 — Report Evolution Strategy

Future evolution supports New report types · templates · visualizations · benchmarks · AI report writers · executive dashboards — **without breaking** Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Enterprise Intelligence. (Additive + flag-gated; byte-identical flag-OFF.)

---

## PART 29 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Report Intelligence Constitution | all | 13 | Report Analytics Constitution | P14 |
| 02 | Repository Report Audit | P1 | 14 | Longitudinal Report Constitution | P15 |
| 03 | Report Factory Constitution | P4 | 15 | Enterprise Report Constitution | P16 |
| 04 | Report Template Constitution | P5 | 16 | SuperAdmin Report Constitution | P17 |
| 05 | Living Report Constitution | P6 | 17 | Report Governance Constitution | P22 |
| 06 | Insight Engine Constitution | P7 | 18 | Report Quality Gates | P23 |
| 07 | Visualization Constitution | P8 | 19 | Report Review Board | P24 |
| 08 | Benchmark Constitution | P9 | 20 | Report Definition of Done | P25 |
| 09 | Report Evidence Constitution | P10 | 21 | Report Scientific Validation | P27 |
| 10 | Report Confidence Constitution | P11 | 22 | Report Evolution Strategy | P28 |
| 11 | Report Explainability Constitution | P12 | 23 | Report Maturity Assessment | P26 |
| 12 | Report AI Constitution | P13 | | | |

---

**STOP — Phase 1.26 complete; Report Intelligence Constitution ready to FREEZE on approval. Report Factory not modified, Report Intelligence not replaced, no second report engine created, no dormant report capabilities activated, business logic not changed, Assessment + Behaviour + Concern + Competency + Decision + Learning + Career Intelligence not bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (`n_live_tup` NOT used, per spec). **Report Intelligence is genuinely LIVE and runtime-active** — Report Factory is configured (`rf_master`=15 / templates 21 / sections 35 / blueprints 47 / insight_rules 11 / narratives 17 / viz 11) AND exercised (`rf_generated_reports`=51, `rf_export_jobs`=10), with a 375-row insight library. Honest gaps: generation logging dormant (`report_generation_log`=0 despite 51 reports — observability blind spot, not a generation failure), AI report path dormant (`ai_report_generations`=0, inert without `OPENAI_API_KEY`), comparison/psychometric/fairness/role-mapping stores empty, benchmark layer thin (4 configs, k≥30 ⇒ legitimate abstention). Reporting namespace fragmented across parallel builders — canonical is Report Factory; consolidate, never fork. Reports communicate intelligence, never create it; AI ≠ Report Author; human remains responsible.
