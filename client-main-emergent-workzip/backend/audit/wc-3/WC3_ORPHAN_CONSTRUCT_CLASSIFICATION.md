# WC-3 — Orphan Construct Classification Matrix

**Scope:** Classify every remaining orphan construct (registry construct in **no**
outcome model) into exactly one disposition:
`reconcile-to-existing-model` · `requires-future-model` · `requires-future-route` ·
`requires-future-product`. **Classification only** — apart from `FAMILY_DYNAMICS`
(remediated this pass) **nothing here is implemented**; these are recommendations for
approval. Per approved scope, **no new routes/products are created for Wellbeing,
Digital, Career-Growth or other orphan domains** unless a destination already exists.

## 1. Orphan set (after this pass)
`FAMILY_DYNAMICS` is now covered (see `WC3_FAMILY_REMEDIATION.md`), leaving **7**
orphan constructs (was 8). "Grounded" = has real `intervention_library` rows.

| # | Construct | Concern mappings | Interventions (grounded?) | Disposition | Natural destination | Recommended action |
|---|---|---|---|---|---|---|
| 1 | `PROCRASTINATION` | 4 | 6 ✅ | **Reconcile to existing model** | `decision_quality` (self-regulation/follow-through) → Career Builder / LBI (existing products) | Add `PROCRASTINATION` to `decision_quality.construct_keys`. No new route/product. |
| 2 | `PEER_RELATIONS` | 5 | 4 ✅ | **Reconcile to existing model** (moderate fit) | `confidence_stability` (shares `SOCIAL_CONFIDENCE`) → LBI / Mentoring | Fold into `confidence_stability`, OR promote to a future relational model if fit deemed too loose. |
| 3 | `PHYSICAL_WELLBEING` | 7 | 2 ✅ | **Requires future model** | No model fits physical health; **product exists** (Mentoring `/mentors`) | New `wellbeing` model → existing Mentoring product (family pattern). No new product needed. |
| 4 | `SAFETY_THREATS` | 3 | 4 ✅ | **Requires future model** (safeguarding-sensitive) | **Product exists** (Mentoring `/mentors` — human escalation) | New safeguarding model → Mentoring; route must carry crisis/escalation semantics, not generic actions. |
| 5 | `DIGITAL_DEPENDENCY` | 6 | 4 ✅ | **Requires future model** + **requires future product** | No digital-wellness product; Mentoring could interim-serve | Deferred per scope (do **not** build a Digital product now). Pairs with #6. |
| 6 | `DIGITAL_DISCIPLINE` | 5 | 2 ✅ | **Requires future model** + **requires future product** | Same digital-wellness domain as #5 | Deferred; co-model with `DIGITAL_DEPENDENCY` when a digital-wellness destination is decided. |
| 7 | `CAREER_GROWTH` | 15 | **0 ❌** | **Requires future model** — **BLOCKED on grounding** | Career domain; products exist (Career Builder) but **no interventions to supply actions** | **Cannot back a model/route yet**: 0 `intervention_library` rows → any model would activate but yield zero actions. Requires intervention authoring **first**, then a model. |

## 2. Disposition tally
- **Reconcile to existing model (no new infra):** 2 — `PROCRASTINATION`, `PEER_RELATIONS`.
- **Requires future model (destination product already exists):** 2 — `PHYSICAL_WELLBEING`, `SAFETY_THREATS`.
- **Requires future model + future product (deferred per scope):** 2 — `DIGITAL_DEPENDENCY`, `DIGITAL_DISCIPLINE`.
- **Requires future model, blocked on intervention grounding:** 1 — `CAREER_GROWTH`.

## 3. Notes on honesty / non-fabrication
- `CAREER_GROWTH` is the **only ungrounded** orphan (0 interventions) and also the
  **largest concern block** (15 mappings). Its block size makes it the highest-value
  future target, but it is **blocked**: actions cannot be fabricated, so intervention
  content must precede any route. Flagged, not papered over.
- "Reconcile to existing model" recommendations are **safe (no new route/product)** but
  are **not implemented this pass** — they remain for approval, consistent with the
  STOP-for-approval gate.
- The two Digital constructs are intentionally left unrouted: per approved scope, no
  Digital product is to be created, and routing them to Mentoring is deferred to a
  conscious product decision.
