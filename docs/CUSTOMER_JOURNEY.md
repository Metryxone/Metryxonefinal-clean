# MetryxOne — Canonical Customer Journey Model (CAPADEX 3.0 · Program 1 · Phase 1.4)

> **Single source of truth** for "what customer journeys exist, who they serve, and how complete they are."
> Machine-readable registry: `backend/config/customer-journey.ts`. Measured numbers: the read-only scan
> `backend/scripts/capadex-1.4-customer-journey-scan.ts` → `backend/audit/capadex-3.0-customer-journey/scan.json`.
> Detail deliverables: `backend/audit/capadex-3.0-customer-journey/01..12 + completion-certification.md`.

## What this is
ONE canonical Customer Journey Model that maps **every** persona journey to eight axes
(persona · lifecycle · assessment · AI · reports · dashboards · outcomes · KPIs), grounded in the
FROZEN journey blueprint `backend/audit/capadex-3.0-product-blueprint-final/09_CUSTOMER_JOURNEY_BLUEPRINT.md`.
It is **enhancement-only**: a pure-data registry + read-only composer over the EXISTING journey/orchestration
engines, tables, and UIs. **No new journey engine, no V2, no duplicate journey, no journey re-decision.**
Multiple entrances to ONE flow are KEEP_ALL decisions — not duplicates.

## Flag (default OFF, byte-identical including schema)
- `customerJourneyCompletion` / `FF_CUSTOMER_JOURNEY_COMPLETION` — getter `isCustomerJourneyCompletionEnabled()`.
- OFF → `/api/customer-journey/*` data routes 503; public-config `customer_journey_completion:false`;
  zero DDL (the composer only READS — `to_regclass` probes + filesystem checks).

## API (read-only)
- `GET /api/customer-journey/enabled` — flag probe (503 when OFF).
- `GET /api/admin/customer-journey/model` — the canonical spine + templates + per-persona journeys + axes.
- `GET /api/admin/customer-journey/coverage` — per-journey evidence verified vs live FS+DB + spine reachability.
- `GET /api/admin/customer-journey/gaps` — classified journey gaps.
- `GET /api/admin/customer-journey/summary` — rollup + enterprise-ready verdict.
- `GET /api/admin/customer-journey/outcome-tail` — close-the-loop ADOPTION (Adoption⟂Coverage, never composited).
- `GET /api/admin/customer-journey/outcomes/persona` — persona⟂outcome read-time-join linkage (k-anon suppressed).
- Admin routes: flag-gate 503 → `requireAuth` → `requireSuperAdmin`; never-throws (200-degraded).

## The canonical spine (FROZEN, 8 steps)
`registration → entry_assessment → ai_diagnose → recommend → learn_act_grow → reports → outcome_capture → re_measure`.
The front-half (registration→reports) is broadly SUPPORTED across personas; the universal close-the-loop tail
(outcome_capture / re_measure) is the cross-cutting `outcome_tail` journey, instrumented via REUSE of the
Phase-1.3 progression-outcome-capture hook (no new engine/table).

## Reusable journey templates (5)
`T1` Assess→Diagnose→Recommend→Grow (individual growth) · `T2` Assess→Diagnose→Recommend→Apply (placement) ·
`T3` Configure→Assess→Match→Decide (employer/hiring) · `T4` Aggregate→Benchmark→Act (institution roll-up) ·
`T5` Observe→Support (support persona tail).

## Per-persona journeys (12)
Employer/institution → individual learner → support → cross-cutting tail. Each journey carries its persona codes,
adopted template, the canonical spine steps it actually reaches today, all 8 axis mappings, and REUSED-capability
evidence (services/routes/tables/frontend) verified against the live repo. See deliverable 02 (Inventory) and 03
(Persona ↔ Journey Matrix) for the full register.

## The four honesty axes (never composited)
- **Coverage** — does an implementation of the journey step EXIST (verified vs live FS+DB). `null` (unknown/unreadable) ≠ `0` (measured-absent).
- **Confidence** — is the evidence trustworthy/sufficient.
- **Outcome** — realized-outcome attribution (per-persona, read-time join, k-anon suppressed at k_min=30).
- **Adoption** — how much the close-the-loop outcome tail is actually EXERCISED (gated by `longitudinalOutcomeCapture`; currently honest-low/0).

## Enterprise-ready verdict
**STRUCTURAL_COMPLETE_ADOPTION_PENDING.** ONE canonical model; every persona journey mapped to all 8 axes and
verified against the live repo; the front-half broadly SUPPORTED and the universal outcome-tail mechanism
CODE-COMPLETE via reuse (zero DDL). What remains is ADOPTION (real re-administration/outcome volume) plus
classified residual gaps: ONE true dead-end (teacher/counsellor, GAP-J1), thin support/engagement tails
(GAP-J2/J3), and minor frontend CTA/redirect/orphan items (GAP-J4/J5/J6). No Launch-Critical journey gap.

## Regenerate
From `backend/`: `npx tsx scripts/capadex-1.4-customer-journey-scan.ts` (re-measure) then
`npx tsx scripts/capadex-1.4-generate-deliverables.ts` (re-emit the 12 deliverables + certification, scan-locked).
