import { Express } from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { isEiosWorldClassVerifiedEnabled } from '../config/feature-flags';

const eid = (req: any): string => (req as any).orgId ?? (req.user as any)?.id ?? '';
const wrapE = (fn: Function) => async (req: any, res: any) => {
  try { await fn(req, res); } catch (e: any) {
    console.error('[eios-workforce]', req.path, e.message);
    res.status(500).json({ error: e.message });
  }
};

// ─── Canonical Employer Competency Architecture (6 roles × 3 profiles) ────────
const COMPETENCY_ROLES = [
  {
    role_code: 'CEO', role_name: 'Chief Executive Officer',
    industry: 'Information Technology', function_name: 'Executive Management',
    department: 'Strategy & Leadership', seniority: 'C-Suite',
    behavioral_competencies: ['Visionary Leadership', 'Strategic Influence', 'Executive Presence', 'Change Leadership', 'Decision Making', 'Stakeholder Management'],
    functional_competencies: ['Business Strategy', 'Revenue Growth', 'SaaS Expertise', 'AI Transformation', 'Operational Excellence'],
    cognitive_competencies:  ['Systems Thinking', 'Strategic Reasoning', 'Analytical Thinking', 'Complex Problem Solving', 'Future Thinking'],
    proficiency_targets: { behavioral: 90, functional: 85, cognitive: 88 },
  },
  {
    role_code: 'CXO', role_name: 'Chief Experience / Product Officer',
    industry: 'Information Technology', function_name: 'Executive Management',
    department: 'Product & Experience', seniority: 'C-Suite',
    behavioral_competencies: ['Customer Empathy', 'Executive Leadership', 'Cross-Functional Influence', 'Change Management', 'Decision Making', 'Innovation Leadership'],
    functional_competencies: ['Product Strategy', 'Customer Success', 'Digital Experience', 'Market Intelligence', 'Revenue Enablement'],
    cognitive_competencies:  ['Design Thinking', 'Systems Thinking', 'Analytical Thinking', 'Strategic Reasoning', 'Pattern Recognition'],
    proficiency_targets: { behavioral: 88, functional: 85, cognitive: 85 },
  },
  {
    role_code: 'VP', role_name: 'Vice President',
    industry: 'Information Technology', function_name: 'Business Management',
    department: 'Business Unit Leadership', seniority: 'VP',
    behavioral_competencies: ['Leadership Presence', 'Strategic Thinking', 'Team Development', 'Change Advocacy', 'Stakeholder Alignment', 'Conflict Resolution'],
    functional_competencies: ['Business Development', 'P&L Management', 'Talent Strategy', 'Operational Leadership', 'Strategic Planning'],
    cognitive_competencies:  ['Analytical Reasoning', 'Problem Solving', 'Systems Thinking', 'Risk Assessment', 'Decision Under Ambiguity'],
    proficiency_targets: { behavioral: 82, functional: 80, cognitive: 80 },
  },
  {
    role_code: 'DIRECTOR', role_name: 'Director',
    industry: 'Information Technology', function_name: 'Department Management',
    department: 'Functional Leadership', seniority: 'Director',
    behavioral_competencies: ['Team Leadership', 'Coaching & Mentoring', 'Influence Without Authority', 'Resilience', 'Accountability', 'Collaboration'],
    functional_competencies: ['Department Strategy', 'Budget Management', 'Process Excellence', 'Vendor Management', 'KPI Governance'],
    cognitive_competencies:  ['Critical Thinking', 'Problem Solving', 'Data Interpretation', 'Decision Making', 'Risk Management'],
    proficiency_targets: { behavioral: 78, functional: 76, cognitive: 75 },
  },
  {
    role_code: 'MANAGER', role_name: 'Manager',
    industry: 'Information Technology', function_name: 'Team Management',
    department: 'Team Leadership', seniority: 'Manager',
    behavioral_competencies: ['Team Motivation', 'Feedback Delivery', 'Conflict Management', 'Empathy', 'Delegation', 'Communication'],
    functional_competencies: ['Project Management', 'Performance Management', 'Technical Expertise', 'Stakeholder Management', 'Process Improvement'],
    cognitive_competencies:  ['Analytical Thinking', 'Problem Solving', 'Prioritization', 'Learning Agility', 'Judgment'],
    proficiency_targets: { behavioral: 72, functional: 70, cognitive: 70 },
  },
  {
    role_code: 'CRITICAL_SPECIALIST', role_name: 'Critical Specialist',
    industry: 'Information Technology', function_name: 'Technical Excellence',
    department: 'Specialist Function', seniority: 'Individual Contributor',
    behavioral_competencies: ['Deep Expertise', 'Knowledge Sharing', 'Problem Ownership', 'Continuous Learning', 'Collaboration', 'Adaptability'],
    functional_competencies: ['Domain Mastery', 'Technical Innovation', 'Research & Development', 'Quality Standards', 'Documentation'],
    cognitive_competencies:  ['Deep Domain Reasoning', 'Complex Problem Solving', 'Abstract Thinking', 'Learning Velocity', 'Pattern Synthesis'],
    proficiency_targets: { behavioral: 70, functional: 85, cognitive: 78 },
  },
];

// ─── Schema ───────────────────────────────────────────────────────────────────
async function ensureEIOSWorkforceSchema(pool: Pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eios_employee_profiles (
        id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        employer_id   TEXT NOT NULL,
        email         TEXT NOT NULL,
        full_name     TEXT,
        role_code     TEXT,
        department    TEXT,
        seniority     TEXT,
        status        TEXT DEFAULT 'active',
        imported_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (employer_id, email)
      )
    `);
    // EP-WORLDCLASS-98 Enh: employer-ASSERTED roster attributes (honest labels, never inferred).
    await pool.query(`
      ALTER TABLE eios_employee_profiles
        ADD COLUMN IF NOT EXISTS tenure_years      NUMERIC,
        ADD COLUMN IF NOT EXISTS performance_score INTEGER,
        ADD COLUMN IF NOT EXISTS location          TEXT,
        ADD COLUMN IF NOT EXISTS gender            TEXT,
        ADD COLUMN IF NOT EXISTS age               INTEGER
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eios_competency_roles (
        role_code               TEXT PRIMARY KEY,
        role_name               TEXT NOT NULL,
        industry                TEXT,
        function_name           TEXT,
        department              TEXT,
        seniority               TEXT,
        behavioral_competencies JSONB DEFAULT '[]',
        functional_competencies JSONB DEFAULT '[]',
        cognitive_competencies  JSONB DEFAULT '[]',
        proficiency_targets     JSONB DEFAULT '{}',
        created_at              TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eios_campaign_invites (
        id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        employer_id      TEXT NOT NULL,
        campaign_id      TEXT NOT NULL,
        email            TEXT NOT NULL,
        status           TEXT DEFAULT 'pending',
        sent_at          TIMESTAMPTZ,
        reminder_sent_at TIMESTAMPTZ,
        completed_at     TIMESTAMPTZ,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // EP-WORLDCLASS-98 · Custom role profiles: employer-scoped role definitions built
    // from the imported competency ontology AND/OR custom competencies. Distinct from the
    // GLOBAL eios_competency_roles (whose role_code PK is a multi-tenant collision trap).
    // Additive: absent rows → Competency Map shows only the seeded global roles (legacy).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employer_competency_roles (
        id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        employer_id         TEXT NOT NULL,
        role_code           TEXT NOT NULL,
        role_name           TEXT NOT NULL,
        seniority           TEXT,
        function_name       TEXT,
        department          TEXT,
        competencies        JSONB DEFAULT '[]',
        proficiency_targets JSONB DEFAULT '{}',
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (employer_id, role_code)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ecr_employer ON employer_competency_roles (employer_id)`);
  } catch (e: any) { console.warn('[eios-workforce] schema warning:', e.message); }
}

async function seedCompetencyRoles(pool: Pool) {
  try {
    for (const r of COMPETENCY_ROLES) {
      await pool.query(`
        INSERT INTO eios_competency_roles
          (role_code, role_name, industry, function_name, department, seniority,
           behavioral_competencies, functional_competencies, cognitive_competencies, proficiency_targets)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (role_code) DO NOTHING
      `, [
        r.role_code, r.role_name, r.industry, r.function_name, r.department, r.seniority,
        JSON.stringify(r.behavioral_competencies),
        JSON.stringify(r.functional_competencies),
        JSON.stringify(r.cognitive_competencies),
        JSON.stringify(r.proficiency_targets),
      ]);
    }
  } catch (e: any) { console.warn('[eios-workforce] seed warning:', e.message); }
}

// ─── Per-employee intelligence from shared platform engines ───────────────────
async function resolveEmployeeIntelligence(pool: Pool, email: string) {
  const [wcl0, capadex, frp] = await Promise.all([
    pool.query(`SELECT * FROM wcl0_user_intelligence WHERE user_email=$1 LIMIT 1`, [email])
      .then(r => r.rows[0]).catch(() => null),
    pool.query(`
      SELECT s.id, s.primary_concern, s.guest_email, r.overall_score AS report_score
      FROM capadex_sessions s
      LEFT JOIN capadex_reports r ON r.session_id = s.id
      WHERE s.guest_email=$1
      ORDER BY s.created_at DESC LIMIT 1
    `, [email]).then(r => r.rows[0]).catch(() => null),
    pool.query(`
      SELECT f.* FROM frp_user_readiness f
      WHERE f.user_id::text = (SELECT id::text FROM users WHERE email=$1 LIMIT 1)
      LIMIT 1
    `, [email]).then(r => r.rows[0]).catch(() => null),
  ]);

  const behavioralIndex = wcl0 ? Math.round(
    (Number(wcl0.motivation_score)   || 50) * 0.25 +
    (Number(wcl0.adaptability_score) || 50) * 0.25 +
    (Number(wcl0.engagement_score)   || 50) * 0.25 +
    (100 - (Number(wcl0.risk_score)  || 50)) * 0.25
  ) : null;

  const cognitiveIndex = capadex?.report_score ? Number(capadex.report_score) : null;
  const futureIndex    = frp ? Number(frp.fri_score) || null : null;
  const sources: string[] = [];
  if (wcl0)    sources.push('wcl0_user_intelligence');
  if (capadex) sources.push('capadex_sessions');
  if (frp)     sources.push('frp_user_readiness');
  const nonNull = [behavioralIndex, cognitiveIndex, futureIndex].filter((v): v is number => v !== null);
  return {
    behavioralProfile: wcl0 ? {
      index: behavioralIndex,
      motivation:   Number(wcl0.motivation_score)   || null,
      adaptability: Number(wcl0.adaptability_score) || null,
      engagement:   Number(wcl0.engagement_score)   || null,
      confidence:   Number(wcl0.confidence_score)   || null,
      riskProfile:  Number(wcl0.risk_score)         || null,
      source: 'wcl0_user_intelligence',
    } : { index: null, source: 'no_wcl0_data' },
    cognitiveProfile: capadex ? {
      index: cognitiveIndex,
      sessionId: capadex.id,
      concern: capadex.primary_concern,
      source: 'capadex_sessions',
    } : { index: null, source: 'no_capadex_data' },
    futureReadinessProfile: frp ? {
      index: futureIndex,
      skillDurability:   Number(frp.skill_durability_score)  || null,
      marketAlignment:   Number(frp.market_alignment_score)  || null,
      adaptabilityScore: Number(frp.adaptability_score)      || null,
      learningVelocity:  Number(frp.learning_velocity_score) || null,
      roleResilience:    Number(frp.role_resilience_score)   || null,
      source: 'frp_user_readiness',
    } : { index: null, source: 'no_frp_data' },
    compositeIndex: nonNull.length > 0
      ? Math.round(nonNull.reduce((a, b) => a + b, 0) / nonNull.length) : null,
    dataSources: sources,
    coverage: Math.round(sources.length / 3 * 100),
  };
}

// ─── Custom role profile validation + mapping (employer-scoped) ───────────────
// Honesty: attached competencies are role REQUIREMENTS (descriptive). The platform
// measures only the 3 aggregate dimensions (behavioral, cognitive) per employee —
// it does NOT measure per-competency proficiency, so we never fabricate that.
const CUSTOM_DIMENSIONS = ['behavioral', 'functional', 'cognitive'] as const;
const CUSTOM_SOURCES = ['ontology', 'custom'] as const;

const clampScore = (v: any): number | null => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
};
const trimStr = (v: any, max: number): string => String(v ?? '').trim().slice(0, max);

function sanitizeCustomRole(body: any) {
  const b = body && typeof body === 'object' ? body : {};
  const role_name     = trimStr(b.role_name, 200);
  const seniority     = trimStr(b.seniority, 120) || null;
  const function_name = trimStr(b.function_name, 200) || null;
  const department    = trimStr(b.department, 200) || null;

  const rawComps = Array.isArray(b.competencies) ? b.competencies.slice(0, 100) : [];
  const competencies = rawComps.map((c: any) => {
    const name = trimStr(c?.name, 200);
    if (!name) return null;
    const dimension = (CUSTOM_DIMENSIONS as readonly string[]).includes(c?.dimension) ? c.dimension : 'behavioral';
    const source    = (CUSTOM_SOURCES as readonly string[]).includes(c?.source) ? c.source : 'custom';
    const competency_id = c?.competency_id != null ? (trimStr(c.competency_id, 120) || null) : null;
    const domain = c?.domain != null ? (trimStr(c.domain, 200) || null) : null;
    const family = c?.family != null ? (trimStr(c.family, 200) || null) : null;
    return { name, dimension, source, competency_id, domain, family };
  }).filter(Boolean);

  const pt = b.proficiency_targets && typeof b.proficiency_targets === 'object' ? b.proficiency_targets : {};
  const proficiency_targets: Record<string, number> = {};
  for (const d of CUSTOM_DIMENSIONS) {
    const s = clampScore((pt as any)[d]);
    if (s != null) proficiency_targets[d] = s;
  }
  return { role_name, seniority, function_name, department, competencies, proficiency_targets };
}

function mapCustomRoleRow(row: any) {
  const comps = Array.isArray(row.competencies) ? row.competencies
    : (() => { try { return JSON.parse(row.competencies || '[]'); } catch { return []; } })();
  const pt = (row.proficiency_targets && typeof row.proficiency_targets === 'object') ? row.proficiency_targets
    : (() => { try { return JSON.parse(row.proficiency_targets || '{}'); } catch { return {}; } })();
  const byDim = (d: string) => comps.filter((c: any) => c?.dimension === d).map((c: any) => c?.name).filter(Boolean);
  return {
    id: row.id,
    role_code: row.role_code,
    role_name: row.role_name,
    industry: null,
    function_name: row.function_name || null,
    department: row.department || null,
    seniority: row.seniority || null,
    behavioral_competencies: byDim('behavioral'),
    functional_competencies: byDim('functional'),
    cognitive_competencies: byDim('cognitive'),
    competencies: comps,
    proficiency_targets: pt,
    custom: true,
    updated_at: row.updated_at,
  };
}

// ─── Main Registration ────────────────────────────────────────────────────────
export function registerEIOSWorkforceRoutes(app: Express, pool: Pool, requireAuth: Function) {
  setImmediate(() => ensureEIOSWorkforceSchema(pool).then(() => seedCompetencyRoles(pool)));

  // ── P29: Competency Architecture ──────────────────────────────────────────
  app.get('/api/employer/eios/competency-architecture', requireAuth, wrapE(async (req: any, res: any) => {
    const { rows } = await pool.query(`SELECT * FROM eios_competency_roles ORDER BY
      CASE seniority WHEN 'C-Suite' THEN 1 WHEN 'VP' THEN 2 WHEN 'Director' THEN 3 WHEN 'Manager' THEN 4 ELSE 5 END`)
      .catch(() => ({ rows: [] as any[] }));
    const seeded = rows.length > 0 ? rows : COMPETENCY_ROLES;
    // Additive: append this employer's custom role profiles (flag-gated). Flag OFF or no
    // custom rows → byte-identical to legacy (seeded roles only, no customCount field).
    let custom: any[] = [];
    if (isEiosWorldClassVerifiedEnabled()) {
      const c = await pool.query(
        `SELECT * FROM employer_competency_roles WHERE employer_id = $1 ORDER BY created_at DESC`,
        [eid(req)],
      ).catch(() => ({ rows: [] as any[] }));
      custom = c.rows.map(mapCustomRoleRow);
    }
    const roles = [...seeded, ...custom];
    const resp: any = {
      name: 'Employer Competency Architecture', pillar: 29,
      industry: 'Information Technology',
      roles,
      totalRoles: roles.length,
      hierarchyLevels: ['Industry', 'Function', 'Department', 'Role', 'Behavioral', 'Functional', 'Cognitive'],
      seeded: rows.length > 0,
    };
    if (isEiosWorldClassVerifiedEnabled()) resp.customCount = custom.length;
    res.json(resp);
  }));

  // ── Custom role profiles (employer-scoped CRUD) ───────────────────────────
  // Flag-gated like the rest of the Competency Map (FF_EIOS_WORLD_CLASS_VERIFIED_V2):
  // OFF → 503 + UI hides. Every query scoped by eid(req) (IDOR guard). Literal
  // collection routes registered BEFORE the /:id param routes. Never throws (wrapE).
  const customRolesDisabled = (res: any) =>
    res.status(503).json({ error: 'Custom role profiles not enabled', flag: 'FF_EIOS_WORLD_CLASS_VERIFIED_V2' });

  app.get('/api/employer/eios/custom-roles', requireAuth, wrapE(async (req: any, res: any) => {
    if (!isEiosWorldClassVerifiedEnabled()) return customRolesDisabled(res);
    const orgId = eid(req);
    const { rows } = await pool.query(
      `SELECT * FROM employer_competency_roles WHERE employer_id = $1 ORDER BY created_at DESC`,
      [orgId],
    ).catch(() => ({ rows: [] as any[] }));
    res.json({ roles: rows.map(mapCustomRoleRow), total: rows.length });
  }));

  app.post('/api/employer/eios/custom-roles', requireAuth, wrapE(async (req: any, res: any) => {
    if (!isEiosWorldClassVerifiedEnabled()) return customRolesDisabled(res);
    const orgId = eid(req);
    if (!orgId) return res.status(401).json({ error: 'unauthenticated' });
    const v = sanitizeCustomRole(req.body);
    if (!v.role_name) return res.status(400).json({ error: 'role_name_required' });
    const roleCode = `CUSTOM_${randomUUID()}`;
    const { rows } = await pool.query(
      `INSERT INTO employer_competency_roles
         (employer_id, role_code, role_name, seniority, function_name, department, competencies, proficiency_targets)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, roleCode, v.role_name, v.seniority, v.function_name, v.department,
       JSON.stringify(v.competencies), JSON.stringify(v.proficiency_targets)],
    );
    res.json({ role: mapCustomRoleRow(rows[0]) });
  }));

  app.put('/api/employer/eios/custom-roles/:id', requireAuth, wrapE(async (req: any, res: any) => {
    if (!isEiosWorldClassVerifiedEnabled()) return customRolesDisabled(res);
    const orgId = eid(req);
    const v = sanitizeCustomRole(req.body);
    if (!v.role_name) return res.status(400).json({ error: 'role_name_required' });
    const { rows } = await pool.query(
      `UPDATE employer_competency_roles
         SET role_name=$3, seniority=$4, function_name=$5, department=$6,
             competencies=$7, proficiency_targets=$8, updated_at=NOW()
       WHERE employer_id=$1 AND id=$2 RETURNING *`,
      [orgId, String(req.params.id), v.role_name, v.seniority, v.function_name, v.department,
       JSON.stringify(v.competencies), JSON.stringify(v.proficiency_targets)],
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json({ role: mapCustomRoleRow(rows[0]) });
  }));

  app.delete('/api/employer/eios/custom-roles/:id', requireAuth, wrapE(async (req: any, res: any) => {
    if (!isEiosWorldClassVerifiedEnabled()) return customRolesDisabled(res);
    const orgId = eid(req);
    const { rowCount } = await pool.query(
      `DELETE FROM employer_competency_roles WHERE employer_id=$1 AND id=$2`,
      [orgId, String(req.params.id)],
    );
    res.json({ deleted: (rowCount ?? 0) > 0 });
  }));

  // ── Employee Management ─────────────────────────────────────────────────
  // IMPORTANT: literal /import MUST be registered BEFORE /:id param route
  app.get('/api/employer/eios/employees', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { rows } = await pool.query(`
      SELECT e.*, r.role_name, r.function_name
      FROM eios_employee_profiles e
      LEFT JOIN eios_competency_roles r ON r.role_code = e.role_code
      WHERE e.employer_id = $1
      ORDER BY e.imported_at DESC LIMIT 200
    `, [orgId]).catch(() => ({ rows: [] as any[] }));
    const byDept: Record<string, number> = {};
    for (const r of rows) { const d = r.department || 'General'; byDept[d] = (byDept[d] || 0) + 1; }
    const response: any = {
      name: 'Employee Profiles', pillar: 29,
      employees: rows,
      total: rows.length,
      byDepartment: byDept,
      byStatus: { active: rows.filter((r: any) => r.status === 'active').length, inactive: rows.filter((r: any) => r.status === 'inactive').length },
    };
    // EP-WORLDCLASS-98 Enh2/Enh4: gate CSV upload + drill-down surfaces (flag ON only).
    if (isEiosWorldClassVerifiedEnabled()) response.worldClass = true;
    res.json(response);
  }));

  // ── Workforce Analytics (real platform intelligence aggregation) ──────────
  // Gated by FF_EIOS_WORLD_CLASS_VERIFIED_V2 → flag-OFF returns 503 so the UI shows
  // an honest "advanced analytics disabled" state (never fabricated charts).
  // Defensive per-source queries (each .catch→[]) — never a mega-join, never throws.
  app.get('/api/employer/eios/workforce-analytics', requireAuth, wrapE(async (req: any, res: any) => {
    if (!isEiosWorldClassVerifiedEnabled()) {
      return res.status(503).json({ error: 'Advanced workforce analytics not enabled', flag: 'FF_EIOS_WORLD_CLASS_VERIFIED_V2' });
    }
    const orgId = eid(req);
    const norm  = (s: any) => String(s || '').trim().toLowerCase();
    const num   = (v: any): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

    const { rows: base } = await pool.query(`
      SELECT e.id, e.email, e.full_name, e.role_code, e.department, e.seniority, e.status,
             e.tenure_years, e.performance_score, e.location, e.gender,
             r.role_name, r.function_name, r.proficiency_targets
      FROM eios_employee_profiles e
      LEFT JOIN eios_competency_roles r ON r.role_code = e.role_code
      WHERE e.employer_id = $1
      ORDER BY e.imported_at DESC LIMIT 500
    `, [orgId]).catch(() => ({ rows: [] as any[] }));

    const emails = Array.from(new Set(base.map((b: any) => norm(b.email)).filter(Boolean)));
    const wMap = new Map<string, any>(), cMap = new Map<string, any>(), fMap = new Map<string, any>();
    if (emails.length > 0) {
      const [w, c, f] = await Promise.all([
        pool.query(`
          SELECT lower(trim(user_email)) AS en, motivation_score, adaptability_score,
                 engagement_score, confidence_score, risk_score
          FROM wcl0_user_intelligence WHERE lower(trim(user_email)) = ANY($1)
        `, [emails]).catch(() => ({ rows: [] as any[] })),
        pool.query(`
          SELECT DISTINCT ON (lower(trim(s.guest_email))) lower(trim(s.guest_email)) AS en,
                 rep.overall_score AS report_score, s.primary_concern
          FROM capadex_sessions s
          LEFT JOIN capadex_reports rep ON rep.session_id = s.id
          WHERE lower(trim(s.guest_email)) = ANY($1)
          ORDER BY lower(trim(s.guest_email)), s.created_at DESC
        `, [emails]).catch(() => ({ rows: [] as any[] })),
        pool.query(`
          SELECT lower(trim(u.email)) AS en, fr.fri_score
          FROM frp_user_readiness fr
          JOIN users u ON u.id::text = fr.user_id::text
          WHERE lower(trim(u.email)) = ANY($1)
        `, [emails]).catch(() => ({ rows: [] as any[] })),
      ]);
      for (const r of w.rows) if (!wMap.has(r.en)) wMap.set(r.en, r);
      for (const r of c.rows) if (!cMap.has(r.en)) cMap.set(r.en, r);
      for (const r of f.rows) if (!fMap.has(r.en)) fMap.set(r.en, r);
    }

    const employees = base.map((b: any) => {
      const en = norm(b.email);
      const w = wMap.get(en), c = cMap.get(en), f = fMap.get(en);
      const behavioralIndex = w ? Math.round(
        ((num(w.motivation_score)   ?? 50) * 0.25) +
        ((num(w.adaptability_score) ?? 50) * 0.25) +
        ((num(w.engagement_score)   ?? 50) * 0.25) +
        ((100 - (num(w.risk_score)  ?? 50)) * 0.25)
      ) : null;
      const cognitiveIndex = c && c.report_score != null ? num(c.report_score) : null;
      const futureIndex    = f && f.fri_score   != null ? num(f.fri_score)   : null;
      const parts = [behavioralIndex, cognitiveIndex, futureIndex].filter((v): v is number => v != null);
      const compositeIndex = parts.length ? Math.round(parts.reduce((a, b2) => a + b2, 0) / parts.length) : null;
      const riskScore = w ? num(w.risk_score) : null;
      const coverage  = (behavioralIndex != null ? 1 : 0) + (cognitiveIndex != null ? 1 : 0) + (futureIndex != null ? 1 : 0);
      const retentionRisk = riskScore == null ? 'Unknown' : riskScore >= 60 ? 'High' : riskScore >= 40 ? 'Medium' : 'Low';
      return {
        id: b.id, email: b.email, fullName: b.full_name, roleCode: b.role_code, roleName: b.role_name,
        department: b.department || 'General', seniority: b.seniority || null,
        tenureYears: num(b.tenure_years), performanceScore: num(b.performance_score),
        location: b.location || null, gender: b.gender || null,
        behavioralIndex, cognitiveIndex, futureIndex, compositeIndex, riskScore, retentionRisk,
        concern: c ? c.primary_concern : null,
        coverage, hasAssessment: coverage > 0,
      };
    });

    const total = employees.length;
    const assessed = employees.filter(e => e.hasAssessment);
    const mean  = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const mean1 = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
    const present = (key: string) => employees.map((e: any) => e[key]).filter((v: any) => v != null) as number[];

    const compositeVals  = present('compositeIndex');
    const behavioralVals = present('behavioralIndex');
    const perfVals       = present('performanceScore');
    const tenureVals     = present('tenureYears');

    const riskDistribution = { low: 0, medium: 0, high: 0, unknown: 0 };
    for (const e of employees) {
      if (e.retentionRisk === 'High') riskDistribution.high++;
      else if (e.retentionRisk === 'Medium') riskDistribution.medium++;
      else if (e.retentionRisk === 'Low') riskDistribution.low++;
      else riskDistribution.unknown++;
    }

    const deptMap: Record<string, any> = {};
    for (const e of employees) {
      const d = e.department || 'General';
      if (!deptMap[d]) deptMap[d] = { name: d, count: 0, composites: [], performances: [], highRisk: 0, assessed: 0 };
      const g = deptMap[d];
      g.count++;
      if (e.compositeIndex != null) g.composites.push(e.compositeIndex);
      if (e.performanceScore != null) g.performances.push(e.performanceScore);
      if (e.retentionRisk === 'High') g.highRisk++;
      if (e.hasAssessment) g.assessed++;
    }
    const byDepartment = Object.values(deptMap).map((g: any) => ({
      name: g.name, count: g.count,
      avgComposite: g.composites.length ? mean(g.composites) : null, assessedCount: g.composites.length,
      avgPerformance: g.performances.length ? mean(g.performances) : null, performanceCount: g.performances.length,
      highRisk: g.highRisk, assessed: g.assessed,
    })).sort((a, b) => b.count - a.count);

    const distOf = (key: string) => {
      const m: Record<string, number> = {};
      for (const e of employees as any[]) { const v = e[key]; if (v != null && v !== '') m[v] = (m[v] || 0) + 1; }
      return Object.entries(m).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };
    const genderDist   = distOf('gender');
    const locationDist = distOf('location');
    const tenureBands  = tenureVals.length ? [
      { label: '<1 yr',  count: tenureVals.filter(t => t < 1).length },
      { label: '1-2 yr', count: tenureVals.filter(t => t >= 1 && t < 2).length },
      { label: '2-4 yr', count: tenureVals.filter(t => t >= 2 && t < 4).length },
      { label: '4+ yr',  count: tenureVals.filter(t => t >= 4).length },
    ] : [];

    const topPerformers = assessed
      .filter(e => e.compositeIndex != null)
      .sort((a, b) => (b.compositeIndex! - a.compositeIndex!) || ((b.tenureYears ?? 0) - (a.tenureYears ?? 0)))
      .slice(0, 8)
      .map(e => ({
        id: e.id, name: e.fullName || e.email, department: e.department,
        role: e.roleName || e.roleCode || null, compositeIndex: e.compositeIndex,
        behavioralIndex: e.behavioralIndex, cognitiveIndex: e.cognitiveIndex, futureIndex: e.futureIndex,
        tenureYears: e.tenureYears, performanceScore: e.performanceScore,
      }));

    res.json({
      name: 'Workforce Analytics', pillar: 29, worldClass: true,
      total, withAssessment: assessed.length,
      coveragePct: total ? Math.round(assessed.length / total * 100) : 0,
      averages: {
        composite:   { value: compositeVals.length  ? mean(compositeVals)   : null, n: compositeVals.length },
        behavioral:  { value: behavioralVals.length ? mean(behavioralVals)  : null, n: behavioralVals.length },
        performance: { value: perfVals.length       ? mean(perfVals)        : null, n: perfVals.length },
        tenure:      { value: tenureVals.length     ? mean1(tenureVals)     : null, n: tenureVals.length },
      },
      riskDistribution,
      byDepartment,
      genderDist, locationDist, tenureBands,
      rosterFields: {
        tenure:      tenureVals.length,
        performance: perfVals.length,
        location:    locationDist.reduce((s, x) => s + x.count, 0),
        gender:      genderDist.reduce((s, x) => s + x.count, 0),
      },
      topPerformers,
      employees,
    });
  }));

  // Literal /employees/import before /:id
  app.post('/api/employer/eios/employees/import', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const body = req.body;
    const employees: any[] = Array.isArray(body) ? body : (body.employees || []);
    if (!Array.isArray(employees) || employees.length === 0)
      return res.status(400).json({ error: 'Provide employees array: [{email, full_name?, role_code?, department?, seniority?}]' });
    if (employees.length > 500)
      return res.status(400).json({ error: 'Max 500 per batch' });
    const clampInt = (v: any, lo: number, hi: number): number | null => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
    };
    let imported = 0, skipped = 0;
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const emp of employees) {
      const email = String(emp.email || '').trim().toLowerCase();
      if (!email) { errors.push('Row missing email'); skipped++; continue; }
      if (seen.has(email)) { skipped++; continue; }
      seen.add(email);
      const tenureN = Number(emp.tenure_years);
      const tenure  = Number.isFinite(tenureN) && tenureN >= 0 ? Math.round(tenureN * 10) / 10 : null;
      const perf    = clampInt(emp.performance_score, 0, 100);
      const age     = clampInt(emp.age, 14, 100);
      const location = emp.location ? (String(emp.location).trim().slice(0, 120) || null) : null;
      const gender   = emp.gender ? (String(emp.gender).trim().slice(0, 40) || null) : null;
      try {
        await pool.query(`
          INSERT INTO eios_employee_profiles (employer_id, email, full_name, role_code, department, seniority, status, tenure_years, performance_score, location, gender, age)
          VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11)
          ON CONFLICT (employer_id, email) DO UPDATE
            SET full_name         = COALESCE(EXCLUDED.full_name,         eios_employee_profiles.full_name),
                role_code         = COALESCE(EXCLUDED.role_code,         eios_employee_profiles.role_code),
                department        = COALESCE(EXCLUDED.department,        eios_employee_profiles.department),
                seniority         = COALESCE(EXCLUDED.seniority,         eios_employee_profiles.seniority),
                tenure_years      = COALESCE(EXCLUDED.tenure_years,      eios_employee_profiles.tenure_years),
                performance_score = COALESCE(EXCLUDED.performance_score, eios_employee_profiles.performance_score),
                location          = COALESCE(EXCLUDED.location,          eios_employee_profiles.location),
                gender            = COALESCE(EXCLUDED.gender,            eios_employee_profiles.gender),
                age               = COALESCE(EXCLUDED.age,               eios_employee_profiles.age),
                updated_at        = NOW()
        `, [orgId, email, emp.full_name || null, emp.role_code || null, emp.department || null, emp.seniority || null, tenure, perf, location, gender, age]);
        imported++;
      } catch (e: any) { errors.push(`${email}: ${e.message}`); skipped++; }
    }
    res.json({ success: true, imported, skipped, total: employees.length, errors: errors.slice(0, 10) });
  }));

  app.post('/api/employer/eios/employees', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { email, full_name, role_code, department, seniority } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const { rows } = await pool.query(`
      INSERT INTO eios_employee_profiles (employer_id, email, full_name, role_code, department, seniority, status)
      VALUES ($1,$2,$3,$4,$5,$6,'active')
      ON CONFLICT (employer_id, email) DO UPDATE
        SET full_name = EXCLUDED.full_name, role_code = EXCLUDED.role_code,
            department = EXCLUDED.department, seniority = EXCLUDED.seniority, updated_at = NOW()
      RETURNING *
    `, [orgId, email, full_name || null, role_code || null, department || null, seniority || null]);
    res.json({ success: true, employee: rows[0] });
  }));

  app.patch('/api/employer/eios/employees/:id', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { status, role_code, department, seniority, full_name } = req.body;
    const { rows } = await pool.query(`
      UPDATE eios_employee_profiles
      SET status     = COALESCE($3, status),
          role_code  = COALESCE($4, role_code),
          department = COALESCE($5, department),
          seniority  = COALESCE($6, seniority),
          full_name  = COALESCE($7, full_name),
          updated_at = NOW()
      WHERE id = $1 AND employer_id = $2
      RETURNING *
    `, [req.params.id, orgId, status || null, role_code || null, department || null, seniority || null, full_name || null]);
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found' });
    res.json({ success: true, employee: rows[0] });
  }));

  app.get('/api/employer/eios/employees/:id/intelligence', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId = eid(req);
    const { rows: emp } = await pool.query(`
      SELECT e.*, r.role_name, r.behavioral_competencies, r.functional_competencies,
             r.cognitive_competencies, r.proficiency_targets
      FROM eios_employee_profiles e
      LEFT JOIN eios_competency_roles r ON r.role_code = e.role_code
      WHERE e.id = $1 AND e.employer_id = $2
    `, [req.params.id, orgId]).catch(() => ({ rows: [] as any[] }));
    if (!emp[0]) return res.status(404).json({ error: 'Employee not found' });
    const e = emp[0];
    const intel = await resolveEmployeeIntelligence(pool, e.email);
    const targets = (e.proficiency_targets as any) || {};
    const bGap = (targets.behavioral != null && intel.behavioralProfile.index != null) ? Math.max(0, targets.behavioral - intel.behavioralProfile.index) : null;
    const cGap = (targets.cognitive  != null && intel.cognitiveProfile.index  != null) ? Math.max(0, targets.cognitive  - intel.cognitiveProfile.index)  : null;
    const gapVals = [bGap, cGap].filter((v): v is number => v !== null);
    res.json({
      employeeId: e.id, email: e.email, fullName: e.full_name, department: e.department, seniority: e.seniority,
      roleProfile: { roleCode: e.role_code, roleName: e.role_name, behavioralCompetencies: e.behavioral_competencies || [], functionalCompetencies: e.functional_competencies || [], cognitiveCompetencies: e.cognitive_competencies || [], proficiencyTargets: targets },
      intelligence: intel,
      gapAnalysis: { behavioral: bGap, cognitive: cGap, overallGap: gapVals.length ? Math.round(gapVals.reduce((a, b) => a + b, 0) / gapVals.length) : null },
      confidenceNote: intel.dataSources.length === 0
        ? 'No platform data. Assign assessments to activate intelligence.'
        : `${intel.dataSources.length}/3 sources: ${intel.dataSources.join(', ')}`,
    });
  }));

  // ── Campaign Activation Engine ─────────────────────────────────────────────
  app.get('/api/employer/eios/campaigns/:id/completion', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId     = eid(req);
    const campaignId = req.params.id;
    const [{ rows: campaign }, { rows: invites }] = await Promise.all([
      pool.query(`SELECT * FROM eios_campaigns WHERE id=$1 AND employer_id=$2`, [campaignId, orgId]).catch(() => ({ rows: [] as any[] })),
      pool.query(`SELECT * FROM eios_campaign_invites WHERE campaign_id=$1 AND employer_id=$2 ORDER BY created_at DESC`, [campaignId, orgId]).catch(() => ({ rows: [] as any[] })),
    ]);
    if (!campaign[0]) return res.status(404).json({ error: 'Campaign not found' });
    const total     = invites.length;
    const completed = invites.filter((i: any) => i.status === 'completed').length;
    const pending   = invites.filter((i: any) => ['pending', 'invited'].includes(i.status)).length;
    const sent      = invites.filter((i: any) => i.sent_at !== null).length;
    const rate      = total > 0 ? Math.round(completed / total * 100) : 0;
    const byDept: Record<string, { total: number; completed: number }> = {};
    for (const inv of invites) {
      const d = (inv as any).department || 'General';
      if (!byDept[d]) byDept[d] = { total: 0, completed: 0 };
      byDept[d].total++;
      if ((inv as any).status === 'completed') byDept[d].completed++;
    }
    res.json({
      campaign: campaign[0],
      completionStats: { total, completed, pending, sent, completionRate: rate },
      health: rate >= 80 ? 'healthy' : rate >= 50 ? 'moderate' : 'low',
      byDepartment: Object.entries(byDept).map(([dept, s]) => ({
        department: dept, total: s.total, completed: s.completed,
        completionRate: s.total > 0 ? Math.round(s.completed / s.total * 100) : 0,
      })),
      invites: invites.slice(0, 50),
    });
  }));

  app.post('/api/employer/eios/campaigns/:id/assign', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId     = eid(req);
    const campaignId = req.params.id;
    const { emails, department } = req.body;
    const { rows: camp } = await pool.query(`SELECT * FROM eios_campaigns WHERE id=$1 AND employer_id=$2`, [campaignId, orgId]).catch(() => ({ rows: [] as any[] }));
    if (!camp[0]) return res.status(404).json({ error: 'Campaign not found' });
    let targetEmails: string[] = [];
    if (Array.isArray(emails) && emails.length > 0) {
      targetEmails = emails;
    } else {
      const q = department
        ? `SELECT email FROM eios_employee_profiles WHERE employer_id=$1 AND status='active' AND department=$2 LIMIT 200`
        : `SELECT email FROM eios_employee_profiles WHERE employer_id=$1 AND status='active' LIMIT 200`;
      const { rows } = await pool.query(q, department ? [orgId, department] : [orgId]).catch(() => ({ rows: [] as any[] }));
      targetEmails = rows.map((r: any) => r.email).filter(Boolean);
    }
    if (targetEmails.length === 0)
      return res.status(400).json({ error: 'No employees to assign. Import employees first.' });
    let assigned = 0;
    for (const email of targetEmails) {
      try {
        await pool.query(`INSERT INTO eios_campaign_invites (employer_id, campaign_id, email, status) VALUES ($1,$2,$3,'pending') ON CONFLICT DO NOTHING`, [orgId, campaignId, email]);
        assigned++;
      } catch {}
    }
    await pool.query(`UPDATE eios_campaigns SET target_count=$1 WHERE id=$2`, [assigned, campaignId]).catch(() => {});
    res.json({ success: true, assigned, total: targetEmails.length, campaignId });
  }));

  app.post('/api/employer/eios/campaigns/:id/invite', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId     = eid(req);
    const campaignId = req.params.id;
    const { rows: camp } = await pool.query(`SELECT * FROM eios_campaigns WHERE id=$1 AND employer_id=$2`, [campaignId, orgId]).catch(() => ({ rows: [] as any[] }));
    if (!camp[0]) return res.status(404).json({ error: 'Campaign not found' });
    const { rows: pending } = await pool.query(`
      SELECT i.*, e.full_name FROM eios_campaign_invites i
      LEFT JOIN eios_employee_profiles e ON e.email = i.email AND e.employer_id = i.employer_id
      WHERE i.campaign_id=$1 AND i.employer_id=$2 AND i.status='pending' LIMIT 200
    `, [campaignId, orgId]).catch(() => ({ rows: [] as any[] }));
    if (pending.length === 0)
      return res.json({ success: true, sent: 0, message: 'No pending invites. Assign employees first.' });
    let sent = 0;
    for (const inv of pending) {
      try {
        await pool.query(`UPDATE eios_campaign_invites SET status='invited', sent_at=NOW() WHERE id=$1`, [inv.id]);
        sent++;
        setImmediate(async () => {
          try {
            const { sendEmail } = await import('../email');
            await sendEmail({ to: inv.email, subject: `You've been invited: ${camp[0].name}`,
              html: `<p>Hi ${inv.full_name || inv.email},</p><p>You've been invited to complete <strong>${camp[0].name}</strong>. Log in to MetryxOne to get started.</p>` });
          } catch {}
        });
      } catch {}
    }
    await pool.query(`UPDATE eios_campaigns SET sent_count=$1 WHERE id=$2`, [sent, campaignId]).catch(() => {});
    res.json({ success: true, sent, campaignId, campaignName: camp[0].name });
  }));

  app.post('/api/employer/eios/campaigns/:id/remind', requireAuth, wrapE(async (req: any, res: any) => {
    const orgId     = eid(req);
    const campaignId = req.params.id;
    const { rows: camp } = await pool.query(`SELECT * FROM eios_campaigns WHERE id=$1 AND employer_id=$2`, [campaignId, orgId]).catch(() => ({ rows: [] as any[] }));
    if (!camp[0]) return res.status(404).json({ error: 'Campaign not found' });
    const { rows: toRemind } = await pool.query(`
      SELECT i.*, e.full_name FROM eios_campaign_invites i
      LEFT JOIN eios_employee_profiles e ON e.email = i.email AND e.employer_id = i.employer_id
      WHERE i.campaign_id=$1 AND i.employer_id=$2
        AND i.status = 'invited'
        AND (i.reminder_sent_at IS NULL OR i.reminder_sent_at < NOW() - INTERVAL '24 hours')
      LIMIT 200
    `, [campaignId, orgId]).catch(() => ({ rows: [] as any[] }));
    let reminded = 0;
    for (const inv of toRemind) {
      try {
        await pool.query(`UPDATE eios_campaign_invites SET reminder_sent_at=NOW() WHERE id=$1`, [inv.id]);
        reminded++;
        setImmediate(async () => {
          try {
            const { sendEmail } = await import('../email');
            await sendEmail({ to: inv.email, subject: `Reminder: ${camp[0].name} — assessment pending`,
              html: `<p>Hi ${inv.full_name || inv.email},</p><p>Friendly reminder to complete <strong>${camp[0].name}</strong>.</p>` });
          } catch {}
        });
      } catch {}
    }
    res.json({ success: true, reminded, campaignId });
  }));

  console.log('[eios-workforce] routes registered (EP-WORLDCLASS-98) — P29 Employee Import + Competency Architecture + Campaign Activation (14 routes)');
}
