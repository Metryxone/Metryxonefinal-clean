/**
 * CAPADEX Signal Ontology Hub — read-only admin browse for the 4-tier
 * Behavioural Signal Ontology subsystem.
 *
 * Surfaces:
 *   • capadex_domains          (20 rows)
 *   • capadex_families         (400 rows)
 *   • capadex_signals          (20 rows)
 *   • capadex_atomic_signals   (15,972 rows)
 *
 * Mounted as a single panel inside the existing CAPADEX Framework
 * (`FrameworkPanel` tab `signalontology`). Mirrors the shape of
 * `capadex-concerns-master.ts` + `capadex-clarity-questions.ts`.
 *
 * Lazy DDL on first request → self-bootstrapping.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DDL_PATH   = path.resolve(__dirname, '../migrations/20260528_signal_ontology_tables.sql');
let _ddlApplied = false;
async function ensureTables(pool: Pool): Promise<void> {
  if (_ddlApplied) return;
  const ddl = fs.readFileSync(DDL_PATH, 'utf8');
  await pool.query(ddl);
  _ddlApplied = true;
}

// ─── Per-resource config (whitelist-driven; never trusts caller input) ─────
type ResourceKey = 'domains' | 'families' | 'signals' | 'atomic';

interface ResourceCfg {
  table: string;
  pk: string;                 // business-key column (e.g. domain_id)
  searchCols: string[];       // ILIKE'd by `?search=`
  facetCols: readonly string[]; // whitelisted facet filter columns
  orderBy: string;
  exportFilename: string;
}

const RESOURCES: Record<ResourceKey, ResourceCfg> = {
  domains: {
    table: 'capadex_domains',
    pk: 'domain_id',
    searchCols: ['domain_id', 'domain_name', 'domain_purpose', 'primary_focus'],
    facetCols: ['relational_bridge_tag', 'intervention_orientation',
                'longitudinal_importance', 'adaptive_runtime_importance'],
    orderBy: 'domain_id',
    exportFilename: 'capadex_domains.csv',
  },
  families: {
    table: 'capadex_families',
    pk: 'family_id',
    searchCols: ['family_id', 'family_name', 'family_purpose', 'domain', 'domain_id'],
    facetCols: ['domain_id', 'relational_bridge_tag'],
    orderBy: 'family_id',
    exportFilename: 'capadex_families.csv',
  },
  signals: {
    table: 'capadex_signals',
    pk: 'signal_id',
    searchCols: ['signal_id', 'signal_name', 'domain', 'signal_family',
                 'behavioral_meaning'],
    facetCols: ['category', 'detection_type', 'volatility',
                'adaptive_importance', 'intervention_priority',
                'relational_bridge_tag'],
    orderBy: 'signal_id',
    exportFilename: 'capadex_signals.csv',
  },
  atomic: {
    table: 'capadex_atomic_signals',
    pk: 'atomic_signal_id',
    searchCols: ['atomic_signal_id', 'family_id', 'domain_id',
                 'atomic_signal_name', 'signal_label', 'signal_definition'],
    facetCols: ['domain_id', 'family_id', 'signal_category', 'detection_type',
                'volatility', 'adaptive_importance', 'intervention_priority',
                'signal_status', 'relational_bridge_tag'],
    orderBy: 'atomic_signal_id',
    exportFilename: 'capadex_atomic_signals.csv',
  },
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Excel/LibreOffice formula-injection guard
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildWhere(cfg: ResourceCfg, req: Request): { sql: string; params: any[] } {
  const where: string[] = [];
  const params: any[] = [];
  const search = String(req.query.search ?? '').trim();
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    where.push(
      `(${cfg.searchCols.map(c => `${c} ILIKE $${idx}`).join(' OR ')})`,
    );
  }
  for (const col of cfg.facetCols) {
    const v = req.query[col];
    if (typeof v === 'string' && v.trim() !== '') {
      params.push(v);
      where.push(`${col} = $${params.length}`);
    }
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function registerCapadexOntologyHubRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {

  // Resource-key validator (Express middleware-style)
  const validateResource: RequestHandler = (req, res, next) => {
    const key = req.params.resource as ResourceKey;
    if (!RESOURCES[key]) {
      return res.status(404).json({ error: `Unknown resource '${key}'` });
    }
    next();
  };

  // ------------------------------------------------------------------
  // GET /stats — aggregate counters across all 4 tiers (one round-trip)
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/ontology-hub/stats',
    requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        await ensureTables(pool);
        // Issue the counts in parallel — every COUNT scans an indexed PK.
        const [d, f, s, a, b, sentinel, strength, unsortedQ] = await Promise.all([
          pool.query('SELECT COUNT(*)::int AS n FROM capadex_domains'),
          pool.query('SELECT COUNT(*)::int AS n FROM capadex_families'),
          pool.query('SELECT COUNT(*)::int AS n FROM capadex_signals'),
          pool.query('SELECT COUNT(*)::int AS n FROM capadex_atomic_signals'),
          pool.query(`SELECT COUNT(DISTINCT relational_bridge_tag)::int AS n
                        FROM capadex_atomic_signals`),
          pool.query(`SELECT
                        COUNT(*)::int AS n,
                        COUNT(*) FILTER (WHERE signal_category = 'positive')::int AS positive,
                        COUNT(*) FILTER (WHERE signal_category = 'negative')::int AS negative,
                        COUNT(*) FILTER (WHERE signal_category NOT IN ('positive','negative')
                                            OR signal_category IS NULL)::int AS other
                        FROM capadex_atomic_signals
                       WHERE relational_bridge_tag = 'GENERAL_CONCERN'`),
          pool.query(`SELECT COUNT(*)::int AS n
                        FROM capadex_atomic_signals
                       WHERE relational_bridge_tag = 'STRENGTH_SIGNAL'`),
          pool.query(`SELECT COUNT(*)::int AS n
                        FROM capadex_atomic_signals
                       WHERE relational_bridge_tag IS NULL OR relational_bridge_tag = ''`),
        ]);
        const atomicTotal = a.rows[0].n as number;
        const reviewQueue = sentinel.rows[0].n as number;   // GENERAL_CONCERN = honest "needs review" set
        const strengths   = strength.rows[0].n as number;   // positive capability signals
        const unsorted    = unsortedQ.rows[0].n as number;  // null/empty tag = no deliberate bucket at all
        // "Resolved" = committed to a SPECIFIC concern bucket OR identified as a
        // strength. The review queue (GENERAL_CONCERN) and any unsorted rows are
        // NOT resolved — they still need a decision. These are real counts, not a
        // tautology: resolved_pct only reaches 100 when both reviewQueue and
        // unsorted are 0. (Pre-change baseline was ~35%.)
        const resolved    = atomicTotal - reviewQueue - unsorted;
        res.json({
          domains:               d.rows[0].n,
          families:              f.rows[0].n,
          signals:               s.rows[0].n,
          atomic_signals:        atomicTotal,
          atomic_bridge_buckets: b.rows[0].n,
          atomic_strength_signals: strengths,
          // GENERAL_CONCERN is now ONLY the negative/ambiguous human-review queue;
          // positive capability signals were moved to STRENGTH_SIGNAL (see
          // backend/scripts/audit/classify-strength-signals.ts).
          atomic_review_queue:     reviewQueue,
          atomic_unsorted:         unsorted,
          atomic_resolved:         resolved,
          atomic_resolved_pct:     atomicTotal ? Math.round(resolved / atomicTotal * 1000) / 10 : 0,
          // retained for back-compat / breakdown of the review queue
          atomic_general_concern:  reviewQueue,
          atomic_general_positive: sentinel.rows[0].positive,
          atomic_general_negative: sentinel.rows[0].negative,
          atomic_general_other:    sentinel.rows[0].other,
        });
      } catch (err) {
        console.error('[ontology-hub/stats]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /coverage — per-bridge-tag cross-tier row counts (FULL OUTER)
  //   Surfaces buckets that exist in atomic but not in concerns_master,
  //   or vice-versa, so curators can spot orphans.
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/ontology-hub/coverage',
    requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        await ensureTables(pool);
        const r = await pool.query(`
          SELECT
            COALESCE(a.bridge, m.bridge)             AS bridge,
            COALESCE(a.n, 0)::int                    AS atomic_signal_rows,
            COALESCE(m.n, 0)::int                    AS concern_rows
          FROM (
            SELECT relational_bridge_tag AS bridge, COUNT(*) AS n
              FROM capadex_atomic_signals GROUP BY 1
          ) a
          FULL OUTER JOIN (
            SELECT relational_bridge_tag AS bridge, COUNT(*) AS n
              FROM capadex_concerns_master GROUP BY 1
          ) m ON a.bridge = m.bridge
          ORDER BY atomic_signal_rows DESC, concern_rows DESC
        `);
        res.json({ rows: r.rows });
      } catch (err) {
        console.error('[ontology-hub/coverage]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /:resource/facets — distinct values for filter dropdowns
  //   Whitelisted via RESOURCES[resource].facetCols so no SQL injection
  //   is possible — caller never specifies a column name directly.
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/ontology-hub/:resource/facets',
    requireAuth, requireSuperAdmin, validateResource,
    async (req: Request, res: Response) => {
      try {
        await ensureTables(pool);
        const cfg = RESOURCES[req.params.resource as ResourceKey];
        const results = await Promise.all(cfg.facetCols.map(col =>
          pool.query(
            `SELECT DISTINCT ${col} AS v FROM ${cfg.table}
              WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY 1`,
          ),
        ));
        const out: Record<string, string[]> = {};
        cfg.facetCols.forEach((col, i) => { out[col] = results[i].rows.map(r => String(r.v)); });
        res.json(out);
      } catch (err) {
        console.error('[ontology-hub/facets]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /:resource — paginated list (search + whitelisted facet filters)
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/ontology-hub/:resource',
    requireAuth, requireSuperAdmin, validateResource,
    async (req: Request, res: Response) => {
      try {
        await ensureTables(pool);
        const cfg = RESOURCES[req.params.resource as ResourceKey];
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const pageSize = Math.min(500, Math.max(1,
          parseInt(String(req.query.pageSize ?? '50'), 10) || 50));

        const { sql: whereSql, params } = buildWhere(cfg, req);

        // Issue COUNT + paginated SELECT in parallel — separate param arrays
        // because the SELECT appends LIMIT/OFFSET placeholders.
        const countParams = [...params];
        const listParams  = [...params, pageSize, (page - 1) * pageSize];

        const [countRes, listRes] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS total FROM ${cfg.table} ${whereSql}`,
            countParams,
          ),
          pool.query(
            `SELECT * FROM ${cfg.table} ${whereSql}
              ORDER BY ${cfg.orderBy}
              LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
            listParams,
          ),
        ]);

        res.json({
          rows: listRes.rows,
          total: countRes.rows[0].total as number,
          page, pageSize,
        });
      } catch (err) {
        console.error('[ontology-hub/list]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /:resource/export.csv — full filtered export
  //   Cells run through csvEscape() → CSV-injection-safe.
  //   Placed BEFORE the /:resource/:id handler so 'export.csv' isn't
  //   parsed as an id (Express matches first wins).
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/ontology-hub/:resource/export.csv',
    requireAuth, requireSuperAdmin, validateResource,
    async (req: Request, res: Response) => {
      try {
        await ensureTables(pool);
        const cfg = RESOURCES[req.params.resource as ResourceKey];
        const { sql: whereSql, params } = buildWhere(cfg, req);
        const r = await pool.query(
          `SELECT * FROM ${cfg.table} ${whereSql} ORDER BY ${cfg.orderBy}`,
          params,
        );
        const cols = r.fields.map(f => f.name).filter(
          c => c !== 'created_at' && c !== 'updated_at' && c !== 'id',
        );
        const header = cols.map(csvEscape).join(',');
        const body = r.rows.map(row =>
          cols.map(c => csvEscape((row as any)[c])).join(','),
        ).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition',
          `attachment; filename="${cfg.exportFilename}"`);
        res.send(`${header}\n${body}\n`);
      } catch (err) {
        console.error('[ontology-hub/export]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /:resource/:id — detail row (by surrogate SERIAL id)
  //   Atomic detail also returns its parent family + domain (single
  //   round-trip via 3 parallel queries) so the drawer can render the
  //   full hierarchy without a follow-up call.
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/ontology-hub/:resource/:id',
    requireAuth, requireSuperAdmin, validateResource,
    async (req: Request, res: Response) => {
      try {
        await ensureTables(pool);
        const cfg = RESOURCES[req.params.resource as ResourceKey];
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

        const r = await pool.query(
          `SELECT * FROM ${cfg.table} WHERE id = $1`, [id],
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        const row = r.rows[0];

        // Hierarchy enrichment for atomic + families
        const resource = req.params.resource as ResourceKey;
        if (resource === 'atomic') {
          const [fam, dom] = await Promise.all([
            pool.query(
              'SELECT * FROM capadex_families WHERE family_id = $1',
              [row.family_id],
            ),
            pool.query(
              'SELECT * FROM capadex_domains WHERE domain_id = $1',
              [row.domain_id],
            ),
          ]);
          return res.json({
            ...row,
            parent_family: fam.rows[0] ?? null,
            parent_domain: dom.rows[0] ?? null,
          });
        }
        if (resource === 'families') {
          const dom = await pool.query(
            'SELECT * FROM capadex_domains WHERE domain_id = $1',
            [row.domain_id],
          );
          return res.json({ ...row, parent_domain: dom.rows[0] ?? null });
        }

        res.json(row);
      } catch (err) {
        console.error('[ontology-hub/detail]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );
}
