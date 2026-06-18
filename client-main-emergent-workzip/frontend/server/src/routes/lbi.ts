import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool, query } from '../db/client.js';
import { db } from '../db/drizzle.js';
import {
  lbiModules, lbiSessions, lbiDomains, lbiAgeBands, lbiQuestions,
  studentSubscriptions, customModuleSessions, customAssessmentModules,
} from '../db/schema.js';
import { eq, and, or, desc, asc, sql, inArray, isNull, count, countDistinct } from 'drizzle-orm';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { ExamReadyQuestion } from '../models/examReadyQuestion.js';
import { rowToSnake, rowsToSnake } from '../db/utils.js';
import { trigger as scenarioTrigger } from '../notifications/scenarioEngine.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper: convert Drizzle camelCase domain row to snake_case for frontend
function domainToSnake(r: any) {
  return {
    id: r.id, domain_code: r.domainCode ?? r.domain_code, domain_name: r.domainName ?? r.domain_name,
    description: r.description, sort_order: r.sortOrder ?? r.sort_order, is_active: r.isActive ?? r.is_active,
    created_at: r.createdAt ?? r.created_at,
  };
}

const router = Router();
router.use(requireAuth);

const LIKERT_OPTIONS = [
  { key: 'A', text: 'Strongly Disagree' },
  { key: 'B', text: 'Disagree' },
  { key: 'C', text: 'Neutral' },
  { key: 'D', text: 'Agree' },
  { key: 'E', text: 'Strongly Agree' },
];

const LIKERT_SCORE: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

function calculatePercentile(rawScore: number, maxScore: number): number {
  if (maxScore === 0) return 0;
  return Math.round((rawScore / maxScore) * 100 * 10) / 10;
}

// ─── GET /api/lbi/modules ───
router.get('/modules', async (req, res) => {
  try {
    const { childId } = req.query as { childId?: string };

    const modules = await db
      .select()
      .from(lbiModules)
      .where(eq(lbiModules.isActive, true))
      .orderBy(asc(lbiModules.sortOrder));

    if (!childId) {
      return res.json(modules.map(m => ({
        ...m,
        subModules: ((m.subModules as any[]) || []).map((sm: any) => ({
          id: sm.code,
          subModuleCode: sm.code,
          subModuleName: sm.name,
          questionType: sm.questionType || 'likert',
        })),
        isLocked: false,
        lockedUntil: null,
        lastScore: null,
        lastCompletedAt: null,
      })));
    }

    const sessions = await db
      .select({
        id: lbiSessions.id,
        moduleId: lbiSessions.moduleId,
        status: lbiSessions.status,
        percentileScore: lbiSessions.percentileScore,
        completedAt: lbiSessions.completedAt,
        createdAt: lbiSessions.createdAt,
      })
      .from(lbiSessions)
      .where(eq(lbiSessions.childId, childId))
      .orderBy(desc(lbiSessions.createdAt));

    const latestByModule: Record<number, any> = {};
    for (const s of sessions) {
      if (!latestByModule[s.moduleId]) latestByModule[s.moduleId] = s;
    }

    res.json(modules.map(m => {
      const session = latestByModule[m.id];
      return {
        id: String(m.id),
        moduleCode: m.moduleCode,
        moduleName: m.moduleName,
        description: m.description,
        subModules: ((m.subModules as any[]) || []).map((sm: any) => ({
          id: sm.code,
          subModuleCode: sm.code,
          subModuleName: sm.name,
          questionType: sm.questionType || 'likert',
        })),
        isLocked: false,
        lockedUntil: null,
        lastScore: session?.percentileScore ?? null,
        lastCompletedAt: session?.completedAt ?? null,
      };
    }));
  } catch (err: any) {
    console.error('[GET /lbi/modules]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── GET /api/lbi/sessions ───
router.get('/sessions', async (req, res) => {
  try {
    const { childId } = req.query as { childId?: string };
    const cid = childId || req.user!.id;

    const rows = await db
      .select({
        id: lbiSessions.id,
        moduleId: sql<string>`${lbiSessions.moduleId}::text`,
        moduleCode: lbiModules.moduleCode,
        moduleName: lbiModules.moduleName,
        status: lbiSessions.status,
        totalQuestions: lbiSessions.totalQuestions,
        questionsAnswered: lbiSessions.questionsAnswered,
        rawScore: lbiSessions.rawScore,
        maxScore: lbiSessions.maxScore,
        percentileScore: lbiSessions.percentileScore,
        percentageScore: lbiSessions.percentageScore,
        startedAt: lbiSessions.startedAt,
        completedAt: lbiSessions.completedAt,
      })
      .from(lbiSessions)
      .innerJoin(lbiModules, eq(lbiModules.id, lbiSessions.moduleId))
      .where(eq(lbiSessions.childId, cid))
      .orderBy(desc(lbiSessions.createdAt));

    res.json(rowsToSnake(rows));
  } catch (err: any) {
    console.error('[GET /lbi/sessions]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── POST /api/lbi/sessions ─── create or resume
router.post('/sessions', async (req, res) => {
  try {
    const { moduleId, childId } = req.body;
    if (!moduleId) { res.status(400).json({ message: 'moduleId is required' }); return; }

    const existingCid = childId || (req as any).user?.id;

    const modules = await db
      .select({ id: lbiModules.id, subModules: lbiModules.subModules })
      .from(lbiModules)
      .where(and(eq(lbiModules.id, moduleId), eq(lbiModules.isActive, true)));

    if (!modules.length) { res.status(404).json({ message: 'Module not found' }); return; }

    const mod = modules[0];
    const subModules: any[] = (mod.subModules as any[]) || [];
    const allQuestions = subModules.flatMap((sm: any) =>
      (sm.questions || []).map((q: any) => ({ ...q, subModuleCode: sm.code, subModuleName: sm.name }))
    );
    const totalQuestions = allQuestions.length;

    const existing = await db
      .select({ id: lbiSessions.id })
      .from(lbiSessions)
      .where(
        and(
          eq(lbiSessions.childId, existingCid),
          eq(lbiSessions.moduleId, moduleId),
          eq(lbiSessions.status, 'In Progress')
        )
      )
      .limit(1);

    if (existing.length) {
      res.json({ id: existing[0].id });
      return;
    }

    const inserted = await db
      .insert(lbiSessions)
      .values({
        childId: existingCid,
        moduleId,
        status: 'In Progress',
        totalQuestions,
      })
      .returning({ id: lbiSessions.id });

    res.json({ id: inserted[0].id });
  } catch (err: any) {
    console.error('[POST /lbi/sessions]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err?.message });
  }
});

// ─── GET /api/lbi/sessions/:id/questions ───
router.get('/sessions/:id/questions', async (req, res) => {
  try {
    const sessions = await db
      .select({
        id: lbiSessions.id,
        moduleId: lbiSessions.moduleId,
        childId: lbiSessions.childId,
        responses: lbiSessions.responses,
        moduleCode: lbiModules.moduleCode,
        moduleName: lbiModules.moduleName,
        subModules: lbiModules.subModules,
        domainCodes: lbiModules.domainCodes,
      })
      .from(lbiSessions)
      .innerJoin(lbiModules, eq(lbiModules.id, lbiSessions.moduleId))
      .where(eq(lbiSessions.id, req.params.id));

    if (!sessions.length) { res.status(404).json({ message: 'Session not found' }); return; }

    const session = sessions[0];
    const domainCodes: string[] = (session.domainCodes as string[]) || [];
    let questions: any[] = [];
    let source = 'seed';

    // ── Try question bank first ──────────────────────────────────────────────
    if (domainCodes.length > 0) {
      const qbRows = await db
        .select({
          id: lbiQuestions.id,
          questionCode: lbiQuestions.questionCode,
          questionType: lbiQuestions.questionType,
          questionText: lbiQuestions.questionText,
          subdomainCode: lbiQuestions.subdomainCode,
          subdomainName: lbiQuestions.subdomainName,
          keying: lbiQuestions.keying,
          reverseScored: lbiQuestions.reverseScored,
          optionA: lbiQuestions.optionA,
          optionB: lbiQuestions.optionB,
          optionC: lbiQuestions.optionC,
          optionD: lbiQuestions.optionD,
          optionAScore: lbiQuestions.optionAScore,
          optionBScore: lbiQuestions.optionBScore,
          optionCScore: lbiQuestions.optionCScore,
          optionDScore: lbiQuestions.optionDScore,
          correctAnswer: lbiQuestions.correctAnswer,
        })
        .from(lbiQuestions)
        .where(
          and(
            inArray(lbiQuestions.domainCode, domainCodes),
            sql`LOWER(${lbiQuestions.status}) = 'active'`
          )
        )
        .orderBy(asc(lbiQuestions.subdomainCode), asc(lbiQuestions.questionCode));

      if (qbRows.length > 0) {
        source = 'questionBank';
        questions = qbRows.map((q: any) => {
          const isLikert = q.questionType === 'likert';
          const hasCustomOptions = q.optionA && q.optionB;
          const options = isLikert && !hasCustomOptions
            ? LIKERT_OPTIONS
            : [
                { key: 'A', text: q.optionA || 'Option A', score: q.optionAScore ?? 1 },
                { key: 'B', text: q.optionB || 'Option B', score: q.optionBScore ?? 2 },
                q.optionC ? { key: 'C', text: q.optionC, score: q.optionCScore ?? 3 } : null,
                q.optionD ? { key: 'D', text: q.optionD, score: q.optionDScore ?? 4 } : null,
              ].filter(Boolean);
          return {
            id: q.questionCode,
            questionCode: q.questionCode,
            questionType: q.questionType || 'likert',
            questionText: q.questionText,
            subModuleName: q.subdomainName || q.subdomainCode,
            subModuleCode: q.subdomainCode,
            keying: q.keying || 'Positive',
            reverseScored: q.reverseScored || false,
            correctAnswer: q.correctAnswer || null,
            options,
          };
        });
      }
    }

    // ── Fall back to seeded sub_modules if question bank is empty ────────────
    if (questions.length === 0) {
      const subModules: any[] = (session.subModules as any[]) || [];
      questions = subModules.flatMap((sm: any) =>
        (sm.questions || []).map((q: any, idx: number) => ({
          id: q.id || `${sm.code}_Q${idx + 1}`,
          questionCode: q.id || `${sm.code}_Q${idx + 1}`,
          questionType: sm.questionType || 'likert',
          questionText: q.text,
          subModuleName: sm.name,
          subModuleCode: sm.code,
          options: LIKERT_OPTIONS,
        }))
      );
    }

    res.json({
      questions,
      source,
      difficultyLevel: 1,
      ageGroup: 'A',
      moduleCode: session.moduleCode,
      moduleName: session.moduleName,
    });
  } catch (err: any) {
    console.error('[GET /lbi/sessions/:id/questions]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── POST /api/lbi/sessions/:id/time ─── (fire and forget)
router.post('/sessions/:id/time', async (_req, res) => {
  res.json({ ok: true });
});

// ─── POST /api/lbi/sessions/:id/responses ───
router.post('/sessions/:id/responses', async (req, res) => {
  try {
    const { questionId, selectedOption, responseTimeMs } = req.body;
    if (!questionId || !selectedOption) { res.status(400).json({ message: 'Missing fields' }); return; }

    const rows = await db
      .select({ responses: lbiSessions.responses })
      .from(lbiSessions)
      .where(eq(lbiSessions.id, req.params.id));

    if (!rows.length) { res.status(404).json({ message: 'Session not found' }); return; }

    const responses: any[] = (rows[0].responses as any[]) || [];
    const existingIdx = responses.findIndex((r: any) => r.questionId === questionId);
    const entry = { questionId, selectedOption, responseTimeMs: responseTimeMs || 0 };
    if (existingIdx >= 0) {
      responses[existingIdx] = entry;
    } else {
      responses.push(entry);
    }

    await db
      .update(lbiSessions)
      .set({
        responses: JSON.stringify(responses),
        questionsAnswered: responses.length,
      })
      .where(eq(lbiSessions.id, req.params.id));

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[POST /lbi/sessions/:id/responses]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── POST /api/lbi/sessions/:id/complete ───
router.post('/sessions/:id/complete', async (req, res) => {
  try {
    const sessions = await db
      .select({
        id: lbiSessions.id,
        childId: lbiSessions.childId,
        responses: lbiSessions.responses,
        totalQuestions: lbiSessions.totalQuestions,
        subModules: lbiModules.subModules,
      })
      .from(lbiSessions)
      .innerJoin(lbiModules, eq(lbiModules.id, lbiSessions.moduleId))
      .where(eq(lbiSessions.id, req.params.id));

    if (!sessions.length) { res.status(404).json({ message: 'Session not found' }); return; }

    const session = sessions[0];
    const responses: any[] = (session.responses as any[]) || [];
    const subModules: any[] = (session.subModules as any[]) || [];

    // Fetch question bank data for reverse_scored and custom option scores
    const questionIds = subModules.flatMap((sm: any) => (sm.questions || []).map((q: any) => q.id));
    const qBankMap: Record<string, any> = {};
    if (questionIds.length > 0) {
      const qRows = await db
        .select({
          questionCode: lbiQuestions.questionCode,
          reverseScored: lbiQuestions.reverseScored,
          optionAScore: lbiQuestions.optionAScore,
          optionBScore: lbiQuestions.optionBScore,
          optionCScore: lbiQuestions.optionCScore,
          optionDScore: lbiQuestions.optionDScore,
        })
        .from(lbiQuestions)
        .where(inArray(lbiQuestions.questionCode, questionIds));

      for (const qr of qRows) qBankMap[qr.questionCode] = qr;
    }

    let rawScore = 0;
    let maxScore = 0;
    for (const sm of subModules) {
      for (const q of (sm.questions || [])) {
        const qBank = qBankMap[q.id];
        const hasCustomScores = qBank && qBank.optionAScore != null;
        const maxPerQ = hasCustomScores
          ? Math.max(qBank.optionAScore || 0, qBank.optionBScore || 0, qBank.optionCScore || 0, qBank.optionDScore || 0, 5)
          : 5;
        maxScore += maxPerQ;

        const resp = responses.find((r: any) => r.questionId === q.id);
        if (resp) {
          let score = 0;
          if (hasCustomScores) {
            // Use custom option scores from question bank
            const optMap: Record<string, number> = {
              A: qBank.optionAScore || 0, B: qBank.optionBScore || 0,
              C: qBank.optionCScore || 0, D: qBank.optionDScore || 0, E: 5,
            };
            score = optMap[resp.selectedOption] ?? (LIKERT_SCORE[resp.selectedOption] || 0);
          } else {
            score = LIKERT_SCORE[resp.selectedOption] || 0;
          }
          // Apply reverse scoring: invert the scale (max + 1 - score)
          if (qBank?.reverseScored) {
            score = (maxPerQ + 1) - score;
          }
          rawScore += score;
        }
      }
    }

    const totalQ = session.totalQuestions || maxScore / 5;
    const answered = responses.length;
    const percentileScore = calculatePercentile(rawScore, maxScore);
    const percentageScore = percentileScore;

    await db
      .update(lbiSessions)
      .set({
        status: 'Completed',
        completedAt: sql`NOW()`,
        rawScore,
        maxScore,
        percentileScore: String(percentileScore),
        percentageScore: String(percentageScore),
        questionsAnswered: answered,
      })
      .where(eq(lbiSessions.id, req.params.id));

    // Fire report.insight_generated scenario notification for LBI completion — non-blocking
    const userId = (req as any).user?.id;
    if (userId) {
      setImmediate(() => {
        scenarioTrigger('report.insight_generated', {
          recipientId: userId,
          studentName: (req as any).user?.fullName || 'Student',
        }).catch(() => {});
      });
    }

    // Award gamification points for LBI completion — non-blocking
    const LBI_XP = 150;
    const LBI_COINS = 50;
    const sessionId = req.params.id;
    const childId = session.childId;
    setImmediate(async () => {
      try {
        // Resolve the student user_id from the child record
        const childRow = await pool.query<{ student_user_id: string | null }>(
          `SELECT student_user_id FROM children WHERE id = $1`,
          [childId],
        );
        const studentUserId = childRow.rows[0]?.student_user_id;
        if (!studentUserId) return;

        // Idempotency: skip if already awarded for this session
        const already = await pool.query(
          `SELECT 1 FROM xp_transactions WHERE user_id = $1 AND source = 'lbi_complete' AND reference_id = $2 LIMIT 1`,
          [studentUserId, sessionId],
        );
        if (already.rows.length > 0) return;

        // Ensure profile exists
        await pool.query(
          `INSERT INTO student_gamification (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
          [studentUserId],
        );

        // Award XP
        await pool.query(
          `UPDATE student_gamification
           SET xp = xp + $2,
               level = GREATEST(level, FLOOR(SQRT((xp + $2) / 50.0))::int + 1),
               updated_at = NOW()
           WHERE user_id = $1`,
          [studentUserId, LBI_XP],
        );
        await pool.query(
          `INSERT INTO xp_transactions (user_id, amount, source, reference_id) VALUES ($1, $2, 'lbi_complete', $3)`,
          [studentUserId, LBI_XP, sessionId],
        );

        // Award coins
        const coinRes = await pool.query<{ coins: number }>(
          `UPDATE student_gamification SET coins = coins + $2, updated_at = NOW()
           WHERE user_id = $1 RETURNING coins`,
          [studentUserId, LBI_COINS],
        );
        const balance = coinRes.rows[0]?.coins ?? LBI_COINS;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90);
        await pool.query(
          `INSERT INTO coin_transactions (user_id, amount, type, source, balance_after, expires_at, reference_id)
           VALUES ($1, $2, 'earn', 'lbi_complete', $3, $4, $5)`,
          [studentUserId, LBI_COINS, balance, expiresAt.toISOString(), sessionId],
        );
      } catch (e: any) {
        console.error('[LBI gamification award]', e?.message);
      }
    });

    res.json({
      sessionId: req.params.id,
      summary: { rawScore, maxScore, percentileScore, percentageScore, totalQuestions: totalQ, questionsAnswered: answered },
      pointsAwarded: { xp: LBI_XP, coins: LBI_COINS },
    });
  } catch (err: any) {
    console.error('[POST /lbi/sessions/:id/complete]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── GET /api/lbi/sessions/:id/results ───
router.get('/sessions/:id/results', async (req, res) => {
  try {
    const rows = await db
      .select({
        sessionId: lbiSessions.id,
        moduleName: lbiModules.moduleName,
        moduleCode: lbiModules.moduleCode,
        completedAt: lbiSessions.completedAt,
        rawScore: lbiSessions.rawScore,
        maxScore: lbiSessions.maxScore,
        percentileScore: lbiSessions.percentileScore,
        percentageScore: lbiSessions.percentageScore,
        totalQuestions: lbiSessions.totalQuestions,
        questionsAnswered: lbiSessions.questionsAnswered,
        subModules: lbiModules.subModules,
        responses: lbiSessions.responses,
      })
      .from(lbiSessions)
      .innerJoin(lbiModules, eq(lbiModules.id, lbiSessions.moduleId))
      .where(eq(lbiSessions.id, req.params.id));

    if (!rows.length) { res.status(404).json({ message: 'Session not found' }); return; }

    const r = rows[0];
    const subModules: any[] = (r.subModules as any[]) || [];
    const responses: any[] = (r.responses as any[]) || [];

    const subModuleResults = subModules.map((sm: any) => {
      const questions = sm.questions || [];
      let smRaw = 0; let smMax = 0;
      for (const q of questions) {
        smMax += 5;
        const resp = responses.find((r: any) => r.questionId === q.id);
        if (resp) smRaw += LIKERT_SCORE[resp.selectedOption] || 0;
      }
      return {
        code: sm.code,
        name: sm.name,
        score: smMax > 0 ? Math.round((smRaw / smMax) * 100) : 0,
        rawScore: smRaw,
        maxScore: smMax,
        questionsAnswered: questions.filter((q: any) => responses.find((r: any) => r.questionId === q.id)).length,
        totalQuestions: questions.length,
      };
    });

    res.json({
      ...r,
      summary: {
        rawScore: r.rawScore,
        maxScore: r.maxScore,
        percentileScore: parseFloat(r.percentileScore || '0'),
        totalQuestions: r.totalQuestions,
        questionsAnswered: r.questionsAnswered,
      },
      subModuleResults,
    });
  } catch (err: any) {
    console.error('[GET /lbi/sessions/:id/results]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── GET /api/lbi/domains ───
router.get('/domains', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT d.*, COALESCE(s.sub_count, 0)::int AS subdomain_count
      FROM lbi_domains d
      LEFT JOIN (
        SELECT domain_code, COUNT(*) AS sub_count
        FROM lbi_subdomains
        WHERE is_active = TRUE
        GROUP BY domain_code
      ) s ON s.domain_code = d.domain_code
      ORDER BY d.sort_order
    `);
    res.json(rows.map((r: any) => ({
      id: r.id, domain_code: r.domain_code, domain_name: r.domain_name,
      description: r.description, sort_order: r.sort_order, is_active: r.is_active,
      created_at: r.created_at, subdomain_count: Number(r.subdomain_count),
    })));
  } catch (err: any) {
    console.error('[GET /lbi/domains]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── GET /api/lbi/age-bands ───
router.get('/age-bands', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(lbiAgeBands)
      .orderBy(asc(lbiAgeBands.sortOrder));
    res.json(rows.map(r => ({
      id: r.id, band_code: r.bandCode, label: r.label,
      age_min: r.ageMin, age_max: r.ageMax, sort_order: r.sortOrder,
      created_at: r.createdAt,
    })));
  } catch (err: any) {
    console.error('[GET /lbi/age-bands]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── GET /api/lbi/questions ───
router.get('/questions', async (req, res) => {
  try {
    const { domainId, ageBandId, difficulty } = req.query as Record<string, string>;
    const conditions: any[] = [sql`LOWER(${lbiQuestions.status}) = 'active'`];

    if (domainId) {
      conditions.push(eq(lbiDomains.id, Number(domainId)));
    }
    if (ageBandId) {
      conditions.push(eq(lbiAgeBands.id, Number(ageBandId)));
    }
    if (difficulty && difficulty !== 'all') {
      conditions.push(eq(lbiQuestions.difficulty, difficulty.toUpperCase()));
    }

    const rows = await db
      .select({
        id: lbiQuestions.id,
        question_code: lbiQuestions.questionCode,
        domain_code: lbiQuestions.domainCode,
        domain_name: lbiQuestions.domainName,
        subdomain_code: lbiQuestions.subdomainCode,
        subdomain_name: lbiQuestions.subdomainName,
        band_code: lbiQuestions.ageBandCode,
        question_type: lbiQuestions.questionType,
        question_text: lbiQuestions.questionText,
        keying: lbiQuestions.keying,
        reverse_scored: lbiQuestions.reverseScored,
        difficulty: lbiQuestions.difficulty,
        is_anchor: lbiQuestions.isAnchor,
        option_a: lbiQuestions.optionA,
        option_b: lbiQuestions.optionB,
        option_c: lbiQuestions.optionC,
        option_d: lbiQuestions.optionD,
        option_a_score: lbiQuestions.optionAScore,
        option_b_score: lbiQuestions.optionBScore,
        option_c_score: lbiQuestions.optionCScore,
        option_d_score: lbiQuestions.optionDScore,
        correct_answer: lbiQuestions.correctAnswer,
        explanation: lbiQuestions.explanation,
        status: lbiQuestions.status,
      })
      .from(lbiQuestions)
      .leftJoin(lbiDomains, eq(lbiDomains.domainCode, lbiQuestions.domainCode))
      .leftJoin(lbiAgeBands, eq(lbiAgeBands.bandCode, lbiQuestions.ageBandCode))
      .where(and(...conditions))
      .orderBy(asc(lbiQuestions.domainCode), asc(lbiQuestions.subdomainCode), asc(lbiQuestions.questionCode))
      .limit(500);

    res.json(rows);
  } catch (err: any) {
    console.error('[GET /lbi/questions]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: GET /api/lbi/admin/stats ─── merged Postgres + MongoDB counts
router.get('/admin/stats', async (_req, res) => {
  try {
    const [domainRes, pgQRes, lbiSubRes, ageBandRes, mongoTotalRes, mongoActiveRes] = await Promise.all([
      db.select({
        total: count(),
        active: count(sql`CASE WHEN ${lbiDomains.isActive} THEN 1 END`),
      }).from(lbiDomains),
      db.select({
        total: count(),
        active: count(sql`CASE WHEN LOWER(${lbiQuestions.status}) = 'active' THEN 1 END`),
      }).from(lbiQuestions),
      query(`SELECT COUNT(*)::int AS total FROM lbi_subdomains WHERE is_active = TRUE`),
      db.select({ total: count() }).from(lbiAgeBands),
      ExamReadyQuestion.countDocuments({}),
      ExamReadyQuestion.countDocuments({ status: /^active$/i }),
    ]);

    const pgTotal = Number(pgQRes[0].total);
    const pgActive = Number(pgQRes[0].active);
    const lbiSubTotal = Number(lbiSubRes.rows[0]?.total || 0);
    const mongoTotal = Number(mongoTotalRes);
    const mongoActive = Number(mongoActiveRes);

    res.json({
      domains: { total: Number(domainRes[0].total), active: Number(domainRes[0].active) },
      questions: { total: pgTotal + mongoTotal, active: pgActive + mongoActive },
      subdomains: { total: lbiSubTotal },
      ageBands: { total: Number(ageBandRes[0].total) },
    });
  } catch (err: any) {
    console.error('[GET /lbi/admin/stats]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: POST /api/lbi/admin/domains ─── create domain
router.post('/admin/domains', async (req, res) => {
  try {
    const { domain_code, domain_name, description, sort_order, is_active } = req.body;
    if (!domain_code || !domain_name) return res.status(400).json({ error: 'domain_code and domain_name are required' });

    const rows = await db
      .insert(lbiDomains)
      .values({
        domainCode: domain_code.trim().toUpperCase(),
        domainName: domain_name.trim(),
        description: description || null,
        sortOrder: sort_order || 0,
        isActive: is_active !== false,
      })
      .returning();

    res.status(201).json(domainToSnake(rows[0]));
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'DUPLICATE_CODE', message: 'A domain with this code already exists' });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: PUT /api/lbi/admin/domains/:id ─── update domain
router.put('/admin/domains/:id', async (req, res) => {
  try {
    const { domain_code, domain_name, description, sort_order, is_active } = req.body;
    const updates: Record<string, any> = {};
    if (domain_code != null) updates.domainCode = domain_code.trim().toUpperCase();
    if (domain_name != null) updates.domainName = domain_name.trim();
    if (description !== undefined) updates.description = description;
    if (sort_order != null) updates.sortOrder = sort_order;
    if (is_active != null) updates.isActive = is_active;

    const rows = await db
      .update(lbiDomains)
      .set(updates)
      .where(eq(lbiDomains.id, Number(req.params.id)))
      .returning();

    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(domainToSnake(rows[0]));
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'DUPLICATE_CODE', message: 'A domain with this code already exists' });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: DELETE /api/lbi/admin/domains/:id ─── delete domain
router.delete('/admin/domains/:id', async (req, res) => {
  try {
    const rows = await db
      .delete(lbiDomains)
      .where(eq(lbiDomains.id, Number(req.params.id)))
      .returning({ id: lbiDomains.id });

    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: PATCH /api/lbi/admin/domains/:id/toggle ─── toggle active status
router.patch('/admin/domains/:id/toggle', async (req, res) => {
  try {
    const rows = await db
      .update(lbiDomains)
      .set({ isActive: sql`NOT is_active` })
      .where(eq(lbiDomains.id, Number(req.params.id)))
      .returning();

    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(domainToSnake(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: GET /api/lbi/admin/subdomains ─── lbi_subdomains table + MongoDB merge
router.get('/admin/subdomains', async (req, res) => {
  try {
    const { domain_code } = req.query as Record<string, string>;

    // Detect if the domain_code belongs to Professional Competency Framework
    let isCompetencyDomain = false;
    if (domain_code) {
      const checkRes = await query(
        `SELECT 1 FROM competency_domains WHERE code = $1 AND is_active = TRUE LIMIT 1`,
        [domain_code]
      );
      isCompetencyDomain = checkRes.rows.length > 0;
    }

    const merged = new Map<string, any>();

    if (isCompetencyDomain && domain_code) {
      // ── Professional Competency subdomains from `competencies` table ──
      const compRes = await query(`
        SELECT c.code AS subdomain_code, c.name AS subdomain_name,
               cd.code AS domain_code, cd.name AS domain_name, c.sort_order
        FROM competencies c
        JOIN competency_domains cd ON cd.id = c.domain_id
        WHERE cd.code = $1 AND c.is_active = TRUE
        ORDER BY c.sort_order
      `, [domain_code]);
      for (const r of compRes.rows) {
        merged.set(`${r.domain_code}|${r.subdomain_code}`, {
          domain_code: r.domain_code, domain_name: r.domain_name,
          subdomain_code: r.subdomain_code, subdomain_name: r.subdomain_name,
          question_count: 0, framework: 'competency',
        });
      }
      // Count items already tagged to these competency subdomains in lbi_questions (PG)
      const pgItems = await query(`
        SELECT subdomain_code, COUNT(*)::int AS cnt FROM lbi_questions
        WHERE domain_code = $1 GROUP BY subdomain_code
      `, [domain_code]);
      for (const r of pgItems.rows) {
        const key = `${domain_code}|${r.subdomain_code}`;
        if (merged.has(key)) merged.get(key).question_count += Number(r.cnt);
      }
    } else {
      // ── LBI Behavioural subdomains from `lbi_subdomains` master table ──
      const masterRes = await query(`
        SELECT s.subdomain_code, s.subdomain_name, s.domain_code,
               d.domain_name, s.sort_order
        FROM lbi_subdomains s
        LEFT JOIN lbi_domains d ON d.domain_code = s.domain_code
        WHERE s.is_active = TRUE
        ${domain_code ? `AND s.domain_code = $1` : ''}
        ORDER BY s.domain_code, s.sort_order
      `, domain_code ? [domain_code] : []);
      for (const r of masterRes.rows) {
        merged.set(`${r.domain_code}|${r.subdomain_code}`, {
          domain_code: r.domain_code, domain_name: r.domain_name,
          subdomain_code: r.subdomain_code, subdomain_name: r.subdomain_name,
          question_count: 0, framework: 'lbi',
        });
      }
      // Layer in MongoDB question counts
      const mongoMatch: Record<string, any> = { subdomain_code: { $exists: true, $ne: '' } };
      if (domain_code) mongoMatch.domain_code = domain_code;
      const mongoRows = await ExamReadyQuestion.aggregate([
        { $match: mongoMatch },
        { $group: {
          _id: { domain_code: '$domain_code', subdomain_code: '$subdomain_code', domain_name: '$domain_name', subdomain_name: '$subdomain_name' },
          question_count: { $sum: 1 },
        }},
        { $sort: { '_id.domain_code': 1, '_id.subdomain_code': 1 } },
      ]);
      for (const r of mongoRows) {
        const key = `${r._id.domain_code}|${r._id.subdomain_code}`;
        if (merged.has(key)) {
          merged.get(key).question_count += Number(r.question_count);
        } else {
          merged.set(key, {
            domain_code: r._id.domain_code, domain_name: r._id.domain_name || r._id.domain_code,
            subdomain_code: r._id.subdomain_code, subdomain_name: r._id.subdomain_name || r._id.subdomain_code,
            question_count: Number(r.question_count), framework: 'lbi',
          });
        }
      }
    }

    const result = Array.from(merged.values()).sort((a, b) => a.domain_code.localeCompare(b.domain_code) || a.subdomain_code.localeCompare(b.subdomain_code));
    res.json(result);
  } catch (err: any) {
    console.error('[GET /lbi/admin/subdomains]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: GET /api/lbi/admin/questions-all ─── merged Postgres + MongoDB with full filters & pagination
// Complex dynamic pagination across two data sources — kept as pool.query
router.get('/admin/questions-all', async (req, res) => {
  try {
    const { domain_code, subdomain_code, age_band, difficulty, status, question_type, search, page = '1', limit = '50' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const pageLimit = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * pageLimit;

    // ── 1. Postgres lbi_questions ──────────────────────────────────────────────
    const pgConditions: string[] = [];
    const pgParams: any[] = [];
    if (domain_code && domain_code !== 'all') { pgParams.push(domain_code); pgConditions.push(`q.domain_code = $${pgParams.length}`); }
    if (subdomain_code && subdomain_code !== 'all') { pgParams.push(subdomain_code); pgConditions.push(`q.subdomain_code = $${pgParams.length}`); }
    if (age_band && age_band !== 'all') { pgParams.push(age_band); pgConditions.push(`q.age_band_code = $${pgParams.length}`); }
    if (difficulty && difficulty !== 'all') { pgParams.push(difficulty.toUpperCase()); pgConditions.push(`UPPER(q.difficulty) = $${pgParams.length}`); }
    if (status && status !== 'all') { pgParams.push(status); pgConditions.push(`LOWER(q.status) = LOWER($${pgParams.length})`); }
    if (question_type && question_type !== 'all') { pgParams.push(question_type); pgConditions.push(`LOWER(q.question_type) = LOWER($${pgParams.length})`); }
    if (search) { pgParams.push(`%${search}%`); pgConditions.push(`(q.question_text ILIKE $${pgParams.length} OR q.question_code ILIKE $${pgParams.length} OR q.subdomain_name ILIKE $${pgParams.length})`); }
    const pgWhere = pgConditions.length ? `WHERE ${pgConditions.join(' AND ')}` : '';

    // ── 2. MongoDB ExamReadyQuestion ───────────────────────────────────────────
    const mongoMatch: Record<string, any> = {};
    if (domain_code && domain_code !== 'all') mongoMatch.domain_code = domain_code;
    if (subdomain_code && subdomain_code !== 'all') mongoMatch.subdomain_code = subdomain_code;
    if (age_band && age_band !== 'all') mongoMatch.age_band = age_band;
    if (difficulty && difficulty !== 'all') mongoMatch.difficulty = new RegExp(`^${difficulty}$`, 'i');
    if (status && status !== 'all') mongoMatch.status = new RegExp(`^${status}$`, 'i');
    if (question_type && question_type !== 'all') mongoMatch.question_type = new RegExp(`^${question_type}$`, 'i');
    if (search) {
      mongoMatch.$or = [
        { statement: new RegExp(search, 'i') },
        { stem: new RegExp(search, 'i') },
        { question_id: new RegExp(search, 'i') },
        { subdomain_name: new RegExp(search, 'i') },
      ];
    }

    // ── 3. Counts ──────────────────────────────────────────────────────────────
    const [pgCountRes, mongoTotal] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM lbi_questions q ${pgWhere}`, pgParams),
      ExamReadyQuestion.countDocuments(mongoMatch),
    ]);
    const pgTotal = Number(pgCountRes.rows[0].total);
    const total = pgTotal + mongoTotal;

    // ── 4. Paginate across the combined virtual list (Postgres first, then MongoDB) ──
    const questions: any[] = [];

    // How many Postgres rows have been consumed before this page?
    const pgConsumed = Math.min(pgTotal, offset);
    const pgPageOffset = pgConsumed;
    const pgNeeded = Math.min(pageLimit, Math.max(0, pgTotal - pgPageOffset));

    if (pgNeeded > 0) {
      const pgData = await pool.query(
        `SELECT q.id, q.question_code, q.domain_code, q.domain_name,
                q.subdomain_code, q.subdomain_name, q.age_band_code,
                q.question_type, q.question_text, q.difficulty, q.status,
                q.is_anchor, q.reverse_scored, q.weight,
                q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
                q.option_a_score, q.option_b_score, q.option_c_score, q.option_d_score, q.option_e_score,
                q.correct_answer, q.keying, q.explanation, q.created_at,
                'postgres' AS _source
         FROM lbi_questions q ${pgWhere}
         ORDER BY q.domain_code, q.subdomain_code, q.question_code
         LIMIT $${pgParams.length + 1} OFFSET $${pgParams.length + 2}`,
        [...pgParams, pgNeeded, pgPageOffset]
      );
      questions.push(...pgData.rows);
    }

    // Fill remaining slots from MongoDB
    const mongoNeeded = pageLimit - questions.length;
    if (mongoNeeded > 0 && mongoTotal > 0) {
      const mongoOffset = Math.max(0, offset - pgTotal);
      const mongoDocs = await ExamReadyQuestion.find(mongoMatch)
        .sort({ domain_code: 1, subdomain_code: 1, question_id: 1 })
        .skip(mongoOffset)
        .limit(mongoNeeded)
        .lean();

      for (const d of mongoDocs) {
        questions.push({
          id: String(d._id),
          question_code: (d as any).question_id || String(d._id).slice(-8),
          domain_code: (d as any).domain_code || '',
          domain_name: (d as any).domain_name || '',
          subdomain_code: (d as any).subdomain_code || '',
          subdomain_name: (d as any).subdomain_name || '',
          age_band_code: (d as any).age_band || '',
          question_type: (d as any).question_type || '',
          question_text: (d as any).statement || (d as any).stem || '',
          difficulty: (d as any).difficulty || 'MEDIUM',
          status: (d as any).status || 'Active',
          is_anchor: (d as any).anchor === 'Yes' || false,
          reverse_scored: (d as any).reverse_scoring || (d as any).reverseScored || false,
          weight: (d as any).weight || 1,
          option_a: (d as any).options?.[0]?.text || null,
          option_b: (d as any).options?.[1]?.text || null,
          option_c: (d as any).options?.[2]?.text || null,
          option_d: (d as any).options?.[3]?.text || null,
          option_e: (d as any).options?.[4]?.text || null,
          option_a_score: (d as any).options?.[0]?.score ?? null,
          option_b_score: (d as any).options?.[1]?.score ?? null,
          option_c_score: (d as any).options?.[2]?.score ?? null,
          option_d_score: (d as any).options?.[3]?.score ?? null,
          option_e_score: (d as any).options?.[4]?.score ?? null,
          correct_answer: (d as any).correct_answer || null,
          keying: (d as any).reverse_scoring ? 'Negative' : 'Positive',
          explanation: (d as any).content?.explanation || null,
          created_at: (d as any).createdAt || null,
          _source: 'mongodb',
        });
      }
    }

    res.json({
      questions,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageLimit) || 0,
      limit: pageLimit,
    });
  } catch (err: any) {
    console.error('[GET /lbi/admin/questions-all]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: POST /api/lbi/admin/questions ─── create a question
// References columns not in Drizzle schema (option_e, weight, etc.) — kept as pool.query
router.post('/admin/questions', async (req, res) => {
  try {
    const { question_code, domain_code, domain_name, subdomain_code, subdomain_name,
      age_band_code, question_type, question_text, difficulty, status,
      is_anchor, reverse_scored, weight, keying, explanation,
      option_a, option_b, option_c, option_d, option_e,
      option_a_score, option_b_score, option_c_score, option_d_score, option_e_score, correct_answer } = req.body;
    if (!question_code || !domain_code || !question_text) return res.status(400).json({ error: 'question_code, domain_code and question_text are required' });
    const { rows } = await pool.query(
      `INSERT INTO lbi_questions (question_code, domain_code, domain_name, subdomain_code, subdomain_name,
        age_band_code, question_type, question_text, difficulty, status, is_anchor, reverse_scored, weight, keying, explanation,
        option_a, option_b, option_c, option_d, option_e,
        option_a_score, option_b_score, option_c_score, option_d_score, option_e_score, correct_answer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
      [question_code, domain_code, domain_name||null, subdomain_code||null, subdomain_name||null,
       age_band_code||null, question_type||'likert', question_text, difficulty||null, status||'Active',
       is_anchor??false, reverse_scored??false, weight??1, keying||null, explanation||null,
       option_a||null, option_b||null, option_c||null, option_d||null, option_e||null,
       option_a_score??null, option_b_score??null, option_c_score??null, option_d_score??null, option_e_score??null, correct_answer||null]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'DUPLICATE_CODE', message: 'A question with this code already exists' });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ─── Admin: PUT /api/lbi/admin/questions/:id ─── update a question
// Dynamic SET clauses with columns not in Drizzle schema — kept as pool.query
router.put('/admin/questions/:id', async (req, res) => {
  try {
    const fields = ['domain_code','domain_name','subdomain_code','subdomain_name','age_band_code','question_type','question_text','difficulty','status','is_anchor','reverse_scored','weight','keying','explanation','option_a','option_b','option_c','option_d','option_e','option_a_score','option_b_score','option_c_score','option_d_score','option_e_score','correct_answer'];
    const setClauses: string[] = [];
    const params: any[] = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { params.push(req.body[f]); setClauses.push(`${f} = $${params.length}`); }
    }
    if (!setClauses.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await pool.query(`UPDATE lbi_questions SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ─── Admin: DELETE /api/lbi/admin/questions/:id ─── delete a question
router.delete('/admin/questions/:id', async (req, res) => {
  try {
    const rows = await db
      .delete(lbiQuestions)
      .where(eq(lbiQuestions.id, Number(req.params.id)))
      .returning({ id: lbiQuestions.id });

    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: PATCH /api/lbi/admin/questions/:id/toggle ─── toggle active status
router.patch('/admin/questions/:id/toggle', async (req, res) => {
  try {
    const rows = await db
      .select({ status: lbiQuestions.status })
      .from(lbiQuestions)
      .where(eq(lbiQuestions.id, Number(req.params.id)));

    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    const newStatus = rows[0].status === 'Active' ? 'Inactive' : 'Active';

    const updated = await db
      .update(lbiQuestions)
      .set({ status: newStatus })
      .where(eq(lbiQuestions.id, Number(req.params.id)))
      .returning();

    res.json(updated[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: POST /api/lbi/admin/questions/bulk ─── bulk operations
router.post('/admin/questions/bulk', async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!ids?.length || !action) return res.status(400).json({ error: 'ids and action are required' });
    const numericIds = ids.map(Number);
    if (action === 'activate') {
      await db.update(lbiQuestions).set({ status: 'Active' }).where(inArray(lbiQuestions.id, numericIds));
    } else if (action === 'deactivate') {
      await db.update(lbiQuestions).set({ status: 'Inactive' }).where(inArray(lbiQuestions.id, numericIds));
    } else if (action === 'delete') {
      await db.delete(lbiQuestions).where(inArray(lbiQuestions.id, numericIds));
    } else {
      return res.status(400).json({ error: 'Invalid action. Use activate, deactivate, or delete' });
    }
    res.json({ ok: true, affected: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ─── Admin: GET /api/lbi/admin/questions/template ─── Download CSV template
router.get('/admin/questions/template', (_req, res) => {
  const headers = [
    'question_code','domain_code','domain_name','subdomain_code','subdomain_name',
    'age_band_code','question_type','question_text','passage_text',
    'difficulty','status','keying','reverse_scored','is_anchor','weight',
    'option_a','option_b','option_c','option_d','option_e',
    'option_a_score','option_b_score','option_c_score','option_d_score','option_e_score',
    'correct_answer','explanation','time_limit_seconds','stimulus_type'
  ];

  const examples = [
    // Likert (5-point scale, no correct answer)
    ['ACE.EFF.A.001','ACE','Academic & Cognitive Efficiency','EFF','Efficiency','A',
     'likert','I complete my assigned tasks before the deadline.','',
     'MEDIUM','active','Positive','false','false','1.0',
     'Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree',
     '1','2','3','4','5','','','','text'],
    // MCQ (single correct answer)
    ['ACE.EFF.A.002','ACE','Academic & Cognitive Efficiency','EFF','Efficiency','A',
     'mcq','Which strategy best supports time management?','',
     'MEDIUM','active','','false','false','1.0',
     'Multitasking all tasks','Prioritising by deadline','Avoiding schedules','Waiting for reminders','',
     '1','4','2','2','','b','Prioritising ensures completion of important tasks first.','','text'],
    // True/False
    ['SEI.EMP.B.001','SEI','Social & Emotional Intelligence','EMP','Empathy','B',
     'true_false','Listening actively is a sign of empathy.','',
     'EASY','active','Positive','false','false','1.0',
     'True','False','','','',
     '4','1','','','','a','Active listening demonstrates empathetic engagement.','','text'],
    // Rating (1–5 self-rating)
    ['SEI.EMP.B.002','SEI','Social & Emotional Intelligence','EMP','Empathy','B',
     'rating','Rate your ability to understand others\' emotions.','',
     'MEDIUM','active','Positive','false','false','1.0',
     '1 - Very Low','2 - Low','3 - Moderate','4 - High','5 - Very High',
     '1','2','3','4','5','','','','text'],
    // Memory test
    ['MEM.WRK.C.001','MEM','Working Memory','WRK','Working Memory','C',
     'memory','Which number sequence appeared in the passage?',
     'Read and memorise: The code is 7 - 3 - 9 - 1.',
     'HARD','active','','false','true','2.0',
     '7-3-1-9','3-9-7-1','7-3-9-1','9-3-7-1','',
     '1','1','4','1','','c','The correct sequence was 7-3-9-1.','15','text'],
  ];

  const csvRows = [headers.join(','), ...examples.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))];
  const csv = csvRows.join('\r\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="lbi_items_template.csv"');
  res.send(csv);
});

// ─── Admin: POST /api/lbi/admin/questions/import ─── CSV bulk import with upsert
// Complex upsert with columns not in Drizzle schema — kept as pool.query
router.post('/admin/questions/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const content = req.file.buffer.toString('utf8');
    let records: any[];
    try {
      records = parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    } catch (parseErr: any) {
      return res.status(400).json({ error: 'CSV_PARSE_ERROR', message: parseErr.message });
    }

    if (!records.length) return res.status(400).json({ error: 'EMPTY_FILE', message: 'No data rows found in CSV' });

    const REQUIRED = ['question_code','domain_code','subdomain_code','age_band_code','question_text'];
    const VALID_TYPES = ['likert','mcq','true_false','rating','memory','image_mcq'];

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as any[] };

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;

      // Validate required fields
      const missing = REQUIRED.filter(f => !row[f]?.trim());
      if (missing.length) {
        results.errors.push({ row: rowNum, code: row.question_code || '—', error: `Missing required fields: ${missing.join(', ')}` });
        results.skipped++;
        continue;
      }

      // Validate question_type
      const qtype = (row.question_type || 'likert').trim().toLowerCase();
      if (!VALID_TYPES.includes(qtype)) {
        results.errors.push({ row: rowNum, code: row.question_code, error: `Invalid question_type '${qtype}'. Must be one of: ${VALID_TYPES.join(', ')}` });
        results.skipped++;
        continue;
      }

      const parseBool = (v: string) => v?.toLowerCase() === 'true' || v === '1';
      const parseIntOrNull = (v: string) => v?.trim() ? parseInt(v.trim(), 10) : null;
      const parseFloatOrNull = (v: string) => v?.trim() ? parseFloat(v.trim()) : null;

      const params = [
        row.question_code.trim(),
        row.domain_code.trim().toUpperCase(),
        row.domain_name?.trim() || null,
        row.subdomain_code.trim(),
        row.subdomain_name?.trim() || null,
        row.age_band_code.trim().toUpperCase(),
        qtype,
        row.question_text.trim(),
        row.passage_text?.trim() || null,
        (row.difficulty?.trim().toUpperCase()) || 'MEDIUM',
        row.status?.trim() || 'active',
        row.keying?.trim() || 'Positive',
        parseBool(row.reverse_scored),
        parseBool(row.is_anchor),
        parseFloatOrNull(row.weight) ?? 1.0,
        row.option_a?.trim() || null,
        row.option_b?.trim() || null,
        row.option_c?.trim() || null,
        row.option_d?.trim() || null,
        row.option_e?.trim() || null,
        parseIntOrNull(row.option_a_score),
        parseIntOrNull(row.option_b_score),
        parseIntOrNull(row.option_c_score),
        parseIntOrNull(row.option_d_score),
        parseIntOrNull(row.option_e_score),
        row.correct_answer?.trim().toLowerCase() || null,
        row.explanation?.trim() || null,
        parseIntOrNull(row.time_limit_seconds),
        row.stimulus_type?.trim() || 'text',
      ];

      try {
        const existing = await db
          .select({ id: lbiQuestions.id })
          .from(lbiQuestions)
          .where(eq(lbiQuestions.questionCode, row.question_code.trim()));

        if (existing.length) {
          await pool.query(
            `UPDATE lbi_questions SET
               domain_code=$2, domain_name=$3, subdomain_code=$4, subdomain_name=$5,
               age_band_code=$6, question_type=$7, question_text=$8, passage_text=$9,
               difficulty=$10, status=$11, keying=$12, reverse_scored=$13, is_anchor=$14, weight=$15,
               option_a=$16, option_b=$17, option_c=$18, option_d=$19, option_e=$20,
               option_a_score=$21, option_b_score=$22, option_c_score=$23, option_d_score=$24, option_e_score=$25,
               correct_answer=$26, explanation=$27, time_limit_seconds=$28, stimulus_type=$29,
               updated_at=NOW()
             WHERE question_code=$1`,
            params
          );
          results.updated++;
        } else {
          await pool.query(
            `INSERT INTO lbi_questions
               (question_code, domain_code, domain_name, subdomain_code, subdomain_name,
                age_band_code, question_type, question_text, passage_text,
                difficulty, status, keying, reverse_scored, is_anchor, weight,
                option_a, option_b, option_c, option_d, option_e,
                option_a_score, option_b_score, option_c_score, option_d_score, option_e_score,
                correct_answer, explanation, time_limit_seconds, stimulus_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
            params
          );
          results.created++;
        }
      } catch (rowErr: any) {
        results.errors.push({ row: rowNum, code: row.question_code, error: rowErr.message });
        results.skipped++;
      }
    }

    res.json({
      ok: true,
      total: records.length,
      created: results.created,
      updated: results.updated,
      skipped: results.skipped,
      errors: results.errors.slice(0, 50),
    });
  } catch (err: any) {
    console.error('[POST /lbi/admin/questions/import]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ─── Admin: GET /api/lbi/admin/modules ───
router.get('/admin/modules', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(lbiModules)
      .orderBy(asc(lbiModules.sortOrder));
    res.json(rowsToSnake(rows));
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Admin: PATCH /api/lbi/admin/modules/:id ───
router.patch('/admin/modules/:id', async (req, res) => {
  try {
    const { moduleName, description, isActive, sortOrder } = req.body;
    const updates: Record<string, any> = {};
    if (moduleName != null) updates.moduleName = moduleName;
    if (description != null) updates.description = description;
    if (isActive != null) updates.isActive = isActive;
    if (sortOrder != null) updates.sortOrder = sortOrder;

    await db
      .update(lbiModules)
      .set(updates)
      .where(eq(lbiModules.id, Number(req.params.id)));

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ════════════════════════════════════════════════════════
// CUSTOM ASSESSMENT MODULES
// ════════════════════════════════════════════════════════

// GET /api/lbi/admin/custom-modules
// Schema mismatch (Drizzle schema missing many columns) — kept as pool.query
router.get('/admin/custom-modules', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, module_code, module_name, description, icon_key, color, sort_order,
              is_active, status, domain_selections, settings, total_questions,
              estimated_duration_minutes, package_ids, published_at, created_at, updated_at,
              category, subcategory
       FROM custom_assessment_modules
       ORDER BY sort_order ASC, created_at DESC`
    );
    res.json(rows);
  } catch (err: any) {
    console.error('[GET /lbi/admin/custom-modules]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /api/lbi/admin/custom-modules
// Schema mismatch — kept as pool.query
router.post('/admin/custom-modules', async (req, res) => {
  try {
    const { module_code, module_name, description, icon_key, color, sort_order, domain_selections, package_ids, settings, status, category, subcategory } = req.body;
    if (!module_code || !module_name) return res.status(400).json({ error: 'module_code and module_name are required' });

    const selections: any[] = Array.isArray(domain_selections) ? domain_selections : [];
    const totalQ = selections.reduce((sum: number, d: any) =>
      sum + (Array.isArray(d.subdomains) ? d.subdomains.reduce((s: number, sd: any) => s + (Number(sd.question_count) || 0), 0) : 0), 0);

    // Use time limit from settings if time-restricted; else estimate 1.5 min/question
    const settingsObj = settings && typeof settings === 'object' ? settings : {};
    const estMin = settingsObj.time_restricted && settingsObj.time_limit_minutes
      ? Number(settingsObj.time_limit_minutes)
      : Math.ceil(totalQ * 1.5);

    const pkgIds = Array.isArray(package_ids) ? package_ids : [];
    const moduleStatus = status === 'published' ? 'published' : 'draft';

    const { rows } = await pool.query(
      `INSERT INTO custom_assessment_modules
         (module_code, module_name, description, icon_key, color, sort_order, domain_selections,
          total_questions, estimated_duration_minutes, package_ids, settings, status, published_at,
          category, subcategory)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [module_code, module_name, description || null, icon_key || 'Layers', color || '#344E86', sort_order || 0,
       JSON.stringify(selections), totalQ, estMin, pkgIds, JSON.stringify(settingsObj), moduleStatus,
       moduleStatus === 'published' ? new Date() : null,
       category || '', subcategory || '']
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Module code already exists' });
    console.error('[POST /lbi/admin/custom-modules]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// PUT /api/lbi/admin/custom-modules/:id
// Schema mismatch — kept as pool.query
router.put('/admin/custom-modules/:id', async (req, res) => {
  try {
    const { module_name, description, icon_key, color, sort_order, is_active, domain_selections, package_ids, settings, status, category, subcategory } = req.body;
    const selections: any[] = Array.isArray(domain_selections) ? domain_selections : [];
    const totalQ = selections.reduce((sum: number, d: any) =>
      sum + (Array.isArray(d.subdomains) ? d.subdomains.reduce((s: number, sd: any) => s + (Number(sd.question_count) || 0), 0) : 0), 0);
    const settingsObj = settings && typeof settings === 'object' ? settings : {};
    const estMin = settingsObj.time_restricted && settingsObj.time_limit_minutes
      ? Number(settingsObj.time_limit_minutes)
      : Math.ceil(totalQ * 1.5);
    const pkgIds = Array.isArray(package_ids) ? package_ids : [];

    // Fetch existing to preserve published_at if already published
    const existing = await pool.query(`SELECT status, published_at FROM custom_assessment_modules WHERE id = $1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    const wasPublished = existing.rows[0].status === 'published';
    const newStatus = status || existing.rows[0].status;
    const publishedAt = newStatus === 'published' ? (existing.rows[0].published_at || new Date()) : null;

    const { rows } = await pool.query(
      `UPDATE custom_assessment_modules SET
         module_name = COALESCE($1, module_name),
         description = COALESCE($2, description),
         icon_key    = COALESCE($3, icon_key),
         color       = COALESCE($4, color),
         sort_order  = COALESCE($5, sort_order),
         is_active   = COALESCE($6, is_active),
         domain_selections = $7,
         total_questions = $8,
         estimated_duration_minutes = $9,
         package_ids = $10,
         settings    = $11,
         status      = $12,
         published_at = $13,
         category    = COALESCE($15, category),
         subcategory = COALESCE($16, subcategory),
         updated_at  = NOW()
       WHERE id = $14
       RETURNING *`,
      [module_name || null, description ?? null, icon_key || null, color || null,
       sort_order ?? null, is_active ?? null, JSON.stringify(selections), totalQ, estMin, pkgIds,
       JSON.stringify(settingsObj), newStatus, publishedAt, req.params.id,
       category ?? null, subcategory ?? null]
    );
    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(rows[0]);
  } catch (err: any) {
    console.error('[PUT /lbi/admin/custom-modules/:id]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// PATCH /api/lbi/admin/custom-modules/:id/publish  — publish or unpublish
// Schema mismatch — kept as pool.query
router.patch('/admin/custom-modules/:id/publish', async (req, res) => {
  try {
    const { action } = req.body; // 'publish' | 'unpublish' | 'archive'
    const statusMap: Record<string, string> = { publish: 'published', unpublish: 'draft', archive: 'archived' };
    const newStatus = statusMap[action] || 'draft';
    const { rows } = await pool.query(
      `UPDATE custom_assessment_modules
       SET status = $1, published_at = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [newStatus, newStatus === 'published' ? new Date() : null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(rows[0]);
  } catch (err: any) {
    console.error('[PATCH /lbi/admin/custom-modules/:id/publish]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// DELETE /api/lbi/admin/custom-modules/:id
router.delete('/admin/custom-modules/:id', async (req, res) => {
  try {
    await db.delete(customAssessmentModules).where(eq(customAssessmentModules.id, req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[DELETE /lbi/admin/custom-modules/:id]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// PATCH /api/lbi/admin/custom-modules/:id/link-packages
// Schema mismatch — kept as pool.query
router.patch('/admin/custom-modules/:id/link-packages', async (req, res) => {
  try {
    const { package_ids } = req.body;
    const pkgIds = Array.isArray(package_ids) ? package_ids : [];
    const { rows } = await pool.query(
      `UPDATE custom_assessment_modules SET package_ids = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [pkgIds, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(rows[0]);
  } catch (err: any) {
    console.error('[PATCH /lbi/admin/custom-modules/:id/link-packages]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESPONDENT-FACING: Custom Module Catalogue & Sessions
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/lbi/custom-modules — published module catalogue (optionally filtered by package)
// Schema mismatch — kept as pool.query
router.get('/custom-modules', async (req, res) => {
  try {
    const { packageId } = req.query;
    let sqlStr = `SELECT id, module_name, description, total_questions, domain_selections,
                      settings, package_ids, status, created_at
               FROM custom_assessment_modules
               WHERE status = 'published'`;
    const params: any[] = [];
    if (packageId) {
      params.push(String(packageId));
      sqlStr += ` AND $1 = ANY(package_ids)`;
    }
    sqlStr += ` ORDER BY created_at DESC`;
    const { rows } = await pool.query(sqlStr, params);
    res.json(rows);
  } catch (err: any) {
    console.error('[GET /lbi/custom-modules]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/lbi/custom-modules/:id — single published module detail
// Schema mismatch — kept as pool.query
router.get('/custom-modules/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, module_name, description, total_questions, domain_selections, settings, status, created_at
       FROM custom_assessment_modules WHERE id = $1 AND status = 'published'`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(rows[0]);
  } catch (err: any) {
    console.error('[GET /lbi/custom-modules/:id]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /api/lbi/sessions/custom — start a custom module session (draws questions from MongoDB)
// Complex multi-source logic — kept as pool.query
router.post('/sessions/custom', async (req, res) => {
  try {
    const { customModuleId, packageId, respondentId } = req.body;
    if (!customModuleId) return res.status(400).json({ error: 'customModuleId required' });

    const userId = (req as any).user?.id || respondentId;
    if (!userId) return res.status(400).json({ error: 'respondentId required' });

    // Load module definition
    const { rows: mods } = await pool.query(
      `SELECT * FROM custom_assessment_modules WHERE id = $1 AND status = 'published'`,
      [customModuleId]
    );
    if (!mods.length) return res.status(404).json({ error: 'Module not found or not published' });
    const mod = mods[0];

    // Check for existing in-progress session
    const existingSessions = await db
      .select({ id: customModuleSessions.id })
      .from(customModuleSessions)
      .where(
        and(
          eq(customModuleSessions.respondentId, String(userId)),
          eq(customModuleSessions.customModuleId, customModuleId),
          eq(customModuleSessions.status, 'in_progress')
        )
      )
      .limit(1);

    if (existingSessions.length) {
      return res.json({ sessionId: existingSessions[0].id, resumed: true });
    }

    // Draw questions from MongoDB based on domain_selections
    const selections: any[] = mod.domain_selections || [];
    const drawnQuestions: any[] = [];

    for (const sel of selections) {
      const { domain_code, subdomain_code, question_count = 5 } = sel;
      const filter: any = {};
      if (domain_code) filter.domain_code = domain_code;
      if (subdomain_code) filter.subdomain_code = subdomain_code;

      const questionPool = await ExamReadyQuestion.aggregate([
        { $match: filter },
        { $sample: { size: Number(question_count) } },
        { $project: { _id: 1, question_text: 1, options: 1, question_type: 1, domain_code: 1, subdomain_code: 1 } },
      ]);
      drawnQuestions.push(...questionPool);
    }

    // Shuffle drawn questions
    for (let i = drawnQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [drawnQuestions[i], drawnQuestions[j]] = [drawnQuestions[j], drawnQuestions[i]];
    }

    // Determine attempt number
    const prevAttempts = await db
      .select({ cnt: sql<string>`COUNT(*)` })
      .from(customModuleSessions)
      .where(
        and(
          eq(customModuleSessions.respondentId, String(userId)),
          eq(customModuleSessions.customModuleId, customModuleId)
        )
      );

    const attemptNumber = parseInt(prevAttempts[0]?.cnt || '0') + 1;

    // Create session
    const sess = await db
      .insert(customModuleSessions)
      .values({
        respondentId: String(userId),
        customModuleId,
        packageId: packageId || null,
        drawnQuestions: JSON.stringify(drawnQuestions),
        attemptNumber,
      })
      .returning({
        id: customModuleSessions.id,
        startedAt: customModuleSessions.startedAt,
        attemptNumber: customModuleSessions.attemptNumber,
      });

    res.status(201).json({
      sessionId: sess[0].id,
      startedAt: sess[0].startedAt,
      attemptNumber: sess[0].attemptNumber,
      totalQuestions: drawnQuestions.length,
      resumed: false,
    });
  } catch (err: any) {
    console.error('[POST /lbi/sessions/custom]', err?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', detail: err?.message });
  }
});

export default router;
