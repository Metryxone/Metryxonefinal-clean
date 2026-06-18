---
name: LBI architecture state
description: P-R7 consolidated 3 LBI systems into one unified platform (W1-W10, 19 routes, 2 UI surfaces). Shared-engine consumer routes added 2026-06-12. Structural readiness 99%.
---

## Consolidated LBI Platform (post P-R7, 2026-06-11; shared-engines 2026-06-12)

Three previously-disconnected systems now unified behind `FF_LEARNING_INTELLIGENCE`:

- **System A** — CAPADEX-derived 5-dim scorer (`lbi-engine.ts`): ACTIVE (3 users scored)
- **System B** — Psychometric framework (19 domains / 97 subdomains): SEEDED, activation on module adoption
- **System C** — Module/institute flow: **RETIRED** (`system_c_status: 'retired'` in all API responses)

---

## Services (all additive, never-throws, flag-gated)

| File | Tables | State |
|---|---|---|
| `services/lbi-unifier.ts` | — (compose only) | Adds `unified_score`, `authority`, `system_c_status` to unified profile |
| `services/lbi-trend-engine.ts` | `lbi_behavior_trends`, `lbi_learning_trends` | ✅ 15+3 rows computed |
| `services/lbi-risk-engine.ts` | `lbi_risk_indicators` | ✅ 12 rows; 5 risk types |
| `services/lbi-recommendation-engine.ts` | `lbi_recommendation_master`, `lbi_user_recommendations`, `lbi_intervention_library` | ✅ 20+34+20 rows |
| `services/lbi-profile-builder.ts` | — (compose only) | 3-profile composite: learner/behavior/velocity |
| `services/lbi-report-generator.ts` | `lbi_reports` + `rf_generated_reports` (archive) | ✅ on-demand; archives to rf_generated_reports (non-blocking) |
| `services/lbi-longitudinal-engine.ts` | `lbi_longitudinal_snapshots` | ✅ 3 rows; trajectory enriches with ≥2 score history |

---

## Intelligence Chain Trigger

`calculateAndPersistLBI` → `setImmediate` → W3(trends) → W4(risks) → W5(recs) → W8(longitudinal)

Every CAPADEX session completion auto-populates ALL intelligence tables for that user.

---

## API Routes (19, in `routes/lbi-intelligence.ts`)

**Learner (auth required):**
- `/api/lbi/score`, `/api/lbi/trends/behavior`, `/api/lbi/trends/learning`
- `/api/lbi/risk-profile`, `/api/lbi/recommendations`, `/api/lbi/recommendations/:id/action`
- `/api/lbi/learner-profile`, `/api/lbi/report/generate`, `/api/lbi/report/latest`, `/api/lbi/report/:id`
- `/api/lbi/longitudinal`
- **NEW (2026-06-12):** `/api/lbi/intelligence` (unified 7-layer; adminEmail override for super_admin)
- **NEW:** `/api/lbi/forecast` (WCL2 horizon; polarity: risk/load/protective)
- **NEW:** `/api/lbi/outcomes` (WCL3 outcome for latest session)
- **NEW:** `/api/lbi/comparative` (EI-cohort comparative)
- **NEW:** `/api/lbi/causal-recommendations` (causal-recommendation-engine; ?limit=)

**Public:** `/api/lbi/interventions`, `/api/lbi/domains`

**Admin (superadmin):**
- `/api/admin/lbi/longitudinal-aggregates`, `/api/admin/lbi/quality-health`
- `/api/admin/lbi/backfill-intelligence`, `/api/admin/lbi/intelligence/:email`
- **NEW:** `/api/admin/lbi/activation-health` (WC-P2 two-axis: Consumption Rate + Activation Readiness)

---

## Shared Engine Consumers (added 2026-06-12)

LBI now CONSUMES (never duplicates) shared engines:
- `computeUserTrends` — WCL1 trend-intelligence.ts
- `computeHorizonForecasts` — WCL2 horizon-forecast.ts
- `getSessionOutcomes` — WCL3 outcome-intelligence.ts
- `resolveComparativeIntelligence` — comparative-intelligence.ts (needs userId from users table)
- `generateCausalRecommendations` — causal-recommendation-engine.ts (needs userId, not email)

**userId resolution pattern** (email → users table):
```sql
SELECT id FROM users WHERE LOWER(COALESCE(NULLIF(TRIM(email),''), username)) = $1 LIMIT 1
```

**Latest session pattern** (email → capadex_sessions):
```sql
SELECT id FROM capadex_sessions WHERE LOWER(guest_email) = $1 AND status='completed' ORDER BY created_at DESC LIMIT 1
```

---

## ensureSchema timing trap

Intelligence service tables (`lbi_behavior_trends`, `lbi_risk_indicators`, etc.) are created lazily on first route call.
- **`/api/lbi/interventions` is public** — hitting it bootstraps the entire recommendation schema + seed.
- If you need tables to exist immediately for a script, call that route OR run DDL directly from psql.
- Recommendation master (20 rows) and intervention library (20 rows) also seed on first call.

---

## Frontend Surfaces

- **LBIDashboard** (`components/career/LBIDashboard.tsx`): **8 tabs**
  - Overview / Behaviour Profile / Learning Trends / Forecast / Outcomes / Comparative / Recommendations / My Report
  - Forecast tab: polarity color-coded (protective=green, risk=red, load=amber); d30/d60/d90 grid
  - Outcomes tab: gap severity badges, confidence %, recommended actions
  - Comparative tab: percentile rank + vs-cohort-avg + cohort benchmarks
  - tab id=`lbi`, zone=`intelligence` in CareerBuilderPage.tsx

- **LBIPanel** (`components/superadmin/LBIPanel.tsx`): **7 tabs**
  - User Profiles / Quality Health / Longitudinal / Intervention Library / Domains
  - **NEW:** Activation Health (WC-P2 two-axis gauges + layer coverage grid + shared engine route manifest)
  - **NEW:** User Drill-down (email search → full intelligence: LBI score, dimension bars, trends, recs)

---

## Honest Runtime State (post-backfill, 3 test users)

- Trend direction = `insufficient_data` — **correct**: needs ≥2 score history rows
- Longitudinal trajectory = `stable/low` — **correct**: self-resolves after 2nd session
- lbi_reports = 0 — **correct**: user-generated on demand
- Shared-engine routes: return `enabled: false` or `note: no_completed_session` when no data — honest

---

## Capability Readiness

Structural: **99%** (shared-engine routes wired)
Activation: **~45%** (limited by 3 test users + 1 snapshot each — grows with real usage)

**Why:** activation grows organically as users complete CAPADEX sessions.

---

## Backfill Command

```bash
POST /api/admin/lbi/backfill-intelligence   # (superadmin auth)
```

---

## Score honesty policy (no LLM numbers)

LBI scores are a PRODUCT INVARIANT: never let the LLM emit numbers. Real numbers come
only from the auditable engine (`lbi_score_history`, **excluding `source='demo'` and
`@example.com`**); absent → explicit preview/null + disclaimer, never a fabricated value.
Norms derive only from real responses with a kMin gate + `is_provisional`/`source`
provenance; synthetic defaults are stamped and never yield a real percentile. A
raw-rescale `(raw/5)*100` is NOT a percentile — only norm-referenced values are.

## "Show real LBI scores" spans TWO scoring systems (don't conflate)

A "real LBI report" is fed by TWO independent systems, each with its own table,
route, and "real vs preview" gate — proving the pipeline means proving BOTH:
- **System A overall** — `lbi_score_history.overall_lbi` (+5 dims), computed by
  `calculateAndPersistLBI` from `capadex_sessions`. This is what `/api/ai-reports/generate`
  reads; it stays on the preview banner until a row exists that passes
  `source<>'demo'` AND `NOT ILIKE '%@example.com'`.
- **System B norms** — `lbi_session_responses` → `computeLbiNorms` → `lbi_subdomain_norms`
  → `/api/lbi/calculate-score` returns norm-referenced subdomain percentiles + a raw
  `overallScorePct`. `percentileBasis='norm_referenced'` only when norms exist; otherwise
  `subdomain_norms_only`/raw-rescale (NOT a percentile).
On a fresh DB the System-B framework tables (`lbi_age_bands/domains/subdomains/response_scales/
questions/assessment_sessions/session_responses`) may not exist at all — `seed-lbi-data.sql`
seeds only domains/subdomains/age_bands/modules, NOT questions/scales/sessions/responses.
`lbi_subdomain_norms` ships missing its newer cols (`mean_score/sd_score/sample_size/
is_provisional/source/computed_at`); `ensureLbiNormsSchema` ALTERs them in at compute time.

**Validation harness:** `backend/scripts/lbi-validate-real-scores.ts` (idempotent;
`--purge`) seeds a CLEARLY-MARKED non-demo cohort (age band `VAL_B`, `*VAL*` codes,
`lbi.real.validation@metryxone.io`) — responses are seed inputs but every score/percentile
is engine-computed — then exercises both systems and asserts established(≥30)/provisional(<30)
norms. Dev super-admin login is MFA-gated; an HTTP smoke test can complete it by reading the
`mfa_codes.code` for the `attempt_token` straight from the DB (Zoho email absent in dev).

## Two security traps when wiring real LBI data into a route

- **Admin-gate prefix trap:** the global `app.use('/api/admin', auth→superadmin)` gate
  covers ONLY `/api/admin/*`. Sibling admin routes under a DIFFERENT prefix
  (`/api/lbi/admin/*`, `/api/sdi/admin/*`, `/api/competency/*`) are NOT covered and need
  their own per-route guards. The counts-only `engine-summary` endpoints were left
  unauthenticated under this trap.
- **IDOR when an endpoint starts returning per-subject LBI data:** an endpoint that was
  fine while returning generic/LLM content becomes a data-leak the moment it returns real
  scores. Require auth AND resolve the subject from the authenticated principal only
  (self / owned-child via `storage.getChild(childId, principalId)` / superadmin) — never
  from a client-supplied `childId`/`email`. `/api/ai-reports/generate` had this exact bug.
