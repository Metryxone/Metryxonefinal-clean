# WC-7C Commercial Activation Plans — Outputs #6–#8

Tier = **commercial asset readiness** (mirrors DC-2's asset-requirement convention), **not** score.
- **Tier-1 commercial** = sellable **today** on a real, paid-gated surface (CAPADEX stage ladder) —
  needs only the decision→offer glue.
- **Tier-2 commercial** = real billing substrate exists but needs **orchestration** (mapping,
  nudge, entitlement, family/segment routing) — no new product.
- (**Tier-3 commercial** — Employability/Exam product completion, Institution B2B data layer — is
  **out of WC-7C scope**; listed only as the boundary in Output #9.)

All lift numbers are **directional estimates** pending Output #1 §2D telemetry.

---

## §6 — Output #6: Tier-1 Commercial Activation Plan (sellable today)

These activate on the **live CAPADEX stage ladder** (Razorpay real, `status='paid'` gating real).
The only gap is making the **decision** drive the upgrade prompt instead of a generic stage banner.

| ID | Commercial decision | Current State | Target State | Gap | UI | BI | RI | TD | Priority |
|----|---------------------|---------------|--------------|-----|----|----|----|----|----------|
| C1 | Upgrade prompt at **Curiosity→Insight** | generic stage banner; CAP_INS ₹499 live | decision-driven offer at Curiosity w/ outcome reason | offer+mapping glue | 4 | 5 | 5 | Low | **High** |
| C2 | Upgrade prompt at **Clarity→Growth** | generic; CAP_GRW ₹999 live | decision-driven offer anchored on primary outcome | glue | 4 | 5 | 5 | Low | **High** |
| C3 | **Mastery** retain/renew | CAP_MAS ₹1999 live; no renew decision | decision: renew/retain at Mastery | glue + timing | 3 | 5 | 5 | Low | High |
| C4 | **Report-as-product** offer (Insight/Growth/Mastery) | reports gated by paid (R) | offer surfaces the *specific* paid report the decision needs | bundle composer | 4 | 4 | 4 | Low | High |
| C5 | **Strength-affirmation → light upsell** | CSI positive_factors real | affirm strength, soft-suggest next stage (canon-safe) | composer + canon guard | 4 | 3 | 3 | Low | Med |
| C6 | **Longitudinal-progress → re-assess upgrade** | OMEGA longitudinal real; WC-7B `next_reassessment_at` | offer re-assessment at cadence → stage upgrade | reuse WC-7B cadence | 4 | 4 | 4 | Low | High |

**Tier-1 takeaway:** **6 decisions, all Low-TD**, all riding the **already-live Razorpay stage
ladder**. Shipping these = the **offer composer + decision→stage mapping + deep-link** over real
checkout. This wave produces the **first decision→conversion telemetry** — without which every
Tier-2 number stays a guess.
**Directional lift (Tier-1, conditional on real surface):** Subscription Readiness 1→4 ·
Conversion Readiness 1→3 · Revenue **+15–25%** on the upgrade transitions (estimate).

---

## §7 — Output #7: Tier-2 Commercial Activation Plan (orchestration, no new product)

Real billing substrate; needs the mapping/nudge/entitlement/segment glue. Mirrors DC-2 rows 21–31.

| ID | Commercial decision | Current State | Target State | Gap | UI | BI | RI | TD | Priority |
|----|---------------------|---------------|--------------|-----|----|----|----|----|----------|
| C7 | **Decision→academic package** map | pkgs real, no mapping (`✗`) | map segment+outcome→`subscription_packages` row | mapping rule | 3 | 5 | 5 | Med | High* |
| C8 | **Recommend Family pkg** (Parents) | Family pkg in pkgs; PIL Parent report real | decision: family offer for minors | mapping + family nudge | 4 | 5 | 5 | Med | High* |
| C9 | **Recommend Annual Core** | pkg real, no map | decision→Annual on Curiosity/Clarity | mapping | 3 | 5 | 4 | Med | Med* |
| C10 | **Recommend READINESS** (clarity/empl) | pkg real, **product partial** | decision→READINESS where surface real | mapping + status guard | 3 | 5 | 5 | Med | Med* |
| C11 | **Stage-triggered upsell** (Growth) | no upsell decision; stage real | decision: upsell at Growth from paid prior | upsell rule (read ledger) | 3 | 5 | 5 | Med | High* |
| C12 | **Renewal / retention nudge** | `student_subscriptions.expiry_date` tracked | decision: renewal nudge before expiry | timing rule | 3 | 5 | 5 | Med | High* |
| C13 | **Entitlement enforcement** | partial / non-blocking | decision-gated server-side entitlement | server-side gate | 2 | 5 | 5 | High | Med* |
| C14 | **Defer commerce on low confidence** | no central gate | show-options not auto-recommend (D6 High-conf) | confidence gate | 4 | 4 | 3 | Med | High |
| C15 | **Revenue attribution** (per decision) | aggregate stats only | join `payment_completed`↔decision | read surface | 2 | 5 | 5 | Low | High |

`*` These are **Low Priority-Index today only because SR=1 (no mapping)** — yet they are the
**highest-revenue cluster**. Build the **single** decision→subscription mapping (C7) and the whole
block lifts in readiness at once (DC-2's keystone finding, carried forward).

**Tier-2 takeaway:** **9 decisions unlocked by ~four pieces of orchestration** — (a) decision→sub
mapping (C7/C8/C9/C10), (b) upsell+renewal rules (C11/C12), (c) confidence gate (C14), (d) revenue
attribution (C15). **No new product.** This is the **revenue wave**, highest ROI per line of code.
**Directional lift (Tier-2, conditional):** Subscription Readiness 1→4 (mapped cluster) ·
Conversion Readiness 1→3 · Revenue **+10–20%** incremental on top of Tier-1 (estimate).

---

## §8 — Output #8: Subscription Readiness Report

Per-segment subscription readiness against the **real** substrates. SR/CR/UR/LTV 0–5.

| Segment | Real subscription substrate | SR | CR | UR | LTV | Readiness verdict |
|---------|------------------------------|:--:|:--:|:--:|:--:|-------------------|
| **College Students** | CAPADEX stages (R) | 4 | 3 | 5 | 5 | **Ready** — best Tier-1 target |
| **School Students** | CAPADEX stages + Family pkg | 4 | 3 | 4 | 5 | **Ready** — needs family nudge for full LTV |
| **Parents** | Family pkg (design) + child stages | 3 | 2 | 3 | 4 | **Near-ready** — report real, pkg/nudge design |
| **Job Seekers** | READINESS pkg + stages | 2 | 1 | 2 | 4 | **Blocked** — Employability product stub |
| **Exam Aspirants** | ExamReadiness/EDGE pkg | 1 | 1 | 1 | 4 | **Blocked** — corpus_pending; do not sell |
| **Counselors** | Premium/console (none) | 1 | 0 | 1 | 4 | **Not ready** — no console (Tier-3) |
| **Teachers** | educator/modules (none) | 1 | 0 | 1 | 3 | **Not ready** — no educator product (Tier-3) |
| **Institutions** | B2B seats (`max_students` absent) | 0 | 0 | 0 | 5 | **Not ready** — no B2B data layer (Tier-3); highest RP |

**Subscription-readiness findings:**
- **Ready now (compose-only):** College + School (+ Parent with a family nudge) — all on the live
  stage ladder. This is the entire achievable WC-7C subscription surface.
- **Blocked by product, not by WC-7C:** Job Seeker / Exam — high intent + real packages, but the
  **product** behind the package is a stub/corpus_pending. Selling is dishonest until completed.
- **Blocked by data layer:** Institutions — **highest revenue potential**, but `institution_id`/
  `max_students` are absent → seat enforcement non-functional. Tier-3 build, explicitly out of
  WC-7C compose-only scope.
- **The keystone:** SR moves from **1 → 4** across the ready segments the moment the **single**
  decision→subscription mapping (C7) plus the confidence gate (C14) ship.
