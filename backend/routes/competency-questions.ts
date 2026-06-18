/**
 * Competency Question Curation — DB-backed admin layer for the Competency
 * Assessment question bank. Replaces the static frontend bank.
 *
 * Public endpoints:
 *   GET  /api/competency/questions/select        — picks N questions for an attempt
 *
 * Admin endpoints (requireSuperAdmin):
 *   GET    /api/admin/competency-questions          — list + filters
 *   POST   /api/admin/competency-questions          — manual create
 *   PATCH  /api/admin/competency-questions/:id      — edit / change status
 *   DELETE /api/admin/competency-questions/:id      — hard delete
 *   POST   /api/admin/competency-questions/generate — produce N variant drafts
 *   GET    /api/admin/competency-questions/stats    — counts per status × domain
 *
 * Selection algorithm mirrors the legacy `assessmentSelector.ts` but reads
 * from `competency_question_templates WHERE status='approved'`:
 *   1) Affinity score = matches on role/industry/stage/function tags against
 *      a haystack built from the user's profile context. Tagged-but-unmatched
 *      items get a small mismatch penalty so generic items beat them.
 *   2) Per-domain pool, served-ID memory to skip repeats across attempts
 *      (caller passes `servedIds[]`).
 *   3) Tier-preserving rotation by `attempt` — rotates WITHIN equal-score
 *      tiers so high-affinity items stay at top.
 *   4) Domain order rotated by `attempt` so the "short slot" rotates across
 *      retakes (EIQ no longer always shortchanged).
 *   5) Round-robin interleave so the first 7 questions span all 7 competencies.
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';

type TemplateRow = {
  id: string;
  template_key: string;
  competency_code: string;
  question_type: string;
  template_body: {
    prompt?: string;
    options?: string[];
    best_option?: number;
    depth?: string;
    pool_key?: string;
    role_tags?: string[];
    industry_tags?: string[];
    stage_tags?: string[];
    function_tags?: string[];
    origin_id?: string;
  };
  difficulty_band: string;
  status: string;
  source: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
  created_at: string;
  notes: string | null;
};

const DOMAINS = ['COG', 'COM', 'LEA', 'EXE', 'ADP', 'TEC', 'EIQ'];
// Must mirror frontend `assessmentSelector.ts` DOMAIN_PREFIX_MAP + DOMAIN_LABEL_MAP
// so the API payload is interchangeable with the local `toAQ()` output. Drift here
// silently breaks scoring + domain colors on the client.
const DOMAIN_PREFIX_MAP: Record<string, string> = {
  COG: 'COG', COM: 'COM', LEA: 'LEA', EXE: 'EXE',
  ADP: 'ADA', // local catalog uses ADA for the Adaptability prefix
  TEC: 'TEC',
  EIQ: 'EMO', // local catalog uses EMO for the EI prefix
};
const DOMAIN_LABEL: Record<string, string> = {
  COG: 'Cognitive & Analytical',
  COM: 'Communication',
  LEA: 'Leadership & Initiative',
  EXE: 'Execution & Delivery',
  ADP: 'Adaptability & Growth',
  TEC: 'Technical & Domain',
  EIQ: 'Emotional & Social Intelligence',
};
function mapQuestionType(t: string): 'mcq' | 'sjt' | 'likert' {
  if (t === 'mcq') return 'mcq';
  if (t === 'sjt' || t === 'scenario' || t === 'case' || t === 'simulation' ||
      t === 'behavioral' || t === 'communication') return 'sjt';
  return 'likert';
}

function affinityScore(row: TemplateRow, ctx: {
  role?: string; industry?: string; stage?: string; department?: string; subDepartment?: string;
}): number {
  const body = row.template_body || {};
  const haystack = `${ctx.role || ''} ${ctx.industry || ''} ${ctx.stage || ''} ${ctx.department || ''} ${ctx.subDepartment || ''}`.toLowerCase();
  const matchAny = (tags?: string[]) => !!tags && tags.length > 0 && tags.some((t) => haystack.includes(t));
  const hasAny = (tags?: string[]) => !!tags && tags.length > 0;
  let s = 0;
  if (matchAny(body.role_tags))     s += 1.5;
  if (matchAny(body.industry_tags)) s += 1.0;
  if (matchAny(body.stage_tags))    s += 0.7;
  if (matchAny(body.function_tags)) s += 0.5;
  if (s === 0) {
    if (hasAny(body.role_tags))     s -= 0.4;
    if (hasAny(body.function_tags)) s -= 0.2;
    if (hasAny(body.industry_tags)) s -= 0.2;
  }
  return s;
}

// Emits the frontend `AQ` shape directly so the API payload drops straight into
// the renderer + `computeScoresFromSelected`. Extra `_domain` field carries the
// raw bank domain code (COG/COM/LEA/EXE/ADP/TEC/EIQ) so the client's served-ID
// memory can be keyed correctly (the AQ.code is prefix+ordinal, e.g. "COG01").
function rowToQuestion(row: TemplateRow, ordinalWithinDomain: number) {
  const body = row.template_body || {};
  const type = mapQuestionType(row.question_type);
  const best = body.best_option ?? -1;
  const hasAuthoredOptions = Array.isArray(body.options) && body.options.length > 0;
  const options = (type === 'likert' || !hasAuthoredOptions)
    ? [
        { label: 'Strongly Disagree', score: 0 },
        { label: 'Disagree', score: 25 },
        { label: 'Neutral', score: 50 },
        { label: 'Agree', score: 75 },
        { label: 'Strongly Agree', score: 100 },
      ]
    : (body.options || []).map((label, i) => {
        let score = 20;
        if (i === best) score = 100;
        else if (best >= 0 && Math.abs(i - best) === 1) score = 60;
        return { label, score };
      });
  const prefix = DOMAIN_PREFIX_MAP[row.competency_code] || row.competency_code;
  const domainLabel = DOMAIN_LABEL[row.competency_code] || row.competency_code;
  const originId = body.origin_id || row.template_key;
  return {
    id: `ad-${originId}`,
    code: `${prefix}${String(ordinalWithinDomain).padStart(2, '0')}`,
    competency: `${domainLabel} · ${row.difficulty_band}`,
    domain: domainLabel,
    type,
    text: body.prompt || '',
    options,
    // side-channel for client served-ID memory + admin tooling — extra props
    // are harmless on the frontend (TS structural typing).
    _domain: row.competency_code,
    _template_id: row.id,
    _origin_id: originId,
  };
}

function selectQuestions(rows: TemplateRow[], ctx: {
  role?: string; industry?: string; stage?: string; department?: string; subDepartment?: string;
}, total: number, attempt: number, servedIds: Set<string>) {
  const baseDomains = DOMAINS;
  const domShift = attempt % baseDomains.length;
  const domains = baseDomains.slice(domShift).concat(baseDomains.slice(0, domShift));
  const perDomain = Math.floor(total / domains.length);
  const extra = total - perDomain * domains.length;

  const usedIds = new Set<string>();
  const byDom: Record<string, ReturnType<typeof rowToQuestion>[]> = {};

  domains.forEach((dom, idx) => {
    const want = perDomain + (idx < extra ? 1 : 0);
    const pool = rows.filter((r) => r.competency_code === dom);
    if (pool.length === 0) return;

    let servedForDom = new Set(Array.from(servedIds).filter((id) => pool.some((p) => (p.template_body?.origin_id || p.template_key) === id)));
    if (pool.length - servedForDom.size < want) servedForDom = new Set();

    const scored = pool.map((r) => ({ r, score: affinityScore(r, ctx) }))
      .sort((a, b) => b.score - a.score);
    const fresh = scored.filter((s) => !servedForDom.has(s.r.template_body?.origin_id || s.r.template_key));
    const stale = scored.filter((s) =>  servedForDom.has(s.r.template_body?.origin_id || s.r.template_key));

    const tiers = new Map<number, typeof fresh>();
    for (const s of fresh) {
      const k = Math.round(s.score * 100) / 100;
      if (!tiers.has(k)) tiers.set(k, []);
      tiers.get(k)!.push(s);
    }
    const rotatedFresh: typeof fresh = [];
    const tierKeys = Array.from(tiers.keys()).sort((a, b) => b - a);
    for (const k of tierKeys) {
      const tier = tiers.get(k)!;
      if (tier.length <= 1) { rotatedFresh.push(...tier); continue; }
      const off = (attempt * Math.max(want, 1)) % tier.length;
      rotatedFresh.push(...tier.slice(off), ...tier.slice(0, off));
    }
    const ordered = rotatedFresh.concat(stale);

    const domPicks: ReturnType<typeof rowToQuestion>[] = [];
    let ordinal = 1;
    for (const s of ordered) {
      if (usedIds.has(s.r.id)) continue;
      domPicks.push(rowToQuestion(s.r, ordinal++));
      usedIds.add(s.r.id);
      if (ordinal - 1 >= want) break;
    }
    byDom[dom] = domPicks;
  });

  const picked: ReturnType<typeof rowToQuestion>[] = [];
  const maxLen = Math.max(0, ...domains.map((d) => byDom[d]?.length ?? 0));
  for (let i = 0; i < maxLen && picked.length < total; i += 1) {
    for (const d of domains) {
      const arr = byDom[d];
      if (arr && arr[i] && picked.length < total) picked.push(arr[i]);
    }
  }
  return picked.slice(0, total);
}

/* --------------------------------- generator -------------------------------- */
/**
 * Produce N variant drafts from existing approved questions. Variants are
 * deterministic transformations (no LLM): tag-broadening (drop role/function
 * tags → generalist), tag-narrowing (add common function tag), and difficulty
 * shift (clone as adjacent difficulty band). Admin reviews + edits before
 * promoting to status='approved'.
 */
async function generateDrafts(pool: Pool, n: number, competencyCode?: string): Promise<{ generated: number; ids: string[] }> {
  const seedFilter = competencyCode ? `AND competency_code = $2` : '';
  const seeds = await pool.query<TemplateRow>(
    `SELECT * FROM competency_question_templates
     WHERE status = 'approved' ${seedFilter}
     ORDER BY random() LIMIT $1`,
    competencyCode ? [Math.min(n, 60), competencyCode] : [Math.min(n, 60)],
  );
  if (seeds.rows.length === 0) return { generated: 0, ids: [] };

  const created: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const seed = seeds.rows[i % seeds.rows.length];
    const body = { ...(seed.template_body || {}) };
    const variantKind = ['generalist', 'rephrase', 'difficulty_shift'][i % 3];
    const body2: any = { ...body };

    if (variantKind === 'generalist') {
      body2.role_tags = [];
      body2.function_tags = [];
      body2.industry_tags = [];
      body2.prompt = `[Generalist] ${body.prompt || ''}`;
    } else if (variantKind === 'rephrase') {
      body2.prompt = `[Variant] ${body.prompt || ''}`;
    } else {
      body2.prompt = `[Stretch] ${body.prompt || ''}`;
    }
    delete body2.origin_id;

    const newDifficulty = variantKind === 'difficulty_shift'
      ? (seed.difficulty_band === 'easy' ? 'medium' : seed.difficulty_band === 'medium' ? 'hard' : 'medium')
      : seed.difficulty_band;
    const newKey = `gen-${seed.template_key}-${Date.now().toString(36)}-${i}`;
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO competency_question_templates
         (template_key, competency_code, question_type, template_body,
          difficulty_band, status, source, notes)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'draft', 'generated', $6)
       ON CONFLICT (template_key) DO NOTHING
       RETURNING id`,
      [newKey, seed.competency_code, seed.question_type, JSON.stringify(body2), newDifficulty, `Generated from ${seed.template_key} (${variantKind})`],
    );
    if (ins.rows[0]) created.push(ins.rows[0].id);
  }
  return { generated: created.length, ids: created };
}

/* ---------------------------------- routes ---------------------------------- */
export function registerCompetencyQuestionRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  // ---------- public selection endpoint ----------
  app.get('/api/competency/questions/select', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const total = Math.min(50, Math.max(1, parseInt(String(req.query.total || '20'), 10) || 20));
      const attempt = Math.max(0, parseInt(String(req.query.attempt || '0'), 10) || 0);
      // Accept both camelCase and snake_case for the served-IDs / sub-department
      // params so the wire contract is forgiving across naming conventions.
      const rawServed = String(req.query.served_ids || req.query.servedIds || '');
      const servedIds = new Set(rawServed.split(',').map((s) => s.trim()).filter(Boolean));
      const ctx = {
        role: String(req.query.role || ''),
        industry: String(req.query.industry || ''),
        stage: String(req.query.stage || ''),
        department: String(req.query.department || ''),
        subDepartment: String(req.query.sub_department || req.query.subDepartment || ''),
      };
      const rs = await pool.query<TemplateRow>(
        `SELECT * FROM competency_question_templates WHERE status = 'approved'`,
      );
      const questions = selectQuestions(rs.rows, ctx, total, attempt, servedIds);
      res.json({ ok: true, total: questions.length, attempt, questions, bank_size: rs.rows.length });
    } catch (e) { next(e); }
  });

  // ---------- admin list + stats ----------
  app.get('/api/admin/competency-questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status ? String(req.query.status) : null;
      const code   = req.query.competency_code ? String(req.query.competency_code) : null;
      const source = req.query.source ? String(req.query.source) : null;
      const search = req.query.search ? String(req.query.search).toLowerCase() : null;
      const limit  = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '200'), 10) || 200));

      const where: string[] = [];
      const args: any[] = [];
      if (status) { args.push(status); where.push(`status = $${args.length}`); }
      if (code)   { args.push(code);   where.push(`competency_code = $${args.length}`); }
      if (source) { args.push(source); where.push(`source = $${args.length}`); }
      if (search) { args.push(`%${search}%`); where.push(`LOWER(template_body->>'prompt') LIKE $${args.length}`); }
      const sql = `SELECT * FROM competency_question_templates ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY updated_at DESC LIMIT ${limit}`;
      const rs = await pool.query<TemplateRow>(sql, args);
      res.json({ ok: true, count: rs.rows.length, rows: rs.rows });
    } catch (e) { next(e); }
  });

  app.get('/api/admin/competency-questions/stats', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const stats = await pool.query(
        `SELECT competency_code, status, COUNT(*)::int AS n
         FROM competency_question_templates GROUP BY 1, 2 ORDER BY 1, 2`,
      );
      const total = await pool.query(`SELECT status, COUNT(*)::int AS n FROM competency_question_templates GROUP BY 1`);
      res.json({ ok: true, by_domain: stats.rows, totals: total.rows });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/competency-questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body || {};
      if (!b.competency_code || !b.question_type || !b.prompt) {
        return res.status(400).json({ ok: false, error: 'competency_code, question_type, prompt required' });
      }
      const tpl_key = b.template_key || `manual-${b.competency_code.toLowerCase()}-${Date.now().toString(36)}`;
      const body = {
        prompt: String(b.prompt),
        options: Array.isArray(b.options) ? b.options : [],
        best_option: typeof b.best_option === 'number' ? b.best_option : 0,
        depth: b.depth || 'standard',
        pool_key: b.pool_key || `${b.competency_code.toLowerCase()}_${b.question_type}_${b.difficulty_band || 'med'}`,
        role_tags: b.role_tags || [],
        industry_tags: b.industry_tags || [],
        stage_tags: b.stage_tags || [],
        function_tags: b.function_tags || [],
      };
      // Manual creates always land as draft — admins must explicitly promote to
      // 'approved' via PATCH after review. Prevents accidental skip-the-loop
      // when authoring directly in the panel.
      if (!DOMAINS.includes(b.competency_code)) {
        return res.status(400).json({ ok: false, error: 'invalid_competency_code', allowed: DOMAINS });
      }
      const opts = Array.isArray(body.options) ? body.options.filter((o) => typeof o === 'string' && o.trim().length > 0) : [];
      if (opts.length < 2) return res.status(400).json({ ok: false, error: 'need_at_least_2_options' });
      if (typeof body.best_option !== 'number' || body.best_option < 0 || body.best_option >= opts.length) {
        return res.status(400).json({ ok: false, error: 'best_option_out_of_range' });
      }
      body.options = opts;
      const rs = await pool.query(
        `INSERT INTO competency_question_templates
          (template_key, competency_code, question_type, template_body,
           difficulty_band, status, source, notes)
         VALUES ($1, $2, $3, $4::jsonb, $5, 'draft', 'manual', $6) RETURNING *`,
        [tpl_key, b.competency_code, b.question_type, JSON.stringify(body), b.difficulty_band || 'medium', b.notes || null],
      );
      res.json({ ok: true, row: rs.rows[0] });
    } catch (e) { next(e); }
  });

  app.patch('/api/admin/competency-questions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const b = req.body || {};
      const cur = await pool.query<TemplateRow>(`SELECT * FROM competency_question_templates WHERE id = $1`, [id]);
      if (cur.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });
      const row = cur.rows[0];
      const body = { ...(row.template_body || {}) };
      ['prompt', 'options', 'best_option', 'depth', 'role_tags', 'industry_tags', 'stage_tags', 'function_tags', 'pool_key'].forEach((k) => {
        if (b[k] !== undefined) (body as any)[k] = b[k];
      });
      const status = b.status ?? row.status;
      const allowedStatus = ['draft', 'approved', 'rejected', 'archived'];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ ok: false, error: 'invalid_status', allowed: allowedStatus });
      }
      if (b.competency_code && !DOMAINS.includes(b.competency_code)) {
        return res.status(400).json({ ok: false, error: 'invalid_competency_code', allowed: DOMAINS });
      }
      // Validate options/best_option coherence when either is edited.
      if (b.options !== undefined || b.best_option !== undefined) {
        const opts = Array.isArray(body.options) ? body.options.filter((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0) : [];
        if (opts.length < 2) return res.status(400).json({ ok: false, error: 'need_at_least_2_options' });
        const bo = typeof body.best_option === 'number' ? body.best_option : 0;
        if (bo < 0 || bo >= opts.length) return res.status(400).json({ ok: false, error: 'best_option_out_of_range' });
        body.options = opts;
        body.best_option = bo;
      }
      const reviewerId = (req as any).user?.id ?? (req as any).session?.userId ?? null;
      const rs = await pool.query(
        `UPDATE competency_question_templates SET
           competency_code = COALESCE($2, competency_code),
           question_type   = COALESCE($3, question_type),
           template_body   = $4::jsonb,
           difficulty_band = COALESCE($5, difficulty_band),
           status          = $6,
           reviewed_by     = CASE WHEN $6 IN ('approved','rejected') THEN COALESCE($7::text, reviewed_by) ELSE reviewed_by END,
           reviewed_at     = CASE WHEN $6 IN ('approved','rejected') THEN NOW() ELSE reviewed_at END,
           notes           = COALESCE($8, notes),
           updated_at      = NOW()
         WHERE id = $1 RETURNING *`,
        [id, b.competency_code || null, b.question_type || null, JSON.stringify(body), b.difficulty_band || null, status, reviewerId ? String(reviewerId) : null, b.notes ?? null],
      );
      res.json({ ok: true, row: rs.rows[0] });
    } catch (e) { next(e); }
  });

  app.delete('/api/admin/competency-questions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const rs = await pool.query(`DELETE FROM competency_question_templates WHERE id = $1 RETURNING id`, [id]);
      if (rs.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true, id });
    } catch (e) { next(e); }
  });

  app.post('/api/admin/competency-questions/generate', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const n = Math.min(50, Math.max(1, parseInt(String(req.body?.count || '10'), 10) || 10));
      const code = req.body?.competency_code ? String(req.body.competency_code) : undefined;
      const result = await generateDrafts(pool, n, code);
      res.json({ ok: true, ...result });
    } catch (e) { next(e); }
  });
}
