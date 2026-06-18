import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as service from '../notifications/service.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const prefs = await service.getPreferences(req.user!.id);
    res.json({
      channels: prefs.channels,
      categoryOverrides: prefs.category_overrides,
      quietHours: prefs.quiet_hours,
    });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.put('/', async (req, res) => {
  try {
    await service.updatePreferences(req.user!.id, req.body);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
