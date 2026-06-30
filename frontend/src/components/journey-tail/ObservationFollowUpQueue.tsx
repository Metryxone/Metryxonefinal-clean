import { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useCustomerJourneyCompletion } from '../../hooks/useCustomerJourneyCompletion';

/**
 * CAPADEX 3.0 Phase 1.4 — GAP-J1 teacher/counsellor continuation.
 *
 * Closes the teacher/counsellor dead-end: once an observation is submitted, staff
 * can now SEE the submitted-observation follow-up queue and RESOLVE each item.
 * Pure REUSE of the already-shipped journey-tail endpoints:
 *   GET   /api/journey-tail/counsellor/follow-up-queue
 *   PATCH /api/journey-tail/observations/:id/follow-up   { status: 'resolved' }
 *
 * Gated by `customer_journey_completion` (this component) AND the journey-tail
 * flag (the endpoints 503 when journeyTailCompletion is OFF). When either is OFF
 * the component renders nothing → byte-identical absent.
 */

type Obs = {
  id: string;
  observer_type?: string | null;
  observer_name?: string | null;
  organization?: string | null;
  overall_rating?: number | null;
  follow_up_status?: string | null;
  created_at?: string | null;
};

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('metryx_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function ObservationFollowUpQueue() {
  const journeyCompletion = useCustomerJourneyCompletion();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [items, setItems] = useState<Obs[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/journey-tail/counsellor/follow-up-queue', {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!r.ok) { setAvailable(false); return; }
      const j = await r.json();
      setItems(Array.isArray(j?.observations) ? j.observations : []);
      setAvailable(j?.available !== false);
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => { if (journeyCompletion) load(); }, [journeyCompletion, load]);

  if (!journeyCompletion) return null; // byte-identical absent when flag OFF

  const resolve = async (id: string) => {
    setBusyId(id);
    try {
      const r = await fetch(`/api/journey-tail/observations/${id}/follow-up`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: 'resolved' }),
      });
      if (r.ok) await load();
    } catch { /* keep prior list; non-blocking */ } finally {
      setBusyId(null);
    }
  };

  // The endpoints honestly 503/empty when journey-tail is OFF → show nothing
  // rather than an empty shell, so OFF stays byte-identical and ON is meaningful.
  if (available === false) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm" data-testid="observation-followup-queue">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(11,60,93,0.06)' }}>
          <ClipboardCheck size={17} style={{ color: '#0B3C5D' }} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Observation Follow-ups</h3>
          <p className="text-[11px] text-gray-400">Submitted observations awaiting counsellor resolution</p>
        </div>
      </div>

      <div className="p-4">
        {available === null ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-6 justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading queue…
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 size={26} className="mx-auto mb-2 text-gray-300" />
            <p className="text-xs text-gray-400">No observations awaiting follow-up.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map(o => {
              const resolved = (o.follow_up_status || '').toLowerCase() === 'resolved';
              return (
                <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-800 truncate capitalize">
                        {(o.observer_type || 'teacher').replace(/_/g, ' ')}
                        {o.observer_name ? ` · ${o.observer_name}` : ''}
                      </p>
                      {!resolved && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: '#DC2626' }}>
                          <AlertCircle size={11} /> Flagged
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">
                      {o.organization ? `${o.organization} · ` : ''}
                      {typeof o.overall_rating === 'number' ? `${o.overall_rating}/5 overall` : 'observation'}
                    </p>
                  </div>
                  {resolved ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 shrink-0">
                      <CheckCircle2 size={13} /> Resolved
                    </span>
                  ) : (
                    <button
                      onClick={() => resolve(o.id)}
                      disabled={busyId === o.id}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                      style={{ background: '#0B3C5D' }}
                      data-testid={`button-resolve-observation-${o.id}`}
                    >
                      {busyId === o.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Resolve
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
