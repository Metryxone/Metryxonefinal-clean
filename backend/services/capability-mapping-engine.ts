/**
 * PHASE 5.12 — capability_mapping engine.
 *
 * A deterministic, coverage-gated Capability Heatmap: a DEPARTMENT × COMPETENCY grid of mean
 * operator-recorded proficiency (compose-never-recompute; PURE READ). Each cell folds the
 * employer's candidates' competency_profile values for that (department, competency); absent
 * evidence ⇒ the cell abstains (mean = null), never 0. When the employer has recorded competency
 * TARGETS (employer_competency_roles.proficiency_targets), a directional gap (mean − target) is
 * surfaced — otherwise the gap abstains.
 *
 * This maps where operator-recorded capability is concentrated — NOT a hiring/promotion verdict.
 * Every output carries Coverage + disclaimer + provenance.
 */

import type { Pool } from 'pg';
import {
  type EngineResult, type WorkforceEvidence, type WorkforceCandidate,
  ok, round1, bandFor, meanPresent,
  resolveWorkforceEvidence, workforceSummary,
  WORKFORCE_INTELLIGENCE_VERSION, WORKFORCE_INTELLIGENCE_DISCLAIMER, PROVENANCE,
} from './workforce-intelligence-shared';

function groupByDept(cands: WorkforceCandidate[]): Array<[string, WorkforceCandidate[]]> {
  const m = new Map<string, WorkforceCandidate[]>();
  for (const c of cands) {
    const k = c.department ?? '';
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(c);
  }
  return Array.from(m.entries()).sort((a, b) => {
    if (a[0] === '' && b[0] !== '') return 1;
    if (b[0] === '' && a[0] !== '') return -1;
    return a[0].localeCompare(b[0]);
  });
}

export function computeCapabilityHeatmapFromEvidence(ev: WorkforceEvidence) {
  // union of competency names across all candidates (deterministic, sorted).
  const compNames = new Set<string>();
  for (const c of ev.candidates) for (const x of c.competencies) compNames.add(x.name);
  const competencies = Array.from(compNames).sort((a, b) => a.localeCompare(b));

  // target lookup: exact (dept, competency) first; else org-wide (department == null) target.
  const exactTarget = new Map<string, number>();
  const globalTarget = new Map<string, number>();
  for (const t of ev.competency_targets) {
    if (t.target == null) continue;
    if (t.department == null) {
      if (!globalTarget.has(t.competency.toLowerCase())) globalTarget.set(t.competency.toLowerCase(), t.target);
    } else {
      exactTarget.set(`${t.department.toLowerCase()}::${t.competency.toLowerCase()}`, t.target);
    }
  }
  const targetFor = (dept: string | null, comp: string): number | null => {
    if (dept != null) {
      const e = exactTarget.get(`${dept.toLowerCase()}::${comp.toLowerCase()}`);
      if (e != null) return e;
    }
    const g = globalTarget.get(comp.toLowerCase());
    return g != null ? g : null;
  };

  const deptGroups = groupByDept(ev.candidates);
  const rows = deptGroups.map(([dept, members]) => {
    const cells = competencies.map((comp) => {
      const vals: Array<number | null> = members.map((m) => {
        const hit = m.competencies.find((x) => x.name === comp);
        return hit ? hit.value : null;
      });
      const mp = meanPresent(vals);
      const target = targetFor(dept === '' ? null : dept, comp);
      const gap = mp.mean != null && target != null ? round1(mp.mean - target) : null;
      return {
        competency: comp,
        mean: mp.mean,
        band: bandFor(mp.mean),
        measured: mp.n,
        coverage_pct: members.length > 0 ? round1((mp.n / members.length) * 100) : 0,
        target,
        gap,
      };
    });
    return {
      department: dept === '' ? null : dept,
      headcount: members.length,
      cells,
    };
  });

  const withCompetency = ev.candidates.filter((c) => c.competencies.some((x) => x.value != null)).length;
  return {
    engine: 'capability_mapping',
    output: 'capability_heatmap',
    version: WORKFORCE_INTELLIGENCE_VERSION,
    employer_id: ev.employer_id,
    departments: rows.map((r) => r.department),
    competencies,
    rows,
    coverage_pct: ev.candidates.length > 0 ? round1((withCompetency / ev.candidates.length) * 100) : 0,
    targets_available: ev.competency_targets.length,
    evidence: workforceSummary(ev),
    provenance: PROVENANCE,
    disclaimer: WORKFORCE_INTELLIGENCE_DISCLAIMER,
  };
}

export async function computeCapabilityHeatmap(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveWorkforceEvidence(pool, employerId);
  if (!r.ok) return r;
  return ok(computeCapabilityHeatmapFromEvidence(r.data));
}
