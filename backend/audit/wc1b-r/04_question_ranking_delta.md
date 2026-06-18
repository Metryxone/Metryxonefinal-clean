# WC-1B-R — Question Ranking Delta (Phase 4 `pickQuestionsFromMaster`)

## Mechanism
Flag ON appends the tag's grounded vocab tokens to `conceptStems`, feeding the **existing** clarity soft-rank. Same pool, same content — the relevance count (hence ordering, and which rows clear the result cap) shifts toward grounded-relevant rows. Flag OFF skips the append (code-gated inside `if (isSignalGroundingRuntimeEnabled())`) → `conceptStems` unchanged.

## Deterministic evidence — the ranking INPUT the flag injects
Source: `audit/wc1b-r/grounding_stats.json` (in-process, single process → no cross-process noise). `loadGroundedRankTokens(tag, 8)`:

| Bridge tag | Grounded rank tokens injected |
|---|---|
| ANALYTICAL_DEVELOPMENT | 8 |
| GROWTH_TRACKING | 8 |
| LEADERSHIP_OWNERSHIP | 8 |
| EXAMINATION_STRESS | 8 |
| EMPLOYABILITY | 8 |
| `__NOT_A_REAL_TAG__` (ungrounded) | **0** |

Each grounded tag deterministically contributes 8 additional ranking stems flag-ON; an ungrounded tag contributes 0 → ordering is byte-identical to legacy for ungrounded tags.

## Honest limitation — black-box ordering diff is confounded
A clean before/after of the *served question order* over HTTP is **not attainable as a flag attribution** because the clarity picker is **non-deterministic across server processes**: two flag-OFF runs (`:8080` hot workflow vs `:8093` fresh) returned different clarity orderings for the same concern (see `probe_before_flagoff.json` vs `probe_before_flagoff_fresh.json`). The clarity soft-rank leaves many rows tied (relevance 0), and tied rows are returned in a backend-process-dependent order. The grounding nudge's reordering is therefore superimposed on this pre-existing tie noise and cannot be isolated by cross-process comparison.

`pickQuestionsFromMaster` is module-private (not exported), so an in-process flag-toggle of the full picker was not run without a prod-code test seam (out of scope for an additive task). Instead, Phase 4 is validated at the **ranking-input** level (the deterministic token injection above) plus the **flag-OFF code gate** (no append → byte-identical).

## Cross-process observation (flag-only, fresh-OFF `:8093` vs fresh-ON `:8092`)
- Clarity result `order_changed = True` and `same_set = False` for all 5 concerns. The set shift is expected: the picker returns a capped top-N, so re-ranking promotes different rows past the cap. **No content is fabricated or rewritten** — the same bridge-tag pool is used; only which rows surface changes. (This shift is partly real flag effect, partly tie noise — see limitation above.)
- `/start` `order_changed = True` but `same_set = True`: `/start` uses a **different** question bank (`short_assessment_questions`) **not touched by Phase 4**; its order also differs between two flag-OFF runs → confirmed process noise, not the flag.

## Verdict
- Flag OFF: ranking byte-identical to legacy (append code-gated).
- Flag ON: 8 grounded vocab stems deterministically injected per grounded tag, 0 for ungrounded — the intended additive re-rank input. Served-order attribution is limited by pre-existing picker tie-nondeterminism (documented, not introduced by this feature).
