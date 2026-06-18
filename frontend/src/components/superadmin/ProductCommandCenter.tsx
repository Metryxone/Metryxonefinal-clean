import React, { useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw, Sun, Moon, Activity, Info, Database, Zap, ShieldCheck,
  TrendingUp, TrendingDown, Minus, CheckCircle2, CircleSlash, Gauge, BarChart3,
} from 'lucide-react';

/**
 * Reusable executive command center for a single product.
 * Reads /api/admin/product/:key and renders four indicator groups:
 *   Health (Coverage) · Readiness (Activation) · Trend · Usage.
 * Coverage and Activation are shown as SEPARATE axes — never composited.
 */

// ── self-contained theme (independent of any global dark mode) ──────────────
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
  partial:   { label: 'Partial',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  idle:      { label: 'Idle',           color: '#64748b', bg: 'rgba(100,116,139,0.14)' },
  reference: { label: 'Reference only', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  empty:     { label: 'No data',        color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' },
  error:     { label: 'Error',          color: '#ef4444', bg: 'rgba(239,68,68,0.14)' },
};

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

function SourceRow({ s, t }: { s: any; t: any }) {
  const ok = s.materialized ?? s.live;
  const unavailable = s.n == null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: unavailable ? '#ef4444' : ok ? '#10b981' : '#cbd5e1' }} />
        <span className="text-[11px] truncate pr-2" style={{ color: t.textDim }}>{s.label}</span>
        {s.kind === 'reference' && (
          <span className="text-[9px] font-semibold px-1.5 py-px rounded uppercase tracking-wide shrink-0"
            style={{ color: '#0ea5e9', background: 'rgba(14,165,233,0.10)' }}>ref</span>
        )}
      </div>
      <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: unavailable ? '#ef4444' : t.text }}>
        {unavailable ? 'unavailable' : s.value}
      </span>
    </div>
  );
}

function Sparkline({ series, color, t }: { series: any[]; color: string; t: any }) {
  if (!series || series.length < 2) return null;
  const vals = series.map(p => p.n);
  const max = Math.max(...vals, 1);
  const W = 220, H = 44, n = series.length;
  const pts = series.map((p, i) => {
    const x = (i / (n - 1)) * W;
    const y = H - (p.n / max) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function ProductCommandCenter({ productKey }: { productKey: string }) {
  const { dark, toggle, t } = useTheme();
  const forceRef = useRef(false);

  const { data, isLoading, isFetching, refetch, error } = useQuery<any>({
    queryKey: ['product-cc', productKey],
    queryFn: async () => {
      const url = `/api/admin/product/${productKey}` + (forceRef.current ? '?refresh=1' : '');
      forceRef.current = false;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const hardRefresh = () => { forceRef.current = true; refetch(); };
  const gen = useMemo(() => {
    if (!data?.generated_at) return '';
    try { return new Date(data.generated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  }, [data?.generated_at]);

  const health = data?.health, readiness = data?.readiness, trend = data?.trend, usage = data?.usage;
  const st = STATUS[data?.status] || STATUS.empty;
  const trendDir = trend?.direction;
  const trendColor = trendDir === 'up' ? '#10b981' : trendDir === 'down' ? '#ef4444' : t.textFaint;
  const TrendIcon = trendDir === 'up' ? TrendingUp : trendDir === 'down' ? TrendingDown : Minus;

  return (
    <div style={{ background: t.bg, margin: '-1.5rem', padding: '1.5rem', minHeight: 'calc(100vh - 8rem)' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#344E86,#4ECDC4)' }}>
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold leading-none" style={{ color: t.text }}>{data?.name || 'Product'} Command Center</h1>
              {data?.status && <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>}
            </div>
            <p className="text-xs mt-1" style={{ color: t.textDim }}>{data?.tagline || 'Executive product dashboard'} · read-only aggregate</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {gen && <span className="text-[11px] mr-1" style={{ color: t.textFaint }}>Updated {gen}</span>}
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

      {/* honesty banner */}
      <div className="flex items-start gap-2 mb-5 px-3.5 py-2.5 rounded-lg border text-xs"
        style={{ background: t.panel2, borderColor: t.border, color: t.textDim }}>
        <Info className="h-4 w-4 mt-px shrink-0" style={{ color: '#0ea5e9' }} />
        <span><strong style={{ color: t.text }}>Coverage</strong> = product data materialized (reference + runtime). <strong style={{ color: t.text }}>Activation</strong> = runtime sources with live data. Reported separately, never composited — reference data can be fully present while activation is 0.</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><RefreshCw className="h-7 w-7 animate-spin" style={{ color: '#344E86' }} /></div>
      ) : error ? (
        <div className="px-4 py-3 rounded-lg border text-sm" style={{ background: t.panel, borderColor: '#ef4444', color: '#ef4444' }}>
          Unable to load this command center. {String((error as any)?.message || '')}
        </div>
      ) : (
        <>
          {/* ── KPI summary row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {/* Health */}
            <div className="rounded-xl border p-5" style={{ background: t.panel, borderColor: t.border, boxShadow: t.shadow }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.12)' }}>
                  <ShieldCheck className="h-5 w-5" style={{ color: '#0ea5e9' }} />
                </div>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.textFaint }}>Health · Coverage</p>
              <div className="flex items-end gap-1.5 mt-1 mb-3">
                <span className="text-3xl font-bold leading-none" style={{ color: t.text }}>{health?.coverage ?? 0}%</span>
              </div>
              <Bar label="Coverage" value={health?.coverage ?? 0} color="#0ea5e9" t={t} />
              <p className="text-[10px] mt-2" style={{ color: t.textFaint }}>{health?.materialized_count ?? 0}/{health?.sources_total ?? 0} sources materialized</p>
            </div>

            {/* Readiness */}
            <div className="rounded-xl border p-5" style={{ background: t.panel, borderColor: t.border, boxShadow: t.shadow }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(78,205,196,0.16)' }}>
                  <Gauge className="h-5 w-5" style={{ color: '#0d9488' }} />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ color: (STATUS[readiness?.status] || STATUS.empty).color, background: (STATUS[readiness?.status] || STATUS.empty).bg }}>{(STATUS[readiness?.status] || STATUS.empty).label}</span>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.textFaint }}>Readiness · Activation</p>
              <div className="flex items-end gap-1.5 mt-1 mb-3">
                <span className="text-3xl font-bold leading-none" style={{ color: t.text }}>{readiness?.activation ?? 0}%</span>
              </div>
              <Bar label="Activation" value={readiness?.activation ?? 0} color="#0d9488" t={t} />
              <p className="text-[10px] mt-2" style={{ color: t.textFaint }}>{readiness?.live_count ?? 0}/{readiness?.runtime_total ?? 0} runtime sources live</p>
            </div>

            {/* Trend */}
            <div className="rounded-xl border p-5" style={{ background: t.panel, borderColor: t.border, boxShadow: t.shadow }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${trendColor}1f` }}>
                  <TrendIcon className="h-5 w-5" style={{ color: trendColor }} />
                </div>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.textFaint }}>30-Day Trend</p>
              {trend?.available ? (
                <>
                  <div className="flex items-end gap-1.5 mt-1 mb-1">
                    <span className="text-3xl font-bold leading-none" style={{ color: t.text }}>{trend.current}</span>
                    <span className="text-[11px] font-semibold mb-0.5" style={{ color: trendColor }}>
                      {trend.delta_pct == null ? (trend.current > 0 ? 'new' : '—') : `${trend.delta_pct > 0 ? '+' : ''}${trend.delta_pct}%`}
                    </span>
                  </div>
                  <p className="text-[11px] mb-1" style={{ color: t.textDim }}>{trend.label} · vs {trend.previous} prior 30d</p>
                  <Sparkline series={trend.series} color={trendColor} t={t} />
                </>
              ) : (
                <div className="flex flex-col items-start gap-1 mt-2">
                  <span className="text-sm font-semibold" style={{ color: t.textFaint }}>Unavailable</span>
                  <p className="text-[10px]" style={{ color: t.textFaint }}>No timestamp basis for this product — trend honestly not measurable.</p>
                </div>
              )}
            </div>

            {/* Usage */}
            <div className="rounded-xl border p-5" style={{ background: t.panel, borderColor: t.border, boxShadow: t.shadow }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,78,134,0.12)' }}>
                  <BarChart3 className="h-5 w-5" style={{ color: '#344E86' }} />
                </div>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.textFaint }}>Usage Volume</p>
              <div className="flex items-end gap-1.5 mt-1 mb-3">
                <span className="text-3xl font-bold leading-none" style={{ color: t.text }}>{usage?.total_label ?? '—'}</span>
              </div>
              <div className="space-y-1 pt-2 border-t" style={{ borderColor: t.border }}>
                {(usage?.indicators || []).map((u: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[11px] truncate pr-2" style={{ color: t.textDim }}>{u.label}</span>
                    <span className="text-[11px] font-semibold" style={{ color: t.text }}>{u.n == null ? 'unavailable' : u.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Detail: Health sources + Readiness sources ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Health detail */}
            <div className="rounded-xl border overflow-hidden" style={{ background: t.panel, borderColor: t.border, boxShadow: t.shadow }}>
              <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: t.border }}>
                <Database className="h-4 w-4" style={{ color: '#0ea5e9' }} />
                <span className="text-sm font-bold" style={{ color: t.text }}>Data Health</span>
                <span className="text-[11px] font-semibold ml-auto" style={{ color: t.textFaint }}>
                  {health?.materialized_count ?? 0}/{health?.sources_total ?? 0} materialized
                </span>
              </div>
              <div className="px-5 py-2 divide-y" style={{ borderColor: t.border }}>
                {(health?.indicators || []).length === 0 ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-sm" style={{ color: t.textFaint }}>
                    <CircleSlash className="h-4 w-4" /> No sources declared
                  </div>
                ) : (health.indicators || []).map((s: any, i: number) => <SourceRow key={i} s={s} t={t} />)}
              </div>
            </div>

            {/* Readiness detail */}
            <div className="rounded-xl border overflow-hidden" style={{ background: t.panel, borderColor: t.border, boxShadow: t.shadow }}>
              <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: t.border }}>
                <Activity className="h-4 w-4" style={{ color: '#0d9488' }} />
                <span className="text-sm font-bold" style={{ color: t.text }}>Runtime Activation</span>
                <span className="text-[11px] font-semibold ml-auto" style={{ color: t.textFaint }}>
                  {readiness?.live_count ?? 0}/{readiness?.runtime_total ?? 0} live
                </span>
              </div>
              <div className="px-5 py-2 divide-y" style={{ borderColor: t.border }}>
                {(readiness?.indicators || []).length === 0 ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-sm" style={{ color: t.textFaint }}>
                    <CheckCircle2 className="h-4 w-4" style={{ color: '#0ea5e9' }} /> Reference-only product (no runtime sources)
                  </div>
                ) : (readiness.indicators || []).map((s: any, i: number) => <SourceRow key={i} s={s} t={t} />)}
              </div>
            </div>
          </div>

          <p className="text-[11px] mt-5 leading-relaxed" style={{ color: t.textFaint }}>
            All counts are read live from the database and individually guarded — a missing table degrades a single indicator to “unavailable” rather than failing the dashboard. Reference data being fully present does not imply the product is activated; activation requires live runtime data.
          </p>
        </>
      )}
    </div>
  );
}
