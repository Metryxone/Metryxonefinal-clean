import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/drizzle.js';
import { emailConsents } from '../db/schema.js';
import { eq, asc } from 'drizzle-orm';
import * as notifService from '../notifications/service.js';
import { rowsToSnake } from '../db/utils.js';

const ESSENTIAL = ['transactional', 'security_alerts'];

const CONSENT_TYPES = [
  'transactional', 'security_alerts', 'assessment_updates',
  'mentor_updates', 'lbi_reports', 'marketing',
  'newsletter', 'product_updates', 'weekly_digest',
];

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;

    for (const type of CONSENT_TYPES) {
      await db.insert(emailConsents)
        .values({ userId, consentType: type, isConsented: true, consentedAt: new Date() })
        .onConflictDoNothing({ target: [emailConsents.userId, emailConsents.consentType] });
    }

    const rows = await db.select().from(emailConsents)
      .where(eq(emailConsents.userId, userId))
      .orderBy(asc(emailConsents.consentType));
    res.json(rowsToSnake(rows));
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.put('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { isConsented } = req.body;

    if (ESSENTIAL.includes(type)) {
      res.status(403).json({ error: 'FORBIDDEN', message: `${type} cannot be disabled.` });
      return;
    }

    if (!CONSENT_TYPES.includes(type)) {
      res.status(400).json({ error: 'INVALID_TYPE', message: 'Unknown consent type.' });
      return;
    }

    const now = new Date();
    await db.insert(emailConsents)
      .values({
        userId: req.user!.id,
        consentType: type,
        isConsented,
        consentedAt: isConsented ? now : null,
        revokedAt: !isConsented ? now : null,
      })
      .onConflictDoUpdate({
        target: [emailConsents.userId, emailConsents.consentType],
        set: {
          isConsented,
          consentedAt: isConsented ? now : undefined,
          revokedAt: !isConsented ? now : null,
        },
      });

    // Fire Privacy Policy Updated notification (template 10) — non-blocking
    notifService.fire(10, { date: new Date().toLocaleDateString() }, { recipientId: String(req.user!.id) }).catch(e =>
      console.warn('[Consents] Privacy notification failed (non-fatal):', e)
    );

    res.json({ consentType: type, isConsented, ...(isConsented ? { consentedAt: now.toISOString() } : { revokedAt: now.toISOString() }) });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
