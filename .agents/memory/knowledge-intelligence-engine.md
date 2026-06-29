---
name: Knowledge Intelligence Engine (MX-800 Phase 2.5)
description: Read-only composer projecting existing ontology/knowledge assets into an Enterprise Knowledge Graph COMPUTED ON READ; durable traps (computed-on-read not materialized, reads-never-write, identifier-injection guard on /register).
---

# Knowledge Intelligence Engine (MX-800 Phase 2.5)

Flag `knowledgeIntelligenceEngine` / `FF_KNOWLEDGE_INTELLIGENCE_ENGINE` (default OFF, byte-identical
incl. schema). ENHANCEMENT-ONLY read-only tier that CONNECTS existing ontology/knowledge assets into
ONE Enterprise Knowledge Graph. Same flag-gate + honesty scaffold as MX-800 2.3/2.4.

## Durable lessons (not re-derivable from code)

- **Computed-on-read ≠ materialized.** The whole point of this phase is that the "Enterprise Knowledge
  Graph" is a PROJECTION recomputed on every read (`computed_on_read:true`, `materialized:false`) over
  the existing `ont_*`/`onto_*`/`map_*`/`kg_edges`/`sci_*` substrate. Do NOT add a table that stores
  graph nodes/edges — that would be a duplicate KG and a contract violation. The engine owns ONLY 2
  tables (source registry + audit snapshots); everything else is read.
  **Why:** user pref Ontology≠KnowledgeGraph + NEVER duplicate a knowledge graph; a materialized copy
  drifts from the live substrate and silently lies.

- **A read tier must PROVE it never writes.** Because this composes ~50 existing knowledge tables, the
  validator records exact `COUNT(*)` on sentinel tables (`ont_competencies`, `kg_edges`,
  `sci_competency_relationships`, …) BEFORE exercising all read parts and asserts COUNT-unchanged
  AFTER. "I only wrote SELECTs" is not evidence; the count delta is.
  **Why:** a shared getter that runs ensure-schema DDL, or a reasoning path that upserts, would
  silently mutate the live knowledge graph. The honesty pass demands a measured no-write proof.

- **Identifier SQL-injection on the manual-register path (architect-caught critical).** Curated-catalog
  table names are safe, but `POST /register` takes a user-supplied `physical_table` that flows into
  `countTable()`'s `FROM "${table}"`. A `to_regclass` probe does NOT sanitize identifier injection.
  Guard with a strict `isSafeTableIdentifier()` (`^[A-Za-z_][A-Za-z0-9_]*$`, ≤63 chars) BOTH as an
  explicit early reject in `registerKnowledgeSource` AND defense-in-depth inside `countTable` itself
  (unsafe → null, never interpolated). Add a negative test (malicious payload → ok:false, no row,
  target table intact).
  **Why:** any service that interpolates a table identifier from request input is an injection vector;
  parameterization can't bind identifiers, so a regex allowlist before interpolation is the defense.

- **Metrics: 6 separate axes, `composite:null`.** knowledge_completeness / relationship_coverage /
  ontology_health / semantic_consistency / knowledge_confidence / context_quality. `knowledge_confidence`
  is STRUCTURAL only (presence/integrity), NOT runtime/outcome confidence — keep it on the `confidence`
  axis, never blend with coverage.

- **Honest-null surfaces that look like "missing features":** contextual-meaning/NLP engine is ABSENT
  (`measurable:false`, `value:null`), referential orphan scan DEFERRED (honest-null), nodes/edges null
  when a source table is absent. null ≠ 0 — the DB helpers (`scalar`/`rows` NULL on query ERROR,
  `pct` null on null-num or 0/null-denom) enforce this; don't coerce to 0 at call sites.

## Pointers
- Service `backend/services/knowledge-intelligence.ts` · Route `backend/routes/knowledge-intelligence.ts`
  (BASE `/api/admin/knowledge-intelligence`) · Migration `20261224_knowledge_intelligence.sql`.
- Validator `backend/scripts/mx800-2.5-knowledge-validate.ts` (47/47;
  `FF_KNOWLEDGE_INTELLIGENCE_ENGINE=1 npx tsx ...`).
- Deliverable `backend/audit/mx-800/phase-2.5-knowledge-intelligence-implementation.md`.
- Sibling tiers: `.agents/memory/runtime-intelligence-engine.md`, `engineering-intelligence.md`,
  `platform-intelligence-registry.md`.
