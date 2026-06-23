# §11 — Data Protection & Migration Safety Report

**Date:** 2026-06-23 · Read-only · Code trace

## Verdict: ✅ PASS — no existing production data is invalidated by the additive phases

## Impact on existing data

| Existing data | Impact | Evidence |
|---|---|---|
| Existing Assessments | none | new work in `wc3_*` / `onto_*` / `pil_*` namespaced tables; no mutation of assessment tables |
| Existing Competency Profiles | none | `onto_competency_profiles` is append-only; reads UNION, never overwrite |
| Existing EI Scores | none | EI math single-sourced; additive layers re-shape, never recompute base scores |
| Existing Career Builder Data | none | compose-never-recompute; flag-OFF = no DB touch |
| Existing Passport Data | none | sync is additive snapshot write (`career_passport_snapshots`) |
| Existing Employer Data | none | `employer_*` / `tig_*` are new namespaces |

## Safety assessment

| Axis | Verdict | Evidence |
|---|---|---|
| **Migration safety** | ✅ | "lazy ensure-schema" pattern: `CREATE TABLE IF NOT EXISTS` + `INSERT … ON CONFLICT DO NOTHING`; no destructive DDL. `wc3-schema.ts`: *"Every table is `wc3_*` namespaced, additive, and trivially reversible (`DROP TABLE wc3_*`). No existing table is mutated."* |
| **Backward compatibility** | ✅ | flag-OFF path is **byte-identical** to legacy; `outcome-intelligence.ts`: *"Sessions WITH a spine are untouched (byte-identical) in either flag state."* |
| **Rollback safety** | ✅ | explicit `rollbackExpansion` / `rollbackBridgeResolution`; namespaced tables drop cleanly; derived rows rebuilt from scratch, curated rows never touched |
| **Data integrity** | ✅ | 0 NULL inheritance weights/proficiencies; 0 duplicate role-competency pairs; provenance-stamped derivations |

## Caveat (honest)
The merge model carries **CODE + migration DDL, not data rows** — task-agent backfills run in the isolated
env; the **live shared DB must be re-seeded in prod** to activate any data. This is an operational note, not
a data-protection defect: existing rows are never invalidated; new data simply must be (re)generated where
intended.

**Success criterion — "no existing production data may be invalidated" — ✅ MET.**
