# Mentor Feature — Comprehensive System Document
**MetryxOne Behavioral Intelligence Platform**
*Version 1.0 — May 2026*

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Mentor Types & Profiles](#2-mentor-types--profiles)
3. [Mentor Onboarding & KYC](#3-mentor-onboarding--kyc)
4. [Mentor Marketplace](#4-mentor-marketplace)
5. [AI-Based Matching](#5-ai-based-matching)
6. [Booking Flow](#6-booking-flow)
7. [Session Delivery](#7-session-delivery)
8. [Session Notes](#8-session-notes)
9. [Mentor Dashboard](#9-mentor-dashboard)
10. [Performance Health Index (PHI)](#10-performance-health-index-phi)
11. [Payouts & Revenue Share](#11-payouts--revenue-share)
12. [Training Programs](#12-training-programs)
13. [Admin Governance](#13-admin-governance)
14. [Database Schema](#14-database-schema)
15. [API Reference](#15-api-reference)
16. [Frontend Architecture](#16-frontend-architecture)

---

## 1. Product Overview

The **Mentor Feature** is MetryxOne's end-to-end mentorship and counselling platform. It connects students with verified mentors across academic, career, and behavioural domains. The system covers the full mentor lifecycle: recruitment → KYC/training → marketplace listing → AI-matched booking → video session delivery → clinical notes → performance monitoring → payouts.

### What it enables

| Stakeholder | Benefit |
|---|---|
| Student | Access to verified mentors matched to their specific LBI weak domains |
| Parent | Book sessions for their child; view session notes with mentor consent |
| Mentor | Structured onboarding, scheduling, session tools, payout management |
| Institution | Bulk mentor access for student cohorts; performance tracking |
| Admin | Maker-checker governance, PHI monitoring, KYC verification |

---

## 2. Mentor Types & Profiles

### Mentor types (heuristic mapping to LBI domains)

| Mentor type | LBI domains matched | Typical background |
|---|---|---|
| `performance_coach` | Focus, cognitive ability, work ethics | Ex-athlete, productivity coach |
| `psychological_counsellor` | Emotional regulation, social skills, stress | Clinical psychologist, counsellor |
| `career_counsellor` | Career orientation, leadership | HR professional, career coach |
| `academic_mentor` | Cognitive ability, study habits | Subject expert, teacher |
| `life_skills_coach` | Social skills, identity, emotional regulation | Life coach, NLP practitioner |
| `technical_mentor` | Technical skills, programming | Senior engineer, data scientist |

### Mentor profile fields (`mentor_profiles`)

| Field | Description |
|---|---|
| `bio` | 150–300 word professional bio |
| `hourly_rate` | Session price (INR) |
| `subjects` | Array of subject tags (e.g. ["Mathematics", "Physics"]) |
| `specialisations` | Domain tags (e.g. ["NEET prep", "Anxiety management"]) |
| `ai_match_tags` | Auto-generated LBI domain tags for matching |
| `is_featured` | Featured status (boosts rank in marketplace) |
| `rating` | Average rating (1–5, from session reviews) |
| `languages` | Session languages offered |
| `availability` | JSONB schedule grid |

---

## 3. Mentor Onboarding & KYC

### Onboarding flow

```
MentorAgreementPage (legal contract signing)
  └─ KYC document upload
       └─ Training program enrollment
            └─ Admin maker-checker review
                 └─ Status: active
```

### KYC

Documents stored in `kyc_documents` table:
- Government ID (Aadhaar / Passport)
- Professional qualification certificate
- Police verification certificate (where applicable)
- Profile photo

Maker-checker workflow: one admin submits for approval, a second admin approves. Prevents single-point fraud.

### Mentor status lifecycle

```
pending_training → training_in_progress → pending_review → active → suspended
```

---

## 4. Mentor Marketplace

### Route: `/mentor-marketplace`
### Component: `MentorMarketplacePage`

The public-facing marketplace for browsing and booking mentors.

### Listing features

- Search by name, subject, or specialisation
- Filters: mentor type, language, price range, rating, availability
- Sort: featured first → rating → price
- Pagination with lazy loading

### Mentor card shows

- Profile photo, name, type
- Star rating + review count
- Subjects and specialisations (chips)
- Hourly rate
- "AI Match" badge if matched to the student's LBI profile
- Match reason (e.g., "Matched to your child's focus & cognitive areas")
- Book button

---

## 5. AI-Based Matching

### Route: `GET /api/mentor-marketplace/suggestions`
### Logic: `frontend/server/src/routes/mentor.ts` (line ~142)

The suggestion engine runs a three-step pipeline:

#### Step 1 — Identify weak LBI domains

Fetch the student's `lbi_sessions` and identify domains with score < 60%:

```
weakDomains = lbi_sessions
  .flatMap(s => s.domain_scores)
  .filter(d => d.score < 60)
  .map(d => d.domain_code)
```

#### Step 2 — Map domains to mentor types

| LBI domain | Mapped mentor type |
|---|---|
| `focus` | `performance_coach` |
| `emotional_regulation` | `psychological_counsellor` |
| `social_skills` | `psychological_counsellor` |
| `career_orientation` | `career_counsellor` |
| `cognitive_ability` | `academic_mentor` |
| `leadership` | `career_counsellor` |
| `work_ethics` | `performance_coach` |

#### Step 3 — Rank mentors

Raw SQL query ranks mentors by:
1. `mentor_type` match to derived types (primary filter)
2. `is_featured = true` (secondary boost)
3. `rating DESC` (tertiary sort)

#### Match reason generation

For each suggested mentor, a human-readable reason is generated:

```
"Matched to your child's emotional & social skills needs"
"Matched based on focus and cognitive development goals"
```

---

## 6. Booking Flow

### Route: `POST /api/mentor-marketplace/:id/book`
### Component: `BookSessionModal.tsx`

#### Steps

1. Parent or student opens `BookSessionModal`
2. Select available time slot from mentor's availability grid
3. Confirm session type (1:1 video / asynchronous / chat)
4. Payment (if applicable — some sessions are subscription-included)
5. Booking created with status `pending`
6. Mentor receives notification and confirms → status becomes `confirmed`
7. Session reminder sent 24h before

#### Booking fields (`mentor_bookings`)

| Field | Description |
|---|---|
| `mentor_id` | Reference to the mentor |
| `student_id` | Student being mentored |
| `booked_by` | `parent` or `student` |
| `session_date` | Date + start time |
| `duration_minutes` | Session length |
| `session_type` | `video` / `chat` / `async` |
| `status` | `pending` / `confirmed` / `completed` / `cancelled` |
| `notes_from_parent` | Pre-session context from parent |

#### Booking messages (`booking_messages`)

Real-time communication channel between mentor and parent/student regarding a specific booking:
- Text messages with timestamps
- Read receipts

API: `GET /api/mentor-marketplace/bookings/:bookingId/messages` and `POST` to send.

---

## 7. Session Delivery

### Route: `/join-session`
### Component: `JoinSessionPage` + `VideoCallRoom.tsx`

Sessions are delivered via an integrated video call room.

### Features

- HD video + audio
- Screen sharing
- In-session chat
- Session recording (if consent given)
- Timer showing remaining session time
- End session button (available to both parties after 80% of time elapsed)

Students and parents join via a session link. The link is only active within a 5-minute window before the scheduled start time.

---

## 8. Session Notes

### Component: `MentorSessionNotes.tsx`
### Route: `POST /api/mentor-marketplace/bookings/:bookingId/notes`

After each session, mentors can document:

| Field | Description |
|---|---|
| `session_summary` | Brief narrative of what was covered |
| `observations` | Clinical / pedagogical observations |
| `next_steps` | Recommended actions for the student |
| `follow_up_date` | Suggested next session timing |
| `parent_visible` | Boolean — toggle whether parent can see these notes |
| `student_visible` | Boolean — toggle whether student can see these notes |

Notes are stored in `mentor_session_notes` and visible in:
- Mentor's session history
- Parent's `ParentMentorServices` module (if `parent_visible = true`)
- Student's "My Sessions" section (if `student_visible = true`)

---

## 9. Mentor Dashboard

### Route: `/mentor-dashboard`
### Component: `MentorDashboardPage`

The mentor's personal command centre.

### Sections

| Section | Content |
|---|---|
| **Overview** | Upcoming sessions, total sessions this month, earnings summary |
| **My Sessions** | Calendar view + list of all bookings |
| **Students** | Profiles of all students mentored, with session count and notes |
| **Session Notes** | All notes written, filterable by student |
| **Earnings** | Payout history, pending payouts, revenue breakdown |
| **Profile** | Edit bio, subjects, specialisations, rate, availability |
| **Training** | Access to training modules and certification |
| **KPIs** | Performance metrics — satisfaction, completion rate, outcome improvement |

---

## 10. Performance Health Index (PHI)

The PHI is a 0–100 composite score assigned to each mentor by the admin system. It drives ranking, eligibility for featured status, and triggers governance actions.

### PHI components

| Metric | Weight |
|---|---|
| Session completion rate | 30% |
| Student satisfaction score (post-session survey) | 30% |
| Outcome improvement rate (student score change) | 25% |
| Response time to booking requests | 10% |
| Compliance violations | Deduction |

### PHI thresholds

| PHI | Status | Action |
|---|---|---|
| 80–100 | Excellent | Eligible for featured status |
| 60–79 | Good | Standard listing |
| 40–59 | At Risk | Warning issued; coaching intervention |
| 0–39 | Critical | Automatic suspension pending review |

### Admin management

`PATCH /api/admin/mentors/:id/phi` — admins can manually adjust PHI with a reason note. All PHI changes are logged in `capadex_audit_events`.

---

## 11. Payouts & Revenue Share

### Table: `mentor_payouts`

| Field | Description |
|---|---|
| `mentor_id` | Mentor reference |
| `period_start` / `period_end` | Payout window |
| `gross_amount` | Total earned from sessions |
| `commission_rate` | MetryxOne platform fee % |
| `net_amount` | `gross_amount × (1 − commission_rate)` |
| `status` | `pending` / `processing` / `paid` |
| `bank_transfer_ref` | Payment reference on completion |

### Payout cycle

Payouts are processed weekly (every Monday) for the previous week's completed sessions. The `status` transitions:
1. `pending` — session completed
2. `processing` — payout initiated
3. `paid` — bank transfer confirmed

---

## 12. Training Programs

### Tables: `training_programs`, `training_enrollments`

All mentors must complete mandatory onboarding training before activation.

### Training modules

| Module | Description | Required for |
|---|---|---|
| Platform orientation | How MetryxOne works, tools available | All mentors |
| LBI & CAPADEX overview | Understanding behavioural intelligence reports | All mentors |
| Session delivery standards | Code of conduct, note-taking, confidentiality | All mentors |
| Child safeguarding | DPDP and minor protection protocols | Mentors working with students under 18 |
| Clinical documentation | Session notes and outcome tracking | Psychological counsellors |

Training is self-paced. Progress is tracked in `training_enrollments`. Mentors cannot be activated until all required modules show `completed`.

---

## 13. Admin Governance

### Component: `MentorsPanel.tsx` (SuperAdmin Dashboard)

Admin tools for mentor management:

| Action | Description |
|---|---|
| View all mentors | Filter by status, type, PHI band |
| KYC review | Approve or reject document submissions |
| PHI update | Manually adjust with reason |
| Profile edit | `PATCH /api/admin/mentors/:id/profile` |
| Suspend / reactivate | Toggle mentor status |
| Compliance violations | Log a violation; 3 violations → automatic suspension |
| Payout management | Mark payouts as processed |

---

## 14. Database Schema

```sql
mentors
  id SERIAL PRIMARY KEY
  user_id INTEGER REFERENCES users(id)
  mentor_type TEXT
  status TEXT  -- pending_training | training_in_progress | pending_review | active | suspended
  phi NUMERIC DEFAULT 50
  compliance_violations INTEGER DEFAULT 0
  created_at TIMESTAMPTZ

mentor_profiles
  id SERIAL PRIMARY KEY
  mentor_id INTEGER REFERENCES mentors(id)
  bio TEXT
  hourly_rate NUMERIC
  subjects JSONB
  specialisations JSONB
  ai_match_tags JSONB
  languages JSONB
  availability JSONB
  rating NUMERIC DEFAULT 0
  is_featured BOOLEAN DEFAULT FALSE
  updated_at TIMESTAMPTZ

mentor_bookings
  id SERIAL PRIMARY KEY
  mentor_id INTEGER REFERENCES mentors(id)
  student_id INTEGER REFERENCES children(id)
  booked_by TEXT  -- 'parent' | 'student'
  session_date TIMESTAMPTZ
  duration_minutes INTEGER
  session_type TEXT
  status TEXT  -- pending | confirmed | completed | cancelled
  notes_from_parent TEXT
  created_at TIMESTAMPTZ

mentor_session_notes
  id SERIAL PRIMARY KEY
  booking_id INTEGER REFERENCES mentor_bookings(id)
  session_summary TEXT
  observations TEXT
  next_steps TEXT
  follow_up_date DATE
  parent_visible BOOLEAN DEFAULT FALSE
  student_visible BOOLEAN DEFAULT FALSE
  created_at TIMESTAMPTZ

booking_messages
  id SERIAL PRIMARY KEY
  booking_id INTEGER REFERENCES mentor_bookings(id)
  sender_role TEXT  -- 'mentor' | 'parent' | 'student'
  message TEXT
  read BOOLEAN DEFAULT FALSE
  created_at TIMESTAMPTZ

mentor_kpis
  id SERIAL PRIMARY KEY
  mentor_id INTEGER REFERENCES mentors(id)
  satisfaction_score NUMERIC
  completion_rate NUMERIC
  outcome_improvement_rate NUMERIC
  avg_response_time_hrs NUMERIC
  updated_at TIMESTAMPTZ

mentor_payouts
  id SERIAL PRIMARY KEY
  mentor_id INTEGER REFERENCES mentors(id)
  period_start DATE
  period_end DATE
  gross_amount NUMERIC
  commission_rate NUMERIC
  net_amount NUMERIC
  status TEXT  -- pending | processing | paid
  bank_transfer_ref TEXT
  created_at TIMESTAMPTZ

training_programs
  id SERIAL PRIMARY KEY
  code TEXT UNIQUE
  title TEXT
  description TEXT
  required_for JSONB  -- mentor types

training_enrollments
  id SERIAL PRIMARY KEY
  mentor_id INTEGER REFERENCES mentors(id)
  program_code TEXT REFERENCES training_programs(code)
  status TEXT  -- enrolled | in_progress | completed
  completed_at TIMESTAMPTZ

kyc_documents
  id SERIAL PRIMARY KEY
  mentor_id INTEGER REFERENCES mentors(id)
  doc_type TEXT
  file_url TEXT
  status TEXT  -- pending | approved | rejected
  reviewed_by INTEGER REFERENCES users(id)
  reviewed_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
```

---

## 15. API Reference

### Marketplace

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/mentor-marketplace` | List mentors with filters |
| `GET` | `/api/mentor-marketplace/:id` | Mentor profile detail |
| `GET` | `/api/mentor-marketplace/suggestions` | AI-matched mentors for logged-in student |

### Bookings

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/mentor-marketplace/:id/book` | Create a booking |
| `GET` | `/api/mentor-marketplace/bookings` | List user's bookings |
| `GET` | `/api/mentor-marketplace/bookings/:id/messages` | Booking message thread |
| `POST` | `/api/mentor-marketplace/bookings/:id/messages` | Send a message |
| `POST` | `/api/mentor-marketplace/bookings/:id/notes` | Add session notes |

### Admin

| Method | Path | Description |
|---|---|---|
| `PATCH` | `/api/admin/mentors/:id/phi` | Update PHI score |
| `PATCH` | `/api/admin/mentors/:id/profile` | Edit mentor profile |
| `GET` | `/api/admin/mentors` | List all mentors |

---

## 16. Frontend Architecture

| File | Role |
|---|---|
| `frontend/src/pages/MentorMarketplacePage.tsx` | Marketplace listing |
| `frontend/src/pages/MentorProfilePage.tsx` | Individual mentor profile |
| `frontend/src/pages/MentorDashboardPage.tsx` | Mentor's own dashboard |
| `frontend/src/pages/JoinSessionPage.tsx` | Session entry + video setup |
| `frontend/src/components/BookSessionModal.tsx` | Booking flow modal |
| `frontend/src/components/VideoCallRoom.tsx` | Integrated video call |
| `frontend/src/components/MentorSessionNotes.tsx` | Post-session notes form |
| `frontend/src/components/MentorAgreementPage.tsx` | Legal onboarding + contract |
| `frontend/src/components/superadmin/MentorsPanel.tsx` | Admin governance panel |
| `frontend/server/src/routes/mentor.ts` | Full backend API implementation |

---

*Document generated from live codebase — MetryxOne Mentor Feature v1.0, May 2026*
