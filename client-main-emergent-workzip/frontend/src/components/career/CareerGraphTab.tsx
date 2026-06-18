import React, { useState, useEffect, useCallback } from 'react';
import {
  Network, BarChart3, Target, ChevronRight, AlertCircle, Loader2,
  TrendingUp, BookOpen, Clock, Zap, Layers, FileText,
} from 'lucide-react';

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface CgRole {
  id: number;
  role_key: string;
  title: string;
  seniority: string;
  function_area: string | null;
  demand_score: number;
  automation_risk: number;
}

interface Neighbour {
  role: CgRole;
  edge_type: string;
  avg_months_transition: number;
  transition_probability: number;
  direction: 'forward' | 'backward';
}

interface SkillGap {
  skill_key: string;
  skill_label: string;
  user_proficiency: number;
  required_proficiency: number;
  gap_delta: number;
  importance: string;
  gap_severity: 'critical' | 'moderate' | 'minor' | 'met';
}

interface GapResult {
  role_title: string;
  weighted_gap_score: number;
  gaps: SkillGap[];
  confidence: number;
  degraded: boolean;
}

interface ReadinessResult {
  readiness_score: number;
  readiness_band: 'not_ready' | 'developing' | 'approaching' | 'ready' | 'overqualified';
  confidence: number;
  eta_months: number | null;
  components: {
    skill_score:      number | null;
    experience_score: number | null;
    behaviour_score:  number | null;
    credential_score: number | null;
    market_score:     number | null;
  };
  top_blockers: Array<{ label: string; pts_gain: number }>;
}

interface LearningRec {
  resource: {
    id: number; title: string; resource_type: string;
    provider: string | null; url: string | null;
    duration_hours: number | null; cost_band: string; difficulty: string;
  };
  skill_key: string; skill_label: string; relevance_score: number;
}

type SubTab = 'map' | 'skill-gap' | 'readiness';

const BAND_COLORS: Record<string, string> = {
  overqualified: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  ready:         'text-emerald-600 bg-emerald-50 border-emerald-200',
  approaching:   'text-blue-600 bg-blue-50 border-blue-200',
  developing:    'text-amber-600 bg-amber-50 border-amber-200',
  not_ready:     'text-rose-600 bg-rose-50 border-rose-200',
};
const SIG_LABELS: Record<string, string> = {
  skill_score:      'Skill coverage',
  experience_score: 'Experience fit',
  behaviour_score:  'Behavioural',
  credential_score: 'Credentials',
  market_score:     'Market demand',
};
const SIG_WEIGHTS: Record<string, number> = {
  skill_score: 40, experience_score: 25, behaviour_score: 20, credential_score: 10, market_score: 5,
};

function ScoreBar({ label, value, weight, max = 100 }: { label: string; value: number | null; weight: number; max?: number }) {
  if (value === null) return null;
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="text-slate-400">{weight}% weight · <strong className="text-slate-700">{Math.round(value)}</strong></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const EDGE_SVG_COLORS: Record<string, string> = {
  promotion:  '#10b981',
  lateral:    '#6366f1',
  stretch:    '#a855f7',
  pivot:      '#f59e0b',
  transfer:   '#64748b',
};

function MapSubTab({ neighbours, onSelectTarget, selectedId, currentRoleTitle }: {
  neighbours: Neighbour[];
  onSelectTarget: (n: Neighbour) => void;
  selectedId: number | null;
  currentRoleTitle?: string;
}) {
  const [filter, setFilter] = useState<'all' | 'forward' | 'backward'>('forward');
  const [hovered, setHovered] = useState<Neighbour | null>(null);
  const visible = neighbours.filter(n => filter === 'all' || n.direction === filter);

  const W = 560, H = 400, CX = W / 2, CY = H / 2 - 10, R = 155, NR = 32;
  const centerLabel = currentRoleTitle ?? 'You';
  const shortLabel = (s: string, max = 13) => s.length > max ? s.slice(0, max - 1) + '…' : s;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network size={14} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Career map</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{visible.length}</span>
        </div>
        <div className="flex gap-1">
          {(['forward', 'backward', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full transition-all ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f === 'forward' ? 'Moves up' : f === 'backward' ? 'Comes from' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">No connected roles for your current position.</div>
      ) : (
        <div className="relative rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white overflow-hidden select-none">
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
            <defs>
              <filter id="shadow-node" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Edge lines */}
            {visible.map((nb, i) => {
              const angle = (2 * Math.PI * i) / visible.length - Math.PI / 2;
              const nx = CX + R * Math.cos(angle), ny = CY + R * Math.sin(angle);
              const color = EDGE_SVG_COLORS[nb.edge_type] ?? '#94a3b8';
              const dim = !!(selectedId && selectedId !== nb.role.id);
              return (
                <line key={nb.role.id} x1={CX} y1={CY} x2={nx} y2={ny}
                  stroke={color} strokeWidth="1.8"
                  strokeDasharray={nb.direction === 'backward' ? '6 3' : undefined}
                  opacity={dim ? 0.18 : 0.55} />
              );
            })}

            {/* Center node */}
            <circle cx={CX} cy={CY} r={40} fill="#4f46e5" filter="url(#shadow-node)" />
            <circle cx={CX} cy={CY} r={40} fill="none" stroke="#818cf8" strokeWidth="1.5" />
            <text x={CX} y={CY - 6} textAnchor="middle" fill="white" fontSize="9.5" fontWeight="600">You</text>
            <text x={CX} y={CY + 8} textAnchor="middle" fill="#c7d2fe" fontSize="8">
              {shortLabel(centerLabel, 15)}
            </text>

            {/* Adjacent role nodes */}
            {visible.map((nb, i) => {
              const angle = (2 * Math.PI * i) / visible.length - Math.PI / 2;
              const nx = CX + R * Math.cos(angle), ny = CY + R * Math.sin(angle);
              const color = EDGE_SVG_COLORS[nb.edge_type] ?? '#94a3b8';
              const isSelected = selectedId === nb.role.id;
              const dim = !!(selectedId && !isSelected);
              return (
                <g key={nb.role.id}
                  onClick={() => onSelectTarget(nb)}
                  onMouseEnter={() => setHovered(nb)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                  opacity={dim ? 0.4 : 1}>
                  {isSelected && <circle cx={nx} cy={ny} r={NR + 7} fill="none" stroke="#4f46e5" strokeWidth="2" opacity={0.45} />}
                  <circle cx={nx} cy={ny} r={NR} fill="white" stroke={color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    filter={isSelected ? 'url(#shadow-node)' : undefined} />
                  {/* Edge-type accent dot */}
                  <circle cx={nx} cy={ny - NR + 7} r={5} fill={color} />
                  <text x={nx} y={ny - 3} textAnchor="middle" fill="#1e293b" fontSize="8.5" fontWeight="500">
                    {shortLabel(nb.role.title)}
                  </text>
                  <text x={nx} y={ny + 10} textAnchor="middle" fill="#64748b" fontSize="8">
                    {Math.round(nb.transition_probability * 100)}%
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover tooltip */}
          {hovered && (
            <div className="absolute bottom-3 left-3 right-3 pointer-events-none z-10 flex justify-center">
              <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 shadow-lg max-w-sm w-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{hovered.role.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{hovered.role.seniority}{hovered.role.function_area ? ` · ${hovered.role.function_area}` : ''}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 capitalize"
                    style={{ backgroundColor: (EDGE_SVG_COLORS[hovered.edge_type] ?? '#94a3b8') + '18', color: EDGE_SVG_COLORS[hovered.edge_type] ?? '#64748b', borderColor: (EDGE_SVG_COLORS[hovered.edge_type] ?? '#94a3b8') + '40' }}>
                    {hovered.edge_type}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Clock size={10} />~{hovered.avg_months_transition}mo</span>
                  <span>{Math.round(hovered.transition_probability * 100)}% probability</span>
                  <span>Demand {hovered.role.demand_score}/100</span>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 bg-white/80 rounded-lg px-2 py-2 backdrop-blur-sm">
            {Object.entries({ promotion: '#10b981', lateral: '#6366f1', stretch: '#a855f7', pivot: '#f59e0b' }).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-slate-500 capitalize leading-none">{type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillGapSubTab({ roleId, roleTitle }: { roleId: number; roleTitle: string }) {
  const [data, setData] = useState<GapResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/career/skill-gap/${roleId}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roleId]);

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <Loader2 size={18} className="animate-spin mr-2" /> Analysing skill gaps…
    </div>
  );
  if (!data) return <div className="text-center py-8 text-slate-400 text-sm">Could not load skill gap data.</div>;

  const topGaps = data.gaps.filter(g => g.gap_severity !== 'met').slice(0, 10);
  const maxGap = Math.max(...topGaps.map(g => g.required_proficiency), 5);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Target role</p>
          <p className="font-semibold text-slate-800">{roleTitle}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-800">{Math.round(data.weighted_gap_score)}</p>
          <p className="text-xs text-slate-400">gap score (lower = closer)</p>
        </div>
      </div>

      {topGaps.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">No skill requirements mapped for this role yet.</div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-500">Top skill gaps (current vs required)</p>
          {topGaps.map(g => {
            const curPct = (g.user_proficiency / maxGap) * 100;
            const reqPct = (g.required_proficiency / maxGap) * 100;
            const sevColor = g.gap_severity === 'critical' ? 'bg-rose-500' : g.gap_severity === 'moderate' ? 'bg-amber-400' : 'bg-slate-300';
            return (
              <div key={g.skill_key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <span className={`w-2 h-2 rounded-full ${sevColor}`} />
                    {g.skill_label}
                  </span>
                  <span className="text-slate-400">{g.user_proficiency} / {g.required_proficiency}</span>
                </div>
                <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-indigo-200 rounded-full transition-all"
                    style={{ width: `${reqPct}%` }}
                  />
                  <div
                    className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${curPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.degraded && (
        <p className="text-xs text-slate-400">Confidence {Math.round(data.confidence * 100)}% — limited profile data</p>
      )}
    </div>
  );
}

function ReadinessSubTab({ roleId, roleTitle }: { roleId: number; roleTitle: string }) {
  const [data, setData] = useState<ReadinessResult | null>(null);
  const [learningRecs, setLearningRecs] = useState<LearningRec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/career/readiness/${roleId}`, { headers: authHeader() }).then(r => r.json()),
      fetch(`/api/career/learning/${roleId}`, { headers: authHeader() }).then(r => r.json()),
    ])
      .then(([rd, ld]) => {
        if (rd.ok) setData(rd.readiness);
        if (ld.ok) setLearningRecs((ld.recommendations ?? []).slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roleId]);

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <Loader2 size={18} className="animate-spin mr-2" /> Computing readiness…
    </div>
  );
  if (!data) return <div className="text-center py-8 text-slate-400 text-sm">Could not load readiness data.</div>;

  const bandClass = BAND_COLORS[data.readiness_band] ?? BAND_COLORS.developing;
  const pct = Math.round(data.readiness_score);

  return (
    <div className="space-y-5">
      {/* Gauge */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Readiness for</p>
          <p className="font-semibold text-slate-800">{roleTitle}</p>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Overall score</span><span className="font-semibold text-slate-700">{pct} / 100</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  pct >= 70 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  : pct >= 45 ? 'bg-gradient-to-r from-blue-400 to-indigo-500'
                  : 'bg-gradient-to-r from-amber-400 to-rose-400'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-slate-800">{pct}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${bandClass}`}>
            {data.readiness_band.replace('_', ' ')}
          </span>
          {data.eta_months !== null && (
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-end gap-1">
              <Clock size={10} />~{data.eta_months}mo to ready
            </p>
          )}
        </div>
      </div>

      {/* 5-signal breakdown */}
      <div className="space-y-2.5 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Signal breakdown</p>
        {Object.entries(data.components).map(([key, val]) =>
          <ScoreBar
            key={key}
            label={SIG_LABELS[key] ?? key}
            value={val}
            weight={SIG_WEIGHTS[key] ?? 0}
          />
        )}
      </div>

      {/* Top blockers */}
      {(data.top_blockers?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Top blockers</p>
          {data.top_blockers.slice(0, 3).map((b, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-xs text-amber-800">{b.label}</p>
              <span className="text-xs font-semibold text-emerald-600 shrink-0">+{b.pts_gain} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* Top 3 learning recs */}
      {learningRecs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen size={13} className="text-slate-500" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Top learning resources</p>
          </div>
          {learningRecs.map(lr => (
            <div key={lr.resource.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{lr.resource.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lr.resource.provider ?? lr.resource.resource_type}
                  {lr.resource.duration_hours ? ` · ${lr.resource.duration_hours}h` : ''}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                lr.resource.cost_band === 'free' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {lr.resource.cost_band}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">Confidence {Math.round(data.confidence * 100)}%</p>
    </div>
  );
}

export default function CareerGraphTab({ userId }: { userId: string }) {
  const [subTab, setSubTab] = useState<SubTab>('map');
  const [neighbours, setNeighbours] = useState<Neighbour[]>([]);
  const [currentRole, setCurrentRole] = useState<CgRole | null>(null);
  const [selectedNeighbour, setSelectedNeighbour] = useState<Neighbour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Resolve current role server-side (saved path → profile title → demand anchor)
      const crRes = await fetch('/api/career/current-role', { headers: authHeader() })
        .then(r => r.json()).catch(() => ({ ok: false }));
      if (crRes.ok) {
        setCurrentRole(crRes.current_role ?? null);
        setNeighbours(crRes.neighbours ?? []);
      } else {
        setError('Could not load career graph');
      }
    } catch {
      setError('Could not load career graph');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <Loader2 size={24} className="animate-spin mb-3" />
      <p className="text-sm">Loading your career graph…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64">
      <AlertCircle size={24} className="text-amber-500 mb-3" />
      <p className="text-sm text-slate-600">{error}</p>
      <button onClick={load} className="mt-3 text-xs text-indigo-600 hover:underline">Try again</button>
    </div>
  );

  const SUB_TABS: Array<{ id: SubTab; label: string; Icon: React.ElementType; disabled?: boolean }> = [
    { id: 'map',       label: 'Map',       Icon: Network },
    { id: 'skill-gap', label: 'Skill Gap', Icon: BarChart3, disabled: !selectedNeighbour },
    { id: 'readiness', label: 'Readiness', Icon: Target,    disabled: !selectedNeighbour },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg"><Network size={20} className="text-indigo-600" /></div>
          <div>
            <h2 className="font-semibold text-slate-800 text-lg">Career Graph</h2>
            <p className="text-xs text-slate-500">Transitions · skill gaps · readiness scoring</p>
          </div>
        </div>
        <a
          href="/api/career/report"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shrink-0"
        >
          <FileText size={13} /> Career Report
        </a>
      </div>

      {/* Current role badge */}
      {currentRole ? (
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl border border-indigo-100">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={13} className="text-indigo-500" />
            <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Current role</span>
          </div>
          <p className="text-xl font-bold text-slate-800">{currentRole.title}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {currentRole.seniority}
            {currentRole.function_area ? ` · ${currentRole.function_area}` : ''}
          </p>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-sm text-slate-400">No current role in your profile — showing sample graph</p>
        </div>
      )}

      {selectedNeighbour && (
        <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
          <Target size={13} className="text-indigo-600 shrink-0" />
          <span className="text-indigo-800">
            Target: <strong>{selectedNeighbour.role.title}</strong>
          </span>
          <button
            onClick={() => { setSelectedNeighbour(null); setSubTab('map'); }}
            className="ml-auto text-xs text-indigo-400 hover:text-indigo-600"
          >
            Clear
          </button>
        </div>
      )}

      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {SUB_TABS.map(({ id, label, Icon, disabled }) => (
          <button
            key={id}
            onClick={() => !disabled && setSubTab(id)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              subTab === id
                ? 'bg-white text-slate-800 shadow-sm'
                : disabled
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />{label}
            {disabled && <span className="text-xs text-slate-300">(select role)</span>}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div>
        {subTab === 'map' && (
          <MapSubTab
            neighbours={neighbours}
            onSelectTarget={nb => { setSelectedNeighbour(nb); setSubTab('skill-gap'); }}
            selectedId={selectedNeighbour?.role.id ?? null}
            currentRoleTitle={currentRole?.title}
          />
        )}
        {subTab === 'skill-gap' && selectedNeighbour && (
          <SkillGapSubTab roleId={selectedNeighbour.role.id} roleTitle={selectedNeighbour.role.title} />
        )}
        {subTab === 'readiness' && selectedNeighbour && (
          <ReadinessSubTab roleId={selectedNeighbour.role.id} roleTitle={selectedNeighbour.role.title} />
        )}
      </div>
    </div>
  );
}
