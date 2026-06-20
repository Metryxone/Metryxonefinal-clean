# Career Passport Report — Phase 4.9

**Phase:** 4.9 — Career Passport Foundation
**Date:** 2026-06-20 · **Subject:** `demo_subj_pm`
**Flag:** `careerPassportFoundation` (default OFF) · **Route:** `routes/career-passport-foundation.ts` · **Smoke:** `smoke-career-passport-foundation.ts` → ✅ PASS
**Status:** Operational at engine/API level. Flag-gated, not deployed, not yet surfaced in user-facing UI.

## Purpose
Produce a publishable "career passport" snapshot for a subject — a curated, share-safe projection of readiness / signals / development — under a strict privacy contract.

## Composition (compose-only)
Composes the 4.x chain (readiness, gap, signals, development) into a section-whitelisted snapshot. Reuses the existing passport bridge/generator infrastructure rather than rebuilding it.

## Deliverables
- `services/passport-generator.ts` / `passport-profile.ts` (+ existing `career-passport-*` infra)
- `routes/career-passport-foundation.ts`
- `migrations/20260620_career_passport_snapshots.sql` (append-only `career_passport_snapshots`)
- `careerPassportFoundation` flag

## Privacy / honesty constraints (verified by smoke)
- **Contact is NEVER published** — smoke verified contact patterns are replaced with explicit redaction markers.
- **No raw free-text body field is carried through** — only whitelisted, structured sections.
- Section visibility gates what a public share read can return.
- Absent sections are reported as absent, never fabricated.

## Contract compliance
- Flag-OFF → 503, byte-identical including schema (before any DB touch). Flag-ON → 401 without auth. IDOR closed via super-admin.
- GET-never-writes; never-throws; append-only snapshots.

## Smoke evidence (2026-06-20)
✅ PASS — no raw free-text body carried through; contact patterns replaced with explicit redaction markers.

## Honest gaps
- Snapshot richness is bounded by upstream chain coverage for the subject.
- Not consumed by any user-facing screen yet (no frontend wiring of `/api/career-passport-foundation`).
