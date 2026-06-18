# WC-P1 — D11: Longitudinal Readiness

**Coverage**: 15% | **Confidence**: 10%

---

## Evidence

| Component | State |
|---|---|
| `ei_snapshot_versions` table | ✅ Exists |
| Rows ever stored | **0** — no snapshots have ever been taken |
| First snapshot | null (never taken) |
| Last snapshot | null (never taken) |
| Trajectory forecasts | 1 row (this was seeded, not from a real user journey) |
| `takeSnapshot()` service | ✅ Implemented in `ei-snapshots.ts` |
| `getTrajectory()` service | ✅ Implemented |
| `getEvolutionAnalytics()` service | ✅ Implemented |
| Admin snapshot trigger | HTTP 401 (route present) |
| Nightly cron / scheduler | ❌ Not implemented |
| Auto-snapshot on first resolve | ❌ Not triggered — `/api/ei/resolve` logs but does not snapshot |
| CareerVelocityTab trend chart | ✅ Component exists; renders empty (no data) |
| `/api/admin/ei/snapshots/:user_id` | HTTP 401 |

---

## Why 0 Snapshots

`/api/ei/resolve` (the most frequently called EI route, with 199 logs) writes to `ei_calculation_logs` but does NOT write to `ei_snapshot_versions`. Snapshots must be triggered explicitly via `POST /api/admin/ei/snapshots/take` or a cron that has never been configured.

The documentation states: *"For longitudinal tracking we will snapshot the EI nightly into `ei_snapshots(user_id, score, breakdown, snapshot_at)` (planned, not yet built)."* — this matches the observed state exactly.

---

## Impact

- All longitudinal UI surfaces (CareerVelocityTab trend chart, trajectory to Hire-Ready, "dominant mover" analysis) render empty.
- `getEvolutionAnalytics()` will return no data for all users.
- The "Trajectory" feature cannot show any meaningful historical trend.

---

## Actions to Reach 95%

1. Auto-trigger `takeSnapshot()` from `/api/ei/resolve` on first resolution of a given day (idempotent — unique constraint on user_id+date already in place).
2. Optionally: add a cron (Replit scheduled task or pg_cron) for nightly snapshots.
3. Once snapshots accumulate (≥3 per user), the trend chart and evolution analytics will populate automatically.
