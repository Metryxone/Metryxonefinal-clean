/**
 * /api/admin/ei/* — Phase 4 Governance routes
 *
 * Admin controls for the configurable scoring engine:
 *   GET    /api/admin/ei/rulesets                    — list all versions
 *   GET    /api/admin/ei/rulesets/active             — currently active ruleset
 *   GET    /api/admin/ei/rulesets/:version           — fetch a specific version
 *   POST   /api/admin/ei/rulesets                    — create a draft (cloned from active by default)
 *   PATCH  /api/admin/ei/rulesets/:version           — edit a draft's config / metadata
 *   POST   /api/admin/ei/rulesets/:version/activate  — activate this version (deactivates previously active)
 *   POST   /api/admin/ei/rulesets/:version/deprecate — mark as deprecated (read-only retain)
 *   POST   /api/admin/ei/rulesets/:version/rollback  — re-activate an older version
 *   POST   /api/admin/ei/rulesets/preview            — score a sample profile under any ruleset (no DB write)
 *   POST   /api/admin/ei/rulesets/compare            — score the same profile under 2 rulesets, return diff
 *   GET    /api/admin/ei/calculation-logs            — recent calc logs (audit trail)
 *   GET    /api/admin/ei/governance-events           — ruleset state-change audit
 *   GET    /api/admin/ei/confidence-models           — list confidence models
 *   POST   /api/admin/ei/snapshots/take              — manually snapshot a user (admin recompute)
 *   GET    /api/admin/ei/snapshots/:user_id          — fetch trajectory for a user
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { computeOfficialEI } from '../services/ei-engine';
import { resolveProfile } from '../services/ei-resolver';
import { getActiveRuleset, getRulesetByVersion, invalidateRulesetCache } from '../services/ei-rules-loader';
import { takeSnapshot, getTrajectory, getEvolutionAnalytics } from '../services/ei-snapshots';

type GuardMW = (req: Request, res: Response, next: NextFunction) => void;

function actor(req: Request) {
  const u = (req as any).user || {};
  return { id: String(u.id || u.user_id || 'admin'), email: String(u.email || 'admin') };
}

async function logGov(pool: Pool, args: {
  ruleset_id?: string | null; event_type: string; actor_id?: string; actor_email?: string;
  before_state?: any; after_state?: any; notes?: string;
}) {
  try {
    await pool.query(
      `INSERT INTO ei_governance_events (ruleset_id, event_type, actor_id, actor_email, before_state, after_state, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [args.ruleset_id || null, args.event_type, args.actor_id || null, args.actor_email || null,
       args.before_state ? JSON.stringify(args.before_state) : null,
       args.after_state  ? JSON.stringify(args.after_state)  : null,
       args.notes || null],
    );
  } catch (e) { console.warn('[ei-gov] log failed', (e as Error).message); }
}

export function registerEIGovernanceRoutes(
  app: Express, pool: Pool,
  requireAuth?: GuardMW, requireSuperAdmin?: GuardMW,
) {
  const chain = [requireAuth, requireSuperAdmin].filter(Boolean) as GuardMW[];

  // ── List rulesets ─────────────────────────────────────────
  app.get('/api/admin/ei/rulesets', ...chain, async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, version, name, status, is_default, taxonomy_version, institution_dataset_version,
                confidence_model_version, created_by, approved_by, approved_at, activated_at, deprecated_at,
                notes, created_at, updated_at
           FROM ei_rulesets ORDER BY created_at DESC`,
      );
      res.json({ ok: true, rulesets: r.rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Active ruleset (with full config + dimension rules) ───
  app.get('/api/admin/ei/rulesets/active', ...chain, async (_req, res) => {
    try {
      const rs = await getActiveRuleset(pool, { skipCache: true });
      const dr = rs.id ? await pool.query(
        `SELECT dimension_key, display_name, weight, formula_type, formula_config, enabled, display_order
           FROM ei_dimension_rules WHERE ruleset_id=$1 ORDER BY display_order`, [rs.id],
      ) : { rows: [] };
      res.json({ ok: true, ruleset: rs, dimension_rules: dr.rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Fetch by version ──────────────────────────────────────
  app.get('/api/admin/ei/rulesets/:version', ...chain, async (req, res) => {
    try {
      const r = await pool.query(`SELECT * FROM ei_rulesets WHERE version=$1`, [req.params.version]);
      if (!r.rowCount) return res.status(404).json({ ok: false, error: 'not found' });
      const dr = await pool.query(
        `SELECT dimension_key, display_name, weight, formula_type, formula_config, enabled, display_order
           FROM ei_dimension_rules WHERE ruleset_id=$1 ORDER BY display_order`, [r.rows[0].id],
      );
      res.json({ ok: true, ruleset: r.rows[0], dimension_rules: dr.rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Create draft (optionally clone active) ────────────────
  app.post('/api/admin/ei/rulesets', ...chain, async (req, res) => {
    const { version, name, description, clone_from, config, notes } = req.body || {};
    if (!version || !name) return res.status(400).json({ ok: false, error: 'version, name required' });
    const a = actor(req);
    try {
      let cfg = config;
      let tax_v: string | null = null, inst_v: string | null = null, conf_v: string | null = null;
      if (clone_from || !cfg) {
        const src = clone_from
          ? await getRulesetByVersion(pool, clone_from)
          : await getActiveRuleset(pool, { skipCache: true });
        if (!src) return res.status(404).json({ ok: false, error: 'clone source not found' });
        cfg = cfg || src.config;
        tax_v = src.taxonomy_version; inst_v = src.institution_dataset_version; conf_v = src.confidence_model_version;
      }
      const ins = await pool.query(
        `INSERT INTO ei_rulesets (version, name, description, status, is_default, config,
                                   taxonomy_version, institution_dataset_version, confidence_model_version,
                                   created_by, notes)
         VALUES ($1,$2,$3,'draft',false,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [version, name, description || null, JSON.stringify(cfg), tax_v, inst_v, conf_v, a.id, notes || null],
      );
      await logGov(pool, { ruleset_id: ins.rows[0].id, event_type: 'created',
        actor_id: a.id, actor_email: a.email, after_state: { version, status: 'draft' }, notes });
      res.json({ ok: true, ruleset: ins.rows[0] });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Patch draft ───────────────────────────────────────────
  app.patch('/api/admin/ei/rulesets/:version', ...chain, async (req, res) => {
    const { name, description, config, notes } = req.body || {};
    const a = actor(req);
    try {
      const cur = await pool.query(`SELECT * FROM ei_rulesets WHERE version=$1`, [req.params.version]);
      if (!cur.rowCount) return res.status(404).json({ ok: false, error: 'not found' });
      if (cur.rows[0].status !== 'draft') return res.status(409).json({ ok: false, error: 'only draft rulesets are editable' });
      const r = await pool.query(
        `UPDATE ei_rulesets SET
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            config = COALESCE($4, config),
            notes = COALESCE($5, notes),
            updated_at = NOW()
          WHERE version=$1 RETURNING *`,
        [req.params.version, name ?? null, description ?? null,
         config ? JSON.stringify(config) : null, notes ?? null],
      );
      await logGov(pool, { ruleset_id: r.rows[0].id, event_type: 'edited',
        actor_id: a.id, actor_email: a.email,
        before_state: { config: cur.rows[0].config }, after_state: { config: r.rows[0].config } });
      res.json({ ok: true, ruleset: r.rows[0] });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Activate ──────────────────────────────────────────────
  app.post('/api/admin/ei/rulesets/:version/activate', ...chain, async (req, res) => {
    const a = actor(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT * FROM ei_rulesets WHERE version=$1 FOR UPDATE`, [req.params.version]);
      if (!cur.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: 'not found' }); }
      const prev = await client.query(`SELECT id, version FROM ei_rulesets WHERE status='active'`);
      await client.query(
        `UPDATE ei_rulesets SET status='deprecated', deprecated_at=NOW() WHERE status='active' AND version<>$1`,
        [req.params.version],
      );
      const r = await client.query(
        `UPDATE ei_rulesets SET status='active', approved_by=COALESCE(approved_by,$2),
                                approved_at=COALESCE(approved_at,NOW()), activated_at=NOW(), updated_at=NOW()
          WHERE version=$1 RETURNING *`,
        [req.params.version, a.id],
      );
      await client.query('COMMIT');
      invalidateRulesetCache();
      await logGov(pool, { ruleset_id: r.rows[0].id, event_type: 'activated',
        actor_id: a.id, actor_email: a.email,
        before_state: { previously_active: prev.rows.map((x: any) => x.version) },
        after_state: { active: req.params.version } });
      res.json({ ok: true, ruleset: r.rows[0] });
    } catch (e: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ ok: false, error: e.message });
    } finally { client.release(); }
  });

  // ── Deprecate ─────────────────────────────────────────────
  // Refuses to deprecate the currently active ruleset unless the caller
  // has already activated another version (or names a replacement). This
  // prevents the system from falling back to the baked default (id:null),
  // which would leave calculation logs with a null ruleset_id and weaken
  // governance traceability.
  app.post('/api/admin/ei/rulesets/:version/deprecate', ...chain, async (req, res) => {
    const a = actor(req);
    const { replacement_version } = req.body || {};
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT id, status FROM ei_rulesets WHERE version=$1 FOR UPDATE`, [req.params.version]);
      if (!cur.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: 'not found' }); }

      // If the target is currently active, require a replacement.
      if (cur.rows[0].status === 'active') {
        if (!replacement_version) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            ok: false,
            error: 'cannot deprecate the active ruleset without specifying replacement_version',
          });
        }
        const repl = await client.query(`SELECT id FROM ei_rulesets WHERE version=$1 FOR UPDATE`, [replacement_version]);
        if (!repl.rowCount) {
          await client.query('ROLLBACK');
          return res.status(404).json({ ok: false, error: 'replacement_version not found' });
        }
        // Atomically activate the replacement first, then deprecate the target.
        await client.query(
          `UPDATE ei_rulesets SET status='active', approved_by=COALESCE(approved_by,$2),
                                  approved_at=COALESCE(approved_at,NOW()), activated_at=NOW(), updated_at=NOW()
            WHERE version=$1`,
          [replacement_version, a.id],
        );
      }

      const r = await client.query(
        `UPDATE ei_rulesets SET status='deprecated', deprecated_at=NOW(), updated_at=NOW()
          WHERE version=$1 RETURNING *`, [req.params.version],
      );
      await client.query('COMMIT');
      invalidateRulesetCache();
      await logGov(pool, { ruleset_id: r.rows[0].id, event_type: 'deprecated',
        actor_id: a.id, actor_email: a.email,
        after_state: { status: 'deprecated', replacement_version: replacement_version || null } });
      res.json({ ok: true, ruleset: r.rows[0], replacement_version: replacement_version || null });
    } catch (e: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ ok: false, error: e.message });
    } finally { client.release(); }
  });

  // ── Rollback (re-activate older version) ──────────────────
  app.post('/api/admin/ei/rulesets/:version/rollback', ...chain, async (req, res) => {
    const a = actor(req);
    const { reason } = req.body || {};
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT id FROM ei_rulesets WHERE version=$1 FOR UPDATE`, [req.params.version]);
      if (!cur.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: 'not found' }); }
      const prev = await client.query(`SELECT version FROM ei_rulesets WHERE status='active'`);
      await client.query(
        `UPDATE ei_rulesets SET status='deprecated', deprecated_at=NOW() WHERE status='active' AND version<>$1`,
        [req.params.version],
      );
      const r = await client.query(
        `UPDATE ei_rulesets SET status='active', activated_at=NOW(), updated_at=NOW()
          WHERE version=$1 RETURNING *`, [req.params.version],
      );
      await client.query('COMMIT');
      invalidateRulesetCache();
      await logGov(pool, { ruleset_id: cur.rows[0].id, event_type: 'rolled_back',
        actor_id: a.id, actor_email: a.email,
        before_state: { previously_active: prev.rows.map((x: any) => x.version) },
        after_state: { active: req.params.version }, notes: reason || null });
      res.json({ ok: true, ruleset: r.rows[0] });
    } catch (e: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ ok: false, error: e.message });
    } finally { client.release(); }
  });

  // ── Preview scoring impact for a sample profile under any ruleset ──
  app.post('/api/admin/ei/rulesets/preview', ...chain, async (req, res) => {
    const { ruleset_version, profile, raw } = req.body || {};
    if (!profile) return res.status(400).json({ ok: false, error: 'profile required' });
    try {
      const ruleset = ruleset_version
        ? await getRulesetByVersion(pool, ruleset_version)
        : await getActiveRuleset(pool, { skipCache: true });
      if (!ruleset) return res.status(404).json({ ok: false, error: 'ruleset not found' });
      const resolution = await resolveProfile(pool, profile);
      const ei = computeOfficialEI({ resolved: resolution, raw: raw || {}, ruleset });
      await logGov(pool, { ruleset_id: ruleset.id, event_type: 'previewed',
        actor_id: actor(req).id, actor_email: actor(req).email,
        after_state: { ruleset_version: ruleset.version, score: ei.score } });
      res.json({ ok: true, ruleset_version: ruleset.version, ei });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Compare 2 rulesets against same profile ───────────────
  app.post('/api/admin/ei/rulesets/compare', ...chain, async (req, res) => {
    const { profile, raw, version_a, version_b } = req.body || {};
    if (!profile || !version_a || !version_b) return res.status(400).json({ ok: false, error: 'profile, version_a, version_b required' });
    try {
      const [ra, rb] = await Promise.all([
        getRulesetByVersion(pool, version_a),
        getRulesetByVersion(pool, version_b),
      ]);
      if (!ra || !rb) return res.status(404).json({ ok: false, error: 'one or both rulesets not found' });
      const resolution = await resolveProfile(pool, profile);
      const a = computeOfficialEI({ resolved: resolution, raw: raw || {}, ruleset: ra });
      const b = computeOfficialEI({ resolved: resolution, raw: raw || {}, ruleset: rb });
      const breakdown_diff = Object.keys(a.breakdown).reduce<Record<string, number>>((acc, k) => {
        acc[k] = Math.round(((b.breakdown as any)[k] - (a.breakdown as any)[k]) * 10) / 10;
        return acc;
      }, {});
      await logGov(pool, { event_type: 'compared', actor_id: actor(req).id, actor_email: actor(req).email,
        after_state: { version_a, version_b, score_a: a.score, score_b: b.score, delta: b.score - a.score } });
      res.json({
        ok: true,
        a: { ruleset_version: version_a, score: a.score, band: a.band, breakdown: a.breakdown },
        b: { ruleset_version: version_b, score: b.score, band: b.band, breakdown: b.breakdown },
        delta: { score: b.score - a.score, band_changed: a.band !== b.band, breakdown: breakdown_diff },
      });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Calculation logs ──────────────────────────────────────
  app.get('/api/admin/ei/calculation-logs', ...chain, async (req, res) => {
    const limit  = Math.min(500, Math.max(1, parseInt(String(req.query.limit  || '100'), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10));
    const user   = req.query.user_id ? String(req.query.user_id) : null;
    try {
      const r = await pool.query(
        `SELECT id, user_id, capability_score, trusted_score, band, ruleset_version, taxonomy_version,
                computation_ms, fallback_used, created_at
           FROM ei_calculation_logs
          ${user ? 'WHERE user_id = $3' : ''}
          ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        user ? [limit, offset, user] : [limit, offset],
      );
      res.json({ ok: true, logs: r.rows, limit, offset });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/admin/ei/calculation-logs/:id', ...chain, async (req, res) => {
    try {
      const r = await pool.query(`SELECT * FROM ei_calculation_logs WHERE id=$1`, [req.params.id]);
      if (!r.rowCount) return res.status(404).json({ ok: false, error: 'not found' });
      res.json({ ok: true, log: r.rows[0] });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Governance events ─────────────────────────────────────
  app.get('/api/admin/ei/governance-events', ...chain, async (req, res) => {
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '100'), 10)));
    try {
      const r = await pool.query(
        `SELECT g.*, rs.version AS ruleset_version
           FROM ei_governance_events g LEFT JOIN ei_rulesets rs ON g.ruleset_id = rs.id
          ORDER BY g.created_at DESC LIMIT $1`, [limit],
      );
      res.json({ ok: true, events: r.rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Confidence models ─────────────────────────────────────
  app.get('/api/admin/ei/confidence-models', ...chain, async (_req, res) => {
    try {
      const r = await pool.query(`SELECT * FROM ei_confidence_models ORDER BY created_at DESC`);
      res.json({ ok: true, models: r.rows });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Snapshots ─────────────────────────────────────────────
  app.post('/api/admin/ei/snapshots/take', ...chain, async (req, res) => {
    const { user_id, profile, raw, ruleset_version } = req.body || {};
    if (!user_id || !profile) return res.status(400).json({ ok: false, error: 'user_id, profile required' });
    try {
      const out = await takeSnapshot(pool, {
        user_id, resolver_input: profile, raw: raw || {},
        source: 'admin_recompute', ruleset_version,
      });
      res.json({ ok: true, snapshot: out });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/admin/ei/snapshots/:user_id', ...chain, async (req, res) => {
    const days = Math.min(365, Math.max(1, parseInt(String(req.query.days || '90'), 10)));
    try {
      const [trajectory, analytics] = await Promise.all([
        getTrajectory(pool, req.params.user_id, days),
        getEvolutionAnalytics(pool, req.params.user_id, days),
      ]);
      res.json({ ok: true, trajectory, analytics });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  console.log('[ei-governance] routes registered');
}
