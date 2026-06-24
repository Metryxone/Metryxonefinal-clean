# MX-103W — Role Auto-Resolution Design (Phase 2)

## Goal
Turn a free-text role title into a canonical Role DNA resolution with a competency
profile and assessment blueprint pointer — composing the crosswalk merged in #99,
never re-implementing it.

## Pipeline (founder-approved)
```
Free-text role title
        ▼
resolveCuratedRoleByTitle()        ← #99, COMPOSED (not edited)
   best + top-5 alternatives + numeric confidence + abstain
        ▼
Role DNA profile (onto_role_competency_profiles)   ← canonical layer
        ▼
Assessment blueprint pointer (onto_role_assessment_map)
        ▼
Explainability envelope + (optional) human override
        ▼
role_resolution_decisions  (audit trail — distinct table name)
```

## Layer authority
- **O*NET = Reference layer** — informs matching only.
- **Role DNA = Canonical layer** — the resolved truth a decision persists.

## Coverage ⟂ Confidence (kept SEPARATE)
- **Confidence** = title-match certainty (`confidence_pct`, numeric).
- **Coverage** = whether the resolved role actually carries a competency profile /
  blueprint (its own axis).
These are reported side-by-side and **never** folded together. A high-confidence
title match with no competency profile is honest, not "ready".

## Abstain (no fabrication)
A nonsense / unmatchable title returns `abstained=true`, `resolved=null`,
`confidence=null`. We never invent a role to avoid abstaining. Abstentions are
persisted to the audit trail (they are evidence, not failures).

## Human override + audit
Every resolution (accept / override / abstain) appends a `role_resolution_decisions`
row: input title, resolved role, confidence, actor, decision type, timestamp.
Distinct table name from any #102 posting-time override table (no collision).

## Flag
`roleAutoResolution` (`FF_ROLE_AUTO_RESOLUTION`), default OFF, byte-identical-OFF.
Routes `/api/admin/role-resolution/*` are super-admin + flag-gated; OFF → 503.

## Compose-only boundary
Does NOT edit `role-title-crosswalk.ts`, `talent-matching-engine.ts`, or matching
tests (#102/#103/#104). It only calls their exported functions.
