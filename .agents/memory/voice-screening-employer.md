---
name: Voice Screening (Employer Portal ScreeningTab)
description: Real browser-recorded voice screening (MediaRecorder->Whisper STT->LLM rubric) replacing the seeded simulation; flag-gated, AI-inert-honest.
---

# Voice Screening (Employer Portal)

The employer ScreeningTab has TWO implementations that must stay separable: the
original candidateId-seeded **simulation** (`LegacyScreeningSimulationTab`) and a
real flow (`RealVoiceScreeningTab`: browser MediaRecorder -> Whisper STT
(gpt-4o-mini-transcribe) -> LLM rubric scoring across 5 voice dimensions). Flag
`voiceScreening` (default OFF).

## Durable lessons / traps
- **Flag-OFF byte-identical requires the LEGACY code path, not a disabled real
  view:** a thin `ScreeningTab` wrapper probes `/enabled` and renders
  `LegacyScreeningSimulationTab` while probing OR when `enabled !== true`; only
  `enabled === true` mounts the real tab. **Why:** "flag-off = byte-identical"
  means the user sees the EXACT prior simulation UI/behavior, so keep the original
  verbatim as its own component rather than gating branches inside the real one.
- **Rubric must travel with the stored question set, keyed by question id:** the
  authored `expectedResponse`/`scoringCriteria` live on the bank
  (`interview-question-bank.ts` `selectQuestions`, 4-tier role->industry->General
  ->whole-bank fallback). They are persisted on `session.questions` JSONB and, at
  finalize, re-attached to each answer via a `question_id` map before scoring.
  **Why:** the scorer can only grade against a rubric if finalize rejoins answers
  to their authored question; answers table alone has no rubric.
- **Phone-leg is a provider seam, honest-disabled, never faked:**
  `voice-screening-twilio.ts` `initiateOutboundCall` ALWAYS throws
  `TwilioUnavailable` (-> 503) and `isTwilioConfigured()` reflects env only; UI
  shows a "coming soon" card while browser recording stays fully active. **Why:**
  scaffolding a future channel must not imply it works.
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
