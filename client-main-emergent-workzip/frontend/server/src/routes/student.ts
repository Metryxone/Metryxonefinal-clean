import { Router } from 'express';
import { eq, and, desc, asc, or } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/drizzle.js';
import {
  children,
  studyTasks,
  assessmentAssignments,
  subscriptionPackages,
  mentorBookings,
  users,
  parentTestAssignments,
  parentTests,
} from '../db/schema.js';

const router = Router();
router.use(requireAuth);

// Resolve the child record for the authenticated student user
async function resolveChild(userId: string) {
  const rows = await db
    .select()
    .from(children)
    .where(eq(children.studentUserId, userId))
    .limit(1);
  return rows[0] ?? null;
}

// GET /api/student/profile — return child profile for the logged-in student
router.get('/profile', async (req, res) => {
  try {
    const child = await resolveChild(req.user!.id);
    if (!child) return void res.status(404).json({ error: 'Child profile not found' });
    res.json(child);
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/student/study-tasks — list all study tasks for this student
router.get('/study-tasks', async (req, res) => {
  try {
    const child = await resolveChild(req.user!.id);
    if (!child) return void res.json([]);

    const tasks = await db
      .select()
      .from(studyTasks)
      .where(eq(studyTasks.childId, child.id))
      .orderBy(asc(studyTasks.dueDate), asc(studyTasks.createdAt));

    res.json(tasks.map(t => ({
      id: t.id,
      childId: t.childId,
      title: t.title,
      description: t.description,
      taskType: t.taskType,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      subject: t.subject,
      chapter: t.chapter,
      assignedBy: t.assignedBy,
      assignedByRole: t.assignedByRole,
      assignedByName: t.assignedByName,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
    })));
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// PUT /api/student/study-tasks/:id/complete — mark a task complete
router.put('/study-tasks/:id/complete', async (req, res) => {
  try {
    const child = await resolveChild(req.user!.id);
    if (!child) return void res.status(403).json({ error: 'Forbidden' });

    const [task] = await db
      .select({ id: studyTasks.id })
      .from(studyTasks)
      .where(and(eq(studyTasks.id, req.params.id), eq(studyTasks.childId, child.id)));
    if (!task) return void res.status(404).json({ error: 'Task not found' });

    await db
      .update(studyTasks)
      .set({ status: 'done', completedAt: new Date() })
      .where(eq(studyTasks.id, req.params.id));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// PUT /api/student/study-tasks/:id/status — set any status
router.put('/study-tasks/:id/status', async (req, res) => {
  try {
    const { status } = req.body as { status: string };
    if (!['pending', 'in_progress', 'done'].includes(status)) {
      return void res.status(400).json({ error: 'Invalid status' });
    }
    const child = await resolveChild(req.user!.id);
    if (!child) return void res.status(403).json({ error: 'Forbidden' });

    await db
      .update(studyTasks)
      .set({
        status,
        completedAt: status === 'done' ? new Date() : null,
      })
      .where(and(eq(studyTasks.id, req.params.id), eq(studyTasks.childId, child.id)));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/student/assignments — all assignments from parent, teacher, mentor
router.get('/assignments', async (req, res) => {
  try {
    const child = await resolveChild(req.user!.id);
    if (!child) return void res.json({ tests: [], tasks: [], sessions: [] });

    // 1. Assigned tests (from assessmentAssignments)
    const testRows = await db
      .select({
        id: assessmentAssignments.id,
        templateId: assessmentAssignments.templateId,
        status: assessmentAssignments.status,
        createdAt: assessmentAssignments.createdAt,
        startedAt: assessmentAssignments.startedAt,
        completedAt: assessmentAssignments.completedAt,
        productName: subscriptionPackages.productName,
        category: subscriptionPackages.category,
        questionCount: subscriptionPackages.questionCount,
        durationMinutes: subscriptionPackages.durationMinutes,
        description: subscriptionPackages.description,
        assignedByUserId: assessmentAssignments.assignedBy,
      })
      .from(assessmentAssignments)
      .leftJoin(subscriptionPackages, eq(assessmentAssignments.templateId, subscriptionPackages.id))
      .where(eq(assessmentAssignments.childId, child.id))
      .orderBy(desc(assessmentAssignments.createdAt));

    const tests = testRows.map(t => ({
      id: t.id,
      templateId: t.templateId,
      title: t.productName ?? 'Assessment',
      subject: t.category ?? '',
      status: t.status ?? 'pending',
      duration: t.durationMinutes ?? 60,
      totalMarks: t.questionCount ?? 0,
      description: t.description ?? '',
      assignedAt: t.createdAt,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      assignedByRole: 'parent',
    }));

    // 2. Study tasks
    const taskRows = await db
      .select()
      .from(studyTasks)
      .where(eq(studyTasks.childId, child.id))
      .orderBy(asc(studyTasks.dueDate), asc(studyTasks.createdAt));

    const tasks = taskRows.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      taskType: t.taskType,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      subject: t.subject,
      chapter: t.chapter,
      assignedByRole: t.assignedByRole ?? 'parent',
      assignedByName: t.assignedByName,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
    }));

    // 3. Booked mentor sessions
    let sessions: unknown[] = [];
    try {
      const sessionRows = await db
        .select()
        .from(mentorBookings)
        .where(eq(mentorBookings.childId, child.id))
        .orderBy(asc(mentorBookings.slotDate), asc(mentorBookings.startTime))
        .limit(10);

      sessions = sessionRows.map(s => ({
        id: s.id,
        mentorId: s.mentorId,
        status: s.status,
        scheduledAt: s.slotDate ? `${s.slotDate}T${s.startTime}` : undefined,
        topic: s.notes ?? 'Mentor Session',
        mode: s.mode,
      }));
    } catch { /* silent */ }

    // 4. Parent-created test assignments
    let parentTests2: unknown[] = [];
    try {
      const ptRows = await db
        .select({
          id: parentTestAssignments.id,
          testId: parentTestAssignments.testId,
          status: parentTestAssignments.status,
          score: parentTestAssignments.score,
          totalMarks: parentTestAssignments.totalMarks,
          dueDate: parentTestAssignments.dueDate,
          startedAt: parentTestAssignments.startedAt,
          completedAt: parentTestAssignments.completedAt,
          createdAt: parentTestAssignments.createdAt,
          testTitle: parentTests.title,
          testSubject: parentTests.subject,
          testDuration: parentTests.duration,
        })
        .from(parentTestAssignments)
        .leftJoin(parentTests, eq(parentTestAssignments.testId, parentTests.id))
        .where(eq(parentTestAssignments.childId, child.id))
        .orderBy(desc(parentTestAssignments.createdAt));

      parentTests2 = ptRows.map(r => ({
        id: r.id,
        templateId: undefined,
        title: r.testTitle ?? 'Test',
        subject: r.testSubject ?? '',
        status: r.status ?? 'pending',
        duration: r.testDuration ?? 30,
        totalMarks: r.totalMarks ?? 0,
        description: '',
        assignedAt: r.createdAt,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        score: r.score,
        dueDate: r.dueDate,
        assignedByRole: 'parent',
        isParentTest: true,
        assignmentId: r.id,
      }));
    } catch { /* silent */ }

    res.json({ tests: [...tests, ...parentTests2], tasks, sessions });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── STUDENT: start a parent-assigned test ───────────────────────────────────
router.post('/tests/:assignmentId/start', async (req, res) => {
  try {
    const [assignment] = await db
      .select({
        id: parentTestAssignments.id,
        childId: parentTestAssignments.childId,
        testId: parentTestAssignments.testId,
        status: parentTestAssignments.status,
        title: parentTests.title,
        subject: parentTests.subject,
        duration: parentTests.duration,
        totalMarks: parentTests.totalMarks,
        questions: parentTests.questions,
      })
      .from(parentTestAssignments)
      .leftJoin(parentTests, eq(parentTestAssignments.testId, parentTests.id))
      .where(eq(parentTestAssignments.id, req.params.assignmentId));

    if (!assignment) return void res.status(404).json({ error: 'Assignment not found' });

    if (assignment.status === 'pending') {
      await db.update(parentTestAssignments)
        .set({ status: 'in_progress', startedAt: new Date() })
        .where(eq(parentTestAssignments.id, req.params.assignmentId));
    }

    const questions = ((assignment.questions as unknown[]) ?? []).map((q: any) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options,
      marks: q.marks,
      section: q.section,
      negativeMarks: q.negativeMarks,
    }));

    res.json({
      assignmentId: assignment.id,
      testId: assignment.testId,
      title: assignment.title,
      subject: assignment.subject,
      duration: assignment.duration,
      totalMarks: assignment.totalMarks,
      questions,
    });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── STUDENT: submit a parent-assigned test ──────────────────────────────────
router.post('/tests/:assignmentId/submit', async (req, res) => {
  try {
    const { answers } = req.body as { answers: Record<string, string> };

    const [assignment] = await db
      .select({
        id: parentTestAssignments.id,
        totalMarks: parentTestAssignments.totalMarks,
        questions: parentTests.questions,
      })
      .from(parentTestAssignments)
      .leftJoin(parentTests, eq(parentTestAssignments.testId, parentTests.id))
      .where(eq(parentTestAssignments.id, req.params.assignmentId));

    if (!assignment) return void res.status(404).json({ error: 'Assignment not found' });

    const questions = (assignment.questions as any[]) ?? [];
    let score = 0;
    for (const q of questions) {
      const studentAnswer = (answers[q.id] ?? '').toLowerCase().trim();
      const correct = (q.correctAnswer ?? '').toLowerCase().trim();
      if (studentAnswer === correct) {
        score += q.marks ?? 1;
      } else if (q.negativeMarks) {
        score = Math.max(0, score - q.negativeMarks);
      }
    }

    await db.update(parentTestAssignments).set({
      status: 'completed',
      answers,
      score,
      completedAt: new Date(),
    }).where(eq(parentTestAssignments.id, req.params.assignmentId));

    res.json({ success: true, score, totalMarks: assignment.totalMarks });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
