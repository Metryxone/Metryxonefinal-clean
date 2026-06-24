---
name: Enterprise Certification (MX-105X)
description: Top-level read-only flag-gated composer unifying candidate+employer journeys + enterprise certification over existing engines.
---

# Enterprise Certification & Platform Activation (MX-105X)

A THIN top-level composer (`backend/services/enterprise-certification.ts`, VERSION 105.0.0,
ENTERPRISE_K_MIN=30) that aggregates already-built engines into ONE unified enterprise
certification. Flag `enterpriseCertification` (env `FF_ENTERPRISE_CERTIFICATION`), default OFF.

## What it composes (never recomputes)
- `ecosystem-activation.certification` (candidate journey)
- `employer-ecosystem-audit-engine.runEmployerEcosystemAudit` (employer 9-stage funnel)
- `outcome-intelligence-engine.composeOverview` (MX-102X six-type outcomes)
- light `to_regclass` + `SELECT count` probes for competency/role-DNA/O*NET/validation/report-factory.

Views: `unifiedJourney` · `outcomeReadiness` · `commandCenter` (12 health cats) ·
`founderCommandCenter` (12 metrics) · `recertification` (15 subsystems, 4 axes) · `overview`.

## The rule that matters
**Four axes are SEPARATE and never composited:** Structural (required tables present) ⟂
Activation (gating flag on) ⟂ Adoption (live rows) ⟂ Outcome-Confidence
(calibrated/provisional/abstained). The headline **verdict is STRUCTURAL-ONLY**
(`verdict_axis:'structural'`, ≥90% PASS / ≥60% PARTIAL); activation/adoption/outcome-confidence
are reported alongside. `null` = not measurable, NEVER a fabricated 0.

**Why:** an enterprise cert that folds activation/adoption into the structural verdict would
report "ready" off scaffolding alone, or "not ready" off honest 0-adoption — both lie. Live run
(all FF on): 100% structural (24/24 tables), 15/15 PASS, but only 8/15 activated and 8/15 adopted,
outcome-confidence abstained — the divergence between axes IS the honest signal.

## Traps
- **GET-only / compose-never-recompute:** zero DDL, zero writes. Every sub-call wrapped in
  `safe()` → degrade null (composer NEVER throws).
- **Global `/api/admin` auth gate** (routes.ts) intercepts BEFORE the route-level flagGate, so
  unauth OFF → 401 (not 503); authed + flag-OFF → 503. Matches platform precedent; smoke asserts {401,403,503}.
- Frontend `/enabled` probe (`res.ok`) conditionally spreads the nav tab + gates render — hidden when OFF.
- Report Factory got a genuinely-missing 7th type **`employer`** (Employer Match): additive only —
  `ReportType` union + narrative/insight/viz seeds keyed `report_types:['employer']` reusing
  `data_source:'any'` (NO new compute path), all `ON CONFLICT DO NOTHING`. Report Factory is NOT flag-gated.
- Validation script `scripts/mx105x-recertification.ts` → `audit/mx-105x/recertification-report.md`:
  read-only, prints process flag state, masks any stray email to `user_masked`.
