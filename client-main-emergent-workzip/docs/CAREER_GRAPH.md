# Career Graph Intelligence (CGI) — Technical Documentation

**Status:** Production (flag-gated: `FF_CAREER_GRAPH=1`)
**Feature flag:** `FF_CAREER_GRAPH` — set in workflow command to enable all routes and UI
**Primary surfaces:**
- User: `CareerGraphTab.tsx` (tab `career-graph`) and `CareerRecommendationsTab.tsx` (tab `career-recs`)
- Admin: `CareerGraphPanel.tsx` (nav `career-graph-admin` under "Career Intelligence")
**Backend:** `backend/routes/career-graph.ts` registered via `registerCareerGraphRoutes()` in `routes.ts`
**Engines:** `backend/services/career-graph-*.ts` (5 pure services)
**Migration:** `backend/migrations/20260611_career_graph.sql`

---

## 1 · What CGI is

Career Graph Intelligence layers a server-backed, graph-traversal career intelligence system on top of the existing Career Builder. It replaces frontend-only heuristics with:

- A **directed multi-graph of 200 roles** linked by typed edges (promotion / lateral / pivot / diagonal / stretch)
- **15 career tracks** (seniority ladders) with ordered waypoints
- **Server-side skill gap computation** per-user per-target-role
- **5-signal readiness scoring** with ETA and blocker identification
- **Personalised career recommendations** in 5 segments
- **Learning resource recommendations** ranked by gap severity × effectiveness

All output is a **developmental signal only** — never a hiring, promotion, or suitability prediction.

---

## 2 · Schema — 16 tables (prefix `cg_`)

### Master tables (10)

| Table | Description | Seed size |
|-------|-------------|-----------|
| `cg_roles` | Role profiles: title, seniority, function, industry, salary, demand/automation scores | 200 rows |
| `cg_role_edges` | Directed transition edges: from→to, edge_type, avg_months, transition_probability | 500+ rows |
| `cg_tracks` | Career tracks (seniority ladders) | 15 rows |
| `cg_track_waypoints` | Ordered role membership in a track | 75+ rows |
| `cg_skill_requirements` | Per-role skill requirements: skill_key, required_level (0–5), weight, is_critical | 600+ rows |
| `cg_promotion_rules` | Explicit promotion paths with criteria | 40 rows |
| `cg_lateral_rules` | Lateral move rules with similarity conditions | 25 rows |
| `cg_learning_resources` | Learning resources: type, provider, url, duration, cost_band, effectiveness_score | 60 rows |
| `cg_skill_resource_map` | Skill→resource mappings with gap_addressed_fraction | 200+ rows |
| `cg_readiness_weights` | Single config row: signal weights (skill/experience/behaviour/credential/market) | 1 row |

### Calculation tables (6)

| Table | Description |
|-------|-------------|
| `cg_user_skill_gaps` | Per-user per-role gap snapshot |
| `cg_user_role_readiness` | Per-user per-role readiness score + band |
| `cg_user_career_path` | User-selected career path (target role + path_type) |
| `cg_user_recommendations` | Persisted rec bundles (scored role recs per segment) |
| `cg_user_learning_recs` | Persisted learning recommendations per user per role |
| `cg_readiness_history` | Append-only readiness snapshots for trend analysis |

> **Namespace safety:** all tables use `cg_` prefix — never collides with existing `role_catalog`, `career_trajectory`, `ont_career_tracks`, or `kg_*` tables.

---

## 3 · Engine services

### 3.1 Career Graph Engine (`career-graph-engine.ts`)

Builds an in-memory adjacency list (30-minute TTL) from `cg_roles` + `cg_role_edges`.

| Function | Description |
|----------|-------------|
| `buildGraphCache(pool)` | Load all active roles + edges into memory |
| `bfsReachable(g, fromId, maxHops)` | All roles reachable within N hops |
| `dijkstra(g, fromId, toId)` | Optimal path (cost = skill_gap_difficulty × avg_months) |
| `findQuickWins(g, fromId, gaps)` | Roles with readiness ≥ 70 within 1 hop |
| `findStretchGoals(g, fromId)` | Roles 2–3 hops away |
| `getNeighbours(pool, roleId)` | 1-hop neighbours with edge metadata |
| `getPaths(pool, fromId, toId)` | Dijkstra optimal paths |
| `listTracks(pool)` | All tracks with waypoints |
| `findTracksForRole(pool, roleId)` | Tracks containing a given role |

### 3.2 Skill Gap Engine (`career-skill-gap-engine.ts`)

Merges user skill evidence from multiple sources into a unified skill map and compares to `cg_skill_requirements`.

**Gap score formula:**
```
gap_score = Σ( weight_i × max(0, required_i − current_i) ) / Σ( weight_i × required_i ) × 100
```

Gap severity thresholds: `critical` if gap ≥ 2, `moderate` if gap ≥ 1, `minor` otherwise.

### 3.3 Career Readiness Engine (`career-readiness-engine.ts`)

**5-signal composite readiness score (0–100):**

| Signal | Default weight | Source |
|--------|---------------|--------|
| Skill coverage | 40% | Inverse of gap_score |
| Experience fit | 25% | Seniority alignment from profile |
| Behavioural | 20% | `wcl0_user_intelligence` (degrades to 0.5 neutral if absent) |
| Credential | 10% | Credential items in profile (degrades gracefully) |
| Market demand | 5% | `cg_roles.demand_score` |

**Readiness bands:**
- `overqualified` ≥ 90
- `ready` ≥ 70
- `approaching` ≥ 50
- `developing` ≥ 30
- `not_ready` < 30

**ETA formula:** `eta_months = Σ(critical_gap_hours) / 20 + 3` (capped at 36 months)

Weights are configurable via `cg_readiness_weights` and the admin `PATCH /api/admin/career-graph/readiness-weights` route. Changes take effect immediately (no cache).

### 3.4 Career Recommendation Engine (`career-recommendation-engine.ts`)

**Recommendation score formula:**
```
score = (readiness × 0.40)
      + (market_demand × 0.20)
      + (salary_delta_normalised × 0.15)
      + (transition_probability × 0.15)
      + (behaviour_fit × 0.10)
```

**Segments:**

| Segment | Criteria |
|---------|----------|
| `next_step` | 1-hop forward, readiness ≥ 50 |
| `quick_win` | 1-hop, readiness ≥ 70 (high confidence moves) |
| `lateral` | Same seniority, different function |
| `stretch` | 2–3 hops, readiness 30–70 |
| `pivot` | Different function AND industry |

Top 5 per segment; upserted to `cg_user_recommendations`.

### 3.5 Learning Recommendation Engine (`career-learning-rec-engine.ts`)

**Resource score formula:**
```
resource_score = effectiveness_score × quality_score × (1 − already_covered_fraction)
```

Resources ranked by `gap_severity × resource_score`. Region filter defaults to `IN`. Results upserted to `cg_user_learning_recs`.

---

## 4 · API contract

### 4.1 User routes (all require auth, all flag-gated)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/career/roles` | Paginated role catalog. Query: `function`, `seniority`, `industry`, `limit`, `offset` |
| GET | `/api/career/roles/:id` | Role detail + skill requirements + promotion/lateral rules + tracks |
| GET | `/api/career/roles/:id/neighbors` | 1-hop adjacent roles with edge metadata |
| GET | `/api/career/paths?from=&to=` | Dijkstra optimal paths between two role ids |
| GET | `/api/career/tracks` | All 15 career tracks with ordered waypoints |
| GET | `/api/career/skill-gap/:roleId` | User's gap analysis vs a target role |
| GET | `/api/career/readiness/:roleId` | 5-signal readiness composite + band + ETA + cohort |
| GET | `/api/career/recommendations` | Full recommendation bundle (all 5 segments) |
| GET | `/api/career/learning/:roleId` | Ranked learning resources for a target role |
| POST | `/api/career/learning/:roleId/:resourceId/action` | Mark resource as `started`/`completed`/`bookmarked` |
| POST | `/api/career/path` | Save selected career path (`role_id`, `path_type`) |
| GET | `/api/career/report` | Full Career Intelligence Report JSON (5 sections) |

### 4.2 Admin routes (superadmin only, 60s cache, `?refresh=1` to bust)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/admin/career-graph/roles` | List (filter: function/seniority/industry) + create |
| PATCH/DELETE | `/api/admin/career-graph/roles/:id` | Update demand/risk/status · soft-delete |
| GET/POST | `/api/admin/career-graph/edges` | List (filter: edge_type) + create |
| PATCH/DELETE | `/api/admin/career-graph/edges/:id` | Update probability/months · hard-delete |
| GET/POST | `/api/admin/career-graph/tracks` | List all tracks + create |
| GET/POST/PATCH | `/api/admin/career-graph/track-waypoints` | Waypoint management |
| GET/POST/PATCH | `/api/admin/career-graph/skill-requirements` | Per-role skill requirement management |
| GET/POST/PATCH/DELETE | `/api/admin/career-graph/learning-resources` | Resource CRUD (soft-delete) |
| GET/PATCH | `/api/admin/career-graph/readiness-weights` | View + update 5 signal weights |
| GET | `/api/admin/career-graph/stats` | Platform stats: roles, edges, users scored, top recs, readiness distribution |

### 4.3 Career Intelligence Report sections

1. **Position Analysis** — current role, profile completeness
2. **Readiness Summary** — top 3 target roles × 5-signal readiness breakdown
3. **Skill Gap Analysis** — critical gaps (top 5) + coverage % + weighted gap score
4. **Learning Pathway** — ordered resource list for top target role
5. **Market Signals** — demand score, automation risk, growth_30mo for top 3 targets

---

## 5 · Frontend surfaces

### 5.1 CareerGraphTab.tsx (`career-graph`)

Three sub-tabs accessed via a pill switcher:

| Sub-tab | Description | API calls |
|---------|-------------|-----------|
| **Map** | Connected roles grid; colour-coded by edge type (promotion=blue, lateral=amber, pivot=violet, stretch=rose); click to select target | `/api/career/roles/:id/neighbors` |
| **Skill Gap** | Horizontal bar chart of top-10 skills; each bar shows current level (dark) vs required level (light) in a 0–N scale; gap severity dots | `/api/career/skill-gap/:roleId` |
| **Readiness** | 5-signal score bars + readiness gauge; band label; ETA months; top-3 blockers with `+N pts` fix estimate; top-3 learning recs | `/api/career/readiness/:roleId`, `/api/career/learning/:roleId` |

"Skill Gap" and "Readiness" sub-tabs are disabled until a target role is selected in Map.

### 5.2 CareerRecommendationsTab.tsx (`career-recs`)

Three-column layout:

| Column | Contents | API source |
|--------|----------|------------|
| **Next Steps** | `next_step` + `quick_win` recs; readiness bar, transition probability, avg months, salary delta, "Select as target" CTA | `/api/career/recommendations` |
| **Lateral Moves** | `lateral` recs; same seniority; skill gap tags | `/api/career/recommendations` |
| **Stretch Goals** | `stretch` recs; aspirational roles 2+ hops; `+N months` effort | `/api/career/recommendations` |

"Select as target" calls `POST /api/career/path` to persist the choice in `cg_user_career_path`.

### 5.3 CareerGraphPanel.tsx (admin, `career-graph-admin`)

Five tabs:

| Tab | Contents |
|-----|----------|
| **Roles** | Searchable table (200 rows); function/seniority/industry filter; inline status; "Add role" form |
| **Edges** | Edge table; edge_type filter; `PATCH` probability/months inline |
| **Tracks** | Accordion per track; waypoints listed in position order |
| **Learning** | Resource table; "Add resource" form; soft-delete toggle |
| **Analytics** | Platform stats cards + top recommended roles + readiness distribution bar chart |

---

## 6 · Architectural constraints

- **Additive / never-throws:** all engines return `{ ..., confidence, degraded }` — missing data degrades gracefully, never errors
- **Flag gate:** `FF_CAREER_GRAPH=1` required; flag-off → 503 on every CGI route + UI tabs hidden
- **Table prefix:** `cg_` on all 16 tables — no collision with existing `role_catalog`, `career_trajectory`, `ont_career_tracks`, `kg_*`
- **k-anonymity:** cohort stats on `cg_user_role_readiness` suppressed below k=10 users
- **Literal routes before params:** `/api/career/tracks`, `/api/career/paths`, `/api/career/recommendations`, `POST /api/career/path` all registered before `/:roleId` catch-alls
- **Readiness weights:** single config row in `cg_readiness_weights`; `PATCH` is unconditional `UPDATE ... WHERE true`
- **Behavioural signal source:** reads `wcl0_user_intelligence` when available; degrades to 0.5 neutral — never reads raw concern signals as strength proxies
- **No edits to existing Career Builder:** CGI is purely additive — tabs, engines, routes all new; zero edits to existing `CareerBuilderPage.tsx` core tabs

---

## 7 · Relevant files

| File | Role |
|------|------|
| `backend/migrations/20260611_career_graph.sql` | Schema + full seed data (16 tables) |
| `backend/services/career-graph-engine.ts` | Graph builder, BFS, Dijkstra, role catalog |
| `backend/services/career-skill-gap-engine.ts` | Per-user per-role gap analysis |
| `backend/services/career-readiness-engine.ts` | 5-signal composite readiness scoring |
| `backend/services/career-recommendation-engine.ts` | Personalised role recommendations |
| `backend/services/career-learning-rec-engine.ts` | Learning resource recommendations |
| `backend/routes/career-graph.ts` | All 12 user + 9 admin routes |
| `frontend/src/components/career/CareerGraphTab.tsx` | 3-sub-tab career graph UI |
| `frontend/src/components/career/CareerRecommendationsTab.tsx` | 3-column career paths UI |
| `frontend/src/components/superadmin/CareerGraphPanel.tsx` | 5-tab admin panel |
| `frontend/src/pages/CareerBuilderPage.tsx` | Tab wiring: `career-graph` + `career-recs` |
| `frontend/src/hooks/useAdminDashboardState.tsx` | Nav group "Career Intelligence" |
| `frontend/src/components/SuperAdminDashboard.tsx` | Admin panel render |
| `docs/CAREER_BUILDER.md` | Career Builder master doc (links here) |
