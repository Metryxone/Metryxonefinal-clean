---
name: Realized-promotion outcome capture (talent validation loop)
description: How genuine employee-promotion decisions feed the promotion calibration axis without fabrication.
---

# Realized-promotion outcome capture

The talent engine PREDICTS `promotion_probability` (table `ti_outcome_predictions`), but for a long time nothing recorded a REALIZED promotion, so the promotion calibration axis could only ABSTAIN. The fix is a realized-outcome recorder that mirrors the hiring/performance/retention recorders in `employer-portal.ts`.

## The pattern (reuse-before-build)
- The durable writer already exists: `recordPromotionOutcome` in `services/validation-loop-intake.ts` (gated on the `validationLoop` flag, default true; `@example.com` → `is_demo`; idempotent via `ON CONFLICT(outcome_type, ref_id)`; never-throws). Do NOT build a second writer.
- The realized event is a thin helper (`recordRealizedPromotionOutcome` in `routes/talent-outcome-prediction.ts`) exposed through a super-admin route `POST /api/admin/talent/predictions/:email/promotion-outcome`.

## Non-obvious constraints (the honesty contract)
- **Decision-time prediction snapshot**: the standing `promotion_probability` at record time IS the prediction the decision was made against. Snapshot it as `predictedProb`. If no prediction row exists, record `predictedProb = NULL` (Coverage-only) — NEVER fabricate a pair. Calibration only counts non-null pairs toward `k_min=30`.
- **`decision_ref` (per-cycle marker) must be REQUIRED on every call path, not just the HTTP route.** The idempotent key is `ti_promotion:<email>:<rf_id|na>:<decision_ref>`. Without a required marker, two real promotion cycles for the same `(email, rf_id)` collapse into one row → silent under-count of realized outcomes. Do not fall back to `predicted_at`/`'default'` (that fallback collides between recomputes).
- **Prediction lookup is never-throws but must log**: a caught DB error degrades to a NULL-prediction (Coverage-only) row rather than failing capture — but `console.warn` it so an operational issue isn't silent.
- Endpoint lives inside `registerTalentOutcomePredictionRoutes`, which returns early unless `FF_CAREER_GRAPH=1`. That is by design (talent surface is career-graph-gated), so capture availability tracks that flag.

**Why:** promotion calibration must move past ABSTAIN only on genuine realized pairs; a fabricated or collapsed outcome would corrupt the Confidence axis. Coverage⟂Confidence never composited; null≠0.
