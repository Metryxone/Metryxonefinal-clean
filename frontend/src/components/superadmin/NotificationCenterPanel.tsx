import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Loader2, Bell, AlertOctagon, AlertTriangle, Info, CheckCircle2,
  ChevronRight, LayoutGrid, List as ListIcon,
} from 'lucide-react';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';

/**
 * Notification Center — unified alert/event stream over GET /api/admin/notifications.
 * Two views over ONE dataset:
 *  - Stream    : a flat, severity-sorted feed
 *  - Category  : grouped by the 4 categories (System/Assessment/Commercial/Operational)
 * Honest: categories with no backing source render an explicit "no source" note;
 * empty categories show an empty state. Notifications are live-derived (no read
 * state). Nothing is fabricated.
 */

type Severity = 'critical' | 'warning' | 'info' | 'success';

interface Notification {
  id: string;
  severity: Severity;
  category: string;
  category_label: string;
  title: string;
  subtitle: string | null;
  source_table: string;
  created_at: string | null;
  location: { tab: string; label: string };
  actions: { key: string; label: string; tab: string }[];
}
interface Category { key: string; label: string; tab: string; tab_label: string; available: boolean; count: number; note?: string; }
interface NCResponse {
  generated_at: string;
  total: number;
  by_severity: Record<Severity, number>;
  categories: Category[];
  items: Notification[];
}

type ViewMode = 'stream' | 'category';

const SEVERITY_META: Record<Severity, { label: string; color: string; bg: string; Icon: any }> = {
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEE2E2', Icon: AlertOctagon },
  warning: { label: 'Warning', color: '#CA8A04', bg: '#FEF9C3', Icon: AlertTriangle },
  info: { label: 'Info', color: '#2563EB', bg: '#DBEAFE', Icon: Info },
  success: { label: 'Success', color: '#059669', bg: '#D1FAE5', Icon: CheckCircle2 },
};
const SEVERITY_ORDER: Severity[] = ['critical', 'warning', 'info', 'success'];

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationCenterPanel() {
  const { setActiveTab, BRAND } = useAdminDashboard() as any;
  const PRIMARY = BRAND?.primary || '#344E86';
  const [data, setData] = useState<NCResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('stream');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');

  const load = async (refresh = false) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/notifications${refresh ? '?refresh=1' : ''}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const items = useMemo(() => {
    const all = data?.items || [];
    return severityFilter === 'all' ? all : all.filter(i => i.severity === severityFilter);
  }, [data, severityFilter]);

  const NotifCard = ({ it }: { it: Notification }) => {
    const m = SEVERITY_META[it.severity];
    return (
      <button
        onClick={() => setActiveTab(it.location.tab)}
        className="w-full text-left bg-white border rounded-xl p-3 hover:shadow-md transition-shadow group"
        style={{ borderColor: '#e7ebf1' }}
      >
        <div className="flex items-start gap-2.5">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: m.bg }}>
            <m.Icon className="h-4 w-4" style={{ color: m.color }} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold text-slate-800 leading-snug">{it.title}</span>
            {it.subtitle && <span className="block text-[11.5px] text-slate-500 truncate mt-0.5">{it.subtitle}</span>}
            <span className="flex items-center gap-2 mt-1.5 text-[10.5px] text-slate-400">
              <span className="font-mono">{it.source_table}</span>
              {it.created_at && <><span>·</span><span>{timeAgo(it.created_at)}</span></>}
              <span className="ml-auto flex items-center gap-0.5 font-medium group-hover:text-slate-600" style={{ color: PRIMARY }}>
                {it.location.label} <ChevronRight className="h-3 w-3" />
              </span>
            </span>
          </span>
        </div>
      </button>
    );
  };

  const headerStats = data ? (
    <div className="flex items-center gap-2 flex-wrap">
      {SEVERITY_ORDER.map(p => {
        const n = data.by_severity?.[p] || 0;
        const m = SEVERITY_META[p];
        const active = severityFilter === p;
        return (
          <button key={p} onClick={() => setSeverityFilter(active ? 'all' : p)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all"
            style={{
              color: m.color, background: active ? m.bg : '#fff',
              borderColor: active ? m.color : '#e7ebf1',
            }}>
            <m.Icon className="h-3.5 w-3.5" /> {m.label} <span className="ml-0.5 opacity-70">{n}</span>
          </button>
        );
      })}
      {severityFilter !== 'all' && (
        <button onClick={() => setSeverityFilter('all')} className="text-[11px] text-slate-400 underline ml-1">clear</button>
      )}
    </div>
  ) : null;

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-4" style={{ borderColor: '#e7ebf1' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,78,134,0.1)' }}>
            <Bell className="h-5 w-5" style={{ color: PRIMARY }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-slate-800 leading-tight">Notification Center</h1>
            <p className="text-[12px] text-slate-500">
              {data ? `${data.total} notification${data.total === 1 ? '' : 's'} across the platform` : 'Unified alert stream'}
            </p>
          </div>

          {/* View switcher */}
          <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: '#e7ebf1' }}>
            {([['stream', ListIcon, 'Stream'], ['category', LayoutGrid, 'Category']] as const).map(([v, Icon, label]) => (
              <button key={v} onClick={() => setView(v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{ background: view === v ? PRIMARY : '#fff', color: view === v ? '#fff' : '#64748b' }}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          <button onClick={() => load(true)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            style={{ borderColor: '#e7ebf1' }}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="mt-3">{headerStats}</div>
      </div>

      {/* Body */}
      <div className="p-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading notifications…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
            <p className="text-sm text-slate-600">Couldn’t load the Notification Center.</p>
            <p className="text-[12px] text-slate-400 mt-1">{error}</p>
            <button onClick={() => load(true)} className="mt-3 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white" style={{ background: PRIMARY }}>Retry</button>
          </div>
        ) : !data ? null : (
          <>
            {/* STREAM — flat, severity-sorted */}
            {view === 'stream' && (
              items.length === 0 ? <EmptyState /> : (
                <div className="max-w-3xl space-y-2.5">
                  {items.map(it => <NotifCard key={it.id} it={it} />)}
                </div>
              )
            )}

            {/* CATEGORY — column per category */}
            {view === 'category' && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {data.categories.map(cat => {
                  const catItems = items.filter(i => i.category === cat.key);
                  return (
                    <div key={cat.key} className="shrink-0 w-[320px]">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[12.5px] font-bold text-slate-700">{cat.label}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: '#eef2f7', color: '#64748b' }}>{catItems.length}</span>
                      </div>
                      <div className="space-y-2.5 min-h-[80px]">
                        {!cat.available ? (
                          <div className="bg-white border border-dashed rounded-xl p-4 text-center" style={{ borderColor: '#dbe2ea' }}>
                            <p className="text-[11.5px] text-slate-400">No source connected</p>
                            <p className="text-[10.5px] text-slate-300 mt-0.5">No data source for this category in this environment.</p>
                          </div>
                        ) : catItems.length === 0 ? (
                          <div className="bg-white/60 border border-dashed rounded-xl p-4 text-center" style={{ borderColor: '#e2e8f0' }}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                            <p className="text-[11px] text-slate-400">All clear</p>
                          </div>
                        ) : (
                          catItems.map(it => <NotifCard key={it.id} it={it} />)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  function EmptyState() {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
        <p className="text-[15px] font-semibold text-slate-700">No notifications</p>
        <p className="text-[12.5px] text-slate-400 mt-1">
          {severityFilter === 'all' ? 'Nothing to report across any category.' : `No ${SEVERITY_META[severityFilter as Severity].label.toLowerCase()} notifications.`}
        </p>
      </div>
    );
  }
}
