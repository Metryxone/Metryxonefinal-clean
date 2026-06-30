---
name: Assessment Framework Completion (CAPADEX 3.0 Phase 1.3)
description: The ONE canonical assessment registry — reuse-before-build traps, real table names, honest back-half verdict.
---

# Assessment Framework Completion (flag `assessmentFrameworkCompletion` / `FF_ASSESSMENT_FRAMEWORK_COMPLETION`)

Enhancement-only canonical registry + read-only composer over EXISTING assessment engines. No new engine, no V2, no duplicate logic, no taxonomy re-decision. Default OFF → byte-identical incl. schema (zero DDL — composer only READS: `to_regclass` probes + fs checks).

## Scan-lock discipline (the durable rule)
The scan script is the SSoT: it embeds the FULL registry payload (framework/crosswalk/axes/overlaps/gaps + measured coverage) into `scan.json`, and the deliverable generator reads ONLY `scan.json` (zero imports of the live registry/engine, fail-fast on missing sections, sha256 stamped in every doc). **Why:** a generator that imports live constants silently drifts when the registry changes without a re-scan — the docs then contradict the measurement. **How to apply:** any "docs can't drift from measurement" claim REQUIRES the generator to be measurement-locked, not source-locked.

## Traps that bit (durable)
- **Registry evidence must cite REAL live table names, not plausible guesses.** The verifier exposed several wrong names; honest-absent is fine but a WRONG name misrepresents coverage. Correct mappings in THIS shared DB: `scoring_runs`→`employability_scoring_runs`; `contradiction_trait_pairs`→`contradiction_events`(/`behavioral_contradiction_logs`); `role_dna_runtime`→`role_dna_master_profiles`; `short_assessments`→`short_assessment_questions`; `longitudinal_memory`→`longitudinal_patterns`; `career_progression`→`wc3_stage_progression`. Also the insights table is British `behavioural_insights` (NOT `behavioral_`), but the signal **engine file** is American `behavioral-signal-engine.ts`. Always `to_regclass`-verify before citing.
- Fix table names in **both** the registry evidence arrays AND the prose fields (`scoringMethod`/`definition`/`dependencies`) AND the engine's `ASSESSMENT_GAPS` evidence strings — grep all three or a stale name survives in a deliverable.
- ON proof without workflow churn: the flag isn't in the Backend API workflow command, so `FF_...=1 npx tsx -e "isAssessmentFrameworkCompletionEnabled()"` proves the gate flips; route OFF smoke (503/401) + the engine scan cover the rest.

## Honest verdict (don't inflate)
Front-half (Entry/Baseline/Diagnostic/Behaviour/Competency + employer Performance) IMPLEMENTED; **Progress/Exit/Continuous = back-half forward work** to be done by RE-ADMINISTERING existing assessments (close-the-loop), NOT new engines. Verdict `STRUCTURAL_COMPLETE_BACKHALF_PENDING`, **0 Launch-Critical** gaps. LBI (`lbi_*`) ⟂ Competency (`onto_*`) stay separate by design. Coverage⟂Confidence⟂Outcome never composited; null≠0.
