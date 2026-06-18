import { db } from '../../db/drizzle.js';
import { pool } from '../../db/client.js';
import { notificationQueue, notifications, users } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { sendEmail } from './email.js';
import type { Notification } from '../service.js';
import { processScheduledJobs } from '../scenarioEngine.js';

interface UserPrefs {
  channels: { in_app: boolean; email: boolean; whatsapp: boolean; sms: boolean };
  category_overrides: Record<string, { email?: boolean }>;
  quiet_hours: { enabled: boolean; from?: string; to?: string };
}

export async function enqueueDelivery(
  notif: Notification,
  prefs: UserPrefs
): Promise<void> {
  const jobs: { channel: string; scheduled_at: string }[] = [];

  if (prefs.channels.email) {
    const catOverride = prefs.category_overrides?.[notif.category];
    const emailEnabled = catOverride?.email !== false;
    if (emailEnabled) {
      jobs.push({ channel: 'email', scheduled_at: new Date().toISOString() });
    }
  }

  for (const job of jobs) {
    await db.insert(notificationQueue).values({
      notificationId: notif.id,
      channel: job.channel,
      scheduledAt: new Date(job.scheduled_at),
    });
  }
}

export async function processQueue(): Promise<void> {
  // Complex JOIN with FOR UPDATE SKIP LOCKED — must use pool.query (db.execute doesn't support row-level locking reliably)
  const result = await pool.query(
    `SELECT q.*, n.recipient_id, n.title, n.message, n.action_url, n.category
        FROM notification_queue q
        JOIN notifications n ON n.id = q.notification_id
        WHERE q.status = 'pending'
          AND q.scheduled_at <= NOW()
          AND q.attempts < q.max_attempts
        LIMIT 20
        FOR UPDATE SKIP LOCKED`
  );

  for (const job of result.rows as any[]) {
    await db
      .update(notificationQueue)
      .set({ status: 'processing', attempts: sql`${notificationQueue.attempts} + 1` })
      .where(eq(notificationQueue.id, job.id));

    try {
      if (job.channel === 'email') {
        const recipient = await getRecipientEmail(job.recipient_id);
        if (recipient) {
          await sendEmail({
            to: recipient.email,
            name: recipient.name,
            title: job.title,
            message: job.message,
            actionUrl: job.action_url,
          });
        }
      }

      await db
        .update(notificationQueue)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(notificationQueue.id, job.id));
      await db
        .update(notifications)
        .set({ isEmailSent: true, emailSentAt: new Date() })
        .where(eq(notifications.id, job.notification_id));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await db
        .update(notificationQueue)
        .set({
          status: sql`CASE WHEN ${notificationQueue.attempts} >= ${notificationQueue.maxAttempts} THEN 'failed' ELSE 'pending' END`,
          errorMessage: errMsg,
        })
        .where(eq(notificationQueue.id, job.id));
      console.error(`[Worker] Failed to send ${job.channel} for job ${job.id}:`, errMsg);
    }
  }
}

async function getRecipientEmail(userId: string): Promise<{ email: string; name: string } | null> {
  try {
    const rows = await db
      .select({ email: users.email, name: users.fullName })
      .from(users)
      .where(eq(users.id, userId));
    if (rows.length === 0 || !rows[0].email) return null;
    return { email: rows[0].email, name: rows[0].name ?? '' };
  } catch {
    return null;
  }
}

let workerInterval: NodeJS.Timeout | null = null;

export function startWorker(intervalMs = 30000): void {
  if (workerInterval) return;
  console.log(`[Worker] Email delivery worker started (every ${intervalMs / 1000}s)`);
  workerInterval = setInterval(() => {
    processQueue().catch(err => console.error('[Worker] processQueue error:', err));
    processScheduledJobs().catch(err => console.error('[Worker] processScheduledJobs error:', err));
  }, intervalMs);
}

export function stopWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
