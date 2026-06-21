/**
 * PHASE 5.12 — skill_inventory engine.
 *
 * A deterministic, coverage-gated SUPPLY/DEMAND inventory of the skills recorded across an
 * employer's workforce (compose-never-recompute; PURE READ):
 *   - SUPPLY  : distinct skills recorded on the employer's candidates (employer_candidates.skills).
 *   - DEMAND  : distinct skills required by the employer's open roles (employer_jobs.skills).
 *   - canonicalized against the global `skills` reference (case-insensitive canonical_name) and
 *     enriched with the reference market_demand_score / future_relevance_score where recognized.
 *
 * This is a descriptive inventory of operator-recorded skills — NOT a hiring/suitability verdict.
 * Unmeasured ⇒ null/empty, never fabricated; every output carries Coverage + disclaimer + provenance.
 */

import type { Pool } from 'pg';
import {
  type EngineResult, type WorkforceEvidence,
  ok, round1, relExists,
  resolveWorkforceEvidence, workforceSummary,
  WORKFORCE_INTELLIGENCE_VERSION, WORKFORCE_INTELLIGENCE_DISCLAIMER, PROVENANCE,
} from './workforce-intelligence-shared';

export interface SkillRefEntry {
  canonical_name: string;
  skill_category: string | null;
  market_demand_score: number | null;
  future_relevance_score: number | null;
}
export type SkillReference = Map<string, SkillRefEntry>; // key = lowercased canonical_name

const numOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** READ-ONLY load of the global `skills` reference (canonical names + market enrichment). */
export async function loadSkillReference(pool: Pool): Promise<SkillReference> {
  const ref: SkillReference = new Map();
  if (!(await relExists(pool, 'skills'))) return ref;
  try {
    const r = await pool.query(
      `SELECT canonical_name, skill_category, market_demand_score, future_relevance_score
         FROM skills WHERE is_active IS NOT FALSE`,
    );
    for (const row of r.rows) {
      if (typeof row.canonical_name !== 'string' || row.canonical_name.trim() === '') continue;
      const name = row.canonical_name.trim();
      ref.set(name.toLowerCase(), {
        canonical_name: name,
        skill_category: typeof row.skill_category === 'string' ? row.skill_category : null,
        market_demand_score: numOrNull(row.market_demand_score),
        future_relevance_score: numOrNull(row.future_relevance_score),
      });
    }
  } catch { /* degrade to empty reference */ }
  return ref;
}

export function computeSkillInventoryFromEvidence(ev: WorkforceEvidence, ref: SkillReference) {
  // accumulate supply (candidates) and demand (jobs), keyed case-insensitively.
  interface Acc { display: string; supply: number; demand: number; }
  const map = new Map<string, Acc>();
  const touch = (name: string): Acc => {
    const k = name.toLowerCase();
    if (!map.has(k)) map.set(k, { display: name, supply: 0, demand: 0 });
    return map.get(k)!;
  };

  let candidatesWithSkills = 0;
  for (const c of ev.candidates) {
    if (c.skills.length > 0) candidatesWithSkills += 1;
    for (const s of c.skills) touch(s).supply += 1;
  }
  let jobsWithSkills = 0;
  for (const j of ev.jobs) {
    if (j.required_skills.length > 0) jobsWithSkills += 1;
    for (const s of j.required_skills) touch(s).demand += 1;
  }

  let recognized = 0;
  const skills = Array.from(map.entries()).map(([k, a]) => {
    const refEntry = ref.get(k) ?? null;
    if (refEntry) recognized += 1;
    return {
      skill: refEntry ? refEntry.canonical_name : a.display,
      recognized: refEntry != null,
      skill_category: refEntry?.skill_category ?? null,
      supply_count: a.supply,
      demand_count: a.demand,
      market_demand_score: refEntry?.market_demand_score ?? null,
      future_relevance_score: refEntry?.future_relevance_score ?? null,
    };
  });

  // deterministic ordering: supply desc, demand desc, name asc.
  skills.sort((x, y) =>
    (y.supply_count - x.supply_count) ||
    (y.demand_count - x.demand_count) ||
    x.skill.localeCompare(y.skill),
  );

  const totalDistinct = skills.length;
  const unmet_demand = skills
    .filter((s) => s.demand_count > 0 && s.supply_count === 0)
    .map((s) => ({ skill: s.skill, demand_count: s.demand_count, recognized: s.recognized }));

  return {
    engine: 'skill_inventory',
    output: 'skill_inventory',
    version: WORKFORCE_INTELLIGENCE_VERSION,
    employer_id: ev.employer_id,
    total_distinct_skills: totalDistinct,
    recognized_skills: recognized,
    recognized_pct: totalDistinct > 0 ? round1((recognized / totalDistinct) * 100) : 0,
    supply_coverage_pct: ev.candidates.length > 0 ? round1((candidatesWithSkills / ev.candidates.length) * 100) : 0,
    demand_coverage_pct: ev.jobs.length > 0 ? round1((jobsWithSkills / ev.jobs.length) * 100) : 0,
    reference_loaded: ref.size,
    skills,
    top_skills: skills.slice(0, 20),
    unmet_demand_skills: unmet_demand,
    evidence: workforceSummary(ev),
    provenance: PROVENANCE,
    disclaimer: WORKFORCE_INTELLIGENCE_DISCLAIMER,
  };
}

export async function computeSkillInventory(pool: Pool, employerId: string): Promise<EngineResult> {
  const r = await resolveWorkforceEvidence(pool, employerId);
  if (!r.ok) return r;
  const ref = await loadSkillReference(pool);
  return ok(computeSkillInventoryFromEvidence(r.data, ref));
}
