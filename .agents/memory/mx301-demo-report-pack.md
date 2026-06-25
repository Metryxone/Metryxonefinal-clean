---
name: MX-301 demo candidate report-pack measurability + purge
description: Why some MX-301 reports render non-measurable, and the FK trap that makes the @example.com demo identity un-purgeable.
---

# MX-301 demo report pack — measurability + purgeability

Context: a scripted demo candidate (`*.mx301@example.com`) feeds a 16-report pack.
Goal is ALL 16 render from GENUINE measured data, and the demo identity stays
fully purgeable. Two distinct traps.

## Measurability traps (radar / heatmap / role_readiness / skill_gap)
- **Radar/heatmap consume `computeTypeProfile` (competency-runtime.ts).** Read its
  REAL fields — bucket `label`/`avg_score`/`competencies`, per-comp
  `competency_name`/`competency_id`/`measured_score`/`measurement`. Guessing legacy
  names (`measurable`/`mean_score`/`score`/`name`) silently yields `measurable:false`.
- Include ONLY `measurement === 'domain_proxy' && measured_score != null`, and
  re-derive each TYPE mean over those comps. An onto-domain with no bank code (e.g.
  `dom_strategic`) is genuinely UNMEASURABLE — it must be excluded from the type
  radar/heatmap, never folded into a mean. Label the source honestly as domain-PROXY.
- **A 1-axis radar means the blueprint is single-type.** For a real multi-axis shape
  the assessment blueprint (`onto_assessment_blueprints` + `onto_blueprint_competency_map`)
  must span several bank-measurable TYPES (behavioral/cognitive/functional/technical;
  future_skills is honestly empty). Seed ONLY competency ids that exist in
  `onto_competencies` — never fabricate one.
- **role_readiness / skill_gap measure against a role's stored requirements.** They
  are non-measurable unless `onto_competency_profiles.role_id` points at a role that
  GENUINELY has rows in `onto_role_competency_profiles` (a free-text job title has no
  Role DNA → unmeasured). Resolve the title, then pick the first candidate role that
  actually carries requirements; fall back to the title (honest unmeasured) if none.
  Note `dom_strategic` requirements still surface here via the domain-proxy actual
  even though they're excluded from the type radar — that's the engine's documented
  method, internally consistent, not a contradiction.

## Purgeability trap — FK-blocked demo identity delete
- **`users.id` IS the email** for these demo rows (e.g. `sarah.johnson.mx301@example.com`).
- `admin_audit_logs.admin_user_id → users.id` is **ON DELETE NO ACTION**, and the
  demo's own scripted activity writes audit rows under that id. So deleting the
  `users` row is FK-blocked and a try/catch rollback **silently skips it** → the
  demo identity leaks and "@example.com must stay purgeable" is violated.
- **Fix:** purge `admin_audit_logs` (by `admin_user_id`) BEFORE the `users` row in
  the ordered purge list, then add a post-rollback `assertPurged()` that re-probes
  the core identity tables for surviving tag-matched rows and THROWS (exit non-zero)
  — purge must be self-verifying, never a silent skip. Keep audit-before-users as a
  non-regression invariant.

**Why:** a try/catch purge that logs-and-continues turns an incomplete rollback into
a green run; only a hard assertion proves the contract. **How to apply:** any scripted
demo identity whose id is FK-referenced by an audit/NO-ACTION table needs the parent
rows cleared first + an assertion gate.
