import React, { useState, useEffect } from 'react';
import {
  History, Star, CheckCircle, Play, X, Eye, TrendingUp,
  RefreshCw, AlertCircle, Clock, BarChart2
} from 'lucide-react';

const P = {
  primary: '#4F46E5', green: '#10B981', orange: '#F59E0B',
  accent: '#7C3AED', red: '#EF4444', slate: '#64748B',
};

interface HistoryItem {
  id: number; role_id: number; role_title: string; domain: string;
  segment: string; status: string; action_at: string; notes: string | null;
  rec_score: string | null; readiness_score: string | null;
}

interface HistorySummary {
  total: number; saved: number; in_progress: number; completed: number; dismissed: number;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  proposed:    { label: 'Proposed',    color: '#94A3B8', bg: '#F8FAFC', icon: <Clock size={11} /> },
  viewed:      { label: 'Viewed',      color: P.primary, bg: `${P.primary}08`, icon: <Eye size={11} /> },
  saved:       { label: 'Saved',       color: P.accent,  bg: `${P.accent}08`,  icon: <Star size={11} /> },
  in_progress: { label: 'In Progress', color: P.orange,  bg: '#FFFBEB', icon: <Play size={11} /> },
  completed:   { label: 'Achieved',    color: P.green,   bg: '#ECFDF5', icon: <CheckCircle size={11} /> },
  dismissed:   { label: 'Dismissed',   color: '#CBD5E1', bg: '#F8FAFC', icon: <X size={11} /> },
};

const SEG_LABEL: Record<string, string> = {
  next_step: 'Next Step', quick_win: 'Quick Win', lateral: 'Lateral',
  stretch: 'Stretch', pivot: 'Pivot', unknown: '—',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function RecommendationHistory({ userId }: { userId: string }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { load(); }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/career/pi/recommendation-history/${userId}`);
      const d = await r.json();
      if (d.ok) { setHistory(d.history); setSummary(d.summary); }
      else setError(d.error ?? 'Failed to load');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  const filtered = filter === 'all' ? history : history.filter(h => h.status === filter);

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <RefreshCw className="animate-spin" size={16} style={{ color: P.primary }} />
      <span className="ml-2 text-sm text-gray-500">Loading history…</span>
    </div>
  );

  if (error) return (
    <div className="rounded-2xl bg-red-50 border border-red-100 p-5 text-center">
      <AlertCircle size={16} className="mx-auto mb-1.5 text-red-400" />
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={load} className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: P.primary, color: '#fff' }}>Retry</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            <History size={16} style={{ color: P.primary }} /> Recommendation History
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Track your path across all career recommendations</p>
        </div>
        <button onClick={load} className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={11} className="inline mr-1" /> Refresh
        </button>
      </div>

      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {[
            { key: 'all',        label: 'Total',       count: summary.total,       color: P.slate  },
            { key: 'saved',      label: 'Saved',       count: summary.saved,       color: P.accent },
            { key: 'in_progress',label: 'Active',      count: summary.in_progress, color: P.orange },
            { key: 'completed',  label: 'Achieved',    count: summary.completed,   color: P.green  },
            { key: 'dismissed',  label: 'Dismissed',   count: summary.dismissed,   color: '#CBD5E1'},
          ].map(({ key, label, count, color }) => (
            <button key={key} onClick={() => setFilter(key)}
              className="rounded-xl border p-3 text-center transition-all"
              style={filter === key
                ? { background: color, borderColor: 'transparent' }
                : { borderColor: '#e2e8f0', background: '#fff' }}>
              <div className="text-lg font-bold" style={{ color: filter === key ? '#fff' : color }}>{count}</div>
              <div className="text-[10px] mt-0.5" style={{ color: filter === key ? 'rgba(255,255,255,0.8)' : '#94A3B8' }}>{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* History list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
          <BarChart2 size={20} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400">No history yet</p>
          <p className="text-xs text-gray-400 mt-1">Use Pathway Explorer to save and track career paths</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const meta = STATUS_META[item.status] ?? STATUS_META.proposed;
            const readiness = item.readiness_score ? Number(item.readiness_score) : null;
            return (
              <div key={item.id}
                className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:border-gray-200 transition-all">
                {/* Status icon */}
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: meta.bg, color: meta.color }}>
                  {meta.icon}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate">{item.role_title}</span>
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: meta.color }}>{meta.label}</span>
                    <span className="text-[9px] text-gray-400">{SEG_LABEL[item.segment] ?? item.segment}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {item.domain} · {fmtDate(item.action_at)}
                    {item.notes && <span className="ml-2 italic text-gray-300">"{item.notes}"</span>}
                  </div>
                </div>
                {/* Readiness */}
                {readiness !== null && (
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-gray-400">Readiness</div>
                    <div className="text-sm font-bold" style={{
                      color: readiness >= 70 ? P.green : readiness >= 50 ? P.orange : P.red
                    }}>{readiness.toFixed(0)}%</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
