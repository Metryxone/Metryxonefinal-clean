# L5C Report 3 — Mapping Quality

  ## HIGH_CONFIDENCE mappings by target construct (q-weighted)

  | Construct | Tags | Questions | % of bank |
  |-----------|------|-----------|-----------|
  | ATTENTION_REGULATION | 1 | 75 | 0.2% |
| CRITICAL_THINKING | 15 | 1235 | 4.0% |
| CREATIVITY | 5 | 180 | 0.6% |
| EXECUTIVE_FUNCTION | 4 | 205 | 0.7% |
| HABIT_FORMATION | 2 | 965 | 3.1% |
| EMOTIONAL_REGULATION | 9 | 1430 | 4.7% |
| SELF_ESTEEM | 13 | 1515 | 4.9% |
| RESILIENCE | 11 | 1161 | 3.8% |
| STRESS_MANAGEMENT | 3 | 645 | 2.1% |
| MENTAL_HEALTH | 2 | 80 | 0.3% |
| PHYSICAL_WELLBEING | 3 | 530 | 1.7% |
| INTRINSIC_MOTIVATION | 4 | 725 | 2.4% |
| GOAL_ORIENTATION | 9 | 415 | 1.4% |
| COMMUNICATION | 7 | 385 | 1.3% |
| SOCIAL_CONFIDENCE | 5 | 185 | 0.6% |
| PEER_RELATIONS | 3 | 365 | 1.2% |
| DIGITAL_DISCIPLINE | 2 | 50 | 0.2% |
| EXAM_PERFORMANCE | 1 | 225 | 0.7% |
| EXAM_READINESS | 5 | 725 | 2.4% |
| LEARNING_APPROACH | 28 | 2603 | 8.5% |
| EXAM_STRESS | 2 | 690 | 2.3% |
| COLLEGE_ADAPT | 2 | 140 | 0.5% |
| CAREER_CLARITY | 27 | 1166 | 3.8% |
| SKILL_AWARENESS | 6 | 1179 | 3.8% |
| CAREER_GROWTH | 2 | 700 | 2.3% |
| CAREER_READINESS | 11 | 3092 | 10.1% |

**Registry constructs receiving ≥1 HIGH mapping:** 26/36.
**Constructs with no HIGH mapping (no clarity tag resolves to them):** WORKING_MEMORY, PROCESSING_SPEED, IMPULSE_CONTROL, PROCRASTINATION, ANXIETY, LEARNING_DRIVE, SAFETY_THREATS, DIGITAL_DEPENDENCY, ACADEMIC_RECOVERY, FAMILY_DYNAMICS.

## Confidence distribution (all 325 tags)

| Confidence | Tags |
|------------|------|
| 0.95 | 35 |
| 0.85 | 144 |
| 0.80 | 3 |
| 0.50 | 28 |
| 0.40 | 36 |
| 0.00 | 79 |

## Method (deterministic, traceable)
  1. **Exact-override table** — hand-authored decisions for notable / high-frequency / genuinely-ambiguous-but-settled tags → HIGH.
  2. **Single substantive token** — one construct-bearing token (generic/meta tokens excluded) → HIGH.
  3. **Same-cluster tokens** — multiple tokens, all in one construct cluster → HIGH (most specific construct).
  4. **Multi-cluster tokens / multi-construct theme** (LEADERSHIP, SELF, REGULATION, AWARENESS, MINDSET, PERSONALITY) → REVIEW_REQUIRED with candidates (never auto-mapped).
  5. **No behavioural construct token** → UNMAPPED (never forced).

  Every row's `reason` records which rule fired and the matched token(s). See report 01 (CSV).
  
---

## Adjudication caution — umbrella-token HIGH mappings (audit-only)

  Some HIGH decisions resolve from a **broad umbrella token** (`CAREER_*`→CAREER_CLARITY / CAREER_READINESS, `ACADEMIC_*`→LEARNING_APPROACH). These are defensible for this **audit-only, inert** artifact, but are not always *uniquely* compelled by semantics. They are the main overreach vector and **must be re-adjudicated (and uncertain ones downgraded to REVIEW_REQUIRED) before any runtime adoption** — which is out of scope for L5C (this artifact stops at approval, unwired).

  Top umbrella-token HIGH tags by question volume (33 tags · 1979 q · 6.5% of bank):

  | Bridge Tag | Questions | Construct | Reason |
  |------------|-----------|-----------|--------|
  | ACADEMIC_BEHAVIOR | 475 | LEARNING_APPROACH | token ACADEMIC → LEARNING_APPROACH |
| CAREER_EXPECTATIONS | 200 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| ACADEMIC_GROWTH | 125 | LEARNING_APPROACH | token ACADEMIC → LEARNING_APPROACH |
| ACADEMIC_RISK | 100 | LEARNING_APPROACH | token ACADEMIC → LEARNING_APPROACH |
| CAREER_ALIGNMENT | 50 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| ACADEMIC_EQUITY | 50 | LEARNING_APPROACH | token ACADEMIC → LEARNING_APPROACH |
| CAREER_EXPOSURE | 50 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| ACADEMIC_COUNSELLING | 40 | LEARNING_APPROACH | token ACADEMIC → LEARNING_APPROACH |
| ALTERNATIVE_CAREER | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_COMPETITION | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_DEVELOPMENT | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_ECOSYSTEM | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_EXPLORATION | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_FLEXIBILITY | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_GUIDANCE | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_MAPPING | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_REFLECTION | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_RISK | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_STABILITY | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_SUITABILITY | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_SUSTAINABILITY | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_TIMELINE | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| CAREER_TRADEOFF | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| FUTURE_CAREER | 40 | CAREER_CLARITY | token CAREER → CAREER_CLARITY |
| ACADEMIC_OPERATIONS | 38 | LEARNING_APPROACH | token ACADEMIC → LEARNING_APPROACH |
