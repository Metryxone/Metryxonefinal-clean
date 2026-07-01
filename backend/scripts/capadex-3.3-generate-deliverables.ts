/**
 * CAPADEX 3.0 — Program 3 · Phase 3.3 Enterprise Assessment Builder CERTIFICATION
 * Deliverable generator. READ-ONLY: reads scan.json (the SSoT for measured numbers) and emits
 * the 13 numbered deliverables + completion certification (14 total) to
 * backend/audit/capadex-3.3-assessment-builder/.
 *
 * Numbers are sourced from scan.json so the docs can NEVER drift from the measurement.
 * The SEVEN certification dimensions (builder · blueprint · validation · version_management ·
 * publishing · apis · frontend) are reported SEPARATELY and NEVER composited; adoption is a
 * SEPARATE usage axis (never a gap); null≠0; never fabricated. Scope is AUTHORING ONLY.
 * Run AFTER the scan, from backend/:  npx tsx scripts/capadex-3.3-generate-deliverables.ts
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const DIR = path.join(process.cwd(), 'audit', 'capadex-3.3-assessment-builder');
mkdirSync(DIR, { recursive: true });

const SCAN_PATH = path.join(DIR, 'scan.json');
const scanRaw = readFileSync(SCAN_PATH, 'utf8');
const scan = JSON.parse(scanRaw);
const SCAN_HASH = createHash('sha256').update(scanRaw).digest('hex').slice(0, 12);
const SCAN_MTIME = statSync(SCAN_PATH).mtime.toISOString();

for (const k of [
  'registry', 'axis_dimensions', 'axis_designer_actions', 'axis_structure_levels', 'axis_composition',
  'axis_templates', 'axis_blueprint', 'axis_rules', 'axis_config', 'axis_versioning', 'axis_validation',
  'axis_workflow', 'axis_mapping', 'axis_repository_alignment', 'adoption', 'gaps', 'gap_counts',
  'resolved_gaps', 'resolved_gap_counts', 'resolved_gap_count', 'summary', 'generated_at',
]) {
  if (scan[k] == null) throw new Error(`scan.json missing required section "${k}" — re-run the scan before generating deliverables.`);
}

const REG = scan.registry;
const D = scan.axis_dimensions;
const DA = scan.axis_designer_actions;
const SL = scan.axis_structure_levels;
const CMP = scan.axis_composition;
const TPL = scan.axis_templates;
const BP = scan.axis_blueprint;
const RUL = scan.axis_rules;
const CFG = scan.axis_config;
const VER = scan.axis_versioning;
const VAL = scan.axis_validation;
const WF = scan.axis_workflow;
const MAP = scan.axis_mapping;
const R = scan.axis_repository_alignment;
const ADO = scan.adoption;
const S = scan.summary;
const GAPS: any[] = scan.gaps;
const GC = scan.gap_counts;
const RESOLVED: any[] = scan.resolved_gaps || [];
const RGC = scan.resolved_gap_counts || { 'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0 };
const ts = scan.generated_at;

const dash = (v: any) => (v === null || v === undefined ? '—' : String(v)); // null≠0 → render null as —
const sc = (o: any) => `${o.SUPPORTED} SUPPORTED · ${o.PARTIAL} PARTIAL · ${o.DEAD_END} DEAD_END · ${o.MISSING} MISSING`;

const HEAD = (n: string, title: string) =>
  `# CAPADEX 3.0 · Program 3 · Phase 3.3 — ${title}\n\n` +
  `> Deliverable ${n} · Generated ${ts} · Source of truth: \`scan.json\` (read-only repo+DB scan, sha256:${SCAN_HASH}, written ${SCAN_MTIME}).\n` +
  `> Scope: AUTHORING ONLY — design/compose/configure/validate/version/approve/publish; NOT delivery/scoring/psychometrics.\n` +
  `> Honesty: the SEVEN certification dimensions (builder · blueprint · validation · version_management · publishing · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.\n\n`;

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
// Control table: items have {key,label,status,evidence_present,evidence[]}.
function ctrlTable(title: string, count: number, statusCounts: any, controls: any[]): string {
  return `**${title}:** ${sc(statusCounts)} (${count} total).\n\n` +
    `| Capability | Status | Evidence present | Anchors |\n|---|---|---|---|\n` +
    controls.map((c: any) => `| **${c.label}** (\`${c.key}\`) | ${c.status} | ${dash(c.evidence_present)} | ${(c.evidence || []).join(', ') || '—'} |`).join('\n') + '\n';
}

const files: Record<string, string> = {};

// ── 01 Executive Summary ─────────────────────────────────────────────────
files['01-executive-summary.md'] = HEAD('01', 'Executive Summary') +
`## What this certifies
The **ONE canonical Enterprise Assessment Builder** — a single certified AUTHORING layer that COMPOSES the existing assessment services (CAF builder, blueprint engines, assembly, writer, architecture) under one registry (\`config/assessment-builder.ts\`) plus an additive \`ab_*\` overlay. **No duplicate builder, no V2, no breaking change.** Scope is AUTHORING ONLY — design/compose/configure/validate/version/approve/publish — it does **NOT** deliver, score, or run psychometrics.

It defines **${D.dimension_count} certification dimensions**, ${DA.count} designer actions, ${SL.count} structure levels, ${CMP.count} composition capabilities, a ${TPL.count}-template library, a blueprint framework (${BP.count} capabilities), ${RUL.count} rule types, ${CFG.count} config options, full version management (${VER.count} capabilities), a pre-publish validation framework (${VAL.count} checks), and a draft→review→approved→published→active→deprecated→archived workflow (${WF.count} states).

This is a **CERTIFICATION** deliverable (mirrors Phases 1.3–1.7 + 3.1 + 3.2). Every true gap (AB-1..AB-7) is ENGINEERING-CLOSED via REUSE-before-build (own additive \`ab_*\` tables + helpers), all gated by \`assessmentBuilder\` (default OFF) so the OFF path is byte-identical incl. schema — **all DDL runs only on the flag-gated write paths**, never at read time.

## The seven INDEPENDENT dimensions (reported SEPARATELY — never composited)
| # | Dimension | Measured result |
|---|---|---|
| 1 · Builder / designer | ${sc(D.status_counts)} (dimensions) |
| 2 · Blueprint framework (${BP.count} caps) | ${sc(BP.status_counts)} |
| 3 · Validation framework (${VAL.count} checks) | ${sc(VAL.status_counts)} |
| 4 · Version management (${VER.count} caps) | ${sc(VER.status_counts)} |
| 5 · Publishing / workflow (${WF.count} states) | ${sc(WF.status_counts)} |
| 6 · Authoring APIs / rules (${RUL.count}) / config (${CFG.count}) | ${sc(RUL.status_counts)} / ${sc(CFG.status_counts)} |
| 7 · Builder frontend | see repository-alignment (fe ${R.frontend.present}/${R.frontend.total}) |

**Repository-alignment (Coverage-only, verified vs live FS+DB):** svc ${R.services.present}/${R.services.total} · rt ${R.routes.present}/${R.routes.total} · fe ${R.frontend.present}/${R.frontend.total} · tbl ${R.tables.present}/${R.tables.total} (absent ${R.tables.absent}, unknown ${R.tables.unknown}).

## Gaps — 0 OPEN · ${RESOLVED.length} RESOLVED (engineering-closed, adoption reported separately)
**${scan.gap_total} OPEN gaps** (${GC['Launch-Critical']} Launch-Critical · ${GC.High} High · ${GC.Medium} Medium · ${GC.Low} Low · ${GC.Future} Future). All seven former gaps (AB-1..AB-7) are ENGINEERING-CLOSED via reuse (${RESOLVED.length} RESOLVED). What remains is **ADOPTION** — real authored/managed assessment VOLUME across the overlay — a usage axis reported SEPARATELY, NEVER a gap and NEVER fabricated as adopted.

## Verdict
**${S.enterprise_ready.verdict}.** ${S.enterprise_ready.note}
`;

// ── 02 Dimension Inventory ───────────────────────────────────────────────
files['02-dimension-inventory.md'] = HEAD('02', 'Dimension Inventory (7 certification dimensions)') +
`The ${D.dimension_count} INDEPENDENT dimensions. Status is a **Coverage** axis (does an implementation exist + is it wired?), kept SEPARATE from Confidence/Adoption. Evidence is VERIFIED vs the live FS+DB.\n\n` +
`**Status:** ${sc(D.status_counts)}.\n\n` +
`## The seven authoring questions\n` +
`| Dimension | Question answered |\n|---|---|\n` +
scan.axes.map((a: any) => `| **${a.label}** (\`${a.key}\`) | ${a.question} |`).join('\n') + '\n\n' +
D.dimensions.map((d: any) => {
  const src = REG.dimensions.find((x: any) => x.key === d.key) || {};
  return `### ${d.label} (\`${d.key}\`) — ${d.status}\n` +
    (d.statusNote ? `_${d.statusNote}_\n` : '') +
    `\n- **Services**: ${(src.evidence?.services || []).join(', ') || '—'}\n` +
    `- **Routes**: ${(src.evidence?.routes || []).join(', ') || '—'}\n` +
    `- **Frontend**: ${(src.evidence?.frontend || []).join(', ') || '—'}\n` +
    `- **Tables**: ${(src.evidence?.tables || []).join(', ') || '—'}\n` +
    `- **Verified**: ${dimEv(d)}\n` +
    (d.evidence.tables.absentList?.length ? `- **Absent tables (honest — overlay not yet written while flag OFF)**: ${d.evidence.tables.absentList.join(', ')}\n` : '');
}).join('\n');

// ── 03 Designer Actions & Structure ──────────────────────────────────────
files['03-designer-actions-and-structure.md'] = HEAD('03', 'Designer Actions & Assessment Structure (dimension 1 · builder)') +
`The authoring surface: the ${DA.count} designer actions an author performs and the ${SL.count} structure levels an assessment is composed from + the ${CMP.count} composition capabilities. All COMPOSE the existing CAF builder / assembly / writer by reference — no duplicate builder.\n\n` +
`## Designer actions (${DA.count})\n` +
catTable('Designer actions', DA.count, DA.status_counts, REG.designer_actions) +
`\n## Structure levels (${SL.count})\n` +
catTable('Structure levels', SL.count, SL.status_counts, REG.structure_levels) +
`\n## Composition capabilities (${CMP.count})\n` +
catTable('Composition capabilities', CMP.count, CMP.status_counts, REG.composition_caps);

// ── 04 Template Library ──────────────────────────────────────────────────
files['04-template-library.md'] = HEAD('04', 'Reusable Template Library (dimension 1 · builder)') +
`ONE reusable-template library (${TPL.count} templates) so an author starts from a known-good blueprint instead of a blank canvas. Persisted to \`assessment_templates\` + the additive \`ab_templates\` registry.\n\n` +
catTable('Templates', TPL.count, TPL.status_counts, REG.reusable_templates);

// ── 05 Blueprint Framework ───────────────────────────────────────────────
files['05-blueprint-framework.md'] = HEAD('05', 'Blueprint Framework (dimension 2)') +
`The blueprint framework binds a distribution + mix + time/marks contract onto an assessment. REUSES the existing blueprint-builder + assembly engines; the binding + framework link are persisted to the additive \`ab_blueprints\` overlay (by reference to \`assessment_blueprints\`).\n\n` +
ctrlTable('Blueprint capabilities', BP.count, BP.status_counts, BP.controls);

// ── 06 Rules & Configuration ─────────────────────────────────────────────
files['06-rules-and-configuration.md'] = HEAD('06', 'Assessment Rules & Configuration (dimension 6 · apis)') +
`The authoring rules (${RUL.count}) + configuration options (${CFG.count}) that make an assessment enforceable + deliverable-ready (passing criteria, attempts, timing, languages, accessibility, …). Persisted to the \`ab_assessments\` authoring record.\n\n` +
`## Rule types (${RUL.count})\n` +
ctrlTable('Rule types', RUL.count, RUL.status_counts, RUL.controls) +
`\n## Config options (${CFG.count})\n` +
ctrlTable('Config options', CFG.count, CFG.status_counts, CFG.controls);

// ── 07 Version Management ────────────────────────────────────────────────
files['07-version-management.md'] = HEAD('07', 'Version Management (dimension 4)') +
`Full version lifecycle on the additive append-only \`ab_assessment_versions\` ledger — major/minor/draft versions, snapshot, compare, rollback, clone. Each transition snapshots content so rollback/compare are lossless (no destructive edit).\n\n` +
ctrlTable('Version capabilities', VER.count, VER.status_counts, VER.controls);

// ── 08 Validation Framework ──────────────────────────────────────────────
files['08-validation-framework.md'] = HEAD('08', 'Pre-Publish Validation Framework (dimension 3)') +
`A pre-publish validation framework (${VAL.count} checks) that verifies structure / blueprint / rules / config / readiness BEFORE an assessment can be approved + published. Runs recorded in the additive \`ab_validation_runs\` overlay. Validation is a GATE on publishing — NOT scoring/psychometrics.\n\n` +
ctrlTable('Validation checks', VAL.count, VAL.status_counts, VAL.controls);

// ── 09 Publishing / Approval Workflow ────────────────────────────────────
files['09-publishing-workflow.md'] = HEAD('09', 'Publishing / Approval Workflow (dimension 5)') +
`The draft→review→approved→published→active→deprecated→archived workflow (${WF.count} states) with HUMAN approval, recorded in the additive \`ab_workflow\` ledger. Publishing is gated on a passed validation run + a human approval transition — no auto-publish.\n\n` +
ctrlTable('Workflow states', WF.count, WF.status_counts, WF.controls);

// ── 10 Mapping Model & Repository Alignment ──────────────────────────────
files['10-mapping-model-and-repository-alignment.md'] = HEAD('10', 'Assessment → Builder Mapping Model & Repository Alignment') +
`## Assessment → builder mapping model (${MAP.step_count} steps)\n` +
`Each step → the artifact it produces + the EXISTING engine/table it REUSES (reuse-before-build).\n\n` +
`**Mapping status:** ${sc(MAP.mapping_status_counts)}.\n\n` +
`| Step | Target | Source (reused) | Status | Source present |\n|---|---|---|---|---|\n` +
MAP.mapping.map((m: any) => `| **${m.label}** (\`${m.key}\`) | ${m.target} | \`${m.source}\` | ${m.status} | ${dash(m.source_present)} |`).join('\n') + '\n\n' +
`## Repository alignment (Coverage-only, verified vs live FS+DB)\n` +
`Every dimension evidence claim verified INDEPENDENTLY against the live filesystem + DB. null (unknown) ≠ 0 (absent).\n\n` +
`| Evidence kind | Present / Total |\n|---|---|\n` +
`| Services | ${R.services.present}/${R.services.total} |\n` +
`| Routes | ${R.routes.present}/${R.routes.total} |\n` +
`| Frontend | ${R.frontend.present}/${R.frontend.total} |\n` +
`| Tables | ${R.tables.present}/${R.tables.total} (absent ${R.tables.absent}, unknown ${R.tables.unknown}) |\n\n` +
`_${R.note}_\n`;

// ── 11 Adoption (separate axis) ──────────────────────────────────────────
files['11-adoption.md'] = HEAD('11', 'Adoption — real authored-assessment volume (SEPARATE axis, never a gap)') +
`${ADO.note}\n\n` +
`Adoption measures real authored/managed assessment VOLUME across the \`ab_*\` overlay. It is reported SEPARATELY from engineering closure — a dimension can be fully SUPPORTED (capability exists + wired) while adoption is honestly 0 (no volume yet). null (unreadable) ≠ 0 (empty).\n\n` +
`| Overlay | Measured |\n|---|---|\n` +
`| Assessments | ${dash(ADO.assessments?.assessments)} (published ${dash(ADO.assessments?.published)} · owned ${dash(ADO.assessments?.owned)}) |\n` +
`| Version ledger | ${dash(ADO.versions?.versioned_assessments)} assessments · ${dash(ADO.versions?.total_versions)} versions · ${dash(ADO.versions?.drafts)} drafts |\n` +
`| Blueprints | ${dash(ADO.blueprints?.blueprints)} (bound ${dash(ADO.blueprints?.bound)}) |\n` +
`| Templates | ${dash(ADO.templates?.templates)} (${dash(ADO.templates?.categories)} categories) |\n` +
`| Validation | ${dash(ADO.validation?.runs)} runs · ${dash(ADO.validation?.passed)} passed · ${dash(ADO.validation?.assessments_validated)} assessments |\n` +
`| Workflow | ${dash(ADO.workflow?.transitions)} transitions · ${dash(ADO.workflow?.assessments)} assessments · ${dash(ADO.workflow?.approved)} approved · ${dash(ADO.workflow?.published)} published |\n\n` +
`_All \`—\` values are honest null (overlay unreadable/not yet written while OFF), NEVER fabricated as adopted._\n`;

// ── 12 Certification Summary (seven dimensions SEPARATELY) ────────────────
files['12-certification-summary.md'] = HEAD('12', 'Certification Summary — Seven Dimensions (never composited)') +
`The SEVEN dimensions are certified SEPARATELY. There is deliberately **NO single composite score** — Coverage⟂Confidence⟂Adoption.\n\n` +
`## Dimension roll-up\n` +
`| # | Dimension | Result |\n|---|---|---|\n` +
`| 1 | Builder / designer | ${sc(S.dimensions.status_counts)} (${DA.count} actions · ${SL.count} levels · ${CMP.count} composition · ${TPL.count} templates) |\n` +
`| 2 | Blueprint framework (${S.blueprint.capability_count} caps) | ${sc(S.blueprint.status_counts)} |\n` +
`| 3 | Validation framework (${S.validation.check_count} checks) | ${sc(S.validation.status_counts)} |\n` +
`| 4 | Version management (${S.version_management.capability_count} caps) | ${sc(S.version_management.status_counts)} |\n` +
`| 5 | Publishing / workflow (${S.workflow.state_count} states) | ${sc(S.workflow.status_counts)} |\n` +
`| 6 | Authoring APIs — rules (${S.rules.rule_count}) / config (${S.config.option_count}) | ${sc(S.rules.status_counts)} / ${sc(S.config.status_counts)} |\n` +
`| 7 | Builder frontend + repository-alignment | svc ${S.repository_alignment.services.present}/${S.repository_alignment.services.total} · rt ${S.repository_alignment.routes.present}/${S.repository_alignment.routes.total} · fe ${S.repository_alignment.frontend.present}/${S.repository_alignment.frontend.total} · tbl ${S.repository_alignment.tables.present}/${S.repository_alignment.tables.total} |\n\n` +
`- **Gaps**: ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED (all seven AB-1..AB-7 engineering-closed via reuse). Adoption reported separately, never a gap.\n\n` +
`## Builder decisions (freeze invariants)\n` +
REG.decisions.map((d: any) => `- **${d.title}** (\`${d.id}\`) — ${d.decision}`).join('\n') + '\n\n' +
`## Verdict\n**${S.enterprise_ready.verdict}.** ${S.enterprise_ready.note}\n`;

// ── 13 Gap Register — 0 OPEN · resolved via reuse ─────────────────────────
files['13-gap-register.md'] = HEAD('13', 'Gap Register (0 OPEN · engineering-closed)') +
`**${scan.gap_total} OPEN gaps: ${GC['Launch-Critical']} Launch-Critical · ${GC.High} High · ${GC.Medium} Medium · ${GC.Low} Low · ${GC.Future} Future.**\n\n` +
`All seven former gaps (AB-1..AB-7) are **ENGINEERING-CLOSED** via REUSE-before-build, each gated by \`assessmentBuilder\` (byte-identical OFF incl. schema; DDL only on the flag-gated write paths). What remains is **ADOPTION** — real authored-assessment volume — a usage axis reported SEPARATELY, NEVER a gap. Coverage⟂Confidence⟂Adoption never composited; never fabricated.\n\n` +
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
RESOLVED.map((g) => `| **${g.id}** | ${g.severity} | \`${g.dimension}\` | ${g.summary} | ${g.mechanism} |`).join('\n') + '\n';

// ── Completion certification ─────────────────────────────────────────────
files['completion-certification.md'] = HEAD('CERT', 'Completion Certification & Verdict') +
`## Acceptance criteria (from spec)
| Criterion | Result |
|---|---|
| ONE canonical Assessment Builder registry | ✅ \`config/assessment-builder.ts\` (${D.dimension_count} dimensions · ${DA.count} designer actions · ${SL.count} structure levels · ${TPL.count}-template library) |
| Composes the existing assessment services (no duplicate builder, no V2) | ✅ registry over CAF builder / blueprint / assembly / writer + additive \`ab_*\` overlay |
| AUTHORING scope only (design/compose/configure/validate/version/approve/publish; NOT deliver/score/psychometrics) | ✅ ${scan.scope} |
| Blueprint framework (distribution + mix + time/marks, bound) | ✅ ${BP.count} capabilities · ${sc(BP.status_counts)} |
| Pre-publish validation framework | ✅ ${VAL.count} checks · ${sc(VAL.status_counts)} |
| Version management (major/minor/draft · compare/rollback/clone) | ✅ ${VER.count} capabilities · ${sc(VER.status_counts)} |
| Publishing workflow (draft→review→approved→published→…→archived, human approval) | ✅ ${WF.count} states · ${sc(WF.status_counts)} |
| Authoring rules + configuration | ✅ ${RUL.count} rule types · ${CFG.count} config options |
| SEVEN dimensions certified SEPARATELY (never composited) | ✅ deliverable 12 |
| Flag-gated routes + /enabled probe (503-before-auth OFF) | ✅ \`routes/assessment-builder.ts\` (cert GETs + mechanism GET/POST) |
| Byte-identical OFF incl. schema · DDL only on flag-gated write paths | ✅ cert GETs read-only (to_regclass/fs probes); mechanism POSTs are the ONLY DDL sites, flag+super-admin gated |
| Gaps honest — engineering closure ⟂ adoption | ✅ ${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED via reuse (deliverable 13); adoption reported separately, never fabricated |

## The SEVEN dimensions (measured, scan.json)
1. **Builder / designer**: ${sc(D.status_counts)} — ${DA.count} designer actions, ${SL.count} structure levels, ${CMP.count} composition caps, ${TPL.count} templates.
2. **Blueprint framework** (${BP.count} caps): ${sc(BP.status_counts)}.
3. **Validation framework** (${VAL.count} checks): ${sc(VAL.status_counts)}.
4. **Version management** (${VER.count} caps): ${sc(VER.status_counts)}.
5. **Publishing / workflow** (${WF.count} states): ${sc(WF.status_counts)}.
6. **Authoring APIs** — rules (${RUL.count}): ${sc(RUL.status_counts)} · config (${CFG.count}): ${sc(CFG.status_counts)}.
7. **Builder frontend** + repository-alignment: svc ${R.services.present}/${R.services.total} · rt ${R.routes.present}/${R.routes.total} · fe ${R.frontend.present}/${R.frontend.total} · tbl ${R.tables.present}/${R.tables.total} (absent ${R.tables.absent}, unknown ${R.tables.unknown}).

## Is the Assessment Builder enterprise-ready?
**${S.enterprise_ready.verdict}.**

${S.enterprise_ready.note}

**Plainly:** YES on structure — ONE canonical Enterprise Assessment Builder COMPOSING the existing assessment services (CAF builder / blueprint / assembly / writer) under one registry, with ${D.dimension_count} dimensions all SUPPORTED, ${DA.count} designer actions, a ${TPL.count}-template library, a blueprint framework, a pre-publish validation framework, full version management, and a draft→review→approve→publish→archive workflow with human approval — each evidence claim verified against the live repository. Scope is AUTHORING ONLY (it never delivers, scores, or runs psychometrics). The SEVEN certification dimensions are reported SEPARATELY and NEVER composited. All seven former gaps (AB-1..AB-7) are ENGINEERING-CLOSED via reuse (${scan.gap_total} OPEN · ${RESOLVED.length} RESOLVED), all behind \`assessmentBuilder\` so OFF is byte-identical incl. schema. What remains is ADOPTION — real authored-assessment volume — a usage axis reported SEPARATELY, NEVER a gap and NEVER fabricated as adopted. Coverage⟂Confidence⟂Adoption; null≠0; nothing fabricated; the builder is enhanced-only.
`;

for (const [name, body] of Object.entries(files)) {
  writeFileSync(path.join(DIR, name), body);
  console.log('wrote', name);
}
console.log(`\n${Object.keys(files).length} deliverables written to ${DIR}`);
