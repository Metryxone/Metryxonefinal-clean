# MetryxOne — Top 20 Launch Blockers (95–98% Readiness)

**Task:** MX-LAUNCH-98X-CRITICAL-BLOCKERS · 18 June 2026
**Nature:** **Synthesis only.** No new audit, scorecard, or measurement was performed. Every blocker below is drawn from *existing* audit findings (cited per blocker). Honesty contract honoured: Structural / Activation / Validity remain separate; null/absent ≠ 0; seeded ≠ computed ≠ validated.
**Scope chain:** Competency Assessment → Employability Index → Career Builder → Career Passport → Job Ecosystem → Employer Portal.

**Staleness disclaimer:** Every finding is **as-of its prior audit date** (see source per blocker). Operational/route-level findings (esp. B09, B10, B11, B12, B16, B20) are drift-prone — **re-verify against current middleware/schema before implementation sizing**; some gating may have changed since the cited audit.

**Evidence sources (existing audits):**
- `audit/core-business/core_business_audit.md` (CB)
- `audit/career-builder-launch/*` (CBL)
- `audit/competency-worldclass/competency_gap_analysis.md` (CW)
- `audit/ep-x1a/EP-X1A_EMPLOYER_PORTAL_AUDIT.md` (EP)
- `audit/platform-activation/activation_gap_report.md` (PA)
- `audit/production-parity/production_parity_gap.md` (PP)
- `audit/launch-readiness/03_BLOCKERS_AND_GAPS.md` (LR)
- `audit/mx-runtime-01/activation_readiness_scorecard.md` (RT)

---

## Section 1 — The Top 20 (master table)

| ID | Title | Modules | Severity | Cat | Launch Impact |
|---|---|---|---|---|---|
| **B01** | Production runs with advanced flags OFF (dev ≠ prod) | ALL | Critical | A | Published app silently 503s/hides headline features |
| **B02** | Employability Index computes/persists zero scores | EI · Career Builder · Passport · Employer | Critical | A | Headline metric dark for all 101 profiles |
| **B03** | EI integrity defect — gauge (6-dim) ≠ breakdown (8-dim) | EI · Career Builder | Critical | A | Product shows two different employability numbers |
| **B04** | Zero realized outcomes across every product | ALL | Critical | B | No criterion/predictive validity is possible |
| **B05** | Live competency question bank empty | Competency | High | B | Assessment runs on static fallback; no governed pool |
| **B06** | Competency ontology not imported (O*NET/ESCO absent) | Competency · Career Builder | High | C | "12-level hierarchy" is empty headroom |
| **B07** | Benchmarks below k=30 everywhere → "Provisional" for all | Competency · EI | High | C | Comparative value proposition does not exist yet |
| **B08** | Recommendations don't reach users (≈8 vs 101 profiles) | Career Builder · EI | High | B | Rec engine output never surfaced at scale |
| **B09** | Employer ATS backend missing — 6 `/api/employer/*` 404 | Employer · Job Ecosystem | Critical | A | Recruiter UI has no server; core employer use-case dead |
| **B10** | Employer workforce intelligence unauthenticated + IDOR | Employer | Critical | A | Any caller reads any org's data via `?org_id=` |
| **B11** | No employer accounts / orgs / auth / commercial tier | Employer | Critical | A | No way to onboard, isolate, or bill an employer |
| **B12** | Job Ecosystem has no real jobs; static catalog fallback | Job Ecosystem · Employer | Critical | A | apply→match→hire pipeline broken at step 1 |
| **B13** | No commercial substrate / monetization unit | ALL (revenue) | Critical | A | Cannot launch any paid tier |
| **B14** | Fabricated runtime metrics via `Math.random()` | Employer · Enterprise dashboards | Critical | A | Dashboards show synthetic numbers (honesty breach) |
| **B15** | Resume Studio persists to localStorage only | Career Builder | High | B | Resumes lost cross-device; invisible to intelligence |
| **B16** | Career Passport gated OFF in prod + `cp_*` lazy/absent | Career Passport | High | A | Passport 503/hidden in prod; employer can't consume |
| **B17** | No snapshot scheduler → no longitudinal history | EI · Competency · Career Builder | High | B | Trend/velocity tabs never accrue data |
| **B18** | Real users ≈ 0; demo data sits in shared prod DB | ALL | Critical | A | Trends/cohorts ungroundable; demo must be purged pre-launch |
| **B19** | Behavioural spine empty → outcome/journey chain zero-state | CAPADEX → Career | High | B | "100% covered" journey at confidence 0.2 (inflation trap) |
| **B20** | Operational/safety hardening gaps | ALL (platform) | Critical | A | Crisis no human-notify; email SPOF; thin rate-limit; CSP off |

Category key: **A** = Launch Blocking · **B** = High Priority · **C** = Post-Launch (see Section 4).

---

## Section 1 (cont.) — Blocker detail cards

> Each card: Description · Affected Modules · Business / Customer / Employer / Revenue Impact · Severity · Launch Impact.

### B01 — Production runs with advanced flags OFF (dev ≠ prod parity)
- **Description:** The dev `Backend API` workflow sets ~27 `FF_*=1` overrides; the `.replit` `[deployment]` run command sets **none**. So in a published deployment, 23 registry flags + 4 `process.env` gates are OFF → Career Graph, Future Readiness, Career Passport, Report Factory, the WC-3 chain, commercial layer, Enterprise Analytics, EIOS V2 all return 503 / hide. (PP §3; PA §1)
- **Modules:** ALL · **Business:** the product you demo is not the product you ship. · **Customer:** features visibly vanish in prod. · **Employer:** workforce/passport surfaces 503. · **Revenue:** commercial flags off → no paywall in prod.
- **Severity:** Critical · **Launch Impact:** hard blocker — must align flags before any deploy.

### B02 — Employability Index computes/persists zero scores
- **Description:** `mei_scores=0`, `mei_competency_scores=0`, `mei_score_history=0` across 101 profiles; the engine + config (5 dims, 50 industry calibrations, 93 insight rules) are real but never run at scale. (CB §4; CBL gap #1; CW keystone #5)
- **Modules:** EI, Career Builder, Passport, Employer · **Business:** the flagship number doesn't exist for customers. · **Customer:** no employability score to act on. · **Employer:** nothing to screen on. · **Revenue:** the headline value prop is unsellable.
- **Severity:** Critical · **Launch Impact:** hard blocker for any EI-dependent surface.

### B03 — EI integrity defect (gauge ≠ breakdown)
- **Description:** The headline `EIGauge` (6-dim) and the EI breakdown modal (8-dim, credits assessment 25pts) compute different employability numbers on the same screen. (CBL gap #3; memory: EI formula authority is `employabilityEngine.ts`)
- **Modules:** EI, Career Builder · **Business/Customer:** destroys trust in every downstream number. · **Employer:** cannot cite a score that disagrees with itself. · **Revenue:** trust defect blocks premium positioning.
- **Severity:** Critical · **Launch Impact:** must reconcile to one formula before launch (also a quick win).

### B04 — Zero realized outcomes across every product
- **Description:** `realized outcomes = 0` everywhere (no hire, promotion, exam result, grade change observed). Every "predictive"/"readiness"/"probability" figure is a-priori model output, not validated prediction. (CB Data Density Ledger — "one number dominates the whole audit"; CW critical #3/#4)
- **Modules:** ALL · **Business:** no proof scores mean anything. · **Customer:** claims are unvalidated. · **Employer:** the exact axis employers price on is absent. · **Revenue:** caps willingness-to-pay for any serious buyer.
- **Severity:** Critical · **Launch Impact:** cannot be *fully* closed in 30 days (needs real outcomes over time); **the loop must be stood up now** so capture begins (Cat B — start, don't finish).

### B05 — Live competency question bank empty
- **Description:** `competency_question_templates=0`; assessment leans on a static frontend bank (~50–100 items) — 1–2 orders of magnitude below enterprise, no governed/calibratable pool, no item-bias output. (CW critical #7/#8/#9; CB §2)
- **Modules:** Competency · **Customer:** high repeat-exposure, thin measurement. · **Employer:** not a defensible instrument. · **Revenue:** caps competency as a paid product.
- **Severity:** High · **Launch Impact:** not a hard blocker (static fallback keeps the assessment functional), but caps competency depth/credibility — fix at/around launch (Cat B).

### B06 — Competency ontology not imported (O*NET/ESCO absent)
- **Description:** `ont_*=0`; the 12-level hierarchy and "1,016 roles / 49k links" capability is unexercised live; Career Builder is a 200-role walled garden vs O*NET ~1,000 / ESCO ~3,000. (CW critical #12; CB §2/§5; PA §2)
- **Modules:** Competency, Career Builder · **Customer:** users outside the catalog hit sparse graphs. · **Employer:** no interoperable taxonomy. · **Revenue:** limits breadth-based value.
- **Severity:** High · **Launch Impact:** can launch a curated subset; full import is staged (Cat C).

### B07 — Benchmarks provisional for everyone (k<30)
- **Description:** Real cohorts ~17 rows, below the k=30 suppression floor; `ont_benchmarks=0`, `mei_benchmarks=0`, `stage_competency_norms=0` → every user sees "Provisional". (CB §2; CW critical #6)
- **Modules:** Competency, EI · **Customer:** no meaningful peer comparison. · **Employer:** no normed population. · **Revenue:** comparative tier unsellable.
- **Severity:** High · **Launch Impact:** population-bound; resolves with real volume (Cat C).

### B08 — Recommendations don't reach users
- **Description:** `career_recommendations≈8` / gaps≈6 vs 101 profiles; `mei_user_recommendations=0`. The rec engine is strong but its output is not surfaced/persisted for most users. (CB §5 weakness; CBL gap #5)
- **Modules:** Career Builder, EI · **Customer:** profile but no guidance. · **Employer:** n/a. · **Revenue:** the "what to do next" hook (a conversion driver) is missing.
- **Severity:** High · **Launch Impact:** activation fix (Cat B).

### B09 — Employer ATS backend missing (6 endpoints 404)
- **Description:** `EmployerPortalPage.tsx` (6,962 lines) calls `/api/employer/{jobs,candidates,interviews,offers,analytics,company}` — **none exist**; every fetch 404s. (EP Exec Summary, D02/D03)
- **Modules:** Employer, Job Ecosystem · **Customer (recruiter):** core ATS is non-functional. · **Employer:** cannot post a job or manage a candidate. · **Revenue:** employer product unsellable.
- **Severity:** Critical · **Launch Impact:** hard blocker for the employer config.

### B10 — Employer workforce intelligence unauthenticated + IDOR
- **Description:** 35 `/api/m5/*` + 23 `/api/career/workforce/*` routes have **no auth**; `org_id` comes from a query param (`?org_id=`) with no ownership check → any caller reads any org's data. (EP D12.1/D12.2). *Re-verify current middleware before sizing — some `/api/m5` gating may have been added since the EP audit.*
- **Modules:** Employer · **Customer:** confidential org data exposed. · **Employer:** unshippable security posture. · **Revenue:** blocks enterprise procurement (security review fails).
- **Severity:** Critical · **Launch Impact:** hard security blocker.

### B11 — No employer accounts / orgs / auth / commercial tier
- **Description:** No `/api/employer/register`, no `organizations` table, no recruiter accounts (0 `hr_recruiter` users), no seats, no employer pricing tier; `subscription_packages` holds B2C/CAPADEX plans only. 0 paid employer transactions. (EP D01/D10)
- **Modules:** Employer · **Employer:** no onboarding, isolation, or billing. · **Revenue:** the entire B2B revenue line is absent.
- **Severity:** Critical · **Launch Impact:** hard blocker for employer monetization.

### B12 — Job Ecosystem has no real jobs (static fallback)
- **Description:** `employer_jobs=0` (DEAD — no write path), `job_postings=0`, `hiring_outcomes=0`; candidate import + stage-transition routes 404; jobs/fitment fall back to static `MARKET_CATALOG`. Pipeline breaks at step 1 (Job). (EP D02/D05/D14; CBL gap #20)
- **Modules:** Job Ecosystem, Employer · **Customer (seeker):** "jobs" are sample data, applications go nowhere. · **Employer:** no live postings. · **Revenue:** no job-marketplace monetization.
- **Severity:** Critical · **Launch Impact:** hard blocker for the jobs config.

### B13 — No commercial substrate / monetization unit
- **Description:** `subscription_packages=0` sellable rows, 0 real sales, Razorpay in **demo mode**, reliance on manual super-admin grants; Career Builder tabs are mostly free (no priced SKU). (LR CB-3; CBL commercial; CW critical #20)
- **Modules:** ALL (revenue) · **Business:** no scalable self-serve revenue path. · **Revenue:** cannot launch a paid tier.
- **Severity:** Critical · **Launch Impact:** hard blocker for any paid launch.

### B14 — Fabricated runtime metrics (`Math.random()`)
- **Description:** `roie-risk.ts`, `paie-forecasting.ts`, `nhda-intelligence.ts`, `lde-temporal.ts`, `vx-report-intelligence.ts`, `m3/m4/m5/*`, and `frontend/server/.../career.ts` synthesize numbers per-request; `iil-core.ts` generates identity/culture-DNA via `rnd()`. (PA §5a; LR CB-5)
- **Modules:** Employer/Enterprise dashboards, EI-adjacent · **Customer/Employer:** sees fabricated intelligence. · **Revenue:** honesty/compliance breach blocks enterprise trust.
- **Severity:** Critical · **Launch Impact:** must back with real computation or visibly label/disable before exposure (partly a quick win).

### B15 — Resume Studio persists to localStorage only
- **Description:** Resume edits saved under `mx-resume-userId` in the browser; no server-side store → lost across devices, invisible to EI/intelligence. (CBL gap #13; PA §5c)
- **Modules:** Career Builder · **Customer:** loses work; no portability. · **Revenue:** weakens the stickiest seeker feature.
- **Severity:** High · **Launch Impact:** activation/UX fix (Cat B).

### B16 — Career Passport gated OFF in prod + `cp_*` lazy/absent
- **Description:** `careerPassport` flag is OFF in prod (503/hidden); `cp_*` tables are lazy-created on first write (absent until then). Passport correctly scrubs contact PII (good), but generation/verification/employer-consumption are immature and the employer side can't consume it (no employer auth — see B09/B10). (PP §3a/§5; CBL passport notes)
- **Modules:** Career Passport · **Customer:** passport unavailable in prod. · **Employer:** cannot verify/consume. · **Revenue:** blocks passport-led B2B2C.
- **Severity:** High · **Launch Impact:** flag + schema + employer-consumption path (Cat A for prod visibility).

### B17 — No snapshot scheduler → no longitudinal history
- **Description:** No cron computes nightly EI/competency snapshots; `mei_score_history=0`, trend/velocity tabs never accrue even as profiles grow. (CBL gap #7; LR HG-5)
- **Modules:** EI, Competency, Career Builder · **Customer:** no "progress over time". · **Revenue:** kills the re-engagement/retention loop.
- **Severity:** High · **Launch Impact:** activation fix (Cat B).

### B18 — Real users ≈ 0; demo data in shared prod DB
- **Description:** All per-user data is labelled demo (`@example.com`); <30 users, ≤2 repeat sessions → trends/forecasts/cohorts/personalization are statistically ungroundable; dev and prod share one DB, so demo rows must be purged before go-live. (LR CB-4; RT §3/B1; PP §0)
- **Modules:** ALL · **Business:** nothing is grounded in real adoption. · **Revenue:** no real funnel exists yet.
- **Severity:** Critical · **Launch Impact:** population blocker (resolves with acquisition); **pre-launch task = purge `@example.com` from the shared prod DB**.

### B19 — Behavioural spine empty → outcome/journey zero-state
- **Description:** `wc3_outcome_state=0`, `capadex_session_patterns=0`; `FF_WC3_OUTCOME_CROSSWALK` OFF → `loadSessionConstructs` returns `[]`; journey rows ship at confidence 0.2 while coverage reads "100%" (inflation trap). (LR CB-1, HG-2; CB §1)
- **Modules:** CAPADEX → Career · **Customer:** behavioural inputs to Career Builder are degraded. · **Revenue:** weakens the differentiated behavioural layer.
- **Severity:** High · **Launch Impact:** populate spine or enable crosswalk; hide low-confidence journey until fixed (Cat B).

### B20 — Operational / safety hardening gaps
- **Description:** Crisis detection has **no human-notify path**; Zoho email is a single point of failure for MFA/OTP (lockout risk); OTP/login rate-limiting is thin; CSP disabled; lazy `ensureSchema` is not migration-led; dev/prod share a DB. (CW medium #66–#76; LR HG)
- **Modules:** ALL (platform) · **Customer:** safety + security risk at public scale. · **Employer:** fails security review. · **Revenue:** blocks enterprise procurement.
- **Severity:** Critical (safety subset) · **Launch Impact:** the safety + auth + rate-limit subset is launch-blocking; the rest is hardening.

---

## Section 2 — Root Cause Analysis (no speculation; cited)

| ID | Observed issue | Underlying cause | Affected systems | Dependencies | Evidence |
|---|---|---|---|---|---|
| B01 | Features 503/hidden in prod | Deploy run command sets no `FF_*`; registry defaults false | Flag registry, `.replit` deploy | none (config-only) | PP §2–§4 |
| B02 | `mei_scores=0` | Engine never invoked/persisted at scale; no batch/scheduler | mei-scoring-engine, chain trigger | B17 (scheduler), B05 (inputs) | CB, CBL, CW |
| B03 | Two EI numbers | 6-dim gauge path diverged from 8-dim breakdown; formula authority not single-sourced | EIGauge, employabilityEngine | none | CBL, memory |
| B04 | All predictions unvalidated | No outcome-capture loop ever built/populated | every scoring product | B09/B12 (capture surfaces) | CB, CW |
| B05 | Static fallback bank | Curated DB bank never seeded/governed | competency runtime | B06 (ontology) | CW, CB |
| B06 | Ontology empty | O*NET/ESCO import never run live | ont_*, cg_* | bulk import job | CW, PA |
| B07 | Provisional benchmarks | Population < k=30; norms unpopulated | benchmark engine | B18 (volume) | CB, CW |
| B08 | Recs not surfaced | Recs computed per-request, not persisted/pushed to profiled users | rec engine, career store | B02 | CB, CBL |
| B09 | Employer fetches 404 | `/api/employer/*` route family was never implemented (frontend-first) | employer routes | B11 (accounts) | EP |
| B10 | Org data public | M5/career-workforce routes lack auth; `org_id` trusted from query | M5, career-workforce | B11 (identity) | EP D12 |
| B11 | No employer identity/billing | Employer accounts/orgs/commercial never modelled | users, subscription_packages | none | EP D01/D10 |
| B12 | No live jobs | `employer_jobs` has no write path (POST route missing) | employer_jobs, recruiter-postings | B09 | EP D02/D14 |
| B13 | No paid path | No sellable packages; Razorpay demo; manual grants | commerce spine | none | LR, CBL, CW |
| B14 | Synthetic dashboards | `Math.random()` used in place of real computation | roie/paie/nhda/lde/m3-5, iil-core, FE career.ts | real data sources | PA §5a, LR CB-5 |
| B15 | Resume not portable | No server resume store; localStorage-only writer | ResumeStudio | none | CBL, PA |
| B16 | Passport off in prod | `careerPassport` flag off; `cp_*` lazy | career-passport routes | B01, B09/B10 | PP, CBL |
| B17 | No history | No scheduler/cron for snapshots | scheduler, mei history | B02 | CBL, LR |
| B18 | No real users; demo in prod DB | Never deployed/acquired; demo seeded into shared DB | whole platform, prod DB | go-live + purge | LR, RT, PP |
| B19 | Outcome chain zero | Spine empty + crosswalk flag off → no constructs | wc3 chain, capadex patterns | B18 (sessions) | LR CB-1 |
| B20 | Safety/sec gaps | Crisis notify, email SPOF, rate-limit, CSP never hardened | safety, auth, email | none | CW, LR |

---

## Section 4 — Classification

### Category A — Launch Blocking (must fix before launch)
B01, B02, B03, B09, B10, B11, B12, B13, B14, B16 (prod visibility), B18 (demo purge), B20 (safety/auth/rate-limit subset).

### Category B — High Priority (fix at/around launch; start the validity loop)
B04 (stand up capture now), B05, B08, B15, B17, B19.

### Category C — Post-Launch (population/depth — resolve with volume & staged content)
B06 (full O*NET/ESCO import), B07 (k≥30 cohorts), and the depth tail of B04 (achieving validated predictive claims over time).

---

## Sections 5–14 — Blocker index by module (cross-reference)

- **§5 Competency Assessment:** B05 (question bank), B06 (ontology/role mapping), B07 (benchmarks), B17 (history) — *what blocks 95%+: empty governed bank + empty ontology + sub-k benchmarks + no validity loop.*
- **§6 Employability Index:** B02 (no scores), B03 (gauge≠breakdown), B07 (no benchmarks), B04 (no outcomes), B17 (no history) — *what blocks trust: compute+persist+reconcile, then calibrate against real outcomes.*
- **§7 Career Builder:** B02 (EI feed), B08 (recs not surfaced), B06 (walled garden), B15 (resume), B19 (behavioural inputs) — *what blocks value: surface persisted intelligence to the 101 existing users.*
- **§8 Career Passport:** B16 (off in prod + cp_* lazy), B09/B10 (employer can't consume), B02 (thin content) — *blocks generation→verification→employer consumption→trust.*
- **§9 Job Ecosystem:** B12 (no real jobs), B09 (employer post/manage 404), B04 (no hiring outcomes) — *blocks discovery→matching→application→hire.*
- **§10 Employer Portal:** B09 (ATS 404), B10 (auth/IDOR), B11 (accounts/commercial), B14 (fabricated workforce metrics), B16 (passport consumption) — *blocks employers paying & renewing.*
- **§11 Notifications:** subset of B17/B20 — no scheduled assessment/recommendation/job/application/interview/employer alert workflows wired (reminders depend on a scheduler that does not exist).
- **§12 Workflow Automation:** B02→B08→B17 (assessment→score→recommendation→plan), B12→B09 (job match→application→employer workflow), B04 (hiring→outcome tracking) — *the end-to-end chain breaks wherever a persistence/route hop is missing.*
- **§13 Activation:** B01 (flags), B02/B05/B08/B17 (engines not producing/persisting), B18 (no real users) — *engines don't produce real outputs because flags are off in prod, the bank/ontology are empty, and no real user has exercised them.*
- **§14 Validation:** B04 (no realized outcomes), B07 (no norms), B14 (synthetic numbers) — *trust is blocked by absence of outcomes, norms, and by fabricated metrics that must be removed/labelled.*

---

*Synthesis only — no scoring, no re-measurement. Implementation plans in `launch_execution_backlog.md`; quick wins in `launch_quick_wins.md`; founder prioritization in `founder_priority_brief.md`. STOP for approval — no deploy.*
