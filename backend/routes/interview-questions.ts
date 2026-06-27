/**
 * Interview Question Bank — CRUD API
 * ----------------------------------------------------------------------------
 * Backs the `interview-bank-admin` UI (`InterviewQuestionBankPage.tsx`). The
 * questions live in a DB table seeded from the authored static bank and are read
 * by the voice-screening engine, so admin edits actually affect screening.
 *
 * Auth: reads (GET list/stats) are requireAuth so employers and admins viewing the
 * page can load it. Mutations (POST/PUT/DELETE) are requireSuperAdmin because the
 * bank is a single shared (platform-wide) catalog read by every employer's voice
 * screening — only platform admins may curate it. Same model as the static bank it
 * seeds from; the page is reachable from both the employer portal and super-admin sitemap.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  listQuestions,
  getStats,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from '../services/interview-question-store';

type Middleware = (req: Request, res: Response, next: any) => void;

function actorId(req: Request): string | null {
  return (req.user as any)?.id ?? (req as any).orgId ?? null;
}

export function registerInterviewQuestionsRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Middleware,
  requireSuperAdmin: Middleware,
): void {
  // Literal /stats MUST be registered before the /:id param routes.
  app.get('/api/interview-questions/stats', requireAuth, async (_req: Request, res: Response) => {
    try {
      const stats = await getStats(pool);
      res.json({ success: true, ...stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'failed_to_load_stats' });
    }
  });

  app.get('/api/interview-questions', requireAuth, async (req: Request, res: Response) => {
    try {
      const active = String(req.query.active ?? 'true') === 'all' ? 'all' : 'true';
      const limit = Number(req.query.limit ?? 500);
      const questions = await listQuestions(pool, { active, limit: Number.isFinite(limit) ? limit : 500 });
      res.json({ success: true, questions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'failed_to_load_questions' });
    }
  });

  app.post('/api/interview-questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const q = await createQuestion(pool, req.body ?? {}, actorId(req));
      res.json({ success: true, question: q });
    } catch (err: any) {
      const msg = err?.message || 'failed_to_create';
      res.status(msg === 'question_required' ? 400 : 500).json({ success: false, error: msg });
    }
  });

  app.put('/api/interview-questions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const q = await updateQuestion(pool, req.params.id, req.body ?? {});
      if (!q) return res.status(404).json({ success: false, error: 'not_found' });
      res.json({ success: true, question: q });
    } catch (err: any) {
      const msg = err?.message || 'failed_to_update';
      res.status(msg === 'question_required' ? 400 : 500).json({ success: false, error: msg });
    }
  });

  app.delete('/api/interview-questions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const ok = await deleteQuestion(pool, req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: 'not_found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'failed_to_delete' });
    }
  });
}
