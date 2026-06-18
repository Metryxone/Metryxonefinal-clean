# Career Builder — Comprehensive System Document
**MetryxOne Behavioral Intelligence Platform**
*Version 1.1 — May 2026 (Phase 2–5 Intelligence Tabs)*

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Module Map](#2-module-map)
3. [Employability Index™ (EI)](#3-employability-index-ei)
4. [Career Intelligence Engine](#4-career-intelligence-engine)
5. [Profile & Resume Studio](#5-profile--resume-studio)
6. [Future Map](#6-future-map)
7. [Individual Development Plan (IDP)](#7-individual-development-plan-idp)
8. [Recruiter Visibility](#8-recruiter-visibility)
9. [Job Tracker](#9-job-tracker)
10. [Interview Prep](#10-interview-prep)
11. [Learning Hub](#11-learning-hub)
12. [Career Pathways](#12-career-pathways)
13. [Goals](#13-goals)
14. [Fresher Hub](#14-fresher-hub)
15. [AI Simulations](#15-ai-simulations)
16. [Market Intelligence](#16-market-intelligence)
17. [Career Velocity](#17-career-velocity)
18. [Workforce Intel](#18-workforce-intel)
19. [Data Structures & Types](#19-data-structures--types)
20. [API Reference](#20-api-reference)
21. [Frontend Architecture](#21-frontend-architecture)
22. [Defensive Rendering Patterns](#22-defensive-rendering-patterns)

---

## 1. Product Overview

**Career Builder** is MetryxOne's end-to-end career management OS for job seekers, students, and professionals. It combines a structured behavioral intelligence layer with practical career execution tools — giving users a single place to build their profile, discover where they fit, close competency gaps, and track their path to being hire-ready.

### What it does

| Capability | Description |
|---|---|
| **Employability Scoring** | Deterministic 0–100 score showing job-readiness |
| **Future Role Discovery** | Market-demand-weighted recommendations for next roles |
| **Fitment Analysis** | Skill + competency + experience match against any role |
| **IDP Generation** | Prioritised intervention plan to close the biggest gaps fastest |
| **Resume Studio** | CV parsing, structured profile builder, and export |
| **Recruiter Visibility** | Score and tips to maximise discovery by hiring teams |
| **Job Tracker** | Kanban-style pipeline for all active applications |
| **Interview Prep** | Role-specific question banks with coaching hints |
| **Learning Hub** | Curated courses mapped to skills and competency gaps |
| **Career Pathways** | Progression maps with salary benchmarks for 5 major domains |
| **Fresher Hub** | Specialised toolset for entry-level and campus candidates |
| **AI Simulations** *(Phase 2)* | Live behavioural scenario library with signal capture |
| **Market Intelligence** *(Phase 3)* | Live benchmarks, career genome detection, success patterns |
| **Career Velocity** *(Phase 4)* | Growth velocity, role trajectory & behavioural memory snapshots |
| **Workforce Intel** *(Phase 5)* | Macro labor signals, AI disruption, predictive 36-mo forecasts |

### Design principle

> All scores derive from the user's actual profile + the curated market catalog. No randomness, no placeholder data — every number is reproducible from the same inputs.

---

## 2. Module Map

The Career Builder is a single-page application at `/career-builder` with 19 tabs grouped into five zones.

### Tab structure

| Zone | Tab | ID | Purpose |
|---|---|---|---|
| Overview | Dashboard | `dashboard` | EI gauge, today's plan, top role recommendations |
| Build | My Profile | `profile` | Personal info, experience, education, skills |
| Build | Resume Studio | `resume` | CV upload/parse, profile import, export |
| Build | Skills Lab | `skills` | Technical + soft skill management, benchmark compare |
| Assess | Competency Assessment | `assessment` | Self-assessment against 25 competency domains |
| Assess | Future Map | `future-map` | Top 6 future role recommendations with ETA |
| Assess | Career Pathways | `pathways` | Staged progression maps for 5 career domains |
| Plan | Goals | `goals` | Personal career goal tracker |
| Plan | Development Plan | `development` | IDP — prioritised intervention list for target role |
| Plan | Learning Hub | `learning` | Curated course catalogue filtered by skill gaps |
| Execute | Job Tracker | `jobs` | Full application pipeline (Wishlist → Accepted) |
| Execute | Interview Prep | `interview` | Behavioural, technical, situational, role-specific Q&A |
| Execute | Recruiter Visibility | `visibility` | Visibility score + actionable improvement tips |
| Execute | Mentor Connect | `mentors` | Mentor matching (coming soon) |
| Special | Fresher Hub | `fresher-hub` | Campus & entry-level specialised tools |
| Intelligence *(Phase 2)* | AI Simulations | `simulations` | Behavioural scenario library + signal capture |
| Intelligence *(Phase 3)* | Market Intel | `market-intel` | Live benchmark, career genome, success patterns |
| Intelligence *(Phase 4)* | Career Velocity | `velocity` | Velocity score, role trajectory, behavioural memory |
| Intelligence *(Phase 5)* | Workforce Intel | `workforce` | Macro pulse, skill evolution, 36-mo career forecast |

---

## 3. Employability Index™ (EI)

The Employability Index is the core metric — a 0–100 score that quantifies a user's overall job-readiness at a given moment.

### Score bands

| Score | Band label | Colour |
|---|---|---|
| 80–100 | Excellent | `#2A9D8F` (green) |
| 65–79 | Strong | `#2A9D8F` (green) |
| 50–64 | Good | `#4ECDC4` (teal) |
| 35–49 | Developing | `#f4a261` (orange) |
| 0–34 | Starter | `#f4a261` (orange) |

### How EI is calculated

EI is derived from multiple weighted profile signals:

```
EI = f(
  profile_completeness,   // fills the "ceiling" for other signals
  skill_depth,            // number + relevance of technical/soft skills
  experience_years,       // total years across all roles
  competency_levels,      // 0-5 inferred per-domain from skills + experience
  certifications,         // cloud/security/process certs
  projects,               // personal + professional projects
  assessment_scores       // CAPADEX + competency self-assessment
)
```

The `competencyProfile.completeness` field (0–100%) directly scales the ceiling for competency scores: `ceil = min(5, 1 + floor(completeness / 22))`. A 100% complete profile unlocks a ceiling of 5 on all competency dimensions.

### EI Gauge

Rendered as a circular SVG arc in the Dashboard tab. The filled arc animates over 1.2s on load. The centre text shows the numeric score and `/100`. The arc colour follows the band logic above.

---

## 4. Career Intelligence Engine

Located in `frontend/src/lib/careerIntelligence.ts`. All functions are pure and deterministic — given the same `CareerProfile` and `MarketCatalog`, they always return the same output.

### 4.1 Skill normalisation (`getUserSkillSet`)

Normalises all technical + soft skills into a lookup set:
- Lowercased, trimmed, punctuation-stripped
- Multi-word skills are also split into individual tokens for fuzzy matching (e.g. `"Node.js"` → `"nodejs"` + `"node"` + `"js"`)

### 4.2 Competency inference (`inferCompetencyLevels`)

Maps user profile signals to 0–5 proficiency levels across **25 competency domains** using keyword-regex rules with per-rule weights, plus volume bump rules.

#### Competency domains

| ID | Label | Key signals |
|---|---|---|
| `programming` | Programming | JS, Python, Java, Go, React, Node… |
| `systems-design` | Systems Design | Microservices, distributed, Kafka, gRPC… |
| `cloud` | Cloud & DevOps | AWS, GCP, Docker, Kubernetes, Terraform… |
| `data-engineering` | Data Engineering | Airflow, Spark, dbt, Snowflake, ETL… |
| `security` | Security | IAM, penetration, SIEM, OWASP… |
| `data-analysis` | Data Analysis | SQL, Excel, Tableau, PowerBI, Pandas… |
| `statistics` | ML / Statistics | ML, TensorFlow, PyTorch, LLM, NLP… |
| `business-acumen` | Business Acumen | Strategy, market, OKR, pricing… |
| `research` | User Research | Interviews, usability, Dovetail… |
| `writing` | Writing | Copywriting, technical writing… |
| `presentation` | Presentation | Public speaking, pitching… |
| `stakeholder-mgmt` | Stakeholder Management | Client, executive, vendor… |
| `people-mgmt` | People Management | Leadership, team-lead, mentor… |
| `strategy` | Strategy | Vision, roadmap, market-strategy… |
| `mentoring` | Mentoring | Coaching, onboarding… |
| `design-thinking` | Design Thinking | Journey-mapping, wireframing, prototyping… |
| `visual-design` | Visual Design | Figma, Adobe XD, design-systems… |
| `storytelling` | Storytelling | Narrative, case-study… |
| `project-mgmt` | Project Management | PMP, Agile, Scrum, Jira… |
| `process` | Process & Operations | Six Sigma, Lean, SLA… |
| `negotiation` | Negotiation | Closing, sales, deal… |
| `collaboration` | Collaboration | Soft skills, teamwork, experience years |

#### Volume bumps (experience-based)

| Condition | Bump |
|---|---|
| ≥ 3 technical skills | `programming` ≥ 2 |
| ≥ 6 technical skills | `programming` ≥ 3 |
| ≥ 10 technical skills | `programming` ≥ 4 |
| ≥ 1 certification | `cloud` ≥ 2 |
| ≥ 3 certifications | `process` ≥ 3 |
| ≥ 1 project | `design-thinking` ≥ 1 |
| ≥ 3 projects | `programming` ≥ 3 |
| ≥ 2 years experience | `collaboration` ≥ 2 |
| ≥ 4 years experience | `people-mgmt` ≥ 2, `stakeholder-mgmt` ≥ 3 |
| ≥ 7 years experience | `strategy` ≥ 3, `mentoring` ≥ 3 |
| ≥ 3 soft skills | `collaboration` ≥ 3 |

### 4.3 Fitment analysis (`computeFitment`)

Returns a `FitmentBreakdown` comparing the user's profile against a `MarketRole`.

```
fitScore = skillMatch × 0.45 + competencyMatch × 0.40 + experienceMatch × 0.15
```

| Dimension | Formula | Description |
|---|---|---|
| `skillMatch` | `matched / total role skills × 100` | % of the role's critical skills the user has |
| `competencyMatch` | `Σ min(actual, required) / Σ required × 100` | Weighted competency coverage |
| `experienceMatch` | `min(100, userYears / expectedYears × 100)` | Years vs. max required level |
| `hireProbability` | Logistic of `(fitScore − 55)/14 + (completeness − 50)/60` | Probability of passing initial screen |

The top missing competency (`topGapCompetency`) is identified as the highest positive gap between required and actual level.

### 4.4 Switchability (`switchability`)

Calculates how easily a user can move from their current role to a target role:

```
switchability = skillOverlap × 0.45 + competencyOverlap × 0.35 + familyMatch × 0.10 + adjacency × 0.10
```

Returns 50 for unknown current role, 100 for same role.

### 4.5 Future role recommendations (`recommendFutureRoles`)

Scores every role in the Market Catalog and returns the top N:

```
roleScore = demandScore × 0.30 + growth36mo × 0.20 + switchability × 0.25 + fitScore × 0.20 + (100 − automationRisk) × 0.05
```

**ETA formula**: `etaMonths = max(1, round((max(0, 80 − fitScore) / 4) / 4))` — assumes ~4 EI points of progress per week of focused effort.

### 4.6 IDP construction (`buildIDP`)

Builds a prioritised up-to-7-item Individual Development Plan for a target role:

1. Compute competency gaps (required − actual), filter gaps > 0.2, sort descending
2. For each gap, find the highest-ROI intervention: `eiLift / hours` — favour fast wins
3. Pull top 2 interventions per gap to ensure diversity
4. If < 7 items, pad with highest `eiLift` generic interventions from the catalog
5. Each IDP item carries the gap it closes (`gapClosed`) and its rank (1–7)

### 4.7 Visibility scoring (`computeVisibility`)

Calculates how discoverable the user is to recruiters on a 0–100 scale.

| Driver | Max points | Tip shown when |
|---|---|---|
| Profile completeness | 20 | < 80% |
| Employability Index | 25 | EI < 60 |
| Skills depth | 15 | < 5 technical skills |
| Experience signal | 15 | 0 experience entries |
| Credentials & projects | 10 | < 2 combined |
| External profile linked | 5 | No LinkedIn URL |
| Professional summary | 5 | No summary |
| Open to opportunities | 5 | Toggle is off |
| **Total** | **100** | |

**Visibility bands**: hidden (< 25) → low (25–44) → medium (45–64) → high (65–84) → top (≥ 85)

### 4.8 Recruiter view estimate (`estimateRecruiterViews`)

A deterministic synthetic view count until the recruiter-side ships:

```
base = round(visibility × 0.18 + eiScore × 0.08 + techCount × 0.6 + expCount × 1.2)
trend = 'up' if completeness ≥ 70, 'flat' if ≥ 40, else 'down'
```

Returns `{ thisWeek: number, trend: 'up'|'down'|'flat' }`.

---

## 5. Profile & Resume Studio

### My Profile tab

Structured into sections:

| Section | Fields |
|---|---|
| Personal | Name, location, phone, email, LinkedIn, GitHub, website |
| Professional Summary | Free-text bio (2-line recommended) |
| Experience | Title, company, years, current flag |
| Education | Institution, degree, year |
| Certifications | Name, issuer, year |
| Projects | Title, description, tech stack |
| Skills | Technical (chips) + Soft (chips) |
| Languages | Language + proficiency level |

Profile completeness is auto-computed from section fill and stored in `competencyProfile.completeness` (0–100%). This directly scales the EI ceiling.

### Resume Studio tab

Supports two entry modes:

**CV Upload + Parse**
- Accepts PDF and DOCX files
- `POST /api/cv/parse` sends file to the server parser
- `pdf-parse` (PDF) and `mammoth` (DOCX) libraries extract raw text
- Regex + keyword matching populates structured profile fields
- Parsed data is previewed before save

**Manual Entry**
- `POST /api/cv/init-profile` creates a blank profile
- User fills sections directly in the UI
- `PUT /api/cv/profile/:userId` saves each section update

### Skills Lab tab

- Technical and soft skill chip management
- Industry benchmark comparison: user skill vs. benchmark percentage
- Skills without a benchmark entry show without a bar

**Benchmark data (sample)**:

| Skill | Industry benchmark |
|---|---|
| Communication | 80% |
| Problem Solving | 75% |
| Python | 72% |
| Git | 70% |
| SQL | 65% |
| JavaScript | 68% |
| Data Analysis | 62% |
| React | 60% |
| Node.js | 55% |
| Leadership | 55% |
| Docker | 42% |

---

## 6. Future Map

Shows the top 6 future role recommendations for the user's profile.

### FutureRoleRec card

Each card displays:
- Role title and family
- **Composite score** (0–100) — the ranking score
- **Fit score** — fitment against that role (0–100)
- **Switchability** — ease of transition from current role (0–100)
- **ETA** — estimated months to be hire-ready (assumes focused effort)
- **Demand score** — market demand signal from the catalog
- **Automation risk** — % risk of role automation
- **36-month growth** — projected role growth over 3 years
- Top matched skills (up to 8)
- Top missing skills (up to 5)
- Top gap competency (largest single competency shortfall)
- Hire probability %

### Target role selection

Users can pin any future role as their **target role** (persisted in `localStorage` key `mx-career-target-role`). The IDP and Development Plan tab then compute interventions for that specific target.

---

## 7. Individual Development Plan (IDP)

### Development Plan tab

Shows up to 7 prioritised interventions for the user's target role. Each item:

| Field | Description |
|---|---|
| `rank` | Priority position 1–7 |
| `title` | Intervention name |
| `type` | `course` / `project` / `certification` / `practice` |
| `hours` | Estimated time investment |
| `eiLift` | Expected EI score increase on completion |
| `gapClosed.competencyLabel` | Which competency gap this closes |
| `gapClosed.gap` | The gap magnitude it targets |

**ROI sort**: Interventions are ranked by `eiLift / hours` — the fastest path to the largest score increase is presented first.

### IDP progress tracking

Completion state is persisted per-intervention in `localStorage` key `mx-career-idp-progress` as:

```json
{ "intervention_id": "in-progress" | "done" }
```

---

## 8. Recruiter Visibility

### Visibility tab

Displays:
- Large visibility score (0–100) with band label and colour
- **Estimated recruiter views this week** with trend arrow
- Breakdown bar chart of all 8 drivers (points scored / max points)
- Actionable tip for each driver that is not maxed out
- "Open to opportunities" toggle (persisted in `localStorage` key `mx-career-visibility-open`)

### Visibility bands and colours

| Band | Score | Meaning |
|---|---|---|
| hidden | 0–24 | Not appearing in recruiter searches |
| low | 25–44 | Very limited discovery |
| medium | 45–64 | Some visibility — room to grow |
| high | 65–84 | Strong discovery signal |
| top | 85–100 | Maximum recruiter visibility |

---

## 9. Job Tracker

Full Kanban-style pipeline for tracking every job application.

### Pipeline stages

```
Wishlist → Applied → Screening → Interview → Assessment → Offer → Accepted
                                                                         ↓
                                                                    Rejected
```

### Stage colours

| Stage | Colour |
|---|---|
| Wishlist | `#94a3b8` (slate) |
| Applied | `#344E86` (navy) |
| Screening | `#8b5cf6` (purple) |
| Interview | `#4ECDC4` (teal) |
| Assessment | `#f4a261` (orange) |
| Offer | `#2A9D8F` (green) |
| Accepted | `#16a34a` (dark green) |
| Rejected | `#e63946` (red) |

### Job application fields (`JobApp`)

| Field | Description |
|---|---|
| `company` | Company name |
| `role` | Job title |
| `location` | Office location |
| `type` | Full-time / Part-time / Contract / Remote |
| `salary` | Salary range |
| `source` | Where found (LinkedIn, Naukri, referral…) |
| `status` | Current pipeline stage |
| `appliedDate` | Date applied |
| `deadline` | Application or offer deadline |
| `notes` | Freeform notes |
| `contactName` / `contactEmail` | Recruiter contact |
| `url` | Job posting URL |
| `matchScore` | Auto-computed fitment score (0–100) |

### Job fitment (`rankJobsForUser`)

When a tracked job's role title matches a role in the Market Catalog, `computeFitment()` runs against it and returns a ranked list sorted by `fitScore` descending. Jobs without a catalog match use the manually entered `matchScore`.

---

## 10. Interview Prep

A question bank with coaching hints, organised into four categories.

### Question categories

| Category | Count | Focus |
|---|---|---|
| Behavioral | 5 | STAR method, past behaviour |
| Technical | 5 | Problem-solving, debugging, system design |
| Situational | 5 | Hypothetical workplace scenarios |
| Role-Specific | 5 | Career goals, company fit, top accomplishments |

### Each question card shows

- The question text
- A coaching hint (methodology to use, what to emphasise)

Users can navigate through questions per category and mark each as practised. Questions are static but can be extended per-role in a future iteration.

---

## 11. Learning Hub

Curated course recommendations with skill tagging.

### Course catalogue (sample)

| Course | Provider | Duration | Level | Skill | Tag |
|---|---|---|---|---|---|
| Python for Data Science & AI | Coursera | 8 weeks | Intermediate | Python | In-Demand |
| SQL Bootcamp: Zero to Hero | Udemy | 5 weeks | Beginner | SQL | Quick Win |
| React — The Complete Guide | Udemy | 10 weeks | Intermediate | React | Trending |
| Machine Learning Specialization | Coursera | 3 months | Advanced | Machine Learning | High Value |
| Docker & Kubernetes Complete Guide | Udemy | 6 weeks | Intermediate | Docker | DevOps |
| Communication Skills for Professionals | LinkedIn Learning | 2 weeks | Beginner | Communication | Soft Skill |
| Data Analysis with Pandas & NumPy | DataCamp | 4 weeks | Intermediate | Data Analysis | Analytics |
| Leadership Fundamentals | edX | 6 weeks | Beginner | Leadership | Career Growth |
| AWS Certified Cloud Practitioner | AWS Training | 6 weeks | Beginner | Cloud | Certification |
| Agile & Scrum Masterclass | Udemy | 3 weeks | Beginner | Agile | Project Mgmt |

Courses are filterable by level, tag, and skill. In a future iteration, the catalogue will be dynamically filtered to show only courses that close the user's current IDP gaps.

---

## 12. Career Pathways

Visual staged progression maps for five career domains, each with salary benchmarks and skill requirements per level.

### Domains

| Domain | Levels |
|---|---|
| Software Engineering | Junior Dev → Software Dev → Senior Dev → Tech Lead → Engineering Manager |
| Data Science / AI | Data Analyst → Data Scientist → Senior DS → ML Engineer → Head of AI |
| Product Management | Associate PM → PM → Senior PM → Group/Principal PM → VP/Director of Product |
| Design / UX | Junior Designer → UX/Product Designer → Senior Designer → Design Lead → Head of Design |
| Marketing / Growth | Marketing Executive → Marketing Manager → Senior Manager → Director → VP/CMO |

### Each pathway level shows

| Field | Description |
|---|---|
| Role title | e.g. "Senior Developer" |
| Level | 1–5 (junior → executive) |
| Years experience | e.g. "5–8 yrs" |
| Avg salary | e.g. "₹18–35 LPA" |
| Required skills | 4–5 key skills for that level |
| Next roles | Where this level leads |

---

## 13. Goals

Personal goal tracker with category and priority tagging.

### Goal categories

`Skill` · `Certification` · `Role` · `Network` · `Other`

### Goal priorities

`High` · `Medium` · `Low`

### Goal fields (`CareerGoal`)

| Field | Description |
|---|---|
| `title` | Goal headline |
| `description` | Detail / context |
| `category` | One of the five categories |
| `targetDate` | Deadline |
| `priority` | High / Medium / Low |
| `completed` | Boolean toggle |

Goals are stored server-side via the career profile API and displayed grouped by completion status. Completed goals are visually dimmed and struck-through.

---

## 14. Fresher Hub

A specialised tab for campus recruits and entry-level candidates (0–2 years experience).

The `FresherHubTab` component (imported from `frontend/src/pages/career/FresherHubTab.tsx`) provides:

- **Campus placement readiness** checklist
- **Aptitude & reasoning** practice questions
- **Resume templates** for freshers (no experience gap)
- **First-job search** guidance
- **Internship tracker**
- **Placement prep** timelines and company-specific tips

Fresher Hub is accessible to all users but is specifically tuned for profiles with 0–2 years of experience and student personas.

---

## 15. AI Simulations

**Component**: `frontend/src/pages/career/SimulationsTab.tsx`
**Tab ID**: `simulations` | **Phase**: 2

A library of behavioural scenarios users can run to capture live decision-making signals. Each scenario surfaces signal bars (e.g., empathy, decisiveness, analytical depth) that feed into the BIOS signal store.

### Sub-components

| Component | Role |
|---|---|
| `ScenarioCard` | Renders a single scenario with `groupType` prop (passed from catalog group — individual scenarios do not carry their own `type`) |
| `SignalBar` | Horizontal score bar (0–100) for a captured signal dimension |

### Key constraint
Scenarios live inside catalog groups. The group provides `groupType` (e.g., `"crisis-management"`, `"stakeholder-negotiation"`); each scenario inherits this via prop — never read `s.type` directly on a scenario.

---

## 16. Market Intelligence

**Component**: `frontend/src/pages/career/MarketIntelTab.tsx`
**Tab ID**: `market-intel` | **Phase**: 3

Three sub-sections, each backed by a live backend service:

### 16.1 Benchmark Section
- **APIs**: `GET /api/career/benchmark/market` · `POST /api/career/benchmark/skills` (body: `{ profile }`)
- **Notes**: Skills endpoint returns `400 "profile is required"` when no CV is uploaded — handled as empty state (non-fatal).

### 16.2 Genome Section (Career Genome Detection)
- **APIs**: `POST /api/career/genome/detect-path` · `POST /api/career/genome/future-map` · `POST /api/career/genome/gap-sequence`
- **Returned shape gotchas**: `priorityGaps` and `hotCompetencies` are arrays of **objects** `{id, label, …}` — never plain strings. Normalised in render with `typeof c === 'string' ? c : c.label ?? c.id`.

### 16.3 Success Section (Pattern Matching)
- **APIs**: `POST /api/career/success/analyze` · `POST /api/career/success/competency-pattern`
- **Returned shape gotchas**:
  - `cluster` is an object `{id, label, description, signature[], peakRoleFamilies[], earning, demand, fit}` — render `.label`
  - `alternativeClusters[n].cluster` is also a full cluster object
  - `leadershipMaturity.level` is a **number** (1–5); the label is in `leadershipMaturity.label`
  - `competencyPattern` is an **array** (not a plain object) — guard with `Array.isArray()`

---

## 17. Career Velocity

**Component**: `frontend/src/pages/career/CareerVelocityTab.tsx`
**Tab ID**: `velocity` | **Phase**: 4

Three sub-sections rendered top-to-bottom:

### 17.1 Velocity Section
- **APIs**: `POST /api/career/velocity/compute` · `POST /api/career/velocity/projection`
- **Sub-components**: `VelocityGauge` (radial 0–100), `MiniSparkline` (12-month projection)
- **Response fields**: `overallVelocity`, `velocityBand` (slowing/moderate/accelerating), `metrics[]`, `bottlenecks[]`, `accelerators[]`, `momentumDrivers[]`, `dragFactors[]`, `coachingInsight`, `nextFocusArea`

### 17.2 Trajectory Section
- **APIs**: `POST /api/career/trajectory/compute` · `POST /api/career/trajectory/probability`
- **Response shape (critical)**:
  - `forecastedRole12mo` / `forecastedRole36mo` are **full role objects** `{roleId, title, family, switchabilityScore, adjacencyScore, etaMonths, demandScore, automationRisk, futureRelevance, salaryP50, actionable, keyGaps[]}` — render `.title`
  - `adjacentRoles[]` items use **`roleId`** as the identifier (not `id`) and **`switchabilityScore`** (not `switchability`)
  - `trajectorySteps[]` items have `predictedRoleTitle`, `label`, `confidence`, `keyMilestones[]`
- **Probability call**: requires `competencyLevels` (from `inferCompetencyLevels(profile)`) + `eiScore` + `targetRoleId`

### 17.3 Memory Section (Behavioural Memory)
- **APIs**: `GET /api/career/memory/summary?userId=…` · `GET /api/career/memory/evolution?userId=…` · `POST /api/career/memory/snapshot` (body: `{ userId, profile }`)
- Captures longitudinal snapshots of profile evolution; renders timeline + delta summary.

---

## 18. Workforce Intel

**Component**: `frontend/src/pages/career/WorkforceTab.tsx`
**Tab ID**: `workforce` | **Phase**: 5

Internal sub-tab switcher (`SubTab` union type: `'pulse' | 'skills' | 'forecast'`):

### 18.1 Market Pulse (`PulseSection`)
- **APIs**: `GET /api/career/workforce/signals` · `…/hot-roles` · `…/emerging-roles` · `…/ai-disruption` · `…/labor-trends`
- **Sub-component**: `RiskBadge` (level → coloured tag)

### 18.2 Skill Evolution (`SkillEvolutionSection`)
- **APIs**: `GET /api/career/workforce/skill-evolution` · `…/safe-roles` · `…/risk-flags`

### 18.3 Career Forecast (`ForecastSection`)
- **APIs**: `GET /api/career/workforce/predictive/skill-demand` · `…/predictive/role-clusters`
- **Skill demand response shape**:
  - `forecasts[]` items: `{skill, status, currentDemand, forecast12mo, forecast24mo, forecast36mo, trajectory, urgency, aiImpact}` — **no** `category`, **no** `demandIn36mo`, **no** `trend` field
  - Render uses `forecast36mo` for the 36-mo column
  - Trend arrow logic: `status === 'accelerating' | 'emerging'` → up; `status === 'plateauing' | 'declining'` → down
  - `criticalUpskill[]` / `watchList[]` / `deprioritise[]` are arrays of the **same object shape** (not strings) — render `.skill`
- **Role clusters response shape**:
  - `clusters[]` items: `{id, name, urgency, roles[], skills[], hiring}` — **no** `description`, **no** `keySkills`
  - Render falls back through `c.keySkills ?? c.skills ?? c.roles` for chip list

---

## 19. Data Structures & Types

### `CareerProfile`

```typescript
interface CareerProfile {
  personal?: {
    name?: string;
    location?: string;
    linkedin?: string;
    github?: string;
  };
  summary?: string;
  experience?: {
    title?: string;
    company?: string;
    years?: number;
    current?: boolean;
  }[];
  skills?: {
    technical?: string[];
    soft?: string[];
  };
  education?: unknown[];
  certifications?: unknown[];
  projects?: unknown[];
  competencyProfile?: {
    completeness?: number;   // 0–100
  };
}
```

### `JobApp`

```typescript
interface JobApp {
  _id: string;
  userId: string;
  company: string;
  role: string;
  location: string;
  type: string;
  salary: string;
  source: string;
  status: 'Wishlist'|'Applied'|'Screening'|'Interview'|'Assessment'|'Offer'|'Accepted'|'Rejected';
  appliedDate: string;
  deadline: string;
  notes: string;
  contactName: string;
  contactEmail: string;
  url: string;
  matchScore: number;
  createdAt: string;
}
```

### `CareerGoal`

```typescript
interface CareerGoal {
  _id: string;
  userId: string;
  title: string;
  description: string;
  category: 'Skill'|'Certification'|'Role'|'Network'|'Other';
  targetDate: string;
  completed: boolean;
  priority: 'High'|'Medium'|'Low';
  createdAt: string;
}
```

### `FitmentBreakdown`

```typescript
interface FitmentBreakdown {
  fitScore: number;           // 0–100 composite
  skillMatch: number;         // 0–100 keyword overlap
  competencyMatch: number;    // 0–100 level coverage
  experienceMatch: number;    // 0–100 years vs. expectation
  hireProbability: number;    // 0–100 logistic blend
  matchedSkills: string[];    // up to 8
  missingSkills: string[];    // top 5 missing critical skills
  topGapCompetency?: {
    id: string;
    label: string;
    gap: number;
  };
}
```

### `FutureRoleRec`

```typescript
interface FutureRoleRec {
  role: MarketRole;
  fitment: FitmentBreakdown;
  switch: number;         // 0–100 switchability
  etaMonths: number;      // months to hire-ready
  score: number;          // composite ranking score
}
```

### `VisibilityBreakdown`

```typescript
interface VisibilityBreakdown {
  score: number;
  band: 'hidden'|'low'|'medium'|'high'|'top';
  drivers: {
    label: string;
    pts: number;
    max: number;
    tip?: string;    // shown only when not maxed out
  }[];
}
```

### `IDPItem`

```typescript
interface IDPItem extends Intervention {
  gapClosed: {
    competencyId: string;
    competencyLabel: string;
    gap: number;
  };
  rank: number;  // 1–7
}
```

### `MarketRole` (from catalog)

```typescript
interface MarketRole {
  id: string;
  title: string;
  family: string;
  skills: string[];
  competencies: { id: string; required: number }[];
  adjacentRoles: string[];
  demandScore: number;      // 0–100
  growth36mo: number;       // % growth over 36 months
  automationRisk: number;   // 0–100
}
```

---

## 20. API Reference

### CV / Profile endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/cv/parse` | Parse PDF/DOCX CV file and return structured profile fields |
| `GET` | `/api/cv/profile/:userId` | Retrieve saved career profile |
| `PUT` | `/api/cv/profile/:userId` | Update profile section and recalculate completeness |
| `POST` | `/api/cv/init-profile` | Create blank profile for manual entry |
| `GET` | `/api/user` | Verify JWT session and return user metadata |

### Job application endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/jobs` | List all job applications for the authenticated user |
| `POST` | `/api/jobs` | Create a new job application |
| `PUT` | `/api/jobs/:id` | Update stage, notes, or any application field |
| `DELETE` | `/api/jobs/:id` | Remove a job application |

### Goal endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/goals` | List all career goals for the user |
| `POST` | `/api/goals` | Create a career goal |
| `PUT` | `/api/goals/:id` | Update goal details or mark completed |
| `DELETE` | `/api/goals/:id` | Delete a goal |

### CV parse request/response

**Request** (`POST /api/cv/parse`):
```
Content-Type: multipart/form-data
file: [PDF or DOCX binary]
```

**Response**:
```json
{
  "personal": { "name": "...", "email": "..." },
  "experience": [{ "title": "...", "company": "...", "years": 3 }],
  "education": [...],
  "skills": { "technical": [...], "soft": [...] },
  "certifications": [...],
  "summary": "..."
}
```

---

### Career Intelligence endpoints *(Phases 2–5)*

All routes are prefixed with `/api/career`. The `careerFetch(method, path, body?)` helper in the frontend handles auth + JSON.

| Method | Path | Tab | Purpose |
|---|---|---|---|
| `GET` | `/benchmark/market` | Market Intel | Global benchmark snapshot |
| `POST` | `/benchmark/skills` | Market Intel | Per-skill benchmark vs profile (400 if no profile) |
| `POST` | `/genome/detect-path` | Market Intel | Career genome path detection |
| `POST` | `/genome/future-map` | Market Intel | Genome → future-role map |
| `POST` | `/genome/gap-sequence` | Market Intel | Priority gap ordering |
| `POST` | `/success/analyze` | Market Intel | Cluster + leadership maturity + readiness |
| `POST` | `/success/competency-pattern` | Market Intel | Future-alignment + success probability |
| `POST` | `/velocity/compute` | Career Velocity | Overall velocity + metrics + drivers/drags |
| `POST` | `/velocity/projection` | Career Velocity | 12-month EI projection points |
| `POST` | `/trajectory/compute` | Career Velocity | Adjacent roles + trajectory steps + 12/36-mo forecasts |
| `POST` | `/trajectory/probability` | Career Velocity | Per-role transition probability check |
| `GET` | `/memory/summary?userId=` | Career Velocity | Behavioural memory snapshot summary |
| `GET` | `/memory/evolution?userId=` | Career Velocity | Longitudinal evolution timeline |
| `POST` | `/memory/snapshot` | Career Velocity | Capture new snapshot for `{userId, profile}` |
| `GET` | `/workforce/signals` | Workforce | Macro labor signals |
| `GET` | `/workforce/hot-roles` | Workforce | Currently hot roles |
| `GET` | `/workforce/emerging-roles` | Workforce | Roles entering market |
| `GET` | `/workforce/ai-disruption` | Workforce | AI-driven disruption index |
| `GET` | `/workforce/labor-trends` | Workforce | Macro labor trend list |
| `GET` | `/workforce/skill-evolution` | Workforce | Skill rise/fall trajectory |
| `GET` | `/workforce/safe-roles` | Workforce | Low-disruption-risk roles |
| `GET` | `/workforce/risk-flags` | Workforce | Roles flagged for risk |
| `GET` | `/workforce/predictive/skill-demand` | Workforce | 12/24/36-mo skill demand forecast |
| `GET` | `/workforce/predictive/role-clusters` | Workforce | Convergent role clusters with hiring guidance |

---

## 21. Frontend Architecture

### Entry point

`/career-builder` route renders `CareerBuilderPage.tsx` (~4,584 lines). This is a self-contained SPA component that orchestrates 19 tabs; the four new Intelligence tabs (Phase 2–5) are extracted into dedicated files under `frontend/src/pages/career/` and imported as components.

### Authentication

JWT token stored in `localStorage` as `metryx_token`. The `getUser()` helper decodes the payload from the token. The `authHeader()` helper returns `{ Authorization: 'Bearer <token>' }` for API calls.

### Client-side persistence keys

| Key | Value stored |
|---|---|
| `metryx_token` | JWT auth token |
| `mx-career-target-role` | Selected target role ID |
| `mx-career-visibility-open` | Boolean — open to opportunities toggle |
| `mx-career-idp-progress` | `{ [interventionId]: 'in-progress' | 'done' }` |

### UI components (local)

| Component | Description |
|---|---|
| `EIGauge` | Animated SVG arc showing EI score |
| `SkillBar` | Horizontal bar with label, percentage, and fill animation |
| `Chip` | Dismissible tag chip with brand colour |
| `SectionCard` | White card container with titled header and optional action slot |

### Data catalogs

| File | Contents |
|---|---|
| `frontend/src/data/marketCatalog.ts` | `MARKET_CATALOG` — all indexed market roles with skills, competencies, demand/growth/automation signals |
| `frontend/src/data/interventionCatalog.ts` | `INTERVENTIONS` — curated intervention library with `eiLift` and `hours` for IDP construction |

### Brand colours

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#344E86` | Navy — primary actions, headers |
| `accent` | `#4ECDC4` | Teal — secondary highlights |
| `green` | `#2A9D8F` | Strong/Excellent EI, positive signals |
| `red` | `#e63946` | Rejected stage, risk indicators |
| `orange` | `#f4a261` | Developing/Starter EI, warnings |

The Phase 2–5 Intelligence tabs each redeclare `BRAND` inline as a local constant (same five hex values) to stay independent of the parent page scope.

---

## 22. Defensive Rendering Patterns

The Phase 2–5 backend services return rich object graphs where earlier UI assumed primitives. The following patterns are now standard across all new tabs and **must be applied whenever a new API field is rendered**.

### 22.1 Object-or-string normaliser
Used for tags/chips that may come back as `string` or `{id, label}`:
```ts
const name = typeof item === 'string' ? item : (item?.label ?? item?.skill ?? item?.id ?? '');
```

### 22.2 Object-or-string with `typeof` guard inline
Used when an object would otherwise render directly as a React child (root cause of "Objects are not valid as a React child"):
```tsx
{typeof traj.forecastedRole12mo === 'object'
  ? (traj.forecastedRole12mo?.title ?? '—')
  : (traj.forecastedRole12mo ?? '—')}
```

### 22.3 Field-name compatibility chain
Backend field names can drift between phases. Always chain with `??`:
```ts
const demand36 = f.forecast36mo ?? f.demandIn36mo ?? 0;
const roleId = r.roleId ?? r.id ?? r.title;
const switchPct = r.switchabilityScore ?? r.switchability ?? 0;
```

### 22.4 Status-vocabulary mapping
Old code used `trend: 'rising' | 'falling'`; new APIs use `status: 'accelerating' | 'emerging' | 'plateauing' | 'declining'`. Combine both vocabularies:
```ts
const status = f.status ?? f.trend;
const isRising  = status === 'accelerating' || status === 'emerging' || status === 'rising';
const isFalling = status === 'plateauing'   || status === 'declining' || status === 'falling';
```

### 22.5 Array vs scalar guard
`competencyPattern` and similar fields can be either an array of items or a structured object. Guard before mapping:
```tsx
{Array.isArray(data.competencyPattern) && data.competencyPattern.map(...)}
```

### 22.6 Group-level type for catalog items
Scenarios in `SimulationsTab` do **not** carry their own `type`. The group does. Always pass `groupType` as a prop from the parent catalog loop — never call `scenario.type.replace(...)`.

### 22.7 Bug-fix history (Phase 2–5 rollout)

| # | Tab | Symptom | Root cause | Fix |
|---|---|---|---|---|
| 1 | Simulations | `s.type.replace()` on undefined | Scenario didn't carry `type` (group does) | Added `groupType` prop from parent |
| 2 | Market Intel · Genome | `Objects are not valid as React child` | `priorityGaps` / `hotCompetencies` are objects | Normaliser (§22.1) |
| 3 | Market Intel · Success | Same crash | `cluster`, `alternativeClusters[].cluster` are objects; `leadershipMaturity.level` is number; `competencyPattern` is array | Field-access fix + `Array.isArray` guard (§22.5) |
| 4 | Career Velocity · Trajectory | Same crash | `forecastedRole12mo` / `36mo` are role objects; `r.id` should be `r.roleId`; `r.switchability` should be `r.switchabilityScore` | `typeof` guard (§22.2) + field chain (§22.3) |
| 5 | Workforce · Career Forecast | Empty UI / `[object Object]` | `criticalUpskill[]` are objects; `f.category` n/a; `f.demandIn36mo` is `f.forecast36mo`; `f.trend` is `f.status` | Normaliser + field chain + status mapping (§22.1, §22.3, §22.4) |

---

*Document generated from live codebase — MetryxOne Career Builder v1.1, May 2026 (Phase 2–5 Intelligence Tabs)*
