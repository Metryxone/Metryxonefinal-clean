---
name: Customer Journey Completion (CAPADEX 3.0 Phase 1.4)
description: The ONE canonical Customer Journey Model — reuse-before-build, frozen spine honesty, mirror-1.3 scan-lock discipline.
---

# Customer Journey Completion (flag `customerJourneyCompletion` / `FF_CUSTOMER_JOURNEY_COMPLETION`)

Enhancement-only canonical journey registry + read-only composer over EXISTING journey/orchestration engines. No new engine, no V2, no duplicate journey, no journey re-decision. Default OFF → byte-identical incl. schema (zero DDL — composer only READS: `to_regclass` probes + fs checks). Mirrors Phase 1.3 (Assessment Framework Completion) EXACTLY — same file shapes (config registry + scan SSoT + composer + routes + generator), same scan-lock discipline, same 4-axis honesty.

## Frozen-spine honesty (the durable decision)
The plan said "23-step canonical journey"; the REAL canonical journey is an **8-step spine** (`registration → entry_assessment → ai_diagnose → recommend → learn_act_grow → reports → outcome_capture → re_measure`). **Why:** fabricating 23 steps to match a round number is exactly the dishonesty the contract forbids — the spine must reflect what the platform actually does. **How to apply:** when a plan's step/type COUNT conflicts with the measured reality, encode the measured reality and note the deliberate divergence; never pad a taxonomy to hit a target number.

## Scan-lock discipline (inherited from 1.3 — the durable rule)
The scan script is the SSoT: it embeds the FULL registry payload (spine/templates/journeys/axes/duplicate_entrances/gaps + measured coverage/outcome_tail/persona_linkage) into `scan.json`, and the deliverable generator reads ONLY `scan.json` (zero imports of the live registry/engine, fail-fast on missing sections, sha256 stamped in every doc). **Why:** a generator that imports live constants silently drifts when the registry changes without a re-scan. **How to apply:** the 1.4 scan.json keys DIFFER from 1.3 — use `spine/templates/journeys/coverage/gaps/summary/outcome_tail/persona_linkage` (NOT framework/crosswalk/lifecycle_closure); status_counts are `SUPPORTED/PARTIAL/DEAD_END/MISSING` (NOT IMPLEMENTED).

## Traps that bit (durable)
- **Registry evidence must cite REAL live table names, not plausible guesses.** `outcome_models` does NOT exist in this shared DB — the real table is `wc3_outcome_models` (the whole outcome substrate is `wc3_*`-prefixed). Always `to_regclass`-verify every cited table before claiming coverage; honest-absent is fine, a WRONG name misrepresents coverage. Re-run the scan AFTER any citation fix so the evidence rollup (0 absent / 0 unknown) matches the "fixed" claim.
- **Duplicate entrances are KEEP_ALL, not duplicates.** Multiple CTAs/nav paths into ONE flow (e.g. several entrances to Career Builder) are documented as `DUPLICATE_ENTRANCES` decisions with rationale — never merged or forked into a second journey.
- ON proof without workflow churn: the flag isn't in the Backend API workflow command, so `FF_CUSTOMER_JOURNEY_COMPLETION=1 npx tsx -e "..."` proves the gate flips; route OFF smoke (503/401) + the engine scan cover the rest. Global `app.use('/api/admin')` gate → OFF admin smoke ∈{401,403,503}.

## Closing the loop via REUSE (inherited from 1.3 — durable)
The universal outcome tail (`outcome_capture`/`re_measure`, the cross-cutting `outcome_tail` journey = PARTIAL) is CODE-COMPLETE by REUSING the pre-existing `services/capadex/progression-outcome-capture.ts` (gated by the SEPARATE flag `longitudinalOutcomeCapture`) — `captureProgressionOutcome` + `getReassessmentSignal` (reuse `REASSESSMENT_FRESHNESS_DAYS`, never re-declare). No net-new engine/table.

## Adoption is a 4th axis, never composited
`composeOutcomeTailAdoption` (subject counts, demo excluded) + `composePersonaOutcomeLinkage` (read-time join, k_min=30 suppression). Coverage(mechanism exists) ⟂ Confidence(trustworthy) ⟂ Outcome(realized) ⟂ Adoption(exercised). All currently honest-low/0; null≠0.
