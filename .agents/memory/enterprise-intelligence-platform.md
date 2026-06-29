---
name: Enterprise Intelligence Platform (MX-800 Phase 2.10)
description: Read-only flag-gated tier that registers existing intelligence domains into one enterprise registry and composes the 8 prior MX-800 tiers; honesty + perf traps.
---

# Enterprise Intelligence Platform (MX-800 Phase 2.10)

Flag `enterpriseIntelligencePlatform` / `FF_ENTERPRISE_INTELLIGENCE_PLATFORM` (default OFF, byte-identical incl. schema). Service `services/enterprise-intelligence-platform.ts`, route `routes/enterprise-intelligence-platform.ts` (BASE `/api/admin/enterprise-intelligence`), migration `20261229_enterprise_intelligence_platform.sql` (2 owned tables `enterprise_intelligence_registry` + `enterprise_intelligence_audit_snapshots`). Mirrors the 2.9 scaffold EXACTLY. This is the capstone composer over the 8 prior MX-800 tiers (2.1/2.3/2.4/2.5/2.6/2.7/2.8/2.9).

## What it is
ENHANCEMENT-ONLY, READ-ONLY. Registers the platform's EXISTING intelligence domains/services into one enterprise registry (19-entry catalog, 13 domains, 4 kinds intelligence(8)/executive(5)/organizational(4)/analytics(2)) and composes the 8 prior tiers' read-only summaries. INSIGHT-ONLY: never decides/executes/acts/modifies business logic/duplicates an engine. The 8 prior engines are composed by file EXISTENCE + persisted summary read-only — NEVER INVOKED.

## Durable lessons / traps

- **Composition fan-out runtime is the real risk (NOT OOM).** The 9 parts each compose all 8 prior-tier summaries. A monolithic validator run (read phase ~97s + capture×2 ~28s ≈ 125s) exceeded the ~120s background-process reaping/tool-cap boundary and was SIGKILLed AT the capture step — which looked like a capture/exit bug but was a pure wall-clock overrun. Capture itself is sound in isolation (foreground cap ~14s each). **Lesson: when a deep composer "fails" only under a backgrounded long run, suspect the runtime budget before OOM/process.exit truncation.**
  - **Why:** background jobs are reaped near ~120s; a foreground run of the same script completes (~40s with memo pinned) and emits the full transcript.
  - **How to apply:** run the validator FOREGROUND with the memo TTL pinned long; expect ~72 checks, 0 fail, RC=0, own tables dropped.

- **`EI_MEMO_TTL_MS` perf knob.** `MEMO_TTL_MS = clamp(Number(process.env.EI_MEMO_TTL_MS) || 8000, 0, 3_600_000)`. Default 8000ms = production unchanged/byte-identical. It only dedupes the 8-tier composition within a request window. **Reads never write regardless of cache state**, so the knob cannot change OFF behaviour or any output's correctness. The offline validator pins `EI_MEMO_TTL_MS=600000` so its ~12 back-to-back composing getters don't each recompute the composition from cold (that cold recompute is exactly what blew the runtime budget). Clamp was added on architect advice to prevent extreme-staleness misconfig.

- **Validator tally must NOT call `process.exit()`** — a bare exit truncates buffered stdout when redirected; use `process.exitCode` and let the loop drain. Earlier "63 passed" was a TRUNCATED count from the killed background run; the real complete total is **72/0**.

- **OFF smoke is 401/403, not 503.** The global `/api/admin` auth middleware fires before the route-level flag gate, so unauth GET → 401, POST → 403 (∈{401,403,503} per platform convention). The flag gate + service-layer `assertEnabled()` still enforce disabled behaviour (0 own tables OFF). Same pattern as every prior 2.x tier.

## Honesty contract (same as siblings)
6 SEPARATE metrics, NO composite (`composite:null`): enterprise_health/intelligence_coverage/intelligence_maturity(STRUCTURAL)/explainability_score/**intelligence_effectiveness(honest-null)**/**enterprise_optimization(honest-null)**. effectiveness = no labelled enterprise outcomes; optimization = no longitudinal improvement deltas. null≠0 in the DB helpers (scalar/rows NULL on query ERROR, pct null on null-num/0-denom); exact COUNT(*) NEVER n_live_tup. Correlation≠Causation (co_presence is COUNT-or-0, not a coefficient); Insight≠Decision (every insight is_decision:false); Connected≠Orchestrated (orchestration metadata-level only); Dashboard≠Intelligence; Built≠Activated (dormant caps listed as observation). `/register` `physical_table` injection-guarded by `isSafeTableIdentifier()` before interpolation. Writes assert flag THEN ensure-schema → OFF creates 0 tables.

## Validator
`scripts/mx800-2.10-enterprise-validate.ts` → run FOREGROUND: `cd backend && FF_ENTERPRISE_INTELLIGENCE_PLATFORM=1 EI_MEMO_TTL_MS=600000 npx tsx scripts/mx800-2.10-enterprise-validate.ts`. Expect 72/0, RC=0, own tables dropped (byte-identical OFF). Proves reads-never-write via sentinel COUNT(*) on existing intelligence snapshot tables + engines-never-invoked + injection-rejection.
