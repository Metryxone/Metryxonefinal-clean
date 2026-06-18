# Future Readiness Platform (FRP)

## Overview
FRP is an additive, flag-gated intelligence layer (`FF_FUTURE_READINESS=1`) that measures, tracks and improves a user's readiness for an AI-transformed future of work. It composes signals from the existing CAPADEX/LIP/career stacks and enriches them with purpose-built taxonomy, scoring and recommendation engines.

---

## Feature Flag
| Flag | Default | Effect when OFF |
|------|---------|-----------------|
| `FF_FUTURE_READINESS` | OFF | All `/api/frp/*` routes return 503; tab hidden |

Add `FF_FUTURE_READINESS=1` to the Backend API workflow command to activate.

---

## Data Domains (10 tables)

| Table | Purpose |
|-------|---------|
| `frp_skills` | Future Skill Library — 40 curated skills across 8 domains |
| `frp_skill_domains` | Domain taxonomy (AI & ML, Digital Fluency, …) |
| `frp_ai_impact` | AI Impact Framework — role-level disruption/augmentation scores |
| `frp_automation_risk` | Automation Risk Framework — 25 role profiles with risk bands |
| `frp_industry_forecasts` | Industry Forecast Engine — 10-year outlooks for 10 industries |
| `frp_role_evolution` | Role Evolution Engine — 15 canonical evolution paths |
| `frp_user_skills` | User's self-assessed/validated skill proficiencies |
| `frp_readiness_snapshots` | FRI score history (append-only) |
| `frp_recommendations` | Reskill/upskill/pivot/alert recommendations per user |
| `frp_cohort_benchmarks` | Percentile snapshots per role/industry cohort |

Schema and seed are in `backend/services/frp-schema-seed.ts` (idempotent `ensureFRPSchema()`).

---

## Future Readiness Index (FRI)

5-signal composite (0–100):

| Signal | Weight | Source |
|--------|--------|--------|
| Skill Durability | 30% | `frp_user_skills` × `frp_skills.durability_score` |
| Market Alignment | 25% | Demand trend vs user skill coverage |
| Adaptability | 20% | Learning history + behavioural signals |
| Learning Velocity | 15% | LIP learning engagement / time |
| Role Resilience | 10% | `frp_automation_risk` for user's current role |

### Bands
| Score | Band |
|-------|------|
| 0–20 | emerging |
| 21–40 | developing |
| 41–60 | capable |
| 61–80 | resilient |
| 81–100 | pioneering |

Engine: `backend/services/frp-readiness-engine.ts`

---

## Recommendation Engine

`backend/services/frp-recommendation-engine.ts` produces 4 recommendation types:

| Type | Trigger |
|------|---------|
| `reskill` | Skill with low proficiency + high future demand |
| `upskill` | Skill user has but below industry benchmark |
| `role_pivot` | Automation risk > 70% + transferable skills identified |
| `resilience_alert` | FRI < 40 + declining trend |

Cohort benchmarks: percentile of FRI within `role × industry` cohort, stored in `frp_cohort_benchmarks`.

---

## API Routes (`/api/frp/*`)

All routes require `FF_FUTURE_READINESS=1`. User routes require `requireAuth`. Admin routes require `requireAuth` + `requireSuperAdmin`.

### User Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/frp/index` | Compute live FRI for authenticated user |
| GET | `/api/frp/skills` | Full Future Skill Library |
| GET | `/api/frp/skills/domains` | Skill domain list |
| GET | `/api/frp/skills/user` | User's skill proficiencies |
| POST | `/api/frp/skills/user` | Upsert a skill proficiency |
| GET | `/api/frp/ai-impact/:role` | AI impact profile for a role |
| GET | `/api/frp/automation-risk/:role` | Automation risk for a role |
| GET | `/api/frp/industry-forecast/:industry` | 10-year forecast for an industry |
| GET | `/api/frp/role-evolution/:role` | Evolution paths from a role |
| GET | `/api/frp/recommendations` | Personalised recommendations |
| GET | `/api/frp/benchmark` | Cohort percentile benchmark |
| GET | `/api/frp/snapshots` | FRI history for the user |

### Admin Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/frp/admin/stats` | Platform-wide FRI stats |
| GET | `/api/frp/admin/skills` | All skills (admin view) |
| POST | `/api/frp/admin/skills` | Create a skill |
| PUT | `/api/frp/admin/skills/:id` | Update a skill |
| GET | `/api/frp/admin/ai-impact` | All AI impact records |
| POST | `/api/frp/admin/ai-impact` | Create an AI impact record |
| GET | `/api/frp/admin/automation-risk` | All automation risk profiles |
| POST | `/api/frp/admin/automation-risk` | Create a risk profile |
| GET | `/api/frp/admin/industry-forecasts` | All industry forecasts |
| GET | `/api/frp/admin/role-evolution` | All role evolution paths |

Routes: `backend/routes/frp.ts`

---

## Frontend

### Career Builder Tab
- Tab ID: `future-readiness`
- Zone: `intelligence`
- Label: "Future Readiness"
- Component: `frontend/src/components/career/FutureReadinessTab.tsx`
- 6 sub-tabs: Overview · Skills · AI Impact · Automation Risk · Industry Forecast · Role Evolution

### Super Admin Panel
- Nav ID: `frp-admin`
- Group: "Future Readiness Intelligence"
- Component: `frontend/src/components/superadmin/FRPDesignPanel.tsx`
- 7 admin tabs: Overview · Skill Library · AI Impact · Automation Risk · Industry Forecasts · Role Evolution · Benchmarks

---

## Conventions
- **Additive / read-only / never-throws**: FRP routes degrade gracefully; absent data returns empty arrays, not 500s.
- **Flag-off = byte-identical**: when `FF_FUTURE_READINESS` is not set, routes 503 and the tab is absent — no schema mutations occur.
- **Idempotent schema**: `ensureFRPSchema()` uses `CREATE TABLE IF NOT EXISTS` + `ON CONFLICT DO NOTHING` seeds.
- **Append-only snapshots**: `frp_readiness_snapshots` is never updated in place; each FRI computation appends a new row.
