# Competency Data Quality Review — Phase 1.3

**Scope:** All competencies in `onto_competencies` (the canonical genome).
**Date:** 2026-06-18
**Mode:** Read-only review. **No data was modified.** Every item below is a *recommendation* and is subject to the standing approval gate (STOP for approval before any merge/cleanup).

> **Honesty note on the count.** The task says "review all 300 competencies." The live table contains **299** rows, not 300. This report covers the actual 299. The "300" is treated as a round target, not a fabricated row.

---

## 1. Methodology (how candidates were detected)

Detection ran over `canonical_name`, `slug`, `family_id`, `domain_id`, `scientific_type`, `definition` for all 299 rows. Three independent signals were combined:

1. **Exact-match** on normalized name and on slug.
2. **Token-set Jaccard** after lower-casing, removing punctuation, dropping generic stopwords (`skills`, `ability`, `management`, `and`, `of`, `the`, …) and light stemming (`-ing`, `-ed`, `-ship`, `-ity`, plurals). Threshold ≥ 0.5.
3. **Character similarity** (1 − normalized Levenshtein) ≥ 0.72, plus a **subset test** (one name's token set fully contained in the other).

The raw detector returned **139 candidate pairs**. These were then **manually adjudicated** into the categories below. Pairs that match only on a shared generic suffix (e.g. "Cost Management" ↔ "Risk Management" — share only the word *Management*) are **deliberately excluded as false positives** and listed in §7 so the cleanup is not over-aggressive.

**Confidence tiers used:**
- **T1 — True duplicate**: same meaning, only word order / plural / a non-distinguishing qualifier differs. Safe to merge.
- **T2 — Strong near-duplicate**: a qualifier (e.g. *Strong*, *Personal*, *Workplace*) that adds no measurable construct difference. Recommended merge, light review.
- **T3 — Overlap / review**: names are close but the qualifier *may* carry a real, separately-assessable construct. Lean **retain**; flagged for SME decision.

---

## 2. Exact Duplicates

- **Exact `canonical_name` duplicates: 0**
- **Exact `slug` duplicates: 0**

There are **no byte-identical** duplicate competencies. All duplication below is *semantic* (synonyms / word-order / qualifier variants), not literal. This is a good baseline — the genome has no copy-paste rows.

---

## 3. Duplicate & Near-Duplicate Competencies

### 3a. True Duplicates — **T1** (recommend MERGE)

These are the same construct expressed differently. Same family in every case.

| # | Members (id) | Family | Signal | Recommended canonical |
|---|---|---|---|---|
| D1 | Building Trust (`comp_building_trust`) · Trust Building (`comp_trust_building`) | relationship_management | Jaccard 1.0 | **Trust Building** |
| D2 | Ambiguity Tolerance (`comp_ambiguity_tolerance`) · Tolerance for Ambiguity (`comp_tolerance_for_ambiguity`) | resilience | Jaccard 1.0 | **Tolerance for Ambiguity** |
| D3 | Knowledge Sharing (`comp_knowledge_sharing`) · Sharing Knowledge (`comp_sharing_knowledge`) | operational_excellence | Jaccard 1.0 | **Knowledge Sharing** |
| D4 | Persuasion (`comp_persuasion`) · Persuasion Skills (`comp_persuasion_skills`) | stakeholder_influence | subset, "Skills" is filler | **Persuasion** |
| D5 | Listening Skills (`comp_listening_skills`) · Active Listening (`comp_active_listening`) · Careful Listening (`comp_careful_listening`) | communication | subset | **Active Listening** |
| D6 | Integrity (`comp_integrity`) · Professional Integrity (`comp_professional_integrity`) · Integrity and Ethics (`comp_integrity_and_ethics`) | governance_ethics | subset | **Integrity** |
| D7 | Mentorship (`comp_mentorship`) · Mentoring Others (`comp_mentoring_others`) | coaching_mentoring | subset | **Mentorship** |

> D5 and D6 are the exact examples named in the task brief; the data confirms them.

### 3b. Strong Near-Duplicates — **T2** (recommend MERGE, light review)

Qualifier adds no separately-assessable construct. All same-family.

| # | Members | Family | Recommended canonical |
|---|---|---|---|
| N1 | Work Ethic · Strong Work Ethic | work_ethic | **Work Ethic** |
| N2 | Resilience · Personal Resilience | resilience | **Resilience** |
| N3 | Accountability · Personal Accountability · Workplace Accountability | work_ethic | **Accountability** |
| N4 | Prioritization · Task Prioritization | project_delivery | **Prioritization** |
| N5 | Presentation Skills · Formal Presentation Skills | communication | **Presentation Skills** |
| N6 | Safety Focus · Workplace Safety Focus | risk_sustainability | **Safety Focus** |
| N7 | Conflict Resolution · Workplace Conflict Resolution | leadership | **Conflict Resolution** |
| N8 | Constructive Feedback · Providing Constructive Feedback | coaching_mentoring | **Constructive Feedback** |
| N9 | Diversity Awareness · Diversity & Inclusion Awareness | empathy_diversity | **Diversity & Inclusion Awareness** |
| N10 | Ownership · Ownership of Results | work_ethic | **Ownership** |
| N11 | Adaptability · Quick Adaptability | resilience | **Adaptability** |
| N12 | Commitment · Organizational Commitment | work_ethic | **Organizational Commitment** (review: org-scope may matter) |
| N13 | Patience · Patience with Others · Patience in Adversity | resilience | **Patience** |
| N14 | Stress Management · Stress Tolerance | self_regulation | **Stress Management** (review: tolerance vs active mgmt) |
| N15 | Effective Time Use · Time Management | operational_excellence | **Time Management** |
| N16 | Design Thinking · User-Centered Design Thinking | innovation | **Design Thinking** |
| N17 | Change Advocacy · Change Management | change_transformation | review (advocacy ⊂ management) |
| N18 | Project Execution · Project Management | project_delivery | review (execution ⊂ management) |
| N19 | Volunteer Engagement · Volunteer Management | team_dynamics | **Volunteer Management** |
| N20 | Customer Focus · Customer Retention Focus | customer_excellence | review (retention is a sub-goal) |

### 3c. Cluster overlaps — **T3** (lean RETAIN; SME decision)

Large families where a base term co-exists with many qualified variants. Some variants are *legitimately distinct*; others are quality-adjective restatements. Recommendation is **split, not bulk-merge**.

**Decision-Making cluster** (`fam_decision_making`):
- **Retain (distinct context):** Decision-Making, Ethical Decision Making, Data-Driven Decision Making, Operational Decision Making.
- **Merge candidates into Decision-Making (adjective-only):** Quick Decision Making, Sound Decision Making, Balanced Decision Making, Confidence in Decision Making.

**Judgment cluster** (`fam_decision_making`):
- **Retain:** Judgment, Ethical Judgment.
- **Merge candidates → Judgment:** Sound Judgment, Balanced Judgment. (Fairness in Judgment — see §4, family conflict.)

**Communication cluster** (`fam_communication`):
- **Retain (distinct modality):** Communication, Written Communication, Assertive Communication, Persuasive Communication.
- **Merge candidates → Communication:** Open Communication. (Transparent Communication — see §4, family conflict.)

**Leadership cluster** (`fam_leadership`):
- **Retain (recognised leadership styles):** Leadership, Team Leadership, Servant Leadership, Transformational Leadership, Inspirational Leadership, Innovation Leadership.
- **Merge / review (vague qualifiers):** Engaging Leadership, Dependable Leadership, Accountable Leadership, Positivity in Leadership, Purpose-Driven Leadership. (Transparent Leadership — see §4.)

**Risk cluster** (`fam_risk_sustainability`):
- **Retain (distinct facet):** Risk Management, Risk Awareness, Enterprise Risk Management.
- **Risk-appetite synonyms → review/merge:** Risk-Taking, Informed Risk Taking, Tolerance for Risk.

**Delegation cluster:** Delegation, Delegation and Empowerment (→ merge), Task Delegation (→ also a *family conflict*, see §4).

**Stakeholder cluster** (`fam_stakeholder_influence`):
- **Retain:** Stakeholder Management, Stakeholder Engagement.
- **Action-phrasings → review/merge into the above:** Negotiating with Stakeholders, Securing Stakeholder Buy-In, Stakeholder Collaboration, Organizational Alignment.

**Relationship cluster:** Relationship Building, Relationship Management (retain — build vs maintain is a real distinction); Customer Relationship Building → see §4 (family conflict); Human Relations Skills → see §4.

---

## 4. Conflicting Competencies (same/near concept split across different families)

These are **taxonomy conflicts**: the same or near-identical construct is filed under **different families/domains**, which will fragment scoring and double-count a person. These need a family-placement decision *before* (or instead of) a merge.

| # | Members & families | Conflict |
|---|---|---|
| C1 | Delegation (`fam_execution`) · Task Delegation (`fam_project_delivery`) | same construct, two families |
| C2 | Motivation (`fam_execution`) · Self-Motivation (`fam_work_ethic`) · Team Motivation (`fam_leadership`) | one root split across three families |
| C3 | Collaboration (`fam_relationship_management`) · Agile Collaboration (`fam_change_transformation`) · Stakeholder Collaboration (`fam_stakeholder_influence`) · Collaboration Across Teams (`fam_relationship_management`) | collaboration scattered across families |
| C4 | Talent Development (`fam_coaching_mentoring`) · Talent Management (`fam_execution`) | overlapping construct, two families |
| C5 | Relationship Management (`fam_relationship_management`) · Human Relations Skills (`fam_execution`) | near-synonym, two families |
| C6 | Customer Relationship Building (`fam_customer_excellence`) · Relationship Building (`fam_relationship_management`) | parent/child across families |
| C7 | Time Management (`fam_operational_excellence`) · Return on Time Management (`fam_financial_commercial`) | qualifier moves it to a finance family |
| C8 | Fairness (`fam_governance_ethics`) · Fairness in Judgment (`fam_decision_making`) | same root, two families |
| C9 | Assertiveness (`fam_execution`) · Assertive Communication (`fam_communication`) | trait vs its communication expression, two families |
| C10 | Communication (`fam_communication`) · Transparent Communication (`fam_governance_ethics`) | modality filed under ethics |
| C11 | Leadership (`fam_leadership`) · Transparent Leadership (`fam_governance_ethics`) | leadership style filed under ethics |

**Recommendation for §4:** decide the *home family* first (governance vs functional), then either re-home or merge. Do **not** merge across families silently — that would relocate a construct and change every cohort/benchmark that reads `family_id`.

---

## 5. Merge Recommendations (consolidated)

| Confidence | Groups | Rows collapsed → kept | Net reduction |
|---|---|---|---|
| **T1 — merge now** (§3a, D1–D7) | 7 | 17 → 7 | **−10** |
| **T2 — merge, light review** (§3b, N1–N20) | ~20 | ~45 → ~20 | **≈ −25** (a few flagged "review") |
| **T3 — split decision** (§3c) | several clusters | adjective-variants only | **≈ −12 to −18** if SME approves |
| **§4 — conflicts** | 11 | re-home or merge | reduction depends on decision |

**Indicative total if all T1+T2 approved:** roughly **35–40 fewer rows** (≈ 299 → ≈ 260), before any T3/conflict decisions. These numbers are *estimates from name analysis only* — final counts depend on SME adjudication.

### Suggested canonical-selection rule
When merging, keep the **shortest unqualified standard term** unless a qualified form is the recognised industry label (e.g. keep *Active Listening* over *Listening Skills*; keep *Tolerance for Ambiguity* over *Ambiguity Tolerance*). Record the dropped id in `deprecated_replacement_id` → canonical id (the genome already has this column).

---

## 6. Retain Recommendations (explicitly NOT duplicates)

Keep these despite surface similarity — they are **separately assessable constructs**:

- **Analytical Thinking** vs **Critical Thinking** — different reasoning processes.
- **Strategic Planning** vs **Strategic Thinking** — planning (output) vs thinking (cognition).
- **Long-Term Planning** vs **Short-Term Planning** — opposite horizons, both valid.
- **Customer Retention Focus** vs **Employee Retention Focus** — different populations.
- **People / Process / Results / Service / Goal / Learning Orientation** — distinct orientations (share only the word *Orientation*).
- **Commercial / Contextual / Social / Risk Awareness** — distinct awareness targets.
- **Written / Assertive / Persuasive Communication** — distinct communication modalities.
- **Servant / Transformational / Inspirational / Team / Innovation Leadership** — recognised leadership styles.
- **Curiosity** vs **Intellectual Curiosity** — *borderline*; lean retain (general disposition vs cognitive), flag for review.
- **Entrepreneurial Spirit** vs **Entrepreneurial Thinking** — *borderline*; lean retain (drive vs cognition).

---

## 7. False Positives (matched by the detector, deliberately rejected)

Listed for transparency so the cleanup is not over-aggressive. These share only a generic suffix/prefix and are **distinct competencies — RETAIN all**:

- **"… Management" suffix:** Cost Management, Risk Management, Time Management, Talent Management, Project Management, Stress Management, Wellness Management, Change Management — distinct objects of management.
- **"… Orientation" / "… Awareness" / "… Focus"** generic-head matches (see §6).
- **Resourcefulness** vs **Respectfulness** — pure spelling proximity, unrelated meaning.
- **Real-Time Problem Solving** vs **Time Management** — matched on the token *time* only.

---

## 8. Cleanup Actions (proposed — require approval before execution)

> Honesty / safety: the canonical genome (`onto_competencies`) must **never** be mutated without explicit approval. Nothing here has been executed. Recommended order:

1. **Approve canonical choices** for the 7 **T1** groups (§3a). Lowest risk, highest signal.
2. **Execute T1 merges as soft-deprecation, not deletion:** set `deprecated = true` and `deprecated_replacement_id = <canonical id>` on the dropped rows. This is reversible and preserves history (matches the platform's append-only / additive contract). Do **not** hard-delete.
3. **Re-point dependants** of each deprecated id before hiding it: `onto_competency_type_map`, `onto_competency_master_ext` (Phase 1.2), and any `map_role_competency` / `onto_role_weights` references. (Audit these FKs first; a merge that orphans a weight row would silently change role scores.)
4. **Review T2 (§3b)** in one SME pass; apply the same soft-deprecation pattern for approved items.
5. **Decide §4 family conflicts** (re-home vs merge) — this is a taxonomy decision, owner-gated, and should precede T3.
6. **Defer T3 (§3c)** to SME adjudication; default is retain.
7. **Add a uniqueness guard** going forward: a normalized-name check at competency-creation time to prevent re-introducing word-order/plural duplicates.

**Out of scope for this review (not done):** no rows deprecated, no merges executed, no schema changes. This document is the deliverable; execution is a separate, approved phase.

---

## 9. Summary

- 299 competencies reviewed; **0 exact** duplicates, **~139** semantic candidate pairs detected and adjudicated.
- **7 true-duplicate groups** (10 redundant rows) — high-confidence merges.
- **~20 strong near-duplicate groups** — recommended merges pending light review.
- **11 cross-family conflicts** — require a family-placement decision.
- A documented **retain list** and **false-positive list** keep the cleanup honest and non-destructive.
- All actions are recommendations; **no data was changed.**
