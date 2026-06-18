/**
 * VX-D25 — Competency Science Council
 * Governance framework: approval workflows for capabilities/competencies/signals/questions.
 * science_council_reviews / science_council_cycles / science_council_members / governance_rules
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
const bc = () => cache.clear();

const ENTITY_TYPES = ['capability', 'competency', 'signal', 'question', 'assessment', 'norm_group', 'benchmark', 'concern', 'irt_item'] as const;
const REVIEW_STATUSES = ['pending', 'in_review', 'approved', 'rejected', 'deferred', 'retired'] as const;
const CYCLE_TYPES = ['quarterly', 'semi_annual', 'annual', 'ad_hoc', 'emergency'] as const;
const MEMBER_ROLES = ['chair', 'psychometrician', 'competency_expert', 'data_scientist', 'workforce_scientist', 'domain_expert', 'observer'] as const;

let ready = false;
async function ensureSchema(pool: Pool) {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS science_council_cycles (
      id SERIAL PRIMARY KEY,
      cycle_code TEXT UNIQUE NOT NULL,
      cycle_name TEXT NOT NULL,
      cycle_type TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      status TEXT CHECK (status IN ('planned','active','completed','cancelled')) DEFAULT 'planned',
      scope JSONB DEFAULT '[]',
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS science_council_members (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      expertise_areas TEXT[] DEFAULT '{}',
      voting_rights BOOLEAN DEFAULT true,
      is_active BOOLEAN DEFAULT true,
      joined_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS science_council_reviews (
      id SERIAL PRIMARY KEY,
      review_code TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      entity_name TEXT,
      review_type TEXT CHECK (review_type IN ('new_approval','amendment','retirement','periodic_review','psychometric_review','emergency_review')) DEFAULT 'new_approval',
      cycle_id INTEGER REFERENCES science_council_cycles(id),
      submitted_by TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      priority TEXT CHECK (priority IN ('low','medium','high','urgent')) DEFAULT 'medium',
      rationale TEXT,
      proposed_changes JSONB DEFAULT '{}',
      review_notes JSONB DEFAULT '[]',
      vote_tally JSONB DEFAULT '{"approve":0,"reject":0,"defer":0}',
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      rejection_reason TEXT,
      effective_date DATE,
      next_review_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS science_council_governance_rules (
      id SERIAL PRIMARY KEY,
      rule_code TEXT UNIQUE NOT NULL,
      rule_name TEXT NOT NULL,
      entity_type TEXT,
      rule_category TEXT CHECK (rule_category IN ('approval_threshold','review_cycle','quality_gate','version_control','sunset_trigger','bias_check')) DEFAULT 'approval_threshold',
      rule_value JSONB NOT NULL,
      is_mandatory BOOLEAN DEFAULT true,
      description TEXT,
      effective_from DATE DEFAULT CURRENT_DATE
    );
    CREATE INDEX IF NOT EXISTS idx_scr_entity ON science_council_reviews(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_scr_status ON science_council_reviews(status);
    CREATE INDEX IF NOT EXISTS idx_scr_cycle ON science_council_reviews(cycle_id);
    CREATE INDEX IF NOT EXISTS idx_scm_active ON science_council_members(is_active);
  `);
  ready = true;
}

const GOVERNANCE_RULES_SEED = [
  { rule_code: 'APPROVAL_QUORUM', rule_name: 'Minimum Approval Quorum', entity_type: null, rule_category: 'approval_threshold', rule_value: { min_voters: 3, min_approve_pct: 67, chair_vote_required: true }, is_mandatory: true, description: 'At least 3 council members must vote, with ≥67% approval' },
  { rule_code: 'CAPABILITY_REVIEW_CYCLE', rule_name: 'Capability Annual Review', entity_type: 'capability', rule_category: 'review_cycle', rule_value: { cycle_type: 'annual', max_age_months: 24 }, is_mandatory: true, description: 'All capabilities reviewed annually, retired if unused for 24 months' },
  { rule_code: 'COMPETENCY_REVIEW_CYCLE', rule_name: 'Competency Semi-Annual Review', entity_type: 'competency', rule_category: 'review_cycle', rule_value: { cycle_type: 'semi_annual', max_age_months: 18 }, is_mandatory: true, description: 'Competencies reviewed semi-annually' },
  { rule_code: 'SIGNAL_QUALITY_GATE', rule_name: 'Signal Psychometric Quality Gate', entity_type: 'signal', rule_category: 'quality_gate', rule_value: { min_reliability: 0.70, min_validity_evidence: 2, requires_pilot: true, min_sample_size: 50 }, is_mandatory: true, description: 'Signals must demonstrate reliability ≥0.70 and at least 2 validity evidence sources' },
  { rule_code: 'QUESTION_QUALITY_GATE', rule_name: 'Question Item Quality Gate', entity_type: 'question', rule_category: 'quality_gate', rule_value: { min_difficulty_range: [0.2, 0.8], max_diff_factor: 0.3, requires_psychometrician_sign_off: true }, is_mandatory: true, description: 'Questions must fall within acceptable difficulty range' },
  { rule_code: 'NORM_REFRESH_TRIGGER', rule_name: 'Norm Group Refresh Trigger', entity_type: 'norm_group', rule_category: 'sunset_trigger', rule_value: { max_age_months: 12, min_n_change_pct: 15, trigger_on_demographic_shift: true }, is_mandatory: true, description: 'Norms refreshed when >15% N change or annually' },
  { rule_code: 'BIAS_CHECK_REQUIRED', rule_name: 'Mandatory Bias Check', entity_type: null, rule_category: 'bias_check', rule_value: { required_analyses: ['differential_item_functioning', 'adverse_impact', 'cultural_sensitivity'], groups: ['gender', 'age', 'region'] }, is_mandatory: true, description: 'All assessments require bias analysis before approval' },
  { rule_code: 'VERSION_CONTROL', rule_name: 'Version Control Policy', entity_type: null, rule_category: 'version_control', rule_value: { breaking_change_requires_new_major: true, backward_compat_window_days: 90, deprecation_notice_days: 60 }, is_mandatory: true, description: 'Breaking changes trigger major version increment with deprecation notice' },
];

const MEMBERS_SEED = [
  { user_email: 'council.chair@metryx.one', full_name: 'Dr. Sarah Chen', role: 'chair', expertise_areas: ['psychometrics', 'competency_frameworks', 'governance'], voting_rights: true },
  { user_email: 'psychometrics@metryx.one', full_name: 'Dr. Raj Patel', role: 'psychometrician', expertise_areas: ['irt', 'test_theory', 'reliability'], voting_rights: true },
  { user_email: 'competency@metryx.one', full_name: 'Emma Williams', role: 'competency_expert', expertise_areas: ['competency_frameworks', 'behavioral_assessment', 'leadership'], voting_rights: true },
  { user_email: 'data.scientist@metryx.one', full_name: 'Arun Sharma', role: 'data_scientist', expertise_areas: ['ml', 'statistics', 'bias_detection'], voting_rights: true },
  { user_email: 'workforce@metryx.one', full_name: 'Dr. Lisa Okafor', role: 'workforce_scientist', expertise_areas: ['io_psychology', 'job_analysis', 'future_of_work'], voting_rights: true },
];

const INITIAL_CYCLE: { cycle_code: string; cycle_name: string; cycle_type: typeof CYCLE_TYPES[number]; status: string; scope: string[]; description: string } = {
  cycle_code: 'Q1-2026', cycle_name: 'Q1 2026 Governance Review', cycle_type: 'quarterly',
  status: 'active', scope: ['capability', 'competency', 'signal'],
  description: 'Quarterly review of capabilities, competencies, and signals for V1 platform launch',
};

export function registerVXCompetencyScienceCouncilRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn) {
  const guard = (req: Request, res: Response, next: () => void) => { if (!flagOn()) return res.status(503).json({ error: `${FLAG} off` }); next(); };
  let seeded = false;
  async function seed() {
    if (seeded) return; await ensureSchema(pool);
    const [gcnt, mcnt, ccnt] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM science_council_governance_rules').catch(() => ({ rows: [{ count: '0' }] })),
      pool.query('SELECT COUNT(*) FROM science_council_members').catch(() => ({ rows: [{ count: '0' }] })),
      pool.query('SELECT COUNT(*) FROM science_council_cycles').catch(() => ({ rows: [{ count: '0' }] })),
    ]);
    if (Number(gcnt.rows[0].count) === 0) for (const r of GOVERNANCE_RULES_SEED) await pool.query('INSERT INTO science_council_governance_rules(rule_code,rule_name,entity_type,rule_category,rule_value,is_mandatory,description) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(rule_code) DO NOTHING', [r.rule_code, r.rule_name, r.entity_type, r.rule_category, JSON.stringify(r.rule_value), r.is_mandatory, r.description]).catch(() => null);
    if (Number(mcnt.rows[0].count) === 0) for (const m of MEMBERS_SEED) await pool.query('INSERT INTO science_council_members(user_email,full_name,role,expertise_areas,voting_rights) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [m.user_email, m.full_name, m.role, m.expertise_areas, m.voting_rights]).catch(() => null);
    if (Number(ccnt.rows[0].count) === 0) await pool.query('INSERT INTO science_council_cycles(cycle_code,cycle_name,cycle_type,status,scope,description) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(cycle_code) DO NOTHING', [INITIAL_CYCLE.cycle_code, INITIAL_CYCLE.cycle_name, INITIAL_CYCLE.cycle_type, INITIAL_CYCLE.status, JSON.stringify(INITIAL_CYCLE.scope), INITIAL_CYCLE.description]).catch(() => null);
    seeded = true;
  }

  app.get('/api/admin/vx/science-council/overview', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    const cached = gc<unknown>('sc_overview'); if (cached) return res.json(cached);
    try {
      const [reviews, members, cycles, rules] = await Promise.all([
        pool.query('SELECT status, COUNT(*) as count FROM science_council_reviews GROUP BY status'),
        pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE is_active) as active FROM science_council_members'),
        pool.query('SELECT status, COUNT(*) as count FROM science_council_cycles GROUP BY status'),
        pool.query('SELECT rule_category, COUNT(*) as count FROM science_council_governance_rules GROUP BY rule_category'),
      ]);
      const payload = { reviews_by_status: reviews.rows, members: members.rows[0], cycles_by_status: cycles.rows, rules_by_category: rules.rows };
      sc('sc_overview', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/science-council/reviews', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { status, entity_type, priority, page = '1', limit = '25' } = req.query as Record<string, string>;
      const p: unknown[] = []; const w: string[] = [];
      if (status) { p.push(status); w.push(`status=$${p.length}`); }
      if (entity_type) { p.push(entity_type); w.push(`entity_type=$${p.length}`); }
      if (priority) { p.push(priority); w.push(`priority=$${p.length}`); }
      const wc = w.length ? `WHERE ${w.join(' AND ')}` : '';
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [rows, cnt] = await Promise.all([
        pool.query(`SELECT * FROM science_council_reviews ${wc} ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'in_review' THEN 2 ELSE 3 END, created_at DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, parseInt(limit), offset]),
        pool.query(`SELECT COUNT(*) FROM science_council_reviews ${wc}`, p),
      ]);
      res.json({ reviews: rows.rows, total: Number(cnt.rows[0].count), page: parseInt(page) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/admin/vx/science-council/reviews', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { entity_type, entity_id, entity_key, entity_name, review_type = 'new_approval', priority = 'medium', rationale, proposed_changes = {}, submitted_by, cycle_id } = req.body;
      if (!entity_type || !entity_id || !entity_key || !submitted_by) return res.status(400).json({ error: 'entity_type, entity_id, entity_key, submitted_by required' });
      const reviewCode = `REV-${entity_type.toUpperCase().slice(0, 3)}-${Date.now()}`;
      const row = await pool.query(
        'INSERT INTO science_council_reviews(review_code,entity_type,entity_id,entity_key,entity_name,review_type,cycle_id,submitted_by,priority,rationale,proposed_changes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
        [reviewCode, entity_type, entity_id, entity_key, entity_name, review_type, cycle_id, submitted_by, priority, rationale, JSON.stringify(proposed_changes)]
      );
      bc(); res.status(201).json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put('/api/admin/vx/science-council/reviews/:id', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    try {
      const { status, review_notes, approved_by, rejection_reason, effective_date, next_review_date, vote_tally } = req.body;
      const row = await pool.query(
        `UPDATE science_council_reviews SET status=COALESCE($1,status), review_notes=COALESCE($2::jsonb,review_notes), approved_by=COALESCE($3,approved_by), approved_at=CASE WHEN $1='approved' THEN NOW() ELSE approved_at END, rejection_reason=COALESCE($4,rejection_reason), effective_date=COALESCE($5,effective_date), next_review_date=COALESCE($6,next_review_date), vote_tally=COALESCE($7::jsonb,vote_tally), updated_at=NOW() WHERE id=$8 RETURNING *`,
        [status, review_notes ? JSON.stringify(review_notes) : null, approved_by, rejection_reason, effective_date, next_review_date, vote_tally ? JSON.stringify(vote_tally) : null, req.params.id]
      );
      bc(); res.json(row.rows[0] || { error: 'Review not found' });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/science-council/cycles', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const rows = await pool.query('SELECT sc.*, COUNT(r.id) as review_count FROM science_council_cycles sc LEFT JOIN science_council_reviews r ON r.cycle_id=sc.id GROUP BY sc.id ORDER BY sc.created_at DESC');
      res.json({ cycles: rows.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/admin/vx/science-council/cycles', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const { cycle_code, cycle_name, cycle_type, start_date, end_date, scope = [], description } = req.body;
      if (!cycle_code || !cycle_name || !cycle_type) return res.status(400).json({ error: 'cycle_code, cycle_name, cycle_type required' });
      const row = await pool.query('INSERT INTO science_council_cycles(cycle_code,cycle_name,cycle_type,start_date,end_date,scope,description) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [cycle_code, cycle_name, cycle_type, start_date, end_date, JSON.stringify(scope), description]);
      bc(); res.status(201).json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/science-council/members', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    try {
      const rows = await pool.query('SELECT * FROM science_council_members WHERE is_active=true ORDER BY role, full_name');
      res.json({ members: rows.rows, total: rows.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/science-council/governance-rules', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seed().catch(() => null);
    const cached = gc<unknown>('sc_rules'); if (cached) return res.json(cached);
    try {
      const rows = await pool.query('SELECT * FROM science_council_governance_rules ORDER BY is_mandatory DESC, rule_category, rule_name');
      const payload = { rules: rows.rows, total: rows.rows.length };
      sc('sc_rules', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log('[vx-competency-science-council] VX-D25 routes registered — governance framework + reviews + cycles + members');
}
