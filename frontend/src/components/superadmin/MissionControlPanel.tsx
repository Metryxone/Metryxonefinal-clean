import React, { useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Server, Boxes, DollarSign, BrainCircuit, Database, ShieldCheck, Users,
  ClipboardCheck, AlertTriangle, Bell, ArrowRight, RefreshCw, Sun, Moon,
  Activity, CheckCircle2, CircleSlash, Info, ChevronRight, Zap,
} from 'lucide-react';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';

const ICONS: Record<string, any> = {
  Server, Boxes, DollarSign, BrainCircuit, Database, ShieldCheck, Users, ClipboardCheck,
};

// ── self-contained theme (this panel does NOT depend on any global dark mode) ──
function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    try { return localStorage.getItem('mc_theme') === 'dark'; } catch { return false; }
  });
  const toggle = () => setDark(d => { const n = !d; try { localStorage.setItem('mc_theme', n ? 'dark' : 'light'); } catch {} return n; });
  const t = dark ? {
    bg: '#0b1220', panel: '#131c2e', panel2: '#0f1626', border: '#24304a',
    text: '#e8edf6', textDim: '#94a3b8', textFaint: '#64748b', track: '#1e293b', shadow: '0 1px 3px rgba(0,0,0,0.4)',
  } : {
    bg: '#f6f8fc', panel: '#ffffff', panel2: '#f8fafc', border: '#e2e8f0',
    text: '#1e293b', textDim: '#5f6c80', textFaint: '#9aa4b2', track: '#f1f5f9', shadow: '0 1px 3px rgba(16,24,40,0.06)',
  };
  return { dark, toggle, t };
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  healthy:   { label: 'Healthy',        color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  warning:   { label: 'Low activation', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  idle:      { label: 'Idle',           color: '#64748b', bg: 'rgba(100,116,139,0.14)' },
  reference: { label: 'Reference only', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  empty:     { label: 'No data',        color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' },
  critical:  { label: 'Critical',       color: '#ef4444', bg: 'rgba(239,68,68,0.14)' },
};
const SEV: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#0ea5e9', '(none)': '#94a3b8' };

function Bar({ label, value, color, t }: { label: string; value: number; color: string; t: any }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: t.textFaint }}>{label}</span>
        <span className="text-[11px] font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="w-full rounded-full h-1.5" style={{ background: t.track }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export default function MissionControlPanel() {
  const { setActiveTab } = useAdminDashboard();
  const { dark, toggle, t } = useTheme();
  const forceRef = useRef(false);

  const { data, isLoading, isFetching, refetch, error } = useQuery<any>({
    queryKey: ['mission-control'],
    queryFn: async () => {
      const url = '/api/admin/mission-control' + (forceRef.current ? '?refresh=1' : '');
      forceRef.current = false;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const widgets = data?.widgets ?? [];
  const alerts = data?.alerts ?? [];
  const actions = data?.actions ?? [];
  const hardRefresh = () => { forceRef.current = true; refetch(); };
  const drill = (id?: string) => { if (id) setActiveTab(id); };

  const gen = useMemo(() => {
    if (!data?.generated_at) return '';
    try { return new Date(data.generated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  }, [data?.generated_at]);

  return (
    <div style={{ background: t.bg, margin: '-1.5rem', padding: '1.5rem', minHeight: 'calc(100vh - 8rem)' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#344E86,#4ECDC4)' }}>
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none" style={{ color: t.text }}>Mission Control</h1>
              <p className="text-xs mt-1" style={{ color: t.textDim }}>Enterprise Command Center · live aggregate (read-only)</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {gen && <span className="text-[11px] mr-1" style={{ color: t.textFaint }}>Updated {gen}{data?.cached ? ' · cached' : ''}</span>}
          <button onClick={toggle} title="Toggle theme"
            className="h-9 w-9 rounded-lg flex items-center justify-center border transition-colors"
            style={{ background: t.panel, borderColor: t.border, color: t.textDim }}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={hardRefresh} disabled={isFetching}
            className="h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold border transition-colors"
            style={{ background: t.panel, borderColor: t.border, color: t.text }}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* environment banner */}
      {data?.environment?.data_profile && (
        <div className="flex items-start gap-2 mb-5 px-3.5 py-2.5 rounded-lg border text-xs"
          style={{ background: t.panel2, borderColor: t.border, color: t.textDim }}>
          <Info className="h-4 w-4 mt-px shrink-0" style={{ color: '#0ea5e9' }} />
          <span><strong style={{ color: t.text }}>Environment:</strong> {data.environment.data_profile} · {data.environment.live_tables} live tables. Coverage = data materialized; Activation = runtime/commercial sources with live data — reported separately, never composited.</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><RefreshCw className="h-7 w-7 animate-spin" style={{ color: '#344E86' }} /></div>
      ) : error ? (
        <div className="px-4 py-3 rounded-lg border text-sm" style={{ background: t.panel, borderColor: '#ef4444', color: '#ef4444' }}>
          Unable to load Mission Control. {String((error as any)?.message || '')}
        </div>
      ) : (
        <>
          {/* ── KPI grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {widgets.map((w: any) => {
              const Icon = ICONS[w.icon] || Activity;
              const st = STATUS[w.status] || STATUS.empty;
              return (
                <div key={w.id} onClick={() => drill(w.drill)}
                  className="rounded-xl border p-5 cursor-pointer transition-all hover:-translate-y-0.5 group"
                  style={{ background: t.panel, borderColor: t.border, boxShadow: t.shadow }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${w.accent}1f` }}>
                      <Icon className="h-5 w-5" style={{ color: w.accent }} />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.textFaint }}>{w.title}</p>
                  <div className="flex items-end gap-1.5 mt-1 mb-3">
                    <span className="text-3xl font-bold leading-none" style={{ color: t.text }}>{w.headline?.value}</span>
                  </div>
                  <p className="text-[11px] mb-3 -mt-2" style={{ color: t.textDim }}>{w.headline?.label}</p>

                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <Bar label="Coverage" value={w.coverage ?? 0} color="#0ea5e9" t={t} />
                    <Bar label="Activation" value={w.activation ?? 0} color={w.accent} t={t} />
                  </div>
                  {typeof w.sources_total === 'number' && (
                    <p className="text-[10px] mb-1" style={{ color: w.sources_present < w.sources_total ? '#f59e0b' : t.textFaint }}>
                      {w.sources_present}/{w.sources_total} data sources available
                    </p>
                  )}

                  <div className="space-y-1.5 pt-3 border-t" style={{ borderColor: t.border }}>
                    {(w.metrics || []).slice(0, 4).map((m: any, i: number) => (
                      <div key={i}
                        onClick={(e) => { if (m.drill) { e.stopPropagation(); drill(m.drill); } }}
                        className={`flex items-center justify-between ${m.drill ? 'hover:opacity-70' : ''}`}>
                        <span className="text-[11px] truncate pr-2" style={{ color: t.textDim }}>{m.label}</span>
                        <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: t.text }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                  {w.note && <p className="text-[10px] mt-3 leading-snug" style={{ color: t.textFaint }}>{w.note}</p>}
                  <div className="flex items-center gap-1 mt-3 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: w.accent }}>
                    Open <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Alerts + Actions ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Alerts */}
            <div className="rounded-xl border overflow-hidden" style={{ background: t.panel, borderColor: t.border, boxShadow: t.shadow }}>
              <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: t.border }}>
                <Bell className="h-4 w-4" style={{ color: '#f59e0b' }} />
                <span className="text-sm font-bold" style={{ color: t.text }}>Alerts</span>
                <span className="text-[11px] font-semibold ml-auto" style={{ color: t.textFaint }}>{alerts.length} active</span>
              </div>
              <div className="divide-y" style={{ borderColor: t.border }}>
                {alerts.length === 0 ? (
                  <div className="flex items-center gap-2 px-5 py-8 justify-center text-sm" style={{ color: t.textFaint }}>
                    <CheckCircle2 className="h-4 w-4" style={{ color: '#10b981' }} /> No active alerts
                  </div>
                ) : alerts.map((a: any, i: number) => (
                  <div key={i} onClick={() => drill(a.drill)}
                    className="flex items-start gap-3 px-5 py-3 cursor-pointer hover:opacity-80" style={{ borderColor: t.border }}>
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: SEV[a.severity] || '#94a3b8' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold" style={{ color: t.text }}>{a.title}</p>
                      <p className="text-[11px]" style={{ color: t.textDim }}>{a.detail} · {a.source}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: t.textFaint }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Required */}
            <div className="rounded-xl border overflow-hidden" style={{ background: t.panel, borderColor: t.border, boxShadow: t.shadow }}>
              <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: t.border }}>
                <AlertTriangle className="h-4 w-4" style={{ color: '#ef4444' }} />
                <span className="text-sm font-bold" style={{ color: t.text }}>Actions Required</span>
                <span className="text-[11px] font-semibold ml-auto" style={{ color: t.textFaint }}>{actions.length} pending</span>
              </div>
              <div className="divide-y" style={{ borderColor: t.border }}>
                {actions.length === 0 ? (
                  <div className="flex items-center gap-2 px-5 py-8 justify-center text-sm" style={{ color: t.textFaint }}>
                    <CircleSlash className="h-4 w-4" /> No pending actions
                  </div>
                ) : actions.map((a: any, i: number) => (
                  <div key={i} onClick={() => drill(a.drill)}
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:opacity-80">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0"
                      style={{ color: a.priority === 'critical' ? '#ef4444' : '#f59e0b', background: a.priority === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }}>{a.priority}</span>
                    <p className="text-xs font-semibold flex-1 min-w-0 truncate" style={{ color: t.text }}>{a.title}</p>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: t.textFaint }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* honesty footer */}
          {data?.honesty?.note && (
            <p className="text-[11px] mt-5 leading-relaxed" style={{ color: t.textFaint }}>{data.honesty.note}</p>
          )}
        </>
      )}
    </div>
  );
}
