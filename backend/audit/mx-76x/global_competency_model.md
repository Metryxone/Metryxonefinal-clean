# MX-76X · Section 2 — Global Competency Model

**Principle:** the 5-tier model is a *read-time composition* over EXISTING tables, not new storage.
Each tier maps 1:1 to assets already audited in `global_current_state.md`. Lower tiers **inherit** from
upper tiers unless an overlay row says otherwise (universal-inheritance; honest empty when absent).

```
Global Competency        ← onto_competencies (419 curated) ∪ ont_competencies (160 O*NET)
        ↓ inherits
Regional Competency      ← global_region_content(surface='competency_models', region_code)
        ↓ inherits
Country Competency       ← m4_regional_competency_expectations (per m4_countries)
        ↓ inherits
Industry Competency      ← ont_industries → map_industry_function → map_role_competency
        ↓ inherits
Role Competency          ← onto_role_competency_profiles / ont_roles × map_role_competency
```

## Tier semantics (Coverage ⟂ Confidence)
| Tier | Backing | Coverage today | Confidence basis |
|---|---|---|---|
| Global | `onto_competencies` 419 + `ont_competencies` 160 | High | Curated genome + O*NET ratings |
| Regional | `global_region_content` (419 competency rows × 4 regions) | Inherited (universal) | `detail.basis` per row; non-native = inheritance |
| Country | `m4_regional_competency_expectations`=7 across 5 countries | **Shallow** | Authored expectations; abstain where absent |
| Industry | 206 `ont_industries`, 52,362 `map_role_competency` | High (US O*NET) | O*NET ratings; **no geo dimension** |
| Role | 1,040 `ont_roles` + 5 curated `onto_roles` | High count, thin curated DNA | `map_role_competency` ratings |

## Resolution rule (inheritance, never fabrication)
`resolve(competency, region, country, industry, role)`:
1. Start from Global (always present).
2. Apply Regional overlay if a `global_region_content` row exists for `region_code`; else inherit
   Global (mark `source:'inherited'`).
3. Apply Country expectation if `m4_regional_competency_expectations` has a row; else inherit Regional
   (mark `source:'inherited'`).
4. Industry/Role narrow via O*NET maps. **Any missing tier inherits upward and is labelled — never
   zero-filled.**

## What is genuinely missing (honest)
- Country-tier expectations cover **5 countries / 7 rows** → most country×competency cells inherit
  (legitimate) but are not country-native. Surfaced as `inherited`, never as country-authored data.
- No region/locale column on the competency tables themselves — regionality lives entirely in the
  overlay + `m4_*`, by design (keeps framework byte-identical → constraint "do not replace framework").

## Activation hook (Section 3 T003)
A read-only composer `GET /api/global-intel/competency-model?region=&country=&industry=&role=`
walks the 5 tiers above, returning `{tier, source: native|inherited|empty, value}` per node. Flag
`globalCompetencyModel` (default OFF → 503, byte-identical).
