/**
 * Career Skill Gap Engine — per-user per-role gap analysis.
 * Tables: cg_roles, cg_skill_requirements, cg_user_skill_gaps
 * Sources merged: career_seeker_profiles skills JSON, competency_scores, wcl0 behavioural signals
 * Never throws; degraded output when data absent.
 */

import type { Pool } from 'pg';

export interface SkillGapItem {
  skill_key: string;
  skill_label: string;
  category: string;
  importance: string;
  user_proficiency: number;    // 0–5
  required_proficiency: number;
  gap_delta: number;           // required − user (≥ 0)
  gap_severity: 'critical' | 'moderate' | 'minor' | 'met';
  evidence_types: string[];
}

export interface SkillGapResult {
  user_id: string;
  role_id: number;
  role_title: string;
  gaps: SkillGapItem[];
  covered_count: number;
  total_required: number;
  coverage_pct: number;       // 0–100
  weighted_gap_score: number; // 0–100 (high = large gap)
  critical_count: number;
  confidence: number;
  data_sources: string[];
  degraded: boolean;
}

function classifySeverity(delta: number, importance: string): SkillGapItem['gap_severity'] {
  if (delta <= 0) return 'met';
  if (importance === 'required' && delta >= 3) return 'critical';
  if (importance === 'required' && delta >= 1) return 'moderate';
  if (importance === 'preferred' && delta >= 2) return 'moderate';
  return 'minor';
}

function makeEmpty(userId: string, roleId: number): SkillGapResult {
  return {
    user_id: userId, role_id: roleId, role_title: '',
    gaps: [], covered_count: 0, total_required: 0, coverage_pct: 0,
    weighted_gap_score: 0, critical_count: 0, confidence: 0,
    data_sources: [], degraded: true,
  };
}

export async function computeSkillGaps(
  pool: Pool,
  userId: string,
  roleId: number
): Promise<SkillGapResult> {
  const empty = makeEmpty(userId, roleId);
  try {
    // Fetch role + skill requirements
    const [roleRes, reqRes] = await Promise.all([
      pool.query(`SELECT id, title FROM cg_roles WHERE id = $1 LIMIT 1`, [roleId]),
      pool.query(`
        SELECT skill_key, skill_label, category, importance, min_proficiency
        FROM cg_skill_requirements WHERE role_id = $1
      `, [roleId]),
    ]);

    if (!roleRes.rows[0]) return empty;
    const roleTitle = roleRes.rows[0].title as string;
    const reqs = reqRes.rows as { skill_key: string; skill_label: string; category: string; importance: string; min_proficiency: number }[];
    if (reqs.length === 0) return { ...empty, role_title: roleTitle, confidence: 0.1, degraded: false };

    const sources: string[] = [];

    // Build user skill map from career_seeker_profiles
    const rawTokens = new Set<string>();
    const profileRes = await pool.query(
      `SELECT data->'skills' AS skills_json, data->'softSkills' AS soft_json
       FROM career_seeker_profiles WHERE id = $1 LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    if (profileRes.rows[0]) {
      sources.push('career_seeker_profiles');
      const parseArr = (v: unknown): string[] => {
        if (!v) return [];
        try { return Array.isArray(v) ? v : JSON.parse(String(v)); }
        catch { return []; }
      };
      const row = profileRes.rows[0] as Record<string, unknown>;
      for (const s of [...parseArr(row.skills_json), ...parseArr(row.soft_json)]) {
        rawTokens.add(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim());
      }
    }

    // Competency scores
    const compMap = new Map<string, number>();
    const compRes = await pool.query(
      `SELECT competency_key, score::float FROM competency_scores WHERE user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] }));
    for (const r of compRes.rows as Array<Record<string, unknown>>) {
      compMap.set(String(r.competency_key), Number(r.score));
      if (sources.indexOf('competency_scores') < 0) sources.push('competency_scores');
    }

    // wcl0 behavioural signals — confidence/adaptability/motivation as soft-skill proxy
    let softBehaviourProf = 0;
    const wclRes = await pool.query(
      `SELECT confidence_score::float  AS conf,
              adaptability_score::float AS adap,
              motivation_score::float   AS motiv
       FROM wcl0_user_intelligence WHERE user_id = $1 LIMIT 1`,
      [userId],
    ).catch(() => ({ rows: [] }));
    if (wclRes.rows[0]) {
      sources.push('wcl0_user_intelligence');
      const row = wclRes.rows[0] as Record<string, unknown>;
      const avg = (Number(row.conf ?? 0) + Number(row.adap ?? 0) + Number(row.motiv ?? 0)) / 3;
      softBehaviourProf = Math.min(5, Math.round(avg / 20)); // 0–100 → 0–5
    }

    // Build gaps
    const gaps: SkillGapItem[] = [];
    let coveredCount = 0;
    let criticalCount = 0;
    let totalWeight = 0;
    let weightedGap = 0;

    for (const req of reqs) {
      const sk = req.skill_key.toLowerCase().replace(/_/g, ' ');
      const sl = req.skill_label.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

      // Best evidence: competency scores → raw token match → 0
      let userProf: number = 0;
      const evidenceTypes: string[] = [];

      // Check raw token match (1–2 proficiency proxy)
      if (rawTokens.has(sk) || rawTokens.has(sl)) {
        userProf = 2;
        evidenceTypes.push('profile_stated');
      }

      // Check competency overlap (map 0-100 score to 0-5)
      const compKey = req.skill_key;
      if (compMap.has(compKey)) {
        const compProf = Math.round(Number(compMap.get(compKey)) / 20);
        if (compProf > userProf) { userProf = compProf; evidenceTypes.push('competency'); }
      }

      // Apply wcl0 behavioural proxy to soft skills
      if (req.category === 'soft' && softBehaviourProf > userProf) {
        userProf = softBehaviourProf;
        evidenceTypes.push('wcl0_behaviour');
      }

      const required = Number(req.min_proficiency);
      const delta = Math.max(0, required - userProf);
      const severity = classifySeverity(delta, req.importance);
      if (severity === 'met') coveredCount++;
      if (severity === 'critical') criticalCount++;

      const weight = req.importance === 'required' ? 2 : 1;
      totalWeight += weight;
      weightedGap += weight * delta;

      gaps.push({
        skill_key: req.skill_key,
        skill_label: req.skill_label,
        category: req.category,
        importance: req.importance,
        user_proficiency: userProf,
        required_proficiency: required,
        gap_delta: delta,
        gap_severity: severity,
        evidence_types: evidenceTypes,
      });
    }

    // Sort: critical first, then by weighted gap desc
    gaps.sort((a, b) => {
      const ord = { critical: 0, moderate: 1, minor: 2, met: 3 };
      return (ord[a.gap_severity] - ord[b.gap_severity]) || (b.gap_delta - a.gap_delta);
    });

    const total = reqs.length;
    const coveragePct = total > 0 ? Math.round((coveredCount / total) * 100) : 0;
    const maxPossibleWeightedGap = totalWeight > 0 ? totalWeight * 5 : 1;
    const weightedGapScore = Math.round((weightedGap / maxPossibleWeightedGap) * 100);
    const confidence = sources.length >= 1 ? 0.65 : 0.3;

    // Persist gaps
    await persistGaps(pool, userId, roleId, gaps).catch(() => {});

    return {
      user_id: userId, role_id: roleId, role_title: roleTitle,
      gaps, covered_count: coveredCount, total_required: total,
      coverage_pct: coveragePct, weighted_gap_score: weightedGapScore,
      critical_count: criticalCount, confidence, data_sources: sources, degraded: false,
    };
  } catch {
    return empty;
  }
}

async function persistGaps(pool: Pool, userId: string, roleId: number, gaps: SkillGapItem[]): Promise<void> {
  for (const g of gaps) {
    await pool.query(
      `INSERT INTO cg_user_skill_gaps
         (user_id, role_id, skill_key, skill_label, user_level, required_level, gap_delta, gap_severity, importance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(user_id, role_id, skill_key)
       DO UPDATE SET user_level=$5, required_level=$6, gap_delta=$7, gap_severity=$8, computed_at=NOW()`,
      [userId, roleId, g.skill_key, g.skill_label, g.user_proficiency, g.required_proficiency, g.gap_delta, g.gap_severity, g.importance]
    ).catch(() => {});
  }
}
