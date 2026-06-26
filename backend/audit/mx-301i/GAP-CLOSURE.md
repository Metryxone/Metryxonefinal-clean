# MX-301I — Gap Closure Register

**Date:** 2026-06-26
**Scope:** Close every issue discovered during the MX-301H evidence/validation pass.
**Principle:** Honesty over optimism. Coverage (mechanism exists) ⟂ Confidence (verified working) reported separately. No fabrication. **No deploy.**

---

## How to read this register

- **Severity:** Critical · High · Medium · Low
- Every gap carries: **Root Cause · Impact · Fix · Estimated Effort · Owner · Status**
- **Status** values: `FIXED & VERIFIED` · `FIXED (inline)` · `DEFERRED — deployment` · `BY DESIGN (no action)`
- Per the project owner's instruction ("we will fix these at the deployment, not now"), the two security/infrastructure gaps (**G4, G5**) are **DEFERRED to deployment** with that owner — they are documented here, not patched in this task.

---

## Summary

| # | Gap | Severity | Owner | Status |
|---|-----|----------|-------|--------|
| G1 | MEI dashboard endpoints 500 — wrong PK column (`id`) | High | Agent (MX-301I) | FIXED & VERIFIED |
| G2 | MEI engine crash — `education.reduce is not a function` | High | Agent (MX-301I) | FIXED & VERIFIED |
| G3 | Competency-score endpoints 500 — missing legacy table | Medium | Agent (MX-301I) | FIXED & VERIFIED |
| G4 | Super-admin MFA bypassed in dev | High (security) | Deployment / Platform | DEFERRED — deployment |
| G5 | Shared dev/prod database | Medium (infra) | Deployment / Platform | DEFERRED — deployment |
| G6 | `replit.md` MFA description drift | Low (docs) | Agent (MX-301I) | FIXED (inline) |
| G7 | CAPADEX assessment cold start (`capadex_sessions=0`) | Low (info) | — | BY DESIGN (no action) |

**Closed this task:** 4 (G1, G2, G3, G6). **Deferred to deployment:** 2 (G4, G5). **By design / no action:** 1 (G7).

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

### G4 — Super-admin login bypasses MFA in development *(DEFERRED to deployment)*
- **Affected:** `POST /api/login` (`mfaDisabledInDev`, `backend/routes.ts` L540-552).
- **Root Cause:** When `NODE_ENV !== 'production'` **and** `ZOHO_EMAIL` is unset, the handler skips the MFA challenge entirely and returns an authenticated session with `{mfaBypassed:true}`. This is **pre-existing platform behavior** — it was *discovered and disclosed* during MX-301H, not introduced by this work.
- **Impact:** In this workspace super-admin accounts authenticate with password only. Risk is amplified because **dev and prod share one database** (see G5), so the same accounts/data are reachable.
- **Fix (proposed, for deployment):** Enforce MFA whenever email credentials are configured; if no delivery channel exists in an environment, gate the bypass behind an explicit, non-default flag rather than `NODE_ENV`+secret-absence. **Not changed in this task** — altering platform auth is out of scope and the owner elected to address it at deployment.
- **Estimated Effort:** ~0.5–1 day (auth change + MFA delivery wiring + e2e verification).
- **Owner:** Deployment / Platform owner.
- **Status:** **DEFERRED — deployment** (per owner instruction). Documented in `replit.md` Super Admin section as a known risk.

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

### G5 — Development and production share one database *(DEFERRED to deployment)*
- **Root Cause:** The platform's dev workspace and the (intended) production environment point at the same PostgreSQL instance (`DATABASE_URL`). Demo/seed/test writes land in the same store that production reads serve.
- **Impact:** Demo data (e.g. `@example.com` seed users) and dev-time writes are visible to production; conversely, dev experiments can affect production reads. Compounds the G4 risk.
- **Fix (proposed, for deployment):** Provision a separate production database and migrate; keep demo/seed data confined to dev. Demo rows are already marked `@example.com`-purgeable to support a clean cutover.
- **Estimated Effort:** Infra task — provisioning + migration + verification (owner-scoped).
- **Owner:** Deployment / Platform owner.
- **Status:** **DEFERRED — deployment** (per owner instruction).

---

## LOW

### G6 — `replit.md` MFA description was inaccurate (doc drift)
- **Root Cause:** The Super Admin section stated dev login requires reading the MFA code from the `mfa_codes` table (`emailSent:false`). In reality dev **bypasses MFA entirely** (G4) and writes no `mfa_codes` row.
- **Impact:** Misleading onboarding/runbook docs; could send a future engineer chasing a non-existent dev MFA flow.
- **Fix:** Updated the `replit.md` Super Admin section to describe the production 2FA flow and the dev bypass accurately, cross-referencing G4 as a deferred risk.
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

Authenticated via the existing super-admin login (dev MFA bypass — see G4) to obtain a real session, then probed the previously-failing endpoints for the demo profile `sarah.johnson.mx301@example.com`:

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

## Files changed
- `backend/routes/mei-v2.ts` — G1 (PK column fix).
- `backend/services/mei-scoring-engine.ts` — G2 (defensive array coercion).
- `backend/routes.ts` — G3 (to_regclass degrade guard on three competency-score endpoints).
- `replit.md` — G6 (MFA doc correction + G4 risk note).

## Out of scope (intentionally not changed)
- Platform authentication / MFA enforcement code (G4) — deferred to deployment per owner.
- Database topology (G5) — deferred to deployment per owner.
