---
name: CAPADEX investigation surfaces (coverage / utility / strength)
description: The three additive read-only deepenings that turn CAPADEX from a questionnaire into an investigation, and the honesty rules each must obey.
---

CAPADEX = behavioural INVESTIGATION, not a questionnaire. When asked to "connect questioning to behavioural intelligence", most engines already exist (Evidence, Confidence, Report-Backward chain, Governance/Registry) — do NOT rebuild them. The genuinely-new work is additive read-only deepening.

## Behavioural Coverage
- Classify each question into ONE of 10 investigation dimensions (root_cause, trigger, thought_pattern, emotional_state, behavioral_response, avoidance, coping_strategy, impact, strength_asset, change_readiness).
- **Rule:** emit `NONE` when nothing matches — never a default dimension. A non-zero "unclassified" count is an honest finding, not a bug to paper over.
- Persisted additively onto the question registry during its existing refresh; surfaced as a per-concern covered-dims-vs-gaps report.

## Report-Backward Utility (dead_end governance bucket)
- A question is only useful if its answer can actually reach an intervention. Validate by joining the question's bridge tag through the concern→signal map and REUSING the existing chain validator — do NOT write a second chain walker.
- **Self-disable trap:** if the signal map has no tier3 rows, report `mapped:false` and emit ZERO dead-ends. A missing map must never flood a false "everything is a dead-end" bucket.
- dead_end is a 5th governance triage bucket: human-review only, NOTHING auto-removed. `dead_end=0` can be genuine (chain near-complete) — that is a real finding; never tune metrics to manufacture entries.

## Strength Discovery
- **HARD RULE (do not regress):** strengths NEVER come from raw signal magnitude. The signal runtime is concern-DIAGNOSTIC (signals describe distress). Positive surfaces come ONLY from CSI `positive_factors` (domain ≥65, CSI's own capture) + positive longitudinal trends: `resilience_recoveries`→resilience, `growth_patterns`→coping, improving `behavioural_drift`→success_patterns. TRAP: longitudinal `recurring_constructs` are recurring STRUGGLES (only generated when avg<50) — NOT a strength source; filtering them by avg≥65 silently yields nothing.
- Scope token is dual: an email OR a session UUID. A UUID resolves to email via `capadex_sessions.guest_email`; CSI + longitudinal memory are keyed by `user_email` (lowercased), not by session.
- Every item carries {label, evidence, source, confidence}; empty-safe (empty arrays + `sources:[]`, never fabricated). Wired additively into `/explain` as a best-effort `strengths` key (null on failure → never breaks /explain).
- Note: CSI may name a domain like "Avoidance"; if it scores ≥65 the engine honestly surfaces it as a strength because that is CSI's own contract — the strength engine must not second-guess CSI's domain semantics.
