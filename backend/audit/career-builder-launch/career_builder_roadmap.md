# Career Builder — Roadmap to Launch / World Class

**Date:** 2026-06-18
**Principle:** the gap is **Activation + Validity**, not Structural. The roadmap is sequenced so each stage lifts a *specific honest axis* with cited evidence, never a blended score. Estimates are effort bands (prose only), not promises.

---

## Stage 0 — Fix the trust defect (days) → lifts **Validity**
- **Reconcile the EI number.** Make `EIGauge` (6-dim) and the EI breakdown modal agree on one employability figure with one documented formula. *Until this is fixed, every other number is suspect.*
- Document the single EI formula authority (already noted in memory: `employabilityEngine.ts` is the gauge driver).
- **Exit criterion:** one EI value per user across all surfaces; no second number.

## Stage 1 — Activate the intelligence on existing users (1–2 weeks) → lifts **Activation**
- Compute and **persist** EI for all 101 `career_seeker_profiles` → `mei_scores` / `mei_competency_scores` > 0.
- Seed the **live competency question bank** (`competency_question_templates`) so assessment stops relying on the static fallback.
- Persist recommendations (`career_recommendations`, `mei_user_recommendations`) and per-user Career Graph / FRP outputs (`cg_user_recommendations`, `frp_user_readiness`) for the full base.
- **Add a nightly scheduler** to compute EI snapshots → `mei_score_history` accrues (unlocks longitudinal/trend tabs).
- **Exit criterion:** ≥90% of active profiles have a live EI score + ≥1 persisted recommendation; history table growing daily.

## Stage 2 — Make it self-serve (2–4 weeks) → lifts **Activation + Operational**
- Server-side resume store (replace localStorage-only) so resumes feed intelligence and persist cross-device.
- Wire real labour-market + learning feeds (or clearly label catalogs as curated) for `market-intel`/`learning`.
- Self-serve onboarding so a user can go profile → assessment → EI → plan without concierge help.
- Define a **priced Career Builder SKU** (or explicitly bundle into CAPADEX tiers) and remove dependence on manual super-admin grants.
- **Exit criterion:** an unguided user completes the full loop and is correctly entitled.

## Stage 3 — Earn validity (1–3 months, ongoing) → lifts **Validity**
- Capture **real career outcomes** (`career_outcomes`) — placements/promotions/role moves — via a feedback loop.
- Calibrate fitment + hire-probability against those outcomes; publish reliability evidence.
- Run bias / adverse-impact / fairness testing on scoring paths.
- Populate benchmarks once enough scores exist (respect k=30 floor).
- **Exit criterion:** at least one validated score with an outcome correlation + documented fairness check.

## Stage 4 — Employer / Enterprise (after Stage 1–3) → unlocks gated configs
- Activate employer surfaces (recruiter postings, `recruiter_interactions`, `workforce_signals`).
- Calibrated candidate fitment + talent-pool benchmarking.
- Scheduled snapshots, audit/calibration dashboards, SLA/support runbook.

---

## Honest target states

| Milestone | Structural | Activation | Validity | Verdict |
|---|---|---|---|---|
| Today | ~69 | ~16 | ~10 | Beta (Pilot concierge) |
| After Stage 0–1 | ~72 | ~55 | ~25 | **Pilot → Launch (single-config)** |
| After Stage 2 | ~78 | ~70 | ~30 | **Launch Ready (consumer/student)** |
| After Stage 3 | ~80 | ~75 | ~60 | Trustworthy instrument; approaching World Class |
| After Stage 4 | ~85 | ~80 | ~65 | Employer/Enterprise viable |

Numbers stay **per-axis** — do not composite. World Class requires *all three* axes ≥85 *and* outcome-validated intelligence, which is a multi-quarter effort gated by real user volume, not engineering.
