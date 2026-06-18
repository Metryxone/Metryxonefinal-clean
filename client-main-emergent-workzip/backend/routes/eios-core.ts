import { Express } from 'express';
import { Pool } from 'pg';

const eid = (req: any): string => (req as any).orgId ?? (req.user as any)?.id ?? '';
const wrapE = (fn: Function) => async (req: any, res: any) => {
  try { await fn(req, res); } catch (e: any) {
    console.error('[eios-core]', req.path, e.message);
    res.status(500).json({ error: e.message });
  }
};

// ─── P3 Helpers ──────────────────────────────────────────────────────────────
function deriveRoleCompetencyProfile(job: any, candidates: any[]) {
  const avgEI    = candidates.length ? candidates.reduce((s, c) => s + (Number(c.ei_score) || 50), 0) / candidates.length : 50;
  const avgMatch = candidates.length ? candidates.reduce((s, c) => s + (Number(c.match_score) || 50), 0) / candidates.length : 50;
  const avgLBI   = candidates.length ? candidates.reduce((s, c) => s + (Number(c.lbi_score) || 50), 0) / candidates.length : 50;

  const BEHAVIORAL  = ['Communication', 'Collaboration', 'Leadership', 'Adaptability', 'Initiative', 'Resilience', 'Empathy'];
  const COGNITIVE   = ['Analytical Thinking', 'Problem Solving', 'Critical Reasoning', 'Systems Thinking', 'Decision Making'];
  const reqs: string[] = Array.isArray(job.requirements) ? job.requirements : [];

  const behavioralComps = BEHAVIORAL.slice(0, 5).map(name => {
    const score = Math.round(avgEI * 0.8 + avgLBI * 0.2);
    return { name, score, gap: Math.max(0, 75 - score), required: 75 };
  });
  const functionalComps = (reqs.length ? reqs : ['Core Function 1', 'Core Function 2', 'Core Function 3']).slice(0, 5).map(name => {
    const score = Math.round(avgMatch * 0.9);
    return { name, score, gap: Math.max(0, 70 - score), required: 70 };
  });
  const cognitiveComps = COGNITIVE.slice(0, 4).map(name => {
    const score = Math.round(avgEI * 0.75 + 12);
    return { name, score, gap: Math.max(0, 72 - score), required: 72 };
  });

  const allGaps = [...behavioralComps, ...functionalComps, ...cognitiveComps].filter(c => c.gap > 0);
  const criticalGaps = allGaps.filter(g => g.gap > 20);
  const capabilityRisk = criticalGaps.length > 2 ? 'high' : criticalGaps.length > 0 ? 'moderate' : 'low';

  return {
    jobId: job.id, roleName: job.title, department: job.department || 'General',
    seniority: job.seniority_level || 'mid', candidateCount: candidates.length,
    behavioralCompetencies: behavioralComps,
    functionalCompetencies: functionalComps,
    cognitiveCompetencies: cognitiveComps,
    capabilityReadiness: Math.round((avgEI + avgMatch) / 2),
    roleReadiness: Math.round(avgMatch),
    readinessIndex: Math.round((avgEI * 0.5 + avgMatch * 0.5)),
    behavioralMatch: Math.round(avgEI * 0.85),
    functionalMatch: Math.round(avgMatch * 0.9),
    cognitiveMatch: Math.round(avgEI * 0.75 + 12),
    capabilityRisk,
    competencyGaps: allGaps.map(g => ({
      name: g.name, gap: g.gap,
      severity: g.gap > 20 ? 'critical' : g.gap > 10 ? 'moderate' : 'minor',
    })).sort((a, b) => b.gap - a.gap),
    developmentPriorities: allGaps.sort((a, b) => b.gap - a.gap).slice(0, 3).map(g => g.name),
  };
}

// ─── P7 Helpers ──────────────────────────────────────────────────────────────
const NINE_BOX: Record<string, string> = {
  '3-3': 'Future Leader', '3-2': 'High Potential', '3-1': 'Critical Talent',
  '2-3': 'Emerging Talent', '2-2': 'Effective Performer', '2-1': 'Consistent Performer',
  '1-3': 'At-Risk Talent', '1-2': 'Development Candidate', '1-1': 'At-Risk Talent',
};
function computeNineBox(candidates: any[], wcl0Map: Map<string, any> = new Map()) {
  return candidates.map(c => {
    const eiScore  = Number(c.ei_score) || 50;
    const lbi      = Number(c.lbi_score) || 50;
    const match    = Number(c.match_score) || 50;
    // Enrich potential score with WCL-0 behavioral dimensions when available
    const wcl0 = wcl0Map.get(c.email || '');
    const behavioralBoost = wcl0
      ? Math.round((
          (Number(wcl0.motivation_score) || 50) * 0.3 +
          (Number(wcl0.adaptability_score) || 50) * 0.3 +
          (Number(wcl0.engagement_score) || 50) * 0.2 +
          (Number(wcl0.confidence_score) || 50) * 0.2
        ))
      : null;
    const potRaw   = behavioralBoost !== null
      ? lbi * 0.35 + match * 0.35 + behavioralBoost * 0.3
      : lbi * 0.5 + match * 0.5;
    const perfBand = eiScore >= 70 ? 3 : eiScore >= 50 ? 2 : 1;
    const potBand  = potRaw >= 68 ? 3 : potRaw >= 52 ? 2 : 1;
    const key      = `${perfBand}-${potBand}`;
    return {
      candidateId: c.id, name: c.candidate_name || c.name, email: c.email,
      department: c.department || 'General', jobTitle: c.job_title || c.role,
      performanceBand: perfBand, potentialBand: potBand,
      performanceScore: eiScore, potentialScore: Math.round(potRaw),
      behavioralScore: behavioralBoost ?? undefined,
      box: (3 - perfBand) * 3 + potBand,
      classification: NINE_BOX[key] || 'Consistent Performer',
    };
  });
}

// ─── P8 Helpers ──────────────────────────────────────────────────────────────
function computeSuccession(candidates: any[], assessments: any[], wcl0Map: Map<string, any> = new Map()) {
  const assMap = new Map(assessments.map(a => [a.candidate_id, a]));
  const pipeline = candidates.map(c => {
    const ass = assMap.get(c.id);
    const readiness   = ass ? Number(ass.readiness_score) || 50 : Number(c.ei_score) || 50;
    const leadership  = ass ? Number(ass.leadership_prediction) || 0 : 0;
    // WCL-0 behavioral enrichment: risk_score inverted as resilience factor
    const wcl0 = wcl0Map.get(c.email || '');
    const behavioralScore = wcl0
      ? Math.round(
          (Number(wcl0.motivation_score) || 50) * 0.4 +
          (100 - (Number(wcl0.risk_score) || 50)) * 0.3 +
          (Number(wcl0.adaptability_score) || 50) * 0.3
        )
      : undefined;
    const stage = readiness >= 80 ? 'ready_now' : readiness >= 65 ? 'ready_6m' : readiness >= 50 ? 'ready_12m' : 'developing';
    return {
      candidateId: c.id, name: c.candidate_name || c.name,
      role: c.job_title || c.role || 'N/A', department: c.department || 'General',
      readinessScore: readiness, leadershipScore: leadership,
      behavioralScore,
      successionStage: stage,
      benchStrength: readiness >= 70 ? 'strong' : readiness >= 55 ? 'moderate' : 'weak',
    };
  });
  const readyNow = pipeline.filter(p => p.successionStage === 'ready_now');
  const ready6m  = pipeline.filter(p => p.successionStage === 'ready_6m');
  const ready12m = pipeline.filter(p => p.successionStage === 'ready_12m');
  return {
    pipeline,
    summary: {
      readyNow: readyNow.length, ready6Months: ready6m.length, ready12Months: ready12m.length,
      developing: pipeline.filter(p => p.successionStage === 'developing').length,
      benchStrength: Math.min(100, readyNow.length * 15 + ready6m.length * 10),
      successorRisk: readyNow.length === 0 ? 'critical' : readyNow.length < 3 ? 'moderate' : 'low',
      leadershipPipeline: pipeline.filter(p => p.leadershipScore >= 65).length,
      criticalRoleCoverage: Math.min(100, readyNow.length * 20),
      replacementAvailability: Math.round((readyNow.length + ready6m.length * 0.7) / Math.max(1, pipeline.length) * 100),
    }
  };
}

// ─── P9 Helpers ──────────────────────────────────────────────────────────────
function computeCriticalRoles(jobs: any[], candidates: any[]) {
  const byJob = new Map<string, any[]>();
  for (const c of candidates) { const a = byJob.get(c.job_id) || []; a.push(c); byJob.set(c.job_id, a); }
  return jobs.map(job => {
    const cands    = byJob.get(job.id) || [];
    const hired    = cands.filter(c => c.stage === 'Hired');
    const finalists = cands.filter(c => ['Offer', 'Interview'].includes(c.stage));
    const avgMatch = finalists.length ? finalists.reduce((s, c) => s + (Number(c.match_score) || 50), 0) / finalists.length : 0;
    const seniority = (job.seniority_level || '').toLowerCase();
    return {
      jobId: job.id, roleName: job.title, department: job.department || 'General',
      vacancyRisk: hired.length === 0 && finalists.length === 0 ? 'critical' : hired.length === 0 ? 'high' : 'low',
      dependencyRisk: cands.length <= 1 ? 'high' : cands.length <= 3 ? 'moderate' : 'low',
      capabilityExposure: Math.max(0, 100 - Math.round(avgMatch)),
      leadershipExposure: seniority.includes('senior') || seniority.includes('lead') || seniority.includes('director') ? 'high' : 'moderate',
      timeToReplace: cands.length === 0 ? 90 : hired.length > 0 ? 30 : 60,
      singlePointDependency: hired.length <= 1,
      candidateCount: cands.length, finalistCount: finalists.length,
    };
  });
}

// ─── P10 Helpers ─────────────────────────────────────────────────────────────
function computeWorkforceHeatmap(candidates: any[]) {
  const byDept = new Map<string, any[]>();
  for (const c of candidates) {
    const dept = c.department || 'General';
    const a = byDept.get(dept) || []; a.push(c); byDept.set(dept, a);
  }
  return [...byDept.entries()].map(([dept, cands]) => {
    const avgEI    = cands.reduce((s, c) => s + (Number(c.ei_score) || 50), 0) / cands.length;
    const avgMatch = cands.reduce((s, c) => s + (Number(c.match_score) || 50), 0) / cands.length;
    const avgLBI   = cands.reduce((s, c) => s + (Number(c.lbi_score) || 50), 0) / cands.length;
    return {
      department: dept, headcount: cands.length,
      capabilityScore:      Math.round(avgMatch),
      leadershipScore:      Math.round(avgEI * 0.85),
      innovationScore:      Math.round(avgLBI * 0.8 + avgMatch * 0.2),
      executionScore:       Math.round(avgEI * 0.7 + avgMatch * 0.3),
      customerScore:        Math.round((avgEI + avgMatch) / 2 * 0.9),
      digitalReadiness:     Math.round(avgMatch * 0.75 + avgLBI * 0.25),
      aiReadiness:          Math.round(avgMatch * 0.6 + avgLBI * 0.4),
      workforceHealth:      Math.round((avgEI + avgMatch + avgLBI) / 3),
      capabilityHealth:     Math.round(avgMatch),
      leadershipHealth:     Math.round(avgEI),
      futureWorkforceHealth:Math.round(avgLBI * 0.6 + avgMatch * 0.4),
    };
  });
}

// ─── P16 Helpers ─────────────────────────────────────────────────────────────
function computeForecasting(jobs: any[], candidates: any[]) {
  const open   = jobs.filter(j => j.status !== 'closed');
  const hired  = candidates.filter(c => c.stage === 'Hired');
  const avgPpl = Math.round(candidates.length / Math.max(1, jobs.length));
  return {
    capabilitySupply:   candidates.filter(c => Number(c.match_score) >= 70).length,
    capabilityDemand:   open.length * 2,
    leadershipSupply:   candidates.filter(c => Number(c.ei_score) >= 75).length,
    futureSkillDemand:  open.slice(0, 5).map(j => ({ role: j.title, department: j.department, urgency: j.priority || 'medium' })),
    hiringDemand:       open.length,
    attritionForecast:  Math.round(candidates.length * 0.12),
    capabilityForecast: {
      '30d': { supply: candidates.filter(c => Number(c.match_score) >= 65).length, demand: open.filter(j => j.priority === 'high').length || open.length },
      '60d': { supply: candidates.filter(c => Number(c.match_score) >= 60).length, demand: open.length },
      '90d': { supply: candidates.length, demand: Math.round(open.length * 1.2) },
    },
    leadershipForecast: { '6m': candidates.filter(c => Number(c.ei_score) >= 70).length, '12m': candidates.filter(c => Number(c.ei_score) >= 65).length },
    hiringForecast:     { projectedHires: Math.round(hired.length * 3), avgPipelineSize: avgPpl, fillRate: candidates.length > 0 ? Math.round(hired.length / candidates.length * 100) : 0 },
  };
}

// ─── P17 Helpers ─────────────────────────────────────────────────────────────
function runScenario(scenario: string, magnitude: number, totalPeople: number) {
  const n = Math.round(totalPeople * (magnitude / 100));
  const base: Record<string, any> = { scenario, magnitude, peopleAffected: n };
  switch (scenario) {
    case 'hiring_expansion':
      return { ...base, capabilityImpact: `+${Math.round(magnitude * 0.8)}% coverage`, costImpact: `+₹${(n * 800000).toLocaleString()} annual`, leadershipImpact: `+${Math.round(n * 0.1)} leaders`, readinessImpact: `+${Math.round(magnitude * 0.5)}%`, timeToImpact: '30–90 days' };
    case 'layoffs':
      return { ...base, capabilityImpact: `-${Math.round(magnitude * 1.2)}% coverage`, costImpact: `-₹${(n * 800000).toLocaleString()} annual`, leadershipImpact: `-${Math.round(n * 0.15)} positions`, readinessImpact: `-${Math.round(magnitude * 0.8)}%`, timeToImpact: 'Immediate' };
    case 'upskilling':
      return { ...base, capabilityImpact: `+${Math.round(magnitude * 0.6)}% scores`, costImpact: `₹${Math.round(totalPeople * magnitude * 500).toLocaleString()} training`, leadershipImpact: `+${Math.round(totalPeople * 0.05)} emerging`, readinessImpact: `+${Math.round(magnitude * 0.4)}%`, timeToImpact: '3–6 months' };
    case 'automation':
      return { ...base, capabilityImpact: `-${Math.round(magnitude * 0.7)}% routine roles`, costImpact: `-₹${(n * 600000).toLocaleString()} annual`, leadershipImpact: `${Math.round(n * 0.2)} redeployed`, readinessImpact: `+${Math.round(magnitude * 0.3)}% strategic`, timeToImpact: '6–12 months' };
    case 'restructuring':
      return { ...base, capabilityImpact: `${Math.round(magnitude * 0.3)}% reorg overhead`, costImpact: `₹${Math.round(totalPeople * magnitude * 200).toLocaleString()} transition`, leadershipImpact: `${Math.round(n * 0.4)} role changes`, readinessImpact: `-${Math.round(magnitude * 0.2)}% short-term`, timeToImpact: '1–3 months' };
    default:
      return { ...base, capabilityImpact: 'N/A', costImpact: 'N/A', leadershipImpact: 'N/A', readinessImpact: 'N/A', timeToImpact: 'N/A' };
  }
}

// ─── EIOS Core Schema ─────────────────────────────────────────────────────────
async function ensureEIOSCoreSchema(pool: Pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eios_campaigns (
        id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        employer_id   TEXT NOT NULL,
        job_id        TEXT,
        name          TEXT NOT NULL,
        status        TEXT DEFAULT 'active',
        target_count  INT DEFAULT 0,
        sent_count    INT DEFAULT 0,
        completed_count INT DEFAULT 0,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS eios_scenarios (
        id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        employer_id   TEXT NOT NULL,
        scenario_type TEXT NOT NULL,
        magnitude     INT DEFAULT 10,
        result        JSONB,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch (e: any) { console.warn('[eios-core] schema warning:', e.message); }
}

// ─── Main Registration ────────────────────────────────────────────────────────
export function registerEIOSCoreRoutes(app: Express, pool: Pool, requireAuth: Function) {
  setImmediate(() => ensureEIOSCoreSchema(pool));

  // ── P3: Role & Competency Intelligence ────────────────────────────────────
  app.get('/api/employer/eios/p3/role-competency', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { rows: jobs }       = await pool.query(`SELECT * FROM employer_jobs WHERE employer_id=$1 ORDER BY created_at DESC LIMIT 20`, [orgId]);
    const { rows: candidates } = await pool.query(`SELECT c.*, j.department, j.title as job_title FROM employer_candidates c LEFT JOIN employer_jobs j ON j.id=c.job_id WHERE c.employer_id=$1 LIMIT 200`, [orgId]);
    const profiles = jobs.map(j => deriveRoleCompetencyProfile(j, candidates.filter(c => c.job_id === j.id)));
    const avgReadiness = profiles.length ? Math.round(profiles.reduce((s, p) => s + p.readinessIndex, 0) / profiles.length) : 0;
    res.json({
      pillar: 3, name: 'Role & Competency Intelligence', profiles,
      summary: { totalRoles: jobs.length, avgReadiness, highRisk: profiles.filter(p => p.capabilityRisk === 'high').length, behavioralMatch: profiles.length ? Math.round(profiles.reduce((s, p) => s + p.behavioralMatch, 0) / profiles.length) : 0, functionalMatch: profiles.length ? Math.round(profiles.reduce((s, p) => s + p.functionalMatch, 0) / profiles.length) : 0, cognitiveMatch: profiles.length ? Math.round(profiles.reduce((s, p) => s + p.cognitiveMatch, 0) / profiles.length) : 0 },
    });
  }));

  app.get('/api/employer/eios/p3/role-competency/:jobId', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { rows: jobs } = await pool.query(`SELECT * FROM employer_jobs WHERE employer_id=$1 AND id=$2`, [orgId, req.params.jobId]);
    if (!jobs[0]) return res.status(404).json({ error: 'Role not found' });
    const { rows: candidates } = await pool.query(`SELECT * FROM employer_candidates WHERE employer_id=$1 AND job_id=$2`, [orgId, req.params.jobId]);
    res.json({ pillar: 3, ...deriveRoleCompetencyProfile(jobs[0], candidates) });
  }));

  // ── P6: Recruiter Intelligence ────────────────────────────────────────────
  app.get('/api/employer/eios/p6/recruiter-scorecard', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const [{ rows: candidates }, { rows: interviews }, { rows: offers }, { rows: members }] = await Promise.all([
      pool.query(`SELECT * FROM employer_candidates WHERE employer_id=$1 LIMIT 200`, [orgId]),
      pool.query(`SELECT * FROM employer_interviews WHERE employer_id=$1`, [orgId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT * FROM employer_offers WHERE employer_id=$1`, [orgId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT * FROM employer_members WHERE employer_id=$1`, [orgId]).catch(() => ({ rows: [] })),
    ]);
    const hired = candidates.filter(c => c.stage === 'Hired');
    const totalDays = hired.reduce((s, c) => s + Math.min(90, Math.round((Date.now() - new Date(c.created_at || Date.now()).getTime()) / 86400000)), 0);
    const { rows: jobCount } = await pool.query(`SELECT COUNT(*) FROM employer_jobs WHERE employer_id=$1`, [orgId]);

    res.json({
      pillar: 6, name: 'Recruiter Intelligence',
      scorecard: {
        totalRecruiters:       Math.max(1, members.length),
        activeJobs:            Number(jobCount[0]?.count) || 0,
        candidatesManaged:     candidates.length,
        timeToHire:            hired.length > 0 ? Math.round(totalDays / hired.length) : 0,
        offerAcceptanceRate:   offers.length > 0 ? Math.round(offers.filter(o => o.status === 'Accepted').length / offers.length * 100) : 0,
        pipelineConversionRate:candidates.length > 0 ? Math.round(hired.length / candidates.length * 100) : 0,
        interviewConversionRate:interviews.length > 0 ? Math.round(candidates.filter(c => ['Offer', 'Hired'].includes(c.stage)).length / interviews.length * 100) : 0,
        qualityOfHire:         hired.length > 0 ? Math.round(hired.reduce((s, c) => s + (Number(c.ei_score) || 50), 0) / hired.length) : 0,
        costToHire:            45000,
        recruiterEffectiveness:hired.length >= 5 ? 'high' : hired.length >= 2 ? 'medium' : 'low',
        sourceEffectiveness:   { referral: 20, direct: 35, portal: 45 },
        pipelineEffectiveness: candidates.length > 0 ? Math.round(candidates.filter(c => ['Interview', 'Offer', 'Hired'].includes(c.stage)).length / candidates.length * 100) : 0,
        interviewEffectiveness:interviews.length > 0 ? Math.round(interviews.filter((i: any) => i.recommendation === 'hire').length / interviews.length * 100) : 0,
      }
    });
  }));

  // ── P7: 9-Box Talent Matrix ───────────────────────────────────────────────
  app.get('/api/employer/eios/p7/nine-box', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const [{ rows: candidates }, { rows: wcl0 }] = await Promise.all([
      pool.query(`
        SELECT c.*, j.title as job_title, j.department
        FROM employer_candidates c LEFT JOIN employer_jobs j ON j.id=c.job_id
        WHERE c.employer_id=$1 LIMIT 200
      `, [orgId]),
      // WCL-0 behavioral spine — keyed by user_email, joined via candidate email
      pool.query(`
        SELECT w.* FROM wcl0_user_intelligence w
        WHERE w.user_email IN (
          SELECT DISTINCT email FROM employer_candidates WHERE employer_id=$1 AND email IS NOT NULL
        ) LIMIT 200
      `, [orgId]).catch(() => ({ rows: [] })),
    ]);
    const wcl0Map = new Map(wcl0.map((w: any) => [w.user_email, w]));
    const matrix = computeNineBox(candidates, wcl0Map);
    const classifications: Record<string, number> = {};
    for (const m of matrix) classifications[m.classification] = (classifications[m.classification] || 0) + 1;
    const enrichedCount = wcl0.length;
    const talent_pools = {
      high_potential: {
        label: 'High Potential', color: 'emerald',
        description: 'Top quadrant: high performance + high potential',
        count: (classifications['High Potential'] || 0) + (classifications['Future Leader'] || 0),
        members: matrix.filter(m => ['High Potential', 'Future Leader'].includes(m.classification)).map(m => ({ id: m.candidateId, name: m.name, score: m.performanceScore })).slice(0, 5),
      },
      high_performer: {
        label: 'High Performer', color: 'blue',
        description: 'High performance, developing potential',
        count: (classifications['Critical Talent'] || 0) + (classifications['Effective Performer'] || 0),
        members: matrix.filter(m => ['Critical Talent', 'Effective Performer'].includes(m.classification)).map(m => ({ id: m.candidateId, name: m.name, score: m.performanceScore })).slice(0, 5),
      },
      future_leader: {
        label: 'Future Leader', color: 'purple',
        description: 'Identified for accelerated leadership development',
        count: classifications['Future Leader'] || 0,
        members: matrix.filter(m => m.classification === 'Future Leader').map(m => ({ id: m.candidateId, name: m.name, score: m.performanceScore })).slice(0, 5),
      },
      at_risk: {
        label: 'At Risk', color: 'rose',
        description: 'Requires immediate support or intervention',
        count: classifications['At-Risk Talent'] || 0,
        members: matrix.filter(m => m.classification === 'At-Risk Talent').map(m => ({ id: m.candidateId, name: m.name, score: m.performanceScore })).slice(0, 5),
      },
    };
    res.json({
      pillar: 7, name: '9-Box Talent Matrix', matrix, classifications,
      talent_pools,
      behavioralEnrichment: { enriched: enrichedCount, total: candidates.length },
      summary: {
        totalPeople: matrix.length,
        futureLeaders:        classifications['Future Leader'] || 0,
        highPotentials:       classifications['High Potential'] || 0,
        criticalTalent:       classifications['Critical Talent'] || 0,
        emergingTalent:       classifications['Emerging Talent'] || 0,
        coreContributors:     classifications['Effective Performer'] || 0,
        atRisk:               (classifications['At-Risk Talent'] || 0),
        developmentCandidates:classifications['Development Candidate'] || 0,
      }
    });
  }));

  // ── P8: Succession Intelligence ───────────────────────────────────────────
  app.get('/api/employer/eios/p8/succession', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const [{ rows: candidates }, { rows: assessments }, { rows: wcl0 }] = await Promise.all([
      pool.query(`SELECT c.*, j.title as job_title, j.department FROM employer_candidates c LEFT JOIN employer_jobs j ON j.id=c.job_id WHERE c.employer_id=$1 LIMIT 200`, [orgId]),
      pool.query(`SELECT * FROM ep98_hiring_assessments WHERE employer_id=$1 LIMIT 200`, [orgId]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT w.* FROM wcl0_user_intelligence w
        WHERE w.user_email IN (
          SELECT DISTINCT email FROM employer_candidates WHERE employer_id=$1 AND email IS NOT NULL
        ) LIMIT 200
      `, [orgId]).catch(() => ({ rows: [] })),
    ]);
    const wcl0Map = new Map(wcl0.map((w: any) => [w.user_email, w]));
    const succResult = computeSuccession(candidates, assessments, wcl0Map);
    const succession_timeline = [
      { stage: 'Ready Now',       horizon: '0–3 months',   count: succResult.summary?.readyNow        || 0, color: 'emerald', criteria: 'EI score ≥80 — deploy immediately' },
      { stage: 'Ready 6 Months',  horizon: '3–6 months',   count: succResult.summary?.ready6Months    || 0, color: 'blue',    criteria: 'EI score ≥70 — accelerated development' },
      { stage: 'Ready 12 Months', horizon: '6–12 months',  count: succResult.summary?.ready12Months   || 0, color: 'amber',   criteria: 'EI score ≥60 — structured development plan' },
      { stage: 'Ready 24 Months', horizon: '12–24 months', count: Math.round((succResult.summary?.leadershipPipeline || 0) * 0.5), color: 'slate', criteria: 'EI score ≥50 — long-range pipeline' },
    ];
    res.json({ pillar: 8, name: 'Succession Intelligence', ...succResult, succession_timeline });
  }));

  // ── P9: Critical Role Intelligence ────────────────────────────────────────
  app.get('/api/employer/eios/p9/critical-roles', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const [{ rows: jobs }, { rows: candidates }] = await Promise.all([
      pool.query(`SELECT * FROM employer_jobs WHERE employer_id=$1`, [orgId]),
      pool.query(`SELECT * FROM employer_candidates WHERE employer_id=$1 LIMIT 200`, [orgId]),
    ]);
    const roles = computeCriticalRoles(jobs, candidates);
    res.json({
      pillar: 9, name: 'Critical Role Intelligence', roles,
      summary: {
        totalRoles: jobs.length,
        criticalVacancyRisk:    roles.filter(r => r.vacancyRisk === 'critical').length,
        highVacancyRisk:        roles.filter(r => r.vacancyRisk === 'high').length,
        singlePointDependencies:roles.filter(r => r.singlePointDependency).length,
        avgTimeToReplace:       roles.length ? Math.round(roles.reduce((s, r) => s + r.timeToReplace, 0) / roles.length) : 0,
        capabilityExposure:     roles.length ? Math.round(roles.reduce((s, r) => s + r.capabilityExposure, 0) / roles.length) : 0,
      }
    });
  }));

  // ── P10: Workforce Intelligence ───────────────────────────────────────────
  app.get('/api/employer/eios/p10/workforce', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { rows: candidates } = await pool.query(`
      SELECT c.*, j.department FROM employer_candidates c
      LEFT JOIN employer_jobs j ON j.id=c.job_id WHERE c.employer_id=$1 LIMIT 200
    `, [orgId]);
    const heatmap = computeWorkforceHeatmap(candidates);
    const n = Math.max(1, heatmap.length);
    const avg = (key: string) => Math.round(heatmap.reduce((s: number, h: any) => s + h[key], 0) / n);
    res.json({
      pillar: 10, name: 'Workforce Intelligence', heatmap,
      views: { organization: 1, functions: heatmap.length, departments: heatmap.length, teams: 0, locations: 1, regions: 1, countries: 1 },
      orgSummary: {
        totalDepartments:     heatmap.length, totalPeople: candidates.length,
        capabilityHealth:     avg('capabilityHealth'), leadershipHealth: avg('leadershipHealth'),
        workforceHealth:      avg('workforceHealth'), futureWorkforceHealth: avg('futureWorkforceHealth'),
        aiReadiness:          avg('aiReadiness'), digitalReadiness: avg('digitalReadiness'),
        innovationScore:      avg('innovationScore'), executionScore: avg('executionScore'),
      }
    });
  }));

  // ── P11: Assessment Campaign Engine ──────────────────────────────────────
  app.get('/api/employer/eios/p11/campaigns', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const [{ rows: candidates }, { rows: assessments }, { rows: jobs }, { rows: campaigns }] = await Promise.all([
      pool.query(`SELECT * FROM employer_candidates WHERE employer_id=$1 LIMIT 200`, [orgId]),
      pool.query(`SELECT * FROM ep98_hiring_assessments WHERE employer_id=$1`, [orgId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT * FROM employer_jobs WHERE employer_id=$1`, [orgId]),
      pool.query(`SELECT * FROM eios_campaigns WHERE employer_id=$1 ORDER BY created_at DESC LIMIT 20`, [orgId]).catch(() => ({ rows: [] })),
    ]);
    const assessed = new Set(assessments.map((a: any) => a.candidate_id));
    const jobCoverage = jobs.map(j => {
      const jcands = candidates.filter(c => c.job_id === j.id);
      const jDone  = jcands.filter(c => assessed.has(c.id));
      return {
        jobId: j.id, roleName: j.title, department: j.department,
        totalCandidates: jcands.length, assessed: jDone.length,
        pending: jcands.length - jDone.length,
        coverageRate: jcands.length > 0 ? Math.round(jDone.length / jcands.length * 100) : 0,
        status: jcands.length === 0 ? 'no_candidates' : jDone.length === jcands.length ? 'complete' : jDone.length > 0 ? 'in_progress' : 'pending',
      };
    });
    const coverage = candidates.length > 0 ? Math.round(assessed.size / candidates.length * 100) : 0;
    res.json({
      pillar: 11, name: 'Assessment Campaign Engine', campaigns, jobCoverage,
      summary: { totalCandidates: candidates.length, assessed: assessed.size, pending: candidates.length - assessed.size, coverage, assessmentHealth: coverage >= 80 ? 'healthy' : coverage >= 50 ? 'moderate' : 'low', activeCampaigns: campaigns.filter((c: any) => c.status === 'active').length }
    });
  }));

  app.post('/api/employer/eios/p11/campaigns', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { name, job_id, target_count } = req.body;
    if (!name) return res.status(400).json({ error: 'Campaign name required' });
    const { rows } = await pool.query(`
      INSERT INTO eios_campaigns (employer_id, job_id, name, target_count, status)
      VALUES ($1,$2,$3,$4,'active') RETURNING *
    `, [orgId, job_id || null, name, target_count || 0]);
    res.json({ success: true, campaign: rows[0] });
  }));

  // ── P12: Internal Talent Marketplace ─────────────────────────────────────
  app.get('/api/employer/eios/p12/marketplace', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const [{ rows: jobs }, { rows: candidates }, { rows: assessments }] = await Promise.all([
      pool.query(`SELECT * FROM employer_jobs WHERE employer_id=$1 LIMIT 10`, [orgId]),
      pool.query(`SELECT * FROM employer_candidates WHERE employer_id=$1 LIMIT 200`, [orgId]),
      pool.query(`SELECT * FROM ep98_hiring_assessments WHERE employer_id=$1 LIMIT 200`, [orgId]).catch(() => ({ rows: [] })),
    ]);
    const assMap = new Map(assessments.map((a: any) => [a.candidate_id, a]));
    const marketplace = jobs.map(job => {
      const matches = candidates.map(c => {
        const ass = assMap.get(c.id);
        const fitScore = ass ? Number(ass.fit_score) || 50 : Number(c.match_score) || 50;
        return { candidateId: c.id, name: c.candidate_name || c.name, fitScore, currentRole: c.job_title || 'N/A', currentDept: c.department || 'N/A' };
      }).sort((a, b) => b.fitScore - a.fitScore).slice(0, 5);
      return {
        jobId: job.id, roleName: job.title, department: job.department,
        internalMatches: matches, internalMatchCount: matches.filter(m => m.fitScore >= 60).length,
        careerPathMatch: matches.filter(m => m.fitScore >= 65).length,
        promotionMatch: matches.filter(m => m.fitScore >= 75).length,
        reskillingMatch: matches.filter(m => m.fitScore >= 50 && m.fitScore < 65).length,
        upskillingMatch: matches.filter(m => m.fitScore >= 55 && m.fitScore < 75).length,
        internalOpportunityMatch: matches.filter(m => m.fitScore >= 60).length,
      };
    });
    res.json({
      pillar: 12, name: 'Internal Talent Marketplace', marketplace,
      summary: {
        totalOpportunities:     jobs.length,
        internalMatchAvailable: marketplace.filter(m => m.internalMatchCount > 0).length,
        promotionReady:         marketplace.reduce((s, m) => s + m.promotionMatch, 0),
        reskillingReady:        marketplace.reduce((s, m) => s + m.reskillingMatch, 0),
        upskillingReady:        marketplace.reduce((s, m) => s + m.upskillingMatch, 0),
      }
    });
  }));

  // ── P13: Learning & Development Intelligence ──────────────────────────────
  app.get('/api/employer/eios/p13/learning', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { rows: candidates } = await pool.query(`SELECT * FROM employer_candidates WHERE employer_id=$1 LIMIT 200`, [orgId]);
    const { rows: frp } = await pool.query(`
      SELECT f.* FROM frp_user_readiness f
      WHERE f.user_id::text IN (
        SELECT DISTINCT c.email FROM employer_candidates c WHERE c.employer_id=$1
      ) LIMIT 100
    `, [orgId]).catch(() => ({ rows: [] }));

    const avgFRI  = frp.length ? frp.reduce((s: number, f: any) => s + (Number(f.fri_score) || 50), 0) / frp.length : 0;
    const hasData = frp.length > 0;
    res.json({
      pillar: 13, name: 'Learning & Development Intelligence',
      learningEffectiveness:  hasData ? Math.round(avgFRI * 0.85) : null,
      learningROI:            hasData ? Math.round(avgFRI * 1.2) : null,
      capabilityGrowth:       hasData ? Math.round(avgFRI * 0.6) : null,
      skillGrowthVelocity:    hasData ? (avgFRI >= 70 ? 'high' : avgFRI >= 55 ? 'moderate' : 'low') : null,
      developmentReadiness:   candidates.filter(c => Number(c.ei_score) >= 65).length,
      capabilityImprovement:  hasData ? Math.round(avgFRI - 50) : 0,
      learningImpact:         hasData ? 'measured' : 'pending_frp_data',
      developmentIntelligence:{ highLearners: frp.filter((f: any) => Number(f.fri_score) >= 70).length, midLearners: frp.filter((f: any) => Number(f.fri_score) >= 50 && Number(f.fri_score) < 70).length, atRiskLearners: frp.filter((f: any) => Number(f.fri_score) < 50).length },
      coverage: Math.round(frp.length / Math.max(1, candidates.length) * 100),
      dataSource: hasData ? 'frp_user_readiness' : 'no_frp_data',
    });
  }));

  // ── P14: Employee Lifecycle Intelligence ──────────────────────────────────
  app.get('/api/employer/eios/p14/lifecycle', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { rows: candidates } = await pool.query(`
      SELECT c.*, j.title as job_title, j.department
      FROM employer_candidates c LEFT JOIN employer_jobs j ON j.id=c.job_id
      WHERE c.employer_id=$1
    `, [orgId]);
    const stageMap: Record<string, string> = { Hired: 'hire', Applied: 'onboard', Screened: 'develop', Interview: 'develop', Assessment: 'develop', Offer: 'retain', Rejected: 'exit' };
    const buckets: Record<string, any[]> = { hire: [], onboard: [], develop: [], promote: [], retain: [], exit: [] };
    for (const c of candidates) { const b = stageMap[c.stage] || 'develop'; (buckets[b] = buckets[b] || []).push(c); }
    const hired = buckets.hire;
    const avgHiredEI = hired.length ? Math.round(hired.reduce((s, c) => s + (Number(c.ei_score) || 50), 0) / hired.length) : 0;
    res.json({
      pillar: 14, name: 'Employee Lifecycle Intelligence',
      stageCounts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
      onboardingReadiness:  avgHiredEI >= 70 ? 'high' : avgHiredEI >= 55 ? 'moderate' : 'developing',
      promotionReadiness:   hired.filter(c => Number(c.ei_score) >= 75).length,
      retentionRisk:        candidates.filter(c => Number(c.ei_score) < 50).length,
      exitRisk:             candidates.filter(c => c.stage === 'Rejected' && Number(c.ei_score) >= 65).length,
      lifecycleIntelligence:{ totalCandidates: candidates.length, hired: hired.length, avgHiredEI, conversionRate: candidates.length > 0 ? Math.round(hired.length / candidates.length * 100) : 0 },
    });
  }));

  // ── P15: Organizational Network Intelligence ──────────────────────────────
  app.get('/api/employer/eios/p15/network', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const [{ rows: nodes }, { rows: edges }] = await Promise.all([
      pool.query(`SELECT * FROM tig_nodes WHERE employer_id=$1 LIMIT 100`, [orgId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT * FROM tig_edges WHERE employer_id=$1 LIMIT 200`, [orgId]).catch(() => ({ rows: [] })),
    ]);
    const degMap = new Map<string, number>();
    for (const e of edges) {
      degMap.set(e.from_id, (degMap.get(e.from_id) || 0) + 1);
      degMap.set(e.to_id,   (degMap.get(e.to_id) || 0) + 1);
    }
    const connectors = [...degMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nid, deg]) => {
      const n = nodes.find((nd: any) => nd.id === nid);
      return { nodeId: nid, name: n?.label || nid, degree: deg, type: n?.node_type || 'unknown' };
    });
    const nodesByType: Record<string, number> = {};
    for (const n of nodes) nodesByType[n.node_type] = (nodesByType[n.node_type] || 0) + 1;
    res.json({
      pillar: 15, name: 'Organizational Network Intelligence',
      nodeCount: nodes.length, edgeCount: edges.length, nodesByType,
      networkDensity: nodes.length > 1 ? Math.round(edges.length / (nodes.length * (nodes.length - 1) / 2) * 100) : 0,
      organizationalConnectors: connectors,
      hiddenLeaders: nodes.filter((n: any) => n.node_type === 'user' && (degMap.get(n.id) || 0) >= 3).length,
      knowledgeRisk: nodes.length < 10 ? 'underdeveloped' : 'monitored',
      knowledgeConcentration: connectors.length > 0 ? connectors[0].degree : 0,
      influenceNetwork: connectors.slice(0, 3), collaborationNetwork: connectors.slice(0, 5),
      dataSource: nodes.length > 0 ? 'tig_nodes' : 'no_tig_data',
    });
  }));

  // ── P16: Workforce Forecasting ────────────────────────────────────────────
  app.get('/api/employer/eios/p16/forecast', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const [{ rows: jobs }, { rows: candidates }] = await Promise.all([
      pool.query(`SELECT * FROM employer_jobs WHERE employer_id=$1`, [orgId]),
      pool.query(`SELECT * FROM employer_candidates WHERE employer_id=$1 LIMIT 200`, [orgId]),
    ]);
    res.json({ pillar: 16, name: 'Workforce Forecasting', ...computeForecasting(jobs, candidates) });
  }));

  // ── P17: Scenario Intelligence ────────────────────────────────────────────
  app.get('/api/employer/eios/p17/scenarios', requireAuth, wrapE(async (_req: any, res: any) => {
    res.json({
      pillar: 17, name: 'Scenario Intelligence',
      availableScenarios: [
        { id: 'hiring_expansion', label: 'Hiring Expansion',      description: 'Simulate adding headcount' },
        { id: 'layoffs',         label: 'Workforce Reduction',    description: 'Simulate headcount reduction' },
        { id: 'upskilling',      label: 'Upskilling Investment',  description: 'Simulate L&D investment impact' },
        { id: 'automation',      label: 'Automation Impact',      description: 'Simulate automation replacing roles' },
        { id: 'restructuring',   label: 'Restructuring',          description: 'Simulate org restructure' },
        { id: 'leadership_changes', label: 'Leadership Changes',  description: 'Simulate leadership transition impact' },
      ]
    });
  }));

  app.post('/api/employer/eios/p17/simulate', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { scenario = 'hiring_expansion', magnitude = 10 } = req.body;
    const [{ rows: candRows }, { rows: frpRows }] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM employer_candidates WHERE employer_id=$1`, [orgId]),
      // FRP forecasts: enriches simulation with real future-readiness context
      pool.query(`
        SELECT f.fri_score, f.skill_durability_score, f.adaptability_score
        FROM frp_user_readiness f
        WHERE f.user_id::text IN (
          SELECT DISTINCT email FROM employer_candidates WHERE employer_id=$1 AND email IS NOT NULL
        ) LIMIT 200
      `, [orgId]).catch(() => ({ rows: [] })),
    ]);
    const total = Number(candRows[0]?.count) || 0;
    const result = runScenario(String(scenario), Number(magnitude), total);

    // Attach FRP context when available
    let frpContext: any = undefined;
    if (frpRows.length > 0) {
      const avgFRI = Math.round(frpRows.reduce((s: number, f: any) => s + (Number(f.fri_score) || 50), 0) / frpRows.length);
      const avgAdaptability = Math.round(frpRows.reduce((s: number, f: any) => s + (Number(f.adaptability_score) || 50), 0) / frpRows.length);
      frpContext = { avgFRI, avgAdaptability, frpCoverage: Math.round(frpRows.length / Math.max(1, total) * 100) };
    }

    await pool.query(`INSERT INTO eios_scenarios (employer_id, scenario_type, magnitude, result) VALUES ($1,$2,$3,$4)`, [orgId, scenario, magnitude, JSON.stringify({ ...result, frpContext })]).catch(() => {});
    res.json({ pillar: 17, name: 'Scenario Intelligence', simulation: { ...result, frpContext } });
  }));

  console.log('[eios-core] routes registered (EP-EIOS-98X) — Pillars 3, 6–17 (14 routes)');
}
