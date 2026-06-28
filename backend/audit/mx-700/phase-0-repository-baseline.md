# CAPADEX 2.0 — Phase 0: Repository Protection & Baseline

> **Execution mode:** Enhancement-only · DISCOVER → UNDERSTAND → PRESERVE.
> **No code was changed, no files refactored, no application files created.** This document is the sole deliverable.
> **Sources of truth:** (1) the repository (primary), (2) the architecture docs in `docs/` + `.agents/memory/` (secondary). Where they diverge, the divergence is reported, not silently reconciled.
> **Honesty contract (carried from MX-700):** *measured* numbers are labelled as such; *derived/judgement* scores are labelled as such; **built ≠ activated**; **null ≠ 0**. Nothing is inflated to look more finished than it is.

Generated: 2026-06-28 · Initiative MX-700 (CAPADEX Product Re-Architecture) · Phase 0.

---

## 0. How to read this document

Phase 0 is a **baseline**, not a plan. Its job is to prove the repository was searched end-to-end, to catalogue what already exists (so nothing gets rebuilt by accident), and to establish hard numbers that every later phase is measured against. The 12 required deliverables are in §3–§14; the measured baseline is in §1–§2.

Companion deliverables already produced under this initiative (not duplicated here, referenced):
- `phase-1-current-state-discovery.md` — narrative current-state discovery.
- `phase-2-business-model-audit.md` — commercial/business-model audit.
- `phase-3-global-research-benchmarking.md` — external benchmarking (Eightfold/Gloat/Fuel50, SFIA/ESCO/O*NET, IRT/CAT, etc.).
- `capadex-end-to-end.md` — 20-section end-to-end system walkthrough.
- `docs/CAPADEX.md` — consolidated CAPADEX SSOT (do not overwrite).

---

## 1. Repository Baseline (MEASURED)

All figures below are measured from the **git-tracked** working tree on 2026-06-28 (`node_modules`/`.git` excluded). Counts are reproducible from the commands in §15.

### 1.1 Repository scale

| Metric | Value | How measured | Caveat |
|---|---|---|---|
| Tracked files | **5,413** | `git ls-files \| wc -l` | tracked only |
| Working-tree size | **855 MB** | `du -sh` (excl. node_modules/.git) | includes 926 png + 33 pdf + 127 csv + 8 xlsx assets |
| Code LOC — frontend | **~375,000** | `wc -l` over tracked ts/tsx/js/jsx | raw lines, not SLOC |
| Code LOC — backend (Node) | **~407,280** | same | raw lines |
| Code LOC — backend-main (FastAPI) | **~1,501** | same (py) | thin upload service |
| Code LOC — scripts | **~2,982** | same | audit/seed/e2e scripts (top-level) |
| **Total app code (approx)** | **~786k lines** | sum of above | excludes md/sql/json |

### 1.2 File-type distribution (top of tree)

| Ext | Count | Meaning |
|---|---|---|
| `.ts` | 1,565 | backend + shared logic |
| `.md` | 1,201 | docs + audit deliverables + memory |
| `.png` | 926 | UI/report assets |
| `.tsx` | 707 | React components/pages |
| `.txt` | 266 | specs / pasted assets |
| `.sql` | 237 | migrations + seed data |
| `.json` | 169 | config / fixtures |
| `.csv` | 127 | ontology / seed data |
| `.py` | 38 | FastAPI upload service |
| `.mjs` | 34 | build/codegen scripts |

**Observation (divergence-worthy):** `.md` (1,201) nearly equals `.ts` (1,565). A very large share of the repository is **documentation + audit artefacts**, not code. This is consistent with the MX-700 "read-only deliverable" discipline but means repo-size metrics overstate the *code* surface.

### 1.3 Frontend baseline (MEASURED)

| Metric | Value |
|---|---|
| Pages (`src/pages/*.tsx`) | **89** |
| Components (`src/components/**`) | **541** |
| SuperAdmin panels (`components/superadmin/*`) | **230** |
| Admin panels (`components/admin/*`) | **8** |
| Hooks (`src/hooks/*`) | **9** |
| Zustand stores (`src/lib/stores/*`) | **11** |
| Contexts | **5** |

**Largest frontend files (monoliths — refactor-risk surface):**

| File | Lines |
|---|---|
| `pages/EmployerPortalPage.tsx` | 10,160 |
| `pages/CareerBuilderPage.tsx` | 8,754 |
| `components/UnifiedParentDashboard.tsx` | 5,948 |
| `components/UnifiedInstituteDashboard.tsx` | 4,742 |
| `components/LandingPage.tsx` | 3,347 |
| `hooks/useAdminDashboardState.tsx` | 3,285 |
| `components/assessment/phases/CapadexReportPhase.tsx` | 3,230 |
| `components/FreeAssessmentModal.tsx` | 3,169 |
| `components/superadmin/PricingPanel.tsx` | 3,031 |
| `components/StudentDashboard.tsx` | 3,003 |

### 1.4 Backend baseline (MEASURED)

| Metric | Value | Caveat |
|---|---|---|
| Route files (`routes/*`) | **303** | |
| Service files (`services/*`) | **569** | |
| Scripts (`scripts/*`) | **319** | audit/seed/e2e |
| Migration files (`migrations/*`) | **218** | + lazy `ensure*Schema()` mirrors (no migration runner) |
| Endpoint handler registrations | **~3,241** | `.get/.post/.put/.patch/.delete('/...')` occurrences; includes sub-routers + some duplicates → **surface estimate, not a deduped API count** |
| `app.use('/api…')` mounts | **51** | top-level router mounts |
| `routes.ts` size | **14,464 lines** | the single largest backend file / main route hub |
| Distinct `CREATE TABLE` names | **~1,304** | declared across migrations **and** ensure-schema; **includes mirrors/re-declares → declared names, NOT verified live tables** |
| Distinct `FF_*` flag tokens referenced | **536** | tokens in code; **live ON set is ~60–70** via the `Backend API` workflow env; file-registry defaults OFF |

### 1.5 Build / bundle baseline (MEASURED — from the production `build` workflow)

| Artefact | Size (min) | gzip |
|---|---|---|
| `index-*.js` (entry) | 1,618 kB | 425 kB |
| `CareerBuilderPage` | 1,231 kB | 285 kB |
| `EmployerPortalPage` | 1,157 kB | 303 kB |
| `vendor-pdf` | 748 kB | 225 kB |
| `UnifiedParentDashboard` | 461 kB | 102 kB |
| `vendor-charts` | 447 kB | 126 kB |
| `SuperAdminDashboard` | 425 kB | 99 kB |
| Build total | 4,841 modules, ✓ built in ~36s | — |

Vite emits an explicit warning: **multiple chunks > 1,500 kB**. The entry bundle and the two flagship pages are individually >1 MB minified. This is the headline frontend-performance debt (see §4, §6, §9).

### 1.6 Data stores

- **PostgreSQL** (primary, Drizzle ORM, `DATABASE_URL`) — the ~1,304 declared table names live here; most newer tables use a migration **and** a lazy `ensure*Schema()` mirror (per global conventions).
- **MongoDB** (`MONGODB_URI`) — connects at boot; **currently missing in this dev env** (workflow logs: *"MONGODB_URI missing … continuing because MONGO_REQUIRED=false"*) yet logs also show *"MongoDB connected successfully"* → **divergence to confirm** (a fallback/secondary URI may be in play). Flagged in §9 Risk Register.

---

## 2. Environment, frameworks & tooling (IDENTIFIED)

| Concern | Finding |
|---|---|
| Frontend framework | React 19 + Vite 7 (port 5000) |
| Backend framework | Node.js + Express, run via **`tsx`** (port 8080) — **no compile/typecheck gate in prod** (per memory `build-and-deploy-tooling.md`) |
| Secondary backend | FastAPI (Uvicorn, port 8000) — bulk-upload service (`backend-main/`) |
| Database | PostgreSQL via Drizzle; MongoDB secondary |
| ORM | Drizzle (`backend/shared/schema.ts`, symlinked) + raw SQL in ensure-schema |
| AuthN/AuthZ | Session (Postgres-backed `express_sessions`) + CSRF (signed double-submit, default ON) + `requireAuth`/`requireSuperAdmin`; super-admin 2FA always-on |
| Hosting / deploy | **Production = GCP Cloud Run + Firebase** via `scripts/deploy-gcp.sh` (canonical). Replit autoscale = dev/preview only |
| Env / secrets | `docs/ENVIRONMENT.md` is SSOT; boot-time preflight (`lib/env-preflight.ts`) fails fast in prod on missing required vars |
| Feature flags | **Two systems**: file registry `config/feature-flags.ts` (additive V2 phases, default OFF) **and** DB table `feature_flags` (signal/engine gates) |
| AI services | OpenAI (`OPENAI_API_KEY`) — currently **absent** in dev → AI paths degrade honestly (null, never fabricated); Emergent LLM key in prod |
| Build tools | Vite, esbuild, tsx, custom mjs scripts |
| Testing | **Ad-hoc tsx harness suites** (privacy e2e, cross-org isolation, degradation) registered as validation steps — **no coverage-instrumented test runner** (see §3 test coverage = N/A) |
| Package manager | npm (frontend has hoisted mockup-sandbox devDeps — prune trap, see §9) |

---

## 3. DELIVERABLE 1 — Repository Architecture Map

```
MetryxOne / CAPADEX  (monorepo, shared Postgres + Mongo)
│
├── frontend/                 React 19 + Vite 7  (:5000)
│   ├── src/pages/            89 route-level pages
│   ├── src/components/       541 components
│   │   ├── superadmin/       230 admin panels  ← largest control surface
│   │   ├── admin/            8 panels
│   │   ├── assessment/       CAPADEX flow phases (intro→…→report)
│   │   └── career/           shared Career Builder UI
│   ├── src/lib/  (engines, intelligence, stores[11])
│   ├── src/hooks/[9]  src/context[5]
│   └── artifacts/mockup-sandbox/   canvas component-preview (NOT app runtime)
│
├── backend/                  Node + Express via tsx  (:8080)
│   ├── routes.ts             14,464-line main hub
│   ├── routes/               303 route modules
│   ├── services/             569 service modules
│   ├── migrations/           218 SQL files  (+ lazy ensure*Schema mirrors)
│   ├── scripts/              319 audit/seed/e2e scripts
│   ├── config/feature-flags.ts   file-registry flags (default OFF)
│   ├── shared/schema.ts      Drizzle schema (symlinked → /shared)
│   └── audit/mx-700/         ← this initiative's deliverables
│
├── backend-main/             FastAPI upload service  (:8000, ~1.5k LOC)
│
├── shared/                   symlink target for backend/shared
├── docs/                     consolidated SSOT docs (CAPADEX.md etc.)
├── .agents/memory/           durable engineering lessons (read before edits)
└── migrations/ scripts/ reports/ audit/ exports/   top-level support
```

**Dependency flow (Frontend → Backend → DB → AI → Reports → Admin):**

```
React pages/panels
   │  fetch /api/* (CSRF + session)
   ▼
Express (routes.ts + 303 route modules, 51 /api mounts)
   │  → services/ (569)  → engines (pure, read-only, never-throws)
   ▼
PostgreSQL (primary) + MongoDB (secondary)   ← ontology, sessions, ledgers
   │
   ├─► AI layer: OpenAI / Emergent LLM (degrades to null when unconfigured)
   │
   ├─► Reports: Report Factory (pdfkit), CAPADEX report phases, stakeholder packs
   │
   └─► SuperAdmin: 230 panels reading admin APIs (60s cache, ?refresh=1)
```

---

## 4. DELIVERABLE 2 — Capability Inventory

> Status legend: **LIVE** = on the default served path · **FLAG-GATED (ON)** = activated via workflow env · **DORMANT** = built but flag-OFF / unactivated · **SCAFFOLD** = tables/code exist, empty/parkable.

### 4.1 Assessment & CAPADEX runtime
| Capability | Status | Pointer |
|---|---|---|
| CAPADEX assessment flow (intro→analyze→clarify→preview→questions→result→register→OTP→report) | **LIVE** | `FreeAssessmentModal.tsx`, `routes/capadex*.ts` |
| Concern → Clarity → Score → Report pipeline | **LIVE** | concerns_master (~2,489), clarity_questions (~30,638) |
| 3-tier clarity picker (master→DB→static) w/ provenance | **LIVE** | `pickQuestionsFromMaster` chain |
| Adaptive questioning (Phase B) | **FLAG-GATED** | `/adaptive-next` |
| Adaptive difficulty activation (MX-100X) | **FLAG-GATED (ON)** | served bank ~100% medium → honest ceiling |
| Signal ontology (4-tier: 20 domains·400 families·20 signals·~15,972 atomic) | **LIVE (data)** | `routes/capadex-ontology-hub.ts` |
| Question Factory (draft generation) + MX-101A coverage | **FLAG-GATED** | DRAFT-only, human approval = only coverage-changing op |

### 4.2 Decision / Intelligence engines
| Capability | Status | Pointer |
|---|---|---|
| **Decision Engine / WC-3 chain (stage/outcome/journey/personalization/longitudinal)** | **DORMANT (built, flag-OFF on default path)** | `capadex-end-to-end.md` §10 |
| Decision Orchestrator + journey→M5 + decision→subscription bridges | **DORMANT/PARTIAL** | `capadex-decision-orchestration.md` |
| PIL (Problem Intelligence Layer, phases 1.5–8) incl. `pil_kg_*` graph | **FLAG-GATED / curated** | quality gate rejects generic fallbacks |
| Runtime intelligence spine (signal capture→composites→intervention→explainer) | **FLAG-GATED (ON)** | `routes/signal-capture.ts` |
| Competency runtime (dual ledger `onto_competency_profiles`/`_score_runs`) | **LIVE (canonical)** | legacy `competency_*` = EMPTY shells |
| Career Graph Intelligence (16 `cg_*` tables, 5 engines) | **FLAG-GATED** | `cgi-architecture.md` |
| Future Readiness Platform (10 `frp_*`, 5-signal FRI) | **FLAG-GATED** | `frp-platform.md` |
| EIOS 28-pillar architecture | **FLAG-GATED** | `eios-architecture.md` |

### 4.3 Conversational / AI
| Capability | Status | Pointer |
|---|---|---|
| Pragati conversational runtime (13-state FSM, 8 block types, crisis-escalation) | **LIVE** | `routes/pragati.ts`, `PragatiWorkspace.tsx` |
| Voice screening (MediaRecorder→Whisper→LLM rubric) | **FLAG-GATED** | degrades to null without OPENAI |
| Live conversational avatar interview (HeyGen + LLM) | **FLAG-GATED** | own tables, 503-before-auth OFF |
| AI report narratives / OMEGA-X | **FLAG-GATED** | AI-inert without key |

### 4.4 Career / Employer / Institution products
| Capability | Status | Pointer |
|---|---|---|
| Career Builder (monolith, Career OS, Employability Passport, Resume Studio, Fitment) | **LIVE + additive flags** | `CareerBuilderPage.tsx` |
| Employer Portal (7 `employer_*` tables, TIG graph, calibration) | **LIVE + flags** | `EmployerPortalPage.tsx` |
| Talent matching / role-DNA crosswalk | **FLAG-GATED** | `role-title-crosswalk.md` |
| Institutional intelligence (Univ/Faculty/Placement/Parent k-anon) | **FLAG-GATED** | `institutional-intelligence-mx302h.md` |
| Campus placement & company explorer | **FLAG-GATED** | `campus-placement-explorer.md` |
| Ecosystem / community / forum | **FLAG-GATED** | `ecosystem-community-mx302i.md` |
| Career Launchpad (A→I phases) + Launch Certification (MX-302J) | **FLAG-GATED** | capstone read-only composer |

### 4.5 Commercial & governance
| Capability | Status | Pointer |
|---|---|---|
| Subscription packages / pricing / entitlement enforcement | **FLAG-GATED (ON)** | ledger = `capadex_payments` (paid only) |
| Invoice & GST engine | **FLAG-GATED** | refund docs abstain if no refunded payment |
| Razorpay payments (verify/webhook/idempotency) | **PARTIAL — smoke outstanding** | `commercial-spine-razorpay-security.md` |
| RBAC v2 / approvals / audit trail / Enterprise Governance console | **FLAG-GATED** | redaction at write time |
| Report Factory (pdfkit, benchmark engine, viz resolvers) | **LIVE (engine)** | zero rows in dev = honest |
| SuperAdmin (230 panels: frameworks, ontology, questions, reports, users, flags, analytics) | **LIVE** | `SuperAdminDashboard.tsx` |

---

## 5. DELIVERABLE 3 — Repository Health Score (DERIVED — judgement, not a measured fact)

> This is a composite judgement built from the measured baseline + known memory lessons. Sub-axes are reported separately so the headline can't hide a weak axis (honesty-over-optimism).

| Axis | Score /10 | Basis |
|---|---|---|
| **Functional breadth** | 9 | Enormous, real capability surface (786k LOC, 89 pages, 569 services) |
| **Structural integrity** | 6 | Clear layering, but 14k-line `routes.ts` + 10k/8k-line page monoliths concentrate risk |
| **Activation honesty** | 8 | Flag discipline is rigorous; built≠activated is enforced; dormant code clearly fenced |
| **Test safety net** | 5 | Strong targeted e2e harnesses (privacy/isolation/degradation) but **no coverage instrumentation**; backend never typechecked in prod |
| **Performance** | 4 | Multiple >1 MB bundles; entry 1.6 MB; flagship pages >1 MB each |
| **Data-model clarity** | 5 | ~1,304 declared table names with ensure-schema mirrors → drift risk; known name-collision traps (`pil_kg_*` vs `kg_*`) |
| **Documentation** | 9 | 1,201 md files, consolidated SSOT docs, durable memory per subsystem |
| **Operational/deploy** | 7 | Canonical GCP path documented; env preflight fails fast; Mongo dev divergence open |

**Composite Health: ~6.6 / 10 ("strong but heavy").** The platform is functionally rich and unusually well-documented, but carries monolith, bundle-size, and schema-drift weight that must be managed before aggressive enhancement.

---

## 6. DELIVERABLE 4 — Technical Debt Score (DERIVED)

| Debt category | Severity | Evidence (measured/known) |
|---|---|---|
| **Frontend monoliths** | HIGH | `EmployerPortalPage` 10,160 · `CareerBuilderPage` 8,754 · 5 files >3k lines |
| **Backend route hub** | HIGH | `routes.ts` = 14,464 lines, 51 mounts converge |
| **Bundle size** | HIGH | entry 1.6 MB; 2 pages >1 MB; Vite warns >1.5 MB chunks |
| **Schema mirror drift** | MED-HIGH | migration + lazy ensure-schema duplication across ~1,304 declared names; documented collision traps |
| **No typecheck/coverage gate** | MEDIUM | backend on tsx (no tsc), no coverage runner; only the frontend vite build + ad-hoc harnesses gate |
| **Flag sprawl** | MEDIUM | 536 `FF_*` tokens; only ~60–70 ON; workflow command carries a 70+ flag string |
| **Dependency prune trap** | MEDIUM | mockup-sandbox hoisted devDeps pruned by any `frontend/` npm install (already hit this session) |
| **Two-system feature flags** | LOW-MED | file registry vs DB `feature_flags` — easy to confuse which gates what |
| **Asset weight in repo** | LOW | 926 png + pdf/csv/xlsx inflate the 855 MB tree |

**Composite Technical-Debt: ~6 / 10 (moderate-high, concentrated).** Debt is **localised** (a handful of monoliths + bundles + schema mirrors), not diffuse — which is good news: it's addressable with surgical, additive refactors rather than a rewrite.

---

## 7. DELIVERABLE 5 — Duplicate Capability Report

> "Duplicate" here = two implementations of the *same* capability. Reported honestly; several apparent duplicates are **intentional** by design and must NOT be merged.

| Apparent duplicate | Verdict | Note |
|---|---|---|
| `competency_*` legacy tables vs `onto_*` genome | **NOT a duplicate to merge** | legacy = EMPTY shells; admin reads fall back to `onto_*`. Canonical authority is `onto_*`. Do not add parallel namespaces. |
| `career-memory.ts` (in-memory) vs `routes/behavioural-memory.ts` (DB) | **Intentional dual-store** | distinct lifetimes by design (`cross-module-event-sync.md`) |
| File-registry flags vs DB `feature_flags` | **Intentional two systems** | gate different things; documented in replit.md |
| LBI (`lbi_*`) vs Competency (`onto_*`) | **Intentional separation** | two independent products; never bridge `lbi_→onto_competencies` |
| Two `question_type` vocabularies (canonical scorer keys vs short render tokens) | **Intentional, bridged** | `mapQuestionType` translates; do not collapse |
| `pil_kg_*` vs bare `kg_*` | **NOT duplicate — DANGER** | bare `kg_*` is the live Employability graph; PIL must never materialise against it |
| Archived mirror `client-main-emergent-workzip/` | **RESOLVED** | no longer exists (was a full git-tracked duplicate) |
| WC-3 / Decision Engine / Concern Engine / Question Engine | **SINGLE canonical each** | spec's "do not replace" list — all confirmed single-source |

**Conclusion:** no accidental capability duplication requiring consolidation was found. The risks are the *intentional* parallels above being mistaken for duplicates and wrongly merged. **Phase 0 recommendation: treat every item in this table as PRESERVE, not consolidate.**

---

## 8. DELIVERABLE 6 — Unused / Dormant Code Report

> Distinguish **DORMANT** (built, flag-OFF, intended to activate later) from truly **UNUSED** (no path, no plan). Per honesty contract, dormant ≠ dead.

**Dormant-by-design (flag-OFF, byte-identical when off):**
- WC-3 decision chain + Decision Orchestrator + decision→subscription bridge.
- Career Graph Intelligence (`cg_*`), Future Readiness (`frp_*`), EIOS 28-pillar, many `competency_graph_*/propagation/fusion/ucip_*/sci_*` phases (scaffolded, empty, parkable).
- Question Factory, Outcome Intelligence (MX-102X), Launch Certification (MX-302J), Enterprise Certification (MX-105X), Global Intelligence (MX-76X).

**Truly unused / latent (no active runtime path):**
- `frontend/server` latent JWT Express app (dormant, empty node_modules; identity hardening already applied) — `frontend-server-latent-jwt-auth.md`.
- Scaffold tables with zero rows in dev (honest-empty, not dead): many `*_graph_*`, certification ledgers.

**Flag tokens:** 536 `FF_*` referenced; ~60–70 ON. The gap (≈470) is dormant/scaffold gating, **not** dead flags — each fences an additive phase.

**Recommendation:** do NOT delete dormant code in any near phase (spec rule: never delete). Track it in a dormant-capability register and activate via the DISCOVER→ACTIVATE path.

---

## 9. DELIVERABLE 7 — Existing IP Inventory (the assets worth preserving)

The crown-jewel intellectual property already in the repo (this is what re-architecture must *amplify*, never rebuild):

1. **CAPADEX behavioural ontology** — 4-tier signal model (20 domains · 400 families · 20 signals · ~15,972 atomic), ~2,489 concerns_master, ~30,638 clarity_questions. Years of curation.
2. **Concern→Clarity→Signal→Score→Report runtime** — the live, working assessment spine with provenance tracking and never-404 fallback.
3. **WC-3 decision/intelligence chain** — full stage/outcome/journey/personalization/longitudinal engine set (dormant but built).
4. **Pragati conversational runtime** — 13-state FSM with crisis-escalation + safety middleware.
5. **Competency genome (`onto_*`)** — canonical framework + dual-ledger runtime scoring.
6. **Employer Talent Intelligence Graph** — `tig_*` 9 entity types + calibration (Brier/ECE, write-once snapshots).
7. **Report Factory** — pdfkit renderer + 13 metric resolvers + k=30 suppression.
8. **Commercial spine** — packages/entitlement/invoice-GST/Razorpay with fail-closed honesty.
9. **Governance** — RBAC v2, write-time audit redaction, k-anonymity (k_min=30) enforced platform-wide.
10. **The honesty discipline itself** — Coverage⟂Confidence separation, null≠0, abstain-below-k, demo exclusion. This is a differentiator vs the benchmarked competitors (Phase 3).

---

## 10. DELIVERABLE 8 — Enhancement Opportunities (no implementation — candidates only)

> Ordered by leverage. Each is **additive/flag-gated** per platform convention. None proposed for this phase — Phase 0 stops at identification.

| # | Opportunity | Leverage | Risk |
|---|---|---|---|
| E1 | **Activate the dormant WC-3 Decision Engine** on a flagged path — the single biggest "built but off" value pool | Very high | Med (needs populated behavioural spine + outcome crosswalk) |
| E2 | **Bundle/code-split the >1 MB pages** (`EmployerPortalPage`, `CareerBuilderPage`, entry) | High (perf, UX) | Low (mechanical, additive) |
| E3 | **Decompose `routes.ts`** (14k lines) into the existing `routes/` module pattern | High (maintainability) | Med (route-order traps) |
| E4 | **Schema-drift guard** — assert ensure-schema mirrors == migrations | Med-High | Low |
| E5 | **Coverage/typecheck CI gate** for backend (even non-blocking) | Med | Low |
| E6 | **Unify the AI-degradation envelope** so every AI surface reports source/confidence identically | Med | Low |
| E7 | **Dormant-capability register + activation runbook** | Med | Low |

---

## 11. DELIVERABLE 9 — Risk Register

| ID | Risk | Likelihood | Impact | Mitigation (future) |
|---|---|---|---|---|
| R1 | Accidentally merging an **intentional parallel** (§7) thinking it's a duplicate | Med | High (data loss / product collapse) | Treat §7 table as PRESERVE; require evidence before any merge |
| R2 | `pil_kg_*` vs `kg_*` collision wipes the live Employability graph | Low | Critical | Namespace guard already documented; never materialise PIL against bare `kg_*` |
| R3 | `frontend/` npm install **prunes hoisted mockup-sandbox deps** (hit this session) | High | Low-Med (canvas tooling down) | Bulk `--no-save` reinstall recipe (memory) |
| R4 | **MongoDB dev divergence** (missing URI yet "connected") | Med | Med | Confirm actual Mongo source; document in ENVIRONMENT.md |
| R5 | Schema mirror drift between migration & ensure-schema | Med | Med-High | Add drift assertion (E4) |
| R6 | Backend ships untypechecked (tsx) → type regressions reach prod | Med | Med | Non-blocking tsc gate (E5) |
| R7 | Bundle >1.5 MB chunks degrade first-load, esp. mobile | High | Med | Code-split (E2) |
| R8 | Razorpay payment path **smoke/e2e outstanding** before launch | Med | High (revenue) | Complete the documented Razorpay + MFA e2e gate |
| R9 | Flag-string in workflow command (70+ flags) is fragile/uneditable past limits | Med | Med | Env-var flag path already used as workaround (memory) |
| R10 | Refactoring a 10–14k-line monolith introduces regressions | Med | High | Surgical, test-fenced, additive only |

---

## 12. DELIVERABLE 10 — Recommended Enhancement Order

Following the spec's transformation principle (DISCOVER→UNDERSTAND→**PRESERVE→ACTIVATE→CONSOLIDATE→ENHANCE→EXTEND**→new):

1. **PRESERVE** — ratify §7 (intentional parallels) + §9 (IP inventory) as protected. Add schema-drift + dormant registers (E4, E7). *No behaviour change.*
2. **ACTIVATE** — bring the highest-value dormant asset online behind a flag: **WC-3 Decision Engine** (E1), gated, byte-identical OFF, on a populated spine.
3. **CONSOLIDATE** — only *after* activation proves the path: decompose `routes.ts` (E3) and code-split the flagship pages (E2). Mechanical, test-fenced.
4. **ENHANCE** — unify AI-degradation envelope (E6); add backend typecheck/coverage gate (E5); finish Razorpay e2e (R8).
5. **EXTEND** — only then consider genuinely new capability, grounded in the Phase 3 benchmark gaps.

**Gate between every step:** Founder GO/NO-GO (per user preference — stop after each phase).

---

## 13. DELIVERABLE 11 — Repository Baseline (snapshot for later phases to measure against)

| Baseline metric | Value (2026-06-28) |
|---|---|
| Tracked files | 5,413 |
| Working-tree size | 855 MB |
| Total app code | ~786k lines (FE 375k · BE 407k · FastAPI 1.5k · scripts 3k) |
| Frontend pages / components | 89 / 541 |
| SuperAdmin panels | 230 |
| Backend route files / services / scripts | 303 / 569 / 319 |
| Migrations | 218 |
| Endpoint registrations (surface est.) | ~3,241 |
| `/api` router mounts | 51 |
| `routes.ts` lines | 14,464 |
| Declared table names | ~1,304 (incl. mirrors) |
| `FF_*` tokens / live-ON | 536 / ~60–70 |
| Entry bundle | 1,618 kB (425 kB gz) |
| Build | 4,841 modules, ~36s |

**This table is the contract:** any later phase claiming "reduced complexity / improved perf / cleaned schema" is measured against these exact numbers.

---

## 14. DELIVERABLE 12 — Readiness Score (DERIVED)

**Phase-0 question: is the repository ready to be *enhanced* (not rewritten)?**

| Readiness axis | Verdict |
|---|---|
| Is the system understood end-to-end? | **Yes** — searched, inventoried, cross-checked vs docs/memory |
| Is existing IP catalogued & protected? | **Yes** — §7, §9 |
| Is technical debt identified & localised? | **Yes** — §6 (concentrated, not diffuse) |
| Is a measurable baseline established? | **Yes** — §1, §13 |
| Is an enhancement order prepared? | **Yes** — §12 |
| Are there blocking unknowns? | **Two open**: Mongo dev divergence (R4), Razorpay e2e (R8) — neither blocks Phase-0 sign-off |

**Readiness Score: 8 / 10 — READY FOR PHASED, ADDITIVE ENHANCEMENT.** The repository is well-understood, richly documented, and its debt is localised and addressable without a rewrite. The two open unknowns are tracked, not blocking.

---

## 15. Success-criteria checklist (spec §SUCCESS CRITERIA)

| Criterion | Status |
|---|---|
| ✓ Entire repository searched | **Met** — all top-level dirs enumerated; counts from `git ls-files` |
| ✓ Every capability documented | **Met** — §4 inventory + companion MX-700 docs |
| ✓ No code changed | **Met** — read-only; only this `.md` deliverable written |
| ✓ No duplicate functionality created | **Met** — nothing built |
| ✓ Existing IP catalogued | **Met** — §9 |
| ✓ Technical debt identified | **Met** — §6 |
| ✓ Repository baseline established | **Met** — §1, §13 |
| ✓ Enhancement roadmap prepared | **Met** — §10, §12 |

### Reproducibility (commands used for the measured baseline)
```bash
git ls-files | wc -l                                   # tracked files
du -sh --exclude=node_modules --exclude=.git .          # working-tree size
git ls-files <dir> | grep -E '\.(ts|tsx|js|jsx|py)$' | xargs wc -l   # LOC by area
git ls-files 'src/pages/*.tsx' | wc -l                  # pages (in frontend/)
git ls-files 'routes/*' 'services/*' | wc -l            # backend modules (in backend/)
grep -hoE "\.(get|post|put|patch|delete)\(['\"`]/" *.ts | wc -l   # endpoint surface
grep -hioE "CREATE TABLE (IF NOT EXISTS )?[a-z_.\"]+"   # declared table names
# bundle sizes read from the `build` workflow output
```

---

**STOP — Phase 0 complete. Awaiting Founder GO/NO-GO before any Phase 1 (PRESERVE/ACTIVATE) work.**
No code was modified. No application files were created. The only artefact produced is this baseline document.
