# WC-7C Intelligence Matrices — Outputs #2–#5

Per-recommendation columns (per phase spec): **Current State · Target State · Gap · User Impact
(UI) · Business Impact (BI) · Revenue Impact (RI) · Technical Difficulty (TD) · Priority**.
UI/BI/RI are 1–5 directional estimates; TD ∈ {Low, Med, High}; Priority ∈ {High, Med, Low}.
Surface status: **R** real · **P** partial · **S** stub · **✗** absent. All lift numbers are
**directional estimates** pending the Revenue-Intelligence telemetry (Output #1 §2D).

---

## §2 — Output #2: Offer Intelligence Matrix

The **offer** = the bundle a decision sells, anchored on the **primary outcome** (DC-1 §1D is the
best anchor). Each row is "for outcome X, the recommended offer bundle + its honest sellability".

| Outcome anchor | Recommended report | Product | Growth Plan | Mentor | Subscription target | Offer Fit | Sellable today? |
|----------------|--------------------|---------|-------------|--------|---------------------|:--:|------------------|
| **career_clarity** | OMEGA **R** + CAPADEX **R** | Career Builder **P** | clarity plan **R** | career mentor **R** | CAP_GRW (B2C) + READINESS pkg | **5** | ✅ stage upgrade; pkg=design |
| learning_effectiveness | CAPADEX **R** | LBI **R** | learning plan **P** | learning coach **R** | CAP_INS + Annual pkg | 4 | ✅ stage upgrade |
| **employability_readiness** | PIL **R** | Employability **S** | employ plan **P** | career mentor **R** | READINESS/EDGE pkg | 3 | ⚠️ product stub → omit from paid bundle |
| exam_readiness (gated) | ExamReadiness **P** | Exam **S** +corpus_pending | exam plan **P** | exam mentor **R** | ExamReadiness pkg | 2 | ❌ corpus_pending — do not sell |
| confidence_stability | PIL **R** | LBI **R** + Mentor **R** | confidence plan **P** | confidence mentor **R** | CAP_INS + Annual | 4 | ✅ stage upgrade |
| decision_quality | OMEGA **R** | Career Builder **P** | decision plan **P** | mentor **R** | CAP_GRW + Premium | 3 | ✅ stage upgrade |
| family_wellbeing | PIL Parent **R** | Mentor **R** (family) | family plan **P** | family mentor **R** | Family pkg | 4 | 🟡 pkg=design, report real |

**Per-recommendation (representative — the offer composer itself):**
- **Current State:** report+plan+mentor slots are individually real (WC-7B) but never composed into
  one ranked, priced bundle; subscription slot is `out_of_scope_tier_b`.
- **Target State:** `deriveOfferActivation(decision)` returns one bundle with per-slot status +
  one priced subscription target + an honest "sellable/omit" flag.
- **Gap:** the bundle composer + stub-guard (no schema).
- **UI 5 · BI 4 · RI 4 · TD Low · Priority High.**

**Offer-matrix findings:** the **report dimension is the strongest** (almost every outcome attaches
a real report); the **product dimension is the weakest** (Employability/Exam stubs). The offer
composer must therefore be **report-led**, attach plan+mentor (both real), and **gate the product
+ subscription** on real status. **career_clarity / confidence_stability / family_wellbeing** are
the three highest-Offer-Fit, sellable-today anchors.

---

## §3 — Output #3: Subscription Intelligence Matrix

Maps **decision anchor → real purchasable target**, across the two live substrates. SR = can it
name a real subscription; CR = is checkout wired.

| Decision anchor | B2C stage target (real price) | Academic pkg target | SR | CR | UR | Notes |
|-----------------|-------------------------------|---------------------|:--:|:--:|:--:|-------|
| Stage = Awareness | — (free report) | Micro entry | 2 | 1 | 2 | entry, no upgrade yet |
| Stage = Curiosity | **CAP_INS ₹499** | Micro/Annual | 4 | 3 | 4 | first real upgrade (live) |
| Stage = Clarity | **CAP_GRW ₹999** | Annual | 4 | 3 | 4 | strongest upgrade point |
| Stage = Growth | **CAP_GRW/CAP_MAS** | Premium/EDGE | 4 | 3 | **5** | upsell-prime |
| Stage = Mastery | **CAP_MAS ₹1999** | renew/Premium | 4 | 3 | **5** | retain/renew |
| Segment = Parent | (child's stage) | **Family pkg** | 3 | 2 | 3 | report real, pkg=design |
| Segment = Job Seeker | CAP_GRW | READINESS | 2 | 1 | 2 | product stub caveat |
| Segment = Exam Aspirant | CAP_GRW | ExamReadiness/EDGE | 1 | 1 | 1 | corpus_pending — defer |
| Segment = Institution | — | **B2B (absent)** | 0 | 0 | 0 | no `institution_id`/`max_students` |

**Per-recommendation (the mapping rule itself — DC-2 rows 21–31):**
- **Current State:** `subscription_packages`/stages real; **zero** decision→target mapping (`✗`).
- **Target State:** `deriveSubscriptionActivation(decision)` returns one confidence-gated target.
- **Gap:** the mapping table (in code, no DB) + confidence gate + stub guard.
- **UI 3 · BI 5 · RI 5 · TD Med · Priority High** (the keystone move).

**Subscription-matrix findings:** the **CAPADEX stage ladder is the real subscription engine**
(sequential, priced, paid-gated) — the design should make the **decision pick the right next
stage**, not invent tiers. Academic packages are a **secondary, segment-led** target. **Institution
B2B is SR=0** (data layer absent) — highest revenue, but Tier-3, out of WC-7C compose-only scope.

---

## §4 — Output #4: Revenue Opportunity Matrix

Per segment: revenue potential, LTV, and the honest blocker. RP/LTV are 1–5 directional bands.

| Segment | Natural offer | RP | LTV | Conversion path today | Honest blocker | Directional revenue lift* |
|---------|---------------|:--:|:--:|------------------------|----------------|---------------------------|
| **College Students** | clarity bundle → CAP_GRW | 5 | 5 | stage upgrade (live) | CB partial; no decision nudge | **High** (+15–25% on upgrade prompt) |
| **School Students** | LBI + Family | 4 | 5 | stage upgrade + Family pkg | family nudge absent | Med–High (+10–20%) |
| **Parents** | Family pkg | 4 | 4 | report real, pkg design | no family product/nudge | Med (+10–15%) |
| **Job Seekers** | Employability/READINESS | 5 | 4 | ❌ product stub | Employability product stub | High *potential*, blocked |
| **Exam Aspirants** | ExamReadiness/EDGE | 5 | 4 | ❌ corpus_pending | exam product + corpus | High *potential*, blocked |
| **Counselors** | Premium/console | 3 | 4 | none | no counselor console | Med, Tier-3 |
| **Teachers** | educator/modules | 3 | 3 | none | no educator product | Med, Tier-3 |
| **Institutions** | B2B seats | 5 | 5 | none | `institution_id`/`max_students` absent | **Highest**, Tier-3 build |

`*` Lift = estimated effect of WC-7C's decision-driven offer **vs** today's generic stage prompt,
**conditional on the surface being real**. Stub-blocked segments show *potential*, not achievable
lift, until product completion (Tier-3, out of scope).

**Revenue-opportunity findings:** the **achievable** WC-7C revenue is concentrated in **B2C stage
upgrades for College/School/Parent** (real surfaces) — a decision-driven upgrade prompt at the
**Curiosity→Clarity→Growth** transitions. The **largest** revenue (Job Seeker, Exam, Institution)
is **blocked by product/data maturity**, not by WC-7C — selling there now would be selling into a
stub. The **one telemetry prerequisite** (Output #1 §2D) must ship first, or these bands stay guesses.

---

## §5 — Output #5: Conversion Intelligence Matrix

Conversion = decision → offer → checkout → paid. Audits each hop's readiness.

| Conversion hop | Current State | Target State | Gap | TD | CR |
|----------------|---------------|--------------|-----|:--:|:--:|
| Decision → Offer | decision built (WC-7B); no offer | offer bundle composed | offer engine | Low | 2 |
| Offer → Subscription target | no mapping (`✗`) | confidence-gated target | mapping rule | Med | 1→4 |
| Subscription → Checkout | **Razorpay live** (CAP stages) | reuse as-is (deep-link) | wire decision→order | Low | 3→4 |
| Checkout → Paid | **live** (`verify`/`webhook`) | unchanged | none | — | R |
| Paid → Attribution | stats + `payment_completed` exist | per-decision attribution | revenue-intel read | Low | 2 |
| Low-confidence → Defer | no central gate | show-options not auto-recommend | confidence gate | Med | n/a |

**Per-recommendation (the conversion telemetry):**
- **Current State:** revenue is counted in aggregate; **no** join from the *decision* that preceded
  a paid conversion.
- **Target State:** read-only attribution joining `capadex_audit_events.payment_completed` ↔ the
  decision/session, surfaced per decision-cluster.
- **Gap:** the read surface (no schema; reads existing ledger + audit log).
- **UI 2 · BI 5 · RI 5 · TD Low · Priority High** (measurement unlocks every other estimate).

**Conversion-matrix findings:** **checkout is already real** (Razorpay live) — the conversion
engine's missing pieces are the **front** (decision→offer→target mapping) and the **back**
(decision-level attribution). Both are **Low-TD compose-only**. The middle (checkout) needs only a
**deep-link**, not a rebuild. Conversion is therefore a **glue problem, not a payments problem**.
