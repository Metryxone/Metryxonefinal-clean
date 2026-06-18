import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/client.js';
import { computePercentile, computeOverallPercentile, computePercentilesBatch } from '../services/competency/percentile.js';
import { computeRoleFitness } from '../services/competency/roleFitness.js';
import { normalizeScores } from '../services/competency/normalization.js';
import { buildWeightMap, weightedAverage, applyWeights } from '../services/competency/weighting.js';
import { computeTransitionGaps, computeTransitionReadiness } from '../services/competency/roleTransition.js';
import { prioritizeGaps, prioritizationSummary, type GapItem } from '../services/competency/gapPrioritization.js';
import { recommendInterventions } from '../services/competency/intervention.js';
import { simulateGrowth } from '../services/competency/growthSimulation.js';
import { computeVisibilityScores } from '../services/competency/visibilityEngine.js';
import { matchCandidates } from '../services/competency/employerMatching.js';
import type {
  CompetencyRow, CompetencyScoreRow, BenchmarkRow, WeightRow,
  CareerProfileRow, CandidateRow, InterventionRow,
} from '../services/competency/types.js';

const router = Router();
router.use(requireAuth);

const ELEVATED_ROLES = ['super_admin', 'admin', 'hr'];

interface AuthUser { id: string; role?: string }

function isElevated(role?: string): boolean {
  return ELEVATED_ROLES.includes(role ?? '');
}

function getUser(req: Request): AuthUser | undefined {
  return (req as Request & { user?: AuthUser }).user;
}

function assertOwnerOrElevated(req: Request, res: Response, userId: string): boolean {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return false; }
  if (user.id === userId || isElevated(user.role)) return true;
  res.status(403).json({ error: 'FORBIDDEN', message: 'You can only access your own competency data.' });
  return false;
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function getOrCreateProfile(userId: string): Promise<CareerProfileRow> {
  const readProfile = () => query<CareerProfileRow>(
    `SELECT cp.*, u.full_name, u.email FROM career_profiles cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.user_id = $1`, [userId]
  );
  const r = await readProfile();
  if (r.rows.length) return r.rows[0];
  await query(
    `INSERT INTO career_profiles (user_id, current_job_role, target_job_role, industry, career_stage, experience_years)
     VALUES ($1,'Software Engineer','Team Lead','Technology','mid',3)`, [userId]
  );
  const after = await readProfile();
  return after.rows[0];
}

async function getScoresForProfile(profileId: string) {
  return query<CompetencyScoreRow>(`
    SELECT cs.*, c.code AS competency_code, c.name AS competency_name,
           cd.code AS domain_code, cd.name AS domain_name, cd.id AS domain_id
    FROM competency_scores cs
    JOIN competencies c ON c.id = cs.competency_id
    JOIN competency_domains cd ON cd.id = c.domain_id
    WHERE cs.profile_id = $1
    ORDER BY cd.sort_order, c.sort_order
  `, [profileId]);
}

async function getWeightsForRole(role: string, stage: string) {
  return query<WeightRow>(`
    SELECT rw.competency_id, rw.weight
    FROM role_weights rw
    WHERE rw.role = $1 AND rw.career_stage = $2
  `, [role, stage]);
}

async function getBenchmarksForRole(role: string, stage: string, industry = 'Technology') {
  return query<BenchmarkRow>(`
    SELECT cb.competency_id, cb.mean, cb.median, cb.std_dev, cb.p25, cb.p75, cb.p90, cb.sample_size
    FROM competency_benchmarks cb
    WHERE cb.role = $1 AND cb.career_stage = $2 AND cb.industry = $3
  `, [role, stage, industry]);
}

// ─── GET /api/competency/domains ────────────────────────────────────────────
router.get('/domains', async (req, res) => {
  try {
    const withSubs = req.query.include === 'subdomains';
    if (!withSubs) {
      const r = await query(`SELECT * FROM competency_domains WHERE is_active = TRUE ORDER BY sort_order`);
      return res.json(r.rows);
    }
    const domainsR = await query(`SELECT * FROM competency_domains WHERE is_active = TRUE ORDER BY sort_order`);
    const compsR = await query(`
      SELECT c.id, c.domain_id, c.code, c.name, c.description, c.sort_order
      FROM competencies c
      WHERE c.is_active = TRUE
      ORDER BY c.sort_order
    `);
    const subsByDomain: Record<string, any[]> = {};
    for (const c of compsR.rows) {
      if (!subsByDomain[c.domain_id]) subsByDomain[c.domain_id] = [];
      subsByDomain[c.domain_id].push({
        id: c.id,
        code: c.code,
        name: c.name,
        microCompetencies: (c.description || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      });
    }
    const result = domainsR.rows.map((d: any) => ({
      ...d,
      subdomains: subsByDomain[d.id] || [],
    }));
    return res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── PATCH /api/competency/domains/:id ──────────────────────────────────────
router.patch('/domains/:id', async (req, res) => {
  const user = getUser(req);
  if (!isElevated(user?.role)) return res.status(403).json({ error: 'FORBIDDEN' });
  try {
    const { name, description, sort_order, is_active } = req.body as {
      name?: string; description?: string; sort_order?: number; is_active?: boolean;
    };
    const r = await query(
      `UPDATE competency_domains
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           sort_order = COALESCE($3, sort_order),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, description, sort_order ?? null, is_active ?? null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(r.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── DELETE /api/competency/domains/:id ─────────────────────────────────────
router.delete('/domains/:id', async (req, res) => {
  const user = getUser(req);
  if (!isElevated(user?.role)) return res.status(403).json({ error: 'FORBIDDEN' });
  try {
    await query(`DELETE FROM competency_domains WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/competency/competencies ───────────────────────────────────────
router.get('/competencies', async (_req, res) => {
  try {
    const r = await query<CompetencyRow & { domain_name: string; domain_code: string }>(`
      SELECT c.*, cd.name AS domain_name, cd.code AS domain_code
      FROM competencies c
      JOIN competency_domains cd ON cd.id = c.domain_id
      WHERE c.is_active = TRUE
      ORDER BY cd.sort_order, c.sort_order
    `);
    res.json(r.rows);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/competency/profile/:userId ────────────────────────────────────
router.get('/profile/:userId', async (req, res) => {
  if (!assertOwnerOrElevated(req, res, req.params.userId)) return;
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const { email: _e, ...safe } = profile;
    res.json(isElevated(getUser(req)?.role) ? profile : safe);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── POST /api/competency/profile/:userId ───────────────────────────────────
router.post('/profile/:userId', async (req, res) => {
  if (!assertOwnerOrElevated(req, res, req.params.userId)) return;
  try {
    const { currentRole, targetRole, industry, careerStage, experienceYears } = req.body as {
      currentRole?: string; targetRole?: string; industry?: string; careerStage?: string; experienceYears?: number;
    };
    const r = await query<CareerProfileRow>(`
      INSERT INTO career_profiles (user_id, current_job_role, target_job_role, industry, career_stage, experience_years)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (user_id) DO UPDATE SET
        current_job_role = COALESCE($2, career_profiles.current_job_role),
        target_job_role = COALESCE($3, career_profiles.target_job_role),
        industry = COALESCE($4, career_profiles.industry),
        career_stage = COALESCE($5, career_profiles.career_stage),
        experience_years = COALESCE($6, career_profiles.experience_years),
        updated_at = NOW()
      RETURNING *
    `, [req.params.userId, currentRole, targetRole, industry, careerStage, experienceYears]);
    res.json(r.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── POST /api/competency/run-assessment ─────────────────────────────────────
router.post('/run-assessment', async (req, res) => {
  try {
    const { userId, scores } = req.body as {
      userId: string;
      scores: { competencyCode: string; rawScore: number; confidence?: number }[];
    };
    if (!userId || !scores?.length) return res.status(400).json({ error: 'userId and scores required' });
    if (!assertOwnerOrElevated(req, res, userId)) return;

    const profile = await getOrCreateProfile(userId);
    const compRows = await query<CompetencyRow>(`SELECT id, code FROM competencies`);
    const compMap = new Map(compRows.rows.map(c => [c.code, c.id]));

    const normalized = normalizeScores(scores.map(s => ({ competencyId: s.competencyCode, finalScore: s.rawScore })));
    const normMap = new Map(normalized.map(n => [n.competencyId, n.normalizedScore]));

    for (const s of scores) {
      const compId = compMap.get(s.competencyCode);
      if (!compId) continue;
      const conf = s.confidence ?? 1.0;
      const normFactor = 0.85 + (normMap.get(s.competencyCode) ?? 0.5) * 0.15;
      const final = Math.min(Math.round(s.rawScore * conf * normFactor), 100);
      await query(`
        INSERT INTO competency_scores (profile_id, competency_id, raw_score, confidence, final_score, source)
        VALUES ($1,$2,$3,$4,$5,'assessment')
        ON CONFLICT (profile_id, competency_id) DO UPDATE SET
          raw_score=EXCLUDED.raw_score, confidence=EXCLUDED.confidence,
          final_score=EXCLUDED.final_score, assessed_at=NOW()
      `, [profile.id, compId, s.rawScore, conf, final]);
    }

    res.json({ success: true, profileId: profile.id, scoresUpserted: scores.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── POST /api/competency/upload-cv ──────────────────────────────────────────
router.post('/upload-cv', async (req, res) => {
  try {
    const { userId, cvText } = req.body as { userId: string; cvText: string };
    if (!userId || !cvText) return res.status(400).json({ error: 'userId and cvText required' });
    if (!assertOwnerOrElevated(req, res, userId)) return;

    const KEYWORD_MAP: Record<string, string[]> = {
      COG01: ['critical thinking', 'analysis', 'evaluate'],
      COG02: ['problem solving', 'troubleshoot', 'debug'],
      COM01: ['communication', 'presentation', 'speaking'],
      COM02: ['writing', 'documentation', 'reports'],
      LEA01: ['team lead', 'managed', 'leadership'],
      EXE01: ['project management', 'delivered', 'scrum', 'agile'],
      TEC01: ['engineering', 'architecture', 'expert'],
      TEC02: ['digital', 'software', 'platforms'],
      ADP01: ['learning', 'upskilled', 'courses', 'certif'],
      EIQ01: ['self-aware', 'mentored', 'empathy'],
    };

    const lower = cvText.toLowerCase();
    const detected = Object.entries(KEYWORD_MAP).flatMap(([code, keywords]) => {
      const hits = keywords.filter(k => lower.includes(k)).length;
      return hits > 0 ? [{ competencyCode: code, rawScore: Math.min(40 + hits * 15, 85) }] : [];
    });

    res.json({ success: true, userId, detectedCompetencies: detected, message: 'CV parsed. Run /run-assessment to persist scores.' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/competency/compute-score/:userId ───────────────────────────────
router.get('/compute-score/:userId', async (req, res) => {
  if (!assertOwnerOrElevated(req, res, req.params.userId)) return;
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const scoresRes = await getScoresForProfile(profile.id);
    const weightsRes = await getWeightsForRole(profile.current_job_role, profile.career_stage);
    const scores = scoresRes.rows;
    const weightMap = buildWeightMap(weightsRes.rows.map(w => ({ competencyId: w.competency_id, weight: parseFloat(w.weight) })));
    const rawScores = scores.map(s => ({ competencyId: s.competency_id, finalScore: parseFloat(s.final_score) }));
    const weighted = applyWeights(rawScores, weightMap);
    const wAvg = weightedAverage(rawScores, weightMap);

    const byDomain: Record<string, { domainCode: string; domainName: string; competencies: object[]; avgScore: number }> = {};
    for (const s of scores) {
      if (!byDomain[s.domain_code]) {
        byDomain[s.domain_code] = { domainCode: s.domain_code, domainName: s.domain_name, competencies: [], avgScore: 0 };
      }
      const w = weighted.find(ww => ww.competencyId === s.competency_id);
      byDomain[s.domain_code].competencies.push({
        competencyId: s.competency_id,
        competencyCode: s.competency_code,
        competencyName: s.competency_name,
        rawScore: parseFloat(s.raw_score),
        confidence: parseFloat(s.confidence),
        finalScore: parseFloat(s.final_score),
        weightedScore: w?.weightedScore ?? parseFloat(s.final_score),
        assessedAt: s.assessed_at,
      });
    }
    for (const d of Object.values(byDomain)) {
      const comps = d.competencies as { finalScore: number }[];
      d.avgScore = comps.length
        ? Math.round(comps.reduce((sum, c) => sum + c.finalScore, 0) / comps.length)
        : 0;
    }

    res.json({
      profile: { currentRole: profile.current_job_role, targetRole: profile.target_job_role, careerStage: profile.career_stage },
      overallScore: Math.round(scores.reduce((sum, c) => sum + parseFloat(c.final_score), 0) / (scores.length || 1)),
      weightedOverallScore: parseFloat(wAvg.toFixed(1)),
      domains: Object.values(byDomain),
      totalCompetencies: scores.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/competency/get-percentile/:userId ───────────────────────────────
router.get('/get-percentile/:userId', async (req, res) => {
  if (!assertOwnerOrElevated(req, res, req.params.userId)) return;
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const scoresRes = await getScoresForProfile(profile.id);
    const benchRes = await getBenchmarksForRole(profile.current_job_role, profile.career_stage, profile.industry);

    const benchMap = new Map(benchRes.rows.map(b => [b.competency_id, b]));
    const scoreInputs = scoresRes.rows.map(s => ({ competencyId: s.competency_id, finalScore: parseFloat(s.final_score) }));
    const percs = computePercentilesBatch(scoreInputs, benchMap);
    const percMap = new Map(percs.map(p => [p.competencyId, p]));

    const results = scoresRes.rows.map(s => {
      const bench = benchMap.get(s.competency_id);
      const perc = percMap.get(s.competency_id);
      const mean = bench ? parseFloat(bench.mean) : 55;
      return {
        competencyId: s.competency_id,
        competencyCode: s.competency_code,
        competencyName: s.competency_name,
        domainName: s.domain_name,
        userScore: parseFloat(s.final_score),
        percentile: perc?.percentile ?? 50,
        percentileLabel: perc?.label ?? 'Average',
        vsMedian: Math.round(parseFloat(s.final_score) - (bench ? parseFloat(bench.median) : 50)),
        vsMean: Math.round(parseFloat(s.final_score) - mean),
        benchmarkMean: mean,
        benchmarkMedian: bench ? parseFloat(bench.median) : 50,
        p75: bench ? parseFloat(bench.p75) : 65,
      };
    });

    res.json({
      overallPercentile: computeOverallPercentile(results),
      role: profile.current_job_role,
      careerStage: profile.career_stage,
      percentiles: results,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/competency/gap-analysis/:userId ────────────────────────────────
router.get('/gap-analysis/:userId', async (req, res) => {
  if (!assertOwnerOrElevated(req, res, req.params.userId)) return;
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const scoresRes = await getScoresForProfile(profile.id);
    const targetRole = profile.target_job_role ?? profile.current_job_role;
    const benchRes = await getBenchmarksForRole(targetRole, profile.career_stage, profile.industry);
    const weightsRes = await getWeightsForRole(targetRole, profile.career_stage);

    const scores = scoresRes.rows.map(s => ({
      competencyId: s.competency_id,
      competencyCode: s.competency_code,
      competencyName: s.competency_name,
      domainName: s.domain_name,
      finalScore: parseFloat(s.final_score),
    }));

    const benchmarks = benchRes.rows.map(b => ({ competencyId: b.competency_id, p75: parseFloat(b.p75) }));
    const weights = weightsRes.rows.map(w => ({ competencyId: w.competency_id, weight: parseFloat(w.weight) }));

    const gapResult = prioritizeGaps(scores, benchmarks, weights);
    const allGaps: GapItem[] = [...gapResult.critical, ...gapResult.high, ...gapResult.medium, ...gapResult.low];
    const recommendations = recommendInterventions(allGaps, 1);

    res.json({
      targetRole,
      careerStage: profile.career_stage,
      summary: prioritizationSummary(gapResult),
      gaps: allGaps,
      strengths: gapResult.strengths,
      topRecommendations: recommendations.slice(0, 5),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/competency/role-fit/:userId ────────────────────────────────────
router.get('/role-fit/:userId', async (req, res) => {
  if (!assertOwnerOrElevated(req, res, req.params.userId)) return;
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const scoresRes = await getScoresForProfile(profile.id);
    const targetRole = profile.target_job_role ?? profile.current_job_role;
    const benchRes = await getBenchmarksForRole(targetRole, profile.career_stage, profile.industry);
    const currentBenchRes = await getBenchmarksForRole(profile.current_job_role, profile.career_stage, profile.industry);
    const weightsRes = await getWeightsForRole(targetRole, profile.career_stage);

    const scores = scoresRes.rows.map(s => ({
      competencyId: s.competency_id,
      competencyCode: s.competency_code,
      competencyName: s.competency_name,
      domainCode: s.domain_code,
      finalScore: parseFloat(s.final_score),
    }));

    const benchmarks = benchRes.rows.map(b => ({ competencyId: b.competency_id, p75: parseFloat(b.p75), mean: parseFloat(b.mean) }));
    const weights = weightsRes.rows.map(w => ({ competencyId: w.competency_id, weight: parseFloat(w.weight) }));
    const roleFitness = computeRoleFitness(scores, weights, benchmarks);

    const currentBenchMap = new Map(currentBenchRes.rows.map(b => [b.competency_id, parseFloat(b.p75)]));
    const targetBenchMap = new Map(benchmarks.map(b => [b.competencyId, b.p75]));
    const weightMap = buildWeightMap(weights);

    const transitionInputs = scores.map(s => ({
      competencyId: s.competencyId,
      competencyCode: s.competencyCode,
      competencyName: s.competencyName,
      domainName: s.domainCode,
      currentScore: s.finalScore,
      currentRoleTarget: currentBenchMap.get(s.competencyId) ?? 60,
      targetRoleTarget: targetBenchMap.get(s.competencyId) ?? 65,
      weight: weightMap.get(s.competencyId) ?? 1.0,
    }));

    const transitionGaps = computeTransitionGaps(transitionInputs);
    const transitionReadiness = computeTransitionReadiness(transitionGaps);

    res.json({
      targetRole,
      currentRole: profile.current_job_role,
      careerStage: profile.career_stage,
      industry: profile.industry,
      experienceYears: profile.experience_years,
      ...roleFitness,
      transition: transitionReadiness,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/competency/interventions/:userId ───────────────────────────────
router.get('/interventions/:userId', async (req, res) => {
  if (!assertOwnerOrElevated(req, res, req.params.userId)) return;
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const targetRole = profile.target_job_role ?? profile.current_job_role;
    const benchRes = await getBenchmarksForRole(targetRole, profile.career_stage, profile.industry);
    const scoresRes = await getScoresForProfile(profile.id);
    const weightsRes = await getWeightsForRole(targetRole, profile.career_stage);

    const scores = scoresRes.rows.map(s => ({
      competencyId: s.competency_id,
      competencyCode: s.competency_code,
      competencyName: s.competency_name,
      domainName: s.domain_name,
      finalScore: parseFloat(s.final_score),
    }));

    const benchmarks = benchRes.rows.map(b => ({ competencyId: b.competency_id, p75: parseFloat(b.p75) }));
    const weights = weightsRes.rows.map(w => ({ competencyId: w.competency_id, weight: parseFloat(w.weight) }));

    const gapResult = prioritizeGaps(scores, benchmarks, weights);
    const allGaps: GapItem[] = [...gapResult.critical, ...gapResult.high, ...gapResult.medium, ...gapResult.low];
    const topGapIds = allGaps.slice(0, 10).map(g => g.competencyId);

    const dbRes = topGapIds.length
      ? await query<InterventionRow>(`
          SELECT ci.*, c.code AS competency_code, c.name AS competency_name
          FROM competency_interventions ci
          JOIN competencies c ON c.id = ci.competency_id
          WHERE ci.competency_id = ANY($1)
          ORDER BY
            CASE ci.gap_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
            ci.type
          LIMIT 30
        `, [topGapIds])
      : { rows: [] as InterventionRow[] };

    let interventions: object[] = dbRes.rows;

    if (!interventions.length) {
      const engineRecs = recommendInterventions(allGaps, 2);
      interventions = engineRecs.map(r => ({
        id: `${r.competencyId}-${r.interventionType}`,
        type: r.interventionType,
        title: r.title,
        description: `Targeted ${r.interventionType} to improve ${r.competencyName}`,
        provider: null,
        duration_weeks: r.durationWeeks,
        gap_level: r.gapLevel,
        competency_code: r.competencyCode,
        competency_name: r.competencyName,
      }));
    }

    res.json({ interventions, totalGapCount: allGaps.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/competency/simulate-growth/:userId ─────────────────────────────
router.get('/simulate-growth/:userId', async (req, res) => {
  if (!assertOwnerOrElevated(req, res, req.params.userId)) return;
  try {
    const { weeks = '12' } = req.query as { weeks?: string };
    const parsedWeeks = parseInt(weeks, 10);
    const weeksNum = Math.min(Number.isFinite(parsedWeeks) && parsedWeeks > 0 ? parsedWeeks : 12, 52);

    const profile = await getOrCreateProfile(req.params.userId);
    const scoresRes = await getScoresForProfile(profile.id);
    const targetRole = profile.target_job_role ?? profile.current_job_role;
    const benchRes = await getBenchmarksForRole(targetRole, profile.career_stage, profile.industry);
    const weightsRes = await getWeightsForRole(targetRole, profile.career_stage);

    const scores = scoresRes.rows.map(s => ({
      competencyId: s.competency_id,
      competencyCode: s.competency_code,
      competencyName: s.competency_name,
      domainCode: s.domain_code,
      finalScore: parseFloat(s.final_score),
    }));

    const benchmarks = benchRes.rows.map(b => ({ competencyId: b.competency_id, p75: parseFloat(b.p75) }));
    const weights = weightsRes.rows.map(w => ({ competencyId: w.competency_id, weight: parseFloat(w.weight) }));
    const scoresForGap = scores.map(s => ({ ...s, domainName: s.domainCode }));
    const gapResult = prioritizeGaps(scoresForGap, benchmarks, weights);
    const allGaps: GapItem[] = [...gapResult.critical, ...gapResult.high, ...gapResult.medium];
    const interventions = recommendInterventions(allGaps, 1).map(iv => ({
      competencyId: iv.competencyId,
      expectedScoreGain: iv.expectedScoreGain,
      durationWeeks: iv.durationWeeks,
    }));

    const simulation = simulateGrowth(scores, interventions, weeksNum);
    res.json(simulation);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/competency/match-candidates ────────────────────────────────────
// Restricted to admin / hr / super_admin roles only — no PII (emails) exposed
router.get('/match-candidates', async (req, res) => {
  const user = getUser(req);
  if (!user || !isElevated(user.role)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Access restricted to HR and Admin roles.' });
  }
  try {
    const { role, stage = 'mid', industry = 'Technology', limit = '10', minScore, minPercentile } = req.query as Record<string, string>;
    const targetRole = role ?? 'Software Engineer';
    const limitNum = Math.min(parseInt(limit), 50);

    // Fetch candidates filtered by role and stage
    const r = await query<CandidateRow>(`
      SELECT cp.user_id, cp.current_job_role, cp.industry, cp.career_stage, cp.experience_years,
             u.full_name,
             ROUND(AVG(cs.final_score)::numeric, 1) AS avg_score,
             COUNT(cs.id)::int AS scored_competencies
      FROM career_profiles cp
      JOIN users u ON u.id = cp.user_id
      JOIN competency_scores cs ON cs.profile_id = cp.id
      WHERE cp.current_job_role = $1 AND cp.career_stage = $2
      GROUP BY cp.user_id, cp.current_job_role, cp.industry, cp.career_stage, cp.experience_years, u.full_name
      ORDER BY avg_score DESC
      LIMIT $3
    `, [targetRole, stage, limitNum]);

    // Fetch role+industry benchmarks to compute real cohort percentiles
    const benchRes = await getBenchmarksForRole(targetRole, stage, industry);
    const weightsRes = await getWeightsForRole(targetRole, stage);
    const weightMap = buildWeightMap(weightsRes.rows.map(w => ({ competencyId: w.competency_id, weight: parseFloat(w.weight) })));

    // Compute weighted benchmark mean/std for cohort-aware percentile ranking
    let benchWeightedMean = 55;
    let benchWeightedStd = 12;
    if (benchRes.rows.length > 0) {
      const wMeans = benchRes.rows.map(b => {
        const w = weightMap.get(b.competency_id) ?? 1;
        return { mean: parseFloat(b.mean), std: parseFloat(b.std_dev), weight: w };
      });
      const totalWeight = wMeans.reduce((s, x) => s + x.weight, 0) || 1;
      benchWeightedMean = wMeans.reduce((s, x) => s + x.mean * x.weight, 0) / totalWeight;
      benchWeightedStd = wMeans.reduce((s, x) => s + x.std * x.weight, 0) / totalWeight;
    }

    const visProfiles = r.rows.map(row => {
      const overallScore = parseFloat(row.avg_score);
      const overallPercentile = computePercentile(overallScore, benchWeightedMean, benchWeightedStd);
      return {
        userId: row.user_id,
        fullName: row.full_name,
        overallScore,
        overallPercentile,
        currentRole: row.current_job_role,
        industry: row.industry,
        careerStage: row.career_stage,
        experienceYears: parseFloat(row.experience_years),
      };
    });

    const visScores = computeVisibilityScores(visProfiles);
    const enriched = visScores.map((vs, i) => ({
      ...vs,
      currentRole: visProfiles[i].currentRole,
      industry: visProfiles[i].industry,
      careerStage: visProfiles[i].careerStage,
      overallScore: visProfiles[i].overallScore,
      overallPercentile: visProfiles[i].overallPercentile,
    }));

    const matchResult = matchCandidates(enriched, {
      role: targetRole,
      careerStage: stage,
      industry,
      minScore: minScore ? parseInt(minScore) : undefined,
      minPercentile: minPercentile ? parseInt(minPercentile) : undefined,
    });

    res.json({
      targetRole,
      stage,
      industry,
      cohortBenchmark: { weightedMean: Math.round(benchWeightedMean * 10) / 10, weightedStd: Math.round(benchWeightedStd * 10) / 10 },
      totalCandidates: matchResult.totalCandidates,
      matchedCount: matchResult.matchedCandidates.length,
      topMatch: matchResult.topMatch,
      candidates: matchResult.matchedCandidates,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/competency/report/:userId ──────────────────────────────────────
router.get('/report/:userId', async (req, res) => {
  if (!assertOwnerOrElevated(req, res, req.params.userId)) return;
  try {
    const userId = req.params.userId;
    const profile = await getOrCreateProfile(userId);
    const scoresRes = await getScoresForProfile(profile.id);
    const targetRole = profile.target_job_role ?? profile.current_job_role;
    const benchRes = await getBenchmarksForRole(profile.current_job_role, profile.career_stage, profile.industry);
    const benchTargetRes = await getBenchmarksForRole(targetRole, profile.career_stage, profile.industry);
    const weightsRes = await getWeightsForRole(targetRole, profile.career_stage);

    const scores = scoresRes.rows.map(s => ({
      competencyId: s.competency_id,
      competencyCode: s.competency_code,
      competencyName: s.competency_name,
      domainName: s.domain_name,
      domainCode: s.domain_code,
      finalScore: parseFloat(s.final_score),
    }));

    const benchmarks = benchRes.rows.map(b => ({
      competencyId: b.competency_id, p75: parseFloat(b.p75), mean: parseFloat(b.mean),
      median: parseFloat(b.median), stdDev: parseFloat(b.std_dev),
    }));

    const targetBenchmarks = benchTargetRes.rows.map(b => ({
      competencyId: b.competency_id, p75: parseFloat(b.p75), mean: parseFloat(b.mean),
    }));

    const weights = weightsRes.rows.map(w => ({ competencyId: w.competency_id, weight: parseFloat(w.weight) }));
    const weightMap = buildWeightMap(weights);

    const benchMap = new Map(benchmarks.map(b => [b.competencyId, b]));
    const percentiles = scores.map(s => {
      const bench = benchMap.get(s.competencyId);
      const p = bench ? computePercentile(s.finalScore, bench.mean, bench.stdDev) : 50;
      return { ...s, percentile: p, vsMedian: bench ? Math.round(s.finalScore - bench.median) : 0 };
    });

    const gapResult = prioritizeGaps(scores, targetBenchmarks.map(b => ({ competencyId: b.competencyId, p75: b.p75 })), weights);
    const allGaps: GapItem[] = [...gapResult.critical, ...gapResult.high, ...gapResult.medium, ...gapResult.low];
    const roleFit = computeRoleFitness(scores, weights, targetBenchmarks);
    const overallPercentile = computeOverallPercentile(percentiles);
    const wAvg = weightedAverage(scores, weightMap);
    const recommendations = recommendInterventions(allGaps, 1).slice(0, 8);

    res.json({
      generatedAt: new Date().toISOString(),
      profile: {
        userId: profile.user_id,
        fullName: profile.full_name,
        currentRole: profile.current_job_role,
        targetRole: profile.target_job_role,
        industry: profile.industry,
        careerStage: profile.career_stage,
        experienceYears: profile.experience_years,
      },
      overallScore: Math.round(scores.reduce((sum, c) => sum + c.finalScore, 0) / (scores.length || 1)),
      weightedOverallScore: parseFloat(wAvg.toFixed(1)),
      overallPercentile,
      roleFitness: roleFit,
      gapSummary: prioritizationSummary(gapResult),
      topGaps: allGaps.slice(0, 5),
      topStrengths: gapResult.strengths.slice(0, 5),
      percentiles: percentiles.slice(0, 10),
      recommendations,
      domains: groupByDomain(scores),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

function groupByDomain(scores: { competencyId: string; domainName: string; finalScore: number }[]) {
  const map: Record<string, { domainName: string; scores: number[]; avg: number }> = {};
  for (const s of scores) {
    if (!map[s.domainName]) map[s.domainName] = { domainName: s.domainName, scores: [], avg: 0 };
    map[s.domainName].scores.push(s.finalScore);
  }
  for (const d of Object.values(map)) {
    d.avg = Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length);
  }
  return Object.values(map).sort((a, b) => b.avg - a.avg);
}

export default router;
