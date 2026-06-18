import type { Express } from "express";
import pg from "pg";

export function registerTenantsRoutes(app: Express, pool: pg.Pool) {

  // GET /api/admin/tenants — list all tenants
  app.get('/api/admin/tenants', async (req, res) => {
    const { page = '1', limit = '25', search, type, tier } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params: unknown[] = [];
    const where: string[] = [];
    if (search) { params.push(`%${search}%`); where.push(`(tenant_name ILIKE $${params.length} OR tenant_code ILIKE $${params.length} OR contact_email ILIKE $${params.length})`); }
    if (type) { params.push(type); where.push(`tenant_type = $${params.length}`); }
    if (tier) { params.push(tier); where.push(`subscription_tier = $${params.length}`); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
      const countRes = await pool.query(`SELECT COUNT(*) FROM tenants ${whereClause}`, params);
      const rows = await pool.query(
        `SELECT * FROM tenants ${whereClause} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]
      );
      const kpi = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active) as active,
          COUNT(*) FILTER (WHERE tenant_type='school') as schools,
          COUNT(*) FILTER (WHERE tenant_type='university') as universities,
          COUNT(*) FILTER (WHERE tenant_type='enterprise') as enterprises,
          COUNT(*) FILTER (WHERE tenant_type='government') as governments,
          SUM(active_users) as total_users
        FROM tenants
      `);
      res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows, kpi: kpi.rows[0] });
    } catch (err) {
      console.error('Tenants list error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/tenants/:id — single tenant
  app.get('/api/admin/tenants/:id', async (req, res) => {
    try {
      const row = await pool.query('SELECT * FROM tenants WHERE id=$1', [req.params.id]);
      if (!row.rows[0]) return res.status(404).json({ error: 'not found' });
      res.json(row.rows[0]);
    } catch (err) {
      console.error('Tenant fetch error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // POST /api/admin/tenants — create tenant
  app.post('/api/admin/tenants', async (req, res) => {
    const { tenant_code, tenant_name, tenant_type, contact_email, subscription_tier, max_users, settings } = req.body;
    if (!tenant_code || !tenant_name) return res.status(400).json({ error: 'tenant_code and tenant_name required' });
    try {
      const row = await pool.query(
        `INSERT INTO tenants (tenant_code, tenant_name, tenant_type, contact_email, subscription_tier, max_users, settings, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *`,
        [
          tenant_code.toUpperCase(),
          tenant_name,
          tenant_type || 'school',
          contact_email || null,
          subscription_tier || 'basic',
          max_users || 100,
          JSON.stringify(settings || {}),
        ]
      );
      res.status(201).json(row.rows[0]);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) return res.status(409).json({ error: 'tenant_code already exists' });
      console.error('Tenant create error:', err);
      res.status(500).json({ error: 'create failed' });
    }
  });

  // PATCH /api/admin/tenants/:id — update tenant
  app.patch('/api/admin/tenants/:id', async (req, res) => {
    const { tenant_name, tenant_type, contact_email, subscription_tier, max_users, active_users, is_active, settings } = req.body;
    const fields: string[] = [];
    const params: unknown[] = [];
    const set = (col: string, val: unknown) => { if (val !== undefined) { params.push(val); fields.push(`${col}=$${params.length}`); } };
    set('tenant_name', tenant_name);
    set('tenant_type', tenant_type);
    set('contact_email', contact_email);
    set('subscription_tier', subscription_tier);
    set('max_users', max_users);
    set('active_users', active_users);
    set('is_active', is_active);
    set('settings', settings !== undefined ? JSON.stringify(settings) : undefined);
    if (fields.length === 0) return res.status(400).json({ error: 'nothing to update' });
    params.push(req.params.id);
    fields.push('updated_at=NOW()');
    try {
      const row = await pool.query(
        `UPDATE tenants SET ${fields.join(',')} WHERE id=$${params.length} RETURNING *`,
        params
      );
      if (!row.rows[0]) return res.status(404).json({ error: 'not found' });
      res.json(row.rows[0]);
    } catch (err) {
      console.error('Tenant update error:', err);
      res.status(500).json({ error: 'update failed' });
    }
  });

  // DELETE /api/admin/tenants/:id — delete tenant
  app.delete('/api/admin/tenants/:id', async (req, res) => {
    try {
      const row = await pool.query('DELETE FROM tenants WHERE id=$1 RETURNING id', [req.params.id]);
      if (!row.rows[0]) return res.status(404).json({ error: 'not found' });
      res.json({ success: true, deleted_id: row.rows[0].id });
    } catch (err) {
      console.error('Tenant delete error:', err);
      res.status(500).json({ error: 'delete failed' });
    }
  });

  // PATCH /api/admin/tenants/:id/toggle — quick active toggle
  app.patch('/api/admin/tenants/:id/toggle', async (req, res) => {
    try {
      const row = await pool.query(
        'UPDATE tenants SET is_active = NOT is_active, updated_at=NOW() WHERE id=$1 RETURNING id, is_active',
        [req.params.id]
      );
      if (!row.rows[0]) return res.status(404).json({ error: 'not found' });
      res.json(row.rows[0]);
    } catch (err) {
      console.error('Tenant toggle error:', err);
      res.status(500).json({ error: 'toggle failed' });
    }
  });

  // GET /api/admin/tenants/meta/types — tenant type + tier options
  app.get('/api/admin/tenants/meta/types', (_req, res) => {
    res.json({
      types: ['school', 'university', 'enterprise', 'government', 'ngo'],
      tiers: ['basic', 'standard', 'professional', 'enterprise'],
    });
  });
}
