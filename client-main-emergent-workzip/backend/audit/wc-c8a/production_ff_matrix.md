# WC-C8A — Production Feature-Flag Activation Matrix

**Date**: 2026-06-10  
**Purpose**: Classify each `FF_*` runtime flag for the Free Consumer Launch and Paid Consumer Pilot.  
**Source**: `backend/config/feature-flags.ts` (static file-registry flags) and the `Backend API` workflow command.

---

## Verdict Legend

| Verdict | Meaning |
|---|---|
| **SAFE_TO_ENABLE** | Tested, self-contained, no billing/PII side-effects; enable at launch. |
| **REVIEW_FIRST** | Depends on an upstream gate (data completeness, billing, third-party) that must be checked; enable when gate passes. |
| **HOLD** | Commercial/paid-pilot-only or contains known gaps; hold until post-pilot phase. |

---

## Free Consumer Launch — Minimum flag set

| Flag | Verdict | Rationale |
|---|---|---|
| `FF_WC3_STAGE` | **SAFE_TO_ENABLE** | Stage intelligence is read-only projection over existing session data; no billing touch; tested (WC-3 L1 audit complete). |
| `FF_WC3_OUTCOME` | **REVIEW_FIRST** | Outcome crosswalk depends on `FF_WC3_OUTCOME_CROSSWALK` and a populated behavioural spine; verify spine-capture is live (see `audit/launch-readiness/`); outcome will degrade gracefully if spine empty — UNCLASSIFIED response, not 500. |
| `FF_DECISION_PERSISTENCE` | **SAFE_TO_ENABLE** | Idempotent snapshot writes; no PII beyond what the session already holds; append-only. |
| `FF_BEHAVIOUR_NAMESPACE_ALIGNMENT` | **SAFE_TO_ENABLE** | Projection fix (correct concern keys → deficit dims); additive, flag-off is byte-identical to prior broken behaviour. Enable to get correct namespace. |
| `FF_RUNTIME_INTELLIGENCE_ACTIVATION` | **REVIEW_FIRST** | Gates Dynamic Report Intelligence (Phase 6C) and WC-7c commercial route. Safe to enable IF the four stakeholder report templates are confirmed ready; otherwise degrades to existing report. Check `routes/capadex.ts` `FF_RUNTIME_INTELLIGENCE_ACTIVATION` branches. |
| `FF_RUNTIME_INTELLIGENCE_PIPELINE` | **REVIEW_FIRST** | Read-only resolver pipeline (Phase 6A). Enable together with `FF_RUNTIME_INTELLIGENCE_ACTIVATION`. |

---

## Paid Consumer Pilot — Additional flags

| Flag | Verdict | Rationale |
|---|---|---|
| `FF_WC3_JOURNEY` | **REVIEW_FIRST** | Journey is downstream of outcome (coverage ceiling); mentoring catch-all dilutes confidence. Enable only when outcome coverage is confirmed ≥ target (see `wc3-outcome-coverage-ceiling.md`). |
| `FF_WC3_PERSONALIZATION` | **REVIEW_FIRST** | Personalization layer adds per-user copy variance. Enable when personalization content is signed-off by product. |
| `FF_WC3_LONGITUDINAL` | **REVIEW_FIRST** | Requires ≥ 2 sessions per user for trend data; cold-start sessions degrade to 0% trend correctly. Enable at any point — degrades honestly. |
| `FF_DECISION_ORCHESTRATOR` | **REVIEW_FIRST** | Orchestrator composes L1/L2/L3 (never recomputes); L5B relevance_risk TEXT → numeric penalty mapping must be verified before enabling (see `wc7b-activation-intelligence.md`). |
| `FF_JOURNEY_GROWTH_PLAN_BRIDGE` | **REVIEW_FIRST** | Growth plan bridge to M5; M5 is real but the bridge is partially wired (see `capadex-decision-chain-gaps.md`). Enable only when M5 handoff is confirmed functional. |
| `FF_DECISION_MENTOR_BRIDGE` | **REVIEW_FIRST** | Mentor routing is real for LBI; universal fallback for others. Enable; note that "mentoring" may resolve to the fallback stub for non-LBI users. |
| `FF_COMMERCIAL_ACTIVATION` | **HOLD** | Gates WC-7c commercial activation (subscription mapping, entitlement, offer-fit). Hold until Paid Pilot billing is confirmed end-to-end and refund route is smoke-tested in staging. |

---

## Hold until post-pilot

| Flag | Verdict | Rationale |
|---|---|---|
| `FF_WC3_OUTCOME_CROSSWALK` | **HOLD** | Crosswalk enriches the outcome projection; depends on UNMAPPED-reduction work; hold for Phase 9 post-pilot. |

---

## Static file-registry flags (backend/config/feature-flags.ts)

These flags are read from the in-process config, not from the `FF_*` env vars. They default ON and are not controlled by the workflow command.

| Flag | Default | Notes |
|---|---|---|
| `advancedCompetencyRuntimeV2` | ON | Mature; leave on. |
| `adaptiveAssessmentRuntimeV2` | ON | Mature; leave on. |
| `contextualScoringV2` | ON | Mature; leave on. |
| `adaptiveOrchestrationV2` | ON | Required by Career OS; leave on. |
| `predictiveIntelligenceV2` | ON | Read-only descriptive composition; leave on (outcome_coverage=0 for cold-start, honest). |

---

## Recommended production workflow command (Free Consumer Launch)

```bash
cd backend && \
  FF_RUNTIME_INTELLIGENCE_ACTIVATION=1 \
  FF_RUNTIME_INTELLIGENCE_PIPELINE=1 \
  FF_WC3_STAGE=1 \
  FF_WC3_OUTCOME=1 \
  FF_DECISION_PERSISTENCE=1 \
  FF_BEHAVIOUR_NAMESPACE_ALIGNMENT=1 \
  npm run dev:server
```

Flags to add after verifying gates:
- `FF_WC3_JOURNEY=1` — after journey coverage confirmed  
- `FF_DECISION_ORCHESTRATOR=1` — after L5B penalty map verified  
- `FF_COMMERCIAL_ACTIVATION=1` — after paid-pilot billing confirmed

---

*Document generated by WC-C8A remediation pass. Re-run after each flag-gate verification.*
