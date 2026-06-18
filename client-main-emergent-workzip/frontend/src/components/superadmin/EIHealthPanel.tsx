import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, BarChart2, BarChart3, Briefcase,
  CheckCircle, Database, GitBranch, Map, Network, RefreshCw,
  Target, TrendingUp, Users, XCircle, Zap, ShieldCheck,
  ArrowUpRight, Clock, Award, Layers, Info, Search, UserSearch,
} from 'lucide-react';
import { EIIntelligencePanel } from '../ei/EIIntelligencePanel';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '@/hooks/use-toast';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', success: '#10b981', warning: '#f59e0b', danger: '#ef4444' };

function pct2color(pct: number) {
  if (pct >= 80) return BRAND.success;
  if (pct >= 50) return BRAND.warning;
  return BRAND.danger;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PASS') return <Badge className="bg-green-100 text-green-700 border-green-300">PASS</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-300">GAP</Badge>;
}

function MetricCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: (color || BRAND.primary) + '15' }}>
            <Icon className="h-5 w-5" style={{ color: color || BRAND.primary }} />
          </div>
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UserDrillDown() {
  const [input, setInput]     = useState('');
  const [userId, setUserId]   = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50">
        <UserSearch className="h-4 w-4 text-gray-400 shrink-0" />
        <input
          type="text"
          className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-300"
          placeholder="Paste a user UUID to view their EI Intelligence panel..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) setUserId(input.trim()); }}
        />
        <button
          className="text-xs font-medium px-3 py-1 rounded-md text-white"
          style={{ background: BRAND.primary }}
          onClick={() => { if (input.trim()) setUserId(input.trim()); }}
        >
          <Search className="h-3 w-3 inline mr-1" />Load
        </button>
        {userId && (
          <button className="text-xs text-gray-400 hover:text-gray-600"
            onClick={() => { setUserId(null); setInput(''); }}>
            Clear
          </button>
        )}
      </div>
      {userId && (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2"
            style={{ background: 'rgba(11,60,93,0.03)' }}>
            <span className="text-[10px] text-gray-400 font-mono">{userId}</span>
          </div>
          <div className="p-0">
            <EIIntelligencePanel userId={userId} />
          </div>
        </div>
      )}
      {!userId && (
        <div className="flex flex-col items-center py-8 text-center">
          <UserSearch className="h-8 w-8 text-gray-200 mb-2" />
          <p className="text-xs text-gray-400">Enter a user UUID above to load their full EI Intelligence panel</p>
          <p className="text-[10px] text-gray-300 mt-1">Forecast · Trajectory · Comparative · Interventions · Report</p>
        </div>
      )}
    </div>
  );
}

export default function EIHealthPanel() {
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);

  const health = useQuery({
    queryKey: ['admin', 'ei', 'health', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/health?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'unknown error');
      return d.health;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const quality = useQuery({
    queryKey: ['admin', 'ei', 'data-quality', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/data-quality?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d.quality;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const events = useQuery({
    queryKey: ['admin', 'ei', 'events', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/events/summary?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d.summary;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const queryClient = useQueryClient();

  const seedMutation = useMutation({
    mutationFn: async (wipeFirst = false) => {
      const r = await fetch('/api/admin/ei/seed-demo-intelligence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wipe_first: wipeFirst }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      return d;
    },
    onSuccess: (d) => {
      toast({ title: 'Demo data seeded', description: `${d.seeded?.ei_snapshots_user ?? 0} EI snapshots · ${d.seeded?.capadex_sessions ?? 0} sessions · ${d.seeded?.ei_snapshots_cohort ?? 0} cohort rows` });
      setRefreshKey(k => k + 1);
      queryClient.invalidateQueries({ queryKey: ['admin', 'ei'] });
    },
    onError: (e: any) => toast({ title: 'Seed failed', description: e.message, variant: 'destructive' }),
  });

  const intelligenceV2 = useQuery({
    queryKey: ['admin', 'ei', 'intelligence-v2', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/intelligence-v2?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d.intelligence_v2;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const compAnalytics = useQuery({
    queryKey: ['admin', 'ei', 'competency-analytics', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/competency-analytics?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d.analytics;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const recAnalytics = useQuery({
    queryKey: ['admin', 'ei', 'rec-analytics', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/recommendation-analytics?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d.analytics;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const resolverAnalytics = useQuery({
    queryKey: ['admin', 'ei', 'resolver-analytics', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/resolver-analytics?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d.analytics;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const consistencyCheck = useQuery({
    queryKey: ['admin', 'ei', 'consistency', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/consistency-check?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d.consistency;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const trendAnalytics = useQuery({
    queryKey: ['admin', 'ei', 'trend-analytics', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/trend-analytics?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).analytics;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const cohortAnalytics = useQuery({
    queryKey: ['admin', 'ei', 'cohort-analytics', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/cohort-analytics?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).analytics;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const pathwayAnalytics = useQuery({
    queryKey: ['admin', 'ei', 'pathway-analytics', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/pathway-analytics?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).analytics;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const intelligenceHealth = useQuery({
    queryKey: ['admin', 'ei', 'intelligence-health', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/intelligence-health?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).health;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const graphIntegrityData = useQuery({
    queryKey: ['admin', 'ei', 'graph-integrity-r5', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/admin/ei/graph-integrity?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).integrity;
    },
    staleTime: 60_000,
    retry: 1,
  });

  function handleRefresh() {
    setRefreshKey(k => k + 1);
    toast({ title: 'Refreshing EI health data…' });
  }

  const h = health.data;
  const q = quality.data;
  const e = events.data;
  const ca = compAnalytics.data;
  const ra = recAnalytics.data;
  const rv = resolverAnalytics.data;
  const cc = consistencyCheck.data;
  const ta = trendAnalytics.data;
  const coha = cohortAnalytics.data;
  const pa = pathwayAnalytics.data;
  const ih = intelligenceHealth.data;
  const gi = graphIntegrityData.data;
  const loading = health.isLoading || quality.isLoading || events.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: BRAND.primary }}>Employability Intelligence Health</h2>
          <p className="text-sm text-gray-500 mt-1">Occupation graph · Skill coverage · Pathway density · Analytics · Data quality</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {health.error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Failed to load EI health: {(health.error as Error).message}
        </div>
      )}

      {h && (
        <Tabs defaultValue="overview">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="occupations">Occupations</TabsTrigger>
            <TabsTrigger value="pathways">Pathways</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="competency">Competency</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="consistency">Consistency</TabsTrigger>
            <TabsTrigger value="quality">Data Quality</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
            <TabsTrigger value="graph">Graph</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="intelligence-v2">Intelligence v2</TabsTrigger>
            <TabsTrigger value="user-drill">User Drill-down</TabsTrigger>
          </TabsList>

          {/* ── Overview ───────────────────────────────────────────────────── */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard icon={Briefcase} label="Active Occupations" value={h.occupation_graph?.active ?? 0} sub={`of ${h.occupation_graph?.total ?? 0} total`} />
              <MetricCard icon={Database} label="Skill Mappings" value={h.skills?.total_mappings ?? 0} sub={`${h.skills?.avg_skills_per_occ ?? 0} avg/occupation`} color={BRAND.accent} />
              <MetricCard icon={GitBranch} label="Career Pathways" value={h.pathways?.active ?? 0} sub={`${h.pathways?.origins ?? 0} origin occupations`} color="#8b5cf6" />
              <MetricCard icon={Activity} label="EI Snapshots" value={h.snapshots?.total ?? 0} sub={`${h.snapshots?.users_covered ?? 0} users covered`} color={BRAND.success} />
            </div>

            {/* W9 Data Readiness */}
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" style={{ color: BRAND.primary }} />
                  W9 Data Readiness Targets
                </CardTitle>
                <CardDescription>300 occupations · 1,000 skills · 200 pathways</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {h.data_readiness && Object.entries(h.data_readiness).map(([key, d]: [string, any]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize">{key}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{d.current} / {d.target}</span>
                        <StatusBadge status={d.status} />
                      </div>
                    </div>
                    <Progress value={Math.min(100, d.pct)} className="h-2" style={{ '--progress-color': pct2color(d.pct) } as React.CSSProperties} />
                    <p className="text-xs text-gray-400 mt-0.5">{d.pct}% of target</p>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">Overall Data Readiness</span>
                  <span className="text-lg font-bold" style={{ color: pct2color(h.overall_data_readiness_pct ?? 0) }}>
                    {h.overall_data_readiness_pct ?? 0}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 30-day events snapshot */}
            {e && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" style={{ color: BRAND.primary }} />
                    Product Usage (30 days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{h.events_30d?.total_events ?? 0}</p>
                      <p className="text-xs text-gray-500">Total Events</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{h.events_30d?.active_users ?? 0}</p>
                      <p className="text-xs text-gray-500">Active Users</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{h.events_30d?.reports_viewed ?? 0}</p>
                      <p className="text-xs text-gray-500">Reports Viewed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Occupations ───────────────────────────────────────────────── */}
          <TabsContent value="occupations">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Total Occupations', value: h.occupation_graph?.total },
                { label: 'Active', value: h.occupation_graph?.active },
                { label: 'Role Families', value: h.occupation_graph?.families },
                { label: 'Seniority Bands', value: h.occupation_graph?.seniority_bands },
                { label: 'ESCO Linked', value: h.occupation_graph?.esco_linked, sub: 'standard code present' },
                { label: 'O*NET Linked', value: h.occupation_graph?.onet_linked, sub: 'standard code present' },
                { label: 'Unique Skills', value: h.skills?.total_skills },
                { label: 'Skills In Use', value: h.skills?.skills_in_use },
                { label: 'Avg Skills/Occ', value: h.skills?.avg_skills_per_occ },
              ].map((m, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-sm text-gray-500">{m.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{m.value ?? '—'}</p>
                    {m.sub && <p className="text-xs text-gray-400">{m.sub}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  W9 Data Gap — Occupations
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-1">
                <p>Current: <strong>{h.occupation_graph?.active}</strong> occupations. Target: <strong>300</strong>.</p>
                <p>Gap: <strong>{Math.max(0, 300 - (h.occupation_graph?.active ?? 0))}</strong> more occupations needed to reach target.</p>
                <p className="text-xs text-gray-400 mt-2">Honest ceiling: manual seed can realistically reach ~100 occupations. Beyond that, an external O*NET / ESCO data import is required.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Pathways ──────────────────────────────────────────────────── */}
          <TabsContent value="pathways">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Total Pathways', value: h.pathways?.total },
                { label: 'Active Pathways', value: h.pathways?.active },
                { label: 'Origin Occupations', value: h.pathways?.origins },
                { label: 'Destination Occupations', value: h.pathways?.destinations },
                { label: 'Progressions', value: h.pathways?.progressions, sub: 'same-track step-up' },
                { label: 'Lateral Moves', value: h.pathways?.laterals, sub: 'same-level cross-track' },
                { label: 'Pivots', value: h.pathways?.pivots, sub: 'track change' },
              ].map((m, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-sm text-gray-500">{m.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{m.value ?? '—'}</p>
                    {m.sub && <p className="text-xs text-gray-400">{m.sub}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── Intelligence ──────────────────────────────────────────────── */}
          <TabsContent value="intelligence">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4" style={{ color: BRAND.primary }} />
                    EI Snapshots (ei_snapshot_versions)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Total snapshots</span><strong>{h.snapshots?.total}</strong></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Users covered</span><strong>{h.snapshots?.users_covered}</strong></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Earliest</span><strong>{h.snapshots?.earliest ? new Date(h.snapshots.earliest).toLocaleDateString() : '—'}</strong></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Latest</span><strong>{h.snapshots?.latest ? new Date(h.snapshots.latest).toLocaleDateString() : '—'}</strong></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4" style={{ color: BRAND.accent }} />
                    UCIP Profiles (ucip_profiles)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Total profiles</span><strong>{h.ucip_profiles?.total}</strong></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Users covered</span><strong>{h.ucip_profiles?.users_covered}</strong></div>
                  <p className="text-xs text-gray-400 pt-1">Profiles built lazily on first request. Coverage grows as users engage the system.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Analytics ─────────────────────────────────────────────────── */}
          <TabsContent value="analytics">
            {e ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {(e.by_event_type || []).map((evt: any) => (
                    <Card key={evt.event_type}>
                      <CardContent className="pt-4 pb-3">
                        <p className="text-sm text-gray-500 capitalize">{evt.event_type.replace(/_/g, ' ')}</p>
                        <p className="text-3xl font-bold text-gray-900">{evt.count}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {(e.daily_activity || []).length === 0 && (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    No events recorded yet (30-day window). Events are logged when users interact with EI features.
                  </div>
                )}
              </div>
            ) : events.isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">No analytics data</div>
            )}
          </TabsContent>

          {/* ── Competency Analytics (W7) ──────────────────────────────── */}
          <TabsContent value="competency">
            {ca ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard icon={Users} label="Users with Scores" value={ca.coverage?.users_with_scores ?? 0} sub="have competency data" />
                  <MetricCard icon={Database} label="Competencies Assessed" value={ca.coverage?.competencies_assessed ?? 0} sub="unique competencies scored" color={BRAND.accent} />
                  <MetricCard icon={TrendingUp} label="Avg Competency Score" value={ca.coverage?.avg_score !== null ? Math.round(ca.coverage?.avg_score ?? 0) : '—'} sub="across all users" color={BRAND.success} />
                  <MetricCard icon={Award} label="Avg Confidence" value={ca.coverage?.avg_confidence !== null ? `${Math.round((ca.coverage?.avg_confidence ?? 0) * 100)}%` : '—'} sub="evidence quality" color="#8b5cf6" />
                </div>

                {(ca.top_competencies || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart2 className="h-4 w-4" style={{ color: BRAND.primary }} />
                        Top Competencies by Coverage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {ca.top_competencies.map((c: any) => (
                          <div key={c.canonical_name} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 flex-1 truncate pr-2">{c.canonical_name}</span>
                            <span className="text-xs text-gray-400 mr-2">{c.cluster}</span>
                            <span className="font-medium text-gray-900 w-12 text-right">{c.user_count} users</span>
                            <span className="text-xs text-gray-500 w-16 text-right">avg {c.avg_score ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(ca.gap_distribution || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" style={{ color: BRAND.warning }} />
                        Gap Severity Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {ca.gap_distribution.map((g: any) => (
                          <div key={g.severity} className="text-center p-3 rounded-lg bg-gray-50">
                            <p className="text-2xl font-bold text-gray-900">{g.count}</p>
                            <p className="text-xs capitalize text-gray-500">{g.severity}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(ca.gap_distribution || []).length === 0 && (ca.coverage?.users_with_scores ?? 0) === 0 && (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    No competency scores recorded yet. Scores are populated as users complete career builder assessments.
                  </div>
                )}
              </div>
            ) : compAnalytics.isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">No competency analytics data available</div>
            )}
          </TabsContent>

          {/* ── Recommendations Analytics (W7) ─────────────────────────── */}
          <TabsContent value="recommendations">
            {(ra || rv) ? (
              <div className="space-y-4">
                {ra && (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <MetricCard icon={Activity} label="EI Snapshots" value={ra.ei_snapshot_summary?.total_snapshots ?? 0} sub="total across all users" />
                    <MetricCard icon={Users} label="Users with EI Scores" value={ra.ei_snapshot_summary?.users_with_snapshots ?? 0} sub="have composite EI" color={BRAND.accent} />
                    <MetricCard icon={TrendingUp} label="Avg EI Score" value={ra.ei_snapshot_summary?.avg_ei_score != null ? Math.round(ra.ei_snapshot_summary.avg_ei_score) : '—'} sub="across all snapshots" color={BRAND.success} />
                    <MetricCard icon={GitBranch} label="Active Pathways" value={ra.pathway_coverage?.active_pathways ?? 0} sub="in occupation graph" color="#8b5cf6" />
                    <MetricCard icon={Map} label="Origin Occupations" value={ra.pathway_coverage?.origin_occupations ?? 0} sub="have outbound paths" color="#f59e0b" />
                  </div>
                )}

                {ra && (ra.ei_band_distribution || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" style={{ color: BRAND.primary }} />
                        EI Band Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-3">
                        {ra.ei_band_distribution.map((b: any) => (
                          <div key={b.band} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
                            <span className="text-sm font-medium text-gray-700 capitalize">{b.band || 'unknown'}</span>
                            <Badge variant="outline" className="text-xs">{b.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {rv && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Network className="h-4 w-4" style={{ color: BRAND.accent }} />
                        Resolver Analytics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-sm"><span className="text-gray-500">Active occupations</span><p className="font-bold">{rv.occupation_stats?.active ?? '—'}</p></div>
                        <div className="text-sm"><span className="text-gray-500">Role families</span><p className="font-bold">{rv.occupation_stats?.families ?? '—'}</p></div>
                        <div className="text-sm"><span className="text-gray-500">Total skills</span><p className="font-bold">{rv.skill_stats?.total_skills ?? '—'}</p></div>
                        <div className="text-sm"><span className="text-gray-500">Avg market demand</span><p className="font-bold">{rv.skill_stats?.avg_demand != null ? (rv.skill_stats.avg_demand * 100).toFixed(0) + '%' : '—'}</p></div>
                      </div>
                      {(rv.family_distribution || []).length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-gray-500 mb-2">Occupations by family</p>
                          <div className="flex flex-wrap gap-2">
                            {rv.family_distribution.map((f: any) => (
                              <Badge key={f.role_family} variant="outline" className="text-xs capitalize">{f.role_family} ({f.count})</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : recAnalytics.isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">No recommendation analytics data available</div>
            )}
          </TabsContent>

          {/* ── Consistency Check (W5) ─────────────────────────────────── */}
          <TabsContent value="consistency">
            {cc ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border" style={{
                  backgroundColor: cc.status === 'clean' ? '#f0fdf4' : cc.status === 'warnings' ? '#fffbeb' : '#fef2f2',
                  borderColor: cc.status === 'clean' ? '#bbf7d0' : cc.status === 'warnings' ? '#fde68a' : '#fecaca',
                }}>
                  {cc.status === 'clean'
                    ? <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                    : cc.status === 'warnings'
                    ? <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
                    : <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />}
                  <div>
                    <p className="font-semibold capitalize" style={{ color: cc.status === 'clean' ? '#15803d' : cc.status === 'warnings' ? '#92400e' : '#b91c1c' }}>
                      {cc.status === 'clean' ? 'All consistency checks passed' : cc.status === 'warnings' ? `${cc.total_issues} minor consistency issues` : `${cc.total_issues} consistency issues found`}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{cc.total_issues === 0 ? 'EI components are internally consistent.' : 'Review the checks below for details.'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(cc.checks || {}).map(([key, value]: [string, any]) => (
                    <Card key={key}>
                      <CardContent className="py-3 px-4 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800 capitalize">{key.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{cc.interpretation?.[key]}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-lg font-bold ${Number(value) === 0 ? 'text-green-600' : 'text-red-600'}`}>{value}</span>
                          {Number(value) === 0
                            ? <CheckCircle className="h-4 w-4 text-green-500" />
                            : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : consistencyCheck.isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">No consistency data available</div>
            )}
          </TabsContent>

          {/* ── Data Quality ──────────────────────────────────────────────── */}
          <TabsContent value="quality">
            {q ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 mb-2">
                  <MetricCard icon={AlertTriangle} label="Orphan Occupations" value={q.summary?.orphan_occ_count ?? 0} sub="no skill mappings" color={q.summary?.orphan_occ_count > 0 ? BRAND.danger : BRAND.success} />
                  <MetricCard icon={Database} label="Unlinked Skills" value={q.summary?.unlinked_skill_count ?? 0} sub="not used by any occupation" color={q.summary?.unlinked_skill_count > 0 ? BRAND.warning : BRAND.success} />
                  <MetricCard icon={GitBranch} label="Terminal Occupations" value={q.summary?.no_outbound_count ?? 0} sub="no outbound pathway" color={BRAND.primary} />
                </div>

                {(q.orphan_occupations || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">Orphan Occupations (no skills mapped)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {q.orphan_occupations.map((o: any) => (
                          <Badge key={o.canonical_title} variant="outline" className="text-xs">{o.canonical_title}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(q.no_outbound_pathway || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-500" />
                        Terminal Occupations (no outbound pathway — may be intentional for senior/C-suite roles)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {q.no_outbound_pathway.map((o: any) => (
                          <Badge key={o.canonical_title} variant="outline" className="text-xs text-gray-600">{o.canonical_title}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(q.unlinked_skills || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-700">Unlinked Skills (not used by any occupation)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {q.unlinked_skills.slice(0, 30).map((s: any) => (
                          <Badge key={s.canonical_name} variant="outline" className="text-xs">{s.canonical_name}</Badge>
                        ))}
                        {q.unlinked_skills.length > 30 && <Badge variant="outline" className="text-xs">+{q.unlinked_skills.length - 30} more</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : quality.isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">No quality data available</div>
            )}
          </TabsContent>
          {/* ── P-R5 W7: Trends ───────────────────────────────────────────── */}
          <TabsContent value="trends">
            {ta ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <MetricCard icon={TrendingUp} label="Improving Users (30d)" value={ta.improving_users_30d ?? 0} sub="EI score increased vs prior period" color={BRAND.success} />
                  <MetricCard icon={Users} label="Weekly Band Entries" value={(ta.band_distribution || []).reduce((s: number, b: any) => s + b.users, 0)} sub="users with EI band assignments" color={BRAND.accent} />
                </div>
                {(ta.band_distribution || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">EI Band Distribution (latest snapshot)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-3">
                        {ta.band_distribution.map((b: any) => (
                          <div key={b.band} className="text-center p-3 rounded-lg bg-gray-50 min-w-[90px]">
                            <p className="text-xl font-bold text-gray-900">{b.users}</p>
                            <p className="text-xs capitalize text-gray-500">{b.band || 'unknown'}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {(ta.weekly_trend || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Weekly EI Trend (last 12 weeks)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        {ta.weekly_trend.slice(0, 8).map((w: any) => (
                          <div key={w.week} className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400 w-24 text-xs">{w.week ? new Date(w.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}</span>
                            <span className="text-gray-600 w-16">{w.users} users</span>
                            <span className="font-medium text-gray-800">avg {w.avg_score != null ? Math.round(w.avg_score) : '—'}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : trendAnalytics.isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">No trend data available yet. Trends populate once users have multiple EI snapshots.</div>
            )}
          </TabsContent>

          {/* ── P-R5 W7: Cohorts ──────────────────────────────────────────── */}
          <TabsContent value="cohorts">
            {coha ? (
              <div className="space-y-4">
                {(coha.by_seniority || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">EI by Seniority Level</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {coha.by_seniority.map((r: any) => (
                          <div key={r.seniority} className="flex items-center justify-between text-sm">
                            <span className="capitalize text-gray-700 flex-1">{r.seniority || 'unknown'}</span>
                            <span className="text-xs text-gray-400 mr-3">{r.users} users</span>
                            <span className="font-medium w-12 text-right">{r.avg_ei != null ? Math.round(r.avg_ei) : '—'}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {(coha.by_domain || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">EI by Domain</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {coha.by_domain.map((r: any) => (
                          <div key={r.domain} className="flex items-center justify-between text-sm">
                            <span className="capitalize text-gray-700 flex-1">{r.domain || 'unknown'}</span>
                            <span className="text-xs text-gray-400 mr-3">{r.users} users</span>
                            <span className="font-medium w-12 text-right">{r.avg_ei != null ? Math.round(r.avg_ei) : '—'}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {(coha.top_target_occupations || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Top Target Occupations</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {coha.top_target_occupations.map((o: any) => (
                          <div key={o.occupation} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
                            <span className="text-sm text-gray-700">{o.occupation || 'unknown'}</span>
                            <Badge variant="outline" className="text-xs">{o.users}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {(coha.by_seniority || []).length === 0 && (coha.by_domain || []).length === 0 && (
                  <div className="text-center py-10 text-gray-400 text-sm">No cohort data available yet. Cohort analytics populate once users have career profiles with seniority or domain data.</div>
                )}
              </div>
            ) : cohortAnalytics.isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">No cohort analytics available</div>
            )}
          </TabsContent>

          {/* ── P-R5 W7: Graph ────────────────────────────────────────────── */}
          <TabsContent value="graph">
            {gi ? (
              <div className="space-y-4">
                <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                  gi.status === 'healthy' ? 'bg-green-50 border-green-200'
                  : gi.status === 'warning' ? 'bg-amber-50 border-amber-200'
                  : 'bg-red-50 border-red-200'}`}>
                  {gi.status === 'healthy'
                    ? <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                    : gi.status === 'warning'
                    ? <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
                    : <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />}
                  <div>
                    <p className="font-semibold capitalize">{gi.status === 'healthy' ? 'Graph integrity: healthy' : gi.status === 'warning' ? `${gi.total_issues} graph issues` : `${gi.total_issues} critical graph issues`}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{gi.total_issues === 0 ? 'No orphans or broken references.' : 'See details below.'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <MetricCard icon={Briefcase} label="Active Occupations" value={gi.occupation_count ?? 0} sub="in occupation graph" />
                  <MetricCard icon={Database} label="Active Skills" value={gi.skill_count ?? 0} sub="in skills catalogue" color={BRAND.accent} />
                  <MetricCard icon={GitBranch} label="Active Pathways" value={gi.pathway_count ?? 0} sub="career progression routes" color="#8b5cf6" />
                  <MetricCard icon={AlertTriangle} label="Orphan Occupations" value={gi.orphan_occupations ?? 0} sub="no skill mappings" color={gi.orphan_occupations > 0 ? BRAND.danger : BRAND.success} />
                  <MetricCard icon={Database} label="Orphan Skills" value={gi.orphan_skills ?? 0} sub="not used by any occupation" color={gi.orphan_skills > 0 ? BRAND.warning : BRAND.success} />
                  <MetricCard icon={GitBranch} label="Broken Pathways" value={gi.broken_pathways ?? 0} sub="referencing missing occupations" color={gi.broken_pathways > 0 ? BRAND.danger : BRAND.success} />
                </div>
                {(pa || {}).coverage && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Pathway Coverage Stats</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-500">Avg difficulty</span><p className="font-bold">{pa.coverage?.avg_difficulty != null ? pa.coverage.avg_difficulty.toFixed(1) : '—'} / 10</p></div>
                        <div><span className="text-gray-500">Avg timeframe</span><p className="font-bold">{pa.coverage?.avg_timeframe_months != null ? Math.round(pa.coverage.avg_timeframe_months) + ' months' : '—'}</p></div>
                        <div><span className="text-gray-500">Origin occupations</span><p className="font-bold">{pa.coverage?.origin_occupations ?? '—'}</p></div>
                        <div><span className="text-gray-500">Destination occupations</span><p className="font-bold">{pa.coverage?.destination_occupations ?? '—'}</p></div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : graphIntegrityData.isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">Graph integrity data unavailable</div>
            )}
          </TabsContent>

          {/* ── P-R5 W7: Intelligence Health ──────────────────────────────── */}
          <TabsContent value="health">
            {ih ? (
              <div className="space-y-4">
                <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                  ih.overall_health === 'healthy' ? 'bg-green-50 border-green-200'
                  : ih.overall_health === 'partial' ? 'bg-amber-50 border-amber-200'
                  : 'bg-blue-50 border-blue-200'}`}>
                  {ih.overall_health === 'healthy'
                    ? <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                    : <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />}
                  <div>
                    <p className="font-semibold capitalize">
                      {ih.overall_health === 'healthy' ? 'All intelligence layers active'
                       : ih.overall_health === 'partial' ? 'Some layers initialising or missing data'
                       : 'Initialising — awaiting first user data'}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">P-R5 intelligence layer status.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(ih.checks || {}).map(([key, check]: [string, any]) => (
                    <Card key={key}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium capitalize text-gray-800">{key.replace(/_/g, ' ')}</p>
                          <Badge variant="outline" className={`text-xs ${check.status === 'active' ? 'text-green-700 border-green-300' : 'text-amber-700 border-amber-300'}`}>
                            {check.status}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-xs text-gray-500">
                          {check.version && <div className="flex justify-between"><span>Version</span><strong>{check.version}</strong></div>}
                          {check.users_with_scores != null && <div className="flex justify-between"><span>Users with scores</span><strong>{check.users_with_scores}</strong></div>}
                          {check.users_tracked != null && <div className="flex justify-between"><span>Users tracked</span><strong>{check.users_tracked}</strong></div>}
                          {check.events_30d != null && <div className="flex justify-between"><span>Events (30d)</span><strong>{check.events_30d}</strong></div>}
                          {check.users_in_pool != null && <div className="flex justify-between"><span>Users in EI pool</span><strong>{check.users_in_pool}</strong></div>}
                          {check.k_min != null && <div className="flex justify-between"><span>k-anonymity min</span><strong>{check.k_min}</strong></div>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : intelligenceHealth.isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">Intelligence health data unavailable</div>
            )}
          </TabsContent>

          {/* ── Intelligence v2 ───────────────────────────────────────────── */}
          <TabsContent value="intelligence-v2">
            {/* Seed toolbar */}
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50">
              <Zap className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-gray-500 flex-1">
                No data yet? Seed realistic demo data to populate all 7 intelligence layers.
              </p>
              <Button size="sm" variant="outline" className="text-xs"
                disabled={seedMutation.isPending}
                onClick={() => seedMutation.mutate(false)}>
                {seedMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                Seed Demo Data
              </Button>
              <Button size="sm" variant="ghost" className="text-xs text-red-500"
                disabled={seedMutation.isPending}
                onClick={() => seedMutation.mutate(true)}>
                Re-seed (wipe)
              </Button>
            </div>

            {intelligenceV2.data ? (() => {
              const d = intelligenceV2.data;
              const s = d.summary ?? {};
              const layers = d.layers ?? {};
              const readinessPct = Number(s.readiness_pct ?? 0);
              const overallColor = s.overall === 'world_class' ? '#10B981'
                : s.overall === 'high' ? '#3B82F6'
                : s.overall === 'partial' ? '#F59E0B'
                : '#94A3B8';
              return (
                <div className="space-y-4">
                  {/* Summary banner */}
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">P-R6 World-Class Readiness</p>
                          <div className="flex items-center gap-2">
                            <span className="text-3xl font-bold" style={{ color: BRAND.primary }}>{readinessPct}%</span>
                            <Badge variant="outline" className="text-xs" style={{ color: overallColor, borderColor: overallColor }}>
                              {s.overall?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{s.active_layers}/{s.total_layers}</p>
                          <p className="text-xs text-gray-400">layers active</p>
                        </div>
                      </div>
                      <Progress value={readinessPct} className="h-2" />
                      {d.version && <p className="text-[10px] text-gray-300 mt-2">Version {d.version} · {d.generated_at ? new Date(d.generated_at).toLocaleString() : ''}</p>}
                    </CardContent>
                  </Card>

                  {/* Per-layer grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(layers).map(([key, layer]: [string, any]) => {
                      const isActive = layer.status === 'active';
                      const isPartial = layer.status === 'partial';
                      return (
                        <Card key={key}>
                          <CardContent className="pt-4 pb-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {isActive ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                ) : isPartial ? (
                                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-gray-300 shrink-0" />
                                )}
                                <p className="text-sm font-semibold text-gray-800">{layer.label}</p>
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${isActive ? 'text-green-700 border-green-300' : isPartial ? 'text-amber-700 border-amber-300' : 'text-gray-400 border-gray-200'}`}>
                                {layer.status?.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">{layer.description}</p>
                            <div className="space-y-1">
                              {Object.entries(layer.metrics ?? {}).map(([mk, mv]: [string, any]) => (
                                <div key={mk} className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">{mk.replace(/_/g, ' ')}</span>
                                  <strong className={typeof mv === 'boolean' ? (mv ? 'text-green-600' : 'text-red-500') : ''}>
                                    {typeof mv === 'boolean' ? (mv ? 'Yes' : 'No') : String(mv ?? '—')}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })()
            : intelligenceV2.isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">Intelligence v2 data unavailable</div>
            )}
          </TabsContent>

          {/* ── User Drill-down ─────────────────────────────────────────────── */}
          <TabsContent value="user-drill">
            <UserDrillDown />
          </TabsContent>

        </Tabs>
      )}

      {loading && !h && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin" style={{ color: BRAND.primary }} />
        </div>
      )}
    </div>
  );
}
