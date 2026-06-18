# WC-L0F · Deliverable 5 — Coverage Improvement Report (before → after)
_Generated 2026-06-10T02:58:51.179Z._

| metric | before | after | note |
|---|---|---|---|
| Behaviour coverage (>=1 numeric dim) | 7/9 (77.8%) | 7/9 (77.8%) | already at WC-L0E ceiling; graph backfill is a no-op |
| Activated-signal coverage | 6/9 | 6/9 | unchanged (response-bearing sessions already captured) |
| Graph population | 7/9 | 7/9 | ceiling = all response-bearing sessions |
| Persisted behaviour-trend rows | 5 | 5 | **the genuine lift** |
| Behaviour-forecast (risk) readiness | 0/2 | 0/2 | honest ceiling — see below |

## Honest forecast-readiness ceiling (do NOT inflate)
- The forecast engine surfaces only the **`risk`** behaviour dim as a forecast. `risk` is the **sparsest** dim — it is NULL on both returning owners' response-bearing sessions (risk=50 appears only on anon / seed / single sessions). So neither owner has >=2 readable risk points → **behaviour-forecast readiness stays 0/2** even though behaviour TRENDS activated.
- The non-behaviour forecasts (growth/outcome/journey) were already active via WC-L1 / WC-L2B and are unaffected.
- **Binding constraints, in order:** (1) zero-response sessions cap coverage at 77.8%; (2) single-session owners & anon sessions cannot trend; (3) the `risk`-dim capture sparsity caps behaviour-forecast readiness. None is fixable by this layer without new capture or fabrication.
