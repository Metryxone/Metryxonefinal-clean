# CAPADEX Concern Resolution Accuracy Audit
  _Investigation only — no code, mappings, or scoring were modified. Generated 2026-06-04._

  ## Methodology (read this first — it bounds every number below)
  The live function `resolveMasterConcernIdFromText()` was **faithfully ported** (verbatim: STOPWORDS, `stemConcernToken`, `RESOLVER_SYNONYM_GROUPS`, `expandResolverToken`, the `display_label + concern_cluster + common_indian_context + domain` haystack, `matched_groups / tokens × 100` scoring, `ORDER BY matched DESC, age_fit DESC, concern_id ASC`, the **≥60** acceptance threshold, and the `PERSONA_COHORT` filter) and run **read-only** against all 2,489 live master concerns.

  Test intents are **template-generated from each concern's OWN `display_label`/`concern_cluster`** (6 phrasings/concern → 14,934 intents). This is a **self-resolution / best-case** test: the intent text already contains the concern's own words, so real free-text users (who paraphrase without the exact label tokens) will score **worse**. **Treat every accuracy figure here as an optimistic upper bound.**

  ---

  ## PHASE 1 — Resolution Coverage
  | Metric | Value |
  |---|---|
  | Total concerns | 2489 |
  | Distinct bridge tags | 328 |
  | Distinct concern clusters | 2430 |
  | Synonym groups | 12 |
  | Synonym tokens (total) | 64 |
  | Stopwords | 62 |
  | Max tokens per intent | 6 |
  | Acceptance threshold | 60 |

  **Findings.** (a) **2,430 clusters for 2,489 concerns** — `concern_cluster` is ~1:1 with the concern, so it is **not a real grouping/abstraction layer**; "near match by cluster" is therefore almost never reachable. (b) Only **12 synonym groups / 64 tokens** cover the entire intent surface — anything outside stress/exam/motivation/focus/career/confidence/sleep/loneliness/anger/sadness/screen/relationship has **no synonym support**. (c) The scorer caps intents at **6 tokens** and accepts at **matched/tokens ≥ 60%**, so a 2-word intent must match **both** tokens or it fails.

  ---

  ## PHASE 2 & 3 — Intent → Concern Accuracy (14,934 intents, persona-null baseline)
  | Outcome | Count | Rate |
  |---|---|---|
  | **Exact** (same concern_id) | 11383 | **76.2%** |
  | **Near** (same bridge tag / cluster) | 1099 | 7.4% |
  | **Drift** (different construct) | 1578 | **10.6%** |
  | **Failure** (no concern ≥60) | 874 | **5.9%** |
  | Ambiguous (winning score tied by ≥2 concerns) | 4649 | **31.1%** |
  | Heavily ambiguous (tie ≥10) | 638 | 4.3% |

  **The headline risk is ambiguity, not raw accuracy.** ~31% of even these best-case intents produce a **multi-concern tie** on the winning score, broken **only** by `concern_id ASC` (alphabetical). That is a systematic, content-blind bias toward whichever tied concern has the lowest id — not the most relevant one.

  ### Representative failures (single-word core concerns can't resolve)
  | Intent | Target | Best score | Concerns tied |
  |---|---|---|---|
  | "i have trouble with confidence" | Confidence (CONFIDENCE_SELF) | 50 → **fail** | **444** |
  | "i struggle with discipline" | Discipline (DISCIPLINE_HABITS) | 50 → **fail** | 310 |
  | "i struggle with motivation" | Motivation (MOTIVATION_VALUES) | 50 → **fail** | 310 |

  A 2-token intent ("trouble", "confidence") matches only 1 group → 50% < 60% → **null**, even though a concern literally named "Confidence" exists. The threshold + token math actively rejects the simplest real phrasings.

  ### Representative drift (lands on a different construct)
  | Intent | Target tag | Resolved tag (wrong) |
  |---|---|---|
  | "i struggle with leadership confidence" | LEADERSHIP_OWNERSHIP | COMMUNICATION_EXPRESSION ("Leadership Interviews") |
  | "i have trouble with emotional regulation" | EXAMINATION_STRESS | EMOTIONAL_REGULATION ("…Burnout During Multi-Year Transitions") |
  | "i have trouble with placement pressure" | EXAMINATION_STRESS | EMOTIONAL_RECOVERY |

  (Full lists: `top_500_drift.csv`, `top_200_failures.csv`, `top_100_ambiguous.csv`.)

  ---

  ## PHASE 4 — Bridge-Tag Health
  **Special-focus tags — most do not exist as dedicated constructs:**
  | Tag | Exists? | # concerns |
  |---|---|---|
  | CAREER_EXPLORATION | ✅ | 1 |
| CAREER_CLARITY | ❌ **MISSING** | 0 |
| CAREER_STABILITY | ✅ | 1 |
| LEARNING_MINDSET | ✅ | 1 |
| LEADERSHIP | ❌ **MISSING** | 0 |
| COMMUNICATION | ❌ **MISSING** | 0 |
| ENTREPRENEURSHIP | ❌ **MISSING** | 0 |
| FUTURE_READINESS | ❌ **MISSING** | 0 |

  Only **CAREER_EXPLORATION, CAREER_STABILITY, LEARNING_MINDSET** exist — and each is backed by **exactly 1 concern**. **CAREER_CLARITY, LEADERSHIP, COMMUNICATION, ENTREPRENEURSHIP, FUTURE_READINESS do not exist at all.** The audit's hypothesis is confirmed: the career/leadership/communication intent space the product markets has **effectively no first-class concern coverage** — those intents can only ever drift or fail. (Confirms the prior "Frequently Changes Career Goals" finding: no dedicated concern, so it cannot resolve — "i keep changing career goals" scores 50 and fails.)

  **Worst tags by drift / failure / ambiguity** are in `bridge_tag_health.csv`. Note many "100% drift" tags are single-concern tags (n=6 intents); the structurally worst are high-ambiguity tags such as **ENGAGEMENT_MANAGEMENT (avg tie ≈ 68)** and **PRODUCTIVITY_COACHING (avg tie ≈ 38)**.

  ---

  ## PHASE 5 — Persona Resolution
  | Measure | Rate |
  |---|---|
  | Persona **Ignored** (no change vs persona-null) | **88.6%** |
  | Persona **Effective** (changed the resolved concern) | 10.9% |
  | Persona **Relaxed/Failed** (filter emptied the candidate set → null) | 0.5% |
  | Persona **Drift** (filter moved result AWAY from target) | 0% |

  Persona filtering is **inert ~89% of the time** and, when it acts, it almost always moves **toward** the correct concern (1415 of 1627) and **never** caused drift away from target. The persona layer is **not harming** resolution — but it is also doing very little, because the dominant failure modes (ambiguity, threshold, missing constructs) are upstream of persona.

  ---

  ## PHASE 6 — Resolution Confidence (0–100)
  Average resolution confidence over resolved intents: **67.6**.
  Distribution: {"0-39":335,"40-59":2467,"60-79":9029,"80-100":2229}.

  Component contribution (avg fraction of tokens matched per channel):
  | Channel | Avg |
  |---|---|
  | Keyword / stem | 0.758 |
  | Synonym | **0.028** |
  | Label | 0.675 |
  | Cluster | 0.718 |
  | Bridge-tag match | 0.884 |

  **The synonym layer is effectively dead** (contributes ~3% of matches). Resolution rides almost entirely on raw keyword/stem substring hits against the label+cluster — which is exactly why ambiguity is so high (generic words like "trouble"/"struggle"/"manage" match hundreds of concerns equally).

  ---

  ## OVERALL TRUST SCORE: 🟡 **YELLOW — Needs Tuning** (Career/Leadership sub-path: 🔴 **RED**)
  - Distinctive, well-worded concerns resolve well (76% exact, **optimistic upper bound**).
  - But ~31% of intents are decided by an **alphabetical id tiebreak**, the **≥60% threshold rejects the simplest 2-word intents** (Confidence/Discipline/Motivation all fail), the **synonym layer is dead**, **clusters aren't a grouping layer**, and the **career/leadership/communication constructs the product sells don't exist as concerns**. Real (non-self) user phrasings will perform meaningfully worse than these numbers.

  ---

  ## TOP 10 HIGHEST-IMPACT FIXES (ranked — NOT implemented)
  1. **Replace the `concern_id ASC` tiebreak with a relevance tiebreak** (longest-token / rarest-token / specificity weighting). Directly attacks the ~31% ambiguous + much of the 10.6% drift — the single biggest win.
  2. **Add an idf/rarity weight to scoring** so generic tokens ("trouble", "struggle", "manage", "career") count less than distinctive ones. Kills the 444-way ties.
  3. **Fix the threshold/short-intent math** (e.g. weight by matched distinctive tokens, or lower/relativize the ≥60% gate) so "i have trouble with confidence" can resolve to **Confidence**. Recovers a large share of the 5.9% failures.
  4. **Create the missing career constructs** — CAREER_CLARITY, LEADERSHIP, COMMUNICATION, ENTREPRENEURSHIP, FUTURE_READINESS (and a "Frequently Changes Career Goals" concern). These intents currently **cannot** resolve.
  5. **Revive/expand the synonym layer** (only 12 groups today, contributing ~3%); add career/leadership/communication/learning families.
  6. **Introduce a real cluster/abstraction layer** (today 2,430 clusters ≈ 2,489 concerns) so "near match" and graceful fallback become possible instead of drift.
  7. **Add a tie/low-margin guard**: when the top-N share the winning score, either ask a disambiguating question or route to a cluster parent rather than silently picking id-min.
  8. **Token-coverage normalization for multi-word labels** (label-channel avg only 0.675) so long concern names aren't penalized.
  9. **Promote bridge-tag/category as an explicit scoring channel** (currently incidental) to anchor resolution to construct, reducing cross-tag drift.
  10. **Add a confidence floor + provenance surface** so low-confidence/failed resolutions are flagged to the user (fallback / "did you mean") instead of being delivered as confident answers.

  ---
  ## Artifacts (in `audit/concern-resolution/`)
  - `summary.json` — all phase metrics
  - `top_500_drift.csv` · `top_200_failures.csv` · `top_100_ambiguous.csv`
  - `bridge_tag_health.csv` — per-tag exact/near/drift/fail/tie/confidence

  **STOP — awaiting approval. No fixes implemented.**
  