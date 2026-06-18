# WC-L3 Deliverable 5 — Root Cause Analysis
_Generated 2026-06-09T16:54:53.564Z_

Flags at run: `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON. Audit is READ-ONLY (no writes).

Loss is classified per layer into: **capture** (input absent) · **mapping** (resolver can't map a present
input) · **pipeline/stale** (resolver maps but result not persisted) · **flag gating** · **data quality**.

| Layer | Primary cause | Evidence | Class |
|---|---|---|---|
| `master_concern_pk` (1/9) | resolver maps **9/9** today but only 1 stored | concern_name present 100.0%; re-resolve 100.0% | **pipeline / stale persistence** (legacy sessions predate the `/start` resolve; not capture, not mapping) |
| `primary_construct_key` (2/9) | 3 stale + 4 unmapped | re-resolve 5/9; gaps: `Career Anxiety`, `Work Stress` | **mixed: stale persistence + mapping gap** |
| Behavioural spine (hypotheses 0/9) | hypotheses never generated at `/respond` (separate route); 3 sessions have 0 responses | active hypotheses 0/9; composites 0/9 | **pipeline (architectural) + data quality (0-response)** |
| Outcome (3/9) | downstream of concern/construct | reaches 9/9 once linkage restored | **inherited (not its own failure)** |
| Forecast (0/2) | downstream of outcome + depth | 2/2 once linkage restored | **inherited + longitudinal depth** |

## The decisive distinction
- **It is NOT a capture failure:** `concern_name` is present on 100.0% of completed sessions.
- **It is NOT (mostly) a resolver-quality failure:** the EXISTING resolver re-maps 9/9 concerns and 5/9 constructs from that text RIGHT NOW.
- **It IS stale persistence:** the resolve runs at `/start`; these sessions were created before that wiring (or the value was not persisted), so the column stayed NULL while the input survived.
- **Residual true gaps:** 4 construct mapping gaps (need a curated `CONCERN_TO_CONSTRUCT` entry) and 3 zero-response sessions (un-backfillable spine — honest ceiling).
