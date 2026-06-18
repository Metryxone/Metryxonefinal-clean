# CAPADEX WC-7A — Activation Intelligence & Growth Ecosystem Audit

**Phase type:** DESIGN + AUDIT ONLY. No implementation · no schema · no migrations · no code.
**STOP for approval.**

WC-7A audits the **activation surface** of the platform — the layers that turn already-derived
intelligence into a personalized, sustained, monetizable user journey — and answers one question:

> **What is the SMALLEST set of improvements required to move all remaining activation layers to
> 90%+ maturity?**

It scores nine focus areas, grounds every maturity score in real-vs-stub evidence (never
fabricated), and rolls them into a unified **Activation Intelligence Score (AIS 2.0)**.

---

## The nine focus areas

| # | Layer | What it governs |
|---|-------|-----------------|
| 1 | **Personalization Intelligence** | tailoring the experience to persona / segment / context |
| 2 | **Longitudinal Intelligence** | tracking a user across sessions over time |
| 3 | **Decision Intelligence** | turning intelligence into a first-class decision (the conductor) |
| 4 | **Product Activation** | routing a decision into a real product entry |
| 5 | **Growth Plan Activation** | seeding a real growth plan from the decision |
| 6 | **Mentor Activation** | matching + booking a mentor from the decision |
| 7 | **Subscription Intelligence** | mapping a decision to a package + enforcing entitlement |
| 8 | **Future Readiness Intelligence** | B2B / institutional / expansion readiness |
| 9 | **AIS 2.0** | the unified activation-maturity score across layers 1–8 |

---

## How this was grounded (no assumptions)

- **Layers 1–2 (Personalization, Longitudinal):** two fresh code-exploration passes over the
  live source (persona picker, proxy-language engine, adaptive pipeline, L5A/L5B intelligence,
  OMEGA longitudinal-memory, behavioural-memory backend, progress ledger / attribution, CSI
  trajectory, behaviour-graph aggregator, in-memory career-memory).
- **Layers 3–8 (Decision, Product, Growth, Mentor, Subscription, Future Readiness):** reuse of
  the approved/merged grounding from **WC-5, WC-6, DC-1, DC-2** (orchestration reachability,
  decision catalog, real-vs-stub product/subscription matrices). WC-6's corrections to WC-5
  (mentoring REAL, M5 REAL, subscription schema simpler) are carried forward as fact.
- **Layer 9 (AIS):** lineage from **WC-2** (`WC2_AIS_TRUST_DELTA.md`).

---

## ⚠️ Naming honesty — two different "AIS"

| Term | Source | Meaning | Unit |
|------|--------|---------|------|
| **AIS (1.0)** | WC-2 | *Assessment* Intelligence Score — credential/verification-bounded report-authority metric (baseline ~60, realistic band 78–85) | per-session report metric |
| **AIS 2.0** | WC-7A (this phase) | *Activation* Intelligence Score — maturity composite across the 8 activation layers | system maturity %, 0–100 |

**These are different units and must not be compared.** AIS 2.0 measures how mature the
activation *machinery* is; AIS 1.0 measures how trustworthy a single report is. WC-7A never
re-uses an AIS-1.0 number as an AIS-2.0 input.

---

## Scoring methodology (grounded)

Each layer's maturity % is an **evidence-weighted blend** of its constituent mechanisms, each
banded by its verified real-vs-stub status:

| Mechanism status | Band |
|------------------|------|
| REAL **and consumed at runtime** | 85–100 |
| REAL but **not consumed / not orchestrated** (built, idle) | 60–80 |
| PARTIAL | 40–65 |
| STUB (logic exists, not wired / lost on restart) | 15–40 |
| ABSENT | 0–15 |

- **Maturity scores are grounded** in the real-vs-stub inventory (layer audit shows the evidence
  per mechanism).
- **All projection / lift / post-improvement numbers are DIRECTIONAL DESIGN ESTIMATES** — there
  is no activation telemetry yet (no decision object ships today), so no figure here is measured.
  Flagged consistently, per the DC-2 cardinal rule.
- **Cardinal rule (carried from DC-1/DC-2):** never fabricate. A stub is scored as a stub; an
  idle-but-real engine is scored as "built, not consumed," not as fully mature.

---

## Executive Summary

**Current AIS 2.0 ≈ 61 / 100** (grounded composite, equal-weighted across 8 layers).

**Headline verdict — the intelligence is mature; the *activation* of it is not, and the gap
splits cleanly into "small shared wiring" vs "two irreducible large builds."**

The platform has spent its maturity on **producing** intelligence (signals, patterns, OMEGA
longitudinal memory, stage/context derivation, M5 growth plans, mentor matching) — most of these
engines are REAL. What is thin is **activation**: nothing takes one decision and deterministically
fans it out to product + plan + mentor + subscription, several mature engines are **built but
idle** (derived data never consumed at runtime), and the commercial loop (decision→package +
entitlement) is the weakest link.

**The smallest path to 90% has three honest tiers:**

- **Tier A — small, shared, high-leverage (≈6 moves).** Stand up the read-only **Decision
  Orchestrator** (the conductor), wire the **Journey→M5 bridge**, upgrade **mentor-match from the
  decision**, and — critically — **consume already-derived intelligence that is sitting idle**
  (L5B context / L5A stage in runtime selection; behaviour-adapter "drivers" in the growth-plan
  UI; auto snapshot-on-completion; re-assessment scheduler; longitudinal-detection→intervention).
  These lift Personalization, Longitudinal, Decision, Growth Plan, and Mentor toward 86–90.
  → **AIS 2.0 ≈ 76.**
- **Tier B — one medium commercial loop.** Decision→subscription mapping + backend entitlement
  enforcement + subscription-schema reconciliation. Lifts Subscription 45→85, closes the DC-2
  revenue tension. → **AIS 2.0 ≈ 83.**
- **Tier C — two irreducible large builds (no small move reaches 90% here).** Complete the
  **Employability Index + Competitive-Exam products** (Product Activation) and build the
  **institutional B2B data layer** (Future Readiness: `institution_id`/`max_students`/admin
  persona/cohort). → **AIS 2.0 = 90+.**

**The single most important honest finding:** **six of eight layers can reach 90% WITHOUT a large
build** — they are *eligible* via Tier A/B small-to-medium wiring plus minor polish — **while two
(Product Activation, Future Readiness) cannot: they have a hard floor that only large
product-completion and B2B builds (Tier C) can lift.** To be precise: only two layers actually
*hit* 90% by the end of Tier A+B; the other four sit at 85–88 and need only small polish — **none
of the six needs a large build, and only Layers 4 and 8 depend on the Tier-C builds** (see the
eligibility table in `WC7A_AIS.md`). Any plan claiming a route to 90% across *all eight* layers
without Tier C would be fabricating readiness for those two. The "smallest set" is therefore
*small where it can be, and honestly large where it must be.*

---

## Deliverables (this folder)

| # | Output | File |
|---|--------|------|
| — | Executive summary + AIS 2.0 methodology + index | this file |
| 1 | Per-layer maturity audit (layers 1–8): current % · evidence · gap-to-90 · smallest set | `WC7A_LAYER_AUDIT.md` |
| 2 | AIS 2.0 framework: definition · per-layer scores+weights · composite · current→target trajectory | `WC7A_AIS.md` |
| 3 | The consolidated **smallest set** of improvements to 90%+ (Tier A/B/C, what each unblocks) | `WC7A_MINIMAL_SET.md` |

**Scope reminder:** audit/design only. No code/schema/migrations changed. Everything proposed is
for a future approved build phase, to be built with WC-3/WC-6 discipline (additive · compose-only
· flag-gated default OFF · byte-identical when OFF · honest `ready:false` over fabricated
activation).
