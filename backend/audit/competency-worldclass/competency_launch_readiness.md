# Competency Assessment — Launch Readiness by Product Configuration

**Audit:** MX-COMPETENCY-WORLDCLASS-LAUNCH-CERTIFICATION-100X · 18 Jun 2026
**Levels:** Not Ready / Beta Ready / Pilot Ready / Launch Ready / World Class.
**Rule:** readiness is bounded by Activation + Validity, not by Structural design.

---

## 1. Standalone Product — **Beta Ready**

- ✔ Works end-to-end: assessment → scored report (engine runs on 58 live sessions).
- ✔ Explainable scoring, behavioural anchors (SJT bank), reliability index.
- ✖ Static bank only (DB bank empty); no norms; benchmarks suppressed; no validity evidence.
- **Gate to Pilot:** populate + calibrate a governed item bank; produce a methodology note; reach k=30 for at least one cohort.

## 2. Student Product — **Beta Ready**

- ✔ Strongest content fit (LBI/SDI designed for students; CAPADEX concern banks rich).
- ✔ Report quality good; development plan path exists.
- ✖ LBI hierarchy dormant live (`lbi_clusters=0`); recommendations sparse; benchmarks empty; no placement-outcome proof.
- **Gate to Pilot:** activate LBI/SDI taxonomy live; populate student cohort to k=30; wire recommendations to live data.

## 3. Professional Product — **Beta Ready**

- ✔ Modern competency ontology + mobility engine + career recommendations are professional-grade by design.
- ✖ Only 5 roles weighted live; O*NET not imported; EI dark; no return-repeatedly evidence; no benchmarks.
- **Gate to Pilot:** import O*NET (roles/links), activate EI, populate professional benchmark cohort.

## 4. Institution Product — **Pilot Ready** ✅ (concierge)

- ✔ Batch assessment, faculty usage, placement-readiness, program-outcome structures exist.
- ✔ Institution onboarding is concierge-feasible today; admin monitoring strong.
- ✖ Program-outcome analytics unpopulated; placement-readiness unvalidated; self-signup limited.
- **Why Pilot:** an institution can run a real cohort under guided onboarding and get genuine, explainable per-student reports. **This is the recommended first go-to-market.**
- **Conditions:** (1) activate taxonomy + bank live for the pilot cohort; (2) set expectations that benchmarks/norms are "building"; (3) capture outcomes to start the validity flywheel.

## 5. Employer Product — **Pilot Ready (gated)** ✅

- ✔ Employer Portal + TIG is the most mature consumer; success-probability engine; audit trails; self-register.
- ✔ **Correctly disallows AI hiring/promotion verdicts** (honest, compliance-safe).
- ✖ Candidate competency activation thin; talent-pool benchmarks below k; no validated hiring prediction.
- **Why Pilot (gated):** sell *talent intelligence / structured behavioural insight*, **not** "who to hire." Renewal hinges on accruing outcome evidence.

## 6. Enterprise Product — **Not Ready**

- ✖ No validity evidence, no norms, no SOC2/ISO/DPA, dev/prod shared DB, CSP off, no SLA, no scale hardening, no industry packs.
- **Gate:** the entire Critical + most of the Medium severity list in `competency_gap_analysis.md`.

---

## Foundational-Layer Launch Readiness (can competency power the platform today?)

| Dependent | Readiness | Blocking condition |
|---|---|---|
| Career Builder | **Beta** | thin competency activation → generic recs |
| Employability Index | **Not Ready** | `mei_scores=0` — not activated live |
| Career Passport | **Beta** | sparse competency snapshots |
| Future Readiness Platform | **Beta** | stub/secondary consumption |
| Employer Portal | **Pilot (gated)** | talent intel only; no hiring prediction |
| Recommendation Engine | **Beta** | engines strong, population near-zero |

---

## Overall Launch Recommendation

**Lead with an Institution concierge pilot + a gated Employer talent-intelligence pilot.** Both are credible on structural strength and honest framing today. Use the pilots to manufacture the two missing ingredients — **populated live data** and **realised outcomes** — which are the only path to lifting Validity and reaching Launch/World-Class. Do **not** launch as a standalone commercial or enterprise product, and do **not** publish predictive/hiring claims, until validity evidence exists.
