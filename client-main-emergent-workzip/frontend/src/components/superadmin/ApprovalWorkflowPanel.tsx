import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Clock, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';

interface ApprovalRequest {
  id:               number;
  entity_type:      string;
  entity_id:        string;
  entity_label:     string | null;
  change_summary:   string;
  submitter_id:     string;
  submitter_email:  string | null;
  reviewer_id:      string | null;
  reviewer_email:   string | null;
  status:           'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewer_comment: string | null;
  priority:         'low' | 'normal' | 'high' | 'critical';
  created_at:       string;
  decided_at:       string | null;
}

interface Stats {
  byStatus: Record<string, number>;
  byType:   Record<string, number>;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  normal:   'bg-blue-100 text-blue-700 border-blue-200',
  low:      'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_ICONS: Record<string, JSX.Element> = {
  pending:   <Clock className="w-4 h-4 text-yellow-500" />,
  approved:  <CheckCircle className="w-4 h-4 text-emerald-500" />,
  rejected:  <XCircle className="w-4 h-4 text-red-500" />,
  cancelled: <XCircle className="w-4 h-4 text-slate-400" />,
};

function DecisionDialog({
  request,
  onClose,
}: {
  request: ApprovalRequest;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [decision, setDecision]   = useState<'approved' | 'rejected'>('approved');
  const [comment,  setComment]    = useState('');
  const [error,    setError]      = useState('');

  const decide = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/approvals/${request.id}/decide`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ decision, comment }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['approval-stats'] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <h3 className="font-semibold text-slate-800">Review Request #{request.id}</h3>

        <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs">
          <div><span className="text-slate-400">Module:</span> <span className="font-medium text-slate-700">{request.entity_type}</span></div>
          <div><span className="text-slate-400">Entity:</span> <span className="text-slate-700">{request.entity_label ?? request.entity_id}</span></div>
          <div><span className="text-slate-400">Summary:</span> <span className="text-slate-700">{request.change_summary}</span></div>
          <div><span className="text-slate-400">Submitted by:</span> <span className="text-slate-700">{request.submitter_email ?? request.submitter_id}</span></div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">Decision</label>
          <div className="flex gap-3">
            {(['approved', 'rejected'] as const).map(d => (
              <label key={d} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value={d}
                  checked={decision === d}
                  onChange={() => setDecision(d)}
                  className="accent-slate-700"
                />
                <span className={`text-xs font-medium ${d === 'approved' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Reviewer comment {decision === 'rejected' && <span className="text-red-500">*</span>}</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder={decision === 'rejected' ? 'Reason for rejection (required)' : 'Optional note for approver…'}
            className="mt-1 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => {
              if (decision === 'rejected' && !comment.trim()) {
                setError('Rejection requires a comment.');
                return;
              }
              decide.mutate();
            }}
            disabled={decide.isPending}
            className={`flex-1 px-4 py-2 text-sm rounded-xl font-medium text-white transition-colors ${
              decision === 'approved'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-500 hover:bg-red-600'
            } disabled:opacity-50`}
          >
            {decide.isPending ? 'Submitting…' : `Submit ${decision}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalWorkflowPanel() {
  const [tab,       setTab]       = useState<'pending' | 'history'>('pending');
  const [reviewing, setReviewing] = useState<ApprovalRequest | null>(null);
  const [priority,  setPriority]  = useState('all');
  const [entityType, setEntityType] = useState('all');

  const statsQ = useQuery<Stats>({
    queryKey: ['approval-stats'],
    queryFn: () => fetch('/api/admin/approvals/stats').then(r => r.json()),
    staleTime: 30_000,
  });

  const qParams = new URLSearchParams({
    status:      tab === 'pending' ? 'pending' : 'all',
    limit:       '100',
    offset:      '0',
  });
  if (priority !== 'all')    qParams.set('priority', priority);
  if (entityType !== 'all')  qParams.set('entity_type', entityType);
  if (tab === 'history') {
    qParams.set('status', 'all');
  }

  const { data, isLoading, refetch } = useQuery<{ requests: ApprovalRequest[]; total: number }>({
    queryKey: ['approvals', tab, priority, entityType],
    queryFn: () => fetch(`/api/admin/approvals?${qParams}`).then(r => r.json()),
    staleTime: 30_000,
  });

  const requests = (data?.requests ?? []).filter(r =>
    tab === 'pending' ? r.status === 'pending' : r.status !== 'pending'
  );
  const pendingCount = statsQ.data?.byStatus?.pending ?? 0;

  const moduleTypes = Object.keys(statsQ.data?.byType ?? {});

  return (
    <div className="space-y-4">
      {reviewing && (
        <DecisionDialog request={reviewing} onClose={() => setReviewing(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">Approval Workflow</h2>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats pills */}
      {statsQ.data && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(statsQ.data.byStatus).map(([s, c]) => (
            <span key={s} className="px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600">
              {s}: <strong>{c}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Tabs + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {(['pending', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'pending' ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}` : 'History'}
            </button>
          ))}
        </div>
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="all">All priorities</option>
          {['critical','high','normal','low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {moduleTypes.length > 0 && (
          <select
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="all">All modules</option>
            {moduleTypes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          {tab === 'pending' ? 'No pending approvals. Use "Submit for Review" from any module panel.' : 'No completed decisions yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <div
              key={req.id}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {STATUS_ICONS[req.status]}
                  <span className="font-medium text-slate-800 text-sm">{req.entity_label ?? req.entity_id}</span>
                  <span className="text-xs text-slate-400">[{req.entity_type}]</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[req.priority]}`}>
                    {req.priority}
                  </span>
                </div>
                {req.status === 'pending' && (
                  <button
                    onClick={() => setReviewing(req)}
                    className="flex-shrink-0 px-3 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium"
                  >
                    Review
                  </button>
                )}
              </div>

              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{req.change_summary}</p>

              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                <span>Submitted by: {req.submitter_email ?? req.submitter_id}</span>
                <span>{new Date(req.created_at).toLocaleString()}</span>
                {req.decided_at && (
                  <span>Decided: {new Date(req.decided_at).toLocaleString()}</span>
                )}
                {req.reviewer_email && <span>Reviewer: {req.reviewer_email}</span>}
              </div>

              {req.reviewer_comment && (
                <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${
                  req.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  <strong>Comment:</strong> {req.reviewer_comment}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2 text-xs text-blue-700">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Submit items for review from any ontology module panel using the "Submit for Review" button.
          Rejecting a request requires a comment. All decisions are recorded in the Platform Audit Log.
        </span>
      </div>
    </div>
  );
}
