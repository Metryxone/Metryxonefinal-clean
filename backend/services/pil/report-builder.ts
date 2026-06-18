/**
 * CAPADEX PIL — Phase 6C: Report Builder (orchestrator, read-only).
 *
 *   Third of the three 6C engines. COMPOSES the existing runtime intelligence into
 *   four structured, fully-explainable, export-ready reports:
 *
 *     Student   · Parent · Counselor  → per-session (reshape 6B summaries)
 *     Institution                      → NEW cohort aggregate across many sessions
 *
 *   Every report carries: stakeholder sections (each statement with an honest
 *   Response→…→Intervention trace), an explainability-coverage block, a deterministic
 *   readiness score, and three export DATA SHAPES (api / print / pdf-ready). No PDF
 *   library, no external integration — only the shapes a renderer would consume.
 *
 * CANON (strict, identical to Phase 6/6A/6B): additive, read-only, no recompute, no
 *   AI, no new content; deterministic; graceful degradation (missing input → empty
 *   section + honest note, never fabricated); never throws.
 */
import type { Pool } from 'pg';
import {
  buildGuidanceForSession,
  type GuidanceBundle,
} from './runtime-guidance-engine';
import {
  buildPipelineForSession,
  type PipelineResult,
  type PipelineHop,
} from './pipeline-resolver';
import { discoverStrengths, type StrengthProfile } from '../strength-discovery-engine';
import {
  buildStudentSummary,
  buildParentSummary,
  buildCounselorSummary,
} from './stakeholder-summary-engine';
import {
  buildStudentReportSections,
  buildParentReportSections,
  buildCounselorReportSections,
  humanize,
  type ReportSection,
  type ReportItem,
  type ReportType,
} from './report-section-engine';
import {
  attachExplainability,
  type TracedSection,
  type ExplainabilityCoverage,
} from './report-explainability-engine';
import { buildCareerBehaviorProfile, type CareerBehaviorProfile } from '../career-behavior-adapter';
import { buildPersonalizationEnvelope } from '../wc3/personalization-wiring';
import { isWc3ReportPersonalizationEnabled, isWc3LongitudinalConsumptionEnabled } from '../../config/feature-flags';
import { getLongitudinalHistoryBySession } from '../wc3/longitudinal-foundation';
import { computeLongitudinalConsumption, type LongitudinalConsumption } from '../wc3/longitudinal-consumption';

// ── Public shapes ────────────────────────────────────────────────────────────
export interface ReadinessComponents {
  explainability: number;       // 0..1 — coverage of surfaced statements
  section_fill: number;         // 0..1 — non-empty sections / total sections
  data_completeness: number;    // 0..1 — 1 when not degraded, 0.5 when degraded
  stakeholder_specificity: number; // 0..1 — 1 when any section carries real content
}

export interface ReadinessScore {
  score: number;                // 0..100, deterministic
  band: 'ready' | 'partial' | 'thin';
  components: ReadinessComponents;
  note: string;
}

export type PdfBlockType = 'heading' | 'subheading' | 'paragraph' | 'bullet' | 'trace';
export interface PdfBlock {
  type: PdfBlockType;
  text: string;
  level?: number;
}

export interface ReportExports {
  /** API-ready: the structured report object minus the export shapes (no recursion). */
  api_ready: Record<string, unknown>;
  /** Print-ready: a deterministic flat plain-text rendering. */
  print_ready: string;
  /** PDF-ready: an ordered block model a PDF renderer would consume (no PDF lib). */
  pdf_ready: PdfBlock[];
}

export interface StakeholderReport {
  report_type: Exclude<ReportType, 'institution'>;
  enabled: true;
  session_id: string;
  generated_at: string;
  archetype: { key: string; name: string | null } | null;
  concern_label: string | null;
  degraded: boolean;
  reason: string | null;
  title: string;
  sections: TracedSection[];
  explainability: ExplainabilityCoverage;
  readiness: ReadinessScore;
  exports: ReportExports;
}

export interface InstitutionReport {
  report_type: 'institution';
  enabled: true;
  generated_at: string;
  cohort_size: number;
  session_ids: string[];
  degraded: boolean;
  reason: string | null;
  title: string;
  sections: TracedSection[];
  explainability: ExplainabilityCoverage;
  readiness: ReadinessScore;
  exports: ReportExports;
}

const STAKEHOLDER_TITLE: Record<Exclude<ReportType, 'institution'>, string> = {
  student: 'Student Development Report',
  parent: 'Parent Guidance Report',
  counselor: 'Counselor Intelligence Report',
};

const COHORT_CAP = 200;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Readiness score (deterministic) ──────────────────────────────────────────

/**
 * Composite 0..100 readiness score from four bounded components:
 *   explainability 40% · section fill 30% · data completeness 20% · specificity 10%.
 * Pure + deterministic; documented weights, no randomness.
 */
export function computeReadiness(
  sections: TracedSection[],
  explainability: ExplainabilityCoverage,
  degraded: boolean,
): ReadinessScore {
  const total = sections.length || 1;
  const filled = sections.filter((s) => s.items.length > 0).length;
  const section_fill = round2(filled / total);
  const components: ReadinessComponents = {
    explainability: explainability.coverage,
    section_fill,
    data_completeness: degraded ? 0.5 : 1,
    stakeholder_specificity: filled > 0 ? 1 : 0,
  };
  const raw =
    0.4 * components.explainability +
    0.3 * components.section_fill +
    0.2 * components.data_completeness +
    0.1 * components.stakeholder_specificity;
  const score = Math.round(raw * 100);
  // A degraded chain can never read as "ready/complete" — cap at partial so the
  // band never overclaims completeness when middle lineage hops are unresolved.
  const rawBand: ReadinessScore['band'] = score >= 80 ? 'ready' : score >= 50 ? 'partial' : 'thin';
  const band: ReadinessScore['band'] = degraded && rawBand === 'ready' ? 'partial' : rawBand;
  const note =
    degraded
      ? (band === 'thin'
          ? 'Report has limited resolved intelligence for this scope.'
          : `Report is usable; surfaced statements are fully traceable to the resolved depth, but the lineage chain is partially resolved (${explainability.lineage.filter((h) => !h.resolved).length} hop(s) unresolved).`)
      : (band === 'ready' ? 'Report is complete and fully traceable.'
         : band === 'partial' ? 'Report is usable but some sections are thin.'
         : 'Report has limited resolved intelligence for this scope.');
  return { score, band, components, note };
}

// ── Export shapes (pure) ─────────────────────────────────────────────────────

function traceLine(item: { trace: { label: string }[] }): string {
  if (!item.trace.length) return '';
  return `Trace: ${item.trace.map((t) => t.label).join('  ›  ')}`;
}

function buildPdfBlocks(title: string, metaLine: string, sections: TracedSection[]): PdfBlock[] {
  const blocks: PdfBlock[] = [
    { type: 'heading', text: title, level: 1 },
    { type: 'paragraph', text: metaLine },
  ];
  for (const s of sections) {
    blocks.push({ type: 'subheading', text: s.title, level: 2 });
    if (!s.items.length && s.note) {
      blocks.push({ type: 'paragraph', text: s.note });
      continue;
    }
    for (const item of s.items) {
      const label = item.label ? ` [${item.label}]` : '';
      const meta = item.meta ? ` (${item.meta})` : '';
      blocks.push({ type: 'bullet', text: `${item.text}${label}${meta}` });
      const tl = traceLine(item);
      if (tl) blocks.push({ type: 'trace', text: tl });
    }
  }
  return blocks;
}

function buildPrintText(blocks: PdfBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === 'heading') { lines.push('', `# ${b.text}`, '='.repeat(Math.min(60, b.text.length))); }
    else if (b.type === 'subheading') { lines.push('', `## ${b.text}`); }
    else if (b.type === 'paragraph') { lines.push(b.text); }
    else if (b.type === 'bullet') { lines.push(`  • ${b.text}`); }
    else if (b.type === 'trace') { lines.push(`      ${b.text}`); }
  }
  return lines.join('\n').trim();
}

function buildExports(title: string, metaLine: string, body: Record<string, unknown>, sections: TracedSection[]): ReportExports {
  const pdf_ready = buildPdfBlocks(title, metaLine, sections);
  return {
    api_ready: body,
    print_ready: buildPrintText(pdf_ready),
    pdf_ready,
  };
}

// ── Per-session report assembly (pure given inputs) ──────────────────────────

function assembleStakeholderReport(
  reportType: Exclude<ReportType, 'institution'>,
  sessionId: string,
  guidance: GuidanceBundle,
  pipeline: PipelineResult,
  strengths: StrengthProfile | null,
  personalization: ReportPersonalization | null = null,
  longitudinal: LongitudinalConsumption | null = null,
): StakeholderReport {
  let sections: ReportSection[];
  if (reportType === 'parent') {
    sections = buildParentReportSections(buildParentSummary(guidance, pipeline, strengths), guidance);
  } else if (reportType === 'counselor') {
    sections = buildCounselorReportSections(buildCounselorSummary(guidance, pipeline));
  } else {
    sections = buildStudentReportSections(buildStudentSummary(guidance, pipeline), strengths);
  }

  const { sections: traced, explainability } = attachExplainability(sections, pipeline.hops);
  const degraded = pipeline.degraded || guidance.degraded;
  const reason = pipeline.reason ?? guidance.reason;
  const concernLabel = concernLabelOf(pipeline);
  const title = STAKEHOLDER_TITLE[reportType];
  const readiness = computeReadiness(traced, explainability, degraded);

  const body: Record<string, unknown> = {
    report_type: reportType,
    session_id: sessionId,
    generated_at: pipeline.generated_at,
    archetype: guidance.archetype,
    concern_label: concernLabel,
    degraded,
    reason,
    title,
    sections: traced,
    explainability,
    readiness,
    // WC-P2 Lever B — additive, omitted entirely when flag OFF (byte-identical legacy body).
    ...(personalization ? { personalization } : {}),
    // WC-P2 Lever D — additive longitudinal trend/forecast, omitted when flag OFF.
    ...(longitudinal ? { longitudinal } : {}),
  };
  const metaLine = metaLineFor(concernLabel, guidance.archetype, degraded, pipeline.generated_at);

  return {
    ...(body as object),
    report_type: reportType,
    enabled: true,
    sections: traced,
    explainability,
    readiness,
    ...(personalization ? { personalization } : {}),
    ...(longitudinal ? { longitudinal } : {}),
    exports: buildExports(title, metaLine, body, traced),
  } as StakeholderReport;
}

function metaLineFor(
  concernLabel: string | null,
  archetype: { key: string; name: string | null } | null,
  degraded: boolean,
  generatedAt: string,
): string {
  const parts = [
    concernLabel ? `Concern: ${concernLabel}` : null,
    archetype ? `Archetype: ${archetype.name ?? archetype.key}` : null,
    degraded ? 'Status: partially resolved' : 'Status: fully resolved',
    `Generated: ${generatedAt}`,
  ].filter(Boolean);
  return parts.join('  ·  ');
}

function concernLabelOf(pipeline: PipelineResult): string | null {
  const hop = pipeline.hops.find((h) => h.key === 'signal_to_concern');
  const data = (hop?.data ?? null) as { concern_label?: string | null } | null;
  return data?.concern_label ?? null;
}

// ── WC-P2 Lever B — Report Personalization (additive, flag-gated, read-only) ──
// Composes the already-derived persona (session record → canonical persona) + the
// read-only career behaviour profile (over the persisted Unified Behavior Graph) into
// an additive `personalization` block. Flag OFF → null (byte-identical legacy report).
// Never fabricates: empty behaviour graph → honest neutral profile + `consumed:false`.
export interface ReportPersonalization {
  consumed: boolean;
  persona: {
    canonical_persona: string | null;
    primary_persona: string | null;
    age: number | null;
    age_band: string | null;
  };
  behavior_profile: CareerBehaviorProfile | null;
  sources: string[];
  note: string | null;
}

async function loadReportPersonalization(pool: Pool, sessionId: string): Promise<ReportPersonalization | null> {
  if (!isWc3ReportPersonalizationEnabled()) return null;
  try {
    let primaryPersona: string | null = null;
    let age: number | null = null;
    let ageBand: string | null = null;
    try {
      const { rows } = await pool.query(
        `SELECT persona, user_age, age_band FROM capadex_sessions WHERE id = $1 LIMIT 1`,
        [sessionId],
      );
      primaryPersona = rows[0]?.persona ?? null;
      age = rows[0]?.user_age ?? null;
      ageBand = rows[0]?.age_band ?? null;
    } catch { /* session row unavailable — degrade honestly */ }

    const canonical = buildPersonalizationEnvelope({
      primaryPersona,
      age: age ?? undefined,
      ageBand: ageBand ?? undefined,
    }).personalization.dims_used.canonical_persona;

    const profile = await buildCareerBehaviorProfile(pool, sessionId).catch(() => null);

    const sources: string[] = [];
    if (canonical || primaryPersona) sources.push('persona');
    if (profile && profile.sources.length > 0) sources.push('behavior_graph');
    const consumed = sources.length > 0;

    return {
      consumed,
      persona: { canonical_persona: canonical, primary_persona: primaryPersona, age, age_band: ageBand },
      behavior_profile: profile,
      sources,
      note: consumed ? null : 'No persona or behavioural intelligence captured for this session yet.',
    };
  } catch (err) {
    console.warn('[report-personalization] degrade:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ── DB orchestrators (read-only, never throw) ────────────────────────────────

async function loadInputs(pool: Pool, sessionId: string): Promise<{
  guidance: GuidanceBundle;
  pipeline: PipelineResult;
  strengths: StrengthProfile | null;
  personalization: ReportPersonalization | null;
  longitudinal: LongitudinalConsumption | null;
}> {
  const [guidance, pipeline] = await Promise.all([
    buildGuidanceForSession(pool, sessionId),
    buildPipelineForSession(pool, sessionId),
  ]);
  const strengths = await discoverStrengths(pool, sessionId).catch(() => null);
  const personalization = await loadReportPersonalization(pool, sessionId);
  const longitudinal = await loadLongitudinalConsumption(pool, sessionId);
  return { guidance, pipeline, strengths, personalization, longitudinal };
}

// ── WC-P2 Lever D — Longitudinal consumption (additive, flag-gated, read-only) ──
async function loadLongitudinalConsumption(pool: Pool, sessionId: string): Promise<LongitudinalConsumption | null> {
  if (!isWc3LongitudinalConsumptionEnabled()) return null;
  try {
    const history = await getLongitudinalHistoryBySession(pool, sessionId).catch(() => null);
    return computeLongitudinalConsumption(history);
  } catch (err) {
    console.warn('[report-longitudinal] degrade:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function buildStakeholderReport(
  pool: Pool,
  sessionId: string,
  reportType: Exclude<ReportType, 'institution'>,
): Promise<StakeholderReport> {
  const { guidance, pipeline, strengths, personalization, longitudinal } = await loadInputs(pool, sessionId);
  return assembleStakeholderReport(reportType, sessionId, guidance, pipeline, strengths, personalization, longitudinal);
}

export async function buildAllStakeholderReports(
  pool: Pool,
  sessionId: string,
): Promise<Record<'student' | 'parent' | 'counselor', StakeholderReport>> {
  const { guidance, pipeline, strengths, personalization, longitudinal } = await loadInputs(pool, sessionId);
  return {
    student: assembleStakeholderReport('student', sessionId, guidance, pipeline, strengths, personalization, longitudinal),
    parent: assembleStakeholderReport('parent', sessionId, guidance, pipeline, strengths, personalization, longitudinal),
    counselor: assembleStakeholderReport('counselor', sessionId, guidance, pipeline, strengths, personalization, longitudinal),
  };
}

// ── Institution (cohort) report ──────────────────────────────────────────────

interface CohortMember {
  session_id: string;
  guidance: GuidanceBundle;
  pipeline: PipelineResult;
  strengths: StrengthProfile | null;
}

/** Frequency-rank helper: returns [{ key, count, ...sample }] sorted by count desc then key. */
function rankBy<T>(rows: T[], keyOf: (r: T) => string): { key: string; count: number; sample: T }[] {
  const map = new Map<string, { key: string; count: number; sample: T }>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!k) continue;
    const hit = map.get(k);
    if (hit) hit.count += 1;
    else map.set(k, { key: k, count: 1, sample: r });
  }
  return [...map.values()].sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key));
}

/**
 * Aggregate per-session intelligence into a deterministic cohort view. Pure given
 * the loaded members. Strengths/risks/archetypes/interventions are COUNTED across
 * the cohort, never invented; an empty cohort dimension yields an honest note.
 */
export function assembleInstitutionReport(members: CohortMember[]): InstitutionReport {
  const generated_at = new Date(0).toISOString(); // deterministic placeholder; overwritten by caller
  const session_ids = members.map((m) => m.session_id).sort();
  const cohort_size = members.length;

  // Cohort Strengths — aggregate canon strength labels across the cohort.
  const strengthRows = members.flatMap((m) => {
    const p = m.strengths;
    if (!p) return [] as { label: string; evidence: string }[];
    return [...p.strengths, ...p.resilience, ...p.coping, ...p.success_patterns]
      .map((s) => ({ label: s.label, evidence: s.evidence }));
  });
  const cohortStrengths: ReportItem[] = rankBy(strengthRows, (r) => r.label.toLowerCase()).map((r) => ({
    text: r.sample.label,
    label: `${r.count} of ${cohort_size}`,
    meta: r.sample.evidence || null,
    severity: null,
    self_trace: [{
      step: 1, key: 'response_to_signal', label: 'Response → Signal (positive)',
      summary: `Present in ${r.count} of ${cohort_size} cohort sessions.`,
    }],
  }));

  // Cohort Risks — aggregate actionable signals surfaced as counselor priority risks.
  const riskRows = members.flatMap((m) => {
    const counselor = buildCounselorReportSections(buildCounselorSummary(m.guidance, m.pipeline));
    const section = counselor.find((s) => s.key === 'priority_risks');
    return (section?.items ?? []).map((i) => ({ label: i.label || i.text, severity: i.severity ?? null }));
  });
  const sevRank = (s: string | null) => (s === 'high' ? 0 : s === 'moderate' ? 1 : 2);
  const cohortRisks: ReportItem[] = rankBy(riskRows, (r) => (r.label || '').toLowerCase())
    .map((r) => ({ rank: r, sev: sevRank(r.sample.severity) }))
    .sort((a, b) => (b.rank.count - a.rank.count) || (a.sev - b.sev) || a.rank.key.localeCompare(b.rank.key))
    .map(({ rank }) => ({
      text: rank.sample.label,
      label: `${rank.count} of ${cohort_size}`,
      meta: rank.sample.severity ? `${rank.sample.severity} severity` : null,
      severity: rank.sample.severity,
    }));

  // Archetype Distribution — count resolved archetype per session.
  const archRows = members
    .map((m) => m.guidance.archetype)
    .filter((a): a is { key: string; name: string | null } => !!a)
    .map((a) => ({ name: a.name ?? a.key, key: a.key }));
  const archDistribution: ReportItem[] = rankBy(archRows, (r) => r.key).map((r) => ({
    text: r.sample.name,
    label: `${r.count} of ${cohort_size} (${Math.round((r.count / (cohort_size || 1)) * 100)}%)`,
    meta: null,
    severity: null,
  }));

  // Intervention Opportunities — aggregate intervention types across the cohort.
  const ivRows = members.flatMap((m) =>
    (m.guidance.interventions ?? []).filter((i) => i && i.text).map((i) => ({ type: i.type, text: i.text })));
  const ivOpportunities: ReportItem[] = rankBy(ivRows, (r) => r.type).map((r) => ({
    text: humanize(r.sample.type),
    label: `${r.count} of ${cohort_size}`,
    meta: r.sample.text || null,
    severity: null,
  }));

  const sections: ReportSection[] = [
    {
      key: 'cohort_strengths', title: 'Cohort Strengths', items: cohortStrengths,
      note: cohortStrengths.length ? null : 'No strength signals captured across this cohort yet.',
      anchor: 'response_to_signal',
    },
    {
      key: 'cohort_risks', title: 'Cohort Risks', items: cohortRisks,
      note: cohortRisks.length ? null : 'No actionable risk signals across this cohort yet.',
      anchor: 'signal_to_concern',
    },
    {
      key: 'archetype_distribution', title: 'Archetype Distribution', items: archDistribution,
      note: archDistribution.length ? null : 'No archetypes could be confidently resolved across this cohort.',
      anchor: 'behavior_to_archetype',
    },
    {
      key: 'intervention_opportunities', title: 'Intervention Opportunities', items: ivOpportunities,
      note: ivOpportunities.length ? null : 'No mapped interventions across this cohort yet.',
      anchor: 'archetype_to_intervention',
    },
  ];

  // Cohort lineage = the union of resolved hop keys present in ANY member, so a
  // cohort-level statement traces to the same chain depth its data reached.
  const lineage = unionLineage(members.map((m) => m.pipeline.hops));
  const { sections: traced, explainability } = attachExplainability(sections, lineage);
  const degraded = cohort_size === 0 || members.some((m) => m.pipeline.degraded || m.guidance.degraded);
  const reason = cohort_size === 0 ? 'empty_cohort' : (degraded ? 'partial_cohort_resolution' : null);
  const readiness = computeReadiness(traced, explainability, degraded);
  const title = 'Institution Cohort Report';

  const body: Record<string, unknown> = {
    report_type: 'institution',
    generated_at,
    cohort_size,
    session_ids,
    degraded,
    reason,
    title,
    sections: traced,
    explainability,
    readiness,
  };
  const metaLine = `Cohort size: ${cohort_size}  ·  ${degraded ? 'Status: partially resolved' : 'Status: fully resolved'}`;

  return {
    report_type: 'institution',
    enabled: true,
    generated_at,
    cohort_size,
    session_ids,
    degraded,
    reason,
    title,
    sections: traced,
    explainability,
    readiness,
    exports: buildExports(title, metaLine, body, traced),
  };
}

/** Union resolved hops across members (first resolved instance per hop key wins). */
function unionLineage(allHops: PipelineHop[][]): PipelineHop[] {
  const byKey = new Map<string, PipelineHop>();
  for (const hops of allHops) {
    for (const h of hops) {
      const existing = byKey.get(h.key);
      if (!existing || (!existing.resolved && h.resolved)) byKey.set(h.key, h);
    }
  }
  return [...byKey.values()].sort((a, b) => a.step - b.step);
}

export async function buildInstitutionReport(
  pool: Pool,
  sessionIds: string[],
): Promise<InstitutionReport> {
  const ids = [...new Set(sessionIds.map((s) => String(s).trim()).filter(Boolean))].slice(0, COHORT_CAP);
  const members: CohortMember[] = [];
  for (const id of ids) {
    const loaded = await loadInputs(pool, id).catch(() => null);
    if (loaded) members.push({ session_id: id, ...loaded });
  }
  const report = assembleInstitutionReport(members);
  // Stamp a real generation time on the DB-backed path (kept out of the pure core
  // so the pure assembler stays deterministic for tests).
  const generated_at = new Date().toISOString();
  (report as { generated_at: string }).generated_at = generated_at;
  (report.exports.api_ready as { generated_at?: string }).generated_at = generated_at;
  return report;
}

export { STAKEHOLDER_TITLE };
