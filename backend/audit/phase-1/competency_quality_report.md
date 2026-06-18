# Competency Quality Report — Phase 1.2

**Objective:** ensure every competency carries a governed quality record — lifecycle status, consumption eligibility, and scientific attributes.
**Result: 299 / 299 active competencies have a quality record (100%), all `status='active'`.**

## Quality-record coverage (`onto_competency_master_ext`)

| Metric | Value |
|---|---|
| Active competencies | 299 |
| Quality records | **299 (100%)** |
| Status = active | 299 |

| Source of record | Count |
|---|---|
| `default` | 298 |
| `curated` | 1 |

## Consumption eligibility (which downstream surfaces may use each competency)

All 299 competencies are currently eligible across all six consumption surfaces:

| Surface | Eligible |
|---|---|
| Assessment | 299 |
| Employability Index (EI) | 299 |
| Career Builder | 299 |
| Employer Portal | 299 |
| Learning | 299 |
| Future-Ready | 299 |

> These flags are the **contract** Phase 2 modules read to decide what they may surface. Phase 1 sets them; it does not touch the consuming modules.

## Scientific attribute quality (`onto_competencies`)

**Trainability**

| Value | Count |
|---|---|
| moderate | 206 |
| high | 68 |
| low | 25 |

**Stability**

| Value | Count |
|---|---|
| state_like | 250 |
| trait_like | 37 |
| dynamic | 12 |

**Scientific type**

| Value | Count |
|---|---|
| behavioral | 189 |
| cognitive | 66 |
| functional | 44 |

Each competency also carries `definition`, `complexity_level`, `leadership_relevance`, `scoring_metadata` (scale `0-100`), and `benchmark_metadata` (`k_anonymity_min=30`) — the integrity primitives the platform relies on.

## Honest findings (not defects)
- **Version / row-level history = PARTIAL.** There is no per-row history table; edits are captured in `admin_audit_logs` (actor, action, target, timestamp) but `previous_state` / `new_state` are NULL — so *who changed what when* is auditable, *before/after values* are not yet diffable. (Carried forward from the Phase 1.8 SuperAdmin validation.)
- **Eligibility is uniformly open (all true).** This is the correct default state at the end of Phase 1; differentiated gating (e.g. excluding a competency from a surface) is a curation action for later, and the machinery to do it exists.

**Success criterion "Competency quality reviewed": MET — 299/299 records present and active; the one partial axis (row-level version history) is disclosed, not hidden.**
