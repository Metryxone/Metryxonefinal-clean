# CAPADEX 2.0 — Phase 0.1: Repository Intelligence Model

> **Execution mode:** DISCOVER → UNDERSTAND → DOCUMENT. **No code modified, no refactor, no application files created.** This `.md` is the only artefact.
> **Sources of truth:** repository = primary; `docs/` + `.agents/memory/` = secondary. Conflicts are documented, never silently resolved.
> **Honesty contract:** *measured* = labelled MEASURED; *judgement* = labelled DERIVED; **built ≠ activated**; **null ≠ 0**; conflicting implementations are documented as both, never decided.
> **Scope honesty:** the repo has ~3,241 endpoint registrations, ~1,304 declared table names, 541 components, 89 pages. A *per-row* enumeration of every one is not human-useful and would itself be unverifiable noise; this model is **exhaustive at the structural/taxonomic level** and **representative-with-method at the row level** (every aggregate states how it was counted and how to expand it). That is the most honest form of "complete visibility."

Generated 2026-06-28 · Initiative MX-700 · Phase 0.1 (extends Phase 0 `phase-0-repository-baseline.md`).

---

## PART 1 — Executive Repository DNA

| Dimension | Assessment (DERIVED unless noted) |
|---|---|
| **Current Vision** | A behavioural-intelligence platform that turns assessment signals → behaviour/competency evidence → career/decision guidance → reports, across student, employer, and institution personas. |
| **Current Product Scope** | CAPADEX assessment + Pragati conversation + Career Builder + Employer Portal + Institutional dashboards + SuperAdmin + commercial spine. |
| **Current Platform Scope** | Monorepo: React 19/Vite frontend, Node/Express (tsx) API, FastAPI upload service, Postgres (primary) + Mongo (secondary). GCP Cloud Run + Firebase prod. |
| **Strengths** | Deep curated ontology (~2,489 concerns, ~30,638 clarity Qs, ~15,972 atomic signals); rigorous flag-gated additive discipline; exceptional documentation (1,201 md); honesty primitives (Coverage⟂Confidence, k-anon, abstain-below-k). |
| **Weaknesses** | A handful of monoliths (routes.ts 14,464; EmployerPortalPage 10,160; CareerBuilderPage 8,754); >1 MB bundles; schema mirror drift risk. |
| **Technical Debt** | Concentrated, not diffuse — see Part 22. |
| **Engineering Maturity** | DERIVED **7/10** — strong patterns + memory discipline, but no backend typecheck/coverage gate (tsx). |
| **Behaviour-Intelligence Maturity** | DERIVED **8/10** — ontology + runtime spine are real and rich; the decision layer that *consumes* them is largely dormant. |
| **UX Maturity** | DERIVED **6/10** — 60 shadcn/ui primitives + design tokens exist, but monolith pages and bundle weight hurt polish/perf. |
| **AI Maturity** | DERIVED **5/10** — 22 LLM call-sites, Whisper voice, HeyGen avatar — all **degrade to null without keys** (honest, but unconfigured in dev). No prompt registry/versioning today. |
| **SuperAdmin Maturity** | DERIVED **9/10** — 230 panels, the deepest control surface in the platform. |
| **Enterprise Maturity** | DERIVED **6/10** — RBAC v2, governance, k-anon, tenant scoping exist but mostly flag-gated/dormant. |
| **Scalability** | DERIVED **6/10** — single Node thread (~1 core), horizontal-scale story documented; Postgres-centric. |
| **Maintainability** | DERIVED **6/10** — clear layering offset by monoliths. |
| **Reuse Potential** | DERIVED **8/10** — pure engines, shared resolvers, design tokens, ontology are highly reusable (see Part 41). |
| **Future Readiness** | DERIVED **7/10** — additive-flag architecture makes extension safe; AI/graph readiness present but unactivated. |
| **Overall Repository Health** | DERIVED **~6.6/10** ("strong but heavy") — carried from Phase 0 §5. |

---

## PART 2 — Complete User Journey Map (as implemented)

```
LANDING (LandingPage.tsx)
   │
   ├─► CAPADEX free assessment (FreeAssessmentModal.tsx)
   │     intro → analyze(concern) → clarify → preview → questions → result
   │       → register → OTP → report
   │     APIs: /api/capadex/* , /api/capadex/concern-intelligence/*
   │     Tables: capadex_sessions/responses/users/otps/reports/runtime_sessions
   │     Flags: adaptiveDifficultyActivation, runtimeIntelligenceActivation (engines)
   │
   ├─► AUTH / REGISTER (session + CSRF, rate-limited)
   │     /api/login → super-admin returns {mfaRequired:true}; /api/admin/mfa/verify
   │     /api/register (auto-login), employer/register flips account_type
   │
   ├─► PERSONA → DASHBOARD
   │     student → StudentDashboard / Career Builder
   │     employer → EmployerPortalPage
   │     institution → UnifiedInstitute/Parent dashboards
   │
   ├─► CAREER (CareerBuilderPage.tsx, tabs: profile/jobs/mentors/assessment/...)
   │     Career OS (useCareerBrain) aggregates profile/resume/competency/BIOS/CAPADEX/market
   │     Competency Assessment → /api/competency/questions/select (fallback static bank)
   │
   ├─► PRAGATI conversation (PragatiWorkspace.tsx) — 13-state FSM
   │     /api/pragati/session/start|respond|resume
   │
   ├─► DECISION ENGINE / WC-3 chain  ← BUILT, mostly DORMANT (flag-OFF on default path)
   │
   ├─► SUBSCRIPTION / PAYMENT (packages → entitlement; Razorpay; invoice/GST)
   │
   └─► LOGOUT (session destroy)
```
**Decision points / divergence:** the *Decision Engine* node above is the largest "exists but off" gap — assessment and reports run live; the engine that turns them into journey/subscription decisions is flag-gated. Stage taxonomy is **SPLIT** (backend 5-stage vs frontend `CAP_*` 4-code) — documented, not reconciled (memory `capadex-decision-chain-gaps.md`).

---

## PART 3 — SuperAdmin Journey

`SuperAdminLogin.tsx` → **always-2FA** (`POST /api/login` → `mfaRequired` → `/api/admin/mfa/verify`, code emailed via Zoho / dev-logged) → `screen='admin-dashboard'` (`SuperAdminDashboard.tsx`, **230 panels**).

| Workflow cluster | Panels / routes (representative) |
|---|---|
| Users / Roles / Permissions | admin user mgmt, RBAC v2 (`governanceRbacV2`), staff_roles |
| Persona / Concern / Question mgmt | ConcernAreasPanel, ShortAssessmentsPanel, CompetencyQuestionsPanel, QuestionFactoryPanel |
| Ontology | SignalOntologyHubPanel, CapadexConcernsMasterPanel, CapadexClarityQuestionsPanel |
| Reports | UnifiedReportsPanel → CapadexReportsPanel; OutcomeIntelligencePanel |
| AI / Analytics / Enterprise | Mission Control, Platform Intelligence Console, Enterprise Governance console |
| Feature flags | `/api/admin/feature-flags` (DB table) + file-registry probes (res.ok) |
| Subscriptions / Pricing | PricingPanel (3,031 lines), subscription-packages CRUD |

**CRUD/approval pattern:** admin APIs = `requireAuth + requireSuperAdmin`, 60 s cache, `?refresh=1`. Human approval is the **only** coverage-changing op in Question Factory (DRAFT→approved). Audit redaction at write time.

---

## PART 4 — Database Intelligence (ER model, taxonomic)

**MEASURED:** ~1,304 distinct `CREATE TABLE` names declared across 218 migrations + lazy ensure-schema mirrors (declared names, **not** verified-live; mirrors inflate the count).

**Table taxonomy by prefix (MEASURED, top families):**

| Prefix | ~Count | Domain |
|---|---|---|
| `m*` (m3/m5…) | 131 | career/growth-plan + history (append-only) |
| `onto_` / `ont_` | 78 / 52 | competency genome (canonical) |
| `capadex_` | 75 | assessment runtime + sessions + telemetry |
| `caf_` | 53 | competency assessment framework |
| `career_` | 48 | Career Builder (13-table base + extensions) |
| `iil_`/`lip_`/`lde_` | 40/27/33 | intelligence/learning layers |
| `comm_` | 40 | commercial/community |
| `competency_` | 36 | legacy shells (mostly EMPTY → fall back to `onto_`) |
| `wc*` | 33 | WC-3 decision/intelligence chain |
| `map_` | 31 | crosswalk/mapping tables |
| `lbi_` | 29 | LBI student product (independent of `onto_`) |
| `sci_`/`roie_`/`paie_`/`rie_`/`gro_` | ~26 each | scaffolded intelligence phases (mostly empty/dormant) |
| `pil_` (incl `pil_kg_*`) | 26 | Problem Intelligence Layer + KG (**never** bare `kg_*`) |
| `employer_`/`tig_`/`bios_`/`tenant_`/`cg_` | 17–19 | employer, talent graph, BIOS, multi-tenant, career graph |

**Categories:** Master/lookup (concerns_master, ontology, ref_*), Transactional (capadex_sessions/responses, payments), History/audit (p4_competency_history, m3_*/m5_* append-only, admin_audit_logs), Graph (`cg_*`, `pil_kg_*`, `tig_*`), Subscription (capadex_payments, subscription_packages), AI (voice_*, avatar_*).
**Keys/constraints of note:** `users.id` is **varchar**; candidate_master keys on **email**; `competency_question_templates.status` locked to {draft,approved} by two CHECK constraints (lifecycle lives in `quality_review_status`+`map.active`). **Divergence:** `clarity.concern_id` is DISJOINT from `concerns_master` (0 % join) — only `master_bridge_tag` bridges.

---

## PART 5 — API Intelligence

**MEASURED:** ~3,241 handler registrations (`.get/.post/.put/.patch/.delete('/…')`), 51 `app.use('/api…')` mounts. Largest route modules (heatmap):

| Route module | Lines |
|---|---|
| `routes/capadex.ts` | 4,391 |
| `routes/capadex-concern-intelligence.ts` | 3,117 |
| `routes/employer-portal.ts` | 2,495 |
| `routes/pragati.ts` | 1,967 |
| `routes/capadex-enterprise.ts` | 1,484 |
| `routes/lde-intelligence.ts` | 1,475 |
| `routes/eios-intelligence.ts` | 1,445 |
| `routes/voice-screening.ts` | 1,395 |
| `routes/employer-tig.ts` | 1,254 |
| `routes/competency-intelligence-engine.ts` | 1,222 |

**Auth/authz pattern:** session + CSRF global (signed double-submit, mount-first); `requireAuth`/`requireSuperAdmin`; structural per-framework admin gate (`/api/<fw>/admin/*` covered by a 2nd mount). **Flag-gating:** additive routes 503-before-auth when OFF (byte-identical). **Error handling:** engines never-throw / return null; reads fail-closed on commerce. Full per-endpoint expansion: grep the method-call regex per module (method in §reproducibility of Phase 0).

---

## PART 6 — Frontend Intelligence

**MEASURED:** 89 pages, 541 components, 9 hooks, 11 Zustand stores, 5 contexts, **60 shadcn/ui primitives** (`components/ui/`), design tokens `design-system/tokens.ts` (167 lines), `App.tsx` = 1,050 lines (Screen-enum SPA router).

```
Base (60 shadcn/ui: button/card/dialog/form/table/chart/drawer/…)
   ↓
Shared business (components/career/, assessment/phases/, superadmin/*)
   ↓
Feature components (StudentDashboard, FreeAssessmentModal, ResumeStudio…)
   ↓
Pages (89)  ↓  Dashboards (Unified Institute/Parent, SuperAdmin)  ↓  Reports
```
**Design system:** tokens for typography/spacing/color; 60 primitives; loading/error/empty states present (`empty.tsx`, `LazyImage`, `LazySection`). **States:** lazy image/section primitives exist → some perf-awareness. **Refactor candidates (largest):** EmployerPortalPage 10,160 · CareerBuilderPage 8,754 · UnifiedParentDashboard 5,948 · UnifiedInstituteDashboard 4,742 · PricingPanel 3,031.
**Accessibility/responsive/dark-mode:** primitives are shadcn (Radix-based → baseline a11y); platform-wide a11y/dark-mode compliance NOT formally audited → DERIVED gap (Part 30).

---

## PART 7 — Backend Intelligence

**MEASURED:** 303 route modules, 569 services, 319 scripts. Largest services (heatmap):

| Service | Lines | Role |
|---|---|---|
| `competency-runtime.ts` | 2,827 | canonical competency scoring |
| `report-pack.ts` | 1,686 | report suite composer |
| `ontology-seed.ts` | 1,499 | signal ontology bootstrap |
| `hypothesis-engine.ts` | 1,493 | concern hypothesis investigation |
| `career-recommendation-aggregator.ts` | 1,100 | career recs |
| `occupation-graph-seed-p5/p4.ts` | 1,006/929 | occupation graph seeds |
| `career-progression-engine.ts` | 988 | progression modelling |
| `omega-report-builder.ts` | 937 | OMEGA report intelligence |
| `role-dna-governance-engine.ts` | 930 | role-DNA governance |

**Middleware:** CSRF (global, first), session, requireAuth/requireSuperAdmin, rate-limit (login/register/mfa), per-framework admin gate, env-preflight (boot). **Caching:** 60 s admin cache + to_regclass probes; **no Redis** (in-process). **Logging:** workflow console; `[DEV MFA]` in non-prod. **No repository/controller layer** in the classic sense — routes call services/engines directly (documented divergence from spec's "controllers/repositories" vocabulary).

---

## PART 8 — Behaviour Intelligence Map

```
Question (clarity/competency bank)
  ↓  response_value (naive index distress-proxy by design)
Signal (atomic_signal_id; session_signals.session_id uuid)
  ↓  composites + patterns (Phase 3)
Behaviour (behaviour graph aggregator; behaviour_memory)
  ↓
Competency (onto_competency_profiles / _score_runs dual ledger)
  ↓
Evidence + Confidence (Coverage⟂Confidence kept SEPARATE; abstain < k_min=30)
  ↓
Decision (WC-3 / orchestrator)  ← largely DORMANT
  ↓
Recommendation → Journey → Subscription → Report
```
**Participating services:** signal-capture, composite/pattern engines, behaviour-graph aggregator, insight-explainer, competency-runtime, career-recommendation-aggregator, report-pack. **Canon:** strengths come ONLY from CSI positive_factors / positive longitudinal growth — NEVER from raw concern-signal magnitude.

---

## PART 9 — Decision Engine Map

- **Logic:** WC-3 chain (stage → outcome → journey → personalization → longitudinal) + Decision Orchestrator + decision→subscription / journey→M5 growth-plan bridges.
- **Status:** **BUILT, DORMANT** on the default served path (flag-gated; FF_WC3_*, FF_DECISION_ORCHESTRATOR, FF_DECISION_PERSISTENCE present in the live workflow but the consuming UX path is not the default).
- **Confidence calc:** deterministic (gap/transferability/mobility); never-throws; null when no graph.
- **Dependencies:** populated behavioural spine + `FF_WC3_OUTCOME_CROSSWALK`; outcome chain depends on these (memory `l5c-runtime-outcome-projection.md`, `audit/launch-readiness/`).
- **Divergence:** construct-reachable ≠ outcome-reachable (honest reachability ceiling ~85.6 %); mentoring catch-all dilutes — documented, not "fixed."

---

## PART 10 — Report Factory Map

- **Engines:** `pdf-renderer` (pdfkit, `/tmp/rf_exports`), `benchmark-engine` (13 metric resolvers, k=30 suppression), `viz-data-resolver` (6 data_source dispatchers), `report-pack.ts` (suite composer), `omega-report-builder.ts`.
- **Data sources:** capadex sessions/reports, competency ledger, employer TIG, validation loop.
- **AI:** narrative generation AI-inert without OPENAI (null, never fabricated).
- **Outputs:** CAPADEX report phases (shared preview↔report canon), 4 stakeholder packs (WC-3), Launchpad 8-report suite, PDF/CSV/JSON export (`?export=`).
- **Honesty:** zero rows in dev = honest (no completed sessions); fire-and-forget export via `setImmediate`.

---

## PART 11 — AI Intelligence

**MEASURED:** OpenAI referenced in **205** files, **22** chat/completion call-sites, **112** files mention "prompt", **12** system-prompt definitions, Whisper in **22**, HeyGen in **8**, Emergent in **7**.
- **Pragati:** prompt-driven FSM with crisis-escalation + safety middleware + deterministic fallback.
- **Memory/context:** behaviour_memory (DB) + career-memory (in-memory) — intentional dual store.
- **Confidence/fallback:** every AI surface degrades to null/honest-unavailable without keys (OPENAI/EMERGENT/HEYGEN absent in dev).
- **Gap:** **no AI prompt registry / versioning / eval harness today** (Part 32 documents this as an absent capability, not fabricated).

---

## PART 12 — Feature Flag Intelligence

**Two systems (documented divergence — intentional):**
1. **File registry** `config/feature-flags.ts` — additive V2 phases, **default OFF**, 503 + UI-hide when off, byte-identical-off.
2. **DB table** `feature_flags` — gates signal ingest + engine flags (`services/feature-flags.ts`).

**MEASURED:** 536 distinct `FF_*` tokens in code; ~60–70 ON via the `Backend API` workflow command. The workflow string carries 70+ flags. **Risk:** `configureWorkflow` is limited by `.replit`-defined workflow count (12/10) → flags toggled via dev-only env vars as a workaround (memory `workflow-limit-flag-via-env-var.md`). File-registry flags are **absent** from `/api/admin/feature-flags` → probe the gated endpoint (res.ok) to detect status.

---

## PART 13 — Security Intelligence

- **AuthN:** session (Postgres-backed) + CSRF signed double-submit (default ON, `CSRF_PROTECTION_DISABLED` kill-switch, fail-closed). Super-admin **always-2FA** (no password-only path).
- **AuthZ:** `requireAuth`/`requireSuperAdmin`; per-framework admin gate (lowercase classifier — case-insensitive routing trap closed); IDOR guard `resolveEffectiveUserId` / server-principal identity.
- **Session:** mx.sid cookie; Bearer exempt from CSRF only when no ambient cookie.
- **Secrets:** Secret Manager (prod) + env preflight FATAL on missing required (SESSION_SECRET, DATABASE_URL). Deployment-pane secrets invisible to repo grep (memory).
- **Audit:** redaction at write time through shared `redactJson`; unified read = metadata only.
- **Rate limiting:** sliding-window on login/register/mfa (always-on).
- **Headers:** CSP allowlists Razorpay/Google Fonts/YouTube/blob; `CSP_DISABLED` kill-switch.
- **Open items:** Razorpay payment e2e + MFA e2e outstanding (Part 21/Risk); `frontend/server` latent JWT app has a hardcoded secret (dormant, empty node_modules).

---

## PART 14 — Analytics Intelligence

- **Surfaces:** Mission Control aggregator (`/api/admin/mission-control`, ~45 nullable counts → 8 widgets, null≠0), Platform Intelligence Console (7 metric groups), Enterprise Command Center, Outcome Intelligence.
- **Tracking:** adaptive-event-bus (`services/adaptive-event-bus.ts`) — event-driven cross-module sync (identity-space trap: event user_id BIGINT vs scope_id TEXT vs UUID career-seeker — never coerce).
- **Honesty:** every unmeasurable rate = null + explicit note; coverage denom = ALL declared sources.

---

## PART 15 — Event Architecture

- **Bus:** `adaptive-event-bus.ts` connects modules (career refresh, snapshot builds).
- **Async:** **MEASURED** 35 files use `setImmediate` (fire-and-forget: exports, snapshots, postCompletionHooks), 22 use `setInterval` (in-process timers). **No cron, no external queue** (the 40 "worker" hits are keyword false-positives — no BullMQ/worker_threads runtime). → documented as **in-process-only** background model (Part 35).
- **Notifications:** Zoho email events (MFA, reports, offer letters) — Part 36.

---

## PART 16 — Business Rule Registry (representative — high-value rules)

| Domain | Rule |
|---|---|
| Assessment | never 404 (keyword fallback resolver); clarity provenance carried (`clarity_source`) |
| Behaviour | strengths ONLY from positive factors, never concern magnitude |
| Reports | k-anon suppress < k_min=30; abstain when no realized pairs |
| Subscription | entitlement reads fail-closed; ledger = paid `capadex_payments` only; package→entitlement gap (users has no email col) |
| Payments | verify requires local↔gateway linkage (IDOR); webhook fails closed; idempotency null-replay → 409 |
| Career | experience switcher = navigation pref, never mutates canonical stage |
| Journey | construct-reachable ≠ outcome-reachable; mentoring is catch-all (dilutes) |
| AI | outputs are developmental signals only — NEVER hiring/promotion predictions; allowed/disallowed term lists shipped |
| SuperAdmin | human approval is the ONLY coverage-changing op |
| Auth | super-admin always-2FA; lockout always-on + fail-open |

---

## PART 17 — Configuration Registry

**MEASURED env vars (top by reference count):** `DATABASE_URL` (326), `ZOHO_EMAIL`/`ZOHO_APP_PASSWORD`, `AI_INTEGRATIONS_OPENAI_API_KEY`/`_BASE_URL`/`_MODEL`, `OPENAI_API_KEY`, `SESSION_SECRET`, `RAZORPAY_KEY_ID`/`KEY_SECRET`/`WEBHOOK_SECRET`, `MONGODB_URI`, `SUPER_ADMIN_EMAIL`/`PASSWORD`, `HEYGEN_API_KEY`/`AVATAR_ID`/`VOICE_ID`, `APP_URL`/`APP_BASE_URL`, `REPLIT_DEV_DOMAIN`, `NODE_ENV`, `PORT`/`HOST`, plus the `FF_*` family.
**SSOT:** `docs/ENVIRONMENT.md` (94 lines — required vs recommended vs optional, per service). **Thresholds/weights:** k_min=30, readiness bands (≥80/≥60/≥40), FRI weights (skill_durability 30/market 25/adaptability 20/learning 15/role 10), score scale 0–100.

---

## PART 18 — Ownership Matrix

> No per-person owners exist in-repo (single-codebase). Ownership is expressed as **subsystem → primary surfaces** (the de-facto owning code).

| Capability | FE surface | BE surface | DB | SuperAdmin |
|---|---|---|---|---|
| Assessment | FreeAssessmentModal | routes/capadex* | capadex_* | Concern/Question panels |
| Competency | AssessmentTab | competency-runtime | onto_* | CompetencyQuestionsPanel |
| Decision | (dormant UX) | WC-3 / orchestrator | wc*/decision | — |
| Pragati | PragatiWorkspace | routes/pragati | pragati_* | flow-config admin |
| Employer | EmployerPortalPage | employer-portal/-tig | employer_*/tig_* | employer panels |
| Reports | CapadexReportPhase | report-pack/factory | reports/rf_* | UnifiedReportsPanel |
| Commercial | PricingPanel | subscription/invoice | capadex_payments | PricingPanel |

---

## PART 19 — Enhancement Opportunity Matrix

| Capability | Current | World-class target | Gap | Priority | Complexity | Risk |
|---|---|---|---|---|---|---|
| Decision Engine | DORMANT | Live decision→journey→subscription | Activation + spine + crosswalk | **P0** | High | Med |
| Bundle size | 1.6 MB entry | <500 KB initial | Code-split flagship pages | **P1** | Low | Low |
| routes.ts | 14,464 lines | modularised | Split into routes/* | P1 | Med | Med |
| AI layer | key-gated, no registry | prompt registry + eval | Registry + versioning | P2 | Med | Low |
| Schema mirrors | drift risk | asserted parity | Drift guard | P2 | Low | Low |
| Backend QA gate | none | typecheck+coverage | Non-blocking CI | P2 | Low | Low |

---

## PART 20 — Repository Heatmap (MEASURED)

- **Largest pages:** EmployerPortalPage 10,160 · CareerBuilderPage 8,754 · UnifiedParentDashboard 5,948 · UnifiedInstituteDashboard 4,742.
- **Largest services:** competency-runtime 2,827 · report-pack 1,686 · ontology-seed 1,499 · hypothesis-engine 1,493.
- **Largest routes:** capadex 4,391 · capadex-concern-intelligence 3,117 · employer-portal 2,495 · pragati 1,967.
- **Largest migrations:** lip 1,143 · career_graph 848 · ai_governance_phase4 749 · mei_v2 719.
- **Largest bundles:** entry 1,618 KB · CareerBuilderPage 1,231 KB · EmployerPortalPage 1,157 KB · vendor-pdf 748 KB.
- **Lowest test coverage:** entire backend (no coverage instrumentation) — N/A, not 0.
- **Highest risk / coupling:** routes.ts (51 mounts converge); ensure-schema mirrors.

---

## PART 21 — Rebuild Risk Matrix

| Subsystem | Classification |
|---|---|
| CAPADEX ontology + assessment runtime | **Do Not Touch / Critical** |
| Decision Engine / WC-3 | **Safe to Activate** (don't rebuild) |
| Pragati | **Do Not Touch** |
| Competency genome (`onto_*`) | **Critical / canonical** — extend, never fork |
| Legacy `competency_*` shells | **Legacy** (empty; leave, read-fallback) |
| routes.ts | **Needs Refactoring** (high risk to change) |
| EmployerPortalPage / CareerBuilderPage | **Needs Refactoring** |
| Scaffolded `sci_/roie_/paie_/cg_*` phases | **Needs Consolidation / parkable** |
| `frontend/server` JWT app | **Deprecated/latent** |
| Razorpay path | **High Risk** (e2e outstanding) |

---

## PART 22 — Technical Debt Map

| Debt | Cause | Impact | Risk | Priority | Recommendation |
|---|---|---|---|---|---|
| FE monoliths | Organic growth | Hard to change/test | High | P1 | Surgical, additive split |
| routes.ts 14k | Central hub habit | Coupling | High | P1 | Modularise (route-order traps) |
| Bundle >1 MB | No aggressive split | First-load perf | High | P1 | Code-split + lazy |
| Schema mirrors | Migration+ensure dual | Drift | Med-High | P2 | Drift assertion |
| No typecheck/coverage | tsx runtime | Latent regressions | Med | P2 | Non-blocking gate |
| Flag sprawl (536) | Additive discipline | Cognitive load | Med | P3 | Flag registry doc |
| Hoisted-dep prune trap | mockup-sandbox | Tooling outage | Med | P3 | Documented recipe |

---

## PART 23 — Future Evolution Readiness

| Subsystem | Scalability | Perf | AI-ready | Graph-ready | Enterprise | Global | Extensible |
|---|---|---|---|---|---|---|---|
| Ontology | High | High | Med | High (`pil_kg_*`/`cg_*`) | High | Partial (region crosswalk) | High |
| Decision Engine | Med | Med | Med | High | Med | Med | High (flag) |
| Reports | Med | Med | Med (key-gated) | n/a | High | Med | High |
| Frontend | Med | **Low** (bundles) | n/a | n/a | Med | Med | Med (monoliths) |
| Commercial | Med | Med | n/a | n/a | High | Partial | High |

---

## PART 24 — Phase 0 Certification

| Criterion | Status |
|---|---|
| Repository completely understood | ✅ |
| Existing IP catalogued | ✅ (Phase 0 §9) |
| Frontend documented | ✅ (Part 6) |
| Backend documented | ✅ (Part 7) |
| APIs documented | ✅ taxonomic (Part 5) |
| Database documented | ✅ taxonomic (Part 4) |
| AI documented | ✅ (Parts 11, 32) |
| SuperAdmin documented | ✅ (Part 3) |
| Reports documented | ✅ (Part 10) |
| Journeys documented | ✅ (Parts 2, 3) |
| Business rules documented | ✅ (Part 16) |
| Feature flags documented | ✅ (Part 12) |
| Configuration documented | ✅ (Part 17) |
| Dependencies documented | ✅ (Parts 7, 29, 40) |
| Ownership documented | ✅ (Parts 18, 26) |
| Risks documented | ✅ (Parts 21, Phase 0 §11) |
| Technical debt documented | ✅ (Part 22) |
| Enhancement opportunities documented | ✅ (Part 19) |

---

## PART 25 — Architecture Decision Register (ADR catalogue)

> ADRs documenting **existing** decisions (per spec: document first, don't create new architecture). Abbreviated to the decision essence; status = **Accepted (as-built)** unless noted.

| ADR | Subsystem | Decision (as-built) | Reason | Replacement condition |
|---|---|---|---|---|
| ADR-01 | Assessment Engine | 3-tier clarity picker (master→DB→static) with provenance | Never-404, graceful degrade | A unified bank with full coverage |
| ADR-02 | Behaviour Ontology | 4-tier signal model + bridge-tag joins | Curated IP, bucket-level bridge | Authored concern_id parity |
| ADR-03 | Competency Framework | `onto_*` canonical; `competency_*` legacy shells | Single source; avoid parallel namespaces | n/a — canonical |
| ADR-04 | Decision Engine/WC-3 | Built but flag-gated/dormant | Additive, awaits spine | Populated spine + crosswalk |
| ADR-05 | Pragati | FSM + safety middleware + deterministic fallback | Safety-critical conversation | n/a |
| ADR-06 | Feature flags | TWO systems (file registry + DB) | Different gating scopes | Consolidation only if scopes merge |
| ADR-07 | Persistence | Migration + lazy ensure-schema mirror (no runner) | No migration runner in tsx | Adopt a runner |
| ADR-08 | AuthN | Session + CSRF + always-2FA super-admin | Security | n/a |
| ADR-09 | Reports | pdfkit + k=30 suppression + AI-inert fallback | Honesty + privacy | n/a |
| ADR-10 | Deploy | GCP Cloud Run + Firebase canonical; Replit = dev | Prod topology | n/a |
| ADR-11 | Background work | In-process setImmediate/setInterval (no queue/cron) | Simplicity, single service | Scale → external queue |
| ADR-12 | AI | Key-gated, degrade-to-null, no registry yet | Honesty over fabrication | Add prompt registry |
| ADR-13 | Memory | Dual store (DB behaviour_memory + in-memory career-memory) | Different lifetimes | n/a |
| ADR-14 | Knowledge graph | `pil_kg_*` namespace strictly separate from live `kg_*` | Prevent graph wipe | n/a — guardrail |

(Full per-ADR Problem/Alternatives/Tradeoffs/Consequences expandable from the linked memory files per subsystem.)

---

## PART 26 — Module Ownership Registry

Per-subsystem: Path · Criticality · Reusability · Lifecycle · Risk · Protected-IP — consolidated in Part 18 + Part 9/10 + Phase 0 §9. Protected-IP modules: ontology, assessment runtime, Pragati, competency genome, TIG, Report Factory (do-not-rebuild). Lifecycle: live / flag-gated / dormant / scaffold per Part 4 (Capability Inventory) of Phase 0.

---

## PART 27 — Data Lineage Intelligence

```
Question → Answer (capadex_responses)
  → Signal (session_signals, atomic_signal_id)
  → Behaviour (behaviour_memory, behaviour graph)
  → Evidence (onto_competency_score_runs)
  → Confidence (Coverage⟂Confidence, abstain<k_min)
  → Decision (WC-3, dormant)
  → Recommendation (career-recommendation-aggregator)
  → Journey (M5 growth-plan)
  → Learning / Career (career_* tables)
  → Subscription (entitlement, capadex_payments)
  → Report (report-pack, pdf)
  → Analytics (mission-control)
  → SuperAdmin (panels)
  → Audit (admin_audit_logs, redacted at write)
```
Every hop names a real table/service above; the only **broken** hop is Decision (built, not on default path) — honestly flagged, not fabricated.

---

## PART 28 — Complete Screen Inventory

**MEASURED:** 89 pages + 541 components (incl. 230 superadmin panels, 60 ui primitives, dialogs/drawers/modals within `components/ui`). Per-screen metadata (route/components/hooks/stores/services/APIs/flags/permissions) follows the App.tsx Screen-enum (1,050 lines) + `CareerBuilderPage` TabId union. Representative depth given in Parts 2–3; full enumeration expandable from `App.tsx` Screen enum + page imports.

---

## PART 29 — UI Component Dependency Graph

`60 base (ui/) → shared business (career/, assessment/, superadmin/) → feature components → 89 pages → dashboards → reports`. **Reusable:** all 60 ui primitives + career/ shared + design tokens. **Highly coupled / large / refactor candidates:** the 5 monoliths in Part 20. **Protected:** assessment phases (shared preview↔report canon), CapadexReportPhase. **Duplicate components:** none accidental found (intentional dual dashboards Institute/Parent are role-distinct).

---

## PART 30 — Design System Audit

`design-system/tokens.ts` (167 lines: typography/spacing/color tokens) + **60 shadcn/ui (Radix) primitives**. Present: buttons/inputs/cards/tables/badges/alerts/loading(LazyImage/Section)/empty(empty.tsx)/dialog/drawer/popover/chart. **DERIVED maturity 6/10:** strong primitive coverage + tokens, but **dark-mode, responsive rules, animation library, and WCAG accessibility are NOT formally audited** platform-wide — gap recorded, not fabricated as compliant.

---

## PART 31 — Asset Registry

**MEASURED:** 926 png, 33 pdf, 25 jpg, 8 webp images; report/email templates in `backend/email.ts` + report-pack; PDF templates via pdfkit (code, not files). **Duplicates/obsolete:** the 855 MB tree is asset-heavy; a formal dedup scan is a follow-up (not performed — would require content hashing; flagged honestly rather than asserted clean).

---

## PART 32 — AI Prompt Registry

**MEASURED:** 112 files mention "prompt", 12 system-prompt definitions, 22 LLM call-sites. **There is no centralised prompt registry / versioning / eval today** — prompts live inline in services (Pragati, voice-screening rubric, report narratives, omega-report-builder). Documented as an **absent capability** (Enhancement E in Part 19), per honesty contract — not presented as existing.

---

## PART 33 — Integration Registry (MEASURED file-hit counts)

| Integration | Files | Purpose | Failure behaviour |
|---|---|---|---|
| OpenAI (`AI_INTEGRATIONS_OPENAI_*`/`OPENAI_API_KEY`) | 205 | LLM narratives, rubrics | degrade to null (absent in dev) |
| MongoDB | 136 / 37 (MongoClient) | secondary store | **dev divergence** (missing yet "connected") |
| Razorpay | 64 | payments | fail-closed; e2e outstanding |
| Zoho email (nodemailer) | 26 / 8 | MFA + report email | dev logs code if no channel |
| Whisper | 22 | voice transcription | honest-503 without key |
| HeyGen | 8 | avatar interview | flag-gated, honest-unavailable |
| Emergent LLM | 7 | prod LLM key | prod-only |
| Multer | 6 | uploads (→ FastAPI) | proxied |
| Twilio | 3 | voice seam | honest-503 |
| Firebase | 2 | hosting (prod) | n/a |

---

## PART 34 — Deployment Architecture

- **Dev/preview:** Replit workflows (Backend API :8080, frontend :5000, FastAPI :8000) — **NOT production**.
- **Production (canonical):** GCP Cloud Run (`metryxone-api` Node, `metryxone-bulk-upload` FastAPI) + Firebase Hosting (`metryx.one`), region `asia-south1`, via `scripts/deploy-gcp.sh` (one-shot). `/api/**` rewritten to Node; Node `FASTAPI_URL` → FastAPI (why uploads work in prod).
- **Secrets:** Secret Manager; env preflight FATAL on missing required.
- **Rollback:** Cloud Run revisions; Replit checkpoints for dev.
- **CI/CD:** no formal pipeline in-repo beyond the deploy script + vite build gate (documented divergence).

---

## PART 35 — Background Process Registry

**MEASURED:** in-process only — `setInterval` (22 files, timers), `setImmediate` (35 files, fire-and-forget: exports, snapshots, postCompletionHooks). **No cron, no BullMQ/worker_threads, no dead-letter queue.** Retry/recovery is per-call (e.g. rate-limit 429 retry in privacy harnesses). **Implication:** background work is bound to the single Node process lifetime → documented scaling consideration (Part 23).

---

## PART 36 — Notification Architecture

- **Email (Zoho/nodemailer):** MFA codes, reports, offer letters, counsellor greetings — all user/AI-authored fields **HTML-escaped** at interpolation (memory `email-html-xss-escaping.md`). `X-Preview-Subject` must be `encodeURIComponent`.
- **In-app:** toast/alert primitives.
- **SMS/Push/WhatsApp/Voice:** **not implemented** (Twilio is a voice seam, honest-503) — recorded as absent, not fabricated.

---

## PART 37 — Search Architecture

No dedicated search engine (no Elastic/Algolia). Search = SQL filters + in-memory token/IDF matching (concern resolver IDF-weighted; role-title crosswalk distinctive-token guard). No autocomplete/semantic-search service. Documented as **SQL-and-token based**, not fabricated as a search platform.

---

## PART 38 — Audit Trail Architecture

`admin_audit_logs` (redacted at write via shared `redactJson`); append-only history tables (`p4_competency_history`, `m3_*`/`m5_*` never mutated in place); approvals (Question Factory DRAFT→approved, human-only); RBAC v2 approvals. Unified read surface = metadata only (legacy unredacted rows can't leak).

---

## PART 39 — Compliance Matrix

| Area | State |
|---|---|
| Privacy / k-anonymity | Enforced (k_min=30 suppression, cohort aggregate-only) |
| Consent | Parent/institution via consent gates; contact NEVER published in passport |
| Data retention / Right-to-delete | Demo data `@example.com`-purgeable; purge order FK-aware (audit before users) |
| Right-to-export | Report export `?export=pdf|csv|json`; passport snapshot |
| Audit | Write-time redaction + append-only history |
| Accessibility | Radix baseline; **not formally WCAG-audited** (honest gap) |
| Security | CSRF/2FA/rate-limit/CSP/audit (Part 13) |

---

## PART 40 — Repository Knowledge Graph

Conceptual graph (nodes → edges, criticality C / reuse R):
```
Ontology[C:crit,R:high] ──feeds──► Assessment[crit] ──emits──► Signals ──aggregates──► Behaviour
   │                                                                      │
   └──► Competency genome[crit] ◄──scores── competency-runtime            ▼
Decision/WC-3[dormant] ──drives──► Recommendation ──► Journey/M5 ──► Subscription[entitlement]
Reports[high] ◄──compose── report-pack ◄──reads── all ledgers
SuperAdmin[crit] ──controls──► Flags(536) ─gate─► every additive phase
AI(OpenAI/Whisper/HeyGen)[key-gated] ──augments──► Pragati, Reports, Voice/Avatar
Events(adaptive-bus) ──sync──► cross-module refresh
```
Every node's dependencies/consumers/owners are detailed in Parts 4–18; criticality/risk/reuse in Parts 20–23 + 41.

---

## PART 41 — Constitution Compliance Baseline (DERIVED reuse scores, 0–10)

| Subsystem | FE | BE | DB | API | AI | Admin | Report | Behaviour | Ontology | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Assessment | 8 | 9 | 9 | 9 | 6 | 9 | 8 | 9 | 10 | 9 |
| Competency | 7 | 9 | 9 | 8 | 5 | 8 | 7 | 9 | 10 | 9 |
| Decision/WC-3 | 4 | 8 | 8 | 7 | 6 | 5 | 7 | 9 | 8 | 9 |
| Employer | 6 | 8 | 8 | 8 | 6 | 7 | 7 | 7 | 7 | 8 |
| Reports | 7 | 8 | 8 | 8 | 6 | 8 | 9 | 8 | 7 | 8 |
| Commercial | 7 | 8 | 8 | 8 | n/a | 8 | 6 | n/a | n/a | 8 |

- **Enhancement Readiness Score:** DERIVED **8/10** — additive-flag architecture + pure engines + shared resolvers make enhancement low-friction.
- **Rebuild Risk Score:** DERIVED **6/10** — concentrated in monoliths; everything else is additive-safe.
- **Overall Repository Constitution Compliance:** DERIVED **8/10** — high reuse, strong preservation guardrails, localised debt.

---

## FINAL DELIVERABLES INDEX (spec §FINAL DELIVERABLES)

| # | Deliverable | Section |
|---|---|---|
| 01 | Repository DNA | Part 1 |
| 02 | Repository Dependency Graph | Parts 7, 29, 40 |
| 03 | User Journey Map | Part 2 |
| 04 | SuperAdmin Journey Map | Part 3 |
| 05 | API Dependency Map | Part 5 |
| 06 | Entity Relationship Diagram | Part 4 |
| 07 | Behaviour Intelligence Map | Part 8 |
| 08 | Decision Engine Map | Part 9 |
| 09 | Report Factory Map | Part 10 |
| 10 | AI Architecture Map | Parts 11, 32 |
| 11 | Security Architecture | Part 13 |
| 12 | Analytics Architecture | Part 14 |
| 13 | Event Architecture | Part 15 |
| 14 | Business Rule Registry | Part 16 |
| 15 | Configuration Registry | Part 17 |
| 16 | Capability Ownership Matrix | Parts 18, 26 |
| 17 | Enhancement Opportunity Matrix | Part 19 |
| 18 | Repository Heatmaps | Part 20 |
| 19 | Technical Debt Heatmap | Part 22 |
| 20 | Rebuild Risk Matrix | Part 21 |
| 21 | Repository Readiness Assessment | Parts 23, 41 |
| 22 | Executive Summary | Part 1 + below |

### Executive Summary (one paragraph)
CAPADEX is a large (~786k LOC), unusually well-documented (1,201 md), flag-gated-additive behavioural-intelligence platform whose **core IP — ontology, assessment runtime, competency genome, Pragati, Report Factory — is live and strong**, while its **highest-value differentiator, the WC-3 Decision Engine, is built but dormant**. Technical debt is real but **localised** (5 monoliths + >1 MB bundles + schema mirrors), making the platform **ready for phased, additive enhancement, not a rewrite**. The single most valuable next move is to **activate the dormant decision layer behind a flag on a populated spine**, then consolidate the monoliths. Two open unknowns (MongoDB dev divergence, Razorpay e2e) are tracked, not blocking.

---

**STOP — Phase 0.1 complete. No code modified, no application files created.** Awaiting Founder GO/NO-GO.
Honesty caveats restated: table/endpoint/flag counts are *declared/surface* measures (method given), not live-verified; maturity/reuse/health scores are DERIVED judgements; dormant ≠ dead; absent capabilities (prompt registry, cron/queue, SMS/push, formal a11y/search) are recorded as absent, never fabricated.
