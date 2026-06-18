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
  `map_role_competency` (`source='onet'`)

## Unrated occupations (derived competencies)

O*NET 29.0 rates only ~879 of its ~1016 occupations. The remaining ~137 are
aggregate SOC codes (e.g. `15-1252.00` "Software Developers") that import with
**zero** competency links — an honest O*NET data gap, not a bug.

After importing the native ratings, the importer derives a competency set for
each unrated occupation by inheriting from its closest *rated* SOC relatives
(tightest first: same detailed base `.01/.02` siblings → broad group → minor
group → major group). A competency is adopted when it appears in a majority of
those relatives, topped up to a minimum and capped at a maximum so every unrated
role ends with a reasonable set. Weight is the mean of the relatives' weights and
the target proficiency is their modal band.

These rows are stamped **`source='onet_derived'`** so they are never represented
as genuine O*NET ratings. The step is idempotent (re-runs UPSERT in place and
remove derived rows for any role that has since gained native ratings) and can be
disabled by passing `deriveUnrated:false` to `runOnetImport`.

## Attribution

This product uses public information provided by O*NET OnLine, a service of the
U.S. Department of Labor, Employment and Training Administration (USDOL/ETA).
O*NET® is a trademark of USDOL/ETA. The O*NET database is published under a
Creative Commons Attribution 4.0 International (CC BY 4.0) license.
