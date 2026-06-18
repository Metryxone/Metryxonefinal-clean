---
name: CAPADEX Decision Orchestration (WC-6) — real-vs-stub reachability
description: Grounded real-vs-stub reality of the Journey→Decision→Product→GrowthPlan→Subscription(+Mentor) chain, correcting two WC-5 overstatements.
---

WC-6 audited the orchestration layer connecting the intelligence chain to products,
growth plans, subscriptions, and mentoring. Audit-only; deliverables in
`backend/audit/wc-6/`. Key durable findings (each verified against real code):

## The conductor is the gap, not the destinations
Most *destinations* are REAL; what's missing is an **orchestrator** that fans ONE
decision out to {product, action, growthPlan, mentor, subscription}, plus the
commercial glue. Don't plan to "build products from scratch" — plan to compose.

## Real-vs-stub corrections to the WC-5 audit (WC-5 was wrong on two)
- **Mentoring is REAL, not a stub** (WC-5 called it the weakest stub). DB-backed
  (`mentor_profiles`/`mentor_bookings`/`booking_messages`/`mentor_session_notes`),
  `/api/mentor-marketplace` + `/suggestions` (LBI domain-weakness → `mentor_type`) +
  book/messages/notes. Lives in `frontend/server/src/routes/mentor.ts`.
  **Caveat:** `/suggestions` reads `lbi_sessions`/`lbi_modules`, which the frontend/server
  schema comments mark "NOT YET IN LIVE DB" — logic real, live reliability not guaranteed.
- **M5 Growth Plan is REAL & assessment-connected** (WC-5 said "decoupled"). Table
  `m5_career_growth_plans`; `backend/services/m5-ai-coaching.ts` `growthPlan()`; routes
  `/api/m5/coach/growth-plan[/persist]`; `coachInput()` pulls `realUserScores()` via
  AssessmentWriter; segment-aware (`orgId`), persona-aware (`targetRoleId`).
  **Real remaining gap:** anchored to M-series role/competency scores, NOT the CAPADEX
  concern-journey decision → the missing piece is a journey→M5 bridge (one move improves
  the growth-plan story for all 6 segments).

## Subscription is the true weak link (and the rich schema is NOT where you'd guess)
- Live canonical `subscription_packages` (`backend/shared/schema.ts`) columns:
  `category, student_segment, product_name, is_recommended, domains_covered[], price,
  validity_days, question_count, report_type, sort_order, is_active`. **No**
  `tier/features/modules/max_students`. `frontend/server/src/db/schema.ts` **re-exports**
  the canonical table (not a separate rich def). A *different* richer SQL surface exists via
  `frontend/server` raw-SQL admin + `migrate.ts` (`subcategory/domain_config/
  subscription_type/highlights`) — but NOT the tier/features/modules/max_students set.
- **No decision→package mapping.** Packages carry a `student_segment` label +
  `is_recommended` flag, but nothing maps a detected outcome/journey to a package.
- **Entitlement is partial/non-blocking**, not absent: frontend `PLAN_ORDER` only; one path
  logs an outcome but allows the flow; no general server-side gate. Link table:
  `student_subscriptions` (student/child → package). Concrete hole: `POST
  /api/mentor-marketplace/:id/book` lacks `requireAuth` (books with null parent).
- **Institution = biggest commercial gap:** live table lacks `institution_id`/`max_students`
  → B2B seat enforcement non-functional; no institutional-admin persona. Highest revenue.

## Cross-server seam (real architectural prerequisite)
Intelligence chain (`backend/services/wc3/*`) + M5 live in `backend/` (8080); mentoring +
the richer subscription SQL live in `frontend/server/`. An orchestrator must resolve this
seam (canonical home / internal-call contract) before it can call mentor+subscription.

## Exam Aspirant inversion
Uniquely, the *packages* are real (ExamReadiness Index, EDGE) but the *product* is a stub +
corpus_pending — don't sell into a corpus_pending experience.
