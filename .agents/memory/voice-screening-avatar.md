---
name: Voice-screening avatar (video interview) channel
description: How the avatar (HeyGen) video-interview layer is bolted onto employer AI voice screening without disturbing the existing flow.
---

# Avatar video interview channel (employer voice screening)

The avatar/video-interview layer is **strictly additive** on top of the existing
employer AI Voice Bot Screening. It is gated by `avatarInterview` / `FF_AVATAR_INTERVIEW`
(default OFF).

**Rule: flag-OFF is byte-identical INCLUDING schema.** This holds because the avatar
layer lives entirely in its OWN tables (`voice_avatar_question_videos` cache,
`voice_avatar_answer_videos` BYTEA) and its OWN `/avatar/*` endpoints — it never touches
the existing `voice_screening_*` schema or endpoints. The flag gate (`avatarFlagGate`)
returns 503 BEFORE `requireAuth` and BEFORE `ensureAvatarSchema`, so flag-OFF creates no
tables and runs no DDL.
**Why:** founder requires flag-off to be a true no-op (schema included), not just hidden UI.

**One scorer, two channels.** Avatar answers are written into the SAME
`voice_screening_answers` rows (with the candidate video stored separately in
`voice_avatar_answer_videos`), so the EXISTING Whisper STT + 5-dim scorer and the
existing `/finalize` endpoint are reused verbatim. Do NOT build a parallel scorer.

**Frontend wiring traps (EmployerPortalPage `RealVoiceScreeningTab`):**
- The recording modal is shared between audio + avatar; `session.mode` ('audio'|'avatar')
  branches it. `mr.onstop` is set in `startRec` vs `startVideoRec` to route to the right
  uploader; `stopRec` is reused by both.
- The report's "Load video answers" needs the avatar SESSION id, not the candidate id —
  track it in an `avatarSessionIds` map (populated in finalize AND in hydrate when
  `sess.channel === 'avatar'`, using `sess._id`) so reports survive a refresh.
- Backend GET `/avatar/sessions/:id/answers` returns `answerId` (not `id`); use that field
  for the per-answer video fetch + React keys.
- Blob-URL cleanup MUST be unmount-only via a ref snapshot
  (`useEffect(() => () => revoke(ref.current), [])`). A `[answerVideoUrls]`-bound cleanup
  revokes still-shown video URLs on every change — and `loadAnswerVideo` short-circuits on
  an existing key, so the revoked URL becomes unrecoverable without a refresh.
- Video stream endpoint is employer-scoped (`WHERE answer_id=$1 AND employer_id=$2`) +
  `Cache-Control: private, no-store` — keep it that way (IDOR/privacy).

**Probe contract trap:** `avatarStatus()` exposes `connected` (honest credential flag), but
the frontend CTA gate reads `configured`. The `/avatar/enabled` route MUST return BOTH
(`configured` aliased from `connected`) or the "Video Avatar" button never appears even when
HeyGen is fully configured. Keep API + UI field names aligned.
**Why:** a silent field-name mismatch passes build + flag-OFF checks but blocks the whole
feature when ON.

**Activation (founder step, NOT done in build):** set HEYGEN_API_KEY / HEYGEN_AVATAR_ID /
HEYGEN_VOICE_ID and flip `FF_AVATAR_INTERVIEW=1` in the live workflow. Unconfigured →
honest 503 via `AvatarUnavailable`; never fabricate a video.

A live-conversational variant (avatar talks back in real time) is the natural follow-on —
this Option A is record-and-score only; do not conflate the two.

# Live avatar interview (Option B) — real-time two-way conversation

Option B is a SECOND additive layer on the SAME employer voice screening, gated by an
INDEPENDENT flag `liveAvatarInterview` / `FF_LIVE_AVATAR_INTERVIEW` (default OFF, distinct
from Option A's `avatarInterview`). channel = `'live_avatar'`. Same flag-OFF-byte-identical-
including-schema rule, same honesty contract, and it REUSES Option A's HeyGen seam +
`scoreScreening` verbatim — do not duplicate the provider seam or the scorer.

**Provider split — token vs API key.** Option A drives a server-side video render; Option B
uses HeyGen's **Streaming/Interactive Avatar** (WebRTC) in the BROWSER. So the live seam mints
a short-lived **streaming token** server-side (`createLiveAvatarToken()` → POST
`/v1/streaming.create_token`) and the browser SDK (`@heygen/streaming-avatar`, dynamic-imported
from esm.sh — never `npm install` into `frontend/`, mockup-prune trap) connects with that token.
The API key NEVER reaches the browser. Needs BOTH HeyGen (token) AND OpenAI (orchestrator) →
`/live/enabled` returns `ready = connected && aiReady`; either missing → honest 503, never a
fabricated session.

**Wire contract (easy to get wrong — verified):** `POST /live/sessions` returns the token
NESTED under `live: { token, avatarId, voiceId, maxDurationMs }` (not flat). `/next` returns
FLAT `{utterance,questionId,isFollowUp,done,source}`. `/turns` GET returns `{turns:[...]}`,
`/finalize` returns `{session}`. Video upload field name is `video` + `durationMs` (multipart →
use the Authorization-only header, not the JSON header).

**Orchestration = interviewer prompts only, never the candidate's answers.** `orchestrateNextTurn`
asks the LLM for the next interviewer turn as strict JSON; on any error/unconfigured it degrades
DETERMINISTICALLY to the next un-asked AUTHORED question (authored = not fabricated). Candidate
turns carry REAL captured ASR text. Finalize groups candidate turns by the authored questionId
they answered (falling back to the most-recent authored question delivered) → `AnswerInput[]` →
the shared scorer (abstains/null≠0 preserved).

**Two server-authoritative guards a prompt alone can't enforce (added after review):**
- **Max-duration is billable** → enforce server-side, not just the UI countdown. Compute elapsed
  from session `created_at` vs `LIVE_AVATAR_MAX_DURATION_MS` and reject `/next` + `/turns` with
  **409 `{expired:true}`** once over the cap (leave `/video` + `/finalize` OPEN so the partial
  recording + score still save). The frontend treats 409-expired as a clean "done" → finalize.
  **Why:** a tampered client could otherwise run realtime avatar minutes indefinitely.
- **≤1 follow-up per authored question** → prompt-only is not enough. The `/next` route derives
  `followUpUsedForActiveQuestion` from the persisted turns (resets on each new authored question)
  and passes it to the orchestrator, which converts a drifting second follow-up into the next
  authored question. **Why:** repeated follow-ups inflate turns/cost and delay coverage.

**Own tables:** `voice_live_avatar_turns` (turn-by-turn transcript) + `voice_live_avatar_videos`
(BYTEA, one per session, replace-on-reupload). All live routes employer_id-scoped (IDOR); video
served `private, no-store`. Report block keys on `result.channel === 'live_avatar'` (🔴 badge +
transcript via `/turns` + full-session recording via `/live/sessions/:id/video`), and needs a
`liveSessionIds` map (from finalize AND hydrate) to survive a refresh — same pattern as Option A.
