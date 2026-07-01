---
name: Assessment Architecture Certification (CAPADEX 3.0 Phase 3.1)
description: Phase 3.1 is a READ-ONLY certification of the ONE canonical Assessment Architecture over EXISTING substrate — NOT gap-remediation; the 9 capability gaps remain OPEN additive work.
---

# Assessment Architecture Certification (CAPADEX 3.0 · Program 3 · Phase 3.1)

Flag `assessmentArchitectureCompletion` (`FF_ASSESSMENT_ARCHITECTURE_COMPLETION`), default OFF, byte-identical OFF incl. schema (zero DDL, reads-only).

## What it is
A CERTIFICATION deliverable mirroring CAPADEX 1.3–1.7 — NOT a build/remediation phase. It COMPOSES the frozen `config/assessment-framework.ts` into a pure-data canonical registry (`config/assessment-architecture.ts`: 13 architecture layers, 2 families CAPADEX+CAF, 10-type taxonomy + crosswalk, ONE 10-state lifecycle, governance controls, 18-field metadata standard, 15-step mapping model) and certifies it via a never-throws read-only composer (`services/assessment-architecture-engine.ts`) exposing FIVE INDEPENDENT axes — architecture · lifecycle · governance · metadata · repository-alignment — **NEVER composited**. Routes `routes/assessment-architecture.ts` (flag-gated `/enabled` probe + super-admin GETs). SSoT `scan.json` + generator writing ONLY from scan.json → 10 numbered docs + completion-certification at `backend/audit/program-3-phase-3.1-assessment-architecture/`. Verdict `ARCHITECTURE_COMPLETE_ADDITIVE_GAPS_PENDING`.

## The gaps are OPEN, not closed
**Why:** an earlier pass mislabelled Phase 3.1 as gap-remediation and shipped out-of-scope code (`psychometric-standardization.ts`, `prompt-registry-activation.ts`, `frontend/src/lib/offline.ts`, `frontend/src/lib/accessibility.ts`, `frontend/public/sw.js`, `manifest.webmanifest`) that was then REMOVED. All 9 capability gaps (GAP-AP-1..9: 0 Launch-Critical · 0 High · 5 Medium · 3 Low · 1 Future) are HONEST OPEN additive work over the FROZEN 13-layer architecture — none built, none blocks certification.
**How to apply:** never claim these gaps closed; any doc/memory saying "engineering-closed / foundation-shipped" is stale. The machine-verified truth is `scan.json`. `backend/audit/program-3-assessment-platform-blueprint/18-capability-gap-register.md` was corrected to report them OPEN — keep it consistent with scan.json if you regenerate.

## Traps
- **public-config is a dual import-site:** `routes/capadex.ts` `/public-config` must IMPORT `isAssessmentArchitectureCompletionEnabled` or the endpoint 500s (no tsc here).
- **`/enabled` = 503-before-auth when OFF** (flagGate runs first). The super-admin `/api/admin/assessment-architecture/*` routes return **401** when OFF because the GLOBAL `/api/admin` auth gate precedes the route-level flagGate — OFF smoke ∈ {401,403,503}, all honest.
- **null ≠ 0**: norms/benchmarks abstain (`dimension_source_absent`, gender `ethics_gated_off`, k_min=30) — never fabricate. Coverage⟂Confidence⟂Adoption reported separately; adoption is never a gap.
- Validate via esbuild parse (vite build pathologically slow); run scan + generator from `backend/` with `npx tsx`; NEVER pkill.
