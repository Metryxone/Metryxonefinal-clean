---
name: Career Intelligence Activation (MX-100X Phase 6)
description: Activating the Phase-4 career-intelligence bridge as the PRIMARY competency-driven driver of Career Builder scores via a frontend useCareerBrain adoption + a read-only activation endpoint.
---

# Career Intelligence Activation (MX-100X Phase 6)

## What it is
The Phase-4 bridge `services/career-intelligence-bridge.ts` (`buildCareerIntelligence`) already
composes competency-driven readiness/growth/gaps/planning from the MEASURED competency profile, but the
frontend central aggregator `useCareerBrain` IGNORED it — it derived careerReadiness/skillGaps from
EI + completeness heuristics + a keyword-family `deriveSkillGaps`, so surfaced scores did NOT trace to
the competency profile. Phase 6 wires the bridge in as the PRIMARY driver, additively and reversibly.

## Shape
- Pure `buildActivationScores(profile, role, history)` + an `activation_scores` envelope field on the
  bridge. FOUR scores, compose-only (never recompute): `career_readiness` (role_readiness_v2 score/band),
  `career_growth` (EI `growth_potential` score/level), `role_progression` (measured EI-history trajectory),
  `skill_gap` (role_gap severity pressure `clamp100(100·Σgap/Σrequired)`). Each `{measurable,value,band,provenance,note}`.
- NEW flag `careerIntelligenceActivation` (`FF_CAREER_INTELLIGENCE_ACTIVATION`, default OFF), separate
  from Phase-4's `careerIntelligence` enrich.
- NEW read-only GET `/api/career/competency-activation/:userId`, order: flag-503 → requireAuth →
  `resolveEffectiveUserId` IDOR → `competencyRuntimeReady(pool)` probe → `buildCareerIntelligence`.
- Frontend `useCareerBrain` best-effort fetch; adopt as PRIMARY careerReadiness/skillGaps (+ new
  growth/progression/skillGap fields + `competencyActivation`) ONLY when `d.ok && d.measurable && d.scores`.

## Traps / rules (the durable lessons)
- **Role progression needs a real prior series**: require `≥2` snapshots that are non-null AND
  `Number.isFinite(Number(ei_score))` — a non-finite stored score must drop to not-measurable/null, never
  coerce to NaN→fabricated number. `<2` measured → `insufficient_history`, value null (NOT 0).
- **GET-never-writes**: `buildCareerIntelligence`→`computeRoleReadinessV2` runs
  `ensureCompetencyRuntimeSchema` (DDL) UNGUARDED. The GET MUST gate behind `competencyRuntimeReady()`
  FIRST so a read can never trigger schema DDL; not-ready → honest empty/degraded.
- **Frontend non-adoption MUST clear prior state**: a best-effort fetch that only SETS on success leaks
  stale competency scores across user/context switches (and keeps overriding the heuristic fallback,
  breaking byte-identical-OFF). Clear `competencyActivation=null` on EVERY non-adoption branch
  (503 / non-OK / parse fail / not-measurable), reqId-guarded so a stale request can't wipe a fresher adoption.
- **Honest ceiling**: live `career_seeker_profiles`=0 → live activation is `measurable:false`/null
  (cold-start). Derivation proven on a controlled measured fixture; live absence reported, never fabricated.
  Outputs are developmental signals only (reuse the bridge LANGUAGE_POLICY — never hiring/suitability).

## Evidence / smoke
- `backend/scripts/career-intelligence-activation-evidence.ts` → `audit/career-intelligence-activation/`.
- `backend/scripts/smoke-career-intelligence-activation.ts` (flag-OFF HTTP 503, service measurable:false/null
  no-fabrication, measured-fixture provenance, language_policy, IDOR via resolveEffectiveUserId).

## See also
- `career-intelligence-phase4-bridge.md` (the underlying additive enrichment helper).
- `cei-readonly-get-discipline.md`, `career-intelligence-phase4x-compose.md` (GET-never-writes + compose-only).
