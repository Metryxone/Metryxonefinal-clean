import { BRAND } from '@/design-system/tokens';
import { DashboardIntro } from '../components/career/DashboardIntro';
/**
 * Phase 3 — Career Mobility & Pathway Intelligence dashboard.
 *
 * Consumes /api/mobility/* (read-only).
 *
 * Panels:
 *   1. Role selectors (from / to)
 *   2. Mobility composite + readiness indicators
 *   3. Current vs Target role DNA radar
 *   4. Transferable strengths panel
 *   5. Competency gap heatmap + category breakdown
 *   6. Development roadmap (personalised pathway)
 *   7. Mobility graph (cards across reachable roles)
 *   8. Adjacent role explorer
 *   9. Recommendations list
 *
 * Language policy is enforced server-side; UI mirrors permitted phrasing only.
 * Deep-link: ?screen=career-mobility
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Loader2, Target, Compass, TrendingUp, Layers as LayersIcon,
  GitBranch, Sparkles, Map, ListChecks, Activity,
} from 'lucide-react';

interface Props { onNavigate?: (screen: string) => void }



interface Role { id: string; title: string; role_family_id: string; layer_id: string; seniority: string|null }
interface CompGap {
  competency_id: string; canonical_name: string; user_score: number; target_anchor: number;
  gap: number; weight: number; family_id: string; domain_id: string;
  category: string; status: 'meets'|'close'|'develop'|'priority';
  /** Provenance of the role's target weight — 'onet_derived' means estimated/inherited. */
  source?: string;
}

/** True when a role competency's target is estimated/inherited from O*NET, not measured. */
const isEstimated = (source?: string) => source === 'onet_derived';
interface Transferable {
  competency_id: string; canonical_name: string;
  user_score: number; transferability: number; contribution: number;
  transfer_type: string; rationale: string;
}
interface Comparison {
  from_role_id: string; to_role_id: string;
  overlap_score: number; transferability_score: number;
  gap_size_score: number; mobility_score: number;
  transferable_strengths: Transferable[];
  competency_gaps: CompGap[];
  gap_categories: Record<string, { count: number; avg_gap: number; total_weighted_gap: number }>;
  development_priorities: Array<{ competency_id: string; canonical_name: string; priority_score: number; reason: string }>;
}
interface Recommendation {
  id: string; category: string; title: string; rationale: string;
  evidence: Record<string, unknown>; developmental_actions: string[];
  estimated_weeks: number|null; priority: 'high'|'medium'|'low';
  alignment_indicators: string[];
}
interface PathwayStep {
  position: number; competency_id: string; canonical_name: string;
  action: string; est_weeks: number; resource_type: string|null;
  target_level: number|null; user_score: number|null;
  current_level: number; progress_to_target: number;
  status: 'achieved'|'in_progress'|'not_started';
}
interface PathwayDetail {
  pathway: { id: string; name: string; description: string|null; category: string|null; total_weeks: number };
  steps: PathwayStep[];
  summary: { total_steps: number; completed_steps: number; remaining_weeks: number; total_weeks: number; progress: number };
}
interface Report {
  context: { from_role_id: string; to_role_id: string };
  comparison: Comparison;
  recommendations: Recommendation[];
  top_pathway_detail: PathwayDetail|null;
  suggested_pathways: Array<{ pathway: { id: string; name: string; category: string|null }; relevance: number; matched_priorities: string[] }>;
}
interface GraphRow {
  role_id: string; title: string; layer_id: string; seniority: string|null;
  mobility_score: number; overlap: number; transferability: number; gap_size: number;
  transition: { transition_type: string; difficulty: string; typical_duration_months: number; frequency_band: string|null } | null;
  top_priority: { canonical_name: string } | null;
}
interface Adjacent {
  role_id: string; title: string; layer_id: string; seniority: string|null;
  adjacency_score: number; basis: Record<string, boolean>;
}

const STATUS_COLOR: Record<CompGap['status'], string> = {
  meets:    BRAND.green,
  close:    BRAND.blue,
  develop:  BRAND.amber,
  priority: BRAND.red,
};

const STATUS_LABEL: Record<CompGap['status'], string> = {
  meets: 'Meets anchor', close: 'Close to anchor',
  develop: 'Development opportunity', priority: 'Priority development',
};

const PRIORITY_COLOR: Record<Recommendation['priority'], string> = {
  high: BRAND.red, medium: BRAND.amber, low: BRAND.blue,
};

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error ?? 'request_failed');
  return j.data as T;
}

const fmt = (n: number) => Math.round(n * 10) / 10;

export default function CareerMobilityPage({ onNavigate }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [fromRole, setFromRole] = useState('role_be_eng');
  const [toRole, setToRole] = useState('role_eng_manager');
  const [sessionId] = useState(() => `mobility_${Math.random().toString(36).slice(2, 10)}`);
  const [report, setReport] = useState<Report|null>(null);
  const [graph, setGraph] = useState<GraphRow[]>([]);
  const [adjacent, setAdjacent] = useState<Adjacent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => { void getJson<Role[]>('/api/mobility/roles').then(setRoles).catch(()=>{}); }, []);

  useEffect(() => {
    if (!fromRole || !toRole || fromRole === toRole) return;
    setLoading(true); setError(null);
    Promise.all([
      getJson<Report>(`/api/mobility/report?from_role_id=${fromRole}&to_role_id=${toRole}&demo=true&session_id=${sessionId}`),
      getJson<GraphRow[]>(`/api/mobility/graph?from_role_id=${fromRole}&demo=true&session_id=${sessionId}`),
      getJson<Adjacent[]>(`/api/mobility/adjacent?role_id=${fromRole}`),
    ]).then(([r, g, a]) => { setReport(r); setGraph(g); setAdjacent(a); })
      .catch(e => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [fromRole, toRole, sessionId]);

  const fromRoleObj = useMemo(() => roles.find(r => r.id === fromRole), [roles, fromRole]);
  const toRoleObj   = useMemo(() => roles.find(r => r.id === toRole),   [roles, toRole]);

  return (
    <div style={{ minHeight: '100vh', background: BRAND.bg, fontFamily: 'Inter, system-ui, sans-serif', color: BRAND.primary }}>
      {/* Header */}
      <div style={{ background: BRAND.surface, borderBottom: `1px solid ${BRAND.border}`, padding: '16px 24px',
                    display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => onNavigate?.('admin-dashboard')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
                         border: `1px solid ${BRAND.border}`, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <Compass size={22} color={BRAND.accent} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Career Mobility Intelligence</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            Phase 3 · Adaptive Career Intelligence · developmental readiness · capability proximity
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => onNavigate?.('career-builder?tab=assessment')}
            data-testid="mobility-take-assessment"
            style={{ background: BRAND.primary, color: '#fff', border: 'none', padding: '6px 12px',
                     borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            Take / Retake Competency Assessment
          </button>
          <Selector label="Current" roles={roles} value={fromRole} onChange={setFromRole} />
          <Selector label="Target"  roles={roles} value={toRole}   onChange={setToRole}   />
        </div>
      </div>

      <DashboardIntro
        title="Career Mobility"
        whatItIs="Pick a current and target role to see your readiness gap, transferable strengths, adjacent opportunities and a development roadmap."
        whenToUse="When you're thinking about a move — promotion, lateral switch, or exploring what roles fit your strengths."
        prereq="Benchmark scores recommended (otherwise demo data is used)"
        audience="Individuals planning a transition"
      />

      {error && <div style={{ padding: 16, color: BRAND.red }}>Error: {error}</div>}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Computing mobility profile…
        </div>
      )}

      {!loading && report && (
        <div style={{ padding: 24, display: 'grid', gap: 16,
                      gridTemplateColumns: 'repeat(12, 1fr)' }}>

          {/* 1. Mobility composite + readiness indicators */}
          <Panel title="Developmental Readiness" icon={<Target size={16} />} span={12}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <Metric label="Mobility Composite" value={`${fmt(report.comparison.mobility_score)}/100`}
                      color={BRAND.accent}
                      caption={`${fromRoleObj?.title ?? fromRole} → ${toRoleObj?.title ?? toRole}`} />
              <Metric label="Role-DNA Overlap" value={`${fmt(report.comparison.overlap_score)}%`}
                      color={BRAND.blue} caption="weighted capability intersection" />
              <Metric label="Transferability" value={`${fmt(report.comparison.transferability_score)}%`}
                      color={BRAND.purple} caption="cross-competency strength transfer" />
              <Metric label="Gap Coverage" value={`${fmt(report.comparison.gap_size_score)}%`}
                      color={BRAND.green} caption="proximity to target anchors" />
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
              <strong>Language policy:</strong> developmental readiness · capability proximity · alignment indicators.
              This dashboard does not assert hiring outcomes, candidate suitability, or promotion likelihood.
            </div>
          </Panel>

          {/* 2. Current vs Target role DNA radar */}
          <Panel title="Current vs Target — Role DNA" icon={<Activity size={16} />} span={6}>
            <Radar gaps={report.comparison.competency_gaps} />
          </Panel>

          {/* 3. Transferable strengths */}
          <Panel title="Transferable Strengths" icon={<Sparkles size={16} />} span={6}>
            {report.comparison.transferable_strengths.length === 0 && (
              <div style={{ color: '#64748B', fontSize: 13 }}>No high-transfer matches yet — focus on building proximity.</div>
            )}
            {report.comparison.transferable_strengths.map(t => (
              <div key={t.competency_id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                                  padding: '10px 0', borderBottom: `1px solid ${BRAND.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.canonical_name}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{t.rationale}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Pill label={t.transfer_type} color={BRAND.purple} />
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    proximity <strong>{Math.round(t.transferability * 100)}%</strong>
                  </div>
                </div>
              </div>
            ))}
          </Panel>

          {/* 4. Competency gap heatmap */}
          <Panel title="Capability Heatmap" icon={<LayersIcon size={16} />} span={8}>
            {report.comparison.competency_gaps.some(g => isEstimated(g.source)) && (
              <div style={{ fontSize: 11, color: '#92400E', background: '#FFFBEB',
                            border: '1px solid #FDE68A', borderRadius: 8,
                            padding: '6px 10px', marginBottom: 8 }}>
                <strong>Estimated</strong> targets are inherited from related occupations
                (O*NET) because this role has no measured ratings — treat them as approximate.
              </div>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {report.comparison.competency_gaps.map(g => (
                <div key={g.competency_id} style={{ display: 'grid',
                       gridTemplateColumns: '180px 1fr 100px 80px', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, display: 'flex',
                                alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {g.canonical_name}
                    {isEstimated(g.source) && (
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                                     letterSpacing: 0.3, color: '#B45309', background: '#FEF3C7',
                                     border: '1px solid #FDE68A', borderRadius: 999,
                                     padding: '1px 6px' }}>Estimated</span>
                    )}
                  </div>
                  <Bar percent={g.user_score} anchor={g.target_anchor} color={STATUS_COLOR[g.status]} />
                  <div style={{ fontSize: 11, color: STATUS_COLOR[g.status], fontWeight: 600 }}>
                    {g.gap >= 0 ? `+${g.gap}` : g.gap} pts
                  </div>
                  <Pill label={STATUS_LABEL[g.status]} color={STATUS_COLOR[g.status]} />
                </div>
              ))}
            </div>
          </Panel>

          {/* 5. Gap categories */}
          <Panel title="Gap Categories" icon={<GitBranch size={16} />} span={4}>
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(report.comparison.gap_categories).sort((a,b) => b[1].total_weighted_gap - a[1].total_weighted_gap).map(([cat, v]) => (
                <div key={cat} style={{ background: BRAND.bg, padding: 10, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ textTransform: 'capitalize', fontSize: 13 }}>{cat}</strong>
                    <span style={{ fontSize: 12, color: '#64748B' }}>{v.count} comps</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    avg gap <strong>{v.avg_gap > 0 ? '+' : ''}{v.avg_gap}</strong> · weighted <strong>{v.total_weighted_gap}</strong>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* 6. Development roadmap */}
          <Panel title="Development Roadmap" icon={<Map size={16} />} span={12}
                 subtitle={report.top_pathway_detail
                   ? `${report.top_pathway_detail.pathway.name} · ${report.top_pathway_detail.summary.remaining_weeks} wk remaining`
                   : 'No personalised pathway available'}>
            {report.top_pathway_detail
              ? <Roadmap detail={report.top_pathway_detail} />
              : <div style={{ color: '#64748B', fontSize: 13 }}>Pathway suggestions appear once development priorities are clear.</div>}
            {report.suggested_pathways.length > 1 && (
              <div style={{ marginTop: 14, fontSize: 12, color: '#64748B' }}>
                Other suggested pathways:{' '}
                {report.suggested_pathways.slice(1).map(p =>
                  <span key={p.pathway.id} style={{ marginRight: 10 }}>
                    {p.pathway.name} <strong>({Math.round(p.relevance*100)}%)</strong>
                  </span>)}
              </div>
            )}
          </Panel>

          {/* 7. Mobility graph */}
          <Panel title="Mobility Graph (across reachable roles)" icon={<TrendingUp size={16} />} span={8}>
            <div style={{ display: 'grid', gap: 8 }}>
              {graph.map(g => (
                <button key={g.role_id} onClick={() => setToRole(g.role_id)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px', alignItems: 'center',
                           background: g.role_id === toRole ? '#FFF7ED' : BRAND.surface,
                           border: `1px solid ${g.role_id === toRole ? BRAND.accent : BRAND.border}`,
                           borderRadius: 8, padding: 10, cursor: 'pointer', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{g.title}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      {g.layer_id.replace('layer_','')} · {g.seniority ?? '—'}
                      {g.transition && <> · {g.transition.transition_type.replace('_',' ')} · {g.transition.difficulty}</>}
                    </div>
                  </div>
                  <MiniStat label="mobility" value={fmt(g.mobility_score)} color={BRAND.accent} />
                  <MiniStat label="overlap"  value={fmt(g.overlap)}        color={BRAND.blue} />
                  <MiniStat label="transfer" value={fmt(g.transferability)} color={BRAND.purple} />
                  <MiniStat label="gap-cov"  value={fmt(g.gap_size)}       color={BRAND.green} />
                </button>
              ))}
            </div>
          </Panel>

          {/* 8. Adjacent role explorer */}
          <Panel title="Adjacent Roles" icon={<Compass size={16} />} span={4}>
            {adjacent.length === 0 && <div style={{ color: '#64748B', fontSize: 13 }}>No adjacencies indexed.</div>}
            {adjacent.map(a => (
              <button key={a.role_id} onClick={() => setToRole(a.role_id)}
                style={{ display: 'block', width: '100%', textAlign: 'left',
                         background: BRAND.bg, border: `1px solid ${BRAND.border}`,
                         padding: 10, borderRadius: 8, marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 13 }}>{a.title}</strong>
                  <Pill label={`${Math.round(a.adjacency_score*100)}% adjacency`} color={BRAND.blue} />
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                  {Object.entries(a.basis).filter(([,v])=>v).map(([k])=>k.replaceAll('_',' ')).join(' · ') || 'ontology adjacency'}
                </div>
              </button>
            ))}
          </Panel>

          {/* 9. Recommendations */}
          <Panel title="Personalised Recommendations" icon={<ListChecks size={16} />} span={12}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {report.recommendations.map(r => (
                <div key={r.id} style={{ border: `1px solid ${BRAND.border}`,
                       borderLeft: `4px solid ${PRIORITY_COLOR[r.priority]}`,
                       borderRadius: 8, padding: 14, background: BRAND.surface }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>{r.title}</strong>
                    <Pill label={r.priority} color={PRIORITY_COLOR[r.priority]} />
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4, textTransform: 'capitalize' }}>
                    {r.category.replaceAll('_',' ')}{r.estimated_weeks ? ` · ~${r.estimated_weeks}w` : ''}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 8 }}>{r.rationale}</div>
                  <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
                    {r.developmental_actions.map((a, i) => <li key={i} style={{ marginBottom: 4 }}>{a}</li>)}
                  </ul>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#64748B' }}>
                    {r.alignment_indicators.map((a, i) => <div key={i}>• {a}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ---------- small UI primitives ----------

function Selector({ label, roles, value, onChange }: { label: string; roles: Role[]; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ color: '#64748B' }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${BRAND.border}` }}>
        {roles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
      </select>
    </label>
  );
}

function Panel({ title, icon, span, subtitle, children }:
  { title: string; icon: React.ReactNode; span: number; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: `span ${span}`, background: BRAND.surface, border: `1px solid ${BRAND.border}`,
                  borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {icon}
        <strong style={{ fontSize: 14 }}>{title}</strong>
        {subtitle && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748B' }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, color, caption }: { label: string; value: string; color: string; caption?: string }) {
  return (
    <div style={{ background: BRAND.bg, borderRadius: 10, padding: 14, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {caption && <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{caption}</div>}
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: `${color}15`, color, fontSize: 10, fontWeight: 600,
                   padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748B' }}>{label}</div>
    </div>
  );
}

function Bar({ percent, anchor, color }: { percent: number; anchor: number; color: string }) {
  return (
    <div style={{ position: 'relative', height: 16, background: BRAND.bg, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${Math.min(100, Math.max(0, percent))}%`, background: color, opacity: 0.85 }} />
      <div title={`Target anchor: ${anchor}`}
           style={{ position: 'absolute', left: `${anchor}%`, top: -2, bottom: -2, width: 2,
                    background: BRAND.primary }} />
    </div>
  );
}

function Roadmap({ detail }: { detail: PathwayDetail }) {
  const stepColor = (s: PathwayStep) => s.status === 'achieved' ? BRAND.green
                                        : s.status === 'in_progress' ? BRAND.amber : BRAND.border;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, background: BRAND.bg, height: 8, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${detail.summary.progress * 100}%`, height: '100%', background: BRAND.green }} />
        </div>
        <div style={{ fontSize: 12, color: '#64748B' }}>
          {detail.summary.completed_steps}/{detail.summary.total_steps} steps · {Math.round(detail.summary.progress*100)}%
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${detail.steps.length}, 1fr)`, gap: 8 }}>
        {detail.steps.map((s, i) => (
          <div key={s.position} style={{ position: 'relative' }}>
            {i > 0 && <div style={{ position: 'absolute', top: 14, left: '-50%', right: '50%',
                                    height: 2, background: stepColor(s) }} />}
            <div style={{ width: 28, height: 28, borderRadius: 14, background: stepColor(s),
                          color: BRAND.surface, display: 'grid', placeItems: 'center',
                          fontSize: 12, fontWeight: 700, margin: '0 auto', position: 'relative', zIndex: 1 }}>
              {s.position}
            </div>
            <div style={{ marginTop: 8, padding: 10, background: BRAND.bg, borderRadius: 8,
                          border: `1px solid ${BRAND.border}` }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{s.canonical_name}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{s.action}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11 }}>
                <span style={{ color: '#64748B' }}>L{s.current_level}/{s.target_level ?? '?'}</span>
                <span style={{ color: '#64748B' }}>{s.est_weeks}w · {s.resource_type}</span>
              </div>
              <div style={{ marginTop: 6, height: 4, background: BRAND.surface, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${s.progress_to_target * 100}%`, height: '100%', background: stepColor(s) }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Radar (SVG) ----------

function Radar({ gaps }: { gaps: CompGap[] }) {
  const n = gaps.length || 1;
  const size = 360; const cx = size/2; const cy = size/2; const r = size/2 - 50;
  const angle = (i: number) => (i / n) * 2 * Math.PI - Math.PI/2;
  const pt = (i: number, v: number) => {
    const a = angle(i);
    const rr = (v / 100) * r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  };
  const userPath = gaps.map((g, i) => {
    const [x, y] = pt(i, Math.max(0, g.user_score));
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ') + 'Z';
  const targetPath = gaps.map((g, i) => {
    const [x, y] = pt(i, g.target_anchor);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ') + 'Z';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size}>
        {[0.25, 0.5, 0.75, 1].map(p => (
          <circle key={p} cx={cx} cy={cy} r={r*p} fill="none" stroke={BRAND.border} />
        ))}
        {gaps.map((_, i) => {
          const [x, y] = pt(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={BRAND.border} />;
        })}
        <path d={targetPath} fill={BRAND.accent} fillOpacity={0.15} stroke={BRAND.accent} strokeDasharray="4 4" />
        <path d={userPath}   fill={BRAND.blue}   fillOpacity={0.30} stroke={BRAND.blue} strokeWidth={2} />
        {gaps.map((g, i) => {
          const [x, y] = pt(i, 115);
          return (
            <text key={g.competency_id} x={x} y={y} fontSize={9}
                  textAnchor="middle" fill={BRAND.primary}>
              {g.canonical_name.length > 18 ? g.canonical_name.slice(0,16)+'…' : g.canonical_name}
            </text>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748B', marginTop: 8 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: BRAND.blue, marginRight: 4 }} />Current</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: BRAND.accent, marginRight: 4 }} />Target anchor</span>
      </div>
    </div>
  );
}
