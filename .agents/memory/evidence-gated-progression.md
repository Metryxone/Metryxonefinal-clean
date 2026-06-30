---
name: Evidence-gated stage progression (CAPADEX 3.0)
description: Read-time evidence gate over completion-only CAPADEX stage progression; why concern score must stay non-gating.
---

# Evidence-gated stage progression (CAPADEX 3.0, Program 2)

Flag `evidenceGatedProgression` / `FF_EVIDENCE_GATED_PROGRESSION` (default OFF).
Service `backend/services/capadex/evidence-gate.ts` (pure `evaluateStageEvidence`
+ `enrichProgressWithEvidence`, never-throws, legacy fallback). Wired into
`routes/capadex.ts buildProgress`: flag ON → enrich, OFF → exact legacy array.
Read-time composition only — NO tables/DDL, so byte-identical OFF incl schema is
trivial. Verdicts: verified / insufficient_evidence / in_progress / not_started /
blocked. Coverage (has_session/has_score/score) ⟂ Confidence (level/age_days/fresh)
kept SEPARATE. `EVIDENCE_FRESHNESS_DAYS=180` drives `due_for_remeasurement`
(read-only display heuristic, no scheduler).

**Rule: concern score must NOT be a progression gate.**
**Why:** CAPADEX score is concern-DIAGNOSTIC (a wellbeing/behavioural signal),
not competency-mastery. Blocking a learner from a supportive next stage because a
concern score is "low" is harmful and violates the strengths-canon. The plan's
`below_bar` BLOCKING verdict was deliberately downgraded to a non-gating
`gate.informational.below_reference_band` annotation.
**How to apply:** any future progression/gating work keyed on CAPADEX score must
gate on evidence integrity (Coverage) + freshness (Confidence), never on score
magnitude.

**Honest impact:** real completed sessions always carry a computed score (the
`/complete` route persists it), so ON vs OFF lock/unlock delta ≈ 0 for normal
users. The gate's value is integrity (no advancing on an evidence-less
"completed" row) + the GAP-P1 re-measurement signal — NOT gatekeeping. State this
rather than inflating the gate's effect.

**Verification quirk:** the verified path can't be HTTP-smoked in dev — the shared
dev DB has no completed session with non-null score + non-null guest_email. Cover
it with the deterministic unit test (`scripts/task304-evidence-gate-verify.ts`),
report the HTTP gap as an honest data limitation, not a defect.
