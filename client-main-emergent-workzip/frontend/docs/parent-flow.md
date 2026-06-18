# MetryxOne — Parent Flow Documentation

Complete reference for all screens, features, and user journeys available to a Parent/Guardian account.

---

## Table of Contents

1. [Account Setup](#1-account-setup)
   - 1.1 Registration
   - 1.2 Login
   - 1.3 Forgot Password
2. [Parent Dashboard](#2-parent-dashboard)
   - 2.1 Side Navigation Menu
   - 2.2 Overview Tab
   - 2.3 Learning Tab
   - 2.4 Insights Tab
3. [Child Management](#3-child-management)
   - 3.1 Add a Child
   - 3.2 Switch Between Children
   - 3.3 LBI Consent Management
4. [LBI Assessment Hub](#4-lbi-assessment-hub)
   - 4.1 Assessments Tab
   - 4.2 Insights Tab
   - 4.3 Reports Tab
5. [EXAM READY™ Module](#5-exam-ready-module)
   - 5.1 Landing
   - 5.2 Compare Plans
   - 5.3 Checkout
   - 5.4 Assessment Start
   - 5.5 Assessment
   - 5.6 Report Status
   - 5.7 Report View
   - 5.8 Disclaimer
6. [Mentor Marketplace](#6-mentor-marketplace)
   - 6.1 Marketplace Browse
   - 6.2 Mentor Profile
   - 6.3 Mentor Dashboard
7. [AI Tools & Reports](#7-ai-tools--reports)
   - 7.1 AI Powered Reports
   - 7.2 MetryxAI Assistant
8. [Learning Paths](#8-learning-paths)
9. [Quick Assessments](#9-quick-assessments)
   - 9.1 Mini Check
   - 9.2 Stress Check
10. [Account & Settings](#10-account--settings)
    - 10.1 Plans & Pricing
    - 10.2 Notification Preferences
    - 10.3 Theme Settings
11. [Full Screen Navigation Map](#11-full-screen-navigation-map)

---

## 1. Account Setup

### 1.1 Registration

**Route:** `/registration`  
**Accessed from:** Landing page → "Get Started" or "Register"

**Purpose:** Create a new MetryxOne account as a Parent/Guardian.

**Form Fields:**
| Field | Type | Required | Notes |
|---|---|---|---|
| Full Name | Text | Yes | Displayed in dashboard |
| Email Address | Email | Yes | Used as login username |
| Mobile Number | Phone | Optional | Used for OTP login |
| Password | Password (min 6 chars) | Yes | — |
| Confirm Password | Password | Yes | Must match |
| Role | Select | Yes | Choose "Parent / Guardian" |

**Role options available at registration:**
- Parent / Guardian — Track child's learning progress and behavioral insights
- Student (18+) — Direct access to exams and assessments
- School / College — Institutional partner
- Job Seeker — Career readiness tools
- NGO Partner — Community program access
- Corporate / HR Partner — Employee assessments

**Consent checkboxes (required):**
- Accept Terms of Service
- Accept Privacy Policy
- Accept Data Processing consent
- Optional: Marketing communications
- Optional: Callback request

**Validations:**
- Passwords must match and be at least 6 characters
- All required consents must be checked before submission

**On success:** Navigates to `/unified-parent-dashboard`

**API call:** `POST /api/register`  
Payload includes: `username` (email), `password`, `fullName`, `role: "parent"`, `mobileNumber`, `consents` object with timestamps

---

### 1.2 Login

**Route:** `/login`  
**Accessed from:** Landing page → "Login", or Navbar "Login" button

**Purpose:** Authenticate an existing parent account.

**Two authentication modes:**

#### Password Mode
| Field | Notes |
|---|---|
| Email or Username | Accepts either format |
| Password | Hidden by default, toggle to show |
| Remember Me | Checkbox to persist session |

#### OTP Mode (Mobile)
| Step | Action |
|---|---|
| 1 | Enter 10-digit mobile number (must start with 6–9) |
| 2 | Receive 6-digit OTP via SMS |
| 3 | Enter OTP (6 input boxes, auto-focus) |
| 4 | Maximum 3 OTP send attempts; 30-second resend timer |

**Bilingual support:** Toggle between English and Hindi at any point.

**Social login:** Google OAuth button available.

**Multi-role accounts:** If a user has multiple roles, a role-picker step appears after credentials are verified. The user selects which role to enter:
- Parent → `/unified-parent-dashboard`
- Institute → `/unified-institute-dashboard`
- Student → `/student-exam-list`
- Super Admin → `/super-admin`
- NGO → `/ngo-dashboard`
- HR → `/hr-dashboard`

**Links available:**
- Forgot Password → `/forgot-password`
- Register → `/registration`

**API calls:** `POST /api/login`, `POST /api/otp/send`, `POST /api/otp/verify`

---

### 1.3 Forgot Password

**Route:** `/forgot-password`  
**Accessed from:** Login page → "Forgot password?" link

**Purpose:** Reset account password via email link.

**Flow:**
1. User enters registered email address
2. System sends a password reset link to that email
3. Success screen shows: email address, instructions to check spam, "Open Email App" button, and resend option
4. Reset links expire in 30 minutes

**Bilingual support:** English / Hindi toggle

**Links available:**
- Back to Sign In → `/login`
- Contact Support → `/support`

---

## 2. Parent Dashboard

**Route:** `/unified-parent-dashboard`  
**Accessed from:** After successful login/registration as Parent, or Role Selection

**Purpose:** Central hub for all parent activities — child monitoring, assessments, insights, and tools.

**Layout:** Two-column layout. Left side: collapsible Side Navigation. Right side: main content area with tabs.

---

### 2.1 Side Navigation Menu

The left sidebar is always visible on desktop (collapsible) and hidden on mobile.

**Parent Side Menu Items:**

| Section | Menu Item | ID | Description |
|---|---|---|---|
| Main | Home | `dashboard` | Main dashboard overview |
| Main | Academics | `education` | Child education planner |
| Main | Progress | `insights` | Performance insights |
| Tools | Behavior Assessment | `lbi-product` | 19-domain LBI behavioral intelligence |
| Tools | Exam Readiness | `exam-ready` | Psychological readiness check |
| Tools | AI Reports | `ai-powered-reports` | Personalized growth insights |
| Tools | Ask MetryxAI | `metryxai-assistant` | 24/7 AI guidance |
| Account | Plans & Pricing | `pricing` | Upgrade subscription plan |

**Additional controls in sidebar:**
- Logo (click → Home)
- Collapse/expand toggle
- Logout button (bottom)
- Role Switcher (visible when user has multiple roles)

---

### 2.2 Overview Tab

The default landing tab on the dashboard. Provides a high-level snapshot of the selected child's status.

**Child Selector:**
- Dropdown to switch between registered children
- "Add Child" button (opens Add Child dialog)
- Displays child name, grade, school, and age

**Alerts Panel:**
Smart contextual alerts appear based on child's data:
- No LBI assessment yet → prompt to start behavioral assessment
- Pending consent required → prompt to grant LBI consent
- Upcoming scheduled exam → reminder card
- Assessment completed → view results prompt

**Quick Action Cards:**
| Action | Navigates To |
|---|---|
| Start Behavioral Assessment | `/parent-lbi` |
| Check Exam Readiness | `/exam-ready` |
| Book a Mentor | `/mentor-marketplace` |
| View AI Reports | Opens AI Reports panel inline |

**Upcoming Schedule Widget:**
- Displays upcoming assessments and exams
- Quick schedule button to assign a new test
- Calendar view of scheduled activities

**Notification Center:**
- Bell icon in top bar → opens notification panel
- Shows recent alerts, completions, and system messages

---

### 2.3 Learning Tab

Contains four sub-tabs managing different aspects of the child's learning journey.

#### Sub-tab: Assessments
- Lists all assigned behavioral and academic assessments
- Filter by: All / Pending / Completed
- Filter by subject
- Each assessment card shows: name, type, status, score (if completed), date
- "Assign Assessment" button → opens Assessment Browser dialog
  - Browse available assessments by grade
  - Select and schedule with date/time
- "Start Supervised Test" — parent can initiate a test session directly

#### Sub-tab: Tests (Test Manager)
- View all created and assigned tests
- Create new custom test via TestCreationManager
- See test status: Draft / Active / Completed
- Quick actions: Preview, Edit, Assign to child

#### Sub-tab: Study Planner
- AI-generated study plan for the selected child
- Shows weekly schedule across subjects
- Displays recommended daily study hours
- Tracks progress against the plan

#### Sub-tab: LBI Insights (Inline)
Embedded behavioral intelligence summary with domain scores:
- **Academic & Cognitive:** Learning Efficiency, Conceptual Understanding, Working Memory, Sustained Attention, Learning Style, Processing Stability
- **Discipline & Self-Management:** Time Management, Priority Management, Accountability, Execution, Plan-Execution Alignment, Consistency
- **Character & Values:** Commitment Stability, Integrity, Ownership Patterns, Effort Persistence, Identity Alignment

Each domain shows: score bar, trend indicator, short description.

Actions:
- "View Full LBI" → `/parent-lbi`
- "Book a Mentor" → `/mentor-marketplace`

---

### 2.4 Insights Tab

Deep performance analytics for the selected child.

**Components:**
- **Score Trends Chart:** Line/bar chart of exam scores over time per subject
- **Domain Breakdown:** Pie chart + table showing strength vs. weakness areas
- **Comparison View:** Child vs. peer group averages
- **LBI Correlation:** How behavioral patterns correlate with academic performance
- **AI Study Recommendations:** Personalized AI-generated action items

**Trend Indicators:**
- ↑ Improving (green)
- → Stable (gray)
- ↓ Declining (red)

---

## 3. Child Management

### 3.1 Add a Child

**Accessed from:** Overview tab → "Add Child" button  
**Type:** Multi-step dialog (2 steps)

**Step 1 — Basic Information:**
| Field | Options / Notes |
|---|---|
| Full Name | Text |
| Age | Number |
| Grade | Grade 1–12 |
| School Name | Text |
| Gender | Male / Female / Other / Prefer not to say |
| Date of Birth | Date picker |
| Blood Group | A+, A-, B+, B-, AB+, AB-, O+, O-, Unknown |
| Preferred Language | English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Other |
| Board | CBSE, ICSE, State Board, IB, IGCSE, NIOS, Other |
| City | Text |
| State | Dropdown (major Indian states) |
| Special Needs | Text (optional) |
| Daily Study Hours | Less than 1h / 1-2h / 2-3h / 3-4h / More than 4h |
| Favourite Subjects | Multi-select (Math, Science, English, Social Studies, Hindi, CS, Physics, Chemistry, Biology, History, Geography, Economics, Other) |
| Weak Subjects | Multi-select (same list) |
| Learning Style | Visual / Auditory / Reading-Writing / Kinesthetic / Mixed |
| Career Interest | Engineering, Medicine, Arts & Design, Business, Science, Law, Civil Services, Sports, Music, Technology, Undecided, Other |
| Parent Relationship | Mother / Father / Guardian / Grandparent / Other |
| School Type | Government / Private / International / Home School / Other |
| Medium of Instruction | English / Hindi / Regional Language / Bilingual |
| Extracurricular Activities | Text |
| Emergency Contact | Phone number |
| Medical Conditions | Text (optional) |

**Step 2 — Consents:**
All 5 checkboxes must be accepted:
- Data Collection consent (DPDP Act)
- Behavioral Assessment consent
- Progress Monitoring consent
- DPDP Act acknowledgment
- Development Purpose acknowledgment

**API call:** `POST /api/children` — Creates child profile linked to parent account

---

### 3.2 Switch Between Children

- Use the child dropdown at the top of the dashboard
- All data (assessments, scores, insights) updates to show the selected child
- Child ID is passed as state when navigating to LBI, Exam Ready, and Mentor screens

---

### 3.3 LBI Consent Management

Before any behavioral assessment can be taken, LBI consent must be granted per child.

**Consent Dialog Actions:**
- **Grant Consent** — Enables LBI assessment module for the child
- **Revoke Consent** — Disables LBI assessment; existing data is retained but no new sessions allowed

Consent status is shown on the Overview tab and LBI Assessment Hub.

---

## 4. LBI Assessment Hub

**Route:** `/parent-lbi`  
**Accessed from:** Dashboard → "Start Behavioral Assessment", Overview alerts, Learning tab LBI Insights section  
**Passed data:** `childId` (pre-selects child), `lbiTab` (opens to specific tab)

**Purpose:** The full Learning Behavior Intelligence assessment center for managing, taking, and reviewing behavioral assessments for a child.

**Layout:** Same two-column layout with Side Menu + content area.

**Child Selector:** Available at the top to switch between children.

---

### 4.1 Assessments Tab

Lists all available and completed LBI behavioral modules.

**LBI Domain Categories shown:**
| Category | Color | Sub-domains |
|---|---|---|
| Learning | Teal/Green | Learning efficiency, conceptual understanding |
| Attention | Orange | Sustained attention, task focus |
| Emotional | Pink/Red | Emotional regulation, self-awareness |
| Social | Blue | Peer interaction, communication |
| Discipline | Cyan | Time management, accountability |

**For each module:**
- Module name and code
- Status: Not Started / In Progress / Completed
- Score and percentile (if completed)
- "Start Assessment" button (requires LBI consent)
- View results (if completed)

**Consent Gate:**
If LBI consent has not been granted, a consent prompt appears with a "Grant Consent" button (navigates back to dashboard consent flow).

**Session Start Confirmation:**
Before starting a module, a confirmation dialog shows the child's name and asks the parent to confirm the child is ready.

**Assessment Player:**
When a session is started, the `LbiAssessmentPlayer` component loads inline. On completion, results are shown immediately.

---

### 4.2 Insights Tab

Visualisation of completed LBI assessment data.

**Displayed metrics:**
- LBI composite score
- Domain-level breakdown with bar indicators
- Trend over multiple sessions
- Strengths and areas for improvement summary
- Correlation notes (how behavior affects academics)

**Empty state:** Shows prompt to complete at least one assessment.

---

### 4.3 Reports Tab

Downloadable and viewable full LBI reports.

**Available reports (sample):**
| Report Name | Period | Status |
|---|---|---|
| Monthly LBI Summary | Jan 2026 | Ready |
| Domain Deep Dive | Dec 2025 | Ready |
| Progress Report | Nov 2025 | Ready |

**Report Metrics shown:**
- LBI Score with label
- Assessment date
- Percentile rank

Actions: View inline / Download PDF

---

## 5. EXAM READY™ Module

A dedicated sub-product within MetryxOne for exam readiness assessment. Has its own navigation flow separate from the main dashboard.

---

### 5.1 EXAM READY™ Landing

**Route:** `/exam-ready`  
**Accessed from:** Dashboard → "Check Exam Readiness", Side Menu → "Exam Readiness"

**Purpose:** Introduces the EXAM READY™ product. Explains what the readiness assessment covers and shows available plans.

**Key sections:**
- Hero: What EXAM READY™ measures (psychological, cognitive, and behavioral readiness)
- Feature highlights
- "Get Started" → `/exam-ready-compare`

---

### 5.2 Compare Plans

**Route:** `/exam-ready-compare`

**Purpose:** Shows all available EXAM READY™ plans side-by-side so the parent can choose the right option.

**Plan dimensions:**
- Assessment scope (number of domains)
- Report depth
- Price
- Board and grade compatibility

Action: Select a plan → `/exam-ready-checkout` (with `planId` passed as state)

---

### 5.3 Checkout

**Route:** `/exam-ready-checkout`  
**Props:** `isAuthenticated` (inherits from main app login), `planId`

**Purpose:** Purchase the selected EXAM READY™ plan.

**If not authenticated:** Redirects to `/exam-ready-login`  
**If authenticated:** Shows checkout form with selected plan details and payment options.

**Fields:** Board selection, Grade selection, payment method.

On purchase: Navigates to `/exam-ready-assessment-start` with `planId`, `board`, `grade` passed as state.

---

### 5.4 Assessment Start

**Route:** `/exam-ready-assessment-start`  
**Props:** `planId`, `board`, `grade`

**Purpose:** Briefing screen before the assessment begins. Explains:
- Duration
- Number of sections
- What to expect
- Instructions

Action: "Begin Assessment" → `/exam-ready-assessment` with `attemptId` created by API

---

### 5.5 Assessment

**Route:** `/exam-ready-assessment`  
**Props:** `attemptId`

**Purpose:** The actual exam readiness assessment player.

**Features:**
- Timer component showing remaining time
- Stepper showing section progress
- Question navigation
- Auto-save on answer selection
- Submit confirmation dialog

On completion: Navigates to `/exam-ready-report-status`

---

### 5.6 Report Status

**Route:** `/exam-ready-report-status`  
**Props:** `attemptId`

**Purpose:** Processing/waiting screen after assessment submission.

**Shows:**
- "Processing your results..." animation
- Estimated time remaining
- Polls API until report is ready
- On ready: auto-navigates to `/exam-ready-report-view`

---

### 5.7 Report View

**Route:** `/exam-ready-report-view`  
**Props:** `attemptId`

**Purpose:** Full exam readiness report for the child.

**Report sections:**
- Overall Readiness Score (0–100)
- Domain breakdown: Cognitive, Emotional, Behavioral, Time Management
- Strengths summary
- Areas for improvement
- Recommended action plan
- Comparison with board/grade peers

Actions: Download PDF, Share, Book a Mentor

---

### 5.8 Disclaimer

**Route:** `/exam-ready-disclaimer`

**Purpose:** Legal/informational disclaimer page for the EXAM READY™ module. Covers:
- Assessment limitations
- Data usage
- Not a medical diagnosis
- Contact information

---

## 6. Mentor Marketplace

### 6.1 Marketplace Browse

**Route:** `/mentor-marketplace`  
**Accessed from:** Dashboard quick actions, LBI Hub recommendations, Report View

**Purpose:** Browse and book verified mentors across multiple categories.

**Mentor Categories:**
| Category | Count | Description |
|---|---|---|
| Subject Tutors | 200+ | Expert teachers for Maths, Science, English, etc. |
| Counsellors | 80+ | Licensed psychologists for stress, anxiety, learning support |
| Exam Strategists | 120+ | JEE, NEET, UPSC preparation experts |
| Performance Coaches | 60+ | Time management, study habits, academic performance |

**Sections on the page:**
1. **Hero:** Title, search bar, description
2. **Stats Bar:** Total mentors, sessions completed, success rate, average rating
3. **Category Filter:** Browse by mentor type
4. **Results Grid:** Mentor cards showing name, subject, rating, price per session, availability
5. **CTA Section:** "Become a Mentor" link

**Mentor Card Details:**
- Name and initials avatar
- Subject / specialisation
- Star rating and review count
- Sessions completed
- Price per hour
- "View Profile" button → `/mentor-profile`
- "Book Now" button → `/mentor-profile` with `autoBook: true`

---

### 6.2 Mentor Profile

**Route:** `/mentor-profile`  
**Props:** `mentorId`, `autoBook` (optional)

**Purpose:** Full mentor profile with booking capability.

**Sections:**
| Section | Content |
|---|---|
| Bio | Photo, name, tagline, short biography |
| Qualifications | Degrees, certifications |
| Subjects | Subject specialisations with grade range |
| Languages | Languages of instruction |
| Experience | Years of experience, past roles |
| Availability | Calendar / time slot picker |
| Reviews | Student/parent testimonials with star ratings |
| Booking Panel | Session duration, price, slot selection, payment |

**If `autoBook` is true:** Booking dialog opens automatically.

**On successful booking:** Navigates to `/mentor-dashboard`

---

### 6.3 Mentor Dashboard

**Route:** `/mentor-dashboard`  
**Accessed from:** After booking a session, or from Side Menu

**Purpose:** View and manage upcoming and past mentor sessions (from parent's perspective — their child's sessions).

**Header:** Mentor name, photo, subject, rating displayed prominently.

**Dashboard Tabs:**
| Tab | ID | Content |
|---|---|---|
| Overview | `overview` | Summary of sessions, upcoming sessions, student progress |
| Sessions | `sessions` | Table of all sessions with status, date, duration, notes |
| Progress | `progress` | Student performance tracked across sessions |
| Students | `students` | Students under this mentor (in parent's case, the child) |
| Earnings | `earnings` | Not visible to parents (mentor-only view) |

**Student Progress Table:**
| Column | Description |
|---|---|
| Student Name | Child name |
| Subject | Topic covered |
| Sessions | Number of sessions completed |
| Trend | Stable / Improving / Declining |
| Improvement | Percentage change |
| Last Score | Most recent score |

---

## 7. AI Tools & Reports

### 7.1 AI Powered Reports

**Route:** `/ai-powered-reports`  
**Accessed from:** Side Menu → "AI Reports", Dashboard inline panel

**Purpose:** Comprehensive AI-generated reports on the child's learning journey.

**Report types available:**
- Growth Intelligence Report
- Behavioral Pattern Analysis
- Academic Trend Report
- Personalized Action Plan
- LBI-Academic Correlation Report

Each report shows: generated date, key findings, visual charts, actionable recommendations.

---

### 7.2 MetryxAI Assistant

**Route:** `/metryxai-assistant`  
**Accessed from:** Side Menu → "Ask MetryxAI", Chat widget (floating on dashboard)

**Purpose:** 24/7 AI chat assistant for parents to get guidance on their child's learning, assessments, and next steps.

**Features:**
- Natural language Q&A about child's LBI scores and what they mean
- Recommendations for study plans
- Explanations of report data
- Booking suggestions for mentors
- Quick links to relevant screens

**Chat Widget:** A floating bot button (MetryxBot) appears on the dashboard. Clicking it opens the chat panel without leaving the current screen. The widget shows:
- "Hey there!" greeting
- "Ask me about assessments, study plans, or student progress"
- Full chat interface with message history

---

## 8. Learning Paths

**Route:** `/learning-paths`  
**Accessed from:** Side Menu → Learning Paths (when available in navigation)

**Purpose:** Curated and AI-recommended learning pathways based on the child's grade, goals, and LBI profile.

**Content includes:**
- Subject-wise roadmaps
- Milestone markers
- Resource recommendations (videos, practice tests, reading materials)
- Progress tracking against the path

---

## 9. Quick Assessments

### 9.1 Mini Check

**Route:** `/mini-check`  
**Accessed from:** Dashboard quick actions, Landing page

**Purpose:** A short 5–10 minute cognitive snapshot assessment. Gives a quick reading on the child's current cognitive state.

**Output:** Instant result card with score and brief recommendations.

---

### 9.2 Stress Check

**Route:** `/stress-check`  
**Accessed from:** Dashboard quick actions, Landing page

**Purpose:** A brief stress and anxiety screening assessment for the child.

**Output:** Stress level indicator (Low / Moderate / High) with guidance and suggested next steps (e.g., book a counsellor, relaxation tips).

---

## 10. Account & Settings

### 10.1 Plans & Pricing

**Route:** `/pricing`  
**Props:** `role: 'parent'` (pricing shown is parent-specific)

**Purpose:** View and upgrade the parent's subscription plan.

**Plan tiers (parent-facing):**
- Free / Basic — Limited children, limited assessments
- Growth — More children, more assessments, AI reports
- Premium — Unlimited, full feature access

**Feature gating:** The dashboard uses `hasFeature()`, `getMaxChildren()`, `getMaxAssessments()`, and `isUpgradeRequired()` checks throughout. Locked features show an `UpgradePrompt` or `FeatureLockedCard` component with a link to `/pricing`.

**PlanUsageWidget:** Shown on the dashboard overview — displays current usage vs. plan limits.

---

### 10.2 Notification Preferences

**Route:** `/notification-preferences`  
**Accessed from:** Dashboard bell icon → settings, or direct navigation

**Purpose:** Configure what notifications the parent receives and how.

**Notification categories:**
- Assessment reminders
- Score/report ready alerts
- Mentor session reminders
- Platform updates and announcements

**Delivery channels:** In-app, Email, SMS (if mobile number provided)

---

### 10.3 Theme Settings

**Route:** `/theme-settings`  
**Accessed from:** Navbar theme toggle, direct navigation

**Purpose:** Customize the appearance of the MetryxOne interface.

**Options:**
- Light Mode / Dark Mode / System default
- Live preview of theme changes

---

## 11. Full Screen Navigation Map

```
/landing
├── /registration ──────────────────────────────────────────┐
│   └── (Parent role selected)                               │
├── /login ──────────────────────────────────────────────────┤
│   ├── /forgot-password                                     │
│   │   └── /support                                         │
│   └── (Parent role) ──────────────────────────────────────►│
│                                                            ▼
│                                         /unified-parent-dashboard
│                                          │
│                            ┌────────────┼────────────────────────────────────┐
│                            │            │                                    │
│                     SIDE MENU     MAIN TABS                            TOP BAR
│                     ────────     ─────────                            ───────
│                     Home          Overview                            Notifications
│                     Academics     Learning                            MetryxBot (chat)
│                     Progress      ├─ Assessments                     Role Switcher
│                     ─ TOOLS ─     ├─ Tests
│                     LBI           ├─ Study Planner
│                     Exam Ready    └─ LBI Insights
│                     AI Reports    Insights
│                     MetryxAI      ├─ Score Trends
│                     ─ ACCOUNT ─   ├─ Domain Breakdown
│                     Pricing       └─ AI Recommendations
│
├─── /parent-lbi (LBI Assessment Hub)
│     ├── Tab: Assessments
│     │     └── LBI session player (inline)
│     ├── Tab: Insights
│     └── Tab: Reports
│
├─── /exam-ready (EXAM READY™ Landing)
│     └── /exam-ready-compare (Compare Plans)
│           └── /exam-ready-checkout (Purchase)
│                 ├── /exam-ready-login (if not authenticated)
│                 └── /exam-ready-assessment-start (Briefing)
│                       └── /exam-ready-assessment (Take Test)
│                             └── /exam-ready-report-status (Processing)
│                                   └── /exam-ready-report-view (Final Report)
│
├─── /mentor-marketplace (Browse Mentors)
│     └── /mentor-profile (Mentor Detail + Booking)
│           └── /mentor-dashboard (Session Management)
│
├─── /ai-powered-reports (AI Report Center)
│
├─── /metryxai-assistant (AI Chat)
│
├─── /learning-paths (Learning Roadmaps)
│
├─── /mini-check (Quick Cognitive Check)
│
├─── /stress-check (Stress Screening)
│
├─── /pricing (Subscription Plans)
│
├─── /notification-preferences (Alert Settings)
│
└─── /theme-settings (UI Theme)
```

---

## Key State Variables

When navigating between screens, the following data is passed as state via `handleNavigate(screen, data)`:

| State Key | Type | Used By |
|---|---|---|
| `childId` | string | parent-lbi, Overview tab |
| `tab` | `'exams' \| 'lbi'` | student-exam-list |
| `lbiTab` | `'assessments' \| 'insights' \| 'reports'` | parent-lbi |
| `examId` | string | exam-player |
| `ageBandId` | string | lbi-assessment |
| `domainId` | string | lbi-assessment |
| `mentorId` | string | mentor-profile |
| `autoBook` | boolean | mentor-profile (opens booking dialog) |
| `planId` | string | exam-ready-assessment-start |
| `board` | string | exam-ready-assessment-start |
| `grade` | string | exam-ready-assessment-start |
| `attemptId` | string | exam-ready-assessment, report-status, report-view |

---

## API Endpoints Used by Parent Flow

| Endpoint | Method | Used By |
|---|---|---|
| `/api/register` | POST | Registration |
| `/api/login` | POST | Login (password mode) |
| `/api/otp/send` | POST | Login (OTP mode) |
| `/api/otp/verify` | POST | Login (OTP mode) |
| `/api/auth/user` | GET | Session check on app load |
| `/api/forgot-password` | POST | Forgot Password |
| `/api/dashboard` | GET | Parent Dashboard data |
| `/api/user` | GET | Current user info |
| `/api/children` | POST | Add Child |
| `/api/children/:id/consent` | PATCH | Update LBI consent |
| `/api/assessments` | GET | Browse available assessments |
| `/api/supervised-test` | POST | Start supervised test session |

---

## Security & Compliance

- **256-bit SSL** encryption on all API calls
- **DPDP Act (India)** compliant — all consents are recorded with timestamps
- **SOC2 Certified** platform infrastructure
- Child data requires explicit parental consent before any behavioral assessment
- LBI consent can be revoked at any time; existing session data is retained
- Consent timestamps are stored server-side with the user registration payload

---

*Last updated: March 2026*
