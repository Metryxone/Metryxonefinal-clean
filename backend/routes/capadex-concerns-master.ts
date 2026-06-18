/**
 * CAPADEX Concerns Master — read-only admin browse API.
 * Surfaces the audited concerns catalogue (`capadex_concerns_master`) to the
 * SuperAdmin console for search, filter, drill-in, and CSV export.
 *
 * Lazy DDL is applied on first request so the endpoint is self-bootstrapping
 * even before `node backend/scripts/seed-capadex-concerns-master.mjs` runs.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import multer from 'multer';
import { parse as parseCsv } from 'csv-parse/sync';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Editable column whitelist — `id`, `created_at`, `updated_at` are managed by the DB.
const EDITABLE_COLUMNS = [
  'concern_id', 'domain', 'concern_cluster',
  // 2026-05-28 — curated short, user-facing label (nullable). Used by
  // IntroPhase dropdown/pill. Falls back to concern_cluster → domain on
  // read when blank.
  'display_label',
  // 2026-06-01 — user-facing natural-language search phrase (nullable).
  'concern_search',
  'relevance_in_india', 'parent_anxiety_level', 'growth_trend',
  'severity', 'capadex_priority', 'common_indian_context',
  'primary_persona', 'contextual_modifier', 'concern_category',
  'intelligence_layer', 'signal_cluster',
  'assessment_dimension', 'root_cause_group', 'intervention_lens', 'capability_mapping',
  'relational_bridge_tag', 'age_min', 'age_max', 'source_row_index',
] as const;
type EditableCol = typeof EDITABLE_COLUMNS[number];

const NOT_NULL_COLS = new Set<EditableCol>([
  'concern_id', 'domain', 'concern_cluster',
  'assessment_dimension', 'root_cause_group', 'intervention_lens',
  'capability_mapping', 'relational_bridge_tag',
]);
const INT_COLS = new Set<EditableCol>(['age_min', 'age_max', 'source_row_index']);
const ROUTING_SENTINEL = 'UNASSIGNED_ROUTING_NODE';

// Map header strings (csv or audited output) → DB column. Accepts both
// human-friendly "Concern ID" form and lowercase snake_case.
const HEADER_ALIASES: Record<string, EditableCol> = {
  'concern id': 'concern_id', 'concern_id': 'concern_id',
  'domain': 'domain',
  'concern cluster': 'concern_cluster', 'concern_cluster': 'concern_cluster',
  'display label': 'display_label', 'display_label': 'display_label', 'user label': 'display_label',
  'concern search': 'concern_search', 'concern_search': 'concern_search',
  'relevance in india': 'relevance_in_india', 'relevance_in_india': 'relevance_in_india',
  'parent anxiety level': 'parent_anxiety_level', 'parent_anxiety_level': 'parent_anxiety_level',
  'growth trend': 'growth_trend', 'growth_trend': 'growth_trend',
  'severity': 'severity',
  'capadex priority': 'capadex_priority', 'capadex_priority': 'capadex_priority',
  'common indian context': 'common_indian_context', 'common_indian_context': 'common_indian_context',
  'primary persona': 'primary_persona', 'primary_persona': 'primary_persona',
  'contextual modifier': 'contextual_modifier', 'contextual_modifier': 'contextual_modifier',
  'concern category': 'concern_category', 'concern_category': 'concern_category',
  'intelligence layer': 'intelligence_layer', 'intelligence_layer': 'intelligence_layer',
  'signal cluster': 'signal_cluster', 'signal_cluster': 'signal_cluster',
  'assessment dimension': 'assessment_dimension', 'assessment_dimension': 'assessment_dimension',
  'root cause group': 'root_cause_group', 'root_cause_group': 'root_cause_group',
  'intervention lens': 'intervention_lens', 'intervention_lens': 'intervention_lens',
  'capability mapping': 'capability_mapping', 'capability_mapping': 'capability_mapping',
  'relational_bridge_tag': 'relational_bridge_tag', 'relational bridge tag': 'relational_bridge_tag',
  'age_min': 'age_min', 'age_max': 'age_max',
  'source_row_index': 'source_row_index',
};

function normaliseHeader(h: string): EditableCol | null {
  return HEADER_ALIASES[h.trim().toLowerCase()] ?? null;
}

function coerceCell(col: EditableCol, raw: unknown): string | number | null {
  if (raw === undefined || raw === null) {
    return NOT_NULL_COLS.has(col) ? (col.endsWith('_dimension') || col.endsWith('_group') || col.endsWith('_lens') || col.endsWith('_mapping') ? ROUTING_SENTINEL : '') : null;
  }
  if (INT_COLS.has(col)) {
    const s = String(raw).trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }
  const s = String(raw).trim();
  if (!s) return NOT_NULL_COLS.has(col)
    ? (['assessment_dimension','root_cause_group','intervention_lens','capability_mapping'].includes(col) ? ROUTING_SENTINEL : '')
    : null;
  return s;
}

function buildRowValues(payload: Record<string, unknown>): Record<EditableCol, string | number | null> {
  const out = {} as Record<EditableCol, string | number | null>;
  for (const col of EDITABLE_COLUMNS) out[col] = coerceCell(col, (payload as any)[col]);
  return out;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // CSV formula-injection neutralisation: prefix cells that spreadsheet apps
  // would evaluate as a formula (=, +, -, @, TAB, CR) with a leading single
  // quote so Excel/Sheets renders them literally instead of executing.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Wrapper that translates multer file errors (size > 10MB, malformed multipart,
// etc.) into structured 400/413 responses instead of bubbling as 500s.
function uploadSingle(field: string): RequestHandler {
  return (req, res, next) => {
    upload.single(field)(req, res, (err: any) => {
      if (!err) return next();
      if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large (max 10 MB)' });
      }
      if (err?.code) {
        return res.status(400).json({ error: `Upload error (${err.code}): ${err.message}` });
      }
      return res.status(400).json({ error: String(err?.message ?? err) });
    });
  };
}

const DDL = `
CREATE TABLE IF NOT EXISTS capadex_concerns_master (
  id                       SERIAL PRIMARY KEY,
  concern_id               TEXT NOT NULL,
  domain                   TEXT NOT NULL,
  concern_cluster          TEXT NOT NULL,
  relevance_in_india       TEXT,
  parent_anxiety_level     TEXT,
  growth_trend             TEXT,
  severity                 TEXT,
  capadex_priority         TEXT,
  common_indian_context    TEXT,
  primary_persona          TEXT,
  contextual_modifier      TEXT,
  concern_category         TEXT,
  intelligence_layer       TEXT,
  signal_cluster           TEXT,
  assessment_dimension     TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  root_cause_group         TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  intervention_lens        TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  capability_mapping       TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  relational_bridge_tag    TEXT NOT NULL,
  display_label            TEXT,
  concern_search           TEXT,
  age_min                  INTEGER,
  age_max                  INTEGER,
  source_row_index         INTEGER,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_concern_id_idx ON capadex_concerns_master(concern_id);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_domain_idx     ON capadex_concerns_master(domain);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_bridge_idx     ON capadex_concerns_master(relational_bridge_tag);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_persona_idx    ON capadex_concerns_master(primary_persona);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_age_idx        ON capadex_concerns_master(age_min, age_max);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_severity_idx   ON capadex_concerns_master(severity);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_priority_idx   ON capadex_concerns_master(capadex_priority);
`;

let ddlApplied = false;
async function ensureTable(pool: Pool): Promise<void> {
  if (ddlApplied) return;
  await pool.query(DDL);
  // Idempotent column adds for pre-existing tables (no migration runner).
  await pool.query(`ALTER TABLE capadex_concerns_master ADD COLUMN IF NOT EXISTS concern_search TEXT`);
  ddlApplied = true;
}

export function registerCapadexConcernsMasterRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  // GET /api/admin/capadex/concerns-master?search=&domain=&persona=&severity=&priority=&bridge=&page=&pageSize=
  app.get(
    '/api/admin/capadex/concerns-master',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const search   = (req.query.search   as string | undefined)?.trim() || '';
        const domain   = (req.query.domain   as string | undefined)?.trim() || '';
        const persona  = (req.query.persona  as string | undefined)?.trim() || '';
        const severity = (req.query.severity as string | undefined)?.trim() || '';
        const priority = (req.query.priority as string | undefined)?.trim() || '';
        const bridge   = (req.query.bridge   as string | undefined)?.trim() || '';
        const page     = Math.max(1, parseInt(String(req.query.page     || '1'),  10) || 1);
        const pageSize = Math.min(500, Math.max(1, parseInt(String(req.query.pageSize || '50'), 10) || 50));

        const where: string[] = [];
        const vals: unknown[] = [];
        let i = 1;
        if (search) {
          where.push(`(
            concern_id ILIKE $${i} OR
            domain ILIKE $${i} OR
            concern_cluster ILIKE $${i} OR
            common_indian_context ILIKE $${i} OR
            relational_bridge_tag ILIKE $${i}
          )`);
          vals.push(`%${search}%`);
          i += 1;
        }
        if (domain)   { where.push(`domain = $${i++}`);                vals.push(domain); }
        if (persona)  { where.push(`primary_persona = $${i++}`);       vals.push(persona); }
        if (severity) { where.push(`severity = $${i++}`);              vals.push(severity); }
        if (priority) { where.push(`capadex_priority = $${i++}`);      vals.push(priority); }
        if (bridge)   { where.push(`relational_bridge_tag = $${i++}`); vals.push(bridge); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const offset = (page - 1) * pageSize;

        const countQ = await pool.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM capadex_concerns_master ${whereSql}`,
          vals,
        );
        const total = countQ.rows[0]?.total ?? 0;

        const listQ = await pool.query(
          `SELECT * FROM capadex_concerns_master ${whereSql}
           ORDER BY id ASC LIMIT $${i++} OFFSET $${i}`,
          [...vals, pageSize, offset],
        );

        res.json({
          total,
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
          rows: listQ.rows,
        });
      } catch (err) {
        console.error('[capadex/concerns-master GET]', err);
        res.status(500).json({ error: 'Failed to fetch concerns', detail: String(err) });
      }
    },
  );

  // GET /api/admin/capadex/concerns-master/stats
  app.get(
    '/api/admin/capadex/concerns-master/stats',
    requireAuth,
    requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const [totals, byDomain, byPersona, bySeverity, byPriority, byBridge] = await Promise.all([
          pool.query(`
            SELECT
              COUNT(*)::int                                                    AS total,
              COUNT(DISTINCT concern_id)::int                                  AS distinct_ids,
              COUNT(DISTINCT domain)::int                                      AS distinct_domains,
              COUNT(DISTINCT relational_bridge_tag)::int                       AS distinct_bridges,
              COUNT(*) FILTER (WHERE age_min IS NULL)::int                     AS missing_age,
              COUNT(*) FILTER (WHERE assessment_dimension = 'UNASSIGNED_ROUTING_NODE')::int AS unassigned_dim,
              COUNT(*) FILTER (WHERE root_cause_group    = 'UNASSIGNED_ROUTING_NODE')::int AS unassigned_rcg,
              COUNT(*) FILTER (WHERE intervention_lens   = 'UNASSIGNED_ROUTING_NODE')::int AS unassigned_lens,
              COUNT(*) FILTER (WHERE capability_mapping  = 'UNASSIGNED_ROUTING_NODE')::int AS unassigned_cap,
              COUNT(*) FILTER (WHERE
                   assessment_dimension = 'UNASSIGNED_ROUTING_NODE'
                OR root_cause_group     = 'UNASSIGNED_ROUTING_NODE'
                OR intervention_lens    = 'UNASSIGNED_ROUTING_NODE'
                OR capability_mapping   = 'UNASSIGNED_ROUTING_NODE'
              )::int AS unassigned_any_routing
            FROM capadex_concerns_master
          `),
          pool.query(`SELECT domain, COUNT(*)::int AS n FROM capadex_concerns_master GROUP BY domain ORDER BY n DESC LIMIT 20`),
          pool.query(`SELECT primary_persona AS persona, COUNT(*)::int AS n FROM capadex_concerns_master WHERE primary_persona IS NOT NULL GROUP BY primary_persona ORDER BY n DESC`),
          pool.query(`SELECT severity, COUNT(*)::int AS n FROM capadex_concerns_master WHERE severity IS NOT NULL GROUP BY severity ORDER BY n DESC`),
          pool.query(`SELECT capadex_priority AS priority, COUNT(*)::int AS n FROM capadex_concerns_master WHERE capadex_priority IS NOT NULL GROUP BY capadex_priority ORDER BY n DESC`),
          pool.query(`SELECT relational_bridge_tag AS bridge, COUNT(*)::int AS n FROM capadex_concerns_master GROUP BY relational_bridge_tag ORDER BY n DESC LIMIT 20`),
        ]);
        res.json({
          ...totals.rows[0],
          topDomains:    byDomain.rows,
          byPersona:     byPersona.rows,
          bySeverity:    bySeverity.rows,
          byPriority:    byPriority.rows,
          topBridges:    byBridge.rows,
        });
      } catch (err) {
        console.error('[capadex/concerns-master/stats GET]', err);
        res.status(500).json({ error: 'Failed to fetch stats', detail: String(err) });
      }
    },
  );

  // GET /api/admin/capadex/concerns-master/facets — distinct values for filter dropdowns
  app.get(
    '/api/admin/capadex/concerns-master/facets',
    requireAuth,
    requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const [domains, personas, severities, priorities, bridges] = await Promise.all([
          pool.query(`SELECT DISTINCT domain FROM capadex_concerns_master ORDER BY domain`),
          pool.query(`SELECT DISTINCT primary_persona FROM capadex_concerns_master WHERE primary_persona IS NOT NULL ORDER BY primary_persona`),
          pool.query(`SELECT DISTINCT severity FROM capadex_concerns_master WHERE severity IS NOT NULL ORDER BY severity`),
          pool.query(`SELECT DISTINCT capadex_priority FROM capadex_concerns_master WHERE capadex_priority IS NOT NULL ORDER BY capadex_priority`),
          pool.query(`SELECT DISTINCT relational_bridge_tag FROM capadex_concerns_master ORDER BY relational_bridge_tag`),
        ]);
        res.json({
          domains:    domains.rows.map(r => r.domain),
          personas:   personas.rows.map(r => r.primary_persona),
          severities: severities.rows.map(r => r.severity),
          priorities: priorities.rows.map(r => r.capadex_priority),
          bridges:    bridges.rows.map(r => r.relational_bridge_tag),
        });
      } catch (err) {
        console.error('[capadex/concerns-master/facets GET]', err);
        res.status(500).json({ error: 'Failed to fetch facets', detail: String(err) });
      }
    },
  );

  // GET /api/admin/capadex/concerns-master/export.csv — full filtered export (no pagination)
  app.get(
    '/api/admin/capadex/concerns-master/export.csv',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const search   = (req.query.search   as string | undefined)?.trim() || '';
        const domain   = (req.query.domain   as string | undefined)?.trim() || '';
        const persona  = (req.query.persona  as string | undefined)?.trim() || '';
        const severity = (req.query.severity as string | undefined)?.trim() || '';
        const priority = (req.query.priority as string | undefined)?.trim() || '';
        const bridge   = (req.query.bridge   as string | undefined)?.trim() || '';

        const where: string[] = [];
        const vals: unknown[] = [];
        let i = 1;
        if (search) {
          where.push(`(concern_id ILIKE $${i} OR domain ILIKE $${i} OR concern_cluster ILIKE $${i} OR common_indian_context ILIKE $${i} OR relational_bridge_tag ILIKE $${i})`);
          vals.push(`%${search}%`); i += 1;
        }
        if (domain)   { where.push(`domain = $${i++}`);                vals.push(domain); }
        if (persona)  { where.push(`primary_persona = $${i++}`);       vals.push(persona); }
        if (severity) { where.push(`severity = $${i++}`);              vals.push(severity); }
        if (priority) { where.push(`capadex_priority = $${i++}`);      vals.push(priority); }
        if (bridge)   { where.push(`relational_bridge_tag = $${i++}`); vals.push(bridge); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const { rows } = await pool.query(
          `SELECT ${EDITABLE_COLUMNS.join(', ')} FROM capadex_concerns_master ${whereSql} ORDER BY id ASC`,
          vals,
        );
        const header = EDITABLE_COLUMNS.join(',');
        const body = rows.map(r => EDITABLE_COLUMNS.map(c => csvEscape((r as any)[c])).join(',')).join('\n');
        const csv = `${header}\n${body}\n`;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="capadex_concerns_master_${stamp}.csv"`);
        res.send(csv);
      } catch (err) {
        console.error('[capadex/concerns-master/export GET]', err);
        res.status(500).json({ error: 'Failed to export', detail: String(err) });
      }
    },
  );

  // POST /api/admin/capadex/concerns-master — create one row
  app.post(
    '/api/admin/capadex/concerns-master',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const values = buildRowValues(req.body ?? {});
        for (const col of NOT_NULL_COLS) {
          if (values[col] === null || values[col] === '') {
            return res.status(400).json({ error: `Field ${col} is required` });
          }
        }
        const placeholders = EDITABLE_COLUMNS.map((_, idx) => `$${idx + 1}`).join(', ');
        const { rows } = await pool.query(
          `INSERT INTO capadex_concerns_master (${EDITABLE_COLUMNS.join(', ')})
           VALUES (${placeholders}) RETURNING *`,
          EDITABLE_COLUMNS.map(c => values[c]),
        );
        res.status(201).json(rows[0]);
      } catch (err) {
        console.error('[capadex/concerns-master POST]', err);
        res.status(500).json({ error: 'Failed to create concern', detail: String(err) });
      }
    },
  );

  // PATCH /api/admin/capadex/concerns-master/:id — partial edit
  app.patch(
    '/api/admin/capadex/concerns-master/:id',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const id = parseInt(String(req.params.id), 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

        const sets: string[] = [];
        const vals: unknown[] = [];
        let i = 1;
        for (const col of EDITABLE_COLUMNS) {
          if (!(col in (req.body ?? {}))) continue;
          const v = coerceCell(col, (req.body as any)[col]);
          if (NOT_NULL_COLS.has(col) && (v === null || v === '')) {
            return res.status(400).json({ error: `Field ${col} cannot be null/blank` });
          }
          sets.push(`${col} = $${i++}`);
          vals.push(v);
        }
        if (!sets.length) return res.status(400).json({ error: 'No editable fields supplied' });
        sets.push(`updated_at = NOW()`);
        vals.push(id);
        const { rows } = await pool.query(
          `UPDATE capadex_concerns_master SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
          vals,
        );
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
      } catch (err) {
        console.error('[capadex/concerns-master PATCH]', err);
        res.status(500).json({ error: 'Failed to update concern', detail: String(err) });
      }
    },
  );

  // DELETE /api/admin/capadex/concerns-master/:id
  app.delete(
    '/api/admin/capadex/concerns-master/:id',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const id = parseInt(String(req.params.id), 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
        const { rowCount } = await pool.query(`DELETE FROM capadex_concerns_master WHERE id = $1`, [id]);
        if (!rowCount) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true, deleted: id });
      } catch (err) {
        console.error('[capadex/concerns-master DELETE]', err);
        res.status(500).json({ error: 'Failed to delete concern', detail: String(err) });
      }
    },
  );

  // POST /api/admin/capadex/concerns-master/import — multipart CSV upload
  //   - field name: `file`
  //   - query: ?mode=append|upsert|replace   (default: upsert)
  //   - query: ?dryRun=1                     (preview without writing)
  app.post(
    '/api/admin/capadex/concerns-master/import',
    requireAuth,
    requireSuperAdmin,
    uploadSingle('file'),
    async (req: Request, res: Response) => {
      const client = await pool.connect();
      try {
        await ensureTable(pool);
        const file = (req as Request & { file?: Express.Multer.File }).file;
        if (!file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });
        const mode = String(req.query.mode || 'upsert').toLowerCase();
        const dryRun = String(req.query.dryRun || '') === '1';
        if (!['append', 'upsert', 'replace'].includes(mode)) {
          return res.status(400).json({ error: `Invalid mode "${mode}" (use append|upsert|replace)` });
        }

        let records: Record<string, unknown>[];
        try {
          records = parseCsv(file.buffer, {
            columns: (hdrs: string[]) => hdrs.map(h => normaliseHeader(h) ?? `_skip_${h}`),
            skip_empty_lines: true,
            trim: true,
            bom: true,
            relax_quotes: true,
          }) as Record<string, unknown>[];
        } catch (e) {
          return res.status(400).json({ error: 'CSV parse failed', detail: String(e) });
        }

        // Drop phantom rows (no concern_id + no domain) — same rule as audit script.
        const cleaned = records.filter(r => {
          const cid = String((r as any).concern_id ?? '').trim().toLowerCase();
          const dom = String((r as any).domain ?? '').trim().toLowerCase();
          const empty = new Set(['', 'nan', 'none', 'null']);
          return !(empty.has(cid) && empty.has(dom));
        });
        const phantomDropped = records.length - cleaned.length;

        // Validate
        const errors: Array<{ row: number; reason: string }> = [];
        const prepared: Array<Record<EditableCol, string | number | null>> = [];
        cleaned.forEach((rec, idx) => {
          const built = buildRowValues(rec);
          for (const col of NOT_NULL_COLS) {
            const v = built[col];
            if (v === null || v === '' || (typeof v === 'string' && !v.trim())) {
              errors.push({ row: idx + 2, reason: `${col} required` }); // +2: header + 1-index
              return;
            }
          }
          prepared.push(built);
        });

        const summary = {
          mode,
          dryRun,
          parsed: records.length,
          phantomDropped,
          validRows: prepared.length,
          errors: errors.slice(0, 50),
          errorCount: errors.length,
        };

        if (dryRun || !prepared.length) return res.json({ ...summary, written: 0 });

        await client.query('BEGIN');
        if (mode === 'replace') {
          await client.query('TRUNCATE capadex_concerns_master RESTART IDENTITY');
        }

        const cols = EDITABLE_COLUMNS.join(', ');
        const placeholders = EDITABLE_COLUMNS.map((_, idx) => `$${idx + 1}`).join(', ');
        let inserted = 0;
        let updated = 0;

        // Upsert without depending on a UNIQUE constraint: try UPDATE first,
        // INSERT if zero rows matched. Preserves the schema's tolerance for
        // legacy duplicate concern_ids and keeps `append` semantics intact
        // (no global unique index ever created from the request path). If the
        // existing data has multiple rows sharing one concern_id, all of them
        // are updated to the new payload — surfaced via the `updated` count.
        const updateCols = EDITABLE_COLUMNS
          .filter(c => c !== 'concern_id')
          .map((c, idx) => `${c} = $${idx + 2}`)
          .join(', ');
        const updateOrderedCols = EDITABLE_COLUMNS.filter(c => c !== 'concern_id');

        for (const row of prepared) {
          if (mode === 'upsert') {
            const updParams = [row.concern_id, ...updateOrderedCols.map(c => row[c])];
            const upd = await client.query(
              `UPDATE capadex_concerns_master
                  SET ${updateCols}, updated_at = NOW()
                WHERE concern_id = $1`,
              updParams,
            );
            if (upd.rowCount && upd.rowCount > 0) {
              updated += upd.rowCount;
              continue;
            }
          }
          const vals = EDITABLE_COLUMNS.map(c => row[c]);
          await client.query(
            `INSERT INTO capadex_concerns_master (${cols}) VALUES (${placeholders})`,
            vals,
          );
          inserted += 1;
        }
        await client.query('COMMIT');

        res.json({ ...summary, written: inserted + updated, inserted, updated });
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* noop */ }
        console.error('[capadex/concerns-master/import POST]', err);
        res.status(500).json({ error: 'Import failed', detail: String(err) });
      } finally {
        client.release();
      }
    },
  );

  // GET /api/admin/capadex/concerns-master/:id
  app.get(
    '/api/admin/capadex/concerns-master/:id',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const id = parseInt(String(req.params.id), 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
        const { rows } = await pool.query(
          `SELECT * FROM capadex_concerns_master WHERE id = $1`,
          [id],
        );
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
      } catch (err) {
        console.error('[capadex/concerns-master/:id GET]', err);
        res.status(500).json({ error: 'Failed to fetch concern', detail: String(err) });
      }
    },
  );
}
