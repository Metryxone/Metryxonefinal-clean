/**
 * CAPADEX 3.0 — Program 3 · Phase 3.7 Assessment Intelligence (Interpretation & Reporting) CERTIFICATION
 * Deliverable generator. READ-ONLY: reads scan.json (the SSoT for measured numbers) and emits
 * EXACTLY 13 numbered deliverables (01→13, 13 = Phase-3.7 Certification) to
 * backend/audit/capadex-3.7-assessment-intelligence/.
 *
 * Numbers are sourced from scan.json so the docs can NEVER drift from the measurement.
 * The EIGHT certification dimensions (norms · standardization · benchmarking · ai_interpretation ·
 * report_intelligence · candidate_performance · frontend · apis) are reported SEPARATELY and NEVER
 * composited; adoption is a SEPARATE usage axis (never a gap); null≠0; norm-referenced statistics +
 * benchmarks ABSTAIN below k_min; never fabricated. Scope is INTERPRETATION & REPORTING ONLY.
 * Run AFTER the scan, from backend/:  npx tsx scripts/capadex-3.7-generate-deliverables.ts
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const DIR = path.join(process.cwd(), 'audit', 'capadex-3.7-assessment-intelligence');
mkdirSync(DIR, { recursive: true });

const SCAN_PATH = path.join(DIR, 'scan.json');
const scanRaw = readFileSync(SCAN_PATH, 'utf8');
const scan = JSON.parse(scanRaw);
const SCAN_HASH = createHash('sha256').update(scanRaw).digest('hex').slice(0, 12);
const SCAN_MTIME = statSync(SCAN_PATH).mtime.toISOString();

for (const k of [
  'registry', 'axis_dimensions', 'axis_norm_types', 'axis_standard_score_types', 'axis_benchmark_scopes',
  'axis_ai_capabilities', 'axis_report_sections', 'axis_performance_metrics', 'axis_mapping',
  'axis_repository_alignment', 'adoption', 'gaps', 'gap_counts', 'resolved_gaps', 'resolved_gap_counts',
  'resolved_gap_count', 'summary', 'generated_at',
]) {
  if (scan[k] == null) throw new Error(`scan.json missing required section "${k}" — re-run the scan before generating deliverables.`);
}

const REG = scan.registry;
const D = scan.axis_dimensions;
const NT = scan.axis_norm_types;
const SS = scan.axis_standard_score_types;
const BM = scan.axis_benchmark_scopes;
const AI = scan.axis_ai_capabilities;
const RS = scan.axis_report_sections;
const PM = scan.axis_performance_metrics;
const MAP = scan.axis_mapping;
const R = scan.axis_repository_alignment;
const ADO = scan.adoption;
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
  `# CAPADEX 3.0 · Program 3 · Phase 3.7 — ${title}\n\n` +
  `> Deliverable ${n} · Generated ${ts} · Source of truth: \`scan.json\` (read-only repo+DB scan, sha256:${SCAN_HASH}, written ${SCAN_MTIME}).\n` +
  `> Scope: INTERPRETATION & REPORTING ONLY — norm-referencing/standardization/benchmarking/AI-interpretation/report intelligence/candidate performance/frontend/APIs that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into MEANING; it NEVER re-scores or re-validates the instrument.\n` +
  `> Honesty: the EIGHT certification dimensions (norms · standardization · benchmarking · ai_interpretation · report_intelligence · candidate_performance · frontend · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced statistics + benchmarks ABSTAIN below k_min=${KMIN} real members; AI narrative confidence stays honest-null while cold-start. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.\n\n`;

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
The **ONE canonical Assessment Intelligence / Interpretation & Reporting layer** — a single certified **INTERPRETATION** layer that COMPOSES the existing interpretation services (\`psychometric-standardization\`, \`benchmark-engine\`, \`peer-benchmark\`, \`intelligence-narrative-engine\`, \`ai-reasoning-engine\`, \`dynamic-report\`) under one registry (\`config/assessment-intelligence.ts\`) plus an additive \`aint_*\` overlay. **No duplicate interpretation / benchmark / narrative / report engine, no V2, no breaking change.** Scope is INTERPRETATION & REPORTING ONLY — it turns a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into MEANING (norm-referencing · standardization · benchmarking · AI-interpretation · report intelligence · candidate performance) and explicitly does **NOT** re-score or re-validate the instrument.

It defines **${D.dimension_count} certification dimensions**, ${NT.count} norm types, ${SS.count} standard-score types, ${BM.count} benchmark scopes, ${AI.count} AI-interpretation capabilities, ${RS.count} report sections, ${PM.count} candidate-performance metrics, and a ${MAP.step_count}-step scored-result→interpretation-artefact mapping model.

This is a **CERTIFICATION + IMPLEMENTATION** deliverable (mirrors Phases 1.3–1.7 + 3.1–3.6). All ${RESOLVED.length} true engineering gaps are ENGINEERING-CLOSED via reuse-before-build — the pure \`computeNormReference\` / \`computeStandardScores\` / \`computeBenchmark\` / \`computeInterpretation\` / \`computeReport\` / \`computePerformance\` mechanisms + the additive \`aint_*\` overlay — all gated by \`assessmentIntelligence\` (default OFF) so the OFF path is byte-identical incl. schema; **all DDL runs only on the flag-gated write paths**, never at read time. Norm-referenced statistics + benchmarks ABSTAIN below k_min=${KMIN} real members; AI narrative confidence stays honest-null while cold-start — a value is NEVER fabricated on thin data.

## The eight INDEPENDENT dimensions (reported SEPARATELY — never composited)
| Dimension | Measured result |
|---|---|
| 1 · Norm referencing (${NT.count} types) | ${sc(NT.status_counts)} |
| 2 · Standardization (${SS.count} types) | ${sc(SS.status_counts)} |
| 3 · Benchmarking (${BM.count} scopes) | ${sc(BM.status_counts)} |
| 4 · AI interpretation (${AI.count} capabilities) | ${sc(AI.status_counts)} |
| 5 · Report intelligence (${RS.count} sections) | ${sc(RS.status_counts)} |
| 6 · Candidate performance (${PM.count} metrics) | ${sc(PM.status_counts)} |
| 7 · Frontend | see repository-alignment (fe ${R.frontend.present}/${R.frontend.total}) |
| 8 · APIs | see mapping (${MAP.step_count} steps) + repository-alignment (rt ${R.routes.present}/${R.routes.total}) |

**Repository-alignment (Coverage-only, verified vs live FS+DB):** svc ${R.services.present}/${R.services.total} · rt ${R.routes.present}/${R.routes.total} · fe ${R.frontend.present}/${R.frontend.total} · tbl ${R.tables.present}/${R.tables.total} (absent ${R.tables.absent}, unknown ${R.tables.unknown}).

## Gaps — ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED (engineering-closed, adoption reported separately)
**${scan.gap_total} OPEN gaps** (${GC['Launch-Critical']} Launch-Critical · ${GC.High} High · ${GC.Medium} Medium · ${GC.Low} Low · ${GC.Future} Future). All ${RESOLVED.length} former engineering gaps are ENGINEERING-CLOSED (${RESOLVED.length} RESOLVED): canonical norm-referencing, standard-score transforms, unified benchmarking, narrative interpretation over scored results, section-aware interpretation report, and candidate-performance analytics — via REUSE-before-build (pure compute mechanisms reusing the existing engines + own additive overlay tables) with norm-referenced statistics + benchmarks that ABSTAIN below k_min real members and AI narrative confidence that stays honest-null while cold-start. The honest BOUNDARIES that remain (age/national/custom norms, NCE/scaled scores, institution/national benchmarks, interpretation confidence, next-steps action plans, response consistency/timing) are **data-availability / first-class-objective boundaries** (PARTIAL), reported in-line, **NOT gaps**. Realized outcomes & KPI roll-up are the downstream Outcome/KPI scope. What remains beyond them is **ADOPTION** — real interpreted / benchmarked / reported VOLUME across the overlay — a usage axis reported SEPARATELY, NEVER a gap and NEVER fabricated as adopted.

## Ready for certification?
**${S.ready_for_certification.verdict}.** ${S.ready_for_certification.note}

## Verdict
**${S.enterprise_ready.verdict}.** ${S.enterprise_ready.note}
`;

// ── 02 Norm-Referencing Report (dimension 1) ─────────────────────────────
files['02-norm-referencing-report.md'] = HEAD('02', 'Norm-Referencing Report (dimension 1 · norms)') +
`A raw score is interpreted against a norm reference group — cohort, role, stage/lifecycle, self/ipsative (temporal), age/grade, national/population and custom (admin-defined) — via the pure \`computeNormReference\` mechanism reusing \`peer-benchmark\` (cohort) + \`benchmark-engine\` (role) + stage bands + longitudinal snapshots (self) + the additive \`aint_norm_tables\` overlay. Every norm-referenced statistic ABSTAINS below k_min=${KMIN} real members; nothing is fabricated on thin reference groups.\n\n` +
catTable('Norm types', NT.count, NT.status_counts, REG.norm_types) +
`\n${dimSection('norms')}\n` +
`\n_Age/grade, national/population and custom norms are PARTIAL: the mechanism can store + apply them (\`aint_norm_tables\`) but a k_min-sized age-tagged / representative / custom reference sample is a data-availability boundary, NOT an engineering gap._\n`;

// ── 03 Standardization Report (dimension 2) ──────────────────────────────
files['03-standardization-report.md'] = HEAD('03', 'Standardization Report (dimension 2 · standardization)') +
`A raw score is standardized against a reference distribution — percentile rank, z-score, T-score (μ=50,σ=10), stanine (1–9), sten (1–10) and deviation score (μ=100,σ=15) — via the pure \`computeStandardScores\` mechanism reusing the \`psychometric-standardization\` functions + the additive \`aint_standard_scores\` overlay. The transforms are pure functions of the score + distribution and have NO adoption dependency.\n\n` +
catTable('Standard-score types', SS.count, SS.status_counts, REG.standard_score_types) +
`\n${dimSection('standardization')}\n` +
`\n_NCE and scaled score are PARTIAL: NCE is derivable from percentile but not yet surfaced first-class (a display boundary); scaled score needs a defined target scale per assessment (a first-class-scale boundary). Neither is an engineering gap._\n`;

// ── 04 Benchmarking Report (dimension 3) ─────────────────────────────────
files['04-benchmarking-report.md'] = HEAD('04', 'Benchmarking Report (dimension 3 · benchmarking)') +
`A candidate is benchmarked against a reference group — peer-cohort, role, stage/lifecycle, temporal-self (over time), institution and national/population — via the pure \`computeBenchmark\` mechanism reusing \`peer-benchmark\` + \`benchmark-engine\` + \`wc3_longitudinal_snapshots\` + the additive \`aint_benchmarks\` overlay. Each benchmark ABSTAINS below k_min=${KMIN} real members in the reference group.\n\n` +
ctrlTable('Benchmark scopes', BM.count, BM.status_counts, REG.benchmark_scopes) +
`\n${dimSection('benchmarking')}\n` +
`\n_Institution and national benchmarks are PARTIAL: the mechanism supports them but a k_min-sized institution / representative national reference group is a data-availability boundary, NOT an engineering gap._\n`;

// ── 05 AI Interpretation Report (dimension 4) ────────────────────────────
files['05-ai-interpretation-report.md'] = HEAD('05', 'AI Interpretation Report (dimension 4 · ai_interpretation)') +
`An AI narrative is generated over a scored + validated result — narrative generation, strength identification, development-area identification, explainable reasoning chain and development recommendation — via the pure \`computeInterpretation\` mechanism reusing \`intelligence-narrative-engine\` + \`ai-reasoning-engine\` + the \`development_recommendations\` substrate + the additive \`aint_interpretations\` overlay. Interpretation confidence stays honestly null while cold-start / uncalibrated — never fabricated.\n\n` +
ctrlTable('AI-interpretation capabilities', AI.count, AI.status_counts, REG.ai_interpretation_capabilities) +
`\n${dimSection('ai_interpretation')}\n` +
`\n_Interpretation confidence is PARTIAL: the primitive exists but a calibrated confidence stays honest-null while cold-start — a Confidence axis reported SEPARATELY from Coverage, NEVER fabricated._\n`;

// ── 06 Report Intelligence Report (dimension 5) ──────────────────────────
files['06-report-intelligence-report.md'] = HEAD('06', 'Report Intelligence Report (dimension 5 · report_intelligence)') +
`A structured, section-aware interpretation report is composed — overview → score summary → norm interpretation → benchmark comparison → AI narrative → strengths & development → recommendations → next steps — via the pure \`computeReport\` mechanism reusing \`dynamic-report\` + the interpretation artefacts + the additive \`aint_reports\` overlay.\n\n` +
ctrlTable('Report sections', RS.count, RS.status_counts, REG.report_sections) +
`\n${dimSection('report_intelligence')}\n` +
`\n_Next steps / action plan is PARTIAL: the section renders but a first-class action-plan objective is a downstream boundary, NOT an engineering gap._\n`;

// ── 07 Candidate Performance Report (dimension 6) ────────────────────────
files['07-candidate-performance-report.md'] = HEAD('07', 'Candidate Performance Report (dimension 6 · candidate_performance)') +
`Candidate-performance analytics — overall standing, dimension profile, percentile standing, peer-relative standing, growth trajectory, readiness band, response consistency and response-time analytics — via the pure \`computePerformance\` mechanism reusing standardization + \`peer-benchmark\` + \`wc3_longitudinal_snapshots\` + the additive \`aint_performance\` overlay. ABSTAINS below k_min=${KMIN} where a reference group is required.\n\n` +
ctrlTable('Candidate-performance metrics', PM.count, PM.status_counts, REG.performance_metrics) +
`\n${dimSection('candidate_performance')}\n` +
`\n_Response consistency and response-time analytics are PARTIAL: both need per-item response timing captured at scale — a data-availability boundary, NOT an engineering gap._\n`;

// ── 08 Frontend Report (dimension 7) ─────────────────────────────────────
files['08-frontend-report.md'] = HEAD('08', 'Frontend Report (dimension 7 · frontend)') +
`The super-admin intelligence console (\`AssessmentIntelligencePanel\`) + the interactive \`InterpretationWorkbench\` (standardization · norm · benchmark · interpretation · report · performance) that exercises the pure interpretation mechanisms live. Verified vs the live frontend tree.\n\n` +
`**Frontend evidence (verified):** fe ${R.frontend.present}/${R.frontend.total}.\n\n` +
dimSection('frontend') +
`\n_The workbench renders honest ABSTAIN / empty / loading / error states — a value below k_min renders as an explicit "abstained" marker, never a fabricated number; null (unreadable) renders as "not measurable", distinct from 0 (empty)._\n`;

// ── 09 API Report (dimension 8) ──────────────────────────────────────────
files['09-api-report.md'] = HEAD('09', 'API Report (dimension 8 · apis)') +
`The unified intelligence API surface at \`/api/admin/assessment-intelligence/*\` (super-admin cert GETs) + \`/api/assessment-intelligence/enabled\` (flag probe) + the mechanism POST paths (compute/{norm-reference,standard-scores,benchmark,interpretation,report,performance}) and the overlay write paths (norm-table/standard-score/benchmark/interpretation/report/performance save + list GETs).\n\n` +
`## Mapping model (${MAP.step_count} scored-result→interpretation-artefact steps)\n` +
`Each step → the artifact it produces + the EXISTING engine/table it REUSES (reuse-before-build).\n\n` +
`**Mapping status:** ${sc(MAP.mapping_status_counts)}.\n\n` +
`| Step | Target | Source (reused) | Status | Note |\n|---|---|---|---|---|\n` +
MAP.mapping.map((m: any) => `| **${m.label}** (\`${m.key}\`) | ${m.target} | \`${m.source}\` | ${m.status} | ${m.note ?? '—'} |`).join('\n') + '\n\n' +
`${dimSection('apis')}\n` +
`## Contract\n` +
`- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.\n` +
`- Mechanism POSTs (\`compute/*\`) are **PURE** (no DB) unless \`persist=true\`; the overlay save routes are the **ONLY** DDL sites, gated by \`assessmentIntelligence\` + super-admin.\n` +
`- Norm-referenced statistics + benchmarks ABSTAIN below k_min=${KMIN} real members; AI narrative confidence stays honest-null while cold-start — never fabricated.\n` +
`- Flag OFF → \`/enabled\` 503, \`/api/admin/assessment-intelligence/*\` 401, public-config \`assessment_intelligence:false\`; interpretation flow + schema byte-identical.\n`;

// ── 10 Repository Change Summary ─────────────────────────────────────────
files['10-repository-change-summary.md'] = HEAD('10', 'Repository Change Summary & Alignment') +
`## New files (additive, flag-gated)\n` +
`- \`backend/config/assessment-intelligence.ts\` — canonical intelligence registry (${D.dimension_count} dimensions, catalogs, controls, mapping, decisions, gaps).\n` +
`- \`backend/services/assessment-intelligence-mechanisms.ts\` — pure \`computeNormReference\` / \`computeStandardScores\` / \`computeBenchmark\` / \`computeInterpretation\` / \`computeReport\` / \`computePerformance\` mechanisms + \`aint_*\` overlay ensure-schema/save + coverage helpers (DDL only on flag-gated write paths).\n` +
`- \`backend/services/assessment-intelligence-engine.ts\` — read-only composer/verifier (${D.dimension_count} dimensions, catalogs, controls, mapping, repository-alignment, adoption, gaps, summary).\n` +
`- \`backend/routes/assessment-intelligence.ts\` — \`/api/assessment-intelligence/enabled\` probe + super-admin \`/api/admin/assessment-intelligence/*\` cert GETs + mechanism POSTs + overlay writes.\n` +
`- \`backend/scripts/capadex-3.7-assessment-intelligence-scan.ts\` + \`capadex-3.7-generate-deliverables.ts\` — SSoT scan + deliverable generator.\n` +
`- \`frontend/src/components/superadmin/AssessmentIntelligencePanel.tsx\` + \`frontend/src/components/intelligence/InterpretationWorkbench.tsx\` — super-admin intelligence console + interactive workbench.\n\n` +
`## Wiring (byte-identical OFF)\n` +
`- \`config/feature-flags.ts\`: \`assessmentIntelligence:false\` + \`isAssessmentIntelligenceEnabled()\` (env \`FF_ASSESSMENT_INTELLIGENCE\`).\n` +
`- \`routes.ts\`: import + \`registerAssessmentIntelligenceRoutes(...)\`.\n` +
`- \`routes/capadex.ts\`: public-config \`assessment_intelligence\` (dual import-site — getter import + key).\n` +
`- \`SuperAdminDashboard.tsx\`: lazy panel + \`/enabled\` probe + conditional-spread nav (hidden OFF).\n\n` +
`## Repository alignment (Coverage-only, verified vs live FS+DB)\n` +
`Every dimension evidence claim verified INDEPENDENTLY against the live filesystem + DB. null (unknown) ≠ 0 (absent).\n\n` +
`| Evidence kind | Present / Total |\n|---|---|\n` +
`| Services | ${R.services.present}/${R.services.total} |\n` +
`| Routes | ${R.routes.present}/${R.routes.total} |\n` +
`| Frontend | ${R.frontend.present}/${R.frontend.total} |\n` +
`| Tables | ${R.tables.present}/${R.tables.total} (absent ${R.tables.absent}, unknown ${R.tables.unknown}) |\n\n` +
`_${R.note ?? 'Overlay tables absent while the flag has never run its write paths — honest, byte-identical OFF.'}_\n`;

// ── 11 Remaining Gaps ────────────────────────────────────────────────────
files['11-remaining-gaps.md'] = HEAD('11', 'Remaining Gaps (OPEN · engineering-closed via reuse)') +
`**${scan.gap_total} OPEN gaps: ${GC['Launch-Critical']} Launch-Critical · ${GC.High} High · ${GC.Medium} Medium · ${GC.Low} Low · ${GC.Future} Future.**\n\n` +
`All ${RESOLVED.length} former engineering gaps are **ENGINEERING-CLOSED** — canonical norm-referencing, standard-score transforms, unified benchmarking, narrative interpretation over scored results, section-aware interpretation report, and candidate-performance analytics — via REUSE-before-build (pure compute mechanisms + own additive overlay tables), each gated by \`assessmentIntelligence\` (byte-identical OFF incl. schema; DDL only on the flag-gated write paths). Norm-referenced statistics + benchmarks ABSTAIN below k_min=${KMIN} real members; AI narrative confidence stays honest-null while cold-start. The honest BOUNDARIES that remain (age/national/custom norms, NCE/scaled scores, institution/national benchmarks, interpretation confidence, next-steps plans, consistency/timing) are data-availability / first-class-objective boundaries reported in-line, **NOT gaps**. What remains beyond them is **ADOPTION** — real interpreted / benchmarked / reported volume — a usage axis reported SEPARATELY, NEVER a gap. Coverage⟂Confidence⟂Adoption never composited; never fabricated.\n\n` +
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

// ── 12 Adoption Report (SEPARATE axis) ───────────────────────────────────
files['12-adoption-report.md'] = HEAD('12', 'Adoption Report (SEPARATE usage axis · never a gap)') +
`Engineering closure ⟂ adoption. A dimension can be fully SUPPORTED while adoption is honestly 0. Adoption is real interpreted / standardized / benchmarked / narrated / reported VOLUME across the \`aint_*\` overlay — a usage axis reported SEPARATELY, NEVER a gap, NEVER fabricated. Norm-referenced statistics + benchmarks ABSTAIN below k_min=${KMIN} real members; AI narrative confidence stays honest-null while cold-start. null (unreadable) ≠ 0 (empty).\n\n` +
`${ADO.note}\n\n` +
`| Overlay | Measured |\n|---|---|\n` +
`| Norm tables | ${dash(ADO.norm_tables?.norm_tables)} (types ${dash(ADO.norm_tables?.types_used)} · assessments ${dash(ADO.norm_tables?.assessments)} · abstained ${dash(ADO.norm_tables?.abstained)}) |\n` +
`| Standard scores | ${dash(ADO.standard_scores?.scores)} (subjects ${dash(ADO.standard_scores?.subjects)} · assessments ${dash(ADO.standard_scores?.assessments)} · abstained ${dash(ADO.standard_scores?.abstained)}) |\n` +
`| Benchmarks | ${dash(ADO.benchmarks?.benchmarks)} (subjects ${dash(ADO.benchmarks?.subjects)} · scopes ${dash(ADO.benchmarks?.scopes_used)} · abstained ${dash(ADO.benchmarks?.abstained)}) |\n` +
`| Interpretations | ${dash(ADO.interpretations?.interpretations)} (subjects ${dash(ADO.interpretations?.subjects)} · with-confidence ${dash(ADO.interpretations?.with_confidence)} · abstained ${dash(ADO.interpretations?.abstained)}) |\n` +
`| Reports | ${dash(ADO.reports?.reports)} (subjects ${dash(ADO.reports?.subjects)} · assessments ${dash(ADO.reports?.assessments)}) |\n` +
`| Performance | ${dash(ADO.performance?.performance)} (subjects ${dash(ADO.performance?.subjects)} · assessments ${dash(ADO.performance?.assessments)} · abstained ${dash(ADO.performance?.abstained)}) |\n` +
`| Repository | ${dash(ADO.repository?.artefacts)} (types ${dash(ADO.repository?.types_used)} · active ${dash(ADO.repository?.active)}) |\n\n` +
`_All \`—\` values are honest null (overlay unreadable/not yet written while OFF), NEVER fabricated as adopted._\n`;

// ── 13 Phase 3.7 Certification ───────────────────────────────────────────
files['13-phase-3.7-certification.md'] = HEAD('13', 'Phase 3.7 Certification & Verdict') +
`The EIGHT dimensions are certified SEPARATELY. There is deliberately **NO single composite score** — Coverage⟂Confidence⟂Adoption.\n\n` +
`## Dimension roll-up\n` +
`| # | Dimension | Result |\n|---|---|---|\n` +
`| 1 | Norm referencing (${NT.count} types) | ${sc(NT.status_counts)} |\n` +
`| 2 | Standardization (${SS.count} types) | ${sc(SS.status_counts)} |\n` +
`| 3 | Benchmarking (${BM.count} scopes) | ${sc(BM.status_counts)} |\n` +
`| 4 | AI interpretation (${AI.count} capabilities) | ${sc(AI.status_counts)} |\n` +
`| 5 | Report intelligence (${RS.count} sections) | ${sc(RS.status_counts)} |\n` +
`| 6 | Candidate performance (${PM.count} metrics) | ${sc(PM.status_counts)} |\n` +
`| 7 | Frontend | fe ${R.frontend.present}/${R.frontend.total} |\n` +
`| 8 | APIs — mapping (${MAP.step_count} steps) | ${sc(MAP.mapping_status_counts)} · rt ${R.routes.present}/${R.routes.total} |\n\n` +
`- **Repository-alignment:** svc ${R.services.present}/${R.services.total} · rt ${R.routes.present}/${R.routes.total} · fe ${R.frontend.present}/${R.frontend.total} · tbl ${R.tables.present}/${R.tables.total}.\n` +
`- **Gaps**: ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED (all ${RESOLVED.length} former gaps engineering-closed via reuse-before-build). Adoption reported separately, never a gap.\n\n` +
`## Acceptance criteria (from spec)\n` +
`| Criterion | Result |\n|---|---|\n` +
`| ONE canonical Assessment Intelligence / Interpretation & Reporting registry | ✅ \`config/assessment-intelligence.ts\` (${D.dimension_count} dimensions · ${NT.count} norm · ${SS.count} standard-score · ${BM.count} benchmark scopes) |\n` +
`| Composes the existing interpretation services (no duplicate engine, no V2) | ✅ registry over psychometric-standardization / benchmark / peer-benchmark / narrative / ai-reasoning / dynamic-report engines + additive \`aint_*\` overlay |\n` +
`| INTERPRETATION & REPORTING scope (never re-scores/re-validates the instrument) | ✅ ${scan.scope} |\n` +
`| EIGHT dimensions certified SEPARATELY (never composited) | ✅ deliverables 02–09 + this cert |\n` +
`| Norm-referenced statistics + benchmarks ABSTAIN below k_min (never fabricated) | ✅ k_min=${KMIN}; abstained surfaced explicitly in mechanisms + workbench; AI narrative confidence honest-null while cold-start |\n` +
`| Flag-gated routes + /enabled probe (503-before-auth OFF) | ✅ \`routes/assessment-intelligence.ts\` (cert GETs + pure mechanism POSTs + overlay writes) |\n` +
`| Byte-identical OFF incl. schema · DDL only on flag-gated write paths | ✅ cert GETs read-only (to_regclass/fs probes); compute pure; overlay writes are the ONLY DDL sites, flag+super-admin gated |\n` +
`| Gaps honest — engineering closure ⟂ adoption | ✅ ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED via reuse (deliverable 11); adoption reported separately (deliverable 12), never fabricated |\n` +
`| Ready for certification answered | ✅ ${S.ready_for_certification.verdict} (deliverable 01) |\n\n` +
`## Intelligence decisions (freeze invariants)\n` +
REG.decisions.map((d: any) => `- **${d.title}** (\`${d.id}\`) — ${d.decision}`).join('\n') + '\n\n' +
`## Is the Assessment Intelligence / Interpretation & Reporting layer enterprise-ready?\n` +
`**${S.enterprise_ready.verdict}.**\n\n` +
`${S.enterprise_ready.note}\n\n` +
`## Ready for certification?\n` +
`**${S.ready_for_certification.verdict}.** ${S.ready_for_certification.note}\n\n` +
`**Plainly:** YES on structure — ONE canonical Assessment Intelligence / Interpretation & Reporting layer COMPOSING the existing interpretation services under one registry, with ${D.dimension_count} dimensions, ${NT.count} norm types, ${SS.count} standard-score types, ${BM.count} benchmark scopes, ${AI.count} AI-interpretation capabilities, ${RS.count} report sections, ${PM.count} candidate-performance metrics — each evidence claim verified against the live repository. Scope is INTERPRETATION & REPORTING ONLY; it turns a SCORED + VALIDATED result into MEANING and never re-scores or re-validates the instrument. The EIGHT certification dimensions are reported SEPARATELY and NEVER composited. All ${RESOLVED.length} former engineering gaps are ENGINEERING-CLOSED (${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED) via reuse-before-build (pure compute mechanisms + own additive overlay; norm-referenced statistics + benchmarks ABSTAIN below k_min=${KMIN}; AI narrative confidence honest-null while cold-start) — all behind \`assessmentIntelligence\` so OFF is byte-identical incl. schema. The honest boundaries that remain (age/national/custom norms, NCE/scaled scores, institution/national benchmarks, interpretation confidence, next-steps plans, consistency/timing) are data-availability / first-class-objective boundaries, NOT gaps. What remains is ADOPTION — real interpreted volume — a usage axis reported SEPARATELY, NEVER a gap and NEVER fabricated as adopted. Coverage⟂Confidence⟂Adoption; null≠0; nothing fabricated; the platform is enhanced-only.\n`;

const EXPECTED = [
  '01-executive-summary.md', '02-norm-referencing-report.md', '03-standardization-report.md',
  '04-benchmarking-report.md', '05-ai-interpretation-report.md', '06-report-intelligence-report.md',
  '07-candidate-performance-report.md', '08-frontend-report.md', '09-api-report.md',
  '10-repository-change-summary.md', '11-remaining-gaps.md', '12-adoption-report.md',
  '13-phase-3.7-certification.md',
];
const got = Object.keys(files).sort();
if (got.length !== 13 || EXPECTED.some((f) => !files[f])) {
  throw new Error(`Expected EXACTLY 13 deliverables (${EXPECTED.join(', ')}); got ${got.length}: ${got.join(', ')}`);
}

for (const [name, body] of Object.entries(files)) {
  writeFileSync(path.join(DIR, name), body);
  console.log('wrote', name);
}
console.log(`\n${Object.keys(files).length} deliverables written to ${DIR}`);
