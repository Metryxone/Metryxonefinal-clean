# WC-P2 — LBI Capability Inventory
Generated: 2026-06-10T13:48:42.819Z

## Summary

The Learning Behavior Index product consists of **three architecturally separate systems**
with independent schemas, routes, and data flows. None of the three systems are connected
to each other. All three have 0 operational data.

| System | Purpose | Tables | Route Prefix | Data State |
|--------|---------|--------|-------------|------------|
| **A — CAPADEX Engine** | Derives LBI dims from CAPADEX session behaviour | `lbi_scores` | `/api/lbi/calculate`, `/api/admin/lbi/*` | 0 scored users |
| **B — Psychometric Framework** | Full psych assessment (19 domains, 3 age bands) | `lbi_domains`, `lbi_subdomains`, `lbi_age_bands`, `lbi_questions`, `lbi_response_scales`, `lbi_scoring_rules` | `/api/lbi/domains`, `/api/lbi/questions`, `/api/lbi/calculate-score` | ALL 0 rows |
| **C — Module/Institute Flow** | B2B institute assessments (parent+student roles) | `lbi_modules`, `lbi_sub_modules`, `lbi_question_bank`, `lbi_sessions`, `lbi_assessment_sessions` | `/api/lbi/modules`, `/api/lbi/sessions/*` | ALL 0 rows |

## System A — CAPADEX Engine Detail

**Engine location**: `backend/routes/lbi-engine.ts` (257 lines)  
**Registered via**: `registerLBIEngineRoutes(app, pool)` in `routes.ts:84`

### Computed Dimensions
| Dimension | Weight | Formula Basis | Meaning |
|-----------|--------|--------------|---------|
| Consistency | 25% | completed ÷ total CAPADEX sessions | Completion rate |
| Persistence | 20% | % concerns revisited + completion bonus | Revisit behaviour |
| Attention | 20% | avg seconds/item (3–8s band = high) | Engagement depth |
| Adaptability | 20% | score improvement across stage order | Learning progression |
| Velocity | 15% | completed sessions/week | Learning pace |

### Learning Style Classification (6 categories)
`impulsive` (<2s/item) · `disengaged` (consistency<35%) · `persistent` (persistence>55%) ·
`reflective` (slow+low adaptability) · `exploratory` (≥3 concerns) · fallback: `exploratory`

### Route Inventory (System A)
| Route | Auth Guard | Notes |
|-------|-----------|-------|
| `POST /api/lbi/calculate` | **NONE** | Unauthenticated; takes `{email}` in body |
| `GET /api/admin/lbi/profiles` | **NONE** | Exposes all user emails + LBI scores |
| `GET /api/admin/lbi/profiles/:email` | **NONE** | Individual profile — on-demand calculate |
| `POST /api/admin/lbi/recalculate-all` | **NONE** | Triggers bulk recalculation for up to 500 users |
| `GET /api/admin/lbi/analytics` | **NONE** | Aggregate LBI analytics |

⚠️ **Security gap**: All 5 System A admin routes are unauthenticated. Any caller can enumerate
all user emails and LBI profiles, trigger bulk recalculation, or submit arbitrary email for scoring.

## System B — Psychometric Framework Detail

**Routes registered in**: `routes.ts ~10894`  
**Declared product spec** (from `LBIProductPage.tsx`): 19 domains, 3 age bands, 800+ questions planned

### Framework Tables — All Empty
| Table | Rows | Purpose |
|-------|------|---------|
| `lbi_domains` | 0 | 19 domain definitions (D01–D19) |
| `lbi_subdomains` | 0 | Subdomain breakdowns per domain |
| `lbi_age_bands` | 0 | Age bands A (6–10), B (11–14), C (15–18) |
| `lbi_questions` | 0 | Questions linked to domain + age band |
| `lbi_response_scales` | 0 | Likert scale definitions |
| `lbi_scoring_rules` | 0 | Domain-level scoring formula |
| `lbi_subdomain_norms` | 0 | Normative data for percentile scoring |
| `lbi_clusters` | 0 | Question cluster definitions |
| `lbi_cluster_map` | 0 | Question→cluster mapping |
| `lbi_scoring_rules` | 0 | Domain weightage rules |

### Report Tables — DO NOT EXIST
| Table | Status |
|-------|--------|
| `lbi_report_types` | **MISSING** — referenced in routes.ts ~11705 but never created |
| `lbi_subdomain_report_map` | **MISSING** — referenced in routes.ts ~11680 but never created |

## System C — Module/Institute Flow Detail

**Routes registered in**: `routes.ts ~2026`  
**Auth**: `requireAuth` on all routes; `lbiConsent` gate for minors

### Module Tables — All Empty
| Table | Rows | Purpose |
|-------|------|---------|
| `lbi_modules` | 0 | Assessment module definitions |
| `lbi_sub_modules` | 0 | Sub-module definitions |
| `lbi_age_groups` | 0 | Age group definitions |
| `lbi_question_bank` | 0 | Per-module questions |
| `lbi_sessions` | 0 | Student assessment sessions (schema) |
| `lbi_assessment_sessions` | 0 | Session tracking |
| `lbi_session_responses` | 0 | Response storage |

### Session Results Logic
- **Score**: raw responses summed ÷ max possible score × 100
- **Grade bands**: Excellent(≥80) / Good(≥60) / Average(≥40) / Needs Improvement(<40)
- **generateInsights()**: 4-band hardcoded text + 3 module-specific branches (M4, M5, M6 only)
- **6-month lockout**: re-assessment blocked 6 months after completion — functional but applies to 0 sessions

## AI Report Layer (Separate)

**Route**: `POST /api/ai-reports/generate` (no auth guard)  
**Report types**: `learning-analysis`, `behavioral-insights`, `performance-prediction`, `exam-readiness`, `lbi-comprehensive`

⚠️ **Fabrication risk**: AI prompts instruct the model to produce `"overallScore": number between 60-95` —
scores are hallucinated, not derived from any real LBI data. No LBI data feeds the AI prompt.

**Dependency**: Requires `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL`  
**Current state**: Key present = **false**

## Total LBI DB State
- **26 LBI framework tables**: 26 empty, 0 populated
- **Total rows across all LBI tables**: 0
- **Populated table(s)**: NONE
