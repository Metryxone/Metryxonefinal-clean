---
name: ont_roles self-seeding + buildCrud name-vs-title trap
description: Why the Roles tab showed "Roles (0)" despite 1,040 rows, and why ont_roles breaks generic buildCrud
---

`ont_roles` is fully populated by TWO automatic seeders — do NOT hand-write a parallel role seed.

- **8 curated business/tech families** (RF_DATA, RF_DESIGN, RF_FIN, RF_GTM, RF_OPS, RF_PEOPLE, RF_PROD, RF_SOFTENGG): laddered by `services/ontology-seed.ts` (`runOntologySeed`, invoked from `routes/ontology-overview.ts` at route registration, so it re-runs on Backend API restart). Authors a fixed 24-code `ROLE_*` ladder AND maps each role to competencies (`onto_role_competency`). These curated `ROLE_*` rows are the canonical set — they carry competency weightings; hand-added duplicates do NOT.
- **23 O*NET occupation families** (RF_ONET_*): ~1,000 granular SOC occupations (`ONET_<soc>` codes) loaded by `services/onet-import.ts`. Total ≈ 1,040 rows.

## The "Roles (0)" bug was NOT a stale screenshot — it was a real route + schema collision
**Symptom:** Roles tab blank ("0 roles") while role-families (31) loaded fine with the same auth.

**Why:** `ont_roles` has NO `name` column — its label column is `title`. The generic `buildCrud` GET orders by `ORDER BY sort_order, name`, which 500s against ont_roles. The frontend renders a 500 as an empty list (not an error toast), so it looks "blank/stale."

**Compounding trap:** there were TWO `GET /api/ontology/roles` registrations — `buildCrud('ont_roles')` (generic, broken) registered BEFORE a custom join+`title`-ordered GET. Express matches the FIRST registration, so the broken generic GET won and the correct override never ran. **Fix = register the custom GET BEFORE the buildCrud call**; buildCrud still supplies POST/PATCH/DELETE.

**Also fixed:** `buildCrud` POST hard-required `body.name` (400 for roles). Now derives the label col the same way the import path does: `writableFields.includes('title') ? 'title' : 'name'`. Any future title-based entity routed through `buildCrud` needs the custom GET-before-buildCrud pattern + this label-col derivation, or it silently breaks.

**How to apply:** Don't assume a "(0)" admin list is a stale screenshot — if the DB has rows but the panel is empty, suspect a 500 (check Backend API logs / hit the endpoint). For ontology CRUD, remember `name` vs `title` is the discriminator. To extend curated roles, edit the `roles` array in `ontology-seed.ts` (canonical) — never a side script. The custom roles GET is hardcoded `LIMIT 200` (frontend `limit` param ignored).
