# MX-301I — Gap Closure Register

**Date:** 2026-06-26
**Scope:** Close every issue discovered during the MX-301H evidence/validation pass.
**Principle:** Honesty over optimism. Coverage (mechanism exists) ⟂ Confidence (verified working) reported separately. No fabrication. **No deploy.**

---

## How to read this register

- **Severity:** Critical · High · Medium · Low
- Every gap carries: **Root Cause · Impact · Fix · Estimated Effort · Owner · Status**
- **Status** values: `FIXED & VERIFIED` · `FIXED (inline)` · `DEFERRED — deployment` · `BY DESIGN (no action)`
- **Update (owner subsequently requested "fix all the gaps and make it 100%"):** **G4 is now FIXED & VERIFIED in code** (super-admin MFA dev-bypass removed). **G5 (shared dev/prod database) is an infrastructure / deployment-config action that cannot be performed from the dev environment** — there is no production environment provisioned yet — so it remains a deployment step (owner = deployment), documented with exact instructions below. Honesty over optimism: G5 is genuinely *not* code-completable now, so it is reported as OPEN-deployment rather than falsely closed.

---

## Summary

| # | Gap | Severity | Owner | Status |
|---|-----|----------|-------|--------|
| G1 | MEI dashboard endpoints 500 — wrong PK column (`id`) | High | Agent (MX-301I) | FIXED & VERIFIED |
| G2 | MEI engine crash — `education.reduce is not a function` | High | Agent (MX-301I) | FIXED & VERIFIED |
| G3 | Competency-score endpoints 500 — missing legacy table | Medium | Agent (MX-301I) | FIXED & VERIFIED |
| G4 | Super-admin MFA bypassed in dev | High (security) | Agent (MX-301I) | FIXED & VERIFIED |
| G5 | Shared dev/prod database | Medium (infra) | Deployment / Platform | OPEN — deployment (not code-fixable) |
| G6 | `replit.md` MFA description drift | Low (docs) | Agent (MX-301I) | FIXED (inline) |
| G7 | CAPADEX assessment cold start (`capadex_sessions=0`) | Low (info) | — | BY DESIGN (no action) |

**Closed this task:** 5 (G1, G2, G3, G4, G6). **Open — deployment infra (not code-fixable):** 1 (G5). **By design / no action:** 1 (G7).

---

## CRITICAL
None. No data-loss, integrity, or total-outage defects were found during validation.

---

## HIGH

### G1 — Candidate dashboard MEI endpoints return 500 (`column "id" does not exist`)
- **Affected:** `GET /api/mei/score|narrative|recommendations|breakdown|benchmark/:userId`
- **Root Cause:** `resolveProfile()` in `backend/routes/mei-v2.ts` queried `SELECT data FROM career_seeker_profiles WHERE id = $1`. That table's primary key is **`user_id`** and it has **no `id` column at all** (columns: `user_id, data, completeness, created_at, updated_at`). Every MEI request that reached profile resolution threw `column "id" does not exist`.
- **Impact:** All five MEI (Metryx Employability Index) widgets on the Candidate dashboard were broken for every user — a core candidate-facing value surface failed silently with 500s.
- **Fix:** Changed the lookup to `WHERE user_id = $1` (`backend/routes/mei-v2.ts`).
- **Estimated Effort:** ~5 min (one-line correction).
- **Owner:** Agent (MX-301I).
- **Status:** **FIXED & VERIFIED** — authenticated probe of all five endpoints now returns HTTP 200 (e.g. `mei/score` → `composite_score: 8.2, band: getting_started`).

### G2 — MEI engine crash for partially-filled profiles (`education.reduce is not a function`)
- **Affected:** Same MEI endpoints (surfaced only after G1 was fixed and profile resolution succeeded).
- **Root Cause:** `mapProfileToMEIInput()` in `backend/services/mei-scoring-engine.ts` did `const education = cp.education ?? []` then `education.reduce(...)`. The `?? []` guard only catches `null`/`undefined`; when the profile JSONB stores `education` (or `experience`/`certifications`/`projects`/`skills`) as a non-array value, `.reduce`/`.map`/`.length` threw. Real demo profile (Sarah) stored `education` as a non-array.
- **Impact:** Even with G1 fixed, MEI compute crashed for any profile whose list fields weren't arrays — i.e. most partially-completed real profiles.
- **Fix:** Coerce all list fields with `Array.isArray(...) ? ... : []` (and skills to a plain object) before use.
- **Estimated Effort:** ~10 min.
- **Owner:** Agent (MX-301I).
- **Status:** **FIXED & VERIFIED** — `mei/score?force=1` for the demo profile now computes and persists a real score (HTTP 200).

### G4 — Super-admin login bypassed MFA in development *(NOW FIXED)*
- **Affected:** `POST /api/login`, super-admin branch (`backend/routes.ts`).
- **Root Cause:** When `NODE_ENV !== 'production'` **and** `ZOHO_EMAIL` was unset, the handler skipped the MFA challenge entirely and returned an authenticated session with `{mfaBypassed:true}`. Pre-existing platform behavior, discovered/disclosed during MX-301H.
- **Impact:** Super-admin accounts could authenticate with **password only** in dev. Amplified because dev and prod share one database (G5), so prod accounts/data were reachable from the dev login with a known password.
- **Fix (implemented):** Removed the `mfaDisabledInDev` bypass branch entirely. MFA is now **always enforced** for super-admin: `/api/login` always issues + persists an `mfa_codes` row and returns `{mfaRequired:true}`; a session is only granted after `POST /api/admin/mfa/verify`. When no email channel is configured (dev), the code is **logged to the server console** (`[DEV MFA] …`, non-production only) and is **never** placed in the HTTP response — so a password alone is no longer sufficient over the network.
- **Estimated Effort:** ~30 min (auth change + e2e verification).
- **Owner:** Agent (MX-301I).
- **Status:** **FIXED & VERIFIED** — e2e probe confirms: `/api/login` → `{mfaRequired:true}` (no `mfaBypassed`); `GET /api/user` before verify → **401**; after `/api/admin/mfa/verify` with the issued code → super-admin session (200). `replit.md` updated to match.

---

## MEDIUM

### G3 — Candidate competency-score endpoints return 500 (missing legacy table)
- **Affected:** `GET /api/competency/score/:userId`, `…/percentile`, `…/diff`.
- **Root Cause:** All three query the legacy table `competency_user_responses`, which **does not exist** in the database (`to_regclass` → null). These are legacy competency tables; canonical competency scoring lives in the `onto_*` genome/runtime, and `competencies` itself holds 0 rows. The endpoints threw `relation "competency_user_responses" does not exist`.
- **Impact:** Candidate dashboard competency-score / percentile / session-diff widgets 500'd. Because the backing legacy tables are empty by design, no real score was ever derivable from this path — but it should degrade, not error.
- **Fix:** Added a `to_regclass('public.competency_user_responses')` probe at the top of each handler. When the table is absent, return an **honest zeroed/empty envelope** (HTTP 200) with a `note: "No competency response data available yet."` rather than 500. When the table exists and is populated (e.g. a future deployment with real responses), the original computation path runs unchanged. **No fabricated schema or data** — degrading honestly was chosen over creating a table that would remain perpetually empty.
- **Estimated Effort:** ~20 min.
- **Owner:** Agent (MX-301I).
- **Status:** **FIXED & VERIFIED** — all three endpoints now return HTTP 200 with empty/zeroed coverage.

### G5 — Development and production share one database *(OPEN — deployment infra, not code-fixable)*
- **Root Cause:** The dev workspace and the (intended) production environment point at the same PostgreSQL instance (`DATABASE_URL`). Demo/seed/test writes land in the same store that production reads serve.
- **Impact:** Demo data (e.g. `@example.com` seed users) and dev-time writes are visible to production; conversely, dev experiments can affect production reads. Compounds (now-fixed) G4.
- **Why it is not code-fixable now:** Separating the databases requires *provisioning a second PostgreSQL instance and pointing production at it* — an infrastructure action taken at deploy time. There is **no production environment provisioned yet** (the app has not been deployed), so there is nothing in code that can effect this separation. Faking a code "fix" would be dishonest.
- **Fix (deployment step — exact):** At publish, give the Deployment its own database (Replit Deployments can attach a separate DB, or set a production-only `DATABASE_URL` secret in the deployment pane), then run migrations against it and purge `@example.com` demo rows for a clean cutover. Demo rows are already marked `@example.com`-purgeable to support this.
- **Estimated Effort:** Infra task — provisioning + migration + verification at deploy.
- **Owner:** Deployment / Platform owner.
- **Status:** **OPEN — deployment** (infrastructure; cannot be completed from the dev environment).

---

## LOW

### G6 — `replit.md` MFA description was inaccurate (doc drift)
- **Root Cause:** The Super Admin section stated dev login requires reading the MFA code from the `mfa_codes` table (`emailSent:false`). In reality dev previously **bypassed MFA entirely** (old G4) and wrote no `mfa_codes` row.
- **Impact:** Misleading onboarding/runbook docs; could send a future engineer chasing a non-existent dev MFA flow.
- **Fix:** Updated the `replit.md` Super Admin section to describe the always-on 2FA flow accurately, including the new dev path (code logged to the workflow console / readable from `mfa_codes`) after the G4 fix.
- **Estimated Effort:** ~5 min.
- **Owner:** Agent (MX-301I).
- **Status:** **FIXED (inline).**

### G7 — CAPADEX assessment cold start (`capadex_sessions = 0`)
- **Root Cause:** No public CAPADEX assessment has been completed in this environment yet.
- **Impact:** None — this is an honest empty/cold-start state, correctly reported as such in the MX-301H evidence package. It is **not** a defect.
- **Fix:** None required.
- **Estimated Effort:** N/A.
- **Owner:** —
- **Status:** **BY DESIGN (no action).** Will populate naturally once real assessments run.

---

## Verification log (this task)

Completed the now-mandatory MFA login (issue code → read it → verify) to obtain a real super-admin session, then probed the previously-failing endpoints for the demo profile `sarah.johnson.mx301@example.com`:

| Endpoint | Before | After |
|----------|--------|-------|
| `GET /api/mei/score/:u?force=1` | 500 `column "id" does not exist` | **200** `composite_score 8.2` |
| `GET /api/mei/narrative/:u` | 500 | **200** |
| `GET /api/mei/recommendations/:u` | 500 | **200** |
| `GET /api/mei/breakdown/:u` | 500 (latent) | **200** |
| `GET /api/mei/benchmark/:u` | 500 (latent) | **200** |
| `GET /api/competency/score/:u` | 500 relation missing | **200** zeroed + note |
| `GET /api/competency/score/:u/percentile` | 500 (latent) | **200** zeroed |
| `GET /api/competency/score/:u/diff` | 500 (latent) | **200** `has_diff:false` |

Full-log scan confirmed these were the **only** distinct 500s recorded during the MX-301H validation pass.

**G4 auth hardening (e2e):** `POST /api/login` → `{mfaRequired:true}` (no `mfaBypassed`); `GET /api/user` **before** verify → **401**; `POST /api/admin/mfa/verify` with the issued code → super-admin session; `GET /api/user` **after** → **200**. Password-only access is now rejected.

## Files changed
- `backend/routes/mei-v2.ts` — G1 (PK column fix).
- `backend/services/mei-scoring-engine.ts` — G2 (defensive array coercion).
- `backend/routes.ts` — G3 (to_regclass degrade guard on three competency-score endpoints) + G4 (remove MFA dev-bypass; always enforce MFA, console-log code in dev).
- `replit.md` — G6 (MFA doc correction; updated for the always-on 2FA flow).

## Out of scope (intentionally not changed)
- Database topology (G5) — deployment-time infrastructure; cannot be effected from code in the dev environment (see G5).
