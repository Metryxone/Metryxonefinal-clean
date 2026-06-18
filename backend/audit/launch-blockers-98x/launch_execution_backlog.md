# MetryxOne — Launch Execution Backlog (Top 20 Blockers)

**Task:** MX-LAUNCH-98X-CRITICAL-BLOCKERS · 18 June 2026 · **Synthesis only** (no re-audit).
**Companion to** `launch_blockers_top20.md`. One work-item per blocker: implementation plan · files/services/workflows · effort · risk · dependencies · acceptance criteria.

**Effort key:** XS ≤0.5d · S 1–2d · M 3–5d · L 1–2wk · XL 3wk+. **Risk:** Low/Med/High = chance of regression or hidden complexity. All work is **additive / flag-gated**; flag-off must stay byte-identical to legacy.

---

### B01 — Align production feature flags with dev (parity)
- **Plan:** Add the launch-safe `FF_*=1` set to the `.replit` `[deployment]` run command (or a `deployment.env` sourced there). Stage in two waves: (1) **safe-to-enable** display/intelligence flags that are byte-identical with data present; (2) **commercial/enforcement** flags only after B13. Keep flags whose substrate is empty OFF until their blocker clears (don't enable a 503 into an empty table).
- **Files/services:** `.replit` (deploy run command), `backend/config/feature-flags.ts` (confirm defaults), `audit/production-parity/production_enablement_plan.md` (wave list).
- **Workflows:** redeploy after change; no dev workflow change.
- **Effort:** S · **Risk:** Med (enabling a flag over empty data surfaces a 503 in prod). · **Deps:** B02/B05/B13/B16 for the dependent flags.
- **Acceptance:** prod parity check shows each intended flag ON; each enabled route returns 200 with real data (not 503); flags over empty substrates remain OFF and documented.

### B02 — Compute & persist Employability Index at scale
- **Plan:** Add a batch runner that invokes the existing `mei-scoring-engine` for every profile and persists `mei_scores` / `mei_competency_scores`; wire `mei-chain-trigger` to run on assessment-complete and on a nightly schedule (see B17). Backfill the 101 existing profiles once.
- **Files/services:** `backend/services/mei-scoring-engine.ts`, `mei-chain-trigger.ts`, new `scripts/backfill-mei.ts`, scheduler (B17).
- **Effort:** M · **Risk:** Med (NULL inputs must yield abstain, never 0 — honour null≠0). · **Deps:** B05 (richer inputs improve quality but not required to run), B17.
- **Acceptance:** `mei_scores` row exists for each profile with ≥1 dimension; abstains recorded where inputs absent (not zero-filled); re-run is idempotent.

### B03 — Reconcile EI gauge to a single formula authority
- **Plan:** Make `EIGauge` consume the same `employabilityEngine.ts` 8-dim authority used by the breakdown modal; delete the divergent 6-dim inline path. One number on screen everywhere.
- **Files/services:** `frontend/.../EIGauge*`, `employabilityEngine.ts`, EI breakdown modal component.
- **Effort:** S · **Risk:** Low. · **Deps:** none (independent of B02 persistence).
- **Acceptance:** gauge value === breakdown headline for the same user across ≥5 sample profiles; no second formula remains in the codebase.

### B04 — Stand up the realized-outcome capture loop
- **Plan:** Add outcome-capture surfaces + storage: hire/offer outcome on the employer side (depends B09/B12), self-reported exam/promotion/grade on the seeker side, each stamped with the prediction it tests (`predicted_*_at_decision`). Do **not** claim predictive validity yet — only begin capture. Validity reporting stays "insufficient outcomes" until volume accrues.
- **Files/services:** new `outcome_events` capture table + write routes; employer hiring-stage write (B12); seeker self-report UI.
- **Effort:** L · **Risk:** Med (must avoid fabricating validity from thin data). · **Deps:** B09, B12, B18 (volume).
- **Acceptance:** outcome rows can be written and linked to a prior prediction; validity surfaces read "insufficient outcomes (n<threshold)" rather than a number.

### B05 — Seed & govern the live competency question bank
- **Plan:** Populate `competency_question_templates` (manual POST → `status='draft'` per existing curation flow), promote via the existing review workflow; wire runtime `GET /api/competency/questions/select` to prefer DB bank over the static fallback. Target a defensible item count per competency.
- **Files/services:** `routes/competency-questions.ts`, `CompetencyQuestionsPanel.tsx`, `competency_question_templates`.
- **Effort:** L (content-bound) · **Risk:** Med (quality/calibration). · **Deps:** B06 (taxonomy alignment helps).
- **Acceptance:** DB bank returns items for each competency; runtime selects DB items; static fallback only when DB empty for a competency.

### B06 — Import competency ontology (O*NET/ESCO)
- **Plan:** Run the bulk import to populate `ont_*` / `cg_*` (roles, skills, links); bridge O*NET-derived weights via the existing `bridgeOnetDerivedWeights` so the "Estimated" badge fires. Stage a curated subset for launch; full import post-launch.
- **Files/services:** `scripts/import-onet*`, `seed-role-dna.ts`, ont_*/map_role_competency, bridge service.
- **Effort:** L · **Risk:** Med (volume, namespace `onto_*` vs `ont_*` split). · **Deps:** none.
- **Acceptance:** `ont_roles`/`ont_competencies` non-zero; role/skill graphs resolve beyond the 200-role catalog; Estimated badge appears where weights are O*NET-derived.

### B07 — Reach k≥30 benchmark cohorts *(Cat C — population-bound)*
- **Plan:** No engineering fix beyond ensuring norms populate once volume exists; keep k=30 suppression. Add a backfill job to compute `*_norms` / `*_benchmarks` once cohorts cross threshold.
- **Files/services:** benchmark engine, `*_benchmarks`/`*_norms`, scheduled recompute.
- **Effort:** S (job) + population time · **Risk:** Low. · **Deps:** B18.
- **Acceptance:** when a cohort ≥30 exists, benchmark rows compute and "Provisional" clears for that cohort only.

### B08 — Surface persisted recommendations to all profiled users
- **Plan:** Persist rec-engine output to `career_recommendations` / `mei_user_recommendations` for every profile (batch + on-update), and read from the store in the UI instead of computing per-request only. Backfill the 101 profiles.
- **Files/services:** rec engine, career store, `career_recommendations`, `mei_user_recommendations`, backfill script.
- **Effort:** M · **Risk:** Low. · **Deps:** B02.
- **Acceptance:** every profile with inputs has ≥1 persisted recommendation surfaced in-app; counts scale with profiles, not stuck at ~8.

### B09 — Build the employer ATS backend (`/api/employer/*`)
- **Plan:** Implement the missing route family — `jobs`, `candidates`, `interviews`, `offers`, `analytics`, `company` — backed by employer tables; reuse the lazy `employer_jobs` table from `recruiter-postings.ts` (bootstrap it first). All routes `requireAuth` + employer-scope guard (B10/B11).
- **Files/services:** new `backend/routes/employer.ts`, `recruiter-postings.ts`, employer_* tables.
- **Workflows:** restart `Backend API` after adding routes (else `Cannot GET`).
- **Effort:** XL · **Risk:** High (largest net-new surface). · **Deps:** B11 (accounts/scope).
- **Acceptance:** all six endpoints return 200 with persisted data; recruiter UI loads jobs/candidates/interviews/offers/analytics/company without 404.

### B10 — Authenticate & scope employer/workforce routes (close IDOR)
- **Plan:** Add `app.use('/api/m5', requireAuth)` and `app.use('/api/career/workforce', requireAuth)` guards; derive `org_id` from the authenticated principal, never from the query param; add an org-ownership check. **Re-verify current middleware first** (some `/api/m5` gating may already exist per memory) and only patch residual unauth routes.
- **Files/services:** `routes/m5*`, `routes/career-workforce*`, auth middleware.
- **Effort:** S · **Risk:** Med (must not break legitimate calls; verify each route's org resolution). · **Deps:** B11 (principal→org mapping).
- **Acceptance:** unauthenticated calls 401; a user cannot read another org via `?org_id=`; org is resolved server-side from session.

### B11 — Model employer accounts, orgs, seats & commercial tier
- **Plan:** Add `organizations` + recruiter account role (`hr_recruiter`), `/api/employer/register` + login, seat/membership table, and an employer pricing tier in `subscription_packages`. Wire entitlement to gate employer features.
- **Files/services:** new employer-auth routes, `organizations`/membership tables, `subscription_packages` (employer SKU), entitlement resolver.
- **Effort:** XL · **Risk:** High. · **Deps:** none — identity/org scaffolding precedes commerce; the employer-SKU wiring is a post-B13 subtask (breaks the prior B11↔B13 cycle).
- **Acceptance:** an employer can register, create an org, invite seats, and hold an entitlement; data is org-isolated.

### B12 — Make the Job Ecosystem real (live postings + pipeline)
- **Plan:** Add the `employer_jobs` write path (POST create/update job) and candidate import + stage-transition routes; switch seeker jobs/fitment to read live postings (keep `MARKET_CATALOG` as labelled fallback only). Record `hiring_outcomes` at decision (feeds B04).
- **Files/services:** `recruiter-postings.ts`, employer routes (B09), `employer_jobs`/`job_postings`/`hiring_outcomes`, fitment reader.
- **Effort:** L · **Risk:** Med. · **Deps:** B09, B11.
- **Acceptance:** an employer-posted job appears to seekers; a seeker can apply; recruiter can move stages; outcome writes on hire/reject.

### B13 — Stand up the commercial substrate
- **Plan:** Populate sellable `subscription_packages` (priced, valid), take Razorpay out of demo mode (live keys via secrets), enforce entitlement on paid surfaces, and define at least one Career Builder + one Employer SKU. Keep payment verify fail-CLOSED (IDOR linkage, webhook closed, idempotency).
- **Files/services:** commerce spine, `capadex-payments`/commercial routes, `subscription_packages`, entitlement gate, secrets (Razorpay live keys via environment-secrets).
- **Effort:** L · **Risk:** High (payments). · **Deps:** B11 for employer SKU.
- **Acceptance:** a real test transaction grants an entitlement; flag-off path byte-identical; webhook/idempotency behave fail-closed.

### B14 — Remove or label fabricated `Math.random()` metrics
- **Plan:** For each affected module, either (a) back the number with a real computation, or (b) gate the surface behind a flag and visibly label it "illustrative / not live" until backed. No fabricated number reaches a customer unlabelled.
- **Files/services:** `roie-risk.ts`, `paie-forecasting.ts`, `nhda-intelligence.ts`, `lde-temporal.ts`, `vx-report-intelligence.ts`, `m3/m4/m5/*`, `iil-core.ts`, `frontend/server/.../career.ts`.
- **Effort:** M (label/gate) → L (real backing) · **Risk:** Med. · **Deps:** real data sources where backing is chosen.
- **Acceptance:** grep shows no `Math.random()`/`rnd()` feeding a user-facing metric without a flag+label; deterministic output for backed metrics.

### B15 — Persist Resume Studio server-side
- **Plan:** Add a resume store (table + `GET/PUT /api/career/resume`) keyed by user; migrate the localStorage writer to read/write the server; make resume data available to EI/intelligence.
- **Files/services:** `components/career/ResumeStudio.tsx`, new resume routes + table.
- **Effort:** M · **Risk:** Low. · **Deps:** none.
- **Acceptance:** resume persists across devices/sessions server-side; intelligence can read it; localStorage becomes cache only.

### B16 — Enable Career Passport in prod + ensure `cp_*` + employer consumption
- **Plan:** Turn on `careerPassport` in the prod flag set (B01 wave), ensure `cp_*` schema exists (run ensure/migration at boot rather than first-write), and add the employer-side consumption/verification path (depends B09/B10). Contact PII stays unpublished.
- **Files/services:** `routes/employer*` (consume), `routes/career-passport*`, `cp_*` schema, flag set.
- **Effort:** M · **Risk:** Med. · **Deps:** B01, B09, B10.
- **Acceptance:** passport generates/verifies in prod; an authenticated employer can consume a shared passport; PII never exposed.

### B17 — Add the snapshot scheduler (longitudinal history)
- **Plan:** Add a nightly job computing EI/competency snapshots into `mei_score_history` (+ competency history), append-only. This unblocks trend/velocity tabs and feeds notifications (§11).
- **Files/services:** new scheduler/cron, `mei-scoring-engine`, history tables.
- **Effort:** M · **Risk:** Low (append-only — never mutate history in place). · **Deps:** B02.
- **Acceptance:** running two consecutive nights yields ≥2 history rows per active profile; trend tabs render real series.

### B18 — Purge demo data from shared prod DB + acquisition plan
- **Plan:** Pre-launch, purge all `@example.com` / `source='Demo Seed'` rows from the shared prod DB (idempotent, scoped). Population (k≥30, repeat sessions) resolves only with real acquisition — track as a launch-gate metric, not an engineering task.
- **Files/services:** `scripts/purge-demo.ts` (prod-scoped, dry-run first), all demo-labelled tables.
- **Effort:** S (purge) · **Risk:** High (operating on prod — dry-run + count-verify before delete). · **Deps:** run last, after demos no longer needed for QA.
- **Acceptance:** zero `@example.com`/demo rows in prod; real user counts visible; no production code path depends on demo rows.

### B19 — Populate behavioural spine / enable outcome crosswalk
- **Plan:** Either backfill the behavioural spine (`buildBehaviorGraph` → persist) for sessions with responses, or enable `FF_WC3_OUTCOME_CROSSWALK` so `loadSessionConstructs` resolves; hide/flag low-confidence (0.2) journey rows so "100% covered" stops over-claiming.
- **Files/services:** WC-3 chain, `capadex_session_patterns`, crosswalk flag, journey reader.
- **Effort:** M · **Risk:** Med (don't inflate coverage). · **Deps:** B18 (real sessions); 0-response sessions are un-backfillable (true ceiling).
- **Acceptance:** outcome/journey state non-empty for sessions with responses; journey confidence surfaced honestly (no 100%@0.2 claim).

### B20 — Operational & safety hardening
- **Plan:** Add a crisis human-notify path (alert inbox/email to staff on escalation); remove the email SPOF for MFA/OTP (fallback channel or break-glass admin path); add OTP/login rate-limiting; re-enable a sane CSP; move lazy `ensureSchema` toward migration-led for launch-critical tables.
- **Files/services:** safety middleware, `email.ts` (Zoho) + fallback, auth/OTP routes, CSP config, migrations.
- **Effort:** L · **Risk:** Med. · **Deps:** none (do the safety + auth + rate-limit subset before launch; CSP/migration tail can trail).
- **Acceptance:** crisis escalation reaches a human; MFA recoverable if Zoho down; brute-force throttled; CSP active; launch-critical schema migration-backed.

---

## Effort/risk roll-up (for sequencing)

| Wave | Items | Theme | Gate |
|---|---|---|---|
| **0 (pre-flight, days 1–3)** | B03, B10, B14(label), B18(plan) | trust + security + honesty quick fixes | none |
| **1 (core metric, week 1–2)** | B02, B17, B08, B01(wave 1) | make EI/recs/history real & visible in prod | B02→B17/B08 |
| **2 (employer + jobs, week 2–4)** | B11, B09, B12, B10(final), B16 | stand up B2B config end-to-end | B11→B09→B12 |
| **3 (commerce, week 3–4)** | B13, B01(wave 2), B11 SKU | monetization on | B11/B13 |
| **4 (validity loop, ongoing)** | B04, B19, B05, B06, B07 | begin capture; deepen content; norms with volume | population-bound |
| **launch gate** | B18(purge), B20(safety subset), B14(no unlabelled) | final pre-deploy | all Cat A clear |

*STOP for approval — no deploy. Quick-win subset in `launch_quick_wins.md`.*
