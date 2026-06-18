import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { ExamReadyQuestion } from "../models/examReadyQuestion.js";
import { ExamReadyAttemptResult } from "../models/examReadyAttemptResult.js";
import { db } from "../db/drizzle.js";
import { examReadyAttempts, examReadyReports } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { query, pool } from "../db/client.js";
import { generateReportAsync } from "../services/reportGenerator.js";
import * as notifService from "../notifications/service.js";
import { trigger as scenarioTrigger } from "../notifications/scenarioEngine.js";
import * as fs from "fs";
import * as path from "path";

type AttemptStatus = "in_progress" | "paused" | "submitted";

type Attempt = {
  id: string;
  user_id: string | null;
  child_id?: string | null;
  student_name?: string | null;
  plan_id: string;
  pattern_type: string;
  domain_code?: string;
  subdomain_code?: string;
  age_band?: string;
  board?: string;
  grade?: string;
  status: AttemptStatus;
  question_ids: string[];
  answers: Record<string, any>;
  time_per_question: Record<string, number>; // questionId → seconds spent
  createdAt: string;
  updatedAt: string;
};

const attemptStore = new Map<string, Attempt>();

/** Helper: Get exam ready attempt from database */
async function getExamReadyAttempt(attemptId: string): Promise<any> {
  try {
    const rows = await db
      .select()
      .from(examReadyAttempts)
      .where(eq(examReadyAttempts.id, attemptId))
      .limit(1);
    return rows[0] || null;
  } catch (err) {
    console.error(`[getExamReadyAttempt] Error:`, err);
    return null;
  }
}

/** Helper: Create new exam ready attempt */
async function createExamReadyAttempt(data: any): Promise<void> {
  try {
    await db.insert(examReadyAttempts).values({
      id: data.id,
      userId: data.userId,
      childId: data.childId,
      planId: data.planId,
      patternType: data.patternType,
      domainCode: data.domainCode,
      subdomainCode: data.subdomainCode,
      ageBand: data.ageBand,
      board: data.board,
      grade: data.grade,
      studentName: data.studentName,
      status: data.status,
      questionIds: data.questionIds || [],
      answers: data.answers || {},
      timePerQuestion: data.timePerQuestion || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error(`[createExamReadyAttempt] Error:`, err);
  }
}

/** Helper: Update exam ready attempt */
async function updateExamReadyAttempt(id: string, data: any): Promise<void> {
  try {
    const updates: Partial<typeof examReadyAttempts.$inferInsert> = {
      updatedAt: new Date(),
    };

    let hasRealUpdate = false;

    if (data.status !== undefined) {
      updates.status = data.status;
      hasRealUpdate = true;
    }
    if (data.questionIds !== undefined) {
      updates.questionIds = data.questionIds;
      hasRealUpdate = true;
    }
    if (data.answers !== undefined) {
      updates.answers = data.answers;
      hasRealUpdate = true;
    }
    if (data.timePerQuestion !== undefined) {
      updates.timePerQuestion = data.timePerQuestion;
      hasRealUpdate = true;
    }

    if (!hasRealUpdate) return; // Only updatedAt, skip

    await db
      .update(examReadyAttempts)
      .set(updates)
      .where(eq(examReadyAttempts.id, id));
  } catch (err) {
    console.error(`[updateExamReadyAttempt] Error:`, err);
  }
}

/** Helper: Get active subscription for student */
async function getActiveSubscriptionForStudent(params: any): Promise<any> {
  try {
    const { studentId, childId, category } = params;

    const whereConditions = [];
    const values = [];
    let paramIndex = 1;

    if (studentId) {
      whereConditions.push(`student_id = $${paramIndex++}`);
      values.push(studentId);
    }
    if (childId) {
      whereConditions.push(`child_id = $${paramIndex++}`);
      values.push(childId);
    }
    if (category) {
      whereConditions.push(`category = $${paramIndex++}`);
      values.push(category);
    }

    whereConditions.push(`status = $${paramIndex++}`);
    values.push("active");

    const whereClause =
      whereConditions.length > 0 ? ` WHERE ${whereConditions.join(" AND ")}` : "";

    const result = await query(
      `SELECT * FROM parent_subscriptions${whereClause} LIMIT 1`,
      values
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error(`[getActiveSubscriptionForStudent] Error:`, err);
    return null;
  }
}

/** Get attempt from in-memory cache, falling back to DB */
async function resolveAttempt(attemptId: string): Promise<Attempt | null> {
  const cached = attemptStore.get(attemptId);
  if (cached) return cached;

  const dbRow = await getExamReadyAttempt(attemptId);
  if (!dbRow) return null;

  const attempt: Attempt = {
    id: dbRow.id,
    user_id: dbRow.userId,
    child_id: dbRow.childId,
    student_name: dbRow.studentName,
    plan_id: dbRow.planId,
    pattern_type: dbRow.patternType,
    domain_code: dbRow.domainCode ?? undefined,
    subdomain_code: dbRow.subdomainCode ?? undefined,
    age_band: dbRow.ageBand ?? undefined,
    board: dbRow.board ?? undefined,
    grade: dbRow.grade ?? undefined,
    status: dbRow.status as AttemptStatus,
    question_ids: dbRow.questionIds || [],
    answers: (typeof dbRow.answers === 'string' ? JSON.parse(dbRow.answers) : dbRow.answers) || {},
    time_per_question: (typeof dbRow.timePerQuestion === 'string' ? JSON.parse(dbRow.timePerQuestion) : dbRow.timePerQuestion) || {},
    createdAt: new Date(dbRow.createdAt).toISOString(),
    updatedAt: new Date(dbRow.updatedAt).toISOString(),
  };

  attemptStore.set(attemptId, attempt);
  return attempt;
}

/** Persist attempt state to DB (fire-and-forget) */
function persistAttempt(attempt: Attempt): void {
  updateExamReadyAttempt(attempt.id, {
    status: attempt.status,
    questionIds: attempt.question_ids,
    answers: attempt.answers,
    timePerQuestion: attempt.time_per_question,
  }).catch(err => console.error(`[persistAttempt] ${attempt.id}:`, err?.message));
}

/** Map grade string (e.g. "6","10","UG") → age band code used by scoring modules */
function gradeToAgeBand(grade?: string): string {
  if (!grade) return "B";
  const g = grade.replace(/\D/g, ""); // extract digits
  const num = parseInt(g, 10);
  if (!isNaN(num)) {
    if (num <= 7) return "A";
    if (num <= 9) return "B";
    if (num === 10) return "C";
    if (num <= 12) return "D";
  }
  const lower = grade.toLowerCase();
  if (lower.includes("ug") || lower.includes("undergrad")) return "E1";
  if (lower.includes("pg") || lower.includes("postgrad") || lower.includes("early")) return "E2";
  if (lower.includes("adult") || lower.includes("lifelong")) return "E3";
  return "B";
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

async function pickQuestionsDynamic(params: {
  patternType?: string;
  domainCode?: string;
  subdomainCode?: string;
  ageBand?: string;
  planId?: string;
  board?: string;
  grade?: string;
  perGroup: number;
  maxGroups?: number;
}) {
  const {
    patternType,
    domainCode,
    subdomainCode,
    ageBand,
    planId,
    board,
    grade,
    perGroup,
    maxGroups,
  } = params;

  const baseMatch: Record<string, any> = {
    status: { $in: ["Active", "active"] },
  };

  if (domainCode) baseMatch.domain_code = domainCode;
  if (subdomainCode) baseMatch.subdomain_code = subdomainCode;
  if (ageBand) baseMatch.age_band = ageBand;

  if (subdomainCode) {
    const picked = await ExamReadyQuestion.aggregate([
      { $match: baseMatch },
      { $sample: { size: perGroup * (maxGroups || 10) } },
      { $project: { _id: 1 } },
    ]);

    if (!picked.length) {
      return {
        ok: false as const,
        message: `No questions found for the given filters: ${JSON.stringify(baseMatch)}`,
      };
    }

    return {
      ok: true as const,
      questionIds: picked.map((x: any) => String(x._id)),
    };
  }

  const groups = await ExamReadyQuestion.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: {
          domain_code: "$domain_code",
          subdomain_code: "$subdomain_code",
        },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gte: 1 } } },
    { $sort: { count: -1 } },
    ...(maxGroups ? [{ $limit: maxGroups }] : []),
  ]);

  if (!groups.length) {
    return {
      ok: false as const,
      message: `No question groups found for filters: ${JSON.stringify(baseMatch)}`,
    };
  }

  const groupBuckets: string[][] = [];

  for (const g of groups) {
    const groupMatch = {
      ...baseMatch,
      domain_code: g._id.domain_code,
      subdomain_code: g._id.subdomain_code,
    };

    const sampleSize = Math.min(perGroup, g.count);
    const picked = await ExamReadyQuestion.aggregate([
      { $match: groupMatch },
      { $sample: { size: sampleSize } },
      { $project: { _id: 1 } },
    ]);

    if (picked.length > 0) {
      groupBuckets.push(picked.map((x: any) => String(x._id)));
    }
  }

  if (!groupBuckets.length) {
    return {
      ok: false as const,
      message: "Could not sample any questions after grouping.",
    };
  }

  // Round-robin interleave across groups
  const pickedIds: string[] = [];
  const maxLen = Math.max(...groupBuckets.map(b => b.length));
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of groupBuckets) {
      if (i < bucket.length) {
        pickedIds.push(bucket[i]);
      }
    }
  }

  return { ok: true as const, questionIds: pickedIds };
}

const router = Router();

router.get("/assessment/config", async (_req, res) => {
  try {
    const pipeline = [
      { $match: { status: { $in: ["Active", "active"] } } },
      {
        $group: {
          _id: null,
          domains: {
            $addToSet: {
              code: "$domain_code",
              name: "$domain_name",
            },
          },
          subdomains: {
            $addToSet: {
              code: "$subdomain_code",
              name: "$subdomain_name",
              domain_code: "$domain_code",
            },
          },
          ageBands: { $addToSet: "$age_band" },
          questionTypes: { $addToSet: "$question_type" },
          subdomainAgePairs: {
            $addToSet: {
              subdomain_code: "$subdomain_code",
              age_band: "$age_band",
            },
          },
          modules: { $addToSet: "$module" },
          submodules: { $addToSet: "$submodule" },
        },
      },
    ];

    const [result] = await ExamReadyQuestion.aggregate(pipeline);

    if (!result) {
      return res.json({
        domains: [],
        subdomains: [],
        ageBands: [],
        subdomainAgeBands: {},
        questionTypes: [],
        patternTypes: ["lbi", "exam-ready"],
        totalQuestions: 0,
      });
    }

    const clean = (arr: any[]) =>
      arr.filter((x) => x && (typeof x === "string" ? x.trim() : x.code));

    const sortedBands = clean(result.ageBands).sort((a: string, b: string) =>
      a.localeCompare(b)
    );

    const subdomainAgeBands: Record<string, string[]> = {};
    for (const pair of result.subdomainAgePairs || []) {
      if (!pair.subdomain_code || !pair.age_band) continue;
      if (!subdomainAgeBands[pair.subdomain_code]) {
        subdomainAgeBands[pair.subdomain_code] = [];
      }
      if (!subdomainAgeBands[pair.subdomain_code].includes(pair.age_band)) {
        subdomainAgeBands[pair.subdomain_code].push(pair.age_band);
      }
    }
    for (const key of Object.keys(subdomainAgeBands)) {
      subdomainAgeBands[key].sort((a, b) => a.localeCompare(b));
    }

    const totalQuestions = await ExamReadyQuestion.countDocuments({
      status: { $in: ["Active", "active"] },
    });

    const cleanDomains = clean(result.domains).filter(
      (d: any) => d.code && d.name
    );
    const cleanSubdomains = clean(result.subdomains).filter(
      (s: any) => s.code && s.name
    );

    const domainMap = new Map<string, any>();
    for (const d of cleanDomains) {
      if (!domainMap.has(d.code)) {
        domainMap.set(d.code, {
          code: d.code,
          name: d.name,
          subdomains: cleanSubdomains
            .filter((s: any) => s.domain_code === d.code)
            .map((s: any) => ({ code: s.code, name: s.name })),
        });
      }
    }

    return res.json({
      domains: Array.from(domainMap.values()),
      ageBands: sortedBands,
      subdomainAgeBands,
      questionTypes: clean(result.questionTypes),
      patternTypes: ["lbi", "exam-ready"],
      totalQuestions,
    });
  } catch (err: any) {
    console.error("[GET /assessment/config] ERROR:", err);
    return res.status(500).json({
      message: "Failed to load assessment config",
      detail: err?.message || "Unknown error",
    });
  }
});

router.get("/assessment/config/questions-count", async (req, res) => {
  try {
    const { domain_code, subdomain_code, age_band, question_type } =
      req.query as Record<string, string>;

    const match: Record<string, any> = {
      status: { $in: ["Active", "active"] },
    };
    if (domain_code) match.domain_code = domain_code;
    if (subdomain_code) match.subdomain_code = subdomain_code;
    if (age_band) match.age_band = age_band;
    if (question_type) match.question_type = question_type;

    const count = await ExamReadyQuestion.countDocuments(match);

    return res.json({ count, filters: match });
  } catch (err: any) {
    console.error("[GET /assessment/config/questions-count] ERROR:", err);
    return res.status(500).json({ message: "Failed to count questions" });
  }
});

router.post("/assessment/start", async (req, res) => {
  try {
    const {
      pattern_type = "lbi",
      domain_code,
      subdomain_code,
      age_band,
      plan_id,
      board,
      grade,
    } = req.body ?? {};

    console.log("[assessment/start] body:", req.body);

    if (plan_id && plan_id !== "mini") {
      try {
        const user = (req as any).user;
        if (user) {
          const studentId = user.studentId ?? user.id ?? null;
          const childId = user.childId ?? null;
          const active = await getActiveSubscriptionForStudent({
            studentId,
            childId,
            category: "exam-ready",
          });
          console.log("Subscription status:", active);
        }
      } catch (err) {
        console.warn(
          "Subscription check failed — allowing assessment anyway"
        );
      }
    }

    const perGroup = plan_id === "mini" ? 2 : 8;
    const pickRes = await pickQuestionsDynamic({
      patternType: pattern_type,
      domainCode: domain_code,
      subdomainCode: subdomain_code,
      ageBand: age_band,
      planId: plan_id,
      board,
      grade,
      perGroup,
      maxGroups: 20,
    });

    if (!pickRes.ok) {
      return res.status(400).json({ message: pickRes.message });
    }

    console.log(
      "[assessment/start] picked IDs count:",
      pickRes.questionIds.length
    );

    const finalIds = pickRes.questionIds;

    const id = newId();
    const now = new Date().toISOString();
    const user_id = (req as any)?.user?.id ?? null;

    const child_id = req.body?.child_id ?? null;
    const student_name = req.body?.student_name ?? null;

    const attempt: Attempt = {
      id,
      user_id,
      child_id,
      student_name,
      plan_id: plan_id || "dynamic",
      pattern_type,
      domain_code,
      subdomain_code,
      age_band,
      board,
      grade,
      status: "in_progress",
      question_ids: finalIds,
      answers: {},
      time_per_question: {},
      createdAt: now,
      updatedAt: now,
    };

    attemptStore.set(id, attempt);

    // Persist to DB
    createExamReadyAttempt({
      id,
      userId: user_id,
      childId: child_id,
      planId: attempt.plan_id,
      patternType: attempt.pattern_type,
      domainCode: attempt.domain_code,
      subdomainCode: attempt.subdomain_code,
      ageBand: attempt.age_band,
      board: attempt.board,
      grade: attempt.grade,
      studentName: student_name,
      status: attempt.status,
      questionIds: finalIds,
      answers: {},
    }).catch(err => console.error("[assessment/start] DB persist failed:", err?.message));

    // Fire exam.started scenario notification
    if (user_id) {
      setImmediate(() => {
        scenarioTrigger('exam.started', {
          recipientId: user_id,
          studentName: student_name || 'Student',
          testName: `${pattern_type?.toUpperCase() || 'Assessment'} - ${domain_code || 'General'}`,
        }).catch(() => {});
      });
    }

    return res.json({
      ...attempt,
      totalQuestions: attempt.question_ids.length,
    });
  } catch (err: any) {
    console.error("[assessment/start] ERROR:", err);
    return res.status(500).json({
      message: "Failed to start assessment",
      detail: err?.message || String(err),
    });
  }
});

router.post("/assessment/start-all", async (req, res) => {
  try {
    const { domain_code = "ACE", per_subdomain = 1, plan_id, board, grade, age_band, child_id, student_name } = req.body || {};
    const perSub = Number(per_subdomain) || 1;

    const subdomains = await (ExamReadyQuestion as any).distinct("subdomain_code", {
      domain_code,
      status: { $in: ["Active", "active"] },
    });

    if (!subdomains.length) {
      return res.status(404).json({ message: "No subdomains found" });
    }

    const perSubdomainIds: Record<string, string[]> = {};
    const breakdown: Record<string, number> = {};

    for (const sd of subdomains) {
      const match: Record<string, any> = {
        domain_code,
        subdomain_code: sd,
        status: { $in: ["Active", "active"] },
      };

      if (grade) match.grade = String(grade);

      let docs = await ExamReadyQuestion.aggregate([
        { $match: match },
        { $sample: { size: perSub } },
        { $project: { _id: 1 } },
      ]);

      // Fallback: no grade filter if no questions found for that grade
      if (docs.length === 0 && grade) {
        docs = await ExamReadyQuestion.aggregate([
          { $match: { domain_code, subdomain_code: sd, status: { $in: ["Active", "active"] } } },
          { $sample: { size: perSub } },
          { $project: { _id: 1 } },
        ]);
      }

      const ids = docs.map((d: any) => String(d._id));
      perSubdomainIds[sd] = ids;
      breakdown[sd] = ids.length;
    }

    // Round-robin interleave: one from each section in rotation
    const allIds: string[] = [];
    const sdKeys = Object.keys(perSubdomainIds);
    const maxLen = Math.max(...sdKeys.map(k => perSubdomainIds[k].length));
    for (let i = 0; i < maxLen; i++) {
      for (const sd of sdKeys) {
        if (i < perSubdomainIds[sd].length) {
          allIds.push(perSubdomainIds[sd][i]);
        }
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const user_id = (req as any)?.user?.id ?? null;

    const attempt: Attempt = {
      id,
      user_id,
      child_id: child_id || null,
      student_name: student_name || null,
      plan_id: plan_id || "mixed",
      pattern_type: "lbi",
      domain_code,
      subdomain_code: "ALL",
      age_band: age_band || gradeToAgeBand(grade),
      board,
      grade,
      status: "in_progress",
      question_ids: allIds,
      answers: {},
      time_per_question: {},
      createdAt: now,
      updatedAt: now,
    };

    attemptStore.set(id, attempt);

    // Persist to DB
    createExamReadyAttempt({
      id,
      userId: user_id,
      childId: child_id || null,
      planId: attempt.plan_id,
      patternType: attempt.pattern_type,
      domainCode: attempt.domain_code,
      subdomainCode: attempt.subdomain_code,
      ageBand: attempt.age_band,
      board: attempt.board,
      grade: attempt.grade,
      studentName: student_name || null,
      status: attempt.status,
      questionIds: allIds,
      answers: {},
    }).catch(err => console.error("[assessment/start-all] DB persist failed:", err?.message));

    return res.json({
      ...attempt,
      totalQuestions: allIds.length,
      breakdown,
    });
  } catch (err: any) {
    console.error("[assessment/start-all] ERROR:", err);
    return res.status(500).json({
      message: "Failed to start mixed assessment",
      detail: err?.message || String(err),
    });
  }
});

router.get("/assessment/:attemptId", async (req, res) => {
  try {
    const attemptId = req.params.attemptId;
    const attempt = await resolveAttempt(attemptId);
    if (!attempt)
      return res.status(404).json({ message: "Attempt not found" });

    const ids = attempt.question_ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (!ids.length)
      return res
        .status(400)
        .json({ message: "No valid question IDs in this attempt" });

    const docs = await ExamReadyQuestion.find({ _id: { $in: ids } })
      .lean()
      .exec();

    const map = new Map(docs.map((d: any) => [String(d._id), d]));

    const questions = attempt.question_ids
      .map((qid) => map.get(qid))
      .filter(Boolean)
      .map((q: any) => ({
        id: String(q._id),
        questionCode: q.question_id || String(q._id),
        text: q.statement || q.stem || q.questionText || "",
        type: q.question_type || q.type || "likert",
        passageText: q.passage_text || null,
        options:
          q.options?.length > 0
            ? q.options.map((o: any) => ({
              id: o.id,
              text: o.text,
              score: o.score,
            }))
            : q.content?.options?.map((o: any) => ({
              id: o.id,
              text: o.text,
              score: o.score,
              tag: o.tag || undefined,
              strategy: o.strategy || undefined,
              label: o.label || undefined,
            })) || [],
        category: q.domain_name || q.category || q.submodule || "",
        subcategory: q.subdomain_name || "",
        domainCode: q.domain_code || "",
        subdomainCode: q.subdomain_code || "",
        ageBand: q.age_band || "",
        meta: {
          reverseScored: q.reverse_scoring ?? q.reverseScored ?? false,
          weight: q.weight ?? 1,
          anchor: q.anchor || "No",
          correctAnswer: q.correct_answer || null,
          tags: q.tags || [],
        },
        ...(q.sub_questions ? {
          subQuestions: q.sub_questions.map((sq: any) => ({
            label: sq.label,
            text: sq.text,
            options: (sq.options || []).map((o: any) => ({ id: o.id, text: o.text, score: o.score })),
            correct_answer: sq.correct_answer || null,
          })),
        } : {}),
        ...(q.word_set ? { wordSet: q.word_set, moduleBWords: q.module_b_words || [], distractorPool: q.distractor_pool || [] } : {}),
        ...(q.primary_target ? {
          primaryTarget: q.primary_target,
          distractorsDescription: q.distractors_description,
          selectivity: q.selectivity,
          targetType: q.target_type,
          logicType: q.logic_type,
          stimulusType: q.stimulus_type,
          parsedTargets: q.parsed_targets || [],
          predecessor: q.predecessor || undefined,
        } : {}),
      }));

    return res.json({
      attempt: {
        ...attempt,
        totalQuestions: questions.length,
      },
      questions,
    });
  } catch (err: any) {
    console.error("[GET /assessment/:attemptId] ERROR:", err);
    return res.status(500).json({
      message: "Failed to load assessment",
      detail: err?.message || "unknown",
    });
  }
});

router.post("/assessment/:attemptId/swap-question", async (req, res) => {
  try {
    const attemptId = req.params.attemptId;
    const { question_id } = req.body ?? {};

    if (!question_id)
      return res.status(400).json({ message: "question_id is required" });

    const attempt = await resolveAttempt(attemptId);
    if (!attempt)
      return res.status(404).json({ message: "Attempt not found" });

    const currentQ = await ExamReadyQuestion.findOne({ _id: question_id }).lean();
    if (!currentQ)
      return res.status(404).json({ message: "Question not found" });

    const subdomain = (currentQ as any).subdomain_code;
    const domain = (currentQ as any).domain_code;

    if (!subdomain)
      return res.status(400).json({ message: "Question has no subdomain_code" });

    const existingIds = attempt.question_ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const [newDoc] = await ExamReadyQuestion.aggregate([
      {
        $match: {
          domain_code: domain,
          subdomain_code: subdomain,
          status: { $in: ["Active", "active"] },
          _id: { $nin: existingIds },
        },
      },
      { $sample: { size: 1 } },
    ]);

    if (!newDoc)
      return res.status(404).json({
        message: "No other questions available in this subdomain",
      });

    const newId = String(newDoc._id);

    const idx = attempt.question_ids.indexOf(question_id);
    if (idx >= 0) {
      attempt.question_ids[idx] = newId;
    }

    delete attempt.answers[question_id];
    attempt.updatedAt = new Date().toISOString();
    attemptStore.set(attemptId, attempt);
    persistAttempt(attempt);

    const q = newDoc;
    const newQuestion = {
      id: String(q._id),
      questionCode: q.question_id || String(q._id),
      text: q.statement || q.stem || q.questionText || "",
      type: q.question_type || q.type || "likert",
      passageText: q.passage_text || null,
      options:
        q.options?.length > 0
          ? q.options.map((o: any) => ({
            id: o.id,
            text: o.text,
            score: o.score,
          }))
          : q.content?.options?.map((o: any) => ({
            id: o.id,
            text: o.text,
            score: o.score,
            tag: o.tag || undefined,
            strategy: o.strategy || undefined,
            label: o.label || undefined,
          })) || [],
      category: q.domain_name || q.category || q.submodule || "",
      subcategory: q.subdomain_name || "",
      domainCode: q.domain_code || "",
      subdomainCode: q.subdomain_code || "",
      ageBand: q.age_band || "",
      meta: {
        reverseScored: q.reverse_scoring ?? q.reverseScored ?? false,
        weight: q.weight ?? 1,
        anchor: q.anchor || "No",
        correctAnswer: q.correct_answer || null,
        tags: q.tags || [],
      },
      ...(q.sub_questions
        ? {
          subQuestions: q.sub_questions.map((sq: any) => ({
            label: sq.label,
            text: sq.text,
            options: (sq.options || []).map((o: any) => ({
              id: o.id,
              text: o.text,
              score: o.score,
            })),
            correct_answer: sq.correct_answer || null,
          })),
        }
        : {}),
      ...(q.word_set
        ? {
          wordSet: q.word_set,
          moduleBWords: q.module_b_words || [],
          distractorPool: q.distractor_pool || [],
        }
        : {}),
      ...(q.primary_target
        ? {
          primaryTarget: q.primary_target,
          distractorsDescription: q.distractors_description,
          selectivity: q.selectivity,
          targetType: q.target_type,
          logicType: q.logic_type,
          stimulusType: q.stimulus_type,
          parsedTargets: q.parsed_targets || [],
          predecessor: q.predecessor || undefined,
        }
        : {}),
    };

    console.log(
      `[swap-question] ${question_id} → ${newId} (subdomain=${subdomain})`
    );

    return res.json({
      success: true,
      oldQuestionId: question_id,
      newQuestion,
    });
  } catch (err: any) {
    console.error("[assessment/swap-question] ERROR:", err);
    return res.status(500).json({
      message: "Failed to swap question",
      detail: err?.message || String(err),
    });
  }
});

router.post("/assessment/:attemptId/answer", async (req, res) => {
  const attemptId = req.params.attemptId;
  const { question_id, answer, time_spent_seconds } = req.body ?? {};

  if (!question_id)
    return res.status(400).json({ message: "question_id is required" });

  const attempt = await resolveAttempt(attemptId);
  if (!attempt)
    return res.status(404).json({ message: "Attempt not found" });

  attempt.answers[question_id] = answer;

  // Track time spent on this question (seconds)
  if (typeof time_spent_seconds === "number" && time_spent_seconds > 0) {
    if (!attempt.time_per_question) attempt.time_per_question = {};
    attempt.time_per_question[question_id] = time_spent_seconds;
  }

  attempt.updatedAt = new Date().toISOString();
  attemptStore.set(attemptId, attempt);
  persistAttempt(attempt);

  return res.json({ success: true });
});

router.post("/assessment/:attemptId/pause", async (_req, res) => {
  const attempt = await resolveAttempt(_req.params.attemptId);
  if (!attempt)
    return res.status(404).json({ message: "Attempt not found" });
  attempt.status = "paused";
  attempt.updatedAt = new Date().toISOString();
  attemptStore.set(attempt.id, attempt);
  persistAttempt(attempt);
  return res.json({ success: true });
});

router.post("/assessment/:attemptId/resume", async (_req, res) => {
  const attempt = await resolveAttempt(_req.params.attemptId);
  if (!attempt)
    return res.status(404).json({ message: "Attempt not found" });
  attempt.status = "in_progress";
  attempt.updatedAt = new Date().toISOString();
  attemptStore.set(attempt.id, attempt);
  persistAttempt(attempt);
  return res.json(attempt);
});

router.post("/assessment/:attemptId/submit", async (_req, res) => {
  const attempt = await resolveAttempt(_req.params.attemptId);
  if (!attempt)
    return res.status(404).json({ message: "Attempt not found" });

  const force = _req.body?.force === true; // timer-expiry forced submit
  const answeredCount = Object.keys(attempt.answers).length;
  const totalQuestions = attempt.question_ids.length;
  if (!force && answeredCount < totalQuestions) {
    return res.status(400).json({
      message: `Please answer all questions before submitting. ${answeredCount}/${totalQuestions} answered.`,
      answeredCount,
      totalQuestions,
    });
  }

  attempt.status = "submitted";
  attempt.updatedAt = new Date().toISOString();
  attemptStore.set(attempt.id, attempt);
  persistAttempt(attempt);

  // Fire exam.submitted scenario notifications — non-blocking
  if (attempt.user_id) {
    setImmediate(() => {
      scenarioTrigger('exam.submitted', {
        recipientId: String(attempt.user_id),
        testName: `${attempt.pattern_type?.toUpperCase() || 'Assessment'} - ${attempt.domain_code || attempt.id}`,
      }).catch(() => {});
    });
  }

  return res.json({ success: true, attempt });
});

router.post("/assessment/:attemptId/score", async (req, res) => {
  try {
    const attemptId = req.params.attemptId;
    const attempt = await resolveAttempt(attemptId);
    if (!attempt)
      return res.status(404).json({ message: "Attempt not found" });

    const questionIds = attempt.question_ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const questions = await ExamReadyQuestion.find({ _id: { $in: questionIds } } as any).lean();

    const subdomainAnswers: Record<string, Record<string, number>> = {};
    const subdomainAgeBand: Record<string, string> = {};

    for (const q of questions as any[]) {
      const mongoId = String(q._id);
      const subdomain = q.subdomain_code;
      let answer = attempt.answers[mongoId];

      if (!subdomain || answer === undefined) continue;

      if (!subdomainAnswers[subdomain]) subdomainAnswers[subdomain] = {};

      if (q.age_band && !subdomainAgeBand[subdomain]) {
        subdomainAgeBand[subdomain] = q.age_band;
      }

      // --- Handle ACE_SD02 (LES) ---
      if (subdomain === "ACE_SD02") {
        const parts = (q.question_id || "").split("_");
        const code = parts.length > 1 ? parts[1] : q.question_id; // "LE1"
        if (code) {
          // Answer is option ID (e.g. "A","B","opt_1"). Look up score from question options.
          let score = Number(answer);
          if (isNaN(score)) {
            const opts = q.options || q.content?.options || [];
            const opt = opts.find((o: any) => o.id === answer);
            if (opt?.score != null) {
              score = opt.score;
            } else {
              // Fallback: derive score from option index (1-based Likert)
              const idx = opts.findIndex((o: any) => o.id === answer);
              score = idx >= 0 ? idx + 1 : 0;
            }
          }
          subdomainAnswers[subdomain][code] = score;
        }
      }

      // --- Handle ACE_SD03 (CU-A2) ---
      if (subdomain === "ACE_SD03") {
        try {
          let parsedAns: any;
          try {
            parsedAns = typeof answer === "string" ? JSON.parse(answer) : answer;
          } catch {
            // Answer is a plain string option ID (e.g. "A") — single-question CU
            parsedAns = answer;
          }

          const subQ = q.sub_questions || [];
          if (subQ.length > 0 && typeof parsedAns === "object") {
            // Multi-sub-question format: parsedAns = {"0": "A", "1": "B", ...}
            if (subQ[0]) subdomainAnswers[subdomain]["CU1"] = subQ[0].correct_answer === parsedAns["0"] ? 1 : 0;
            if (subQ[1]) subdomainAnswers[subdomain]["CU2"] = subQ[1].correct_answer === parsedAns["1"] ? 1 : 0;
            if (subQ[2]) subdomainAnswers[subdomain]["CU3"] = subQ[2].correct_answer === parsedAns["2"] ? 1 : 0;
          } else {
            // Single question format: compare directly against correct_answer
            const qCode = q.question_id || "CU1";
            const key = qCode.includes("CU") ? qCode.split("_").pop() || "CU1" : "CU1";
            subdomainAnswers[subdomain][key] = (q.correct_answer === String(parsedAns)) ? 1 : 0;
          }
        } catch (e) {
          console.error("Failed to parse CU answer:", answer);
        }
      }

      // --- Handle ACE_SD04 (Memory Efficiency — 1C) ---
      if (subdomain === "ACE_SD04") {
        try {
          const parsedAns = typeof answer === "string" ? JSON.parse(answer) : answer;
          // Store the parsed answer along with the question's word lists for scoring
          (subdomainAnswers as any)[subdomain] = {
            answer: parsedAns,
            question: {
              wordSet: q.word_set || [],
              moduleBWords: q.module_b_words || [],
              distractorPool: q.distractor_pool || [],
            },
          };
        } catch (e) {
          console.error("Failed to parse Memory answer:", answer);
        }
      }

      // --- Handle ACE_SD05 (Task Attention — 1D) ---
      if (subdomain === "ACE_SD05") {
        try {
          const parsedAns = typeof answer === "string" ? JSON.parse(answer) : answer;
          // Store parsed attention answer (grid or stream mode JSON)
          (subdomainAnswers as any)[subdomain] = {
            answer: parsedAns,
          };
        } catch (e) {
          console.error("Failed to parse Attention answer:", answer);
        }
      }

      // --- Handle ACE_SD06 (Learning Strategy — 1E) ---
      if (subdomain === "ACE_SD06") {
        try {
          const parsedAns = typeof answer === "string" ? JSON.parse(answer) : answer;
          const qCode = q.question_id || mongoId; // e.g. "LS_Q01"
          if (!(subdomainAnswers as any)[subdomain]) {
            (subdomainAnswers as any)[subdomain] = {};
          }
          (subdomainAnswers as any)[subdomain][qCode] = {
            tag: parsedAns.tag || "",
            text: parsedAns.text || "",
            strategy: parsedAns.strategy || "",
            optionId: parsedAns.optionId || "",
          };
        } catch (e) {
          console.error("Failed to parse Learning Strategy answer:", answer);
        }
      }
    }

    const attemptAgeBand = attempt.age_band && attempt.age_band !== "ALL"
      ? attempt.age_band
      : gradeToAgeBand(attempt.grade);

    const results: Record<string, any> = {};

    if (subdomainAnswers["ACE_SD02"]) {
      const { scoreLES } = await import("../scoring/les.js");
      results["1A"] = scoreLES(subdomainAnswers["ACE_SD02"], subdomainAgeBand["ACE_SD02"] || attemptAgeBand);
    }

    if (subdomainAnswers["ACE_SD03"]) {
      const { scoreCU } = await import("../scoring/cu.js");
      results["1B"] = scoreCU(subdomainAnswers["ACE_SD03"], subdomainAgeBand["ACE_SD03"] || attemptAgeBand);
    }

    if ((subdomainAnswers as any)["ACE_SD04"]) {
      const { scoreMemory } = await import("../scoring/mem.js");
      const memData = (subdomainAnswers as any)["ACE_SD04"];
      results["1C"] = scoreMemory(
        memData.answer,
        memData.question,
        subdomainAgeBand["ACE_SD04"] || attemptAgeBand
      );
    }

    if ((subdomainAnswers as any)["ACE_SD05"]) {
      const { scoreAttention } = await import("../scoring/attention.js");
      const attData = (subdomainAnswers as any)["ACE_SD05"];
      // Extract self-report items (AT1-AT4) if present in answers
      const selfReport = attData.answer?.AT1 != null ? {
        AT1: Number(attData.answer.AT1) || 0,
        AT2: Number(attData.answer.AT2) || 0,
        AT3: Number(attData.answer.AT3) || 0,
        AT4: Number(attData.answer.AT4) || 0,
      } : undefined;
      results["1D"] = scoreAttention(
        attData.answer,
        subdomainAgeBand["ACE_SD05"] || attemptAgeBand,
        selfReport
      );
    }

    if ((subdomainAnswers as any)["ACE_SD06"]) {
      const { scoreLearningStrategy } = await import("../scoring/learningStrategy.js");
      results["1E"] = scoreLearningStrategy(
        (subdomainAnswers as any)["ACE_SD06"],
        subdomainAgeBand["ACE_SD06"] || attemptAgeBand
      );
    }

    console.log(`[score] attemptId=${attemptId}, subdomains scored: ${Object.keys(results).join(", ")}`);

    // Persist scores & trigger report generation
    try {
      // Compute overall score using dynamic config from DB
      const { loadScoringConfig, classifyScore } = await import("../scoring/configLoader.js");
      const scoringConfig = await loadScoringConfig();

      // Map module results to scores with dynamic domain weights
      const moduleMap: Record<string, { score: number; code: string }> = {};
      if (results["1A"]?.lesPercent != null) moduleMap["LES"] = { score: results["1A"].lesPercent, code: "1A" };
      if (results["1B"]?.cuPercent != null) moduleMap["CU"] = { score: results["1B"].cuPercent, code: "1B" };
      if (results["1C"]?.memPercent != null) moduleMap["MEM"] = { score: results["1C"].memPercent, code: "1C" };
      if (results["1D"]?.attentionIndex != null) moduleMap["ATT"] = { score: results["1D"].attentionIndex, code: "1D" };
      if (results["1E"]?.consistency?.ci != null) moduleMap["STR"] = { score: results["1E"].consistency.ci * 20, code: "1E" };

      // Use domain weights from DB config for weighted average
      let weightedSum = 0;
      let totalWeight = 0;
      for (const dw of scoringConfig.domainWeights) {
        const mod = moduleMap[dw.module_code];
        if (mod) {
          weightedSum += mod.score * dw.weight_percent;
          totalWeight += dw.weight_percent;
        }
      }

      // Fallback to simple average if no domain weights match
      const moduleScores = Object.values(moduleMap).map(m => m.score);
      const overallScore = totalWeight > 0
        ? weightedSum / totalWeight
        : moduleScores.length > 0
          ? moduleScores.reduce((a, b) => a + b, 0) / moduleScores.length
          : 0;

      // Use dynamic norms for readiness classification
      const readinessLevel = await classifyScore(overallScore, attemptAgeBand)
        .then(tier => {
          // Map norm tiers to readiness levels
          if (tier === 'Excellent' || tier === 'Proficient') return 'High';
          if (tier === 'Emerging' || tier === 'Developing') return 'Moderate';
          return 'Needs Attention';
        })
        .catch(() => {
          // Fallback to static thresholds if config not available
          return overallScore >= 70 ? "High" : overallScore >= 45 ? "Moderate" : "Needs Attention";
        });

      // Upsert into exam_ready_reports
      const existingRows = await db
        .select()
        .from(examReadyReports)
        .where(eq(examReadyReports.attemptId, attemptId))
        .limit(1);

      if (existingRows.length > 0) {
        await db
          .update(examReadyReports)
          .set({
            status: "processing",
            scoreData: results,
            overallScore: String(Math.round(overallScore * 10) / 10),
            readinessLevel,
            updatedAt: new Date(),
          })
          .where(eq(examReadyReports.attemptId, attemptId));
      } else {
        await db.insert(examReadyReports).values({
          attemptId,
          userId: attempt.user_id || null,
          childId: attempt.child_id || null,
          studentName: attempt.student_name || "Student",
          board: attempt.board || "",
          grade: attempt.grade || "",
          ageBand: attemptAgeBand,
          status: "processing",
          progress: 0,
          scoreData: results,
          overallScore: String(Math.round(overallScore * 10) / 10),
          readinessLevel,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Fire-and-forget report generation
      generateReportAsync(attemptId)
        .then(() => {
          // Fire report.published scenario notification after report is generated
          if (attempt.user_id) {
            scenarioTrigger('report.published', {
              recipientId: String(attempt.user_id),
              reportType: 'Exam Readiness',
              testName: `${attempt.pattern_type?.toUpperCase() || 'Assessment'} - ${attempt.domain_code || 'General'}`,
              studentName: attempt.student_name || 'Student',
            }).catch(() => {});
          }
        })
        .catch((e) => console.error("[score] report generation failed:", e));

      console.log(`[score] persisted scores for attemptId=${attemptId}, overall=${overallScore.toFixed(1)}, level=${readinessLevel}`);
    } catch (persistErr: any) {
      console.error("[score] Failed to persist scores (non-fatal):", persistErr?.message);
    }

    // Build combined scoring summary
    const moduleScoresSummary: { module: string; label: string; percent: number; band: string }[] = [];
    if (results["1A"]) moduleScoresSummary.push({ module: "1A", label: "Learning Efficiency", percent: Math.round(results["1A"].lesPercent || 0), band: results["1A"].band || "" });
    if (results["1B"]) moduleScoresSummary.push({ module: "1B", label: "Conceptual Understanding", percent: Math.round(results["1B"].cuPercent || 0), band: results["1B"].band || "" });
    if (results["1C"]) moduleScoresSummary.push({ module: "1C", label: "Memory Effectiveness", percent: Math.round(results["1C"].memPercent || 0), band: results["1C"].band || "" });
    if (results["1D"]) moduleScoresSummary.push({ module: "1D", label: "Task Attention", percent: Math.round(results["1D"].attentionIndex || 0), band: results["1D"].band || "" });
    if (results["1E"]) moduleScoresSummary.push({ module: "1E", label: "Learning Strategy", percent: Math.round((results["1E"].consistency?.ci || 0) * 20), band: results["1E"].combinedPatternLabel || "" });

    const combinedPercent = moduleScoresSummary.length > 0
      ? Math.round(moduleScoresSummary.reduce((sum, m) => sum + m.percent, 0) / moduleScoresSummary.length)
      : 0;
    const combinedLevel = combinedPercent >= 70 ? "High" : combinedPercent >= 45 ? "Moderate" : "Needs Attention";

    // Calculate total time taken
    const startedAt = new Date(attempt.createdAt);
    const submittedAt = new Date(attempt.updatedAt);
    const totalTimeTakenSeconds = Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000);

    // Persist to MongoDB (fire-and-forget)
    ExamReadyAttemptResult.findOneAndUpdate(
      { attemptId },
      {
        $set: {
          attemptId,
          userId: attempt.user_id || null,
          childId: attempt.child_id || null,
          studentName: attempt.student_name || "Student",
          planId: attempt.plan_id,
          patternType: attempt.pattern_type,
          domainCode: attempt.domain_code || null,
          subdomainCode: attempt.subdomain_code || null,
          ageBand: attemptAgeBand,
          board: attempt.board || "",
          grade: attempt.grade || "",
          questionIds: attempt.question_ids,
          answers: attempt.answers,
          totalQuestions: attempt.question_ids.length,
          answeredCount: Object.keys(attempt.answers).length,
          timePerQuestion: attempt.time_per_question || {},
          totalTimeTakenSeconds,
          startedAt,
          submittedAt,
          subdomainScores: results,
          overallScore: Math.round(combinedPercent * 10) / 10,
          readinessLevel: combinedLevel,
          moduleScores: moduleScoresSummary,
          status: "submitted",
        },
      },
      { upsert: true, new: true }
    ).catch((err: any) =>
      console.error("[score] MongoDB persist failed (non-fatal):", err?.message)
    );

    console.log(`[score] MongoDB: saved attempt result for attemptId=${attemptId}, totalTime=${totalTimeTakenSeconds}s`);

    // Free memory
    attemptStore.delete(attemptId);

    // Award gamification points for behavioral assessment completion — non-blocking
    const EXAM_READY_XP = 100;
    const EXAM_READY_COINS = 30;
    const awardStudentId = attempt.user_id;
    if (awardStudentId) {
      setImmediate(async () => {
        try {
          // Idempotency: skip if already awarded for this attempt
          const already = await pool.query(
            `SELECT 1 FROM xp_transactions WHERE user_id = $1 AND source = 'exam_ready_complete' AND reference_id = $2 LIMIT 1`,
            [awardStudentId, attemptId],
          );
          if (already.rows.length > 0) return;

          // Ensure gamification profile exists
          await pool.query(
            `INSERT INTO student_gamification (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
            [awardStudentId],
          );

          // Award XP
          await pool.query(
            `UPDATE student_gamification
             SET xp = xp + $2,
                 level = GREATEST(level, FLOOR(SQRT((xp + $2) / 50.0))::int + 1),
                 updated_at = NOW()
             WHERE user_id = $1`,
            [awardStudentId, EXAM_READY_XP],
          );
          await pool.query(
            `INSERT INTO xp_transactions (user_id, amount, source, reference_id) VALUES ($1, $2, 'exam_ready_complete', $3)`,
            [awardStudentId, EXAM_READY_XP, attemptId],
          );

          // Award coins
          const coinRes = await pool.query<{ coins: number }>(
            `UPDATE student_gamification SET coins = coins + $2, updated_at = NOW()
             WHERE user_id = $1 RETURNING coins`,
            [awardStudentId, EXAM_READY_COINS],
          );
          const coinBalance = coinRes.rows[0]?.coins ?? EXAM_READY_COINS;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 90);
          await pool.query(
            `INSERT INTO coin_transactions (user_id, amount, type, source, balance_after, expires_at, reference_id)
             VALUES ($1, $2, 'earn', 'exam_ready_complete', $3, $4, $5)`,
            [awardStudentId, EXAM_READY_COINS, coinBalance, expiresAt.toISOString(), attemptId],
          );
        } catch (e: any) {
          console.error('[ExamReady gamification award]', e?.message);
        }
      });
    }

    return res.json({
      success: true,
      attemptId,
      ageBand: attemptAgeBand,
      subdomainScores: results,
      combinedScore: {
        overallPercent: combinedPercent,
        readinessLevel: combinedLevel,
        modulesScored: moduleScoresSummary.length,
        modules: moduleScoresSummary,
      },
      answeredCount: Object.keys(attempt.answers).length,
      totalQuestions: attempt.question_ids.length,
      totalTimeTakenSeconds,
      timePerQuestion: attempt.time_per_question || {},
      pointsAwarded: awardStudentId ? { xp: EXAM_READY_XP, coins: EXAM_READY_COINS } : null,
    });
  } catch (err: any) {
    console.error("[assessment/score] ERROR:", err);
    return res.status(500).json({
      message: "Failed to compute scores",
      detail: err?.message || String(err),
    });
  }
});

router.post("/payments/create-order", async (req, res) => {
  try {
    const { plan_id } = req.body || {};

    if (!plan_id || typeof plan_id !== "string") {
      return res.status(400).json({ message: "plan_id is required" });
    }

    const planPrices: Record<string, number> = {
      mini: 299,
      "exam-ready": 999,
    };

    const amount = planPrices[plan_id];
    if (!amount) {
      return res.status(400).json({ message: `Invalid plan_id: ${plan_id}` });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error("[payments/create-order] Missing Razorpay env vars");
      return res.status(500).json({
        message:
          "Payment gateway is not configured (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET).",
      });
    }

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: { plan_id },
    });

    return res.json({
      orderId: order.id,
      amount,
      currency: "INR",
    });
  } catch (err: any) {
    console.error("[payments/create-order] ERROR:", err?.message || err);
    return res.status(500).json({
      message: "Failed to create order",
      detail: err?.message || "Unknown error",
    });
  }
});

router.post("/payments/verify", async (req, res) => {
  const { order_id, payment_id, plan_id } = (req.body ?? {}) as {
    order_id?: string;
    payment_id?: string;
    signature?: string;
    plan_id?: string;
  };

  if (!order_id || !payment_id) {
    return res
      .status(400)
      .json({ message: "order_id and payment_id are required" });
  }
  if (!plan_id) {
    return res
      .status(400)
      .json({ message: "plan_id is required to activate subscription" });
  }

  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const studentId = user.studentId ?? user.id ?? null;
  const childId = user.childId ?? null;

  try {
    // Kept as raw SQL: parent_subscriptions schema columns (student_id, category,
    // package_id, payment_transaction_id) don't match the Drizzle schema definition
    await query(
      `INSERT INTO parent_subscriptions
       (student_id, child_id, category, package_id, payment_transaction_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        studentId,
        childId,
        "exam-ready",
        plan_id,
        payment_id,
        "active",
        new Date(),
        new Date(),
      ]
    );
  } catch (err) {
    console.error("[payments/verify] DB error:", err);
    return res.status(500).json({ message: "Failed to create subscription" });
  }

  return res.json({ success: true });
});

// Helper: map score data → ReportSection[] for frontend
function buildSectionsFromScores(scores: Record<string, any>) {
  const sections: {
    name: string;
    score: number;
    maxScore: number;
    description: string;
    strengths: string[];
    areasToImprove: string[];
  }[] = [];

  if (scores["1A"]) {
    const d = scores["1A"];
    const strengths: string[] = [];
    const areas: string[] = [];
    if (d.itemInsights?.length) {
      for (const ins of d.itemInsights.slice(0, 3)) strengths.push(ins.teacher || ins.parent);
    }
    if (d.bandLabel) strengths.push(`Band: ${d.bandLabel}`);
    if (d.metacognitivePatternLabel) strengths.push(`Pattern: ${d.metacognitivePatternLabel}`);
    if (d.redFlags?.length) areas.push(...d.redFlags);
    if (d.intervention) areas.push(d.intervention);
    sections.push({
      name: "Learning Efficiency Scale",
      score: Math.round(d.lesPercent || 0),
      maxScore: 100,
      description: "Measures metacognitive awareness and learning strategy effectiveness",
      strengths: strengths.length ? strengths : ["Assessment completed"],
      areasToImprove: areas.length ? areas : ["Continue current strategies"],
    });
  }

  if (scores["1B"]) {
    const d = scores["1B"];
    const strengths: string[] = [];
    const areas: string[] = [];
    if (d.skillBreakdown?.length) {
      for (const s of d.skillBreakdown) {
        if (s.observation?.toLowerCase().includes("correct")) strengths.push(`${s.skill}: ${s.observation}`);
        else areas.push(`${s.skill}: ${s.observation}`);
      }
    }
    if (d.redFlags?.length) areas.push(...d.redFlags);
    if (d.intervention) areas.push(d.intervention);
    sections.push({
      name: "Conceptual Understanding",
      score: Math.round(d.cuPercent || 0),
      maxScore: 100,
      description: "Evaluates depth of comprehension and ability to apply concepts",
      strengths: strengths.length ? strengths : ["Assessment completed"],
      areasToImprove: areas.length ? areas : ["Continue building comprehension skills"],
    });
  }

  if (scores["1C"]) {
    const d = scores["1C"];
    const strengths: string[] = [];
    const areas: string[] = [];
    if (d.skillBreakdown?.length) {
      for (const s of d.skillBreakdown) {
        if (s.observation?.toLowerCase().includes("strong") || s.observation?.toLowerCase().includes("good")) {
          strengths.push(`${s.skill}: ${s.observation}`);
        } else {
          areas.push(`${s.skill}: ${s.observation}`);
        }
      }
    }
    if (d.redFlags?.length) areas.push(...d.redFlags);
    if (d.intervention) areas.push(d.intervention);
    sections.push({
      name: "Memory Effectiveness",
      score: Math.round(d.memPercent || 0),
      maxScore: 100,
      description: "Assesses encoding, retention, and recall capabilities",
      strengths: strengths.length ? strengths : ["Assessment completed"],
      areasToImprove: areas.length ? areas : ["Continue memory-building exercises"],
    });
  }

  if (scores["1D"]) {
    const d = scores["1D"];
    const strengths: string[] = [];
    const areas: string[] = [];
    if (d.skillBreakdown?.length) {
      for (const s of d.skillBreakdown) {
        if (s.observation?.toLowerCase().includes("strong") || s.observation?.toLowerCase().includes("good") || s.observation?.toLowerCase().includes("high")) {
          strengths.push(`${s.skill}: ${s.observation}`);
        } else {
          areas.push(`${s.skill}: ${s.observation}`);
        }
      }
    }
    if (d.redFlags?.length) areas.push(...d.redFlags);
    if (d.intervention) areas.push(d.intervention);
    sections.push({
      name: "Task Attention",
      score: Math.round(d.attentionIndex || 0),
      maxScore: 100,
      description: "Measures sustained attention, focus stability, and distraction resistance",
      strengths: strengths.length ? strengths : ["Assessment completed"],
      areasToImprove: areas.length ? areas : ["Continue focus-building activities"],
    });
  }

  if (scores["1E"]) {
    const d = scores["1E"];
    const strengths: string[] = [];
    const areas: string[] = [];
    if (d.preference?.primary) strengths.push(`Primary strategy: ${d.preference.primary}`);
    if (d.consistency?.level) strengths.push(`Consistency: ${d.consistency.level}`);
    if (d.adaptability?.level) strengths.push(`Adaptability: ${d.adaptability.level}`);
    if (d.studyTips?.length) areas.push(...d.studyTips.slice(0, 3));
    if (d.interventions?.length) {
      for (const intv of d.interventions) {
        if (intv.actions?.length) areas.push(...intv.actions.slice(0, 2));
      }
    }
    sections.push({
      name: "Learning Strategy",
      score: Math.round((d.consistency?.ci || 0) * 20),
      maxScore: 100,
      description: "Evaluates strategic learning preferences, consistency, and adaptability",
      strengths: strengths.length ? strengths : ["Assessment completed"],
      areasToImprove: areas.length ? areas : ["Explore diverse learning approaches"],
    });
  }

  return sections;
}

// GET /report/:attemptId/status
router.get("/report/:attemptId/status", async (req, res) => {
  try {
    const { attemptId } = req.params;
    const rows = await db
      .select()
      .from(examReadyReports)
      .where(eq(examReadyReports.attemptId, attemptId))
      .limit(1);

    const row = rows[0];

    if (!row) {
      return res.json({
        attemptId,
        status: "processing",
        progress: 0,
        estimatedTime: 30,
      });
    }

    return res.json({
      attemptId,
      status: row.status,
      progress: row.progress,
      estimatedTime: row.status === "ready" ? 0 : 15,
    });
  } catch (err: any) {
    console.error("[report/status] ERROR:", err);
    return res.status(500).json({ message: "Failed to get report status" });
  }
});

// GET /report/:attemptId/view
router.get("/report/:attemptId/view", async (req, res) => {
  try {
    const { attemptId } = req.params;
    const rows = await db
      .select()
      .from(examReadyReports)
      .where(eq(examReadyReports.attemptId, attemptId))
      .limit(1);

    const row = rows[0];

    if (!row) {
      return res.status(404).json({ message: "Report not found" });
    }

    const r: any = row;
    let scores: Record<string, any> = {};
    try {
      scores = typeof r.scoreData === "string" ? JSON.parse(r.scoreData || "{}") : (r.scoreData || {});
    } catch {
      scores = {};
    }

    let recommendations: string[] = [];
    try {
      recommendations = typeof r.recommendations === "string" ? JSON.parse(r.recommendations || "[]") : (r.recommendations || []);
    } catch {
      recommendations = [];
    }

    const sections = buildSectionsFromScores(scores);

    return res.json({
      attemptId: r.attemptId,
      studentName: r.studentName || "Student",
      grade: r.grade || "",
      board: r.board || "",
      ageBand: r.ageBand || "",
      completedAt: new Date(r.completedAt || r.createdAt).toISOString(),
      overallScore: Math.round(Number(r.overallScore) || 0),
      readinessLevel: r.readinessLevel || "Needs Attention",
      summary: r.summary || "Report is being generated...",
      pdfAvailable: !!r.pdfPath,
      sections,
      recommendations,
    });
  } catch (err: any) {
    console.error("[report/view] ERROR:", err);
    return res.status(500).json({ message: "Failed to get report" });
  }
});

// GET /report/:attemptId/download
router.get("/report/:attemptId/download", async (req, res) => {
  try {
    const { attemptId } = req.params;
    const rows = await db
      .select()
      .from(examReadyReports)
      .where(eq(examReadyReports.attemptId, attemptId))
      .limit(1);

    const row = rows[0];

    if (!row || !row.pdfPath) {
      return res.status(404).json({ message: "PDF not found or not yet generated" });
    }

    if (!fs.existsSync(row.pdfPath)) {
      return res.status(404).json({ message: "PDF file not found on disk" });
    }

    const filename = `MetryxOne_Report_${attemptId}_${new Date().toISOString().split("T")[0]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const stream = fs.createReadStream(row.pdfPath);
    stream.pipe(res);
  } catch (err: any) {
    console.error("[report/download] ERROR:", err);
    return res.status(500).json({ message: "Failed to download report" });
  }
});

export default router;
