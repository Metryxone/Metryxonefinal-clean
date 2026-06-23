---
name: ont_roles is self-seeding (never manually parallel-seed)
description: Why a "Roles (0)" screenshot is usually stale and manual role seeds create duplicates
---

`ont_roles` is fully populated by TWO automatic seeders — do NOT hand-write a parallel role seed.

- **8 curated business/tech families** (RF_DATA, RF_DESIGN, RF_FIN, RF_GTM, RF_OPS, RF_PEOPLE, RF_PROD, RF_SOFTENGG): laddered by `services/ontology-seed.ts` (`runOntologySeed`, invoked from `routes/ontology-overview.ts` at route registration, so it re-runs on Backend API restart). Authors a fixed 24-code `ROLE_*` ladder AND maps each role to competencies (`onto_role_competency`, big map ~line 1269). These curated `ROLE_*` rows are the canonical set — they carry competency weightings; hand-added duplicates do NOT.
- **23 O*NET occupation families** (RF_ONET_*): ~1,000 granular SOC occupations (`ONET_<soc>` codes) loaded by the O*NET import (`services/onet-import.ts`).

**Why this matters:** A super-admin "Roles (0)" screenshot is almost always STALE — taken before a backend restart re-ran the boot seed / before the O*NET import. Query the shared DB first (`SELECT COUNT(*) FROM ont_roles`) before concluding it's empty.

**How to apply:** If asked to "seed roles," first check live counts per family. If populated, the fix is just a refresh, not a new seed. A manual `ROLE_*` ladder collides title-wise with the canonical `ontology-seed.ts` ladder (e.g. `ROLE_DA` vs a hand-coded `ROLE_DATA_ANALYST`, both "Data Analyst" in RF_DATA) and creates competency-less orphan duplicates. To extend curated roles, edit the `roles` array in `ontology-seed.ts` (canonical) — never a side script. The Roles tab GET `/api/ontology/roles` is hardcoded `LIMIT 200` (frontend `limit` param ignored).
