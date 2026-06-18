/**
 * Phase 4 — Adaptive Causal Intelligence dashboard.
 * Causal recommendations · transfer cascade · sequencing · effectiveness.
 */
import { useEffect, useState } from 'react';

interface NavProps { onNavigate?: (screen: string) => void }

type Rec = {
  id: string; rank: number; intervention_title: string; intervention_kind: string;
  competency_name: string | null; sequence_position: number | null;
  is_ready_now: boolean; blocking_prereqs: string[];
  causal_score: number; expected_ei_lift: number;
  expected_ei_lift_lower: number; expected_ei_lift_upper: number;
  effort_hours: number; roi_score: number; confidence_tier: string;
  transfer_cascade: { competency_id: string; depth: number; propagated_strength: number }[];
  rationale: { base_effectiveness: string; sequencing: string; cascade: string; momentum?: string };
};

type Eff = { intervention_id: string; competency_id: string | null; n_observations: number;
  mean_competency_delta: number; mean_ei_delta: number; roi_score: number; confidence_tier: string };

const C = {
  bg: '#0b0d12', panel: '#11151c', border: '#1d2330', text: '#e6eaf2',
  muted: '#8c97ad', accent: '#7cf0c2', warm: '#f8b06a', warn: '#f87171',
  cool: '#5fa8ff', purple: '#a78bfa',
};

const tierColor = (t: string) =>
  t === 'A' ? C.accent : t === 'B' ? C.cool : t === 'C' ? C.warm :
  t === 'D' ? C.warn : C.muted;

export default function AdaptiveCausalPage(_: NavProps) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [eff, setEff] = useState<Eff[]>([]);
  const [versions, setVersions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [r, e] = await Promise.all([
          fetch(`/api/adaptive/recommendations?demo=true&limit=8`).then(x => x.json()),
          fetch(`/api/adaptive/interventions/effectiveness?profile_segment=global`).then(x => x.json()),
        ]);
        setRecs(r.recommendations ?? []);
        setVersions(r.methodology_versions ?? {});
        setEff(e.rows ?? []);
      } catch (ex: any) { setErr(String(ex?.message ?? ex)); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={S.shell}>Loading adaptive causal intelligence…</div>;
  if (err) return <div style={{ ...S.shell, color: C.warn }}>Error: {err}</div>;

  return (
    <div style={S.shell}>
      <header style={S.header}>
        <div>
          <h1 style={S.h1}>Adaptive Causal Intelligence</h1>
          <div style={S.sub}>
            Self-improving recommendations · transfer cascade · sequenced development.
            Developmental guidance only — no hiring or promotion predictions.
          </div>
        </div>
        <div style={S.versionStrip}>
          {Object.entries(versions).map(([k, v]) =>
            <span key={k} style={S.vchip}>{k}: {v}</span>)}
        </div>
      </header>

      <section style={S.section}>
        <h2 style={S.h2}>Causal recommendations</h2>
        <div style={S.grid}>
          {recs.map(rec => (
            <article key={rec.id} style={S.recCard}>
              <div style={S.recHead}>
                <span style={S.rank}>#{rec.rank}</span>
                <span style={{ ...S.tierPill, color: tierColor(rec.confidence_tier),
                  borderColor: tierColor(rec.confidence_tier) }}>
                  tier {rec.confidence_tier}
                </span>
                {rec.is_ready_now
                  ? <span style={{ ...S.readyPill, color: C.accent, borderColor: C.accent }}>ready now</span>
                  : <span style={{ ...S.readyPill, color: C.warm, borderColor: C.warm }}>sequenced</span>}
              </div>
              <h3 style={S.recTitle}>{rec.intervention_title}</h3>
              <div style={S.muted}>{rec.competency_name ?? '—'} · {rec.intervention_kind}</div>

              <div style={S.metrics}>
                <Metric label="Causal score" value={rec.causal_score.toFixed(3)} />
                <Metric label="Expected EI lift"
                  value={`+${rec.expected_ei_lift.toFixed(1)} pts`}
                  hint={`[${rec.expected_ei_lift_lower.toFixed(1)} – ${rec.expected_ei_lift_upper.toFixed(1)}]`} />
                <Metric label="ROI" value={rec.roi_score.toFixed(2)} />
                <Metric label="Effort" value={`${rec.effort_hours}h`} />
              </div>

              {rec.transfer_cascade.length > 0 && (
                <div style={S.cascadeBox}>
                  <div style={S.cascadeTitle}>Transfer cascade ({rec.transfer_cascade.length})</div>
                  {rec.transfer_cascade.map(c => (
                    <div key={c.competency_id} style={S.cascadeRow}>
                      <span style={S.cascadeId}>{c.competency_id.replace(/^comp_/, '')}</span>
                      <span style={{ ...S.cascadeBar,
                        width: `${Math.min(100, c.propagated_strength * 100)}%`,
                        background: C.purple, opacity: 0.4 + c.propagated_strength * 0.6 }} />
                      <span style={S.cascadeStrength}>{c.propagated_strength.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <ul style={S.rationale}>
                <li><b>Why:</b> {rec.rationale.base_effectiveness}</li>
                <li><b>Sequence:</b> {rec.rationale.sequencing}</li>
                <li><b>Cascade:</b> {rec.rationale.cascade}</li>
                {rec.rationale.momentum && <li><b>Momentum:</b> {rec.rationale.momentum}</li>}
              </ul>
            </article>
          ))}
          {recs.length === 0 && <div style={S.muted}>No recommendations available yet.</div>}
        </div>
      </section>

      <section style={S.section}>
        <h2 style={S.h2}>Intervention effectiveness — observed outcomes</h2>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Intervention</th><th style={S.th}>Competency</th>
              <th style={S.th}>n</th><th style={S.th}>Mean Δ competency</th>
              <th style={S.th}>Mean Δ EI</th><th style={S.th}>ROI</th><th style={S.th}>Tier</th>
            </tr></thead>
            <tbody>
              {eff.map((row, i) => (
                <tr key={i} style={S.tr}>
                  <td style={S.td}>{row.intervention_id.replace(/^int_/, '')}</td>
                  <td style={S.td}>{row.competency_id?.replace(/^comp_/, '') ?? '—'}</td>
                  <td style={S.td}>{row.n_observations}</td>
                  <td style={S.td}>{row.mean_competency_delta?.toFixed(2) ?? '—'}</td>
                  <td style={S.td}>{row.mean_ei_delta?.toFixed(2) ?? '—'}</td>
                  <td style={S.td}>{row.roi_score?.toFixed(3) ?? '—'}</td>
                  <td style={{ ...S.td, color: tierColor(row.confidence_tier) }}>{row.confidence_tier}</td>
                </tr>
              ))}
              {eff.length === 0 && <tr><td colSpan={7} style={S.td}>No effectiveness data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={S.metric}>
      <div style={S.metricLabel}>{label}</div>
      <div style={S.metricValue}>{value}</div>
      {hint && <div style={S.metricHint}>{hint}</div>}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  shell: { background: C.bg, color: C.text, minHeight: '100vh', padding: '32px 40px',
    fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 32, gap: 24, flexWrap: 'wrap' },
  h1: { fontSize: 28, margin: 0, fontWeight: 600 },
  sub: { color: C.muted, marginTop: 8, fontSize: 14, maxWidth: 640 },
  versionStrip: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  vchip: { fontSize: 11, color: C.muted, border: `1px solid ${C.border}`,
    padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' },
  section: { marginBottom: 40 },
  h2: { fontSize: 18, fontWeight: 500, marginBottom: 16, color: C.text },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 },
  recCard: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 },
  recHead: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  rank: { fontSize: 16, fontWeight: 600, color: C.accent },
  tierPill: { fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid', fontFamily: 'monospace' },
  readyPill: { fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid' },
  recTitle: { fontSize: 16, margin: '4px 0', fontWeight: 500 },
  muted: { color: C.muted, fontSize: 13 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, margin: '16px 0' },
  metric: { background: C.bg, padding: 10, borderRadius: 4, border: `1px solid ${C.border}` },
  metricLabel: { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 16, marginTop: 4, color: C.text, fontWeight: 500 },
  metricHint: { fontSize: 11, color: C.muted, marginTop: 2, fontFamily: 'monospace' },
  cascadeBox: { background: C.bg, padding: 10, borderRadius: 4, border: `1px solid ${C.border}`,
    marginBottom: 12 },
  cascadeTitle: { fontSize: 11, color: C.muted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 6 },
  cascadeRow: { display: 'grid', gridTemplateColumns: '140px 1fr 40px',
    alignItems: 'center', gap: 8, marginBottom: 3, fontSize: 12 },
  cascadeId: { fontFamily: 'monospace', color: C.text, fontSize: 11 },
  cascadeBar: { height: 8, borderRadius: 2 },
  cascadeStrength: { fontFamily: 'monospace', color: C.muted, fontSize: 11, textAlign: 'right' },
  rationale: { listStyle: 'none', padding: 0, margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 },
  tableWrap: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 14px', color: C.muted, fontWeight: 500,
    borderBottom: `1px solid ${C.border}`, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  tr: { borderBottom: `1px solid ${C.border}` },
  td: { padding: '10px 14px', color: C.text },
};
