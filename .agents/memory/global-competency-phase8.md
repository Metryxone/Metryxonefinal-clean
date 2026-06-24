---
name: Global Competency (MX-100X Phase 8)
description: Additive region dimension threaded through 5 surfaces via one overlay table; structural framework + coverage only, never fabricate regional data.
---

# Global Competency — region dimension (Phase 8)

Flag `globalCompetency` (FF_GLOBAL_COMPETENCY, default OFF). An ADDITIVE region dimension over five
"global deployability" surfaces, each mapped 1:1 to a canonical backing table:
role_library→onto_roles, benchmarks→bench_cohorts, competency_models→onto_competencies,
readiness_models→career_readiness_history, demand_intelligence→wos_market_signals. Regions:
IN(default)/ME/EU/US/APAC.

## The threading mechanism is ONE overlay table, never an ALTER
`global_region_content (surface, region_code, entity_ref, provenance, detail)` tags an EXISTING
entity (in its surface's own id space) to a region. Existing surface tables are NEVER altered —
that is what keeps flag-OFF byte-identical *including schema*. Coverage is two axes that must stay
separate: the DEFAULT region (IN) inherits the REAL backing-table COUNT(*) (== today, India-centric);
non-default regions count overlay rows only → honest ZEROS until content is assigned.

**Why:** "globally deployable" = mechanism ready, NOT per-region data authored. Authoring regional
benchmarks/roles/demand is content acquisition, explicitly out of scope. A non-default region
showing 0 is the honest finding, not a defect.

## Honesty guard the first review caught (don't ship without it)
The write path (`assignRegionContent`) MUST verify each `entity_ref` actually EXISTS in the surface's
backing table (`WHERE id::text = ANY($1)`) and REJECT unknown refs (fail-closed if the table is
unreadable). Without it, a super-admin could tag arbitrary/nonexistent ids and inflate
`effective_content` — i.e. fabricate regional coverage. The route returns 400 when nothing valid was
tagged so a caller can't believe coverage changed when it didn't. Each backing table happens to have a
single `id` column (onto_*/bench text, *_history/wos bigint) → cast `::text` and ANY-match.

**How to apply:** any future "tag existing entity to dimension X" overlay needs an existence check
against the real table before insert; treat unverifiable (missing/unreadable table) as reject, not allow.

## Content half AUTHORED (the "0 rows" is no longer the resting state)
The original "non-default regions show 0 = honest finding, content out of scope" boundary was
LIFTED by a later task: `scripts/seed-global-region-content.ts` region-tags EXISTING universal
entities to ME/EU/US/APAC (provenance `phase8_global_competency`, idempotent). It seeds 4/5
surfaces — role_library, competency_models, benchmarks, demand_intelligence — and DELIBERATELY
omits `readiness_models` (career_readiness_history = subject-specific user snapshots, NOT
regionalizable) and India-population statistical cohorts `coh_role_*` (benchmark overlay is an
honest SUBSET, 10 of 15). This is **universal-inheritance curation**, NOT region-native statistics —
documented in each row's `detail.basis`. The existence guard still applies (0 rejections = all refs real).

**Why:** a region dimension with 0 content scored a low PARTIAL (D12 42→75). Tagging existing
region-agnostic entities (universal roles, the scientific competency genome, global cohorts/signals)
to a region is scope DECLARATION, not fabrication — distinct from inventing region-specific numbers.

The localized read path is `resolveRegionContent(pool, region)` + `GET /content/:region`: default
region serves base tables; non-default serves the curated overlay ONLY (surface w/o content →
`source:'empty'`, never a silent base fallback). If you re-run audits, expect non-default regions
NON-empty now — the smoke assertion was flipped accordingly (don't "fix" it back to all-empty).

## Region-NATIVE data added on top (D12 75→85) — differentiation, not just inheritance
A later task added REAL region-specific data so US/EU/ME/APAC differ from each other (not only from IN):
region-native `wos_market_signals` (non-global `geography`, provenance `region_native_market_v1` in
`context`) + region market-benchmark cohorts (`bench_cohorts.cohort_type='region'` + new nullable
`geography` col, real wages/workforce/demand in `filters`, NO fabricated `bench_cohort_statistics`).
Each row carries source_name/source_url/as_of/metric_unit/confidence (gov stats ~0.9 > IGO forecast
~0.75 > consultancy survey ~0.55). **Figures across rows are NOT comparable** (10-yr projection vs YoY
vs demand-to-2030 vs talent-shortage share) — unit lives per-row, never imply comparability.

**Default-region byte-identical trap (the key engine change):** region-native rows live in the SAME
backing tables IN reads wholesale, so they'd leak into India's base count. Fix = per-surface
`baseFilter` in `SURFACES` applied ONLY on the default-region count+read: demand excludes
`geography IN (non-default codes)`, benchmarks excludes `cohort_type='region'`. Because these rows
didn't exist before, the filter keeps IN byte-identical (verified IN benchmarks=15/demand=81 unchanged).
Non-default regions read the overlay only, so the filter never touches them. Seeds run via
`scripts/seed-region-native-market.ts` (idempotent: delete-by-provenance/source/id first). Per
merged-task-data-not-in-live-db: the overlay was EMPTY in this env (prior seed ran isolated) — had to
re-run BOTH seeds here; prod needs them re-run too.

## Audit trail (who changed what, when)
Every region-content mutation is recorded in append-only `global_region_content_audit`
(action assign|untag|rollback, surface, region_code, actor_id/actor_email from `req.user`,
requested/applied/rejected refs arrays + counts, detail JSONB, created_at). Read via
`GET /api/global-competency/audit?region=&surface=&limit=` (to_regclass probe, `present:false`
vs empty). The honesty rule that drove the design: **rejected/failed refs are stored in
`rejected_refs`, NEVER counted as applied** — so `assignRegionContent` had to return its
`valid` refs (applied) and `untagRegionContent` had to add `RETURNING entity_ref` (deleted_refs)
so the route can record what ACTUALLY took effect, not just the request. `recordRegionAudit`
is best-effort (swallows errors) so an audit failure never breaks the mutation it logs. Even a
fully-rejected assign (400 `no_valid_entity_refs`) writes an audit row with applied=[]. Panel
surfaces it as a read-only "Change history" table keyed off the selected region.

## Discipline that held
GET handlers use `to_regclass` probes + degrade (200 {degraded:true}); ensure-schema runs ONLY on POST
behind the flag, so flag-OFF never creates the overlay table via HTTP. null=table unreadable vs 0=empty
is preserved end-to-end. Fully reversible: `rollbackRegionContent(provenance)` deletes by provenance
(evidence demo uses its own provenance `phase8_evidence_demo` and cleans up — never blanket-wipes the
shared PROD DB). All routes requireAuth+requireSuperAdmin+flagGate.
