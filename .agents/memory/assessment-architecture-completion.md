---
name: Assessment Architecture Completion (CAPADEX 3.0 Phase 3.1)
description: Phase 3.1 certifies the ONE canonical Assessment Architecture over EXISTING substrate AND engineering-closes all 9 capability gaps (AP-1..9) via REUSE-before-build; adoption is a separate axis, never fabricated.
---

# Assessment Architecture Completion (CAPADEX 3.0 · Program 3 · Phase 3.1)

Flag `assessmentArchitectureCompletion` (`FF_ASSESSMENT_ARCHITECTURE_COMPLETION`), default OFF. Byte-identical OFF **incl. schema** — DDL runs ONLY on the flag-gated write paths (the mechanism POSTs), never at read time.

## What it is
A CERTIFICATION deliverable mirroring CAPADEX 1.3–1.7 that ALSO engineering-closes the 9 gaps. It COMPOSES the frozen `config/assessment-framework.ts` into a pure-data canonical registry (`config/assessment-architecture.ts`: 13 architecture layers, 2 families CAPADEX+CAF, 10-type taxonomy + 22-entry crosswalk, ONE 10-state lifecycle, 7 governance controls, 18-field metadata standard, 15-step mapping model) and certifies it via a never-throws read-only composer (`services/assessment-architecture-engine.ts`) exposing FIVE INDEPENDENT axes — architecture · lifecycle · governance · metadata · repository-alignment — **NEVER composited**. Routes `routes/assessment-architecture.ts` (flag-gated `/enabled` probe + super-admin cert GETs + mechanism GET/POST). SSoT `scan.json` + generator writing ONLY from scan.json → 10 numbered docs + completion-certification at `backend/audit/program-3-phase-3.1-assessment-architecture/`. Verdict `STRUCTURAL_COMPLETE_ADOPTION_PENDING`; architecture certifies **13/13 SUPPORTED · 0 OPEN gaps**.

## The 9 gaps are ENGINEERING-CLOSED via REUSE (not OPEN)
**Why:** the user asked to "fix these to 100%". All nine former additive gaps (AP-1..AP-9) now have a real mechanism behind the flag, built reuse-before-build over EXISTING engines/tables — NOT a new engine per gap.
- `ARCHITECTURE_GAPS = []` (0 open), `RESOLVED_ARCHITECTURE_GAPS` = 9 in `config/assessment-architecture.ts`.
- L6 Norms + L7 Standardization + prompt_governance control flipped PARTIAL→SUPPORTED.
- Mechanisms: `services/assessment-architecture-mechanisms.ts` (`computeGroupNorms`/`classifyClarityBloom`/`registerCountryCohort`, `ASSESSMENT_NORM_K_MIN=30`), `services/psychometric-standardization.ts` (`standardScoresFromZ` T M=50/SD=10, stanine, sten; legacy SD=15 relabelled `deviation_score`), `services/prompt-registry-activation.ts` (`registerCodeEmbeddedPrompts`/`resolvePrompt` over `aig_prompts`/`aig_prompt_versions`), `frontend/src/lib/offline.ts`+`public/sw.js` (AP-2), `frontend/src/lib/accessibility.ts` (AP-3) wired flag-gated in `main.tsx`+`FreeAssessmentModal.tsx`.
**How to apply:** `classifiedGaps()` returns `resolved_gaps/resolved_gap_counts/resolved_gap_count`; scan emits them; generator's required-key list + deliverable 10 render them. If you regenerate, re-run scan THEN generator. Keep `18-capability-gap-register.md` consistent with scan.json (it now reports RESOLVED, not OPEN).

## Engineering closure ⟂ Adoption (the honesty invariant)
The mechanism EXISTS for every gap, but real norm/offline/audit/prompt DATA volume is honest-low/0 in dev. Adoption is a SEPARATE usage axis — **never a gap, never fabricated as adopted**. Norms/benchmarks ABSTAIN (`dimension_source_absent`, gender `ethics_gated_off` via `ASSESSMENT_GENDER_NORMS_ENABLED`, k_min=30). Coverage⟂Confidence⟂Adoption never composited; null≠0.

## Traps
- **public-config is a dual import-site:** `routes/capadex.ts` `/public-config` must IMPORT `isAssessmentArchitectureCompletionEnabled` or the endpoint 500s (no tsc here).
- **`/enabled` = 503-before-auth when OFF** (flagGate first). The super-admin `/api/admin/assessment-architecture/*` routes return **401** OFF because the GLOBAL `/api/admin` auth gate precedes route-level flagGate — OFF smoke ∈ {401,403,503}.
- **DDL only on POSTs:** the mechanism POST endpoints (`/norm-groups/compute`, `/bloom/classify`, `/prompts/register`, `/country-cohorts/register`) are the ONLY DDL sites; cert GETs are to_regclass/fs probes. Flag-OFF is byte-identical incl. schema.
- Validate via esbuild parse (vite build pathologically slow); run scan + generator from `backend/` with `npx tsx`; NEVER pkill.
