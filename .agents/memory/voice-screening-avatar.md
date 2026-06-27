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

**Activation (founder step, NOT done in build):** set HEYGEN_API_KEY / HEYGEN_AVATAR_ID /
HEYGEN_VOICE_ID and flip `FF_AVATAR_INTERVIEW=1` in the live workflow. Unconfigured →
honest 503 via `AvatarUnavailable`; never fabricate a video.

Task #218 (Option B, live conversational) is the queued follow-on — do not duplicate this.
