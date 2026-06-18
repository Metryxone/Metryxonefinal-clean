# Career Builder — Founder Decision Brief

**Date:** 2026-06-18
**One-line truth:** Career Builder is **engine-complete and reference-seeded, but user-runtime-empty and unvalidated** — the code is largely there; the live intelligence and the proof are not.

---

## Verdict (three axes, never composited)

| Axis | Score | Meaning |
|---|---|---|
| **Structural** | **~69** (axes mean; surface ~82) | The capability exists as real, degradation-safe code (~25 tabs, ~30 engines, Career OS, passport, resume, jobs/fitment). |
| **Activation** | **~16** | The live system has computed almost no per-user intelligence: `mei_scores`=0, question bank=0, `career_recommendations`=0, `career_outcomes`=0. |
| **Validity** | **~10** | Nothing is empirically validated; the headline EI shows two different numbers across surfaces. |

> **Gated verdict: BETA READY overall · PILOT READY for a concierge Institution/Student cohort · NOT LAUNCH READY self-serve · NOT READY for Employer/Enterprise · NOT WORLD CLASS.**

---

## The five decisions you must make

1. **Fix the EI number first (days).** The gauge and breakdown disagree — this single defect undermines trust in everything else. Non-negotiable before any launch.
2. **Activate intelligence on the 101 existing profiles (1–2 weeks).** Compute + persist EI, recommendations, Career-Graph/FRP outputs, and add a snapshot scheduler. This is the single highest-leverage move — it lifts Activation from ~16 toward ~55 with *no new features*.
3. **Choose the launch shape.** Honest options:
   - **(a) Concierge Institution pilot now** — viable today with manual data activation + human interpretation.
   - **(b) Self-serve consumer launch** — needs Stage 1–2 (activation + server-side resume + onboarding + priced SKU) first.
   - Do **not** launch Employer/Enterprise — those surfaces are inert (`recruiter_interactions`=0).
4. **Decide the monetization unit.** Career Builder tabs are mostly free today; paid value sits on CAPADEX reports + manual grants. Either price a Career Builder SKU or explicitly bundle it — current state has no scalable self-serve revenue path.
5. **Commit to a validity program (ongoing).** Capture real outcomes, calibrate fitment/hire-probability, run fairness tests. Without this, Career Builder cannot claim to be a trustworthy instrument or an enterprise product.

---

## Critical blockers (must clear before self-serve launch)

- `mei_scores`=0 — headline metric not running at scale **[Activation]**
- EI gauge ≠ breakdown — inconsistent employability number **[Validity]**
- Competency question bank empty live **[Activation]**
- Zero realised outcomes + zero stored recommendations **[Activation/Validity]**
- No snapshot scheduler → no longitudinal history **[Activation/Operational]**
- Resume persists to localStorage only **[Activation]**

---

## What is genuinely strong (don't rebuild)

- The Career Operating System and ~30 engines are real and degrade honestly (never hollow states).
- Reference data is seeded (Career Graph 200 roles/711 reqs; FRP 1,680 role-evolution rows; MEI 93 insight rules).
- Security (IDOR guard) and commerce enforcement (fail-closed entitlements) are sound.
- Employability Passport correctly scrubs contact PII before publishing.

---

## Bottom line

The distance to Launch is **~70% Activation** (run and persist the intelligence the engines already produce, for users who already exist) and **~30% Validity** (reconcile the EI number, capture outcomes, validate). Very little is Structural. A concierge pilot is appropriate **now**; self-serve launch is a **2–4 week activation effort plus an ongoing validity program** away — not a rebuild.

*Per standing instruction: nothing has been deployed or merged. This brief is for your decision.*
