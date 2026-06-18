/**
 * CAPADEX Clarity Questions — read-only admin browse + join-coverage API.
 *
 * Surfaces the audited clarity question pool (`capadex_clarity_questions`) to
 * the SuperAdmin console for search, filter, drill-in, CSV export, and
 * relational-coverage analytics against `capadex_concerns_master`. Mirrors the
 * shape of `capadex-concerns-master.ts` so the panel components share UX.
 *
 * Lazy DDL is applied on first request so the endpoint self-bootstraps even
 * before `node backend/scripts/seed-capadex-clarity-questions.mjs` runs.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import multer from 'multer';
import { parse as parseCsv } from 'csv-parse/sync';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMasterBridgeTag, loadMasterVocabulary, UNMAPPED } from '../services/clarity-bridge-classifier';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Translates multer file errors (size > 10MB, malformed multipart) into a clean
// 400 instead of a 500 stack-trace leak.
function uploadSingle(field: string): RequestHandler {
  return (req, res, next) => {
    upload.single(field)(req, res, (err: any) => {
      if (err) {
        const msg = err?.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10 MB)' : String(err?.message ?? err);
        return res.status(400).json({ error: msg });
      }
      next();
    });
  };
}

// Anchor the migration path to THIS file's location so the route works whether
// the backend is started with cwd=repo-root, cwd=backend, or compiled into a
// dist/ tree. `__filename` is unavailable under ESM/tsx — derive it.
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DDL_PATH   = path.resolve(__dirname, '../migrations/20260528_capadex_clarity_questions.sql');
let _ddlApplied = false;
async function ensureTable(pool: Pool): Promise<void> {
  if (_ddlApplied) return;
  const ddl = fs.readFileSync(DDL_PATH, 'utf8');
  await pool.query(ddl);
  _ddlApplied = true;
}

const FACET_COLUMNS = [
  'concern_id_prefix', 'master_bridge_tag', 'polarity',
  'response_type', 'question_type', 'stage',
] as const;
type Facet = typeof FACET_COLUMNS[number];

// ── Editable-column whitelist for PATCH /:id ───────────────────────────────
// Only these columns may be mutated by the admin editor; `id`, `created_at`,
// `updated_at`, and `source_row_index` stay server-managed. NOT-NULL text
// columns reject empty/null; nullable ones coerce '' → NULL.
const EDITABLE_TEXT = [
  'question_id', 'concern_id', 'concern_id_prefix', 'master_bridge_tag', 'text_bridge_tag',
  'concern', 'stage', 'question_type', 'narrative_style', 'question', 'response_type',
  'polarity', 'reverse_score', 'low_score_anchor', 'high_score_anchor',
  'option_a', 'option_b', 'option_c', 'option_d', 'option_e',
] as const;
const EDITABLE_INT = [
  'option_a_score', 'option_b_score', 'option_c_score', 'option_d_score', 'option_e_score',
] as const;
const EDITABLE_NUM = ['question_weight'] as const;
const NOT_NULL_TEXT = new Set<string>([
  'question_id', 'concern_id', 'concern_id_prefix', 'master_bridge_tag',
  'concern', 'question', 'response_type', 'polarity', 'reverse_score',
]);
// Closed value domains — reject anything outside these so an admin edit can't
// silently corrupt routing/scoring semantics downstream.
const ENUM_VALUES: Record<string, Set<string>> = {
  polarity: new Set(['positive', 'negative', 'mixed', 'neutral']),
  reverse_score: new Set(['yes', 'no']),
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── CSV import config ──────────────────────────────────────────────────────
// Column whitelist for import. `id`, `created_at`, `updated_at` are DB-managed
// and ignored even when present (so a file produced by Export CSV round-trips).
const IMPORT_TEXT = [
  'question_id', 'concern_id', 'concern_id_prefix', 'master_bridge_tag', 'text_bridge_tag',
  'concern', 'stage', 'question_type', 'narrative_style', 'question', 'response_type',
  'polarity', 'reverse_score', 'low_score_anchor', 'high_score_anchor',
  'option_a', 'option_b', 'option_c', 'option_d', 'option_e',
] as const;
const IMPORT_INT = [
  'option_a_score', 'option_b_score', 'option_c_score', 'option_d_score', 'option_e_score',
  'source_row_index',
] as const;
const IMPORT_NUM = ['question_weight'] as const;
const IMPORT_COLUMNS = [...IMPORT_TEXT, ...IMPORT_INT, ...IMPORT_NUM] as const;
type ImportCol = typeof IMPORT_COLUMNS[number];

// Reject the row when any of these is blank — no sensible default exists.
const IMPORT_REQUIRED = new Set<ImportCol>([
  'question_id', 'concern_id', 'concern_id_prefix', 'concern', 'question',
]);
// Blank → this default (mirrors the table DDL defaults).
const IMPORT_DEFAULTS: Partial<Record<ImportCol, string | number>> = {
  master_bridge_tag: 'UNMAPPED', response_type: 'frequency',
  polarity: 'negative', reverse_score: 'no',
  option_a_score: 0, option_b_score: 0, option_c_score: 0, option_d_score: 0, option_e_score: 0,
  question_weight: 1.0,
};
const IMPORT_INT_SET = new Set<ImportCol>(IMPORT_INT);
const IMPORT_NUM_SET = new Set<ImportCol>(IMPORT_NUM);
const IMPORT_COL_SET = new Set<string>(IMPORT_COLUMNS);

// Accept either snake_case (matches Export CSV headers) or human-friendly
// "Question ID" form → DB column. Returns null for unknown/ignored headers.
function normaliseClarityHeader(h: string): ImportCol | null {
  const norm = h.trim().toLowerCase().replace(/\s+/g, '_');
  return IMPORT_COL_SET.has(norm) ? (norm as ImportCol) : null;
}

// Coerce one cell to its typed value, applying defaults for blank cells.
// Required cells return '' when blank so validation can flag them.
function coerceClarityCell(col: ImportCol, raw: unknown): string | number | null {
  const s = raw === undefined || raw === null ? '' : String(raw).trim();
  if (IMPORT_INT_SET.has(col)) {
    if (!s) return col in IMPORT_DEFAULTS ? (IMPORT_DEFAULTS[col] as number) : null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : (col in IMPORT_DEFAULTS ? (IMPORT_DEFAULTS[col] as number) : null);
  }
  if (IMPORT_NUM_SET.has(col)) {
    if (!s) return (IMPORT_DEFAULTS[col] as number) ?? null;
    const n = Number(s);
    return Number.isFinite(n) ? n : (IMPORT_DEFAULTS[col] as number);
  }
  if (!s) {
    if (col in IMPORT_DEFAULTS) return IMPORT_DEFAULTS[col] as string;
    return IMPORT_REQUIRED.has(col) ? '' : null;
  }
  return s;
}

export function registerCapadexClarityQuestionsRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {

  // ------------------------------------------------------------------
  // GET /stats  — top-of-panel counters
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/clarity-questions/stats',
    requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const r = await pool.query(`
          SELECT
            COUNT(*)::int                                     AS total_rows,
            COUNT(DISTINCT concern_id)::int                   AS unique_concerns,
            COUNT(DISTINCT concern_id_prefix)::int            AS unique_prefixes,
            COUNT(DISTINCT master_bridge_tag)::int            AS unique_master_bridges,
            COUNT(*) FILTER (WHERE master_bridge_tag = 'UNMAPPED')::int AS unmapped_rows,
            COUNT(*) FILTER (
              WHERE EXISTS (
                SELECT 1 FROM capadex_concerns_master m
                WHERE m.relational_bridge_tag = capadex_clarity_questions.master_bridge_tag
              )
            )::int                                            AS joinable_rows
          FROM capadex_clarity_questions
        `);
        res.json(r.rows[0]);
      } catch (err) {
        console.error('[clarity-questions/stats]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /facets  — distinct values for filter dropdowns
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/clarity-questions/facets',
    requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        // Facet column names come from the static FACET_COLUMNS whitelist (no
        // user input ever interpolated), so it's safe to issue them in parallel.
        const results = await Promise.all(FACET_COLUMNS.map(col =>
          pool.query(
            `SELECT DISTINCT ${col} AS v FROM capadex_clarity_questions
               WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY 1`,
          ),
        ));
        const out: Record<Facet, string[]> = {} as any;
        FACET_COLUMNS.forEach((col, i) => { out[col] = results[i].rows.map(r => r.v); });
        res.json(out);
      } catch (err) {
        console.error('[clarity-questions/facets]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /coverage  — per-bridge cross-side row count (joins + orphans)
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/clarity-questions/coverage',
    requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const r = await pool.query(`
          SELECT
            COALESCE(q.master_bridge_tag, m.relational_bridge_tag) AS bridge,
            COALESCE(q.q_count, 0)::int                              AS question_rows,
            COALESCE(m.m_count, 0)::int                              AS concern_rows
          FROM (
            SELECT master_bridge_tag, COUNT(*) AS q_count
              FROM capadex_clarity_questions GROUP BY 1
          ) q
          FULL OUTER JOIN (
            SELECT relational_bridge_tag, COUNT(*) AS m_count
              FROM capadex_concerns_master GROUP BY 1
          ) m ON q.master_bridge_tag = m.relational_bridge_tag
          ORDER BY question_rows DESC, concern_rows DESC
        `);
        res.json({ rows: r.rows });
      } catch (err) {
        console.error('[clarity-questions/coverage]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /  — paginated list with search + 6 facet filters
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/clarity-questions',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const page     = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const pageSize = Math.min(500, Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50));
        const search   = String(req.query.search ?? '').trim();

        const where: string[] = [];
        const params: any[] = [];

        if (search) {
          params.push(`%${search}%`);
          where.push(`(question ILIKE $${params.length} OR concern ILIKE $${params.length}
                       OR question_id ILIKE $${params.length} OR concern_id ILIKE $${params.length})`);
        }
        for (const col of FACET_COLUMNS) {
          const v = req.query[col];
          if (typeof v === 'string' && v.trim() !== '') {
            params.push(v);
            where.push(`${col} = $${params.length}`);
          }
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const countSql = `SELECT COUNT(*)::int AS total FROM capadex_clarity_questions ${whereSql}`;
        const total = (await pool.query(countSql, params)).rows[0].total as number;

        params.push(pageSize, (page - 1) * pageSize);
        const listSql = `
          SELECT id, question_id, concern_id, concern_id_prefix, master_bridge_tag,
                 text_bridge_tag, concern, stage, question_type, narrative_style,
                 question, response_type, polarity, reverse_score, question_weight,
                 option_a, option_b, option_c, option_d, option_e,
                 option_a_score, option_b_score, option_c_score, option_d_score, option_e_score,
                 low_score_anchor, high_score_anchor, source_row_index,
                 created_at, updated_at
            FROM capadex_clarity_questions
            ${whereSql}
            ORDER BY concern_id_prefix, concern_id, question_id
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `;
        const rows = (await pool.query(listSql, params)).rows;
        res.json({ rows, total, page, pageSize });
      } catch (err) {
        console.error('[clarity-questions/list]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /export.csv — full filtered export (formula-injection neutralised)
  // NOTE: must be registered BEFORE the `/:id` detail route below, otherwise
  // Express matches `/:id` first, treats "export.csv" as the id, fails the
  // numeric check, and returns `{"error":"Invalid id"}`.
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/clarity-questions/export.csv',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const where: string[] = [];
        const params: any[] = [];
        const search = String(req.query.search ?? '').trim();
        if (search) {
          params.push(`%${search}%`);
          where.push(`(question ILIKE $${params.length} OR concern ILIKE $${params.length}
                       OR question_id ILIKE $${params.length} OR concern_id ILIKE $${params.length})`);
        }
        for (const col of FACET_COLUMNS) {
          const v = req.query[col];
          if (typeof v === 'string' && v.trim() !== '') {
            params.push(v);
            where.push(`${col} = $${params.length}`);
          }
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        // Detailed export: every column (incl. id, source_row_index, timestamps).
        const r = await pool.query(
          `SELECT * FROM capadex_clarity_questions ${whereSql}
             ORDER BY concern_id_prefix, concern_id, question_id`,
          params,
        );
        const cols = r.fields.map(f => f.name);
        const header = cols.map(csvEscape).join(',');
        const body = r.rows.map(row =>
          cols.map(c => csvEscape((row as any)[c])).join(','),
        ).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="clarity_questions.csv"');
        res.send(`${header}\n${body}\n`);
      } catch (err) {
        console.error('[clarity-questions/export]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /template.csv — blank import template (header + one example row).
  // Single-sourced from IMPORT_COLUMNS so it always matches the importer.
  // MUST be registered BEFORE `/:id` (literal path wins over the param).
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/clarity-questions/template.csv',
    requireAuth, requireSuperAdmin,
    (_req: Request, res: Response) => {
      // Two illustrative rows so the template teaches both shapes:
      //  1) a fully-filled row showing the complete option/score format, and
      //  2) a required-only row (optional cells blank) demonstrating that the
      //     importer applies its documented defaults (e.g. polarity=negative,
      //     response_type=frequency, master_bridge_tag auto-derived).
      const fullExample: Partial<Record<ImportCol, string | number>> = {
        question_id: 'EXAMPLE_Q_001',
        concern_id: 'EXAMPLE_CONCERN_001',
        concern_id_prefix: 'EXAMPLE',
        concern: 'Example Concern Label',
        question: 'I find it hard to stay focused on a single task.',
        response_type: 'frequency',
        polarity: 'negative',
        reverse_score: 'no',
        low_score_anchor: 'Never',
        high_score_anchor: 'Always',
        option_a: 'Never', option_b: 'Rarely', option_c: 'Sometimes',
        option_d: 'Often', option_e: 'Always',
        option_a_score: 0, option_b_score: 1, option_c_score: 2,
        option_d_score: 3, option_e_score: 4,
        question_weight: 1.0,
      };
      const requiredOnlyExample: Partial<Record<ImportCol, string | number>> = {
        question_id: 'EXAMPLE_Q_002',
        concern_id: 'EXAMPLE_CONCERN_001',
        concern_id_prefix: 'EXAMPLE',
        concern: 'Example Concern Label',
        question: 'I put off starting tasks I find difficult.',
      };
      const header = IMPORT_COLUMNS.map(csvEscape).join(',');
      const toRow = (ex: Partial<Record<ImportCol, string | number>>) =>
        IMPORT_COLUMNS.map(c => csvEscape(ex[c] ?? '')).join(',');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="clarity_questions_template.csv"');
      res.send(`${header}\n${toRow(fullExample)}\n${toRow(requiredOnlyExample)}\n`);
    },
  );

  // ------------------------------------------------------------------
  // GET /:id/export.csv — single-row detailed export (every column).
  // 2-segment path → no collision with the 1-segment `/:id` route.
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/clarity-questions/:id/export.csv',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
        const r = await pool.query('SELECT * FROM capadex_clarity_questions WHERE id = $1', [id]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        const cols = r.fields.map(f => f.name);
        const header = cols.map(csvEscape).join(',');
        const body = cols.map(c => csvEscape((r.rows[0] as any)[c])).join(',');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="clarity_question_${id}.csv"`);
        res.send(`${header}\n${body}\n`);
      } catch (err) {
        console.error('[clarity-questions/export-row]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // PATCH /:id — edit a single clarity-question row (whitelisted columns).
  // ------------------------------------------------------------------
  app.patch(
    '/api/admin/capadex/clarity-questions/:id',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
        const body = (req.body ?? {}) as Record<string, unknown>;

        const sets: string[] = [];
        const params: any[] = [];

        for (const col of EDITABLE_TEXT) {
          if (!(col in body)) continue;
          let v = body[col];
          if (v === null || (typeof v === 'string' && v.trim() === '')) {
            if (NOT_NULL_TEXT.has(col)) return res.status(400).json({ error: `${col} cannot be empty` });
            v = null;
          } else {
            v = String(v);
            const allowed = ENUM_VALUES[col];
            if (allowed && !allowed.has(v)) {
              return res.status(400).json({ error: `${col} must be one of: ${[...allowed].join(', ')}` });
            }
          }
          params.push(v); sets.push(`${col} = $${params.length}`);
        }
        for (const col of EDITABLE_INT) {
          if (!(col in body)) continue;
          const n = Number(body[col]);
          if (!Number.isFinite(n)) return res.status(400).json({ error: `${col} must be a number` });
          params.push(Math.trunc(n)); sets.push(`${col} = $${params.length}`);
        }
        for (const col of EDITABLE_NUM) {
          if (!(col in body)) continue;
          const n = Number(body[col]);
          if (!Number.isFinite(n)) return res.status(400).json({ error: `${col} must be a number` });
          params.push(n); sets.push(`${col} = $${params.length}`);
        }

        if (sets.length === 0) return res.status(400).json({ error: 'No editable fields provided' });
        sets.push('updated_at = NOW()');
        params.push(id);
        const sql = `UPDATE capadex_clarity_questions SET ${sets.join(', ')}
                      WHERE id = $${params.length} RETURNING *`;
        const r = await pool.query(sql, params);
        if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
      } catch (err: any) {
        if (err?.code === '23505') return res.status(409).json({ error: 'question_id already exists' });
        console.error('[clarity-questions/patch]', err);
        res.status(500).json({ error: String(err?.message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /:id — detail (registered AFTER /export.csv so the literal path wins)
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/clarity-questions/:id',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        await ensureTable(pool);
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
        const r = await pool.query('SELECT * FROM capadex_clarity_questions WHERE id = $1', [id]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        // Side-channel: pull any master concerns sharing this row's bridge tag (cap 10).
        const linked = await pool.query(
          `SELECT id, concern_id, domain, concern_cluster, severity, primary_persona
             FROM capadex_concerns_master
            WHERE relational_bridge_tag = $1
            ORDER BY concern_id LIMIT 10`,
          [r.rows[0].master_bridge_tag],
        );
        res.json({ ...r.rows[0], linked_master_concerns: linked.rows });
      } catch (err) {
        console.error('[clarity-questions/detail]', err);
        res.status(500).json({ error: String((err as Error).message ?? err) });
      }
    },
  );

  // ------------------------------------------------------------------
  // POST /import — multipart CSV upload
  //   - field name: `file`
  //   - query: ?mode=append|upsert|replace   (default: upsert)
  //   - query: ?dryRun=1                     (preview without writing)
  // Round-trips the Export CSV: DB-managed columns (id/created_at/updated_at)
  // are ignored; blank cells inherit the table's column defaults. Upsert key is
  // the UNIQUE `question_id`. Validation is per-row; invalid rows are skipped
  // and reported (first 50) rather than failing the whole file.
  // ------------------------------------------------------------------
  app.post(
    '/api/admin/capadex/clarity-questions/import',
    requireAuth, requireSuperAdmin,
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
            columns: (hdrs: string[]) => hdrs.map(h => normaliseClarityHeader(h) ?? `_skip_${h}`),
            skip_empty_lines: true,
            trim: true,
            bom: true,
            relax_quotes: true,
          }) as Record<string, unknown>[];
        } catch (e) {
          return res.status(400).json({ error: 'CSV parse failed', detail: String(e) });
        }

        // Master vocabulary snapshot powers the token-heuristic fallback when a
        // row arrives without a curated-prefix match. Loaded once per import;
        // best-effort (empty set ⇒ prefix-only derivation).
        const masterVocab = await loadMasterVocabulary(pool);

        // Validate + build typed rows. Skip blank phantom rows (no question_id
        // AND no question text), matching the seed/audit convention.
        const errors: Array<{ row: number; reason: string }> = [];
        const prepared: Array<Record<ImportCol, string | number | null>> = [];
        let derivedBridgeTags = 0;
        records.forEach((rec, idx) => {
          const qid = String((rec as any).question_id ?? '').trim();
          const qtext = String((rec as any).question ?? '').trim();
          if (!qid && !qtext) return; // phantom

          const built = {} as Record<ImportCol, string | number | null>;
          for (const col of IMPORT_COLUMNS) built[col] = coerceClarityCell(col, (rec as any)[col]);

          // Derive master_bridge_tag when the CSV omits it or sends the
          // 'UNMAPPED' sentinel, so imports never create unjoinable orphans.
          // An explicit non-empty, non-sentinel tag from the CSV is preserved.
          if (!built.master_bridge_tag || built.master_bridge_tag === UNMAPPED) {
            const tag = resolveMasterBridgeTag({
              concernId: String(built.concern_id ?? ''),
              concernIdPrefix: String(built.concern_id_prefix ?? ''),
              concern: String(built.concern ?? ''),
            }, masterVocab);
            if (tag !== UNMAPPED) { built.master_bridge_tag = tag; derivedBridgeTags += 1; }
            else built.master_bridge_tag = UNMAPPED;
          }

          let rowErr: string | null = null;
          for (const col of IMPORT_REQUIRED) {
            const v = built[col];
            if (v === null || v === '' || (typeof v === 'string' && !v.trim())) { rowErr = `${col} required`; break; }
          }
          if (!rowErr) {
            for (const col of ['polarity', 'reverse_score'] as const) {
              const v = String(built[col] ?? '');
              if (v && ENUM_VALUES[col] && !ENUM_VALUES[col].has(v)) {
                rowErr = `${col} "${v}" not one of: ${[...ENUM_VALUES[col]].join(', ')}`;
                break;
              }
            }
          }
          if (rowErr) { errors.push({ row: idx + 2, reason: rowErr }); return; } // +2: header + 1-index
          prepared.push(built);
        });

        const summary = {
          mode, dryRun,
          parsed: records.length,
          validRows: prepared.length,
          derivedBridgeTags,
          errors: errors.slice(0, 50),
          errorCount: errors.length,
        };

        if (dryRun || !prepared.length) return res.json({ ...summary, written: 0, inserted: 0, updated: 0, skipped: 0 });

        await client.query('BEGIN');
        if (mode === 'replace') {
          await client.query('TRUNCATE capadex_clarity_questions RESTART IDENTITY');
        }

        const cols = IMPORT_COLUMNS.join(', ');
        const placeholders = IMPORT_COLUMNS.map((_, idx) => `$${idx + 1}`).join(', ');
        const updateCols = IMPORT_COLUMNS
          .filter(c => c !== 'question_id')
          .map(c => `${c} = EXCLUDED.${c}`)
          .join(', ');

        let inserted = 0, updated = 0, skipped = 0;
        for (const row of prepared) {
          const vals = IMPORT_COLUMNS.map(c => row[c]);
          // `upsert`  → ON CONFLICT update (xmax=0 ⇒ row was inserted, else updated)
          // `append`/`replace` → ON CONFLICT skip (tolerate duplicate question_id;
          //                       UNIQUE constraint makes a hard insert throw)
          const sql = mode === 'upsert'
            ? `INSERT INTO capadex_clarity_questions (${cols}) VALUES (${placeholders})
                 ON CONFLICT (question_id) DO UPDATE SET ${updateCols}, updated_at = NOW()
               RETURNING (xmax = 0) AS inserted`
            : `INSERT INTO capadex_clarity_questions (${cols}) VALUES (${placeholders})
                 ON CONFLICT (question_id) DO NOTHING
               RETURNING id`;
          const r = await client.query(sql, vals);
          if (mode === 'upsert') {
            if ((r.rows[0] as any)?.inserted) inserted += 1; else updated += 1;
          } else {
            if (r.rowCount && r.rowCount > 0) inserted += 1; else skipped += 1;
          }
        }
        await client.query('COMMIT');

        res.json({ ...summary, written: inserted + updated, inserted, updated, skipped });
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* noop */ }
        console.error('[clarity-questions/import POST]', err);
        res.status(500).json({ error: 'Import failed', detail: String((err as Error).message ?? err) });
      } finally {
        client.release();
      }
    },
  );
}
