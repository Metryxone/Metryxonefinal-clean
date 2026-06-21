/**
 * Phase 6.13 — Workflow Engine (workflow_engine deliverable). READ-ONLY, never-throws.
 *
 * Surfaces multi-step workflow definitions and their running instances (status rollup + due steps)
 * from the additive workflow_* tables. Absent tables → honest empties, never fabricated.
 */
import pg from 'pg';

const N = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`]);
    return !!r.rows[0]?.t;
  } catch { return false; }
}

export interface WorkflowOverview {
  generated_at: string;
  degraded: boolean;
  provisioned: boolean;
  definitions: any[];
  instances: { total: number; active: number; completed: number; by_status: { status: string; count: number }[] };
  due_steps: any[];
  summary: { total_definitions: number; enabled_definitions: number; total_instances: number };
  notes: string[];
}

export async function buildWorkflowOverview(pool: pg.Pool): Promise<WorkflowOverview> {
  const generated_at = new Date().toISOString();
  const notes: string[] = [];
  let degraded = false;

  const defsTable = await tableExists(pool, 'workflow_definitions');
  const instTable = await tableExists(pool, 'workflow_instances');

  let definitions: any[] = [];
  let enabled = 0;
  if (defsTable) {
    try {
      const r = await pool.query(
        `SELECT id, workflow_key, name, description, steps, is_enabled, created_at, updated_at
         FROM workflow_definitions ORDER BY workflow_key`);
      definitions = r.rows.map((d) => ({ ...d, step_count: Array.isArray(d.steps) ? d.steps.length : 0 }));
      enabled = definitions.filter((d) => d.is_enabled).length;
    } catch { degraded = true; }
  } else {
    notes.push('workflow_definitions not provisioned — run console setup (POST /console/setup) to enable workflow storage.');
  }

  let total = 0, active = 0, completed = 0;
  let byStatus: { status: string; count: number }[] = [];
  let dueSteps: any[] = [];
  if (instTable) {
    try {
      const c = await pool.query('SELECT COUNT(*)::int AS n FROM workflow_instances');
      total = N(c.rows[0]?.n);
      const s = await pool.query(
        `SELECT COALESCE(status,'unknown') AS status, COUNT(*)::int AS count
         FROM workflow_instances GROUP BY status ORDER BY count DESC`);
      byStatus = s.rows.map((row) => ({ status: String(row.status), count: N(row.count) }));
      active = byStatus.filter((b) => b.status === 'active').reduce((a, b) => a + b.count, 0);
      completed = byStatus.filter((b) => b.status === 'completed').reduce((a, b) => a + b.count, 0);
      const d = await pool.query(
        `SELECT id, workflow_key, subject_ref, current_step, total_steps, status, updated_at
         FROM workflow_instances
         WHERE lower(coalesce(status,'active')) = 'active' AND current_step < total_steps
         ORDER BY updated_at ASC LIMIT 25`);
      dueSteps = d.rows;
    } catch { degraded = true; }
  }

  notes.push('Instance status counts and due steps are read directly from workflow_instances; nothing is advanced or executed by this console.');

  return {
    generated_at,
    degraded,
    provisioned: defsTable && instTable,
    definitions,
    instances: { total, active, completed, by_status: byStatus },
    due_steps: dueSteps,
    summary: { total_definitions: definitions.length, enabled_definitions: enabled, total_instances: total },
    notes,
  };
}
