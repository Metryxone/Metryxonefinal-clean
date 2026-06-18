/**
 * LIP — Competency Gap Engine
 * Merges competency signals from multiple sources, applies gap rules,
 * and upserts lip_competency_gaps. Never throws.
 */
import type { Pool } from 'pg';

export interface LIPGap {
  competency_code: string;
  competency_label: string;
  current_score: number;
  target_score: number;
  gap_magnitude: number;
  gap_severity: 'critical' | 'major' | 'moderate' | 'minor';
  learning_priority: number;
  source: 'competency_scores' | 'mei_v2' | 'capadex' | 'self_reported' | 'assumed';
  confidence: number;
  recommended_resource_types: string[];
  min_hours_to_close: number;
}

export interface LIPGapResult {
  gaps: LIPGap[];
  overall_coverage_pct: number;
  critical_count: number;
  major_count: number;
  confidence: number;
  computed_at: string;
}

function gapSeverity(magnitude: number): 'critical' | 'major' | 'moderate' | 'minor' {
  if (magnitude >= 40) return 'critical';
  if (magnitude >= 25) return 'major';
  if (magnitude >= 10) return 'moderate';
  return 'minor';
}

export async function computeCompetencyGaps(
  userId: string,
  targetRoleId: string | null,
  pool: Pool,
): Promise<LIPGapResult> {
  try {
    // 1. Load gap rules
    const rulesRes = await pool.query<{
      competency_code: string;
      from_score_pct: string;
      to_score_pct: string;
      gap_severity: string;
      learning_priority: number;
      recommended_resource_types: string;
      min_hours_to_close: number;
    }>('SELECT * FROM lip_competency_gap_rules');
    const rules = rulesRes.rows;

    if (rules.length === 0) {
      return emptyResult();
    }

    // 2. Build score map from multiple sources
    const scoreMap: Map<string, { score: number; label: string; source: string; confidence: number }> = new Map();

    // Source A: competency_scores table
    try {
      const csRes = await pool.query<{ competency_code: string; competency_label: string; normalised_score: string; confidence: string }>(
        `SELECT competency_code, competency_label, normalised_score, confidence
         FROM competency_scores WHERE user_id = $1
         ORDER BY assessed_at DESC`,
        [userId],
      );
      for (const row of csRes.rows) {
        const code = row.competency_code;
        if (!scoreMap.has(code)) {
          scoreMap.set(code, {
            score: Math.min(100, Number(row.normalised_score) * 100),
            label: row.competency_label,
            source: 'competency_scores',
            confidence: Number(row.confidence),
          });
        }
      }
    } catch { /* table may not exist in all envs */ }

    // Source B: mei_competency_scores (MEI v2)
    try {
      const meiRes = await pool.query<{ competency_code: string; score: string }>(
        `SELECT competency_code, score FROM mei_competency_scores WHERE user_id = $1`,
        [userId],
      );
      for (const row of meiRes.rows) {
        if (!scoreMap.has(row.competency_code)) {
          scoreMap.set(row.competency_code, {
            score: Number(row.score),
            label: row.competency_code.replace(/_/g, ' '),
            source: 'mei_v2',
            confidence: 0.75,
          });
        }
      }
    } catch { /* table may not exist */ }

    // Source C: self-reported user_skills (beginner=30, novice=50, intermediate=65, expert=85)
    const proficiencyMap: Record<string, number> = {
      beginner: 30, novice: 45, intermediate: 65, advanced: 78, expert: 90,
    };
    try {
      const skillRes = await pool.query<{ skill: string; category: string; proficiency: string }>(
        `SELECT skill, category, proficiency FROM user_skills WHERE user_id = $1`,
        [userId],
      );
      const categoryToCode: Record<string, string> = {
        technical: 'technical_skills', soft: 'soft_skills', tool: 'technical_skills', language: 'technical_skills',
      };
      for (const row of skillRes.rows) {
        const code = categoryToCode[row.category] || 'technical_skills';
        const existing = scoreMap.get(code);
        const s = proficiencyMap[row.proficiency?.toLowerCase() || 'intermediate'] ?? 65;
        if (!existing || existing.source === 'assumed') {
          scoreMap.set(code, { score: s, label: code.replace(/_/g, ' '), source: 'self_reported', confidence: 0.6 });
        }
      }
    } catch { /* ignore */ }

    // 3. Apply gap rules — for competencies not in score map, assume neutral 50
    const gaps: LIPGap[] = [];
    let totalConfidence = 0;
    let totalWeight = 0;

    for (const rule of rules) {
      const fromScore = Number(rule.from_score_pct);
      const toScore = Number(rule.to_score_pct);
      const entry = scoreMap.get(rule.competency_code);
      const currentScore = entry ? entry.score : 50;
      const source = entry ? (entry.source as LIPGap['source']) : 'assumed';
      const confidence = entry ? entry.confidence : 0.3;
      const label = entry ? entry.label : rule.competency_code.replace(/_/g, ' ');

      if (currentScore <= fromScore) {
        const magnitude = Math.max(0, toScore - currentScore);
        const severity = gapSeverity(magnitude);
        let resourceTypes: string[] = [];
        try {
          resourceTypes = JSON.parse(rule.recommended_resource_types);
        } catch { resourceTypes = ['course']; }

        gaps.push({
          competency_code: rule.competency_code,
          competency_label: label,
          current_score: Math.round(currentScore),
          target_score: toScore,
          gap_magnitude: Math.round(magnitude),
          gap_severity: severity,
          learning_priority: rule.learning_priority,
          source,
          confidence,
          recommended_resource_types: resourceTypes,
          min_hours_to_close: rule.min_hours_to_close,
        });
        totalConfidence += confidence;
        totalWeight += 1;
      }
    }

    // 4. Sort by priority then magnitude
    gaps.sort((a, b) => a.learning_priority - b.learning_priority || b.gap_magnitude - a.gap_magnitude);

    // 5. Upsert to lip_competency_gaps
    try {
      await ensureLIPSchema(pool);
      for (const gap of gaps) {
        await pool.query(
          `INSERT INTO lip_competency_gaps
             (user_id,competency_code,competency_label,current_score,target_score,
              gap_magnitude,gap_severity,learning_priority,source,confidence,computed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
           ON CONFLICT (user_id,competency_code) DO UPDATE SET
             competency_label=EXCLUDED.competency_label,
             current_score=EXCLUDED.current_score,
             target_score=EXCLUDED.target_score,
             gap_magnitude=EXCLUDED.gap_magnitude,
             gap_severity=EXCLUDED.gap_severity,
             learning_priority=EXCLUDED.learning_priority,
             source=EXCLUDED.source,
             confidence=EXCLUDED.confidence,
             computed_at=NOW()`,
          [userId, gap.competency_code, gap.competency_label, gap.current_score,
           gap.target_score, gap.gap_magnitude, gap.gap_severity, gap.learning_priority,
           gap.source, gap.confidence],
        );
      }
    } catch { /* persist best-effort */ }

    const avgConf = totalWeight > 0 ? totalConfidence / totalWeight : 0.3;
    const coveredCount = rules.length - gaps.length;
    const overallCoverage = rules.length > 0 ? Math.round((coveredCount / rules.length) * 100) : 0;

    return {
      gaps,
      overall_coverage_pct: overallCoverage,
      critical_count: gaps.filter(g => g.gap_severity === 'critical').length,
      major_count: gaps.filter(g => g.gap_severity === 'major').length,
      confidence: Math.round(avgConf * 100) / 100,
      computed_at: new Date().toISOString(),
    };
  } catch {
    return emptyResult();
  }
}

function emptyResult(): LIPGapResult {
  return { gaps: [], overall_coverage_pct: 0, critical_count: 0, major_count: 0, confidence: 0.3, computed_at: new Date().toISOString() };
}

// Module-level guard: only bootstrap once per process lifetime
let _schemaReady = false;

async function ensureLIPSchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  try {
    // Non-destructive existence check — fast path when tables already present
    await pool.query('SELECT 1 FROM lip_courses LIMIT 1');
    _schemaReady = true;
  } catch {
    // Tables absent — run the full idempotent migration (CREATE IF NOT EXISTS + seed ON CONFLICT DO NOTHING)
    try {
      const { readFileSync } = await import('fs');
      const { join } = await import('path');
      const sql = readFileSync(join(__dirname, '../migrations/20260611_lip.sql'), 'utf8');
      await pool.query(sql);
      _schemaReady = true;
    } catch { /* non-fatal: tables may be partially created */ }
  }
}

export { ensureLIPSchema };
