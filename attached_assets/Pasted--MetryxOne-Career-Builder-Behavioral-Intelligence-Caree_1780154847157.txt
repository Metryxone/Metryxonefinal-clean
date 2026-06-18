# MetryxOne Career Builder → Behavioral Intelligence Career OS
## Architecture Blueprint (for review — no code implemented)

**Date:** May 30, 2026
**Role:** Principal Architect deliverable
**Status:** ARCHITECTURE ONLY. Per the brief: *"Do not implement code yet. Perform architecture analysis first and provide a complete implementation blueprint for review."* No source files were modified.

### Constraints honored in this design
- ❌ No modification to `SuperAdminDashboard.tsx`
- ❌ No modification to `server/src/lib`
- ❌ No new tabs — all new intelligence surfaces inside **existing** Career Builder tabs/zones
- ❌ No removal of existing functionality; ❌ no breaking API changes (all additions are additive)
- ✅ Reuse existing engines; ✅ orchestration over new features; ✅ reports before implementation

### Grounding & verification note
This blueprint is grounded in the live codebase and `replit.md` (the documented single source of truth). A few capabilities surfaced during exploration **could not be confirmed against `replit.md`** and are explicitly marked **⚠ VERIFY** below; the design does not depend on them being true. Treat those as "confirm in Phase 0" items.

---

## 1. Current Architecture Assessment

### 1.1 Intelligence-producing modules (confirmed)

**Backend (canonical compute + persistence):**
| Module | Produces | Persisted | Exposed via |
|--------|----------|-----------|-------------|
| `signal-activation-runtime.ts` | Signals → Composites → Patterns → Interventions (one advisory-locked txn) | `capadex_session_signals/_composites/_patterns/_interventions` | (internal, on completion) |
| `composite-signal-engine.ts` / `pattern-engine.ts` | Composite signals, behavioural patterns (dynamic from ontology) | as above | — |
| `capadex-intervention-engine.ts` | Library-backed interventions (never generic) | `capadex_session_interventions` | — |
| `behavior-graph-service.ts` | **Unified Behavior Graph** (the existing single aggregator) | `capadex_behavior_graph` (PK session_id) | consumed internally + adapters |
| `intervention-intelligence.ts` | Top-5 ranked **Best Next Actions** | `capadex_intervention_recommendations` | `getInterventionRecommendations()` |
| `capadex-explainability-engine.ts` | Per-pattern lineage (read-only) | — | `GET /api/capadex/session/:id/explain`, `/signals`, `/patterns` |
| `capadex-insight-explainer.ts` | Report-level explanation (read-only) | — | `GET /api/capadex/session/:id/explain` (additive fields) |
| `career-behavior-adapter.ts` | `CareerBehaviorProfile` (readiness dims + constraints + drivers) | — | `GET /api/career/behavior-profile/:userId` |
| `csi.ts` | Career Stage Index profiles/trajectory | `csi_profiles/_trajectory/_domain_weights` | `/api/csi/*` |
| `behavioural-memory.ts` | Per-user behavioural time-series + computed improving/worsening signals, stable/emerging patterns | `capadex_behavioural_memory`, `career_memory_snapshots` | `/api/career/behavioural-memory/*` |
| OMEGA-X (`quality-validator.ts`, `longitudinal-memory.ts`) | Report quality, longitudinal memory, contradictions | — | `GET /api/capadex/report/:id/omega` |

**Frontend (pure-function engines, deterministic, explainable):**
`runEmployabilityEngine` (EI 0–99), `runFitmentEngine` (fit + missing skills), `runIDPEngine`/`adaptiveIDPEngine` (IDP phases + ETA + lift), `runVisibilityEngine` (recruiter views/discovery), `runProfileIntelligenceEngine`, `runBenchmarkEngine`, `runWorkforceEngine`, `careerTrajectoryEngine`/`futureMapEngine`/`recommendationEngine` (trajectory, switchability, future roles), `learningVelocityEngine`, `genomeEngine`/`competencyEngine`, `generateWeeklyActions` (Top-5 weekly actions).

**Frontend aggregator:** `useCareerBrain` → 13-field `CareerBrain` (+ helper fields) fusing profile, jobs, goals, eiScore, competency dimensions, behavioural-memory signals/patterns, and the CAPADEX `behaviorProfile`.

### 1.2 Intelligence-consuming modules
- `useCareerBrain` consumes everything above and is itself consumed by the Career Builder tabs.
- `weeklyActionEngine`, `WeeklyActionPlanTab`, `NextBestActionsTab`, `BehavioralGrowthTab`, `CareerMemoryTab`, `FutureMapTab`, `JobsTab`/`FitmentInsightsPanel`, `InterviewTab`, `DevelopmentPlanTab` consume `CareerBrain` + engine outputs.

### 1.3 Additional intelligence sources — status
| Source | Status | Lands in | Graph connection |
|--------|--------|----------|------------------|
| CAPADEX assessment | **REAL** | `capadex_*` | Direct → behavior graph |
| Competency assessment | **REAL** | `cra_*`, competency tables | `/api/competency/score` → brain |
| Resume intelligence | **REAL** | `career_seeker_profiles` | Identity anchor in brain |
| Employer intelligence | **REAL/HYBRID** | `employer_jobs` | Fitment gap analysis |
| Simulations | **PRESENT (engine + `useSimulationStore`)** ⚠ VERIFY depth of signal emission | `simulation_attempts` ⚠ | Partial |
| Surveys | **ROLE-SPECIFIC components only** ⚠ VERIFY (no unified survey→graph contract) | ⚠ | Weak/none |
| Mentor notes | **STATIC catalog** (`mentors.ts`); booking/notes model ⚠ VERIFY | n/a | **ORPHANED** from graph |
| AI Copilot grounded in behavior graph | **DOES NOT EXIST** (Pragati = assessment/conversational runtime; `ChatWidget` = global shell opened by `mx-open-chat`, not graph-grounded Q&A) | — | **MISSING** |

### 1.4 Current maturity (per domain, 0–5)
Career Intel 3 · Skill 3 · Learning 2 · Talent Mktpl 2 · Employability 4 · Coaching 3 · Opportunity 2 · Portfolio 3 · **Behavioral 5** · Workforce 3.

**Headline:** The compute layer is rich and largely real; the deficit is **orchestration and surfacing** — multiple strong outputs are computed but never unified, never explained to the user, or never fed back as outcomes. This is an integration problem, not a compute problem — which is exactly why "orchestration over new features" is the right mandate.

---

## 2. Intelligence Flow Map (PHASE 1)

### 2.1 Canonical desired flow
```
                    ┌──────────────── INTELLIGENCE SOURCES ────────────────┐
 CAPADEX Assessment │ Competency Assessment │ Resume │ Simulations │ Surveys │ Mentor Notes │ Employer
        │                    │                  │          │           │           │            │
        ▼                    ▼                  ▼          ▼           ▼           ▼            ▼
   Signals/Patterns/    Competency Scores   Profile    Sim signals  Survey     Mentor       Employer
   Interventions/CSI    + dimensions        identity   + traits     signals    feedback     requirements
        │                    │                  │          │           │           │            │
        └────────────────────┴───────┬──────────┴──────────┴───────────┴───────────┘            │
                                      ▼                                                            │
                         ╔══════════════════════════╗                                             │
                         ║   BEHAVIOR GRAPH (P2)     ║◄── single source of truth ──────────────────┘
                         ║  strengths · risks ·      ║
                         ║  patterns · contradictions║
                         ║  growthDrivers/Blockers · ║
                         ║  competencySignals        ║
                         ╚════════════╦═════════════╝
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                          ▼
   CONSTRAINT ENGINE (P3)   NEXT BEST ACTION (P4)        PROGRESS LEDGER (P5)
   "why not progressing?"   3–5 explainable actions      growth timeline (5 axes)
            │                         │                          │
            └─────────┬───────────────┴──────────┬───────────────┘
                      ▼                            ▼
        OUTCOME ATTRIBUTION (P6)         EMPLOYABILITY PASSPORT (P7)
        action → outcome deltas          verified, explainable artifact
                      │                            │
                      └──────────────┬─────────────┘
                                     ▼
                        AI CAREER COPILOT (P8)
            "Why am I stuck? · What next? · Biggest gap? · Highest ROI?"
```

### 2.2 Example concrete flow (the brief's example, grounded)
```
CAPADEX Assessment
  → Signals/Patterns (signal-activation-runtime)
  → Behavior Graph (behavior-graph-service)
  → Competencies (competencyEngine) + CSI
  → Future Map (futureMapEngine, behavior-aware)
  → IDP (idpEngine, behaviorally paced)
  → Learning (idp items → content)
  → Simulation (validates readiness, emits new signals)
  → Velocity (learningVelocityEngine adjusts cadence)
  → Outcome Attribution (course done → competency +Δ)
  → Progress Ledger (records the +Δ on the timeline)
  → Passport (reflects new verified competency)
```

---

## 3. Orchestration Gap Report

| Gap | Evidence | Consequence | Fix (phase) |
|-----|----------|-------------|-------------|
| **Two "behavior graphs"** | Backend `behavior-graph-service` (canonical, persisted) + frontend `useCareerBrain.behavioralConstraints`/`signals`/`patterns` (re-derived) | Drift risk; frontend re-derives what backend already computed | P2: frontend `behaviorGraph.ts` becomes a **typed client** over the backend graph, not a re-computation |
| **No constraint/root-cause layer** | `coreBottleneck` is a single heuristic string in brain; risks scattered across `riskFactors`, `careerConstraints`, `capadex_risk_flags` | "Why am I stuck?" is unanswerable in one place | P3 |
| **Two next-action systems, unmerged** | Frontend `generateWeeklyActions` + backend `intervention-intelligence` Top-5 (`capadex_intervention_recommendations`) — never combined | Users see two different "next action" lists; backend's library-backed actions are under-surfaced | P4: single ranker that ingests both |
| **Growth tracked but not unified** | `behavioural-memory` (behaviour deltas) + `csi_trajectory` + `p4_competency_history` + EI over time — no single timeline | No "here's how far you've come" surface | P5 |
| **No outcome attribution loop** | `capadex_interventions.outcome_score` + `POST /api/learning/attribution` exist but aren't tied action→Δ | Cannot prove "this action moved this metric" | P6 |
| **No portable passport** | EI provenance + competency + behaviour exist separately | No single verifiable artifact | P7 |
| **No graph-grounded copilot** | Pragati is assessment-bound; ChatWidget is a shell | The intelligence is invisible day-to-day | P8 |
| **Mentor/survey/simulation outputs partially orphaned** | Mentor static; survey contract absent; sim signal-emission ⚠ | Sources don't all reach the graph | P2 source adapters |

---

## 4. Duplicate Logic Report

| Metric | Computed in | Recommendation |
|--------|-------------|----------------|
| **Employability (EI)** | `runEmployabilityEngine` called from `useIntelligenceStore.compute`, `simulationService`, `computeDashboardIntelligence` | Single memoized selector; engine stays pure, callers read one cached result |
| **Interview/execution readiness** | Heuristic in `useCareerBrain` AND authoritative in backend `career-behavior-adapter` (`/behavior-profile`) | Already gated (adopt backend when `session_id` present). Formalize: backend is canonical, frontend heuristic is *fallback only* — document the precedence in `behaviorGraph.ts` |
| **Skill gaps** | `useCareerBrain.deriveSkillGaps` AND `runFitmentEngine.missingSkills` | Consolidate into one `competencySignals[]` producer in the graph; both consumers read it |
| **behavioralConstraints / patterns / signals** | `useCareerBrain` re-derives from behavioural-memory; backend graph already has them | P2 client removes re-derivation |
| **targetRole** | `useIntelligenceStore`, `useCompetencyStore`, localStorage `mx-career-target-role` | Single source (store) with localStorage as persistence mirror; remove brain's "localStorage-first" read drift |

**Principle:** none of these require deleting an engine. They require a **single read-path** (selector/graph client) so each metric is computed once and consumed many times.

---

## 5. Missing Integration Report

| Missing link | What to wire | Phase |
|--------------|--------------|-------|
| Mentor notes → graph | Define `MentorSignal` source adapter (feedback → growthDrivers/blockers) | P2 |
| Surveys → graph | Define `SurveySignal` adapter (calibrates confidence) — needs a survey→signal contract | P2 |
| Simulation → graph | Confirm sim emits `signalTags`/`traits` into capture; wire into graph sources | P2 |
| Action → outcome | Attribution engine consuming `outcome_score` + learning attribution | P6 |
| Unused backend routes | `career-workforce.ts` predictive/enterprise routes + `paie-opportunity.ts` are **never called by frontend** — either surface (within existing Workforce tab) or formally deprecate | P1 cleanup |
| Backend graph → frontend | `GET /api/career/behavior-graph/:userId` (additive) so the frontend client reads the canonical graph directly | P2 |

---

## 6. PHASE 2 — Behavior Graph Design (`behaviorGraph.ts`)

**Design decision (orchestration-first):** Do **not** build a second compute engine. The canonical graph already exists in `behavior-graph-service.ts`. Introduce a frontend **`behaviorGraph.ts`** that (a) defines the unified consumer-facing interface the brief specifies, and (b) **assembles it from existing persisted outputs** via a thin additive endpoint.

```typescript
// frontend/src/lib/intelligence/behaviorGraph.ts  (NEW — client/assembler, not compute)
export interface BehaviorGraph {
  strengths:          GraphNode[];   // from signals (positive valence) + competency top strengths
  risks:              GraphNode[];   // from capadex_risk_flags + contradiction_events + low-score gates
  patterns:           GraphNode[];   // from capadex_session_patterns / behavioural-memory patterns
  contradictions:     GraphNode[];   // from contradiction_events (OMEGA-X)
  growthDrivers:      GraphNode[];   // from OMEGA-X longitudinal growth + behaviour "improving" signals
  growthBlockers:     GraphNode[];   // from behaviour "worsening" signals + execution constraints
  competencySignals:  CompetencySignal[]; // from competencyEngine dimensions + validation events
  meta: { confidence:number; sources:SourceTag[]; sessionId?:string; generatedAt:string };
}
export interface GraphNode { id:string; label:string; severity?:number; confidence:number; evidence:EvidenceRef[]; }
export interface CompetencySignal { domain:string; level:number; trend:'up'|'flat'|'down'; evidence:EvidenceRef[]; }
export interface EvidenceRef { source:SourceTag; ref:string; detail:string; } // explainability
export type SourceTag = 'capadex'|'assessment'|'survey'|'mentor'|'simulation'|'resume'|'employer'|'csi'|'omega';
```

**Must consume** (per brief): CAPADEX ✅, Assessments ✅, Surveys (adapter, P2), Mentor Notes (adapter, P2), Simulations (adapter, P2) — each via a **source adapter** that maps raw output → `GraphNode[]`/`EvidenceRef[]`. Missing/empty source ⇒ skipped, never fabricated (matches existing best-effort pattern).

**Backend support (additive, non-breaking):** `GET /api/career/behavior-graph/:userId` — reuses `requireAuth` + `resolveEffectiveUserId` IDOR guard; assembles from existing tables via `behavior-graph-service` + `behavioural-memory` readers. **Reuse, no new compute.**

**Surface (no new tab):** powers `BehavioralGrowthTab` + Intelligence Hub zone (existing).

---

## 7. PHASE 3 — Constraint Engine Design (`constraintEngine.ts`)

**Goal:** one explainable answer to *"Why is this person not progressing?"*

```typescript
// frontend/src/lib/intelligence/constraintEngine.ts  (NEW orchestration)
export type ConstraintType = 'behavior'|'skill'|'experience'|'execution'|'confidence';
export interface Constraint {
  type: ConstraintType;
  rootCause: string;              // non-generic, names the actual signal/competency
  evidence: EvidenceRef[];        // from BehaviorGraph + competency + jobs
  severity: 'critical'|'high'|'medium'|'low';
  blocksGoal: string;             // which target the constraint blocks
  recommendedActions: ActionRef[];// links to Next Best Action engine (P4)
}
export interface ConstraintReport { constraints:Constraint[]; primary:Constraint; confidence:number; sources:SourceTag[]; }
export function deriveConstraints(graph:BehaviorGraph, brain:CareerBrain, ctx:CareerCtx): ConstraintReport;
```

**Mapping (reuse existing signals, deterministic):**
- **behavior** ← graph.growthBlockers / risks / contradictions (e.g., Overthinking, Avoidance, Decision Fatigue)
- **skill** ← graph.competencySignals gaps vs target role (reuse `runFitmentEngine.missingSkills`)
- **experience** ← profile experience vs role requirement (reuse profile intel)
- **execution** ← `behaviorProfile.executionReadiness` < threshold + job pipeline stagnation
- **confidence** ← CAPADEX confidence signals + low EI provenance factors

**Severity** = f(impact on target × evidence strength). **Pure, deterministic, explainable.** Surfaces inside existing `BehavioralGrowthTab`/Command Center.

---

## 8. PHASE 4 — Next Best Action Engine (`nextBestActionEngine.ts`)

**Goal:** every user always gets **3–5** explainable, evidence-backed, behavior-aware actions.

```typescript
// frontend/src/lib/intelligence/nextBestActionEngine.ts  (NEW — ranker/merger, reuses two existing producers)
export interface NextBestAction {
  id:string;
  kind:'complete_project'|'take_assessment'|'run_simulation'|'schedule_mentor'|'apply_role'|'learn'|'intervention';
  title:string;
  why:string;                    // names the constraint/signal it resolves (non-generic)
  evidence:EvidenceRef[];
  expectedOutcome:{ metric:string; delta:number };  // ties to Outcome Attribution (P6)
  roiScore:number;               // effort-adjusted impact
  deepLink:TabId;                // existing canonical TabId only — NO new tabs
  source:'weekly_engine'|'intervention_intelligence'|'constraint';
}
export function getNextBestActions(input:{
  graph:BehaviorGraph; constraints:ConstraintReport; brain:CareerBrain;
  weekly:WeeklyAction[];                       // reuse generateWeeklyActions
  interventionRecs:BestNextAction[];           // reuse backend intervention-intelligence Top-5
}): NextBestAction[]; // length 3–5, deduped, ROI-ranked
```

**Orchestration, not new logic:** merge `generateWeeklyActions` (frontend) + `getInterventionRecommendations` (backend Top-5) + constraint-derived actions; dedupe by construct/target; rank by ROI = impact ÷ effort, biased by `executionReadiness` (low → favour low-effort, in-motion actions — reuses the existing nudge philosophy). Guarantees ≥3 via graceful fallback to weekly engine. Surfaces in existing `NextBestActionsTab`/`WeeklyActionPlanTab`.

---

## 9. PHASE 5 — Progress Ledger (`progressLedger.ts`)

**Goal:** one unified growth timeline across 5 axes.

```typescript
// frontend/src/lib/intelligence/progressLedger.ts  (NEW read-layer over existing history)
export type GrowthAxis = 'learning'|'behavior'|'career'|'competency'|'employability';
export interface LedgerEntry {
  ts:string; axis:GrowthAxis; metric:string; value:number; delta:number;
  cause?:ActionRef;            // set when attributable (P6); else observational
  evidence:EvidenceRef[];
}
export interface GrowthTimeline { entries:LedgerEntry[]; byAxis:Record<GrowthAxis,LedgerEntry[]>; summary:GrowthSummary; }
export function buildProgressLedger(sources:{
  behaviouralMemory:BehaviourMemorySeries;   // /api/career/behavioural-memory (exists)
  csiTrajectory:CSITrajectory;               // /api/csi (exists)
  competencyHistory:CompetencyHistory;       // p4_competency_history (exists, append-only)
  eiHistory:EISnapshot[];                     // from career_memory_snapshots (exists)
}): GrowthTimeline;
```

**Reuse:** all four series already persist (append-only history is a documented constraint — honored). Ledger is a **read/merge layer**, optionally backed by an additive `GET /api/career/progress-ledger/:userId`. Surfaces in existing `CareerMemoryTab`/`BehavioralGrowthTab`.

---

## 10. PHASE 6 — Outcome Attribution Engine (`outcomeAttributionEngine.ts`)

**Goal:** connect actions → outcomes (Course → Competency +5; Simulation → Readiness +3; Mentor → Confidence +2; Assessment → Skill validation +4).

```typescript
// frontend/src/lib/intelligence/outcomeAttributionEngine.ts  (NEW; consumes ledger + action log)
export interface Attribution {
  action:ActionRef; outcomeMetric:string; observedDelta:number;
  attributedDelta:number;       // delta net of baseline drift
  confidence:number;            // window proximity + isolation of cause
  method:'pre_post'|'intervention_outcome_score'|'learning_attribution';
}
export function attributeOutcomes(input:{
  ledger:GrowthTimeline;
  actionLog:CompletedAction[];                 // assessment/sim/course/mentor completions
  interventionOutcomes:InterventionOutcome[];  // capadex_interventions.outcome_score (exists)
  learningAttribution:LearningAttribution[];   // POST /api/learning/attribution (exists)
}): Attribution[];
```

**Method:** pre/post delta on the ledger around each completed action within a review window, net of cohort/baseline drift; prefer existing `outcome_score` where present. **Generates proprietary effectiveness data no competitor has.** Feeds back into Next Best Action ROI (closes the loop). Additive endpoint optional: `POST /api/career/outcome/attribute`.

---

## 11. PHASE 7 — Employability Passport (`employabilityPassport.ts`)

**Goal:** a single, **explainable, verifiable** artifact.

```typescript
// frontend/src/lib/intelligence/employabilityPassport.ts  (NEW aggregation/packaging)
export interface EmployabilityPassport {
  verifiedSkills:   VerifiedSkill[];     // skill + verification source (assessment/simulation/credential)
  competencies:     CompetencySignal[];  // from graph
  behaviorProfile:  CareerBehaviorProfile; // reuse /behavior-profile
  growthTimeline:   GrowthSummary;       // from progressLedger (P5)
  careerReadiness:  { score:number; band:string; explanation:string };
  evidenceSources:  SourceTag[];
  confidenceScores: Record<string,number>;
  issued:{ at:string; version:string; passportId:string };
}
export function buildPassport(input:{ graph:BehaviorGraph; ledger:GrowthTimeline; ei:EIOutput; behaviorProfile:CareerBehaviorProfile; verifications:Verification[] }): EmployabilityPassport;
```

**Reuse:** EI provenance (`EIProvenanceCard`), competency, behaviour, ledger. **Every field carries explanation + confidence** (matches the platform's explainability brand). Verification tier requires a credential standard (Open Badges/VC) — flagged as a dependency. Shareable/printable view surfaces in existing Profile Studio zone (no new tab). Honors language policy (developmental signals, never hiring predictions).

---

## 12. PHASE 8 — AI Career Copilot (`aiCareerCopilot.ts`)

**Goal:** a graph-grounded copilot answering: *Why am I stuck? · What next? · Biggest gap? · Highest ROI?*

```typescript
// frontend/src/lib/intelligence/aiCareerCopilot.ts  (NEW orchestrator over P2–P6)
export interface CopilotContext {
  graph:BehaviorGraph; constraints:ConstraintReport; actions:NextBestAction[];
  ledger:GrowthTimeline; attributions:Attribution[]; brain:CareerBrain;
}
export interface CopilotAnswer { answer:string; citations:EvidenceRef[]; actions:NextBestAction[]; confidence:number; }
export function answerCareerQuestion(q:string, ctx:CopilotContext): CopilotAnswer;          // deterministic intents
export function answerWithLLM(q:string, ctx:CopilotContext): Promise<CopilotAnswer>;        // grounded generation via existing LLM proxy
```

**Design:** Retrieval-grounded. The four canonical questions map to **deterministic intents** (Why stuck → ConstraintReport.primary; What next → NextBestActions; Biggest gap → top constraint/competency; Highest ROI → top action by roiScore). Free-form questions use the existing **LLM proxy** with the copilot context as grounded context + **mandatory citations** (`EvidenceRef`) — no ungrounded claims. Reuses the global `ChatWidget` shell + `mx-open-chat` event (no new tab). Honors allowed/disallowed term lists.

---

## 13. Dependency Map

```
behaviorGraph (P2)  ──────────────► constraintEngine (P3)
   │  ▲  (source adapters: capadex, assessment, survey, mentor, simulation, resume, employer)
   │  └── backend: GET /api/career/behavior-graph/:userId (additive; reuses behavior-graph-service)
   ▼
nextBestActionEngine (P4) ◄── weeklyActionEngine (exists) + intervention-intelligence (exists) + constraintEngine
   ▼
outcomeAttributionEngine (P6) ◄── progressLedger (P5) ◄── behavioural-memory + csi + competency-history + EI snapshots (all exist)
   ▼ (closes loop into P4 ROI)
employabilityPassport (P7) ◄── behaviorGraph + progressLedger + EI + behavior-profile
   ▼
aiCareerCopilot (P8) ◄── P2 + P3 + P4 + P5 + P6 (+ existing LLM proxy)
```
**Build order is strictly P2 → P3 → P4 → (P5 ∥ P6) → P7 → P8.** P5 and P6 can parallelize after P4. Nothing depends on the unverified items (mentor booking, surveys) — those are optional source adapters that enrich P2 when confirmed.

---

## 14. Implementation Roadmap

| Stage | Phase(s) | Work (all additive) | Effort | Risk |
|-------|----------|---------------------|:------:|:----:|
| **0. Verify & freeze contracts** | P1 | Confirm ⚠ items (simulation signal emission, surveys, mentor model); decide surface-or-deprecate for unused workforce/paie routes; lock interfaces | S | Low |
| **1. Behavior Graph client + endpoint** | P2 | `behaviorGraph.ts` + `GET /api/career/behavior-graph/:userId` (reuses behavior-graph-service); source adapters for confirmed sources | M | Med (consolidating two graphs — must preserve fallback contract) |
| **2. Constraint Engine** | P3 | `constraintEngine.ts`; surface "Why am I stuck" in existing tab | S–M | Low |
| **3. Next Best Action merge** | P4 | `nextBestActionEngine.ts` merging weekly + intervention Top-5; replace dual lists with one (no functionality removed — both feed in) | M | Med (two UX surfaces converge) |
| **4. Progress Ledger** | P5 | `progressLedger.ts` over existing histories; timeline in CareerMemoryTab | M | Low |
| **5. Outcome Attribution** | P6 | `outcomeAttributionEngine.ts`; feed ROI back to P4 | M | Med (attribution validity) |
| **6. Employability Passport** | P7 | `employabilityPassport.ts`; shareable view in Profile Studio | M | Low (verification tier deferred) |
| **7. AI Copilot** | P8 | `aiCareerCopilot.ts`; deterministic intents first, grounded LLM second | M–L | Med (grounding discipline + cost) |

**Total estimated effort:** ~8–11 engineering weeks (single track), shorter if P5/P6 parallelized. **No migrations are strictly required** for P2–P5 read-layers (reuse existing tables); P6/P7 may add small additive tables (action log / passport issuance) behind feature flags per the existing additive-phase convention.

---

## 15. Scorecard

| Metric | Score | Basis |
|--------|:-----:|-------|
| **Current Maturity** | **62 / 100** | World-class behavioral compute (5) + explainable EI (4), but orchestration/surfacing weak; learning/marketplace/opportunity thin (2); duplicate logic + orphaned sources |
| **Future Maturity (post-blueprint)** | **88 / 100** | Unified graph + constraint + NBA + ledger + attribution + passport + copilot turns isolated compute into a closed-loop OS; remaining gap to 100 = live external supply (job feeds, real course content) which is out of this blueprint's scope |
| **Estimated Effort** | **Medium (~8–11 wks)** | Mostly orchestration over existing engines; 1–2 additive endpoints + optional small tables |
| **Estimated Risk** | **Medium-Low** | Additive-only, feature-flagged; main risks are graph consolidation (drift) and attribution validity — both mitigated by preserving existing fallbacks and append-only history |
| **Estimated Business Impact** | **High** | Activates the behavioral moat (proprietary, hard to copy), closes the measurement loop (proves ROI), and produces an ownable artifact (Passport) — directly lifts retention, conversion, and enterprise/B2B optionality |

---

## 16. Final recommendations & open decisions for review

1. **Single graph, single read-path.** Make the backend `behavior-graph-service` canonical; the new `behaviorGraph.ts` is a client. Do not let the frontend re-derive signals/patterns.
2. **Converge the two "next action" systems** (weekly + intervention Top-5) into one ranked list — this is the single highest-clarity UX win.
3. **Close the loop early** (P6 attribution) — it is what makes every other surface trustworthy and generates defensible data.
4. **Defer the verification/credential standard** (Passport tier-2) to a follow-up; ship the explainable Passport first.
5. **Decisions needed from you before Stage 1:**
   - Confirm the ⚠ VERIFY items (simulations / surveys / mentor model) so source adapters are scoped correctly.
   - Approve adding the additive `GET /api/career/behavior-graph/:userId` endpoint (reuses existing service, no breaking change).
   - Confirm convergence of the dual next-action UX is acceptable (no functionality removed; both producers still feed the merged list).

*Prepared as an architecture-only deliverable. No application code, schema, or configuration was modified. Awaiting review before any implementation.*
