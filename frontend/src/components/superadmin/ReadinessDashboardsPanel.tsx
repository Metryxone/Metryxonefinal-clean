import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Loader2, Gauge, AlertTriangle, ChevronLeft, TrendingUp, TrendingDown,
  Minus, Camera, ExternalLink, History as HistoryIcon, MinusCircle,
} from 'lucide-react';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';

/**
 * Readiness Dashboards — per-product readiness over GET /api/admin/readiness.
 * HONEST model (mirrors backend): each product is measured across 8 dimensions;
 * a dimension with no real source is shown as "Not measurable" (available:false),
 * never scored 0. Overall = mean of MEASURED dimensions only.
 * Views: grid of product gauges → drill into one product (8-dim gauges + signals
 * + trend + history). History/trend come from explicitly-captured snapshots.
 */

type Band = 'ready' | 'partial' | 'early' | 'idle' | 'unavailable';

interface DimSignal { label: string; table: string; n: number | null; met: boolean; queryable: boolean; }
interface Dimension {
  key: string; label: string; description?: string;
  available: boolean; score: number | null; band: string;
  met?: number; total?: number; reason?: string; signals?: DimSignal[];
}
interface ProductSummary {
  key: string; name: string; tagline: string; tab: string;
  overall_score: number | null; overall_band: Band;
  measured_dimensions: number; total_dimensions: number;
  dimensions: Dimension[];
}
interface Trend {
  available: boolean; reason?: string;
  direction: 'up' | 'down' | 'flat' | 'none';
  current: number | null; previous: number | null; delta: number | null;
}
interface HistoryPoint { overall_score: number | null; measured_dimensions: number | null; captured_at: string; }

const BAND_META: Record<Band, { label: string; color: string; bg: string }> = {
  ready: { label: 'Ready', color: '#059669', bg: '#D1FAE5' },
  partial: { label: 'Partial', color: '#CA8A04', bg: '#FEF9C3' },
  early: { label: 'Early', color: '#EA580C', bg: '#FFEDD5' },
  idle: { label: 'Idle', color: '#64748B', bg: '#F1F5F9' },
  unavailable: { label: 'N/A', color: '#94A3B8', bg: '#F8FAFC' },
};
const bandOf = (b: string): Band => (['ready', 'partial', 'early', 'idle'].includes(b) ? b as Band : 'unavailable');

/** SVG radial gauge for a 0-100 score (null → dashed "not measurable" ring) */
function GaugeRing({ score, size = 132, stroke = 11, color, label }: { score: number | null; size?: number; stroke?: number; color: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const off = c - (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f7" strokeWidth={stroke}
          strokeDasharray={score == null ? '4 6' : undefined} />
        {score != null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score == null ? (
          <>
            <MinusCircle className="h-5 w-5 text-slate-300" />
            <span className="text-[10px] text-slate-400 mt-0.5">N/A</span>
          </>
        ) : (
          <>
            <span className="text-[26px] font-bold leading-none" style={{ color }}>{score}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">/ 100</span>
          </>
        )}
        {label && <span className="text-[10px] font-medium text-slate-500 mt-1">{label}</span>}
      </div>
    </div>
  );
}

/** small sparkline of overall_score history */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 220, h = 48, pad = 4;
  const min = Math.min(...points, 0), max = Math.max(...points, 100);
  const span = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const d = points.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((v, i) => {
        const x = pad + i * step;
        const y = h - pad - ((v - min) / span) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r={2} fill={color} />;
      })}
    </svg>
  );
}

export default function ReadinessDashboardsPanel() {
  const { setActiveTab, BRAND } = useAdminDashboard() as any;
  const PRIMARY = BRAND?.primary || '#344E86';
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<(ProductSummary & { trend: Trend; history: HistoryPoint[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapMsg, setSnapMsg] = useState<string | null>(null);

  const loadAll = async (refresh = false) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/readiness${refresh ? '?refresh=1' : ''}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProducts(json.products || []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (key: string, refresh = false) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/readiness/${key}${refresh ? '?refresh=1' : ''}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail(await res.json());
    } catch (e: any) {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (selected) loadDetail(selected); else setDetail(null); }, [selected]);

  const captureSnapshot = async () => {
    setSnapshotting(true); setSnapMsg(null);
    try {
      const res = await fetch('/api/admin/readiness/snapshot', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (json.status === 'error') throw new Error(json.error || 'snapshot failed');
      setSnapMsg(`Snapshot captured for ${json.captured?.length || 0} products`);
      if (selected) await loadDetail(selected, true);
    } catch (e: any) {
      setSnapMsg(`Snapshot failed: ${String(e?.message || e)}`);
    } finally {
      setSnapshotting(false);
      setTimeout(() => setSnapMsg(null), 4000);
    }
  };

  const sparkPoints = useMemo(() => (detail?.history || [])
    .map(h => h.overall_score).filter((v): v is number => v != null), [detail]);

  // ── product grid ──────────────────────────────────────────────────────────
  const Grid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {(products || []).map(p => {
        const b = bandOf(p.overall_band);
        const m = BAND_META[b];
        const color = p.overall_score == null ? '#94A3B8' : m.color;
        return (
          <button key={p.key} onClick={() => setSelected(p.key)}
            className="text-left bg-white border rounded-2xl p-5 hover:shadow-md transition-shadow"
            style={{ borderColor: '#e7ebf1' }}>
            <div className="flex items-start gap-4">
              <GaugeRing score={p.overall_score} color={color} size={104} stroke={9} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-slate-800 leading-tight">{p.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: m.color, background: m.bg }}>{m.label}</span>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-1 leading-snug">{p.tagline}</p>
                <p className="text-[11px] text-slate-400 mt-2">
                  {p.measured_dimensions}/{p.total_dimensions} dimensions measured
                </p>
              </div>
            </div>
            {/* dimension chips */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {p.dimensions.map(d => {
                const db = bandOf(d.band);
                const dm = BAND_META[db];
                return (
                  <span key={d.key}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    title={d.available ? `${d.label}: ${d.score}` : `${d.label}: not measurable`}
                    style={{ color: d.available ? dm.color : '#94A3B8', background: d.available ? dm.bg : '#F1F5F9' }}>
                    {d.label.slice(0, 4)} {d.available ? d.score : '—'}
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );

  // ── product detail ────────────────────────────────────────────────────────
  const Detail = () => {
    if (!detail) return null;
    const b = bandOf(detail.overall_band);
    const m = BAND_META[b];
    const tr = detail.trend;
    const TrendIcon = tr?.direction === 'up' ? TrendingUp : tr?.direction === 'down' ? TrendingDown : Minus;
    const trendColor = tr?.direction === 'up' ? '#059669' : tr?.direction === 'down' ? '#DC2626' : '#64748B';
    return (
      <div>
        <button onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-slate-700 mb-4">
          <ChevronLeft className="h-4 w-4" /> All products
        </button>

        {/* hero: gauge + trend + history */}
        <div className="bg-white border rounded-2xl p-6 mb-5" style={{ borderColor: '#e7ebf1' }}>
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex items-center gap-5">
              <GaugeRing score={detail.overall_score} color={detail.overall_score == null ? '#94A3B8' : m.color} />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-bold text-slate-800">{detail.name}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: m.color, background: m.bg }}>{m.label}</span>
                </div>
                <p className="text-[12px] text-slate-500 mt-1 max-w-xs">{detail.tagline}</p>
                <p className="text-[11px] text-slate-400 mt-2">{detail.measured_dimensions}/{detail.total_dimensions} dimensions measured</p>
                <button onClick={() => setActiveTab(detail.tab)}
                  className="flex items-center gap-1 mt-2 text-[11.5px] font-medium" style={{ color: PRIMARY }}>
                  Open command center <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* trend + history */}
            <div className="flex-1 w-full lg:border-l lg:pl-6" style={{ borderColor: '#eef2f7' }}>
              <div className="flex items-center gap-2 mb-2">
                <HistoryIcon className="h-4 w-4 text-slate-400" />
                <span className="text-[12.5px] font-bold text-slate-700">Readiness over time</span>
              </div>
              {tr?.available ? (
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center gap-1 text-[13px] font-bold" style={{ color: trendColor }}>
                    <TrendIcon className="h-4 w-4" />
                    {tr.delta != null && tr.delta > 0 ? '+' : ''}{tr.delta}
                  </span>
                  <span className="text-[11px] text-slate-400">since previous snapshot ({tr.previous} → {tr.current})</span>
                </div>
              ) : (
                <p className="text-[11.5px] text-slate-400 mb-2">
                  Insufficient history for a trend — capture at least two snapshots.
                </p>
              )}
              {sparkPoints.length >= 2 ? (
                <Sparkline points={sparkPoints} color={PRIMARY} />
              ) : (
                <div className="h-[48px] flex items-center text-[11px] text-slate-300">
                  {detail.history.length === 0 ? 'No snapshots captured yet.' : 'Need ≥2 snapshots to chart.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 8 dimension cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {detail.dimensions.map(d => {
            const db = bandOf(d.band);
            const dm = BAND_META[db];
            return (
              <div key={d.key} className="bg-white border rounded-xl p-4" style={{ borderColor: '#e7ebf1' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-bold text-slate-700">{d.label}</span>
                  {d.available ? (
                    <span className="text-[18px] font-bold" style={{ color: dm.color }}>{d.score}</span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-300">N/A</span>
                  )}
                </div>
                {d.description && <p className="text-[10.5px] text-slate-400 mt-0.5 leading-snug">{d.description}</p>}
                {d.available ? (
                  <>
                    <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: dm.color }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">{d.met}/{d.total} signals materialized</p>
                    <div className="mt-2 space-y-1">
                      {(d.signals || []).map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10.5px]">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: s.met ? '#059669' : s.queryable ? '#CBD5E1' : '#FCA5A5' }} />
                          <span className="text-slate-500 truncate flex-1">{s.label}</span>
                          <span className="text-slate-400 font-mono">{s.n == null ? '—' : s.n}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[10.5px] text-slate-400 mt-3">Not measurable for this product — no real source in this environment.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-4" style={{ borderColor: '#e7ebf1' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,78,134,0.1)' }}>
            <Gauge className="h-5 w-5" style={{ color: PRIMARY }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-slate-800 leading-tight">Readiness Dashboards</h1>
            <p className="text-[12px] text-slate-500">Product readiness across 8 dimensions — measured, not estimated</p>
          </div>
          {snapMsg && <span className="text-[11.5px] font-medium text-slate-500">{snapMsg}</span>}
          <button onClick={captureSnapshot} disabled={snapshotting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50"
            style={{ background: PRIMARY }}>
            <Camera className={`h-3.5 w-3.5 ${snapshotting ? 'animate-pulse' : ''}`} /> Capture snapshot
          </button>
          <button onClick={() => { loadAll(true); if (selected) loadDetail(selected, true); }} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            style={{ borderColor: '#e7ebf1' }}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {loading && !products ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Computing readiness…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
            <p className="text-sm text-slate-600">Couldn’t load Readiness Dashboards.</p>
            <p className="text-[12px] text-slate-400 mt-1">{error}</p>
            <button onClick={() => loadAll(true)} className="mt-3 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white" style={{ background: PRIMARY }}>Retry</button>
          </div>
        ) : selected ? (
          detailLoading && !detail ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading {selected}…
            </div>
          ) : <Detail />
        ) : (
          <Grid />
        )}
      </div>
    </div>
  );
}
