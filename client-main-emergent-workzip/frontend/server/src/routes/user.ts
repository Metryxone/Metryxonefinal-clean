import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/drizzle.js';
import { users } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

const router = Router();
router.use(requireAuth);
router.get('/', async (req, res) => {
  try {
    const rows = await db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      mobile: users.mobile,
      role: users.role,
      roles: users.roles,
      isVerified: users.isVerified,
      profilePicture: users.profilePicture,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, req.user!.id));

    if (!rows.length) { res.status(404).json({ error: 'USER_NOT_FOUND' }); return; }
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/theme', async (req, res) => {
  try {
    const rows = await db.select({
      theme: sql<string>`COALESCE(${users.metadata}->>'theme', 'light')`,
    }).from(users).where(eq(users.id, req.user!.id));
    res.json({ theme: rows[0]?.theme ?? 'light' });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

const themeSchema = z.object({
  theme: z.enum(['light', 'dark'], { message: "Theme must be 'light' or 'dark'" }),
});

router.patch('/theme', validate(themeSchema), async (req, res) => {
  try {
    const { theme } = req.body;
    await db.update(users)
      .set({
        metadata: sql`COALESCE(${users.metadata}, '{}'::jsonb) || jsonb_build_object('theme', ${theme}::text)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user!.id));
    res.json({ success: true, theme });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
