/**
 * Role-Fit Engine — Phase 5
 *
 * Deterministic, evidence-backed computation of how well a resolved profile
 * fits a target occupation. Every dimension records its inputs and the
 * matched/missing entities so the UI can render full provenance.
 *
 * Reads:
 *   - occupation_skills (requires/important/optional with weights)
 *   - skills, certifications, qualifications (canonical)
 *   - inferred_skills (subject → implied, weight-discounted by confidence)
 *   - market_demand_models (optional market signal for tie-breaking)
 *
 * Writes:
 *   - role_fit_scores (audit row; non-blocking from caller)
 */

import type { Pool } from 'pg';
import { expandSkillSet } from './skill-graph';
import { getMarketDemand } from './market-intelligence';
import type { ResolverOutput } from './ei-resolver';

export interface RoleFitInput {
  user_id?:         string | null;
  request_id?:      string | null;
  occupation_id:    string;
  resolution:       ResolverOutput;
  experience_count?: number;
  region?:          string;
  ruleset_version?: string | null;
}

export interface RoleFitDimensionTrace {
  key:            string;
  formula:        string;
  inputs:         Record<string, unknown>;
  intermediate?:  Record<string, unknown>;
  contribution:   number;        // contribution to final fit_score
  cap:            number;
}

export interface RoleFitOutput {
  occupation_id:               string;
  occupation_title:            string;
  fit_score:                   number;       // 0..100
  band:                        'Strong' | 'Stretch' | 'Aspiration' | 'Misaligned';
  skill_match_score:           number;
  qualification_match_score:   number;
  certification_match_score:   number;
  experience_match_score:      number;
  market_fit_score:            number;
  matched_skills:              Array<{ skill_id: string; canonical_name: string; importance: string; source: 'declared' | 'inferred'; weight_applied: number; inference_basis?: string; inference_confidence?: number; evidence_ref?: Record<string, unknown> }>;
  missing_essential:           Array<{ skill_id: string; canonical_name: string; weight: number }>;
  missing_important:           Array<{ skill_id: string; canonical_name: string; weight: number }>;
  recommendations:             Array<{ type: 'add_skill' | 'add_certification' | 'gain_experience'; target: string; rationale: string; expected_delta: number; evidence_ref: Record<string, unknown> }>;
  trace:                       RoleFitDimensionTrace[];
  market:                      Awaited<ReturnType<typeof getMarketDemand>>;
  computation_ms:              number;
  occupation_dataset_version:  string;
  ei_version:                  string;
  ruleset_version:             string | null;
}

const BAND = (score: number): RoleFitOutput['band'] =>
  score >= 80 ? 'Strong' : score >= 60 ? 'Stretch' : score >= 40 ? 'Aspiration' : 'Misaligned';

const CAP_SKILL          = 55;   // total weight allocated to skill match
const CAP_QUALIFICATION  = 15;
const CAP_CERTIFICATION  = 10;
const CAP_EXPERIENCE     = 15;
const CAP_MARKET         = 5;    // small market-signal contribution (deterministic, tie-breaker)

export async function computeRoleFit(pool: Pool, input: RoleFitInput): Promise<RoleFitOutput> {
  const t0 = Date.now();
  // Phase 4 + 5 reproducibility guard: persisted role-fit rows MUST carry
  // a non-null ruleset_version so the calc is structurally replayable.
  if (!input.ruleset_version) {
    throw new Error('computeRoleFit: ruleset_version is required for reproducibility');
  }

  // 1) Occupation + required skills
  const occRow = await pool.query(
    `SELECT id, canonical_title, role_family, seniority_level FROM occupations WHERE id=$1 AND is_active`,
    [input.occupation_id],
  );
  if (!occRow.rowCount) throw new Error(`Occupation not found: ${input.occupation_id}`);
  const occupation = occRow.rows[0];

  // Deterministic ordering: weight DESC then skill_id ASC (stable tiebreaker)
  // so missingEss.slice(0,5) / missingImp.slice(0,3) always picks the same items.
  const reqRows = await pool.query(
    `SELECT os.skill_id, s.canonical_name, os.importance, os.weight::float, os.evidence_ref, os.dataset_version
       FROM occupation_skills os
       JOIN skills s ON s.id = os.skill_id
      WHERE os.occupation_id = $1
      ORDER BY (os.importance='essential') DESC, os.weight DESC, os.skill_id ASC`,
    [input.occupation_id],
  );
  const requirements = reqRows.rows;
  const datasetVersion = requirements[0]?.dataset_version || 'phase5.0';
  const totalReqWeight = requirements.reduce((a, r) => a + r.weight, 0) || 1;

  // 2) User's resolved skills (declared) + inferred expansion
  const declared = (input.resolution.skills || [])
    .filter(s => s.matched && s.canonical_id)
    .map(s => ({ id: s.canonical_id!, canonical_name: s.canonical_name! }));
  const expanded = await expandSkillSet(pool, declared);
  const expandedById = new Map(expanded.map(e => [e.skill_id, e]));

  // 3) Skill dimension — sum of (requirement weight × user weight)
  const matched: RoleFitOutput['matched_skills'] = [];
  const missingEss: RoleFitOutput['missing_essential'] = [];
  const missingImp: RoleFitOutput['missing_important'] = [];
  let skillRawScore = 0;
  for (const r of requirements) {
    const userSkill = expandedById.get(r.skill_id);
    if (userSkill) {
      const contrib = r.weight * userSkill.weight;
      skillRawScore += contrib;
      matched.push({
        skill_id: r.skill_id, canonical_name: r.canonical_name,
        importance: r.importance, source: userSkill.source,
        weight_applied: Number(contrib.toFixed(3)),
        // Full evidence chain for inferred contributions — UI must be able
        // to render "why this skill counted" even when it wasn't declared.
        ...(userSkill.source === 'inferred' ? {
          inference_basis:      userSkill.inference_basis,
          inference_confidence: userSkill.confidence,
          evidence_ref: {
            source: 'inferred_skills',
            basis: userSkill.inference_basis,
            confidence: userSkill.confidence,
            occupation_requirement_evidence: r.evidence_ref,
          },
        } : {
          evidence_ref: {
            source: 'declared',
            occupation_requirement_evidence: r.evidence_ref,
          },
        }),
      });
    } else {
      const item = { skill_id: r.skill_id, canonical_name: r.canonical_name, weight: r.weight };
      (r.importance === 'essential' ? missingEss : missingImp).push(item);
    }
  }
  const skillMatchScore = Math.round((skillRawScore / totalReqWeight) * CAP_SKILL * 100) / 100;

  // 4) Qualification dimension — heuristic: matched qualification at all → full credit.
  const qualMatched = !!input.resolution.qualification?.matched;
  const qualificationMatchScore = qualMatched ? CAP_QUALIFICATION : 0;

  // 5) Certification dimension — proportional to matched certs (cap at 3 matched).
  const matchedCerts = (input.resolution.certifications || []).filter(c => c.matched).length;
  const certificationMatchScore = Math.round(Math.min(matchedCerts, 3) / 3 * CAP_CERTIFICATION * 100) / 100;

  // 6) Experience dimension — proxy from experience_count. Role-fit doesn't yet
  //    know minimum YOE per occupation; future iteration may extend the schema.
  const exp = Math.min(Math.max(input.experience_count || 0, 0), 10);
  const experienceMatchScore = Math.round((exp / 5) * CAP_EXPERIENCE * 100) / 100;

  // 7) Market dimension — pulls a small, deterministic signal from market_demand_models.
  //    Used as a tie-breaker between equally-fit roles; never dominates.
  const market = await getMarketDemand(pool, input.occupation_id, input.region || 'IN');
  let marketFitScore = 0;
  if (market) {
    const demandFactor = market.demand_score / 100;
    const futureFactor = market.future_relevance_score / 100;
    marketFitScore = Math.round((demandFactor * 0.6 + futureFactor * 0.4) * CAP_MARKET * 100) / 100;
  }

  // 8) Final
  const rawFit = skillMatchScore + qualificationMatchScore + certificationMatchScore + experienceMatchScore + marketFitScore;
  const fit = Math.max(0, Math.min(100, Math.round(rawFit * 100) / 100));

  // 9) Recommendations — derived from missing requirements; each carries
  //    expected_delta if the user closed the gap (deterministic from weights).
  const recommendations: RoleFitOutput['recommendations'] = [];
  for (const m of missingEss.slice(0, 5)) {
    const delta = Number(((m.weight / totalReqWeight) * CAP_SKILL).toFixed(2));
    recommendations.push({
      type: 'add_skill', target: m.canonical_name,
      rationale: `${m.canonical_name} is essential for ${occupation.canonical_title}`,
      expected_delta: delta,
      evidence_ref: { source: 'occupation_skills', dataset_version: datasetVersion, importance: 'essential' },
    });
  }
  for (const m of missingImp.slice(0, 3)) {
    const delta = Number(((m.weight / totalReqWeight) * CAP_SKILL * 0.6).toFixed(2));
    recommendations.push({
      type: 'add_skill', target: m.canonical_name,
      rationale: `${m.canonical_name} is important for ${occupation.canonical_title}`,
      expected_delta: delta,
      evidence_ref: { source: 'occupation_skills', dataset_version: datasetVersion, importance: 'important' },
    });
  }
  if (!qualMatched) {
    recommendations.push({
      type: 'add_skill', target: 'recognised qualification',
      rationale: 'A canonical qualification on file raises fit by 15 points',
      expected_delta: CAP_QUALIFICATION,
      evidence_ref: { source: 'role_fit_engine', dimension: 'qualification' },
    });
  }
  if (matchedCerts < 3) {
    recommendations.push({
      type: 'add_certification', target: 'role-relevant certification',
      rationale: `Each relevant certification (up to 3) adds ≈ ${(CAP_CERTIFICATION / 3).toFixed(1)} points`,
      expected_delta: Number((CAP_CERTIFICATION / 3).toFixed(2)),
      evidence_ref: { source: 'role_fit_engine', dimension: 'certification' },
    });
  }

  // 10) Trace
  const trace: RoleFitDimensionTrace[] = [
    { key: 'skill_match', formula: 'sum(req_weight * user_weight) / total_req_weight * cap',
      inputs: { requirements: requirements.length, matched: matched.length, missing_essential: missingEss.length, missing_important: missingImp.length },
      intermediate: { skill_raw_score: Number(skillRawScore.toFixed(3)), total_req_weight: Number(totalReqWeight.toFixed(3)) },
      contribution: skillMatchScore, cap: CAP_SKILL },
    { key: 'qualification_match', formula: 'matched ? cap : 0',
      inputs: { matched: qualMatched }, contribution: qualificationMatchScore, cap: CAP_QUALIFICATION },
    { key: 'certification_match', formula: 'min(matched, 3) / 3 * cap',
      inputs: { matched_certs: matchedCerts }, contribution: certificationMatchScore, cap: CAP_CERTIFICATION },
    { key: 'experience_match', formula: 'min(years, 10) / 5 * cap',
      inputs: { experience_count: exp }, contribution: experienceMatchScore, cap: CAP_EXPERIENCE },
    { key: 'market_fit', formula: '(demand*0.6 + future_relevance*0.4) * cap',
      inputs: market ? { demand_score: market.demand_score, future_relevance: market.future_relevance_score, dataset_version: market.dataset_version } : { source: 'no_market_data' },
      contribution: marketFitScore, cap: CAP_MARKET },
  ];

  // 11) Persist non-blocking
  pool.query(
    `INSERT INTO role_fit_scores
       (user_id, request_id, occupation_id, fit_score, skill_match_score, qualification_match_score,
        certification_match_score, experience_match_score, market_fit_score, band,
        matched_skills, missing_essential, missing_important, recommendations, trace,
        ei_version, ruleset_version, occupation_dataset_version, computation_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'4.0',$16,$17,$18)`,
    [
      input.user_id || null, input.request_id || null, input.occupation_id,
      fit, skillMatchScore, qualificationMatchScore, certificationMatchScore, experienceMatchScore, marketFitScore,
      BAND(fit),
      JSON.stringify(matched), JSON.stringify(missingEss), JSON.stringify(missingImp),
      JSON.stringify(recommendations), JSON.stringify(trace),
      input.ruleset_version || null, datasetVersion, Date.now() - t0,
    ],
  ).catch(err => console.warn('[role-fit] persist failed (non-blocking)', err.message));

  return {
    occupation_id: input.occupation_id,
    occupation_title: occupation.canonical_title,
    fit_score: fit, band: BAND(fit),
    skill_match_score: skillMatchScore,
    qualification_match_score: qualificationMatchScore,
    certification_match_score: certificationMatchScore,
    experience_match_score: experienceMatchScore,
    market_fit_score: marketFitScore,
    matched_skills: matched,
    missing_essential: missingEss,
    missing_important: missingImp,
    recommendations, trace, market,
    computation_ms: Date.now() - t0,
    occupation_dataset_version: datasetVersion,
    ei_version: '4.0', ruleset_version: input.ruleset_version || null,
  };
}

/**
 * Top-N role matches for a profile. Computes role-fit against every active
 * occupation and returns the highest-scoring N.
 */
export async function findTopRoleMatches(
  pool: Pool, resolution: ResolverOutput, experience_count = 0, n = 10, region = 'IN', userId?: string | null, rulesetVersion?: string | null,
): Promise<RoleFitOutput[]> {
  if (!rulesetVersion) throw new Error('findTopRoleMatches: rulesetVersion required');
  // Deterministic occupation scan: ORDER BY id so results are reproducible
  // and slice/cutoffs land on identical rows across calls.
  const occs = await pool.query(
    `SELECT id FROM occupations WHERE is_active ORDER BY id ASC LIMIT 100`,
  );
  const results: RoleFitOutput[] = [];
  for (const row of occs.rows) {
    try {
      const fit = await computeRoleFit(pool, {
        occupation_id: row.id, resolution, experience_count, region,
        user_id: userId, ruleset_version: rulesetVersion,
      });
      results.push(fit);
    } catch { /* skip occupations with no requirements seeded */ }
  }
  // Stable sort: fit_score DESC, then occupation_id ASC as tiebreaker — so
  // equally-fit roles always rank in the same order across calls.
  return results
    .sort((a, b) => b.fit_score - a.fit_score || a.occupation_id.localeCompare(b.occupation_id))
    .slice(0, n);
}
