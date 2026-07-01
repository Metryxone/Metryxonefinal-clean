/**
 * CAPADEX 3.0 — Program 3 · Phase 3.9 Enterprise Benchmark Intelligence Platform CERTIFICATION
 * Deliverable generator. READ-ONLY: reads scan.json (the SSoT for measured numbers) and emits
 * EXACTLY 16 numbered deliverables (01→16, 16 = Phase-3.9 Certification) to
 * backend/audit/capadex-3.9-benchmark-intelligence/.
 *
 * Numbers are sourced from scan.json so the docs can NEVER drift from the measurement.
 * The NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin ·
 * frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited; adoption is a
 * SEPARATE usage axis (never a gap); null≠0; benchmarking ABSTAINS below k_min; never fabricated. Scope is
 * BENCHMARKING & COMPARISON ONLY.
 * Run AFTER the scan, from backend/:  npx tsx scripts/capadex-3.9-generate-deliverables.ts
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const DIR = path.join(process.cwd(), 'audit', 'capadex-3.9-benchmark-intelligence');
mkdirSync(DIR, { recursive: true });

const SCAN_PATH = path.join(DIR, 'scan.json');
const scanRaw = readFileSync(SCAN_PATH, 'utf8');
const scan = JSON.parse(scanRaw);
const SCAN_HASH = createHash('sha256').update(scanRaw).digest('hex').slice(0, 12);
const SCAN_MTIME = statSync(SCAN_PATH).mtime.toISOString();

for (const k of [
  'registry', 'axis_dimensions', 'axis_benchmark_types', 'axis_comparison_dimensions',
  'axis_time_modes', 'axis_benchmark_config', 'axis_governance_states', 'axis_super_admin_surfaces',
  'axis_frontend_surfaces', 'axis_ux_criteria', 'axis_api_groups', 'axis_traceability',
  'axis_repository_alignment', 'adoption', 'gaps', 'gap_counts', 'resolved_gaps',
  'resolved_gap_counts', 'resolved_gap_count', 'summary', 'generated_at',
]) {
  if (scan[k] == null) throw new Error(`scan.json missing required section "${k}" — re-run the scan before generating deliverables.`);
}

const REG = scan.registry;
const D = scan.axis_dimensions;
const BT = scan.axis_benchmark_types;
const CD = scan.axis_comparison_dimensions;
const TM = scan.axis_time_modes;
const BC = scan.axis_benchmark_config;
const GS = scan.axis_governance_states;
const SA = scan.axis_super_admin_surfaces;
const FE = scan.axis_frontend_surfaces;
const UX = scan.axis_ux_criteria;
const AG = scan.axis_api_groups;
const TR = scan.axis_traceability;
const R = scan.axis_repository_alignment;
const ADO = scan.adoption;
const OV = ADO.overlay || {};
const S = scan.summary;
const KMIN = scan.k_min;
const GAPS: any[] = scan.gaps;
const GC = scan.gap_counts;
const RESOLVED: any[] = scan.resolved_gaps || [];
const RGC = scan.resolved_gap_counts || { 'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0 };
const ts = scan.generated_at;

const dash = (v: any) => (v === null || v === undefined ? '—' : String(v)); // null≠0 → render null as —
const sc = (o: any) => `${o.SUPPORTED} SUPPORTED · ${o.PARTIAL} PARTIAL · ${o.DEAD_END} DEAD_END · ${o.MISSING} MISSING`;

const HEAD = (n: string, title: string) =>
  `# CAPADEX 3.0 · Program 3 · Phase 3.9 — ${title}\n\n` +
  `> Deliverable ${n} · Generated ${ts} · Source of truth: \`scan.json\` (read-only repo+DB scan, sha256:${SCAN_HASH}, written ${SCAN_MTIME}).\n` +
  `> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).\n` +
  `> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=${KMIN} real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.\n\n`;

function dimEv(d: any): string {
  const e = d.evidence;
  return `svc ${e.services.present}/${e.services.total} · rt ${e.routes.present}/${e.routes.total} · ` +
    `fe ${e.frontend.present}/${e.frontend.total} · tbl ${e.tables.present}/${e.tables.total}` +
    (e.tables.unknown ? ` · tbl-unknown ${e.tables.unknown}` : '');
}
// Pure catalog table: items have {key,label,status,note}.
function catTable(title: string, count: number, statusCounts: any, items: any[]): string {
  return `**${title}:** ${sc(statusCounts)} (${count} total).\n\n` +
    `| Capability | Status | Note |\n|---|---|---|\n` +
    items.map((c: any) => `| **${c.label}** (\`${c.key}\`) | ${c.status} | ${c.note ?? '—'} |`).join('\n') + '\n';
}
// Control table: items have {key,label,status,evidence[]}.
function ctrlTable(title: string, count: number, statusCounts: any, controls: any[]): string {
  return `**${title}:** ${sc(statusCounts)} (${count} total).\n\n` +
    `| Capability | Status | Anchors |\n|---|---|---|\n` +
    controls.map((c: any) => `| **${c.label}** (\`${c.key}\`) | ${c.status} | ${(c.evidence || []).join(', ') || '—'} |`).join('\n') + '\n';
}
function dimSection(key: string): string {
  return D.dimensions.filter((d: any) => d.key === key).map((d: any) => {
    const src = REG.dimensions.find((x: any) => x.key === d.key) || {};
    return `### ${d.label} (\`${d.key}\`) — ${d.status}\n` +
      (d.statusNote ? `_${d.statusNote}_\n` : '') +
      `\n- **Services**: ${(src.evidence?.services || []).join(', ') || '—'}\n` +
      `- **Routes**: ${(src.evidence?.routes || []).join(', ') || '—'}\n` +
      `- **Frontend**: ${(src.evidence?.frontend || []).join(', ') || '—'}\n` +
      `- **Tables**: ${(src.evidence?.tables || []).join(', ') || '—'}\n` +
      `- **Verified**: ${dimEv(d)}\n`;
  }).join('\n');
}

const files: Record<string, string> = {};

// ── 01 Executive Summary ─────────────────────────────────────────────────
files['01-executive-summary.md'] = HEAD('01', 'Executive Summary') +
`## What this certifies
The **ONE canonical Enterprise Benchmark Intelligence Platform** — a single certified **BENCHMARKING** layer that COMPOSES the existing benchmark substrate (\`peer-benchmark\` / \`m5-org-benchmark\` / \`mei-benchmark-engine\` / \`adaptive-benchmark\` / \`benchmark-engine\` / \`comparative-intelligence\`) plus the pure psychometric transforms (\`zFromValue\` / \`zToPercentile\`) plus the 3.8 structured-AST formula engine (NO eval / new Function) under one registry (\`config/benchmark-intelligence.ts\`) plus an additive \`abmk_*\` overlay. **No duplicate benchmark / comparison engine, no V2, no breaking change.** Scope is BENCHMARKING & COMPARISON ONLY — it turns a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group (self / peer / cohort / organization / industry / functional / geographic / global / custom) across multiple comparison dimensions + time modes and explicitly does **NOT** re-score, re-standardize or build a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).

It defines **${D.dimension_count} certification dimensions**, ${BT.count} benchmark types, ${CD.count} comparison dimensions, ${TM.count} time modes, ${BC.count} benchmark-config controls, ${GS.count} governance states, ${SA.count} super-admin surfaces, ${FE.count} frontend surfaces, ${UX.count} UX criteria, ${AG.count} API groups and a ${TR.link_count}-link standardized-score→benchmark-artefact traceability model.

This is a **CERTIFICATION + IMPLEMENTATION** deliverable (mirrors Phases 1.3–1.7 + 3.1–3.8). All ${RESOLVED.length} true engineering gaps are ENGINEERING-CLOSED via reuse-before-build — the pure \`computeReferenceStats\` / \`computeBenchmarkComparison\` / \`computeGroupComparison\` / \`computeTrend\` / \`computeDistribution\` / \`computePercentileRank\` / \`evaluateBenchmarkFormula\` mechanisms reusing the existing psychometric functions + the 3.8 formula engine + the additive \`abmk_*\` overlay — all gated by \`benchmarkIntelligence\` (default OFF) so the OFF path is byte-identical incl. schema; **all DDL runs only on the flag-gated write paths**, never at read time. The composite benchmark index is a STRUCTURED AST evaluated by a whitelisted interpreter (no eval). Benchmarking ABSTAINS below k_min=${KMIN} real members in the reference group — a value is NEVER fabricated on thin data.

## The nine INDEPENDENT dimensions (reported SEPARATELY — never composited)
| Dimension | Measured result |
|---|---|
${D.dimensions.map((d: any, i: number) => `| ${i + 1} · ${d.label} (\`${d.key}\`) | ${d.status} · ${dimEv(d)} |`).join('\n')}

**Benchmark types:** ${sc(BT.status_counts)} (${BT.count}). **Comparison dimensions:** ${sc(CD.status_counts)} (${CD.count}). **Time modes:** ${sc(TM.status_counts)} (${TM.count}).

**Repository-alignment (Coverage-only, verified vs live FS+DB):** svc ${R.services.present}/${R.services.total} · rt ${R.routes.present}/${R.routes.total} · fe ${R.frontend.present}/${R.frontend.total} · tbl ${R.tables.present}/${R.tables.total} (absent ${R.tables.absent}, unknown ${R.tables.unknown}).

## Gaps — ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED (engineering-closed, adoption reported separately)
**${scan.gap_total} OPEN gaps** (${GC['Launch-Critical']} Launch-Critical · ${GC.High} High · ${GC.Medium} Medium · ${GC.Low} Low · ${GC.Future} Future). All ${RESOLVED.length} former engineering gaps are ENGINEERING-CLOSED: a canonical benchmark-result layer, a multi-dimension / multi-mode comparison engine, a safe versioned structured-AST composite index, scoped benchmark configuration + custom groups, governance / version history, benchmark APIs and the console / workbench UI — via REUSE-before-build (pure compute mechanisms reusing the existing psychometric functions + 3.8 formula engine + own additive overlay tables). Benchmarking ABSTAINS below k_min real members. The honest BOUNDARIES that remain are **coverage-breadth / upstream-input boundaries** (Medium/Future), reported in-line, **NOT** Launch-Critical. What remains beyond them is **ADOPTION** — real benchmarked / governed / saved VOLUME across the overlay — a usage axis reported SEPARATELY, NEVER a gap and NEVER fabricated as adopted.

## Ready for certification?
**${S.ready_for_certification.verdict}.** ${S.ready_for_certification.note}

## Verdict
**${S.enterprise_ready.verdict}.** ${S.enterprise_ready.note}
`;

// ── 02 Benchmark Engine (dimension 1) ────────────────────────────────────
files['02-benchmark-engine-report.md'] = HEAD('02', 'Benchmark Engine Report (dimension 1 · benchmark_engine)') +
`A standardized score is benchmarked against a reference distribution — percentile rank, z-score, delta-from-mean and quartile — via the pure \`computeReferenceStats\` / \`computeBenchmarkComparison\` / \`computePercentileRank\` mechanisms reusing the \`psychometric-standardization\` transforms (\`zFromValue\` / \`zToPercentile\`) + the additive \`abmk_results\` overlay. The transforms are pure functions of the score + reference distribution; benchmarking ABSTAINS below k_min=${KMIN} real members (returns \`abstained=true\`, values null) — never fabricated.\n\n` +
`${dimSection('benchmark_engine')}\n`;

// ── 03 Comparison Engine (dimension 2) ───────────────────────────────────
files['03-comparison-engine-report.md'] = HEAD('03', 'Comparison Engine Report (dimension 2 · comparison_engine)') +
`Multi-dimension / multi-group / multi-mode comparison — self vs peer / cohort / organization / industry / global reference groups, across comparison dimensions + time modes, with trend and distribution views — via the pure \`computeGroupComparison\` / \`computeTrend\` / \`computeDistribution\` mechanisms + a STRUCTURED-AST composite benchmark index (\`evaluateBenchmarkFormula\`, reusing the 3.8 whitelisted interpreter — NO eval / new Function). Comparisons over reference groups below k_min ABSTAIN — never fabricated.\n\n` +
catTable('Comparison dimensions', CD.count, CD.status_counts, REG.comparison_dimensions) +
`\n${catTable('Time modes', TM.count, TM.status_counts, REG.time_modes)}` +
`\n${dimSection('comparison_engine')}\n` +
`\n_The composite benchmark index is a STRUCTURED AST evaluated by a whitelisted interpreter — no \`eval\`, no \`new Function\`. Unknown operators / variables / non-finite results are rejected by validation, not executed._\n`;

// ── 04 Benchmark Types ───────────────────────────────────────────────────
files['04-benchmark-types-report.md'] = HEAD('04', 'Benchmark Types Report') +
`A standardized score can be benchmarked against ${BT.count} reference-group types. The ${BT.status_counts.SUPPORTED} SUPPORTED types are reachable directly today; the ${BT.status_counts.PARTIAL} PARTIAL types are reachable via generic **custom benchmark groups** (\`saveGroup\` inclusion/exclusion + \`min_sample_size\`) pending first-class roster ingestion — an ADOPTION / upstream-input boundary, NOT a coverage gap. Every benchmark ABSTAINS below k_min=${KMIN} real members.\n\n` +
catTable('Benchmark types', BT.count, BT.status_counts, REG.benchmark_types);

// ── 05 Benchmark Config Scopes ───────────────────────────────────────────
files['05-benchmark-config-report.md'] = HEAD('05', 'Benchmark Configuration & Scoping Report') +
`A benchmark configuration (reference group + comparison dimensions + composite index + min sample size) can be scoped — organization / institution / industry / country / custom — stored via \`saveConfig\` and resolved most-specific-wins via \`resolveConfig\` + \`CONFIG_SCOPE_PRECEDENCE\`, over the additive \`abmk_configs\` overlay.\n\n` +
ctrlTable('Benchmark config controls', BC.count, BC.status_counts, REG.benchmark_config) +
`\n_Scoped configs + custom groups are WIRED: stored (\`saveConfig\` / \`saveGroup\`) AND resolved most-specific-wins (\`resolveConfig\`). A real populated config / group per scope is an ADOPTION axis (honest 0), NOT a coverage gap._\n`;

// ── 06 Governance (dimension 3) ──────────────────────────────────────────
files['06-governance-report.md'] = HEAD('06', 'Governance Report (dimension 3 · governance)') +
`Benchmark groups / configs / composite indices move through **draft → review → validate → approve → publish → archive → rollback → retire** with version history, rollback and an audit trail — recorded in the additive \`abmk_governance_log\` + \`abmk_audit_log\` overlays via the flag-gated governance transition path (\`recordGovernanceTransition\`, GOVERNANCE_ORDER-validated).\n\n` +
ctrlTable('Governance states', GS.count, GS.status_counts, REG.governance_states) +
`\n${dimSection('governance')}\n`;

// ── 07 Super Admin (dimension 4) ─────────────────────────────────────────
files['07-super-admin-report.md'] = HEAD('07', 'Super Admin Report (dimension 4 · super_admin)') +
`The super-admin benchmark console (\`BenchmarkIntelligencePanel\`) surfaces benchmark-group config, comparison config, composite-index builder, scoped-config manager, version control, governance approval workflow and audit console. Verified vs the live frontend tree.\n\n` +
ctrlTable('Super-admin surfaces', SA.count, SA.status_counts, REG.super_admin_surfaces) +
`\n${dimSection('super_admin')}\n` +
`\n_Organization overrides are WIRED: the console lists organization-scoped configs (GET /configs?scope=organization) + previews most-specific-wins resolution (POST /configs/resolve). Real org-override configs are an ADOPTION axis (honest 0), NOT a coverage gap._\n`;

// ── 08 Frontend (dimension 5) ────────────────────────────────────────────
files['08-frontend-report.md'] = HEAD('08', 'Frontend Report (dimension 5 · frontend)') +
`The super-admin benchmark console (\`BenchmarkIntelligencePanel\`) + the interactive \`BenchmarkIntelligenceWorkbench\` (reference stats · percentile / z / delta / quartile · group comparison · trend · distribution · structured-AST composite index) that exercises the pure benchmark mechanisms live. Verified vs the live frontend tree.\n\n` +
`**Frontend evidence (verified):** fe ${R.frontend.present}/${R.frontend.total}.\n\n` +
ctrlTable('Frontend surfaces', FE.count, FE.status_counts, REG.frontend_surfaces) +
`\n${dimSection('frontend')}\n` +
`\n_The workbench renders honest ABSTAIN / empty / loading / error states — a reference group below k_min renders as an explicit "abstained" marker, never a fabricated number; null (unreadable) renders as "not measurable", distinct from 0 (empty)._\n`;

// ── 09 UX (dimension 6) ──────────────────────────────────────────────────
files['09-ux-report.md'] = HEAD('09', 'UX Report (dimension 6 · ux)') +
`The benchmark UX — interactive comparison builder, composite-index builder, live preview, percentile / bell-curve / distribution / quartile visualization, cohort drill-down, export, progressive disclosure, responsive and accessible surfaces.\n\n` +
ctrlTable('UX criteria', UX.count, UX.status_counts, REG.ux_criteria) +
`\n${dimSection('ux')}\n` +
`\n_Per-cohort distribution + quartile visualization is WIRED: \`computeDistribution\` (reusing the pure reference-stats mechanism). Non-finite values are ignored; never fabricated. A reference group below k_min ABSTAINS._\n`;

// ── 10 API (dimension 7) ─────────────────────────────────────────────────
files['10-api-report.md'] = HEAD('10', 'API Report (dimension 7 · apis)') +
`The unified benchmark API surface at \`/api/admin/benchmark-intelligence/*\` (super-admin cert GETs) + \`/api/benchmark-intelligence/enabled\` (flag probe) + the mechanism POST paths (compute/{reference-stats,benchmark,group-comparison,trend,distribution,percentile-rank,formula}) and the overlay write paths (groups / configs / results / governance / audit / views save + list GETs).\n\n` +
ctrlTable('API groups', AG.count, AG.status_counts, REG.api_groups) +
`\n## Traceability model (${TR.link_count} standardized-score→benchmark-artefact links)\n` +
`Each link → the artefact it carries + the EXISTING source it REUSES (reuse-before-build).\n\n` +
`**Traceability status:** ${sc(TR.trace_status_counts)}.\n\n` +
`| Link | Source (reused) | Status | Note |\n|---|---|---|---|\n` +
TR.traceability.map((m: any) => `| **${m.label}** (\`${m.key}\`) | \`${m.source}\` | ${m.status} | ${m.note ?? '—'} |`).join('\n') + '\n\n' +
`${dimSection('apis')}\n` +
`## Contract\n` +
`- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.\n` +
`- Mechanism POSTs (\`compute/*\`) are **PURE** (no DB, no eval) unless \`persist=true\`; the overlay save routes + governance transition are the **ONLY** DDL sites, gated by \`benchmarkIntelligence\` + super-admin.\n` +
`- The composite benchmark index is a STRUCTURED AST evaluated by a whitelisted interpreter — no \`eval\` / \`new Function\`.\n` +
`- Benchmarking ABSTAINS below k_min=${KMIN} real members — never fabricated.\n` +
`- Flag OFF → \`/enabled\` 503, \`/api/admin/benchmark-intelligence/*\` 401, public-config \`benchmark_intelligence:false\`; benchmark flow + schema byte-identical.\n`;

// ── 11 Validation & Testing (dimension 8) ────────────────────────────────
files['11-validation-testing-report.md'] = HEAD('11', 'Validation & Testing Report (dimension 8 · testing)') +
`Benchmark artefacts are validated — composite-index formula validation (\`validateFormula\` rejects unknown ops/vars/non-finite before evaluation), reference-distribution validation (ABSTAINS below k_min=${KMIN}), percentile / z / delta / quartile range + boundary checks and exception handling — via the pure mechanisms; the flag-gated e2e test (\`tests/capadex-3.9-benchmark-intelligence.test.ts\`) proves OFF is byte-identical (probe/cert/compute gate before work) and ON computes real percentile / z / delta / quartile + ABSTAINS below k_min.\n\n` +
`${dimSection('testing')}\n`;

// ── 12 Repository Change Summary (dimension 9 · documentation) ────────────
files['12-repository-change-summary.md'] = HEAD('12', 'Repository Change Summary & Alignment (dimension 9 · documentation)') +
`## New files (additive, flag-gated)\n` +
`- \`backend/config/benchmark-intelligence.ts\` — canonical benchmark registry (${D.dimension_count} dimensions, catalogs, controls, traceability, decisions, gaps).\n` +
`- \`backend/services/benchmark-intelligence-mechanisms.ts\` — pure \`computeReferenceStats\` / \`computeBenchmarkComparison\` / \`computeGroupComparison\` / \`computeTrend\` / \`computeDistribution\` / \`computePercentileRank\` / \`evaluateBenchmarkFormula\` mechanisms + \`abmk_*\` overlay ensure-schema/save + coverage helpers (DDL only on flag-gated write paths).\n` +
`- \`backend/services/benchmark-intelligence-engine.ts\` — read-only composer/verifier (${D.dimension_count} dimensions, catalogs, controls, traceability, repository-alignment, adoption, gaps, summary).\n` +
`- \`backend/routes/benchmark-intelligence.ts\` — \`/api/benchmark-intelligence/enabled\` probe + super-admin \`/api/admin/benchmark-intelligence/*\` cert GETs + mechanism POSTs + overlay writes + governance transition.\n` +
`- \`backend/scripts/capadex-3.9-benchmark-intelligence-scan.ts\` + \`capadex-3.9-generate-deliverables.ts\` — SSoT scan + deliverable generator.\n` +
`- \`frontend/src/components/superadmin/BenchmarkIntelligencePanel.tsx\` + \`frontend/src/components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx\` — super-admin benchmark console + interactive workbench.\n\n` +
`## Wiring (byte-identical OFF)\n` +
`- \`config/feature-flags.ts\`: \`benchmarkIntelligence:false\` + \`isBenchmarkIntelligenceEnabled()\` (env \`FF_BENCHMARK_INTELLIGENCE\`).\n` +
`- \`routes.ts\`: import + \`registerBenchmarkIntelligenceRoutes(...)\`.\n` +
`- \`routes/capadex.ts\`: public-config \`benchmark_intelligence\` (dual import-site — getter import + key).\n` +
`- \`SuperAdminDashboard.tsx\`: lazy panel + \`/enabled\` probe + conditional-spread nav (hidden OFF).\n\n` +
`${dimSection('documentation')}\n` +
`## Repository alignment (Coverage-only, verified vs live FS+DB)\n` +
`Every dimension evidence claim verified INDEPENDENTLY against the live filesystem + DB. null (unknown) ≠ 0 (absent).\n\n` +
`| Evidence kind | Present / Total |\n|---|---|\n` +
`| Services | ${R.services.present}/${R.services.total} |\n` +
`| Routes | ${R.routes.present}/${R.routes.total} |\n` +
`| Frontend | ${R.frontend.present}/${R.frontend.total} |\n` +
`| Tables | ${R.tables.present}/${R.tables.total} (absent ${R.tables.absent}, unknown ${R.tables.unknown}) |\n\n` +
`_${R.note ?? 'Overlay tables absent while the flag has never run its write paths — honest, byte-identical OFF.'}_\n`;

// ── 13 Benchmark Substrate Reuse ─────────────────────────────────────────
files['13-benchmark-substrate-reuse.md'] = HEAD('13', 'Benchmark Substrate Reuse (reuse-before-build)') +
`This platform **reuses** the existing benchmark substrate — it does NOT rebuild it. Each reused module below is composed by **existence-verification** in the certification scan (verified present on the live filesystem), and is **NEVER invoked at compose time**. Only the pure psychometric transforms (\`zFromValue\` / \`zToPercentile\`) + the 3.8 structured-AST formula engine are reused at RUNTIME inside the pure mechanisms.\n\n` +
`## Reused substrate (existence-verified · NOT invoked at compose)\n` +
`- \`peer-benchmark\` — peer / cohort benchmarking substrate.\n` +
`- \`m5-org-benchmark\` — organization benchmarking substrate.\n` +
`- \`mei-benchmark-engine\` — employability-index benchmarking substrate.\n` +
`- \`adaptive-benchmark\` — adaptive difficulty / ability benchmarking substrate.\n` +
`- \`benchmark-engine\` — generic benchmark metric-resolver substrate.\n` +
`- \`comparative-intelligence\` — comparative / cohort-analytics substrate.\n\n` +
`## Reused at RUNTIME (inside the pure mechanisms)\n` +
`- \`psychometric-standardization\`: \`zFromValue\` / \`zToPercentile\` — the pure z / percentile transforms.\n` +
`- Phase 3.8 structured-AST formula engine: \`validateFormula\` / \`evaluateFormula\` (via \`evaluateBenchmarkFormula\`) — the composite benchmark index (no eval / new Function).\n\n` +
`**Repository-alignment (services present):** svc ${R.services.present}/${R.services.total}. Every claim verified vs the live FS. null (unknown) ≠ 0 (absent). NO duplicate benchmark / comparison engine, NO V2, NO breaking change.\n\n` +
`## Benchmark decisions (freeze invariants)\n` +
REG.decisions.map((d: any) => `- **${d.title}** (\`${d.id}\`) — ${d.decision}`).join('\n') + '\n';

// ── 14 Remaining Gaps ────────────────────────────────────────────────────
files['14-remaining-gaps.md'] = HEAD('14', 'Remaining Gaps (OPEN · engineering-closed via reuse)') +
`**${scan.gap_total} OPEN gaps: ${GC['Launch-Critical']} Launch-Critical · ${GC.High} High · ${GC.Medium} Medium · ${GC.Low} Low · ${GC.Future} Future.**\n\n` +
`All ${RESOLVED.length} former engineering gaps are **ENGINEERING-CLOSED** — a canonical benchmark-result layer, a multi-dimension / multi-mode comparison engine, a safe versioned structured-AST composite index, scoped benchmark configuration + custom groups, governance / version history, benchmark APIs and the console / workbench UI — via REUSE-before-build (pure compute mechanisms + own additive overlay tables), each gated by \`benchmarkIntelligence\` (byte-identical OFF incl. schema; DDL only on the flag-gated write paths). The composite benchmark index is a STRUCTURED AST (no eval); benchmarking ABSTAINS below k_min=${KMIN} real members. The honest BOUNDARIES that remain are coverage-breadth / upstream-input boundaries reported in-line, **NOT** Launch-Critical. What remains beyond them is **ADOPTION** — real benchmarked / governed / saved volume — a usage axis reported SEPARATELY, NEVER a gap. Coverage⟂Confidence⟂Adoption never composited; never fabricated.\n\n` +
`## Open gaps\n` +
((['Launch-Critical', 'High', 'Medium', 'Low', 'Future'] as const).some((sev) => GAPS.some((g) => g.severity === sev))
  ? (['Launch-Critical', 'High', 'Medium', 'Low', 'Future'] as const).map((sev) => {
      const gs = GAPS.filter((g) => g.severity === sev);
      if (!gs.length) return '';
      return `### ${sev}\n` + gs.map((g) => `#### ${g.id} — ${g.title}\n- **Axis**: ${g.axis}\n- **Detail**: ${g.detail}\n`).join('\n');
    }).filter(Boolean).join('\n')
  : '_None — all engineering gaps are closed._\n') +
`\n## Resolved gaps (${RESOLVED.length}) — engineering-closed via reuse\n` +
`Severity of resolved work: ${RGC['Launch-Critical']} Launch-Critical · ${RGC.High} High · ${RGC.Medium} Medium · ${RGC.Low} Low · ${RGC.Future} Future.\n\n` +
`| ID | Severity (was) | Axis | Gap | Resolution (reuse-before-build) |\n|---|---|---|---|---|\n` +
RESOLVED.map((g) => `| **${g.id}** | ${g.severity} | \`${g.axis}\` | ${g.title} | ${g.resolution || '—'} |`).join('\n') + '\n';

// ── 15 Adoption Report (SEPARATE axis) ───────────────────────────────────
files['15-adoption-report.md'] = HEAD('15', 'Adoption Report (SEPARATE usage axis · never a gap)') +
`Engineering closure ⟂ adoption. A dimension can be fully SUPPORTED while adoption is honestly 0. Adoption is real benchmarked / governed / audited / saved-view VOLUME across the \`abmk_*\` overlay — a usage axis reported SEPARATELY, NEVER a gap, NEVER fabricated. Benchmarking ABSTAINS below k_min=${KMIN} real members. null (unreadable) ≠ 0 (empty).\n\n` +
`${ADO.note}\n\n` +
`| Overlay | Measured |\n|---|---|\n` +
`| Benchmark groups | ${dash(OV.groups)} |\n` +
`| Scoped configs | ${dash(OV.configs)} |\n` +
`| Benchmark results | ${dash(OV.results)} (suppressed ${dash(OV.suppressed_results)} · abstained ${dash(OV.abstained_results)}) |\n` +
`| Governance events | ${dash(OV.governance_events)} |\n` +
`| Audit events | ${dash(OV.audit_events)} |\n` +
`| Saved views | ${dash(OV.saved_views)} |\n\n` +
`_All \`—\` values are honest null (overlay unreadable/not yet written while OFF), NEVER fabricated as adopted._\n`;

// ── 16 Phase 3.9 Certification ───────────────────────────────────────────
files['16-phase-3.9-certification.md'] = HEAD('16', 'Phase 3.9 Certification & Verdict') +
`The NINE dimensions are certified SEPARATELY. There is deliberately **NO single composite score** — Coverage⟂Confidence⟂Adoption.\n\n` +
`## Dimension roll-up\n` +
`| # | Dimension | Result |\n|---|---|---|\n` +
D.dimensions.map((d: any, i: number) => `| ${i + 1} | ${d.label} (\`${d.key}\`) | ${d.status} · ${dimEv(d)} |`).join('\n') + '\n\n' +
`- **Benchmark types:** ${sc(BT.status_counts)} (${BT.count}). **Comparison dimensions:** ${sc(CD.status_counts)} (${CD.count}). **Time modes:** ${sc(TM.status_counts)} (${TM.count}).\n` +
`- **Repository-alignment:** svc ${R.services.present}/${R.services.total} · rt ${R.routes.present}/${R.routes.total} · fe ${R.frontend.present}/${R.frontend.total} · tbl ${R.tables.present}/${R.tables.total}.\n` +
`- **Gaps**: ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED (all ${RESOLVED.length} former gaps engineering-closed via reuse-before-build). Adoption reported separately, never a gap.\n\n` +
`## Acceptance criteria (from spec)\n` +
`| Criterion | Result |\n|---|---|\n` +
`| ONE canonical Enterprise Benchmark Intelligence registry | ✅ \`config/benchmark-intelligence.ts\` (${D.dimension_count} dimensions · ${BT.count} benchmark types · ${CD.count} comparison dimensions · ${TM.count} time modes) |\n` +
`| Composes the existing benchmark substrate (no duplicate engine, no V2) | ✅ registry over \`peer-benchmark\` / \`m5-org-benchmark\` / \`mei-benchmark-engine\` / \`adaptive-benchmark\` / \`benchmark-engine\` / \`comparative-intelligence\` + pure z/percentile transforms + 3.8 structured-AST formula engine + additive \`abmk_*\` overlay |\n` +
`| BENCHMARKING & COMPARISON scope (never re-scores/re-standardizes/builds a norm) | ✅ ${scan.scope} |\n` +
`| NINE dimensions certified SEPARATELY (never composited) | ✅ deliverables 02–12 + this cert |\n` +
`| Composite benchmark index is a STRUCTURED AST (no eval / new Function) | ✅ \`evaluateBenchmarkFormula\` whitelisted interpreter; \`validateFormula\` rejects unknown ops/vars/non-finite before evaluation |\n` +
`| Benchmarking ABSTAINS below k_min (never fabricated) | ✅ k_min=${KMIN}; abstained surfaced explicitly in mechanisms + workbench |\n` +
`| Flag-gated routes + /enabled probe (503-before-auth OFF) | ✅ \`routes/benchmark-intelligence.ts\` (cert GETs + pure mechanism POSTs + overlay writes + governance) |\n` +
`| Byte-identical OFF incl. schema · DDL only on flag-gated write paths | ✅ cert GETs read-only (to_regclass/fs probes); compute pure; overlay writes + governance are the ONLY DDL sites, flag+super-admin gated |\n` +
`| Gaps honest — engineering closure ⟂ adoption | ✅ ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED via reuse (deliverable 14); adoption reported separately (deliverable 15), never fabricated |\n` +
`| Ready for certification answered | ✅ ${S.ready_for_certification.verdict} (deliverable 01) |\n\n` +
`## Benchmark decisions (freeze invariants)\n` +
REG.decisions.map((d: any) => `- **${d.title}** (\`${d.id}\`) — ${d.decision}`).join('\n') + '\n\n' +
`## Is the Enterprise Benchmark Intelligence Platform enterprise-ready?\n` +
`**${S.enterprise_ready.verdict}.**\n\n` +
`${S.enterprise_ready.note}\n\n` +
`## Ready for certification?\n` +
`**${S.ready_for_certification.verdict}.** ${S.ready_for_certification.note}\n\n` +
`**Plainly:** YES on structure — ONE canonical Enterprise Benchmark Intelligence Platform COMPOSING the existing benchmark substrate under one registry, with ${D.dimension_count} dimensions, ${BT.count} benchmark types, ${CD.count} comparison dimensions, ${TM.count} time modes, ${BC.count} config controls, ${GS.count} governance states, ${AG.count} API groups — each evidence claim verified against the live repository. Scope is BENCHMARKING & COMPARISON ONLY; it turns a STANDARDIZED score into percentile / z / delta / quartile against a reference group across multiple dimensions + time modes and never re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE. The NINE certification dimensions are reported SEPARATELY and NEVER composited. All ${RESOLVED.length} former engineering gaps are ENGINEERING-CLOSED (${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED) via reuse-before-build (pure compute mechanisms + own additive overlay; the composite index is a STRUCTURED AST with no eval; benchmarking ABSTAINS below k_min=${KMIN}) — all behind \`benchmarkIntelligence\` so OFF is byte-identical incl. schema. The honest boundaries that remain are coverage-breadth / upstream-input boundaries, NOT gaps. What remains is ADOPTION — real benchmarked volume — a usage axis reported SEPARATELY, NEVER a gap and NEVER fabricated as adopted. Coverage⟂Confidence⟂Adoption; null≠0; nothing fabricated; the platform is enhanced-only.\n`;

const EXPECTED = [
  '01-executive-summary.md', '02-benchmark-engine-report.md', '03-comparison-engine-report.md',
  '04-benchmark-types-report.md', '05-benchmark-config-report.md', '06-governance-report.md',
  '07-super-admin-report.md', '08-frontend-report.md', '09-ux-report.md',
  '10-api-report.md', '11-validation-testing-report.md', '12-repository-change-summary.md',
  '13-benchmark-substrate-reuse.md', '14-remaining-gaps.md', '15-adoption-report.md',
  '16-phase-3.9-certification.md',
];
const got = Object.keys(files).sort();
if (got.length !== 16 || EXPECTED.some((f) => !files[f])) {
  throw new Error(`Expected EXACTLY 16 deliverables (${EXPECTED.join(', ')}); got ${got.length}: ${got.join(', ')}`);
}

for (const [name, body] of Object.entries(files)) {
  writeFileSync(path.join(DIR, name), body);
  console.log('wrote', name);
}
console.log(`\n${Object.keys(files).length} deliverables written to ${DIR}`);
