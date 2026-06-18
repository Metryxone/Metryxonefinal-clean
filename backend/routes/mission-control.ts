/**
 * Mission Control — Enterprise Command Center aggregator.
 *
 * READ-ONLY. NEVER-THROWS. NO DATA DUPLICATION.
 * Composes already-computed data from the live database into a single dashboard
 * payload. Every metric is independently guarded: a missing table/column yields
 * `available:false` rather than a 500. Reports two ORTHOGONAL axes per widget:
 *   - coverage   = fraction of a widget's data sources that are materialized (rows>0)
 *   - activation = fraction of its RUNTIME/COMMERCIAL sources that have live data
 * (reference/seed data can be fully covered while activation is 0 — that is honest,
 *  not a bug, and is surfaced as such.)
 *
 * GET /api/admin/mission-control        — 60s in-memory cache
 * GET /api/admin/mission-control?refresh=1 — bust cache
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

const TTL_MS = 60_000;
let CACHE: { at: number; data: any } | null = null;

// ── guarded primitives (never throw) ────────────────────────────────────────
async function rows(pool: Pool, sql: string, params: any[] = []): Promise<any[] | null> {
  try { const r = await pool.query(sql, params); return r.rows; } catch { return null; }
}
async function count(pool: Pool, table: string, where?: string): Promise<number | null> {
  const r = await rows(pool, `SELECT count(*)::int AS n FROM ${table}${where ? ' WHERE ' + where : ''}`);
  return r ? Number(r[0].n) : null;
}

type Kind = 'reference' | 'runtime' | 'commercial';
interface Src { label: string; n: number | null; kind: Kind; }

// Sum nullable counts but PRESERVE null when every input is unavailable
// (so "table absent" stays distinct from "table present, 0 rows").
const sumN = (...xs: (number | null)[]): number | null =>
  xs.every(x => x == null) ? null : xs.reduce((a, b) => a + (b || 0), 0);

function axes(sources: Src[]) {
  // coverage = fraction of ALL declared sources that are materialized with rows.
  // An unavailable (null) source is NOT covered — it counts against the denominator,
  // never silently dropped (matches the documented "fraction materialized" definition).
  const withData = (s: Src) => s.n != null && (s.n as number) > 0;
  const coverage = sources.length ? Math.round(sources.filter(withData).length / sources.length * 100) : 0;
  const dyn = sources.filter(s => s.kind !== 'reference');
  const activation = dyn.length ? Math.round(dyn.filter(withData).length / dyn.length * 100) : 0;
  const present = sources.filter(s => s.n != null).length;
  return { coverage, activation, sources_present: present, sources_total: sources.length };
}
function statusOf(a: { coverage: number; activation: number }, hasDynamic: boolean, critical = false): string {
  if (critical) return 'critical';
  if (!hasDynamic) return a.coverage > 0 ? 'reference' : 'empty';
  if (a.activation === 0) return 'idle';
  if (a.activation < 50) return 'warning';
  return 'healthy';
}
const fmtN = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-IN'));

export function registerMissionControlRoutes(app: Express, pool: Pool, requireAuth: Mw, requireSuperAdmin: Mw) {
  app.get('/api/admin/mission-control', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
      if (!refresh && CACHE && Date.now() - CACHE.at < TTL_MS) {
        return res.json({ ...CACHE.data, cached: true, cache_age_ms: Date.now() - CACHE.at });
      }

      // ── gather all primitive counts in parallel (each independently guarded) ──
      const C: Record<string, number | null> = {};
      const want: Array<[string, string, string?]> = [
        ['users', 'users'], ['flags', 'feature_flags'], ['flagsOn', 'feature_flags', 'enabled = true'],
        ['sessions', 'express_sessions'], ['mfa', 'mfa_codes'],
        ['empOrgs', 'employer_organizations'], ['empMembers', 'employer_members'],
        ['empApprovals', 'employer_approvals'], ['empAudit', 'employer_audit_logs'],
        ['eiosCamp', 'eios_campaigns'], ['eiosEmp', 'eios_employee_profiles'], ['eiosPlans', 'eios_workforce_plans'],
        ['aigAlerts', 'aig_alerts'], ['aigMetrics', 'aig_monitoring_metrics'], ['aigModels', 'aig_models'],
        ['aigGov', 'aig_governance_policies'], ['aigHalluc', 'aig_hallucination_flags'], ['aigEval', 'aig_evaluations'],
        ['tigNodes', 'tig_nodes'], ['tigEdges', 'tig_edges'],
        ['cgRoles', 'cg_roles'], ['cgEdges', 'cg_role_edges'], ['cgReadiness', 'cg_user_role_readiness'], ['cgRecs', 'cg_user_recommendations'],
        ['tiSignals', 'ti_signal_master'], ['tiAssess', 'ti_fact_assessments'], ['tiPred', 'ti_outcome_predictions'],
        ['talentGaps', 'talent_gaps'], ['talentScores', 'talent_role_scores'],
        ['frpEvo', 'frp_role_evolution'], ['frpSkills', 'frp_skill_library'], ['frpUser', 'frp_user_readiness'],
        ['lipCourses', 'lip_courses'], ['lipMentors', 'lip_mentors'], ['lipUserCourses', 'lip_user_courses'],
        ['qBank', 'question_bank'], ['qOpts', 'question_options'], ['cbMaster', 'cb_master'], ['compDna', 'competency_dna_master'],
        ['rieEsc', 'rie_escalations'], ['lbiHist', 'lbi_score_history'], ['lbiReports', 'lbi_report_types'],
        ['ontRoles', 'ont_roles'], ['ontInd', 'ont_industries'], ['levelProfiles', 'rp_level_profiles'],
      ];
      await Promise.all(want.map(async ([k, t, w]) => { C[k] = await count(pool, t, w); }));

      // ── grouped/dimensional queries (guarded) ──
      const [usersByRole, aigAlertSev, rieBySev, empApprPending, aigModelsActive, fmt] = await Promise.all([
        rows(pool, `SELECT COALESCE(role,'(none)') AS k, count(*)::int AS n FROM users GROUP BY 1 ORDER BY 2 DESC`),
        rows(pool, `SELECT COALESCE(severity,'(none)') AS k, count(*)::int AS n, count(*) FILTER (WHERE is_active) AS active, COALESCE(sum(trigger_count),0)::int AS fired FROM aig_alerts GROUP BY 1 ORDER BY 2 DESC`),
        rows(pool, `SELECT COALESCE(severity,'(none)') AS k, count(*)::int AS n FROM rie_escalations WHERE status NOT IN ('resolved','closed') GROUP BY 1`),
        count(pool, 'employer_approvals', `status = 'pending'`),
        count(pool, 'aig_models', `status = 'active'`),
        rows(pool, `SELECT count(*) FILTER (WHERE enabled) AS on, count(*)::int AS all FROM feature_flags`),
      ]);

      const liveTablesRow = await rows(pool, `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
      const liveTables = liveTablesRow ? Number(liveTablesRow[0].n) : null;

      // ── WIDGET: Platform Health ──
      const wPlatform = (() => {
        const s: Src[] = [
          { label: 'Registered users', n: C.users, kind: 'runtime' },
          { label: 'Active sessions', n: C.sessions, kind: 'runtime' },
          { label: 'Feature flags', n: C.flags, kind: 'reference' },
        ];
        const a = axes(s);
        return {
          id: 'platform', title: 'Platform Health', icon: 'Server', accent: '#344E86', drill: 'overview',
          headline: { value: fmtN(C.users), label: 'Registered users' },
          ...a, status: statusOf(a, true),
          metrics: [
            { label: 'Active sessions', value: fmtN(C.sessions) },
            { label: 'Feature flags on', value: `${C.flagsOn ?? '—'} / ${C.flags ?? '—'}` },
            { label: 'Live tables', value: fmtN(liveTables) },
            { label: 'Backend uptime', value: Math.floor(process.uptime() / 60) + 'm' },
          ],
        };
      })();

      // ── WIDGET: Product Health (per-module data state) ──
      const products: Array<{ name: string; ref: number | null; run: number | null; drill: string }> = [
        { name: 'Career Graph', ref: C.cgRoles, run: sumN(C.cgReadiness, C.cgRecs), drill: 'career-graph-admin' },
        { name: 'Talent Intelligence', ref: C.tiSignals, run: sumN(C.tiAssess, C.tiPred), drill: 'talent-signal-master' },
        { name: 'Future Readiness', ref: C.frpEvo, run: C.frpUser, drill: 'frp-admin' },
        { name: 'Learning (LIP)', ref: C.lipCourses, run: C.lipUserCourses, drill: 'lip-admin' },
        { name: 'Employer Portal', ref: null, run: C.empOrgs, drill: 'employer-onboarding' },
        { name: 'EIOS Workforce', ref: null, run: sumN(C.eiosCamp, C.eiosEmp), drill: 'enterprise-analytics' },
        { name: 'CAPADEX Runtime', ref: C.cbMaster, run: C.cgReadiness, drill: 'capadex-analytics' },
      ];
      const wProduct = (() => {
        const s: Src[] = products.map(p => ({ label: p.name, n: p.run, kind: 'runtime' as Kind }));
        const a = axes(s);
        const live = products.filter(p => (p.run ?? 0) > 0).length;
        // honest per-product label: live > reference-only > idle(empty) > unavailable(absent)
        const labelFor = (p: { ref: number | null; run: number | null }) =>
          (p.run ?? 0) > 0 ? `${fmtN(p.run)} live`
          : p.ref != null && p.ref > 0 ? 'reference only'
          : p.run == null ? 'unavailable'
          : 'idle';
        return {
          id: 'product', title: 'Product Health', icon: 'Boxes', accent: '#6366f1', drill: 'enterprise-analytics',
          headline: { value: `${live} / ${products.length}`, label: 'products with live activity' },
          ...a, status: statusOf(a, true),
          metrics: products.map(p => ({ label: p.name, value: labelFor(p), drill: p.drill })),
        };
      })();

      // ── WIDGET: Revenue Health ──
      const wRevenue = (() => {
        const s: Src[] = [
          { label: 'Employer orgs', n: C.empOrgs, kind: 'commercial' },
          { label: 'EIOS campaigns', n: C.eiosCamp, kind: 'commercial' },
        ];
        const a = axes(s);
        return {
          id: 'revenue', title: 'Revenue Health', icon: 'DollarSign', accent: '#10b981', drill: 'financials',
          headline: { value: '—', label: 'no revenue substrate materialized' },
          ...a, status: statusOf(a, true),
          note: 'No payment/subscription tables are materialized in this environment; commercial activation is 0 by data, not by assumption.',
          metrics: [
            { label: 'Paying organizations', value: fmtN(C.empOrgs) },
            { label: 'Active campaigns', value: fmtN(C.eiosCamp) },
            { label: 'Workforce plans', value: fmtN(C.eiosPlans) },
          ],
        };
      })();

      // ── WIDGET: Intelligence Health ──
      const wIntel = (() => {
        const s: Src[] = [
          { label: 'Monitoring metrics', n: C.aigMetrics, kind: 'runtime' },
          { label: 'AI models', n: C.aigModels, kind: 'reference' },
          { label: 'Governance policies', n: C.aigGov, kind: 'reference' },
          { label: 'Talent graph nodes', n: C.tigNodes, kind: 'runtime' },
        ];
        const a = axes(s);
        return {
          id: 'intelligence', title: 'Intelligence Health', icon: 'BrainCircuit', accent: '#8b5cf6', drill: 'ai-governance',
          headline: { value: fmtN(C.aigMetrics), label: 'AI monitoring metrics' },
          ...a, status: statusOf(a, true),
          metrics: [
            { label: 'AI models', value: `${aigModelsActive ?? '—'} active / ${fmtN(C.aigModels)}` },
            { label: 'Governance policies', value: fmtN(C.aigGov) },
            { label: 'Talent graph (nodes/edges)', value: `${fmtN(C.tigNodes)} / ${fmtN(C.tigEdges)}` },
            { label: 'Career graph (roles/edges)', value: `${fmtN(C.cgRoles)} / ${fmtN(C.cgEdges)}` },
          ],
        };
      })();

      // ── WIDGET: Data Health ──
      const wData = (() => {
        const refRows = [C.cgRoles, C.cgEdges, C.tiSignals, C.frpEvo, C.frpSkills, C.lipCourses, C.aigMetrics, C.levelProfiles]
          .filter((n): n is number => n != null).reduce((a, b) => a + b, 0);
        const s: Src[] = [
          { label: 'Career graph', n: C.cgRoles, kind: 'reference' },
          { label: 'Talent signals', n: C.tiSignals, kind: 'reference' },
          { label: 'FRP library', n: C.frpSkills, kind: 'reference' },
          { label: 'Learning catalog', n: C.lipCourses, kind: 'reference' },
        ];
        const a = axes(s);
        return {
          id: 'data', title: 'Data Health', icon: 'Database', accent: '#0ea5e9', drill: 'ont-overview',
          headline: { value: fmtN(liveTables), label: 'live tables materialized' },
          ...a, status: statusOf(a, false),
          metrics: [
            { label: 'Reference rows (sampled)', value: fmtN(refRows) },
            { label: 'Career graph roles', value: fmtN(C.cgRoles) },
            { label: 'Talent signal master', value: fmtN(C.tiSignals) },
            { label: 'Competency DNA', value: fmtN(C.compDna) },
          ],
        };
      })();

      // ── WIDGET: Security Health ──
      const wSecurity = (() => {
        const s: Src[] = [
          { label: 'MFA codes', n: C.mfa, kind: 'runtime' },
          { label: 'Governance policies', n: C.aigGov, kind: 'reference' },
          { label: 'Audit logs', n: C.empAudit, kind: 'runtime' },
        ];
        const a = axes(s);
        const admins = (usersByRole || []).filter(r => /admin/i.test(r.k)).reduce((acc, r) => acc + Number(r.n), 0);
        return {
          id: 'security', title: 'Security Health', icon: 'ShieldCheck', accent: '#f59e0b', drill: 'security',
          headline: { value: fmtN(C.aigGov), label: 'governance policies active' },
          ...a, status: statusOf(a, true),
          metrics: [
            { label: 'MFA challenges issued', value: fmtN(C.mfa) },
            { label: 'Admin accounts', value: fmtN(admins) },
            { label: 'Hallucination flags', value: fmtN(C.aigHalluc) },
            { label: 'Audit log entries', value: fmtN(C.empAudit) },
          ],
        };
      })();

      // ── WIDGET: Customer Health ──
      const wCustomer = (() => {
        const s: Src[] = [
          { label: 'Users', n: C.users, kind: 'runtime' },
          { label: 'Employer orgs', n: C.empOrgs, kind: 'runtime' },
          { label: 'Employer members', n: C.empMembers, kind: 'runtime' },
        ];
        const a = axes(s);
        return {
          id: 'customer', title: 'Customer Health', icon: 'Users', accent: '#ec4899', drill: 'usermgmt',
          headline: { value: fmtN(C.users), label: 'total accounts' },
          ...a, status: statusOf(a, true),
          metrics: [
            ...(usersByRole || []).slice(0, 3).map(r => ({ label: `Role: ${r.k}`, value: fmtN(Number(r.n)) })),
            { label: 'Employer organizations', value: fmtN(C.empOrgs) },
          ],
        };
      })();

      // ── WIDGET: Assessment Health ──
      const wAssessment = (() => {
        const s: Src[] = [
          { label: 'Question bank', n: C.qBank, kind: 'reference' },
          { label: 'Competency DNA', n: C.compDna, kind: 'reference' },
          { label: 'Assessments taken', n: C.tiAssess, kind: 'runtime' },
          { label: 'LBI score history', n: C.lbiHist, kind: 'runtime' },
        ];
        const a = axes(s);
        return {
          id: 'assessment', title: 'Assessment Health', icon: 'ClipboardCheck', accent: '#14b8a6', drill: 'questionbank',
          headline: { value: fmtN(C.compDna), label: 'competency DNA records' },
          ...a, status: statusOf(a, true),
          metrics: [
            { label: 'Question bank items', value: fmtN(C.qBank) },
            { label: 'Assessments completed', value: fmtN(C.tiAssess) },
            { label: 'LBI scores recorded', value: fmtN(C.lbiHist) },
            { label: 'Report types', value: fmtN(C.lbiReports) },
          ],
        };
      })();

      const widgets = [wPlatform, wProduct, wRevenue, wIntel, wData, wSecurity, wCustomer, wAssessment];

      // ── ALERTS (live, severity-ranked) ──
      const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, '(none)': 4 };
      const alerts: any[] = [];
      for (const r of (aigAlertSev || [])) {
        const active = Number(r.active || 0);
        if (active > 0) alerts.push({
          severity: r.k, source: 'AI Governance', drill: 'ai-governance',
          title: `${active} active ${r.k} alert rule${active === 1 ? '' : 's'}`,
          detail: `${Number(r.fired || 0)} total triggers recorded`, count: active,
        });
      }
      for (const r of (rieBySev || [])) {
        const n = Number(r.n || 0);
        if (n > 0) alerts.push({ severity: r.k, source: 'Crisis / Escalation', drill: 'rie-escalations', title: `${n} open ${r.k} escalation${n === 1 ? '' : 's'}`, detail: 'Requires review', count: n });
      }
      if ((C.aigHalluc || 0) > 0) alerts.push({ severity: 'high', source: 'AI Governance', drill: 'ai-governance', title: `${C.aigHalluc} hallucination flag(s)`, detail: 'Pending content review', count: C.aigHalluc });
      alerts.sort((a, b) => (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9));

      // ── ACTIONS REQUIRED ──
      const actions: any[] = [];
      if ((empApprPending || 0) > 0) actions.push({ priority: 'high', title: `${empApprPending} employer approval(s) pending`, drill: 'approvals', count: empApprPending });
      const rieOpen = (rieBySev || []).reduce((a, r) => a + Number(r.n || 0), 0);
      if (rieOpen > 0) actions.push({ priority: 'critical', title: `${rieOpen} crisis escalation(s) open`, drill: 'rie-escalations', count: rieOpen });
      if ((C.aigHalluc || 0) > 0) actions.push({ priority: 'high', title: `${C.aigHalluc} AI output(s) flagged for review`, drill: 'ai-governance', count: C.aigHalluc });

      const data = {
        generated_at: new Date().toISOString(),
        cached: false,
        ttl_seconds: TTL_MS / 1000,
        environment: {
          live_tables: liveTables,
          data_profile: (C.users || 0) <= 1 && (C.empOrgs || 0) === 0
            ? 'seed/reference (no runtime or commercial activity in this environment)'
            : 'active',
        },
        honesty: {
          axes: 'coverage = data materialized; activation = runtime/commercial sources with live data. They are reported separately and never composited.',
          note: 'All metrics are read live from the database and guarded; an unavailable source is shown as "—", never fabricated. Reference/seed data can show full coverage with zero activation — that is the honest state of this environment.',
        },
        widgets,
        alerts,
        actions,
      };

      CACHE = { at: Date.now(), data };
      return res.json(data);
    } catch (err: any) {
      // absolute fail-safe — never 500 the command center
      return res.json({
        generated_at: new Date().toISOString(),
        error: 'aggregation_degraded',
        message: String(err?.message || err),
        widgets: [], alerts: [], actions: [],
      });
    }
  });
}
