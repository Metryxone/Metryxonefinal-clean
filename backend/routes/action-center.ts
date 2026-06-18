/**
 * Action Center — centralized action inbox / unified action service.
 *
 * READ-ONLY. NEVER-THROWS. NO DATA DUPLICATION.
 * Aggregates ACTIONABLE items (things needing a human) from across the platform
 * into one uniform shape, classified into 8 categories. Each source is guarded:
 * a missing table degrades that category to `available:false` (honest empty),
 * never a 500. Categories with no backing source in this database are reported
 * as `available:false` rather than fabricated.
 *
 * Uniform ActionItem:
 *   { id, category, category_label, title, subtitle, priority, status,
 *     source_table, created_at, location:{tab,label}, actions:[] }
 * priority ∈ critical|high|medium|low (derived from real severity, never tuned).
 *
 * GET /api/admin/action-center           — categories + items (60s cache)
 * GET /api/admin/action-center/summary   — counts only (sidebar badge)
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

type Priority = 'critical' | 'high' | 'medium' | 'low';
const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** map a free-text severity to a bounded priority (honest default = medium) */
function sev(s: any, fallback: Priority = 'medium'): Priority {
  const v = String(s || '').toLowerCase();
  if (/(critical|crisis|fatal|sev1|p0)/.test(v)) return 'critical';
  if (/(high|severe|urgent|major|sev2|p1)/.test(v)) return 'high';
  if (/(low|minor|info|trivial|p3)/.test(v)) return 'low';
  if (/(medium|moderate|warn|sev3|p2)/.test(v)) return 'medium';
  return fallback;
}

interface ActionItem {
  id: string;
  category: string;
  category_label: string;
  title: string;
  subtitle: string | null;
  priority: Priority;
  status: string | null;
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
  /** returns items, or null if NO source exists in this DB (honest unavailable) */
  build: (pool: Pool, limit: number) => Promise<ActionItem[] | null>;
}

function item(def: CategoryDef, id: any, src: string, title: string, subtitle: string | null,
  priority: Priority, status: string | null, createdAt: any,
  tab?: string, tabLabel?: string): ActionItem {
  const t = tab || def.tab, tl = tabLabel || def.tabLabel;
  return {
    id: `${def.key}:${src}:${id}`,
    category: def.key,
    category_label: def.label,
    title: title || '(untitled)',
    subtitle: subtitle || null,
    priority,
    status: status || null,
    source_table: src,
    created_at: createdAt ? new Date(createdAt).toISOString() : null,
    location: { tab: t, label: tl },
    actions: [{ key: 'review', label: `Review in ${tl}`, tab: t }],
  };
}

const CATEGORIES: CategoryDef[] = [
  {
    key: 'pending_approvals', label: 'Pending Approvals', tab: 'approvals', tabLabel: 'Approval Workflow',
    async build(pool, limit) {
      const r = await safeRows(pool, `
        SELECT id, resource_type, action, requested_by, status, created_at, expires_at
        FROM employer_approvals
        WHERE lower(status) IN ('pending','awaiting','open','requested')
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      if (r == null) return null;
      const now = Date.now();
      return r.map(x => {
        const expiring = x.expires_at && new Date(x.expires_at).getTime() - now < 86400000;
        return item(this, x.id, 'employer_approvals',
          `${x.action || 'Approve'} — ${x.resource_type || 'resource'}`,
          x.requested_by ? `Requested by ${x.requested_by}` : null,
          expiring ? 'high' : 'medium', x.status, x.created_at);
      });
    },
  },
  {
    key: 'failed_jobs', label: 'Failed Jobs', tab: 'platform-audit', tabLabel: 'Platform Audit Log',
    async build(pool, limit) {
      const uploads = await safeRows(pool, `
        SELECT id, upload_type, filename, status::text AS status, error_count, created_at
        FROM bulk_upload_jobs
        WHERE lower(status::text) IN ('failed','error') OR coalesce(error_count,0) > 0
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      const runs = await safeRows(pool, `
        SELECT id, workflow_id, status, error_message, created_at
        FROM aig_workflow_runs
        WHERE lower(status) IN ('failed','error','errored')
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      if (uploads == null && runs == null) return null;
      const out: ActionItem[] = [];
      for (const x of uploads || []) out.push(item(this, x.id, 'bulk_upload_jobs',
        `Upload failed — ${x.upload_type || x.filename || 'job'}`,
        x.error_count ? `${x.error_count} row error(s)` : x.filename || null,
        'high', x.status, x.created_at));
      for (const x of runs || []) out.push(item(this, x.id, 'aig_workflow_runs',
        'AI workflow run failed', x.error_message ? String(x.error_message).slice(0, 120) : null,
        'high', x.status, x.created_at, 'ai-governance', 'AI Governance Platform'));
      return out.slice(0, limit);
    },
  },
  {
    key: 'assessment_issues', label: 'Assessment Issues', tab: 'reports', tabLabel: 'Reports',
    async build(pool, limit) {
      const r = await safeRows(pool, `
        SELECT id, assessment_type, user_email, completion_status, loaded_at
        FROM ti_fact_assessments
        WHERE completion_status IS NOT NULL
          AND lower(completion_status) NOT IN ('completed','complete','done','finished')
        ORDER BY loaded_at DESC NULLS LAST LIMIT $1`, [limit]);
      if (r == null) return null;
      return r.map(x => item(this, x.id, 'ti_fact_assessments',
        `Incomplete — ${x.assessment_type || 'assessment'}`,
        x.user_email || null, 'medium', x.completion_status, x.loaded_at));
    },
  },
  {
    key: 'data_quality_issues', label: 'Data Quality Issues', tab: 'ai-governance', tabLabel: 'AI Governance Platform',
    async build(pool, limit) {
      const r = await safeRows(pool, `
        SELECT id, detection_method, severity, reason, review_status, created_at
        FROM aig_hallucination_flags
        WHERE review_status IS NULL OR lower(review_status) IN ('pending','open','unreviewed','new')
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      if (r == null) return null;
      return r.map(x => item(this, x.id, 'aig_hallucination_flags',
        `Flagged content — ${x.detection_method || 'review needed'}`,
        x.reason ? String(x.reason).slice(0, 120) : null,
        sev(x.severity), x.review_status, x.created_at));
    },
  },
  {
    key: 'employer_requests', label: 'Employer Requests', tab: 'employer-onboarding', tabLabel: 'Employer Onboarding',
    async build(pool, limit) {
      const unverified = await safeRows(pool, `
        SELECT id, name, domain, plan, created_at
        FROM employer_organizations
        WHERE verified IS NOT TRUE
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      const risks = await safeRows(pool, `
        SELECT id, event_type, severity, created_at
        FROM employer_risk_events
        WHERE resolved IS NOT TRUE
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      if (unverified == null && risks == null) return null;
      const out: ActionItem[] = [];
      for (const x of unverified || []) out.push(item(this, x.id, 'employer_organizations',
        `Verify employer — ${x.name || 'organization'}`,
        [x.domain, x.plan].filter(Boolean).join(' · ') || null, 'medium', 'unverified', x.created_at));
      for (const x of risks || []) out.push(item(this, x.id, 'employer_risk_events',
        `Risk event — ${x.event_type || 'review'}`, null, sev(x.severity, 'high'), 'unresolved', x.created_at));
      return out.slice(0, limit);
    },
  },
  {
    key: 'institution_requests', label: 'Institution Requests', tab: 'institutions', tabLabel: 'Institutions',
    async build() {
      // No dedicated institution-request source exists in this database.
      return null;
    },
  },
  {
    key: 'support_requests', label: 'Support Requests', tab: 'usermgmt', tabLabel: 'User Management',
    async build() {
      // No support/ticket source exists in this database.
      return null;
    },
  },
  {
    key: 'security_alerts', label: 'Security Alerts', tab: 'rie-escalations', tabLabel: 'Crisis Escalations',
    async build(pool, limit) {
      const esc = await safeRows(pool, `
        SELECT id, escalation_type, severity, status, trigger_reason, created_at
        FROM rie_escalations
        WHERE status IS NULL OR lower(status) NOT IN ('resolved','closed','dismissed')
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      const alerts = await safeRows(pool, `
        SELECT id, alert_name, alert_type, severity, trigger_count, last_triggered_at
        FROM aig_alerts
        WHERE coalesce(trigger_count,0) > 0 AND resolved_at IS NULL AND acknowledged_at IS NULL
        ORDER BY last_triggered_at DESC NULLS LAST LIMIT $1`, [limit]);
      const audit = await safeRows(pool, `
        SELECT id, action, resource_name, risk_score, created_at
        FROM employer_audit_logs
        WHERE coalesce(risk_score,0) >= 70
        ORDER BY created_at DESC NULLS LAST LIMIT $1`, [limit]);
      if (esc == null && alerts == null && audit == null) return null;
      const out: ActionItem[] = [];
      for (const x of esc || []) out.push(item(this, x.id, 'rie_escalations',
        `Escalation — ${x.escalation_type || 'crisis'}`,
        x.trigger_reason ? String(x.trigger_reason).slice(0, 120) : null,
        sev(x.severity, 'critical'), x.status, x.created_at));
      for (const x of alerts || []) out.push(item(this, x.id, 'aig_alerts',
        `Alert fired — ${x.alert_name || x.alert_type || 'alert'}`,
        x.trigger_count ? `${x.trigger_count} trigger(s)` : null,
        sev(x.severity, 'high'), 'active', x.last_triggered_at, 'ai-governance', 'AI Governance Platform'));
      for (const x of audit || []) out.push(item(this, x.id, 'employer_audit_logs',
        `High-risk action — ${x.action || 'audit'}`,
        x.resource_name || null, 'high', `risk ${x.risk_score}`, x.created_at, 'security', 'Security & Audit'));
      return out.slice(0, limit);
    },
  },
];

async function buildActionCenter(pool: Pool, perCategory: number) {
  const categories: any[] = [];
  let items: ActionItem[] = [];
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
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });
  const byPriority: Record<Priority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const it of items) byPriority[it.priority]++;
  return {
    generated_at: new Date().toISOString(),
    total: items.length,
    by_priority: byPriority,
    categories,
    items,
  };
}

export function registerActionCenterRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
) {
  const guards = [requireAuth, requireSuperAdmin];

  const cached = async (perCategory: number, refresh: boolean) => {
    const key = `ac:${perCategory}`;
    const now = Date.now();
    const hit = CACHE.get(key);
    if (!refresh && hit && now - hit.at < TTL_MS) return hit.data;
    const data = await buildActionCenter(pool, perCategory);
    CACHE.set(key, { at: now, data });
    return data;
  };

  app.get('/api/admin/action-center/summary', guards, async (req: Request, res: Response) => {
    try {
      const data = await cached(Math.max(1, Math.min(100, Number(req.query.limit) || 25)), req.query.refresh === '1');
      res.json({
        generated_at: data.generated_at, total: data.total, by_priority: data.by_priority,
        categories: data.categories.map((c: any) => ({ key: c.key, label: c.label, available: c.available, count: c.count })),
      });
    } catch (e: any) {
      res.status(200).json({ total: 0, status: 'error', error: String(e?.message || e) });
    }
  });

  app.get('/api/admin/action-center', guards, async (req: Request, res: Response) => {
    try {
      const data = await cached(Math.max(1, Math.min(100, Number(req.query.limit) || 25)), req.query.refresh === '1');
      res.json(data);
    } catch (e: any) {
      res.status(200).json({ total: 0, categories: [], items: [], status: 'error', error: String(e?.message || e) });
    }
  });
}
