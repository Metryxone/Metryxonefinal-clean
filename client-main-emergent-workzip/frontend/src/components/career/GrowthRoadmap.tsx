import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, CheckCircle, Clock, PlayCircle, XCircle,
  RefreshCw, AlertCircle, PlusCircle, TrendingUp, Award,
  BookOpen, Code, Users, Target, Zap
} from 'lucide-react';

const P = {
  primary: '#4F46E5', green: '#10B981', orange: '#F59E0B',
  accent: '#7C3AED', red: '#EF4444', slate: '#64748B',
};

type ItemStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

interface PlanItem {
  id: number; role_id: number | null; item_id: string; title: string;
  type: string; status: ItemStatus; priority: number; ei_lift: string;
  hours: number; cost_inr: number; notes: string | null;
  role_title: string | null; created_at: string; updated_at: string;
}

interface PlanStats {
  total: number; planned: number; in_progress: number; completed: number;
  total_ei_lift: number; earned_ei: number; total_hours: number;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  course:        <BookOpen size={12} style={{ color: P.primary }} />,
  certification: <Award    size={12} style={{ color: P.orange }} />,
  practice:      <Code     size={12} style={{ color: P.green }} />,
  mentorship:    <Users    size={12} style={{ color: P.accent }} />,
  project:       <Target   size={12} style={{ color: P.red }} />,
  other:         <Zap      size={12} style={{ color: P.slate }} />,
};

const STATUS_NEXT: Record<ItemStatus, ItemStatus | null> = {
  planned:     'in_progress',
  in_progress: 'completed',
  completed:   null,
  skipped:     null,
};
const STATUS_LABEL: Record<ItemStatus, string> = {
  planned:     'Planned',
  in_progress: 'In Progress',
  completed:   'Completed',
  skipped:     'Skipped',
};
const STATUS_COLOR: Record<ItemStatus, string> = {
  planned:     '#CBD5E1',
  in_progress: P.orange,
  completed:   P.green,
  skipped:     '#E2E8F0',
};
const STATUS_BG: Record<ItemStatus, string> = {
  planned:     '#F8FAFC',
  in_progress: '#FFFBEB',
  completed:   '#ECFDF5',
  skipped:     '#F8FAFC',
};

function fmtCost(n: number): string {
  return n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : n > 0 ? `₹${n}` : 'Free';
}

export function GrowthRoadmap({ userId, idpItems }: {
  userId: string;
  idpItems?: Array<{
    item_id: string; title: string; type: string; priority: number;
    eiLift: number; hours: number; cost: number; role_id?: number;
  }>;
}) {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/career/pi/growth-plan/${userId}`);
      const d = await r.json();
      if (d.ok) { setItems(d.items); setStats(d.stats); }
      else setError(d.error ?? 'Failed to load');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Sync IDP items to DB when provided and not yet synced
  useEffect(() => {
    if (!idpItems || idpItems.length === 0 || synced) return;
    const sync = async () => {
      try {
        await fetch(`/api/career/pi/growth-plan/${userId}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role_id: idpItems[0]?.role_id ?? null,
            items: idpItems.map(i => ({
              item_id: i.item_id, title: i.title, type: i.type,
              priority: i.priority, ei_lift: i.eiLift, hours: i.hours, cost_inr: i.cost,
            })),
          }),
        });
        setSynced(true);
        await loadPlan();
      } catch {}
    };
    sync();
  }, [idpItems, synced, userId, loadPlan]);

  async function updateStatus(itemId: string, status: ItemStatus) {
    setUpdating(itemId);
    try {
      await fetch(`/api/career/pi/growth-plan/${userId}/item/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await loadPlan();
    } catch {} finally { setUpdating(null); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <RefreshCw className="animate-spin" size={18} style={{ color: P.primary }} />
      <span className="ml-2 text-sm text-gray-500">Loading growth roadmap…</span>
    </div>
  );

  if (error) return (
    <div className="rounded-2xl bg-red-50 border border-red-100 p-5 text-center">
      <AlertCircle size={16} className="mx-auto mb-1.5 text-red-400" />
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={loadPlan} className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: P.primary, color: '#fff' }}>Retry</button>
    </div>
  );

  if (items.length === 0) return (
    <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
      <ClipboardList size={20} className="mx-auto mb-2 text-gray-300" />
      <p className="text-sm font-semibold text-gray-600">No growth plan yet</p>
      <p className="text-xs text-gray-400 mt-1">Select a target role in Future Map, then return here to track your progress.</p>
    </div>
  );

  const completionPct = stats ? (stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0) : 0;
  const earnedPct     = stats ? (stats.total_ei_lift > 0 ? Math.round((stats.earned_ei / stats.total_ei_lift) * 100) : 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            <ClipboardList size={16} style={{ color: P.primary }} /> Growth Roadmap
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">DB-tracked — progress persists across devices</p>
        </div>
        <button onClick={loadPlan} className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={11} className="inline mr-1" /> Sync
        </button>
      </div>

      {/* Progress summary */}
      {stats && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-700">Plan Progress</span>
            <span className="font-bold" style={{ color: P.primary }}>{completionPct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${completionPct}%`, background: P.primary }} />
          </div>
          <div className="grid grid-cols-4 gap-2 pt-1">
            <div className="text-center">
              <div className="text-sm font-bold text-gray-700">{stats.planned}</div>
              <div className="text-[9px] text-gray-400">Planned</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold" style={{ color: P.orange }}>{stats.in_progress}</div>
              <div className="text-[9px] text-gray-400">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold" style={{ color: P.green }}>{stats.completed}</div>
              <div className="text-[9px] text-gray-400">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold" style={{ color: P.accent }}>{earnedPct}%</div>
              <div className="text-[9px] text-gray-400">EI earned</div>
            </div>
          </div>
          {stats.total_ei_lift > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-1 border-t border-gray-100">
              <TrendingUp size={11} style={{ color: P.green }} />
              <span>+{stats.earned_ei.toFixed(1)} / {stats.total_ei_lift.toFixed(1)} EI banked · {stats.total_hours}h total</span>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="space-y-2">
        {items.map(item => {
          const nextStatus = STATUS_NEXT[item.status];
          const isUpdating = updating === item.item_id;
          return (
            <div key={item.id}
              className="rounded-2xl border p-4 transition-all"
              style={{ borderColor: STATUS_COLOR[item.status] + '40', background: STATUS_BG[item.status] }}>
              <div className="flex items-start gap-3">
                {/* Rank / status icon */}
                <div className="shrink-0 mt-0.5">
                  {item.status === 'completed'
                    ? <CheckCircle size={18} style={{ color: P.green }} />
                    : item.status === 'in_progress'
                    ? <PlayCircle  size={18} style={{ color: P.orange }} />
                    : item.status === 'skipped'
                    ? <XCircle     size={18} style={{ color: '#CBD5E1' }} />
                    : <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ background: P.primary }}>{item.priority}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    {TYPE_ICON[item.type] ?? TYPE_ICON.other}
                    <span className="text-xs font-semibold text-gray-800">{item.title}</span>
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ background: STATUS_COLOR[item.status] + '20', color: STATUS_COLOR[item.status] }}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-wrap">
                    {Number(item.ei_lift) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <TrendingUp size={9} style={{ color: P.green }} />+{Number(item.ei_lift).toFixed(1)} EI
                      </span>
                    )}
                    {item.hours > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Clock size={9} style={{ color: P.slate }} />{item.hours}h
                      </span>
                    )}
                    {item.cost_inr > 0 && <span>{fmtCost(item.cost_inr)}</span>}
                    {item.role_title && (
                      <span className="text-gray-300">for {item.role_title}</span>
                    )}
                  </div>
                </div>
                {/* Action button */}
                <div className="shrink-0">
                  {nextStatus && !isUpdating && (
                    <button
                      onClick={() => updateStatus(item.item_id, nextStatus)}
                      className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all hover:opacity-80"
                      style={nextStatus === 'completed'
                        ? { background: P.green, color: '#fff', borderColor: 'transparent' }
                        : { background: P.primary, color: '#fff', borderColor: 'transparent' }}>
                      {nextStatus === 'in_progress' ? 'Start' : 'Done'}
                    </button>
                  )}
                  {isUpdating && <RefreshCw size={14} className="animate-spin text-gray-400" />}
                  {!nextStatus && item.status !== 'completed' && item.status !== 'skipped' && null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
