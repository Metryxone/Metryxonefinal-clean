/**
 * Career Learning Recommendation Engine.
 * Maps skill gaps → ranked learning resources via cg_skill_resource_map + cg_learning_resources.
 * Score: effectiveness_score × quality_score × (1 − already_covered_fraction)
 * Never throws.
 */

import type { Pool } from 'pg';
import type { SkillGapItem } from './career-skill-gap-engine';

export interface LearningResource {
  id: number;
  resource_key: string;
  title: string;
  resource_type: string;
  provider: string | null;
  url: string | null;
  duration_hours: number | null;
  cost_inr: number | null;
  cost_band: string;
  difficulty: string;
  language: string;
  region: string;
}

export interface LearningRec {
  resource: LearningResource;
  skill_key: string;
  skill_label: string;
  gap_severity: string;
  relevance_score: number;    // 0–1
  effectiveness_score: number;
  quality_score: number;
}

export interface LearningRecsResult {
  user_id: string;
  role_id: number;
  recommendations: LearningRec[];
  total_hours: number;
  total_cost_inr: number;
  skill_coverage: number;     // how many gap skills have ≥1 rec
  total_gaps: number;
  confidence: number;
  data_sources: string[];
}

export async function generateLearningRecs(
  pool: Pool,
  userId: string,
  roleId: number,
  gaps: SkillGapItem[],
  region = 'IN'
): Promise<LearningRecsResult> {
  const empty: LearningRecsResult = {
    user_id: userId, role_id: roleId, recommendations: [],
    total_hours: 0, total_cost_inr: 0, skill_coverage: 0, total_gaps: 0,
    confidence: 0, data_sources: [],
  };

  try {
    const activeGaps = gaps.filter(g => g.gap_severity !== 'met');
    if (activeGaps.length === 0) {
      return { ...empty, confidence: 0.9, total_gaps: 0 };
    }

    const skillKeys = activeGaps.map(g => g.skill_key);

    // Fetch skill-resource mappings + resources in one join
    const r = await pool.query(
      `SELECT m.skill_key, m.effectiveness_score::float, m.quality_score::float,
              lr.id, lr.resource_key, lr.title, lr.resource_type, lr.provider,
              lr.url, lr.duration_hours::float, lr.cost_inr,
              lr.cost_band, lr.difficulty, lr.language, lr.region
       FROM cg_skill_resource_map m
       JOIN cg_learning_resources lr ON lr.id = m.resource_id
       WHERE m.skill_key = ANY($1::text[])
         AND lr.is_active = true
         AND (lr.region = $2 OR lr.region = 'global')
       ORDER BY m.effectiveness_score DESC, m.quality_score DESC`,
      [skillKeys, region]
    ).catch(() => ({ rows: [] }));

    if (r.rows.length === 0) {
      return { ...empty, total_gaps: activeGaps.length, confidence: 0.1 };
    }

    // Build gap map for scoring
    const gapMap = new Map<string, SkillGapItem>();
    for (const g of activeGaps) gapMap.set(g.skill_key, g);

    const recs: LearningRec[] = [];
    const coveredSkills = new Set<string>();
    const perSkillCount = new Map<string, number>();
    const seenResources = new Set<number>();

    for (const row of r.rows as Array<Record<string, unknown>>) {
      if (recs.length >= 15) break;
      const resId = Number(row.id);
      if (seenResources.has(resId)) continue;

      const sk = String(row.skill_key);
      const gap = gapMap.get(sk);
      if (!gap) continue;

      const perSkill = perSkillCount.get(sk) ?? 0;
      if (perSkill >= 3) continue;

      const eff = Number(row.effectiveness_score);
      const qual = Number(row.quality_score);
      // Already covered fraction: if user has proficiency > 0, reduce relevance
      const coveredFraction = gap.user_proficiency > 0 ? gap.user_proficiency / gap.required_proficiency : 0;
      const baseRelevance = gap.gap_severity === 'critical' ? 1.0
        : gap.gap_severity === 'moderate' ? 0.7
        : 0.4;
      // Difficulty alignment: penalise advanced resources for total beginners
      const difficulty = String(row.difficulty);
      const diffPenalty = (difficulty === 'advanced' && gap.user_proficiency < 2) ? 0.7 : 1.0;

      const relevance = Math.min(baseRelevance * eff * qual * (1 - coveredFraction * 0.5) * diffPenalty, 1.0);

      const resource: LearningResource = {
        id: resId,
        resource_key: String(row.resource_key),
        title: String(row.title),
        resource_type: String(row.resource_type),
        provider: row.provider ? String(row.provider) : null,
        url: row.url ? String(row.url) : null,
        duration_hours: row.duration_hours !== null ? Number(row.duration_hours) : null,
        cost_inr: row.cost_inr !== null ? Number(row.cost_inr) : null,
        cost_band: String(row.cost_band),
        difficulty,
        language: String(row.language),
        region: String(row.region),
      };

      recs.push({
        resource, skill_key: sk, skill_label: gap.skill_label,
        gap_severity: gap.gap_severity,
        relevance_score: Math.round(relevance * 1000) / 1000,
        effectiveness_score: eff, quality_score: qual,
      });

      seenResources.add(resId);
      coveredSkills.add(sk);
      perSkillCount.set(sk, perSkill + 1);
    }

    recs.sort((a, b) => b.relevance_score - a.relevance_score);

    const totalHours = recs.reduce((s, r) => s + (r.resource.duration_hours ?? 0), 0);
    const totalCost  = recs.reduce((s, r) => s + (r.resource.cost_inr ?? 0), 0);

    // Persist
    await persistLearningRecs(pool, userId, roleId, recs).catch(() => {});

    return {
      user_id: userId, role_id: roleId, recommendations: recs,
      total_hours: Math.round(totalHours * 10) / 10,
      total_cost_inr: totalCost,
      skill_coverage: coveredSkills.size,
      total_gaps: activeGaps.length,
      confidence: recs.length > 0 ? 0.75 : 0.2,
      data_sources: ['cg_skill_resource_map', 'cg_learning_resources'],
    };
  } catch { return empty; }
}

async function persistLearningRecs(pool: Pool, userId: string, roleId: number, recs: LearningRec[]): Promise<void> {
  for (const rec of recs) {
    await pool.query(
      `INSERT INTO cg_user_learning_recs(user_id, role_id, resource_id, skill_key, relevance_score)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT(user_id, role_id, resource_id)
       DO UPDATE SET skill_key=$4, relevance_score=$5, generated_at=NOW()`,
      [userId, roleId, rec.resource.id, rec.skill_key, rec.relevance_score]
    ).catch(() => {});
  }
}

export async function markResourceActioned(
  pool: Pool,
  userId: string,
  roleId: number,
  resourceId: number
): Promise<void> {
  await pool.query(
    `UPDATE cg_user_learning_recs
     SET is_actioned = true, actioned_at = NOW()
     WHERE user_id = $1 AND role_id = $2 AND resource_id = $3`,
    [userId, roleId, resourceId]
  );
}
