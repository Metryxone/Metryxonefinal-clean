import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain, Users, Activity, RefreshCw, Search, ChevronRight,
  X, User, TrendingUp, TrendingDown, Minus, Zap, Globe,
  Shield, CheckCircle2, XCircle, AlertTriangle, Lightbulb,
  BarChart2, BookOpen, Target, Loader2, Database, Clock,
  ArrowUp, ArrowDown, Award, Sparkles, Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';

const BRAND = {
  primary: '#344E86', accent: '#4ECDC4', success: '#10b981',
  warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6',
};

// ── Module-level constants ────────────────────────────────────────────────────

const STYLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  reflective:  { label: 'Reflective',  color: '#344E86', icon: <Brain size={12} />,      desc: 'Thinks deeply before acting' },
  persistent:  { label: 'Persistent',  color: '#10B981', icon: <Zap size={12} />,        desc: 'Pushes through difficulty' },
  exploratory: { label: 'Exploratory', color: '#8B5CF6', icon: <Globe size={12} />,      desc: 'Learns broadly and connects ideas' },
  impulsive:   { label: 'Impulsive',   color: '#F59E0B', icon: <Activity size={12} />,   desc: 'Moves fast, tries before understanding' },
  disengaged:  { label: 'Disengaged',  color: '#6B7280', icon: <Minus size={12} />,      desc: 'Reduced engagement currently' },
};

const DIMENSIONS = [
  { key: 'consistency_score',  label: 'Consistency',  color: '#344E86' },
  { key: 'persistence_score',  label: 'Persistence',  color: '#4ECDC4' },
  { key: 'attention_score',    label: 'Attention',    color: '#6366F1' },
  { key: 'adaptability_score', label: 'Adaptability', color: '#10B981' },
  { key: 'velocity_score',     label: 'Velocity',     color: '#F59E0B' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function LBIBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#10B981' : score >= 55 ? BRAND.primary : score >= 35 ? '#F59E0B' : '#6B7280';
  const label = score >= 75 ? 'High' : score >= 55 ? 'Dev' : score >= 35 ? 'Emrg' : 'Early';
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm font-bold" style={{ color }}>{Math.round(score)}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${color}20`, color }}>
        {label}
      </span>
    </span>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{Math.round(value)}</span>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: React.ReactNode; color: string; icon?: React.ReactNode }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon && <span style={{ color }}>{icon}</span>}
          <p className="text-xs text-gray-500">{label}</p>
        </div>
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LBIPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [styleFilter, setStyleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const params = new URLSearchParams({ page: String(page), limit: '25' });
  if (search) params.set('search', search);
  if (styleFilter) params.set('style', styleFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['lbi-profiles', page, search, styleFilter],
    queryFn: async () => (await fetch(`/api/admin/lbi/profiles?${params}`)).json(),
  });

  const { data: analytics } = useQuery({
    queryKey: ['lbi-analytics'],
    queryFn: async () => (await fetch('/api/admin/lbi/analytics')).json(),
  });

  const { data: profile } = useQuery({
    queryKey: ['lbi-profile', selectedEmail],
    queryFn: async () => (await fetch(`/api/admin/lbi/profiles/${encodeURIComponent(selectedEmail!)}`)).json(),
    enabled: !!selectedEmail && drawerOpen,
  });

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['lbi-quality-health'],
    queryFn: async () => (await fetch('/api/admin/lbi/quality-health')).json(),
  });

  const { data: longData, isLoading: longLoading } = useQuery({
    queryKey: ['lbi-longitudinal-agg'],
    queryFn: async () => (await fetch('/api/admin/lbi/longitudinal-aggregates')).json(),
  });

  const { data: interventions, isLoading: intLoading } = useQuery({
    queryKey: ['lbi-interventions-all'],
    queryFn: async () => (await fetch('/api/lbi/interventions')).json(),
  });

  const recalcMut = useMutation({
    mutationFn: () => fetch('/api/admin/lbi/recalculate-all', { method: 'POST' }),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ['lbi-profiles'] }), 2000),
  });

  const backfillMut = useMutation({
    mutationFn: () => fetch('/api/admin/lbi/backfill-intelligence', { method: 'POST' }),
  });

  const { data: activationData, isLoading: activationLoading, refetch: refetchActivation } = useQuery({
    queryKey: ['lbi-activation-health'],
    queryFn: async () => (await fetch('/api/admin/lbi/activation-health')).json(),
  });

  const { data: cohortData, isLoading: cohortLoading } = useQuery({
    queryKey: ['lbi-cohort-analytics'],
    queryFn: async () => (await fetch('/api/admin/lbi/cohort-analytics')).json(),
    staleTime: 300_000,
  });

  const [drillInput, setDrillInput] = useState('');
  const [drillEmail, setDrillEmail] = useState('');
  const { data: drillData, isLoading: drillLoading } = useQuery({
    queryKey: ['lbi-admin-intel', drillEmail],
    queryFn: async () => (await fetch(`/api/lbi/intelligence?adminEmail=${encodeURIComponent(drillEmail)}`)).json(),
    enabled: !!drillEmail,
  });

  const rows = data?.rows || [];
  const kpi  = data?.kpi  || {};
  const total = data?.total || 0;

  const styleKeys = Object.keys(STYLE_CONFIG);
  const styleDist = analytics ? styleKeys.map(s => ({
    style: s,
    count: Number((analytics as any)[`style_${s}`] || 0),
  })) : [];
  const totalStyled = styleDist.reduce((a, b) => a + b.count, 0) || 1;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
            <Brain size={22} style={{ color: BRAND.primary }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: BRAND.primary }}>LBI Intelligence</h1>
            <p className="text-xs text-gray-500">Learning Behaviour Index — Unified platform (W1–W10)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => backfillMut.mutate()} disabled={backfillMut.isPending}
            className="flex items-center gap-1.5 text-xs">
            <Database size={13} className={backfillMut.isPending ? 'animate-pulse' : ''} />
            Backfill Intelligence
          </Button>
          <Button size="sm" variant="outline" onClick={() => recalcMut.mutate()} disabled={recalcMut.isPending}
            className="flex items-center gap-1.5 text-xs">
            <RefreshCw size={13} className={recalcMut.isPending ? 'animate-spin' : ''} />
            Recalculate All
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Avg LBI',       value: analytics?.avg_lbi || '—',          color: BRAND.primary },
          { label: 'Consistency',   value: analytics?.avg_consistency || '—',   color: '#6366F1' },
          { label: 'Persistence',   value: analytics?.avg_persistence || '—',   color: '#10B981' },
          { label: 'Attention',     value: analytics?.avg_attention || '—',     color: BRAND.accent },
          { label: 'Adaptability',  value: analytics?.avg_adaptability || '—',  color: '#F59E0B' },
        ].map(k => (
          <StatCard key={k.label} label={k.label} value={k.value} color={k.color} />
        ))}
      </div>

      {/* Tab panels */}
      <Tabs defaultValue="profiles">
        <TabsList className="mb-4 flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="profiles" className="text-xs">User Profiles</TabsTrigger>
          <TabsTrigger value="quality" className="text-xs">Quality Health</TabsTrigger>
          <TabsTrigger value="longitudinal" className="text-xs">Longitudinal</TabsTrigger>
          <TabsTrigger value="interventions" className="text-xs">Intervention Library</TabsTrigger>
          <TabsTrigger value="domains" className="text-xs">Domains</TabsTrigger>
          <TabsTrigger value="activation" className="text-xs">Activation Health</TabsTrigger>
          <TabsTrigger value="cohort" className="text-xs">Cohort Analytics</TabsTrigger>
          <TabsTrigger value="drill" className="text-xs">User Drill-down</TabsTrigger>
        </TabsList>

        {/* ── Profiles tab ─────────────────────────────────────────────────── */}
        <TabsContent value="profiles" className="space-y-4">
          {/* Style distribution */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold" style={{ color: BRAND.primary }}>Learning Style Distribution</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {styleDist.map(({ style, count }) => {
                const cfg = STYLE_CONFIG[style];
                const pct = Math.round((count / totalStyled) * 100);
                return (
                  <div key={style} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-28 shrink-0">
                      <span style={{ color: cfg.color }}>{cfg.icon}</span>
                      <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-semibold" style={{ color: BRAND.primary }}>
                  User LBI Profiles <span className="font-normal text-gray-400">({total})</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-wrap">
                    {['', ...styleKeys].map(s => (
                      <button key={s} onClick={() => { setStyleFilter(s); setPage(1); }}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${styleFilter === s ? 'text-white' : 'bg-white text-gray-500'}`}
                        style={styleFilter === s ? { backgroundColor: s ? STYLE_CONFIG[s]?.color : BRAND.primary, borderColor: 'transparent' } : {}}>
                        {s ? STYLE_CONFIG[s].label : 'All'}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Search email..." className="pl-7 h-7 text-xs w-44" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {isLoading ? (
                <div className="p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading LBI profiles…
                </div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No LBI data yet. Click "Recalculate All" to compute scores from existing sessions.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        {['User', 'Overall LBI', 'Consistency', 'Persistence', 'Attention', 'Adaptability', 'Velocity', 'Style', 'Sessions', ''].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r: Record<string, unknown>) => {
                        const sty = STYLE_CONFIG[r.learning_style as string] || STYLE_CONFIG.exploratory;
                        return (
                          <tr key={r.user_email as string} className="border-b hover:bg-gray-50 cursor-pointer"
                            onClick={() => { setSelectedEmail(r.user_email as string); setDrawerOpen(true); }}>
                            <td className="px-3 py-2 font-medium" style={{ color: BRAND.primary }}>{r.user_email as string}</td>
                            <td className="px-3 py-2"><LBIBadge score={Number(r.overall_lbi)} /></td>
                            {DIMENSIONS.map(d => (
                              <td key={d.key} className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${r[d.key]}%`, backgroundColor: d.color }} />
                                  </div>
                                  <span className="font-medium" style={{ color: d.color }}>{r[d.key] as number}</span>
                                </div>
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color: sty.color, backgroundColor: `${sty.color}15` }}>
                                {sty.icon} {sty.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500">{r.sessions_analyzed as number}</td>
                            <td className="px-3 py-2"><ChevronRight size={14} className="text-gray-300" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {total > 25 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-xs text-gray-500">Showing {(page-1)*25+1}–{Math.min(page*25, total)} of {total}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page*25>=total} onClick={() => setPage(p=>p+1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Quality Health tab ────────────────────────────────────────────── */}
        <TabsContent value="quality" className="space-y-4">
          {healthLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Running quality health check…
            </div>
          ) : healthData ? (
            <>
              {/* Readiness headline */}
              <Card className="border shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 shrink-0">
                      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="40" cy="40" r="32" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                        <circle cx="40" cy="40" r="32" fill="none" stroke={healthData.readiness_pct >= 80 ? '#10B981' : healthData.readiness_pct >= 50 ? '#F59E0B' : '#EF4444'} strokeWidth="8"
                          strokeDasharray={`${(healthData.readiness_pct / 100) * 201} 201`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-black" style={{ color: healthData.readiness_pct >= 80 ? '#10B981' : '#F59E0B' }}>
                          {healthData.readiness_pct}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">LBI Platform Readiness</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {healthData.capabilities_ready} of {healthData.capabilities_total} capabilities active
                      </div>
                      <div className="flex gap-3 mt-2 text-xs text-gray-500">
                        <span>Scores: <strong>{healthData.counts?.lbi_scores ?? '—'}</strong></span>
                        <span>Trends: <strong>{healthData.counts?.behavior_trends ?? '—'}</strong></span>
                        <span>Reports: <strong>{healthData.counts?.reports ?? '—'}</strong></span>
                        <span>Rec Master: <strong>{healthData.counts?.rec_master ?? '—'}</strong></span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="ml-auto text-xs" onClick={() => refetchHealth()}>
                      <RefreshCw size={12} className="mr-1" /> Refresh
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Capability checklist */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold" style={{ color: BRAND.primary }}>Capability Checklist</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {(healthData.capabilities || []).map((c: { name: string; status: boolean }) => (
                      <div key={c.name} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                        {c.status
                          ? <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                          : <XCircle size={15} className="text-red-400 shrink-0" />}
                        <span className={`text-sm ${c.status ? 'text-gray-700' : 'text-gray-400'}`}>{c.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Counts grid */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {Object.entries(healthData.counts || {}).map(([k, v]) => (
                  <div key={k} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                    <div className="text-xl font-bold" style={{ color: BRAND.primary }}>{String(v)}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 capitalize">{k.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-gray-400">Quality health data unavailable.</div>
          )}
        </TabsContent>

        {/* ── Longitudinal tab ──────────────────────────────────────────────── */}
        <TabsContent value="longitudinal" className="space-y-4">
          {longLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading longitudinal data…
            </div>
          ) : longData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Tracked" value={longData.total_tracked ?? 0} color={BRAND.primary} icon={<Users size={14} />} />
                <StatCard label="Improving" value={longData.improving ?? 0} color="#10B981" icon={<ArrowUp size={14} />} />
                <StatCard label="Stable" value={longData.stable ?? 0} color="#6B7280" icon={<Minus size={14} />} />
                <StatCard label="Declining" value={longData.declining ?? 0} color="#EF4444" icon={<ArrowDown size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Avg LBI Change" value={longData.avg_change != null ? `${longData.avg_change > 0 ? '+' : ''}${longData.avg_change} pts` : '—'} color="#344E86" />
                <StatCard label="Avg Weeks Tracked" value={longData.avg_weeks != null ? `${longData.avg_weeks}w` : '—'} color="#6366F1" icon={<Clock size={14} />} />
              </div>
              {longData.insufficient_data > 0 && (
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700">
                  <Info size={14} className="shrink-0" />
                  {longData.insufficient_data} user{longData.insufficient_data !== 1 ? 's' : ''} have insufficient data (need ≥2 sessions for trajectory).
                  Run "Backfill Intelligence" to compute all available trajectories.
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-gray-400 text-sm">
              No longitudinal data yet. Run "Backfill Intelligence" to compute trajectories for existing users.
            </div>
          )}
        </TabsContent>

        {/* ── Intervention Library tab ──────────────────────────────────────── */}
        <TabsContent value="interventions" className="space-y-3">
          {intLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading interventions…
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {(interventions?.interventions ?? []).length} evidence-based interventions seeded and active.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(interventions?.interventions ?? []).map((iv: any) => (
                  <div key={iv.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                      <span className="text-sm font-semibold text-gray-900">{iv.title}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">
                        {(iv.target_dimension ?? '').replace('_score', '').replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{iv.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {iv.duration_minutes != null && <span><Clock size={10} className="inline mr-0.5" />{iv.duration_minutes} min</span>}
                      {iv.frequency && <span className="capitalize">{iv.frequency}</span>}
                      <span className="capitalize">{(iv.intervention_type ?? '').replace('_', ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Domains tab ───────────────────────────────────────────────────── */}
        <TabsContent value="domains">
          <LbiDomainsTab />
        </TabsContent>

        {/* ── Activation Health tab (WC-P2 two-axis) ───────────────────────── */}
        <TabsContent value="activation" className="space-y-4">
          {activationLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Measuring activation…
            </div>
          ) : activationData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[activationData.consumption, activationData.activation].map((axis: any) => (
                  <Card key={axis.label} className="border shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{axis.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{axis.description}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          axis.status === 'ready' ? 'bg-green-100 text-green-700' :
                          axis.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{axis.status}</span>
                      </div>
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-3xl font-black" style={{ color: axis.rate_pct >= 90 ? '#10B981' : axis.rate_pct >= 60 ? '#F59E0B' : '#EF4444' }}>
                          {axis.rate_pct}%
                        </span>
                        <span className="text-xs text-gray-400 mb-1">{axis.numerator} / {axis.denominator}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${axis.rate_pct}%`, backgroundColor: axis.rate_pct >= 90 ? '#10B981' : axis.rate_pct >= 60 ? '#F59E0B' : '#EF4444' }} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="border shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold" style={{ color: BRAND.primary }}>Layer Coverage</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {Object.entries(activationData.layer_coverage || {}).map(([k, v]) => (
                      <div key={k} className="text-center">
                        <div className="text-2xl font-bold" style={{ color: BRAND.primary }}>{String(v)}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 capitalize">{k.replace(/_/g, ' ')}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold" style={{ color: BRAND.primary }}>Shared Engine Routes</CardTitle>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => refetchActivation()}>
                      <RefreshCw size={11} className="mr-1" /> Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {(activationData.shared_engine_routes || []).map((r: any) => (
                    <div key={r.route} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                      <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-gray-700 truncate">{r.route}</p>
                        <p className="text-[10px] text-gray-400">{r.engine}</p>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">{r.status}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-16 text-gray-400 text-sm">Activation health data unavailable.</div>
          )}
        </TabsContent>

        {/* ── Cohort Analytics tab ─────────────────────────────────────────── */}
        <TabsContent value="cohort" className="space-y-5">
          {cohortLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Computing platform cohort analytics…
            </div>
          ) : (
            <>
              {/* Topline KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Scored"      value={cohortData?.topline?.total_users ?? 0}          color={BRAND.primary} icon={<Users size={14} />} />
                <StatCard label="Platform Avg LBI"  value={cohortData?.topline?.platform_avg_lbi ?? '—'}   color={BRAND.primary} icon={<Brain size={14} />} />
                <StatCard label="High Performers"   value={cohortData?.topline?.high_performer_count ?? 0} color={BRAND.success} icon={<Award size={14} />} />
                <StatCard label="At-Risk"           value={cohortData?.topline?.at_risk_count ?? 0}        color={BRAND.danger}  icon={<AlertTriangle size={14} />} />
              </div>

              {/* Learning style distribution */}
              <Card className="border shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <BarChart2 size={14} style={{ color: BRAND.primary }} /> Learning Style Distribution
                  </h3>
                  {(cohortData?.learning_style_distribution ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">No scored users yet. Run "Recalculate All" to populate.</p>
                  ) : (
                    <div className="space-y-3">
                      {(cohortData?.learning_style_distribution ?? []).map((s: any) => {
                        const cfg = STYLE_CONFIG[s.learning_style];
                        const totalStyled = (cohortData.learning_style_distribution).reduce((a: number, b: any) => a + b.user_count, 0) || 1;
                        const pct = Math.round((s.user_count / totalStyled) * 100);
                        return (
                          <div key={s.learning_style} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span style={{ color: cfg?.color ?? '#6B7280' }}>{cfg?.icon}</span>
                                <span className="font-semibold text-gray-700 capitalize">{cfg?.label ?? s.learning_style}</span>
                                <span className="text-gray-400">{s.user_count} user{s.user_count !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="flex items-center gap-3 text-gray-500">
                                <span>Avg LBI: <strong style={{ color: cfg?.color }}>{s.avg_lbi ?? '—'}</strong></span>
                                <span className="w-8 text-right font-semibold">{pct}%</span>
                              </div>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, backgroundColor: cfg?.color ?? '#6B7280' }} />
                            </div>
                            <div className="grid grid-cols-5 gap-1 pl-6">
                              {[
                                { label: 'Consistency', val: s.avg_consistency, color: '#344E86' },
                                { label: 'Persistence', val: s.avg_persistence, color: '#4ECDC4' },
                                { label: 'Attention',   val: s.avg_attention,   color: '#6366F1' },
                                { label: 'Velocity',    val: s.avg_velocity,    color: '#F59E0B' },
                                { label: 'Adaptability',val: s.avg_adaptability,color: '#10B981' },
                              ].map(d => (
                                <div key={d.label} className="text-center">
                                  <div className="text-[10px] font-bold" style={{ color: d.color }}>{d.val ?? '—'}</div>
                                  <div className="text-[9px] text-gray-400">{d.label.slice(0, 4)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Band + Risk side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Band distribution */}
                <Card className="border shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">Band Distribution</h3>
                    {(cohortData?.band_distribution ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No data yet.</p>
                    ) : (() => {
                      const totalBands = (cohortData?.band_distribution ?? []).reduce((a: number, b: any) => a + b.user_count, 0) || 1;
                      return (
                        <div className="space-y-2.5">
                          {(cohortData?.band_distribution ?? []).map((b: any) => {
                            const pct = Math.round((b.user_count / totalBands) * 100);
                            const bColor = b.lbi_band === 'exceptional' || b.lbi_band === 'growth' ? '#10B981'
                              : b.lbi_band === 'developing' ? BRAND.primary
                              : b.lbi_band === 'emerging' ? '#F59E0B' : '#6B7280';
                            return (
                              <div key={b.lbi_band}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="capitalize font-medium text-gray-700">{(b.lbi_band ?? '').replace('_', ' ')}</span>
                                  <span className="text-gray-500">{b.user_count} ({pct}%)</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: bColor }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Risk distribution */}
                <Card className="border shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">Active Risk Signals</h3>
                    {(cohortData?.risk_distribution ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No active risks across the platform.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(cohortData?.risk_distribution ?? []).slice(0, 10).map((r: any, i: number) => (
                          <div key={r.risk_type ?? i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 text-xs">
                            <span className="text-gray-600 capitalize">{(r.risk_label ?? r.risk_type ?? '').replace(/_/g, ' ')}</span>
                            <span className="font-bold px-2 py-0.5 rounded-lg bg-red-50 text-red-600">{r.user_count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {cohortData?.generated_at && (
                <p className="text-[10px] text-gray-400 text-right">
                  Computed {new Date(cohortData.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
            </>
          )}
        </TabsContent>

        {/* ── User Drill-down tab ───────────────────────────────────────────── */}
        <TabsContent value="drill" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={drillInput}
                onChange={e => setDrillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && drillInput.trim() && setDrillEmail(drillInput.trim())}
                placeholder="Enter user email…"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button size="sm" className="text-xs h-8"
              style={{ backgroundColor: BRAND.primary, color: '#fff' }}
              disabled={!drillInput.trim()}
              onClick={() => setDrillEmail(drillInput.trim())}>
              Load
            </Button>
            {drillEmail && (
              <Button size="sm" variant="outline" className="text-xs h-8"
                onClick={() => { setDrillEmail(''); setDrillInput(''); }}>
                Clear
              </Button>
            )}
          </div>
          {drillEmail && (
            drillLoading ? (
              <div className="flex items-center justify-center h-40 text-gray-400">
                <Loader2 size={18} className="animate-spin mr-2" /> Loading intelligence for {drillEmail}…
              </div>
            ) : drillData?.layers?.score ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400 font-mono">{drillEmail}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold">7 intelligence layers</span>
                </div>
                {/* Core 4 metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Overall LBI" value={drillData.layers?.score?.overall_lbi != null ? Math.round(drillData.layers.score.overall_lbi) : '—'} color={BRAND.primary} icon={<Brain size={14} />} />
                  <StatCard label="Learning Style" value={<span className="capitalize text-base">{drillData.layers?.score?.learning_style ?? '—'}</span>} color={BRAND.accent} />
                  <StatCard label="Active Risks" value={drillData.layers?.risk?.risk_count ?? 0} color={(drillData.layers?.risk?.risk_count ?? 0) > 0 ? '#EF4444' : '#10B981'} icon={<Shield size={14} />} />
                  <StatCard label="Causal Recs" value={drillData.layers?.causal_recommendations?.recommendations?.length ?? 0} color={BRAND.purple} icon={<Lightbulb size={14} />} />
                </div>
                {/* New-layer indicators (E1) */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="WCL2 Forecast" value={(drillData.layers?.forecast?.forecasts?.length ?? 0) > 0 ? '✓ Available' : 'No data'} color={(drillData.layers?.forecast?.forecasts?.length ?? 0) > 0 ? '#10B981' : '#9CA3AF'} />
                  <StatCard label="WCL3 Outcomes" value={drillData.layers?.outcomes != null ? '✓ Resolved' : 'No session'} color={drillData.layers?.outcomes != null ? '#10B981' : '#9CA3AF'} />
                  <StatCard label="Percentile" value={drillData.layers?.comparative?.percentile_rank?.percentile != null ? `${drillData.layers.comparative.percentile_rank.percentile}th` : '—'} color={BRAND.primary} />
                </div>
                {/* Dimension score bars */}
                {DIMENSIONS.map(d => (
                  <ScoreBar key={d.key} label={d.label} value={drillData.layers?.score?.[d.key] ?? 0} color={d.color} />
                ))}
                {/* Trend directions */}
                {(drillData.layers?.trends?.behavior_trends ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Trend Directions</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {drillData.layers.trends.behavior_trends.map((t: any) => (
                        <div key={t.dimension} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs">
                          <span className="text-gray-600">{t.dimension_label}</span>
                          <span className={`font-semibold capitalize ${t.direction === 'improving' ? 'text-green-600' : t.direction === 'declining' ? 'text-red-500' : 'text-gray-500'}`}>
                            {t.direction?.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Top causal recommendations */}
                {(drillData.layers?.causal_recommendations?.recommendations ?? []).slice(0, 5).map((r: any) => (
                  <div key={r.id ?? r.recommendation_key} className="flex items-start gap-2 p-3 bg-white rounded-xl border border-gray-100 text-xs">
                    <Lightbulb size={13} style={{ color: BRAND.primary }} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-800">{r.title}</p>
                      <p className="text-gray-500 mt-0.5">{r.description ?? r.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400 text-sm">
                No LBI intelligence found for <span className="font-mono">{drillEmail}</span>.
                Run "Backfill Intelligence" if this user has completed CAPADEX sessions.
              </div>
            )
          )}
          {!drillEmail && (
            <div className="text-center py-16 text-gray-400 text-sm">
              Enter a user email above to drill into their LBI intelligence profile.
            </div>
          )}
        </TabsContent>

      </Tabs>

      {/* ── User Drawer ───────────────────────────────────────────────────── */}
      {drawerOpen && selectedEmail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="w-[480px] bg-white h-full overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={18} style={{ color: BRAND.primary }} />
                <h2 className="text-sm font-bold" style={{ color: BRAND.primary }}>{selectedEmail}</h2>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            {profile ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="text-4xl font-black" style={{ color: BRAND.primary }}>
                    {profile.profile?.overall_lbi != null ? Math.round(profile.profile.overall_lbi) : '—'}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Overall LBI</p>
                    {profile.profile?.learning_style && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-0.5"
                        style={{
                          color: STYLE_CONFIG[profile.profile.learning_style]?.color || '#6B7280',
                          backgroundColor: `${STYLE_CONFIG[profile.profile.learning_style]?.color || '#6B7280'}15`
                        }}>
                        {STYLE_CONFIG[profile.profile.learning_style]?.icon}
                        {STYLE_CONFIG[profile.profile.learning_style]?.label || profile.profile.learning_style}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {DIMENSIONS.map(d => (
                    <ScoreBar key={d.key} label={d.label} value={profile.profile?.[d.key] || 0} color={d.color} />
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: BRAND.primary }}>Recent Sessions</p>
                  {(profile.sessions || []).slice(0, 5).map((s: Record<string, unknown>) => (
                    <div key={s.id as string} className="flex items-center justify-between py-1.5 border-b last:border-0 text-xs">
                      <span className="text-gray-600">{s.stage as string}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {s.status as string}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-4 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Domains sub-panel ─────────────────────────────────────────────────────────
function LbiDomainsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['lbi-domains'],
    queryFn: async () => (await fetch('/api/lbi/domains')).json(),
  });

  const domains = data?.domains ?? data ?? [];

  if (isLoading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">
      <Loader2 size={20} className="animate-spin mr-2" /> Loading domains…
    </div>
  );

  if (!Array.isArray(domains) || domains.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
        <p>No domain data available. Foundation seed has been applied — restart the backend to confirm.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{domains.length} active learning behaviour domains (19 canonical).</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {domains.map((d: any) => (
          <div key={d.domain_code} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color || '#344E86' }} />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{d.domain_code}</span>
              <span className="text-xs font-semibold text-gray-900">{d.domain_name}</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{d.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
