# Learning Intelligence Platform (LIP)

**Single source of truth** for the LIP subsystem.  
Migration: `backend/migrations/20260611_lip.sql` · Routes: `backend/routes/lip.ts` · Engines: `backend/services/lip-*.ts`

---

## 1. Overview

LIP is a fully server-backed, flag-gated intelligence layer that analyses a user's competency profile, detects learning gaps, maps those gaps to curated resources, and assembles a personalised learning path — culminating in a **Learning Readiness Score (LRS)**.

All tables are prefixed `lip_`. All engines are pure functions (never throw) and return neutral fallbacks when data is absent. The platform is additive: flag off → 503; UI shows neutral state.

**Feature flag**

| Flag | Default | Guards |
|------|---------|--------|
| `FF_LEARNING_INTELLIGENCE` | OFF | all `/api/lip/*` routes return 503 when flag is off |

Set in `backend/config/feature-flags.ts`.

---

## 2. Architecture

```
User profile / competency scores / behavioural signals
        │
        ▼
┌───────────────────────────┐
│  Competency Gap Engine     │  ← lip-competency-gap-engine.ts
│  5 scored sources, rules   │     Signals: competency_scores, mei_v2,
│  → severity classification │     self-reported, CAPADEX, assumed
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────┐
│  Learning Need Engine      │  ← lip-learning-need-engine.ts
│  5 signal types, 30 rules  │     Signals A–E: assessment_gap,
│  → need categories         │     behavioural, career_goal,
└──────────┬────────────────┘     self_reported, market_demand
           │
           ▼
┌───────────────────────────┐
│  Resource Mapping Engine   │  ← lip-resource-mapping-engine.ts
│  gap-relevance ranked      │     courses / certs / projects / mentors
│  courses, certs, projects, │     joined via competency_map tables
│  mentors                   │     5-min in-module cache
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────┐
│  Path Builder Engine       │  ← lip-path-builder-engine.ts
│  template-driven or gap-   │     template phases → resource_type_sequence
│  severity phases           │     append-only rebuild semantics
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────┐
│  Readiness Engine (LRS)    │  ← lip-readiness-engine.ts
│  5 dimensions, weighted,   │     configurable weights via admin panel
│  0–100 composite + band    │     upsert daily, append-only history
└───────────────────────────┘
```

---

## 3. Database Schema

Migration file: `backend/migrations/20260611_lip.sql` (1144 lines, idempotent — all `IF NOT EXISTS` + `ON CONFLICT DO NOTHING`).

Schema is lazy-initialised via `ensureLIPSchema(pool)` — existence-check-first (SELECT); full migration runs only when `lip_courses` is absent.

### 3.1 Master (Catalog) Tables

#### `lip_courses`
| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `title` | TEXT | NOT NULL | Course name |
| `provider` | TEXT | NOT NULL | e.g. Coursera, Udemy, NPTEL |
| `type` | TEXT | CHECK enum | `online_course` · `live_cohort` · `workshop` · `nanodegree` · `specialization` |
| `delivery_mode` | TEXT | CHECK enum | `self_paced` · `instructor_led` · `hybrid` |
| `duration_hours` | NUMERIC(6,1) | NOT NULL, default 10 | |
| `difficulty_level` | INTEGER | 1–4 | 1=Beginner · 4=Expert |
| `cost_usd` | NUMERIC(8,2) | nullable | |
| `cost_inr` | NUMERIC(10,2) | nullable | |
| `quality_score` | INTEGER | 0–100 | Editorial quality rating |
| `rating` | NUMERIC(3,1) | 0–5 | User rating |
| `skills_covered` | JSONB | default `[]` | Array of skill strings |
| `competency_codes` | JSONB | default `[]` | Array of competency code strings |
| `region` | TEXT | CHECK IN('IN','GLOBAL') | |
| `url` | TEXT | nullable | Course URL |
| `is_active` | BOOLEAN | default true | Soft delete |
| `created_at` / `updated_at` | TIMESTAMPTZ | | |

**Seed**: 80 rows (Coursera, Udemy, LinkedIn, edX, NPTEL, Pluralsight)  
**Indexes**: `type WHERE is_active`, `region WHERE is_active`, `difficulty_level WHERE is_active`

---

#### `lip_certifications`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `title` | TEXT | Cert name |
| `issuing_body` | TEXT | e.g. AWS, PMI, ICAI |
| `type` | TEXT | `technical` · `professional` · `domain` · `compliance` · `leadership` |
| `validity_years` | INTEGER | null = lifetime |
| `prep_hours_estimate` | NUMERIC(6,1) | Preparation effort |
| `cost_usd` / `cost_inr` | NUMERIC | |
| `difficulty_level` | INTEGER 1–4 | |
| `prestige_score` | INTEGER 0–100 | Industry recognition weight |
| `skills_validated` | JSONB | |
| `competency_codes` | JSONB | |
| `industry_codes` | JSONB | e.g. `["finance","technology"]` |
| `is_active` | BOOLEAN | |

**Seed**: 40 rows (AWS, Google, Microsoft, PMI, CFA, SHRM, SEBI, CompTIA, etc.)

---

#### `lip_projects`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `title` | TEXT | |
| `type` | TEXT | `capstone` · `portfolio` · `open_source` · `case_study` · `simulation` · `freelance` |
| `duration_hours` | NUMERIC(6,1) | |
| `difficulty_level` | INTEGER 1–4 | |
| `skills_practiced` | JSONB | |
| `competency_codes` | JSONB | |
| `deliverable` | TEXT | `code_repo` · `document` · `presentation` · `deployed_app` · `dataset` |
| `solo_or_team` | TEXT | `solo` · `team` · `either` |
| `description` | TEXT | |
| `is_active` | BOOLEAN | |

**Seed**: 30 rows (ML pipelines, React dashboards, CI/CD setups, case studies, etc.)

---

#### `lip_mentors`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `user_id` | VARCHAR | FK → `users.id` (nullable — platform or external) |
| `name` | TEXT | |
| `title` | TEXT | Role title |
| `company` | TEXT | nullable |
| `function_codes` | JSONB | Functional domains e.g. `["engineering","data"]` |
| `competency_expertise` | JSONB | Competency codes they specialise in |
| `seniority_level` | INTEGER 1–7 | 1=Intern · 7=C-Suite |
| `mentoring_style` | TEXT | `coaching` · `teaching` · `sponsoring` · `advising` · `peer` |
| `availability_hrs_month` | NUMERIC(5,1) | |
| `cost_model` | TEXT | `free` · `paid` · `company_sponsored` |
| `cost_per_hour_inr` | NUMERIC(8,2) | |
| `rating` | NUMERIC(3,1) | |
| `is_verified` | BOOLEAN | Admin-toggled verification badge |
| `is_active` | BOOLEAN | |

**Seed**: 15 rows covering engineering, data science, product, finance, HR, marketing domains

---

### 3.2 Competency Mapping Tables

These join master resources to competency codes so the resource mapping engine can do relevance-ranked retrieval.

#### `lip_course_competency_map`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `course_id` | UUID FK → `lip_courses` CASCADE | |
| `competency_code` | TEXT | e.g. `data_analysis`, `leadership` |
| `coverage_score` | INTEGER 0–100 | How well this course covers the competency |
| `is_primary` | BOOLEAN | Whether this is the primary competency for the course |

**UNIQUE** (`course_id`, `competency_code`)  
**Seed**: 200+ rows

---

#### `lip_cert_competency_map`
Same shape as course map, FK → `lip_certifications`.  
**UNIQUE** (`cert_id`, `competency_code`) · Seed: 100+ rows

---

#### `lip_project_competency_map`
Same shape, FK → `lip_projects`.  
**UNIQUE** (`project_id`, `competency_code`) · Seed: 80+ rows

---

#### `lip_mentor_competency_map`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `mentor_id` | UUID FK → `lip_mentors` CASCADE | |
| `competency_code` | TEXT | |
| `expertise_score` | INTEGER 0–100 | Mentor's depth on this competency |

**UNIQUE** (`mentor_id`, `competency_code`)

---

### 3.3 Rules Tables

#### `lip_competency_gap_rules`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `competency_code` | TEXT UNIQUE | e.g. `data_science`, `leadership` |
| `from_score_pct` | INTEGER | Lower threshold (current score must be below this) |
| `to_score_pct` | INTEGER | Target score |
| `gap_severity` | TEXT | `critical` · `major` · `moderate` · `minor` |
| `learning_priority` | INTEGER 1–5 | 1=highest priority |
| `recommended_resource_types` | JSONB | e.g. `["course","certification","project"]` |
| `min_hours_to_close` | INTEGER | Minimum learning hours to close this gap |

**Seed**: 50 rows covering technical, soft, domain, leadership, data, cloud, security competencies.

**Gap severity classification** (engine applies this heuristic):

| Gap magnitude | Severity |
|--------------|----------|
| ≥ 40 points | critical |
| ≥ 25 points | major |
| ≥ 15 points | moderate |
| < 15 points | minor |

---

#### `lip_learning_need_rules`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `signal_type` | TEXT | `assessment_gap` · `behavioural_signal` · `career_goal` · `market_demand` · `self_reported` |
| `signal_key` | TEXT | e.g. `competency_score`, `motivation`, `target_role_set` |
| `threshold_operator` | TEXT | `lt` · `gt` · `eq` · `between` |
| `threshold_value` | NUMERIC(10,4) | Primary threshold |
| `threshold_value2` | NUMERIC(10,4) | Upper bound for `between` |
| `need_category` | TEXT | `technical_upskill` · `soft_skill` · `leadership` · `domain_knowledge` · `certification` · `applied_practice` |
| `urgency` | TEXT | `immediate` · `near_term` · `aspirational` |
| `weight` | NUMERIC(4,3) | 0–1, contributes to priority score |
| `description` | TEXT | Human-readable description |

**Seed**: 30 rules across 5 signal types.

---

### 3.4 Path Templates

#### `lip_path_templates`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `code` | TEXT UNIQUE | e.g. `DATA_SCIENTIST`, `GENERAL_LEADERSHIP` |
| `name` | TEXT | Display name |
| `target_role_id` | TEXT | Optional role key linkage |
| `estimated_total_hours` | INTEGER | |
| `estimated_weeks` | INTEGER | |
| `phase_count` | INTEGER | Number of phases |
| `phases` | JSONB | Array of phase objects (see structure below) |
| `is_active` | BOOLEAN | |

**Phase object structure:**
```json
{
  "phase_num": 1,
  "name": "Python & Statistics Foundations",
  "focus": "core_skills",
  "resource_type_sequence": ["course", "project"]
}
```

**Focus values**: `core_skills` · `technical_depth` · `specialization` · `advanced` · `portfolio` · `certification` · `execution` · `career_launch`

**Seed**: 15 templates — DATA_SCIENTIST, SOFTWARE_ENGINEER, PRODUCT_MANAGER, CLOUD_ARCHITECT, FINANCE_ANALYST, HR_MANAGER, DIGITAL_MARKETER, DEVOPS_ENGINEER, BUSINESS_ANALYST, CYBERSECURITY_ANALYST, ML_ENGINEER, GENERAL_TECHNICAL, GENERAL_LEADERSHIP, GENERAL_ANALYTICS, CAREER_SWITCH

---

### 3.5 LRS Config

#### `lip_readiness_weights` (single-row config table)
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | SERIAL PK | | |
| `motivation_weight` | NUMERIC(4,3) | 0.30 | Weight for motivation dimension |
| `cognitive_weight` | NUMERIC(4,3) | 0.25 | Weight for cognitive readiness |
| `time_weight` | NUMERIC(4,3) | 0.20 | Weight for time availability |
| `support_weight` | NUMERIC(4,3) | 0.15 | Weight for support network |
| `prior_weight` | NUMERIC(4,3) | 0.10 | Weight for prior learning |
| `updated_at` | TIMESTAMPTZ | | |

**Invariant**: all five weights must sum to 1.00 (enforced by `PATCH /api/admin/lip/readiness-weights`).

---

### 3.6 Per-User Tables

#### `lip_competency_gaps`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `user_id` | VARCHAR FK → `users` CASCADE | |
| `competency_code` | TEXT | |
| `competency_label` | TEXT | Display label |
| `current_score` | NUMERIC(5,2) | Current assessed score 0–100 |
| `target_score` | NUMERIC(5,2) | Desired score from gap rules |
| `gap_magnitude` | NUMERIC(5,2) | target − current |
| `gap_severity` | TEXT | `critical` · `major` · `moderate` · `minor` |
| `learning_priority` | INTEGER 1–5 | From gap rules |
| `source` | TEXT | `competency_scores` · `mei_v2` · `capadex` · `self_reported` · `assumed` |
| `confidence` | NUMERIC(4,3) | 0–1 |
| `computed_at` | TIMESTAMPTZ | |

**UNIQUE** (`user_id`, `competency_code`) — UPSERT on every recompute.

---

#### `lip_learning_needs`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `user_id` | VARCHAR FK → `users` CASCADE | |
| `need_category` | TEXT | |
| `urgency` | TEXT | `immediate` · `near_term` · `aspirational` |
| `priority_score` | NUMERIC(6,3) | Weighted sum of triggered rules |
| `signal_count` | INTEGER | Number of signals that fired |
| `signal_sources` | JSONB | Array of signal_key strings that triggered this |
| `description` | TEXT | Auto-generated narrative |
| `computed_at` | TIMESTAMPTZ | |

**UNIQUE** (`user_id`, `need_category`)

---

#### `lip_user_courses` / `lip_user_certifications` / `lip_user_projects`
All three share this pattern:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `user_id` | VARCHAR FK | |
| `{resource}_id` | UUID FK | |
| `relevance_score` | NUMERIC(5,2) | Engine-computed match score |
| `is_saved` | BOOLEAN | User bookmarked |
| `status` | TEXT | `recommended` · `saved` · `in_progress` · `completed` · `dismissed` |
| `started_at` | TIMESTAMPTZ | nullable |
| `completed_at` | TIMESTAMPTZ | nullable |
| `computed_at` | TIMESTAMPTZ | |

**UNIQUE** (`user_id`, `{resource}_id`)

---

#### `lip_user_mentors`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `user_id` | VARCHAR FK | |
| `mentor_id` | UUID FK | |
| `match_score` | NUMERIC(5,2) | Competency + need overlap score |
| `status` | TEXT | `recommended` · `contacted` · `active` · `completed` · `dismissed` |
| `computed_at` | TIMESTAMPTZ | |

**UNIQUE** (`user_id`, `mentor_id`)

---

#### `lip_learning_paths`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `user_id` | VARCHAR FK | |
| `name` | TEXT | e.g. "My Learning Path" |
| `target_role_id` | TEXT | Optional role key |
| `template_id` | INTEGER FK → `lip_path_templates` | nullable — NULL = gap-driven assembly |
| `status` | TEXT | `draft` · `active` · `completed` · `paused` |
| `total_hours_estimated` | NUMERIC(8,1) | |
| `total_hours_completed` | NUMERIC(8,1) | |
| `progress_pct` | NUMERIC(5,2) | 0–100 |
| `phases` | JSONB | Phase metadata snapshot |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

---

#### `lip_learning_path_items`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Used for status update endpoint |
| `path_id` | UUID FK → `lip_learning_paths` CASCADE | |
| `item_type` | TEXT | `course` · `certification` · `project` · `mentoring` |
| `item_id` | TEXT | UUID of the resource |
| `item_title` | TEXT | Denormalised title |
| `item_provider` | TEXT | Denormalised provider |
| `hours` | NUMERIC(6,1) | |
| `cost_inr` | NUMERIC(10,2) | |
| `phase_num` | INTEGER | Phase 1–N |
| `order_in_phase` | INTEGER | Step within phase |
| `is_required` | BOOLEAN | |
| `status` | TEXT | `pending` · `in_progress` · `completed` · `skipped` |
| `completed_at` | TIMESTAMPTZ | nullable |

---

#### `lip_readiness_scores` (latest snapshot, one row per user)
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `user_id` | VARCHAR FK UNIQUE | |
| `motivation_score` | NUMERIC(5,2) | 0–100 |
| `cognitive_readiness_score` | NUMERIC(5,2) | 0–100 |
| `time_availability_score` | NUMERIC(5,2) | 0–100 |
| `support_network_score` | NUMERIC(5,2) | 0–100 |
| `prior_learning_score` | NUMERIC(5,2) | 0–100 |
| `composite_readiness` | NUMERIC(5,2) | Weighted sum 0–100 |
| `readiness_band` | TEXT | `low` · `moderate` · `good` · `high` |
| `blockers` | JSONB | Array of blocker description strings |
| `confidence` | NUMERIC(4,3) | 0–1; `high` when ≥3 signals resolved |
| `computed_at` | TIMESTAMPTZ | |

**UNIQUE** `user_id` — UPSERT daily.

---

#### `lip_readiness_history` (append-only, never mutated)
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | |
| `user_id` | VARCHAR FK | |
| `composite_readiness` | NUMERIC(5,2) | |
| `readiness_band` | TEXT | |
| `snapshot` | JSONB | Full dimension scores at time of recording |
| `recorded_at` | TIMESTAMPTZ | |

---

## 4. Entity Relationships

```
lip_courses ─────────────────────────── lip_course_competency_map
lip_certifications ──────────────────── lip_cert_competency_map
lip_projects ────────────────────────── lip_project_competency_map
lip_mentors ─────────────────────────── lip_mentor_competency_map
                                                │
                                    competency_code (text key)
                                                │
                                    lip_competency_gap_rules ──► lip_competency_gaps (per user)
                                    lip_learning_need_rules  ──► lip_learning_needs  (per user)

users ──► lip_competency_gaps
      ──► lip_learning_needs
      ──► lip_user_courses
      ──► lip_user_certifications
      ──► lip_user_projects
      ──► lip_user_mentors
      ──► lip_learning_paths ──► lip_learning_path_items
      ──► lip_readiness_scores
      ──► lip_readiness_history

lip_learning_paths.template_id ──► lip_path_templates
lip_mentors.user_id ──► users (nullable)
```

**Competency code** (`TEXT`) is the shared join key across all `lip_*_competency_map` tables and `lip_competency_gap_rules`. It is not a FK to any table — it's a semantic key from the competency ontology (codes like `data_analysis`, `leadership`, `systems_design`).

---

## 5. Business Rules

### 5.1 Competency Gap Engine Rules
1. **Score source priority**: `competency_scores` → `mei_competency_scores` → `career_seeker_profiles.data.competencies` → `capadex_session_reports` → **assumed 50** (always has a value, disclosed via `source='assumed'`).
2. **Gap detection**: gap exists when `current_score < rule.from_score_pct` for that competency code.
3. **Severity classification**: `critical` (magnitude ≥40) · `major` (≥25) · `moderate` (≥15) · `minor` (<15).
4. **UPSERT semantics**: every recompute upserts `lip_competency_gaps` — never inserts duplicates.
5. **Stale detection**: gaps older than 24 hours, or on first call, trigger recompute.
6. **Refresh**: `?refresh=1` forces recompute regardless of staleness.
7. **Coverage %**: `(rules_count − gap_count) / rules_count × 100` — measures how many competencies are at target.

### 5.2 Learning Need Engine Rules
1. **5 signal types fire independently** — all firing rules contribute to the need's `priority_score`.
2. **Priority score** = `Σ (rule.weight × signal_match_factor)` across all triggered rules for that need category.
3. **Urgency**: if any rule firing for a category has `urgency='immediate'`, the category is immediate; else if any `near_term`, it's near_term; else aspirational.
4. **Market demand signals** are read from `cg_occupation_profiles` for the user's target role; silently absent when that table is missing (cold start).
5. **UPSERT** by `(user_id, need_category)`.
6. **Never fabricates** — only triggers when a signal value actually meets the threshold.

### 5.3 Resource Mapping Engine Rules
1. **Relevance score** = `(competency_overlap_score × 0.6) + (quality_score × 0.25) + (level_match_bonus × 0.15)`.
2. **Competency overlap**: sum of `coverage_score` values for competencies in user's gap list ÷ normalised.
3. **Level match bonus**: resource `difficulty_level` within 1 of user's estimated proficiency level → +15 points.
4. **Minimum relevance threshold**: resources with score < 30 are filtered out.
5. **Mentor matching** uses need categories instead of competency gap codes — matched against `function_codes` and `competency_expertise`.
6. **Catalog cache**: 5 minutes in-module, busted by admin edits.
7. **Saved resources**: user's prior saves are returned with `is_saved=true` to preserve bookmarks.

### 5.4 Path Builder Engine Rules
1. **Template resolution**: find a `lip_path_templates` row matching user's `target_role_id` first; if not found, match by gap pattern (most critical gaps → template code); if still not found, use `GENERAL_TECHNICAL` fallback.
2. **Phase assembly**: for each phase, `resource_type_sequence` defines what resource type to pick in that slot. Resources are selected by highest relevance score for the required competencies.
3. **Gap-severity fallback** (when no template fits): 5 phases: Phase 1 → critical gaps (courses), Phase 2 → major gaps (courses+certs), Phase 3 → moderate gaps (projects), Phase 4 → soft skill mentor sessions, Phase 5 → portfolio projects.
4. **Rebuild semantics**: prior active path set to `status='paused'`; prior path items set to `status='skipped'` BEFORE new path inserted — **append-only, never delete**.
5. **24-hour cache**: existing active path returned if `updated_at > NOW() - INTERVAL '24 hours'`.
6. **Force rebuild**: `POST /api/lip/path` with `{ forceRebuild: true }` bypasses the cache.
7. **Items carry SERIAL `id`** — frontend uses this for status update POSTs.

### 5.5 Learning Readiness Score Rules
1. **Formula**: `LRS = (motivation × 0.30) + (cognitive × 0.25) + (time × 0.20) + (support × 0.15) + (prior × 0.10)` (default weights — configurable via admin panel without code deploy).
2. **Band thresholds**:

   | Score | Band |
   |-------|------|
   | 80–100 | high |
   | 60–79 | good |
   | 40–59 | moderate |
   | 0–39 | low |

3. **Signal sources**:
   - `motivation`: `wcl0_user_intelligence.motivation_score` (0–100)
   - `cognitive`: median of top-10 `competency_scores` (0–100)
   - `time`: login days in last 30 days × (100 / 20) — capped at 100
   - `support`: mentor session count × 25 + peer connection count × 5 — capped at 100
   - `prior_learning`: `(completed_courses × 20 + completed_certs × 40)` — capped at 100
4. **Confidence**: `high` when ≥3 signals have real data; `medium` when 2; `low` when ≤1.
5. **Blockers**: auto-generated array; e.g. `"Low engagement — motivation signal below 40"`, `"No mentor sessions recorded"`.
6. **Upsert daily** to `lip_readiness_scores`; append to `lip_readiness_history` on every compute (never mutated).
7. **Weights validation**: `PATCH /api/admin/lip/readiness-weights` rejects if `|sum − 1.0| > 0.01`.

---

## 6. API Specification

All user routes require `Authorization: Bearer {token}` (`requireAuth`).  
All admin routes additionally require super-admin session (`requireSuperAdmin`).  
Responses: `{ success: true, data: … }` on success; `{ success: false, error?: string, data: fallback }` on failure.  
Cache TTL: 60 seconds per user; bust with `?refresh=1`.

### 6.1 User APIs (`/api/lip/*`)

---

#### `GET /api/lip/competency-gaps`

Returns the user's competency gap profile. Triggers recompute if stale (> 24 h) or on first call.

**Query params**
| Param | Type | Description |
|-------|------|-------------|
| `refresh` | `'1'` | Force recompute |
| `targetRoleId` | string | Override target role for gap computation |

**Response** `data`:
```ts
{
  gaps: Array<{
    competency_code: string;
    competency_label: string;
    current_score: number;
    target_score: number;
    gap_magnitude: number;
    gap_severity: 'critical' | 'major' | 'moderate' | 'minor';
    learning_priority: number;     // 1–5
    source: string;
    confidence: number;            // 0–1
    computed_at: string;
  }>;
  overall_coverage_pct: number;    // % of competencies at target
  critical_count: number;
  major_count: number;
  confidence: number;
  computed_at: string;
}
```

**Fallback** (never throws): `{ gaps: [], overall_coverage_pct: 0, critical_count: 0, major_count: 0, confidence: 0.3 }`

---

#### `GET /api/lip/competency-gaps/:code`

Single gap detail with suggested courses.

**Response** `data`: gap row + `suggested_courses: string[]`

---

#### `GET /api/lip/learning-needs`

Returns classified learning needs. Triggers recompute if no stored needs.

**Query params**: `refresh=1`

**Response** `data`:
```ts
{
  needs: Array<{
    need_category: 'technical_upskill' | 'soft_skill' | 'leadership' | 'domain_knowledge' | 'certification' | 'applied_practice';
    urgency: 'immediate' | 'near_term' | 'aspirational';
    priority_score: number;
    signal_count: number;
    signal_sources: string[];   // signal_key values that fired
    description: string;
    computed_at: string;
  }>;
  immediate_count: number;
  categories_triggered: string[];
  computed_at: string;
}
```

---

#### `GET /api/lip/courses`

Gap-relevance-ranked recommended courses for the user.

**Query params**
| Param | Type | Description |
|-------|------|-------------|
| `region` | `'IN'` \| `'GLOBAL'` | Filter by region |
| `type` | string | Filter by course type |
| `maxCost` | number | Filter by max cost in INR |

**Response** `data`: `LIPCourse[]` sorted by `relevance_score DESC`

Each item extends `lip_courses` with `relevance_score: number` and `is_saved: boolean`.

---

#### `GET /api/lip/certifications`

Gap-ranked certifications.

**Query params**: `type`, `maxCost`, `industry`

**Response** `data`: `LIPCert[]` sorted by `relevance_score DESC`

---

#### `GET /api/lip/projects`

Gap-ranked hands-on projects.

**Query params**: `difficulty` (1–4)

**Response** `data`: `LIPProject[]` sorted by `relevance_score DESC`

---

#### `GET /api/lip/mentors`

Need-ranked mentors. Matching uses learning need categories, not competency gaps.

**Query params**: `function` (function code filter), `style` (mentoring style filter)

**Response** `data`: `LIPMentor[]` with `match_score`

---

#### `GET /api/lip/path`

Returns the user's active learning path. Builds on first call using path builder engine.

**Response** `data`:
```ts
{
  id: string;
  name: string;
  status: 'draft' | 'active' | 'completed' | 'paused';
  total_hours_estimated: number;
  total_hours_completed: number;
  progress_pct: number;
  template_code: string | null;
  phases: Array<{
    phase_num: number;
    name: string;
    focus: string;
    items: LIPPathItem[];
  }>;
  built_from: 'template' | 'gaps';
  confidence: number;
  generated_at: string;
}
```

Each `LIPPathItem`:
```ts
{
  id: number;           // SERIAL — use for status update POST
  item_type: 'course' | 'certification' | 'project' | 'mentoring';
  item_id: string;
  item_title: string;
  item_provider: string;
  hours: number;
  cost_inr: number;
  phase_num: number;
  order_in_phase: number;
  is_required: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completed_at: string | null;
}
```

---

#### `POST /api/lip/path`

Force-rebuild the learning path.

**Body** (all optional):
```ts
{ targetRoleId?: string; maxHours?: number; forceRebuild?: boolean }
```

**Response** `data`: same as `GET /api/lip/path`

---

#### `POST /api/lip/path/items/:itemId/status`

Update a path item's completion status.

**Body**: `{ status: 'pending' | 'in_progress' | 'completed' | 'skipped' }`

**Response**: `{ success: true }`

---

#### `POST /api/lip/courses/:courseId/save`

Toggle course bookmark. Creates or updates `lip_user_courses` row.

**Response**: `{ success: true, saved: boolean }`

---

#### `POST /api/lip/certifications/:certId/save`

Toggle certification bookmark.

**Response**: `{ success: true, saved: boolean }`

---

#### `GET /api/lip/readiness`

Returns the user's Learning Readiness Score (LRS).

**Query params**: `refresh=1`

**Response** `data`:
```ts
{
  composite: number;                    // 0–100 LRS
  band: 'low' | 'moderate' | 'good' | 'high';
  signals: {
    motivation: number;
    cognitive_readiness: number;
    time_availability: number;
    support_network: number;
    prior_learning: number;
  };
  blockers: string[];
  confidence: number;                   // 0–1
  computed_at: string;
}
```

---

#### `GET /api/lip/report`

Full personalised LIP report — combines all engines in one call.

**Response** `data`:
```ts
{
  readiness_summary: {
    composite: number; band: string; signals: object; blockers: string[];
  };
  competency_gap_profile: {
    critical_gaps: number; major_gaps: number;
    overall_coverage_pct: number;
    gaps: LIPGap[];   // top 20
  };
  learning_needs_analysis: {
    immediate_count: number;
    categories_triggered: string[];
    top_needs: LIPNeed[];   // top 5
  };
  recommended_learning_path: LIPPath | null;
  resource_highlights: {
    top_courses: LIPCourse[];    // top 3
    top_certs: LIPCert[];        // top 2
    top_projects: LIPProject[];  // top 2
    top_mentors: LIPMentor[];    // top 2
  };
  generated_at: string;
}
```

---

### 6.2 Admin APIs (`/api/admin/lip/*`)

---

#### `GET /api/admin/lip/stats`

Platform-wide analytics. k-anonymity: readiness band distributions with < 10 users suppressed.

**Query params**: `refresh=1`

**Response** `data`:
```ts
{
  users_with_paths: number;
  avg_readiness_score: number;
  gap_severity_distribution: Array<{ gap_severity: string; cnt: string }>;
  readiness_band_distribution: Array<{ readiness_band: string; cnt: string }>;  // k≥10 only
  top_10_recommended_courses: Array<{ title: string; provider: string; cnt: string }>;
}
```

---

#### `GET /api/admin/lip/readiness-weights`

Returns current LRS dimension weights.

**Response** `data`: `{ motivation_weight, cognitive_weight, time_weight, support_weight, prior_weight, updated_at }`

---

#### `PATCH /api/admin/lip/readiness-weights`

Update LRS weights. Rejects if weights do not sum to 1.0 ± 0.01.

**Body**: `{ motivation_weight, cognitive_weight, time_weight, support_weight, prior_weight }`

**Response**: `{ success: true }`

---

#### `GET /api/admin/lip/courses`

Paginated course list with search.

**Query params**: `page`, `limit` (max 100), `search`, `type`, `region`, `difficulty`, `refresh`

**Response** `data`:
```ts
{ courses: LIPCourse[]; total: number; page: number; limit: number }
```

---

#### `POST /api/admin/lip/courses`

Create a new course.

**Body**: all `lip_courses` fields except `id`, `created_at`, `updated_at`.

**Response**: `{ success: true, id: string }`

---

#### `PATCH /api/admin/lip/courses/:id`

Update course fields (any subset).

**Response**: `{ success: true }`

---

#### `DELETE /api/admin/lip/courses/:id`

Soft-delete (sets `is_active=false`).

**Response**: `{ success: true }`

---

#### `GET /api/admin/lip/certifications` · `POST` · `PATCH /:id` · `DELETE /:id`

Same pattern as courses. PATCH can update `prestige_score` and other fields.

---

#### `GET /api/admin/lip/projects` · `POST` · `PATCH /:id` · `DELETE /:id`

Same pattern. DELETE is hard-delete for projects (no soft-delete flag).

---

#### `GET /api/admin/lip/mentors`

**Query params**: `function`, `style`, `verified`

**Response** `data`: `LIPMentor[]`

---

#### `POST /api/admin/lip/mentors`

Create a mentor.

**Body**: `{ name, title, company?, function_codes, competency_expertise, seniority_level, mentoring_style, availability_hrs_month, cost_model, cost_per_hour_inr, rating }`

---

#### `PATCH /api/admin/lip/mentors/:id`

Update any allowed field. `is_verified` can be toggled here.

---

#### `GET /api/admin/lip/path-templates`

Returns all active path templates. Cached 60 s.

**Response** `data`: `LIPPathTemplate[]`

---

#### `POST /api/admin/lip/path-templates`

Create a new path template.

**Body**: `{ code, name, target_role_id?, estimated_total_hours, estimated_weeks, phase_count, phases }`

---

#### `PATCH /api/admin/lip/path-templates/:id`

Update template name, hours, weeks, phases.

---

## 7. Engines (Deep Reference)

### 7.1 `lip-competency-gap-engine.ts`

**Entry point**: `computeCompetencyGaps(userId, targetRoleId|null, pool) → LIPGapResult`

**Algorithm**:
1. Read `lip_competency_gap_rules` (all 50 rows, cached in-module).
2. For each rule, look up user's score from source cascade (see rule 1 in §5.1).
3. If `user_score < rule.from_score_pct`, compute `gap_magnitude = rule.to_score_pct - user_score`.
4. Classify severity by magnitude (§5.1 rule 3).
5. UPSERT all gaps to `lip_competency_gaps`.
6. Return sorted by `learning_priority ASC, gap_magnitude DESC`.

**Exported**: `LIPGap`, `LIPGapResult`, `computeCompetencyGaps`, `ensureLIPSchema`

---

### 7.2 `lip-learning-need-engine.ts`

**Entry point**: `analyzeLearningNeeds(userId, pool) → LIPNeedResult`

**Algorithm**:
1. Load `lip_learning_need_rules` (30 rows, cached).
2. For each `signal_type`, read the relevant signal value.
3. Evaluate each rule's threshold against the signal value.
4. Group fired rules by `need_category` — sum weighted priorities.
5. Determine urgency per category (most urgent rule wins).
6. Generate description string per category.
7. UPSERT to `lip_learning_needs`.

**Exported**: `LIPNeed`, `LIPNeedResult`, `analyzeLearningNeeds`

---

### 7.3 `lip-resource-mapping-engine.ts`

**Entry points**: `mapCourses`, `mapCertifications`, `mapProjects`, `mapMentors`

Each function:
1. Loads the catalog (cached 5 min).
2. Joins via the appropriate `*_competency_map` table.
3. Scores by relevance formula (§5.3 rule 1).
4. Applies query filters (region, type, cost, difficulty, function).
5. Returns sorted descending by `relevance_score`.

**Cache bust**: `invalidateCatalogCache()` exported and called by admin CRUD routes.

---

### 7.4 `lip-path-builder-engine.ts`

**Entry point**: `buildLearningPath(userId, opts, pool) → LIPPathResult`

`PathBuilderOpts`: `{ targetRoleId?, maxHours?, preferFree?, forceRebuild? }`

**Algorithm**:
1. Check existing active path — return if < 24 h old and `!opts.forceRebuild`.
2. Resolve template (see §5.4 rules 1–2).
3. If template found → `assembleFromTemplate()`.
4. If no template → `assembleFromGaps()`.
5. Mark old path items `skipped`, old path `paused`.
6. INSERT new path + items (RETURNING ids for status updates).
7. Build response with phase-grouped items.

**Rebuild semantics**: strictly append-only — items are never deleted.

---

### 7.5 `lip-readiness-engine.ts`

**Entry point**: `computeReadiness(userId, pool) → LIPReadinessResult`

**Algorithm**:
1. Load weights from `lip_readiness_weights`.
2. Collect 5 raw dimension signals.
3. Compute `composite = Σ (signal_i × weight_i)`.
4. Map to band.
5. Generate blockers list for any dimension scoring < 40.
6. UPSERT to `lip_readiness_scores`; INSERT into `lip_readiness_history`.
7. Set `confidence` based on resolved signal count.

---

## 8. Frontend Surfaces

### 8.1 User-Facing: Career Builder → Learning Intel Tab

**Component**: `frontend/src/components/career/LearningIntelligenceTab.tsx`  
**Tab ID in CareerBuilderPage**: `'learning-intel'`  
**Zone**: `'intelligence'`

Six sub-tabs:

| Sub-tab | ID | API | Description |
|---------|-----|-----|-------------|
| Gap Map | `gap-map` | `GET /api/lip/competency-gaps` | Competency gaps by severity with priority bars |
| My Path | `my-path` | `GET /api/lip/path`, `POST /api/lip/path/items/:id/status` | Phase timeline with status toggles |
| Resources | `resources` | `/api/lip/courses`, `/api/lip/certifications`, `/api/lip/projects`, `/api/lip/mentors` | Filterable resource grid |
| Needs | `needs` | `GET /api/lip/learning-needs` | Learning needs grouped by urgency band |
| Report | `report` | `GET /api/lip/report` | Consolidated LIP report card |
| Readiness | `readiness` | `GET /api/lip/readiness` | LRS gauge with 5-dimension breakdown |

---

### 8.2 Admin: Super Admin → LIP Admin Panel

**Component**: `frontend/src/components/superadmin/LIPDesignPanel.tsx`  
**Nav ID**: `lip-admin`  

Seven sub-tabs:

| Sub-tab | ID | API | Description |
|---------|-----|-----|-------------|
| Courses | `courses` | `GET/POST/PATCH/DELETE /api/admin/lip/courses` | Paginated course catalog management |
| Certifications | `certifications` | `/api/admin/lip/certifications` | Cert catalog management |
| Projects | `projects` | `/api/admin/lip/projects` | Project catalog management |
| Mentors | `mentors` | `/api/admin/lip/mentors` | Mentor management with verified toggle |
| Path Templates | `path-templates` | `GET /api/admin/lip/path-templates` | Read-only view of 15 archetype templates with phase drill-down |
| LRS Weights | `readiness-weights` | `GET/PATCH /api/admin/lip/readiness-weights` | 5-slider weight configuration (must sum to 1.00) |
| Analytics | `analytics` | `GET /api/admin/lip/stats` | Gap distribution, band distribution (k≥10), top-10 courses |

---

## 9. Reports

### 9.1 User LIP Report (`GET /api/lip/report`)

A composite snapshot combining all 5 engines. Designed for the "Report" sub-tab and any future PDF export.

**Structure**:
```
┌────────────────────────────────────────────────────────────────┐
│  LEARNING READINESS SCORE             COMPETENCY COVERAGE       │
│  [LRS gauge: composite / band]        [% at target + gap counts]│
├────────────────────────────────────────────────────────────────┤
│  TOP LEARNING NEEDS (urgency-ranked, max 5)                     │
│  1. Technical Upskill — Immediate   2. Leadership — Near-Term   │
├────────────────────────────────────────────────────────────────┤
│  ACTIVE LEARNING PATH                                           │
│  Name · Total hours · Weeks · Progress bar                      │
├────────────────────────────────────────────────────────────────┤
│  RESOURCE HIGHLIGHTS                                            │
│  Top 3 courses · Top 2 certs · Top 2 mentors                   │
└────────────────────────────────────────────────────────────────┘
```

**Language policy**: all labels are developmental signals ("recommended for growth") — never "this person IS NOT qualified" or hiring-decision language.

---

### 9.2 Admin Analytics Dashboard (`GET /api/admin/lip/stats`)

| Metric | Description |
|--------|-------------|
| Users with paths | Count of distinct users who have built a path |
| Avg LRS | Mean composite readiness across all users |
| Gap severity distribution | Bar chart: critical / major / moderate / minor gap counts |
| Readiness band distribution | Bar chart: low / moderate / good / high (k≥10 suppressed) |
| Top-10 recommended courses | By recommendation frequency, not completion |

---

## 10. Constraints

| Rule | Detail |
|------|--------|
| **Additive / flag-gated** | `FF_LEARNING_INTELLIGENCE` default OFF → 503; UI shows neutral state |
| **Never-throws** | Every engine wraps in try/catch; absent data → neutral fallback, never fabricated |
| **k-anonymity** | Band distributions in admin stats suppressed below `k_min=10` |
| **Append-only history** | `lip_readiness_history` and path rebuild (skipped items) never mutated |
| **Express route order** | Literal sub-paths (`/stats`, `/readiness-weights`, `/path/items/:itemId/status`) registered before `/:id` catch-alls |
| **Language policy** | Outputs are developmental signals only — not hiring/promotion/suitability predictions |
| **Confidence disclosure** | Every response with aggregated scores includes `confidence` field; never claimed as "high" without ≥3 real signals |
| **Weight sum invariant** | `PATCH /api/admin/lip/readiness-weights` rejects if `|sum − 1.0| > 0.01` |
| **Competency code namespace** | Text keys shared with competency ontology; never fabricated from thin air |
| **Catalog cache bust** | Admin CRUD on courses/certs/projects/mentors calls `invalidateCatalogCache()` + `bustCache()` |

---

## 11. Seed Data Summary

| Table | Seed rows |
|-------|-----------|
| `lip_courses` | 80 (Coursera, Udemy, LinkedIn, edX, NPTEL, Pluralsight) |
| `lip_certifications` | 40 (AWS, Google, Microsoft, PMI, CFA, SHRM, SEBI, CompTIA…) |
| `lip_projects` | 30 (ML pipelines, React apps, CI/CD, case studies, simulations) |
| `lip_mentors` | 15 (engineering, data, product, finance, HR, marketing) |
| `lip_course_competency_map` | 200+ |
| `lip_cert_competency_map` | 100+ |
| `lip_project_competency_map` | 80+ |
| `lip_mentor_competency_map` | 60+ |
| `lip_competency_gap_rules` | 50 |
| `lip_learning_need_rules` | 30 |
| `lip_path_templates` | 15 archetype templates |
| `lip_readiness_weights` | 1 (default weights) |

---

## 12. Extension Points

- **Add a new course/cert/project**: use admin panel or `POST /api/admin/lip/*`; map competencies via the competency_map tables; cache auto-busts.
- **Add a new gap rule**: insert into `lip_competency_gap_rules` with `competency_code + thresholds + severity`; users with that competency below the threshold will be gapped on next compute.
- **Add a new path template**: insert into `lip_path_templates` with `code + phases[]`; path builder will pick it up on next rebuild.
- **Tune LRS weights**: use `PATCH /api/admin/lip/readiness-weights`; no code deploy needed.
- **Add a new need signal type**: add a row to `lip_learning_need_rules` + extend the need engine's signal reader for the new `signal_type`.
