/**
 * AI Governance Scheduler
 *
 * Two background loops started once at server boot:
 *
 * 1. MONITORING_LOOP — every 5 min: writes aig_monitoring_metrics (auto-refresh).
 * 2. WORKFLOW_LOOP   — every 60 sec: fires scheduled workflows that are due.
 *
 * Event-driven workflows: subscribe to adaptive-event-bus `trigger_config.event_type`.
 * The scheduler is a no-op when FF_AI_GOVERNANCE is not '1'.
 */
import type { Pool } from 'pg';
import { computeAiMonitoringMetrics } from './ai-governance-schema';
import { executeWorkflow } from './ai-governance-llm';

// ── Config ───────────────────────────────────────────────────────────────────
const MONITORING_INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes
const WORKFLOW_CHECK_MS      = 60 * 1000;         // 60 seconds
const SCHEDULER_ACTOR        = 'scheduler';

let started = false;

// ── Monitoring auto-refresh loop ─────────────────────────────────────────────
async function monitoringLoop(pool: Pool): Promise<void> {
  try {
    const n = await computeAiMonitoringMetrics(pool);
    console.log(`[ai-governance/scheduler] monitoring refresh — ${n} metrics written`);
  } catch (err: any) {
    console.warn('[ai-governance/scheduler] monitoring refresh error:', err.message);
  }
}

// ── Scheduled workflow execution ─────────────────────────────────────────────
async function runScheduledWorkflows(pool: Pool): Promise<void> {
  try {
    const { rows } = await pool.query<{
      id: string; name: string; trigger_config: Record<string, unknown>;
      last_run_at: string | null;
    }>(
      `SELECT id, name, trigger_config, last_run_at
       FROM aig_ai_workflows
       WHERE status='active' AND trigger_type='scheduled'`);

    for (const wf of rows) {
      const intervalMin = Number((wf.trigger_config as any)?.interval_minutes ?? 60);
      const intervalMs  = intervalMin * 60 * 1000;
      const lastRun     = wf.last_run_at ? new Date(wf.last_run_at).getTime() : 0;
      const isDue       = Date.now() - lastRun >= intervalMs;

      if (!isDue) continue;

      console.log(`[ai-governance/scheduler] firing scheduled workflow: ${wf.name}`);
      executeWorkflow(pool, wf.id, SCHEDULER_ACTOR, 'scheduled', {
        trigger: 'scheduled',
        scheduled_at: new Date().toISOString(),
      }).catch(err =>
        console.warn(`[ai-governance/scheduler] scheduled run failed (${wf.name}):`, err.message));
    }
  } catch (err: any) {
    console.warn('[ai-governance/scheduler] workflow check error:', err.message);
  }
}

// ── Event-driven workflow registration ───────────────────────────────────────
async function registerEventWorkflows(pool: Pool): Promise<void> {
  try {
    // Import lazily to avoid circular dependency issues
    const eventBus = await import('./adaptive-event-bus').catch(() => null);
    if (!eventBus) return;

    const { rows } = await pool.query<{
      id: string; name: string; trigger_config: Record<string, unknown>;
    }>(
      `SELECT id, name, trigger_config
       FROM aig_ai_workflows
       WHERE status='active' AND trigger_type='event'`);

    for (const wf of rows) {
      const eventType = (wf.trigger_config as any)?.event_type as string | undefined;
      if (!eventType) continue;

      console.log(`[ai-governance/scheduler] registering event listener: ${wf.name} → ${eventType}`);
      eventBus.on(eventType, (e: any) => {
        executeWorkflow(pool, wf.id, SCHEDULER_ACTOR, 'event', {
          event_type: eventType,
          event_data: e ?? {},
          triggered_at: new Date().toISOString(),
        }).catch(err =>
          console.warn(`[ai-governance/scheduler] event run failed (${wf.name}):`, err.message));
      });
    }
  } catch (err: any) {
    console.warn('[ai-governance/scheduler] event registration error:', err.message);
  }
}

// ── Public: start the scheduler (idempotent) ─────────────────────────────────
export function startAiGovernanceScheduler(pool: Pool): void {
  if (started) return;
  if (process.env.FF_AI_GOVERNANCE !== '1') return;

  started = true;
  console.log('[ai-governance/scheduler] starting — monitoring every 5 min, workflows every 60 s');

  // Kick off immediately, then on interval
  monitoringLoop(pool);
  setInterval(() => monitoringLoop(pool), MONITORING_INTERVAL_MS).unref();

  runScheduledWorkflows(pool);
  setInterval(() => runScheduledWorkflows(pool), WORKFLOW_CHECK_MS).unref();

  // Event-driven — register after a brief delay to let schema + seed settle
  setTimeout(() => registerEventWorkflows(pool), 5_000);
}
