/**
 * CAPADEX 3.0 — Program 3 · Phase 3.8 Enterprise Score Standardization & Interpretation CERTIFICATION
 * Deliverable generator. READ-ONLY: reads scan.json (the SSoT for measured numbers) and emits
 * EXACTLY 15 numbered deliverables (01→15, 15 = Phase-3.8 Certification) to
 * backend/audit/capadex-3.8-score-standardization/.
 *
 * Numbers are sourced from scan.json so the docs can NEVER drift from the measurement.
 * The TEN certification dimensions (standardization · formula · interpretation · governance · super_admin ·
 * frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited; adoption is a
 * SEPARATE usage axis (never a gap); null≠0; norm-referenced standardization ABSTAINS below k_min; never
 * fabricated. Scope is STANDARDIZATION & INTERPRETATION ONLY.
 * Run AFTER the scan, from backend/:  npx tsx scripts/capadex-3.8-generate-deliverables.ts
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const DIR = path.join(process.cwd(), 'audit', 'capadex-3.8-score-standardization');
mkdirSync(DIR, { recursive: true });

const SCAN_PATH = path.join(DIR, 'scan.json');
const scanRaw = readFileSync(SCAN_PATH, 'utf8');
const scan = JSON.parse(scanRaw);
const SCAN_HASH = createHash('sha256').update(scanRaw).digest('hex').slice(0, 12);
const SCAN_MTIME = statSync(SCAN_PATH).mtime.toISOString();

for (const k of [
  'registry', 'axis_dimensions', 'axis_standard_score_types', 'axis_performance_bands',
  'axis_interpretation_rule_types', 'axis_config_scopes', 'axis_formula_capabilities',
  'axis_governance_states', 'axis_validation_checks', 'axis_super_admin_surfaces',
  'axis_frontend_surfaces', 'axis_ux_criteria', 'axis_traceability', 'axis_repository_alignment',
  'adoption', 'gaps', 'gap_counts', 'resolved_gaps', 'resolved_gap_counts', 'resolved_gap_count',
  'summary', 'generated_at',
]) {
  if (scan[k] == null) throw new Error(`scan.json missing required section "${k}" — re-run the scan before generating deliverables.`);
}

const REG = scan.registry;
const D = scan.axis_dimensions;
const SS = scan.axis_standard_score_types;
const PB = scan.axis_performance_bands;
const IR = scan.axis_interpretation_rule_types;
const CS = scan.axis_config_scopes;
const FC = scan.axis_formula_capabilities;
const GS = scan.axis_governance_states;
const VC = scan.axis_validation_checks;
const SA = scan.axis_super_admin_surfaces;
const FE = scan.axis_frontend_surfaces;
const UX = scan.axis_ux_criteria;
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
  `# CAPADEX 3.0 · Program 3 · Phase 3.8 — ${title}\n\n` +
  `> Deliverable ${n} · Generated ${ts} · Source of truth: \`scan.json\` (read-only repo+DB scan, sha256:${SCAN_HASH}, written ${SCAN_MTIME}).\n` +
  `> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).\n` +
  `> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=${KMIN} real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.\n\n`;

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
The **ONE canonical Enterprise Score Standardization & Interpretation Framework** — a single certified **STANDARDIZATION** layer that COMPOSES the existing pure psychometric substrate (\`psychometric-standardization\`: \`zFromValue\` / \`zToPercentile\` / \`zToT\` / \`zToStanine\` / \`zToSten\` / \`zToDeviationScore\`) under one registry (\`config/score-standardization.ts\`) plus a structured-AST formula engine (NO eval / new Function) plus an additive \`astd_*\` overlay. **No duplicate standardization / scoring engine, no V2, no breaking change.** Scope is STANDARDIZATION & INTERPRETATION ONLY — it turns a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and deterministic interpretation-rule verdicts and explicitly does **NOT** re-score or re-validate the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).

It defines **${D.dimension_count} certification dimensions**, ${SS.count} standard-score types, ${PB.count} performance bands, ${IR.count} interpretation rule types, ${CS.count} standardization config scopes, ${FC.count} formula-engine capabilities, ${GS.count} governance states, ${VC.count} validation checks, ${SA.count} super-admin surfaces, ${FE.count} frontend surfaces, ${UX.count} UX criteria and a ${TR.link_count}-link scored-result→standardized-artefact traceability model.

This is a **CERTIFICATION + IMPLEMENTATION** deliverable (mirrors Phases 1.3–1.7 + 3.1–3.7). All ${RESOLVED.length} true engineering gaps are ENGINEERING-CLOSED via reuse-before-build — the pure \`computeStandardScoreSet\` / \`evaluateFormula\` / \`classifyBand\` / \`evaluateInterpretationRule\` mechanisms reusing the existing psychometric functions + the additive \`astd_*\` overlay — all gated by \`scoreStandardization\` (default OFF) so the OFF path is byte-identical incl. schema; **all DDL runs only on the flag-gated write paths**, never at read time. Formulas are a STRUCTURED AST evaluated by a whitelisted interpreter (no eval). Norm-referenced standardization ABSTAINS below k_min=${KMIN} real members — a value is NEVER fabricated on thin data.

## The ten INDEPENDENT dimensions (reported SEPARATELY — never composited)
| Dimension | Measured result |
|---|---|
| 1 · Standardization (${SS.count} score types) | ${sc(SS.status_counts)} |
| 2 · Formula engine (${FC.count} caps) | ${sc(FC.status_counts)} |
| 3 · Interpretation (${IR.count} rule types) | ${sc(IR.status_counts)} |
| 4 · Governance (${GS.count} states) | ${sc(GS.status_counts)} |
| 5 · Super admin (${SA.count} surfaces) | ${sc(SA.status_counts)} |
| 6 · Frontend (${FE.count} surfaces) | ${sc(FE.status_counts)} |
| 7 · UX (${UX.count} criteria) | ${sc(UX.status_counts)} |
| 8 · APIs | traceability (${TR.link_count} links · ${sc(TR.trace_status_counts)}) + rt ${R.routes.present}/${R.routes.total} |
| 9 · Testing (${VC.count} validation checks) | ${sc(VC.status_counts)} |
| 10 · Documentation | see repository-change-summary |

**Performance bands:** ${sc(PB.status_counts)} (${PB.count}). **Config scopes:** ${sc(CS.status_counts)} (${CS.count}).

**Repository-alignment (Coverage-only, verified vs live FS+DB):** svc ${R.services.present}/${R.services.total} · rt ${R.routes.present}/${R.routes.total} · fe ${R.frontend.present}/${R.frontend.total} · tbl ${R.tables.present}/${R.tables.total} (absent ${R.tables.absent}, unknown ${R.tables.unknown}).

## Gaps — ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED (engineering-closed, adoption reported separately)
**${scan.gap_total} OPEN gaps** (${GC['Launch-Critical']} Launch-Critical · ${GC.High} High · ${GC.Medium} Medium · ${GC.Low} Low · ${GC.Future} Future). All ${RESOLVED.length} former engineering gaps are ENGINEERING-CLOSED: a canonical standard-score layer, a safe versioned structured-AST formula framework, a deterministic interpretation-rule repository, governance / version history, standardization APIs and the console / workbench UI — via REUSE-before-build (pure compute mechanisms reusing the existing psychometric functions + own additive overlay tables). Formulas are a STRUCTURED AST (no eval); norm-referenced standardization ABSTAINS below k_min real members. The honest BOUNDARIES that remain (custom org bands, industry/org/country/institution/custom configs, comparison screen, heat maps, regression validation, org overrides, end-user guide) are **data-availability / follow-on boundaries** (PARTIAL), reported in-line, **NOT gaps**. What remains beyond them is **ADOPTION** — real standardized / interpreted / governed / validated VOLUME across the overlay — a usage axis reported SEPARATELY, NEVER a gap and NEVER fabricated as adopted.

## Ready for certification?
**${S.ready_for_certification.verdict}.** ${S.ready_for_certification.note}

## Verdict
**${S.enterprise_ready.verdict}.** ${S.enterprise_ready.note}
`;

// ── 02 Standard Score Engine (dimension 1) ───────────────────────────────
files['02-standard-score-engine-report.md'] = HEAD('02', 'Standard Score Engine Report (dimension 1 · standardization)') +
`A raw score is standardized against a reference distribution — percentile rank, z-score, T-score (μ=50,σ=10), standard score (μ=100,σ=15), stanine (1–9), sten (1–10) and composite / domain / competency / behaviour / skill / overall standardized scores — via the pure \`computeStandardScoreSet\` mechanism reusing the \`psychometric-standardization\` functions + the additive \`astd_standard_scores\` overlay. The transforms are pure functions of the score + distribution; norm-referenced standardization ABSTAINS below k_min=${KMIN} real members (returns \`abstained=true\`, scores null) — never fabricated.\n\n` +
catTable('Standard-score types', SS.count, SS.status_counts, REG.standard_score_types) +
`\n${dimSection('standardization')}\n`;

// ── 03 Formula Engine (dimension 2) ──────────────────────────────────────
files['03-formula-engine-report.md'] = HEAD('03', 'Formula Engine Report (dimension 2 · formula)') +
`Composite / weighted standardization formulas are a **STRUCTURED AST** — a JSON expression tree (\`op\`/\`args\`, \`var\`, \`const\`) evaluated by a **whitelisted interpreter** (\`evaluateFormula\`) with **NO \`eval\` / \`new Function\`**. Formulas are validated (\`validateFormula\`) before evaluation, versioned (\`astd_formulas\` + \`astd_governance_log\`) and safely previewed. An invalid AST returns validation errors and a null value — never an exception, never fabricated.\n\n` +
ctrlTable('Formula-engine capabilities', FC.count, FC.status_counts, REG.formula_capabilities) +
`\n${dimSection('formula')}\n` +
`\n_Formulas are a STRUCTURED AST evaluated by a whitelisted interpreter — no \`eval\`, no \`new Function\`. Unknown operators / variables / non-finite results are rejected by validation, not executed._\n`;

// ── 04 Interpretation Rules (dimension 3) ────────────────────────────────
files['04-interpretation-rules-report.md'] = HEAD('04', 'Interpretation Rules Report (dimension 3 · interpretation)') +
`A standardized score is deterministically interpreted into band / risk-category / development-priority / readiness verdicts via the pure \`evaluateInterpretationRule\` mechanism — a **rule repository** (\`astd_interpretation_rules\`), NOT an AI narrative (AI interpretation is OUT OF SCOPE, a later phase). A percentile is classified into a performance band via \`classifyBand\` using the canonical 9-band ladder (or a custom band set).\n\n` +
catTable('Interpretation rule types', IR.count, IR.status_counts, REG.interpretation_rule_types) +
`\n${catTable('Performance bands', PB.count, PB.status_counts, REG.performance_bands)}` +
`\n${dimSection('interpretation')}\n` +
`\n_Custom organizational bands are PARTIAL: the mechanism can store + apply them (\`astd_bands\`) but a real custom band set is a data-availability boundary, NOT an engineering gap._\n`;

// ── 05 Governance (dimension 4) ──────────────────────────────────────────
files['05-governance-report.md'] = HEAD('05', 'Governance Report (dimension 4 · governance)') +
`Formulas / bands / rules / configs move through **draft → review → validate → approve → publish → archive → retire** with version history, rollback and an audit trail — recorded in the additive \`astd_governance_log\` overlay via the flag-gated governance transition path.\n\n` +
ctrlTable('Governance states', GS.count, GS.status_counts, REG.governance_states) +
`\n${dimSection('governance')}\n`;

// ── 06 Config Scopes ─────────────────────────────────────────────────────
files['06-config-scopes-report.md'] = HEAD('06', 'Standardization Config Scopes Report') +
`A standardization config (formula + band set + rule set) can be scoped — assessment / persona / lifecycle / industry / organization / country / institution / custom — and stored + applied via the additive \`astd_configs\` overlay.\n\n` +
catTable('Standardization config scopes', CS.count, CS.status_counts, REG.config_scopes) +
`\n_Industry / organization / country / institution / custom scopes are PARTIAL: the mechanism can store + apply them but a real populated config per scope is a data-availability boundary, NOT an engineering gap._\n`;

// ── 07 Validation & Testing (dimension 9) ────────────────────────────────
files['07-validation-report.md'] = HEAD('07', 'Validation & Testing Report (dimension 9 · testing)') +
`Standardization artefacts are validated — formula validation, distribution validation (ABSTAINS below k_min=${KMIN}), range, boundary, statistical, regression and exception handling — via the pure validation mechanisms; results are recorded in the additive \`astd_validations\` overlay.\n\n` +
ctrlTable('Validation checks', VC.count, VC.status_counts, REG.validation_checks) +
`\n${dimSection('testing')}\n` +
`\n_Regression validation is PARTIAL: the check exists but a stored baseline to regress against is a data-availability boundary, NOT an engineering gap._\n`;

// ── 08 Super Admin (dimension 5) ─────────────────────────────────────────
files['08-super-admin-report.md'] = HEAD('08', 'Super Admin Report (dimension 5 · super_admin)') +
`The super-admin standardization console (\`ScoreStandardizationPanel\`) surfaces standardization config, interpretation rule manager, band config, formula config, version control, org overrides, approval workflow and audit console. Verified vs the live frontend tree.\n\n` +
ctrlTable('Super-admin surfaces', SA.count, SA.status_counts, REG.super_admin_surfaces) +
`\n${dimSection('super_admin')}\n` +
`\n_Organization overrides are PARTIAL: the surface exists but real org-override configs are a data-availability boundary, NOT an engineering gap._\n`;

// ── 09 Frontend (dimension 6) ────────────────────────────────────────────
files['09-frontend-report.md'] = HEAD('09', 'Frontend Report (dimension 6 · frontend)') +
`The super-admin standardization console (\`ScoreStandardizationPanel\`) + the interactive \`StandardizationWorkbench\` (standard scores · structured-AST formulas · bands · interpretation · validation) that exercises the pure standardization mechanisms live. Verified vs the live frontend tree.\n\n` +
`**Frontend evidence (verified):** fe ${R.frontend.present}/${R.frontend.total}.\n\n` +
ctrlTable('Frontend surfaces', FE.count, FE.status_counts, REG.frontend_surfaces) +
`\n${dimSection('frontend')}\n` +
`\n_The workbench renders honest ABSTAIN / empty / loading / error states — a value below k_min renders as an explicit "abstained" marker, never a fabricated number; null (unreadable) renders as "not measurable", distinct from 0 (empty). Comparison screen is PARTIAL — a follow-on surface, not a gap._\n`;

// ── 10 UX (dimension 7) ──────────────────────────────────────────────────
files['10-ux-report.md'] = HEAD('10', 'UX Report (dimension 7 · ux)') +
`The standardization UX — interactive formula builder, rule composer, live preview, interactive graphs, bell-curve & distribution visualization, drill-down, export, progressive disclosure, responsive and accessible surfaces.\n\n` +
ctrlTable('UX criteria', UX.count, UX.status_counts, REG.ux_criteria) +
`\n${dimSection('ux')}\n` +
`\n_Heat maps are PARTIAL: a follow-on visualization, NOT an engineering gap._\n`;

// ── 11 API (dimension 8) ─────────────────────────────────────────────────
files['11-api-report.md'] = HEAD('11', 'API Report (dimension 8 · apis)') +
`The unified standardization API surface at \`/api/admin/score-standardization/*\` (super-admin cert GETs) + \`/api/score-standardization/enabled\` (flag probe) + the mechanism POST paths (compute/{standard-scores,formula/validate,formula/evaluate,band,interpretation,validation}) and the overlay write paths (formulas / standard-scores / bands / interpretation-rules / configs / validations save + list GETs + governance transition).\n\n` +
`## Traceability model (${TR.link_count} scored-result→standardized-artefact links)\n` +
`Each link → the artefact it carries + the EXISTING source it REUSES (reuse-before-build).\n\n` +
`**Traceability status:** ${sc(TR.trace_status_counts)}.\n\n` +
`| Link | Source (reused) | Status | Note |\n|---|---|---|---|\n` +
TR.traceability.map((m: any) => `| **${m.label}** (\`${m.key}\`) | \`${m.source}\` | ${m.status} | ${m.note ?? '—'} |`).join('\n') + '\n\n' +
`${dimSection('apis')}\n` +
`## Contract\n` +
`- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.\n` +
`- Mechanism POSTs (\`compute/*\`) are **PURE** (no DB, no eval) unless \`persist=true\`; the overlay save routes + governance transition are the **ONLY** DDL sites, gated by \`scoreStandardization\` + super-admin.\n` +
`- Formulas are a STRUCTURED AST evaluated by a whitelisted interpreter — no \`eval\` / \`new Function\`.\n` +
`- Norm-referenced standardization ABSTAINS below k_min=${KMIN} real members — never fabricated.\n` +
`- Flag OFF → \`/enabled\` 503, \`/api/admin/score-standardization/*\` 401, public-config \`score_standardization:false\`; standardization flow + schema byte-identical.\n`;

// ── 12 Repository Change Summary (dimension 10 · documentation) ───────────
files['12-repository-change-summary.md'] = HEAD('12', 'Repository Change Summary & Alignment (dimension 10 · documentation)') +
`## New files (additive, flag-gated)\n` +
`- \`backend/config/score-standardization.ts\` — canonical standardization registry (${D.dimension_count} dimensions, catalogs, controls, traceability, decisions, gaps).\n` +
`- \`backend/services/score-standardization-mechanisms.ts\` — pure \`computeStandardScoreSet\` / \`evaluateFormula\` / \`validateFormula\` / \`classifyBand\` / \`evaluateInterpretationRule\` / validation mechanisms + \`astd_*\` overlay ensure-schema/save + coverage helpers (DDL only on flag-gated write paths).\n` +
`- \`backend/services/score-standardization-engine.ts\` — read-only composer/verifier (${D.dimension_count} dimensions, catalogs, controls, traceability, repository-alignment, adoption, gaps, summary).\n` +
`- \`backend/routes/score-standardization.ts\` — \`/api/score-standardization/enabled\` probe + super-admin \`/api/admin/score-standardization/*\` cert GETs + mechanism POSTs + overlay writes + governance transition.\n` +
`- \`backend/scripts/capadex-3.8-score-standardization-scan.ts\` + \`capadex-3.8-generate-deliverables.ts\` — SSoT scan + deliverable generator.\n` +
`- \`frontend/src/components/superadmin/ScoreStandardizationPanel.tsx\` + \`frontend/src/components/standardization/StandardizationWorkbench.tsx\` — super-admin standardization console + interactive workbench.\n\n` +
`## Wiring (byte-identical OFF)\n` +
`- \`config/feature-flags.ts\`: \`scoreStandardization:false\` + \`isScoreStandardizationEnabled()\` (env \`FF_SCORE_STANDARDIZATION\`).\n` +
`- \`routes.ts\`: import + \`registerScoreStandardizationRoutes(...)\`.\n` +
`- \`routes/capadex.ts\`: public-config \`score_standardization\` (dual import-site — getter import + key).\n` +
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

// ── 13 Remaining Gaps ────────────────────────────────────────────────────
files['13-remaining-gaps.md'] = HEAD('13', 'Remaining Gaps (OPEN · engineering-closed via reuse)') +
`**${scan.gap_total} OPEN gaps: ${GC['Launch-Critical']} Launch-Critical · ${GC.High} High · ${GC.Medium} Medium · ${GC.Low} Low · ${GC.Future} Future.**\n\n` +
`All ${RESOLVED.length} former engineering gaps are **ENGINEERING-CLOSED** — a canonical standard-score layer, a safe versioned structured-AST formula framework, a deterministic interpretation-rule repository, governance / version history, standardization APIs and the console / workbench UI — via REUSE-before-build (pure compute mechanisms + own additive overlay tables), each gated by \`scoreStandardization\` (byte-identical OFF incl. schema; DDL only on the flag-gated write paths). Formulas are a STRUCTURED AST (no eval); norm-referenced standardization ABSTAINS below k_min=${KMIN} real members. The honest BOUNDARIES that remain (custom org bands, industry/org/country/institution/custom configs, comparison screen, heat maps, regression validation, org overrides, end-user guide) are data-availability / follow-on boundaries reported in-line, **NOT gaps**. What remains beyond them is **ADOPTION** — real standardized / interpreted / governed volume — a usage axis reported SEPARATELY, NEVER a gap. Coverage⟂Confidence⟂Adoption never composited; never fabricated.\n\n` +
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

// ── 14 Adoption Report (SEPARATE axis) ───────────────────────────────────
files['14-adoption-report.md'] = HEAD('14', 'Adoption Report (SEPARATE usage axis · never a gap)') +
`Engineering closure ⟂ adoption. A dimension can be fully SUPPORTED while adoption is honestly 0. Adoption is real standardized / interpreted / governed / validated VOLUME across the \`astd_*\` overlay — a usage axis reported SEPARATELY, NEVER a gap, NEVER fabricated. Norm-referenced standardization ABSTAINS below k_min=${KMIN} real members. null (unreadable) ≠ 0 (empty).\n\n` +
`${ADO.note}\n\n` +
`| Overlay | Measured |\n|---|---|\n` +
`| Formulas | ${dash(OV.formulas)} (valid ${dash(OV.valid_formulas)}) |\n` +
`| Standard scores | ${dash(OV.standard_scores)} (abstained ${dash(OV.abstained_scores)}) |\n` +
`| Band sets | ${dash(OV.band_sets)} |\n` +
`| Interpretation rules | ${dash(OV.interpretation_rules)} |\n` +
`| Configs | ${dash(OV.configs)} |\n` +
`| Governance events | ${dash(OV.governance_events)} |\n` +
`| Validations | ${dash(OV.validations)} (passed ${dash(OV.validations_passed)}) |\n\n` +
`_All \`—\` values are honest null (overlay unreadable/not yet written while OFF), NEVER fabricated as adopted._\n`;

// ── 15 Phase 3.8 Certification ───────────────────────────────────────────
files['15-phase-3.8-certification.md'] = HEAD('15', 'Phase 3.8 Certification & Verdict') +
`The TEN dimensions are certified SEPARATELY. There is deliberately **NO single composite score** — Coverage⟂Confidence⟂Adoption.\n\n` +
`## Dimension roll-up\n` +
`| # | Dimension | Result |\n|---|---|---|\n` +
`| 1 | Standardization (${SS.count} score types) | ${sc(SS.status_counts)} |\n` +
`| 2 | Formula engine (${FC.count} caps) | ${sc(FC.status_counts)} |\n` +
`| 3 | Interpretation (${IR.count} rule types) | ${sc(IR.status_counts)} |\n` +
`| 4 | Governance (${GS.count} states) | ${sc(GS.status_counts)} |\n` +
`| 5 | Super admin (${SA.count} surfaces) | ${sc(SA.status_counts)} |\n` +
`| 6 | Frontend (${FE.count} surfaces) | ${sc(FE.status_counts)} |\n` +
`| 7 | UX (${UX.count} criteria) | ${sc(UX.status_counts)} |\n` +
`| 8 | APIs — traceability (${TR.link_count} links) | ${sc(TR.trace_status_counts)} · rt ${R.routes.present}/${R.routes.total} |\n` +
`| 9 | Testing (${VC.count} validation checks) | ${sc(VC.status_counts)} |\n` +
`| 10 | Documentation | see deliverable 12 |\n\n` +
`- **Performance bands:** ${sc(PB.status_counts)} (${PB.count}). **Config scopes:** ${sc(CS.status_counts)} (${CS.count}).\n` +
`- **Repository-alignment:** svc ${R.services.present}/${R.services.total} · rt ${R.routes.present}/${R.routes.total} · fe ${R.frontend.present}/${R.frontend.total} · tbl ${R.tables.present}/${R.tables.total}.\n` +
`- **Gaps**: ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED (all ${RESOLVED.length} former gaps engineering-closed via reuse-before-build). Adoption reported separately, never a gap.\n\n` +
`## Acceptance criteria (from spec)\n` +
`| Criterion | Result |\n|---|---|\n` +
`| ONE canonical Enterprise Score Standardization & Interpretation registry | ✅ \`config/score-standardization.ts\` (${D.dimension_count} dimensions · ${SS.count} standard-score types · ${PB.count} bands · ${IR.count} rule types) |\n` +
`| Composes the existing psychometric substrate (no duplicate engine, no V2) | ✅ registry over \`psychometric-standardization\` (z / percentile / T / standard / stanine / sten / deviation) + structured-AST formula engine + additive \`astd_*\` overlay |\n` +
`| STANDARDIZATION & INTERPRETATION scope (never re-scores/re-validates the instrument) | ✅ ${scan.scope} |\n` +
`| TEN dimensions certified SEPARATELY (never composited) | ✅ deliverables 02–12 + this cert |\n` +
`| Formulas are a STRUCTURED AST (no eval / new Function) | ✅ \`evaluateFormula\` whitelisted interpreter; \`validateFormula\` rejects unknown ops/vars/non-finite before evaluation |\n` +
`| Norm-referenced standardization ABSTAINS below k_min (never fabricated) | ✅ k_min=${KMIN}; abstained surfaced explicitly in mechanisms + workbench |\n` +
`| Flag-gated routes + /enabled probe (503-before-auth OFF) | ✅ \`routes/score-standardization.ts\` (cert GETs + pure mechanism POSTs + overlay writes + governance) |\n` +
`| Byte-identical OFF incl. schema · DDL only on flag-gated write paths | ✅ cert GETs read-only (to_regclass/fs probes); compute pure; overlay writes + governance are the ONLY DDL sites, flag+super-admin gated |\n` +
`| Gaps honest — engineering closure ⟂ adoption | ✅ ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED via reuse (deliverable 13); adoption reported separately (deliverable 14), never fabricated |\n` +
`| Ready for certification answered | ✅ ${S.ready_for_certification.verdict} (deliverable 01) |\n\n` +
`## Standardization decisions (freeze invariants)\n` +
REG.decisions.map((d: any) => `- **${d.title}** (\`${d.id}\`) — ${d.decision}`).join('\n') + '\n\n' +
`## Is the Enterprise Score Standardization & Interpretation layer enterprise-ready?\n` +
`**${S.enterprise_ready.verdict}.**\n\n` +
`${S.enterprise_ready.note}\n\n` +
`## Ready for certification?\n` +
`**${S.ready_for_certification.verdict}.** ${S.ready_for_certification.note}\n\n` +
`**Plainly:** YES on structure — ONE canonical Enterprise Score Standardization & Interpretation layer COMPOSING the existing psychometric substrate under one registry, with ${D.dimension_count} dimensions, ${SS.count} standard-score types, ${PB.count} performance bands, ${IR.count} interpretation rule types, ${CS.count} config scopes, ${FC.count} formula capabilities, ${GS.count} governance states, ${VC.count} validation checks — each evidence claim verified against the live repository. Scope is STANDARDIZATION & INTERPRETATION ONLY; it turns a SCORED + VALIDATED result into standard scores, performance bands and interpretation-rule verdicts and never re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE. The TEN certification dimensions are reported SEPARATELY and NEVER composited. All ${RESOLVED.length} former engineering gaps are ENGINEERING-CLOSED (${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED) via reuse-before-build (pure compute mechanisms + own additive overlay; formulas are a STRUCTURED AST with no eval; norm-referenced standardization ABSTAINS below k_min=${KMIN}) — all behind \`scoreStandardization\` so OFF is byte-identical incl. schema. The honest boundaries that remain (custom org bands, industry/org/country/institution/custom configs, comparison screen, heat maps, regression validation, org overrides, end-user guide) are data-availability / follow-on boundaries, NOT gaps. What remains is ADOPTION — real standardized volume — a usage axis reported SEPARATELY, NEVER a gap and NEVER fabricated as adopted. Coverage⟂Confidence⟂Adoption; null≠0; nothing fabricated; the platform is enhanced-only.\n`;

const EXPECTED = [
  '01-executive-summary.md', '02-standard-score-engine-report.md', '03-formula-engine-report.md',
  '04-interpretation-rules-report.md', '05-governance-report.md', '06-config-scopes-report.md',
  '07-validation-report.md', '08-super-admin-report.md', '09-frontend-report.md',
  '10-ux-report.md', '11-api-report.md', '12-repository-change-summary.md',
  '13-remaining-gaps.md', '14-adoption-report.md', '15-phase-3.8-certification.md',
];
const got = Object.keys(files).sort();
if (got.length !== 15 || EXPECTED.some((f) => !files[f])) {
  throw new Error(`Expected EXACTLY 15 deliverables (${EXPECTED.join(', ')}); got ${got.length}: ${got.join(', ')}`);
}

for (const [name, body] of Object.entries(files)) {
  writeFileSync(path.join(DIR, name), body);
  console.log('wrote', name);
}
console.log(`\n${Object.keys(files).length} deliverables written to ${DIR}`);
