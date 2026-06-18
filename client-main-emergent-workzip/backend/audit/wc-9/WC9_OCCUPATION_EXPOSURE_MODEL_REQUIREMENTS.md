# WC-9 Deliverable 8 — Occupation Exposure Model Requirements

The second reference asset. Where the AI Skill Taxonomy (Deliverable 7) classifies *skills*, this
classifies *occupations/roles* by AI exposure — needed for AI Career Navigator's "is my target role
at risk, and where do I pivot" answer and for the reskill-vs-upskill split in the growth plan.

## 1. Purpose
Given a user's current/target role, estimate **AI exposure** and surface **adjacent lower-exposure
roles** to pivot toward. Reference data, session-independent.

## 2. Required structure (proposed `wc9_occupation_exposure` reference table — NOT created this phase)
| Field | Type | Meaning |
|-------|------|---------|
| `occupation_key` | text PK | canonical role id |
| `display_label` | text | role name |
| `exposure_band` | enum | `low` / `moderate` / `high` |
| `exposure_score` | numeric 0–1 | directional estimate (labelled directional everywhere) |
| `automatable_tasks` | text[] | task-level exposure detail |
| `adjacent_roles` | text[] | lower-exposure pivot targets |
| `required_skill_keys` | text[] | FK → `wc9_ai_skill_taxonomy.skill_key` |
| `source` | text | provenance (mandatory) |

## 3. Join to the taxonomy and to Career Builder
- `required_skill_keys` → AI Skill Taxonomy → durability verdict per role.
- `occupation_key` should align with the **existing** Career Builder role catalog
  (`data/catalogs/industryRoles.ts`) so exposure decorates roles users already pick — reuse, don't
  fork the role vocabulary.

## 4. Reskill vs upskill derivation (closes the WC-8 Track E gap)
- Target role `exposure_band=high` on a skill the user has → **reskill** (pivot to `adjacent_roles`).
- Target role durable but skill below target → **upskill** (deepen).
This is the deterministic rule the Future Skill Plan annotation uses (Deliverable 5 §3).

## 5. Honesty / sourcing
- Same discipline as Deliverable 7: every `exposure_score` carries a `source`, is **directional**,
  and unclassifiable roles stay unclassified rather than guessed.
- Exposure ≠ destiny: copy must frame exposure as *adaptation signal*, never a hiring/termination
  prediction (CAPADEX language policy — developmental signals only).

## 6. Minimum viable size
Cover the roles already in `industryRoles.ts` first (the roles users actually select). That bounds the
asset to a tractable curation set and guarantees every exposure verdict is reachable from a real
user choice.
