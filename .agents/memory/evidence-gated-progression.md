---
name: Evidence-gated stage progression (CAPADEX 3.0)
description: Read-time evidence gate over completion-only CAPADEX stage progression; composes scoring + cohort-gating; why CAPADEX stage score IS a valid readiness gate.
---

# Evidence-gated stage progression (CAPADEX 3.0, Program 2)

Flag `evidenceGatedProgression` / `FF_EVIDENCE_GATED_PROGRESSION` (default OFF).
Service `backend/services/capadex/evidence-gate.ts` (pure `evaluateStageEvidence`
+ `enrichProgressWithEvidence`, never-throws, legacy fallback). Wired into
`routes/capadex.ts buildProgress`: flag ON → enrich, OFF → exact legacy array.
Read-time composition only — NO tables/DDL, so byte-identical OFF incl schema is
trivial. Verdicts: verified / below_bar / insufficient_evidence / in_progress /
not_started / blocked. `EVIDENCE_FRESHNESS_DAYS=180` drives
`due_for_remeasurement` (read-only display heuristic, no scheduler).

**Rule: COMPOSE existing engines, do not invent a parallel scorer/gate.**
Readiness comes from `scoreToLevelBand()` (`competency-scoring.ts`); data
sufficiency comes from `applyKAnonymity()`/`K_MIN` (`cohort-gating.ts`, cohort
resolved from session `persona`+`age_band` via `resolveCohort`/`countCohort`).
A standalone gate that re-derives bands or k-anonymity is a REUSE violation and
was rejected in review — wire the real engines.

**Rule: the THREE axes stay SEPARATE, never composited.**
Coverage (has_session/has_score/score) ⟂ Readiness (band/min_band/meets_threshold)
⟂ Confidence (level/age_days/fresh + data_sufficiency). Advancement gates on
prior stage `verified` (Coverage AND Readiness). Data sufficiency (cohort
k-anonymity) is REPORTED but NEVER gates advancement.

**Rule: CAPADEX stage score IS a positive proficiency measure → readiness gate is honest.**
**Why:** the stage score mirrors `getScoreLevel` (Advanced/Proficient/Developing/
Emerging — higher is better), NOT raw concern-signal magnitude. So a readiness
threshold (`STAGE_READINESS_MIN_BAND=3`, score>=40) IS blueprint-faithful for
GAP-P2. An earlier draft mis-applied the strengths-canon "signals are
concern-diagnostic, never a merit gate" rule here and downgraded `below_bar` to a
non-gating annotation — that was WRONG for stage scores and was reverted.
**How to apply:** strengths-canon applies to RAW concern signals; a derived
positive proficiency/stage score can legitimately gate readiness.

**Verification quirk:** the verified path can't be HTTP-smoked in dev — the shared
dev DB has no completed session with non-null score + non-null guest_email. Cover
it with the deterministic unit test (`scripts/task304-evidence-gate-verify.ts`,
39/39), report the HTTP gap as an honest data limitation, not a defect.
