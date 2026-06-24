---
name: Outcome Intelligence Activation (MX-102X)
description: How the unified six-type Outcome Intelligence composer is wired, and the honesty traps that shaped it.
---

# Outcome Intelligence Activation (MX-102X)

Read-only, flag-gated (`outcomeIntelligenceActivation`, env `FF_OUTCOME_INTELLIGENCE_ACTIVATION`, default OFF) composer that unifies the SIX realized-outcome types (hiring·performance·promotion·retention·career·learning) into ONE surface. It COMPOSES existing engines — it never recomputes a score and never adds a parallel namespace.

## Decisions & why
- **New layer owns its own 6-type taxonomy; do NOT mutate validation-loop `OUTCOME_TYPES` (4 types, live ON).** Each type composes from its canonical source and REUSES the validation-loop/TIG pure helpers (`buildCalibrationModel`, `toCalibrationPairs`, `terminalCandidatesToPairs`, `calibrationSummary`, `evidenceVerdict`, `VALIDATION_K_MIN`). **Why:** validationLoop is a live ON surface; extending its enum risks its behaviour. Composition keeps both honest and DRY.
- **Coverage ⟂ Confidence are never composited.** Coverage = realized (non-demo) outcomes captured (data axis). Confidence = empirical calibration trust, ABSTAINED until ≥ k_min=30 realized {prediction,outcome} pairs. A realized outcome WITHOUT a decision-time prediction counts toward Coverage only — that gap IS the finding.
- **career = `association_correlation` (off-surface), learning = `not_wired`.** career_outcomes stores `prior_score_value` (not a [0,1] prob) so the calibration axis ABSTAINS rather than coercing a score into a probability; learning (`student_subscriptions`) has no decision-time prediction at all.

## Traps hit (would re-bite)
- **Coverage must EXCLUDE demo or it self-inflates.** The hiring feeder terminal count (`employer_candidates` Hired/Rejected) originally counted ALL rows incl. `@example.com` demos → fabricated coverage. The terminal COUNT must mirror `terminalCandidatesToPairs`' demo filter (`lower(email) NOT LIKE '%@example.com'`). In dev ALL terminal hires are demo, so honest coverage = 0.
- **Ledger vs coverage internal consistency.** Coverage folded in the employer feeder but the ledger originally didn't read `employer_candidates` → 34 coverage vs 0 ledger rows looked broken. Ledger must surface the same substrates coverage counts (demo rows shown, flagged, never counted as evidence).
- `student_subscriptions` has **no `is_demo`** column (career_outcomes/validation_loop_outcomes do) — its demo count is null, not 0.

## Honest dev state
~0 realized non-demo outcomes (never deployed). Verdict **PARTIAL**, accuracy ABSTAINED, realized_coverage 0, evidence_pairs 0 — the honest state, not a defect, never inflated. C3/C7 cert checks stay PARTIAL until k_min.

## Surfaces
- Engine `backend/services/outcome-intelligence-engine.ts` (`composeOverview/composeType/composeLedger/composeCertification`, `pseudonym` = sha256 `user_<12hex>`, to_regclass probe + `safeCount` null-on-error).
- Routes `backend/routes/outcome-intelligence.ts` (GET `/enabled` no-auth · `/overview` `/ledger` `/certification` `/type/:type` all flagGate→requireAuth→requireSuperAdmin; literal-before-:param).
- Frontend `frontend/src/components/superadmin/OutcomeIntelligencePanel.tsx`, nav `outcome-intelligence` (Reports group), probe-gated on `/enabled` res.ok.
- Scripts `backend/scripts/mx102x-certification.ts` (→ `backend/audit/mx-102x/*.md` founder report, PII-masked) + `mx102x-smoke-on.ts` (throwaway-app ON-path route smoke; does NOT touch the live workflow).
