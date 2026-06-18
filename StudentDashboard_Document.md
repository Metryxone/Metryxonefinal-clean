# Student Dashboard — Comprehensive System Document
**MetryxOne Behavioral Intelligence Platform**
*Version 1.0 — May 2026*

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Dashboard Layout & Navigation](#2-dashboard-layout--navigation)
3. [KPI Cards & Score Rings](#3-kpi-cards--score-rings)
4. [CAPADEX Assessment Integration](#4-capadex-assessment-integration)
5. [Competency Map](#5-competency-map)
6. [Career Seeker Portal](#6-career-seeker-portal)
7. [Gamification System](#7-gamification-system)
8. [Exam & Assignment Management](#8-exam--assignment-management)
9. [AI Study Recommendations](#9-ai-study-recommendations)
10. [Mentor Booking](#10-mentor-booking)
11. [Database Schema](#11-database-schema)
12. [API Reference](#12-api-reference)
13. [Frontend Architecture](#13-frontend-architecture)

---

## 1. Product Overview

The **Student Dashboard** is MetryxOne's primary interface for learners — a gamified, intelligence-driven portal that combines behavioural assessment, career planning, academic tracking, and mentorship into a single experience.

### Who it serves

| Persona | Age range | Primary use |
|---|---|---|
| School student | 13–17 | Exams, behavioural insight, career discovery |
| College student | 18–22 | Career readiness, CAPADEX journey, competency map |
| Campus user | 18–25 | Placement prep, mentor connect, skills tracking |

### Core value

- Single hub for assessments, career intelligence, exams, and mentorship
- Gamification keeps students engaged with daily missions and rewards
- Every recommendation is derived from actual behavioural + competency data
- Parent and institution views are linked — changes reflect across dashboards

---

## 2. Dashboard Layout & Navigation

### Main component: `StudentDashboard.tsx`

The root component renders:
- **Greeting banner** — personalised daily greeting with motivational prompt
- **KPI cards** — four top-level metrics
- **Score rings** — animated circular progress indicators
- **Action tiles** — quick-access to assessments, exams, mentor sessions

### Sidebar navigation (`SideMenu.tsx`)

| Section | Links |
|---|---|
| My Progress | Dashboard, Competency Map, CAPADEX Journey |
| Learning | Study Recommendations, Learning Forum |
| Exams | My Exams, Exam Trends, Assignment Tracker |
| Career | Career Seeker Portal, Career Pathways |
| Mentorship | Mentor Marketplace, My Sessions |
| Rewards | Missions, Leaderboard, Rewards Store |

### Screens (SPA navigation via `currentScreen` state)

| Screen key | Component | Purpose |
|---|---|---|
| `student-dashboard` | `StudentDashboard.tsx` | Main hub |
| `student-career-portal` | `StudentCareerPage.tsx` | Career clusters + role matching |
| `student-competency` | `StudentCompetencyPage.tsx` | Competency assessment |
| `mentor-marketplace` | `MentorMarketplacePage` | Find and book a mentor |

---

## 3. KPI Cards & Score Rings

The dashboard header displays four KPI cards:

| KPI | Description | Source |
|---|---|---|
| **Career Readiness** | Overall career preparedness score (0–100) | Computed from competency levels + CAPADEX progress |
| **Competency Score** | Average across all assessed competency domains | `/api/competency/score/:userId` |
| **Goals** | Active goals completed / total | `study_tasks` table |
| **Mentor Sessions** | Sessions attended this month | `mentor_bookings` table |

Score rings are animated SVG arcs, colour-coded by performance band (green ≥ 75, teal ≥ 50, orange below).

---

## 4. CAPADEX Assessment Integration

Students access the full CAPADEX progressive assessment flow directly from the dashboard.

### Stage journey shown on dashboard

| Stage | Code | Free/Paid | Status shown |
|---|---|---|---|
| Clarity | `CAP_CLA` | Free | Completed / Next |
| Curiosity | `CAP_CUR` | ₹199 | Completed / Unlock |
| Insight | `CAP_INS` | ₹499 | Completed / Unlock |
| Growth | `CAP_GRW` | ₹999 | Completed / Unlock |
| Mastery | `CAP_MAS` | ₹1,999 | Completed / Unlock |

On CAPADEX completion, post-hooks fire automatically:
- CSI (Career Stage Index) updated
- XP awarded to gamification profile
- Risk flags triggered if score < 40
- Recommendations added to student's IDP

---

## 5. Competency Map

### Component: `StudentCompetencyPage.tsx`

A three-phase self-assessment flow:

#### Phase 1 — Config
- Select career stage: Foundation → Early Career → Mid Career → Senior → Executive
- Select target role (e.g., SDE L3, Product Manager, Data Analyst)
- Select language (English + regional options)

#### Phase 2 — Assessment
- ~20 scenario-based questions
- Each item tagged to a competency domain
- Likert-scale responses (1–5)
- Timer displayed; progress bar per domain

#### Phase 3 — Results
- **Radar chart** — competency domain scores plotted as a spider web
- **Employability Index** — 0–100 composite score
- **IDP** — top 5–7 interventions to close the biggest gaps
- **Gap summary** — domains below required level highlighted in red

### API endpoints used

| Endpoint | Purpose |
|---|---|
| `POST /api/competency/assessment/start` | Fetch scenario items for selected role + stage |
| `POST /api/competency/assessment/submit` | Submit answers, trigger scoring |
| `GET /api/competency/score/:userId` | Retrieve competency breakdown + EI score |

---

## 6. Career Seeker Portal

### Component: `StudentCareerPage.tsx`

Displays career discovery tools tailored for students.

#### Career Clusters

Six broad career clusters with AI-matched role recommendations:

| Cluster | Example roles |
|---|---|
| Technology | Software Developer, Data Scientist, Cloud Engineer |
| Finance | Financial Analyst, Investment Banker, Chartered Accountant |
| Healthcare | Doctor, Pharmacist, Medical Researcher |
| Design & Creative | UX Designer, Graphic Designer, Content Creator |
| Management | Product Manager, Operations Manager, HR Business Partner |
| Research & Education | Research Analyst, Educator, Policy Advisor |

#### AI-matched role recommendations

Roles are ranked using the Career Intelligence engine:
- `fitScore` — skill + competency + experience match against the role
- `switchability` — ease of moving from current trajectory
- `demandScore` — market demand signal
- `etaMonths` — time to hire-ready

---

## 7. Gamification System

### Tables
- `student_gamification` — `xp`, `coins`, `level`, `streak_days`
- `gamification_missions` — daily/weekly mission definitions
- `gamification_rewards` — redeemable reward catalogue

### XP earning actions

| Action | XP awarded |
|---|---|
| Complete CAPADEX Clarity (free) | 50 XP |
| Complete CAPADEX Curiosity | 100 XP |
| Complete CAPADEX Insight | 150 XP |
| Complete CAPADEX Growth | 200 XP |
| Complete CAPADEX Mastery | 250 XP |
| Complete a competency assessment | 75 XP |
| Complete a daily mission | 25–50 XP |
| Daily login | Coins (not XP) |
| Attend mentor session | 100 XP |

### Coins & rewards

| Action | Coins |
|---|---|
| Daily login claim | 10 coins |
| Complete assigned exam | 20 coins |
| Streak (7-day) bonus | 50 coins |

**Redeemable rewards**: Amazon Gift Cards, Extra Mentor Sessions, Premium Assessment Unlocks, Platform Credits.

### Leaderboard

`GET /api/gamification/leaderboard` returns top-N students by XP, filterable by school/batch. Displayed as a ranked list with XP totals and level badges.

### API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/gamification/profile` | XP, level, streak, coins |
| `POST` | `/api/gamification/login-reward` | Claim daily login coins |
| `GET` | `/api/gamification/leaderboard` | XP leaderboard |
| `GET` | `/api/gamification/missions` | Active daily/weekly missions |
| `POST` | `/api/gamification/missions/:id/complete` | Mark a mission complete |

---

## 8. Exam & Assignment Management

### Components
- `StudentExamList.tsx` — list of assigned and available exams
- `ExamPlayer.tsx` — test-taking interface with timer

### Assignment types

| Type | Source | Description |
|---|---|---|
| Parent-assigned | Parent dashboard | Practice tests created or assigned by parent |
| Institution-assigned | School/college | Exams set by teachers via Exam Builder |
| Mentor-assigned | Mentor dashboard | Targeted preparation tasks from mentor |
| Platform tests | MetryxOne | CAPADEX, Exam Ready™, competency assessments |

### Exam lifecycle

```
Assigned → Not started → In progress → Submitted → Scored → Report available
```

### API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/student/assignments` | All assigned exams + tasks |
| `POST` | `/api/student/tests/:id/start` | Begin a test session |
| `POST` | `/api/student/tests/:id/submit` | Submit answers + trigger scoring |
| `GET` | `/api/student/study-tasks` | Homework and study goals |

---

## 9. AI Study Recommendations

### Component: `AIStudyRecommendations.tsx`

Generates personalised study suggestions based on:
- Weakest competency domains from the last assessment
- Incomplete IDP interventions
- Upcoming exam subjects
- Streak and engagement patterns

Recommendations are surfaced as cards with:
- Topic / skill name
- Suggested resource (course, video, practice set)
- Estimated time investment
- EI lift if completed

---

## 10. Mentor Booking

Students access the mentor marketplace directly from the sidebar.

- Browse mentors by type, subject, rating, and availability
- AI-matched suggestions based on LBI weak domains
- Book sessions via `BookSessionModal.tsx`
- Join video calls via `VideoCallRoom.tsx`
- View session notes left by mentors (if visibility is toggled on)

See the **Mentor Document** for full details.

---

## 11. Database Schema

```sql
users
  id SERIAL PRIMARY KEY
  email TEXT UNIQUE
  role TEXT  -- 'student' | 'parent' | 'admin'
  created_at TIMESTAMPTZ

children
  id SERIAL PRIMARY KEY
  user_id INTEGER REFERENCES users(id)
  parent_id INTEGER REFERENCES users(id)
  name TEXT
  age INTEGER
  grade TEXT
  school TEXT
  lbi_consent BOOLEAN
  created_at TIMESTAMPTZ

study_tasks
  id SERIAL PRIMARY KEY
  student_id INTEGER REFERENCES children(id)
  title TEXT
  description TEXT
  status TEXT  -- pending | in_progress | done
  due_date DATE
  created_by TEXT  -- 'parent' | 'teacher' | 'mentor' | 'platform'
  created_at TIMESTAMPTZ

assessment_assignments
  id SERIAL PRIMARY KEY
  student_id INTEGER REFERENCES children(id)
  template_id INTEGER
  assigned_by TEXT
  status TEXT  -- assigned | started | completed
  score NUMERIC
  created_at TIMESTAMPTZ

student_gamification
  id SERIAL PRIMARY KEY
  user_id INTEGER REFERENCES users(id)
  xp INTEGER DEFAULT 0
  coins INTEGER DEFAULT 0
  level INTEGER DEFAULT 1
  streak_days INTEGER DEFAULT 0
  last_login DATE
  updated_at TIMESTAMPTZ

student_subscriptions
  id SERIAL PRIMARY KEY
  user_id INTEGER REFERENCES users(id)
  package_code TEXT  -- 'exam-ready' | 'capadex-full' | etc.
  status TEXT  -- active | expired | cancelled
  expires_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
```

---

## 12. API Reference

### Student profile

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/student/profile` | Fetch student profile |
| `PATCH` | `/api/student/profile` | Update profile fields |

### Assessments

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/competency/assessment/start` | Start competency assessment |
| `POST` | `/api/competency/assessment/submit` | Submit and score |
| `GET` | `/api/competency/score/:userId` | Get EI score + breakdown |

### Exams

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/student/assignments` | All assigned exams |
| `POST` | `/api/student/tests/:id/start` | Begin test session |
| `POST` | `/api/student/tests/:id/submit` | Submit answers |
| `GET` | `/api/student/study-tasks` | Study tasks list |

### Gamification

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/gamification/profile` | XP, level, streak, coins |
| `POST` | `/api/gamification/login-reward` | Claim daily login coins |
| `GET` | `/api/gamification/leaderboard` | XP leaderboard |
| `GET` | `/api/gamification/missions` | Active missions |
| `POST` | `/api/gamification/missions/:id/complete` | Complete a mission |

---

## 13. Frontend Architecture

| File | Role |
|---|---|
| `frontend/src/components/StudentDashboard.tsx` | Main dashboard hub |
| `frontend/src/pages/StudentCompetencyPage.tsx` | Competency map + IDP |
| `frontend/src/pages/StudentCareerPage.tsx` | Career clusters + role matching |
| `frontend/src/components/StudentExamList.tsx` | Exam list view |
| `frontend/src/components/ExamPlayer.tsx` | Test-taking interface |
| `frontend/src/components/AIStudyRecommendations.tsx` | Study suggestion cards |
| `frontend/src/components/SideMenu.tsx` | Sidebar navigation |
| `frontend/src/components/RoleSwitcher.tsx` | Parent ↔ Student context toggle |
| `backend/routes/student.ts` | Core student API logic |
| `backend/routes/gamification.ts` | Rewards and missions |

---

*Document generated from live codebase — MetryxOne Student Dashboard v1.0, May 2026*
