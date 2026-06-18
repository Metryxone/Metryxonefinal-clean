---
name: WCL pattern-trend chain
description: Architecture of the WCL1→WCL2→WCL3 behavioral pattern trend / horizon forecast / outcome projection chain surfaced in IntelligenceLayers.
---

## Rule
WCL1/WCL2/WCL3 services are compute-on-demand (pure read, no persistence). The chain flows:

  capadex_session_patterns (per session) → WCL1 trend (≥2 sessions) → WCL2 30/60/90d → WCL3 risk/growth/outcome

**Why:** Adding persistence tables for a chain over only ~2-5 sessions adds DDL overhead with no benefit; on-demand is equally fast and keeps the architecture thin.

## Key conventions
- **Email keying**: WCL uses `guest_email` (not `user_id`). Route resolves it via `SELECT guest_email FROM capadex_sessions WHERE id = $1`.
- **Pattern polarity**: `burnout_cluster`, `hesitation_cluster`, `cognitive_avoidance_cluster` = RISK (rising confidence = worsening). `stress_regulation_cluster`, `resilience_cluster` = PROTECTIVE. Everything else = LOAD.
- **Direction semantics**: For RISK patterns, `direction='improving'` (slope>0) means WORSENING (the concern is increasing). Consumers must invert for display.
- **Honesty floor**: A pattern needs to appear in ≥2 sessions for WCL1 to produce a trend row. In prod data, `emotional_concentration` is the only multi-session pattern (0.41→0.61 for lakshman.vema@gmail.com).
- **Flag gate**: `FF_FORECAST_INTELLIGENCE=1` must be in the Backend API workflow command; without it `computeHorizonForecasts` returns `{enabled:false, forecasts:[]}` → WCL2+WCL3 silently empty. Already added to workflow as of this build.

## Files
- `backend/services/wc3/pattern-trend-intelligence.ts` — WCL1
- `backend/services/wc3/horizon-forecast.ts` — WCL2 (flag-gated)
- `backend/services/wc3/wcl-projections.ts` — WCL3 (pure derivation, no DB)
- Route: `GET /api/intelligence/wcl` in `backend/routes/report-intelligence-assembler.ts`
- Frontend: `frontend/src/components/shared/IntelligenceLayers.tsx` — `wclReq` fetch + WCL state + rendering in Trends/Forecast/Outcomes tabs

## IntelligenceLayers dual-fetch pattern
The component makes TWO independent fetches:
1. `/api/competency/intelligence/summary` → `setCie(...)` (CIE: competency history, forecasts, gaps)
2. `/api/intelligence/wcl?sessionId=...` → `setWcl(...)` (WCL: behavioral pattern trends, horizons, projections)

Both degrade gracefully when absent. `sessionId` is required for the WCL fetch (anonymous sessions return `{enabled:false}`).

## How to apply
- Before touching WCL services: remember polarity inversion for RISK patterns in display logic.
- If WCL data appears empty in reports: first check `FF_FORECAST_INTELLIGENCE=1` in workflow; then check that the session has ≥2 completed sessions with the same `guest_email`.
- Pattern confidence is normalised to 0..100 in WCL1 (the raw DB value is 0..1).
