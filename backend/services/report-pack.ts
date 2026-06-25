/**
 * report-pack.ts — MX-301 Phase 2 enterprise report-pack composer.
 *
 * Composes a presentation-quality pack of 16 enterprise reports for ONE
 * demonstration candidate by running the EXISTING platform engines once and
 * mapping their REAL output into the single render shape every renderer +
 * the in-app preview consume: `report.generated_content.sections`.
 *
 * Honesty contract (identical to the rest of the platform):
 *   - REUSES existing engines only. No new/rebuilt engine, no fabricated value.
 *   - Coverage (is there measurable input), Confidence (how trustworthy the
 *     value is) and Activation (the engine executed & produced an artifact) are
 *     kept as THREE SEPARATE axes — never composited. `null` is never coerced to 0.
 *   - A report with no measurable input is NOT blank and NOT a failure: it
 *     renders the full fixed 9-section layout with a professional honest state
 *     (why / how to populate / what's needed / expected output).
 *   - Charts/tables are emitted ONLY from real engine data — never a blank chart
 *     or an empty table. When the data isn't there, an honest styled callout
 *     takes the visualization slot instead.
 *   - The subject id (an email) is masked to an irreversible pseudonym before it
 *     appears in any composed artifact.
 *
 * Output of every report obeys the FIXED 9-section layout, in order:
 *   1. Executive Summary   2. Candidate Information   3. Assessment Summary
 *   4. Visualizations      5. Interpretation          6. Recommendations
 *   7. Confidence Level    8. Data Source             9. Generated Timestamp
 *
 * Section TYPES are chosen so all four export formats (PDF/HTML/JSON/CSV) carry
 * the same content: narratives + chart datapoints + insights are all captured by
 * the CSV/JSON renderers, so the pack avoids `score`-only sections (CSV ignores
 * them) and embeds headline metrics into narrative text + a real chart instead.
 */
import { createHash } from 'crypto';
import type { Pool } from 'pg';

import { getProfile, computeTypeProfile } from './competency-runtime.js';
import { buildEiProfile } from './ei-profile-engine.js';
import { computeRoleReadinessV2 } from './role-readiness-v2.js';
import { buildProgression } from './progression-engine.js';
import { computeEmployabilityScore } from './employability-scoring-engine.js';
import { buildCareerRecommendations } from './career-recommendation-aggregator.js';
import { buildCareerGap } from './career-gap-engine.js';
import { buildCareerRoadmap } from './career-roadmap-engine.js';
import { buildCareerDevelopment } from './career-development-engine.js';
import { generateCareerPassport } from './passport-generator.js';
import { computeCompetencyDrivenMatch } from './employer-competency-hiring.js';
import { candidateEvaluation } from './evaluation-engine.js';

export const REPORT_PACK_VERSION = '1.0.0';
export const MX301_ROLE_TITLE = 'Senior Product Manager';
export const MX301_DEMO_JOB_ID = 'mx301_demo_job';

// ── PII masking ─────────────────────────────────────────────────────────────
export function maskSubject(subjectId: string): string {
  return `user_${createHash('sha256').update(String(subjectId)).digest('hex').slice(0, 12)}`;
}

// ── Defensive accessors (engines vary; never throw, null is never 0) ─────────
function num(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}
function str(v: any): string | null {
  if (typeof v === 'string') return v.trim() === '' ? null : v;
  if (v != null && typeof v !== 'object') return String(v);
  return null;
}
// Honest formatters — NEVER emit a "?" / "?w" placeholder when a value is absent.
function wkSuffix(v: any): string {
  const n = num(v);
  return n != null ? `, ~${n}w` : '';
}
function wkClause(v: any): string {
  const n = num(v);
  return n != null ? ` totalling ~${n} weeks` : '';
}
function pctOrPhrase(v: any): string {
  const n = num(v);
  return n != null ? `${n}%` : 'not yet computed';
}
function arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}
/** Object-or-record → array of its values (engines return Record<> buckets). */
function values(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.values(v);
  return [];
}
function round(n: number | null): number | null {
  return n == null ? null : Math.round(n * 10) / 10;
}
/** Honest level formatter — an absent/non-numeric level reads "not yet measured",
 *  NEVER the literal string "null" (precise⟂domain-proxy gap is surfaced honestly). */
function lvl(v: any): string {
  const n = num(v);
  return n == null ? 'not yet measured' : String(n);
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface CandidateInfo {
  name: string;
  masked_subject: string;
  current_role: string | null;
  target_role: string | null;
  industry: string | null;
  experience_years: number | null;
  education: string | null;
  location: string | null;
  summary: string | null;
}

export interface PackSnapshot {
  subject_id: string;
  candidate: CandidateInfo;
  role_title: string;
  generated_at: string;
  engines: Record<string, any>;
  errors: Record<string, string>;
}

interface HonestState {
  why: string;
  workflow: string;
  needed: string;
  expected: string;
}

interface ChartSpec {
  title: string;
  data_source: string;
  chart_type: string;
  labels: string[];
  values: number[];
  note?: string;
}

interface ReportContent {
  key: string;
  report_type: string;
  title: string;
  measurable: boolean;
  coverage: { pct: number | null; note: string };
  confidence: { band: string | null; note: string };
  activation: string;
  data_source: string;
  executive: string;
  assessment: string;
  chart: ChartSpec | null;
  interpretation: string;
  recommendations: { text: string; severity: string }[];
  confidence_text: string;
  honest: HonestState | null;
}

export interface ComposedReport {
  key: string;
  report_type: string;
  title: string;
  measurable: boolean;
  generated_content: {
    sections: any[];
    axes: {
      activation: string;
      coverage: { pct: number | null; note: string };
      confidence: { band: string | null; note: string };
    };
    data_flow: string;
  };
  metadata: {
    pack_version: string;
    measurable: boolean;
    honest_state: HonestState | null;
    data_source: string;
    role_title: string;
  };
}

// ── Snapshot — run every engine once (try/catch each; honest, never throws) ──
export async function buildPackSnapshot(pool: Pool, subjectId: string): Promise<PackSnapshot> {
  const engines: Record<string, any> = {};
  const errors: Record<string, string> = {};

  const run = async (key: string, fn: () => Promise<any>) => {
    try {
      engines[key] = await fn();
    } catch (e: any) {
      engines[key] = null;
      errors[key] = String(e?.message ?? e).slice(0, 200);
    }
  };

  await run('profile', () => getProfile(pool, subjectId));
  await run('typeProfile', () => computeTypeProfile(pool, subjectId));
  await run('ei', () => buildEiProfile(pool, subjectId));
  await run('readiness', () => computeRoleReadinessV2(pool, subjectId));
  await run('progression', () => buildProgression(pool, subjectId));
  await run('employability', () => computeEmployabilityScore(pool, subjectId));
  await run('recommendations', () => buildCareerRecommendations(pool, subjectId));
  await run('gap', () => buildCareerGap(pool, subjectId));
  await run('roadmap', () => buildCareerRoadmap(pool, subjectId));
  await run('development', () => buildCareerDevelopment(pool, subjectId));
  await run('passport', () => generateCareerPassport(pool, subjectId));
  await run('match', () =>
    computeCompetencyDrivenMatch(pool, {
      candidate: { email: subjectId, full_name: 'Sarah Johnson' },
      job: { id: MX301_DEMO_JOB_ID, title: MX301_ROLE_TITLE },
    }),
  );
  await run('evaluation', () => candidateEvaluation(pool, MX301_DEMO_JOB_ID, subjectId));

  // Candidate descriptive info (career_seeker_profiles.data JSONB). Email masked.
  let candidate: CandidateInfo = {
    name: 'Sarah Johnson',
    masked_subject: maskSubject(subjectId),
    current_role: MX301_ROLE_TITLE,
    target_role: null,
    industry: null,
    experience_years: null,
    education: null,
    location: null,
    summary: null,
  };
  try {
    const { rows } = await pool.query(
      `SELECT data FROM career_seeker_profiles WHERE user_id = $1`,
      [subjectId],
    );
    const d = rows[0]?.data ?? {};
    candidate = {
      name: str(d.name) ?? 'Sarah Johnson',
      masked_subject: maskSubject(subjectId),
      current_role: str(d.current_role) ?? MX301_ROLE_TITLE,
      target_role: str(d.target_role),
      industry: str(d.industry),
      experience_years: num(d.experience_years),
      education: str(d.education),
      location: str(d.location),
      summary: str(d.summary),
    };
  } catch (e: any) {
    errors['candidate'] = String(e?.message ?? e).slice(0, 200);
  }

  return {
    subject_id: subjectId,
    candidate,
    role_title: MX301_ROLE_TITLE,
    generated_at: new Date().toISOString(),
    engines,
    errors,
  };
}

// ── Section makers (shapes the existing renderers + HTML renderer consume) ───
function narrative(title: string, text: string, opts?: { callout?: string }): any {
  return { type: 'narrative', key: slug(title), title, text, ...(opts?.callout ? { callout: opts.callout } : {}) };
}
function insightSection(title: string, insights: { text: string; severity: string }[]): any {
  return { type: 'insight', key: slug(title), title, insights };
}
function chartSection(title: string, spec: ChartSpec): any {
  return {
    type: 'chart',
    key: slug(title),
    title,
    visualization: { title: spec.title, data_source: spec.data_source, chart_type: spec.chart_type },
    resolved_data: { labels: spec.labels, datasets: [{ data: spec.values }] },
    ...(spec.note ? { note: spec.note } : {}),
  };
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function honestText(h: HonestState): string {
  return (
    'Insufficient validated data to populate this section yet.\n\n' +
    `Why: ${h.why}\n` +
    `How to populate it: ${h.workflow}\n` +
    `What is needed: ${h.needed}\n` +
    `Expected output once available: ${h.expected}`
  );
}

function candidateBlock(c: CandidateInfo): string {
  const lines = [
    `Name: ${c.name}`,
    `Reference (masked): ${c.masked_subject}`,
    c.current_role ? `Current role: ${c.current_role}` : null,
    c.target_role ? `Target role: ${c.target_role}` : null,
    c.industry ? `Industry: ${c.industry}` : null,
    c.experience_years != null ? `Experience: ${c.experience_years} years` : null,
    c.education ? `Education: ${c.education}` : null,
    c.location ? `Location: ${c.location}` : null,
  ].filter(Boolean);
  const block = lines.join('\n');
  return c.summary ? `${block}\n\nProfile summary: ${c.summary}` : block;
}

function fmtTs(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} at ${d
    .toISOString()
    .slice(11, 16)} UTC`;
}

// Keep only finite, non-negative chart values aligned with their labels.
function cleanChart(labels: any[], rawValues: any[]): { labels: string[]; values: number[] } {
  const L: string[] = [];
  const V: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    const v = num(rawValues[i]);
    const l = str(labels[i]);
    if (l != null && v != null) {
      L.push(l);
      V.push(v);
    }
  }
  return { labels: L, values: V };
}

// ── Compose ONE report from normalized content → fixed 9 sections ────────────
function composeReport(c: ReportContent, cand: CandidateInfo, generatedAt: string): ComposedReport {
  // 4. Visualizations — real chart, or honest callout (never a blank chart)
  let viz: any;
  if (c.chart && c.chart.labels.length > 0 && c.chart.values.length > 0) {
    viz = chartSection('Visualizations', c.chart);
  } else {
    viz = narrative(
      'Visualizations',
      c.honest
        ? honestText(c.honest)
        : 'No chartable measured data points are available for this report yet; the metrics above summarise everything currently measured.',
      { callout: 'honest' },
    );
  }

  // 6. Recommendations — insight list, or honest callout
  let recs: any;
  if (c.recommendations.length > 0) {
    recs = insightSection('Recommendations', c.recommendations);
  } else {
    recs = narrative(
      'Recommendations',
      c.honest
        ? honestText(c.honest)
        : 'No specific recommendations have been derived from the current measured inputs. Recommendations will appear once additional assessment evidence is captured.',
      { callout: 'honest' },
    );
  }

  const sections = [
    narrative('Executive Summary', c.executive),
    narrative('Candidate Information', candidateBlock(cand)),
    narrative('Assessment Summary', c.assessment),
    viz,
    narrative('Interpretation', c.interpretation),
    recs,
    narrative('Confidence Level', c.confidence_text),
    narrative('Data Source', c.data_source),
    narrative(
      'Generated Timestamp',
      `This report was generated on ${fmtTs(generatedAt)}.\n\nReport pack version: ${REPORT_PACK_VERSION}. ` +
        'It is a point-in-time snapshot; re-running the assessment workflow refreshes the underlying data.',
    ),
  ];

  return {
    key: c.key,
    report_type: c.report_type,
    title: c.title,
    measurable: c.measurable,
    generated_content: {
      sections,
      axes: {
        activation: c.activation,
        coverage: c.coverage,
        confidence: c.confidence,
      },
      data_flow: c.data_source,
    },
    metadata: {
      pack_version: REPORT_PACK_VERSION,
      measurable: c.measurable,
      honest_state: c.honest,
      data_source: c.data_source,
      role_title: MX301_ROLE_TITLE,
    },
  };
}

const ACTIVATION = 'Engine executed in-process and produced this artifact.';

// confidence band from a measurement granularity / coverage
function confidenceFromMeasurement(measurement: string | null, coveragePct: number | null): {
  band: string | null;
  note: string;
} {
  if (measurement === 'precise') {
    return { band: 'High', note: 'Scored precisely per competency against the genome.' };
  }
  if (measurement === 'hybrid') {
    return { band: 'Moderate', note: 'Mix of precise per-competency and domain-proxy scoring.' };
  }
  if (measurement === 'domain_proxy') {
    return {
      band: 'Provisional',
      note:
        'Domain-proxy scoring (aggregate domain level, not per-competency). Confidence rises to High once a ' +
        'competency-tagged assessment is scored.',
    };
  }
  if (coveragePct != null) {
    return {
      band: coveragePct >= 80 ? 'Moderate' : 'Provisional',
      note: `Derived from ${coveragePct}% type-classification coverage (structural; not measured scores).`,
    };
  }
  return { band: null, note: 'Confidence not applicable — no measured input yet.' };
}

// ============================================================================
// 16 report builders. Each returns normalized ReportContent.
// ============================================================================
type Builder = (s: PackSnapshot) => ReportContent;

const buildExecutiveSummary: Builder = (s) => {
  const p = s.engines.profile ?? {};
  const ei = s.engines.ei ?? {};
  const emp = s.engines.employability ?? {};
  const gap = s.engines.gap ?? {};
  const match = s.engines.match ?? {};
  const rec = s.engines.recommendations ?? {};

  const overall = num(p.overall_score);
  const eiScore = num(ei?.overall_ei?.ei_score);
  const empScore = num(emp?.summary?.ei_score);
  const matchPct = num(match?.competencyMatch);
  const topStrength = arr(ei.strength_areas)[0];
  const mostMaterial = gap?.summary?.most_material;
  const measurable = overall != null;

  const metrics: { label: string; value: number }[] = [];
  if (overall != null) metrics.push({ label: 'Competency Score', value: overall });
  if (empScore != null) metrics.push({ label: 'Employability Index', value: empScore });
  if (eiScore != null) metrics.push({ label: 'EI Composite', value: eiScore });
  if (matchPct != null) metrics.push({ label: 'Role Match %', value: matchPct });

  const recItems = flattenRecommendations(rec).slice(0, 3);

  const execLines = [
    `${s.candidate.name} (${s.candidate.current_role ?? MX301_ROLE_TITLE}) has completed an enterprise competency assessment across ${arr(p.domain_scores).length} capability domains.`,
    overall != null
      ? `The overall competency score is ${overall}/100${p.overall_level != null ? ` (level ${p.overall_level})` : ''}.`
      : 'A measured overall competency score is not yet available.',
    empScore != null ? `Employability Index stands at ${empScore}/100 (${str(emp?.summary?.ei_band) ?? 'band pending'}).` : null,
    topStrength ? `Top strength: ${str(topStrength.dimension_name)} (${num(topStrength.score)}).` : null,
    mostMaterial ? `Most material development gap: ${str(mostMaterial.competency_name)}.` : null,
    matchPct != null ? `Match to ${MX301_ROLE_TITLE} is ${matchPct}%.` : null,
  ].filter(Boolean);

  return {
    key: 'executive_summary',
    report_type: 'executive_summary',
    title: 'Executive Summary',
    measurable,
    coverage: { pct: num(p?.history_count) != null ? null : null, note: measurable ? 'Assessment completed and scored.' : 'No scored assessment yet.' },
    confidence: confidenceFromMeasurement(str(p.measurement), null),
    activation: ACTIVATION,
    data_source:
      'Composed from competency-runtime (getProfile), ei-profile-engine, employability-scoring-engine, ' +
      'career-gap-engine, employer-competency-hiring (match) and career-recommendation-aggregator.',
    executive: execLines.join(' '),
    assessment: measurable
      ? `Headline metrics — ${metrics.map((m) => `${m.label}: ${m.value}`).join('; ')}.`
      : 'The candidate record exists but no scored assessment has been completed, so headline metrics are not yet measurable.',
    chart:
      metrics.length > 0
        ? {
            title: 'Headline metrics',
            data_source: 'composite',
            chart_type: 'bar',
            ...cleanChart(metrics.map((m) => m.label), metrics.map((m) => m.value)),
          }
        : null,
    interpretation: measurable
      ? 'This summary consolidates the candidate’s strongest evidence across competency, employability and role-fit lenses. ' +
        'Each headline metric is explored in its dedicated report; figures are developmental signals, not hiring or promotion decisions.'
      : 'Until a scored assessment exists, the platform reports the absence of data honestly rather than estimating a score.',
    recommendations: recItems.length
      ? recItems.map((r) => ({ text: r, severity: 'info' }))
      : (topStrength ? [{ text: `Leverage strength in ${str(topStrength.dimension_name)}.`, severity: 'positive' }] : []),
    confidence_text: measurable
      ? `Overall confidence: ${confidenceFromMeasurement(str(p.measurement), null).band ?? 'Provisional'}. ` +
        confidenceFromMeasurement(str(p.measurement), null).note +
        ' Coverage, Confidence and Activation are reported as separate axes and are never combined into a single figure.'
      : 'Confidence is not applicable until a scored assessment is captured.',
    honest: measurable
      ? null
      : {
          why: 'No scored competency assessment exists for this candidate.',
          workflow: 'Complete the competency assessment workflow (assessment → scoring).',
          needed: 'At least one scored assessment run in onto_competency_profiles.',
          expected: 'Headline competency, employability, EI and role-match metrics with an overall narrative.',
        },
  };
};

const buildCompetencyProfile: Builder = (s) => {
  const p = s.engines.profile ?? {};
  const domains = arr(p.domain_scores);
  const overall = num(p.overall_score);
  const measurable = overall != null && domains.length > 0;
  const chart = measurable
    ? cleanChart(domains.map((d) => str(d.label) ?? str(d.onto_domain)), domains.map((d) => num(d.scaled_score)))
    : { labels: [], values: [] };

  return {
    key: 'competency_profile',
    report_type: 'competency_profile',
    title: 'Competency Profile',
    measurable,
    coverage: {
      pct: null,
      note: measurable ? `${domains.length} domains scored.` : 'No scored domains.',
    },
    confidence: confidenceFromMeasurement(str(p.measurement), null),
    activation: ACTIVATION,
    data_source: 'competency-runtime.getProfile → onto_competency_profiles (canonical runtime ledger).',
    executive: measurable
      ? `${s.candidate.name}'s competency profile spans ${domains.length} domains with an overall score of ${overall}/100 (${str(p.measurement) ?? 'domain_proxy'} measurement).`
      : `${s.candidate.name} does not yet have a scored competency profile.`,
    assessment: measurable
      ? `Domain scores — ${domains.map((d) => `${str(d.label) ?? str(d.onto_domain)}: ${num(d.scaled_score)}`).join('; ')}. Overall: ${overall}/100.`
      : 'No domain scores are available.',
    chart: measurable
      ? { title: 'Domain scores', data_source: 'competency', chart_type: 'bar', ...chart }
      : null,
    interpretation: measurable
      ? 'Domain scores describe relative capability strength across the competency genome. Higher domains indicate stronger demonstrated capability; lower domains are development priorities (see the Skill Gap and Action Plan reports).'
      : 'A scored assessment is required before a competency profile can be interpreted.',
    recommendations: measurable
      ? topAndBottom(domains, 'label', 'scaled_score')
      : [],
    confidence_text: `${confidenceFromMeasurement(str(p.measurement), null).band ?? 'Provisional'} — ${confidenceFromMeasurement(str(p.measurement), null).note}`,
    honest: measurable
      ? null
      : {
          why: 'No rows in onto_competency_profiles for this candidate.',
          workflow: 'Complete and score a competency assessment.',
          needed: 'A scored profile with domain_scores.',
          expected: 'Per-domain capability scores with an overall index and a strengths/gaps breakdown.',
        },
  };
};

const buildCompetencyRadar: Builder = (s) => {
  const tp = s.engines.typeProfile ?? {};
  // Honest domain-PROXY type means. computeTypeProfile emits TypeBucket
  // {type_key,label,measured_count,avg_score,competencies[]} where each competency
  // carries {measured_score, measurement}. We re-derive each type mean over ONLY the
  // competencies the bank can genuinely measure (`measurement === 'domain_proxy'`) so
  // an UNMEASURABLE onto-domain (e.g. dom_strategic, which has no bank code) — whose
  // proxy score the engine still counts in avg_score — never contaminates a type mean.
  const buckets = values(tp.buckets)
    .map((b) => {
      const dp = arr(b?.competencies).filter((c) => c && c.measurement === 'domain_proxy' && num(c.measured_score) != null);
      const mean = dp.length > 0
        ? Math.round((dp.reduce((sum, c) => sum + (num(c.measured_score) ?? 0), 0) / dp.length) * 10) / 10
        : null;
      return { label: str(b?.label) ?? str(b?.type_key) ?? '', measured_count: dp.length, mean };
    })
    .filter((b) => b.measured_count > 0 && b.mean != null);
  const measurable = buckets.length > 0;
  const chart = measurable
    ? cleanChart(buckets.map((b) => b.label), buckets.map((b) => b.mean))
    : { labels: [], values: [] };

  return {
    key: 'competency_radar',
    report_type: 'competency_radar',
    title: 'Competency Radar',
    measurable,
    coverage: {
      pct: measurable ? num(tp.classification_coverage_pct) : null,
      note: measurable
        ? `${num(tp.classified_competencies) ?? 0}/${num(tp.total_competencies) ?? 0} competencies classified by type; ${buckets.length} type${buckets.length === 1 ? '' : 's'} carry a bank-measurable domain-proxy mean.`
        : `${num(tp.classified_competencies) ?? 0}/${num(tp.total_competencies) ?? 0} competencies classified by type (structural only); no bank-measurable domain-proxy type means yet.`,
    },
    confidence: measurable
      ? confidenceFromMeasurement(null, num(tp.classification_coverage_pct))
      : { band: null, note: 'Confidence not applicable — no measured competency-type scores yet.' },
    activation: ACTIVATION,
    data_source: 'competency-runtime.computeTypeProfile → onto_competency_profiles domain scores, grouped by competency type (domain-PROXY mean per type; an onto-domain with no bank code, e.g. strategic, is unmeasurable and excluded).',
    executive: measurable
      ? `${s.candidate.name}'s capability is measured across ${buckets.length} competency type${buckets.length === 1 ? '' : 's'} (domain-proxy), classification coverage ${num(tp.classification_coverage_pct) ?? 0}%.`
      : `${s.candidate.name}'s competencies are classified by type, but no bank-measurable per-type means are available yet.`,
    assessment: measurable
      ? `Mean domain-proxy score by competency type — ${buckets.map((b) => `${b.label}: ${b.mean}`).join('; ')}.`
      : 'No bank-measurable competency-type means are available.',
    chart: measurable
      ? { title: 'Competency type means (domain-proxy)', data_source: 'competency', chart_type: 'radar', ...chart }
      : null,
    interpretation: measurable
      ? 'The radar contrasts capability across competency types (behavioural, cognitive, functional, technical, future-skills). Each type mean is a domain-proxy: every competency inherits the measured score of its onto-domain. A balanced shape indicates broad capability; a skewed shape highlights concentration.'
      : 'Competency-type classification with at least one bank-measurable onto-domain is required to render the radar.',
    recommendations: measurable ? topAndBottom(buckets, 'label', 'mean') : [],
    confidence_text: measurable
      ? confidenceFromMeasurement(null, num(tp.classification_coverage_pct)).note
      : 'Confidence not applicable — no measured competency-type scores yet.',
    honest: measurable
      ? null
      : {
          why: 'No bank-measurable competency-type means are available yet (competencies may be classified by type, but none map to a bank-measurable onto-domain with a score).',
          workflow: 'Score a competency assessment whose competencies map to bank-measurable onto types.',
          needed: 'At least one type bucket with a domain-proxy measured competency in computeTypeProfile.',
          expected: 'A radar of mean capability across each competency type.',
        },
  };
};

const buildCompetencyHeatmap: Builder = (s) => {
  const tp = s.engines.typeProfile ?? {};
  const comps: any[] = [];
  for (const b of values(tp.buckets)) {
    for (const c of arr(b?.competencies)) {
      // TypeBucketCompetency = {competency_id, competency_name, onto_domain,
      // measured_level, measured_score, measurement}. Include ONLY competencies the
      // bank can genuinely measure (`measurement === 'domain_proxy'`); an unmeasurable
      // onto-domain carries a score but is not a real measurement.
      if (c && c.measurement === 'domain_proxy' && num(c.measured_score) != null) {
        comps.push({ name: str(c.competency_name) ?? str(c.competency_id), score: num(c.measured_score) });
      }
    }
  }
  comps.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top = comps.slice(0, 20);
  const measurable = top.length > 0;
  const chart = measurable ? cleanChart(top.map((c) => c.name), top.map((c) => c.score)) : { labels: [], values: [] };

  return {
    key: 'competency_heatmap',
    report_type: 'competency_heatmap',
    title: 'Competency Heatmap',
    measurable,
    coverage: { pct: measurable ? num(tp.classification_coverage_pct) : null, note: `${comps.length} measured competencies.` },
    confidence: measurable
      ? confidenceFromMeasurement(null, num(tp.classification_coverage_pct))
      : { band: null, note: 'Confidence not applicable — no measured competency scores yet.' },
    activation: ACTIVATION,
    data_source: 'competency-runtime.computeTypeProfile → per-competency domain-PROXY scores (each competency inherits its onto-domain score; precise per-competency scoring requires onto_competency_question_map coverage).',
    executive: measurable
      ? `${comps.length} individual competencies are measured for ${s.candidate.name}; the heatmap surfaces the ${top.length} highest-scoring.`
      : `No individual competencies are measured for ${s.candidate.name}.`,
    assessment: measurable
      ? `Top measured competencies — ${top.slice(0, 8).map((c) => `${c.name}: ${c.score}`).join('; ')}${top.length > 8 ? '…' : ''}.`
      : 'No per-competency scores are available.',
    chart: measurable
      ? { title: 'Per-competency scores (top 20)', data_source: 'competency', chart_type: 'heatmap', ...chart }
      : null,
    interpretation: measurable
      ? 'The heatmap ranks individual competencies by domain-proxy score (each inherits its onto-domain measurement), giving a granular view beneath the domain and type summaries. Use it to pinpoint specific strengths and targeted development items.'
      : 'Per-competency scores are required to render the heatmap.',
    recommendations: measurable
      ? [
          { text: `Strongest competency: ${top[0].name} (${top[0].score}).`, severity: 'positive' },
          ...(top.length > 1 ? [{ text: `Lowest measured: ${top[top.length - 1].name} (${top[top.length - 1].score}).`, severity: 'warning' }] : []),
        ]
      : [],
    confidence_text: measurable
      ? confidenceFromMeasurement(null, num(tp.classification_coverage_pct)).note
      : 'Confidence not applicable — no measured competency scores yet.',
    honest: measurable
      ? null
      : {
          why: 'No measured per-competency scores were found.',
          workflow: 'Score a competency-tagged assessment.',
          needed: 'Measured competencies within type buckets.',
          expected: 'A ranked heatmap of individual competency scores.',
        },
  };
};

const buildStrength: Builder = (s) => {
  const ei = s.engines.ei ?? {};
  const strengths = arr(ei.strength_areas);
  const dims = arr(ei.dimension_scores).filter((d) => d.measurable && num(d.score ?? d.dimension_score) != null);
  const canMeasure = !!ei.measurable && dims.length > 0;
  const measurable = canMeasure; // we can render measured dims even if none reach "Strong"
  const haveStrengths = strengths.length > 0;
  const chartSrc = haveStrengths
    ? strengths.map((d) => ({ name: str(d.dimension_name), v: num(d.score) }))
    : dims
        .map((d) => ({ name: str(d.dimension_name), v: num(d.score ?? d.dimension_score) }))
        .sort((a, b) => (b.v ?? 0) - (a.v ?? 0));
  const chart = measurable ? cleanChart(chartSrc.map((d) => d.name), chartSrc.map((d) => d.v)) : { labels: [], values: [] };

  return {
    key: 'strength',
    report_type: 'strength',
    title: 'Strengths',
    measurable,
    coverage: { pct: num(ei?.overall_ei?.coverage_pct), note: `${dims.length} measurable dimensions.` },
    confidence: { band: str(ei?.confidence?.band), note: 'Confidence band reported by the EI profile engine.' },
    activation: ACTIVATION,
    data_source: 'ei-profile-engine.buildEiProfile → strength_areas (dimensions at/above the Strong band).',
    executive: haveStrengths
      ? `${s.candidate.name} demonstrates ${strengths.length} clear strength${strengths.length === 1 ? '' : 's'}, led by ${str(strengths[0].dimension_name)} (${num(strengths[0].score)}).`
      : canMeasure
        ? `${s.candidate.name} has ${dims.length} measured dimensions; none currently reach the Strong threshold, so the strongest measured areas are shown.`
        : `${s.candidate.name} has no measurable dimensions yet.`,
    assessment: haveStrengths
      ? `Strength areas — ${strengths.map((d) => `${str(d.dimension_name)}: ${num(d.score)} (${str(d.band)})`).join('; ')}.`
      : canMeasure
        ? `Highest measured dimensions — ${chartSrc.slice(0, 5).map((d) => `${d.name}: ${d.v}`).join('; ')}.`
        : 'No measured dimensions are available.',
    chart: measurable ? { title: 'Strength dimensions', data_source: 'employability', chart_type: 'bar', ...chart } : null,
    interpretation: haveStrengths
      ? 'Strengths are dimensions measured at or above the Strong band — reliable areas to leverage. They are developmental signals, not endorsements for any specific role decision.'
      : canMeasure
        ? 'No dimension currently reaches the Strong band; this is an honest measured result, not missing data. The highest measured dimensions are shown as the relative strengths to build on.'
        : 'Measured dimensions are required to identify strengths.',
    recommendations: haveStrengths
      ? strengths.slice(0, 3).map((d) => ({ text: `Leverage ${str(d.dimension_name)} (${num(d.score)}).`, severity: 'positive' }))
      : [],
    confidence_text: ei?.confidence?.band ? `Confidence band: ${str(ei.confidence.band)}.` : 'Confidence not reported.',
    honest: measurable
      ? null
      : {
          why: 'No measurable EI dimensions exist for this candidate.',
          workflow: 'Complete a competency assessment so dimension scoring can run.',
          needed: 'Measurable dimensions in the EI profile.',
          expected: 'A ranked list of strength dimensions at/above the Strong band.',
        },
  };
};

const buildDevelopmentAreas: Builder = (s) => {
  const ei = s.engines.ei ?? {};
  const devs = arr(ei.development_areas);
  const dims = arr(ei.dimension_scores).filter((d) => d.measurable && num(d.score ?? d.dimension_score) != null);
  const measurable = !!ei.measurable && (devs.length > 0 || dims.length > 0);
  const chartSrc = devs.length
    ? devs.map((d) => ({ name: str(d.dimension_name), v: num(d.score) }))
    : dims.map((d) => ({ name: str(d.dimension_name), v: num(d.score ?? d.dimension_score) })).sort((a, b) => (a.v ?? 0) - (b.v ?? 0));
  const chart = measurable ? cleanChart(chartSrc.map((d) => d.name), chartSrc.map((d) => d.v)) : { labels: [], values: [] };

  return {
    key: 'development_areas',
    report_type: 'development_areas',
    title: 'Development Areas',
    measurable,
    coverage: { pct: num(ei?.overall_ei?.coverage_pct), note: `${devs.length} development area${devs.length === 1 ? '' : 's'} identified.` },
    confidence: { band: str(ei?.confidence?.band), note: 'Confidence band reported by the EI profile engine.' },
    activation: ACTIVATION,
    data_source: 'ei-profile-engine.buildEiProfile → development_areas (dimensions below the Strong band, with headroom).',
    executive: devs.length
      ? `${s.candidate.name} has ${devs.length} development area${devs.length === 1 ? '' : 's'}; the most material is ${str(devs[0].dimension_name)} (${num(devs[0].score)}, ${num(devs[0].headroom)} points of headroom).`
      : measurable
        ? `${s.candidate.name}'s measured dimensions are all at/above the Strong band — no development areas below threshold.`
        : `${s.candidate.name} has no measurable dimensions yet.`,
    assessment: devs.length
      ? `Development areas — ${devs.map((d) => `${str(d.dimension_name)}: ${num(d.score)} (${num(d.headroom)} headroom)`).join('; ')}.`
      : measurable
        ? 'All measured dimensions reach the Strong band; no below-threshold development areas.'
        : 'No measured dimensions are available.',
    chart: measurable ? { title: 'Development headroom', data_source: 'employability', chart_type: 'bar', ...chart } : null,
    interpretation: devs.length
      ? 'Development areas are dimensions below the Strong band; headroom is the distance to 100. These prioritise where focused growth yields the most return (see the Action Plan and Learning Roadmap).'
      : measurable
        ? 'No dimension falls below the Strong band — an honest measured result. Continued practice maintains these levels.'
        : 'Measured dimensions are required to identify development areas.',
    recommendations: devs.slice(0, 3).map((d) => ({ text: `Develop ${str(d.dimension_name)} (currently ${num(d.score)}).`, severity: 'warning' })),
    confidence_text: ei?.confidence?.band ? `Confidence band: ${str(ei.confidence.band)}.` : 'Confidence not reported.',
    honest: measurable
      ? null
      : {
          why: 'No measurable EI dimensions exist for this candidate.',
          workflow: 'Complete a competency assessment so dimension scoring can run.',
          needed: 'Measurable dimensions in the EI profile.',
          expected: 'A ranked list of development areas with headroom to the Strong band.',
        },
  };
};

const buildRoleReadiness: Builder = (s) => {
  const rr = s.engines.readiness ?? {};
  const measurable = rr?.readiness?.measured === true && num(rr?.readiness?.score) != null;
  const gaps = arr(rr?.role_gap?.gap_areas);
  const chart = measurable && gaps.length
    ? cleanChart(gaps.map((g) => str(g.competency_name)), gaps.map((g) => num(g.gap)))
    : { labels: [], values: [] };

  return {
    key: 'role_readiness',
    report_type: 'role_readiness',
    title: 'Role Readiness',
    measurable,
    coverage: { pct: num(rr?.readiness?.coverage_pct), note: measurable ? 'Readiness measured against role requirements.' : 'Role requirements not mapped.' },
    confidence: { band: measurable ? 'Moderate' : null, note: measurable ? 'Computed against the resolved role profile.' : 'No mapped role-requirement substrate.' },
    activation: ACTIVATION,
    data_source: 'role-readiness-v2.computeRoleReadinessV2 → resolved role profile vs candidate competency scores.',
    executive: measurable
      ? `${s.candidate.name}'s readiness for ${str(rr.role_title) ?? MX301_ROLE_TITLE} is ${num(rr.readiness.score)}/100 (${str(rr.readiness.band) ?? 'band pending'}).`
      : `Role readiness for ${MX301_ROLE_TITLE} cannot be measured: the resolved role title does not map to a profiled role with stored competency requirements.`,
    assessment: measurable
      ? `Readiness ${num(rr.readiness.score)}/100, fit band ${str(rr?.role_match?.fit_band) ?? '—'}, ${arr(rr?.role_gap?.critical_gaps).length} critical gap(s), ${num(rr?.role_gap?.blocking_gaps) ?? 0} blocking.`
      : 'No readiness score is available because the role lacks a stored requirement profile on this path.',
    chart: measurable && gaps.length
      ? { title: 'Role gap by competency', data_source: 'career', chart_type: 'bar', ...chart }
      : null,
    interpretation: measurable
      ? 'Readiness compares measured capability to the role’s required competency levels. Critical and blocking gaps cap readiness regardless of average score. This is a developmental signal, not a hiring or promotion decision.'
      : 'The employer competency match report reaches role requirements via a different path (generateRoleDNA over the genome) and does compute a match — the divergence is a real platform finding, surfaced honestly rather than estimated here.',
    recommendations: measurable
      ? gaps.slice(0, 3).map((g) => ({ text: `Close gap in ${str(g.competency_name)} (need level ${lvl(g.required_level)}, currently ${lvl(g.actual_level)}).`, severity: 'warning' }))
      : [],
    confidence_text: measurable ? 'Confidence: Moderate — measured against the resolved role profile.' : 'Confidence not applicable — role requirements unmapped on this path.',
    honest: measurable
      ? null
      : {
          why: `"${MX301_ROLE_TITLE}" does not resolve to a profiled role with stored competency requirements on the Role-Readiness path.`,
          workflow: 'Map the target role to a profiled onto_role with stored requirement levels (Role DNA governance).',
          needed: 'A role profile with required competency levels for the target role.',
          expected: 'A readiness score with per-competency gaps, fit band, and critical/blocking gap counts.',
        },
  };
};

const buildPromotionReadiness: Builder = (s) => {
  const pr = s.engines.progression ?? {};
  const ready = pr?.overall?.status === 'ready';
  const measurable = ready;
  const dims = arr(pr.dimensions).filter((d) => num(d.net_delta) != null);
  const chart = measurable && dims.length
    ? cleanChart(dims.map((d) => str(d.dimension_name)), dims.map((d) => num(d.net_delta)))
    : { labels: [], values: [] };

  return {
    key: 'promotion_readiness',
    report_type: 'promotion_readiness',
    title: 'Promotion Readiness',
    measurable,
    coverage: {
      pct: null,
      note: `${num(pr?.overall?.snapshots_measured) ?? 0}/${num(pr?.overall?.snapshots_total) ?? 0} measured snapshots (≥2 required).`,
    },
    confidence: { band: measurable ? 'Moderate' : null, note: 'Confidence rises with the number of measured snapshots over time.' },
    activation: ACTIVATION,
    data_source: 'progression-engine.buildProgression → ei_profile_snapshots over time (net delta between measured snapshots).',
    executive: measurable
      ? `${s.candidate.name} has ${num(pr.overall.snapshots_measured)} measured snapshots; net movement is ${round(num(pr.overall.net_delta))} (${str(pr.overall.direction) ?? 'flat'}).`
      : `Promotion readiness requires at least two measured snapshots over time; ${s.candidate.name} currently has ${num(pr?.overall?.snapshots_measured) ?? 0}.`,
    assessment: measurable
      ? `Status: ready. Net delta ${round(num(pr.overall.net_delta))}. Growth areas: ${arr(pr?.rollup?.growth_areas).length}, decline: ${arr(pr?.rollup?.decline_areas).length}, stable: ${arr(pr?.rollup?.stable_areas).length}.`
      : `Status: insufficient_history — trend cannot be computed from a single snapshot.`,
    chart: measurable && dims.length
      ? { title: 'Net change by dimension', data_source: 'employability', chart_type: 'bar', ...chart }
      : null,
    interpretation: measurable
      ? 'Promotion readiness is a longitudinal signal: it measures sustained movement across dimensions between measured snapshots, not a single score. Positive net delta with broad growth areas indicates upward trajectory.'
      : 'A trajectory needs at least two measured points in time. With one snapshot the platform reports insufficient history rather than inferring a trend.',
    recommendations: measurable
      ? arr(pr?.rollup?.decline_areas).slice(0, 3).map((d: any) => ({ text: `Reinforce ${str(d.dimension_name) ?? str(d)} (declining).`, severity: 'warning' }))
      : [],
    confidence_text: measurable ? 'Confidence: Moderate — based on measured snapshots; rises as more are captured.' : 'Confidence not applicable — insufficient history.',
    honest: measurable
      ? null
      : {
          why: 'Fewer than two measured EI snapshots exist, so no trajectory can be computed.',
          workflow: 'Re-assess over time so a second measured snapshot is captured (persistEiProfile).',
          needed: 'At least two measured snapshots in ei_profile_snapshots.',
          expected: 'A net-delta trend per dimension with a ready/insufficient verdict.',
        },
  };
};

const buildEmployabilityIndex: Builder = (s) => {
  const emp = s.engines.employability ?? {};
  const sum = emp.summary ?? {};
  const dims = arr(emp.dimension_scores).filter((d) => d.measurable && num(d.dimension_score ?? d.score) != null);
  const measurable = !!emp.measurable && num(sum.ei_score) != null;
  const chart = measurable && dims.length
    ? cleanChart(dims.map((d) => str(d.dimension_name)), dims.map((d) => num(d.dimension_score ?? d.score)))
    : { labels: [], values: [] };

  return {
    key: 'employability_index',
    report_type: 'employability_index',
    title: 'Employability Index',
    measurable,
    coverage: { pct: num(sum.coverage_pct), note: `${num(sum.dimensions_measurable) ?? 0}/${num(sum.dimensions_total) ?? 0} dimensions measurable.` },
    confidence: { band: str(sum?.confidence?.band), note: 'Confidence band reported by the employability scoring engine.' },
    activation: ACTIVATION,
    data_source: 'employability-scoring-engine.computeEmployabilityScore → competency → dimension → EI roll-up.',
    executive: measurable
      ? `${s.candidate.name}'s Employability Index is ${num(sum.ei_score)}/100 (${str(sum.ei_band) ?? 'band pending'}), from ${num(sum.dimensions_measurable)} measurable dimensions.`
      : `${s.candidate.name}'s Employability Index is not yet measurable.`,
    assessment: measurable
      ? `EI ${num(sum.ei_score)}/100 (${str(sum.ei_band)}); coverage ${num(sum.coverage_pct) ?? 0}%. Dimension scores — ${dims.map((d) => `${str(d.dimension_name)}: ${num(d.dimension_score ?? d.score)}`).join('; ')}.`
      : 'No measurable dimensions are available.',
    chart: measurable && dims.length
      ? { title: 'Employability dimensions', data_source: 'employability', chart_type: 'bar', ...chart }
      : null,
    interpretation: measurable
      ? 'The Employability Index aggregates dimension scores derived from measured competencies. It is a developmental indicator of overall job-readiness signal strength, not a hiring or promotion prediction.'
      : 'Measurable dimensions are required before an Employability Index can be computed.',
    recommendations: measurable ? topAndBottom(dims, 'dimension_name', 'dimension_score') : [],
    confidence_text: sum?.confidence?.band ? `Confidence band: ${str(sum.confidence.band)} (coverage ${num(sum.coverage_pct) ?? 0}%).` : 'Confidence not reported.',
    honest: measurable
      ? null
      : {
          why: 'No measurable employability dimensions for this candidate.',
          workflow: 'Complete a competency assessment so the dimension roll-up can run.',
          needed: 'Measurable dimensions in the employability engine.',
          expected: 'An Employability Index with per-dimension scores and a coverage figure.',
        },
  };
};

const buildCareerRecs: Builder = (s) => {
  const rec = s.engines.recommendations ?? {};
  const items = flattenRecommendationObjects(rec);
  const measurable = !!rec.measurable && items.length > 0;
  return {
    key: 'career_recommendations',
    report_type: 'career_recommendations',
    title: 'Career Recommendations',
    measurable,
    coverage: { pct: null, note: `${num(rec?.summary?.total_recommendations) ?? items.length} recommendation(s), ${num(rec?.summary?.personalized_count) ?? 0} personalized.` },
    confidence: { band: items[0]?.confidence_band ? str(items[0].confidence_band) : (measurable ? 'Provisional' : null), note: 'Per-recommendation confidence bands shown inline.' },
    activation: ACTIVATION,
    data_source: 'career-recommendation-aggregator.buildCareerRecommendations → composed from competency, gap and market signals.',
    executive: measurable
      ? `${items.length} recommendation${items.length === 1 ? '' : 's'} are available for ${s.candidate.name}, ${num(rec?.summary?.personalized_count) ?? 0} personalized to their profile.`
      : `No career recommendations have been derived for ${s.candidate.name} yet.`,
    assessment: measurable
      ? `Recommendations span ${new Set(items.map((i) => i.rec_type).filter(Boolean)).size} type(s). Top item: ${str(items[0].title) ?? str(items[0].action)}.`
      : 'No recommendations are available.',
    chart: null,
    interpretation: measurable
      ? 'Recommendations are derived developmental suggestions ranked by relevance. Personalized items consume the candidate’s own profile; catalog items are general and flagged as provisional. None are directives.'
      : 'Recommendations appear once measured competency and gap signals exist to ground them.',
    recommendations: measurable
      ? items.slice(0, 8).map((i) => ({
          text: `${str(i.title) ?? str(i.action) ?? str(i.rec_key)}${i.description ? ` — ${str(i.description)}` : ''}${i.personalized ? '' : ' (general)'}`,
          severity: i.priority && String(i.priority).toLowerCase().includes('high') ? 'warning' : 'info',
        }))
      : [],
    confidence_text: measurable ? 'Confidence varies per recommendation; personalized items inherit the chain confidence, catalog items are Provisional.' : 'Confidence not applicable — no recommendations yet.',
    honest: measurable
      ? null
      : {
          why: 'No recommendations were produced from the current measured inputs.',
          workflow: 'Complete competency and gap analysis so recommendations can be grounded.',
          needed: 'Measured competency + gap signals.',
          expected: 'A ranked list of personalized and general career recommendations.',
        },
  };
};

const buildLearningRoadmap: Builder = (s) => {
  const rm = s.engines.roadmap ?? {};
  const milestones = arr(rm.milestones);
  const plan = arr(rm.development_plan);
  const measurable = milestones.length > 0 || plan.length > 0;
  const chart = milestones.length
    ? cleanChart(milestones.map((m) => str(m.label) ?? `Phase ${num(m.sequence)}`), milestones.map((m) => num(m.estimated_weeks) ?? num(m.total_gap_points)))
    : { labels: [], values: [] };

  return {
    key: 'learning_roadmap',
    report_type: 'learning_roadmap',
    title: 'Learning Roadmap',
    measurable,
    coverage: { pct: null, note: `${milestones.length} milestone(s), ${plan.length} development item(s).` },
    confidence: { band: measurable ? 'Provisional' : null, note: 'Roadmap composes role requirements and measured gaps.' },
    activation: ACTIVATION,
    data_source: 'career-roadmap-engine.buildCareerRoadmap → milestones + development plan from gaps and role requirements.',
    executive: measurable
      ? `${s.candidate.name}'s roadmap has ${milestones.length} milestone${milestones.length === 1 ? '' : 's'}${wkClause(rm?.timeline?.total_estimated_weeks)}.`
      : `A learning roadmap could not be composed for ${s.candidate.name} — no role-requirement substrate to sequence against.`,
    assessment: measurable
      ? `Milestones — ${milestones.map((m) => `${str(m.label) ?? `Phase ${num(m.sequence)}`} (${num(m.competency_count) ?? 0} comps${wkSuffix(m.estimated_weeks)})`).join('; ')}.`
      : 'No milestones are available.',
    chart: milestones.length
      ? { title: 'Estimated weeks per milestone', data_source: 'career', chart_type: 'bar', ...chart }
      : null,
    interpretation: measurable
      ? 'The roadmap sequences development into time-boxed milestones ordered by priority band. Estimated effort is derived from the size of the competency gaps each milestone addresses.'
      : 'Sequencing a roadmap requires a profiled role with stored requirements so gaps can be ordered; without it the platform reports the absence honestly.',
    recommendations: milestones.slice(0, 3).map((m) => ({ text: `${str(m.label) ?? `Phase ${num(m.sequence)}`}: ${num(m.competency_count) ?? 0} competencies${num(m.estimated_weeks) != null ? `, ~${num(m.estimated_weeks)} weeks` : ''}.`, severity: 'info' })),
    confidence_text: measurable ? 'Confidence: Provisional — sequence and effort estimates depend on requirement coverage.' : 'Confidence not applicable — no roadmap could be composed.',
    honest: measurable
      ? null
      : {
          why: 'No role-requirement substrate exists to sequence milestones against.',
          workflow: 'Map the target role to stored competency requirements, then re-run gap analysis.',
          needed: 'A profiled role with requirements and measured gaps.',
          expected: 'Time-boxed milestones with estimated effort and a development plan.',
        },
  };
};

const buildSkillGap: Builder = (s) => {
  const gap = s.engines.gap ?? {};
  const items: any[] = [];
  for (const b of values(gap.buckets)) for (const it of arr(b?.items)) items.push(it);
  for (const it of arr(gap.unclassified)) items.push(it);
  items.sort((a, b) => (num(b.gap) ?? 0) - (num(a.gap) ?? 0));
  const measurable = !!gap.measurable && items.length > 0;
  const top = items.slice(0, 15);
  const chart = measurable ? cleanChart(top.map((g) => str(g.competency_name)), top.map((g) => num(g.gap))) : { labels: [], values: [] };

  return {
    key: 'skill_gap',
    report_type: 'skill_gap',
    title: 'Skill Gap',
    measurable,
    coverage: { pct: num(gap?.summary?.classified_pct), note: `${num(gap?.summary?.total_gaps) ?? items.length} gap(s), ${num(gap?.summary?.total_critical) ?? 0} critical.` },
    confidence: { band: measurable ? 'Provisional' : null, note: 'Gaps compose measured scores against role requirements.' },
    activation: ACTIVATION,
    data_source: 'career-gap-engine.buildCareerGap → required vs actual competency levels.',
    executive: measurable
      ? `${s.candidate.name} has ${num(gap?.summary?.total_gaps) ?? items.length} skill gap(s); the most material is ${str(gap?.summary?.most_material?.competency_name) ?? str(top[0]?.competency_name)}.`
      : `No skill gaps could be computed for ${s.candidate.name} — no role-requirement substrate to compare against.`,
    assessment: measurable
      ? `Largest gaps — ${top.slice(0, 8).map((g) => `${str(g.competency_name)}: need ${lvl(g.required_level)}, currently ${lvl(g.actual_level)} (gap ${lvl(g.gap)})`).join('; ')}.`
      : 'No gaps are available.',
    chart: measurable ? { title: 'Gap size by competency', data_source: 'career', chart_type: 'bar', ...chart } : null,
    interpretation: measurable
      ? 'A gap is the distance between a required competency level and the measured level. Critical and blocking gaps are prioritised in the Action Plan and Learning Roadmap. Gaps are developmental, not disqualifying.'
      : 'Computing gaps requires a profiled role with stored requirements; without it the platform reports no measurable gaps rather than inventing them.',
    recommendations: top.slice(0, 3).map((g) => ({ text: `Close gap in ${str(g.competency_name)} (need ${lvl(g.required_level)}, currently ${lvl(g.actual_level)}).`, severity: g.blocking ? 'critical' : 'warning' })),
    confidence_text: measurable ? 'Confidence: Provisional — depends on requirement coverage and measurement granularity.' : 'Confidence not applicable — no gaps could be computed.',
    honest: measurable
      ? null
      : {
          why: 'No role-requirement substrate exists to compare measured scores against.',
          workflow: 'Map the target role to stored competency requirements.',
          needed: 'A profiled role with required levels + measured competency scores.',
          expected: 'A ranked list of competency gaps with required vs actual levels and criticality.',
        },
  };
};

const buildInterviewReadiness: Builder = (s) => {
  const ev = s.engines.evaluation ?? {};
  const data = ev?.data ?? {};
  const criteria = arr(data.criteria).filter((c) => num(c.mean_pct) != null);
  const measurable = (ev?.ok !== false) && num(data.total_scores) != null && (num(data.total_scores) ?? 0) > 0;
  const chart = measurable && criteria.length
    ? cleanChart(criteria.map((c) => str(c.criterion)), criteria.map((c) => num(c.mean_pct)))
    : { labels: [], values: [] };

  return {
    key: 'interview_readiness',
    report_type: 'interview_readiness',
    title: 'Interview Readiness',
    measurable,
    coverage: { pct: null, note: measurable ? `${num(data.total_scores)} score(s) across ${num(data.interviews_scored) ?? 0} interview(s).` : 'No interview captured.' },
    confidence: { band: measurable ? 'Operator-recorded' : null, note: 'Interview summaries average operator-entered scores; not an algorithmic verdict.' },
    activation: ACTIVATION,
    data_source: 'evaluation-engine.candidateEvaluation → interview_scores (operator/panelist entries, averaged per criterion).',
    executive: measurable
      ? `${s.candidate.name} has ${num(data.total_scores)} recorded interview score(s); overall operator mean is ${pctOrPhrase(data.overall_mean_pct)}.`
      : `No interview has been captured for ${s.candidate.name}, so interview readiness is not yet measurable.`,
    assessment: measurable
      ? `Overall mean ${pctOrPhrase(data.overall_mean_pct)} across ${num(data.distinct_panelists) ?? 0} panelist(s). Per criterion — ${criteria.map((c) => `${str(c.criterion)}: ${pctOrPhrase(c.mean_pct)}`).join('; ')}.`
      : 'No interview scores are available.',
    chart: measurable && criteria.length
      ? { title: 'Interview scores by criterion', data_source: 'career', chart_type: 'bar', ...chart }
      : null,
    interpretation: measurable
      ? 'Interview readiness summarises operator-recorded panelist scores per criterion. These are arithmetic averages of human inputs — a record of what panelists entered, NOT an algorithmic hire/reject verdict.'
      : 'Interview readiness becomes measurable once an interview is scheduled and at least one panelist score is recorded.',
    recommendations: measurable
      ? criteria
          .filter((c) => (num(c.mean_pct) ?? 100) < 60)
          .slice(0, 3)
          .map((c) => ({ text: `Strengthen interview performance on ${str(c.criterion)} (${num(c.mean_pct)}%).`, severity: 'warning' }))
      : [],
    confidence_text: measurable ? 'Operator-recorded — averages of panelist-entered scores, not a model prediction.' : 'Confidence not applicable — no interview captured.',
    honest: measurable
      ? null
      : {
          why: 'No interview was scheduled or scored for this candidate.',
          workflow: 'Schedule an interview and record panelist scores (scheduleInterview → recordScore).',
          needed: 'At least one recorded interview score in interview_scores.',
          expected: 'Per-criterion operator score means with an overall interview summary.',
        },
  };
};

const buildEmployerMatch: Builder = (s) => {
  const m = s.engines.match ?? {};
  const measurable = m?.competencyProfileAvailable === true && num(m.competencyMatch) != null;
  const reqs = arr(m.requirements);
  const gaps = arr(m.gaps);
  const metrics: { label: string; value: number }[] = [];
  if (num(m.competencyMatch) != null) metrics.push({ label: 'Competency Match %', value: num(m.competencyMatch) as number });
  if (num(m.requirementCoveragePct) != null) metrics.push({ label: 'Requirement Coverage %', value: num(m.requirementCoveragePct) as number });
  const chart = measurable && metrics.length ? cleanChart(metrics.map((x) => x.label), metrics.map((x) => x.value)) : { labels: [], values: [] };

  return {
    key: 'employer_competency_match',
    report_type: 'employer_competency_match',
    title: 'Employer Competency Match',
    measurable,
    coverage: { pct: num(m.requirementCoveragePct), note: `${num(m.matchedRequirementCount) ?? 0}/${num(m.totalRequirementCount) ?? 0} requirements matched.` },
    confidence: { band: str(m?.calibration?.state) === 'calibrated' ? 'Calibrated' : (measurable ? 'Provisional' : null), note: 'Fit signal is decision-support only; calibration state reflects realized-outcome history.' },
    activation: ACTIVATION,
    data_source: 'employer-competency-hiring.computeCompetencyDrivenMatch → Role DNA (genome) requirements vs candidate competencies.',
    executive: measurable
      ? `${s.candidate.name}'s competency match to ${MX301_ROLE_TITLE} is ${num(m.competencyMatch)}%, covering ${num(m.matchedRequirementCount) ?? 0}/${num(m.totalRequirementCount) ?? 0} requirements (fit: ${str(m?.fitSignal?.band) ?? 'withheld'}).`
      : `An employer competency match could not be computed for ${s.candidate.name}.`,
    assessment: measurable
      ? `Match ${num(m.competencyMatch)}%, coverage ${num(m.requirementCoveragePct) ?? 0}%. Fit signal: ${str(m?.fitSignal?.band) ?? 'withheld'}${m?.fitSignal?.provisional ? ' (provisional)' : ''}. Calibration: ${str(m?.calibration?.state) ?? 'n/a'}. ${gaps.length} requirement gap(s).`
      : 'No match data is available.',
    chart: measurable && metrics.length
      ? { title: 'Match vs requirement coverage', data_source: 'competency', chart_type: 'bar', ...chart }
      : null,
    interpretation: measurable
      ? 'The match contrasts the candidate’s measured competencies with the role’s genome-derived requirements. The fit signal is decision-SUPPORT only — never a hire/no-hire verdict. Calibration reports whether realized outcomes back the signal.'
      : 'A match requires a measured competency profile and resolvable role requirements.',
    recommendations: measurable
      ? gaps.slice(0, 3).map((g: any) => ({ text: `Requirement gap: ${str(g.competency_name) ?? str(g.name)} (need ${lvl(g.required_level)}, currently ${lvl(g.actual_level)}).`, severity: 'warning' }))
      : [],
    confidence_text: measurable
      ? `Calibration: ${str(m?.calibration?.state) ?? 'uncalibrated'}${num(m?.calibration?.realizedOutcomes) != null ? ` (${num(m.calibration.realizedOutcomes)} realized outcomes)` : ''}. The fit signal is decision-support, not a verdict.`
      : 'Confidence not applicable — no match computed.',
    honest: measurable
      ? null
      : {
          why: 'No measured competency profile or no resolvable role requirements for the match.',
          workflow: 'Ensure the candidate has a scored competency profile and the role resolves to genome requirements.',
          needed: 'A measured competency profile + role DNA requirements.',
          expected: 'A competency match %, requirement coverage, fit signal and calibration state.',
        },
  };
};

const buildCareerPassport: Builder = (s) => {
  const pp = s.engines.passport ?? {};
  const sectionsObj = pp.sections ?? {};
  const entries = Object.entries(sectionsObj).map(([k, v]: [string, any]) => ({ key: k, present: !!v?.present }));
  const measurable = !!pp.measurable && entries.some((e) => e.present);
  const chart = entries.length
    ? cleanChart(entries.map((e) => e.key.replace(/_/g, ' ')), entries.map((e) => (e.present ? 1 : 0)))
    : { labels: [], values: [] };

  return {
    key: 'career_passport',
    report_type: 'career_passport',
    title: 'Career Passport',
    measurable,
    coverage: { pct: num(pp?.coverage?.coverage_pct), note: `${num(pp?.coverage?.sections_present) ?? 0}/${num(pp?.coverage?.sections_total) ?? 0} sections present.` },
    confidence: { band: measurable ? 'Moderate' : null, note: 'Passport composes already-computed platform artifacts; contact details are never published.' },
    activation: ACTIVATION,
    data_source: 'passport-generator.generateCareerPassport → composed snapshot of competency, EI, career and journey artifacts.',
    executive: measurable
      ? `${s.candidate.name}'s career passport has ${num(pp?.coverage?.sections_present) ?? 0} of ${num(pp?.coverage?.sections_total) ?? 0} sections populated (${num(pp?.coverage?.coverage_pct) ?? 0}% coverage).`
      : `A career passport could not be populated for ${s.candidate.name} yet.`,
    assessment: entries.length
      ? `Section status — ${entries.map((e) => `${e.key.replace(/_/g, ' ')}: ${e.present ? 'present' : 'absent'}`).join('; ')}.`
      : 'No passport sections are available.',
    chart: entries.length
      ? { title: 'Passport section coverage (1 = present)', data_source: 'passport', chart_type: 'bar', ...chart }
      : null,
    interpretation: measurable
      ? 'The career passport is a shareable, composed snapshot of the candidate’s verified platform artifacts. Each present section reflects a completed workflow; absent sections indicate workflows not yet completed. Contact details are never included in the published view.'
      : 'The passport populates as the underlying workflows (assessment, EI, career planning) are completed.',
    recommendations: entries.filter((e) => !e.present).slice(0, 3).map((e) => ({ text: `Complete the ${e.key.replace(/_/g, ' ')} workflow to populate this passport section.`, severity: 'info' })),
    confidence_text: measurable ? 'Confidence: Moderate — composed from completed platform artifacts.' : 'Confidence not applicable — no sections populated.',
    honest: measurable
      ? null
      : {
          why: 'No passport sections are populated for this candidate.',
          workflow: 'Complete the upstream workflows (competency, EI, career planning) that feed the passport.',
          needed: 'At least one completed upstream artifact.',
          expected: 'A composed passport with present/absent status per section.',
        },
  };
};

const buildActionPlan: Builder = (s) => {
  const dev = s.engines.development ?? {};
  const streams = arr(dev?.development_plan?.streams);
  const tracking = dev?.tracking ?? {};
  const measurable = streams.length > 0;
  const chart = measurable
    ? cleanChart(streams.map((st) => str(st.label) ?? str(st.type_key)), streams.map((st) => num(st.total_gap_points) ?? num(st.estimated_weeks)))
    : { labels: [], values: [] };

  return {
    key: 'action_plan',
    report_type: 'action_plan',
    title: 'Action Plan',
    measurable,
    coverage: { pct: null, note: `${streams.length} development stream(s).` },
    confidence: { band: measurable ? 'Provisional' : null, note: 'Action plan composes role requirements, gaps and development streams.' },
    activation: ACTIVATION,
    data_source: 'career-development-engine.buildCareerDevelopment → development streams + tracking from gaps and requirements.',
    executive: measurable
      ? `${s.candidate.name}'s action plan organises development into ${streams.length} stream${streams.length === 1 ? '' : 's'}${tracking?.has_baseline ? ' with a tracking baseline' : ''}.`
      : `An action plan could not be composed for ${s.candidate.name} — no development streams to organise.`,
    assessment: measurable
      ? `Streams — ${streams.map((st) => `${str(st.label) ?? str(st.type_key)} (${num(st.competency_count) ?? 0} comps${wkSuffix(st.estimated_weeks)})`).join('; ')}.`
      : 'No development streams are available.',
    chart: measurable ? { title: 'Effort by development stream', data_source: 'career', chart_type: 'bar', ...chart } : null,
    interpretation: measurable
      ? 'The action plan groups development into themed streams, each addressing a cluster of related gaps with a now/next/later horizon. Tracking compares effort over time once a baseline exists.'
      : 'An action plan needs development streams derived from measured gaps against a profiled role; without that substrate the platform reports the absence honestly.',
    recommendations: streams.slice(0, 3).map((st) => ({ text: `${str(st.label) ?? str(st.type_key)}: ${str(st.purpose) ?? `${num(st.competency_count) ?? 0} competencies to develop`}.`, severity: 'info' })),
    confidence_text: measurable ? 'Confidence: Provisional — depends on gap and requirement coverage.' : 'Confidence not applicable — no streams composed.',
    honest: measurable
      ? null
      : {
          why: 'No development streams could be composed (no measured gaps against a profiled role).',
          workflow: 'Map the role to stored requirements and run gap analysis so streams can form.',
          needed: 'Measured gaps against role requirements.',
          expected: 'Themed development streams with effort estimates and tracking.',
        },
  };
};

// ── recommendation flattening helpers ───────────────────────────────────────
function flattenRecommendationObjects(rec: any): any[] {
  const out: any[] = [];
  if (Array.isArray(rec?.recommendations)) out.push(...rec.recommendations);
  for (const g of arr(rec?.groups)) {
    out.push(...arr(g?.recommendations), ...arr(g?.items));
  }
  // de-dup by rec_key/title
  const seen = new Set<string>();
  return out.filter((r) => {
    const k = String(r?.rec_key ?? r?.title ?? JSON.stringify(r));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function flattenRecommendations(rec: any): string[] {
  return flattenRecommendationObjects(rec)
    .map((r) => str(r?.title) ?? str(r?.action) ?? str(r?.rec_key))
    .filter((x): x is string => !!x);
}

// top + bottom item as positive/warning insights for a numeric field
function topAndBottom(items: any[], nameKey: string, scoreKey: string): { text: string; severity: string }[] {
  const clean = items
    .map((i) => ({ name: str(i[nameKey]) ?? str(i.onto_domain) ?? str(i.type_key), v: num(i[scoreKey]) }))
    .filter((i) => i.name != null && i.v != null)
    .sort((a, b) => (b.v as number) - (a.v as number));
  if (clean.length === 0) return [];
  const out = [{ text: `Strongest: ${clean[0].name} (${clean[0].v}).`, severity: 'positive' }];
  if (clean.length > 1) out.push({ text: `Development priority: ${clean[clean.length - 1].name} (${clean[clean.length - 1].v}).`, severity: 'warning' });
  return out;
}

// ── The 16-report registry (stable order) ───────────────────────────────────
const BUILDERS: Builder[] = [
  buildExecutiveSummary,
  buildCompetencyProfile,
  buildCompetencyRadar,
  buildCompetencyHeatmap,
  buildStrength,
  buildDevelopmentAreas,
  buildRoleReadiness,
  buildPromotionReadiness,
  buildEmployabilityIndex,
  buildCareerRecs,
  buildLearningRoadmap,
  buildSkillGap,
  buildInterviewReadiness,
  buildEmployerMatch,
  buildCareerPassport,
  buildActionPlan,
];

export function composePack(snapshot: PackSnapshot): ComposedReport[] {
  return BUILDERS.map((b) => composeReport(b(snapshot), snapshot.candidate, snapshot.generated_at));
}

// ── No-empty validation guard ───────────────────────────────────────────────
// Founder requirement: NO placeholder content anywhere in a deliverable.
// Catches "?w" / "~?" effort stubs, lorem ipsum, TBD/TODO/N/A, bare "?%" AND any
// leaked literal null/undefined/NaN from a nullable value interpolated into prose.
const PLACEHOLDER_RE = /(~\?|\?w\b|\bTBD\b|\bTODO\b|\bN\/A\b|\blorem\b|\bplaceholder\b|\s\?%|\bnull\b|\bundefined\b|\bNaN\b)/i;

const REQUIRED_SECTION_TITLES = [
  'Executive Summary',
  'Candidate Information',
  'Assessment Summary',
  'Visualizations',
  'Interpretation',
  'Recommendations',
  'Confidence Level',
  'Data Source',
  'Generated Timestamp',
];

export function validateReport(report: ComposedReport): string[] {
  const violations: string[] = [];
  const sections = report.generated_content?.sections ?? [];
  if (sections.length !== 9) {
    violations.push(`${report.key}: expected 9 sections, got ${sections.length}`);
  }
  for (let i = 0; i < REQUIRED_SECTION_TITLES.length; i++) {
    const sec = sections[i];
    const expected = REQUIRED_SECTION_TITLES[i];
    if (!sec) {
      violations.push(`${report.key}: missing section "${expected}"`);
      continue;
    }
    if (String(sec.title) !== expected) {
      violations.push(`${report.key}: section ${i + 1} is "${sec.title}", expected "${expected}"`);
    }
    const type = String(sec.type);
    if (type === 'narrative') {
      if (!str(sec.text)) violations.push(`${report.key}: "${expected}" narrative is empty`);
      else if (PLACEHOLDER_RE.test(String(sec.text))) violations.push(`${report.key}: "${expected}" narrative contains a placeholder marker`);
    } else if (type === 'chart') {
      const labels = sec.resolved_data?.labels ?? [];
      const data = sec.resolved_data?.datasets?.[0]?.data ?? [];
      if (labels.length === 0 || data.length === 0) violations.push(`${report.key}: "${expected}" chart has no data`);
    } else if (type === 'insight') {
      if (arr(sec.insights).length === 0) violations.push(`${report.key}: "${expected}" insight list is empty`);
      else if (arr(sec.insights).some((ins: any) => PLACEHOLDER_RE.test(String(ins?.text ?? ins?.title ?? '')))) {
        violations.push(`${report.key}: "${expected}" insight contains a placeholder marker`);
      }
    } else {
      violations.push(`${report.key}: "${expected}" has unexpected section type "${type}"`);
    }
  }
  return violations;
}

export function validatePack(reports: ComposedReport[]): string[] {
  const v: string[] = [];
  if (reports.length !== 16) v.push(`expected 16 reports, got ${reports.length}`);
  for (const r of reports) v.push(...validateReport(r));
  return v;
}
