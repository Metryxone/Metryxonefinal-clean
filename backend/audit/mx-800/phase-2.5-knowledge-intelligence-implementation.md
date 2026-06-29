# MX-800 Phase 2.5 — Knowledge Intelligence Engine (Implementation)

**Status:** Built · flag-gated OFF byte-identical (incl. schema) · validator 47/47 · architect reviewed (1 critical injection finding RAISED → FIXED → re-validated) · **STOP for approval — NO deploy.**

## What this is
An **ENHANCEMENT-ONLY, read-only** intelligence tier that **CONNECTS** the platform's already-shipped
ontology/knowledge assets into ONE **Enterprise Knowledge Graph that is COMPUTED ON READ** (a
projection over existing tables — never materialized, never a second copy). It introduces no new
business logic, no rebuild/V2, no parallel/duplicate knowledge graph or ontology or registry, and
**no dormant activation** (building it turns nothing on — it only observes).

- **Flag:** `knowledgeIntelligenceEngine` / `FF_KNOWLEDGE_INTELLIGENCE_ENGINE` (default **OFF**).
  Helper `isKnowledgeIntelligenceEngineEnabled()` in `backend/config/feature-flags.ts`.
- **Base:** `/api/admin/knowledge-intelligence`
- **Service:** `backend/services/knowledge-intelligence.ts`
- **Route:** `backend/routes/knowledge-intelligence.ts`
  (`registerKnowledgeIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin)`), wired in `routes.ts`.
- **Migration:** `backend/migrations/20261224_knowledge_intelligence.sql` — 2 tables
  `knowledge_source_registry` + `knowledge_intelligence_audit_snapshots` (the ONLY tables this engine owns).
- **Read-only substrate (NEVER written):** `ont_*` taxonomy, `onto_*` competency genome, `map_*` edges,
  bare `kg_edges` (live Employability graph), `pil_kg_*` / `tig_*` graphs, `sci_*` semantic relationship
  stores, `cg_*` career graph, `onto_aliases`/`onto_relationships`/hierarchies, `ver_*` /
  `onto_competency_versions` versioning, and the prior intelligence-tier registries
  (`platform_intelligence_registry`, `engineering_knowledge_registry`, `runtime_component_registry`,
  `platform_lifecycle_catalog`).

## 9 parts (+ registry / summary / audit)
1. **Enterprise Knowledge Graph** — `/graph`: nodes = MEASURED entity tables + prior registries;
   edges = `map_*` + `kg_edges` + `onto_relationships` + competency hierarchy. `computed_on_read:true`,
   **`materialized:false`** (the projection is recomputed each read — NO duplicate KG). Per-domain
   breakdown + 50-source curated catalog (all DB-verified). Totals are exact `COUNT(*)` or honest-null.
2. **Semantic Intelligence** — `/semantic`: `sci_competency_relationships`, `onto_aliases`,
   `onto_relationships`, hierarchies/taxonomies MEASURED with type distributions; **contextual-meaning /
   NLP engine is ABSENT → honest-null** (`measurable:false`, `value:null` — not fabricated).
3. **Ontology Intelligence** — `/ontology`: cross-ontology bridge mapping (`ont_*` ↔ `onto_*` via
   `map_*`), STRUCTURAL integrity validation, evolution from version stores, explainability.
   **NEVER replaces or rewrites an ontology.** Referential orphan scan honest-null (DEFERRED).
4. **Knowledge Reasoning** — `/reasoning` + `/explain/:uid`: evidence-grounded **WHY relationships
   exist** (evidence = source table/FK); unknown uid → `found:false`. **NOT prediction / decision /
   recommendation** (STOP clause).
5. **Context Intelligence** — `/context`: COMPOSES the prior-tier summaries
   (platform / engineering / runtime) + ontology context; tier-reachability measured `/3`.
6. **Knowledge Validation** — `/validation`: **STRUCTURAL only** (knowledge / relationship / ontology /
   metadata / semantic / repository integrity); verdict ∈ {STRUCTURAL_VALIDATED, PARTIAL, ABSENT}.
7. **Knowledge Metrics** — `/metrics`: **SIX SEPARATE measured scores**
   `knowledge_completeness` / `relationship_coverage` / `ontology_health` / `semantic_consistency` /
   `knowledge_confidence` / `context_quality`; **deliberately NO composite/overall** (`composite:null`).
   `knowledge_confidence` is **STRUCTURAL only** (presence/integrity — not runtime/outcome confidence).
8. **Knowledge Explainability** — `/explain/:uid`: source / evidence / structural-confidence / context /
   dependencies / alternatives / repository-refs; unknown → `found:false` (no fabrication).
9. **Registry + discover** — `/registry` + `/registry/:uid` + `POST /discover` + `POST /register`:
   catalog of knowledge **SOURCES** (not a second knowledge graph); `lifecycle_uid` SOFT-links the
   MX-700 `platform_lifecycle_catalog` only when present (else honest null). `owner`/metadata MANAGED
   (preserved on re-discover) ⟂ measurement DERIVED.
- **Summary + Audit** — `/summary` composes all parts; `POST /audit/capture` = the ONLY write path
  (owns lazy ensure-schema), `/audit/drift` (not comparable < 2 snapshots) + `/audit/snapshots`.

## Honesty contract (baked into the DB helpers)
- **Exact `COUNT(*)` for population — NEVER `n_live_tup`** (stale stats read 0 for seeded tables).
- `scalar()` / `rows()` return **NULL on query ERROR** (0/`[]` only for a genuinely-empty result);
  `pct()` is null when numerator null or denominator 0/null (no fake 0%). **null ≠ 0** end-to-end
  (absent table → `present:false` + count null, never 0).
- Graph is a **projection computed on read** — `materialized:false`, no duplicate KG/ontology.
- Metrics are 6 separate axes, never composited. `knowledge_confidence` = STRUCTURAL only.
- Distinctions honored: Data≠Information≠Knowledge≠Understanding≠Reasoning≠Decision;
  Ontology≠KnowledgeGraph; Relationship≠Dependency; Coverage⟂Confidence⟂Evidence.

## Flag-gate & write discipline (byte-identical OFF incl. schema)
- Route-level `gate` (503) precedes route-level auth on every gated endpoint; a **global
  `app.use('/api/admin')` auth gate** runs first for unauth callers, so unauth OFF smoke returns 401.
  **OFF smoke ∈ {401,403,503}** — verified all 401.
- Write service fns (`discoverKnowledge` / `registerKnowledgeSource` / `captureKnowledgeSnapshot`)
  call `assertEnabled()` **before** `ensureKnowledgeSchema()` → direct/tooling callers cannot create
  schema OFF. GET paths use `to_regclass` probes and **never run DDL**. With the flag OFF, **0 tables
  are created** (DB-verified before and after smoke).

## Security (architect finding — fixed)
The architect review flagged ONE **critical** issue: `POST /register` accepts a user-supplied
`physical_table`, which flowed into `countTable()`'s interpolated `FROM "${table}"` — an identifier
SQL-injection surface (a `to_regclass` probe does **not** sanitize identifier injection).
**Fix:** added `isSafeTableIdentifier()` (strict `^[A-Za-z_][A-Za-z0-9_]*$`, ≤63 chars) enforced
**(a)** as an early explicit rejection in `registerKnowledgeSource` (`ok:false` + clear error) and
**(b)** defense-in-depth inside `countTable` itself (unsafe identifier → null, never interpolated).
A negative security test in the validator proves a malicious payload is rejected, writes no row, and
leaves the target table intact.

## Validation
`backend/scripts/mx800-2.5-knowledge-validate.ts` — run with the flag ON:
```
cd backend && FF_KNOWLEDGE_INTELLIGENCE_ENGINE=1 npx tsx scripts/mx800-2.5-knowledge-validate.ts
```
**47 passed / 0 failed.** Covers all 9 parts + the honesty contract (null≠0, 6 separate metrics with
no composite, computed-on-read/`materialized:false`, STRUCTURAL confidence, contextual-meaning
honest-null), proves **reads never write to existing knowledge tables** (exact COUNT(*) unchanged on 5
sentinel tables incl. `ont_competencies` / `kg_edges` / `sci_competency_relationships`), the injection
rejection, owner-preservation on re-discover, and cleanup that restores 0 owned tables.

No frontend (STOP clause). **STOP for approval — NO deploy.**
