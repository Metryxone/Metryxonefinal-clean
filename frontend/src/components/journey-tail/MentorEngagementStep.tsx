/**
 * Task #293 — Journey Tail Completion (Mentor/Coach tail).
 *
 * Post-match engagement step shown AFTER a seeker books a real mentor (mentor_profiles +
 * mentor_bookings, surfaced in the Career Builder "Mentor Connect" tab). The matched
 * relationship no longer dead-ends at the booking request: the seeker can log lightweight
 * check-ins / goals against the real mentor_profile_id, and sees the running thread
 * (including any guidance the mentor posts back). ONE substrate, two labels (seeker vs
 * mentor) — the same engagement records render on either side.
 *
 * Gated by `/api/journey-tail/enabled` (flag `journeyTailCompletion`). OFF → renders
 * nothing → byte-identical booking flow. All data REAL; empty thread = honest empty state.
 */
import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';

interface Props {
  mentorProfileId: string;
  mentorName: string;
  bookingRef?: string | null;
}

const KINDS: { value: string; label: string }[] = [
  { value: 'check_in', label: 'Check-in' },
  { value: 'next_session_goal', label: 'Goal for next session' },
  { value: 'milestone', label: 'Milestone reached' },
];

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export function MentorEngagementStep({ mentorProfileId, mentorName, bookingRef }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [kind, setKind] = useState(KINDS[0].value);
  const [note, setNote] = useState('');
  const [nextGoal, setNextGoal] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/journey-tail/enabled', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive) setEnabled(!!j?.enabled); })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, []);

  const load = useCallback(() => {
    if (!enabled) return;
    // No params → the backend returns the authed seeker's OWN engagement thread; filter to this mentor.
    fetch('/api/journey-tail/mentor/engagements', { credentials: 'include', headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(j => setItems((Array.isArray(j?.engagements) ? j.engagements : []).filter((e: any) => String(e.mentor_profile_id) === String(mentorProfileId))))
      .catch(() => setItems([]));
  }, [enabled, mentorProfileId]);

  useEffect(() => { load(); }, [load]);

  const submit = () => {
    if (busy) return;
    setBusy(true);
    // seeker_id is omitted — the backend forces it to the authed actor (no impersonation).
    fetch('/api/journey-tail/mentor/engagements', {
      method: 'POST', headers: authHeaders(), credentials: 'include',
      body: JSON.stringify({
        mentor_profile_id: mentorProfileId, booking_ref: bookingRef || null,
        kind, note: note || null, next_goal: nextGoal || null,
      }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(() => { setNote(''); setNextGoal(''); load(); })
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  if (!enabled) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      <p className="text-[11px] font-bold tracking-wide uppercase text-gray-400 flex items-center gap-1">
        <MessageCircle size={12} /> Stay engaged with {mentorName.split(' ')[0]}
      </p>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map(e => (
            <div key={e.id} className="rounded-lg px-2.5 py-1.5" style={{ background: e.author_role === 'mentor' ? 'rgba(78,205,196,0.1)' : 'rgba(11,60,93,0.05)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-500 capitalize">{e.author_role} · {String(e.kind).replace(/_/g, ' ')}</span>
              </div>
              {e.note && <p className="text-[11px] text-gray-700 mt-0.5">{e.note}</p>}
              {e.next_goal && <p className="text-[11px] text-gray-600 mt-0.5"><strong>Next:</strong> {e.next_goal}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <select value={kind} onChange={e => setKind(e.target.value)}
          className="w-full h-8 px-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none">
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="A short note…" rows={2}
          className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none resize-none" />
        <input value={nextGoal} onChange={e => setNextGoal(e.target.value)} placeholder="Goal for next session (optional)"
          className="w-full h-8 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
        <button disabled={busy || (!note && !nextGoal)} onClick={submit}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg text-white disabled:opacity-50" style={{ background: '#0B3C5D' }}>
          <Send size={12} /> {busy ? 'Saving…' : 'Log engagement'}
        </button>
      </div>
    </div>
  );
}
