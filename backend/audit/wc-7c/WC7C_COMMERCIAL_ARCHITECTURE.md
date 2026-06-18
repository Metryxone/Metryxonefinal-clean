# Output #1 — Commercial Intelligence Architecture

> Design only. Composes existing surfaces; introduces **no new tables**. Replaces the WC-7B
> `subscription: out_of_scope_tier_b` stub with a real, confidence-gated commercial slot.

---

## 1. Where it sits

WC-7C is **Tier-B activation**: a new compose-only layer that hangs off the *same*
`UnifiedDecision` the WC-7B orchestrator already builds. It adds three pure derivers and one
read surface, all behind flags, all byte-identical when OFF.

```
                      ┌─────────────────────────────────────────────┐
  UnifiedDecision ───►│  WC-7C Commercial Intelligence (compose-only)│
  (stage, outcome,    │                                              │
   journey, conf,     │   offer-engine ──► OfferActivation           │
   ambiguity, why[])  │   subscription-engine ──► SubscriptionAct.   │
                      │   revenue-intel (read) ──► RevenueSignal     │
                      └───────────────┬──────────────────────────────┘
                                      │  reads (no writes):
              ┌───────────────────────┼───────────────────────────────┐
   capadex_payments        subscription_packages         capadex_audit_events
   (stages, prices, paid)  (academic pkgs, segment)      (payment_completed → conversion)
              └───────────────────────┴───────────────────────────────┘
```

## 2. The four components (all design-stage)

### 2A. Offer Engine — `deriveOfferActivation(decision)` (Offer Intelligence)
Pure function. Bundles the **already-derived** activation slots into one ranked offer:
`{ report, product, growthPlan, mentor, subscription }`, each carrying its real surface status
(R/P/S/✗). The offer is the *unit of commerce* — a decision does not sell a subscription in
isolation, it sells a **bundle anchored on the primary outcome**. Honest rule: if the product
slot is a stub, the offer downgrades to "report + plan + mentor" and **omits the stub from the
paid bundle** (never sell `Empl`/`Exam` product).

### 2B. Subscription Engine — `deriveSubscriptionActivation(decision)` (Subscription Intelligence)
Pure function. Maps the decision to a **real purchasable target**, choosing between the two live
substrates:
- **B2C stage path (primary, real):** map `stage.canonical_stage` → next CAPADEX stage code
  (`Curiosity→CAP_INS`, `Clarity/Growth→CAP_GRW`, `Mastery→CAP_MAS`) with the **real price** from
  the admin pricing config. This is the only **CR>1** path today.
- **Academic package path (secondary):** map `segment + outcome + report_type` →
  `subscription_packages` row (by `student_segment` + `domains_covered` + `report_type`), returned
  as `is_recommended`. No tier invention — uses the row as-is.
- **High-confidence gate:** D6 fires only when decision `confidence ≥ required` *and*
  `ambiguity = low`; otherwise returns `ready:false, reason:'show_options'` (present, don't auto-recommend).
- **Stub guard:** READINESS/EDGE/ExamReadiness packages map to a **corpus_pending** product →
  returned as `ready:false, reason:'product_not_ready'` (honest; never sold).

### 2C. Upsell Engine (part of Subscription Engine) (Upsell Intelligence)
Stage-/state-triggered, read-only over `capadex_payments`:
- **Upgrade:** at `Growth/Mastery` stage with a *paid prior stage*, recommend the next stage code.
- **Renewal:** `student_subscriptions.expiry_date` within N days → renewal nudge decision.
- All nudges are **decisions** (logged), not auto-charges.

### 2D. Revenue Intelligence (read-only surface) (Revenue Intelligence)
Composes the **existing** revenue stats query (`SUM(amount_paise) FILTER (status='paid')`) and
`capadex_audit_events.payment_completed` into per-**decision-cluster** attribution:
*which decisions precede paid conversions*. This is the **missing telemetry** — without it every
lift number in WC-7C stays an estimate. Read-only; no new table (reads existing ledger + audit log).

## 3. The commercial slot contract (replaces `out_of_scope_tier_b`)

```ts
// DESIGN ONLY — not implemented in this phase
interface CommercialActivation {
  offer:        { ready: boolean; reason: string; bundle: OfferBundle | null };
  subscription: { ready: boolean; reason: string;
                  target: { kind: 'capadex_stage' | 'academic_package';
                            code_or_id: string; price: number; currency: 'INR' } | null;
                  confidence_gated: boolean };
  upsell:       { ready: boolean; reason: string; trigger: 'stage' | 'renewal' | null };
  revenue:      { potential_band: 'low'|'med'|'high'; ltv_band: 'low'|'med'|'high' }; // read-only estimate
}
```
When the WC-7C flag is OFF, the orchestrator returns the **exact** WC-7B marker
(`out_of_scope_tier_b`) — byte-identical. When ON, it returns the contract above, with honest
`ready:false` reasons wherever a surface is a stub or confidence is low.

## 4. Audit-area readiness scorecard (today, grounded)

| Audit area | Real substrate | Decision-wired? | Readiness (0–5) | Honest blocker |
|------------|----------------|:--:|:--:|----------------|
| Subscription Intelligence | CAPADEX stages (R) + academic pkgs (P) | ❌ | **1** | no decision→sub mapping |
| Commercial Intelligence | activation envelope (R, WC-7B) | partial | **2** | subscription slot stubbed |
| Offer Intelligence | report+plan+mentor slots (R) | ❌ | **2** | no bundle composer |
| Upsell Intelligence | stage ladder + validity (R) | ❌ | **1** | generic, not state-triggered by decision |
| Revenue Intelligence | payments ledger + audit events (R) | ❌ | **2** | no per-decision attribution |

**Architecture verdict:** the commercial substrate is **real and revenue-producing today**, but
**decision-blind**. WC-7C is glue, not product: ~4 pure composers + 1 read surface, no schema. The
highest-leverage single move is **2B (the decision→subscription mapping)** — it lifts the entire
D6 commercial cluster (DC-2 rows 21–31) simultaneously.
