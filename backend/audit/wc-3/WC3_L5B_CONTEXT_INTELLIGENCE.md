# WC-3 L5B — Context Intelligence (Audit + Architecture)

**Status:** DESIGN / AUDIT ONLY — no implementation. Awaiting approval before any build.
**Scope:** Audit Context Intelligence across the full CAPADEX question bank using existing
assets only (Questions, Concerns, Bridge Tags, Constructs, L1 Stage, L2 Outcome, L3 Journey).
**Grounding:** every figure is measured live against DEV — `capadex_clarity_questions` =
**30,638**, `capadex_concerns_master` = **2,489**, `domain` taxonomy = **351 distinct values**.
Matching uses case-insensitive **word-boundary regex** (`~*` + `\y`) to suppress substring
false positives. Where relevance is degraded by a noisy lexicon it is reported as a risk,
never silently counted as coverage.

**Constraints (carried from L5):** additive · flag-gated default OFF · byte-identical when OFF
· reversible · read-only audit · no ontology/signal/concern mutation · **never fabricate**
(gaps and ambiguity are reported, never filled with invented content).

**Existing intelligence layers leveraged (all live):** L1 `wc3_stage_*`, L2 `wc3_outcome_*`,
L3 `wc3_journey_*`, L5A `wc3_question_intelligence`, plus `construct_similarity_map` and
`capadex_signals` (constructs/signals). Context is the missing **orthogonal axis** beneath them.

---

## 0. Definitions of the 5 investigated dimensions

1. **Context Coverage** — share of questions / concerns that explicitly address a context.
2. **Context Drift** — how *smeared* a context is across the ontology (distinct concerns
   touched + concentration of the largest concern). High spread + low concentration ⇒ the
   context is ambient background, not an addressable node.
3. **Context-Specific Question Availability** — distinct **routable bridge tags**
   (`master_bridge_tag`) carrying a context's questions. This is the true "can we serve it"
   measure (the runtime picker joins on bridge tag), not raw question count.
4. **Context Ambiguity** — how many contexts a single question matches (0 = generic/
   context-free; ≥2 = cross-context overlap that confuses routing).
5. **Context Relevance Risk** — share of a context's matches that are likely **false
   positives** from a broad/ambiguous lexicon (e.g. "lead to", generic "online").

---

## 1. Output 1 — Context Coverage Report

### 1.1 Clarity question pool (n = 30,638)

| Context | Matched Q | % of pool | Routable bridge tags |
|---|---:|---:|---:|
| Leadership ⚠ | 2,803 | 9.15% | 256 |
| Employability | 1,103 | 3.60% | 70 |
| Career Clarity | 851 | 2.78% | 77 |
| Competitive Exam Stress | 778 | 2.54% | 56 |
| Placement Anxiety | 759 | 2.48% | 38 |
| Family Pressure | 693 | 2.26% | 67 |
| Digital Behaviour ⚠ | 428 | 1.40% | 52 |
| Career Transition | 160 | 0.52% | 22 |
| AI Job Disruption | 78 | 0.25% | 12 |
| Entrepreneurship | 40 | 0.13% | 27 |

⚠ = inflated by lexicon noise — see §5 Relevance Risk (true Leadership ≈ 1,154; true Digital lower).

### 1.2 Concern ontology (concerns_master, n = 2,489)

| Context | Matched concerns | % |
|---|---:|---:|
| Leadership | 352 | 14.14% |
| Employability | 169 | 6.79% |
| Competitive Exam Stress | 150 | 6.03% |
| Career Transition | 128 | 5.14% |
| Digital Behaviour | 97 | 3.90% |
| Placement Anxiety | 69 | 2.77% |
| Family Pressure | 59 | 2.37% |
| Career Clarity | 36 | 1.45% |
| AI Job Disruption | 16 | 0.64% |
| Entrepreneurship | 9 | 0.36% |

### 1.3 Headline
The bank is **concern/behaviour-typed, not context-typed**. After removing lexicon noise,
no context exceeds ~4% explicit question coverage; **AI Job Disruption and Entrepreneurship
are effectively absent** (≤0.25% of questions, ≤27 tags). Context is present only
*implicitly* — and there is **no explicit context field** in the schema (§7.1).

---

## 2. Output 2 — Context Drift Report

Per-context spread (mutually-exclusive priority bucketing; counts differ slightly from §1.1
independent counts):

| Context | Matched Q | Distinct concerns | Top-concern share | Drift reading |
|---|---:|---:|---:|---|
| Leadership | 1,685 | **428** | 3.0% | **Extreme smear** — touches 428/2,489 concerns; not a node |
| Career Clarity | 779 | 204 | 3.2% | Heavily smeared |
| Competitive Exam Stress | 751 | 141 | 3.3% | Heavily smeared (ambient pressure) |
| Family Pressure | 498 | 128 | 5.0% | Heavily smeared (backdrop) |
| Employability | 798 | 111 | 3.1% | Heavily smeared |
| Placement Anxiety | 735 | 111 | 6.8% | Smeared, mildly localized |
| Digital Behaviour | 412 | 95 | 18.2% | Partly localized |
| Career Transition | 129 | 38 | 19.4% | Concentrated but thin |
| AI Job Disruption | 77 | 22 | 32.5% | Concentrated but tiny |
| Entrepreneurship | 9 | 8 | 22.2% | Near-absent |

**Two drift modes:** (a) **Ambient drift** — Leadership/Exam/Family/Clarity/Employability:
high volume scattered across 100–428 concerns, no concern owning >~7%. They are *everywhere
and nowhere*; the fix is **tagging**, not more content. (b) **Shallow coverage** — AI /
Career Transition / Entrepreneurship: concentrated but near-empty; genuine **authoring gaps**.

---

## 3. Output 3 — Context-Specific Question Availability & Ambiguity

### 3.1 Availability (routable tags) — repeated from §1.1 as the routing-readiness view
Best-served for routing: Leadership 256 (noisy), Career Clarity 77, Employability 70,
Family 67, Exam 56, Digital 52, Placement 38, Entrepreneurship 27, Career Transition 22,
**AI Job Disruption 12 (weakest routable context).**

### 3.2 Context Ambiguity (overlap distribution, n = 30,638)

| Contexts matched | Questions | % |
|---|---:|---:|
| **0 (context-free / generic)** | **24,652** | **80.46%** |
| 1 | 5,675 | 18.52% |
| 2 | 298 | 0.97% |
| 3 | 13 | 0.04% |

**The dominant fact of the entire audit: 80.5% of questions match none of the 10 contexts.**
The bank is overwhelmingly generic behavioural/emotional items. Cross-context overlap is
*small* (311 questions, ~1.0%) — so keyword-level ambiguity *between* contexts is low; the
real ambiguity is the enormous **context-free** mass. Many of those are *legitimately*
context-neutral (e.g. "I give up easily when something is hard") and must NOT be force-tagged.

---

## 4. Output 3b — Per-construct profile
(`construct` = each audited context theme. Coverage from §1; Risk from §5; taxonomy from §8.)

| Construct | Current coverage | Missing context(s) | Question Relevance Risk | Recommended taxonomy node |
|---|---|---|---|---|
| AI Job Disruption | **Critical gap** (0.25% Q · 12 tags · 16 concerns) | future-of-work, automation anxiety, reskilling | LOW (tiny but clean) | `AI_FUTURE_OF_WORK` |
| Career Transition | Thin (0.52% Q · 22 tags) | mid-career pivot, stream switch, re-entry | LOW | `CAREER_TRANSITION` |
| Placement Anxiety | Ambient (2.48% Q · 38 tags) | interview fear, rejection, offer-wait | LOW–MED ("interview" generic) | `PLACEMENT_ANXIETY` |
| Family Pressure | Ambient (2.26% Q · 67 tags) | parental expectation, stream imposition | LOW | `FAMILY_PRESSURE` |
| Competitive Exam Stress | Ambient (2.54% Q · 56 tags) | rank pressure, attempt fatigue | LOW | `COMPETITIVE_EXAM_PRESSURE` |
| Entrepreneurship | **Near-absent** (0.13% Q · 27 tags · 9 concerns) | founder doubt, risk appetite, venture | LOW (tiny) | `ENTREPRENEURSHIP` |
| Leadership | High but smeared (9.15% Q · 428 concerns) | team ownership, influence, delegation | **HIGH** (loose 2,803 → tight ≈1,154) | `LEADERSHIP` |
| Digital Behaviour | Moderate (1.40% Q · 52 tags) | screen overuse, online comparison | **HIGH** (loose lexicon ~½ noise) | `DIGITAL_BEHAVIOUR` |
| Employability | Moderate (3.60% Q · 70 tags) | skill-gap, industry readiness | MED ("workplace" broad) | `EMPLOYABILITY` |
| Career Clarity | Moderate (2.78% Q · 77 tags) | direction confusion, option overload | MED (overlaps generic "career") | `CAREER_CLARITY` |

---

## 5. Output (dimension 5) — Context Relevance Risk

Lexicon false-positive probes:

| Probe | Count | Implication |
|---|---:|---|
| Leadership loose (`lead|manage|influence|…`) | 2,803 | Reported coverage |
| Leadership tight (`leadership|leader|team lead|delegate`) | 1,154 | **~59% of loose matches are noise** |
| `lead(s/ing) to` (pure noise) | 146 | Confirms verb-sense leakage |
| bare word `lead` | 160 | Mostly non-leadership verb |
| Digital loose subset (`phone|online|digital`) | 331 | Broad |
| Digital tight (`social media|screen time|smartphone|scrolling|gaming`) | 186 | **~44% of the loose subset is low-relevance** |

**Risk principle:** raw keyword coverage *over-states* Leadership and Digital. Any future
Context derivation must use a **tightened, sense-disambiguated lexicon** + concern/domain
corroboration, and must record a `context_explicit` flag (lexicon-anchored vs inherited) so
relevance risk is transparent rather than buried in a single count.

---

## 6. Output 3 (deliverable) — Top 100 Context Gaps

The 100 highest-impact **(high-value concern domain × context)** cells with **zero** question
coverage (domain joined to clarity via `master_bridge_tag`; domains restricted to ≥8 concerns;
ranked by domain size). Grouped by domain; each missing context is one of the 100 gap cells.

| # range | Concern domain (size) | Missing contexts (zero coverage) |
|---|---|---|
| 1–3 | Confidence, Self-Concept & Comparison (181) | AI, Career Transition, Entrepreneurship |
| 4–7 | Academic & Cognitive Effectiveness (140) | AI, Career Clarity, Career Transition, Entrepreneurship |
| 8–13 | Communication & Expression (137) | AI, Career Transition, Competitive Exam, Digital, Entrepreneurship, Leadership |
| 14–16 | Motivation, Values & Responsibility (129) | AI, Career Transition, Entrepreneurship |
| 17–24 | Examination Stress & Emotional Regulation (119) | AI, Career Clarity, Career Transition, Digital, Entrepreneurship, Family, Leadership, Placement |
| 25–30 | Lifestyle & Pressure Environment (116) | AI, Career Clarity, Career Transition, Entrepreneurship, Family, Placement |
| 31–34 | Discipline, Habits & Consistency (103) | AI, Career Clarity, Career Transition, Entrepreneurship |
| 35 | Emotional Regulation (96) | Entrepreneurship |
| 36–41 | Thinking Quality Under Pressure (92) | AI, Career Transition, Competitive Exam, Digital, Employability, Entrepreneurship |
| 42–48 | Academic Identity & Meaning (87) | AI, Career Transition, Competitive Exam, Digital, Employability, Entrepreneurship, Placement |
| 49–51 | Social & Emotional Intelligence (81) | AI, Career Transition, Entrepreneurship |
| 52–57 | Leadership & Ownership (80) | AI, Career Transition, Competitive Exam, Digital, Entrepreneurship, Placement |
| 58–59 | Career Readiness (71) | AI, Digital |
| 60–68 | Examination Readiness (54) | AI, Career Clarity, Career Transition, Digital, Employability, Entrepreneurship, Family, Leadership, Placement |
| 69–70 | Competency Development (52) | Career Transition, Entrepreneurship |
| 71–74 | Emotional Recovery (52) | AI, Career Transition, Digital, Entrepreneurship |
| 75–77 | Employability (46) | AI, Career Transition, Entrepreneurship |
| 78–81 | Holistic Development (46) | AI, Digital, Entrepreneurship, Placement |
| 82 | Workplace Adaptation (46) | Entrepreneurship |
| 83–85 | Adjustment & Coping Capacity (43) | AI, Employability, Entrepreneurship |
| 86–93 | Collaboration & Ownership (43) | AI, Career Clarity, Career Transition, Competitive Exam, Digital, Entrepreneurship, Family, Placement |
| 94–96 | Career Growth (35) | AI, Competitive Exam, Entrepreneurship |
| 97–100 | Strategic Preparation (35) | AI, Career Clarity, Career Transition, Employability |

**Pattern:** **Entrepreneurship (23 cells) and AI Job Disruption (22 cells)** dominate the
gap list — they are missing from almost every major domain. Career Transition (18) and
Digital (12) follow. These are the priority authoring/tagging targets.

---

## 7. Output 4 — Context Intelligence Architecture (proposed — NOT built)

### 7.1 Why a new layer
No explicit context field exists; the only proxies are unusable as an axis:
`domain` (351 fragmented values, most size-1), `contextual_modifier` (capability-flavoured),
`common_indian_context` (genuine but sparse free-text). Context must be a **derived sidecar**,
exactly like L5A Stage.

### 7.2 Components (all additive, read-only, flag-gated)
- **Derivation** (pure, deterministic, mirrors L5A weighted-vote): inputs = tightened
  question lexicon (strongest, sense-disambiguated) + concern `domain` + bridge tag +
  `common_indian_context` phrase. Output per clarity row: **Primary Context · Secondary
  Context · Context Confidence (HIGH/MOD/LOW) · `context_explicit` bool · relevance_risk**.
  No match ⇒ `GENERAL` (honest, not forced); noisy single-signal ⇒ low confidence.
- **Sidecar table `wc3_question_context`**, PK = clarity SERIAL `id` (NOT `question_id` —
  non-unique, L5A lesson). One row per clarity question. No edits to existing tables.
- **Flag `wc3ContextIntel` / `FF_WC3_CONTEXT_INTEL`**, default **OFF**; offline-derived, no
  request path reads it ⇒ byte-identical ON/OFF. Reversible = drop table + flag.
- **Metric services (read-only, productizing this audit):** Coverage (§1), Drift (§2),
  Availability+Ambiguity (§3), Relevance Risk (§5), Gap report (§6) with an availability floor.
- **Layer fit:** Context sits beneath L1→L2→L3 as an orthogonal axis; L3 Journey routing and
  L2 Outcome can later *read* context (behind the flag) to bias route/model selection — but
  that wiring is a **separate future phase**, not part of this design.

### 7.3 Boundaries
Additive · flag default OFF · byte-identical OFF · reversible · no ontology/signal/concern
mutation · gaps & ambiguity surfaced for **human** authoring/tagging, never auto-generated.

---

## 8. Output 5 — Context Taxonomy Proposal

Closed, version-stamped, human-owned enum. Tier-1 audited (10) + Tier-2 adjacent (observed
in `common_indian_context`/domains) + honest catch-alls:

**Tier-1 (audited):** `AI_FUTURE_OF_WORK`, `CAREER_TRANSITION`, `PLACEMENT_ANXIETY`,
`FAMILY_PRESSURE`, `COMPETITIVE_EXAM_PRESSURE`, `ENTREPRENEURSHIP`, `LEADERSHIP`,
`DIGITAL_BEHAVIOUR`, `EMPLOYABILITY`, `CAREER_CLARITY`.
**Tier-2 (candidates):** `FINANCIAL_PRESSURE`, `PEER_SOCIAL_COMPARISON`,
`RELOCATION_MIGRATION`, `IDENTITY_BELONGING`, `HIGHER_EDUCATION_CHOICE`, `WORKPLACE_ADJUSTMENT`.
**Catch-alls:** `GENERAL` (legitimately context-neutral — expected on the ~80% mass) ·
`UNRESOLVED` (ambiguous/low-confidence). Each node carries: tight lexicon, sense-exclusions
(e.g. Leadership excludes "lead to"), corroborating domains, and an availability floor.

---

## 9. Output 6 — Expected Question Intelligence Improvement

QIS Context dimension weight = **0.10** (per `WC3_L5_QUESTION_INTELLIGENCE.md` §1.4;
`QIS = 100 × Σ wᵢ·resolvedᵢ·confᵢ`). Honest projection of the **Context dimension's
contribution** (max 10.0 pts):

| State | Resolved fraction | Mean confidence/relevance | Context-dim contribution |
|---|---:|---:|---:|
| **Today** (raw, noisy) | 0.195 (specific-context only) | ~0.50 | **~1.0 / 10.0** |
| After taxonomy + tagging + targeted authoring | ~0.65 | ~0.65 | **~4.2 / 10.0** |

**Projected QIS gain ≈ +3.0 to +3.9 points (system-wide).** This is deliberately modest and
honest: the Context dimension is **structurally bounded to roughly half its ceiling** because
~80% of the bank is *legitimately* context-neutral and must not be force-tagged (forcing =
fabrication). The larger, non-QIS payoff is **operational**: the ability to *retrieve and
route* context-specific questions (today impossible — no context field) and to surface the
§6 gaps as an authoring backlog. Improvement claims will track real coverage, never inflated.

---

## 10. STOP

This is the audit + architecture deliverable for L5B. **No code has been written.** Awaiting
approval before implementing (taxonomy, flag, sidecar table + migration, derivation, metric
services).
