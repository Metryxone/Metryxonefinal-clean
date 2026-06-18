# WC-7C — Commercial Intelligence & Subscription Activation (DESIGN + AUDIT ONLY)

> **Phase type:** DESIGN + AUDIT. **No implementation. No schema changes. No migrations.
> STOP FOR APPROVAL.**
> Everything below is grounded against the *real* code as it exists today; every lift number is
> a **directional estimate** (labelled), never a measured result. Nothing here fabricates a
> surface — `✗`/stub statuses are honest findings.

---

## 1. What this phase does

The intelligence chain is now wired through **Decision** (WC-5/6), and Tier-A activation
(WC-7B) lit up **Growth Plan** and **Mentor**:

```
Concern → Stage → Context* → Outcome → Journey → Decision → Growth Plan → Mentor
                                                                  │
                                                       (*context axis still absent)
```

The **commercial half of the chain is missing**:

```
Decision → Offer → Subscription → Revenue        ← WC-7C designs this (does not build it)
```

WC-7B deliberately stubbed the subscription slot in the activation envelope:
`subscription: { ready: false, reason: 'out_of_scope_tier_b' }`
(`backend/services/wc7b/decision-orchestrator.ts`). WC-7C is the **design + audit** that
specifies exactly what would replace that marker, and proves it can be built **compose-only**
on the commercial substrate that already exists — **without one new table.**

---

## 2. Grounded commercial reality (the honest substrate)

There are **two** commercial substrates in the codebase, and prior audits disagreed about the
package schema. The grounded reality:

| Substrate | Status | What's real | What's NOT real |
|-----------|--------|-------------|-----------------|
| **CAPADEX progressive-stage (B2C, live)** | **R — the real revenue path today** | `capadex_payments` ledger (Razorpay order/verify/webhook); admin pricing API + `CapadexPricingPanel.tsx`; default prices `CAP_INS ₹499 / CAP_GRW ₹999 / CAP_MAS ₹1999`; reports-as-products gated by `status='paid'`; revenue stats query; conversion via `capadex_audit_events` (`payment_completed`) | No link to the **decision** — upgrade offers are generic/stage-linear, not outcome-driven |
| **Academic packages (legacy)** | **P — billing substrate only** | `subscription_packages` (`category, student_segment, product_name, price, validity_days, question_count, report_type, domains_covered[], is_recommended, is_active`); `student_subscriptions` entitlement link; `PricingPanel.tsx`; richer raw-SQL surface in `frontend/server` | **No** `tier/features/modules/max_students` on the live canonical table (WC-5's Track-F claim of Basic/Family/Premium tiers reflects the `frontend/server` surface, **not** the live `backend/shared/schema.ts` table). No decision→package mapping. Institution B2B (`institution_id`/`max_students`) absent → seat enforcement non-functional |

> **Correction carried from WC-6:** do **not** plan against a `tier/features/modules/max_students`
> subscription model on the live table — it does not exist there. The decision→subscription
> mapping must target (a) the **CAPADEX stage codes** (real, B2C) and (b) `subscription_packages`
> rows **as-is** (by `student_segment` + `report_type` + `domains_covered`), not an invented tier
> schema.

**The single most consistent gap (DC-1):** the **Subscription column is `✗ (design)` in every
catalog row** — class **D6 Commercial** has *no* delivery today. That is the whole point of WC-7C.

---

## 3. Audit areas (covered across the outputs)

1. **Subscription Intelligence** — which subscription/stage a decision should recommend → Output #3, #8.
2. **Commercial Intelligence** — the architecture that fans a decision into offer/sub/revenue → Output #1.
3. **Offer Intelligence** — the bundled offer (report + product + plan + mentor + sub) per decision → Output #2.
4. **Upsell Intelligence** — stage-/outcome-triggered upgrade & renewal logic → Output #2 (upsell cols), #5.
5. **Revenue Intelligence** — revenue opportunity, LTV, and the telemetry to measure it → Output #4, #9.

## 4. Measures (0–5 unless noted; honest baselines)

- **Subscription Readiness (SR)** — can a decision name a *real* purchasable subscription/stage?
- **Conversion Readiness (CR)** — is there a wired path from decision → offer → checkout?
- **Offer Fit (OF)** — how well the recommended bundle matches the decision anchor.
- **Upsell Readiness (UR)** — can the system trigger an upgrade/renewal from state?
- **Lifetime Value Potential (LTV)** — multi-purchase / multi-stage / renewal potential.
- **Revenue Potential (RP)** — absolute revenue size of the segment/decision cluster.

> Today, across the catalog, **SR=1, CR=1, OF=1** for decision-driven commerce (the only live path
> is the generic stage-upgrade prompt, which is *not* decision-driven). The CAPADEX stage ladder
> gives a real **UR/LTV** seed (sequential upgrades) but it is **not** anchored to the decision.

## 5. Segments (8)

School Students · College Students · Job Seekers · Competitive-Exam Aspirants · Parents ·
Teachers · Counselors · Institutions.

## 6. Special focus themes (grounded status)

| Theme | Commercial readiness | Honest blocker |
|-------|:--:|----------------|
| **Career Clarity** | 🟡 strongest | Outcome `career_clarity` real; CB partial; needs decision→sub mapping only |
| **Family Support** | 🟡 | PIL Parent report real; Family pkg exists in `subscription_packages`; no nudge rule |
| **Employability** | ❌ | Employability Index is a **stub**; route ready, product not |
| **Career Transition** | ❌/🟡 | M5 transition plan real; READINESS/EDGE package rows exist but map to the Employability **product stub** — no real job-seeker product to sell into |
| **Competitive Exams** | ❌ | Packages real (READINESS/EDGE) but **product stub + corpus_pending** — don't sell into it |
| **AI Job Disruption** | ❌ | Context axis **absent**; `AI_FUTURE_OF_WORK` detectable but unwired; no product |
| **Entrepreneurship** | ❌ | No product, plan, or route; context axis absent |

## 7. Output index

| # | Output | File |
|---|--------|------|
| 1 | Commercial Intelligence Architecture | `WC7C_COMMERCIAL_ARCHITECTURE.md` |
| 2 | Offer Intelligence Matrix | `WC7C_INTELLIGENCE_MATRICES.md` §2 |
| 3 | Subscription Intelligence Matrix | `WC7C_INTELLIGENCE_MATRICES.md` §3 |
| 4 | Revenue Opportunity Matrix | `WC7C_INTELLIGENCE_MATRICES.md` §4 |
| 5 | Conversion Intelligence Matrix | `WC7C_INTELLIGENCE_MATRICES.md` §5 |
| 6 | Tier-1 Commercial Activation Plan | `WC7C_ACTIVATION_PLANS.md` §6 |
| 7 | Tier-2 Commercial Activation Plan | `WC7C_ACTIVATION_PLANS.md` §7 |
| 8 | Subscription Readiness Report | `WC7C_ACTIVATION_PLANS.md` §8 |
| 9 | CAPADEX Revenue Intelligence Roadmap | `WC7C_ROADMAP_AND_SUMMARY.md` §9 |
| 10 | Executive Summary | `WC7C_ROADMAP_AND_SUMMARY.md` §10 |

## 8. Discipline (binding on any future WC-7C implementation phase)

- **Additive · flag-gated (default OFF) · byte-identical OFF · never-throws · reversible · compose-only.**
- **No new tables** — reuse `capadex_payments`, `subscription_packages`, `student_subscriptions`,
  `capadex_audit_events`.
- **Never auto-charge / never auto-recommend on low confidence** — D6 requires **High** confidence
  (DC-1); below threshold → *show options*, never auto-select. Safety (D7) always overrides commerce.
- **No fabricated offer** — if the recommended surface is a stub (`Empl`, `Exam`), the offer is
  flagged "product not ready", never sold.
