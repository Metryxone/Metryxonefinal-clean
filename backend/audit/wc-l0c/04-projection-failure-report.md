# Deliverable 4 — Projection Failure Report

**Source:** `services/wc3/user-intelligence-foundation.ts` — `projectBehaviour(graph)` +
`strengthByKey(graph, re)`. Per dimension: source inputs, threshold logic, exact reason for null.

## The shared mechanism
```ts
function strengthByKey(graph, re) {
  const hits = (graph.signals ?? []).filter(s => re.test(s.signal_key));
  if (hits.length === 0) return null;                 // ← the null gate
  return Math.round(Math.max(...hits.map(s => normalise(s.strength))));
}
```
A construct dimension is filled **only** if at least one `graph.signals[].signal_key` matches its
regex. No threshold on strength is even reached for the four construct dims, because the **filter
returns an empty array first**.

## Empirical match test — runtime vocabulary × construct regexes
Every distinct captured `signal_key` was tested against all 5 regexes. **All cells FALSE:**

| signal_key | motivation | confidence | engagement | adaptability | risk |
|------------|:--:|:--:|:--:|:--:|:--:|
| GENERAL_CONCERN | f | f | f | f | f |
| avoidance_pattern | f | f | f | f | f |
| career_confusion | f | f | f | f | f |
| cognitive_blocking | f | f | f | f | f |
| emotional_overload | f | f | f | f | f |
| placement_anxiety | f | f | f | f | f |
| prolonged_hesitation | f | f | f | f | f |
| rapid_answer / _pattern | f | f | f | f | f |
| social_withdrawal | f | f | f | f | f |

## Per-dimension verdict
### motivation — regex `/motiv|drive|goal|ambition|persist/i`
- **Source input:** `graph.signals[].signal_key`. **Null reason:** no captured key contains
  motiv/drive/goal/ambition/persist. `career_confusion` (the nearest concept) does not match. **0/9.**

### confidence — regex `/confidence|self_doubt|self_efficacy|reliab|assur/i`
- **Null reason:** `placement_anxiety` / `social_withdrawal` are confidence-adjacent concepts but
  share no token with the regex (`self_doubt`/`assur` etc. are never emitted). **0/9.**

### engagement — regex `/engag|effort|considered|attention|focus/i`
- **Null reason:** `rapid_answer`, `cognitive_blocking`, `social_withdrawal` are engagement-adjacent
  but match no token; and `rapid_answer` rows have `strength = NULL` regardless. **0/9.**

### adaptability — regex `/adapt|reframing|flexib|composure|resilien/i`
- **Null reason:** `avoidance_pattern` is adaptability-adjacent but shares no token. **0/9.**

### risk — strongest of `graph.risks` severity OR signals `/risk|burnout|overwhelm|crisis|distress/i`
- **Signal side FAILS too:** `emotional_overload` ≠ `overwhelm` (no token overlap) → 0 from signals.
- **Survives ONLY via `graph.risks`:** the `loadRisks` low-score gate (`score < 40` → `medium` = 50)
  maps through `SEVERITY_SCORE`. Both graphed sessions scored 32/35 → `risk = 50`. **2/9 — and 0 of
  that came from a risk signal.** A graphed session scoring ≥ 40 would show `risk = null`.

### learning_style — first `graph.patterns[].label` (text, not a score)
- Present only for `1cd9ca07` ("High emotional load"); 35/36 graphs have no pattern. **1/9.**

## Conclusion
The projection's construct regexes were authored for a **positive-construct / `self_*` signal
namespace that the runtime never produces**. The null is not caused by thresholds, normalisation, or
small samples — it is caused at the `filter(...)` step returning empty for 100% of real signals.
The dimensions are **structurally unreachable under the current code for the currently observed
emitted signal namespace**, independent of session volume. They would become reachable only if
upstream begins emitting regex-matchable construct keys (e.g. future Pragati/seed keys) or the
projection mapping changes.
