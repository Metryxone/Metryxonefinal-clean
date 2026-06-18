# Institution Dashboard — Comprehensive System Document
**MetryxOne Behavioral Intelligence Platform**
*Version 1.0 — May 2026*

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Dashboard Layout & Sections](#2-dashboard-layout--sections)
3. [Student Management](#3-student-management)
4. [Exam Builder](#4-exam-builder)
5. [Batch Organisation](#5-batch-organisation)
6. [Performance Analytics](#6-performance-analytics)
7. [Behavioural Scoring Engine (SPE)](#7-behavioural-scoring-engine-spe)
8. [LBI Integration](#8-lbi-integration)
9. [AI-Powered Reports](#9-ai-powered-reports)
10. [Role-Based Access](#10-role-based-access)
11. [DPDP Compliance](#11-dpdp-compliance)
12. [Tenants & Subscription Tiers](#12-tenants--subscription-tiers)
13. [Database Schema](#13-database-schema)
14. [API Reference](#14-api-reference)
15. [Frontend Architecture](#15-frontend-architecture)

---

## 1. Product Overview

The **Institution Dashboard** (`UnifiedInstituteDashboard`) is MetryxOne's high-density management and analytics platform for schools, colleges, and enterprises. It enables administrators and teachers to manage student cohorts, build and deploy assessments, monitor performance at scale, and surface behavioural intelligence insights across departments.

### Institution types supported

| Type | Use case |
|---|---|
| School (K-12) | Student monitoring, exam builder, parent coordination |
| College / University | Batch analytics, placement readiness, competency heatmaps |
| Enterprise | Employee development, competency benchmarking, L&D planning |

### Core value

- Single admin interface for the full assessment lifecycle
- Behavioural scoring alongside academic performance
- Competency heatmaps across departments and cohorts
- AI-powered reports with zero manual analysis
- DPDP-compliant with built-in consent management

---

## 2. Dashboard Layout & Sections

### Main component: `UnifiedInstituteDashboard.tsx`

Navigation is managed via local `activeSection` state. The layout uses `InstituteHeader` and `InstituteFooter` for branding and `HelpSystem` for contextual guidance.

### Sections

| Section | Description |
|---|---|
| **Overview** | Top-level stats: total students, exams created, pending enrollments |
| **Student Management** | Student registry, bulk CSV import, enrollment approval |
| **Exam Builder** | Create MCQ / Reflective exams, manage question banks |
| **Batch Organisation** | Group students by year, section, stream, or department |
| **Performance Analytics** | Charts and at-risk student identification |
| **AI Reports** | AI-generated insights from assessment and behavioural data |
| **LBI Intelligence** | Life Behavioural Insights integration (`LBIProductPage`) |

---

## 3. Student Management

### Student registry

- Full searchable table of enrolled students
- Fields: name, email, grade/batch, enrollment status, last active, subscription tier
- Filter by batch, status, score band
- Export to CSV

### Bulk import

- Upload a CSV file with student details
- System validates rows, reports errors, and creates pending enrollments
- `POST /api/institute/batches` with CSV payload

### Enrollment approval

- Students request enrollment or are bulk-added by admin
- Admin sees a "Pending Enrollments" queue in the Overview section
- `PATCH /api/institute/enrollments/:id` with `{ action: 'approve' | 'reject' }`
- On approval: student account is activated and linked to the institution tenant

---

## 4. Exam Builder

A full exam authoring tool supporting two question types.

### Question types

| Type | Description |
|---|---|
| **MCQ** | Multiple choice with 4–5 options; one or more correct answers |
| **Reflective** | Open-ended text response with rubric-based scoring |

### Exam creation flow

1. Name the exam, set duration (minutes), and total marks
2. Add questions manually or import from the question bank (`spe_questions`)
3. Assign `cognitive_load` tag per question (low / medium / high)
4. Set marks per question and optional rubric for reflective items
5. Save as **Draft** → submit for **Pending Approval** → publish as **Active**

### Exam lifecycle

```
Draft → Pending Approval → Published → Active → Closed
```

### Exam metadata stored in `spe_assessments`

| Field | Description |
|---|---|
| `title` | Exam name |
| `type` | `mcq` / `reflective` / `mixed` |
| `duration_minutes` | Time limit |
| `total_marks` | Max score |
| `status` | Lifecycle stage |
| `created_by` | Teacher/admin user ID |
| `tenant_id` | Institution reference |
| `published_at` | Activation timestamp |

---

## 5. Batch Organisation

Organise students into structured cohorts for targeted analytics and exam assignment.

### Batch dimensions

| Dimension | Examples |
|---|---|
| Academic year | Class 10A, Class 12B |
| Department | CS, DS, Mechanical |
| Competency track | Foundation, Advanced |
| Placement cohort | 2025 Batch, 2026 Batch |

### Batch operations

- Create batch with name, year, and section
- Assign/remove students from a batch
- Assign exams to a batch (all members receive the exam)
- View batch-level performance summary

### Competency Heatmap

For each batch, a heatmap shows domain-level competency coverage:

- Rows: competency domains (Cognitive, Leadership, Communication, Technical…)
- Columns: individual students or sub-groups
- Cells: colour-coded score (green → amber → red)
- Identifies systematic gaps at the batch level (e.g., 70% of Class 12B below threshold on Data Analysis)

---

## 6. Performance Analytics

### Component: Uses `recharts` library for visualisation

### Analytics panels

| Panel | Chart type | Data source |
|---|---|---|
| Performance Trends | Line chart | Exam scores over time per batch |
| Subject Performance | Bar chart | Average score per subject / domain |
| At-Risk Students | Table | Students with score < 40 or declining trend |
| Score Distribution | Histogram | Distribution of scores for a given exam |
| Completion Rates | Funnel | % of enrolled students who completed each stage |

### At-Risk detection

Students flagged as at-risk if:
- Any assessment score < 40
- Score trend declining over 3+ consecutive assessments
- Absence from 2+ assigned exams
- CAPADEX risk flag triggered (score < 40 post-completion hooks)

At-risk students are surfaced with:
- Name, batch, score, flag reason
- Recommended intervention from the RIE engine
- Link to full behavioural report

---

## 7. Behavioural Scoring Engine (SPE)

### Routes: `backend/routes/spe-scoring-engine.ts`

The SPE (Student Performance Engine) goes beyond raw scores — it captures and analyses the *how* of answering, not just the *what*.

### Behavioural signals tracked per exam attempt

| Signal | Description |
|---|---|
| `response_time_ms` | Time taken per question |
| `time_volatility` | Std deviation of response times within the attempt |
| `answer_revisions` | Number of answer changes before final submission |
| `confidence_proxy` | Derived from response time + revision pattern |
| `cognitive_load_index` | Composite: time + volatility + revision count |
| `engagement_score` | Completion rate × pacing × anchors passed |

### Scoring tables

```sql
spe_scores
  attempt_id UUID
  student_id INTEGER
  raw_score NUMERIC
  normalised_score NUMERIC  -- 0-100
  readiness_level TEXT  -- High | Moderate | Needs Attention
  
spe_behavioural_scores
  attempt_id UUID
  persistence NUMERIC
  focus NUMERIC
  cognitive_load_index NUMERIC
  composite_score NUMERIC
```

### Readiness levels

| Normalised score | Level |
|---|---|
| 70–100 | High |
| 40–69 | Moderate |
| 0–39 | Needs Attention |

---

## 8. LBI Integration

### Component: `LBIProductPage`

Institutions with the LBI module enabled can view Life Behavioural Insights for their student cohort (subject to per-student consent).

### LBI domains visible at institution level (aggregate only)

- Cognitive Ability
- Emotional Regulation
- Social Skills
- Leadership Potential
- Work Ethics
- Career Orientation

Individual-level LBI is only accessible to the student themselves and their consenting parent. Institution-level view shows anonymised cohort aggregates.

---

## 9. AI-Powered Reports

### Component: `AIPoweredReports.tsx`

Institutions can generate the following AI reports:

| Report | Content |
|---|---|
| **Batch Performance Report** | Cohort-level score analysis with benchmark comparison |
| **Competency Gap Report** | Domains below required level across the batch |
| **At-Risk Students Report** | Flagged students with severity and recommended interventions |
| **Placement Readiness Report** | % of students hire-ready for target roles (college use) |
| **Exam Quality Report** | Difficulty calibration, question discrimination indices |

Reports are exportable as PDF or CSV from the dashboard.

---

## 10. Role-Based Access

### Roles within an institution

| Role | Access |
|---|---|
| **Admin (Principal)** | All sections — full read/write |
| **Teacher** | Student management, exam builder, performance analytics for assigned batches |
| **Coordinator** | Batch organisation, enrollment approval |
| **Viewer** | Read-only access to analytics and reports |

Role assignment is managed by the Admin. API routes check `req.user.instituteRole` before processing requests.

---

## 11. DPDP Compliance

- **Consent management**: Behavioural data collection for students requires individual consent (managed via parent for minors)
- **Data protection indicators** are shown on each student record — green (consented), amber (pending), red (not consented / revoked)
- **Data retention**: Assessment results retained for 3 years; behavioural signals for 6 months
- **Audit log**: Every admin action on student data is logged to `capadex_audit_events`
- **Anonymisation**: AI reports use anonymised data by default; named reports require consent flag = true

---

## 12. Tenants & Subscription Tiers

### Super Admin management

The MetryxOne Super Admin can manage all institution tenants via `GET /api/admin/tenants`.

### `tenants` table

```sql
tenants
  id SERIAL PRIMARY KEY
  tenant_code TEXT UNIQUE     -- e.g. 'DPS_DELHI_001'
  tenant_name TEXT
  tenant_type TEXT            -- 'school' | 'university' | 'enterprise'
  subscription_tier TEXT      -- 'basic' | 'pro' | 'enterprise'
  is_active BOOLEAN
  settings JSONB              -- feature flags, branding, module toggles
  created_at TIMESTAMPTZ
```

### Subscription tiers

| Tier | Modules |
|---|---|
| Basic | Student management, exam builder, basic analytics |
| Pro | Everything + AI reports, LBI aggregate view, competency heatmap |
| Enterprise | Everything + custom branding, API access, SSO, white-label reports |

---

## 13. Database Schema

```sql
spe_assessments
  id SERIAL PRIMARY KEY
  tenant_id INTEGER REFERENCES tenants(id)
  title TEXT
  type TEXT
  duration_minutes INTEGER
  total_marks INTEGER
  status TEXT
  created_by INTEGER REFERENCES users(id)
  published_at TIMESTAMPTZ
  created_at TIMESTAMPTZ

spe_questions
  id SERIAL PRIMARY KEY
  assessment_id INTEGER REFERENCES spe_assessments(id)
  question_text TEXT
  question_type TEXT  -- mcq | reflective
  options JSONB
  correct_answer JSONB
  marks INTEGER
  cognitive_load TEXT  -- low | medium | high
  rubric TEXT
  created_at TIMESTAMPTZ

spe_scores
  id SERIAL PRIMARY KEY
  attempt_id UUID UNIQUE
  student_id INTEGER
  assessment_id INTEGER REFERENCES spe_assessments(id)
  raw_score NUMERIC
  normalised_score NUMERIC
  readiness_level TEXT
  completed_at TIMESTAMPTZ

spe_behavioural_scores
  id SERIAL PRIMARY KEY
  attempt_id UUID REFERENCES spe_scores(attempt_id)
  persistence NUMERIC
  focus NUMERIC
  time_volatility NUMERIC
  cognitive_load_index NUMERIC
  composite_score NUMERIC
```

---

## 14. API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/institute/dashboard` | Core stats, batches, exams, enrollments |
| `GET` | `/api/institute/analytics` | Detailed performance metrics |
| `POST` | `/api/institute/batches` | Create batch or bulk import students |
| `POST` | `/api/institute/exams` | Create a new assessment |
| `PATCH` | `/api/institute/enrollments/:id` | Approve or reject enrollment |
| `GET` | `/api/admin/tenants` | Super Admin: manage all institutions |

---

## 15. Frontend Architecture

| File | Role |
|---|---|
| `frontend/src/components/UnifiedInstituteDashboard.tsx` | Main dashboard container |
| `frontend/src/components/AIPoweredReports.tsx` | AI report generator |
| `frontend/src/components/LBIProductPage.tsx` | LBI integration panel |
| `frontend/src/components/InstituteHeader.tsx` | Branded header |
| `frontend/src/components/InstituteFooter.tsx` | Branded footer |
| `frontend/src/components/HelpSystem.tsx` | Contextual help + quick-start guide |
| `backend/routes/tenants.ts` | Tenant management API |
| `backend/routes/spe-scoring-engine.ts` | Behavioural scoring engine |

---

*Document generated from live codebase — MetryxOne Institution Dashboard v1.0, May 2026*
