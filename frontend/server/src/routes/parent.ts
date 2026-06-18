import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/drizzle.js';
import { pool } from '../db/client.js';
import {
  users,
  children,
  assessmentAssignments,
  subscriptionPackages,
  studentSubscriptions,
  assessmentDomains,
  packageDomainMapping,
  lbiQuestions,
  studyTasks,
} from '../db/schema.js';
import * as notifService from '../notifications/service.js';
import { trigger as scenarioTrigger } from '../notifications/scenarioEngine.js';
import { rowsToSnake } from '../db/utils.js';

const router = Router();
router.use(requireAuth);

function mapChild(row: typeof children.$inferSelect) {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    age: row.age,
    grade: row.grade,
    school: row.school,
    gender: row.gender,
    dateOfBirth: row.dateOfBirth,
    bloodGroup: row.bloodGroup,
    language: row.language,
    board: row.board,
    educationBoard: row.board,
    city: row.city,
    state: row.state,
    specialNeeds: row.specialNeeds,
    studyHoursPerDay: row.studyHoursPerDay ? parseFloat(String(row.studyHoursPerDay)) : undefined,
    favoriteSubjects: row.favoriteSubjects ?? [],
    weakSubjects: row.weakSubjects ?? [],
    learningStyle: row.learningStyle,
    careerInterest: row.careerInterest,
    relationship: row.relationship,
    schoolType: row.schoolType,
    medium: row.medium,
    extracurricular: row.extracurricular,
    emergencyContact: row.emergencyContact,
    medicalConditions: row.medicalConditions,
    studentUserId: row.studentUserId,
    consentGiven: row.consentGiven,
    lbiConsent: row.consentGiven,
    consentGivenAt: row.consentGivenAt,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get('/children', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(children)
      .where(eq(children.parentId, req.user!.id))
      .orderBy(asc(children.createdAt));
    res.json(rows.map(mapChild));
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

const childSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().min(1).max(25).optional(),
  grade: z.string().optional(),
  school: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  bloodGroup: z.string().optional(),
  language: z.string().optional(),
  board: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  specialNeeds: z.string().optional(),
  studyHoursPerDay: z.number().min(0).max(24).optional(),
  favoriteSubjects: z.array(z.string()).optional(),
  weakSubjects: z.array(z.string()).optional(),
  learningStyle: z.string().optional(),
  careerInterest: z.string().optional(),
  relationship: z.string().optional(),
  schoolType: z.string().optional(),
  medium: z.string().optional(),
  extracurricular: z.string().optional(),
  emergencyContact: z.string().optional(),
  medicalConditions: z.string().optional(),
  avatarUrl: z.string().optional(),
  lbiConsent: z.boolean().optional(),
  consentGiven: z.boolean().optional(),
});

function generateStudentCredentials(childName: string): { username: string; password: string } {
  const firstName = childName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const username = `${firstName}${suffix}`;
  const password = `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}@${suffix}`;
  return { username, password };
}

router.post('/children', validate(childSchema), async (req, res) => {
  try {
    const b = req.body;
    const consentGiven = b.lbiConsent ?? b.consentGiven ?? false;
    const consentGivenAt = consentGiven ? new Date().toISOString() : null;

    // Auto-generate student platform UID (sequence not in Drizzle schema, use raw SQL)
    const seqRow = await pool.query("SELECT nextval('student_uid_seq') AS n", []);
    const childPlatformId = 'MRX-S-' + String(seqRow.rows[0].n).padStart(5, '0');

    const [child] = await db
      .insert(children)
      .values({
        parentId: req.user!.id,
        name: b.name,
        age: b.age ?? null,
        grade: b.grade ?? null,
        school: b.school ?? null,
        gender: b.gender ?? null,
        dateOfBirth: b.dateOfBirth ?? null,
        bloodGroup: b.bloodGroup ?? null,
        language: b.language ?? null,
        board: b.board ?? null,
        city: b.city ?? null,
        state: b.state ?? null,
        specialNeeds: b.specialNeeds ?? null,
        studyHoursPerDay: b.studyHoursPerDay != null ? String(b.studyHoursPerDay) : null,
        favoriteSubjects: b.favoriteSubjects ?? [],
        weakSubjects: b.weakSubjects ?? [],
        learningStyle: b.learningStyle ?? null,
        careerInterest: b.careerInterest ?? null,
        relationship: b.relationship ?? null,
        schoolType: b.schoolType ?? null,
        medium: b.medium ?? null,
        extracurricular: b.extracurricular ?? null,
        emergencyContact: b.emergencyContact ?? null,
        medicalConditions: b.medicalConditions ?? null,
        avatarUrl: b.avatarUrl ?? null,
        consentGiven,
        consentGivenAt: consentGivenAt ? new Date(consentGivenAt) : null,
        platformId: childPlatformId,
      })
      .returning();

    // Auto-create a student account linked to this child
    const creds = generateStudentCredentials(b.name);
    const passwordHash = await bcrypt.hash(creds.password, 12);
    const [studentUser] = await db
      .insert(users)
      .values({
        fullName: b.name,
        username: creds.username,
        passwordHash,
        role: 'student',
        roles: ['student'],
        isVerified: true,
        metadata: { parentId: req.user!.id, childId: child.id },
      })
      .returning({ id: users.id });

    const [updatedChild] = await db
      .update(children)
      .set({ studentUserId: studentUser.id })
      .where(eq(children.id, child.id))
      .returning();

    res.status(201).json({
      ...mapChild(updatedChild),
      studentCredentials: { username: creds.username, password: creds.password },
    });
  } catch (err) {
    console.error('[POST /children]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.patch('/children/:id', validate(childSchema.partial()), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, id), eq(children.parentId, req.user!.id)));
    if (!existing.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    // Build a partial update object — only include fields that were provided
    const b = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (b.name !== undefined) updates.name = b.name;
    if (b.age !== undefined) updates.age = b.age;
    if (b.grade !== undefined) updates.grade = b.grade;
    if (b.school !== undefined) updates.school = b.school;
    if (b.gender !== undefined) updates.gender = b.gender;
    if (b.dateOfBirth !== undefined) updates.dateOfBirth = b.dateOfBirth;
    if (b.bloodGroup !== undefined) updates.bloodGroup = b.bloodGroup;
    if (b.language !== undefined) updates.language = b.language;
    if (b.board !== undefined) updates.board = b.board;
    if (b.city !== undefined) updates.city = b.city;
    if (b.state !== undefined) updates.state = b.state;
    if (b.specialNeeds !== undefined) updates.specialNeeds = b.specialNeeds;
    if (b.studyHoursPerDay !== undefined) updates.studyHoursPerDay = b.studyHoursPerDay != null ? String(b.studyHoursPerDay) : null;
    if (b.favoriteSubjects !== undefined) updates.favoriteSubjects = b.favoriteSubjects;
    if (b.weakSubjects !== undefined) updates.weakSubjects = b.weakSubjects;
    if (b.learningStyle !== undefined) updates.learningStyle = b.learningStyle;
    if (b.careerInterest !== undefined) updates.careerInterest = b.careerInterest;
    if (b.relationship !== undefined) updates.relationship = b.relationship;
    if (b.schoolType !== undefined) updates.schoolType = b.schoolType;
    if (b.medium !== undefined) updates.medium = b.medium;
    if (b.extracurricular !== undefined) updates.extracurricular = b.extracurricular;
    if (b.emergencyContact !== undefined) updates.emergencyContact = b.emergencyContact;
    if (b.medicalConditions !== undefined) updates.medicalConditions = b.medicalConditions;
    if (b.avatarUrl !== undefined) updates.avatarUrl = b.avatarUrl;

    const result = await db
      .update(children)
      .set(updates)
      .where(and(eq(children.id, id), eq(children.parentId, req.user!.id)))
      .returning();

    if (!result.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json(mapChild(result[0]));
  } catch (err) {
    console.error('[PATCH /children/:id]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.delete('/children/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db
      .delete(children)
      .where(and(eq(children.id, id), eq(children.parentId, req.user!.id)))
      .returning({ id: children.id });
    if (!deleted.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/children/:id/consent', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    if (!['grant', 'revoke'].includes(action)) {
      res.status(400).json({ error: 'INVALID_ACTION', message: "action must be 'grant' or 'revoke'" });
      return;
    }
    const consentValue = action === 'grant';
    const rows = await db
      .update(children)
      .set({
        consentGiven: consentValue,
        consentGivenAt: consentValue ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(children.id, id), eq(children.parentId, req.user!.id)))
      .returning();
    if (!rows.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json({ message: `Consent ${action}ed successfully.`, child: mapChild(rows[0]) });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/children/:id/study-tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const child = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, id), eq(children.parentId, req.user!.id)));
    if (!child.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    const tasks = await db
      .select()
      .from(studyTasks)
      .where(eq(studyTasks.childId, id))
      .orderBy(asc(studyTasks.dueDate), asc(studyTasks.createdAt));
    res.json(tasks);
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/children/:id/study-tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const child = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, id), eq(children.parentId, req.user!.id)));
    if (!child.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    const { title, description, taskType, priority, dueDate, estimatedMinutes, subject, chapter } = req.body as {
      title: string; description?: string; taskType?: string; priority?: string;
      dueDate?: string; estimatedMinutes?: number; subject?: string; chapter?: string;
    };
    if (!title) { res.status(400).json({ error: 'Title required' }); return; }

    const user = await db.select({ name: users.name }).from(users).where(eq(users.id, req.user!.id));
    const [task] = await db.insert(studyTasks).values({
      childId: id,
      title,
      description,
      taskType: taskType ?? 'study',
      priority: priority ?? 'Medium',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      estimatedMinutes,
      subject,
      chapter,
      assignedBy: req.user!.id,
      assignedByRole: 'parent',
      assignedByName: user[0]?.name ?? 'Parent',
    }).returning();
    res.json(task);
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.delete('/children/:childId/study-tasks/:taskId', async (req, res) => {
  try {
    const { childId, taskId } = req.params;
    const child = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, childId), eq(children.parentId, req.user!.id)));
    if (!child.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    await db.delete(studyTasks).where(and(eq(studyTasks.id, taskId), eq(studyTasks.childId, childId)));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const { childId } = req.query;
    const rows = await db
      .select()
      .from(children)
      .where(eq(children.parentId, req.user!.id))
      .orderBy(asc(children.createdAt));
    const mappedChildren = rows.map(mapChild);
    const selectedChild = childId
      ? (mappedChildren.find(c => c.id === childId) ?? mappedChildren[0] ?? null)
      : (mappedChildren[0] ?? null);

    // Fetch assigned assessments for the selected child
    let exams: any[] = [];
    if (selectedChild) {
      try {
        const assignments = await db
          .select({
            id: assessmentAssignments.id,
            templateId: assessmentAssignments.templateId,
            status: assessmentAssignments.status,
            createdAt: assessmentAssignments.createdAt,
            productName: subscriptionPackages.productName,
            category: subscriptionPackages.category,
            questionCount: subscriptionPackages.questionCount,
            durationMinutes: subscriptionPackages.durationMinutes,
            description: subscriptionPackages.description,
          })
          .from(assessmentAssignments)
          .leftJoin(subscriptionPackages, eq(assessmentAssignments.templateId, subscriptionPackages.id))
          .where(eq(assessmentAssignments.childId, selectedChild.id))
          .orderBy(desc(assessmentAssignments.createdAt));

        exams = assignments.map(a => ({
          id: a.id,
          templateId: a.templateId,
          title: a.productName ?? 'Assessment',
          subject: a.category ?? '',
          status: a.status ?? 'pending',
          duration: a.durationMinutes ?? 60,
          totalMarks: a.questionCount ?? 0,
          description: a.description ?? '',
          assignedAt: a.createdAt,
        }));
      } catch {}
    }

    const pending = exams.filter(e => e.status === 'pending').length;
    const completed = exams.filter(e => e.status === 'completed').length;

    res.json({
      children: mappedChildren,
      selectedChild,
      stats: selectedChild ? {
        totalExams: exams.length,
        completed,
        pending,
        avgScore: 0,
        onTimeRate: 0,
      } : null,
      exams,
      insights: [],
    });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/children/:childId/assigned-assessments — for student dashboard view
router.get('/children/:childId/assigned-assessments', async (req, res) => {
  const { childId } = req.params;
  try {
    const childRows = await db.select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, childId), eq(children.parentId, req.user!.id)));
    if (!childRows.length) { res.status(403).json({ error: 'Child not found' }); return; }

    const assignments = await db
      .select({
        id: assessmentAssignments.id,
        templateId: assessmentAssignments.templateId,
        status: assessmentAssignments.status,
        createdAt: assessmentAssignments.createdAt,
        productName: subscriptionPackages.productName,
        category: subscriptionPackages.category,
        questionCount: subscriptionPackages.questionCount,
        durationMinutes: subscriptionPackages.durationMinutes,
        description: subscriptionPackages.description,
        isRecommended: subscriptionPackages.isRecommended,
      })
      .from(assessmentAssignments)
      .leftJoin(subscriptionPackages, eq(assessmentAssignments.templateId, subscriptionPackages.id))
      .where(eq(assessmentAssignments.childId, childId))
      .orderBy(desc(assessmentAssignments.createdAt));

    res.json(assignments.map(a => ({
      id: a.id,
      templateId: a.templateId,
      title: a.productName ?? 'Assessment',
      subject: a.category ?? '',
      status: a.status ?? 'pending',
      duration: a.durationMinutes ?? 60,
      totalMarks: a.questionCount ?? 0,
      description: a.description ?? '',
      isRecommended: a.isRecommended,
      assignedAt: a.createdAt,
    })));
  } catch (err) {
    console.error('[GET /children/:childId/assigned-assessments]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

/**
 * Checks whether a child's grade (e.g. "Grade 8", "Class 8", "8") falls within
 * the student_segment stored in subscription_packages.
 * Handles: "Classes 6–12", "Classes 10 & 12", "JEE / NEET Aspirants",
 *          "All Students", "Classes 10–12 & UG", "Professionals & Institutions".
 */
function gradeMatchesSegment(gradeStr: string | undefined, segment: string): boolean {
  if (!gradeStr || !segment) return true;

  const seg = segment.trim();

  // Always show catch-all segments
  if (/^all students$/i.test(seg) || /^student$/i.test(seg)) return true;

  // Professional / institution packages are not for school students
  if (/professional|institution/i.test(seg)) return false;

  // JEE / NEET is relevant only for Class 11 and 12
  if (/jee|neet|aspirant/i.test(seg)) {
    const gm = gradeStr.match(/(\d+)/);
    if (!gm) return false;
    const g = parseInt(gm[1], 10);
    return g >= 11 && g <= 12;
  }

  // Extract the numeric grade from the child's grade string
  const gradeMatch = gradeStr.match(/(\d+)/);
  if (!gradeMatch) return true;
  const gradeNum = parseInt(gradeMatch[1], 10);

  // "Classes 10 & 12" — explicit list of classes separated by & or ,
  const listMatch = seg.match(/^Classes?\s+([\d\s,&]+)$/i);
  if (listMatch && !/[–\-]/.test(listMatch[1])) {
    const classNums = listMatch[1].match(/\d+/g)?.map(Number) ?? [];
    return classNums.includes(gradeNum);
  }

  // Parse range — handles en-dash (–) and hyphen (-), strip " & UG" suffix
  const rangeMatch = seg.match(/(\d+)\s*[–\-]\s*(\d+)/);
  if (!rangeMatch) return true; // unknown format — show by default
  const minClass = parseInt(rangeMatch[1], 10);
  const maxClass = parseInt(rangeMatch[2], 10);

  return gradeNum >= minClass && gradeNum <= maxClass;
}

/** Derive a difficulty label from question count. */
function difficultyFromCount(count: number | null): string {
  if (!count) return 'Medium';
  if (count <= 20) return 'Easy';
  if (count <= 60) return 'Medium';
  return 'Hard';
}

/** Derive an estimated duration (minutes) when duration_minutes is not stored. */
function estimateDuration(qcount: number | null): number {
  if (!qcount) return 20;
  return Math.max(10, Math.round((qcount * 1.5) / 5) * 5);
}

router.get('/assessment-templates', async (req, res) => {
  const { grade, childId } = req.query as { grade?: string; childId?: string };

  let assignedIds = new Set<string>();
  if (childId) {
    try {
      const rows = await db
        .select({ templateId: assessmentAssignments.templateId })
        .from(assessmentAssignments)
        .where(eq(assessmentAssignments.childId, childId));
      assignedIds = new Set(rows.map(r => r.templateId));
    } catch {}
  }

  try {
    const pkgs = await db
      .select({
        id: subscriptionPackages.id,
        productName: subscriptionPackages.productName,
        description: subscriptionPackages.description,
        category: subscriptionPackages.category,
        studentSegment: subscriptionPackages.studentSegment,
        questionCount: subscriptionPackages.questionCount,
        durationMinutes: subscriptionPackages.durationMinutes,
        sortOrder: subscriptionPackages.sortOrder,
        isRecommended: subscriptionPackages.isRecommended,
      })
      .from(subscriptionPackages)
      .where(and(
        eq(subscriptionPackages.isActive, true),
        eq(subscriptionPackages.pkgStatus, 'active')
      ))
      .orderBy(asc(subscriptionPackages.sortOrder));

    const filtered = pkgs
      .filter(p => gradeMatchesSegment(grade, p.studentSegment ?? ''))
      .map(p => ({
        id: p.id,
        title: p.productName,
        description: p.description ?? '',
        subject: p.category,
        grade: p.studentSegment ?? 'All grades',
        difficulty: difficultyFromCount(p.questionCount),
        duration: p.durationMinutes ?? estimateDuration(p.questionCount),
        questions: p.questionCount ?? 0,
        totalMarks: p.questionCount ?? 0,
        category: p.category,
        isRecommended: p.isRecommended,
        assigned: assignedIds.has(p.id),
      }));

    res.json(filtered);
  } catch (err) {
    console.error('[GET /assessment-templates]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/assessment-templates/:templateId/assign', async (req, res) => {
  const { templateId } = req.params;
  const { childId } = req.body;
  if (!childId) { res.status(400).json({ error: 'childId is required' }); return; }

  try {
    const pkgRows = await db
      .select({ id: subscriptionPackages.id, productName: subscriptionPackages.productName })
      .from(subscriptionPackages)
      .where(eq(subscriptionPackages.id, templateId));
    if (!pkgRows.length) { res.status(404).json({ error: 'Assessment module not found' }); return; }
    const pkg = pkgRows[0];

    const childRows = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, childId), eq(children.parentId, req.user!.id)));
    if (!childRows.length) { res.status(403).json({ error: 'Child not found' }); return; }

    await db
      .insert(assessmentAssignments)
      .values({ childId, templateId, status: 'pending' })
      .onConflictDoNothing({ target: [assessmentAssignments.childId, assessmentAssignments.templateId] });

    setImmediate(() => {
      scenarioTrigger('exam.assigned', {
        recipientId: childId,
        senderId: String(req.user!.id),
        testName: pkg.productName,
        assignedBy: 'Parent',
      }).catch(e => console.warn('[Parent] exam.assigned scenario failed (non-fatal):', e));
    });

    res.json({ success: true, message: `${pkg.productName} assigned successfully.` });
  } catch (err) {
    console.error('[POST /assessment-templates/:id/assign]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/subscription-packages', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: subscriptionPackages.id,
        category: subscriptionPackages.category,
        studentSegment: subscriptionPackages.studentSegment,
        productName: subscriptionPackages.productName,
        isRecommended: subscriptionPackages.isRecommended,
        domainsCovered: subscriptionPackages.domainsCovered,
        price: subscriptionPackages.price,
        priceMax: subscriptionPackages.priceMax,
        validityDays: subscriptionPackages.validityDays,
        questionCount: subscriptionPackages.questionCount,
        moduleCount: subscriptionPackages.moduleCount,
        modulesCovered: subscriptionPackages.modulesCovered,
        durationText: subscriptionPackages.durationText,
        durationMinutes: subscriptionPackages.durationMinutes,
        billingType: subscriptionPackages.billingType,
        availabilityWindow: subscriptionPackages.availabilityWindow,
        classRange: subscriptionPackages.classRange,
        reportType: subscriptionPackages.reportType,
        description: subscriptionPackages.description,
        isActive: subscriptionPackages.isActive,
      })
      .from(subscriptionPackages)
      .where(eq(subscriptionPackages.isActive, true))
      .orderBy(asc(subscriptionPackages.sortOrder));
    res.json(rowsToSnake(rows));
  } catch (err) {
    console.error('[subscription-packages] ERROR:', err);
    res.json([]);
  }
});

// GET /api/my-subscriptions -- parent sees their children's assigned packages
router.get('/my-subscriptions', async (req, res) => {
  try {
    const userId = req.user!.id;
    const rows = await db
      .select({
        id: studentSubscriptions.id,
        childId: studentSubscriptions.childId,
        packageId: studentSubscriptions.packageId,
        status: studentSubscriptions.status,
        purchaseDate: studentSubscriptions.purchaseDate,
        expiryDate: studentSubscriptions.expiryDate,
        childName: children.name,
        childGrade: children.grade,
        productName: subscriptionPackages.productName,
        category: subscriptionPackages.category,
        price: subscriptionPackages.price,
        priceMax: subscriptionPackages.priceMax,
        durationText: subscriptionPackages.durationText,
        billingType: subscriptionPackages.billingType,
        classRange: subscriptionPackages.classRange,
        description: subscriptionPackages.description,
        domainsCovered: subscriptionPackages.domainsCovered,
        moduleCount: subscriptionPackages.moduleCount,
      })
      .from(studentSubscriptions)
      .innerJoin(children, eq(children.id, studentSubscriptions.childId))
      .innerJoin(subscriptionPackages, eq(subscriptionPackages.id, studentSubscriptions.packageId))
      .where(eq(children.parentId, userId))
      .orderBy(desc(studentSubscriptions.createdAt));
    res.json(rowsToSnake(rows));
  } catch (err) {
    console.error('[GET /my-subscriptions] ERROR:', err);
    res.json([]);
  }
});

// GET /api/assessment-domains -- public list of all domains (for parent/student)
router.get('/assessment-domains', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: assessmentDomains.id,
        domainCode: assessmentDomains.domainCode,
        domainName: assessmentDomains.domainName,
        weightPercent: assessmentDomains.weightPercent,
        practicalOutcome: assessmentDomains.practicalOutcome,
      })
      .from(assessmentDomains)
      .where(eq(assessmentDomains.isActive, true))
      .orderBy(asc(assessmentDomains.id));
    res.json(rowsToSnake(rows));
  } catch { res.json([]); }
});

// GET /api/package-domains/:packageId -- domains included in a package (for parent)
router.get('/package-domains/:packageId', async (req, res) => {
  try {
    const rows = await db
      .select({
        id: assessmentDomains.id,
        domainCode: assessmentDomains.domainCode,
        domainName: assessmentDomains.domainName,
        weightPercent: assessmentDomains.weightPercent,
        practicalOutcome: assessmentDomains.practicalOutcome,
      })
      .from(packageDomainMapping)
      .innerJoin(assessmentDomains, eq(assessmentDomains.id, packageDomainMapping.domainId))
      .where(and(
        eq(packageDomainMapping.packageId, req.params.packageId),
        eq(assessmentDomains.isActive, true),
      ))
      .orderBy(asc(assessmentDomains.id));
    res.json(rowsToSnake(rows));
  } catch { res.json([]); }
});

// POST /api/supervised-test/start — begin a supervised session for an assigned assessment
router.post('/supervised-test/start', async (req, res) => {
  const { examId, childId } = req.body as { examId: string; childId: string };
  if (!examId || !childId) { res.status(400).json({ error: 'examId and childId required' }); return; }
  try {
    // Verify the assignment belongs to a child of this parent
    const assignmentRows = await db
      .select({ id: assessmentAssignments.id, status: assessmentAssignments.status, childId: assessmentAssignments.childId })
      .from(assessmentAssignments)
      .innerJoin(children, eq(children.id, assessmentAssignments.childId))
      .where(and(
        eq(assessmentAssignments.id, examId),
        eq(children.parentId, req.user!.id),
      ));
    if (!assignmentRows.length) { res.status(404).json({ error: 'Assignment not found' }); return; }

    const assignment = assignmentRows[0];
    if (assignment.status === 'completed') {
      res.status(409).json({ error: 'already completed', message: 'This assessment has already been completed.' });
      return;
    }

    // Mark as in_progress if still pending
    if (assignment.status === 'pending') {
      await db.update(assessmentAssignments)
        .set({ status: 'in_progress', startedAt: new Date() })
        .where(eq(assessmentAssignments.id, examId));
    }

    res.json({
      message: 'Supervised test session started.',
      session: {
        id: examId,
        examId,
        parentId: req.user!.id,
        childId,
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        endedAt: null,
      },
    });
  } catch (err) {
    console.error('[POST /supervised-test/start]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Helper: map child grade string to LBI age band code
function gradeToAgeBand(grade: string | null | undefined): string {
  if (!grade) return 'B';
  const match = grade.match(/\d+/);
  if (!match) return 'B';
  const g = parseInt(match[0], 10);
  if (g <= 5) return 'A';
  if (g <= 9) return 'B';
  return 'C';
}

// Helper: map package category to relevant LBI domain names for question selection
function categoryToDomains(category: string | null | undefined): string[] | null {
  const cat = (category ?? '').toLowerCase();
  if (cat.includes('exam readiness') || cat.includes('exam ready')) {
    return [
      'Cognitive & Analytical',
      'Cognitive & Analytical Intelligence',
      'Personal Effectiveness & Self-Management',
      'Adaptability & Growth',
      'Health, Wellbeing & Sustainability',
    ];
  }
  if (cat.includes('competency')) {
    return [
      'Execution & Delivery',
      'Execution, Operations & Productivity',
      'Leadership & Influence',
      'Leadership & People',
      'Communication & Expression',
      'Communication & Influence',
    ];
  }
  if (cat.includes('career')) {
    return [
      'Career & Professional Readiness',
      'Global & Future Readiness',
      'Innovation, Entrepreneurship & Value Creation',
      'Digital, Data & Technology Skills',
    ];
  }
  // LBI Behavioural Assessment and anything else: use all domains (no filter)
  return null;
}

router.get('/parent/exams/:examId/questions', async (req, res) => {
  const { examId } = req.params;
  try {
    // Look up the assignment to get the package and child info
    const rows = await db
      .select({
        id: assessmentAssignments.id,
        templateId: assessmentAssignments.templateId,
        childId: assessmentAssignments.childId,
        status: assessmentAssignments.status,
        childGrade: children.grade,
        childName: children.name,
        productName: subscriptionPackages.productName,
        category: subscriptionPackages.category,
        durationMinutes: subscriptionPackages.durationMinutes,
        questionCount: subscriptionPackages.questionCount,
      })
      .from(assessmentAssignments)
      .leftJoin(children, eq(children.id, assessmentAssignments.childId))
      .leftJoin(subscriptionPackages, eq(assessmentAssignments.templateId, subscriptionPackages.id))
      .where(and(
        eq(assessmentAssignments.id, examId),
        eq(children.parentId, req.user!.id),
      ));

    if (!rows.length) { res.status(404).json({ error: 'Assignment not found' }); return; }
    const asgn = rows[0];

    const ageBand = gradeToAgeBand(asgn.childGrade);
    const limit = Math.min(asgn.questionCount ?? 10, 20);
    const allowedDomains = categoryToDomains(asgn.category);

    // Build domain filter: restrict by relevant domains for the package category
    const domainFilter = allowedDomains
      ? and(eq(lbiQuestions.ageBandCode, ageBand), inArray(lbiQuestions.domainName, allowedDomains))
      : eq(lbiQuestions.ageBandCode, ageBand);

    // Draw random LBI questions for the child's age band and category-relevant domains
    const questions = await db
      .select({
        id: lbiQuestions.id,
        questionText: lbiQuestions.questionText,
        optionA: lbiQuestions.optionA,
        optionB: lbiQuestions.optionB,
        optionC: lbiQuestions.optionC,
        optionD: lbiQuestions.optionD,
        optionAScore: lbiQuestions.optionAScore,
        optionBScore: lbiQuestions.optionBScore,
        optionCScore: lbiQuestions.optionCScore,
        optionDScore: lbiQuestions.optionDScore,
        domainName: lbiQuestions.domainName,
        subdomainName: lbiQuestions.subdomainName,
        ageBandCode: lbiQuestions.ageBandCode,
      })
      .from(lbiQuestions)
      .where(domainFilter)
      .orderBy(sql`RANDOM()`)
      .limit(limit);

    // Map to front-end format. LBI is self-assessment — highest option score = reference answer
    const mappedQuestions = questions.map(q => {
      const scores: Record<string, number> = {
        A: q.optionAScore ?? 1, B: q.optionBScore ?? 2,
        C: q.optionCScore ?? 3, D: q.optionDScore ?? 4,
      };
      const correctOption = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])[0][0] as string;
      return {
        id: String(q.id),
        questionText: q.questionText,
        optionA: q.optionA ?? 'Strongly Disagree',
        optionB: q.optionB ?? 'Disagree',
        optionC: q.optionC ?? 'Neutral',
        optionD: q.optionD ?? 'Agree',
        correctOption,
        domainName: q.domainName,
        subdomainName: q.subdomainName,
        scores,
      };
    });

    res.json({
      exam: {
        id: asgn.id,
        title: asgn.productName ?? 'LBI Assessment',
        subject: asgn.category ?? 'Behavioural Assessment',
        grade: asgn.childGrade ?? '',
        duration: asgn.durationMinutes ?? 60,
      },
      questions: mappedQuestions,
    });
  } catch (err) {
    console.error('[GET /parent/exams/:examId/questions]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/parent/exams/:examId/submit', async (req, res) => {
  const { examId } = req.params;
  const { childId, responses } = req.body as {
    childId: string;
    responses: Array<{ questionId: string; selectedOption: string | null }>;
  };
  try {
    // Verify assignment ownership
    const rows = await db
      .select({ id: assessmentAssignments.id })
      .from(assessmentAssignments)
      .innerJoin(children, eq(children.id, assessmentAssignments.childId))
      .where(and(
        eq(assessmentAssignments.id, examId),
        eq(children.parentId, req.user!.id),
      ));
    if (!rows.length) { res.status(404).json({ error: 'Assignment not found' }); return; }

    // Calculate score: count answered questions
    const answered = (responses || []).filter(r => r.selectedOption != null).length;
    const total = (responses || []).length || 1;
    const percentage = Math.round((answered / total) * 100);

    // Mark assignment as completed
    await db.update(assessmentAssignments)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(assessmentAssignments.id, examId));

    res.json({
      success: true,
      score: answered,
      totalMarks: total,
      percentage,
      message: 'Assessment submitted successfully.',
    });
  } catch (err) {
    console.error('[POST /parent/exams/:examId/submit]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Adaptive Next-Question Engine ──────────────────────────────────────────────
router.post('/adaptive-next-question', async (req, res) => {
  const { questionId, timeSpentSeconds, currentDifficulty, attemptId } = req.body as {
    questionId: string;
    timeSpentSeconds: number;
    currentDifficulty: 'easy' | 'medium' | 'hard';
    attemptId?: string;
  };

  // Adaptive algorithm: adjust difficulty based on time spent
  type DifficultyLevel = 'easy' | 'medium' | 'hard';
  const difficultyLevels: DifficultyLevel[] = ['easy', 'medium', 'hard'];
  const currentIdx = difficultyLevels.indexOf(currentDifficulty as DifficultyLevel);

  let nextDifficulty: DifficultyLevel = currentDifficulty as DifficultyLevel;
  let hint: string | null = null;

  if (timeSpentSeconds < 15) {
    // Very quick → increase difficulty
    nextDifficulty = difficultyLevels[Math.min(currentIdx + 1, 2)];
  } else if (timeSpentSeconds > 90) {
    // Very slow → decrease difficulty and provide hint
    nextDifficulty = difficultyLevels[Math.max(currentIdx - 1, 0)];
    hint = 'Take your time. Try reading the question twice and eliminating wrong options first.';
  } else if (timeSpentSeconds > 60) {
    hint = 'Tip: Break the problem into smaller parts and tackle each one step by step.';
  }

  const HINTS_BY_DIFFICULTY: Record<DifficultyLevel, string[]> = {
    easy: [
      'Focus on recalling the basic formula or definition.',
      'This is a foundational concept — trust your memory.',
    ],
    medium: [
      'Apply the concept step-by-step rather than jumping to the answer.',
      'Draw a quick diagram if the question involves relationships.',
    ],
    hard: [
      'These questions often have one tricky assumption — read carefully.',
      'Work backwards from the answer options to save time.',
    ],
  };

  const difficultyHints = HINTS_BY_DIFFICULTY[nextDifficulty];
  const adaptiveHint = hint || difficultyHints[Math.floor(Math.random() * difficultyHints.length)];

  res.json({
    nextDifficulty,
    hint: adaptiveHint,
    confidenceBoost: timeSpentSeconds < 20 ? 'excellent' : timeSpentSeconds < 60 ? 'good' : 'steady',
  });
});

// ── T008: Mentor Progress Report (aggregate, every 4 sessions) ─────────────────
router.post('/mentor-progress-report', (req, res) => {
  const { childName, mentorName, sessions } = req.body as {
    childName: string;
    mentorName: string;
    sessions: Array<{
      sessionType: string;
      scheduledDate: string;
      stage: string;
      feedback?: {
        overallRating: number;
        academicRating?: number;
        engagementRating?: number;
        communicationRating?: number;
        comment?: string;
        wouldRecommend?: boolean;
      };
    }>;
  };

  if (!sessions || !Array.isArray(sessions)) {
    return res.status(400).json({ error: 'sessions array required' });
  }

  const withFeedback = sessions.filter(s => s.feedback);
  const avgOverall = withFeedback.length
    ? Math.round(withFeedback.reduce((s, sess) => s + (sess.feedback!.overallRating || 0), 0) / withFeedback.length * 20)
    : 0;
  const avgQuality = withFeedback.length
    ? Math.round(withFeedback.reduce((sum, sess) => {
        const fb = sess.feedback!;
        return sum + (fb.overallRating * 40 + (fb.academicRating || fb.overallRating) * 20 +
          (fb.engagementRating || fb.overallRating) * 20 + (fb.communicationRating || fb.overallRating) * 20) / 5;
      }, 0) / withFeedback.length)
    : 0;
  const wouldRecommend = withFeedback.filter(s => s.feedback!.wouldRecommend).length;
  const recommendation =
    avgQuality >= 80 ? 'Excellent progression — continue with this mentor for sustained improvement.'
    : avgQuality >= 65 ? 'Good progress. Consider focusing on the weaker areas flagged in session feedback.'
    : 'Review session approach. Recommend a discussion with the mentor to re-align learning goals.';

  res.json({
    childName: childName || 'Student',
    mentorName: mentorName || 'Mentor',
    totalSessions: sessions.length,
    ratedSessions: withFeedback.length,
    avgQualityScore: avgQuality,
    avgOverallPct: avgOverall,
    wouldRecommendCount: wouldRecommend,
    recommendation,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
