# MX-74X · Section 4 — Career Path Engine

**File:** `backend/services/career-path-engine.ts` · **Route:** `backend/routes/career-path.ts`
**Flag:** `careerPath` (inherits `careerBuilderSuite`) · **Version:** `74x.1.0`
**Status:** NEW (the first missing link). Compose-only · read-only · never-throws · flag-gated.

---

## 1. Why this engine exists

Section 1 (§5) identified that Career Match (anchor role) and the role graph (`cg_role_edges`,
`cg_tracks`) both exist, but nothing automatically derives a **graph-backed progression path**
from the subject's anchor role. This engine is that bridge. It does NOT invent roles or edges —
every waypoint is a real `cg_roles` row connected by a real `cg_role_edges` row.

## 2. What it composes (never recomputes)

| Source | Used for |
|---|---|
| `buildCareerMatch(pool, subjectId)` | the **anchor** (`anchor.catalog_role_id`, `role_title`, `role_id`) |
| `computeRoleReadinessV2` | anchor readiness context (Coverage/Confidence inputs) |
| `buildCareerGap` | gating gaps that contextualise the first advancement step |
| `cg_role_edges` | real advancement / lateral transitions out of each role |
| `cg_tracks` | the canonical ladder (if any) that contains the anchor |

## 3. Algorithm (deterministic, graph-bounded)

1. Resolve the anchor via Career Match. **No catalog-matched anchor → `measurable:false`**, empty
   path, honest note (`No catalog-matched anchor role…`). This is the honest floor; never padded.
2. Label each outgoing `cg_role_edges` row as **advancement** vs **lateral** using a *disclosed*
   seniority-rank heuristic (`basis = 'seniority_rank_heuristic'`):
   `entry 1 · junior 2 · mid 3 · senior 4 · lead 5 · principal 6 · executive 7` (unknown → 0).
   Higher target rank = advancement; same/adjacent = lateral.
3. Walk rising-seniority real edges from the anchor to build the ordered `path[]` (each waypoint
   carries the real `cg_role_edges` row that connects it: `edge_type`, `transition_probability`,
   `avg_months_transition`). `edge_type` vocabulary: `lateral / promotion / diagonal / pivot /
   stretch`.
4. Collect same/adjacent-seniority edges as `lateral_options[]`.
5. If a `cg_tracks` ladder contains the anchor, attach `canonical_track.from_anchor[]`.
6. `summary`: `advancement_steps`, `lateral_options`, `terminal_role`, `horizon_months`
   (sum of `avg_months_transition` along the path, `null` if any leg is unknown).

## 4. Honesty contract

- **Path length is bounded by REAL edges** — coverage, never padded.
- Seniority ordering is a **disclosed heuristic**, never asserted as fact.
- `axes.coverage` = is a graph-backed path derivable; `axes.confidence.band` ∈
  `high/moderate/low/none` from edge density + anchor confidence.
- All outputs are **developmental progression options**, never hiring/promotion predictions
  (language policy `allowed`/`disallowed` term lists shipped in the envelope).

## 5. Verified behaviour (live data, 2026-06-24)

| Subject | measurable | path | cov | conf | track |
|---|---|---|---|---|---|
| `adaptive_smoke_1` | true | PM → Sr PM → Group PM → VP of Product (3 promotions, p/months) | 75 | high | product_management |
| `demo_subj_pm` | true | Senior Backend Engineer → Backend Tech Lead (+2 lateral) | 25 | moderate | — |
| `aarav.chopra.0@example.com` | false | (no anchor) | null | none | — |
| `no_such_subject_xyz` | false | (no anchor) | null | none | — |

## 6. Route surface

- `GET /api/career-path/_meta/status` — flag probe, no DB touch (literal path, registered first).
- `GET /api/career-path/:subject` — composed envelope, read-only.
- Both `requireAuth + requireSuperAdmin`; flag-OFF → `503 feature_disabled` before any DB touch.
