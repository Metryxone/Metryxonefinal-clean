import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as service from '../notifications/service.js';
import { sseManager } from '../notifications/sse.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { type, category, limit, offset, unread_only } = req.query;
    const notifications = await service.getAll(req.user!.id, {
      type: type as string | undefined,
      category: category as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
      unreadOnly: unread_only === 'true',
    });
    res.json(notifications);
  } catch (err) {
    console.error('[Route] GET /notifications:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch notifications.' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const count = await service.getUnreadCount(req.user!.id);
    res.json({ count });
  } catch {
    res.json({ count: 0 });
  }
});

router.get('/stream', (req, res) => {
  sseManager.add(req.user!.id, res);
});

router.patch('/:id/read', async (req, res) => {
  try {
    const ok = await service.markRead(req.params.id, req.user!.id);
    if (!ok) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/mark-all-read', async (req, res) => {
  try {
    const updated = await service.markAllRead(req.user!.id);
    res.json({ updated });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/:id/acknowledge', async (req, res) => {
  try {
    const ok = await service.acknowledge(req.params.id, req.user!.id);
    if (!ok) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json({ success: true, acknowledgedAt: new Date().toISOString() });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const ok = await service.deleteNotification(req.params.id, req.user!.id);
    if (!ok) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

const fireSchema = z.object({
  templateId: z.number().int().min(1),
  variables: z.record(z.string()).default({}),
  recipientId: z.string().optional(),
  options: z.object({
    actionUrl: z.string().optional(),
    actionLabel: z.string().optional(),
    expiresAt: z.string().optional(),
  }).optional(),
});

router.post('/fire', validate(fireSchema), async (req, res) => {
  try {
    const { templateId, variables, recipientId, options } = req.body;
    const notif = await service.fire(templateId, variables ?? {}, {
      recipientId: recipientId ?? req.user!.id,
      senderId: req.user!.id,
      ...options,
    });
    if (!notif) {
      res.status(400).json({ error: 'INVALID_TEMPLATE', message: 'Template not found or delivery blocked by preferences.' });
      return;
    }
    res.status(201).json(notif);
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
