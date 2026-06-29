---
name: Decision Intelligence Engine (MX-800 2.6)
description: Read-only tier cataloging EXISTING decision capabilities + composing prior intelligence tiers into explainable decision SUPPORT — never decides, never invokes dormant engines.
---

# Decision Intelligence Engine (MX-800 Phase 2.6)

Flag `decisionIntelligenceEngine` / `FF_DECISION_INTELLIGENCE_ENGINE` (default OFF, byte-identical incl.
schema). ENHANCEMENT-ONLY read-only tier; BASE `/api/admin/decision-intelligence`. Mirrors the 2.5
knowledge-intelligence pattern exactly (same honesty scaffold: scalar/rows/pct/tableReady/countTable +
`isSafeTableIdentifier` + memo; service-layer `assertEnabled()` before any `ensureDecisionSchema()` DDL).

## Durable design rules
- **This tier SUGGESTS support, never DECIDES.** Human approval is mandatory; governance reports
  `automated_approval_supported:false`. Honesty ladder: Recommendation ≠ Decision ≠ Automation ≠ Approval
  · Evidence ≠ Confidence ≠ Accuracy · Prediction ≠ Outcome · Coverage ⟂ Confidence ⟂ Evidence.
- **Compose the EXISTENCE / persisted output of the dormant decision engines — NEVER invoke them.**
  decisionOrchestrator / decisionPersistence / decisionMentorBridge are dormant; reading their files +
  their persisted decision tables is fine, *calling* them would be dormant activation. The validator
  proves non-invocation by asserting `wc7b_decision_state` COUNT(*) is unchanged across all read parts.
- **Read-only substrate (COUNT-only, never written):** 9 existing decision tables — `wc7b_decision_state`,
  `ai_decision_audits`, `executive_decision_models`, `interview_decisions`, `role_resolution_decisions`,
  `wc3_personalization_decisions`, `archetype_governance_decisions`, `m4_ai_decision_logs`,
  `m5_executive_decision_audits`. ⚠️ `m5_executive_decision_audits` has NONE of
  created_at/status/owner/confidence columns — never query those on it.
- **Owns ONLY 2 tables:** `decision_registry` + `decision_intelligence_audit_snapshots`. Write paths
  (discover/register/audit-capture) own the lazy ensure-schema; reads `to_regclass`-probe → ready:false.
  OFF ⇒ 0 tables.
- **Metrics = 6 SEPARATE, NO composite** (`composite:null`): decision_quality / decision_confidence /
  decision_coverage / recommendation_quality / governance_compliance / explainability_score.
  `recommendation_quality` + `accuracy_confidence` are **honest-null** — no labeled outcomes exist to
  measure accuracy. `decision_confidence` is STRUCTURAL only (evidence presence/integrity).
- **Confidence basis must derive from MEASURED substrate presence**, not a non-existent field. The
  `DecisionSource` catalog type has no `present` field — explainDecision basis = `(engine_present ||
  table_present) ? 'substrate present' : 'substrate absent'` (the architect caught an early version that
  read `src.present` → always `'unknown'`).

## Flag-gate / smoke
Route gate returns 503 before auth/DDL, but the global `app.use('/api/admin')` auth gate intercepts first,
so OFF smoke ∈ {401,403,503} (incl. `/enabled` → 401). Documented platform convention, identical to
2.1/2.3/2.4/2.5 — do NOT "fix" it to a pure 503.

## Validator
`backend/scripts/mx800-2.6-decision-validate.ts` (must live INSIDE backend/ for tsx). Run with
`FF_DECISION_INTELLIGENCE_ENGINE=1`. 54/54: all parts + honesty contract + sentinel COUNT(*) unchanged on
all 9 decision tables (reads never write / engines never invoked) + `/register` identifier-injection
rejection + cleanup restores 0 owned tables. Drops both owned tables at start AND end (idempotent).
