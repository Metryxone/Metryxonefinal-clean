# P-X1 · Deliverable 4 — Implementation Roadmap
_Generated 2026-06-10T14:38:00.263Z_
_PLANNING ONLY · STOP FOR APPROVAL BEFORE ANY IMPLEMENTATION_

---

## Roadmap Structure

Four phases of approximately 5–8 engineering days each (~25 engineering days total).
Each phase is **additive and flag-gated** (flag-off = byte-identical prior behaviour).
Phases 1+2 can begin in parallel; Phase 3 depends on Phase 2; Phase 4 is mostly parallel.

---

## Phase F1 — Security & Identity Foundation (~6 days)

**Goal**: Close security blockers and establish the identity resolution layer.  
**Products impacted**: ALL  
**Capabilities addressed**: S10, S8

### F1.1 — Auth Hardening (S10) [2 days, LOW risk]
Grounded in: WC-P2 G5 (5 unauth LBI routes), WC-P3 CB auth gaps.

1. **LBI admin route guards** — Add `requireAuth + requireSuperAdmin` to all 5 lbi-engine routes:
   `POST /api/admin/lbi/calculate`, `POST /api/admin/lbi/recalculate-all`,
   `GET /api/admin/lbi/scores`, `GET /api/admin/lbi/score/:userId`,
   `DELETE /api/admin/lbi/scores/:userId`.
   MUST complete before F1.2 (G5 pre-req for G2).

2. **CB route auth backfill** — Add `requireAuth` to career routes that handle user-specific data
   (career-memory read/write, career recommendations, career profile mutations).
   IDOR guard: Verify `resolveEffectiveUserId` pattern is applied to all career-memory endpoints.

3. **EI commercial guard** — Add entitlement enforcement to EI result endpoints that should be
   behind a subscription tier (per WC-P1 D11 Commercial gap).

4. **Config actions (owner, not code)** — Set `SESSION_SECRET` in deployment secrets +
   add `FF_WC3_STAGE`, `FF_WC3_OUTCOME`, `FF_DECISION_PERSISTENCE` to production env vars.
   OTP plaintext storage: documented risk; fix in separate security sprint (bcrypt OTP migration).

### F1.2 — Cross-Product Identity Hook (S8) [3 days, MEDIUM risk]
Grounded in: WC-P2 G2 (CAPADEX → LBI), WC-P3 CB bridge, WC-P1 EI stored score.

1. **calculateLBI post-completion trigger** — Add hook item to `post_completion_hooks.ts` that
   calls `calculateLBI(userId)` after each CAPADEX session completion (user must be identified,
   skip anonymous). Reads CAPADEX behaviour spine → writes `lbi_scores` row for the user.
   **Pre-req**: F1.1.1 (auth guard on routes).

2. **EI per-user score persistence** — Add hook item to persist the computed EI score to a
   `user_ei_scores` table (or `career_seeker_profiles.data.ei_snapshot` JSONB).
   Currently computed at query time only — no per-user history exists.

3. **Career-behavior-adapter trigger** — Ensure the CAPADEX→Career bridge fires on every
   completion (verify the existing hook item is active; confirm it is not silently skipped for
   non-career users). Grounded in: WC-P3 D03 bridge inactive finding.

### F1.3 — LBI Report Tables (S9 partial) [1 day, LOW risk]
Grounded in: WC-P2 G3.

1. **Create `lbi_report_types` and `lbi_subdomain_report_map`** tables (migrations already
   documented in WC-P2 G3 analysis). No seed data required to unblock the admin routes.

2. **AI fabrication guard** — Add a guard to the LBI AI report generator that REJECTS generation
   when `lbi_scores` = 0 for the requested user, returning a degraded
   "assessment required" state instead of hallucinated content.

---

## Phase F2 — Snapshot & Persistence Layer (~7 days)

**Goal**: Wire per-product snapshot and history persistence.  
**Products impacted**: EI, LBI, Career Builder  
**Capabilities addressed**: S1, S2, S4 partial

### F2.1 — EI Snapshot Framework (S1 + S2) [2 days]
Grounded in: WC-P1 GAP-2 (Longitudinal dead, 0 snapshots).

1. **Cron trigger** — Add a daily cron job (or post-EI-compute hook) that calls
   `takeSnapshot(userId)` for every active user after their EI score is computed.
   This writes to `ei_snapshot_versions` (table exists, 0 rows).

2. **EI per-user score table** — Verify the stored score from F1.2.2 creates the input needed.
   The cron trigger should read the latest score and write a dated snapshot.

3. **Smoke-test**: After F2.1, re-run the EI scorecard script. Target:
   `ei_snapshot_versions` ≥ 1 row; D10 Longitudinal coverage >15%.

### F2.2 — LBI History Table (S1 + S2) [2 days]
Grounded in: WC-P2 G4 (no longitudinal layer).

1. **Create `lbi_score_history` table** — INSERT-not-UPSERT model. Each calculateLBI call
   writes a dated history row (user_id, calculated_at, domain_scores JSONB, composite_score).
   Existing `lbi_scores` continues as the "latest" row.

2. **Update calculateLBI** to INSERT into `lbi_score_history` before or alongside the UPSERT
   to `lbi_scores`.

3. **Smoke-test**: After F1.2.1 fires (LBI post-completion trigger), verify
   `lbi_score_history` receives rows.

### F2.3 — Career Builder DB-Backed Memory (S1 + S2) [3 days]
Grounded in: WC-P3 D07 Longitudinal (career-memory.ts in-memory Map).

1. **career_memory_snapshots write path** — Wire `career-memory.ts` to write snapshots to
   `career_memory_snapshots` (table exists, 0 rows)
   on each significant career-profile mutation (profile save, assessment complete, resume upload).
   DB-write is additive; in-memory Map remains for fast reads.

2. **progressLedger feed** — Connect `useCareerBrain.ts` `progressLedger` calculation to read
   from `career_memory_snapshots` series instead of only from the in-memory state.

3. **career_recommendations user_id bridge** — Add user_id column to career_recommendations; activate bridge consumer in career-behavior-adapter.

---

## Phase F3 — Intelligence Activation (~7 days)

**Goal**: Connect products to the shared intelligence store; activate trend computation.  
**Products impacted**: EI, LBI, Career Builder  
**Capabilities addressed**: S5, S6, S7, S3, S4 (completion)

### F3.1 — User Intelligence Store Consumer APIs (S6) [2 days]
Grounded in: WC-L0 store built (9 rows), EI/LBI disconnected.

1. **EI intelligence consumer** — Add a call in the EI scoring path to read
   `wcl0_user_intelligence` for the user; use the segment/behaviour data to:
   (a) personalise the EI band weighting by persona group,
   (b) surface the user's behavioural context alongside the EI score.

2. **LBI intelligence consumer** — Add a read call from LBI domain scoring to
   `wcl0_user_intelligence`; use behaviour dimensions to weight age-band selection.

### F3.2 — Personalization Layer Wire-Up (S5) [2 days, depends on F3.1]
Grounded in: WC-P1 D09 (30%/25%), WC-P2 D07 (30%/0%), WC-P3 D09 (55%/25%).

1. **EI personalisation** — Unify band label split (6-dim formula bands vs 8-dim modal bands)
   by deriving BOTH from the single reconciled formula (S9 dependency — can stub until S9 resolves).
   Add wcl0 segment → band-weight personalisation (e.g. competitive segment → career-velocity weighting).

2. **LBI personalisation** — Read user segment from wcl0_user_intelligence; select age-band
   questionnaire accordingly. Fall back to demographic inference if wcl0 absent.

3. **CB personalisation depth** — Deepen the existing partial implementation: ensure ALL career tabs
   receive the full behaviour context (not just the top-level CareerBrain aggregator).

### F3.3 — Memory Layer Surface (S7) [2 days, depends on F2]
Grounded in: WC-L5 retrieval engine ready (94 rows).

1. **EI memory surface** — Add a "your history" panel to the EI gauge UI reading from
   the WC-L5 memory retrieval endpoint (`GET /api/capadex/intelligence/memory`).
   Show prior scores and trend direction.

2. **CB memory surface** — Feed `career_behavioural_memory` + WC-L5 memory to `progressLedger`.
   Surface in Career Builder's Journey tab as a longitudinal progress card.

### F3.4 — Trend Engine Activation (S3) [1 day, depends on F2]
Grounded in: WC-L1 trend engine real but trendIntelligence flag OFF.

1. **Enable `trendIntelligence` and `longitudinalAutomation` flags in the workflow command**.
   Per WC-L1B, only 2 users will produce trends (data ceiling, not a bug).

2. **EI trend computation** — Once EI snapshots exist (F2.1), add trend computation to the EI
   dashboard using the same slope/mean math as WC-L1.

---

## Phase F4 — Report Integrity & Commercial (6–8 days, mostly parallel to F2/F3)

**Goal**: Fix product-specific report integrity; close commercial wiring gaps.  
**Products impacted**: EI (critical), LBI (critical), CB  
**Capabilities addressed**: S9, Commercial hardening

### F4.1 — EI Formula Reconciliation (S9 EI) [3 days, CRITICAL]
Grounded in: WC-P1 GAP-1 (3 divergent formulas — CRITICAL, undermines product credibility).

1. **Decision required**: Choose ONE authoritative EI formula (recommend: 8-dimension as documented,
   since it is the product-facing model). Archive the 6-dim formula as a legacy calculation.

2. **Reconcile `employabilityEngine.ts`** to implement the 8-dim formula with all inputs
   (assessment score, education score, skills, experience, trajectory, competency, social, certifications).

3. **Wire competency assessment → EI gauge** — Currently `useHybridEI` and the assessment flow
   are independent. The competency score (25pt weight documented) must feed the gauge score.
   This is WC-P1 GAP-5 (second most critical gap).

4. **Test**: verify gauge score == modal breakdown total after fix. Log divergence to 0 in smoke test.

### F4.2 — LBI Report Infrastructure (S9 LBI) [2 days]
Grounded in: WC-P2 G3 (report infrastructure broken / fabricated).

1. **F1.3 complete** (tables created).
2. **Seed report types** for System A (CAPADEX-derived) and System B (framework-based).
3. **Remove hardcoded AI prompt scores** (currently 60–95 range). Guard: if `lbi_scores`
   exist for user → pass real scores to prompt. Else → return "assessment required" state.

### F4.3 — CB Career Report Surface (S9 CB) [3 days]
Grounded in: WC-P3 D08 Report Intelligence (35%/20%).

1. **Dedicated career intelligence report** — A per-user PDF/HTML career report that composes:
   EI score + competency bands + CAPADEX stage + career pathway + recommended actions.
   Routes into the existing Career Builder "Reports" panel.

---

## Phase Sequencing Summary

| Phase | Days | Depends on | Products impacted | Shared capabilities |
|---|---|---|---|---|
| F1 — Security & Identity | 6 | — (prerequisite) | ALL | S10, S8 |
| F2 — Snapshot & Persistence | 7 | F1 | EI, LBI, CB | S1, S2, S4 |
| F3 — Intelligence Activation | 7 | F2 | EI, LBI, CB | S5, S6, S7, S3 |
| F4 — Report Integrity | 7 | F1 (F4.1 parallel to F2) | EI (CRITICAL), LBI (CRITICAL), CB | S9 |
| **TOTAL** | **~25** | | | |
