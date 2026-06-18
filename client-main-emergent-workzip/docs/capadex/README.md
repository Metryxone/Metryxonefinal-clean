# CAPADEX — Consolidation & Handoff Package

> **The source of truth for all future MetryxOne development on CAPADEX.**
> This package is a *consolidation* of existing, completed work — no audits, enrichment, metadata or
> question changes, new architecture, or production/code/DB changes were made to produce it.

## The 10 Documents

| # | Document | Purpose |
|---|---|---|
| 1 | [CAPADEX_EXECUTIVE_SUMMARY.md](./CAPADEX_EXECUTIVE_SUMMARY.md) | Vision, status, findings, pilot results, readiness, next steps, downstream relationships |
| 2 | [CAPADEX_STATUS.md](./CAPADEX_STATUS.md) | Completed / approved / deferred work; risks; gaps; version & Go-No-Go |
| 3 | [CAPADEX_ARCHITECTURE.md](./CAPADEX_ARCHITECTURE.md) | Ontology, concern, bridge-tag, metadata, question, routing, scoring, trust, differentiability architecture |
| 4 | [CAPADEX_DATA_MODEL.md](./CAPADEX_DATA_MODEL.md) | Core tables, relationships, keys, mappings, data flow |
| 5 | [CAPADEX_ROUTING_ARCHITECTURE.md](./CAPADEX_ROUTING_ARCHITECTURE.md) | Input → assessment → scoring → routing → output → handoff, with diagrams |
| 6 | [CAPADEX_SCORING_MODEL.md](./CAPADEX_SCORING_MODEL.md) | AQ, AQ-2R, QIS, QIS V2, AIS/Trust, CSI, Differentiability, QRS — formulas & assumptions |
| 7 | [CAPADEX_ONTOLOGY.md](./CAPADEX_ONTOLOGY.md) | Concern hierarchy, bridge/master tags, mappings, governance & extension rules |
| 8 | [CAPADEX_CHANGELOG.md](./CAPADEX_CHANGELOG.md) | Milestones (AQ-1 → C-1AR), key decisions, architecture changes, lessons |
| 9 | [CAPADEX_DEFERRED_BACKLOG.md](./CAPADEX_DEFERRED_BACKLOG.md) | Future work, priorities, expected benefits, success-metric gates |
| 10 | [CAPADEX_HANDOFF_TO_MTERYXONE.md](./CAPADEX_HANDOFF_TO_MTERYXONE.md) | What CAPADEX produces/consumes, interfaces/APIs, recommended platform sequence |

## Recommended Version Number

### **CAPADEX v0.9** — *now*
Production-capable behavioural intelligence runtime: ontology, bridge-tag/signal grounding, metadata
coverage, the 9-phase assessment flow, the five-score scoring stack, and all additive flag-gated
intelligence engines are **operational**. **Context + Archetype** question dimensions are **shipped
repository-wide and validated**. The honest qualifier: per-question differentiation
(capability/behaviour/signal) is **architected, piloted, and deferred** — so this is
*production-capable, not yet data-complete*.

### **CAPADEX v1.0** — *gated*
Cut v1.0 once C-2 **Waves 2–4** have rolled out under the coverage/grounding gates **and** the
mandatory AQ-2R measurement confirms repository differentiability **≥ 0.30** (Diversity-Standards
minimum) with non-fabrication intact.

## Recommended Next Project

1. **Next CAPADEX increment** — **C-2 Wave 1 verification** (AQ-2R measurement of the already-shipped
   Context + Archetype; measurement only), then **Wave 2 — Capability** (coverage-gated). Waves 3–4
   (signal grounding-conditional; behaviour curated; context corpus) follow in order, each flag-gated,
   reversible, and behind the measurement gate.
2. **Next platform project** — **LBI**, the first downstream consumer. Begin LBI integration against
   the stable CAPADEX behaviour graph + signals in parallel with the gated C-2 waves.

Platform build sequence: **CAPADEX → LBI → Career Builder → Employability Index → Competency
Intelligence → Competitive Exam Intelligence.**

## Status

**Consolidation complete — STOP for approval.** No C-2 executed; no enrichment; no production, code, or
DB changes.
