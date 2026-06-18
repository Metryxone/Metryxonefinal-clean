import { Router } from 'express';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/drizzle.js';
import {
  parentTests,
  parentTestAssignments,
  children,
  users,
} from '../db/schema.js';

const router = Router();
router.use(requireAuth);

// ─── PARENT: list their tests ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const tests = await db
      .select()
      .from(parentTests)
      .where(eq(parentTests.parentId, req.user!.id))
      .orderBy(desc(parentTests.createdAt));

    // Enrich with assignment stats
    const enriched = await Promise.all(
      tests.map(async t => {
        const assignments = await db
          .select({ status: parentTestAssignments.status })
          .from(parentTestAssignments)
          .where(eq(parentTestAssignments.testId, t.id));
        const assignedCount = assignments.length;
        const completedCount = assignments.filter(a => a.status === 'completed').length;
        return {
          id: t.id,
          title: t.title,
          subject: t.subject,
          description: t.description,
          duration: t.duration,
          totalMarks: t.totalMarks,
          questions: (t.questions as unknown[]) ?? [],
          status: t.status,
          createdAt: t.createdAt,
          assignedCount,
          completedCount,
        };
      })
    );
    res.json(enriched);
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── PARENT: create a new test ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { title, subject, description, duration, totalMarks, questions } = req.body as {
      title: string; subject: string; description?: string;
      duration?: number; totalMarks?: number; questions?: unknown[];
    };
    if (!title || !subject) return void res.status(400).json({ error: 'title and subject required' });

    const [test] = await db.insert(parentTests).values({
      parentId: req.user!.id,
      title,
      subject,
      description,
      duration: duration ?? 30,
      totalMarks: totalMarks ?? 0,
      questions: questions ?? [],
    }).returning();

    res.json(test);
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── PARENT: delete a test ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.delete(parentTests).where(
      and(eq(parentTests.id, req.params.id), eq(parentTests.parentId, req.user!.id))
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── PARENT: assignments list ─────────────────────────────────────────────────
router.get('/assignments', async (req, res) => {
  try {
    const myTests = await db
      .select({ id: parentTests.id })
      .from(parentTests)
      .where(eq(parentTests.parentId, req.user!.id));
    if (myTests.length === 0) return void res.json([]);

    const testIds = myTests.map(t => t.id);
    const assignments = await db
      .select({
        id: parentTestAssignments.id,
        testId: parentTestAssignments.testId,
        childId: parentTestAssignments.childId,
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
        childName: children.name,
      })
      .from(parentTestAssignments)
      .leftJoin(parentTests, eq(parentTestAssignments.testId, parentTests.id))
      .leftJoin(children, eq(parentTestAssignments.childId, children.id))
      .where(inArray(parentTestAssignments.testId, testIds))
      .orderBy(desc(parentTestAssignments.createdAt));

    res.json(assignments);
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── PARENT: results list ─────────────────────────────────────────────────────
router.get('/results', async (req, res) => {
  try {
    const myTests = await db
      .select({ id: parentTests.id })
      .from(parentTests)
      .where(eq(parentTests.parentId, req.user!.id));
    if (myTests.length === 0) return void res.json([]);

    const testIds = myTests.map(t => t.id);
    const results = await db
      .select({
        id: parentTestAssignments.id,
        testId: parentTestAssignments.testId,
        childId: parentTestAssignments.childId,
        status: parentTestAssignments.status,
        score: parentTestAssignments.score,
        totalMarks: parentTestAssignments.totalMarks,
        completedAt: parentTestAssignments.completedAt,
        testTitle: parentTests.title,
        testSubject: parentTests.subject,
        childName: children.name,
      })
      .from(parentTestAssignments)
      .leftJoin(parentTests, eq(parentTestAssignments.testId, parentTests.id))
      .leftJoin(children, eq(parentTestAssignments.childId, children.id))
      .where(and(
        inArray(parentTestAssignments.testId, testIds),
        eq(parentTestAssignments.status, 'completed')
      ))
      .orderBy(desc(parentTestAssignments.completedAt));

    res.json(results);
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── PARENT: assign a test to children ────────────────────────────────────────
router.post('/:id/assign', async (req, res) => {
  try {
    const { childIds, dueDate } = req.body as { childIds: string[]; dueDate?: string };
    if (!childIds || childIds.length === 0) {
      return void res.status(400).json({ error: 'No children selected' });
    }

    // Verify test belongs to parent
    const [test] = await db
      .select()
      .from(parentTests)
      .where(and(eq(parentTests.id, req.params.id), eq(parentTests.parentId, req.user!.id)));
    if (!test) return void res.status(404).json({ error: 'Test not found' });

    // Verify children belong to this parent
    const myChildren = await db
      .select({ id: children.id })
      .from(children)
      .where(and(
        inArray(children.id, childIds),
        eq(children.parentId, req.user!.id)
      ));
    const validChildIds = myChildren.map(c => c.id);

    // Create assignments (skip already-assigned ones)
    const existing = await db
      .select({ childId: parentTestAssignments.childId })
      .from(parentTestAssignments)
      .where(and(
        eq(parentTestAssignments.testId, req.params.id),
        inArray(parentTestAssignments.childId, validChildIds)
      ));
    const existingChildIds = new Set(existing.map(e => e.childId));
    const newChildIds = validChildIds.filter(id => !existingChildIds.has(id));

    if (newChildIds.length > 0) {
      await db.insert(parentTestAssignments).values(
        newChildIds.map(childId => ({
          testId: req.params.id,
          childId,
          parentId: req.user!.id,
          totalMarks: test.totalMarks,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        }))
      );
    }

    res.json({ assigned: newChildIds.length, skipped: validChildIds.length - newChildIds.length });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── STUDENT: start a parent-assigned test ───────────────────────────────────
router.post('/student/:assignmentId/start', async (req, res) => {
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

    // Update status to in_progress if still pending
    if (assignment.status === 'pending') {
      await db.update(parentTestAssignments)
        .set({ status: 'in_progress', startedAt: new Date() })
        .where(eq(parentTestAssignments.id, req.params.assignmentId));
    }

    // Return test data (without correct answers)
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
router.post('/student/:assignmentId/submit', async (req, res) => {
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

    // Score the answers
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
