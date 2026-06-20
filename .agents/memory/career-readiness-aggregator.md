---
name: Career Readiness aggregator (Phase 4.3)
description: How the compose-only Career Readiness layer treats FRP confidence and measurability honestly.
---

# Career Readiness aggregator (Phase 4.3)

Compose-only layer: Current=EI overall, Future=FRP/FRI, Role=role-readiness-v2,
Growth=EI growth_potential. It NEVER recomputes any block's score — only folds the
measurable *present* blocks (current/future/role; growth EXCLUDED) into a top-level
`overall`.

## The FRP confidence trap (the durable lesson)
**FRP's own FRI confidence is OPTIMISTIC.** It counts zero-data sentinels as if they
were real evidence: `capadex_session_count:0`, `wcl0_dims_empty`,
`role_not_in_catalog`, default/no/error sources all inflate its confidence and yield a
default composite ~40. So you cannot trust FRI.confidence as a "this is real data"
signal.

**Why:** A compose layer that surfaced FRI's default ~40 would be fabricating a Future
score for users with no future-readiness data.

**How to apply:** Gate Future measurability on a provenance re-read, not on
FRI.confidence. `friRealSignalCount()` reads FRI provenance/source strings and only
counts GENUINELY grounded sources (e.g. `frp_user_skill_profile`,
`wcl0_user_intelligence`, `industry_forecast:`, `automation_risk:`, real
learning-velocity). Future is `measurable` only when realCount>0; otherwise
score=null / band=Unmeasured. Don't over-suppress (a single real source qualifies);
don't under-suppress (sentinels never qualify).

## Other conventions
- Super-admin gated (gate→requireAuth→requireSuperAdmin), NOT IDOR/resolveEffectiveUserId,
  because `:subject` is operator-supplied (precedent: career-intelligence.ts).
- GET-never-writes: GET history uses a `to_regclass` probe; only POST `/:subject/snapshot`
  runs ensure-schema DDL. Flag-gate (careerReadiness) is the FIRST middleware → 503 before
  auth/DB when OFF.
- Append-only `career_readiness_history`; `id` is BIGSERIAL so pg returns it as a STRING —
  assert with `Number(row.id) > 0`, never `typeof === 'number'`.
