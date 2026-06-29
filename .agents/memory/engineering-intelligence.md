---
name: Engineering Intelligence Engine (MX-800 2.3)
description: Why the aggregate composer must memoize its expensive sources, and the honesty/flag contract for the engineering-intelligence tier.
---

# Engineering Intelligence Engine (MX-800 Phase 2.3)

Read-only ENHANCEMENT-ONLY composer (flag `engineeringIntelligence`, default OFF, byte-identical incl. schema) over the MX-700 1.37–1.40 getters + MEASURED filesystem scans of `backend/services`+`backend/routes`+manifest. 2 tables (`engineering_knowledge_registry`, `engineering_intelligence_audit_snapshots`). 9 parts; metrics are 6 SEPARATE scores with NO composite.

## Gather EXACTLY ONCE — the load-bearing lesson
**Rule:** an aggregate getter that composes other getters which each run a full-repo filesystem scan MUST gather each expensive source exactly once and reuse it; never let `capture`/`summary`/`metrics`/`reasoning`/`validation` each independently re-derive the same scans.

**Why:** the first implementation had `captureEngineeringSnapshot` + `getEngineeringSummary` fan out so that every part re-ran the ~700-file repo scan AND the composed repo-health/metrics/validation getters (each doing its OWN repo scan). A single capture re-derived the same sources dozens of times → minutes-long hang + connection-pool exhaustion. It surfaced confusingly: sometimes a flaky harness kill (`-1`/no-output), sometimes a misleading `relation "..._audit_snapshots" does not exist` (the table existed right before capture — capture was hanging, not missing the table). This is the same trap recorded for MX-700 1.43.

**How to apply:** a short-TTL promise memo (`memo(key, fn)`, 8s) wraps the 3 filesystem scans (`scanEngineeringFiles`/`readLibraries`/`measureImportEdges`) and 8 composed-getter wrappers (`repoHealth`/`lcMetrics`/`lcValidation`/`compatIntel`/`debtMarkers`/`techDebt`/`evoValidation`/`evoMetrics`). It dedupes in-flight promises within a request and reuses for a few seconds. Rejections are NOT cached (delete-on-throw) so transient failures don't stick. Data is read-only intelligence so the staleness window is irrelevant (mirrors the existing 60s admin cache). The memo only ever runs on flag-ON aggregate paths, so flag-OFF stays byte-identical.

## Debugging note
If an isolated repro of `ensureSchema`/`discover` creates both tables fine but the validator's `capture` fails with "relation does not exist", suspect a HANG (slow fan-out / pool exhaustion) presenting as a kill-induced error — not a real missing-table bug. Repro capture in isolation with a short `timeout`; a 124 (timeout) confirms it's perf, not DDL.

## Contract (same as sibling MX-700/800 tiers)
- AST/instrumentation metrics (complexity/cohesion/duplication/maintainability_index/line_coverage/api-deps) = honest NULL DEFERRED, never 0.
- owner/documentation_ref MANAGED (preserved on re-discover) ⟂ measurement DERIVED (refreshed).
- Writes (discover/register/audit-capture) assert flag + own lazy ensure-schema before DDL → OFF creates 0 tables; reads `to_regclass`-probe, never DDL.
- Validator drops both tables at start AND end (idempotent + restores OFF byte-identical). Run with `FF_ENGINEERING_INTELLIGENCE=1` → 32/32.
