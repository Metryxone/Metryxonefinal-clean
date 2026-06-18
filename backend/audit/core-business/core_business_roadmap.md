# MetryxOne — Core Business Roadmap to World-Class
### MX-CORE-BUSINESS-AUDIT-01 · 18 June 2026

This roadmap is ordered by **impact on whether a customer would choose MetryxOne**, not by engineering convenience. The platform's constraint is **evidence and activation, not architecture** — so the roadmap front-loads proof and data density over new features.

---

## The one keystone

> **Close a single score → real-outcome → validated-claim loop on ONE product.**

Realized outcomes are **0 across every product**. No amount of new UI, taxonomy, or engine work changes the fundamental buyer objection ("does this score mean anything?") until at least one product can answer *yes, with evidence*. Everything below is sequenced around making that true.

**Recommended product for the first loop: Career Builder** — it has real adoption (101 profiles/goals), a measurable outcome (a career move / goal completion / EI lift), and the strongest UX to sustain a cohort. Employability Index is the second candidate (clear outcome = hire/promotion) but has 0 computed scores to start from.

---

## Phase 0 — Stop the credibility bleeds (immediate, low effort, high trust)
*These are not features; they are honesty/safety fixes that prevent a customer from losing trust on contact.*

1. **LBI: remove the AI-generated score.** A prompt that outputs "overallScore between 60–95" is a credibility and compliance liability. Replace with the real (even if simple) derivation, or clearly mark LBI as preview.
2. **LBI: re-verify and close the admin endpoints flagged unauthenticated in prior audits** (security — confirm current state before remediation).
3. **EI: resolve the name/claim tension** — one consistent, legally-safe framing across UX ("Hire-Ready") and audit ("developmental-only").
4. **Retire or populate dead "ontology" surfaces** that read as real but are empty (`ont_career_paths`, empty competency ontology) so demos don't expose hollow screens.

## Phase 1 — Activate what's already built (convert capability → delivered value)
*Highest ROI: the engines exist; the data/output doesn't reach customers.*

1. **EI: compute and persist scores** for the existing user base (`mei_scores = 0` today). The formula is done; nobody has a score.
2. **Career Builder: get recommendations to the 101 profiled users** (only 8 recs / 6 gaps exist) — a pure activation failure of a working engine.
3. **CAPADEX: fix the inert composite/pattern layer** (`capadex_session_patterns = 0`) so the "deeper intelligence" actually fires.
4. **Competency: populate the ontology** so the well-built engine has content to score against.

## Phase 2 — Build evidence (the keystone work)
1. **Stand up an outcome feedback loop** (capture real hires/promotions/goal-completions/exam results) — start on Career Builder, extend to EI.
2. **Run the first validation study** on CAPADEX or Competency constructs (reliability α, test–retest, factor structure).
3. **Reach k≥30 cohorts** for top role families / segments so Competency and Career benchmarks leave "Provisional."
4. **Turn on calibration** (Brier/ECE) for EI once ≥30 qualifying decisions exist.

## Phase 3 — Content depth (remove the "walled garden" / "empty dashboard")
1. **Import O*NET/ESCO** into the career graph (200 → thousands of roles; enables real pathways).
2. **Expand CAPADEX item banks** and build a genuine **age-banded student bank**.
3. **Populate LBI norms/clusters** and ingest real behavioural signals (time-on-task, retries) instead of MCQ self-report.
4. **Grow intervention libraries** so IDPs/recommendations stop hitting generic fallbacks.

## Phase 4 — Differentiate & harden
1. **Multi-step career trajectories** (not 1-step adjacencies); validated transition probabilities.
2. **Longitudinal change reporting** across CAPADEX/Competency/EI (show movement over time).
3. **Employer-safe value surfaces** that deliver within the language policy.
4. **Decompose the Career Builder monolith** (~8k LOC) for maintainability at scale.

---

## Per-product priority (top 3 each)

| Product | #1 | #2 | #3 |
|---|---|---|---|
| **Career Builder** | Get recs to the 101 profiled users | Import O*NET/ESCO | First outcome loop (career move / goal completion) |
| **Competency** | Populate the ontology | Reach k≥30 cohorts | Validate reliability against re-test data |
| **CAPADEX** | Run a psychometric validity study | Age-banded student item bank | Fire the composite/pattern layer |
| **Employability** | Outcome feedback loop | Compute & persist scores | Calibrate on ≥30 real decisions |
| **LBI** | Replace AI-generated scoring | Verify/close flagged admin auth gap | Populate norms + ingest real signals |

---

## Sequencing logic
- **Phase 0 + 1 are weeks, not quarters** — they're activation and hygiene on existing code, and they immediately lift the **Activation (27)** axis, the cheapest score gain.
- **Phase 2 is the strategic investment** — it lifts the **Validity (20)** floor, which is the only lever that changes the *employer/institution* purchase decision and therefore the addressable market.
- **Phase 3–4 widen the moat** once the product can prove value — doing them before Phase 2 just makes a larger unvalidated product.

## Definition of "world-class" for MetryxOne
A product crosses ~75/100 when: its content is populated and broad, real customers use it at volume, **and at least one published, validated claim links its score to a real outcome.** On today's evidence the nearest product to that line is **Career Builder**; the fastest portfolio-level gain is lifting the shared **Validity floor** via a single closed outcome loop.
