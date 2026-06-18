# MetryxOne — Competency Intelligence Platform
## Enterprise Architecture Blueprint v1.0

**Classification:** Chief Architect Document  
**Date:** 2026-06-10  
**Status:** Design Authority Reference  

---

## Table of Contents

1. [Executive Architecture Overview](#1-executive-architecture-overview)
2. [Business Architecture](#2-business-architecture)
3. [Capability Architecture](#3-capability-architecture)
4. [Domain Architecture](#4-domain-architecture)
5. [Platform Architecture](#5-platform-architecture)
6. [Data Architecture](#6-data-architecture)
7. [Security Architecture](#7-security-architecture)
8. [AI Architecture](#8-ai-architecture)
9. [Integration Architecture](#9-integration-architecture)
10. [Analytics Architecture](#10-analytics-architecture)
11. [Cross-Cutting Concerns](#11-cross-cutting-concerns)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Executive Architecture Overview

### Platform Vision
MetryxOne is a Competency Intelligence Platform (CIP) — a behavioural-evidence-first talent ecosystem that measures, develops, and certifies human capability at individual, cohort, and workforce scale.

### Architecture Principles
| # | Principle | Rationale |
|---|-----------|-----------|
| P1 | **Evidence-first, never fabricated** | Every score, recommendation, and insight is traceable to a real data event |
| P2 | **Additive, flag-gated phases** | New capabilities ship behind feature flags; flag-off is byte-identical to prior behaviour |
| P3 | **Developmental signals only** | Outputs describe growth, never hiring/suitability predictions |
| P4 | **k-anonymity on all aggregates** | Cohort data suppressed below k_min=30; privacy by design |
| P5 | **Composable, never recomputed** | Upper layers compose lower layers; no parallel score derivation |
| P6 | **Fail-closed, degrade gracefully** | Missing data → suppressed output, never fabricated default |
| P7 | **Single source of truth per entity** | No duplicated resolvers; canonical service owns each domain |

### Platform Tenets
- **Individual**: Personal growth journey — assessment → gap → learning → certification → passport
- **Cohort**: Peer benchmarking — anonymised comparative intelligence, k-anonymity gated
- **Workforce**: Org-level intelligence — talent mapping, succession, readiness reporting
- **Market**: External alignment — occupation graph, labour market signals, future-readiness

---

## 2. Business Architecture

### 2.1 Purpose
Define the business model, value streams, stakeholder ecosystem, and commercial structure of the Competency Intelligence Platform.

### 2.2 Value Streams

#### VS-1: Individual Talent Development
```
Assessment → Insight → Gap → Learning → Progress → Certification → Passport
```
**Value delivered:** Personal career clarity, growth velocity, portable proof of capability

#### VS-2: Organisational Capability Management
```
Workforce Mapping → Cohort Benchmarking → Succession Planning → L&D ROI → Compliance Audit
```
**Value delivered:** Talent density visibility, bench strength, skill-gap forecasting

#### VS-3: Career Market Intelligence
```
Labour Signal Ingestion → Occupation Graph → Future-Readiness Index → Pathway Recommendations
```
**Value delivered:** Market-aligned career decisions, future-proof skill investment

#### VS-4: Institutional Intelligence
```
Programme Alignment → Graduate Employability → Employer Readiness Mapping → Accreditation Evidence
```
**Value delivered:** Employability outcomes, programme effectiveness, institutional benchmarking

### 2.3 Business Modules

| Module | Objective | Primary Users | Commercial Model |
|--------|-----------|---------------|-----------------|
| M-BA1 | Competency Assessment | Individual, HR, L&D | Per-assessment / Subscription |
| M-BA2 | Employability Index | Individual, Institution | Subscription / API |
| M-BA3 | Career Builder | Individual | Freemium → Premium |
| M-BA4 | Learning Recommendations | Individual, L&D | Commission / Platform fee |
| M-BA5 | Future Readiness | Individual, Org, Policy | Subscription / Cohort licence |
| M-BA6 | Leadership Readiness | HR, L&D, Executive | Enterprise licence |
| M-BA7 | Workforce Intelligence | CHRO, L&D Director | Enterprise SaaS |
| M-BA8 | Talent Analytics | HR Analytics, BI | API + dashboard licence |
| M-BA9 | AI Insights | All roles | Included in subscription tiers |
| M-BA10 | Career Passport | Individual, Employer, Institution | Verification API / Badge issuance |

### 2.4 Stakeholder Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        METRYX ONE PLATFORM                               │
│                                                                           │
│  INDIVIDUALS          ORGANISATIONS         INSTITUTIONS                 │
│  ──────────           ─────────────         ────────────                 │
│  Career Seekers    →  HR Professionals   →  Universities                 │
│  Students          →  L&D Directors      →  Training Bodies              │
│  Professionals     →  CHROs              →  Govt. Agencies               │
│  Job Seekers       →  Talent Managers    →  Assessment Bodies            │
│                       Line Managers                                       │
│                                                                           │
│  MARKET PARTNERS      PLATFORM            SUPER-ADMIN                    │
│  ─────────────        ────────            ──────────                     │
│  Learning Providers → API Consumers    ← System Operations               │
│  Employers         → Embedding Clients ← Content Curation                │
│  Job Platforms     → OEM/White-label   ← Compliance Oversight            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Entities

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| `Individual` | Person using the platform | id, persona, age_band, career_stage |
| `Organisation` | Enterprise/SMB tenant | id, tenant_id, sector, size_band |
| `Institution` | University / training body | id, type, accreditation_body |
| `Assessment` | A completed evaluation | id, type, user_id, score, evidence |
| `Occupation` | A canonical role definition | id, title, family, seniority, esco_code |
| `CompetencyFramework` | Structured competency model | id, name, version, owner |
| `LearningResource` | External or internal content | id, provider, format, skill_mapping |
| `Subscription` | Commercial entitlement | id, tier, modules_enabled, expiry |
| `CareerPassport` | Portable capability record | id, user_id, verified_items, issued_by |

### 2.6 Relationships
- `Individual` 1:N `Assessment` — each person can have multiple assessments
- `Individual` 1:1 `CareerPassport` — one canonical passport per person
- `Organisation` 1:N `Individual` — tenanted workforce membership
- `CompetencyFramework` N:M `Occupation` — frameworks span multiple roles
- `Assessment` N:M `Skill` — each assessment evidences multiple skills
- `LearningResource` N:M `Skill` — resources develop multiple skills

### 2.7 Dependencies
- M-BA2 Employability Index depends on M-BA1 Competency Assessment (score input)
- M-BA4 Learning Recommendations depends on M-BA2 EI (gap identification)
- M-BA6 Leadership Readiness depends on M-BA1 + M-BA3 Career Builder
- M-BA10 Career Passport aggregates all other modules' verified outputs

### 2.8 Implementation Sequence
1. M-BA1 (Competency Assessment) — foundation
2. M-BA2 (Employability Index) + M-BA3 (Career Builder) — parallel
3. M-BA4 (Learning Recommendations) — depends on 1+2
4. M-BA5 (Future Readiness) — depends on 2
5. M-BA6 (Leadership Readiness) — depends on 1+2
6. M-BA7 (Workforce Intelligence) — depends on 1+2+3
7. M-BA8 (Talent Analytics) — depends on 7
8. M-BA9 (AI Insights) — cross-cutting, activates incrementally
9. M-BA10 (Career Passport) — final aggregator

---

## 3. Capability Architecture

### 3.1 Purpose
Define the functional capabilities the platform must provide across all ten objectives.

### 3.2 Capability Tiers

```
┌─────────────────────────────────────────────────────────┐
│  TIER 4: INSIGHTS & INTELLIGENCE                        │
│  AI-generated narratives · Predictive signals           │
│  Prescriptive recommendations · Natural language        │
├─────────────────────────────────────────────────────────┤
│  TIER 3: ANALYTICS & REPORTING                          │
│  Cohort analysis · Trend intelligence · Benchmarking    │
│  Dashboard · Export · Certification                     │
├─────────────────────────────────────────────────────────┤
│  TIER 2: INTELLIGENCE ENGINES                           │
│  EI Scoring · Gap Analysis · Competency Velocity        │
│  Pathway Resolution · Future Readiness · Leadership     │
├─────────────────────────────────────────────────────────┤
│  TIER 1: DATA & ASSESSMENT FOUNDATION                   │
│  Assessment Engine · Signal Capture · Occupation Graph  │
│  Competency Framework · Behavioural Intelligence        │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Capability Map by Objective

#### CAP-1: Competency Assessment
| Sub-capability | Description |
|----------------|-------------|
| CAP-1.1 Framework Management | Build, version, and publish competency frameworks (LBI, SDI, custom) |
| CAP-1.2 Question Curation | Curate, classify, and govern assessment questions |
| CAP-1.3 Assessment Delivery | Adaptive, branching assessment delivery with scoring |
| CAP-1.4 Score Computation | Multi-dimensional scoring, confidence bands, evidence weighting |
| CAP-1.5 Progression Tracking | Longitudinal score history, velocity, trend detection |
| CAP-1.6 Calibration & Governance | Bias detection, reliability testing, item analysis |

#### CAP-2: Employability Index
| Sub-capability | Description |
|----------------|-------------|
| CAP-2.1 EI Composition | 8-dimension composite score (skills, competency, behaviour, trajectory, etc.) |
| CAP-2.2 Gap Analysis | Role-specific gap detection with priority and bridgeability |
| CAP-2.3 Comparative Intelligence | Peer benchmarking, percentile rank (k_min=30) |
| CAP-2.4 Longitudinal Tracking | EI trend, velocity, forecasts (30/60/90d) |
| CAP-2.5 Band Classification | Readiness bands with narrative interpretation |
| CAP-2.6 Role Fit Engine | Occupation-specific EI vs target role scoring |

#### CAP-3: Career Builder
| Sub-capability | Description |
|----------------|-------------|
| CAP-3.1 Profile Management | Rich career profile: experience, education, skills, preferences |
| CAP-3.2 Career Operating System | Aggregated intelligence surface (CAPADEX, EI, BIOS, market signals) |
| CAP-3.3 Resume Intelligence | Resume parsing, content scoring, gap-guided improvement |
| CAP-3.4 Job Discovery | Role matching, fit scoring, aspirational target setting |
| CAP-3.5 Mentor Matching | Developmental mentor recommendations with contextual fit |
| CAP-3.6 Pathway Visualisation | Career pathway explorer with transition cost and confidence |

#### CAP-4: Learning Recommendations
| Sub-capability | Description |
|----------------|-------------|
| CAP-4.1 Gap-to-Resource Mapping | Map competency gaps to curated learning resources |
| CAP-4.2 Provider Integration | Aggregated catalogue from multiple learning providers |
| CAP-4.3 Sequencing Engine | Optimal learning sequence by priority and dependency |
| CAP-4.4 Progress Attribution | Credit completed learning to gap closure and EI score |
| CAP-4.5 L&D ROI Measurement | Correlate learning investment with EI/competency outcome |
| CAP-4.6 Social Learning | Peer cohort learning signals, collaborative recommendations |

#### CAP-5: Future Readiness
| Sub-capability | Description |
|----------------|-------------|
| CAP-5.1 AI Skill Assessment | Measure AI literacy, automation resilience, digital fluency |
| CAP-5.2 Occupation Exposure Index | Rate each occupation's automation exposure score |
| CAP-5.3 Reskilling Pathway | Identify the highest-leverage skills for future-proofing |
| CAP-5.4 Labour Market Signals | Ingest demand signals to prioritise skill investments |
| CAP-5.5 Future-Readiness Score | Composite index: AI literacy + exposure + adaptability |
| CAP-5.6 Scenario Modelling | "What if" career scenario impact on readiness score |

#### CAP-6: Leadership Readiness
| Sub-capability | Description |
|----------------|-------------|
| CAP-6.1 Leadership Framework | Domain-specific leadership competency frameworks |
| CAP-6.2 Leadership Assessment | 360-input, self-report, and behavioural indicator scoring |
| CAP-6.3 Readiness Banding | Entry / Developing / Ready / Accelerate progression bands |
| CAP-6.4 Succession Identification | Algorithmic succession candidate scoring with evidence |
| CAP-6.5 Development Planning | Personalised leadership development pathway |
| CAP-6.6 Behavioural Signature | Dominant leadership behaviour profile from CAPADEX signals |

#### CAP-7: Workforce Intelligence
| Sub-capability | Description |
|----------------|-------------|
| CAP-7.1 Talent Density Mapping | Skills and competency coverage across workforce segments |
| CAP-7.2 Critical Role Risk | Identify roles with insufficient talent pipeline |
| CAP-7.3 Bench Strength | Successor readiness per critical role |
| CAP-7.4 Mobility Intelligence | Internal mobility potential scoring |
| CAP-7.5 Retention Risk | Identify high-value talent with high disengagement signals |
| CAP-7.6 Workforce Scenario Planning | Model org restructuring impact on capability coverage |

#### CAP-8: Talent Analytics
| Sub-capability | Description |
|----------------|-------------|
| CAP-8.1 Executive Dashboard | CHRO-level KPIs: EI distribution, readiness bands, critical gaps |
| CAP-8.2 Cohort Analytics | Slice by seniority, domain, function, geography |
| CAP-8.3 Trend Analytics | EI, competency, and readiness trends over time |
| CAP-8.4 Predictive Analytics | 6/12-month EI and readiness forecasts at cohort level |
| CAP-8.5 Self-Service Analytics | Configurable widgets, filters, drilldown |
| CAP-8.6 Export & Reporting | PDF, CSV, API export; scheduled report delivery |

#### CAP-9: AI Insights
| Sub-capability | Description |
|----------------|-------------|
| CAP-9.1 Natural Language Insights | Narrative synthesis of scores, gaps, and progress |
| CAP-9.2 Conversational Career Coach | Pragati-style conversational guidance at scale |
| CAP-9.3 Pattern Recognition | Cross-user behavioural pattern detection |
| CAP-9.4 Prescriptive Intelligence | Next-best-action for development, learning, and career moves |
| CAP-9.5 Anomaly Detection | Flag unusual score trajectories for human review |
| CAP-9.6 Explainability Layer | Plain-language explanation for every AI-generated output |

#### CAP-10: Career Passport
| Sub-capability | Description |
|----------------|-------------|
| CAP-10.1 Credential Aggregation | Collect, verify, and canonicalise credentials and assessments |
| CAP-10.2 Open Badges | Issue W3C Verifiable Credentials / Open Badge 3.0 |
| CAP-10.3 Employer Verification | Allow employers to verify passport claims via API |
| CAP-10.4 Portability | Portable across platforms (ESCO/O*NET crosswalk, LinkedIn import) |
| CAP-10.5 Privacy Controls | User-controlled disclosure per credential |
| CAP-10.6 Continuous Update | Live passport: new assessments auto-refresh evidence |

---

## 4. Domain Architecture

### 4.1 Purpose
Define the bounded domains, their ownership boundaries, and the context map between them.

### 4.2 Domain Map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          CORE DOMAINS                                        │
│                                                                              │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                │
│  │  ASSESSMENT   │    │  EMPLOYABILITY│    │   CAREER      │                │
│  │  DOMAIN       │───▶│  DOMAIN       │───▶│   DOMAIN      │                │
│  │               │    │               │    │               │                │
│  │ Frameworks    │    │ EI Score      │    │ Profile       │                │
│  │ Questions     │    │ Gap Analysis  │    │ Pathways      │                │
│  │ Sessions      │    │ Readiness     │    │ Recommendations│               │
│  │ Scores        │    │ Forecasting   │    │ Resume        │                │
│  └───────────────┘    └───────────────┘    └───────────────┘                │
│           │                   │                    │                        │
│           ▼                   ▼                    ▼                        │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │              INTELLIGENCE DOMAIN                     │                   │
│  │   Behavioural Signals · Longitudinal · Comparative  │                   │
│  │   Future Readiness · Leadership · Passport          │                   │
│  └──────────────────────────────────────────────────────┘                   │
│                              │                                               │
│           ┌──────────────────┼──────────────────────┐                       │
│           ▼                  ▼                       ▼                       │
│  ┌─────────────┐   ┌────────────────┐   ┌──────────────────┐                │
│  │  WORKFORCE  │   │   ANALYTICS    │   │   AI / INSIGHT   │                │
│  │  DOMAIN     │   │   DOMAIN       │   │   DOMAIN         │                │
│  │             │   │                │   │                  │                │
│  │ Talent Map  │   │ Cohort Stats   │   │ Narrative Engine │                │
│  │ Succession  │   │ Trend Engine   │   │ Prescriptive AI  │                │
│  │ Bench Stren.│   │ Export/Deliver │   │ Explainability   │                │
│  └─────────────┘   └────────────────┘   └──────────────────┘                │
│                                                                              │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │          SUPPORTING DOMAINS (Cross-cutting)          │                   │
│  │  Identity · Tenancy · Subscriptions · Compliance     │                   │
│  │  Notifications · Integrations · Audit Log            │                   │
│  └──────────────────────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Bounded Context Definitions

#### DOM-1: Assessment Domain
**Owner:** Assessment Engine Team  
**Invariants:** Questions are immutable after publication; scores are append-only; confidence is evidence-backed  
**Anti-corruption layer:** Exposes `AssessmentResult` DTO — internal item-response theory never leaks upstream

**Modules:**
- `framework-service` — CRUD for LBI, SDI, and custom frameworks
- `question-registry` — question lifecycle (draft → approved → active → retired)
- `session-engine` — adaptive delivery, branching, scoring
- `score-service` — compute, persist, and version competency scores
- `calibration-service` — item reliability, bias detection, drift monitoring

**Entities:**
```
CompetencyFramework { id, name, version, owner, dimensions[] }
Question { id, text, type, dimension, polarity, difficulty, status }
AssessmentSession { id, user_id, framework_id, started_at, completed_at }
QuestionResponse { session_id, question_id, value, scored_at }
CompetencyScore { user_id, competency_id, score, confidence, evidence_count }
ScoreHistory { user_id, competency_id, score, snapshot_at }
```

#### DOM-2: Employability Domain
**Owner:** EI Engine Team  
**Invariants:** EI score is a composite of component scores (never hand-set); gaps are relative to a target role  
**Anti-corruption layer:** Exposes `EIProfile` DTO; internal formula (8 dimensions, `ei-engine.ts`) is not observable upstream

**Modules:**
- `ei-engine` — formula authority; 8-dimension composite (assessment, behaviour, skill, trajectory, comparative, future, leadership, passport)
- `gap-analysis` — target role gap computation, priority scoring, weeks-to-close
- `readiness-engine` — readiness banding with forecasts
- `comparative-intelligence` — k-anonymity cohort benchmarking (k_min=30)
- `longitudinal-engine` — trend, velocity, pattern detection, forecasting
- `occupation-graph` — canonical occupation/skill/pathway graph

**Entities:**
```
EISnapshot { user_id, score, band, dimension_scores{}, generated_at }
OccupationGap { user_id, occupation_id, competency_id, gap, priority_score }
Occupation { id, canonical_title, role_family, seniority_level, esco_code }
Skill { id, canonical_name, category, market_demand_score, future_relevance_score }
OccupationSkill { occupation_id, skill_id, required_level, importance }
OccupationPathway { from_id, to_id, type, difficulty, timeframe_months }
```

#### DOM-3: Career Domain
**Owner:** Career Product Team  
**Invariants:** No career intelligence silently fabricates market data; all signals are traceable  
**Anti-corruption layer:** Consumes EI via `EIProfile` DTO, never reads ei_snapshot_versions directly

**Modules:**
- `profile-service` — career seeker profile management
- `career-brain` — aggregation layer (EI + CAPADEX + BIOS + market signals)
- `pathway-engine` — career pathway recommendation and sequencing
- `job-discovery` — role matching, fit scoring
- `resume-studio` — resume analysis, content scoring, gap-guided improvement
- `mentor-service` — mentor matching and recommendation

**Entities:**
```
CareerProfile { user_id, headline, years_exp, skills[], target_role, seniority }
CareerEvent { user_id, type, occurred_at, impact_signal }
ResumeDocument { user_id, version, parsed_skills[], parsed_roles[], score }
JobPosting { id, title, employer, skills[], seniority_match_score }
MentorProfile { id, user_id, domain_expertise[], availability }
```

#### DOM-4: Intelligence Domain
**Owner:** Intelligence Platform Team  
**Invariants:** Composites always compose lower layers; never recompute base signals  
**Anti-corruption layer:** Reads-only from DOM-1/2/3 via published projections

**Modules:**
- `behavioural-intelligence` (CAPADEX BIOS) — signal capture, composite patterns, intervention recommendation
- `future-readiness-engine` — AI literacy + occupation exposure + adaptability composite
- `leadership-readiness-engine` — leadership competency scoring, succession candidate identification
- `career-passport-engine` — credential aggregation, badge issuance, verification
- `workforce-intelligence-engine` — talent density, bench strength, retention risk

#### DOM-5: Analytics Domain
**Owner:** Analytics & BI Team  
**Invariants:** Aggregates never expose individual-level data below k_min=30  
**Anti-corruption layer:** Read-only projections; no writes to source tables

**Modules:**
- `cohort-analytics` — segmentation, slicing, aggregation
- `trend-engine` — time-series scoring with interpolation and forecast
- `executive-dashboard` — KPI aggregation for CHRO/L&D Director
- `export-service` — CSV, PDF, and API data export
- `report-delivery` — scheduled and event-triggered report generation

#### DOM-6: AI & Insight Domain
**Owner:** AI Research Team  
**Invariants:** AI outputs must include a confidence score; every claim is grounded in observable data  
**Anti-corruption layer:** Only publishes `InsightPayload { text, confidence, grounding_refs[] }`

**Modules:**
- `narrative-engine` — synthesise assessment, EI, and career data into readable narratives
- `prescriptive-engine` — next-best-action generation
- `conversational-coach` (Pragati) — stateful 13-state FSM career conversation runtime
- `pattern-recognition` — cross-user behaviour pattern detection
- `anomaly-detection` — flag unusual trajectories for human review
- `explainability-layer` — trace every AI claim to its grounding evidence

### 4.4 Domain Relationships

| Upstream | Downstream | Interface |
|----------|------------|-----------|
| Assessment | Employability | `CompetencyScore` published event |
| Employability | Career | `EIProfile` read model |
| Employability | Intelligence | `EISnapshot` projection |
| Career | Intelligence | `CareerEvent` published event |
| Intelligence | Analytics | Aggregated projections (read-only) |
| All domains | AI/Insight | `IntelligenceBundle` composition |
| All domains | Passport | `VerifiableCredential` event stream |

### 4.5 Implementation Sequence
1. DOM-1 Assessment (foundation)
2. DOM-2 Employability (depends on DOM-1)
3. DOM-3 Career (depends on DOM-1/2)
4. DOM-4 Intelligence (depends on DOM-1/2/3)
5. DOM-5 Analytics (depends on DOM-1/2/3/4)
6. DOM-6 AI/Insight (depends on all)

---

## 5. Platform Architecture

### 5.1 Purpose
Define the technical platform: runtime architecture, service topology, API contracts, and deployment model.

### 5.2 System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   CLIENTS                METRYX ONE PLATFORM              EXTERNALS      │
│                                                                          │
│  Web Browser ──────────▶ CDN + Frontend (React/Vite)                    │
│  Mobile App  ──────────▶ API Gateway ──────────────▶ Learning Providers │
│  Employer API ─────────▶ Backend API (Express/Node)▶ Job Platforms      │
│  LMS/HR System ────────▶ Intelligence Services    ──▶ O*NET / ESCO       │
│                           Database (PostgreSQL)    ──▶ Email (Zoho)      │
│                           File Storage             ──▶ Verifiable Cred.  │
│                           Cache (Redis/memory)                           │
│                           Background Jobs                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Service Topology

#### Layer 1: Delivery Layer
| Service | Technology | Responsibility |
|---------|------------|----------------|
| `CDN` | Cloudflare / AWS CloudFront | Static asset delivery, edge caching |
| `API Gateway` | Express + Nginx | Rate limiting, auth forwarding, request routing |
| `Frontend SPA` | React + Vite (port 5000) | All user-facing web interactions |
| `WebSocket Server` | ws / Express WS | Real-time assessment progress, Pragati sessions |

#### Layer 2: Application Layer
| Service | Technology | Responsibility |
|---------|------------|----------------|
| `Assessment Service` | Node.js / Express | Assessment delivery, scoring, session management |
| `EI Service` | Node.js / Express | EI scoring, gap analysis, readiness |
| `Career Service` | Node.js / Express | Profile, pathway, job matching |
| `Intelligence Service` | Node.js / Express | Behavioural, future readiness, leadership |
| `Analytics Service` | Node.js / Express | Aggregation, cohort analytics, reporting |
| `AI Service` | Node.js + LLM SDK | Narrative generation, coaching, explainability |
| `Passport Service` | Node.js / Express | Credential aggregation, badge issuance |

#### Layer 3: Intelligence Layer
| Service | Technology | Responsibility |
|---------|------------|----------------|
| `Competency Engine` | TypeScript service | `competency-intelligence.ts` |
| `EI Engine` | TypeScript service | `ei-engine.ts` (8-dim formula) |
| `Longitudinal Engine` | TypeScript service | `longitudinal-intelligence.ts` |
| `Comparative Engine` | TypeScript service | `comparative-intelligence.ts` |
| `Recommendation Engine` | TypeScript service | `recommendation-engine.ts` |
| `Occupation Graph` | TypeScript + SQL | Occupation/skill/pathway graph |
| `CAPADEX Engine` | TypeScript service | Behavioural signal → insight pipeline |

#### Layer 4: Data Layer
| Service | Technology | Responsibility |
|---------|------------|----------------|
| `PostgreSQL` | PostgreSQL 15+ | Primary relational store (Drizzle ORM) |
| `Redis` | Redis 7+ | Session cache, short-TTL intelligence cache |
| `Object Storage` | S3 / R2 | Reports, resumes, passport badges |
| `Search Index` | pgvector | Semantic skill/competency matching |
| `Event Store` | PostgreSQL tables | Append-only event log for all scoring events |

### 5.4 API Contract Standards

#### REST API Conventions
```
/api/{domain}/{resource}[/{id}][/{sub-resource}]

Auth:    Authorization: Bearer <jwt>
Version: X-API-Version: 2026-06
Format:  Content-Type: application/json

Success: { ok: true, <resource>: {...}, generated_at: "ISO8601" }
Error:   { ok: false, error: "message", code: "ERROR_CODE" }
```

#### Standard Response Envelope
```typescript
interface APIResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  generated_at: string;
  request_id: string;
  confidence?: number;         // 0-1 when output is probabilistic
  data_quality?: DataQuality;  // always present on intelligence endpoints
}
```

#### Intelligence Endpoint Standard
Every intelligence endpoint returns:
```typescript
interface IntelligenceResponse<T> {
  ok: true;
  profile: T;
  data_quality: {
    confidence: 'high' | 'medium' | 'low';
    completeness_pct: number;
    evidence_count: number;
    suppressed_fields: string[];  // fields degraded due to insufficient data
  };
  generated_at: string;
  version: string;  // semver of the engine that produced this
}
```

### 5.5 Platform Modules

```
backend/
├── index.ts                         # Express entry, port 8080
├── routes.ts                        # Main route registry
├── routes/
│   ├── assessments/
│   │   ├── lbi.ts                   # LBI assessment routes
│   │   ├── sdi.ts                   # SDI routes
│   │   ├── competency-questions.ts  # Question curation
│   │   └── capadex.ts               # CAPADEX assessment flow
│   ├── employability/
│   │   ├── employability-graph.ts   # EI + occupation graph + comparative
│   │   ├── ei-admin.ts              # EI admin health + analytics
│   │   └── ei-rules.ts              # EI formula configuration
│   ├── career/
│   │   ├── career-builder.ts        # Career OS routes
│   │   ├── behavioural-memory.ts    # Career behaviour memory
│   │   └── employability-passport.ts# Passport routes
│   ├── intelligence/
│   │   ├── capadex-concern-intelligence.ts
│   │   ├── csi.ts                   # CSI strengths signals
│   │   ├── predictive-intelligence.ts
│   │   └── pragati.ts               # Conversational coach
│   └── admin/
│       ├── tenants.ts
│       └── subscription-packages.ts
└── services/
    ├── assessments/
    │   ├── competency-intelligence.ts  # v2.0.0
    │   ├── lbi-engine.ts
    │   └── adaptive-questioning.ts
    ├── employability/
    │   ├── ei-engine.ts               # 8-dim formula
    │   ├── longitudinal-intelligence.ts# v2.0.0
    │   ├── comparative-intelligence.ts # v1.0.0
    │   ├── recommendation-engine.ts    # v5.0.0
    │   └── occupation-graph-seed*.ts   # P3/P4/P5 seeds
    ├── intelligence/
    │   ├── capadex-wc3.ts             # WC-3 chain
    │   ├── behavioural-signals.ts
    │   └── pil/                       # Problem Intelligence Layer
    └── shared/
        ├── feature-flags.ts
        ├── adaptive-event-bus.ts
        └── ei-resolver.ts
```

### 5.6 Dependencies
- All intelligence services depend on `ei-resolver.ts` as the composition root
- `ei-engine.ts` is the formula authority — no other module duplicates EI scoring
- `adaptive-event-bus.ts` provides cross-module event sync (never Number()-coerce user IDs)

### 5.7 Implementation Sequence
1. Core Express server + PostgreSQL + auth
2. Assessment routes + scoring services
3. EI engine + occupation graph
4. Career builder + intelligence services
5. Comparative + longitudinal intelligence
6. Admin routes + analytics
7. AI layer + Pragati
8. Passport service + external integrations

---

## 6. Data Architecture

### 6.1 Purpose
Define the canonical data model, table ownership, access patterns, and data governance.

### 6.2 Schema Domains

#### SCHEMA-1: Identity & Tenancy
```sql
users                    -- platform users (email, role, tenant_id)
tenants                  -- organisation accounts
career_seeker_profiles   -- extended profile JSONB
user_competency_scores   -- current score per competency per user
```

#### SCHEMA-2: Assessment Foundation
```sql
competency_frameworks     -- framework definitions
framework_dimensions      -- dimension hierarchy
competency_question_templates -- question bank
custom_assessment_modules -- custom module configuration
lbi_*                     -- LBI-specific tables
sdi_*                     -- SDI-specific tables
capadex_sessions          -- CAPADEX assessment sessions
capadex_responses         -- session responses
capadex_users             -- CAPADEX registered users
```

#### SCHEMA-3: Employability Index
```sql
occupations               -- canonical occupation catalogue
skills                    -- skills catalogue
occupation_skills         -- occupation×skill mappings
occupation_pathways       -- career pathway edges
ei_snapshot_versions      -- EI score snapshots (append-only)
ei_events                 -- EI interaction event log
p4_competency_history     -- competency score history (append-only)
user_competency_scores    -- current scores (mutable)
```

#### SCHEMA-4: Career & Behavioural Intelligence
```sql
career_seeker_profiles          -- career profile (JSONB)
career_memories                 -- career memory store
capadex_session_patterns        -- behavioural composite patterns
capadex_session_signals         -- raw signals
wcl0_user_intelligence          -- User Intelligence Foundation
wcl1_trend_intelligence         -- Longitudinal trends
wc3_*                           -- WC-3 chain tables
pil_kg_*                        -- Problem Intelligence Layer graph (NEVER bare kg_*)
```

#### SCHEMA-5: Workforce & Analytics
```sql
cohort_definitions        -- named cohort specifications
workforce_snapshots       -- point-in-time workforce state
succession_candidates     -- succession pipeline
retention_risk_signals    -- disengagement indicators
talent_analytics_cache    -- pre-aggregated analytics (60s TTL)
```

#### SCHEMA-6: Passport & Credentials
```sql
career_passports          -- passport record per user
passport_credentials      -- individual verified items
open_badges               -- issued badges
badge_verifications       -- verification log
```

### 6.3 Data Governance

#### Append-Only Invariants
These tables must **never** be mutated after insert:
- `p4_competency_history`
- `ei_snapshot_versions`
- `ei_events`
- `capadex_responses`
- `m3_*` history tables

#### k-Anonymity Gates
All aggregate queries over user scores must enforce `k_min=30`:
```sql
HAVING COUNT(DISTINCT user_id) >= 30
```
If cohort falls below threshold → return `{ suppressed: true, suppression_reason: '...' }`

#### PII Handling
- `users.email` — never written to audit artifacts (mask to `user_<sha256>`)
- `career_seeker_profiles.data` — JSONB; `contact` field never published in passport
- Session data — OTP tokens are hashed; session tokens expire in 24h

#### Canonical Join Keys
| Left | Right | Join Key | Notes |
|------|-------|----------|-------|
| `capadex_clarity_questions` | `capadex_concerns_master` | `master_bridge_tag` | `concern_id` is DISJOINT (0% join rate) |
| `occupation_skills` | `skills` | `skill_id` | |
| `pil_kg_edges` | `pil_kg_nodes` | `pil_kg_*` prefix | NEVER bare `kg_*` (collides with Employability graph) |

### 6.4 Entity Relationship Summary

```
users ─────────────────────────────────────────────────────────────────────┐
  │ 1:N                                                                     │
  ├──▶ user_competency_scores ──▶ competency_frameworks                     │
  ├──▶ ei_snapshot_versions                                                 │
  ├──▶ capadex_sessions ──▶ capadex_responses                               │
  ├──▶ career_seeker_profiles                                               │
  ├──▶ wcl0_user_intelligence                                               │
  └──▶ career_passports ──▶ passport_credentials                            │
                                                                            │
occupations ──▶ occupation_skills ──▶ skills                                │
occupations ──▶ occupation_pathways ──▶ occupations                        │
```

### 6.5 Data Quality Framework

Every intelligence output includes a `data_quality` object:
```typescript
type DataQuality = {
  confidence: 'high' | 'medium' | 'low';  // high=≥5 inputs, medium=2-4, low=<2
  completeness_pct: number;               // % of expected fields populated
  evidence_count: number;                 // number of scoring events underpinning output
  suppressed_fields: string[];            // fields returned as null due to insufficient data
  last_updated: string;                   // ISO timestamp of most recent underlying event
};
```

### 6.6 Implementation Sequence
1. Identity + tenancy schema (foundation)
2. Assessment schema (drives scoring)
3. EI + occupation schema (employability)
4. Career + behavioural schema (intelligence)
5. Workforce + analytics schema (enterprise tier)
6. Passport + credential schema (certification tier)

---

## 7. Security Architecture

### 7.1 Purpose
Define the security model: authentication, authorisation, data protection, and compliance boundaries.

### 7.2 Security Modules

#### SEC-1: Identity & Access Management
| Sub-module | Implementation |
|------------|----------------|
| Authentication | JWT + session cookie (express-session + PostgreSQL store) |
| MFA | TOTP second factor for super-admin + org-admin roles |
| Password Policy | bcrypt/scrypt hash; SUPERADMIN_INITIAL_PASSWORD via env secret |
| Session Management | 24h TTL; `express_sessions` table; invalidation on logout |
| OTP Verification | CAPADEX user OTP: hashed, time-limited, single-use |

#### SEC-2: Authorisation
```
RBAC Model:

SuperAdmin   → all routes, all tenants, all users
OrgAdmin     → own tenant users, own tenant data
HR/L&D       → read-all-own-tenant, write assessment config
Manager      → direct reports only (IDOR guard: resolveEffectiveUserId)
Individual   → own data only (user_id claim validation on every route)
Public       → assessment landing, public CAPADEX endpoints
```

#### SEC-3: API Security
| Control | Implementation |
|---------|---------------|
| Rate Limiting | Per-IP, per-user rate limits at API gateway |
| Input Validation | Zod schema validation on all request bodies |
| SQL Injection | Parameterised queries via Drizzle ORM (`$1, $2...`) |
| XSS | CSP headers; React JSX escaping |
| CORS | Allowlist of permitted origins; credentials: include |
| IDOR | `resolveEffectiveUserId` on all career + EI routes |

#### SEC-4: Data Protection
| Data Class | Protection |
|------------|------------|
| PII (email, name) | Never in audit artifacts; mask to `user_<sha256>` |
| Credentials | bcrypt/scrypt at rest; never logged |
| Assessment Responses | Encrypted at rest (database encryption) |
| Career Profile | JSONB; field-level access controls |
| Passport Claims | User-controlled disclosure; never bulk-exported |

#### SEC-5: Compliance Boundaries
| Requirement | Implementation |
|-------------|----------------|
| GDPR / Data Subject Rights | Right to erasure: anonymise user_id, retain aggregate scores |
| k-Anonymity | All aggregate outputs suppress below k_min=30 |
| Developmental Language | Language policy enforcement: outputs describe growth, never hiring predictions |
| Audit Trail | Append-only `ei_events` table for all scoring events |
| Consent | OTP-verified registration before CAPADEX report delivery |

#### SEC-6: Infrastructure Security
| Layer | Control |
|-------|---------|
| Secrets | All via environment secrets system (never in code) |
| Transport | TLS 1.3 enforced (Replit mTLS proxy) |
| Database | Drizzle ORM parameterised queries; no raw string interpolation |
| Dependencies | Regular audit (`npm audit`); no transitive secret exposure |

### 7.3 Threat Model Summary

| Threat | Mitigation |
|--------|-----------|
| Score manipulation | EI formula authority in single service; no client-side scoring |
| Data exfiltration | k-anonymity; PII masking; field-level access |
| IDOR (access other users' data) | `resolveEffectiveUserId` on all user-scoped routes |
| Credential stuffing | Rate limiting + MFA for admin roles |
| Prompt injection (AI) | Input sanitisation before LLM; output grounding validation |
| Fabricated credentials (Passport) | Cryptographic signature on all badges; verification API |

### 7.4 Implementation Sequence
1. Auth + RBAC (foundation)
2. IDOR guards on user-scoped routes
3. Rate limiting + input validation
4. PII masking in audit artifacts
5. MFA for admin roles
6. Passport cryptographic signing

---

## 8. AI Architecture

### 8.1 Purpose
Define the AI capability stack: models, pipelines, grounding, safety, and explainability.

### 8.2 AI Principles
1. **Grounded**: Every AI claim anchors to an observable data event
2. **Explained**: Every AI output includes a confidence score and evidence trail
3. **Safe**: No suitability/hiring predictions; developmental framing only
4. **Auditable**: All AI outputs logged with input context for human review
5. **Degradable**: Missing data → explicit low-confidence signal, never fabricated output

### 8.3 AI Architecture Stack

```
┌──────────────────────────────────────────────────────────────┐
│                    AI EXPERIENCE LAYER                        │
│  Narrative Engine · Conversational Coach · Report Synthesis  │
├──────────────────────────────────────────────────────────────┤
│                    AI REASONING LAYER                        │
│  Prescriptive Engine · Pattern Recognition · Anomaly Detect. │
├──────────────────────────────────────────────────────────────┤
│                    AI GROUNDING LAYER                        │
│  Evidence Resolver · Confidence Scorer · Citation Builder    │
├──────────────────────────────────────────────────────────────┤
│                    DATA CONTEXT LAYER                        │
│  Intelligence Bundle · Signal Aggregation · History Context  │
└──────────────────────────────────────────────────────────────┘
```

### 8.4 AI Modules

#### AI-1: Narrative Synthesis Engine
**Input:** `IntelligenceBundle` (EI profile + competency + longitudinal + behavioural)  
**Output:** Plain-English developmental narrative (hopeful/light tone, never near-black)  

**Pipeline:**
1. Compose `IntelligenceBundle` from resolved services
2. Classify confidence level (high/medium/low)
3. Select narrative template by persona + career_stage + confidence
4. Slot evidence data into template
5. Post-process: language policy check (no hiring/suitability language)
6. Return `{ narrative, confidence, evidence_refs[], tone_class }`

#### AI-2: Conversational Career Coach (Pragati)
**Architecture:** 13-state FSM · 8 block types · 12-concern ontology  
**Safety:** Crisis escalation + safety middleware at every state transition  
**Grounding:** Every response references CAPADEX ontology rows

**States:** `idle → intro → assess → clarify → reflect → deepen → action → close → crisis → escalate → pause → resume → complete`

#### AI-3: Prescriptive Recommendation Engine
**Input:** Gap analysis + longitudinal trend + comparative intelligence  
**Output:** `Recommendation[]` ranked by `priority → success_probability → outcome_weight`

**Features (v5.0.0):**
- `success_probability` — 0-1 heuristic (confidence × timeline × priority)
- `outcome_weight` — category-level developmental strength
- `explanation` — grounded narrative per recommendation
- `eliminateRedundancy()` — dedup by normalised title key

#### AI-4: Pattern Recognition Engine
**Input:** Cross-user behavioural signals (anonymised)  
**Output:** Named patterns e.g. "plateau", "recovery", "consistent_growth"  
**Privacy:** Operates on k-anonymised cohort aggregates only

#### AI-5: Anomaly Detection
**Input:** EI score trajectory series  
**Output:** `AnomalySignal { user_id, type, confidence, flagged_at }`  
**Types:** Sudden drop, sustained plateau, acceleration, data sparsity gap

#### AI-6: Explainability Layer
**Contract:** Every AI-generated output includes:
```typescript
interface ExplainableOutput {
  text: string;
  confidence: number;              // 0-1
  confidence_label: 'High' | 'Moderate' | 'Early-stage';
  grounding_refs: Array<{
    source: 'competency_score' | 'ei_snapshot' | 'capadex_signal' | 'ontology';
    entity_id: string;
    value: number | string;
  }>;
  language_policy_checked: boolean;  // never hiring/suitability framing
}
```

### 8.5 AI Safety Controls
| Control | Implementation |
|---------|----------------|
| Developmental framing | Post-generation language policy filter (allowed/disallowed term lists) |
| Grounding check | Every AI claim must have ≥1 `grounding_ref` or confidence=low |
| Confidence floor | AI outputs with confidence < 0.3 are suppressed or flagged "early-stage signal" |
| Crisis detection | Pragati safety middleware checks every user input for distress signals |
| Human-in-the-loop | Anomaly signals route to human review queue before user-facing action |
| Audit log | All AI outputs logged with input context (30-day retention) |

### 8.6 AI Model Stack
| Capability | Model Approach | Notes |
|------------|---------------|-------|
| Narrative synthesis | LLM (prompt-engineered) | Grounded on structured data |
| Conversational coach | Hybrid FSM + LLM | FSM governs state; LLM generates turn response |
| Pattern recognition | Rule-based + statistical | Interpretable; no black-box |
| Anomaly detection | Statistical (z-score, IQR) | Interpretable; flagged for human review |
| Semantic skill matching | pgvector embeddings | Occupation/skill semantic proximity |
| Competency scoring | Deterministic formula | Never ML-based (auditability requirement) |

### 8.7 Implementation Sequence
1. Explainability layer (foundation contract)
2. Narrative synthesis engine (quick win)
3. Prescriptive recommendation engine (on top of deterministic scoring)
4. Conversational coach / Pragati (complex state machine)
5. Pattern recognition + anomaly detection
6. Semantic matching with pgvector

---

## 9. Integration Architecture

### 9.1 Purpose
Define how MetryxOne connects to external systems: learning providers, job platforms, HR systems, and credentialing networks.

### 9.2 Integration Topology

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         INTEGRATION LAYER                                 │
│                                                                           │
│  INBOUND                         METRYX ONE                OUTBOUND       │
│  ────────                        ──────────                ────────       │
│  HR Systems ────────────────────▶ Inbound Adapter ──────▶ Email          │
│  (Workday, SAP, Bamboo)            ↓                        (Zoho)        │
│  Learning Platforms ────────────▶ Event Bus ────────────▶ LMS/LRS        │
│  (Coursera, LinkedIn, Udemy)       ↓                        (xAPI/SCORM)  │
│  Job Platforms ─────────────────▶ Data Normaliser ──────▶ Job Boards     │
│  (LinkedIn, SEEK, Indeed)          ↓                        (postings)    │
│  Credentialing ─────────────────▶ Credential Verifier ──▶ Open Badge Hub │
│  (Credly, Accredible)              ↓                        (W3C VC)      │
│  Labour Market Data ────────────▶ Signal Ingestion ─────▶ Employer API   │
│  (O*NET, ESCO, WEF)                                         (verification) │
└──────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Integration Modules

#### INT-1: HR System Integration
| Adapter | Protocol | Data Exchange |
|---------|---------|---------------|
| Workday | REST API / SFTP | Employee records, org hierarchy, role definitions |
| SAP SuccessFactors | OData API | Competency frameworks, performance ratings |
| BambooHR | REST API | Employee lifecycle events |
| Generic HRIS | CSV/SFTP | Bulk employee ingestion with field mapping |

**Inbound flow:**
`Employee record → Normalise → Create/update user → Enrol in assessment → Snapshot EI`

**Outbound flow:**
`EI score update → Webhook → HRIS performance record update`

#### INT-2: Learning Management System Integration
| Adapter | Protocol | Data Exchange |
|---------|---------|---------------|
| Learning Record Store (LRS) | xAPI (Tin Can) | Completion records, scores, time-on-task |
| SCORM-compliant LMS | SCORM 1.2/2004 | Module completions |
| Coursera / LinkedIn Learning | REST API | Completion events, course catalogue |
| Custom LMS | Webhook + REST | Event-driven completion notification |

**Attribution flow:**
`Completion event → Map to skill/competency → Credit gap closure → Recalculate EI`

#### INT-3: Job Platform Integration
| Adapter | Protocol | Data Exchange |
|---------|---------|---------------|
| LinkedIn Jobs | REST API | Job posting ingestion, skill tagging |
| SEEK / Indeed | REST API | Regional job market signals |
| Employer ATS | Webhook | Application outcomes for future model training |

#### INT-4: Labour Market Data Integration
| Source | Protocol | Data Exchange |
|--------|---------|---------------|
| O*NET Online | REST API | Occupation definitions, skill requirements |
| ESCO | REST API | European Skills/Competences/Qualifications |
| WEF Future of Jobs | Bulk CSV | Future skills demand projections |
| LinkedIn Economic Graph | API | Regional demand signals |

#### INT-5: Credentialing Network Integration
| System | Protocol | Notes |
|--------|---------|-------|
| Credly | REST API | Badge issuance and verification |
| Accredible | REST API | Certificate issuance |
| W3C Verifiable Credentials | DID + VC | Decentralised credential issuance |
| Open Badge 3.0 | REST + Assertion | Portable badge standard |

#### INT-6: Email & Notifications
| Channel | Provider | Events |
|---------|---------|--------|
| Transactional email | Zoho Mail (ZOHO_EMAIL + ZOHO_APP_PASSWORD) | OTP, assessment complete, report ready |
| In-app notifications | WebSocket (/ws/session/:id) | Real-time assessment progress |
| Webhook | User-configured | EI score update, badge issued |
| Scheduled digest | Cron job | Weekly progress summary |

### 9.4 Integration Contracts

#### Inbound Event Standard
```typescript
interface InboundEvent {
  source: string;          // 'workday' | 'lrs' | 'linkedin' | ...
  event_type: string;      // 'completion' | 'hire' | 'promotion' | ...
  user_ref: string;        // external user ID
  payload: Record<string, unknown>;
  received_at: string;     // ISO timestamp
  idempotency_key: string; // dedup key
}
```

#### Outbound Webhook Standard
```typescript
interface OutboundWebhook {
  event: string;
  user_id: string;          // internal
  external_user_ref?: string;
  payload: Record<string, unknown>;
  signature: string;        // HMAC-SHA256 of payload
  sent_at: string;
}
```

### 9.5 Implementation Sequence
1. Email (Zoho) — already live
2. xAPI LRS integration — learning attribution
3. O*NET/ESCO bulk import — occupation graph expansion
4. HR system SFTP/CSV inbound — workforce intelligence
5. Job platform ingestion — job discovery + market signals
6. W3C VC / Open Badge issuance — passport certification
7. Employer verification API — external trust layer

---

## 10. Analytics Architecture

### 10.1 Purpose
Define the analytics model: metric definitions, aggregation pipelines, dashboard architecture, and reporting delivery.

### 10.2 Analytics Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│               ANALYTICS PRESENTATION LAYER                          │
│   Executive Dashboard · Self-Service · Export · Scheduled Reports   │
├─────────────────────────────────────────────────────────────────────┤
│               ANALYTICS SERVING LAYER                               │
│   60s Cache · k-Anon Gate · API Endpoints · PDF/CSV Export          │
├─────────────────────────────────────────────────────────────────────┤
│               ANALYTICS COMPUTATION LAYER                           │
│   Cohort Engine · Trend Engine · Forecast Engine · Ratio Engine     │
├─────────────────────────────────────────────────────────────────────┤
│               ANALYTICS DATA LAYER                                  │
│   ei_snapshot_versions · p4_competency_history · ei_events          │
│   wcl0_user_intelligence · occupation_pathways · learning_records   │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.3 Metric Definitions

#### EI Metrics
| Metric | Definition | Suppression |
|--------|-----------|-------------|
| `avg_ei_score` | Mean EI across cohort | k_min=30 |
| `ei_band_distribution` | % users per band (developing/approaching/near_ready/ready) | k_min=30 |
| `ei_trend_weekly` | Week-on-week avg EI delta | k_min=30 |
| `improving_users_pct` | % users with EI score higher than 30 days prior | k_min=30 |
| `readiness_rate` | % users in 'ready' or 'near_ready' band | k_min=30 |

#### Competency Metrics
| Metric | Definition | Suppression |
|--------|-----------|-------------|
| `competency_coverage_pct` | % competencies with ≥1 score | None |
| `avg_competency_score` | Mean score across all scored competencies | k_min=30 |
| `gap_severity_distribution` | Count of critical/significant/moderate/minor gaps | k_min=30 |
| `velocity_by_competency` | Avg points/week per competency | k_min=30 |

#### Workforce Metrics
| Metric | Definition |
|--------|-----------|
| `talent_density_index` | EI-weighted capability coverage across critical roles |
| `succession_readiness_pct` | % critical roles with ≥1 near_ready successor |
| `retention_risk_score` | Composite of disengagement signals + high EI (flight risk) |
| `bench_strength_index` | Avg successor count × avg readiness per critical role |

#### Learning Metrics
| Metric | Definition |
|--------|-----------|
| `ld_attribution_rate` | % EI improvements attributable to recorded learning |
| `avg_weeks_to_close_gap` | Mean weeks from gap identification to closure |
| `completion_to_gap_ratio` | Completions per identified gap |

### 10.4 Analytics Modules

#### ANA-1: Real-Time Admin Dashboard
**Endpoint pattern:** `/api/admin/ei/{metric}`  
**Cache:** 60s, `?refresh=1` busts  
**Auth:** `requireSuperAdmin`  
**Current endpoints:**
- `/health` — occupation graph, snapshot counts, readiness
- `/trend-analytics` — weekly/monthly EI trend, band distribution
- `/cohort-analytics` — by seniority, domain, target occupation
- `/pathway-analytics` — pathway coverage, difficulty distribution
- `/intelligence-health` — service status per intelligence layer
- `/graph-integrity` — orphan occupations, broken pathways

#### ANA-2: Cohort Analytics Engine
**Input:** Filters (seniority, domain, date range, cohort_id)  
**Output:** Aggregated metrics with k-anonymity enforcement  
**Pattern:** All queries use `HAVING COUNT(DISTINCT user_id) >= 30` guard

#### ANA-3: Trend Intelligence Engine
**Input:** Time-series data from `ei_snapshot_versions`  
**Output:** Per-metric trend with direction, velocity, and forecast  
**Technique:** Linear regression on windowed series; extrapolation at own confidence level  
**Honest ceiling:** Coverage is data-bound (requires ≥2 snapshots per user)

#### ANA-4: Predictive Analytics
**Input:** Historical EI trend + competency velocity  
**Output:** 6/12-month EI forecast at cohort level  
**Constraint:** Forecast = `last + slope × weeks`; no new model; confidence = data confidence of underlying series

#### ANA-5: Export & Delivery
| Format | Use Case |
|--------|---------|
| CSV | Raw metric export for BI tools |
| PDF | Executive report, passports, assessment certificates |
| JSON API | BI tool integration, dashboard embedding |
| Webhook | Event-driven delivery to HRIS/LMS |
| Scheduled email | Weekly/monthly digest |

### 10.5 Analytics Privacy Controls
1. **k-anonymity gate** — all cohort outputs: HAVING COUNT(DISTINCT user_id) >= 30
2. **Suppression** — sub-threshold cohorts return `{ suppressed: true, reason: '...' }` not zero
3. **Differential privacy** — future: add calibrated noise to cohort statistics
4. **Role-based data access** — OrgAdmin sees only own tenant; Individual sees only own data
5. **Audit log** — every analytics API call logged with caller identity

### 10.6 Implementation Sequence
1. Event logging infrastructure (`ei_events` table)
2. Real-time admin health endpoints
3. Trend analytics (weekly/monthly series)
4. Cohort analytics with k-anonymity
5. Self-service dashboard widgets
6. Export (CSV + PDF)
7. Scheduled report delivery
8. Predictive analytics layer

---

## 11. Cross-Cutting Concerns

### 11.1 Feature Flag Governance

**Two distinct flag systems:**

| System | Location | Governs |
|--------|---------|---------|
| File registry | `backend/config/feature-flags.ts` | Additive V2 phases; flag-off → 503 + UI hides |
| DB table | `feature_flags` | Engine-level gates (`signal_intelligence` etc.) |

**Flag-gating rule:** Every additive phase ships behind a flag. Flag-off must be byte-identical to prior behaviour.

### 11.2 Versioning

| Layer | Version Approach |
|-------|-----------------|
| Intelligence services | Semantic version in service constant (`COMPETENCY_INTELLIGENCE_VERSION = '2.0.0'`) |
| API | Date-based version header (`X-API-Version: 2026-06`) |
| EI formula | Explicit dimension version in `ei_snapshot_versions.formula_version` |
| Occupation graph | Seed file named by phase (p3/p4/p5) |

### 11.3 Observability

| Signal | Implementation |
|--------|---------------|
| Health check | `GET /api/admin/ei/health` — composite health with sub-checks |
| Error logging | `console.error` + structured context; never swallows silently |
| Audit events | Append-only `ei_events` table with event_type union |
| Intelligence cache | 60s TTL; `generated_at` timestamp on every response |
| Data quality | Every intelligence response includes `data_quality` object |

### 11.4 Performance Standards

| Endpoint Class | P95 Target |
|----------------|-----------|
| Assessment delivery | < 200ms |
| EI score computation | < 500ms |
| Intelligence endpoints | < 1s (60s cache) |
| Analytics endpoints | < 2s (60s cache) |
| AI narrative generation | < 5s |
| PDF export | < 10s |

---

## 12. Implementation Roadmap

### Phase 1: Assessment Foundation (Months 1-3)
**Milestone:** All assessment types live, scoring deterministic, history append-only
- Competency frameworks (LBI, SDI, custom)
- Adaptive assessment delivery
- Score computation with confidence
- Admin: question curation, framework management

### Phase 2: Employability Intelligence (Months 3-6)
**Milestone:** EI 8-dimension composite, occupation graph, gap analysis operational
- EI engine (8 dimensions)
- Occupation graph (300+ roles)
- Gap analysis with priority scoring
- Longitudinal tracking

### Phase 3: Career Builder (Months 4-8)
**Milestone:** Full career OS — profile, pathways, recommendations, resume intelligence
- Career profile management
- Career OS (aggregated intelligence)
- Pathway recommendations
- Resume studio

### Phase 4: Advanced Intelligence (Months 6-12)
**Milestone:** Future readiness, leadership readiness, comparative intelligence, behavioural insights
- Comparative intelligence (k_min=30)
- Future readiness engine
- Leadership readiness engine
- Behavioural intelligence (CAPADEX BIOS)

### Phase 5: Enterprise Layer (Months 9-15)
**Milestone:** Workforce intelligence, talent analytics, multi-tenant dashboard
- Workforce intelligence (talent density, succession, retention risk)
- Talent analytics dashboard
- Multi-tenant architecture
- HR system integrations

### Phase 6: AI & Certification (Months 12-18)
**Milestone:** AI insights live, passport issued, employer verification API
- AI narrative synthesis
- Pragati conversational coach at scale
- Career passport with W3C VC
- Employer verification API
- Learning system integrations (xAPI/LRS)

### Phase 7: Market Expansion (Months 15-24)
**Milestone:** External labour market signals, O*NET/ESCO bulk import, predictive analytics
- O*NET / ESCO bulk import pipeline
- Labour market signal ingestion
- Predictive workforce analytics
- API platform for third-party embedding

---

## Appendix A: Current Platform State (MetryxOne P-R5)

As of 2026-06-10, MetryxOne has delivered through P-R5:

| Architecture Area | Delivered | Version |
|------------------|-----------|---------|
| Competency Assessment | LBI, SDI, CAPADEX, custom | v2 |
| Employability Index | 8-dimension composite | v2.0.0 |
| Career Builder | Full career OS + CAPADEX bridge | v1 |
| Learning Recommendations | Recommendation engine | v5.0.0 |
| Future Readiness | Seed rows via occupation graph | Partial |
| Leadership Readiness | CAPADEX behavioural signals | Partial |
| Workforce Intelligence | Admin analytics endpoints | Partial |
| Talent Analytics | EI Health Panel (13 tabs) | v3.0.0 |
| AI Insights | Pragati coach, narrative engine | v1 |
| Career Passport | Employability Passport snapshot | v1 |

**EI Platform Certification: 95.6% (P-R5)**

---

## Appendix B: Architecture Decision Records

| ADR | Decision | Rationale |
|-----|---------|-----------|
| ADR-001 | EI formula in single canonical service | Prevent formula drift; auditability requirement |
| ADR-002 | PIL graph namespace `pil_kg_*` | Prevent collision with live Employability `kg_*` table |
| ADR-003 | Express literal routes before `:id` param | Prevent `export.csv` being swallowed by `/:id` handler |
| ADR-004 | Append-only score history tables | Longitudinal integrity; no in-place mutation |
| ADR-005 | k_min=30 on all cohort outputs | Privacy by design; suppress not fabricate |
| ADR-006 | `master_bridge_tag` as clarity join key | `concern_id` join is 0% effective — bucket-level tag is the only working bridge |
| ADR-007 | Strengths only from CSI positive_factors | Signals are concern-DIAGNOSTIC; raw magnitude is never a strength |
| ADR-008 | Flag-gated additive phases | Flag-off = byte-identical to prior; safe incremental rollout |
