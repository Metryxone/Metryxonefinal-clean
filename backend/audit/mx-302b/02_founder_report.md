# MX-302B — Founder Report: Career Discovery & AI Guidance

_Generated 2026-06-27T02:51:34.832Z · read-only · flag `careerDiscovery` = **ON** · AI mode = **rule_based**_

## Success-criteria checklist

| Criterion | Result | Evidence |
|-----------|:------:|----------|
| Flag default OFF / byte-identical when OFF | ✅ PASS | careerDiscovery defaults false; every route 503s before auth/DB and schema is created only on the flag-ON path (lazy ensure-schema). Verified by smoke: flag-OFF → enabled:false + 503; flag-ON → enabled:true + 401 (auth). |
| Discovery precedes recommendations (per-user gate) | ✅ PASS | hasCompletedDiscovery is DERIVED from status IN (completed,skipped). Career Builder mount probe routes incomplete users to /career-discovery first (flag-ON only; deep-link ?tab= respected). |
| Only net-new assessment is the Values inventory | ✅ PASS | Values scorer is pure & honest (self-check PASS). All other surfaces compose existing match/simulation/recommendation/roadmap/development engines. |
| AI degrades honestly to rule-based without an LLM key | ✅ PASS | LLM key configured: no → guidance ai_mode='rule_based'. Rule-based coach derives concrete next steps deterministically from composed recommendation/roadmap output; ai_mode/ai_available labels are surfaced honestly. |
| Honest empty states / null≠0 | ✅ PASS | compatibility_score & match_percentage stay null when not measurable (never 0). Substrate now: completed/skipped discovery=0, in_progress=0, values captured=0, competency profiles (match substrate)=38. |

## Verdict: **STRUCTURAL PASS**

Structural = the composition layer, flag gating, gate-before-recommendations, honest
AI degradation, and null≠0 empty states are all in place and verified.

### Adoption (separate axis — honest, not composited into the verdict)
- Discovery completions (completed/skipped): 0
- Discovery in progress: 0
- Values inventories captured: 0
- Competency profiles available as match substrate: 38

Low/zero adoption is expected and honest pre-launch — the layer is byte-identical-OFF
and only surfaces once the flag is enabled for the target stages (students / early-career).

## STOP — founder approval required before merge/deploy (per project convention).
