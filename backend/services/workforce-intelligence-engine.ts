/**
 * PHASE 5.12 — workforce_intelligence_engine.
 *
 * Three workforce-level DEVELOPMENTAL outputs, each a deterministic, coverage-gated, null-abstaining
 * fold of OPERATOR-RECORDED evidence (compose-never-recompute; PURE READ):
 *   - Team Competency Profile : per JOB (team/role) — a team competency index + per-competency means.
 *   - Department Readiness    : per DEPARTMENT — a developmental readiness index over its candidates.
 *   - Talent Distribution     : descriptive spread of candidates across department / stage / band.
 *
 * None of these is a hiring/promotion/suitability prediction or verdict — they aggregate human inputs.
 * Unmeasured signals abstain (null), never 0; every output carries Coverage + disclaimer + provenance.
 */

import type { Pool } from 'pg';
import {
  type EngineResult, type WorkforceEvidence, type WorkforceCandidate, type CompositeResult,
  ok, composite, meanPresent, bandFor, round1,
  resolveWorkforceEvidence, workforceSummary,
  WORKFORCE_INTELLIGENCE_VERSION, WORKFORCE_INTELLIGENCE_DISCLAIMER, PROVENANCE,
} from './workforce-intelligence-shared';

// ── per-candidate folds ──────────────────────────────────────────────────────
/** Mean (%) of a candidate's measured competency values; null when none measured. */
function candidateCompetencyMean(c: WorkforceCandidate): number | null {
  return meanPresent(c.competencies.map((x) => x.value)).mean;
}

/** Per-candidate developmental readiness composite (shared weights with Department Readiness). */
export function candidateReadiness(c: WorkforceCandidate): CompositeResult {
  return composite([
    { key: 'assessment', label: 'Assessment Score', weight: 0.35, value: c.assessment_score, source: 'employer_candidates.assessment_score' },
    { key: 'competency', label: 'Competency Profile', weight: 0.30, value: candidateCompetencyMean(c), source: 'employer_candidates.competency_profile' },
    { key: 'match', label: 'Match Score', weight: 0.20, value: c.match_score, source: 'employer_candidates.match_score' },
    { key: 'ei', label: 'EI Score', weight: 0.15, value: c.ei_score, source: 'employer_candidates.ei_score' },
  ]);
}

// group helper — stable order by key (null/empty group rendered with key '').
function groupBy<T>(rows: T[], keyOf: (r: T) => string): Array<[string, T[]]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return Array.from(m.entries()).sort((a, b) => {
    // unassigned ('') always last; otherwise lexical
    if (a[0] === '' && b[0] !== '') return 1;
    if (b[0] === '' && a[0] !== '') return -1;
    return a[0].localeCompare(b[0]);
  });
}

// ── Team Competency Profile (per job) ────────────────────────────────────────
export function computeTeamCompetencyProfileFromEvidence(ev: WorkforceEvidence) {
  const jobById = new Map(ev.jobs.map((j) => [j.id, j]));
  // only candidates bound to one of THIS employer's jobs form a team.
  const bound = ev.candidates.filter((c) => c.bound_to_employer_job && c.job_id != null);
  const groups = groupBy(bound, (c) => String(c.job_id));

  const teams = groups.map(([jobId, members]) => {
    const job = jobById.get(jobId) ?? null;
    const teamCompetency = meanPresent(members.map(candidateCompetencyMean)).mean;
    const teamAssessment = meanPresent(members.map((c) => c.assessment_score)).mean;
    const teamEi = meanPresent(members.map((c) => c.ei_score)).mean;
    const teamRating = meanPresent(members.map((c) => c.rating)).mean;
    const index = composite([
      { key: 'competency', label: 'Team Competency', weight: 0.4, value: teamCompetency, source: 'employer_candidates.competency_profile' },
      { key: 'assessment', label: 'Team Assessment', weight: 0.3, value: teamAssessment, source: 'employer_candidates.assessment_score' },
      { key: 'ei', label: 'Team EI', weight: 0.2, value: teamEi, source: 'employer_candidates.ei_score' },
      { key: 'rating', label: 'Team Rating', weight: 0.1, value: teamRating, source: 'employer_candidates.rating' },
    ]);

    // per-competency means across the team
    const names = new Set<string>();
    for (const m of members) for (const c of m.competencies) names.add(c.name);
    const per_competency = Array.from(names).sort((a, b) => a.localeCompare(b)).map((name) => {
      const vals: Array<number | null> = members.map((m) => {
        const hit = m.competencies.find((x) => x.name === name);
        return hit ? hit.value : null;
      });
      const mp = meanPresent(vals);
      return {
        competency: name,
        mean: mp.mean,
        band: bandFor(mp.mean),
        measured_members: mp.n,
        coverage_pct: members.length > 0 ? round1((mp.n / members.length) * 100) : 0,
      };
    });

    return {
      job_id: jobId,
      role: job?.title ?? null,
      department: job?.department ?? null,
      headcount: members.length,
      team_competency_index: index.value,
      band: index.band,
      coverage_pct: index.coverage_pct,
      contributors: index.contributors,
      per_competency,
    };
  });

  const unbound = ev.candidates.length - bound.length;
  return {
    engine: 'workforce_intelligence_engine',
    output: 'team_competency_profile',
    version: WORKFORCE_INTELLIGENCE_VERSION,
    employer_id: ev.employer_id,
    teams,
    teams_count: teams.length,
    candidates_in_teams: bound.length,
    candidates_unassigned: unbound,
    coverage_pct: ev.candidates.length > 0 ? round1((bound.length / ev.candidates.length) * 100) : 0,
    evidence: workforceSummary(ev),
    provenance: PROVENANCE,
    disclaimer: WORKFORCE_INTELLIGENCE_DISCLAIMER,
  };
}

// ── Department Readiness (per department) ────────────────────────────────────
export function computeDepartmentReadinessFromEvidence(ev: WorkforceEvidence) {
  const groups = groupBy(ev.candidates, (c) => c.department ?? '');
  const departments = groups.map(([dept, members]) => {
    const mAssessment = meanPresent(members.map((c) => c.assessment_score)).mean;
    const mCompetency = meanPresent(members.map(candidateCompetencyMean)).mean;
    const mMatch = meanPresent(members.map((c) => c.match_score)).mean;
    const mEi = meanPresent(members.map((c) => c.ei_score)).mean;
    const index = composite([
      { key: 'assessment', label: 'Assessment', weight: 0.35, value: mAssessment, source: 'employer_candidates.assessment_score' },
      { key: 'competency', label: 'Competency', weight: 0.30, value: mCompetency, source: 'employer_candidates.competency_profile' },
      { key: 'match', label: 'Match', weight: 0.20, value: mMatch, source: 'employer_candidates.match_score' },
      { key: 'ei', label: 'EI', weight: 0.15, value: mEi, source: 'employer_candidates.ei_score' },
    ]);
    const measured = members.filter((c) => candidateReadiness(c).value != null).length;
    return {
      department: dept === '' ? null : dept,
      headcount: members.length,
      measured_candidates: measured,
      department_readiness_index: index.value,
      band: index.band,
      coverage_pct: index.coverage_pct,
      contributors: index.contributors,
    };
  });

  return {
    engine: 'workforce_intelligence_engine',
    output: 'department_readiness',
    version: WORKFORCE_INTELLIGENCE_VERSION,
    employer_id: ev.employer_id,
    departments,
    departments_count: departments.filter((d) => d.department != null).length,
    has_unassigned: departments.some((d) => d.department == null),
    evidence: workforceSummary(ev),
    provenance: PROVENANCE,
    disclaimer: WORKFORCE_INTELLIGENCE_DISCLAIMER,
  };
}

// ── Talent Distribution (descriptive spread) ─────────────────────────────────
export function computeTalentDistributionFromEvidence(ev: WorkforceEvidence) {
  const cands = ev.candidates;

  // by department
  const deptGroups = groupBy(cands, (c) => c.department ?? '');
  const by_department = deptGroups.map(([dept, members]) => {
    const idx = meanPresent(members.map((c) => candidateReadiness(c).value)).mean;
    return {
      department: dept === '' ? null : dept,
      headcount: members.length,
      mean_readiness_index: idx,
      band: bandFor(idx),
    };
  });

  // by stage
  const stageGroups = groupBy(cands, (c) => c.stage ?? '');
  const by_stage = stageGroups.map(([stage, members]) => ({
    stage: stage === '' ? null : stage,
    headcount: members.length,
  }));

  // by readiness band (per-candidate index); unmeasured tracked separately
  const bandCounts: Record<string, number> = { high: 0, moderate: 0, developing: 0, low: 0 };
  let unmeasured = 0;
  for (const c of cands) {
    const v = candidateReadiness(c).value;
    const b = bandFor(v);
    if (b == null) unmeasured += 1;
    else bandCounts[b] += 1;
  }
  const measured = cands.length - unmeasured;

  return {
    engine: 'workforce_intelligence_engine',
    output: 'talent_distribution',
    version: WORKFORCE_INTELLIGENCE_VERSION,
    employer_id: ev.employer_id,
    total_candidates: cands.length,
    measured_candidates: measured,
    coverage_pct: cands.length > 0 ? round1((measured / cands.length) * 100) : 0,
    by_department,
    by_stage,
    by_readiness_band: {
      high: bandCounts.high,
      moderate: bandCounts.moderate,
      developing: bandCounts.developing,
      low: bandCounts.low,
      unmeasured,
    },
    evidence: workforceSummary(ev),
    provenance: PROVENANCE,
    disclaimer: WORKFORCE_INTELLIGENCE_DISCLAIMER,
  };
}

// ── pool wrappers (single evidence load each) ────────────────────────────────
export async function computeTeamCompetencyProfile(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveWorkforceEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(computeTeamCompetencyProfileFromEvidence(r.data));
}
export async function computeDepartmentReadiness(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveWorkforceEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(computeDepartmentReadinessFromEvidence(r.data));
}
export async function computeTalentDistribution(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveWorkforceEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(computeTalentDistributionFromEvidence(r.data));
}
