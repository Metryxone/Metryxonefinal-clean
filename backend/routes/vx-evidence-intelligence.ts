/**
 * VX-D16 — Evidence Intelligence Platform
 * Evidence quality scoring, confidence scoring, weighting models.
 * Builds on career-passport storage — adds intelligence layer.
 * Flag-gated FF_CAREER_GRAPH=1. Never-throws. Additive.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 60_000;
const gc = <T>(k: string): T | null => { const e = cache.get(k); return e && Date.now() - e.ts < TTL ? e.data as T : null; };
const sc = (k: string, d: unknown) => cache.set(k, { data: d, ts: Date.now() });

const EVIDENCE_TYPES = ['assessment', 'project', 'achievement', 'certification', 'manager_feedback', 'peer_feedback', 'portfolio', 'work_sample', 'self_report'] as const;

const QUALITY_RULES: Record<string, { dimensions: Record<string, number>; description: string }> = {
  assessment: { dimensions: { verified: 40, recency: 30, relevance: 20, completeness: 10 }, description: 'Psychometrically validated assessment with scoring provenance' },
  certification: { dimensions: { verified: 45, recency: 25, relevance: 25, authority: 5 }, description: 'Third-party verified credential from accredited body' },
  project: { dimensions: { verified: 30, impact: 35, recency: 20, relevance: 15 }, description: 'Documented project with measurable outcomes' },
  achievement: { dimensions: { verified: 35, impact: 30, recency: 20, specificity: 15 }, description: 'Quantified achievement with evidence of contribution' },
  manager_feedback: { dimensions: { verified: 40, recency: 30, specificity: 20, relevance: 10 }, description: 'Direct manager structured feedback with accountability' },
  peer_feedback: { dimensions: { verified: 25, recency: 30, specificity: 25, consensus: 20 }, description: 'Multiple peer inputs with consensus signal' },
  portfolio: { dimensions: { verified: 20, quality: 35, recency: 25, relevance: 20 }, description: 'Curated work portfolio with quality indicators' },
  work_sample: { dimensions: { verified: 30, quality: 40, recency: 20, relevance: 10 }, description: 'Direct work output sample' },
  self_report: { dimensions: { verified: 5, specificity: 40, recency: 30, detail: 25 }, description: 'Self-reported evidence — lowest weight, highest recency bias' },
};

const BASE_WEIGHTS: Record<string, number> = {
  assessment: 1.0, certification: 0.95, project: 0.85, achievement: 0.80,
  manager_feedback: 0.80, peer_feedback: 0.65, portfolio: 0.60, work_sample: 0.70, self_report: 0.25,
};

function computeQualityScore(evidenceType: string, verified: boolean, daysSince: number, hasQuantifiedImpact: boolean): number {
  const rules = QUALITY_RULES[evidenceType] || QUALITY_RULES.self_report;
  const dims = rules.dimensions;
  let score = 0;
  if (dims.verified) score += verified ? dims.verified : 0;
  if (dims.recency) { const recencyScore = Math.max(0, 100 - (daysSince / 365) * 40); score += (recencyScore / 100) * dims.recency; }
  if (dims.impact) score += hasQuantifiedImpact ? dims.impact : dims.impact * 0.4;
  if (dims.specificity) score += 60;
  if (dims.completeness) score += 70;
  if (dims.quality) score += 65;
  if (dims.relevance) score += 70;
  if (dims.detail) score += 55;
  if (dims.authority) score += 80;
  if (dims.consensus) score += 60;
  return Math.min(100, Math.round(score));
}

function computeConfidenceScore(qualityScore: number, evidenceType: string, verified: boolean): number {
  const baseWeight = BASE_WEIGHTS[evidenceType] || 0.3;
  const verificationMultiplier = verified ? 1.0 : 0.6;
  return Math.min(100, Math.round(qualityScore * baseWeight * verificationMultiplier));
}

let ready = false;
async function ensureSchema(pool: Pool) {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evidence_intelligence_master (
      id SERIAL PRIMARY KEY,
      user_ref TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      evidence_title TEXT NOT NULL,
      competency_code TEXT,
      capability_code TEXT,
      signal_keys TEXT[] DEFAULT '{}',
      quality_score NUMERIC(5,2) DEFAULT 0,
      confidence_score NUMERIC(5,2) DEFAULT 0,
      verification_status TEXT CHECK (verification_status IN ('unverified','self_attested','peer_verified','third_party_verified','platform_verified')) DEFAULT 'unverified',
      base_weight NUMERIC(4,3) DEFAULT 0.5,
      evidence_date DATE,
      evidence_metadata JSONB DEFAULT '{}',
      source TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS evidence_quality_rules (
      id SERIAL PRIMARY KEY,
      evidence_type TEXT UNIQUE NOT NULL,
      quality_dimensions JSONB NOT NULL,
      base_weight NUMERIC(4,3) NOT NULL,
      description TEXT,
      verification_multiplier NUMERIC(4,3) DEFAULT 1.0
    );
    CREATE TABLE IF NOT EXISTS evidence_weighting_config (
      id SERIAL PRIMARY KEY,
      evidence_type TEXT UNIQUE NOT NULL,
      base_weight NUMERIC(4,3) NOT NULL,
      recency_decay_days INTEGER DEFAULT 730,
      verification_premium NUMERIC(4,3) DEFAULT 0.2,
      max_contribution_pct NUMERIC(5,2) DEFAULT 30.0
    );
    CREATE INDEX IF NOT EXISTS idx_eim_user ON evidence_intelligence_master(user_ref);
    CREATE INDEX IF NOT EXISTS idx_eim_type ON evidence_intelligence_master(evidence_type);
    CREATE INDEX IF NOT EXISTS idx_eim_competency ON evidence_intelligence_master(competency_code);
  `);
  ready = true;
}

async function seedRules(pool: Pool) {
  const cnt = await pool.query('SELECT COUNT(*) FROM evidence_quality_rules').catch(() => ({ rows: [{ count: '0' }] }));
  if (Number(cnt.rows[0].count) > 0) return;
  for (const [type, rule] of Object.entries(QUALITY_RULES)) {
    await pool.query('INSERT INTO evidence_quality_rules(evidence_type,quality_dimensions,base_weight,description) VALUES($1,$2,$3,$4) ON CONFLICT(evidence_type) DO NOTHING',
      [type, JSON.stringify(rule.dimensions), BASE_WEIGHTS[type] || 0.3, rule.description]).catch(() => null);
    await pool.query('INSERT INTO evidence_weighting_config(evidence_type,base_weight,recency_decay_days,verification_premium,max_contribution_pct) VALUES($1,$2,$3,$4,$5) ON CONFLICT(evidence_type) DO NOTHING',
      [type, BASE_WEIGHTS[type] || 0.3, type === 'assessment' ? 1825 : 730, 0.2, type === 'assessment' ? 40 : 25]).catch(() => null);
  }
}

export function registerVXEvidenceIntelligenceRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn) {
  const guard = (req: Request, res: Response, next: () => void) => { if (!flagOn()) return res.status(503).json({ error: `${FLAG} off` }); next(); };
  let seeded = false;
  async function seed() { if (seeded) return; await ensureSchema(pool); await seedRules(pool); seeded = true; }

  app.get('/api/admin/vx/evidence/overview', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    const cached = gc<unknown>('ev_overview'); if (cached) return res.json(cached);
    try {
      const [total, byType, bySverif, avgScores] = await Promise.all([
        pool.query('SELECT COUNT(*) as total, COUNT(DISTINCT user_ref) as users FROM evidence_intelligence_master WHERE is_active=true'),
        pool.query('SELECT evidence_type, COUNT(*) as count, ROUND(AVG(quality_score),1) as avg_quality FROM evidence_intelligence_master WHERE is_active=true GROUP BY evidence_type ORDER BY count DESC'),
        pool.query('SELECT verification_status, COUNT(*) as count FROM evidence_intelligence_master WHERE is_active=true GROUP BY verification_status'),
        pool.query('SELECT ROUND(AVG(quality_score),1) as avg_quality, ROUND(AVG(confidence_score),1) as avg_confidence FROM evidence_intelligence_master WHERE is_active=true'),
      ]);
      const payload = { total: Number(total.rows[0].total), users: Number(total.rows[0].users), by_type: byType.rows, by_verification: bySverif.rows, avg_scores: avgScores.rows[0] };
      sc('ev_overview', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/evidence/quality-rules', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const [rules, weights] = await Promise.all([
        pool.query('SELECT * FROM evidence_quality_rules ORDER BY base_weight DESC'),
        pool.query('SELECT * FROM evidence_weighting_config ORDER BY base_weight DESC'),
      ]);
      res.json({ quality_rules: rules.rows, weighting_config: weights.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/vx/evidence/profile/:userRef', requireAuth, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const rows = await pool.query('SELECT * FROM evidence_intelligence_master WHERE user_ref=$1 AND is_active=true ORDER BY quality_score DESC, created_at DESC', [req.params.userRef]);
      const byType: Record<string, unknown[]> = {};
      rows.rows.forEach((r: any) => { if (!byType[r.evidence_type]) byType[r.evidence_type] = []; byType[r.evidence_type].push(r); });
      const avgQuality = rows.rows.length ? rows.rows.reduce((s: number, r: any) => s + Number(r.quality_score), 0) / rows.rows.length : 0;
      const avgConfidence = rows.rows.length ? rows.rows.reduce((s: number, r: any) => s + Number(r.confidence_score), 0) / rows.rows.length : 0;
      res.json({ user_ref: req.params.userRef, evidence: rows.rows, by_type: byType, total: rows.rows.length, avg_quality_score: Math.round(avgQuality), avg_confidence_score: Math.round(avgConfidence) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/vx/evidence/assess', requireAuth, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { user_ref, evidence_type, evidence_title, competency_code, verification_status = 'unverified', evidence_date, has_quantified_impact = false, source, evidence_metadata = {} } = req.body;
      if (!user_ref || !evidence_type || !evidence_title) return res.status(400).json({ error: 'user_ref, evidence_type, evidence_title required' });
      const verified = ['third_party_verified', 'platform_verified'].includes(verification_status);
      const daysSince = evidence_date ? Math.floor((Date.now() - new Date(evidence_date).getTime()) / 86400000) : 180;
      const qualityScore = computeQualityScore(evidence_type, verified, daysSince, has_quantified_impact);
      const confidenceScore = computeConfidenceScore(qualityScore, evidence_type, verified);
      const baseWeight = BASE_WEIGHTS[evidence_type] || 0.3;
      const row = await pool.query(
        'INSERT INTO evidence_intelligence_master(user_ref,evidence_type,evidence_title,competency_code,quality_score,confidence_score,verification_status,base_weight,evidence_date,source,evidence_metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
        [user_ref, evidence_type, evidence_title, competency_code, qualityScore, confidenceScore, verification_status, baseWeight, evidence_date, source, JSON.stringify(evidence_metadata)]
      );
      res.status(201).json({ evidence: row.rows[0], scoring: { quality_score: qualityScore, confidence_score: confidenceScore, base_weight: baseWeight, quality_rules: QUALITY_RULES[evidence_type] } });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/evidence/items', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { evidence_type, verification_status, page = '1', limit = '50' } = req.query as Record<string, string>;
      const p: unknown[] = []; const w: string[] = ['is_active=true'];
      if (evidence_type) { p.push(evidence_type); w.push(`evidence_type=$${p.length}`); }
      if (verification_status) { p.push(verification_status); w.push(`verification_status=$${p.length}`); }
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const rows = await pool.query(`SELECT * FROM evidence_intelligence_master WHERE ${w.join(' AND ')} ORDER BY quality_score DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, parseInt(limit), offset]);
      res.json({ evidence: rows.rows, total: rows.rows.length, page: parseInt(page) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log('[vx-evidence-intelligence] VX-D16 routes registered — evidence quality/confidence scoring + weighting models');
}
