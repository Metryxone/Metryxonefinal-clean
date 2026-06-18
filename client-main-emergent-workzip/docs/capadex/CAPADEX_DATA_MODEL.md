# CAPADEX — Data Model Guide

> Consolidation of the existing data model. Table inventory taken read-only from the live schema; no
> tables were created, altered, or dropped.

## Core Tables (by subsystem)

### Ontology
| Table | Role |
|---|---|
| `capadex_domains` | Tier-1 domains (~20) |
| `capadex_families` | Tier-2 families (~400) |
| `capadex_signals` | Tier-3 signals (~20) |
| `capadex_atomic_signals` | Tier-4 atomic signals (~15,972) |
| `capadex_concerns_master` | Canonical concern catalogue (~2,489) |
| `normalized_concern_ontology`, `concern_families`, `concern_areas`, `concern_classification` | Concern normalization & grouping |
| `adaptive_ontology_edges`, `lde_ontology_*`, `omega_ontology_*` | Adaptive / longitudinal / OMEGA ontology edges & nodes |

### Questions & metadata
| Table | Role |
|---|---|
| `capadex_clarity_questions` | Clarity question bank (~30,638) |
| `capadex_question_metadata` | Per-question dimensions (age/persona/stage/capability/behaviour/signal/context/archetype) |
| `capadex_question_enrichment` | Enrichment candidates |
| `capadex_question_registry` | Human-governed question lifecycle |
| `question_context_signals` | Context signal linkage |
| `pilot_c1a_enrichment` | **Sandbox-only** C-1A pilot table (revert = `DROP TABLE`) |

### Bridge tags & grounding
| Table | Role |
|---|---|
| `capadex_concern_clarity_map` | Concern ↔ clarity mapping |
| `capadex_concern_signal_map` | Concern ↔ signal mapping (deterministic cascade) |
| `capadex_bridge_tag_signal_grounding` | Bridge-tag signal grounding (303 grounded tags / 28,683 rows) |
| `capadex_bridge_tag_family_grounding` | Bridge-tag family grounding |

### Assessment runtime & sessions
| Table | Role |
|---|---|
| `capadex_sessions`, `capadex_runtime_sessions`, `capadex_runtime_contexts` | Session + runtime context state |
| `capadex_responses` | Per-question responses |
| `capadex_users`, `capadex_otps`, `capadex_payments`, `capadex_consent_records` | User identity, OTP, payment, consent |
| `capadex_reports` | Generated reports |
| `capadex_session_telemetry` | Hesitation/backtrack telemetry |

### Intelligence engines (additive, per-session outputs)
| Table | Role |
|---|---|
| `capadex_session_signals`, `capadex_signal_profiles`, `capadex_linguistic_signals` | Signal capture (BIOS) |
| `capadex_session_composites`, `capadex_session_patterns` | Composites → patterns (Behavioural Spine) |
| `capadex_session_interventions`, `capadex_interventions`, `pil_intervention_library` | Intervention runtime (library-backed) |
| `capadex_behavior_graph` | Unified behaviour graph (one per session) |
| `capadex_recommendations`, `capadex_intervention_recommendations` | Recommendation intelligence |
| `capadex_risk_flags`, `capadex_gamification`, `capadex_user_profiles`, `capadex_audit_events` | Enterprise intelligence |
| `csi_profiles`, `csi_trajectory`, `csi_domain_weights` | Career Stage Index |
| `cra_profiles`, `cra_scores` | Competency runtime assessment |
| `capadex_simulation_runs` | Simulation & validation harness |

### Knowledge graph (PIL Phase 8) — namespace `pil_kg_*`
| Table | Role |
|---|---|
| `pil_kg_nodes`, `pil_kg_edges`, `pil_kg_node_types`, `pil_kg_relationship_types` | Provenance-stamped knowledge graph |
| `pil_kg_metadata`, `pil_kg_audit`, `pil_kg_gap_analysis`, `pil_kg_similarity_index` | Metadata, audit, gap & similarity |
| `pil_action_plan_templates`, `pil_growth_pathways`, `pil_intervention_outcomes`, `pil_intervention_quality_scores` | PIL action/growth/quality layers |

> ⚠️ **Namespace canon:** PIL Phase-8 graph tables are `pil_kg_*`. The bare `kg_edges` table belongs
> to the **live Employability graph** — do not materialize PIL against it.

### Feature flags
| Table | Role |
|---|---|
| `feature_flags` (DB) | Gates `POST /api/signals/ingest` (`signal_intelligence`) + engine flags (`adaptive_questioning`, `confidence_engine`) |
| `feature_flag_tenant_overrides` | Per-tenant overrides |

*(The **file** registry `backend/config/feature-flags.ts` is distinct from this DB table — see
`replit.md` › Feature flags.)*

## Relationships & Keys

- **Concern ↔ Clarity:** `concerns_master.relational_bridge_tag = clarity_questions.master_bridge_tag`
  (bucket-level, many-to-many; the **only** working ontology bridge).
- **`clarity.concern_id` ↔ `concerns_master`:** **disjoint (0% join)** — do not rely on it.
- **Concern ↔ Signal:** `capadex_concern_signal_map` via a deterministic cascade
  (bridge_exact → token_semantic [primary] → cluster → domain → fallback → orphan).
- **Session ↔ outputs:** every engine table keys on `session_id`; the behaviour graph is one row per
  session and aggregates all per-session outputs (creates no new signals).
- **Intervention ids are UUID** (`String()` them — never `Number()`).

## Metadata Columns

The eight question dimensions (see `CAPADEX_ARCHITECTURE.md` §4). Context + Archetype are populated
repo-wide; capability/behaviour/signal are coverage/grounding-limited pending C-2 Waves 2–4.

## Signal Architecture

4-tier ontology (domains→families→signals→atomic) + per-question `signal_family` (55.8% coverage) +
bridge-tag grounding (`capadex_bridge_tag_signal_grounding`). Signals are **concern-diagnostic**, not
strengths — strengths come only from CSI positive factors / positive longitudinal growth.

## Question Architecture

Clarity questions (~30,638) ↔ bridge tags (~325) ↔ concerns master (~2,489). Per-question metadata is
the differentiation surface; the registry governs lifecycle; enrichment is additive & reversible.

## Concern Architecture

Concerns Master is canonical; free text resolves via keyword fallback + master-token resolver; the
concern→signal map links concerns to the signal ontology deterministically.

## Bridge Tag Architecture

Bridge tags are the join hub; a single shared resolver serves runtime + tooling; orphans are remapped
to siblings, never bulk-generated.

## Runtime Dependencies

`feature_flags` (DB) gates signal ingest + engine flags; the file flag registry gates additive V2
phases (flag-off → protected routes 503 + UI hides). Most newer tables have a canonical migration
**and** a lazy `ensure*Schema()` mirror (no migration runner).

## Data Flow

`Free text → concern resolution → bridge tag → 3-tier clarity picker → session responses →
post-completion hooks (signal capture → composite/pattern → intervention → CSI → behaviour graph →
recommendation/knowledge-graph) → report`. Full sequence in `CAPADEX_ROUTING_ARCHITECTURE.md`.
