import { DashboardIntro } from '../components/career/DashboardIntro';
/**
 * Phase 4 — Workforce Analytics Dashboard.
 * Heatmaps · distribution · leadership pipeline · metrics.
 */
import { useEffect, useState } from 'react';

interface NavProps { onNavigate?: (screen: string) => void }

type Cell = { layer_id: string; layer_name: string; competency_id: string; canonical_name: string;
  mean_score: number; sample_size: number; intensity: number; capability_band: string };
type Metric = { metric_name: string; metric_value: number; band: string; sample_size: number };
type Dist = { competency_id: string; canonical_name: string; layers: number; weighted_mean: number; spread: number; total_sample: number };
type Pipeline = { layer_id: string; layer_name: string; strategic_density: number; aligned_density: number; developmental_density: number; sample_size: number };

const C = {
  bg: '#0b0d12', panel: '#11151c', border: '#1d2330', text: '#e6eaf2',
  muted: '#8c97ad', accent: '#7cf0c2', warm: '#f8b06a', warn: '#f87171',
  cool: '#5fa8ff', purple: '#a78bfa',
};

function bandColor(b: string): string {
  if (b === 'strategic' || b === 'aligned') return C.accent;
  if (b === 'progressing' || b === 'developing') return C.cool;
  if (b === 'foundational') return C.warm;
  return C.muted;
}
function intensityColor(score: number): string {
  if (score >= 75) return '#1f8a5f';
  if (score >= 65) return '#3aa97a';
  if (score >= 55) return '#7ac8a8';
  if (score >= 45) return '#d8b568';
  return '#e07c5a';
}

export default function WorkforceInsightsPage(_: NavProps) {
  const [cells, setCells] = useState<Cell[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [dist, setDist] = useState<Dist[]>([]);
  const [pipeline, setPipeline] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [h, m, d, p] = await Promise.all([
        fetch('/api/workforce/heatmap').then(r => r.json()),
        fetch('/api/workforce/metrics').then(r => r.json()),
        fetch('/api/workforce/distribution').then(r => r.json()),
        fetch('/api/workforce/pipeline').then(r => r.json()),
      ]);
      setCells(h.data?.heatmap ?? []);
      setMetrics(m.data?.metrics ?? []);
      setDist(d.data?.distribution ?? []);
      setPipeline(p.data?.pipeline ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ background: C.bg, color: C.muted, padding: 32, minHeight: '100vh' }}>Loading workforce analytics…</div>;

  const layers = Array.from(new Set(cells.map(c => c.layer_id))).map(id => cells.find(c => c.layer_id === id)!);
  const comps = Array.from(new Set(cells.map(c => c.competency_id))).slice(0, 13);
  const findCell = (l: string, c: string) => cells.find(x => x.layer_id === l && x.competency_id === c);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ padding: '24px 32px 8px' }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, color: C.muted, textTransform: 'uppercase' }}>Phase 4 · Workforce Analytics</div>
        <h1 style={{ fontSize: 28, margin: '6px 0' }}>Workforce Intelligence</h1>
        <div style={{ color: C.muted, fontSize: 13 }}>Organisational capability heatmap, distribution analysis, leadership pipeline.</div>
      </header>

      <DashboardIntro
        title="Workforce Insights"
        whatItIs="Organisation-wide capability heatmap (layers × competencies), distribution analysis and leadership pipeline readiness."
        whenToUse="For workforce planning, identifying capability gaps across the org, and prioritising L&D investment."
        audience="Admins · HR · People analytics"
      />

      <section style={{ padding: '12px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {metrics.slice(0, 4).map(m => (
          <div key={m.metric_name} style={{ background: C.panel, padding: 14, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              {m.metric_name.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: 26, color: bandColor(m.band), marginTop: 4, fontWeight: 600 }}>
              {Number.isFinite(m.metric_value) ? m.metric_value.toFixed(1) : '—'}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>n={m.sample_size} · {m.band}</div>
          </div>
        ))}
      </section>

      <section style={{ margin: '12px 32px', background: C.panel, padding: 18, borderRadius: 10, border: `1px solid ${C.border}` }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Organisational Capability Heatmap</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11, color: C.text }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: C.muted, fontWeight: 400 }}>Layer ↓ / Competency →</th>
                {comps.map(cid => {
                  const cell = cells.find(c => c.competency_id === cid);
                  return <th key={cid} style={{ padding: '4px 6px', color: C.muted, fontWeight: 400, minWidth: 70, textAlign: 'center', writingMode: 'horizontal-tb' }}>
                    {cell?.canonical_name.split(' ').slice(0, 2).join(' ')}
                  </th>;
                })}
              </tr>
            </thead>
            <tbody>
              {layers.map(l => (
                <tr key={l.layer_id}>
                  <td style={{ padding: '4px 8px', color: C.muted, whiteSpace: 'nowrap' }}>{l.layer_name}</td>
                  {comps.map(cid => {
                    const cell = findCell(l.layer_id, cid);
                    if (!cell) return <td key={cid} style={{ background: '#0d1116' }} />;
                    return <td key={cid} title={`${cell.canonical_name} · mean ${cell.mean_score.toFixed(1)} · n=${cell.sample_size}`}
                      style={{
                        background: intensityColor(cell.mean_score), color: '#0b0d12',
                        textAlign: 'center', padding: '8px 4px', fontWeight: 600, minWidth: 50,
                        borderRadius: 3,
                      }}>{cell.mean_score.toFixed(0)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ margin: '12px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: C.panel, padding: 18, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Leadership Pipeline by Layer</h3>
          {pipeline.map(p => (
            <div key={p.layer_id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.text, marginBottom: 4 }}>
                <span>{p.layer_name}</span>
                <span style={{ color: C.muted }}>n={p.sample_size}</span>
              </div>
              <div style={{ display: 'flex', height: 14, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${p.strategic_density}%`, background: C.accent }} title={`Strategic ${p.strategic_density}%`} />
                <div style={{ width: `${p.aligned_density}%`, background: C.cool }} title={`Aligned ${p.aligned_density}%`} />
                <div style={{ width: `${p.developmental_density}%`, background: C.warm }} title={`Developmental ${p.developmental_density}%`} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 11, color: C.muted, display: 'flex', gap: 12 }}>
            <Legend color={C.accent} label="Strategic" />
            <Legend color={C.cool} label="Aligned" />
            <Legend color={C.warm} label="Developmental" />
          </div>
        </div>

        <div style={{ background: C.panel, padding: 18, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Capability Distribution (sample-weighted)</h3>
          {dist.slice(0, 10).map(d => (
            <div key={d.competency_id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 60px', gap: 8, fontSize: 12, padding: '6px 0', borderTop: `1px solid ${C.border}` }}>
              <div>{d.canonical_name}</div>
              <div style={{ color: C.accent }}>{d.weighted_mean.toFixed(1)}</div>
              <div style={{ color: C.muted }}>spread {d.spread.toFixed(1)}</div>
              <div style={{ color: C.muted }}>n={d.total_sample}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />{label}
  </span>;
}
