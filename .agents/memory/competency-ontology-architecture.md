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

## Authoritative docs
`docs/ONTOLOGY_ARCHITECTURE.md` — full table reference, API surface, bridging rules, lifecycle diagram, quality gate table, namespace constraints.
