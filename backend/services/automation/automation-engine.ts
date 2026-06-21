/**
 * Phase 6.13 — Automation Engine (automation_engine deliverable). READ-ONLY, never-throws.
 *
 * Composes the EXISTING substrate into an honest automation posture across the 7 process types.
 * Each type's `eligible_now` is a REAL composed count from live source tables (probed via to_regclass);
 * absent/unreadable source → null (never a fabricated 0). No external side effects, no DDL.
 */
import pg from 'pg';

const N = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`]);
    return !!r.rows[0]?.t;
  } catch { return false; }
}

async function safeScalar(pool: pg.Pool, sql: string): Promise<number | null> {
  try {
    const r = await pool.query(sql);
    return r.rows[0]?.n != null ? N(r.rows[0].n) : 0;
  } catch { return null; }
}

export interface AutomationTypeSpec {
  key: string;
  label: string;
  description: string;
  /** Source tables with the read-only eligibility query that defines "would fire now". */
  sources: { table: string; sql: string }[];
}

/** The 7 automatable processes mapped to their REAL composed eligibility sources. */
export const AUTOMATION_TYPES: AutomationTypeSpec[] = [
  {
    key: 'assessment_campaign',
    label: 'Assessment Campaigns',
    description: 'Outstanding assessment invitations across active campaigns.',
    sources: [{
      table: 'eios_campaigns',
      sql: `SELECT COALESCE(SUM(GREATEST(COALESCE(target_count,0)-COALESCE(completed_count,0),0)),0)::int AS n
            FROM eios_campaigns
            WHERE lower(coalesce(status,'active')) NOT IN ('completed','archived','cancelled','closed')`,
    }],
  },
  {
    key: 'career_review',
    label: 'Career Reviews',
    description: 'Reassessment reminders that are due and not yet sent.',
    sources: [{
      table: 'competency_reassessment_reminders',
      sql: `SELECT COUNT(*)::int AS n FROM competency_reassessment_reminders
            WHERE scheduled_date <= now() AND COALESCE(email_sent,false) = false`,
    }],
  },
  {
    key: 'employer_outreach',
    label: 'Employer Outreach',
    description: 'Pool-outreach messages drafted but not yet sent.',
    sources: [{
      table: 'employer_pool_outreach',
      sql: `SELECT COUNT(*)::int AS n FROM employer_pool_outreach
            WHERE sent_at IS NULL OR lower(coalesce(status,'pending')) NOT IN ('sent','completed','closed')`,
    }],
  },
  {
    key: 'student_followup',
    label: 'Student Follow-ups',
    description: 'CAPADEX sessions started but not completed (follow-up candidates).',
    sources: [{
      table: 'capadex_sessions',
      sql: `SELECT COUNT(*)::int AS n FROM capadex_sessions WHERE lower(coalesce(status,'')) <> 'completed'`,
    }],
  },
  {
    key: 'placement_drive',
    label: 'Placement Drives',
    description: 'Candidates in an active hiring pipeline stage.',
    sources: [{
      table: 'employer_candidates',
      sql: `SELECT COUNT(*)::int AS n FROM employer_candidates
            WHERE lower(coalesce(stage,'new')) NOT IN ('hired','rejected','withdrawn','declined','archived')`,
    }],
  },
  {
    key: 'subscription_renewal',
    label: 'Subscription Renewals',
    description: 'Subscriptions expiring within 30 days (package + recurring models).',
    sources: [
      {
        table: 'student_subscriptions',
        sql: `SELECT COUNT(*)::int AS n FROM student_subscriptions
              WHERE lower(coalesce(status,'active')) IN ('active','expiring')
                AND expiry_date IS NOT NULL AND expiry_date <= now() + interval '30 days'`,
      },
      {
        table: 'comm_subscriptions',
        sql: `SELECT COUNT(*)::int AS n FROM comm_subscriptions
              WHERE lower(coalesce(status,'active')) IN ('active','trialing','past_due','in_grace')
                AND current_period_end IS NOT NULL AND current_period_end <= now() + interval '30 days'`,
      },
    ],
  },
  {
    key: 'customer_success',
    label: 'Customer Success Actions',
    description: 'At-risk subscriptions (set to cancel, past due, paused or in grace).',
    sources: [{
      table: 'comm_subscriptions',
      sql: `SELECT COUNT(*)::int AS n FROM comm_subscriptions
            WHERE COALESCE(cancel_at_period_end,false) = true
               OR lower(coalesce(status,'')) IN ('past_due','in_grace','paused')`,
    }],
  },
];

/** Read-only eligibility for one automation type. null when NO source table is present (unmeasurable). */
export async function computeEligibleForType(
  pool: pg.Pool,
  spec: AutomationTypeSpec,
): Promise<{ eligible_now: number | null; measured: boolean; present_sources: string[] }> {
  const present: string[] = [];
  let total: number | null = null;
  for (const s of spec.sources) {
    if (!(await tableExists(pool, s.table))) continue;
    present.push(s.table);
    const n = await safeScalar(pool, s.sql);
    if (n != null) total = (total ?? 0) + n;
  }
  return { eligible_now: present.length ? total : null, measured: present.length > 0, present_sources: present };
}

export interface AutomationOverview {
  generated_at: string;
  degraded: boolean;
  automation_types: {
    key: string; label: string; description: string;
    sources: string[]; present_sources: string[];
    eligible_now: number | null; measured: boolean; partitioned: boolean;
  }[];
  totals: { types: number; measurable: number; eligible_total: number | null };
  definitions: any[];
  runs: { total: number; last_run_at: string | null; recent: any[] };
  notes: string[];
}

export async function buildAutomationOverview(pool: pg.Pool): Promise<AutomationOverview> {
  const generated_at = new Date().toISOString();
  const notes: string[] = [];
  let degraded = false;

  const types: AutomationOverview['automation_types'] = [];
  let measurable = 0;
  let eligibleTotal: number | null = null;
  for (const spec of AUTOMATION_TYPES) {
    const { eligible_now, measured, present_sources } = await computeEligibleForType(pool, spec);
    if (measured) measurable += 1; else degraded = true;
    if (eligible_now != null) eligibleTotal = (eligibleTotal ?? 0) + eligible_now;
    types.push({
      key: spec.key, label: spec.label, description: spec.description,
      sources: spec.sources.map((s) => s.table), present_sources,
      eligible_now, measured, partitioned: false,
    });
  }

  // Definitions + run ledger (additive automation_* tables; honest empties when not provisioned).
  let definitions: any[] = [];
  if (await tableExists(pool, 'automation_definitions')) {
    try {
      const r = await pool.query(
        `SELECT id, automation_key, name, automation_type, trigger_type, action_type, is_enabled, created_at, updated_at
         FROM automation_definitions ORDER BY automation_type, automation_key`);
      definitions = r.rows;
    } catch { degraded = true; }
  } else {
    notes.push('automation_definitions not provisioned — run console setup (POST /console/setup) to enable rule storage.');
  }

  let runsTotal = 0; let lastRunAt: string | null = null; let recent: any[] = [];
  if (await tableExists(pool, 'automation_runs')) {
    try {
      const c = await pool.query('SELECT COUNT(*)::int AS n, MAX(created_at) AS last FROM automation_runs');
      runsTotal = N(c.rows[0]?.n);
      lastRunAt = c.rows[0]?.last ? new Date(c.rows[0].last).toISOString() : null;
      const r = await pool.query(
        `SELECT id, automation_key, automation_type, status, eligible_count, executed_count, dry_run, created_at
         FROM automation_runs ORDER BY created_at DESC LIMIT 10`);
      recent = r.rows;
    } catch { degraded = true; }
  }

  notes.push('eligible_now figures are REAL composed counts from live source tables; absent/unreadable source → null (never a fabricated 0).');
  notes.push('Automation runs record INTENT only — no emails or external actions are dispatched by this console (executed_count stays 0 unless an external executor is wired).');

  return {
    generated_at,
    degraded,
    automation_types: types,
    totals: { types: AUTOMATION_TYPES.length, measurable, eligible_total: eligibleTotal },
    definitions,
    runs: { total: runsTotal, last_run_at: lastRunAt, recent },
    notes,
  };
}
