# Live Avatar Interview — verification log

This file records each actual verification attempt, with the honest outcome of
what was observed. It complements `RUNBOOK.md` (the reusable human checklist) and
`verify-live-avatar.ts` (the server-side harness).

> Honesty rule (inherited from the runbook): if a step cannot be observed, it is
> recorded as **NOT VERIFIED** — never inferred as a pass.

---

## 2026-06-27 — automated server-side pass only (Task #227, agent)

**Who ran it:** Replit agent (no human, no webcam/mic, no paid provider account).

**Environment observed at run time:**

| Variable | State |
| --- | --- |
| `HEYGEN_API_KEY` | unset |
| `HEYGEN_AVATAR_ID` | unset |
| `HEYGEN_VOICE_ID` | unset |
| `OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_API_KEY` | unset |
| `FF_LIVE_AVATAR_INTERVIEW` | `1` (flag ON) |

Because the four provider credentials are absent, only the **degradation** mode of
the harness could be exercised. Paid HeyGen Interactive/Streaming Avatar keys and
an OpenAI key are required for the positive path, and a person at a webcam + mic is
required for Part B — neither is available to an automated agent.

**Part A — server-side seams (degradation mode): 4/4 PASS**

```
=== Live Avatar Interview — server-side verification ===
flag liveAvatarInterview : ON
HeyGen configured        : false
OpenAI configured        : false
max duration             : 720000 ms (12 min)
mode                     : DEGRADATION (keys absent)

  [PASS] readiness/composition — /live/enabled ready = connected(false) && aiReady(false) = false
  [PASS] token/mint(degradation) — honest 503: AvatarUnavailable("Avatar presenter is not configured...") — no fabricated token
  [PASS] orchestration(degradation) — authored_fallback delivers the verbatim first authored question (q1) — nothing fabricated
  [PASS] orchestration/closing — all authored questions asked → done=true, source=authored_fallback

4/4 checks passed
```

This proves the **honest no-op**: with no keys, readiness is `false`, the token
mint throws `AvatarUnavailable` (no fake token), and orchestration falls back to
the verbatim authored question — nothing is fabricated.

**What is still NOT VERIFIED (and why):**

- Part A **positive** mode (real streaming token minted, `source='llm'`, `ready=true`)
  — requires real paid HeyGen + OpenAI keys, which were not present and cannot be
  procured by an agent.
- B1–B8 (live greet/authored order, ≤1 follow-up, off-topic redirect, close,
  recording + transcript surviving refresh, 5-dim score with honest abstain,
  max-duration cap → scored report, End & Score → scored report) — require a human
  speaking into a webcam + mic to drive a live two-way WebRTC conversation. An agent
  cannot perform this.

**Conclusion:** The automatable half is green (honest degradation). The live
browser interview remains **deferred to a human** with paid provider keys. Do not
mark the feature launch-ready until the positive harness run and B1–B8 are observed
and recorded below.

---

## (template) next run — positive mode + Part B

Copy the block above, set the date and "Who ran it", paste the positive-mode
harness output (must be 4/4), and fill the sign-off table from RUNBOOK.md with what
was actually observed for B1–B8.
