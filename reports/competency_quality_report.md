# Competency Data Quality Review — Phase 1.3

*Generated 2026-06-22 · Source of truth: `onto_competencies` (live PostgreSQL) · Read-only review, no rows modified.*

---

## 0. Implementation status (honest)

**Phase 1.3 was never built.** The Competency Framework Intelligence code ships Phases **1.1, 1.2, 1.4, 1.5, 1.6, 1.7** (markers in `backend/routes/competency-intelligence.ts`) — there is **no 1.3** module, route, or table. This document is the missing Phase-1.3 deliverable, produced as a one-off data-quality audit. It is **read-only**: nothing in the database was merged, renamed, or deleted. Per project policy, cleanup actions below **stop for approval** before any mutation.

## 1. Method & honest limitations

- **Scope:** all **299** rows in `onto_competencies` (the canonical master — the “~300 competencies”). Other competency tables (`competency_library`, `competency_catalog`, `ont_competencies`, …) are **empty** in this environment and were excluded.
- **Axes available:** `canonical_name`, `domain_id` (5 domains), `family_id`, `scientific_type` (behavioral, cognitive, functional), `definition`, `deprecated`.
- **Technique:** name normalization (lowercase, strip punctuation & parentheticals, drop noise words like *skills/professional/and*), then (a) exact-name match, (b) token-set match (order/qualifier-insensitive), and (c) pairwise fuzzy similarity (string ratio + token Jaccard). Each candidate pair was then **manually adjudicated** against domain / family / type.

> **⚠️ Critical limitation — definitions are placeholders.** Every `definition` is an auto-generated template of the form *“X — canonical competency in the Y family.”* They carry **no real semantic content**, so true meaning-based de-duplication is impossible from the data alone. All judgements below rest on **names + taxonomy (domain/family/type)**. **Authoring real definitions is itself the single highest-value cleanup action** — see §6. This is reported as a Coverage gap (the field exists) separate from Confidence (it is not trustworthy for dedup).

## 2. Scorecard

| Check | Result |
|---|---|
| Total competencies reviewed | **299** |
| Deprecated flags set | **0** (none) |
| Exact duplicate names | **0** (none) |
| Literal “(duplicate)” / dup markers | **0** (none) |
| Name-variant duplicate groups (order/qualifier) | **5** confirmed + 7 lower-confidence |
| Near-duplicate pairs flagged by similarity | **73** (most are *distinct* — see §5) |
| Genuine classification conflicts | **3** |
| High-confidence merge groups recommended | **6** |
| Medium-confidence merge groups recommended | **7** |

**Headline:** the master is **clean of literal duplicates** (no identical names, no `(duplicate)` markers, nothing flagged `deprecated`). The real issues are **naming inconsistency** (word-order & qualifier variants of the same construct) and **classification inconsistency** (the same construct filed under different `scientific_type`s).

## 3. Duplicates & merge recommendations

### 3a. High-confidence merges (name-variants of one construct — same domain, family & type)

| Merge these | → Retain | Why |
|---|---|---|
| **Building Trust** (behavioral/dom_interpersonal) · **Trust Building** (behavioral/dom_interpersonal) | **Building Trust** | Word-order variant; identical domain (interpersonal) & type (behavioral) & family. |
| **Integrity** (behavioral/dom_strategic) · **Professional Integrity** (behavioral/dom_strategic) | **Integrity** | “Professional” adds no distinct construct; both behavioral / Governance & Ethics. |
| **Knowledge Sharing** (functional/dom_functional) · **Sharing Knowledge** (functional/dom_functional) | **Knowledge Sharing** | Word-order variant; identical domain/type/family (Operational Excellence). |
| **Persuasion** (behavioral/dom_interpersonal) · **Persuasion Skills** (behavioral/dom_interpersonal) | **Persuasion** | “Skills” suffix is noise; identical domain/type/family (Stakeholder Influence). |
| **Work Ethic** (behavioral/dom_behavioral) · **Strong Work Ethic** (behavioral/dom_behavioral) | **Work Ethic** | “Strong” is a proficiency level, not a separate competency; family is literally “Work Ethic”. |
| **Ambiguity Tolerance** (behavioral/dom_behavioral) · **Tolerance for Ambiguity** (behavioral/dom_behavioral) | **Ambiguity Tolerance** | Exact synonym / word-order; both behavioral. |

### 3b. Medium-confidence merges (qualifier/context noise — same type; SME confirm)

| Merge these | → Retain | Why |
|---|---|---|
| **Prioritization** (functional/dom_functional) · **Task Prioritization** (functional/dom_functional) | **Prioritization** | “Task” is implied context; identical domain (functional) & type. |
| **Presentation Skills** (behavioral/dom_interpersonal) · **Formal Presentation Skills** (behavioral/dom_interpersonal) | **Presentation Skills** | “Formal” + “Skills” are noise; identical domain/type. |
| **Constructive Feedback** (behavioral/dom_interpersonal) · **Providing Constructive Feedback** (behavioral/dom_interpersonal) | **Constructive Feedback** | Action-phrasing variant; identical domain/type. |
| **Conflict Resolution** (behavioral/dom_interpersonal) · **Workplace Conflict Resolution** (behavioral/dom_interpersonal) | **Conflict Resolution** | “Workplace” is implied context; identical domain/type. |
| **Adaptability** (behavioral/dom_behavioral) · **Quick Adaptability** (behavioral/dom_behavioral) | **Adaptability** | “Quick” is a speed qualifier, not a distinct construct; identical domain/type. |
| **Safety Focus** (behavioral/dom_strategic) · **Workplace Safety Focus** (behavioral/dom_strategic) | **Safety Focus** | “Workplace” is implied context; identical domain (strategic) & type. |
| **Diversity Awareness** (behavioral/dom_interpersonal) · **Diversity & Inclusion Awareness** (behavioral/dom_interpersonal) | **Diversity & Inclusion Awareness** | Same construct; keep the broader canonical label. |

## 4. Conflicting competencies (same construct, inconsistent classification)

These are **not** simple duplicates: the same idea appears under **different `scientific_type` / `domain`**, so a merge must first decide the correct classification. They also reveal a **systemic taxonomy-governance gap** (see §6).

| Conflicting pair | Conflict & recommended resolution |
|---|---|
| **Delegation** (behavioral/dom_behavioral) · **Task Delegation** (functional/dom_functional) | Same concept split across types: Delegation=behavioral/dom_behavioral vs Task Delegation=functional/dom_functional. Pick ONE type (recommend behavioral “Delegation”), then merge. |
| **Collaboration** (behavioral/dom_interpersonal) · **Agile Collaboration** (cognitive/dom_strategic) | “Agile Collaboration” is typed cognitive/dom_strategic while “Collaboration” is behavioral/dom_interpersonal. Likely a context of the same construct; reconcile type before deciding merge vs parent-child. |
| **Relationship Building** (behavioral/dom_interpersonal) · **Customer Relationship Building** (functional/dom_functional) | Same construct across two types (interpersonal vs functional). Either merge or keep as an explicit parent-child with a single owning type. |

## 5. Near-duplicates reviewed → RETAIN (distinct despite similar names)

High string-similarity does **not** mean duplicate. The following were flagged by the algorithm but are **legitimately distinct** and should be kept as-is (over-merging would destroy real signal):

| Pair / set | Why they are distinct |
|---|---|
| **Stakeholder Engagement** (behavioral/dom_interpersonal) · **Stakeholder Management** (behavioral/dom_interpersonal) | Engagement (relationship) vs Management (control/coordination) are different constructs. |
| **Volunteer Engagement** (behavioral/dom_interpersonal) · **Volunteer Management** (behavioral/dom_interpersonal) | Engagement vs Management — different constructs. |
| **Attention to Deadlines** (functional/dom_functional) · **Attention to Detail** (functional/dom_functional) | Timeliness vs accuracy — unrelated despite shared prefix. |
| **Personal Credibility** (behavioral/dom_behavioral) · **Personal Responsibility** (behavioral/dom_behavioral) | Trust/reputation vs accountability — different constructs. |
| **Goal Orientation** (behavioral/dom_behavioral) · **People Orientation** (behavioral/dom_interpersonal) | Task-focus vs people-focus — different constructs. |
| **Open Communication** (behavioral/dom_interpersonal) · **Written Communication** (behavioral/dom_interpersonal) | Transparency style vs channel/medium — different constructs. |
| **Communication** (behavioral/dom_interpersonal) · **Open Communication** (behavioral/dom_interpersonal) | Umbrella vs a specific style; keep as parent / child, not a duplicate. |
| **Leadership** (behavioral/dom_interpersonal) · **Team Leadership** (behavioral/dom_interpersonal) | Umbrella vs team-scoped; keep as parent / child. |
| **Motivation** (behavioral/dom_behavioral) · **Self-Motivation** (behavioral/dom_behavioral) · **Team Motivation** (behavioral/dom_interpersonal) | General drive vs self-directed vs motivating-others — three distinct targets. |
| **Process Orientation** (functional/dom_functional) · **Results Orientation** (behavioral/dom_behavioral) | Process-focus vs outcome-focus — opposite emphases, not duplicates. |
| **Commercial Awareness** (cognitive/dom_strategic) · **Social Awareness** (behavioral/dom_behavioral) | Business acumen vs interpersonal/emotional awareness — unrelated. |
| **Energy Management** (behavioral/dom_behavioral) · **Vendor Management** (functional/dom_functional) | Personal energy/resilience vs supplier management — false positive on “Management”. |
| **Inspirational Leadership** (behavioral/dom_interpersonal) · **Transformational Leadership** (cognitive/dom_strategic) | Distinct leadership styles; note the type split (interpersonal vs strategic) is a separate taxonomy issue. |
| **Customer Focus** (functional/dom_functional) · **Customer Retention Focus** (functional/dom_functional) | General orientation vs retention-specific KPI focus — distinct. |

### Needs subject-matter-expert (SME) decision

| Set | Note |
|---|---|
| **Decision-Making** (cognitive/dom_cognitive) · **Quick Decision Making** (cognitive/dom_cognitive) · **Sound Decision Making** (cognitive/dom_cognitive) · **Balanced Decision Making** (cognitive/dom_cognitive) · **Ethical Decision Making** (cognitive/dom_cognitive) · **Operational Decision Making** (cognitive/dom_cognitive) | Six “* Decision Making” entries (all cognitive). Recommend: keep “Decision-Making” as the parent; MERGE the quality-adjective variants (Quick / Sound / Balanced) into it; RETAIN the genuine context variants (Ethical, Operational) as distinct. SME sign-off required. |
| **Risk-Taking** (behavioral/dom_strategic) · **Informed Risk Taking** (behavioral/dom_strategic) | “Informed” adds a real qualifier (deliberate vs general). Lean RETAIN, but confirm with SME they are not the same bar. |
| **Risk Management** (behavioral/dom_strategic) · **Enterprise Risk Management** (behavioral/dom_strategic) | ERM is an organizational-scope specialization. Lean RETAIN as parent-child; confirm scope intent. |

## 6. Cleanup actions (recommended — NOT executed; require approval)

Ordered by value. Nothing here was run; all are proposals.

1. **Author real definitions for all 299 competencies.** The placeholder definitions are the biggest quality gap — they block rigorous dedup and weaken every downstream engine that reads them. *(Highest value.)*
2. **Apply the 6 high-confidence merges (§3a).** For each: keep the canonical row, repoint any references, and either delete the variant or set `deprecated=true` + `deprecated_replacement_id` (the schema already supports this — it is currently unused).
3. **Resolve the 3 classification conflicts (§4)** by agreeing the correct `scientific_type`/`domain` for each construct *before* merging.
4. **Adjudicate the medium-confidence merges (§3b) and the Decision-Making family (§5)** with an SME, then apply.
5. **Add a uniqueness/consistency guard:** a naming convention (canonical noun-phrase, no trailing “Skills”, no speed/quality adjectives) + a CI check on token-set collisions so new variants can't re-enter.
6. **Adopt the soft-delete path:** prefer `deprecated=true` + `deprecated_replacement_id` over hard deletes so historical scores remain resolvable.

> **Suggested non-destructive mechanism for merges (illustrative — do not run without approval):**
> ```sql
> UPDATE onto_competencies
>   SET deprecated = true, deprecated_replacement_id = '<canonical_id>', updated_at = now()
> WHERE id = '<variant_id>';
> ```
> Repoint dependent tables (e.g. `onto_competency_type_map`, `map_role_competency`, score tables) to `<canonical_id>` in the same transaction.

## Appendix A — All similarity-flagged pairs (live, unfiltered)

All **73** pairs above the similarity threshold, sorted by strength. `DIFF-TYPE` = the two sit under different `scientific_type`. This is the raw evidence behind §3–§5; inclusion here is **not** a merge recommendation.

| string | jaccard | A (type/domain) | B (type/domain) | flag |
|---:|---:|---|---|---|
| 0.57 | 1.00 | Building Trust (behavioral/dom_interpersonal) | Trust Building (behavioral/dom_interpersonal) | same-domain |
| 0.58 | 1.00 | Integrity (behavioral/dom_strategic) | Professional Integrity (behavioral/dom_strategic) | same-domain |
| 0.53 | 1.00 | Knowledge Sharing (functional/dom_functional) | Sharing Knowledge (functional/dom_functional) | same-domain |
| 0.74 | 1.00 | Persuasion (behavioral/dom_interpersonal) | Persuasion Skills (behavioral/dom_interpersonal) | same-domain |
| 0.74 | 1.00 | Strong Work Ethic (behavioral/dom_behavioral) | Work Ethic (behavioral/dom_behavioral) | same-domain |
| 0.91 | 0.33 | Stakeholder Engagement (behavioral/dom_interpersonal) | Stakeholder Management (behavioral/dom_interpersonal) | same-domain |
| 0.90 | 0.33 | Volunteer Engagement (behavioral/dom_interpersonal) | Volunteer Management (behavioral/dom_interpersonal) | same-domain |
| 0.85 | 0.50 | Prioritization (functional/dom_functional) | Task Prioritization (functional/dom_functional) | same-domain |
| 0.84 | 0.50 | Formal Presentation Skills (behavioral/dom_interpersonal) | Presentation Skills (behavioral/dom_interpersonal) | same-domain |
| 0.84 | 0.33 | Process Orientation (functional/dom_functional) | Results Orientation (behavioral/dom_behavioral) | DIFF-TYPE |
| 0.84 | 0.50 | Ethical Decision Making (cognitive/dom_cognitive) | Operational Decision Making (cognitive/dom_cognitive) | same-domain |
| 0.84 | 0.50 | Communication (behavioral/dom_interpersonal) | Open Communication (behavioral/dom_interpersonal) | same-domain |
| 0.84 | 0.33 | Personal Credibility (behavioral/dom_behavioral) | Personal Responsibility (behavioral/dom_behavioral) | same-domain |
| 0.83 | 0.33 | Commercial Awareness (cognitive/dom_strategic) | Social Awareness (behavioral/dom_behavioral) | DIFF-TYPE |
| 0.83 | 0.67 | Decision-Making (cognitive/dom_cognitive) | Quick Decision Making (cognitive/dom_cognitive) | same-domain |
| 0.83 | 0.67 | Decision-Making (cognitive/dom_cognitive) | Sound Decision Making (cognitive/dom_cognitive) | same-domain |
| 0.83 | 0.50 | Attention to Deadlines (functional/dom_functional) | Attention to Detail (functional/dom_functional) | same-domain |
| 0.82 | 0.67 | Customer Relationship Building (functional/dom_functional) | Relationship Building (behavioral/dom_interpersonal) | DIFF-TYPE |
| 0.82 | 0.33 | Energy Management (behavioral/dom_behavioral) | Vendor Management (functional/dom_functional) | DIFF-TYPE |
| 0.82 | 0.33 | Goal Orientation (behavioral/dom_behavioral) | People Orientation (behavioral/dom_interpersonal) | cross-domain |
| 0.82 | 0.33 | Inspirational Leadership (behavioral/dom_interpersonal) | Transformational Leadership (cognitive/dom_strategic) | DIFF-TYPE |
| 0.82 | 0.33 | Open Communication (behavioral/dom_interpersonal) | Written Communication (behavioral/dom_interpersonal) | same-domain |
| 0.81 | 0.50 | Agile Collaboration (cognitive/dom_strategic) | Collaboration (behavioral/dom_interpersonal) | DIFF-TYPE |
| 0.81 | 0.67 | Constructive Feedback (behavioral/dom_interpersonal) | Providing Constructive Feedback (behavioral/dom_interpersonal) | same-domain |
| 0.80 | 0.50 | Adaptability (behavioral/dom_behavioral) | Quick Adaptability (behavioral/dom_behavioral) | same-domain |
| 0.80 | 0.50 | Delegation (behavioral/dom_behavioral) | Task Delegation (functional/dom_functional) | DIFF-TYPE |
| 0.80 | 0.50 | Leadership (behavioral/dom_interpersonal) | Team Leadership (behavioral/dom_interpersonal) | same-domain |
| 0.80 | 0.50 | Motivation (behavioral/dom_behavioral) | Self-Motivation (behavioral/dom_behavioral) | same-domain |
| 0.80 | 0.50 | Motivation (behavioral/dom_behavioral) | Team Motivation (behavioral/dom_interpersonal) | cross-domain |
| 0.79 | 0.67 | Conflict Resolution (behavioral/dom_interpersonal) | Workplace Conflict Resolution (behavioral/dom_interpersonal) | same-domain |
| 0.79 | 0.67 | Diversity & Inclusion Awareness (behavioral/dom_interpersonal) | Diversity Awareness (behavioral/dom_interpersonal) | same-domain |
| 0.79 | 0.67 | Decision-Making (cognitive/dom_cognitive) | Ethical Decision Making (cognitive/dom_cognitive) | same-domain |
| 0.77 | 0.67 | Balanced Decision Making (cognitive/dom_cognitive) | Decision-Making (cognitive/dom_cognitive) | same-domain |
| 0.77 | 0.50 | Communication (behavioral/dom_interpersonal) | Written Communication (behavioral/dom_interpersonal) | same-domain |
| 0.76 | 0.50 | Accountability (behavioral/dom_behavioral) | Personal Accountability (behavioral/dom_behavioral) | same-domain |
| 0.75 | 0.50 | Problem-Solving (behavioral/dom_behavioral) | Real-Time Problem Solving (behavioral/dom_behavioral) | same-domain |
| 0.75 | 0.50 | Return on Time Management (functional/dom_functional) | Time Management (functional/dom_functional) | same-domain |
| 0.74 | 0.50 | Accountability (behavioral/dom_behavioral) | Workplace Accountability (behavioral/dom_behavioral) | same-domain |
| 0.74 | 0.67 | Customer Focus (functional/dom_functional) | Customer Retention Focus (functional/dom_functional) | same-domain |
| 0.73 | 0.67 | Enterprise Risk Management (behavioral/dom_strategic) | Risk Management (behavioral/dom_strategic) | same-domain |
| 0.73 | 0.50 | Judgment (cognitive/dom_cognitive) | Sound Judgment (cognitive/dom_cognitive) | same-domain |
| 0.72 | 0.50 | Assertive Communication (behavioral/dom_interpersonal) | Communication (behavioral/dom_interpersonal) | same-domain |
| 0.71 | 0.50 | Data-Driven Decision Making (cognitive/dom_cognitive) | Decision-Making (cognitive/dom_cognitive) | same-domain |
| 0.71 | 0.67 | Decision-Making (cognitive/dom_cognitive) | Operational Decision Making (cognitive/dom_cognitive) | same-domain |
| 0.71 | 0.50 | Leadership (behavioral/dom_interpersonal) | Servant Leadership (behavioral/dom_interpersonal) | same-domain |
| 0.71 | 0.67 | Informed Risk Taking (behavioral/dom_strategic) | Risk-Taking (behavioral/dom_strategic) | same-domain |
| 0.71 | 0.67 | Safety Focus (behavioral/dom_strategic) | Workplace Safety Focus (behavioral/dom_strategic) | same-domain |
| 0.70 | 0.50 | Communication (behavioral/dom_interpersonal) | Persuasive Communication (behavioral/dom_interpersonal) | same-domain |
| 0.69 | 0.50 | Engaging Leadership (behavioral/dom_interpersonal) | Leadership (behavioral/dom_interpersonal) | same-domain |
| 0.69 | 0.50 | Personal Resilience (behavioral/dom_behavioral) | Resilience (behavioral/dom_behavioral) | same-domain |
| 0.69 | 0.50 | Flexibility (behavioral/dom_behavioral) | Workforce Flexibility (behavioral/dom_interpersonal) | cross-domain |
| 0.68 | 0.50 | Collaboration (behavioral/dom_interpersonal) | Stakeholder Collaboration (behavioral/dom_interpersonal) | same-domain |
| 0.68 | 0.50 | Communication (behavioral/dom_interpersonal) | Transparent Communication (behavioral/dom_strategic) | cross-domain |
| 0.68 | 0.50 | Confidence in Decision Making (cognitive/dom_cognitive) | Decision-Making (cognitive/dom_cognitive) | same-domain |
| 0.68 | 0.50 | Design Thinking (cognitive/dom_cognitive) | User-Centered Design Thinking (cognitive/dom_cognitive) | same-domain |
| 0.43 | 0.67 | Ambiguity Tolerance (behavioral/dom_behavioral) | Tolerance for Ambiguity (behavioral/dom_behavioral) | same-domain |
| 0.67 | 0.50 | Ethical Judgment (cognitive/dom_cognitive) | Judgment (cognitive/dom_cognitive) | same-domain |
| 0.65 | 0.50 | Dependable Leadership (behavioral/dom_interpersonal) | Leadership (behavioral/dom_interpersonal) | same-domain |
| 0.65 | 0.50 | Innovation (cognitive/dom_cognitive) | Innovation Leadership (cognitive/dom_cognitive) | same-domain |
| 0.65 | 0.50 | Innovation Leadership (cognitive/dom_cognitive) | Leadership (behavioral/dom_interpersonal) | DIFF-TYPE |
| 0.64 | 0.50 | Balanced Judgment (cognitive/dom_cognitive) | Judgment (cognitive/dom_cognitive) | same-domain |
| 0.62 | 0.50 | Accountable Leadership (behavioral/dom_interpersonal) | Leadership (behavioral/dom_interpersonal) | same-domain |
| 0.62 | 0.50 | Leadership (behavioral/dom_interpersonal) | Transparent Leadership (behavioral/dom_strategic) | cross-domain |
| 0.62 | 0.50 | Integrity (behavioral/dom_strategic) | Integrity and Ethics (behavioral/dom_strategic) | same-domain |
| 0.62 | 0.50 | Ownership (behavioral/dom_behavioral) | Ownership of Results (behavioral/dom_behavioral) | same-domain |
| 0.59 | 0.50 | Inspirational Leadership (behavioral/dom_interpersonal) | Leadership (behavioral/dom_interpersonal) | same-domain |
| 0.58 | 0.50 | Curiosity (cognitive/dom_cognitive) | Intellectual Curiosity (cognitive/dom_cognitive) | same-domain |
| 0.57 | 0.50 | Commitment (behavioral/dom_behavioral) | Organizational Commitment (behavioral/dom_behavioral) | same-domain |
| 0.56 | 0.50 | Active Listening (behavioral/dom_interpersonal) | Listening Skills (behavioral/dom_interpersonal) | same-domain |
| 0.56 | 0.50 | Delegation (behavioral/dom_behavioral) | Delegation and Empowerment (behavioral/dom_behavioral) | same-domain |
| 0.55 | 0.50 | Careful Listening (behavioral/dom_interpersonal) | Listening Skills (behavioral/dom_interpersonal) | same-domain |
| 0.54 | 0.50 | Leadership (behavioral/dom_interpersonal) | Transformational Leadership (cognitive/dom_strategic) | DIFF-TYPE |
| 0.43 | 0.50 | Integrity and Ethics (behavioral/dom_strategic) | Professional Integrity (behavioral/dom_strategic) | same-domain |

---

*End of report. 299 competencies reviewed; 0 modified. Read-only Phase-1.3 audit.*
