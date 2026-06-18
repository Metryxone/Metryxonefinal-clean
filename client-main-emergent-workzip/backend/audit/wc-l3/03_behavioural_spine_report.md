# WC-L3 Deliverable 3 — Behavioural Spine Report
_Generated 2026-06-09T16:54:53.564Z_

Flags at run: `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON. Audit is READ-ONLY (no writes).

The spine is written fire-and-forget at `/respond` (signals/composites/patterns via `runEvidenceRuntime`);
**hypotheses are NOT in the `/respond` loop** — they are generated only by the separate client-triggered
`/api/bios/hypotheses/generate` route, which these sessions never called.

| Spine layer | Sessions with ≥1 row | of 9 | Used by the construct resolver? |
|---|---|---|---|
| Signals (`capadex_session_signals`) | 7 | 77.8% | indirectly (feed composites/patterns) |
| Composites (`capadex_session_composites`) | 0 | 0.0% | no |
| Patterns (`capadex_session_patterns`) | 6 | 66.7% | **no — table has no `construct_key` column** (inert tier) |
| Hypotheses active+keyed (`behavioural_hypotheses`) | 0 | 0.0% | **YES — the primary construct source (empty here)** |

| Session | responses | signals | composites | patterns | active hypotheses |
|---|---|---|---|---|---|
| 0731f92c | 10 | 5 | 0 | 1 | 0 |
| b883418d | 10 | 3 | 0 | 1 | 0 |
| 7828d7a3 | 10 | 3 | 0 | 1 | 0 |
| 4349237c | 3 | 4 | 0 | 1 | 0 |
| 4c9b6c0b | 3 | 4 | 0 | 1 | 0 |
| d0f54fc4 | 0 | 0 | 0 | 0 | 0 |
| a0924499 | 0 | 0 | 0 | 0 | 0 |
| 11111111 | 0 | 2 | 0 | 0 | 0 |
| 1cd9ca07 | 10 | 14 | 0 | 1 | 0 |

**Honest finding:** the construct-bearing spine layer (active hypotheses) is **0/9** — an architectural
gap (never invoked at `/respond`), not a thresholding fluke. Composites are **0/9** (definition mismatch);
patterns exist but are construct-inert. **3/9** sessions have **0 responses** → no evidence exists,
so their spine is **un-backfillable** (a true ceiling, never to be fabricated). Because the construct resolver
falls back to the concern/construct path (Deliverable 4), an empty spine is NOT fatal to outcome reachability.
