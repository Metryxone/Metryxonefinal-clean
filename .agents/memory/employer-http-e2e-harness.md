---
name: Employer HTTP-path e2e harness (session + CSRF)
description: How to drive the authenticated employer HTTP surface from a tsx harness, and the two-layer idempotency of the hiring-outcome recording path.
---

# Employer HTTP-path e2e harness

The employer suite is **session-only** (Passport `mx.sid`, no mintable bearer) and the
whole `/api` surface is **CSRF-gated** (signed double-submit). To exercise the REAL HTTP
path from a `tsx` script (not direct DB writes like `e2e-employer-lifecycle.ts`):

1. `GET /api/csrf-token` first → it sets the `mx.csrf` cookie AND returns the token. On
   every mutation echo the cookie value in the `x-csrf-token` header (decode it first).
2. `POST /api/register` with a policy-valid password → **auto-logs in** (`req.login`),
   setting the `mx.sid` session cookie. Keep a tiny cookie jar across requests.
3. `POST /api/employer/register` flips `account_type='employer'` in the DB. This survives
   to later requests because `deserializeUser` **reloads `accountType` from the DB** each
   request (the in-memory `req.user` mutation alone would not).
4. Then `POST /api/employer/jobs`, `POST /api/employer/candidates`, `PUT
   /api/employer/candidates/:id`, `POST /api/employer/pipeline/bulk-move` all pass the gate.

## Hiring-outcome recording (validation_loop_outcomes) — non-obvious traps
- **`snapshotDecisionProb` is fire-and-forget (`void`)**: the HTTP response returns BEFORE
  the `validation_loop_outcomes` row is written. **Poll the DB** (short timeout), never
  assert synchronously off the response.
- **Idempotency is enforced at TWO layers**, so re-doing a hire never duplicates the pair:
  (a) the route only snapshots when `predicted_prob_at_decision IS NULL` (write-once), so a
  candidate's decision-time pair is **frozen at the FIRST terminal move** — moving Hired→
  Interview→Rejected does NOT overwrite the original `outcome_value`; (b) the INSERT is
  `ON CONFLICT (outcome_type, ref_id)` keyed on `employer_candidate:<id>`.
- Flag `validationLoop` defaults **true** (not in the Backend API workflow command). Demo
  (`@example.com`) rows record `is_demo=true` and stay out of realized/cert counts.

**Why:** the recording fn was unit-tested directly against the DB, but the authenticated
session→CSRF→PUT/bulk-move→snapshot→record chain was never run e2e. Harness:
`backend/scripts/task253-hiring-outcome-e2e.ts` (self-cleaning, @example.com / e2e-prefixed).

## Now a registered validation step
The harness is registered as the `hiring-outcome-e2e` validation command (`cd backend &&
npx tsx scripts/task253-hiring-outcome-e2e.ts`) so a refactor that silently breaks the
fire-and-forget recording path is caught automatically. **It needs the Backend API workflow
live on :8080** — the run drives the real server; if the workflow is down the harness fails
fast on ECONNREFUSED (that IS the honest fail). Keep the harness self-cleaning or repeated
validation runs would leak throwaway rows into cert counts.
