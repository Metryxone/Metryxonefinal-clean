/**
 * LIP — Learning Need Engine
 * Ingests assessment, behavioural, career-goal, and market signals,
 * applies lip_learning_need_rules, and upserts lip_learning_needs.
 * Never throws.
 */
import type { Pool } from 'pg';

export interface LIPNeed {
  need_category: string;
  urgency: 'immediate' | 'near_term' | 'aspirational';
  priority_score: number;
  signal_count: number;
  signal_sources: string[];
  description: string;
}

export interface LIPNeedResult {
  needs: LIPNeed[];
  immediate_count: number;
  categories_triggered: string[];
  computed_at: string;
}

interface NeedRule {
  signal_type: string;
  signal_key: string;
  threshold_operator: string;
  threshold_value: number;
  threshold_value2: number | null;
  need_category: string;
  urgency: string;
  weight: number;
  description: string | null;
}

const URGENCY_MULTIPLIER: Record<string, number> = {
  immediate: 1.5,
  near_term: 1.0,
  aspirational: 0.6,
};

function evalThreshold(operator: string, value: number, threshold: number, threshold2: number | null): boolean {
  if (operator === 'lt') return value < threshold;
  if (operator === 'gt') return value > threshold;
  if (operator === 'eq') return value === threshold;
  if (operator === 'between' && threshold2 != null) return value >= threshold && value <= threshold2;
  return false;
}

export async function analyzeLearningNeeds(userId: string, pool: Pool): Promise<LIPNeedResult> {
  try {
    // Load rules
    const rulesRes = await pool.query<NeedRule>('SELECT * FROM lip_learning_need_rules');
    const rules = rulesRes.rows;
    if (rules.length === 0) return emptyResult();

    // Accumulate need scores: category → { score, sources, urgency }
    const needMap: Map<string, { score: number; sources: string[]; urgency: string; count: number }> = new Map();

    // Helper to fire a rule
    const fire = (rule: NeedRule, strength: number) => {
      const multiplier = URGENCY_MULTIPLIER[rule.urgency] ?? 1.0;
      const score = rule.weight * Math.min(1, strength) * multiplier;
      const existing = needMap.get(rule.need_category);
      if (existing) {
        existing.score += score;
        existing.sources.push(rule.signal_key);
        existing.count += 1;
        // Escalate urgency if needed
        const order = ['aspirational', 'near_term', 'immediate'];
        if (order.indexOf(rule.urgency) > order.indexOf(existing.urgency)) {
          existing.urgency = rule.urgency;
        }
      } else {
        needMap.set(rule.need_category, {
          score,
          sources: [rule.signal_key],
          urgency: rule.urgency,
          count: 1,
        });
      }
    };

    // ── Signal A: Assessment gaps ─────────────────────────────────────────────
    try {
      const gapsRes = await pool.query<{ gap_magnitude: string; gap_severity: string; competency_code: string }>(
        `SELECT gap_magnitude, gap_severity, competency_code FROM lip_competency_gaps WHERE user_id = $1`,
        [userId],
      );
      for (const gap of gapsRes.rows) {
        const mag = Number(gap.gap_magnitude);
        const strength = mag / 100;
        for (const rule of rules) {
          if (rule.signal_type === 'assessment_gap' && rule.signal_key === 'competency_score') {
            if (evalThreshold(rule.threshold_operator, 100 - mag, rule.threshold_value, rule.threshold_value2)) {
              fire(rule, strength);
            }
          }
        }
      }
    } catch { /* gaps not yet computed */ }

    // ── Signal B: Behavioural signals from wcl0 ───────────────────────────────
    try {
      const wclRes = await pool.query<{ motivation_score: string; confidence_score: string; adaptability_score: string; engagement_score: string }>(
        `SELECT motivation_score, confidence_score, adaptability_score, engagement_score
         FROM wcl0_user_intelligence WHERE user_id = $1
         ORDER BY computed_at DESC LIMIT 1`,
        [userId],
      );
      if (wclRes.rows.length > 0) {
        const row = wclRes.rows[0];
        const signals: Record<string, number> = {
          motivation: Number(row.motivation_score ?? 50),
          confidence: Number(row.confidence_score ?? 50),
          adaptability: Number(row.adaptability_score ?? 50),
          engagement: Number(row.engagement_score ?? 50),
        };
        for (const [key, val] of Object.entries(signals)) {
          const strength = Math.max(0, (50 - val) / 50);
          for (const rule of rules) {
            if (rule.signal_type === 'behavioural_signal' && rule.signal_key === key) {
              if (evalThreshold(rule.threshold_operator, val, rule.threshold_value, rule.threshold_value2)) {
                fire(rule, strength);
              }
            }
          }
        }
      }
    } catch { /* wcl0 table may not exist */ }

    // ── Signal C: Career goals ────────────────────────────────────────────────
    try {
      const profileRes = await pool.query<{ target_role_id: string }>(
        `SELECT target_role_id FROM user_profiles WHERE user_id = $1`,
        [userId],
      );
      if (profileRes.rows.length > 0 && profileRes.rows[0].target_role_id) {
        for (const rule of rules) {
          if (rule.signal_type === 'career_goal' && rule.signal_key === 'target_role_set') {
            fire(rule, 1.0);
          }
        }
      }
    } catch { /* ignore */ }

    // ── Signal D: Self-reported skills (beginner proficiency) ─────────────────
    try {
      const skillRes = await pool.query<{ proficiency: string; skill: string }>(
        `SELECT proficiency, skill FROM user_skills WHERE user_id = $1`,
        [userId],
      );
      const hasBeginners = skillRes.rows.some(r => r.proficiency?.toLowerCase() === 'beginner');
      const hasNovice = skillRes.rows.some(r => r.proficiency?.toLowerCase() === 'novice');
      for (const rule of rules) {
        if (rule.signal_type === 'self_reported') {
          if (rule.signal_key === 'skill_proficiency_beginner' && hasBeginners) fire(rule, 1.0);
          if (rule.signal_key === 'skill_proficiency_novice' && hasNovice) fire(rule, 0.8);
        }
      }
    } catch { /* ignore */ }

    // ── Signal E: Market demand / workforce signals ────────────────────────────
    // Reads occupation market data for the user's target role from career graph tables.
    // Gracefully degrades when cg_occupations / career_seeker_profiles are absent.
    try {
      // Get user's target role id from career seeker profile
      const profileRes = await pool.query<{ target_role_id: string }>(
        `SELECT data->>'targetRoleId' AS target_role_id
         FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      const targetRoleId = profileRes.rows[0]?.target_role_id;
      if (targetRoleId) {
        // Try to read occupation market data from career graph occupation profiles
        const occRes = await pool.query<{
          demand_index: string;
          growth_36mo: string;
          automation_risk: string;
          openings_index: string;
        }>(
          `SELECT demand_index, growth_36mo, automation_risk, openings_index
           FROM cg_occupation_profiles WHERE occupation_id = $1 LIMIT 1`,
          [targetRoleId],
        );
        if (occRes.rows.length > 0) {
          const occ = occRes.rows[0];
          const marketSignals: Record<string, number> = {
            demand_index: Number(occ.demand_index ?? 0),
            growth_36mo: Number(occ.growth_36mo ?? 0),
            automation_risk: Number(occ.automation_risk ?? 0),
            openings_index: Number(occ.openings_index ?? 0),
          };
          for (const [key, val] of Object.entries(marketSignals)) {
            if (!Number.isFinite(val) || val === 0) continue;
            for (const rule of rules) {
              if (rule.signal_type === 'market_demand' && rule.signal_key === key) {
                if (evalThreshold(rule.threshold_operator, val, rule.threshold_value, rule.threshold_value2)) {
                  // Strength proportional to how far above threshold the signal is
                  const strength = Math.min(1, val / 100);
                  fire(rule, strength);
                }
              }
            }
          }
        }
      }
    } catch { /* cg_occupation_profiles may not exist — degrade silently */ }

    // Build final needs array
    const needs: LIPNeed[] = [];
    for (const [category, data] of needMap.entries()) {
      needs.push({
        need_category: category,
        urgency: data.urgency as LIPNeed['urgency'],
        priority_score: Math.round(Math.min(99, data.score * 100) * 10) / 10,
        signal_count: data.count,
        signal_sources: [...new Set(data.sources)],
        description: categoryDescription(category),
      });
    }
    needs.sort((a, b) => b.priority_score - a.priority_score);

    // Upsert
    try {
      for (const need of needs) {
        await pool.query(
          `INSERT INTO lip_learning_needs
             (user_id,need_category,urgency,priority_score,signal_count,signal_sources,description,computed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
           ON CONFLICT (user_id,need_category) DO UPDATE SET
             urgency=EXCLUDED.urgency, priority_score=EXCLUDED.priority_score,
             signal_count=EXCLUDED.signal_count, signal_sources=EXCLUDED.signal_sources,
             description=EXCLUDED.description, computed_at=NOW()`,
          [userId, need.need_category, need.urgency, need.priority_score,
           need.signal_count, JSON.stringify(need.signal_sources), need.description],
        );
      }
    } catch { /* best-effort */ }

    return {
      needs,
      immediate_count: needs.filter(n => n.urgency === 'immediate').length,
      categories_triggered: needs.map(n => n.need_category),
      computed_at: new Date().toISOString(),
    };
  } catch {
    return emptyResult();
  }
}

function categoryDescription(category: string): string {
  const desc: Record<string, string> = {
    technical_upskill: 'Build core technical skills through structured learning',
    soft_skill: 'Develop interpersonal and professional effectiveness',
    leadership: 'Grow leadership capabilities for greater impact',
    domain_knowledge: 'Deepen industry and domain-specific knowledge',
    certification: 'Earn credentials that validate your expertise',
    applied_practice: 'Apply learning through hands-on projects and practice',
  };
  return desc[category] ?? 'Develop capabilities in this area';
}

function emptyResult(): LIPNeedResult {
  return { needs: [], immediate_count: 0, categories_triggered: [], computed_at: new Date().toISOString() };
}
