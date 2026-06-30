# Program 2 · Phase 2.1 — 02 · Service Inventory

**442 service modules** in `backend/services/`. This report inventories the categories, the `-v2` pairs, and — critically — the **debunked orphan/duplicate claims** (honesty over optimism).

## 1. Service categories (by naming/role)
- **Intelligence engines (MX-800 tiers)** — runtime/knowledge/decision/predictive/recommendation/continuous-learning/enterprise intelligence + integration/certification composers.
- **CAPADEX 3.0 model engines** — assessment-framework, customer-journey, progression, outcome-kpi, ai-orchestration, persona-expansion, program1-certification.
- **Platform lifecycle (MX-700 1.37–1.43)** — foundation/management/intelligence/evolution/automation/operations/certification.
- **Domain engines** — competency-runtime, employability, ontology, evidence, validation-loop, behaviour-graph, LBI, employer/TIG, report-pack/report-factory.
- **Infra/support** — `aiClient`, `ws-broadcast`, schedulers, `feature-flags` (DB), `cohort-gating`.

## 2. `-v2` modules (NOT duplicates to delete)
| Domain | `-v2` module | bare module | Status (evidence) |
|---|---|---|---|
| Competency runtime | `routes/competency-runtime-v2.ts` | `routes/competency-runtime.ts` | both registered (routes.ts 94 & 132); `advancedCompetencyRuntimeV2` default ON |
| Adaptive assessment | `routes/adaptive-assessment-v2.ts` | `routes/adaptive-assessment.ts` | both registered (133 & 320); `adaptiveAssessmentRuntimeV2` default ON |
| Workforce OS | `routes/workforce-os-v2.ts` | `routes/workforce-os.ts` | both registered (135 & 180); `workforceOSV2` default ON |
| Governance | `routes/governance-v2.ts` | `routes/governance.ts` | both registered (172 & 214) |
| Predictive intelligence | `routes/predictive-intelligence-v2.ts` | `routes/predictive-intelligence.ts` | both registered (171 & 181) |
| MEI | `routes/mei-v2.ts` | (no bare route) | v2 only |

Service-layer `-v2` engines (`ai-governance-v2`, `competency-graph-engine-v2`, `rbac-tenant-engine-v2`, `market-intelligence-engine-v2`, `predictive-workforce-engine-v2`, `learning-roi-engine-v2`, `dispute-override-engine-v2`, `fairness-monitoring-engine-v2`, `workforce-simulation-v2`, `m3-confidence-v2`, `role-readiness-v2`) are imported by their corresponding `-v2` routes. **Conclusion: `-v2` = active system; none removed.**

## 3. ⚠️ Orphan claim — DEBUNKED on verification
An exploration pass flagged 17 services as "0 backend importers." **Independent verification (matching `.js`-extension imports, which the heuristic missed) shows all 17 are referenced.** Reporting the corrected counts in full, per honesty rule:

| Candidate | claimed | **actual non-script/test importers** |
|---|---|---|
| bars-engine | orphan | 1 (`routes/scientific-competency.ts`) |
| bayesian-inference-engine | orphan | 2 |
| behavioral-signal-engine | orphan | 8 |
| competency-scoring | orphan | 4 |
| competency-search | orphan | 1 |
| ei-calculation-engine | orphan | 3 |
| ei-history-engine | orphan | 3 |
| ei-profile-history | orphan | 5 |
| ei-recommendation-engine | orphan | 10 |
| empirical-percentile | orphan | 2 |
| industry-fit-engine | orphan | 1 |
| industry-readiness-engine | orphan | 5 |
| reliability-engine | orphan | 5 |
| sci-gap-intelligence | orphan | 1 |
| sci-psychometric-engine | orphan | 1 |
| stability-analysis-engine | orphan | 1 |
| task161-genome-competency-seed | orphan | 2 |

**Root cause of the false positives:** the codebase uses ESM `.js` import specifiers (`from '../services/bars-engine.js'`); a grep requiring a closing quote immediately after the basename returns false zeros. **Lesson recorded to memory.**

**Result: 0 confirmed orphan services. No service files removed.**

## 4. Duplicate-service pairs (logical, NOT removed)
The exploration flagged adaptive-assessment (`adaptive-assessment.ts` vs `adaptive-assessment-engine.ts`) and AI-governance (`ai-governance-v2.ts` vs decomposed `ai-governance-llm/scheduler/schema.ts`) as overlapping. Both pairs have **distinct importers** (route layer uses one, orchestrator uses the other), so they are **specialization, not redundancy**. Not removed; consolidation (if ever) is approval-gated (report 06).

## 5. Verdict
Service inventory is large but the duplication/orphan signals from naming heuristics **do not survive evidence verification**. The only confirmed removable artifact was a zero-byte stray file (report 04) — not a service.
