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
import { ensureEmployerJobsSchema } from '../services/employer-jobs-schema';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSION = '1.0.0';

// `employer_jobs` is a shared table owned by SEVERAL modules (employer-portal
// authoring, MX-103W projection, this recruiter read). Its canonical schema —
// the base table plus every descriptive column the read below reads back — is
// defined once in services/employer-jobs-schema.ts so no module can reintroduce
// schema drift. Previously each module maintained its own CREATE/ALTER and a
// divergent table silently dropped the columns this read needs (the read then
// threw and was swallowed into an empty `no_data` list). See
// .agents/memory/employer-job-store-projection.md.
async function ensureTable(pool: Pool) {
  await ensureEmployerJobsSchema(pool);
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
      // Distinguish a genuine empty list from a read failure so the candidate
      // UI can tell "no jobs yet" apart from "couldn't load jobs".
      res.json({
        success: true,
        version: VERSION,
        postings,
        note: postings.length === 0 ? 'no_data' : undefined,
      });
    } catch (e: any) {
      // Graceful fallback — never break the candidate UI — but be HONEST that
      // this is a failure, not an empty list. Operators can alert on this log
      // line and the frontend surfaces a distinct "couldn't load" state.
      console.error(
        '[recruiter-postings] read failed — returning unavailable:',
        e?.message,
        e?.code ? `(code=${e.code})` : '',
        e?.stack,
      );
      res
        .status(503)
        .json({ success: false, version: VERSION, postings: [], note: 'unavailable' });
    }
  });
}
