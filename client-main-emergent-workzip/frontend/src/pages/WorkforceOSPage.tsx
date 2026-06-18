import { useEffect, useState, useMemo } from 'react';
import WorkforceOSV2Panel from '../components/career/WorkforceOSV2Panel';

interface Props {
  onNavigate?: (screen: string) => void;
}

type Bundle = {
  ok: boolean;
  tenant_id: number;
  workforce_risks: any[];
  top_obsolete_competencies: any[];
  ai_exposure_top: any[];
  emerging_roles: any[];
  fairness_summary: any[];
  open_disputes: any[];
  recent_roi: any[];
  macro_trends: any[];
  language_policy: { allowed: string[]; disallowed: string[] };
  methodology_versions: Record<string, string>;
};

const sevColor: Record<string, string> = {
  critical: '#b91c1c', high: '#ea580c', medium: '#ca8a04', low: '#16a34a',
};
const tierColor: Record<string, string> = {
  A: '#16a34a', B: '#65a30d', C: '#ca8a04', D: '#ea580c', provisional: '#9ca3af',
};

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>{title}</h3>
      {subtitle && <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#6b7280' }}>{subtitle}</p>}
      <div style={{ marginTop: subtitle ? 0 : 12 }}>{children}</div>
    </section>
  );
}

export default function WorkforceOSPage({ onNavigate }: Props) {
  const [tenantId, setTenantId] = useState<number>(1);
  const [tenants, setTenants] = useState<any[]>([]);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [activeDomain, setActiveDomain] = useState<
    'overview' | 'predictive' | 'market' | 'fairness' | 'disputes' | 'rbac' | 'roi' | 'audit'
  >('overview');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/wos/tenants').then(r => r.json()).then(j => setTenants(j.tenants ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true); setErr(null);
    fetch(`/api/wos/dashboard?tenant_id=${tenantId}`)
      .then(r => r.json())
      .then((j: Bundle) => { if (!j.ok) throw new Error('not ok'); setBundle(j); })
      .catch(e => setErr(e?.message ?? 'failed to load'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const versions = bundle?.methodology_versions ?? {};

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>
              Phase 5 · Workforce OS
            </div>
            <h1 style={{ margin: '4px 0 6px', fontSize: 28, color: '#111827' }}>Workforce Intelligence Operating System</h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: 14, maxWidth: 740 }}>
              Multi-tenant view across market intelligence, predictive workforce signals, fairness monitoring,
              dispute & override workflow, RBAC, and learning ROI. All metrics are developmental signals — never
              hiring or promotion assertions.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: '#374151' }}>Tenant:</label>
            <select value={tenantId} onChange={e => setTenantId(Number(e.target.value))}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
              {tenants.length === 0 && <option value={1}>Demo (1)</option>}
              {tenants.map((t: any) => (
                <option key={t.id} value={t.id}>{t.tenant_name} ({t.tenant_type})</option>
              ))}
            </select>
            <button onClick={() => onNavigate?.('landing')} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff',
              color: '#374151', fontSize: 13, cursor: 'pointer',
            }}>← Home</button>
          </div>
        </div>

        {/* Phase 5 V2 — additive predictive depth (forecasting, scenario, drift, ABAC, ROI) */}
        <WorkforceOSV2Panel tenantId={tenantId} />

        {/* Version chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.entries(versions).map(([k, v]) => (
            <span key={k} style={{
              padding: '3px 8px', borderRadius: 4, background: '#eef2ff',
              color: '#3730a3', fontSize: 11, fontFamily: 'monospace',
            }}>{k}@{v as string}</span>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
          {(['overview','predictive','market','fairness','disputes','rbac','roi','audit'] as const).map(t => (
            <button key={t} onClick={() => setActiveDomain(t)} style={{
              padding: '10px 16px', background: 'none', border: 'none',
              borderBottom: activeDomain === t ? '2px solid #4f46e5' : '2px solid transparent',
              color: activeDomain === t ? '#4f46e5' : '#6b7280',
              fontSize: 13, fontWeight: activeDomain === t ? 600 : 500, cursor: 'pointer',
              textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading workforce intelligence…</div>}
        {err && <div style={{ padding: 16, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>Failed to load: {err}</div>}

        {bundle && !loading && (
          <>
            {/* OVERVIEW */}
            {activeDomain === 'overview' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                  <StatCard label="Workforce risks" value={bundle.workforce_risks.length} sub={`${bundle.workforce_risks.filter(r => r.severity === 'critical' || r.severity === 'high').length} elevated`} />
                  <StatCard label="Open disputes" value={bundle.open_disputes.filter((d: any) => d.status === 'open' || d.status === 'in_review').length} />
                  <StatCard label="Emerging roles" value={bundle.emerging_roles.length} />
                  <StatCard label="ROI snapshots" value={bundle.recent_roi.length} />
                </div>

                <Section title="Workforce Risk Signal" subtitle="Current snapshot across the tenant — bands are developmental">
                  <RiskTable rows={bundle.workforce_risks.slice(0, 8)} />
                </Section>

                <Section title="Macro Labour Trends" subtitle="Top macro signals captured from market intelligence ingest">
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {bundle.macro_trends.slice(0, 6).map((t: any, i: number) => (
                      <li key={i} style={{ marginBottom: 6, fontSize: 13, color: '#374151' }}>
                        <strong>{(t.context as any)?.headline ?? (t.context as any)?.trend ?? 'Trend'}</strong>
                        {' · '}
                        <span style={{ color: t.direction === 'up' ? '#16a34a' : t.direction === 'down' ? '#dc2626' : '#6b7280' }}>
                          {t.direction} {t.metric_value} {t.metric_unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              </>
            )}

            {/* PREDICTIVE */}
            {activeDomain === 'predictive' && (
              <>
                <Section title="Workforce Risks" subtitle="Risk type × severity across the org">
                  <RiskTable rows={bundle.workforce_risks} />
                </Section>
                <Section title="Top Obsolete-Risk Competencies" subtitle="Highest obsolescence pressure over 24-month horizon">
                  <ObsolescenceTable rows={bundle.top_obsolete_competencies} />
                </Section>
                <Section title="AI Disruption Exposure" subtitle="Net = exposure − augmentation. Higher net = more pressure for human-AI rebalancing.">
                  <AiExposureGrid rows={bundle.ai_exposure_top} />
                </Section>
                <Section title="Emerging Roles" subtitle="Composite roles forming in the market">
                  {bundle.emerging_roles.length === 0
                    ? <em style={{ color: '#6b7280', fontSize: 13 }}>No emerging roles flagged yet.</em>
                    : <EmergingRolesList rows={bundle.emerging_roles} />}
                </Section>
              </>
            )}

            {/* MARKET */}
            {activeDomain === 'market' && <MarketPanel tenantId={tenantId} />}

            {/* FAIRNESS */}
            {activeDomain === 'fairness' && <FairnessPanel summary={bundle.fairness_summary} />}

            {/* DISPUTES */}
            {activeDomain === 'disputes' && (
              <Section title="Open & Recent Disputes" subtitle="Filed by users; reviewable by governance role-holders">
                <DisputesTable rows={bundle.open_disputes} />
              </Section>
            )}

            {/* RBAC */}
            {activeDomain === 'rbac' && <RbacPanel />}

            {/* ROI */}
            {activeDomain === 'roi' && (
              <Section title="Learning ROI Snapshots" subtitle="Intervention → org outcome signal. Developmental estimate, never guaranteed return.">
                <RoiTable rows={bundle.recent_roi} />
              </Section>
            )}

            {/* AUDIT (Gap #4) */}
            {activeDomain === 'audit' && (
              <Section title="Audit Trail" subtitle="Recent governance events captured in wos_audit_logs. Tenant-scoped.">
                <AuditTable tenantId={tenantId} />
              </Section>
            )}
          </>
        )}

        {bundle && (
          <div style={{ marginTop: 16, padding: 12, background: '#f3f4f6', borderRadius: 8, fontSize: 11, color: '#6b7280' }}>
            <strong>Language policy:</strong> {bundle.language_policy.allowed.slice(0, 6).join(' · ')} …
            &nbsp;<strong style={{ color: '#991b1b' }}>Never:</strong> {bundle.language_policy.disallowed.slice(0, 4).join(' · ')} …
          </div>
        )}
      </div>
    </div>
  );
}

function AuditTable({ tenantId }: { tenantId: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    setLoading(true); setErr(null);
    const qs = new URLSearchParams({ tenant_id: String(tenantId), limit: '100' });
    if (statusFilter) qs.set('status', statusFilter);
    fetch(`/api/wos/audit?${qs.toString()}`)
      .then(r => r.json())
      .then(j => { if (!j.ok) throw new Error(j.error ?? 'failed'); setRows(j.audit ?? []); })
      .catch(e => setErr(e?.message ?? 'failed'))
      .finally(() => setLoading(false));
  }, [tenantId, statusFilter]);

  const fmt = (ts: string) => { try { return new Date(ts).toLocaleString(); } catch { return ts; } };
  const badge = (s: string) => {
    const c = s === 'ok' ? '#16a34a' : s === 'denied' ? '#b91c1c' : s === 'error' ? '#dc2626' : '#ca8a04';
    return <span style={{ padding: '2px 6px', background: c, color: '#fff', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{s}</span>;
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', fontSize: 12 }}>
        <label style={{ color: '#6b7280' }}>Status filter:</label>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
                data-testid="audit-status-filter">
          <option value="">All</option>
          <option value="ok">ok</option>
          <option value="denied">denied</option>
          <option value="error">error</option>
          <option value="fallback">fallback</option>
        </select>
        <span style={{ color: '#9ca3af' }}>{rows.length} event{rows.length === 1 ? '' : 's'}</span>
      </div>
      {loading && <div style={{ color: '#6b7280', fontSize: 13 }}>Loading audit trail…</div>}
      {err && <div style={{ color: '#991b1b', fontSize: 13 }}>Failed: {err}</div>}
      {!loading && !err && rows.length === 0 && <em style={{ color: '#6b7280', fontSize: 13 }}>No audit events recorded for this tenant.</em>}
      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '6px 8px' }}>When</th>
              <th style={{ padding: '6px 8px' }}>Endpoint</th>
              <th style={{ padding: '6px 8px' }}>Status</th>
              <th style={{ padding: '6px 8px' }}>User</th>
              <th style={{ padding: '6px 8px' }}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                <td style={{ padding: '8px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                <td style={{ padding: '8px', fontFamily: 'monospace', color: '#374151' }}>{r.endpoint}</td>
                <td style={{ padding: '8px' }}>{badge(r.status)}</td>
                <td style={{ padding: '8px', fontFamily: 'monospace', color: '#6b7280', fontSize: 11 }}>{r.user_id ? String(r.user_id).slice(0, 8) : '—'}</td>
                <td style={{ padding: '8px', color: '#374151', fontSize: 11, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.detail ? JSON.stringify(r.detail) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: '#111827', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function RiskTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <em style={{ color: '#6b7280', fontSize: 13 }}>No risks recorded.</em>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
          <th style={{ padding: '6px 8px' }}>Type</th>
          <th style={{ padding: '6px 8px' }}>Scope</th>
          <th style={{ padding: '6px 8px' }}>Score</th>
          <th style={{ padding: '6px 8px' }}>Severity</th>
          <th style={{ padding: '6px 8px' }}>Drivers</th>
          <th style={{ padding: '6px 8px' }}>Horizon</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r: any, i: number) => (
          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ padding: '8px', fontWeight: 500 }}>{r.risk_type}</td>
            <td style={{ padding: '8px', color: '#6b7280' }}>{r.scope_type}{r.scope_ref ? `:${r.scope_ref}` : ''}</td>
            <td style={{ padding: '8px', fontFamily: 'monospace' }}>{(r.risk_score * 100).toFixed(0)}</td>
            <td style={{ padding: '8px' }}>
              <span style={{ padding: '2px 8px', background: sevColor[r.severity] ?? '#9ca3af', color: '#fff',
                             borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                {r.severity}
              </span>
            </td>
            <td style={{ padding: '8px', color: '#374151', fontSize: 12 }}>
              {(r.drivers ?? []).slice(0, 2).join(', ')}
            </td>
            <td style={{ padding: '8px', color: '#6b7280', fontSize: 12 }}>{r.horizon_months}m</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ObsolescenceTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <em style={{ color: '#6b7280', fontSize: 13 }}>No data.</em>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
          <th style={{ padding: '6px 8px' }}>Competency</th>
          <th style={{ padding: '6px 8px' }}>Obsolescence</th>
          <th style={{ padding: '6px 8px' }}>Horizon</th>
          <th style={{ padding: '6px 8px' }}>Confidence</th>
          <th style={{ padding: '6px 8px' }}>Drivers</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r: any, i: number) => (
          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ padding: '8px' }}>{r.canonical_name ?? r.competency_id}</td>
            <td style={{ padding: '8px', fontFamily: 'monospace' }}>{(r.obsolescence_score * 100).toFixed(0)}%</td>
            <td style={{ padding: '8px', color: '#6b7280' }}>{r.horizon_months}m</td>
            <td style={{ padding: '8px' }}>
              <span style={{ padding: '2px 8px', background: tierColor[r.confidence_tier] ?? '#9ca3af',
                             color: '#fff', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                {r.confidence_tier}
              </span>
            </td>
            <td style={{ padding: '8px', fontSize: 12, color: '#6b7280' }}>{(r.drivers ?? []).join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AiExposureGrid({ rows }: { rows: any[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {rows.map((r: any, i: number) => {
        const net = r.net_disruption;
        const color = net > 0.3 ? '#dc2626' : net > 0.1 ? '#ea580c' : net > -0.1 ? '#6b7280' : '#16a34a';
        return (
          <div key={i} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>{r.scope_ref}</div>
            <div style={{ color: '#6b7280' }}>Exposure: <strong>{(r.exposure_score * 100).toFixed(0)}%</strong></div>
            <div style={{ color: '#6b7280' }}>Augment: <strong>{(r.augmentation_score * 100).toFixed(0)}%</strong></div>
            <div style={{ marginTop: 6, color, fontWeight: 600 }}>Net: {(net * 100).toFixed(0)}%</div>
          </div>
        );
      })}
    </div>
  );
}

function EmergingRolesList({ rows }: { rows: any[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      {rows.map((r: any) => (
        <div key={r.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{r.emerging_role_name}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Emergence: {(r.emergence_score * 100).toFixed(0)}% · First observed {String(r.first_observed_at).slice(0, 10)}
          </div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>
            Composite of {(r.composite_competencies ?? []).length} competencies
          </div>
        </div>
      ))}
    </div>
  );
}

function MarketPanel({ tenantId: _t }: { tenantId: number }) {
  const [signals, setSignals] = useState<any[]>([]);
  const [type, setType] = useState<string>('');
  useEffect(() => {
    const q = type ? `?signal_type=${type}` : '';
    fetch(`/api/wos/market/signals${q}`).then(r => r.json()).then(j => setSignals(j.signals ?? []));
  }, [type]);
  return (
    <Section title="Market Intelligence — Recent Signals"
             subtitle="Job demand · salary shifts · AI disruption · emerging roles · macro trends">
      <div style={{ marginBottom: 12 }}>
        <select value={type} onChange={e => setType(e.target.value)} style={{
          padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #d1d5db' }}>
          <option value="">All types</option>
          {['job_demand','salary_shift','ai_disruption','emerging_role','macro_trend'].map(t =>
            <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ padding: '6px 8px' }}>Type</th><th style={{ padding: '6px 8px' }}>Scope</th>
            <th style={{ padding: '6px 8px' }}>Value</th><th style={{ padding: '6px 8px' }}>Dir</th>
            <th style={{ padding: '6px 8px' }}>Conf</th><th style={{ padding: '6px 8px' }}>Captured</th>
          </tr>
        </thead>
        <tbody>
          {signals.slice(0, 30).map((s: any) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px 8px' }}>{s.signal_type}</td>
              <td style={{ padding: '6px 8px', color: '#6b7280' }}>
                {[s.role_id, s.competency_id, s.industry_id].filter(Boolean).join('·') || 'global'}
              </td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{s.metric_value} {s.metric_unit ?? ''}</td>
              <td style={{ padding: '6px 8px', color: s.direction === 'up' ? '#16a34a' : s.direction === 'down' ? '#dc2626' : '#6b7280' }}>{s.direction ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: '#6b7280' }}>{(s.confidence * 100).toFixed(0)}%</td>
              <td style={{ padding: '6px 8px', color: '#6b7280' }}>{String(s.captured_at).slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function FairnessPanel({ summary }: { summary: any[] }) {
  const [results, setResults] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/wos/fairness/results').then(r => r.json()).then(j => setResults(j.results ?? []));
  }, []);
  return (
    <>
      <Section title="Fairness — Surface Summary" subtitle="Pass/fail count per surface across all suites">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {summary.map((s: any) => (
            <div key={s.surface} style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{s.surface}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12 }}>
                <span style={{ color: '#16a34a' }}>✓ {s.passed} passed</span>
                <span style={{ color: '#dc2626' }}>✗ {s.failed} failed</span>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Recent Fairness Results">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '6px 8px' }}>Surface</th><th style={{ padding: '6px 8px' }}>Attribute</th>
              <th style={{ padding: '6px 8px' }}>Metric</th><th style={{ padding: '6px 8px' }}>Groups</th>
              <th style={{ padding: '6px 8px' }}>Value</th><th style={{ padding: '6px 8px' }}>Threshold</th>
              <th style={{ padding: '6px 8px' }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r: any) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '6px 8px' }}>{r.surface}</td>
                <td style={{ padding: '6px 8px' }}>{r.attribute}</td>
                <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.metric}</td>
                <td style={{ padding: '6px 8px', color: '#6b7280' }}>{r.group_a} vs {r.group_b}</td>
                <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.metric_value}</td>
                <td style={{ padding: '6px 8px', color: '#6b7280' }}>{r.threshold}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                 background: r.passed ? '#dcfce7' : '#fee2e2',
                                 color:      r.passed ? '#166534' : '#991b1b' }}>
                    {r.passed ? 'PASS' : 'FAIL'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}

function DisputesTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <em style={{ color: '#6b7280', fontSize: 13 }}>No disputes.</em>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
          <th style={{ padding: '6px 8px' }}>ID</th><th style={{ padding: '6px 8px' }}>Subject</th>
          <th style={{ padding: '6px 8px' }}>Reason</th><th style={{ padding: '6px 8px' }}>Status</th>
          <th style={{ padding: '6px 8px' }}>Override</th><th style={{ padding: '6px 8px' }}>Filed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d: any) => (
          <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: 11 }}>{d.id}</td>
            <td style={{ padding: '8px' }}>{d.subject_type} · {d.subject_ref}</td>
            <td style={{ padding: '8px', color: '#6b7280' }}>{d.reason_code}</td>
            <td style={{ padding: '8px' }}>
              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                             background: d.status === 'open' ? '#fef3c7'
                                       : d.status === 'in_review' ? '#dbeafe'
                                       : d.status === 'resolved_overturned' ? '#fce7f3'
                                       : '#dcfce7',
                             color: '#374151' }}>{d.status}</span>
            </td>
            <td style={{ padding: '8px', color: '#6b7280' }}>{d.override_applied ? '✓' : ''}</td>
            <td style={{ padding: '8px', color: '#6b7280', fontSize: 12 }}>{String(d.created_at).slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RbacPanel() {
  const [roles, setRoles] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/wos/rbac/roles').then(r => r.json()).then(j => setRoles(j.roles ?? []));
    fetch('/api/wos/rbac/assignments').then(r => r.json()).then(j => setAssignments(j.assignments ?? []));
  }, []);
  return (
    <>
      <Section title="System Roles" subtitle="Permission bundles assignable to users (with optional tenant scope)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {roles.map((r: any) => (
            <div key={r.id} style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{r.role_name}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', marginTop: 2 }}>{r.id}</div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 8 }}>{r.description}</div>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(r.permissions ?? []).map((p: string) => (
                  <span key={p} style={{ padding: '2px 6px', background: '#f3f4f6', borderRadius: 3,
                                          fontSize: 10, fontFamily: 'monospace', color: '#374151' }}>{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title={`Active Role Assignments (${assignments.length})`}>
        {assignments.length === 0
          ? <em style={{ color: '#6b7280', fontSize: 13 }}>No active assignments — assign via POST /api/wos/rbac/assignments</em>
          : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '6px 8px' }}>User</th>
                  <th style={{ padding: '6px 8px' }}>Role</th>
                  <th style={{ padding: '6px 8px' }}>Tenant</th>
                  <th style={{ padding: '6px 8px' }}>Granted</th>
                </tr>
              </thead>
              <tbody>
                {assignments.slice(0, 30).map((a: any) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{a.user_id}</td>
                    <td style={{ padding: '6px 8px' }}>{a.role_id}</td>
                    <td style={{ padding: '6px 8px', color: '#6b7280' }}>{a.tenant_id ?? 'platform-wide'}</td>
                    <td style={{ padding: '6px 8px', color: '#6b7280' }}>{String(a.granted_at).slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </Section>
    </>
  );
}

function RoiTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <em style={{ color: '#6b7280', fontSize: 13 }}>No ROI snapshots yet.</em>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
          <th style={{ padding: '6px 8px' }}>Intervention</th>
          <th style={{ padding: '6px 8px' }}>Cohort</th>
          <th style={{ padding: '6px 8px' }}>Completion</th>
          <th style={{ padding: '6px 8px' }}>Capability uplift</th>
          <th style={{ padding: '6px 8px' }}>Capacity gain (hrs)</th>
          <th style={{ padding: '6px 8px' }}>Retention lift</th>
          <th style={{ padding: '6px 8px' }}>ROI index</th>
          <th style={{ padding: '6px 8px' }}>Confidence</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r: any) => (
          <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: 11 }}>{r.intervention_id}</td>
            <td style={{ padding: '8px' }}>{r.cohort_size}</td>
            <td style={{ padding: '8px' }}>{(r.completion_rate * 100).toFixed(0)}%</td>
            <td style={{ padding: '8px' }}>+{r.capability_uplift.toFixed(2)}</td>
            <td style={{ padding: '8px' }}>{Math.round(r.estimated_capacity_gain_hours)}</td>
            <td style={{ padding: '8px' }}>+{r.estimated_retention_lift_pct.toFixed(1)}%</td>
            <td style={{ padding: '8px', fontFamily: 'monospace' }}>{r.roi_index?.toFixed(3) ?? '—'}</td>
            <td style={{ padding: '8px' }}>
              <span style={{ padding: '2px 8px', background: tierColor[r.confidence_tier] ?? '#9ca3af',
                             color: '#fff', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                {r.confidence_tier}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
