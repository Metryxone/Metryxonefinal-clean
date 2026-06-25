---
name: Competency Match Intelligence (MX-107A)
description: Read-only flag-gated composer unifying candidate assessment → Role DNA → readiness → hiring fit → career recs onto ONE canonical framework; PRECISE⟂OPERATIONAL coverage honesty ceiling.
---

# Competency Match Intelligence (MX-107A)

Flag-gated (`competencyMatchIntelligence`, FF_COMPETENCY_MATCH_INTELLIGENCE, default OFF)
read-only super-admin composer that makes the candidate Competency Assessment →
Employer Role DNA → readiness → hiring fit → career-recs chain legible as ONE
canonical framework. COMPOSES existing engines; recomputes nothing, no DDL, GET-only.

## The two coverage axes — NEVER composited
- **PRECISE** = comp_*-level question map: a competency is precisely scorable only if it
  has rows in `onto_competency_question_map WHERE active`. Live ceiling ~**7/419 comps**
  (1.7%) backed by ~**25 mapped questions** out of a ~2,602-row authored bank.
- **OPERATIONAL** = domain-proxy: ~100% because every genome competency has a `domain_id`,
  so domain-proxy scoring always applies.
- **Why:** precise scoring is a DATA-MAPPING effort (authoring `onto_competency_question_map`
  rows), never something composition can inflate. Report both axes side-by-side; the
  certification verdict MUST be PARTIAL on canonical precision until the map grows.
- **How to apply:** any future "match coverage %" headline must split precise vs operational.
  A single blended number is a fabrication vector.

## Honest join keys
- Operational requirement reachability: `onto_role_competency_profiles.competency_id = onto_competencies.id`.
- Precise: `onto_competency_question_map` (active) DISTINCT `competency_id`.
- Scored subjects span BOTH ledgers (profiles + score_runs) — don't count one only.

## Activation (Q5) honesty
- Activation cert is **capped at PARTIAL, never PASS**: demo/seed scored subjects are not
  distinguishable from real at this composition layer, so non-demo volume can't be asserted.

## null ≠ 0 trap in the founder view
- Role-count metrics (`roles_measured`, `roles_with_dna`, `avg_requirements_per_role`)
  derived from a `rows()`-length read return **0** when the backing table is ABSENT,
  conflating absent with empty. Probe `tablePresent('onto_role_competency_profiles')`
  first and emit **null** when absent; only use the length when the table exists.

## Flag-gate ordering (sibling-consistent, do NOT "fix")
- The global `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate runs BEFORE any
  route-level `flagGate`, so unauth `/enabled` returns **401**, not strict 503-before-auth.
  This is identical for ALL MX panels (ecosystem-activation, enterprise-certification,
  go-live). Byte-identical-OFF still holds on the REAL path: the frontend probes
  `/enabled` AUTHENTICATED → flag-OFF → 503 → `res.ok` false → tab hidden. Do not carve a
  one-off `/api/admin` exemption just to satisfy a literal "503 before auth" reading.
