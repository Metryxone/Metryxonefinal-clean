# CAPADEX 2.0 — Phase 1.27: Analytics Intelligence Constitution (Platform Analytics + Predictive Analytics + Longitudinal Analytics + KPI Engine)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Analytics Intelligence Constitution. **Do not rebuild, do not create a second analytics engine, do not replace Platform Analytics, do not create Analytics V2, do not duplicate dashboards/KPIs, do not modify business logic, do not activate dormant analytics capabilities, do not bypass any intelligence engine.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via **exact `SELECT COUNT(*)`** (live `DATABASE_URL` + repo on 2026-06-28 — **NEVER `n_live_tup`**, per spec PART 1); *judgement* = DERIVED. **Analytics never creates intelligence; analytics measures intelligence.** **Analytics ≠ Intelligence ≠ Reporting ≠ Dashboard ≠ KPI · Dashboard ≠ Insight · Visualization ≠ Evidence · Metric ≠ Truth · Correlation ≠ Causation · Prediction ≠ Outcome · Trend ≠ Future · Coverage ≠ Confidence · Evidence ≠ Confidence · Confidence ≠ Accuracy · Average ≠ Population · Population ≠ Benchmark · Benchmark ≠ Recommendation · AI ≠ Data Scientist.** built ≠ activated; flag-ON ≠ runtime-active; null ≠ 0. Human remains responsible. Never estimate; never fabricate.
> **Basis:** exact-count audit of the analytics substrate + Phase 1.23–1.26 + memory (`mission-control-aggregator`, `platform-intelligence-console`, `peer-benchmarking`, `report-factory-engines`, `n-live-tup-stale-population-audit`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.27.

---

## PART 1 — Current Analytics Intelligence Audit (MEASURED, exact COUNT\*; n_live_tup NOT used)

### Repository implementation (code)
| Component | Files | Class |
|---|---|---|
| Mission Control (read-only aggregator) | `routes/mission-control.ts` (folds ~45 nullable counts into 8 widgets, null≠0) | **LIVE (code, compose-only)** |
| Platform Intelligence console | `routes/platform-intelligence.ts` (7 metric groups, unmeasurable rate = null) | **LIVE (code, compose-only)** |
| Enterprise / workforce analytics | `routes/enterprise-analytics.ts` · `workforce-analytics.ts` · `services/{enterprise-analytics-schema,workforce-analytics}.ts` | **LIVE (code)** |
| Commercial / talent-warehouse analytics | `routes/commercial-analytics.ts` · `talent-analytics-warehouse.ts` · `caf-analytics.ts` | **LIVE (code)** |
| Predictive engines | `services/{competency-forecasting-engine,predictive-competency-engine,predictive-readiness-engine,predictive-workforce-engine(-v2),success-prediction-engine,m4-predictive}.ts` | **LIVE (code)** |
| Psychometric engines | `routes/{psychometrics,psychometrics-engine,spe-psychometrics}.ts` · `services/{psychometric-intelligence-engine,psychometric-calibration,sci-psychometric-engine}.ts` | **LIVE (code)** |

### Database population (exact COUNT\*)
| Component | Table | **Live count** | Class |
|---|---|---|---|
| **Monitoring / observability substrate** | `aig_monitoring_metrics` | **24,388** | **LIVE (heavily populated)** |
| **Predictive competency forecasts** | `competency_forecasts` | **120** | **LIVE** |
| KPI daily | `anl_kpi_daily` | **10** | **SEEDED (thin)** |
| Workforce analytics | `p4_workforce_analytics` | **5** | **SEEDED (thin)** |
| Enterprise analytics | `p5_enterprise_analytics` | **1** | **SEEDED (thin)** |
| Behaviour / learning trends | `lbi_behavior_trends` **5** · `lbi_learning_trends` **1** | thin | **SEEDED** |
| Forecast accuracy tracking | `m4_forecast_accuracy_tracking` | **3** | **SEEDED (thin)** |
| Predictive features | `anl_predictive_features` | **0** | **EMPTY** |
| Performance analytics | `performance_analytics` **0** · `intelligence_performance_metrics` **0** | **0** | **EMPTY** |
| EIOS metric snapshots | `eios_metric_snapshots` | **0** | **EMPTY** |
| Comparison dashboard | `comparison_dashboard` | **0** | **EMPTY** |
| KPI stores (mentor / talent) | `mentor_kpis` **0** · `ti_talent_kpis` **0** | **0** | **EMPTY** |
| Outcome / trajectory predictions | `ti_outcome_predictions` **0** · `ti_prediction_history` **0** · `readiness_predictions` **0** · `trajectory_forecasts` **0** | **0** | **DORMANT** (engines live, output unpersisted) |
| Longitudinal trends | `wc3_longitudinal_trends` | **0** | **EMPTY** |
| PAIE predictive family | `paie_meta_predictions` **0** · `paie_observability_metrics` **0** | **0** | **DORMANT** |
| Workforce capability forecasts | `workforce_capability_forecasts` | **0** | **DORMANT** |

### Runtime activation · duplicates · broken aggregations · missing analytics (explicit, per spec PART 1)
- **Runtime activation:** **SPLIT.** The aggregator layer (Mission Control, Platform Intelligence) is LIVE-by-composition — it computes on the fly over existing tables and never persists its own analytics rows (status≠score; snapshot is the only write path). The **monitoring substrate is heavily active** (`aig_monitoring_metrics`=24,388 — the largest operational stream in this audit run). **Predictive competency forecasting is live** (`competency_forecasts`=120). But the dedicated **KPI / predictive-feature / outcome-prediction / longitudinal-trend persistence stores are mostly empty or thin-seed** — the forecast/prediction *engines* exist as code while their *output* tables sit at 0.
- **Duplicate analytics systems:** several parallel analytics namespaces coexist (`anl_*` platform analytics, `p4_/p5_` workforce/enterprise, `m4_/m5_` predictive, `paie_*` predictive family, `ti_*` talent, `lbi_*` behavioural, `eios_*`, `roie_*`, `sci_*` psychometric). Per spec PART 4 the canonical aggregation surface is **Platform Analytics + Mission Control + Platform Intelligence**; the rest are domain analytics — consolidate views, never fork the engine.
- **Broken / gap aggregations:** prediction engines run but **do not persist** (`ti_outcome_predictions`/`readiness_predictions`/`trajectory_forecasts`/`paie_*`=0) — predictive analytics is compute-only with no historical ledger; `comparison_dashboard`=0; longitudinal trends empty.
- **Missing analytics:** KPI library thin (`anl_kpi_daily`=10, talent/mentor KPIs=0); no executive KPI persistence; benchmark cohorts abstain < k_min=30 in this low-volume DB.

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **Analytics Intelligence is a SPLIT picture — a genuinely LIVE aggregation + monitoring spine over a mostly DORMANT predictive/KPI persistence layer.** The read-only aggregators (Mission Control, Platform Intelligence) are real and compose existing intelligence honestly (null=absent ≠ 0=empty), and two substrates are heavily/meaningfully populated: `aig_monitoring_metrics`=24,388 (operational/observability monitoring) and `competency_forecasts`=120 (predictive competency output). **However, the bulk of the dedicated analytics persistence — predictive features, outcome/readiness/trajectory predictions, PAIE forecast family, longitudinal trends, comparison dashboards, talent/mentor KPIs — reads 0**, while the KPI/workforce/enterprise stores are thin seeds (10 / 5 / 1). This is the now-familiar **built ≠ activated** pattern, but narrower than Behaviour (1.24) / Concern (1.25): the analytics ENGINE layer is alive and the monitoring stream is large, yet most prediction engines are **compute-only with no persisted ledger** — so longitudinal/predictive analytics cannot show history because nothing is being written. **No fabrication:** thin and empty stores are reported as SEEDED/EMPTY/DORMANT, not inflated from the 24,388 monitoring rows (which measure platform operation, not user-facing KPIs).

**Strengths (DERIVED):** aggregators compose, never recompute or fabricate; honest null≠0 throughout (`mission-control-aggregator`, `platform-intelligence-console`); large live monitoring substrate; competency forecasting produces real output; benchmark engine abstains < 30. **Technical debt / GAPS (DERIVED):** predictions unpersisted (no predictive history/ledger); KPI library thin; longitudinal trends empty; fragmented analytics namespaces. **Dormant:** outcome/readiness/trajectory predictions, PAIE family, comparison dashboard, performance analytics, EIOS metric snapshots. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Analytics Philosophy

Analytics exists to Measure · Monitor · Compare · Track · Evaluate · Benchmark · Forecast · Improve. **Analytics never creates intelligence, never creates evidence, never guarantees outcomes, never manipulates data.**

## PART 3 — Analytics Domain Architecture

Domains: Platform · Operational · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Enterprise · Executive · Predictive · Longitudinal analytics · KPI Engine · Metrics Engine · Governance.

## PART 4 — Platform Analytics Constitution

Platform Analytics remains **the only canonical analytics engine. Never replace it · never create Analytics V2 · never duplicate dashboards — enhance only.** Protect Metrics · Aggregations · Dimensions · Measures · Filters · Time series. Binding: canonical surface = Platform Analytics + Mission Control + Platform Intelligence (compose-only, never recompute, never persist ad-hoc analytics rows).

## PART 5 — KPI Constitution

Protect Strategic · Operational · Executive · Behaviour · Learning · Career · Enterprise KPIs. **Every KPI must have Definition · Formula · Owner · Frequency · Evidence · Confidence.** Binding: KPI library currently thin (`anl_kpi_daily`=10; talent/mentor KPIs=0) — populate via governed definitions, never auto-synthesize.

## PART 6 — Metrics Constitution

Protect Dimensions · Measures · Facts · Events · Time · Granularity · Aggregation. **Metrics remain reproducible.** Binding: every metric folds from real counts (rowCount, not input cardinality).

## PART 7 — Longitudinal Analytics Constitution

Protect Historical trends · Growth · Retention · Behaviour/Learning/Career evolution · Intervention outcomes. **History remains immutable.** **Honest gap:** longitudinal trend stores empty (`wc3_longitudinal_trends`=0) — no trend history persisted yet.

## PART 8 — Predictive Analytics Constitution

Predictive Analytics supports Forecasting · Risk/Growth/Outcome projection · Capacity planning. **Prediction never guarantees reality (Prediction ≠ Outcome; Trend ≠ Future).** **Honest gap:** engines live but output unpersisted — only `competency_forecasts`=120 has rows; outcome/readiness/trajectory/PAIE prediction tables=0.

## PART 9 — Benchmark Constitution

Protect Population · Peer · Enterprise · Historical · Industry benchmarks. **Binding: abstain below k_min = 30.** Binding: low-volume DB ⇒ peer/population benchmarks legitimately abstain (null≠0).

## PART 10 — Analytics Evidence Constitution

Evidence originates from Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Reports · Enterprise; contains Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 11 — Analytics Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Statistical confidence · Forecast confidence · Trust. Binding: Confidence ≠ Accuracy; Correlation ≠ Causation.

## PART 12 — Analytics Explainability Constitution

Every metric explains Definition · Formula · Evidence · Source · Confidence · Limitations · Population. Binding: unmeasurable rate = null + explicit note (never 0).

## PART 13 — Analytics AI Constitution

**AI summarizes · forecasts · explains · compares · supports. AI never fabricates analytics · never invents KPIs · never bypasses governance.** Binding: AI ≠ Data Scientist; human remains responsible.

## PART 14 — Executive Analytics Constitution

Support Founder dashboard · Mission Control · Platform Intelligence · Executive KPIs · Strategic monitoring · Decision support. Binding: Mission Control + Platform Intelligence are LIVE compose-only aggregators today.

## PART 15 — Enterprise Analytics Constitution

Support Corporate · Institution · Department · Manager · Leadership · Population analytics. Binding: k-anonymity ≥30; tenant isolation; `p5_enterprise_analytics`=1 (thin).

## PART 16 — Report Analytics Constitution

Protect Report usage · Generation · Downloads · Interaction · Completion · Sharing. **Cross-ref Phase 1.26:** report generation log dormant — report analytics lack an event substrate.

## PART 17 — SuperAdmin Analytics Constitution

Support Analytics configuration · Metric definitions · KPI libraries · Policies · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`.

## PART 18 — Analytics Security Constitution

Protect Metrics · Evidence · Permissions · PII · Consent · Tenant isolation · Exports. Binding: PII masked in audit/exported artifacts; aggregate-only below k_min.

## PART 19 — Analytics Observability

Monitor Analytics engine · Aggregation · Latency · Failures · Dashboards · Queries · Quality. Binding: `aig_monitoring_metrics`=24,388 is the live observability stream; a silent-zero count helper must flip a degraded flag, not read as healthy-zero.

## PART 20 — Analytics Testing Constitution

Standardize Aggregation · Metric · KPI · Regression · Performance tests.

## PART 21 — Analytics Documentation

Maintain Metric catalog · KPI catalog · Dashboard catalog + API guide + Analytics guide. SSOT: `docs/phase-history.md` + `.agents/memory/*`.

## PART 22 — Analytics Governance

Every enhancement answers: Why is Analytics changing? · What existing capability is reused? · Does this duplicate Platform Analytics? · Does this preserve measurement integrity?

## PART 23 — Analytics Quality Gates

Verify Platform Analytics reused · Metrics reused · KPIs reused · Evidence exposed · Confidence exposed · Benchmarks validated · Documentation updated.

## PART 24 — Analytics Review Board

```
Founder[ ] AnalyticsArchitect[ ] DataScientist[ ] BehaviourScientist[ ] EnterpriseArchitect[ ] AIArchitect[ ]
Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 25 — Analytics Definition of Done

- [ ] Existing Analytics Engine reused · [ ] Metrics preserved · [ ] KPIs preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Definitions documented · [ ] History preserved · [ ] No regressions.

## PART 26 — Analytics Maturity Model

| Component | Current (DERIVED, exact-count) | Target |
|---|---|---|
| Platform Analytics | **L3 Adaptive** (Mission Control + Platform Intelligence compose live) | L5 Continuous |
| KPI Engine | L1 Operational (thin library) | L4 Intelligent |
| Metrics Engine | L2 Guided | L4 Intelligent |
| Dashboards | L3 Adaptive (Mission Control live) | L4 Intelligent |
| Executive Analytics | L3 Adaptive (Platform Intelligence live) | L4 Intelligent |
| Enterprise Analytics | L1 Operational (`p5`=1) | L3 Adaptive |
| Predictive Analytics | L2 Guided (engines live, only `competency_forecasts`=120 persisted) | L4 Intelligent |
| Longitudinal Analytics | L1 Operational (trends empty) | L4 Intelligent |
| Monitoring substrate | **L4 Intelligent** (`aig_monitoring_metrics`=24,388) | L5 Continuous |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Continuous Analytics Intelligence. **Roadmap (separate approved phases):** persist prediction output (give predictive/longitudinal analytics a real ledger so trends/accuracy can be measured) → grow the KPI library with governed Definition/Formula/Owner/Evidence/Confidence → activate report analytics event substrate (cross-ref 1.26) → grow benchmark cohorts past k_min=30 → consolidate fragmented analytics namespaces under Platform Analytics → keep ONE analytics engine, compose-never-recompute, null≠0, abstain<30, Prediction≠Outcome, AI-never-fabricates.

## PART 27 — Analytics Scientific Validation

Document Statistics · Measurement science · Business intelligence · Forecasting · Data visualization · Decision science · Evidence quality · Bias review · Ethics.

## PART 28 — Analytics Evolution Strategy

Future evolution supports New KPIs · metrics · dashboards · forecasting models · enterprise analytics · executive dashboards — **without breaking** Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Report · Enterprise Intelligence. (Additive + flag-gated; byte-identical flag-OFF.)

---

## PART 29 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Analytics Intelligence Constitution | all | 13 | Executive Analytics Constitution | P14 |
| 02 | Repository Analytics Audit | P1 | 14 | Enterprise Analytics Constitution | P15 |
| 03 | Platform Analytics Constitution | P4 | 15 | Report Analytics Constitution | P16 |
| 04 | KPI Constitution | P5 | 16 | SuperAdmin Analytics Constitution | P17 |
| 05 | Metrics Constitution | P6 | 17 | Analytics Governance Constitution | P22 |
| 06 | Longitudinal Analytics Constitution | P7 | 18 | Analytics Quality Gates | P23 |
| 07 | Predictive Analytics Constitution | P8 | 19 | Analytics Review Board | P24 |
| 08 | Benchmark Constitution | P9 | 20 | Analytics Definition of Done | P25 |
| 09 | Analytics Evidence Constitution | P10 | 21 | Analytics Scientific Validation | P27 |
| 10 | Analytics Confidence Constitution | P11 | 22 | Analytics Evolution Strategy | P28 |
| 11 | Analytics Explainability Constitution | P12 | 23 | Analytics Maturity Assessment | P26 |
| 12 | Analytics AI Constitution | P13 | | | |

---

**STOP — Phase 1.27 complete; Analytics Intelligence Constitution ready to FREEZE on approval. Platform Analytics not modified, Analytics Intelligence not replaced, no second analytics engine created, no dormant analytics capabilities activated, business logic not changed, no intelligence engine bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (`n_live_tup` NOT used, per spec). **Analytics is SPLIT** — a LIVE aggregation + monitoring spine (Mission Control + Platform Intelligence compose-only; `aig_monitoring_metrics`=24,388; `competency_forecasts`=120) over a mostly DORMANT predictive/KPI persistence layer (outcome/readiness/trajectory/PAIE predictions, longitudinal trends, comparison dashboard, talent/mentor KPIs all 0; KPI/workforce/enterprise stores thin at 10/5/1). Prediction engines are compute-only with no persisted ledger, so predictive/longitudinal analytics cannot show history. The 24,388 monitoring rows measure platform operation, NOT user-facing KPIs — not inflated into analytics coverage. Analytics measures intelligence, never creates it; Prediction ≠ Outcome; Correlation ≠ Causation; AI ≠ Data Scientist; human remains responsible.
