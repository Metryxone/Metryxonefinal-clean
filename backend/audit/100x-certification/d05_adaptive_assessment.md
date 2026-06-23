# D5 — Adaptive Assessment · 100X Re-certification

**Verdict: PARTIAL** (was **FAIL** in 99X). **Score: 52/100** (was 25).
This is the headline movement of Phase 10: the MX-100X P4 activation moved Adaptive off the floor — but it is **content-gated**, not fully active, and we will not score it higher than the live runtime supports.

## Live evidence
- Difficulty distribution (74 templates): medium **53** · advanced **8** · intermediate **6** · foundational **5** · hard **2**.
- Vocabulary split: **laddered** (foundational/intermediate/advanced) **19** · **legacy** (easy/medium/hard) **55** · distinct bands **5**.
- Runtime Role-DNA expected levels (`competency_runtime_weights`): **0 rows**, **0** with `expected_level`.

## What Phase 1–9 added (P4 activation)
- Flag `adaptiveDifficultyActivation`: target/readiness thresholds shift by role level; senior bands == legacy ladder (flag-ON senior byte-identical). The activation path exists and is wired.

## Honest gaps — why PARTIAL not PASS
1. **Mixed difficulty vocabulary**: 55 legacy (easy/medium/hard) vs 19 laddered (foundational/intermediate/advanced). The served bank is **~72% `medium`**, so *served* difficulty cannot meaningfully shift even when the engine asks for a harder/easier item — an honest content ceiling.
2. **Runtime Role-DNA expected levels are EMPTY** (`competency_runtime_weights` = 0 rows). With no expected-level table, difficulty selection falls back to the **stage anchor**, not role-DNA-driven thresholds.

## Why exactly 52, not higher
The engine is activated (structure: PASS) but the two content/data inputs it needs — a single difficulty vocabulary with real harder/easier variants, and populated runtime Role-DNA expected levels — are absent. Activation without content is honestly a PARTIAL, not a PASS.
