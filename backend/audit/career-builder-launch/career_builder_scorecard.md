# Career Builder — Scorecard

**Date:** 2026-06-18
**Scoring rule (honesty contract):** every axis is scored on **three independent dimensions** — Structural (S, code exists) / Activation (A, real data in live DB) / Validity (V, empirically validated). **These are NEVER averaged into one number.** Bands below are applied to each dimension separately, and the overall verdict is *gated by the weakest critical dimension* (Section C), not composited.

Dimension band thresholds (per dimension): **World Class ≥85 · Launch ≥70 · Pilot ≥55 · Beta ≥40 · Not Ready <40.**

---

## A. Customer-value axes (the only axes that count toward launch)

| # | Axis | S | A | V | Evidence |
|---|---|---|---|---|---|
| 1 | Competency intelligence quality | 80 | 18 | 10 | Engines real; `competency_question_templates`=0 live; falls back to static bank; unvalidated |
| 2 | Scientific rigor | 45 | 12 | 8 | Deterministic, explainable; no construct/criterion validity; `career_outcomes`=0 |
| 3 | Assessment quality | 72 | 15 | 10 | Adaptive runtime real; live item bank empty; no calibration evidence |
| 4 | Recommendation quality | 78 | 14 | 10 | unifiedActionEngine real + library-backed; `career_recommendations`=0, `mei_user_recommendations`=0 |
| 5 | Career value (trajectory/pathways) | 80 | 30 | 12 | cg_* reference seeded (200 roles/711 reqs); `cg_user_recommendations`=8/101 |
| 6 | Employability value (EI) | 75 | 12 | 8 | MEI v2 engine + 93 insight rules; **`mei_scores`=0**; EI gauge≠breakdown defect |
| 7 | Employer value | 60 | 8 | 8 | Fitment/visibility engines real; `recruiter_interactions`=0; fitment uncalibrated |
| 8 | Institution value | 70 | 20 | 10 | Cohort/workforce views real; `workforce_signals`=0; concierge-only |
| 9 | Commercial value | 70 | 18 | — | Entitlement engine + comm_* spine real; near-zero live sales/grants |
| 10 | Operational readiness | 55 | 18 | — | Fail-closed gates good; **no snapshot scheduler**; manual super-admin grants |
| 11 | Launch readiness (gated verdict from the separate axes — NOT composited) | — | — | — | **Beta (self-serve) · Pilot (concierge)** (see Section C) |

**Axis means (reported separately, NOT a product score):**
- Structural mean (axes 1–10): **~69**
- Activation mean (axes 1–10): **~16**
- Validity mean (axes 1–8): **~10**

---

## B. Foundational-layer readiness (Career Builder as intelligence source for other products)

| Downstream consumer | Structural feed exists? | Live feed active? |
|---|---|---|
| Employability Index | Yes (MEI chain) | **No** — `mei_scores`=0 |
| Career Passport | Yes (passport route + snapshot) | Partial — snapshot on demand, contact scrubbed |
| Future Readiness Platform | Yes (frp_* reference 1,680/27) | Thin — `frp_user_readiness`=8 |
| Employer Portal | Yes (fitment/visibility) | **No** — `recruiter_interactions`=0 |
| Recommendation Engine | Yes (unifiedActionEngine) | **No** — `career_recommendations`=0 |
| Learning Behavior Intelligence | Yes (api/lbi) | Thin |

**Foundational readiness:** Structural ~78 · Activation ~14. Structurally a foundation; operationally not yet feeding live intelligence.

---

## C. Overall verdict (derived by an explicit gating policy — NOT composited)

The three dimension means are **not** averaged into a product score. The product verdict is derived by an **explicit, stated gating policy** applied to the separate axes (so the rule and the result are self-consistent — this is not a naive min-of-bands):

- **Self-serve Launch / World Class** require **ALL** of Structural, Activation, Validity to reach that band. Activation (~16) and Validity (~10) sit in the **Not Ready** band, so self-serve Launch and World Class are **blocked outright**.
- **Concierge Pilot** requires **Structural ≥ Pilot (55)** AND a viable path to manually activate data for a managed cohort. Structural ~69 qualifies → **Pilot Ready (concierge only)**.
- **Beta (product floor)** requires only that the software exists and runs end-to-end (Structural ≥ Beta 40). Structural ~69 clears this comfortably → the product is **at least Beta** (demonstrable and usable in controlled settings).

So the weakest axis **caps the self-serve ceiling** (no self-serve Launch) but does **not** drag the product below Beta, because the software genuinely runs and a concierge cohort can use it today. A naive "min of dimension bands" would read *Not Ready* — which is **less** honest than the evidence supports: the product is built, runs, degrades gracefully, and is demonstrable. The honesty contract forbids inflation in *both* directions.

> **Gated verdict: BETA READY overall (self-serve) · PILOT READY for a concierge Institution/Student cohort.** Self-serve Launch and World Class are blocked by Activation and Validity, not by Structural.

**Do not** report a single blended number for this product. The honest representation is the triple **(S ~69 / A ~16 / V ~10)** plus the gated verdict above.
