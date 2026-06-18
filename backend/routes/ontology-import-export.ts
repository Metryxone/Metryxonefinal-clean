/**
 * Ontology Per-Module Import/Export
 *
 * For each of the 11 ontology modules:
 *   GET  /api/ontology/:module/export.csv       — export all active rows as CSV
 *   GET  /api/ontology/:module/template.csv     — empty CSV with headers + 1 sample row
 *   POST /api/ontology/:module/import           — bulk CSV import (multipart or JSON body)
 *
 * Supported modules:
 *   industries | functions | departments | roles | role-families |
 *   career-tracks | career-paths | competency-levels | indicators |
 *   benchmarks | future-skills | ai-rules
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { logAudit } from '../services/platform-audit.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

// ── Module registry ────────────────────────────────────────────────────────────
interface ModuleConfig {
  table:         string;
  headers:       string[];       // CSV column headers (snake_case, matches DB cols)
  required:      string[];       // columns that must be non-empty for a valid row
  sampleRow:     string[];       // one representative sample row (same order as headers)
  exportSelect?: string;         // optional override SELECT (default: SELECT * FROM table)
  labelCol:      string;         // which column is the human label (for audit)
  codeCol:       string;         // unique key column (used for upsert dedup)
  importInsert:  (cols: string[]) => string; // SQL for INSERT … ON CONFLICT
}

const MODULES: Record<string, ModuleConfig> = {
  industries: {
    table: 'ont_industries',
    headers: ['code','name','parent_sector','description','status','sort_order'],
    required: ['code','name'],
    sampleRow: ['IND-TECH','Technology','Digital','Software, hardware, internet services','draft','10'],
    labelCol: 'name', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_industries (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  functions: {
    table: 'ont_functions',
    headers: ['code','name','description','is_cross_industry','status','sort_order'],
    required: ['code','name'],
    sampleRow: ['FN-ENGG','Engineering','Product engineering & development','false','draft','20'],
    labelCol: 'name', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_functions (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  departments: {
    table: 'ont_departments',
    headers: ['code','name','description','cost_centre_type','status','sort_order'],
    required: ['code','name'],
    sampleRow: ['DEPT-SWE','Software Engineering','Backend, frontend & mobile','profit','draft','30'],
    labelCol: 'name', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_departments (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  'role-families': {
    table: 'ont_role_families',
    headers: ['code','name','description','career_track_archetype','status','sort_order'],
    required: ['code','name'],
    sampleRow: ['RF-SWE','Software Engineer Family','IC engineering roles','ic','draft','10'],
    labelCol: 'name', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_role_families (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  roles: {
    table: 'ont_roles',
    headers: ['code','title','seniority_level','min_years_experience','is_leadership','description','status','sort_order'],
    required: ['code','title'],
    sampleRow: ['ROLE-SWE2','Software Engineer II','mid',2,'false','Full-stack product engineering','draft','20'],
    labelCol: 'title', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_roles (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  'career-tracks': {
    table: 'ont_career_tracks',
    headers: ['code','name','description','track_type','status','sort_order'],
    required: ['code','name'],
    sampleRow: ['CT-ENGG','Engineering Track','IC engineering progression','ic','draft','10'],
    labelCol: 'name', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_career_tracks (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  'career-paths': {
    table: 'ont_career_paths',
    headers: ['code','name','description','path_type','typical_months','difficulty','status','sort_order'],
    required: ['code','name'],
    sampleRow: ['CP-SWE2-3','SWE II → SWE III','Mid-level progression','linear','18','medium','draft','10'],
    labelCol: 'name', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_career_paths (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  'competency-levels': {
    table: 'ont_competency_level_anchors',
    headers: ['competency_code','competency_name','proficiency_level','level_number','score_band_min','score_band_max'],
    required: ['competency_code','proficiency_level'],
    sampleRow: ['COMM','Communication','intermediate','3','40','70'],
    labelCol: 'competency_name', codeCol: 'competency_code',
    importInsert: (cols) =>
      `INSERT INTO ont_competency_level_anchors (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (competency_code, proficiency_level) DO UPDATE
         SET ${cols.filter(c=>!['competency_code','proficiency_level'].includes(c)).map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  indicators: {
    table: 'ont_indicators',
    headers: ['code','label','concern_bridge_tag','signal_type','polarity','weight','description','status'],
    required: ['code','label','concern_bridge_tag'],
    sampleRow: ['IND-PROC-001','Procrastination on deadlines','PROCRASTINATION','behavioural','negative','0.7','Consistently delays tasks','draft'],
    labelCol: 'label', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_indicators (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  benchmarks: {
    table: 'ont_benchmarks',
    headers: ['code','name','description','benchmark_type','seniority_level','sample_size','status'],
    required: ['code','name'],
    sampleRow: ['BM-ENGG-MID','Engineering Mid-Level Benchmark','Engineering ICs at P4–P5','role','mid',150,'draft'],
    labelCol: 'name', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_benchmarks (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  'future-skills': {
    table: 'ont_future_skills',
    headers: ['code','name','description','skill_category','emergence_horizon','demand_trend','status'],
    required: ['code','name'],
    sampleRow: ['FS-GENAI-001','Generative AI Prompting','Effective LLM prompt engineering','digital','now','growing','draft'],
    labelCol: 'name', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_future_skills (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
  'ai-rules': {
    table: 'ont_ai_rules',
    headers: ['code','name','description','rule_type','applies_to','priority','risk_level','rationale','status'],
    required: ['code','name','description'],
    sampleRow: ['AIR-SCORE-001','Cap distress score at 95','Prevent ceiling effects in scoring','scoring','all',5,'low','Prevents ceiling effects','draft'],
    labelCol: 'name', codeCol: 'code',
    importInsert: (cols) =>
      `INSERT INTO ont_ai_rules (${cols.join(',')})
       VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})
       ON CONFLICT (code) DO UPDATE SET ${cols.filter(c=>c!=='code').map(c=>`${c}=EXCLUDED.${c}`).join(',')}, updated_at=NOW()
       RETURNING *`,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function escCsv(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escCsv(row[h])).join(','));
  }
  return lines.join('\n');
}

function parseCsv(text: string): string[][] {
  const lines = text.trim().split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuote = false;
        else cur += ch;
      } else {
        if (ch === '"') { inQuote = true; }
        else if (ch === ',') { result.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  });
}

function coerceValue(col: string, raw: string): unknown {
  if (raw === '') return null;
  if (['is_active','is_cross_industry','is_leadership','is_enabled','requires_dual_approval'].includes(col)) {
    return raw.toLowerCase() === 'true' || raw === '1';
  }
  if (['sort_order','level_number','sample_size','priority','min_years_experience'].includes(col)) {
    const n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  }
  if (['weight','score_band_min','score_band_max'].includes(col)) {
    const n = parseFloat(raw);
    return isNaN(n) ? null : n;
  }
  return raw;
}

export function registerOntologyImportExportRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {
  for (const [moduleName, cfg] of Object.entries(MODULES)) {

    // ── Export CSV ─────────────────────────────────────────────────────────
    // Register export.csv BEFORE the :module param so it doesn't get swallowed
    app.get(`/api/ontology/${moduleName}/export.csv`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
      try {
        const { status = 'all' } = req.query as Record<string, string>;
        const where = status !== 'all' ? `WHERE status = $1` : '';
        const params = status !== 'all' ? [status] : [];
        const { rows } = await pool.query(
          `SELECT * FROM ${cfg.table} ${where} ORDER BY id LIMIT 10000`,
          params
        );
        const csv = rowsToCsv(cfg.headers, rows);
        void logAudit(pool, req, { action: 'export', entityType: moduleName, metadata: { row_count: rows.length } });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${moduleName}-export.csv"`);
        return res.send(csv);
      } catch (err) {
        console.error(`[ontology-ie/${moduleName}] export error:`, err);
        return res.status(500).json({ error: 'Export failed' });
      }
    });

    // ── Template CSV ───────────────────────────────────────────────────────
    app.get(`/api/ontology/${moduleName}/template.csv`, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
      const csv = [cfg.headers.join(','), cfg.sampleRow.map(escCsv).join(',')].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${moduleName}-template.csv"`);
      return res.send(csv);
    });

    // ── Import CSV ─────────────────────────────────────────────────────────
    app.post(`/api/ontology/${moduleName}/import`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
      try {
        const csvText: string = req.body?.csv ?? req.body?.data ?? '';
        if (!csvText || typeof csvText !== 'string') {
          return res.status(400).json({ error: 'Body must include { csv: "..." } with CSV text' });
        }

        const parsed = parseCsv(csvText);
        if (parsed.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

        const fileHeaders = parsed[0].map(h => h.toLowerCase().trim());
        const dataRows    = parsed.slice(1);

        // Validate that all required columns are present
        const missing = cfg.required.filter(r => !fileHeaders.includes(r));
        if (missing.length) {
          return res.status(400).json({ error: `Missing required columns: ${missing.join(', ')}` });
        }

        const results: { row: number; status: 'inserted' | 'updated' | 'error'; code?: string; error?: string }[] = [];
        let inserted = 0;
        let updated  = 0;

        for (let ri = 0; ri < dataRows.length; ri++) {
          const rawRow = dataRows[ri];
          if (rawRow.every(c => c === '')) continue; // skip blank rows

          // Build column→value map
          const colMap: Record<string, unknown> = {};
          fileHeaders.forEach((h, i) => {
            if (cfg.headers.includes(h)) {
              colMap[h] = coerceValue(h, rawRow[i] ?? '');
            }
          });

          // Required field check
          const rowMissing = cfg.required.filter(r => colMap[r] == null || colMap[r] === '');
          if (rowMissing.length) {
            results.push({ row: ri + 2, status: 'error', error: `Missing required: ${rowMissing.join(', ')}` });
            continue;
          }

          const cols   = Object.keys(colMap);
          const values = Object.values(colMap);

          try {
            // Check if row exists (for inserted/updated reporting)
            const { rows: [existing] } = await pool.query(
              `SELECT id FROM ${cfg.table} WHERE ${cfg.codeCol} = $1`,
              [colMap[cfg.codeCol]]
            );
            const sql = cfg.importInsert(cols);
            await pool.query(sql, values);
            const status = existing ? 'updated' : 'inserted';
            if (status === 'inserted') inserted++;
            else updated++;
            results.push({ row: ri + 2, status, code: String(colMap[cfg.codeCol] ?? '') });
          } catch (rowErr: unknown) {
            const msg = rowErr instanceof Error ? rowErr.message : 'DB error';
            results.push({ row: ri + 2, status: 'error', error: msg });
          }
        }

        void logAudit(pool, req, {
          action: 'import',
          entityType: moduleName,
          metadata: { inserted, updated, errors: results.filter(r => r.status === 'error').length },
        });

        return res.json({ inserted, updated, errors: results.filter(r => r.status === 'error'), results });
      } catch (err) {
        console.error(`[ontology-ie/${moduleName}] import error:`, err);
        return res.status(500).json({ error: 'Import failed' });
      }
    });
  }
}
