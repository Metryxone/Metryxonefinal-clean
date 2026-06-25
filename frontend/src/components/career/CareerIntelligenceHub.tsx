import { BRAND } from '@/design-system/tokens';
/**
 * Career Intelligence Hub — 8-surface intelligence platform
 * Composes: Memory · Trajectory · Transition · Forecast · Outcomes · Interventions · Risk · Reports
 * All data from /api/career/hub/* endpoints (additive, never-throws).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, TrendingUp, Activity, Zap, Shield, History, FileText,
  CheckCircle, Circle, AlertCircle, Target, ChevronRight, ArrowRight,
  RefreshCw, Clock, Star, BarChart3, TrendingDown, Minus,
  ArrowUpRight, Lightbulb, Award, Cpu, Sliders, Printer, Users,
  BookOpen, Play, MessageSquare, GitBranch, ChevronDown,
} from 'lucide-react';

type HubTab = 'memory' | 'trajectory' | 'transition' | 'forecast' | 'outcomes' | 'interventions' | 'risk' | 'reports';



const TAB_CONFIG: { id: HubTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'memory',        label: 'Career Memory',      icon: <History size={14} />,      desc: 'Growth timeline & signal evolution' },
  { id: 'trajectory',   label: 'Trajectory',         icon: <TrendingUp size={14} />,   desc: 'Role switchability rankings' },
  { id: 'transition',   label: 'Transition Path',    icon: <ArrowUpRight size={14} />, desc: 'Current → bridge → target role path' },
  { id: 'forecast',     label: 'Forecast',           icon: <Activity size={14} />,     desc: 'Risk, growth & journey projections' },
  { id: 'outcomes',     label: 'Outcomes',           icon: <Target size={14} />,       desc: 'Attributed career improvements' },
  { id: 'interventions',label: 'Interventions',      icon: <Zap size={14} />,          desc: 'Ranked actions with impact scores' },
  { id: 'risk',         label: 'Risk & Opportunity', icon: <Shield size={14} />,       desc: 'Risk signals & opportunity score' },
  { id: 'reports',      label: 'Reports',            icon: <FileText size={14} />,     desc: 'Narrative intelligence summary' },
];

function useFetch<T>(url: string, enabled: boolean): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick(t => t + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(url, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [url, enabled, tick]);
  return { data, loading, error, refetch };
}

function Sparkline({ points, color = BRAND.primary, height = 40 }: { points: (number | null)[]; color?: string; height?: number }) {
  const valid = points.map((p, i) => ({ v: p, i })).filter(p => p.v != null) as { v: number; i: number }[];
  if (valid.length < 2) return <div style={{ height }} className="flex items-center justify-center text-xs text-gray-400">— no trend data —</div>;
  const min = Math.min(...valid.map(p => p.v));
  const max = Math.max(...valid.map(p => p.v));
  const range = Math.max(1, max - min);
  const w = 120; const h = height;
  const xs = valid.map(p => (p.i / (points.length - 1)) * w);
  const ys = valid.map(p => h - ((p.v - min) / range) * (h - 4) - 2);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {valid.map((p, i) => i === valid.length - 1 && (
        <circle key={i} cx={xs[i]} cy={ys[i]} r={3} fill={color} />
      ))}
    </svg>
  );
}

function ScoreRing({ score, label, color, size = 80 }: { score: number | null; label: string; color: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? Math.min(100, Math.max(0, score)) / 100 : 0;
  const dash = pct * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={7} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize={15} fontWeight="700" fill={color}>
          {score != null ? Math.round(score) : '—'}
        </text>
      </svg>
      <span className="text-xs text-gray-500 font-medium">{label}</span>
    </div>
  );
}

function DimBar({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? Math.min(100, Math.max(0, value * 100)) : 0;
  const color = pct >= 70 ? BRAND.green : pct >= 40 ? BRAND.accent : BRAND.orange;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span className="capitalize">{label}</span>
        <span className="font-medium">{value != null ? Math.round(pct) : '—'}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function DirectionBadge({ dir }: { dir: string }) {
  if (dir === 'rising' || dir === 'improving') return <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 flex items-center gap-0.5"><TrendingUp size={10} />Rising</span>;
  if (dir === 'falling' || dir === 'declining') return <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 flex items-center gap-0.5"><TrendingDown size={10} />Falling</span>;
  return <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-0.5"><Minus size={10} />Stable</span>;
}

function ConfidenceBadge({ band }: { band: string }) {
  const map: Record<string, string> = { high: 'bg-green-50 text-green-700', moderate: 'bg-amber-50 text-amber-700', low: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${map[band] ?? 'bg-gray-100 text-gray-600'}`}>{band} confidence</span>;
}

function SectionEmpty({ title, message, cta, onCta }: { title: string; message: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3 max-w-xs mx-auto">
      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
        <Brain size={22} color={BRAND.primary} />
      </div>
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="text-sm text-gray-400">{message}</p>
      {cta && onCta && (
        <button onClick={onCta} className="mt-1 text-sm font-medium px-4 py-1.5 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors flex items-center gap-1">
          {cta} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

/* ── Onboarding Guide ────────────────────────────────────────────────────── */
function OnboardingGuide({ onboarding }: { onboarding: any }) {
  if (!onboarding?.steps?.length) return null;
  const steps = onboarding.steps as any[];
  const pct = onboarding.completion_pct ?? 0;
  const ICONS: Record<string, React.ReactNode> = {
    profile:    <Users size={13} />,
    competency: <BarChart3 size={13} />,
    capadex:    <Brain size={13} />,
    pragati:    <MessageSquare size={13} />,
    snapshot:   <History size={13} />,
  };
  return (
    <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
          <Play size={14} color={BRAND.primary} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Build your Career Intelligence</p>
          <p className="text-xs text-gray-400">{onboarding.completed_count}/{onboarding.total} steps complete — your hub unlocks richer data with each step</p>
        </div>
        <span className="ml-auto text-sm font-bold" style={{ color: BRAND.primary }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: BRAND.primary }} />
      </div>
      <div className="space-y-2">
        {steps.map((step: any, i: number) => (
          <div key={step.id} className={`flex items-center gap-3 p-3 rounded-lg border ${step.done ? 'border-green-100 bg-green-50/50' : 'border-gray-100 bg-gray-50'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${step.done ? 'bg-green-100 text-green-600' : 'bg-white border border-gray-200 text-gray-400'}`}>
              {step.done ? <CheckCircle size={13} className="text-green-600" /> : ICONS[step.id] ?? <span className="font-medium">{i + 1}</span>}
            </div>
            <span className={`text-sm flex-1 leading-snug ${step.done ? 'text-green-700 opacity-70 line-through' : 'text-gray-700'}`}>{step.label}</span>
            {!step.done && <span className="text-xs text-blue-600 font-medium shrink-0">{step.cta_label} →</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── What-if Simulator ───────────────────────────────────────────────────── */
function WhatsIfSimulator({ targetRole, currentLevels, eiScore, vel }: {
  targetRole: any;
  currentLevels: Record<string, number>;
  eiScore: number;
  vel?: number;
}) {
  const comps = (targetRole?.competencies ?? []) as { id: string; req: number }[];
  const keyGaps = (targetRole?.key_gaps ?? []) as string[];
  const gapComps = comps.filter(c => keyGaps.includes(c.id));
  const [bonus, setBonus] = useState<Record<string, number>>(() =>
    Object.fromEntries(gapComps.map(c => [c.id, 0]))
  );

  if (gapComps.length === 0) return null;

  const adjustedLevels = { ...currentLevels };
  Object.entries(bonus).forEach(([id, b]) => {
    adjustedLevels[id] = Math.min(5, (currentLevels[id] ?? 0) + b);
  });
  const met = comps.filter(c => (adjustedLevels[c.id] ?? 0) >= c.req - 1).length;
  const sw  = Math.min(100, Math.round((met / Math.max(1, comps.length)) * 60 + Math.min(1, eiScore / Math.max(1, targetRole?.min_ei ?? targetRole?.minEI ?? 50)) * 40));
  const gap = comps.reduce((s, c) => s + Math.max(0, c.req - (adjustedLevels[c.id] ?? 0)), 0);
  const eta = Math.min(48, Math.max(1, Math.ceil(gap / Math.max(0.05, vel ?? 0.15) / 2)));
  const origSw  = targetRole?.switchability ?? 0;
  const origEta = targetRole?.eta_months ?? 0;
  const swDiff  = sw - origSw;
  const etaDiff = origEta - eta;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Sliders size={15} color={BRAND.accent} />
        <p className="text-sm font-semibold text-gray-700">What-if Simulator</p>
        <span className="text-xs text-gray-400 ml-1">— drag to see how improving each skill changes your ETA</span>
        <button onClick={() => setBonus(Object.fromEntries(gapComps.map(c => [c.id, 0])))}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors">Reset</button>
      </div>

      <div className="space-y-3">
        {gapComps.map(c => {
          const cur = currentLevels[c.id] ?? 0;
          const b = bonus[c.id] ?? 0;
          return (
            <div key={c.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-700 font-medium capitalize">{c.id.replace(/-/g, ' ')}</span>
                <span className="text-gray-400">
                  Level {cur} → <span className="font-semibold text-gray-700">{Math.min(5, cur + b)}</span>
                  <span className="text-gray-300 mx-1">/</span>{c.req} required
                </span>
              </div>
              <input type="range" min={0} max={Math.max(1, c.req - cur)} step={1} value={b}
                onChange={e => setBonus(prev => ({ ...prev, [c.id]: Number(e.target.value) }))}
                className="w-full h-1.5 cursor-pointer" style={{ accentColor: BRAND.accent }} />
              <div className="flex justify-between text-xs text-gray-300">
                <span>No change</span>
                <span>+{Math.max(1, c.req - cur)} levels</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Switchability</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-black text-gray-400">{origSw}%</span>
            {swDiff !== 0 && <>
              <ArrowRight size={12} className="text-gray-300" />
              <span className="text-lg font-black" style={{ color: swDiff > 0 ? BRAND.green : BRAND.red }}>{sw}%</span>
            </>}
          </div>
          {swDiff > 0 && <p className="text-xs text-green-600 mt-0.5 font-medium">+{swDiff}%</p>}
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Time to transition</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-black text-gray-400">{origEta}mo</span>
            {etaDiff !== 0 && <>
              <ArrowRight size={12} className="text-gray-300" />
              <span className="text-lg font-black" style={{ color: etaDiff > 0 ? BRAND.green : BRAND.red }}>{eta}mo</span>
            </>}
          </div>
          {etaDiff > 0 && <p className="text-xs text-green-600 mt-0.5 font-medium">{etaDiff} months sooner</p>}
        </div>
      </div>

      {(swDiff !== 0 || etaDiff !== 0) && (
        <p className="text-xs text-center font-medium" style={{ color: BRAND.green }}>
          With these improvements:{' '}
          {swDiff > 0 ? `+${swDiff}% switchability` : ''}
          {swDiff > 0 && etaDiff > 0 ? ' · ' : ''}
          {etaDiff > 0 ? `${etaDiff} months sooner` : ''}
        </p>
      )}
    </div>
  );
}

/* ── Historical Snapshot Comparison ──────────────────────────────────────── */
function SnapshotComparison({ timeline }: { timeline: any[] }) {
  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(timeline.length - 1);
  if (timeline.length < 2) return null;

  const snapA = timeline[idxA];
  const snapB = timeline[idxB];
  const metrics: { key: string; label: string; fmt?: (v: number) => string }[] = [
    { key: 'ei_score',             label: 'EI Score' },
    { key: 'market_readiness',     label: 'Market Readiness' },
    { key: 'interview_readiness',  label: 'Interview Readiness' },
    { key: 'transition_probability', label: 'Transition Probability', fmt: v => `${v}%` },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch size={15} color={BRAND.accent} />
        <p className="text-sm font-semibold text-gray-700">Compare Snapshots</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {['A', 'B'].map((side, si) => {
          const idx = si === 0 ? idxA : idxB;
          const setIdx = si === 0 ? setIdxA : setIdxB;
          return (
            <div key={side}>
              <p className="text-xs text-gray-400 mb-1">Snapshot {side}</p>
              <select value={idx} onChange={e => setIdx(Number(e.target.value))}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700">
                {timeline.map((t, i) => (
                  <option key={i} value={i}>{new Date(t.date).toLocaleDateString()}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        {metrics.map(m => {
          const a = snapA?.[m.key] as number | null;
          const b = snapB?.[m.key] as number | null;
          const delta = a != null && b != null ? b - a : null;
          const fmt = m.fmt ?? ((v: number) => String(Math.round(v)));
          return (
            <div key={m.key} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs">
              <span className="text-gray-500 font-medium">{m.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">{a != null ? fmt(a) : '—'}</span>
                <ArrowRight size={10} className="text-gray-300" />
                <span className="font-semibold text-gray-700">{b != null ? fmt(b) : '—'}</span>
                {delta != null && (
                  <span className={`font-bold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    ({delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Memory Tab ─────────────────────────────────────────────────────────── */
function MemoryTab({ data, loading, onboarding, onboardingLoading }: {
  data: any; loading: boolean; onboarding: any; onboardingLoading: boolean;
}) {
  if (loading || onboardingLoading) return <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-gray-300" /></div>;

  const hasSnapshots = data && data.snapshot_count > 0;
  const capadex = data?.capadex;
  const pragati = data?.pragati;

  return (
    <div className="space-y-5">
      {/* Onboarding guide — always show until fully onboarded */}
      {onboarding && !onboarding.fully_onboarded && <OnboardingGuide onboarding={onboarding} />}

      {!hasSnapshots && !onboarding && (
        <SectionEmpty title="No memory snapshots yet" message="Your Career Brain captures a snapshot each time you complete an assessment or update your profile. Check back after your next session." />
      )}

      {hasSnapshots && (() => {
        const tl = (data.timeline ?? []) as any[];
        const eiSeries  = tl.map((t: any) => t.ei_score as number | null);
        const mrSeries  = tl.map((t: any) => t.market_readiness as number | null);
        const g = data.growth;
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">EI Timeline</p>
                <Sparkline points={eiSeries} color={BRAND.primary} height={48} />
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Market Readiness</p>
                <Sparkline points={mrSeries} color={BRAND.accent} height={48} />
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <p className="text-xs text-gray-500 mb-1">Snapshots tracked</p>
                <div className="text-3xl font-black" style={{ color: BRAND.primary }}>{data.snapshot_count}</div>
                {data.latest_stage && <p className="text-xs text-gray-500 mt-1">Stage: <span className="font-medium text-gray-700">{data.latest_stage}</span></p>}
              </div>
            </div>

            {g && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Improving signals', val: g.improving_signals?.length ?? 0, color: BRAND.green,  icon: <TrendingUp size={14} /> },
                  { label: 'Worsening signals', val: g.worsening_signals?.length ?? 0, color: BRAND.red,    icon: <TrendingDown size={14} /> },
                  { label: 'Stable patterns',   val: g.stable_patterns?.length ?? 0,   color: BRAND.accent, icon: <Minus size={14} /> },
                  { label: 'Emerging patterns', val: g.emerging_patterns?.length ?? 0,  color: BRAND.orange, icon: <Zap size={14} /> },
                ].map(item => (
                  <div key={item.label} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1" style={{ color: item.color }}>{item.icon}<span className="text-xs font-medium">{item.label}</span></div>
                    <div className="text-2xl font-bold" style={{ color: item.color }}>{item.val}</div>
                  </div>
                ))}
              </div>
            )}

            {data.core_bottleneck && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Primary bottleneck</p>
                  <p className="text-sm text-amber-700 mt-0.5">{data.core_bottleneck}</p>
                </div>
              </div>
            )}

            {(g?.improving_signals?.length > 0 || g?.emerging_patterns?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {g.improving_signals?.slice(0, 5).map((s: any) => (
                  <div key={s.key} className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 flex justify-between items-center text-sm">
                    <span className="text-green-800 font-medium">{s.label ?? s.key}</span>
                    <span className="text-green-600 text-xs">+{typeof s.delta === 'number' ? s.delta.toFixed(2) : '↑'}</span>
                  </div>
                ))}
                {g.emerging_patterns?.slice(0, 5).map((p: any) => (
                  <div key={p.key} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex justify-between items-center text-sm">
                    <span className="text-blue-800 font-medium">{p.label ?? p.key}</span>
                    <span className="text-xs text-blue-500">Emerging</span>
                  </div>
                ))}
              </div>
            )}

            {/* Historical snapshot comparison */}
            {tl.length >= 2 && <SnapshotComparison timeline={tl} />}
          </>
        );
      })()}

      {/* CAPADEX concern sessions */}
      {capadex && capadex.session_count > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Brain size={15} color={BRAND.primary} />
            <p className="text-sm font-semibold text-gray-700">CAPADEX Concern History</p>
            <span className="text-xs text-gray-400 ml-auto">{capadex.session_count} session{capadex.session_count !== 1 ? 's' : ''}</span>
          </div>
          {capadex.latest_concern && (
            <div className="px-3 py-2 bg-blue-50 rounded-lg text-sm">
              <span className="text-xs text-blue-500 font-medium uppercase tracking-wider">Latest concern</span>
              <p className="text-blue-800 font-semibold mt-0.5">{capadex.latest_concern}</p>
              {capadex.latest_score != null && <p className="text-xs text-blue-500 mt-0.5">Score: {Math.round(capadex.latest_score)} · Stage: {capadex.latest_stage ?? '—'}</p>}
            </div>
          )}
          {capadex.top_patterns?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Top behavioural patterns</p>
              {capadex.top_patterns.slice(0, 4).map((p: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: BRAND.accent }} />
                  <div>
                    <span className="font-medium text-gray-700">{p.label ?? p.key}</span>
                    {p.confidence != null && <span className="text-gray-400 ml-1.5">{Math.round(p.confidence * 100)}% confidence</span>}
                    {p.explanation && <p className="text-gray-400 mt-0.5 leading-relaxed">{p.explanation}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pragati conversation history */}
      {pragati && pragati.session_count > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} color={BRAND.primary} />
            <p className="text-sm font-semibold text-gray-700">Pragati Conversations</p>
            <span className="text-xs text-gray-400 ml-auto">{pragati.session_count} session{pragati.session_count !== 1 ? 's' : ''}</span>
          </div>
          {pragati.sessions?.slice(0, 3).map((s: any, i: number) => (
            <div key={i} className="px-3 py-2.5 bg-gray-50 rounded-lg space-y-1">
              {s.concern && <p className="text-sm font-medium text-gray-700 truncate">{s.concern}</p>}
              <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                {s.stage && <span className="capitalize">{s.stage.toLowerCase()}</span>}
                {s.turn_count > 0 && <span>{s.turn_count} turns</span>}
                {s.quality_score != null && <span>Quality: <span className="font-medium text-gray-600">{s.quality_score}/100</span></span>}
                {s.drift_direction && <DirectionBadge dir={s.drift_direction} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Trajectory Tab ─────────────────────────────────────────────────────── */
function TrajectoryTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-gray-300" /></div>;
  if (!data) return <SectionEmpty title="No trajectory data" message="Complete a competency assessment to unlock role-switchability scoring and time-to-transition estimates." />;
  const roles = (data.roles ?? []) as any[];
  const ei = data.ei_score as number;
  const pb = data.peer_benchmark;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Current EI Score</p>
          <div className="text-3xl font-black mt-1" style={{ color: BRAND.primary }}>{ei != null ? Math.round(ei) : '—'}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Target Role</p>
          <div className="text-base font-bold text-gray-800 mt-1">{data.target_role ?? '—'}</div>
          {data.transition_probability != null && <p className="text-xs text-gray-500 mt-1">{data.transition_probability}% transition probability</p>}
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Top Adjacent Role</p>
          <div className="text-base font-bold text-gray-800 mt-1">{data.top_transition?.title ?? '—'}</div>
          {data.top_transition && <p className="text-xs text-gray-500 mt-1">{data.top_transition.switchability}% switchability · {data.top_transition.eta_months}mo ETA</p>}
        </div>
      </div>

      {/* Peer benchmark */}
      {pb && !pb.redacted && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <Users size={16} style={{ color: BRAND.primary }} className="shrink-0" />
          <div>
            <p className="text-sm text-gray-800">
              <span className="font-bold" style={{ color: BRAND.primary }}>{pb.rank_label}</span>
              <span className="text-gray-500"> — {pb.percentile}th percentile among {pb.cohort_size.toLocaleString()} professionals at your EI level</span>
            </p>
          </div>
        </div>
      )}
      {pb?.redacted && (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-2 text-xs text-gray-400 text-center">
          Peer benchmarking requires 30+ professionals in your EI cohort · Data appears as the network grows ({pb.cohort_size ?? 0} currently)
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role Switchability Rankings</p>
        {roles.slice(0, 8).map((role: any) => (
          <div key={role.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-semibold text-gray-800 text-sm">{role.title}</span>
                <span className="ml-2 text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{role.family}</span>
                {!role.reachable && <span className="ml-2 text-xs text-red-500">EI too low</span>}
              </div>
              <div className="text-right">
                <span className="text-sm font-bold" style={{ color: role.switchability >= 70 ? BRAND.green : role.switchability >= 40 ? BRAND.accent : BRAND.orange }}>{role.switchability}%</span>
                <p className="text-xs text-gray-400">{role.eta_months}mo ETA</p>
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${role.switchability}%`, backgroundColor: role.switchability >= 70 ? BRAND.green : role.switchability >= 40 ? BRAND.accent : BRAND.orange }} />
            </div>
            {role.key_gaps?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {role.key_gaps.map((g: string) => (
                  <span key={g} className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">{g}</span>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-2 text-xs text-gray-400">
              <span>Demand: <span className="font-medium text-gray-600">{role.demand_score}/100</span></span>
              <span>Auto risk: <span className="font-medium text-gray-600">{role.automation_risk}%</span></span>
              <span>Salary P50: <span className="font-medium text-gray-600">₹{role.salary_p50}L</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Transition Path Tab ────────────────────────────────────────────────── */
function TransitionTab({ data, loading, competencyLevels, eiScore }: {
  data: any; loading: boolean;
  competencyLevels?: Record<string, number>;
  eiScore?: number;
}) {
  if (loading) return <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-gray-300" /></div>;
  if (!data?.ok || !data.path?.length) {
    return <SectionEmpty title="No transition path computed" message="Set a target role in your career profile or assessment to unlock your personalised role transition path — current role → bridge roles → destination." />;
  }

  const path = data.path as any[];
  const sw = data.overall_switchability ?? 0;
  const swColor = sw >= 70 ? BRAND.green : sw >= 40 ? BRAND.accent : BRAND.orange;
  const totalEta = data.total_eta_months ?? 0;
  const targetStep = path.find(p => p.step === 'target');
  const levels = data.competency_levels ?? competencyLevels ?? {};
  const vel = data.learning_velocity;
  const ei = data.target_role?.min_ei != null ? (eiScore ?? 50) : (eiScore ?? 50);

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Target switchability', val: `${sw}%`,                      color: swColor },
          { label: 'Total ETA',            val: `${totalEta} mo`,              color: BRAND.accent },
          { label: 'Bridge roles',         val: String(data.bridge_count ?? 0), color: BRAND.primary },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm text-center">
            <div className="text-xl font-black" style={{ color: k.color }}>{k.val}</div>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Step-by-step path */}
      <div>
        {path.map((step: any, i: number) => {
          const isCurrent = step.step === 'current';
          const isTarget  = step.step === 'target';
          const isLast    = i === path.length - 1;
          const barColor  = isCurrent ? BRAND.primary : step.switchability >= 70 ? BRAND.green : step.switchability >= 40 ? BRAND.accent : BRAND.orange;
          const cardBg    = isCurrent ? 'border-blue-200 bg-blue-50/30' : isTarget ? 'border-green-200 bg-green-50/30' : 'border-amber-100 bg-amber-50/20';
          const badge     = isCurrent ? 'bg-blue-100 text-blue-700' : isTarget ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
          const badgeText = isCurrent ? 'NOW' : isTarget ? '★' : String(i);
          return (
            <React.Fragment key={step.step}>
              <div className={`bg-white border rounded-xl p-4 shadow-sm ${cardBg}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5 ${badge}`}>{badgeText}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="font-bold text-gray-900 text-sm">{step.role.title}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{step.role.family}</span>
                      {isCurrent
                        ? <span className="ml-auto text-xs font-medium text-blue-600">Current</span>
                        : <span className="ml-auto text-xs font-semibold" style={{ color: barColor }}>{step.switchability}% · {step.eta_months}mo</span>
                      }
                    </div>
                    <p className="text-xs text-gray-400 italic mb-2">{step.label}</p>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${isCurrent ? 100 : step.switchability}%`, backgroundColor: barColor }} />
                    </div>
                    {!isCurrent && (step.key_gaps ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        <span className="text-xs text-gray-400 mr-0.5">Gaps:</span>
                        {(step.key_gaps as string[]).map((g: string) => (
                          <span key={g} className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">{g}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>Demand <b className="text-gray-600">{step.role.demandScore}</b>/100</span>
                      <span>Auto risk <b className="text-gray-600">{step.role.automationRisk}%</b></span>
                      <span>Salary P50 <b className="text-gray-600">₹{step.role.salaryP50}L</b></span>
                    </div>
                  </div>
                </div>
              </div>
              {!isLast && (
                <div className="flex justify-center py-0.5">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-2 bg-gray-200" />
                    <ChevronRight size={14} className="text-gray-300 rotate-90" />
                    <div className="w-px h-2 bg-gray-200" />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Transition probability callout */}
      {data.transition_probability != null && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 flex items-center gap-3">
          <span className="text-2xl font-black" style={{ color: BRAND.primary }}>{data.transition_probability}%</span>
          <p className="text-sm text-blue-700 leading-snug">overall transition probability from your career profile</p>
        </div>
      )}

      {/* What-if simulator */}
      {targetStep && (
        <WhatsIfSimulator
          targetRole={{ ...targetStep.role, switchability: targetStep.switchability, eta_months: targetStep.eta_months, key_gaps: targetStep.key_gaps }}
          currentLevels={levels}
          eiScore={ei}
          vel={vel}
        />
      )}

      {data.live_competency_used === false && (
        <p className="text-center text-xs text-gray-400">Based on career memory snapshot · Complete a competency assessment for a live-calibrated path</p>
      )}
    </div>
  );
}

/* ── Forecast Tab ───────────────────────────────────────────────────────── */
function ForecastTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-gray-300" /></div>;
  if (!data || data.enabled === false) {
    const reason = data?.reason === 'flag_disabled' ? 'Forecast Intelligence is not enabled on this account.' : 'Forecast data is unavailable.';
    return <SectionEmpty title="Forecasts unavailable" message={reason} />;
  }
  const forecasts = data.forecasts ?? {};
  const kinds = ['growth', 'outcome', 'journey', 'risk'];
  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700 flex gap-2">
        <Activity size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <span>Forecasts are linear extrapolations of your existing trend data. {data.forecastable_count ?? 0} of 4 dimensions have sufficient session history for projection.</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {kinds.map(kind => {
          const f = forecasts[kind];
          if (!f) return null;
          if (!f.forecastable) return (
            <div key={kind} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm opacity-60">
              <p className="text-sm font-semibold text-gray-600 capitalize mb-1">{f.label ?? kind}</p>
              <p className="text-xs text-gray-400">{f.detail ?? 'Insufficient session data for projection.'}</p>
            </div>
          );
          const trendPoints = [f.last_value, f.projected_value];
          const col = kind === 'risk' ? BRAND.red : kind === 'growth' ? BRAND.green : BRAND.primary;
          return (
            <div key={kind} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                <DirectionBadge dir={f.projected_direction} />
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-xs text-gray-400">Current</p>
                  <p className="text-2xl font-black" style={{ color: col }}>{Math.round(f.last_value)}</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 mb-2" />
                <div>
                  <p className="text-xs text-gray-400">Projected</p>
                  <p className="text-2xl font-black" style={{ color: col }}>{Math.round(f.projected_value)}</p>
                </div>
                <div className="ml-auto"><Sparkline points={trendPoints} color={col} height={36} /></div>
              </div>
              <div className="flex items-center gap-2">
                <ConfidenceBadge band={f.confidence_band} />
                <span className="text-xs text-gray-400">{f.points} session{f.points !== 1 ? 's' : ''} of data</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{f.basis}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Outcomes Tab ───────────────────────────────────────────────────────── */
function OutcomesTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-gray-300" /></div>;
  if (!data || data.snapshot_count === 0) return <SectionEmpty title="No outcome data yet" message="Outcomes are attributed as your Career Brain tracks EI score changes between snapshots. Keep engaging with assessments to build your outcome history." />;
  const tl    = (data.ei_timeline ?? []) as any[];
  const attrs  = (data.attributions ?? []) as any[];
  const realized = (data.realized_count ?? 0) as number;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">EI Score Timeline</p>
          <Sparkline points={tl.map((t: any) => t.ei)} color={BRAND.primary} height={44} />
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-gray-500">Tracked Interventions</p>
          <div className="text-3xl font-black mt-1" style={{ color: BRAND.primary }}>{attrs.length}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-gray-500">Realized EI Gains</p>
          <div className="text-3xl font-black mt-1" style={{ color: BRAND.green }}>{realized}</div>
          <p className="text-xs text-gray-400 mt-1">interventions with measurable EI lift</p>
        </div>
      </div>

      {attrs.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-400">Outcome attribution data builds as you complete interventions across career snapshots.</div>
      )}

      <div className="space-y-2">
        {attrs.slice(0, 15).map((a: any, i: number) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{a.label}</p>
              <p className="text-xs text-gray-400 capitalize">{a.status ?? 'completed'}</p>
            </div>
            <div className="shrink-0 text-right">
              {a.ei_delta != null ? (
                <span className={`text-sm font-bold ${a.ei_delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {a.ei_delta > 0 ? '+' : ''}{a.ei_delta} EI
                </span>
              ) : (
                <span className="text-xs text-gray-400">pending</span>
              )}
            </div>
            <CheckCircle size={15} className={a.ei_delta != null && a.ei_delta > 0 ? 'text-green-400 shrink-0' : 'text-gray-200 shrink-0'} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Interventions Tab ──────────────────────────────────────────────────── */
function InterventionsTab({ data, loading, onRefetch }: { data: any; loading: boolean; onRefetch: () => void }) {
  const [marking, setMarking] = useState<string | null>(null);

  const markDone = async (id: string) => {
    setMarking(id);
    try {
      await fetch(`/api/career/hub/interventions/${id}/action`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      onRefetch();
    } catch {}
    setMarking(null);
  };

  if (loading) return <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-gray-300" /></div>;
  if (!data) return <SectionEmpty title="No interventions loaded" message="Run a competency assessment to receive personalised career interventions." />;

  const active = (data.active ?? []) as any[];
  const done   = (data.done ?? []) as any[];
  const effortColor = (e: string) => ({ low: BRAND.green, medium: BRAND.accent, high: BRAND.orange }[e?.toLowerCase()] ?? BRAND.primary);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',     val: data.total ?? 0,        color: BRAND.primary },
          { label: 'Active',    val: data.active_count ?? 0, color: BRAND.accent },
          { label: 'Completed', val: data.done_count ?? 0,   color: BRAND.green },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm text-center">
            <div className="text-2xl font-black" style={{ color: k.color }}>{k.val}</div>
            <p className="text-xs text-gray-500">{k.label}</p>
          </div>
        ))}
      </div>

      {active.length === 0 && done.length === 0 && (
        <SectionEmpty title="No interventions yet" message="After your next competency assessment, ranked interventions with effort estimates and impact scores will appear here." />
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Interventions</p>
          {active.map((r: any) => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium" style={{ backgroundColor: `${effortColor(r.effort_level)}15`, color: effortColor(r.effort_level) }}>
                  {r.effort_level ?? 'medium'} effort
                </span>
              </div>
              {r.description && <p className="text-xs text-gray-500 leading-relaxed">{r.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {r.time_to_complete && <span className="flex items-center gap-0.5"><Clock size={11} />{r.time_to_complete}</span>}
                {r.target_dimension && <span className="flex items-center gap-0.5"><Target size={11} />{r.target_dimension}</span>}
                {r.estimated_impact && <span className="flex items-center gap-0.5 text-green-600 font-medium"><Star size={11} />{r.estimated_impact} impact</span>}
              </div>
              <div className="pt-1">
                <button onClick={() => markDone(r.id)} disabled={marking === r.id}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors">
                  {marking === r.id
                    ? <RefreshCw size={11} className="animate-spin" />
                    : <CheckCircle size={11} />}
                  Mark done
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed</p>
          {done.map((r: any) => (
            <div key={r.id} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 opacity-70">
              <CheckCircle size={15} className="text-green-400 shrink-0" />
              <p className="text-sm text-gray-600 line-through">{r.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Risk & Opportunity Tab ─────────────────────────────────────────────── */
function RiskOpportunityTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-gray-300" /></div>;
  if (!data) return <SectionEmpty title="Risk & opportunity data unavailable" message="Your risk profile builds from behavioural signals and EI trajectory. Ensure the WC-L0 intelligence layer is active." />;
  const dims = data.dims ?? {};
  const dimKeys = ['motivation', 'confidence', 'risk', 'engagement', 'adaptability'];
  const riskLevel = (data.risk_score ?? 0) >= 70 ? 'High' : (data.risk_score ?? 0) >= 40 ? 'Moderate' : 'Low';
  const riskCol   = riskLevel === 'High' ? BRAND.red : riskLevel === 'Moderate' ? BRAND.orange : BRAND.green;
  const oppLevel  = (data.opportunity_score ?? 0) >= 70 ? 'High' : (data.opportunity_score ?? 0) >= 40 ? 'Moderate' : 'Low';
  return (
    <div className="space-y-5">
      <div className="flex gap-6 justify-center py-2">
        <ScoreRing score={data.risk_score}         label={`Risk — ${riskLevel}`}         color={riskCol}      size={90} />
        <ScoreRing score={data.opportunity_score}  label={`Opportunity — ${oppLevel}`}   color={BRAND.green}  size={90} />
        {data.automation_exposure != null && <ScoreRing score={data.automation_exposure} label="Automation exposure" color={BRAND.orange} size={90} />}
      </div>

      {data.dims && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Behavioural dimensions</p>
            {data.dims_source === 'ei_estimated' && (
              <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Estimated from EI · complete an assessment for live dims</span>
            )}
            {data.dims_source === 'behavioural_engine' && (
              <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Live · behavioural engine</span>
            )}
          </div>
          {dimKeys.filter(k => dims[k] != null).map(k => (
            <DimBar key={k} label={k} value={dims[k]} />
          ))}
          {data.learning_style && (
            <p className="text-xs text-gray-400 pt-1">Learning style: <span className="font-semibold text-gray-600 capitalize">{data.learning_style}</span></p>
          )}
        </div>
      )}

      {data.risk_signals?.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">Risk signals</p>
          {data.risk_signals.map((s: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm text-red-700">
              <AlertCircle size={13} className="shrink-0" />
              <span>{s.label ?? s.key}</span>
              {s.strength != null && <span className="ml-auto text-xs text-red-400">{Math.round(s.strength * 100)}%</span>}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Market readiness</p>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${data.market_readiness ?? 0}%`, backgroundColor: BRAND.accent }} />
        </div>
        <p className="text-xs text-gray-500">{Math.round(data.market_readiness ?? 0)}/100 relative to current demand signals</p>
      </div>

      {data.computed_at && (
        <p className="text-xs text-gray-400 text-center">Last computed: {new Date(data.computed_at).toLocaleDateString()}</p>
      )}
    </div>
  );
}

/* ── Reports Tab ────────────────────────────────────────────────────────── */
const SECTION_ICON: Record<string, React.ReactNode> = {
  ei:            <BarChart3 size={16} color={BRAND.primary} />,
  trajectory:    <TrendingUp size={16} color={BRAND.accent} />,
  market:        <Activity size={16} color={BRAND.green} />,
  risk:          <Shield size={16} color={BRAND.red} />,
  interventions: <Zap size={16} color={BRAND.orange} />,
  empty:         <Lightbulb size={16} color={BRAND.orange} />,
};
const SECTION_TAB_LABEL: Record<string, string> = {
  ei: 'Memory', trajectory: 'Transition', market: 'Trajectory',
  risk: 'Risk & Opportunity', interventions: 'Interventions', empty: 'Memory',
};

function ReportsTab({ data, loading, onTabChange }: { data: any; loading: boolean; onTabChange?: (tab: HubTab) => void }) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?tab=intelligence-hub`;
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    } catch {}
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-gray-300" /></div>;
  if (!data) return <SectionEmpty title="Report unavailable" message="Your intelligence report composes when at least one career snapshot exists." />;
  const sections = (data.sections ?? []) as any[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400">{data.snapshot_count ?? 0} snapshots · Generated {data.generated_at ? new Date(data.generated_at).toLocaleDateString() : 'now'}</p>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors print:hidden">
            <Printer size={12} />Export PDF
          </button>
          <button onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            {copied ? <><CheckCircle size={12} className="text-green-500" />Copied!</> : <><ArrowUpRight size={12} />Share</>}
          </button>
        </div>
      </div>

      {sections.length === 0 && (
        <SectionEmpty title="Build your intelligence profile" message="Complete your career profile, run a competency assessment, and track your first memory snapshot to unlock your personalised Career Intelligence Report." />
      )}

      {sections.map((s: any, i: number) => {
        const tabTarget = s.deep_link_tab as HubTab | undefined;
        return (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-2 print:shadow-none print:border-gray-300">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {SECTION_ICON[s.type] ?? <Star size={16} color={BRAND.primary} />}
                <p className="font-semibold text-gray-800 text-sm">{s.title}</p>
              </div>
              {tabTarget && onTabChange && (
                <button onClick={() => onTabChange(tabTarget)}
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors print:hidden">
                  {SECTION_TAB_LABEL[s.type] ?? 'View'} <ChevronRight size={11} />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{s.content}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
interface CareerIntelligenceHubProps {
  userId: string;
  email?: string;
  eiScore?: number;
  profile?: any;
  onTabChange?: (tab: string) => void;
}

export default function CareerIntelligenceHub({ userId, email, eiScore = 0, profile, onTabChange }: CareerIntelligenceHubProps) {
  const [activeTab, setActiveTab] = useState<HubTab>('memory');
  const [visitedTabs, setVisitedTabs] = useState<Set<HubTab>>(new Set(['memory']));

  const handleTabChange = (tab: HubTab) => {
    setActiveTab(tab);
    setVisitedTabs(prev => new Set([...prev, tab]));
  };

  const summaryFetch      = useFetch<any>('/api/career/hub/summary',         true);
  const memoryFetch       = useFetch<any>('/api/career/hub/memory',           visitedTabs.has('memory'));
  const onboardingFetch   = useFetch<any>('/api/career/hub/onboarding',       visitedTabs.has('memory'));
  const trajectoryFetch   = useFetch<any>('/api/career/hub/trajectory',       visitedTabs.has('trajectory'));
  const transitionFetch   = useFetch<any>('/api/career/hub/transition',       visitedTabs.has('transition'));
  const forecastFetch     = useFetch<any>('/api/career/hub/forecast',         visitedTabs.has('forecast'));
  const outcomeFetch      = useFetch<any>('/api/career/hub/outcomes',         visitedTabs.has('outcomes'));
  const interventionFetch = useFetch<any>('/api/career/hub/interventions',    visitedTabs.has('interventions'));
  const riskFetch         = useFetch<any>('/api/career/hub/risk-opportunity', visitedTabs.has('risk'));
  const reportFetch       = useFetch<any>('/api/career/hub/report',           visitedTabs.has('reports'));

  const s = summaryFetch.data;

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 shrink-0 print:hidden">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
            <Cpu size={16} color={BRAND.primary} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Career Intelligence Hub</h2>
            <p className="text-xs text-gray-400">8 intelligence surfaces · composing Career OS engines</p>
          </div>
        </div>

        {/* Summary KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'EI Score',   val: s?.ei_score != null ? `${Math.round(s.ei_score)}${s.ei_delta != null ? ` (${s.ei_delta > 0 ? '+' : ''}${s.ei_delta})` : ''}` : '—', color: BRAND.primary },
            { label: 'Opportunity',val: s?.opportunity_score != null ? `${Math.round(s.opportunity_score)}` : '—', color: BRAND.green },
            { label: 'Risk',       val: s?.risk_score != null ? `${Math.round(s.risk_score * 100)}` : '—',         color: BRAND.red },
            { label: 'Snapshots',  val: s?.snapshot_count ?? 0,                                                    color: BRAND.accent },
          ].map(kpi => (
            <div key={kpi.label} className="bg-gray-50 rounded-lg px-3 py-1.5 text-center border border-gray-100">
              <div className="text-sm font-bold" style={{ color: kpi.color }}>{String(kpi.val)}</div>
              <div className="text-xs text-gray-400">{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tab navigation — scrollable on mobile */}
      <div className="bg-white border-b border-gray-100 shrink-0 overflow-x-auto scrollbar-hide print:hidden">
        <div className="flex px-2 min-w-max">
          {TAB_CONFIG.map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {activeTab === 'memory'        && <MemoryTab        data={memoryFetch.data}       loading={memoryFetch.loading}       onboarding={onboardingFetch.data}    onboardingLoading={onboardingFetch.loading} />}
        {activeTab === 'trajectory'    && <TrajectoryTab    data={trajectoryFetch.data}   loading={trajectoryFetch.loading} />}
        {activeTab === 'transition'    && <TransitionTab    data={transitionFetch.data}   loading={transitionFetch.loading}   competencyLevels={trajectoryFetch.data?.competency_levels} eiScore={trajectoryFetch.data?.ei_score} />}
        {activeTab === 'forecast'      && <ForecastTab      data={forecastFetch.data}     loading={forecastFetch.loading} />}
        {activeTab === 'outcomes'      && <OutcomesTab      data={outcomeFetch.data}      loading={outcomeFetch.loading} />}
        {activeTab === 'interventions' && <InterventionsTab data={interventionFetch.data} loading={interventionFetch.loading} onRefetch={interventionFetch.refetch} />}
        {activeTab === 'risk'          && <RiskOpportunityTab data={riskFetch.data}       loading={riskFetch.loading} />}
        {activeTab === 'reports'       && <ReportsTab       data={reportFetch.data}       loading={reportFetch.loading}       onTabChange={handleTabChange} />}
      </div>
    </div>
  );
}
