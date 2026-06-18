import { db } from '../db/drizzle.js';
import { pool } from '../db/client.js';
import { notificationScenarios, notificationScheduledJobs, users } from '../db/schema.js';
import { eq, and, sql, lte } from 'drizzle-orm';
import * as service from './service.js';

export interface TriggerContext {
  recipientId?: string;
  senderId?: string;
  [key: string]: unknown;
}

interface Scenario {
  id: number;
  name: string;
  eventTrigger: string;
  conditionJson: Record<string, unknown>;
  templateId: number | null;
  delayMinutes: number;
  channels: string[];
  targetRole: string | null;
  variablesMap: Record<string, string>;
  isActive: boolean;
}

function conditionsMet(conditions: Record<string, unknown>, context: TriggerContext): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = (context as Record<string, unknown>)[key];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

function resolveVariables(
  variablesMap: Record<string, string>,
  context: TriggerContext
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [templateVar, contextKey] of Object.entries(variablesMap)) {
    const value = (context as Record<string, unknown>)[contextKey];
    vars[templateVar] = value !== undefined && value !== null ? String(value) : '';
  }
  return vars;
}

async function resolveRecipient(
  scenario: Scenario,
  context: TriggerContext
): Promise<string | null> {
  if (context.recipientId) return context.recipientId;

  if (scenario.targetRole === 'admin') {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`${users.role} = 'superadmin' OR ${users.roles}::text LIKE '%superadmin%'`)
      .limit(1);
    return rows[0]?.id ?? null;
  }

  return null;
}

export async function trigger(event: string, context: TriggerContext): Promise<void> {
  try {
    const scenarios = await db
      .select()
      .from(notificationScenarios)
      .where(and(eq(notificationScenarios.eventTrigger, event), eq(notificationScenarios.isActive, true)));

    for (const scenario of scenarios) {
      const s = scenario as any as Scenario;
      if (!conditionsMet(s.conditionJson, context)) continue;
      if (!s.templateId) continue;

      const recipientId = await resolveRecipient(s, context);
      if (!recipientId) continue;

      const variables = resolveVariables(s.variablesMap, context);
      const scheduledAt = new Date(Date.now() + s.delayMinutes * 60 * 1000);

      if (s.delayMinutes <= 0) {
        await service.fire(s.templateId, variables, {
          recipientId,
          senderId: context.senderId,
        });
      } else {
        await db.insert(notificationScheduledJobs).values({
          scenarioId: s.id,
          templateId: s.templateId,
          recipientId,
          variables,
          channels: s.channels,
          context: context as Record<string, unknown>,
          scheduledAt,
        });
      }

      await db
        .update(notificationScenarios)
        .set({
          executionCount: sql`${notificationScenarios.executionCount} + 1`,
          lastExecutedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(notificationScenarios.id, s.id));
    }
  } catch (err) {
    console.error(`[ScenarioEngine] trigger(${event}) error:`, (err as Error).message);
  }
}

export async function processScheduledJobs(): Promise<void> {
  try {
    // FOR UPDATE SKIP LOCKED — must use pool.query (db.execute doesn't support row-level locking reliably)
    const rows = await pool.query(
      `SELECT * FROM notification_scheduled_jobs
          WHERE status = 'pending' AND scheduled_at <= NOW()
          LIMIT 20
          FOR UPDATE SKIP LOCKED`
    );

    for (const job of rows.rows as any[]) {
      await db
        .update(notificationScheduledJobs)
        .set({ status: 'processing' })
        .where(eq(notificationScheduledJobs.id, job.id));

      try {
        const variables: Record<string, string> = typeof job.variables === 'object'
          ? job.variables
          : JSON.parse(job.variables ?? '{}');

        await service.fire(job.template_id, variables, { recipientId: job.recipient_id });

        await db
          .update(notificationScheduledJobs)
          .set({ status: 'sent', sentAt: new Date() })
          .where(eq(notificationScheduledJobs.id, job.id));
      } catch (err) {
        const msg = (err as Error).message;
        await db
          .update(notificationScheduledJobs)
          .set({ status: 'failed', errorMessage: msg })
          .where(eq(notificationScheduledJobs.id, job.id));
        console.error(`[ScenarioEngine] Scheduled job ${job.id} failed:`, msg);
      }
    }
  } catch (err) {
    console.error('[ScenarioEngine] processScheduledJobs error:', (err as Error).message);
  }
}
