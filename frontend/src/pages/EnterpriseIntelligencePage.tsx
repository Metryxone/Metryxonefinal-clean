/**
 * Phase 5 — Enterprise Intelligence Dashboard.
 * Overview · Workforce intelligence · Succession readiness · Strategic gaps.
 */
import { useEffect, useState } from 'react';

interface NavProps { onNavigate?: (screen: string) => void }

type Overview = { snapshot_name: string; payload: any; freshness_days: number; computed_at: string };
type Intel = { id: string; dimension: string; metric: string; value: number; band: string | null };
type Succ = { user_id: string; target_role_id: string; target_role_title: string;
  readiness_band: string; readiness_score: number;
  contributing_strengths: { competency: string }[];
  development_gaps: { competency: string; gap: number }[];
  recommended_horizon_months: number | null };
type Gap = { competency_id: string; canonical_name: string; enterprise_index: number;
  strategic_band_pct: number; gap_indicator: string; affected_layers: string[] };

const C = { bg: '#0b0d12', panel: '#11151c', border: '#1d2330', text: '#e6eaf2',
  muted: '#8c97ad', accent: '#7cf0c2', warm: '#f8b06a', warn: '#f87171', cool: '#5fa8ff', purple: '#a78bfa' };

const bandColor = (b: string | null) =>
  b === 'aligned' || b === 'developmentally_ready' || b === 'strategic' ? C.accent
  : b === 'progressing' ? C.cool
  : b === 'developing' ? C.warm
  : b === 'strategic_gap' ? C.warn
  : C.muted;

export default function EnterpriseIntelligencePage(_: NavProps) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [intel, setIntel] = useState<Intel[]>([]);
  const [succession, setSuccession] = useState<Succ[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [meth, setMeth] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [o, i, s, g] = await Promise.all([
        fetch('/api/enterprise/overview').then(r => r.json()),
        fetch('/api/enterprise/workforce-intelligence').then(r => r.json()),
        fetch('/api/enterprise/succession').then(r => r.json()),
        fetch('/api/enterprise/strategic-gaps').then(r => r.json()),
      ]);
      setOverview(o.data ?? null);
      setIntel(i.data?.intelligence ?? []);
      setSuccession(s.data?.readiness ?? []);
      setGaps(g.data?.gaps ?? []);
      setMeth(o.data?._explainability?.methodology?.versions ?? {});
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ background: C.bg, color: C.muted, padding: 32, minHeight: '100vh' }}>Loading enterprise intelligence…</div>;

  const enterprise = intel.filter(i => i.dimension === 'enterprise');
  const byLayer = intel.filter(i => i.dimension === 'layer');
  const ovPayload = overview?.payload ?? {};

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ padding: '24px 32px 8px' }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, color: C.muted, textTransform: 'uppercase' }}>Phase 5 · Enterprise Intelligence</div>
        <h1 style={{ fontSize: 28, margin: '6px 0' }}>Enterprise Workforce Intelligence</h1>
        <div style={{ color: C.muted, fontSize: 13 }}>
          Leadership pipeline · succession readiness · capability heatmaps · strategic gaps.
          {overview && <span style={{ marginLeft: 8 }}>· Freshness: {overview.freshness_days}d</span>}
        </div>
      </header>

      {ovPayload.headline && (
        <section style={{ padding: '12px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Stat label="Workforce size" value={ovPayload.headline.workforce_size} accent={C.cool} />
          <Stat label="Data freshness" value={`${ovPayload.headline.data_freshness_days}d`} accent={C.accent} />
          <Stat label="Capability completeness" value={`${Math.round(ovPayload.headline.capability_data_completeness * 100)}%`} accent={C.purple} />
          <Stat label="Capability Δ 30d" value={`+${ovPayload.trend?.capability_index_30d?.toFixed(1) ?? 0}`} accent={C.accent} />
        </section>
      )}

      <Panel title="Enterprise Intelligence Metrics">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {enterprise.map(m => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: 8, padding: '8px 0', borderTop: `1px solid ${C.border}`, fontSize: 13 }}>
              <span>{m.metric.replace(/_/g, ' ')}</span>
              <span style={{ color: bandColor(m.band), textAlign: 'right' }}>{m.value.toFixed(1)}</span>
              <span style={{ color: C.muted, textAlign: 'right' }}>{m.band ?? '—'}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Capability Density by Organisational Layer">
        {byLayer.map(m => (
          <div key={m.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.text }}>
              <span>{m.metric.replace(/_/g, ' ')} · {(m as any).dimensions?.layer ?? 'layer'}</span>
              <span style={{ color: bandColor(m.band) }}>{m.value.toFixed(1)} · {m.band}</span>
            </div>
            <div style={{ height: 6, background: '#1d2330', borderRadius: 3, marginTop: 4 }}>
              <div style={{ height: 6, width: `${Math.min(100, m.value)}%`, background: bandColor(m.band), borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </Panel>

      <Panel title="Succession Readiness (developmental bands — never hiring/promotion predictions)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {succession.slice(0, 9).map(s => (
            <div key={`${s.user_id}-${s.target_role_id}`} style={{ padding: 12, background: '#0d1116', borderRadius: 6, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{s.target_role_title}</div>
              <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>{s.user_id}</div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 22, color: bandColor(s.readiness_band), fontWeight: 600 }}>{s.readiness_score.toFixed(0)}</span>
                <span style={{ fontSize: 11, color: bandColor(s.readiness_band) }}>{s.readiness_band.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                Horizon ~ {s.recommended_horizon_months ?? '—'}mo · Gaps: {s.development_gaps?.slice(0, 2).map(g => g.competency).join(', ')}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Strategic Capability Gaps (enterprise-wide)">
        {gaps.slice(0, 8).map(g => (
          <div key={g.competency_id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 80px 1fr 120px 160px', gap: 8, padding: '8px 0', borderTop: `1px solid ${C.border}`, fontSize: 12 }}>
            <div style={{ color: C.text }}>{g.canonical_name}</div>
            <div style={{ color: bandColor(g.gap_indicator) }}>{g.enterprise_index.toFixed(1)}</div>
            <div>
              <div style={{ height: 5, background: '#1d2330', borderRadius: 2 }}>
                <div style={{ height: 5, width: `${Math.min(100, g.enterprise_index)}%`, background: bandColor(g.gap_indicator), borderRadius: 2 }} />
              </div>
            </div>
            <div style={{ color: bandColor(g.gap_indicator) }}>{g.gap_indicator.replace(/_/g, ' ')}</div>
            <div style={{ color: C.muted }}>{g.affected_layers.slice(0, 2).join(', ')}</div>
          </div>
        ))}
      </Panel>

      <Panel title="Methodology Versions">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(meth).map(([k, v]) => (
            <span key={k} style={{ padding: '4px 8px', background: '#0d1116', border: `1px solid ${C.border}`,
              borderRadius: 12, fontSize: 11, color: C.muted }}>{k}<span style={{ color: C.accent }}> @{v}</span></span>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div style={{ background: C.panel, padding: 14, borderRadius: 8, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</div>
      <div style={{ fontSize: 24, color: accent, marginTop: 4, fontWeight: 600 }}>{value}</div>
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
