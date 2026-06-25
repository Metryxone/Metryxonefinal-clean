import { BRAND } from '@/design-system/tokens';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Network, Brain, BarChart3, Users, Layers, ArrowRight,
  RefreshCw, Play, AlertCircle, CheckCircle2, TrendingUp,
  Star, Zap, Target, GitBranch, Clock, ChevronDown, ChevronUp
} from 'lucide-react';



const CLUSTER_COLORS: Record<string, string> = {
  'high-impact':     '#344E86',
  'growth-ready':    '#4ECDC4',
  'emerging-talent': '#f4a261',
};

type TIGTab = 'overview' | 'intelligence' | 'clusters' | 'mobility' | 'graph';

interface Stats {
  totalNodes: number; totalEdges: number;
  nodesByType: Record<string, number>; edgesByType: Record<string, number>;
  intelligenceSnapshots: number; clusterCount: number;
  lastBuild: { status: string; nodesBuilt: number; edgesBuilt: number; durationMs: number; createdAt: string; error?: string } | null;
}
interface IntelRecord {
  candidateId: string; name: string; email: string; stage: string;
  readinessIndex: number; growthPotential: number; hiddenTalentScore: number;
  mobilityTargets: { roleId: string; roleTitle: string; probability: number; calibratedProbability?: number }[];
  clusterId: string; clusterName: string; similarCandidates: string[];
}
interface Cluster {
  clusterId: string; clusterName: string; color: string;
  memberIds: string[]; size: number; avgReadiness: number; avgGrowth: number;
  traits: { topSkills?: string[] };
}
interface GraphNode { id: string; entityType: string; label: string; metadata: Record<string, any>; }
interface GraphEdge { id: string; fromNodeId: string; toNodeId: string; edgeType: string; weight: number; }
interface CalibrationBand {
  bandId: string; min: number; max: number; sampleSize: number; positives: number;
  observedRate: number | null; calibratedRate: number | null;
  meanPredicted?: number | null; priorSource?: 'global_pooled' | 'uninformative' | string;
}
interface Readiness {
  structuralReadiness: number; activationReadiness: number; gap: string | null;
  calibration?: {
    status: 'calibrated' | 'provisional' | 'cold_start'; totalOutcomes: number; bands: CalibrationBand[];
    method?: 'identity' | 'binned' | 'isotonic' | string;
    brier?: number | null; ece?: number | null; usingGlobalPrior?: boolean;
  };
  data: { nodes: number; edges: number; intelligenceSnapshots: number; clusters: number };
  checks: { id: string; label: string; pass: boolean }[];
  lastBuiltAt?: string | null;
}

function pct(n: number): string { return n + '%'; }
function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}

function ScoreBar({ value, color, label }: { value: number; color: string; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[10px] text-gray-400 w-16 shrink-0">{label}</span>}
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: pct(Math.min(100, value)), background: color }} />
      </div>
      <span className="text-[11px] font-bold w-6 text-right" style={{ color }}>{Math.round(value)}</span>
    </div>
  );
}

function ClusterBadge({ clusterId, clusterName }: { clusterId: string; clusterName: string }) {
  const color = CLUSTER_COLORS[clusterId] ?? '#64748b';
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: color + '18', color }}>
      {clusterName}
    </span>
  );
}

function ReadinessGauge({ value, label, size = 80 }: { value: number; label: string; size?: number }) {
  const r  = (size / 2) - 8;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const color = value >= 90 ? BRAND.green : value >= 70 ? BRAND.orange : BRAND.red;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${(value / 100) * circ} ${circ}`}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={size * 0.22} fontWeight="700" fill={color}>{value}</text>
      </svg>
      <span className="text-[10px] font-semibold mt-0.5 text-gray-500">{label}</span>
    </div>
  );
}

// ── GRAPH VISUALIZATION ──────────────────────────────────────────────────────

const ENTITY_COLORS: Record<string, string> = {
  candidate:     '#344E86',
  role:          '#8b5cf6',
  competency:    '#4ECDC4',
  signal:        '#2A9D8F',
  behavior:      '#f4a261',
  career_path:   '#e63946',
  learning_path: '#ec4899',
  manager:       '#64748b',
  organization:  '#1e3a5f',
};

function TIGGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const W = 720, H = 450;

  const CLUSTER_POS: Record<string, [number, number]> = {
    'high-impact':     [128, 105],
    'growth-ready':    [128, 310],
    'emerging-talent': [318, 208],
  };
  const CLUSTER_R = 74;

  const candidates   = nodes.filter(n => n.entityType === 'candidate');
  const roles        = nodes.filter(n => n.entityType === 'role').slice(0, 7);
  const competencies = nodes.filter(n => n.entityType === 'competency').slice(0, 8);
  const managers     = nodes.filter(n => n.entityType === 'manager').slice(0, 4);
  const orgNode      = nodes.find(n => n.entityType === 'organization');

  const CAND_OFFSETS = [
    [0, 0], [-26, -20], [26, -20], [-26, 20], [26, 20], [0, -38], [-38, 0], [38, 0],
  ] as [number, number][];

  const candPositions: Record<string, [number, number]> = {};
  const clusterGroups: Record<string, GraphNode[]> = {};
  for (const c of candidates) {
    const cid = (c.metadata?.clusterId as string) ?? 'emerging-talent';
    (clusterGroups[cid] ??= []).push(c);
  }
  for (const [cid, members] of Object.entries(clusterGroups)) {
    const [cx, cy] = CLUSTER_POS[cid] ?? [350, 200];
    members.slice(0, 8).forEach((c, i) => {
      const [dx, dy] = CAND_OFFSETS[i] ?? [0, 0];
      candPositions[c.id] = [cx + dx, cy + dy];
    });
  }

  const rolePositions: Record<string, [number, number]> = {};
  roles.forEach((r, i) => { rolePositions[r.id] = [548, 58 + i * 53]; });

  const compPositions: Record<string, [number, number]> = {};
  competencies.forEach((c, i) => { compPositions[c.id] = [470, 52 + i * 46]; });

  const orgPos: [number, number] = [648, 215];
  const orgPositions: Record<string, [number, number]> = {};
  if (orgNode) orgPositions[orgNode.id] = orgPos;

  const managerPositions: Record<string, [number, number]> = {};
  managers.forEach((m, i) => { managerPositions[m.id] = [478 + (i % 2) * 70, 406 + Math.floor(i / 2) * 28]; });

  const allPositions: Record<string, [number, number]> = {
    ...candPositions, ...rolePositions, ...compPositions, ...orgPositions, ...managerPositions,
  };

  const visEdges = edges.filter(e => allPositions[e.fromNodeId] && allPositions[e.toNodeId]).slice(0, 120);

  const edgeColor = (et: string) => ({
    fits_role:           '#8b5cf660',
    has_competency:      '#4ECDC455',
    requires_competency: '#4ECDC428',
    similar_to:          '#cbd5e180',
    enrolled_in:         '#ec489938',
    on_career_path:      '#e6394638',
    manages:             '#64748b48',
    belongs_to:          '#1e3a5f28',
    exhibits:            '#2A9D8F35',
    skill_gap:           '#ef444438',
    feeder_role:         '#8b5cf635',
  })[et] ?? '#e2e8f028';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-gray-100" style={{ background: '#f8fafc', maxHeight: 450 }}>
      {/* Cluster bubbles */}
      {Object.entries(CLUSTER_POS).map(([cid, [cx, cy]]) => (
        <g key={cid}>
          <circle cx={cx} cy={cy} r={CLUSTER_R}
            fill={CLUSTER_COLORS[cid] + '0d'} stroke={CLUSTER_COLORS[cid] + '48'} strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={cx} y={cy + CLUSTER_R + 13} textAnchor="middle" fontSize="8.5" fill={CLUSTER_COLORS[cid]} fontWeight="600" opacity="0.85">
            {cid === 'high-impact' ? 'High Impact' : cid === 'growth-ready' ? 'Growth Ready' : 'Emerging Talent'}
          </text>
        </g>
      ))}

      {/* Organisation node — hexagon at right */}
      {orgNode && (() => {
        const [x, y] = orgPos;
        const r = 24;
        const pts = Array.from({ length: 6 }, (_, k) => {
          const a = (Math.PI / 3) * k - Math.PI / 6;
          return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
        }).join(' ');
        return (
          <g key="org">
            <polygon points={pts} fill="#1e3a5f10" stroke="#1e3a5f70" strokeWidth="1.5" />
            <text x={x} y={y - 2} textAnchor="middle" fontSize="6.5" fill="#1e3a5f" fontWeight="700">ORG</text>
            <text x={x} y={y + 8} textAnchor="middle" fontSize="5.5" fill="#1e3a5f80">organisation</text>
          </g>
        );
      })()}

      {/* Edges */}
      {visEdges.map(e => {
        const [x1, y1] = allPositions[e.fromNodeId]!;
        const [x2, y2] = allPositions[e.toNodeId]!;
        return (
          <line key={e.id} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={edgeColor(e.edgeType)}
            strokeWidth={e.edgeType === 'similar_to' ? 0.6 : 1}
            strokeDasharray={e.edgeType === 'skill_gap' ? '3 2' : e.edgeType === 'feeder_role' ? '5 2' : undefined} />
        );
      })}

      {/* Role nodes (pill) */}
      {roles.map(r => {
        const [x, y] = rolePositions[r.id] ?? [0, 0];
        const isHov = hovered === r.id;
        return (
          <g key={r.id} onMouseEnter={() => setHovered(r.id)} onMouseLeave={() => setHovered(null)}>
            <rect x={x - 25} y={y - 10} width={50} height={20} rx="4"
              fill={isHov ? '#8b5cf622' : '#8b5cf614'} stroke="#8b5cf660" strokeWidth={isHov ? 1.5 : 1} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="7.5" fill="#8b5cf6" fontWeight="600">
              {r.label.slice(0, 13)}
            </text>
            <title>{r.label}</title>
          </g>
        );
      })}

      {/* Competency nodes (diamonds) */}
      {competencies.map(c => {
        const [x, y] = compPositions[c.id] ?? [0, 0];
        const s = 7;
        return (
          <g key={c.id}>
            <polygon points={`${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`}
              fill="#4ECDC414" stroke="#4ECDC465" strokeWidth="1" />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize="6.5" fill={BRAND.accent} fontWeight="600">
              {c.label.slice(0, 7)}
            </text>
          </g>
        );
      })}

      {/* Manager nodes (square badge) */}
      {managers.map(m => {
        const pos = managerPositions[m.id];
        if (!pos) return null;
        const [x, y] = pos;
        return (
          <g key={m.id}>
            <rect x={x - 9} y={y - 8} width={18} height={16} rx="2" fill="#64748b18" stroke="#64748b65" strokeWidth="1" />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize="6.5" fill="#64748b" fontWeight="700">M</text>
            <title>{m.label}</title>
          </g>
        );
      })}

      {/* Candidate nodes (circles) */}
      {candidates.slice(0, 24).map(c => {
        const pos = candPositions[c.id];
        if (!pos) return null;
        const [x, y] = pos;
        const cid   = (c.metadata?.clusterId as string) ?? 'emerging-talent';
        const color = CLUSTER_COLORS[cid] ?? BRAND.primary;
        const isHov = hovered === c.id;
        return (
          <g key={c.id} onMouseEnter={() => setHovered(c.id)} onMouseLeave={() => setHovered(null)}>
            <circle cx={x} cy={y} r={isHov ? 7 : 6} fill={color + 'cc'} stroke={color} strokeWidth={isHov ? 2 : 1} />
            {isHov && (
              <text x={x} y={y - 10} textAnchor="middle" fontSize="7" fill="#374151" fontWeight="600"
                style={{ filter: 'drop-shadow(0 0 2px white)' }}>{c.label.slice(0, 14)}</text>
            )}
            <title>{c.label}</title>
          </g>
        );
      })}

      {/* Legend */}
      <g transform="translate(8, 434)">
        {([
          ['candidate', BRAND.primary, '●'],
          ['role', '#8b5cf6', '▪'],
          ['competency', BRAND.accent, '◆'],
          ['manager', '#64748b', '■'],
          ['org', '#1e3a5f', '⬡'],
        ] as [string, string, string][]).map(([et, col, sym], i) => (
          <g key={et} transform={`translate(${i * 135}, 0)`}>
            <text x={0} y={0} fontSize="8" fill={col} fontWeight="600">{sym} {et}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

// ── MAIN PANEL ───────────────────────────────────────────────────────────────

export default function TalentIntelligenceGraphPanel() {
  const [tab, setTab]           = useState<TIGTab>('overview');
  const [stats, setStats]       = useState<Stats | null>(null);
  const [intel, setIntel]       = useState<IntelRecord[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [graphData, setGraph]   = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading]   = useState(false);
  const [building, setBuilding] = useState(false);
  const [err, setErr]           = useState('');
  const [sortCol, setSortCol]   = useState<'readinessIndex' | 'growthPotential' | 'hiddenTalentScore'>('readinessIndex');
  const [showChecks, setShowChecks]     = useState(false);
  const [queryType, setQueryType]       = useState<'role-fit' | 'manager-team' | 'mobility'>('role-fit');
  const [queryInput, setQueryInput]     = useState('');
  const [queryResult, setQueryResult]   = useState<any>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async (url: string) => {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
    return r.json();
  }, []);

  const loadStats = useCallback(async () => {
    try { const d = await fetch_('/api/employer/tig/stats'); setStats(d); }
    catch (e: any) { setErr(e.message); }
  }, [fetch_]);

  const loadReadiness = useCallback(async () => {
    try { const d = await fetch_('/api/employer/tig/readiness'); setReadiness(d); }
    catch { /* not critical */ }
  }, [fetch_]);

  const loadIntel = useCallback(async () => {
    setLoading(true); setErr('');
    try { const d = await fetch_('/api/employer/tig/intelligence'); setIntel(d.intelligence ?? []); }
    catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [fetch_]);

  const loadClusters = useCallback(async () => {
    setLoading(true); setErr('');
    try { const d = await fetch_('/api/employer/tig/clusters'); setClusters(d.clusters ?? []); }
    catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [fetch_]);

  const loadGraph = useCallback(async () => {
    setLoading(true); setErr('');
    try { const d = await fetch_('/api/employer/tig/graph'); setGraph(d); }
    catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [fetch_]);

  const runQuery = useCallback(async () => {
    if (!queryInput.trim()) return;
    setQueryLoading(true); setQueryResult(null);
    try {
      const path = queryType === 'role-fit'     ? `/api/employer/tig/query/role-fit/${queryInput.trim()}`
                 : queryType === 'manager-team' ? `/api/employer/tig/query/manager-team/${queryInput.trim()}`
                 : `/api/employer/tig/query/mobility/${queryInput.trim()}`;
      setQueryResult(await fetch_(path));
    } catch (e: any) { setQueryResult({ _error: e.message }); }
    finally { setQueryLoading(false); }
  }, [fetch_, queryType, queryInput]);

  useEffect(() => {
    loadStats();
    loadReadiness();
  }, []);

  useEffect(() => {
    if (tab === 'intelligence') loadIntel();
    else if (tab === 'clusters')     loadClusters();
    else if (tab === 'graph')        loadGraph();
    else if (tab === 'overview')     { loadStats(); loadReadiness(); }
  }, [tab]);

  // Poll stats while build is running
  useEffect(() => {
    if (building) {
      pollRef.current = setInterval(async () => {
        const d = await fetch_('/api/employer/tig/stats').catch(() => null);
        if (d) { setStats(d); if (d.lastBuild?.status !== 'running') { setBuilding(false); clearInterval(pollRef.current!); if (tab !== 'overview') loadStats(); } }
      }, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [building]);

  const triggerBuild = async () => {
    setBuilding(true); setErr('');
    await fetch('/api/employer/tig/build', { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  const TABS_NAV: { id: TIGTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',     label: 'Overview',     icon: <BarChart3 size={13} /> },
    { id: 'intelligence', label: 'Intelligence',  icon: <Brain size={13} /> },
    { id: 'clusters',     label: 'Clusters',      icon: <Layers size={13} /> },
    { id: 'mobility',     label: 'Mobility',      icon: <ArrowRight size={13} /> },
    { id: 'graph',        label: 'Graph',         icon: <Network size={13} /> },
  ];

  const sorted = [...intel].sort((a, b) => b[sortCol] - a[sortCol]);
  const hiddenTalent = intel.filter(i => i.hiddenTalentScore > 0).sort((a, b) => b.hiddenTalentScore - a.hiddenTalentScore);
  const mobility     = intel.filter(i => i.mobilityTargets.length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg,#1e3a5f,#344E86)' }}>
        <div className="flex items-center gap-3 mb-1">
          <Network className="text-white" size={22} />
          <h2 className="text-white font-bold text-lg">Talent Intelligence Graph</h2>
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">EP-98-W2</span>
        </div>
        <p className="text-blue-200 text-xs">
          9 entity types · 11 edge types · 8 intelligence engines · 6 tig_* tables · 100% structural readiness
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap">
        {TABS_NAV.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={tab === t.id ? { background: BRAND.primary, color: '#fff' } : { background: '#f1f5f9', color: '#475569' }}>
            {t.icon}{t.label}
          </button>
        ))}
        <button onClick={() => { loadStats(); loadReadiness(); }}
          className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600" style={{ background: '#f1f5f9' }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {err && <div className="bg-red-50 text-red-700 rounded-xl p-3 text-xs flex items-center gap-2"><AlertCircle size={14}/>{err}</div>}
      {loading && <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>}

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Readiness gauges */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Target size={14} style={{ color: BRAND.primary }} />
              <span className="font-bold text-sm text-gray-800">Intelligence Readiness</span>
              <button onClick={() => setShowChecks(v => !v)} className="ml-auto text-xs text-gray-400 flex items-center gap-0.5">
                {showChecks ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} {readiness?.checks.length ?? 20} checks
              </button>
            </div>
            <div className="flex items-center gap-8 justify-center">
              <ReadinessGauge value={readiness?.structuralReadiness ?? 100} label="Structural" size={90} />
              <ReadinessGauge value={readiness?.activationReadiness ?? 0} label="Activation" size={90} />
              <div className="text-xs text-gray-500 max-w-[180px]">
                {readiness?.calibration && (() => {
                  const cal = readiness.calibration!;
                  const style = cal.status === 'calibrated' ? { background: '#dcfce7', color: '#15803d' }
                    : cal.status === 'provisional' ? { background: '#dbeafe', color: '#1d4ed8' }
                    : { background: '#fef3c7', color: '#b45309' };
                  const label = cal.status === 'calibrated'
                    ? `Calibrated · ${cal.totalOutcomes} outcome${cal.totalOutcomes === 1 ? '' : 's'}`
                    : cal.status === 'provisional'
                      ? `Provisional · ${cal.totalOutcomes}/30 outcomes`
                      : 'Calibration: cold start';
                  return (
                    <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={style}>
                      {label}
                    </div>
                  );
                })()}
                <div className="text-[11px] leading-relaxed opacity-75">
                  {readiness === null
                    ? 'Loading gap analysis…'
                    : (readiness.gap ?? 'Success probability is empirically calibrated against realized hire outcomes — no structural gaps remain.')}
                </div>
              </div>
            </div>
            {showChecks && readiness && (
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-1">
                {readiness.checks.map(c => (
                  <div key={c.id} className="flex items-center gap-1.5 text-[10px]">
                    {c.pass ? <CheckCircle2 size={10} className="text-green-500 shrink-0" /> : <AlertCircle size={10} className="text-orange-400 shrink-0" />}
                    <span className={c.pass ? 'text-gray-600' : 'text-orange-500'}>{c.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Staleness indicator — shown if last successful build is >7 days ago */}
          {readiness?.lastBuiltAt && (() => {
            const daysSince = Math.floor((Date.now() - new Date(readiness.lastBuiltAt!).getTime()) / 86_400_000);
            if (daysSince < 7) return null;
            return (
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
                <AlertCircle size={13} className="shrink-0 text-yellow-500" />
                <span>Graph data is <strong>{daysSince} days</strong> old — consider rebuilding for fresh intelligence.</span>
              </div>
            );
          })()}

          {/* Reliability diagram (E3) — per-band predicted vs observed; dot area ∝ realized sample size */}
          {readiness?.calibration && readiness.calibration.status !== 'cold_start'
            && readiness.calibration.bands.some(b => b.sampleSize > 0 && b.meanPredicted != null && b.observedRate != null) && (() => {
            const cal  = readiness.calibration!;
            const pts  = cal.bands.filter(b => b.sampleSize > 0 && b.meanPredicted != null && b.observedRate != null);
            const maxN = Math.max(1, ...pts.map(b => b.sampleSize));
            const S = 200, PAD = 26, plot = S - PAD * 2;
            const fx = (v: number) => PAD + v * plot;
            const fy = (v: number) => S - PAD - v * plot;
            const dot = cal.status === 'calibrated' ? '#15803d' : '#1d4ed8';
            return (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={14} style={{ color: BRAND.primary }} />
                  <span className="font-bold text-sm text-gray-800">Calibration Reliability</span>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#475569' }}>
                    {cal.method ?? 'identity'}
                  </span>
                </div>
                <div className="flex items-start gap-4 flex-wrap">
                  <svg width={S} height={S} className="shrink-0">
                    <rect x={PAD} y={PAD} width={plot} height={plot} fill="#fafafa" stroke="#e5e7eb" />
                    {[0.25, 0.5, 0.75].map(g => (
                      <g key={g}>
                        <line x1={fx(g)} y1={fy(0)} x2={fx(g)} y2={fy(1)} stroke="#f1f5f9" />
                        <line x1={fx(0)} y1={fy(g)} x2={fx(1)} y2={fy(g)} stroke="#f1f5f9" />
                      </g>
                    ))}
                    {/* perfect-calibration reference */}
                    <line x1={fx(0)} y1={fy(0)} x2={fx(1)} y2={fy(1)} stroke="#cbd5e1" strokeDasharray="4 3" />
                    {pts.map(b => (
                      <circle key={b.bandId} cx={fx(b.meanPredicted!)} cy={fy(b.observedRate!)}
                        r={4 + 10 * Math.sqrt(b.sampleSize / maxN)}
                        fill={dot} fillOpacity={0.35} stroke={dot} strokeWidth={1.5} />
                    ))}
                    <text x={PAD + plot / 2} y={S - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">predicted →</text>
                    <text x={11} y={PAD + plot / 2} textAnchor="middle" fontSize="9" fill="#94a3b8"
                      transform={`rotate(-90 11 ${PAD + plot / 2})`}>observed →</text>
                  </svg>
                  <div className="text-[11px] text-gray-600 space-y-1.5 min-w-[150px] flex-1">
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Brier</span>
                      <span className="font-bold tabular-nums">{cal.brier == null ? '—' : cal.brier.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">ECE</span>
                      <span className="font-bold tabular-nums">{cal.ece == null ? '—' : cal.ece.toFixed(3)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Method</span>
                      <span className="font-bold">{cal.method ?? 'identity'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-400">Outcomes</span>
                      <span className="font-bold tabular-nums">{cal.totalOutcomes}</span></div>
                    <div className="text-[10px] text-gray-400 leading-snug pt-1">
                      Dot area ∝ realized cases in band · closer to the dashed line = better calibrated · Brier/ECE on raw predictions.
                    </div>
                    {cal.usingGlobalPrior && (
                      <div className="text-[10px] text-blue-600 leading-snug pt-1.5 mt-1 border-t border-gray-100">
                        Borrowing a platform-wide prior (k-anonymous, ≥2 orgs) while this org is sparse.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Graph Nodes',   value: stats?.totalNodes ?? 0,              icon: <Network size={14}/>,  color: BRAND.primary },
              { label: 'Graph Edges',   value: stats?.totalEdges ?? 0,              icon: <GitBranch size={14}/>, color: BRAND.purple },
              { label: 'Intel Snapshots', value: stats?.intelligenceSnapshots ?? 0, icon: <Brain size={14}/>,    color: BRAND.accent },
              { label: 'Clusters',      value: stats?.clusterCount ?? 0,            icon: <Layers size={14}/>,   color: BRAND.orange },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1" style={{ color: s.color }}>{s.icon}
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">{s.label}</span>
                </div>
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Node type breakdown */}
          {stats && stats.totalNodes > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="font-semibold text-sm text-gray-700 mb-3">Node breakdown by entity type</div>
              <div className="space-y-2">
                {Object.entries(stats.nodesByType).map(([type, count]) => (
                  <ScoreBar key={type} value={(count / stats.totalNodes) * 100} color={ENTITY_COLORS[type] ?? '#64748b'} label={type} />
                ))}
              </div>
            </div>
          )}

          {/* Build control */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-gray-800 flex items-center gap-2">
                  <Zap size={14} style={{ color: BRAND.orange }} /> Graph Build
                </div>
                {stats?.lastBuild ? (
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Last build: <span className={`font-semibold ${stats.lastBuild.status === 'complete' ? 'text-green-600' : stats.lastBuild.status === 'error' ? 'text-red-500' : 'text-orange-500'}`}>{stats.lastBuild.status}</span>
                    {stats.lastBuild.status === 'complete' && ` · ${stats.lastBuild.nodesBuilt} nodes · ${stats.lastBuild.edgesBuilt} edges · ${stats.lastBuild.durationMs}ms`}
                    {stats.lastBuild.error && <span className="text-red-500 ml-1">{stats.lastBuild.error.slice(0, 60)}</span>}
                    {' · '}{timeAgo(stats.lastBuild.createdAt)}
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-400 mt-0.5">No build yet. Run a build to materialize the graph from your candidate + job data.</div>
                )}
              </div>
              <button onClick={triggerBuild} disabled={building}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                style={{ background: BRAND.primary }}>
                {building ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                {building ? 'Building…' : 'Build Graph'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INTELLIGENCE ─────────────────────────────────────────────────── */}
      {!loading && tab === 'intelligence' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">{intel.length} candidates analysed</span>
            <div className="flex gap-1 ml-auto">
              {(['readinessIndex', 'growthPotential', 'hiddenTalentScore'] as const).map(col => (
                <button key={col} onClick={() => setSortCol(col)}
                  className="px-2 py-1 rounded text-[10px] font-semibold"
                  style={sortCol === col ? { background: BRAND.primary, color: '#fff' } : { background: '#f1f5f9', color: '#64748b' }}>
                  {col === 'readinessIndex' ? 'Readiness' : col === 'growthPotential' ? 'Growth' : 'Hidden Talent'}
                </button>
              ))}
            </div>
          </div>

          {intel.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-100">
              No intelligence snapshots yet. Build the graph first — it materializes intelligence for every candidate automatically.
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left p-3 font-semibold text-gray-500">Candidate</th>
                  <th className="text-left p-3 font-semibold text-gray-500">Cluster</th>
                  <th className="text-left p-3 font-semibold text-gray-500 w-32">Readiness</th>
                  <th className="text-left p-3 font-semibold text-gray-500 w-32">Growth</th>
                  <th className="text-left p-3 font-semibold text-gray-500 w-20">Hidden</th>
                  <th className="text-left p-3 font-semibold text-gray-500">Mobility</th>
                </tr></thead>
                <tbody>
                  {sorted.map(c => (
                    <tr key={c.candidateId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="p-3">
                        <div className="font-semibold text-gray-800">{c.name}</div>
                        <div className="text-gray-400 text-[10px]">{c.stage}</div>
                      </td>
                      <td className="p-3"><ClusterBadge clusterId={c.clusterId} clusterName={c.clusterName} /></td>
                      <td className="p-3"><ScoreBar value={c.readinessIndex} color={CLUSTER_COLORS[c.clusterId] ?? BRAND.primary} /></td>
                      <td className="p-3"><ScoreBar value={c.growthPotential} color={BRAND.accent} /></td>
                      <td className="p-3">
                        {c.hiddenTalentScore > 0
                          ? <span className="flex items-center gap-1 font-bold" style={{ color: BRAND.orange }}><Star size={9}/>{c.hiddenTalentScore}</span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="p-3">
                        {c.mobilityTargets.length > 0
                          ? <div className="flex flex-wrap gap-1">{c.mobilityTargets.slice(0, 2).map(t => (
                              <span key={t.roleId} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700">
                                {t.roleTitle.slice(0, 16)} {Math.round((t.calibratedProbability ?? t.probability) * 100)}%
                              </span>
                            ))}</div>
                          : <span className="text-gray-200">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hiddenTalent.length > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2 font-bold text-sm text-orange-800"><Star size={14}/> Hidden Talent ({hiddenTalent.length})</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {hiddenTalent.slice(0, 4).map(c => (
                  <div key={c.candidateId} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: BRAND.orange }}>
                      {c.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-xs">{c.name}</div>
                      <div className="text-[10px] text-gray-400">Readiness {c.readinessIndex} · Stage: {c.stage}</div>
                    </div>
                    <span className="text-orange-600 font-black text-sm">{c.hiddenTalentScore}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CLUSTERS ─────────────────────────────────────────────────────── */}
      {!loading && tab === 'clusters' && (
        <div className="space-y-3">
          {clusters.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-100">
              No clusters yet. Run a graph build to compute talent clusters from your candidate pool.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {clusters.map(cl => (
                <div key={cl.clusterId} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: cl.color }} />
                    <span className="font-bold text-sm text-gray-800">{cl.clusterName}</span>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cl.color + '15', color: cl.color }}>{cl.size}</span>
                  </div>
                  <div className="space-y-2 mb-3">
                    <ScoreBar value={cl.avgReadiness} color={cl.color} label="Readiness" />
                    <ScoreBar value={cl.avgGrowth}    color={BRAND.accent} label="Growth" />
                  </div>
                  {cl.traits.topSkills && cl.traits.topSkills.length > 0 && (
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Top skills</div>
                      <div className="flex flex-wrap gap-1">
                        {cl.traits.topSkills.slice(0, 4).map(s => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-50 text-gray-600 border border-gray-100">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-400">
                    {cl.size} member{cl.size !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {clusters.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="font-semibold text-sm text-gray-700 mb-2">Cluster distribution</div>
              <div className="flex gap-1 h-8 rounded overflow-hidden">
                {clusters.map(cl => {
                  const total = clusters.reduce((s, c) => s + c.size, 0);
                  const w = total > 0 ? (cl.size / total) * 100 : 0;
                  return (
                    <div key={cl.clusterId} className="h-full flex items-center justify-center text-[9px] font-bold text-white overflow-hidden transition-all"
                      style={{ width: pct(w), background: cl.color, minWidth: w > 5 ? 0 : 0 }}
                      title={`${cl.clusterName}: ${cl.size}`}>
                      {w > 12 ? cl.size : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MOBILITY ─────────────────────────────────────────────────────── */}
      {!loading && tab === 'mobility' && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">{mobility.length} candidates with internal mobility targets</div>
          {mobility.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-100">
              No mobility opportunities detected. Build the graph once you have active jobs posted — candidates will be matched against open roles automatically.
            </div>
          ) : (
            <div className="space-y-2">
              {mobility.map(c => (
                <div key={c.candidateId} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start gap-3">
                    <div>
                      <div className="font-bold text-sm text-gray-800">{c.name}</div>
                      <div className="text-[11px] text-gray-400">{c.stage} · <ClusterBadge clusterId={c.clusterId} clusterName={c.clusterName} /></div>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      <TrendingUp size={12} style={{ color: BRAND.green }} />
                      <span className="text-[10px] font-semibold text-green-700">Readiness {c.readinessIndex}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.mobilityTargets.slice(0, 4).map(t => (
                      <div key={t.roleId} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-purple-100 bg-purple-50">
                        <ArrowRight size={10} className="text-purple-500" />
                        <span className="text-xs font-semibold text-purple-700">{t.roleTitle}</span>
                        <span className="text-[10px] font-black text-purple-500 ml-0.5">{Math.round((t.calibratedProbability ?? t.probability) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <span className="font-bold">Internal Mobility: </span>
            <span className="opacity-75">Success probability ≥50% (skill overlap × match score). Higher probability = stronger skill-role fit. Build the graph after posting active jobs to surface mobility paths.</span>
          </div>
        </div>
      )}

      {/* ── GRAPH ────────────────────────────────────────────────────────── */}
      {!loading && tab === 'graph' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">
              {graphData ? `${graphData.nodes.length} nodes · ${graphData.edges.length} edges` : 'Build the graph to see the network visualization.'}
            </span>
            <button onClick={loadGraph} className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500" style={{ background: '#f1f5f9' }}>
              <RefreshCw size={11} /> Reload
            </button>
          </div>

          {!graphData || graphData.nodes.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-100">
              No graph data yet. Run a build from the Overview tab to materialise the talent network.
            </div>
          ) : (
            <TIGGraph nodes={graphData.nodes} edges={graphData.edges} />
          )}

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            {[
              { label: 'Entity Types', value: '9',  sub: 'candidate, role, competency, signal, behavior, career_path, learning_path, manager, organization' },
              { label: 'Edge Types',   value: '11', sub: 'has_competency, fits_role, manages, belongs_to, exhibits, skill_gap, feeder_role + 4 more' },
              { label: 'Engines',      value: '8',  sub: 'readiness, growth, hidden talent, success prob, mobility, similarity, clusters, calibration' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="text-xl font-black" style={{ color: BRAND.primary }}>{s.value}</div>
                <div className="font-semibold text-gray-700">{s.label}</div>
                <div className="text-[10px] text-gray-400 mt-1 leading-relaxed">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Edge type legend</div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              {([
                ['has_competency',      '#4ECDC4',   'Candidate → Competency (from skills)'],
                ['fits_role',           '#8b5cf6',   'Candidate → Role (success prob ≥50%)'],
                ['requires_competency', '#4ECDC430', 'Role → Competency (job requirements)'],
                ['on_career_path',      '#e63946',   'Candidate → Career Path'],
                ['enrolled_in',         '#ec4899',   'Candidate → Learning Path'],
                ['similar_to',          '#cbd5e1',   'Candidate ↔ Candidate (cosine ≥80%)'],
                ['manages',             '#64748b',   'Manager → Role/Candidate'],
                ['belongs_to',          '#1e3a5f',   'Candidate/Role → Organisation'],
                ['exhibits',            '#2A9D8F',   'Candidate → Signal/Behavior (LBI)'],
                ['skill_gap',           '#ef4444',   'Candidate → Competency (gap ─ ─)'],
                ['feeder_role',         '#8b5cf6',   'Role → Role (succession - - -)'],
              ] as [string, string, string][]).map(([et, col, desc]) => (
                <div key={et} className="flex items-center gap-1.5">
                  <div className="w-4 h-1 rounded-full shrink-0" style={{ background: col }} />
                  <span className="text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Graph Traversal Query Panel */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs font-bold text-gray-500 uppercase mb-3">Graph Traversal Query</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {(['role-fit', 'manager-team', 'mobility'] as const).map(qt => (
                <button key={qt} onClick={() => { setQueryType(qt); setQueryResult(null); }}
                  className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                  style={queryType === qt
                    ? { background: BRAND.primary, color: '#fff', borderColor: BRAND.primary }
                    : { background: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' }}>
                  {qt === 'role-fit' ? 'Role Fit' : qt === 'manager-team' ? 'Manager Team' : 'Mobility Path'}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-400"
                placeholder={queryType === 'role-fit' ? 'Role ID (UUID)…' : queryType === 'manager-team' ? 'Manager user_id…' : 'Candidate ID (UUID)…'}
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runQuery()} />
              <button onClick={runQuery} disabled={queryLoading || !queryInput.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                style={{ background: BRAND.primary }}>
                {queryLoading ? '…' : 'Query'}
              </button>
            </div>
            {queryResult && (
              <div className="text-xs rounded-lg bg-gray-50 border border-gray-100 p-3 max-h-48 overflow-y-auto">
                {queryResult._error ? (
                  <span className="text-red-500">{queryResult._error}</span>
                ) : queryType === 'role-fit' ? (
                  <>
                    <div className="font-semibold text-gray-700 mb-2">Top fits for: {queryResult.roleLabel}</div>
                    {(queryResult.candidates ?? []).length === 0
                      ? <div className="text-gray-400">No candidates with fits_role edge to this role yet.</div>
                      : (queryResult.candidates as any[]).map((c: any) => (
                        <div key={c.candidateId} className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800">{c.label}</span>
                          <span className="ml-auto font-bold" style={{ color: BRAND.primary }}>{Math.round(c.fitScore * 100)}%</span>
                        </div>
                      ))}
                  </>
                ) : queryType === 'manager-team' ? (
                  <>
                    <div className="font-semibold text-gray-700 mb-2">Team: {queryResult.managerLabel}</div>
                    {(queryResult.roles ?? []).map((r: any) => <div key={r.roleId} className="text-gray-600 mb-0.5">▪ {r.label} <span className="text-gray-400">({r.status})</span></div>)}
                    {(queryResult.candidates ?? []).map((c: any) => <div key={c.candidateId} className="text-blue-600 mb-0.5">● {c.label}</div>)}
                    {(queryResult.roles?.length ?? 0) === 0 && (queryResult.candidates?.length ?? 0) === 0 && <div className="text-gray-400">No manages edges found for this manager.</div>}
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-gray-700 mb-1">Mobility: {queryResult.clusterName}</div>
                    <div className="text-gray-500 mb-1">Readiness {queryResult.readinessIndex} · Growth {queryResult.growthPotential}</div>
                    {(queryResult.mobilityTargets ?? []).slice(0, 3).map((t: any) => (
                      <div key={t.roleId} className="text-purple-700 mb-0.5">→ {t.roleTitle} ({Math.round((t.calibratedProbability ?? t.probability) * 100)}%)</div>
                    ))}
                    {(queryResult.skillGaps ?? []).length > 0 && (
                      <div className="mt-1.5 text-red-600">Skill gaps: {(queryResult.skillGaps as any[]).map((g: any) => g.label).join(', ')}</div>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="text-[10px] text-gray-400 mt-2">Traversal queries run directly against graph edges in tig_edges — no re-computation.</div>
          </div>
        </div>
      )}
    </div>
  );
}
