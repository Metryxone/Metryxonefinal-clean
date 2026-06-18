import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/drizzle.js';
import { children, wellnessCheckins, scholarshipAlerts } from '../db/schema.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

const router = Router();

const checkinSchema = z.object({
  childId: z.string().min(1),
  stressLevel: z.number().int().min(1).max(10),
  mood: z.enum(['happy', 'calm', 'anxious', 'sad', 'excited', 'tired', 'frustrated', 'confident']),
  energy: z.number().int().min(1).max(10),
  focus: z.number().int().min(1).max(10),
  sleepHours: z.number().min(0).max(24).optional(),
  notes: z.string().max(500).optional(),
});

function computeFlags(data: { stressLevel: number; energy: number; focus: number; sleepHours?: number }) {
  const flags: string[] = [];
  if (data.stressLevel >= 8) flags.push('HIGH_STRESS');
  if (data.stressLevel >= 6 && data.stressLevel < 8) flags.push('ELEVATED_STRESS');
  if (data.energy <= 3) flags.push('LOW_ENERGY');
  if (data.focus <= 3) flags.push('LOW_FOCUS');
  if (data.sleepHours !== undefined && data.sleepHours < 6) flags.push('SLEEP_DEFICIT');
  return flags;
}

router.post('/checkin', requireAuth, validate(checkinSchema), async (req, res) => {
  try {
    const b = req.body;
    const child = await db.select({ id: children.id }).from(children)
      .where(and(eq(children.id, b.childId), eq(children.parentId, req.user!.id)));
    if (!child.length) { res.status(404).json({ error: 'CHILD_NOT_FOUND' }); return; }

    const flags = computeFlags({ stressLevel: b.stressLevel, energy: b.energy, focus: b.focus, sleepHours: b.sleepHours });

    const rows = await db.insert(wellnessCheckins)
      .values({
        childId: b.childId,
        parentId: req.user!.id,
        stressLevel: b.stressLevel,
        mood: b.mood,
        energy: b.energy,
        focus: b.focus,
        sleepHours: b.sleepHours?.toString() ?? null,
        notes: b.notes ?? null,
        flags: JSON.stringify(flags),
      })
      .returning();

    const row = rows[0];
    const checkin = {
      id: row.id,
      childId: row.childId,
      parentId: row.parentId,
      stressLevel: row.stressLevel,
      mood: row.mood,
      energy: row.energy,
      focus: row.focus,
      sleepHours: row.sleepHours ? parseFloat(String(row.sleepHours)) : undefined,
      notes: row.notes,
      flags: row.flags ?? [],
      checkedAt: row.checkedAt,
    };

    const alert = flags.includes('HIGH_STRESS')
      ? { severity: 'high', message: `High stress detected for your child. Consider a conversation and reduce academic pressure today.` }
      : flags.includes('ELEVATED_STRESS')
      ? { severity: 'medium', message: `Stress levels are elevated. Monitor closely and ensure adequate rest.` }
      : null;

    res.status(201).json({ checkin, alert });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/history/:childId', requireAuth, async (req, res) => {
  try {
    const { childId } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit ?? '30')), 90);

    const child = await db.select({ id: children.id }).from(children)
      .where(and(eq(children.id, childId), eq(children.parentId, req.user!.id)));
    if (!child.length) { res.status(404).json({ error: 'CHILD_NOT_FOUND' }); return; }

    const rows = await db.select().from(wellnessCheckins)
      .where(eq(wellnessCheckins.childId, childId))
      .orderBy(desc(wellnessCheckins.checkedAt))
      .limit(limit);

    const checkins = rows.map(row => ({
      id: row.id,
      childId: row.childId,
      parentId: row.parentId,
      stressLevel: row.stressLevel,
      mood: row.mood,
      energy: row.energy,
      focus: row.focus,
      sleepHours: row.sleepHours ? parseFloat(String(row.sleepHours)) : undefined,
      notes: row.notes,
      flags: row.flags ?? [],
      checkedAt: row.checkedAt,
    }));

    const recent = checkins.slice(0, 7);
    const avgStress = recent.length ? Math.round(recent.reduce((s, c) => s + c.stressLevel, 0) / recent.length * 10) / 10 : null;
    const avgEnergy = recent.length ? Math.round(recent.reduce((s, c) => s + c.energy, 0) / recent.length * 10) / 10 : null;
    const highStressCount = recent.filter(c => (c.flags as string[]).includes('HIGH_STRESS')).length;

    res.json({
      checkins,
      summary: {
        avgStress,
        avgEnergy,
        highStressAlerts: highStressCount,
        trend: avgStress === null ? 'no_data'
          : avgStress <= 4 ? 'healthy'
          : avgStress <= 6 ? 'moderate'
          : 'concerning',
      },
    });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/scholarships', async (req, res) => {
  try {
    const { grade, board, state } = req.query;
    const conditions = [eq(scholarshipAlerts.isActive, true)];

    if (grade) {
      conditions.push(sql`(${grade} = ANY(${scholarshipAlerts.eligibilityGrades}) OR ${scholarshipAlerts.eligibilityGrades} = '{}')`);
    }
    if (board) {
      conditions.push(sql`(${board} = ANY(${scholarshipAlerts.eligibilityBoards}) OR ${scholarshipAlerts.eligibilityBoards} = '{}')`);
    }
    if (state) {
      conditions.push(sql`(${state} = ANY(${scholarshipAlerts.eligibilityStates}) OR ${scholarshipAlerts.eligibilityStates} = '{}')`);
    }

    const rows = await db.select().from(scholarshipAlerts)
      .where(and(...conditions))
      .orderBy(asc(sql`${scholarshipAlerts.deadline} NULLS LAST`))
      .limit(50);

    res.json(rows.map(r => ({
      id: r.id,
      title: r.title,
      provider: r.provider,
      description: r.description,
      amount: r.amount,
      deadline: r.deadline,
      eligibilityGrades: r.eligibilityGrades,
      eligibilityBoards: r.eligibilityBoards,
      eligibilityStates: r.eligibilityStates,
      category: r.category,
      applyUrl: r.applyUrl,
    })));
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
