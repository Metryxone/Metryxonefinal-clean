# MetryxOne — Intelligence Waste Report

**Date:** 30 May 2026
**Scope:** Backend services, API surface, PostgreSQL intelligence tables, frontend Career-OS intelligence layer.
**Method:** Producer→consumer mapping via 4 parallel code explorers, then **every high-value claim re-verified by direct grep** (explorers over-flagged several items that are in fact consumed — those were corrected before publishing).
**Constraint honoured:** No code was modified. This is analysis only.

### Confidence legend
- **High** — verified by grep: producer exists, no consumer found on any user-facing path.
- **Medium** — verified no direct consumer, but a transitive/ops/cron caller cannot be fully ruled out.

### How "Usage %" is defined
Approximate share of the generated/persisted intelligence that reaches **any user-facing surface** (UI render, report, or email). Internal service-to-service reads that themselves dead-end at an unconsumed endpoint count as *not consumed*.

### How "Wasted Value" sorts
`Wasted Value = Business Value × (1 − Usage%)`. The list is sorted **highest wasted value first** — i.e. expensive, differentiating intelligence that is almost never seen.

---

## Executive Summary

The platform computes a remarkably deep behavioural-intelligence stack, but **the richest, most differentiating layers never reach a user.** On every assessment completion the backend runs and persists the full spine — **Signals → Composites → Patterns → Session Interventions → Best-Next-Action Recommendations → Behavior Graph → Insight-Explainer lineage** — across 6+ tables, inside advisory-locked transactions. The frontend report, however, fetches only three things: the report row, the **OMEGA-X payload**, and the **OMEGA quality/memory** card.

The single live consumer of the spine is the **Career Behavior Adapter**, which collapses the entire graph into **5 readiness scalars**. Everything granular — per-pattern explainability lineage, composite signals, the Top-5 intervention recommendations — is generated, stored, and discarded at the glass.

The headline number: **the most valuable ~80–90% of behavioural compute is persisted but never surfaced.**

---

## Master Waste Table (sorted by highest wasted value)

| # | Source (Producer) | Consumer (today) | Usage % | Business Value | Recommendation | Conf. |
|---|---|---|---|---|---|---|
| 1 | **Insight-Explainer + spine lineage** — `capadex-explainability-engine.ts` / `capadex-insight-explainer.ts` → `GET /api/capadex/session/:id/explain`, `/signals`, `/patterns` | **None** — frontend never calls `/explain`, `/signals`, `/patterns` (0 refs). Only internal services read them. | ~5% | **High** — explainable "why" lineage is the core differentiator vs generic assessments | Surface the explainer in `CapadexReportPhase` (report already loads; add a "Why this result" lineage card). Highest ROI. | High |
| 2 | **Best-Next-Action recommendations** — `intervention-intelligence.ts` → table `capadex_intervention_recommendations` (Top-5 per session) | **None** — read back only by `intervention-intelligence` itself / insight-explainer (also unconsumed). replit.md: "No UI yet." | 0% | **High** — actionable, monetisable next steps | Render Top-5 in report and/or Career Builder `NextBestActionsTab` (which currently uses only the client `weeklyActionEngine`). | High |
| 3 | **Session interventions** — `capadex-intervention-engine.ts` → `capadex_session_interventions` | Read only by `capadex-explainability-engine` → `/explain` (unconsumed). Partially folded into 5 readiness scalars via the graph→adapter path. | ~10% | **High** — library-backed, non-generic interventions | Surface alongside #2, or expose via the report. | High |
| 4 | **Composite signals** — `composite-signal-engine.ts` → `capadex_session_composites` | Read only by `capadex-explainability-engine` (terminal at unconsumed `/explain`). | ~5% | **Med-High** — higher-order behavioural constructs | Either surface inside the explainer card (#1) or stop persisting if not roadmapped. | High |
| 5 | **Pattern synthesis** — `pattern-engine.ts` → `capadex_session_patterns` | `intervention-intelligence` + explainability (both terminate unconsumed) + **collapsed into readiness scalars** via graph→adapter. Granular patterns never rendered. | ~15% | **High** — behavioural patterns are a headline feature | Surface patterns in the report; the data is already computed and explainable. | High |
| 6 | **Career memory schema** — migration `20260519_career_memory.sql`: `career_interventions_log`, `career_trajectory_history`, `career_benchmarks_history`, `career_growth_patterns` | **None** — tables exist only in the migration. **Zero writers, zero readers** anywhere in the codebase. | 0% | **Med** — intended longitudinal career tracking | Either wire writers (longitudinal Career-OS phases) or drop the migration. Dead schema, no wasted compute. | High |
| 7 | **Frontend Career-OS event pipeline** — `lib/events/careerEvents.ts` (`initCareerEventPipeline`, `dispatch*`) | **None** — pipeline never initialised; dispatchers only re-exported in the barrel, never invoked. UI uses local fetch + direct store writes. | 0% | **Med** — intended reactive state architecture | Either adopt the pipeline or delete it; today it is dead architecture. | High |
| 8 | **Unsubscribed Zustand stores** — `idpStore`, `simulationStore`, `workforceStore`, `uiStore`, `authStore` | **None** — each referenced only by its own file + `stores/index.ts` barrel (`idpStore` also by the dead pipeline). No component subscribes. | 0% | **Med** — computed IDP/workforce/simulation state | Wire the matching tabs (`SimulationsTab`, `WorkforceTab`) to their stores, or remove. | High |
| 9 | **Predictive Intelligence** — `predictive-intelligence.ts` → `trajectory_forecasts`; `POST /api/predictions/compute` | No frontend caller (0 refs) and **no internal trigger found** → forecasts likely never generated; downstream RIE readers read empty. | ~0% | **Med-High** — trajectory forecasting | Verify whether the RIE cluster is live; if so, trigger compute; if not, decommission. | Medium |
| 10 | **Orphan engine** — `lib/engines/successSignatureEngine.ts` | **None** — only appears in `engines/index.ts` barrel. | 0% | **Low-Med** | Remove or wire into a tab. | High |
| 11 | **Ops/debug APIs** — `POST /api/csi/recalculate` (manual trigger), `GET /api/career/memory/dump`, `GET /api/pragati/ontology`, `GET /api/admin/capadex/audit-events`, `/concerns-summary`, `/payments` | No frontend refs. Some are intentional manual/ops endpoints. | 0% | **Low** — ops/debug, not product | Leave as ops endpoints or prune; low priority. | High |
| 12 | **Write-only audit tables** — `bsig_audit_logs`, `bench_audit_logs` | No application SELECT readers (only test cleanup). | 0% (by design) | **Low** — audit/forensic | Acceptable as audit logs; add retention/pruning. Not true waste. | High |

---

## Findings by Requested Category

### 1. Dead Intelligence (computed/persisted, never reaches a surface)
- **Insight-Explainer lineage** (`/explain`) — items #1.
- **Top-5 intervention recommendations** (`capadex_intervention_recommendations`) — item #2.
- **Composite signals** (`capadex_session_composites`) — item #4.
- These run inside the advisory-locked completion transaction on **every** session — real compute cost, zero surface.

### 2. Orphan Intelligence (built, exported, no caller)
- `successSignatureEngine.ts` (item #10).
- `careerEvents.ts` pipeline + dispatchers (item #7).
- Five Zustand stores never subscribed (item #8).
- *Note:* `longitudinalIntelligenceEngine` and `visibilityEngine` were initially flagged by exploration but **verification showed they ARE referenced** by services/modules — excluded from waste (the modules that consume them may be unrendered, a deeper question outside this pass).

### 3. Unused APIs (registered, never called by any frontend)
- `POST /api/predictions/compute`, `POST /api/csi/recalculate`, `GET /api/career/memory/dump`, `GET /api/pragati/ontology`, `GET /api/admin/capadex/audit-events`, `/concerns-summary`, `/payments`.
- `GET /api/capadex/session/:id/explain`, `/signals`, `/patterns` — registered, frontend never calls (items #1, #5).
- **Corrected from exploration (these ARE consumed):** `/api/admin/capadex/analytics` (CapadexAnalyticsPanel), `/risk-flags` + `/interventions` (CapadexInterventionsPanel), `/api/bios/fusion/compute` (BIOSFusionPanel), `/api/bios/neuro-symbolic/analyze`, `/causal`, `/emergent` (BIOSFrontierPanel).

### 4. Unused Signals
- Core CAPADEX signals **are** consumed (graph, classifier, omega-report-builder, RIE). **However** the per-session `/signals` endpoint and the granular signal detail are never rendered — signals reach the user only collapsed into readiness scalars and the OMEGA-X payload.

### 5. Unused Patterns
- `capadex_session_patterns` is computed and explainable but never rendered granularly (item #5). Patterns surface only as inputs to the 5 readiness scalars.

### 6. Unused Recommendations
- `capadex_intervention_recommendations` (Top-5 Best-Next-Actions) — item #2, **0% surfaced**. Highest-value "actionable" output going entirely unused.
- Session interventions (item #3) — same fate.

### 7. Unused Computations
- The behavioural **spine** (composites + patterns + interventions + recommendations + insight lineage) runs every completion and is reduced to **5 scalars** by `career-behavior-adapter.ts`. The expensive structure is computed, then discarded at the UI.
- `predictions/compute` path (item #9) — possibly computed-and-never-triggered.

### 8. Unused Memory Structures
- **Career memory tables** (item #6): `career_interventions_log`, `career_trajectory_history`, `career_benchmarks_history`, `career_growth_patterns` — defined in migration `20260519_career_memory.sql`, **never written or read**. Pure dead schema.
- **Write-only audit tables** (item #12): `bsig_audit_logs`, `bench_audit_logs` — written, never read by app code (acceptable as audit, but unmanaged).
- *Corrected:* `gov_explainability_logs` **is** read (`governance-workflow.ts`) — not waste.

---

## Explicitly NOT Waste (excluded to avoid false positives)
- **`GET /api/career/behavior-graph/:userId` + `brain.behaviorGraph`** — just built as **Phase-2 staged groundwork** for the Career-OS roadmap; intentionally not yet consumed (P3+ will read it). Excluded by design.
- **`brain.careerReadiness` and peers** — verified consumed (`StudentCareerPage.tsx`); `behaviorProfile` consumed in `CareerBuilderPage.tsx`.
- **OMEGA-X payload + OMEGA quality/memory** — actively rendered in the report.
- **CSI core compute** — `recalculateCSI` runs in completion hooks; only the *manual* `/recalculate` route is unused.

---

## Top 3 Recommendations (by ROI)
1. **Surface the spine in the report** — the report already loads per session; add an "explainability" section that renders the **already-persisted** patterns + insight lineage (#1, #5). Near-zero new compute, high perceived value.
2. **Render the Top-5 Best-Next-Actions** (#2) in the report and/or `NextBestActionsTab` — the most monetisable output, currently 0% surfaced.
3. **Decide on the dead Career-memory schema and frontend event pipeline** (#6, #7, #8) — either wire them in upcoming Career-OS phases or remove, to stop schema/architecture drift.
