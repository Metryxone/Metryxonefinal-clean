---
name: Competency Framework Intelligence — Phase 1 canonical index
description: What the "competency assessment Phase 1" series actually is, where its index lives, and which tables drift between audit env and the live shared DB.
---

# Competency Framework Intelligence — Phase 1 (the "competency assessment" track)

**The canonical sub-phase index lives in CODE, not in any roadmap doc.** Authoritative source = the route section markers in `backend/routes/competency-intelligence.ts` plus the `*_VERSION='phase-1.x'` constants in each service.

The implemented series is: **foundation (`competency-framework-intelligence.ts`) + 1.1 type-classification, 1.2 master, 1.4 micro, 1.5 role-profile, 1.6 assessment-foundation, 1.7 search**.
- **There is NO 1.3 and NO 1.8–1.15** anywhere (code/docs/migrations). If a request says "phase 1 to 1.15," it overshoots — report the absence honestly, never fabricate 1.8–1.15.
- A **different** "Phase 1" exists: roadmap §1 "Ontology + Assessment" built on `capadex_*` (commercial/CAPADEX) tables. Disambiguate before analysing — "competency assessment" = the `onto_*` track here, not `capadex_*`.

**Why:** the phrase "Phase 1" is overloaded across tracks; the only non-ambiguous resolver is the in-code phase markers.
**How to apply:** when asked to audit/extend "competency assessment Phase 1," grep `competency-intelligence.ts` for `Phase 1.` section markers and the `phase-1.x` version constants first.

## Live-DB drift trap (honesty)
The 19-Jun `backend/audit/phase-1/*` reports were produced in an env where seeds had run. The **shared dev DB drifts** from that: as of 21-Jun `onto_competency_master_ext`=0 (1.2) and `onto_competency_hierarchy`=0 (1.4) are EMPTY there, even though the audit reported them populated.
- Always re-query the live shared DB; do not trust a prior audit's counts.
- `onto_competency_question_map` had 25 rows but only **7 distinct competencies** (`COUNT(DISTINCT competency_id)`) — count DISTINCT, not rows, when reporting "competencies measured" (7/299, not 25/299).

**Namespaces:** `onto_*` = curated/seeded (populated); `ont_*` (singular) = O*NET-derived, ships **empty (all 0) in dev by design** — not a defect. Activation routes return **401 (not 503)** when the flag `FF_COMPETENCY_FRAMEWORK_INTELLIGENCE` is ON (503 = flag off).
