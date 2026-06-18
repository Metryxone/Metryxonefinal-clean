# Competency Assessment Factory (CAF) — Implementation-Ready Specification

> **Status**: Spec v2.0 — implementation files generated  
> **Prefix**: `caf_*` tables · `/api/caf/*` routes  
> **Services**: `backend/services/caf/`  
> **Routes**: `backend/routes/caf/`  
> **Migration**: `backend/migrations/20260613_competency_assessment_factory.sql`  
> **Flag**: `FF_COMPETENCY_ASSESSMENT_FACTORY=1`

---

## 0. Architecture

```
Ontology Layer        CAF Content Layer            CAF Runtime Layer         Analytics Layer
──────────────   ──────────────────────────────   ──────────────────────   ─────────────────
onto_* tables    caf_question_bank               caf_sessions             caf_item_stats
bench_* tables   caf_scenarios / branches        caf_responses            caf_psychometric_
p4_*             caf_difficulty_calibrations     caf_scores               calibrations
                 caf_level_frameworks / anchors  (scoring engine)
                 caf_assessments / sections /    (randomization engine)
                 section_questions               (session manager)
                 caf_randomization_rules
                 caf_score_rules
```

**Factory pattern**: One configurable engine produces all five types. Type-specific behaviour is data-driven (scoring model enum + scoring_config JSONB) — no code forks.

---

## 1. Five Assessment Types

| Code | Label | Scoring Model | Adaptive CAT | Domain Set |
|------|-------|--------------|-------------|------------|
| `behavioral` | Behavioural | BARS_RUBRIC | No | COG · COM · LEA · EXE · ADP · TEC · EIQ |
| `functional` | Functional | WEIGHTED_CTT | Optional 2PL | Role-specific functional domains |
| `cognitive` | Cognitive | IRT_3PL | Yes (EAP-CAT) | COG_VRB · COG_NUM · COG_ABS · COG_SPA · COG_WMM |
| `leadership` | Leadership | SJT_EXPERT + BARS | No | LEA_VIS · LEA_PEO · LEA_DEC · LEA_CHG · LEA_EXE · LEA_INF |
| `future_readiness` | Future Readiness | DIMENSIONAL | No | FR_AIF · FR_DGA · FR_LAG · FR_SYS · FR_FUT |

### 1.1 New Domain Codebooks

**Cognitive**
| Code | Label |
|------|-------|
| `COG_VRB` | Verbal Reasoning — analogies, logical deduction from text |
| `COG_NUM` | Numerical Reasoning — tables, ratios, percentage change |
| `COG_ABS` | Abstract Reasoning — pattern completion, matrix problems |
| `COG_SPA` | Spatial Reasoning — mental rotation, 3D unfolding |
| `COG_WMM` | Working Memory — sequence recall, dual-task interference |

**Leadership**
| Code | Label |
|------|-------|
| `LEA_VIS` | Strategic Vision — direction-setting, opportunity identification |
| `LEA_PEO` | People Development — coaching, feedback, psychological safety |
| `LEA_DEC` | Decision Making — under ambiguity, data-incomplete situations |
| `LEA_CHG` | Change Leadership — resistance management, cultural shaping |
| `LEA_EXE` | Execution Excellence — accountability, resource allocation |
| `LEA_INF` | Stakeholder Influence — coalition building, executive presence |

**Future Readiness**
| Code | Label |
|------|-------|
| `FR_AIF` | AI Fluency — workflow integration, prompt design, AI limits |
| `FR_DGA` | Digital Adaptability — new tool adoption, platform agility |
| `FR_LAG` | Learning Agility — unlearn-relearn rate, curiosity operationalised |
| `FR_SYS` | Systemic Thinking — second-order effects, complexity navigation |
| `FR_FUT` | Future Orientation — scenario planning, ambiguity tolerance |

---

## 2. Question Framework

### 2.1 Question Type Taxonomy

| Code | Description | Response Format | Scoring |
|------|-------------|-----------------|---------|
| `MCQ` | Single-select | `{selected_option_id}` | binary correct |
| `MULTI_SELECT` | Multiple correct (partial) | `{selected_ids:[]}` | precision-recall mean |
| `LIKERT` | 5-point agreement/frequency | `{rating:1-5}` | (rating-1)/4 |
| `BARS_RATING` | Behavioural Anchored Rating Scale | `{level:1-5}` | rubric.levels[level].score |
| `SITUATIONAL_JUDGMENT` | Pick best/worst | `{best_id, worst_id}` | expert key |
| `SCENARIO_MCQ` | MCQ inside scenario | `{selected_option_id}` | binary correct |
| `PRIORITIZATION` | Rank N items | `{rankings:[{id,rank}]}` | Spearman ρ vs expert key |
| `DATA_INTERPRETATION` | Read data artefact + MCQ | `{selected_option_id}` | binary correct |
| `OPEN_RUBRIC` | Free text with 5-level rubric | `{text:string}` | rubric grade (AI/human) |
| `COMPARATIVE_JUDGMENT` | A vs B preference | `{preferred_id}` | Bradley-Terry win prob |
| `KNOWLEDGE_PROBE` | True/False + confidence | `{answer:bool, confidence:1-5}` | 1 − Brier score |

Every question carries:
- `assessment_type` — restricts to which factory type it appears in
- `competency_id` / `indicator_id` — nullable FKs to `onto_*` tables
- `level_code` — Foundation / Developing / Proficient / Advanced / Expert
- `irt_a`, `irt_b`, `irt_c` — null until calibrated (≥30 exposures)
- `polarity` + `reverse_score` — engine flips negatively worded items automatically
- `is_anchor_item` — flags for test equating across parallel forms
- `cognitive_level` — Bloom's taxonomy (RECALL/COMPREHENSION/APPLICATION/ANALYSIS/SYNTHESIS/EVALUATION)
- `status` — `draft` → `approved` → `deprecated` (approved required before assignment to published assessment)

### 2.2 Option Schema

```typescript
interface QuestionOption {
  id:              string;     // stable UUID within question
  text:            string;
  score_value:     number;     // 0–4 for SJT; 0 or 1 for MCQ
  is_correct:      boolean | null;   // null for SJT (no single correct)
  distractor_type: 'plausible' | 'common_error' | 'partial' | null;
  feedback:        string | null;    // shown post-submission
}
```

### 2.3 BARS Rubric Schema

```typescript
interface BARSRubric {
  levels: Array<{
    level:               1 | 2 | 3 | 4 | 5;
    anchor:              string;       // "Clearly demonstrates X by..."
    behavioral_indicators: string[];  // 2–4 observable examples
    score:               number;       // 0–100 mapped score
  }>;
}
```

### 2.4 Bloom's Level Distribution Target

| Level | Code | Target % per template |
|-------|------|-----------------------|
| Remember | `RECALL` | ≤ 15% |
| Understand | `COMPREHENSION` | 15–25% |
| Apply | `APPLICATION` | 25–35% |
| Analyse | `ANALYSIS` | 15–25% |
| Evaluate | `EVALUATION` | ≤ 10% |
| Create | `SYNTHESIS` | ≤ 10% |

---

## 3. Scenario Framework

### 3.1 Scenario Types

| Code | Description | Questions |
|------|-------------|-----------|
| `situational_judgment` | Pick-best-action short vignette | 1–3 |
| `case_study` | Extended narrative (300–800 words) with decision context | 3–6 |
| `roleplay` | Character-driven interpersonal transcript | 1–3 |
| `incident` | Crisis / pressure scenario with time context | 2–4 |
| `data_prompt` | Table/chart/dashboard as stimulus | 2–5 |

### 3.2 Scenario Branches

`caf_scenario_branches` allows conditional routing: a candidate's response to question A determines which question they see next within the scenario. Enables adaptive scenario trees without full CAT. Branch conditions stored as `{question_id, response_value_matches, next_question_id}`.

### 3.3 Key Design Rules

- One scenario → many questions; questions reference scenario via `scenario_id` FK
- Scenario items are presented consecutively (runtime groups by scenario)
- `max_questions_per_scenario` in assessment config (default 4) prevents fatigue
- `reading_time_seconds = ceil(word_count / 2.5)` auto-computed; deducted from time limit before question timer starts

---

## 4. Difficulty Framework

### 4.1 Difficulty Tiers

| Tier | IRT b range | Classical p-value | Default label |
|------|------------|------------------|---------------|
| `easy` | b < −0.5 | 0.70–1.00 | Foundational |
| `medium` | −0.5 ≤ b ≤ +0.5 | 0.40–0.69 | Developing / Proficient |
| `hard` | b > +0.5 | 0.10–0.39 | Advanced / Expert |

### 4.2 IRT 3-Parameter Logistic Model

Applies to `cognitive` (mandatory) and `functional` (optional, 2PL with `c=0`).

```
P(correct | θ) = c + (1 − c) / (1 + exp(−1.702 × a × (θ − b)))

Parameters:
  θ : latent ability estimate (session-level)
  a : discrimination  ∈ [0.5, 3.0]  (ideal: 1.0–2.0)
  b : difficulty      ∈ [−3.0, 3.0] in θ units
  c : guessing floor  ∈ [0.0, 0.35] (MCQ guessing correction)
  D : 1.702  (scaling factor for normal metric)
```

**Item Information Function:**
```
I(θ) = D²a² × (P(θ) − c)² × (1 − P(θ)) / ((1−c)² × P(θ))
```
The CAT engine selects items that maximise I(θ) at the current ability estimate.

### 4.3 Calibration Lifecycle

| Status | Requirement | Behaviour in item selection |
|--------|-------------|----------------------------|
| `uncalibrated` | < 30 exposures | Default params (a=1, b=0, c=0); excluded from CAT |
| `pilot` | 30–200 exposures | Provisional params; weight penalty ×0.5 in CAT |
| `calibrated` | ≥ 200, RMSEA < 0.06 | Full params active in CAT |
| `stable` | ≥ 500, 3 stable cycles | Highest priority in exposure scheduling |

### 4.4 Default Difficulty Distribution by Type

| Type | easy | medium | hard |
|------|------|--------|------|
| behavioral | 15% | 50% | 35% |
| functional | 30% | 45% | 25% |
| cognitive | 25% | 40% | 35% |
| leadership | 10% | 40% | 50% |
| future_readiness | 40% | 45% | 15% |

---

## 5. Level Framework

### 5.1 Default Five-Level Framework

| Code | Label | Score Range | θ Range | Career Stage |
|------|-------|-------------|---------|--------------|
| `L1` | Foundation | 0–39 | θ < −1.5 | intern · junior |
| `L2` | Developing | 40–59 | −1.5 ≤ θ < −0.5 | mid-level |
| `L3` | Proficient | 60–74 | −0.5 ≤ θ < +0.5 | senior |
| `L4` | Advanced | 75–89 | +0.5 ≤ θ < +1.5 | lead · principal |
| `L5` | Expert | 90–100 | θ ≥ +1.5 | director · VP · C-suite |

### 5.2 Level Anchors

Each `(assessment_type, level_code, domain_code)` triplet has a behavioral anchor: what observable behaviour looks like at that level in that domain. Anchors feed:
- The BARS rubric descriptor text
- Gap analysis narrative ("you are at L3 in LEA_DEC; L4 looks like…")
- Report copy

### 5.3 Level Framework Rules

- An assessment references exactly one level framework via FK
- Multiple assessments can share a framework (e.g., all `leadership` assessments share `LEADERSHIP_DEFAULT`)
- Band thresholds are stored in `caf_level_frameworks.band_thresholds JSONB`, not hardcoded

---

## 6. Randomization Engine

**File**: `backend/services/caf/randomization-engine.ts`

### 6.1 Strategies

| Strategy | Description | Best for |
|----------|-------------|---------|
| `fixed` | Same questions, same order every time | Piloting, equating |
| `stratified` | Draw N items per difficulty × domain stratum | Standard assessments |
| `purely_random` | Random from full pool | Low-stakes exploratory |
| `adaptive` | Next item chosen by max I(θ) at current ability | Cognitive CAT |
| `fixed_parallel` | Pre-built parallel forms (form = hash(user_id, date) mod n_forms) | High-stakes proctored |

### 6.2 Stratified Selection Algorithm

```
Input:
  config        : RandomizationRule
  pool          : Question[]           (filtered: type + is_active + status='approved')
  session_state : { administered, exposure_counts, user_context }

Step 1 — Domain Allocation
  For each domain d:
    n_d = round(total_questions × domain_weights[d])
  Assign remainder questions to highest-weight domains

Step 2 — Candidate pool per domain
  eligible[d] = pool.filter(q =>
    q.domain_code == d
    && !administered.has(q.id)
    && exposure_counts.get(q.id) < MAX_DAILY_EXPOSURE
    && (cooldown: q last seen by this user > 90 days ago)
  )

Step 3 — Difficulty-stratified sampling per domain
  for each domain d:
    buckets = groupBy(eligible[d], q.difficulty_tier)
    for each tier t in {easy, medium, hard}:
      n_from_t = round(n_d × difficulty_distribution[t])
      drawn[d][t] = sampleWithoutReplacement(buckets[t], n_from_t)
    // fill shortfall with remaining eligible items (any tier)
    drawn[d] = pad(drawn[d], n_d, remaining_eligible[d])

Step 4 — Scenario grouping
  Group all drawn items by scenario_id
  Scenario groups travel together (consecutive in final sequence)
  Non-scenario items interleaved via round-robin domain rotation

Step 5 — Option randomization (MCQ/SJT)
  For each non-ordered MCQ/SJT item:
    options_shuffled = fisherYates(options)
    store shuffled_option_order in session.question_order[i]
```

### 6.3 CAT Item Selection (adaptive only)

```
On each new question request after response recorded:
  theta_current = session.adaptive_state.theta
  eligible      = full pool minus administered, minus cooldown
  candidates    = eligible.filter(q => q.irt_a != null)

  // Anti-exposure: weight down overexposed items
  weighted_info = candidates.map(q => ({
    q,
    info: information(q, theta_current) × exposure_penalty(q)
  }))
  exposure_penalty(q) = max(0.1, 1 − (exposure_count(q) / MAX_DAILY_EXPOSURE))

  // Domain coverage: force under-represented domains first
  if any domain d has coverage < min_domain_questions[d]:
    candidates = candidates.filter(q => q.domain == d)  // force that domain

  next_item = weighted_info.argmax(w => w.info).q
```

### 6.4 Exposure Control

| Rule | Default |
|------|---------|
| `MAX_DAILY_EXPOSURE` | 50 administrations/day per item |
| `USER_ITEM_COOLDOWN` | 90 days (same user cannot see same item) |
| `MIN_POOL_DEPTH` | 1.5× required items per domain (alert if below) |
| Uncalibrated item cap | Max 200 total exposures before retirement |

---

## 7. Assessment Builder

**File**: `backend/routes/caf/builder.ts`

### 7.1 Data Model

```
caf_assessments (one row per assessment version)
  └── caf_assessment_sections (ordered sections, each with scoring_method)
        └── caf_section_questions (question slots)
              ├── is_fixed=true  → always include this question
              └── is_fixed=false → part of pool_group for randomization draw
caf_randomization_rules (one per assessment, references pool groups)
caf_score_rules (one per section per dimension, defines scoring_method)
```

### 7.2 Builder Validation Rules

| Rule | Condition | Error code |
|------|-----------|-----------|
| Domain weight sum | Σ weights ≠ 1.0 ±0.01 | `DOMAIN_WEIGHTS_SUM` |
| Pool depth | Any domain pool < 1.5× min_questions | `POOL_TOO_THIN` |
| Difficulty dist sum | Σ difficulty pcts ≠ 1.0 | `DIFFICULTY_DIST_INVALID` |
| CAT requires IRT | adaptive=true AND type ≠ cognitive | `ADAPTIVE_REQUIRES_COGNITIVE` |
| Question count | < 10 OR > 80 | `QUESTION_COUNT_RANGE` |
| Scenario overload | scenario_pct > 0.60 | `SCENARIO_OVERLOAD` |
| Options completeness | Any MCQ/SJT option missing score_value | `OPTIONS_INCOMPLETE` |
| Time limit | time_limit_seconds < total_questions × 30 | `TIME_LIMIT_TOO_SHORT` |

### 7.3 Versioning

- Draft edits → no version bump
- `POST /api/caf/assessments/:id/publish` → status `draft` → `active`, version increments
- Active assessments: only metadata (label/instructions) editable; structure changes require clone
- `POST /api/caf/assessments/:id/clone` → new row with `status='draft'`, version reset to 1

---

## 8. Assessment Runtime

**File**: `backend/routes/caf/runtime.ts`

### 8.1 Session State Machine

```
DRAFT ──begin──► IN_PROGRESS ──respond (all answered)──► auto-complete ──► COMPLETED
                     │                                                           │
                   pause                                                    (scoring pipeline)
                     │                                                           │
                  PAUSED ──resume──► IN_PROGRESS                          caf_scores written
                     │
                  7 days
                     │
                  EXPIRED

DRAFT (24hrs no begin) ──► EXPIRED
IN_PROGRESS ──admin flag──► INVALIDATED
```

### 8.2 Session Initialization (`POST /sessions/start`)

```
1. Validate template exists + status='active'
2. Check: no IN_PROGRESS session for same user × assessment (409 if exists)
3. Draw question_order via Randomization Engine
4. INSERT caf_sessions: {
     status: 'draft',
     question_order: drawn_sequence,
     adaptive_state: {theta: prior_theta ?? 0.0, se: 1.0, history: []},
     expires_at: NOW() + 24 hours
   }
5. Return {session_id, question_count, time_limit_seconds}
```

### 8.3 `GET /sessions/:id/next` Response

```typescript
interface NextQuestionResponse {
  session_id:        string;
  position:          number;    // 1-indexed
  total:             number;
  time_remaining_secs: number;
  question: {
    id:              number;
    type:            QuestionType;
    stem:            string;
    options?:        ShuffledOption[];  // shuffled per session seed
    rubric?:         BARSRubric;
    cognitive_level: string;
    difficulty_tier: string;
    scenario?:       ScenarioContext;   // if scenario_id != null
  };
  adaptive_state?: { theta: number; se: number };  // cognitive only
}
```

### 8.4 Response Processing (`POST /sessions/:id/respond`)

```
1. Validate session status = IN_PROGRESS
2. Validate question_id ∈ question_order AND not yet answered (unless revision)
3. Compute raw_score via immediate scoring (see §10)
4. Upsert caf_responses
5. If adaptive (cognitive):
   a. Run EAP theta update (see §10.3)
   b. Check stopping rules
   c. Select next item via CAT
   d. Update session.adaptive_state
6. Advance session.current_position
7. If all questions answered: trigger auto-complete → scoring pipeline
8. Return {next_question_id, theta_updated?, stopping_triggered?}
```

---

## 9. Session Management

**File**: `backend/services/caf/session-manager.ts`

### 9.1 Lifecycle Rules

| Rule | Value |
|------|-------|
| Draft TTL | 24 hours |
| In-progress TTL | 7 days |
| Max pauses | 3 (4th pause → auto-complete with partial scoring) |
| Min completion threshold | 60% questions answered |
| Concurrent session limit | 1 IN_PROGRESS per (user × assessment) |
| Anti-tampering: response_time floor | Responses in < 2s → flagged (speedrun) |

### 9.2 Session Context (captured at creation)

```typescript
interface SessionContext {
  current_role?:      string;
  target_role?:       string;
  industry?:          string;
  career_stage?:      string;
  experience_years?:  number;
  organisation?:      string;
  locale?:            string;
}
```

### 9.3 Integrity Signals (stored in `proctoring_events JSONB`)

| Signal | Storage | Use |
|--------|---------|-----|
| Tab-switch | proctoring_events array | Flag session |
| Response time < 2s | `caf_responses.time_taken_secs` | Count speedrun items |
| Revision rate > 30% | aggregate after session | Flag session |
| IP mismatch across resumes | sessions.ip_address per-segment | Flag session |

Sessions are flagged but **never auto-invalidated** — requires human reviewer.

---

## 10. Scoring Engine

**File**: `backend/services/caf/scoring-engine.ts`

### 10.1 Immediate Per-Response Scoring

| Question Type | `raw_score` formula |
|---------------|---------------------|
| MCQ, SCENARIO_MCQ, DATA_INTERP | `option.is_correct ? 1.0 : 0.0` |
| MULTI_SELECT | `|correct ∩ selected| / |correct ∪ selected|` (Jaccard) |
| LIKERT | `(rating − 1) / 4` → [0, 1] |
| BARS_RATING | `rubric.levels[level].score / 100` |
| SITUATIONAL_JUDGMENT | `(best.score_value × sjt_best_w + (max_key − worst.score_value) × sjt_worst_w) / (max_key × (sjt_best_w + sjt_worst_w))` |
| PRIORITIZATION | `(spearman_rho(user_ranks, expert_ranks) + 1) / 2` |
| KNOWLEDGE_PROBE | `1 − brier_score(answer, confidence)` where `brier = (p − outcome)²`, p = confidence/5 |
| OPEN_RUBRIC | `null` — pending human/AI grade |
| COMPARATIVE_JUDGMENT | `bradley_terry_win_probability(preferred, alternative)` |

### 10.2 Type-Specific Domain Scoring

**BEHAVIORAL (BARS_RUBRIC)**
```
For each domain d:
  domain_raw[d] = Σ(response.raw_score × question.importance_weight) / Σ(weights)
  domain_scaled[d] = domain_raw[d] × 100   // already [0,1]
```

**FUNCTIONAL (WEIGHTED_CTT)**
```
For each domain d:
  bloom_multiplier = { RECALL:1.0, COMPREHENSION:1.2, APPLICATION:1.5,
                       ANALYSIS:1.8, SYNTHESIS:2.0, EVALUATION:2.0 }
  domain_score[d] = Σ(raw × importance_weight × bloom_multiplier) / Σ(weights) × 100
```

**COGNITIVE (IRT_3PL with EAP)**
```
EAP Theta Estimation:
  theta_grid = linspace(−4, +4, 81)     // step 0.1
  For each theta_k in theta_grid:
    log_L[k] = Σ_i [ r_i × log(P_i(θ_k)) + (1−r_i) × log(1−P_i(θ_k)) ]
    log_prior[k] = −0.5 × (theta_k − prior_mean)² / prior_sd²
  posterior[k] = softmax(log_L[k] + log_prior[k])
  theta_hat = Σ(theta_k × posterior[k])         // posterior mean
  se_hat    = sqrt(Σ(posterior[k] × (theta_k − theta_hat)²))  // posterior SD

Theta → scaled score:
  scaled = 50 + theta_hat × 15           // N(0,1) → mean=50, SD=15
  clamped to [0, 100]

Stopping rules (adaptive):
  Stop if (se_hat < 0.30 AND n ≥ min_questions) OR n ≥ max_questions OR time exceeded
```

**LEADERSHIP (SJT_EXPERT + BARS)**
```
For each domain d:
  sjt_score[d]  = mean(sjt_item_scores[d])
  bars_score[d] = mean(bars_item_scores[d])
  domain_score[d] = sjt_weight[d] × sjt_score[d] + bars_weight[d] × bars_score[d]
  (sjt_weight + bars_weight = 1.0; defaults: 0.60 / 0.40)
Leadership Index = Σ(domain_score[d] × domain_weight[d])
```

**FUTURE_READINESS (DIMENSIONAL)**
```
Default dimension weights: { FR_AIF:0.25, FR_DGA:0.20, FR_LAG:0.25, FR_SYS:0.15, FR_FUT:0.15 }
For each dimension dim:
  dim_score[dim] = mean(item_scores[dim]) × 100
Future Readiness Index = Σ(dim_score[dim] × dimension_weights[dim])
```

### 10.3 Score Finalization Pipeline

```
1. Collect all caf_responses for session
2. Completeness check: n_answered / n_total
   < 60% → status='incomplete', all scores tagged confidence='directional'
3. Reverse-score polarity=negative items: raw_score = 1.0 − raw_score
4. Run type-specific domain scoring (§10.2)
5. Compute overall composite = Σ(domain_score × domain_weight)
6. Assign level_code from caf_level_frameworks.band_thresholds
7. Get percentile via existing adaptive-benchmark.ts computePercentile()
8. Compute session reliability via existing reliability-engine.ts
9. INSERT caf_scores rows (one per domain + one overall)
10. INSERT p4_competency_history row (assessment_source='caf', template_id)
11. Wrap response with explainability-engine.ts wrap()
```

---

## 11. Question Analytics

**File**: `backend/services/caf/analytics-engine.ts`

### 11.1 Classical Test Theory (CTT) Item Statistics

| Metric | Formula | Target | Flag condition |
|--------|---------|--------|----------------|
| p-value (difficulty) | `mean(raw_scores)` | 0.30–0.70 | < 0.10 (too hard) or > 0.90 (too easy) |
| Point-biserial r | `corr(item_score, total_score)` | > 0.20 | < 0.15 |
| Discrimination index | `(p_upper27 − p_lower27)` | > 0.30 | < 0.20 |
| Mean response time | `mean(time_taken_secs)` | 30–120s | < 5s (guessing) |
| Skip rate | `n_skipped / n_administered` | < 0.05 | > 0.10 |
| Revision rate | `n_changed / n_administered` | < 0.15 | > 0.30 (ambiguous stem) |

**Quality flags**: `good` / `review` / `retire` — auto-assigned; human override permitted.

### 11.2 Distractor Analysis (MCQ/SJT)

```
For each option o:
  pct_chosen[o]     = n_chosen[o] / n_administered
  point_biserial[o] = corr(chose_o_binary, total_score)

Flags:
  pct_chosen < 0.05                 → non-functional distractor (revise/remove)
  point_biserial(distractor) > 0.20 → higher scorers choose distractor (mis-key?)
  pct_chosen(correct) < 0.20        → item too hard OR mis-keyed
```

### 11.3 Item Drift Detection

After each batch of 100 administrations, compare current p-value vs baseline p-value established at first 100 administrations:
```
drift_magnitude = |p_current − p_baseline|
if drift_magnitude > 0.15: set drift_detected=true, selection_penalty=0.50
```
Drifted items remain active but are weight-penalised in item selection until reviewed.

### 11.4 Analytics Compute Schedule

- **Real-time**: `p_value`, `mean_response_time`, `skip_rate` — updated after every 10 new sessions
- **Batch (hourly)**: `point_biserial`, `discrimination_index`, distractor analysis — requires all session scores
- **Weekly**: IRT re-calibration, drift detection, quality flag recomputation

---

## 12. Psychometric Analytics

**File**: `backend/services/caf/analytics-engine.ts` (same file, separate export)

### 12.1 Internal Consistency — Cronbach's Alpha

```
α = (k / (k−1)) × (1 − Σσ²_i / σ²_total)

k        = number of items
σ²_i     = variance of item i scores
σ²_total = variance of total scores

Quality gates:
  α ≥ 0.90 → Excellent
  α ≥ 0.80 → Good
  α ≥ 0.70 → Acceptable (minimum for high-stakes use)
  α < 0.60 → Unacceptable → flag INTERNAL_CONSISTENCY_LOW
```

Computed globally AND per-domain. Domain α < 0.60 with ≥ 4 items triggers advisory.

### 12.2 McDonald's ω (more robust than α for non-tau-equivalent items)

```
ω = (Σλ_i)² / ((Σλ_i)² + Σδ²_i)

λ_i = factor loading of item i on the general factor
δ²_i = item unique variance
(Estimated via one-factor model on item scores)
```

### 12.3 Standard Error of Measurement

```
SEM = SD_observed × √(1 − α)
95% CI on reported score: [score − 1.96×SEM, score + 1.96×SEM]
```
This interval surfaces in the candidate report as "Your true score is between X and Y (95% confidence)."

### 12.4 Differential Item Functioning (DIF)

Mantel-Haenszel procedure across career stage groups (junior/senior):
```
MH_α = Σ_h(A_h × D_h / T_h) / Σ_h(B_h × C_h / T_h)
MH_Δ = −2.35 × ln(MH_α)

Classification:
  |MH_Δ| < 1.0   → Category A (negligible DIF, no action)
  1.0 ≤ |MH_Δ| < 1.5 → Category B (moderate DIF, flag for review)
  |MH_Δ| ≥ 1.5   → Category C (large DIF, suspend from high-stakes use)
```

### 12.5 Factor Structure Signals

- Compute inter-item correlation matrix
- KMO measure of sampling adequacy (< 0.60 → data not factorable)
- Eigenvalue analysis → `n_factors_suggested` (eigenvalue > 1 rule + scree inspection)
- Flag: any item-pair with `|r| > 0.70` (local dependence — possible redundancy)

Full EFA is an offline process; the engine surfaces only the flags.

### 12.6 Floor/Ceiling Check

```
floor_pct   = n_sessions_at_min / n_total
ceiling_pct = n_sessions_at_max / n_total
If either > 0.10: advisory to add items at the extreme end
```

---

## 13. Database Schema Reference

Full DDL: `backend/migrations/20260613_competency_assessment_factory.sql`

| Table | Rows at seed | Purpose |
|-------|-------------|---------|
| `caf_assessment_types` | 5 | Type registry |
| `caf_domains` | ~20 | Domain codebook |
| `caf_question_bank` | 0 (curated) | Polymorphic item store |
| `caf_question_options` | 0 | Options for MCQ/SJT items |
| `caf_scenarios` | 0 (curated) | Scenario stimulus containers |
| `caf_scenario_branches` | 0 | Conditional routing within scenarios |
| `caf_difficulty_calibrations` | 5 (one per type) | IRT + CTT tier definitions |
| `caf_level_frameworks` | 2 (default + leadership) | Level band boundaries |
| `caf_level_anchors` | ~100 | Level × domain behavioral anchors |
| `caf_assessments` | 0 (builder) | Versioned assessment definitions |
| `caf_assessment_sections` | 0 | Ordered sections within assessments |
| `caf_section_questions` | 0 | Question slots (fixed + pool) |
| `caf_randomization_rules` | 0 | Randomization config per assessment |
| `caf_score_rules` | 0 | Scoring rules per section/dimension |
| `caf_sessions` | per-user | Assessment session instances |
| `caf_responses` | per-session | Individual item responses |
| `caf_scores` | per-session | Domain + overall scores |
| `caf_item_stats` | per-question | CTT + IRT analytics |
| `caf_psychometric_calibrations` | per-assessment | Alpha, DIF, factor signals |

---

## 14. TypeScript Types Reference

Full types: `backend/services/caf/types.ts`

Key type aliases:
```typescript
type AssessmentTypeCode = 'behavioral'|'functional'|'cognitive'|'leadership'|'future_readiness';
type QuestionType       = 'MCQ'|'MULTI_SELECT'|'LIKERT'|'BARS_RATING'|'SITUATIONAL_JUDGMENT'
                        | 'SCENARIO_MCQ'|'PRIORITIZATION'|'DATA_INTERPRETATION'
                        | 'OPEN_RUBRIC'|'COMPARATIVE_JUDGMENT'|'KNOWLEDGE_PROBE';
type DifficultyTier     = 'easy'|'medium'|'hard';
type LevelCode          = 'L1'|'L2'|'L3'|'L4'|'L5';
type SessionStatus      = 'draft'|'in_progress'|'paused'|'completed'
                        | 'abandoned'|'expired'|'invalidated';
type ScoringModel       = 'BARS_RUBRIC'|'WEIGHTED_CTT'|'IRT_3PL'|'SJT_EXPERT'|'DIMENSIONAL';
type CalibrationStatus  = 'uncalibrated'|'pilot'|'calibrated'|'stable';
type QualityFlag        = 'good'|'review'|'retire';
```

---

## 15. Complete API Contract

All `/api/caf/*` routes are flag-gated behind `FF_COMPETENCY_ASSESSMENT_FACTORY`.  
Admin routes: `requireAuth + requireSuperAdmin`.  
Runtime routes (`/sessions/*`): `requireAuth` only.

### Questions & Options
```
GET    /api/caf/questions                    list (filter: type, domain, status, level)
POST   /api/caf/questions                    create
PATCH  /api/caf/questions/:id                update
DELETE /api/caf/questions/:id                soft-delete (is_active=false)
GET    /api/caf/questions/:id/options        list options
POST   /api/caf/questions/:id/options        add option
PATCH  /api/caf/questions/:id/options/:oid   update option
DELETE /api/caf/questions/:id/options/:oid   remove option
```

### Scenarios
```
GET    /api/caf/scenarios                    list
POST   /api/caf/scenarios                    create
PATCH  /api/caf/scenarios/:id               update
DELETE /api/caf/scenarios/:id               archive
GET    /api/caf/scenarios/:id/branches      list branches
POST   /api/caf/scenarios/:id/branches      add branch
PATCH  /api/caf/scenarios/:id/branches/:bid update branch
DELETE /api/caf/scenarios/:id/branches/:bid remove branch
```

### Difficulty & Levels
```
GET    /api/caf/difficulty-calibrations
POST   /api/caf/difficulty-calibrations
PATCH  /api/caf/difficulty-calibrations/:id
GET    /api/caf/level-frameworks
POST   /api/caf/level-frameworks
PATCH  /api/caf/level-frameworks/:id
DELETE /api/caf/level-frameworks/:id
GET    /api/caf/level-anchors               ?framework_id=N
POST   /api/caf/level-anchors
PATCH  /api/caf/level-anchors/:id
DELETE /api/caf/level-anchors/:id
```

### Assessment Builder
```
GET    /api/caf/assessments                  list
POST   /api/caf/assessments                  create (draft)
PATCH  /api/caf/assessments/:id             update draft
DELETE /api/caf/assessments/:id             archive
POST   /api/caf/assessments/:id/publish     draft → active
POST   /api/caf/assessments/:id/clone       clone to new draft
GET    /api/caf/assessments/:id/pool-depth  preview item counts per domain
POST   /api/caf/assessments/:id/preview-draw dry-run randomization
GET    /api/caf/assessments/:id/sections    list sections
POST   /api/caf/assessments/:id/sections    add section
PATCH  /api/caf/assessments/:id/sections/:sid update section
DELETE /api/caf/assessments/:id/sections/:sid remove section
GET    /api/caf/sections/:sid/questions     list question slots
POST   /api/caf/sections/:sid/questions     add question slot
DELETE /api/caf/sections/:sid/questions/:qslot remove slot
GET    /api/caf/assessments/:id/randomization get rule
PUT    /api/caf/assessments/:id/randomization upsert rule
GET    /api/caf/score-rules                 ?assessment_id=N
POST   /api/caf/score-rules                 create rule
PATCH  /api/caf/score-rules/:id             update rule
```

### Runtime (candidate-facing)
```
POST   /api/caf/sessions/start              create DRAFT session
POST   /api/caf/sessions/:id/begin          DRAFT → IN_PROGRESS, draw questions
GET    /api/caf/sessions/:id/state          current state + time remaining
GET    /api/caf/sessions/:id/next           next question + scenario context
POST   /api/caf/sessions/:id/respond        record response
POST   /api/caf/sessions/:id/pause          pause
POST   /api/caf/sessions/:id/resume         resume
POST   /api/caf/sessions/:id/submit         explicit submit → scoring
POST   /api/caf/sessions/:id/flag/:qid      toggle question flag for review
GET    /api/caf/sessions/:id/responses      all responses (review tab)
GET    /api/caf/sessions/:id/score          fetch score report
```

### Admin Session Management
```
GET    /api/caf/sessions                    list (filter: assessment, user, status, date)
GET    /api/caf/sessions/:id               full session detail
POST   /api/caf/sessions/:id/invalidate    mark INVALIDATED + void scores
GET    /api/caf/sessions/export.csv        export sessions to CSV
```

### Analytics
```
GET    /api/caf/analytics/items             ?assessment_id=N&min_sample=30
GET    /api/caf/analytics/items/:qid        single item stats
POST   /api/caf/analytics/items/compute    trigger recompute for assessment
PATCH  /api/caf/analytics/items/:qid/flag  override quality flag
GET    /api/caf/analytics/psychometric      ?assessment_id=N
POST   /api/caf/analytics/psychometric/calibrate  run calibration
GET    /api/caf/analytics/psychometric/:id  historical report
```

---

## 16. Integration Map

| CAF Component | Existing Asset | How wired |
|---------------|---------------|-----------|
| Domain taxonomy | `onto_*` (Phase 1) | `caf_question_bank.competency_id → onto_competencies.id` |
| Percentile | `adaptive-benchmark.ts` | `computePercentile(score, domain, cohort)` in score finalization |
| Longitudinal | `p4_competency_history` | Append row on every CAF session completion |
| Reliability | `reliability-engine.ts` | `computeReliability(responses)` reused in pipeline step |
| Explainability | `explainability-engine.ts` | `wrap()` on all `/score` responses |
| Audit trail | `platform-audit.ts` | `logAudit()` on template CRUD + session invalidations |
| Language policy | Global policy config | `caf_assessments.language_policy` inherits defaults |
| Legacy questions | `competency_question_templates` | `POST /api/caf/admin/migrate-legacy` batch migrator |

---

## 17. Frontend Panel Map

| Nav ID | Panel | Purpose |
|--------|-------|---------|
| `caf-question-bank` | `CAFQuestionBankPanel.tsx` | Browse, create, edit questions + options |
| `caf-scenarios` | `CAFScenariosPanel.tsx` | Scenario library + branching editor |
| `caf-difficulty-level` | `CAFDifficultyLevelPanel.tsx` | Calibrations + level frameworks + anchors |
| `caf-assessment-builder` | `CAFAssessmentBuilderPanel.tsx` | Build assessments (sections + slots) |
| `caf-randomization` | `CAFRandomizationPanel.tsx` | Randomization rules per assessment |
| `caf-sessions` | `CAFSessionsPanel.tsx` | Monitor live + historical sessions |
| `caf-scoring` | `CAFScoringPanel.tsx` | Scoring rules + session score review |
| `caf-analytics` | `CAFAnalyticsPanel.tsx` | Item analytics + psychometric reports |

---

## 18. Feature Flag & Rollout Sequence

```
FF_COMPETENCY_ASSESSMENT_FACTORY=1

Flag-off: all /api/caf/* → 503; all CAF panels hidden; no DB writes

Rollout:
  1. Run migration (no flag dependency — tables create idempotently)
  2. Seed: assessment_types + domains + default level frameworks
  3. Enable flag → Builder + Admin analytics available to super-admins
  4. Curate first question bank (target: 20 approved items per domain minimum)
  5. Build + publish first template per type (start with behavioral + functional)
  6. Enable user-facing sessions (/sessions/* routes to candidate users)
  7. Monitor item analytics; calibrate IRT once n ≥ 200 per item
  8. Enable adaptive CAT for cognitive assessments
```

---

## 19. Governance Constraints

- **Language policy**: All output is developmental (proficiency descriptions), never hiring/promotion predictions
- **k-anonymity**: Item stats suppressed when n < 30; percentiles suppressed when cohort < 30
- **Append-only history**: `caf_scores.version` increments on re-score; old rows preserved
- **AI governance**: AI-assisted question generation flows through `ont_ai_rules` (applies_to='caf')
- **No code forks**: Scoring model differences are data-driven via `scoring_model` enum + `scoring_config` JSONB
- **Additive**: All CAF tables `IF NOT EXISTS`; no existing table altered

---

*Spec v2.0 · June 2026 · Authoritative source: this file.  
Update when: scoring algorithms change, table schema changes, or question type taxonomy changes.*
