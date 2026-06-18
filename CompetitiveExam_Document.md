# Exam Ready™ — Competitive Exam Feature Document
**MetryxOne Behavioral Intelligence Platform**
*Version 1.0 — May 2026*

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Assessment Framework](#2-assessment-framework)
3. [Pages & User Flow](#3-pages--user-flow)
4. [Question Types & Renderers](#4-question-types--renderers)
5. [Scoring Engine](#5-scoring-engine)
6. [AI Root Cause Analysis](#6-ai-root-cause-analysis)
7. [Personalised Action Plan](#7-personalised-action-plan)
8. [Subscription Plans](#8-subscription-plans)
9. [Guidance Bot (Pragati)](#9-guidance-bot-pragati)
10. [Database Schema](#10-database-schema)
11. [API Reference](#11-api-reference)
12. [Frontend Architecture](#12-frontend-architecture)

---

## 1. Product Overview

**Exam Ready™** is MetryxOne's psychological preparedness assessment for competitive exams. Unlike academic mock tests, it measures the *behavioural and cognitive readiness* required to perform under exam conditions — specifically: stress management, focus, confidence, emotional regulation, study habits, and social factors.

### What it measures

Exam Ready™ does not test subject knowledge. It profiles the student's psychological state and readiness patterns to answer:

- *Why do students who know the content still underperform on exam day?*
- *What behavioural patterns are holding this student back?*
- *What is the 30-day action plan to fix it?*

### Target users

| User | Use case |
|---|---|
| School students (Class 9–12) | Board exam prep, JEE/NEET readiness |
| College students | CAT, GATE, UPSC, competitive certifications |
| Parents | Understand child's psychological readiness |
| Institutions | Batch-level psychological readiness benchmarking |

---

## 2. Assessment Framework

### Six readiness modules

| # | Module | What it measures |
|---|---|---|
| 1 | **Stress Management** | Ability to regulate and recover from exam-related stress |
| 2 | **Focus & Attention** | Sustained concentration and resistance to distraction |
| 3 | **Confidence** | Self-belief under performance pressure |
| 4 | **Emotional Regulation** | Emotional stability before, during, and after exams |
| 5 | **Study Habits** | Quality and consistency of preparation strategies |
| 6 | **Social Factors** | Peer pressure, family expectations, social comparison |

### Assessment types

| Type | Duration | Questions/submodule | Intended for |
|---|---|---|---|
| Mini | ~15 minutes | 2 per submodule | Quick diagnostic / re-test |
| Full (Exam Ready) | 30–40 minutes | 4–8 per submodule | Deep readiness profiling |

### Readiness levels

| Score range | Level | Meaning |
|---|---|---|
| 70–100 | High | Strong psychological readiness |
| 40–69 | Moderate | Some areas need attention |
| 0–39 | Needs Attention | Significant readiness gaps identified |

---

## 3. Pages & User Flow

All pages live under `frontend/src/components/exam-ready/pages/`.

### Complete user flow

```
LandingPage
  └─ CheckoutPage (plan selection + Razorpay payment)
       └─ AssessmentPage (question delivery + timer)
            └─ ReportStatusPage (AI scoring in progress)
                 └─ ReportViewPage (full results + action plan)
```

### Page descriptions

| Page | Component | Purpose |
|---|---|---|
| `LandingPage.tsx` | Product intro | Feature breakdown, testimonials, pricing, CTA |
| `CheckoutPage.tsx` | Plan selection | Mini vs Full, Razorpay integration |
| `AssessmentPage.tsx` | Test-taking interface | Questions, timer, progress, bot widget |
| `ReportStatusPage.tsx` | Processing feedback | Real-time AI scoring status bar |
| `ReportViewPage.tsx` | Results view | Module scores, insights, action plan |

---

## 4. Question Types & Renderers

Questions are stored as MongoDB documents (`ExamReadyQuestion`) and rendered client-side through a registry pattern in `QuestionRenderer.tsx`.

### Renderer registry

| Question type | Renderer | Description |
|---|---|---|
| `word_recall` | `WordRecallRenderer.tsx` | Memory recall task — words shown briefly, user reproduces |
| `attention_click` | `AttentionClickRenderer.tsx` | Focus task — click targets in sequence as they appear |
| `passage_mcq` | `PassageMCQRenderer.tsx` | Read a passage + answer comprehension questions |
| `learning_strategy` | `LearningStrategyRenderer.tsx` | Scenario-based study habit evaluation |
| `likert` | Default renderer | Standard 1–5 agreement scale |
| `scenario_choice` | Default renderer | Situational question with weighted option choices |

### Question metadata (MongoDB document)

```json
{
  "module": "stress_management",
  "subdomain": "recovery_patterns",
  "question_type": "scenario_choice",
  "question_text": "...",
  "options": [
    { "text": "...", "weight": 1.2, "reverse_scored": false }
  ],
  "tier": "full",
  "age_band": "15-18",
  "cognitive_load": "medium"
}
```

### `CategorySwitcher.tsx`

Allows navigation between the 6 readiness modules during the assessment. Shows:
- Module name
- Questions answered / total
- Current readiness indicator per module (updates in real time)

---

## 5. Scoring Engine

### Stratified sampling

When `POST /api/v1/assessment/start` is called, questions are stratified across subdomains to ensure psychometric stability — each submodule is evenly represented regardless of the total question count.

### Score computation

Per module score:
```
moduleScore = Σ(itemScore × weight × polarityFactor) / Σ(maxPossible × weight)  × 100
```

Where:
- `weight` — item-level importance within the subdomain
- `polarityFactor` — 1 for positive items, -1 for reverse-scored items

### Normalisation

Raw scores are normalised to 0–100 using z-score standardisation against the peer cohort (age-matched benchmarks). This is norm-referenced scoring — a student's score reflects their position relative to peers, not an absolute pass/fail.

### Composite score

The overall Exam Ready score is a weighted average across all 6 modules:

| Module | Weight |
|---|---|
| Stress Management | 0.25 |
| Focus & Attention | 0.25 |
| Confidence | 0.15 |
| Emotional Regulation | 0.15 |
| Study Habits | 0.15 |
| Social Factors | 0.05 |

### Comparative benchmarking

Each module score is compared against age-matched peer norms:
- Displayed as a percentile (e.g., "Better than 68% of students in your age group")
- Stored in the report alongside the raw and normalised scores

---

## 6. AI Root Cause Analysis

After scoring, the system identifies cross-module patterns that explain underperformance.

### How it works

1. Identify all modules with `readiness_level = 'Needs Attention'`
2. Find subdomains with the lowest scores within those modules
3. Cross-reference with known pattern library (e.g., low `recovery_patterns` + low `emotional_stability` → "Rumination under pressure" pattern)
4. Generate a natural-language root cause summary

### Example pattern detection

| Detected combination | Root cause label |
|---|---|
| Low Stress Management + Low Emotional Regulation | Stress-emotion coupling |
| Low Focus + Low Study Habits | Preparedness deficit |
| Low Confidence + Low Social Factors | External validation dependency |
| Low Study Habits + Low Confidence | Strategic disorganisation |

The root cause is shown on the `ReportViewPage` as a named pattern with a plain-language explanation and 2–3 contributing factors.

---

## 7. Personalised Action Plan

A 30-day AI-generated roadmap is included in every Full Exam Ready report.

### Structure

| Week | Focus | Example micro-goals |
|---|---|---|
| Week 1 | Awareness + stabilisation | "Identify your top 3 exam triggers", "7-minute breathing exercise daily" |
| Week 2 | Habit building | "Study in 45-minute blocks with 10-minute breaks", "One practice test under timed conditions" |
| Week 3 | Pressure simulation | "Do a full mock test with no interruptions", "Practice positive self-talk after each test" |
| Week 4 | Consolidation | "Review all weak areas", "Simulate exam day routine" |

### Delivery

The action plan is:
- Displayed on `ReportViewPage` as a collapsible weekly card
- Emailable to the student / parent
- Saved to the `exam_ready_attempts` record as a `action_plan JSONB` field

---

## 8. Subscription Plans

### Plans

| Plan | Includes | Price |
|---|---|---|
| **Mini** | 15-min quick diagnostic, module scores, basic insights | Lower price point |
| **Exam Ready (Full)** | 30–40 min full assessment, AI root cause analysis, 30-day action plan, benchmarking | Full price |

### Payment: Razorpay

`CheckoutPage.tsx` integrates with Razorpay:
1. User selects plan
2. `POST /api/capadex/payment/create-order` creates a Razorpay order
3. Razorpay checkout widget opens
4. On payment success: `POST /api/capadex/payment/verify` validates signature + activates `student_subscriptions` row
5. Assessment unlocks immediately

### `student_subscriptions` row on purchase

```sql
{
  user_id: ...,
  package_code: 'exam-ready-full',  -- or 'exam-ready-mini'
  status: 'active',
  expires_at: <30 days from purchase>
}
```

---

## 9. Guidance Bot (Pragati)

`BotWidget.tsx` renders the Pragati conversational bot alongside the assessment flow.

### Bot roles

| Stage | Bot behaviour |
|---|---|
| Pre-assessment (landing) | Answers questions about what Exam Ready measures |
| During checkout | Helps choose between Mini and Full plans |
| During assessment | Offers reassurance if student pauses or seems stuck |
| Post-assessment | Guides through the report, explains scores, suggests next steps |

The bot uses the Pragati runtime (see Pragati section in the CAPADEX document) with a specialised `exam-ready` concern family and pre-set FSM starting state.

---

## 10. Database Schema

### PostgreSQL tables

```sql
exam_ready_attempts
  id SERIAL PRIMARY KEY
  attempt_id UUID UNIQUE
  user_id INTEGER REFERENCES users(id)
  assessment_type TEXT  -- 'mini' | 'full'
  status TEXT  -- started | in_progress | completed | scored
  module_scores JSONB
  composite_score NUMERIC
  readiness_level TEXT
  action_plan JSONB
  started_at TIMESTAMPTZ
  completed_at TIMESTAMPTZ
  scored_at TIMESTAMPTZ

subscription_packages
  id SERIAL PRIMARY KEY
  package_code TEXT UNIQUE
  name TEXT
  description TEXT
  price_inr NUMERIC
  duration_days INTEGER
  features JSONB
  is_active BOOLEAN

student_subscriptions
  id SERIAL PRIMARY KEY
  user_id INTEGER REFERENCES users(id)
  package_code TEXT REFERENCES subscription_packages(package_code)
  status TEXT  -- active | expired | cancelled
  payment_id TEXT
  expires_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
```

### MongoDB collection: `ExamReadyQuestion`

```json
{
  "_id": "ObjectId",
  "module": "stress_management",
  "subdomain": "recovery_patterns",
  "question_type": "scenario_choice | word_recall | attention_click | passage_mcq | likert",
  "question_text": "string",
  "options": [{ "text": "string", "weight": "number", "reverse_scored": "boolean" }],
  "tier": "mini | full",
  "age_band": "13-15 | 15-18 | 18+",
  "cognitive_load": "low | medium | high",
  "metadata": {}
}
```

---

## 11. API Reference

### Assessment lifecycle

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/assessment/start` | Initialise attempt with stratified question sampling |
| `GET` | `/api/v1/assessment/:attemptId` | Fetch attempt state + questions |
| `POST` | `/api/v1/assessment/:attemptId/answer` | Save a single question response |
| `POST` | `/api/v1/assessment/:attemptId/submit` | Finalise assessment |
| `POST` | `/api/v1/assessment/:attemptId/score` | Trigger psychometric scoring engine |

### Payment

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/capadex/payment/create-order` | Create Razorpay order for plan |
| `POST` | `/api/capadex/payment/verify` | Verify signature + activate subscription |
| `POST` | `/api/capadex/payment/webhook` | Razorpay server-to-server webhook |

---

## 12. Frontend Architecture

| File | Role |
|---|---|
| `frontend/src/components/exam-ready/pages/LandingPage.tsx` | Product introduction |
| `frontend/src/components/exam-ready/pages/CheckoutPage.tsx` | Plan selection + payment |
| `frontend/src/components/exam-ready/pages/AssessmentPage.tsx` | Test-taking interface |
| `frontend/src/components/exam-ready/pages/ReportStatusPage.tsx` | Scoring status |
| `frontend/src/components/exam-ready/pages/ReportViewPage.tsx` | Results + action plan |
| `frontend/src/components/exam-ready/QuestionRenderer.tsx` | Question type registry |
| `frontend/src/components/exam-ready/WordRecallRenderer.tsx` | Memory task renderer |
| `frontend/src/components/exam-ready/AttentionClickRenderer.tsx` | Focus task renderer |
| `frontend/src/components/exam-ready/PassageMCQRenderer.tsx` | Reading comp renderer |
| `frontend/src/components/exam-ready/LearningStrategyRenderer.tsx` | Study habit renderer |
| `frontend/src/components/exam-ready/Timer.tsx` | Assessment countdown timer |
| `frontend/src/components/exam-ready/CategorySwitcher.tsx` | Module navigation |
| `frontend/src/components/exam-ready/ExamReadyHeader.tsx` | Product header |
| `frontend/src/components/exam-ready/BotWidget.tsx` | Pragati guidance bot |
| `frontend/src/components/exam-ready/services/apiClient.ts` | API abstraction layer |
| `frontend/server/src/routes/exam-ready.ts` | Backend routes (v1) |
| `backend/exam-ready.v1.routes.ts` | Alternative backend routes |
| `backend/models/examReadyQuestion.ts` | MongoDB question model |

---

*Document generated from live codebase — MetryxOne Exam Ready™ v1.0, May 2026*
