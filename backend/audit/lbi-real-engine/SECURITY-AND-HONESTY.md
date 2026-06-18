# LBI Real-Engine Conversion — Security & Honesty Audit

Scope: Replace LBI's AI-generated (LLM) scores with a real, auditable engine; populate
subdomain norms from real data only; re-verify/secure admin LBI endpoints.

## 1. Scores now come from a real engine (no LLM numbers)

- `POST /api/ai-reports/generate` (backend/routes.ts): all "produce a score 60–95"
  prompt instructions were removed. The LLM now returns **qualitative content only**
  (summary, findings, recommendations, insights, action plan). Any stray numeric
  fields the model emits are stripped server-side.
- Real numbers are attached only from `resolveRealLbiScore()`, which reads
  `lbi_score_history` **excluding** `source='demo'` and `@example.com` rows. When no
  real score exists, the response is marked `preview:true`, `dataAvailable:false`,
  `overallScore:null`, with a disclaimer — never a fabricated number.
- `POST /api/lbi/calculate-score`: the misleading `percentile = (raw/5)*100` was
  renamed to `scorePct` (a raw-to-100 rescale, clearly not a percentile). True
  percentiles come only from `percentileFromNorms()` over real norms, else `null`.

## 2. Norms populated from real responses only

- `backend/services/lbi-norms-engine.ts`:
  - `computeLbiNorms()` derives mean/sd/sample_size **only** from real
    `lbi_session_responses` joined to questions/subdomains/sessions/age_bands.
  - k-anonymity gate: `is_provisional=true` when `sample_size < kMin` (default 30).
  - Writes **nothing** when there are zero real responses (honest empty state).
  - `percentileFromNorms()` returns `null` for synthetic/missing norms — synthetic
    rows never yield a percentile.
- `framework-parity.ts` `generate-defaults` (the previously-fabricating path) now
  stamps every row `source='synthetic_default'`, `is_provisional=true` so fabricated
  defaults are clearly labelled and excluded from real percentiles.

### Dev-environment reality (honest note)
- `lbi_session_responses` exists but is **empty**; `lbi_questions`/`lbi_subdomains`/
  `lbi_assessment_sessions`/`lbi_age_bands` do **not** exist in dev (created lazily).
- `lbi_score_history` holds 8 rows, **all** demo/`@example.com` (fabricated) → excluded.
- Therefore the runtime currently always returns the honest **preview** state and
  `compute-norms` returns "no responses" without error. This is correct, not a bug.

## 2b. /api/ai-reports/generate — access control (IDOR fix)

Connecting this endpoint to real `lbi_score_history` made it return personal
assessment data, but it was **unauthenticated** and accepted attacker-controlled
identifiers (`childId`, and an unvalidated `req.body.email`) — an IDOR / data-exposure
risk. Fixed:

- Added `requireAuth` to the route (unauthenticated → `401`, verified).
- Real-score subject is resolved by `resolveAuthorizedSubjectEmail()` from the
  **authenticated principal only**: no `childId` → the principal's own email; a
  `childId` → must be a child the principal **owns** (`storage.getChild(childId,
  principal.id)`), else `403`; `super_admin` may resolve any subject.
- The unvalidated `req.body.email` fallback was **removed** — a client-supplied email
  is never trusted; `resolveRealLbiScore()` now takes only a pre-authorized email.
- Net effect: unauthenticated blocked (401), cross-user `childId` blocked (403),
  only self/owned-child/superadmin receive real numbers. Institutes pass no `childId`
  so they resolve to self (preview) — no regression.

## 3. Admin LBI endpoint security — re-verified

All `/api/lbi/admin/*` and `/api/admin/lbi/*` routes were enumerated and confirmed
to chain `requireAuth` + `requireSuperAdmin` (or `...chain` = the same pair):

- `routes/lbi-engine.ts` — compute-norms, norms, profiles, recalculate-all, analytics,
  history, unified, signal-coverage: all `...chain`.
- `routes/framework-parity.ts` — age-bands, clusters, domains, subdomain-list,
  versions, subdomain-norms, age-band-weights, learning-mappings, generate-defaults:
  all `requireAuth` + `requireSuperAdmin`.
- `routes/import-export.ts` — export, import: both guarded.
- `routes/lbi-intelligence.ts` — longitudinal-aggregates, quality-health,
  backfill-intelligence: all `...chain`.

### Gap found and fixed
- `GET /api/lbi/admin/engine-summary` (framework-parity.ts) was **unauthenticated**
  ("public read, counts only"). It is the only `/api/lbi/admin/*` sibling without a
  guard, and the global `app.use('/api/admin', …)` gate does not cover the
  `/api/lbi/admin/*` prefix. **Fixed**: added `requireAuth` + `requireSuperAdmin`.
  Verified it now returns `401`. The frontend (`LBIAdminPage.tsx`) only calls it when
  `isAuthenticated` with session credentials, so no UI breakage.

### Out of scope (noted, not changed)
- `GET /api/sdi/admin/engine-summary` and `GET /api/competency/engine-summary` are the
  same unauthenticated counts-only pattern in sibling frameworks. Not part of this
  task (LBI only); flagged as a follow-up for consistency.
- `backend-main/` (separate FastAPI upload service) is a distinct service, out of scope.
- Retired System-C `/api/lbi/sessions/:id/results` `(total/max)*100` left untouched.

## Verification performed
- Frontend `tsc --noEmit`: clean. Backend `tsc --noEmit`: clean.
- Backend boots ("Server listening on 8080").
- Route smoke tests: compute-norms `401`, norms `401`, engine-summary `401`,
  ai-reports `400` on empty body (all registered + guarded as expected).
