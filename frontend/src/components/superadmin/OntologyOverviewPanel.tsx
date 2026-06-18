import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Briefcase, Layers, Users2, UserCircle2,
  Network, PieChart, TrendingUp, Brain, AlertTriangle, Target, MessageCircle,
  BarChart2, BookOpen, Sparkles, GitBranch, Map,
  CheckCircle2, AlertCircle, Clock, RefreshCw, Database, Shield,
  ArrowRight, Zap, Info,
} from 'lucide-react';

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
}

interface Stats {
  // Taxonomy
  industries: number; functions: number; departments: number;
  role_families: number; roles: number;
  // Core
  layers: number; clusters: number; competencies: number; micro_competencies: number;
  // Behavioral
  concerns: number; indicators: number; assessment_questions: number;
  // Supplementary
  competency_levels: number; benchmarks: number;
  career_tracks: number; career_paths: number; learning_paths: number; future_skills: number;
  // Mappings
  map_ind_fn: number; map_role_layer: number; map_layer_cluster: number;
  map_cluster_comp: number; map_role_comp: number;
  map_role_comp_derived?: number; map_role_comp_native?: number;
  map_micro_concern: number; map_concern_ind: number; map_ind_q: number;
  map_micro_q: number; map_comp_fs: number;
  // Reference
  ref_seniority: number; ref_proficiency: number; ref_categories: number;
  ref_assessment_types: number; ref_lifecycle: number;
  // Governance
  gov_schedules: number; gov_quality_rules: number; pending_reviews: number;
  // Version control
  snapshots: number; changes: number; lifecycle_events: number;
  // Status
  comp_published: number; comp_draft: number; comp_in_review: number;
}

interface SeedResult { phases: Record<string, number>; totalRows: number; ok: boolean; error?: string; }

interface ImportResult { counts: Record<string, number>; ok: boolean; error?: string; }

const HIERARCHY: Array<{
  id: string; label: string; icon: React.FC<any>; field: keyof Stats;
  target: number; section: string; color: string; description: string;
}> = [
  { id: 'industries',    label: 'Industries',         icon: Building2,    field: 'industries',         target: 12, section: 'taxonomy',    color: '#3B82F6', description: 'Sector classifications (e.g. Technology, Healthcare, Finance)' },
  { id: 'functions',     label: 'Functions',          icon: Briefcase,    field: 'functions',          target: 15, section: 'taxonomy',    color: '#0EA5E9', description: 'Cross-industry business functions (Engineering, Sales, HR…)' },
  { id: 'departments',   label: 'Departments',        icon: Layers,       field: 'departments',        target: 20, section: 'taxonomy',    color: '#6366F1', description: 'Teams within a function (Software Dev, Brand Marketing…)' },
  { id: 'role_families', label: 'Role Families',      icon: Users2,       field: 'role_families',      target: 8,  section: 'taxonomy',    color: '#8B5CF6', description: 'Career family groupings (Software Engineering, Data & Analytics…)' },
  { id: 'roles',         label: 'Roles',              icon: UserCircle2,  field: 'roles',              target: 24, section: 'taxonomy',    color: '#EC4899', description: 'Named positions with seniority (Senior Software Engineer, PM…)' },
  { id: 'layers',        label: 'Layers',             icon: Network,      field: 'layers',             target: 4,  section: 'competency',  color: '#10B981', description: 'Competency tiers: Foundation, Functional Core, Leadership, Specialist' },
  { id: 'clusters',      label: 'Competency Clusters',icon: PieChart,     field: 'clusters',           target: 12, section: 'competency',  color: '#14B8A6', description: 'Thematic groupings of competencies within a layer' },
  { id: 'competencies',  label: 'Competencies',       icon: TrendingUp,   field: 'competencies',       target: 24, section: 'competency',  color: '#F59E0B', description: 'Named, measurable skills (e.g. Effective Communication, Change Leadership)' },
  { id: 'micro_competencies', label: 'Micro Competencies', icon: Brain,  field: 'micro_competencies', target: 20, section: 'competency',  color: '#EF4444', description: 'Proficiency-level observable behaviours (Novice → Expert)' },
  { id: 'concerns',      label: 'Concerns',           icon: AlertTriangle,field: 'concerns',           target: 8,  section: 'behavioral',  color: '#F97316', description: 'Behavioural patterns that emerge when competencies are absent' },
  { id: 'indicators',    label: 'Indicators',         icon: Target,       field: 'indicators',         target: 12, section: 'behavioral',  color: '#A78BFA', description: 'Observable signals mapped to concerns via bridge tags' },
  { id: 'assessment_questions', label: 'Assessment Questions', icon: MessageCircle, field: 'assessment_questions', target: 16, section: 'behavioral', color: '#84CC16', description: 'Canonical questions measuring indicators, with IRT support' },
];

const SECTIONS = [
  { id: 'taxonomy',   label: 'Taxonomy Hierarchy', color: '#3B82F6',   description: 'Industry → Function → Department → Role Family → Role' },
  { id: 'competency', label: 'Competency Core',    color: '#10B981',   description: 'Layer → Cluster → Competency → Micro Competency' },
  { id: 'behavioral', label: 'Behavioural Chain',  color: '#F97316',   description: 'Concern → Indicator → Assessment Question' },
];

const MAPPINGS = [
  { label: 'Industry ↔ Function',            field: 'map_ind_fn' as keyof Stats,       target: 40 },
  { label: 'Role ↔ Layer',                   field: 'map_role_layer' as keyof Stats,   target: 48 },
  { label: 'Layer ↔ Cluster',                field: 'map_layer_cluster' as keyof Stats,target: 12 },
  { label: 'Cluster ↔ Competency',           field: 'map_cluster_comp' as keyof Stats, target: 24 },
  { label: 'Micro Competency ↔ Concern',     field: 'map_micro_concern' as keyof Stats,target: 10 },
  { label: 'Concern ↔ Indicator',            field: 'map_concern_ind' as keyof Stats,  target: 12 },
  { label: 'Indicator ↔ Question',           field: 'map_ind_q' as keyof Stats,        target: 10 },
];

function healthColor(actual: number, target: number): string {
  if (actual === 0) return '#9CA3AF';
  if (actual >= target) return '#10B981';
  if (actual >= target * 0.5) return '#F59E0B';
  return '#EF4444';
}

function StatusDot({ actual, target }: { actual: number; target: number }) {
  const color = healthColor(actual, target);
  return <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />;
}

function EntityCard({ item, actual }: { item: typeof HIERARCHY[0]; actual: number }) {
  const pct = Math.min(100, Math.round((actual / item.target) * 100));
  const color = healthColor(actual, item.target);
  const Icon = item.icon;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${item.color}15` }}>
            <Icon className="w-4 h-4" style={{ color: item.color }} />
          </div>
          <span className="text-sm font-medium text-gray-800">{item.label}</span>
        </div>
        <span className="text-2xl font-bold" style={{ color }}>{actual}</span>
      </div>
      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{item.description}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-xs text-gray-400">{actual}/{item.target}</span>
      </div>
    </div>
  );
}

function MappingRow({ label, actual, target }: { label: string; actual: number; target: number }) {
  const pct = Math.min(100, Math.round((actual / target) * 100));
  const color = healthColor(actual, target);
  return (
    <div className="flex items-center gap-3 py-2">
      <StatusDot actual={actual} target={target} />
      <span className="text-sm text-gray-600 flex-1">{label}</span>
      <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-medium w-16 text-right" style={{ color }}>{actual} <span className="text-gray-400 font-normal">/ {target}</span></span>
    </div>
  );
}

export default function OntologyOverviewPanel() {
  const qc = useQueryClient();
  const [seedLog, setSeedLog] = useState<SeedResult | null>(null);
  const [importLog, setImportLog] = useState<ImportResult | null>(null);

  const { data, isLoading, error } = useQuery<{ stats: Stats }>({
    queryKey: ['ontology-overview-stats'],
    queryFn: async () => {
      const r = await apiFetch('/api/ontology/overview/stats');
      if (!r.ok) throw new Error('Failed to load');
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const seed = useMutation<SeedResult>({
    mutationFn: async () => {
      const r = await apiFetch('/api/ontology/overview/seed', { method: 'POST' });
      return r.json();
    },
    onSuccess: (result) => {
      setSeedLog(result);
      qc.invalidateQueries({ queryKey: ['ontology-overview-stats'] });
    },
  });

  const importOnet = useMutation<ImportResult>({
    mutationFn: async () => {
      const r = await apiFetch('/api/ontology/overview/import-onet', { method: 'POST' });
      return r.json();
    },
    onSuccess: (result) => {
      setImportLog(result);
      qc.invalidateQueries({ queryKey: ['ontology-overview-stats'] });
    },
    onError: (err: any) => {
      setImportLog({ counts: {}, ok: false, error: err?.message ?? 'O*NET import failed' });
    },
  });

  const stats = data?.stats;

  const totalEntities = stats
    ? HIERARCHY.reduce((s, item) => s + (stats[item.field] as number), 0)
    : 0;

  const totalMappings = stats
    ? MAPPINGS.reduce((s, m) => s + (stats[m.field] as number), 0)
    : 0;

  const seeded = !!stats && (stats.industries > 0 || stats.competencies > 0);

  const overallHealthItems = HIERARCHY.map(item => ({
    ok: !!stats && (stats[item.field] as number) >= item.target * 0.5,
  }));
  const healthPct = stats
    ? Math.round((overallHealthItems.filter(x => x.ok).length / overallHealthItems.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading ontology stats…</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-gray-500">Failed to load stats — backend may still be starting</p>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['ontology-overview-stats'] })}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competency Ontology Architecture</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Normalised 12-level hierarchy · 6 table prefixes (ont_ · map_ · ref_ · ver_ · lfc_ · gov_)
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Health score */}
          <div className="text-center px-4 py-2 bg-white border border-gray-200 rounded-xl">
            <div className="text-2xl font-bold" style={{ color: healthColor(healthPct, 80) }}>{healthPct}%</div>
            <div className="text-xs text-gray-400">Ontology Health</div>
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['ontology-overview-stats'] })}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh stats"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Summary row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Entities', value: totalEntities,             icon: Database, color: '#3B82F6' },
          { label: 'Mappings',       value: totalMappings,             icon: GitBranch,color: '#10B981' },
          { label: 'Snapshots',      value: stats.snapshots,           icon: Shield,   color: '#8B5CF6' },
          { label: 'Quality Rules',  value: stats.gov_quality_rules,   icon: CheckCircle2, color: '#F59E0B' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: `${color}15` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Seed section ───────────────────────────────────────────────────── */}
      {!seeded && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Ontology is empty — seed starter content</h3>
              <p className="text-blue-700 text-sm mt-1 mb-3">
                Seeds all 12 hierarchy levels with 250+ rows: 12 industries · 15 functions · 8 role families ·
                24 roles · 4 layers · 12 clusters · 24 competencies · 20 micro-competencies ·
                8 concerns · 12 indicators · 16 assessment questions · all mapping tables.
                Every INSERT uses ON CONFLICT DO NOTHING — safe to run repeatedly.
              </p>
              <button
                onClick={() => seed.mutate()}
                disabled={seed.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {seed.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {seed.isPending ? 'Seeding…' : 'Seed Starter Ontology'}
              </button>
            </div>
          </div>
        </div>
      )}

      {seeded && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Starter ontology seeded · {totalEntities} entities loaded</span>
          </div>
          <button
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-white border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 disabled:opacity-60"
          >
            {seed.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Re-run seed
          </button>
        </div>
      )}

      {/* Seed result log */}
      {seedLog && (
        <div className={`rounded-xl border p-4 ${seedLog.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {seedLog.ok
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span className="text-sm font-semibold">{seedLog.ok ? `Seed complete — ${seedLog.totalRows} rows` : `Seed failed: ${seedLog.error}`}</span>
          </div>
          {seedLog.ok && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
              {Object.entries(seedLog.phases).map(([k, v]) => (
                <span key={k}><span className="font-medium">{v}</span> {k.replace(/_/g, ' ')}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── O*NET library import ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-violet-900">Import O*NET library</h3>
                <p className="text-violet-700 text-sm mt-1">
                  Imports the full O*NET role/skill taxonomy (~1,000 roles · ~49k role-competency links)
                  into the <code className="text-xs bg-violet-100 px-1 rounded">ont_*</code> tables. Idempotent
                  and additive — starter seed rows use a disjoint code namespace and are untouched. May take a
                  minute on first run while source files download.
                </p>
              </div>
              <button
                onClick={() => importOnet.mutate()}
                disabled={importOnet.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg font-medium text-sm hover:bg-violet-700 disabled:opacity-60 transition-colors flex-shrink-0 self-start"
              >
                {importOnet.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {importOnet.isPending ? 'Importing…' : 'Import O*NET library'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import result log */}
      {importLog && (
        <div className={`rounded-xl border p-4 ${importLog.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {importLog.ok
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span className="text-sm font-semibold">
              {importLog.ok ? 'O*NET import complete' : `O*NET import failed: ${importLog.error}`}
            </span>
          </div>
          {importLog.ok && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
              <span><span className="font-medium">{importLog.counts.roles ?? 0}</span> roles</span>
              <span><span className="font-medium">{importLog.counts.competencies ?? 0}</span> competencies</span>
              <span><span className="font-medium">{importLog.counts.map_role_competency ?? 0}</span> role-competency links</span>
              <span><span className="font-medium">{importLog.counts.links_skipped_below_threshold ?? 0}</span> links skipped (below importance threshold)</span>
            </div>
          )}
        </div>
      )}

      {/* ── Hierarchy sections ─────────────────────────────────────────────── */}
      {SECTIONS.map(section => {
        const items = HIERARCHY.filter(h => h.section === section.id);
        return (
          <div key={section.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-5 w-1 rounded-full" style={{ background: section.color }} />
              <div>
                <h2 className="text-base font-semibold text-gray-800">{section.label}</h2>
                <p className="text-xs text-gray-400">{section.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(item => (
                <EntityCard key={item.id} item={item} actual={stats[item.field] as number} />
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Mapping coverage ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-5 w-1 rounded-full bg-gray-400" />
          <div>
            <h2 className="text-base font-semibold text-gray-800">Mapping Coverage</h2>
            <p className="text-xs text-gray-400">Relationship tables connecting the hierarchy (map_ prefix)</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
          {MAPPINGS.map(m => (
            <div key={m.label} className="px-4">
              <MappingRow label={m.label} actual={stats[m.field] as number} target={m.target} />
            </div>
          ))}
          {stats.map_role_comp > 0 && (
            <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-600 flex-1">Role ↔ Competency</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                {stats.map_role_comp_native ?? stats.map_role_comp} O*NET / curated
              </span>
              {(stats.map_role_comp_derived ?? 0) > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                  {stats.map_role_comp_derived} estimated / inherited
                </span>
              )}
              <span className="text-sm font-medium w-16 text-right text-gray-700">{stats.map_role_comp}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Reference data + Governance + Version control ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Reference data */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500" /> Reference Tables
            <span className="text-xs font-normal text-gray-400">(ref_ prefix · seeded)</span>
          </h3>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Seniority Levels',    value: stats.ref_seniority,       target: 11 },
              { label: 'Proficiency Levels',  value: stats.ref_proficiency,     target: 5 },
              { label: 'Competency Categories',value: stats.ref_categories,     target: 7 },
              { label: 'Assessment Types',    value: stats.ref_assessment_types,target: 10 },
              { label: 'Lifecycle Transitions',value: stats.ref_lifecycle,      target: 8 },
            ].map(({ label, value, target }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot actual={value} target={target} />
                  <span className="text-gray-600">{label}</span>
                </div>
                <span className="font-medium" style={{ color: healthColor(value, target) }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Governance */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" /> Governance
            <span className="text-xs font-normal text-gray-400">(gov_ prefix)</span>
          </h3>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Review Schedules',   value: stats.gov_schedules,    target: 7 },
              { label: 'Quality Gate Rules', value: stats.gov_quality_rules,target: 12 },
              { label: 'Pending Reviews',    value: stats.pending_reviews,  target: 0, invert: true },
            ].map(({ label, value, target, invert }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot actual={invert ? (value === 0 ? 1 : 0) : value} target={1} />
                  <span className="text-gray-600">{label}</span>
                </div>
                <span className="font-medium" style={{ color: invert ? (value === 0 ? '#10B981' : '#F59E0B') : healthColor(value, target) }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Version control */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-500" /> Version Control
            <span className="text-xs font-normal text-gray-400">(ver_ / lfc_ prefix)</span>
          </h3>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Entity Snapshots',     value: stats.snapshots },
              { label: 'Field-level Changes',  value: stats.changes },
              { label: 'Lifecycle Events',     value: stats.lifecycle_events },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 flex items-start gap-1.5">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
            Snapshots are captured automatically on every status transition to "published".
            Change history is written on every PATCH.
          </p>
        </div>
      </div>

      {/* ── Supplementary modules ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-5 w-1 rounded-full bg-amber-400" />
          <div>
            <h2 className="text-base font-semibold text-gray-800">Supplementary Modules</h2>
            <p className="text-xs text-gray-400">Competency level anchors, benchmarks, career tracks, learning paths, future skills</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Level Anchors',  value: stats.competency_levels, icon: BarChart2, color: '#3B82F6' },
            { label: 'Benchmarks',     value: stats.benchmarks,        icon: BarChart2, color: '#6366F1' },
            { label: 'Career Tracks',  value: stats.career_tracks,     icon: Map,       color: '#0EA5E9' },
            { label: 'Career Paths',   value: stats.career_paths,      icon: GitBranch, color: '#8B5CF6' },
            { label: 'Learning Paths', value: stats.learning_paths,    icon: BookOpen,  color: '#10B981' },
            { label: 'Future Skills',  value: stats.future_skills,     icon: Sparkles,  color: '#F59E0B' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-xl p-3 text-center">
              <Icon className="w-5 h-5 mx-auto mb-1" style={{ color }} />
              <div className="text-xl font-bold text-gray-800">{value}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Architecture legend ────────────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-400" /> Normalised Database Architecture — Table Prefix Guide
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {[
            { prefix: 'ont_',  label: 'Master entity tables',    desc: 'The nouns of the ontology (ont_industries, ont_competencies…)',    color: '#3B82F6' },
            { prefix: 'map_',  label: 'Mapping / relationship',  desc: 'M2M joins with weights (map_cluster_competency, map_role_layer…)',  color: '#10B981' },
            { prefix: 'ref_',  label: 'Reference / lookup',      desc: 'Canonical code lists, seeded once (ref_proficiency_levels…)',       color: '#F59E0B' },
            { prefix: 'ver_',  label: 'Version control',         desc: 'Immutable append-only snapshots + field-level diff log',            color: '#8B5CF6' },
            { prefix: 'lfc_',  label: 'Lifecycle events',        desc: 'Every status transition per entity — audit trail',                  color: '#EC4899' },
            { prefix: 'gov_',  label: 'Governance',              desc: 'Review schedules, review instances, quality gate rules',            color: '#EF4444' },
          ].map(p => (
            <div key={p.prefix} className="flex items-start gap-2">
              <code className="text-xs font-bold px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ background: p.color }}>{p.prefix}</code>
              <div>
                <div className="font-medium text-gray-700">{p.label}</div>
                <div className="text-gray-400">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
