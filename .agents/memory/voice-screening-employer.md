---
name: Voice Screening (Employer Portal ScreeningTab)
description: Real browser-recorded voice screening (MediaRecorder->Whisper STT->LLM rubric) replacing the seeded simulation; flag-gated, AI-inert-honest.
---

# Voice Screening (Employer Portal)

Replaced the candidateId-seeded ScreeningTab simulation with a real flow:
browser MediaRecorder -> Whisper STT (gpt-4o-mini-transcribe) -> LLM rubric
scoring across 5 voice dimensions. Flag `voiceScreening` (default OFF).

## Durable lessons / traps
- **Flag-gate ordering for byte-identical-OFF including schema:** every mutating/
  read route applies `flagGate` BEFORE the handler, and `ensureVoiceSchema()` is
  called only INSIDE flag-gated handlers — so no voice DDL is reachable when the
  flag is OFF. The probe `/enabled` is the ONLY non-DDL route (returns
  `{enabled, aiReady}`) and is safe to register unconditionally.
  **Why:** flag-off must be byte-identical incl. schema; a lazy ensure-schema run
  on an ungated probe would create tables with the flag off.
- **Unauth requests on `/api/employer/*` return 401 BEFORE the route-level
  flagGate** because an upstream employer auth middleware runs first. So smoke
  tests assert membership in {401,403,503}, not a strict 503-first — same pattern
  as other global-auth-gated admin areas. POST without CSRF token = 403.
- **AI-inert honesty:** with no `OPENAI_API_KEY`, STT/scoring throw
  `VoiceAIUnavailable` -> routes 503 + `aiUnavailable:true`; `/enabled` reports
  `aiReady:false`; frontend disables "Preview & Screen" and shows a
  non-fabrication banner. Feature is honestly dormant in dev — never fakes results.
- **null != 0 end-to-end:** engine abstains (overallScore/recommendation null,
  per-dim `score:null`, `abstained:true`) when no transcripts; overall computed
  ONLY from non-null dims; frontend renders `?? '—'` / "Not assessed" and KPI
  average excludes null overalls. No silent null->0 coercion anywhere.
- **FormData header trap:** audio upload uses `tokenHdr()` (Authorization ONLY —
  must NOT set Content-Type so the browser adds the multipart boundary); JSON
  calls use `authHdr()` (Authorization + Content-Type json). The global CSRF
  monkey-patch auto-injects `x-csrf-token` on both.
- **Going live** requires the OpenAI key + enabling the flag — founder decision,
  never auto-enabled (honesty / never auto-deploy).
