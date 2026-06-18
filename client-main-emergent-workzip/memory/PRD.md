# MetryxOne — Multi-Service Project (PRD)

## Original Problem Statement
User imported 3 GitHub-style ZIP archives:
- **client-main** — React + Vite frontend ("Frappe Dynamics / MetryxOne")
- **server-main** — Node.js Express + MongoDB + Postgres (drizzle) backend
- **backend-main** — Python FastAPI + SQLAlchemy/Postgres bulk-upload service

User asked: extract the projects and run all three (Option D).

## Architecture
```
/app
├── frontend/      # React 18 + Vite + Tailwind + Radix + i18n  → port 3000
├── backend/       # Node Express + Mongoose + Drizzle (Postgres)  → port 8001
└── backend-main/  # FastAPI + SQLAlchemy (Postgres)              → port 8002
```

### Databases
- **MongoDB** (port 27017, db: `metryxone`) — used by Node backend (chat, mongoose models)
- **PostgreSQL** (port 5432) — two DBs:
  - `metryxone_node` — Node Drizzle schema (190+ tables)
  - `metryxone` — FastAPI SQLAlchemy schema (10 tables, bulk upload)

## What's been implemented (2026-04-27 → 2026-04-28)
- Extracted all 3 ZIPs into `/app` with proper structure
- Installed dependencies (`npm install --legacy-peer-deps`, pip install fastapi+sqlalchemy+emergentintegrations)
- Installed PostgreSQL 15; created both databases
- Pushed Drizzle schema to `metryxone_node` via `drizzle-kit push --force`
- FastAPI auto-creates Postgres tables via `Base.metadata.create_all` on startup

## CHANGELOG — May 2026

### 2026-05-01 (latest) — LBI Items tab parity
- Added **Items** tab to `LBIAdminPage.tsx` so LBI matches SDI and Competency parity (Question Bank with search + domain filter + paginated table). Wired to existing `/api/lbi/admin/questions-all` endpoint. Verified UI renders with empty state (0 items currently — bulk-imported via existing CSV upload).
- Verified end-to-end: login works, `/api/lbi/admin/engine-summary` returns 19 domains/97 subs/6 age bands/582 norms/582 weights/1 version. `/api/sdi/admin/engine-summary` returns 18/54/6 stages/324 norms/324 weights.


### 2026-05-01 — Persistence & Career Intelligence Platform additions
- **Permanent persistence (Option A + B)**: Postgres data dir moved to `/app/.pgdata` (persistent volume). Periodic `pg_dumpall` backups every 10 min to `/app/.backups/latest.sql.gz` with table-count safeguard (refuses to overwrite a good backup with a partial one). Auto-restore on container reset. Bootstrap regenerates Postgres configs after pod resets.
- **Login bulletproofed**: Postgres-backed session store (`express_sessions`), `trust proxy`, `secure: 'auto'`, `sameSite: 'lax'`, named cookie `mx.sid`. Sessions survive backend restarts.
- **Career Intelligence Platform — missing pieces** added per spec:
  - `cohorts` table (§10 Benchmark Engine) with 9 default cohorts (SDE/PM/DA/SALES × experience bands × locations)
  - `competency_versions` table (§14 Version Control) with v1.0 baseline auto-created
  - `tag` column on `competencies` (technical/behavioral/leadership classification)
  - Backend endpoints: `GET/POST/PATCH/DELETE /api/competency/cohorts`, `GET/POST /api/competency/versions`, `GET /api/competency/engine-summary`
  - Super Admin UI: 2 new tabs in CompetencyAdminPage — **Cohorts** (CRUD with role/experience/location form) + **Versions** (engine-summary stats grid + version timeline + take-snapshot)
- **Concern Areas restored**: 160 parent concerns × 18 categories. Endpoints ported from alt server into main backend (`/api/concerns/admin/*` + `/api/concerns/search`, `/api/concerns/categories`).
- **Student Development Index (SDI)**: 18 domains added to a separate `sdi_domains` table. Surfaced in Super Admin → Assessment Modules → Domains tab (third group) AND Overview tab (new SDI Overview card with 18 colour-coded tiles + "Manage" CTA + count in stats grid).
- **Subdomain bug fix**: removed stray `lbiAdminQDomain` filter from the LBI subdomain query. D01 now correctly shows 6 subdomains.
- **Hero polish**: enterprise gradient backdrop (`mx-page-bg`) with subtle grain + vignette. Removed obstructing `LiveStatsPulse`.

### 2026-05-01 (later) — P0 + P1 + P2 shipped
**P0 — SDI fully wired**
- New tables: `sdi_subdomains` (54 rows seeded, 3 per domain), `sdi_items`, `sdi_item_options`
- Modular routes file: `/app/backend/routes/sdi.ts` — full CRUD on domains/subdomains/items/options
- Endpoints: `GET/POST/PATCH/DELETE /api/sdi/admin/{domains,subdomains,items}`, public `GET /api/sdi/{domains,subdomains,items}`, `GET /api/sdi/admin/stats`
- Super Admin UI: new **SDI tab** in `CompetencyAdminPage` with 3 sub-sections (Domains · Subdomains · Question Bank), full CRUD modals with colour pickers, parent dropdown, default 5-point Likert options, and stats badge

**P1 — Cluster Mapping UI**
- Added missing PATCH and DELETE endpoints for `/api/competency/clusters/:id`
- Added `code` column to `competency_clusters` (was missing)
- Cluster cards now have edit + delete buttons, edit dialog has competency multi-select with filter

**P2 — Engines (modular)**
- New file: `/app/backend/routes/engines.ts`
- §11 Confidence Engine: weighted blend of attempts (35%) × recency (25%) × consistency (40%). Endpoint `GET /api/engines/confidence/:userId/:competencyId`
- §13 Explainability Engine: returns ei + bucket + topStrengths + topGaps + narrative + suggestedActions. Endpoint `GET /api/engines/explain/:userId`
- §14 Event System: in-process `EventEmitter` + 200-event ring log + `assessment_completed` / `score_updated` listeners. Endpoints `GET /api/engines/events`, `POST /api/engines/events/emit`
- `/app/scripts/seed-lbi-data.sql` — 19 LBI domains + 97 subdomains + 6 age bands
- `/app/scripts/seed-competency-library.sql` — 317 micro-competencies (flat library)
- `/app/scripts/seed-competency-framework.sql` — DDL + 12 domains + 101 competencies + 505 stage norms + 707 role weights + 5 scoring configs
- `/app/scripts/seed-concern-areas.sql` — 160 concerns × 18 categories
- `/app/scripts/seed-sdi-domains.sql` — 18 SDI domains
- `/app/scripts/seed-competency-engine-extras.sql` — cohorts + versions + tag column
- `/app/scripts/seed-sdi-extras.sql` — sdi_subdomains (54 rows) + sdi_items + sdi_item_options tables

## Backlog (P0 / P1 / P2)
- **P0**: Wire SDI domains to assessment items (subdomains + question bank); CRUD UI for SDI from Super Admin
- **P1**: Hero redesign — replace empty video panel with Products & Services map + auto-scrolling featured-product carousel (option 1a + 2a + 3a + 4a from earlier)
- **P1**: Cluster mapping UI (currently table exists but no UI to assign competencies to clusters)
- **P2**: Confidence engine implementation (§11) — score by attempts × recency × consistency
- **P2**: Explainability engine (§13) — reason-for-score natural-language output via LLM
- **P2**: Event system (§14) — assessment_completed / score_updated queue → recompute EI dashboard
- **P2**: Refactor `/app/backend/routes.ts` (12.5k lines) into modular controllers

- Fixed broken import in `storage.ts` (`server/shared/schema` → `./shared/schema`)
- Created symlinks `/app/shared` and `/app/server/shared` → `/app/backend/shared` for relative imports
- Restructured FastAPI: moved Python files into `app/` package
- Updated `vite.config.ts` to port 3000 + proxy `/api` → 8001
- Updated supervisor configs to manage all 3 services
- Uncommented `registerRoutes` and `registerChatRoutes` in `/app/backend/index.ts` → full API now exposed
- Seeded data: super admin, assessment templates, curriculum data
- **Emergent LLM key wired up** via OpenAI-compatible proxy at `POST http://localhost:8002/llm/v1/chat/completions` (file: `app/routers/llm_proxy.py`); supports **streaming SSE** for `stream:true` requests
- Patched `services/aiTestGenerator.ts` so OpenAI client respects `OPENAI_BASE_URL`
- Added `/api/v1/upload/*` reverse-proxy in Node backend → FastAPI (bulk-upload endpoints now reachable via preview URL)
- Created `/app/scripts/bootstrap.sh` (idempotent: installs Postgres, pushes schema, installs emergentintegrations, starts supervisord, restarts backend-py after DB is ready)
- Created `/app/memory/test_credentials.md`
- Zod v4 bug fix at `routes.ts:3402/3458/3521` — AI test endpoints now return proper 400 instead of 500
- Production build validated — `npm run build` completes in ~11s with no errors
- Old ChatWidget/ChatModal imports removed from `App.tsx` (task: replace default chat widget)
- **NEW: AIDemoWidget** at `/app/frontend/src/components/AIDemoWidget.tsx` — public landing-page AI bot. Features:
  - 11-language support (English, Hindi, Telugu, Tamil, Kannada, Marathi, Bengali, Gujarati, Malayalam, Punjabi, Urdu with RTL) with per-language greetings, suggestions, placeholders, and footers
  - Language dropdown in header with Globe icon
  - Persistent session ID via sessionStorage
  - Proper dir="rtl" handling for Urdu input
  - Full `data-testid` coverage
- **NEW: Comprehensive MetryxOne knowledge base** at `/app/backend/knowledge-base.ts` (16 sections covering: LBI (19 domains/97 subdomains/age bands), 4 assessment products, 7 portals, mentor services, career/talent, competitive exam portal (8 tabs for JEE/NEET/EAMCET/CAT/CUET/GATE), gamification engine with formulas, Pragati chatbot & 160 concern areas, surveys, DPDP/SOC2 compliance, tech stack, FAQ). Injected into the `/api/chat/message` system prompt so AI answers are grounded in real product facts and never invented.

## Verified working (end-to-end)
- Frontend renders MetryxOne landing page (HTTP 200)
- `POST /api/login` (super admin) returns 200 via public URL
- FastAPI `/health`, `/llm/v1/health`, `/llm/v1/chat/completions` return 200
- `POST /api/chat/message` with language="en" returns accurate multi-paragraph responses pulled from KB (e.g., gamification: XP formula, 100 coins=₹10, 90-day expiry, streak rewards 10→20→30→50→75)
- `POST /api/chat/message` with language="hi" returns responses in Hindi
- `POST /api/conversations/:id/messages` streams SSE chunks end-to-end
- `POST /api/v1/upload/health` returns `{"status":"ok"}` via Node proxy → FastAPI
- `POST /api/ai-tests/generate` (invalid body) now returns 400 with proper Zod-v4 error message
- `npm run build` succeeds for production frontend bundle
- **UI verified**: widget renders correctly in English and Hindi; language selector opens; AI replies in selected language

## What's been implemented (2026-04-30)
- **Super Admin data seeded** — empty dashboard fix:
  - `POST /api/admin/subscription-packages/seed` → 13 default packages inserted (categories: Entry Micro Check, Exam-Season Special, Annual Core, Premium, Post-Exam)
  - `POST /api/admin/seed-psychometric-data` → 19 domains, 96 subdomains, 6 age bands
  - `POST /api/admin/seed-education-data` → 18 boards, 216 classes, 1507 subjects
  - `POST /api/admin/platform-settings/seed-defaults` → 27 platform settings
- Pricing & Packages tab now shows 13 cards (price = "Custom" until super-admin sets actual price)
- Added "Bulk Pricing (CSV)" button on the Pricing & Packages tab → routes to `AdminPricingPage` for CSV import / export and revenue analytics

## What's been implemented (2026-04-30 — third pass)
- **Custom 19 domains × 116 subdomains** seeded per user spec (replaces previous 96 default subdomains):
  - 1.ACE(7), 2.TQP(10), 3.ESER(9), 4.CSCC(9), 5.ACC(6), 6.SEI(6), 7.DHC(8), 8.CE(6), 9.MVR(6), 10.LPE(5), 11.CER(5), 12.IRCM(5), 13.APRI(6), 14.MSR(5), 15.HSSU(5), 16.AIM(4), 17.TCA(6), 18.TSIS(4), 19.OCR(4) = 116
  - Mirrored into `lbi_modules` (19) + `lbi_sub_modules` (116) via `/api/admin/seed-lbi-framework`
  - `psychometric_domain_age_band_config` rebuilt: 19 × 6 = 114 default rows
- Reseed SQL script kept at `/tmp/reseed_framework.sql` for re-runs.

## What's been implemented (2026-04-30 — second pass)
- **Bug**: Frontend Super Admin → "Domains/Items/Age Bands/Framework" page showed 0 because it called `/api/lbi/admin/*` endpoints that did not exist. Fixed by:
  - Added `POST /api/admin/seed-lbi-framework` — auto-bootstraps `lbi_modules` (19), `lbi_sub_modules` (96), `lbi_age_groups` (6) from the existing `psychometric_*` seed data
  - Added alias routes consumed by `SuperAdminDashboard.tsx`:
    - `GET /api/lbi/admin/modules` and `PATCH /api/lbi/admin/modules/:id`
    - `GET /api/lbi/admin/subdomains?domain_code=...`
    - `GET /api/lbi/admin/stats`
    - `GET /api/lbi/admin/custom-modules` (returns `[]`)
    - `GET /api/lbi/admin/questions-all` with full filter+pagination support
    - `GET /api/lbi/admin/questions/template` (forwards to existing `/api/admin/lbi-questions/template`)
    - `POST /api/lbi/admin/questions/import` (forwards to existing `/api/admin/lbi-questions/upload`)
    - `PATCH /api/lbi/admin/domains/:id/toggle`
- Verified: small CSV → `POST /api/lbi/admin/questions/import` → 2/2 imported, `/api/lbi/admin/stats` reflects items=2.

## Known issues / Backlog (P1/P2)
- **Deploy validation**: pending target decision (AWS / GCP / Vercel / Replit / Emergent native)
- **Stripe / SendGrid / Twilio** integrations: pending user request (which provider to use?)
- `/api/auth/social/status` returns 404 — frontend pre-flights a social-login status endpoint that isn't mounted; harmless.
- A few unrelated frontend calls still 404 (`/api/admin/scoring/engine-stats`, `/api/admin/scoring/modules-catalog`, `/api/competency/domains`, `/api/admin/lbi-catalog`); they don't break the LBI admin flow but can be tackled separately.

## Future enhancements
- **Smart suggestion**: Since AI is live via Emergent and the bot has comprehensive KB, consider wiring it to **capture leads inline** — when the bot detects intent like "I want to try", "book demo", "pricing" — auto-inject an inline form (name + email + org) right in the chat that posts to a new `/api/leads` endpoint, then continues the conversation. Typically 3x more conversions than directing visitors to a separate form.

## What's been implemented (2026-04-30 — Phase 2: Competency Engine)
- **123 competencies** across 5 domains (Cognitive 24, Functional 24, Behavioral 24, Interpersonal 24, Leadership 24, plus 3 imported via CSV test)
- **600 stage norms** (5 stages × 120 baseline competencies; admin can edit per cell)
- **120 role weights** seeded for sample role `SDE_L2` (mix of core/differentiator/supporting)
- **5 sample assessment items** with scoring options imported via CSV
- New tables: `competency_assessment_items`, `competency_assessment_options`, `competency_user_responses`, `role_competency_weights`, `competency_cohorts`, `learning_mappings`
- New endpoints:
  - `GET/POST/PATCH/DELETE /api/competency/competencies` + CSV `template` and `import`
  - `GET/POST/DELETE /api/competency/items` + CSV `template` and `import`
  - `GET/POST /api/competency/role-weights`
  - `GET /api/competency/score/:userId?stage_code=&role_code=` — full scoring engine returning Employability Index, normalized + weighted scores, top strengths, top gaps with priority, confidence, coverage
- Verified end-to-end: imported items → submitted user response → scoring API correctly returned EI 0.95, top strengths and weighted gaps.

## What's been implemented (2026-04-30 — Phase 7: AI-draft, Diff, Radar, Deploy notes)
- **AI-draft button** — `Sparkles` button on Items tab opens a competency picker modal. POSTs to `/api/competency/items/ai-draft` which uses the existing FastAPI proxy to call Claude/GPT-4 via Emergent LLM key. Returns a realistic scenario + 4 scored options (10/35/70/95). Verified: drafted LEAD_C20 (Talent Development) — top option scores 95: "Proactively identify stretch assignments, mentor closely, create development plan" — admin can review/edit afterwards.
- **Compare to Last Attempt diff card** — new endpoint `/api/competency/score/:userId/diff` buckets responses into 30-min sessions, returns latest vs previous EI + top-8 per-competency deltas. New `<DiffCard>` on student results page shows arrow direction + green/red badges per competency.
- **SVG Radar chart** — replaced the percentage bars on the student results domain summary with a proper polygon radar (5 axes for the 5 domains, 5 grid rings 20–100%, indigo fill at 18% opacity, point markers, axis labels). Numerical tile grid kept below for accessibility.
- **Deployment note** — Emergent native deploy doesn't run port 8002 (FastAPI). Two paths: (a) deploy on GCP with FastAPI service (need GCP Project ID), or (b) migrate AI endpoints from Node to FastAPI as a single Python backend. Document captured in PRD.

## What's been implemented (2026-04-30 — Phase 6: Curated IDP, HQ items, Analytics, Bulk Export)
- **67 curated learning resources** (Coursera, edX, HBS Online, IDEO U, Reforge, Goodreads books, mentor links) replacing all auto-generated search URLs in `learning_mappings`
- **27 hand-authored quality assessment items** (`%_I_HQ`) replacing the templated ones for the highest-leverage competencies (COG_C02 Problem Solving, COG_C40 Root Cause, FUNC_C11 SQL, FUNC_C13 Programming, FUNC_C25 PM Foundations, INT_C07 Negotiation, LEAD_C13 Crisis Leadership, BEH_C01 Ownership, etc.). Each item has a realistic scenario + 4 options scored 5–95.
- **Bulk responses CSV export**: `GET /api/competency/responses/export` (super admin) + "Export Responses CSV" button on the Competency Admin Page header
- **Analytics endpoints**:
  - `GET /api/competency/analytics/ei-trend/:userId` — daily EI snapshots over time
  - `GET /api/competency/analytics/cohort-benchmark` — Mean / Median / p25 / p90 across all users for a stage+role
- **Analytics card on student results page** — SVG line chart of EI over time + 4-tile cohort benchmark grid
- Verified end-to-end: trend + cohort APIs return correct data, HQ items present, export CSV works.

## Deployment readiness (Emergent native)
- ✅ All API routes use `/api` prefix
- ✅ All credentials in `.env` files; no hardcoded secrets in source
- ✅ No persistent disk dependencies
- ⚠️ Node backend calls `http://localhost:8002/llm/v1/chat/completions` (FastAPI proxy) for AI Demo Widget + chat. Emergent native deploy runs only frontend + Node + Mongo; port 8002 won't exist in prod.
  - Fix at deploy time: point the Node OpenAI SDK directly at the Emergent LLM endpoint (`https://...emergentagent.com/llm/v1`) using `EMERGENT_LLM_KEY`.

## What's been implemented (2026-04-30 — Phase 5: Pricing, 300 items, CSV import, Student CTA)
- **Pricing set on all 13 packages** (Indian market baseline; admin can edit any time):
  - Entry Micro Checks: ₹99–₹149
  - ExamReadiness Index™: ₹1,499
  - Annual: FOUNDATION ₹2,999 · PERFORMANCE ₹4,999 · READINESS ₹7,999
  - Premium EDGE: ₹12,999, Transition Check: ₹599
- **300 starter assessment items** (1 per competency, 4 options scoring 10/40/70/100, templated by competency_type)
- **Bulk CSV import** for Stage Norms and Role Weights:
  - `GET /api/competency/stage-norms/template` + `POST /api/competency/stage-norms/import`
  - `GET /api/competency/role-weights/template` + `POST /api/competency/role-weights/import`
  - Template + Import CSV buttons added to both tabs in CompetencyAdminPage
- **Student dashboard CTA**: "Career Score" Quick Action at top of StudentDashboard → opens `/student-competency`
- **Routing fix**: Added `admin-competency` and `student-competency` to `validScreens` whitelist for deep-linking
- Verified end-to-end (305 items · 1220 options · 13 priced packages · 1920 role weights · 300 competencies)

## Phase 4-5 historical (now consolidated above)

## What's been implemented (2026-04-30 — Phase 4: 300+ competencies, Filters, Student UI)
- **300 competencies** across 5 domains (COG/FUNC/BEH/INT/LEAD — 60 each), 1500 stage norms — full library now matches the original 300+ requirement
- **7 hiring role profiles** seeded with full competency × weight × type:
  - PM_L3 (Product Manager), SDE_L2 + SDE_L3 (Software Engineer), UX_L3 (UX Designer), DA_L2 (Data Analyst), SALES_L2 (Sales AE), OPS_L2 (Operations Manager) — each has overrides for 5–9 core competencies (1.8 weight) and 3–6 differentiators (1.4 weight)
- **43 learning mappings** (Coursera courses, books, mentor links) seeded for the highest-leverage competencies → power the IDP recommendations
- **Filter dropdowns** on Super Admin → Assessment Modules:
  - LBI Behavioural Domain Coverage card — "Filter by domain" dropdown filters the domain grid
  - Professional Competency Framework card — "Filter by domain" dropdown filters the competency-domain grid
- **New `/student-competency` page** (`/app/frontend/src/pages/StudentCompetencyPage.tsx`) — three-phase flow:
  1. Config — pick career stage + target role
  2. Taking — 20 randomized scenario items, MCQ options, progress bar
  3. Results — big EI score (color-tiered), domain radar, top 5 strengths, top 5 priority-weighted gaps, **Individual Development Plan** with course/book/mentor recommendations, "Find a Mentor" CTA
- New backend endpoints:
  - `GET /api/competency/assessment/start?limit=` — randomized items
  - `POST /api/competency/assessment/submit` — saves responses with auto-scoring
  - `GET /api/competency/idp/:userId?stage_code=&role_code=` — top gaps + recommendations
  - `GET /api/competency/learning-recommendations/:competencyId?level=`
- End-to-end verified: stats show 300 / 7 roles / 1920 weights; domain filter dropdown operational; competency cards show 60 sub each.

## What's been implemented (2026-04-30 — Phase 3: UI + Engine 404 fixes)
- **New page `/admin-competency`** (`/app/frontend/src/pages/CompetencyAdminPage.tsx`) with 6 working tabs:
  - **Domains**: card grid + add/edit/delete with color picker, weight, order
  - **Competencies**: filterable table by domain + search, full CRUD, **CSV import dialog** with template download, per-row error display, copy-to-clipboard for errors, success/error toasts
  - **Clusters**: card grid + create with multi-select competency mapper
  - **Items**: searchable table + add (full editor with question + 4 options + score-per-option) + **CSV import** (same dialog component, uses `/api/competency/items/import`)
  - **Role Weights**: roles list (left) + weight matrix (right) + **Configure Role dialog** with full competency × weight + core/differentiator/supporting picker
  - **Stage Norms**: per-stage editable table for min/median/top10 scores per competency
- **Wired `Manage Framework` button** on Super Admin → Assessment Modules → Professional Competency Framework section
- **Implemented previously-404 endpoints**:
  - `GET /api/admin/scoring/engine-stats` → real counts from lbi_modules, lbi_age_groups, etc.
  - `GET /api/admin/scoring/modules-catalog` → modules + sub-modules + age bands
  - `GET /api/admin/lbi-catalog` → flat read-only catalog
  - `GET /api/admin/scoring/assessment-products` → from subscription_packages
- Verified end-to-end: rendered the new admin page, all 6 tabs functional, stats strip live (Domains 5 · Competencies 123 · Items 5 · Role Weights 120).

## Phase 3 backlog (remaining UI)
- Student-side: Take competency assessment + see EI + radar chart + recommended IDP
- Stage Norm bulk-update CSV (currently only inline editing)
- Role weight CSV import / export
- Cluster edit/delete (currently create-only)

## Known issues / Backlog (P1/P2)
- **`/api/ai-tests/generate` returns HTTP 500** — pre-existing Zod error handler bug: uses `parseResult.error.errors[0]` but Zod v4 uses `.issues`. The AI pipeline is fine; just the input-validation error handler crashes. Trivial one-line fix in `routes.ts:3402` but hold until user requests.
- **`/api/auth/social/status` returns 404** — frontend pre-flights a social-login status endpoint that isn't mounted; harmless, only appears in network tab.
- **OpenAI key placeholder replaced** with EMERGENT_LLM_KEY. AI credits deduct from Emergent balance.
- **Stripe / Twilio / SendGrid** — not configured (no integration playbook called yet)
- **Production builds** not tested (only dev mode)

## Future enhancements
- **Smart suggestion**: Since AI is live via Emergent, add a **public "Try the AI Behavioral Coach" interactive demo** on the landing page hero — a 3-question mini-LBI that returns an AI-generated insight card without requiring signup. This typically 2-3x's qualified B2B demo-request conversion for edtech platforms because decision-makers experience the AI before committing to a sales call. Uses the existing `/api/chat/message` endpoint and the Emergent key.
