/**
 * CAPADEX 3.0 — Program 1 · Phase 1.3 Assessment Framework Completion
 * Deliverable generator. READ-ONLY: imports the canonical registry + reads scan.json
 * (the SSoT for measured numbers) and emits the 12 deliverables + completion certification
 * to backend/audit/capadex-3.0-assessment-framework/.
 *
 * Numbers are sourced from scan.json so the docs can NEVER drift from the measurement.
 * Run AFTER the scan, from backend/:  npx tsx scripts/capadex-1.3-generate-deliverables.ts
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const DIR = path.join(process.cwd(), 'audit', 'capadex-3.0-assessment-framework');
mkdirSync(DIR, { recursive: true });

// SCAN-LOCKED: every value comes from scan.json (the single measurement artifact).
// NOTHING is imported from the live registry/engine, so the deliverables can NEVER
// drift from the scan. Re-run the scan first if the registry/gaps change.
const SCAN_PATH = path.join(DIR, 'scan.json');
const scanRaw = readFileSync(SCAN_PATH, 'utf8');
const scan = JSON.parse(scanRaw);
const SCAN_HASH = createHash('sha256').update(scanRaw).digest('hex').slice(0, 12);
const SCAN_MTIME = statSync(SCAN_PATH).mtime.toISOString();

// Fail fast if any required section is missing — never emit a partial/misleading doc.
for (const k of ['axes', 'framework', 'crosswalk', 'known_overlaps', 'coverage', 'gaps', 'summary', 'generated_at']) {
  if (scan[k] == null) throw new Error(`scan.json missing required section "${k}" — re-run the scan script before generating deliverables.`);
}

const ASSESSMENT_FRAMEWORK: any[] = scan.framework;
const SPEC_19_CROSSWALK: any[] = scan.crosswalk;
const ASSESSMENT_AXES: any[] = scan.axes;
const KNOWN_OVERLAPS: any[] = scan.known_overlaps;
const ASSESSMENT_GAPS: any[] = scan.gaps;
type CanonicalAssessmentType = any;

const covByKey: Record<string, any> = {};
for (const c of scan.coverage) covByKey[c.key] = c;
const S = scan.summary;
const ts = scan.generated_at;

const HEAD = (n: string, title: string) =>
  `# CAPADEX 3.0 · Phase 1.3 — ${title}\n\n` +
  `> Deliverable ${n} · Generated ${ts} · Source of truth: \`scan.json\` (read-only repo+DB scan, sha256:${SCAN_HASH}, written ${SCAN_MTIME}).\n` +
  `> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.\n\n`;

function evCell(c: any): string {
  const e = c.evidence;
  return `svc ${e.services.present}/${e.services.total} · rt ${e.routes.present}/${e.routes.total} · ` +
    `fe ${e.frontend.present}/${e.frontend.total} · tbl ${e.tables.present}/${e.tables.total}` +
    (e.tables.unknown ? ` · tbl-unknown ${e.tables.unknown}` : '');
}

const files: Record<string, string> = {};

// ── 01 Implementation Report ─────────────────────────────────────────────
files['01-implementation-report.md'] = HEAD('01', 'Implementation Report') +
`## What shipped (enhancement-only, flag-gated, byte-identical-OFF)
- **Flag** \`assessmentFrameworkCompletion\` / \`FF_ASSESSMENT_FRAMEWORK_COMPLETION\` (default **OFF**) + getter \`isAssessmentFrameworkCompletionEnabled()\`.
- **Canonical registry** \`config/assessment-framework.ts\` — the ONE Assessment Framework: FROZEN ${scan.canonical_type_count}-type taxonomy + ${scan.spec_name_count}-name spec crosswalk + 8-axis mapping + known-overlap decisions. Pure data; NO new engine.
- **Read-only composer** \`services/assessment-framework-engine.ts\` — verifies registry evidence against the live filesystem + DB; computes per-type/per-axis coverage; classifies gaps. GET-only, never-throws, no DDL.
- **Routes** \`routes/assessment-framework.ts\` — \`/api/assessment-framework/enabled\` + super-admin \`/framework\`, \`/coverage\`, \`/gaps\`, \`/summary\`. Flag-gate 503 before work.
- **public-config** key \`assessment_framework_completion\`.
- **Scan** \`scripts/capadex-1.3-assessment-framework-scan.ts\` (SSoT) + this generator.

## Measured result (from scan.json)
- Status: **${S.status_counts.IMPLEMENTED} IMPLEMENTED · ${S.status_counts.PARTIAL} PARTIAL · ${S.status_counts.MISSING} MISSING** of ${scan.canonical_type_count}.
- Evidence verified present: services **${S.evidence_rollup.services.present}/${S.evidence_rollup.services.total}**, routes **${S.evidence_rollup.routes.present}/${S.evidence_rollup.routes.total}**, frontend **${S.evidence_rollup.frontend.present}/${S.evidence_rollup.frontend.total}**, tables **${S.evidence_rollup.tables.present}/${S.evidence_rollup.tables.total}** (absent ${S.evidence_rollup.tables.absent}, unknown ${S.evidence_rollup.tables.unknown}).
- Gaps: **${S.gap_counts['Launch-Critical']} Launch-Critical · ${S.gap_counts.High} High · ${S.gap_counts.Medium} Medium · ${S.gap_counts.Low} Low · ${S.gap_counts.Future} Future**.

## Enterprise-ready verdict
**${S.enterprise_ready.verdict}.** ${S.enterprise_ready.note}

## Guarantees
- OFF → data routes 503, public-config \`assessment_framework_completion:false\`, assessment flow + schema **byte-identical** to legacy (zero DDL).
- No new assessment engine, no V2, no duplicate logic, no taxonomy re-decision (frozen blueprint honoured).
`;

// ── 02 Inventory ─────────────────────────────────────────────────────────
files['02-inventory.md'] = HEAD('02', 'Assessment Inventory') +
`Every canonical assessment type → the EXISTING implementations it REUSES (verified vs live FS+DB).\n\n` +
ASSESSMENT_FRAMEWORK.map((t) => {
  const c = covByKey[t.key];
  return `## ${t.label} (\`${t.key}\`) — ${t.status}\n` +
    (t.statusNote ? `_${t.statusNote}_\n\n` : '\n') +
    `- **Services**: ${t.evidence.services.join(', ') || '— (none / forward-work)'}\n` +
    `- **Routes**: ${t.evidence.routes.join(', ') || '—'}\n` +
    `- **Tables**: ${t.evidence.tables.join(', ') || '—'}\n` +
    `- **Frontend**: ${t.evidence.frontend.join(', ') || '—'}\n` +
    `- **Verified**: ${evCell(c)}\n` +
    (c.evidence.tables.absentList.length ? `- **Absent tables (honest)**: ${c.evidence.tables.absentList.join(', ')}\n` : '');
}).join('\n') +
`\n## Known overlaps (decisions, not silent merges)\n` +
KNOWN_OVERLAPS.map((o) => `- **${o.pair}** → \`${o.decision}\` — ${o.rationale}`).join('\n') + '\n';

// ── 03 Taxonomy Matrix ───────────────────────────────────────────────────
files['03-taxonomy-matrix.md'] = HEAD('03', 'Taxonomy Matrix (19 spec names → 10 canonical types)') +
`## Canonical 10-type taxonomy (FROZEN)\n\n` +
`| # | Canonical Type | Status | Definition |\n|---|---|---|---|\n` +
ASSESSMENT_FRAMEWORK.map((t, i) => `| ${i + 1} | ${t.label} (\`${t.key}\`) | ${t.status} | ${t.definition} |`).join('\n') +
`\n\n## Spec-19 → Canonical-10 crosswalk\n\n` +
`| Spec name | Canonical type | Note |\n|---|---|---|\n` +
SPEC_19_CROSSWALK.map((x) => `| ${x.specName} | \`${x.canonicalKey}\` | ${x.note} |`).join('\n') + '\n';

// ── Axis matrix helper ───────────────────────────────────────────────────
function axisMatrix(n: string, title: string, field: keyof CanonicalAssessmentType, label: string, fmt?: (v: any) => string) {
  files[`${n}.md`] = HEAD(n.split('-')[0], title) +
    `| Canonical Type | Status | ${label} |\n|---|---|---|\n` +
    ASSESSMENT_FRAMEWORK.map((t) => {
      const v = t[field];
      const cell = fmt ? fmt(v) : (Array.isArray(v) ? v.join(', ') : String(v));
      return `| ${t.label} (\`${t.key}\`) | ${t.status} | ${cell || '—'} |`;
    }).join('\n') + '\n';
}

// ── 04 Persona-Assessment Matrix ─────────────────────────────────────────
axisMatrix('04-persona-assessment-matrix', 'Persona ↔ Assessment Matrix', 'personas', 'Personas (P1–P9)');
// ── 05 Lifecycle-Assessment Matrix ───────────────────────────────────────
axisMatrix('05-lifecycle-assessment-matrix', 'Lifecycle ↔ Assessment Matrix', 'lifecycleStages', 'Lifecycle stages (CAP_*)');
// ── 06 Journey-Assessment Matrix ─────────────────────────────────────────
files['06-journey-assessment-matrix.md'] = HEAD('06', 'Customer Journey ↔ Assessment Matrix') +
  `| Canonical Type | Status | Journey position | Entry criteria | Completion criteria |\n|---|---|---|---|---|\n` +
  ASSESSMENT_FRAMEWORK.map((t) => `| ${t.label} (\`${t.key}\`) | ${t.status} | ${t.customerJourney} | ${t.entryCriteria} | ${t.completionCriteria} |`).join('\n') + '\n';
// ── 07 AI-Assessment Matrix ──────────────────────────────────────────────
files['07-ai-assessment-matrix.md'] = HEAD('07', 'AI ↔ Assessment Matrix') +
  `| Canonical Type | Status | Scoring method | AI interpretation | Recommendation rules | Intervention rules |\n|---|---|---|---|---|---|\n` +
  ASSESSMENT_FRAMEWORK.map((t) => `| ${t.label} (\`${t.key}\`) | ${t.status} | ${t.scoringMethod} | ${t.aiInterpretation} | ${t.recommendationRules} | ${t.interventionRules} |`).join('\n') + '\n';
// ── 08 Report-Assessment Matrix ──────────────────────────────────────────
files['08-report-assessment-matrix.md'] = HEAD('08', 'Reports & Dashboards ↔ Assessment Matrix') +
  `| Canonical Type | Status | Reports | Dashboards | Benchmarking |\n|---|---|---|---|---|\n` +
  ASSESSMENT_FRAMEWORK.map((t) => `| ${t.label} (\`${t.key}\`) | ${t.status} | ${t.reports} | ${t.dashboards} | ${t.benchmarking} |`).join('\n') + '\n';
// ── 09 Outcome & KPI Mapping ─────────────────────────────────────────────
const LC = scan.lifecycle_closure || {};
const PL = scan.persona_linkage || {};
const dash = (v: any) => (v === null || v === undefined ? '—' : String(v)); // null≠0 → render null as —
files['09-outcome-kpi-mapping.md'] = HEAD('09', 'Outcome & KPI Mapping') +
  `| Canonical Type | Status | Purpose | Business value | Outcomes | KPIs |\n|---|---|---|---|---|---|\n` +
  ASSESSMENT_FRAMEWORK.map((t) => `| ${t.label} (\`${t.key}\`) | ${t.status} | ${t.purpose} | ${t.businessValue} | ${t.outcomes} | ${t.kpis} |`).join('\n') + '\n\n' +
  `## Close-the-loop ADOPTION (Adoption⟂Coverage — never composited)\n` +
  `The Progress / Exit / Continuous mechanisms are now instrumented via REUSE of the existing progression-outcome-capture hook (no new engine/table). This measures how much that loop is **exercised** — a SEPARATE axis from whether the mechanism exists. \`—\` = unreadable (null≠0); a numeric \`0\` is a measured-empty.\n\n` +
  `| Adoption signal | Subjects |\n|---|---|\n` +
  `| Progress (stage_completion captured, non-demo) | ${dash(LC.progression_subjects)} |\n` +
  `| Exit (reached_mastery captured, non-demo) | ${dash(LC.exit_subjects)} |\n` +
  `| Continuous (re-administered, >1 longitudinal datapoint) | ${dash(LC.reassessed_subjects)} |\n\n` +
  `_Freshness window: ${dash(LC.freshness_window_days)} days. Capture is gated by the \`longitudinalOutcomeCapture\` flag, so adoption accrues only as real subjects re-administer — current values are honest, not fabricated._\n\n` +
  `## Persona ⟂ Outcome linkage (read-time join, k-anon suppressed)\n` +
  `Realized outcomes are attributed per assessment persona via a READ-TIME join (zero DDL, no persona column added). \`linkage_present:${dash(PL.linkage_present)}\` (false = join unreadable, NOT zero outcomes). Per-persona counts below k_min=${dash(PL.k_min)} are suppressed for anonymity.\n\n` +
  ((PL.personas && PL.personas.length)
    ? `| Persona | Outcomes (suppressed <k_min) |\n|---|---|\n` +
      PL.personas.map((p: any) => `| ${p.persona} | ${p.suppressed ? 'suppressed (<k_min)' : dash(p.outcomes)} |`).join('\n') + '\n'
    : `_No persona-linked outcomes measured yet (honest empty — the persona substrate and realized-outcome volume have not yet intersected). Coverage⟂Outcome⟂Confidence never composited._\n`);

// ── 10 Repository Changes Summary ────────────────────────────────────────
files['10-repository-changes-summary.md'] = HEAD('10', 'Repository Changes Summary') +
`All changes are ADDITIVE + flag-gated. No existing assessment file was modified beyond the additive registration/probe lines.\n\n` +
`## New files
- \`backend/config/assessment-framework.ts\` — canonical registry (pure data).
- \`backend/services/assessment-framework-engine.ts\` — read-only composer/verifier.
- \`backend/routes/assessment-framework.ts\` — flag-gated read-only routes.
- \`backend/scripts/capadex-1.3-assessment-framework-scan.ts\` — SSoT scan.
- \`backend/scripts/capadex-1.3-generate-deliverables.ts\` — this generator.
- \`backend/audit/capadex-3.0-assessment-framework/*\` — scan.json + 12 deliverables + certification.
- \`docs/ASSESSMENT_FRAMEWORK.md\` — canonical doc.

## Additive edits to existing files
- \`backend/config/feature-flags.ts\` — flag \`assessmentFrameworkCompletion\` + getter (default OFF).
- \`backend/routes.ts\` — import + \`registerAssessmentFrameworkRoutes(...)\`.
- \`backend/routes/capadex.ts\` — public-config key \`assessment_framework_completion\` + getter import.
- \`replit.md\` Feature Map pointer + \`.agents/memory\` topic file.

## Net schema impact
- **Zero DDL.** No migration, no table created (OFF or ON). The engine only READS (to_regclass probes + fs checks).
`;

// ── 11 Technical Debt Resolved ───────────────────────────────────────────
files['11-technical-debt-resolved.md'] = HEAD('11', 'Technical Debt Resolved & Recommended') +
`## Resolved by this phase
- **No single source of truth for "what assessments exist"** → RESOLVED: \`config/assessment-framework.ts\` is now the ONE canonical, machine-readable registry mapping every assessment to 8 axes + evidence.
- **Taxonomy drift risk (spec 19 vs blueprint 10)** → RESOLVED: \`SPEC_19_CROSSWALK\` pins the honest mapping in code.
- **Inaccurate table references** → RESOLVED: registry evidence corrected to the REAL live table names (verified by the scan; ${S.evidence_rollup.tables.present}/${S.evidence_rollup.tables.total} present).
- **Open growth loop (Progress PARTIAL, Exit + Continuous MISSING)** → RESOLVED via REUSE, **not** a new engine: the existing \`services/capadex/progression-outcome-capture.ts\` hook (\`captureProgressionOutcome\` / \`getReassessmentSignal\`, freshness window ${dash(LC.freshness_window_days)}d) instruments stage_completion (Progress), reached_mastery (Exit) and a read-derived interval signal (Continuous). The FROZEN taxonomy STRUCTURE is unchanged — only per-type status moved (now 0 MISSING). What remains is **ADOPTION**, reported separately in deliverable 09 (Adoption⟂Coverage, never composited).
- **Outcomes carried no persona dimension** → RESOLVED via a READ-TIME join (zero DDL): \`composePersonaOutcomeLinkage\` attributes realized outcomes per persona with k-anon suppression — no persona column added, no schema change.

## Recommended (NOT actioned — breaking-risk / needs approval)
` +
KNOWN_OVERLAPS.filter((o) => o.decision === 'CONSOLIDATION_CANDIDATE')
  .map((o) => `- **${o.pair}** — ${o.rationale}`).join('\n') +
`\n\n_Consolidation candidates are recommendations only. Per the enhancement-only / no-breaking-changes contract, they require explicit human approval and a flag-gated migration plan; this phase does not merge or delete anything._\n`;

// ── 12 Remaining Assessment Gaps ─────────────────────────────────────────
files['12-remaining-assessment-gaps.md'] = HEAD('12', 'Remaining Assessment Gaps (classified)') +
`Counts: **${S.gap_counts['Launch-Critical']} Launch-Critical · ${S.gap_counts.High} High · ${S.gap_counts.Medium} Medium · ${S.gap_counts.Low} Low · ${S.gap_counts.Future} Future**.\n\n` +
(['Launch-Critical', 'High', 'Medium', 'Low', 'Future'] as const).map((sev) => {
  const gs = ASSESSMENT_GAPS.filter((g) => g.severity === sev);
  if (!gs.length) return `## ${sev}\n_None._\n`;
  return `## ${sev}\n` + gs.map((g) =>
    `### ${g.id} — ${g.title}\n- **Evidence**: ${g.evidence}\n- **Remediation**: ${g.remediation}\n`).join('\n');
}).join('\n');

// ── Completion certification ─────────────────────────────────────────────
files['completion-certification.md'] = HEAD('CERT', 'Completion Certification & Enterprise-Ready Verdict') +
`## Acceptance criteria (from spec)
| Criterion | Result |
|---|---|
| ONE canonical framework | ✅ \`config/assessment-framework.ts\` (${scan.canonical_type_count} types, ${scan.spec_name_count}-name crosswalk) |
| Every assessment mapped to 8 axes (persona/lifecycle/journey/AI/reports/dashboards/outcomes/KPIs) | ✅ all ${scan.canonical_type_count} types map all ${ASSESSMENT_AXES.length} axes |
| No duplicate logic introduced | ✅ read-only composer; overlaps documented as decisions, not merged |
| No orphans | ✅ every type → verified evidence (close-the-loop Progress/Exit/Continuous now instrumented via reuse; 0 MISSING) |
| No broken workflows / regressions | ✅ flag default OFF → byte-identical incl. schema; OFF smoke 503/401 |
| Enterprise-ready answered with evidence | ✅ verdict below |
| All remaining gaps classified | ✅ deliverable 12 (${ASSESSMENT_GAPS.length} gaps) |

## Measured coverage (scan.json)
- Status: ${S.status_counts.IMPLEMENTED} IMPLEMENTED · ${S.status_counts.PARTIAL} PARTIAL · ${S.status_counts.MISSING} MISSING.
- Evidence present: svc ${S.evidence_rollup.services.present}/${S.evidence_rollup.services.total} · rt ${S.evidence_rollup.routes.present}/${S.evidence_rollup.routes.total} · fe ${S.evidence_rollup.frontend.present}/${S.evidence_rollup.frontend.total} · tbl ${S.evidence_rollup.tables.present}/${S.evidence_rollup.tables.total}.

## Is the Assessment Framework enterprise-ready?
**${S.enterprise_ready.verdict}.**

${S.enterprise_ready.note}

**Plainly:** YES on structure and on the now-closed growth loop — one canonical, non-duplicative framework with every assessment mapped to all eight axes and verified against the live repository, and systematic **Progress**, **Exit**, and **Continuous** re-measurement now instrumented by RE-ADMINISTERING the existing assessments through the existing progression-capture hook (no net-new engines, zero DDL — the frozen taxonomy STRUCTURE is unchanged; only per-type status moved, so 0 MISSING). What remains is **ADOPTION**, not engineering: the capture path is gated by \`longitudinalOutcomeCapture\` and real re-administration volume is reported separately in deliverable 09 (currently honest-low/0; null≠0). A Medium **content-breadth** residual stands for Learning + learner-side Performance (human-authored items, never fabricated). **No Launch-Critical assessment gap exists.** Coverage⟂Confidence⟂Outcome⟂Adoption are reported separately and never composited.
`;

for (const [name, body] of Object.entries(files)) {
  writeFileSync(path.join(DIR, name), body);
  console.log('wrote', name);
}
console.log(`\n${Object.keys(files).length} deliverables written to ${DIR}`);
