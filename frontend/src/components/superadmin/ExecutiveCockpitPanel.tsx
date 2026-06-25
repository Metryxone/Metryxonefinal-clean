import { BRAND } from '@/design-system/tokens';
import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Loader2, Briefcase, Users, TrendingUp, ShieldCheck, AlertTriangle,
  Building2, Landmark, LineChart, Info,
} from 'lucide-react';

/**
 * Executive Intelligence — CEO / CHRO / Investor / Government cockpits.
 *
 * HONEST composition: this panel does NOT compute new metrics. It re-frames
 * already-measured data from three live, read-only sources:
 *   - GET /api/admin/readiness          (per-product, per-dimension readiness)
 *   - GET /api/admin/mission-control    (platform-wide population widgets)
 *   - GET /api/analytics/executive      (KPI / cohort / predictive rollups)
 *
 * Every fetch fails closed to an honest empty state (never throws, never
 * fabricates). Runtime figures are partly demo-seeded — disclosed in-banner.
 */



type Band = 'ready' | 'partial' | 'early' | 'idle' | 'unavailable';
interface Dimension { key: string; label: string; available: boolean; score: number | null; band: string; }
interface ProductSummary {
  key: string; name: string; tab: string;
  overall_score: number | null; overall_band: Band;
  measured_dimensions: number; total_dimensions: number;
  dimensions: Dimension[];
}

type Role = 'ceo' | 'chro' | 'investor' | 'government';
const ROLES: { id: Role; label: string; icon: any; blurb: string }[] = [
  { id: 'ceo',        label: 'CEO',        icon: Briefcase, blurb: 'Platform readiness & product portfolio' },
  { id: 'chro',       label: 'CHRO',       icon: Users,     blurb: 'Talent intelligence & workforce signal' },
  { id: 'investor',   label: 'Investor',   icon: TrendingUp,blurb: 'Commercial surface & growth posture' },
  { id: 'government', label: 'Government', icon: Landmark,  blurb: 'Governance, security & compliance posture' },
];

const bandColor = (b: string): string =>
  b === 'ready' ? '#059669' : b === 'partial' ? '#CA8A04' : b === 'early' ? '#EA580C' : '#94A3B8';

function num(v: any): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && isFinite(n) ? n : null;
}

/** Compact 0-100 ring. null → dashed "not measurable". */
function Ring({ score, size = 96, stroke = 9, color }: { score: number | null; size?: number; stroke?: number; color: string }) {
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
        <span className="text-lg font-bold" style={{ color: score == null ? '#94A3B8' : color }}>
          {score == null ? 'N/A' : Math.round(score)}
        </span>
        {score != null && <span className="text-[9px] text-slate-400">/ 100</span>}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: React.ReactNode; sub?: string; icon: any }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: BRAND.primary }}>{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <Icon className="h-7 w-7" style={{ color: BRAND.accent }} />
      </div>
    </div>
  );
}

function DimBar({ label, score }: { label: string; score: number | null }) {
  const color = score == null ? '#CBD5E1' : score >= 80 ? '#059669' : score >= 50 ? '#CA8A04' : '#EA580C';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-600 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score == null ? 0 : Math.max(2, Math.min(100, score))}%`, background: color }} />
      </div>
      <span className="text-xs font-medium w-12 text-right" style={{ color }}>
        {score == null ? 'N/A' : `${Math.round(score)}%`}
      </span>
    </div>
  );
}

export default function ExecutiveCockpitPanel() {
  const [role, setRole] = useState<Role>('ceo');
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<ProductSummary[]>([]);
  const [mission, setMission] = useState<any>(null);
  const [exec, setExec] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const safe = async (url: string) => {
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    };
    const [rd, mc, ex] = await Promise.all([
      safe('/api/admin/readiness'),
      safe('/api/admin/mission-control'),
      safe('/api/analytics/executive'),
    ]);
    setReadiness(Array.isArray(rd?.products) ? rd.products : []);
    setMission(mc || null);
    setExec(ex || null);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // ── derived (composition only) ────────────────────────────────────────────
  const platformScore = useMemo(() => {
    const xs = readiness.map(p => num(p.overall_score)).filter((x): x is number => x != null);
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
  }, [readiness]);

  const dimMean = (key: string): number | null => {
    const xs = readiness
      .map(p => p.dimensions.find(d => d.key === key))
      .filter(d => d && d.available)
      .map(d => num(d!.score))
      .filter((x): x is number => x != null);
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  };

  const productsBy = (keys: string[]) => readiness.filter(p => keys.includes(p.key));

  // mission-control / executive figures are honest-optional
  const predictive = exec?.predictive || {};
  const kpis: any[] = Array.isArray(exec?.kpis) ? exec.kpis : [];
  const kpi = (name: string): number | null => num(kpis.find(k => k.metric_name === name)?.metric_value);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading executive intelligence…
      </div>
    );
  }

  const active = ROLES.find(r => r.id === role)!;

  return (
    <div className="p-6 space-y-6">
      {/* header + role tabs */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: BRAND.primary }}>
            <Briefcase className="h-5 w-5" /> Executive Intelligence
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{active.blurb}</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* disclosure */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Cockpits compose live read-only data from product readiness, mission control and analytics rollups —
          no figures are fabricated. Reference/config data is real; runtime population is partly
          <strong> demo-seeded</strong> and labelled as such at source. Dimensions with no real source read
          <strong> N/A</strong> (never scored 0).
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {ROLES.map(r => {
          const Icon = r.icon;
          const on = r.id === role;
          return (
            <button key={r.id} onClick={() => setRole(r.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition"
              style={on ? { background: BRAND.primary, color: 'white', borderColor: BRAND.primary } : { color: '#475569' }}>
              <Icon className="h-4 w-4" /> {r.label}
            </button>
          );
        })}
      </div>

      {/* ── CEO ─────────────────────────────────────────────────────────────── */}
      {role === 'ceo' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-white p-4 flex items-center gap-4">
              <Ring score={platformScore} color={BRAND.primary} />
              <div>
                <p className="text-xs text-slate-500">Platform Readiness</p>
                <p className="text-[11px] text-slate-400 mt-1">Mean of {readiness.filter(p => num(p.overall_score) != null).length} measured products</p>
              </div>
            </div>
            <StatCard label="Products Tracked" value={readiness.length} sub="readiness engine" icon={Building2} />
            <StatCard label="Total Users" value={num(mission?.population?.totalUsers) ?? kpi('total_users') ?? '—'} sub="mission control" icon={Users} />
            <StatCard label="Sessions Completed" value={kpi('sessions_completed') ?? num(mission?.activity?.sessionsCompleted) ?? '—'} sub="analytics rollup" icon={LineChart} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Product Portfolio Readiness</h3>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {readiness.map(p => (
                <div key={p.key} className="rounded-xl border bg-white p-4 flex flex-col items-center text-center">
                  <Ring score={num(p.overall_score)} color={bandColor(p.overall_band)} />
                  <p className="text-sm font-medium mt-2">{p.name}</p>
                  <p className="text-[11px] text-slate-400">{p.measured_dimensions}/{p.total_dimensions} dims measured</p>
                </div>
              ))}
              {readiness.length === 0 && <p className="text-sm text-slate-400">No product readiness available.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── CHRO ────────────────────────────────────────────────────────────── */}
      {role === 'chro' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <StatCard label="Behaviour Profiled" value={num(predictive.behaviour_profiled) ?? '—'} sub="predictive features" icon={Users} />
            <StatCard label="At Risk" value={num(predictive.at_risk) ?? '—'} sub="developmental signal" icon={AlertTriangle} />
            <StatCard label="High Performers" value={num(predictive.high_performers) ?? '—'} sub="developmental signal" icon={TrendingUp} />
            <StatCard label="Avg Score" value={num(predictive.avg_score) ?? '—'} sub="cohort mean" icon={LineChart} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Talent Product Readiness</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {productsBy(['competency', 'employer', 'career', 'lbi', 'employability']).map(p => (
                <div key={p.key} className="rounded-xl border bg-white p-4 flex flex-col items-center text-center">
                  <Ring score={num(p.overall_score)} color={bandColor(p.overall_band)} />
                  <p className="text-sm font-medium mt-2">{p.name}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Outputs are developmental signals only — never hiring, promotion or suitability predictions.
          </p>
        </div>
      )}

      {/* ── Investor ────────────────────────────────────────────────────────── */}
      {role === 'investor' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-white p-4 flex items-center gap-4">
              <Ring score={dimMean('commercial')} color={BRAND.accent} />
              <div>
                <p className="text-xs text-slate-500">Commercial Readiness</p>
                <p className="text-[11px] text-slate-400 mt-1">Mean monetization surface across products</p>
              </div>
            </div>
            <StatCard label="Total Users" value={num(mission?.population?.totalUsers) ?? kpi('total_users') ?? '—'} sub="addressable base" icon={Users} />
            <StatCard label="Active (7d)" value={kpi('active_users_7d') ?? '—'} sub="engagement" icon={TrendingUp} />
            <StatCard label="Products Monetizable" value={readiness.filter(p => (num(p.dimensions.find(d => d.key === 'commercial')?.score) ?? 0) > 0).length} sub="commercial dim > 0" icon={Building2} />
          </div>
          <div className="rounded-xl border bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Commercial Surface by Product</h3>
            <div className="space-y-2.5">
              {readiness.map(p => (
                <DimBar key={p.key} label={p.name} score={num(p.dimensions.find(d => d.key === 'commercial')?.score)} />
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Structural commercial readiness (surface exists) is reported separately from realized revenue —
            no revenue is implied where none is recorded.
          </p>
        </div>
      )}

      {/* ── Government ───────────────────────────────────────────────────────── */}
      {role === 'government' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-white p-4 flex items-center gap-4">
              <Ring score={dimMean('governance')} color={BRAND.primary} />
              <div><p className="text-xs text-slate-500">Governance</p><p className="text-[11px] text-slate-400 mt-1">controls exercised</p></div>
            </div>
            <div className="rounded-xl border bg-white p-4 flex items-center gap-4">
              <Ring score={dimMean('security')} color={BRAND.accent} />
              <div><p className="text-xs text-slate-500">Security</p><p className="text-[11px] text-slate-400 mt-1">controls exercised</p></div>
            </div>
            <StatCard label="Operations" value={dimMean('operations') != null ? `${dimMean('operations')}%` : '—'} sub="mechanisms exercised" icon={ShieldCheck} />
            <StatCard label="Structural" value={dimMean('structural') != null ? `${dimMean('structural')}%` : '—'} sub="schema materialized" icon={Building2} />
          </div>
          <div className="rounded-xl border bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Governance &amp; Security by Product</h3>
            <div className="space-y-3">
              {readiness.map(p => (
                <div key={p.key} className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-600">{p.name}</p>
                  <DimBar label="Governance" score={num(p.dimensions.find(d => d.key === 'governance')?.score)} />
                  <DimBar label="Security" score={num(p.dimensions.find(d => d.key === 'security')?.score)} />
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Peer benchmarks and cohort outputs are k-anonymity suppressed below k=30. Compliance posture
            reflects exercised controls only — no certification status is asserted without evidence.
          </p>
        </div>
      )}
    </div>
  );
}
