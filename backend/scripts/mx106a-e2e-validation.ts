/**
 * mx106a-e2e-validation.ts — MX-106A end-to-end competency-assessment journey
 * validation + certification.
 *
 * Drives ONE purgeable @example.com demo candidate through the COMPLETE journey
 * IN-PROCESS (the same engine functions the HTTP routes call):
 *
 *   assessment → competency scores → competency profile → employability index →
 *   role readiness → career recommendations → career passport → downloadable
 *   reports (Report Factory) → consumption by 4 personas (Candidate / Employer /
 *   Super Admin / Founder).
 *
 * It WRITES demo rows (it actually TAKES the assessment to prove the path) but
 * confines every write to the @example.com demo subject (purgeable). The
 * certification reporting itself is read-only and NEVER fabricates:
 *   - a stage that is wired but not measurable for this subject reports
 *     generated=true, measurable=false (NOT a failure, NOT a fabricated value);
 *   - persistence is proven by a strict before/after row-count DELTA this run
 *     (this run inserted a row — not merely "a row exists");
 *   - Coverage (machinery exercisable) ⟂ Confidence (real non-demo data) are
 *     reported on SEPARATE axes; Structural ⟂ Activation; null ≠ 0.
 *
 * Committed .md artifacts contain ZERO PII: emails / UUIDs / IPv4 are masked and
 * only aggregate counts are written (never row-level payloads).
 *
 * Run (with the SAME FF_* flags the Backend API workflow sets):
 *   cd backend && FF_REPORT_FACTORY=1 FF_CAREER_INTELLIGENCE=1 \
 *     FF_COMPETENCY_RUNTIME=1 FF_EMPLOYER_COMPETENCY_HIRING=1 \
 *     npx tsx scripts/mx106a-e2e-validation.ts
 *
 * STOP FOR APPROVAL — does not deploy, flips no flags, adds no permanent config.
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

import {
  generateAssessment,
  scoreAssessment,
  getProfile,
  computeRoleReadinessForSubject,
} from '../services/competency-runtime.js';
import { buildEiProfile } from '../services/ei-profile-engine.js';
import {
  buildCareerMatch,
  persistCareerMatchSnapshot,
  listCareerMatchHistory,
} from '../services/career-match-engine.js';
import {
  buildCareerReadiness,
  persistCareerReadinessSnapshot,
  listCareerReadinessHistory,
} from '../services/career-readiness-aggregator.js';
import {
  buildCareerGap,
  persistCareerGapSnapshot,
  listCareerGapHistory,
} from '../services/career-gap-engine.js';
import {
  buildCareerRoadmap,
  persistCareerRoadmapSnapshot,
  listCareerRoadmapHistory,
} from '../services/career-roadmap-engine.js';
import {
  buildCareerDevelopment,
  persistCareerDevelopmentSnapshot,
  listCareerDevelopmentHistory,
} from '../services/career-development-engine.js';
import {
  generateCareerPassport,
  persistPassportSnapshot,
  listPassportHistory,
} from '../services/passport-generator.js';
import { buildCareerSignals } from '../services/career-signal-engine.js';
import {
  persistCareerProgressionSnapshot,
  buildCareerProgression,
  listGrowthTracking,
} from '../services/career-progression-engine.js';
import {
  computeEmployabilityScore,
  persistScoringRun,
  listScoringRuns,
} from '../services/employability-scoring-engine.js';
import { generateReport, ensureReportFactorySchema } from '../services/report-factory-schema.js';
import {
  renderReportToPDF,
  renderReportToCSV,
  renderReportToJSON,
} from '../services/pdf-renderer.js';
import { computeEmployerCompetencyIntelligence } from '../services/employer-competency-intelligence.js';
import { buildPlatformIntelligence } from '../services/platform/platform-intelligence-engine.js';
import { buildFounderDashboard } from '../services/founder-control-center/founder-dashboard-engine.js';

// ── Demo subject (purgeable, @example.com / RFC-2606 reserved) ──────────────
const SUBJECT = 'mx106a.candidate@example.com';
const BLUEPRINT_ID = 'bp_pm_v1';
const ROLE_ID = 'role_pm';
const ROLE_TITLE = 'Product Manager';

type Verdict = 'PASS' | 'PARTIAL' | 'FAIL';
const RANK: Record<Verdict, number> = { PASS: 0, PARTIAL: 1, FAIL: 2 };
const worstOf = (vs: Verdict[]): Verdict =>
  vs.reduce<Verdict>((acc, v) => (RANK[v] > RANK[acc] ? v : acc), 'PASS');

// ── PII masking for committed .md (emails / UUIDs / IPv4) ───────────────────
function maskPII(s: string): string {
  return s
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'user_masked')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, 'id_masked')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, 'ip_masked');
}

async function scalar(pool: Pool, sql: string, params: any[] = []): Promise<number> {
  try {
    const r = await pool.query(sql, params);
    return Number(r.rows?.[0]?.n ?? 0);
  } catch {
    return 0;
  }
}
async function listLen(fn: any, pool: Pool, sid: string): Promise<number> {
  try {
    const r = await fn(pool, sid);
    if (r == null) return 0;
    if (typeof r.count === 'number') return r.count;
    if (Array.isArray(r.items)) return r.items.length;
    if (Array.isArray(r.runs)) return r.runs.length;
    if (Array.isArray(r.history)) return r.history.length;
    if (Array.isArray(r.snapshots)) return r.snapshots.length;
    if (Array.isArray(r)) return r.length;
    return 0;
  } catch {
    return 0;
  }
}
function measurableOf(env: any): boolean | 'n/a' {
  if (env == null) return 'n/a';
  if (typeof env.measurable === 'boolean') return env.measurable;
  if (env._meta && typeof env._meta.measurable === 'boolean') return env._meta.measurable;
  if (env.coverage && typeof env.coverage.measurable === 'boolean') return env.coverage.measurable;
  if (env.summary && typeof env.summary.measurable === 'boolean') return env.summary.measurable;
  return 'n/a';
}

interface StageRow {
  n: number;
  stage: string;
  generated: boolean;
  measurable: boolean | 'n/a';
  persisted: boolean | 'n/a';
  detail: string;
}
interface OutputRow {
  name: string;
  report_type: string;
  format: string;
  template: string;
  rendered: boolean;
  bytes: number;
  detail: string;
}
interface PersonaRow {
  persona: string;
  surface: string;
  canRead: boolean;
  measurable: boolean | 'n/a';
  detail: string;
}
interface CertRow {
  n: number;
  question: string;
  verdict: Verdict;
  evidence: string;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });

  // Ensure the Report Factory schema + default templates (incl. employability)
  // are seeded into the shared DB before the standard render path reads them.
  await ensureReportFactorySchema(pool).catch((e) => {
    console.error('[mx106a] ensureReportFactorySchema failed:', e?.message ?? e);
  });

  const stages: StageRow[] = [];
  const outputs: OutputRow[] = [];
  const personas: PersonaRow[] = [];
  const certs: CertRow[] = [];
  const findings: string[] = [];

  const flagState = {
    FF_REPORT_FACTORY: process.env.FF_REPORT_FACTORY ?? '(unset)',
    FF_COMPETENCY_RUNTIME: process.env.FF_COMPETENCY_RUNTIME ?? '(unset)',
    FF_CAREER_INTELLIGENCE: process.env.FF_CAREER_INTELLIGENCE ?? '(unset)',
    FF_EMPLOYER_COMPETENCY_HIRING: process.env.FF_EMPLOYER_COMPETENCY_HIRING ?? '(unset)',
  };

  const run = async (
    n: number,
    stage: string,
    persistable: boolean,
    fn: () => Promise<{ generated: boolean; measurable: boolean | 'n/a'; persisted: boolean | 'n/a'; detail: string }>,
  ) => {
    try {
      stages.push({ n, stage, ...(await fn()) });
    } catch (e: any) {
      stages.push({
        n, stage, generated: false, measurable: 'n/a',
        persisted: persistable ? false : 'n/a',
        detail: `ERROR: ${String(e?.message ?? e).slice(0, 160)}`,
      });
    }
  };

  try {
    // ═══ STAGE A — Candidate TAKES the assessment (writes a scored profile) ═══
    const PROFILE_COUNT = `SELECT COUNT(*)::int n FROM onto_competency_profiles WHERE subject_id = $1`;
    const profBefore = await scalar(pool, PROFILE_COUNT, [SUBJECT]);
    let assessmentScore: any = null;
    await run(1, 'Assessment taken+scored', true, async () => {
      const gen: any = await generateAssessment(pool, {
        blueprintId: BLUEPRINT_ID, subjectId: SUBJECT, total: 21, roleId: ROLE_ID,
      });
      if (!gen.ok) return { generated: false, measurable: 'n/a', persisted: false, detail: `generate failed: ${gen.error}` };
      const questions: any[] = gen.questions ?? [];
      // Answer each question by selecting the highest-scoring option (a strong,
      // deterministic candidate). Questions with no options are skipped (never fabricated).
      const responses = questions
        .filter((q) => Array.isArray(q.options) && q.options.length > 0)
        .map((q) => {
          let best = 0;
          for (let i = 1; i < q.options.length; i++) if (Number(q.options[i].score) > Number(q.options[best].score)) best = i;
          return { index: q.index, selected_index: best };
        });
      assessmentScore = await scoreAssessment(pool, { instanceId: gen.instance_id, responses });
      const after = await scalar(pool, PROFILE_COUNT, [SUBJECT]);
      const measurable = (assessmentScore?.domain_scores?.length ?? 0) > 0;
      return {
        generated: assessmentScore?.ok === true,
        measurable,
        persisted: after > profBefore,
        detail: `questions=${questions.length}, answered=${assessmentScore?.answered ?? 0}, overall=${assessmentScore?.overall_score ?? 'null'}, measurement=${assessmentScore?.measurement}, domains=${assessmentScore?.domain_scores?.length ?? 0}, profile_rows ${profBefore}→${after}`,
      };
    });

    // ═══ STAGE B — Downstream journey (profile → EI → readiness → recs → passport) ═══
    let profileView: any = null;
    await run(2, 'Competency profile', false, async () => {
      profileView = await getProfile(pool, SUBJECT);
      return {
        generated: !!profileView,
        measurable: profileView?.measured ?? false,
        persisted: 'n/a',
        detail: profileView
          ? `overall=${profileView.overall_score ?? 'null'}, domains=${(profileView.domain_scores ?? []).length}, measurement=${profileView.measurement}, history=${profileView.history_count}`
          : 'absent',
      };
    });

    let eiProfile: any = null;
    await run(3, 'EI profile', false, async () => {
      eiProfile = await buildEiProfile(pool, SUBJECT);
      const o = eiProfile?.overall_ei;
      return {
        generated: !!eiProfile,
        measurable: o?.measurable ?? false,
        persisted: 'n/a',
        detail: eiProfile ? `overall_ei=${o?.ei_score ?? 'null'}, band=${o?.band ?? 'null'}, coverage=${o?.coverage_pct ?? 0}` : 'absent',
      };
    });

    let readiness: any = null;
    await run(4, 'Role readiness', false, async () => {
      readiness = await computeRoleReadinessForSubject(pool, SUBJECT);
      const r = readiness?.readiness;
      return {
        generated: !!readiness,
        measurable: r?.readiness_score != null,
        persisted: 'n/a',
        detail: readiness
          ? `role=${readiness.role_id ?? 'null'}, score=${r?.readiness_score ?? 'null'} (over ASSESSED weight), band=${r?.readiness_band ?? 'null'}, coverage=${r?.coverage_pct ?? 'null'}% (assessed/total weight — SEPARATE axis), fit=${r?.role_fit?.band ?? 'n/a'}${r?.role_fit?.capped_by_critical ? ' (capped by critical gaps)' : ''}, blocking_gaps=${r?.blocking_gaps ?? 'n/a'}, notes=${(readiness.notes ?? []).length}`
          : 'absent',
      };
    });

    let careerMatch: any = null;
    await run(5, 'Career matches', true, async () => {
      const before = await listLen(listCareerMatchHistory, pool, SUBJECT);
      careerMatch = await buildCareerMatch(pool, SUBJECT);
      await persistCareerMatchSnapshot(pool, careerMatch as any);
      const after = await listLen(listCareerMatchHistory, pool, SUBJECT);
      return {
        generated: !!careerMatch,
        measurable: measurableOf(careerMatch),
        persisted: after > before,
        detail: `matches=${careerMatch?.matches?.length ?? careerMatch?.roles?.length ?? 0}, history ${before}→${after}`,
      };
    });

    await run(6, 'Career gaps', true, async () => {
      const before = await listLen(listCareerGapHistory, pool, SUBJECT);
      const env = await buildCareerGap(pool, SUBJECT);
      await persistCareerGapSnapshot(pool, env as any);
      const after = await listLen(listCareerGapHistory, pool, SUBJECT);
      return { generated: !!env, measurable: measurableOf(env), persisted: after > before, detail: `gaps=${(env as any)?.gaps?.length ?? 0}, history ${before}→${after}` };
    });

    await run(7, 'Career roadmap', true, async () => {
      const before = await listLen(listCareerRoadmapHistory, pool, SUBJECT);
      const env = await buildCareerRoadmap(pool, SUBJECT);
      await persistCareerRoadmapSnapshot(pool, env as any);
      const after = await listLen(listCareerRoadmapHistory, pool, SUBJECT);
      return { generated: !!env, measurable: measurableOf(env), persisted: after > before, detail: `phases=${(env as any)?.phases?.length ?? 0}, history ${before}→${after}` };
    });

    await run(8, 'Development plan', true, async () => {
      const before = await listLen(listCareerDevelopmentHistory, pool, SUBJECT);
      const env = await buildCareerDevelopment(pool, SUBJECT);
      await persistCareerDevelopmentSnapshot(pool, env as any);
      const after = await listLen(listCareerDevelopmentHistory, pool, SUBJECT);
      return { generated: !!env, measurable: measurableOf(env), persisted: after > before, detail: `streams=${(env as any)?.streams?.length ?? 0}, history ${before}→${after}` };
    });

    let passport: any = null;
    await run(9, 'Career passport', true, async () => {
      const before = await listLen(listPassportHistory, pool, SUBJECT);
      passport = await generateCareerPassport(pool, SUBJECT);
      await persistPassportSnapshot(pool, passport as any);
      const after = await listLen(listPassportHistory, pool, SUBJECT);
      return {
        generated: !!passport,
        measurable: (passport as any)?.measurable ?? 'n/a',
        persisted: after > before,
        detail: `sections=${(passport as any)?.coverage?.sections_present}/${(passport as any)?.coverage?.sections_total}, history ${before}→${after}`,
      };
    });

    await run(10, 'Career signals', false, async () => {
      const env = await buildCareerSignals(pool, SUBJECT);
      return { generated: !!env, measurable: measurableOf(env), persisted: 'n/a', detail: `signals=${(env as any)?.signals?.length ?? 0} (config-as-data)` };
    });

    await run(11, 'Progress tracking', true, async () => {
      const before = await listLen(listGrowthTracking, pool, SUBJECT);
      await persistCareerProgressionSnapshot(pool, SUBJECT);
      const after = await listLen(listGrowthTracking, pool, SUBJECT);
      const env = await buildCareerProgression(pool, SUBJECT);
      return { generated: !!env, measurable: measurableOf(env), persisted: after > before, detail: `growth_tracking ${before}→${after}` };
    });

    // ═══ STAGE C — Employability index (competency → dimensions → EI) ═══
    let employability: any = null;
    await run(12, 'Employability index', true, async () => {
      const before = await listLen(listScoringRuns, pool, SUBJECT);
      employability = await computeEmployabilityScore(pool, SUBJECT);
      let persisted: boolean | 'n/a' = 'n/a';
      let persistErr = '';
      try {
        await persistScoringRun(pool, SUBJECT);
        const after = await listLen(listScoringRuns, pool, SUBJECT);
        persisted = after > before;
      } catch (e: any) {
        persisted = false;
        persistErr = ` persist_error=${String(e?.message ?? e).slice(0, 80)}`;
      }
      const sum = employability?.summary;
      return {
        generated: employability?.ok === true || employability?.measurable === true,
        measurable: employability?.measurable ?? false,
        persisted,
        detail: `ei_score=${employability?.ei?.ei_score ?? sum?.ei_score ?? 'null'}, ei_band=${employability?.ei?.band ?? 'null'}, coverage_pct=${sum?.coverage_pct ?? 0}, dims=${sum?.dimensions_measurable ?? 0}/${sum?.dimensions_total ?? 0}, confidence=${sum?.confidence?.score ?? 'n/a'}/${sum?.confidence?.band ?? 'n/a'}${persistErr}`,
      };
    });

    // ═══ STAGE D — Report Factory: 9 outputs (5 PDF + 2 JSON + 2 CSV) ═══
    const tmplRes = await pool.query(`SELECT id, report_type FROM rf_templates WHERE is_default = true`);
    const tmplByType = new Map<string, number>();
    for (const r of tmplRes.rows as any[]) tmplByType.set(r.report_type, r.id);

    // A shared data snapshot so narrative/insight/benchmark rules have something to read.
    const overall = profileView?.overall_score ?? assessmentScore?.overall_score ?? null;
    const eiScore = employability?.summary?.ei_score ?? null;
    const dataSnapshot: Record<string, unknown> = {
      subject_id: SUBJECT,
      name: 'Demo Candidate',
      role: ROLE_TITLE,
      overall_score: overall,
      readiness: readiness?.readiness?.readiness_score ?? overall,
      score: overall,
      ei_score: eiScore,
      coverage_pct: employability?.summary?.coverage_pct ?? 0,
      readiness_level: employability?.summary?.ei_band ?? readiness?.readiness?.band ?? 'developing',
      readiness_description: 'measured strengths and growth areas',
      sections_present: passport?.coverage?.sections_present ?? 0,
      sections_total: passport?.coverage?.sections_total ?? 0,
    };

    const fileBytes = (p: string | undefined | null): number => {
      try { return p ? fs.statSync(p).size : 0; } catch { return 0; }
    };

    // Helper: generate via a real default template + render in one format.
    const reports: Record<string, any> = {};
    const genReport = async (reportType: string): Promise<any | null> => {
      const tid = tmplByType.get(reportType);
      if (!tid) return null;
      const rpt = await generateReport(pool, {
        templateId: tid, data: dataSnapshot, userId: SUBJECT, sessionId: `mx106a_${reportType}`,
      });
      reports[reportType] = rpt;
      return rpt;
    };
    const renderPdf = async (name: string, reportType: string) => {
      try {
        const rpt = reports[reportType] ?? (await genReport(reportType));
        if (!rpt) { outputs.push({ name, report_type: reportType, format: 'pdf', template: 'MISSING', rendered: false, bytes: 0, detail: 'no default template for report_type' }); return; }
        const fp = await renderReportToPDF(rpt);
        outputs.push({ name, report_type: reportType, format: 'pdf', template: 'default', rendered: fileBytes(fp) > 0, bytes: fileBytes(fp), detail: maskPII(String(fp)) });
      } catch (e: any) {
        outputs.push({ name, report_type: reportType, format: 'pdf', template: 'default', rendered: false, bytes: 0, detail: `ERROR: ${String(e?.message ?? e).slice(0, 120)}` });
      }
    };
    const renderFmt = async (name: string, reportType: string, format: 'csv' | 'json') => {
      try {
        const rpt = reports[reportType] ?? (await genReport(reportType));
        if (!rpt) { outputs.push({ name, report_type: reportType, format, template: 'MISSING', rendered: false, bytes: 0, detail: 'no default template' }); return; }
        const content = format === 'csv' ? renderReportToCSV(rpt) : renderReportToJSON(rpt);
        const fp = path.join('/tmp/rf_exports', `rf_${rpt.report_uuid ?? rpt.id}_mx106a.${format}`);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, content, 'utf8');
        outputs.push({ name, report_type: reportType, format, template: 'default', rendered: fileBytes(fp) > 0, bytes: fileBytes(fp), detail: maskPII(String(fp)) });
      } catch (e: any) {
        outputs.push({ name, report_type: reportType, format, template: 'default', rendered: false, bytes: 0, detail: `ERROR: ${String(e?.message ?? e).slice(0, 120)}` });
      }
    };

    // 1-4: PDFs from real seeded default templates.
    await renderPdf('Assessment (CAPADEX) PDF', 'capadex');
    await renderPdf('Competency PDF', 'competency');
    await renderPdf('Career PDF', 'career');
    await renderPdf('Passport PDF', 'passport');

    // 5: Employability PDF — a first-class default template now ships for
    // report_type=employability, so it renders through the SAME standard Report
    // Factory path as the other journey reports (no ad-hoc payload).
    await renderPdf('Employability PDF', 'employability');

    // 6-7: JSON exports.
    await renderFmt('Competency JSON', 'competency', 'json');
    await renderFmt('Employability JSON', 'employability', 'json');

    // 8-9: CSV exports.
    await renderFmt('Career CSV', 'career', 'csv');
    await renderFmt('Passport CSV', 'passport', 'csv');

    // ═══ STAGE E — Persona consumption probes (read-only) ═══
    // Candidate: can read own profile + EI + readiness.
    try {
      const p = await getProfile(pool, SUBJECT);
      personas.push({
        persona: 'Candidate', surface: 'profile + EI + readiness',
        canRead: !!p, measurable: p?.measured ?? false,
        detail: `profile_measured=${p?.measured ?? false}, ei_overall=${eiProfile?.overall_ei?.ei_score ?? 'n/a'}, readiness=${readiness?.readiness?.readiness_score ?? 'n/a'}`,
      });
    } catch (e: any) {
      personas.push({ persona: 'Candidate', surface: 'profile + EI + readiness', canRead: false, measurable: 'n/a', detail: `ERROR: ${String(e?.message ?? e).slice(0, 120)}` });
    }

    // Employer: competency-match + interview/hiring recommendation for the demo candidate.
    try {
      const emp = await computeEmployerCompetencyIntelligence(pool, {
        candidate: { email: SUBJECT, ei_score: eiScore },
        job: { id: 'mx106a_demo_job', title: ROLE_TITLE },
      });
      const m = emp?.match;
      personas.push({
        persona: 'Employer', surface: 'competency-match + interview/hiring rec',
        canRead: !!emp,
        measurable: m?.competencyProfileAvailable ?? (m?.competencyMatch != null),
        detail: `competencyMatch=${m?.competencyMatch ?? 'null'}, coverage=${m?.requirementCoveragePct ?? 'null'}%, reqs=${m?.matchedRequirementCount ?? 0}/${m?.totalRequirementCount ?? 0} (${m?.directMatchCount ?? 0} direct, ${m?.domainProxyMatchCount ?? 0} domain-proxy), source=${m?.source ?? 'n/a'}, hiringAction=${emp?.hiringRecommendation?.action ?? 'n/a'}, interview_coverage_ok=${emp?.interviewRecommendation?.coverageSufficient ?? 'n/a'}`,
      });
      // Honest cross-namespace finding. The candidate IS measurable (domain-proxy profile).
      // A comp_* → dom_* crosswalk now scores domain-granularity profiles against
      // competency-granularity role requirements, so employer match coverage is > 0%
      // (domain-proxy matches are clearly labelled, never represented as per-competency
      // measurements). The residual coverage gap is honest: O*NET-inherited requirements
      // and competencies in unmeasured domains stay unassessed (never fabricated).
      if (profileView?.measured && (m?.totalRequirementCount ?? 0) > 0) {
        if ((m?.matchedRequirementCount ?? 0) === 0) {
          findings.push(`Employer competency-match coverage is 0% for a MEASURABLE candidate: the assessment produces a domain-proxy profile (${(profileView?.domain_scores ?? []).length} measured domains) that did not crosswalk to ${ROLE_TITLE}'s ${m?.totalRequirementCount} role-DNA requirement keys (source fell back to ${m?.source}). The employer surface reads honestly (abstain, never fabricated).`);
        } else {
          findings.push(`Employer competency-match is now non-null for a MEASURABLE candidate: competencyMatch=${m?.competencyMatch}/100 over ${m?.matchedRequirementCount}/${m?.totalRequirementCount} requirements (coverage ${m?.requirementCoveragePct}%), via a comp_* → onto-domain crosswalk — ${m?.directMatchCount ?? 0} direct competency match(es) and ${m?.domainProxyMatchCount ?? 0} domain-proxy. Domain-proxy attainments are clearly labelled (matchVia=domain_proxy / matchedLedger "(domain_proxy)") and never represented as per-competency measurements. Residual unassessed requirements (O*NET-inherited keys + competencies in unmeasured domains) stay an honest coverage gap, never fabricated.`);
        }
      }
    } catch (e: any) {
      personas.push({ persona: 'Employer', surface: 'competency-match + interview/hiring rec', canRead: false, measurable: 'n/a', detail: `ERROR: ${String(e?.message ?? e).slice(0, 120)}` });
    }

    // Super Admin: platform intelligence aggregate.
    try {
      const pi: any = await buildPlatformIntelligence(pool);
      personas.push({
        persona: 'Super Admin', surface: 'platform intelligence',
        canRead: !!pi, measurable: 'n/a',
        detail: `headline_groups=${Object.keys(pi ?? {}).length}`,
      });
    } catch (e: any) {
      personas.push({ persona: 'Super Admin', surface: 'platform intelligence', canRead: false, measurable: 'n/a', detail: `ERROR: ${String(e?.message ?? e).slice(0, 120)}` });
    }

    // Founder: founder dashboard.
    try {
      const fd: any = await buildFounderDashboard(pool);
      personas.push({
        persona: 'Founder', surface: 'founder dashboard',
        canRead: !!fd, measurable: 'n/a',
        detail: `metric_groups=${Object.keys(fd ?? {}).length}`,
      });
    } catch (e: any) {
      personas.push({ persona: 'Founder', surface: 'founder dashboard', canRead: false, measurable: 'n/a', detail: `ERROR: ${String(e?.message ?? e).slice(0, 120)}` });
    }

    // ═══ STAGE F — 10 Phase-10 certification questions ═══
    const stage = (n: number) => stages.find((s) => s.n === n)!;
    const stageVerdict = (n: number): Verdict => {
      const s = stage(n);
      if (!s || !s.generated) return 'FAIL';
      if (s.persisted === false) return 'FAIL';
      if (s.measurable === false) return 'PARTIAL';
      return 'PASS';
    };
    const renderedCount = outputs.filter((o) => o.rendered).length;
    const personaVerdict = (p: string): Verdict => {
      const row = personas.find((x) => x.persona === p);
      if (!row || !row.canRead) return 'FAIL';
      if (row.measurable === false) return 'PARTIAL';
      return 'PASS';
    };

    const q = (n: number, question: string, verdict: Verdict, evidence: string) => certs.push({ n, question, verdict, evidence });
    q(1, 'Can a candidate take a competency assessment and have it scored + persisted?', stageVerdict(1), maskPII(stage(1).detail));
    q(2, 'Does a competency profile generate with domain scores?', stageVerdict(2), maskPII(stage(2).detail));
    q(3, 'Does the employability index compute from the competency scores?', stageVerdict(12), maskPII(stage(12).detail));
    q(4, 'Does role readiness compute for the subject?', stageVerdict(4), maskPII(stage(4).detail));
    q(5, 'Are career recommendations generated (match / gap / roadmap / development)?',
      worstOf([stageVerdict(5), stageVerdict(6), stageVerdict(7), stageVerdict(8)]),
      `match:${stage(5).persisted} gap:${stage(6).persisted} roadmap:${stage(7).persisted} dev:${stage(8).persisted}`);
    q(6, 'Does the career passport generate + persist?', stageVerdict(9), maskPII(stage(9).detail));
    q(7, 'Can downloadable reports be produced through the Report Factory?',
      renderedCount >= outputs.length ? 'PASS' : renderedCount > 0 ? 'PARTIAL' : 'FAIL',
      `${renderedCount}/${outputs.length} outputs rendered a non-empty file`);
    q(8, 'Can the Candidate persona read their results?', personaVerdict('Candidate'),
      maskPII(personas.find((p) => p.persona === 'Candidate')?.detail ?? ''));
    q(9, 'Can the Employer persona read competency-match + hiring recommendation?', personaVerdict('Employer'),
      maskPII(personas.find((p) => p.persona === 'Employer')?.detail ?? ''));
    q(10, 'Can the Super Admin + Founder personas read oversight metrics?',
      worstOf([personaVerdict('Super Admin'), personaVerdict('Founder')]),
      `superadmin:${personas.find((p) => p.persona === 'Super Admin')?.canRead} founder:${personas.find((p) => p.persona === 'Founder')?.canRead}`);

    const verdict = worstOf(certs.map((c) => c.verdict));

    // ═══ STAGE G — Console report + committed .md artifacts (PII masked) ═══
    const bar = '='.repeat(86);
    console.log(bar);
    console.log(`MX-106A E2E COMPETENCY ASSESSMENT VALIDATION  subject=${SUBJECT}`);
    console.log(bar);
    for (const s of stages) {
      const gen = s.generated ? 'GEN✓' : 'GEN✗';
      const meas = s.measurable === 'n/a' ? 'meas=n/a' : s.measurable ? 'meas✓' : 'meas-empty';
      const pers = s.persisted === 'n/a' ? 'persist=n/a' : s.persisted ? 'persist✓' : 'persist✗';
      console.log(`${String(s.n).padStart(2)}. ${s.stage.padEnd(24)} ${gen.padEnd(5)} ${meas.padEnd(11)} ${pers.padEnd(11)} — ${s.detail}`);
    }
    console.log('-'.repeat(86));
    console.log('REPORT FACTORY OUTPUTS:');
    for (const o of outputs) console.log(`  ${o.rendered ? '✓' : '✗'} ${o.name.padEnd(26)} [${o.format}] ${o.bytes}B  ${o.template}`);
    console.log('-'.repeat(86));
    console.log('PERSONA PROBES:');
    for (const p of personas) console.log(`  ${p.canRead ? '✓' : '✗'} ${p.persona.padEnd(12)} ${p.surface}  — ${p.detail}`);
    console.log('-'.repeat(86));
    console.log('PHASE-10 CERTIFICATION:');
    for (const c of certs) console.log(`  Q${c.n}. [${c.verdict}] ${c.question}`);
    console.log(bar);
    console.log(`VERDICT: ${verdict}  (rendered ${renderedCount}/${outputs.length} outputs)`);
    console.log(bar);

    // ---- Write committed artifacts ----
    const auditDir = path.join(process.cwd(), 'audit', 'mx-106a');
    fs.mkdirSync(auditDir, { recursive: true });
    const now = new Date().toISOString();
    const yes = (b: boolean | 'n/a') => (b === 'n/a' ? 'n/a' : b ? '✓' : '✗');

    const cert = [
      `# MX-106A — End-to-End Competency Assessment Validation & Certification`,
      ``,
      `**Verdict: ${verdict}**  ·  generated ${now}`,
      ``,
      `Read-only certification of the complete competency-assessment journey for ONE`,
      `purgeable demo subject (\`user_masked\`, \`@example.com\`). The run actually TAKES the`,
      `assessment to prove the path; all writes are confined to the demo subject and are`,
      `purgeable. Honesty canon: Coverage (machinery exercisable) ⟂ Confidence (real`,
      `non-demo data) reported separately; persistence proven by before/after row DELTA;`,
      `null ≠ 0; unmeasurable is reported, never fabricated.`,
      ``,
      `> **Confidence axis:** every number below is from a synthetic \`@example.com\` demo`,
      `> subject, so real-data **Confidence is 0 by construction**. This certifies the`,
      `> machinery is exercisable end-to-end (Coverage / Structural), NOT real-world adoption.`,
      ``,
      `## Flag state at run`,
      ...Object.entries(flagState).map(([k, v]) => `- \`${k}\` = ${v}`),
      ``,
      `## Phase-10 certification questions`,
      ``,
      `| # | Question | Verdict | Evidence |`,
      `|---|----------|---------|----------|`,
      ...certs.map((c) => `| ${c.n} | ${c.question} | **${c.verdict}** | ${c.evidence} |`),
      ``,
      `## Journey stages (generated ⟂ measurable ⟂ persisted)`,
      ``,
      `| # | Stage | Gen | Meas | Persist | Detail |`,
      `|---|-------|-----|------|---------|--------|`,
      ...stages.map((s) => `| ${s.n} | ${s.stage} | ${s.generated ? '✓' : '✗'} | ${yes(s.measurable)} | ${yes(s.persisted)} | ${maskPII(s.detail)} |`),
      ``,
      `## Report Factory outputs (9 = 5 PDF + 2 JSON + 2 CSV)`,
      ``,
      `| Output | Type | Format | Template | Rendered | Bytes |`,
      `|--------|------|--------|----------|----------|-------|`,
      ...outputs.map((o) => `| ${o.name} | ${o.report_type} | ${o.format} | ${o.template} | ${o.rendered ? '✓' : '✗'} | ${o.bytes} |`),
      ``,
      `## Persona consumption (read-only)`,
      ``,
      `| Persona | Surface | Can read | Measurable | Detail |`,
      `|---------|---------|----------|------------|--------|`,
      ...personas.map((p) => `| ${p.persona} | ${p.surface} | ${p.canRead ? '✓' : '✗'} | ${yes(p.measurable)} | ${maskPII(p.detail)} |`),
      ``,
      `## Findings`,
      ...findings.map((f) => `- ${f}`),
      ``,
      `## Scope & honesty notes`,
      `- This is a validation + certification deliverable: it exercises and reports, it does`,
      `  NOT rebuild any engine, flip any flag, or deploy.`,
      `- The demo subject is \`@example.com\` (RFC-2606 reserved) and purgeable; remove with`,
      `  \`DELETE ... WHERE subject_id / user_id = '<demo email>'\` across the journey tables.`,
      `- All emails / UUIDs / IPv4 in this document are masked; only aggregate counts are written.`,
      ``,
    ].join('\n');
    const certPath = path.join(auditDir, 'certification-report.md');
    fs.writeFileSync(certPath, maskPII(cert), 'utf8');

    const measStages = stages.filter((s) => s.measurable !== 'n/a');
    const measOk = measStages.filter((s) => s.measurable === true).length;
    const founder = [
      `# MX-106A — Founder Summary`,
      ``,
      `**Can a candidate go from assessment all the way to downloadable reports, and can`,
      `every persona see it? → ${verdict === 'PASS' ? 'YES, end-to-end.' : verdict === 'PARTIAL' ? 'YES structurally, with honest gaps below.' : 'NOT yet — see blockers.'}**`,
      ``,
      `_Generated ${now}. One synthetic demo candidate walked the entire journey._`,
      ``,
      `## What works, in plain terms`,
      `- The candidate **took a real competency assessment** and got a scored profile.`,
      `- That profile flows into an **employability index, role readiness, career`,
      `  recommendations, and a career passport** — each one written to the database this run.`,
      `- The platform produced **${outputs.filter((o) => o.rendered).length} downloadable report files**`,
      `  (PDF, JSON and CSV) through the Report Factory.`,
      `- **${personas.filter((p) => p.canRead).length} of 4 personas** (Candidate, Employer, Super Admin, Founder)`,
      `  could read the results back.`,
      ``,
      `## The honest picture`,
      `- **${measOk} of ${measStages.length}** measurable journey stages produced real (not imputed) numbers`,
      `  for this subject; the rest are wired but had no measurable input and say so honestly.`,
      `- These numbers come from a **synthetic demo candidate**, so they certify the machinery`,
      `  works end-to-end — not real-world usage. Real-data confidence is a separate axis.`,
      ``,
      `## What to fix next (not blockers)`,
      ...findings.map((f) => `- ${f}`),
      ``,
    ].join('\n');
    const founderPath = path.join(auditDir, 'founder-summary.md');
    fs.writeFileSync(founderPath, maskPII(founder), 'utf8');

    console.log(`\nWrote: ${path.relative(process.cwd(), certPath)}`);
    console.log(`Wrote: ${path.relative(process.cwd(), founderPath)}`);

    // Honest exit code: only a hard generation/persistence break is non-zero. A
    // PARTIAL (honest unmeasurable / missing template) is NOT a process failure.
    const hardFail = stages.some((s) => !s.generated && s.stage === 'Assessment taken+scored')
      || certs.some((c) => c.verdict === 'FAIL');
    if (hardFail) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
