---
name: Competency Ontology architecture
description: Table prefixes, CAPADEX bridge rules, schema patterns, and pitfalls for the 12-layer competency ontology.
---

## The 12-layer hierarchy (top → bottom)
Industry → Function → Department → Role Family → Role → **Layer** → **Cluster** → **Competency** → **Micro Competency** → **Concern** → Indicator → Assessment Question

Layers 1-5 (Industry→Role) were already in `ontology-taxonomy.ts`.
Layers 6-9 (Layer→Micro Competency) are in `ontology-competency-core.ts`.
Layers 10-12 (Concern→Question) are in `ontology-concerns-mapping.ts`.

## Table name prefixes
| Prefix | Namespace |
|--------|-----------|
| `ont_` | Ontology master entities |
| `map_` | Mapping / join tables |
| `ref_` | Reference / lookup (seeded, read-only from UI) |
| `ver_` | Version snapshots + field-level change log (append-only) |
| `lfc_` | Lifecycle status-transition events (append-only) |
| `gov_` | Governance: review schedules, instances, quality rules |
| `kg_`  | **DO NOT TOUCH** — owned by live Employability Graph |
| `pil_kg_` | PIL Knowledge Graph only |

## CAPADEX bridge — critical constraint
`ont_concerns` is a SEPARATE ontology-scoped entity. It does NOT replace `capadex_concerns_master`.

- `ont_concerns.concern_bridge_tag` bridges to `concerns_master.relational_bridge_tag` (bucket-level join)
- `ont_concerns.capadex_concern_id` bridges to `concerns_master.concern_id` (exact, if known)
- **The integer IDs are DISJOINT** — never use `ont_concerns.id` to key into `capadex_concerns_master`

## Route files (registered in routes.ts)
- `routes/ontology-competency-core.ts` — Layers, Clusters, Competencies, Micro Competencies
- `routes/ontology-concerns-mapping.ts` — Concerns, Assessment Questions, 7 mapping tables
- `routes/ontology-governance.ts` — Ref tables, versioning, lifecycle, review schedules, quality gates

## Schema DDL bug pattern (FIXED — do not re-introduce)
A single `pool.query(DDL1 + BROKEN_TABLE_DEF).catch(() => null)` swallows errors for ALL tables in the batch — they silently never get created. The fix is ONE clean `pool.query(all_DDL)` with no `.catch()` swallowing.

**Why:** Postgres executes multi-statement SQL sequentially; if the parser/executor hits a fatal error mid-batch (e.g. `nextval('seq'::regclass)` where the sequence doesn't exist), it throws and the whole query fails. `.catch(() => null)` then hides that ALL the tables were never created.

**How to apply:** Always put all `CREATE TABLE IF NOT EXISTS` statements in a single `await pool.query(...)` call with no error-swallowing catch. If you have a dependency ordering issue (e.g. sequence before table), use `CREATE SEQUENCE IF NOT EXISTS` in the SAME batch, before the table that references it.

## Frontend panels
- `CompetencyCorePanel.tsx` — accepts `initialTab` prop (`ont-layers`/`ont-clusters`/`ont-competencies`/`ont-micro-competencies`) so nav sidebar click opens the correct sub-tab
- `ConcernsMappingPanel.tsx` — accepts `initialTab` prop (`ont-concerns`/`ont-assessment-questions`)
- `OntologyGovernancePanel.tsx` — no initial tab prop; default is `reviews`

## Quality gate rules (seeded)
9 rules in `gov_quality_gate_rules` covering Competency (2), Micro (2), Concern (2), Cluster (1), Layer (1), Indicator (1). Severities: `error` (must-fix) or `warning` (advisory).

## Lifecycle transitions
Validated against `ref_lifecycle_transitions` at `POST /api/ontology/lifecycle/transition`. All transitions recorded in `lfc_status_events` (append-only). Allowed path: draft→in_review→approved→published→deprecated→archived. Breaking glass (archived→draft) requires approval.

## O*NET full-library importer (expands the starter seed)
`services/onet-import.ts` (`runOnetImport`) brings the public-domain **O*NET 29.0** taxonomy into `ont_roles` / `ont_competencies` / `map_role_competency`, dwarfing the 24-role starter seed. Runner: `scripts/onet-import-run.ts`; admin route `POST /api/ontology/overview/import-onet` (mirrors the existing `/seed` route).

- **Code namespaces are DISJOINT, so importer + starter coexist additively**: O*NET rows use `ONET_<soc>` (roles) / `ONET_<elementId>` (competencies) / `source='onet'`; starter rows use `ROLE_*` / `C_*` / `source='seeded'`. Never collide; both stay queryable.
- **Source files**: 6 tab-delimited O*NET text files in `backend/data/onet/` (gitignored `.txt`, committed `README.md` with CC-BY attribution). Importer downloads any missing file on demand from onetcenter.org (`ONET_DB_BASE_URL` env override; `--no-download` to require cache).
- **Idempotent**: every write is `ON CONFLICT DO UPDATE / DO NOTHING`; re-runs give identical counts.
- **Build**: 23 SOC-major-group role families (`RF_ONET_nn`), 1 layer `L_ONET`, 4 clusters (SKILLS/ABILITIES/KNOWLEDGE/WORKSTYLES). Links filtered by `Scale ID=IM` (importance) `>= 3.0`; tier `core` if IM>=3.75 else `secondary`; weight=clamp(IM/3.5,0.5,1.5).
- **Honest coverage gap (NOT a bug)**: only **879 of 1016** occupations carry skill/ability ratings in O*NET 29.0; the other 137 (aggregate codes like `15-1252.00` Software Developers) genuinely have no ratings → those roles import with zero links. Don't "fix" by fabricating links.
- Verified dev counts: 1016 roles, 136 competencies, 49,149 links, 0 orphan FKs.

## Runtime profile keying
- `onto_competency_profiles` keys on **`subject_id` (text)** — there is **no `user_id` column**. The career match/simulation engines pass `subjectId == the user id` into `subject_id`. Any per-user presence probe that queries `WHERE user_id = $1` silently errors (→ false/null), under-reporting completion. **Why:** caught a battery probe + audit count both mis-keyed on `user_id`. **How to apply:** filter `onto_competency_profiles` by `subject_id`, not `user_id`.

## Authoritative docs
`docs/ONTOLOGY_ARCHITECTURE.md` — full table reference, API surface, bridging rules, lifecycle diagram, quality gate table, namespace constraints.
