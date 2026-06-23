---
name: Role DNA Expansion — curated-over-inherited composition
description: How a bridged O*NET role surfaces curated onto_* requirements alongside inherited O*NET ones, and why precedence must reflect actual application.
---

# Curated vs inherited requirement composition (Role DNA)

A role's DNA requirements come from TWO disjoint namespaces that must be COMPOSED, never key-merged:
- Inherited O*NET requirements: `map_role_competency` → `ONET_*` codes.
- Curated requirements: `onto_role_weights` → `comp_*` codes (the authoritative curated genome).

Join path from an O*NET role to its curated weights:
`map_ont_onto_role.ont_role_id` (int) → `.onto_role_id` (text, e.g. `role_credit_analyst`)
→ `onto_dna_profiles.role_id = onto_role_id AND is_current = true` → `onto_dna_profiles.id` (= the dna_profile_id, e.g. `dna_credit_v1`)
→ `onto_role_weights.dna_profile_id` → `comp_*`, weight, expected_level, rationale
→ `onto_competencies.id = competency_id` → canonical_name.

**Why curated is composed, not overridden:** the two competency namespaces are
DISJOINT (`comp_*` vs `ONET_*`), so there is nothing to key-collide. "Curated wins"
means curated reqs are listed FIRST with `source='curated'`; inherited reqs are retained.
So `competencyCount === curatedRequirementCount + inheritedRequirementCount` (an invariant).

**Why the precedence flag must gate on actual application:** a `curatedPrecedence`
boolean driven only by "a bridge row exists" over-claims — a bridged role with no
curated weights still has inherited-only requirements. Gate it on
`curatedReqs.length > 0` and expose `requirementSource`
(`curated_over_inherited` | `inherited_only` | `none`) so the claim is honest.

`expected_level` (curated, int 1..5) is mapped to the inherited proficiency vocab;
`minProficiency` stays null because curated weights declare a TARGET, not a floor.
