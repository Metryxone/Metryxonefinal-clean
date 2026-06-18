import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getAllTemplates, getTemplateById, createTemplate, updateTemplate } from '../notifications/templateRepository.js';
import type { DBNotificationTemplate } from '../notifications/templateRepository.js';
import * as service from '../notifications/service.js';
import { trigger as scenarioTrigger } from '../notifications/scenarioEngine.js';
import { query, pool } from '../db/client.js';
import { db } from '../db/drizzle.js';
import {
  users, children, notifications, notificationBroadcasts, notificationScenarios,
  notificationScheduledJobs, platformSettings, adminAuditLogs, mentorProfiles,
  mentorBookings, mentorReviews, mentorKpis, mentorTasks, mentorPayouts,
  mentorViolations, mentorKycDocuments, mentorOnboardingNotifications,
  subscriptionPackages, studentSubscriptions, institutions, institutionActivityLogs,
  parentKyc, hrJobs, hrApplications, wellnessCheckins, lbiSessions, lbiModules,
  lbiDomains, lbiQuestions, lbiAgeBands, assessmentDomains, assessmentSubdomains,
  packageDomainMapping, parentBriefings, parentSubscriptions, psychometricQuestions,
  scoringModules, scoringDomainConfig, scoringAgeBandNorms, scoringFormulaParams,
  scoringConfigVersions, examReadyReports,
} from '../db/schema.js';
import { eq, and, or, desc, asc, sql, like, ilike, inArray, count, sum, avg, gte, lte, isNull, not } from 'drizzle-orm';
import { ExamReadyQuestion } from '../models/examReadyQuestion.js';
import { rowToSnake, rowsToSnake } from '../db/utils.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(requireAuth, requireAdmin);

function toHandlebars(str: string): string {
  return str.replace(/\[(\w+)\]/g, '{{$1}}');
}

function formatTemplate(t: DBNotificationTemplate) {
  return {
    id: t.id,
    serviceName: t.title,
    category: t.category,
    type: t.type,
    priority: t.priority,
    channels: ['in_app', 'email'],
    targetAudience: t.roles,
    titleTemplate: toHandlebars(t.title),
    messageTemplate: toHandlebars(t.bodyTemplate),
    triggerEvent: null,
    actionLabel: t.actionLabel ?? null,
    variables: t.variables,
  };
}

const SAMPLE_VARIABLES: Record<number, Record<string, string>> = {
  7:  { name: 'Alex' },
  3:  { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  14: { amount: '₹4,999', plan: 'Pro Annual' },
  22: { testName: 'Cognitive Readiness Test', assignedBy: 'Admin' },
  28: { testName: 'Cognitive Readiness Test' },
  32: { reportType: 'LBI', testName: 'Cognitive Readiness Test' },
  33: { studentName: 'Alex' },
  38: { studentName: 'Alex', competency: 'Critical Thinking' },
  45: { mentorName: 'Dr. Priya', date: 'March 15', time: '10:00 AM' },
  12: { endDate: 'March 31, 2026' },
  17: { code: 'SAVE20', discount: '20%', plan: 'Pro' },
  42: {},
  54: { className: 'Study Skills 101', date: 'March 12', time: '4:00 PM' },
  37: { subject: 'Mathematics' },
  9:  { mentorName: 'Dr. Priya' },
};

router.post('/test-notification', validate(z.object({ templateId: z.number().int().min(1) })), async (req, res) => {
  try {
    const { templateId } = req.body;
    const tpl = await getTemplateById(templateId);
    if (!tpl) { res.status(400).json({ error: 'INVALID_TEMPLATE' }); return; }
    const vars = SAMPLE_VARIABLES[templateId] ?? {};
    const notif = await service.fire(templateId, vars, { recipientId: req.user!.id, senderId: req.user!.id });
    res.status(201).json(notif);
  } catch { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.post('/broadcast', validate(z.object({
  templateId: z.number().int().min(1),
  variables: z.record(z.string()).default({}),
  filter: z.object({ roles: z.array(z.string()).optional() }).optional(),
})), async (req, res) => {
  try {
    const { templateId, variables, filter } = req.body;
    const userRows = filter?.roles?.length
      ? await db.select({ id: users.id }).from(users).where(inArray(users.role, filter.roles))
      : await db.select({ id: users.id }).from(users);
    let queued = 0;
    for (const user of userRows) {
      const notif = await service.fire(templateId, variables ?? {}, { recipientId: user.id, senderId: req.user!.id });
      if (notif) queued++;
    }
    res.status(202).json({ queued });
  } catch { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.get('/notification-templates', async (_req, res) => {
  try {
    const templates = await getAllTemplates();
    res.json(templates.map(formatTemplate));
  } catch { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

const templateCreateSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  bodyTemplate: z.string().min(1),
  type: z.enum(['fyi', 'fya']).default('fyi'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  roles: z.array(z.string()).default(['all']),
  variables: z.array(z.string()).default([]),
  actionUrl: z.string().optional(),
  actionLabel: z.string().optional(),
});

router.post('/notification-templates', validate(templateCreateSchema), async (req, res) => {
  try {
    const created = await createTemplate(req.body);
    res.status(201).json(formatTemplate(created));
  } catch { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.put('/notification-templates/:id', validate(templateCreateSchema), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'INVALID_ID' }); return; }
    const updated = await updateTemplate(id, req.body);
    if (!updated) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json(formatTemplate(updated));
  } catch { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

const broadcastCreateSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['fyi', 'fya']).default('fyi'),
  category: z.string().default('general'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  targetRoles: z.array(z.string()).default([]),
  actionUrl: z.string().optional(),
  sendEmail: z.boolean().default(false),
});

router.get('/notification-broadcasts', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT b.*, u.full_name as creator_name
       FROM notification_broadcasts b
       LEFT JOIN users u ON u.id = b.created_by
       ORDER BY b.created_at DESC LIMIT 100`
    );
    res.json(rows.map((b: any) => ({
      id: b.id,
      title: b.title,
      message: b.message,
      type: b.type,
      category: b.category,
      priority: b.priority,
      targetRoles: b.target_roles,
      actionUrl: b.action_url,
      sendEmail: b.send_email,
      status: b.status,
      sentCount: b.sent_count,
      totalDelivered: b.sent_count,
      createdBy: b.creator_name,
      createdAt: b.created_at,
      sentAt: b.sent_at,
    })));
  } catch { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.post('/notification-broadcasts', validate(broadcastCreateSchema), async (req, res) => {
  try {
    const { title, message, type, category, priority, targetRoles, actionUrl, sendEmail } = req.body;
    const { rows } = await query(
      `INSERT INTO notification_broadcasts (title, message, type, category, priority, target_roles, action_url, send_email, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, message, type, category, priority, JSON.stringify(targetRoles), actionUrl ?? null, sendEmail, req.user!.id]
    );
    const b = rows[0] as any;
    res.status(201).json({ id: b.id, title: b.title, message: b.message, type: b.type, status: b.status, createdAt: b.created_at });
  } catch { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.post('/notification-broadcasts/:id/send', async (req, res) => {
  try {
    const broadcastId = req.params.id;
    const { rows: bRows } = await query('SELECT * FROM notification_broadcasts WHERE id = $1', [broadcastId]);
    if (!bRows.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    const bc = bRows[0] as any;

    const roles: string[] = Array.isArray(bc.target_roles) ? bc.target_roles : [];
    const userRows = roles.length
      ? await db.select({ id: users.id }).from(users).where(and(inArray(users.role, roles), eq(users.isActive, true)))
      : await db.select({ id: users.id }).from(users).where(eq(users.isActive, true));

    let sentCount = 0;
    for (const user of userRows) {
      try {
        await db.insert(notifications).values({
          templateId: 0,
          recipientId: user.id,
          senderId: req.user!.id,
          category: bc.category,
          title: bc.title,
          message: bc.message,
          type: bc.type,
          priority: bc.priority,
          actionUrl: bc.action_url ?? null,
          isRead: false,
          isAcknowledged: false,
          isEmailSent: false,
        });
        sentCount++;
      } catch { /* skip individual failure */ }
    }

    await db.update(notificationBroadcasts)
      .set({ status: 'sent', sentCount, sentAt: new Date() })
      .where(eq(notificationBroadcasts.id, broadcastId));

    res.json({ sent: sentCount });
  } catch (e) { console.error(e); res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.post('/send-template-notification', validate(z.object({
  templateId: z.number().int().min(1),
  recipientId: z.string().min(1),
  context: z.record(z.string()).default({}),
})), async (req, res) => {
  try {
    const { templateId, recipientId, context } = req.body;

    let resolvedId = recipientId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(recipientId) && recipientId.length < 30) {
      const result = await db.select({ id: users.id }).from(users)
        .where(or(eq(users.email, recipientId), eq(users.username, recipientId)))
        .limit(1);
      if (!result.length) { res.status(404).json({ error: 'RECIPIENT_NOT_FOUND', message: 'User not found' }); return; }
      resolvedId = result[0].id;
    }

    const notif = await service.fire(templateId, context ?? {}, { recipientId: resolvedId, senderId: req.user!.id });
    if (!notif) { res.status(400).json({ error: 'TEMPLATE_GATED', message: 'Blocked by user preferences or invalid template' }); return; }
    res.status(201).json(notif);
  } catch { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.get('/notification-analytics', async (_req, res) => {
  try {
    const [totals, cats, last24, last7] = await Promise.all([
      query(`SELECT
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE is_read = TRUE) as read_count,
        COUNT(*) FILTER (WHERE is_acknowledged = TRUE) as acknowledged,
        COUNT(DISTINCT recipient_id) as unique_recipients
        FROM notifications`),
      query(`SELECT category,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE is_read = TRUE) as read_count
        FROM notifications GROUP BY category ORDER BY count DESC`),
      query(`SELECT COUNT(*) as count FROM notifications WHERE created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*) as count FROM notifications WHERE created_at >= NOW() - INTERVAL '7 days'`),
    ]);

    const t = totals.rows[0] as any;
    const totalSent = parseInt(t?.total_sent ?? '0');
    const readCount = parseInt(t?.read_count ?? '0');

    res.json({
      totalSent,
      readRate: totalSent > 0 ? Math.round((readCount / totalSent) * 100) : 0,
      acknowledged: parseInt(t?.acknowledged ?? '0'),
      uniqueRecipients: parseInt(t?.unique_recipients ?? '0'),
      last24h: parseInt((last24.rows[0] as any)?.count ?? '0'),
      last7days: parseInt((last7.rows[0] as any)?.count ?? '0'),
      categoryBreakdown: cats.rows.map((r: any) => ({
        category: r.category,
        count: parseInt(r.count),
        readCount: parseInt(r.read_count ?? '0'),
        readRate: parseInt(r.count) > 0 ? Math.round((parseInt(r.read_count ?? '0') / parseInt(r.count)) * 100) : 0,
      })),
    });
  } catch { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// ═══════════════════════════════════════════════════════
// NOTIFICATION SCENARIOS (automation rules)
// ═══════════════════════════════════════════════════════

router.get('/notification-scenarios', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT s.*, t.title AS template_title, t.category AS template_category
       FROM notification_scenarios s
       LEFT JOIN notification_templates t ON t.id = s.template_id
       ORDER BY s.id`
    );
    res.json(rows);
  } catch (err: any) {
    console.error('[GET /admin/notification-scenarios]', err.message);
    res.status(500).json({ error: 'Failed to fetch scenarios' });
  }
});

router.post('/notification-scenarios', async (req, res) => {
  try {
    const { name, description, eventTrigger, conditionJson, templateId, delayMinutes, channels, targetRole, variablesMap } = req.body;
    const result = await db.insert(notificationScenarios).values({
      name,
      description,
      eventTrigger,
      conditionJson: conditionJson || {},
      templateId: templateId || null,
      delayMinutes: delayMinutes || 0,
      channels: channels || ['in_app', 'email'],
      targetRole: targetRole || null,
      variablesMap: variablesMap || {},
    }).returning();
    res.json(rowToSnake(result[0]));
  } catch (err: any) {
    console.error('[POST /admin/notification-scenarios]', err.message);
    res.status(500).json({ error: 'Failed to create scenario' });
  }
});

router.patch('/notification-scenarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, eventTrigger, conditionJson, templateId, delayMinutes, channels, targetRole, variablesMap, isActive } = req.body;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (eventTrigger !== undefined) updateData.eventTrigger = eventTrigger;
    if (conditionJson !== undefined) updateData.conditionJson = conditionJson;
    if (templateId !== undefined) updateData.templateId = templateId;
    if (delayMinutes !== undefined) updateData.delayMinutes = delayMinutes;
    if (channels !== undefined) updateData.channels = channels;
    if (targetRole !== undefined) updateData.targetRole = targetRole;
    if (variablesMap !== undefined) updateData.variablesMap = variablesMap;
    if (isActive !== undefined) updateData.isActive = isActive;
    const result = await db.update(notificationScenarios)
      .set(updateData)
      .where(eq(notificationScenarios.id, parseInt(id)))
      .returning();
    res.json(result[0] || null);
  } catch (err: any) {
    console.error('[PATCH /admin/notification-scenarios/:id]', err.message);
    res.status(500).json({ error: 'Failed to update scenario' });
  }
});

router.delete('/notification-scenarios/:id', async (req, res) => {
  try {
    await db.delete(notificationScenarios).where(eq(notificationScenarios.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /admin/notification-scenarios/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete scenario' });
  }
});

// Scheduled jobs (view + cancel)
router.get('/notification-scheduled-jobs', async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    const where = status && status !== 'all' ? `WHERE j.status = '${status.replace(/'/g, "''")}'` : '';
    const { rows } = await query(
      `SELECT j.*, s.name AS scenario_name, t.title AS template_title, u.full_name AS recipient_name, u.email AS recipient_email
       FROM notification_scheduled_jobs j
       LEFT JOIN notification_scenarios s ON s.id = j.scenario_id
       LEFT JOIN notification_templates t ON t.id = j.template_id
       LEFT JOIN users u ON u.id = j.recipient_id
       ${where}
       ORDER BY j.scheduled_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err: any) {
    console.error('[GET /admin/notification-scheduled-jobs]', err.message);
    res.status(500).json({ error: 'Failed to fetch scheduled jobs' });
  }
});

router.patch('/notification-scheduled-jobs/:id/cancel', async (req, res) => {
  try {
    await db.update(notificationScheduledJobs)
      .set({ status: 'cancelled' })
      .where(and(
        eq(notificationScheduledJobs.id, parseInt(req.params.id)),
        eq(notificationScheduledJobs.status, 'pending')
      ));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

router.get('/notification-logs', async (req, res) => {
  try {
    const { category, type, priority, limit = '100', offset = '0' } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (category && category !== 'all') { conditions.push(`n.category = $${i++}`); params.push(category); }
    if (type && type !== 'all') { conditions.push(`n.type = $${i++}`); params.push(type); }
    if (priority && priority !== 'all') { conditions.push(`n.priority = $${i++}`); params.push(priority); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT n.*,
        u.full_name as recipient_name,
        u.username as recipient_username
       FROM notifications n
       LEFT JOIN users u ON u.id = n.recipient_id
       ${where}
       ORDER BY n.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json(rows.map((r: any) => ({
      id: r.id,
      recipientId: r.recipient_id,
      recipientName: r.recipient_name,
      recipientUsername: r.recipient_username,
      title: r.title,
      message: r.message,
      category: r.category,
      type: r.type,
      priority: r.priority,
      isRead: r.is_read,
      isAcknowledged: r.is_acknowledged,
      isEmailSent: r.is_email_sent,
      createdAt: r.created_at,
      actionUrl: r.action_url,
    })));
  } catch { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// ============================================
// DASHBOARD STATS
// ============================================

router.get('/dashboard/stats', async (_req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      usersResult, parentsResult, mentorsResult, institutesResult,
      activeResult, recentResult,
      studentsResult, adultLearnersResult,
      bookingsTotalResult, bookingsConfirmedResult, bookingsCompletedResult, bookingsPendingResult, bookingsThisMonthResult,
      wellnessResult, lbiResult,
      subsTotal, subsActive, subsRevenue,
      pendingInstitutes, consentedResult, notConsentedResult,
      recentBookingsResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(users).where(eq(users.role, 'parent')),
      db.select({ count: count() }).from(users).where(eq(users.role, 'mentor')),
      db.select({ count: count() }).from(institutions),
      db.select({ count: count() }).from(users).where(eq(users.isActive, true)),
      db.select({ count: count() }).from(users).where(gte(users.createdAt, thirtyDaysAgo)),
      db.select({ count: count() }).from(children),
      db.select({ count: count() }).from(children).where(isNull(children.parentId)),
      db.select({ count: count() }).from(mentorBookings),
      db.select({ count: count() }).from(mentorBookings).where(eq(mentorBookings.status, 'confirmed')),
      db.select({ count: count() }).from(mentorBookings).where(eq(mentorBookings.status, 'completed')),
      db.select({ count: count() }).from(mentorBookings).where(eq(mentorBookings.status, 'pending')),
      db.select({ count: count() }).from(mentorBookings).where(gte(mentorBookings.createdAt, thirtyDaysAgo)),
      db.select({ count: count() }).from(wellnessCheckins),
      db.select({ count: count() }).from(lbiSessions),
      db.select({ count: count() }).from(studentSubscriptions),
      db.select({ count: count() }).from(studentSubscriptions).where(eq(studentSubscriptions.status, 'active')),
      query("SELECT COALESCE(SUM(sp.price), 0) as total FROM student_subscriptions ss JOIN subscription_packages sp ON sp.id = ss.package_id WHERE ss.status = 'active'"),
      db.select({ count: count() }).from(institutions).where(eq(institutions.status, 'pending')),
      db.select({ count: count() }).from(children).where(eq(children.consentGiven, true)),
      db.select({ count: count() }).from(children).where(or(eq(children.consentGiven, false), isNull(children.consentGiven))),
      query(`SELECT mb.id, mb.slot_date, mb.start_time, mb.status, mb.mode,
               c.name AS child_name, c.platform_id AS child_platform_id,
               COALESCE(mp.display_name, u.full_name, 'Unknown Mentor') AS mentor_name
             FROM mentor_bookings mb
             JOIN children c ON c.id = mb.child_id
             LEFT JOIN mentor_profiles mp ON mp.id = mb.mentor_id
             LEFT JOIN users u ON u.id = mp.user_id
             ORDER BY mb.created_at DESC LIMIT 5`),
    ]);

    const n = (r: any) => r[0]?.count ?? 0;
    res.json({
      totalUsers: n(usersResult),
      totalParents: n(parentsResult),
      totalMentors: n(mentorsResult),
      totalInstitutes: n(institutesResult),
      activeUsers: n(activeResult),
      newUsersThisMonth: n(recentResult),
      totalStudents: n(studentsResult),
      adultLearners: n(adultLearnersResult),
      totalBookings: n(bookingsTotalResult),
      confirmedBookings: n(bookingsConfirmedResult),
      completedBookings: n(bookingsCompletedResult),
      pendingBookings: n(bookingsPendingResult),
      bookingsThisMonth: n(bookingsThisMonthResult),
      wellnessCheckins: n(wellnessResult),
      lbiSessions: n(lbiResult),
      totalSubscriptions: n(subsTotal),
      activeSubscriptions: n(subsActive),
      totalRevenue: parseFloat(((subsRevenue as any).rows[0] as any).total || 0),
      pendingInstituteApprovals: n(pendingInstitutes),
      pendingParentApprovals: 0,
      consentedStudents: n(consentedResult),
      notConsentedStudents: n(notConsentedResult),
      recentBookings: (recentBookingsResult as any).rows.map((r: any) => ({
        id: r.id, slotDate: r.slot_date, startTime: r.start_time,
        status: r.status, mode: r.mode,
        childName: r.child_name, childPlatformId: r.child_platform_id,
        mentorName: r.mentor_name,
      })),
    });
  } catch (error: any) {
    console.error('[GET /dashboard/stats]', error?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

// List all users with filters & pagination
router.get('/users', async (req, res) => {
  try {
    const { role, is_active, search, page = '1', limit = '25' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (role && role !== 'all') {
      conditions.push(`(role = $${paramIdx} OR roles::text LIKE '%' || $${paramIdx} || '%')`);
      params.push(role);
      paramIdx++;
    }
    if (is_active !== undefined && is_active !== 'all') {
      conditions.push(`is_active = $${paramIdx}`);
      params.push(is_active === 'true');
      paramIdx++;
    }
    if (search) {
      conditions.push(`(full_name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR mobile ILIKE $${paramIdx} OR username ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [usersResult, countResult] = await Promise.all([
      query(
        `SELECT id, full_name, email, mobile, username, role, roles, is_active, is_verified, profile_picture, created_at, updated_at
         FROM users ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limitNum, offset]
      ),
      query(`SELECT COUNT(*) as count FROM users ${whereClause}`, params),
    ]);

    const total = parseInt((countResult.rows[0] as any).count);

    // Get role counts for filters
    const roleCounts = await query(`
      SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC
    `);

    res.json({
      users: usersResult.rows,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      roleCounts: roleCounts.rows,
    });
  } catch (error: any) {
    console.error('[GET /users]', error?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Get single user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const result = await db.select({
      id: users.id, fullName: users.fullName, email: users.email, mobile: users.mobile,
      username: users.username, role: users.role, roles: users.roles,
      isActive: users.isActive, isVerified: users.isVerified,
      profilePicture: users.profilePicture, metadata: users.metadata,
      createdAt: users.createdAt, updatedAt: users.updatedAt,
    }).from(users).where(eq(users.id, req.params.id));
    if (!result.length) { res.status(404).json({ message: 'User not found' }); return; }
    // Return with snake_case keys for backward compat
    const r = result[0];
    res.json({
      id: r.id, full_name: r.fullName, email: r.email, mobile: r.mobile,
      username: r.username, role: r.role, roles: r.roles,
      is_active: r.isActive, is_verified: r.isVerified,
      profile_picture: r.profilePicture, metadata: r.metadata,
      created_at: r.createdAt, updated_at: r.updatedAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Update user details
router.patch('/users/:id', async (req, res) => {
  try {
    const { full_name, email, mobile, role, roles, is_active, is_verified } = req.body;
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (full_name !== undefined) updateData.fullName = full_name;
    if (email !== undefined) updateData.email = email;
    if (mobile !== undefined) updateData.mobile = mobile;
    if (role !== undefined) updateData.role = role;
    if (roles !== undefined) updateData.roles = roles;
    if (is_active !== undefined) updateData.isActive = is_active;
    if (is_verified !== undefined) updateData.isVerified = is_verified;

    if (Object.keys(updateData).length <= 1) { res.status(400).json({ message: 'No fields to update' }); return; }

    const result = await db.update(users)
      .set(updateData)
      .where(eq(users.id, req.params.id))
      .returning({
        id: users.id, full_name: users.fullName, email: users.email,
        mobile: users.mobile, role: users.role, roles: users.roles,
        is_active: users.isActive, is_verified: users.isVerified, updated_at: users.updatedAt,
      });

    if (!result.length) { res.status(404).json({ message: 'User not found' }); return; }
    res.json(result[0]);
  } catch (error: any) {
    if (error?.constraint) { res.status(409).json({ message: 'Email or mobile already exists' }); return; }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error?.message });
  }
});

// Deactivate / Activate user
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { is_active } = req.body;
    const result = await db.update(users)
      .set({ isActive: is_active, updatedAt: new Date() })
      .where(eq(users.id, req.params.id))
      .returning({ id: users.id, full_name: users.fullName, is_active: users.isActive });
    if (!result.length) { res.status(404).json({ message: 'User not found' }); return; }
    res.json(result[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Reset user password (admin sets new password)
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' }); return;
    }
    const bcrypt = await import('bcryptjs');
    const password_hash = await bcrypt.default.hash(password, 10);
    const result = await db.update(users)
      .set({ passwordHash: password_hash, updatedAt: new Date() })
      .where(eq(users.id, req.params.id))
      .returning({ id: users.id, full_name: users.fullName });
    if (!result.length) { res.status(404).json({ message: 'User not found' }); return; }
    res.json({ message: 'Password reset successfully', user: result[0] });
  } catch (error: any) {
    console.error('[POST /users/:id/reset-password]', error?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Delete user (soft - sets is_active = false)
router.delete('/users/:id', async (req, res) => {
  try {
    const result = await db.update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, req.params.id))
      .returning({ id: users.id });
    if (!result.length) { res.status(404).json({ message: 'User not found' }); return; }
    res.json({ message: 'User deactivated' });
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============================================
// PLATFORM SETTINGS
// ============================================

const DEFAULT_SETTINGS: Record<string, { value: string; category: string; description: string }> = {
  platform_name: { value: 'MetryxOne', category: 'general', description: 'Platform display name' },
  support_email: { value: 'support@metryx.one', category: 'general', description: 'Support contact email' },
  maintenance_mode: { value: 'false', category: 'general', description: 'Enable maintenance mode' },
  registration_enabled: { value: 'true', category: 'general', description: 'Allow new user registration' },
  max_file_upload_mb: { value: '5', category: 'general', description: 'Maximum file upload size in MB' },
  default_language: { value: 'en', category: 'general', description: 'Default platform language' },
  two_factor_required: { value: 'false', category: 'security', description: 'Require 2FA for all users' },
  session_timeout_minutes: { value: '30', category: 'security', description: 'Session timeout in minutes' },
  max_login_attempts: { value: '5', category: 'security', description: 'Max failed login attempts before lockout' },
  lockout_duration_minutes: { value: '15', category: 'security', description: 'Account lockout duration' },
  password_min_length: { value: '8', category: 'security', description: 'Minimum password length' },
  password_require_symbols: { value: 'false', category: 'security', description: 'Require special characters in password' },
  password_require_uppercase: { value: 'false', category: 'security', description: 'Require uppercase letters in password' },
};

// Get all platform settings
router.get('/platform-settings', async (_req, res) => {
  try {
    const rows = await db.select({
      key: platformSettings.key, value: platformSettings.value,
      category: platformSettings.category, description: platformSettings.description,
      updated_at: platformSettings.updatedAt,
    }).from(platformSettings).orderBy(asc(platformSettings.category), asc(platformSettings.key));
    // Merge with defaults for any missing keys
    const existing = new Map(rows.map((r: any) => [r.key, r]));
    const settings: any[] = [];

    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      if (existing.has(key)) {
        settings.push(existing.get(key));
      } else {
        settings.push({ key, value: def.value, category: def.category, description: def.description, updated_at: null });
      }
    }
    // Add any extra settings from DB not in defaults
    for (const row of rows as any[]) {
      if (!DEFAULT_SETTINGS[row.key]) settings.push(row);
    }

    res.json(settings);
  } catch (error: any) {
    // Table might not exist yet — return defaults
    if (error?.code === '42P01') {
      res.json(Object.entries(DEFAULT_SETTINGS).map(([key, def]) => ({ key, ...def, updated_at: null })));
      return;
    }
    console.error('[GET /platform-settings]', error?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Update platform settings (batch)
router.post('/platform-settings', async (req, res) => {
  try {
    const { settings } = req.body; // Array of { key, value }
    if (!Array.isArray(settings)) { res.status(400).json({ message: 'settings must be an array' }); return; }

    for (const s of settings) {
      const def = DEFAULT_SETTINGS[s.key];
      const category = def?.category || s.category || 'general';
      const description = def?.description || s.description || '';

      await db.insert(platformSettings).values({
        key: s.key, value: String(s.value), category, description,
        updatedBy: req.user!.id, updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: String(s.value), updatedBy: req.user!.id, updatedAt: new Date() },
      });
    }

    res.json({ message: 'Settings updated', count: settings.length });
  } catch (error: any) {
    if (error?.code === '42P01') {
      res.status(500).json({ message: 'Platform settings table not yet created. Run migrations first.' });
      return;
    }
    console.error('[POST /platform-settings]', error?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Seed default settings
router.post('/platform-settings/seed-defaults', async (req, res) => {
  try {
    let seeded = 0;
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      const result = await db.insert(platformSettings).values({
        key, value: def.value, category: def.category,
        description: def.description, updatedBy: req.user!.id, updatedAt: new Date(),
      }).onConflictDoNothing().returning({ key: platformSettings.key });
      if (result.length > 0) seeded++;
    }
    res.json({ message: `Seeded ${seeded} default settings`, total: Object.keys(DEFAULT_SETTINGS).length });
  } catch (error: any) {
    if (error?.code === '42P01') {
      res.status(500).json({ message: 'Platform settings table not yet created. Run migrations first.' });
      return;
    }
    console.error('[POST /platform-settings/seed-defaults]', error?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============================================
// AUDIT LOGS
// ============================================

router.get('/audit-logs', async (req, res) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, parseInt(limit as string));
    const offset = (pageNum - 1) * limitNum;

    // Try to get from a logs table, fallback to empty
    try {
      const [logs, countResult] = await Promise.all([
        db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limitNum).offset(offset),
        db.select({ count: count() }).from(adminAuditLogs),
      ]);
      const total = countResult[0]?.count ?? 0;
      res.json({ logs, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
    } catch {
      res.json({ logs: [], total: 0, page: 1, totalPages: 0 });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============================================
// EXAM READY QUESTION MANAGEMENT (MongoDB)
// ============================================

// List all exam-ready questions with filters
router.get("/exam-ready/questions", async (req, res) => {
  try {
    const { domain_code, subdomain_code, age_band, question_type, status, search, page = '1', limit = '50' } = req.query;
    const filter: Record<string, any> = {};

    if (domain_code) filter.domain_code = domain_code;
    if (subdomain_code) filter.subdomain_code = subdomain_code;
    if (age_band) filter.age_band = age_band;
    if (question_type) filter.question_type = question_type;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { statement: { $regex: search, $options: 'i' } },
        { question_id: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const [questions, total] = await Promise.all([
      ExamReadyQuestion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      ExamReadyQuestion.countDocuments(filter),
    ]);

    // Get distinct values for filter dropdowns
    const [domains, ageBands, questionTypes] = await Promise.all([
      ExamReadyQuestion.aggregate([
        { $group: { _id: { code: "$domain_code", name: "$domain_name" } } },
        { $project: { code: "$_id.code", name: "$_id.name", _id: 0 } },
        { $sort: { code: 1 } },
      ]),
      ExamReadyQuestion.distinct("age_band"),
      ExamReadyQuestion.distinct("question_type"),
    ]);

    const subdomainFilter: Record<string, any> = {};
    if (domain_code) subdomainFilter.domain_code = domain_code;
    const subdomains = await ExamReadyQuestion.aggregate([
      ...(Object.keys(subdomainFilter).length ? [{ $match: subdomainFilter }] : []),
      { $group: { _id: { code: "$subdomain_code", name: "$subdomain_name" } } },
      { $project: { code: "$_id.code", name: "$_id.name", _id: 0 } },
      { $sort: { code: 1 } },
    ]);

    res.json({
      questions,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      filters: {
        domains: domains.filter((d: any) => d.code),
        subdomains: subdomains.filter((s: any) => s.code),
        ageBands: ageBands.filter(Boolean).sort(),
        questionTypes: questionTypes.filter(Boolean),
      },
    });
  } catch (error: any) {
    console.error('[GET exam-ready/questions]', error?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error?.message });
  }
});

// Export all questions as CSV (MUST be before :id route)
router.get("/exam-ready/questions/export", async (_req, res) => {
  try {
    const questions = await ExamReadyQuestion.find({}).sort({ domain_code: 1, age_band: 1, question_id: 1 }).lean();

    const headers = [
      'question_id', 'domain_code', 'domain_name', 'subdomain_code', 'subdomain_name',
      'age_band', 'question_type', 'statement', 'optionA', 'optionAScore', 'optionB', 'optionBScore',
      'optionC', 'optionCScore', 'optionD', 'optionDScore', 'optionE', 'optionEScore',
      'correct_answer', 'reverse_scoring', 'anchor', 'weight', 'difficulty', 'status'
    ];

    const escape = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = questions.map((q: any) => {
      const opts = q.options ?? [];
      return [
        q.question_id, q.domain_code, q.domain_name, q.subdomain_code, q.subdomain_name,
        q.age_band, q.question_type, q.statement,
        opts[0]?.text ?? '', opts[0]?.score ?? '',
        opts[1]?.text ?? '', opts[1]?.score ?? '',
        opts[2]?.text ?? '', opts[2]?.score ?? '',
        opts[3]?.text ?? '', opts[3]?.score ?? '',
        opts[4]?.text ?? '', opts[4]?.score ?? '',
        q.correct_answer ?? '', q.reverse_scoring ?? false,
        q.anchor ?? '', q.weight ?? 1, q.difficulty ?? '', q.status ?? 'Active'
      ].map(escape).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="exam_ready_questions_export_${date}.csv"`);
    res.send(csv);
  } catch (error: any) {
    console.error('[export exam-ready questions]', error?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error?.message });
  }
});

// Download CSV template (MUST be before :id route)
router.get("/exam-ready/questions/template", async (_req, res) => {
  const headers = [
    'question_id', 'domain_code', 'domain_name', 'subdomain_code', 'subdomain_name',
    'age_band', 'question_type', 'statement', 'optionA', 'optionAScore', 'optionB', 'optionBScore',
    'optionC', 'optionCScore', 'optionD', 'optionDScore', 'optionE', 'optionEScore',
    'correct_answer', 'reverse_scoring', 'anchor', 'weight', 'difficulty', 'status'
  ];

  const sampleRows = [
    [
      'ACE_A_001', 'ACE', 'ACADEMIC AND COGNITIVE EFFECTIVENESS', 'ACE_SD02', 'LEARNING EFFICIENCY SCALE',
      'A', 'likert', 'I can explain a topic in my own words without notes.',
      'Strongly Disagree', '1', 'Disagree', '2', 'Neutral', '3', 'Agree', '4', 'Strongly Agree', '5',
      '', 'false', 'Yes', '1', '', 'Active'
    ],
  ];

  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const domainRef = '\n\n# Age Bands: A (Grade 1-7), B (Grade 8-9), C (Grade 10), D (Grade 11-12), E (UG), E1 (PG+)';
  const typeRef = '\n# Question Types: likert, mcq, text, scenario';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="exam_ready_questions_template.csv"');
  res.send(csvContent + domainRef + typeRef);
});

// Get single question by ID
router.get("/exam-ready/questions/:id", async (req, res) => {
  try {
    const question = await ExamReadyQuestion.findById(req.params.id).lean();
    if (!question) { res.status(404).json({ message: 'Question not found' }); return; }
    res.json(question);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error?.message });
  }
});

// Create a new question
router.post("/exam-ready/questions", async (req, res) => {
  try {
    const body = req.body;
    if (!body.question_id) {
      const prefix = body.domain_code || 'Q';
      const band = body.age_band || 'X';
      const count = await ExamReadyQuestion.countDocuments({ domain_code: body.domain_code, age_band: body.age_band });
      body.question_id = `${prefix}_${band}_${String(count + 1).padStart(3, '0')}`;
    }

    const question = await ExamReadyQuestion.create(body);
    res.status(201).json(question);
  } catch (error: any) {
    if (error.code === 11000) { res.status(409).json({ message: 'Question with this question_id already exists' }); return; }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error?.message });
  }
});

// Update question
router.patch("/exam-ready/questions/:id", async (req, res) => {
  try {
    const updated = await ExamReadyQuestion.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) { res.status(404).json({ message: 'Question not found' }); return; }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error?.message });
  }
});

// Delete question
router.delete("/exam-ready/questions/:id", async (req, res) => {
  try {
    const question = await ExamReadyQuestion.findByIdAndDelete(req.params.id);
    if (!question) { res.status(404).json({ message: 'Question not found' }); return; }
    res.json({ message: 'Question deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error?.message });
  }
});

// Bulk import via CSV
router.post("/exam-ready/questions/bulk", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }

    const records = parse(req.file.buffer.toString(), {
      columns: true, skip_empty_lines: true, trim: true,
    }) as any[];

    const errors: string[] = [];
    const questions: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      try {
        if (!row.question_id || !row.statement) {
          errors.push(`Row ${i + 2}: Missing required fields (question_id, statement)`);
          continue;
        }

        let options: any[] = [];
        try {
          if (row.options) options = JSON.parse(row.options);
        } catch {
          if (row.optionA) {
            const optionLabels = ['A', 'B', 'C', 'D', 'E'];
            options = optionLabels
              .filter(l => row[`option${l}`])
              .map((l, idx) => ({ id: l, text: row[`option${l}`], score: row[`option${l}Score`] ? Number(row[`option${l}Score`]) : idx + 1 }));
          }
        }

        questions.push({
          question_id: row.question_id,
          domain_code: row.domain_code || row.domainCode,
          domain_name: row.domain_name || row.domainName,
          subdomain_code: row.subdomain_code || row.subdomainCode,
          subdomain_name: row.subdomain_name || row.subdomainName,
          age_band: row.age_band || row.ageBand,
          question_type: row.question_type || row.questionType || 'likert',
          statement: row.statement || row.questionText,
          options,
          correct_answer: row.correct_answer || row.correctAnswer || null,
          reverse_scoring: row.reverse_scoring === 'true' || row.reverseScoring === 'true',
          anchor: row.anchor || null,
          weight: row.weight ? Number(row.weight) : 1,
          difficulty: row.difficulty || null,
          status: row.status || 'Active',
        });
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    if (questions.length === 0) { res.status(400).json({ message: 'No valid questions found', errors }); return; }

    const result = await ExamReadyQuestion.insertMany(questions, { ordered: false }).catch((err: any) => {
      if (err.insertedDocs) return err.insertedDocs;
      throw err;
    });

    const insertedCount = Array.isArray(result) ? result.length : 0;
    res.json({
      message: errors.length > 0 ? `Uploaded ${insertedCount} questions with ${errors.length} rows skipped` : `Successfully uploaded ${insertedCount} questions`,
      count: insertedCount, totalRows: records.length, skippedRows: errors.length, errors: errors.slice(0, 10),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error?.message });
  }
});

// ─── GET /api/admin/lbi-questions/template ───
router.get('/lbi-questions/template', (_req, res) => {
  const headers = [
    'domainCode', 'subdomainCode', 'questionCode', 'ageBandCode', 'questionType',
    'questionText', 'domainName', 'subdomainName', 'passageText',
    'keying', 'optionA', 'optionB', 'optionC', 'optionD',
    'optionAScore', 'optionBScore', 'optionCScore', 'optionDScore',
    'correctAnswer', 'explanation', 'anchor', 'difficulty', 'status',
  ];
  const exampleRow = [
    'ACE', 'ACE_SD01', 'ACE_SD01_Q001', 'B', 'likert',
    'I understand new concepts quickly when explained to me.', 'Academic & Cognitive Efficiency', 'Learning Efficiency', '',
    'Positive', '', '', '', '',
    '', '', '', '',
    '', '', 'No', 'MEDIUM', 'active',
  ];
  const csv = [headers.join(','), exampleRow.map(v => `"${v}"`).join(',')].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="lbi_questions_template.csv"');
  res.send(csv);
});

// ─── POST /api/admin/lbi-questions/upload ───
router.post('/lbi-questions/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }

    const records = parse(req.file.buffer.toString(), {
      columns: true, skip_empty_lines: true, trim: true,
    }) as any[];

    const required = ['domainCode', 'subdomainCode', 'questionCode', 'ageBandCode', 'questionType', 'questionText'];
    const errors: { row: number; message: string }[] = [];
    const toInsert: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;
      const missing = required.filter(k => !row[k]?.trim());
      if (missing.length) {
        errors.push({ row: rowNum, message: `Missing required columns: ${missing.join(', ')}` });
        continue;
      }
      const validTypes = ['likert', 'multipleChoice', 'trueFalse'];
      if (!validTypes.includes(row.questionType)) {
        errors.push({ row: rowNum, message: `Invalid questionType "${row.questionType}". Must be: ${validTypes.join(', ')}` });
        continue;
      }
      const validBands = ['A', 'B', 'C', 'D', 'E', 'E1'];
      if (!validBands.includes(row.ageBandCode)) {
        errors.push({ row: rowNum, message: `Invalid ageBandCode "${row.ageBandCode}". Must be: ${validBands.join(', ')}` });
        continue;
      }
      toInsert.push({
        question_code:  row.questionCode.trim(),
        domain_code:    row.domainCode.trim().toUpperCase(),
        domain_name:    row.domainName?.trim() || null,
        subdomain_code: row.subdomainCode.trim(),
        subdomain_name: row.subdomainName?.trim() || null,
        age_band_code:  row.ageBandCode.trim(),
        question_type:  row.questionType.trim(),
        question_text:  row.questionText.trim(),
        passage_text:   row.passageText?.trim() || null,
        keying:         row.keying?.trim() || 'Positive',
        reverse_scored: (row.keying?.trim() || '').toLowerCase() === 'negative',
        option_a:       row.optionA?.trim() || null,
        option_b:       row.optionB?.trim() || null,
        option_c:       row.optionC?.trim() || null,
        option_d:       row.optionD?.trim() || null,
        option_a_score: row.optionAScore ? parseInt(row.optionAScore) : null,
        option_b_score: row.optionBScore ? parseInt(row.optionBScore) : null,
        option_c_score: row.optionCScore ? parseInt(row.optionCScore) : null,
        option_d_score: row.optionDScore ? parseInt(row.optionDScore) : null,
        correct_answer: row.correctAnswer?.trim() || null,
        explanation:    row.explanation?.trim() || null,
        is_anchor:      (row.anchor?.trim() || '').toLowerCase() === 'yes',
        difficulty:     row.difficulty?.trim().toUpperCase() || 'MEDIUM',
        status:         (row.status?.trim() || 'active').toLowerCase(),
      });
    }

    if (toInsert.length === 0) {
      res.status(400).json({ message: 'No valid questions to import', errors });
      return;
    }

    let inserted = 0;
    const upsertErrors: { row: number; message: string }[] = [];
    for (let i = 0; i < toInsert.length; i++) {
      const q = toInsert[i];
      try {
        await query(
          `INSERT INTO lbi_questions
             (question_code, domain_code, domain_name, subdomain_code, subdomain_name,
              age_band_code, question_type, question_text, passage_text, keying, reverse_scored,
              option_a, option_b, option_c, option_d,
              option_a_score, option_b_score, option_c_score, option_d_score,
              correct_answer, explanation, is_anchor, difficulty, status, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW())
           ON CONFLICT (question_code) DO UPDATE SET
             domain_code    = EXCLUDED.domain_code,
             domain_name    = EXCLUDED.domain_name,
             subdomain_code = EXCLUDED.subdomain_code,
             subdomain_name = EXCLUDED.subdomain_name,
             age_band_code  = EXCLUDED.age_band_code,
             question_type  = EXCLUDED.question_type,
             question_text  = EXCLUDED.question_text,
             passage_text   = EXCLUDED.passage_text,
             keying         = EXCLUDED.keying,
             reverse_scored = EXCLUDED.reverse_scored,
             option_a       = EXCLUDED.option_a,
             option_b       = EXCLUDED.option_b,
             option_c       = EXCLUDED.option_c,
             option_d       = EXCLUDED.option_d,
             option_a_score = EXCLUDED.option_a_score,
             option_b_score = EXCLUDED.option_b_score,
             option_c_score = EXCLUDED.option_c_score,
             option_d_score = EXCLUDED.option_d_score,
             correct_answer = EXCLUDED.correct_answer,
             explanation    = EXCLUDED.explanation,
             is_anchor      = EXCLUDED.is_anchor,
             difficulty     = EXCLUDED.difficulty,
             status         = EXCLUDED.status,
             updated_at     = NOW()`,
          [
            q.question_code, q.domain_code, q.domain_name, q.subdomain_code, q.subdomain_name,
            q.age_band_code, q.question_type, q.question_text, q.passage_text, q.keying, q.reverse_scored,
            q.option_a, q.option_b, q.option_c, q.option_d,
            q.option_a_score, q.option_b_score, q.option_c_score, q.option_d_score,
            q.correct_answer, q.explanation, q.is_anchor, q.difficulty, q.status,
          ]
        );
        inserted++;
      } catch (err: any) {
        upsertErrors.push({ row: i + 2, message: err.message });
      }
    }

    const allErrors = [...errors, ...upsertErrors];
    res.json({
      message: allErrors.length > 0
        ? `Imported ${inserted} questions with ${allErrors.length} errors`
        : `Successfully imported ${inserted} LBI questions`,
      count: inserted,
      totalRows: records.length,
      errors: allErrors.slice(0, 20),
    });
  } catch (error: any) {
    console.error('[POST /admin/lbi-questions/upload]', error?.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error?.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ─── MENTOR PROFILE MANAGEMENT ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/mentors — list all users with mentor role + their profiles
router.get('/mentors', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.id,
        u.full_name   AS "fullName",
        u.email,
        COALESCE(mp.status, CASE WHEN u.is_active THEN 'active' ELSE 'inactive' END) AS status,
        u.created_at  AS "createdAt",
        mp.mentor_code                              AS "mentorCode",
        mp.agreement_status                         AS "agreementStatus",
        COALESCE(mp.performance_health_index, 100) AS "performanceHealthIndex",
        mp.id         AS "profileId",
        COALESCE(mp.display_name, u.full_name) AS "displayName",
        mp.title,
        mp.mentor_type          AS "mentorType",
        mp.subjects,
        mp.psychological_areas  AS "psychologicalAreas",
        mp.experience_years     AS "experienceYears",
        mp.hourly_rate          AS "hourlyRate",
        mp.currency,
        mp.mode,
        mp.city,
        mp.rating,
        mp.total_reviews        AS "totalReviews",
        mp.total_sessions       AS "totalSessions",
        mp.is_verified          AS "isVerified",
        mp.is_featured          AS "isFeatured",
        mp.status               AS "profileStatus",
        mp.profile_image_url    AS "profileImageUrl",
        mp.bio,
        mp.phone,
        mp.specialization,
        mp.qualifications,
        mp.activated_at              AS "activatedAt",
        mp.warning_reason            AS "warningReason",
        mp.warning_issued_at         AS "warningIssuedAt",
        mp.suspension_reason         AS "suspensionReason",
        mp.onboarding_stage          AS "onboardingStage",
        mp.training_started_at       AS "trainingStartedAt",
        mp.training_completed_at     AS "trainingCompletedAt",
        mp.assessment_completed_at   AS "assessmentCompletedAt",
        mp.temp_code                 AS "tempCode",
        mp.temp_code_generated_at    AS "tempCodeGeneratedAt",
        mp.kyc_status                AS "kycStatus",
        mp.kyc_submitted_at          AS "kycSubmittedAt",
        mp.kyc_verified_at           AS "kycVerifiedAt",
        mp.profiler_status           AS "profilerStatus",
        mp.profiler_completed_at     AS "profilerCompletedAt",
        mp.delivery_link             AS "deliveryLink"
      FROM users u
      LEFT JOIN mentor_profiles mp ON mp.user_id = u.id
      WHERE u.role = 'mentor' OR u.roles::text LIKE '%mentor%'
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('[GET /admin/mentors]', err.message);
    res.status(500).json({ error: 'Failed to fetch mentors' });
  }
});

// GET /api/admin/mentors/platform-stats — platform-wide mentor operation stats
router.get('/mentors/platform-stats', async (req, res) => {
  try {
    const [sessionsR, mentorsR, revenueR, satisfactionR, pendingR, thisMonthR] = await Promise.all([
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='completed') AS completed, COUNT(*) FILTER (WHERE status='confirmed') AS upcoming FROM mentor_bookings`),
      query(`SELECT COUNT(*) FILTER (WHERE status='active') AS active, COUNT(*) AS total FROM mentor_profiles`),
      query(`SELECT COALESCE(SUM(net_payout),0) AS total FROM mentor_payouts WHERE status='processed'`),
      query(`SELECT COALESCE(AVG(rating::numeric),0)::numeric(3,1) AS avg_rating, COUNT(*) AS total_reviews FROM mentor_reviews`),
      query(`SELECT COUNT(*) AS cnt FROM mentor_bookings WHERE status='pending'`),
      query(`SELECT COUNT(*) AS cnt FROM mentor_bookings WHERE created_at >= date_trunc('month', NOW())`),
    ]);
    res.json({
      totalSessions: Number(sessionsR.rows[0].total),
      completedSessions: Number(sessionsR.rows[0].completed),
      upcomingSessions: Number(sessionsR.rows[0].upcoming),
      pendingSessions: Number(pendingR.rows[0].cnt),
      thisMonthSessions: Number(thisMonthR.rows[0].cnt),
      activeMentors: Number(mentorsR.rows[0].active),
      totalMentors: Number(mentorsR.rows[0].total),
      platformRevenue: Number(revenueR.rows[0].total),
      avgSatisfaction: Number(satisfactionR.rows[0].avg_rating),
      totalReviews: Number(satisfactionR.rows[0].total_reviews),
    });
  } catch (err: any) {
    console.error('[GET /admin/mentors/platform-stats]', err.message);
    res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

// GET /api/admin/mentors/all-sessions — all sessions across platform (latest 60)
router.get('/mentors/all-sessions', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        mb.id, mb.slot_date, mb.start_time, mb.end_time, mb.mode, mb.status,
        mb.notes, mb.session_link, mb.created_at,
        COALESCE(mp.display_name, u.full_name, 'Unknown') AS mentor_name,
        mp.mentor_type,
        c.name AS student_name, c.grade,
        pu.full_name AS parent_name
      FROM mentor_bookings mb
      LEFT JOIN mentor_profiles mp ON mp.id = mb.mentor_id
      LEFT JOIN users u ON u.id = mp.user_id
      LEFT JOIN children c ON c.id = mb.child_id
      LEFT JOIN users pu ON pu.id = mb.parent_id
      ORDER BY mb.slot_date DESC, mb.created_at DESC
      LIMIT 60
    `);
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      slotDate: r.slot_date,
      startTime: r.start_time,
      endTime: r.end_time,
      mode: r.mode,
      status: r.status,
      notes: r.notes,
      sessionLink: r.session_link,
      mentorName: r.mentor_name,
      mentorType: r.mentor_type,
      studentName: r.student_name,
      grade: r.grade,
      parentName: r.parent_name,
      createdAt: r.created_at,
    })));
  } catch (err: any) {
    console.error('[GET /admin/mentors/all-sessions]', err.message);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/admin/mentors/leaderboard — top performing mentors
router.get('/mentors/leaderboard', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.id, u.full_name, u.email,
        COALESCE(mp.display_name, u.full_name) AS display_name,
        mp.mentor_type, mp.mentor_code, mp.status, mp.performance_health_index,
        mp.is_verified, mp.hourly_rate,
        COUNT(mb.id) FILTER (WHERE mb.status='completed') AS completed_sessions,
        COUNT(mb.id) AS total_sessions,
        COALESCE(AVG(mr.rating::numeric), 0)::numeric(3,1) AS avg_rating,
        COUNT(DISTINCT mr.id) AS total_reviews,
        COALESCE(SUM(mp2.net_payout) FILTER (WHERE mp2.status='processed'), 0) AS total_revenue
      FROM mentor_profiles mp
      JOIN users u ON u.id = mp.user_id
      LEFT JOIN mentor_bookings mb ON mb.mentor_id = mp.id
      LEFT JOIN mentor_reviews mr ON mr.mentor_id = mp.id
      LEFT JOIN mentor_payouts mp2 ON mp2.mentor_id = u.id
      GROUP BY u.id, u.full_name, u.email, mp.display_name, mp.mentor_type,
               mp.mentor_code, mp.status, mp.performance_health_index,
               mp.is_verified, mp.hourly_rate
      ORDER BY completed_sessions DESC, avg_rating DESC
      LIMIT 10
    `);
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      fullName: r.full_name,
      displayName: r.display_name,
      email: r.email,
      mentorType: r.mentor_type,
      mentorCode: r.mentor_code,
      status: r.status,
      phi: Number(r.performance_health_index ?? 100),
      isVerified: r.is_verified,
      hourlyRate: r.hourly_rate,
      completedSessions: Number(r.completed_sessions),
      totalSessions: Number(r.total_sessions),
      avgRating: Number(r.avg_rating),
      totalReviews: Number(r.total_reviews),
      totalRevenue: Number(r.total_revenue),
    })));
  } catch (err: any) {
    console.error('[GET /admin/mentors/leaderboard]', err.message);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// POST /api/admin/mentors/invite — invite a new mentor
router.post('/mentors/invite', requireAdmin, async (req, res) => {
  try {
    const { fullName, email, mentorType, mobile } = req.body;
    if (!fullName || !email) return res.status(400).json({ error: 'fullName and email required' });
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing.length > 0) return res.status(409).json({ error: 'A user with this email already exists' });
    const tempPassword = `Mentor@${Math.floor(100000 + Math.random() * 900000)}`;
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash(tempPassword, 10);
    const userResult = await db.insert(users).values({
      fullName, email, mobile: mobile || null, passwordHash: hash,
      role: 'mentor', isVerified: false,
    }).returning({ id: users.id });
    const userId = userResult[0].id;
    await db.insert(mentorProfiles).values({
      userId,
      mentorType: mentorType || 'subject_tutor',
      status: 'pending',
    }).onConflictDoNothing();
    try {
      const { sendEmail } = await import('../notifications/emailService.js');
      await sendEmail({
        to: email,
        subject: 'Welcome to MetryxOne — Your Mentor Account',
        html: `<p>Dear ${fullName},</p><p>You have been invited as a mentor on MetryxOne.</p><p><b>Login:</b> ${email}<br/><b>Temporary Password:</b> ${tempPassword}</p><p>Please log in and complete your profile setup.</p>`,
      });
    } catch (_e) {}
    res.json({ success: true, userId, tempPassword });
  } catch (err: any) {
    console.error('[POST /admin/mentors/invite]', err.message);
    res.status(500).json({ error: 'Failed to invite mentor' });
  }
});

// POST /api/admin/mentors/:id/notify — send notification email to mentor
router.post('/mentors/:id/notify', requireAdmin, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const userResult = await db.select({ email: users.email, full_name: users.fullName }).from(users).where(eq(users.id, req.params.id));
    if (userResult.length === 0) return res.status(404).json({ error: 'Mentor not found' });
    const { email, full_name } = userResult[0];
    try {
      const { sendEmail } = await import('../notifications/emailService.js');
      await sendEmail({
        to: email,
        subject: subject || 'Notification from MetryxOne Admin',
        html: `<p>Dear ${full_name},</p><p>${message.replace(/\n/g, '<br/>')}</p><p>— MetryxOne Admin Team</p>`,
      });
    } catch (_e) {}
    res.json({ success: true, email });
  } catch (err: any) {
    console.error('[POST /admin/mentors/:id/notify]', err.message);
    res.status(500).json({ error: 'Failed to notify mentor' });
  }
});

// POST /api/admin/mentors/:id/reset-password — generate new temp password for mentor
router.post('/mentors/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const userResult = await db.select({ email: users.email, full_name: users.fullName }).from(users).where(eq(users.id, req.params.id));
    if (userResult.length === 0) return res.status(404).json({ error: 'Mentor not found' });
    const { email, full_name } = userResult[0];
    const tempPassword = `Mtr@${Math.floor(100000 + Math.random() * 900000)}`;
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash(tempPassword, 10);
    await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, req.params.id));
    try {
      const { sendEmail } = await import('../notifications/emailService.js');
      await sendEmail({
        to: email,
        subject: 'MetryxOne — Password Reset by Admin',
        html: `<p>Dear ${full_name},</p><p>Your password has been reset by an administrator.</p><p><b>New Temporary Password:</b> ${tempPassword}</p><p>Please log in and change your password immediately.</p>`,
      });
    } catch (_e) {}
    res.json({ success: true, email, tempPassword });
  } catch (err: any) {
    console.error('[POST /admin/mentors/:id/reset-password]', err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// GET /api/admin/mentors/:id/profile — full profile for a specific mentor
router.get('/mentors/:id/profile', async (req, res) => {
  try {
    const result = await query(`
      SELECT mp.*, u.full_name, u.email
      FROM mentor_profiles mp
      LEFT JOIN users u ON u.id = mp.user_id
      WHERE mp.user_id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[GET /admin/mentors/:id/profile]', err.message);
    res.status(500).json({ error: 'Failed to fetch mentor profile' });
  }
});

// POST /api/admin/mentors/:id/profile — upsert mentor profile
router.post('/mentors/:id/profile', async (req, res) => {
  try {
    const userId = req.params.id;
    const {
      displayName, title, bio, mentorType, subjects, psychologicalAreas,
      specializations, lbiDomains, languages, experienceYears, hourlyRate,
      currency, mode, city, education, certifications, ageGroups,
      availability, profileImageUrl, linkedinUrl, isVerified, isFeatured,
      aiMatchTags, status,
    } = req.body;

    const result = await query(`
      INSERT INTO mentor_profiles (
        user_id, display_name, title, bio, mentor_type, subjects, psychological_areas,
        specializations, lbi_domains, languages, experience_years, hourly_rate,
        currency, mode, city, education, certifications, age_groups,
        availability, profile_image_url, linkedin_url, is_verified, is_featured,
        ai_match_tags, status, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6::text[],$7::text[],$8::text[],$9::text[],$10::text[],
        $11,$12,$13,$14,$15,$16,$17::text[],$18::text[],$19,$20,$21,$22,$23,$24::text[],$25,NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        display_name      = EXCLUDED.display_name,
        title             = EXCLUDED.title,
        bio               = EXCLUDED.bio,
        mentor_type       = EXCLUDED.mentor_type,
        subjects          = EXCLUDED.subjects,
        psychological_areas = EXCLUDED.psychological_areas,
        specializations   = EXCLUDED.specializations,
        lbi_domains       = EXCLUDED.lbi_domains,
        languages         = EXCLUDED.languages,
        experience_years  = EXCLUDED.experience_years,
        hourly_rate       = EXCLUDED.hourly_rate,
        currency          = EXCLUDED.currency,
        mode              = EXCLUDED.mode,
        city              = EXCLUDED.city,
        education         = EXCLUDED.education,
        certifications    = EXCLUDED.certifications,
        age_groups        = EXCLUDED.age_groups,
        availability      = EXCLUDED.availability,
        profile_image_url = EXCLUDED.profile_image_url,
        linkedin_url      = EXCLUDED.linkedin_url,
        is_verified       = EXCLUDED.is_verified,
        is_featured       = EXCLUDED.is_featured,
        ai_match_tags     = EXCLUDED.ai_match_tags,
        status            = EXCLUDED.status,
        updated_at        = NOW()
      RETURNING *
    `, [
      userId,
      displayName || null, title || null, bio || null,
      mentorType || 'subject_tutor',
      subjects || [],
      psychologicalAreas || [],
      specializations || [],
      lbiDomains || [],
      languages || [],
      parseInt(experienceYears) || 0,
      parseFloat(hourlyRate) || 0,
      currency || 'INR',
      mode || 'online',
      city || null,
      JSON.stringify(education || []),
      certifications || [],
      ageGroups || [],
      JSON.stringify(availability || {}),
      profileImageUrl || null,
      linkedinUrl || null,
      Boolean(isVerified),
      Boolean(isFeatured),
      aiMatchTags || [],
      status || 'pending',
    ]);

    res.json({ success: true, profile: result.rows[0] });
  } catch (err: any) {
    console.error('[POST /admin/mentors/:id/profile]', err.message);
    res.status(500).json({ error: 'Failed to save mentor profile' });
  }
});

// PATCH /api/admin/mentors/:id/verify — toggle verified status
router.patch('/mentors/:id/verify', async (req, res) => {
  try {
    const { verified } = req.body;
    await db.update(mentorProfiles)
      .set({ isVerified: Boolean(verified), updatedAt: new Date() })
      .where(eq(mentorProfiles.userId, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/mentors/:id/feature — toggle featured status
router.patch('/mentors/:id/feature', async (req, res) => {
  try {
    const { featured } = req.body;
    await db.update(mentorProfiles)
      .set({ isFeatured: Boolean(featured), updatedAt: new Date() })
      .where(eq(mentorProfiles.userId, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Assessment Domains & Subdomains ─────────────────────────

router.get('/assessment-domains', async (_req, res) => {
  try {
    const result = await query(`
      SELECT d.*, COUNT(s.id)::int AS subdomain_count
      FROM assessment_domains d
      LEFT JOIN assessment_subdomains s ON s.domain_id = d.id
      GROUP BY d.id ORDER BY d.id ASC
    `);
    res.json(result.rows.map((r: any) => ({
      id: r.id, domainCode: r.domain_code, domainName: r.domain_name,
      weightPercent: r.weight_percent, toolsMethods: r.tools_methods,
      rootCause: r.root_cause, practicalOutcome: r.practical_outcome,
      correlations: r.correlations, subdomainCount: r.subdomain_count, isActive: r.is_active,
    })));
  } catch (err: any) { console.error('[GET /admin/assessment-domains]', err.message); res.json([]); }
});

router.get('/assessment-domains/:id/subdomains', async (req, res) => {
  try {
    const result = await db.select().from(assessmentSubdomains)
      .where(eq(assessmentSubdomains.domainId, parseInt(req.params.id)))
      .orderBy(asc(assessmentSubdomains.sortOrder));
    res.json(result.map((r) => ({
      id: r.id, domainId: r.domainId, subdomainName: r.subdomainName,
      weightInDomain: r.weightInDomain, sortOrder: r.sortOrder, isActive: r.isActive,
    })));
  } catch (err: any) { console.error('[GET /admin/assessment-domains/:id/subdomains]', err.message); res.json([]); }
});

router.get('/package-domains/:packageId', async (req, res) => {
  try {
    const result = await query(`
      SELECT d.* FROM package_domain_mapping pdm
      JOIN assessment_domains d ON d.id = pdm.domain_id
      WHERE pdm.package_id = $1 ORDER BY d.id ASC
    `, [req.params.packageId]);
    res.json(result.rows.map((r: any) => ({
      id: r.id, domainCode: r.domain_code, domainName: r.domain_name, weightPercent: r.weight_percent,
    })));
  } catch (err: any) { console.error('[GET /admin/package-domains]', err.message); res.json([]); }
});

router.put('/package-domains/:packageId', async (req, res) => {
  try {
    const { domainIds } = req.body;
    if (!Array.isArray(domainIds)) return res.status(400).json({ error: 'domainIds must be an array' });
    await db.delete(packageDomainMapping).where(eq(packageDomainMapping.packageId, req.params.packageId));
    for (const dId of domainIds) {
      await db.insert(packageDomainMapping)
        .values({ packageId: req.params.packageId, domainId: dId })
        .onConflictDoNothing();
    }
    res.json({ success: true, count: domainIds.length });
  } catch (err: any) { console.error('[PUT /admin/package-domains]', err.message); res.status(500).json({ error: 'Failed to update' }); }
});

// ─── Subscription Packages CRUD ───────────────────────────────

function rowToPackage(r: any) {
  return {
    id: r.id, category: r.category,
    studentSegment: r.studentSegment ?? r.student_segment,
    productName: r.productName ?? r.product_name,
    isRecommended: r.isRecommended ?? r.is_recommended,
    domainsCovered: r.domainsCovered ?? r.domains_covered,
    price: r.price, priceMax: r.priceMax ?? r.price_max,
    validityDays: r.validityDays ?? r.validity_days,
    questionCount: r.questionCount ?? r.question_count,
    moduleCount: r.moduleCount ?? r.module_count,
    modulesCovered: r.modulesCovered ?? r.modules_covered,
    durationText: r.durationText ?? r.duration_text,
    durationMinutes: r.durationMinutes ?? r.duration_minutes,
    billingType: r.billingType ?? r.billing_type,
    availabilityWindow: r.availabilityWindow ?? r.availability_window,
    classRange: r.classRange ?? r.class_range,
    reportType: r.reportType ?? r.report_type,
    description: r.description,
    sortOrder: r.sortOrder ?? r.sort_order,
    isActive: r.isActive ?? r.is_active,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
    subcategory: r.subcategory,
    pkgStatus: r.pkgStatus ?? r.pkg_status,
    frontendSections: r.frontendSections ?? r.frontend_sections,
    reportConfig: r.reportConfig ?? r.report_config,
    customModuleId: r.customModuleId ?? r.custom_module_id,
    originalPrice: r.originalPrice ?? r.original_price,
    discountPct: r.discountPct ?? r.discount_pct,
    offerLabel: r.offerLabel ?? r.offer_label,
    couponCode: r.couponCode ?? r.coupon_code,
    couponDiscountPct: r.couponDiscountPct ?? r.coupon_discount_pct,
    trialDays: r.trialDays ?? r.trial_days,
    highlights: r.highlights,
  };
}

// GET /api/admin/subscription-packages — list all packages
router.get('/subscription-packages', async (_req, res) => {
  try {
    const result = await db.select().from(subscriptionPackages).orderBy(asc(subscriptionPackages.sortOrder));
    res.json(result.map((r: any) => rowToPackage(r)));
  } catch (err: any) {
    console.error('[GET /admin/subscription-packages]', err.message);
    res.json([]);
  }
});

// GET /api/admin/subscription-packages/stats
router.get('/subscription-packages/stats', async (_req, res) => {
  try {
    const [pkgStats, subStats, catStats] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM subscription_packages`),
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'active')::int AS active FROM student_subscriptions`),
      query(`SELECT category, COUNT(*)::int AS count FROM subscription_packages GROUP BY category`),
    ]);
    const p = pkgStats.rows[0] || {};
    const s = subStats.rows[0] || {};
    const byCategory: Record<string, number> = {};
    for (const row of catStats.rows) byCategory[(row as any).category] = (row as any).count;
    res.json({
      totalPackages: p.total ?? 0, activePackages: p.active ?? 0,
      totalSubscriptions: s.total ?? 0, activeSubscriptions: s.active ?? 0,
      byCategory,
    });
  } catch (err: any) {
    console.error('[GET /admin/subscription-packages/stats]', err.message);
    res.json({ totalPackages: 0, activePackages: 0, totalSubscriptions: 0, activeSubscriptions: 0 });
  }
});

// POST /api/admin/subscription-packages — create package
router.post('/subscription-packages', async (req, res) => {
  try {
    const { category, studentSegment, productName, isRecommended, domainsCovered,
            price, priceMax, validityDays, questionCount, moduleCount, modulesCovered,
            durationText, durationMinutes, billingType, availabilityWindow, classRange,
            reportType, description, sortOrder } = req.body;
    if (!productName || !category) return res.status(400).json({ error: 'Product name and category are required' });
    const result = await query(`
      INSERT INTO subscription_packages (category, student_segment, product_name, is_recommended,
        domains_covered, price, price_max, validity_days, question_count, module_count, modules_covered,
        duration_text, duration_minutes, billing_type, availability_window, class_range,
        report_type, description, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *
    `, [category, studentSegment || '', productName, isRecommended || false,
        domainsCovered || '{}', price || 0, priceMax || null, validityDays || null,
        questionCount || null, moduleCount || 1, modulesCovered || null,
        durationText || null, durationMinutes || null, billingType || 'one-time',
        availabilityWindow || null, classRange || null, reportType || null,
        description || null, sortOrder || 0]);
    res.status(201).json(rowToPackage(result.rows[0]));
  } catch (err: any) {
    console.error('[POST /admin/subscription-packages]', err.message);
    res.status(500).json({ error: 'Failed to create package' });
  }
});

// PATCH /api/admin/subscription-packages/:id — update package
router.patch('/subscription-packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, studentSegment, productName, isRecommended, domainsCovered,
            price, priceMax, validityDays, questionCount, moduleCount, modulesCovered,
            durationText, durationMinutes, billingType, availabilityWindow, classRange,
            reportType, description, sortOrder, isActive } = req.body;
    const result = await query(`
      UPDATE subscription_packages SET
        category = COALESCE($2, category), student_segment = COALESCE($3, student_segment),
        product_name = COALESCE($4, product_name), is_recommended = COALESCE($5, is_recommended),
        domains_covered = COALESCE($6, domains_covered), price = COALESCE($7, price),
        price_max = COALESCE($8, price_max), validity_days = COALESCE($9, validity_days),
        question_count = COALESCE($10, question_count), module_count = COALESCE($11, module_count),
        modules_covered = COALESCE($12, modules_covered), duration_text = COALESCE($13, duration_text),
        duration_minutes = COALESCE($14, duration_minutes), billing_type = COALESCE($15, billing_type),
        availability_window = COALESCE($16, availability_window), class_range = COALESCE($17, class_range),
        report_type = COALESCE($18, report_type), description = COALESCE($19, description),
        sort_order = COALESCE($20, sort_order), is_active = COALESCE($21, is_active),
        updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [id, category, studentSegment, productName, isRecommended, domainsCovered,
        price, priceMax, validityDays, questionCount, moduleCount, modulesCovered,
        durationText, durationMinutes, billingType, availabilityWindow, classRange,
        reportType, description, sortOrder, isActive]);
    if (!result.rows.length) return res.status(404).json({ error: 'Package not found' });
    res.json(rowToPackage(result.rows[0]));
  } catch (err: any) {
    console.error('[PATCH /admin/subscription-packages/:id]', err.message);
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// DELETE /api/admin/subscription-packages/:id
router.delete('/subscription-packages/:id', async (req, res) => {
  try {
    await db.delete(subscriptionPackages).where(eq(subscriptionPackages.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /admin/subscription-packages/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

// POST /api/admin/subscription-packages/seed — seed comprehensive modules for all services
router.post('/subscription-packages/seed', async (_req, res) => {
  try {
    const ALL_MODULES = [
      // ── LBI™ Behavioural Assessment ──────────────────────────────────────────
      {
        productName: 'LBI Quick Scan',
        category: 'LBI Behavioural Assessment',
        subcategory: 'Entry',
        studentSegment: 'Classes 1–12',
        price: null,
        validityDays: 7,
        questionCount: 15,
        reportType: 'Basic',
        billingType: 'one-time',
        description: 'A short 15-item snapshot of your child\'s core learning behaviours across attention, memory and self-regulation.',
        highlights: ['15 assessment items', '7-day access', 'Basic PDF report', 'Key strengths highlighted'],
        domainsCovered: ['Academic & Cognitive Efficiency', 'Mindset & Self-Regulation'],
        isRecommended: false,
        sortOrder: 100,
      },
      {
        productName: 'LBI Starter',
        category: 'LBI Behavioural Assessment',
        subcategory: 'Starter',
        studentSegment: 'Classes 3–8',
        price: 299,
        validityDays: 30,
        questionCount: 25,
        reportType: 'Basic',
        billingType: 'one-time',
        description: 'Entry-level LBI assessment mapping foundational learning behaviours with a simple parent-friendly report.',
        highlights: ['25 assessment items', '30-day access', 'Domain-wise breakdown', 'Parent summary report'],
        domainsCovered: ['Academic & Cognitive Efficiency', 'Mindset & Self-Regulation', 'Social & Emotional Intelligence'],
        isRecommended: false,
        sortOrder: 101,
      },
      {
        productName: 'LBI Core Assessment™',
        category: 'LBI Behavioural Assessment',
        subcategory: 'Core',
        studentSegment: 'Classes 6–12',
        price: 799,
        validityDays: 90,
        questionCount: 45,
        reportType: 'Standard',
        billingType: 'one-time',
        description: 'Comprehensive LBI assessment covering 5 major behavioural domains with detailed insights and personalised recommendations.',
        highlights: ['45 assessment items', '90-day access', 'Detailed domain report', 'Personalised strategies', 'Study plan suggestions'],
        domainsCovered: ['Academic & Cognitive Efficiency', 'Mindset & Self-Regulation', 'Social & Emotional Intelligence', 'Discipline, Habits & Commitment', 'Thinking Quality Profiling'],
        isRecommended: true,
        sortOrder: 102,
      },
      {
        productName: 'LBI Full Profile',
        category: 'LBI Behavioural Assessment',
        subcategory: 'Full',
        studentSegment: 'Classes 6–12',
        price: 1499,
        validityDays: 180,
        questionCount: 80,
        reportType: 'Detailed',
        billingType: 'one-time',
        description: 'In-depth LBI profiling across all 10 domains. Includes a Behaviourial Intelligence Score, growth tracking and a re-assessment after 90 days.',
        highlights: ['80 assessment items', '180-day access', 'All 10 LBI domains', 'Behavioural Intelligence Score™', 'Re-assessment included', 'Peer benchmarking'],
        domainsCovered: ['Academic & Cognitive Efficiency', 'Mindset & Self-Regulation', 'Social & Emotional Intelligence', 'Discipline, Habits & Commitment', 'Thinking Quality Profiling', 'Motivation, Values & Resilience', 'Optimism, Courage & Resilience', 'Lifestyle, Pressures & Environment'],
        isRecommended: false,
        sortOrder: 103,
      },
      {
        productName: 'LBI Annual + Mentor',
        category: 'LBI Behavioural Assessment',
        subcategory: 'Premium',
        studentSegment: 'Classes 8–12',
        price: 2999,
        validityDays: 365,
        questionCount: 100,
        reportType: 'Comprehensive',
        billingType: 'one-time',
        description: 'Year-long behavioural intelligence programme with full LBI profiling, quarterly check-ins and 2 included mentor sessions with a counsellor.',
        highlights: ['100 assessment items', '1-year access', 'Quarterly re-assessments', '2 mentor sessions included', 'Annual portfolio report', 'Priority support'],
        domainsCovered: ['Academic & Cognitive Efficiency', 'Mindset & Self-Regulation', 'Social & Emotional Intelligence', 'Discipline, Habits & Commitment', 'Thinking Quality Profiling', 'Motivation, Values & Resilience', 'Lifestyle, Pressures & Environment', 'Emotional Self-Expression & Regulation'],
        isRecommended: false,
        sortOrder: 104,
      },

      // ── Exam Readiness ───────────────────────────────────────────────────────
      {
        productName: 'Exam Mini Check',
        category: 'Exam Readiness',
        subcategory: 'Free',
        studentSegment: 'Classes 9–12',
        price: null,
        validityDays: 15,
        questionCount: 20,
        reportType: 'Basic',
        billingType: 'one-time',
        description: 'Quick 20-item exam-readiness diagnostic. Get instant feedback on focus, stress and time-management readiness.',
        highlights: ['20 assessment items', 'Instant digital report', 'Focus & stress snapshot', 'Free — no card needed'],
        domainsCovered: ['Academic & Cognitive Efficiency', 'Mindset & Self-Regulation'],
        isRecommended: false,
        sortOrder: 200,
      },
      {
        productName: 'Board Exam Sprint',
        category: 'Exam Readiness',
        subcategory: 'Sprint',
        studentSegment: 'Classes 10 & 12',
        price: 299,
        validityDays: 30,
        questionCount: 30,
        reportType: 'Basic',
        billingType: 'one-time',
        description: '30-day focused exam readiness programme for board exam candidates. Covers key cognitive and emotional preparedness domains.',
        highlights: ['30 assessment items', '30-day access', 'Board exam optimised', 'Domain-wise readiness score'],
        domainsCovered: ['Academic & Cognitive Efficiency', 'Mindset & Self-Regulation', 'Discipline, Habits & Commitment'],
        isRecommended: false,
        sortOrder: 201,
      },
      {
        productName: 'Exam Ready Pro™',
        category: 'Exam Readiness',
        subcategory: 'Pro',
        studentSegment: 'Classes 9–12',
        price: 999,
        validityDays: 90,
        questionCount: 50,
        reportType: 'Standard',
        billingType: 'one-time',
        description: 'Comprehensive exam-readiness assessment with 50 items across 6 domains. Includes a detailed readiness report and personalised preparation strategies.',
        highlights: ['50 assessment items', '90-day access', '6 readiness domains', 'Personalised prep plan', 'Progress tracking'],
        domainsCovered: ['Academic & Cognitive Efficiency', 'Mindset & Self-Regulation', 'Discipline, Habits & Commitment', 'Thinking Quality Profiling', 'Emotional Self-Expression & Regulation', 'Lifestyle, Pressures & Environment'],
        isRecommended: true,
        sortOrder: 202,
      },
      {
        productName: 'NEET / JEE Elite',
        category: 'Exam Readiness',
        subcategory: 'Competitive',
        studentSegment: 'JEE / NEET Aspirants',
        price: 2499,
        validityDays: 180,
        questionCount: 90,
        reportType: 'Detailed',
        billingType: 'one-time',
        description: 'High-intensity exam readiness profiling for competitive entrance exam aspirants. Covers pressure management, cognitive load, study stamina and resilience.',
        highlights: ['90 assessment items', '180-day access', 'Competitive exam benchmarks', 'Pressure management profiling', 'Weekly readiness check-ins', 'Peer percentile rank'],
        domainsCovered: ['Academic & Cognitive Efficiency', 'Thinking Quality Profiling', 'Emotional Self-Expression & Regulation', 'Mindset & Self-Regulation', 'Lifestyle, Pressures & Environment', 'Motivation, Values & Resilience'],
        isRecommended: false,
        sortOrder: 203,
      },
      {
        productName: 'Annual Exam Pack',
        category: 'Exam Readiness',
        subcategory: 'Annual',
        studentSegment: 'Classes 9–12',
        price: 3999,
        validityDays: 365,
        questionCount: 120,
        reportType: 'Comprehensive',
        billingType: 'one-time',
        description: 'Full-year exam readiness programme. Tracks cognitive and behavioural readiness across all major examination seasons with quarterly reports.',
        highlights: ['120 assessment items', '1-year access', 'Quarterly readiness reports', 'Term-wise tracking', 'Mentor session included', 'Annual progress portfolio'],
        domainsCovered: ['Academic & Cognitive Efficiency', 'Thinking Quality Profiling', 'Emotional Self-Expression & Regulation', 'Mindset & Self-Regulation', 'Lifestyle, Pressures & Environment', 'Motivation, Values & Resilience', 'Discipline, Habits & Commitment'],
        isRecommended: false,
        sortOrder: 204,
      },

      // ── Career Compass™ / Career Intelligence ────────────────────────────────
      {
        productName: 'Career Spark',
        category: 'Career Intelligence',
        subcategory: 'Free',
        studentSegment: 'Classes 8–12',
        price: null,
        validityDays: 30,
        questionCount: 20,
        reportType: 'Basic',
        billingType: 'one-time',
        description: 'A free introductory career interest and strength mapping tool. Discover your top 3 career directions based on personality and learning style.',
        highlights: ['20 items', 'Top 3 career matches', 'Interest & strength mapping', 'Free forever'],
        domainsCovered: ['Social & Emotional Intelligence', 'Motivation, Values & Resilience'],
        isRecommended: false,
        sortOrder: 300,
      },
      {
        productName: 'Career Explorer',
        category: 'Career Intelligence',
        subcategory: 'Explorer',
        studentSegment: 'Classes 9–12',
        price: 499,
        validityDays: 90,
        questionCount: 40,
        reportType: 'Standard',
        billingType: 'one-time',
        description: 'A structured career discovery assessment matching student traits with 29+ career paths. Includes a domain compatibility matrix and subject-alignment guide.',
        highlights: ['40 assessment items', '90-day access', '29+ career paths mapped', 'Subject alignment guide', 'Strengths & gaps report'],
        domainsCovered: ['Motivation, Values & Resilience', 'Social & Emotional Intelligence', 'Thinking Quality Profiling'],
        isRecommended: false,
        sortOrder: 301,
      },
      {
        productName: 'Career Intelligence Pro™',
        category: 'Career Intelligence',
        subcategory: 'Pro',
        studentSegment: 'Classes 10–12 & UG',
        price: 1499,
        validityDays: 180,
        questionCount: 70,
        reportType: 'Detailed',
        billingType: 'one-time',
        description: 'Deep career intelligence profiling covering cognitive, personality and interest domains. Includes a long-list of 50+ career options with fit scores and roadmaps.',
        highlights: ['70 assessment items', '180-day access', '50+ career options with fit scores', 'Domain-wise competency map', 'Personalised roadmap', 'Peer benchmark data'],
        domainsCovered: ['Motivation, Values & Resilience', 'Social & Emotional Intelligence', 'Thinking Quality Profiling', 'Academic & Cognitive Efficiency', 'Adaptability & Integrity Management'],
        isRecommended: true,
        sortOrder: 302,
      },
      {
        productName: 'Career Deep Dive + Mentor',
        category: 'Career Intelligence',
        subcategory: 'Premium',
        studentSegment: 'Classes 11–12 & UG',
        price: 3499,
        validityDays: 365,
        questionCount: 100,
        reportType: 'Comprehensive',
        billingType: 'one-time',
        description: 'The most comprehensive career intelligence programme, combining deep psychometric assessment with 3 one-on-one career mentoring sessions and an annual career portfolio.',
        highlights: ['100 assessment items', '1-year access', '3 career mentor sessions', 'Annual career portfolio', '100+ career paths analysed', 'University & stream guidance'],
        domainsCovered: ['Motivation, Values & Resilience', 'Social & Emotional Intelligence', 'Thinking Quality Profiling', 'Academic & Cognitive Efficiency', 'Adaptability & Integrity Management', 'Discipline, Habits & Commitment'],
        isRecommended: false,
        sortOrder: 303,
      },

      // ── Wellness Check-ins ───────────────────────────────────────────────────
      {
        productName: 'Wellness Snapshot',
        category: 'Wellness',
        subcategory: 'Free',
        studentSegment: 'Classes 6–12',
        price: null,
        validityDays: 7,
        questionCount: 10,
        reportType: 'Basic',
        billingType: 'one-time',
        description: 'A quick 10-item wellbeing check-in covering stress, mood and energy levels. Alerts parents if intervention is needed.',
        highlights: ['10-item wellness check', 'Instant mood summary', 'Stress & energy levels', 'Parent alert if needed', 'Free access'],
        domainsCovered: ['Emotional Self-Expression & Regulation', 'Lifestyle, Pressures & Environment'],
        isRecommended: false,
        sortOrder: 400,
      },
      {
        productName: 'Monthly Wellness Tracker',
        category: 'Wellness',
        subcategory: 'Monthly',
        studentSegment: 'Classes 6–12',
        price: 199,
        validityDays: 30,
        questionCount: 20,
        reportType: 'Basic',
        billingType: 'subscription',
        description: 'Monthly wellbeing programme with weekly check-ins tracking stress, burnout, sleep and social wellbeing. Generates a monthly wellness trend report for parents.',
        highlights: ['4 weekly check-ins', 'Burnout & stress tracking', 'Sleep quality indicator', 'Monthly trend report', 'Parent dashboard alerts'],
        domainsCovered: ['Emotional Self-Expression & Regulation', 'Lifestyle, Pressures & Environment', 'Mindset & Self-Regulation'],
        isRecommended: false,
        sortOrder: 401,
      },
      {
        productName: 'Term Wellness Programme',
        category: 'Wellness',
        subcategory: 'Term',
        studentSegment: 'Classes 6–12',
        price: 499,
        validityDays: 90,
        questionCount: 40,
        reportType: 'Standard',
        billingType: 'one-time',
        description: 'Full-term wellness monitoring with fortnightly psychometric check-ins, burnout screening and a term-end wellness summary report.',
        highlights: ['6 fortnightly check-ins', 'Burnout screening', 'Term wellness report', 'Personalised coping strategies', 'Parent & teacher summary'],
        domainsCovered: ['Emotional Self-Expression & Regulation', 'Lifestyle, Pressures & Environment', 'Mindset & Self-Regulation', 'Optimism, Courage & Resilience'],
        isRecommended: true,
        sortOrder: 402,
      },
      {
        productName: 'Annual Wellness Plan',
        category: 'Wellness',
        subcategory: 'Annual',
        studentSegment: 'Classes 6–12',
        price: 999,
        validityDays: 365,
        questionCount: 80,
        reportType: 'Detailed',
        billingType: 'one-time',
        description: 'Year-round wellbeing support with monthly check-ins, quarterly trend analysis, a yearly wellness portfolio and access to a crisis-alert system for schools.',
        highlights: ['12 monthly check-ins', 'Quarterly trend analysis', 'Annual wellness portfolio', 'Crisis-alert system', 'School-dashboard integration', 'Parent coaching notes'],
        domainsCovered: ['Emotional Self-Expression & Regulation', 'Lifestyle, Pressures & Environment', 'Mindset & Self-Regulation', 'Optimism, Courage & Resilience', 'Social & Emotional Intelligence'],
        isRecommended: false,
        sortOrder: 403,
      },

      // ── Mentor Matching ──────────────────────────────────────────────────────
      {
        productName: 'Mentor Trial Session',
        category: 'Mentor Matching',
        subcategory: 'Trial',
        studentSegment: 'All Students',
        price: 299,
        validityDays: 7,
        questionCount: 0,
        reportType: 'Session',
        billingType: 'one-time',
        description: 'One 45-minute introductory session with a matched mentor — subject tutor or psychological counsellor. No commitment required.',
        highlights: ['1 x 45-min session', '7-day booking window', 'Subject tutor or counsellor', 'No auto-renewal'],
        domainsCovered: [],
        isRecommended: false,
        sortOrder: 500,
      },
      {
        productName: 'Mentor Starter Bundle',
        category: 'Mentor Matching',
        subcategory: 'Starter',
        studentSegment: 'All Students',
        price: 799,
        validityDays: 30,
        questionCount: 0,
        reportType: 'Session',
        billingType: 'one-time',
        description: '3 one-on-one mentor sessions over 30 days. Choose from subject experts, counsellors or career coaches.',
        highlights: ['3 x 60-min sessions', '30-day access', 'Choose mentor type', 'Session summary notes', 'Flexible scheduling'],
        domainsCovered: [],
        isRecommended: false,
        sortOrder: 501,
      },
      {
        productName: 'Mentor Growth Bundle',
        category: 'Mentor Matching',
        subcategory: 'Growth',
        studentSegment: 'All Students',
        price: 1499,
        validityDays: 60,
        questionCount: 0,
        reportType: 'Session',
        billingType: 'one-time',
        description: '6 mentor sessions over 60 days. Includes a pre-session diagnostic assessment and post-programme progress note.',
        highlights: ['6 x 60-min sessions', '60-day access', 'Pre-session assessment', 'Progress note at end', 'Priority mentor matching'],
        domainsCovered: [],
        isRecommended: true,
        sortOrder: 502,
      },
      {
        productName: 'Mentor Premium Bundle',
        category: 'Mentor Matching',
        subcategory: 'Premium',
        studentSegment: 'All Students',
        price: 2999,
        validityDays: 120,
        questionCount: 0,
        reportType: 'Session',
        billingType: 'one-time',
        description: '12 mentor sessions over 4 months with a dedicated assigned mentor, bi-weekly progress reviews and a complete mentoring portfolio at the end.',
        highlights: ['12 x 60-min sessions', '4-month programme', 'Dedicated mentor assigned', 'Bi-weekly progress reviews', 'Mentoring portfolio', 'Parent progress briefings'],
        domainsCovered: [],
        isRecommended: false,
        sortOrder: 503,
      },

      // ── Competency Assessment (Professional) ─────────────────────────────────
      {
        productName: 'Mini Assessment',
        category: 'Competency Assessment',
        subcategory: 'Entry',
        studentSegment: 'Professionals & Institutions',
        price: 299,
        validityDays: 7,
        questionCount: 20,
        reportType: 'Basic',
        billingType: 'one-time',
        description: 'A 20-item professional competency snapshot across 3 core domains. Ideal for pre-screening and quick capability checks.',
        highlights: ['20 assessment items', '7-day access', '3 competency domains', 'Basic competency report'],
        domainsCovered: ['Cognitive Competencies', 'Communication Competencies', 'Leadership Competencies'],
        isRecommended: false,
        sortOrder: 600,
      },
      {
        productName: 'Focus & Clarity Check',
        category: 'Competency Assessment',
        subcategory: 'Entry',
        studentSegment: 'Professionals & Institutions',
        price: 299,
        validityDays: 90,
        questionCount: 30,
        reportType: 'Basic',
        billingType: 'one-time',
        description: 'A focused competency assessment for cognitive clarity and decision-making. Used widely in hiring screening and development programmes.',
        highlights: ['30 assessment items', '90-day access', 'Decision-making profiling', 'Focus & clarity score'],
        domainsCovered: ['Cognitive Competencies', 'Emotional Intelligence Competencies'],
        isRecommended: false,
        sortOrder: 601,
      },
      {
        productName: 'EXAM READY™',
        category: 'Competency Assessment',
        subcategory: 'Standard',
        studentSegment: 'Professionals & Institutions',
        price: 999,
        validityDays: 30,
        questionCount: 40,
        reportType: 'Standard',
        billingType: 'one-time',
        description: 'Standard professional competency assessment covering 5 key domains. Benchmarked against industry norms with a percentile report.',
        highlights: ['40 assessment items', '30-day access', '5 competency domains', 'Industry benchmark report', 'Percentile ranking'],
        domainsCovered: ['Cognitive Competencies', 'Communication Competencies', 'Leadership Competencies', 'Emotional Intelligence Competencies', 'Interpersonal Competencies'],
        isRecommended: true,
        sortOrder: 602,
      },
      {
        productName: 'Exam Season Booster',
        category: 'Competency Assessment',
        subcategory: 'Booster',
        studentSegment: 'Professionals & Institutions',
        price: 699,
        validityDays: 180,
        questionCount: 60,
        reportType: 'Standard',
        billingType: 'one-time',
        description: 'Targeted competency booster for high-demand periods. 60 items across thinking quality and self-regulation domains.',
        highlights: ['60 assessment items', '180-day access', 'Thinking quality focus', 'Self-regulation profiling', 'Development tips included'],
        domainsCovered: ['Cognitive Competencies', 'Emotional Intelligence Competencies', 'Interpersonal Competencies'],
        isRecommended: false,
        sortOrder: 603,
      },
      {
        productName: 'Annual Core LBI',
        category: 'Competency Assessment',
        subcategory: 'Annual',
        studentSegment: 'Professionals & Institutions',
        price: 1499,
        validityDays: 365,
        questionCount: 120,
        reportType: 'Detailed',
        billingType: 'one-time',
        description: 'Full-year competency programme covering 8 domains with semi-annual re-assessments, peer benchmarking and a development roadmap.',
        highlights: ['120 assessment items', '1-year access', '8 competency domains', 'Semi-annual re-assessment', 'Peer benchmark data', 'Development roadmap'],
        domainsCovered: ['Cognitive Competencies', 'Communication Competencies', 'Leadership Competencies', 'Emotional Intelligence Competencies', 'Interpersonal Competencies', 'Integrity & Ethics', 'Adaptability Competencies', 'Strategic Thinking'],
        isRecommended: true,
        sortOrder: 604,
      },
      {
        productName: 'High-Pressure Premium',
        category: 'Competency Assessment',
        subcategory: 'Premium',
        studentSegment: 'Professionals & Institutions',
        price: 2999,
        validityDays: 365,
        questionCount: 180,
        reportType: 'Comprehensive',
        billingType: 'one-time',
        description: 'Comprehensive competency profiling across all 19 domains. Designed for leadership assessment, succession planning and high-potential identification.',
        highlights: ['180 assessment items', '1-year access', 'All 19 competency domains', 'Comprehensive leadership profile', 'Succession planning report', '2 debrief sessions'],
        domainsCovered: ['Cognitive Competencies', 'Communication Competencies', 'Leadership Competencies', 'Emotional Intelligence Competencies', 'Interpersonal Competencies', 'Integrity & Ethics', 'Adaptability Competencies', 'Strategic Thinking', 'Innovation Competencies', 'Resilience Competencies'],
        isRecommended: false,
        sortOrder: 605,
      },
      {
        productName: 'Post-Exam Transition Check',
        category: 'Competency Assessment',
        subcategory: 'Transition',
        studentSegment: 'Professionals & Institutions',
        price: 499,
        validityDays: 120,
        questionCount: 45,
        reportType: 'Standard',
        billingType: 'one-time',
        description: 'Post-assessment transition check for candidates moving between roles or programmes. Maps adaptability and motivation readiness.',
        highlights: ['45 assessment items', '120-day access', 'Transition readiness score', 'Adaptability profiling', 'Motivation mapping'],
        domainsCovered: ['Adaptability Competencies', 'Integrity & Ethics', 'Resilience Competencies'],
        isRecommended: false,
        sortOrder: 606,
      },
    ];

    let inserted = 0;
    let skipped = 0;

    for (const m of ALL_MODULES) {
      const existing = await query(`SELECT 1 FROM subscription_packages WHERE product_name = $1`, [m.productName]);
      if ((existing.rowCount ?? 0) > 0) { skipped++; continue; }

      await query(
        `INSERT INTO subscription_packages
          (product_name, category, subcategory, student_segment, price, validity_days,
           question_count, report_type, billing_type, description, highlights,
           domains_covered, is_recommended, sort_order, is_active, pkg_status,
           difficulty_distribution, question_draw_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,'active',
                 '{"easy":30,"medium":50,"hard":20}'::jsonb, 'weighted')`,
        [
          m.productName, m.category, m.subcategory, m.studentSegment,
          m.price ?? null, m.validityDays, m.questionCount, m.reportType,
          m.billingType, m.description, m.highlights,
          m.domainsCovered, m.isRecommended, m.sortOrder,
        ]
      );
      inserted++;
    }

    res.json({ message: `Seeded ${inserted} module(s), skipped ${skipped} existing`, inserted, skipped, total: ALL_MODULES.length });
  } catch (err: any) {
    console.error('[POST /admin/subscription-packages/seed]', err.message);
    res.status(500).json({ error: 'Failed to seed packages', details: err.message });
  }
});

// ─── Student Subscriptions (Package Assignments) ─────────────────

// GET /api/admin/children-list — all children for assignment dropdown
router.get('/children-list', async (_req, res) => {
  try {
    const result = await query(`
      SELECT c.id, c.name, c.age, c.grade, c.board, u.full_name AS parent_name
      FROM children c
      LEFT JOIN users u ON u.id = c.parent_id
      ORDER BY c.name ASC
    `);
    res.json(result.rows.map((r: any) => ({
      id: r.id, name: r.name, age: r.age, grade: r.grade,
      board: r.board, parentName: r.parent_name,
    })));
  } catch (err: any) {
    console.error('[GET /admin/children-list]', err.message);
    res.json([]);
  }
});

// GET /api/admin/student-subscriptions — list all package assignments
router.get('/student-subscriptions', async (req, res) => {
  try {
    const { status, search } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') { params.push(status); conditions.push(`ss.status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(c.name ILIKE $${params.length} OR sp.product_name ILIKE $${params.length})`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`
      SELECT ss.*, c.name AS child_name, c.grade AS child_grade, c.age AS child_age,
             sp.product_name, sp.category AS package_category, sp.price,
             u.full_name AS parent_name
      FROM student_subscriptions ss
      LEFT JOIN children c ON c.id = ss.child_id
      LEFT JOIN subscription_packages sp ON sp.id = ss.package_id
      LEFT JOIN users u ON u.id = c.parent_id
      ${where}
      ORDER BY ss.created_at DESC
    `, params);
    res.json(result.rows.map((r: any) => ({
      id: r.id, childId: r.child_id, packageId: r.package_id,
      childName: r.child_name, childGrade: r.child_grade, childAge: r.child_age,
      productName: r.product_name, packageCategory: r.package_category, price: r.price,
      parentName: r.parent_name, purchaseDate: r.purchase_date,
      expiryDate: r.expiry_date, status: r.status, createdAt: r.created_at,
    })));
  } catch (err: any) {
    console.error('[GET /admin/student-subscriptions]', err.message);
    res.json([]);
  }
});

// POST /api/admin/student-subscriptions — assign a package to a child
router.post('/student-subscriptions', async (req, res) => {
  try {
    const { childId, packageId } = req.body;
    if (!childId || !packageId) return res.status(400).json({ error: 'childId and packageId are required' });

    // Get package validity
    const pkgResult = await db.select({
      validityDays: subscriptionPackages.validityDays,
      productName: subscriptionPackages.productName,
    }).from(subscriptionPackages).where(eq(subscriptionPackages.id, packageId));
    if (!pkgResult.length) return res.status(404).json({ error: 'Package not found' });

    const pkg = pkgResult[0];
    const expiryDate = pkg.validityDays
      ? new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000)
      : null;

    const result = await db.insert(studentSubscriptions).values({
      childId, packageId, expiryDate, status: 'active',
    }).returning();

    res.status(201).json({
      id: result[0].id,
      status: 'active',
      message: `${pkg.productName} assigned successfully`,
    });
  } catch (err: any) {
    console.error('[POST /admin/student-subscriptions]', err.message);
    res.status(500).json({ error: 'Failed to assign package' });
  }
});

// PATCH /api/admin/student-subscriptions/:id — update subscription status
router.patch('/student-subscriptions/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const result = await db.update(studentSubscriptions)
      .set({ status })
      .where(eq(studentSubscriptions.id, req.params.id))
      .returning();

    if (!result.length) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ success: true, subscription: result[0] });
  } catch (err: any) {
    console.error('[PATCH /admin/student-subscriptions/:id]', err.message);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// GET /api/admin/jobs — list all HR job postings
router.get('/jobs', async (_req, res) => {
  try {
    const result = await query(`
      SELECT j.*, COUNT(a.id)::int AS application_count
      FROM hr_jobs j
      LEFT JOIN hr_applications a ON a.job_id = j.id
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `);
    const jobs = result.rows.map((r: any) => ({
      id: r.id, title: r.title, roleCategory: r.role_category,
      employmentType: r.employment_type, workMode: r.work_mode, city: r.city,
      location: r.location, salary: r.salary, benefits: r.benefits,
      posterImage: r.poster_image, description: r.description, eligibility: r.eligibility,
      qualifications: r.qualifications, responsibilities: r.responsibilities,
      kpis: r.kpis, compensationModel: r.compensation_model,
      postToLinkedIn: r.post_to_linkedin, postToIndeed: r.post_to_indeed,
      postToNaukri: r.post_to_naukri, postToFacebook: r.post_to_facebook,
      postToWhatsApp: r.post_to_whatsapp, postToInstagram: r.post_to_instagram,
      postToTwitter: r.post_to_twitter, postToCareers: r.post_to_careers,
      status: r.status, publishedAt: r.published_at, closedAt: r.closed_at,
      hrReviewAt: r.hr_review_at, legalReviewAt: r.legal_review_at,
      leadershipApprovalAt: r.leadership_approval_at, rejectReason: r.reject_reason,
      applicationCount: r.application_count, createdAt: r.created_at, updatedAt: r.updated_at,
    }));
    res.json(jobs);
  } catch (err: any) {
    console.error('[GET /admin/jobs]', err.message);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/admin/mentors/:id/kpis
router.get('/mentors/:id/kpis', async (req, res) => {
  try {
    const result = await db.select().from(mentorKpis)
      .where(eq(mentorKpis.mentorId, req.params.id))
      .orderBy(desc(mentorKpis.periodStart));
    res.json(result.map((r) => ({
      id: r.id, periodStart: r.periodStart, periodEnd: r.periodEnd,
      studentSatisfaction: parseFloat(r.studentSatisfaction ?? '0'),
      sessionCompletionRate: parseFloat(r.sessionCompletionRate ?? '0'),
      outcomeImprovement: parseFloat(r.outcomeImprovement ?? '0'),
      complianceAdherence: parseFloat(r.complianceAdherence ?? '0'),
      alertLevel: r.alertLevel,
    })));
  } catch (err: any) {
    console.error('[GET /admin/mentors/:id/kpis]', err.message);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// GET /api/admin/mentors/:id/tasks
router.get('/mentors/:id/tasks', async (req, res) => {
  try {
    const result = await db.select().from(mentorTasks)
      .where(eq(mentorTasks.mentorId, req.params.id))
      .orderBy(desc(mentorTasks.createdAt));
    res.json(result.map((r) => ({
      id: r.id, title: r.title, taskType: r.taskType, description: r.description,
      status: r.status, scheduledDate: r.scheduledDate, completedAt: r.completedAt,
    })));
  } catch (err: any) {
    console.error('[GET /admin/mentors/:id/tasks]', err.message);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/admin/mentors/:id/payouts
router.get('/mentors/:id/payouts', async (req, res) => {
  try {
    const result = await db.select().from(mentorPayouts)
      .where(eq(mentorPayouts.mentorId, req.params.id))
      .orderBy(desc(mentorPayouts.periodStart));
    res.json(result.map((r) => ({
      id: r.id, periodStart: r.periodStart, periodEnd: r.periodEnd,
      grossRevenue: parseFloat(r.grossRevenue ?? '0'),
      commissionRate: parseFloat(r.commissionRate ?? '0'),
      deductions: parseFloat(r.deductions ?? '0'),
      netPayout: parseFloat(r.netPayout ?? '0'),
      status: r.status, processedAt: r.processedAt,
    })));
  } catch (err: any) {
    console.error('[GET /admin/mentors/:id/payouts]', err.message);
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
});

// GET /api/admin/mentors/:id/violations
router.get('/mentors/:id/violations', async (req, res) => {
  try {
    const result = await db.select().from(mentorViolations)
      .where(eq(mentorViolations.mentorId, req.params.id))
      .orderBy(desc(mentorViolations.createdAt));
    res.json(result.map((r) => ({
      id: r.id, violationType: r.violationType, severity: r.severity,
      description: r.description, status: r.status, resolution: r.resolution,
      createdAt: r.createdAt, resolvedAt: r.resolvedAt,
    })));
  } catch (err: any) {
    console.error('[GET /admin/mentors/:id/violations]', err.message);
    res.status(500).json({ error: 'Failed to fetch violations' });
  }
});

// GET /api/admin/mentors/:id/bookings — uses mentor_profiles.id (profileId)
router.get('/mentors/:id/bookings', async (req, res) => {
  try {
    const result = await query(
      `SELECT mb.*,
              c.name AS child_name, c.grade,
              u.full_name AS parent_name, u.email AS parent_email
       FROM mentor_bookings mb
       LEFT JOIN children c ON c.id = mb.child_id
       LEFT JOIN users u ON u.id = mb.parent_id
       WHERE mb.mentor_id = (SELECT id FROM mentor_profiles WHERE user_id = $1 LIMIT 1)
       ORDER BY mb.slot_date DESC, mb.start_time DESC`,
      [req.params.id]
    );
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      slotDate: r.slot_date,
      startTime: r.start_time,
      endTime: r.end_time,
      mode: r.mode,
      status: r.status,
      notes: r.notes,
      sessionLink: r.session_link,
      childName: r.child_name,
      grade: r.grade,
      parentName: r.parent_name,
      parentEmail: r.parent_email,
      createdAt: r.created_at,
    })));
  } catch (err: any) {
    console.error('[GET /admin/mentors/:id/bookings]', err.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/admin/mentors/:id/reviews — uses mentor_profiles.id (profileId)
router.get('/mentors/:id/reviews', async (req, res) => {
  try {
    const result = await query(
      `SELECT mr.*,
              u.full_name AS reviewer_name, u.email AS reviewer_email
       FROM mentor_reviews mr
       LEFT JOIN users u ON u.id = mr.reviewer_id
       WHERE mr.mentor_id = (SELECT id FROM mentor_profiles WHERE user_id = $1 LIMIT 1)
       ORDER BY mr.created_at DESC`,
      [req.params.id]
    );
    const rows = result.rows;
    const avgRating = rows.length > 0
      ? rows.reduce((sum: number, r: any) => sum + parseInt(r.rating), 0) / rows.length
      : null;
    res.json({
      reviews: rows.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reviewerName: r.reviewer_name,
        reviewerEmail: r.reviewer_email,
        createdAt: r.created_at,
      })),
      averageRating: avgRating ? parseFloat(avgRating.toFixed(1)) : null,
      totalReviews: rows.length,
    });
  } catch (err: any) {
    console.error('[GET /admin/mentors/:id/reviews]', err.message);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /api/admin/mentors/:id/activate — set mentor status to active
router.post('/mentors/:id/activate', async (req, res) => {
  try {
    await query(
      `INSERT INTO mentor_profiles (user_id, status, activated_at, updated_at)
       VALUES ($1, 'active', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET status = 'active', activated_at = COALESCE(mentor_profiles.activated_at, NOW()), updated_at = NOW()`,
      [req.params.id]
    );
    await db.update(users).set({ role: 'mentor', updatedAt: new Date() }).where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[POST /admin/mentors/:id/activate]', err.message);
    res.status(500).json({ error: 'Failed to activate mentor' });
  }
});

// POST /api/admin/mentors/:id/reactivate
router.post('/mentors/:id/reactivate', async (req, res) => {
  try {
    const { notes } = req.body;
    await db.update(mentorProfiles)
      .set({ status: 'active', suspensionReason: null, warningReason: null, warningIssuedAt: null, updatedAt: new Date() })
      .where(eq(mentorProfiles.userId, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[POST /admin/mentors/:id/reactivate]', err.message);
    res.status(500).json({ error: 'Failed to reactivate mentor' });
  }
});

// POST /api/admin/mentors/:id/suspend
router.post('/mentors/:id/suspend', async (req, res) => {
  try {
    const { reason } = req.body;
    await db.update(mentorProfiles)
      .set({ status: 'suspended', suspensionReason: reason || '', updatedAt: new Date() })
      .where(eq(mentorProfiles.userId, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[POST /admin/mentors/:id/suspend]', err.message);
    res.status(500).json({ error: 'Failed to suspend mentor' });
  }
});

// POST /api/admin/mentors/:id/warn
router.post('/mentors/:id/warn', async (req, res) => {
  try {
    const { reason } = req.body;
    await db.update(mentorProfiles)
      .set({ status: 'warning', warningReason: reason || '', warningIssuedAt: new Date(), updatedAt: new Date() })
      .where(eq(mentorProfiles.userId, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[POST /admin/mentors/:id/warn]', err.message);
    res.status(500).json({ error: 'Failed to issue warning' });
  }
});

// POST /api/admin/mentors/:id/assign-task
router.post('/mentors/:id/assign-task', async (req, res) => {
  try {
    const { title, taskType = 'general', description, scheduledDate } = req.body;
    if (!title) return res.status(400).json({ error: 'Task title is required' });
    const result = await db.insert(mentorTasks).values({
      mentorId: req.params.id,
      title,
      taskType,
      description,
      scheduledDate: scheduledDate || null,
      assignedBy: (req as any).user?.userId,
    }).returning();
    res.status(201).json({ task: result[0] });
  } catch (err: any) {
    console.error('[POST /admin/mentors/:id/assign-task]', err.message);
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

// POST /api/admin/mentors/:id/report-violation
router.post('/mentors/:id/report-violation', async (req, res) => {
  try {
    const { violationType, severity = 'minor', description } = req.body;
    if (!violationType) return res.status(400).json({ error: 'Violation type is required' });
    const result = await db.insert(mentorViolations).values({
      mentorId: req.params.id,
      violationType,
      severity,
      description: description || '',
      reportedBy: (req as any).user?.userId,
    }).returning();
    res.status(201).json({ violation: result[0] });
  } catch (err: any) {
    console.error('[POST /admin/mentors/:id/report-violation]', err.message);
    res.status(500).json({ error: 'Failed to report violation' });
  }
});

// PATCH /api/admin/mentors/:id/phi — update Performance Health Index
router.patch('/mentors/:id/phi', async (req, res) => {
  try {
    const { phi } = req.body;
    if (typeof phi !== 'number') return res.status(400).json({ error: 'PHI must be a number' });
    await db.update(mentorProfiles)
      .set({ performanceHealthIndex: Math.min(100, Math.max(0, phi)), updatedAt: new Date() })
      .where(eq(mentorProfiles.userId, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[PATCH /admin/mentors/:id/phi]', err.message);
    res.status(500).json({ error: 'Failed to update PHI' });
  }
});

// ═══════════════════════════════════════════════════════
// MENTOR ONBOARDING PIPELINE
// ═══════════════════════════════════════════════════════

// GET /api/admin/mentors/:id/onboarding
router.get('/mentors/:id/onboarding', async (req, res) => {
  try {
    const { id } = req.params;
    const profileRes = await query(
      `SELECT mp.id, mp.onboarding_stage, mp.training_started_at, mp.training_completed_at,
              mp.assessment_completed_at, mp.temp_code, mp.temp_code_generated_at,
              mp.kyc_status, mp.kyc_submitted_at, mp.kyc_verified_at,
              mp.profiler_status, mp.profiler_completed_at, mp.activated_at,
              mp.delivery_link, mp.subjects, mp.psychological_areas, mp.specialization,
              mp.mode, mp.mentor_type, mp.agreement_status, mp.mentor_code,
              u.email AS mentor_email, COALESCE(mp.display_name, u.full_name) AS display_name
       FROM mentor_profiles mp
       JOIN users u ON u.id = mp.user_id
       WHERE u.id = $1`, [id]
    );
    if (profileRes.rows.length === 0) return res.status(404).json({ error: 'Mentor profile not found' });
    const profile = profileRes.rows[0];

    const kycRes = await db.select({
      id: mentorKycDocuments.id, documentType: mentorKycDocuments.documentType,
      documentName: mentorKycDocuments.documentName, fileUrl: mentorKycDocuments.fileUrl,
      status: mentorKycDocuments.status, verifiedAt: mentorKycDocuments.verifiedAt,
      notes: mentorKycDocuments.notes, createdAt: mentorKycDocuments.createdAt,
    }).from(mentorKycDocuments)
      .where(eq(mentorKycDocuments.mentorProfileId, profile.id))
      .orderBy(desc(mentorKycDocuments.createdAt));

    const notifRes = await db.select({
      id: mentorOnboardingNotifications.id, stage: mentorOnboardingNotifications.stage,
      eventType: mentorOnboardingNotifications.eventType, message: mentorOnboardingNotifications.message,
      sentTo: mentorOnboardingNotifications.sentTo, sentAt: mentorOnboardingNotifications.sentAt,
    }).from(mentorOnboardingNotifications)
      .where(eq(mentorOnboardingNotifications.mentorProfileId, profile.id))
      .orderBy(desc(mentorOnboardingNotifications.sentAt));

    const appRes = await db.select({
      id: hrApplications.id, fullName: hrApplications.fullName,
      status: hrApplications.status, membershipPaidAt: hrApplications.membershipPaidAt,
      processedAt: hrApplications.processedAt, createdAt: hrApplications.createdAt,
    }).from(hrApplications)
      .where(eq(hrApplications.userId, id))
      .orderBy(desc(hrApplications.createdAt))
      .limit(1);

    res.json({
      profile: {
        onboardingStage: profile.onboarding_stage || 'application',
        trainingStartedAt: profile.training_started_at,
        trainingCompletedAt: profile.training_completed_at,
        assessmentCompletedAt: profile.assessment_completed_at,
        tempCode: profile.temp_code,
        tempCodeGeneratedAt: profile.temp_code_generated_at,
        kycStatus: profile.kyc_status || 'pending',
        kycSubmittedAt: profile.kyc_submitted_at,
        kycVerifiedAt: profile.kyc_verified_at,
        profilerStatus: profile.profiler_status || 'pending',
        profilerCompletedAt: profile.profiler_completed_at,
        activatedAt: profile.activated_at,
        deliveryLink: profile.delivery_link,
        mentorCode: profile.mentor_code,
        agreementStatus: profile.agreement_status,
        subjects: profile.subjects,
        psychologicalAreas: profile.psychological_areas,
        specialization: profile.specialization,
        mode: profile.mode,
        mentorType: profile.mentor_type,
        email: profile.mentor_email,
        displayName: profile.display_name,
      },
      kycDocuments: kycRes,
      notifications: notifRes,
      application: appRes[0] || null,
    });
  } catch (err: any) {
    console.error('[GET /admin/mentors/:id/onboarding]', err.message);
    res.status(500).json({ error: 'Failed to fetch onboarding data' });
  }
});

// PATCH /api/admin/mentors/:id/onboarding/stage
router.patch('/mentors/:id/onboarding/stage', async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, deliveryLink } = req.body;

    const validStages = ['application', 'training', 'assessment', 'temp_code_generated', 'kyc_upload', 'profiler', 'activated'];
    if (!validStages.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });

    const profileRes = await db.select({
      id: mentorProfiles.id, userId: mentorProfiles.userId, tempCode: mentorProfiles.tempCode,
    }).from(mentorProfiles).where(eq(mentorProfiles.userId, id));
    if (profileRes.length === 0) return res.status(404).json({ error: 'Mentor profile not found' });
    const mp = profileRes[0];

    const now = new Date();
    const updates: string[] = [`onboarding_stage = $1`, `updated_at = NOW()`];
    const values: any[] = [stage];
    let paramIndex = 2;

    if (stage === 'training') {
      updates.push(`training_started_at = $${paramIndex++}`);
      values.push(now);
    } else if (stage === 'assessment') {
      updates.push(`training_completed_at = $${paramIndex++}`);
      values.push(now);
    } else if (stage === 'temp_code_generated') {
      const tempCode = `TMP-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      updates.push(`temp_code = $${paramIndex++}`, `temp_code_generated_at = $${paramIndex++}`);
      values.push(tempCode, now);
      updates.push(`assessment_completed_at = $${paramIndex++}`);
      values.push(now);
    } else if (stage === 'kyc_upload') {
      updates.push(`kyc_status = 'pending'`);
    } else if (stage === 'profiler') {
      updates.push(`kyc_status = 'verified'`, `kyc_verified_at = $${paramIndex++}`);
      values.push(now);
    } else if (stage === 'activated') {
      updates.push(`profiler_completed_at = $${paramIndex++}`, `profiler_status = 'completed'`);
      values.push(now);
      if (deliveryLink) {
        updates.push(`delivery_link = $${paramIndex++}`);
        values.push(deliveryLink);
      }
    }

    values.push(mp.id);
    await query(
      `UPDATE mentor_profiles SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const stageLabels: Record<string, string> = {
      application: 'Application received', training: 'Training programme initiated',
      assessment: 'Assessment commenced', temp_code_generated: 'Temporary mentor code issued',
      kyc_upload: 'KYC document upload requested', profiler: 'Detailed profiler stage commenced',
      activated: 'Mentor account activated',
    };

    const userRes = await db.select({ email: users.email }).from(users).where(eq(users.id, id));
    const email = userRes[0]?.email || '';

    await db.insert(mentorOnboardingNotifications).values({
      mentorProfileId: mp.id,
      stage,
      eventType: 'stage_advance',
      message: stageLabels[stage] || stage,
      sentTo: email,
    });

    const updatedProfile = await db.select({
      tempCode: mentorProfiles.tempCode, tempCodeGeneratedAt: mentorProfiles.tempCodeGeneratedAt,
      onboardingStage: mentorProfiles.onboardingStage, kycStatus: mentorProfiles.kycStatus,
      profilerStatus: mentorProfiles.profilerStatus, activatedAt: mentorProfiles.activatedAt,
    }).from(mentorProfiles).where(eq(mentorProfiles.id, mp.id));

    scenarioTrigger('mentor.stage_advanced', {
      recipientId: id,
      stage,
      displayName: email,
    }).catch(() => {});

    res.json({ success: true, stage, profile: updatedProfile[0] });
  } catch (err: any) {
    console.error('[PATCH /admin/mentors/:id/onboarding/stage]', err.message);
    res.status(500).json({ error: 'Failed to advance stage' });
  }
});

// POST /api/admin/mentors/:id/kyc-documents — record a KYC document
router.post('/mentors/:id/kyc-documents', async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType, documentName, fileUrl, notes } = req.body;
    const profileRes = await db.select({ id: mentorProfiles.id }).from(mentorProfiles).where(eq(mentorProfiles.userId, id));
    if (profileRes.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const mpId = profileRes[0].id;
    await db.update(mentorProfiles)
      .set({ kycSubmittedAt: new Date(), kycStatus: 'submitted', updatedAt: new Date() })
      .where(eq(mentorProfiles.id, mpId));
    const result = await db.insert(mentorKycDocuments).values({
      mentorProfileId: mpId,
      documentType,
      documentName,
      fileUrl: fileUrl || null,
      notes: notes || null,
    }).returning();
    res.json(rowToSnake(result[0]));
  } catch (err: any) {
    console.error('[POST /admin/mentors/:id/kyc-documents]', err.message);
    res.status(500).json({ error: 'Failed to add KYC document' });
  }
});

// PATCH /api/admin/mentors/:id/profiler — update profiler data
router.patch('/mentors/:id/profiler', async (req, res) => {
  try {
    const { id } = req.params;
    const { subjects, psychologicalAreas, specialization, mode, deliveryLink } = req.body;
    const profilerUpdate: Record<string, any> = { updatedAt: new Date(), profilerStatus: 'in_progress' };
    if (subjects !== undefined) profilerUpdate.subjects = subjects;
    if (psychologicalAreas !== undefined) profilerUpdate.psychologicalAreas = psychologicalAreas;
    if (specialization !== undefined) profilerUpdate.specialization = specialization;
    if (mode !== undefined) profilerUpdate.mode = mode;
    if (deliveryLink !== undefined) profilerUpdate.deliveryLink = deliveryLink;
    await db.update(mentorProfiles).set(profilerUpdate).where(eq(mentorProfiles.userId, id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[PATCH /admin/mentors/:id/profiler]', err.message);
    res.status(500).json({ error: 'Failed to update profiler' });
  }
});

// ═══════════════════════════════════════════════════════
// PARENTS
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// PARENT / STUDENT EXPORT
// ═══════════════════════════════════════════════════════

// GET /api/admin/parents/export?format=csv|xlsx|pdf
router.get('/parents/export', async (req, res) => {
  try {
    const format = String(req.query.format ?? 'csv').toLowerCase();
    const date = new Date().toISOString().slice(0, 10);

    // Fetch all parents with children and KYC
    const { rows: parents } = await query<Record<string, unknown>>(
      `SELECT
         u.platform_id, u.id, u.full_name, u.email, u.mobile,
         u.is_active, u.is_verified, u.created_at,
         COUNT(DISTINCT c.id)::int AS child_count,
         COALESCE(k.kyc_status, 'pending') AS kyc_status,
         k.relationship_type, k.id_type, k.id_number, k.full_legal_name,
         STRING_AGG(c.platform_id || ':' || c.name, ' | ' ORDER BY c.platform_id) AS children_summary
       FROM users u
       LEFT JOIN children c ON c.parent_id = u.id
       LEFT JOIN parent_kyc k ON k.parent_id = u.id
       WHERE u.role = 'parent'
       GROUP BY u.id, k.kyc_status, k.relationship_type, k.id_type, k.id_number, k.full_legal_name
       ORDER BY u.platform_id NULLS LAST, u.created_at`,
      []
    );

    const colHeaders = [
      'Parent ID', 'Full Name', 'Email', 'Mobile',
      'Status', 'Email Verified', 'KYC Status',
      'Relationship Type', 'ID Type', 'Gov ID Number', 'Legal Name',
      'Children Count', 'Children (ID:Name)', 'Registered',
    ];

    const rowData = parents.map((p) => [
      p.platform_id ?? '—',
      p.full_name ?? 'Unnamed',
      p.email ?? '—',
      p.mobile ?? '—',
      p.is_active ? 'Active' : 'Inactive',
      p.is_verified ? 'Yes' : 'No',
      String(p.kyc_status ?? 'pending'),
      String(p.relationship_type ?? '—'),
      String(p.id_type ?? '—'),
      String(p.id_number ?? '—'),
      String(p.full_legal_name ?? '—'),
      p.child_count ?? 0,
      String(p.children_summary ?? '—'),
      p.created_at ? new Date(p.created_at as string).toLocaleDateString('en-IN') : '—',
    ]);

    // ── CSV ──────────────────────────────────────────────
    if (format === 'csv') {
      const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        '\uFEFF' + colHeaders.map(escape).join(','),
        ...rowData.map(row => row.map(escape).join(',')),
      ].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="metryx-parents-${date}.csv"`);
      res.send(csv);
      return;
    }

    // ── Excel (XLSX) ──────────────────────────────────────
    if (format === 'xlsx') {
      const wsData = [colHeaders, ...rowData];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // Column widths
      ws['!cols'] = [14, 22, 30, 16, 10, 14, 12, 20, 16, 20, 24, 8, 40, 14].map(w => ({ wch: w }));
      // Header row bold styling
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Parent Registry');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="metryx-parents-${date}.xlsx"`);
      res.send(buf);
      return;
    }

    // ── PDF ───────────────────────────────────────────────
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (d: Buffer) => chunks.push(d));
      doc.on('end', () => {
        const pdf = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="metryx-parents-${date}.pdf"`);
        res.send(pdf);
      });

      // Header
      doc.fontSize(16).fillColor('#344E86').text('MetryxOne — Parent Registry', { align: 'center' });
      doc.fontSize(9).fillColor('#9AA4B2').text(`Exported ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${parents.length} records`, { align: 'center' });
      doc.moveDown(0.5);

      // Table headers
      const cols = [70, 110, 150, 80, 55, 75, 55, 80, 75] as const;
      const shortHeaders = ['Parent ID', 'Full Name', 'Email', 'Mobile', 'Status', 'KYC', 'Children', 'Registered', 'Legal Name'];
      let x = 36;
      doc.fontSize(7).fillColor('#344E86');
      shortHeaders.forEach((h, i) => {
        doc.text(h, x, doc.y, { width: cols[i], align: 'left' });
        x += cols[i];
      });
      doc.moveDown(0.3);
      doc.moveTo(36, doc.y).lineTo(36 + cols.reduce((a, b) => a + b, 0), doc.y).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      doc.moveDown(0.2);

      // Rows
      parents.forEach((p, idx) => {
        if (doc.y > 530) { doc.addPage(); doc.y = 36; }
        const rowX = 36;
        doc.fontSize(7).fillColor(idx % 2 === 0 ? '#2E3440' : '#5F6C80');
        const cells = [
          String(p.platform_id ?? '—'),
          String(p.full_name ?? 'Unnamed').substring(0, 18),
          String(p.email ?? '—').substring(0, 28),
          String(p.mobile ?? '—'),
          p.is_active ? 'Active' : 'Inactive',
          String(p.kyc_status ?? 'pending'),
          String(p.child_count ?? 0),
          p.created_at ? new Date(p.created_at as string).toLocaleDateString('en-IN') : '—',
          String(p.full_legal_name ?? '—').substring(0, 18),
        ];
        let cx = rowX;
        cells.forEach((cell, i) => {
          doc.text(cell, cx, doc.y, { width: cols[i], align: 'left', lineBreak: false });
          cx += cols[i];
        });
        doc.moveDown(0.5);
      });

      doc.end();
      return;
    }

    res.status(400).json({ error: 'Invalid format. Use csv, xlsx, or pdf.' });
  } catch (err: any) {
    console.error('[GET /admin/parents/export]', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/admin/parents/:id/export?format=csv|xlsx|pdf  — single parent full detail export
router.get('/parents/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const format = String(req.query.format ?? 'pdf').toLowerCase();
    const date = new Date().toISOString().slice(0, 10);

    // Fetch parent + children + KYC
    const { rows: pRows } = await query<Record<string, unknown>>(
      `SELECT u.*, COALESCE(k.kyc_status,'pending') AS kyc_status, k.relationship_type,
              k.id_type, k.id_number, k.full_legal_name AS kyc_legal_name,
              k.date_of_birth AS kyc_dob, k.verified_at, k.rejection_reason
       FROM users u
       LEFT JOIN parent_kyc k ON k.parent_id = u.id
       WHERE u.id = $1`, [id]
    );
    if (!pRows.length) { res.status(404).json({ error: 'Parent not found' }); return; }
    const p = pRows[0];

    const { rows: children } = await query<Record<string, unknown>>(
      `SELECT platform_id, name, age, grade, school, gender, date_of_birth,
              consent_given, consent_given_at, city, state, blood_group, language
       FROM children WHERE parent_id = $1 ORDER BY platform_id`, [id]
    );

    const fname = (String(p.full_name ?? 'parent').replace(/\s+/g, '-').toLowerCase());

    // ── CSV ──
    if (format === 'csv') {
      const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [
        '\uFEFF# Parent Detail Report — MetryxOne',
        `# Generated: ${new Date().toLocaleDateString('en-IN')}`,
        '',
        '## Parent Information',
        ['Field', 'Value'].map(escape).join(','),
        ['Parent ID', p.platform_id ?? '—'].map(escape).join(','),
        ['Full Name', p.full_name ?? '—'].map(escape).join(','),
        ['Email', p.email ?? '—'].map(escape).join(','),
        ['Mobile', p.mobile ?? '—'].map(escape).join(','),
        ['Status', p.is_active ? 'Active' : 'Inactive'].map(escape).join(','),
        ['KYC Status', p.kyc_status ?? 'pending'].map(escape).join(','),
        ['Relationship Type', p.relationship_type ?? '—'].map(escape).join(','),
        ['Gov ID Type', p.id_type ?? '—'].map(escape).join(','),
        ['Gov ID Number', p.id_number ?? '—'].map(escape).join(','),
        ['Legal Name (KYC)', p.kyc_legal_name ?? '—'].map(escape).join(','),
        ['Registered', p.created_at ? new Date(p.created_at as string).toLocaleDateString('en-IN') : '—'].map(escape).join(','),
        '',
        '## Children',
        ['Student ID', 'Name', 'Age', 'Grade', 'School', 'Gender', 'City', 'Consent Given'].map(escape).join(','),
        ...children.map(c => [
          c.platform_id ?? '—', c.name ?? '—', c.age ?? '—', c.grade ?? '—',
          c.school ?? '—', c.gender ?? '—', c.city ?? '—', c.consent_given ? 'Yes' : 'No',
        ].map(escape).join(',')),
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="metryx-parent-${fname}-${date}.csv"`);
      res.send(lines.join('\r\n'));
      return;
    }

    // ── Excel ──
    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      // Parent sheet
      const parentWsData = [
        ['Field', 'Value'],
        ['Parent ID', p.platform_id ?? '—'],
        ['Full Name', p.full_name ?? '—'],
        ['Email', p.email ?? '—'],
        ['Mobile', p.mobile ?? '—'],
        ['Account Status', p.is_active ? 'Active' : 'Inactive'],
        ['Email Verified', p.is_verified ? 'Yes' : 'No'],
        ['KYC Status', p.kyc_status ?? 'pending'],
        ['KYC Relationship', p.relationship_type ?? '—'],
        ['Gov ID Type', p.id_type ?? '—'],
        ['Gov ID Number', p.id_number ?? '—'],
        ['KYC Legal Name', p.kyc_legal_name ?? '—'],
        ['Registered', p.created_at ? new Date(p.created_at as string).toLocaleDateString('en-IN') : '—'],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(parentWsData);
      ws1['!cols'] = [{ wch: 22 }, { wch: 36 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Parent Profile');

      // Children sheet
      const childHeaders = ['Student ID', 'Name', 'Age', 'Grade', 'School', 'Gender', 'City', 'State', 'Blood Group', 'Consent'];
      const childRows = children.map(c => [
        c.platform_id ?? '—', c.name ?? '—', c.age ?? '—', c.grade ?? '—',
        c.school ?? '—', c.gender ?? '—', c.city ?? '—', c.state ?? '—',
        c.blood_group ?? '—', c.consent_given ? 'Yes' : 'No',
      ]);
      const ws2 = XLSX.utils.aoa_to_sheet([childHeaders, ...childRows]);
      ws2['!cols'] = [14, 18, 6, 8, 22, 10, 14, 14, 12, 10].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws2, 'Children');

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="metryx-parent-${fname}-${date}.xlsx"`);
      res.send(buf);
      return;
    }

    // ── PDF ──
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (d: Buffer) => chunks.push(d));
      doc.on('end', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="metryx-parent-${fname}-${date}.pdf"`);
        res.send(Buffer.concat(chunks));
      });

      const blue = '#344E86';
      const label = '#9AA4B2';
      const dark = '#2E3440';

      // Header
      doc.fontSize(18).fillColor(blue).text('MetryxOne', { align: 'center' });
      doc.fontSize(11).fillColor(label).text('Parent & Guardian Registry Report', { align: 'center' });
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#E2E8F0').lineWidth(1).stroke();
      doc.moveDown(0.5);

      // Parent info
      doc.fontSize(12).fillColor(blue).text('Parent Profile');
      doc.moveDown(0.3);

      const field = (label_: string, value: string) => {
        doc.fontSize(8).fillColor(label).text(label_, { continued: true });
        doc.fontSize(9).fillColor(dark).text('  ' + value);
      };

      field('PARENT ID', String(p.platform_id ?? '—'));
      field('FULL NAME', String(p.full_name ?? '—'));
      field('EMAIL', String(p.email ?? '—'));
      field('MOBILE', String(p.mobile ?? '—'));
      field('STATUS', p.is_active ? 'Active' : 'Inactive');
      field('EMAIL VERIFIED', p.is_verified ? 'Yes' : 'No');
      field('REGISTERED', p.created_at ? new Date(p.created_at as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      doc.moveDown(0.5);

      // KYC section
      doc.fontSize(12).fillColor(blue).text('KYC Verification');
      doc.moveDown(0.3);
      const kycColors: Record<string, string> = { verified: '#059669', pending: '#D97706', rejected: '#DC2626', submitted: '#2563EB' };
      const kycStatus = String(p.kyc_status ?? 'pending');
      doc.fontSize(9).fillColor(kycColors[kycStatus] ?? label).text(`Status: ${kycStatus.toUpperCase()}`);
      if (p.relationship_type) field('RELATIONSHIP', String(p.relationship_type));
      if (p.id_type) field('GOVERNMENT ID TYPE', String(p.id_type));
      if (p.id_number) field('GOVERNMENT ID NUMBER', String(p.id_number));
      if (p.kyc_legal_name) field('LEGAL NAME', String(p.kyc_legal_name));
      if (p.rejection_reason) field('REJECTION REASON', String(p.rejection_reason));

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      doc.moveDown(0.5);

      // Children
      doc.fontSize(12).fillColor(blue).text(`Registered Children (${children.length})`);
      doc.moveDown(0.3);

      if (children.length === 0) {
        doc.fontSize(9).fillColor(label).text('No children registered.');
      } else {
        children.forEach((c, i) => {
          if (doc.y > 700) doc.addPage();
          doc.fontSize(9).fillColor(dark).text(`${i + 1}. ${String(c.name ?? '—')}  ·  ${String(c.platform_id ?? '—')}`);
          const details = [c.grade ? `Grade ${c.grade}` : null, c.age ? `Age ${c.age}` : null, c.school ? String(c.school) : null, c.city ? String(c.city) : null].filter(Boolean).join('  ·  ');
          if (details) doc.fontSize(8).fillColor(label).text(details);
          doc.fontSize(8).fillColor(c.consent_given ? '#059669' : '#D97706').text(`Consent: ${c.consent_given ? 'Given' : 'Pending'}`);
          doc.moveDown(0.3);
        });
      }

      // Footer
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor(label).text(
          `MetryxOne Confidential — Generated ${new Date().toLocaleDateString('en-IN')} — Page ${i - range.start + 1} of ${range.count}`,
          40, 800, { align: 'center', width: 515 }
        );
      }

      doc.end();
      return;
    }

    res.status(400).json({ error: 'Invalid format. Use csv, xlsx, or pdf.' });
  } catch (err: any) {
    console.error('[GET /admin/parents/:id/export]', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/admin/parents — list all parents with child count + subscription
router.get('/parents', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.platform_id, u.full_name, u.email, u.mobile, u.is_active, u.is_verified, u.created_at,
              COUNT(DISTINCT c.id) AS child_count,
              ps.plan AS subscription_plan, ps.status AS subscription_status, ps.expires_at
       FROM users u
       LEFT JOIN children c ON c.parent_id = u.id
       LEFT JOIN parent_subscriptions ps ON ps.parent_id = u.id
       WHERE u.role = 'parent'
       GROUP BY u.id, u.platform_id, u.full_name, u.email, u.mobile, u.is_active, u.is_verified, u.created_at, ps.plan, ps.status, ps.expires_at
       ORDER BY u.platform_id NULLS LAST, u.created_at DESC`
    );
    res.json(result.rows.map((r: any) => ({
      id: r.id, platformId: r.platform_id, fullName: r.full_name, email: r.email, mobile: r.mobile,
      isActive: r.is_active, isVerified: r.is_verified, createdAt: r.created_at,
      childCount: parseInt(r.child_count) || 0,
      subscriptionPlan: r.subscription_plan, subscriptionStatus: r.subscription_status,
      subscriptionExpiresAt: r.expires_at,
    })));
  } catch (err: any) {
    console.error('[GET /admin/parents]', err.message);
    res.status(500).json({ error: 'Failed to fetch parents' });
  }
});

// GET /api/admin/parents/:id — full parent profile
router.get('/parents/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.*, ps.plan AS subscription_plan, ps.status AS subscription_status,
              ps.amount, ps.currency, ps.billing_cycle, ps.started_at AS sub_started_at,
              ps.expires_at AS sub_expires_at, ps.cancelled_at AS sub_cancelled_at,
              COUNT(DISTINCT c.id) AS child_count
       FROM users u
       LEFT JOIN parent_subscriptions ps ON ps.parent_id = u.id
       LEFT JOIN children c ON c.parent_id = u.id
       WHERE u.id = $1 AND u.role = 'parent'
       GROUP BY u.id, ps.plan, ps.status, ps.amount, ps.currency, ps.billing_cycle, ps.started_at, ps.expires_at, ps.cancelled_at`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Parent not found' });
    const r = rows[0];
    res.json({
      id: r.id, platformId: r.platform_id, fullName: r.full_name, email: r.email, mobile: r.mobile,
      isActive: r.is_active, isVerified: r.is_verified, createdAt: r.created_at,
      childCount: parseInt(r.child_count) || 0,
      subscriptionPlan: r.subscription_plan, subscriptionStatus: r.subscription_status,
      subscriptionAmount: r.amount, subscriptionCurrency: r.currency,
      subscriptionCycle: r.billing_cycle, subscriptionStartedAt: r.sub_started_at,
      subscriptionExpiresAt: r.sub_expires_at, subscriptionCancelledAt: r.sub_cancelled_at,
    });
  } catch (err: any) {
    console.error('[GET /admin/parents/:id]', err.message);
    res.status(500).json({ error: 'Failed to fetch parent' });
  }
});

// GET /api/admin/parents/:id/children
router.get('/parents/:id/children', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              COUNT(DISTINCT mb.id) AS total_bookings,
              COUNT(DISTINCT ls.id) AS lbi_sessions,
              COUNT(DISTINCT wc.id) AS wellness_checkins,
              COUNT(DISTINCT ss.id) AS subscription_count,
              (SELECT sp.product_name FROM student_subscriptions ss2
               LEFT JOIN subscription_packages sp ON sp.id = ss2.package_id
               WHERE ss2.child_id = c.id AND ss2.status = 'active'
               ORDER BY ss2.created_at DESC LIMIT 1) AS active_plan,
              (SELECT ss2.status FROM student_subscriptions ss2
               WHERE ss2.child_id = c.id
               ORDER BY ss2.created_at DESC LIMIT 1) AS latest_sub_status,
              (SELECT ss2.expiry_date FROM student_subscriptions ss2
               WHERE ss2.child_id = c.id
               ORDER BY ss2.created_at DESC LIMIT 1) AS sub_expiry_date,
              (SELECT mp.display_name FROM mentor_bookings mb2
               JOIN mentor_profiles mp ON mp.id = mb2.mentor_id
               WHERE mb2.child_id = c.id
               ORDER BY mb2.created_at DESC LIMIT 1) AS last_mentor_name
       FROM children c
       LEFT JOIN mentor_bookings mb ON mb.child_id = c.id
       LEFT JOIN lbi_sessions ls ON ls.child_id = c.id
       LEFT JOIN wellness_checkins wc ON wc.child_id = c.id
       LEFT JOIN student_subscriptions ss ON ss.child_id = c.id
       WHERE c.parent_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    res.json(rows.map((r: any) => ({
      id: r.id, platformId: r.platform_id, name: r.name, age: r.age, grade: r.grade, gender: r.gender,
      dateOfBirth: r.date_of_birth, school: r.school, board: r.board,
      city: r.city, state: r.state, language: r.language,
      favoriteSubjects: r.favorite_subjects || [],
      weakSubjects: r.weak_subjects || [],
      learningStyle: r.learning_style, careerInterest: r.career_interest,
      consentGiven: r.consent_given, consentGivenAt: r.consent_given_at,
      createdAt: r.created_at,
      totalBookings: parseInt(r.total_bookings) || 0,
      lbiSessions: parseInt(r.lbi_sessions) || 0,
      wellnessCheckins: parseInt(r.wellness_checkins) || 0,
      subscriptionCount: parseInt(r.subscription_count) || 0,
      activePlan: r.active_plan || null,
      latestSubStatus: r.latest_sub_status || null,
      subExpiryDate: r.sub_expiry_date || null,
      lastMentorName: r.last_mentor_name || null,
    })));
  } catch (err: any) {
    console.error('[GET /admin/parents/:id/children]', err.message);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

// GET /api/admin/parents/:id/briefings
router.get('/parents/:id/briefings', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pb.*, c.name AS child_name
       FROM parent_briefings pb
       LEFT JOIN children c ON c.id = pb.child_id
       WHERE pb.parent_id = $1
       ORDER BY pb.generated_at DESC
       LIMIT 20`,
      [req.params.id]
    );
    res.json(rows.map((r: any) => ({
      id: r.id, weekOf: r.week_of, childName: r.child_name,
      highlights: r.highlights, actionItems: r.action_items,
      wellnessSummary: r.wellness_summary, generatedAt: r.generated_at,
    })));
  } catch (err: any) {
    console.error('[GET /admin/parents/:id/briefings]', err.message);
    res.status(500).json({ error: 'Failed to fetch briefings' });
  }
});

// GET /api/admin/parents/:id/subscription — per-child subscriptions for a parent
router.get('/parents/:id/subscription', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ss.id, ss.status, ss.start_date, ss.expiry_date, ss.purchase_date, ss.notes,
              ss.assigned_by, ss.created_at,
              sp.id AS package_id, sp.product_name AS plan_name, sp.description AS plan_description,
              sp.price, sp.validity_days, sp.subscription_type,
              c.id AS child_id, c.name AS child_name, c.grade, c.school, c.gender
       FROM student_subscriptions ss
       JOIN children c ON c.id = ss.child_id
       LEFT JOIN subscription_packages sp ON sp.id = ss.package_id
       WHERE c.parent_id = $1
       ORDER BY ss.created_at DESC`,
      [req.params.id]
    );
    res.json(rows.map((r: any) => ({
      id: r.id,
      status: r.status,
      startDate: r.start_date,
      expiryDate: r.expiry_date,
      purchaseDate: r.purchase_date,
      notes: r.notes,
      assignedBy: r.assigned_by,
      createdAt: r.created_at,
      childId: r.child_id,
      childName: r.child_name,
      childGrade: r.grade,
      childSchool: r.school,
      childGender: r.gender,
      packageId: r.package_id,
      planName: r.plan_name,
      planDescription: r.plan_description,
      price: r.price ? Number(r.price) : null,
      currency: 'INR',
      billingCycle: null,
      subscriptionType: r.subscription_type,
      maxSessions: null,
      validityDays: r.validity_days,
    })));
  } catch (err: any) {
    console.error('[GET /admin/parents/:id/subscription]', err.message);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// GET /api/admin/parents/:id/bookings — all mentor bookings across all children of a parent
router.get('/parents/:id/bookings', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT mb.id, mb.slot_date, mb.start_time, mb.end_time, mb.mode, mb.status,
              mb.notes, mb.session_link, mb.created_at,
              c.name AS child_name, c.platform_id AS child_platform_id,
              u.full_name AS mentor_name, mp.specialization, mp.display_name AS mentor_display_name
       FROM mentor_bookings mb
       JOIN children c ON c.id = mb.child_id
       LEFT JOIN mentor_profiles mp ON mp.id = mb.mentor_id
       LEFT JOIN users u ON u.id = mp.user_id
       WHERE c.parent_id = $1
       ORDER BY mb.slot_date DESC, mb.start_time DESC`,
      [req.params.id]
    );
    res.json(rows.map((r: any) => ({
      id: r.id,
      slotDate: r.slot_date,
      startTime: r.start_time,
      endTime: r.end_time,
      mode: r.mode,
      status: r.status,
      notes: r.notes,
      sessionLink: r.session_link,
      childName: r.child_name,
      childPlatformId: r.child_platform_id,
      mentorName: r.mentor_display_name || r.mentor_name || 'Unknown Mentor',
      specialization: r.specialization,
      createdAt: r.created_at,
    })));
  } catch (err: any) {
    console.error('[GET /admin/parents/:id/bookings]', err.message);
    res.status(500).json({ error: 'Failed to fetch parent bookings' });
  }
});

// GET /api/admin/parents/:id/activity — account activity summary for a parent
router.get('/parents/:id/activity', async (req, res) => {
  try {
    const parentId = req.params.id;

    const [userRow, childrenRow, bookingsRow, notifRow, consentRow] = await Promise.all([
      query(
        `SELECT u.created_at, u.updated_at, u.is_active, u.is_verified,
                COUNT(DISTINCT c.id) AS child_count
         FROM users u
         LEFT JOIN children c ON c.parent_id = u.id
         WHERE u.id = $1
         GROUP BY u.id`,
        [parentId]
      ),
      query(
        `SELECT c.id, c.name, c.grade, c.consent_given, c.consent_given_at, c.created_at,
                COUNT(DISTINCT mb.id) AS booking_count,
                COUNT(DISTINCT ss.id) AS subscription_count,
                COUNT(DISTINCT wc.id) AS wellness_checkins,
                COUNT(DISTINCT ls.id) AS lbi_sessions
         FROM children c
         LEFT JOIN mentor_bookings mb ON mb.child_id = c.id
         LEFT JOIN student_subscriptions ss ON ss.child_id = c.id
         LEFT JOIN wellness_checkins wc ON wc.child_id = c.id
         LEFT JOIN lbi_sessions ls ON ls.child_id = c.id
         WHERE c.parent_id = $1
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
        [parentId]
      ),
      query(
        `SELECT mb.id, mb.status, mb.slot_date AS booking_date, mb.start_time,
                c.name AS child_name, mp.display_name AS mentor_name
         FROM mentor_bookings mb
         JOIN children c ON c.id = mb.child_id
         LEFT JOIN mentor_profiles mp ON mp.id = mb.mentor_id
         WHERE c.parent_id = $1
         ORDER BY mb.created_at DESC
         LIMIT 10`,
        [parentId]
      ),
      query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE is_read = TRUE) AS read_count,
                MAX(created_at) AS last_notification_at
         FROM notifications
         WHERE recipient_id = $1`,
        [parentId]
      ),
      query(
        `SELECT c.id AS child_id, c.name AS child_name, c.consent_given, c.consent_given_at
         FROM children c
         WHERE c.parent_id = $1
         ORDER BY c.created_at DESC`,
        [parentId]
      ),
    ]);

    const user = userRow.rows[0] as any;
    const notif = notifRow.rows[0] as any;

    res.json({
      account: {
        joinedAt: user?.created_at,
        lastUpdated: user?.updated_at,
        isActive: user?.is_active,
        isVerified: user?.is_verified,
        childCount: parseInt(user?.child_count || '0'),
      },
      children: childrenRow.rows.map((r: any) => ({
        id: r.id, name: r.name, grade: r.grade,
        consentGiven: r.consent_given, consentGivenAt: r.consent_given_at,
        registeredAt: r.created_at,
        bookingCount: parseInt(r.booking_count) || 0,
        subscriptionCount: parseInt(r.subscription_count) || 0,
        wellnessCheckins: parseInt(r.wellness_checkins) || 0,
        lbiSessions: parseInt(r.lbi_sessions) || 0,
      })),
      recentBookings: bookingsRow.rows.map((r: any) => ({
        id: r.id, status: r.status, bookingDate: r.booking_date, startTime: r.start_time,
        childName: r.child_name, mentorName: r.mentor_name,
      })),
      notifications: {
        total: parseInt(notif?.total || '0'),
        readCount: parseInt(notif?.read_count || '0'),
        lastNotificationAt: notif?.last_notification_at,
      },
      consent: consentRow.rows.map((r: any) => ({
        childId: r.child_id, childName: r.child_name,
        consentGiven: r.consent_given, consentGivenAt: r.consent_given_at,
      })),
    });
  } catch (err: any) {
    console.error('[GET /admin/parents/:id/activity]', err.message);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ═══════════════════════════════════════════════════════
// PARENT KYC
// ═══════════════════════════════════════════════════════

// GET /api/admin/parents/:id/kyc
router.get('/parents/:id/kyc', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `SELECT k.*,
              v.full_name AS verified_by_name
       FROM parent_kyc k
       LEFT JOIN users v ON v.id = k.verified_by
       WHERE k.parent_id = $1`,
      [id]
    );
    if (!rows.length) {
      res.json({ kyc: null, status: 'pending' });
      return;
    }
    const k = rows[0] as Record<string, unknown>;
    res.json({
      kyc: {
        id: k.id,
        parentId: k.parent_id,
        relationshipType: k.relationship_type,
        idType: k.id_type,
        idNumber: k.id_number,
        fullLegalName: k.full_legal_name,
        dateOfBirth: k.date_of_birth,
        kycStatus: k.kyc_status,
        submittedAt: k.submitted_at,
        verifiedAt: k.verified_at,
        verifiedByName: k.verified_by_name,
        rejectionReason: k.rejection_reason,
        adminNotes: k.admin_notes,
        createdAt: k.created_at,
        updatedAt: k.updated_at,
      },
      status: k.kyc_status,
    });
  } catch (err: any) {
    console.error('[GET /admin/parents/:id/kyc]', err.message);
    res.status(500).json({ error: 'Failed to fetch KYC' });
  }
});

// PATCH /api/admin/parents/:id/kyc — admin reviews KYC (verify / reject / add notes)
router.patch('/parents/:id/kyc', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.userId;
    const { action, rejectionReason, adminNotes } = req.body as {
      action: 'verify' | 'reject' | 'note';
      rejectionReason?: string;
      adminNotes?: string;
    };

    const existingRows = await db.select({ id: parentKyc.id, kycStatus: parentKyc.kycStatus }).from(parentKyc).where(eq(parentKyc.parentId, id));
    if (!existingRows.length) {
      res.status(404).json({ error: 'No KYC submission found for this parent' });
      return;
    }

    let newStatus = existingRows[0].kycStatus as string;
    if (action === 'verify') newStatus = 'verified';
    if (action === 'reject') newStatus = 'rejected';

    const { rows } = await query(
      `UPDATE parent_kyc SET
        kyc_status       = $1,
        rejection_reason = COALESCE($2, rejection_reason),
        admin_notes      = COALESCE($3, admin_notes),
        verified_by      = CASE WHEN $4 = 'verify' THEN $5 ELSE verified_by END,
        verified_at      = CASE WHEN $4 = 'verify' THEN NOW() ELSE verified_at END,
        updated_at       = NOW()
       WHERE parent_id = $6
       RETURNING *`,
      [newStatus, rejectionReason ?? null, adminNotes ?? null, action, adminId ?? null, id]
    );

    // Fire notification to parent
    const parentRow = await db.select({ full_name: users.fullName, email: users.email }).from(users).where(eq(users.id, id));
    const parent = parentRow[0] as Record<string, string> | undefined;
    const name = parent?.full_name ?? 'there';
    setImmediate(async () => {
      try {
        if (action === 'verify') {
          await (await import('../notifications/service.js')).fire(61, { name }, { recipientId: id });
        } else if (action === 'reject') {
          await (await import('../notifications/service.js')).fire(62, { name, reason: rejectionReason ?? 'Documents could not be verified' }, { recipientId: id });
        }
      } catch (e) {
        console.warn('[KYC] Notification failed (non-fatal):', e);
      }
    });

    const k = rows[0] as Record<string, unknown>;
    res.json({
      success: true,
      kyc: {
        id: k.id,
        kycStatus: k.kyc_status,
        rejectionReason: k.rejection_reason,
        adminNotes: k.admin_notes,
        verifiedAt: k.verified_at,
        updatedAt: k.updated_at,
      },
    });
  } catch (err: any) {
    console.error('[PATCH /admin/parents/:id/kyc]', err.message);
    res.status(500).json({ error: 'Failed to update KYC' });
  }
});

// ═══════════════════════════════════════════════════════
// STUDENTS (CHILDREN)
// ═══════════════════════════════════════════════════════

// GET /api/admin/students/export?format=csv|xlsx|pdf — Adult Learner Registry export
router.get('/students/export', async (req, res) => {
  const fmt = (req.query.format as string || 'csv').toLowerCase();
  try {
    const { rows } = await query(
      `SELECT c.platform_id, c.name, c.gender,
              CASE WHEN c.date_of_birth IS NOT NULL THEN DATE_PART('year', AGE(c.date_of_birth::date))::int ELSE c.age END AS effective_age,
              c.city, c.state, c.language, c.school, c.board, c.grade,
              c.learning_style, c.career_interest, c.consent_given, c.created_at,
              u.full_name AS parent_name, u.email AS parent_email, u.mobile AS parent_mobile,
              COUNT(DISTINCT mb.id) AS bookings,
              COUNT(DISTINCT wc.id) AS wellness,
              COUNT(DISTINCT ls.id) AS lbi_sessions
       FROM children c
       LEFT JOIN users u ON u.id = c.parent_id
       LEFT JOIN mentor_bookings mb ON mb.child_id = c.id
       LEFT JOIN wellness_checkins wc ON wc.child_id = c.id
       LEFT JOIN lbi_sessions ls ON ls.child_id = c.id
       WHERE (c.age IS NULL AND c.date_of_birth IS NULL)
          OR (c.age >= 18)
          OR (c.date_of_birth IS NOT NULL AND DATE_PART('year', AGE(c.date_of_birth::date)) >= 18)
       GROUP BY c.id, u.full_name, u.email, u.mobile
       ORDER BY c.platform_id NULLS LAST`
    );
    const headers = ['Platform ID','Name','Gender','Age','City','State','Language','Institution','Board','Grade','Learning Style','Career Interest','Consent','Bookings','Wellness','LBI Sessions','Registered Guardian','Guardian Email','Guardian Mobile','Registered On'];
    const toRow = (r: any) => [
      r.platform_id || '—', r.name, r.gender || '—', r.effective_age ?? '—',
      r.city || '—', r.state || '—', r.language || '—', r.school || '—',
      r.board || '—', r.grade || '—', r.learning_style || '—', r.career_interest || '—',
      r.consent_given ? 'Yes' : 'No', r.bookings || 0, r.wellness || 0, r.lbi_sessions || 0,
      r.parent_name || '—', r.parent_email || '—', r.parent_mobile || '—',
      r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—',
    ];

    if (fmt === 'csv') {
      const csv = [headers, ...rows.map(toRow)].map(row => row.map((v: any) => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="adult-learner-registry.csv"');
      return res.send('\uFEFF' + csv);
    }

    if (fmt === 'xlsx') {
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map(toRow)]);
      const colWidths = headers.map((h, i) => ({ wch: Math.max(h.length, ...rows.map((r: any) => String(toRow(r)[i] ?? '').length)) + 2 }));
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, 'Adult Learners');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="adult-learner-registry.xlsx"');
      return res.send(buf);
    }

    if (fmt === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="adult-learner-registry.pdf"');
      doc.pipe(res);
      doc.fontSize(16).fillColor('#344E86').text('MetryxOne — Adult Learner Registry', { align: 'center' });
      doc.fontSize(9).fillColor('#9AA4B2').text(`Generated ${new Date().toLocaleDateString('en-IN')} · ${rows.length} learners`, { align: 'center' });
      doc.moveDown(1);
      const cols = ['Platform ID','Name','Age','Gender','City','Career Interest','Consent','Bookings','LBI'];
      const colW = [72, 90, 30, 50, 60, 90, 40, 42, 30];
      let x = 40, y = doc.y;
      doc.fontSize(7).fillColor('#344E86');
      cols.forEach((c, i) => { doc.text(c, x, y, { width: colW[i], ellipsis: true }); x += colW[i]; });
      doc.moveTo(40, y + 12).lineTo(780, y + 12).strokeColor('#E2E8F0').stroke();
      y += 16;
      rows.forEach((r: any, ri: number) => {
        if (y > 530) { doc.addPage(); y = 40; }
        x = 40;
        doc.fillColor(ri % 2 === 0 ? '#F5F7FA' : '#FFFFFF').rect(40, y - 2, 740, 14).fill();
        doc.fillColor('#2E3440');
        const vals = [r.platform_id||'—', r.name, String(r.effective_age??'—'), r.gender||'—', r.city||'—', r.career_interest||'—', r.consent_given?'Yes':'No', String(r.bookings||0), String(r.lbi_sessions||0)];
        vals.forEach((v, i) => { doc.text(v, x, y, { width: colW[i], ellipsis: true }); x += colW[i]; });
        y += 14;
      });
      doc.end();
      return;
    }

    res.status(400).json({ error: 'Unsupported format' });
  } catch (err: any) {
    console.error('[GET /admin/students/export]', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/admin/students/:id/export?format=csv|xlsx|pdf — single learner export
router.get('/students/:id/export', async (req, res) => {
  const fmt = (req.query.format as string || 'pdf').toLowerCase();
  try {
    const { rows: cr } = await query(
      `SELECT c.*, u.full_name AS parent_name, u.email AS parent_email, u.mobile AS parent_mobile
       FROM children c LEFT JOIN users u ON u.id = c.parent_id WHERE c.id = $1`,
      [req.params.id]
    );
    if (!cr.length) return res.status(404).json({ error: 'Not found' });
    const c = cr[0];

    const { rows: bookings } = await query(
      `SELECT mb.slot_date, mb.start_time, mb.end_time, mb.mode, mb.status, u.full_name AS mentor_name
       FROM mentor_bookings mb
       LEFT JOIN mentor_profiles mp ON mp.id = mb.mentor_id
       LEFT JOIN users u ON u.id = mp.user_id
       WHERE mb.child_id = $1 ORDER BY mb.slot_date DESC`, [req.params.id]
    );
    const { rows: lbi } = await query(
      `SELECT ls.status, ls.raw_score, ls.max_score, ls.percentile_score, ls.completed_at, lm.module_name
       FROM lbi_sessions ls LEFT JOIN lbi_modules lm ON lm.id = ls.module_id
       WHERE ls.child_id = $1 ORDER BY ls.started_at DESC`, [req.params.id]
    );
    const { rows: subs } = await query(
      `SELECT ss.status, ss.purchase_date, ss.expiry_date, sp.product_name
       FROM student_subscriptions ss LEFT JOIN subscription_packages sp ON sp.id = ss.package_id
       WHERE ss.child_id = $1 ORDER BY ss.created_at DESC`, [req.params.id]
    );

    const profileRows = [
      ['Platform ID', c.platform_id || '—'], ['Full Name', c.name], ['Gender', c.gender || '—'],
      ['Date of Birth', c.date_of_birth ? new Date(c.date_of_birth).toLocaleDateString('en-IN') : '—'],
      ['Age', c.age ? `${c.age} yrs` : '—'], ['Blood Group', c.blood_group || '—'],
      ['Language', c.language || '—'], ['City', c.city || '—'], ['State', c.state || '—'],
      ['School/Institution', c.school || '—'], ['Board', c.board || '—'], ['Grade/Year', c.grade || '—'],
      ['Learning Style', c.learning_style || '—'], ['Career Interest', c.career_interest || '—'],
      ['Consent Given', c.consent_given ? 'Yes' : 'No'],
      ['Registered Guardian', c.parent_name || '—'], ['Guardian Email', c.parent_email || '—'],
      ['Registered On', c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'],
    ];

    if (fmt === 'csv') {
      const lines = ['=== ADULT LEARNER PROFILE ===', ...profileRows.map(([k,v]) => `"${k}","${v}"`),
        '', '=== BOOKINGS ===', '"Date","Mentor","Mode","Status"',
        ...bookings.map((b: any) => `"${b.slot_date}","${b.mentor_name||'—'}","${b.mode||'—'}","${b.status||'—'}"`),
        '', '=== LBI SESSIONS ===', '"Module","Score","Percentile","Status"',
        ...lbi.map((l: any) => `"${l.module_name||'—'}","${l.raw_score??'—'}/${l.max_score??'—'}","${l.percentile_score??'—'}","${l.status||'—'}"`),
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="learner-${c.platform_id||c.id}.csv"`);
      return res.send('\uFEFF' + lines.join('\n'));
    }

    if (fmt === 'xlsx') {
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet([['Field','Value'], ...profileRows]);
      ws1['!cols'] = [{ wch: 22 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Profile');
      if (bookings.length) {
        const ws2 = XLSX.utils.aoa_to_sheet([['Date','Mentor','Time','Mode','Status'],
          ...bookings.map((b: any) => [b.slot_date, b.mentor_name||'—', `${b.start_time||''}–${b.end_time||''}`, b.mode||'—', b.status||'—'])]);
        ws2['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Bookings');
      }
      if (lbi.length) {
        const ws3 = XLSX.utils.aoa_to_sheet([['Module','Score','Max Score','Percentile','Status','Completed'],
          ...lbi.map((l: any) => [l.module_name||'—', l.raw_score??'—', l.max_score??'—', l.percentile_score??'—', l.status||'—', l.completed_at ? new Date(l.completed_at).toLocaleDateString('en-IN') : '—'])]);
        ws3['!cols'] = [{ wch: 24 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws3, 'LBI Sessions');
      }
      if (subs.length) {
        const ws4 = XLSX.utils.aoa_to_sheet([['Package','Status','Purchased','Expires'],
          ...subs.map((s: any) => [s.product_name||'—', s.status||'—', s.purchase_date ? new Date(s.purchase_date).toLocaleDateString('en-IN') : '—', s.expiry_date ? new Date(s.expiry_date).toLocaleDateString('en-IN') : '—'])]);
        ws4['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws4, 'Subscriptions');
      }
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="learner-${c.platform_id||c.id}.xlsx"`);
      return res.send(buf);
    }

    if (fmt === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="learner-${c.platform_id||c.id}.pdf"`);
      doc.pipe(res);
      doc.fontSize(18).fillColor('#344E86').text('MetryxOne — Adult Learner Profile', { align: 'center' });
      doc.fontSize(11).fillColor('#4ECDC4').text(c.platform_id || c.name, { align: 'center' });
      doc.fontSize(9).fillColor('#9AA4B2').text(`Generated ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
      doc.moveDown(1.5);
      doc.fontSize(11).fillColor('#344E86').text('Personal & Academic Information');
      doc.moveTo(50, doc.y + 4).lineTo(550, doc.y + 4).strokeColor('#E2E8F0').stroke();
      doc.moveDown(0.8);
      profileRows.forEach(([k, v]) => {
        doc.fontSize(8).fillColor('#9AA4B2').text(k, { continued: true }).fillColor('#2E3440').text(`  ${v}`);
      });
      if (bookings.length) {
        doc.moveDown(1).fontSize(11).fillColor('#344E86').text('Mentor Bookings');
        doc.moveTo(50, doc.y + 4).lineTo(550, doc.y + 4).strokeColor('#E2E8F0').stroke();
        doc.moveDown(0.8);
        bookings.forEach((b: any) => {
          doc.fontSize(8).fillColor('#2E3440').text(`${b.slot_date} · ${b.mentor_name||'—'} · ${b.mode||'—'} · ${b.status||'—'}`);
        });
      }
      if (lbi.length) {
        doc.moveDown(1).fontSize(11).fillColor('#344E86').text('LBI Assessment Sessions');
        doc.moveTo(50, doc.y + 4).lineTo(550, doc.y + 4).strokeColor('#E2E8F0').stroke();
        doc.moveDown(0.8);
        lbi.forEach((l: any) => {
          doc.fontSize(8).fillColor('#2E3440').text(`${l.module_name||'Module'} · Score ${l.raw_score??'—'}/${l.max_score??'—'} · Percentile ${l.percentile_score??'—'} · ${l.status||'—'}`);
        });
      }
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor('#9AA4B2').text(`Page ${i + 1} of ${range.count}`, 50, 810, { align: 'center', width: 500 });
      }
      doc.end();
      return;
    }

    res.status(400).json({ error: 'Unsupported format' });
  } catch (err: any) {
    console.error('[GET /admin/students/:id/export]', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/admin/students/class-roster — ALL children grouped by school + grade with parent info
router.get('/students/class-roster', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         c.id, c.platform_id, c.name, c.grade, c.school AS school_name,
         c.board, c.gender, c.age, c.date_of_birth, c.city, c.state,
         c.consent_given, c.consent_given_at, c.created_at,
         c.career_interest, c.learning_style, c.language,
         -- parent info
         u.id AS parent_id, u.platform_id AS parent_platform_id,
         u.full_name AS parent_name, u.email AS parent_email,
         u.mobile AS parent_mobile, u.city AS parent_city,
         -- services / activity
         COUNT(DISTINCT mb.id)::int AS total_bookings,
         COUNT(DISTINCT wc.id)::int AS wellness_checkins,
         COUNT(DISTINCT ls.id)::int AS lbi_sessions,
         -- active subscription
         (SELECT sp.product_name
          FROM student_subscriptions ss2
          JOIN subscription_packages sp ON sp.id = ss2.package_id
          WHERE ss2.child_id = c.id AND ss2.status = 'active'
          ORDER BY ss2.created_at DESC LIMIT 1) AS active_plan,
         (SELECT ss2.status
          FROM student_subscriptions ss2
          WHERE ss2.child_id = c.id
          ORDER BY ss2.created_at DESC LIMIT 1) AS subscription_status,
         (SELECT ss2.expiry_date
          FROM student_subscriptions ss2
          WHERE ss2.child_id = c.id
          ORDER BY ss2.created_at DESC LIMIT 1) AS subscription_expiry,
         -- effective age
         CASE
           WHEN c.date_of_birth IS NOT NULL
             THEN DATE_PART('year', AGE(c.date_of_birth::date))::int
           ELSE c.age
         END AS effective_age
       FROM children c
       LEFT JOIN users u ON u.id = c.parent_id
       LEFT JOIN mentor_bookings mb ON mb.child_id = c.id
       LEFT JOIN wellness_checkins wc ON wc.child_id = c.id
       LEFT JOIN lbi_sessions ls ON ls.child_id = c.id
       GROUP BY c.id, u.id, u.platform_id, u.full_name, u.email, u.mobile, u.city
       ORDER BY
         COALESCE(c.school, 'ZZZ'),
         COALESCE(c.grade, 'ZZZ'),
         c.name`
    );

    const students = rows.map((r: any) => ({
      id: r.id,
      platformId: r.platform_id,
      name: r.name,
      grade: r.grade,
      schoolName: r.school_name,
      board: r.board,
      gender: r.gender,
      age: r.effective_age ?? r.age,
      city: r.city,
      state: r.state,
      consentGiven: r.consent_given,
      consentGivenAt: r.consent_given_at,
      createdAt: r.created_at,
      careerInterest: r.career_interest,
      learningStyle: r.learning_style,
      language: r.language,
      parentId: r.parent_id,
      parentPlatformId: r.parent_platform_id,
      parentName: r.parent_name,
      parentEmail: r.parent_email,
      parentMobile: r.parent_mobile,
      parentCity: r.parent_city,
      totalBookings: r.total_bookings || 0,
      wellnessCheckins: r.wellness_checkins || 0,
      lbiSessions: r.lbi_sessions || 0,
      activePlan: r.active_plan || null,
      subscriptionStatus: r.subscription_status || null,
      subscriptionExpiry: r.subscription_expiry || null,
    }));

    res.json(students);
  } catch (err: any) {
    console.error('[GET /admin/students/class-roster]', err.message);
    res.status(500).json({ error: 'Failed to fetch class roster' });
  }
});

// GET /api/admin/students/class-roster/export — export class roster as CSV/XLSX/PDF
router.get('/students/class-roster/export', async (req, res) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const school = req.query.school as string | undefined;
    const grade  = req.query.grade  as string | undefined;

    let whereClause = '';
    const params: any[] = [];
    const conditions: string[] = [];
    if (school) { params.push(school); conditions.push(`c.school = $${params.length}`); }
    if (grade)  { params.push(grade);  conditions.push(`c.grade  = $${params.length}`); }
    if (conditions.length) whereClause = 'WHERE ' + conditions.join(' AND ');

    const { rows } = await query(
      `SELECT c.platform_id, c.name, c.grade, c.school, c.board, c.gender, c.age,
              c.city, c.state, c.consent_given, c.created_at, c.career_interest,
              u.full_name AS parent_name, u.email AS parent_email, u.mobile AS parent_mobile,
              (SELECT sp.product_name FROM student_subscriptions ss2
               JOIN subscription_packages sp ON sp.id = ss2.package_id
               WHERE ss2.child_id = c.id AND ss2.status = 'active'
               ORDER BY ss2.created_at DESC LIMIT 1) AS active_plan,
              COUNT(DISTINCT mb.id)::int AS total_bookings
       FROM children c
       LEFT JOIN users u ON u.id = c.parent_id
       LEFT JOIN mentor_bookings mb ON mb.child_id = c.id
       ${whereClause}
       GROUP BY c.id, u.full_name, u.email, u.mobile
       ORDER BY COALESCE(c.school,'ZZZ'), COALESCE(c.grade,'ZZZ'), c.name`,
      params
    );

    const headers = ['Platform ID','Name','Grade','School','Board','Gender','Age','City','State','Consent','Parent Name','Parent Email','Parent Mobile','Active Plan','Bookings','Joined'];
    const csvRows = rows.map((r: any) => [
      r.platform_id || '', r.name || '', r.grade || '', r.school || '', r.board || '',
      r.gender || '', r.age || '', r.city || '', r.state || '',
      r.consent_given ? 'Yes' : 'No',
      r.parent_name || '', r.parent_email || '', r.parent_mobile || '',
      r.active_plan || 'None', r.total_bookings || 0,
      r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '',
    ]);

    if (format === 'csv') {
      const csv = [headers, ...csvRows].map(row => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="class_roster.csv"');
      return res.send(csv);
    }

    if (format === 'xlsx') {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Class Roster');
      ws.addRow(headers).font = { bold: true };
      csvRows.forEach((r: any[]) => ws.addRow(r));
      ws.columns.forEach((col: any) => { col.width = 18; });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="class_roster.xlsx"');
      const buf = await wb.xlsx.writeBuffer();
      return res.send(buf);
    }

    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => {
        const pdf = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="class_roster.pdf"');
        res.send(pdf);
      });
      doc.fontSize(14).font('Helvetica-Bold').text('Class Roster Export', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica');
      rows.forEach((r: any, i: number) => {
        doc.text(
          `${i + 1}. ${r.name || '—'}  |  Grade: ${r.grade || '—'}  |  School: ${r.school || '—'}  |  Parent: ${r.parent_name || '—'}  |  ${r.parent_mobile || '—'}  |  Plan: ${r.active_plan || 'None'}`,
          { continued: false }
        );
      });
      doc.end();
      return;
    }

    res.status(400).json({ error: 'Invalid format. Use csv, xlsx, or pdf.' });
  } catch (err: any) {
    console.error('[GET /admin/students/class-roster/export]', err.message);
    res.status(500).json({ error: 'Failed to export class roster' });
  }
});

// GET /api/admin/students — adult independent learners (age >= 18)
// Children under 18 are managed through their parent's profile in the Parent Registry.
// Same `children` table; differentiated purely by age so no duplication of data or schema.
router.get('/students', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              u.full_name AS parent_name, u.email AS parent_email, u.mobile AS parent_mobile,
              u.platform_id AS parent_platform_id,
              su.is_active AS student_user_active, su.email AS student_user_email,
              COUNT(DISTINCT mb.id) AS total_bookings,
              COUNT(DISTINCT wc.id) AS wellness_checkins,
              COUNT(DISTINCT ls.id) AS lbi_sessions,
              CASE
                WHEN c.date_of_birth IS NOT NULL
                  THEN DATE_PART('year', AGE(c.date_of_birth::date))::int
                ELSE c.age
              END AS effective_age
       FROM children c
       LEFT JOIN users u ON u.id = c.parent_id
       LEFT JOIN users su ON su.id = c.student_user_id
       LEFT JOIN mentor_bookings mb ON mb.child_id = c.id
       LEFT JOIN wellness_checkins wc ON wc.child_id = c.id
       LEFT JOIN lbi_sessions ls ON ls.child_id = c.id
       WHERE (
         -- Age column confirms 18+
         (c.age IS NOT NULL AND c.age >= 18)
         OR
         -- DOB confirms 18+
         (c.date_of_birth IS NOT NULL AND DATE_PART('year', AGE(c.date_of_birth::date)) >= 18)
         OR
         -- No age info AND no parent link = standalone adult self-registration
         (c.age IS NULL AND c.date_of_birth IS NULL AND c.parent_id IS NULL)
       )
       GROUP BY c.id, u.full_name, u.email, u.mobile, u.platform_id, su.is_active, su.email
       ORDER BY c.platform_id NULLS LAST, c.created_at DESC`
    );
    res.json(rows.map((r: any) => ({
      id: r.id, platformId: r.platform_id, name: r.name,
      age: r.effective_age ?? r.age, grade: r.grade, gender: r.gender,
      board: r.board, school: r.school, city: r.city, state: r.state,
      careerInterest: r.career_interest, learningStyle: r.learning_style,
      language: r.language, consentGiven: r.consent_given, createdAt: r.created_at,
      parentName: r.parent_name, parentEmail: r.parent_email, parentMobile: r.parent_mobile,
      parentId: r.parent_id, parentPlatformId: r.parent_platform_id,
      studentUserId: r.student_user_id,
      studentUserActive: r.student_user_active,
      studentUserEmail: r.student_user_email,
      totalBookings: parseInt(r.total_bookings) || 0,
      wellnessCheckins: parseInt(r.wellness_checkins) || 0,
      lbiSessions: parseInt(r.lbi_sessions) || 0,
    })));
  } catch (err: any) {
    console.error('[GET /admin/students]', err.message);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/admin/students/:id — full student detail
router.get('/students/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*, u.full_name AS parent_name, u.email AS parent_email, u.mobile AS parent_mobile,
              su.is_active AS student_user_active, su.email AS student_user_email
       FROM children c
       LEFT JOIN users u ON u.id = c.parent_id
       LEFT JOIN users su ON su.id = c.student_user_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });
    const r = rows[0];
    res.json({
      id: r.id, platformId: r.platform_id, name: r.name,
      age: r.age, grade: r.grade, gender: r.gender,
      dateOfBirth: r.date_of_birth, bloodGroup: r.blood_group,
      school: r.school, board: r.board, language: r.language, medium: r.medium,
      schoolType: r.school_type, city: r.city, state: r.state,
      studyHoursPerDay: r.study_hours_per_day,
      favoriteSubjects: r.favorite_subjects || [],
      weakSubjects: r.weak_subjects || [],
      learningStyle: r.learning_style, careerInterest: r.career_interest,
      relationship: r.relationship,
      consentGiven: r.consent_given, consentGivenAt: r.consent_given_at,
      createdAt: r.created_at, parentId: r.parent_id,
      parentName: r.parent_name, parentEmail: r.parent_email, parentMobile: r.parent_mobile,
      studentUserId: r.student_user_id,
      studentUserActive: r.student_user_active,
      studentUserEmail: r.student_user_email,
    });
  } catch (err: any) {
    console.error('[GET /admin/students/:id]', err.message);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// GET /api/admin/students/:id/wellness
router.get('/students/:id/wellness', async (req, res) => {
  try {
    const result = await db.select().from(wellnessCheckins)
      .where(eq(wellnessCheckins.childId, req.params.id))
      .orderBy(desc(wellnessCheckins.checkedAt))
      .limit(30);
    res.json(result.map((r) => ({
      id: r.id, stressLevel: r.stressLevel, mood: r.mood,
      energy: r.energy, focus: r.focus, sleepHours: r.sleepHours,
      notes: r.notes, flags: r.flags, checkedAt: r.checkedAt,
    })));
  } catch (err: any) {
    console.error('[GET /admin/students/:id/wellness]', err.message);
    res.status(500).json({ error: 'Failed to fetch wellness data' });
  }
});

// GET /api/admin/students/:id/lbi
router.get('/students/:id/lbi', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ls.*, lm.module_name, lm.description AS module_description
       FROM lbi_sessions ls
       LEFT JOIN lbi_modules lm ON lm.id = ls.module_id
       WHERE ls.child_id = $1
       ORDER BY ls.started_at DESC`,
      [req.params.id]
    );
    res.json(rows.map((r: any) => ({
      id: r.id, status: r.status, moduleName: r.module_name,
      moduleDescription: r.module_description,
      rawScore: r.raw_score, maxScore: r.max_score,
      percentileScore: r.percentile_score, percentageScore: r.percentage_score,
      totalQuestions: r.total_questions, questionsAnswered: r.questions_answered,
      startedAt: r.started_at, completedAt: r.completed_at,
    })));
  } catch (err: any) {
    console.error('[GET /admin/students/:id/lbi]', err.message);
    res.status(500).json({ error: 'Failed to fetch LBI sessions' });
  }
});

// GET /api/admin/students/:id/bookings
router.get('/students/:id/bookings', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT mb.*, mp.user_id AS mentor_user_id, u.full_name AS mentor_name
       FROM mentor_bookings mb
       LEFT JOIN mentor_profiles mp ON mp.id = mb.mentor_id
       LEFT JOIN users u ON u.id = mp.user_id
       WHERE mb.child_id = $1
       ORDER BY mb.slot_date DESC`,
      [req.params.id]
    );
    res.json(rows.map((r: any) => ({
      id: r.id, slotDate: r.slot_date, startTime: r.start_time, endTime: r.end_time,
      mode: r.mode, status: r.status, notes: r.notes, sessionLink: r.session_link,
      mentorName: r.mentor_name, createdAt: r.created_at,
    })));
  } catch (err: any) {
    console.error('[GET /admin/students/:id/bookings]', err.message);
    res.status(500).json({ error: 'Failed to fetch student bookings' });
  }
});

// GET /api/admin/students/:id/subscription
router.get('/students/:id/subscription', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ss.*, sp.product_name AS package_name, sp.description AS package_description,
              sp.highlights AS features, sp.price, sp.validity_days, sp.subscription_type
       FROM student_subscriptions ss
       LEFT JOIN subscription_packages sp ON sp.id = ss.package_id
       WHERE ss.child_id = $1
       ORDER BY ss.created_at DESC`,
      [req.params.id]
    );
    res.json(rows.map((r: any) => ({
      id: r.id, status: r.status,
      purchaseDate: r.purchase_date, startDate: r.start_date, expiryDate: r.expiry_date,
      packageName: r.package_name, packageDescription: r.package_description,
      features: r.features, price: r.price,
      validityDays: r.validity_days, subscriptionType: r.subscription_type,
      notes: r.notes,
    })));
  } catch (err: any) {
    console.error('[GET /admin/students/:id/subscription]', err.message);
    res.status(500).json({ error: 'Failed to fetch student subscription' });
  }
});

// ═══════════════════════════════════════════════════════
// INSTITUTIONS
// ═══════════════════════════════════════════════════════

// GET /api/admin/institutions — list all, optional ?type=school|college|ngo|lei
router.get('/institutions', async (req, res) => {
  try {
    const typeFilter = req.query.type as string | undefined;
    const params: any[] = [];
    let where = '';
    if (typeFilter && typeFilter !== 'all') {
      params.push(typeFilter);
      where = `WHERE i.institution_type = $1`;
    }
    const { rows } = await query(
      `SELECT i.*, u.email AS user_email
       FROM institutions i
       LEFT JOIN users u ON u.id = i.user_id
       ${where}
       ORDER BY i.created_at DESC`,
      params
    );
    res.json(rows.map((r: any) => ({
      id: r.id, name: r.name, institutionType: r.institution_type,
      institutionCode: r.institution_code, email: r.email, phone: r.phone,
      city: r.city, state: r.state, status: r.status, kycStatus: r.kyc_status,
      documentsVerified: r.documents_verified, studentCount: r.student_count,
      contactPerson: r.contact_person, createdAt: r.created_at,
    })));
  } catch (err: any) {
    console.error('[GET /admin/institutions]', err.message);
    res.status(500).json({ error: 'Failed to fetch institutions' });
  }
});

// GET /api/admin/institutions/:id — full institution detail
// NOTE: kept as raw SQL because DB columns (institution_type, institution_code, etc.) differ from Drizzle schema
router.get('/institutions/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM institutions WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Institution not found' });
    const r = rows[0];
    res.json({
      id: r.id, name: r.name, institutionType: r.institution_type,
      institutionCode: r.institution_code, email: r.email, phone: r.phone,
      website: r.website, address: r.address, city: r.city, state: r.state,
      pincode: r.pincode, country: r.country,
      registrationNumber: r.registration_number, panNumber: r.pan_number,
      gstNumber: r.gst_number, affiliationBoard: r.affiliation_board,
      accreditation: r.accreditation, studentCount: r.student_count,
      staffCount: r.staff_count, contactPerson: r.contact_person,
      contactDesignation: r.contact_designation, contactEmail: r.contact_email,
      contactPhone: r.contact_phone, description: r.description,
      status: r.status, kycStatus: r.kyc_status,
      documentsVerified: r.documents_verified, notes: r.notes,
      activatedAt: r.activated_at, createdAt: r.created_at, updatedAt: r.updated_at,
    });
  } catch (err: any) {
    console.error('[GET /admin/institutions/:id]', err.message);
    res.status(500).json({ error: 'Failed to fetch institution' });
  }
});

// POST /api/admin/institutions/:id/assign-code — generate and assign typed code
router.post('/institutions/:id/assign-code', async (req, res) => {
  try {
    const { rows: inst } = await query(`SELECT institution_type, institution_code FROM institutions WHERE id = $1`, [req.params.id]);
    if (!inst.length) return res.status(404).json({ error: 'Institution not found' });
    if (inst[0].institution_code) return res.status(400).json({ error: 'Code already assigned', code: inst[0].institution_code });

    const typeMap: Record<string, string> = {
      school: 'sch_code_seq', college: 'clg_code_seq', ngo: 'ngo_code_seq', lei: 'lei_code_seq'
    };
    const prefixMap: Record<string, string> = {
      school: 'MTX-SCH', college: 'MTX-CLG', ngo: 'MTX-NGO', lei: 'MTX-LEI'
    };
    const seqName = typeMap[inst[0].institution_type] || 'sch_code_seq';
    const prefix = prefixMap[inst[0].institution_type] || 'MTX-INST';

    const { rows: seqRows } = await query(`SELECT nextval($1) AS seq`, [seqName]);
    const code = `${prefix}-${String(seqRows[0].seq).padStart(4, '0')}`;

    await query(
      `UPDATE institutions SET institution_code = $1, status = 'active', activated_at = now(), updated_at = now() WHERE id = $2`,
      [code, req.params.id]
    );
    res.json({ code, message: `Institution code ${code} assigned successfully` });
  } catch (err: any) {
    console.error('[POST /admin/institutions/:id/assign-code]', err.message);
    res.status(500).json({ error: 'Failed to assign code' });
  }
});

// POST /api/admin/institutions/:id/verify-kyc
router.post('/institutions/:id/verify-kyc', async (req, res) => {
  try {
    const { status = 'verified', notes } = req.body;
    await query(
      `UPDATE institutions SET kyc_status = $1, documents_verified = $2, notes = $3, updated_at = now() WHERE id = $4`,
      [status, status === 'verified', notes || null, req.params.id]
    );
    res.json({ message: `KYC status updated to ${status}` });
  } catch (err: any) {
    console.error('[POST /admin/institutions/:id/verify-kyc]', err.message);
    res.status(500).json({ error: 'Failed to update KYC status' });
  }
});

// PATCH /api/admin/institutions/:id/status
router.patch('/institutions/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await db.update(institutions)
      .set({ status, updatedAt: new Date() })
      .where(eq(institutions.id, req.params.id));
    res.json({ message: `Institution status updated to ${status}` });
  } catch (err: any) {
    console.error('[PATCH /admin/institutions/:id/status]', err.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /api/admin/institutions/:id/notify
router.post('/institutions/:id/notify', requireAdmin, async (req, res) => {
  try {
    const instRes = await query('SELECT * FROM institutions WHERE id = $1', [req.params.id]);
    if (!instRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const inst = instRes.rows[0];
    const { subject, message } = req.body;
    const emailSubject = subject || `Message from MetryxOne Admin`;
    const emailBody = message || `This is an administrative message from the MetryxOne platform team.`;
    if (inst.email) {
      try {
        const { sendEmail } = await import('../utils/email');
        await sendEmail({ to: inst.email, subject: emailSubject, html: `<p>Dear ${inst.name},</p><p>${emailBody}</p><br/><p>— MetryxOne Admin Team</p>` });
      } catch (mailErr: any) {
        console.warn('[Institution notify] Email failed:', mailErr.message);
      }
    }
    await db.insert(institutionActivityLogs).values({
      institutionId: inst.id,
      action: 'admin_notify',
      performedBy: 'admin',
      details: { subject: emailSubject, sentAt: new Date() },
    }).onConflictDoNothing().catch(() => null);
    res.json({ success: true, sent_to: inst.email || null, institution: inst.name });
  } catch (err: any) {
    console.error('[POST /admin/institutions/:id/notify]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/institutions/:id/reset-password
router.post('/institutions/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const instRes = await query('SELECT * FROM institutions WHERE id = $1', [req.params.id]);
    if (!instRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const inst = instRes.rows[0];
    if (!inst.email) return res.status(400).json({ error: 'No email on file for this institution' });
    const token = require('crypto').randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await query(`UPDATE users SET reset_token = $1, reset_token_expires = $2, updated_at = NOW() WHERE email = $3`,
      [token, expires, inst.email]).catch(() => null);
    try {
      const { sendEmail } = await import('../utils/email');
      await sendEmail({ to: inst.email, subject: 'Password Reset — MetryxOne', html: `<p>A password reset was requested for your institution account at MetryxOne.</p><p>If this was intentional, please contact the platform admin or use the reset link.</p><p>Token: <code>${token}</code></p><br/><p>— MetryxOne Admin</p>` });
    } catch (mailErr: any) { console.warn('[Inst reset-password] Email failed:', mailErr.message); }
    res.json({ success: true, email: inst.email, message: 'Password reset initiated' });
  } catch (err: any) {
    console.error('[POST /admin/institutions/:id/reset-password]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// INSTITUTION STUDENTS — CLASS ROSTER
// ═══════════════════════════════════════════════════════
router.get('/institutions/:id/students', requireAdmin, async (req, res) => {
  try {
    const instResult = await query('SELECT * FROM institutions WHERE id = $1', [req.params.id]);
    if (!instResult.rows.length) return res.status(404).json({ error: 'NOT_FOUND', message: 'Institution not found.' });
    const inst = instResult.rows[0];

    const studentsResult = await query(`
      SELECT
        c.id, c.name, c.platform_id, c.school, c.grade, c.age, c.gender,
        c.board, c.medium, c.created_at,
        u.id AS parent_id, u.full_name AS parent_name, u.email AS parent_email,
        u.mobile AS parent_phone, u.platform_id AS parent_platform_id,
        pk.kyc_status, pk.id_number AS uid_number,
        ps.status AS subscription_status,
        ps.plan AS subscription_tier,
        ps.started_at AS subscription_started_at,
        ps.expires_at AS subscription_expires_at,
        (SELECT COUNT(*) FROM mentor_bookings mb WHERE mb.child_id = c.id) AS mentor_session_count,
        (SELECT mb2.slot_date FROM mentor_bookings mb2 WHERE mb2.child_id = c.id ORDER BY mb2.slot_date DESC LIMIT 1) AS last_session_date,
        (SELECT mp.display_name FROM mentor_bookings mb3 JOIN mentor_profiles mp ON mp.id = mb3.mentor_id WHERE mb3.child_id = c.id ORDER BY mb3.slot_date DESC LIMIT 1) AS last_mentor_name
      FROM children c
      LEFT JOIN users u ON c.parent_id = u.id
      LEFT JOIN parent_kyc pk ON pk.parent_id = u.id
      LEFT JOIN LATERAL (
        SELECT ps2.status, ps2.plan, ps2.started_at, ps2.expires_at
        FROM parent_subscriptions ps2
        WHERE ps2.parent_id = u.id
        ORDER BY CASE ps2.status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 ELSE 2 END, ps2.created_at DESC
        LIMIT 1
      ) ps ON true
      WHERE LOWER(TRIM(c.school)) ILIKE $1
      ORDER BY c.grade NULLS LAST, c.name
    `, [`%${inst.name.toLowerCase().trim()}%`]);

    const students = studentsResult.rows;
    const stats = {
      total: students.length,
      with_subscription: students.filter(s => s.subscription_status === 'active' || s.subscription_status === 'trial').length,
      no_subscription: students.filter(s => !s.subscription_status || s.subscription_status === 'expired').length,
      kyc_pending: students.filter(s => !s.kyc_status || s.kyc_status === 'pending').length,
      kyc_verified: students.filter(s => s.kyc_status === 'verified').length,
      with_sessions: students.filter(s => Number(s.mentor_session_count) > 0).length,
    };

    res.json({
      institution: { id: inst.id, name: inst.name, code: inst.institution_code, type: inst.institution_type },
      students,
      stats,
      total: students.length
    });
  } catch (err: any) {
    console.error('[GET /admin/institutions/:id/students]', err.message);
    res.status(500).json({ error: 'Failed to fetch institution students' });
  }
});

router.post('/institutions/:id/assign-subscription', requireAdmin, async (req, res) => {
  try {
    const instResult = await query('SELECT * FROM institutions WHERE id = $1', [req.params.id]);
    if (!instResult.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    const inst = instResult.rows[0];
    const { plan, validity_days, parent_ids, grade } = req.body;
    if (!plan) return res.status(400).json({ error: 'plan is required' });
    const days = validity_days || 30;

    let targetParents: string[];
    if (parent_ids && parent_ids.length) {
      targetParents = parent_ids;
    } else {
      const q: any[] = [`%${inst.name.toLowerCase().trim()}%`];
      let gradeFilter = '';
      if (grade) { gradeFilter = ' AND c.grade = $2'; q.push(grade); }
      const result = await query(
        `SELECT DISTINCT u.id FROM children c JOIN users u ON c.parent_id = u.id WHERE LOWER(TRIM(c.school)) ILIKE $1${gradeFilter}`,
        q
      );
      targetParents = result.rows.map((r: any) => r.id);
    }

    let assigned = 0;
    const now = new Date();
    const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    for (const pid of targetParents) {
      await db.insert(parentSubscriptions).values({
        parentId: pid, plan, status: 'active', startedAt: now, expiresAt: expires,
      }).onConflictDoUpdate({
        target: parentSubscriptions.parentId,
        set: { plan, status: 'active', startedAt: now, expiresAt: expires },
      });
      assigned++;
    }
    res.json({ success: true, assigned, plan, validity_days: days, expires_at: expires });
  } catch (err: any) {
    console.error('[POST /admin/institutions/:id/assign-subscription]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/institutions/:id/students/:childId/assign-mentor', requireAdmin, async (req, res) => {
  try {
    const { mentor_id, slot_date, start_time, end_time, mode } = req.body;
    if (!mentor_id || !slot_date) return res.status(400).json({ error: 'mentor_id and slot_date required' });
    const childRes = await db.select().from(children).where(eq(children.id, req.params.childId));
    if (!childRes.length) return res.status(404).json({ error: 'Student not found' });
    const child = childRes[0];
    await db.insert(mentorBookings).values({
      mentorId: mentor_id,
      childId: child.id,
      parentId: child.parentId,
      slotDate: slot_date,
      startTime: start_time || '10:00',
      endTime: end_time || '11:00',
      mode: mode || 'online',
      status: 'scheduled',
    });
    res.json({ success: true, child_id: child.id, mentor_id, slot_date });
  } catch (err: any) {
    console.error('[POST assign-mentor]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PARENT CONSENT FORM — DOWNLOAD + EMAIL
// ═══════════════════════════════════════════════════════

function buildConsentFormHtml(parent: any, children: any[]): string {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const childRows = children.map(c => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">${c.name || '—'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">${c.grade ? `Grade ${c.grade}` : '—'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">${c.age || '—'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">${c.consentGiven ? '✓ Obtained' : 'Pending'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">${c.consentGivenAt ? new Date(c.consentGivenAt).toLocaleDateString('en-IN') : '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Parental Consent Form — MetryxOne</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a2e; font-size: 14px; }
  .page { max-width: 800px; margin: 0 auto; padding: 48px 40px; }
  .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 2px solid #344E86; margin-bottom: 32px; }
  .logo { font-size: 22px; font-weight: 800; color: #344E86; letter-spacing: -0.5px; }
  .logo span { color: #4ECDC4; }
  .doc-meta { text-align: right; font-size: 12px; color: #888; }
  .doc-meta strong { display: block; font-size: 14px; color: #344E86; margin-bottom: 2px; }
  h1 { font-size: 20px; font-weight: 700; color: #344E86; margin-bottom: 8px; }
  .subtitle { font-size: 13px; color: #666; margin-bottom: 32px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 11px; font-weight: 700; color: #344E86; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e8edf5; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
  .info-item label { display: block; font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .info-item span { font-size: 14px; font-weight: 500; color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead tr { background: #344E86; color: #fff; }
  thead th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  tbody tr:nth-child(even) { background: #f9fbff; }
  .consent-block { background: #f0f5ff; border-left: 3px solid #344E86; border-radius: 0 8px 8px 0; padding: 18px 20px; font-size: 13px; line-height: 1.7; color: #333; }
  .consent-block strong { color: #344E86; }
  .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
  .sig-box { border-top: 1.5px solid #344E86; padding-top: 10px; }
  .sig-label { font-size: 11px; color: #666; }
  .sig-name { font-size: 13px; font-weight: 600; color: #333; margin-top: 4px; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; text-align: center; line-height: 1.6; }
  @media print { body { background: white; } .page { padding: 24px; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">Metryx<span>One</span></div>
    <div class="doc-meta">
      <strong>Parental Consent Form</strong>
      Date: ${today}<br/>
      Doc Ref: PCF-${parent.id?.substring(0, 8).toUpperCase() || 'DRAFT'}
    </div>
  </div>

  <h1>Explicit Parental Consent Declaration</h1>
  <p class="subtitle">This document constitutes formal consent under the Digital Personal Data Protection (DPDP) Act 2023 and the Information Technology Act 2000 for participation in the MetryxOne platform.</p>

  <div class="section">
    <div class="section-title">Parent / Guardian Details</div>
    <div class="info-grid">
      <div class="info-item"><label>Full Name</label><span>${parent.fullName || parent.name || '—'}</span></div>
      <div class="info-item"><label>Email Address</label><span>${parent.email || '—'}</span></div>
      <div class="info-item"><label>Mobile</label><span>${parent.mobile || '—'}</span></div>
      <div class="info-item"><label>Account Status</label><span>${parent.status || 'Active'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Children Covered by This Consent</div>
    <table>
      <thead>
        <tr>
          <th>Child's Name</th>
          <th>Grade</th>
          <th>Age</th>
          <th>Consent Status</th>
          <th>Date Recorded</th>
        </tr>
      </thead>
      <tbody>
        ${childRows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#aaa;">No children registered</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Consent Declaration</div>
    <div class="consent-block">
      I, <strong>${parent.fullName || parent.name || '________________'}</strong>, the parent/legal guardian of the above-named child(ren), hereby provide <strong>explicit, informed, and voluntary consent</strong> for:<br/><br/>
      1. <strong>Data Collection &amp; Processing</strong> — Collection of personal data including academic profile, learning preferences, behavioural assessments (LBI), wellness check-ins, and session recordings as necessary for the platform.<br/><br/>
      2. <strong>Mentor Matching &amp; Sessions</strong> — Participation in mentor-led sessions, assessments, and educational programmes offered through MetryxOne.<br/><br/>
      3. <strong>Reporting &amp; Insights</strong> — Generation of progress reports, LBI scores, and personalised recommendations shared exclusively with me as the registered parent/guardian.<br/><br/>
      4. <strong>Data Retention</strong> — Retention of data for the duration of the subscription and up to 24 months post-termination, after which it will be permanently deleted unless a data copy is requested.<br/><br/>
      I understand that I may withdraw this consent at any time by contacting <strong>privacy@metryxone.com</strong>, and that withdrawal will not affect the lawfulness of any processing prior to that date. I confirm that all information provided is accurate and that I am the legal guardian of the child(ren) listed above.
    </div>
  </div>

  <div class="signature-grid">
    <div class="sig-box">
      <div style="height:60px;"></div>
      <div class="sig-label">Parent / Guardian Signature</div>
      <div class="sig-name">${parent.fullName || parent.name || '________________'}</div>
    </div>
    <div class="sig-box">
      <div style="height:60px;"></div>
      <div class="sig-label">Date &amp; Place</div>
      <div class="sig-name">${today}</div>
    </div>
  </div>

  <div class="footer">
    MetryxOne Behavioural Intelligence Platform · privacy@metryxone.com<br/>
    This document is generated for record-keeping purposes under the DPDP Act 2023. Retain a signed copy for your records.
  </div>
</div>
</body>
</html>`;
}

// GET /api/admin/parents/:id/consent-form — downloadable HTML consent form
router.get('/parents/:id/consent-form', async (req, res) => {
  try {
    const parentRows = await db.select({
      id: users.id, full_name: users.fullName, email: users.email,
      mobile: users.mobile, status: users.isActive,
    }).from(users).where(eq(users.id, req.params.id));
    if (parentRows.length === 0) return res.status(404).json({ error: 'Parent not found' });
    const parent = parentRows[0];

    const childRowsData = await db.select({
      id: children.id, name: children.name, age: children.age,
      grade: children.grade, consent_given: children.consentGiven,
      consent_given_at: children.consentGivenAt,
    }).from(children).where(eq(children.parentId, req.params.id)).orderBy(asc(children.createdAt));
    const childrenList = childRowsData.map((c: any) => ({
      id: c.id, name: c.name, age: c.age, grade: c.grade,
      consentGiven: c.consent_given, consentGivenAt: c.consent_given_at,
    }));

    const html = buildConsentFormHtml(
      { id: parent.id, fullName: parent.full_name, email: parent.email, mobile: parent.mobile, status: parent.status },
      childrenList
    );

    const filename = `consent-form-${(parent.full_name || 'parent').replace(/\s+/g, '-').toLowerCase()}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err: any) {
    console.error('[GET /admin/parents/:id/consent-form]', err.message);
    res.status(500).json({ error: 'Failed to generate consent form' });
  }
});

// POST /api/admin/parents/:id/send-consent-email — email consent form to parent
router.post('/parents/:id/send-consent-email', async (req, res) => {
  try {
    const parentRows = await db.select({
      id: users.id, full_name: users.fullName, email: users.email, mobile: users.mobile,
    }).from(users).where(eq(users.id, req.params.id));
    if (parentRows.length === 0) return res.status(404).json({ error: 'Parent not found' });
    const parent = parentRows[0];
    if (!parent.email) return res.status(400).json({ error: 'Parent has no email address on record' });

    const childRowsData = await db.select({
      id: children.id, name: children.name, age: children.age,
      grade: children.grade, consent_given: children.consentGiven,
      consent_given_at: children.consentGivenAt,
    }).from(children).where(eq(children.parentId, req.params.id)).orderBy(asc(children.createdAt));
    const childrenList = childRowsData.map((c: any) => ({
      id: c.id, name: c.name, age: c.age, grade: c.grade,
      consentGiven: c.consent_given, consentGivenAt: c.consent_given_at,
    }));
    const childList = childrenList.map((c: any) => `• ${c.name}${c.grade ? ` (Grade ${c.grade})` : ''}`).join('<br/>') || '• (No children registered)';

    const { sendEmail } = await import('../notifications/delivery/email.js');
    await sendEmail({
      to: parent.email,
      name: parent.full_name || 'Parent',
      title: 'Action Required: Explicit Parental Consent — MetryxOne',
      message: `Dear ${parent.full_name || 'Parent'},<br/><br/>
To comply with the Digital Personal Data Protection (DPDP) Act 2023, MetryxOne requires your <strong>explicit written consent</strong> for the following child(ren) registered under your account:<br/><br/>
${childList}<br/><br/>
Please download, complete, sign, and return the attached Parental Consent Form by replying to this email, or upload the signed copy through your MetryxOne account portal.<br/><br/>
<strong>What you are consenting to:</strong><br/>
Collection and processing of your child's academic and behavioural data for the purpose of mentor matching, LBI assessments, and personalised learning recommendations — exclusively accessible to you as the registered parent/guardian.<br/><br/>
If you have any questions, please contact us at <strong>privacy@metryxone.com</strong>.`,
    });

    res.json({ message: `Consent email sent to ${parent.email}` });
  } catch (err: any) {
    console.error('[POST /admin/parents/:id/send-consent-email]', err.message);
    res.status(500).json({ error: err.message || 'Failed to send consent email' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION PACKAGES — CRUD + SEED
// ─────────────────────────────────────────────────────────────────────────────

const PKG_COLS = `id, product_name, category, subcategory, student_segment, student_segment_code,
  age_band_codes, description, report_type, domains_covered, domain_config,
  question_draw_mode, difficulty_distribution, include_anchor_questions,
  mentor_add_on, max_attempts, assessment_mode, subscription_type,
  price, original_price, discount_pct, offer_label,
  coupon_code, coupon_discount_pct, trial_days, highlights,
  custom_module_id, pkg_status, frontend_sections, report_config,
  validity_days, question_count, sort_order, is_recommended, is_active,
  created_at, updated_at`;

function mapPkg(r: any) {
  return {
    id: r.id, productName: r.product_name, category: r.category || '', subcategory: r.subcategory || '',
    studentSegment: r.student_segment, studentSegmentCode: r.student_segment_code,
    ageBandCodes: r.age_band_codes || [], description: r.description,
    reportType: r.report_type, domainsCovered: r.domains_covered || [],
    domainConfig: r.domain_config || [], questionDrawMode: r.question_draw_mode || 'random',
    difficultyDistribution: r.difficulty_distribution || { easy: 30, medium: 50, hard: 20 },
    includeAnchorQuestions: r.include_anchor_questions ?? true,
    mentorAddOn: r.mentor_add_on || { enabled: false },
    maxAttempts: r.max_attempts || 1, assessmentMode: r.assessment_mode || 'online',
    subscriptionType: r.subscription_type || 'one_time', price: r.price,
    originalPrice: r.original_price ?? null,
    discountPct: r.discount_pct ?? null,
    offerLabel: r.offer_label ?? null,
    couponCode: r.coupon_code ?? null,
    couponDiscountPct: r.coupon_discount_pct ?? null,
    trialDays: r.trial_days ?? null,
    highlights: r.highlights || [],
    customModuleId: r.custom_module_id ?? null,
    pkgStatus: r.pkg_status || 'draft',
    frontendSections: r.frontend_sections || [],
    reportConfig: r.report_config || {},
    validityDays: r.validity_days, questionCount: r.question_count,
    sortOrder: r.sort_order, isRecommended: r.is_recommended, isActive: r.is_active,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

router.get('/subscription-packages', async (_req, res) => {
  try {
    const { rows } = await query(`SELECT ${PKG_COLS} FROM subscription_packages ORDER BY sort_order ASC, created_at DESC`);
    res.json(rows.map(mapPkg));
  } catch (err: any) { console.error('[GET /admin/subscription-packages]', err.message); res.status(500).json({ error: 'Failed' }); }
});

router.get('/subscription-packages/stats', async (_req, res) => {
  try {
    const { rows } = await query(`SELECT COUNT(*) FILTER (WHERE TRUE) AS total, COUNT(*) FILTER (WHERE is_active) AS active, (SELECT COUNT(*) FROM student_subscriptions) AS subscriptions, (SELECT COUNT(*) FROM student_subscriptions WHERE status='active') AS active_subs FROM subscription_packages`);
    const r = rows[0];
    res.json({ totalPackages: +r.total, activePackages: +r.active, totalSubscriptions: +r.subscriptions, activeSubscriptions: +r.active_subs, byCategory: {} });
  } catch (err: any) { console.error('[GET /admin/subscription-packages/stats]', err.message); res.status(500).json({ error: 'Failed' }); }
});

router.post('/subscription-packages', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO subscription_packages
        (product_name,category,subcategory,student_segment,student_segment_code,age_band_codes,description,
         report_type,domains_covered,domain_config,question_draw_mode,difficulty_distribution,
         include_anchor_questions,mentor_add_on,max_attempts,assessment_mode,subscription_type,
         price,original_price,discount_pct,offer_label,coupon_code,coupon_discount_pct,
         trial_days,highlights,custom_module_id,validity_days,question_count,sort_order,is_recommended,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
       RETURNING ${PKG_COLS}`,
      [b.productName, b.category, b.subcategory||'', b.studentSegment||'', b.studentSegmentCode||null, b.ageBandCodes||[],
       b.description||null, b.reportType||'Basic', b.domainsCovered||[], JSON.stringify(b.domainConfig||[]),
       b.questionDrawMode||'random', JSON.stringify(b.difficultyDistribution||{easy:30,medium:50,hard:20}),
       b.includeAnchorQuestions??true, JSON.stringify(b.mentorAddOn||{enabled:false}),
       b.maxAttempts||1, b.assessmentMode||'online', b.subscriptionType||'one_time',
       b.price||null, b.originalPrice||null, b.discountPct||null, b.offerLabel||null,
       b.couponCode||null, b.couponDiscountPct||null, b.trialDays||null,
       b.highlights||[], b.customModuleId||null,
       b.validityDays||null, b.questionCount||null, b.sortOrder||0, b.isRecommended||false, b.isActive??true]);
    res.status(201).json(mapPkg(rows[0]));
  } catch (err: any) { console.error('[POST /admin/subscription-packages]', err.message); res.status(500).json({ error: err.message }); }
});

router.put('/subscription-packages/:id', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `UPDATE subscription_packages SET
        product_name=$1,category=$2,subcategory=$3,student_segment=$4,student_segment_code=$5,age_band_codes=$6,
        description=$7,report_type=$8,domains_covered=$9,domain_config=$10,question_draw_mode=$11,
        difficulty_distribution=$12,include_anchor_questions=$13,mentor_add_on=$14,max_attempts=$15,
        assessment_mode=$16,subscription_type=$17,price=$18,original_price=$19,discount_pct=$20,
        offer_label=$21,coupon_code=$22,coupon_discount_pct=$23,trial_days=$24,highlights=$25,
        custom_module_id=$26,validity_days=$27,question_count=$28,sort_order=$29,
        is_recommended=$30,is_active=$31,updated_at=NOW()
       WHERE id=$32 RETURNING ${PKG_COLS}`,
      [b.productName, b.category, b.subcategory||'', b.studentSegment||'', b.studentSegmentCode||null, b.ageBandCodes||[],
       b.description||null, b.reportType||'Basic', b.domainsCovered||[], JSON.stringify(b.domainConfig||[]),
       b.questionDrawMode||'random', JSON.stringify(b.difficultyDistribution||{easy:30,medium:50,hard:20}),
       b.includeAnchorQuestions??true, JSON.stringify(b.mentorAddOn||{enabled:false}),
       b.maxAttempts||1, b.assessmentMode||'online', b.subscriptionType||'one_time',
       b.price??null, b.originalPrice??null, b.discountPct??null, b.offerLabel??null,
       b.couponCode??null, b.couponDiscountPct??null, b.trialDays??null,
       b.highlights||[], b.customModuleId??null,
       b.validityDays??null, b.questionCount??null, b.sortOrder??0, b.isRecommended||false, b.isActive??true,
       req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapPkg(rows[0]));
  } catch (err: any) { console.error('[PUT /admin/subscription-packages/:id]', err.message); res.status(500).json({ error: err.message }); }
});

// PATCH — partial update from Configure Package form
router.patch('/subscription-packages/:id', async (req, res) => {
  try {
    const b = req.body;
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    const field = (col: string, val: any) => { sets.push(`${col}=$${idx++}`); vals.push(val); };
    if (b.productName   !== undefined) field('product_name',       b.productName);
    if (b.category      !== undefined) field('category',           b.category);
    if (b.subcategory   !== undefined) field('subcategory',        b.subcategory);
    if (b.studentSegment!== undefined) field('student_segment',    b.studentSegment);
    if (b.reportType    !== undefined) field('report_type',        b.reportType);
    if (b.domainsCovered!== undefined) field('domains_covered',   b.domainsCovered);
    if (b.isRecommended !== undefined) field('is_recommended',     b.isRecommended);
    if (b.isActive      !== undefined) field('is_active',          b.isActive);
    if (b.price         !== undefined) field('price',              b.price);
    if (b.questionCount !== undefined) field('question_count',     b.questionCount);
    if (b.validityDays  !== undefined) field('validity_days',      b.validityDays);
    if (b.originalPrice !== undefined) field('original_price',     b.originalPrice);
    if (b.discountPct   !== undefined) field('discount_pct',       b.discountPct);
    if (b.offerLabel    !== undefined) field('offer_label',        b.offerLabel);
    if (b.couponCode    !== undefined) field('coupon_code',        b.couponCode);
    if (b.couponDiscountPct !== undefined) field('coupon_discount_pct', b.couponDiscountPct);
    if (b.trialDays     !== undefined) field('trial_days',         b.trialDays);
    if (b.highlights    !== undefined) field('highlights',          b.highlights);
    if (b.customModuleId!== undefined) field('custom_module_id',    b.customModuleId);
    if (b.pkgStatus     !== undefined) field('pkg_status',          b.pkgStatus);
    if (b.frontendSections!==undefined) field('frontend_sections',  b.frontendSections);
    if (b.reportConfig  !== undefined) field('report_config',       JSON.stringify(b.reportConfig));
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    sets.push(`updated_at=NOW()`);
    vals.push(req.params.id);
    const { rows } = await query(
      `UPDATE subscription_packages SET ${sets.join(',')} WHERE id=$${idx} RETURNING ${PKG_COLS}`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapPkg(rows[0]));
  } catch (err: any) { console.error('[PATCH /admin/subscription-packages/:id]', err.message); res.status(500).json({ error: err.message }); }
});

router.delete('/subscription-packages/:id', async (req, res) => {
  try {
    const result = await db.delete(subscriptionPackages).where(eq(subscriptionPackages.id, req.params.id)).returning({ id: subscriptionPackages.id });
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err: any) { console.error('[DELETE /admin/subscription-packages/:id]', err.message); res.status(500).json({ error: 'Failed' }); }
});

router.post('/subscription-packages/seed', async (_req, res) => {
  try {
    const defaults = [
      { productName:'Focus & Clarity Check', category:'Entry (Micro Check)', studentSegment:'Classes 6–12', studentSegmentCode:'UNIVERSAL', ageBandCodes:['A','B','C'], price:299, questionCount:30, validityDays:90, reportType:'Basic', domainsCovered:['Academic & Cognitive Efficiency','Mindset & Self-Regulation'], questionDrawMode:'random', sortOrder:1 },
      { productName:'Exam Season Booster', category:'Exam-Season Special', studentSegment:'Classes 9–12', studentSegmentCode:'SECONDARY', ageBandCodes:['C'], price:699, questionCount:60, validityDays:180, reportType:'Standard', domainsCovered:['Academic & Cognitive Efficiency','Thinking Quality Profiling','Mindset & Self-Regulation'], questionDrawMode:'weighted', sortOrder:2 },
      { productName:'Annual Core LBI', category:'Annual Core', studentSegment:'Classes 6–12', studentSegmentCode:'UNIVERSAL', ageBandCodes:['A','B','C'], price:1499, questionCount:120, validityDays:365, reportType:'Detailed', domainsCovered:['Academic & Cognitive Efficiency','Social & Emotional Intelligence','Discipline, Habits & Commitment','Motivation, Values & Resilience'], questionDrawMode:'weighted', isRecommended:true, sortOrder:3 },
      { productName:'High-Pressure Premium', category:'Premium / High-Pressure', studentSegment:'JEE/NEET Aspirants', studentSegmentCode:'COMPETITIVE', ageBandCodes:['C','D'], price:2999, questionCount:180, validityDays:365, reportType:'Comprehensive', domainsCovered:['Academic & Cognitive Efficiency','Thinking Quality Profiling','Emotional Self-Expression & Regulation','Mindset & Self-Regulation','Lifestyle, Pressures & Environment'], questionDrawMode:'weighted', mentorAddOn:{enabled:true,sessions:2,duration:60,mentorType:'psychological_counsellor'}, sortOrder:4 },
      { productName:'Post-Exam Transition Check', category:'Post-Exam / Transition', studentSegment:'Classes 10–12', studentSegmentCode:'SECONDARY', ageBandCodes:['C'], price:499, questionCount:45, validityDays:120, reportType:'Standard', domainsCovered:['Optimism, Courage & Resilience','Adaptability & Integrity Management','Motivation, Values & Resilience'], questionDrawMode:'random', sortOrder:5 },
    ];
    let inserted = 0;
    for (const d of defaults) {
      const { rowCount } = await query(`SELECT 1 FROM subscription_packages WHERE product_name=$1`, [d.productName]);
      if ((rowCount??0)===0) {
        await query(`INSERT INTO subscription_packages (product_name,category,student_segment,student_segment_code,age_band_codes,report_type,domains_covered,question_draw_mode,price,validity_days,question_count,sort_order,is_recommended,is_active,mentor_add_on,difficulty_distribution) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [d.productName, d.category, d.studentSegment, d.studentSegmentCode, d.ageBandCodes, d.reportType, d.domainsCovered, d.questionDrawMode, d.price, d.validityDays, d.questionCount, d.sortOrder, (d as any).isRecommended||false, true, JSON.stringify((d as any).mentorAddOn||{enabled:false}), JSON.stringify({easy:30,medium:50,hard:20})]);
        inserted++;
      }
    }
    res.json({ message:`Seeded ${inserted} package(s)`, inserted });
  } catch (err: any) { console.error('[POST /admin/subscription-packages/seed]', err.message); res.status(500).json({ error: 'Failed to seed' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHILDREN LIST (flat, for assign-package dialog)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/children-list', async (req, res) => {
  try {
    const { search, school } = req.query as Record<string, string>;
    const params: any[] = [];
    const conditions: string[] = [];
    if (search) { params.push(`%${search.toLowerCase()}%`); conditions.push(`(LOWER(c.name) LIKE $${params.length} OR LOWER(u.full_name) LIKE $${params.length})`); }
    if (school) { params.push(`%${school.toLowerCase()}%`); conditions.push(`LOWER(c.school) LIKE $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT c.id, c.name, c.age, c.grade, c.gender, c.school, c.board, c.city, c.state, c.date_of_birth,
              u.full_name AS parent_name, u.email AS parent_email,
              COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'active') AS active_subscriptions,
              COUNT(DISTINCT ss.id) AS total_subscriptions
       FROM children c
       LEFT JOIN users u ON u.id = c.parent_id
       LEFT JOIN student_subscriptions ss ON ss.child_id = c.id
       ${where}
       GROUP BY c.id, u.full_name, u.email
       ORDER BY c.name ASC`,
      params
    );
    res.json(rows.map((r: any) => ({
      id: r.id, name: r.name, age: r.age, grade: r.grade, gender: r.gender,
      school: r.school, board: r.board, city: r.city, state: r.state,
      dateOfBirth: r.date_of_birth,
      parentName: r.parent_name, parentEmail: r.parent_email,
      activeSubscriptions: parseInt(r.active_subscriptions) || 0,
      totalSubscriptions: parseInt(r.total_subscriptions) || 0,
    })));
  } catch (err: any) {
    console.error('[GET /admin/children-list]', err.message);
    res.status(500).json({ error: 'Failed to fetch children list' });
  }
});

// GET /api/admin/children/:id/active-subscriptions
router.get('/children/:id/active-subscriptions', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ss.id, ss.status, ss.start_date, ss.expiry_date, ss.purchase_date,
              sp.product_name, sp.category, sp.subscription_type, sp.price, sp.age_band_codes
       FROM student_subscriptions ss
       JOIN subscription_packages sp ON sp.id = ss.package_id
       WHERE ss.child_id = $1 AND ss.status = 'active'
       ORDER BY ss.created_at DESC`,
      [req.params.id]
    );
    res.json(rows.map((r: any) => ({
      id: r.id, status: r.status, startDate: r.start_date, expiryDate: r.expiry_date, purchaseDate: r.purchase_date,
      productName: r.product_name, category: r.category,
      subscriptionType: r.subscription_type, price: r.price, ageBandCodes: r.age_band_codes,
    })));
  } catch (err: any) {
    console.error('[GET /admin/children/:id/active-subscriptions]', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT SUBSCRIPTIONS — LIST + ASSIGN
// ─────────────────────────────────────────────────────────────────────────────

router.get('/student-subscriptions', async (req, res) => {
  try {
    const { status, childId, packageId } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (status) { params.push(status); conditions.push(`ss.status = $${params.length}`); }
    if (childId) { params.push(childId); conditions.push(`ss.child_id = $${params.length}`); }
    if (packageId) { params.push(packageId); conditions.push(`ss.package_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(`
      SELECT ss.*,
             c.name AS child_name, c.grade AS child_grade, c.school AS child_school,
             u.full_name AS parent_name, u.email AS parent_email,
             sp.product_name AS package_name, sp.category AS package_category,
             sp.subscription_type, sp.price AS package_price,
             sp.age_band_codes, sp.assessment_mode, sp.validity_days,
             i.name AS institution_name
      FROM student_subscriptions ss
      LEFT JOIN children c ON c.id = ss.child_id
      LEFT JOIN users u ON u.id = c.parent_id
      LEFT JOIN subscription_packages sp ON sp.id = ss.package_id
      LEFT JOIN institutions i ON i.id::text = ss.institution_id
      ${where}
      ORDER BY ss.created_at DESC
    `, params);
    res.json(rows.map((r: any) => ({
      id: r.id, status: r.status,
      childId: r.child_id, childName: r.child_name, childGrade: r.child_grade, childSchool: r.child_school,
      parentName: r.parent_name, parentEmail: r.parent_email,
      packageId: r.package_id, packageName: r.package_name, packageCategory: r.package_category,
      subscriptionType: r.subscription_type, packagePrice: r.package_price,
      ageBandCodes: r.age_band_codes, assessmentMode: r.assessment_mode, validityDays: r.validity_days,
      institutionId: r.institution_id, institutionName: r.institution_name,
      notes: r.notes, targetAgeBand: r.target_age_band, assignedBy: r.assigned_by,
      purchaseDate: r.purchase_date, startDate: r.start_date, expiryDate: r.expiry_date,
      createdAt: r.created_at,
    })));
  } catch (err: any) {
    console.error('[GET /admin/student-subscriptions]', err.message);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

router.post('/student-subscriptions', async (req, res) => {
  try {
    const { childId, packageId, notes, startDate, institutionId, targetAgeBand, force } = req.body;
    if (!childId || !packageId) return res.status(400).json({ error: 'childId and packageId are required' });

    // Duplicate detection — check for existing active subscription of same package
    if (!force) {
      const existing = await db.select({
        id: studentSubscriptions.id,
        startDate: studentSubscriptions.startDate,
        expiryDate: studentSubscriptions.expiryDate,
      }).from(studentSubscriptions)
        .where(and(
          eq(studentSubscriptions.childId, childId),
          eq(studentSubscriptions.packageId, packageId),
          eq(studentSubscriptions.status, 'active'),
        ));
      if (existing.length > 0) {
        const ex = existing[0];
        return res.status(409).json({
          error: 'DUPLICATE_SUBSCRIPTION',
          message: 'This student already has an active subscription for this package.',
          existingId: ex.id,
          startDate: ex.startDate,
          expiryDate: ex.expiryDate,
        });
      }
    }

    const pkgRows = await db.select({
      validityDays: subscriptionPackages.validityDays,
      productName: subscriptionPackages.productName,
      category: subscriptionPackages.category,
      subscriptionType: subscriptionPackages.billingType,
      price: subscriptionPackages.price,
    }).from(subscriptionPackages).where(eq(subscriptionPackages.id, packageId));
    if (!pkgRows.length) return res.status(404).json({ error: 'Package not found' });

    const pkg = pkgRows[0];
    const start = startDate ? new Date(startDate) : new Date();
    const expiryDate = pkg.validityDays
      ? new Date(start.getTime() + pkg.validityDays * 24 * 60 * 60 * 1000)
      : null;

    const assignedBy = (req as any).user?.id || (req as any).session?.userId || null;

    const insertResult = await db.insert(studentSubscriptions).values({
      childId, packageId, purchaseDate: start, expiryDate, status: 'active',
      institutionId: institutionId || null, notes: notes || null,
      startDate: start, targetAgeBand: targetAgeBand || null, assignedBy,
    }).returning();

    // Fetch child name for response
    const childRows = await db.select({ name: children.name, grade: children.grade }).from(children).where(eq(children.id, childId));
    const child = childRows[0] || {} as any;

    res.status(201).json({
      ...insertResult[0],
      childName: child.name,
      childGrade: child.grade,
      packageName: pkg.productName,
      packageCategory: pkg.category,
      subscriptionType: pkg.subscriptionType,
      packagePrice: pkg.price,
      expiryDate,
    });
  } catch (err: any) {
    console.error('[POST /admin/student-subscriptions]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/student-subscriptions/bulk — assign same package to multiple children
router.post('/student-subscriptions/bulk', async (req, res) => {
  try {
    const { childIds, packageId, notes, startDate, institutionId, targetAgeBand, skipDuplicates } = req.body;
    if (!Array.isArray(childIds) || childIds.length === 0) return res.status(400).json({ error: 'childIds array is required' });
    if (!packageId) return res.status(400).json({ error: 'packageId is required' });

    const bulkPkgRows = await db.select({
      validityDays: subscriptionPackages.validityDays,
      productName: subscriptionPackages.productName,
    }).from(subscriptionPackages).where(eq(subscriptionPackages.id, packageId));
    if (!bulkPkgRows.length) return res.status(404).json({ error: 'Package not found' });

    const start = startDate ? new Date(startDate) : new Date();
    const expiryDate = bulkPkgRows[0].validityDays
      ? new Date(start.getTime() + bulkPkgRows[0].validityDays * 24 * 60 * 60 * 1000)
      : null;
    const assignedBy = (req as any).user?.id || (req as any).session?.userId || null;

    const results = { assigned: 0, skipped: 0, errors: [] as string[] };

    for (const childId of childIds) {
      try {
        // Check for existing active subscription
        const existing = await db.select({ id: studentSubscriptions.id }).from(studentSubscriptions)
          .where(and(
            eq(studentSubscriptions.childId, childId),
            eq(studentSubscriptions.packageId, packageId),
            eq(studentSubscriptions.status, 'active'),
          ));
        if (existing.length > 0) {
          if (skipDuplicates) { results.skipped++; continue; }
        }
        await db.insert(studentSubscriptions).values({
          childId, packageId, purchaseDate: start, expiryDate, status: 'active',
          institutionId: institutionId || null, notes: notes || null,
          startDate: start, targetAgeBand: targetAgeBand || null, assignedBy,
        }).onConflictDoNothing();
        results.assigned++;
      } catch (e: any) {
        results.errors.push(`${childId}: ${e.message}`);
      }
    }

    res.status(201).json({
      ok: true,
      packageName: bulkPkgRows[0].productName,
      ...results,
    });
  } catch (err: any) {
    console.error('[POST /admin/student-subscriptions/bulk]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/student-subscriptions/:id/revoke
router.patch('/student-subscriptions/:id/revoke', async (req, res) => {
  try {
    const result = await db.update(studentSubscriptions)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(eq(studentSubscriptions.id, req.params.id))
      .returning({ id: studentSubscriptions.id, status: studentSubscriptions.status });
    if (!result.length) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ ok: true, ...result[0] });
  } catch (err: any) {
    console.error('[PATCH /admin/student-subscriptions/:id/revoke]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/lbi-catalog', async (_req, res) => {
  try {
    const rows = await db.select({ domain_code: lbiDomains.domainCode, domain_name: lbiDomains.domainName })
      .from(lbiDomains).orderBy(asc(lbiDomains.sortOrder));
    const SD: Record<string,Array<{code:string;name:string;defaultCount:number}>> = {
      ACE:[{code:'ACE_SD01',name:'Learning Efficiency',defaultCount:4},{code:'ACE_SD02',name:'Memory Retention',defaultCount:4},{code:'ACE_SD03',name:'Attention & Focus',defaultCount:4}],
      TQP:[{code:'TQP_SD01',name:'Critical Thinking',defaultCount:4},{code:'TQP_SD02',name:'Decision Making',defaultCount:4},{code:'TQP_SD03',name:'Analytical Reasoning',defaultCount:3}],
      ESER:[{code:'ESER_SD01',name:'Emotional Awareness',defaultCount:4},{code:'ESER_SD02',name:'Self-Expression',defaultCount:3},{code:'ESER_SD03',name:'Emotion Regulation',defaultCount:4}],
      CSCC:[{code:'CSCC_SD01',name:'Academic Adjustment',defaultCount:3},{code:'CSCC_SD02',name:'Social Adjustment',defaultCount:3},{code:'CSCC_SD03',name:'Family Adjustment',defaultCount:3}],
      ACC:[{code:'ACC_SD01',name:'Challenge Tolerance',defaultCount:4},{code:'ACC_SD02',name:'Cognitive Load Mgmt',defaultCount:4}],
      SEI:[{code:'SEI_SD01',name:'Emotional Intelligence',defaultCount:4},{code:'SEI_SD02',name:'Relationships',defaultCount:3},{code:'SEI_SD03',name:'Trust & Openness',defaultCount:3}],
      DHC:[{code:'DHC_SD01',name:'Time Management',defaultCount:4},{code:'DHC_SD02',name:'Accountability',defaultCount:3},{code:'DHC_SD03',name:'Habit Consistency',defaultCount:3}],
      CE:[{code:'CE_SD01',name:'Listening Skills',defaultCount:3},{code:'CE_SD02',name:'Expression Skills',defaultCount:3},{code:'CE_SD03',name:'Assertiveness',defaultCount:3}],
      MVR:[{code:'MVR_SD01',name:'Commitment',defaultCount:4},{code:'MVR_SD02',name:'Persistence',defaultCount:4},{code:'MVR_SD03',name:'Value Alignment',defaultCount:3}],
      LPE:[{code:'LPE_SD01',name:'Digital Stress',defaultCount:3},{code:'LPE_SD02',name:'Sleep Quality',defaultCount:3},{code:'LPE_SD03',name:'External Pressure',defaultCount:3}],
      CER:[{code:'CER_SD01',name:'Cognitive Readiness',defaultCount:4},{code:'CER_SD02',name:'Processing Speed',defaultCount:3},{code:'CER_SD03',name:'Working Memory',defaultCount:4}],
      IRCM:[{code:'IRCM_SD01',name:'Conflict Resolution',defaultCount:4},{code:'IRCM_SD02',name:'Peer Relations',defaultCount:3},{code:'IRCM_SD03',name:'Authority Relations',defaultCount:3}],
      APRI:[{code:'APRI_SD01',name:'Performance Index',defaultCount:4},{code:'APRI_SD02',name:'Readiness Indicators',defaultCount:4},{code:'APRI_SD03',name:'Recovery Intelligence',defaultCount:3}],
      MSR:[{code:'MSR_SD01',name:'Mindset Orientation',defaultCount:4},{code:'MSR_SD02',name:'Self-Regulation',defaultCount:4},{code:'MSR_SD03',name:'Metacognitive Awareness',defaultCount:3}],
      HSSU:[{code:'HSSU_SD01',name:'Physical Health',defaultCount:3},{code:'HSSU_SD02',name:'Sleep & Rest',defaultCount:3},{code:'HSSU_SD03',name:'Stress Utility',defaultCount:3}],
      AIM:[{code:'AIM_SD01',name:'Adaptability',defaultCount:4},{code:'AIM_SD02',name:'Integrity',defaultCount:3},{code:'AIM_SD03',name:'Change Management',defaultCount:3}],
      TCA:[{code:'TCA_SD01',name:'Time Awareness',defaultCount:3},{code:'TCA_SD02',name:'Commitment Tracking',defaultCount:3},{code:'TCA_SD03',name:'Priority Management',defaultCount:4}],
      TSIS:[{code:'TSIS_SD01',name:'Trust Building',defaultCount:3},{code:'TSIS_SD02',name:'Identity Security',defaultCount:4},{code:'TSIS_SD03',name:'Social Safety',defaultCount:3}],
      OCR:[{code:'OCR_SD01',name:'Optimism',defaultCount:3},{code:'OCR_SD02',name:'Courage',defaultCount:3},{code:'OCR_SD03',name:'Resilience',defaultCount:4}],
    };
    res.json(rows.map((d:any) => ({ code:d.domain_code, name:d.domain_name, subdomains:SD[d.domain_code]||[] })));
  } catch (err: any) { console.error('[GET /admin/lbi-catalog]', err.message); res.status(500).json({ error: 'Failed' }); }
});

// ════════════════════════════════════════════════════════════════════
// ── PSYCHOMETRIC ASSESSMENT MANAGEMENT ────────────────────────────
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/psychometric/domains — list all assessment domains with subdomain counts
router.get('/psychometric/domains', async (_req, res) => {
  try {
    const result = await query(`
      SELECT d.*, COUNT(s.id)::int AS subdomain_count
      FROM assessment_domains d
      LEFT JOIN assessment_subdomains s ON s.domain_id = d.id
      GROUP BY d.id ORDER BY d.id
    `);
    res.json(result.rows.map((r: any) => ({
      id: r.id, domainCode: r.domain_code, domainName: r.domain_name,
      weightPercent: r.weight_percent, toolsMethods: r.tools_methods,
      rootCause: r.root_cause, practicalOutcome: r.practical_outcome,
      correlations: r.correlations, isActive: r.is_active,
      subdomainCount: r.subdomain_count,
    })));
  } catch (err: any) {
    console.error('[GET /admin/psychometric/domains]', err.message);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

// PATCH /api/admin/psychometric/domains/:id/toggle — toggle domain active status
router.patch('/psychometric/domains/:id/toggle', async (req, res) => {
  try {
    const result = await db.update(assessmentDomains)
      .set({ isActive: sql`NOT is_active` })
      .where(eq(assessmentDomains.id, parseInt(req.params.id)))
      .returning({ id: assessmentDomains.id, isActive: assessmentDomains.isActive });
    if (!result.length) return res.status(404).json({ error: 'Domain not found' });
    res.json({ id: result[0].id, isActive: result[0].isActive });
  } catch (err: any) {
    console.error('[PATCH /admin/psychometric/domains/:id/toggle]', err.message);
    res.status(500).json({ error: 'Failed to toggle domain' });
  }
});

// GET /api/admin/psychometric/age-bands — list all age bands
router.get('/psychometric/age-bands', async (_req, res) => {
  try {
    const result = await db.select().from(lbiAgeBands).orderBy(asc(lbiAgeBands.sortOrder));
    res.json(result.map((r) => ({
      id: r.id, bandCode: r.bandCode, label: r.label,
      ageMin: r.ageMin, ageMax: r.ageMax, sortOrder: r.sortOrder,
    })));
  } catch (err: any) {
    console.error('[GET /admin/psychometric/age-bands]', err.message);
    res.status(500).json({ error: 'Failed to fetch age bands' });
  }
});

// GET /api/admin/psychometric/config — domain + subdomain + age band config
router.get('/psychometric/config', async (_req, res) => {
  try {
    const [domainRows, subdomainRows, ageBandRows, qCountResult] = await Promise.all([
      db.select({
        id: assessmentDomains.id, domainCode: assessmentDomains.domainCode,
        domainName: assessmentDomains.domainName, isActive: assessmentDomains.isActive,
      }).from(assessmentDomains).orderBy(asc(assessmentDomains.id)),
      db.select({
        id: assessmentSubdomains.id, domainId: assessmentSubdomains.domainId,
        subdomainName: assessmentSubdomains.subdomainName,
        weightInDomain: assessmentSubdomains.weightInDomain, sortOrder: assessmentSubdomains.sortOrder,
      }).from(assessmentSubdomains).orderBy(asc(assessmentSubdomains.domainId), asc(assessmentSubdomains.sortOrder)),
      db.select().from(lbiAgeBands).orderBy(asc(lbiAgeBands.sortOrder)),
      db.select({ count: count() }).from(psychometricQuestions).where(eq(psychometricQuestions.isActive, true)),
    ]);
    res.json({
      domains: domainRows, subdomains: subdomainRows,
      ageBands: ageBandRows, totalQuestions: qCountResult[0]?.count || 0,
    });
  } catch (err: any) {
    console.error('[GET /admin/psychometric/config]', err.message);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// GET /api/admin/psychometric/questions — list questions with filters
router.get('/psychometric/questions', async (req, res) => {
  try {
    const { domainId, ageBandId, subdomain, search, limit = '50', offset = '0' } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (domainId) { params.push(domainId); conditions.push(`q.domain_code = (SELECT domain_code FROM assessment_domains WHERE id = $${params.length})`); }
    if (ageBandId) { params.push(ageBandId); conditions.push(`q.age_band_code = $${params.length}`); }
    if (subdomain) { params.push(subdomain); conditions.push(`q.subdomain_code = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`q.question_text ILIKE $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Number(limit), Number(offset));

    const result = await query(`
      SELECT q.* FROM psychometric_questions q ${where}
      ORDER BY q.domain_code, q.subdomain_code, q.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countResult = await query(`SELECT COUNT(*)::int AS total FROM psychometric_questions q ${where}`, params.slice(0, -2));

    res.json({ questions: result.rows, total: countResult.rows[0]?.total || 0 });
  } catch (err: any) {
    console.error('[GET /admin/psychometric/questions]', err.message);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// PATCH /api/admin/psychometric/questions/:id — update a question
router.patch('/psychometric/questions/:id', async (req, res) => {
  try {
    const { questionText, domainCode, subdomainCode, ageBandCode, questionType, reverseScored, difficulty, isActive } = req.body;
    const result = await query(`
      UPDATE psychometric_questions SET
        question_text  = COALESCE($2, question_text),
        domain_code    = COALESCE($3, domain_code),
        subdomain_code = COALESCE($4, subdomain_code),
        age_band_code  = COALESCE($5, age_band_code),
        question_type  = COALESCE($6, question_type),
        reverse_scored = COALESCE($7, reverse_scored),
        difficulty     = COALESCE($8, difficulty),
        is_active      = COALESCE($9, is_active),
        updated_at     = NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id, questionText, domainCode, subdomainCode, ageBandCode, questionType, reverseScored, difficulty, isActive]);
    if (!result.rows.length) return res.status(404).json({ error: 'Question not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[PATCH /admin/psychometric/questions/:id]', err.message);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// POST /api/admin/psychometric/questions/bulk — bulk upload via JSON array
router.post('/psychometric/questions/bulk', async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions array is required' });
    }

    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || !q.domainCode || !q.ageBandCode) {
        errors.push(`Row ${i + 1}: missing required fields (questionText, domainCode, ageBandCode)`);
        continue;
      }
      try {
        const code = q.questionCode || `PSY-${q.domainCode}-${q.ageBandCode}-${Date.now()}-${i}`;
        await query(`
          INSERT INTO psychometric_questions
            (question_code, domain_code, subdomain_code, age_band_code, question_type,
             question_text, reverse_scored, difficulty)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (question_code) DO UPDATE SET
            question_text = EXCLUDED.question_text,
            domain_code = EXCLUDED.domain_code,
            updated_at = NOW()
        `, [code, q.domainCode, q.subdomainCode || null, q.ageBandCode,
            q.questionType || 'likert', q.questionText,
            q.reverseScored || false, q.difficulty || 'medium']);
        inserted++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }

    res.json({ inserted, total: questions.length, errors: errors.slice(0, 10) });
  } catch (err: any) {
    console.error('[POST /admin/psychometric/questions/bulk]', err.message);
    res.status(500).json({ error: 'Bulk upload failed' });
  }
});

// POST /api/admin/seed-psychometric-data — seed default question templates per domain
router.post('/seed-psychometric-data', async (_req, res) => {
  try {
    const domains = await db.select({
      id: assessmentDomains.id, domain_code: assessmentDomains.domainCode,
      domain_name: assessmentDomains.domainName,
    }).from(assessmentDomains).orderBy(asc(assessmentDomains.id));
    const subdomains = await db.select({
      id: assessmentSubdomains.id, domain_id: assessmentSubdomains.domainId,
      subdomain_name: assessmentSubdomains.subdomainName,
    }).from(assessmentSubdomains).orderBy(asc(assessmentSubdomains.domainId), asc(assessmentSubdomains.sortOrder));
    const ageBands = ['A', 'B', 'C', 'D', 'E', 'E1'];

    let seeded = 0;
    for (const d of domains) {
      const domainSubs = subdomains.filter((s: any) => s.domain_id === d.id);
      for (const sub of domainSubs) {
        for (const band of ageBands) {
          const code = `PSY-${d.domain_code}-${sub.id}-${band}`;
          const text = `How well does the following describe you in the area of "${sub.subdomain_name}" (${d.domain_name})?`;
          try {
            await query(`
              INSERT INTO psychometric_questions (question_code, domain_id, domain_code, subdomain_id, subdomain_code, age_band_code, question_text)
              VALUES ($1,$2,$3,$4,$5,$6,$7)
              ON CONFLICT (question_code) DO NOTHING
            `, [code, d.id, d.domain_code, sub.id, sub.id, band, text]);
            seeded++;
          } catch { /* skip conflicts */ }
        }
      }
    }

    res.json({ message: `Seeded ${seeded} psychometric question templates across ${domains.length} domains and ${ageBands.length} age bands` });
  } catch (err: any) {
    console.error('[POST /admin/seed-psychometric-data]', err.message);
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

// GET /api/admin/exam-ready — exam-ready stats for dashboard
router.get('/exam-ready', async (_req, res) => {
  try {
    const [qStats, attemptStats] = await Promise.all([
      db.select({ total: count() }).from(psychometricQuestions).where(eq(psychometricQuestions.isActive, true)),
      query(`
        SELECT COUNT(*)::int AS total_attempts,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS this_month,
          ROUND(AVG(overall_score)::numeric, 1) AS avg_score,
          ROUND((COUNT(*) FILTER (WHERE readiness_level = 'High')::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1) AS pass_rate
        FROM exam_ready_reports WHERE status = 'ready'
      `),
    ]);
    const a = (attemptStats as any).rows[0] || {};
    res.json({
      exams: [],
      stats: {
        total: qStats[0]?.total || 0,
        thisMonth: a.this_month || 0,
        avgScore: Number(a.avg_score) || 0,
        passRate: Number(a.pass_rate) || 0,
        subjects: [],
      },
    });
  } catch (err: any) {
    console.error('[GET /admin/exam-ready]', err.message);
    res.json({ exams: [], stats: { total: 0, thisMonth: 0, avgScore: 0, passRate: 0, subjects: [] } });
  }
});

// ════════════════════════════════════════════════════════════════════
// ── DYNAMIC SCORING CONFIG API ────────────────────────────────────
// ════════════════════════════════════════════════════════════════════

// ── Scoring Modules CRUD ──

router.get('/scoring/modules', async (_req, res) => {
  try {
    const rows = await db.select().from(scoringModules).orderBy(asc(scoringModules.sortOrder));
    res.json(rowsToSnake(rows));
  } catch (err: any) {
    console.error('[GET /admin/scoring/modules]', err.message);
    res.status(500).json({ error: 'Failed to fetch scoring modules' });
  }
});

router.put('/scoring/modules', async (req, res) => {
  try {
    const { modules } = req.body;
    if (!Array.isArray(modules)) return res.status(400).json({ error: 'modules array required' });

    for (const m of modules) {
      await db.insert(scoringModules).values({
        code: m.code, name: m.name, formula: m.formula, weights: m.weights,
        bands: m.bands, color: m.color || '#344E86', sortOrder: m.sort_order || 0,
        status: m.status || 'Active',
      }).onConflictDoUpdate({
        target: scoringModules.code,
        set: {
          name: m.name, formula: m.formula, weights: m.weights,
          bands: m.bands, color: m.color || '#344E86', sortOrder: m.sort_order || 0,
          status: m.status || 'Active', updatedAt: new Date(),
        },
      });
    }
    const updatedRows = await db.select().from(scoringModules).orderBy(asc(scoringModules.sortOrder));
    res.json(rowsToSnake(updatedRows));
  } catch (err: any) {
    console.error('[PUT /admin/scoring/modules]', err.message);
    res.status(500).json({ error: 'Failed to save scoring modules' });
  }
});

// ── Domain Config CRUD ──

router.get('/scoring/domains', async (_req, res) => {
  try {
    const rows = await db.select().from(scoringDomainConfig).orderBy(asc(scoringDomainConfig.sortOrder));
    res.json(rowsToSnake(rows));
  } catch (err: any) {
    console.error('[GET /admin/scoring/domains]', err.message);
    res.status(500).json({ error: 'Failed to fetch domain config' });
  }
});

router.put('/scoring/domains', async (req, res) => {
  try {
    const { domains } = req.body;
    if (!Array.isArray(domains)) return res.status(400).json({ error: 'domains array required' });

    // Replace all rows
    await db.delete(scoringDomainConfig);
    for (let i = 0; i < domains.length; i++) {
      const d = domains[i];
      await db.insert(scoringDomainConfig).values({
        domain: d.domain,
        subdomain: d.subdomain,
        moduleCode: d.module_code || d.module,
        ageBandScope: d.age_band_scope || d.band,
        weightPercent: d.weight_percent ?? d.weight,
        status: d.status || 'Active',
        sortOrder: i + 1,
      });
    }
    const rows = await db.select().from(scoringDomainConfig).orderBy(asc(scoringDomainConfig.sortOrder));
    res.json(rowsToSnake(rows));
  } catch (err: any) {
    console.error('[PUT /admin/scoring/domains]', err.message);
    res.status(500).json({ error: 'Failed to save domain config' });
  }
});

// ── Age Band Norms CRUD ──

router.get('/scoring/norms', async (_req, res) => {
  try {
    const rows = await db.select().from(scoringAgeBandNorms).orderBy(asc(scoringAgeBandNorms.id));
    res.json(rowsToSnake(rows));
  } catch (err: any) {
    console.error('[GET /admin/scoring/norms]', err.message);
    res.status(500).json({ error: 'Failed to fetch norms' });
  }
});

router.put('/scoring/norms', async (req, res) => {
  try {
    const { norms } = req.body;
    if (!Array.isArray(norms)) return res.status(400).json({ error: 'norms array required' });

    for (const n of norms) {
      const normValues = {
        band: n.band, grades: n.grades, ages: n.ages,
        p20: String(n.p20), p40: String(n.p40), p60: String(n.p60), p80: String(n.p80),
        sampleSize: n.sample_size ?? n.n ?? 0,
        standardError: String(n.standard_error ?? n.se ?? 0),
      };
      await db.insert(scoringAgeBandNorms).values(normValues).onConflictDoUpdate({
        target: scoringAgeBandNorms.band,
        set: { ...normValues, updatedAt: new Date() },
      });
    }
    const updatedNorms = await db.select().from(scoringAgeBandNorms).orderBy(asc(scoringAgeBandNorms.id));
    res.json(rowsToSnake(updatedNorms));
  } catch (err: any) {
    console.error('[PUT /admin/scoring/norms]', err.message);
    res.status(500).json({ error: 'Failed to save norms' });
  }
});

// ── Formula Parameters CRUD ──

router.get('/scoring/params', async (_req, res) => {
  try {
    const rows = await db.select().from(scoringFormulaParams).orderBy(asc(scoringFormulaParams.moduleCode), asc(scoringFormulaParams.id));
    res.json(rowsToSnake(rows));
  } catch (err: any) {
    console.error('[GET /admin/scoring/params]', err.message);
    res.status(500).json({ error: 'Failed to fetch params' });
  }
});

router.put('/scoring/params', async (req, res) => {
  try {
    const { params } = req.body;
    if (!Array.isArray(params)) return res.status(400).json({ error: 'params array required' });

    for (const p of params) {
      await db.insert(scoringFormulaParams).values({
        moduleCode: p.module_code, paramKey: p.param_key,
        label: p.label, value: String(p.value), editable: p.editable !== false,
      }).onConflictDoUpdate({
        target: [scoringFormulaParams.moduleCode, scoringFormulaParams.paramKey],
        set: { label: p.label, value: String(p.value), editable: p.editable !== false, updatedAt: new Date() },
      });
    }
    const updatedParams = await db.select().from(scoringFormulaParams).orderBy(asc(scoringFormulaParams.moduleCode), asc(scoringFormulaParams.id));
    res.json(rowsToSnake(updatedParams));
  } catch (err: any) {
    console.error('[PUT /admin/scoring/params]', err.message);
    res.status(500).json({ error: 'Failed to save params' });
  }
});

// ── Full scoring config (single fetch for scoring engine) ──

router.get('/scoring/config', async (_req, res) => {
  try {
    const [modules, domains, norms, params] = await Promise.all([
      db.select().from(scoringModules).orderBy(asc(scoringModules.sortOrder)),
      db.select().from(scoringDomainConfig).orderBy(asc(scoringDomainConfig.sortOrder)),
      db.select().from(scoringAgeBandNorms).orderBy(asc(scoringAgeBandNorms.id)),
      db.select().from(scoringFormulaParams).orderBy(asc(scoringFormulaParams.moduleCode), asc(scoringFormulaParams.id)),
    ]);
    res.json({ modules: rowsToSnake(modules), domains: rowsToSnake(domains), norms: rowsToSnake(norms), params: rowsToSnake(params) });
  } catch (err: any) {
    console.error('[GET /admin/scoring/config]', err.message);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// ── Publish config version ──

router.post('/scoring/publish', async (req, res) => {
  try {
    const { version, notes } = req.body;
    const userId = (req as any).user?.userId;
    const result = await db.insert(scoringConfigVersions).values({
      version: version || `v${Date.now()}`,
      status: 'approved',
      notes: notes || '',
      publishedBy: userId,
      publishedAt: new Date(),
    }).returning();

    // Invalidate scoring config cache so scoring engine picks up new config
    try {
      const { invalidateScoringConfigCache } = await import('../scoring/configLoader.js');
      invalidateScoringConfigCache();
    } catch { /* ignore if module not available */ }

    res.json(rowToSnake(result[0]));
  } catch (err: any) {
    console.error('[POST /admin/scoring/publish]', err.message);
    res.status(500).json({ error: 'Failed to publish config' });
  }
});

router.get('/scoring/versions', async (_req, res) => {
  try {
    const rows = await db.select().from(scoringConfigVersions).orderBy(desc(scoringConfigVersions.createdAt)).limit(20);
    res.json(rowsToSnake(rows));
  } catch (err: any) {
    console.error('[GET /admin/scoring/versions]', err.message);
    res.json([]);
  }
});

// ── Engine stats (live counts for the header dashboard) ──────────────────
router.get('/scoring/engine-stats', async (_req, res) => {
  try {
    const { rows } = await query<any>(`
      SELECT
        (SELECT COUNT(*) FROM lbi_modules      WHERE is_active = true)                          AS modules,
        (SELECT COUNT(*) FROM lbi_age_bands)                                                    AS age_bands,
        (SELECT COUNT(*) FROM lbi_domains      WHERE is_active = true AND is_ai_layer = false)  AS domains,
        (SELECT COUNT(*) FROM lbi_subdomains   WHERE is_active = true)                          AS subdomains,
        (SELECT COUNT(*) FROM lbi_domain_correlations)                                          AS correlations,
        (SELECT COUNT(*) FROM subscription_packages WHERE is_active = true)                     AS products,
        (SELECT COUNT(*) FROM subscription_packages WHERE is_active = true AND jsonb_array_length(domain_config) > 0) AS products_configured
    `);
    const r = rows[0];
    res.json({
      modules:             Number(r.modules),
      ageBands:            Number(r.age_bands),
      domains:             Number(r.domains),
      subdomains:          Number(r.subdomains),
      correlations:        Number(r.correlations),
      products:            Number(r.products),
      productsConfigured:  Number(r.products_configured),
      percentileTiers:     5,
    });
  } catch (err: any) {
    console.error('[GET /admin/scoring/engine-stats]', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Assessment products for Domain & Subdomain weight config ──────────────
router.get('/scoring/assessment-products', async (_req, res) => {
  try {
    const { rows } = await query<any>(`
      SELECT id, product_name, pkg_status, age_band_codes, question_count, price, domain_config, sort_order
      FROM subscription_packages
      WHERE is_active = true
      ORDER BY sort_order, created_at
    `);
    res.json({
      products: rows.map((r: any) => ({
        id: r.id,
        name: r.product_name,
        status: r.pkg_status,
        ageBands: r.age_band_codes || [],
        questionCount: r.question_count,
        price: r.price,
        domainConfig: Array.isArray(r.domain_config) ? r.domain_config : [],
      })),
    });
  } catch (err: any) {
    console.error('[GET /admin/scoring/assessment-products]', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

router.put('/scoring/assessment-products/:id/domain-config', async (req, res) => {
  try {
    const { id } = req.params;
    const { domainConfig } = req.body;
    if (!Array.isArray(domainConfig)) return res.status(400).json({ error: 'domainConfig must be an array' });
    await query(
      `UPDATE subscription_packages SET domain_config = $1::jsonb, updated_at = now() WHERE id = $2`,
      [JSON.stringify(domainConfig), id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[PUT /admin/scoring/assessment-products/:id/domain-config]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/scoring/modules-catalog', async (_req, res) => {
  try {
    // Fetch all active modules
    const { rows: moduleRows } = await query<any>(`
      SELECT module_code, module_name, domain_codes, sort_order
      FROM lbi_modules WHERE is_active = true ORDER BY sort_order
    `);
    // Fetch all domains with their subdomains in one query
    const { rows: domainRows } = await query<any>(`
      SELECT d.domain_code, d.domain_name, d.weight_pct, d.is_ai_layer,
        COALESCE(json_agg(
          json_build_object(
            'code', s.subdomain_code,
            'name', s.subdomain_name,
            'weight', s.weight_within_domain
          ) ORDER BY s.sort_order
        ) FILTER (WHERE s.id IS NOT NULL), '[]') AS subdomains
      FROM lbi_domains d
      LEFT JOIN lbi_subdomains s ON s.domain_code = d.domain_code AND s.is_active = true
      WHERE d.is_active = true
      GROUP BY d.domain_code, d.domain_name, d.weight_pct, d.is_ai_layer, d.sort_order
      ORDER BY d.sort_order
    `);
    const { rows: correlations } = await query<any>(`
      SELECT subdomain_a_code, subdomain_a_label, subdomain_b_code, subdomain_b_label,
             correlation_label, domain_a_code, domain_b_code
      FROM lbi_domain_correlations ORDER BY sort_order
    `);
    const { rows: bands } = await query<any>(`
      SELECT band_code, label, age_min, age_max FROM lbi_age_bands ORDER BY sort_order
    `);

    // Build a domain lookup map
    const domainMap: Record<string, any> = {};
    domainRows.forEach((d: any) => {
      domainMap[d.domain_code] = {
        code: d.domain_code,
        name: d.domain_name,
        weightPct: d.weight_pct ? Number(d.weight_pct) : null,
        isAiLayer: d.is_ai_layer,
        subdomains: d.subdomains || [],
      };
    });

    // Build module-centric response: each module knows its domains + each domain's subdomains
    const modules = moduleRows.map((m: any) => ({
      moduleCode: m.module_code,
      moduleName: m.module_name,
      domains: ((m.domain_codes || []) as string[])
        .filter((code: string) => domainMap[code])
        .map((code: string) => domainMap[code]),
    }));

    res.json({
      modules,
      ageBands: bands.map((b: any) => ({ code: b.band_code, label: b.label })),
      correlations,
    });
  } catch (err: any) {
    console.error('[GET /admin/scoring/modules-catalog]', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ============================================
// USER ADMIN — extra per-user endpoints
// ============================================

// Create a new user
router.post('/users', async (req, res) => {
  try {
    const { full_name, email, mobile, role = 'parent', password, is_active = true, is_verified = false } = req.body;
    if (!email && !mobile) { res.status(400).json({ error: 'EMAIL_OR_MOBILE_REQUIRED' }); return; }
    let passwordHash: string | null = null;
    if (password) {
      const bcrypt = await import('bcryptjs');
      passwordHash = await bcrypt.default.hash(password, 10);
    }
    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const result = await query(
      `INSERT INTO users (id, full_name, email, mobile, role, roles, is_active, is_verified, password_hash, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,NOW(),NOW())
       RETURNING id, full_name, email, mobile, role, is_active, is_verified, created_at`,
      [id, full_name ?? null, email ?? null, mobile ?? null, role, JSON.stringify([role]), is_active, is_verified, passwordHash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') { res.status(409).json({ error: 'EMAIL_EXISTS' }); return; }
    console.error('[POST /admin/users]', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Export users as CSV
router.get('/users/export', async (req, res) => {
  try {
    const { role, is_active, search } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;
    if (role && role !== 'all') { conditions.push(`(role = $${paramIdx} OR roles::text LIKE '%' || $${paramIdx} || '%')`); params.push(role); paramIdx++; }
    if (is_active !== undefined && is_active !== 'all') { conditions.push(`is_active = $${paramIdx}`); params.push(is_active === 'true'); paramIdx++; }
    if (search) { conditions.push(`(full_name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR mobile ILIKE $${paramIdx})`); params.push(`%${search}%`); paramIdx++; }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await query(
      `SELECT id, full_name, email, mobile, role, is_active, is_verified, created_at FROM users ${where} ORDER BY created_at DESC LIMIT 5000`,
      params
    );
    const header = ['ID', 'Full Name', 'Email', 'Mobile', 'Role', 'Active', 'Verified', 'Joined'];
    const lines = [header.join(','), ...rows.map((r: any) => [
      r.id, `"${(r.full_name ?? '').replace(/"/g, '""')}"`, r.email ?? '', r.mobile ?? '',
      r.role, r.is_active, r.is_verified, new Date(r.created_at).toISOString().slice(0, 10),
    ].join(','))];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(lines.join('\n'));
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// User notifications
router.get('/users/:id/notifications', async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, parseInt(limit as string));
    const offset = (pageNum - 1) * limitNum;
    const [rows, countRow] = await Promise.all([
      query(
        `SELECT id, category, title, message, type, priority, is_read, is_email_sent, created_at
         FROM notifications WHERE recipient_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [req.params.id, limitNum, offset]
      ),
      query(`SELECT COUNT(*) as count FROM notifications WHERE recipient_id = $1`, [req.params.id]),
    ]);
    res.json({ notifications: rows.rows, total: parseInt((countRow.rows[0] as any).count), page: pageNum });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// KPI summary (top-level stats)
router.get('/users/kpi', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        COUNT(*) FILTER (WHERE TRUE) AS total,
        COUNT(*) FILTER (WHERE is_active = true) AS active,
        COUNT(*) FILTER (WHERE is_active = false) AS inactive,
        COUNT(*) FILTER (WHERE is_verified = true) AS verified,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_this_month,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_this_week
      FROM users
    `);
    const kpi = rows[0] as any;
    // Role breakdown
    const { rows: roles } = await query(`SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC`);
    res.json({
      total: parseInt(kpi.total),
      active: parseInt(kpi.active),
      inactive: parseInt(kpi.inactive),
      verified: parseInt(kpi.verified),
      newThisMonth: parseInt(kpi.new_this_month),
      newThisWeek: parseInt(kpi.new_this_week),
      byRole: roles.map((r: any) => ({ role: r.role, count: parseInt(r.count) })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Bulk status update
router.post('/users/bulk-status', async (req, res) => {
  try {
    const { ids, is_active } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'IDS_REQUIRED' }); return; }
    const placeholders = ids.map((_: any, i: number) => `$${i + 2}`).join(',');
    await query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id IN (${placeholders})`,
      [is_active, ...ids]
    );
    res.json({ updated: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============================================
// USER ADMIN — aggregated stats for a single user
// ============================================
router.get('/users/:id/admin-summary', async (req, res) => {
  try {
    const { id } = req.params;

    const [userRow, lbiRows, subRows, parentSubRow, assessmentRow] = await Promise.all([
      // Core user record
      query(`
        SELECT id, full_name, email, mobile, username, role, roles,
               is_active, is_verified, profile_picture, created_at, updated_at
        FROM users WHERE id = $1
      `, [id]),

      // LBI sessions (via children)
      query(`
        SELECT ls.id, ls.status, ls.started_at, ls.completed_at,
               ls.raw_score, ls.max_score, ls.percentage_score,
               ls.total_questions, ls.questions_answered,
               lm.name as module_name, lb.label as age_band,
               c.name as child_name
        FROM lbi_sessions ls
        JOIN children c ON c.id = ls.child_id
        JOIN lbi_modules lm ON lm.id = ls.module_id
        JOIN lbi_age_bands lb ON lb.id = lm.age_band_id
        WHERE c.parent_id = $1
        ORDER BY ls.created_at DESC
        LIMIT 20
      `, [id]),

      // Student subscriptions (via children)
      query(`
        SELECT ss.id, ss.status, ss.purchase_date, ss.expiry_date,
               ss.start_date, ss.notes,
               sp.name as package_name, sp.price as package_price,
               sp.currency, c.name as child_name
        FROM student_subscriptions ss
        JOIN children c ON c.id = ss.child_id
        JOIN subscription_packages sp ON sp.id = ss.package_id
        WHERE c.parent_id = $1
        ORDER BY ss.created_at DESC
        LIMIT 20
      `, [id]),

      // Parent subscription (direct)
      query(`
        SELECT plan, status, amount, currency, billing_cycle,
               started_at, expires_at, cancelled_at
        FROM parent_subscriptions WHERE parent_id = $1
      `, [id]),

      // Exam ready attempts (user_id direct or via children)
      query(`
        SELECT ea.id, ea.status, ea.student_name, ea.plan_id, ea.grade, ea.board,
               ea.created_at, ea.updated_at,
               er.overall_score, er.readiness_level, er.summary, er.completed_at as report_completed_at
        FROM exam_ready_attempts ea
        LEFT JOIN exam_ready_reports er ON er.attempt_id = ea.id
        WHERE ea.user_id = $1
           OR ea.child_id IN (SELECT id FROM children WHERE parent_id = $1)
        ORDER BY ea.created_at DESC
        LIMIT 10
      `, [id]).catch(() => ({ rows: [] })),
    ]);

    if (!userRow.rows.length) { res.status(404).json({ error: 'USER_NOT_FOUND' }); return; }

    const user = userRow.rows[0] as any;

    res.json({
      user,
      lbi_sessions: lbiRows.rows,
      subscriptions: {
        parent: parentSubRow.rows[0] ?? null,
        student: subRows.rows,
      },
      exam_ready: assessmentRow.rows,
    });
  } catch (err: any) {
    console.error('[GET /admin/users/:id/admin-summary]', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
