/**
 * /backend/routes/capadex-payments.ts
 * Razorpay payment gateway for CAPADEX progressive stage payments.
 *
 * Routes:
 *   POST /api/capadex/payment/create-order   — create Razorpay order
 *   POST /api/capadex/payment/verify         — verify signature + unlock stage
 *   POST /api/capadex/payment/webhook        — Razorpay webhook (server-to-server)
 *   GET  /api/admin/capadex/payments         — admin list of all payments
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { createHmac } from 'crypto';
import { z } from 'zod';
import { validate } from '../lib/validate';
import { stageLabel as canonStageLabel } from '../lib/lifecycle';
import { sendPaymentConfirmationUser, sendPaymentConfirmationAdmin } from '../email';
import { sendWhatsAppNotification } from '../services/whatsapp';

// ── Input-validation schemas (finding #6). Required fields mirror what each
//    handler already requires; optional fields stay optional/nullable so valid
//    requests remain byte-identical. ──────────────────────────────────────────
const idLike = z.union([z.string().trim().min(1).max(256), z.number()]);
const optStr = (max: number) => z.string().max(max).optional().nullable();

const createOrderBody = z.object({
  stage_code: z.string().trim().min(1).max(64),
  email: z.string().trim().email().max(320),
  session_id: optStr(256),
  participant_name: optStr(256),
  concern_name: optStr(512),
});

const verifyBody = z.object({
  razorpay_order_id: z.string().trim().min(1).max(256),
  razorpay_payment_id: z.string().trim().min(1).max(256),
  razorpay_signature: z.string().trim().min(1).max(512),
  payment_id: idLike.optional().nullable(),
  email: optStr(320),
  participant_name: optStr(256),
  concern_name: optStr(512),
  stage_code: optStr(64),
  phone: optStr(32),
});

const refundBody = z.object({
  payment_id: idLike,
  reason: optStr(1000),
});

const STAGE_PRICES: Record<string, number> = {
  CAP_INS: 499,
  CAP_GRW: 999,
  CAP_MAS: 1999,
};

function getRazorpay() {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

function verifySignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  const body   = `${orderId}|${paymentId}`;
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  return digest === signature;
}

// ── Auth guards (local — requireSuperAdmin not exported from routes.ts) ───────
function requireAuthLocal(req: Request, res: Response, next: NextFunction): void {
  if (!(req as any).user) { res.status(401).json({ message: 'Authentication required' }); return; }
  next();
}
function requireSuperAdminLocal(req: Request, res: Response, next: NextFunction): void {
  const u = (req as any).user;
  if (!u) { res.status(401).json({ message: 'Authentication required' }); return; }
  const roles: string[] = u.roles || [];
  if (!roles.includes('super_admin') && u.role !== 'super_admin') {
    res.status(403).json({ message: 'Super admin access required' }); return;
  }
  next();
}

export function registerCapadexPaymentRoutes(app: Express, pool: Pool) {

  // ── POST /api/capadex/payment/create-order ──────────────────────────────
  app.post('/api/capadex/payment/create-order', validate({ body: createOrderBody }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stage_code, session_id, email, participant_name, concern_name } = req.body || {};

      if (!stage_code || !email) {
        return res.status(400).json({ error: 'stage_code and email are required' });
      }

      const amountRupees = STAGE_PRICES[stage_code];
      if (!amountRupees) {
        return res.status(400).json({ error: `Unknown or free stage: ${stage_code}` });
      }

      const rz = getRazorpay();
      if (!rz) {
        // Razorpay not yet configured — return a mock order so the UI still works
        // in test/demo mode. The frontend detects this via razorpay_configured: false.
        const { rows } = await pool.query(
          `INSERT INTO capadex_payments
             (session_id, email, participant_name, concern_name, stage_code, stage_name, amount_paise, razorpay_order_id, status, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9::jsonb)
           RETURNING id`,
          [
            session_id || null,
            email,
            participant_name || null,
            concern_name || null,
            stage_code,
            stageLabel(stage_code),
            amountRupees * 100,
            `DEMO_${Date.now()}`,
            JSON.stringify({ demo: true }),
          ]
        );
        return res.json({
          razorpay_configured: false,
          payment_id: rows[0].id,
          amount: amountRupees,
          currency: 'INR',
          stage_code,
          message: 'Payment gateway not configured — demo mode',
        });
      }

      const Razorpay = (await import('razorpay')).default;
      const razorpay  = new Razorpay({ key_id: rz.keyId, key_secret: rz.keySecret });

      const receipt = `cap_${stage_code.toLowerCase()}_${Date.now()}`;
      const order   = await razorpay.orders.create({
        amount:   amountRupees * 100,
        currency: 'INR',
        receipt,
        notes: {
          stage_code,
          concern_name: concern_name || '',
          participant_name: participant_name || '',
          email,
          session_id: session_id || '',
        },
      });

      const { rows } = await pool.query(
        `INSERT INTO capadex_payments
           (session_id, email, participant_name, concern_name, stage_code, stage_name, amount_paise, razorpay_order_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
         RETURNING id`,
        [
          session_id || null,
          email,
          participant_name || null,
          concern_name || null,
          stage_code,
          stageLabel(stage_code),
          amountRupees * 100,
          order.id,
        ]
      );

      return res.json({
        razorpay_configured: true,
        razorpay_key_id: rz.keyId,
        order_id: order.id,
        payment_id: rows[0].id,
        amount: amountRupees,
        amount_paise: amountRupees * 100,
        currency: 'INR',
        stage_code,
        stage_name: stageLabel(stage_code),
        participant_name: participant_name || '',
        email,
        concern_name: concern_name || '',
      });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/payment/verify ────────────────────────────────────
  app.post('/api/capadex/payment/verify', validate({ body: verifyBody }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_id,        // our internal DB id
        email,
        participant_name,
        concern_name,
        stage_code,
        phone,
      } = req.body || {};

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Missing payment verification fields' });
      }

      const rz = getRazorpay();
      if (!rz) {
        return res.status(500).json({ error: 'Payment gateway not configured' });
      }

      const valid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, rz.keySecret);
      if (!valid) {
        await pool.query(
          `UPDATE capadex_payments SET status='failed', updated_at=now()
           WHERE razorpay_order_id=$1`,
          [razorpay_order_id]
        );
        return res.status(400).json({ error: 'Payment signature invalid — please contact support' });
      }

      const { rows } = await pool.query(
        `UPDATE capadex_payments
         SET status='paid',
             razorpay_payment_id=$1,
             razorpay_signature=$2,
             updated_at=now()
         WHERE razorpay_order_id=$3
         RETURNING id, stage_code, stage_name, amount_paise, email, participant_name, concern_name, session_id`,
        [razorpay_payment_id, razorpay_signature, razorpay_order_id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Payment record not found' });
      }

      const payment = rows[0];
      const finalEmail         = email         || payment.email;
      const finalName          = participant_name || payment.participant_name || 'there';
      const finalConcern       = concern_name   || payment.concern_name || '';
      const finalStageCode     = stage_code     || payment.stage_code;
      const finalStageName     = payment.stage_name;
      const amountRupees       = Math.round(payment.amount_paise / 100);

      // Fire notifications non-blocking
      (async () => {
        try {
          const adminEmail = process.env.ZOHO_EMAIL || 'notifications@metryxone.com';

          const [userOk, adminOk] = await Promise.allSettled([
            sendPaymentConfirmationUser({
              toEmail:      finalEmail,
              name:         finalName,
              stageName:    finalStageName,
              stageCode:    finalStageCode,
              concernName:  finalConcern,
              amountRupees,
              paymentId:    razorpay_payment_id,
              orderId:      razorpay_order_id,
            }),
            sendPaymentConfirmationAdmin({
              adminEmail,
              userEmail:    finalEmail,
              name:         finalName,
              stageName:    finalStageName,
              stageCode:    finalStageCode,
              concernName:  finalConcern,
              amountRupees,
              paymentId:    razorpay_payment_id,
              orderId:      razorpay_order_id,
              phone:        phone || null,
            }),
          ]);

          // WhatsApp to user (if phone provided)
          if (phone) {
            await sendWhatsAppNotification({
              to:      phone,
              type:    'payment_confirmed_user',
              payload: { name: finalName, stageName: finalStageName, concernName: finalConcern, amountRupees },
            }).catch(() => {});
          }

          // WhatsApp to admin
          const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
          if (adminPhone) {
            await sendWhatsAppNotification({
              to:      adminPhone,
              type:    'payment_confirmed_admin',
              payload: { name: finalName, email: finalEmail, stageName: finalStageName, concernName: finalConcern, amountRupees, paymentId: razorpay_payment_id, phone: phone || null },
            }).catch(() => {});
          }

          const notifiedUser  = userOk.status  === 'fulfilled' && userOk.value  === true;
          const notifiedAdmin = adminOk.status === 'fulfilled' && adminOk.value === true;

          await pool.query(
            `UPDATE capadex_payments SET notified_user=$1, notified_admin=$2 WHERE id=$3`,
            [notifiedUser, notifiedAdmin, payment.id]
          ).catch(() => {});
        } catch (e) {
          console.error('[capadex-payments] notification error:', e);
        }
      })();

      // Log audit event
      pool.query(
        `INSERT INTO capadex_audit_events (session_id, event_type, event_data, created_at)
         VALUES ($1, 'payment_completed', $2::jsonb, now())`,
        [
          payment.session_id || null,
          JSON.stringify({
            payment_id: payment.id,
            razorpay_order_id,
            razorpay_payment_id,
            stage_code: finalStageCode,
            amount_rupees: amountRupees,
            email: finalEmail,
          }),
        ]
      ).catch(() => {});

      return res.json({
        ok: true,
        payment_id: payment.id,
        stage_code: finalStageCode,
        stage_name: finalStageName,
        amount_rupees: amountRupees,
      });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/payment/webhook ───────────────────────────────────
  // Razorpay server-to-server webhook for async payment confirmation
  app.post('/api/capadex/payment/webhook', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      const configured    = !!getRazorpay();
      // HMAC over the EXACT received bytes (req.rawBody, captured in index.ts). Re-serializing
      // req.body re-orders/normalizes keys and breaks Razorpay signature verification.
      const raw = (req as any).rawBody instanceof Buffer
        ? (req as any).rawBody.toString('utf8')
        : JSON.stringify(req.body ?? {});
      if (configured) {
        // Live Razorpay traffic MUST be signed — fail CLOSED (never process forged paid-confirmations).
        if (!webhookSecret) return res.status(503).json({ error: 'webhook_secret_not_configured' });
        const signature = req.headers['x-razorpay-signature'] as string | undefined;
        const digest    = createHmac('sha256', webhookSecret).update(raw).digest('hex');
        if (!signature || signature !== digest) {
          return res.status(400).json({ error: 'Invalid webhook signature' });
        }
      } else if (webhookSecret) {
        // Keyless/demo mode but a secret is set → still verify when a signature is present.
        const signature = req.headers['x-razorpay-signature'] as string | undefined;
        const digest    = createHmac('sha256', webhookSecret).update(raw).digest('hex');
        if (!signature || signature !== digest) {
          return res.status(400).json({ error: 'Invalid webhook signature' });
        }
      }

      const event   = req.body?.event as string;
      const payload = req.body?.payload;

      if (event === 'payment.captured' || event === 'order.paid') {
        const orderId   = payload?.payment?.entity?.order_id || payload?.order?.entity?.id;
        const paymentId = payload?.payment?.entity?.id;

        if (orderId) {
          await pool.query(
            `UPDATE capadex_payments
             SET status='paid', razorpay_payment_id=COALESCE($1, razorpay_payment_id), updated_at=now()
             WHERE razorpay_order_id=$2 AND status='pending'`,
            [paymentId || null, orderId]
          );
          console.log(`[capadex-payments] Webhook: order ${orderId} marked paid`);
        }
      }

      return res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/payments ─────────────────────────────────────
  app.get('/api/admin/capadex/payments', requireAuthLocal, requireSuperAdminLocal, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page   = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit  = Math.min(100, parseInt(req.query.limit as string) || 25);
      const offset = (page - 1) * limit;
      const search = (req.query.search as string || '').trim();
      const status = (req.query.status as string || '').trim();
      const stage  = (req.query.stage  as string || '').trim();

      const conditions: string[] = [];
      const params: unknown[]    = [];
      let p = 1;

      if (search) {
        conditions.push(`(email ILIKE $${p} OR participant_name ILIKE $${p} OR concern_name ILIKE $${p})`);
        params.push(`%${search}%`); p++;
      }
      if (status) { conditions.push(`status=$${p++}`); params.push(status); }
      if (stage)  { conditions.push(`stage_code=$${p++}`); params.push(stage); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [dataRes, countRes, statsRes] = await Promise.all([
        pool.query(
          `SELECT id, session_id, email, participant_name, concern_name,
                  stage_code, stage_name, amount_paise, currency,
                  razorpay_order_id, razorpay_payment_id, status,
                  notified_user, notified_admin, created_at, updated_at
           FROM capadex_payments
           ${where}
           ORDER BY created_at DESC
           LIMIT $${p} OFFSET $${p+1}`,
          [...params, limit, offset]
        ),
        pool.query(`SELECT COUNT(*) FROM capadex_payments ${where}`, params),
        pool.query(
          `SELECT
             COUNT(*)                                                          AS total,
             COUNT(*) FILTER (WHERE status='paid')                            AS paid,
             COUNT(*) FILTER (WHERE status='pending')                         AS pending,
             COUNT(*) FILTER (WHERE status='failed')                          AS failed,
             COALESCE(SUM(amount_paise) FILTER (WHERE status='paid'), 0)      AS total_paise
           FROM capadex_payments`
        ),
      ]);

      const stats = statsRes.rows[0];
      return res.json({
        rows:    dataRes.rows,
        total:   parseInt(countRes.rows[0].count),
        page,
        limit,
        stats: {
          total:        parseInt(stats.total),
          paid:         parseInt(stats.paid),
          pending:      parseInt(stats.pending),
          failed:       parseInt(stats.failed),
          total_rupees: Math.round(parseInt(stats.total_paise) / 100),
        },
      });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/payment/refund ─────────────────────────────────────
  // Super-admin only. Initiates a full refund for a paid CAPADEX payment.
  // Demo orders (DEMO_ prefix) are always rejected — no real Razorpay charge exists.
  app.post('/api/capadex/payment/refund', requireAuthLocal, requireSuperAdminLocal, validate({ body: refundBody }), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { payment_id, reason } = req.body || {};
      if (!payment_id) return res.status(400).json({ error: 'payment_id is required' });

      // Look up the payment row
      const { rows } = await pool.query(
        `SELECT id, session_id, email, participant_name, stage_code,
                amount_paise, razorpay_order_id, razorpay_payment_id, status
         FROM capadex_payments WHERE id=$1 LIMIT 1`,
        [payment_id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
      const payment = rows[0];

      if (payment.status !== 'paid') {
        return res.status(400).json({ error: `Cannot refund a payment with status '${payment.status}'. Only 'paid' payments are refundable.` });
      }

      // Reject demo orders (no real Razorpay charge)
      if (!payment.razorpay_payment_id || String(payment.razorpay_payment_id).startsWith('DEMO_') || String(payment.razorpay_order_id).startsWith('DEMO_')) {
        return res.status(400).json({ error: 'Demo/test orders cannot be refunded via API. No real charge was made.' });
      }

      const rz = getRazorpay();
      if (!rz) {
        // Razorpay not configured — mark refunded locally (used in dev/staging)
        await pool.query(`UPDATE capadex_payments SET status='refunded', updated_at=now() WHERE id=$1`, [payment_id]);
        await pool.query(
          `INSERT INTO capadex_audit_events (session_id, event_type, event_data, created_at) VALUES ($1,$2,$3::jsonb, now())`,
          [payment.session_id, 'payment_refunded_local', JSON.stringify({ payment_id, reason: reason || null, note: 'razorpay_not_configured' })]
        );
        return res.json({ ok: true, mode: 'local_only', payment_id, message: 'Payment marked refunded locally (Razorpay not configured)' });
      }

      // Call Razorpay refund API
      const razorpayBody = JSON.stringify({
        amount: payment.amount_paise,
        speed: 'normal',
        notes: { reason: reason || 'admin_refund', admin: String((req as any).user?.username || 'unknown') },
      });
      const authHeader = 'Basic ' + Buffer.from(`${rz.keyId}:${rz.keySecret}`).toString('base64');
      const apiRes = await fetch(
        `https://api.razorpay.com/v1/payments/${payment.razorpay_payment_id}/refund`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: razorpayBody,
        }
      );
      const apiJson = await apiRes.json() as any;

      if (!apiRes.ok) {
        return res.status(502).json({ error: 'Razorpay refund failed', detail: apiJson?.error?.description || apiJson });
      }

      // Update status + audit
      await pool.query(`UPDATE capadex_payments SET status='refunded', updated_at=now() WHERE id=$1`, [payment_id]);
      await pool.query(
        `INSERT INTO capadex_audit_events (session_id, event_type, event_data, created_at) VALUES ($1,$2,$3::jsonb, now())`,
        [
          payment.session_id,
          'payment_refunded',
          JSON.stringify({ payment_id, razorpay_refund_id: apiJson.id, amount_paise: payment.amount_paise, reason: reason || null }),
        ]
      );

      return res.json({ ok: true, refund_id: apiJson.id, amount_paise: payment.amount_paise, payment_id });
    } catch (err) { next(err); }
  });
}

// Single-sourced from the lifecycle canon (lib/lifecycle.ts). Byte-identical for the codes
// actually passed here (paid stages CAP_INS/CAP_GRW/CAP_MAS) and additionally correct for
// CAP_CUR ('Curiosity') and any future code; unrecognized codes still fall back to the raw code.
function stageLabel(code: string): string {
  return canonStageLabel(code) ?? code;
}
