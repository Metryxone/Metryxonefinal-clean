/**
 * Phase 3 — Recommendation Engine.
 *
 * Produces ranked developmental recommendations from a user's role comparison
 * + suggested pathways. Output is strictly developmental — never asserts
 * hiring outcomes, candidate suitability, or promotion likelihood.
 *
 * Permitted language: developmental readiness · capability proximity ·
 * alignment indicators · development opportunity.
 */

import type { Pool } from 'pg';
import { compareRoles, RoleComparison } from './mobility-engine.js';
import { suggestPathways, personalisedPathway } from './pathway-engine.js';

export const RECOMMENDATION_VERSION = '5.0.0';

export type RecCategory = 'competency_development' | 'leadership_growth' |
                          'role_progression' | 'transferable_strength' |
                          'adjacent_opportunity' | 'pathway_sequencing';

/** P-R4 W2: User profile for personalization. All fields optional — missing fields degrade gracefully. */
export interface UserProfile {
  seniority_level?: 'junior' | 'mid' | 'senior' | 'lead' | 'director' | 'c_suite';
  domain?: string;
  career_stage?: 'exploring' | 'building' | 'accelerating' | 'transitioning' | 'scaling';
  weeks_experience?: number;
}

export interface Recommendation {
  id: string;
  category: RecCategory;
  title: string;
  rationale: string;
  evidence: Record<string, unknown>;
  developmental_actions: string[];
  estimated_weeks: number | null;
  priority: 'high' | 'medium' | 'low';
  alignment_indicators: string[];
  /** W2 P-R3A: Confidence (0–1) derived from evidence quantity + gap certainty. */
  confidence: number;
  /** W2 P-R3A: Provenance — which intelligence sources fed this recommendation. */
  provenance: string[];
  /** P-R4 W4: Quality score 0–100 (specificity × confidence × evidence richness). */
  quality_score: number;
  /** P-R4 W4: Quality grade derived from quality_score. */
  quality_grade: 'A' | 'B' | 'C' | 'D';
  /** P-R4 W4: 1-based rank within this bundle (lower = higher priority). */
  ranking_position: number;
  /** P-R4 W2: Whether user_profile was applied to personalize this rec. */
  personalization_applied: boolean;
  /** P-R5 W4: 0–1 heuristic probability of successful development outcome. */
  success_probability: number;
  /** P-R5 W4: Richer narrative combining rationale + confidence + priority context. */
  explanation: string;
  /** P-R5 W4: 0–1 weight reflecting this category's typical development outcome strength. */
  outcome_weight: number;
}

export interface RecommendationBundle {
  context: { from_role_id: string; to_role_id: string };
  comparison: RoleComparison;
  recommendations: Recommendation[];
  generated_at: string;
  version: string;
  /** P-R4 W2: true when a user_profile was supplied and applied to personalization. */
  personalization_applied: boolean;
  language_policy: {
    allowed: string[];
    disallowed: string[];
  };
}

// ── P-R4 W4: Quality scoring ─────────────────────────────────────────────────

function computeQualityScore(r: {
  confidence: number; evidence: Record<string, unknown>;
  developmental_actions: string[]; alignment_indicators: string[];
  personalization_applied: boolean;
}): number {
  const evidenceRichness = Math.min(1, Object.keys(r.evidence).length / 5);
  const actionSpecificity = Math.min(1, r.developmental_actions.length / 4);
  const indicatorDepth = Math.min(1, r.alignment_indicators.length / 3);
  const personalizationBonus = r.personalization_applied ? 0.05 : 0;
  const raw = (r.confidence * 0.40) + (evidenceRichness * 0.25) + (actionSpecificity * 0.20) + (indicatorDepth * 0.10) + personalizationBonus;
  return Math.round(Math.min(100, raw * 100));
}

function qualityGrade(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

// ── P-R5 W4: New intelligence helpers ────────────────────────────────────────

/** 0–1 heuristic probability of successful development outcome. */
function computeSuccessProbability(r: {
  confidence: number; estimated_weeks: number | null; priority: 'high' | 'medium' | 'low';
}): number {
  const timelineFactor = r.estimated_weeks
    ? Math.max(0.3, Math.min(1, 12 / r.estimated_weeks))
    : 0.5;
  const priorityFactor = r.priority === 'high' ? 0.85 : r.priority === 'medium' ? 0.72 : 0.60;
  const raw = r.confidence * 0.50 + timelineFactor * 0.30 + priorityFactor * 0.20;
  return Math.round(Math.min(0.95, raw) * 100) / 100;
}

/** Category-level outcome weight from developmental research alignment. */
function computeOutcomeWeight(category: RecCategory): number {
  const w: Record<RecCategory, number> = {
    competency_development: 0.80,
    leadership_growth: 0.75,
    role_progression: 0.70,
    transferable_strength: 0.65,
    pathway_sequencing: 0.78,
    adjacent_opportunity: 0.55,
  };
  return w[category] ?? 0.65;
}

/** Richer narrative combining rationale + confidence + priority framing. */
function buildExplanation(
  rationale: string, confidence: number, priority: 'high' | 'medium' | 'low',
): string {
  const cf = confidence >= 0.75 ? 'High-confidence finding'
           : confidence >= 0.55 ? 'Moderate-confidence indicator'
           : 'Early-stage signal';
  const act = priority === 'high'
    ? 'Prioritise this for the strongest developmental impact.'
    : priority === 'medium'
    ? 'Include in your development plan for sustained progress.'
    : 'Consider as part of your broader growth strategy.';
  return `${cf}: ${rationale} ${act}`;
}

/** Remove duplicate recommendations by normalised title key. */
function eliminateRedundancy(recs: Recommendation[]): Recommendation[] {
  const seen = new Set<string>();
  return recs.filter(r => {
    const key = r.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function generateRecommendations(pool: Pool, params: {
  from_role_id: string; to_role_id: string;
  user_scores: Record<string, number>;
  /** P-R4 W2: optional user profile for personalization. */
  user_profile?: UserProfile;
}): Promise<RecommendationBundle> {
  const comparison = await compareRoles(pool, params);
  const profile = params.user_profile || {};
  const personalized = !!(profile.seniority_level || profile.domain || profile.career_stage);

  const recs: Recommendation[] = [];
  let n = 1;
  const mk = (r: Omit<Recommendation, 'id' | 'quality_score' | 'quality_grade' | 'ranking_position' | 'success_probability' | 'explanation' | 'outcome_weight'>): Recommendation => {
    const quality_score = computeQualityScore(r);
    const success_probability = computeSuccessProbability(r);
    const outcome_weight = computeOutcomeWeight(r.category);
    const explanation = buildExplanation(r.rationale, r.confidence, r.priority);
    return {
      id: `rec_${n++}`,
      quality_score,
      quality_grade: qualityGrade(quality_score),
      ranking_position: 0,
      success_probability,
      explanation,
      outcome_weight,
      ...r,
    };
  };

  // ---- 1. Competency development priorities (top 3 weighted gaps) ----
  for (const p of comparison.development_priorities.slice(0, 3)) {
    const gap = comparison.competency_gaps.find(g => g.competency_id === p.competency_id);
    if (!gap) continue;
    const gapCertainty = Math.min(1, Math.abs(gap.gap) / 40);
    const gapConf = +(0.55 + gapCertainty * 0.35).toFixed(2);
    recs.push(mk({
      category: gap.category === 'leadership' ? 'leadership_growth' : 'competency_development',
      title: `Develop ${gap.canonical_name}`,
      rationale: p.reason,
      evidence: { gap: gap.gap, target_anchor: gap.target_anchor,
                  user_score: gap.user_score, weight: gap.weight, status: gap.status },
      developmental_actions: developmentActionsFor(gap, profile),
      estimated_weeks: estimateWeeksForGap(gap.gap, profile.seniority_level),
      priority: gap.status === 'priority' ? 'high' : 'medium',
      alignment_indicators: [
        `Closes a ${Math.abs(gap.gap)}-point capability proximity gap`,
        `Targets ${gap.category} cluster in target Role-DNA`,
        ...(profile.domain ? [`Relevant to ${profile.domain} domain context`] : []),
      ],
      confidence: gapConf,
      provenance: ['competency_gap_analysis', 'role_dna_comparison'],
      personalization_applied: personalized,
    }));
  }

  // ---- 2. Transferable strengths (top 3) ----
  for (const t of comparison.transferable_strengths.slice(0, 3)) {
    const portfolioWeeks = profile.seniority_level === 'junior' ? 3
                         : profile.seniority_level === 'senior' ? 1 : 2;
    recs.push(mk({
      category: 'transferable_strength',
      title: `Leverage ${t.canonical_name}`,
      rationale: `${t.transfer_type === 'identical' ? 'Direct match' : 'Transferable strength'}: ${t.rationale}.`,
      evidence: { transferability: t.transferability, user_score: t.user_score,
                  transfer_type: t.transfer_type },
      developmental_actions: [
        `Document concrete examples where you applied ${t.canonical_name} in your current role`,
        `Frame these in the language of the target role's expected outcomes`,
        ...(profile.career_stage === 'transitioning'
          ? [`Translate ${t.canonical_name} into a compelling transition narrative`] : []),
      ],
      estimated_weeks: portfolioWeeks,
      priority: t.transferability >= 0.8 ? 'high' : 'medium',
      alignment_indicators: [
        `${Math.round(t.transferability * 100)}% capability proximity to target competency`,
        ...(profile.seniority_level ? [`Calibrated for ${profile.seniority_level} seniority level`] : []),
      ],
      confidence: +Math.min(0.95, 0.5 + t.transferability * 0.45).toFixed(2),
      provenance: ['transferable_strength_engine', 'role_dna_comparison'],
      personalization_applied: personalized,
    }));
  }

  // ---- 3. Role progression (mobility) ----
  const mobilityConf = +Math.min(0.92, 0.45 + comparison.mobility_score / 200).toFixed(2);
  const mobilityWeeks = profile.seniority_level === 'c_suite' ? 24
                      : profile.seniority_level === 'director' ? 18
                      : profile.seniority_level === 'senior' || profile.seniority_level === 'lead' ? 12
                      : profile.seniority_level === 'junior' ? 20
                      : 12;
  recs.push(mk({
    category: 'role_progression',
    title: `Developmental readiness for ${params.to_role_id}`,
    rationale: `Overlap ${comparison.overlap_score}%, transferability ${comparison.transferability_score}%, capability gap-coverage ${comparison.gap_size_score}%.`,
    evidence: {
      overlap_score: comparison.overlap_score,
      transferability_score: comparison.transferability_score,
      gap_size_score: comparison.gap_size_score,
      mobility_score: comparison.mobility_score,
      ...(profile.seniority_level ? { seniority_calibrated: profile.seniority_level } : {}),
    },
    developmental_actions: [
      `Focus on the top ${Math.min(3, comparison.development_priorities.length)} priority competencies`,
      `Validate progress through behavioural feedback every 6–8 weeks`,
      ...(profile.career_stage === 'transitioning' ? ['Build a transition narrative connecting current strengths to the target role'] : []),
      ...(profile.career_stage === 'scaling' ? ['Identify 2–3 executive sponsors who have made this transition'] : []),
    ],
    estimated_weeks: mobilityWeeks,
    priority: comparison.mobility_score >= 70 ? 'high'
            : comparison.mobility_score >= 50 ? 'medium' : 'low',
    alignment_indicators: [
      `Mobility composite ${comparison.mobility_score}/100`,
      `${comparison.transferable_strengths.length} transferable strengths identified`,
      ...(profile.seniority_level ? [`Timeline calibrated for ${profile.seniority_level} level`] : []),
    ],
    confidence: mobilityConf,
    provenance: ['mobility_composite', 'role_dna_comparison', 'competency_gap_analysis'],
    personalization_applied: personalized,
  }));

  // ---- 4. Pathway sequencing (best-matched developmental pathways) ----
  const priorityIds = comparison.development_priorities.map(p => p.competency_id);
  const pathways = await suggestPathways(pool, {
    competency_priorities: priorityIds, user_scores: params.user_scores, limit: 3 });
  for (const p of pathways) {
    if (p.relevance === 0) continue;
    recs.push(mk({
      category: 'pathway_sequencing',
      title: `Pathway: ${p.pathway.name}`,
      rationale: `Targets ${p.matched_priorities.length} of your top priorities (${p.pathway.category} category).`,
      evidence: {
        pathway_id: p.pathway.id, relevance: p.relevance,
        matched_priorities: p.matched_priorities,
        terminal_competency: p.pathway.terminal_competency_id,
        total_weeks: p.pathway.total_weeks,
        progress: p.summary?.progress ?? 0,
      },
      developmental_actions: [
        `Follow the ${p.pathway.name} sequence — ${p.summary?.total_steps ?? 0} steps`,
        `Estimated remaining time: ${p.summary?.remaining_weeks ?? p.pathway.total_weeks} weeks`,
        ...(profile.career_stage === 'exploring' ? ['This pathway also builds foundational capabilities for adjacent roles'] : []),
      ],
      estimated_weeks: p.summary?.remaining_weeks ?? p.pathway.total_weeks,
      priority: p.relevance >= 0.5 ? 'high' : 'medium',
      alignment_indicators: [
        `${Math.round(p.relevance * 100)}% alignment with current development priorities`,
        ...(profile.domain ? [`Pathway relevant to ${profile.domain} career context`] : []),
      ],
      confidence: +Math.min(0.90, 0.40 + p.relevance * 0.50).toFixed(2),
      provenance: ['pathway_library', 'competency_gap_analysis'],
      personalization_applied: personalized,
    }));
  }

  // ---- 5. Adjacent opportunity nudge ----
  if (comparison.mobility_score < 55) {
    const adjConf = profile.seniority_level === 'junior' ? 0.52
                  : profile.seniority_level === 'mid' ? 0.48 : 0.45;
    recs.push(mk({
      category: 'adjacent_opportunity',
      title: 'Explore adjacent roles as stepping stones',
      rationale: 'Capability proximity to the chosen target is currently developing — adjacent roles may offer a stronger short-term match.',
      evidence: { mobility_score: comparison.mobility_score,
                  ...(profile.seniority_level ? { calibrated_for: profile.seniority_level } : {}) },
      developmental_actions: [
        'Explore the Adjacent Roles panel for higher-proximity options',
        ...(profile.career_stage === 'transitioning' ? ['Use an adjacent role to build specific bridge competencies first'] : []),
      ],
      estimated_weeks: null,
      priority: 'low',
      alignment_indicators: [
        'Composite mobility < 55 — adjacent paths may close gaps faster',
        ...(profile.domain ? [`Consider adjacent roles within the ${profile.domain} domain`] : []),
      ],
      confidence: adjConf,
      provenance: ['mobility_composite'],
      personalization_applied: personalized,
    }));
  }

  // P-R5 W4: Deduplicate then rank by priority → success_probability → outcome_weight
  const deduped = eliminateRedundancy(recs);
  const sorted = deduped.sort((a, b) => {
    const p = priorityRank(b.priority) - priorityRank(a.priority);
    if (p !== 0) return p;
    const sp = b.success_probability - a.success_probability;
    if (Math.abs(sp) > 0.05) return sp;
    return b.outcome_weight - a.outcome_weight;
  });
  sorted.forEach((r, i) => { r.ranking_position = i + 1; });

  return {
    context: { from_role_id: params.from_role_id, to_role_id: params.to_role_id },
    comparison,
    recommendations: sorted,
    generated_at: new Date().toISOString(),
    version: RECOMMENDATION_VERSION,
    personalization_applied: personalized,
    language_policy: {
      allowed: ['developmental readiness', 'capability proximity',
                'alignment indicators', 'development opportunity'],
      disallowed: ['likely to get hired', 'suitable candidate', 'promotion prediction'],
    },
  };
}

function priorityRank(p: 'high'|'medium'|'low') { return p === 'high' ? 3 : p === 'medium' ? 2 : 1; }

/** P-R4 W2: Seniority-aware timeline estimation. */
function estimateWeeksForGap(gap: number, seniority?: string): number {
  const g = Math.abs(gap);
  // Senior+ practitioners close gaps faster (deeper existing foundation)
  const multiplier = seniority === 'senior' || seniority === 'lead' ? 0.80
                   : seniority === 'director' || seniority === 'c_suite' ? 0.70
                   : seniority === 'junior' ? 1.20
                   : 1.0;
  const base = g <= 10 ? 6 : g <= 20 ? 12 : g <= 30 ? 20 : 32;
  return Math.round(base * multiplier);
}

/** P-R4 W2: Profile-aware developmental actions. */
function developmentActionsFor(g: RoleComparison['competency_gaps'][number], profile: UserProfile = {}): string[] {
  const horizon = profile.seniority_level === 'junior' ? '8-week' : '6-week';
  const base = [
    `Set a ${horizon} development goal anchored to ${g.canonical_name}`,
    `Identify a coaching or mentoring relationship to accelerate practice`,
    `Capture weekly micro-evidence of practice and review monthly`,
  ];
  if (g.category === 'leadership') {
    if (profile.seniority_level === 'director' || profile.seniority_level === 'c_suite')
      base.unshift('Sponsor a cross-functional initiative requiring this leadership capability');
    else
      base.unshift('Lead one cross-team initiative requiring this capability');
  }
  if (g.category === 'strategic')    base.unshift(
    profile.seniority_level === 'c_suite'
      ? 'Author a board-level strategic narrative and seek peer review'
      : 'Author a 12-month strategic narrative draft for review'
  );
  if (g.category === 'execution')    base.unshift('Take ownership of a delivery-critical workstream this quarter');
  if (g.category === 'interpersonal')base.unshift('Run a 1:1 coaching conversation series for 6 weeks');
  if (profile.domain) base.push(`Apply ${g.canonical_name} within a ${profile.domain}-specific context`);
  if (profile.career_stage === 'transitioning') base.push('Document this development as evidence for your transition narrative');
  return base.slice(0, 4);
}

/** Convenience: full single-call output for the dashboard. P-R4 W2: accepts user_profile for personalization. */
export async function fullMobilityReport(pool: Pool, params: {
  from_role_id: string; to_role_id: string;
  user_scores: Record<string, number>;
  user_profile?: UserProfile;
}) {
  const bundle = await generateRecommendations(pool, params);
  // Also attach top pathway personalisation for richer UI
  const priorityIds = bundle.comparison.development_priorities.map(p => p.competency_id);
  const pathways = await suggestPathways(pool, {
    competency_priorities: priorityIds, user_scores: params.user_scores, limit: 3 });
  const top = pathways[0];
  const detailed = top ? await personalisedPathway(pool, {
    pathway_id: top.pathway.id, user_scores: params.user_scores }) : null;
  return { ...bundle, top_pathway_detail: detailed, suggested_pathways: pathways };
}
