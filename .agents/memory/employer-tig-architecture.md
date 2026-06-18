---
name: Talent Intelligence Graph (EP-98-W2)
description: TIG architecture — 6 tig_* tables, 8 engines, graph builder pattern, 100% structural readiness (calibration is data-bound activation, not structural)
---

## Rule
`tig_*` namespace is the ONLY safe prefix for the employer talent graph. `kg_*` = live Employability graph, `pil_kg_*` = PIL graph — never reuse either.

## Architecture
- **6 tables**: tig_nodes (polymorphic, 8 entity types) / tig_edges (5 types) / tig_clusters / tig_intelligence / tig_build_log / tig_calibration (org_id+band_id unique; one row per reliability band)
- **Schema init**: `setImmediate(() => ensureTIGSchema(pool).catch(...))` at end of registerEmployerTIGRoutes — NOT inside requireAuth (same pattern as CGI).
- **Graph builder** (`buildTIGForOrg`): fire-and-forget via `setImmediate`; writes a `tig_build_log` row (`running` → `complete`/`error`); poll `/api/employer/tig/stats` for progress.
- **Org scoping**: `(req as any).orgId ?? (req.user as any)?.id ?? ''` — employer gate middleware sets orgId on all `/api/employer/*` routes.
- **LBI enrichment**: join via `users.username = email` (never throws if absent — `catch(() => ({ rows: [] }))`).

## 8 Engines (pure, deterministic)
1. `computeReadinessIndex` — match×0.35 + ei×0.30 + assessment×0.25 + exp×0.10
2. `computeGrowthPotential` — assessment×0.40 + ei×0.30 + lbi×0.20 + headroom×0.10
3. `computeHiddenTalentScore` — readiness>65 AND stage in {Applied/Screened/Screening}
4. `computeSuccessProbability` — (matchScore/100) × (skills_matched/role_skill_count) → RAW directional estimate
5. `computeSimilarity` — cosine over [match,ei,assessment,exp/20] vectors; sim≥80 → similar_to edge
6. `computeMobilityTargets` — roles where CALIBRATED success_prob ≥ 0.50 (takes optional calibration arg; returns probability + calibratedProbability)
7. `assignCluster` — readiness≥75→High Impact / ≥50→Growth Ready / else→Emerging Talent
8. `buildCalibrationModel(realized, priorByBand?)` / `calibrateProbability` — empirical reliability-binning (5 bands 0–1) with Beta–Binomial m-estimate smoothing (CALIB_ALPHA=5); learns from REALIZED hire outcomes only. Status machine drives the mapping: cold_start→identity, provisional→α-smoothed band rate, calibrated→isotonic.

## Calibration engine (Engine 8) — the structural-vs-activation distinction
- **Realized outcomes** = candidates whose stage is `Hired`(1) or `Rejected`(0), joined to their job. `predicted` = the **decision-time snapshot** `predicted_prob_at_decision ?? recompute` (E1, below). Built in `buildTIGForOrg` after LBI enrichment, persisted to `tig_calibration` (idempotent ON CONFLICT per org+band).
- **Cold start is the identity map**: zero realized outcomes → `status='cold_start'`, `calibrateProbability` returns `raw === calibrated` (directional & honest, never fabricated). Empty band also → identity.
- **fits_role edges** weight on the CALIBRATED probability (≥0.5 threshold); mobility/intel surface calibrated when present, raw otherwise.

## Calibration enhancements (5, approved order E1→E2→E4→E5→E3)
- **E1 — decision-time snapshot (kills label drift):** `employer_candidates.predicted_prob_at_decision FLOAT` + `decision_at TIMESTAMPTZ`. Stamped ONCE in `PUT /candidates/:id` the first time stage→Hired/Rejected AND col NULL AND job_id present, fire-and-forget (snapshot failure must NEVER fail the candidate update). The builder trains on this frozen value, not a later recompute over drifted skills/role data. The UPDATE re-guards `predicted_prob_at_decision IS NULL` so it's write-once even under races. `parseSkills` + `computeSuccessProbability` are exported from `employer-tig.ts` and imported by `employer-portal.ts` (both pure → no circular-import risk).
- **E2 — Brier + ECE on RAW predictions:** per band track `predictedSum→meanPredicted`. `brier = mean((raw−outcome)²)`, `ECE = Σ(n_b/N)|observed_b − meanPredicted_b|`. Measured on RAW (uncalibrated) predictions — NEVER on the in-sample calibrated values (that would be circular self-congratulation). `null` at cold_start.
- **E4 — isotonic (PAV) smoother:** `fitIsotonic` (pool-adjacent-violators over raw pairs, guarantees monotone non-decreasing) + `isotonicAt` (linear interpolation between breakpoints, clamps at ends, identity on empty). Applied ONLY when `status==='calibrated'` (overwrites `band.calibratedRate = isotonicAt(meanPredicted)`); provisional keeps binned rate; cold_start identity. `method ∈ {identity,binned,isotonic}`. NOT persisted as a curve — recomputed in-memory per build; only the per-band calibratedRate/method land in `tig_calibration`.
- **E5 — borrowed global prior (thin-org help):** `buildGlobalCalibrationPrior(pool)` aggregates per-band observed rate across ALL orgs, exposed ONLY where global band `n≥30 AND ≥2 distinct contributing orgs` (k-anonymity). Used as the m-estimate prior (replacing each band's midpoint) for **PROVISIONAL orgs only**. `prior_source ∈ {global_pooled, uninformative}` per band. CRITICAL: TRUST `status` still gates on the org's OWN `totalOutcomes` — a borrowed prior NEVER upgrades cold_start/provisional→calibrated, and calibrated orgs ignore it (isotonic overrides). buildTIGForOrg only passes priorByBand when the org is provisional.
- **E3 — reliability diagram (frontend):** `TalentIntelligenceGraphPanel` SVG scatter (x=meanPredicted, y=observedRate, dot area ∝ sampleSize, dashed perfect-calibration diagonal), shown when status≠cold_start AND ≥1 band has data; renders Brier/ECE/method + a global-prior borrow note.

**Why E1/E2 honesty:** E1 removes circularity from the *label* (train on what you predicted at decision time, not a recompute). E2's RAW-only rule keeps the metric from grading the calibrator on its own fitted output. E5 helps sparse orgs WITHOUT letting them claim a validated status they haven't earned (Structural vs Activation stays separate).

## Readiness: structural 100%, calibration is a separate ACTIVATION axis
- 20/20 STRUCTURAL_CHECKS pass — `engine_success_calib` is `pass:true` because the engine EXISTS and is wired. Calibration *quality* is a data-bound activation concern, NOT a structural gap.
- **Three-state TRUST label, gated at k_min=30** (`CALIB_MIN_OUTCOMES`): `cold_start` (0 outcomes) → `provisional` (1–29) → `calibrated` (≥30). The label is a TRUST signal, not "any data" — below k_min the α-smoothed curve is mostly prior, so it must NOT claim "calibrated". This mirrors the platform's k_min=30 benchmark suppression / Fitment "Provisional when n<30" precedent. A single outcome flipping to a green "Calibrated" badge is the over-claim trap — don't.
- `calibrateProbability` still APPLIES during `provisional` (best available estimate; smoothing keeps sparse bands near prior) — applying ≠ claiming validated.
- `/readiness` returns `gap:null` only when `calibrated`; provisional → "N/30 … PROVISIONAL until ≥30"; cold_start → awaiting-outcomes msg. Plus `calibration{status,totalOutcomes,bands}`. UI badge: green Calibrated / blue Provisional N/30 / amber cold start.

**Why:** the old 98%/"engine_success_calib fails" framing conflated a directional formula with a missing engine. The engine is structurally complete; what's pending is realized hire data — that belongs on the Activation axis, reported separately (platform convention: Structural vs Activation never composited; honesty over optimism; never claim empirical calibration without realized outcomes).

## How to apply
- Adding a new intelligence engine: add it to STRUCTURAL_CHECKS with `pass: true` (if formula is deterministic) or `pass: false` (if needs external data).
- Building additional graph entity types: `upsertNode` is an async helper inside `buildTIGForOrg` — reuse it, don't insert directly.
- On-demand fallback: `/candidate/:id` computes readiness/growth/hidden on-the-fly if no snapshot exists (safe for cold-start).
