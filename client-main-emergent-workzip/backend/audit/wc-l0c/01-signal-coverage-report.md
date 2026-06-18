# Deliverable 1 — Signal Coverage Report

**Question:** raw signals produced, signal types, signal coverage.
**Sources:** `routes/signal-capture.ts` (ingest), `services/signal-activation-runtime.ts` (activate),
table `capadex_session_signals`; raw telemetry `capadex_session_telemetry`; linguistic
`capadex_linguistic_signals`. Pipeline begins at `capadex_sessions` (status `completed`).

## Raw counts (dev DB, 2026-06-09)
| Table | Rows |
|-------|------|
| completed sessions | 9 |
| capadex_session_telemetry | 65 (across 11 distinct session ids) |
| capadex_session_signals | 16 (across **2** session ids) |
| capadex_linguistic_signals | 1 |
| capadex_session_composites | 0 |
| contradiction_events | 0 |
| capadex_risk_flags | 1 |

## Signal types actually emitted (the entire runtime vocabulary)
Only **10 distinct `signal_key`s** exist across the whole table:

| signal_key | lifecycle_state | rows | avg strength |
|------------|-----------------|------|--------------|
| rapid_answer | (null) | 7 | (null) |
| GENERAL_CONCERN | dominant | 1 | 1.000 |
| avoidance_pattern | active | 1 | 0.820 |
| emotional_overload | active | 1 | 0.677 |
| cognitive_blocking | active | 1 | 0.600 |
| placement_anxiety | active | 1 | 0.565 |
| career_confusion | active | 1 | 0.562 |
| social_withdrawal | active | 1 | 0.558 |
| prolonged_hesitation | (null) | 1 | (null) |
| rapid_answer_pattern | (null) | 1 | (null) |

**Every key is concern-diagnostic** (distress / hesitation / avoidance). There is **not one
positive-construct or `self_*` key** in the entire captured set.

## Telemetry → signal yield
- Telemetry exists for 11 session ids (65 rows). Trigger fields: `hesitation_ms` > 0 in 65/65,
  `backtrack_count` > 0 in 47/65, `text_edit_count` > 0 in **0/65**.
- Yet `capadex_session_signals` has rows for only **2** sessions. Telemetry-derived keys that did
  surface (`rapid_answer`, `prolonged_hesitation`, `rapid_answer_pattern`) carry
  `lifecycle_state = NULL`, `strength = NULL`, `activation_count = 0`, `evidence_count = 0` — i.e.
  they are seed candidates that **never activated**.

## Per-completed-session capture coverage
| session | score | telemetry | signals | graph |
|---------|-------|-----------|---------|-------|
| 0731f92c… | 59 | 0 | 0 | 0 |
| b883418d… | 62 | 0 | 0 | 0 |
| 7828d7a3… | 62 | 0 | 0 | 0 |
| 4349237c… | 38 | 0 | 0 | 0 |
| 4c9b6c0b… | 38 | 0 | 0 | 0 |
| d0f54fc4… | 0 | 5 | **0** | 0 |
| a0924499… | 0 | 6 | **0** | 0 |
| 11111111… (seed) | 32 | 0 | 2 | 1 |
| 1cd9ca07… | 35 | 10 | 14 | 1 |

## Coverage verdict (Coverage vs Confidence)
- **Coverage:** signals captured for **2 of 9** completed sessions (22%). 5/9 produced no evidence
  at all; 2/9 produced telemetry that never became signals.
- **Confidence:** even the captured vocabulary is **entirely concern-diagnostic** — it cannot speak
  to motivation/confidence/engagement/adaptability without polarity-aware inverse-coding (see
  reports 04/05). The signal source is therefore both **sparse** (coverage) and **off-vocabulary**
  (confidence) for the four construct dimensions.
