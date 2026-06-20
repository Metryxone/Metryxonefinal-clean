# Career Matching Report — Phase 4.2

**Phase:** 4.2 — Career Match Engine
**Date:** 2026-06-20 · **Subject:** `demo_subj_pm`
**Flag:** `careerMatch` (default OFF) · **Route:** `routes/career-match.ts` · **Smoke:** `smoke-career-match.ts` → ✅ PASS
**Status:** Operational at engine/API level. Flag-gated, not deployed, not yet surfaced in user-facing UI.

## Purpose
Rank `cg_roles` against a subject to produce top role matches with a `match_percentage`, a `match_confidence`, and a `match_explanation`. **Match % (rank) and Confidence (evidential backing) are SEPARATE axes** — never composited.

## Deliverables
- `services/career-fit-engine.ts` — per-role fit decomposition.
- `services/career-match-engine.ts` — ranks roles → top matches.
- `career_matching_rules` (config-as-data: weights / caps / thresholds / templates + language policy) with admin CRUD.
- `career_match_history` (append-only snapshots) — migration `20260620_career_match.sql`.

## Composition (compose-only)
Consumes **4.3 Career Readiness**, competency profiles, and the EI profile. Does **not** re-derive any upstream score.

## Honesty constraints (verified)
- `cg_roles` has **no per-role requirement rows** → only the **anchor** role match is requirement-backed. Every other match is **capped at Provisional** regardless of Match %. This is the central honesty rule for 4.2.
- Match % expresses rank/ordering; confidence expresses how well the role is actually backed by requirement data.
- Outputs are developmental/fit signals, never hiring/suitability predictions (language policy enforced in templates).

## Contract compliance
- Flag-OFF → 503, byte-identical (no DDL, no writes).
- Flag-ON → 401 without auth (gate + auth both enforced); cross-subject blocked (super-admin / IDOR guard).
- GET-never-writes; never-throws; append-only history (smoke proved exactly one new row, then cleaned up).

## Smoke evidence (2026-06-20)
✅ PASS — append-only: exactly one new row; smoke rows cleaned up; dev DB pristine.

## Honest gaps
- Requirement coverage on `cg_roles` is the binding limitation — until per-role requirements exist, non-anchor matches stay Provisional by design.
- Not consumed by any user-facing screen yet (no frontend wiring of `/api/career-match`).
