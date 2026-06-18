/**
 * /backend/routes/csi.ts
 * CSI (Career Stage Index) — composite behavioral intelligence score
 * derived from a user's full CAPADEX session history.
 *
 * Score = weighted avg of stage scores (CAP_CUR×0.5, CAP_INS×0.75, CAP_GRW×1.0, CAP_MAS×1.25)
 * Stages: Forming(0-29) | Emerging(30-49) | Developing(50-64) | Proficient(65-79) | Advanced(80-100)
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { writeAuditEvent, AUDIT_EVENT } from '../lib/audit';

const STAGE_WEIGHTS: Record<string, number> = {
  CAP_CUR: 0.5,
  CAP_INS: 0.75,
  CAP_GRW: 1.0,
  CAP_MAS: 1.25,
};

const STAGE_ORDER = ['CAP_CUR', 'CAP_INS', 'CAP_GRW', 'CAP_MAS'];

export function csiStageInfo(score: number): { stage: string; color: string } {
  if (score >= 80) return { stage: 'Advanced',    color: '#7C3AED' };
  if (score >= 65) return { stage: 'Proficient',  color: '#2563EB' };
  if (score >= 50) return { stage: 'Developing',  color: '#D97706' };
  if (score >= 30) return { stage: 'Emerging',    color: '#DC2626' };
  return               { stage: 'Forming',     color: '#6B7280' };
}

async function ensureTables(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS csi_profiles (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_email       text NOT NULL,
      user_id          uuid REFERENCES capadex_users(id) ON DELETE SET NULL,
      csi_score        numeric NOT NULL DEFAULT 0,
      csi_stage        text NOT NULL DEFAULT 'Forming',
      csi_stage_color  text NOT NULL DEFAULT '#6B7280',
      positive_factors jsonb DEFAULT '[]',
      negative_factors jsonb DEFAULT '[]',
      domain_scores    jsonb DEFAULT '{}',
      sessions_count   integer DEFAULT 0,
      highest_stage    text,
      primary_concern  text,
      participant_name text,
      score_trace      jsonb,
      calculated_at    timestamptz DEFAULT now(),
      updated_at       timestamptz DEFAULT now(),
      UNIQUE (user_email)
    );
    ALTER TABLE csi_profiles ADD COLUMN IF NOT EXISTS score_trace jsonb;
    CREATE TABLE IF NOT EXISTS csi_trajectory (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_email  text NOT NULL,
      csi_score   numeric NOT NULL,
      csi_stage   text NOT NULL,
      trigger     text DEFAULT 'session_complete',
      session_id  uuid REFERENCES capadex_sessions(id) ON DELETE SET NULL,
      created_at  timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS csi_domain_weights (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      domain_name text NOT NULL UNIQUE,
      weight      numeric NOT NULL DEFAULT 1.0,
      category    text DEFAULT 'behavioral',
      is_active   boolean DEFAULT true,
      updated_at  timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_csi_profiles_email   ON csi_profiles(user_email);
    CREATE INDEX IF NOT EXISTS idx_csi_profiles_stage   ON csi_profiles(csi_stage);
    CREATE INDEX IF NOT EXISTS idx_csi_profiles_score   ON csi_profiles(csi_score DESC);
    CREATE INDEX IF NOT EXISTS idx_csi_traj_email       ON csi_trajectory(user_email);
    CREATE INDEX IF NOT EXISTS idx_csi_traj_created     ON csi_trajectory(created_at DESC);
  `);
}

/**
 * Core CSI calculation.
 * Call after any CAPADEX session completes. Safe to call multiple times — always upserts.
 */
export async function recalculateCSI(
  pool: Pool,
  email: string,
  triggerSessionId?: string
): Promise<number> {
  const emailLower = email.toLowerCase().trim();

  const { rows: sessions } = await pool.query(`
    SELECT id, stage_code, stage_index, score, concern_name, guest_name
    FROM capadex_sessions
    WHERE LOWER(guest_email) = $1 AND status = 'completed'
    ORDER BY stage_index ASC, created_at ASC
  `, [emailLower]);

  if (sessions.length === 0) return 0;

  // Use shared scoring utility — deterministic weighted average
  const { computeCSIScore, buildCSIScoreTrace } = await import('../lib/scoring-utils');
  const { csiScore, trace: csiTrace } = computeCSIScore(sessions);
  const scoreTrace = buildCSIScoreTrace(csiTrace);

  const { stage, color } = csiStageInfo(csiScore);

  // Pull subdomain scores from stored reports
  const sessionIds = sessions.map((s: any) => s.id);
  const { rows: reports } = await pool.query(`
    SELECT subdomains FROM capadex_reports
    WHERE session_id = ANY($1::uuid[]) AND subdomains IS NOT NULL
  `, [sessionIds]);

  const domainScores: Record<string, number> = {};
  for (const rep of reports) {
    const subs: any[] = Array.isArray(rep.subdomains) ? rep.subdomains : [];
    for (const sub of subs) {
      const name  = (sub.subdomain_name || sub.subdomain_code || '').trim();
      const score = parseFloat(sub.avg_score ?? '0');
      if (name && (!domainScores[name] || score > domainScores[name])) {
        domainScores[name] = score;
      }
    }
  }

  // Seed domain_weights table with any new domains discovered
  for (const name of Object.keys(domainScores)) {
    await pool.query(`
      INSERT INTO csi_domain_weights (domain_name) VALUES ($1)
      ON CONFLICT (domain_name) DO NOTHING
    `, [name]);
  }

  // Apply configured weights
  const { rows: wRows } = await pool.query(
    `SELECT domain_name, weight FROM csi_domain_weights WHERE is_active = true`
  );
  const weightMap: Record<string, number> = {};
  for (const w of wRows) weightMap[w.domain_name] = parseFloat(w.weight);

  const positiveFactors = Object.entries(domainScores)
    .filter(([, s]) => s >= 65)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, score]) => ({ factor: `Strong ${name}`, score, domain: name }));

  // Build negative factors and enrich with graph-recommended interventions
  const lowScoringDomains = Object.entries(domainScores)
    .filter(([, s]) => s < 40)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3);

  // Try to get intervention recommendations from the knowledge graph.
  // Use a Record keyed by LBI node key so each domain gets its own recommendation.
  let graphInterventionsByLBIKey: Record<string, { key: string; label: string; weight: number }> = {};
  // Build per-domain name → LBI key map so each factor can be enriched independently.
  // SUBDOMAIN_TO_LBI is the single authoritative mapping exported from lde-intelligence.
  const domainNameToLBIKey: Record<string, string> = {};
  try {
    const { SUBDOMAIN_TO_LBI, getGraphInterventions } = await import('./lde-intelligence');
    for (const [name] of lowScoringDomains) {
      for (const [pattern, lbiKey] of SUBDOMAIN_TO_LBI) {
        if (pattern.test(name)) { domainNameToLBIKey[name] = lbiKey; break; }
      }
    }
    const uniqueLBIKeys = [...new Set(Object.values(domainNameToLBIKey))];
    if (uniqueLBIKeys.length > 0) {
      graphInterventionsByLBIKey = await getGraphInterventions(pool, uniqueLBIKeys);
    }
  } catch {
    // Graph may not be seeded yet — proceed without enrichment
  }

  const negativeFactors = lowScoringDomains.map(([name, domScore]) => {
    const lbiKey = domainNameToLBIKey[name];
    const intervention = lbiKey ? graphInterventionsByLBIKey[lbiKey] : undefined;
    const appliedWeight = weightMap[name] ?? 1.0;
    const why = `Score of ${Math.round(domScore)} in ${name} (weight ×${appliedWeight.toFixed(1)}) — below the 65-point threshold, reducing CSI`;
    return {
      factor: `Developing ${name}`,
      score: domScore,
      domain: name,
      why,
      ...(intervention ? { recommended_intervention: intervention.label, intervention_key: intervention.key } : {}),
    };
  });

  // Highest stage
  let highestStage = '';
  const completedCodes = sessions.map((s: any) => s.stage_code);
  for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
    if (completedCodes.includes(STAGE_ORDER[i])) { highestStage = STAGE_ORDER[i]; break; }
  }

  // Primary concern (most frequent)
  const cc: Record<string, number> = {};
  for (const s of sessions) cc[s.concern_name] = (cc[s.concern_name] || 0) + 1;
  const primaryConcern = Object.entries(cc).sort(([, a], [, b]) => b - a)[0]?.[0] || '';

  const participantName = sessions[0]?.guest_name || '';

  const { rows: [uRow] } = await pool.query(
    `SELECT id FROM capadex_users WHERE LOWER(email) = $1 LIMIT 1`, [emailLower]
  );

  await pool.query(`
    INSERT INTO csi_profiles
      (user_email, user_id, csi_score, csi_stage, csi_stage_color,
       positive_factors, negative_factors, domain_scores, sessions_count,
       highest_stage, primary_concern, participant_name, score_trace, calculated_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
    ON CONFLICT (user_email) DO UPDATE SET
      user_id=$2, csi_score=$3, csi_stage=$4, csi_stage_color=$5,
      positive_factors=$6, negative_factors=$7, domain_scores=$8,
      sessions_count=$9, highest_stage=$10, primary_concern=$11,
      participant_name=$12, score_trace=$13, calculated_at=now(), updated_at=now()
  `, [
    emailLower, uRow?.id ?? null, csiScore, stage, color,
    JSON.stringify(positiveFactors), JSON.stringify(negativeFactors),
    JSON.stringify(domainScores), sessions.length,
    highestStage, primaryConcern, participantName, JSON.stringify(scoreTrace),
  ]);

  await pool.query(`
    INSERT INTO csi_trajectory (user_email, csi_score, csi_stage, trigger, session_id)
    VALUES ($1,$2,$3,'session_complete',$4)
  `, [emailLower, csiScore, stage, triggerSessionId ?? null]);

  // Audit: log score_computed event for CSI — via canonical writer (non-blocking)
  writeAuditEvent(pool, {
    event_type: AUDIT_EVENT.SCORE_COMPUTED,
    actor:      'system',
    session_id: triggerSessionId ?? null,
    payload:    {
      user_email:     emailLower,
      csi_score:      csiScore,
      csi_stage:      stage,
      sessions_count: sessions.length,
      score_trace:    scoreTrace,
    },
  });

  return csiScore;
}

export function registerCSIRoutes(app: Express, pool: Pool) {
  ensureTables(pool).catch(err => console.error('[csi] init error:', err));

  // ── POST /api/csi/recalculate (internal / manual trigger) ────────────────
  app.post('/api/csi/recalculate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, session_id } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });
      const score = await recalculateCSI(pool, email, session_id);
      res.json({ ok: true, csi_score: score });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/csi/profiles ──────────────────────────────────────────
  app.get('/api/admin/csi/profiles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search = '', stage = '', limit = '50', offset = '0' } = req.query as Record<string, string>;
      const params: any[] = [];
      const clauses: string[] = [];
      let p = 1;

      if (search) {
        clauses.push(`(p.user_email ILIKE $${p} OR p.participant_name ILIKE $${p} OR p.primary_concern ILIKE $${p})`);
        params.push(`%${search}%`); p++;
      }
      if (stage) {
        clauses.push(`p.csi_stage = $${p++}`);
        params.push(stage);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

      const { rows: profiles } = await pool.query(`
        SELECT
          p.id, p.user_email, p.participant_name, p.csi_score, p.csi_stage, p.csi_stage_color,
          p.positive_factors, p.negative_factors, p.domain_scores,
          p.sessions_count, p.highest_stage, p.primary_concern,
          p.calculated_at, p.updated_at
        FROM csi_profiles p
        ${where}
        ORDER BY p.csi_score DESC, p.updated_at DESC
        LIMIT $${p} OFFSET $${p + 1}
      `, [...params, parseInt(limit), parseInt(offset)]);

      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM csi_profiles p ${where}`, params
      );

      const { rows: [stats] } = await pool.query(`
        SELECT
          COUNT(*)                                          AS total,
          ROUND(AVG(csi_score)::numeric, 1)                AS avg_score,
          COUNT(*) FILTER (WHERE csi_stage='Advanced')     AS advanced_count,
          COUNT(*) FILTER (WHERE csi_stage='Proficient')   AS proficient_count,
          COUNT(*) FILTER (WHERE csi_stage='Developing')   AS developing_count,
          COUNT(*) FILTER (WHERE csi_stage='Emerging')     AS emerging_count,
          COUNT(*) FILTER (WHERE csi_stage='Forming')      AS forming_count
        FROM csi_profiles
      `);

      res.json({ profiles, total: parseInt(count), stats });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/csi/profiles/:email ──────────────────────────────────
  app.get('/api/admin/csi/profiles/:email', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();

      const { rows: [profile] } = await pool.query(`
        SELECT p.* FROM csi_profiles p WHERE p.user_email = $1
      `, [email]);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });

      const [trajRes, sessRes] = await Promise.all([
        pool.query(`
          SELECT csi_score, csi_stage, trigger, created_at
          FROM csi_trajectory WHERE user_email = $1
          ORDER BY created_at ASC LIMIT 20
        `, [email]),
        pool.query(`
          SELECT id, stage_code, score, concern_name, status, created_at
          FROM capadex_sessions
          WHERE LOWER(guest_email)=$1 AND status='completed'
          ORDER BY created_at DESC LIMIT 10
        `, [email]),
      ]);

      res.json({ profile, trajectory: trajRes.rows, sessions: sessRes.rows });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/csi/analytics ────────────────────────────────────────
  app.get('/api/admin/csi/analytics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [overallRes, topConcernsRes, stageDistRes, trajRes, topRes] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)                                         AS total_profiles,
            ROUND(AVG(csi_score)::numeric,1)                AS avg_csi,
            MAX(csi_score)                                   AS max_csi,
            MIN(csi_score)                                   AS min_csi,
            COUNT(*) FILTER (WHERE csi_stage='Advanced')    AS advanced,
            COUNT(*) FILTER (WHERE csi_stage='Proficient')  AS proficient,
            COUNT(*) FILTER (WHERE csi_stage='Developing')  AS developing,
            COUNT(*) FILTER (WHERE csi_stage='Emerging')    AS emerging,
            COUNT(*) FILTER (WHERE csi_stage='Forming')     AS forming,
            ROUND(AVG(sessions_count)::numeric,1)           AS avg_sessions
          FROM csi_profiles
        `),
        pool.query(`
          SELECT primary_concern, COUNT(*) AS count,
                 ROUND(AVG(csi_score)::numeric,1) AS avg_score
          FROM csi_profiles
          WHERE primary_concern IS NOT NULL AND primary_concern != ''
          GROUP BY primary_concern ORDER BY count DESC LIMIT 8
        `),
        pool.query(`
          SELECT csi_stage, COUNT(*) AS count,
                 ROUND(AVG(csi_score)::numeric,1) AS avg_score
          FROM csi_profiles GROUP BY csi_stage ORDER BY avg_score ASC
        `),
        pool.query(`
          SELECT DATE(created_at) AS date,
                 ROUND(AVG(csi_score)::numeric,1) AS avg_score,
                 COUNT(*) AS recalcs
          FROM csi_trajectory
          WHERE created_at >= now() - interval '30 days'
          GROUP BY DATE(created_at) ORDER BY date ASC
        `),
        pool.query(`
          SELECT user_email, participant_name, csi_score, csi_stage, primary_concern
          FROM csi_profiles ORDER BY csi_score DESC LIMIT 5
        `),
      ]);

      res.json({
        overall:         overallRes.rows[0],
        top_concerns:    topConcernsRes.rows,
        stage_dist:      stageDistRes.rows,
        trajectory:      trajRes.rows,
        top_profiles:    topRes.rows,
      });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/csi/domain-weights ───────────────────────────────────
  app.get('/api/admin/csi/domain-weights', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM csi_domain_weights ORDER BY domain_name ASC`
      );
      res.json({ weights: rows });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/admin/csi/domain-weights/:id ──────────────────────────────
  app.patch('/api/admin/csi/domain-weights/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { weight, is_active } = req.body;
      const sets: string[] = [];
      const vals: any[] = [];
      let p = 1;
      if (weight !== undefined)    { sets.push(`weight=$${p++}`);    vals.push(weight); }
      if (is_active !== undefined) { sets.push(`is_active=$${p++}`); vals.push(is_active); }
      if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
      sets.push('updated_at=now()');
      vals.push(id);
      const { rows: [row] } = await pool.query(
        `UPDATE csi_domain_weights SET ${sets.join(',')} WHERE id=$${p} RETURNING *`, vals
      );
      res.json({ weight: row });
    } catch (err) { next(err); }
  });
}
