# MX-100X Phase 2 — O*NET Crosswalk Governance Evidence

- Engine version: `mx100x-p2-1.0.0`
- Generated: 2026-06-23T17:54:30.633Z
- Honesty: O*NET is a REFERENCE layer (never scoring). Coverage (a mapping exists) and Confidence (it is trustworthy) are SEPARATE axes. `ont_*` ids are INTEGER, `onto_*` ids are TEXT — never coerced. Read-only; the crosswalk itself is never written by this script.

## 1. Per-mapping confidence (Coverage ⟂ Confidence)

### Role crosswalk (`map_ont_onto_role`)
- Total bridges: 5 · Resolved: 3 · Unresolved: 2
- Coverage (resolved/total): 60%
- Confidence bands (over resolved): high=2 moderate=0 low=1 very_low=0 none=0
- Note: Role crosswalk confidence READ from stored match_method/confidence; unresolved bridges (ont_role_id NULL) carry no confidence and are excluded from the band distribution.

| id | curated role (onto, TEXT) | O*NET (ont, INT) | match_method | confidence | band | verified | decision |
|----|----|----|----|----|----|----|----|
| 1 | role_be_eng | — | unresolved | low | none | false | — |
| 2 | role_sr_be_eng | — | unresolved | low | none | false | — |
| 3 | role_eng_manager | 2053 | exact_title | high | high | false | — |
| 4 | role_pm | 2059 | exact_title | high | high | false | — |
| 5 | role_credit_analyst | 97 | partial_title | low | low | false | — |

### Competency crosswalk (`map_ont_onto_competency`)
- Total mappings: 15 · Resolved: 15
- Coverage (resolved/total): 100%
- Confidence bands: high=15 moderate=0 low=0 very_low=0 none=0
- Note: Competency crosswalk confidence READ from stored match_method/confidence. Coverage measures how many curated competencies have an O*NET crosswalk (denominator reported separately).

### Industry
- Measurable: false · Reason: `no_role_industry_linkage` · ont_industries (reference count): 206
- O*NET has no role↔industry dimension in the ont_* chain — industry-level crosswalk confidence abstains (never fabricated).

## 2. Duplicate detection
- Total duplicate groups: 0
  - role bridge → multiple O*NET roles: 0
  - multiple curated roles → one O*NET role: 0
  - competency → multiple O*NET: 0
  - multiple curated competencies → one O*NET: 0
  - duplicate (role_id, competency_id) pairs: 0

## 3. Missing-mapping detection
- Unresolved role bridges: 2 → role_be_eng, role_sr_be_eng
- Active roles with no competency links: 19 of 1040 active roles
- Competency crosswalk coverage gap:
  - O*NET (ont_*) uncrosswalked: 145 of 160
  - curated (onto_*) uncrosswalked: 404 of 419

## 4. Unlinked-role inheritance-closure analysis
- Total unlinked: 19 · inheritance_closable: 0 · genuinely_unmappable: 19
- Note: For each unlinked role we run the EXISTING inheritance path: a role can inherit competency requirements only if a sibling in the same family carries links. Zero linked siblings → genuinely_unmappable via inheritance (closing it requires real O*NET/ESCO competency data, never fabricated).

| ont_role_id | code | title | family | linked siblings | verdict |
|----|----|----|----|----|----|
| 998 | ONET_55-1011.00 | Air Crew Officers | Military Specific | 0 | genuinely_unmappable |
| 999 | ONET_55-1012.00 | Aircraft Launch and Recovery Officers | Military Specific | 0 | genuinely_unmappable |
| 1000 | ONET_55-1013.00 | Armored Assault Vehicle Officers | Military Specific | 0 | genuinely_unmappable |
| 1001 | ONET_55-1014.00 | Artillery and Missile Officers | Military Specific | 0 | genuinely_unmappable |
| 1002 | ONET_55-1015.00 | Command and Control Center Officers | Military Specific | 0 | genuinely_unmappable |
| 1003 | ONET_55-1016.00 | Infantry Officers | Military Specific | 0 | genuinely_unmappable |
| 1004 | ONET_55-1017.00 | Special Forces Officers | Military Specific | 0 | genuinely_unmappable |
| 1005 | ONET_55-1019.00 | Military Officer Special and Tactical Operations Leaders, All Other | Military Specific | 0 | genuinely_unmappable |
| 1006 | ONET_55-2011.00 | First-Line Supervisors of Air Crew Members | Military Specific | 0 | genuinely_unmappable |
| 1007 | ONET_55-2012.00 | First-Line Supervisors of Weapons Specialists/Crew Members | Military Specific | 0 | genuinely_unmappable |
| 1008 | ONET_55-2013.00 | First-Line Supervisors of All Other Tactical Operations Specialists | Military Specific | 0 | genuinely_unmappable |
| 1009 | ONET_55-3011.00 | Air Crew Members | Military Specific | 0 | genuinely_unmappable |
| 1010 | ONET_55-3012.00 | Aircraft Launch and Recovery Specialists | Military Specific | 0 | genuinely_unmappable |
| 1011 | ONET_55-3013.00 | Armored Assault Vehicle Crew Members | Military Specific | 0 | genuinely_unmappable |
| 1012 | ONET_55-3014.00 | Artillery and Missile Crew Members | Military Specific | 0 | genuinely_unmappable |
| 1013 | ONET_55-3015.00 | Command and Control Center Specialists | Military Specific | 0 | genuinely_unmappable |
| 1014 | ONET_55-3016.00 | Infantry | Military Specific | 0 | genuinely_unmappable |
| 1015 | ONET_55-3018.00 | Special Forces | Military Specific | 0 | genuinely_unmappable |
| 1016 | ONET_55-3019.00 | Military Enlisted Tactical Operations and Air/Weapons Specialists and Crew Members, All Other | Military Specific | 0 | genuinely_unmappable |

## 5. Manual governance decisions (audit)
- Decisions table present: false · recorded: 0 (approved=0, rejected=0)
- Decisions are write-once per entity, reversible by provenance (POST /rollback). The audit table is created lazily ONLY on the first decision.

