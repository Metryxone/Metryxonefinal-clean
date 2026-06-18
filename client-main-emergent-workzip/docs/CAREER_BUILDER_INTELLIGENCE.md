# Career Builder Intelligence — Full Design Specification

**Status:** Production (FF_CAREER_GRAPH=1 to enable)
**Last updated:** June 2026
**Engines:** 5 pure-function services + 1 in-memory graph cache
**Tables:** 10 master + 6 calculation = 16 `cg_*` tables
**Seed data:** 200 roles · 500+ edges · 15 tracks · 75+ waypoints · 600+ skill requirements · 40 promotion rules · 25 lateral rules · 60 learning resources · 200+ skill-resource mappings

---

## 1. System Overview

Career Builder Intelligence (CBI) is a graph-based career guidance system integrated into the MetryxOne Career Builder workspace. It translates a candidate's profile, competency scores, and behavioural signals into:

- A live career graph showing reachable roles
- Personalised promotion and lateral move paths
- Structured career tracks with step-by-step waypoints
- Weighted readiness scores per target role
- Skill gap analysis with per-gap severity
- Ranked learning resource recommendations
- Publishable career intelligence reports

All outputs are **developmental signals only** — never hiring, promotion, or suitability predictions.

### Architecture

```
User Profile + Competency Scores + Behavioural Signals (CAPADEX/WCL0)
        │
        ▼
┌────────────────────────────────────────────────────────────────────┐
│  career-graph-engine.ts  (in-memory, TTL 30m)                      │
│  Dijkstra  ──→ optimal promotion paths                             │
│  BFS       ──→ reachable roles within N hops                       │
└────────────────────┬───────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────────────────────┐
        ▼            ▼                            ▼
career-skill-gap  career-readiness-engine   career-recommendation-engine
    -engine.ts      (5 weighted signals)     (segment classifier + ranker)
        │
        ▼
career-learning-rec-engine.ts
(skill gap → resource matching)
```

### Feature Flag

`FF_CAREER_GRAPH=1` — all routes 503 when off. Set in the workflow command. Front-end component hides automatically when flag is off.

---

## 2. Entity Catalogue — Master Tables

### 2.1 `cg_roles` — Role Taxonomy (200 rows)

| Column          | Type           | Notes                                        |
|-----------------|----------------|----------------------------------------------|
| id              | SERIAL PK      |                                              |
| role_key        | TEXT UNIQUE    | snake_case slug e.g. `pm_mid`                |
| title           | TEXT           | Display name e.g. `Product Manager`          |
| seniority       | TEXT           | `junior` `mid` `senior` `lead` `executive`   |
| function_area   | TEXT           | `engineering` `product` `data` `design` etc. |
| industry_tags   | TEXT[]         | e.g. `{technology, fintech}`                 |
| avg_salary_inr  | INT            | Annual INR; nullable                         |
| demand_score    | NUMERIC(5,2)   | 0–100; higher = more market demand           |
| automation_risk | NUMERIC(5,2)   | 0–100; higher = more at-risk                 |
| growth_30mo     | NUMERIC(5,2)   | Expected % headcount growth over 30 months   |
| is_active       | BOOLEAN        | Soft-delete                                  |

**Indexes:** `UNIQUE(role_key)` · `idx_cg_roles_fn (function_area, seniority, is_active)`

### 2.2 `cg_role_edges` — Transitions (500+ rows)

| Column                 | Type           | Notes                                    |
|------------------------|----------------|------------------------------------------|
| id                     | SERIAL PK      |                                          |
| from_role_id           | INT → cg_roles |                                          |
| to_role_id             | INT → cg_roles |                                          |
| edge_type              | TEXT           | See §2.2.1                               |
| transition_probability | NUMERIC(4,3)   | 0.000–1.000; historical / curated        |
| avg_months_transition  | INT            | Median months to complete transition     |
| difficulty             | TEXT           | `easy` `medium` `hard`                   |
| data_source            | TEXT           | `curated` `o_net` `linkedin`             |

**UNIQUE(from_role_id, to_role_id)**

#### 2.2.1 Edge Types

| edge_type   | Direction        | Meaning                                          |
|-------------|------------------|--------------------------------------------------|
| `promotion` | Up 1 seniority   | Standard vertical progression                    |
| `lateral`   | Same seniority   | Function or domain change, similar level         |
| `diagonal`  | Up + sideways    | Promotion into a different function area         |
| `stretch`   | Up 2+ seniority  | High-effort jump (usually 2+ hop in Dijkstra)    |
| `pivot`     | Any level        | Full domain change; high difficulty              |

### 2.3 `cg_tracks` — Career Tracks (15 rows)

| Column          | Type    | Notes                           |
|-----------------|---------|---------------------------------|
| id              | SERIAL  |                                 |
| track_key       | TEXT UK | e.g. `software_engineering`     |
| name            | TEXT    | Display name                    |
| description     | TEXT    |                                 |
| function_area   | TEXT    | Primary domain                  |
| estimated_years | INT     | End-to-end typical years        |
| is_active       | BOOLEAN |                                 |

**15 seeded tracks:** Software Engineering · Data Science · Product Management · Design · DevOps / Platform · Security · Data Engineering · ML Engineering · Engineering Management · Product Design · Growth · Revenue / Sales Engineering · Finance · HR / People Ops · Operations

### 2.4 `cg_track_waypoints` — Track Steps (75+ rows)

| Column     | Type            | Notes                          |
|------------|-----------------|--------------------------------|
| id         | SERIAL          |                                |
| track_id   | INT → cg_tracks |                                |
| role_id    | INT → cg_roles  |                                |
| step_order | INT             | 1-indexed, ascending           |
| is_optional| BOOLEAN         | Optional detour vs. core path  |

**UNIQUE(track_id, role_id)**

### 2.5 `cg_skill_requirements` — Role–Skill Matrix (600+ rows)

| Column          | Type          | Notes                                   |
|-----------------|---------------|-----------------------------------------|
| id              | SERIAL        |                                         |
| role_id         | INT           |                                         |
| skill_key       | TEXT          | snake_case e.g. `python`                |
| skill_label     | TEXT          | Display label                           |
| category        | TEXT          | `technical` `soft` `domain` `tool`      |
| importance      | TEXT          | `required` `preferred` `nice_to_have`   |
| min_proficiency | INT           | 1–5 (1=awareness, 5=expert)             |

**UNIQUE(role_id, skill_key)**

### 2.6 `cg_promotion_rules` — Promotion Gates (40 rows)

| Column          | Type     | Notes                                          |
|-----------------|----------|------------------------------------------------|
| id              | SERIAL   |                                                |
| from_role_id    | INT      |                                                |
| to_role_id      | INT      |                                                |
| min_months      | INT      | Minimum tenure in `from` role                  |
| required_skills | TEXT[]   | Skill keys that must be at min_proficiency ≥ 3 |
| condition_text  | TEXT     | Human-readable gate description                |

**UNIQUE(from_role_id, to_role_id)**

### 2.7 `cg_lateral_rules` — Lateral Gates (25 rows)

| Column          | Type          | Notes                                      |
|-----------------|---------------|--------------------------------------------|
| id              | SERIAL        |                                            |
| from_role_id    | INT           |                                            |
| to_role_id      | INT           |                                            |
| similarity_score| NUMERIC(4,3)  | 0–1; Jaccard over shared skill keys        |
| skills_to_gain  | TEXT[]        | Skills needed that from-role doesn't have  |
| condition_text  | TEXT          | Human-readable gate description            |

### 2.8 `cg_learning_resources` — Resource Catalogue (60 rows)

| Column          | Type          | Notes                                      |
|-----------------|---------------|--------------------------------------------|
| id              | SERIAL        |                                            |
| resource_key    | TEXT UNIQUE   | slug                                       |
| title           | TEXT          |                                            |
| resource_type   | TEXT          | `course` `certification` `book` `mentor` `project` |
| provider        | TEXT          | Coursera / Udemy / NPTEL / internal        |
| url             | TEXT          | nullable                                   |
| duration_hours  | NUMERIC(6,1)  |                                            |
| cost_inr        | INT           | nullable (null = varies)                   |
| cost_band       | TEXT          | `free` `low` `mid` `premium`               |
| difficulty      | TEXT          | `beginner` `intermediate` `advanced`       |
| language        | TEXT          | ISO code, default `en`                     |
| region          | TEXT          | `IN` `GLOBAL`                              |

### 2.9 `cg_skill_resource_map` — Skill→Resource Links (200+ rows)

| Column             | Type          | Notes                                     |
|--------------------|---------------|-------------------------------------------|
| id                 | SERIAL        |                                           |
| skill_key          | TEXT          |                                           |
| resource_id        | INT           |                                           |
| effectiveness_score| NUMERIC(4,3)  | 0–1; how much this resource closes the gap|
| quality_score      | NUMERIC(4,3)  | 0–1; content quality rating               |

### 2.10 `cg_readiness_weights` — Signal Weights (configurable)

| Column       | Type         | Notes                               |
|--------------|--------------|-------------------------------------|
| signal       | TEXT PK      | `skill` `experience` `behaviour` `credential` `market` |
| weight       | NUMERIC(4,3) | Must sum to 1.000 across all signals |
| updated_at   | TIMESTAMPTZ  |                                     |

**Default weights:** skill=0.40 · experience=0.25 · behaviour=0.20 · credential=0.10 · market=0.05

---

## 3. Calculation Tables — Per-User

### 3.1 `cg_user_skill_gaps`

Persisted skill gap results per (user, role) pair. Updated on each `/api/career/skill-gap/:roleId` call.

| Column             | Type    | Notes                              |
|--------------------|---------|------------------------------------|
| user_id            | TEXT    |                                    |
| role_id            | INT     |                                    |
| weighted_gap_score | NUMERIC | 0–100; 0 = no gaps                 |
| gap_count          | INT     | Number of unmet skills             |
| critical_count     | INT     |                                    |
| data_sources       | TEXT[]  | Sources used for user proficiency  |
| computed_at        | TIMESTAMPTZ |                                |

**PK: (user_id, role_id)**

### 3.2 `cg_user_role_readiness`

| Column         | Type          | Notes                              |
|----------------|---------------|------------------------------------|
| user_id        | TEXT          |                                    |
| role_id        | INT           |                                    |
| readiness_score| NUMERIC(5,2)  | 0–100                              |
| readiness_band | TEXT          | See §5.2                           |
| eta_months     | INT           | nullable; estimated time to ready  |
| confidence     | NUMERIC(4,3)  | 0–1                                |
| computed_at    | TIMESTAMPTZ   |                                    |

**PK: (user_id, role_id)**

### 3.3 `cg_user_career_path`

| Column      | Type   | Notes                                         |
|-------------|--------|-----------------------------------------------|
| user_id     | TEXT   |                                               |
| to_role_id  | INT    | Target role selected                          |
| from_role_id| INT    | nullable; resolved current role at save time  |
| source      | TEXT   | `user_selected` `track_selected` `ai_rec`    |
| saved_at    | TIMESTAMPTZ |                                          |

**UNIQUE(user_id, to_role_id)**

### 3.4 `cg_user_recommendations`

| Column          | Type   | Notes                                       |
|-----------------|--------|---------------------------------------------|
| user_id         | TEXT   |                                             |
| role_id         | INT    |                                             |
| segment         | TEXT   | `next_step` `quick_win` `lateral` `stretch` `pivot` |
| rank_score      | NUMERIC| 0–100                                       |
| readiness_score | NUMERIC| nullable                                    |
| computed_at     | TIMESTAMPTZ |                                        |

### 3.5 `cg_user_learning_recs`

| Column          | Type   | Notes                               |
|-----------------|--------|-------------------------------------|
| user_id         | TEXT   |                                     |
| role_id         | INT    |                                     |
| resource_id     | INT    |                                     |
| skill_key       | TEXT   | Gap this resource addresses         |
| priority_score  | NUMERIC|                                     |
| actioned_at     | TIMESTAMPTZ | nullable; when user started/completed |

---

## 4. Relationships

```
cg_roles ──────┬── (from) cg_role_edges ──── (to) cg_roles
               ├── cg_track_waypoints ──────── cg_tracks
               ├── cg_skill_requirements ──── (skill_key)
               ├── (from) cg_promotion_rules ─ (to) cg_roles
               └── (from) cg_lateral_rules ── (to) cg_roles

cg_skill_requirements.skill_key ──── cg_skill_resource_map.skill_key ──── cg_learning_resources

User side:
career_seeker_profiles ──── cg_user_skill_gaps
                       ──── cg_user_role_readiness
                       ──── cg_user_career_path
                       ──── cg_user_recommendations
                       ──── cg_user_learning_recs
```

---

## 5. Engine Specifications

### 5.1 Career Graph Engine (`career-graph-engine.ts`)

**Graph cache** — rebuilt every 30 minutes or on cache-invalidate call:
```
GraphCache {
  roles:     Map<roleId, CgRole>
  adjacency: Map<fromRoleId, CgEdge[]>
}
```

**Dijkstra** — optimal path from A to B:
- Edge weight = `avg_months_transition × (1 + difficulty_multiplier)`
- Difficulty multipliers: easy=0.0, medium=0.3, hard=0.7
- Returns: array of paths (role sequence + total months + probability product)
- Max depth: 5 hops

**BFS reachability** — all roles reachable from current role within N hops (default 3)

**`listRoles(pool, {function_area, seniority, industry, limit, offset})`** — paginated role catalog, sorted by demand_score DESC

**`getNeighbours(pool, roleId)`** — direct edge neighbours in both directions (forward = to, backward = from)

**`listTracks(pool)`** — 15 tracks + waypoints with role titles, sorted by function_area

**`findTracksForRole(pool, roleId)`** — all tracks containing this role as a waypoint

### 5.2 Skill Gap Engine (`career-skill-gap-engine.ts`)

**Input:**
- `userId` — resolves proficiency from 3 sources
- `roleId` — loads `cg_skill_requirements`

**Multi-source proficiency resolution (precedence order):**
1. `career_seeker_profiles.data.skills` — keyword token matching against `skill_label`
2. `competency_scores.domain_scores` — JSONB; maps domain key → 0–100 score → scaled to 0–5
3. `wcl0_user_intelligence` — behavioural proxy (confidence + adaptability + motivation avg) → maps to soft skill proficiency

**Severity classification:**
| delta (required − user) | importance  | severity   |
|------------------------|-------------|------------|
| 0                      | any         | `met`      |
| > 0, < 1               | any         | `minor`    |
| ≥ 1, < 3               | any         | `moderate` |
| ≥ 3                    | any         | `critical` |
| ≥ 1                    | `required`  | upgraded → `critical` |

**Weighted gap score:**
```
weight(req) = importance === 'required' ? 2 : 1
weighted_gap_score = Σ(delta × weight) / Σ(weight) × 100
```
Range: 0 (no gaps) → 100 (every skill maximally missing, all required)

**Output:** `{ role_title, weighted_gap_score, total_required, gaps[], confidence, degraded, data_sources[] }`

### 5.3 Readiness Engine (`career-readiness-engine.ts`)

**5 weighted signals:**

| Signal     | Weight | Source                                      |
|------------|--------|---------------------------------------------|
| Skill      | 40%    | `1 - (weighted_gap_score / 100)` × 100      |
| Experience | 25%    | `career_seeker_profiles.data.experience` months; capped at role seniority expectations |
| Behaviour  | 20%    | `wcl0_user_intelligence` (motivation+confidence+adaptability avg); neutral=50 when absent |
| Credential | 10%    | Count of certifications in `career_seeker_profiles.data.certifications` vs role expectations |
| Market     | 5%     | `cg_roles.demand_score` (exogenous, role quality signal)   |

**Composite score:**
```
readiness_score = Σ(signal_score × weight)  [0–100]
```

**Band thresholds:**
| Band          | Score range | ETA logic                      |
|---------------|-------------|--------------------------------|
| `not_ready`   | 0–29        | Linear extrapolation           |
| `developing`  | 30–49       | 6–18 months typical            |
| `approaching` | 50–69       | 3–9 months typical             |
| `ready`       | 70–84       | Ready now; apply               |
| `overqualified`| ≥ 85       | May be under-challenged         |

**ETA formula (when score < 70):**
```
gap_to_ready = 70 − readiness_score
eta_months = max(3, ceil(gap_to_ready / 10) × 6)
```

**Confidence:** `0.3 × sources_present / 3` + fixed base; degraded to 0.2 when all signals absent

**`readinessCohortStats(pool, roleId)`** — p25/p50/p75 readiness scores for the role (from `cg_user_role_readiness`)

### 5.4 Career Recommendation Engine (`career-recommendation-engine.ts`)

**Segment classification (per role edge):**

| Segment     | Criteria                                                          |
|-------------|-------------------------------------------------------------------|
| `next_step` | 1-hop promotion/diagonal edge, readiness ≥ 40                     |
| `quick_win` | 1-hop any edge, readiness ≥ 65                                    |
| `lateral`   | Same seniority, different function_area, lateral edge             |
| `stretch`   | 2-hop promotion path or single stretch/diagonal with readiness < 40 |
| `pivot`     | Different function domain, pivot edge or 3-hop                    |

**Exploration:** BFS from current role, 1-hop → 2-hop → 3-hop (capped at 30 candidates total)

**Ranking formula:**
```
rank_score = (readiness_score / 100) × 0.40
           + (demand_score / 100) × 0.30
           + normalise(salary_delta_pct) × 0.20
           + (growth_30mo / 100) × 0.10
```
Sorted DESC within each segment. Each segment capped at 5 recommendations.

**`RecBundle` output:**
```typescript
{
  next_steps:   RoleRec[]   // most likely promotions
  quick_wins:   RoleRec[]   // high readiness short-term
  lateral_moves: RoleRec[]  // same-level domain shifts
  stretch_goals: RoleRec[]  // 18-36 month aspirations
  pivots:        RoleRec[]  // full domain change
  confidence:    number
  data_sources:  string[]
}
```

### 5.5 Learning Recommendation Engine (`career-learning-rec-engine.ts`)

**Inputs:** `userId`, `roleId`, `gaps[]` (from Skill Gap Engine)

**Algorithm:**
1. Filter gaps to severity ≠ `met`
2. Look up `cg_skill_resource_map` for all gap skill_keys
3. Rank each candidate resource:
   ```
   covered_fraction = user_proficiency / required_proficiency
   priority_score = effectiveness_score × quality_score × (1 − covered_fraction)
   ```
4. Dedup: max 3 resources per skill_key; max 1 resource per resource_id across all skills
5. Sort DESC by priority_score
6. Attach cost_band, duration_hours, provider from `cg_learning_resources`

**Output:** `{ recommendations[{ skill_key, skill_label, gap_severity, resources[] }], total_skills_covered }`

---

## 6. Career Tracks

### 6.1 Track Structure

Each track is a named linear sequence of roles. A user "follows" a track by selecting it; the system then highlights their position in the sequence and what's next.

**15 tracks:**
| Track                    | Function   | Est. Years |
|--------------------------|------------|------------|
| Software Engineering     | engineering| 8          |
| Data Science             | data       | 7          |
| Product Management       | product    | 9          |
| UX/Product Design        | design     | 8          |
| DevOps / Platform Eng.   | engineering| 8          |
| Security Engineering     | engineering| 10         |
| Data Engineering         | data       | 8          |
| ML Engineering           | data       | 8          |
| Engineering Management   | leadership | 12         |
| Growth / Marketing Ops   | marketing  | 8          |
| Revenue / Sales Eng.     | sales      | 8          |
| Finance & FP&A           | finance    | 10         |
| HR / People Ops          | hr         | 8          |
| Operations & Strategy    | operations | 10         |
| Product Operations       | product    | 8          |

### 6.2 User Track Selection

`POST /api/career/path` with `source='track_selected'` and `to_role_id` = last waypoint role saves the chosen track target. The current role is inferred server-side.

---

## 7. Promotion Paths

### 7.1 Rule Schema

`cg_promotion_rules`: explicit gates for vertical progression. Each row says: "to get from role A to role B, you need at least `min_months` tenure in A and these `required_skills` at proficiency ≥ 3."

### 7.2 Display Logic

`GET /api/career/promotion-paths` resolves user's current role, queries all promotion rules from that role, then augments each target with readiness score + band. The UI shows:
- Target role title + seniority
- Minimum tenure bar (months elapsed vs. required)
- Skill gate checklist (met / not met)
- Readiness gauge (0–100)
- ETA estimate

---

## 8. Lateral Movements

### 8.1 Rule Schema

`cg_lateral_rules`: curated lateral moves. Each row captures a validated same-level transition with a similarity score (0–1 Jaccard over shared skill keys) and which skills the user needs to gain.

### 8.2 Display Logic

`GET /api/career/lateral-options` resolves current role, returns all lateral targets sorted by similarity DESC. UI shows:
- Similarity bar (0–100%)
- Skills to gain (chip list)
- Readiness score (same 5-signal engine)
- Condition text (plain-English requirement)

---

## 9. API Reference

### User Routes (authenticated, flag-gated)

| Method | Path                                        | Description                                |
|--------|---------------------------------------------|--------------------------------------------|
| GET    | `/api/career/roles`                         | Paginated role catalog; `?function&seniority&industry&limit&offset` |
| GET    | `/api/career/tracks`                        | All 15 tracks with waypoints               |
| GET    | `/api/career/tracks/:trackId`               | Single track detail + waypoints + role detail |
| GET    | `/api/career/current-role`                  | Resolved current role + direct neighbours  |
| GET    | `/api/career/paths?from=&to=`               | Dijkstra optimal paths between two roles   |
| GET    | `/api/career/recommendations`               | RecBundle for current user                 |
| GET    | `/api/career/report`                        | Full Career Intelligence Report            |
| POST   | `/api/career/path`                          | Save selected target role; body: `{to_role_id, source?}` |
| GET    | `/api/career/skill-gap/:roleId`             | Skill gap result for (user, role)          |
| GET    | `/api/career/readiness/:roleId`             | Readiness + cohort stats for (user, role)  |
| GET    | `/api/career/learning/:roleId`              | Learning recs for top role gaps            |
| POST   | `/api/career/learning/:roleId/:resourceId/action` | Mark resource started/completed/bookmarked |
| GET    | `/api/career/roles/:id/neighbors`           | Direct neighbours of a role                |
| GET    | `/api/career/roles/:id`                     | Role detail + skill requirements + promotion/lateral rules + tracks |
| GET    | `/api/career/promotion-paths`               | Promotion rules from user's current role + readiness |
| GET    | `/api/career/lateral-options`               | Lateral rules from user's current role + readiness |

### Admin Routes (superadmin only, 60s cache)

| Method | Path                                     | Description                      |
|--------|------------------------------------------|----------------------------------|
| GET    | `/api/admin/career-graph/stats`          | Platform overview metrics        |
| GET    | `/api/admin/career-graph/roles`          | Role catalog with filters        |
| POST   | `/api/admin/career-graph/roles`          | Create / upsert role             |
| PATCH  | `/api/admin/career-graph/roles/:id`      | Update title/demand/automation   |
| DELETE | `/api/admin/career-graph/roles/:id`      | Soft-delete (is_active=false)    |
| GET    | `/api/admin/career-graph/edges`          | Edges with `?from_role_id&edge_type` |
| POST   | `/api/admin/career-graph/edges`          | Create / upsert edge             |
| PATCH  | `/api/admin/career-graph/edges/:id`      | Update probability/duration      |
| DELETE | `/api/admin/career-graph/edges/:id`      | Hard-delete                      |
| GET    | `/api/admin/career-graph/tracks`         | All tracks                       |
| POST   | `/api/admin/career-graph/tracks`         | Create / upsert track            |
| PATCH  | `/api/admin/career-graph/tracks/:id`     | Update track metadata            |
| GET    | `/api/admin/career-graph/readiness-weights` | Current signal weights        |
| PATCH  | `/api/admin/career-graph/readiness-weights` | Update weights (must sum to 1) |

---

## 10. Dashboard Requirements

### 10.1 Career Graph Tab (`CareerGraphTab.tsx`)

- **Career Map panel** — SVG radial graph; current role at centre; neighbours as nodes; edges coloured by type (promotion=green, lateral=blue, stretch=amber, pivot=red); clickable nodes select target
- **Skill Gap panel** — horizontal bar chart per skill; user proficiency (filled) vs. required (outline); severity chip (critical/moderate/minor/met)
- **Readiness Gauge** — radial progress 0–100; band label chip; ETA banner when < 70; signal breakdown table (skill/exp/behaviour/credential/market scores + weights)
- **Top Blockers** — top 3 skill gaps by weighted impact; "points to gain" estimate per blocker

### 10.2 Career Paths Tab (`CareerRecommendationsTab.tsx`)

- **5 columns:** Next Steps · Quick Wins · Lateral Moves · Stretch Goals · Pivots
- Each card: role title, seniority chip, function area, readiness badge, demand bar, salary delta chip, "Select as target" button → POST /api/career/path
- Empty state per column when segment has no recommendations

### 10.3 Career Tracks Panel (`CareerTracksPanel.tsx`)

- **Track cards** — grid; each card: track name, function_area badge, estimated_years, short description
- **Expand** — step-by-step waypoint sequence with role title, seniority, optional flag
- **Follow Track** button — saves last waypoint as target role; source='track_selected'
- **Active track banner** — highlights which step user is currently on (matched via current role resolution)

### 10.4 Promotion & Lateral Panel (`PromotionPathsPanel.tsx`)

- **Tab 1: Promotion Paths**
  - Current role displayed at top
  - Each target: title, seniority, min_months progress bar (tenure vs required), required skills checklist, readiness gauge, condition text
  - Empty state when no promotion rules exist for current role

- **Tab 2: Lateral Options**
  - Each option: title, function_area, similarity score bar (0–100%), skills to gain chips, readiness badge, condition text
  - Sorted by similarity DESC

### 10.5 Learning Intelligence Tab (`LearningIntelligenceTab.tsx`)

- **Gap Map** — severity-bucketed skill cards (Critical / Major / Minor); progress bar per skill
- **My Path** — phased learning plan; Phase 1 (critical gaps) → Phase 2 (moderate) → Phase 3 (minor); each resource: title, provider, duration, cost band, type chip, status (Pending / In Progress / Done)
- **Resources** — searchable catalogue; filter by type/cost/difficulty; sorted by priority_score

### 10.6 Admin Panel (`CareerGraphPanel.tsx` in SuperAdmin)

- **Stats tab** — roles/edges/tracks counts; users scored; top recommended roles; readiness band distribution chart
- **Roles tab** — paginated table with filters; inline edit demand_score/automation_risk; soft-delete; add role form
- **Edges tab** — filterable by from_role / edge_type; inline edit probability/duration; delete
- **Tracks tab** — list tracks; create/edit; add waypoints
- **Weights tab** — readiness signal weights editor (must sum to 1.0)

---

## 11. Career Intelligence Report

`GET /api/career/report` — generated on-demand (no persistence). Schema:

```typescript
{
  generated_at: string          // ISO timestamp
  user_id: string
  sections: {
    position_analysis: {
      current_role: string | null
      seniority: string | null
      function_fit: string | null
      match_confidence: number | null   // 0.6 inferred; 0.8 if path saved
      profile_completeness: number | null
    }
    readiness_summary: Array<{
      role_id: number
      role_title: string
      seniority: string | null
      function_area: string | null
      readiness: ReadinessResult | null
      segment: RecSegment
    }>
    skill_gap_analysis: Array<{
      role_id: number
      role_title: string
      gaps: SkillGapResult | null
    }>
    learning_pathway: {
      recommendations: LearningRec[]
    }
    market_signals: Array<{
      role_id: number
      role_title: string
      demand_score: number
      automation_risk: number | null
      growth_30mo: number | null
    }>
  }
  confidence: number
  data_sources: string[]
}
```

**Top targets:** top 2 from `next_steps` + top 1 from `stretch_goals`

---

## 12. Scoring Summary

| Engine         | Output range | Key formula                                     |
|----------------|-------------|-------------------------------------------------|
| Skill Gap      | 0–100       | Σ(delta × weight) / Σ(weight) × 100             |
| Readiness      | 0–100       | Weighted sum of 5 signals                       |
| Recommendation | 0–100       | 0.4×readiness + 0.3×demand + 0.2×salary + 0.1×growth |
| Learning Rec   | 0–1         | effectiveness × quality × (1 − covered_fraction)|
| Transition     | 0–1         | edge.transition_probability                      |
| Path weight    | months      | avg_months × (1 + difficulty_multiplier)         |

---

## 13. Language Policy

All Career Builder Intelligence outputs must comply with:

- **Allowed:** "shows developmental readiness for", "skill gap relative to requirements", "suggested growth path", "market signal indicates demand", "estimated time to close gap"
- **Prohibited:** "qualified for", "suitable for", "recommended for hiring", "will succeed at", "better than peers"
- Every API response envelope carries `data_sources` so consumers can disclose provenance
- Benchmark percentiles (from `cg_user_role_readiness` cohort) are **descriptive only** — not for selection decisions

---

## 14. Feature Flag Posture

| Flag              | Default | Controls                                  |
|-------------------|---------|-------------------------------------------|
| `FF_CAREER_GRAPH` | OFF     | All `/api/career/*` routes; all `/api/admin/career-graph/*` routes |

**Activation:** set `FF_CAREER_GRAPH=1` in the workflow command. Schema bootstraps lazily on first authenticated request (runs both migration files via `ensureSchema`). Graph cache warms on first route hit.

---

## 15. Implementation Notes

- **Literal-before-param rule:** every literal sub-path (`/tracks`, `/current-role`, `/paths`, `/report`, `/promotion-paths`, `/lateral-options`) is registered BEFORE `/:id` or `/:roleId` catch-alls
- **Schema bootstrap:** `ensureSchema(pool)` runs `20260611_career_graph.sql` then `20260611_career_graph_supplement.sql` lazily; idempotent; propagates DDL failures so schema issues surface as 500 rather than silent corruption
- **Graph cache TTL:** 30 minutes; invalidated by admin write operations via `buildGraphCache(pool, true)`
- **Behavioural signal degradation:** when WCL0 data absent, behaviour score defaults to neutral 50 — score is degraded but not fabricated; `confidence` is reduced accordingly
- **Salary delta:** calculated as `(target.avg_salary_inr − current.avg_salary_inr) / current.avg_salary_inr × 100`; null when either salary is null
- **Career Genome (`career-genome.ts`):** separate in-memory skill graph (25 skills × adjacency × learnability × transferability × future signals); used by Future Map tab, not by CGI engines; no DB dependency
