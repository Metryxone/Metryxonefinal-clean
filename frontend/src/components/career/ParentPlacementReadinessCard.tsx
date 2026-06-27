/**
 * MX-302H — Parent placement-readiness card (flag-gated, additive).
 *
 * Surfaces a child's career/placement readiness to a consenting parent by calling
 * the institutional-intelligence parent endpoint:
 *   GET /api/institutional-intelligence/parent/readiness/:childId
 *
 * Honesty / byte-identical-OFF contract:
 *   - It self-probes `/api/institutional-intelligence/enabled`. When the flag is
 *     OFF (or the probe fails) it renders NOTHING — the parent dashboard stays
 *     byte-identical to its prior behaviour.
 *   - DPDP consent / parent-child linkage is enforced server-side; an
 *     unauthorised or unlinked child renders an honest "not available" state.
 *   - null ≠ 0: a missing score renders "—", never 0. Nothing is fabricated.
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, Info } from 'lucide-react';

interface Props { childId?: string | null; childName?: string | null; }

interface ReadinessState { status: 'idle' | 'loading' | 'ok' | 'hidden'; data: any | null; }

function fmt(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v);
}

export default function ParentPlacementReadinessCard({ childId, childName }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [state, setState] = useState<ReadinessState>({ status: 'idle', data: null });

  // Probe the flag once — OFF renders nothing (byte-identical).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/institutional-intelligence/enabled', { credentials: 'include' });
        const body = await res.json().catch(() => null);
        if (alive) setEnabled(!!body?.enabled);
      } catch {
        if (alive) setEnabled(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!enabled || !childId) { setState({ status: 'idle', data: null }); return; }
    let alive = true;
    setState({ status: 'loading', data: null });
    (async () => {
      try {
        const res = await fetch(`/api/institutional-intelligence/parent/readiness/${encodeURIComponent(childId)}`, { credentials: 'include' });
        if (res.status === 403 || res.status === 503) { if (alive) setState({ status: 'hidden', data: null }); return; }
        const body = await res.json().catch(() => null);
        if (alive) setState({ status: 'ok', data: body });
      } catch {
        if (alive) setState({ status: 'hidden', data: null });
      }
    })();
    return () => { alive = false; };
  }, [enabled, childId]);

  // Flag OFF, probe pending, or endpoint unavailable → render nothing.
  if (enabled !== true || state.status === 'hidden') return null;

  const data = state.data;
  const rd = data?.readiness;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} className="text-emerald-600" />
        <h3 className="text-sm font-semibold text-gray-800">
          Career &amp; Placement Readiness{childName ? ` — ${childName}` : ''}
        </h3>
      </div>

      {state.status === 'loading' && (
        <div className="text-[11px] text-gray-400">Loading readiness…</div>
      )}

      {state.status === 'ok' && data && !data.available && (
        <div className="rounded-xl px-3 py-2.5 flex items-start gap-2 text-[11px] font-medium"
          style={{ backgroundColor: '#eff6ff', color: '#1e40af' }}>
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>{(data.notes && data.notes[0]) || 'Placement readiness is not available for this child yet.'}</span>
        </div>
      )}

      {state.status === 'ok' && data?.available && rd && (
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="text-3xl font-bold text-emerald-600">{fmt(rd.overall_score)}</div>
            <div className="text-[11px] text-gray-500 pb-1">{rd.band ?? '—'}{rd.measurable ? '' : ' · provisional'}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Current', val: rd.blocks?.current },
              { label: 'Future', val: rd.blocks?.future },
              { label: 'Role Fit', val: rd.blocks?.role },
              { label: 'Growth', val: rd.blocks?.growth },
            ].map((b) => (
              <div key={b.label} className="rounded-xl border border-gray-100 p-3">
                <div className="text-base font-bold text-gray-800">{fmt(b.val)}</div>
                <div className="text-[9px] text-gray-400 mt-0.5">{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
