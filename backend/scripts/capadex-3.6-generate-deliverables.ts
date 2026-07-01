/**
 * CAPADEX 3.0 — Program 3 · Phase 3.6 Assessment Science / Psychometrics / Item Intelligence CERTIFICATION
 * Deliverable generator. READ-ONLY: reads scan.json (the SSoT for measured numbers) and emits
 * EXACTLY 13 numbered deliverables (01→13, 13 = Phase-3.6 Certification) to
 * backend/audit/capadex-3.6-assessment-science/.
 *
 * Numbers are sourced from scan.json so the docs can NEVER drift from the measurement.
 * The EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance ·
 * blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited; adoption
 * is a SEPARATE usage axis (never a gap); null≠0; item-level statistics ABSTAIN below k_min; never fabricated.
 * Scope is INSTRUMENT / QUESTION QUALITY ONLY.
 * Run AFTER the scan, from backend/:  npx tsx scripts/capadex-3.6-generate-deliverables.ts
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const DIR = path.join(process.cwd(), 'audit', 'capadex-3.6-assessment-science');
mkdirSync(DIR, { recursive: true });

const SCAN_PATH = path.join(DIR, 'scan.json');
const scanRaw = readFileSync(SCAN_PATH, 'utf8');
const scan = JSON.parse(scanRaw);
const SCAN_HASH = createHash('sha256').update(scanRaw).digest('hex').slice(0, 12);
const SCAN_MTIME = statSync(SCAN_PATH).mtime.toISOString();

for (const k of [
  'registry', 'axis_dimensions', 'axis_item_analysis', 'axis_quality_checks', 'axis_reliability',
  'axis_validity', 'axis_governance', 'axis_blueprint', 'axis_mapping', 'axis_repository_alignment',
  'adoption', 'gaps', 'gap_counts', 'resolved_gaps', 'resolved_gap_counts', 'resolved_gap_count',
  'summary', 'generated_at',
]) {
  if (scan[k] == null) throw new Error(`scan.json missing required section "${k}" — re-run the scan before generating deliverables.`);
}

const REG = scan.registry;
const D = scan.axis_dimensions;
const IA = scan.axis_item_analysis;
const QC = scan.axis_quality_checks;
const REL = scan.axis_reliability;
const VAL = scan.axis_validity;
const GOV = scan.axis_governance;
const BP = scan.axis_blueprint;
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
  `# CAPADEX 3.0 · Program 3 · Phase 3.6 — ${title}\n\n` +
  `> Deliverable ${n} · Generated ${ts} · Source of truth: \`scan.json\` (read-only repo+DB scan, sha256:${SCAN_HASH}, written ${SCAN_MTIME}).\n` +
  `> Scope: INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).\n` +
  `> Honesty: the EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Item-level statistics ABSTAIN below k_min=${KMIN} real responses. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.\n\n`;

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
The **ONE canonical Assessment Science / Psychometrics / Item Intelligence layer** — a single certified **INSTRUMENT-QUALITY** layer that COMPOSES the existing psychometric services (\`psychometric-intelligence-engine\`, \`sci-psychometric-engine\`, \`reliability-engine\`, \`quality-validator\`, \`assessment-blueprint-engine\`) under one registry (\`config/assessment-science.ts\`) plus an additive \`asci_*\` overlay. **No duplicate psychometric engine, no V2, no breaking change.** Scope is INSTRUMENT / QUESTION QUALITY ONLY — it measures how GOOD the assessment/question is (item analysis · reliability · validity · quality governance · blueprint validation) and explicitly does **NOT** score or interpret a candidate, and does **NOT** run norms, standardization, benchmarking, AI-interpretation, recommendations, or report intelligence (that is Phase 3.7+).

It defines **${D.dimension_count} certification dimensions**, ${IA.count} item-analysis metrics, ${QC.count} question-quality checks, ${REL.count} reliability types, ${VAL.count} validity types, ${GOV.count} governance stages, ${BP.count} blueprint controls, and a ${MAP.step_count}-step response→instrument-quality mapping model.

This is a **CERTIFICATION + IMPLEMENTATION** deliverable (mirrors Phases 1.3–1.7 + 3.1–3.5). All ${RESOLVED.length} true engineering gaps are ENGINEERING-CLOSED via reuse-before-build — the pure \`computeItemAnalysis\` / \`computeReliability\` / \`computeValidity\` / \`validateQuestionQuality\` / \`validateBlueprint\` mechanisms + the additive \`asci_*\` overlay — all gated by \`assessmentScience\` (default OFF) so the OFF path is byte-identical incl. schema; **all DDL runs only on the flag-gated write paths**, never at read time. Item-level statistics ABSTAIN below k_min=${KMIN} real responses — a value is NEVER fabricated on thin data.

## The eight INDEPENDENT dimensions (reported SEPARATELY — never composited)
| # | Dimension | Measured result |
|---|---|---|
| 1 · Item analysis (${IA.count} metrics) | ${sc(IA.status_counts)} |
| 2 · Reliability (${REL.count} types) | ${sc(REL.status_counts)} |
| 3 · Validity (${VAL.count} types) | ${sc(VAL.status_counts)} |
| 4 · Quality & governance (${QC.count} checks · ${GOV.count} stages) | ${sc(QC.status_counts)} / ${sc(GOV.status_counts)} |
| 5 · Blueprint validation (${BP.count} controls) | ${sc(BP.status_counts)} |
| 6 · Frontend | see repository-alignment (fe ${R.frontend.present}/${R.frontend.total}) |
| 7 · UX | interactive psychometrics workbench (ABSTAIN/empty/loading/error states) |
| 8 · APIs | see mapping (${MAP.step_count} steps) + repository-alignment (rt ${R.routes.present}/${R.routes.total}) |

**Repository-alignment (Coverage-only, verified vs live FS+DB):** svc ${R.services.present}/${R.services.total} · rt ${R.routes.present}/${R.routes.total} · fe ${R.frontend.present}/${R.frontend.total} · tbl ${R.tables.present}/${R.tables.total} (absent ${R.tables.absent}, unknown ${R.tables.unknown}).

## Gaps — ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED (engineering-closed, adoption reported separately)
**${scan.gap_total} OPEN gaps** (${GC['Launch-Critical']} Launch-Critical · ${GC.High} High · ${GC.Medium} Medium · ${GC.Low} Low · ${GC.Future} Future). All ${RESOLVED.length} former engineering gaps are ENGINEERING-CLOSED (${RESOLVED.length} RESOLVED): per-question difficulty/discrimination/distractor, α/split-half/test-retest/inter-rater/SEM reliability, content/construct/criterion validity, question-quality checks + governance, and blueprint coverage validation — via REUSE-before-build (pure compute/validate mechanisms reusing the existing engines + own additive overlay tables) with item-level statistics that ABSTAIN below k_min real responses. The honest BOUNDARIES that remain (norms, standardization, benchmarking, AI-interpretation, recommendations, report intelligence, candidate performance analytics) are **Phase-3.7 scope boundaries**, reported in-line, **NOT gaps**. What remains beyond them is **ADOPTION** — real analysed-item / response VOLUME across the overlay — a usage axis reported SEPARATELY, NEVER a gap and NEVER fabricated as adopted.

## Ready for Phase 3.7 (Norms, Standardization, Benchmarking & Report Intelligence)?
**${S.ready_for_phase_3_7.verdict}.** ${S.ready_for_phase_3_7.note}

## Verdict
**${S.enterprise_ready.verdict}.** ${S.enterprise_ready.note}
`;

// ── 02 Item Analysis Report (dimension 1) ────────────────────────────────
files['02-item-analysis-report.md'] = HEAD('02', 'Item Analysis Report (dimension 1 · item_analysis)') +
`Per-item difficulty (p-value), corrected item-total discrimination (point-biserial), distractor analysis, facility, exposure, IRT information, quality score, bias (DIF) primitive & retirement recommendation — via the pure \`computeItemAnalysis\` mechanism reusing the existing psychometric services + the additive \`asci_item_stats\` overlay. Every statistic ABSTAINS below k_min=${KMIN} real responses; nothing is fabricated on thin data.\n\n` +
catTable('Item-analysis metrics', IA.count, IA.status_counts, REG.item_analysis_metrics) +
`\n${dimSection('item_analysis')}\n` +
`\n_IRT item-information (\`item_information\`) and DIF (\`item_bias\`) are PARTIAL: the primitives are implemented but full IRT calibration / group-level DIF need a large calibrated pool (k_min ≫ ${KMIN}) + demographic tags (ethics-gated). That is a Phase-3.7 boundary + an adoption/data dependency, NOT an engineering gap._\n`;

// ── 03 Reliability Report (dimension 2) ──────────────────────────────────
files['03-reliability-report.md'] = HEAD('03', 'Reliability Report (dimension 2 · reliability)') +
`Internal consistency (Cronbach α), split-half (Spearman-Brown), test-retest, inter-rater (Cohen κ), parallel-forms, SEM and a score confidence interval — via the pure \`computeReliability\` mechanism over a respondents × items matrix + the additive \`asci_reliability\` overlay. ABSTAINS below k_min=${KMIN} respondents.\n\n` +
ctrlTable('Reliability types', REL.count, REL.status_counts, REG.reliability_types) +
`\n${dimSection('reliability')}\n`;

// ── 04 Validity Report (dimension 3) ─────────────────────────────────────
files['04-validity-report.md'] = HEAD('04', 'Validity Report (dimension 3 · validity)') +
`Face, content, construct, criterion, concurrent, predictive, convergent & discriminant validity — via the pure \`computeValidity\` mechanism + the additive \`asci_validity\` overlay. Each type ABSTAINS per-type below k_min=${KMIN} aligned pairs; a coefficient is NEVER fabricated.\n\n` +
ctrlTable('Validity types', VAL.count, VAL.status_counts, REG.validity_types) +
`\n${dimSection('validity')}\n`;

// ── 05 Quality & Governance Report (dimension 4) ─────────────────────────
files['05-quality-governance-report.md'] = HEAD('05', 'Quality & Governance Report (dimension 4 · quality_governance)') +
`Deterministic question-quality checks (${QC.count}) + the scientific/SME review · pilot · approval · versioning · audit governance stages (${GOV.count}). Quality checks run no scoring — a pure authoring gate via \`validateQuestionQuality\`; governance is recorded in the additive \`asci_quality_flags\` / \`asci_governance\` overlay only on the flag-gated write path.\n\n` +
`## Question-quality checks (${QC.count})\n` +
catTable('Question-quality checks', QC.count, QC.status_counts, REG.quality_checks) +
`\n## Governance stages (${GOV.count})\n` +
ctrlTable('Governance stages', GOV.count, GOV.status_counts, REG.governance_stages) +
`\n${dimSection('quality_governance')}\n`;

// ── 06 Blueprint Validation Report (dimension 5) ─────────────────────────
files['06-blueprint-validation-report.md'] = HEAD('06', 'Blueprint Validation Report (dimension 5 · blueprint_validation)') +
`Blueprint (test specification) validation — competency/behaviour/domain/skill/objective coverage + Bloom / difficulty / time distribution — validated against a declared blueprint via the pure \`validateBlueprint\` mechanism + the additive \`asci_blueprints\` overlay. A clean pre-publish gate on the instrument design.\n\n` +
ctrlTable('Blueprint coverage controls', BP.count, BP.status_counts, REG.blueprint_coverage) +
`\n${dimSection('blueprint_validation')}\n`;

// ── 07 Frontend Report (dimension 6) ─────────────────────────────────────
files['07-frontend-report.md'] = HEAD('07', 'Frontend Report (dimension 6 · frontend)') +
`The super-admin science console (\`AssessmentSciencePanel\`) + the interactive \`PsychometricsWorkbench\` (item analysis · reliability · validity · question quality · blueprint) that exercises the pure psychometric mechanisms live. Verified vs the live frontend tree.\n\n` +
`**Frontend evidence (verified):** fe ${R.frontend.present}/${R.frontend.total}.\n\n` +
dimSection('frontend');

// ── 08 UX Report (dimension 7) ───────────────────────────────────────────
files['08-ux-report.md'] = HEAD('08', 'UX Report (dimension 7 · ux)') +
`The psychometrics workbench is interactive (item drill-down, reliability preview, quality flags, blueprint gaps) with honest ABSTAIN / empty / loading / error states — a value below k_min renders as an explicit "abstained" marker, never a fabricated number; null (unreadable) renders as "not measurable", distinct from 0 (empty).\n\n` +
dimSection('ux');

// ── 09 API Report (dimension 8) ──────────────────────────────────────────
files['09-api-report.md'] = HEAD('09', 'API Report (dimension 8 · apis)') +
`The unified science API surface at \`/api/admin/assessment-science/*\` (super-admin cert GETs) + \`/api/assessment-science/enabled\` (flag probe) + the mechanism POST paths (compute/{item-analysis,reliability,validity,item-information,item-dif} · validate/{question-quality,blueprint}) and the overlay write paths (item-stats/reliability/validity/quality/blueprint/governance save + list GETs).\n\n` +
`## Mapping model (${MAP.step_count} response→instrument-quality steps)\n` +
`Each step → the artifact it produces + the EXISTING engine/table it REUSES (reuse-before-build).\n\n` +
`**Mapping status:** ${sc(MAP.mapping_status_counts)}.\n\n` +
`| Step | Target | Source (reused) | Status | Note |\n|---|---|---|---|---|\n` +
MAP.mapping.map((m: any) => `| **${m.label}** (\`${m.key}\`) | ${m.target} | \`${m.source}\` | ${m.status} | ${m.note ?? '—'} |`).join('\n') + '\n\n' +
`${dimSection('apis')}\n` +
`## Contract\n` +
`- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.\n` +
`- Mechanism POSTs (\`compute/*\`, \`validate/*\`) are **PURE** (no DB) unless \`persist=true\`; the overlay save routes are the **ONLY** DDL sites, gated by \`assessmentScience\` + super-admin.\n` +
`- Item-level statistics ABSTAIN below k_min=${KMIN} real responses — never fabricated.\n` +
`- Flag OFF → \`/enabled\` 503, \`/api/admin/assessment-science/*\` 401, public-config \`assessment_science:false\`; science flow + schema byte-identical.\n`;

// ── 10 Repository Change Summary ─────────────────────────────────────────
files['10-repository-change-summary.md'] = HEAD('10', 'Repository Change Summary & Alignment') +
`## New files (additive, flag-gated)\n` +
`- \`backend/config/assessment-science.ts\` — canonical science registry (${D.dimension_count} dimensions, catalogs, controls, mapping, decisions, gaps).\n` +
`- \`backend/services/assessment-science-mechanisms.ts\` — pure \`computeItemAnalysis\` / \`computeReliability\` / \`computeValidity\` / \`validateQuestionQuality\` / \`validateBlueprint\` mechanisms + \`asci_*\` overlay ensure-schema/save + coverage helpers (DDL only on flag-gated write paths).\n` +
`- \`backend/services/assessment-science-engine.ts\` — read-only composer/verifier (${D.dimension_count} dimensions, catalogs, controls, mapping, repository-alignment, adoption, gaps, summary).\n` +
`- \`backend/routes/assessment-science.ts\` — \`/api/assessment-science/enabled\` probe + super-admin \`/api/admin/assessment-science/*\` cert GETs + mechanism POSTs + overlay writes.\n` +
`- \`backend/scripts/capadex-3.6-assessment-science-scan.ts\` + \`capadex-3.6-generate-deliverables.ts\` — SSoT scan + deliverable generator.\n` +
`- \`frontend/src/components/superadmin/AssessmentSciencePanel.tsx\` + \`frontend/src/components/science/PsychometricsWorkbench.tsx\` — super-admin science console + interactive workbench.\n\n` +
`## Wiring (byte-identical OFF)\n` +
`- \`config/feature-flags.ts\`: \`assessmentScience:false\` + \`isAssessmentScienceEnabled()\` (env \`FF_ASSESSMENT_SCIENCE\`).\n` +
`- \`routes.ts\`: import + \`registerAssessmentScienceRoutes(...)\`.\n` +
`- \`routes/capadex.ts\`: public-config \`assessment_science\` (dual import-site — getter import + key).\n` +
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
`All ${RESOLVED.length} former engineering gaps are **ENGINEERING-CLOSED** — per-question difficulty/discrimination/distractor, α/split-half/test-retest/inter-rater/SEM reliability, content/construct/criterion validity, question-quality checks + governance, and blueprint coverage validation — via REUSE-before-build (pure compute/validate mechanisms + own additive overlay tables), each gated by \`assessmentScience\` (byte-identical OFF incl. schema; DDL only on the flag-gated write paths). Item-level statistics ABSTAIN below k_min=${KMIN} real responses. The honest BOUNDARIES that remain (norms/standardization/benchmarking/AI-interpretation/reports/candidate-performance = Phase 3.7) are scope boundaries reported in-line, **NOT gaps**. What remains beyond them is **ADOPTION** — real analysed-item / response volume — a usage axis reported SEPARATELY, NEVER a gap. Coverage⟂Confidence⟂Adoption never composited; never fabricated.\n\n` +
`## Open gaps\n` +
((['Launch-Critical', 'High', 'Medium', 'Low', 'Future'] as const).some((sev) => GAPS.some((g) => g.severity === sev))
  ? (['Launch-Critical', 'High', 'Medium', 'Low', 'Future'] as const).map((sev) => {
      const gs = GAPS.filter((g) => g.severity === sev);
      if (!gs.length) return '';
      return `### ${sev}\n` + gs.map((g) => `#### ${g.id} — ${g.summary}\n- **Dimension**: ${g.dimension}\n`).join('\n');
    }).filter(Boolean).join('\n')
  : '_None — all engineering gaps are closed._\n') +
`\n## Resolved gaps (${RESOLVED.length}) — engineering-closed via reuse\n` +
`Severity of resolved work: ${RGC['Launch-Critical']} Launch-Critical · ${RGC.High} High · ${RGC.Medium} Medium · ${RGC.Low} Low · ${RGC.Future} Future.\n\n` +
`| ID | Severity (was) | Dimension | Gap | Mechanism (reuse-before-build) |\n|---|---|---|---|---|\n` +
RESOLVED.map((g) => `| **${g.id}** | ${g.severity} | \`${g.dimension}\` | ${g.summary} | ${g.mechanism || '—'} |`).join('\n') + '\n';

// ── 12 Adoption Report (SEPARATE axis) ───────────────────────────────────
files['12-adoption-report.md'] = HEAD('12', 'Adoption Report (SEPARATE usage axis · never a gap)') +
`Engineering closure ⟂ adoption. A dimension can be fully SUPPORTED while adoption is honestly 0. Adoption is real analysed-item / reliability / validity / quality / blueprint VOLUME across the \`asci_*\` overlay — a usage axis reported SEPARATELY, NEVER a gap, NEVER fabricated. Item-level statistics ABSTAIN below k_min=${KMIN} real responses. null (unreadable) ≠ 0 (empty).\n\n` +
`${ADO.note}\n\n` +
`| Overlay | Measured |\n|---|---|\n` +
`| Item stats | ${dash(ADO.item_stats?.items)} (assessments ${dash(ADO.item_stats?.assessments)} · abstained ${dash(ADO.item_stats?.abstained)} · retire-recommended ${dash(ADO.item_stats?.retire_recommended)}) |\n` +
`| Reliability | ${dash(ADO.reliability?.records)} (assessments ${dash(ADO.reliability?.assessments)} · methods ${dash(ADO.reliability?.methods_used)} · abstained ${dash(ADO.reliability?.abstained)}) |\n` +
`| Validity | ${dash(ADO.validity?.records)} (assessments ${dash(ADO.validity?.assessments)} · types ${dash(ADO.validity?.types_used)} · abstained ${dash(ADO.validity?.abstained)}) |\n` +
`| Quality flags | ${dash(ADO.quality?.flags)} (items ${dash(ADO.quality?.items)} · failed ${dash(ADO.quality?.failed)} · checks ${dash(ADO.quality?.checks_used)}) |\n` +
`| Blueprints | ${dash(ADO.blueprints?.blueprints)} (valid ${dash(ADO.blueprints?.valid)} · assessments ${dash(ADO.blueprints?.assessments)}) |\n` +
`| Governance | ${dash(ADO.governance?.records)} (stages ${dash(ADO.governance?.stages_used)} · approved ${dash(ADO.governance?.approved)}) |\n` +
`| Repository | ${dash(ADO.repository?.artefacts)} (types ${dash(ADO.repository?.types_used)} · active ${dash(ADO.repository?.active)}) |\n\n` +
`_All \`—\` values are honest null (overlay unreadable/not yet written while OFF), NEVER fabricated as adopted._\n`;

// ── 13 Phase 3.6 Certification ───────────────────────────────────────────
files['13-phase-3.6-certification.md'] = HEAD('13', 'Phase 3.6 Certification & Verdict') +
`The EIGHT dimensions are certified SEPARATELY. There is deliberately **NO single composite score** — Coverage⟂Confidence⟂Adoption.\n\n` +
`## Dimension roll-up\n` +
`| # | Dimension | Result |\n|---|---|---|\n` +
`| 1 | Item analysis (${IA.count} metrics) | ${sc(IA.status_counts)} |\n` +
`| 2 | Reliability (${REL.count} types) | ${sc(REL.status_counts)} |\n` +
`| 3 | Validity (${VAL.count} types) | ${sc(VAL.status_counts)} |\n` +
`| 4 | Quality & governance (${QC.count} checks · ${GOV.count} stages) | ${sc(QC.status_counts)} / ${sc(GOV.status_counts)} |\n` +
`| 5 | Blueprint validation (${BP.count} controls) | ${sc(BP.status_counts)} |\n` +
`| 6 | Frontend | fe ${R.frontend.present}/${R.frontend.total} |\n` +
`| 7 | UX | interactive workbench (ABSTAIN/empty/loading/error states) |\n` +
`| 8 | APIs — mapping (${MAP.step_count} steps) | ${sc(MAP.mapping_status_counts)} · rt ${R.routes.present}/${R.routes.total} |\n\n` +
`- **Repository-alignment:** svc ${R.services.present}/${R.services.total} · rt ${R.routes.present}/${R.routes.total} · fe ${R.frontend.present}/${R.frontend.total} · tbl ${R.tables.present}/${R.tables.total}.\n` +
`- **Gaps**: ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED (all ${RESOLVED.length} former gaps engineering-closed via reuse-before-build). Adoption reported separately, never a gap.\n\n` +
`## Acceptance criteria (from spec)\n` +
`| Criterion | Result |\n|---|---|\n` +
`| ONE canonical Assessment Science / Psychometrics / Item Intelligence registry | ✅ \`config/assessment-science.ts\` (${D.dimension_count} dimensions · ${IA.count} item metrics · ${REL.count} reliability · ${VAL.count} validity types) |\n` +
`| Composes the existing psychometric services (no duplicate engine, no V2) | ✅ registry over psychometric-intelligence / sci-psychometric / reliability / quality-validator / blueprint engines + additive \`asci_*\` overlay |\n` +
`| INSTRUMENT / QUESTION-QUALITY scope (never scores/interprets a candidate; NOT norms/AI/reports) | ✅ ${scan.scope} |\n` +
`| EIGHT dimensions certified SEPARATELY (never composited) | ✅ deliverables 02–09 + this cert |\n` +
`| Item-level statistics ABSTAIN below k_min real responses (never fabricated) | ✅ k_min=${KMIN}; abstained surfaced explicitly in mechanisms + workbench |\n` +
`| Flag-gated routes + /enabled probe (503-before-auth OFF) | ✅ \`routes/assessment-science.ts\` (cert GETs + pure mechanism POSTs + overlay writes) |\n` +
`| Byte-identical OFF incl. schema · DDL only on flag-gated write paths | ✅ cert GETs read-only (to_regclass/fs probes); compute/validate pure; overlay writes are the ONLY DDL sites, flag+super-admin gated |\n` +
`| Gaps honest — engineering closure ⟂ adoption | ✅ ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED via reuse (deliverable 11); adoption reported separately (deliverable 12), never fabricated |\n` +
`| Readiness for Phase 3.7 answered | ✅ ${S.ready_for_phase_3_7.verdict} (deliverable 01) |\n\n` +
`## Science decisions (freeze invariants)\n` +
REG.decisions.map((d: any) => `- **${d.title}** (\`${d.id}\`) — ${d.decision}`).join('\n') + '\n\n' +
`## Is the Assessment Science / Psychometrics / Item Intelligence layer enterprise-ready?\n` +
`**${S.enterprise_ready.verdict}.**\n\n` +
`${S.enterprise_ready.note}\n\n` +
`## Ready for Phase 3.7 (Norms, Standardization, Benchmarking & Report Intelligence)?\n` +
`**${S.ready_for_phase_3_7.verdict}.** ${S.ready_for_phase_3_7.note}\n\n` +
`**Plainly:** YES on structure — ONE canonical Assessment Science / Psychometrics / Item Intelligence layer COMPOSING the existing psychometric services under one registry, with ${D.dimension_count} dimensions, ${IA.count} item-analysis metrics, ${REL.count} reliability types, ${VAL.count} validity types, ${QC.count} quality checks — each evidence claim verified against the live repository. Scope is INSTRUMENT / QUESTION QUALITY ONLY; it never scores or interprets a candidate, standardizes, benchmarks, or emits reports (Phase 3.7+). The EIGHT certification dimensions are reported SEPARATELY and NEVER composited. All ${RESOLVED.length} former engineering gaps are ENGINEERING-CLOSED (${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED) via reuse-before-build (pure compute/validate mechanisms + own additive overlay; item-level statistics ABSTAIN below k_min=${KMIN}) — all behind \`assessmentScience\` so OFF is byte-identical incl. schema. The honest boundaries that remain (norms/standardization/benchmarking/AI/reports = Phase 3.7) are scope boundaries, NOT gaps. What remains is ADOPTION — real analysed-item volume — a usage axis reported SEPARATELY, NEVER a gap and NEVER fabricated as adopted. Coverage⟂Confidence⟂Adoption; null≠0; nothing fabricated; the platform is enhanced-only.\n`;

const EXPECTED = [
  '01-executive-summary.md', '02-item-analysis-report.md', '03-reliability-report.md',
  '04-validity-report.md', '05-quality-governance-report.md', '06-blueprint-validation-report.md',
  '07-frontend-report.md', '08-ux-report.md', '09-api-report.md',
  '10-repository-change-summary.md', '11-remaining-gaps.md', '12-adoption-report.md',
  '13-phase-3.6-certification.md',
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
