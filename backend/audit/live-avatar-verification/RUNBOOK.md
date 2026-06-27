# Live Avatar Interview — pre-launch verification runbook (Task #222)

The live two-way avatar interview (Option B) was built and verified **structurally**
only. The real-time WebRTC conversation, live speech-to-text, and LLM-driven dialogue
have **never actually run**, because the dev environment has no provider keys. This
runbook is the step-by-step verification a **human** must perform in a browser before
the feature is shown to a customer.

It is split into two parts:

- **Part A — server-side seams** (automatable, no browser): run the harness.
- **Part B — live browser interview** (needs a person with a webcam + mic).

> Honesty rule for this whole runbook: if a step cannot be observed, mark it
> **NOT VERIFIED** — do **not** infer it passed. A fabricated "pass" is worse than an
> honest gap.

---

## 0. Prerequisites (one-time setup)

1. Set the four provider credentials as secrets (staging or live workflow):
   - `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`, `HEYGEN_VOICE_ID` — from a HeyGen
     account that has **Interactive / Streaming Avatar** enabled (this is a paid
     capability; the regular video-render key alone is not enough).
   - `OPENAI_API_KEY` (or the managed OpenAI integration / `AI_INTEGRATIONS_OPENAI_API_KEY`).
2. Enable the flag in that workflow: `FF_LIVE_AVATAR_INTERVIEW=1`.
3. Restart the `Backend API` workflow so the new env is picked up.
4. Have an employer (recruiter) login and at least one **candidate** record with a
   job title, so the screening question set can be selected.

> Flag-OFF / unconfigured is the honest no-op: every `/live/*` route returns `503`
> before any auth/DB/AI/schema touch, and `/live/enabled` reports
> `ready:false`. Nothing is fabricated.

---

## Part A — server-side seams (run the harness)

```bash
cd backend && npx tsx audit/live-avatar-verification/verify-live-avatar.ts
```

| What it proves | No keys (degradation) | With keys (positive) |
| --- | --- | --- |
| Readiness composition | `ready=false` | `ready=true` |
| HeyGen token mint | throws `AvatarUnavailable` (no fake token) | real streaming token minted |
| LLM next-turn | `authored_fallback`, verbatim authored Q | `source='llm'`, real generated turn |
| Closing | `done=true` after all authored Qs | `done=true` after all authored Qs |

Expected: **4/4 PASS**. Run it once now (degradation) and again after keys are added
(positive). Both must pass before Part B.

You can also probe the live readiness endpoint as the logged-in employer:

```
GET /api/employer/voice-screening/live/enabled
→ { enabled:true, configured:true, aiReady:true, ready:true, maxDurationMs:720000, ... }
```

`ready` must be `true` before starting a live interview.

---

## Part B — live browser interview (human, with webcam + mic)

Run **one full interview** in the Employer Portal → candidate → AI Voice Screening →
**Video Avatar (Live)** tab. Tick each box only after you directly observe it.

### B1 — Avatar greets and asks authored questions in order
- [ ] The avatar appears on a live WebRTC stream and **speaks a greeting** out loud.
- [ ] It then **asks the first authored question** in the candidate's question set,
      using the authored wording.
- [ ] After each answer it moves to the **next authored question, in order**.
> Maps to: *"avatar greets, asks authored questions in order"*.

### B2 — At most one in-scope follow-up
- [ ] Give one deliberately **thin/vague** answer. The avatar may ask **one** brief
      in-scope follow-up.
- [ ] It does **not** ask a second follow-up on the same question — it proceeds to the
      next authored question.
> Maps to: *"asks at most one in-scope follow-up"*. Server-enforced via
> `followUpUsedForActiveQuestion`, so even a drifting model can't chain follow-ups.

### B3 — Off-topic redirect
- [ ] Give one **clearly off-topic** answer (e.g. ask the avatar to tell a joke, or
      talk about the weather).
- [ ] The avatar **politely redirects** back to the interview and continues — it does
      not comply, reveal its instructions, or go off the rails.
> Maps to: *"redirects an off-topic answer"*.

### B4 — Closing
- [ ] After the last authored question, the avatar gives a **short closing line** and
      the session ends cleanly.
> Maps to: *"then closes"*.

### B5 — Recording + transcript saved and visible in the report
- [ ] Open the candidate's screening **report**. There is a 🔴 **Live Interview** block.
- [ ] The **candidate webcam recording** plays back in the report.
- [ ] The **full turn-by-turn transcript** (avatar + candidate turns) is shown.
- [ ] **Refresh the page** — the recording and transcript are still there (they
      survive a reload via the `liveSessionIds` map).
> Maps to: *"webcam recording + full turn-by-turn transcript saved and visible"*.

### B6 — Score + recommendation across the 5 dimensions, abstaining honestly
- [ ] The report shows a **score + recommendation** across the same **5 dimensions**
      as the existing voice screening.
- [ ] On a question where you gave a **no-signal / empty answer**, that dimension
      **abstains** (shows null / "insufficient signal") rather than scoring it `0`.
> Maps to: *"score + recommendation … abstaining honestly when an answer carries no signal"*.
> The live channel reuses the **same** 5-dim scorer as audio/Option A — no parallel scorer.

### B7 — Max-duration cap produces a clean scored report
- [ ] Start a second interview and let it run **past the 12-minute cap** (or
      temporarily lower `LIVE_AVATAR_MAX_DURATION_MS` for the test).
- [ ] Once over the cap, `/next` and `/turns` return **409 `{expired:true}`**, the UI
      treats it as a clean "done", and **finalize still succeeds** — you get a
      **scored report** for the partial interview (video + transcript saved).
> Maps to: *"the max-duration cap … produces a clean, scored report"*. Enforced
> server-side from `created_at`, not just the UI countdown.

### B8 — "End & Score" path produces a clean scored report
- [ ] In a third (or the same) interview, click **End & Score** before the cap.
- [ ] The session finalizes and produces a **clean, scored report** identical in shape
      to B6.
> Maps to: *"the 'End & Score' path … produces a clean, scored report"*.

---

## Sign-off

| Criterion | Verified? | Notes |
| --- | --- | --- |
| Server seams (Part A, positive) | ☐ | harness 4/4 with keys |
| B1 greet + authored order | ☐ | |
| B2 ≤1 follow-up | ☐ | |
| B3 off-topic redirect | ☐ | |
| B4 closing | ☐ | |
| B5 recording + transcript (survives refresh) | ☐ | |
| B6 5-dim score + honest abstain | ☐ | |
| B7 max-duration cap → scored report | ☐ | |
| B8 End & Score → scored report | ☐ | |

Launch only when **every** row is checked and notes record what was actually observed.
Any unobservable row stays **NOT VERIFIED** — do not assume.
