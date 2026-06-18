/**
 * Role DNA Debug Panel — Phase 2.
 *
 * Internal-only diagnostic surface. Renders ONLY when `?debug=1` is in the URL
 * AND `roleDNARuntimeEnabled` is ON. Never mounted in production user flows.
 */
import { useEffect, useState } from 'react';
import { roleDNAService, type RoleDNAFlagState, type ResolveRoleRequest } from '../../lib/services/roleDNAService';

type Props = { defaultRoleTitle?: string };

export default function RoleDNADebugPanel({ defaultRoleTitle = 'Backend Engineer' }: Props) {
  const [flag, setFlag] = useState<RoleDNAFlagState | undefined>();
  const [versions, setVersions] = useState<Record<string, string> | undefined>();
  const [profile, setProfile] = useState<any>();
  const [stats, setStats] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const [form, setForm] = useState<ResolveRoleRequest>({
    roleTitle: defaultRoleTitle, industry: 'Technology',
    orgMaturity: 'startup', orgLayer: 'IC', careerStage: 'mid',
    experienceYears: 4, workArrangement: 'remote',
  });

  const debugOn = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

  useEffect(() => {
    if (!debugOn) return;
    void (async () => {
      const f = await roleDNAService.flagState();
      setFlag(f.feature_flag);
      const v = await roleDNAService.versions();
      setVersions(v.methodology_versions);
      const s = await roleDNAService.cacheStats();
      if (s.ok) setStats((s.data as any)?.stats);
    })();
  }, [debugOn]);

  if (!debugOn) return null;
  if (!flag) return <div style={panel}>RoleDNA debug — loading flag state…</div>;
  if (!flag.roleDNARuntimeEnabled) {
    return <div style={panel}>RoleDNA debug — roleDNARuntimeEnabled OFF (panel inert).</div>;
  }

  const onResolve = async () => {
    setBusy(true); setErr(undefined);
    const r = await roleDNAService.resolve(form);
    setBusy(false);
    if (!r.ok) setErr(r.error); else setProfile((r.data as any)?.profile);
  };

  return (
    <div style={panel}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Role DNA Debug Panel</div>
      <div style={row}><b>Flags</b><pre style={pre}>{JSON.stringify(flag, null, 2)}</pre></div>
      <div style={row}><b>Versions</b><pre style={pre}>{JSON.stringify(versions, null, 2)}</pre></div>
      <div style={row}><b>Cache</b><pre style={pre}>{JSON.stringify(stats, null, 2)}</pre></div>
      <div style={row}>
        <b>Role Title</b>
        <input value={form.roleTitle} onChange={(e) => setForm({ ...form, roleTitle: e.target.value })} style={inp} />
      </div>
      <div style={row}>
        <b>Industry / Layer / Stage</b>
        <input placeholder="industry" value={form.industry ?? ''} onChange={(e) => setForm({ ...form, industry: e.target.value })} style={inp} />
        <input placeholder="layer"    value={form.orgLayer ?? ''} onChange={(e) => setForm({ ...form, orgLayer: e.target.value })} style={inp} />
        <input placeholder="stage"    value={form.careerStage ?? ''} onChange={(e) => setForm({ ...form, careerStage: e.target.value })} style={inp} />
      </div>
      <button onClick={onResolve} disabled={busy} style={btn}>{busy ? 'Resolving…' : 'Resolve Role DNA'}</button>
      {err && <div style={errSt}>error: {err}</div>}
      {profile && <div style={row}><b>Resolved Profile</b><pre style={pre}>{JSON.stringify(profile, null, 2)}</pre></div>}
    </div>
  );
}

const panel: React.CSSProperties = {
  position: 'fixed', bottom: 16, left: 16, zIndex: 9999,
  width: 460, maxHeight: '70vh', overflow: 'auto',
  background: '#0b1020', color: '#e8ecf7', border: '1px solid #2a3358',
  borderRadius: 8, padding: 12, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
};
const row: React.CSSProperties = { marginBottom: 8 };
const pre: React.CSSProperties = { margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0a0f1c', padding: 6, borderRadius: 4 };
const btn: React.CSSProperties = { padding: '6px 10px', background: '#3b82f6', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer' };
const inp: React.CSSProperties = { marginLeft: 6, padding: '3px 6px', background: '#0a0f1c', color: '#e8ecf7', border: '1px solid #2a3358', borderRadius: 4 };
const errSt: React.CSSProperties = { color: '#f87171', marginTop: 6 };
