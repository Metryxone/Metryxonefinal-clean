# Founder Decision Report

**Task:** MX-COMPETENCY-ONET-ARCHITECTURE-VALIDATION · Section 6
**Date:** 2026-06-23 · Read-only architecture validation. Every claim below is backed by live row counts (companion reports).

---

## 1. Is the Competency Framework architecture fundamentally correct?

**Yes.** The spine is sound and runs end-to-end today: a curated genome of **419 competencies** (with 277 micro-competencies, 5 real types, a 5-level proficiency scale) → role profiles → blueprints → question selection → assessment (45 instances) → dual-ledger scoring → an 8-dimension Employability Index → Career Builder → Career Passport. The design is correct.

**The problem is not design — it is (a) surface-area and (b) seed-depth:**
- Too many *parallel copies* of the same concept (6+ role namespaces, 4 role-family, 3 competency-master, 3 question, 2 proficiency-level) make it impossible for an operator to tell what is authoritative.
- The canonical curated taxonomy is at *pilot seed depth* (2 industries / 3 functions / 4 departments / 4 role families / 5 roles), while the breadth sits in the O*NET reference side.

## 2. Is O*NET positioned correctly?

**Yes — as a REFERENCE layer.** It supplies breadth the genome lacks (1,040 roles, 206 industries, 43 departments, **52,362 role→competency requirement edges**) for *estimating* requirements. Note this is **O*NET-lite**: the classic skills/abilities/knowledge/work-activities element tables **do not exist** here — it's a role↔competency requirement library plus taxonomy.

The one weakness in positioning: the **crosswalk is underfilled** — only **5 of 1,040** O*NET roles are bridged to curated roles (`map_ont_onto_role`=5), so 99.5% of the O*NET library can't reach the scoring path.

## 3. Should O*NET remain a reference layer or become a scoring layer?

**Remain a REFERENCE layer. Do NOT make it the scoring layer.** Two hard reasons:
- The 160-competency O*NET taxonomy is **coarser** than the deliberately curated 419-competency genome — scoring against it is a downgrade.
- O*NET role matching is **name-based estimation**; turning it into the scoring source would convert estimation noise into assessment error.

Use O*NET to *suggest and estimate* (especially to seed employer role requirements and bootstrap the thin curated taxonomy), never to *score*.

## 4. Can the architecture support the five products?

| Product | Verdict | Note |
|---|---|---|
| **Competency Assessment** | ✅ **Yes** (live, pilot-scale) | Works today; needs volume + retire the domain-proxy blueprint shortcut. |
| **Employability Index** | ✅ **Yes** | Single formula authority, consumes scoring cleanly. |
| **Career Builder** | ✅ **Yes** (read-only) | Consumes intelligence; no write-back (acceptable). |
| **Career Passport** | ✅ **Yes** | Working platform-sync bridge. |
| **Employer Portal** | 🟡 **Yes, with 2 bridges** | Full scaffold exists but **0 data** and the **competency score never reaches the hiring view** (it uses a separate LBI/CRA/heuristic path). Two wiring fixes, no rebuild. |

## 5. Top 10 changes required (priority order, all preserve existing capability)

1. **Badge curated vs O*NET reference everywhere** — end the "419 vs 160 vs 0" confusion. *(Rename)*
2. **Bridge competency scoring → Employer Portal** — route `onto_competency_profiles` into `employer_candidates` so hiring is actually competency-based. *(Wire — highest product value)*
3. **Expand the O*NET crosswalk** (`map_ont_onto_role` 5 → many) to unlock the 1,040-role library for estimation. *(Wire/data)*
4. **Consolidate the 6+ role namespaces** to curated + O*NET-reference + Career-Graph; hide the legacy rest. *(Hide/Merge)*
5. **Merge the 3 "questions" screens** into one bank. *(Merge)*
6. **Rename the Department tier consistently** (`onto_subfunctions` ↔ `ont_departments`). *(Rename)*
7. **Seed the curated taxonomy** (industries/functions 2/3 → realistic depth), bootstrapping from O*NET reference. *(Data)*
8. **Retire the assessment domain-proxy shortcut** so role level drives question difficulty; collapse the parallel `assessment_templates` namespace. *(Simplify)*
9. **Pick ONE proficiency-level table** and relabel "Level Profiles" → "Level Descriptors". *(Merge/Rename)*
10. **Hide empty/parked clusters** (legacy competency shells, empty O*NET career/learning-path/future-skills, TIG/M5 until employer volume). *(Hide)*

> Changes 1, 4, 5, 6, 9, 10 are **pure Rename/Hide/Merge — UI-only and reversible.** Changes 2, 3, 7, 8 are wiring/data, still additive (no rebuild). Removal of empty tables is a *later, separately approved* step with `pg_dump` backups.

## 6. What should NOT be changed?

- **The curated `onto_*` genome** — it is the correct canonical source; do not replace it with O*NET.
- **The dual scoring ledger** — it's intentional; document it, don't merge it.
- **The Employability Index formula authority** — single source, working.
- **Career Builder / Career Passport** — working consumers.
- **The O*NET reference library itself** — keep it; just relabel and bridge it. Don't delete breadth.
- **`ont_benchmarks`** and other *wired-but-parked* surfaces — keep parked, don't delete.

## 7. What would you do if rebuilding from scratch?

**You would not rebuild — and that's the recommendation.** But if starting clean, the same *shape* would emerge with three discipline rules baked in from day one:
1. **One canonical competency genome; O*NET strictly a reference/estimation feeder** behind a fully-populated crosswalk — never a second scoring taxonomy.
2. **One namespace per concept** (one role table, one role-family, one question bank, one proficiency scale) with a *source/provenance badge* instead of parallel physical copies.
3. **The assessment score is the single currency** that flows to EI, Career Builder, Passport, *and* the Employer Portal — no parallel LBI/CRA hiring path that bypasses it.

In other words: the current architecture is *already* the right target — it just accreted parallel copies and grew the employer side on a separate spine. **Fix clarity (rename/hide/merge) and close the two employer bridges; do not rebuild.**

---

### Suggested next action
I can execute the **reversible, UI-only changes (1, 4, 5, 6, 9, 10)** as a single flag-gated pass — relabel + group + hide, no data deleted, fully revertible. The wiring/data changes (2, 3, 7, 8) and any table removal would be **separate, approved tasks** (removal with backups first). Per your standing preference, I'll **stop for your approval** before implementing anything.
