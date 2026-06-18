/**
 * UCIP Debug Panel — Phase 1.
 *
 * Internal-only diagnostic surface. Renders ONLY when the URL has `?debug=1`
 * AND the foundation flag is ON. Never mounted in production user flows.
 *
 * Strictly read-only display — no mutations beyond an explicit Rebuild button.
 */
import { useEffect, useState } from 'react';
import { ucipService, type UcipFlagState } from '../../lib/services/ucipService';

type Props = { userId: string | null | undefined };

export default function UCIPDebugPanel({ userId }: Props) {
  const [flag, setFlag] = useState<UcipFlagState | undefined>();
  const [versions, setVersions] = useState<Record<string, string> | undefined>();
  const [profile, setProfile] = useState<any>();
  const [status, setStatus] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();

  const debugOn = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

  useEffect(() => {
    if (!debugOn) return;
    void (async () => {
      const f = await ucipService.flagState();
      setFlag(f.feature_flag);
      const v = await ucipService.versions();
      setVersions(v.methodology_versions);
    })();
  }, [debugOn]);

  useEffect(() => {
    if (!debugOn || !userId || !flag?.adaptiveIntelligenceFoundation) return;
    void (async () => {
      const s = await ucipService.status(userId);
      if (s.ok) setStatus((s.data as any)?.status);
      if (flag?.ucipEnabled) {
        const p = await ucipService.fetch(userId);
        if (p.ok) setProfile((p.data as any)?.profile);
        else setErr(p.error);
      }
    })();
  }, [debugOn, userId, flag]);

  if (!debugOn) return null;
  if (!flag) return <div style={panelStyle}>UCIP debug — loading flag state…</div>;
  if (!flag.adaptiveIntelligenceFoundation) {
    return <div style={panelStyle}>UCIP debug — foundation flag OFF (panel inert).</div>;
  }

  const onRebuild = async () => {
    if (!userId) return;
    setBusy(true); setErr(undefined);
    const r = await ucipService.rebuild(userId);
    setBusy(false);
    if (!r.ok) setErr(r.error);
    else {
      const s = await ucipService.status(userId);
      if (s.ok) setStatus((s.data as any)?.status);
      const p = await ucipService.fetch(userId);
      if (p.ok) setProfile((p.data as any)?.profile);
    }
  };

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>UCIP Debug Panel</div>
      <div style={kvRow}><b>Flags</b><pre style={pre}>{JSON.stringify(flag, null, 2)}</pre></div>
      <div style={kvRow}><b>Versions</b><pre style={pre}>{JSON.stringify(versions, null, 2)}</pre></div>
      {flag.ucipShadowMode && <div style={shadowBadge}>SHADOW MODE — no UI consumers.</div>}
      <button onClick={onRebuild} disabled={!flag.ucipEnabled || busy || !userId} style={btn}>
        {busy ? 'Rebuilding…' : 'Force rebuild'}
      </button>
      {err && <div style={errStyle}>error: {err}</div>}
      {status && <div style={kvRow}><b>Status</b><pre style={pre}>{JSON.stringify(status, null, 2)}</pre></div>}
      {profile && <div style={kvRow}><b>Profile</b><pre style={pre}>{JSON.stringify(profile, null, 2)}</pre></div>}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
  width: 420, maxHeight: '70vh', overflow: 'auto',
  background: '#0b1020', color: '#e8ecf7', border: '1px solid #2a3358',
  borderRadius: 8, padding: 12, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
};
const kvRow: React.CSSProperties = { marginBottom: 8 };
const pre: React.CSSProperties  = { margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0a0f1c', padding: 6, borderRadius: 4 };
const btn: React.CSSProperties  = { padding: '6px 10px', background: '#3b82f6', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer' };
const errStyle: React.CSSProperties = { color: '#f87171', marginTop: 6 };
const shadowBadge: React.CSSProperties = { background: '#3b2e08', color: '#fbbf24', padding: '4px 8px', borderRadius: 4, marginBottom: 8, fontWeight: 600 };
