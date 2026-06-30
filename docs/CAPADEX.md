# CAPADEX — Complete Documentation (Consolidated)

> **Consolidated 2026-06-01.** This single file is the one source of truth for CAPADEX. It replaces four previously-separate documents:
> - `docs/CAPADEX.md` — technical runtime reference (Modules 15–26)
> - `CAPADEX_Document.md` — product / system overview
> - `CAPADEX_Complete_Documentation.md` — API reference
> - `docs/CAPADEX_QUESTION_RELEVANCE_AUDIT.md` — generated relevance audit (snapshot below)
>
> The relevance audit is **machine-generated**; the snapshot in Part IV reflects the last run. Regenerate the live report with `cd backend && npx tsx scripts/audit-question-relevance.ts` (now writes to `audit/`, not `docs/`, so this file stays the single doc).

## Contents
- **Part I** — Product & System Overview
- **Part II** — Technical Runtime Reference (Modules 15–26)
- **Part III** — API Reference
- **Part IV** — Question Relevance Audit (generated snapshot)

---

# PART I — Product & System Overview

# CAPADEX — Comprehensive System Document
**MetryxOne Behavioral Intelligence Platform**
*Version 1.1 — May 2026*

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Stage Architecture](#2-stage-architecture)
3. [Pricing & Packaging](#3-pricing--packaging)
4. [User Flow & Phase Map](#4-user-flow--phase-map)
5. [Assessment Engine](#5-assessment-engine)
6. [Scoring & Intelligence](#6-scoring--intelligence)
7. [Post-Completion Intelligence Hooks](#7-post-completion-intelligence-hooks)
8. [Signal Capture Layer](#8-signal-capture-layer)
9. [OMEGA-X Report Intelligence](#9-omega-x-report-intelligence)
10. [Pragati Conversational Runtime](#10-pragati-conversational-runtime)
11. [Enterprise Intelligence Panels](#11-enterprise-intelligence-panels)
12. [Database Schema](#12-database-schema)
13. [API Reference](#13-api-reference)
14. [Frontend Architecture](#14-frontend-architecture)
15. [Security & Authentication](#15-security--authentication)

---

## 1. Product Overview

**CAPADEX** (Capacity + Development + Index) is a progressive, multi-stage behavioral intelligence assessment system built into the MetryxOne platform. It surfaces a user's cognitive patterns, behavioral tendencies, and developmental stage through structured psychometric assessments delivered as a conversational, mobile-first experience.

### What it does

CAPADEX maps a user's concern — academic, occupational, emotional, social, or cognitive — through four progressively deeper assessment stages. Each stage produces a structured intelligence report with domain scores, detected behavioral patterns, risk flags, and actionable recommendations. The system learns across sessions, detects longitudinal drift, and feeds enterprise-grade analytics dashboards.

### Who it is for

| Persona | Description |
|---|---|
| **Students** | Academic concerns, exam stress, focus issues, social difficulty |
| **Job Seekers** | Career clarity, interview anxiety, skill gaps |
| **Professionals** | Work stress, leadership development, career plateau |
| **Campus Users** | Campus life, peer relations, identity concerns |
| **Enterprise HR** | Workforce behavioral profiling, risk detection, intervention tracking |

### Core value proposition

- No login required to start — anonymous entry, OTP verification only at report stage
- Free first stage (Curiosity) lowers the barrier to entry with zero commitment
- Each stage deepens the intelligence; users return with measurable progress
- Longitudinal memory — the system remembers and compares across sessions
- Enterprise analytics layer for HR, counselors, and administrators

---

## 2. Stage Architecture

CAPADEX is structured as four sequential coded stages. Each stage builds on the previous one — users must complete a stage before the next becomes available.

| # | Code | Label | Theme | Pricing | Questions |
|---|---|---|---|---|---|
| 0 | `CAP_CUR` | Curiosity | Surface awareness & behavioural first signals | **Free** | 10 |
| 1 | `CAP_INS` | Insight | Root-cause decode & competency gap analysis | ₹499 | ~15 |
| 2 | `CAP_GRW` | Growth | 30-day strategy & habit formation plan | ₹999 | ~15 |
| 3 | `CAP_MAS` | Mastery | Full 19-domain profile & expert debrief | ₹1,999 | ~20 |

> **Curiosity (CAP_CUR) is the free entry stage.** It orients the user to their concern, runs the concern-resolution engine, and produces a first-signal snapshot — enough to show value and motivate progression to the paid Insight stage.
>
> **"Clarity" is the sanctioned user-facing display alias of Insight (CAP_INS) — the same stage, never a separate or fifth stage.** A separate uncoded pre-stage, "Awareness", exists only inside the stored-string progression projection used for CSI weighting (§6); it is never a coded assessment stage.

### Stage status lifecycle

```
available → in_progress → completed → [payment required] → available (next stage)
```

A stage transitions from `available` to `in_progress` when the user starts answering questions. On completing all questions and submitting, it moves to `completed`. The next stage starts as `locked` until payment is confirmed (except Curiosity which is always free).

### Bundle options

| Bundle | Includes | Price |
|---|---|---|
| **Growth Bundle** | Insight + Growth (CAP_INS + CAP_GRW) | Bundled pricing |
| **Mastery Bundle** | All four stages (complete journey) | ₹1,999 |

When a user purchases Mastery Bundle, all stages are covered. When a user purchases Growth Bundle, CAP_INS and CAP_GRW are covered.

### Stage colours (UI)

| Stage | Accent | Background | Border |
|---|---|---|---|
| Curiosity | `#344E86` | `#EEF2FF` | `#C7D2FE` |
| Insight | `#7C3AED` | `#F5F3FF` | `#DDD6FE` |
| Growth | `#0F766E` | `#F0FDFA` | `#6EE7B7` |
| Mastery | `#D97706` | `#FFFBEB` | `#FCD34D` |

---

## 3. Pricing & Packaging

Pricing is managed via the `/api/capadex/pricing` API, which returns per-stage pricing metadata. The pricing object is consumed in both IntroPhase (Stage Journey accordion) and the PaymentPhase.

### Pricing entry shape (`CapadexPricingEntry`)

```typescript
interface CapadexPricingEntry {
  price: string;           // e.g. "₹499", "Free"
  price_note: string;      // e.g. "one-time · instant results"
  tag: string;             // e.g. "Best Value", "Most Impactful"
  description: string;     // Stage description paragraph
  benefits: string[];      // Bullet list of what the user gets
  whatsapp_number: string; // WhatsApp number for counsellor chat
}
```

### Tag badge colour coding

| Tag | Background | Text |
|---|---|---|
| Entry Stage | `#E5E7EB` | `#374151` |
| Most Impactful | `#EDE9FE` | `#5B21B6` |
| Best Value | `#CCFBF1` | `#0F766E` |
| Complete Package | `#FEF3C7` | `#B45309` |

### Payment flow

When a user taps "Unlock [Stage]", `handleUnlockRequest()` is called with the stage code, name, price, color palette, benefits, price note, and WhatsApp number. This sets `paymentStageData` in state and navigates to the `capadex_payment` phase. After payment confirmation, `startNextStageAfterPayment()` creates a new session for the unlocked stage.

Curiosity (`CAP_CUR`) is always free — it is excluded from the `STAGE_PRICES` map in the payments backend and the UI never shows an unlock button for it.

---

## 4. User Flow & Phase Map

The entire assessment runs as a single-page modal (`FreeAssessmentModal.tsx`) with phase-based navigation. The `phase` string is the FSM state that determines which component is rendered.

### Complete phase sequence

```
intro
  └─ capadex_analyze              (concern parsing + AI mapping)
       └─ capadex_clarify         (disambiguate edge cases)
            └─ capadex_preview    (show what's coming)
                 └─ capadex_cur_profile  (Curiosity stage intro — FREE)
                      └─ capadex_questions   (answer 10 Likert questions)
                           └─ capadex_result   (score + level card)
                                └─ capadex_register  (capture email)
                                     └─ capadex_otp  (verify email)
                                          └─ capadex_report  (full intelligence report)
                                               └─ intro (return, Stage Journey shown)
                                                    └─ capadex_payment (for paid stages)
                                                         └─ capadex_[ins|grw|mas]_profile
                                                              └─ capadex_questions → result → report
```

### Phase components

| Phase string | Component | Purpose |
|---|---|---|
| `intro` | `IntroPhase.tsx` | Entry screen, returning user Stage Journey |
| `capadex_analyze` | `CapadexAnalyzePhase.tsx` | Animated concern analysis |
| `capadex_clarify` | `CapadexClarifyPhase.tsx` | Concern disambiguation |
| `capadex_preview` | `CapadexPreviewPhase.tsx` | Stage preview + domain list |
| `capadex_cla_profile` | `CapadexClaProfilePhase.tsx` | Legacy component — not wired into the current 4-coded flow (no stage-code maps to it); superseded by `capadex_cur_profile`. "Clarity" is the display alias of Insight, not a separate stage. |
| `capadex_cur_profile` | `CapadexCurProfilePhase.tsx` | **Curiosity stage intro (free entry)** |
| `capadex_ins_profile` | `CapadexInsProfilePhase.tsx` | Insight stage intro |
| `capadex_grw_profile` | `CapadexGrwProfilePhase.tsx` | Growth stage intro |
| `capadex_mas_profile` | `CapadexMasProfilePhase.tsx` | Mastery stage intro |
| `capadex_questions` | `CapadexQPhase.tsx` | Animated question delivery |
| `capadex_result` | `CapadexResultPhase.tsx` | Score card + level |
| `capadex_register` | `CapadexRegisterPhase.tsx` | Email capture |
| `capadex_otp` | `CapadexOtpPhase.tsx` | OTP verification |
| `capadex_report` | `CapadexReportPhase.tsx` | Full intelligence report |
| `capadex_payment` | `CapadexPaymentPhase.tsx` | Payment & unlock |
| `capadex_package_selection` | `CapadexPackageSelectionPhase.tsx` | Bundle picker |
| `capadex_bridge` | `CapadexBridgePhase.tsx` | Inter-stage transition |

### Concern resolution

When a user types their concern, `resolveCapadexConcern(input, persona)` maps the free-text to the best available structured concern name using 40+ regex rules, persona-aware:

- **Adult personas** (professional, jobseeker, campus): maps to Work Stress, Career Anxiety, Focus at Work, Digital Distraction
- **Student personas**: maps to Exam Stress, Academic Pressure, Focus, Social Anxiety, Peer Pressure, Career Confusion, etc.
- Fallback: never returns null — defaults to `Focus at Work` (adult) or `Exam Stress` (student)

---

## 5. Assessment Engine

### Question structure

Each assessment item (`CapadexQuestion`) carries:

| Field | Description |
|---|---|
| `item_code` | Unique identifier (e.g. `CUR_001`) |
| `subdomain_code` | Subdomain the item measures |
| `question` | Question text |
| `weight` | Scoring weight (`1.0` – `3.0`) |
| `polarity` | `positive` or `negative` (inverts scoring) |
| `age_band` | Target age group (`13-17`, `18+`, etc.) |
| `layer_tag` | Cognitive layer being assessed |
| `anchor` | Whether this item is an anchor/calibration item |
| `domain` | Parent domain |
| `dimension` | Psychological dimension |
| `logic` | Scoring logic descriptor |
| `response_range` | Scale range (default `1-5`) |
| `opt_a` – `opt_e` | Likert label overrides |

### Response capture

- Users respond on a 1–5 Likert scale
- Each response is saved immediately via `POST /api/capadex/session/:id/respond`
- Responses are stored in `capadex_responses` with raw value, weighted score, and subdomain code

### Session management

- Sessions are identified by `session_id` (UUID)
- A session belongs to a `(concern_name, stage_code, user)` triplet
- Resumable: if a user returns mid-session, `POST /api/capadex/session/start` auto-resumes if an in-progress session exists for the same concern
- Incomplete sessions are surfaced in IntroPhase as "Unfinished Assessment Found" with the answered/total count

---

## 6. Scoring & Intelligence

### Item-level scoring (`computeItemScore`)

Located in `backend/lib/scoring-utils.ts`.

```
normalizedScore = (raw - 1) / (max - 1) × 100
if polarity === 'negative': score = 100 - normalizedScore
weightedScore = normalizedScore × weight
```

### Stage score

The final stage score is the mean of all weighted item scores, normalized to 0–100.

### Score levels

| Range | Level |
|---|---|
| 80–100 | Advanced / Mastery |
| 60–79 | Proficient |
| 40–59 | Developing |
| 0–39 | Emerging |

### CSI — Career Stage Index

The CSI is a cross-stage weighted composite score:

```
CSI = Σ(stage_score × weight) / Σ(weights)
```

| Stage | Weight |
|---|---|
| Awareness (uncoded pre-stage) | 0.25 |
| Curiosity | 0.50 |
| Insight (display alias *Clarity*) | 0.75 |
| Growth | 1.00 |
| Mastery | 1.25 |

CSI is auto-calculated as a non-blocking post-completion hook after every CAPADEX session and stored in `csi_profiles`.

### Score trace (explainability)

Every score is stored with a `score_trace` JSONB column containing the full formula, input values, item weights, and polarity applied — enabling admin transparency and audit.

### Subdomain intelligence

The report breaks the stage score into subdomain averages, each rendered as a bar with:
- Subdomain name
- Score (0–100)
- Visual heatmap colour (green → amber → red)
- Detected pattern tags

---

## 7. Post-Completion Intelligence Hooks

After every `POST /api/capadex/session/:id/complete`, a suite of non-blocking intelligence hooks fire automatically.

### Hook pipeline

```
postCompletionHooks(sessionId, stageCode, score, userId)
  ├── generateRecommendations()   → capadex_recommendations
  ├── flagRisks()                 → capadex_risk_flags  (score < 40)
  ├── updateLDE()                 → developmental_trajectory
  ├── runRIE()                    → capadex_interventions
  ├── awardXP()                   → capadex_gamification
  └── logAuditEvent()             → capadex_audit_events
```

### Recommendations

Two recommendations are generated per session, level-calibrated:
- **Emerging**: Foundation building, awareness exercises
- **Developing**: Structured practice, habit loops
- **Proficient**: Challenge amplification, peer application
- **Advanced**: Mastery integration, teaching/mentoring

### Risk flagging

Sessions with `score < 40` are automatically flagged with severity:
- `score < 20`: `critical`
- `score 20–39`: `high`

Flags are stored in `capadex_risk_flags` and surface in the enterprise SignalIntelligencePanel.

### Gamification

| Stage completed | XP awarded | Badge unlocked |
|---|---|---|
| CAP_CUR | 100 XP | — |
| CAP_INS | 150 XP | `deep_diver` (if score ≥ 70) |
| CAP_GRW | 200 XP | — |
| CAP_MAS | 250 XP | `master_mind` (if score ≥ 75) |

### Cognitive state seeding

After CAP_CUR (Curiosity) completion, `seedInitialState()` bootstraps the cognitive state model for the user. After each subsequent stage, `updateStateOnStageComplete()` advances the model.

---

## 8. Signal Capture Layer

The BIOS Signal Capture layer runs alongside the assessment to collect behavioral telemetry.

### Signal types captured

| Signal Type | Description |
|---|---|
| `response_timing` | Time taken per answer (ms) |
| `confidence_variance` | Std deviation of scores within a subdomain |
| `reversal_count` | How many times user changed answer |
| `anchor_delta` | Deviation from anchor/calibration items |
| `linguistic_summary` | Keywords in the concern text |
| `cognitive_load` | Composite score from timing + reversal patterns |
| `emotional_weight` | Semantic heaviness of concern phrase |
| `early_warnings` | Pre-assessment distress signals |

### Signal ingestion

```
POST /api/signals/ingest
Body: { session_id, signal_type, payload, severity }
```

Signals are stored in `capadex_session_signals` and aggregated into `capadex_signal_profiles` per user.

### Linguistic signal extraction

22 keyword-regex rules extract named signals from user text during both the CAPADEX concern entry and the Pragati conversational runtime. These signals accumulate across sessions and inform the signal profile.

---

## 9. OMEGA-X Report Intelligence

Every completed session generates a structured intelligence report accessible via:

```
GET /api/capadex/report/:session_id/omega
```

### Report cards

| Card | Content |
|---|---|
| **Report Quality** | 4-dimension quality score: data completeness, response consistency, anchor alignment, item coverage |
| **Behavioural Memory** | Longitudinal memory — compares current session signals to prior session patterns |
| **Response Intelligence** | Contradiction detection, response pattern anomalies |
| **Emotional Heatmap** | Subdomain bars colour-coded by emotional load |

### Quality dimensions

| Dimension | Measures |
|---|---|
| `data_completeness` | % of items answered |
| `response_consistency` | Internal consistency across related items |
| `anchor_alignment` | Agreement with calibration items |
| `item_coverage` | Distribution across subdomains |

### Longitudinal memory

`GET /api/capadex/report/:session_id/omega` includes `longitudinal_memory` when the user has prior sessions for the same concern. It surfaces:
- Prior score vs current score
- Signal drift direction (worsening / stabilizing / recovering / improving)
- New patterns detected since last session
- Patterns that have resolved

### Contradiction detection

The `detectContradictions()` service flags logically inconsistent response pairs within the same session (e.g. high focus score but high distraction score).

---

## 10. Pragati Conversational Runtime

Pragati is CAPADEX's behavioral conversational companion — a structured FSM-based chat that runs a user through reflective dialogue about their concern, producing its own intelligence report.

### States (13-state FSM)

```
emotional_entry
  → concern_recognition
    → reflective_exploration
      → emotional_contextualization
        → behavioural_mapping
          → pattern_emergence
            → behavioural_synthesis
              → reassurance
                → clarity_generation
                  → growth_transition
                    → progression_reflection
                      → insight_transition
                        → complete
```

### Block types (rendered in conversation)

| Type | Visual treatment | Purpose |
|---|---|---|
| `reflection` | Italic, gentle | Empathic reflection of user input |
| `bridge` | Transition prose | State-to-state transition |
| `question` | With choice chips | Elicit structured response |
| `insight` | Blue highlight | Pattern observation |
| `reassurance` | Green highlight | Normalise & validate |
| `pattern_detection` | Amber | Named pattern with explainability pills |
| `progression` | Purple | Growth / stage advancement marker |
| `closure` | Centred, calm | Session conclusion |

### Key engines

| Engine | Description |
|---|---|
| **Signal extractor** | 22 keyword-regex rules → named signals per turn |
| **Reflection engine** | 23 templates, matched by concern family + active signals |
| **Bridge engine** | 18 signal-keyed transition phrases for state changes |
| **Pattern detector** | 11 rules with `detection_basis[]` arrays for explainability |
| **Quality engine** | 4-dimension 0–100 quality score per session |
| **Drift detector** | Compares current vs prior session signals → trend label |
| **Escalation engine** | Auto-flags crisis language + shame+helplessness+chronic combo |
| **Pacing engine** | Adjusts density (slow/medium) based on emotional weight |
| **Safety middleware** | 5 rules filtering diagnostic / pathologising language |

### Ontology

12 concern types mapped to concern families:

| Concern family | Includes |
|---|---|
| academic | Study, exams, grades |
| occupational | Work, career, job |
| cognitive | Focus, memory, executive function |
| social | Peer relations, communication |
| professional | Leadership, performance |
| emotional | Anxiety, mood, regulation |
| motivational | Drive, procrastination, purpose |
| identity | Self-concept, values, direction |
| digital | Screen use, social media |
| relational | Family, romantic, attachment |
| physiological | Sleep, energy, health |
| mixed | Cross-domain concerns |

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/pragati/session/start` | Create session, personalise for returning users |
| `POST` | `/api/pragati/session/:id/respond` | Full runtime turn: extract signals, run FSM, generate blocks |
| `GET` | `/api/pragati/session/:id/resume` | Session recovery — replays all prior turn blocks |
| `GET` | `/api/pragati/flow-config` | FSM config & transition map |
| `GET` | `/api/pragati/ontology` | Concern family ontology |
| `GET` | `/api/admin/pragati/sessions` | Admin session overview + quality stats |
| `GET` | `/api/admin/pragati/escalations` | Flagged sessions for human review |
| `PATCH` | `/api/admin/pragati/escalations/:id/resolve` | Resolve escalation |

### `pragati_sessions` DB columns

```sql
current_state          TEXT
signal_store           JSONB
patterns               JSONB
reflection_history     JSONB
conversation_blocks    JSONB
narrative_stage        TEXT
pacing_level           TEXT
turn_count             INTEGER
quality_score          NUMERIC
emotional_weight       NUMERIC
escalation_flagged     BOOLEAN
escalation_reason      TEXT
drift_direction        TEXT
```

---

## 11. Enterprise Intelligence Panels

The SuperAdmin Dashboard (`/api/admin/`) includes the following CAPADEX enterprise panels:

### CapadexUsersPanel

- Full user list with stage progress, last active, CSI score
- Filter by stage, persona, risk level
- Export to CSV

### CapadexAnalyticsPanel

- Stage completion rates by cohort
- Score distribution heatmaps
- Concern category breakdown
- Completion funnel by persona

### CapadexInterventionsPanel

- All triggered interventions from the RIE engine
- Filterable by priority, status, concern type
- Manual escalation option

### CapadexPricingPanel

- Live edit of pricing metadata per stage
- Tag, price_note, benefits list, WhatsApp number
- Real-time preview of how it renders in the user journey

### CapadexReportsPanel

- Browse all completed reports
- View OMEGA-X quality score, contradiction flags, longitudinal memory
- Filter by score level, concern, date range

### SignalIntelligencePanel

- Real-time behavioral telemetry dashboard
- Session signals, cognitive load scores, early warnings
- Risk flag list with severity breakdown

---

## 12. Database Schema

### Core assessment tables

```sql
capadex_sessions
  id UUID PRIMARY KEY
  session_id UUID UNIQUE
  user_id INTEGER REFERENCES capadex_users(id)
  guest_email TEXT
  concern_name TEXT
  stage_code TEXT  -- CAP_CUR | CAP_INS | CAP_GRW | CAP_MAS
  stage_index INTEGER
  status TEXT  -- available | in_progress | completed | locked
  score NUMERIC
  score_level TEXT
  score_trace JSONB
  answered_items INTEGER
  total_items INTEGER
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

capadex_responses
  id SERIAL PRIMARY KEY
  session_id UUID REFERENCES capadex_sessions(session_id)
  item_code TEXT
  subdomain_code TEXT
  raw_value INTEGER
  weighted_score NUMERIC
  created_at TIMESTAMPTZ

capadex_reports
  id SERIAL PRIMARY KEY
  session_id UUID REFERENCES capadex_sessions(session_id)
  concern_name TEXT
  participant_name TEXT
  stage_code TEXT
  overall_score NUMERIC
  subdomain_averages JSONB
  insights JSONB
  patterns JSONB
  recommendations JSONB
  created_at TIMESTAMPTZ

capadex_users
  id SERIAL PRIMARY KEY
  email TEXT UNIQUE
  name TEXT
  password_hash TEXT
  persona TEXT
  age INTEGER
  created_at TIMESTAMPTZ

capadex_otps
  id SERIAL PRIMARY KEY
  email TEXT
  otp TEXT
  expires_at TIMESTAMPTZ
  used BOOLEAN
```

### Intelligence & enterprise tables

```sql
capadex_recommendations
  id SERIAL PRIMARY KEY
  session_id UUID
  level TEXT  -- emerging | developing | proficient | advanced
  recommendation TEXT
  priority INTEGER
  created_at TIMESTAMPTZ

capadex_risk_flags
  id SERIAL PRIMARY KEY
  session_id UUID
  severity TEXT  -- high | critical
  score NUMERIC
  concern_name TEXT
  resolved BOOLEAN
  created_at TIMESTAMPTZ

capadex_interventions
  id SERIAL PRIMARY KEY
  user_id INTEGER
  session_id UUID
  type TEXT
  content TEXT
  priority TEXT
  status TEXT  -- pending | delivered | completed
  created_at TIMESTAMPTZ

capadex_gamification
  id SERIAL PRIMARY KEY
  user_id INTEGER
  xp INTEGER
  badges JSONB
  updated_at TIMESTAMPTZ

capadex_audit_events
  id SERIAL PRIMARY KEY
  session_id UUID
  event_type TEXT
  payload JSONB
  created_at TIMESTAMPTZ

capadex_user_profiles
  id SERIAL PRIMARY KEY
  user_id INTEGER REFERENCES capadex_users(id)
  profile_data JSONB
  updated_at TIMESTAMPTZ

capadex_consent_records
  id SERIAL PRIMARY KEY
  user_id INTEGER
  consent_type TEXT
  given_at TIMESTAMPTZ
```

### Signal capture tables

```sql
capadex_session_signals
  id SERIAL PRIMARY KEY
  session_id UUID
  signal_type TEXT
  payload JSONB
  severity TEXT
  created_at TIMESTAMPTZ

capadex_signal_profiles
  id SERIAL PRIMARY KEY
  user_id INTEGER
  risk_score NUMERIC
  cognitive_load NUMERIC
  emotional_load NUMERIC
  early_warnings JSONB
  updated_at TIMESTAMPTZ

capadex_linguistic_signals
  id SERIAL PRIMARY KEY
  session_id UUID
  signal_name TEXT
  matched_text TEXT
  created_at TIMESTAMPTZ
```

### CSI & BIOS Intelligence tables

```sql
csi_profiles
  id SERIAL PRIMARY KEY
  user_id INTEGER
  csi_score NUMERIC
  stage_scores JSONB
  updated_at TIMESTAMPTZ

csi_trajectory
  id SERIAL PRIMARY KEY
  user_id INTEGER
  csi_score NUMERIC
  recorded_at TIMESTAMPTZ

developmental_trajectory
  id SERIAL PRIMARY KEY
  user_id INTEGER
  stage_code TEXT
  score NUMERIC
  trajectory JSONB
  recorded_at TIMESTAMPTZ
```

---

## 13. API Reference

### Public (no auth)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/capadex/session/start` | Start or resume a stage session |
| `POST` | `/api/capadex/session/:id/respond` | Save a question response |
| `POST` | `/api/capadex/session/:id/complete` | Score stage, trigger hooks, advance |
| `GET` | `/api/capadex/progress` | Full journey for email + concern |
| `GET` | `/api/capadex/concerns` | Concern availability map |
| `GET` | `/api/capadex/pricing` | Pricing metadata for all stages |
| `GET` | `/api/capadex/report/:session_id/omega` | OMEGA-X intelligence report |
| `POST` | `/api/capadex/user/register` | Register user (name, email, password) |
| `POST` | `/api/capadex/user/login` | Authenticate user |
| `POST` | `/api/capadex/otp/send` | Send OTP to email |
| `POST` | `/api/capadex/otp/verify` | Verify OTP |

### POST /api/capadex/session/start

**Request:**
```json
{
  "concern_name": "Exam Stress",
  "user_age": 17,
  "persona": "student",
  "guest_email": "user@example.com",
  "guest_name": "Aryan"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "stage_code": "CAP_CUR",
  "stage_index": 0,
  "stage_color": "#344E86",
  "questions": [...],
  "progress": [...]
}
```

### POST /api/capadex/session/:id/complete

**Response:**
```json
{
  "session_id": "uuid",
  "stage_code": "CAP_CUR",
  "score": 67.4,
  "score_level": "Proficient",
  "level_color": "#059669",
  "insight": "Your awareness of how stress manifests is above average...",
  "next_stage": "CAP_INS",
  "next_stage_locked": true,
  "subdomain_averages": { "Focus": 72, "Self-Regulation": 63, ... },
  "patterns": [...],
  "recommendations": [...]
}
```

### Admin (super-admin auth required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/capadex/users` | All users with journey progress |
| `GET` | `/api/admin/capadex/analytics` | Aggregate stage stats |
| `GET` | `/api/admin/capadex/interventions` | All interventions |
| `GET` | `/api/admin/capadex/risk-flags` | Risk flags with severity |
| `GET` | `/api/admin/signals/dashboard` | Signal intelligence dashboard |
| `GET` | `/api/admin/pragati/sessions` | Pragati session list |
| `GET` | `/api/admin/pragati/escalations` | Escalated sessions |
| `PATCH` | `/api/admin/pragati/escalations/:id/resolve` | Resolve escalation |

---

## 14. Frontend Architecture

### Entry points

The CAPADEX flow is triggered from two landing page CTAs in `LandingPage.tsx`:
- **"Get My Stage Analysis"** → opens `FreeAssessmentModal` → `IntroPhase`
- **"Start Your Clarity Journey"** → opens `PragatiWorkspace`

### FreeAssessmentModal.tsx

The orchestrator component (~4,150 lines). Manages:
- All phase state (`phase` string FSM)
- All CAPADEX session state (`capadexSessionId`, `capadexStage`, `capadexItems`, etc.)
- All user identity state (`participantName`, `regEmail`, `userAge`, `selectedPersona`)
- All pricing state (`capadexPricing: Record<string, CapadexPricingEntry>`)
- Payment flow state (`paymentStageData`, `handleUnlockRequest`, `handlePaymentProceed`)
- Resume/incomplete session detection
- Post-OTP navigation

All state and handlers are passed to phase components via `PhaseProps`.

### IntroPhase Stage Journey

When a returning user verifies their email (OTP), the Stage Journey accordion is shown. It renders all 4 stages with smart state detection:

| State | Visual |
|---|---|
| `isDone` | Green card, score badge, date, completed checkmark |
| `isCoveredByBundle` | Green card, "Included via [Bundle]" badge |
| `isNext` | Coloured card (per-stage palette), NEXT badge, tag badge, price_note subtitle, expanded by default |
| `isGrowthBundle` | Teal card, ⬆ BUNDLE chip |
| `isMasteryBundle` | Amber card, ✦ BUNDLE chip |
| `isLocked` | Grey dashed card, lock icon |

Progress counter in the header shows `X / 4 complete` using bundle-aware logic.

### PragatiWorkspace.tsx

Three-panel layout:
- **Left**: Identity card, narrative stage, journey progress, signal map, quality score, drift badge
- **Center**: Block renderer, chip/text input, escalation banner, completion CTA
- **Right**: Pattern cards with explainability pills, interventions, signal dimension tracker

Mobile: tab-switched (Conversation | Insights). Session recovery via `sessionStorage` key + resume endpoint.

---

## 15. Security & Authentication

### OTP flow

1. User enters email in `CapadexRegisterPhase`
2. `POST /api/capadex/otp/send` generates a 6-digit OTP (stored hashed in `capadex_otps`, expires 10 min)
3. OTP sent via Zoho email (`ZOHO_EMAIL` + `ZOHO_APP_PASSWORD` env vars)
4. User enters OTP in `CapadexOtpPhase`
5. `POST /api/capadex/otp/verify` validates → marks used → unlocks report

### Password hashing

User passwords (for registered accounts) are hashed using Node.js `scrypt` with a random 16-byte salt. Storage format: `salt:hash` (hex). Comparison uses `timingSafeEqual` to prevent timing attacks.

### Session identity

Guest users are identified by `guest_email`. Registered users are identified by `user_id`. The `capadex_sessions` table stores both; progress lookups (`/api/capadex/progress`) match on email + concern_name.

### Admin auth

Super-admin routes are protected by session-based authentication. Login: `superadmin@metryx.one` / `admin123` (development credentials — should be rotated for production).

### No PII in signals

Behavioral signals (`capadex_session_signals`) store only numeric/categorical telemetry — no question text, no answer text, no personal identifiers.

---

*Document generated from live codebase — MetryxOne CAPADEX v1.0, May 2026*


---

# PART II — Technical Runtime Reference (Modules 15–26)

# CAPADEX — Behavioural Runtime (Modules 15–21)

> **Doc version:** v1.5 · last updated 2026-06-01 · covers §15–§26 (added §26 Adaptive Questioning runtime — Phase B). Maintain this tag on every edit: bump the version, set the date, and note the change.

Authoritative production reference. Telemetry payload contract is the key-value **map** `Record<itemId, {response_time_ms, answer_changed, response_value}>` — never an array. Companion docs: `replit.md` (feature map), `docs/phase-history.md` (narrative).

A telemetry-derived field was added to the OMEGA-X `behavioural` block to satisfy the F1 telemetry target (not in the original schema spec).

## 15. OMEGA-X Telemetry

### 15.4 Calibration formulas
Aggregated from `capadex_session_telemetry`:
- **F1 — Overthinking & Indecisiveness**: `AVG(hesitation_ms) > 8000` OR `SUM(backtrack_count) >= 3` → `+0.12` to both `overthinking` and `indecisiveness`. Single-trigger on OR (not additive).
- **F2 — Perfectionism**: `SUM(backtrack_count) >= 5` → `+0.15` to `perfectionism`.
- **Clamp guard**: every behavioural value `Math.min(Math.max(v, 0), 1.00)` post-modifier.

### 15.5 Safety & diagnostics
- Calibration in try/catch — missing table / query error → defaults preserved, error → `_omega_x_error`; never blocks `/complete`.
- `_telemetry_inputs` block (`avg_hesitation_ms`, `total_backtracks`, `telemetry_rows`), underscore-prefixed so dashboards ignore.
- Payload returned in `/complete` as `omega_x_payload` + persisted to `capadex_sessions.omega_x_payload` in the same UPDATE.

## 16. OMEGA-X Real-Time UI Bridge (Module 1)

### 16.1 Shared schema factory
`backend/services/omega-x-payload.ts` — exports `OmegaXPayload` (interface), `buildOmegaXSkeleton()`, `isPopulatedOmegaXPayload(raw)` (strict guard: all 8 top-level layers + `behavioural.overthinking` numeric canary). Single source of truth for writer (`/complete`) and reader (`/omega-x`); new layers/fields added here first.

### 16.2 Reader endpoint
- `GET /api/capadex/session/:id/omega-x` + alias `GET /api/assessment/session/:id/omega-x` (identical envelopes), mounted in `capadex.ts`.
- Auth: anonymous (matches free funnel); session UUID is the implicit ownership token — documented tradeoff, add `requireAuth` + session→user check before paid/enterprise exposure.
- Envelope: `{ ok, session_id, status, is_skeleton, omega_x_payload }`.
- Skeleton fallback: empty/`{}`/missing canonical fields → `buildOmegaXSkeleton()` with `is_skeleton:true`.
- Errors: 400 `invalid_session_id` (UUID pre-validation avoids CAST 500s), 404 `session_not_found`.

### 16.3 Frontend wiring
`frontend/src/components/assessment/phases/CapadexReportPhase.tsx` — state `omegaXPayload/omegaXIsSkeleton/omegaXLoading`; fetch in `useEffect` keyed on `capadexSessionId` (`cancelled` flag suppresses stale state; failure keeps the empty skeleton). Widget block: 3 cards (Overthinking / Perfectionism / Burnout Risk) between header and PDF bar, `data-pdf-hide`, amber "Preliminary" pill when `is_skeleton`, `?? 0` on missing keys.

## 17. Safety Circuit Breaker — "Relief-First" Gateway (Module 2)

Two-channel evaluator wired into `POST /api/capadex/session/:id/respond`. Either channel trips → halts queue, marks session terminal, returns a `safety_intercept` envelope; frontend mounts a relief overlay instead of advancing to `/complete`.

### 17.1 Service
`backend/services/capadex-safety-breaker.ts` — `evaluateSafetyTrip(pool, sessionId, responses) → SafetyTripResult`, `buildSafetyInterceptEnvelope(trip)`. Never throws — any fault → `{tripped:false, error}`.

### 17.2 Channel A — explicit safety (text)
Pipes any `response_text` per item through `safety-layer.validateNarrative()`; trips on `referral` level (self-harm, crisis_language, catastrophic_determinism). Hook-only today (questions are choice-only, no `response_text` sent); fires the moment a freeform follow-up wires `response_text` into the request body.

### 17.3 Channel B — implicit telemetry risk
- **Polarity-aware**: uses `capadex_responses.weighted_score` (sign-flipped at /respond write-time), NOT `raw_score`.
- `extreme_distress_share = share of items with weighted_score < 20` (polarity-corrected bottom quintile on the weight-1 0-100 scale).
- `crisis_risk = clamp01(0.70 * extreme_distress_share + 0.30 * backtrackRatio)`, `backtrackRatio = min(cumulative_backtracks / 24, 1.0)` — clamped to 1.0 **before** the 0.30 weight so the term can never exceed 0.30 (backtracks alone cannot trip 0.80; real distress required).
- `emotional_breakdown_risk = clamp01(0.55 * (avg_hesitation_ms / 25000) + 0.45 * answer_volatility)`, `answer_volatility = total_backtracks / max(answered,1)` capped at 1.
- Min-answered guard: Channel B suppressed until `answered >= 3`.
- Trip threshold: either score `>= 0.80`.

### 17.4 Routing & persistence (`/respond` post-batch)
1. Run `evaluateSafetyTrip()` after the response-persist loop.
2. **Always** merge `crisis_risk` + `emotional_breakdown_risk` into `capadex_sessions.omega_x_payload.risk` via `jsonb_set(... '{risk}', existing_risk || jsonb_build_object(...))` (jsonb_set won't create missing parent keys, so merge an explicit risk object; preserves `burnout_risk`/`disengagement_risk`).
3. If tripped: `UPDATE status='safety_intercepted'`, return `buildSafetyInterceptEnvelope(trip)` instead of `{ok, answered}`; non-blocking hooks (contradiction-engine, cognitive-load, conversational-quality) skipped.

### 17.5 Terminal-state enforcement
`POST /respond` and `POST /complete` both return `409 session_safety_intercepted` (with safety envelope) on an intercepted session. Score persistence + report writers cannot resurrect it.

### 17.6 Unified envelope
```json
{
  "safety_intercept": true,
  "terminate_assessment": true,
  "relief_target": "immediate_support",
  "support_resources": { "message": "...", "action_type": "counsellor_routing" },
  "_trip_channel": "A" | "B" | "A+B",
  "_trip_reasons": ["channel_a:crisis_language", ...],
  "_risk": { "crisis_risk": 1, "emotional_breakdown_risk": 1 }
}
```
`_`-prefixed fields are audit-only; frontend reads only top-level `safety_intercept` + `support_resources`.

### 17.7 Frontend wiring
`FreeAssessmentModal.tsx` — state `safetyIntercept:{message,action_type}|null`, `'capadex_relief'` phase in the phase union. `doCompleteStage` parses `/respond`; on `safety_intercept===true` sets state, switches to `'capadex_relief'`, and returns before `/complete`. Relief overlay: rose/amber alert card `role="alert" aria-live="assertive"`, WhatsApp counsellor CTA (`wa.me`), iCall helpline tel link (9152987821), close button. No "continue anyway" bypass — terminal by design.

### 17.8 Factory extension
`omega-x-payload.ts` `risk` layer carries `crisis_risk` + `emotional_breakdown_risk` (default `0.00`); all callers (writer, reader, breaker) consume the same factory — no schema drift.

## 18. Proxy Clarity-Question Reframe

Clarity questions are authored in self-report second person ("how confident **are you** that **you** can…"). In proxy mode (`is_proxy=true` — a parent/teacher/counsellor rating someone else) `rephraseForProxy(text, subject)` + `proxySubjectNoun(primaryPersona, assesseeName)` + `normalizeSelfReport(text)` rewrite each question's text to the third person. As of Phase 3A these are a **pure, unit-tested module** `backend/services/proxy-language-engine.ts` (imported by `backend/routes/capadex-concern-intelligence.ts`; fixtures `backend/tests/proxy-language-engine.test.ts`, `npx tsx`). The route holds no inline copy — single source of truth.
- **Subject** (`proxySubjectNoun`): `assessee_name` if supplied, else `"your child"` (parent), `"your student"` (teacher/educator/counsellor/placement/principal/leadership), else `"this person"`.
- **Threading**: `envelope.is_proxy` + `assessee_name` + `primary_persona` flow through `analyzeConcern`. Only `clarification_questions[].question` text is rewritten — ids and options untouched, so scoring and Likert single-select routing are unaffected. Self track (`is_proxy=false`) is unchanged.
- **Sentinel**: subject injected as a `\u0000SUBJ\u0000` sentinel *before* the possessive/pronoun passes, restored after — else a subject containing "your" (e.g. `"your child"`) would be corrupted to `"their child"` by the `your → their` pass.

### 18.1 First-reference naming
The subject must be **named** before any pronoun, else the sentence opens with an antecedent-less plural "they". The reframer names the subject at the **earliest** `"you"` reference in any grammatical form, picked by string index:

| Form | Regex | Rewrite |
|------|-------|---------|
| Inverted aux | `(aux) you` ("are you") | `<conj-aux> <subject>` ("is Abhi") |
| Subject + aux | `you (aux)` ("you are") | `<subject> <conj-aux>` ("Abhi is") |
| Bare subject | `you` | `<subject>` ("Abhi") |

Ties at the same index break toward the more specific pattern (inv → subjaux → bare). Conjugation via `AUX_THIRD_PERSON` (`are→is`, `do→does`, `have→has`, `were→was`; modals like `can/will/should` pass through). Every later reference degrades to singular `they/their/them` (object pronouns after a preposition → `them`; `your→their`, `yours→theirs`; reflexives → `themselves`; trailing tag questions keep their auxiliary and only swap the pronoun). Defensive grammar sweeps run last (additive, no-ops on well-formed output): `is is→is`, `does feel→feels`, `they is→they are`, `they has→they have`, `they does→they do`.

**Subject-first anchoring (the "inside Abhi" fix)**: the name only lands on a **subject-position** `you`. A `you` that is the object of a preposition (`inside you`, `for you`, `to you`) is **never** the anchor — it degrades to `them` even when it is the *first* `you` in the string ("What happens inside you when **you** lose focus?" → "…inside **them** when **Abhi** loses focus?"). When the anchored subject is a bare pronoun (no following aux), the **lexical present verb** that follows is conjugated to third-person singular via `PRESENT_VERBS` (`lose→loses`, `perform→performs`, `complete→completes`, `recover→recovers`, …) so the named clause reads grammatically.

**First-person normalization** (`normalizeSelfReport`, runs before the proxy passes and also on self/learner copy): expands contractions (`I'm/I'll/I've/I'd`), maps first person to second (`I→you`, `my→your`, `me→you`, `myself→yourself`), and repairs be-verb agreement (`you am→you are`, `you was→you were`). This is what retired 23 of the 793 audited stems at runtime without a DB rewrite.

### 18.2 Clarify-phase copy
`CapadexClarifyPhase.tsx` — the "Tap in order of importance — most relevant first." subtitle renders only for `isSingle` (Likert) questions; the ranking footer is hidden while a ranking question is still unanswered (`!submitting && !isSingle && ranked.length===0`).

### 18.3 Single-select detection + footer fork
`CapadexClarifyPhase.tsx` `isSingleChoiceQuestion(q)` is the **single source of truth** for the layout fork (`true` → single-select tap-to-submit; `false` → ordinal ranking). No parallel `isRankingApplicable()` — one decision point. Precedence:

1. **`response_type` authoritative (root-cause fix)**: any question carrying a non-empty `response_type` → single-select, checked **before** all heuristics. Covers all **23 distinct ordinal/categorical `response_type` vocabularies** in `capadex_clarity_questions` (e.g. `intensity` = `Not at all/Slightly/Moderately/Strongly/Extremely`; `coping_effectiveness` = `Very Ineffective…Very Effective`; `coping_style` = categorical picks) — none are rank-by-importance, and token heuristics could not scale to them (`intensity` matched only `not at all` → 1/5 = 20% < 60% → rows wrongly fell to ranking). Backend: `pickQuestionsFromMaster` SELECTs `q.response_type` + maps it onto each `mcq_*` row; `pickQuestionsFromDB` tags `aqb_*` rows `response_type='frequency'`. `CQ` type + the three frontend `clarification_questions` decls (`assessment/types.ts`, `AssessmentModalContext.tsx`, `FreeAssessmentModal.tsx`) carry optional `response_type?: string`.
2. **Schema hints**: `q.evaluation_type === 'LIKERT'`, `q.isSingle === true` (both optional, ignored when absent).
3. **Heuristic fallbacks (static-fallback questions only — no `response_type`)**:
   - `looksLikeLikertScale(options)` exact-token match ≥60% against `LIKERT_TOKENS` — includes intensity/frequency/agreement/readiness/confidence rungs + impact ladder (`no impact/mild impact/moderate impact/major impact/severe impact`) + emotional ladder (`a little bit/somewhat/quite a bit/very much`; `not at all` already present).
   - Stem regex: `how (long|often|frequently|many|ready|prepared|confident|comfortable|likely|emotionally|stressful|impactful|difficult|severe)`, `rate|rank your|on a scale|rate your level`, `feel to you`.
   - `_duration` id suffix; `/^what have you (already )?tried\b/i` (mutually-exclusive history states); leading `/^nothing yet\b/i` option.
   - Exact equality gated at ≥60% means phrase-like rankable option lists (e.g. concern-priority lists) still route to ordinal ranking.

**Fork behaviour**:
- **Single-select**: one tap → `handleSingleTap(option)` sets `selected`, flips `submitting`, then calls `handleClarifyAnswer([option])` after a 350 ms auto-advance. Letter badges (A/B/C/D) → checkmark when selected. "Confirm selections" gated `{!isSingle && …}` (hidden). Status footer fully hidden except the saving spinner (gate `submitting || (!isSingle && ranked.length > 0)`).
- **Ranking**: multi-tap toggle stack (`ranked`), index+1 badges over selected options, "Confirm selections" disabled when `submitting || ranked.length === 0`, footer "N of M ranked".
- **State hygiene**: `useEffect` keyed on `currentQuestion.id ?? clarifyCurrentQ` clears `ranked`/`selected`/`submitting` on every question change.
- **Seen-question history**: `answeredIds` persisted at the modal level (`sessionStorage` key `mx-capadex-seen-clarity`), POSTed on each `/analyze`; backend `applySeenFilterAndShuffle` (Fisher–Yates) excludes shown ids. Dedup is across `/analyze` calls within the tab session.

### 18.4 Professional "focus at work" clarity seed
The free-text resolver (`resolveMasterConcernIdFromText`) maps "focus at work" → master concern `CONCERN_LEA_602` ("Weak Ability to Sustain Focus During Long Work Hours", Working Professional), `relational_bridge_tag=ACADEMIC_COGNITIVE` — but every clarity row under that tag belonged to academic personas, so `pickQuestionsFromMaster`→`runByTag` (persona + age `EXISTS` join `clarity.concern → master.concern_cluster → primary_persona`) correctly rejected all of them → cascade to `static_fallback`. Relaxing the filter was rejected (would re-leak academic exam questions to adults).

**Fix**: `backend/scripts/seed-focus-at-work-clarity.mjs` (idempotent — delete-by-`question_id` then insert) seeds 3 professional workplace-focus rows (`FAW_PROF_001..003`, the rollback ids) under the same `master_bridge_tag='ACADEMIC_COGNITIVE'` with `concern='Weak Ability to Sustain Focus During Long Work Hours'`. They are the only professional-persona rows under that tag → pass the persona + age filter → the concern now returns `clarity_source='master_curated'`. No code, schema, or frontend change.
- **Row shape**: `response_type='situational_fit'`; distinct workplace option arrays (not Likert); equal option scores `2,2,2,2,0` (non-ordinal qualitative diagnostics — no severity ranking — and the master retrieval path returns only text + options, not score columns, so scoring is unaffected); `question_weight=0.950` (top tier, reliably picked); `polarity='negative'`, `reverse_score='no'`.
- **Intended bleed**: master Tier-1 selection is tag + persona + age (not `concern_id`-exact), so these rows also serve the sibling professional focus concerns sharing the tag — `CONCERN_LEA_579` (meeting-heavy focus), `CONCERN_LEA_650` (deep work in distracting environments), `CONCERN_WOR_623` (meeting fatigue) — all topically aligned, previously dead-ended to static.

### 18.5 Phase 3A audited-stem cleanup
The question-intelligence audit (`backend/scripts/audit/question-intelligence-audit.mjs`, `audit/phase1/`) flagged **793** `proxy_language_issues` — clarity stems the detector reads as awkward once reframed. `backend/scripts/audit/proxy-language-cleanup.mjs` (`npx tsx`, **reuses the audit detector + the engine's `normalizeSelfReport` for detector parity** — its dry-run re-detects exactly 793) classifies them. **The headline finding: there are no "plain mis-authored first-person" stems to mechanically flip — every first-person clarity stem in this dataset is deliberately-quoted inner-speech, which is CORRECT as authored for self mode and must NOT be pronoun-swapped.** So the safe cleanup applies **zero destructive DB rewrites**; its real job is to *classify and defer* correctly:
- **506 `no_change_engine_handles_reflexive`** — natural second-person stems the runtime engine already reframes correctly; left untouched (a DB rewrite would be redundant + risk drift). The actual user-facing proxy fix lives in the **runtime engine** (`proxy-language-engine.ts`), not in DB edits.
- **27 `quoted_or_attributed_self_talk_needs_authoring`** — first-person that is **quoted self-talk** (`feel "I am not good enough"`), **attributed thought** (`thoughts like I'll do it later`, `thoughts about what if I never succeed`), a **hypothetical worry** (`what if I fail`), or sits under an **explicit third-person subject** (`How often does the child feel I cannot focus`). Flipping `I`→`you` here yields quoted second-person that is odd in self mode and **broken in proxy** (`feel "Abhi are not good enough"`); the original first-person-in-quotes is in fact correct for self mode. All 27 route to **human authoring** — reframing quoted inner-speech is an authoring problem, never a mechanical flip.
- **260 `missing_anchor_needs_authoring`** — abstract stems with no safe deterministic anchor; **left for human authoring**, never auto-generated (quality > coverage).
- **Guard** `isAttributedOrThirdPersonSelfTalk` (exported + unit-tested in `backend/tests/proxy-cleanup-planner.test.ts`, 10 fixtures): quote class **must include the Windows-1252 C1 code points `\u0091-\u0094`** — this dataset stores smart quotes as `U+0093/U+0094` (apostrophe `U+0092`), NOT ASCII/Unicode quotes, so an ASCII-only class silently misses ~all real quoted self-talk (the bug that let an initial pass wrongly flip 25 quoted rows; all reverted byte-for-byte in DB **and** `audited_clarity_questions.csv`, verified against git HEAD hex).
- **Net**: re-run audit stays **793** (`audit/phase3/audit_summary_postcleanup.json`; phase1 = the same baseline) — deferrals are not rewrites, so the count is unchanged by design. Idempotent (dry-run: **0 changing rewrites in apply scope**). Review artifacts: `audit/phase3/proxy_cleanup_proposed.csv` + `proxy_cleanup_summary.json`.
- **Known follow-up (out of Phase 3A scope)**: (a) the 287 deferred stems (27 quoted + 260 missing-anchor) need human authoring for proxy/learner reframe; (b) clarity **options** still read first-person in proxy mode (`"My mind drifts off"`) — by the documented "ids/options untouched" contract. Both are deliberate future phases.

## 19. BIOS Behavioural Synthesis in the Report

Fuses the questionnaire score with implicit BIOS signals into a single developmental archetype on the report. **Language policy**: developmental signals only — no diagnostic, hiring, or suitability claims.

### 19.1 Service
`backend/services/capadex-report-synthesis.ts` — pure functions, no DB access (callers pass already-fetched rows):
- `buildBehaviouralEnvelope(signals)` → `{ emotional_load, cognitive_load, engagement_score, volatility_score, rapid_answer }` or `null` when no signal profile exists.
- `synthesizeArchetype(score, signals)` → `ArchetypePayload { label, summary, tone: 'caution'|'observe'|'positive' }` or `null`. Maps `(score, cognitiveLoad/emotionalLoad/volatility/rapidAnswer)` to one developmental archetype.

The linguistic context block is assembled inline in the report route.

### 19.2 Report route wiring
`backend/routes/capadex.ts` report route reads three tables best-effort in one try/catch so the report **never 500s** on missing behavioural data:
- `capadex_signal_profiles` (emotional/cognitive/engagement/volatility loads) — archetype + envelope built only when a profile row exists.
- `capadex_linguistic_signals` (absolutism/intensity/certainty, latest by `detected_at`) → `linguistic_context`.
- `capadex_session_signals` where `signal_key='rapid_answer_pattern'` → `rapidAnswer` boolean.

Failure logs `[capadex/report] behavioural synthesis skipped` and ships `behavioral_signals/behavioral_archetype = null`. The questionnaire score path is fully independent.

### 19.3 Frontend + email
- `CapadexReportPhase.tsx` renders the behavioural metric grid + archetype card; hidden when the envelope is `null`.
- `backend/email.ts` (`behavioralArchetype?: { label, summary, tone } | null`) renders an optional archetype block — omitted entirely when no signal profile exists.

**Report-email rebuild** — the emailed report shares ONE source of truth with the on-screen report:
- `backend/services/omega-report-builder.ts` is the single OMEGA envelope builder: `buildOmegaReport(pool, session_id)` (also backs `GET /api/capadex/report/:session_id/omega`) and `buildOmegaEmailExtras(pool, session_id)` → `{ omega, telemetry }` (best-effort; resolves `null` on failure, never throws). The send/preview paths in `capadex.ts` / `capadex-enterprise.ts` reuse it instead of re-deriving OMEGA data.
- **Narrative selection** (`backend/email.ts`): when `dynamic_report.pattern_insights` is present the email uses the dynamic personalised narrative; otherwise it falls back to the static narrative — legacy single-session reports are unaffected.
- **OMEGA-X section gating**: `buildOmegaSectionsHtml(...)` renders OMEGA blocks conditionally and returns empty for absent data, so no hollow sections appear in the email.
- **Provenance strip**: clarity source + contradiction count + pacing (placeholder fallback when telemetry is missing), read from the report's `report_data` / `dynamic_report` meta.
- **Flag**: the dynamic-narrative path is gated by `isEnabled('dynamic_reporting', tenantId)` — flag-off → static narrative. Enabled by default via migration `20261103_enable_dynamic_reporting.sql` (idempotent upsert; the Phase-1 seed `20260509_feature_flags.sql` created all flags disabled).

### 19.4 Ingest ordering on stage complete
`FreeAssessmentModal.doCompleteStage` **awaits** `POST /api/signals/ingest` (guarded try/catch — never throws; logs on both network error and `!res.ok`) **before** the silent report pre-fetch — §19.2 reads `capadex_signal_profiles` at report time, so the ingest must persist first or the behavioural cards are empty on first report load for already-authed users. The await sits **after** `setPhase('capadex_result')`, so the user is already on the result screen — zero perceived latency. **Buffer-clear ordering**: `setQuestionTimings({})` fires immediately after the `timingsSnapshot` is taken (top of `doCompleteStage`), NOT after the await — else a late ingest resolution wipes timings already being collected for the next stage (`questionTimings` is global, not session-scoped). The `timings` payload is the map `Record<itemId, {response_time_ms, answer_changed, response_value}>`, never an array. Per-question `/api/signals/telemetry` (in `handleCapadexAnswer`) stays fire-and-forget. **Flag**: the ingest writes only when `feature_flags.signal_intelligence` is enabled.

---

## 20. Clarity Report Preview (Bridge Phase)
`frontend/src/components/assessment/phases/CapadexBridgePhase.tsx` — the `preview` step of the funnel (intro → analyze → clarify → **preview** → questions → …). A pre-payment "Profile Brief" (STEP 3 OF 4) that mirrors the full report's structure: intelligence summary → analysis pipeline → metric grid → detected patterns → behavioural mirror → "what you told us" → dimensional mapping → locked report sections → benchmark → social proof → sticky price CTA.

### 20.1 Shared visual canon with the full report
Preview and full report (`CapadexReportPhase.tsx`) are **one report system** — the report is canonical and the preview matches it. Canon:
- Structural border / separator token: `#E8EBF4` (NOT `#E8ECF4` or `#EEF0F5`).
- Section & card headers: `text-[11px] font-black uppercase tracking-widest`.
- Section-card radius: `rounded-xl`.
- Brand navy: `METRYX_NAVY = #344E86` (`@/lib/behavioural-insights`).
- **Gradients are shared design language** (dark headers, accent lines, progress fills, CTA button) across BOTH screens — do not strip them from one screen only; change both or neither.
- The smaller in-card metric micro-labels intentionally stay `text-[9.5px] font-bold uppercase tracking-wide` (a finer tier; enlarging them overflows the compact 2-col metric cards).

### 20.2 Heuristic stat clamps (pre-question preview)
The four metric cards show pre-question heuristics, framed as evolving "signals" — never measured scores or diagnoses (**language policy**):
- "How accurate this is": `accuracyPct = Math.min(96, 84 + clarifyPairs.length * 2)` — **capped at 96%** so it never exceeds 100% (was unbounded → produced 104% at 10 clarify answers). The number and the progress-bar width use the same clamped value.
- "Your readiness to change": `82 | 61 | 43` by `growth_readiness` = high | medium | low.
- "How hard it's hitting" bar width: `BENCHMARK[severity].pct` (88 | 61 | 34).
- Profile ring `completionPct`: `Math.min(42, 16 + clarifyPairs.length * 8 + Math.min(patterns.length * 4, 12))`.

---

## 21. Behavioural Memory (Career OS longitudinal layer)
The longitudinal memory that sits **on top of** the CAPADEX spine: the per-session spine (Answers → Evidence → Signals → Composites → Patterns → Interventions) is point-in-time, whereas behavioural memory accumulates those outputs **across sessions** per user so growth can be observed over time. It backs the Career Operating System's "Growth & Memory" zone.

- **Route**: `backend/routes/behavioural-memory.ts` — `registerBehaviouralMemoryRoutes(app, pool, requireAuth)`, namespace `/api/career/behavioural-memory/*`. Lazy `ensureBehaviouralMemorySchema()` mirrors migration `20260530_behavioural_memory.sql` (no migration runner — same bootstrap convention as the rest of CAPADEX).
- **NOT to be confused with `backend/routes/career-memory.ts`** (Phase-3, in-memory transformation history, single-arg `registerCareerMemoryRoutes(app)`, namespace `/api/career/memory/*`). Distinct static prefix (`behavioural-memory` vs `memory`) is deliberate: Express `:userId` matches any single segment, so a shared `/memory/:userId` would shadow siblings like `/memory/snapshots`. Never merge the two.

### 21.1 Tables
- `capadex_behavioural_memory` — append-only per-user time-series. One row per tracked element with `entry_type ∈ {signal, pattern, intervention, outcome}`, `entry_key`, `label`, `strength` / `confidence` NUMERIC, `status`, `meta` JSONB, `recorded_at`. Indexed `(user_id, recorded_at DESC)` + `(user_id, entry_type)`.
- `career_memory_snapshots` — point-in-time Career Brain state: `ei_score`, `current_stage`, `target_role`, `transition_probability`, `core_bottleneck`, `market_readiness`, `interview_readiness`, plus `signals` / `patterns` / `interventions` / `outcomes` / `brain` JSONB. Indexed `(user_id, snapshot_at DESC)`.

### 21.2 APIs (both `requireAuth`)
- `POST /api/career/behavioural-memory/snapshot` — persists one `career_memory_snapshots` row and appends the tracked elements into `capadex_behavioural_memory`. Body parsed defensively via `asArray()`/`num()` (malformed entries dropped, never throws).
- `GET /api/career/behavioural-memory/:userId` — returns the latest 24 snapshots + computed `growth` deltas from the latest vs the previous snapshot:
  - `improving_signals` — signal strength rose by > `STRENGTH_EPS` (0.05); delta surfaced.
  - `worsening_signals` — signal strength fell by > `STRENGTH_EPS`.
  - `stable_patterns` — pattern present in both, confidence drift ≤ `CONFIDENCE_EPS` (0.08).
  - `emerging_patterns` — pattern present in latest but absent in previous. (Brand-new signals are not yet a trend; with a single snapshot every pattern is emerging and nothing is improving.)

### 21.3 Access control & privacy
- `resolveEffectiveUserId(req, requested)` is the only authority on whose memory is read/written. Effective id is derived from `req.user.id` (the canonical app-wide id; the frontend passes the same `user.id`), **never** the path/body param. A non-super-admin supplying a different id → `403 forbidden_cross_user`; only `req.user.role === 'super_admin'` may target another user (admin tooling). Prevents IDOR.
- Strictly per-user — no cohort aggregation — so peer-benchmark **k-anonymity** (`k_min=30`) is untouched.

### 21.4 Frontend
- `frontend/src/lib/services/useCareerBrain.ts` reads `GET /api/career/behavioural-memory/:userId` to fold prior signals/patterns into the aggregated Career Brain.
- `frontend/src/components/career/CareerMemoryTab.tsx` reads the same endpoint and writes snapshots via `POST .../snapshot`; `BehavioralGrowthTab.tsx` renders the growth deltas.

---

## 22. Phase 0B — Hypothesis-Driven Investigation (additive extensions)

Additive, flag-safe deepening of the EXISTING hypothesis / confidence / adaptive engines. Flag-off or absent data → byte-identical prior behaviour ("nothing more, nothing less"). Two flag systems are in play: the engines read the DB-backed `isEnabled()` (`services/feature-flags.ts`, snake_case e.g. `adaptive_questioning`); the new `/analyze` clarity gate is static (`config/feature-flags.ts`, camelCase `hypothesisDrivenClarity`, **default OFF**, env override `FF_HYPOTHESIS_DRIVEN_CLARITY`).

### 22.1 Confidence bands
- `services/confidence-engine.ts` — `ConfidenceBand = 'weak'|'moderate'|'strong'`, `CONFIDENCE_BAND_THRESHOLDS` (weak ≤0.40, moderate ≤0.70, strong >0.70), pure `confidenceBand(score)`. `ConfidenceResult` now carries `band`, populated at the single construction site in `computeConfidence` (so `applyDelta` and every return path inherit it).
- `routes/confidence-engine.ts` trace rows enriched with `band_before`/`band_after`. `routes/hypothesis-engine.ts` GET + POST hypotheses enriched with `confidence_band` **only when the band-owning DB flag `confidence_engine` is enabled** — flag-off → byte-identical legacy payload (no `confidence_band` key).

### 22.2 Question governance classifier
- `services/hypothesis-question-governance.ts` (NEW, pure/deterministic, no DB/flags) — `classifyGovernance({targetConstruct, band, relevance, contradictionProbe, confidenceGain}) → {role, rationale}`. Four mutually-exclusive roles in priority order: no target / relevance ≤0 → **explore**; `contradictionProbe ≥ 0.5` (CONTRADICTION_PROBE_THRESHOLD) → **weaken**; band `weak` → **eliminate**; `moderate`/`strong` → **strengthen**. `rationale` is non-generic (names the construct + band + deciding factor).

### 22.3 Registry depth
- `data/behavioural-constructs.ts` — added `CAREER_GROWTH` construct (Career cluster, `#92400E`).
- `services/hypothesis-engine.ts` — added a `CAREER_GROWTH` rules block (3 templates: stagnation_perception / advancement_barrier / growth_direction_uncertainty) + a 3rd template to every exactly-2 construct so each construct now seeds ≥3 hypotheses. Keyword boosts only nudge confidence within the existing 0.05–0.95 clamps → no regression for existing constructs.

### 22.4 Selection API surfacing
- `services/adaptive-assessment.ts` — inline scorer extracted into pure `computeScoreBreakdown()` + `scoreCandidate()` (`selectNextQuestion` behaviour byte-identical via a shared `ScoreContext`). New exported `rankCandidateQuestions(pool, sessionId, tenantId?)` ranks ALL eligible candidates (read-only: NO selection record, NO state write) and annotates each with `target_construct` / `target_band` (`confidenceBand`) / `governance_role` / `governance_rationale`. Returns `[]` when flag off / session unknown / nothing eligible.
- `routes/adaptive-assessment.ts` — `GET /api/bios/selection/:sessionId` (gated by DB flag `adaptive_questioning`; flag-off → `{flag_active:false, session_id, questions:[]}`; on → `{flag_active:true, session_id, count, questions}`).

### 22.5 Hypothesis-driven clarity in `/analyze`
- `routes/capadex-concern-intelligence.ts` `analyzeConcern` — when `isHypothesisDrivenClarityEnabled()` (config flag, default OFF), additionally calls pure `buildHypotheses()` and attaches `hypotheses[]` (each with `confidence_band` + `governance_role`/`governance_rationale`) + a `hypothesis_investigation` envelope (`flag_active`, `construct_key`, `hypothesis_count`, `top_hypothesis`). Wrapped in try/catch — a failure here can never break `/analyze`. Flag OFF → block skipped, response byte-identical.

---

## §23 Simulation & Validation Environment (Phase 0C — flag-safe, black-box)
- **Purpose**: validate the EXISTING pipeline (question selection → signals → composites → patterns → interventions → report) by driving the REAL public HTTP endpoints (NOT mocks). Flag-off → admin routes 503 + dashboard panel hidden; **zero impact on the live runtime** (sim sessions are uniquely-emailed `sim+<tag>-<id>@simulation.metryx` and purged after each run via `cleanupSessions` across all session-scoped tables incl. `capadex_behavior_graph`/`capadex_runtime_sessions`).
- **Flag**: `simulationHarness` (config `config/feature-flags.ts`, default OFF, env override `FF_SIMULATION_HARNESS`, helper `isSimulationHarnessEnabled()`).
- **Files** (`backend/services/simulation/`): `persona-library.ts` (10 spec personas + concept tokens + base severity), `scenario-generator.ts` (mulberry32 seeded RNG → `generateProfiles`/`stratifiedSample`/`simulateAnswer`), `validation-framework.ts` (`MetricSet`/`TARGETS`/`evaluate`→`pass|warn|fail` with hard/soft conditions), `simulation-engine.ts` (`runSimulation` orchestrates HTTP pipeline + metrics + persist + cleanup). Routes `routes/capadex-simulation.ts` (`registerSimulationRoutes`, all `requireAuth`+`requireSuperAdmin`+flag-gated). Migration `migrations/20261110_simulation_runs.sql` (table `capadex_simulation_runs`; canonical, mirrors lazy `ensureSimulationSchema()`). UI `frontend/src/components/superadmin/SimulationDashboard.tsx`.
- **Endpoints** (`/api/admin/simulation/*`): `GET config` (flag state + targets + personas, always available so the panel can self-hide), `GET personas`, `POST run`, `GET runs`, `GET runs/:id`, `GET latest`.
- **Metric calibration (non-obvious, learned from the real engine)**:
  - **Polarity**: CAPADEX items are predominantly distress-worded (`(-)`). The simulant emits the persona's *lived* raw answer (reverse-keying is the engine's job): a struggling persona AGREES with `(-)` items (high value) → engine reverse-scores → low health score. Only `(+)` (capability-worded) items invert in `simulateAnswer`. Getting this backwards makes high-severity personas score *healthy*.
  - **concernMatch is semantic, not string-equal**: the engine intentionally resolves fine-grained concerns onto coarse master buckets (e.g. `Performance Anxiety` → `Anxiety & Overthinking`). Relevance credits a resolved label that shares vocabulary with the persona's concept space; a genuinely-off remap (e.g. `Burnout` → `Exam Stress`) still scores 0 → surfaces real routing weakness.
  - **Relevance composite** = `0.35·coverage + 0.35·concernMatch + 0.30·concept` (concept matched against stem + construct metadata `sub_domain_name`/`dimension`/`focus_area`, since construct-based items rarely keyword the concern).
  - **Seed-coverage is a distinct dimension**: a `404` at `/start` (concern has no seeded questions) sets `notSeeded` and bails — excluded from quality aggregates (which average over `ok` runs), counted in `concernCoverage` (soft target ≥0.8) with the unseeded concern list surfaced. NOT a relevance failure.
- **The harness is allowed to FAIL.** A `fail` verdict (e.g. relevance ~0.64 vs 0.85 target) is a legitimate, actionable pre-production finding — do NOT tune metrics to force a pass.

## §24 Concern → Signal Mapping Engine
- **Purpose**: bridge the two disconnected CAPADEX data islands — the **Concerns Master** (`capadex_concerns_master`, ~2489 rows) and the **Signal Ontology** (20 Tier-3 signals / 15,972 atomic / dynamic composites). Before this, ~2270 concerns had no signal coverage and fell to a generic bucket, so the downstream spine (Signal → Composite → Pattern → Intervention) never fired for them. The engine resolves every concern to its signals, scores each mapping, validates the chain end-to-end, and surfaces coverage. **Additive data + tooling only** — the live picker and runtime signal activation are unchanged; wiring mappings into live activation is a deliberate follow-up.
- **Engine** `backend/services/concern-signal-mapping-engine.ts` (pure core `mapConcernToSignals(concern, ontology)`):
  - **Resolution cascade** (each concern, deterministic): `bridge_exact` (concern `relational_bridge_tag` == a Tier-3 signal's bridge tag) → `token_semantic` (curated `SIGNAL_KEYWORDS` synonym map per Tier-3 token, scored against concern text + cluster + domain — this is PRIMARY because exact bridge matches are weak in the real data) → `cluster_match` (`signal_cluster`/`concern_cluster`) → `domain_category` (6 ontology domain CATEGORIES) → `bridge_fallback` (atomic GENERAL_CONCERN catch-all, intentionally low-confidence WEAK) → `orphan` (no resolution → explicit marker row `signal_tier='orphan'`, `signal_ref='__orphan__'`, never fabricated).
  - **Composite expansion**: strong Tier-3 matches expand to composites via `loadCompositeRuntime` (`composite_derived`). Composite definitions exist only for HPC clusters that reach ≥2 tokens, so some Tier-3 signals legitimately have no composite — a real structural finding, not a bug.
  - **Helpers**: `loadMappingOntology`, `ensureConcernSignalMapSchema` (lazy mirror of the migration), `runConcernSignalMapping({mode:replace|upsert|append,dryRun})`, `insertRows` (13-col chunked upsert incl. `severity_weight`). **NEVER creates signals** — quality over coverage %.
- **Confidence layer**: per-row confidence (0–1) derived from resolution method × the atomic signals' existing severity/confidence/persistence weights; per-concern `coverage_confidence` aggregate + band `strong`/`moderate`/`weak`/`none`. The coverage service computes band distribution over **Tier-3 rows only** so the weak atomic GENERAL_CONCERN fallbacks don't pollute the confidence chart.
- **Chain validator** `backend/services/concern-signal-chain-validator.ts` (strictly read-only) — walks Concern → Signal → Composite → Pattern → Intervention using `loadCompositeRuntime` + `loadInterventionRuntime` + `coreToken`; returns per-concern `complete`/`orphan` plus aggregate per-stage `breaks{signal,composite,pattern,intervention}`. All 20 Tier-3 signals map to an `intervention_library` construct, so the intervention stage never breaks for mapped concerns.
- **Coverage service** `backend/services/concern-signal-coverage-service.ts` (read-only aggregator) → `{stats, registry, orphans}`.
- **API** `backend/routes/capadex-concern-signal-map.ts` (`requireAuth`+`requireSuperAdmin`, 60s cache, uses `concernsPool`): `GET /api/admin/capadex/concern-signal-map/{stats|registry|registry?orphans=1|chain|export.csv}`, `POST /rebuild`. **New route file → requires a Backend API restart to take effect.**
- **Backfill seed** `backend/scripts/seed-concern-signal-map.ts` (`npx tsx`, reuses the engine; flags `--dry-run`, `--mode=replace|upsert|append`). Idempotent. Table `capadex_concern_signal_map` · migration `migrations/20260531_concern_signal_map.sql` (canonical; mirrors lazy ensure-schema).
- **SuperAdmin** panel `frontend/src/components/superadmin/ConcernSignalMapPanel.tsx` (nav `concern-signal-map`, CAPADEX group, icon `Network`) — surfaces mapped/orphan/weak counts, confidence distribution, by-method/by-tier breakdown, chain pass/fail, orphan registry, CSV export.
- **Baseline backfill** (replace mode): 2489 concerns → 2486 mapped (99.9%), 3 honest orphans, 14,200 rows (5,858 Tier-3 / 2,489 atomic / 5,850 composite / 3 orphan); chain `complete=2486`, breaks only at the signal stage (== the 3 orphans). The 3 orphans (`CONCERN_COM_1311`, `CONCERN_SEL_1618`, `CONCERN_COM_1718`) are flagged for review, not filled.

## §25 Honestly-Orphaned Concern Fallback Insight
- **Decision (PURSUED)**: Concern → Signal seeding (§24 + seeding layer) deliberately seeds ONLY strong/moderate Tier-3 mappings; atomic/bridge-tag and orphan/fallback mappings are excluded so the measured spine never fabricates intelligence. A small set of concerns therefore resolve to NO seedable mapping and produce an **entirely empty spine** (no signals → composites → patterns → interventions). Those users previously received nothing measured. The decision: surface ONE conservative, **explicitly low-confidence** general-support insight rather than (a) fabricating signals or (b) leaving the report blank.
- **Why not fabricate**: producing a fake seed signal would dishonestly inflate composites/patterns — the exact thing the seeding guardrails and the quality-over-coverage canon forbid. The fallback therefore lives entirely OUTSIDE the spine.
- **Engine** `backend/services/concern-fallback-insight.ts` (pure, no I/O): `buildOrphanFallbackInsight(concernName)` → a single `OrphanFallbackInsight { is_fallback: true, confidence_band: 'low', source: 'general_support', title, message, disclaimer, suggestions[] }`; `shouldEmitOrphanFallback({signalCount,patternCount,recommendationCount})` → true ONLY when all three are 0.
- **Surfacing** (`backend/services/capadex-insight-explainer.ts`, the `/api/capadex/session/:id/explain` aggregator): adds a top-level **`fallback`** field, non-null ONLY when the measured spine is empty. It is **read-only** (never persisted, never seeded, never feeds the activation runtime) so it **cannot** inflate composites/patterns — they stay empty for an orphaned concern. Distinct field + `is_fallback`/low-confidence markers keep it visibly separate from `signals`/`patterns`/`recommendations`/`finding`.
- **Report UI** `frontend/src/components/assessment/phases/CapadexReportPhase.tsx`: the existing "no interventions" branch (on-screen + PDF) is relabelled **"General Guidance — Low Confidence"** with explicit "not based on a measured pattern" copy, so the distinction is visible in the actual deliverable.
- **Invariant**: the moment ANY real signal/pattern/recommendation exists, `fallback` is null and behaviour is byte-identical to before.

## Known Deferred Items
- **Idempotency on `/complete`** — currently recomputes if called twice; row-lock + status guard recommended.
- **Telemetry 202 race** — `POST /api/signals/telemetry` replies 202 and upserts fire-and-forget; `/complete` does a cheap `EXISTS` pre-check on `capadex_session_telemetry` and, only when ≥1 row exists, awaits a 350 ms grace before the omega-X telemetry aggregation (telemetry-free sessions pay zero latency). Durable fix: make the telemetry write awaited/transactional.
- **Audit promotion** — `_omega_x_error`, `_trip_channel`, `_trip_reasons` are console + payload only; promote into `capadex_audit_events` for SuperAdmin review.
- **OMEGA-X reader auth** — `/omega-x` is anonymous; add `requireAuth` + session→user link check before paid/enterprise tiers. AbortController upgrade for the `CapadexReportPhase` `useEffect` fetch.
- **Safety breaker** — per-item polarity weighting (`weighted_score < 20` is exact only for weight=1 items); threshold re-tune (0.80 trip, 25s hesitation, 24-backtrack baselines) once production telemetry distributions are observed; Channel A activation when a freeform `response_text` surface ships.

---

## §26 Adaptive Questioning runtime (Phase B — additive, flag-gated)

Makes the clarify phase **feel adaptive, not scripted**: dynamic pathing, information-gain ranking, zero-repetition (literal + semantic + signal), contradiction probing, and adaptive length (stop-when-confident). Strictly additive — flag-off → byte-identical legacy batch flow; never 404s; degrades gracefully to the existing keyword/static selection at every failure point.

- **Flag**: `adaptiveQuestioning` (`config/feature-flags.ts`, default **OFF**, env `FF_ADAPTIVE_QUESTIONING`, helper `isAdaptiveQuestioningEnabled()`).
- **Pure engines** (`backend/services/adaptive/`): `trait-inference.ts`, `information-gain.ts`, `zero-repetition.ts`, `contradiction-pairs.ts`, `adaptive-length.ts`, `question-governance-reject.ts`, `adaptive-question-pipeline.ts` (orchestrator `runAdaptiveSelection({candidates, priorAnswers})`). Fixtures: `backend/tests/adaptive-question-pipeline.test.ts` (25 assertions, `npx tsx`).
- **Endpoint** `POST /api/capadex/concern/adaptive-next` (`routes/capadex-concern-intelligence.ts`, after `/analyze`): gated by `isAdaptiveQuestioningEnabled()` → flag-off returns `{enabled:false,reason:'flag_off'}`; **never 500s** (try/catch → `{enabled:false,reason:'error'}`). Reuses `parseAnalyzeEnvelope` + `analyzeConcern(...,excludeIds)` to rebuild the SAME seen-filtered, proxy-reframed candidate pool `/analyze` uses, then `runAdaptiveSelection`. Body = the analyze envelope + `prior_answers:[{id,question,response_value(0..1),response_label}]`; excludes every answered id (`prior_answers` ids ∪ `answeredIds`). Response: `{enabled:true, clarity_source, resolved_concern_id, next_question, done, info_gain, governance, duplicate, score, ...}`. `/analyze` also surfaces `adaptive_enabled` so the client knows whether to drive incrementally.
- **`response_value` distress proxy**: client sends the chosen option index normalised to 0..1 (last option = max intensity). Valid because trait-inference only attributes an answer to a trait when the STEM carries distress keywords, and those stems use ascending-intensity option scales (see `services/adaptive/trait-inference.ts`).
- **Contradiction pairs (T8) — live in runtime**: `services/contradiction-engine.ts` gains pure `detectTraitPairContradictions(responses)` (distress-normalises `response_value` by `scaleMax`, inverts `(+)`-polarity items, reuses `detectTraitContradictions(buildTraitMap(...))`) wired into the `detectContradictions` orchestrator **behind `isAdaptiveQuestioningEnabled()`**. Three new named pairs: high-confidence+avoidance, perfectionism+rapid-execution, low-confidence+strong-performance. Migration `20260601_contradiction_trait_pairs.sql` extends the `contradiction_events` CHECK with the 3 new types; loader SQL adds `question` (`COALESCE(si.question, saq.question_text)`).
- **Frontend driver** (`FreeAssessmentModal.tsx`): armed only when `data.adaptive_enabled && batch.length>0 && no prefilled_answers`. Shows the opener, retains the full analyze batch in `adaptiveFullBatchRef` as fallback, and on each answer calls `/adaptive-next` (`advanceAdaptive`) to append the next best question. Every failure mode — flag off / `enabled:false` / network error / duplicate or empty pick / client cap (`ADAPTIVE_MAX_QUESTIONS=12`) — degrades to the next unshown batch question or finishes to the bridge phase. `done:true` finishes early (adaptive length). State reset alongside `clarifyAnswers` in both reset paths.

## §27 Question Registry & Governance (Phase 5 — long-term maintainability)

Lifecycle-tracks every clarity question so the bank can scale to **20,000+** items under **human** governance. Additive — does NOT touch the live picker/runtime; it observes (snapshots metrics) and records human lifecycle decisions. **Hard rule: questions are NEVER auto-deprecated — every status transition is human-only and audited.**

- **Lifecycle statuses**: `draft → testing → active → candidate_for_retirement → deprecated → archived` (`LIFECYCLE_STATUSES`; `SERVING_STATUSES` = those still shown). The CHECK constraint enforces the set at the DB.
- **Table** `capadex_question_registry` (one row per `capadex_clarity_questions.question_id`) · migration `20260601_question_registry.sql` (canonical; mirrors lazy `ensureQuestionRegistrySchema`, no runner). Cols: `version`, `status`, `quality_score`/`quality_overridden`, `usage_count`/`last_used_at`, `signal_value`, `report_impact`, `duplicate_of`/`duplicate_score`, `metrics_computed_at`, `status_changed_at`/`status_changed_by`/`review_notes`. Indexed on status/quality/usage/signal/duplicate for 20k-scale filtering.
- **Service** `backend/services/question-registry-service.ts` (pure-ish, pool-driven):
  - `refreshRegistry` — bulk idempotent **snapshot**: backfills a row (default `active`) for any clarity question lacking one, recomputes metric columns for every row, NEVER changes status, and skips `quality_score` for `quality_overridden` rows. Usage from `capadex_responses` (`item_id::text` — col is uuid-typed but stores the TEXT question_id, cast defensively). signal_value/report_impact from `capadex_evidence` (`source_id`=question_id) + pattern `evidence_refs`; **NULL when no traceable evidence — never a fabricated neutral value** (memory: gate "absent" on a real-data marker).
  - **Quality heuristic** (0..1): structural (length/options/response_type) ≤0.40 + `max(usage-band, signal-band)` ≤0.30 + distinctness (1 − nearest duplicate) ≤0.30. Human-overridable.
  - **Duplicate detection**: bucketed by `master_bridge_tag` (Σ small n², avoids a 14k² blow-up), Jaccard token-set overlap reusing `adaptive/zero-repetition.ts` (`SEMANTIC_THRESHOLD=0.82`). Stores each row's nearest sibling + score (informational only).
  - `buildGovernanceData` → four triage buckets: **weak** (`quality < 0.45`, serving), **duplicate** (`score ≥ 0.82`), **low-signal** (measured `signal < 0.30`, OR serving-but-never-asked **only once `systemHasUsage` — before any assessment runs, unmeasured ≠ low-signal**, else the whole bank floods the bucket), **retirement candidates** (human-marked `candidate_for_retirement` ∪ algorithmic *suggestions* = weak AND (duplicate OR low-signal), each flagged "needs human review — not auto-retired"). Per-bucket cap 500 (triage surface, not a dump).
  - `getRegistryPage` — server-side paginated (status/search/limit/offset) for the 20k-safe table view. `transitionStatus` — the **ONLY** status writer; bumps audit cols, optional `quality_score` override sets `quality_overridden`.
- **API** `backend/routes/capadex-question-registry.ts` (`requireAuth`+`requireSuperAdmin`, 60s cache invalidated on refresh/PATCH): `GET stats|registry|governance|export.csv` (CSV formula-injection-guarded, paged stream), `POST refresh`, `PATCH /:question_id` (human transition; invalid status → 400). **New route → needs Backend API restart.**
- **SuperAdmin** panel `frontend/src/components/superadmin/QuestionRegistryPanel.tsx` (nav `question-registry`, CAPADEX group, icon `ClipboardList`): stat cards + lifecycle distribution, **Governance dashboard** (4 triage buckets, "Review" → transition modal) and **Full registry** (paginated, searchable, per-row "Edit"). The transition modal is the human gate — pick a new status + review note; explicit banner that nothing is auto-deprecated.

## §28 Phase 6 — Behavioural Coverage, Report-Backward Utility, Strength Discovery (additive)

Three additive, flag-free, read-only deepenings that turn the questionnaire into an investigation. None alter the live picker / signal runtime; all are empty-safe and never fabricate.

### Behavioural Coverage Engine (T1)
- **Question** `backend/services/behavioral-coverage-engine.ts` (pure): `classifyDimension(question)` → ONE of **10 investigation dimensions** (`root_cause`, `trigger`, `thought_pattern`, `emotional_state`, `behavioral_response`, `avoidance`, `coping_strategy`, `impact`, `strength_asset`, `change_readiness`) via stage/polarity/response_type + stem-keyword scoring; **`NONE` when nothing matches — never a default dimension**. `buildCoverageReport(pool)` → per-concern covered dims + explicit gaps (the dims a concern is missing).
- **Persistence** — `refreshRegistry` additively classifies every row and writes 4 cols on `capadex_question_registry`: `coverage_dimension` (primary), `coverage_dimensions` JSONB (all matched), `coverage_method`, `coverage_confidence`. Migration `20260602_question_registry_coverage.sql` (canonical; mirrors lazy ALTER). Verified: refresh tagged **14,294** Qs (13,931 classified, 363 honestly unclassified), avg coverage 0.652.
- **API** `GET /api/admin/capadex/question-registry/coverage` (+ `coverage.csv`) → dimension distribution + per-concern gaps. **Panel** 3rd tab "Behavioural coverage" in `QuestionRegistryPanel.tsx`.

### Report-Backward Utility Validator (T2)
- **Service** `backend/services/question-utility-index.ts` (read-only): walks each question's `master_bridge_tag` → `capadex_concern_signal_map.relational_bridge_tag` → reuses `validateConcernSignalChain` to check the mapped concern(s) actually reach an intervention. Statuses `reaches_intervention | dead_end | unknown`. **Self-disables (`mapped:false`) when the signal map has no tier3 rows** — so a missing map never floods a false dead-end bucket.
- **Governance** — `buildGovernanceData` gains a 5th triage bucket **`dead_end`** (a question whose answer reaches NO intervention because the chain breaks upstream) + `governance.utility_mapped` flag. Surfaced in the governance API + a 5th panel bucket. **Human-review only — nothing auto-removed.** Current data: `dead_end=0` (genuine — chain complete 2486/2489, breaks only at the 3 orphan rows), `utility_mapped=true`. A real dead-end IS a finding, not tuned away.

### Strength Discovery Engine (T3)
- **Service** `backend/services/strength-discovery-engine.ts` (read-only, empty-safe): `discoverStrengths(pool, scope)` where `scope` = a user email OR a session UUID (resolved to email via `capadex_sessions.guest_email`). Consolidates ONLY genuinely-positive computed evidence into `{strengths, resilience, coping, success_patterns}`, each item `{label, evidence, source, confidence}`:
  - `strengths` ← `csi_profiles.positive_factors` (CSI's own domain-score ≥65 capture).
  - `resilience` ← longitudinal `resilience_recoveries` (≥15-pt rebound after a low).
  - `coping` ← longitudinal `growth_patterns` (sustained ≥3-session improvement).
  - `success_patterns` ← longitudinal `recurring_constructs` with an improving trend + avg ≥65.
- **HARD RULE (memory canon): strengths NEVER come from raw signal magnitude** — the signal runtime is concern-DIAGNOSTIC. Positive surfaces come ONLY from CSI positive_factors + positive longitudinal trends.
- **API** `GET /api/capadex/strengths/:scope` (public, empty-safe) + additive `strengths` key on `GET /api/capadex/session/:id/explain` (best-effort, `null` on failure — never breaks /explain).


---

# PART III — API Reference

n_notes?, reviewed_by? }
```

#### Pricing Admin
```
GET /api/admin/capadex/pricing
PUT /api/admin/capadex/pricing/:stage_code
Body: { price, price_note, tag, description, benefits[], whatsapp_number, is_active }
```

#### Signal Intelligence Admin
```
GET /api/admin/signals/dashboard
Returns: { kpis, severity_distribution, top_signals[], recent_warnings[] }

GET /api/admin/signals/profiles?severity=&priority=&warnings_only=&search=&page=
GET /api/admin/signals/profiles/:sessionId
Returns: { profile, signals[], linguistic_analysis }
```

#### CSI Admin
```
GET  /api/admin/csi/profiles?search=&stage=&page=
GET  /api/admin/csi/profiles/:email
Returns: { profile, trajectory[], session_history[] }

GET  /api/admin/csi/analytics
Returns: { kpis, stage_distribution[], top_concerns[], daily_trend[], top_performers[] }

GET   /api/admin/csi/domain-weights
PATCH /api/admin/csi/domain-weights/:id
Body: { weight?, is_active? }
```

#### Concern Intelligence Admin
```
GET   /api/admin/ci/categories
PATCH /api/admin/ci/categories/:key
Body: { label?, keywords?, severity_high?, severity_low?, default_signals?,
        patterns?, subdomains?, preview_templates?, mirror_templates?,
        sort_order?, is_active? }

GET    /api/admin/ci/questions?category=&persona=
POST   /api/admin/ci/questions
Body: { question_key, category, persona?, sort_order?, question, options[] }
PATCH  /api/admin/ci/questions/:id
DELETE /api/admin/ci/questions/:id
```

#### Audit Trail
```
GET /api/admin/capadex/audit-events
Returns: [{ event_type, user_id, session_id, actor, payload, created_at }]
```

---

## 9. Admin Dashboard Guide

Access the super admin dashboard by logging in at `/` with:
- Email: `superadmin@metryx.one`
- Password: `admin123`

Navigate to the admin dashboard via the SPA navigation.

### CAPADEX Intelligence Sidebar Group

The following panels are available under the "CAPADEX Intelligence" sidebar group:

---

#### 9.1 CAPADEX Framework

The CAPADEX Framework panel (`CapadexFrameworkPanel`) provides full management of the assessment framework content across 8 tabs:

| Tab | What you can manage |
|-----|-------------------|
| **Overview** | Live DB counts (domains, subdomains, stages, items, norms, weights, clusters) |
| **Domains** | Add / edit / delete assessment domains |
| **Subdomains** | Add / edit / delete subdomains (linked to domains) |
| **Content** | Assessment items (questions) with weight, polarity, anchor flag |
| **Clusters** | Domain clustering configurations |
| **Norms** | Age-band scoring norms per subdomain |
| **Weights** | Stage-level domain weighting |
| **Short Assessments** | Admin-managed question bank per concern area per stage |
| **Concern Areas** | The 160 concern areas with category, personas, assessment type |
| **Versions** | Framework version tracking |
| **Reports** | Export configurations |

---

#### 9.2 Users & Journeys

Lists all registered CAPADEX users with:
- Search by name, email, phone
- Filter: verified / all
- Columns: name, email, status, sessions completed, concerns assessed, avg score

**User Journey Drawer** (click any user):
- Gamification summary (XP, Level, Badges)
- Open risk flags
- Assessment journey grouped by concern, showing all completed stages with scores
- Recommendations list
- Active interventions

---

#### 9.3 Analytics & Cohorts

Dashboard with the following sections:
- **KPIs**: total sessions, unique users, completion rate, good outcomes (score ≥ 65)
- **Stage Conversion Funnel**: how many users progress from Curiosity → Mastery
- **Score Distribution**: histogram across 0–100 range
- **Top Concerns**: most assessed concern areas by volume
- **Daily Sessions**: last 30 days trend line
- **Age Bands**: distribution of A / B / C / 19+ participants
- **Persona Distribution**: student / parent / professional breakdown

---

#### 9.4 Risk & Interventions

**Risk Flags tab:**
- All auto-detected risk flags (score < 40 threshold)
- Filter by severity: critical / high / medium
- Filter by status: open / resolved
- Resolve flag: add resolution notes, mark resolved

**Interventions tab:**
- Create manual interventions linked to a user + risk flag
- Assign to a team member, set priority and due date
- Track status: pending → active → completed / cancelled
- Record outcome notes and outcome score

---

#### 9.5 Upgrade Pricing

Manage the paywall pricing for stages Insight, Growth, and Mastery (Curiosity is always free):

Per stage card:
- **Price** (e.g. ₹499)
- **Price note** (e.g. "one-time · results in 24 hrs")
- **Tag** (e.g. "Most Popular")
- **Description** paragraph
- **Benefits** bullet list (add/remove)
- **WhatsApp number** for direct inquiry
- **Active/Inactive toggle** — hide a stage from the upgrade wall

---

#### 9.6 Signal Intelligence

**Dashboard tab:**
- KPI cards: sessions analyzed, early warnings detected, avg risk score, urgent priority count
- Severity distribution: minimal / low / medium / high / critical
- Top 10 most frequent detected signals
- Recent early warnings list

**Profiles tab:**
- Paginated table of session signal profiles
- Color-coded heatmap cells per dimension (emotional / cognitive / engagement / risk)
- Filters: severity level, intervention priority, early-warnings-only toggle, search

**Profile Detail Drawer** (click any row):
- Dimension score bars (Emotional Load, Cognitive Load, Engagement, Risk)
- Early warnings list with severity badges
- Dominant signals ranked by frequency
- Growth indicators present
- Hidden patterns detected
- Linguistic analysis (absolutism score, helplessness indicators, fatigue markers)
- Raw signals table (all 14 signal types with timestamps)

---

#### 9.7 CSI Intelligence

**Profiles tab:**
- Sortable table: email, name, CSI score badge (color by stage), stage badge, sessions count
- Search by name/email
- Filter by stage: Forming / Emerging / Developing / Proficient / Advanced

**Profile Drawer** (click any row):
- CSI score hero (large, color-coded)
- Positive factors: top 3 subdomains (green)
- Negative factors: bottom 3 subdomains (red)
- Domain score bars for all assessed subdomains
- Trajectory sparkline (historical CSI over time)
- Assessment history table (stage, concern, score, date)

**Analytics tab:**
- KPIs: total profiles, avg CSI score, proficient+ count, top stage
- Stage distribution bar chart
- Top concerns in the population
- 30-day CSI trend
- Top performers leaderboard

**Domain Weights tab:**
- All discovered subdomains listed
- Inline editable weight (0–3 slider or input)
- Active/inactive toggle per domain
- Changes affect all future CSI recalculations

---

#### 9.8 Concern Intelligence

**Categories tab** (8 categories, expandable cards):

Each category card allows editing:
- **Display label**
- **Detection keywords** (regex pattern — used to classify concern text)
- **Severity HIGH / LOW keywords** (regex for severity detection)
- **Default Signals** — 3 emotional signals (tag editor)
- **Detected Patterns** — 3 behavioral patterns (tag editor)
- **Subdomains** — 4 relevant subdomains (tag editor)
- **Preview Templates** — 3 intelligence teaser lines (tag editor)
- **Behavioural Mirror** — 4 reflective statements (tag editor)
- **Active toggle** — disable a category from the analyze engine

**Questions tab** (75 questions):
- Filter by category (Digital / Academic / Emotional / etc.)
- Filter by persona (Base / Parent / Professional / Campus / etc.)
- Search by question text or question key
- **Add Question** modal: question key, category, persona, sort order (1–3), question text, 4 answer options, active toggle
- **Edit** any existing question
- **Delete** with confirmation

---

### Other Admin Panels (accessible from other sidebar groups)

| Panel | Location | Purpose |
|-------|----------|---------|
| **Reports** | Intelligence Frameworks | View all CAPADEX participant reports; override scores, headlines, narratives; publish reviewed reports; export CSV |
| **Short Assessments** | Assessment Tools → CAPADEX Framework | Manage question bank per concern area per stage; bulk upload via TSV/CSV |
| **Concern Areas** | Assessment Tools | Manage the 160 concern areas with categories, personas, assessment type |

---

## Appendix: Data Flow Diagram

```
User types concern
        │
        ▼
POST /api/capadex/concern/analyze
        │  (rule engine: detect category/severity/persona)
        │  (returns: mirror, preview, 3 clarification questions)
        ▼
User answers 3 clarification questions (unscored)
        │
        ▼
User sees intelligence preview
        │
        ▼
POST /api/capadex/session/start  (CAP_CUR)
        │  (fetch questions: short_assessment_questions → sdi_items → fallback)
        │  (create capadex_sessions row, guest_email=null)
        ▼
User answers 6–10 questions
        │
POST /api/capadex/session/:id/respond
        │  (store raw + weighted scores in capadex_responses)
        ▼
POST /api/capadex/session/:id/complete
        │  (score = weighted_avg × 100, clamped 0–100)
        │  (subdomain breakdown computed)
        │  (non-blocking: recommendations, risk flags, XP, audit, CSI)
        ▼
capadex_result screen
        │  (score bar chart, subdomain bars, percentile)
        ▼
POST /api/capadex/auth/register  ← user registers here
        │  (backfill guest_email on session)
        │  (send OTP via Zoho)
        ▼
POST /api/capadex/auth/verify-otp
        │  (verify email, backfill guest_email again)
        ▼
GET /api/capadex/report/:session_id
        │  (upsert capadex_reports, apply admin overrides if published)
        ▼
capadex_report screen (full report displayed)
        │
POST /api/capadex/report/:session_id/send-email  (optional)
        │
        ▼
Stages CAP_INS → CAP_GRW → CAP_MAS
(repeat session/start → respond → complete loop)
        │
        ▼
CSI recalculated after each stage
csi_profiles upserted with new score + trajectory snapshot
```

---

*Document generated: May 2026 | MetryxOne — MetryxOne Behavioral Intelligence*


---

# PART IV — Question Relevance Audit (generated snapshot)

# CAPADEX Question Relevance Audit

_Generated 2026-05-31T08:46:59.951Z · read-only · regenerate with `cd backend && npx tsx scripts/audit-question-relevance.ts`_

## 1. Methodology

- **Retrieval replicated** from the live picker: a concern is served from its own `relational_bridge_tag` when that tag has ≥2 clarity rows; otherwise it is routed via the orphan-override → keyword-rule → `GENERAL_CONCERN` cascade (`resolveCoveredBridgeTag`). Questions are ordered by `question_weight` (the picker's primary ordering); the top sample per concern is scored.
- **Relevance score (1–5):** 5 = direct root-cause exploration (cause-framed question **and** diagnostic options); 4 = strongly related (cause-framed **or** diagnostic options, or on-topic non-frequency); 3 = indirectly related (on-topic but frequency/symptom framed); 2 = weakly related (generic frequency, weak topical link or adjacent-tag routing); 1 = unrelated (no topical overlap on a fallback/adjacent bucket).
- **Root-cause question** = matches cause/why/"what is the main reason"/"which factor" patterns. **Diagnostic options** = ≥3 options that are NOT an ordinal/Likert scale (Never/Rarely/…, Slightly/Moderately/Very/…, Disagree/Agree, etc.).
- **Frequency/symptom question** = "how often…" stem OR Never/Rarely/Sometimes/Often/Always options.

## 2. Headline findings

- **Concerns:** 2489 · **Clarity questions:** 14294 · **Covered bridge tags:** 56
- **Concerns on fallback questions** (own tag <2 curated rows → routed elsewhere): **524** (21.1%)
- **Concerns with insufficient coverage** (own tag <10 rows): **524** (21.1%)
- **Question samples scored:** 14934 · **scored below 4 (flagged):** 14331 (96.0%)
- **Direct root-cause + diagnostic-option questions:** 0 (0.0%) — the core gap
- **Response-type ↔ option mismatches:** 0

**Score distribution (sampled concern-question pairs):**

| Score | Meaning | Count | Share |
|---|---|---|---|
| 5 | Direct root cause | 0 | 0.0% |
| 4 | Strongly related | 603 | 4.0% |
| 3 | Indirectly related | 3837 | 25.7% |
| 2 | Weakly related | 8107 | 54.3% |
| 1 | Unrelated | 2387 | 16.0% |

## 3. Concerns using fallback questions

524 concerns have <2 curated questions on their own bridge tag and are served from an adjacent/general bucket. First 60:

| concern_id | name | own_tag | served_from | own_rows |
|---|---|---|---|---|
| CONCERN_ACA_1174 | Visibility into Classroom Engagement Patterns | STUDENT_ENGAGEMENT | STUDENT_SUCCESS | 0 |
| CONCERN_ACA_1178 | Measure Institutional Learning Effectiveness | ORGANIZATIONAL_EFFECTIVENESS | LEADERSHIP_OWNERSHIP | 0 |
| CONCERN_ACA_1188 | Measure Collaborative Competencies Institutionally | COLLABORATION_OWNERSHIP | LEADERSHIP_OWNERSHIP | 0 |
| CONCERN_ACA_1194 | Visibility into Future Career Readiness Across Students | EMPLOYABILITY_FUTURE | EMPLOYABILITY | 0 |
| CONCERN_ACA_1198 | Visibility into Teacher Competency Growth Needs | FACULTY_DEVELOPMENT | INSTRUCTIONAL_QUALITY | 0 |
| CONCERN_ACA_1211 | Holistic School Effectiveness Beyond Academic Results | ORGANIZATIONAL_EFFECTIVENESS | LEADERSHIP_OWNERSHIP | 0 |
| CONCERN_ACA_1217 | Detecting Faculty Motivation Decline Early | FACULTY_SUSTAINABILITY | INSTRUCTIONAL_QUALITY | 0 |
| CONCERN_ACA_1224 | Measure Institutional Adaptability Readiness | ORGANIZATIONAL_DEVELOPMENT | LEADERSHIP_OWNERSHIP | 0 |
| CONCERN_ACA_1232 | Build Institutional Reflective Teaching Practices | FACULTY_DEVELOPMENT | INSTRUCTIONAL_QUALITY | 0 |
| CONCERN_ACA_1249 | Faculty Emotional Wellbeing Institutionally | FACULTY_SUSTAINABILITY | INSTRUCTIONAL_QUALITY | 0 |
| CONCERN_ACA_1264 | Measure Classroom Engagement Quality | STUDENT_ENGAGEMENT | STUDENT_SUCCESS | 0 |
| CONCERN_ACA_1267 | Faculty Delivery Consistency | FACULTY_EFFECTIVENESS | INSTRUCTIONAL_QUALITY | 0 |
| CONCERN_ACA_1269 | Active Learning Environments | INQUIRY_CURIOSITY | THINKING_QUALITY | 0 |
| CONCERN_ACA_1271 | Aligning Assessment Practices with Actual Learning | ASSESSMENT_INTELLIGENCE | GENERAL_CONCERN | 0 |
| CONCERN_ACA_1275 | Balancing Academic Rigor with Learning Absorption | LEARNING_SUSTAINABILITY | LEARNING_ADAPTABILITY | 0 |
| CONCERN_ACA_1285 | Academic Delivery Fatigue Among Teachers | FACULTY_SUSTAINABILITY | INSTRUCTIONAL_QUALITY | 0 |
| CONCERN_ACA_1302 | Personalize Student Intervention Pathways | STUDENT_SUPPORT | STUDENT_SUCCESS | 0 |
| CONCERN_ACA_1348 | concentration during classes | LEARNING_INTERVENTION | LEARNING_ADAPTABILITY | 0 |
| CONCERN_ACA_1351 | conceptual clarity in STEM subjects | SUBJECT_INTERVENTION | ACADEMIC_COGNITIVE | 0 |
| CONCERN_ACA_1366 | Digital addiction reducing study efficiency | STUDENT_BEHAVIOUR | STUDENT_SUCCESS | 0 |
| CONCERN_ACA_1376 | Fear of failure leading to academic avoidance | ACADEMIC_RISK | ACADEMIC_COGNITIVE | 0 |
| CONCERN_ACA_1377 | career clarity after Class 10/12 | CAREER_GUIDANCE | CAREER_READINESS | 0 |
| CONCERN_ACA_1439 | Excessive procrastination before exams | PERFORMANCE_BEHAVIOR | GENERAL_CONCERN | 0 |
| CONCERN_ACA_1572 | visualizing future self and goals | FUTURE_ORIENTATION | GENERAL_CONCERN | 0 |
| CONCERN_ACA_1598 | awareness of personal stress responses | EMOTIONAL_REFLECTION | EMOTIONAL_REGULATION | 0 |
| CONCERN_ACA_1616 | Absence of structured self-reflection habits | REFLECTIVE_DEVELOPMENT | THINKING_QUALITY | 0 |
| CONCERN_ACA_1627 | setting realistic personal goals | GOAL_REFLECTION | THINKING_QUALITY | 0 |
| CONCERN_ACA_1664 | Revising Effectively | EXAMINATION_READINESS | EXAMINATION_STRESS | 0 |
| CONCERN_ACA_1707 | Tracking Academic Progress | ACADEMIC_PERFORMANCE | ACADEMIC_COGNITIVE | 0 |
| CONCERN_ACA_1708 | Maintain Revision Schedules | EXAMINATION_READINESS | EXAMINATION_STRESS | 0 |
| CONCERN_ACA_1716 | Revising Large Syllabus | EXAMINATION_READINESS | EXAMINATION_STRESS | 0 |
| CONCERN_ACA_1722 | Linking Concepts Across Subjects | INTERDISCIPLINARY_LEARNING | LEARNING_ADAPTABILITY | 0 |
| CONCERN_ACA_2014 | Exam Writing Speed | EXAMINATION_READINESS | EXAMINATION_STRESS | 0 |
| CONCERN_ACA_2031 | Attention During Revision | EXAMINATION_READINESS | EXAMINATION_STRESS | 0 |
| CONCERN_ACA_2045 | Structuring Revision Priorities | EXAMINATION_READINESS | EXAMINATION_STRESS | 0 |
| CONCERN_ACA_2067 | Understanding Examination Patterns | EXAMINATION_READINESS | EXAMINATION_STRESS | 0 |
| CONCERN_ACA_2147 | Building Collaborative Learning Culture | COLLABORATION_OWNERSHIP | LEADERSHIP_OWNERSHIP | 0 |
| CONCERN_ACA_2156 | Students with Poor Revision Habits | EXAMINATION_READINESS | EXAMINATION_STRESS | 0 |
| CONCERN_ACA_2240 | Handling Students with Weak Subject Prioritization During Exams | EXAMINATION_READINESS | EXAMINATION_STRESS | 0 |
| CONCERN_ACA_2245 | Students with Weak Performance Consistency Across Subjects | ACADEMIC_PERFORMANCE | ACADEMIC_COGNITIVE | 0 |
| CONCERN_ACA_2311 | Adapting to Academic Changes | TRANSITION_CHANGE | TRANSITION_READINESS | 0 |
| CONCERN_ACA_2324 | Academic Recovery After Long Vacations | ACADEMIC_PLANNING | ACADEMIC_COGNITIVE | 0 |
| CONCERN_ACA_779 | Cross-Generational Team Dynamics | COLLABORATION_OWNERSHIP | LEADERSHIP_OWNERSHIP | 0 |
| CONCERN_ACA_953 | Balancing Enterprise Expansion with Leadership Stability | STRATEGIC_LEADERSHIP | ADAPTIVE_LEADERSHIP | 0 |
| CONCERN_ACC_1546 | Fear of stepping outside comfort zone | PERSONAL_EXPANSION | GENERAL_CONCERN | 0 |
| CONCERN_ACC_1639 | reflection on communication and relationships | SOCIAL_REFLECTION | THINKING_QUALITY | 0 |
| CONCERN_ADA_1339 | Placement Preparation Effectiveness Institutionally | PLACEMENT_OPERATIONS | WORKPLACE_ADAPTATION | 0 |
| CONCERN_ADA_1420 | balance academics and personal life | STUDENT_WELLNESS | EMOTIONAL_REGULATION | 0 |
| CONCERN_ADA_1444 | persistence in difficult subjects | LEARNING_PERSISTENCE | LEARNING_ADAPTABILITY | 0 |
| CONCERN_ADA_1479 | Students lacking ownership and accountability | LEADERSHIP_ACCOUNTABILITY | LEADERSHIP_OWNERSHIP | 0 |
| CONCERN_ADA_1519 | identifying motivational drivers | MOTIVATION_MAPPING | MOTIVATION_VALUES | 0 |
| CONCERN_ADA_1544 | articulating strengths confidently | SELF_EXPRESSION | COMMUNICATION_EXPRESSION | 0 |
| CONCERN_ADA_1641 | consistency between goals and actions | INTEGRITY_REFLECTION | THINKING_QUALITY | 0 |
| CONCERN_ADJ_2216 | Supporting Students with Weak Subject Integration Skills | INTERDISCIPLINARY_LEARNING | LEARNING_ADAPTABILITY | 0 |
| CONCERN_ALT_1570 | define personal career values | CAREER_PRIORITIZATION | CAREER_READINESS | 0 |
| CONCERN_ANA_1719 | Verbal Reasoning Skills | ANALYTICAL_DEVELOPMENT | THINKING_QUALITY | 0 |
| CONCERN_ASP_1505 | emotional self-awareness | EMOTIONAL_LITERACY | EMOTIONAL_REGULATION | 0 |
| CONCERN_ASP_1575 | balancing passion and financial security | CAREER_TRADEOFF | CAREER_READINESS | 0 |
| CONCERN_ASS_1272 | Measure Student Participation Equity | COLLABORATION_OWNERSHIP | LEADERSHIP_OWNERSHIP | 0 |
| CONCERN_ATT_1608 | differentiating interest from competency | SELF_DISCOVERY | SELF_PERCEPTION | 0 |
| … | _+464 more (see CSV)_ | | | |

## 4. Bridge tags with low average relevance

| served_tag | avg_score | sampled |
|---|---|---|
| GENERAL_CONCERN | 1.08 | 222 |
| INSTRUCTIONAL_QUALITY | 1.08 | 72 |
| TRANSITION_READINESS | 1.25 | 36 |
| LEADERSHIP_OWNERSHIP | 1.61 | 966 |
| LEARNING_ADAPTABILITY | 1.61 | 330 |
| EMPLOYABILITY | 1.86 | 336 |
| EMOTIONAL_REGULATION | 1.86 | 762 |
| EXAMINATION_STRESS | 1.87 | 1044 |
| ADAPTIVE_LEADERSHIP | 1.90 | 204 |
| SELF_PERCEPTION | 1.92 | 186 |
| HOLISTIC_DEVELOPMENT | 1.93 | 438 |
| ADJUSTMENT_COPING | 1.97 | 282 |
| WORKPLACE_ADAPTATION | 1.99 | 360 |
| COMPETENCY_DEVELOPMENT | 2.00 | 366 |
| CONFIDENCE_DEVELOPMENT | 2.00 | 6 |
| LONG_TERM | 2.00 | 12 |
| OVER_COMPLIANCE | 2.00 | 24 |
| CONFIDENCE_BUILDING | 2.00 | 6 |
| COMMUNICATION_EXPRESSION | 2.02 | 852 |
| CLASSROOM_ENGAGEMENT | 2.05 | 102 |
| LIFESTYLE_PRESSURE | 2.06 | 708 |
| STEM_LEARNING | 2.07 | 96 |
| DISCIPLINE_HABITS | 2.10 | 636 |
| SELF_REFLECTION | 2.15 | 192 |
| CAREER_EXPOSURE | 2.17 | 6 |
| PERSONAL_VISION | 2.17 | 6 |
| STUDENT_SUCCESS | 2.18 | 78 |
| MOTIVATION_VALUES | 2.18 | 840 |
| STRATEGIC_PREPARATION | 2.19 | 210 |
| CAREER_EXPECTATIONS | 2.33 | 6 |
| HIGHER_EDUCATION | 2.33 | 6 |
| CONFIDENCE_SELF | 2.43 | 1092 |
| EMOTIONAL_RECOVERY | 2.44 | 312 |
| COMPETENCY_INTELLIGENCE | 2.50 | 18 |
| MULTI_POTENTIALITY | 2.50 | 6 |
| WORKPLACE_FIT | 2.50 | 6 |
| SOCIAL_EMOTIONAL | 2.51 | 510 |
| THINKING_QUALITY | 2.51 | 762 |
| ACADEMIC_COGNITIVE | 2.53 | 978 |
| ACADEMIC_IDENTITY | 2.62 | 522 |
| ACADEMIC_TRANSITION | 2.67 | 18 |
| LEARNING_DEPENDENCY | 2.83 | 6 |
| LEARNING_AWARENESS | 2.83 | 6 |
| COMPETITIVE_EXAM | 2.85 | 48 |
| FOUNDATIONAL_LEARNING | 2.89 | 90 |
| CAREER_READINESS | 2.97 | 684 |

## 5. Response-type ↔ option mismatches

0 sampled questions declare a `response_type` that does not match their option vocabulary (e.g. declared a richer scale but shipped Never/Rarely/… options, or declared `frequency` without the frequency scale). Examples:

| question_id | response_type | options |
|---|---|---|

## 6. Concerns with insufficient question coverage

524 concerns have fewer than 10 curated rows on their own bridge tag. First 60 (worst first):

| concern_id | name | own_tag | own_rows |
|---|---|---|---|
| CONCERN_ACA_1174 | Visibility into Classroom Engagement Patterns | STUDENT_ENGAGEMENT | 0 |
| CONCERN_ACA_1178 | Measure Institutional Learning Effectiveness | ORGANIZATIONAL_EFFECTIVENESS | 0 |
| CONCERN_ACA_1188 | Measure Collaborative Competencies Institutionally | COLLABORATION_OWNERSHIP | 0 |
| CONCERN_ACA_1194 | Visibility into Future Career Readiness Across Students | EMPLOYABILITY_FUTURE | 0 |
| CONCERN_ACA_1198 | Visibility into Teacher Competency Growth Needs | FACULTY_DEVELOPMENT | 0 |
| CONCERN_ACA_1211 | Holistic School Effectiveness Beyond Academic Results | ORGANIZATIONAL_EFFECTIVENESS | 0 |
| CONCERN_ACA_1217 | Detecting Faculty Motivation Decline Early | FACULTY_SUSTAINABILITY | 0 |
| CONCERN_ACA_1224 | Measure Institutional Adaptability Readiness | ORGANIZATIONAL_DEVELOPMENT | 0 |
| CONCERN_ACA_1232 | Build Institutional Reflective Teaching Practices | FACULTY_DEVELOPMENT | 0 |
| CONCERN_ACA_1249 | Faculty Emotional Wellbeing Institutionally | FACULTY_SUSTAINABILITY | 0 |
| CONCERN_ACA_1264 | Measure Classroom Engagement Quality | STUDENT_ENGAGEMENT | 0 |
| CONCERN_ACA_1267 | Faculty Delivery Consistency | FACULTY_EFFECTIVENESS | 0 |
| CONCERN_ACA_1269 | Active Learning Environments | INQUIRY_CURIOSITY | 0 |
| CONCERN_ACA_1271 | Aligning Assessment Practices with Actual Learning | ASSESSMENT_INTELLIGENCE | 0 |
| CONCERN_ACA_1275 | Balancing Academic Rigor with Learning Absorption | LEARNING_SUSTAINABILITY | 0 |
| CONCERN_ACA_1285 | Academic Delivery Fatigue Among Teachers | FACULTY_SUSTAINABILITY | 0 |
| CONCERN_ACA_1302 | Personalize Student Intervention Pathways | STUDENT_SUPPORT | 0 |
| CONCERN_ACA_1348 | concentration during classes | LEARNING_INTERVENTION | 0 |
| CONCERN_ACA_1351 | conceptual clarity in STEM subjects | SUBJECT_INTERVENTION | 0 |
| CONCERN_ACA_1366 | Digital addiction reducing study efficiency | STUDENT_BEHAVIOUR | 0 |
| CONCERN_ACA_1376 | Fear of failure leading to academic avoidance | ACADEMIC_RISK | 0 |
| CONCERN_ACA_1377 | career clarity after Class 10/12 | CAREER_GUIDANCE | 0 |
| CONCERN_ACA_1439 | Excessive procrastination before exams | PERFORMANCE_BEHAVIOR | 0 |
| CONCERN_ACA_1572 | visualizing future self and goals | FUTURE_ORIENTATION | 0 |
| CONCERN_ACA_1598 | awareness of personal stress responses | EMOTIONAL_REFLECTION | 0 |
| CONCERN_ACA_1616 | Absence of structured self-reflection habits | REFLECTIVE_DEVELOPMENT | 0 |
| CONCERN_ACA_1627 | setting realistic personal goals | GOAL_REFLECTION | 0 |
| CONCERN_ACA_1664 | Revising Effectively | EXAMINATION_READINESS | 0 |
| CONCERN_ACA_1707 | Tracking Academic Progress | ACADEMIC_PERFORMANCE | 0 |
| CONCERN_ACA_1708 | Maintain Revision Schedules | EXAMINATION_READINESS | 0 |
| CONCERN_ACA_1716 | Revising Large Syllabus | EXAMINATION_READINESS | 0 |
| CONCERN_ACA_1722 | Linking Concepts Across Subjects | INTERDISCIPLINARY_LEARNING | 0 |
| CONCERN_ACA_2014 | Exam Writing Speed | EXAMINATION_READINESS | 0 |
| CONCERN_ACA_2031 | Attention During Revision | EXAMINATION_READINESS | 0 |
| CONCERN_ACA_2045 | Structuring Revision Priorities | EXAMINATION_READINESS | 0 |
| CONCERN_ACA_2067 | Understanding Examination Patterns | EXAMINATION_READINESS | 0 |
| CONCERN_ACA_2147 | Building Collaborative Learning Culture | COLLABORATION_OWNERSHIP | 0 |
| CONCERN_ACA_2156 | Students with Poor Revision Habits | EXAMINATION_READINESS | 0 |
| CONCERN_ACA_2240 | Handling Students with Weak Subject Prioritization During Exams | EXAMINATION_READINESS | 0 |
| CONCERN_ACA_2245 | Students with Weak Performance Consistency Across Subjects | ACADEMIC_PERFORMANCE | 0 |
| CONCERN_ACA_2311 | Adapting to Academic Changes | TRANSITION_CHANGE | 0 |
| CONCERN_ACA_2324 | Academic Recovery After Long Vacations | ACADEMIC_PLANNING | 0 |
| CONCERN_ACA_779 | Cross-Generational Team Dynamics | COLLABORATION_OWNERSHIP | 0 |
| CONCERN_ACA_953 | Balancing Enterprise Expansion with Leadership Stability | STRATEGIC_LEADERSHIP | 0 |
| CONCERN_ACC_1546 | Fear of stepping outside comfort zone | PERSONAL_EXPANSION | 0 |
| CONCERN_ACC_1639 | reflection on communication and relationships | SOCIAL_REFLECTION | 0 |
| CONCERN_ADA_1339 | Placement Preparation Effectiveness Institutionally | PLACEMENT_OPERATIONS | 0 |
| CONCERN_ADA_1420 | balance academics and personal life | STUDENT_WELLNESS | 0 |
| CONCERN_ADA_1444 | persistence in difficult subjects | LEARNING_PERSISTENCE | 0 |
| CONCERN_ADA_1479 | Students lacking ownership and accountability | LEADERSHIP_ACCOUNTABILITY | 0 |
| CONCERN_ADA_1519 | identifying motivational drivers | MOTIVATION_MAPPING | 0 |
| CONCERN_ADA_1544 | articulating strengths confidently | SELF_EXPRESSION | 0 |
| CONCERN_ADA_1641 | consistency between goals and actions | INTEGRITY_REFLECTION | 0 |
| CONCERN_ADJ_2216 | Supporting Students with Weak Subject Integration Skills | INTERDISCIPLINARY_LEARNING | 0 |
| CONCERN_ALT_1570 | define personal career values | CAREER_PRIORITIZATION | 0 |
| CONCERN_ANA_1719 | Verbal Reasoning Skills | ANALYTICAL_DEVELOPMENT | 0 |
| CONCERN_ASP_1505 | emotional self-awareness | EMOTIONAL_LITERACY | 0 |
| CONCERN_ASP_1575 | balancing passion and financial security | CAREER_TRADEOFF | 0 |
| CONCERN_ASS_1272 | Measure Student Participation Equity | COLLABORATION_OWNERSHIP | 0 |
| CONCERN_ATT_1608 | differentiating interest from competency | SELF_DISCOVERY | 0 |

## 7. Top 100 worst concern → question mappings

| # | score | concern_id | concern | served_tag | response_type | question | options |
|---|---|---|---|---|---|---|---|
| 1 | 1 | CONCERN_ACA_1174 | Visibility into Classroom Engagement Pat | STUDENT_SUCCESS | confidence | If you needed to design an improvement plan today, how ready are you to use grade-wise com | Very Low / Low / Moderate / High / Very High |
| 2 | 1 | CONCERN_ACA_1174 | Visibility into Classroom Engagement Pat | STUDENT_SUCCESS | confidence | How confident are you in identifying which grade requires more academic support based on c | Very Low / Low / Moderate / High / Very High |
| 3 | 1 | CONCERN_ACA_1174 | Visibility into Classroom Engagement Pat | STUDENT_SUCCESS | coping_effectiveness | When data is unclear, how effectively can you still make informed academic decisions? | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 4 | 1 | CONCERN_ACA_1178 | Measure Institutional Learning Effective | LEADERSHIP_OWNERSHIP | confidence | Even if execution feels difficult now, how hopeful are you that you can become practically | Very Low / Low / Moderate / High / Very High |
| 5 | 1 | CONCERN_ACA_1178 | Measure Institutional Learning Effective | LEADERSHIP_OWNERSHIP | coping_effectiveness | When you struggle to apply knowledge practically, how effectively can you break problems i | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 6 | 1 | CONCERN_ACA_1178 | Measure Institutional Learning Effective | LEADERSHIP_OWNERSHIP | confidence | Even if practical execution feels difficult now, how confident are you that consistent pra | Very Low / Low / Moderate / High / Very High |
| 7 | 1 | CONCERN_ACA_1178 | Measure Institutional Learning Effective | LEADERSHIP_OWNERSHIP | confidence | If your current level of responsibility continued long-term, how emotionally sustainable w | Very Low / Low / Moderate / High / Very High |
| 8 | 1 | CONCERN_ACA_1178 | Measure Institutional Learning Effective | LEADERSHIP_OWNERSHIP | coping_effectiveness | When emotional fatigue builds up, how effectively can you slow down and reorganize your re | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 9 | 1 | CONCERN_ACA_1178 | Measure Institutional Learning Effective | LEADERSHIP_OWNERSHIP | confidence | Even if responsibilities feel emotionally exhausting now, how confident are you that you c | Very Low / Low / Moderate / High / Very High |
| 10 | 1 | CONCERN_ACA_1188 | Measure Collaborative Competencies Insti | LEADERSHIP_OWNERSHIP | confidence | Even if execution feels difficult now, how hopeful are you that you can become practically | Very Low / Low / Moderate / High / Very High |
| 11 | 1 | CONCERN_ACA_1188 | Measure Collaborative Competencies Insti | LEADERSHIP_OWNERSHIP | coping_effectiveness | When you struggle to apply knowledge practically, how effectively can you break problems i | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 12 | 1 | CONCERN_ACA_1188 | Measure Collaborative Competencies Insti | LEADERSHIP_OWNERSHIP | confidence | Even if practical execution feels difficult now, how confident are you that consistent pra | Very Low / Low / Moderate / High / Very High |
| 13 | 1 | CONCERN_ACA_1188 | Measure Collaborative Competencies Insti | LEADERSHIP_OWNERSHIP | confidence | If your current level of responsibility continued long-term, how emotionally sustainable w | Very Low / Low / Moderate / High / Very High |
| 14 | 1 | CONCERN_ACA_1188 | Measure Collaborative Competencies Insti | LEADERSHIP_OWNERSHIP | coping_effectiveness | When emotional fatigue builds up, how effectively can you slow down and reorganize your re | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 15 | 1 | CONCERN_ACA_1188 | Measure Collaborative Competencies Insti | LEADERSHIP_OWNERSHIP | confidence | Even if responsibilities feel emotionally exhausting now, how confident are you that you c | Very Low / Low / Moderate / High / Very High |
| 16 | 1 | CONCERN_ACA_1194 | Visibility into Future Career Readiness  | EMPLOYABILITY | confidence | If you were called for an interview tomorrow, how prepared would you feel to handle uncert | Very Low / Low / Moderate / High / Very High |
| 17 | 1 | CONCERN_ACA_1194 | Visibility into Future Career Readiness  | EMPLOYABILITY | confidence | How confident are you that you can handle interview pressure successfully even in uncertai | Very Low / Low / Moderate / High / Very High |
| 18 | 1 | CONCERN_ACA_1194 | Visibility into Future Career Readiness  | EMPLOYABILITY | confidence | Even if interviews feel difficult now, how hopeful are you that you can eventually perform | Very Low / Low / Moderate / High / Very High |
| 19 | 1 | CONCERN_ACA_1194 | Visibility into Future Career Readiness  | EMPLOYABILITY | confidence | If you were to attend an interview tomorrow, how emotionally prepared would you feel? | Very Low / Low / Moderate / High / Very High |
| 20 | 1 | CONCERN_ACA_1194 | Visibility into Future Career Readiness  | EMPLOYABILITY | confidence | How confident are you that you can eventually stay calm and confident in all interviews? | Very Low / Low / Moderate / High / Very High |
| 21 | 1 | CONCERN_ACA_1194 | Visibility into Future Career Readiness  | EMPLOYABILITY | confidence | Even if interviews feel stressful now, how hopeful are you that you can become calm and co | Very Low / Low / Moderate / High / Very High |
| 22 | 1 | CONCERN_ACA_1198 | Visibility into Teacher Competency Growt | INSTRUCTIONAL_QUALITY | emotional_impact | If you imagine sudden job loss or lack of placement, how overwhelmed do you feel? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 23 | 1 | CONCERN_ACA_1198 | Visibility into Teacher Competency Growt | INSTRUCTIONAL_QUALITY | confidence | How confident are you that you can handle future job uncertainty calmly? | Very Low / Low / Moderate / High / Very High |
| 24 | 1 | CONCERN_ACA_1198 | Visibility into Teacher Competency Growt | INSTRUCTIONAL_QUALITY | confidence | Even if job markets are unstable, how hopeful do you feel about your own future? | Very Low / Low / Moderate / High / Very High |
| 25 | 1 | CONCERN_ACA_1198 | Visibility into Teacher Competency Growt | INSTRUCTIONAL_QUALITY | confidence | Even if employment conditions are unstable, how emotionally prepared do you feel for the f | Very Low / Low / Moderate / High / Very High |
| 26 | 1 | CONCERN_ACA_1198 | Visibility into Teacher Competency Growt | INSTRUCTIONAL_QUALITY | emotional_stability | When you think about job uncertainty or layoffs in the industry, how emotionally stable do | Very Unstable / Unstable / Neutral / Stable / Very Stable |
| 27 | 1 | CONCERN_ACA_1198 | Visibility into Teacher Competency Growt | INSTRUCTIONAL_QUALITY | intensity | How much does family pressure about job security increase your stress levels? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 28 | 1 | CONCERN_ACA_1211 | Holistic School Effectiveness Beyond Aca | LEADERSHIP_OWNERSHIP | confidence | Even if execution feels difficult now, how hopeful are you that you can become practically | Very Low / Low / Moderate / High / Very High |
| 29 | 1 | CONCERN_ACA_1211 | Holistic School Effectiveness Beyond Aca | LEADERSHIP_OWNERSHIP | coping_effectiveness | When you struggle to apply knowledge practically, how effectively can you break problems i | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 30 | 1 | CONCERN_ACA_1211 | Holistic School Effectiveness Beyond Aca | LEADERSHIP_OWNERSHIP | confidence | Even if practical execution feels difficult now, how confident are you that consistent pra | Very Low / Low / Moderate / High / Very High |
| 31 | 1 | CONCERN_ACA_1211 | Holistic School Effectiveness Beyond Aca | LEADERSHIP_OWNERSHIP | confidence | If your current level of responsibility continued long-term, how emotionally sustainable w | Very Low / Low / Moderate / High / Very High |
| 32 | 1 | CONCERN_ACA_1211 | Holistic School Effectiveness Beyond Aca | LEADERSHIP_OWNERSHIP | coping_effectiveness | When emotional fatigue builds up, how effectively can you slow down and reorganize your re | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 33 | 1 | CONCERN_ACA_1211 | Holistic School Effectiveness Beyond Aca | LEADERSHIP_OWNERSHIP | confidence | Even if responsibilities feel emotionally exhausting now, how confident are you that you c | Very Low / Low / Moderate / High / Very High |
| 34 | 1 | CONCERN_ACA_1217 | Detecting Faculty Motivation Decline Ear | INSTRUCTIONAL_QUALITY | emotional_impact | If you imagine sudden job loss or lack of placement, how overwhelmed do you feel? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 35 | 1 | CONCERN_ACA_1217 | Detecting Faculty Motivation Decline Ear | INSTRUCTIONAL_QUALITY | confidence | How confident are you that you can handle future job uncertainty calmly? | Very Low / Low / Moderate / High / Very High |
| 36 | 1 | CONCERN_ACA_1217 | Detecting Faculty Motivation Decline Ear | INSTRUCTIONAL_QUALITY | confidence | Even if job markets are unstable, how hopeful do you feel about your own future? | Very Low / Low / Moderate / High / Very High |
| 37 | 1 | CONCERN_ACA_1217 | Detecting Faculty Motivation Decline Ear | INSTRUCTIONAL_QUALITY | confidence | Even if employment conditions are unstable, how emotionally prepared do you feel for the f | Very Low / Low / Moderate / High / Very High |
| 38 | 1 | CONCERN_ACA_1217 | Detecting Faculty Motivation Decline Ear | INSTRUCTIONAL_QUALITY | emotional_stability | When you think about job uncertainty or layoffs in the industry, how emotionally stable do | Very Unstable / Unstable / Neutral / Stable / Very Stable |
| 39 | 1 | CONCERN_ACA_1217 | Detecting Faculty Motivation Decline Ear | INSTRUCTIONAL_QUALITY | intensity | How much does family pressure about job security increase your stress levels? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 40 | 1 | CONCERN_ACA_1224 | Measure Institutional Adaptability Readi | LEADERSHIP_OWNERSHIP | confidence | Even if execution feels difficult now, how hopeful are you that you can become practically | Very Low / Low / Moderate / High / Very High |
| 41 | 1 | CONCERN_ACA_1224 | Measure Institutional Adaptability Readi | LEADERSHIP_OWNERSHIP | coping_effectiveness | When you struggle to apply knowledge practically, how effectively can you break problems i | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 42 | 1 | CONCERN_ACA_1224 | Measure Institutional Adaptability Readi | LEADERSHIP_OWNERSHIP | confidence | Even if practical execution feels difficult now, how confident are you that consistent pra | Very Low / Low / Moderate / High / Very High |
| 43 | 1 | CONCERN_ACA_1224 | Measure Institutional Adaptability Readi | LEADERSHIP_OWNERSHIP | confidence | If your current level of responsibility continued long-term, how emotionally sustainable w | Very Low / Low / Moderate / High / Very High |
| 44 | 1 | CONCERN_ACA_1224 | Measure Institutional Adaptability Readi | LEADERSHIP_OWNERSHIP | coping_effectiveness | When emotional fatigue builds up, how effectively can you slow down and reorganize your re | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 45 | 1 | CONCERN_ACA_1224 | Measure Institutional Adaptability Readi | LEADERSHIP_OWNERSHIP | confidence | Even if responsibilities feel emotionally exhausting now, how confident are you that you c | Very Low / Low / Moderate / High / Very High |
| 46 | 1 | CONCERN_ACA_1232 | Build Institutional Reflective Teaching  | INSTRUCTIONAL_QUALITY | emotional_impact | If you imagine sudden job loss or lack of placement, how overwhelmed do you feel? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 47 | 1 | CONCERN_ACA_1232 | Build Institutional Reflective Teaching  | INSTRUCTIONAL_QUALITY | confidence | How confident are you that you can handle future job uncertainty calmly? | Very Low / Low / Moderate / High / Very High |
| 48 | 1 | CONCERN_ACA_1232 | Build Institutional Reflective Teaching  | INSTRUCTIONAL_QUALITY | confidence | Even if job markets are unstable, how hopeful do you feel about your own future? | Very Low / Low / Moderate / High / Very High |
| 49 | 1 | CONCERN_ACA_1232 | Build Institutional Reflective Teaching  | INSTRUCTIONAL_QUALITY | confidence | Even if employment conditions are unstable, how emotionally prepared do you feel for the f | Very Low / Low / Moderate / High / Very High |
| 50 | 1 | CONCERN_ACA_1232 | Build Institutional Reflective Teaching  | INSTRUCTIONAL_QUALITY | emotional_stability | When you think about job uncertainty or layoffs in the industry, how emotionally stable do | Very Unstable / Unstable / Neutral / Stable / Very Stable |
| 51 | 1 | CONCERN_ACA_1232 | Build Institutional Reflective Teaching  | INSTRUCTIONAL_QUALITY | intensity | How much does family pressure about job security increase your stress levels? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 52 | 1 | CONCERN_ACA_1249 | Faculty Emotional Wellbeing Institutiona | INSTRUCTIONAL_QUALITY | emotional_impact | If you imagine sudden job loss or lack of placement, how overwhelmed do you feel? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 53 | 1 | CONCERN_ACA_1249 | Faculty Emotional Wellbeing Institutiona | INSTRUCTIONAL_QUALITY | confidence | How confident are you that you can handle future job uncertainty calmly? | Very Low / Low / Moderate / High / Very High |
| 54 | 1 | CONCERN_ACA_1249 | Faculty Emotional Wellbeing Institutiona | INSTRUCTIONAL_QUALITY | confidence | Even if job markets are unstable, how hopeful do you feel about your own future? | Very Low / Low / Moderate / High / Very High |
| 55 | 1 | CONCERN_ACA_1249 | Faculty Emotional Wellbeing Institutiona | INSTRUCTIONAL_QUALITY | confidence | Even if employment conditions are unstable, how emotionally prepared do you feel for the f | Very Low / Low / Moderate / High / Very High |
| 56 | 1 | CONCERN_ACA_1249 | Faculty Emotional Wellbeing Institutiona | INSTRUCTIONAL_QUALITY | emotional_stability | When you think about job uncertainty or layoffs in the industry, how emotionally stable do | Very Unstable / Unstable / Neutral / Stable / Very Stable |
| 57 | 1 | CONCERN_ACA_1249 | Faculty Emotional Wellbeing Institutiona | INSTRUCTIONAL_QUALITY | intensity | How much does family pressure about job security increase your stress levels? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 58 | 1 | CONCERN_ACA_1264 | Measure Classroom Engagement Quality | STUDENT_SUCCESS | confidence | If you needed to design an improvement plan today, how ready are you to use grade-wise com | Very Low / Low / Moderate / High / Very High |
| 59 | 1 | CONCERN_ACA_1264 | Measure Classroom Engagement Quality | STUDENT_SUCCESS | confidence | How confident are you in identifying which grade requires more academic support based on c | Very Low / Low / Moderate / High / Very High |
| 60 | 1 | CONCERN_ACA_1264 | Measure Classroom Engagement Quality | STUDENT_SUCCESS | coping_effectiveness | When data is unclear, how effectively can you still make informed academic decisions? | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 61 | 1 | CONCERN_ACA_1267 | Faculty Delivery Consistency | INSTRUCTIONAL_QUALITY | emotional_impact | If you imagine sudden job loss or lack of placement, how overwhelmed do you feel? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 62 | 1 | CONCERN_ACA_1267 | Faculty Delivery Consistency | INSTRUCTIONAL_QUALITY | confidence | How confident are you that you can handle future job uncertainty calmly? | Very Low / Low / Moderate / High / Very High |
| 63 | 1 | CONCERN_ACA_1267 | Faculty Delivery Consistency | INSTRUCTIONAL_QUALITY | confidence | Even if job markets are unstable, how hopeful do you feel about your own future? | Very Low / Low / Moderate / High / Very High |
| 64 | 1 | CONCERN_ACA_1267 | Faculty Delivery Consistency | INSTRUCTIONAL_QUALITY | confidence | Even if employment conditions are unstable, how emotionally prepared do you feel for the f | Very Low / Low / Moderate / High / Very High |
| 65 | 1 | CONCERN_ACA_1267 | Faculty Delivery Consistency | INSTRUCTIONAL_QUALITY | emotional_stability | When you think about job uncertainty or layoffs in the industry, how emotionally stable do | Very Unstable / Unstable / Neutral / Stable / Very Stable |
| 66 | 1 | CONCERN_ACA_1267 | Faculty Delivery Consistency | INSTRUCTIONAL_QUALITY | intensity | How much does family pressure about job security increase your stress levels? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 67 | 1 | CONCERN_ACA_1269 | Active Learning Environments | THINKING_QUALITY | confidence | How confident do you feel about making quick decisions when under pressure? | Very Low / Low / Moderate / High / Very High |
| 68 | 1 | CONCERN_ACA_1269 | Active Learning Environments | THINKING_QUALITY | confidence | If you were placed in a high-pressure situation tomorrow, how ready would you feel to make | Very Low / Low / Moderate / High / Very High |
| 69 | 1 | CONCERN_ACA_1269 | Active Learning Environments | THINKING_QUALITY | confidence | How confident are you that you can improve your decision-making ability under pressure ove | Very Low / Low / Moderate / High / Very High |
| 70 | 1 | CONCERN_ACA_1269 | Active Learning Environments | THINKING_QUALITY | confidence | Even if you struggle now, how hopeful are you that you can become confident in decision-ma | Very Low / Low / Moderate / High / Very High |
| 71 | 1 | CONCERN_ACA_1269 | Active Learning Environments | THINKING_QUALITY | confidence | How confident are you that your current subject stream will support your long-term career  | Very Low / Low / Moderate / High / Very High |
| 72 | 1 | CONCERN_ACA_1269 | Active Learning Environments | THINKING_QUALITY | coping_effectiveness | When confused about subject choices, how effectively can you evaluate your strengths and i | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 73 | 1 | CONCERN_ACA_1271 | Aligning Assessment Practices with Actua | GENERAL_CONCERN | confidence | How confident are you in mapping your current skills to real industry job requirements? | Very Low / Low / Moderate / High / Very High |
| 74 | 1 | CONCERN_ACA_1271 | Aligning Assessment Practices with Actua | GENERAL_CONCERN | confidence | How confident are you that you can accurately assess your job readiness before applying fo | Very Low / Low / Moderate / High / Very High |
| 75 | 1 | CONCERN_ACA_1271 | Aligning Assessment Practices with Actua | GENERAL_CONCERN | confidence | Even if you currently feel uncertain, how hopeful are you that you can accurately measure  | Very Low / Low / Moderate / High / Very High |
| 76 | 1 | CONCERN_ACA_1271 | Aligning Assessment Practices with Actua | GENERAL_CONCERN | confidence | Even if overthinking is frequent now, how hopeful are you that you can gain mental clarity | Very Low / Low / Moderate / High / Very High |
| 77 | 1 | CONCERN_ACA_1271 | Aligning Assessment Practices with Actua | GENERAL_CONCERN | confidence | Even if overthinking is frequent now, how hopeful are you that you can gain mental clarity | Very Low / Low / Moderate / High / Very High |
| 78 | 1 | CONCERN_ACA_1271 | Aligning Assessment Practices with Actua | GENERAL_CONCERN | confidence | If you entered a completely new industry tomorrow, how ready would you feel to adjust to i | Very Low / Low / Moderate / High / Very High |
| 79 | 1 | CONCERN_ACA_1275 | Balancing Academic Rigor with Learning A | LEARNING_ADAPTABILITY | confidence | If your industry changed significantly tomorrow, how ready would you feel to adjust your s | Very Low / Low / Moderate / High / Very High |
| 80 | 1 | CONCERN_ACA_1275 | Balancing Academic Rigor with Learning A | LEARNING_ADAPTABILITY | confidence | How confident are you that you can continuously adapt to future industry changes? | Very Low / Low / Moderate / High / Very High |
| 81 | 1 | CONCERN_ACA_1275 | Balancing Academic Rigor with Learning A | LEARNING_ADAPTABILITY | confidence | Even if industry changes feel overwhelming now, how hopeful are you that you can become hi | Very Low / Low / Moderate / High / Very High |
| 82 | 1 | CONCERN_ACA_1275 | Balancing Academic Rigor with Learning A | LEARNING_ADAPTABILITY | confidence | How confident do you feel about adapting your skills when industry trends change quickly? | Very Low / Low / Moderate / High / Very High |
| 83 | 1 | CONCERN_ACA_1275 | Balancing Academic Rigor with Learning A | LEARNING_ADAPTABILITY | coping_effectiveness | When new technologies emerge, how effectively can you learn and apply them quickly? | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 84 | 1 | CONCERN_ACA_1275 | Balancing Academic Rigor with Learning A | LEARNING_ADAPTABILITY | readiness | How ready are you to regularly update your skills to match industry evolution? | Not Ready / Slightly Ready / Somewhat Ready / Ready / Fully  |
| 85 | 1 | CONCERN_ACA_1285 | Academic Delivery Fatigue Among Teachers | INSTRUCTIONAL_QUALITY | emotional_impact | If you imagine sudden job loss or lack of placement, how overwhelmed do you feel? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 86 | 1 | CONCERN_ACA_1285 | Academic Delivery Fatigue Among Teachers | INSTRUCTIONAL_QUALITY | confidence | How confident are you that you can handle future job uncertainty calmly? | Very Low / Low / Moderate / High / Very High |
| 87 | 1 | CONCERN_ACA_1285 | Academic Delivery Fatigue Among Teachers | INSTRUCTIONAL_QUALITY | confidence | Even if job markets are unstable, how hopeful do you feel about your own future? | Very Low / Low / Moderate / High / Very High |
| 88 | 1 | CONCERN_ACA_1285 | Academic Delivery Fatigue Among Teachers | INSTRUCTIONAL_QUALITY | confidence | Even if employment conditions are unstable, how emotionally prepared do you feel for the f | Very Low / Low / Moderate / High / Very High |
| 89 | 1 | CONCERN_ACA_1285 | Academic Delivery Fatigue Among Teachers | INSTRUCTIONAL_QUALITY | emotional_stability | When you think about job uncertainty or layoffs in the industry, how emotionally stable do | Very Unstable / Unstable / Neutral / Stable / Very Stable |
| 90 | 1 | CONCERN_ACA_1285 | Academic Delivery Fatigue Among Teachers | INSTRUCTIONAL_QUALITY | intensity | How much does family pressure about job security increase your stress levels? | Not at all / Slightly / Moderately / Strongly / Extremely |
| 91 | 1 | CONCERN_ACA_1302 | Personalize Student Intervention Pathway | STUDENT_SUCCESS | confidence | If you needed to design an improvement plan today, how ready are you to use grade-wise com | Very Low / Low / Moderate / High / Very High |
| 92 | 1 | CONCERN_ACA_1302 | Personalize Student Intervention Pathway | STUDENT_SUCCESS | coping_effectiveness | When data is unclear, how effectively can you still make informed academic decisions? | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 93 | 1 | CONCERN_ACA_1348 | concentration during classes | LEARNING_ADAPTABILITY | confidence | If your industry changed significantly tomorrow, how ready would you feel to adjust your s | Very Low / Low / Moderate / High / Very High |
| 94 | 1 | CONCERN_ACA_1348 | concentration during classes | LEARNING_ADAPTABILITY | confidence | How confident are you that you can continuously adapt to future industry changes? | Very Low / Low / Moderate / High / Very High |
| 95 | 1 | CONCERN_ACA_1348 | concentration during classes | LEARNING_ADAPTABILITY | confidence | Even if industry changes feel overwhelming now, how hopeful are you that you can become hi | Very Low / Low / Moderate / High / Very High |
| 96 | 1 | CONCERN_ACA_1348 | concentration during classes | LEARNING_ADAPTABILITY | confidence | How confident do you feel about adapting your skills when industry trends change quickly? | Very Low / Low / Moderate / High / Very High |
| 97 | 1 | CONCERN_ACA_1348 | concentration during classes | LEARNING_ADAPTABILITY | coping_effectiveness | When new technologies emerge, how effectively can you learn and apply them quickly? | Very Ineffective / Ineffective / Neutral / Effective / Very  |
| 98 | 1 | CONCERN_ACA_1348 | concentration during classes | LEARNING_ADAPTABILITY | readiness | How ready are you to regularly update your skills to match industry evolution? | Not Ready / Slightly Ready / Somewhat Ready / Ready / Fully  |
| 99 | 1 | CONCERN_ACA_1351 | conceptual clarity in STEM subjects | ACADEMIC_COGNITIVE | confidence | How confident are you that your academic performance will improve in the near future despi | Very Low / Low / Moderate / High / Very High |
| 100 | 1 | CONCERN_ACA_1351 | conceptual clarity in STEM subjects | ACADEMIC_COGNITIVE | coping_effectiveness | When academic performance declines, how effectively can you identify and fix gaps in your  | Very Ineffective / Ineffective / Neutral / Effective / Very  |

## 8. Per-concern data

Full per concern-question rows (concern_id, name, own/effective bridge tag, coverage, question_id, response_type, score, question, options) → `backend/scripts/out/question-relevance-audit.csv`.
