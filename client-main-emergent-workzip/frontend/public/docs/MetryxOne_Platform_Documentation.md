# MetryxOne — Complete End-to-End Platform Documentation

**Confidential | Internal Reference Document**
Version: May 2026

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Technology Stack & Architecture](#2-technology-stack--architecture)
3. [User Roles & Personas](#3-user-roles--personas)
4. [Frontend: Pages & Screens](#4-frontend-pages--screens)
5. [Landing Page](#5-landing-page)
6. [Intelligence Frameworks](#6-intelligence-frameworks)
   - 6.1 [LBI — Longitudinal Behavioral Intelligence](#61-lbi--longitudinal-behavioral-intelligence)
   - 6.2 [SDI — Skill & Disposition Index](#62-sdi--skill--disposition-index)
   - 6.3 [Competency Intelligence](#63-competency-intelligence)
   - 6.4 [CAPADEX Behavioral Intelligence](#64-capadex-behavioral-intelligence)
7. [Product Modules](#7-product-modules)
   - 7.1 [EXAM READY™](#71-exam-ready)
   - 7.2 [Mentor Marketplace](#72-mentor-marketplace)
   - 7.3 [Career Intelligence Portals](#73-career-intelligence-portals)
   - 7.4 [Competency Intelligence Platform](#74-competency-intelligence-platform)
   - 7.5 [Concern Areas & Short Assessments](#75-concern-areas--short-assessments)
8. [Super Admin Dashboard](#8-super-admin-dashboard)
9. [Database Schema](#9-database-schema)
10. [API Reference](#10-api-reference)
11. [Authentication & Security](#11-authentication--security)
12. [Email & Notifications](#12-email--notifications)

---

## 1. Platform Overview

### What is MetryxOne?

MetryxOne is a **Behavioral Intelligence SaaS Platform** that combines behavioral science, psychometric assessment, and AI-driven analytics to generate learning, exam-readiness, and talent intelligence insights for schools, campuses, and enterprises.

> MetryxOne is **not** a clinical diagnostic tool. It is designed for developmental intelligence — helping individuals and institutions understand behavioral patterns, competencies, and growth trajectories.

### Core Value Propositions

| Audience | Value |
|----------|-------|
| **Schools & Institutes** | Understand student behavioral patterns across 19 domains and 97 subdomains; improve learning outcomes |
| **Campuses & Universities** | Assess employability readiness, competency gaps, and career alignment before placement season |
| **Enterprises & HR** | Predict workplace fit, measure behavioral traits, and support professional development |
| **Parents** | Get actionable intelligence on child development concerns through CAPADEX |
| **Students (6–18)** | Understand learning style, attention, emotional regulation, and academic readiness |
| **Mentors** | Access student behavioral profiles to guide sessions and career counseling |

### Rotating Brand Headlines (Landing Page)

- *"Behavioral intelligence that turns potential into measurable performance."*
- *"The intelligence platform for schools, campuses, and enterprises."*
- *"19 behavioral domains. 97 subdomains. One unified intelligence platform."*
- *"50 competencies. 7 industries. One career intelligence engine."*

---

## 2. Technology Stack & Architecture

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React + Vite (TypeScript) — port 5000 |
| **Backend** | Node.js + Express + tsx — port 8080 |
| **Database** | PostgreSQL (via Drizzle ORM) |
| **Email** | Zoho SMTP via nodemailer |
| **ORM** | Drizzle ORM (`backend/shared/schema.ts`) |
| **API Proxy** | Vite `/api/*` → `http://localhost:8080` |

### Project Structure

```
workspace/
├── frontend/               React + Vite app (port 5000)
│   ├── src/
│   │   ├── App.tsx         SPA router (Screen enum + component switch)
│   │   ├── components/     All page + UI components
│   │   │   ├── LandingPage.tsx
│   │   │   ├── SuperAdminDashboard.tsx
│   │   │   ├── SuperAdminLogin.tsx
│   │   │   ├── FreeAssessmentModal.tsx  (CAPADEX full flow)
│   │   │   ├── admin/      CrudTable, FrameworkPanel, parity-tabs
│   │   │   ├── exam-ready/ EXAM READY™ pages
│   │   │   ├── layout/     Navbar, Footer
│   │   │   └── superadmin/ CAPADEX admin panels
│   │   ├── pages/          Route-level page components
│   │   └── data/           Static seed data (concernAreas, etc.)
│   └── vite.config.ts      Proxy + host config
│
├── backend/                Node.js + Express API (port 8080)
│   ├── index.ts            Server entry point
│   ├── routes.ts           All inlined routes (~22k lines) + register calls
│   ├── routes/             Modular route files
│   │   ├── sdi.ts
│   │   ├── framework-parity.ts
│   │   ├── import-export.ts
│   │   ├── engines.ts
│   │   ├── capadex.ts
│   │   ├── capadex-enterprise.ts
│   │   ├── capadex-concern-intelligence.ts
│   │   ├── concern-intelligence-admin.ts
│   │   ├── signal-capture.ts
│   │   └── csi.ts
│   ├── services/
│   │   └── signal-classifier.ts
│   ├── email.ts            Nodemailer / Zoho SMTP
│   ├── migrations/         SQL migration files
│   └── shared/schema.ts    Drizzle schema (symlinked)
│
└── shared/                 → backend/shared (symlink)
```

### Route Module Registration

All route modules are registered inside `registerRoutes(app)` in `backend/routes.ts`:

```typescript
app.use('/api/v1', examReadyV1Router());
registerSdiRoutes(app, pool, requireAuth, requireSuperAdmin);
registerEngineRoutes(app, pool, requireAuth, requireSuperAdmin);
registerFrameworkParityRoutes(app, pool, requireAuth, requireSuperAdmin);
registerImportExportRoutes(app, pool, requireAuth, requireSuperAdmin);
registerCapadexRoutes(app, pool);
registerCapadexEnterpriseRoutes(app, pool);
registerConcernIntelligenceRoutes(app);
registerConcernIntelligenceAdminRoutes(app, pool);
registerSignalCaptureRoutes(app, pool);
registerCSIRoutes(app, pool);
```

---

## 3. User Roles & Personas

### Platform Roles

| Role | Description | Login Path |
|------|-------------|-----------|
| **Super Admin** | Full platform access — all data, config, reports | `/` → SuperAdminLogin |
| **Parent** | Manages children's assessments and CAPADEX sessions | Unified Parent Dashboard |
| **Student** | Takes LBI, exam-readiness, and behavioral assessments | Student Dashboard |
| **Institution Admin** | Manages institute, batches, enrollments, and reports | Unified Institute Dashboard |
| **HR / Employer** | Views competency reports and talent intelligence | HR Dashboard |
| **Mentor** | Delivers sessions, views student profiles | Mentor Dashboard |
| **CAPADEX User** | Public-facing behavioral assessment (anonymous → registered) | CAPADEX OTP flow |

### Super Admin Credentials
- **Email:** `superadmin@metryx.one`
- **Password:** `admin123`

### CAPADEX Assessment Personas

| Persona | Typical User |
|---------|-------------|
| `student` | School/college student taking assessment for themselves |
| `parent` | Parent assessing concern about their child |
| `professional` | Working adult assessing workplace concerns |
| `campus` | College student preparing for placement/career |
| `jobseeker` | Individual actively seeking employment |
| `teacher` | Educator assessing classroom behavior concerns |

---

## 4. Frontend: Pages & Screens

All screens are defined in `frontend/src/App.tsx` as a `Screen` type union and routed via a component switch.

### Public / Marketing Pages

| Screen | Description |
|--------|-------------|
| `landing` | Main marketing homepage |
| `about` | About MetryxOne |
| `leadership` | Leadership team |
| `press` | Press and media |
| `pricing` | Public pricing page |
| `docs` | Documentation hub |
| `case-studies` | Customer case studies |
| `research` | Research and whitepapers |
| `help` | Help center |
| `contact` | Contact form |
| `request-demo` | Demo request form |
| `privacy` | Privacy policy |
| `terms` | Terms of service |
| `site-map` | Site map |
| `careers` | Careers at MetryxOne |

### Authentication & Onboarding

| Screen | Description |
|--------|-------------|
| `login` | Main login page |
| `registration` | New account registration |
| `forgot-password` | Password recovery |
| `role-selection` | Post-login role chooser |
| `onboarding-register` | Guided onboarding registration |
| `document-upload` | Upload verification documents |
| `mentor-agreement` | Mentor contract acceptance |
| `parent-consent-approve` | Parent consent for child assessment |

### Dashboards

| Screen | Description |
|--------|-------------|
| `unified-parent-dashboard` | Parent dashboard: children, assessments, CAPADEX |
| `unified-institute-dashboard` | Institute dashboard: batches, students, reports |
| `student-dashboard` | Student home: exams, results, LBI |
| `hr-dashboard` | HR/employer: candidate pipeline, reports |
| `ngo-dashboard` | NGO partner dashboard |
| `mentor-dashboard` | Mentor: upcoming sessions, student profiles |

### Assessment Flows

| Screen | Description |
|--------|-------------|
| `generate-exam` | Parent generates exam for child |
| `preview-blueprint` | Preview exam structure before publishing |
| `student-exam-list` | Student's available exams |
| `exam-player` | Live exam-taking interface |
| `results-summary` | Post-exam results view |
| `student-consent-explainer` | Behavioral task consent screen |
| `assessment-start` | LBI assessment intro |
| `interactive-task` | Behavioral stimulus task |
| `context-transition` | Between-task context screen |
| `focus-task` | Focused behavioral task |
| `reflection-screen` | Post-task reflection prompt |
| `session-recorded` | Session completion confirmation |
| `lbi-assessment` | Admin LBI assessment runner |
| `parent-lbi` | Parent-triggered LBI for child |

### EXAM READY™ Module

| Screen | Description |
|--------|-------------|
| `exam-ready` | EXAM READY landing/home |
| `exam-ready-login` | Product-specific login |
| `exam-ready-checkout` | Purchase flow |
| `exam-ready-assessment-start` | Single subject assessment start |
| `exam-ready-assessment-start-all` | Full multi-subject assessment start |
| `exam-ready-assessment` | Live assessment interface |
| `exam-ready-report-status` | Report generation status |
| `exam-ready-report-view` | Exam readiness report |
| `exam-ready-disclaimer` | Report disclaimer |
| `exam-ready-compare` | Compare two assessments |

### Mentor & Career

| Screen | Description |
|--------|-------------|
| `mentor-marketplace` | Browse and book mentors |
| `mentor-profile` | Individual mentor profile |
| `join-session` | Video session join |
| `learning-paths` | Personalised learning path view |
| `notification-preferences` | User notification settings |
| `career-builder` | Career path builder tool |
| `employer-portal` | Employer-facing talent portal |
| `competitive-exam-portal` | Competitive exam prep hub |
| `student-career-portal` | Student career intelligence |
| `parent-career-portal` | Parent career guidance view |
| `institution-career-portal` | Institute placement intelligence |
| `mentor-career-portal` | Mentor career counseling tools |

### Competency Intelligence

| Screen | Description |
|--------|-------------|
| `competency-intelligence` | Competency intelligence home |
| `competency-gap-analysis` | Identify skill gaps vs. role benchmarks |
| `competency-benchmarks` | Industry benchmark comparisons |
| `competency-career-stages` | Career stage progression map |
| `competency-role-transition` | Role change readiness |
| `competency-hiring-prediction` | Hiring fit prediction |
| `competency-growth-simulation` | Simulate growth trajectories |
| `competency-learning-paths` | Competency-based learning plans |

### Admin

| Screen | Description |
|--------|-------------|
| `super-admin` | Super Admin Dashboard |
| `admin-pricing` | Pricing management |
| `admin-competency` | Competency framework admin |
| `admin-lbi` | LBI framework admin |
| `admin-sdi` | SDI framework admin |
| `student-competency` | Student competency view |
| `theme-settings` | Platform theme customization |
| `enrollment-requests` | Institute enrollment requests |
| `exam-templates` | Exam template management |

---

## 5. Landing Page

**File:** `frontend/src/components/LandingPage.tsx`

### Brand Colors
- **Primary:** `#0B3C5D` (Deep navy)
- **Accent:** `#4ECDC4` (Teal)

### Hero Section
- Rotating headline text (5 variants, cycling)
- **CAPADEX concern-first hero input**: text box where a user types a concern (e.g., "Can't focus") and clicks "Analyse →"
  - Quick-chip shortcuts: Screen addiction, Can't focus, Exam anxiety, Social anxiety, Career confusion
  - Launches `FreeAssessmentModal` with `initialConcern` pre-filled

### Page Sections

| Section ID | Content |
|-----------|---------|
| `trust` | Logos / trust strip (partner institutions) |
| `impact` | Platform impact metrics |
| `built-for` | Audience segments (Schools / Campuses / Enterprises) |
| `services` | Core service descriptions |
| `how-it-works` | Step-by-step flow |
| `features` | Feature highlights |
| `mentor-marketplace` | Mentor marketplace preview |
| `testimonials` | User testimonials carousel |
| `faq` | Expandable FAQ accordion |
| `use-cases-faq` | Use-case specific FAQ |
| `pricing` | Pricing plans |
| Final CTA | Gradient full-width call-to-action |

### FAQ Topics
- "Is MetryxOne a diagnostic tool?" (Answer: No — developmental, not clinical)
- "How long does an assessment take?"
- "Is my child's data safe?"
- How does scoring work?
- How do I share reports with teachers?

### Navbar (from `frontend/src/components/layout/Navbar.tsx`)
- **Products** mega-menu: Intelligence frameworks, EXAM READY™, Mentor Marketplace, Career portals
- **For Schools**, **For Campuses**, **For Enterprises**
- **Research**, **About**, **Pricing**
- Login / Get Started CTAs

---

## 6. Intelligence Frameworks

MetryxOne is built on four inter-connected behavioral and competency intelligence frameworks.

---

### 6.1 LBI — Longitudinal Behavioral Intelligence

LBI is MetryxOne's flagship psychometric framework covering **19 behavioral domains** and **97 subdomains** that measure behavioral patterns across a person's learning, social, and developmental life.

#### Core Structure

| Level | Count | Description |
|-------|-------|-------------|
| Domains | 19 | Top-level behavioral areas (e.g., Attention, Emotional Regulation, Social) |
| Subdomains | 97 | Specific facets within each domain |
| Questions | 100–250+ | Norm-referenced items per age band |
| Age Bands | A / B / C / 19+ | 6–10, 11–14, 15–18, Adults |

#### Database Tables

| Table | Purpose |
|-------|---------|
| `lbi_subdomain_norms` | Age-band specific norms per subdomain |
| `lbi_age_band_weights` | Domain weighting by age band |
| `lbi_clusters` | Domain cluster groupings |
| `lbi_cluster_map` | Cluster ↔ subdomain mappings |
| `lbi_learning_mappings` | Domain → learning intervention mappings |
| `lbi_versions` | Framework version tracking |
| `psychometric_domains` | 19 LBI domains (seeded) |
| `psychometric_subdomains` | 97 subdomains (seeded) |

#### Key API Routes

**Public / Authenticated:**
```
GET  /api/lbi/domains
GET  /api/lbi/age-bands
GET  /api/lbi/questions
GET  /api/lbi/modules
GET  /api/lbi/age-groups
GET  /api/lbi/sessions
POST /api/lbi/sessions
GET  /api/lbi/sessions/:sessionId/questions
POST /api/lbi/sessions/:sessionId/responses
POST /api/lbi/sessions/:sessionId/time
POST /api/lbi/sessions/:sessionId/complete
GET  /api/lbi/sessions/:sessionId/results
POST /api/lbi/calculate-score
```

**Admin (super admin only):**
```
GET    /api/lbi/admin/modules
PATCH  /api/lbi/admin/modules/:id
GET    /api/lbi/admin/subdomains
GET    /api/lbi/admin/stats
GET    /api/lbi/admin/custom-modules
POST   /api/lbi/admin/custom-modules
PATCH  /api/lbi/admin/custom-modules/:id
DELETE /api/lbi/admin/custom-modules/:id
GET    /api/lbi/admin/questions-all
GET    /api/lbi/admin/questions/template
POST   /api/lbi/admin/questions/import
GET    /api/lbi/admin/scoring-rules
GET    /api/lbi/admin/report-types
GET    /api/lbi/admin/anchor-items
GET    /api/lbi/admin/cluster-correlations
GET    /api/lbi/admin/domains
POST   /api/lbi/admin/domains
PATCH  /api/lbi/admin/domains/:id
DELETE /api/lbi/admin/domains/:id
GET    /api/lbi/admin/subdomain-list
POST   /api/lbi/admin/subdomain-list
PATCH  /api/lbi/admin/subdomain-list/:id
DELETE /api/lbi/admin/subdomain-list/:id
GET    /api/lbi/admin/age-bands
GET    /api/lbi/admin/clusters
POST   /api/lbi/admin/clusters
PATCH  /api/lbi/admin/clusters/:id
DELETE /api/lbi/admin/clusters/:id
POST   /api/lbi/admin/clusters/:id/subdomains
GET    /api/lbi/admin/clusters/:id/subdomains
GET    /api/lbi/admin/subdomain-norms
POST   /api/lbi/admin/subdomain-norms
PATCH  /api/lbi/admin/subdomain-norms/:id
DELETE /api/lbi/admin/subdomain-norms/:id
GET    /api/lbi/admin/age-band-weights
POST   /api/lbi/admin/age-band-weights
PATCH  /api/lbi/admin/age-band-weights/:id
DELETE /api/lbi/admin/age-band-weights/:id
GET    /api/lbi/admin/learning-mappings
POST   /api/lbi/admin/learning-mappings
PATCH  /api/lbi/admin/learning-mappings/:id
DELETE /api/lbi/admin/learning-mappings/:id
GET    /api/lbi/admin/versions
POST   /api/lbi/admin/versions
GET    /api/lbi/admin/engine-summary
GET    /api/lbi/admin/export?type=...
POST   /api/lbi/admin/import
```

#### Admin Panel (SuperAdminDashboard → "LBI" tab)

The LBI admin panel uses the unified `FrameworkPanel` component with 8 tabs:
- **Overview** — Live DB stats (domain/subdomain/question counts)
- **Domains** — CRUD for the 19 LBI domains
- **Subdomains** — CRUD for subdomains (with domain linkage)
- **Content** — Assessment items (weight, polarity, anchor flag)
- **Clusters** — Domain cluster management
- **Norms** — Age-band scoring norms per subdomain
- **Weights** — Stage-level domain weighting
- **Versions** — Framework version history

---

### 6.2 SDI — Skill & Disposition Index

SDI is MetryxOne's second psychometric framework, structurally similar to LBI but focused on skills and dispositions rather than behavioral domains. Used primarily as the item bank for CAPADEX assessments.

#### Database Tables

| Table | Purpose |
|-------|---------|
| `sdi_domains` | Top-level SDI domains |
| `sdi_subdomains` | Subdomains per domain |
| `sdi_items` | Assessment questions/items |
| `sdi_item_options` | Answer options per item |
| `sdi_stages` | Assessment stages |
| `sdi_clusters` | Domain clusters |
| `sdi_cluster_map` | Cluster ↔ subdomain links |
| `sdi_subdomain_norms` | Age-band norms |
| `sdi_stage_weights` | Stage-level weights |
| `sdi_learning_mappings` | Learning intervention links |
| `sdi_versions` | Version tracking |
| `sdi_user_responses` | Stored user responses |

#### Key API Routes

**Public:**
```
GET /api/sdi/domains
GET /api/sdi/subdomains
GET /api/sdi/items
GET /api/sdi/stages
GET /api/sdi/clusters
GET /api/sdi/subdomain-norms
GET /api/sdi/stage-weights
GET /api/sdi/learning-mappings
```

**Admin:**
```
GET/POST/PATCH/DELETE  /api/sdi/admin/domains
POST/PATCH/DELETE      /api/sdi/admin/subdomains
POST/PATCH/DELETE      /api/sdi/admin/items
GET/POST/PATCH/DELETE  /api/sdi/admin/stages
GET/POST/PATCH/DELETE  /api/sdi/admin/clusters
GET/POST/PATCH/DELETE  /api/sdi/admin/subdomain-norms
GET/POST/PATCH/DELETE  /api/sdi/admin/stage-weights
GET/POST/PATCH/DELETE  /api/sdi/admin/learning-mappings
GET/POST               /api/sdi/admin/versions
GET                    /api/sdi/admin/engine-summary
GET                    /api/sdi/admin/scoring-rules
GET                    /api/sdi/admin/stats
```

---

### 6.3 Competency Intelligence

The Competency Intelligence framework maps **50 competencies across 7 industries** to enable skills benchmarking, hiring prediction, and career-stage assessment for campuses and enterprises.

#### Database Tables

| Table | Purpose |
|-------|---------|
| `competency_domains` | Top-level competency areas |
| `competencies` | Individual competencies (50+) |
| `competency_clusters` | Competency clusters by role/industry |
| `competency_assessment_items` | Assessment questions |
| `competency_assessment_options` | Answer options |
| `role_competency_weights` | Weight per role type |
| `stage_competency_norms` | Career stage norms |
| `scoring_configs` | Scoring configuration rules |

#### Key API Routes

**Public / Authenticated:**
```
GET  /api/competency/domains
GET  /api/competency/competencies
GET  /api/competency/clusters
GET  /api/competency/clusters/:id/subdomains
GET  /api/competency/stage-norms
GET  /api/competency/scoring-config
GET  /api/competency/stats
GET  /api/competency/learning-recommendations/:competencyId?level=...
GET  /api/competency/assessment/start
POST /api/competency/assessment/submit
```

**Admin:**
```
POST/PATCH/DELETE   /api/competency/domains
POST/PATCH/DELETE   /api/competency/competencies
POST/PATCH/DELETE   /api/competency/clusters
POST                /api/competency/clusters/:id/subdomains
PATCH               /api/competency/stage-norms/:id
PATCH               /api/competency/scoring-config/:name
PATCH               /api/competency/items/:id
```

#### Competency Intelligence Product Screens

| Screen | Description |
|--------|-------------|
| `competency-gap-analysis` | Identify which competencies fall below role benchmark |
| `competency-benchmarks` | Compare against industry norms |
| `competency-career-stages` | Visualise progress across career stages |
| `competency-role-transition` | Readiness to move between roles |
| `competency-hiring-prediction` | Fit score for hiring decisions |
| `competency-growth-simulation` | "What if" competency growth modeling |
| `competency-learning-paths` | Competency-linked learning plan |

---

### 6.4 CAPADEX Behavioral Intelligence

CAPADEX is MetryxOne's consumer-facing product — a concern-first, conversational behavioral intelligence assessment delivered as a progressive 4-stage journey.

> Full CAPADEX documentation is maintained in `docs/CAPADEX.md`. This section provides a product-level summary.

#### The 4 Stages

| Stage | Code | XP | Focus |
|-------|------|----|-------|
| Curiosity | CAP_CUR | 100 | How the problem shows up |
| Insight | CAP_INS | 150 | Root cause analysis |
| Growth | CAP_GRW | 200 | Strategy and habit design |
| Mastery | CAP_MAS | 250 | Long-term integration |

#### Key Sub-Systems

| System | Purpose |
|--------|---------|
| **Concern Intelligence Engine** | NLP-style rule engine — classifies concern into category/severity/persona, generates behavioural mirror + intelligence preview |
| **Behavioural Signal Intelligence (BIOS)** | Captures implicit signals (response timing, answer changes, linguistic patterns) — 14 signal types |
| **Career Stage Index (CSI)** | Composite 0–100 score across all completed CAPADEX stages; weighted by stage depth |
| **Gamification** | XP, levels, streaks, 7 badge types |
| **Recommendations Engine** | Rule-based recs by concern category × score level |
| **Risk Intelligence** | Auto-flags users scoring <40; severity tiers; admin intervention management |

#### Score Levels

| Score | Level | Color |
|-------|-------|-------|
| 80–100 | Advanced | Green |
| 65–79 | Proficient | Blue |
| 40–64 | Developing | Orange |
| 0–39 | Emerging | Red |

---

## 7. Product Modules

### 7.1 EXAM READY™

EXAM READY™ is MetryxOne's academic assessment and exam-readiness product — a subject-by-subject diagnostic tool that generates readiness reports before major exams.

#### Flow
1. Parent/student purchases an EXAM READY package
2. Selects subjects and exam type
3. Takes subject-wise assessments
4. Receives readiness report with topic-level gap analysis
5. Optional: compare two attempts side-by-side

#### Screens

| Screen | Purpose |
|--------|---------|
| `exam-ready` | Product landing |
| `exam-ready-login` | Product-specific login |
| `exam-ready-checkout` | Purchase and payment |
| `exam-ready-assessment-start` | Single subject start |
| `exam-ready-assessment-start-all` | All subjects batch start |
| `exam-ready-assessment` | Live assessment |
| `exam-ready-report-status` | Report generation progress |
| `exam-ready-report-view` | Final readiness report |
| `exam-ready-disclaimer` | Report usage disclaimer |
| `exam-ready-compare` | Side-by-side report comparison |

#### Backend
All EXAM READY routes are registered via `app.use('/api/v1', examReadyV1Router())` from `backend/exam-ready.v1.routes.ts`.

---

### 7.2 Mentor Marketplace

A marketplace connecting students and parents with certified mentors for behavioral guidance, career counseling, and academic support.

#### Features
- Browse mentors by domain, expertise, and availability
- View mentor profile: bio, credentials, session history, specialties
- Book and pay for video sessions
- Join live sessions via `join-session` screen
- Mentor dashboard: manage schedule, view student profiles

#### Key Screens
- `mentor-marketplace` — Search and filter mentors
- `mentor-profile` — Individual mentor detail
- `mentor-dashboard` — Mentor management panel
- `join-session` — Video session launcher

#### Admin Management (SuperAdminDashboard → "Mentors" tab)
- View all registered mentors
- Approve/reject mentor applications
- Manage mentor agreements and documents

---

### 7.3 Career Intelligence Portals

MetryxOne provides separate role-specific career intelligence portals for each user type.

| Portal Screen | User |
|---------------|------|
| `student-career-portal` | Students: career path, readiness score, job alignment |
| `parent-career-portal` | Parents: child's career trajectory and guidance |
| `institution-career-portal` | Institutes: placement intelligence, batch readiness |
| `mentor-career-portal` | Mentors: guide sessions with behavioral career data |
| `employer-portal` | Employers: talent intelligence and candidate fit |
| `career-builder` | DIY career path builder tool |
| `competitive-exam-portal` | Competitive exam prep hub |

---

### 7.4 Competency Intelligence Platform

A standalone module for campuses and enterprises to run competency assessments and generate hiring/development intelligence.

#### Screens
- `competency-intelligence` — Hub page
- `competency-gap-analysis`, `competency-benchmarks`, `competency-career-stages`
- `competency-role-transition`, `competency-hiring-prediction`
- `competency-growth-simulation`, `competency-learning-paths`

#### Engines Module (`backend/routes/engines.ts`)
Powers confidence scoring and explainability for competency results:
```
GET  /api/engines/confidence/:userId/:competencyId
GET  /api/engines/explain/:userId
GET  /api/engines/events
POST /api/engines/events/emit
```

---

### 7.5 Concern Areas & Short Assessments

A curated catalog of **160 concern areas** (e.g., "Screen Addiction", "Exam Anxiety", "Peer Pressure") that power CAPADEX's concern-first entry. Short assessments are 3–10 question diagnostic sets mapped to specific concern areas, ages, and stages.

#### Structure

| Entity | Count | Description |
|--------|-------|-------------|
| Concern areas | 160 | Named concern strings with category + persona tags |
| Short assessment questions | Per concern | 3–10 questions per concern × stage × age band |
| Age bands | 3 | A (6–10), B (11–14), C (15–18) |

#### Database Tables

| Table | Purpose |
|-------|---------|
| `concern_areas` | 160 concern area entries |
| `short_assessment_questions` | Questions per concern/stage/age band |
| `short_assessment_age_bands` | Age band definitions (A/B/C) |

#### Key API Routes

**Public:**
```
GET /api/concerns/search
GET /api/concerns/categories
GET /api/short-assessments/age-bands
GET /api/short-assessments/summary
```

**Admin:**
```
GET/POST/PATCH/DELETE  /api/concerns/admin/list
GET/POST/PATCH/DELETE  /api/short-assessments/admin
PUT                    /api/short-assessments/admin/age-bands
POST                   /api/short-assessments/admin/upload   (bulk TSV/CSV)
DELETE                 /api/short-assessments/admin/bulk
```

---

## 8. Super Admin Dashboard

**Access:** Login at `/` with `superadmin@metryx.one` / `admin123`

The Super Admin Dashboard is a single-page admin console (`frontend/src/components/SuperAdminDashboard.tsx`) with a left sidebar containing grouped tabs.

### Sidebar Navigation

#### No Group (Top-Level)
| Tab | ID | Description |
|-----|----|-------------|
| Overview | `overview` | Platform stats, active sessions, KPIs |
| Onboarding | `onboarding` | New user onboarding queue |

#### Academic Assessments
| Tab | ID | Description |
|-----|----|-------------|
| Question Bank | `questionbank` | Manage all assessment questions |

#### Intelligence Frameworks
| Tab | ID | Description |
|-----|----|-------------|
| LBI | `lbi-fw` | Full LBI framework management (8 tabs) |
| Reports | `reports` | All assessment reports across frameworks |
| Competency | `competency-fw` | Full Competency framework management |

#### CAPADEX Intelligence
| Tab | ID | Description |
|-----|----|-------------|
| CAPADEX Framework | `capadex-fw` | SDI + short assessments + concern areas |
| Users & Journeys | `capadex-users` | All CAPADEX users + journey drill-down |
| Analytics & Cohorts | `capadex-analytics` | Funnel, score dist, top concerns, daily sessions |
| Risk & Interventions | `capadex-interventions` | Auto-flagged risks + manual interventions |
| Upgrade Pricing | `capadex-pricing` | Stage unlock pricing management |
| Signal Intelligence | `signal-intelligence` | Behavioural signal profiles + early warnings |
| CSI Intelligence | `csi-intelligence` | Career Stage Index profiles + analytics |
| Concern Intelligence | `concern-intelligence` | Category rules + clarification questions admin |

#### Assessment Tools
| Tab | ID | Description |
|-----|----|-------------|
| Custom Modules | `custom-modules` | Custom assessment module builder |
| Norms & Scoring | `scoring` | Global scoring configuration |

#### People
| Tab | ID | Description |
|-----|----|-------------|
| User Management | `usermgmt` | All platform users |
| Parents | `parents` | Parent accounts and child linkages |
| Students (18+) | `students` | Adult student accounts |
| Institutions | `institutions` | School/campus institution accounts |
| HR & Jobs | `hr` | HR partner accounts and job listings |
| Mentors | `mentors` | Mentor profiles and status |

#### Platform
| Tab | ID | Description |
|-----|----|-------------|
| Pricing & Packages | `pricing` | Subscription package management |
| Learning Plans | `learning` | Learning plan templates |
| Content Manager | `content` | Platform content and copy management |
| Documents | `documents` | Uploaded documents and verifications |
| Entity Codes | `codes` | Reference codes and entity registry |
| Consents | `consents` | Consent record management |
| Access Control | `access` | Role and permission management |

#### System
| Tab | ID | Description |
|-----|----|-------------|
| Financials | `financials` | Revenue, transactions, invoices |
| Security | `security` | Security settings and logs |
| Audit Logs | `audit` | Full platform audit trail |
| Notifications | `notifications_mgmt` | Notification template management |
| Settings | `settings` | Global platform settings |

### Quick Access Links (Sidebar Footer)
- Mentor Marketplace → `mentor-marketplace`
- LBI Assessment → `parent-lbi`
- Parent Portal → `unified-parent-dashboard`
- Student Portal → `student-dashboard`

### CAPADEX Admin Panels (Detail)

#### Users & Journeys
- Paginated user table: name, email, verification status, sessions completed, concerns, avg score
- **User Journey Drawer**: gamification summary, open risk flags, all assessment stages grouped by concern, recommendations, interventions

#### Analytics & Cohorts
- KPIs: total sessions, unique users, completion rate, good outcomes (score ≥ 65)
- Stage conversion funnel (Curiosity → Mastery)
- Score distribution histogram
- Top concerns by volume
- Daily sessions (30-day trend)
- Age band and persona distribution

#### Risk & Interventions
- **Risk Flags tab**: severity filter (critical/high/medium), status filter (open/resolved), resolve with notes
- **Interventions tab**: create manual interventions (type, assignee, priority, due date); track status pipeline (pending → active → completed/cancelled); outcome notes + score

#### Upgrade Pricing
Per stage (Insight, Growth, Mastery):
- Price, price note, tag, description, benefits list, WhatsApp contact number, active toggle

#### Signal Intelligence
- **Dashboard**: sessions analyzed, early warnings, avg risk score, urgent count; severity distribution; top 10 signals
- **Profiles table**: heatmap cells per dimension; filter by severity/priority/warnings-only
- **Profile drawer**: dimension bars, early warnings, dominant signals, growth indicators, hidden patterns, linguistic analysis, raw signals

#### CSI Intelligence
- **Profiles tab**: sortable table; profile drawer with CSI score hero, positive/negative factors, domain bars, trajectory sparkline, assessment history
- **Analytics tab**: KPIs, stage distribution, top concerns, 30-day trend, top performers
- **Domain Weights tab**: inline editable weight (0–3) and active toggle per subdomain

#### Concern Intelligence
- **Categories tab**: 8 expandable cards — edit detection keywords, severity keywords, default signals, patterns, subdomains, preview templates, mirror templates
- **Questions tab**: 75 questions — filter by category/persona; add/edit/delete via modal

---

## 9. Database Schema

### Complete Table List

All tables across all migration files:

#### Framework Tables (`20260502_framework_tables.sql`)
`lbi_subdomain_norms`, `lbi_age_band_weights`, `lbi_clusters`, `lbi_cluster_map`, `lbi_learning_mappings`, `lbi_versions`, `sdi_domains`, `sdi_subdomains`, `sdi_items`, `sdi_item_options`, `sdi_stages`, `sdi_clusters`, `sdi_cluster_map`, `sdi_subdomain_norms`, `sdi_stage_weights`, `sdi_learning_mappings`, `sdi_versions`, `sdi_user_responses`, `competency_domains`, `competencies`, `competency_clusters`, `competency_assessment_items`, `competency_assessment_options`, `role_competency_weights`, `stage_competency_norms`, `scoring_configs`, `concern_areas`

#### CAPADEX Core (`20260504_capadex_sessions.sql`, `20260504_capadex_auth_reports.sql`)
`capadex_sessions`, `capadex_responses`, `capadex_users`, `capadex_otps`, `capadex_reports`

#### Short Assessments (`20260505_short_assessments.sql`)
`short_assessment_age_bands`, `short_assessment_questions`

#### CAPADEX Enterprise (`20260506_capadex_enterprise.sql`)
`capadex_user_profiles`, `capadex_recommendations`, `capadex_risk_flags`, `capadex_interventions`, `capadex_gamification`, `capadex_audit_events`, `capadex_consent_records`

#### Signal Intelligence (`20260506_signal_capture.sql`)
`capadex_session_signals`, `capadex_signal_profiles`, `capadex_linguistic_signals`

#### Platform (`20260506_notification_preferences.sql`)
`notification_preferences`

#### Concern Intelligence (`20260507_concern_intelligence.sql`)
`ci_categories`, `ci_clarification_questions`

#### CSI (`20260507_csi.sql`)
`csi_profiles`, `csi_trajectory`, `csi_domain_weights`

---

### Key Table Schemas

#### `capadex_sessions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Unique session |
| `guest_email` | text | Null until registration; backfilled on OTP verify |
| `guest_name` | text | Participant name |
| `concern_name` | text | The assessed concern |
| `user_age` | integer | |
| `age_band` | text | A / B / C / 19+ |
| `stage_code` | text | CAP_CUR / CAP_INS / CAP_GRW / CAP_MAS |
| `stage_index` | integer | 0–3 |
| `status` | text | in_progress / completed / replaced |
| `score` | numeric | Final stage score 0–100 |
| `persona` | text | Detected persona |
| `time_taken_s` | integer | Total seconds |

#### `capadex_reports`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK | capadex_users |
| `session_id` | uuid FK | capadex_sessions |
| `score` | numeric | Stage score |
| `score_level` | text | Emerging / Developing / Proficient / Advanced |
| `subdomains` | jsonb | Array of {name, avg_score, item_count} |
| `score_override` | numeric | Admin override |
| `headline_override` | text | Admin override |
| `narrative_override` | text | Admin override |
| `review_status` | text | pending / reviewed / published |
| `admin_notes` | text | |

#### `csi_profiles`
| Column | Type | Notes |
|--------|------|-------|
| `user_email` | text UNIQUE | Primary lookup key |
| `csi_score` | numeric | 0–100 composite score |
| `csi_stage` | text | Forming / Emerging / Developing / Proficient / Advanced |
| `positive_factors` | jsonb | Top 3 subdomains ≥ 65 |
| `negative_factors` | jsonb | Bottom 3 subdomains < 40 |
| `domain_scores` | jsonb | All subdomain scores |
| `sessions_count` | integer | Total sessions used |

#### `ci_categories` (8 rows)
| Column | Type | Notes |
|--------|------|-------|
| `cat_key` | text | digital / academic / emotional / behavioural / social / career / wellness / general |
| `keywords` | text | Regex detection pattern |
| `default_signals` | jsonb | 3 default emotional signals |
| `patterns` | jsonb | 3 detected behavioral patterns |
| `subdomains` | jsonb | 4 relevant subdomains |
| `preview_templates` | jsonb | 3 intelligence preview lines |
| `mirror_templates` | jsonb | 4 behavioural mirror statements |

#### `short_assessment_questions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `concern_id` | integer FK | concern_areas |
| `stage_label` | text | CAP_CUR / CAP_INS / CAP_GRW / CAP_MAS |
| `age_band` | text | A / B / C |
| `persona` | text | student / parent / professional / etc. |
| `question_text` | text | |
| `options` | jsonb | [{text, value, polarity, weight}] |
| `subdomain_code` | text | Links to scoring |
| `is_anchor` | boolean | Anchor item flag |
| `is_active` | boolean | |

---

## 10. API Reference

### Authentication Middleware

| Middleware | Usage |
|-----------|-------|
| `requireAuth` | Any authenticated user |
| `requireSuperAdmin` | Super admin role only |

### Subscription Packages

```
GET  /api/subscription-packages          Public listing of packages
POST /api/admin/subscription-packages    Create package
PATCH /api/admin/subscription-packages/:id
DELETE /api/admin/subscription-packages/:id
GET  /api/admin/subscription-packages/stats
GET  /api/admin/subscription-packages/export
POST /api/admin/subscription-packages/import
POST /api/admin/subscription-packages/seed
```

### LBI Routes

```
# Public
GET  /api/lbi/domains
GET  /api/lbi/age-bands
GET  /api/lbi/questions
GET  /api/lbi/subdomain-norms
GET  /api/lbi/age-band-weights
GET  /api/lbi/learning-mappings
GET  /api/lbi/clusters

# Authenticated
GET  /api/lbi/modules
GET  /api/lbi/age-groups
GET/POST /api/lbi/sessions
GET  /api/lbi/sessions/:id/questions
POST /api/lbi/sessions/:id/responses
POST /api/lbi/sessions/:id/time
POST /api/lbi/sessions/:id/complete
GET  /api/lbi/sessions/:id/results
POST /api/lbi/calculate-score

# LBI categories
GET/POST/PATCH/DELETE /api/lbi-categories
GET/POST/PATCH/DELETE /api/lbi-categories/:id

# Admin
GET/POST/PATCH/DELETE /api/lbi/admin/domains
GET/POST/PATCH/DELETE /api/lbi/admin/subdomain-list
GET/POST/PATCH/DELETE /api/lbi/admin/clusters
GET/POST/PATCH/DELETE /api/lbi/admin/subdomain-norms
GET/POST/PATCH/DELETE /api/lbi/admin/age-band-weights
GET/POST/PATCH/DELETE /api/lbi/admin/learning-mappings
GET/POST              /api/lbi/admin/versions
GET                   /api/lbi/admin/engine-summary
GET                   /api/lbi/admin/modules
PATCH                 /api/lbi/admin/modules/:id
GET                   /api/lbi/admin/subdomains
GET                   /api/lbi/admin/stats
GET/POST/PATCH/DELETE /api/lbi/admin/custom-modules
GET                   /api/lbi/admin/questions-all
GET                   /api/lbi/admin/questions/template
POST                  /api/lbi/admin/questions/import
GET                   /api/lbi/admin/scoring-rules
GET                   /api/lbi/admin/report-types
GET                   /api/lbi/admin/anchor-items
GET                   /api/lbi/admin/cluster-correlations
GET                   /api/lbi/admin/export?type=
POST                  /api/lbi/admin/import
```

### SDI Routes

```
# Public
GET  /api/sdi/domains
GET  /api/sdi/subdomains
GET  /api/sdi/items
GET  /api/sdi/stages
GET  /api/sdi/clusters
GET  /api/sdi/subdomain-norms
GET  /api/sdi/stage-weights
GET  /api/sdi/learning-mappings

# Admin
GET/POST/PATCH/DELETE /api/sdi/admin/domains
POST/PATCH/DELETE     /api/sdi/admin/subdomains
POST/PATCH/DELETE     /api/sdi/admin/items
GET/POST/PATCH/DELETE /api/sdi/admin/stages
GET/POST/PATCH/DELETE /api/sdi/admin/clusters
GET/POST/PATCH/DELETE /api/sdi/admin/subdomain-norms
GET/POST/PATCH/DELETE /api/sdi/admin/stage-weights
GET/POST/PATCH/DELETE /api/sdi/admin/learning-mappings
GET/POST              /api/sdi/admin/versions
GET                   /api/sdi/admin/engine-summary
GET                   /api/sdi/admin/scoring-rules
GET                   /api/sdi/admin/stats
```

### Competency Routes

```
GET/POST/PATCH/DELETE /api/competency/domains
GET/POST/PATCH/DELETE /api/competency/competencies
GET/POST/PATCH/DELETE /api/competency/clusters
GET/POST              /api/competency/clusters/:id/subdomains
GET/PATCH             /api/competency/stage-norms
GET/PATCH             /api/competency/scoring-config
PATCH                 /api/competency/items/:id
GET                   /api/competency/stats
GET                   /api/competency/learning-recommendations/:id?level=
GET                   /api/competency/assessment/start
POST                  /api/competency/assessment/submit
```

### Concern Areas Routes

```
GET    /api/concerns/search
GET    /api/concerns/categories
GET    /api/concerns/admin/list
POST   /api/concerns/admin
PATCH  /api/concerns/admin/:id
DELETE /api/concerns/admin/:id
```

### Short Assessments Routes

```
GET    /api/short-assessments/age-bands
GET    /api/short-assessments/summary
GET    /api/short-assessments/admin/list
POST   /api/short-assessments/admin
PATCH  /api/short-assessments/admin/:id
DELETE /api/short-assessments/admin/:id
DELETE /api/short-assessments/admin/bulk
PUT    /api/short-assessments/admin/age-bands
POST   /api/short-assessments/admin/upload
```

### CAPADEX Routes

```
# Concern Intelligence
POST /api/capadex/concern/analyze

# Session
POST /api/capadex/session/start
POST /api/capadex/session/:id/respond
POST /api/capadex/session/:id/complete
GET  /api/capadex/progress

# Authentication
POST /api/capadex/auth/register
POST /api/capadex/auth/verify-otp
POST /api/capadex/auth/resend-otp
POST /api/capadex/auth/login

# Reports
GET  /api/capadex/report/:session_id
POST /api/capadex/report/:session_id/send-email

# Pricing
GET  /api/capadex/pricing
GET  /api/admin/capadex/pricing
PUT  /api/admin/capadex/pricing/:stage_code

# User
GET  /api/capadex/user/journey
GET  /api/capadex/user/gamification
POST /api/capadex/user/consent

# Admin
GET   /api/admin/capadex/users
GET   /api/admin/capadex/users/:id/journey
GET   /api/admin/capadex/analytics
GET   /api/admin/capadex/risk-flags
PATCH /api/admin/capadex/risk-flags/:id
GET   /api/admin/capadex/interventions
POST  /api/admin/capadex/interventions
PATCH /api/admin/capadex/interventions/:id
GET   /api/admin/capadex/reports
GET   /api/admin/capadex/reports/:id
PATCH /api/admin/capadex/reports/:id
GET   /api/admin/capadex/audit-events
```

### Signal Intelligence Routes

```
POST /api/signals/ingest
GET  /api/admin/signals/dashboard
GET  /api/admin/signals/profiles
GET  /api/admin/signals/profiles/:sessionId
```

### CSI Routes

```
POST  /api/csi/recalculate
GET   /api/admin/csi/profiles
GET   /api/admin/csi/profiles/:email
GET   /api/admin/csi/analytics
GET   /api/admin/csi/domain-weights
PATCH /api/admin/csi/domain-weights/:id
```

### Concern Intelligence Admin Routes

```
GET    /api/admin/ci/categories
PATCH  /api/admin/ci/categories/:key
GET    /api/admin/ci/questions
POST   /api/admin/ci/questions
PATCH  /api/admin/ci/questions/:id
DELETE /api/admin/ci/questions/:id
```

### Engines Routes

```
GET  /api/engines/confidence/:userId/:competencyId
GET  /api/engines/explain/:userId
GET  /api/engines/events
POST /api/engines/events/emit
```

### EXAM READY™ Routes

```
/api/v1/*   (all EXAM READY routes, via examReadyV1Router)
```

---

## 11. Authentication & Security

### Platform Authentication (Main App)

- JWT-based authentication for parent, student, institution, HR, and mentor roles
- `requireAuth` middleware validates JWT on protected routes
- `requireSuperAdmin` middleware validates super admin session

### CAPADEX Authentication

CAPADEX uses a dedicated OTP-based email verification flow:

1. User registers with email + password → `POST /api/capadex/auth/register`
2. OTP sent via Zoho SMTP (10-minute expiry, 6 digits)
3. User verifies → `POST /api/capadex/auth/verify-otp`
4. `email_verified = true` set on `capadex_users`

**Anonymous Session Linkage:**
- CAPADEX sessions start with `guest_email = null`
- On registration and OTP verification, `session_id` is passed and the session's `guest_email` is backfilled
- This links the anonymous session to the verified user account

### Super Admin Authentication

- Simple credential check against hard-coded or env-based super admin credentials
- Session maintained client-side via `localStorage`
- Login component: `frontend/src/components/SuperAdminLogin.tsx`

### Environment Secrets

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ZOHO_EMAIL` | Sender email address for Zoho SMTP |
| `ZOHO_APP_PASSWORD` | Zoho app password for SMTP auth |

---

## 12. Email & Notifications

### Email Service (`backend/email.ts`)

All transactional email is sent via **Zoho SMTP** using nodemailer.

#### Email Types

| Type | Trigger | Template |
|------|---------|---------|
| CAPADEX OTP | Registration / resend | 6-digit code + 10-min expiry message |
| CAPADEX Report | User requests report email | Branded HTML report with concern narrative, score, subdomain chart |
| Assessment Invitations | Parent generates exam | Exam link + instructions |

#### CAPADEX Report Email Structure
- Brand header (MetryxOne + CAPADEX logo)
- Participant name, concern name, stage completed
- Score + level badge (color-coded)
- Concern-specific narrative block (chosen by category × score level)
- Subdomain breakdown section
- CTA to unlock next stage
- Privacy footer

### Notification Preferences

Users can configure notification preferences (stored in `notification_preferences` table):
- Email notifications (assessment results, reminders)
- In-app notifications

---

## Appendix A: Admin Panel Component Map

| Panel Component | File | Tab ID |
|----------------|------|--------|
| LBI Framework | `admin/FrameworkPanel.tsx` (LBI config) | `lbi-fw` |
| SDI/CAPADEX Framework | `superadmin/CapadexFrameworkPanel.tsx` | `capadex-fw` |
| Competency Framework | `admin/FrameworkPanel.tsx` (Competency config) | `competency-fw` |
| Assessment Modules | `AssessmentModulesManagement.tsx` | `custom-modules` |
| CAPADEX Users | `superadmin/CapadexUsersPanel.tsx` | `capadex-users` |
| CAPADEX Analytics | `superadmin/CapadexAnalyticsPanel.tsx` | `capadex-analytics` |
| Risk & Interventions | `superadmin/CapadexInterventionsPanel.tsx` | `capadex-interventions` |
| Upgrade Pricing | `superadmin/CapadexPricingPanel.tsx` | `capadex-pricing` |
| CAPADEX Reports | `superadmin/CapadexReportsPanel.tsx` | `reports` (CAPADEX section) |
| Signal Intelligence | `superadmin/SignalIntelligencePanel.tsx` | `signal-intelligence` |
| CSI Intelligence | `superadmin/CSIPanel.tsx` | `csi-intelligence` |
| Concern Intelligence | `superadmin/ConcernIntelligencePanel.tsx` | `concern-intelligence` |
| Concern Areas | `superadmin/ConcernAreasPanel.tsx` | (CAPADEX Framework sub-tab) |
| Short Assessments | `superadmin/ShortAssessmentsPanel.tsx` | (CAPADEX Framework sub-tab) |

---

## Appendix B: Data Seed Summary

| Data | Count | Source |
|------|-------|--------|
| LBI Domains | 19 | `psychometric_domains` table |
| LBI Subdomains | 97 | `psychometric_subdomains` table |
| Concern Areas | 160 | `concern_areas` table + `frontend/src/data/concernAreas.ts` |
| Age Bands | 3 (A/B/C) | `short_assessment_age_bands` |
| CI Categories | 8 | `ci_categories` (seeded via migration) |
| CI Clarification Questions | 75 | `ci_clarification_questions` (8 categories × 3 base + persona overrides) |
| Subscription Packages | Via seed endpoint | `/api/admin/subscription-packages/seed` |
| CAPADEX Pricing | 3 stages | `capadex_pricing` table |

---

## Appendix C: Key Data Flows

### User Assessment Flow (LBI / School)
```
Parent login → Generate Exam (select child + modules)
→ Student login → Student Exam List
→ Exam Player (questions, timing, interactive tasks)
→ Session Complete → Results Summary
→ Parent views report in Unified Parent Dashboard
```

### CAPADEX Consumer Flow
```
Landing page: type concern → "Analyse →"
→ FreeAssessmentModal opens
→ POST /api/capadex/concern/analyze (rule engine)
→ 3 clarification questions
→ Intelligence preview (mirror + teaser)
→ POST /api/capadex/session/start (CAP_CUR)
→ Questions (6–10 items from SDI or short assessment bank)
→ POST /api/capadex/session/:id/complete
→ Score + subdomain chart displayed
→ POST /api/capadex/auth/register (email + password)
→ OTP verify → email backfilled to session
→ GET /api/capadex/report/:session_id
→ Full report shown + optional email
→ Stages Insight → Growth → Mastery (progressive unlock)
→ CSI score computed after each stage
```

### Competency Assessment Flow (Campus/Enterprise)
```
Institution admin creates competency assessment
→ Students/candidates receive link
→ GET /api/competency/assessment/start
→ POST /api/competency/assessment/submit
→ Score computed against role norms
→ Gap analysis and career stage report generated
→ Institution sees cohort analytics
```

---

*MetryxOne Platform Documentation — May 2026 | Confidential*
