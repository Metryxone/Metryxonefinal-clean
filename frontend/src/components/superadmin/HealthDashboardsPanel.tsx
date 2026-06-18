import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw, Loader2, HeartPulse, AlertTriangle, ChevronLeft, TrendingUp, TrendingDown,
  Minus, Camera, CheckCircle2, AlertCircle, XCircle, HelpCircle, Info, Activity,
  Server, Database, Layers, ShieldCheck, ClipboardCheck, Radio,
} from 'lucide-react';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';

/**
 * Health Dashboards — real-time platform health over GET /api/admin/health.
 * HONEST model (mirrors backend): 6 domains (Platform/Data/Assessment/API/DB/
 * Security), each run as REAL checks. ok/warn/fail are scored (100/50/0); info
 * is shown but not scored; unknown means "not measurable here" (excluded, never
 * scored 0). Domain status = down/degraded/healthy/unknown. Live polling powers
 * the real-time widgets; explicitly-captured snapshots power the trend charts.
 */

type DomainStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
type CheckStatus = 'ok' | 'warn' | 'fail' | 'info' | 'unknown';

interface Check { label: string; status: CheckStatus; value: string | null; detail: string | null; }
interface Domain {
  key: string; label: string; description: string;
  status: DomainStatus; score: number | null;
  counts: Record<string, number>; checks: Check[];
}
interface Trend {
  available: boolean; reason?: string;
  direction: 'up' | 'down' | 'flat' | 'none';
  current: number | null; previous: number | null; delta: number | null;
}
interface HistoryPoint { score: number | null; status: string | null; captured_at: string; }

const STATUS_META: Record<DomainStatus, { label: string; color: string; bg: string }> = {
  healthy: { label: 'Healthy', color: '#059669', bg: '#D1FAE5' },
  degraded: { label: 'Degraded', color: '#CA8A04', bg: '#FEF9C3' },
  down: { label: 'Down', color: '#DC2626', bg: '#FEE2E2' },
  unknown: { label: 'Unknown', color: '#94A3B8', bg: '#F1F5F9' },
};
const statusOf = (s: string): DomainStatus => (['healthy', 'degraded', 'down', 'unknown'].includes(s) ? s as DomainStatus : 'unknown');

const CHECK_META: Record<CheckStatus, { color: string; Icon: any }> = {
  ok: { color: '#059669', Icon: CheckCircle2 },
  warn: { color: '#CA8A04', Icon: AlertCircle },
  fail: { color: '#DC2626', Icon: XCircle },
  info: { color: '#64748B', Icon: Info },
  unknown: { color: '#94A3B8', Icon: HelpCircle },
};

const DOMAIN_ICON: Record<string, any> = {
  platform: Server, data: Database, assessment: ClipboardCheck, api: Activity, db: Layers, security: ShieldCheck,
};

/** small SVG status ring for a 0-100 score (null → dashed "unknown" ring) */
function ScoreRing({ score, color, size = 92, stroke = 8 }: { score: number | null; color: string; size?: number; stroke?: number }) {
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
          <span className="text-[11px] text-slate-400">N/A</span>
        ) : (
          <>
            <span className="text-[22px] font-bold leading-none" style={{ color }}>{score}</span>
            <span className="text-[9px] text-slate-400 mt-0.5">/ 100</span>
          </>
        )}
      </div>
    </div>
  );
}

/** pulsing status dot for the real-time indicator */
function StatusDot({ status }: { status: DomainStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {status !== 'unknown' && (
        <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: m.color }} />
      )}
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: m.color }} />
    </span>
  );
}

/** trend chart of score history */
function TrendChart({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 280, h = 60, pad = 6;
  const min = Math.min(...points, 0), max = Math.max(...points, 100);
  const span = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return { x, y };
  });
  const d = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${d} L${coords[coords.length - 1].x.toFixed(1)},${h - pad} L${coords[0].x.toFixed(1)},${h - pad} Z`;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id="healthTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#healthTrendFill)" stroke="none" />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} />)}
    </svg>
  );
}

export default function HealthDashboardsPanel() {
  const { BRAND } = useAdminDashboard() as any;
  const PRIMARY = BRAND?.primary || '#344E86';
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [overall, setOverall] = useState<{ score: number | null; status: DomainStatus }>({ score: null, status: 'unknown' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<(Domain & { trend: Trend; history: HistoryPoint[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapMsg, setSnapMsg] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;

  const loadAll = async (refresh = false) => {
    if (!domains) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/health${refresh ? '?refresh=1' : ''}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDomains(json.domains || []);
      setOverall({ score: json.overall_score ?? null, status: statusOf(json.overall_status || 'unknown') });
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (key: string, refresh = false) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/health/${key}${refresh ? '?refresh=1' : ''}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail(await res.json());
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (selected) loadDetail(selected); else setDetail(null); }, [selected]);

  // real-time polling (every 15s, matches backend cache TTL)
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      loadAll();
      if (selectedRef.current) loadDetail(selectedRef.current);
    }, 15_000);
    return () => clearInterval(id);
  }, [live]);

  const captureSnapshot = async () => {
    setSnapshotting(true); setSnapMsg(null);
    try {
      const res = await fetch('/api/admin/health/snapshot', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (json.status === 'error') throw new Error(json.error || 'snapshot failed');
      setSnapMsg(`Snapshot captured for ${json.captured?.length || 0} domains`);
      if (selected) await loadDetail(selected, true);
    } catch (e: any) {
      setSnapMsg(`Snapshot failed: ${String(e?.message || e)}`);
    } finally {
      setSnapshotting(false);
      setTimeout(() => setSnapMsg(null), 4000);
    }
  };

  const trendPoints = useMemo(() => (detail?.history || [])
    .map(h => h.score).filter((v): v is number => v != null), [detail]);

  // ── domain grid (real-time widgets) ─────────────────────────────────────────
  const Grid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {(domains || []).map(d => {
        const st = statusOf(d.status);
        const m = STATUS_META[st];
        const color = d.score == null ? '#94A3B8' : m.color;
        const Icon = DOMAIN_ICON[d.key] || HeartPulse;
        return (
          <button key={d.key} onClick={() => setSelected(d.key)}
            className="text-left bg-white border rounded-2xl p-5 hover:shadow-md transition-shadow"
            style={{ borderColor: '#e7ebf1' }}>
            <div className="flex items-start gap-4">
              <ScoreRing score={d.score} color={color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" style={{ color: PRIMARY }} />
                  <span className="text-[14px] font-bold text-slate-800 leading-tight truncate">{d.label}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <StatusDot status={st} />
                  <span className="text-[11px] font-bold" style={{ color: m.color }}>{m.label}</span>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-1.5 leading-snug">{d.description}</p>
              </div>
            </div>
            {/* check status chips */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {(['ok', 'warn', 'fail', 'info', 'unknown'] as CheckStatus[]).map(s => {
                const n = d.counts?.[s] || 0;
                if (!n) return null;
                const cm = CHECK_META[s];
                return (
                  <span key={s} className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ color: cm.color, background: `${cm.color}14` }}>
                    <cm.Icon className="h-3 w-3" /> {n}
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );

  // ── domain detail ───────────────────────────────────────────────────────────
  const Detail = () => {
    if (!detail) return null;
    const st = statusOf(detail.status);
    const m = STATUS_META[st];
    const color = detail.score == null ? '#94A3B8' : m.color;
    const Icon = DOMAIN_ICON[detail.key] || HeartPulse;
    const tr = detail.trend;
    const TrendIcon = tr?.direction === 'up' ? TrendingUp : tr?.direction === 'down' ? TrendingDown : Minus;
    const trendColor = tr?.direction === 'up' ? '#059669' : tr?.direction === 'down' ? '#DC2626' : '#64748B';
    return (
      <div>
        <button onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-slate-700 mb-4">
          <ChevronLeft className="h-4 w-4" /> All domains
        </button>

        {/* hero: score + status + trend */}
        <div className="bg-white border rounded-2xl p-6 mb-5" style={{ borderColor: '#e7ebf1' }}>
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex items-center gap-5">
              <ScoreRing score={detail.score} color={color} size={120} stroke={10} />
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" style={{ color: PRIMARY }} />
                  <h2 className="text-[18px] font-bold text-slate-800">{detail.label}</h2>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <StatusDot status={st} />
                  <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ color: m.color, background: m.bg }}>{m.label}</span>
                </div>
                <p className="text-[12px] text-slate-500 mt-2 max-w-xs">{detail.description}</p>
              </div>
            </div>

            {/* trend chart from snapshots */}
            <div className="flex-1 w-full lg:border-l lg:pl-6" style={{ borderColor: '#eef2f7' }}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-slate-400" />
                <span className="text-[12.5px] font-bold text-slate-700">Health over time</span>
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
                <p className="text-[11.5px] text-slate-400 mb-2">Insufficient history for a trend — capture at least two snapshots.</p>
              )}
              {trendPoints.length >= 2 ? (
                <TrendChart points={trendPoints} color={PRIMARY} />
              ) : (
                <div className="h-[60px] flex items-center text-[11px] text-slate-300">
                  {detail.history.length === 0 ? 'No snapshots captured yet.' : 'Need ≥2 snapshots to chart.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* checks list */}
        <div className="bg-white border rounded-2xl overflow-hidden" style={{ borderColor: '#e7ebf1' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: '#eef2f7' }}>
            <span className="text-[12.5px] font-bold text-slate-700">Checks ({detail.checks.length})</span>
          </div>
          <div className="divide-y" style={{ borderColor: '#f1f5f9' }}>
            {detail.checks.map((c, i) => {
              const cm = CHECK_META[c.status];
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <cm.Icon className="h-4 w-4 shrink-0" style={{ color: cm.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-slate-700 truncate">{c.label}</p>
                    {c.detail && <p className="text-[11px] text-slate-400 truncate">{c.detail}</p>}
                  </div>
                  {c.value != null && (
                    <span className="text-[12px] font-mono font-semibold shrink-0" style={{ color: cm.color }}>{c.value}</span>
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                    style={{ color: cm.color, background: `${cm.color}14` }}>{c.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-4" style={{ borderColor: '#e7ebf1' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,78,134,0.1)' }}>
            <HeartPulse className="h-5 w-5" style={{ color: PRIMARY }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-slate-800 leading-tight">Health Dashboards</h1>
            <p className="text-[12px] text-slate-500">Real-time platform health across 6 domains — measured, not estimated</p>
          </div>

          {/* overall status pill */}
          {!selected && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={{ borderColor: '#e7ebf1' }}
              title="Status reflects the worst failing domain (any failed check → Down); score is the average of scored checks (ok/warn/fail). They are separate signals.">
              <StatusDot status={overall.status} />
              <span className="text-[12px] font-bold" style={{ color: STATUS_META[overall.status].color }}>
                {STATUS_META[overall.status].label}
              </span>
              {overall.score != null && <span className="text-[12px] font-mono text-slate-500">{overall.score}/100</span>}
            </div>
          )}

          {snapMsg && <span className="text-[11.5px] font-medium text-slate-500">{snapMsg}</span>}

          {/* live toggle */}
          <button onClick={() => setLive(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium disabled:opacity-50"
            style={{ borderColor: live ? '#059669' : '#e7ebf1', color: live ? '#059669' : '#64748B', background: live ? '#ECFDF5' : '#fff' }}>
            <Radio className={`h-3.5 w-3.5 ${live ? 'animate-pulse' : ''}`} /> {live ? 'Live' : 'Paused'}
          </button>

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
        {lastUpdated && (
          <p className="text-[10.5px] text-slate-400 mt-2">
            Last updated {lastUpdated.toLocaleTimeString()}{live ? ' · auto-refreshing every 15s' : ''}
          </p>
        )}
      </div>

      {/* body */}
      <div className="p-6">
        {loading && !domains ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Checking platform health…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
            <p className="text-sm text-slate-600">Couldn’t load Health Dashboards.</p>
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
