import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';

// ── Types ───────────────────────────────────────────────────────────────────
interface KPIRow    { metric_name: string; metric_value: number | null; metric_label: string }
interface CohortRow { cohort_key: string; cohort_label: string; period_offset: number; period_label: string; users_in_cohort: number; active_in_period: number; retention_rate: number; avg_score: number | null }
interface BenchRow  { metric: string; cohort_segment: string; p25: number | null; p50: number | null; p75: number | null; mean: number | null; sample_size: number; suppressed: boolean }
interface TableRow  { table: string; rows: number; last_refreshed: string | null; category: string }
interface TrendRow  { date_key: string; metric_name: string; metric_value: number }

interface ExecutiveData {
  kpis:       KPIRow[];
  cohorts:    CohortRow[];
  benchmarks: BenchRow[];
  predictive: Record<string, number | null>;
  trends:     TrendRow[];
  warehouse:  TableRow[];
  generated_at: string;
}

interface FeaturesData {
  summary: Record<string, number | null>;
  score_distribution: Array<{ band: string; n: number }>;
  feature_date: string;
}

interface RefreshResult {
  started_at: string; finished_at: string;
  steps: Record<string, { rows: number; duration_ms: number; error?: string }>;
  total_rows_processed: number; errors: string[];
}

// ── Fetch helpers ────────────────────────────────────────────────────────────
const apiFetch = async (url: string, opts?: RequestInit) => {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) { const t = await res.text(); throw new Error(t || res.statusText); }
  return res.json();
};

// ── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = ['#6366f1','#22d3ee','#10b981','#f59e0b','#f43f5e','#a855f7','#3b82f6','#84cc16'];
const CAT_COLORS: Record<string, string> = {
  data_lake: '#6366f1', fact: '#22d3ee', dimension: '#10b981',
  kpi: '#f59e0b', cohort: '#f43f5e', benchmark: '#a855f7',
  predictive: '#3b82f6', operational: '#94a3b8',
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, format = 'number', accent = '#6366f1' }: {
  label: string; value: number | null; format?: 'number' | 'pct' | 'score' | 'decimal'; accent?: string;
}) {
  const fmt = (v: number | null) => {
    if (v == null) return '—';
    if (format === 'pct') return (v * 100).toFixed(1) + '%';
    if (format === 'score') return v.toFixed(1);
    if (format === 'decimal') return v.toFixed(3);
    return v.toLocaleString();
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col gap-1 min-w-[140px]">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide leading-tight">{label}</span>
      <span className="text-2xl font-bold" style={{ color: accent }}>{fmt(value)}</span>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-semibold uppercase tracking-wide" style={{ background: color }}>
      {label}
    </span>
  );
}

// ── Suppressed notice ────────────────────────────────────────────────────────
function Suppressed() {
  return <span className="text-xs text-amber-600 font-medium">k &lt; 30 (suppressed)</span>;
}

// ── Retention heatmap ────────────────────────────────────────────────────────
function RetentionHeatmap({ rows }: { rows: CohortRow[] }) {
  if (!rows.length) return <p className="text-sm text-gray-400 py-8 text-center">No cohort data yet — run a full refresh to populate.</p>;
  const cohortKeys = [...new Set(rows.map(r => r.cohort_key))].slice(0, 12);
  const offsets    = [...new Set(rows.map(r => r.period_offset))].sort((a, b) => a - b);
  const byKey: Record<string, Record<number, CohortRow>> = {};
  for (const r of rows) {
    if (!byKey[r.cohort_key]) byKey[r.cohort_key] = {};
    byKey[r.cohort_key][r.period_offset] = r;
  }
  const color = (rate: number) => {
    if (rate >= 0.7) return '#10b981';
    if (rate >= 0.4) return '#f59e0b';
    if (rate >= 0.1) return '#f97316';
    return '#f43f5e';
  };
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="text-left p-2 text-gray-500 font-medium min-w-[140px]">Cohort</th>
            {offsets.map(o => (
              <th key={o} className="p-2 text-gray-500 font-medium text-center min-w-[70px]">Wk {o}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohortKeys.map(key => {
            const label = byKey[key]?.[0]?.cohort_label ?? key;
            return (
              <tr key={key} className="border-t border-gray-50">
                <td className="p-2 text-gray-700 font-medium text-xs">{label}</td>
                {offsets.map(o => {
                  const cell = byKey[key]?.[o];
                  if (!cell) return <td key={o} className="p-2 text-center text-gray-200">—</td>;
                  const rate = cell.retention_rate ?? 0;
                  return (
                    <td key={o} className="p-1 text-center">
                      <div className="rounded px-1.5 py-1 text-white text-[11px] font-semibold inline-block min-w-[48px]"
                           style={{ background: color(rate) }}
                           title={`${cell.active_in_period}/${cell.users_in_cohort} active`}>
                        {(rate * 100).toFixed(0)}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Warehouse table list ─────────────────────────────────────────────────────
function WarehouseTable({ rows }: { rows: TableRow[] }) {
  const cats = ['operational', 'data_lake', 'fact', 'dimension', 'kpi', 'cohort', 'benchmark', 'predictive'];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cats.map(cat => {
        const catRows = rows.filter(r => r.category === cat);
        if (!catRows.length) return null;
        const label = { operational:'Operational DB', data_lake:'Data Lake', fact:'Fact Tables',
          dimension:'Dimension Tables', kpi:'KPI Store', cohort:'Cohort Analysis',
          benchmark:'Benchmark Snapshots', predictive:'Predictive Feature Store' }[cat] ?? cat;
        return (
          <div key={cat} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLORS[cat] ?? '#94a3b8' }} />
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</span>
            </div>
            <table className="w-full text-xs">
              <tbody>
                {catRows.map(r => (
                  <tr key={r.table} className="border-t border-gray-50">
                    <td className="py-1.5 text-gray-600 font-mono">{r.table}</td>
                    <td className="py-1.5 text-right font-semibold text-gray-800">{r.rows.toLocaleString()}</td>
                    <td className="py-1.5 text-right text-gray-400 pl-3">
                      {r.last_refreshed ? new Date(r.last_refreshed).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ── Benchmark chart ──────────────────────────────────────────────────────────
function BenchmarkChart({ rows }: { rows: BenchRow[] }) {
  const visible = rows.filter(r => !r.suppressed && r.p50 != null);
  if (!visible.length) return (
    <div className="py-8 text-center">
      <p className="text-sm text-amber-600">All metrics suppressed — cohort below k=30.</p>
      <p className="text-xs text-gray-400 mt-1">Run a full refresh after more users complete sessions.</p>
    </div>
  );
  const data = visible.map(r => ({
    metric: r.metric.replace(/_/g,' '),
    p25: r.p25, p50: r.p50, p75: r.p75, mean: r.mean,
    n: r.sample_size,
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top:10, right:20, left:0, bottom:40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="metric" tick={{ fontSize:11 }} angle={-25} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize:11 }} />
        <Tooltip formatter={(v: any) => typeof v === 'number' ? v.toFixed(2) : v} />
        <Legend wrapperStyle={{ fontSize:11 }} />
        <Bar dataKey="p25"  name="P25"    fill="#22d3ee" opacity={0.7} radius={[3,3,0,0]} />
        <Bar dataKey="p50"  name="Median" fill="#6366f1" radius={[3,3,0,0]} />
        <Bar dataKey="p75"  name="P75"    fill="#10b981" opacity={0.8} radius={[3,3,0,0]} />
        <Bar dataKey="mean" name="Mean"   fill="#f59e0b" opacity={0.8} radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Trend sparklines ─────────────────────────────────────────────────────────
function TrendChart({ trends }: { trends: TrendRow[] }) {
  if (!trends.length) return <p className="text-sm text-gray-400 py-6 text-center">No trend data yet — run a refresh to generate KPI timeseries.</p>;
  const metricNames = [...new Set(trends.map(t => t.metric_name))];
  const byDate: Record<string, Record<string, number>> = {};
  for (const t of trends) {
    if (!byDate[t.date_key]) byDate[t.date_key] = {};
    byDate[t.date_key][t.metric_name] = t.metric_value;
  }
  const chartData = Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, vals]) => ({ date: date.slice(5), ...vals }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top:5, right:20, left:0, bottom:5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize:10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize:10 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize:11 }} />
        {metricNames.map((m, i) => (
          <Line key={m} type="monotone" dataKey={m} name={m.replace(/_/g,' ')}
                stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Score distribution pie ────────────────────────────────────────────────────
function ScoreDistPie({ dist }: { dist: Array<{ band: string; n: number }> }) {
  if (!dist.length || dist.every(d => d.n === 0)) return <p className="text-sm text-gray-400 py-6 text-center">No scored users yet.</p>;
  const BAND_COLORS: Record<string, string> = {
    unscored: '#e2e8f0', needs_support: '#f43f5e', developing: '#f59e0b',
    progressing: '#22d3ee', high_performer: '#10b981',
  };
  const BAND_LABELS: Record<string, string> = {
    unscored: 'Unscored', needs_support: 'Needs Support (<40)',
    developing: 'Developing (40–59)', progressing: 'Progressing (60–74)', high_performer: 'High Performer (≥75)',
  };
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={dist} dataKey="n" nameKey="band" cx="50%" cy="50%" outerRadius={80} label={({ band, n }) => `${BAND_LABELS[band] ?? band}: ${n}`} labelLine={false}>
          {dist.map((d, i) => (
            <Cell key={i} fill={BAND_COLORS[d.band] ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v, _n, props) => [v, BAND_LABELS[props.payload?.band] ?? props.payload?.band]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Refresh log ──────────────────────────────────────────────────────────────
function RefreshLog({ result }: { result: RefreshResult | null }) {
  if (!result) return null;
  const ms = result.finished_at && result.started_at
    ? new Date(result.finished_at).getTime() - new Date(result.started_at).getTime()
    : 0;
  return (
    <div className="bg-gray-950 text-green-400 rounded-xl p-4 font-mono text-xs overflow-x-auto mt-4">
      <p className="text-gray-400 mb-2">Refresh completed in {ms}ms — {result.total_rows_processed} rows processed</p>
      {Object.entries(result.steps).map(([k, v]) => (
        <p key={k} className={v.error ? 'text-red-400' : 'text-green-400'}>
          {v.error ? '✗' : '✓'} {k}: {v.rows} rows ({v.duration_ms}ms){v.error ? ` ERROR: ${v.error}` : ''}
        </p>
      ))}
      {result.errors.length > 0 && (
        <p className="text-amber-400 mt-2">Warnings: {result.errors.join('; ')}</p>
      )}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
type Tab = 'overview' | 'warehouse' | 'cohorts' | 'benchmarks' | 'predictive';

export default function EnterpriseAnalyticsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [refreshLog, setRefreshLog] = useState<RefreshResult | null>(null);
  const qc = useQueryClient();

  const { data: exec, isLoading: execLoading, error: execError } = useQuery<ExecutiveData>({
    queryKey: ['/api/analytics/executive'],
    queryFn:  () => apiFetch('/api/analytics/executive'),
    staleTime: 60_000,
    retry: false,
  });

  const { data: features, isLoading: featLoading } = useQuery<FeaturesData>({
    queryKey: ['/api/analytics/features'],
    queryFn:  () => apiFetch('/api/analytics/features'),
    staleTime: 60_000,
    retry: false,
    enabled: activeTab === 'predictive',
  });

  const refreshMut = useMutation<RefreshResult, Error>({
    mutationFn: () => apiFetch('/api/analytics/refresh', { method: 'POST' }),
    onSuccess: (data) => {
      setRefreshLog(data);
      qc.invalidateQueries({ queryKey: ['/api/analytics/executive'] });
      qc.invalidateQueries({ queryKey: ['/api/analytics/features'] });
    },
  });

  const kpiMap: Record<string, number | null> = {};
  for (const k of (exec?.kpis ?? [])) kpiMap[k.metric_name] = k.metric_value;

  const flagOff = execError && (execError as any).message?.includes('FF_ENTERPRISE_ANALYTICS');

  const TAB_ITEMS: Array<{ id: Tab; label: string }> = [
    { id: 'overview',   label: 'Executive Overview' },
    { id: 'warehouse',  label: 'Data Warehouse' },
    { id: 'cohorts',    label: 'Cohort Analysis' },
    { id: 'benchmarks', label: 'Benchmarks' },
    { id: 'predictive', label: 'Predictive Features' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Enterprise Analytics Warehouse</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              12-table analytics layer — Operational DB → Facts → Dimensions → KPIs → Cohorts → Benchmarks → Predictive
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {exec?.generated_at && (
              <span className="text-[11px] text-gray-400">
                Last: {new Date(exec.generated_at).toLocaleString(undefined, { hour:'2-digit', minute:'2-digit' })}
              </span>
            )}
            <button
              onClick={() => refreshMut.mutate()}
              disabled={refreshMut.isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
              style={{ background: refreshMut.isPending ? '#94a3b8' : '#6366f1' }}>
              {refreshMut.isPending ? 'Refreshing…' : '⟳ Refresh All Data'}
            </button>
          </div>
        </div>

        {/* Flag-off notice */}
        {flagOff && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <strong>FF_ENTERPRISE_ANALYTICS</strong> is disabled. Add it to the Backend API workflow command to enable.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4 flex-wrap">
          {TAB_ITEMS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                activeTab === t.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-6">
        {execLoading && (
          <div className="text-center py-16 text-gray-400">Loading analytics…</div>
        )}

        {/* ── Overview ── */}
        {activeTab === 'overview' && !execLoading && (
          <div className="space-y-8">
            <div>
              <SectionHeader title="Platform KPIs" subtitle="Computed from the analytics warehouse. Run a refresh to update." />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <KPICard label="Total Users"           value={kpiMap.total_users}       accent="#6366f1" />
                <KPICard label="Sessions"              value={kpiMap.sessions_total}     accent="#22d3ee" />
                <KPICard label="Completed"             value={kpiMap.sessions_completed} accent="#10b981" />
                <KPICard label="Completion Rate"       value={kpiMap.completion_rate}    format="pct" accent="#f59e0b" />
                <KPICard label="Avg Score"             value={kpiMap.avg_score}          format="score" accent="#6366f1" />
                <KPICard label="Active (7d)"           value={kpiMap.active_users_7d}    accent="#22d3ee" />
                <KPICard label="New Users (7d)"        value={kpiMap.new_users_7d}       accent="#a855f7" />
                <KPICard label="High Performers"       value={kpiMap.high_performers}    accent="#10b981" />
                <KPICard label="At-Risk (>30d)"        value={kpiMap.at_risk_users}      accent="#f43f5e" />
                <KPICard label="Avg Behaviour"         value={kpiMap.avg_behaviour}      format="decimal" accent="#3b82f6" />
              </div>
            </div>

            <div>
              <SectionHeader title="30-Day Trend" subtitle="KPI timeseries over the last 30 days" />
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <TrendChart trends={exec?.trends ?? []} />
              </div>
            </div>

            <div>
              <SectionHeader title="Warehouse Health" subtitle="Row counts across all 12 analytics tables + operational source" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['operational','data_lake','fact','dimension','kpi','cohort','benchmark','predictive'] as const).map(cat => {
                  const catRows = (exec?.warehouse ?? []).filter(t => t.category === cat);
                  const total   = catRows.reduce((s, t) => s + t.rows, 0);
                  const label   = { operational:'Operational', data_lake:'Data Lake', fact:'Facts',
                    dimension:'Dimensions', kpi:'KPI Store', cohort:'Cohorts',
                    benchmark:'Benchmarks', predictive:'Predictive' }[cat];
                  return (
                    <div key={cat} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[cat] }} />
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
                        <p className="text-lg font-bold text-gray-800">{total.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">{catRows.length} table{catRows.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {refreshLog && <RefreshLog result={refreshLog} />}
          </div>
        )}

        {/* ── Data Warehouse ── */}
        {activeTab === 'warehouse' && !execLoading && (
          <div className="space-y-6">
            <SectionHeader title="Data Architecture" subtitle="Complete table inventory — operational source → analytics warehouse layers" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[
                { label:'Architecture', value:'Star Schema + Data Lake', sub:'PostgreSQL-native analytics' },
                { label:'ETL Pattern',  value:'On-demand materializer',  sub:'No scheduler required' },
                { label:'k-Anonymity',  value:'k = 30',                  sub:'Benchmark suppression threshold' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                  <p className="text-base font-bold text-gray-800 mt-1">{c.value}</p>
                  <p className="text-xs text-gray-400">{c.sub}</p>
                </div>
              ))}
            </div>
            <WarehouseTable rows={exec?.warehouse ?? []} />
            {refreshLog && <RefreshLog result={refreshLog} />}
          </div>
        )}

        {/* ── Cohort Analysis ── */}
        {activeTab === 'cohorts' && !execLoading && (
          <div className="space-y-6">
            <SectionHeader title="Cohort Retention" subtitle="Weekly cohorts — retention rate at each period offset (Week 0 = inception week)" />
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex gap-4 mb-4 flex-wrap">
                {[
                  { label:'Green', sub:'≥70%', color:'#10b981' },
                  { label:'Amber', sub:'40–69%', color:'#f59e0b' },
                  { label:'Orange', sub:'10–39%', color:'#f97316' },
                  { label:'Red', sub:'<10%', color:'#f43f5e' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ background: l.color }} />
                    <span className="text-xs text-gray-600">{l.label} ({l.sub})</span>
                  </div>
                ))}
              </div>
              <RetentionHeatmap rows={(exec?.cohorts ?? []) as any} />
            </div>
            {(exec?.cohorts ?? []).length === 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                No cohort data. Click <strong>Refresh All Data</strong> to materialise cohorts from the current user base.
              </div>
            )}
          </div>
        )}

        {/* ── Benchmarks ── */}
        {activeTab === 'benchmarks' && !execLoading && (
          <div className="space-y-6">
            <SectionHeader title="Benchmark Snapshots" subtitle="Percentile distribution across all scored users — k-anonymity enforced (k=30)" />
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <BenchmarkChart rows={(exec?.benchmarks ?? []) as any} />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Metric','Segment','P25','P50','P75','Mean','n','Status'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(exec?.benchmarks ?? []).map((b, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-gray-800 font-medium">{b.metric.replace(/_/g,' ')}</td>
                      <td className="px-4 py-2 text-gray-500">{b.cohort_segment}</td>
                      <td className="px-4 py-2 text-gray-700">{b.suppressed ? '—' : b.p25?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-gray-700 font-semibold">{b.suppressed ? '—' : b.p50?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-gray-700">{b.suppressed ? '—' : b.p75?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-gray-700">{b.suppressed ? '—' : b.mean?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-gray-500">{b.sample_size}</td>
                      <td className="px-4 py-2">{b.suppressed ? <Suppressed /> : <Badge label="Active" color="#10b981" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Predictive Features ── */}
        {activeTab === 'predictive' && (
          <div className="space-y-6">
            <SectionHeader title="Predictive Feature Store" subtitle="ML-ready feature vectors per user — derived daily from operational tables" />

            {featLoading && <div className="text-center py-8 text-gray-400">Loading…</div>}

            {features && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KPICard label="Users Profiled"     value={features.summary.total_users}    accent="#6366f1" />
                  <KPICard label="High Performers"    value={features.summary.high_performers} accent="#10b981" />
                  <KPICard label="At-Risk Users"       value={features.summary.at_risk}         accent="#f43f5e" />
                  <KPICard label="Likely to Complete" value={features.summary.likely_to_complete} accent="#22d3ee" />
                  <KPICard label="Behaviour Profiled" value={features.summary.behaviour_profiled} accent="#a855f7" />
                  <KPICard label="Competency Profiled" value={features.summary.competency_profiled} accent="#3b82f6" />
                  <KPICard label="Avg Completion"     value={features.summary.avg_completion_rate} format="pct" accent="#f59e0b" />
                  <KPICard label="Avg Days Inactive"  value={features.summary.avg_days_inactive}    format="score" accent="#94a3b8" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <SectionHeader title="Score Band Distribution" />
                    <ScoreDistPie dist={features.score_distribution} />
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <SectionHeader title="Behavioural Dimensions" subtitle="Average across profiled users" />
                    {features.summary.behaviour_profiled === 0 ? (
                      <p className="text-sm text-gray-400 py-8 text-center">No behaviour profiles yet.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <RadarChart data={[
                          { dim:'Motivation',   v: features.summary.avg_motivation   ?? 0 },
                          { dim:'Confidence',   v: features.summary.avg_confidence   ?? 0 },
                          { dim:'Engagement',   v: features.summary.avg_engagement   ?? 0 },
                          { dim:'Adaptability', v: features.summary.avg_adaptability ?? 0 },
                        ]}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="dim" tick={{ fontSize:11 }} />
                          <Radar name="Score" dataKey="v" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                          <Tooltip formatter={(v: any) => typeof v === 'number' ? v.toFixed(3) : v} />
                        </RadarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <SectionHeader title="Target Labels" subtitle="Binary targets derived from user behaviour patterns — used for model training" />
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label:'Will Complete (≥50% completion rate)',  key:'likely_to_complete', color:'#22d3ee' },
                      { label:'High Performer (last score ≥75)',        key:'high_performers',    color:'#10b981' },
                      { label:'At Risk (>30d inactive)',                key:'at_risk',            color:'#f43f5e' },
                    ].map(t => {
                      const n = features.summary[t.key] ?? 0;
                      const total = features.summary.total_users ?? 1;
                      const pct = total > 0 ? (Number(n) / Number(total) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={t.key} className="flex flex-col gap-1">
                          <p className="text-xs text-gray-500">{t.label}</p>
                          <p className="text-xl font-bold" style={{ color: t.color }}>{n} <span className="text-sm text-gray-400">({pct}%)</span></p>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                            <div className="h-1.5 rounded-full" style={{ background: t.color, width: pct + '%' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
