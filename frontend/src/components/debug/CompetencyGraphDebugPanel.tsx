/**
 * Competency Graph Debug Panel — Phase 3.
 *
 * Internal-only diagnostic surface. Renders ONLY when `?debug=1` is in the URL
 * AND `competencyGraphRuntime` is ON. Never mounted in production user flows.
 */
import { useEffect, useState } from 'react';
import { competencyGraphService, type GraphFlagState } from '../../lib/services/competencyGraphService';

type Props = { userId?: string; defaultCompetencyId?: string };

export default function CompetencyGraphDebugPanel({ userId, defaultCompetencyId = 'systems-thinking' }: Props) {
  const debugOn = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  const [flag, setFlag] = useState<GraphFlagState | undefined>();
  const [versions, setVersions] = useState<Record<string, string> | undefined>();
  const [cid, setCid] = useState(defaultCompetencyId);
  const [hops, setHops] = useState(2);
  const [subview, setSubview] = useState<any>();
  const [blueprint, setBlueprint] = useState<any>();
  const [err, setErr] = useState<string | undefined>();

  useEffect(() => {
    if (!debugOn) return;
    void (async () => {
      const f = await competencyGraphService.flagState();
      setFlag(f.feature_flag);
      const v = await competencyGraphService.versions();
      setVersions(v.methodology_versions);
    })();
  }, [debugOn]);

  if (!debugOn) return null;
  if (!flag) return <div style={panel}>CompetencyGraph debug — loading flag state…</div>;
  if (!flag.competencyGraphRuntime) {
    return <div style={panel}>CompetencyGraph debug — competencyGraphRuntime OFF (panel inert).</div>;
  }

  const onTraverse = async () => {
    setErr(undefined);
    const r = await competencyGraphService.traverse(cid, hops);
    if (!r.ok) setErr(r.error); else setSubview((r.data as any)?.subview);
  };
  const onBlueprint = async () => {
    if (!userId) { setErr('userId required'); return; }
    setErr(undefined);
    const r = await competencyGraphService.blueprint(userId);
    if (!r.ok) setErr(r.error); else setBlueprint((r.data as any)?.envelope);
  };

  return (
    <div style={panel}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Competency Graph Debug Panel</div>
      <div style={row}><b>Flags</b><pre style={pre}>{JSON.stringify(flag, null, 2)}</pre></div>
      <div style={row}><b>Versions</b><pre style={pre}>{JSON.stringify(versions, null, 2)}</pre></div>
      <div style={row}>
        <b>Traverse</b>
        <input value={cid} onChange={(e) => setCid(e.target.value)} style={inp} placeholder="competencyId" />
        <input type="number" value={hops} onChange={(e) => setHops(Number(e.target.value) || 2)} style={{ ...inp, width: 60 }} />
        <button onClick={onTraverse} style={btn}>Traverse</button>
      </div>
      {subview && <div style={row}><b>Subview</b><pre style={pre}>{JSON.stringify(subview, null, 2)}</pre></div>}
      <div style={row}>
        <b>Blueprint</b>
        <button onClick={onBlueprint} style={btn} disabled={!userId}>Generate</button>
      </div>
      {blueprint && <div style={row}><b>Blueprint envelope</b><pre style={pre}>{JSON.stringify(blueprint, null, 2)}</pre></div>}
      {err && <div style={errSt}>error: {err}</div>}
    </div>
  );
}

const panel: React.CSSProperties = {
  position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
  width: 460, maxHeight: '70vh', overflow: 'auto',
  background: '#0b1020', color: '#e8ecf7', border: '1px solid #2a3358',
  borderRadius: 8, padding: 12, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
};
const row: React.CSSProperties = { marginBottom: 8 };
const pre: React.CSSProperties = { margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0a0f1c', padding: 6, borderRadius: 4 };
const btn: React.CSSProperties = { padding: '6px 10px', background: '#3b82f6', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer', marginLeft: 6 };
const inp: React.CSSProperties = { marginLeft: 6, padding: '3px 6px', background: '#0a0f1c', color: '#e8ecf7', border: '1px solid #2a3358', borderRadius: 4 };
const errSt: React.CSSProperties = { color: '#f87171', marginTop: 6 };
