# MX-800 Phase 2.1 — Platform Intelligence Operating System Constitution

**Program:** CAPADEX 2.0 · MX-800 · Phase 2.1
**Mode:** ENHANCEMENT-ONLY — governance/constitution deliverable. No engine implemented, no business
logic modified, no intelligence duplicated, no persistence added, no flag introduced, nothing activated.
**Status:** DRAFT for approval. **Freeze this Constitution after approval. Implementation begins in
Phase 2.2 — not here.**

All quantitative claims in this document are **measured** by
`backend/scripts/mx800-2.1-platform-intelligence-audit.ts` (a pure read-only repository scan) and stored
in `backend/audit/mx-800/phase-2.1-platform-intelligence-audit.{json,md}`. Nothing here is fabricated or
estimated.

---

## Preamble

CAPADEX already contains a large, mature population of intelligence engines. The purpose of the Platform
Intelligence Operating System (PI-OS) is **not** to replace them and **not** to build a "Platform V2."
It is to give the existing engines one shared constitution: a common vocabulary, a common governance
contract, and a single coordination layer — while the **repository remains the single source of truth.**

This phase delivers the constitution and the measured audit it rests on. It deliberately stops before
any engine work.

### Honesty Contract (binding on every future PI-OS phase)

- Intelligence Exists ≠ Connected ≠ Orchestrated.
- Data ≠ Knowledge ≠ Intelligence ≠ Reasoning ≠ Decision ≠ Automation.
- Coverage ⟂ Confidence ⟂ Evidence (never composited).
- `null` ≠ `0`. Available ≠ Operational. Built ≠ Activated.
- Never fabricate. Never estimate. The repository overrides assumptions.
- **Human approval remains authoritative at every maturity level.**

### Execution Contract (binding on Phase 2.2+)

Repository first · Search before modifying · Reuse before building · Compose before duplicating ·
Extend before replacing · Never redesign existing architecture.

---

## Part 1 — Current Platform Intelligence Audit (MEASURED)

Source: `phase-2.1-platform-intelligence-audit.json`.

### 1.1 Raw inventory

| Asset | Count |
|---|---|
| Backend services (top-level) | **422** |
| Governance services (`services/governance/`) | 13 |
| Automation services (`services/automation/`) | 6 |
| Route modules (`backend/routes/`) | **310** |
| Migrations | 223 |
| Memory topic docs (`.agents/memory/`) | 268 |
| Product docs (`docs/`) | 26 |
| Feature flags (file registry) | **177** (32 default-ON / 145 default-OFF) |

The platform is large and **predominantly dormant by design**: 145 of 177 flags default OFF, i.e. most
intelligence is *built but not activated*. This is the central honest finding — **capability ≠ runtime
adoption.**

### 1.2 Constitutional domain coverage

Each of the nine named intelligence domains maps to **representative existing engines** verified to exist
on disk. This is a curated anchor map (transparent in the script), **not** an exhaustive partition of all
422 services.

| Domain | Anchors present / declared |
|---|---|
| Repository Intelligence | 4 / 4 |
| Platform Intelligence | 4 / 4 |
| Engineering Intelligence | 8 / 8 |
| Runtime Intelligence | 5 / 5 |
| Knowledge Intelligence | 6 / 6 |
| Decision Intelligence | 5 / 5 |
| AI Intelligence | 6 / 6 |
| Analytics Intelligence | 6 / 6 |
| Enterprise Intelligence | 7 / 7 |

**Finding:** every constitutional domain already has at least one real, shipped engine. No domain is
green-field. The PI-OS therefore *coordinates*, it does not *create*.

### 1.3 Duplication (candidates for human review)

The scan found **11** `-v2` service variants (e.g. `market-intelligence-engine` + `…-v2`,
`learning-roi-engine` + `…-v2`, `ai-governance` + `…-v2`). Presence of a `-v2` variant is **not** an
assertion of redundancy — several are deliberate, flag-gated successors. These are flagged as
**review candidates** for a future consolidation decision, never auto-removed.

### 1.4 Gaps (honest)

- **Coordination gap:** the nine domains are *connected* (they share a DB and call each other ad hoc) but
  not *orchestrated* under one contract. There is no single PI-OS coordination surface today.
- **Governance-uniformity gap:** governance exists richly (13 governance services, many `*-governance`
  routes) but is **not uniformly exposed** as the six-facet contract (metadata/evidence/confidence/
  explainability/ownership/compatibility) across *every* engine.
- **Activation gap:** most intelligence is dormant (145/177 flags OFF). Built ≠ Activated.

---

## Part 2 — Platform Intelligence Philosophy

Intelligence observes → understands → reasons → predicts → recommends → continuously learns. At every
step, **human approval remains authoritative.** The PI-OS never converts a recommendation into an
autonomous, unreviewed action.

---

## Part 3 — Platform Intelligence Architecture

The PI-OS is a **coordination layer over existing engines**, organised as nine domains. It owns no
business logic; each domain points at engines that already exist.

| # | Domain | What it governs | Representative existing anchors |
|---|---|---|---|
| 1 | **Repository Intelligence** | The repo as SSoT: discovery, capability registry, lifecycle state | `services/platform-lifecycle.ts`, `platform-lifecycle-management.ts` (MX-700 1.37/1.38) |
| 2 | **Platform Intelligence** | Read-only intelligence over the registry: evidence/confidence/health | `platform-lifecycle-intelligence.ts` (1.39), `routes/platform-intelligence.ts`, `platform-lifecycle-operations.ts` (1.42) |
| 3 | **Engineering Intelligence** | Evolution, technical debt, automation, quality gates, certification | `platform-evolution-intelligence.ts` (1.40), `platform-lifecycle-automation.ts` (1.41), `platform-lifecycle-certification.ts` (1.43), `go-live-certification.ts` |
| 4 | **Runtime Intelligence** | Live signal capture, runtime pipeline, observability | `intelligence-pipeline.ts`, `intelligence-observability-engine.ts`, `routes/signal-capture.ts`, `behavioural-signals.ts` |
| 5 | **Knowledge Intelligence** | Knowledge graph, memory engines, curated knowledge | `knowledge-graph.ts`, `mx203-knowledge.ts`, `behavioural-memory.ts`, `longitudinal-memory.ts` + `.agents/memory/` (268) + `docs/` (26) |
| 6 | **Decision Intelligence** | Orchestration, persistence, bridges (decision→growth-plan/mentor) | `services/wc7b/decision-orchestrator.ts`, `decision-persistence.ts`, `mentor-bridge.ts`, `growth-plan-bridge.ts` |
| 7 | **AI Intelligence** | AI governance, narrative generation, explainability/fairness | `ai-governance-v2.ts`, `m4-ai-governance.ts`, `intelligence-narrative-engine.ts`, `explainability-governance-engine.ts`, `fairness-governance-engine.ts` |
| 8 | **Analytics Intelligence** | Analytics warehouses, market/comparative intelligence | `workforce-analytics.ts`, `comparative-intelligence.ts`, `market-intelligence-engine.ts`, `routes/enterprise-analytics.ts` |
| 9 | **Enterprise Intelligence** | Enterprise/executive/workforce/institutional/global rollups | `enterprise-intelligence.ts`, `enterprise-certification.ts`, `executive-workforce-intelligence.ts`, `global-intelligence.ts`, `institutional-intelligence-engine.ts` |

**Architectural rule:** the PI-OS composes the read-only getters of these engines. It must never
re-implement, fork, or duplicate them. (Precedent: the MX-700 lifecycle tiers 1.37→1.43 already compose
one another rather than forking — this is the pattern the PI-OS generalises.)

---

## Part 4 — Platform Intelligence Governance

Every intelligence engine **shall** expose six facets:

1. **Metadata** — what it is, which flag gates it, which routes/tables it owns.
2. **Evidence** — what measured inputs back its outputs (and which are absent).
3. **Confidence** — reported **separately** from coverage and evidence; abstains below threshold.
4. **Explainability** — why an output was produced; "unknown" returns `found:false`, never a guess.
5. **Ownership** — accountable owner; honest-NULL when unknown (never fabricated).
6. **Compatibility** — backward/forward/migration posture.

**Measured today:** governance is **partially present** — 13 governance services and a substantial set
of `*-governance` routes already implement subsets of these facets — but the six-facet contract is **not
uniformly applied to all engines**. Closing that uniformly is Phase 2.2+ work, gated and additive.

**Governance invariants:** read paths never write/DDL; writes are explicit and flag-gated; human approval
is the only coverage-changing operation; OFF is byte-identical incl. schema.

---

## Part 5 — Platform Intelligence Maturity

Ladder: **Operational → Guided → Managed → Intelligent → Self-Optimizing.** Human approval mandatory at
every rung.

**Honest platform position: the ceiling reached today is "Managed."** Engines are governed, measured,
flag-gated and human-in-the-loop. Some (forecast/predictive/trend) reach toward "Intelligent" in
isolation, but this is **not orchestrated platform-wide**, so it is not claimed as a platform level.
**"Self-Optimizing" is NOT present — and by the Honesty Contract it must never be auto-claimed: autonomous
self-optimization without human approval is explicitly out of scope.**

| Domain | Honest maturity | Basis (measured) |
|---|---|---|
| Repository Intelligence | Managed | Discovery + managed lifecycle registry shipped (1.37/1.38); human transitions authoritative |
| Platform Intelligence | Managed | Read-only intelligence/operations console shipped (1.39/1.42); mostly flag-OFF |
| Engineering Intelligence | Managed | Evolution/debt/automation/quality-gates/certification shipped (1.40/1.41/1.43); read-only |
| Runtime Intelligence | Guided→Managed | Capture + pipeline + observability exist; runtime activation flags largely OFF |
| Knowledge Intelligence | Managed | Knowledge graph + memory engines + 268 memory docs + 26 product docs; curation human-gated |
| Decision Intelligence | Guided→Managed | Orchestrator + persistence + bridges exist; recommendation, not autonomous action |
| AI Intelligence | Guided→Managed | AI governance/narrative/explainability/fairness present; AI inert without keys (honest) |
| Analytics Intelligence | Guided→Managed | Analytics warehouses + market/comparative engines present; adoption varies |
| Enterprise Intelligence | Guided→Managed | Enterprise/executive/global/institutional rollups present; mostly flag-OFF |

No domain is rated **Intelligent** or **Self-Optimizing** at the platform level — doing so without
orchestration + runtime-outcome evidence would violate the Honesty Contract.

---

## Part 6 — Domain Intelligence Reports (summaries)

Each report below is grounded in the measured scan; depth lives in the cited engines and their
`.agents/memory/*` topic files (per-subsystem lessons).

- **Repository Intelligence Report** — The repo-as-SSoT substrate is the most mature: a managed lifecycle
  registry that *composes* the flag registry + a filesystem scan (no parallel registry), with managed
  lifecycle state ⟂ derived activation state. Coordination-ready; this is the natural PI-OS foundation.
- **Engineering Intelligence Report** — Evolution/technical-debt/quality-gates/certification tiers are
  shipped and read-only, separating measured markers (TODO/FIXME) from tracked debt and never compositing
  six independent health scores. 11 `-v2` duplication candidates are the main engineering-hygiene backlog.
- **Runtime Intelligence Report** — Capture→pipeline→observability spine exists, but runtime-activation
  and consumption flags are largely OFF; runtime adoption (not capability) is the honest gap.
- **Knowledge Intelligence Report** — Strongest *evidence* base: knowledge graph + memory engines + 268
  memory topic docs + 26 product docs. Knowledge ≠ runtime intelligence; the gap is wiring curated
  knowledge into live reasoning, not creating knowledge.
- **Decision Intelligence Report** — Orchestrator + persistence + growth-plan/mentor bridges exist and
  are decision-driven by provenance, not tautology. Output is recommendation; automation is deliberately
  withheld (Decision ≠ Automation).
- **Enterprise Intelligence Report** — Enterprise/executive/workforce/institutional/global rollups and an
  enterprise certification composer exist; four axes (Structural ⟂ Activation ⟂ Adoption ⟂
  Outcome-Confidence) are kept separate and production-readiness is withheld pending runtime+outcome
  evidence.

---

## STOP

This phase does **not** implement intelligence engines, modify business logic, or create duplicate
intelligence. Upon approval, **freeze this Constitution.** Phase 2.2 will begin additive, flag-gated
implementation against it — composing existing engines, never rebuilding them.
