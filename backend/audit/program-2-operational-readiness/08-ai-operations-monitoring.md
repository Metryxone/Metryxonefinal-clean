# CAPADEX 3.0 · Program 2 · Phase 2.5 — AI Operations Monitoring Report

> Deliverable 08 · Generated 2026-07-01T04:31:00.104Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:04e6998b3d95, written 2026-07-01T04:31:00.104Z).
> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.

Certifies the **ai_operations** axis: structural coverage **100**.

### AI Operations (`ai_operations`)
- **Certification axis**: `ai_operations`
- **Coverage status**: **SUPPORTED** · structural coverage **100%**
- **Validated signals**: Provider · Model · Latency · Retry Behaviour · Failure Analysis · Confidence · Cost · Token Usage
- **Reused substrate (verified vs live FS+DB, never invoked)**: svc 3/3 · routes 1/1 · fe 0/0 · tbl 1/1
- **Absent evidence (honest)**: —
- **Adoption (SEPARATE axis — real volume)**: table `ai_runtime_monitoring` present, rows **0**
- **Honest note**: AI health (checkAIHealth), provider/model, latency and retry behaviour are observable + persisted to ai_runtime_monitoring. GAP-OPS-4 CLOSED: per-request TOKEN + COST accounting (prompt/completion tokens × per-1k pricing) is now recorded fire-and-forget from aiClient into ops_ai_token_usage and summarised at /api/operational-readiness/ai/token-usage. Real token volume is a SEPARATE Adoption axis (honest-low/0 in dev).

## AI-ops reality (honest)
- Present: AI health probe, provider/model, latency, retry behaviour, failure analysis — persisted to `ai_runtime_monitoring`.
- Absent: per-request **cost** and **token usage** accounting (see gap GAP-OPS-4) — reported honestly, never fabricated as 0.
