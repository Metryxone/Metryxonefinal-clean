# CAPADEX DC-2 — Decision Prioritization Audit

**Phase type:** DESIGN + AUDIT only. No implementation, no schema changes, no migrations, no
code. **STOP for approval.**

DC-2 prioritizes every decision identified in **DC-1** and determines which to activate first
to maximize User Impact · Business Impact · Revenue Impact · Future Readiness · Product
Utilization · Subscription Conversion. It scores all 50 decisions on **10 dimensions**,
classifies them into **3 activation tiers**, overlays **future readiness**, and produces an
**activation roadmap**.

Builds on: AQ-1/AQ-2, WC-1…WC-6, L5A Stage Intelligence, L5B Context Intelligence, **DC-1
Decision Catalog**. Inputs reused: DC-1 Top 50, Decision Taxonomy (D1–D7), and the four
DC-1 matrices (Product/GrowthPlan/Mentor/Subscription).

---

## Cardinal honesty rule (how scores are grounded)

DC-2 separates **grounded** scores from **estimated** scores, and labels which is which:

- **Readiness scores (Technical/Product/GrowthPlan/Mentor/Subscription) are GROUNDED** — they
  are a direct, deterministic mapping of DC-1's real-vs-stub status of each surface
  (verified in code during DC-1). Mapping: **R→5 · gated-R→4 · P→3 · S→2 · ✗/missing→1**.
- **Impact scores (User/Business/Revenue/Future) and Strategic Importance are DESIGN
  ESTIMATES** — defensible product judgments, NOT measured analytics. They are 1–5 ordinal
  and explicitly flagged as estimates wherever a number drives a recommendation.
- **DIS / activation-lift / subscription-lift figures in the Roadmap are DIRECTIONAL design
  estimates**, not forecasts from telemetry. CAPADEX has no decision-conversion analytics yet
  (there is no decision object), so any precise % would be fabrication. Ranges are given as
  planning hypotheses to be validated post-activation.

No surface is claimed real unless DC-1 already grounded it in code. A stub stays a stub.

---

## Scoring framework (10 dimensions, 1–5)

| # | Score | Type | Anchor |
|---|-------|------|--------|
| 1 | User Impact (UI) | estimate | depth of user value if the decision fires correctly |
| 2 | Business Impact (BI) | estimate | platform/B2B value, stickiness, trust |
| 3 | Revenue Impact (RI) | estimate | direct monetization potential |
| 4 | Future Relevance (FR) | estimate | AI-era / future-workforce durability |
| 5 | Technical Readiness (TR) | **grounded** | how much *new logic* beyond existing engines |
| 6 | Product Readiness (PR) | **grounded** | DC-1 product status of the activated surface |
| 7 | Growth-Plan Readiness (GR) | **grounded** | M5 reachability (R but journey→M5 bridge gap) |
| 8 | Mentor Readiness (MR) | **grounded** | mentor surface status (R, cross-server seam) |
| 9 | Subscription Readiness (SR) | **grounded** | package-mapping status (✗ — no mapping) |
| 10 | CAPADEX Strategic Importance (SI) | estimate | how central to the decision-intelligence thesis |

**Composites:**
- **Impact** = mean(UI, BI, RI, FR).
- **Readiness** = mean of the *applicable* readiness dims (TR always; PR/GR/MR/SR only when the
  decision activates that surface; non-applicable shown `–`).
- **Priority Index** = Impact × Readiness (range 1–25). Multiplicative on purpose: "activate
  first" favors decisions that are **both** high-value **and** buildable now (quick wins),
  not high-value-but-impossible. Crisis/safety decisions (D7) are force-elevated regardless of
  index — safety overrides scoring.

## Tier classification (per spec — by asset requirement, NOT by score)
- **Tier 1** — can activate **immediately using existing assets** (all required surfaces are
  R/gated-R; only the decision wrapper is missing). **Safety-override exception (`✷`):** Crisis
  escalation (#10) is force-elevated into Tier 1 for safety even though its underlying path is
  DC-1 status **P** (TR/PR=3, MR=3, TD=Med) — it does NOT meet the strict "all surfaces R" bar
  and is the one Tier-1 row whose difficulty is not Low. It is included by safety policy, not by
  the existing-asset criterion.
- **Tier 2** — requires **orchestration but no new products** (decision object + journey→M5
  bridge + confidence gate + decision→package mapping over **existing** surfaces).
- **Tier 3** — requires **new products or significant platform expansion** (stub products,
  the absent context axis, the institution B2B data layer, or net-new surfaces).

---

## Deliverables (this folder) → the 10 requested outputs

| # | Output | File |
|---|--------|------|
| 1 | Decision Priority Matrix (all 50 scored) | `DC2_PRIORITY_MATRIX.md` |
| 5 | Top 20 Decisions To Activate First | `DC2_PRIORITY_MATRIX.md` |
| 2 | Tier 1 Decision Inventory | `DC2_TIERS.md` |
| 3 | Tier 2 Decision Inventory | `DC2_TIERS.md` |
| 4 | Tier 3 Decision Inventory | `DC2_TIERS.md` |
| 6 | Revenue Opportunity Matrix | `DC2_MATRICES.md` |
| 7 | Future Readiness Matrix | `DC2_MATRICES.md` |
| 8 | Segment Impact Matrix | `DC2_MATRICES.md` |
| 9 | CAPADEX Decision Activation Roadmap | `DC2_ROADMAP.md` |
| 10 | Executive Summary | this file (below) |

Each recommendation in the tier inventories carries: **Current State · Target State · Gap ·
User Impact · Business Impact · Revenue Impact · Technical Difficulty · Priority**.

---

## Output #10 — Executive Summary

**The prioritization has one dominant shape: value and readiness point in opposite
directions.** The decisions with the **highest readiness** (diagnostic, report, mentor — DC-1
"R") have **moderate revenue**, while the decisions with the **highest revenue** (commercial
D6 — subscription recommendations, entitlement) have the **lowest readiness** (no
decision→package mapping exists). DC-2's job is to sequence around that tension.

**Three findings:**

1. **Tier 1 is real and should ship first — but it is a foundation, not the prize.** ~14
   decisions can activate immediately on existing assets (assessment, CAPADEX/OMEGA/PIL
   reports, mentor match, strength/longitudinal). They lift trust, engagement, and product
   utilization, and they generate the **first decision-conversion telemetry** — which every
   later revenue estimate depends on. Without Tier 1's data, all revenue numbers stay
   hypotheses.

2. **The revenue unlock is a Tier 2 orchestration task, not a Tier 3 build.** The single
   highest-leverage move is the **decision→subscription mapping + entitlement gate** over the
   **already-real** package catalog. No new product is required — packages exist and are
   segment-labelled. This is the biggest gap in DC-1 and the biggest revenue opportunity in
   DC-2, and it is "merely" orchestration.

3. **Tier 3 is where the future-relevant, high-FR decisions live — and they are blocked by
   two structural gaps**, not by demand: the **absent context axis** (AI-disruption,
   placement, leadership, family-pressure, entrepreneurship) and **stub products**
   (Employability Index, Competitive-Exam) + the **institution B2B data layer** (the
   highest-revenue single decision). These are the strategic bets, sequenced last because
   they need platform expansion.

**Top-20 headline (by Priority Index, full table in `DC2_PRIORITY_MATRIX.md`):** the activate-
first set is dominated by **Tier 1** (reports, assessment, mentor, institution cohort report,
stakeholder fan-out, longitudinal) plus the **most buildable Tier 2** (initiate growth plan,
career-clarity, transition plan) and **crisis escalation force-elevated for safety**.

**Recommended activation sequence (detail + estimates in `DC2_ROADMAP.md`):**
- **Wave 1 — Activate (Tier 1):** wrap existing-asset decisions in the decision object +
  confidence gate. Lifts product utilization; produces baseline DIS + first telemetry.
- **Wave 2 — Orchestrate (Tier 2):** journey→M5 growth-plan bridge, decision→subscription
  mapping + entitlement, teacher/counselor orchestration. This is the **revenue wave**.
- **Wave 3 — Expand (Tier 3):** context axis, product completion (Employability/Exam),
  institution B2B data layer. The **future-readiness wave**.

**Decision Intelligence Score (DIS):** DC-1 put current readiness ≈ **5–6/10**. DC-2 estimates
Wave 1 → ~6.5, Wave 2 → ~8, Wave 3 → ~9 (directional; to be validated, not forecast).

**Scope reminder:** audit/design only. No code, schema, or migrations changed. STOP for approval.
