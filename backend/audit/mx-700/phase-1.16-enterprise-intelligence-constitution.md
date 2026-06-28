# CAPADEX 2.0 — Phase 1.16: Enterprise Intelligence Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Enterprise Intelligence Constitution. **Do not rebuild, do not create a second enterprise engine, do not replace the Employer Portal, do not replace TIG, do not activate dormant enterprise capabilities, do not modify business logic, do not bypass Behaviour / Decision / Journey / Learning / Career / Life Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Enterprise Intelligence transforms individual intelligence into organizational intelligence — it never bypasses the six prior layers. **Organization ≠ Department · Department ≠ Team · Capability ≠ Performance · Potential ≠ Promotion · Recommendation ≠ HR Decision · AI Recommendation ≠ Employment Decision · Manager Insight ≠ Performance Rating · Coverage ≠ Confidence.** flag-ON ≠ runtime-active; seeded framework ≠ enterprise adoption; null ≠ 0. **Human approval remains mandatory.** AI never hires, promotes, terminates, or disciplines.
> **Basis:** live employer/TIG/EIOS/m4/m5 substrate audit + Phase 1.2–1.15 constitutions + memory (`employer-portal`, `employer-tig-architecture`, `eios-architecture`, `enterprise-command-center`, `enterprise-governance-console`, `enterprise-certification-mx105x`, `employer-demo-seed-calibration`, `mission-control-aggregator`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.16.

---

## PART 1 — Current Enterprise Intelligence Audit (MEASURED)

| Component | Substrate | **Live runtime in this DB** | Verdict |
|---|---|---|---|
| Employer Portal — employers `employer_master` | `employer_*` (28 tables) | **2** | LIVE (demo-scale) |
| Employer organizations `employer_organizations` | | **2** | LIVE (demo-scale) |
| Employer business units / teams `employer_business_units` / `_team_members` | | **0 / 0** | DORMANT |
| Employer jobs `employer_jobs` | | **2** | LIVE (demo-scale) |
| Employer candidates `employer_candidates` | | **41** | LIVE |
| Talent Intelligence Graph `tig_nodes` / `tig_edges` | `tig_*` (6 tables) | **72 / 1,680** | **POPULATED** |
| TIG intelligence / calibration `tig_intelligence` / `tig_calibration` | | **40 / 5** | POPULATED |
| EIOS employee profiles `eios_employee_profiles` | `eios_*` (8 tables) | **0** | DORMANT |
| EIOS workforce plans / campaigns `eios_workforce_plans` / `_campaigns` | | **0 / 0** | DORMANT |
| Workforce predictions `m4_future_readiness_scores` | `m4_*` (~40 tables) | **3** | SEEDED (sparse) |
| Leadership potential `m4_leadership_potential_predictions` | | **1** | SEEDED (sparse) |
| Burnout risk `m4_burnout_risk_scores` | | **1** | SEEDED (sparse) |
| Org capabilities `m5_organizational_capabilities` | `m5_*` (~40 tables) | **5** | SEEDED (sparse) |
| Critical-role successors `m5_critical_role_successors` | | **5** | SEEDED (sparse) |
| Executive recommendations `m5_executive_recommendations` | | **3** | SEEDED (sparse) |
| Career growth plans `m5_career_growth_plans` | | **0** | DORMANT |

**CRITICAL HONEST FINDING (DERIVED):** Enterprise Intelligence is the **LARGEST and most architecturally-built domain** in CAPADEX — Employer Portal (28 `employer_*` tables), Talent Intelligence Graph (`tig_*`), the EIOS 28-pillar platform (`eios_*`), and the ~80-table `m4_*`/`m5_*` workforce / AI-governance / organizational / leadership / succession analytics families. **Runtime population is genuinely SPLIT three ways:** (1) **TIG is truly POPULATED** (72 nodes, 1,680 edges, 40 intelligence rows, 5 calibration) — the most-live enterprise subsystem; (2) the **Employer Portal is lightly LIVE at demo-scale** (41 candidates, 2 employers / orgs / jobs; business units, teams = 0); (3) the **predictive analytics layers (`m4_*`/`m5_*`) are SEEDED sparse** (1–5 rows each, many 0) and **EIOS runtime is DORMANT** (employee profiles, workforce plans, campaigns all 0). So the architecture is vast and the talent graph is real, but **organization / workforce / leadership / succession prediction is seeded demo-scale or dormant — built ≠ activated, seeded framework ≠ enterprise adoption.** Activating those layers (real tenant onboarding, workforce-plan runs, EIOS campaigns) is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** richest substrate of any domain; TIG is a working talent graph (9 entity types, calibration with write-once snapshot, Brier/ECE raw, LEARNED only from Hired/Rejected at ≥30); Employer Portal has full RBAC + audit + approvals + tenant isolation; EIOS 28-pillar architecture + comprehensive AI-governance (`m4_ai_*`: bias/fairness/explainability/hallucination/risk). **Technical debt / GAPS (DERIVED):** predictive `m4_*`/`m5_*` layers seeded demo-scale (low confidence, never extrapolate from 1–5 rows); EIOS runtime dormant; job substrate SPLIT (`employer_jobs` ⟷ `job_postings`, Phase 1.14); demo data must stay `@example.com`-purgeable on a SHARED dev/prod DB; FK chain (`admin_audit_logs.admin_user_id` NO ACTION) blocks naive demo purge. **Dormant:** EIOS employee/workforce/campaign runtime + employer business-units/teams + `m5_career_growth_plans` — documented, not activated.

---

## PART 2 — Enterprise Philosophy

Organizations succeed through people. Behaviour understands people · Decision supports decisions · Journey develops people · Learning builds capability · Career develops employability · Life supports wellbeing · **Enterprise optimizes organizations.** Enterprise Intelligence exists to Understand · Measure · Develop · Predict · Support · Optimize · Retain · Transform. **It augments leaders; it never replaces leadership.**

## PART 3 — Enterprise Domain Architecture

Domains: Enterprise Core · Organization · Department · Team · Leadership · Talent · Capability · Succession · Workforce Planning · Analytics · Reports · AI · Governance. **Every enterprise capability belongs to ONE domain.**

## PART 4 — Organization Intelligence Constitution

Protect Organizations · Business units · Departments · Locations · Divisions · Operating models · Org structure · Org evolution. Binding: substrate `employer_organizations`/`employer_business_units` (units=0, dormant) + `m5_organizational_*`; never fork a parallel org model.

## PART 5 — Team Intelligence Constitution

Protect Teams · Collaboration · Capability distribution · Team behaviour · Effectiveness · Communication · Growth · Analytics. Binding: `employer_team_members`=0 (dormant) — extend, never duplicate.

## PART 6 — Manager Intelligence Constitution

Support Managers · Coaching · Development · Goal alignment · Capability planning · Performance conversations · Career discussions. **Never automate managerial judgement.** Binding: Manager Insight ≠ Performance Rating.

## PART 7 — Leadership Intelligence Constitution

Protect Leadership competencies · Readiness · Growth · Pipeline · Executive development · Analytics. Binding: substrate `m4_leadership_*` (1 row) + `m5_leadership_*` (sparse) — seeded demo-scale, low confidence; never extrapolate.

## PART 8 — Talent Intelligence Constitution

Protect Talent mapping · High potential · Capability distribution · Talent pools · Talent risks · Development · Mobility. Binding: **TIG is the canonical talent graph** (`tig_*`, POPULATED) — reuse, never replace; calibration borrowed-prior never upgrades TRUST; developmental signals only.

## PART 9 — Workforce Planning Constitution

Support Demand forecasting · Supply planning · Capability planning · Resource planning · Hiring planning · Learning planning · Succession planning. Binding: substrate `eios_workforce_plans` (0, dormant) + `m4_*`/`m5_*` forecasts (sparse); abstain when data thin.

## PART 10 — Succession Intelligence Constitution

Protect Critical roles · Successor pools · Readiness · Development plans · Bench strength · Leadership continuity. **Never automatically nominate successors.** Binding: `m5_critical_role_successors`=5, `m5_bench_strength_scores` — seeded, human-approval gated.

## PART 11 — Organizational Health Constitution

Measure Engagement · Collaboration · Capability · Resilience · Learning · Leadership · Wellbeing · Culture. **Never diagnose organizational culture.** Binding: `m4_burnout_risk_scores`=1, `m4_workforce_resilience_scores`=3 — sparse; k-anonymity ≥30.

## PART 12 — Enterprise Evidence Constitution

Evidence originates from Behaviour · Learning · Career · Journey · Enterprise assessments · Manager reviews · Capability assessments · Org metrics; documents Source · Coverage · Quality · Confidence. **Never fabricate.**

## PART 13 — Enterprise Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Capability · Potential · Organizational readiness. **Never combine into one score.** Binding: enterprise certification keeps FOUR axes (Structural ⟂ Activation ⟂ Adoption ⟂ Outcome-Confidence) NEVER composited; aggregate views COMPOSE sub-views, never re-issue ad-hoc SQL.

## PART 14 — Enterprise Explainability Constitution

Every enterprise recommendation explains Why · Evidence · Capability drivers · Behaviour drivers · Learning drivers · Business context · Confidence · Alternatives · Limitations.

## PART 15 — Enterprise Recommendation Constitution

Recommendations include Priority · Expected outcome · Capability/Leadership/Talent/Learning impact · Evidence · Confidence · Alternatives. Binding: Recommendation ≠ HR Decision; `m5_executive_recommendations`=3 (seeded).

## PART 16 — Workforce Analytics Constitution

Protect Capability · Learning · Behaviour · Talent · Leadership · Organization · Predictive workforce analytics. Binding: every unmeasurable rate = null + note; predictions from 1–5 seeded rows are NOT population-valid — disclose.

## PART 17 — Enterprise Report Constitution

Every report contains Executive summary · Capability overview · Talent overview · Leadership overview · Evidence · Confidence · Recommendations · Risks · Next actions. SSOT: Report Factory + Enterprise Command Center aggregators (read-only, never-throws, status ≠ score).

## PART 18 — Enterprise AI Constitution

**AI explains · summarizes · forecasts · recommends · supports. AI never hires · never promotes · never terminates · never disciplines.** Binding: AI Recommendation ≠ Employment Decision; full AI-governance substrate exists (`m4_ai_*`: bias/fairness/explainability/hallucination/risk/audit). (Cross-ref Phase 1.9.)

## PART 19 — Enterprise Security Constitution

Protect Enterprise/Employee/Capability/Leadership/Talent data · Reports · Permissions · Consent · RBAC · Tenant isolation. Binding: `employer_rbac` + per-framework admin gate; tenant-scope EVERY read (drives/eligibility/company-DNA, not just lists); IDOR guard; PII masked in audit artifacts.

## PART 20 — Enterprise Governance Constitution

Support Policy management · Compliance · Audit · Approvals · Review boards · Governance workflows. Binding: governanceRbacV2 write subsystem + `employer_approvals`/`employer_audit_logs`; composing console reuses only PURE derivations (never runs DDL on GETs).

## PART 21 — SuperAdmin Enterprise Constitution

Support Enterprise configuration · Organizations · Departments · Frameworks · Templates · Reports · Analytics · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`, 60s cache, `?refresh=1`.

## PART 22 — Enterprise Observability

Monitor Enterprise engine · Analytics · Recommendations · Forecasts · Reports · Latency · Failures · Quality. Binding: a silent-zero count() makes unreadable indistinguishable from empty → onError must flip degraded; surface dormancy honestly (0 ≠ healthy).

## PART 23 — Enterprise Testing Constitution

Standardize Capability · Talent · Leadership · Analytics · Recommendation · Regression tests. Current: employer HTTP-path e2e harness exists (session+CSRF); predictive layers thinly exercised (seeded data).

## PART 24 — Enterprise Documentation

Maintain Organization · Capability · Leadership · Talent catalogs + Analytics guide + Enterprise API guide. SSOT: `docs/phase-history.md` (EP-EIOS / EP-98 indexes) + `.agents/memory/*`.

## PART 25 — Enterprise Governance (enhancement gate)

Every enterprise enhancement answers: Why is Enterprise Intelligence changing? · What existing capability is reused? · Does this duplicate enterprise logic? · Does this improve organizational capability? · Does this preserve existing architecture?

## PART 26 — Enterprise Quality Gates

Verify Enterprise modules reused · Behaviour reused · Decision reused · Journey reused · Learning reused · Career reused · Life reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 27 — Enterprise Review Board

```
Founder[ ] EnterpriseArchitect[ ] HRArchitect[ ] BehaviourScientist[ ] LearningArchitect[ ] CareerArchitect[ ] AIArchitect[ ]
Security[ ] Compliance[ ] Research[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 28 — Enterprise Definition of Done

- [ ] Existing enterprise reused · [ ] Organization preserved · [ ] Talent preserved · [ ] Leadership preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Documentation updated · [ ] No regressions.

## PART 29 — Enterprise Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Enterprise platform (Employer Portal) | L2 Managed (demo-scale live) | L4 Predictive |
| Organizations / Departments | L1 Operational (2 orgs, units=0) | L3 Intelligent |
| Talent (TIG) | **L3 Intelligent** (72 nodes / 1,680 edges, calibrated) | L4 Predictive |
| Leadership | L1 Operational (seeded sparse) | L4 Predictive |
| Workforce planning | L1 Operational (EIOS runtime dormant) | L4 Predictive |
| Succession | L1 Operational (seeded, 5 rows) | L3 Intelligent |
| Analytics (`m4_*`/`m5_*`) | L1 Operational (seeded demo-scale) | L4 Predictive |
| AI (governance substrate) | L2 Managed (governance built) | L4 Predictive |
| Reports | L2 Managed (aggregators live) | L4 Predictive |

Levels: 1 Operational · 2 Managed · 3 Intelligent · 4 Predictive · 5 Enterprise Intelligence Excellence. **Roadmap:** (separate approved phases) onboard real tenants (move Employer Portal off demo-scale) → bridge the SPLIT job substrate → activate EIOS runtime (employee profiles / workforce plans / campaigns) → populate `m4_*`/`m5_*` predictions with real data before trusting forecasts → keep FOUR-axis certification + human-approval gates + AI never hires/promotes/terminates. **Enterprise Intelligence augments leaders; it never replaces leadership.**

## PART 30 — Enterprise Scientific Validation

Document Organization theory · Leadership theory · Capability theory · Human-capital theory · Workforce science · Evidence quality · Bias review · Ethics · Population applicability.

## PART 31 — Enterprise Evolution Strategy

Future evolution supports New organization / leadership / talent / workforce / AI models · new analytics · new industries — **without breaking** Behaviour · Decision · Journey · Learning · Career · Life Intelligence · reports · AI. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 32 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Enterprise Intelligence Constitution | all | 14 | Enterprise Recommendation Constitution | P15 |
| 02 | Enterprise Architecture Report | P1 | 15 | Workforce Analytics Constitution | P16 |
| 03 | Organization Intelligence Constitution | P4 | 16 | Enterprise Report Constitution | P17 |
| 04 | Team Intelligence Constitution | P5 | 17 | Enterprise AI Constitution | P18 |
| 05 | Manager Intelligence Constitution | P6 | 18 | Enterprise Security Constitution | P19 |
| 06 | Leadership Intelligence Constitution | P7 | 19 | Enterprise Governance Constitution | P20 |
| 07 | Talent Intelligence Constitution | P8 | 20 | SuperAdmin Enterprise Constitution | P21 |
| 08 | Workforce Planning Constitution | P9 | 21 | Enterprise Quality Gates | P26 |
| 09 | Succession Intelligence Constitution | P10 | 22 | Enterprise Review Board | P27 |
| 10 | Organizational Health Constitution | P11 | 23 | Enterprise Definition of Done | P28 |
| 11 | Enterprise Evidence Constitution | P12 | 24 | Enterprise Scientific Validation | P30 |
| 12 | Enterprise Confidence Constitution | P13 | 25 | Enterprise Evolution Strategy | P31 |
| 13 | Enterprise Explainability Constitution | P14 | 26 | Enterprise Maturity Assessment | P29 |

---

**STOP — Phase 1.16 complete; Enterprise Intelligence Constitution ready to FREEZE on approval. Enterprise modules not modified, Employer Portal not replaced, TIG not replaced, no second enterprise engine created, no dormant enterprise capabilities activated, business logic not changed, Behaviour + Decision + Journey + Learning + Career + Life Intelligence not bypassed.**
Honesty caveats: counts are MEASURED from the live shared Postgres today. Enterprise is the LARGEST/most-built domain but runtime is SPLIT three ways: **TIG is genuinely POPULATED** (72 nodes / 1,680 edges / 40 intelligence / 5 calibration); the **Employer Portal is lightly LIVE at demo-scale** (41 candidates, 2 employers / orgs / jobs; business units & teams = 0); and the **predictive `m4_*`/`m5_*` layers are SEEDED sparse (1–5 rows, many 0) with EIOS runtime DORMANT** (employee profiles / workforce plans / campaigns = 0). Built ≠ activated; seeded framework ≠ enterprise adoption; predictions from 1–5 rows are NOT population-valid. flag-ON ≠ runtime-active; null ≠ 0. Capability ≠ Performance; Potential ≠ Promotion; AI Recommendation ≠ Employment Decision; human approval remains mandatory. Activating EIOS / org / workforce / succession runtime is a separate, approved phase — NOT performed here.
