/**
 * VX-D0 — Multi-Tenant Enterprise Architecture Extension
 * tenant_configuration / tenant_branding / tenant_permissions /
 * tenant_assessment_config / tenant_benchmark_config / tenant_ai_config
 * Extends the existing basic tenants.ts CRUD with full configuration/branding/white-label.
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

let ready = false;
async function ensureSchema(pool: Pool) {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_configuration (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      config_category TEXT NOT NULL,
      config_key TEXT NOT NULL,
      config_value JSONB NOT NULL DEFAULT '{}',
      description TEXT,
      is_overridable BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, config_category, config_key)
    );
    CREATE TABLE IF NOT EXISTS tenant_branding (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER UNIQUE NOT NULL,
      tenant_name TEXT,
      logo_url TEXT,
      favicon_url TEXT,
      primary_color TEXT DEFAULT '#4F46E5',
      secondary_color TEXT DEFAULT '#06B6D4',
      accent_color TEXT DEFAULT '#10B981',
      font_family TEXT DEFAULT 'Inter',
      custom_css TEXT,
      email_header_color TEXT DEFAULT '#4F46E5',
      email_logo_url TEXT,
      report_header_color TEXT DEFAULT '#1E3A5F',
      white_label_mode BOOLEAN DEFAULT false,
      custom_domain TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tenant_permissions (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      permission_key TEXT NOT NULL,
      is_enabled BOOLEAN DEFAULT true,
      config JSONB DEFAULT '{}',
      granted_by TEXT,
      granted_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      UNIQUE(tenant_id, permission_key)
    );
    CREATE TABLE IF NOT EXISTS tenant_assessment_config (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      assessment_type TEXT NOT NULL,
      is_enabled BOOLEAN DEFAULT true,
      max_attempts INTEGER DEFAULT 1,
      time_limit_minutes INTEGER,
      proctoring_enabled BOOLEAN DEFAULT false,
      adaptive_enabled BOOLEAN DEFAULT true,
      custom_instructions TEXT,
      config JSONB DEFAULT '{}',
      UNIQUE(tenant_id, assessment_type)
    );
    CREATE TABLE IF NOT EXISTS tenant_benchmark_config (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      benchmark_type TEXT NOT NULL,
      is_enabled BOOLEAN DEFAULT true,
      benchmark_scope TEXT CHECK (benchmark_scope IN ('global','industry','role','custom')) DEFAULT 'global',
      custom_peer_group JSONB DEFAULT '[]',
      norm_refresh_days INTEGER DEFAULT 90,
      config JSONB DEFAULT '{}',
      UNIQUE(tenant_id, benchmark_type)
    );
    CREATE TABLE IF NOT EXISTS tenant_ai_config (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      ai_feature TEXT NOT NULL,
      is_enabled BOOLEAN DEFAULT true,
      model_preference TEXT DEFAULT 'default',
      temperature NUMERIC(3,2) DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 1000,
      custom_system_prompt TEXT,
      output_language TEXT DEFAULT 'en',
      config JSONB DEFAULT '{}',
      UNIQUE(tenant_id, ai_feature)
    );
    CREATE INDEX IF NOT EXISTS idx_tc_tenant ON tenant_configuration(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tp_tenant ON tenant_permissions(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tac_tenant ON tenant_assessment_config(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tbc_tenant ON tenant_benchmark_config(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_taic_tenant ON tenant_ai_config(tenant_id);
  `);
  ready = true;
}

const DEFAULT_PERMISSIONS = ['assessment_factory','career_builder','employability_index','learning_intelligence','future_readiness','digital_twin','outcome_prediction','benchmark_engine','report_intelligence','ai_insights','analytics_warehouse','career_passport'];
const DEFAULT_AI_FEATURES = ['narrative_generation','insight_generation','recommendation_engine','adaptive_questioning','report_writing','bias_detection'];
const DEFAULT_ASSESSMENT_TYPES = ['behavioral','functional','cognitive','leadership','future_readiness'];
const DEFAULT_BENCHMARK_TYPES = ['industry','role','layer','top_performer','global'];

export function registerVXTenantConfigurationRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn) {
  const guard = (req: Request, res: Response, next: () => void) => { if (!flagOn()) return res.status(503).json({ error: `${FLAG} off` }); next(); };

  async function ensureAndSeedTenant(tenantId: number) {
    await ensureSchema(pool);
    const [existPerms, existAI, existAssess, existBench] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM tenant_permissions WHERE tenant_id=$1', [tenantId]),
      pool.query('SELECT COUNT(*) FROM tenant_ai_config WHERE tenant_id=$1', [tenantId]),
      pool.query('SELECT COUNT(*) FROM tenant_assessment_config WHERE tenant_id=$1', [tenantId]),
      pool.query('SELECT COUNT(*) FROM tenant_benchmark_config WHERE tenant_id=$1', [tenantId]),
    ]).catch(() => [{ rows: [{ count: '1' }] }, { rows: [{ count: '1' }] }, { rows: [{ count: '1' }] }, { rows: [{ count: '1' }] }]);
    if (Number(existPerms[0]?.rows[0]?.count || 1) === 0) {
      for (const p of DEFAULT_PERMISSIONS) await pool.query('INSERT INTO tenant_permissions(tenant_id,permission_key,is_enabled) VALUES($1,$2,true) ON CONFLICT DO NOTHING', [tenantId, p]).catch(() => null);
    }
    if (Number(existAI[0]?.rows[0]?.count || 1) === 0) {
      for (const f of DEFAULT_AI_FEATURES) await pool.query('INSERT INTO tenant_ai_config(tenant_id,ai_feature,is_enabled) VALUES($1,$2,true) ON CONFLICT DO NOTHING', [tenantId, f]).catch(() => null);
    }
    if (Number(existAssess[0]?.rows[0]?.count || 1) === 0) {
      for (const t of DEFAULT_ASSESSMENT_TYPES) await pool.query('INSERT INTO tenant_assessment_config(tenant_id,assessment_type,is_enabled) VALUES($1,$2,true) ON CONFLICT DO NOTHING', [tenantId, t]).catch(() => null);
    }
    if (Number(existBench[0]?.rows[0]?.count || 1) === 0) {
      for (const t of DEFAULT_BENCHMARK_TYPES) await pool.query('INSERT INTO tenant_benchmark_config(tenant_id,benchmark_type,is_enabled) VALUES($1,$2,true) ON CONFLICT DO NOTHING', [tenantId, t]).catch(() => null);
    }
  }

  app.get('/api/admin/vx/tenants', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await ensureSchema(pool).catch(() => null);
    const cached = gc<unknown>('tenants_vx'); if (cached) return res.json(cached);
    try {
      const tenants = await pool.query('SELECT * FROM tenants ORDER BY created_at DESC').catch(() => ({ rows: [] }));
      const branding = await pool.query('SELECT * FROM tenant_branding').catch(() => ({ rows: [] }));
      const brandingMap = Object.fromEntries(branding.rows.map((b: any) => [b.tenant_id, b]));
      const payload = { tenants: tenants.rows.map((t: any) => ({ ...t, branding: brandingMap[t.id] || null })), total: tenants.rows.length };
      sc('tenants_vx', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/tenants/:tenantId/full-config', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    const tid = parseInt(req.params.tenantId);
    await ensureAndSeedTenant(tid).catch(() => null);
    const cached = gc<unknown>(`tenant_${tid}`); if (cached) return res.json(cached);
    try {
      const [config, branding, perms, assess, bench, ai] = await Promise.all([
        pool.query('SELECT * FROM tenant_configuration WHERE tenant_id=$1 ORDER BY config_category,config_key', [tid]),
        pool.query('SELECT * FROM tenant_branding WHERE tenant_id=$1', [tid]),
        pool.query('SELECT * FROM tenant_permissions WHERE tenant_id=$1 ORDER BY permission_key', [tid]),
        pool.query('SELECT * FROM tenant_assessment_config WHERE tenant_id=$1', [tid]),
        pool.query('SELECT * FROM tenant_benchmark_config WHERE tenant_id=$1', [tid]),
        pool.query('SELECT * FROM tenant_ai_config WHERE tenant_id=$1 ORDER BY ai_feature', [tid]),
      ]);
      const payload = { tenant_id: tid, configuration: config.rows, branding: branding.rows[0] || null, permissions: perms.rows, assessment_config: assess.rows, benchmark_config: bench.rows, ai_config: ai.rows };
      sc(`tenant_${tid}`, payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/admin/vx/tenants/:tenantId/branding', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    const tid = parseInt(req.params.tenantId);
    await ensureSchema(pool).catch(() => null);
    try {
      const { tenant_name, logo_url, favicon_url, primary_color, secondary_color, accent_color, font_family, custom_css, white_label_mode, custom_domain, report_header_color } = req.body;
      const row = await pool.query(
        `INSERT INTO tenant_branding(tenant_id,tenant_name,logo_url,favicon_url,primary_color,secondary_color,accent_color,font_family,custom_css,white_label_mode,custom_domain,report_header_color)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT(tenant_id) DO UPDATE SET tenant_name=EXCLUDED.tenant_name,logo_url=EXCLUDED.logo_url,favicon_url=EXCLUDED.favicon_url,primary_color=EXCLUDED.primary_color,secondary_color=EXCLUDED.secondary_color,accent_color=EXCLUDED.accent_color,font_family=EXCLUDED.font_family,custom_css=EXCLUDED.custom_css,white_label_mode=EXCLUDED.white_label_mode,custom_domain=EXCLUDED.custom_domain,report_header_color=EXCLUDED.report_header_color,updated_at=NOW() RETURNING *`,
        [tid, tenant_name, logo_url, favicon_url, primary_color, secondary_color, accent_color, font_family, custom_css, white_label_mode, custom_domain, report_header_color]
      );
      bc(); res.json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put('/api/admin/vx/tenants/:tenantId/permissions/:permKey', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    const tid = parseInt(req.params.tenantId);
    await ensureSchema(pool).catch(() => null);
    try {
      const { is_enabled, config } = req.body;
      const row = await pool.query('INSERT INTO tenant_permissions(tenant_id,permission_key,is_enabled,config) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,permission_key) DO UPDATE SET is_enabled=EXCLUDED.is_enabled,config=EXCLUDED.config RETURNING *', [tid, req.params.permKey, is_enabled, JSON.stringify(config || {})]);
      bc(); res.json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put('/api/admin/vx/tenants/:tenantId/assessment-config/:assessType', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    const tid = parseInt(req.params.tenantId);
    await ensureSchema(pool).catch(() => null);
    try {
      const { is_enabled, max_attempts, time_limit_minutes, proctoring_enabled, adaptive_enabled, custom_instructions, config } = req.body;
      const row = await pool.query('INSERT INTO tenant_assessment_config(tenant_id,assessment_type,is_enabled,max_attempts,time_limit_minutes,proctoring_enabled,adaptive_enabled,custom_instructions,config) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(tenant_id,assessment_type) DO UPDATE SET is_enabled=EXCLUDED.is_enabled,max_attempts=EXCLUDED.max_attempts,time_limit_minutes=EXCLUDED.time_limit_minutes,proctoring_enabled=EXCLUDED.proctoring_enabled,adaptive_enabled=EXCLUDED.adaptive_enabled,custom_instructions=EXCLUDED.custom_instructions,config=EXCLUDED.config RETURNING *', [tid, req.params.assessType, is_enabled, max_attempts, time_limit_minutes, proctoring_enabled, adaptive_enabled, custom_instructions, JSON.stringify(config || {})]);
      bc(); res.json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put('/api/admin/vx/tenants/:tenantId/ai-config/:feature', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    const tid = parseInt(req.params.tenantId);
    await ensureSchema(pool).catch(() => null);
    try {
      const { is_enabled, model_preference, temperature, max_tokens, custom_system_prompt, output_language } = req.body;
      const row = await pool.query('INSERT INTO tenant_ai_config(tenant_id,ai_feature,is_enabled,model_preference,temperature,max_tokens,custom_system_prompt,output_language) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant_id,ai_feature) DO UPDATE SET is_enabled=EXCLUDED.is_enabled,model_preference=EXCLUDED.model_preference,temperature=EXCLUDED.temperature,max_tokens=EXCLUDED.max_tokens,custom_system_prompt=EXCLUDED.custom_system_prompt,output_language=EXCLUDED.output_language RETURNING *', [tid, req.params.feature, is_enabled, model_preference, temperature, max_tokens, custom_system_prompt, output_language]);
      bc(); res.json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/tenants/overview', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await ensureSchema(pool).catch(() => null);
    try {
      const [tenants, wl, perms] = await Promise.all([
        pool.query('SELECT COUNT(*) as total FROM tenants').catch(() => ({ rows: [{ total: 0 }] })),
        pool.query('SELECT COUNT(*) as white_label FROM tenant_branding WHERE white_label_mode=true').catch(() => ({ rows: [{ white_label: 0 }] })),
        pool.query('SELECT permission_key, COUNT(*) FILTER(WHERE is_enabled) as enabled FROM tenant_permissions GROUP BY permission_key ORDER BY enabled DESC').catch(() => ({ rows: [] })),
      ]);
      res.json({ total_tenants: Number(tenants.rows[0].total), white_label_tenants: Number(wl.rows[0].white_label), permission_adoption: perms.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log('[vx-tenant-configuration] VX-D0 routes registered — tenant_configuration + branding + permissions + assessment/benchmark/ai config');
}
