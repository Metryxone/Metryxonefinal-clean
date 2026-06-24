# Section 5 — O*NET Intelligence Certification

**Verdict: PASS (content + crosswalk) — with disclosed reachability ceilings.**

The O*NET-derived occupation library is the platform's largest and best-populated reference asset and
is certified. The honest limits are dimensional (no industry→competency link) and crosswalk-precision
(name-based bridging), both correctly disclosed in prior phases rather than papered over.

## 5.1 Content scale — PASS
| Asset | Count |
|---|---:|
| Role↔competency crosswalk (`map_role_competency`) | **52,362** |
| O*NET roles (`ont_roles`) | **1,040** |
| Industries (`ont_industries`) | **206** |
| Competencies (`ont_competencies`) | **160** |
| Role families / functions / departments | 31 / 30 / 43 |
- Density: 1,021 distinct roles × 159 distinct competencies are actually linked — this is a genuinely
  rich, queryable occupation graph, not a stub.

## 5.2 Crosswalk governance (MX-100X P2) — PASS
- Coverage⟂Confidence is enforced: O*NET-derived links carry an **Estimated** provenance and are
  capped at LOW confidence — they never masquerade as curated truth.
- `ont_*` ids are INTEGER and `onto_*` ids are TEXT; the bridge maps role-by-title and competency-by-
  name and **never coerces id spaces**. Unresolved crosswalks return null, never a fabricated match.
- Decisions are reversible-by-provenance; GET read-only.

## 5.3 Reachability ceilings — disclosed, not defects
- **No industry→competency dimension.** O*NET has no native industry-competency mapping, so
  industry-conditioned queries resolve to an undifferentiated set; only exact role-name crosswalk is
  reachable. `ont_concerns` = 0 (mirror-sync target, empty here). These are honest ceilings.
- **Name-based crosswalk precision.** Bridging by title/name is inherently approximate; the platform
  labels the result Estimated rather than asserting precision.

## 5.4 Three-system silo (honest)
- Curated genome (`onto_*`), O*NET library (`ont_*`), and the assessment bank are **disjoint
  taxonomies** that overlap only ~13% by catalog name. This was resolved structurally (hierarchy
  completion + flag-gated search repointing), but the ceiling remains: the three systems are bridged,
  not unified. A query that expects a single taxonomy will see the seams.

## 5.5 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Content scale & density | PASS | 52,362 edges, 1,040 roles, 206 industries |
| Crosswalk governance | PASS | Estimated provenance, no id coercion, null-not-fabricate |
| Industry dimension | N/A (abstains) | O*NET has no industry→competency source |
| Three-system unification | PARTIAL | bridged not unified (~13% overlap, disclosed) |

**Net: PASS.** O*NET intelligence is the platform's strongest real-data asset. Its limits are inherent
to the source data and are honestly surfaced as Estimated/abstain rather than fabricated.
