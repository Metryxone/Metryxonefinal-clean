# MetryxOne — Behavioral Intelligence SaaS Platform

## Stack
- **Frontend**: React + Vite (port 5000) — `frontend/`
- **Backend**: Node.js + Express + tsx (port 8080) — `backend/`
- **Database**: PostgreSQL via Drizzle ORM (`DATABASE_URL` env var)
- **Proxy**: `/api/*` → `http://localhost:8080` (`frontend/vite.config.ts`)
- **Email**: `ZOHO_EMAIL` + `ZOHO_APP_PASSWORD` env vars (`backend/email.ts`)

## Workflows
- `Backend API`: `cd backend && npm run dev:server`
- `Start application`: `cd frontend && npm run dev`

## Deployment (canonical production path — single source of truth)
**Production = Google Cloud + Firebase**, deployed via `scripts/deploy-gcp.sh` (one-shot). This is the ONLY canonical production topology:
- **Node API** (`backend/`) → Cloud Run service `metryxone-api`.
- **FastAPI upload** (`backend-main/`) → Cloud Run service `metryxone-bulk-upload`. The deploy sets the Node API's `FASTAPI_URL` to this service URL — **this is why file uploads work in prod** (uploads proxy through the Node API to FastAPI).
- **Frontend** (`frontend/`) → Firebase Hosting (`frontend/firebase.json` + `.firebaserc`), with `/api/**` rewritten to `metryxone-api`. Public domain `https://metryx.one`.
- Region `asia-south1`. Required envs (stored in Secret Manager): `GCP_PROJECT`, `DATABASE_URL`, `MONGODB_URI`, `EMERGENT_LLM_KEY`; `SECRET_KEY` auto-generated. Verify `SESSION_SECRET` (backend fails fast in prod without it) and `ZOHO_EMAIL`/`ZOHO_APP_PASSWORD` (super-admin MFA email delivery) are set.

**`.replit` `[deployment]` (autoscale) is DEV / WORKSPACE PREVIEW ONLY — NOT production.** It starts only the Node backend (no FastAPI), so file uploads do NOT work under it unless you separately publish the FastAPI service and set `FASTAPI_URL` + a real `UPLOAD_SERVICE_TOKEN` (the default token is a dev placeholder). Do not treat Replit autoscale as the production deploy.

**Env vars**: `docs/ENVIRONMENT.md` is the authoritative reference (required vs recommended vs optional, per service, where to set). The Node backend runs a boot-time preflight (`backend/lib/env-preflight.ts`) that aborts in prod on missing REQUIRED vars (`SESSION_SECRET`, `DATABASE_URL`) and warns loudly on feature-degrading ones (`ZOHO_*`, `FASTAPI_URL`, `UPLOAD_SERVICE_TOKEN`, `OPENAI_API_KEY`); no-op in dev.

## Key Files
- `backend/index.ts` — Express entry, port 8080
- `backend/routes.ts` — Main route file (~13.2k lines)
- `backend/shared/schema.ts` — Drizzle schema (symlinked: `/home/runner/workspace/shared` → `backend/shared`)
- `frontend/src/App.tsx` — React Router + Screen enum
- `frontend/src/components/SuperAdminDashboard.tsx` — Super admin UI shell (panels in `components/admin/*` + `components/superadmin/*`)
- `frontend/src/pages/CareerBuilderPage.tsx` — Career Builder monolith (~7.8k lines)
- `frontend/src/components/FreeAssessmentModal.tsx` — CAPADEX assessment flow (~4.1k lines)

## Super Admin
- Login: `support@metryxone.com` / `admin123` (role `super_admin`; seeded by `storage.ts` `seedSuperAdmin`, `SUPER_ADMIN_EMAIL`) · `SuperAdminLogin.tsx` → SPA nav to `screen = 'admin-dashboard'`.
- Super-admin login is **always 2FA-gated** (MX-301I §G4 — dev bypass removed): `POST /api/login` returns `{mfaRequired:true}` + writes a `mfa_codes` row; complete via `POST /api/admin/mfa/verify`. A password alone is **never** sufficient (no `mfaBypassed` path).
- MFA delivery: code is **emailed via Zoho** (`ZOHO_EMAIL`/`ZOHO_APP_PASSWORD`) when configured. In dev with no email channel, the code is still issued + persisted and, in non-production only, **logged to the `Backend API` workflow console** (`[DEV MFA] …`) — never returned in the HTTP response. To complete dev login, read the 6-digit code from the workflow logs (or `SELECT code FROM mfa_codes WHERE used=false ORDER BY created_at DESC LIMIT 1`) and enter it in the login screen.

## Feature flags (two distinct systems)
- **File registry** `backend/config/feature-flags.ts` — every additive V2 phase ships behind a flag; flag-off → protected routes 503 + UI panel hides; flag-off path is byte-identical to legacy. All default OFF.
- **DB table** `feature_flags` (distinct) — gates `POST /api/signals/ingest` (`signal_intelligence`) + engine flags read by `services/feature-flags.ts`. If signal tables look empty, check this table first.

## User preferences
- **Audits & additive phases STOP for approval** before merge/deploy; never auto-deploy.
- **Honesty over optimism** — never assume, fabricate, or inflate. Orphans/gaps are honest findings. Report Coverage (data exists) and Confidence (trustworthy/sufficient) as separate axes.
- **Additive & flag-gated** — new phases re-shape already-computed data behind a flag; flag-off is byte-identical to legacy.

## Documentation (single sources of truth — keep DETAIL there, not in this file)
- `docs/phase-history.md` — build logs + **Phase Index Tables** (canonical for namespaces, migrations, deep-links, API bases, engine internals, Adaptive Career Intelligence phase index).
- `docs/CAPADEX.md` — consolidated CAPADEX doc (overview · runtime Modules 15–26 · API reference · relevance-audit).
- `docs/SUPERADMIN.md`, `docs/CAREER_BUILDER.md`, `docs/COMPETENCY_ASSESSMENT.md`, `docs/COMPETENCY_AND_ADAPTIVE_INTELLIGENCE.md`, `docs/EMPLOYABILITY_INDEX.md`, `docs/EMPLOYABILITY_PASSPORT.md`, `docs/MICRO_ACCURATE_STAGE_GUIDANCE.md`, `docs/peer-benchmarking.md`, `docs/integration-map.md`.
- `.agents/memory/*` — durable engineering lessons per subsystem (read before touching that subsystem).
- Audit deliverables regenerate to `backend/audit/<phase>/` (e.g. `audit/aq-1/`, `audit/launch-readiness/`).

---

## Global conventions (apply platform-wide)
- **Additive / read-only / never-throws**: V2 phases re-shape already-computed data; flag-off or absent data → byte-identical prior behaviour. Never fabricate.
- **Canonical migration + lazy ensure-schema**: most newer tables have a migration file AND a lazy `ensure*Schema()` that mirrors it (no migration runner). Filenames in `docs/phase-history.md`.
- **New backend route → restart `Backend API`** before smoke-testing (`Cannot GET` otherwise).
- **Express route order**: register literal sub-paths (`/export.csv`, etc.) BEFORE the catch-all `/:id` or the param handler swallows them. → `.agents/memory/express-literal-vs-param-route-order.md`.
- **Strengths canon**: strengths come ONLY from CSI `positive_factors` / positive longitudinal growth — NEVER from raw concern-signal magnitude (signals are concern-DIAGNOSTIC).
- **Admin APIs**: `requireAuth` + `requireSuperAdmin`, 60s cache, `?refresh=1` to bust.
- **PIL knowledge graph namespace**: `pil_kg_*` — NEVER bare `kg_*` (bare `kg_*` is the live Employability graph; PIL materialize against it would WIPE it). → `.agents/memory/kg-table-name-collision.md`.

---

## Feature Map (stable — do not redesign; condense, don't expand)
> Each entry is a navigation pointer (UI panel · route · table). Engine internals, algorithms, and gotchas live in `docs/CAPADEX.md` + `.agents/memory/*` — go there for detail.

### Assessment configuration
- **Frameworks** `admin/FrameworkPanel.tsx` · `framework-parity.ts`/`sdi.ts` · `lbi_*`/`sdi_*`/`competency_*`.
- **Assessment Modules** `AssessmentModulesManagement.tsx` · `/api/lbi/admin/custom-modules` · `custom_assessment_modules`.
- **Subscription Packages** `/api/admin/subscription-packages` (CRUD + seed/export/import/stats).
- **Concern Areas & Short Assessments** `superadmin/{ConcernAreasPanel,ShortAssessmentsPanel,ActiveAgeBandsReflection}.tsx` · `/api/concerns/*`, `/api/short-assessments/*`.
- **Competency Question Curation** `routes/competency-questions.ts` + `CompetencyQuestionsPanel.tsx` · `competency_question_templates`. Authenticated `GET /api/competency/questions/select` (requireAuth — callers are logged-in Career Builder users; unauthenticated callers get 401 and the UI falls back to the static `ADAPTIVE_QUESTION_BANK_V2`); manual POST always `status='draft'`.
- **Question Factory** (MX-101X, flag `questionFactory`, OFF byte-identical) `routes/question-factory.ts`(`registerQuestionFactoryRoutes`) + `services/question-factory.ts` + `superadmin/QuestionFactoryPanel.tsx` (nav `question-factory`, probe `/api/admin/question-factory/feature-flag` res.ok). Generates DRAFT-only packs grounded in `onto_competencies` genome with provenance/confidence/quality_review_status; human approval is the ONLY coverage-changing op; coverage dashboard separates honest live (`active AND status='approved'`) from draft pipeline; retire archives (never deletes); AI path inert without `OPENAI_API_KEY`. ⚠️ `competency_question_templates.status` is locked to {draft,approved} by two conflicting CHECK constraints → full lifecycle lives in `quality_review_status`+map.active, NOT `status`. → `.agents/memory/question-factory.md`.
  - **MX-101A Coverage Population** (additive on MX-101X, same flag) `services/question-factory-population.ts` + `routes/question-factory.ts` `/population/*` (7 GET + POST `/run`) + Founder/Population/Quality tabs in `QuestionFactoryPanel.tsx`; scripts `mx101a-population-run.ts`/`mx101a-reports.ts` → `backend/audit/mx-101a/*.md` (founder report = deliverable). Drove the FULL 419-comp genome to 100% DRAFT coverage (~2,514 drafts) with ZERO inflation — THREE separate axes Draft/Approved/Assessment-Ready, human approval still the only coverage-changing op. Role-DNA denom=21 distinct comps. → `.agents/memory/question-factory.md` (MX-101A section).

### CAPADEX ontology data
- **Concerns Master** (~2,489) `routes/capadex-concerns-master.ts` · `CapadexConcernsMasterPanel.tsx`. `display_label` = user copy; `concern_*`/`domain` = join keys.
- **Clarity Questions** (~30,638) `routes/capadex-clarity-questions.ts` · `CapadexClarityQuestionsPanel.tsx`. Join is `clarity.master_bridge_tag = master.relational_bridge_tag` (bucket-level). ⚠️ `concern_id` is DISJOINT from `concerns_master` (0% join); only working bridge is `master_bridge_tag`; inherited age/persona/dev-stage are AMBIGUOUS. → `.agents/memory/{clarity-bridge-tag-classifier,clarity-xlsx-import-quality}.md`.
- **Signal Ontology Hub** (4-tier: 20 domains · 400 families · 20 signals · 15,972 atomic) `routes/capadex-ontology-hub.ts` · `SignalOntologyHubPanel.tsx`. → `.agents/memory/atomic-bridge-general-concern.md`.

### CAPADEX Assessment Flow
- `FreeAssessmentModal.tsx`: intro → analyze → clarify → preview → questions → result → register → OTP → report. Routes `routes/capadex.ts`, `routes/capadex-concern-intelligence.ts`. Tables `capadex_sessions/responses/users/otps/reports/runtime_sessions`.
- **3-tier clarity picker** (`pickQuestionsFromMaster` → `pickQuestionsFromDB` → static) carries `clarity_source` provenance. `resolveCapadexConcern()` keyword fallback → never 404s.
- **Preview ↔ report share ONE visual canon** (`CapadexBridgePhase.tsx` + `CapadexReportPhase.tsx`); tone hopeful/light, header/CTA deep enough for white text.
- Detail → `docs/CAPADEX.md` §18/§20 · `.agents/memory/{capadex-concern-routing-fallback,capadex-clarity-picker-filters,proxy-language-engine,bridge-tag-orphan-remap-leakage,capadex-report-tone-palette}.md`.

### CAPADEX engines (all additive, flag-gated, read-only; detail in docs/CAPADEX.md + memory)
- Runtime spine: signal capture (`routes/signal-capture.ts`) → composites/patterns (Phase 3) → intervention + explainability (Phase 4) → behavior graph aggregator → insight explainer. Tables `capadex_session_*`.
- Investigation/governance: Hypothesis Investigation (0B), Adaptive Questioning (B), Bridge-Tag Coverage (2), Concern→Signal Mapping, Question Registry (5), Phase-6 deepenings, Simulation Harness (0C, **allowed to FAIL**).
- PIL (Problem Intelligence Layer, Phases 1.5–8): capability↔problem↔behaviour↔archetype↔human↔intervention curated layers + recommendation intelligence (7) + knowledge graph (8, `pil_kg_*`). Curated frames with a quality gate that REJECTS weak generic fallbacks.
- Reporting/commercial (gated by `FF_RUNTIME_INTELLIGENCE_ACTIVATION` etc.): Dynamic Report Intelligence (6C, 4 stakeholder reports), WC-3 chain (stage/outcome/journey/longitudinal/personalization), WC-7b decision, WC-7c commercial. ⚠️ Outcome chain depends on `FF_WC3_OUTCOME_CROSSWALK` + a populated behavioural spine — see `audit/launch-readiness/`.
- Supporting: Enterprise Intelligence (`routes/capadex-enterprise.ts`, `postCompletionHooks`), CSI (`routes/csi.ts`), OMEGA-X report intelligence, BIOS Intelligence (`routes/{lbi-engine,behavioural-signals,predictive-intelligence,tenants}.ts`).

### SuperAdmin Reports Console
- `SuperAdminDashboard.tsx` `capadex-reports` → `UnifiedReportsPanel.tsx` (CAPADEX/LBI/SDI/Competency) → `CapadexReportsPanel.tsx`. `STATUS_STEPS=['pending','in_review','approved','published']`; `getLevelFromScore` ≥80/≥60/≥40 bands.
- Email preview (`backend/routes.ts`): `X-Preview-Subject` header MUST be `encodeURIComponent(subject)` (em-dash; ASCII-only headers).
- **Outcome Intelligence** (MX-102X, flag `outcomeIntelligenceActivation`, OFF byte-identical incl. schema) `routes/outcome-intelligence.ts` + `services/outcome-intelligence-engine.ts` + `superadmin/OutcomeIntelligencePanel.tsx` (nav `outcome-intelligence` in Reports, probe `/api/outcome-intelligence/enabled` res.ok). Read-only composer unifying SIX realized-outcome types (hiring/performance/promotion/retention/career/learning) into ONE surface; COMPOSES validation-loop + employer-tig calibration (never recomputes); Coverage ⟂ Confidence kept SEPARATE; abstains < k_min=30; demo excluded; null never 0. Verdict PARTIAL until realized {pred,outcome} pairs ≥ k_min. Deliverables `backend/audit/mx-102x/*.md` (founder report). → `.agents/memory/outcome-intelligence-activation.md`.
- **Career Launchpad Launch Certification** (MX-302J, flag `launchCertification`/`FF_LAUNCH_CERTIFICATION`, OFF byte-identical) capstone for the A→I Launchpad phases. Read-only composer `scripts/mx302j-launch-certification.ts` + 8-report suite in `services/report-pack.ts` (`composeLaunchpadSuite`/`validateLaunchpadSuite`/`buildLaunchpadSnapshot`/`LAUNCHPAD_SUITE_NAMES`; 16-pack `BUILDERS` byte-identical) + route `GET /api/rf/launchpad-suite/:subject` (auth-before-flag: 401 unauth, 503 OFF, `?export=pdf|csv|json`). FOUR axes Structural⟂Activation⟂Adoption⟂Outcome-Confidence NEVER composited; verdict STRUCTURAL-only/PARTIAL (production-ready withheld by design); activation probed via LIVE HTTP `/enabled` not the cert process env; null≠0; demo excluded; UUID subjects masked. Deliverables `backend/audit/mx-302j/*.md` + `certification.json`. → `.agents/memory/mx302j-launch-certification.md`.

---

## Pragati — CAPADEX Behavioural Conversational Runtime
- Backend `routes/pragati.ts`; frontend `PragatiWorkspace.tsx` (3-panel). APIs `POST /session/start`, `/session/:id/respond`, `GET /session/:id/resume`, `/flow-config`, `/ontology` + admin.
- Runtime: 13-state FSM · 8 block types · 12-concern ontology · adaptive density · 4-dim quality score · crisis-escalation + safety middleware · deterministic fallback.

---

## Career Builder
**Page** `CareerBuilderPage.tsx` (monolith). Spec → `docs/CAREER_BUILDER.md`.
- **Foundation**: tokens `design-system/tokens.ts`; shared UI `components/career/`; engines `lib/engines/` (pure); stores `lib/stores/` (Zustand); DB `migrations/20260519_career_builder_schema.sql` (13 tables).
- **Career Operating System** (additive): `useCareerBrain.ts` aggregates profile/resume/competency/BIOS/CAPADEX/market (never throws); pure engines in `lib/intelligence/` surfaced in EXISTING tabs only. Behavioural memory `routes/behavioural-memory.ts` (DB-backed, distinct from in-memory `career-memory.ts`). IDOR guard `resolveEffectiveUserId`. Cross-module sync reuses `services/adaptive-event-bus.ts` (identity-space trap → `.agents/memory/cross-module-event-sync.md`).
- **Employability Passport** (flag `employabilityPassport`) `routes/employability-passport.ts`; snapshot at `career_seeker_profiles.data.passport` JSONB; contact NEVER published. → `docs/EMPLOYABILITY_PASSPORT.md`.
- **CAPADEX → Career bridge** `services/career-behavior-adapter.ts` (pure); adopted ONLY when `session_id` non-null; consumers take optional `behavior?` arg (absent → identical to before). → `.agents/memory/career-behavior-bridge.md`.
- **Competency Assessment** (AssessmentTab) — `selectAssessmentQuestionsFromAPI` → `GET /api/competency/questions/select`, falls back to static `ADAPTIVE_QUESTION_BANK_V2`. Spec `docs/COMPETENCY_ASSESSMENT.md`.
- **Competency framework canonical authority** — the framework IS the `onto_*` genome + `competency_question_templates` (V1 bank) + `competency-runtime(-v2)` scoring (dual ledger: `onto_competency_profiles` runtime / `onto_competency_score_runs` normalized). Legacy `competency_*` tables are EMPTY shells (admin reads fall back to `onto_*`); the many flag-gated `competency_graph_*/propagation/fusion/ucip_*/sci_*` phases are scaffolded-but-unactivated (empty → parkable flag-off). New competency work extends these canonical surfaces — do NOT add parallel namespaces. Full review: `reports/competency_framework_review.md`. Two `question_type` vocabularies coexist by design: rows are STORED in the scorer's canonical keys (`multiple_choice`/`situational_judgment`/`likert`), and `mapQuestionType` (in `routes/competency-questions.ts`) bridges them to the SHORT render tokens (`mcq`/`sjt`/`likert`) — it now accepts BOTH, so canonical rows render correctly. ⚠️ `rowToQuestion` still forces the Likert scale for any option-less row (`!hasAuthoredOptions`), so a `multiple_choice` row with NO authored options renders as Likert regardless of type — that's why the legacy option-less demo stubs still look like Likert.
- **Resume Studio** `components/career/ResumeStudio.tsx` (embedded). **Fitment panel** `FitmentInsightsPanel.tsx` (Jobs tab; Provisional when `sampleSize<30`).

---

## Constraints (do not violate)
- **Tab name canon**: `TabId` union in `CareerBuilderPage.tsx` — use `'jobs'` (not `'tracker'`), `'mentors'` (not `'mentor'`).
- **Preserve existing UI** — Adaptive Intelligence phases are additive new pages, never edits to `CompetencyDashboard.tsx`/`GapAnalysisPage.tsx`/`CareerBuilderPage.tsx` core/`TrajectoryDashboardPage.tsx`.
- **Language policy** — outputs are developmental signals only, NEVER hiring/promotion/suitability predictions; every envelope ships allowed/disallowed term lists.
- **k-anonymity** — peer benchmarks suppressed below `k_min=30`; cohort responses aggregate-only.
- **Append-only history** — `p4_competency_history`, `m3_*` history tables never mutated in place.
- **Feature flags** — every additive V2 phase ships behind a flag; flag-off → 503 + UI hides.
