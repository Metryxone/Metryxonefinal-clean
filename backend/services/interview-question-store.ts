/**
 * Interview Question Store (DB-backed, admin-curatable)
 * ----------------------------------------------------------------------------
 * Persistent home for the interview question bank that the `interview-bank-admin`
 * UI manages (CRUD) and the voice-screening engine reads. The table is SEEDED
 * once from the authored static bank (`interview-question-bank.ts`) so it is never
 * empty and never fabricated — the seed rows preserve their `iqb-###` ids so any
 * questions already referenced by voice answers stay consistent.
 *
 * After seeding, this DB table is the single source of truth: admin edits are
 * persisted here AND consumed by the screener (`selectScreeningQuestions`), with a
 * graceful fallback to the static bank if the store is empty or errors.
 */
import type { Pool } from 'pg';
import { getQuestionBank, selectQuestions, dimensionForCategory, type BankQuestion } from './interview-question-bank';

export interface ApiQuestion {
  id: string;
  question: string;
  expectedResponse: string | null;
  scoringCriteria: string | null;
  category: string;
  industry: string;
  role: string;
  positionLevel: string;
  difficulty: string;
  dimension: string;
  isActive: boolean;
  tags: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScreeningQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: string;
  dimension: string;
  expectedResponse: string;
  scoringCriteria: string;
}

let schemaPromise: Promise<void> | null = null;

export function ensureInterviewQuestionSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS interview_questions (
          id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          question          TEXT NOT NULL,
          expected_response TEXT,
          scoring_criteria  TEXT,
          category          TEXT NOT NULL DEFAULT 'Behavioral',
          industry          TEXT NOT NULL DEFAULT 'General',
          role              TEXT NOT NULL DEFAULT 'General',
          position_level    TEXT NOT NULL DEFAULT 'Any',
          difficulty        TEXT NOT NULL DEFAULT 'Medium',
          dimension         TEXT NOT NULL DEFAULT 'communication_clarity',
          is_active         BOOLEAN NOT NULL DEFAULT true,
          tags              TEXT[] NOT NULL DEFAULT '{}',
          created_by        TEXT,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_iq_active   ON interview_questions(is_active);
        CREATE INDEX IF NOT EXISTS idx_iq_role     ON interview_questions(role);
        CREATE INDEX IF NOT EXISTS idx_iq_industry ON interview_questions(industry);
      `);
      // Idempotent seed-if-empty from the authored static bank (never fabricated).
      const { rows } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM interview_questions`);
      if (Number(rows[0]?.n ?? '0') === 0) {
        const bank: BankQuestion[] = getQuestionBank();
        for (const b of bank) {
          await pool.query(
            `INSERT INTO interview_questions
               (id, question, expected_response, scoring_criteria, category, industry, role, position_level, difficulty, dimension, is_active, tags, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,'system')
             ON CONFLICT (id) DO NOTHING`,
            [
              b.id, b.question, b.expectedResponse, b.scoringCriteria, b.category,
              b.industry, b.role, b.positionLevel, b.difficulty,
              b.dimension || dimensionForCategory(b.category), b.tags ?? [],
            ],
          );
        }
      }
    })().catch((err) => {
      // Reset so a later call can retry; surface the error to the caller.
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

function rowToApi(r: any): ApiQuestion {
  return {
    id: r.id,
    question: r.question,
    expectedResponse: r.expected_response ?? null,
    scoringCriteria: r.scoring_criteria ?? null,
    category: r.category,
    industry: r.industry,
    role: r.role,
    positionLevel: r.position_level,
    difficulty: r.difficulty,
    dimension: r.dimension,
    isActive: !!r.is_active,
    tags: Array.isArray(r.tags) ? r.tags : [],
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listQuestions(
  pool: Pool,
  opts: { active?: 'true' | 'all'; limit?: number } = {},
): Promise<ApiQuestion[]> {
  await ensureInterviewQuestionSchema(pool);
  const limit = Math.max(1, Math.min(1000, opts.limit ?? 500));
  const where = opts.active === 'all' ? '' : 'WHERE is_active = true';
  const { rows } = await pool.query(
    `SELECT * FROM interview_questions ${where} ORDER BY created_at ASC, id ASC LIMIT $1`,
    [limit],
  );
  return rows.map(rowToApi);
}

export async function getStats(pool: Pool): Promise<{
  total: number;
  active: number;
  industries: string[];
  roles: string[];
  byCategory: Record<string, number>;
  byIndustry: Record<string, number>;
  byLevel: Record<string, number>;
}> {
  await ensureInterviewQuestionSchema(pool);
  const { rows } = await pool.query(
    `SELECT category, industry, role, position_level, is_active FROM interview_questions`,
  );
  const byCategory: Record<string, number> = {};
  const byIndustry: Record<string, number> = {};
  const byLevel: Record<string, number> = {};
  const industries = new Set<string>();
  const roles = new Set<string>();
  let active = 0;
  for (const r of rows) {
    if (r.is_active) active += 1;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    byIndustry[r.industry] = (byIndustry[r.industry] ?? 0) + 1;
    byLevel[r.position_level] = (byLevel[r.position_level] ?? 0) + 1;
    industries.add(r.industry);
    roles.add(r.role);
  }
  return {
    total: rows.length,
    active,
    industries: [...industries].sort(),
    roles: [...roles].sort(),
    byCategory,
    byIndustry,
    byLevel,
  };
}

const STR = (v: any): string | null => (v === undefined || v === null ? null : String(v));

export async function createQuestion(
  pool: Pool,
  data: any,
  createdBy: string | null,
): Promise<ApiQuestion> {
  await ensureInterviewQuestionSchema(pool);
  const question = String(data?.question ?? '').trim();
  if (!question) throw new Error('question_required');
  const category = String(data?.category ?? 'Behavioral');
  const tags = Array.isArray(data?.tags) ? data.tags.map((t: any) => String(t)) : [];
  const { rows } = await pool.query(
    `INSERT INTO interview_questions
       (question, expected_response, scoring_criteria, category, industry, role, position_level, difficulty, dimension, is_active, tags, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      question,
      STR(data?.expectedResponse),
      STR(data?.scoringCriteria),
      category,
      String(data?.industry ?? 'General'),
      String(data?.role ?? 'General'),
      String(data?.positionLevel ?? 'Any'),
      String(data?.difficulty ?? 'Medium'),
      dimensionForCategory(category),
      data?.isActive === undefined ? true : !!data.isActive,
      tags,
      createdBy,
    ],
  );
  return rowToApi(rows[0]);
}

export async function updateQuestion(pool: Pool, id: string, data: any): Promise<ApiQuestion | null> {
  await ensureInterviewQuestionSchema(pool);
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  const push = (col: string, val: any) => { sets.push(`${col} = $${i++}`); vals.push(val); };

  if (data?.question !== undefined) {
    const q = String(data.question).trim();
    if (!q) throw new Error('question_required');
    push('question', q);
  }
  if (data?.expectedResponse !== undefined) push('expected_response', STR(data.expectedResponse));
  if (data?.scoringCriteria !== undefined) push('scoring_criteria', STR(data.scoringCriteria));
  if (data?.category !== undefined) {
    const category = String(data.category);
    push('category', category);
    push('dimension', dimensionForCategory(category));
  }
  if (data?.industry !== undefined) push('industry', String(data.industry));
  if (data?.role !== undefined) push('role', String(data.role));
  if (data?.positionLevel !== undefined) push('position_level', String(data.positionLevel));
  if (data?.difficulty !== undefined) push('difficulty', String(data.difficulty));
  if (data?.isActive !== undefined) push('is_active', !!data.isActive);
  if (data?.tags !== undefined) push('tags', Array.isArray(data.tags) ? data.tags.map((t: any) => String(t)) : []);

  if (sets.length === 0) {
    const { rows } = await pool.query(`SELECT * FROM interview_questions WHERE id = $1`, [id]);
    return rows[0] ? rowToApi(rows[0]) : null;
  }
  sets.push(`updated_at = now()`);
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE interview_questions SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals,
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function deleteQuestion(pool: Pool, id: string): Promise<boolean> {
  await ensureInterviewQuestionSchema(pool);
  const { rowCount } = await pool.query(`DELETE FROM interview_questions WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * DB-backed selection mirroring the static `selectQuestions` tiers (role-specific →
 * industry → General → any), restricted to active rows. Falls back to the authored
 * static bank when the store is empty or unavailable so screening never breaks.
 */
export async function selectScreeningQuestions(
  pool: Pool,
  opts: { role?: string; industry?: string; level?: string; limit?: number } = {},
): Promise<ScreeningQuestion[]> {
  const limit = Math.max(1, Math.min(20, opts.limit ?? 8));
  const toScreening = (q: BankQuestion): ScreeningQuestion => ({
    id: q.id,
    question: q.question,
    category: q.category,
    difficulty: q.difficulty,
    dimension: q.dimension || dimensionForCategory(q.category),
    expectedResponse: q.expectedResponse,
    scoringCriteria: q.scoringCriteria,
  });
  try {
    await ensureInterviewQuestionSchema(pool);
    const { rows } = await pool.query(`SELECT * FROM interview_questions WHERE is_active = true`);
    if (rows.length === 0) return selectQuestions(opts).map(toScreening);

    const bank: BankQuestion[] = rows.map((r) => ({
      id: r.id,
      question: r.question,
      expectedResponse: r.expected_response ?? '',
      scoringCriteria: r.scoring_criteria ?? '',
      category: r.category,
      industry: r.industry,
      role: r.role,
      positionLevel: r.position_level,
      difficulty: r.difficulty,
      dimension: r.dimension || dimensionForCategory(r.category),
      tags: Array.isArray(r.tags) ? r.tags : [],
    }));

    const role = norm(opts.role || '');
    const industry = norm(opts.industry || '');
    const level = norm(opts.level || '');
    const levelOk = (q: BankQuestion) =>
      !level || level === 'all' || norm(q.positionLevel) === level || norm(q.positionLevel) === 'any';
    const roleOk = (q: BankQuestion) => !role || norm(q.role) === role || norm(q.role) === 'general';
    const industryOk = (q: BankQuestion) =>
      !industry || norm(q.industry) === industry || norm(q.industry) === 'general';

    const specific = bank.filter((q) => role && norm(q.role) === role && industryOk(q) && levelOk(q));
    const byIndustry = bank.filter(
      (q) => industry && norm(q.industry) === industry && norm(q.industry) !== 'general' && levelOk(q),
    );
    const general = bank.filter((q) => roleOk(q) && industryOk(q) && levelOk(q) && norm(q.role) === 'general');

    const seen = new Set<string>();
    const out: ScreeningQuestion[] = [];
    for (const pool2 of [specific, byIndustry, general, bank]) {
      for (const q of pool2) {
        if (out.length >= limit) break;
        if (seen.has(q.id)) continue;
        seen.add(q.id);
        out.push(toScreening(q));
      }
      if (out.length >= limit) break;
    }
    return out.slice(0, limit);
  } catch {
    return selectQuestions(opts).map(toScreening);
  }
}
