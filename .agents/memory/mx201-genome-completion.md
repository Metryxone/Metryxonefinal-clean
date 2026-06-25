---
name: MX-201 Competency Genome Completion
description: What can/can't be honestly completed in the 419-competency canonical genome, and the real O*NET crosswalk lever.
---

# MX-201 — Competency Genome Completion (honest ceiling)

The canonical genome is `onto_competencies` (419 active, TEXT ids) = **120 O*NET-sourced**
(`id LIKE 'onet_%'`, `scoring_metadata.source='onet'`, carries `onet_element_id`) +
**299 MetryxOne-curated** soft-skill competencies (`comp_*`, source null).

## What is REAL vs what cannot be honestly machine-filled
- **REAL lever — O*NET crosswalk**: bridge `onto_competencies` → `ont_competencies` (disjoint INT
  O*NET library) via `scoring_metadata->>'onet_element_id' = ont.external_ref` (high conf, 120) or
  exact canonical-name (medium, +17). This unlocks `map_role_competency` (52,362 real role↔competency
  weights) for **137/419** comps, lifting role-signal coverage **5.7% → 37.0%**. Crosswalk home:
  `onto_competency_onet_crosswalk` (created by `scripts/mx201-p3-real-backfill.ts`, `source='mx201'`).
- **Honest low ceilings**: learning-resource overlap (`cg_skill_resource_map.skill_key` ↔ slug/name) = 7
  comps (taxonomy mismatch); cert linkage via shared role profiles ∩ `rr_certifications` = 7 comps (3 roles).
- **CANNOT machine-fill (no data source)**: behavioural indicators (only 13/419 have any, 7 span ≥2 levels),
  evidence requirements, learning outcomes, per-competency proficiency anchors. The 282 curated comps have
  **no O*NET equivalent**. Question Factory's authoring path is **inert without `OPENAI_API_KEY`**.

**Why:** program rule #1 = "No fabricated metadata" + founder pref "honesty over optimism". Template-generating
behavioural content across ~400 comps is fabrication and is REFUSED — even under a "fix all gaps" directive.
Genuine content needs `OPENAI_API_KEY` (governed AI draft → human approve) or SME authoring.

**How to apply:** "419/419 complete" is structurally reachable (identity/definition/eligibility = 100%) but
content-depth completion is NOT honestly automatable here. Report Structural-complete ⟂ Content-depth-PARTIAL
as separate axes; never composite. Exact-name O*NET match must be one-to-one only (`GROUP BY name HAVING count=1`)
— arbitrary `DISTINCT ON` picks a false link for ambiguous names (e.g. duplicate "Mathematics").
