---
name: Competency spine unified read (dual-ledger union)
description: The canonical read-only resolver that unions both competency scoring ledgers, and the two honesty traps it must uphold.
---

# Unified competency read = UNION of BOTH scoring ledgers

The platform scores competency into TWO parallel ledgers at DIFFERENT granularities:
- `onto_competency_score_runs` — per-COMPETENCY (`comp_*`), normalized scores.
- `onto_competency_profiles` — per-DOMAIN (`dom_*`), 1 append-only row per scoring run.

A canonical read MUST union both (latest row per subject per ledger). A read that
hits only one ledger reports the other ledger's subjects as unscored — the dual-ledger
trap. The headline "overall" can legitimately be **null** even when a ledger row exists
(e.g. a normalized run whose `overall` JSON carries no `overall_score`/`score`) — that is
honest, never coerce it to 0.

**Why:** consumers were each picking one ledger, so "scored subjects" counts silently
disagreed depending on which path scored the subject.

## Two non-obvious traps a subject-scoped competency read must handle

1. **Operator-supplied subject_id ⇒ requireAuth-only is an IDOR.** `subject_id` is NOT
   the caller's user id — it's whatever the scoring operator supplied. So a
   `GET …/profile/:subjectId` behind plain `requireAuth` lets any authed user read any
   subject. Guard with self-only-or-super-admin (super_admin → any subject; everyone else
   pinned to `subjectId === authId`, cross-subject → 403). Same shape as
   behavioural-memory `resolveEffectiveUserId`; keep the guard local to the module.

2. **Degrade (table missing) must be distinguishable from honest-empty (no rows).** A
   ledger reader that returns `null` for both "table absent" and "subject has no rows"
   makes a degraded substrate look identical to a subject with no scores. Have readers
   return `{tablePresent, row}`: missing/inaccessible table → `tablePresent:false`;
   present-but-no-rows → `tablePresent:true, row:null`. Top-level `available` =
   `runRead.tablePresent || profileRead.tablePresent`; both absent → `available:false`
   with an explicit "degraded, not empty" note (still zero scores, nothing fabricated).

**How to apply:** any future subject-scoped competency endpoint reuses this self-only /
super-admin authorization policy and the `{tablePresent,row}` degrade signaling. See also
[competency-runtime-dual-scoring-ledger.md](competency-runtime-dual-scoring-ledger.md).

## onto subject is keyed by EMAIL, but the session has no email field

The onto ledgers' `subject_id` for candidates is the **email** (e.g. `x@example.com`),
which equals `users.username` in this system. The deserialized session `req.user` exposes
`{id, username, fullName, role, ...}` with **NO `email` field**, and the route helper
`callerId(req)` returns `String(user.id)` — the numeric id, **not** the email. So a
self-only candidate endpoint that wants precise onto scores must resolve the subject as
`req.user.username` (fall back to `SELECT email, username FROM users WHERE id = $1`), NOT
`callerId`. Passing the id straight to `resolveUnifiedCompetencyProfile` silently resolves
nothing (honest-empty, but wrong subject).

**Why:** candidate AssessmentTab precise-score surfacing (`GET /api/competency/precise-scores`)
needed the per-competency (`granularity:'competency'`) scores keyed by email while the auth
principal is an id; passing the id resolved nothing. **How to apply:** for any self-scoped onto read, derive the email
subject from `username`; keep it param-less (subject from session) so there's no IDOR to
guard. The unified resolver labels precise vs `domain` proxy and never fabricates, so the
UI just filters `granularity` and falls back to domain when precise is absent.
