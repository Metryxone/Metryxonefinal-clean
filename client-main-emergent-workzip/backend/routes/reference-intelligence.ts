/**
 * /backend/routes/reference-intelligence.ts
 *
 * Phase 1 — Canonical Reference Intelligence for Employability Index.
 *
 * Endpoints (all under /api/admin/reference/* and /api/reference/*):
 *
 *   Search (fuzzy, public for typeahead):
 *     GET /api/reference/institutions/search?q=&limit=
 *     GET /api/reference/qualifications/search?q=&limit=
 *     GET /api/reference/certifications/search?q=&limit=
 *     GET /api/reference/skills/search?q=&category=&limit=
 *     GET /api/reference/occupations/search?q=&limit=
 *
 *   Admin CRUD:
 *     GET    /api/admin/reference/:entity                  list w/ search
 *     GET    /api/admin/reference/:entity/:id              detail (w/ aliases, rankings, accreditations, provenance)
 *     POST   /api/admin/reference/:entity                  create
 *     PATCH  /api/admin/reference/:entity/:id              update
 *     DELETE /api/admin/reference/:entity/:id              soft-delete (is_active=false)
 *     POST   /api/admin/reference/:entity/:id/aliases      add alias
 *     DELETE /api/admin/reference/:entity/aliases/:aliasId remove alias
 *     POST   /api/admin/reference/:entity/:id/merge        merge dupes -> winning_id
 *
 *   Institution-specific:
 *     POST   /api/admin/reference/institutions/:id/rankings
 *     POST   /api/admin/reference/institutions/:id/accreditations
 *     POST   /api/admin/reference/institutions/:id/override-tier
 *
 *   Governance:
 *     GET    /api/admin/reference/provenance?entity_type=&entity_id=
 *     GET    /api/admin/reference/audit-logs?entity_type=&entity_id=&limit=
 *     GET    /api/admin/reference/review-queue?status=
 *     PATCH  /api/admin/reference/review-queue/:id/resolve
 *     POST   /api/reference/review-queue                    public submit (typeahead "+Add" path)
 *     POST   /api/admin/reference/seed                      load curated seed data
 *     GET    /api/admin/reference/stats                     dashboard counts
 *
 * IMPORTANT: existing EI scoring engine is untouched. This layer is read by
 * future EI versions and is available to admins now for governance/curation.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Entity = 'institutions' | 'qualifications' | 'certifications' | 'skills' | 'occupations';

const ENTITY_CONFIG: Record<Entity, {
  table: string;
  aliasTable: string;
  aliasFK: string;
  nameCol: string;
  shortCol?: string;
  searchExtra?: string;
}> = {
  institutions:   { table: 'institutions',    aliasTable: 'institution_aliases',     aliasFK: 'institution_id',    nameCol: 'canonical_name', shortCol: 'short_name' },
  qualifications: { table: 'qualifications',  aliasTable: 'qualification_aliases',   aliasFK: 'qualification_id',  nameCol: 'canonical_name', shortCol: 'short_name' },
  certifications: { table: 'certifications',  aliasTable: 'certification_aliases',   aliasFK: 'certification_id',  nameCol: 'canonical_name', shortCol: 'short_name' },
  skills:         { table: 'skills',          aliasTable: 'skill_aliases',           aliasFK: 'skill_id',          nameCol: 'canonical_name' },
  occupations:    { table: 'occupations',     aliasTable: '',                        aliasFK: '',                  nameCol: 'canonical_title' },
};

function isEntity(s: string): s is Entity {
  return s === 'institutions' || s === 'qualifications' || s === 'certifications' || s === 'skills' || s === 'occupations';
}

// Entity routes are mounted under /entities/:entity to avoid collisions with
// fixed governance routes (/provenance, /audit-logs, /review-queue, /seed, /stats).
const ENTITY_PARAM = 'entities/:entity';

// Strict allowlist of writable columns per entity (defense-in-depth against identifier injection).
const ENTITY_WRITE_COLS: Record<Entity, Set<string>> = {
  institutions:   new Set(['canonical_name','short_name','institution_type','country_code','state','city','established_year','website','tier_computed','tier_basis','tier_overridden','tier_override_reason','is_active']),
  qualifications: new Set(['canonical_name','short_name','qualification_type','nsqf_level','eqf_level','regulator','field_of_study','duration_months','qualification_weight','is_active']),
  certifications: new Set(['canonical_name','short_name','issuer_name','issuer_category','market_recognition_score','technical_depth_score','tier','verification_supported','verification_method','verification_url','validity_period_months','is_active']),
  skills:         new Set(['canonical_name','skill_category','parent_skill_id','esco_uri','onet_code','nsqf_code','market_demand_score','future_relevance_score','is_active']),
  occupations:    new Set(['canonical_title','role_family','seniority_level','seniority_weight','esco_code','onet_code','is_active']),
};

// Sentinel for accreditation upsert idempotency: unique constraint includes valid_from,
// but Postgres treats NULLs as distinct, so we collapse missing dates to a fixed sentinel.
const ACCRED_DATE_SENTINEL = '1900-01-01';

function adminContext(req: Request) {
  // Super-admin identification falls back to header — wired into existing requireSuperAdmin chain by caller.
  return {
    admin_user_id: (req as any).user?.id || (req.headers['x-admin-user-id'] as string) || null,
    admin_email:   (req as any).user?.email || (req.headers['x-admin-email'] as string) || 'support@metryxone.com',
  };
}

async function writeAudit(pool: Pool, params: {
  req: Request;
  action_type: string;
  entity_type: string;
  entity_id?: string | null;
  previous_value?: any;
  new_value?: any;
  reason?: string;
}) {
  const ctx = adminContext(params.req);
  try {
    await pool.query(
      `INSERT INTO ref_admin_audit_logs
        (admin_user_id, admin_email, action_type, entity_type, entity_id, previous_value, new_value, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ctx.admin_user_id, ctx.admin_email, params.action_type, params.entity_type,
        params.entity_id || null,
        params.previous_value ? JSON.stringify(params.previous_value) : null,
        params.new_value ? JSON.stringify(params.new_value) : null,
        params.reason || null]
    );
  } catch (e) {
    // never block primary operation
    console.warn('[ref-audit] failed', (e as Error).message);
  }
}

async function writeProvenance(pool: Pool, params: {
  entity_type: string;
  entity_id?: string | null;
  source_authority: string;
  source_url?: string | null;
  source_snapshot_date?: string | null;
  extracted_value?: any;
  confidence_score?: number;
}): Promise<string | null> {
  try {
    const r = await pool.query(
      `INSERT INTO provenance_records
        (entity_type, entity_id, source_authority, source_url, source_snapshot_date, extracted_value, confidence_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [params.entity_type, params.entity_id || null, params.source_authority,
        params.source_url || null, params.source_snapshot_date || null,
        params.extracted_value ? JSON.stringify(params.extracted_value) : null,
        params.confidence_score ?? 1.0]
    );
    return r.rows[0].id;
  } catch (e) {
    console.warn('[provenance] failed', (e as Error).message);
    return null;
  }
}

/** Fuzzy search using pg_trgm similarity + alias resolution. */
async function fuzzySearch(pool: Pool, entity: Entity, q: string, opts: { limit?: number; category?: string } = {}) {
  const cfg = ENTITY_CONFIG[entity];
  const limit = Math.min(Math.max(opts.limit || 10, 1), 50);
  const term = (q || '').trim();
  if (!term) {
    const sql = `SELECT * FROM ${cfg.table} WHERE COALESCE(is_active,true)=true
                 ${entity === 'skills' && opts.category ? 'AND skill_category=$1' : ''}
                 ORDER BY ${cfg.nameCol} LIMIT ${limit}`;
    const r = await pool.query(sql, entity === 'skills' && opts.category ? [opts.category] : []);
    return r.rows.map(row => ({ ...row, _score: 0, _matched_via: 'list' }));
  }
  // canonical-name similarity
  const params: any[] = [term, `%${term}%`];
  let extraWhere = '';
  if (entity === 'skills' && opts.category) {
    params.push(opts.category);
    extraWhere = `AND skill_category = $${params.length}`;
  }
  const canonSql = `
    SELECT *, similarity(${cfg.nameCol}, $1) AS _score, '${cfg.nameCol}' AS _matched_via
      FROM ${cfg.table}
     WHERE COALESCE(is_active,true)=true
       AND ( ${cfg.nameCol} % $1 OR ${cfg.nameCol} ILIKE $2
             ${cfg.shortCol ? `OR ${cfg.shortCol} % $1 OR ${cfg.shortCol} ILIKE $2` : ''} )
       ${extraWhere}
     ORDER BY _score DESC, ${cfg.nameCol}
     LIMIT ${limit}`;
  const canon = await pool.query(canonSql, params);

  // alias resolution (if entity has aliases)
  let viaAlias: any[] = [];
  if (cfg.aliasTable) {
    const aliasSql = `
      SELECT e.*, similarity(a.alias_name, $1) AS _score, a.alias_name AS _matched_via
        FROM ${cfg.aliasTable} a
        JOIN ${cfg.table} e ON e.id = a.${cfg.aliasFK}
       WHERE (a.alias_name % $1 OR a.alias_name ILIKE $2)
         AND COALESCE(e.is_active,true)=true
       ORDER BY _score DESC
       LIMIT ${limit}`;
    const r2 = await pool.query(aliasSql, [term, `%${term}%`]);
    viaAlias = r2.rows;
  }
  // merge unique by id, prefer higher score
  const map = new Map<string, any>();
  for (const row of [...canon.rows, ...viaAlias]) {
    const prev = map.get(row.id);
    if (!prev || (row._score || 0) > (prev._score || 0)) map.set(row.id, row);
  }
  return Array.from(map.values()).sort((a, b) => (b._score || 0) - (a._score || 0)).slice(0, limit);
}

export function registerReferenceIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth?: (req: Request, res: Response, next: NextFunction) => void,
  requireSuperAdmin?: (req: Request, res: Response, next: NextFunction) => void
) {
  const adminGuards = [requireAuth, requireSuperAdmin].filter(Boolean) as any[];

  // ─────────────────────────────────────────────────────────
  // PUBLIC fuzzy typeahead — used by wizards
  // ─────────────────────────────────────────────────────────
  app.get('/api/reference/:entity/search', async (req, res) => {
    try {
      const ent = req.params.entity;
      if (!isEntity(ent)) return res.status(400).json({ error: 'unknown entity' });
      const q = String(req.query.q || '');
      const limit = parseInt(String(req.query.limit || '10'), 10);
      const category = req.query.category ? String(req.query.category) : undefined;
      const results = await fuzzySearch(pool, ent, q, { limit, category });
      res.json({ results, count: results.length });
    } catch (e) {
      console.error('[reference search]', e);
      res.status(500).json({ error: 'search failed', detail: (e as Error).message });
    }
  });

  // PUBLIC submit-for-review (typeahead "+Add custom" path lands here)
  app.post('/api/reference/review-queue', async (req, res) => {
    try {
      const { entity_type, submitted_name, context } = req.body || {};
      if (!entity_type || !submitted_name) return res.status(400).json({ error: 'entity_type and submitted_name required' });
      // find closest match for admin convenience
      let suggestId: string | null = null, suggestScore: number | null = null;
      if (isEntity(entity_type)) {
        const matches = await fuzzySearch(pool, entity_type, submitted_name, { limit: 1 });
        if (matches.length) { suggestId = matches[0].id; suggestScore = matches[0]._score || 0; }
      }
      const r = await pool.query(
        `INSERT INTO ref_review_queue (entity_type, submitted_name, context, suggested_match_id, suggested_match_score)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [entity_type, submitted_name, context ? JSON.stringify(context) : null, suggestId, suggestScore]
      );
      res.json({ ok: true, item: r.rows[0] });
    } catch (e) {
      console.error('[review-queue submit]', e);
      res.status(500).json({ error: 'submit failed' });
    }
  });

  // ─────────────────────────────────────────────────────────
  // ADMIN — list / detail / CRUD
  // ─────────────────────────────────────────────────────────
  app.get('/api/admin/reference/stats', ...adminGuards, async (_req, res) => {
    try {
      const out: Record<string, any> = {};
      for (const ent of ['institutions','qualifications','certifications','skills','occupations'] as Entity[]) {
        const cfg = ENTITY_CONFIG[ent];
        const r = await pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE COALESCE(is_active,true)=true)::int AS active FROM ${cfg.table}`);
        out[ent] = r.rows[0];
      }
      const rq = await pool.query(`SELECT status, COUNT(*)::int AS n FROM ref_review_queue GROUP BY status`);
      out.review_queue = rq.rows.reduce((acc, r) => { acc[r.status] = r.n; return acc; }, {} as Record<string, number>);
      const prov = await pool.query(`SELECT COUNT(*)::int AS n FROM provenance_records`);
      out.provenance_records = prov.rows[0].n;
      const audit = await pool.query(`SELECT COUNT(*)::int AS n FROM ref_admin_audit_logs`);
      out.audit_logs = audit.rows[0].n;
      // ranking & accreditation counts
      const rk = await pool.query(`SELECT COUNT(*)::int AS n FROM institution_rankings`);
      const ac = await pool.query(`SELECT COUNT(*)::int AS n FROM institution_accreditations`);
      out.institution_rankings = rk.rows[0].n;
      out.institution_accreditations = ac.rows[0].n;
      res.json(out);
    } catch (e) {
      console.error('[ref stats]', e);
      res.status(500).json({ error: 'stats failed' });
    }
  });

  app.get(`/api/admin/reference/${ENTITY_PARAM}`, ...adminGuards, async (req, res) => {
    try {
      const ent = req.params.entity;
      if (!isEntity(ent)) return res.status(400).json({ error: 'unknown entity' });
      const cfg = ENTITY_CONFIG[ent];
      const q = String(req.query.q || '').trim();
      const limit = Math.min(parseInt(String(req.query.limit || '100'), 10), 500);
      const offset = parseInt(String(req.query.offset || '0'), 10);
      const params: any[] = [];
      let where = '1=1';
      if (q) {
        params.push(`%${q}%`);
        where += ` AND (${cfg.nameCol} ILIKE $${params.length}${cfg.shortCol ? ` OR ${cfg.shortCol} ILIKE $${params.length}` : ''})`;
      }
      const sql = `SELECT * FROM ${cfg.table} WHERE ${where} ORDER BY ${cfg.nameCol} LIMIT ${limit} OFFSET ${offset}`;
      const r = await pool.query(sql, params);
      const total = await pool.query(`SELECT COUNT(*)::int AS n FROM ${cfg.table} WHERE ${where}`, params);
      res.json({ items: r.rows, total: total.rows[0].n, limit, offset });
    } catch (e) {
      console.error('[ref list]', e);
      res.status(500).json({ error: 'list failed', detail: (e as Error).message });
    }
  });

  app.get(`/api/admin/reference/${ENTITY_PARAM}/:id`, ...adminGuards, async (req, res) => {
    try {
      const ent = req.params.entity;
      if (!isEntity(ent)) return res.status(400).json({ error: 'unknown entity' });
      const cfg = ENTITY_CONFIG[ent];
      const r = await pool.query(`SELECT * FROM ${cfg.table} WHERE id=$1`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'not found' });
      const out: any = { ...r.rows[0] };
      if (cfg.aliasTable) {
        const a = await pool.query(`SELECT * FROM ${cfg.aliasTable} WHERE ${cfg.aliasFK}=$1 ORDER BY alias_name`, [req.params.id]);
        out.aliases = a.rows;
      }
      if (ent === 'institutions') {
        const rk = await pool.query(`SELECT * FROM institution_rankings WHERE institution_id=$1 ORDER BY ranking_year DESC, ranking_source`, [req.params.id]);
        const ac = await pool.query(`SELECT * FROM institution_accreditations WHERE institution_id=$1 ORDER BY accreditation_authority`, [req.params.id]);
        out.rankings = rk.rows; out.accreditations = ac.rows;
      }
      const prov = await pool.query(
        `SELECT * FROM provenance_records WHERE entity_type=$1 AND entity_id=$2 ORDER BY last_verified_at DESC LIMIT 50`,
        [ent.replace(/s$/, ''), req.params.id]
      );
      out.provenance = prov.rows;
      res.json(out);
    } catch (e) {
      console.error('[ref detail]', e);
      res.status(500).json({ error: 'detail failed' });
    }
  });

  app.post(`/api/admin/reference/${ENTITY_PARAM}`, ...adminGuards, async (req, res) => {
    try {
      const ent = req.params.entity as Entity;
      const cfg = ENTITY_CONFIG[ent];
      const allowed = ENTITY_WRITE_COLS[ent];
      const body = req.body || {};
      const cols = Object.keys(body).filter(k => allowed.has(k));
      if (!cols.length) return res.status(400).json({ error: 'no valid fields' });
      const vals = cols.map(c => (body[c] && typeof body[c] === 'object' ? JSON.stringify(body[c]) : body[c]));
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
      const sql = `INSERT INTO ${cfg.table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`;
      const r = await pool.query(sql, vals);
      await writeAudit(pool, { req, action_type: 'create', entity_type: ent.replace(/s$/, ''), entity_id: r.rows[0].id, new_value: r.rows[0] });
      res.json({ ok: true, item: r.rows[0] });
    } catch (e: any) {
      console.error('[ref create]', e);
      res.status(500).json({ error: 'create failed', detail: e.message });
    }
  });

  app.patch(`/api/admin/reference/${ENTITY_PARAM}/:id`, ...adminGuards, async (req, res) => {
    try {
      const ent = req.params.entity as Entity;
      const cfg = ENTITY_CONFIG[ent];
      const allowed = ENTITY_WRITE_COLS[ent];
      const body = req.body || {};
      const cols = Object.keys(body).filter(k => allowed.has(k));
      if (!cols.length) return res.status(400).json({ error: 'no valid fields' });
      const prev = await pool.query(`SELECT * FROM ${cfg.table} WHERE id=$1`, [req.params.id]);
      if (!prev.rows.length) return res.status(404).json({ error: 'not found' });
      const setSql = cols.map((c, i) => `${c}=$${i + 1}`).join(',');
      const vals = cols.map(c => (body[c] && typeof body[c] === 'object' ? JSON.stringify(body[c]) : body[c]));
      vals.push(req.params.id);
      const sql = `UPDATE ${cfg.table} SET ${setSql}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`;
      const r = await pool.query(sql, vals);
      await writeAudit(pool, { req, action_type: 'update', entity_type: ent.replace(/s$/, ''), entity_id: req.params.id, previous_value: prev.rows[0], new_value: r.rows[0], reason: body.reason });
      res.json({ ok: true, item: r.rows[0] });
    } catch (e: any) {
      console.error('[ref update]', e);
      res.status(500).json({ error: 'update failed', detail: e.message });
    }
  });

  app.delete(`/api/admin/reference/${ENTITY_PARAM}/:id`, ...adminGuards, async (req, res) => {
    try {
      const ent = req.params.entity as Entity;
      const cfg = ENTITY_CONFIG[ent];
      const prev = await pool.query(`SELECT * FROM ${cfg.table} WHERE id=$1`, [req.params.id]);
      if (!prev.rows.length) return res.status(404).json({ error: 'not found' });
      await pool.query(`UPDATE ${cfg.table} SET is_active=false, updated_at=NOW() WHERE id=$1`, [req.params.id]);
      await writeAudit(pool, { req, action_type: 'delete', entity_type: ent.replace(/s$/, ''), entity_id: req.params.id, previous_value: prev.rows[0], reason: req.body?.reason });
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[ref delete]', e);
      res.status(500).json({ error: 'delete failed' });
    }
  });

  // ─── Aliases ─────────────────────────────────────────────
  app.post(`/api/admin/reference/${ENTITY_PARAM}/:id/aliases`, ...adminGuards, async (req, res) => {
    try {
      const ent = req.params.entity as Entity;
      if (!ENTITY_CONFIG[ent].aliasTable) return res.status(400).json({ error: 'unsupported' });
      const cfg = ENTITY_CONFIG[ent];
      const { alias_name, alias_type, confidence_score } = req.body || {};
      if (!alias_name) return res.status(400).json({ error: 'alias_name required' });
      const r = await pool.query(
        `INSERT INTO ${cfg.aliasTable} (${cfg.aliasFK}, alias_name, alias_type, confidence_score)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *`,
        [req.params.id, alias_name, alias_type || 'common', confidence_score ?? 1.0]
      );
      await writeAudit(pool, { req, action_type: 'create', entity_type: `${ent.replace(/s$/, '')}_alias`, entity_id: req.params.id, new_value: { alias_name, alias_type } });
      res.json({ ok: true, alias: r.rows[0] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete(`/api/admin/reference/${ENTITY_PARAM}/aliases/:aliasId`, ...adminGuards, async (req, res) => {
    try {
      const ent = req.params.entity as Entity;
      if (!ENTITY_CONFIG[ent].aliasTable) return res.status(400).json({ error: 'unsupported' });
      const cfg = ENTITY_CONFIG[ent];
      const prev = await pool.query(`SELECT * FROM ${cfg.aliasTable} WHERE id=$1`, [req.params.aliasId]);
      await pool.query(`DELETE FROM ${cfg.aliasTable} WHERE id=$1`, [req.params.aliasId]);
      await writeAudit(pool, { req, action_type: 'delete', entity_type: `${ent.replace(/s$/, '')}_alias`, previous_value: prev.rows[0] });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Institution rankings & accreditations & tier override ─
  app.post('/api/admin/reference/institutions/:id/rankings', ...adminGuards, async (req, res) => {
    try {
      const { ranking_source, ranking_category, ranking_year, ranking_value, ranking_percentile, source_url } = req.body || {};
      if (!ranking_source || !ranking_year) return res.status(400).json({ error: 'ranking_source and ranking_year required' });
      const provId = await writeProvenance(pool, {
        entity_type: 'ranking', entity_id: req.params.id, source_authority: ranking_source,
        source_url, source_snapshot_date: new Date().toISOString().slice(0, 10),
        extracted_value: { ranking_value, ranking_percentile, ranking_category, ranking_year }, confidence_score: 1.0,
      });
      const r = await pool.query(
        `INSERT INTO institution_rankings (institution_id, ranking_source, ranking_category, ranking_year, ranking_value, ranking_percentile, source_url, provenance_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (institution_id, ranking_source, ranking_category, ranking_year)
         DO UPDATE SET ranking_value=EXCLUDED.ranking_value, ranking_percentile=EXCLUDED.ranking_percentile, source_url=EXCLUDED.source_url, provenance_id=EXCLUDED.provenance_id
         RETURNING *`,
        [req.params.id, ranking_source, ranking_category || 'Overall', ranking_year, ranking_value ?? null, ranking_percentile ?? null, source_url || null, provId]
      );
      await recomputeInstitutionTier(pool, req.params.id);
      await writeAudit(pool, { req, action_type: 'create', entity_type: 'institution_ranking', entity_id: req.params.id, new_value: r.rows[0] });
      res.json({ ok: true, ranking: r.rows[0] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/reference/institutions/:id/accreditations', ...adminGuards, async (req, res) => {
    try {
      const { accreditation_authority, accreditation_grade, valid_from, valid_until, source_url } = req.body || {};
      if (!accreditation_authority) return res.status(400).json({ error: 'accreditation_authority required' });
      const provId = await writeProvenance(pool, {
        entity_type: 'accreditation', entity_id: req.params.id, source_authority: accreditation_authority,
        source_url, source_snapshot_date: new Date().toISOString().slice(0, 10),
        extracted_value: { accreditation_grade, valid_from, valid_until }, confidence_score: 1.0,
      });
      const r = await pool.query(
        `INSERT INTO institution_accreditations (institution_id, accreditation_authority, accreditation_grade, valid_from, valid_until, source_url, provenance_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (institution_id, accreditation_authority, valid_from)
         DO UPDATE SET accreditation_grade=EXCLUDED.accreditation_grade, valid_until=EXCLUDED.valid_until, source_url=EXCLUDED.source_url, provenance_id=EXCLUDED.provenance_id
         RETURNING *`,
        [req.params.id, accreditation_authority, accreditation_grade || null, valid_from || ACCRED_DATE_SENTINEL, valid_until || null, source_url || null, provId]
      );
      await recomputeInstitutionTier(pool, req.params.id);
      await writeAudit(pool, { req, action_type: 'create', entity_type: 'institution_accreditation', entity_id: req.params.id, new_value: r.rows[0] });
      res.json({ ok: true, accreditation: r.rows[0] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/reference/institutions/:id/override-tier', ...adminGuards, async (req, res) => {
    try {
      const { tier_computed, reason } = req.body || {};
      if (![1, 2, 3].includes(Number(tier_computed))) return res.status(400).json({ error: 'tier_computed must be 1|2|3' });
      const prev = await pool.query(`SELECT * FROM institutions WHERE id=$1`, [req.params.id]);
      if (!prev.rows.length) return res.status(404).json({ error: 'not found' });
      const r = await pool.query(
        `UPDATE institutions SET tier_computed=$1, tier_overridden=true, tier_override_reason=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
        [tier_computed, reason || null, req.params.id]
      );
      await writeAudit(pool, { req, action_type: 'override_tier', entity_type: 'institution', entity_id: req.params.id, previous_value: { tier_computed: prev.rows[0].tier_computed }, new_value: { tier_computed }, reason });
      res.json({ ok: true, institution: r.rows[0] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Merge duplicates ────────────────────────────────────
  app.post(`/api/admin/reference/${ENTITY_PARAM}/:id/merge`, ...adminGuards, async (req, res) => {
    try {
      const ent = req.params.entity as Entity;
      const cfg = ENTITY_CONFIG[ent];
      const { winning_id, reason } = req.body || {};
      if (!winning_id || winning_id === req.params.id) return res.status(400).json({ error: 'winning_id required & must differ' });
      const losing = await pool.query(`SELECT * FROM ${cfg.table} WHERE id=$1`, [req.params.id]);
      const winning = await pool.query(`SELECT * FROM ${cfg.table} WHERE id=$1`, [winning_id]);
      if (!losing.rows.length || !winning.rows.length) return res.status(404).json({ error: 'not found' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Move aliases
        if (cfg.aliasTable) {
          await client.query(`INSERT INTO ${cfg.aliasTable} (${cfg.aliasFK}, alias_name, alias_type, confidence_score)
                              SELECT $1, alias_name, alias_type, confidence_score FROM ${cfg.aliasTable} WHERE ${cfg.aliasFK}=$2
                              ON CONFLICT DO NOTHING`, [winning_id, req.params.id]);
          // promote the losing canonical_name to an alias
          const losingName = losing.rows[0][cfg.nameCol];
          if (losingName) {
            await client.query(`INSERT INTO ${cfg.aliasTable} (${cfg.aliasFK}, alias_name, alias_type) VALUES ($1,$2,'former_name') ON CONFLICT DO NOTHING`, [winning_id, losingName]);
          }
        }
        if (ent === 'institutions') {
          // Move rankings/accreditations; on unique-conflict with existing winner rows, drop the losing duplicate
          // so the parent DELETE does not cascade-destroy data. Errors propagate -> outer ROLLBACK.
          await client.query(`
            DELETE FROM institution_rankings r
             WHERE r.institution_id=$2
               AND EXISTS (
                 SELECT 1 FROM institution_rankings w
                  WHERE w.institution_id=$1
                    AND w.ranking_source=r.ranking_source
                    AND w.ranking_category=r.ranking_category
                    AND w.ranking_year=r.ranking_year
               )`, [winning_id, req.params.id]);
          await client.query(`UPDATE institution_rankings SET institution_id=$1 WHERE institution_id=$2`, [winning_id, req.params.id]);
          await client.query(`
            DELETE FROM institution_accreditations a
             WHERE a.institution_id=$2
               AND EXISTS (
                 SELECT 1 FROM institution_accreditations w
                  WHERE w.institution_id=$1
                    AND w.accreditation_authority=a.accreditation_authority
                    AND COALESCE(w.valid_from,DATE '1900-01-01')=COALESCE(a.valid_from,DATE '1900-01-01')
               )`, [winning_id, req.params.id]);
          await client.query(`UPDATE institution_accreditations SET institution_id=$1 WHERE institution_id=$2`, [winning_id, req.params.id]);
        }
        await client.query(`DELETE FROM ${cfg.table} WHERE id=$1`, [req.params.id]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK'); throw err;
      } finally { client.release(); }
      await writeAudit(pool, { req, action_type: 'merge', entity_type: ent.replace(/s$/, ''), entity_id: winning_id, previous_value: losing.rows[0], new_value: winning.rows[0], reason });
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[ref merge]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Provenance & audit & review queue ───────────────────
  app.get('/api/admin/reference/provenance', ...adminGuards, async (req, res) => {
    try {
      const params: any[] = [];
      let where = '1=1';
      if (req.query.entity_type) { params.push(req.query.entity_type); where += ` AND entity_type=$${params.length}`; }
      if (req.query.entity_id)   { params.push(req.query.entity_id);   where += ` AND entity_id=$${params.length}`; }
      if (req.query.source_authority) { params.push(req.query.source_authority); where += ` AND source_authority=$${params.length}`; }
      const limit = Math.min(parseInt(String(req.query.limit || '200'), 10), 1000);
      const r = await pool.query(`SELECT * FROM provenance_records WHERE ${where} ORDER BY last_verified_at DESC LIMIT ${limit}`, params);
      res.json({ items: r.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/reference/audit-logs', ...adminGuards, async (req, res) => {
    try {
      const params: any[] = [];
      let where = '1=1';
      if (req.query.entity_type) { params.push(req.query.entity_type); where += ` AND entity_type=$${params.length}`; }
      if (req.query.entity_id)   { params.push(req.query.entity_id);   where += ` AND entity_id=$${params.length}`; }
      if (req.query.action_type) { params.push(req.query.action_type); where += ` AND action_type=$${params.length}`; }
      const limit = Math.min(parseInt(String(req.query.limit || '200'), 10), 1000);
      const r = await pool.query(`SELECT * FROM ref_admin_audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ${limit}`, params);
      res.json({ items: r.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/reference/review-queue', ...adminGuards, async (req, res) => {
    try {
      const params: any[] = [];
      let where = '1=1';
      if (req.query.status) { params.push(req.query.status); where += ` AND status=$${params.length}`; }
      if (req.query.entity_type) { params.push(req.query.entity_type); where += ` AND entity_type=$${params.length}`; }
      const r = await pool.query(`SELECT * FROM ref_review_queue WHERE ${where} ORDER BY created_at DESC LIMIT 500`, params);
      res.json({ items: r.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/admin/reference/review-queue/:id/resolve', ...adminGuards, async (req, res) => {
    try {
      const { status, resolution_note, merge_into_id, create_new } = req.body || {};
      const validStatuses = ['merged', 'created', 'rejected'];
      if (!validStatuses.includes(status)) return res.status(400).json({ error: 'status must be merged|created|rejected' });
      const ctx = adminContext(req);
      const prev = await pool.query(`SELECT * FROM ref_review_queue WHERE id=$1`, [req.params.id]);
      if (!prev.rows.length) return res.status(404).json({ error: 'not found' });
      const item = prev.rows[0];
      let createdId: string | null = null;
      if (status === 'created' && create_new && isEntity(item.entity_type)) {
        const cfg = ENTITY_CONFIG[item.entity_type as Entity];
        const r = await pool.query(`INSERT INTO ${cfg.table} (${cfg.nameCol}) VALUES ($1) RETURNING id`, [item.submitted_name]).catch(() => ({ rows: [] as any[] }));
        createdId = r.rows?.[0]?.id || null;
      }
      if (status === 'merged' && merge_into_id && isEntity(item.entity_type)) {
        const cfg = ENTITY_CONFIG[item.entity_type as Entity];
        if (cfg.aliasTable) {
          await pool.query(`INSERT INTO ${cfg.aliasTable} (${cfg.aliasFK}, alias_name, alias_type) VALUES ($1,$2,'common') ON CONFLICT DO NOTHING`, [merge_into_id, item.submitted_name]);
        }
      }
      await pool.query(
        `UPDATE ref_review_queue SET status=$1, resolution_note=$2, resolved_by=$3, resolved_at=NOW() WHERE id=$4`,
        [status, resolution_note || null, ctx.admin_email, req.params.id]
      );
      await writeAudit(pool, { req, action_type: 'resolve_review', entity_type: item.entity_type, entity_id: createdId || merge_into_id || null, previous_value: item, new_value: { status, resolution_note }, reason: resolution_note });
      res.json({ ok: true, created_id: createdId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Seed ────────────────────────────────────────────────
  app.post('/api/admin/reference/seed', ...adminGuards, async (req, res) => {
    try {
      const result = await runSeed(pool);
      await writeAudit(pool, { req, action_type: 'seed', entity_type: 'reference_seed', new_value: result, reason: req.body?.reason || 'admin-triggered seed' });
      res.json({ ok: true, ...result });
    } catch (e: any) {
      console.error('[seed]', e);
      res.status(500).json({ error: e.message });
    }
  });
}

/**
 * Recompute institution tier from rankings + accreditations.
 * Formula: tier_score = 0.40·NIRF + 0.25·NAAC + 0.20·QS + 0.10·NBA + 0.05·age_repute
 *   Tier 1 ≥ 0.75, Tier 2 ≥ 0.40, else Tier 3.
 * Skips if tier_overridden = true.
 */
async function recomputeInstitutionTier(pool: Pool, institutionId: string) {
  const inst = await pool.query(`SELECT * FROM institutions WHERE id=$1`, [institutionId]);
  if (!inst.rows.length || inst.rows[0].tier_overridden) return;
  const est = inst.rows[0].established_year || null;

  const rk = await pool.query(`SELECT ranking_source, ranking_value, ranking_year FROM institution_rankings WHERE institution_id=$1`, [institutionId]);
  const ac = await pool.query(`SELECT accreditation_authority, accreditation_grade FROM institution_accreditations WHERE institution_id=$1`, [institutionId]);

  // NIRF signal — best (lowest) value across categories
  const nirf = rk.rows.filter(r => r.ranking_source === 'NIRF').map(r => Number(r.ranking_value)).filter(n => n > 0);
  const bestNirf = nirf.length ? Math.min(...nirf) : null;
  const nirfSignal = bestNirf == null ? 0
    : bestNirf <= 10 ? 1.0
    : bestNirf <= 25 ? 0.9
    : bestNirf <= 50 ? 0.75
    : bestNirf <= 100 ? 0.55
    : bestNirf <= 200 ? 0.35
    : 0.15;

  const naac = ac.rows.find(r => r.accreditation_authority === 'NAAC');
  const naacGrade = (naac?.accreditation_grade || '').toUpperCase();
  const naacSignal = naacGrade === 'A++' ? 1.0 : naacGrade === 'A+' ? 0.9 : naacGrade === 'A' ? 0.75 : naacGrade === 'B+' ? 0.55 : naacGrade === 'B' ? 0.4 : naacGrade === 'C' ? 0.2 : 0;

  const qs = rk.rows.filter(r => r.ranking_source === 'QS').map(r => Number(r.ranking_value)).filter(n => n > 0);
  const bestQs = qs.length ? Math.min(...qs) : null;
  const qsSignal = bestQs == null ? 0
    : bestQs <= 100 ? 1.0
    : bestQs <= 300 ? 0.8
    : bestQs <= 500 ? 0.6
    : 0.3;

  const nba = ac.rows.find(r => r.accreditation_authority === 'NBA');
  const nbaSignal = nba ? 0.8 : 0;

  const age = est ? (new Date().getFullYear() - est) : 0;
  const ageSignal = age >= 100 ? 1.0 : age >= 50 ? 0.7 : age >= 25 ? 0.5 : age >= 10 ? 0.3 : 0.1;

  const tierScore = 0.40 * nirfSignal + 0.25 * naacSignal + 0.20 * qsSignal + 0.10 * nbaSignal + 0.05 * ageSignal;
  const tier = tierScore >= 0.75 ? 1 : tierScore >= 0.40 ? 2 : 3;

  const basis: any = {
    score: Number(tierScore.toFixed(3)),
    nirf_best: bestNirf, naac: naacGrade || null, qs_best: bestQs, nba: !!nba, age_years: age,
  };
  await pool.query(`UPDATE institutions SET tier_computed=$1, tier_basis=$2, updated_at=NOW() WHERE id=$3`, [tier, JSON.stringify(basis), institutionId]);
}

// ─────────────────────────────────────────────────────────
// SEED — curated reference data
// ─────────────────────────────────────────────────────────
async function runSeed(pool: Pool) {
  const seed = await import('../seed/reference-intelligence-seed');
  return seed.runReferenceSeed(pool, recomputeInstitutionTier);
}
