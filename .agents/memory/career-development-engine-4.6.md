---
name: Career Development Engine (Phase 4.6) & competency-type canon
description: The 5 canonical competency TYPES, the missing "Leadership" type trap, and the 4.x career-chain composition pattern.
---

## Competency-type canon (durable data-model fact)
`onto_competency_types` has EXACTLY 5 types: `behavioral`, `cognitive`, `functional`, `technical`, `future_skills`. There is **NO standalone "Leadership" type**.
`onto_competency_type_map` is heavily skewed (behavioral ≫ cognitive > functional ≫ technical; future_skills sparse/empty in dev).

**Why:** Any feature asked to deliver "Leadership Development" as a first-class stream must NOT fabricate a 6th type. Represent leadership THROUGH the behavioral/cognitive/functional streams and disclose the divergence in a `taxonomy_note`. Flag this drift to the user — it is an honest ontology gap, not a bug.

**How to apply:** Stream/dimension engines key off the 5 real type rows. `future_skills` legitimately reads 0% in dev — report it as an honest gap, never seed a stub.

## 4.x career-chain composition pattern
Phases 4.3 (readiness) → 4.4 (gap) → 4.5 (roadmap) → 4.6 (development) each COMPOSE the prior phase's engine; never recompute a score. 4.6 reshapes `buildCareerRoadmap`'s output into 5 type-streams + longitudinal tracking.

**Contract (identical across the chain):** flag default OFF (`careerDevelopment`, env `FF_CAREER_DEVELOPMENT`) → route 503s BEFORE any DB touch incl. schema (byte-identical OFF); GET-never-writes (composition delegates competency-runtime DDL-gating to the composed engine; history/baseline use `to_regclass` probes); the ONLY write path is `POST /:subject/snapshot`; `:subject` is operator-supplied so every route is `requireAuth + requireSuperAdmin` (IDOR); literal sub-paths registered before `GET /:subject`.

**Tracking honesty:** longitudinal delta is vs the most recent prior snapshot; `has_baseline=false` → `insufficient_history` + `null` deltas (never 0). NULL ≠ 0.

**Smoke must prove GET-never-writes** by snapshotting `to_regclass` over this phase's history table + the prior phase's history table + every transitive competency-runtime relation (reuse `COMPETENCY_RUNTIME_RELATIONS` from career-gap-engine — never copy the list).
