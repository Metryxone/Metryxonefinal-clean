---
name: onto_* vs ont_* ontology namespace bridge
description: The app runs TWO disjoint competency ontologies; how O*NET-derived weights reach the user-facing Role-DNA pages.
---

# Two competency ontologies — `onto_*` vs `ont_*`

There are TWO disjoint competency ontologies that look almost identical by name:

- **`onto_*`** (TEXT ids: `role_*`, `comp_*`, `dna_*`) — the CURATED ontology the
  USER-FACING pages read: Role-DNA pane (`OntologyExplorerPage`) and Capability
  Heatmap (`CareerMobilityPage`), via `getRoleDNA` (competency-ontology.ts) /
  `getRoleVector` (mobility-engine.ts) → `onto_role_weights`.
- **`ont_*`** (INTEGER ids) — the O*NET-imported library (admin RolesPanel,
  role-crosswalk). Real O*NET-derived competency links live here in
  `map_role_competency.source='onet_derived'` (estimates inherited from related
  SOC occupations by `deriveUnratedRoleCompetencies`).

**They never met.** So the "Estimated / inherited" honesty badge wired into the
user pages (`source === 'onet_derived'`) could never fire — `getRoleDNA` /
`getRoleVector` hard-coded `'curated'::text AS source`.

## The bridge (services/onet-onto-weight-bridge.ts)
- `onto_role_weights` now has a real `source` column (default `'curated'`;
  migration `20261212_onto_role_weights_source.sql` + lazy
  `ensureOntoRoleWeightSourceColumn` — referencing `w.source` before the column
  exists throws, so BOTH read paths await the ensure first).
- `bridgeOnetDerivedWeights(pool)` maps `onet_derived` links across the two
  namespaces and writes them into `onto_role_weights` stamped
  `source='onet_derived'`. Matching tolerates synonyms/minor naming differences
  (the original required identical title AND identical competency name, silently
  dropping any spelling/casing/phrasing diff): roles reuse the shared role
  crosswalk; competencies use normalize + a curated synonym map. Unmatched
  roles/competencies are counted + logged so coverage gaps stay visible. Only
  genuine matches bridge — no match ⇒ no row, never fabricated.
- **Role-selection trap:** a curated title can resolve to SEVERAL library roles
  (an exact-title seeded role AND an alias/synonym O*NET role). The crosswalk's
  "best" pick favours `exact_title` + total competency count — which can select a
  seeded role that has NO `onet_derived` estimates while a synonym role has them,
  bridging nothing. **Fix:** among a title's ranked candidates, prefer the
  best-ranked one whose `id` is in the set of roles that actually carry active
  `source='onet_derived'` links; only fall back to the top match otherwise.
  **Why:** the goal is to surface ESTIMATES; picking the role by name-rank alone
  ignores whether that role has anything to bridge.
- It is **additive** (`NOT EXISTS` + `ON CONFLICT DO NOTHING` ⇒ a curated
  `(profile,competency)` weight ALWAYS wins), **idempotent** (deletes only
  `source='onet_derived'` rows then rebuilds; never touches curated), and
  **honest** (only genuine cross-namespace name matches bridge; no match ⇒ no
  row, an honest gap — never fabricated).
- Estimated weights are normalised to a per-profile fraction (window over the
  matched derived set) so they sit on the same scale as curated weights; the
  level is mapped from the O*NET band (`profToLevel`: novice1…expert5).
- Hooked into `POST /api/ontology/overview/import-onet` (runs after the import)
  and a standalone `POST /api/ontology/overview/bridge-onet-weights` for
  re-bridging without a full re-import.

## ONET_* role requirements → onto-domain crosswalk (employer matching)
O*NET-inherited role-DNA requirements carry `ONET_*` codes (= `ont_competencies.code`,
the O*NET import library) which have NO row in the curated `onto_competencies` genome,
so a `comp_*→domain_id` lookup can't reach them and they stay permanently unassessed
(capping employer match coverage). The bridge to make them assessable via domain-proxy:
reuse the import-time classification already on `ont_competencies` (`category` /
`competency_type` — Skills→functional, Abilities→cognitive/core, Knowledge→domain,
Work Styles→behavioral) → map to an `onto_domains.scientific_type` → resolve the REAL
`dom_*` id from `onto_domains` (never hardcode the id; look it up so a missing domain
honestly drops). Lives in `loadCompetencyDomainCrosswalk` (employer-competency-hiring.ts)
as a SECOND resolution pass over only the codes the curated path didn't resolve.
**Why grounded, not fabricated:** the category IS O*NET's own content-file classification;
no `dom_*` is invented. Categories with no scientific_type mapping (and any scientific_type
with no `onto_domains` row) stay unassessed — the honest O*NET coverage ceiling.
**Reachable domains:** O*NET sources only reach cognitive/behavioral/functional;
interpersonal & strategic have no O*NET source (correct, never force one).

## Env reality (why the badge stays grey in dev)
`ont_*` ships EMPTY in dev (merges carry code+DDL, not rows). O*NET is imported
only in prod via `runOnetImport`/`import-onet`, and onetcenter.org times out from
this env. So in dev every `onto_role_weights` row is honestly `'curated'` and the
badge does not fire — that is correct, not a bug. The badge lights up in prod
once O*NET is imported and the bridge runs (verified locally with temp fixtures).
