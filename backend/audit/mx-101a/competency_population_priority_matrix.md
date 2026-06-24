# MX-101A — Competency Population Priority Matrix

_Generated 2026-06-24T09:18:39.826Z · population engine mx101a-1.0.0 · all numbers measured live._

Deterministic Tier 1–4 classification of the **419**-competency genome, grounded in measured downstream demand (Role-DNA weights, leadership/role relevance, competency type). Drives generation order; never changes coverage.

## Tier summary
| Tier | Definition | Competencies |
|---|---|---|
| 1 | Tier 1 — Critical (Role-DNA / benchmark consumed) | 21 |
| 2 | Tier 2 — High-Value (leadership / strategic / cross-role) | 398 |
| 3 | Tier 3 — Role / Function-Specific | 0 |
| 4 | Tier 4 — Future Skills | 0 |

**Classification rule (in code, deterministic):**
- **Tier 1 — Critical**: `dna_refs >= 1` (consumed by Role-DNA / employer benchmark / career match).
- **Tier 2 — High-Value**: role_relevance present OR leadership_relevance >= genome 75th pctile OR domain ∈ {dom_strategic, dom_cognitive}.
- **Tier 3 — Role/Function-Specific**: the remaining functional/technical/onet + soft competencies.
- **Tier 4 — Future Skills**: `type_key='future_skills'` (honestly **0** today — the genome has no future_skills type rows yet).

## Tier 1 (Critical) competencies — full list
| Competency | Domain | Type | DNA refs | Live approved | Draft pipeline |
|---|---|---|---|---|---|
| Accountability | dom_behavioral | behavioral | 4 | 3 | 7 |
| Active Listening | dom_interpersonal | behavioral | 3 | 3 | 6 |
| Adaptability | dom_behavioral | behavioral | 1 | 3 | 7 |
| Analytical Thinking | dom_cognitive | cognitive | 1 | 0 | 6 |
| Attention to Detail | dom_functional | functional | 1 | 0 | 6 |
| Coaching | dom_interpersonal | behavioral | 2 | 0 | 6 |
| Collaboration | dom_interpersonal | behavioral | 4 | 0 | 6 |
| Conflict Resolution | dom_interpersonal | behavioral | 1 | 0 | 6 |
| Critical Thinking | dom_cognitive | cognitive | 1 | 0 | 6 |
| Dependability | dom_behavioral | behavioral | 1 | 0 | 6 |
| Emotional Regulation | dom_behavioral | behavioral | 2 | 0 | 6 |
| Initiative | dom_behavioral | behavioral | 1 | 0 | 6 |
| Integrity | dom_strategic | behavioral | 3 | 0 | 6 |
| Learning Agility | dom_cognitive | cognitive | 2 | 0 | 6 |
| Persuasion | dom_interpersonal | behavioral | 4 | 0 | 6 |
| Problem-Solving | dom_behavioral | behavioral | 1 | 0 | 6 |
| Self-Control | dom_behavioral | behavioral | 1 | 0 | 6 |
| Stakeholder Management | dom_interpersonal | behavioral | 2 | 4 | 6 |
| Strategic Thinking | dom_strategic | cognitive | 3 | 0 | 6 |
| Stress Tolerance | dom_behavioral | behavioral | 1 | 0 | 6 |
| Systems Thinking | dom_cognitive | cognitive | 5 | 0 | 6 |
