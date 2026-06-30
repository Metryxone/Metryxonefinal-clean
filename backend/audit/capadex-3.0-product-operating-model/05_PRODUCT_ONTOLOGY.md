# 05 · Product Ontology Validation

Validates the formal ontologies that give CAPADEX its semantic backbone.

## Ontologies present (repo-evidenced)
| Ontology | Surface | Status |
|---|---|---|
| **Competency ontology (12-layer)** | `ont_*`/`map_*`/`ref_*`/`ver_*`/`lfc_*`/`gov_*`; ~419-competency genome | **IMPLEMENTED** |
| **CAPADEX signal ontology** | 4-tier signal→clarity→construct→bridge-tag; `ensureSignalOntologySchema` | **IMPLEMENTED (existence ≠ population — needs seed)** |
| **Role-DNA / occupation ontology** | `onto_roles`, `onto_role_competency_profiles`, `onto_dna_profiles`, O*NET/ESCO crosswalk | **IMPLEMENTED (coverage uneven)** |
| **Concern → signal mapping** | `concern_bridge_tag`, bridge-tag resolver | **IMPLEMENTED (orphans flagged, not fabricated)** |
| **EI dimension ontology** | 8-dim formula authority (`employabilityEngine.ts`) | **IMPLEMENTED** |
| **Outcome ontology** | WC-3 outcome models, 6-type realized-outcome taxonomy | **PARTIAL (front-half rich, back-half seed-thin)** |
| **Platform intelligence ontology** | MX-800 registry (12 domains), MX-700 capability catalog | **DORMANT (default-OFF)** |

## Ontology integrity findings (honest)
- **Bridge / crosswalk discipline is strong:** the platform consistently uses *abstain-never-fabricate*,
  separates **Coverage ⟂ Confidence**, and flags orphan bridge tags rather than inventing mappings
  (memory: bridge-tag-coverage, concern-signal-mapping, role-title-crosswalk).
- **Existence ≠ population:** signal ontology auto-creates schema but still requires a manual seed; role-DNA
  coverage is partial (some role titles abstain by design). These are honest data-coverage gaps, not bugs.
- **Namespace collision risk is documented and guarded:** `pil_kg_*` vs live `kg_*` (memory:
  kg-table-name-collision) — a real prior hazard, now fenced.
- **Two ontologies kept deliberately separate:** LBI (`lbi_*`) ⟂ Competency (`onto_*`) are independent
  products by design — never bridged.

## Verdict
Ontology layer is a **genuine strength** and a differentiator: formal, versioned, governance-aware, and
honesty-engineered. The only gaps are **population/coverage** (seed signal ontology, expand role-DNA) and the
**dormant** platform-intelligence ontology — both enhancement-only.
