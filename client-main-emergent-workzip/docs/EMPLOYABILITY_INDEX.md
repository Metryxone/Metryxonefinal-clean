# MetryxOne Employability Index (MEI v2)
### Full Implementation Reference — Scoring Methodology, Engines, Rules & Dashboard

**Document version:** 2.0  
**Architecture:** MEI v2 — hierarchical, calibrated, rules-driven  
**Last updated:** June 2026  
**Owner:** MetryxOne Career Intelligence  
**Audience:** Product, Engineering, Data, Auditors, Sales  
**Source files:** `backend/services/mei-scoring-engine.ts`, `mei-benchmark-engine.ts`, `mei-narrative-engine.ts`, `mei-recommendation-engine.ts`, `backend/routes/mei-v2.ts`, `backend/migrations/20260611_mei_v2.sql`, `backend/migrations/20260615_mei_v2_seeds.sql`

---

## 1. What is the MEI?

The **MetryxOne Employability Index (MEI)** is a single 0–99 score summarising a candidate's readiness to be shortlisted and hired for roles they target. It is a **weighted, hierarchical composite of evidence-quality signals** drawn from the candidate's career profile, assessments, and behavioural data.

Design principles:
- **Transparent and auditable** — every point traces to a specific profile evidence item via `formula_type` + `trace` JSON
- **Calibrated** — weights shift by industry and role level; the same raw CV means different things in technology vs. healthcare
- **Additive** — the MEI v2 stack is isolated in `mei_*` tables; it never modifies legacy `ei_*` records
- **Graceful degradation** — missing data scores 0 for that competency; the engine never throws or fabricates
- **Hierarchical** — Competency → Subdimension → Dimension → Composite; each level has explicit weights

### Score Bands

| Score | Band | Candidate interpretation |
|------:|------|--------------------------|
| 75–99 | **Hire-Ready** | Strong profile. Prioritise applications, visibility, and interview prep. |
| 50–74 | **Career-Ready** | Solid foundation. Close specific gaps to reach Hire-Ready. |
| 25–49 | **Building** | Active development. Add validated evidence in your weakest dimension. |
| 0–24  | **Getting Started** | Limited signal so far. Complete profile, add skills, take CAPADEX. |

> Score capped at **99**. A verified-100 band is reserved for future audited profiles.

---

## 2. Architecture Overview

```
Career Profile (CareerSeeker)
         │
         ▼
MEIProfileInput  ────────────────────────────────────────────────┐
         │                                                        │
         ▼                                                        │
┌─────────────────────────────────────────────────────────────┐  │
│               SCORING ENGINE  (pure function)                │  │
│                                                              │  │
│  Competency scorer  (16 formula types)                       │  │
│    └─► Subdimension weighted avg                             │  │
│         └─► Dimension weighted avg                           │  │
│              └─► Composite = Σ dim × cal_weight × 100        │  │
│                                                              │  │
│  ┌───────────────────────────────────────────────────────┐  │  │
│  │  CALIBRATION LAYER                                    │  │  │
│  │  industry_code + role_level_code                      │  │  │
│  │  → combined multiplier per dim → renormalise to 1.0   │  │  │
│  └───────────────────────────────────────────────────────┘  │  │
└──────────────────────────┬──────────────────────────────────┘  │
                           │ MEIScoreOutput                       │
              ┌────────────┼───────────────┐                      │
              ▼            ▼               ▼                       │
      BENCHMARK       NARRATIVE      RECOMMENDATION               │
        ENGINE         ENGINE           ENGINE                    │
      (cohort %)    (rules-based)    (gap × effort)              │
              │            │               │                       │
    mei_benchmarks  mei_narratives  mei_user_recommendations      │
```

---

## 3. Dimension Architecture

### 3.1 The 5 Dimensions

| # | Code | Name | Base Weight | Max Points | Primary Signal |
|--:|------|------|------------:|----------:|----------------|
| 1 | `validated_proficiency` | Validated Proficiency | **28%** | 28 | Assessment scores, skills, certifications |
| 2 | `professional_experience` | Professional Experience | **25%** | 25 | Tenure, seniority progression, industry fit |
| 3 | `knowledge_foundation` | Knowledge Foundation | **15%** | 15 | Education degree, institution quality, CPD |
| 4 | `behavioural_intelligence` | Behavioural Intelligence | **22%** | 22 | CAPADEX score, CSI, interpersonal signals |
| 5 | `portfolio_signal` | Portfolio & Presence | **10%** | 10 | Projects, publications, profile completeness |

Weights sum to **100%**. After industry + role calibration they are renormalised so they still sum to 1.0.

### 3.2 The 15 Subdimensions

| Dimension | Subdimension Code | Name | Within-Dim Weight |
|-----------|------------------|------|:-----------------:|
| validated_proficiency | `assessment_performance` | Assessment Performance | 0.45 |
| validated_proficiency | `technical_skill_depth` | Technical Skill Depth | 0.35 |
| validated_proficiency | `credential_credibility` | Credential Credibility | 0.20 |
| professional_experience | `tenure_seniority` | Tenure & Seniority | 0.50 |
| professional_experience | `career_progression` | Career Progression | 0.30 |
| professional_experience | `industry_alignment` | Industry Alignment | 0.20 |
| knowledge_foundation | `degree_rigour` | Degree Rigour | 0.55 |
| knowledge_foundation | `field_relevance` | Field Relevance | 0.25 |
| knowledge_foundation | `continuous_learning` | Continuous Learning | 0.20 |
| behavioural_intelligence | `capadex_profile` | CAPADEX Profile | 0.55 |
| behavioural_intelligence | `interpersonal_competence` | Interpersonal Competence | 0.25 |
| behavioural_intelligence | `adaptive_capacity` | Adaptive Capacity | 0.20 |
| portfolio_signal | `demonstrable_work` | Demonstrable Work | 0.50 |
| portfolio_signal | `professional_visibility` | Professional Visibility | 0.35 |
| portfolio_signal | `social_proof` | Social Proof | 0.15 |

---

## 4. Competency Catalogue (45 Leaf Units)

Each competency is a leaf scoring unit. It specifies a formula type, data field, weight within its subdimension, and an optional gate condition.

### 4.1 Validated Proficiency

#### SD: Assessment Performance (within-dim 0.45)

| Code | Name | SD Weight | Formula | Config | Gated? |
|------|------|:---------:|---------|--------|:------:|
| `core_assessment_score` | Core Competency Assessment | 0.55 | `direct` | scale=100, zero_when_not_taken | ✓ gate: assessment_taken |
| `specialisation_assessment` | Specialisation Assessment | 0.30 | `conditional` | condition=specialisation_taken, scale=100 | ✓ gate: specialisation_taken |
| `leadership_assessment` | Leadership Assessment | 0.15 | `conditional` | condition=leadership_taken, seniority_gate=manager | — |

#### SD: Technical Skill Depth (within-dim 0.35)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `technical_skill_count` | Technical Skill Count | 0.50 | `count_capped` | cap=8, 12.5 pts/unit |
| `tool_proficiency` | Tool & Platform Proficiency | 0.30 | `count_capped` | cap=5, 20 pts/unit |
| `emerging_tech_signal` | Emerging Technology Awareness | 0.20 | `keyword_match` | vocab=emerging_tech, max=3, 33.3 pts/match |

#### SD: Credential Credibility (within-dim 0.20)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `professional_certifications` | Professional Certifications | 0.60 | `tier_weighted` | Top=40, Mid=25, Generic=10, cap=100 |
| `verification_bonus` | Credential Verification Bonus | 0.25 | `multiplier_bonus` | ×1.5 on any verified cert |
| `cert_recency` | Certification Recency | 0.15 | `recency` | full credit ≤1yr, −0.25/yr decay |

### 4.2 Professional Experience

#### SD: Tenure & Seniority (within-dim 0.50)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `years_experience` | Years of Experience | 0.50 | `count_capped` | saturates at 10 yr = 100 pts |
| `peak_seniority` | Peak Seniority Level | 0.35 | `lookup` | C-suite/VP=100, Director=90, Manager=80, Senior=70, Associate=55, Junior=35 |
| `role_tenure_quality` | Role Tenure Quality | 0.15 | `tenure_quality` | optimal=30mo, discount per role <6mo |

#### SD: Career Progression (within-dim 0.30)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `promotion_velocity` | Promotion Velocity | 0.45 | `velocity` | promotions per 3-yr window, max=2 |
| `responsibility_growth` | Responsibility Growth | 0.35 | `slope` | seniority regression slope over career |
| `company_scale_signal` | Company Scale Signal | 0.20 | `tier_weighted` | Tier1=100, Tier2=65, Tier3=35 |

#### SD: Industry Alignment (within-dim 0.20)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `target_industry_match` | Target Industry Match | 0.55 | `percent` | field=target_industry_years_pct |
| `cross_industry_breadth` | Cross-Industry Breadth | 0.25 | `count_capped` | cap=4, 25 pts/industry |
| `domain_depth_signal` | Domain Depth Signal | 0.20 | `ratio` | target_domain_years / total_years × 100 |

### 4.3 Knowledge Foundation

#### SD: Degree Rigour (within-dim 0.55)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `degree_level_score` | Degree Level | 0.45 | `lookup` | PhD=100, Masters=85, Bachelors=65, Diploma=40, Other=30 |
| `institution_quality` | Institution Quality | 0.40 | `lookup` | Tier1=100, Tier2=75, Tier3=50, Unknown=30 |
| `programme_credibility` | Programme Accreditation | 0.15 | `boolean_bonus` | NBA/ABET accredited = 100, else 0 |

#### SD: Field Relevance (within-dim 0.25)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `field_target_alignment` | Field-Role Alignment | 0.60 | `lookup` | Exact=100, Adjacent=70, Transferable=45, Unrelated=20 |
| `multidisciplinary_signal` | Multidisciplinary Signal | 0.25 | `boolean_bonus` | bonus=80 if 2+ fields held |
| `postgrad_specialisation` | Postgraduate Specialisation | 0.15 | `conditional` | has_postgrad → aligned=100, unaligned=40 |

#### SD: Continuous Learning (within-dim 0.20)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `recent_certifications` | Recent Certifications (3yr) | 0.50 | `count_capped` | window=36mo, cap=3, 33.3 pts/unit |
| `course_completion` | Course Completions | 0.30 | `count_capped` | cap=5, 20 pts/unit |
| `learning_velocity` | Learning Velocity | 0.20 | `velocity` | credentials/yr over 3-yr window |

### 4.4 Behavioural Intelligence

#### SD: CAPADEX Profile (within-dim 0.55)

| Code | Name | SD Weight | Formula | Gated? |
|------|------|:---------:|---------|:------:|
| `capadex_score` | CAPADEX Behavioural Score | 0.60 | `direct` scale=100, zero_when_not_taken | ✓ gate: capadex_taken |
| `csi_score` | Career Stage Index (CSI) | 0.30 | `direct` scale=100, default=0 | — |
| `behavioural_consistency` | Behavioural Consistency | 0.10 | `conditional` condition=multi_session | — |

#### SD: Interpersonal Competence (within-dim 0.25)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `soft_skills_breadth` | Soft Skills Breadth | 0.45 | `count_capped` | cap=5, 20 pts/unit |
| `communication_signal` | Communication Signal | 0.35 | `keyword_match` | vocab=communication, max=4, 25 pts/match |
| `collaboration_signal` | Collaboration & Teamwork | 0.20 | `composite` | [keywords 60%, endorsements 40%] |

#### SD: Adaptive Capacity (within-dim 0.20)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `industry_transitions` | Industry Transitions | 0.35 | `count_capped` | cap=3, 33.3 pts/transition |
| `skill_update_recency` | Skill Update Recency | 0.35 | `recency` | full credit ≤6mo, 12mo window |
| `learning_agility_composite` | Learning Agility Composite | 0.30 | `composite` | [recent_certs 50%, capadex_curiosity 50%] |

### 4.5 Portfolio & Presence

#### SD: Demonstrable Work (within-dim 0.50)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `project_count` | Projects & Portfolio | 0.55 | `count_capped` | cap=4, 25 pts/project |
| `publication_signal` | Publications & Thought Leadership | 0.25 | `count_capped` | cap=3, 33.3 pts/publication |
| `open_source_signal` | Open Source & Public Contributions | 0.20 | `boolean_bonus` | bonus=100 if GitHub/portfolio URL present |

#### SD: Professional Visibility (within-dim 0.35)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `profile_completeness` | Profile Completeness | 0.55 | `percent` | field=profile_fill_pct |
| `headline_quality` | Headline & Summary Quality | 0.30 | `text_quality` | min headline=20 chars, summary=100 chars |
| `online_presence` | Online Presence Links | 0.15 | `count_capped` | cap=3, 33.3 pts/link |

#### SD: Social Proof (within-dim 0.15)

| Code | Name | SD Weight | Formula | Config |
|------|------|:---------:|---------|--------|
| `recommendations_received` | Recommendations Received | 0.50 | `count_capped` | cap=4, 25 pts/recommendation |
| `endorsement_signal` | Endorsements & References | 0.30 | `count_capped` | cap=5, 20 pts/endorsement |
| `awards_recognition` | Awards & Recognition | 0.20 | `count_capped` | cap=3, 33.3 pts/award |

---

## 5. Formula Types (16)

| Formula | Logic | Key Config Keys |
|---------|-------|-----------------|
| `direct` | `raw = input × (scale/100)` | `scale`, `zero_when_not_taken`, `default_when_absent` |
| `count_capped` | `raw = min(count, cap) × points_per_unit` | `cap`, `points_per_unit`, `window_months`, `cap_years` |
| `percent` | `raw = field_value` (already 0–100) | `field`, `scale` |
| `lookup` | `raw = mapping[input_value]` | `mapping` dict |
| `tier_weighted` | `raw = Σ tier_pts × tier_count; capped` | `tiers`, `cap` |
| `boolean_bonus` | `raw = bonus_if_true if truthy else default` | `bonus_if_true`, `default` |
| `keyword_match` | `raw = Σ(vocab_matches) × pts_per_match; capped` | `vocab_key`, `max_matches`, `points_per_match` |
| `conditional` | `raw = branch on boolean profile field` | `condition`, branch values |
| `multiplier_bonus` | `raw = base × multiplier if gate true` | `base_multiplier`, `gate` |
| `recency` | `raw = full_credit within window; linear decay beyond` | `window_months`, `full_credit_months`, `decay_per_year` |
| `velocity` | `raw = events/window_period vs. optimal` | `window_years`, `optimal_per_year` |
| `slope` | `raw = regression slope of seniority-level time series` | `method` |
| `composite` | `raw = Σ weighted named sub-sources` | `sources`, `weights` |
| `tenure_quality` | `raw = avg tenure per role with job-hopping discount` | `optimal_months`, `min_months`, `discount_per_short_role` |
| `ratio` | `raw = (numerator / denominator) × scale` | `numerator`, `denominator`, `scale` |
| `text_quality` | `raw = presence + min-length threshold on text fields` | `fields`, `min_length_*` |

---

## 6. Weight Logic

### 6.1 Base Weights

```
validated_proficiency    0.28
professional_experience  0.25
knowledge_foundation     0.15
behavioural_intelligence 0.22
portfolio_signal         0.10
```

All sum to **1.00**. Stored in `mei_dimensions.base_weight`.

### 6.2 Combined Calibration Multiplier

When `industryCode` and/or `roleLevelCode` are provided:

```
if both:      combined[dim] = (industry_mult[dim] + role_mult[dim]) / 2
if one only:  combined[dim] = that_mult[dim]
if neither:   combined[dim] = 1.0
```

### 6.3 Renormalisation

```
cal_weight_raw[dim] = base_weight[dim] × combined[dim]
cal_weight[dim]     = cal_weight_raw[dim] / Σ cal_weight_raw
```

The composite always sums to a max of 100 pts regardless of calibration magnitude.

### 6.4 Score Computation

```
competency_norm = raw_score / max_raw                          ← 0..1

SD_score = Σ(competency_norm × within_sd_weight) / Σ within_sd_weight

dim_score = Σ(SD_score × within_dim_weight) / Σ within_dim_weight

dim_contribution = dim_score × cal_weight × 100

composite = min(Σ dim_contribution, 99)   ← capped at 99
```

---

## 7. Industry Calibration (10 Industries × 5 Dims)

Multipliers listed as (VP, PE, KF, BI, PS) for validated_proficiency, professional_experience, knowledge_foundation, behavioural_intelligence, portfolio_signal:

| Industry Code | Name | VP | PE | KF | BI | PS |
|--------------|------|:--:|:--:|:--:|:--:|:--:|
| `technology` | Technology & Software | 1.35 | 1.10 | 0.75 | 0.90 | 1.30 |
| `finance` | Finance & Banking | 1.35 | 1.15 | 1.15 | 0.80 | 0.65 |
| `healthcare` | Healthcare & Life Sciences | 1.15 | 1.05 | 1.40 | 1.10 | 0.65 |
| `consulting` | Management Consulting | 1.20 | 1.25 | 1.15 | 1.10 | 0.70 |
| `education` | Education & Academia | 0.90 | 0.90 | 1.40 | 1.25 | 1.00 |
| `manufacturing` | Manufacturing & Engineering | 1.20 | 1.30 | 1.05 | 0.85 | 0.75 |
| `retail_fmcg` | Retail & FMCG | 0.85 | 1.20 | 0.85 | 1.20 | 0.85 |
| `media_creative` | Media, Design & Creative | 0.80 | 0.90 | 0.75 | 1.05 | **1.85** |
| `government_psu` | Government & Public Sector | 0.90 | 1.10 | 1.35 | 0.85 | 0.65 |
| `startup_vc` | Startup & Venture | 1.10 | 0.90 | 0.70 | 1.10 | 1.40 |

**Key rationale notes:**
- `media_creative` portfolio = 1.85: portfolio IS the primary hiring signal; after renormalisation it naturally reaches ~18.5% of total
- `education` knowledge_foundation = 1.40: PhD and institutional prestige are the primary hiring gates
- `finance` portfolio = 0.65: confidentiality norms limit public portfolio; credentials dominate instead

---

## 8. Role Calibration (6 Levels × 5 Dims)

| Role Code | Name | YoE Range | VP | PE | KF | BI | PS |
|----------|------|:---------:|:--:|:--:|:--:|:--:|:--:|
| `entry` | Entry Level | 0–2 yr | 1.05 | 0.60 | 1.55 | 1.20 | 1.30 |
| `junior` | Junior Professional | 2–4 yr | 1.10 | 0.85 | 1.20 | 1.10 | 1.10 |
| `mid` | Mid-Level Professional | 4–8 yr | 1.20 | 1.10 | 1.00 | 1.00 | 1.00 |
| `senior` | Senior Professional | 8–12 yr | 1.20 | 1.20 | 0.85 | 1.00 | 0.90 |
| `manager` | Manager / Team Lead | 6+ yr | 0.90 | 1.25 | 0.80 | 1.35 | 0.80 |
| `director` | Director & Above | 10+ yr | 0.80 | 1.30 | 0.75 | 1.40 | 0.70 |

**Key rationale notes:**
- `entry` knowledge_foundation = 1.55: education is the primary differentiator; experience de-weighted (0.60) to avoid penalising recent graduates
- `director` behavioural_intelligence = 1.40: executive presence and cultural leadership are the primary differentiators at that level
- `manager` professional_experience = 1.25: people-management track record and team outcomes are the core signal

---

## 9. Scoring Engine

**File:** `backend/services/mei-scoring-engine.ts`

### 9.1 Profile Input (`MEIProfileInput`)

```typescript
interface MEIProfileInput {
  // Assessment
  assessmentScore?: number | null;       // 0-100
  specialisationScore?: number | null;
  leadershipScore?: number | null;
  assessmentTaken?: boolean;
  capadexScore?: number | null;
  capadexTaken?: boolean;
  csiScore?: number | null;
  sessionCount?: number;

  // Skills
  technicalSkills?: string[];
  softSkills?: string[];
  tools?: string[];
  skillsText?: string;
  softSkillsText?: string;
  skillUpdatedAt?: string | null;

  // Experience
  totalMonths?: number;
  peakSeniority?: string;              // c_suite|vp|director|manager|senior|associate|junior
  roleHistory?: Array<{ title: string; months: number; company?: string; industry?: string; seniority?: string }>;
  uniqueIndustries?: string[];
  targetIndustry?: string | null;
  targetIndustryYearsPct?: number;     // 0-100

  // Education
  highestDegree?: string;              // phd|masters|bachelors|diploma|other
  bestInstitutionTier?: string;        // tier1|tier2|tier3|unknown
  fieldAlignment?: string;             // exact|adjacent|transferable|unrelated
  programmeAccredited?: boolean;
  multiField?: boolean;
  hasPostgrad?: boolean;
  postgradField?: string;

  // Certifications
  certifications?: Array<{ name: string; tier: 'top'|'mid'|'generic'; verified?: boolean; earned_date?: string }>;
  courses?: number;

  // Portfolio
  projectCount?: number;
  publicationCount?: number;
  hasGithub?: boolean;
  recommendationCount?: number;
  endorsementCount?: number;
  awardCount?: number;
  profileLinks?: string[];

  // Profile
  profileFillPct?: number;             // 0-100
  headline?: string;
  summary?: string;

  // Calibration
  industryCode?: string | null;
  roleLevelCode?: string | null;
}
```

### 9.2 Computation Steps

1. Load taxonomy from DB (in-memory cache, invalidated on admin weight changes)
2. Load calibration multipliers for `industryCode` + `roleLevelCode`
3. Compute combined multiplier per dimension (average when both present)
4. Renormalise → `cal_weights` that sum to 1.0
5. For each dimension → subdimension → competency: call `scoreCompetency(comp, profile)` → `{ raw, trace, gate_met }`
6. Normalise: `norm = raw / max_raw`
7. Accumulate weighted sums at SD level, then dim level, then composite
8. Confidence = fraction of weighted gate-slots fulfilled
9. Band classification: ≥75 hire_ready · ≥50 career_ready · ≥25 building · else getting_started
10. Return `MEIScoreOutput` — pure function, no DB side effects

### 9.3 Score Output (`MEIScoreOutput`)

```typescript
interface MEIScoreOutput {
  composite_score:   number;       // 0..99 (capped)
  band:              'getting_started'|'building'|'career_ready'|'hire_ready';
  confidence:        number;       // 0..1 — fraction of gated competencies fulfilled
  industry_code:     string | null;
  role_level_code:   string | null;
  dimensions:        DimensionScore[];  // full hierarchy
  calibration_trace: {
    raw_weights:  Record<string,number>;
    cal_weights:  Record<string,number>;
    sum_check:    number;           // should equal 1.0
  };
  data_sources:      string[];     // profile fields that contributed > 0
  version:           '2.0';
}
```

### 9.4 Confidence Model

```
confidence = Σ (within_sd_weight × within_dim_weight) for gated-fulfilled comps
             ─────────────────────────────────────────────────────────────────
             Σ (within_sd_weight × within_dim_weight) for ALL comps
```

Ungated competencies always count as fulfilled. A profile with no assessments taken yields confidence ≈ 0.65 (gated slots ≈ 35% of total weight). Displayed in the UI as "Based on X / Y data points" or a confidence band badge.

---

## 10. Benchmark Engine

**File:** `backend/services/mei-benchmark-engine.ts`

### 10.1 Cohort Key

```
cohort_key = "{industry_code}:{role_level_code}:{yoe_band}"
yoe_band   = "0-2" | "2-5" | "5-10" | "10+"
```

`null` values are substituted with `"any"`: e.g., `"technology:any:2-5"`.

### 10.2 7-Level Fallback Cascade

When exact cohort has `sample_size < K_MIN`:

1. `industry:role:yoe` — exact
2. `industry:role:any`
3. `industry:any:yoe`
4. `any:role:yoe`
5. `industry:any:any`
6. `any:role:any`
7. `any:any:any` — global baseline

### 10.3 k-Anonymity

`K_MIN = 10` during warm-up (relaxed for launch data); long-term target = 30. Any cohort with `sample_size < K_MIN` returns `suppressed: true`.

### 10.4 Percentile Interpolation

Uses piecewise linear interpolation across `p25/p50/p75/p90` breakpoints. Normal approximation handles tails.

### 10.5 Benchmark Output

```typescript
interface BenchmarkResult {
  cohort_key:       string;
  sample_size:      number;
  percentile_rank:  number | null;    // null when suppressed
  gap_to_median:    number | null;    // composite − p50
  gap_to_p75:       number | null;
  p25, p50, p75, p90: number | null;
  mean, std_dev:    number | null;
  dimension_gaps:   Array<{
    dimension_code: string;
    user_score:     number;           // × 100 (percentage)
    cohort_p50:     number;
    gap:            number;           // user − cohort_p50
  }>;
  suppressed:       boolean;
  suppression_reason?: string;        // 'no_cohort_data' | 'cohort_too_small(n=N,min=K)'
}
```

### 10.6 Benchmark Refresh

`refreshCohortBenchmark(pool, industryCode, roleLevelCode, yoeBand)` aggregates live `mei_scores` into `mei_benchmarks`. Called via `POST /api/admin/mei/benchmark/refresh` — **never in the request path**. Target: nightly cron or after batch scoring events.

---

## 11. Narrative Engine

**File:** `backend/services/mei-narrative-engine.ts`

Rules-based and fully deterministic. No LLM. Every output traces to a specific `mei_insight_rules` row via `rules_fired[]`.

### 11.1 Five Output Layers

| # | Layer | Source | Max Count |
|--:|-------|--------|:---------:|
| 1 | `band_narrative` | `rule_type='band'`, audience match, highest priority | 1 |
| 2 | `strength_narratives` | `rule_type='dimension_strength'`, top 2 dims ≥ 70% | 2 |
| 3 | `gap_narratives` | `rule_type='dimension_gap'`, bottom 2 dims ≤ 40% | 2 |
| 4 | `composite_insights` | `rule_type='composite_insight'`, matching type | 3 |
| 5 | `action_directive` | `mei_recommendation_master` display_order=1 with CTA text | 1 |

### 11.2 Three Audiences

| Audience | Register | Typical consumer |
|----------|----------|-----------------|
| `candidate` | Motivational, first-person, developmental | Career Builder dashboard |
| `counselor` | Clinical, direct, gap-focused | Counselor/coach view |
| `employer` | Structured, evidence-focused, brief | Recruiter shortlist panel |

### 11.3 Rule Matching Logic

| rule_type | trigger_field | trigger_operator | Value compared against |
|-----------|--------------|-----------------|----------------------|
| `band` | `"band"` | `eq` | `score.band` (string) |
| `dimension_strength` | dimension code | `gte` / `lte` / `between` | `dim.score × 100` |
| `dimension_gap` | dimension code | `gte` / `lte` / `between` | `dim.score × 100` |
| `composite_insight` | `"composite"` | `any` | JSON `{type}` discriminator |

Composite insight `type` discriminators:
- `assessment_not_taken` — `core_assessment_score.gate_met === false`
- `profile_incomplete` — `portfolio_signal.score < 0.5`
- `high_exp_low_cred` — experience ≥ 60% AND proficiency < 45%
- `multi_session` — `sessionCount > 1`
- `career_change` — `uniqueIndustries > 2`

### 11.4 Template Tokens

| Token | Value |
|-------|-------|
| `{{score}}` | Composite score (0–99) |
| `{{band}}` | Human-readable band name |
| `{{dim_score}}` | Dimension score × 100 (in dimension rules) |
| `{{max_gain}}` | Max possible point gain from this dimension |
| `{{top_gap_action}}` | Title of top recommendation |
| `{{rec_1}}` / `{{rec_2}}` / `{{rec_3}}` | Top 3 recommendation titles |
| `{{weakest_dimension}}` | Name of lowest-scoring dimension |
| `{{top_3_gaps}}` | Comma-separated names of 3 weakest dimensions |
| `{{percentile}}` | Cohort percentile (if available) |
| `{{cohort_size}}` | Cohort sample size |
| `{{fill_pct}}` | portfolio_signal score × 100 |
| `{{capadex_points}}` | Potential points from taking CAPADEX |
| `{{session_count}}` | Number of CAPADEX sessions taken |

---

## 12. Recommendation Engine

**File:** `backend/services/mei-recommendation-engine.ts`

### 12.1 Priority Formula

```
priority_score = (impact_score + gate_bonus) × (1 − effort_score) × confidence

impact_score  = min(cal_weight[dim] × gap_magnitude × 5, 1.0)
gap_magnitude = max(0, 1 − dim_score)         // room for improvement
effort_score  = low=0.10 | medium=0.40 | high=0.80
gate_bonus    = +0.30 if action_type ∈ {take_assessment, capadex}
                 AND any gated competency is unfulfilled
```

### 12.2 Point Impact

```
point_impact = estimated_point_gain × gap_magnitude
```

Realistic available gain, discounted by how much gap already exists.

### 12.3 Sort Order

1. Un-actioned before actioned
2. By `priority_score` descending
3. Persisted to `mei_user_recommendations` with UPSERT on `(user_id, recommendation_id)`

---

## 13. Master Tables Schema

### `mei_dimensions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `code` | TEXT UNIQUE | stable key |
| `name`, `short_name`, `description`, `rationale` | TEXT | |
| `base_weight` | NUMERIC(5,4) | 0..1, all rows sum to 1 |
| `max_points` | NUMERIC(5,2) | = base_weight × 100 |
| `icon_key`, `color_hex` | TEXT | UI rendering |
| `display_order` | INT | |
| `is_active` | BOOLEAN | |

### `mei_subdimensions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `dimension_id` | INT FK → mei_dimensions | |
| `code` | TEXT UNIQUE | |
| `name`, `description` | TEXT | |
| `within_dim_weight` | NUMERIC(5,4) | sums to 1 within parent dim |
| `data_sources` | TEXT[] | |
| `display_order` | INT | |

### `mei_competencies`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `subdimension_id` | INT FK | |
| `code` | TEXT UNIQUE | |
| `name`, `description` | TEXT | |
| `within_sd_weight` | NUMERIC(5,4) | sums to 1 within parent SD |
| `formula_type` | TEXT | one of 16 types |
| `formula_config` | JSONB | formula parameters |
| `data_field` | TEXT | primary profile field |
| `max_raw` | NUMERIC(8,2) | default 100 |
| `is_gated` | BOOLEAN | if true, gate_condition must be met |
| `gate_condition` | TEXT | boolean profile field name |

### `mei_industry_calibration`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `industry_code`, `industry_name` | TEXT | |
| `dimension_id` | INT FK | |
| `multiplier` | NUMERIC(5,3) | default 1.0, typical range 0.6–1.9 |
| `rationale` | TEXT | |
| UNIQUE | `(industry_code, dimension_id)` | |

### `mei_role_calibration`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `role_level_code`, `role_level_name` | TEXT | |
| `yoe_min` | INT | NULL = no lower bound |
| `yoe_max` | INT | NULL = no upper bound |
| `dimension_id` | INT FK | |
| `multiplier` | NUMERIC(5,3) | |
| UNIQUE | `(role_level_code, dimension_id)` | |

### `mei_insight_rules`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `rule_type` | TEXT | `band`\|`dimension_strength`\|`dimension_gap`\|`composite_insight` |
| `trigger_field` | TEXT | `band`\|dim_code\|`composite` |
| `trigger_operator` | TEXT | `eq`\|`gte`\|`lte`\|`between`\|`any` |
| `trigger_value` | JSONB | comparison value or object |
| `narrative_template` | TEXT | with `{{token}}` placeholders |
| `tone` | TEXT | `direct`\|`motivational`\|`supportive` |
| `audience` | TEXT | `candidate`\|`counselor`\|`employer` |
| `priority` | INT | higher = checked first |
| `is_active` | BOOLEAN | |

### `mei_recommendation_master`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `code` | TEXT UNIQUE | |
| `title` | TEXT | short action title |
| `description` | TEXT | explanation + expected outcome |
| `action_type` | TEXT | `capadex`\|`take_assessment`\|`add_skills`\|`get_cert`\|`complete_profile`\|`add_projects`\|`add_experience`\|`update_profile` |
| `target_dimension` | INT FK → mei_dimensions | NULL = cross-dimensional |
| `target_subdimension` | INT FK → mei_subdimensions | NULL = whole dimension |
| `estimated_point_gain` | NUMERIC(5,2) | at full gap; actual = gain × gap_magnitude |
| `effort_level` | TEXT | `low`\|`medium`\|`high` |
| `time_to_complete` | TEXT | human string |
| `link_path` | TEXT | in-app deep link |
| `display_order` | INT | priority tie-break |
| `is_active` | BOOLEAN | |

---

## 14. Calculation Tables Schema

### `mei_scores` — Latest score per user

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | TEXT UNIQUE | FK → career_seeker_profiles |
| `composite_score` | NUMERIC(5,2) | |
| `band` | TEXT | |
| `confidence` | NUMERIC(5,4) | |
| `industry_code`, `role_level_code` | TEXT | calibration context at compute time |
| `breakdown` | JSONB | full MEIScoreOutput |
| `computed_at` | TIMESTAMPTZ | |

UPSERT on `user_id` — always reflects the most recent computation.

### `mei_score_history` — Append-only log

Same shape as `mei_scores`, no uniqueness constraint. Every computation is appended. Used for trend analysis and trajectory visualisation.

### `mei_competency_scores` — Per-competency snapshot

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | TEXT | |
| `competency_id` | INT FK | |
| `raw_score`, `norm_score` | NUMERIC | |
| `gate_met` | BOOLEAN | |
| `trace` | JSONB | full formula input/output trace |
| `computed_at` | TIMESTAMPTZ | |
| UNIQUE | `(user_id, competency_id)` | |

### `mei_benchmarks` — Cohort aggregates

| Column | Type | Notes |
|--------|------|-------|
| `cohort_key` | TEXT UNIQUE PK | `industry:role:yoe_band` |
| `sample_size` | INT | must be ≥ K_MIN to serve |
| `p25`, `p50`, `p75`, `p90` | NUMERIC(5,2) | |
| `mean`, `std_dev` | NUMERIC(7,4) | |
| `dimension_p50` | JSONB | `Record<dim_code, number>` |
| `refreshed_at` | TIMESTAMPTZ | |

### `mei_user_recommendations` — Computed per user

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | TEXT | |
| `recommendation_id` | INT FK | |
| `priority_score` | NUMERIC(7,4) | |
| `point_impact` | NUMERIC(5,2) | |
| `is_actioned` | BOOLEAN | |
| `actioned_at` | TIMESTAMPTZ | |
| UNIQUE | `(user_id, recommendation_id)` | |

### `mei_narratives` — Generated narrative cache

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | TEXT | |
| `audience` | TEXT | |
| `band_narrative`, `action_directive` | TEXT | |
| `strength_narratives`, `gap_narratives` | JSONB | |
| `composite_insight` | TEXT | |
| `generated_at` | TIMESTAMPTZ | |
| `score_snapshot` | NUMERIC(5,2) | composite score at generation time |
| UNIQUE | `(user_id, audience)` | |

---

## 15. Insight Rules Catalogue (v2.0 — 30 rules)

### Candidate Band Rules (4)

| Band | Template summary |
|------|-----------------|
| hire_ready | "Your EI of {{score}} puts you in the Hire-Ready band — the top tier…" |
| career_ready | "At {{score}}, you're Career-Ready — {{top_gap_action}} can add the most points." |
| building | "Your score of {{score}} — Building. Three most impactful next steps: {{rec_1}}, {{rec_2}}, {{rec_3}}." |
| getting_started | "Every profile starts somewhere. Start with quick wins: complete profile, add skills, take CAPADEX." |

### Candidate Dimension Strength Rules (5 — one per dimension, trigger ≥ 70%)

| Dimension | Template summary |
|-----------|-----------------|
| validated_proficiency | "Your Validated Proficiency of {{dim_score}} is a genuine differentiator." |
| professional_experience | "Your Professional Experience depth of {{dim_score}} — track record speaks for itself." |
| knowledge_foundation | "Your Knowledge Foundation of {{dim_score}} — academic credentials create strong first-impression trust." |
| behavioural_intelligence | "Your Behavioural Intelligence of {{dim_score}} — CAPADEX shows how you operate; progressive employers value this." |
| portfolio_signal | "Your Portfolio & Presence of {{dim_score}} — work is visible and substantiated." |

### Candidate Dimension Gap Rules (5 — one per dimension, trigger ≤ 40%)

| Dimension | Template summary |
|-----------|-----------------|
| validated_proficiency | "VP at {{dim_score}} — taking the assessment alone can add up to {{max_gain}} pts." |
| professional_experience | "Experience signal at {{dim_score}} — documenting your full role history unlocks {{max_gain}} pts." |
| knowledge_foundation | "KF at {{dim_score}} — a recent professional certification is the fastest lever here." |
| behavioural_intelligence | "BI low — CAPADEX not yet taken. Unlocks up to {{max_gain}} pts." |
| portfolio_signal | "Portfolio at {{dim_score}} — add projects and complete your profile summary." |

### Candidate Composite Insight Rules (5)

| Type | Trigger | Template summary |
|------|---------|-----------------|
| assessment_not_taken | CAPADEX gate not met | "CAPADEX not taken yet — can add {{capadex_points}} pts." |
| profile_incomplete | portfolio_signal < 50% | "Profile {{fill_pct}}% complete — finish in under 10 minutes." |
| high_exp_low_cred | exp ≥ 60% and VP < 45% | "Strong experience but credentials haven't kept pace — a cert would reinforce your track record." |
| multi_session | sessionCount > 1 | "Your consistency across multiple CAPADEX sessions strengthens your behavioural signal." |
| career_change | uniqueIndustries > 2 | "Your cross-industry experience is an adaptability signal — make sure it's explicit on your profile." |

### Counselor Rules (5)

| Band / Dim | Template summary |
|-----------|-----------------|
| hire_ready band | "Candidate is Hire-Ready ({{score}}). Focus: interview prep and job targeting." |
| career_ready band | "Career-Ready ({{score}}). Recommend closing {{weakest_dimension}} gap before placement." |
| building band | "Building band ({{score}}). Primary gaps: {{top_3_gaps}}. Focus: evidence-building in {{weakest_dimension}}." |
| VP gap ≤ 40% | "Low Validated Proficiency. Intervention priority: formal assessment or skills validation before placement." |
| BI gap ≤ 35% | "Behavioural intelligence signals absent. Recommend CAPADEX session before placement." |

### Employer Rules (6)

| Trigger | Template summary |
|---------|-----------------|
| hire_ready | "Candidate MEI {{score}} — Hire-Ready. Assessment scores and credentials confirm role-fit." |
| career_ready | "MEI {{score}} — Career-Ready. Strong track record with development areas in {{weakest_dimension}}." |
| building | "MEI {{score}} — Building. Profile under active development; suitable for training-entry roles." |
| VP strength ≥ 70% | "Validated Proficiency {{dim_score}} — skill depth and credentialing are strong shortlist signals." |
| PE strength ≥ 70% | "Professional Experience {{dim_score}} — track record and tenure align to role expectations." |
| BI strength ≥ 70% | "Behavioural Intelligence {{dim_score}} — CAPADEX validated; behavioural fit confirmed." |

---

## 16. Recommendation Catalogue (v2.0 — 15 entries)

| # | Code | Title | Effort | Est. Gain | Time | Dimension |
|--:|------|-------|:------:|:---------:|------|-----------|
| 1 | `take_capadex` | Complete CAPADEX Assessment | Low | +12 pts | 35 min | behavioural_intelligence |
| 2 | `take_competency_assessment` | Take Competency Assessment | Medium | +10 pts | 45–60 min | validated_proficiency |
| 3 | `add_technical_skills` | Add Technical Skills (up to 8) | Low | +5 pts | 15 min | validated_proficiency |
| 4 | `earn_top_cert` | Earn a Top-Tier Certification | High | +4 pts | 4–12 wk | validated_proficiency |
| 5 | `add_full_experience` | Document Complete Role History | Low | +3 pts | 20 min | professional_experience |
| 6 | `take_leadership_assessment` | Take Leadership Assessment | Medium | +3 pts | 30 min | validated_proficiency |
| 7 | `complete_profile` | Complete Profile to 100% | Low | +2.5 pts | 15 min | portfolio_signal |
| 8 | `add_projects` | Document Your Projects (up to 4) | Low | +2 pts | 20 min | portfolio_signal |
| 9 | `earn_recent_cert` | Add a Recent Certification (3yr) | Medium | +1.5 pts | 2–4 wk | knowledge_foundation |
| 10 | `add_soft_skills` | Add Interpersonal & Soft Skills | Low | +1.5 pts | 10 min | behavioural_intelligence |
| 11 | `request_recommendations` | Request 2+ Written Recommendations | Medium | +1.5 pts | 1–2 days | portfolio_signal |
| 12 | `document_publications` | Add Publications or Thought Leadership | Medium | +1.5 pts | 30 min | portfolio_signal |
| 13 | `add_headline_summary` | Write Professional Headline & Summary | Low | +1 pts | 20 min | portfolio_signal |
| 14 | `add_online_presence` | Add LinkedIn & Portfolio Links | Low | +1 pts | 10 min | portfolio_signal |
| 15 | `update_skills_recently` | Update Your Skills List (12-month refresh) | Low | +1 pts | 10 min | behavioural_intelligence |

---

## 17. API Reference

### User-Facing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mei/score/:userId` | Compute (or return cached) MEI score |
| GET | `/api/mei/breakdown/:userId` | Full hierarchical score breakdown |
| GET | `/api/mei/benchmark/:userId` | Cohort percentile and dimension gaps |
| GET | `/api/mei/narrative/:userId?audience=candidate\|counselor\|employer` | Generated narrative |
| GET | `/api/mei/recommendations/:userId` | Prioritised recommendation list |
| POST | `/api/mei/recommendations/:userId/:recId/action` | Mark recommendation as actioned |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/mei/dimensions` | List dimensions |
| PATCH | `/api/admin/mei/dimensions/:id` | Update weight / active status |
| GET | `/api/admin/mei/subdimensions` | List subdimensions |
| GET | `/api/admin/mei/competencies` | List competencies (optional `?subdimension_id=`) |
| GET | `/api/admin/mei/calibration/industry` | List industry calibration |
| PATCH | `/api/admin/mei/calibration/industry/:id` | Update multiplier |
| GET | `/api/admin/mei/calibration/role` | List role calibration |
| PATCH | `/api/admin/mei/calibration/role/:id` | Update multiplier |
| GET | `/api/admin/mei/insight-rules` | List insight rules |
| POST | `/api/admin/mei/insight-rules` | Create rule |
| PATCH | `/api/admin/mei/insight-rules/:id` | Update rule |
| DELETE | `/api/admin/mei/insight-rules/:id` | Soft-delete rule |
| GET | `/api/admin/mei/recommendations` | List recommendation master |
| POST | `/api/admin/mei/recommendations` | Create recommendation |
| PATCH | `/api/admin/mei/recommendations/:id` | Update recommendation |
| DELETE | `/api/admin/mei/recommendations/:id` | Soft-delete recommendation |
| GET | `/api/admin/mei/scores` | Platform score overview + band distribution |
| POST | `/api/admin/mei/benchmark/refresh` | Trigger cohort aggregate refresh |

---

## 18. Dashboard Requirements

### 18.1 User-Facing MEI Dashboard

**Component:** `frontend/src/components/career/MEIDashboard.tsx`

#### A. Score Panel
- Circular gauge (0–99) with animated fill on mount
- Band chip (hire_ready=green, career_ready=blue, building=yellow, getting_started=gray)
- Confidence badge ("Based on N / M data points") — surfaces how complete the profile is
- Last computed timestamp

#### B. Dimension Breakdown
- 5 horizontal progress bars (VP=indigo, PE=sky, KF=emerald, BI=amber, PS=violet)
- Label shows "18 / 28 pts" (contribution / max_points)
- Subdimension drill-down (expandable) showing SD scores
- Calibration note when industry/role set: "Calibrated for Technology · Senior"

#### C. Recommendations Panel
- Ranked list of top 6 un-actioned recommendations
- Effort badge (low=green, medium=yellow, high=red)
- Estimated point gain chip
- Time-to-complete
- Deep-link CTA button to the relevant section
- "Mark as done" toggle

#### D. Narrative Panel
- Band narrative paragraph
- Up to 2 strength callout chips (green)
- Up to 2 gap callout chips (amber)
- Up to 3 composite insight banners
- Action directive card with CTA

#### E. Benchmark Panel *(shown only when cohort data available)*
- Percentile rank (e.g., "Top 32%")
- Cohort label ("Technology · Senior · 5–10yr YoE")
- Gap-to-median and gap-to-p75 delta indicators
- 5-bar dimension gap chart vs. cohort p50
- Sample size disclosure
- Suppressed state message when `suppressed: true`

#### F. Score History *(shown when ≥ 2 history records exist)*
- Line sparkline over time
- Band transition markers

#### State Variants
| State | Display |
|-------|---------|
| Loading | Skeleton loaders for all panels |
| No profile data | Prompt card: "Complete your Career Builder profile to calculate your MEI" |
| Low confidence | Banner: "Score based on limited data — add more profile signal" |
| Suppressed benchmark | "Cohort data not yet available for your profile" |

### 18.2 Super Admin MEI Design Panel

**Component:** `frontend/src/components/superadmin/MEIDesignPanel.tsx`
**Nav:** Super Admin Dashboard → tab id `mei-v2-design`

| Tab | Content | Actions |
|-----|---------|---------|
| `overview` | Platform stats (total scored, avg, band distribution), recent scores | Benchmark refresh |
| `taxonomy` | Expandable tree: dimension → SD → competency | Edit weights, toggle active |
| `calibration` | Industry grid + role grid, inline editable multipliers | PATCH on blur |
| `insights` | Rules table grouped by rule_type, paginated | Add rule, edit template, soft-delete |
| `scores` | Per-user recent score table | Benchmark refresh |

---

## 19. Data Sources

| Profile Source | Fields Fed To |
|---------------|---------------|
| `skills.technical` | technical_skill_count, emerging_tech_signal |
| `skills.soft` | soft_skills_breadth, communication_signal |
| `skills.tools` | tool_proficiency |
| `skillUpdatedAt` | skill_update_recency |
| `experience[]` | years_experience, peak_seniority, role_tenure_quality, promotion_velocity, responsibility_growth, company_scale_signal, target_industry_match, cross_industry_breadth, domain_depth_signal |
| `education[]` | degree_level_score, institution_quality, programme_credibility, field_target_alignment, multidisciplinary_signal, postgrad_specialisation |
| `certifications[]` | professional_certifications, verification_bonus, cert_recency, recent_certifications |
| `courses` | course_completion, learning_velocity |
| `projects[]` | project_count |
| `publications` | publication_signal |
| `githubUrl`, `portfolioUrl` | open_source_signal, online_presence |
| `linkedinUrl` | online_presence |
| `profileFillPct` | profile_completeness |
| `headline`, `summary` | headline_quality |
| `recommendations`, `endorsements`, `awards` | social_proof SD |
| `competency_assessments.score` | core_assessment_score |
| `capadex_reports` | capadex_score, behavioural_consistency |
| `wcl0_user_intelligence` | csi_score |

---

## 20. Language Policy

The MEI is a **developmental signal tool**, not a hiring decision engine.

**Allowed:**
- "Your employability signal for roles you target"
- "Readiness to be shortlisted"
- "Points available if you complete X action"
- "Your cohort percentile among Y similar profiles"

**Prohibited:**
- Definitive hire/reject predictions for a specific employer
- Personality or character judgements from score alone
- Ranking named candidates against each other
- Fabricated scores or narratives when profile data is absent
- Treating MEI as a substitute for structured interviews or skills tests

---

## 21. Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | May 2026 | 8-dimension flat model in `ei_*` tables, legacy scoring formulas |
| v2.0 | June 2026 | 5-dimension hierarchical model, 15 subdimensions, 45 competencies, 16 formula types, industry+role calibration, 4 dedicated engines, separate `mei_*` namespace, insight rules, recommendation master |
