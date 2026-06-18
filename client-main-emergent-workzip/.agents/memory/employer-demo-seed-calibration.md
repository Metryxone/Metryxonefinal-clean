---
name: Employer demo-seed & calibration activation
description: How to populate the employer suite (Job Fit + calibration badge) with REAL-engine demo data, and the auth/calibration constraints that shape the approach.
---

# Employer demo-seed & calibration activation

How to make the employer P2 "Job Fit & Predictions" UI and the success-probability
calibration badge show populated, trustworthy values in a dev environment.

## Key constraints (non-obvious)
- **Employer routes' `requireAuth` is SESSION-only** (`req.isAuthenticated()` — Passport
  session, routes.ts). There is NO mintable bearer token. So any seed / back-fill must
  call the **exported engine functions server-side** (a `tsx` script), NOT hit the HTTP
  routes. This is why `runHiringAnalysis(pool, orgId, jobId)` was extracted/exported.
- **A dev employer's `org_id == user.id`** for a solo owner (employer_members row maps
  org_id→user_id). `account_type='employer'` (set by `POST /api/employer/register`) is the
  only thing gating portal access; seeding writes `employer_id = <user id>` directly.

## Calibration is LEARNED, not set
- `buildTIGForOrg(pool, orgId)` (employer-tig.ts) learns the calibration model from
  candidates in **terminal stages**: `stage='Hired'`→outcome 1, `'Rejected'`→0.
- The per-candidate training feature is `employer_candidates.predicted_prob_at_decision`
  (0–1). Seed it with `computeSuccessProbability(skills, match_score, jobSkills)` so the
  curve is honest (engine's own prediction at decision time), then draw the realized
  outcome **Bernoulli(predicted)** so outcomes are consistent with — not tuned against —
  predictions.
- `CALIB_MIN_OUTCOMES=30`: ≥30 terminal outcomes → `status='calibrated'`; 1–29 →
  `'provisional'`; 0 → `'cold_start'`. Bands are 0–1 (CALIBRATION_BANDS).

## Honesty pattern for the seed
- Only the candidate **INPUTS** are synthetic; every assessment/calibration **OUTPUT** is
  computed by the real engines. Mark demo data unmistakably: `source='Demo Seed'`, a
  `'demo'` tag, `(DEMO)` in titles, `@example.com` emails (RFC-2606 reserved).
- Coverage vs Confidence falls out naturally: demo emails have no platform LBI, so
  `behavior_match` sits at its neutral default (~55) = honest **coverage** gap, while the
  calibration badge can still read `calibrated` = **confidence** axis. Good demo of the
  two-axis separation.
- Script lives at `backend/scripts/seed-employer-demo.ts`: deterministic PRNG, idempotent
  (cleanup scoped to the fixed demo job id + `source='Demo Seed'`), refuses to run under
  `NODE_ENV=production` unless `DEMO_SEED_CONFIRM=1`.
