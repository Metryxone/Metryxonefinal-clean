/**
 * LIP — Learning Intelligence Tab
 * Sub-tabs: Gap Map | My Path | Resources | Needs | Report | Readiness
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, AlertTriangle, TrendingUp, BookOpen, Award,
  Briefcase, Users, RefreshCw, ChevronDown, ChevronRight,
  Star, Clock, DollarSign, CheckCircle2, Circle, PlayCircle,
  SkipForward, Bookmark, BookmarkCheck, Target, Zap,
  BarChart3, Brain, Activity, Filter, Search, Lightbulb, FileText,
} from 'lucide-react';

const BRAND = {
  primary: '#6C63FF',
  accent: '#FF6584',
  green: '#43C59E',
  amber: '#F7B731',
  red: '#FC5C65',
  blue: '#45AAF2',
  navy: '#1E293B',
  text: '#374151',
  sub: '#6B7280',
  border: '#E5E7EB',
  bg: '#F9FAFB',
};

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts?.headers || {}) } });
  const body = await res.json();
  if (res.status === 503) return { success: false, __flagOff: true, ...body };
  return body;
}

function FeatureDisabled() {
  return (
    <div className="rounded-2xl border p-8 text-center" style={{ borderColor: BRAND.border, backgroundColor: '#FAFAFA' }}>
      <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <Zap size={18} className="text-gray-300" />
      </div>
      <p className="text-sm font-semibold text-gray-500">Learning Intelligence not yet enabled</p>
      <p className="text-xs text-gray-400 mt-1">Contact your platform administrator to activate this feature.</p>
    </div>
  );
}

function EmptyAssessment({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="rounded-2xl border p-8 text-center" style={{ borderColor: BRAND.border }}>
      <div className="mx-auto mb-3 text-gray-200">{icon}</div>
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xs mx-auto">{hint}</p>
    </div>
  );
}

type SubTab = 'gap-map' | 'my-path' | 'resources' | 'needs' | 'report' | 'readiness';
type ResourceTab = 'courses' | 'certifications' | 'projects' | 'mentors';

// ── Severity helpers ───────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: BRAND.red,
  major: BRAND.accent,
  moderate: BRAND.amber,
  minor: BRAND.green,
};
const SEV_BG: Record<string, string> = {
  critical: '#FEF2F2',
  major: '#FFF5F5',
  moderate: '#FFFBEB',
  minor: '#F0FDF4',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: SEV_COLOR[severity] ?? '#666', backgroundColor: SEV_BG[severity] ?? '#f5f5f5' }}>
      {severity}
    </span>
  );
}

function GaugeMini({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: BRAND.primary }} />
    </div>
  );
}

// ── Gap Map Sub-tab ────────────────────────────────────────────────────────────
function GapMapTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGap, setSelectedGap] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/lip/competency-gaps${refresh ? '?refresh=1' : ''}`);
      if (r.success) setData(r.data);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => { setRefreshing(true); load(true); };

  if (loading) return <LoadingSpinner />;

  const gaps: any[] = data?.gaps ?? [];
  const critical = gaps.filter(g => g.gap_severity === 'critical');
  const major = gaps.filter(g => g.gap_severity === 'major');
  const moderate = gaps.filter(g => g.gap_severity === 'moderate');
  const minor = gaps.filter(g => g.gap_severity === 'minor');

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Critical', count: critical.length, color: BRAND.red, bg: '#FEF2F2' },
          { label: 'Major', count: major.length, color: BRAND.accent, bg: '#FFF5F5' },
          { label: 'Moderate', count: moderate.length, color: BRAND.amber, bg: '#FFFBEB' },
          { label: 'Coverage', count: `${data?.overall_coverage_pct ?? 0}%`, color: BRAND.green, bg: '#F0FDF4' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 border" style={{ backgroundColor: s.bg, borderColor: `${s.color}30` }}>
            <p className="text-[11px] font-medium" style={{ color: s.color }}>{s.label}</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Showing {gaps.length} competency gaps identified</p>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 transition-all disabled:opacity-50">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Gap grid */}
      {data?.__flagOff ? <FeatureDisabled /> : gaps.length === 0 ? (
        <EmptyAssessment
          icon={<Target size={36} />}
          title="No competency gaps mapped yet"
          hint="Complete the Competency Assessment (Assessment tab) or a CAPADEX session — the gap engine runs automatically once your first scores are on file."
        />
      ) : (
        <div className="space-y-2">
          {gaps.map((gap: any) => (
            <div key={gap.competency_code}
              className="rounded-xl border p-3 cursor-pointer transition-all hover:shadow-sm"
              style={{ borderColor: selectedGap?.competency_code === gap.competency_code ? SEV_COLOR[gap.gap_severity] : BRAND.border, backgroundColor: selectedGap?.competency_code === gap.competency_code ? `${SEV_COLOR[gap.gap_severity]}06` : 'white' }}
              onClick={() => setSelectedGap(selectedGap?.competency_code === gap.competency_code ? null : gap)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <SeverityBadge severity={gap.gap_severity} />
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {(gap.competency_label || gap.competency_code)?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-500">{gap.current_score}→{gap.target_score}</span>
                  <span className="text-xs font-semibold" style={{ color: SEV_COLOR[gap.gap_severity] }}>
                    -{gap.gap_magnitude}pts
                  </span>
                  {selectedGap?.competency_code === gap.competency_code
                    ? <ChevronDown size={14} className="text-gray-400" />
                    : <ChevronRight size={14} className="text-gray-400" />}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2">
                <GaugeMini value={gap.current_score} color={SEV_COLOR[gap.gap_severity]} />
              </div>

              {/* Expanded detail */}
              {selectedGap?.competency_code === gap.competency_code && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>📚 {gap.min_hours_to_close}h to close</span>
                    <span>🎯 Priority {gap.learning_priority}</span>
                    <span>📊 Source: {gap.source?.replace(/_/g, ' ')}</span>
                    <span>🔍 Confidence: {Math.round((gap.confidence ?? 0.5) * 100)}%</span>
                  </div>
                  {gap.recommended_resource_types && (
                    <div className="flex flex-wrap gap-1.5">
                      {(Array.isArray(gap.recommended_resource_types) ? gap.recommended_resource_types : JSON.parse(gap.recommended_resource_types || '[]'))
                        .map((t: string) => (
                          <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t}</span>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── My Path Sub-tab ────────────────────────────────────────────────────────────
const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle size={14} className="text-gray-300" />,
  in_progress: <PlayCircle size={14} style={{ color: BRAND.primary }} />,
  completed: <CheckCircle2 size={14} style={{ color: BRAND.green }} />,
  skipped: <SkipForward size={14} className="text-gray-300" />,
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen size={14} style={{ color: BRAND.blue }} />,
  certification: <Award size={14} style={{ color: BRAND.amber }} />,
  project: <Briefcase size={14} style={{ color: BRAND.accent }} />,
  mentoring: <Users size={14} style={{ color: BRAND.green }} />,
};

function MyPathTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([1]);
  const [updating, setUpdating] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/lip/path');
      if (r.success) setData(r.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const rebuild = async () => {
    setBuilding(true);
    try {
      const r = await apiFetch('/api/lip/path', { method: 'POST', body: JSON.stringify({}) });
      if (r.success) setData(r.data);
    } catch { /* ignore */ }
    setBuilding(false);
  };

  const updateItemStatus = async (itemId: number, status: string) => {
    setUpdating(itemId);
    try {
      await apiFetch(`/api/lip/path/items/${itemId}/status`, {
        method: 'POST', body: JSON.stringify({ status }),
      });
      await load();
    } catch { /* ignore */ }
    setUpdating(null);
  };

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  const path = data?.path;
  const phases: any[] = path?.phases ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4 border" style={{ background: `linear-gradient(135deg, ${BRAND.primary}12, ${BRAND.blue}08)`, borderColor: `${BRAND.primary}20` }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{path?.name ?? 'My Learning Path'}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>⏱ {path?.total_hours_estimated ?? 0}h total</span>
              <span>📅 ~{data?.estimated_weeks ?? 0} weeks</span>
              <span>✅ {path?.progress_pct ?? 0}% done</span>
            </div>
          </div>
          <button onClick={rebuild} disabled={building}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: BRAND.primary }}>
            <RefreshCw size={12} className={building ? 'animate-spin' : ''} />
            {building ? 'Building…' : 'Rebuild'}
          </button>
        </div>
        {/* Overall progress */}
        <div className="mt-3">
          <div className="w-full bg-white/50 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${path?.progress_pct ?? 0}%`, backgroundColor: BRAND.primary }} />
          </div>
        </div>
      </div>

      {data?.__flagOff ? <FeatureDisabled /> : phases.length === 0 ? (
        <EmptyAssessment
          icon={<GraduationCap size={36} />}
          title="No learning path built yet"
          hint='Hit "Rebuild Path" above — the engine picks the right template from your target role and competency gaps. You need at least one gap on file first.'
        />
      ) : (
        phases.map((phase: any) => {
          const isOpen = expanded.includes(phase.phase_num);
          const doneCount = phase.items?.filter((i: any) => i.status === 'completed').length ?? 0;
          return (
            <div key={phase.phase_num} className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
              <button className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setExpanded(e => isOpen ? e.filter(n => n !== phase.phase_num) : [...e, phase.phase_num])}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: BRAND.primary }}>
                    Phase {phase.phase_num}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{phase.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">{doneCount}/{phase.items?.length ?? 0} done</span>
                  {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                </div>
              </button>
              {/* Phase progress bar */}
              <div className="h-1" style={{ backgroundColor: `${BRAND.primary}15` }}>
                <div className="h-1 transition-all" style={{ width: `${phase.items?.length ? (doneCount / phase.items.length) * 100 : 0}%`, backgroundColor: BRAND.primary }} />
              </div>
              {isOpen && (
                <div className="divide-y divide-gray-50">
                  {(phase.items ?? []).map((item: any) => (
                    <div key={item.id ?? `${item.item_type}-${item.item_id}`} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                      <span className="shrink-0">{TYPE_ICONS[item.item_type] ?? <BookOpen size={14} />}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.item_title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                          {item.item_provider && <span>{item.item_provider}</span>}
                          {item.hours > 0 && <span>·</span>}
                          {item.hours > 0 && <span><Clock size={9} className="inline mr-0.5" />{item.hours}h</span>}
                          {item.cost_inr > 0 && <><span>·</span><span>₹{item.cost_inr.toLocaleString()}</span></>}
                          {item.is_required && <><span>·</span><span className="text-red-400">Required</span></>}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        {STATUS_ICONS[item.status ?? 'pending']}
                        <select
                          className="text-[10px] border border-gray-200 rounded-md px-1.5 py-0.5 bg-white text-gray-600 cursor-pointer"
                          value={item.status ?? 'pending'}
                          disabled={updating === item.id}
                          onChange={e => updateItemStatus(item.id, e.target.value)}>
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Done</option>
                          <option value="skipped">Skip</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Resources Sub-tab ──────────────────────────────────────────────────────────
function ResourcesTab() {
  const [activeTab, setActiveTab] = useState<ResourceTab>('courses');
  const [courses, setCourses] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [savedCourses, setSavedCourses] = useState<Set<string>>(new Set());
  const [savedCerts, setSavedCerts] = useState<Set<string>>(new Set());

  const loadTab = useCallback(async (tab: ResourceTab) => {
    setLoading(true);
    try {
      if (tab === 'courses' && courses.length === 0) {
        const r = await apiFetch('/api/lip/courses');
        if (r.success) setCourses(r.data);
      } else if (tab === 'certifications' && certs.length === 0) {
        const r = await apiFetch('/api/lip/certifications');
        if (r.success) setCerts(r.data);
      } else if (tab === 'projects' && projects.length === 0) {
        const r = await apiFetch('/api/lip/projects');
        if (r.success) setProjects(r.data);
      } else if (tab === 'mentors' && mentors.length === 0) {
        const r = await apiFetch('/api/lip/mentors');
        if (r.success) setMentors(r.data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [courses.length, certs.length, projects.length, mentors.length]);

  useEffect(() => { loadTab(activeTab); }, [activeTab, loadTab]);

  const toggleSaveCourse = async (id: string) => {
    try {
      await apiFetch(`/api/lip/courses/${id}/save`, { method: 'POST', body: '{}' });
      setSavedCourses(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    } catch { /* ignore */ }
  };
  const toggleSaveCert = async (id: string) => {
    try {
      await apiFetch(`/api/lip/certifications/${id}/save`, { method: 'POST', body: '{}' });
      setSavedCerts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    } catch { /* ignore */ }
  };

  const TABS: { id: ResourceTab; label: string; icon: React.ReactNode }[] = [
    { id: 'courses', label: 'Courses', icon: <BookOpen size={12} /> },
    { id: 'certifications', label: 'Certifications', icon: <Award size={12} /> },
    { id: 'projects', label: 'Projects', icon: <Briefcase size={12} /> },
    { id: 'mentors', label: 'Mentors', icon: <Users size={12} /> },
  ];

  const filter = (item: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.title || item.name || '').toLowerCase().includes(q) ||
      (item.provider || item.issuing_body || item.company || '').toLowerCase().includes(q);
  };

  return (
    <div className="space-y-4">
      {/* Resource type tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all"
            style={activeTab === t.id ? { backgroundColor: 'white', color: BRAND.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6B7280' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${activeTab}…`}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': BRAND.primary } as any} />
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Courses */}
          {activeTab === 'courses' && (
            <div className="space-y-2">
              {courses.filter(filter).map((c: any) => (
                <div key={c.id} className="rounded-xl border p-3 hover:shadow-sm transition-all" style={{ borderColor: BRAND.border }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">{c.title}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                          {Math.round(c.relevance_score)}% match
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{c.provider} · {c.type?.replace(/_/g, ' ')}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-gray-400">
                        <span><Clock size={9} className="inline mr-0.5" />{c.duration_hours}h</span>
                        <span>⭐ {c.rating}</span>
                        <span style={{ color: c.cost_inr === 0 ? BRAND.green : BRAND.text }}>
                          {c.cost_inr === 0 ? 'Free' : `₹${Number(c.cost_inr).toLocaleString()}`}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full ${c.region === 'IN' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                          {c.region}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => toggleSaveCourse(c.id)}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      {savedCourses.has(c.id)
                        ? <BookmarkCheck size={14} style={{ color: BRAND.primary }} />
                        : <Bookmark size={14} className="text-gray-400" />}
                    </button>
                  </div>
                  <div className="mt-2">
                    <GaugeMini value={c.relevance_score} color={BRAND.primary} />
                  </div>
                </div>
              ))}
              {courses.filter(filter).length === 0 && <p className="text-sm text-center text-gray-400 py-8">No courses match your filter.</p>}
            </div>
          )}

          {/* Certifications */}
          {activeTab === 'certifications' && (
            <div className="space-y-2">
              {certs.filter(filter).map((c: any) => (
                <div key={c.id} className="rounded-xl border p-3 hover:shadow-sm transition-all" style={{ borderColor: BRAND.border }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">{c.title}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${BRAND.amber}15`, color: BRAND.amber }}>
                          ⭐ Prestige {c.prestige_score}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{c.issuing_body} · {c.type}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-gray-400">
                        <span><Clock size={9} className="inline mr-0.5" />{c.prep_hours_estimate}h prep</span>
                        <span style={{ color: c.cost_inr === 0 ? BRAND.green : BRAND.text }}>
                          {c.cost_inr === 0 ? 'Free' : `₹${Number(c.cost_inr).toLocaleString()}`}
                        </span>
                        <span>{c.validity_years ? `Valid ${c.validity_years}y` : 'Lifetime'}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                          {Math.round(c.relevance_score)}% match
                        </span>
                      </div>
                    </div>
                    <button onClick={() => toggleSaveCert(c.id)}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      {savedCerts.has(c.id)
                        ? <BookmarkCheck size={14} style={{ color: BRAND.primary }} />
                        : <Bookmark size={14} className="text-gray-400" />}
                    </button>
                  </div>
                </div>
              ))}
              {certs.filter(filter).length === 0 && <p className="text-sm text-center text-gray-400 py-8">No certifications match your filter.</p>}
            </div>
          )}

          {/* Projects */}
          {activeTab === 'projects' && (
            <div className="space-y-2">
              {projects.filter(filter).map((p: any) => {
                const DIFF_LABELS: Record<number, string> = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Expert' };
                const DIFF_COLORS: Record<number, string> = { 1: BRAND.green, 2: BRAND.blue, 3: BRAND.amber, 4: BRAND.red };
                return (
                  <div key={p.id} className="rounded-xl border p-3 hover:shadow-sm transition-all" style={{ borderColor: BRAND.border }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{p.title}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${DIFF_COLORS[p.difficulty_level]}15`, color: DIFF_COLORS[p.difficulty_level] }}>
                        {DIFF_LABELS[p.difficulty_level] ?? 'Intermediate'}
                      </span>
                    </div>
                    {p.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-gray-400">
                      <span><Clock size={9} className="inline mr-0.5" />{p.duration_hours}h</span>
                      <span>📦 {p.deliverable?.replace(/_/g, ' ')}</span>
                      <span>👥 {p.solo_or_team}</span>
                      <span>📁 {p.type?.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                        {Math.round(p.relevance_score)}% match
                      </span>
                    </div>
                  </div>
                );
              })}
              {projects.filter(filter).length === 0 && <p className="text-sm text-center text-gray-400 py-8">No projects match your filter.</p>}
            </div>
          )}

          {/* Mentors */}
          {activeTab === 'mentors' && (
            <div className="space-y-2">
              {mentors.filter(filter).map((m: any) => (
                <div key={m.id} className="rounded-xl border p-3 hover:shadow-sm transition-all" style={{ borderColor: BRAND.border }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: BRAND.primary }}>
                      {m.name?.charAt(0) ?? 'M'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                        {m.is_verified && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">✓ Verified</span>}
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                          {Math.round(m.match_score)}% match
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{m.title}{m.company ? ` · ${m.company}` : ''}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-gray-400">
                        <span>⭐ {m.rating}</span>
                        <span>🎯 {m.mentoring_style}</span>
                        <span>⏰ {m.availability_hrs_month}h/mo</span>
                        <span style={{ color: m.cost_model === 'free' ? BRAND.green : BRAND.text }}>
                          {m.cost_model === 'free' ? 'Free' : `₹${Number(m.cost_per_hour_inr).toLocaleString()}/h`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {mentors.filter(filter).length === 0 && <p className="text-sm text-center text-gray-400 py-8">No mentors match your filter.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Learning Needs Sub-tab ─────────────────────────────────────────────────────

const URGENCY_META: Record<string, { label: string; color: string; bg: string }> = {
  immediate:    { label: 'Immediate',    color: BRAND.red,   bg: '#FEF2F2' },
  near_term:    { label: 'Near-Term',    color: BRAND.amber, bg: '#FFFBEB' },
  aspirational: { label: 'Aspirational', color: BRAND.blue,  bg: '#EFF6FF' },
};

const CAT_LABELS: Record<string, string> = {
  technical_upskill: 'Technical Upskill',
  soft_skill:        'Soft Skills',
  leadership:        'Leadership',
  domain_knowledge:  'Domain Knowledge',
  certification:     'Certification',
  applied_practice:  'Applied Practice',
};

const CAT_COLOR: Record<string, string> = {
  technical_upskill: BRAND.primary,
  soft_skill:        BRAND.accent,
  leadership:        BRAND.blue,
  domain_knowledge:  BRAND.green,
  certification:     BRAND.amber,
  applied_practice:  '#8B5CF6',
};

function NeedsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await apiFetch(`/api/lip/learning-needs${refresh ? '?refresh=1' : ''}`);
      if (r.success) setData(r.data);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  const needs: any[] = data?.needs ?? [];
  const immediate    = needs.filter(n => n.urgency === 'immediate');
  const nearTerm     = needs.filter(n => n.urgency === 'near_term');
  const aspirational = needs.filter(n => n.urgency === 'aspirational');

  const NeedCard = ({ need }: { need: any }) => {
    const meta  = URGENCY_META[need.urgency] ?? URGENCY_META.near_term;
    const color = CAT_COLOR[need.need_category] ?? BRAND.primary;
    const pct   = Math.min(100, Math.round((need.priority_score ?? 0) * 10));
    const sources: string[] = (() => {
      try { return JSON.parse(need.signal_sources ?? '[]'); } catch { return []; }
    })();
    return (
      <div className="rounded-xl border p-3.5 hover:shadow-sm transition-all" style={{ borderColor: BRAND.border }}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-800">
                {CAT_LABELS[need.need_category] ?? need.need_category}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
            </div>
            {need.description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{need.description}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-bold" style={{ color }}>{pct}%</p>
            <p className="text-[10px] text-gray-400">priority</p>
          </div>
        </div>

        <div className="mt-2.5">
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>

        {sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {sources.slice(0, 4).map((src: string, i: number) => (
              <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                {src.replace(/_/g, ' ')}
              </span>
            ))}
            {sources.length > 4 && (
              <span className="text-[9px] text-gray-400">+{sources.length - 4} more</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const Section = ({ title, items, color }: { title: string; items: any[]; color: string }) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{title}</h4>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{items.length}</span>
        </div>
        <div className="space-y-2">
          {items.map((n: any) => <NeedCard key={n.id ?? n.need_category} need={n} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Immediate', count: immediate.length, color: BRAND.red, bg: '#FEF2F2' },
          { label: 'Near-Term', count: nearTerm.length, color: BRAND.amber, bg: '#FFFBEB' },
          { label: 'Aspirational', count: aspirational.length, color: BRAND.blue, bg: '#EFF6FF' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: s.bg, borderColor: `${s.color}30` }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.count}</p>
            <p className="text-[10px] font-medium text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {data?.__flagOff ? <FeatureDisabled /> : needs.length === 0 ? (
        <EmptyAssessment
          icon={<Brain size={36} />}
          title="No learning needs detected yet"
          hint="Needs are inferred from 5 signal sources — competency gaps, behavioural patterns, career goals, market demand, and self-reported interests. Complete your assessments to populate them."
        />
      ) : (
        <>
          <Section title="Immediate" items={immediate} color={BRAND.red} />
          <Section title="Near-Term" items={nearTerm} color={BRAND.amber} />
          <Section title="Aspirational" items={aspirational} color={BRAND.blue} />
        </>
      )}

      <button onClick={() => load(true)} disabled={refreshing}
        className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl border transition-all disabled:opacity-50"
        style={{ borderColor: BRAND.primary, color: BRAND.primary }}>
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Refreshing…' : 'Re-analyse Needs'}
      </button>
    </div>
  );
}

// ── Report Sub-tab ─────────────────────────────────────────────────────────────

function ReportTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await apiFetch('/api/lip/report');
      if (r.success) setData(r.data);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const readiness   = data?.readiness_summary ?? {};
  const gaps        = data?.competency_gap_profile ?? {};
  const needs       = data?.learning_needs_analysis ?? {};
  const path        = data?.recommended_learning_path ?? null;
  const resources   = data?.resource_highlights ?? {};
  const BAND_COLORS: Record<string, string> = { low: BRAND.red, moderate: BRAND.amber, good: BRAND.blue, high: BRAND.green };
  const band        = readiness.band ?? 'moderate';
  const bandColor   = BAND_COLORS[band] ?? BRAND.primary;

  return (
    <div className="space-y-4">
      {/* Generated at */}
      {data?.generated_at && (
        <p className="text-[10px] text-gray-400 text-right">
          Generated {new Date(data.generated_at).toLocaleString()}
        </p>
      )}

      {/* Readiness + Gaps summary row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-4" style={{ borderColor: `${bandColor}30`, backgroundColor: `${bandColor}08` }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Learning Readiness</p>
          <p className="text-3xl font-bold" style={{ color: bandColor }}>{Math.round(readiness.composite ?? 0)}</p>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize mt-1 inline-block"
            style={{ backgroundColor: `${bandColor}20`, color: bandColor }}>
            {band}
          </span>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Competency Coverage</p>
          <p className="text-3xl font-bold text-gray-800">{gaps.overall_coverage_pct ?? 0}%</p>
          <div className="flex gap-2 mt-1">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">
              {gaps.critical_gaps ?? 0} critical
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#FFF5F5', color: BRAND.accent }}>
              {gaps.major_gaps ?? 0} major
            </span>
          </div>
        </div>
      </div>

      {/* Top needs */}
      {(needs.top_needs ?? []).length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Lightbulb size={14} style={{ color: BRAND.amber }} /> Top Learning Needs
            {needs.immediate_count > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 ml-auto">
                {needs.immediate_count} immediate
              </span>
            )}
          </h4>
          <div className="space-y-2">
            {needs.top_needs.slice(0, 4).map((n: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-300 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700">{CAT_LABELS[n.need_category] ?? n.need_category}</p>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: (URGENCY_META[n.urgency] ?? URGENCY_META.near_term).bg, color: (URGENCY_META[n.urgency] ?? URGENCY_META.near_term).color }}>
                  {(URGENCY_META[n.urgency] ?? URGENCY_META.near_term).label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning path summary */}
      {path && (
        <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <TrendingUp size={14} style={{ color: BRAND.primary }} /> {path.name}
          </h4>
          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap mb-3">
            <span><Clock size={10} className="inline mr-1" />{path.total_hours}h total</span>
            <span>~{path.estimated_weeks}w plan</span>
            <span>{Math.round(path.progress_pct ?? 0)}% done</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all" style={{ width: `${path.progress_pct ?? 0}%`, backgroundColor: BRAND.primary }} />
          </div>
        </div>
      )}

      {/* Resource highlights */}
      {((resources.top_courses ?? []).length > 0 || (resources.top_certs ?? []).length > 0) && (
        <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <BookOpen size={14} style={{ color: BRAND.blue }} /> Top Recommended Resources
          </h4>
          <div className="space-y-2">
            {(resources.top_courses ?? []).slice(0, 2).map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 shrink-0">Course</span>
                <span className="text-xs text-gray-700 truncate flex-1">{c.title}</span>
                <span className="text-[10px] text-gray-400 shrink-0">{Math.round(c.relevance_score)}%</span>
              </div>
            ))}
            {(resources.top_certs ?? []).slice(0, 1).map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 shrink-0">Cert</span>
                <span className="text-xs text-gray-700 truncate flex-1">{c.title}</span>
                <span className="text-[10px] text-gray-400 shrink-0">{Math.round(c.relevance_score)}%</span>
              </div>
            ))}
            {(resources.top_mentors ?? []).slice(0, 1).map((m: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-600 shrink-0">Mentor</span>
                <span className="text-xs text-gray-700 truncate flex-1">{m.name}</span>
                <span className="text-[10px] text-gray-400 shrink-0">{Math.round(m.match_score)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => load(true)} disabled={refreshing}
        className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl border transition-all disabled:opacity-50"
        style={{ borderColor: BRAND.primary, color: BRAND.primary }}>
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Regenerating…' : 'Regenerate Report'}
      </button>
    </div>
  );
}

// ── Readiness Sub-tab ──────────────────────────────────────────────────────────
function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#E5E7EB" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{Math.round(pct)}</text>
      </svg>
      <p className="text-[10px] font-medium text-gray-500 text-center leading-tight">{label}</p>
    </div>
  );
}

const BAND_COLORS: Record<string, string> = {
  low: BRAND.red, moderate: BRAND.amber, good: BRAND.blue, high: BRAND.green,
};

function ReadinessTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(!refresh);
    setRefreshing(refresh);
    try {
      const r = await apiFetch(`/api/lip/readiness${refresh ? '?refresh=1' : ''}`);
      if (r.success) setData(r.data);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const signals = data?.signals ?? {};
  const composite = data?.composite ?? 50;
  const band = data?.band ?? 'moderate';
  const blockers: string[] = data?.blockers ?? [];

  return (
    <div className="space-y-5">
      {/* Composite */}
      <div className="rounded-2xl p-5 text-center border" style={{ background: `linear-gradient(135deg, ${BAND_COLORS[band]}10, ${BAND_COLORS[band]}05)`, borderColor: `${BAND_COLORS[band]}30` }}>
        <Gauge value={composite} label="Learning Readiness" color={BAND_COLORS[band]} />
        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: `${BAND_COLORS[band]}20`, color: BAND_COLORS[band] }}>
            <Activity size={12} /> {band.charAt(0).toUpperCase() + band.slice(1)} Readiness
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Confidence: {Math.round((data?.confidence ?? 0.3) * 100)}% · Updated just now
        </p>
      </div>

      {/* 5 signal gauges */}
      <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Signal Breakdown</h4>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          <Gauge value={signals.motivation ?? 50} label="Motivation" color={BRAND.primary} />
          <Gauge value={signals.cognitive_readiness ?? 50} label="Cognitive" color={BRAND.blue} />
          <Gauge value={signals.time_availability ?? 50} label="Time" color={BRAND.green} />
          <Gauge value={signals.support_network ?? 25} label="Support" color={BRAND.amber} />
          <Gauge value={signals.prior_learning ?? 10} label="Prior Learning" color={BRAND.accent} />
        </div>
      </div>

      {/* Blockers */}
      {blockers.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: `${BRAND.amber}30`, backgroundColor: '#FFFBEB' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: BRAND.amber }} />
            <h4 className="text-sm font-semibold" style={{ color: BRAND.amber }}>Blockers to address</h4>
          </div>
          <ul className="space-y-1.5">
            {blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-amber-400 mt-0.5 shrink-0">▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Refresh */}
      <button onClick={() => load(true)} disabled={refreshing}
        className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl border transition-all disabled:opacity-50"
        style={{ borderColor: BRAND.primary, color: BRAND.primary }}>
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Refreshing…' : 'Refresh Readiness'}
      </button>
    </div>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────
export default function LearningIntelligenceTab({ userId }: { userId?: number }) {
  const [activeTab, setActiveTab] = useState<SubTab>('gap-map');

  const TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'gap-map',   label: 'Gap Map',   icon: <Target size={13} /> },
    { id: 'my-path',   label: 'My Path',   icon: <TrendingUp size={13} /> },
    { id: 'resources', label: 'Resources', icon: <BookOpen size={13} /> },
    { id: 'needs',     label: 'Needs',     icon: <Lightbulb size={13} /> },
    { id: 'report',    label: 'Report',    icon: <FileText size={13} /> },
    { id: 'readiness', label: 'Readiness', icon: <Zap size={13} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap size={18} style={{ color: BRAND.primary }} />
            <h1 className="text-xl font-bold text-gray-900">Learning Intelligence</h1>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Competency gaps · learning needs · path builder · readiness score</p>
        </div>
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-0.5 p-1 bg-gray-100 rounded-xl overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-1 min-w-0"
            style={activeTab === t.id ? { backgroundColor: 'white', color: BRAND.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6B7280' }}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'gap-map'   && <GapMapTab />}
      {activeTab === 'my-path'   && <MyPathTab />}
      {activeTab === 'resources' && <ResourcesTab />}
      {activeTab === 'needs'     && <NeedsTab />}
      {activeTab === 'report'    && <ReportTab />}
      {activeTab === 'readiness' && <ReadinessTab />}
    </div>
  );
}
