# O*NET data files (bulk-import source)

This directory caches tab-delimited text exports from the **O*NET® database**
(version 29.0) used by `backend/services/onet-import.ts` to populate the
competency ontology (`ont_roles`, `ont_competencies`, `map_role_competency`).

The `.txt` files are **not committed** (gitignored). The importer downloads any
missing file on demand from <https://www.onetcenter.org/> (override the base URL
with the `ONET_DB_BASE_URL` env var, or pass `--no-download` to require cached
files).

Files used:

- `Occupation_Data.txt` — occupations → `ont_roles`
- `Skills.txt`, `Abilities.txt`, `Knowledge.txt`, `Work_Styles.txt` — O*NET
  Content Model elements → `ont_competencies`, and occupation×element ratings →
  `map_role_competency`

## Attribution

This product uses public information provided by O*NET OnLine, a service of the
U.S. Department of Labor, Employment and Training Administration (USDOL/ETA).
O*NET® is a trademark of USDOL/ETA. The O*NET database is published under a
Creative Commons Attribution 4.0 International (CC BY 4.0) license.
