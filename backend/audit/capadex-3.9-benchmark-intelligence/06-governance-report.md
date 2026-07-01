# CAPADEX 3.0 · Program 3 · Phase 3.9 — Governance Report (dimension 3 · governance)

> Deliverable 06 · Generated 2026-07-01T18:15:29.031Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:cfbd7d362773, written 2026-07-01T18:15:29.033Z).
> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=30 real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Benchmark groups / configs / composite indices move through **draft → review → validate → approve → publish → archive → rollback → retire** with version history, rollback and an audit trail — recorded in the additive `abmk_governance_log` + `abmk_audit_log` overlays via the flag-gated governance transition path (`recordGovernanceTransition`, GOVERNANCE_ORDER-validated).

**Governance states:** 8 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Anchors |
|---|---|---|
| **Draft** (`draft`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_governance_log |
| **Review** (`review`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_governance_log |
| **Validate** (`validate`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_governance_log |
| **Approve** (`approve`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_governance_log |
| **Publish** (`publish`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_governance_log |
| **Archive** (`archive`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_governance_log |
| **Retire** (`retire`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_governance_log |
| **Audit trail** (`audit_trail`) | SUPPORTED | services/benchmark-intelligence-mechanisms.ts, abmk_audit_log, abmk_governance_log |

### Governance (`governance`) — SUPPORTED
_ONE canonical governance layer (abmk_governance_log + abmk_audit_log) moving every benchmark artefact (group / config / rule set) through draft→review→validate→approve→publish→archive→retire with append-only version history, rollback (restore a prior version) and a full audit trail. State transitions are recorded, never destructive._

- **Services**: services/benchmark-intelligence-mechanisms.ts, services/benchmark-intelligence-engine.ts
- **Routes**: routes/benchmark-intelligence.ts
- **Frontend**: components/superadmin/BenchmarkIntelligencePanel.tsx
- **Tables**: abmk_governance_log, abmk_audit_log, abmk_configs
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 0/3

