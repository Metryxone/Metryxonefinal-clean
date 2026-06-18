import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/drizzle.js';
import { children, parentSubscriptions, parentBriefings, studyPlans, wellnessCheckins } from '../db/schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { trigger as scenarioTrigger } from '../notifications/scenarioEngine.js';

const router = Router();

const PLAN_FEATURES: Record<string, string[]> = {
  basic: [
    'lbi_assessment', 'basic_reports', 'single_child', 'wellness_basic',
    'scholarship_alerts', 'weekly_briefing',
  ],
  family: [
    'lbi_assessment', 'all_assessments', 'multi_child', 'detailed_reports',
    'wellness_full', 'career_compass', 'study_plan', 'scholarship_alerts',
    'weekly_briefing', 'peer_benchmarking', 'stress_alerts',
  ],
  premium: [
    'lbi_assessment', 'all_assessments', 'unlimited_children', 'detailed_reports',
    'ai_insights', 'wellness_full', 'career_compass', 'study_plan',
    'scholarship_alerts', 'weekly_briefing', 'peer_benchmarking', 'stress_alerts',
    'mentor_access', 'tutor_matching', 'priority_support', 'annual_portfolio',
    'school_connect', 'parent_coaching',
  ],
};

const PLAN_PRICES: Record<string, number> = { basic: 999, family: 1999, premium: 3999 };

function mapSubscription(row: typeof parentSubscriptions.$inferSelect) {
  const plan = String(row.plan ?? 'basic');
  return {
    id: row.id,
    parentId: row.parentId,
    plan,
    status: row.status,
    features: PLAN_FEATURES[plan] ?? PLAN_FEATURES.basic,
    billingCycle: row.billingCycle,
    amount: row.amount,
    currency: row.currency,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(parentSubscriptions)
      .where(eq(parentSubscriptions.parentId, req.user!.id));

    if (!rows.length) {
      // Auto-create basic subscription for new parents
      const created = await db
        .insert(parentSubscriptions)
        .values({
          parentId: req.user!.id,
          plan: 'basic',
          status: 'trial',
          amount: 999,
          expiresAt: sql`NOW() + INTERVAL '30 days'`,
        })
        .onConflictDoUpdate({
          target: parentSubscriptions.parentId,
          set: { updatedAt: sql`NOW()` },
        })
        .returning();

      // Fire subscription.trial_ending scenario notification — non-blocking
      const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();
      scenarioTrigger('subscription.trial_ending', {
        recipientId: String(req.user!.id),
        endDate: trialEnd,
        daysLeft: 30,
      }).catch(e => console.warn('[Subscription] Trial notification failed (non-fatal):', e));

      return res.json(mapSubscription(created[0]));
    }
    res.json(mapSubscription(rows[0]));
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

const upgradeSchema = z.object({
  plan: z.enum(['basic', 'family', 'premium']),
  billingCycle: z.enum(['monthly', 'annual']).optional(),
});

router.post('/upgrade', requireAuth, validate(upgradeSchema), async (req, res) => {
  try {
    const { plan, billingCycle = 'monthly' } = req.body;
    const amount = billingCycle === 'annual'
      ? Math.round(PLAN_PRICES[plan] * 12 * 0.8)
      : PLAN_PRICES[plan];

    const expiresAt = billingCycle === 'annual'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const rows = await db
      .insert(parentSubscriptions)
      .values({
        parentId: req.user!.id,
        plan,
        status: 'active',
        amount,
        billingCycle,
        expiresAt: new Date(expiresAt),
      })
      .onConflictDoUpdate({
        target: parentSubscriptions.parentId,
        set: {
          plan,
          status: 'active',
          amount,
          billingCycle,
          expiresAt: new Date(expiresAt),
          updatedAt: sql`NOW()`,
        },
      })
      .returning();

    // Fire payment.success scenario notification — non-blocking
    scenarioTrigger('payment.success', {
      recipientId: String(req.user!.id),
      amount: `₹${amount}`,
      planName: plan.charAt(0).toUpperCase() + plan.slice(1),
    }).catch(e => console.warn('[Subscription] Payment notification failed (non-fatal):', e));

    res.json({ message: `Upgraded to ${plan} plan`, subscription: mapSubscription(rows[0]) });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/features', requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({ plan: parentSubscriptions.plan })
      .from(parentSubscriptions)
      .where(
        and(
          eq(parentSubscriptions.parentId, req.user!.id),
          inArray(parentSubscriptions.status, ['active', 'trial'])
        )
      );

    const plan = rows[0]?.plan ?? 'basic';
    res.json({ plan, features: PLAN_FEATURES[plan] ?? PLAN_FEATURES.basic });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/plans', async (_req, res) => {
  res.json([
    {
      id: 'basic', name: 'Basic', price: 999, annualPrice: 9590, currency: 'INR', period: 'month',
      tagline: 'Perfect for getting started',
      features: ['1 Child Profile', 'LBI™ Assessment', 'Basic Progress Reports', 'Wellness Check-ins', 'Scholarship Alerts', 'Weekly Briefing'],
      featureKeys: PLAN_FEATURES.basic,
      recommended: false,
    },
    {
      id: 'family', name: 'Family', price: 1999, annualPrice: 19190, currency: 'INR', period: 'month',
      tagline: 'Most popular for families',
      features: ['Up to 3 Children', 'All Assessments', 'Detailed AI Reports', 'Career Compass™', 'Personalised Study Plans', 'Stress & Burnout Alerts', 'Peer Benchmarking'],
      featureKeys: PLAN_FEATURES.family,
      recommended: true,
    },
    {
      id: 'premium', name: 'Premium', price: 3999, annualPrice: 38390, currency: 'INR', period: 'month',
      tagline: 'Full intelligence for serious families',
      features: ['Unlimited Children', 'Mentor Access', 'Tutor Matching', 'Annual Portfolio Report', 'School Connect', 'Priority Support', 'Parent Coaching Sessions'],
      featureKeys: PLAN_FEATURES.premium,
      recommended: false,
    },
  ]);
});

// Weekly briefing generator
router.get('/briefing/:childId', requireAuth, async (req, res) => {
  try {
    const { childId } = req.params;
    const childRows = await db
      .select()
      .from(children)
      .where(and(eq(children.id, childId), eq(children.parentId, req.user!.id)));

    if (!childRows.length) { res.status(404).json({ error: 'CHILD_NOT_FOUND' }); return; }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekOf = weekStart.toISOString().split('T')[0];

    // Check for existing briefing this week
    const existing = await db
      .select()
      .from(parentBriefings)
      .where(
        and(
          eq(parentBriefings.parentId, req.user!.id),
          eq(parentBriefings.childId, childId),
          eq(parentBriefings.weekOf, weekOf)
        )
      );

    if (existing.length) {
      return res.json({
        weekOf: existing[0].weekOf,
        childName: childRows[0].name,
        highlights: existing[0].highlights,
        actionItems: existing[0].actionItems,
        wellnessSummary: existing[0].wellnessSummary,
        generatedAt: existing[0].generatedAt,
      });
    }

    // Get wellness data for briefing
    const wellness = await db
      .select({
        avgStress: sql<string>`avg(${wellnessCheckins.stressLevel})::numeric(3,1)`,
        avgEnergy: sql<string>`avg(${wellnessCheckins.energy})::numeric(3,1)`,
        checkCount: sql<string>`count(*)`,
      })
      .from(wellnessCheckins)
      .where(
        and(
          eq(wellnessCheckins.childId, childId),
          sql`${wellnessCheckins.checkedAt} > NOW() - INTERVAL '7 days'`
        )
      );

    const w = wellness[0];

    const c = childRows[0];
    const highlights = [
      `${c.name}'s weekly learning journey summary for ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      parseInt(w.checkCount) > 0
        ? `Average stress level this week: ${w.avgStress}/10 — ${parseFloat(w.avgStress) <= 4 ? 'Healthy range ✓' : parseFloat(w.avgStress) <= 6 ? 'Moderate — monitor closely' : 'High — intervention recommended'}`
        : 'No wellness check-ins recorded this week — start tracking today',
      c.grade ? `Currently in ${c.grade} ${c.board ? `(${c.board})` : ''}` : 'Add grade details for personalized insights',
    ];

    const actionItems = [
      parseFloat(w.avgStress ?? '6') > 6
        ? { priority: 'high', action: `Schedule a relaxed conversation with ${c.name} about what\'s causing stress` }
        : { priority: 'low', action: `Keep up the positive momentum — acknowledge ${c.name}\'s effort this week` },
      { priority: 'medium', action: `Review ${c.name}\'s study schedule for the coming week` },
      c.consentGiven
        ? { priority: 'low', action: 'Check LBI insights panel for this week\'s learning behaviour patterns' }
        : { priority: 'medium', action: `Grant LBI consent for ${c.name} to unlock detailed learning behaviour insights` },
    ];

    const wellnessSummary = {
      avgStress: w.avgStress ?? null,
      avgEnergy: w.avgEnergy ?? null,
      checkinsCount: parseInt(String(w.checkCount)),
      trend: !w.avgStress ? 'no_data' : parseFloat(w.avgStress) <= 4 ? 'healthy' : parseFloat(w.avgStress) <= 6 ? 'moderate' : 'concerning',
    };

    const rows = await db
      .insert(parentBriefings)
      .values({
        parentId: req.user!.id,
        childId,
        weekOf,
        highlights: JSON.stringify(highlights),
        actionItems: JSON.stringify(actionItems),
        wellnessSummary: JSON.stringify(wellnessSummary),
      })
      .onConflictDoUpdate({
        target: [parentBriefings.parentId, parentBriefings.childId, parentBriefings.weekOf],
        set: { generatedAt: sql`NOW()` },
      })
      .returning();

    res.json({ weekOf, childName: c.name, highlights, actionItems, wellnessSummary, generatedAt: rows[0].generatedAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Study plan generator
router.get('/study-plan/:childId', requireAuth, async (req, res) => {
  try {
    const { childId } = req.params;
    const childRows = await db
      .select()
      .from(children)
      .where(and(eq(children.id, childId), eq(children.parentId, req.user!.id)));

    if (!childRows.length) { res.status(404).json({ error: 'CHILD_NOT_FOUND' }); return; }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekOf = weekStart.toISOString().split('T')[0];

    const existing = await db
      .select()
      .from(studyPlans)
      .where(and(eq(studyPlans.childId, childId), eq(studyPlans.weekStart, weekOf)));

    if (existing.length) {
      return res.json({ weekOf, childName: childRows[0].name, plan: existing[0].plan, generatedAt: existing[0].generatedAt });
    }

    const c = childRows[0];
    const studyHours = parseFloat(String(c.studyHoursPerDay ?? 3));
    const subjects = (c.favoriteSubjects as string[]) ?? ['Mathematics', 'Science', 'English'];

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const plan: Record<string, unknown> = { weekOf, totalHours: studyHours * 6, subjects: {} };

    const dayPlans = days.map(day => ({
      day,
      sessions: subjects.slice(0, 3).map((subj, i) => ({
        subject: subj,
        duration: Math.round(studyHours / 3 * 60),
        time: i === 0 ? 'Morning (7–8am)' : i === 1 ? 'Afternoon (4–5pm)' : 'Evening (7–8pm)',
        type: day === 'Saturday' ? 'Revision' : 'Study',
        tip: i === 0 ? 'Start with your strongest subject to build momentum' : i === 1 ? 'Take a 10-minute break every 45 minutes' : 'Review what you studied today before sleeping',
      })),
      totalMinutes: Math.round(studyHours * 60),
    }));

    plan.days = dayPlans;
    plan.weeklyGoals = [
      `Complete ${subjects[0] ?? 'Mathematics'} chapter revision`,
      'Attempt 2 practice tests',
      'Revise notes from previous week',
    ];
    plan.tips = [
      'Study in 45-minute focused blocks with 10-minute breaks (Pomodoro technique)',
      'Review notes within 24 hours of learning for better retention',
      'Get at least 8 hours of sleep — it consolidates memory',
    ];

    const rows = await db
      .insert(studyPlans)
      .values({
        childId,
        parentId: req.user!.id,
        weekStart: weekOf,
        plan: JSON.stringify(plan),
      })
      .onConflictDoUpdate({
        target: [studyPlans.childId, studyPlans.weekStart],
        set: {
          plan: JSON.stringify(plan),
          generatedAt: sql`NOW()`,
        },
      })
      .returning();

    res.json({ weekOf, childName: c.name, plan: rows[0].plan, generatedAt: rows[0].generatedAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
