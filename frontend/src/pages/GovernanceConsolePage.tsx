/**
 * Phase 5 — Governance Console.
 * Workflows · Pending reviews (approve/reject) · Methodology registry · Audit · Explainability log.
 */
import { useEffect, useState } from 'react';

interface NavProps { onNavigate?: (screen: string) => void }

type Workflow = { id: string; name: string; entity_type: string; version: string;
  steps: { step: string; required_role: string }[] };
type Review = { id: string; workflow_id: string; workflow_name: string; entity_type: string;
  entity_id: string; proposer: string; reviewer: string | null;
  status: string; change_diff: any; rationale: string | null;
  proposed_at: string; decided_at: string | null; next_step: string | null };
type Methodology = { id: string; methodology_name: string; version: string; valid_from: string;
  is_current: boolean; change_summary: string | null; approved_by: string | null };
type AuditEvent = { id: number; ts: string; actor: string | null; action: string;
  entity_type: string; entity_id: string | null; domain: string; outcome: string };
type Expl = { id: string; score_type: string; entity_id: string; score: number | null;
  methodology_version: string; confidence_tier: string | null; computed_at: string };

const C = { bg: '#0b0d12', panel: '#11151c', border: '#1d2330', text: '#e6eaf2',
  muted: '#8c97ad', accent: '#7cf0c2', warm: '#f8b06a', warn: '#f87171', cool: '#5fa8ff', purple: '#a78bfa' };

const statusColor = (s: string) =>
  s === 'approved' ? C.accent : s === 'rejected' ? C.warn : s === 'escalated' ? C.warm : C.cool;

const TABS = ['Workflows', 'Reviews', 'Methodologies', 'Audit', 'Explainability'] as const;
type Tab = typeof TABS[number];

export default function GovernanceConsolePage(_: NavProps) {
  const [tab, setTab] = useState<Tab>('Reviews');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [methodologies, setMethodologies] = useState<Methodology[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [expl, setExpl] = useState<Expl[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [w, r, m, a, e] = await Promise.all([
      fetch('/api/gov/workflows').then(r => r.json()),
      fetch('/api/gov/reviews').then(r => r.json()),
      fetch('/api/gov/methodologies').then(r => r.json()),
      fetch('/api/gov/audit?limit=50').then(r => r.json()),
      fetch('/api/gov/explainability/recent?limit=50').then(r => r.json()),
    ]);
    setWorkflows(w.data?.workflows ?? []);
    setReviews(r.data?.reviews ?? []);
    setMethodologies(m.data?.methodologies ?? []);
    setAudit(a.data?.events ?? []);
    setExpl(e.data?.explanations ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    setActionState(s => ({ ...s, [id]: 'pending' }));
    try {
      const r = await fetch(`/api/gov/reviews/${id}/decide`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewer: 'console_admin', decision, rationale: `${decision} via console` }),
      }).then(r => r.json());
      setActionState(s => ({ ...s, [id]: r.ok ? decision : `err: ${r.error}` }));
      await load();
    } catch (e: any) {
      setActionState(s => ({ ...s, [id]: 'err: ' + e.message }));
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ padding: '24px 32px 8px' }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, color: C.muted, textTransform: 'uppercase' }}>Phase 5 · Governance</div>
        <h1 style={{ fontSize: 28, margin: '6px 0' }}>Governance Console</h1>
        <div style={{ color: C.muted, fontSize: 13 }}>
          Approval workflows · methodology versioning · audit trail · per-score explainability.
        </div>
      </header>

      <nav style={{ padding: '0 32px', display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'transparent', color: tab === t ? C.accent : C.muted,
            border: 'none', padding: '12px 16px', fontSize: 13, cursor: 'pointer',
            borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent',
          }}>{t}</button>
        ))}
      </nav>

      {loading && <div style={{ padding: 32, color: C.muted }}>Loading…</div>}

      {!loading && tab === 'Workflows' && (
        <Section>
          <div style={{ display: 'grid', gap: 10 }}>
            {workflows.map(w => (
              <div key={w.id} style={{ padding: 14, background: C.panel, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, color: C.text }}>{w.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{w.entity_type} · v{w.version}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {w.steps.map((s, i) => (
                    <span key={i} style={{ padding: '4px 10px', background: '#0d1116', border: `1px solid ${C.border}`,
                      borderRadius: 12, fontSize: 11, color: C.muted }}>
                      {i + 1}. {s.step} <span style={{ color: C.cool }}>→ {s.required_role}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!loading && tab === 'Reviews' && (
        <Section>
          <div style={{ display: 'grid', gap: 10 }}>
            {reviews.map(r => (
              <div key={r.id} style={{ padding: 14, background: C.panel, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, color: C.text }}>{r.workflow_name}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      {r.entity_type} · <code style={{ color: C.cool }}>{r.entity_id}</code> · by {r.proposer}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: statusColor(r.status), padding: '4px 8px',
                    background: '#0d1116', border: `1px solid ${statusColor(r.status)}33`, borderRadius: 10 }}>{r.status}</span>
                </div>
                {r.rationale && <div style={{ marginTop: 8, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>{r.rationale}</div>}
                <pre style={{ marginTop: 8, padding: 8, background: '#0d1116', borderRadius: 4, fontSize: 11, color: C.cool,
                  overflowX: 'auto', border: `1px solid ${C.border}` }}>{JSON.stringify(r.change_diff, null, 2)}</pre>
                {r.status === 'pending' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                    <button onClick={() => decide(r.id, 'approved')} style={btn(C.accent)}>Approve</button>
                    <button onClick={() => decide(r.id, 'rejected')} style={btn(C.warn)}>Reject</button>
                    {actionState[r.id] && <span style={{ fontSize: 11, color: C.muted, alignSelf: 'center' }}>{actionState[r.id]}</span>}
                  </div>
                )}
              </div>
            ))}
            {reviews.length === 0 && <div style={{ color: C.muted, padding: 12 }}>No reviews.</div>}
          </div>
        </Section>
      )}

      {!loading && tab === 'Methodologies' && (
        <Section>
          <div style={{ display: 'grid', gap: 8 }}>
            {methodologies.map(m => (
              <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 1fr 120px', gap: 8,
                padding: '10px 14px', background: C.panel, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }}>
                <div style={{ color: C.text }}>{m.methodology_name}</div>
                <div style={{ color: C.accent }}>v{m.version}</div>
                <div style={{ color: m.is_current ? C.accent : C.muted }}>{m.is_current ? 'current' : 'historic'}</div>
                <div style={{ color: C.muted }}>{m.change_summary}</div>
                <div style={{ color: C.muted, textAlign: 'right' }}>{m.approved_by ?? '—'}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!loading && tab === 'Audit' && (
        <Section>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '170px 110px 1fr 1fr 80px',
              gap: 8, padding: '4px 12px', fontSize: 11, color: C.muted }}>
              <span>Timestamp</span><span>Domain</span><span>Action</span><span>Entity</span><span>Outcome</span>
            </div>
            {audit.map(e => (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '170px 110px 1fr 1fr 80px',
                gap: 8, padding: '6px 12px', background: C.panel, borderRadius: 4, fontSize: 11, color: C.text }}>
                <span style={{ color: C.muted }}>{e.ts.slice(0, 19).replace('T', ' ')}</span>
                <span style={{ color: C.cool }}>{e.domain}</span>
                <span>{e.action}</span>
                <span style={{ color: C.muted }}>{e.entity_type}/{e.entity_id ?? '—'}</span>
                <span style={{ color: e.outcome === 'success' ? C.accent : C.warn }}>{e.outcome}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!loading && tab === 'Explainability' && (
        <Section>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr 1fr 80px 100px 100px',
              gap: 8, padding: '4px 12px', fontSize: 11, color: C.muted }}>
              <span>Time</span><span>Score type</span><span>Entity</span><span>Score</span><span>Method v</span><span>Confidence</span>
            </div>
            {expl.map(e => (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 1fr 80px 100px 100px',
                gap: 8, padding: '6px 12px', background: C.panel, borderRadius: 4, fontSize: 11, color: C.text }}>
                <span style={{ color: C.muted }}>{e.computed_at.slice(0, 19).replace('T', ' ')}</span>
                <span style={{ color: C.cool }}>{e.score_type}</span>
                <span>{e.entity_id}</span>
                <span style={{ color: C.accent }}>{e.score?.toFixed(1) ?? '—'}</span>
                <span>{e.methodology_version}</span>
                <span style={{ color: C.purple }}>{e.confidence_tier ?? '—'}</span>
              </div>
            ))}
            {expl.length === 0 && <div style={{ color: C.muted, padding: 12 }}>No explainability log entries yet. Trigger a trajectory call to populate.</div>}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <section style={{ padding: '20px 32px' }}>{children}</section>;
}
function btn(color: string): React.CSSProperties {
  return { background: 'transparent', color, border: `1px solid ${color}55`,
    padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer' };
}
