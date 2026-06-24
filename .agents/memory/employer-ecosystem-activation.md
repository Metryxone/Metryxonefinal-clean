---
name: Live Employer Ecosystem Activation (MX-103X)
description: Flag-gated read-only audit/cert of the 9-stage employer hiring funnel; substrate reachability must AND required tables, deliverable must reflect WORKFLOW flag state not a bare run.
---

# Live Employer Ecosystem Activation (MX-103X)

Read-only, flag-gated (`liveEmployerEcosystem` → `FF_LIVE_EMPLOYER_ECOSYSTEM`, OFF byte-identical incl. zero DDL) audit + certification composer over the 9-stage employer funnel: Onboarding → Create Job → Role DNA → Competencies → Assessment → Candidate Match → Interview → Hiring Decision → Outcome Tracking. Engine `services/employer-ecosystem-audit-engine.ts`, routes `routes/employer-ecosystem.ts` (`/api/admin/employer-ecosystem/{enabled,audit,certification}`), panel `superadmin/EmployerEcosystemPanel.tsx`. Deliverables `backend/audit/mx-103x/{01_employer_funnel_audit,02_founder_report}.md`.

## Substrate reachability must AND required tables, not OR-any
A stage whose `substratePresent` is `tables.some(present)` OVERSTATES reachability when the stage genuinely needs several tables. Fix: each stage table is `string` (required) or `[name, false]` (optional/enriching); `substratePresent = requiredTables.every(present)` (fallback to `some()` only when a stage declares NO required table). Optional/enriching tables (blueprint sources, calibration targets, offers/recs) must NOT gate reachability — only the stage's terminal proof table is required (e.g. stage7 interviews required + assessments optional; stage8 candidates required + assessments/offers optional; stage9 realized outcomes required + tig_calibration optional).
**Why:** OR-any silently certifies a stage as reachable on the strength of an unrelated present table. Current live DB has all 15 tables present so the verdict was unaffected, but the logic was dishonest in principle (architect catch).

## The deliverable must reflect the WORKFLOW flag state, not a bare `tsx` run
The audit script reads flags from its OWN `process.env`. A bare `npx tsx scripts/mx103x-audit.ts` does NOT inherit the Backend API workflow's `FF_*` overrides, so most stage flags read OFF → `gated=7` — a MISLEADING deliverable. Regenerate the founder/audit deliverables by PREFIXING the same `FF_*` the workflow command sets (the 8 employer flags + `FF_EMPLOYER_COMPETENCY_HIRING`; defaults already-ON: `adaptiveIntelligenceFoundation`, `roleDNARuntimeEnabled`, `validationLoop`). Activated state = `operational=2/9, demoOnly=4, empty=3, gated=0, gap=0`, verdict PARTIAL (outcome confidence abstains).
**Why:** file-registry flags are env-only; a standalone audit process is a different env from the running server. Certifying "gated=7" would falsely report the funnel as un-activated when the live workflow has it fully reachable.
**How to apply:** any future MX-103X re-run that writes the committed `.md` deliverables must run with the workflow `FF_*` prefix; the smoke script (`mx103x-smoke.ts`) sets its own flags in-process and asserts gated=0/gap=0, so it is the authoritative reachability proof.

## Honesty axes
Coverage (flag ON + required substrate present) ⟂ Confidence (real non-demo rows; calibration ≥ k_min=30) are NEVER composited. Demo rows (`@example.com` / `validation_loop_outcomes.is_demo`) counted separately and EXCLUDED from the confidence axis. Outcome confidence ABSTAINS (`calibrated=false`) until ≥30 realized non-demo outcomes accrue → PARTIAL is the honest pre-launch verdict, never inflated to OPERATIONAL. GET handlers are read-only (to_regclass probes, no ensure-schema DDL); flag gate trips BEFORE any work (503 OFF).
