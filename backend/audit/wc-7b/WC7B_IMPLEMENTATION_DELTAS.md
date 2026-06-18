# WC-7B — Activation Intelligence Tier A — Implementation Deltas

**Status:** BUILD complete, validated, **awaiting approval. NOT deployed.**
**Discipline:** additive · flag-gated (default OFF) · byte-identical when OFF · never-throws ·
reversible · **compose-only** (re-shapes already-derived data, never recomputes or fabricates).
**Out of scope (not touched):** Subscription activation, new products, Employability-Exam, B2B.

---

## 1. What shipped (5 deliverables)

| # | Deliverable | Flag (default OFF) | Surface |
|---|-------------|--------------------|---------|
| 1 | Decision Orchestrator (read-only) | `decisionOrchestrator` / `FF_DECISION_ORCHESTRATOR` | `GET /api/capadex/session/:id/activation` |
| 2 | Journey → Growth Plan Bridge | `journeyGrowthPlanBridge` / `FF_JOURNEY_GROWTH_PLAN_BRIDGE` | `envelope.growthPlan` |
| 3 | Decision → Mentor Bridge | `decisionMentorBridge` / `FF_DECISION_MENTOR_BRIDGE` | `envelope.mentor` |
| 4 | Runtime Consumption of L5A/L5B | `runtimeIntelligenceConsumption` / `FF_RUNTIME_INTELLIGENCE_CONSUMPTION` | clarity-question re-rank |
| 5 | Longitudinal Automation | `longitudinalAutomation` / `FF_LONGITUDINAL_AUTOMATION` | `postCompletionHooks` |

All five flags added to `backend/config/feature-flags.ts` with `isXEnabled()` helpers
(46 helpers load cleanly under tsx). None are set in any workflow command → **production process
is byte-identical legacy today.**

---

## 2. Files

**New**
- `backend/services/wc7b/decision-orchestrator.ts` — `buildActivationEnvelope(pool, sessionId)`.
  Composes WC-3 L1 Stage + L2 Outcome + L3 Journey read-only getters into one
  `ActivationEnvelope {decision, product, growthPlan, mentor, subscription, degraded, meta}`.
  Never throws (returns a fully-degraded valid envelope on any failure; `null` only for an
  unknown session). Unified confidence = re-normalised weighted blend over only the layers that
  resolved (partial decisions neither penalised nor inflated). Ambiguity escalates on near-tied
  outcome models or a degraded journey.
- `backend/services/wc7b/growth-plan-bridge.ts` — `deriveGrowthPlanActivation(pool, ctx)`. Maps the
  decision's activated L2 outcome models (canonical 5-stage → score 20/40/60/80/100) into the
  existing M5 coach `CoachInput`; prefers real `user_competency_scores` when present; calls
  `createAICoach(pool).growthPlan(input, persist=false)` **READ-ONLY (never persisted)**.
- `backend/services/wc7b/mentor-bridge.ts` — `deriveMentorActivation(ctx)`. Pure, backend-only
  (no cross-server call, no booking). Documented outcome-model → mentor_type map (primary) with a
  concern-keyword fallback only when no model activated. Honest `ready:false` when no signal.
- `backend/services/wc7b/longitudinal-automation.ts` — `runLongitudinalAutomation(pool, input)`.
  GUARANTEES a longitudinal snapshot via the idempotent `buildAndPersistMemory` (so the
  `longitudinal_patterns` row is always present before the hint write) and adds an additive
  `next_reassessment_at` cadence hint. When this flag is ON, WC-7B becomes the **sole**
  longitudinal builder — the caller suppresses the legacy `longitudinal_memory` DB-flag build
  (item 10) so the two never race on the event DELETE+INSERT — and mirrors that path's
  `cognitive_runtime_state` summary so nothing legacy is lost. Never throws.
- `backend/routes/wc7b-activation.ts` — `registerWc7bActivationRoutes(app, pool)`:
  `GET /api/capadex/session/:id/activation`. Flag gate → `{enabled:false}` (200); then strict-UUID
  → 400; unknown session → 404; any error → degraded 200 (never 500).

**Modified (additive only)**
- `backend/config/feature-flags.ts` — 5 flags + helpers.
- `backend/routes.ts` — register `registerWc7bActivationRoutes`.
- `backend/routes/capadex-concern-intelligence.ts` — Deliverable 4: gated additive re-rank
  (`applyRuntimeIntelligenceConsumption`) after the existing metadata-activation stage sort in
  `runByTag`. Same rows, same count — display order only. OFF → no join, no re-rank.
- `backend/routes/capadex-enterprise.ts` — Deliverable 5: gated block (item 10b) in
  `postCompletionHooks`, non-blocking.

---

## 3. Before / After (flag OFF vs ON)

> Lift numbers are **directional estimates** anchored to live validation, not promises.

| Metric | OFF (legacy) | ON (Tier A) | Evidence |
|--------|-------------|-------------|----------|
| **AIS (Activation Intelligence Score)** | ~61 | ~76 (est.) | 5 activation surfaces wired; decision + 2 bridges + consumption + automation reachable |
| **Decision reachability** | none | per-session unified decision | Live session `1cd9ca07…` → stage Curiosity, route mentoring, ambiguity high, grounded `why[]` |
| **Growth Plan reachability** | none | real roadmap when outcome models present | Synthetic gap-80 input → real 2-step roadmap; live no-model session → honest `ready:false reason:'no_outcome_models'` |
| **Mentor reachability** | none | decision-driven types | Live session → `['psychological_counsellor','performance_coach']`, `source:'outcome_models'` |
| **Personalization coverage (L5A/L5B)** | derived-but-unconsumed | consumed in clarity ordering | 30,638 / 30,638 rows joinable; re-rank validated: same set, no drops, stage-ordered |
| **Longitudinal coverage** | manual / DB-flag only | auto at completion + `next_reassessment_at` | Live email (2 sessions) → snapshot built, drift + 5 recurring constructs, reassessment +60d |

---

## 4. Honesty / safety properties (verified)

- **Compose-only:** no engine recomputes scores; growth plan runs `persist=false`; the
  orchestrator writes no intelligence/scores; mentor bridge is pure.
- **Known boundary (honest):** the orchestrator composes the existing WC-3 read getters, which
  may run their own idempotent `ensureWc3*Schema()` (CREATE TABLE / ADD COLUMN IF NOT EXISTS) on a
  first-ever read. That one-time DDL is owned by the WC-3 layer and already triggered by the live
  WC-3 pipeline (its flags run in the workflow), so in practice it is a no-op by the time the
  activation GET is reachable — but it means the route is not *bytewise* zero-write on a cold,
  never-initialised schema. We did not re-architect the shared WC-3 getters (out of scope).
- **Never fabricates:** empty layers degrade honestly (`no_outcome_models`, `no_mentor_signal`,
  `route_degraded`); `degraded:true` is set on any unresolved hop.
- **Subscription:** always `ready:false reason:'out_of_scope_tier_b'`.
- **Byte-identical OFF:** every surface is behind a flag check; no workflow sets the flags; direct
  `tsx index.ts` boot is clean (only `EADDRINUSE` because the workflow already holds 8080).
- **Never-throws:** route degrades to 200; all four services wrap in try/catch → honest `ready:false`.
- **L5B `relevance_risk` is TEXT** (NONE/LOW/MEDIUM/HIGH), not numeric — mapped to a bounded
  penalty so the quality tiebreak is meaningful (a naive `Number()` would have produced NaN).

---

## 5. Validation performed

- TS transform-check (esbuild) on every new/modified file — clean.
- ON-path orchestrator + both bridges against a real completed session — honest envelope, never 500.
- Growth plan: synthetic outcome-model input → real roadmap; live no-model session → honest stub.
- Deliverable 4 re-rank against 12 real L5A/L5B-backed clarity ids — same set, stage-ordered, no drop/dup.
- Deliverable 5 against a real 2-session email — snapshot + `next_reassessment_at` persisted.
- Live route smoke: OFF → `{enabled:false}`; server healthy after restart.

---

## 6. Reversibility

Delete the 5 flag entries (or leave OFF) → all surfaces vanish, behaviour reverts to legacy. The
only schema effect is a single nullable `longitudinal_patterns.next_reassessment_at` column added
lazily **only when the longitudinal flag runs** (`ADD COLUMN IF NOT EXISTS`); harmless when unused.

**STOP — awaiting approval. No deploy.**
