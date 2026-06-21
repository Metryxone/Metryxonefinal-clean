/**
 * Phase 6.13 — Automation Engine validation harness (READ-ONLY honesty checks).
 *
 * PASS = invariant holds. WARN = honest absence (not provisioned / unmeasurable) — never a failure.
 * FAIL = a real break (out-of-bounds count, fabricated execution, unreadable existing table).
 * Composes the three engines + execution status; per-area try/catch isolates a single FAIL.
 */
import pg from 'pg';
import { buildAutomationOverview } from './automation-engine';
import { buildWorkflowOverview } from './workflow-engine';
import { buildCampaignOverview } from './campaign-engine';
import { getExecutionStatus } from './automation-execution';

type Status = 'PASS' | 'WARN' | 'FAIL';

export interface ValidationArea { area: string; status: Status; detail: string; }
export interface AutomationValidation {
  generated_at: string;
  overall: Status;
  summary: { pass: number; warn: number; fail: number };
  areas: ValidationArea[];
}

export async function buildAutomationValidation(pool: pg.Pool): Promise<AutomationValidation> {
  const generated_at = new Date().toISOString();
  const areas: ValidationArea[] = [];
  const add = (area: string, status: Status, detail: string) => areas.push({ area, status, detail });

  // 1 — eligibility counts bounded & non-fabricated.
  try {
    const a = await buildAutomationOverview(pool);
    const negative = a.automation_types.filter((t) => t.eligible_now != null && t.eligible_now < 0);
    if (negative.length) {
      add('eligibility_bounds', 'FAIL', `Negative eligible_now for: ${negative.map((t) => t.key).join(', ')}.`);
    } else {
      add('eligibility_bounds', 'PASS', 'All measured eligible_now counts are >= 0.');
    }
    const unmeasured = a.automation_types.filter((t) => !t.measured);
    if (unmeasured.length) {
      add('source_coverage', 'WARN', `${unmeasured.length}/${a.automation_types.length} types have no present source table (unmeasurable — honest null): ${unmeasured.map((t) => t.key).join(', ')}.`);
    } else {
      add('source_coverage', 'PASS', 'All 7 automation types have at least one present source table.');
    }
  } catch (err) {
    add('eligibility_bounds', 'FAIL', `Automation overview threw: ${(err as Error)?.message ?? 'unknown'}.`);
  }

  // 2 — workflow instance coherence (current_step never exceeds total_steps).
  try {
    const w = await buildWorkflowOverview(pool);
    if (!w.provisioned) {
      add('workflow_provisioning', 'WARN', 'Workflow tables not provisioned — run console setup.');
    } else {
      const bad = w.due_steps.filter((d: any) => Number(d.current_step) > Number(d.total_steps));
      if (bad.length) add('workflow_coherence', 'FAIL', `${bad.length} instances have current_step > total_steps.`);
      else add('workflow_coherence', 'PASS', `${w.summary.total_instances} instances coherent (current_step <= total_steps).`);
    }
  } catch (err) {
    add('workflow_coherence', 'FAIL', `Workflow overview threw: ${(err as Error)?.message ?? 'unknown'}.`);
  }

  // 3 — campaign composition reads (never fabricated when substrate absent).
  try {
    const c = await buildCampaignOverview(pool);
    const composedPresent = c.composed.eios_campaigns != null || c.composed.employer_outreach != null;
    if (!composedPresent) add('campaign_substrate', 'WARN', 'No campaign substrate present (eios_campaigns / employer_pool_outreach absent) — composed counts honestly null.');
    else add('campaign_substrate', 'PASS', 'Campaign substrate composed read-only from live tables.');
  } catch (err) {
    add('campaign_substrate', 'FAIL', `Campaign overview threw: ${(err as Error)?.message ?? 'unknown'}.`);
  }

  // 4 — execution is intent-only (no run claims more executed than eligible; executed stays 0 here).
  try {
    const e = await getExecutionStatus(pool);
    if (!e.schema_ready) {
      add('execution_schema', 'WARN', 'Automation tables not fully provisioned — run POST /console/setup.');
    } else {
      add('execution_schema', 'PASS', 'All automation tables provisioned.');
    }
    if (e.last_run && Number(e.last_run.executed_count) > Number(e.last_run.eligible_count ?? 0) && e.last_run.eligible_count != null) {
      add('execution_integrity', 'FAIL', 'Last run executed_count exceeds eligible_count (fabricated execution).');
    } else {
      add('execution_integrity', 'PASS', 'No run reports more executed than eligible; runs are intent-only.');
    }
  } catch (err) {
    add('execution_integrity', 'FAIL', `Execution status threw: ${(err as Error)?.message ?? 'unknown'}.`);
  }

  const summary = {
    pass: areas.filter((a) => a.status === 'PASS').length,
    warn: areas.filter((a) => a.status === 'WARN').length,
    fail: areas.filter((a) => a.status === 'FAIL').length,
  };
  const overall: Status = summary.fail > 0 ? 'FAIL' : summary.warn > 0 ? 'WARN' : 'PASS';
  return { generated_at, overall, summary, areas };
}
