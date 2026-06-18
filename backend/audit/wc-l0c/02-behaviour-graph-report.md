# Deliverable 2 — Behaviour Graph Report

**Question:** graphs created / empty / partial.
**Source:** `services/behavior-graph-service.ts` — `buildBehaviorGraph` (aggregate + persist),
`getBehaviorGraph` (read), table `capadex_behavior_graph` (PK `session_id` UUID, one row/session).
The projection layer reads via `getBehaviorGraph` (read-only) — it does **not** build.

## Graph inventory (dev DB)
- `capadex_behavior_graph` total rows: **36**.
- Joined to `capadex_sessions`: **34 rows have NO matching session row** (orphan / runtime / test
  id-space), **2 rows** map to `completed` sessions.
- Of the **9 completed sessions, only 2 have a graph** (`11111111…` seed, `1cd9ca07…`). The other
  **7 have no graph row** → `getBehaviorGraph` returns `null` → `projectBehaviour(null)` →
  every dimension `null`, `behaviour_source = 'absent'`.

## Empty / partial classification of the 36 graphs
The graphs are not "empty" (each has ≥1 node) but they are **severely partial**:
| signal_count | risk_count | pattern_count | graphs |
|---|---|---|---|
| 1 | 1 | 0 | ~17 |
| 1 | 0 | 0 | ~7 |
| 2 | 1 | 0 | ~9 |
| 2 | 0 | 0 | 1 |
| 5 | 1 | 1 | 1 (1cd9ca07) |
| 2 | 1 | 0 | 1 (11111111 seed) |

- **risk_count is almost always 1** — and that single risk is the **low-score gate** in `loadRisks`
  (`score < 40 → medium`), NOT a captured risk signal (contradiction_events = 0; capadex_risk_flags = 1).
- **pattern_count is 0 for 35/36 graphs** — only `1cd9ca07` has a pattern ("High emotional load"),
  which is why it is the lone `learning_style` value.
- **csi_factor_count / growth_count are 0** for essentially all graphs — the OMEGA-X longitudinal
  and CSI contributors never fire (no linked email/CSI profile for these sessions).

## The two completed-session graphs (the only ones the projection ever sees)
| session | signals | signal keys | risk | pattern | confidence |
|---------|---------|-------------|------|---------|------------|
| 11111111 (seed) | 2 | avoidance_pattern (0.82), cognitive_blocking (0.60) | 1 (low-score) | 0 | 0.63 |
| 1cd9ca07 | 5* | GENERAL_CONCERN, career_confusion, emotional_overload, placement_anxiety, social_withdrawal + null-strength rapid_answer×7 | 1 (low-score) | 1 | 0.72 |

\* graph `signal_count` counts active rows; the table also holds 7 null-strength `rapid_answer`
candidates that contribute nothing.

## Verdict (Coverage vs Confidence)
- **Coverage:** graph created for **2/9** completed sessions. The 34 orphan graphs do not belong to
  completed sessions and never reach `wcl0_user_intelligence` (persist reads completed sessions only).
- **Confidence:** the 2 graphs that exist are **partial by construction** — they carry only
  concern signals + a low-score risk + (once) a pattern. No graph anywhere contains a signal key
  that the projection's construct regexes can match. So the graph layer is simultaneously
  **under-covered** (7/9 absent) and **off-vocabulary** (0/36 graphs hold a construct-matchable key).
