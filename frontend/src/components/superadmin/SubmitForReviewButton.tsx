import { useState } from 'react';
import { ClipboardCheck, X, Loader2 } from 'lucide-react';

interface Props {
  entityType:    string;
  entityId:      string | number;
  entityLabel?:  string;
  defaultSummary?: string;
  onSuccess?:    () => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Low',      color: 'text-slate-500' },
  { value: 'normal',   label: 'Normal',   color: 'text-blue-600' },
  { value: 'high',     label: 'High',     color: 'text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
] as const;

export default function SubmitForReviewButton({
  entityType,
  entityId,
  entityLabel,
  defaultSummary = '',
  onSuccess,
}: Props) {
  const [open,     setOpen]     = useState(false);
  const [summary,  setSummary]  = useState(defaultSummary);
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit() {
    if (!summary.trim()) { setError('Please describe the change.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/approvals/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          entity_type:   entityType,
          entity_id:     String(entityId),
          entity_label:  entityLabel ?? null,
          change_summary: summary.trim(),
          priority,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Submission failed');
      }
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setSummary(defaultSummary); }, 1500);
      onSuccess?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(''); setDone(false); }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg hover:bg-yellow-100 font-medium transition-colors"
      >
        <ClipboardCheck className="w-3.5 h-3.5" />
        Submit for Review
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-yellow-600" />
                <span className="font-semibold text-slate-800 text-sm">Submit for Review</span>
              </div>
              <button onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            {/* Context */}
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs space-y-0.5">
              <div><span className="text-slate-400">Module:</span> <span className="font-medium text-slate-700">{entityType}</span></div>
              {entityLabel && <div><span className="text-slate-400">Entity:</span> <span className="text-slate-700">{entityLabel}</span></div>}
            </div>

            {/* Change summary */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Change summary <span className="text-red-500">*</span>
              </label>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                rows={3}
                placeholder="Describe what changed and why it should be reviewed…"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Priority</label>
              <div className="flex gap-2 flex-wrap">
                {PRIORITY_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                      priority === p.value
                        ? 'bg-slate-800 text-white border-slate-800'
                        : `bg-white ${p.color} border-slate-200 hover:border-slate-400`
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            {done ? (
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium bg-emerald-50 rounded-lg px-3 py-2">
                <ClipboardCheck className="w-4 h-4" /> Submitted for review!
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-2 text-xs border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !summary.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 font-medium disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                  {loading ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
