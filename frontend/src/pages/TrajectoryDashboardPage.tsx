import { DashboardIntro } from '../components/career/DashboardIntro';
/**
 * Phase 4 — Trajectory Dashboard.
 * History · Velocity · Trajectory bands · Maturity transitions.
 */
import { useEffect, useMemo, useState } from 'react';

interface NavProps { onNavigate?: (screen: string) => void }

type Hist = { competency_id: string; canonical_name: string;
  points: { captured_at: string; score: number; source: string }[];
  current: number | null; baseline: number | null; observation_count: number };

type Vel = { competency_id: string; canonical_name: string; velocity_pts_per_30d: number;
  trend: string; momentum_score: number; consistency: number;
  start_score: number; end_score: number; delta_score: number; sample_count: number };

type Traj = { competency_id: string; canonical_name: string; baseline: number; current: number;
  projection_lower: number; projection_upper: number; horizon_months: number;
  trajectory_type: string; confidence_band: string; observation_count: number };

type Mat = { competency_id: string; canonical_name: string; current_level: number;
  previous_level: number | null; stability_index: number; consistency_score: number;
  transitions: { from: number | null; to: number; at: string }[] };

const C = {
  bg: '#0b0d12', panel: '#11151c', border: '#1d2330', text: '#e6eaf2',
  muted: '#8c97ad', accent: '#7cf0c2', warm: '#f8b06a', warn: '#f87171',
  cool: '#5fa8ff', purple: '#a78bfa',
};

function trendColor(t: string): string {
  if (t === 'accelerating') return C.accent;
  if (t === 'steady') return C.cool;
  if (t === 'plateau') return C.muted;
  if (t === 'declining') return C.warn;
  if (t === 'volatile') return C.warm;
  return C.muted;
}

export default function TrajectoryDashboardPage({ onNavigate }: NavProps) {
  const [history, setHistory] = useState<Hist[]>([]);
  const [velocity, setVelocity] = useState<Vel[]>([]);
  const [trajectory, setTrajectory] = useState<Traj[]>([]);
  const [maturity, setMaturity] = useState<Mat[]>([]);
  const [explainability, setExplainability] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const q = '?demo=true&user_id=demo_user_alpha';
        const [h, v, t, m] = await Promise.all([
          fetch(`/api/longitudinal/history${q}`).then(r => r.json()),
          fetch(`/api/longitudinal/velocity${q}`).then(r => r.json()),
          fetch(`/api/longitudinal/trajectory${q}&horizon_months=6`).then(r => r.json()),
          fetch(`/api/longitudinal/maturity${q}`).then(r => r.json()),
        ]);
        setHistory(h.data?.histories ?? []);
        setVelocity(v.data?.velocity ?? []);
        setTrajectory(t.data?.trajectories ?? []);
        setMaturity(m.data?.maturity ?? []);
        setExplainability(t.data?._explainability ?? null);
      } catch (e: any) { setErr(e.message); }
      setLoading(false);
    })();
  }, []);

  const accel = velocity.filter(v => v.trend === 'accelerating').length;
  const declining = velocity.filter(v => v.trend === 'declining').length;
  const matured = maturity.filter(m => m.current_level >= 4).length;

  if (loading) return <Layout><div style={{ color: C.muted, padding: 32 }}>Loading longitudinal intelligence…</div></Layout>;
  if (err) return <Layout><div style={{ color: C.warn, padding: 32 }}>Error: {err}</div></Layout>;

  return (
    <Layout>
      <header style={{ padding: '24px 32px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1.5, color: C.muted, textTransform: 'uppercase' }}>Phase 4 · Longitudinal Intelligence</div>
          <h1 style={{ fontSize: 28, margin: '6px 0', color: C.text }}>Trajectory Dashboard</h1>
          <div style={{ color: C.muted, fontSize: 13 }}>
            Capability evolution, velocity, projection bands & maturity transitions for <code style={{ color: C.accent }}>demo_user_alpha</code>.
          </div>
        </div>
        <button
          onClick={() => onNavigate?.('career-builder?tab=assessment')}
          data-testid="trajectory-take-assessment"
          style={{ background: C.accent, color: C.bg, border: 'none', padding: '8px 14px',
                   borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Take / Retake Competency Assessment
        </button>
      </header>

      <DashboardIntro
        title="Growth Trajectory"
        whatItIs="Your competency scores over time — velocity, momentum and conservative projection bands per competency. Maturity transitions are flagged automatically."
        whenToUse="After your second assessment onwards — the more data points, the tighter the projection bands."
        prereq="Take the Competency Assessment at least twice"
        audience="Individuals tracking progress"
      />

      <section style={{ padding: '12px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Stat label="Competencies tracked" value={history.length} accent={C.cool} />
        <Stat label="Accelerating trends" value={accel} accent={C.accent} />
        <Stat label="Declining trends" value={declining} accent={C.warn} />
        <Stat label="At maturity L4+" value={matured} accent={C.purple} />
      </section>

      {/* Velocity table */}
      <Panel title="Development Velocity (pts / 30d)">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, fontSize: 12, color: C.muted, padding: '0 4px 8px' }}>
          <div>Competency</div><div>Trend</div><div>Δ score</div><div>Velocity</div><div>Momentum</div><div>Consistency</div>
        </div>
        {velocity.slice(0, 12).map(v => (
          <div key={v.competency_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, fontSize: 13,
            color: C.text, padding: '8px 4px', borderTop: `1px solid ${C.border}` }}>
            <div>{v.canonical_name}</div>
            <div style={{ color: trendColor(v.trend) }}>{v.trend}</div>
            <div>{v.delta_score >= 0 ? '+' : ''}{v.delta_score.toFixed(1)}</div>
            <div>{v.velocity_pts_per_30d.toFixed(2)}</div>
            <div>{v.momentum_score.toFixed(1)}</div>
            <div><Bar value={v.consistency} max={100} color={C.cool} /></div>
          </div>
        ))}
      </Panel>

      {/* Trajectory bands */}
      <Panel title="Growth Trajectory (6-month projection — conservative band)">
        <div style={{ display: 'grid', gap: 10 }}>
          {trajectory.slice(0, 10).map(t => (
            <div key={t.competency_id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 120px', gap: 12, alignItems: 'center' }}>
              <div style={{ color: C.text, fontSize: 13 }}>{t.canonical_name}</div>
              <TrajectoryBar t={t} />
              <div style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>
                <span style={{ color: trendColor(t.trajectory_type) }}>{t.trajectory_type}</span>
                {' · '}conf {t.confidence_band}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: 10, background: '#0d1116', borderRadius: 6, fontSize: 11, color: C.muted, border: `1px dashed ${C.border}` }}>
          Projection bands are conservative ranges with confidence tiers (A→D / provisional). They are
          <strong style={{ color: C.text }}> developmental trajectory indicators</strong>, never hiring/promotion predictions.
        </div>
      </Panel>

      {/* Maturity ladder */}
      <Panel title="Capability Maturity Transitions (L1 → L5)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {maturity.slice(0, 10).map(m => (
            <div key={m.competency_id} style={{ padding: 10, background: '#0d1116', borderRadius: 6, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>{m.canonical_name}</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                {[1,2,3,4,5].map(lvl => (
                  <div key={lvl} style={{
                    flex: 1, height: 8, borderRadius: 3,
                    background: lvl <= m.current_level
                      ? (lvl === 5 ? C.accent : lvl >= 4 ? C.purple : lvl >= 3 ? C.cool : C.muted)
                      : '#1d2330',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                Now: L{m.current_level} · transitions {m.transitions.length} · stability {m.stability_index.toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* History sparklines */}
      <Panel title="History — 6-month sparklines">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {history.slice(0, 9).map(h => (
            <div key={h.competency_id} style={{ padding: 10, background: '#0d1116', borderRadius: 6, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>{h.canonical_name}</div>
              <Sparkline points={h.points.map(p => p.score)} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                {h.baseline?.toFixed(0)} → {h.current?.toFixed(0)} · n={h.observation_count}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Explainability footer */}
      {explainability && (
        <Panel title="Explainability">
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            <div><strong style={{ color: C.text }}>Score type:</strong> {explainability.score_type}</div>
            <div><strong style={{ color: C.text }}>Methodology versions:</strong> {Object.entries(explainability.methodology?.versions ?? {}).map(([k,v]) => `${k}@${v}`).join(' · ')}</div>
            <div style={{ marginTop: 6, fontStyle: 'italic' }}>{explainability.rationale}</div>
          </div>
        </Panel>
      )}
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>{children}</div>;
}
function Stat({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div style={{ background: C.panel, padding: 16, borderRadius: 8, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</div>
      <div style={{ fontSize: 28, color: accent, marginTop: 4, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ margin: '12px 32px', background: C.panel, padding: 18, borderRadius: 10, border: `1px solid ${C.border}` }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 14, color: C.text, letterSpacing: 0.4 }}>{title}</h3>
      {children}
    </section>
  );
}
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height: 6, background: '#1d2330', borderRadius: 3 }}>
      <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 3 }} />
    </div>
  );
}
function TrajectoryBar({ t }: { t: Traj }) {
  const range = [0, 100];
  const fmt = (v: number) => ((v - range[0]) / (range[1] - range[0])) * 100;
  return (
    <div style={{ position: 'relative', height: 24 }}>
      <div style={{ position: 'absolute', inset: '11px 0 11px 0', background: '#1d2330', borderRadius: 2 }} />
      <div style={{ position: 'absolute', top: 8, height: 10,
        left: `${fmt(t.projection_lower)}%`, width: `${fmt(t.projection_upper) - fmt(t.projection_lower)}%`,
        background: trendColor(t.trajectory_type), opacity: 0.35, borderRadius: 3 }} />
      <div style={{ position: 'absolute', top: 6, height: 12, width: 2, background: C.muted, left: `calc(${fmt(t.baseline)}% - 1px)` }} title={`baseline ${t.baseline}`} />
      <div style={{ position: 'absolute', top: 4, height: 16, width: 3, background: C.text, left: `calc(${fmt(t.current)}% - 1.5px)`, borderRadius: 1 }} title={`current ${t.current}`} />
    </div>
  );
}
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 200, h = 40;
  const min = Math.min(...points), max = Math.max(...points);
  const range = Math.max(1, max - min);
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={C.accent} strokeWidth={2} />
    </svg>
  );
}
