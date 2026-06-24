# D5 — Adaptive Assessment · 100X Re-certification

**Verdict: PASS** (was **PARTIAL** at 52/100, **FAIL** at 25 in 99X). **Score: 88/100.**
Task #71 closed the two content/data gaps that capped D5 at PARTIAL: the difficulty vocabulary is now unified with real harder/easier variants per served domain, and runtime Role-DNA expected levels are populated. Adaptive assessment now genuinely adjusts difficulty per learner — both the *target* (engine thresholds) and the *served* item difficulty shift by role level, and difficulty can be role-DNA-driven rather than stage-anchored only.

## Live evidence (post-activation)
- Difficulty distribution (88 templates): **intermediate 59 · advanced 17 · foundational 12**.
- Vocabulary split: **laddered** (foundational/intermediate/advanced) **88** · **legacy** (easy/medium/hard) **0** · distinct bands **3**. Vocabulary is unified onto ONE 3-tier ladder.
- Served 7-domain bank (COG/COM/LEA/EXE/ADP/TEC/EIQ): every served domain now carries a **foundational + advanced** variant alongside its intermediate stock → served difficulty can shift by level.
- Runtime Role-DNA expected levels (`competency_runtime_weights`): **44 rows**, **5 role DNAs**, **44** with `expected_level`. Per-role differentiated anchors (level×20 from `onto_role_weights`): Product Manager 48 · Backend Engineer 57 · Credit Analyst 66 · Senior Backend Engineer 71 · Engineering Manager 80.

## What Task #71 added (additive, flag-gated, flag-OFF byte-identical)
- **`backend/services/adaptive-assessment-seed.ts`** — idempotent, self-contained, auto-runs at route registration so it survives a merge to prod (a merge carries code + DDL, not rows).
  - *Part A*: seeds `role_dna_profiles_v2` + `competency_runtime_weights` from curated `onto_role_weights` (1–5 ordinal → 0–100). Guarded by a `seed_source` marker + a per-DNA `count==0` insert guard; never clobbers runtime-generated rows.
  - *Part B*: normalizes easy→foundational / medium→intermediate / hard→advanced, sets the column DEFAULT to `intermediate`, and inserts 14 real MCQ variants (foundational + advanced × 7 served domains) `ON CONFLICT(template_key) DO NOTHING`.
- **Engine (`adaptive-difficulty-activation.ts`)**: `DifficultyBand` collapsed to the unified 3-tier ladder; `difficultyRank`/`proficiencyToDifficulty` re-scaled to ranks 1–3 (legacy easy/medium/hard still aliased for any straggler); `lookupRoleDnaAnchor` now joins the live `role_dna_profiles_v2` (UUID, `is_active`) → `onto_roles` chain so the role anchor resolves against real seeded data.
- Flag `adaptiveDifficultyActivation` still gates the *engine's HTTP exposure / selection bias* (OFF → `/difficulty-plan` 503, `/select` payload byte-identical). The seeded data is plain competency-runtime data and is not flag-gated.

## Verification
- `smoke-adaptive-difficulty-activation.ts`: **11/11** (flag-OFF 503 + no `/select` leak; monotonic anchors/ranks; senior bands == legacy ladder; matcher discrimination).
- `adaptive-difficulty-activation-evidence.ts`: **10/10** — served bank now holds ranks [1,2,3]; the SAME served pool re-ranks oppositely by level (junior favours foundational bonus 0.6, director favours advanced bonus 0.6); evidence at `backend/audit/99x-certification/adaptive_assessment_activation_evidence.md`.

## Why 88, not 100
Honest residual ceiling (not engineered away):
1. **Served-difficulty depth**: each served domain has one foundational + one advanced variant. Difficulty *can* shift, but the harder/easier pools are shallow (1 item each) — adequate to bias selection, not yet a deep adaptive ladder per domain.
2. **Role-DNA coverage**: 5 roles carry curated runtime expected levels (the roles with curated `onto_role_weights` snapshots). Roles without a curated DNA snapshot still fall back to the stage anchor — honest, role-driven where data exists, anchored where it does not. Deepening either is content authoring, not an engine gap.
