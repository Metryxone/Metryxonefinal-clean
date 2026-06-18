---
name: EI intelligence enhancements (5 features)
description: Implementation patterns for the 5 EI enhancements — breakdown, auto-snapshot, archiving, admin drill-down, drop alert.
---

## 1. Breakdown in Trajectory
- `fetchLatestBreakdown(pool, userId)` reads `breakdown` JSONB from `ei_snapshot_versions ORDER BY snapshot_date DESC LIMIT 1`
- Returns `{ technicalScore, softScore, experienceScore, certScore, projectScore, completenessScore }` or `null`
- Wired into `Promise.all` prerequisites alongside email/history/careerCtx
- Added to trajectory spread as `breakdown: latestBreakdown`
- Frontend: `EIBreakdown` interface + optional field on `EITrajectory`; rendered as color-coded bars in `TrajectoryTab`

## 2. Auto-snapshot on CAPADEX completion (Hook 23)
- Added at end of `postCompletionHooks` in `capadex-enterprise.ts`, inside the main try block, before the catch
- Fire-and-forget via `setImmediate` + **dynamic import** (`await import('../services/ei-snapshots')`) to avoid circular deps
- Resolves user by `lower(COALESCE(NULLIF(TRIM(email),''), username)) = $1` from `users` table
- Reads `career_seeker_profiles.data` JSONB to build `ResolverInput`
- Only fires when `email` param is non-null

## 3. Report archiving (rf_generated_reports)
- `report-summary` route inserts to `rf_generated_reports` with `report_type='ei_intelligence'`, `status='completed'` non-blocking (`.catch(() => {})`)
- `generated_content = { sections }` (full section array); `data_snapshot = { snapshot_count, trajectory_enabled }`
- `GET /api/ei/intelligence/report-history` queries last 10 rows by `user_id + report_type + status`
- Both routes support `?adminUserId=X` (super_admin only)

## 4. Admin per-user drill-down pattern
- `/api/ei/intelligence` and related routes check: `isSuperAdmin && req.query.adminUserId` → use that userId instead of session user
- `EIIntelligencePanel` accepts optional `userId` prop → builds `adminSuffix = ?adminUserId=...` appended to all fetches
- `useEffect` deps on `[userId]` — changing userId resets all state and re-fetches
- `UserDrillDown` component in `EIHealthPanel` "User Drill-down" tab: UUID input → Load → renders full panel

## 5. EI drop alert
- `sendEIDropAlert(toEmail, prevScore, newScore, drop)` in `backend/email.ts`
- Threshold: `ei.score < prevScore - 4` (i.e., drop ≥ 5 points — "greater than 4")
- Wired in `ei-resolution.ts` around the `takeSnapshot` call: read prev snapshot BEFORE taking new one, compare after
- Email lookup: `COALESCE(NULLIF(TRIM(email), ''), username)` from `users WHERE id=$1`
- Entire chain is non-blocking (`.catch(() => {})`); uses dynamic import for email to avoid circular deps at module load time

**Why dynamic import for auto-snapshot:** `capadex-enterprise.ts` and `ei-snapshots.ts` have shared pool dependencies; static import would create a circular reference at startup. Dynamic import defers until runtime.
