/**
 * PHASE 5.13 — employer_dashboard_engine.
 *
 * Three role-scoped DASHBOARDS, each a deterministic, coverage-gated, null-abstaining COMPOSITION
 * of operator-recorded evidence (compose-never-recompute; PURE READ). The dashboards reuse the
 * Phase 5.12 workforce engines wholesale (via their *FromEvidence variants over ONE shared evidence
 * load) and add the dashboard-specific operational folds (open jobs, applications, hiring funnel,
 * assessment / hiring analytics):
 *   - employer_dashboard  : executive org view — open jobs, applications, funnel, readiness,
 *                           competency analytics, assessment analytics, hiring analytics.
 *   - recruiter_dashboard : recruiting-ops view — open jobs, applications, hiring funnel, talent pool.
 *   - talent_dashboard    : talent / L&D view — talent pool, readiness, competency + assessment analytics.
 *
 * None of these is a hiring/promotion/suitability prediction or verdict — they aggregate human
 * inputs. Unmeasured signals abstain (null), never 0; every output carries Coverage + disclaimer.
 */

import type { Pool } from 'pg';
import {
  type EngineResult, ok, round1, meanPresent, bandFor,
  workforceSummary,
} from './workforce-intelligence-shared';
import {
  candidateReadiness,
  computeTeamCompetencyProfileFromEvidence,
  computeDepartmentReadinessFromEvidence,
  computeTalentDistributionFromEvidence,
} from './workforce-intelligence-engine';
import { computeSkillInventoryFromEvidence } from './skill-inventory-engine';
import { computeCapabilityHeatmapFromEvidence } from './capability-mapping-engine';
import {
  type DashboardEvidence,
  EMPLOYER_DASHBOARD_VERSION, EMPLOYER_DASHBOARD_DISCLAIMER, PROVENANCE,
  FUNNEL_STAGES, FUNNEL_ACTIVE, canonStage, normJobStatus,
  resolveDashboardEvidence, scoreDistribution, rate,
} from './employer-dashboard-shared';

// ── widget: OPEN JOBS ────────────────────────────────────────────────────────
export function buildOpenJobs(ev: DashboardEvidence) {
  const wf = ev.workforce;
  // applicant counts per job (employer-scoped candidates bound to a job).
  const applicantsByJob = new Map<string, number>();
  for (const c of wf.candidates) {
    if (c.job_id != null) applicantsByJob.set(c.job_id, (applicantsByJob.get(c.job_id) ?? 0) + 1);
  }
  const by_status: Record<string, number> = { open: 0, closed: 0, draft: 0, on_hold: 0, other: 0 };
  const jobs = wf.jobs.map((j) => {
    const rawStatus = ev.jobStatusById.get(j.id) ?? null;
    const status = normJobStatus(rawStatus);
    by_status[status] += 1;
    return {
      job_id: j.id,
      title: j.title,
      department: j.department,
      status,
      status_raw: rawStatus,
      required_skills_count: j.required_skills.length,
      applicant_count: applicantsByJob.get(j.id) ?? 0,
    };
  });
  jobs.sort((a, b) => (b.applicant_count - a.applicant_count) || (a.title ?? '').localeCompare(b.title ?? ''));
  return {
    widget: 'open_jobs',
    total_jobs: wf.jobs.length,
    open_jobs: by_status.open,
    by_status,
    jobs,
  };
}

// ── widget: APPLICATIONS ─────────────────────────────────────────────────────
export function buildApplications(ev: DashboardEvidence) {
  const wf = ev.workforce;
  const by_stage: Record<string, number> = {};
  for (const s of FUNNEL_STAGES) by_stage[s] = 0;
  let unknown = 0;
  for (const c of wf.candidates) {
    const st = canonStage(c.stage);
    if (st == null) unknown += 1;
    else by_stage[st] += 1;
  }
  // per-job application counts (bound candidates), plus an unbound bucket.
  const jobTitleById = new Map(wf.jobs.map((j) => [j.id, j.title]));
  const byJob = new Map<string, number>();
  let unbound = 0;
  for (const c of wf.candidates) {
    if (c.bound_to_employer_job && c.job_id != null) byJob.set(c.job_id, (byJob.get(c.job_id) ?? 0) + 1);
    else unbound += 1;
  }
  const by_job = Array.from(byJob.entries())
    .map(([jobId, count]) => ({ job_id: jobId, title: jobTitleById.get(jobId) ?? null, applications: count }))
    .sort((a, b) => (b.applications - a.applications) || a.job_id.localeCompare(b.job_id));
  return {
    widget: 'applications',
    total_applications: wf.candidates.length,
    by_stage,
    unknown_stage: unknown,
    by_job,
    unbound_to_job: unbound,
  };
}

// ── widget: HIRING FUNNEL ────────────────────────────────────────────────────
// Ordered active funnel (Applied→Offer) + terminal outcomes (Hired/Rejected). Step conversion is
// next/prev along the ACTIVE stages and ABSTAINS (null) when the prior stage is empty (never a fake 0%).
export function buildHiringFunnel(ev: DashboardEvidence) {
  const wf = ev.workforce;
  const counts: Record<string, number> = {};
  for (const s of FUNNEL_STAGES) counts[s] = 0;
  let unknown = 0;
  for (const c of wf.candidates) {
    const st = canonStage(c.stage);
    if (st == null) unknown += 1;
    else counts[st] += 1;
  }
  const total = wf.candidates.length;
  const stages = FUNNEL_ACTIVE.map((s, i) => {
    const prev = i > 0 ? counts[FUNNEL_ACTIVE[i - 1]] : null;
    return {
      stage: s,
      count: counts[s],
      // conversion from the PRIOR active stage (entered-vs-prior); first stage has no prior.
      conversion_from_prev_pct: prev == null ? null : rate(counts[s], prev),
    };
  });
  const hired = counts.Hired;
  const rejected = counts.Rejected;
  const in_pipeline = FUNNEL_ACTIVE.reduce((a, s) => a + counts[s], 0);
  return {
    widget: 'hiring_funnel',
    total_candidates: total,
    stages,
    outcomes: { hired, rejected, in_pipeline, unknown_stage: unknown },
    offer_rate_pct: rate(counts.Offer, total),
    hire_rate_pct: rate(hired, total),
    rejection_rate_pct: rate(rejected, total),
  };
}

// ── widget: TALENT POOL ──────────────────────────────────────────────────────
// Composes 5.12 Talent Distribution (band spread + by-department) and Skill Inventory (supply).
// The "available pool" excludes terminal Rejected candidates (a recorded outcome, not a verdict).
export function buildTalentPool(ev: DashboardEvidence) {
  const wf = ev.workforce;
  const distribution = computeTalentDistributionFromEvidence(wf);
  const inventory = computeSkillInventoryFromEvidence(wf, ev.skillRef);
  const available = wf.candidates.filter((c) => canonStage(c.stage) !== 'Rejected');
  const availBands: Record<string, number> = { high: 0, moderate: 0, developing: 0, low: 0 };
  let availUnmeasured = 0;
  for (const c of available) {
    const b = bandFor(candidateReadiness(c).value);
    if (b == null) availUnmeasured += 1;
    else availBands[b] += 1;
  }
  return {
    widget: 'talent_pool',
    total_candidates: wf.candidates.length,
    available_pool: available.length,
    available_by_readiness_band: { ...availBands, unmeasured: availUnmeasured },
    by_readiness_band: distribution.by_readiness_band,
    by_department: distribution.by_department,
    coverage_pct: distribution.coverage_pct,
    top_supplied_skills: inventory.top_skills.map((s) => ({ skill: s.skill, supply_count: s.supply_count })),
    unmet_demand_skills: inventory.unmet_demand_skills,
  };
}

// ── widget: READINESS ────────────────────────────────────────────────────────
// Composes 5.12 Department Readiness; adds an org-level mean of the per-candidate readiness index.
export function buildReadiness(ev: DashboardEvidence) {
  const wf = ev.workforce;
  const dept = computeDepartmentReadinessFromEvidence(wf);
  const perCand = wf.candidates.map((c) => candidateReadiness(c).value);
  const org = meanPresent(perCand);
  return {
    widget: 'readiness',
    org_readiness_index: org.mean,
    org_band: bandFor(org.mean),
    measured_candidates: org.n,
    total_candidates: wf.candidates.length,
    coverage_pct: wf.candidates.length > 0 ? round1((org.n / wf.candidates.length) * 100) : 0,
    departments: dept.departments,
    departments_count: dept.departments_count,
    has_unassigned: dept.has_unassigned,
  };
}

// ── widget: COMPETENCY ANALYTICS ─────────────────────────────────────────────
// Composes 5.12 Team Competency Profile + Capability Heatmap; adds an org-level per-competency mean
// with developmental strengths / development-area framing (NOT a ranking verdict).
export function buildCompetencyAnalytics(ev: DashboardEvidence) {
  const wf = ev.workforce;
  const teams = computeTeamCompetencyProfileFromEvidence(wf);
  const heatmap = computeCapabilityHeatmapFromEvidence(wf);

  // org-level mean per competency across ALL candidates.
  const names = new Set<string>();
  for (const c of wf.candidates) for (const x of c.competencies) names.add(x.name);
  const per_competency = Array.from(names).sort((a, b) => a.localeCompare(b)).map((name) => {
    const vals = wf.candidates.map((c) => {
      const hit = c.competencies.find((x) => x.name === name);
      return hit ? hit.value : null;
    });
    const mp = meanPresent(vals);
    return {
      competency: name,
      mean: mp.mean,
      band: bandFor(mp.mean),
      measured_candidates: mp.n,
      coverage_pct: wf.candidates.length > 0 ? round1((mp.n / wf.candidates.length) * 100) : 0,
    };
  });
  const measured = per_competency.filter((p) => p.mean != null);
  const ranked = [...measured].sort((a, b) => (b.mean as number) - (a.mean as number));
  return {
    widget: 'competency_analytics',
    competencies_tracked: per_competency.length,
    per_competency,
    strength_areas: ranked.slice(0, 5),
    development_areas: ranked.slice(-5).reverse(),
    teams: teams.teams,
    teams_count: teams.teams_count,
    heatmap: { departments: heatmap.departments, competencies: heatmap.competencies, rows: heatmap.rows },
    targets_available: heatmap.targets_available,
    coverage_pct: heatmap.coverage_pct,
  };
}

// ── widget: ASSESSMENT ANALYTICS ─────────────────────────────────────────────
// Coverage-gated distributions of the operator-entered candidate scores (no recompute).
export function buildAssessmentAnalytics(ev: DashboardEvidence) {
  const wf = ev.workforce;
  const total = wf.candidates.length;
  const assessment = scoreDistribution(wf.candidates.map((c) => c.assessment_score), total);
  const ei = scoreDistribution(wf.candidates.map((c) => c.ei_score), total);
  const match = scoreDistribution(wf.candidates.map((c) => c.match_score), total);
  const rating = scoreDistribution(wf.candidates.map((c) => c.rating), total);
  const assessed = wf.candidates.filter(
    (c) => c.assessment_score != null || c.ei_score != null || c.match_score != null || c.rating != null,
  ).length;
  return {
    widget: 'assessment_analytics',
    total_candidates: total,
    candidates_with_any_score: assessed,
    coverage_pct: total > 0 ? round1((assessed / total) * 100) : 0,
    assessment_score: assessment,
    ei_score: ei,
    match_score: match,
    rating,
  };
}

// ── widget: HIRING ANALYTICS ─────────────────────────────────────────────────
// Funnel-derived rates + quality-of-hire folds over candidates recorded as Hired. Every fold is
// coverage-gated: with 0 hired candidates the quality folds ABSTAIN (null), never fabricate.
export function buildHiringAnalytics(ev: DashboardEvidence) {
  const wf = ev.workforce;
  const total = wf.candidates.length;
  const byStage = (s: string) => wf.candidates.filter((c) => canonStage(c.stage) === s);
  const hiredCands = byStage('Hired');
  const offerCands = byStage('Offer');
  const rejectedCands = byStage('Rejected');
  const hired = hiredCands.length;
  const decided = hired + rejectedCands.length;
  return {
    widget: 'hiring_analytics',
    total_candidates: total,
    decided_candidates: decided,
    hired,
    rejected: rejectedCands.length,
    in_offer: offerCands.length,
    offer_rate_pct: rate(offerCands.length, total),
    hire_rate_pct: rate(hired, total),
    // share of DECIDED candidates that were hired (selection rate); abstains when none decided.
    selection_rate_pct: rate(hired, decided),
    quality_of_hire: {
      // means over Hired candidates only; null when 0 hired (coverage-gated, never fabricated).
      mean_match_score: meanPresent(hiredCands.map((c) => c.match_score)).mean,
      mean_assessment_score: meanPresent(hiredCands.map((c) => c.assessment_score)).mean,
      mean_ei_score: meanPresent(hiredCands.map((c) => c.ei_score)).mean,
      mean_readiness_index: meanPresent(hiredCands.map((c) => candidateReadiness(c).value)).mean,
      hired_measured: hiredCands.filter((c) => candidateReadiness(c).value != null).length,
    },
  };
}

// ── dashboard composers ──────────────────────────────────────────────────────
function envelope(ev: DashboardEvidence, dashboard: string, sections: Record<string, unknown>) {
  return {
    engine: 'employer_dashboard_engine',
    dashboard,
    version: EMPLOYER_DASHBOARD_VERSION,
    employer_id: ev.workforce.employer_id,
    sections,
    evidence: workforceSummary(ev.workforce),
    provenance: PROVENANCE,
    disclaimer: EMPLOYER_DASHBOARD_DISCLAIMER,
  };
}

/** employer_dashboard — executive org view. */
export function buildEmployerDashboardFromEvidence(ev: DashboardEvidence) {
  return envelope(ev, 'employer_dashboard', {
    open_jobs: buildOpenJobs(ev),
    applications: buildApplications(ev),
    hiring_funnel: buildHiringFunnel(ev),
    readiness: buildReadiness(ev),
    competency_analytics: buildCompetencyAnalytics(ev),
    assessment_analytics: buildAssessmentAnalytics(ev),
    hiring_analytics: buildHiringAnalytics(ev),
  });
}

/** recruiter_dashboard — recruiting-ops view. */
export function buildRecruiterDashboardFromEvidence(ev: DashboardEvidence) {
  return envelope(ev, 'recruiter_dashboard', {
    open_jobs: buildOpenJobs(ev),
    applications: buildApplications(ev),
    hiring_funnel: buildHiringFunnel(ev),
    talent_pool: buildTalentPool(ev),
  });
}

/** talent_dashboard — talent / L&D view. */
export function buildTalentDashboardFromEvidence(ev: DashboardEvidence) {
  return envelope(ev, 'talent_dashboard', {
    talent_pool: buildTalentPool(ev),
    readiness: buildReadiness(ev),
    competency_analytics: buildCompetencyAnalytics(ev),
    assessment_analytics: buildAssessmentAnalytics(ev),
  });
}

/** Combined overview — all three dashboards from ONE evidence load. */
export function buildDashboardOverviewFromEvidence(ev: DashboardEvidence) {
  return {
    engine: 'employer_dashboard_engine',
    output: 'overview',
    version: EMPLOYER_DASHBOARD_VERSION,
    employer_id: ev.workforce.employer_id,
    employer_dashboard: buildEmployerDashboardFromEvidence(ev),
    recruiter_dashboard: buildRecruiterDashboardFromEvidence(ev),
    talent_dashboard: buildTalentDashboardFromEvidence(ev),
    evidence: workforceSummary(ev.workforce),
    provenance: PROVENANCE,
    disclaimer: EMPLOYER_DASHBOARD_DISCLAIMER,
  };
}

// ── pool wrappers (single evidence load each) ────────────────────────────────
export async function computeEmployerDashboard(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveDashboardEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(buildEmployerDashboardFromEvidence(r.data));
}
export async function computeRecruiterDashboard(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveDashboardEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(buildRecruiterDashboardFromEvidence(r.data));
}
export async function computeTalentDashboard(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveDashboardEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(buildTalentDashboardFromEvidence(r.data));
}
export async function computeDashboardOverview(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveDashboardEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(buildDashboardOverviewFromEvidence(r.data));
}
