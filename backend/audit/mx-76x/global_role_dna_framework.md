# MX-76X · Section 5 — Global Role DNA Framework

**Constraint:** do NOT replace Role DNA. Role DNA reads the curated `onto_*` genome
(`onto_roles`=5, `onto_dna_profiles`=5, `onto_role_weights`=44). O*NET `ont_roles`=1,040 is the
breadth library (1,016 `ONET_*` + 24 curated).

## The honest variant ceiling
Target: `Software Engineer (USA / India / Germany)` as distinct DNA variants. **Today this is not
representable:**
- No region/country column on `onto_roles`, `ont_roles`, or `onto_role_weights`.
- O*NET is **U.S. Department of Labor** data with **no geography dimension** — there is no
  *source* for region-native role requirements inside the platform. Fabricating per-country weights
  would violate the honesty constraint.

So "Global Role DNA" is delivered as an **overlay + inheritance model**, with region/country variance
populated ONLY where real data exists (today: none beyond the universal base) — never invented.

## Variant model (additive overlay, mirrors Phase 8 pattern)
```
Global Role DNA      ← onto_dna_profiles / onto_role_weights   (universal, present)
   ↓ overlay (global_region_content surface='role_library', region_code)
Regional Variant     ← currently universal-inheritance only (no region-native weights)
   ↓ overlay (proposed role_dna_variant table, provenance-stamped)
Country Variant      ← EMPTY today (no source) → inherit + label 'inherited_universal'
   ↓
Industry Variant     ← map_role_competency narrows by industry (US O*NET, not geo)
```

### Proposed additive surface (T003, flag-gated, write-on-POST only)
`role_dna_variant(role_ref, scope_type ['region'|'country'|'industry'], scope_code, weights jsonb,
provenance, source_url, confidence, created_at)` — an overlay keyed to an EXISTING role
(`onto_roles.id`), existence-checked like Phase 8 (`assignRegionContent` guard). A variant is only
ever written from a real source; absent → read path inherits the universal DNA and labels it.

## Read path
`GET /api/global-intel/role-dna/:roleId?region=&country=` returns
`{base: <universal weights>, variant: <overlay or null>, effective, source: native|inherited}`.
**`variant:null` is the honest resting state** until region/country labour-market sources are licensed.

## Verdict
Mechanism for global Role DNA = **ready** (overlay + inheritance + existence guard). Region/country
DNA *content* = **0** (no source). This is a data-acquisition ceiling, reported as such — not a build
gap and not fabricated.
