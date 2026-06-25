/**
 * Recruiter Postings — candidate-facing public read of employer-posted jobs.
 *
 * Exposes:
 *   GET /api/career/recruiter-postings  — list active job postings
 *                                         (employer_jobs table, status='active')
 *
 * Storage is opportunistic: if the employer_jobs table does not yet exist,
 * the endpoint returns an empty list instead of failing. The frontend
 * (FitmentInsightsPanel) falls back to demand-driven MARKET_CATALOG roles
 * when this list is empty.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSION = '1.0.0';

let tableEnsured = false;
async function ensureTable(pool: Pool) {
  if (tableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employer_jobs (
      id            TEXT PRIMARY KEY,
      employer_id   TEXT,
      title         TEXT NOT NULL,
      department    TEXT,
      location      TEXT,
      type          TEXT,
      work_mode     TEXT,
      experience    TEXT,
      salary        TEXT,
      description   TEXT,
      skills        JSONB DEFAULT '[]'::jsonb,
      requirements  JSONB DEFAULT '[]'::jsonb,
      ei_min_score  INTEGER DEFAULT 0,
      status        TEXT DEFAULT 'active',
      created_at    TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_employer_jobs_status ON employer_jobs(status);
  `);
  // `employer_jobs` is owned by SEVERAL modules with DIVERGENT shapes
  // (employer-portal authoring, MX-103W projection, this module). When the
  // table already exists from another writer, the CREATE above is a no-op and
  // could leave it WITHOUT the descriptive columns this module SELECTs — the
  // read then throws and is swallowed into a silent empty `no_data` list.
  // Reconcile the divergent table additively so the recruiter read path is
  // self-sufficient regardless of which module created it first.
  // (see .agents/memory/employer-job-store-projection.md)
  await pool.query(`
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS department   TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS location     TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS type         TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS work_mode    TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS experience   TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS salary       TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS description  TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS skills       JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS ei_min_score INTEGER DEFAULT 0;
  `);
  tableEnsured = true;
}

export function registerRecruiterPostingsRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequireAuth,
) {
  // GET /api/career/recruiter-postings — candidate-readable list
  app.get('/api/career/recruiter-postings', requireAuth, async (_req: Request, res: Response) => {
    try {
      await ensureTable(pool);
      const rows = await pool.query(
        `SELECT id, title, department, location, type, work_mode, experience,
                salary, description, skills, requirements, ei_min_score, created_at
           FROM employer_jobs
          WHERE status = 'active'
          ORDER BY created_at DESC
          LIMIT 50`,
      );
      const postings = rows.rows.map(r => ({
        _id: r.id,
        title: r.title,
        department: r.department || '',
        location: r.location || '',
        type: r.type || '',
        workMode: r.work_mode || '',
        experience: r.experience || '',
        salary: r.salary || '',
        description: r.description || '',
        skills: Array.isArray(r.skills) ? r.skills : [],
        requirements: Array.isArray(r.requirements) ? r.requirements : [],
        eiMinScore: r.ei_min_score || 0,
        createdAt: r.created_at,
      }));
      res.json({ success: true, version: VERSION, postings });
    } catch (e: any) {
      // Graceful fallback — never break the candidate UI
      console.error('[recruiter-postings] read failed:', e?.message);
      res.json({ success: true, version: VERSION, postings: [], note: 'no_data' });
    }
  });
}
