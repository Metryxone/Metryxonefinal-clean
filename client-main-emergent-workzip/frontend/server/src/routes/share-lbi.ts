import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

/* In-memory store for share tokens (production: use Redis or DB table) */
const tokenStore = new Map<string, { payload: unknown; expiresAt: number }>();

/* ── POST /api/share-lbi-report ─────────────────────────────────────────
   Generates a short-lived share token for an LBI report summary.
   No auth required — parent calls this; token is the access mechanism.
────────────────────────────────────────────────────────────────────────── */
router.post('/share-lbi-report', (req: Request, res: Response) => {
  const { childName, grade, avgScore, totalScore, maxScore, insights } = req.body;

  if (!childName || !grade || avgScore === undefined) {
    return res.status(400).json({ error: 'childName, grade, and avgScore are required' });
  }

  // Build sanitised payload (no PII beyond name + grade)
  const payload = {
    childName: String(childName).trim(),
    grade:     String(grade).trim(),
    avgScore:  Number(avgScore),
    totalScore: Number(totalScore ?? 0),
    maxScore:   Number(maxScore ?? 700),
    insights:  Array.isArray(insights)
      ? insights.map((i: { category: string; value: number; trend?: string }) => ({
          category: String(i.category),
          value:    Number(i.value),
          trend:    i.trend ?? 'stable',
        }))
      : [],
    generatedAt: new Date().toISOString(),
  };

  const token      = crypto.randomBytes(18).toString('base64url');
  const expiresAt  = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  tokenStore.set(token, { payload, expiresAt });

  // Prune expired tokens occasionally
  if (tokenStore.size > 5000) {
    const now = Date.now();
    for (const [k, v] of tokenStore.entries()) {
      if (v.expiresAt < now) tokenStore.delete(k);
    }
  }

  const origin   = req.headers.origin ?? `https://${req.headers.host}`;
  const shareUrl = `${origin}/lbi-report/${token}`;

  return res.json({ token, shareUrl, expiresAt: new Date(expiresAt).toISOString() });
});

/* ── GET /api/share-lbi-report/:token ────────────────────────────────────
   Returns the sanitised payload for a valid, non-expired token.
────────────────────────────────────────────────────────────────────────── */
router.get('/share-lbi-report/:token', (req: Request, res: Response) => {
  const { token } = req.params;
  const entry     = tokenStore.get(token);

  if (!entry) return res.status(404).json({ error: 'Report not found or link has expired' });
  if (entry.expiresAt < Date.now()) {
    tokenStore.delete(token);
    return res.status(410).json({ error: 'This share link has expired' });
  }

  return res.json(entry.payload);
});

export default router;
