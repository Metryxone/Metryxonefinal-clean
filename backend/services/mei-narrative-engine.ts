/**
 * MEI v2 Narrative Engine
 * ────────────────────────
 * Rules-based narrative generation. No LLM — every output is deterministic
 * and traceable to a specific insight_rule row in mei_insight_rules.
 *
 * Output layers:
 *  1. Band narrative        — overall score interpretation
 *  2. Dimension strengths   — top 2 dimensions ≥ 70%
 *  3. Dimension gaps        — bottom 2 dimensions ≤ 40%
 *  4. Composite insights    — data-state patterns (no assessment, incomplete profile)
 *  5. Action directive      — top recommendation
 */

import type { Pool } from 'pg';
import type { MEIScoreOutput } from './mei-scoring-engine';
import type { BenchmarkResult } from './mei-benchmark-engine';

export interface NarrativeOutput {
  band_narrative:      string;
  strength_narratives: Array<{ dimension_code: string; dimension_name: string; text: string }>;
  gap_narratives:      Array<{ dimension_code: string; dimension_name: string; text: string }>;
  composite_insights:  string[];
  action_directive:    string;
  audience:            string;
  rules_fired:         number[];   // IDs of mei_insight_rules rows used
}

const BAND_DISPLAY: Record<string, string> = {
  hire_ready:    'Hire-Ready',
  career_ready:  'Career-Ready',
  building:      'Building',
  getting_started: 'Getting Started',
};

/** Fill {{token}} placeholders in a template */
function render(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`));
}

export async function generateNarrative(
  pool: Pool,
  score: MEIScoreOutput,
  benchmark: BenchmarkResult | null,
  audience: 'candidate' | 'counselor' | 'employer' = 'candidate'
): Promise<NarrativeOutput> {
  const rulesFired: number[] = [];

  // Load all active rules for this audience
  const rulesRes = await pool.query(
    `SELECT * FROM mei_insight_rules
     WHERE is_active AND audience = $1
     ORDER BY priority DESC, id`,
    [audience]
  );
  const rules = rulesRes.rows as Array<{
    id: number; rule_type: string; trigger_field: string; trigger_operator: string;
    trigger_value: unknown; narrative_template: string;
  }>;

  const dimByCode = Object.fromEntries(score.dimensions.map(d => [d.code, d]));

  function matchRule(rule: (typeof rules)[0]): boolean {
    const { trigger_field, trigger_operator, trigger_value } = rule;
    const tv = trigger_value as Record<string, unknown>;
    if (rule.rule_type === 'band' && trigger_field === 'band') {
      return trigger_operator === 'eq' && tv === score.band;
    }
    if (rule.rule_type === 'dimension_strength' || rule.rule_type === 'dimension_gap') {
      const dim = dimByCode[trigger_field];
      if (!dim) return false;
      const pct = dim.score * 100;
      if (trigger_operator === 'gte') return pct >= Number(trigger_value);
      if (trigger_operator === 'lte') return pct <= Number(trigger_value);
      if (trigger_operator === 'between') return pct >= (tv.min as number) && pct <= (tv.max as number);
    }
    if (rule.rule_type === 'composite_insight') {
      const type = (tv as Record<string, unknown>).type as string;
      if (type === 'assessment_not_taken') return !score.dimensions.find(d => d.code === 'validated_proficiency')?.subdimensions.find(sd => sd.code === 'assessment_performance')?.competencies.find(c => c.code === 'core_assessment_score')?.gate_met;
      if (type === 'profile_incomplete')  return (score.dimensions.find(d => d.code === 'portfolio_signal')?.score ?? 1) < 0.5;
      if (type === 'high_exp_low_cred') {
        const expScore = (dimByCode['professional_experience']?.score ?? 0) * 100;
        const credScore = (dimByCode['validated_proficiency']?.score ?? 0) * 100;
        return expScore >= 60 && credScore < 45;
      }
    }
    return false;
  }

  // ── Top-3 recommendations text (used in building narrative) ───────────────
  const recsRes = await pool.query(
    `SELECT title FROM mei_recommendation_master WHERE is_active ORDER BY display_order LIMIT 3`
  );
  const topRecs = recsRes.rows.map((r: Record<string, unknown>) => r.title as string);

  // ── Gap analysis ──────────────────────────────────────────────────────────
  const sortedDims = [...score.dimensions].sort((a, b) => a.score - b.score);
  const weakestDim = sortedDims[0];
  const topGapDim  = sortedDims[0];

  const templateVars: Record<string, string | number> = {
    score:            score.composite_score,
    band:             BAND_DISPLAY[score.band] ?? score.band,
    top_gap_action:   topRecs[0] ?? 'taking the CAPADEX assessment',
    rec_1:            topRecs[0] ?? '',
    rec_2:            topRecs[1] ?? '',
    rec_3:            topRecs[2] ?? '',
    weakest_dimension: weakestDim?.name ?? '',
    top_3_gaps:       sortedDims.slice(0, 3).map(d => d.name).join(', '),
    percentile:       benchmark?.percentile_rank ?? '',
    cohort_size:      benchmark?.sample_size ?? '',
    fill_pct:         Math.round((score.dimensions.find(d => d.code === 'portfolio_signal')?.score ?? 0) * 100),
    capadex_points:   Math.round((score.dimensions.find(d => d.code === 'behavioural_intelligence')?.max_points ?? 22) * 0.5 * (1 - (score.dimensions.find(d => d.code === 'behavioural_intelligence')?.score ?? 0))),
  };

  // 1. Band narrative
  let bandNarrative = '';
  const bandRule = rules.find(r => r.rule_type === 'band' && matchRule(r));
  if (bandRule) {
    bandNarrative = render(bandRule.narrative_template, { ...templateVars });
    rulesFired.push(bandRule.id);
  } else {
    bandNarrative = `Your Employability Index is ${score.composite_score} — ${BAND_DISPLAY[score.band]}.`;
  }

  // 2. Dimension strength narratives (top 2 dimensions ≥ 70%)
  const strengthNarratives: NarrativeOutput['strength_narratives'] = [];
  const strongDims = [...score.dimensions]
    .sort((a, b) => b.score - a.score)
    .filter(d => d.score >= 0.70)
    .slice(0, 2);
  for (const dim of strongDims) {
    const rule = rules.find(r => r.rule_type === 'dimension_strength' && r.trigger_field === dim.code && matchRule(r));
    if (rule) {
      strengthNarratives.push({
        dimension_code: dim.code,
        dimension_name: dim.name,
        text: render(rule.narrative_template, { ...templateVars, dim_score: Math.round(dim.score * 100) }),
      });
      rulesFired.push(rule.id);
    }
  }

  // 3. Dimension gap narratives (bottom 2 dimensions ≤ 40%)
  const gapNarratives: NarrativeOutput['gap_narratives'] = [];
  const gapDims = sortedDims.filter(d => d.score <= 0.40).slice(0, 2);
  for (const dim of gapDims) {
    const rule = rules.find(r => r.rule_type === 'dimension_gap' && r.trigger_field === dim.code && matchRule(r));
    if (rule) {
      const maxGain = Math.round((1 - dim.score) * dim.max_points * 10) / 10;
      gapNarratives.push({
        dimension_code: dim.code,
        dimension_name: dim.name,
        text: render(rule.narrative_template, { ...templateVars, dim_score: Math.round(dim.score * 100), max_gain: maxGain }),
      });
      rulesFired.push(rule.id);
    }
  }

  // 4. Composite insights
  const compositeInsights: string[] = [];
  const compositeRules = rules.filter(r => r.rule_type === 'composite_insight' && matchRule(r));
  for (const rule of compositeRules.slice(0, 3)) {
    compositeInsights.push(render(rule.narrative_template, templateVars));
    rulesFired.push(rule.id);
  }

  // 5. Action directive (top recommendation)
  const topRecRes = await pool.query(
    `SELECT title, description, link_path, estimated_point_gain::float
     FROM mei_recommendation_master WHERE is_active ORDER BY display_order LIMIT 1`
  );
  const topRec = topRecRes.rows[0] as Record<string, unknown> | undefined;
  const actionDirective = topRec
    ? `Your highest-impact next action: **${topRec.title}**. ${topRec.description} (+${topRec.estimated_point_gain} pts available).`
    : 'Complete your profile and take the CAPADEX assessment to unlock the most valuable insights.';

  return {
    band_narrative:      bandNarrative,
    strength_narratives: strengthNarratives,
    gap_narratives:      gapNarratives,
    composite_insights:  compositeInsights,
    action_directive:    actionDirective,
    audience,
    rules_fired:         [...new Set(rulesFired)],
  };
}

/** Persist generated narrative to cache table */
export async function persistNarrative(
  pool: Pool,
  userId: string,
  narrative: NarrativeOutput,
  compositeScore: number
): Promise<void> {
  await pool.query(
    `INSERT INTO mei_narratives
       (user_id, audience, band_narrative, strength_narratives, gap_narratives,
        composite_insight, action_directive, generated_at, score_snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8)
     ON CONFLICT (user_id, audience) DO UPDATE SET
       band_narrative=$3, strength_narratives=$4, gap_narratives=$5,
       composite_insight=$6, action_directive=$7, generated_at=NOW(), score_snapshot=$8`,
    [
      userId, narrative.audience, narrative.band_narrative,
      JSON.stringify(narrative.strength_narratives),
      JSON.stringify(narrative.gap_narratives),
      narrative.composite_insights.join(' '),
      narrative.action_directive,
      compositeScore,
    ]
  );
}
