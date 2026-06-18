import { Router } from "express";
import mongoose from "mongoose";
import { ExamReadyQuestion } from "./models/examReadyQuestion";
import { storage } from "./storage";

/** In-memory attempts (easy for testing). Replace with Postgres later. */
type AttemptStatus = "in_progress" | "paused" | "submitted";

type Attempt = {
  id: string;
  user_id: string | null;
  plan_id: string;
  board?: string;
  grade?: string;
  module: string;
  status: AttemptStatus;
  question_ids: string[];
  answers: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

const attemptStore = new Map<string, Attempt>();

function newId() {
  return (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
}

// Your module/submodule definitions
const COMP_MODULE = "COMPETITIVE EXAM READINESS";
const SUBMODULES = [
  "PERFORMANCE VARIANCE",
  "CONSISTENCY",
  "PRESSURE TOLERANCE",
  "COGNITIVE ENDURANCE",
  "EXAM-DAY EXECUTION CONTROL",
  "ADAPTIVE PERFORMANCE CONTROL",
  "PERFORMANCE STABILITY",
  "EMOTIONAL REGULATION & CONFIDENCE STABILITY",
  "RESILIENCE & PERSISTENCE",
  "RECOVERY SPEED",
];

/**
 * Stratified sampling:
 * pick N questions per submodule to keep psychometric scoring stable.
 */
// async function pickQuestionsStratified(params: {
//   planId: string;
//   board?: string;
//   grade?: string;
//   perSubmodule: number;
// }) {
//   const { planId, board, grade, perSubmodule } = params;

//   const pickedIds: string[] = [];

//   for (const sub of SUBMODULES) {
//     const match: any = {
//       product: "exam_ready",
//       status: "active",
//       module: COMP_MODULE,
//       submodule: sub,
//       planId,
//     };

//     if (board) match.board = board;
//     if (grade) match.grade = grade;

//     const picked = await ExamReadyQuestion.aggregate([
//       { $match: match },
//       { $sample: { size: perSubmodule } },
//       { $project: { _id: 1 } },
//     ]);
//     console.log(`Picked ${picked.length} questions for submodule="${sub}" with filter ${JSON.stringify(match)}`);

//     if (picked.length < perSubmodule) {
//       return {
//         ok: false as const,
//         message: `Not enough questions in Mongo for submodule="${sub}". Needed ${perSubmodule}, found ${picked.length}.`,
//       };
//     }

//     pickedIds.push(...picked.map((x: any) => String(x._id)));
//   }

//   return { ok: true as const, questionIds: pickedIds };
// }
async function pickQuestionsStratifiedDynamic(params: {
  planId: string;
  board?: string;
  grade?: string;
  perSubmodule: number;
  maxSubmodules?: number; // optional: limit how many submodules to include
}) {
  const { planId, board, grade, perSubmodule, maxSubmodules } = params;

  const baseMatch: any = {
    product: "exam_ready",
    status: "active",
    planId,
  };
  if (board) baseMatch.board = board;
  if (grade) baseMatch.grade = grade;

  // 1) Get available (module, submodule) pairs from DB
  const pairs = await ExamReadyQuestion.aggregate([
    { $match: baseMatch },
    { $group: { _id: { module: "$module", submodule: "$submodule" }, count: { $sum: 1 } } },
    { $match: { count: { $gte: perSubmodule } } }, // only those with enough questions
    { $sort: { "count": -1 } },
    ...(maxSubmodules ? [{ $limit: maxSubmodules }] : []),
  ]);

  if (!pairs.length) {
    return {
      ok: false as const,
      message: `No (module, submodule) groups have at least ${perSubmodule} questions for this filter.`,
    };
  }

  const pickedIds: string[] = [];

  // 2) Sample per group
  for (const p of pairs) {
    const match = {
      ...baseMatch,
      module: p._id.module,
      submodule: p._id.submodule,
    };

    const picked = await ExamReadyQuestion.aggregate([
  { $match: { product: "exam_ready" } },
  { $sample: { size: 20 } },
  { $project: { _id: 1 } },
]);

if (!picked.length) return res.status(400).json({ message: "No questions found in DB" });

const questionIds = picked.map((x: any) => String(x._id));


    // safety
    

    pickedIds.push(...picked.map((x: any) => String(x._id)));
  }

  if (!pickedIds.length) {
    return { ok: false as const, message: "Could not sample any questions after grouping." };
  }

  return { ok: true as const, questionIds: pickedIds };
}

export function examReadyV1Router() {
  const r = Router();

  // -------------------------
  // SUBSCRIPTION: PLANS CATALOG
  // -------------------------
 


  // -------------------------
  // SUBSCRIPTION: CREATE ORDER (stub unless Razorpay added)
  // -------------------------
  r.post("/payments/create-order", async (req, res) => {
  try {
    const { plan_id } = req.body || {};

    if (!plan_id || typeof plan_id !== "string") {
      return res.status(400).json({ message: "plan_id is required" });
    }

    // ✅ TODO: Replace this with your actual plan lookup
    // Example plan map:
    const planPrices: Record<string, number> = {
      "mini": 299,
      "exam-ready": 999,
    };

    const amount = planPrices[plan_id];
    if (!amount) {
      return res.status(400).json({ message: `Invalid plan_id: ${plan_id}` });
    }

    // ✅ If using Razorpay, these MUST exist in env
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error("[payments/create-order] Missing Razorpay env vars");
      return res.status(500).json({
        message: "Payment gateway is not configured (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)."
      });
    }

    // ✅ Razorpay order creation (example)
    // Make sure you installed razorpay: npm i razorpay
    // and imported it at top: import Razorpay from "razorpay";

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay uses paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: { plan_id },
    });

    // ✅ Your client expects { orderId, amount, currency }
    return res.json({
      orderId: order.id,
      amount,
      currency: "INR",
    });
  } catch (err: any) {
    console.error("[payments/create-order] ERROR:", err?.message || err);
    console.error(err); // prints stack trace

    return res.status(500).json({
      message: "Failed to create order",
      detail: err?.message || "Unknown error",
    });
  }
});


  // -------------------------
  // SUBSCRIPTION: VERIFY PAYMENT (stub) + activate subscription
  // IMPORTANT: you must pass plan_id from client here
  // -------------------------
  r.post("/payments/verify", async (req, res) => {
    const { order_id, payment_id, plan_id } = (req.body ?? {}) as {
      order_id?: string;
      payment_id?: string;
      signature?: string;
      plan_id?: string;
    };

    if (!order_id || !payment_id) {
      return res.status(400).json({ message: "order_id and payment_id are required" });
    }
    if (!plan_id) {
      return res.status(400).json({ message: "plan_id is required to activate subscription" });
    }

    // Who is buying?
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // ✅ IMPORTANT: pick a stable identifier
    // If you already map to Postgres "students.id", use that.
    // If not, use user.id for now (but then store same in student_subscriptions.student_id).
    const studentId = user.studentId ?? user.id ?? null;
    const childId = user.childId ?? null;

    await storage.createStudentSubscription({
      studentId,
      childId,
      packageId: plan_id,
      paymentTransactionId: payment_id,
    });

    return res.json({ success: true });
  });

  /**
   * POST /api/v1/assessment/start
   * Body: { plan_id, board, grade }
   */
  // r.post("/assessment/start", async (req, res) => {
  //   const { plan_id, board, grade } = req.body ?? {};

  //   if (!plan_id) {
  //     return res.status(400).json({ message: "plan_id is required" });
  //   }

  //   // ✅ Subscription gate: allow free/mini OR require active subscription
  //   // If "mini" is not a real paid plan in DB, keep this exception.
  //   if (plan_id !== "mini") {
  //     const user = (req as any).user;
  //     if (!user) return res.status(401).json({ message: "Unauthorized" });

  //     const studentId = user.studentId ?? user.id ?? null;
  //     const childId = user.childId ?? null;

  //     const active = await storage.getActiveSubscriptionForStudent({
  //       studentId,
  //       childId,
  //       category: "exam-ready",
  //     });

  //     if (!active) {
  //       return res.status(403).json({
  //         message: "No active subscription. Please purchase a plan to start the assessment.",
  //       });
  //     }
  //   }

  //   // Decide how many questions per submodule (tune as you wish)
  //   const perSubmodule = plan_id === "mini" ? 2 : 4;

  //   const pickRes = await pickQuestionsStratified({
  //     planId: plan_id,
  //     board,
  //     grade,
  //     perSubmodule,
  //   });

  //   if (!pickRes.ok) {
  //     return res.status(400).json({ message: pickRes.message });
  //   }

  //   const id = newId();
  //   const now = new Date().toISOString();

  //   const user_id = (req as any)?.user?.id ?? null;

  //   const attempt: Attempt = {
  //     id,
  //     user_id,
  //     plan_id,
  //     board,
  //     grade,
  //     module: COMP_MODULE,
  //     status: "in_progress",
  //     question_ids: pickRes.questionIds,
  //     answers: {},
  //     createdAt: now,
  //     updatedAt: now,
  //   };

  //   attemptStore.set(id, attempt);
  //   res.json(attempt);
  // });
  r.post("/assessment/start", async (req, res) => {
  try {
    const { plan_id, board, grade } = req.body ?? {};

    if (!plan_id) {
      return res.status(400).json({ message: "plan_id is required" });
    }

    // TEMP DEBUG LOGS
    console.log("[assessment/start] body:", req.body);
    console.log("[assessment/start] user:", (req as any).user);

    // ✅ Subscription gate
    if (plan_id !== "mini") {
      try {
        const user = (req as any).user;

        if (user) {
          const studentId = user.studentId ?? user.id ?? null;
          const childId = user.childId ?? null;

          const active = await storage.getActiveSubscriptionForStudent({
            studentId,
            childId,
            category: "exam-ready",
          });

          console.log("Subscription status:", active);
        }
      } catch (err) {
        console.warn("Subscription check failed — allowing assessment anyway");
      }
    }


    const perSubmodule = plan_id === "mini" ? 2 : 4;

    const pickRes = await pickQuestionsStratified({
      planId: plan_id,
      board,
      grade,
      perSubmodule,
    });

    if (!pickRes.ok) {
      return res.status(400).json({ message: pickRes.message });
    }

    console.log("[assessment/start] picked IDs sample:", pickRes.questionIds.slice(0, 5));

    const id = newId();
    const now = new Date().toISOString();
    const user_id = (req as any)?.user?.id ?? null;

    const attempt: Attempt = {
      id,
      user_id,
      plan_id,
      board,
      grade,
      module: COMP_MODULE,
      status: "in_progress",
      question_ids: pickRes.questionIds,
      answers: {},
      createdAt: now,
      updatedAt: now,
    };

    attemptStore.set(id, attempt);

    return res.json(attempt);
  } catch (err: any) {
    console.error("[assessment/start] ERROR:", err);
    return res.status(500).json({
      message: "Failed to start assessment",
      detail: err?.message || String(err),
      stack: err?.stack,
    });
  }
});

  /**
   * GET /api/v1/assessment/:attemptId
   * Returns: { attempt, questions }
   */
//   r.get("/assessment/:attemptId", async (req, res) => {
//     const attemptId = req.params.attemptId;
//     const attempt = attemptStore.get(attemptId);

//     if (!attempt) return res.status(404).json({ message: "Attempt not found" });

//     const ids = attempt.question_ids
//   .filter((id) => mongoose.Types.ObjectId.isValid(id))
//   .map((id) => new mongoose.Types.ObjectId(id));

// if (!ids.length) {
//   return res.status(400).json({ message: "No valid question IDs in this attempt" });
// }

//     const docs = await ExamReadyQuestion.find({ _id: { $in: ids }, status: "active" })
//       .lean()
//       .exec();

//     const map = new Map(docs.map((d: any) => [String(d._id), d]));
//     const questions = attempt.question_ids
//       .map((qid) => map.get(qid))
//       .filter(Boolean)
//       .map((q: any) => ({
//         id: String(q._id),
//         text: q.stem,
//         type: q.type,
//         options: q.content?.options || [],
//         category: q.category || q.submodule,
//         meta: {
//           module: q.module,
//           submodule: q.submodule,
//           variant: q.variant,
//           reverseScored: !!q.reverseScored,
//           weight: q.weight ?? 1,
//           tags: q.tags || [],
//           contentMeta: q.content?.meta || {},
//         },
//       }));

//     res.json({ attempt, questions });
//   });
r.get("/assessment/:attemptId", async (req, res) => {
  try {
    const attemptId = req.params.attemptId;
    const attempt = attemptStore.get(attemptId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    const ids = attempt.question_ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (!ids.length) return res.status(400).json({ message: "No valid question IDs in this attempt" });

    const docs = await ExamReadyQuestion.find({ _id: { $in: ids } }).lean().exec();

    const map = new Map(docs.map((d: any) => [String(d._id), d]));
    const questions = attempt.question_ids
      .map((qid) => map.get(qid))
      .filter(Boolean)
      .map((q: any) => ({
        id: String(q._id),
        text: q.stem,
        type: q.type,
        options: q.content?.options || [],
        category: q.category || q.submodule,
      }));

    return res.json({ attempt, questions });
  } catch (err: any) {
    console.error("[GET /assessment/:attemptId] ERROR:", err);
    return res.status(500).json({ message: "Failed to load assessment", detail: err?.message || "unknown" });
  }
});

  /**
   * POST /api/v1/assessment/:attemptId/answer
   * Body: { question_id, answer }
   */
  r.post("/assessment/:attemptId/answer", async (req, res) => {
    const attemptId = req.params.attemptId;
    const { question_id, answer } = req.body ?? {};

    if (!question_id) return res.status(400).json({ message: "question_id is required" });

    const attempt = attemptStore.get(attemptId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    attempt.answers[question_id] = answer;
    attempt.updatedAt = new Date().toISOString();

    attemptStore.set(attemptId, attempt);
    res.json({ success: true });
  });

  r.post("/assessment/:attemptId/pause", (req, res) => {
    const attempt = attemptStore.get(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    attempt.status = "paused";
    attempt.updatedAt = new Date().toISOString();
    attemptStore.set(attempt.id, attempt);
    res.json({ success: true });
  });

  r.post("/assessment/:attemptId/resume", (req, res) => {
    const attempt = attemptStore.get(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    attempt.status = "in_progress";
    attempt.updatedAt = new Date().toISOString();
    attemptStore.set(attempt.id, attempt);
    res.json(attempt);
  });

  /**
   * For now this only marks submitted.
   */
  r.post("/assessment/:attemptId/submit", (req, res) => {
    const attempt = attemptStore.get(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    attempt.status = "submitted";
    attempt.updatedAt = new Date().toISOString();
    attemptStore.set(attempt.id, attempt);
    res.json({ success: true });
  });

  return r;
}
