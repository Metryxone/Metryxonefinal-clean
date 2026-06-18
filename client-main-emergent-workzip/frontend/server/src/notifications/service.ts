import { db } from '../db/drizzle.js';
import { notifications, notificationPreferences } from '../db/schema.js';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { resolveTemplate } from './templates.js';
import { getTemplateById } from './templateRepository.js';
import { sseManager } from './sse.js';
import { enqueueDelivery } from './delivery/worker.js';

export interface FireOptions {
  recipientId: string;
  senderId?: string;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  templateId: number;
  recipientId: string;
  senderId: string | null;
  category: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  isEmailSent: boolean;
  emailSentAt: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  metadata: Record<string, unknown> | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fire(
  templateId: number,
  variables: Record<string, string>,
  options: FireOptions
): Promise<Notification | null> {
  const template = await getTemplateById(templateId);
  if (!template) {
    console.warn(`[NotifService] Unknown template: ${templateId}`);
    return null;
  }

  const resolved = await resolveTemplate(templateId, variables);
  if (!resolved) return null;

  const prefs = await getPreferences(options.recipientId);
  if (!prefs.channels.in_app) return null;

  const catOverride = prefs.category_overrides?.[template.category];
  if (catOverride?.in_app === false) return null;

  const rows = await db
    .insert(notifications)
    .values({
      templateId,
      recipientId: options.recipientId,
      senderId: options.senderId ?? null,
      category: template.category,
      title: resolved.title,
      message: resolved.message,
      type: template.type,
      priority: template.priority,
      actionUrl: options.actionUrl ?? template.actionUrl ?? null,
      actionLabel: options.actionLabel ?? template.actionLabel ?? null,
      metadata: options.metadata ?? null,
      expiresAt: options.expiresAt ? new Date(options.expiresAt) : null,
    })
    .returning();

  const notif = rows[0] as any as Notification;

  sseManager.push(options.recipientId, {
    id: notif.id,
    title: notif.title,
    message: notif.message,
    category: notif.category,
    priority: notif.priority,
    type: notif.type,
    actionUrl: notif.actionUrl,
    actionLabel: notif.actionLabel,
    createdAt: notif.createdAt,
  });

  await enqueueDelivery(notif, prefs);

  return notif;
}

export async function getAll(
  recipientId: string,
  opts: { type?: string; category?: string; limit?: number; offset?: number; unreadOnly?: boolean }
): Promise<Notification[]> {
  const conditions = [eq(notifications.recipientId, recipientId)];

  if (opts.type) conditions.push(eq(notifications.type, opts.type));
  if (opts.category) conditions.push(eq(notifications.category, opts.category));
  if (opts.unreadOnly) conditions.push(eq(notifications.isRead, false));

  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
  return rows as any as Notification[];
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientId, recipientId), eq(notifications.isRead, false)));
  return rows[0]?.count ?? 0;
}

export async function markRead(id: string, recipientId: string): Promise<boolean> {
  const result = await db
    .update(notifications)
    .set({ isRead: true, updatedAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, recipientId)));
  return (result.rowCount ?? 0) > 0;
}

export async function markAllRead(recipientId: string): Promise<number> {
  const result = await db
    .update(notifications)
    .set({ isRead: true, updatedAt: new Date() })
    .where(and(eq(notifications.recipientId, recipientId), eq(notifications.isRead, false)));
  return result.rowCount ?? 0;
}

export async function acknowledge(id: string, recipientId: string): Promise<boolean> {
  const result = await db
    .update(notifications)
    .set({ isAcknowledged: true, acknowledgedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, recipientId)));
  return (result.rowCount ?? 0) > 0;
}

export async function deleteNotification(id: string, recipientId: string): Promise<boolean> {
  const result = await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, recipientId)));
  return (result.rowCount ?? 0) > 0;
}

export async function getPreferences(userId: string) {
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  if (rows.length > 0) return rows[0] as any;

  await db
    .insert(notificationPreferences)
    .values({ userId })
    .onConflictDoNothing();

  return {
    channels: { in_app: true, email: true, whatsapp: false, sms: false },
    category_overrides: {},
    quiet_hours: { enabled: false },
  };
}

export async function updatePreferences(
  userId: string,
  updates: Record<string, unknown>
): Promise<void> {
  await db
    .insert(notificationPreferences)
    .values({
      userId,
      channels: updates.channels ?? {},
      categoryOverrides: updates.category_overrides ?? {},
      quietHours: updates.quiet_hours ?? {},
    })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        channels: sql`${notificationPreferences.channels} || ${JSON.stringify(updates.channels ?? {})}::jsonb`,
        categoryOverrides: sql`${notificationPreferences.categoryOverrides} || ${JSON.stringify(updates.category_overrides ?? {})}::jsonb`,
        quietHours: sql`${notificationPreferences.quietHours} || ${JSON.stringify(updates.quiet_hours ?? {})}::jsonb`,
        updatedAt: new Date(),
      },
    });
}
