# Parent Dashboard — Comprehensive System Document
**MetryxOne Behavioral Intelligence Platform**
*Version 1.0 — May 2026*

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Dashboard Layout & Modules](#2-dashboard-layout--modules)
3. [Child Account Linking](#3-child-account-linking)
4. [Behavioural Intelligence (LBI)](#4-behavioural-intelligence-lbi)
5. [Academic Planning](#5-academic-planning)
6. [Supervised Testing](#6-supervised-testing)
7. [AI-Powered Reports](#7-ai-powered-reports)
8. [Growth Scorecard](#8-growth-scorecard)
9. [Mentor Services](#9-mentor-services)
10. [Notifications & Alerts](#10-notifications--alerts)
11. [Subscriptions](#11-subscriptions)
12. [Privacy & Consent (DPDP)](#12-privacy--consent-dpdp)
13. [Database Schema](#13-database-schema)
14. [API Reference](#14-api-reference)
15. [Frontend Architecture](#15-frontend-architecture)

---

## 1. Product Overview

The **Parent Dashboard** (`UnifiedParentDashboard`) is MetryxOne's monitoring, planning, and coordination hub for parents. It gives guardians a holistic view of their child's behavioural intelligence, academic performance, career trajectory, and wellness — all with built-in privacy controls and DPDP-compliant consent management.

### What parents can do

- Monitor their child's CAPADEX, LBI, and competency assessment results
- Assign practice tests and study tasks
- Book and supervise mentor sessions
- View AI-generated weekly insight digests
- Manage consent for behavioural data collection
- Compare multiple children (Sibling Comparison module)
- Access career planning tools calibrated for their child's profile

---

## 2. Dashboard Layout & Modules

### Main component: `UnifiedParentDashboard.tsx`

Uses a modular architecture with sub-components loaded by `activeSection` state.

### Core modules

| Module | Component | Purpose |
|---|---|---|
| Overview | Inline in main dashboard | Alerts, milestones, weekly digest |
| Enterprise Hub | `ParentEnterpriseHub` | Wellness monitoring + professional development |
| Education Planner | `ParentEducationPlanner` | Academic planning and assignment tracking |
| AI Reports | `AIPoweredReports` | AI-generated insights from assessment data |
| Growth Scorecard | `UnifiedGrowthScorecard` | Holistic view of child's progress |
| Mentor Services | `ParentMentorServices` | Book and manage mentor sessions |
| LBI Intelligence | `/parent-lbi` screen | Full longitudinal behavioural intelligence view |
| Career Portal | `/parent-career-portal` | Career guidance calibrated for child |
| Exam Tools | `/generate-exam`, `/preview-blueprint` | Practice test creation |
| Sibling Comparison | `SiblingComparison` | Benchmark across multiple children |

### Navigation layout

- `SideMenu` for section switching
- `AppTopBar` with notification bell and child-selector dropdown
- `AlertTicker` at the top for real-time alerts and pending actions

---

## 3. Child Account Linking

Parents are linked to children via the `children` table (`parent_id` foreign key).

### Linking flow

1. Parent creates account (role: `parent`)
2. Parent adds a child via `POST /api/children` — either by entering details manually or by accepting a school-sent invite
3. Child can optionally have their own login (`student_user_id` field)
4. If child has their own login, data flows bidirectionally — the child sees the same assessments the parent assigned

### Multiple children

A parent account can have multiple `children` rows. The top-bar dropdown allows switching between children. All modules update contextually on switch.

### Sibling Comparison

`SiblingComparison` component renders side-by-side KPI cards for all linked children:
- Competency score
- CAPADEX stage progress
- Career readiness score
- Gamification level and XP
- Wellness check-in summary

---

## 4. Behavioural Intelligence (LBI)

### Screen: `/parent-lbi`

Parents can view LBI (Life Behavioural Insights) results for their child — subject to explicit consent.

### What the LBI view shows

- Behavioural domain scores (19 domains)
- Longitudinal trajectory — how scores have changed across sessions
- Risk flags (if any) triggered by low scores
- Recommended interventions from the RIE engine
- CAPADEX stage journey with scores per completed stage
- Drift direction badge (worsening / stabilising / recovering / improving)

### 6-month retest lockout

The system enforces a re-assessment lockout (typically 6 months) for behavioural assessments to ensure data validity. The lockout countdown is visible in the dashboard and surfaced in the `/api/insights` response.

---

## 5. Academic Planning

### Component: `ParentEducationPlanner`

Allows parents to:
- View all assigned and completed study tasks for the child
- Create new study tasks (title, description, due date)
- Track homework completion status (`pending` → `in_progress` → `done`)
- Set exam preparation goals with target dates

### Practice test creation

**Route**: `/generate-exam`
**Preview**: `/preview-blueprint`

Parents can build custom practice tests:
1. Select subject, difficulty, and question count
2. System samples from the question bank
3. Preview the test blueprint before assigning
4. Assign to the child — appears in their `StudentExamList`

---

## 6. Supervised Testing

Parents can initiate a proctored test session for minors.

### How it works

1. Parent clicks "Supervise a Test" in the Education Planner
2. `POST /api/supervised-test/start` creates a session with a supervision token
3. Parent views real-time progress (questions answered, time elapsed, current score estimate)
4. On completion, the full report is available in both the student and parent dashboards

### Supervision controls

- Start / pause / end session
- View question-by-question progress
- Leave notes for the child post-test

---

## 7. AI-Powered Reports

### Component: `AIPoweredReports.tsx`

Generates narrative intelligence reports from assessment data.

### Report types available to parents

| Report | Content |
|---|---|
| **Weekly Insight Digest** | Summary of the child's progress, highlights, and recommended actions for the coming week |
| **Competency Gap Report** | Which competency domains are below the expected level for the child's grade/age |
| **Behavioural Pattern Report** | Key patterns detected across CAPADEX + LBI sessions |
| **Career Readiness Report** | Stage-by-stage assessment progress + recommended next steps |
| **Exam Performance Report** | Score trends, subject strengths and weaknesses |

### `parent_briefings` table

Weekly digests are persisted per-parent per-child:
```sql
parent_briefings
  id SERIAL PRIMARY KEY
  parent_id INTEGER REFERENCES users(id)
  child_id INTEGER REFERENCES children(id)
  week_start DATE
  content JSONB  -- headline, insights[], action_items[]
  generated_at TIMESTAMPTZ
```

---

## 8. Growth Scorecard

### Component: `UnifiedGrowthScorecard`

A holistic multi-dimension view of the child's progress across all tracked domains.

### Scorecard dimensions

| Dimension | Source |
|---|---|
| Academic Performance | Exam scores, assignment completion rate |
| Competency Level | Competency assessment scores |
| Career Readiness | CAPADEX stage progress + fitment |
| Behavioural Health | LBI domain averages |
| Wellness | `wellness_checkins` table |
| Gamification Level | XP, level, streak |
| Mentor Engagement | Sessions attended, notes received |

### Milestone Celebration

`MilestoneCelebration` component triggers on significant events:
- First CAPADEX stage completed
- Competency score crossing 70+
- First mentor session attended
- 7-day streak achieved
- Career readiness hitting a new band

---

## 9. Mentor Services

### Component: `ParentMentorServices`

Parents browse and book mentors on behalf of their children.

- Filter by: mentor type, subject, language, price range, rating
- View AI-matched suggestions (based on child's LBI weak domains)
- Book sessions via `BookSessionModal.tsx`
- View session notes from mentors (if mentor has enabled parent visibility)
- Track session history and outcomes

See the **Mentor Document** for full matching and booking details.

---

## 10. Notifications & Alerts

### `AlertTicker` component

A scrolling notification bar at the top of the dashboard showing:
- Pending actions (e.g., "Review Aryan's competency report")
- System alerts (e.g., "Exam scheduled tomorrow")
- Milestone notifications (e.g., "Riya completed Growth stage!")
- Wellness flags (e.g., "Low wellness check-in detected this week")

Alerts are pulled from `/api/dashboard?childId=...` and persisted in a `parent_alerts` JSONB field.

---

## 11. Subscriptions

### Plans

| Plan | Features |
|---|---|
| Basic | Dashboard, weekly digest, exam assignment, report view |
| Pro | Everything in Basic + AI reports, mentor booking, LBI access, supervised testing |

### Tables

```sql
parent_subscriptions
  id SERIAL PRIMARY KEY
  parent_id INTEGER REFERENCES users(id)
  plan TEXT  -- 'basic' | 'pro'
  status TEXT  -- active | expired | cancelled
  billing_cycle TEXT  -- monthly | annual
  expires_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
```

Parents can view and manage subscriptions via `GET /api/my-subscriptions` and `GET /api/subscription-packages`.

---

## 12. Privacy & Consent (DPDP)

MetryxOne complies with India's DPDP Act. Behavioural data collection for minors requires explicit parental consent.

### Consent flow

1. Parent receives a consent request (email or in-app)
2. Consent deep-link: `/parent-consent/:token`
3. Parent reviews what data will be collected and for how long
4. On approval: `POST /api/children/:childId/consent` with `granted: true`
5. LBI and signal capture activate for the child

### Consent controls

- Consent can be revoked at any time from the dashboard
- Revocation stops future signal collection immediately
- Historical data retained per DPDP retention policy (6 months by default)
- Consent status visible in the child profile card

---

## 13. Database Schema

```sql
users
  id SERIAL PRIMARY KEY
  email TEXT UNIQUE
  role TEXT  -- 'parent'
  created_at TIMESTAMPTZ

children
  id SERIAL PRIMARY KEY
  user_id INTEGER           -- if child has own login
  parent_id INTEGER REFERENCES users(id)
  name TEXT
  age INTEGER
  grade TEXT
  school TEXT
  lbi_consent BOOLEAN DEFAULT FALSE
  created_at TIMESTAMPTZ

parent_briefings
  id SERIAL PRIMARY KEY
  parent_id INTEGER REFERENCES users(id)
  child_id INTEGER REFERENCES children(id)
  week_start DATE
  content JSONB
  generated_at TIMESTAMPTZ

career_compass_results
  id SERIAL PRIMARY KEY
  child_id INTEGER REFERENCES children(id)
  career_traits JSONB
  recommended_clusters JSONB
  generated_at TIMESTAMPTZ

wellness_checkins
  id SERIAL PRIMARY KEY
  child_id INTEGER REFERENCES children(id)
  stress_level INTEGER   -- 1-5
  mood TEXT
  sleep_hours NUMERIC
  notes TEXT
  checked_in_at TIMESTAMPTZ

parent_subscriptions
  id SERIAL PRIMARY KEY
  parent_id INTEGER REFERENCES users(id)
  plan TEXT
  status TEXT
  billing_cycle TEXT
  expires_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
```

---

## 14. API Reference

### Dashboard & children

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dashboard?childId=...` | Aggregated dashboard data for a child |
| `GET` | `/api/children` | List all linked children |
| `POST` | `/api/children` | Add a new child |
| `PATCH` | `/api/children/:id` | Update child details |

### Consent

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/children/:childId/consent` | Grant or revoke LBI consent |

### Testing

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/supervised-test/start` | Start a supervised test session |
| `GET` | `/api/student/assignments` | View child's assigned tests |

### Subscriptions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/subscription-packages` | Available plans |
| `GET` | `/api/my-subscriptions` | Parent's active subscriptions |

---

## 15. Frontend Architecture

| File | Role |
|---|---|
| `frontend/src/components/UnifiedParentDashboard.tsx` | Main parent dashboard |
| `frontend/src/components/ParentEnterpriseHub.tsx` | Wellness + development module |
| `frontend/src/components/ParentEducationPlanner.tsx` | Academic planning |
| `frontend/src/components/AIPoweredReports.tsx` | AI report generator |
| `frontend/src/components/UnifiedGrowthScorecard.tsx` | Growth scorecard |
| `frontend/src/components/ParentMentorServices.tsx` | Mentor booking module |
| `frontend/src/components/SiblingComparison.tsx` | Multi-child benchmarking |
| `frontend/src/components/MilestoneCelebration.tsx` | Achievement celebrations |
| `frontend/src/components/AlertTicker.tsx` | Real-time alert ticker |
| `frontend/src/components/WeeklyInsightDigest.tsx` | Weekly summary card |
| `backend/routes.ts` | Parent + children API routes |
| `frontend/src/lib/api.ts` | Frontend API client |

---

*Document generated from live codebase — MetryxOne Parent Dashboard v1.0, May 2026*
