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

## Discipline that held
GET handlers use `to_regclass` probes + degrade (200 {degraded:true}); ensure-schema runs ONLY on POST
behind the flag, so flag-OFF never creates the overlay table via HTTP. null=table unreadable vs 0=empty
is preserved end-to-end. Fully reversible: `rollbackRegionContent(provenance)` deletes by provenance
(evidence demo uses its own provenance `phase8_evidence_demo` and cleans up — never blanket-wipes the
shared PROD DB). All routes requireAuth+requireSuperAdmin+flagGate.
