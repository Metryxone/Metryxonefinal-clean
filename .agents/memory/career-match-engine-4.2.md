---
name: Career Match Engine (Phase 4.2)
description: Why Match% and match-confidence must stay orthogonal when ranking the cg_roles catalog, and how the requirement-less catalog caps every non-anchor match at Provisional.
---

# Career Match Engine (Phase 4.2)

Additive, flag-gated (`careerMatch`, env `FF_CAREER_MATCH`, default OFF), compose-only
layer that ranks the live `cg_roles` catalog into a subject's top role matches. It
COMPOSES the already-built profiles (competency `getProfile`, EI `buildEiProfile`,
4.3 `buildCareerReadiness`, role-readiness-v2 `computeRoleReadinessV2`) and NEVER
recomputes their scores. Same chain discipline as its 4.x siblings (flag-OFF
byte-identical incl. schema, GET-never-writes behind `competencyRuntimeReady()`,
super-admin IDOR guard, never-throws).

## The core honesty constraint — requirement-less catalog
`cg_roles` carries NO per-role competency REQUIREMENTS (it has demand/automation/
growth/salary/function/seniority, not a required-competency vector). Therefore a
requirement-backed fit can be computed for exactly ONE role: the subject's ANCHOR
role (role-readiness-v2 already produced its `role_match` against real requirements).

**Rule:** every NON-anchor match is honestly `Provisional` — its score comes only
from capability supply + categorical (function/seniority) alignment, not from any
real requirement comparison. The cap is `caps.max_non_anchor_confidence='Provisional'`.

**Why:** a high Match% on a non-anchor role is a *ranking* signal, not evidence the
subject MEETS that role's requirements (there are none to meet). Upgrading its
confidence because the percentage is high would fabricate certainty the data can't support.

**How to apply:** keep Match% (rank/percentage axis) and match_confidence
(requirement-backing axis) as SEPARATE fields, never composited. Only the anchor row
may carry `requirement_backed:true`; `summary.requirement_backed_count` is therefore
≤1. If `cg_roles` ever gains a real per-role requirement vector, that is the lever
that lifts non-anchor matches above Provisional — not a weighting tweak.

## Other notes
- Anchor↔catalog linkage is by TITLE (exact, then >2-char token overlap, ≥1 hit),
  mirroring 4.7; never fabricates a match when nothing overlaps.
- `DEFAULT_MATCHING_RULES` is the inline source of truth (no seed needed flag-ON);
  `career_matching_rules` is an OPTIONAL admin override row (to_regclass probe →
  defaults fallback on read; the admin CRUD/seed is the only config write/DDL path).
- Per-component weights renormalize over PRESENT components only (absent component
  ≠ a zero) — see `career-fit-engine.ts` `computeRoleFit`.
