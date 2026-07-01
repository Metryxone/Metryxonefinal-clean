# 06 — AI Performance Report

**Scope (spec):** prompt execution time, token usage, parallel requests, timeout recovery, retry
behaviour, resource consumption.

> **Honesty boundary.** In this environment **no AI provider is configured** —
> `OPENAI_API_KEY`/`AI_INTEGRATIONS_OPENAI_API_KEY` and `EMERGENT_LLM_KEY` are all **unset** (verified).
> Therefore **prompt-execution latency, token usage, and throughput are NOT measurable here**, and no
> such number is fabricated. What *is* measurable and verifiable is the **AI resilience/degradation
> architecture** in code.

## AI client architecture (repository evidence)

`backend/services/aiClient.ts` is a production-safe wrapper:

- **Resolution order:** `AI_INTEGRATIONS_OPENAI_*` → `OPENAI_*`; dev points at the local FastAPI proxy
  (`emergentintegrations`), prod uses OpenAI directly or a co-deployed proxy.
- **Health gate:** `checkAIHealth()` pings the base URL with a **3 s `AbortController` timeout**, cached
  60 s (`HEALTH_TTL_MS`). Unreachable/unconfigured → returns `{ ok:false }`.
- **Fail-fast, not hang:** callers throw a structured **`AIServiceUnavailableError` (HTTP 503)** so
  routes return a clear 503 instead of blocking a request thread on a dead provider. This is the
  correct latency-protection behaviour: a down AI provider cannot stall the event loop.

## Timeout recovery & retry behaviour

- **Timeout:** bounded (3 s) health probe + provider client timeouts; no unbounded waits.
- **Retry:** no blind retry storm on the request path; the 60 s health cache prevents hammering a dead
  endpoint on every call.
- **Degradation is tested:** `backend/tests/voice-screening-degradation.test.ts` and
  `backend/tests/live-avatar-degradation.test.ts` are dedicated suites verifying honest fallback when
  AI/voice/avatar providers are unconfigured — degradation returns `null`/source-tagged results, never
  fabricated scores. These suites pass in this environment.

## Parallel requests & resource consumption

- AI calls originate from a single Node process → parallel AI requests share the same ~1-core event-loop
  budget (report 10). AI work is I/O-bound (network to provider), so it does not pin CPU, but a burst of
  concurrent AI requests will queue like any other request.
- No AI response caching layer is present for prompt outputs (each call hits the provider) — acceptable
  given AI outputs are context-specific, but a **Future** consideration if identical prompts recur at
  volume (report 13).

## Certification

⚠️ **AI Performance — CONDITIONAL.** The **resilience architecture is CERTIFIED** (bounded timeout,
60 s health cache, fail-fast 503, tested degradation — no thread-blocking on a dead provider). **AI
latency/throughput cannot be certified from this environment** because no provider is configured. To
certify AI performance for enterprise: configure a provider (or co-deploy the FastAPI proxy) and run a
load test capturing prompt-execution p50/p95, token usage, and concurrent-request behaviour. This is a
**configuration + load-test** gap, not a code defect. (Certified independently.)
