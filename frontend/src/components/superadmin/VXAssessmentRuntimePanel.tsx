import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface RuntimeOverview { integrity_distribution: { trust_verdict: string; count: number; avg_score: number }[]; top_flag_types: { event_type: string; count: number }[]; device_breakdown: { browser_name: string; count: number }[]; }
interface ProctoringFlag { id: number; event_type: string; severity: string; is_flagged: boolean; auto_flagged: boolean; server_timestamp: string; }
interface IntegrityReport { session_id: string; total_events: number; flagged_events: number; critical_flags: number; integrity_score: number; trust_verdict: string; }

const VERDICT_COLORS: Record<string, string> = { trusted: 'bg-green-100 text-green-800', review_required: 'bg-amber-100 text-amber-800', suspicious: 'bg-orange-100 text-orange-800', rejected: 'bg-red-100 text-red-800' };
const SEV_COLORS: Record<string, string> = { critical: 'bg-red-100 text-red-700', warning: 'bg-amber-100 text-amber-700', info: 'bg-blue-100 text-blue-700' };

export default function VXAssessmentRuntimePanel() {
  const [tab, setTab] = useState<'overview' | 'session-lookup'>('overview');
  const [overview, setOverview] = useState<RuntimeOverview | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [flags, setFlags] = useState<ProctoringFlag[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/vx/assessment-runtime/overview').then(r => r.json()).then(d => { setOverview(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const lookupSession = () => {
    if (!sessionId.trim()) return;
    setLookupLoading(true);
    Promise.all([
      fetch(`/api/caf/sessions/${sessionId}/proctoring/flags`).then(r => r.json()).catch(() => ({ flags: [] })),
      fetch(`/api/caf/sessions/${sessionId}/proctoring/log`).then(r => r.json()).catch(() => ({ integrity: null })),
    ]).then(([f, l]) => {
      setFlags(f.flags || []);
      setIntegrity(l.integrity || null);
      setLookupLoading(false);
    });
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Assessment Runtime…</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Assessment Runtime Platform <span className="text-sm font-normal text-gray-500 ml-2">VX-D7A</span></h2>
          <p className="text-sm text-gray-500 mt-1">Proctoring framework · device tracking · runtime audit · integrity scoring</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === 'overview' ? 'default' : 'outline'} size="sm" onClick={() => setTab('overview')}>Overview</Button>
          <Button variant={tab === 'session-lookup' ? 'default' : 'outline'} size="sm" onClick={() => setTab('session-lookup')}>Session Lookup</Button>
        </div>
      </div>

      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Integrity Verdicts</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(overview.integrity_distribution || []).map(d => (
                <div key={d.trust_verdict} className="text-center p-4 rounded-lg border">
                  <Badge className={VERDICT_COLORS[d.trust_verdict] || 'bg-gray-100'}>{d.trust_verdict.replace(/_/g, ' ')}</Badge>
                  <div className="text-2xl font-bold mt-2">{d.count}</div>
                  <div className="text-xs text-gray-500">Avg: {d.avg_score}/100</div>
                </div>
              ))}
              {!(overview.integrity_distribution?.length) && <div className="col-span-4 text-center text-gray-400 py-6">No sessions assessed yet</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Top Flag Types</h3>
              <div className="space-y-3">
                {(overview.top_flag_types || []).map(f => (
                  <div key={f.event_type} className="flex justify-between items-center">
                    <span className="text-sm capitalize">{f.event_type.replace(/_/g, ' ')}</span>
                    <Badge variant="outline">{f.count}</Badge>
                  </div>
                ))}
                {!(overview.top_flag_types?.length) && <div className="text-gray-400 text-sm">No flags recorded</div>}
              </div>
            </div>
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Browser Distribution</h3>
              <div className="space-y-3">
                {(overview.device_breakdown || []).map(d => (
                  <div key={d.browser_name} className="flex justify-between">
                    <span className="text-sm">{d.browser_name}</span>
                    <Badge variant="outline">{d.count}</Badge>
                  </div>
                ))}
                {!(overview.device_breakdown?.length) && <div className="text-gray-400 text-sm">No devices registered</div>}
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <h3 className="font-semibold text-indigo-800 mb-2">Proctoring Event Types</h3>
            <div className="flex flex-wrap gap-2">
              {['tab_switch', 'window_blur', 'multiple_faces_detected', 'no_face_detected', 'copy_attempt', 'screenshot_attempt', 'fullscreen_exit', 'idle_timeout', 'page_reload'].map(e => (
                <Badge key={e} variant="outline" className="text-xs">{e.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'session-lookup' && (
        <div className="space-y-6">
          <div className="flex gap-3">
            <Input placeholder="Enter session ID…" value={sessionId} onChange={e => setSessionId(e.target.value)} className="max-w-md" onKeyDown={e => e.key === 'Enter' && lookupSession()} />
            <Button onClick={lookupSession} disabled={lookupLoading}>{lookupLoading ? 'Loading…' : 'Look Up'}</Button>
          </div>

          {integrity && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold mb-3">Integrity Report: {integrity.session_id}</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { l: 'Total Events', v: integrity.total_events },
                  { l: 'Flagged Events', v: integrity.flagged_events },
                  { l: 'Critical Flags', v: integrity.critical_flags },
                  { l: 'Integrity Score', v: `${integrity.integrity_score}/100` },
                ].map(s => <div key={s.l} className="text-center p-3 bg-gray-50 rounded-lg"><div className="font-bold text-lg">{s.v}</div><div className="text-xs text-gray-500">{s.l}</div></div>)}
                <div className="flex items-center justify-center"><Badge className={VERDICT_COLORS[integrity.trust_verdict] || 'bg-gray-100'} >{integrity.trust_verdict.replace(/_/g, ' ')}</Badge></div>
              </div>
            </div>
          )}

          {flags.length > 0 && (
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50"><h3 className="font-semibold text-gray-800">Flags ({flags.length})</h3></div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Event Type', 'Severity', 'Auto-Flagged', 'Timestamp'].map(h => <th key={h} className="px-4 py-2 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {flags.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 capitalize">{f.event_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2"><Badge className={SEV_COLORS[f.severity] || 'bg-gray-100'}>{f.severity}</Badge></td>
                      <td className="px-4 py-2">{f.auto_flagged ? '✓ Auto' : '— Manual'}</td>
                      <td className="px-4 py-2 text-gray-500">{new Date(f.server_timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
