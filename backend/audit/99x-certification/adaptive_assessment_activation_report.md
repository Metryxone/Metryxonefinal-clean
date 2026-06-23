# §5 — Adaptive Assessment Activation Report

**Date:** 2026-06-23 · Read-only · Code trace

## Verdict: ❌ FAIL — adaptive assessment is NOT active at runtime

This is the single clearest FAIL in the certification. The spec's success criteria are explicit:
*"Adaptive assessment must be active"* and *"must influence runtime behaviour."* Neither holds today.

## Required flow vs reality

Required: `Role Level → Required Proficiency → Difficulty → Question Complexity → Scoring Threshold`

| Stage | Status | Evidence |
|---|---|---|
| Role Level → Required Proficiency | ✅ data exists | `map_role_competency.target_proficiency` per competency |
| Required Proficiency → Difficulty | ❌ not wired | runtime selection (`routes/competency-questions.ts` `selectQuestions`) ranks by **affinity** (role/industry/stage tags), not by required proficiency |
| Difficulty → Question Complexity | ❌ shadow-only | `services/adaptive-branching-engine.ts` is explicitly **"Phase 4, shadow-mode … Never affects assessment scoring or UI"** |
| Question Complexity → Scoring Threshold | ❌ | no role-level scoring-threshold variation at runtime |

## Role-level difficulty distribution test
**Junior / Mid / Senior / Leadership do NOT produce different runtime difficulty distributions.** Selection
is the same affinity-ranked path regardless of role seniority. Admins can author "stretch" difficulty
variants (`generateDrafts`) — a content tool, not runtime adaptation.

## Assessment
| Axis | Verdict |
|---|---|
| Difficulty distribution by role level | ❌ uniform |
| Question complexity adaptation | ❌ shadow-mode |
| Scoring variation by level | ❌ none |
| Role-level accuracy | ❌ not exercised |

## Path to PASS (additive, flag-gated, reversible)
1. Promote `adaptive-branching-engine` from shadow-mode behind a new default-OFF flag.
2. Key difficulty-band selection on `target_proficiency` + role seniority (`is_leadership` / level bands).
3. Emit per-level difficulty distributions; verify Junior < Mid < Senior < Leadership shift.
4. Keep flag-OFF byte-identical (current affinity path) so legacy behaviour is preserved.

**This requires implementation and an approval gate — it is the highest-priority closable gap.**
