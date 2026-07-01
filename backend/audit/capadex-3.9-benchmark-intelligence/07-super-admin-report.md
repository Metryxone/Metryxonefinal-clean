# CAPADEX 3.0 · Program 3 · Phase 3.9 — Super Admin Report (dimension 4 · super_admin)

> Deliverable 07 · Generated 2026-07-01T18:15:29.031Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:cfbd7d362773, written 2026-07-01T18:15:29.033Z).
> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=30 real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The super-admin benchmark console (`BenchmarkIntelligencePanel`) surfaces benchmark-group config, comparison config, composite-index builder, scoped-config manager, version control, governance approval workflow and audit console. Verified vs the live frontend tree.

**Super-admin surfaces:** 7 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (7 total).

| Capability | Status | Anchors |
|---|---|---|
| **Benchmark library** (`benchmark_library`) | SUPPORTED | components/superadmin/BenchmarkIntelligencePanel.tsx |
| **Benchmark configuration** (`benchmark_configuration`) | SUPPORTED | components/superadmin/BenchmarkIntelligencePanel.tsx |
| **Benchmark rules** (`benchmark_rules`) | SUPPORTED | components/superadmin/BenchmarkIntelligencePanel.tsx |
| **Version manager** (`version_manager`) | SUPPORTED | components/superadmin/BenchmarkIntelligencePanel.tsx |
| **Organization mapping** (`organization_mapping`) | SUPPORTED | components/superadmin/BenchmarkIntelligencePanel.tsx, routes/benchmark-intelligence.ts |
| **Benchmark approval workflow** (`benchmark_approval`) | SUPPORTED | components/superadmin/BenchmarkIntelligencePanel.tsx |
| **Audit console** (`audit_console`) | SUPPORTED | components/superadmin/BenchmarkIntelligencePanel.tsx |

### Super Admin (`super_admin`) — SUPPORTED
_Super-admin certification + management console (benchmark library / benchmark configuration / benchmark rules / version manager / organization mapping / benchmark approval / audit console) nested in the competency-framework admin shell. Organization mapping is wired (organization-scoped configs stored via saveConfig scope=organization, resolved via resolveConfig top-precedence). Real populated organization overrides are an ADOPTION axis (honest 0), not a coverage gap._

- **Services**: —
- **Routes**: routes/benchmark-intelligence.ts
- **Frontend**: components/superadmin/BenchmarkIntelligencePanel.tsx
- **Tables**: —
- **Verified**: svc 0/0 · rt 1/1 · fe 1/1 · tbl 0/0


_Organization overrides are WIRED: the console lists organization-scoped configs (GET /configs?scope=organization) + previews most-specific-wins resolution (POST /configs/resolve). Real org-override configs are an ADOPTION axis (honest 0), NOT a coverage gap._
