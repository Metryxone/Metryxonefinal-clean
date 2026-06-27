---
name: Outcome Intelligence Activation (MX-102X)
description: How the unified six-type Outcome Intelligence composer is wired, and the honesty traps that shaped it.
---

# Outcome Intelligence Activation (MX-102X)

Read-only, flag-gated (`outcomeIntelligenceActivation`, env `FF_OUTCOME_INTELLIGENCE_ACTIVATION`, default OFF) composer that unifies the SIX realized-outcome types (hiring·performance·promotion·retention·career·learning) into ONE surface. It COMPOSES existing engines — it never recomputes a score and never adds a parallel namespace.

## Decisions & why
- **New layer owns its own 6-type taxonomy; do NOT mutate validation-loop `OUTCOME_TYPES` (4 types, live ON).** Each type composes from its canonical source and REUSES the validation-loop/TIG pure helpers (`buildCalibrationModel`, `toCalibrationPairs`, `terminalCandidatesToPairs`, `calibrationSummary`, `evidenceVerdict`, `VALIDATION_K_MIN`). **Why:** validationLoop is a live ON surface; extending its enum risks its behaviour. Composition keeps both honest and DRY.
- **Coverage ⟂ Confidence are never composited.** Coverage = realized (non-demo) outcomes captured (data axis). Confidence = empirical calibration trust, ABSTAINED until ≥ k_min=30 realized {prediction,outcome} pairs. A realized outcome WITHOUT a decision-time prediction counts toward Coverage only — that gap IS the finding.
- **Empirical accuracy is PER TYPE — pairs are NEVER summed across the six types to clear k_min.** The platform is evidence-backed only if at least one SINGLE type individually reaches k_min (gate on `max_type_pairs` / `types_evidence_backed`, not the cross-type `evidence_pairs` sum). **Why:** a code review caught the platform fold deriving `abstained`/verdict from the summed pairs, so 3 types × 10 pairs (=30) would falsely clear k_min=30 though no type qualified — a Coverage⟂Confidence honesty violation. The aggregate `evidence_pairs` is INFORMATIONAL only. The fold lives in pure `summarizePlatform()` so the guard is unit-testable without a DB (see `backend/tests/outcome-intelligence-engine.test.ts`).
- **career = `association_correlation` (off-surface), learning = `not_wired`.** career_outcomes stores `prior_score_value` (not a [0,1] prob) so the calibration axis ABSTAINS rather than coercing a score into a probability; learning (`student_subscriptions`) has no decision-time prediction at all.

## Traps hit (would re-bite)
- **Coverage must EXCLUDE demo or it self-inflates.** The hiring feeder terminal count (`employer_candidates` Hired/Rejected) originally counted ALL rows incl. `@example.com` demos → fabricated coverage. The terminal COUNT must mirror `terminalCandidatesToPairs`' demo filter (`lower(email) NOT LIKE '%@example.com'`). In dev ALL terminal hires are demo, so honest coverage = 0.
- **Ledger vs coverage internal consistency.** Coverage folded in the employer feeder but the ledger originally didn't read `employer_candidates` → 34 coverage vs 0 ledger rows looked broken. Ledger must surface the same substrates coverage counts (demo rows shown, flagged, never counted as evidence).
- `student_subscriptions` has **no `is_demo`** column (career_outcomes/validation_loop_outcomes do) — its demo count is null, not 0.

## Honest dev state
~0 realized non-demo outcomes (never deployed). Verdict **PARTIAL**, accuracy ABSTAINED, realized_coverage 0, evidence_pairs 0 — the honest state, not a defect, never inflated. C3/C7 cert checks stay PARTIAL until k_min.

## Write-side capture wiring (the durable recorders behind Coverage)
- **`validation-loop-intake.ts` is the SINGLE write path** for the 4 calibratable types. Generic `recordValidationOutcome({outcomeType,...})` parameterises `outcome_type` (validated against `['hiring','performance','promotion','retention']`); thin wrappers `recordHiringOutcome`/`recordPerformanceOutcome`/`recordPromotionOutcome`/`recordRetentionOutcome` delegate to it. ALL share ONE contract: flag-gated (`validationLoop`, default ON), never-throws (returns `{recorded,reason}`), demo-aware (`@example.com`→`is_demo=true`), idempotent on `(outcome_type, ref_id)` (ON CONFLICT UPDATEs, never duplicates). A null/out-of-[0,1] prediction is kept NULL (Coverage-only) — never coerced. Per-type default `predicted_basis` in `DEFAULT_BASIS`.
- **Wired to GENUINE employer decision events (no fabrication):**
  - hiring ← candidate terminal stage Hired/Rejected (`snapshotDecisionProb`, ref `employer_candidate:<id>`).
  - performance ← interview PUT recommendation (`recordInterviewPerformanceOutcome`): Strong Hire/Hire→1, No Hire→0, Maybe/blank→skip. Prediction = `match_score/100` (0/uninitialised→NULL). ref `employer_interview:<id>`.
  - retention ← offer PUT terminal status (`recordOfferRetentionOutcome`): Accepted→1, Declined/Withdrawn/Expired→0, Draft/Sent/Negotiating→skip. Prediction = `predicted_prob_at_decision` else `match_score/100` else NULL. ref `employer_offer:<id>`.
- **promotion has NO realized in-app event** (only a PREDICTION surface, `ti_outcome_predictions.promotion_probability`). It gets the recorder + the HTTP intake `POST /api/validation-loop/outcomes` as its durable capture path — but is deliberately NOT auto-wired to a fake event. **Why:** honesty>optimism — wiring a non-realized event (e.g. a saved career-path intent) would fabricate an outcome. Realized promotions arrive via intake/HRIS, same posture as career/learning being off-surface.
- **Trap: `employer_candidates` has NO `candidate_user_id`/`user_id` column** — the hiring snapshot read them off `SELECT *` so they were silently `undefined`→null. Explicit-column SELECTs must use real cols only (`email`, `match_score`, `predicted_prob_at_decision`, `capadex_session_id`); use `capadex_session_id` as `assessmentRef`, leave `subjectUserId` null.

## Surfaces
- Engine `backend/services/outcome-intelligence-engine.ts` (`composeOverview/composeType/composeLedger/composeCertification`, `pseudonym` = sha256 `user_<12hex>`, to_regclass probe + `safeCount` null-on-error).
- Routes `backend/routes/outcome-intelligence.ts` (GET `/enabled` no-auth · `/overview` `/ledger` `/certification` `/type/:type` all flagGate→requireAuth→requireSuperAdmin; literal-before-:param).
- Frontend `frontend/src/components/superadmin/OutcomeIntelligencePanel.tsx`, nav `outcome-intelligence` (Reports group), probe-gated on `/enabled` res.ok.
- Scripts `backend/scripts/mx102x-certification.ts` (→ `backend/audit/mx-102x/*.md` founder report, PII-masked) + `mx102x-smoke-on.ts` (throwaway-app ON-path route smoke; does NOT touch the live workflow).
