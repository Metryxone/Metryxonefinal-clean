/**
 * MX-302F — Resume, Portfolio & Interview Studio routes.
 *
 * A NET-NEW consolidated student employability surface over a small net-new
 * substrate (resume versions, structured portfolio entries, interview attempts)
 * PLUS AI-backed analyzers that degrade HONESTLY when no LLM key is configured.
 *
 * Strictly additive + reversible + flag-gated (`employabilityStudio`,
 * FF_EMPLOYABILITY_STUDIO, default OFF):
 *   - OFF → every DATA route 503s BEFORE any auth/DB/DDL touch → byte-identical
 *     legacy behaviour (the ensure-schema is never reached, so no new tables).
 *   - `/enabled` is UNGATED (platform convention): always 200 `{enabled:<flag>}`.
 *
 * Honesty:
 *   - Every AI endpoint tries aiClient first; on AIServiceUnavailableError it
 *     returns the rule-based fallback tagged `source:'rule-based'` + `aiAvailable:false`.
 *     Static content is NEVER labelled as AI.
 *   - null ≠ 0: unscorable answers return score null, not 0.
 *   - All rows are USER-SCOPED (IDOR-safe: user_id = the session user only).
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { isFlagEnabled } from '../config/feature-flags';
import {
  ensureEmployabilityStudioSchema,
  employabilityStudioTablesReady,
} from '../services/employability-studio-schema';
import {
  analyzeResumeRuleBased,
  reviewLinkedInRuleBased,
  interviewFeedbackRuleBased,
  scoreCodingMcqs,
  CODING_MCQS,
  CODING_SELF_REVIEW_PROMPTS,
  GROUP_DISCUSSION_TOPICS,
  GROUP_DISCUSSION_SELF_REVIEW_DIMENSIONS,
  INTERVIEW_QUESTION_BANK,
  INTERVIEW_QUESTION_CATEGORIES,
} from '../services/employability-studio-engine';
import { chatJSON, AIServiceUnavailableError, checkAIHealth } from '../services/aiClient';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('employabilityStudio')) {
    return res.status(503).json({ ok: false, error: 'employability_studio_disabled' });
  }
  next();
}

const uid = (req: Request): string | null => {
  const u = (req as any).user;
  return u && u.id != null ? String(u.id) : null;
};

export function registerEmployabilityStudioRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
): void {
  const base = '/api/employability-studio';

  // ── Flag probe — UNGATED (always 200 with flag state so the UI hides the tab). ──
  app.get(`${base}/enabled`, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: isFlagEnabled('employabilityStudio') });
  });

  // ── AI availability probe — honest "AI unavailable / rule-based" UI state. ──
  app.get(`${base}/ai-status`, flagGate, requireAuth, async (_req: Request, res: Response) => {
    const health = await checkAIHealth().catch(() => ({ ok: false, reason: 'health check failed' }));
    res.json({ ok: true, aiAvailable: !!health.ok, reason: health.ok ? null : (health as any).reason || 'AI not configured' });
  });

  // ════════════════════ RESUME STUDIO ════════════════════

  // List resume versions (user-scoped).
  app.get(`${base}/resume-versions`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    if (!(await employabilityStudioTablesReady(pool))) return res.json({ ok: true, versions: [] });
    try {
      const { rows } = await pool.query(
        `SELECT id, label, data, is_primary, source, created_at, updated_at
           FROM career_resume_versions WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId],
      );
      res.json({ ok: true, versions: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'read_failed' });
    }
  });

  // Create a resume version.
  app.post(`${base}/resume-versions`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { label, data, source } = req.body || {};
    if (!data || typeof data !== 'object') return res.status(400).json({ ok: false, error: 'data_required' });
    try {
      await ensureEmployabilityStudioSchema(pool);
      const id = randomUUID();
      const { rows } = await pool.query(
        `INSERT INTO career_resume_versions (id, user_id, label, data, source)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         RETURNING id, label, data, is_primary, source, created_at, updated_at`,
        [id, userId, String(label || 'Untitled').slice(0, 120), JSON.stringify(data), source === 'imported-local' ? 'imported-local' : 'manual'],
      );
      res.json({ ok: true, version: rows[0] });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'create_failed' });
    }
  });

  // Update a resume version (label / data / is_primary). IDOR-guarded by user_id.
  app.put(`${base}/resume-versions/:id`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { label, data, isPrimary } = req.body || {};
    try {
      await ensureEmployabilityStudioSchema(pool);
      if (isPrimary === true) {
        // Only one primary per user.
        await pool.query(`UPDATE career_resume_versions SET is_primary = false WHERE user_id = $1`, [userId]);
      }
      const { rows } = await pool.query(
        `UPDATE career_resume_versions
            SET label = COALESCE($3, label),
                data = COALESCE($4::jsonb, data),
                is_primary = COALESCE($5, is_primary),
                updated_at = now()
          WHERE id = $1 AND user_id = $2
        RETURNING id, label, data, is_primary, source, created_at, updated_at`,
        [
          req.params.id, userId,
          label != null ? String(label).slice(0, 120) : null,
          data != null ? JSON.stringify(data) : null,
          typeof isPrimary === 'boolean' ? isPrimary : null,
        ],
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, version: rows[0] });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'update_failed' });
    }
  });

  // Delete a resume version. IDOR-guarded.
  app.delete(`${base}/resume-versions/:id`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    try {
      await ensureEmployabilityStudioSchema(pool);
      const r = await pool.query(`DELETE FROM career_resume_versions WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
      res.json({ ok: true, deleted: r.rowCount || 0 });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'delete_failed' });
    }
  });

  // Resume analyzer — LLM critique with honest rule-based fallback.
  app.post(`${base}/resume/analyze`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const resume = req.body?.resume;
    if (!resume || typeof resume !== 'object') return res.status(400).json({ ok: false, error: 'resume_required' });
    // Rule-based result is computed regardless (used as fallback + as a structural base).
    const ruleBased = analyzeResumeRuleBased(resume);
    try {
      const ai = await chatJSON({
        system: 'You are an expert technical resume reviewer. Critique the resume JSON for impact verbs, quantification, clarity, and gaps. Return STRICT JSON: {"summary":string,"strengths":string[],"improvements":string[],"rewrittenBullets":[{"before":string,"after":string}]}. Be specific and honest; never invent achievements the resume does not contain.',
        user: JSON.stringify(resume).slice(0, 8000),
        max_tokens: 900,
      });
      return res.json({ ok: true, aiAvailable: true, source: 'ai', analysis: ai, ruleBased });
    } catch (e: any) {
      if (e instanceof AIServiceUnavailableError) {
        return res.json({ ok: true, aiAvailable: false, source: 'rule-based', analysis: ruleBased, reason: e.detail });
      }
      return res.status(500).json({ ok: false, error: e?.message || 'analyze_failed' });
    }
  });

  // AI bullet suggestions — real LLM; on no key signals aiAvailable:false so the
  // frontend falls back to the LABELLED static AIBulletPicker library.
  app.post(`${base}/resume/suggest-bullets`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { role, context } = req.body || {};
    if (!role) return res.status(400).json({ ok: false, error: 'role_required' });
    try {
      const ai = await chatJSON({
        system: 'You write strong, quantified resume bullet points. Return STRICT JSON: {"bullets":string[]} with 5 achievement-oriented bullets that start with an action verb and include a placeholder metric where relevant. Tailor to the given role/context.',
        user: JSON.stringify({ role, context: String(context || '').slice(0, 1500) }),
        max_tokens: 500,
      });
      const bullets = Array.isArray(ai?.bullets) ? ai.bullets.slice(0, 8) : [];
      return res.json({ ok: true, aiAvailable: true, source: 'ai', bullets });
    } catch (e: any) {
      if (e instanceof AIServiceUnavailableError) {
        // Honest fallback: tell the client to use the static library (labelled).
        return res.json({ ok: true, aiAvailable: false, source: 'static-library', bullets: [], reason: e.detail, note: 'AI unavailable — use the built-in template library (static suggestions, not AI-generated).' });
      }
      return res.status(500).json({ ok: false, error: e?.message || 'suggest_failed' });
    }
  });

  // LinkedIn review — LLM with honest rule-based checklist fallback.
  app.post(`${base}/linkedin/review`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const input = req.body?.profile || {};
    const ruleBased = reviewLinkedInRuleBased(input);
    try {
      const ai = await chatJSON({
        system: 'You are a LinkedIn profile optimisation coach. Review the provided profile fields and return STRICT JSON: {"headlineSuggestion":string,"aboutFeedback":string,"improvements":string[]}. Base feedback only on the fields provided; do not invent experience.',
        user: JSON.stringify(input).slice(0, 4000),
        max_tokens: 700,
      });
      return res.json({ ok: true, aiAvailable: true, source: 'ai', review: ai, ruleBased });
    } catch (e: any) {
      if (e instanceof AIServiceUnavailableError) {
        return res.json({ ok: true, aiAvailable: false, source: 'rule-based', review: ruleBased, reason: e.detail });
      }
      return res.status(500).json({ ok: false, error: e?.message || 'review_failed' });
    }
  });

  // ════════════════════ PORTFOLIO STUDIO (research / publications) ════════════════════

  // List structured portfolio entries (optionally filtered by kind).
  app.get(`${base}/portfolio`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    if (!(await employabilityStudioTablesReady(pool))) return res.json({ ok: true, entries: [] });
    const kind = req.query.kind ? String(req.query.kind) : null;
    try {
      const { rows } = kind
        ? await pool.query(`SELECT * FROM career_portfolio_entries WHERE user_id = $1 AND kind = $2 ORDER BY COALESCE(published_on, created_at::date) DESC`, [userId, kind])
        : await pool.query(`SELECT * FROM career_portfolio_entries WHERE user_id = $1 ORDER BY COALESCE(published_on, created_at::date) DESC`, [userId]);
      res.json({ ok: true, entries: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'read_failed' });
    }
  });

  // Create a portfolio entry.
  app.post(`${base}/portfolio`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const b = req.body || {};
    if (b.kind !== 'research' && b.kind !== 'publication') return res.status(400).json({ ok: false, error: 'kind_must_be_research_or_publication' });
    if (!b.title || !String(b.title).trim()) return res.status(400).json({ ok: false, error: 'title_required' });
    try {
      await ensureEmployabilityStudioSchema(pool);
      const id = randomUUID();
      const { rows } = await pool.query(
        `INSERT INTO career_portfolio_entries
           (id, user_id, kind, title, authors, venue, role, abstract, link, doi, status, published_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          id, userId, b.kind, String(b.title).slice(0, 300),
          b.authors || null, b.venue || null, b.role || null, b.abstract || null,
          b.link || null, b.doi || null, b.status || 'published',
          b.publishedOn ? String(b.publishedOn) : null,
        ],
      );
      res.json({ ok: true, entry: rows[0] });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'create_failed' });
    }
  });

  // Update a portfolio entry. IDOR-guarded.
  app.put(`${base}/portfolio/:id`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const b = req.body || {};
    try {
      await ensureEmployabilityStudioSchema(pool);
      const { rows } = await pool.query(
        `UPDATE career_portfolio_entries SET
            title = COALESCE($3, title),
            authors = $4, venue = $5, role = $6, abstract = $7, link = $8, doi = $9,
            status = COALESCE($10, status),
            published_on = $11,
            updated_at = now()
          WHERE id = $1 AND user_id = $2
        RETURNING *`,
        [
          req.params.id, userId,
          b.title != null ? String(b.title).slice(0, 300) : null,
          b.authors ?? null, b.venue ?? null, b.role ?? null, b.abstract ?? null,
          b.link ?? null, b.doi ?? null, b.status ?? null,
          b.publishedOn ? String(b.publishedOn) : null,
        ],
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, entry: rows[0] });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'update_failed' });
    }
  });

  // Delete a portfolio entry. IDOR-guarded.
  app.delete(`${base}/portfolio/:id`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    try {
      await ensureEmployabilityStudioSchema(pool);
      const r = await pool.query(`DELETE FROM career_portfolio_entries WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
      res.json({ ok: true, deleted: r.rowCount || 0 });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'delete_failed' });
    }
  });

  // ════════════════════ INTERVIEW STUDIO ════════════════════

  // Curated coding assessment questions (MCQ + self-review prompts). No sandbox.
  app.get(`${base}/coding-questions`, flagGate, requireAuth, async (_req: Request, res: Response) => {
    // Strip the answer key from the payload so the client cannot read answers.
    const mcqs = CODING_MCQS.map(({ answerIndex, explanation, ...rest }) => rest);
    res.json({
      ok: true,
      mcqs,
      selfReviewPrompts: CODING_SELF_REVIEW_PROMPTS,
      note: 'Curated knowledge check — there is no code-execution sandbox. MCQs test fundamentals; self-review is for reflection (not auto-graded).',
    });
  });

  // Submit MCQ answers; score the MCQ portion and (optionally) record the attempt.
  app.post(`${base}/coding-assessment/submit`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const answers = (req.body?.answers && typeof req.body.answers === 'object') ? req.body.answers : {};
    const selfReview = req.body?.selfReview ?? null;
    const result = scoreCodingMcqs(answers);
    try {
      await ensureEmployabilityStudioSchema(pool);
      await pool.query(
        `INSERT INTO employability_interview_attempts
           (id, user_id, mode, reference_id, question, answer, score, max_score, self_review)
         VALUES ($1,$2,'coding',NULL,'Coding assessment (MCQ)',$3,$4,100,$5::jsonb)`,
        [randomUUID(), userId, JSON.stringify(answers), result.score, selfReview ? JSON.stringify(selfReview) : null],
      );
    } catch { /* recording is best-effort; scoring still returns */ }
    res.json({ ok: true, result });
  });

  // Curated group-discussion topics + self-review scaffold.
  app.get(`${base}/group-discussion/topics`, flagGate, requireAuth, async (_req: Request, res: Response) => {
    res.json({ ok: true, topics: GROUP_DISCUSSION_TOPICS, selfReviewDimensions: GROUP_DISCUSSION_SELF_REVIEW_DIMENSIONS });
  });

  // Curated interview question bank (HR / Technical / Behavioural) for the Q&A
  // practice flow. Static curated prompts — explicitly NOT AI-generated.
  app.get(`${base}/interview/questions`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const cat = req.query.category ? String(req.query.category) : null;
    const questions = cat ? INTERVIEW_QUESTION_BANK.filter((q) => q.category === cat) : INTERVIEW_QUESTION_BANK;
    res.json({
      ok: true,
      source: 'static-library',
      categories: INTERVIEW_QUESTION_CATEGORIES,
      questions,
      note: 'Curated practice questions (static library — not AI-generated). Answer them in the practice box to get feedback.',
    });
  });

  // AI feedback on a free-form interview answer — LLM with deterministic fallback.
  app.post(`${base}/interview/feedback`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { question, answer, mode, referenceId } = req.body || {};
    if (!answer || !String(answer).trim()) return res.status(400).json({ ok: false, error: 'answer_required' });
    const q = String(question || '').slice(0, 1000);
    const a = String(answer).slice(0, 6000);
    const ruleBased = interviewFeedbackRuleBased(q, a);

    let source: 'ai' | 'rule-based' = 'rule-based';
    let feedback: any = ruleBased;
    let aiAvailable = false;
    try {
      const ai = await chatJSON({
        system: 'You are an interview coach. Evaluate the candidate answer to the question. Return STRICT JSON: {"score":number(0-100),"strengths":string[],"improvements":string[],"modelAnswerOutline":string}. Be honest and specific; if the answer is too short to evaluate, set score to null.',
        user: JSON.stringify({ question: q, answer: a }),
        max_tokens: 700,
      });
      source = 'ai';
      feedback = ai;
      aiAvailable = true;
    } catch (e: any) {
      if (!(e instanceof AIServiceUnavailableError)) {
        return res.status(500).json({ ok: false, error: e?.message || 'feedback_failed' });
      }
    }

    // Best-effort record the attempt + feedback (honest source tag).
    try {
      await ensureEmployabilityStudioSchema(pool);
      const score = (source === 'ai' && typeof feedback?.score === 'number') ? feedback.score
        : (source === 'rule-based' ? ruleBased.score : null);
      await pool.query(
        `INSERT INTO employability_interview_attempts
           (id, user_id, mode, reference_id, question, answer, score, max_score, ai_feedback, ai_feedback_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,100,$8,$9)`,
        [randomUUID(), userId, (mode === 'group-discussion' ? 'group-discussion' : 'qa'), referenceId || null, q, a, score, JSON.stringify(feedback), source],
      );
    } catch { /* best-effort */ }

    res.json({ ok: true, aiAvailable, source, feedback });
  });

  // Recent interview attempts (history; user-scoped).
  app.get(`${base}/interview/attempts`, flagGate, requireAuth, async (req: Request, res: Response) => {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    if (!(await employabilityStudioTablesReady(pool))) return res.json({ ok: true, attempts: [] });
    try {
      const { rows } = await pool.query(
        `SELECT id, mode, reference_id, question, score, max_score, ai_feedback_source, created_at
           FROM employability_interview_attempts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [userId],
      );
      res.json({ ok: true, attempts: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'read_failed' });
    }
  });
}
