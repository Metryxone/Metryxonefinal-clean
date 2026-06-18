# WC-7C — Outputs #9 (Revenue Intelligence Roadmap) & #10 (Executive Summary)

---

## §9 — Output #9: CAPADEX Revenue Intelligence Roadmap

Sequenced so that **measurement ships first** (every later lift number is a guess without it), then
the highest-ROI compose-only glue, then the explicit Tier-3 boundary. All waves obey the WC-7C
discipline: additive · flag-gated default OFF · byte-identical OFF · never-throws · compose-only ·
**no new tables**.

### Wave 0 — Revenue telemetry (prerequisite, Low TD)
- **Build:** read-only revenue attribution (Output #1 §2D) joining
  `capadex_audit_events.payment_completed` ↔ the decision/session that preceded it; surface
  per-decision-cluster conversion in the SuperAdmin reports console.
- **Why first:** today revenue is aggregate-only; **no decision→conversion attribution exists.**
  Without Wave 0, Waves 1–2 lifts cannot be validated and stay directional.
- **Risk/Impact:** UI 2 · BI 5 · RI 5 · **TD Low** · **Priority Highest**. No schema (reads ledger).

### Wave 1 — Tier-1 decision-driven offer over the live stage ladder (Low TD)
- **Build:** offer composer (`deriveOfferActivation`) + decision→CAPADEX-stage mapping
  (`deriveSubscriptionActivation`, B2C path) + deep-link into the **already-live** Razorpay
  checkout. Confidence gate (D6 High-conf; else show-options). Stub guard.
- **Surfaces:** C1–C6 (Output #6). College/School/Parent.
- **Directional lift:** SR 1→4 · CR 1→3 · Revenue **+15–25%** on Curiosity→Clarity→Growth upgrades
  (conditional, validated by Wave 0).
- **Risk/Impact:** **TD Low**, fully reversible (flag OFF → WC-7B `out_of_scope_tier_b`).

### Wave 2 — Tier-2 commercial orchestration (Med TD, the revenue wave)
- **Build:** decision→academic-package mapping (C7/C8/C9/C10, `subscription_packages` as-is, no
  tier invention) · upsell + renewal rules over `capadex_payments`/`student_subscriptions`
  (C11/C12) · decision-gated entitlement (C13, the one High-TD item) · confidence-defer (C14).
- **Directional lift:** SR 1→4 across mapped cluster · Revenue **+10–20%** incremental over Wave 1.
- **Risk/Impact:** **TD Med** (C13 High). Entitlement enforcement is the only behaviour-changing
  item → ship last, flag-gated, non-blocking first (log-then-allow), then enforce.

### Wave 3 — BOUNDARY (out of WC-7C scope — Tier-3, requires product/data build)
- **Not built here:** Employability product completion (unblocks Job Seeker READINESS/EDGE),
  Competitive-Exam product + corpus (unblocks Exam packages), **Institution B2B data layer**
  (`institution_id`/`max_students` — highest RP, biggest build), context axis (unblocks AI-disruption
  / entrepreneurship / placement-anxiety commerce).
- **Why excluded:** all require **new product or new schema** — they violate WC-7C's compose-only,
  no-schema discipline. Documented so the roadmap is complete and the dependency is explicit.

### Special-focus theme placement on the roadmap

| Theme | Wave | Rationale |
|-------|:--:|-----------|
| **Career Clarity** | 1 | real outcome + reports + stage ladder → sellable now |
| **Family Support** | 1–2 | PIL Parent real (W1 offer) + Family pkg mapping (W2) |
| **Career Transition** | 2 | M5 transition plan real; map to stage upgrade (no new product) |
| **Employability** | 3 | product stub — cannot sell honestly until built |
| **Competitive Exams** | 3 | corpus_pending — do not sell into a stub |
| **AI Job Disruption** | 3 | context axis absent + no product |
| **Entrepreneurship** | 3 | no product/plan/route at all |

### Roadmap summary

| Wave | Scope | TD | New tables | Directional revenue lift* | Reversible |
|------|-------|:--:|:--:|---------------------------|:--:|
| 0 | revenue telemetry | Low | 0 | enables measurement | ✅ |
| 1 | Tier-1 offer over live stages | Low | 0 | +15–25% | ✅ |
| 2 | Tier-2 mapping/upsell/entitlement | Med (one High) | 0 | +10–20% incremental | ✅ |
| 3 | **boundary** (product/B2B/context) | High | **schema** | highest *potential*, blocked | n/a |

`*` All conditional on real surfaces and validated only after Wave 0 telemetry.

---

## §10 — Output #10: Executive Summary

**Phase:** WC-7C Commercial Intelligence & Subscription Activation — **DESIGN + AUDIT ONLY.**
No implementation, no schema, no migrations. **STOP for approval.**

**The gap, in one line:** the intelligence chain reaches **Decision → Growth Plan → Mentor**
(WC-7B), but the commercial chain **Decision → Offer → Subscription → Revenue** does not exist —
WC-7B even hard-stubs the slot as `out_of_scope_tier_b`. Across the entire DC-1 catalog, the
**Subscription column is `✗` in every row** (class D6 Commercial has zero delivery).

**The honest substrate:** monetization is **infrastructure-ready but decision-blind.** The live
revenue engine is the **CAPADEX progressive-stage ladder** (`capadex_payments`, Razorpay,
CAP_INS ₹499 / CAP_GRW ₹999 / CAP_MAS ₹1999, reports gated by `status='paid'`) — real and earning
today, but driven by a **generic stage banner, not the decision.** A secondary academic-package
substrate (`subscription_packages` + `student_subscriptions`) exists but has **no
tier/features/modules/max_students** on the live table (a prior WC-5 claim reflected a different
`frontend/server` surface) and **no decision→package mapping.**

**The thesis:** WC-7C is **glue, not product.** ~4 pure composers + 1 read surface, all
compose-only, **no new tables**, replacing the `out_of_scope_tier_b` stub with a confidence-gated
commercial slot that reuses the **already-live checkout**.

**The keystone move:** the **single decision→subscription mapping** + confidence gate lifts the
entire D6 commercial cluster (DC-2 rows 21–31) from SR=1 to SR=4 at once. Build it once, the whole
revenue block moves together.

**What is sellable now vs blocked (honest):**
- **Sellable (compose-only, Tier-1/2):** College + School (+ Parent with a family nudge) on the
  live stage ladder. This is the achievable WC-7C surface.
- **Blocked by product:** Job Seekers (Employability **stub**), Exam Aspirants (**corpus_pending**)
  — high intent, real packages, but selling now = selling into a stub. **Do not.**
- **Blocked by data layer:** Institutions — **highest revenue potential**, but B2B
  (`institution_id`/`max_students`) is absent. Tier-3, out of scope.

**Sequencing:** **Wave 0 telemetry first** (no decision→conversion attribution exists today, so
every lift number below is a directional estimate until it ships) → **Wave 1** decision-driven offer
over the live stage ladder (Low TD, **+15–25%** est.) → **Wave 2** mapping/upsell/renewal/
entitlement (Med TD, **+10–20%** incremental) → **Wave 3 boundary** (product/B2B/context — requires
build, excluded here).

**Estimated lifts (directional, pending Wave 0):**
- **Subscription Readiness:** 1 → 4 (ready segments).
- **Conversion Readiness:** 1 → 3 (decision→offer→live checkout wired).
- **Revenue:** **+25–45%** cumulative across Waves 1–2, **conditional** on real surfaces and
  validated only after telemetry. Tier-3 segments carry larger *potential* but are blocked.

**Risk posture:** every wave is additive, flag-gated default OFF, byte-identical OFF, reversible to
the exact WC-7B marker. The only behaviour-changing item (C13 entitlement enforcement) ships last,
log-then-allow before enforce. **No offer is ever sold against a stub; D6 never auto-recommends on
low confidence; safety (D7) always overrides commerce.**

**Recommendation:** approve the architecture (Output #1) and the **Wave 0 + Wave 1** scope as the
first implementation slice (both Low-TD, compose-only, no schema). Defer Wave 2's entitlement
enforcement (C13) and **explicitly exclude Wave 3** until the product/B2B/context prerequisites are
funded as their own phases.

**STOP — WAIT FOR APPROVAL.**
