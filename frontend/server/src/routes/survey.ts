import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/drizzle.js';
import { stakeholderObservations, parentObservations, children } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// ── Teacher / Counsellor observation submit ─────────────────────────────────
router.post('/stakeholder', requireAuth, async (req, res) => {
  try {
    const {
      childId, observerType, observerName, observerOrg, period,
      academicBehavior, emotionalBehavior, socialBehavior,
      concerns, strengths, recommendations, overallRating,
      followUpRequired, sharedWithParent,
    } = req.body;

    if (!childId || !observerType) {
      return res.status(400).json({ error: 'childId and observerType are required' });
    }

    const child = await db.select().from(children).where(eq(children.id, childId)).limit(1);
    if (!child.length) return res.status(404).json({ error: 'Child not found' });

    const [obs] = await db.insert(stakeholderObservations).values({
      childId,
      observerId: req.user?.id ?? null,
      observerType,
      observerName: observerName || req.user?.fullName || null,
      observerOrg: observerOrg || null,
      period: period || new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      academicBehavior: academicBehavior || {},
      emotionalBehavior: emotionalBehavior || {},
      socialBehavior: socialBehavior || {},
      concerns: concerns || null,
      strengths: strengths || null,
      recommendations: recommendations || null,
      overallRating: overallRating || null,
      followUpRequired: followUpRequired ?? false,
      sharedWithParent: sharedWithParent ?? false,
    }).returning();

    res.status(201).json(obs);
  } catch (err) {
    console.error('[Survey] stakeholder submit error:', err);
    res.status(500).json({ error: 'Failed to save observation' });
  }
});

// ── Fetch stakeholder observations for a child ─────────────────────────────
router.get('/stakeholder/:childId', requireAuth, async (req, res) => {
  try {
    const { childId } = req.params;
    const obs = await db
      .select()
      .from(stakeholderObservations)
      .where(eq(stakeholderObservations.childId, childId))
      .orderBy(desc(stakeholderObservations.createdAt));
    res.json(obs);
  } catch (err) {
    console.error('[Survey] stakeholder fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch observations' });
  }
});

// ── Parent observation submit ────────────────────────────────────────────────
router.post('/parent', requireAuth, async (req, res) => {
  try {
    const {
      childId, period,
      homeEnvironment, emotionalState, academicEngagement, physicalWellness,
      parentConcerns, notableChanges, supportNeeded, overallMood,
    } = req.body;

    if (!childId) return res.status(400).json({ error: 'childId is required' });

    const child = await db.select().from(children).where(eq(children.id, childId)).limit(1);
    if (!child.length) return res.status(404).json({ error: 'Child not found' });

    const [obs] = await db.insert(parentObservations).values({
      childId,
      parentId: req.user!.id,
      period: period || new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      homeEnvironment: homeEnvironment || {},
      emotionalState: emotionalState || {},
      academicEngagement: academicEngagement || {},
      physicalWellness: physicalWellness || {},
      parentConcerns: parentConcerns || null,
      notableChanges: notableChanges || null,
      supportNeeded: supportNeeded || null,
      overallMood: overallMood || 'good',
    }).returning();

    res.status(201).json(obs);
  } catch (err) {
    console.error('[Survey] parent submit error:', err);
    res.status(500).json({ error: 'Failed to save observation' });
  }
});

// ── Fetch parent observations for a child ────────────────────────────────────
router.get('/parent/:childId', requireAuth, async (req, res) => {
  try {
    const { childId } = req.params;
    const obs = await db
      .select()
      .from(parentObservations)
      .where(eq(parentObservations.childId, childId))
      .orderBy(desc(parentObservations.createdAt));
    res.json(obs);
  } catch (err) {
    console.error('[Survey] parent fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch observations' });
  }
});

export default router;
