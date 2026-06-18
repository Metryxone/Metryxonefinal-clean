# P-X1 · Deliverable 3 — Capability Reuse Analysis
_Generated 2026-06-10T14:38:00.263Z_

## Ranking: Dimensions Unlocked Per Engineering Day

Sorted by **impact/effort ratio** (dimensions unblocked ÷ estimated engineering days).

| ID | Capability | Products blocked | Dims unblocked | Est. effort | Dims/day | Reusable asset |
|---|---|---|---|---|---|---|
| S6 | User Intelligence Store | 2/3 | 4 | 2d | 2.00 | wcl0_user_intelligence (built, needs consumer endpoints) |
| S8 | Identity Resolution | 3/3 | 6 | 3d | 2.00 | career-behavior-adapter; post-completion hook trigger |
| S10 | Auth & Security Hardening | 3/3 | 4 | 2d | 2.00 | requireAuth + requireSuperAdmin middleware (exists) |
| S3 | Trend Engine | 3/3 | 3 | 2d | 1.50 | WC-L1 trend math (already real) |
| S1 | Snapshot Framework | 3/3 | 3 | 3d | 1.00 | WC-L5 post-completion hook pattern |
| S2 | Longitudinal Persistence | 3/3 | 3 | 3d | 1.00 | append-only INSERT (not UPSERT) pattern; cron trigger |
| S5 | Personalization Consumption | 3/3 | 3 | 3d | 1.00 | wcl0_user_intelligence consumer API |
| S7 | Memory Consumption Layer | 3/3 | 3 | 3d | 1.00 | WC-L5 retrieval engine (read-only, ready) |
| S4 | Recommendation Persistence | 3/3 | 3 | 4d | 0.75 | career-behavior-adapter; capadex_intervention_recommendations |
| S9 | Report Data Integrity | 3/3 | 3 | 6d | 0.50 | None — product-specific formula reconciliation required |

---

## What "Reuse" Means for Each Capability

### S10 — Auth & Security Hardening (ratio: 2.0)
**What exists**: `requireAuth` and `requireSuperAdmin` middleware are already in use across CAPADEX routes.  
**Reuse**: Copy the same guard pattern to 5 LBI routes and 12 CB routes.  
**New build**: Zero — pure pattern reuse. Config actions (SESSION_SECRET, FF flags) are owner-only.

### S8 — Identity Resolution (ratio: 2.0)
**What exists**: `career-behavior-adapter.ts` (pure, tested) bridges CAPADEX session → career profile. `post_completion_hooks.ts` pattern is proven.  
**Reuse**: Add a hook item that fires `calculateLBI(userId)` + `updateCareerBehaviorProfile(userId)` + persists EI score per user after each CAPADEX completion.  
**New build**: The hook trigger; EI per-user score persist (currently only logged in `ei_calculation_logs`).

### S3 — Trend Engine (ratio: 1.5)
**What exists**: WC-L1 trend engine (`wc3_stage_state` series). Logic for mean/slope per session series.  
**Reuse**: Extract the per-user trend math as a shared utility; adapt for EI score series (once S1+S2 provide history) and LBI score series.  
**New build**: Product-specific trend surfaces (EI velocity tab, LBI trend dashboard).

### S6 — User Intelligence Store (ratio: 2.0 — tied with S10/S8)
**What exists**: `wcl0_user_intelligence` = 9 rows. Persona + behaviour + segment. REST endpoint at `GET /api/career/behavior-profile/:userId`.  
**Reuse**: EI and LBI add a read call to the same endpoint; personalization inputs become populated without building new intelligence.  
**New build**: EI consumer (personalise scoring bands by segment); LBI consumer (personalise age-band weighting by behaviour profile).

### S1 — Snapshot Framework (ratio: 1.0)
**What exists**: WC-L5 `post_completion_hooks.ts` (item 20) snapshots all intelligence layers after each CAPADEX session.  
**Reuse**: The hook-invoke pattern. For EI: add a hook to `takeSnapshot()` after each EI compute (or cron daily). For LBI: change the UPSERT to INSERT (append-only). For CB: wire `career_memory_snapshots` table to profile-save events.  
**New build**: EI cron job; LBI history migration; CB snapshot trigger.

### S2 — Longitudinal Persistence (ratio: 1.0)
**What exists**: CAPADEX append-only session records. WC-L5 UPSERT-per-session (per-session memory, not per-update).  
**Reuse**: The "never overwrite, always INSERT" discipline. Apply to EI scores, LBI scores, CB snapshots.  
**New build**: `lbi_score_history` table migration; EI snapshot cron trigger; CB snapshot write on profile mutation.

### S5 — Personalization Consumption (ratio: 1.0)
**What exists**: `wcl0_user_intelligence` has persona/segment/behaviour. CB `useCareerBrain` already consumes it (partially).  
**Reuse**: The `career-behavior-adapter` consumption pattern. EI and LBI add the same read call.  
**New build**: EI personalisation layer (band weighting by behaviour profile); LBI age-band selection by wcl0 segment.

### S4 — Recommendation Persistence (ratio: 0.75)
**What exists**: `capadex_intervention_recommendations` (73 rows); `career-behavior-adapter` bridges concern scores to career context.  
**Reuse**: The career-behavior-adapter bridge already maps CAPADEX recommendations → career profile. Activate the bridge consumer in CB.  
**New build**: EI user-keyed recommendation writes (resolve `ref_review_queue` backlog); LBI recommendation engine (data needed first); CB bridge consumer activation + user_id column (needs migration).

### S7 — Memory Consumption Layer (ratio: 1.0)
**What exists**: WC-L5 retrieval engine (read-only, zero writes). Memory already persisted: 94 rows, 7/7 types.  
**Reuse**: `GET /api/capadex/memory/:sessionId` endpoint (read-only). Surface in CB `progressLedger`; EI timeline; LBI behaviour history.  
**New build**: Product UI consumers of the memory retrieval endpoint.

### S9 — Report Data Integrity (ratio: 0.5 — lowest leverage)
**What exists**: CAPADEX report pipeline (clean single source). `requireAuth` pattern.  
**Reuse**: CAPADEX report architecture as target pattern.  
**New build**: Product-specific. EI: formula reconciliation + gauge/modal unification (cannot be reused from elsewhere). LBI: create 2 missing tables + AI fabrication guard. CB: dedicated career report surface.  
**Note**: S9 has the lowest reuse leverage because the gaps are product-specific. It is CRITICAL for EI and LBI confidence scores but cannot be accelerated by platform work.

---

## Asset Inventory: What CAPADEX Has Built That Can Be Shared

| Asset | Location | Available for | Status |
|---|---|---|---|
| WC-L5 Memory Layer | `wcl5_memory` + retrieval endpoint | EI (timeline), CB (progressLedger), LBI (behaviour history) | ✅ READY |
| WC-L0 User Intelligence Store | `wcl0_user_intelligence` + `/api/career/behavior-profile/:userId` | EI (personalisation), LBI (segment weighting) | ✅ READY |
| WC-L1 Trend Engine | `wc3_stage_state` series math | EI (velocity), LBI (learning trajectory), CB (progress trend) | ✅ READY (data-starved) |
| Post-Completion Hook Pattern | `post_completion_hooks.ts` | EI (takeSnapshot trigger), LBI (calculateLBI trigger), CB (career bridge trigger) | ✅ READY |
| Career-Behavior Adapter | `career-behavior-adapter.ts` | LBI (CAPADEX → LBI bridge), CB (already partial) | ✅ READY |
| Intervention Library | `intervention_library` (140 rows) + `capadex_intervention_recommendations` | LBI (recs), CB (growth plan recs) | ✅ READY |
| requireAuth Middleware | `backend/routes.ts` middleware | LBI (5 routes), CB (12 routes) | ✅ READY |
| Subscription Packages | `subscription_packages` (13 rows) | LBI, EI (commercial layer) | ✅ SEEDED |
