import { db } from '../db/drizzle.js';
import { notificationTemplates } from '../db/schema.js';
import { eq, and, sql, asc } from 'drizzle-orm';
import { TEMPLATES, type NotificationTemplate } from './templates.js';

export interface DBNotificationTemplate {
  id: number;
  category: string;
  title: string;
  bodyTemplate: string;
  type: 'fyi' | 'fya';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  roles: string[];
  variables: string[];
  actionUrl: string | null;
  actionLabel: string | null;
  isActive: boolean;
}

// In-memory cache
let cache: DBNotificationTemplate[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function mapRow(row: typeof notificationTemplates.$inferSelect): DBNotificationTemplate {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    bodyTemplate: row.bodyTemplate,
    type: row.type as 'fyi' | 'fya',
    priority: row.priority as 'low' | 'normal' | 'high' | 'urgent',
    roles: Array.isArray(row.roles) ? row.roles as string[] : JSON.parse((row.roles as string) ?? '["all"]'),
    variables: Array.isArray(row.variables) ? row.variables as string[] : JSON.parse((row.variables as string) ?? '[]'),
    actionUrl: row.actionUrl ?? null,
    actionLabel: row.actionLabel ?? null,
    isActive: row.isActive ?? true,
  };
}

function staticFallback(): DBNotificationTemplate[] {
  return Object.values(TEMPLATES).map((t) => ({
    id: t.id,
    category: t.category,
    title: t.title,
    bodyTemplate: t.bodyTemplate,
    type: t.type,
    priority: t.priority,
    roles: t.roles,
    variables: t.variables,
    actionUrl: t.actionUrl ?? null,
    actionLabel: t.actionLabel ?? null,
    isActive: true,
  }));
}

export async function getAllTemplates(): Promise<DBNotificationTemplate[]> {
  if (cache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cache;
  }

  try {
    const rows = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.isActive, true))
      .orderBy(asc(notificationTemplates.id));
    cache = rows.map(mapRow);
    cacheTimestamp = Date.now();
    return cache;
  } catch (err) {
    console.warn('[TemplateRepo] DB read failed, using static fallback:', (err as Error).message);
    return staticFallback();
  }
}

export async function getTemplateById(id: number): Promise<DBNotificationTemplate | null> {
  // Try cache first
  if (cache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cache.find((t) => t.id === id) ?? null;
  }

  try {
    const rows = await db
      .select()
      .from(notificationTemplates)
      .where(and(eq(notificationTemplates.id, id), eq(notificationTemplates.isActive, true)));
    if (rows.length === 0) return null;
    return mapRow(rows[0]);
  } catch (err) {
    console.warn('[TemplateRepo] DB read failed, using static fallback:', (err as Error).message);
    const t = TEMPLATES[id];
    if (!t) return null;
    return {
      id: t.id,
      category: t.category,
      title: t.title,
      bodyTemplate: t.bodyTemplate,
      type: t.type,
      priority: t.priority,
      roles: t.roles,
      variables: t.variables,
      actionUrl: t.actionUrl ?? null,
      actionLabel: t.actionLabel ?? null,
      isActive: true,
    };
  }
}

export async function createTemplate(data: {
  title: string;
  category: string;
  bodyTemplate: string;
  type: 'fyi' | 'fya';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  roles: string[];
  variables: string[];
  actionUrl?: string | null;
  actionLabel?: string | null;
}): Promise<DBNotificationTemplate> {
  const maxResult = await db
    .select({ nextId: sql<number>`COALESCE(MAX(${notificationTemplates.id}), 0) + 1` })
    .from(notificationTemplates);
  const nextId = maxResult[0].nextId;

  const rows = await db
    .insert(notificationTemplates)
    .values({
      id: nextId,
      title: data.title,
      category: data.category,
      bodyTemplate: data.bodyTemplate,
      type: data.type,
      priority: data.priority,
      roles: data.roles,
      variables: data.variables,
      actionUrl: data.actionUrl ?? null,
      actionLabel: data.actionLabel ?? null,
      isActive: true,
    })
    .returning();
  invalidateCache();
  return mapRow(rows[0]);
}

export async function updateTemplate(id: number, data: {
  title?: string;
  category?: string;
  bodyTemplate?: string;
  type?: 'fyi' | 'fya';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  roles?: string[];
  variables?: string[];
  actionUrl?: string | null;
  actionLabel?: string | null;
}): Promise<DBNotificationTemplate | null> {
  const updates: Record<string, unknown> = {};

  if (data.title !== undefined) updates.title = data.title;
  if (data.category !== undefined) updates.category = data.category;
  if (data.bodyTemplate !== undefined) updates.bodyTemplate = data.bodyTemplate;
  if (data.type !== undefined) updates.type = data.type;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.roles !== undefined) updates.roles = data.roles;
  if (data.variables !== undefined) updates.variables = data.variables;
  if (data.actionUrl !== undefined) updates.actionUrl = data.actionUrl;
  if (data.actionLabel !== undefined) updates.actionLabel = data.actionLabel;

  if (Object.keys(updates).length === 0) return getTemplateById(id);

  const rows = await db
    .update(notificationTemplates)
    .set(updates)
    .where(and(eq(notificationTemplates.id, id), eq(notificationTemplates.isActive, true)))
    .returning();
  invalidateCache();
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export function invalidateCache(): void {
  cache = null;
  cacheTimestamp = 0;
}
