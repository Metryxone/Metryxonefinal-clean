import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/client.js';

const router = Router();
router.use(requireAuth);

const VALID_LANGUAGES = ['english', 'hindi', 'tamil', 'telugu', 'marathi'] as const;

const PrefSchema = z.object({
  pausePref: z.enum(['none', 'always', 'session']).optional(),
  responseStyle: z.enum(['standard', 'concise']).optional(),
  preferredLanguage: z.enum(VALID_LANGUAGES).optional(),
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query<{ pause_pref: string; response_style: string; preferred_language: string }>(
      'SELECT pause_pref, response_style, preferred_language FROM chat_preferences WHERE user_id = $1',
      [req.user!.id],
    );
    if (result.rows.length === 0) {
      res.json({ pausePref: 'none', responseStyle: 'standard', preferredLanguage: 'english' });
      return;
    }
    res.json({
      pausePref: result.rows[0].pause_pref,
      responseStyle: result.rows[0].response_style ?? 'standard',
      preferredLanguage: result.rows[0].preferred_language ?? 'english',
    });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.put('/', async (req, res) => {
  const parsed = PrefSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
    return;
  }
  if (!parsed.data.pausePref && !parsed.data.responseStyle && !parsed.data.preferredLanguage) {
    res.status(400).json({ error: 'INVALID_BODY', details: 'At least one preference field is required' });
    return;
  }
  const { pausePref, responseStyle, preferredLanguage } = parsed.data;
  try {
    const setClauses: string[] = ['updated_at = NOW()'];
    if (pausePref !== undefined) setClauses.push('pause_pref = EXCLUDED.pause_pref');
    if (responseStyle !== undefined) setClauses.push('response_style = EXCLUDED.response_style');
    if (preferredLanguage !== undefined) setClauses.push('preferred_language = EXCLUDED.preferred_language');

    await pool.query(
      `INSERT INTO chat_preferences (user_id, pause_pref, response_style, preferred_language, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET ${setClauses.join(', ')}`,
      [req.user!.id, pausePref ?? 'none', responseStyle ?? 'standard', preferredLanguage ?? 'english'],
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
