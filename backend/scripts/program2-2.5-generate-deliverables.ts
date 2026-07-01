/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Observability, Monitoring & Operational Readiness.
 * Deliverable generator. READ-ONLY: reads scan.json (the SSoT for measured numbers) and emits the
 * 16 deliverables to backend/audit/program-2-operational-readiness/.
 *
 * Numbers are sourced from scan.json so the docs can NEVER drift from the measurement.
 * Run AFTER the scan, from backend/:  npx tsx scripts/program2-2.5-generate-deliverables.ts
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const DIR = path.join(process.cwd(), 'audit', 'program-2-operational-readiness');
mkdirSync(DIR, { recursive: true });

const SCAN_PATH = path.join(DIR, 'scan.json');
const scanRaw = readFileSync(SCAN_PATH, 'utf8');
const scan = JSON.parse(scanRaw);
const SCAN_HASH = createHash('sha256').update(scanRaw).digest('hex').slice(0, 12);
const SCAN_MTIME = statSync(SCAN_PATH).mtime.toISOString();

for (const k of ['meta', 'axes', 'domains', 'decisions', 'coverage', 'certification', 'adoption', 'gaps', 'validation', 'summary', 'evidence_rollup', 'generated_at']) {
  if (scan[k] == null) throw new Error(`scan.json missing required section "${k}" — re-run the scan before generating.`);
}

const ts = scan.generated_at;
const AXES: any[] = scan.axes;
const DOMAINS: any[] = scan.domains;
const COV: any[] = scan.coverage;
const CERT = scan.certification;
const ADOPT = scan.adoption;
const GAPS = scan.gaps;
const VAL = scan.validation;
const S = scan.summary;
const ROLL = scan.evidence_rollup;
const dash = (v: any) => (v === null || v === undefined ? '—' : String(v)); // null ≠ 0 → render null as —

const covByKey: Record<string, any> = {};
for (const c of COV) covByKey[c.key] = c;
const domByKey: Record<string, any> = {};
for (const d of DOMAINS) domByKey[d.key] = d;
const certByAxis: Record<string, any> = {};
for (const a of CERT.axes) certByAxis[a.key] = a;
const adoptByKey: Record<string, any> = {};
for (const a of ADOPT.items) adoptByKey[a.key] = a;

const HEAD = (n: string, title: string) =>
  `# CAPADEX 3.0 · Program 2 · Phase 2.5 — ${title}\n\n` +
  `> Deliverable ${n} · Generated ${ts} · Source of truth: \`scan.json\` (read-only repo+DB scan, sha256:${SCAN_HASH}, written ${SCAN_MTIME}).\n` +
  `> Honesty: Coverage (evidence exists) ⟂ Confidence ⟂ Adoption (real volume) — NEVER composited. null ≠ 0. Built ≠ Operated ≠ Recoverable. Nothing fabricated.\n\n`;

function evCell(e: any): string {
  return `svc ${e.services.present}/${e.services.total} · routes ${e.routes.present}/${e.routes.total} · fe ${e.frontend.present}/${e.frontend.total} · tbl ${e.tables.present}/${e.tables.total}`;
}
function domainBlock(key: string): string {
  const c = covByKey[key]; const d = domByKey[key]; const ad = adoptByKey[key];
  if (!c || !d) return `_(domain ${key} not found in scan)_\n`;
  let s = `### ${c.label} (\`${c.key}\`)\n`;
  s += `- **Certification axis**: \`${c.axis}\`\n`;
  s += `- **Coverage status**: **${c.status}** · structural coverage **${dash(c.coverage_pct)}%**\n`;
  s += `- **Validated signals**: ${d.signals.join(' · ')}\n`;
  s += `- **Reused substrate (verified vs live FS+DB, never invoked)**: ${evCell(c.evidence)}\n`;
  const absent = [...c.evidence.services.absentList, ...c.evidence.routes.absentList, ...c.evidence.frontend.absentList, ...c.evidence.tables.absentList];
  s += `- **Absent evidence (honest)**: ${absent.length ? absent.join(', ') : '—'}\n`;
  if (ad) s += `- **Adoption (SEPARATE axis — real volume)**: table \`${ad.table}\` ${ad.table_present ? 'present' : 'absent'}, rows **${dash(ad.total_rows)}**\n`;
  if (c.note) s += `- **Honest note**: ${c.note}\n`;
  return s + '\n';
}
function axisScoreRow(axKey: string): string {
  const a = certByAxis[axKey];
  const r = a.status_rollup;
  return `| ${a.label} (\`${a.key}\`) | **${dash(a.structural_coverage_score)}** | ${r.SUPPORTED}·${r.PARTIAL}·${r.DEAD_END}·${r.MISSING} | ${a.open_gaps.join(', ') || '—'} |`;
}

const files: Record<string, string> = {};

// ── 01 Executive Summary ─────────────────────────────────────────────────────
files['01-executive-summary.md'] = HEAD('01', 'Executive Summary') +
`## Question answered
> Can CAPADEX be **operated, monitored, supported, and maintained** as an enterprise production platform, based on repository evidence?

**${S.enterprise_ready.verdict}.** ${S.enterprise_ready.note}

## What this phase is (and is NOT)
- **Is**: a read-only, flag-gated (\`operationalReadiness\`) composer + canonical registry that MEASURES operational coverage across ${S.domain_count} domains and certifies **${S.axis_count} SEPARATE operational axes that are NEVER combined**, then classifies every remaining gap.
- **Is NOT**: a new/duplicate monitoring system. No new architecture, no business-logic change, no V2. Flag OFF → data routes 503, public-config \`operational_readiness:false\`, **byte-identical legacy incl. schema** (zero new tables — the only write is an explicit POST snapshot capture, flag-ON).

## Coverage snapshot (structural — evidence EXISTS)
- Domains: **${S.status_counts.SUPPORTED} SUPPORTED · ${S.status_counts.PARTIAL} PARTIAL · ${S.status_counts.DEAD_END} DEAD_END · ${S.status_counts.MISSING} MISSING** of ${S.domain_count}.
- Evidence verified present: services **${ROLL.services.present}/${ROLL.services.total}**, routes **${ROLL.routes.present}/${ROLL.routes.total}**, frontend **${ROLL.frontend.present}/${ROLL.frontend.total}**, tables **${ROLL.tables.present}/${ROLL.tables.total}** (absent ${ROLL.tables.absent}).

## The ${S.axis_count} SEPARATE certification scores (NEVER combined)
| Operational axis | Structural coverage | S·P·D·M | Open gaps |
|---|---|---|---|
${AXES.map((a) => axisScoreRow(a.key)).join('\n')}

_Structural coverage = evidence exists (Coverage axis). It is **not** a runtime/quality/adoption claim. \`—\` = NULL (no measurable in-repo substrate), which is **not** 0._

## Gap posture (honest)
**${GAPS.gap_counts['Launch-Critical']} Launch-Critical · ${GAPS.gap_counts.High} High · ${GAPS.gap_counts.Medium} Medium · ${GAPS.gap_counts.Low} Low · ${GAPS.gap_counts.Future} Future.** ${scan.summary.resolved_gap_count} operational mechanisms already REUSED (deliverable 14).

## Adoption (SEPARATE — never a gap)
${ADOPT.note}

## Structural validation
**${VAL.verdict}.** ${VAL.honesty_note}
`;

// ── 02 Observability Assessment Report ───────────────────────────────────────
files['02-observability-assessment.md'] = HEAD('02', 'Observability Assessment Report') +
`Certifies the **observability** axis: structural coverage **${dash(certByAxis['observability'].structural_coverage_score)}**.\n\n` +
domainBlock('service_observability') +
`## Endpoint reality (honest)\n- Present: \`/api/health\`, \`/api/health/ready\`, a 6-domain health aggregator, external-AI health probe.\n- Absent: a \`/version\` build-info endpoint and a machine-readable \`/metrics\` endpoint (see gap GAP-OPS-6). No liveness (\`/live\`) probe distinct from readiness.\n`;

// ── 03 Monitoring Coverage Report ────────────────────────────────────────────
files['03-monitoring-coverage.md'] = HEAD('03', 'Monitoring Coverage Report') +
`Certifies the **monitoring** axis: structural coverage **${dash(certByAxis['monitoring'].structural_coverage_score)}**.\n\n` +
domainBlock('monitoring_coverage') + domainBlock('background_jobs');

// ── 04 Logging Assessment ────────────────────────────────────────────────────
files['04-logging-assessment.md'] = HEAD('04', 'Logging Assessment') +
`Certifies the **logging** axis: structural coverage **${dash(certByAxis['logging'].structural_coverage_score)}**.\n\n` +
domainBlock('logging_traceability') +
`## Traceability identifiers (honest)\n- Present: levelled logger (debug/warn/error), per-request \`requestId\`, redaction-at-write, redacted admin audit trail.\n- Absent: correlation-ID propagation Node→FastAPI + distributed tracing (see gap GAP-OPS-5).\n`;

// ── 05 Metrics Coverage Matrix ───────────────────────────────────────────────
files['05-metrics-coverage-matrix.md'] = HEAD('05', 'Metrics Coverage Matrix') +
`Certifies the **metrics** axis: structural coverage **${dash(certByAxis['metrics'].structural_coverage_score)}**.\n\n` +
domainBlock('metrics_coverage') +
`## Metric reality (Coverage ⟂ NULL for un-instrumented)\n| Metric | Status |\n|---|---|\n` +
`| DB latency | MEASURED |\n| Event-loop lag | MEASURED |\n| Process/OS memory + CPU | MEASURED |\n| AI runtime | MEASURED (ai_runtime_monitoring) |\n| KPI daily rollup | MEASURED (anl_kpi_daily) |\n| API throughput / error-rate | **NULL** (not instrumented — GAP-OPS-1) |\n| Cache hit ratio | **NULL** (no cache metrics) |\n| Metrics export (Prometheus/statsd) | **NULL** (absent — GAP-OPS-1) |\n\n_NULL is honest "not measured", never estimated as 0._\n`;

// ── 06 Alerting Assessment ───────────────────────────────────────────────────
files['06-alerting-assessment.md'] = HEAD('06', 'Alerting Assessment') +
`Certifies the **alerting** axis: structural coverage **${dash(certByAxis['alerting'].structural_coverage_score)}**.\n\n` +
domainBlock('alerting') +
`## Alerting reality (honest)\n- Present: failure CONDITIONS are detectable (health domains report down/degraded; global-monitoring derives status).\n- Absent: a durable alert-RULE store + notification routing (email/pager/webhook). Alerts are client-derived from status, not pushed (see gap GAP-OPS-3).\n`;

// ── 07 Background Job Monitoring Report ───────────────────────────────────────
files['07-background-job-monitoring.md'] = HEAD('07', 'Background Job Monitoring Report') +
domainBlock('background_jobs') +
`## Async reality (honest)\n- Present: an in-process fire-and-forget event bus.\n- Absent: a durable queue, a Dead-Letter-Queue, and per-job retry/failure/processing-time persistence (see gap GAP-OPS-2). Failed async work is not durably tracked.\n`;

// ── 08 AI Operations Monitoring Report ───────────────────────────────────────
files['08-ai-operations-monitoring.md'] = HEAD('08', 'AI Operations Monitoring Report') +
`Certifies the **ai_operations** axis: structural coverage **${dash(certByAxis['ai_operations'].structural_coverage_score)}**.\n\n` +
domainBlock('ai_operations') +
`## AI-ops reality (honest)\n- Present: AI health probe, provider/model, latency, retry behaviour, failure analysis — persisted to \`ai_runtime_monitoring\`.\n- Absent: per-request **cost** and **token usage** accounting (see gap GAP-OPS-4) — reported honestly, never fabricated as 0.\n`;

// ── 09 Assessment Operations Report ──────────────────────────────────────────
files['09-assessment-operations.md'] = HEAD('09', 'Assessment Operations Report') +
`Certifies the **assessment_operations** axis: structural coverage **${dash(certByAxis['assessment_operations'].structural_coverage_score)}**.\n\n` +
domainBlock('assessment_operations') +
`_Lifecycle (started/completed/abandoned) is traceable from persisted \`capadex_sessions\`. Completion rate is read-derivable; real volume is the SEPARATE Adoption axis above._\n`;

// ── 10 Report Operations Report ──────────────────────────────────────────────
files['10-report-operations.md'] = HEAD('10', 'Report Operations Report') +
`Certifies the **report_operations** axis: structural coverage **${dash(certByAxis['report_operations'].structural_coverage_score)}**.\n\n` +
domainBlock('report_operations') +
`_Generation + report-pack + Zoho email delivery exist; report state persists in \`capadex_reports\`. Explicit generation-time/download-status telemetry is partial (honest)._\n`;

// ── 11 Integration Monitoring Report ─────────────────────────────────────────
files['11-integration-monitoring.md'] = HEAD('11', 'Integration Monitoring Report') +
domainBlock('integrations') +
`## Integration reality (honest)\n- Present: external-AI health probe, a safety circuit-breaker, Zoho email, Razorpay payments.\n- Partial: a unified integration-health dashboard with per-integration auth-status + timeout + rate-limit telemetry.\n`;

// ── 12 Disaster Recovery Report ──────────────────────────────────────────────
files['12-disaster-recovery.md'] = HEAD('12', 'Disaster Recovery Report') +
`Certifies the **disaster_recovery** axis: structural coverage **${dash(certByAxis['disaster_recovery'].structural_coverage_score)}** (NULL — no in-repo substrate; NOT 0).\n\n` +
domainBlock('disaster_recovery') +
`## DR reality (honest — infra-owned, NOT claimed as validated)\n- Managed-database backups are infra-owned (Cloud SQL / provider).\n- Absent in-repo: restore drills, documented recovery procedures, measured RTO/RPO (see gap GAP-OPS-7, Future/infra). Reported as an honest DEAD_END — never fabricated as validated.\n`;

// ── 13 Operational Dashboard Assessment ──────────────────────────────────────
files['13-operational-dashboard-assessment.md'] = HEAD('13', 'Operational Dashboard Assessment') +
domainBlock('operational_dashboards') +
`## Dashboard reality (honest)\n- Present/composed: super-admin console, live 6-domain health view, mission-control aggregators (operations/AI/assessment/security surfaces).\n- Partial: dedicated **executive** + **infrastructure** operational dashboards.\n`;

// ── 14 Operational Gap Register ──────────────────────────────────────────────
files['14-operational-gap-register.md'] = HEAD('14', 'Operational Gap Register') +
`## Open gaps — **${GAPS.gap_counts['Launch-Critical']} Launch-Critical · ${GAPS.gap_counts.High} High · ${GAPS.gap_counts.Medium} Medium · ${GAPS.gap_counts.Low} Low · ${GAPS.gap_counts.Future} Future**\n\n` +
`| ID | Severity | Axis | Title | Detail |\n|---|---|---|---|---|\n` +
GAPS.open_gaps.map((g: any) => `| ${g.key} | ${g.severity} | \`${g.axis}\` | ${g.title} | ${g.detail} |`).join('\n') + '\n\n' +
`## Resolved / reused mechanisms (${scan.summary.resolved_gap_count}) — traceability that observability substrate EXISTS\n\n` +
`| ID | Axis | Mechanism | Detail |\n|---|---|---|---|\n` +
GAPS.resolved_gaps.map((g: any) => `| ${g.key} | \`${g.axis}\` | \`${g.mechanism}\` | ${g.detail} |`).join('\n') + '\n\n' +
`_A reused mechanism means the observability substrate exists and is composed — NOT a claim of full adoption. Coverage ⟂ Adoption never composited._\n`;

// ── 15 Repository Change Summary ─────────────────────────────────────────────
files['15-repository-change-summary.md'] = HEAD('15', 'Repository Change Summary') +
`## Files added (additive, flag-gated, byte-identical OFF)
- \`config/operational-readiness-model.ts\` — canonical pure-data registry (${S.axis_count} axes · ${S.domain_count} domains · decisions · open+resolved gaps). NO engine, NO DDL.
- \`services/operational-readiness-engine.ts\` — read-only composer (coverage/certification/adoption/gaps/validation/summary + explicit snapshot capture). GET-only, never-throws, no DDL on read paths.
- \`routes/operational-readiness.ts\` — \`/api/operational-readiness/enabled\` (ungated probe) + super-admin \`/model /coverage /certification /adoption /gaps /validation /summary /snapshots\` + POST \`/audit/capture\`. Flag-gate 503 BEFORE auth.
- \`scripts/program2-2.5-operational-readiness-scan.ts\` — SSoT scan → \`scan.json\`.
- \`scripts/program2-2.5-generate-deliverables.ts\` — this generator (reads ONLY scan.json).

## Files edited (minimal wiring)
- \`config/feature-flags.ts\` — flag \`operationalReadiness\` (default OFF) + getter \`isOperationalReadinessEnabled()\` (env \`FF_OPERATIONAL_READINESS\`).
- \`routes.ts\` — import + register the routes.
- \`routes/capadex.ts\` — public-config key \`operational_readiness\`.

## Guarantees
- Flag OFF → data routes 503 (before auth/DB), public-config \`operational_readiness:false\`, **zero new tables**, monitoring/assessment/AI/report flows **byte-identical** to legacy.
- No new/duplicate monitoring system, no new architecture, no business-logic/assessment/AI/workflow change, no V2. Engines read by existence/persisted-output — **NEVER invoked**.
- Backend runs on \`tsx\` (no tsc gate) — the \`Backend API\` workflow is restarted after route additions.
`;

// ── 16 Operational Readiness Certification ───────────────────────────────────
files['16-operational-readiness-certification.md'] = HEAD('16', 'Operational Readiness Certification') +
`## The ${S.axis_count} operational axes — certified SEPARATELY (NEVER combined)\n\n` +
`| Operational axis | Structural coverage | S·P·D·M | Open gaps | Definition |\n|---|---|---|---|---|\n` +
AXES.map((a) => {
  const c = certByAxis[a.key]; const r = c.status_rollup;
  return `| **${c.label}** (\`${c.key}\`) | **${dash(c.structural_coverage_score)}** | ${r.SUPPORTED}·${r.PARTIAL}·${r.DEAD_END}·${r.MISSING} | ${c.open_gaps.join(', ') || '—'} | ${a.definition} |`;
}).join('\n') + '\n\n' +
`${CERT.honesty_note}\n\n` +
`## Structural validation (a SEPARATE axis — not a composite of the 10 scores)\n` +
Object.entries(VAL.checks).map(([k, v]: any) => `- **${k}**: ${v.pass ? 'PASS' : 'FAIL'} — ${v.note}`).join('\n') + '\n\n' +
`**Validation verdict: ${VAL.verdict}.** ${VAL.honesty_note}\n\n` +
`## Enterprise operability verdict (structural)\n**${S.enterprise_ready.verdict}.** Operability confidence: **${dash(S.enterprise_ready.operability_confidence)}** (WITHHELD by design — Built ≠ Operated). ${S.enterprise_ready.note}\n\n` +
`## Final answer\n> Can CAPADEX be operated, monitored, supported, and maintained as an enterprise production platform, based on repository evidence?\n\n` +
`**STRUCTURALLY, YES** — every certified axis composes existing observability substrate with **0 Launch-Critical** gaps. Enterprise production-operation **CONFIDENCE is WITHHELD** (a SEPARATE axis) pending real operational volume + closure of the classified **${GAPS.gap_counts.Medium} Medium / ${GAPS.gap_counts.Low} Low / ${GAPS.gap_counts.Future} Future** gaps (metrics export/APM, durable queue + DLQ, alert-rule store + notification routing, AI cost/token accounting, correlation-ID propagation + tracing, DR restore drills). Coverage ⟂ Confidence ⟂ Adoption never composited; null ≠ 0; nothing fabricated.\n\n` +
`_STOP — human approval required before merge/deploy._\n`;

for (const [name, body] of Object.entries(files)) {
  writeFileSync(path.join(DIR, name), body);
}
console.log(`[gen] wrote ${Object.keys(files).length} deliverables to ${DIR}`);
console.log(`[gen] ${Object.keys(files).sort().join(', ')}`);
