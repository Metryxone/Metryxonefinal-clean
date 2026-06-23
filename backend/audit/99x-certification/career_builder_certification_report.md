# §8 — Career Builder Certification Report

**Date:** 2026-06-23 · Read-only · Evidence: `backend/scripts/audit-99x-certification.ts`

## Verdict: 🟡 PARTIAL — intelligence-driven architecture is fully present (✅), but there is **0 live execution** (cold-start)

## Chain: Competency Profile → Gaps → Roadmap → Recommendations → Passport

| Hop | Verdict | Evidence |
|---|---|---|
| Competency Profile → Gaps | ✅ | `career-readiness-aggregator` + `computeRoleReadinessV2` (gap severity bands) |
| Gaps → Roadmap | ✅ | Career Intelligence 4.x compose family (`career-development-engine`) |
| Roadmap → Recommendations | ✅ | `career-recommendation-aggregator` (personalized vs catalog-only Provisional) |
| Recommendations → Passport | ✅ | `syncPassportFromPlatform` bridges competency/FRP/CAPADEX → `career_passport_snapshots` |

## Live data
| Surface | Rows | Read |
|---|---|---|
| `career_seeker_profiles` | **0** | no live seeker has run the chain |
| `cg_user_recommendations` | **0** | no recommendations materialized |
| `career_passport_snapshots` | **4** | sync path proven (small) |

## "Career Builder must be intelligence-driven, not static"
✅ **Architecturally MET** — every hop composes prior engine output (compose-never-recompute), is
flag-gated, and degrades honestly (Provisional when sample < 30 / catalog-only). The recommendation layer
marks catalog-only items `personalized:false` rather than fabricating personalization.

## Honest finding
The Career Builder is **engine-complete but execution-unproven**: the chain has never run end-to-end for a
real seeker (`career_seeker_profiles`=0). This is a **data/usage** gap (needs real users), not an
architectural one. The 4 passport snapshots confirm the terminal sync works.

**Cannot reach PASS by code** — requires real career-seeker traffic.

## MX-100X Phase 6 — Career Intelligence Activation (2026-06-23)

The frontend aggregator gap is now CLOSED at the wiring level. `useCareerBrain` (the central
aggregator feeding ALL Career Builder tabs) previously derived `careerReadiness`/`skillGaps` from
EI + completeness heuristics + a keyword-family `deriveSkillGaps`, so the surfaced scores did **not**
trace to the measured competency profile. Phase 6 activates the EXISTING Phase-4 bridge
(`buildCareerIntelligence`) as the PRIMARY driver:

- **New flag** `careerIntelligenceActivation` (`FF_CAREER_INTELLIGENCE_ACTIVATION`, default OFF) — toggles
  independently of Phase-4's `careerIntelligence` enrich. OFF ⇒ byte-identical legacy (endpoint 503s
  before any DB touch; frontend falls back to heuristics).
- **New read-only GET** `/api/career/competency-activation/:userId` — flag-503 → requireAuth →
  `resolveEffectiveUserId` IDOR → `competencyRuntimeReady` probe (GET-never-writes: gates the bridge's
  `ensureCompetencyRuntimeSchema` DDL) → `buildCareerIntelligence`. Returns the FOUR named scores
  (career readiness / career growth / role progression / skill-gap pressure) + the gap→plan focus areas.
- **Bridge** gains a pure `buildActivationScores` + `activation_scores` envelope field (compose-only,
  null=missing). Readiness=role_readiness_v2; growth=EI growth_potential; progression=measured EI-history
  trajectory (≥2 snapshots, else `insufficient_history`/null); skill-gap=role_gap severity pressure.
- **Frontend** `useCareerBrain` adopts these as PRIMARY `careerReadiness`/`skillGaps` (+ new
  `growthScore`/`progressionScore`/`skillGapScore`/`competencyActivation`) **only when `measurable`**;
  otherwise byte-identical fallback.

**Honest ceiling unchanged:** live `career_seeker_profiles`=0, so the live activation is
`measurable:false`/null (cold-start). The derivation is proven on a controlled measured fixture and the
honest absence on the live DB — see `backend/audit/career-intelligence-activation/`. Outputs remain
developmental signals only (language policy). Still **PARTIAL** by the same data/usage gap, not architecture.
