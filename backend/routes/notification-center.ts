/**
 * Notification Center — unified alert/event stream.
 *
 * READ-ONLY. NEVER-THROWS. NO DATA DUPLICATION.
 * Live-derives notifications from real platform tables into one uniform shape,
 * classified by SEVERITY (critical | warning | info | success) and by CATEGORY
 * (System | Assessment | Commercial | Operational). Every source is guarded:
 * a missing table degrades that category to `available:false` (honest empty),
 * never a 500. Notifications are derived live — there is no persisted read-state,
 * so nothing is fabricated and counts always reflect the current database.
 *
 * Distinct from the Action Center (actionable inbox / Kanban): this is an
 * event/alert STREAM grouped by severity for at-a-glance monitoring.
 *
 * Uniform Notification:
 *   { id, severity, category, category_label, title, subtitle, source_table,
 *     created_at, location:{tab,label}, actions:[] }
 *
 * GET /api/admin/notifications          — notifications + categories (60s cache)
 * GET /api/admin/notifications/summary  — counts by severity/category (badge)
 * (?refresh=1 busts the cache)
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

const TTL_MS = 60_000;
const CACHE = new Map<string, { at: number; data: any }>();

async function safeRows(pool: Pool, sql: string, params: any[] = []): Promise<any[] | null> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return null; }
}

type Severity = 'critical' | 'warning' | 'info' | 'success';
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2, success: 3 };

/** map a free-text severity to a bounded notification severity (honest default = info) */
function sev(s: any, fallback: Severity = 'info'): Severity {
  const v = String(s || '').toLowerCase();
  if (/(critical|crisis|fatal|sev1|p0|high|severe|urgent|error|failed)/.test(v)) return 'critical';
  if (/(warn|medium|moderate|sev3|p2|pending|unresolved|flag)/.test(v)) return 'warning';
  if (/(success|resolved|completed|complete|done|ok|passed)/.test(v)) return 'success';
  return fallback;
}

interface Notification {
  id: string;
  severity: Severity;
  category: string;
  category_label: string;
  title: string;
  subtitle: string | null;
  source_table: string;
  created_at: string | null;
  location: { tab: string; label: string };
  actions: { key: string; label: string; tab: string }[];
}

interface CategoryDef {
  key: string;
  label: string;
  tab: string;
  tabLabel: string;
  /** returns notifications, or null if NO source exists in this DB (honest unavailable) */
  build: (pool: Pool, limit: number) => Promise<Notification[] | null>;
}

function notif(def: CategoryDef, id: any, src: string, severity: Severity,
  title: string, subtitle: string | null, createdAt: any,
  tab?: string, tabLabel?: string): Notification {
  const t = tab || def.tab, tl = tabLabel || def.tabLabel;
  return {
    id: `${def.key}:${src}:${id}`,
    severity,
    category: def.key,
    category_label: def.label,
    title: title || '(untitled)',
    subtitle: subtitle || null,
    source_table: src,
    created_at: createdAt ? new Date(createdAt).toISOString() : null,
    location: { tab: t, label: tl },
    actions: [{ key: 'open', label: `Open ${tl}`, tab: t }],
  };
}

const CATEGORIES: CategoryDef[] = [
  // ── System Alerts ─────────────────────────────────────────────────────────
  {
    key: 'system_alerts', label: 'System Alerts', tab: 'ai-governance', tabLabel: 'AI Governance Platform',
    async build(pool, limit) {
      const alerts = await safeRows(pool, `
        SELECT id, alert_name, alert_type, severity, trigger_count, last_triggered_at
        FROM aig_alerts
        WHERE coalesce(trigger_count,0) > 0 AND resolved_at IS NULL
        ORDER BY last_triggered_at DESC NULLS LAST LIMIT $1`, [limit]);
      const runs = await safeRows(pool, `
        SELECT id, workflow_id, status, error_message, created_at
        FROM aig_workflow_runs
        WHERE lower(status) IN ('failed','error','errored')
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      if (alerts == null && runs == null) return null;
      const out: Notification[] = [];
      for (const x of alerts || []) out.push(notif(this, x.id, 'aig_alerts',
        sev(x.severity, 'warning'),
        `Alert fired — ${x.alert_name || x.alert_type || 'system alert'}`,
        x.trigger_count ? `${x.trigger_count} trigger(s)` : null, x.last_triggered_at));
      for (const x of runs || []) out.push(notif(this, x.id, 'aig_workflow_runs',
        'critical', 'AI workflow run failed',
        x.error_message ? String(x.error_message).slice(0, 120) : null, x.created_at));
      return out.slice(0, limit);
    },
  },
  // ── Assessment Alerts ─────────────────────────────────────────────────────
  {
    key: 'assessment_alerts', label: 'Assessment Alerts', tab: 'reports', tabLabel: 'Reports',
    async build(pool, limit) {
      const incomplete = await safeRows(pool, `
        SELECT id, assessment_type, user_email, completion_status, loaded_at
        FROM ti_fact_assessments
        WHERE completion_status IS NOT NULL
          AND lower(completion_status) NOT IN ('completed','complete','done','finished')
        ORDER BY loaded_at DESC NULLS LAST LIMIT $1`, [limit]);
      const flags = await safeRows(pool, `
        SELECT id, detection_method, severity, reason, review_status, created_at
        FROM aig_hallucination_flags
        WHERE review_status IS NULL OR lower(review_status) IN ('pending','open','unreviewed','new')
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      if (incomplete == null && flags == null) return null;
      const out: Notification[] = [];
      for (const x of incomplete || []) out.push(notif(this, x.id, 'ti_fact_assessments',
        'warning', `Incomplete assessment — ${x.assessment_type || 'assessment'}`,
        x.user_email || null, x.loaded_at));
      for (const x of flags || []) out.push(notif(this, x.id, 'aig_hallucination_flags',
        sev(x.severity, 'warning'), `Content flagged — ${x.detection_method || 'review needed'}`,
        x.reason ? String(x.reason).slice(0, 120) : null, x.created_at,
        'ai-governance', 'AI Governance Platform'));
      return out.slice(0, limit);
    },
  },
  // ── Commercial Alerts ─────────────────────────────────────────────────────
  {
    key: 'commercial_alerts', label: 'Commercial Alerts', tab: 'employer-onboarding', tabLabel: 'Employer Onboarding',
    async build(pool, limit) {
      // Unverified employer organizations are the only real commercial-lifecycle
      // signal in this database (no payments/subscription event table exists).
      const unverified = await safeRows(pool, `
        SELECT id, name, domain, plan, verified, created_at
        FROM employer_organizations
        WHERE verified IS NOT TRUE
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      if (unverified == null) return null;
      return unverified.map(x => notif(this, x.id, 'employer_organizations',
        'info', `Employer pending verification — ${x.name || 'organization'}`,
        [x.domain, x.plan].filter(Boolean).join(' · ') || null, x.created_at));
    },
  },
  // ── Operational Alerts ────────────────────────────────────────────────────
  {
    key: 'operational_alerts', label: 'Operational Alerts', tab: 'rie-escalations', tabLabel: 'Crisis Escalations',
    async build(pool, limit) {
      const esc = await safeRows(pool, `
        SELECT id, escalation_type, severity, status, trigger_reason, created_at
        FROM rie_escalations
        WHERE status IS NULL OR lower(status) NOT IN ('resolved','closed','dismissed')
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      const uploads = await safeRows(pool, `
        SELECT id, upload_type, filename, status::text AS status, error_count, created_at
        FROM bulk_upload_jobs
        WHERE lower(status::text) IN ('failed','error') OR coalesce(error_count,0) > 0
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      const risks = await safeRows(pool, `
        SELECT id, event_type, severity, resolved, created_at
        FROM employer_risk_events
        WHERE resolved IS NOT TRUE
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      if (esc == null && uploads == null && risks == null) return null;
      const out: Notification[] = [];
      for (const x of esc || []) out.push(notif(this, x.id, 'rie_escalations',
        sev(x.severity, 'critical'), `Escalation open — ${x.escalation_type || 'crisis'}`,
        x.trigger_reason ? String(x.trigger_reason).slice(0, 120) : null, x.created_at));
      for (const x of uploads || []) out.push(notif(this, x.id, 'bulk_upload_jobs',
        'critical', `Upload job failed — ${x.upload_type || x.filename || 'job'}`,
        x.error_count ? `${x.error_count} row error(s)` : x.filename || null, x.created_at,
        'platform-audit', 'Platform Audit Log'));
      for (const x of risks || []) out.push(notif(this, x.id, 'employer_risk_events',
        sev(x.severity, 'warning'), `Risk event unresolved — ${x.event_type || 'review'}`,
        null, x.created_at, 'employer-onboarding', 'Employer Onboarding'));
      return out.slice(0, limit);
    },
  },
];

async function buildNotifications(pool: Pool, perCategory: number) {
  const categories: any[] = [];
  let items: Notification[] = [];
  for (const def of CATEGORIES) {
    const built = await def.build(pool, perCategory);
    const available = built != null;
    const list = built || [];
    items = items.concat(list);
    categories.push({
      key: def.key, label: def.label, tab: def.tab, tab_label: def.tabLabel,
      available, count: list.length,
      note: available ? undefined : 'no_source_in_database',
    });
  }
  items.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });
  const bySeverity: Record<Severity, number> = { critical: 0, warning: 0, info: 0, success: 0 };
  for (const it of items) bySeverity[it.severity]++;
  return {
    generated_at: new Date().toISOString(),
    total: items.length,
    by_severity: bySeverity,
    categories,
    items,
  };
}

export function registerNotificationCenterRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
) {
  const guards = [requireAuth, requireSuperAdmin];

  const cached = async (perCategory: number, refresh: boolean) => {
    const key = `nc:${perCategory}`;
    const now = Date.now();
    const hit = CACHE.get(key);
    if (!refresh && hit && now - hit.at < TTL_MS) return hit.data;
    const data = await buildNotifications(pool, perCategory);
    CACHE.set(key, { at: now, data });
    return data;
  };

  app.get('/api/admin/notifications/summary', guards, async (req: Request, res: Response) => {
    try {
      const data = await cached(Math.max(1, Math.min(100, Number(req.query.limit) || 25)), req.query.refresh === '1');
      res.json({
        generated_at: data.generated_at, total: data.total, by_severity: data.by_severity,
        categories: data.categories.map((c: any) => ({ key: c.key, label: c.label, available: c.available, count: c.count })),
      });
    } catch (e: any) {
      res.status(200).json({ total: 0, status: 'error', error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/notifications', guards, async (req: Request, res: Response) => {
    try {
      const data = await cached(Math.max(1, Math.min(100, Number(req.query.limit) || 25)), req.query.refresh === '1');
      res.json(data);
    } catch (e: any) {
      res.status(200).json({ total: 0, categories: [], items: [], status: 'error', error: String(e?.message || e) });
    }
  });
}
