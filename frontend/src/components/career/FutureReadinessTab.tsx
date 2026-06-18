/**
 * FutureReadinessTab — Future Readiness Platform (FRP)
 * Career Builder sub-tab: 11 panels split into two sections.
 *
 * Platform Intelligence (6 panels):
 *   1. Readiness Index       — composite FRI gauge + 5 signal bars + benchmarks
 *   2. Skill Landscape       — full library with AI-durability heat overlay
 *   3. AI Impact             — displacement / augmentation / new-work triangle per skill
 *   4. Automation Risk       — current/target role risk + exposed vs resilient tasks
 *   5. Industry Forecast     — sector growth + growing/declining roles
 *   6. My Roadmap            — personalised skill/role recommendations
 *
 * Intelligence Products (5 panels — /api/frp/products/*):
 *   7. Future Skills Planner     — prioritised 3-horizon skill plan (reskill/upskill/deepen)
 *   8. AI Career Navigator       — vulnerability score + safe-harbor roles + augmentation opps
 *   9. Career Transition Planner — feasibility-scored role paths matched to user's skill profile
 *  10. Entrepreneurship Intel.   — entrepreneurial readiness + opportunity sectors + skill gaps
 *  11. Emerging Careers          — alignment score + emerging role catalog + future-proof skills
 *
 * All data from /api/frp/* — gated by FF_FUTURE_READINESS.
 * Flag-off → FeatureDisabled. Empty data → EmptyState (actionable).
 * Product tabs compose existing frp_* tables only — no new engines.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, TrendingUp, Target, Brain, Globe, Map, RefreshCw,
  AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  ArrowRight, Shield, Activity, BarChart3, BookOpen, Layers,
  Rocket, Navigation, Shuffle, Lightbulb, Compass, Star,
} from 'lucide-react';

// ── Brand ──────────────────────────────────────────────────────────────────
const BRAND = {
  primary: '#6C63FF', accent: '#FF6584', green: '#43C59E',
  amber: '#F7B731', red: '#FC5C65', blue: '#45AAF2',
  border: '#E5E7EB',
};

const BAND_COLOR: Record<string, string> = {
  pioneering: '#43C59E', resilient: '#45AAF2', capable: '#6C63FF',
  developing: '#F7B731', emerging: '#FC5C65',
};

const IMPACT_COLOR: Record<string, string> = {
  low: '#43C59E', moderate: '#F7B731', high: '#FC5C65', transformative: '#FF6584',
};

const RISK_COLOR: Record<string, string> = {
  low: '#43C59E', moderate_low: '#45AAF2', moderate: '#F7B731',
  high: '#FC5C65', critical: '#FF0000',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts?.headers || {}) } });
  const body = await res.json();
  if (res.status === 503) return { ok: false, __flagOff: true, ...body };
  return body;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
    </div>
  );
}

function FeatureDisabled() {
  return (
    <div className="rounded-2xl border p-10 text-center" style={{ borderColor: BRAND.border, backgroundColor: '#FAFAFA' }}>
      <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <Zap size={20} className="text-gray-300" />
      </div>
      <p className="text-sm font-semibold text-gray-500">Future Readiness Platform not yet enabled</p>
      <p className="text-xs text-gray-400 mt-1">Contact your platform administrator to activate this feature.</p>
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="rounded-2xl border p-8 text-center" style={{ borderColor: BRAND.border }}>
      <div className="mx-auto mb-3 text-gray-200">{icon}</div>
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-sm mx-auto">{hint}</p>
    </div>
  );
}

// ── Gauge ──────────────────────────────────────────────────────────────────
function Gauge({ value, label, color, size = 72 }: { value: number; label: string; color: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={7} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="text-center" style={{ marginTop: -size * 0.6 - 4, height: size * 0.6 + 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span className="text-lg font-bold leading-none" style={{ color }}>{value}</span>
      </div>
      <span className="text-[10px] text-gray-500 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

function SignalBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── FRI Sparkline Chart ────────────────────────────────────────────────────
function FRISparkline({ snapshots, color }: { snapshots: any[]; color: string }) {
  if (snapshots.length < 2) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">
          {snapshots.length === 0
            ? 'No history yet — your first FRI compute will start the trend.'
            : 'Compute your FRI again to build a trend line.'}
        </p>
      </div>
    );
  }

  const W = 280; const H = 80; const PAD = { x: 20, y: 10 };
  const values = snapshots.map((s: any) => Number(s.composite));
  const min = Math.max(0, Math.min(...values) - 5);
  const max = Math.min(100, Math.max(...values) + 5);
  const range = max - min || 1;
  const n = values.length;

  const px = (i: number) => PAD.x + (i / (n - 1)) * (W - 2 * PAD.x);
  const py = (v: number) => H - PAD.y - ((v - min) / range) * (H - 2 * PAD.y);

  const points = values.map((v, i) => `${px(i)},${py(v)}`).join(' ');
  const fillPoints = `${px(0)},${py(min)} ${points} ${px(n - 1)},${py(min)}`;

  const latest = values[n - 1];
  const prev = values[n - 2];
  const delta = latest - prev;

  const formatDate = (s: any) => {
    try { return new Date(s.computed_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' }); }
    catch { return ''; }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{formatDate(snapshots[0])}</span>
        <span className="text-[10px] font-semibold" style={{ color: delta >= 0 ? BRAND.green : BRAND.red }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))} pts vs prior
        </span>
        <span className="text-[10px] text-gray-400">{formatDate(snapshots[n - 1])}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* Fill */}
        <polygon points={fillPoints} fill={color} opacity="0.08" />
        {/* Line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {values.map((v, i) => (
          <circle key={i} cx={px(i)} cy={py(v)} r={i === n - 1 ? 4 : 2.5}
            fill={i === n - 1 ? color : '#fff'} stroke={color} strokeWidth={1.5} />
        ))}
        {/* Latest value label */}
        <text x={px(n - 1)} y={py(latest) - 8} textAnchor="middle"
          fontSize="10" fontWeight="600" fill={color}>{latest}</text>
      </svg>
      <p className="text-[10px] text-gray-400 text-center">{n} snapshot{n !== 1 ? 's' : ''} · recompute to add a datapoint</p>
    </div>
  );
}

// ── Sub-Tab 1: Readiness Index ─────────────────────────────────────────────
function ReadinessIndexTab({ userId }: { userId?: number }) {
  const [data, setData] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [overview, hist] = await Promise.all([
        apiFetch(`/api/frp/overview${refresh ? '?refresh=1' : ''}`),
        apiFetch('/api/frp/snapshots?limit=20'),
      ]);
      setData(overview);
      // After a refresh the new snapshot is just persisted — include the latest composite
      // from the fresh overview so the chart is immediately up to date
      const raw: any[] = hist?.snapshots ?? [];
      if (refresh && overview?.fri) {
        const already = raw.some(s =>
          Math.abs(new Date(s.computed_at).getTime() - Date.now()) < 5000,
        );
        if (!already) raw.push({ ...overview.fri, computed_at: new Date().toISOString() });
      }
      setSnapshots(raw);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const fri = data?.fri ?? {};
  const benchmarks = data?.benchmarks ?? {};
  const benchMeta = data?.benchmark_meta ?? {};
  const bridge = data?.bridge ?? {};
  const composite = Number(fri.composite ?? 0);
  const band = fri.band ?? 'developing';
  const color = BAND_COLOR[band] ?? BRAND.primary;
  const isSyntheticBench = !!benchMeta?.synthetic;
  const benchLabel: string = benchMeta?.label ?? (isSyntheticBench ? 'Baseline estimate' : 'Platform peers');

  const p50 = Number(benchmarks?.composite?.p50 ?? 0);
  const vsMedian = p50 > 0 ? composite - p50 : null;
  const confidence = Math.round((fri.confidence ?? 0.3) * 100);

  return (
    <div className="space-y-5">
      {/* Composite gauge */}
      <div className="rounded-2xl border p-6 text-center" style={{ background: `linear-gradient(135deg, ${color}10, ${color}05)`, borderColor: `${color}30` }}>
        <Gauge value={composite} label="Future Readiness Index" color={color} size={96} />
        <div className="mt-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-1.5 rounded-full capitalize"
            style={{ backgroundColor: `${color}20`, color }}>
            <Activity size={13} /> {band.charAt(0).toUpperCase() + band.slice(1)}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Confidence: {confidence}% · 5-signal composite
        </p>
        {vsMedian !== null && (
          <p className="text-xs mt-1" style={{ color: vsMedian >= 0 ? BRAND.green : BRAND.red }}>
            {vsMedian >= 0 ? '+' : ''}{Math.round(vsMedian)} vs {benchLabel.toLowerCase()} median ({Math.round(p50)})
          </p>
        )}
      </div>

      {/* Auto-populated skills notice */}
      {!bridge.skipped && (bridge.populated > 0 || bridge.sources?.length > 0) && (
        <div className="rounded-xl border px-4 py-3 flex items-start gap-2.5"
          style={{ borderColor: `${BRAND.blue}30`, backgroundColor: `${BRAND.blue}08` }}>
          <CheckCircle size={14} className="shrink-0 mt-0.5" style={{ color: BRAND.blue }} />
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold" style={{ color: BRAND.blue }}>
              {bridge.populated} skill{bridge.populated !== 1 ? 's' : ''} auto-detected
            </span>
            {' '}from your {(bridge.sources as string[] || []).join(' & ').replace('career_profile','career profile').replace('role_catalog','role catalog').replace('capadex_sessions','CAPADEX history').replace('competency_assessment','competency assessment')} and factored into your score.
            Visit the Skills tab to refine proficiency levels.
          </p>
        </div>
      )}
      {confidence < 40 && (
        <div className="rounded-xl border px-4 py-3 flex items-start gap-2.5"
          style={{ borderColor: `${BRAND.amber}30`, backgroundColor: `${BRAND.amber}08` }}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: BRAND.amber }} />
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold" style={{ color: BRAND.amber }}>Low confidence ({confidence}%)</span>
            {' '}— most signals are using platform defaults. Add skills in the Skills tab and complete a CAPADEX session to improve accuracy.
          </p>
        </div>
      )}

      {/* 5 signal bars */}
      <div className="rounded-xl border p-5" style={{ borderColor: BRAND.border }}>
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Signal Breakdown</h4>
        <div className="space-y-3">
          <SignalBar label="Skill Durability (30%)" value={Number(fri.skill_durability ?? 50)} color={BRAND.primary} />
          <SignalBar label="Market Alignment (25%)" value={Number(fri.market_alignment ?? 50)} color={BRAND.blue} />
          <SignalBar label="Adaptability (20%)" value={Number(fri.adaptability ?? 50)} color={BRAND.green} />
          <SignalBar label="Learning Velocity (15%)" value={Number(fri.learning_velocity ?? 50)} color={BRAND.amber} />
          <SignalBar label="Role Resilience (10%)" value={Number(fri.role_resilience ?? 50)} color={BRAND.accent} />
        </div>
      </div>

      {/* FRI History Sparkline */}
      <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <BarChart3 size={12} /> FRI History
        </h4>
        <FRISparkline snapshots={snapshots} color={color} />
      </div>

      {/* Benchmarks */}
      {p50 > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <TrendingUp size={12} /> {benchLabel}
            {!isSyntheticBench && benchMeta?.sample_size > 0 && (
              <span className="ml-auto text-[10px] text-gray-400 normal-case font-normal">{benchMeta.sample_size} users</span>
            )}
          </h4>
          {isSyntheticBench && (
            <p className="text-[10px] text-gray-400 mb-3">Estimated percentiles — updates automatically once real users compute their FRI.</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {([['Median', benchmarks?.composite?.p50], ['Top 25%', benchmarks?.composite?.p75], ['Top 10%', benchmarks?.composite?.p90]] as [string, any][]).map(([label, val]) => (
              <div key={label} className="text-center">
                <p className="text-xl font-bold text-gray-700">{val ? Math.round(Number(val)) : '—'}</p>
                <p className="text-[10px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Band legend */}
      <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Band Reference</h4>
        <div className="space-y-1.5">
          {[['pioneering','80–100','Leading edge — driving AI-era transformation'],['resilient','65–79','Well positioned — durable skills, high adaptability'],['capable','50–64','Solid foundation — building AI-fluency'],['developing','30–49','Actively upskilling — targeted focus recommended'],['emerging','0–29','Early stage — significant investment opportunity']].map(([b, range, desc]) => (
            <div key={b} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 mt-0.5 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BAND_COLOR[b] }} />
              <span className="font-medium capitalize text-gray-700 w-20 shrink-0">{b}</span>
              <span className="text-gray-400 w-14 shrink-0">{range}</span>
              <span className="text-gray-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => load(true)} disabled={refreshing}
        className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl border transition-all disabled:opacity-50"
        style={{ borderColor: BRAND.primary, color: BRAND.primary }}>
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Refreshing…' : 'Recompute Index'}
      </button>
    </div>
  );
}

// ── Sub-Tab 2: Skill Landscape ─────────────────────────────────────────────
function SkillLandscapeTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch('/api/frp/skill-landscape');
    setData(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const skills: any[] = data?.skills ?? [];
  const domains = ['all', ...Array.from(new Set(skills.map((s: any) => s.domain as string)))];
  const filtered = skills.filter((s: any) => {
    const domainMatch = domain === 'all' || s.domain === domain;
    const searchMatch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    return domainMatch && searchMatch;
  });

  const durabilityColor = (score: number) => score >= 80 ? BRAND.green : score >= 60 ? BRAND.blue : score >= 40 ? BRAND.amber : BRAND.red;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…"
          className="flex-1 min-w-[160px] text-xs border rounded-lg px-3 py-2 outline-none focus:ring-1"
          style={{ borderColor: BRAND.border, '--tw-ring-color': BRAND.primary } as any} />
        <select value={domain} onChange={e => setDomain(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 outline-none" style={{ borderColor: BRAND.border }}>
          {domains.map(d => <option key={d} value={d}>{d === 'all' ? 'All Domains' : d}</option>)}
        </select>
      </div>

      {/* Durability legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {[['≥80 Highly durable', BRAND.green],['60–79 Durable', BRAND.blue],['40–59 Moderate', BRAND.amber],['<40 At risk', BRAND.red]].map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Skill grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Layers size={36} />} title="No skills to display"
          hint="Add skills to your profile using the skill cards below, or use the Skill Profile API to import from your Career Builder profile." />
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((s: any) => {
            const color = durabilityColor(s.durability_score);
            const isOpen = selected?.skill_code === s.skill_code;
            return (
              <div key={s.skill_code} className="rounded-xl border overflow-hidden" style={{ borderColor: isOpen ? color : BRAND.border }}>
                <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setSelected(isOpen ? null : s)}>
                  <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">{s.name}</span>
                      <span className="text-xs font-bold shrink-0" style={{ color }}>{s.durability_score}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{s.domain}</span>
                      {s.cluster && <><span className="text-[10px] text-gray-300">·</span><span className="text-[10px] text-gray-400">{s.cluster}</span></>}
                      {s.demand_trend === 'high_growth' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>High growth</span>}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-300 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t space-y-3" style={{ borderColor: BRAND.border, backgroundColor: `${color}04` }}>
                    <p className="text-xs text-gray-600 pt-3 leading-relaxed">{s.description}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[['Durability', s.durability_score, color],['Human Quotient', s.human_quotient, BRAND.primary],['Data Intensity', s.data_intensity, BRAND.amber]].map(([label, val, c]) => (
                        <div key={String(label)} className="text-center rounded-lg p-2" style={{ backgroundColor: `${c}10` }}>
                          <p className="text-base font-bold" style={{ color: c as string }}>{val}</p>
                          <p className="text-[9px] text-gray-500">{label}</p>
                        </div>
                      ))}
                    </div>
                    {s.impact_band && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">AI Impact:</span>
                        <span className="font-semibold px-1.5 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${IMPACT_COLOR[s.impact_band]}15`, color: IMPACT_COLOR[s.impact_band] }}>{s.impact_band}</span>
                        {s.timeline_years && <span className="text-gray-400">within ~{s.timeline_years}y</span>}
                      </div>
                    )}
                    {s.resilience_rationale && <p className="text-[10px] text-gray-500 italic leading-relaxed">"{s.resilience_rationale}"</p>}
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

// ── Sub-Tab 3: AI Impact ───────────────────────────────────────────────────
function AIImpactTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/frp/ai-impact').then(r => { setData(r); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const skills: any[] = data?.skills ?? [];
  const filtered = skills.filter((s: any) => {
    const bandMatch = band === 'all' || s.impact_band === band;
    const searchMatch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    return bandMatch && searchMatch;
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border, backgroundColor: '#FAFAFA' }}>
        <p className="text-xs text-gray-600 leading-relaxed">
          Each skill is scored across three AI dimensions. <strong>Displacement Risk</strong> — probability AI replaces this work. <strong>Augmentation Potential</strong> — how much AI amplifies human output. <strong>New Work Creation</strong> — probability this skill spawns new roles AI can't fill.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…"
          className="flex-1 min-w-[140px] text-xs border rounded-lg px-3 py-2 outline-none"
          style={{ borderColor: BRAND.border }} />
        <select value={band} onChange={e => setBand(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 outline-none" style={{ borderColor: BRAND.border }}>
          {['all','low','moderate','high','transformative'].map(b => <option key={b} value={b}>{b === 'all' ? 'All Impact Bands' : b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Brain size={36} />} title="No AI impact data matched"
          hint="The AI impact framework covers 40+ skills across 8 domains. Adjust your filters to explore the full library." />
      ) : (
        <div className="space-y-2">
          {filtered.map((s: any) => {
            const dr = Math.round((s.displacement_risk ?? 0) * 100);
            const ap = Math.round((s.augmentation_potential ?? 0) * 100);
            const nw = Math.round((s.new_work_creation ?? 0) * 100);
            const ic = IMPACT_COLOR[s.impact_band] ?? BRAND.amber;
            return (
              <div key={s.skill_code} className="rounded-xl border p-3" style={{ borderColor: BRAND.border }}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.domain} · {s.cluster}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0"
                    style={{ backgroundColor: `${ic}15`, color: ic }}>{s.impact_band} impact</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[['Displacement', dr, BRAND.red],['Augmentation', ap, BRAND.blue],['New Work', nw, BRAND.green]].map(([label, val, color]) => (
                    <div key={String(label)} className="text-center rounded-lg py-2" style={{ backgroundColor: `${color}08` }}>
                      <p className="text-sm font-bold" style={{ color: color as string }}>{val}%</p>
                      <p className="text-[9px] text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
                {s.timeline_years && <p className="text-[10px] text-gray-400 mt-2">Horizon: ~{s.timeline_years} years</p>}
                {s.resilience_rationale && <p className="text-[10px] text-gray-500 mt-1 italic leading-relaxed">"{s.resilience_rationale}"</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sub-Tab 4: Automation Risk ─────────────────────────────────────────────
function AutomationRiskTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [riskBand, setRiskBand] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/frp/automation-risk').then(r => { setData(r); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const roles: any[] = data?.roles ?? [];
  const filtered = roles.filter((r: any) => {
    const bandMatch = riskBand === 'all' || r.risk_band === riskBand;
    const searchMatch = !search || r.role_name.toLowerCase().includes(search.toLowerCase());
    return bandMatch && searchMatch;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search roles…"
          className="flex-1 min-w-[140px] text-xs border rounded-lg px-3 py-2 outline-none"
          style={{ borderColor: BRAND.border }} />
        <select value={riskBand} onChange={e => setRiskBand(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 outline-none" style={{ borderColor: BRAND.border }}>
          {[['all','All Risk Bands'],['low','Low Risk'],['moderate_low','Moderate-Low'],['moderate','Moderate'],['high','High'],['critical','Critical']].map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Shield size={36} />} title="No roles matched"
          hint="The Automation Risk Framework profiles 25 common roles across industries. Adjust your filters to explore the full catalog." />
      ) : (
        <div className="space-y-2">
          {filtered.map((role: any) => {
            const color = RISK_COLOR[role.risk_band] ?? BRAND.amber;
            const isOpen = selected?.role_code === role.role_code;
            return (
              <div key={role.role_code} className="rounded-xl border overflow-hidden" style={{ borderColor: isOpen ? color : BRAND.border }}>
                <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setSelected(isOpen ? null : role)}>
                  <div className="relative w-10 h-10 shrink-0">
                    <svg width="40" height="40" className="-rotate-90">
                      <circle cx="20" cy="20" r="14" fill="none" stroke="#F3F4F6" strokeWidth="5" />
                      <circle cx="20" cy="20" r="14" fill="none" stroke={color} strokeWidth="5"
                        strokeDasharray={2 * Math.PI * 14} strokeDashoffset={2 * Math.PI * 14 * (1 - role.risk_score / 100)}
                        strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color }}>{role.risk_score}</span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-800 truncate">{role.role_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${color}15`, color }}>{role.risk_band.replace('_', '-')} risk</span>
                      {role.industry && <span className="text-[10px] text-gray-400 capitalize">{role.industry}</span>}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-300 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t space-y-3" style={{ borderColor: BRAND.border, backgroundColor: `${color}04` }}>
                    {role.timeline_years && <p className="text-[10px] text-gray-500 pt-3">Horizon: ~{role.timeline_years} years · Source: {role.source ?? 'platform'}</p>}
                    {(role.exposed_tasks?.length > 0) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1"><AlertTriangle size={11} style={{ color: BRAND.red }} /> Exposed Tasks</p>
                        <div className="space-y-1">{role.exposed_tasks.map((t: string, i: number) => <p key={i} className="text-[11px] text-gray-500 flex items-start gap-1.5"><span className="text-red-300 mt-0.5 shrink-0">▸</span>{t}</p>)}</div>
                      </div>
                    )}
                    {(role.resilient_tasks?.length > 0) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1"><CheckCircle size={11} style={{ color: BRAND.green }} /> Resilient Tasks</p>
                        <div className="space-y-1">{role.resilient_tasks.map((t: string, i: number) => <p key={i} className="text-[11px] text-gray-500 flex items-start gap-1.5"><span className="mt-0.5 shrink-0" style={{ color: BRAND.green }}>▸</span>{t}</p>)}</div>
                      </div>
                    )}
                    {(role.upskill_priorities?.length > 0) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1"><TrendingUp size={11} style={{ color: BRAND.blue }} /> Upskill Priorities</p>
                        <div className="flex flex-wrap gap-1">{role.upskill_priorities.map((p: string, i: number) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.blue}12`, color: BRAND.blue }}>{p}</span>)}</div>
                      </div>
                    )}
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

// ── Sub-Tab 5: Industry Forecast ───────────────────────────────────────────
function IndustryForecastTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const OUTLOOK_COLOR: Record<string, string> = {
    exceptional: '#43C59E', strong: '#45AAF2', moderate: '#6C63FF',
    stable: '#F7B731', declining: '#FC5C65',
  };

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/frp/industry-forecast').then(r => { setData(r); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const industries: any[] = data?.industries ?? [];

  if (!industries.length) {
    return <EmptyState icon={<Globe size={36} />} title="No industry forecasts available" hint="Industry forecasts are seeded on first boot. Restart the backend with FF_FUTURE_READINESS=1 to initialise the catalog." />;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">10-sector outlook · 5-year horizon · Based on WEF, McKinsey and OECD reports</p>
      {industries.map((ind: any) => {
        const oc = OUTLOOK_COLOR[ind.growth_outlook] ?? BRAND.primary;
        const dc = IMPACT_COLOR[ind.ai_disruption_band] ?? BRAND.amber;
        const isOpen = selected?.industry_code === ind.industry_code;
        const sds = ind.skill_demand_shift ?? {};
        return (
          <div key={ind.industry_code} className="rounded-xl border overflow-hidden" style={{ borderColor: isOpen ? oc : BRAND.border }}>
            <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
              onClick={() => setSelected(isOpen ? null : ind)}>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 truncate">{ind.industry_name}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${oc}15`, color: oc }}>{ind.growth_outlook}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.blue}12`, color: BRAND.blue }}>AI-ready: {ind.ai_readiness_score}</span>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${dc}15`, color: dc }}>AI disruption: {ind.ai_disruption_band}</span>
                  <span className="text-[10px] text-gray-400">{ind.horizon_years}y horizon</span>
                </div>
              </div>
              {isOpen ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-300 shrink-0" />}
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t space-y-4" style={{ borderColor: BRAND.border }}>
                <div className="grid grid-cols-1 gap-3 pt-3">
                  {sds.rising?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Rising Skills</p>
                      <div className="flex flex-wrap gap-1">{sds.rising.map((s: string, i: number) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.green}12`, color: BRAND.green }}>{s}</span>)}</div>
                    </div>
                  )}
                  {sds.declining?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Declining Skills</p>
                      <div className="flex flex-wrap gap-1">{sds.declining.map((s: string, i: number) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.red}10`, color: BRAND.red }}>{s}</span>)}</div>
                    </div>
                  )}
                  {ind.top_growing_roles?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Top Growing Roles</p>
                      <div className="space-y-1">{ind.top_growing_roles.map((r: string, i: number) => <p key={i} className="text-[11px] text-gray-600 flex items-center gap-1.5"><TrendingUp size={9} style={{ color: BRAND.blue }} />{r}</p>)}</div>
                    </div>
                  )}
                  {ind.top_declining_roles?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Top Declining Roles</p>
                      <div className="space-y-1">{ind.top_declining_roles.map((r: string, i: number) => <p key={i} className="text-[11px] text-gray-600 flex items-center gap-1.5"><AlertTriangle size={9} style={{ color: BRAND.red }} />{r}</p>)}</div>
                    </div>
                  )}
                  {ind.source_rationale && <p className="text-[10px] text-gray-400 italic">{ind.source_rationale}</p>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-Tab 6: My Roadmap ──────────────────────────────────────────────────
function MyRoadmapTab({ userId }: { userId?: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [evolutions, setEvolutions] = useState<any[]>([]);

  const loadRecs = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    const [recs, evo] = await Promise.all([
      apiFetch(`/api/frp/recommendations${refresh ? '?refresh=1' : ''}`),
      apiFetch('/api/frp/role-evolution'),
    ]);
    setData(recs);
    setEvolutions(evo?.evolutions ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadRecs(); }, [loadRecs]);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const recs: any[] = data?.recommendations ?? [];

  const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    skill_reskill:        { label: 'Reskill', color: BRAND.red, icon: <AlertTriangle size={12} /> },
    skill_upskill:        { label: 'Upskill', color: BRAND.blue, icon: <TrendingUp size={12} /> },
    role_pivot:           { label: 'Role Pivot', color: BRAND.primary, icon: <ArrowRight size={12} /> },
    role_resilience_alert:{ label: 'Risk Alert', color: BRAND.amber, icon: <Shield size={12} /> },
  };

  return (
    <div className="space-y-5">
      {/* Recommendations */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Personalised Actions</h4>
        {recs.length === 0 ? (
          <EmptyState icon={<Map size={36} />} title="No personalised recommendations yet"
            hint="Add skills to your profile and complete a CAPADEX session — the recommendation engine needs your skill profile, role context and industry target to generate actions." />
        ) : (
          <div className="space-y-2">
            {recs.map((rec: any, i: number) => {
              const meta = TYPE_META[rec.rec_type] ?? { label: rec.rec_type, color: BRAND.primary, icon: <Target size={12} /> };
              return (
                <div key={i} className="rounded-xl border p-3" style={{ borderColor: BRAND.border, borderLeftWidth: 3, borderLeftColor: meta.color }}>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5" style={{ color: meta.color }}>{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>{meta.label}</span>
                        <span className="text-[10px] text-gray-400">Priority {rec.priority}</span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">{rec.rationale}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Role Evolution Paths */}
      {evolutions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Role Evolution Paths</h4>
          <div className="space-y-2">
            {evolutions.slice(0, 8).map((ev: any, i: number) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: BRAND.border }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-600">{ev.from_role}</span>
                  <ArrowRight size={12} className="text-gray-400 shrink-0" />
                  <span className="text-xs font-medium text-gray-800">{ev.to_role}</span>
                  {ev.is_ai_driven && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>AI-driven</span>}
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.blue}12`, color: BRAND.blue }}>{ev.evolution_type}</span>
                  <span className="text-[10px] text-gray-500">Feasibility: {ev.feasibility_score}/100</span>
                  <span className="text-[10px] text-gray-400">{ev.transition_months_min}–{ev.transition_months_max} months</span>
                </div>
                {ev.required_skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(ev.required_skills as string[]).slice(0, 4).map((s, j) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.green}12`, color: BRAND.green }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => loadRecs(true)} disabled={refreshing}
        className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl border transition-all disabled:opacity-50"
        style={{ borderColor: BRAND.primary, color: BRAND.primary }}>
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Regenerating…' : 'Regenerate Recommendations'}
      </button>
    </div>
  );
}

// ── Product 1: Future Skills Planner ──────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  reskill: '#FC5C65', upskill: '#45AAF2', deepen: '#43C59E', maintain: '#9CA3AF',
};
const HORIZON_META = [
  { key: 'immediate', label: 'Immediate', sub: '0–6 months', color: '#FC5C65' },
  { key: 'near_term', label: 'Near-term',  sub: '6–18 months', color: '#F7B731' },
  { key: 'future',   label: 'Future',      sub: '18+ months',  color: '#43C59E' },
];

function FutureSkillsPlannerTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openHorizon, setOpenHorizon] = useState<string>('immediate');

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/frp/products/skills-planner').then(r => { setData(r); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const horizon = data?.horizon ?? { immediate: [], near_term: [], future: [] };
  const counts  = data?.horizon_counts ?? { immediate: 0, near_term: 0, future: 0 };
  const planScore = data?.plan_score ?? 0;

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border, background: 'linear-gradient(135deg, #F8F7FF 0%, #fff 100%)' }}>
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 shrink-0">
            <svg width="56" height="56" className="-rotate-90">
              <circle cx="28" cy="28" r="20" fill="none" stroke="#EDE9FF" strokeWidth="6" />
              <circle cx="28" cy="28" r="20" fill="none" stroke={BRAND.primary} strokeWidth="6"
                strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - planScore / 100)}
                strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: BRAND.primary }}>{planScore}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">Skill Plan Score</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {data?.avg_proficiency ?? 0}% avg proficiency · {data?.total_skills ?? 0} skills mapped
            </p>
            {data?.fri_skill_durability != null && (
              <p className="text-[10px] mt-1" style={{ color: BRAND.primary }}>FRI durability signal: {data.fri_skill_durability}</p>
            )}
          </div>
          <div className="flex flex-col gap-1 text-right shrink-0">
            {HORIZON_META.map(h => (
              <div key={h.key} className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${h.color}15`, color: h.color }}>
                  {(counts as any)[h.key]}
                </span>
                <span className="text-[10px] text-gray-400">{h.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Horizon sections */}
      {HORIZON_META.map(h => {
        const items: any[] = (horizon as any)[h.key] ?? [];
        const isOpen = openHorizon === h.key;
        return (
          <div key={h.key} className="rounded-xl border overflow-hidden" style={{ borderColor: isOpen ? h.color : BRAND.border }}>
            <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
              onClick={() => setOpenHorizon(isOpen ? '' : h.key)}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-800">{h.label}</p>
                  <p className="text-[10px] text-gray-400">{h.sub}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${h.color}15`, color: h.color }}>{items.length} skills</span>
                {isOpen ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-300" />}
              </div>
            </button>
            {isOpen && (
              <div className="border-t" style={{ borderColor: BRAND.border }}>
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No skills in this horizon.</p>
                ) : (
                  <div className="divide-y" style={{ borderColor: BRAND.border }}>
                    {items.map((s: any) => {
                      const ac = ACTION_COLOR[s.action_type] ?? BRAND.primary;
                      return (
                        <div key={s.skill_code} className="px-4 py-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{s.name}</p>
                              <p className="text-[10px] text-gray-400">{s.domain}{s.cluster ? ` · ${s.cluster}` : ''}</p>
                            </div>
                            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0"
                              style={{ backgroundColor: `${ac}15`, color: ac }}>{s.action_type}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                                <span>Proficiency</span><span>{s.proficiency_level}%</span>
                              </div>
                              <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${s.proficiency_level}%`, backgroundColor: BRAND.blue }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                                <span>Durability</span><span>{s.durability_score}</span>
                              </div>
                              <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${s.durability_score}%`, backgroundColor: BRAND.green }} />
                              </div>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-500 italic leading-relaxed">{s.rationale}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Product 2: AI Career Navigator ────────────────────────────────────────
const STANCE_META: Record<string, { label: string; color: string; bg: string }> = {
  positioned: { label: 'Well-positioned', color: BRAND.green,   bg: '#ECFDF5' },
  adaptive:   { label: 'Adaptive',        color: BRAND.amber,   bg: '#FFFBEB' },
  transition: { label: 'Needs pivot',     color: BRAND.red,     bg: '#FFF1F2' },
};

function AICareerNavigatorTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/frp/products/ai-navigator').then(r => { setData(r); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const vulnScore  = data?.vulnerability_score ?? 0;
  const navScore   = data?.nav_score ?? 0;
  const stance     = STANCE_META[data?.nav_stance ?? 'adaptive'];
  const safeHarbors: any[] = data?.safe_harbor_roles ?? [];
  const augOpps: any[]     = data?.augmentation_opportunities ?? [];
  const sectors: any[]     = data?.high_opportunity_sectors ?? [];

  return (
    <div className="space-y-4">
      {/* Dual gauge header */}
      <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border, backgroundColor: stance.bg }}>
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 shrink-0">
            <svg width="56" height="56" className="-rotate-90">
              <circle cx="28" cy="28" r="20" fill="none" stroke="#F3F4F6" strokeWidth="6" />
              <circle cx="28" cy="28" r="20" fill="none" stroke={vulnScore > 55 ? BRAND.red : vulnScore > 30 ? BRAND.amber : BRAND.green} strokeWidth="6"
                strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - vulnScore / 100)} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-700">{vulnScore}%</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: stance.color }}>{stance.label}</span>
              {data?.fri_band && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>{data.fri_band}</span>}
              {data?.personalization_active && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>
                  <Brain size={9} /> CAPADEX Personalised
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{data?.nav_message}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="text-center rounded-lg py-2" style={{ backgroundColor: `${BRAND.red}08` }}>
            <p className="text-sm font-bold" style={{ color: BRAND.red }}>{vulnScore}%</p>
            <p className="text-[9px] text-gray-500">AI Vulnerability</p>
          </div>
          <div className="text-center rounded-lg py-2" style={{ backgroundColor: `${BRAND.green}08` }}>
            <p className="text-sm font-bold" style={{ color: BRAND.green }}>{navScore}</p>
            <p className="text-[9px] text-gray-500">Navigator Score</p>
          </div>
        </div>
      </div>

      {/* Safe-harbor roles */}
      {safeHarbors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><Shield size={11} style={{ color: BRAND.green }} /> Safe-harbor Roles</p>
          <div className="space-y-2">
            {safeHarbors.map((r: any, i: number) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: BRAND.border }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{r.role_name}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{r.industry ?? 'cross-sector'}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>Risk: {r.risk_score}</span>
                </div>
                {r.upskill_priorities?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(r.upskill_priorities as string[]).map((p: string, j: number) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.blue}12`, color: BRAND.blue }}>{p}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Augmentation opportunities */}
      {augOpps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><TrendingUp size={11} style={{ color: BRAND.blue }} /> AI Augmentation Opportunities</p>
          <div className="space-y-2">
            {augOpps.map((s: any, i: number) => (
              <div key={i} className="rounded-xl border p-3 flex items-start gap-3" style={{ borderColor: BRAND.border }}>
                <div className="text-center shrink-0">
                  <p className="text-sm font-bold" style={{ color: BRAND.blue }}>{s.augmentation_potential}%</p>
                  <p className="text-[9px] text-gray-400">augment</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{s.name}</p>
                  <p className="text-[10px] text-gray-400">{s.domain}</p>
                  {s.resilience_rationale && <p className="text-[10px] text-gray-500 italic mt-1 leading-relaxed">"{s.resilience_rationale}"</p>}
                </div>
              </div>
            ))}
          </div>

          {/* CAPADEX priority skills — only present when user has completed assessment signals */}
          {(data?.capadex_priority_skills ?? []).length > 0 && (
            <div className="mt-3 rounded-xl border p-3 space-y-2.5" style={{ borderColor: BRAND.border, background: `${BRAND.green}06` }}>
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Brain size={11} style={{ color: BRAND.green }} /> Assessment-linked Priority Skills
              </p>
              <p className="text-[10px] text-gray-500 -mt-1">
                These skills map to constructs flagged in your CAPADEX assessment. Developing them addresses both AI-readiness and your identified growth areas.
              </p>
              {(data.capadex_priority_skills as any[]).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.domain}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <p className="text-[10px] font-bold" style={{ color: BRAND.green }}>{s.durability_score}</p>
                      <p className="text-[9px] text-gray-400">durability</p>
                    </div>
                    {s.displacement_risk > 0 && (
                      <div className="text-center">
                        <p className="text-[10px] font-bold" style={{ color: s.displacement_risk > 50 ? BRAND.red : BRAND.amber }}>{s.displacement_risk}%</p>
                        <p className="text-[9px] text-gray-400">at risk</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* High-opportunity sectors */}
      {sectors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><Globe size={11} style={{ color: BRAND.primary }} /> High-opportunity Sectors</p>
          <div className="space-y-2">
            {sectors.map((ind: any, i: number) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: BRAND.border }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-800">{ind.industry_name}</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${BRAND.green}12`, color: BRAND.green }}>{ind.growth_outlook}</span>
                </div>
                {ind.top_growing_roles?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(ind.top_growing_roles as string[]).map((r: string, j: number) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}>{r}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!safeHarbors.length && !augOpps.length && (
        <EmptyState icon={<Navigation size={36} />} title="Complete your skill profile to activate the navigator"
          hint="Add skills to your profile and run a readiness assessment — the AI Career Navigator needs your skill context to plot your optimal path." />
      )}
    </div>
  );
}

// ── Product 3: Career Transition Planner ──────────────────────────────────
const EVOL_COLOR: Record<string, string> = {
  adjacent: BRAND.blue, lateral: BRAND.primary, transformative: BRAND.green,
  ai_transition: BRAND.accent, specialisation: BRAND.amber,
};

function CareerTransitionPlannerTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(0);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/frp/products/transition-planner').then(r => { setData(r); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const paths: any[]   = data?.paths ?? [];
  const topPath: any   = data?.top_path;
  const transRecs: any[] = data?.transition_recs ?? [];

  return (
    <div className="space-y-4">
      {/* Stats banner */}
      {topPath && (
        <div className="rounded-xl border p-3" style={{ borderColor: BRAND.border, background: `linear-gradient(135deg, ${BRAND.primary}08 0%, #fff 100%)` }}>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Best-matched transition</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">{topPath.from_role}</span>
            <ArrowRight size={11} className="text-gray-400 shrink-0" />
            <span className="text-xs font-semibold text-gray-800">{topPath.to_role}</span>
            {topPath.is_ai_driven && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>AI-driven</span>}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-[10px]" style={{ color: BRAND.green }}>Feasibility: {topPath.adjusted_feasibility}/100</span>
            <span className="text-[10px] text-gray-400">{topPath.estimated_duration}</span>
            <span className="text-[10px]" style={{ color: BRAND.blue }}>Skill match: {topPath.skill_match_pct}%</span>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Paths Found', paths.length, BRAND.primary],
          ['Avg Feasibility', `${data?.avg_feasibility ?? 0}%`, BRAND.blue],
          ['Your Skills', data?.user_skill_count ?? 0, BRAND.green],
        ].map(([label, val, color]) => (
          <div key={String(label)} className="rounded-xl border p-2.5 text-center" style={{ borderColor: BRAND.border }}>
            <p className="text-sm font-bold" style={{ color: color as string }}>{val}</p>
            <p className="text-[9px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Path list */}
      {paths.length === 0 ? (
        <EmptyState icon={<Shuffle size={36} />} title="No transition paths available yet"
          hint="The transition engine maps your skill profile to role evolution paths. Add your skills and complete a readiness assessment to unlock personalised paths." />
      ) : (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Role Transition Paths</p>
          <div className="space-y-2">
            {paths.map((p: any, i: number) => {
              const ec = EVOL_COLOR[p.evolution_type] ?? BRAND.primary;
              const isOpen = selected === i;
              return (
                <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: isOpen ? ec : BRAND.border }}>
                  <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                    onClick={() => setSelected(isOpen ? null : i)}>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500 truncate">{p.from_role}</span>
                        <ArrowRight size={10} className="text-gray-400 shrink-0" />
                        <span className="text-xs font-medium text-gray-800 truncate">{p.to_role}</span>
                        {p.is_ai_driven && <span className="text-[9px] px-1 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>AI</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${ec}12`, color: ec }}>{p.evolution_type.replace('_', ' ')}</span>
                        <span className="text-[10px] text-gray-400">{p.estimated_duration}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold" style={{ color: ec }}>{p.adjusted_feasibility}</p>
                      <p className="text-[9px] text-gray-400">feasibility</p>
                    </div>
                    {isOpen ? <ChevronDown size={13} className="text-gray-400 shrink-0" /> : <ChevronRight size={13} className="text-gray-300 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 border-t space-y-3" style={{ borderColor: BRAND.border, backgroundColor: `${ec}04` }}>
                      <div className="pt-3">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>Skill match</span><span>{p.skill_match_pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p.skill_match_pct}%`, backgroundColor: ec }} />
                        </div>
                      </div>
                      {p.skill_gaps?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 mb-1.5">Skill Gaps to Bridge</p>
                          <div className="flex flex-wrap gap-1">
                            {(p.skill_gaps as string[]).map((g: string, j: number) => (
                              <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.red}10`, color: BRAND.red }}>{g}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {p.drop_skills?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 mb-1.5">Skills to Phase Out</p>
                          <div className="flex flex-wrap gap-1">
                            {(p.drop_skills as string[]).map((d: string, j: number) => (
                              <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transition-specific recommendations */}
      {transRecs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Your Transition Actions</p>
          <div className="space-y-2">
            {transRecs.map((rec: any, i: number) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: BRAND.border, borderLeftWidth: 3, borderLeftColor: BRAND.primary }}>
                <p className="text-xs text-gray-700 leading-relaxed">{rec.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Product 4: Entrepreneurship Intelligence ───────────────────────────────
const ENT_SCORE_BAND = (score: number) =>
  score >= 75 ? BRAND.green : score >= 55 ? BRAND.blue : score >= 35 ? BRAND.amber : BRAND.red;

function EntrepreneurshipIntelligenceTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/frp/products/entrepreneurship').then(r => { setData(r); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const entScore = data?.entrepreneurial_score ?? 0;
  const scoreColor = ENT_SCORE_BAND(entScore);
  const sectors: any[]   = data?.opportunity_sectors ?? [];
  const skillGaps: any[] = data?.skill_gaps ?? [];
  const strengths: any[] = data?.strengths ?? [];

  return (
    <div className="space-y-4">
      {/* Score + corpus note */}
      <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border, background: `linear-gradient(135deg, ${scoreColor}06 0%, #fff 100%)` }}>
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg width="64" height="64" className="-rotate-90">
              <circle cx="32" cy="32" r="24" fill="none" stroke="#F3F4F6" strokeWidth="7" />
              <circle cx="32" cy="32" r="24" fill="none" stroke={scoreColor} strokeWidth="7"
                strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - entScore / 100)} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: scoreColor }}>{entScore}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{data?.readiness_label ?? '—'}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {data?.fri_adaptability != null && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.blue}12`, color: BRAND.blue }}>Adaptability: {data.fri_adaptability}</span>}
              {data?.fri_learning_velocity != null && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.green}12`, color: BRAND.green }}>Learning velocity: {data.fri_learning_velocity}</span>}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{data?.skills_assessed ?? 0} skills assessed · {data?.ent_skill_count ?? 0} relevant</p>
          </div>
        </div>
      </div>

      {/* Corpus note (honest disclosure) */}
      {data?.corpus_note && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={11} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-amber-700 leading-relaxed">{data.corpus_note}</p>
        </div>
      )}

      {/* Opportunity sectors */}
      {sectors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><Globe size={11} style={{ color: BRAND.primary }} /> Opportunity Sectors</p>
          <div className="space-y-2">
            {sectors.map((ind: any, i: number) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: BRAND.border }}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-xs font-semibold text-gray-800">{ind.industry_name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.green}12`, color: BRAND.green }}>{ind.growth_outlook}</span>
                    <span className="text-[10px] text-gray-400">{ind.horizon_years}y</span>
                  </div>
                </div>
                {ind.rising_skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(ind.rising_skills as string[]).map((s: string, j: number) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths + Gaps side by side */}
      <div className="grid grid-cols-1 gap-3">
        {strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><Star size={11} style={{ color: BRAND.amber }} /> Entrepreneurial Strengths</p>
            <div className="space-y-1.5">
              {strengths.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BRAND.border }}>
                  <CheckCircle size={11} style={{ color: BRAND.green }} className="shrink-0" />
                  <span className="text-xs text-gray-700 flex-1">{s.name}</span>
                  <span className="text-[10px] font-bold" style={{ color: BRAND.green }}>{s.proficiency_level}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {skillGaps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><AlertTriangle size={11} style={{ color: BRAND.amber }} /> Skill Gaps to Bridge</p>
            <div className="space-y-1.5">
              {skillGaps.map((s: any, i: number) => (
                <div key={i} className="rounded-lg border px-3 py-2" style={{ borderColor: BRAND.border }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700">{s.name}</span>
                    <span className="text-[10px]" style={{ color: BRAND.amber }}>Gap: {s.gap}pts</span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.proficiency_level}%`, backgroundColor: BRAND.amber }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!sectors.length && !strengths.length && (
        <EmptyState icon={<Lightbulb size={36} />} title="Build your entrepreneurial profile"
          hint="Add leadership, innovation, and strategy skills to your profile. The entrepreneurship engine maps them to high-growth opportunity sectors." />
      )}
    </div>
  );
}

// ── Product 5: Emerging Career Intelligence ────────────────────────────────
const ENTRY_COLOR: Record<string, string> = {
  industry_growth: BRAND.green, transformative: BRAND.primary, ai_transition: BRAND.blue,
};

function EmergingCareersTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/frp/products/emerging-careers').then(r => { setData(r); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (data?.__flagOff) return <FeatureDisabled />;

  const roles: any[]          = data?.emerging_roles ?? [];
  const futureSkills: any[]   = data?.future_proof_skills ?? [];
  const transitivePaths: any[] = data?.transformative_paths ?? [];
  const alignScore             = data?.alignment_score ?? 0;

  return (
    <div className="space-y-4">
      {/* Alignment header */}
      <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border, background: 'linear-gradient(135deg, #F0FDF4 0%, #fff 100%)' }}>
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 shrink-0">
            <svg width="56" height="56" className="-rotate-90">
              <circle cx="28" cy="28" r="20" fill="none" stroke="#F3F4F6" strokeWidth="6" />
              <circle cx="28" cy="28" r="20" fill="none" stroke={BRAND.green} strokeWidth="6"
                strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - alignScore / 100)} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color: BRAND.green }}>{alignScore}%</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">Emerging Career Alignment</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {data?.user_high_growth_skills ?? 0} high-growth skills in your profile · {data?.total_emerging ?? 0} emerging roles tracked
            </p>
            {data?.fri_market_alignment != null && (
              <p className="text-[10px] mt-1" style={{ color: BRAND.blue }}>Market alignment: {data.fri_market_alignment}</p>
            )}
          </div>
        </div>
      </div>

      {/* Future-proof skills grid */}
      {futureSkills.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><Zap size={11} style={{ color: BRAND.amber }} /> Future-proof Skills</p>
          <div className="grid grid-cols-2 gap-2">
            {futureSkills.map((s: any, i: number) => (
              <div key={i} className="rounded-xl border p-2.5" style={{ borderColor: s.user_has ? BRAND.green : BRAND.border, backgroundColor: s.user_has ? `${BRAND.green}06` : '#fff' }}>
                <div className="flex items-start justify-between gap-1">
                  <p className="text-[11px] font-semibold text-gray-800 leading-tight">{s.name}</p>
                  {s.user_has && <CheckCircle size={10} style={{ color: BRAND.green }} className="shrink-0 mt-0.5" />}
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5">{s.domain}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[9px] font-semibold" style={{ color: BRAND.green }}>New work: {s.new_work_creation}%</span>
                  <span className="text-[9px] text-gray-400">Dur: {s.durability_score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emerging roles list */}
      {roles.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><Compass size={11} style={{ color: BRAND.primary }} /> Emerging Roles</p>
          <div className="space-y-2">
            {roles.map((r: any, i: number) => {
              const ec = ENTRY_COLOR[r.entry_type] ?? BRAND.primary;
              const isOpen = selected === i;
              return (
                <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: isOpen ? ec : BRAND.border }}>
                  <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                    onClick={() => setSelected(isOpen ? null : i)}>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-semibold text-gray-800">{r.role_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${ec}12`, color: ec }}>
                          {r.entry_type === 'industry_growth' ? 'Industry growth' : r.entry_type?.replace('_', ' ')}
                        </span>
                        {r.industry && <span className="text-[10px] text-gray-400">{r.industry}</span>}
                        {r.horizon && <span className="text-[10px] text-gray-400">{r.horizon}</span>}
                        {r.timeline && <span className="text-[10px] text-gray-400">{r.timeline}</span>}
                        {r.is_ai_driven && <span className="text-[9px] px-1 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>AI-driven</span>}
                      </div>
                    </div>
                    {r.feasibility != null && (
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold" style={{ color: ec }}>{r.feasibility}</p>
                        <p className="text-[9px] text-gray-400">feasibility</p>
                      </div>
                    )}
                    {isOpen ? <ChevronDown size={13} className="text-gray-400 shrink-0" /> : <ChevronRight size={13} className="text-gray-300 shrink-0" />}
                  </button>
                  {isOpen && r.required_skills?.length > 0 && (
                    <div className="px-4 pb-4 border-t pt-3 space-y-2" style={{ borderColor: BRAND.border }}>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 mb-1">Required Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {(r.required_skills as string[]).map((s: string, j: number) => (
                            <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.blue}12`, color: BRAND.blue }}>{s}</span>
                          ))}
                        </div>
                      </div>
                      {r.skill_gaps?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 mb-1">Your Gaps</p>
                          <div className="flex flex-wrap gap-1">
                            {(r.skill_gaps as string[]).map((g: string, j: number) => (
                              <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.red}10`, color: BRAND.red }}>{g}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!roles.length && !futureSkills.length && (
        <EmptyState icon={<Compass size={36} />} title="No emerging career data available"
          hint="Emerging roles are derived from industry forecasts and transformative role paths. Ensure the FRP catalog is seeded (FF_FUTURE_READINESS=1 on first boot)." />
      )}
    </div>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────
type SubTab =
  | 'readiness' | 'skills' | 'ai-impact' | 'automation' | 'forecast' | 'roadmap'
  | 'skills-planner' | 'ai-navigator' | 'transition-planner' | 'entrepreneurship' | 'emerging-careers';

export default function FutureReadinessTab({ userId }: { userId?: number }) {
  const [activeTab, setActiveTab] = useState<SubTab>('readiness');

  const INTEL_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'readiness',  label: 'Readiness Index',   icon: <Activity size={13} /> },
    { id: 'skills',     label: 'Skill Landscape',    icon: <Layers size={13} /> },
    { id: 'ai-impact',  label: 'AI Impact',          icon: <Brain size={13} /> },
    { id: 'automation', label: 'Automation Risk',    icon: <Shield size={13} /> },
    { id: 'forecast',   label: 'Industry Forecast',  icon: <Globe size={13} /> },
    { id: 'roadmap',    label: 'My Roadmap',         icon: <Map size={13} /> },
  ];

  const PRODUCT_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'skills-planner',     label: 'Skills Planner',    icon: <Rocket size={13} /> },
    { id: 'ai-navigator',       label: 'AI Navigator',      icon: <Navigation size={13} /> },
    { id: 'transition-planner', label: 'Transition Planner',icon: <Shuffle size={13} /> },
    { id: 'entrepreneurship',   label: 'Entrepreneurship',  icon: <Lightbulb size={13} /> },
    { id: 'emerging-careers',   label: 'Emerging Careers',  icon: <Compass size={13} /> },
  ];

  const isProduct = PRODUCT_TABS.some(t => t.id === activeTab);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Zap size={16} style={{ color: BRAND.primary }} />
            Future Readiness Platform
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">AI impact · Automation risk · Skill durability · 5 intelligence products</p>
        </div>
      </div>

      {/* Platform Intelligence tabs */}
      <div>
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Platform Intelligence</p>
        <div className="flex gap-1 flex-wrap">
          {INTEL_TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
              style={activeTab === t.id && !isProduct
                ? { backgroundColor: BRAND.primary, color: '#fff' }
                : { backgroundColor: '#F3F4F6', color: '#6B7280' }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product tabs */}
      <div>
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Intelligence Products</p>
        <div className="flex gap-1 flex-wrap">
          {PRODUCT_TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
              style={activeTab === t.id
                ? { backgroundColor: BRAND.accent, color: '#fff' }
                : { backgroundColor: '#FFF0F3', color: '#FF6584' }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panels */}
      {activeTab === 'readiness'          && <ReadinessIndexTab userId={userId} />}
      {activeTab === 'skills'             && <SkillLandscapeTab />}
      {activeTab === 'ai-impact'          && <AIImpactTab />}
      {activeTab === 'automation'         && <AutomationRiskTab />}
      {activeTab === 'forecast'           && <IndustryForecastTab />}
      {activeTab === 'roadmap'            && <MyRoadmapTab userId={userId} />}
      {activeTab === 'skills-planner'     && <FutureSkillsPlannerTab />}
      {activeTab === 'ai-navigator'       && <AICareerNavigatorTab />}
      {activeTab === 'transition-planner' && <CareerTransitionPlannerTab />}
      {activeTab === 'entrepreneurship'   && <EntrepreneurshipIntelligenceTab />}
      {activeTab === 'emerging-careers'   && <EmergingCareersTab />}
    </div>
  );
}
