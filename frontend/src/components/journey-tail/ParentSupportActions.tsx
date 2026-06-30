/**
 * Task #293 — Journey Tail Completion (Parent tail).
 *
 * Downstream step for the Parent journey: after viewing a child's status, the parent
 * (a) sees observations a teacher/counsellor explicitly shared with them and can acknowledge /
 * mark them actioned (effect surfaced back to the counsellor follow-up queue), and
 * (b) logs concrete support actions, which they can advance through a small status loop.
 *
 * Gated entirely by the `/api/journey-tail/enabled` probe (flag `journeyTailCompletion`).
 * When the flag is OFF the probe 503s → this component renders NOTHING, so the parent
 * dashboard is byte-identical to its prior behaviour. All data is REAL (no fabrication);
 * empty arrays render an honest empty state (null ≠ 0).
 */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Plus, ClipboardList, MessageSquareText } from 'lucide-react';

interface Props {
  childId: string;
  childName: string;
}

const ACTION_TYPES: { value: string; label: string }[] = [
  { value: 'acknowledge_status', label: 'Acknowledge current status' },
  { value: 'set_focus_area', label: 'Set a focus area' },
  { value: 'request_mentor', label: 'Request a mentor / coach' },
  { value: 'log_support', label: 'Log support given at home' },
  { value: 'schedule_review', label: 'Schedule a follow-up review' },
];

const ACTION_STATUS_NEXT: Record<string, { next: string; label: string }> = {
  open: { next: 'in_progress', label: 'Start' },
  in_progress: { next: 'done', label: 'Mark done' },
};

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export function ParentSupportActions({ childId, childName }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [actionType, setActionType] = useState(ACTION_TYPES[0].value);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  // Probe the flag once. OFF → render nothing (byte-identical).
  useEffect(() => {
    let alive = true;
    fetch('/api/journey-tail/enabled', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive) setEnabled(!!j?.enabled); })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, []);

  const load = useCallback(() => {
    if (!enabled || !childId) return;
    fetch(`/api/journey-tail/parent/support-actions?childId=${encodeURIComponent(childId)}`, { credentials: 'include', headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(j => setActions(Array.isArray(j?.actions) ? j.actions : []))
      .catch(() => setActions([]));
    fetch('/api/journey-tail/parent/observations', { credentials: 'include', headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(j => setObservations((Array.isArray(j?.observations) ? j.observations : []).filter((o: any) => String(o.child_id) === String(childId))))
      .catch(() => setObservations([]));
  }, [enabled, childId]);

  useEffect(() => { load(); }, [load]);

  const addAction = () => {
    if (busy) return;
    setBusy(true);
    fetch('/api/journey-tail/parent/support-actions', {
      method: 'POST', headers: authHeaders(), credentials: 'include',
      body: JSON.stringify({ child_id: childId, action_type: actionType, title: title || null, note: note || null, source_context: 'parent_dashboard' }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(() => { setTitle(''); setNote(''); setShowForm(false); load(); })
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  const advanceAction = (id: string, next: string) => {
    fetch(`/api/journey-tail/parent/support-actions/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: authHeaders(), credentials: 'include',
      body: JSON.stringify({ status: next }),
    }).then(() => load()).catch(() => {});
  };

  const ackObservation = (id: string, status: 'acknowledged' | 'actioned') => {
    fetch(`/api/journey-tail/parent/observations/${encodeURIComponent(id)}/status`, {
      method: 'POST', headers: authHeaders(), credentials: 'include',
      body: JSON.stringify({ status }),
    }).then(() => load()).catch(() => {});
  };

  // Flag OFF (or still probing) → render nothing, byte-identical dashboard.
  if (!enabled) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-5" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} style={{ color: '#0B3C5D' }} />
          <h3 className="text-sm font-bold text-gray-900">Support actions for {childName}</h3>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: '#0B3C5D' }}>
          <Plus size={13} /> New action
        </button>
      </div>

      {/* Observations shared by a teacher / counsellor (the continuation back to the parent). */}
      {observations.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold tracking-wide uppercase text-gray-400 flex items-center gap-1">
            <MessageSquareText size={12} /> Shared with you
          </p>
          {observations.map(o => (
            <div key={o.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-800 capitalize">{String(o.observer_type || 'teacher').replace('_', ' ')} observation</span>
                {o.overall_rating != null && <span className="text-[11px] font-bold" style={{ color: '#0B3C5D' }}>{o.overall_rating}/5</span>}
              </div>
              {o.concerns && <p className="text-[11px] text-gray-600 mb-0.5"><strong>Concerns:</strong> {o.concerns}</p>}
              {o.recommendations && <p className="text-[11px] text-gray-600 mb-1"><strong>Recommendations:</strong> {o.recommendations}</p>}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{ background: o.follow_up_status === 'open' ? 'rgba(239,68,68,0.1)' : 'rgba(78,205,196,0.12)', color: o.follow_up_status === 'open' ? '#DC2626' : '#0B3C5D' }}>
                  {String(o.follow_up_status || 'open').replace('_', ' ')}
                </span>
                {o.follow_up_status === 'open' && (
                  <button onClick={() => ackObservation(o.id, 'acknowledged')} className="text-[11px] font-semibold text-gray-500 hover:text-gray-800">Acknowledge</button>
                )}
                {(o.follow_up_status === 'open' || o.follow_up_status === 'acknowledged') && (
                  <button onClick={() => ackObservation(o.id, 'actioned')} className="text-[11px] font-semibold" style={{ color: '#0B3C5D' }}>Mark actioned</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/50">
          <select value={actionType} onChange={e => setActionType(e.target.value)}
            className="w-full h-9 px-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none">
            {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)"
            className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" rows={2}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none resize-none" />
          <button disabled={busy} onClick={addAction}
            className="w-full text-xs font-semibold py-2 rounded-lg text-white disabled:opacity-50" style={{ background: '#4ECDC4' }}>
            {busy ? 'Saving…' : 'Save action'}
          </button>
        </div>
      )}

      {/* The parent's own action loop. */}
      {actions.length === 0 ? (
        <p className="text-xs text-gray-400">No support actions logged yet. Use “New action” to start one.</p>
      ) : (
        <div className="space-y-2">
          {actions.map(a => {
            const step = ACTION_STATUS_NEXT[a.status];
            return (
              <div key={a.id} className="flex items-start justify-between border border-gray-100 rounded-xl p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{a.title || ACTION_TYPES.find(t => t.value === a.action_type)?.label || a.action_type}</p>
                  {a.note && <p className="text-[11px] text-gray-500 mt-0.5">{a.note}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{ background: a.status === 'done' ? 'rgba(78,205,196,0.12)' : 'rgba(11,60,93,0.06)', color: a.status === 'done' ? '#0B3C5D' : '#64748B' }}>
                    {String(a.status).replace('_', ' ')}
                  </span>
                  {a.status === 'done' ? (
                    <CheckCircle size={14} style={{ color: '#4ECDC4' }} />
                  ) : step ? (
                    <button onClick={() => advanceAction(a.id, step.next)} className="text-[11px] font-semibold" style={{ color: '#0B3C5D' }}>{step.label}</button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
