# CAPADEX WC-6 — Decision Orchestration Audit

**Phase type:** DESIGN + AUDIT only. No implementation, no schema/migration, no code.
**STOP for approval.**

WC-6 audits the **orchestration layer** that should connect the chain:

```
Journey → Decision → Product → Growth Plan → Subscription   (+ Mentor)
```

…by composing the already-built layers (L1 Stage, L2 Outcome, L3 Journey, L5A/L5B
Question Intelligence, Product Routing, **M5 Growth Plans**). It measures five
reachabilities — **Action, Product, Growth Plan, Subscription, Mentor** — for six
segments (School Student, College Student, Job Seeker, Parent, Exam Aspirant,
Institution).

---

## How this was grounded (no assumptions)

Every claim is verified against the **actual code**. WC-6 ran two fresh exploration
passes (M5 growth plans + mentor reachability; subscription/entitlement/segment glue) on
top of the WC-5 grounding. Where WC-5 was wrong, WC-6 **corrects it explicitly** (below).

**Primary evidence (files):**
- Growth plans: `m5_career_growth_plans` (migration `20260620_enterprise_workforce_phase5.sql`); `backend/services/m5-ai-coaching.ts` (`createAICoach()/growthPlan()/generateGrowthRoadmap()`); `backend/routes/m5-enterprise-workforce.ts` (`/api/m5/coach/growth-plan[/persist]`, `coachInput()`/`realUserScores()` bridge via `AssessmentWriter`).
- Mentoring: `frontend/server/src/routes/mentor.ts` (`/api/mentor-marketplace`, `/suggestions`, `/book`, `/messages`, `/notes`); tables `mentor_profiles` + `users`; `frontend/src/pages/MentorMarketplacePage.tsx`; L3 target `/mentors` (`wc3-schema.ts`).
- Subscriptions: live `subscription_packages` in `backend/shared/schema.ts` (columns `category, student_segment, product_name, is_recommended, domains_covered[], price, validity_days, question_count, report_type, sort_order, is_active`); `student_subscriptions` link table; admin CRUD/seed/stats in `backend/routes.ts`.
- Intelligence chain (from WC-5): `backend/services/wc3/*`, `backend/routes/capadex.ts`, Action layer `intervention-intelligence-engine.ts` / `recommendation-builder.ts`.

---

## ⚠️ Corrections to the WC-5 audit (honesty reconciliation)

WC-5 is approved/merged; these are stated here rather than retro-edited so WC-6 is honest:

1. **Mentoring is REAL, not a STUB.** WC-5 called mentoring a stub and "the weakest
   surface." Verified: it is DB-backed (`mentor_profiles`, `mentor_bookings`,
   `booking_messages`, `mentor_session_notes`) with **assessment-driven matching**
   (`/suggestions` builds a domain-weakness map from a child's LBI scores → `mentor_type`)
   and a full booking/messaging/notes lifecycle. This materially **raises** the product
   floor — the universal fallback route lands on a *real* product, not a stub.
   **Runtime caveat:** `/suggestions` depends on `lbi_sessions`/`lbi_modules`, which the
   `frontend/server` schema comments flag as drifted / "NOT YET IN LIVE DB" — so the
   *logic* is real, but live-DB reliability of the matching path is not guaranteed.
2. **Subscription schema is simpler than WC-5 stated — and the "rich schema" lives
   elsewhere than WC-5/first-draft implied.** The **live** canonical table
   (`backend/shared/schema.ts`) has no `tier`/`features` JSONB/`modules`/`max_students`.
   `frontend/server/src/db/schema.ts` **re-exports the canonical table** (it is *not* a
   separate rich table). A different richer SQL surface does exist — via
   `frontend/server` raw-SQL admin routes + `migrate.ts` (columns like `subcategory`,
   `domain_config`, `subscription_type`, `highlights`) — but **not** the
   `tier/features/modules/max_students` set. The live table **is segment-aware** via a
   `student_segment` label and has an `is_recommended` flag and real seeded packages — but
   lacks the B2B columns WC-5 implied.
3. **M5 Growth Plan is REAL and assessment-connected** (WC-5 said "decoupled"). It pulls
   `realUserScores()` via `AssessmentWriter`, is segment-aware (`orgId`) and persona-aware
   (`targetRoleId`). **Remaining nuance:** it is anchored to **M-series role/competency
   scores**, not yet to the **CAPADEX concern-journey** decision output — so a *bridge*
   from the CAPADEX journey into M5 inputs is still the real gap, not the plan itself.

---

## Deliverables (this folder) — maps to the 6 requested outputs

| # | Requested output | File |
|---|------------------|------|
| — | Executive Summary | this file (below) |
| 1 | Decision Orchestration Architecture | `WC6_ORCHESTRATION_ARCHITECTURE.md` |
| (audit) | 5 Reachability Audits × 6 segments (Current/Target/Gap/Business Impact) | `WC6_ORCHESTRATION_ARCHITECTURE.md` |
| 2 | Product Activation Matrix | `WC6_MATRICES.md` |
| 3 | Growth Plan Matrix | `WC6_MATRICES.md` |
| 4 | Mentor Recommendation Matrix | `WC6_MATRICES.md` |
| 5 | Subscription Readiness Matrix | `WC6_MATRICES.md` |
| 6 | CAPADEX Decision Orchestration Roadmap | `WC6_ROADMAP.md` |

---

## Executive Summary

**Headline verdict:** The orchestration story is **better than WC-5 implied — most
*destinations* are real; what's missing is the *orchestrator* and the *commercial glue*.**
With mentoring and M5 growth plans both verified REAL (and library-backed Action already
real), **4 of the 5 reachability endpoints have a working destination**. The genuine
gaps are: (a) **no Decision Orchestrator** that fans a single journey/decision out to
product + plan + mentor + subscription; (b) **a CAPADEX-journey → M5-growth-plan
bridge** (M5 reads M-series scores, not the concern-journey decision); (c) **no
decision→subscription mapping and no backend entitlement enforcement**; (d) a
**cross-server seam** (mentoring + the rich subscription schema live in `frontend/server`,
while the intelligence chain + M5 live in `backend/`).

**Reachability scorecard (system-wide, grounded):**

| Reachability | Destination reality | Orchestration reality | Verdict |
|--------------|--------------------|----------------------|---------|
| **Action** | REAL (intervention + recommendation, library-backed) | Produced post-session; not fanned into product deep-links | **Reachable, not orchestrated** |
| **Product** | LBI REAL · Mentoring REAL · Career Builder PARTIAL · Employability Index / Competitive-Exam STUB | Routing real (L3); activation/deep-link missing | **Partially orchestrated** |
| **Growth Plan** | M5 REAL (persists, segment/persona-aware) | Anchored to M-series scores; no CAPADEX-journey → M5 bridge | **Reachable, not wired to the decision** |
| **Subscription** | Billing CRUD + seeded segment-labelled packages REAL | No decision→package mapping; entitlement only partial/non-blocking; schema disconnect | **Weakest link** |
| **Mentor** | REAL (DB-backed, assessment-driven matching, full lifecycle) | Matching keys off LBI scores directly, not off the unified decision | **Reachable, near-orchestrated** |

**The orchestration gap in one sentence:** CAPADEX has the **endpoints** (route, plan,
mentor-match, packages) but no **conductor** — nothing takes one decision and
deterministically activates the right product, plan, mentor, and subscription for the
segment, then enforces it.

**Highest-leverage moves (full set in `WC6_ROADMAP.md`):**
1. **Decision Orchestrator** (compose-only, additive, flag-gated) — one journey/decision → a structured `activation` envelope {product, growthPlan, mentor, subscription} with confidence + honest "not-ready" markers.
2. **CAPADEX-journey → M5 growth-plan bridge** (map journey/outcome to `coachInput()` so the real plan engine runs from the concern decision).
3. **Decision → subscription mapping** over the existing `student_segment` + `is_recommended` fields (recommend, don't hardcode).
4. **Backend entitlement enforcement** (`requireSubscription`/module gate) — today
   enforcement is partial/non-blocking (e.g., the exam-ready path logs the outcome but
   still allows the flow) with no general gate; the unauthenticated mentor `/book`
   endpoint (creates bookings with a null parent) is a concrete access-control hole.
5. **Cross-server seam decision** — pick the canonical home for mentoring + subscription so the orchestrator can call them without a `frontend/server` ↔ `backend` split, and reconcile the subscription schema.

**Segment one-liners:**
- **School Student / Parent** — strongest today (LBI real + mentor matching off LBI scores); needs decision→subscription + entitlement.
- **Job Seeker / College Student** — M5 growth plan is the real asset; needs the journey→M5 bridge + an Employability product.
- **Exam Aspirant** — *commercially* packaged (ExamReadiness Index, EDGE are real packages) but the *product* is a stub + corpus_pending — a rare case where the subscription is more ready than the product.
- **Institution** — biggest gap: no institutional-admin persona, and the live subscription table lacks `institution_id`/`max_students`, so B2B enforcement is non-functional despite being the highest-revenue segment.

**Scope reminder:** audit/design only. No code/schema/migrations changed. Everything below
is a proposal for a future approved build phase, to be built with WC-3 discipline
(additive · compose-only · flag-gated default OFF · byte-identical when OFF · never fabricate).
