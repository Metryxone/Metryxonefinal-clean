import { DashboardIntro } from '../components/career/DashboardIntro';
import ContextualBenchmarkV2Panel from '../components/career/ContextualBenchmarkV2Panel';
/**
 * Phase 2 — Adaptive Benchmark Dashboard.
 *
 * Consumes /api/benchmark/* (read-only). Renders six panels:
 *   1. Role alignment (with empirical percentile + fit band)
 *   2. Competency radar (per-competency percentiles)
 *   3. Cohort + confidence explainability (tier, n, k-anonymity)
 *   4. Percentile distribution viz (histogram + user marker)
 *   5. Psychometric reliability indicators
 *   6. Aspirational role gap analysis
 *
 * Deep-link: ?screen=benchmark-dashboard
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Loader2, Shield, Layers as LayersIcon,
  TrendingUp, Target, Activity, GitCompare, Info,
} from 'lucide-react';

interface Props { onNavigate?: (screen: string) => void }

const BRAND = {
  primary: '#0F172A', accent: '#FB923C', green: '#16A34A', amber: '#D97706',
  red: '#DC2626', blue: '#2563EB', surface: '#FFFFFF', bg: '#F8FAFC',
  border: '#E2E8F0',
};

interface Role { id: string; title: string; seniority: string|null; layer_name: string; industry_name: string }
interface Layer { id: string; name: string }
interface CompPct {
  competency_id: string; canonical_name: string;
  user_score: number; percentile: number; weight: number;
  expected_level: number; contribution: number;
}
interface RoleBenchmark {
  role_id: string; alignment_score: number; fit_band: string; coverage: number;
  weighted_percentile_in_cohort: number;
  cohort: { id: string; name: string; type: string; n: number|null; tier: string; k_anonymous: boolean };
  competencies: CompPct[];
  weighting: { version: string; modifiers: Array<{ competency: string; factor: string; multiplier: number; reason: string }> };
  explainability: any;
}
interface CompetencyBenchmark {
  competency_id: string; user_score: number; percentile: number; band: string;
  confidence_interval_95: [number, number]|null; z_diagnostic: number|null;
  cohort_aggregates: { n: number; mean: number; median: number; stddev: number;
    p10: number; p25: number; p50: number; p75: number; p90: number; p95: number };
  explainability: any;
}
interface DistRow {
  cohort_id: string; competency_id: string; bucket_size: number; n: number;
  histogram: Array<{ bucket: number; count: number }>;
}
interface Reliability {
  reliability: {
    response_consistency: number; reverse_item_validity: number;
    contradiction_count: number; confidence_score: number;
    reliability_index: number; completion_quality: number;
    anomaly_flags: string[]; stability_score: number|null;
    contradictions: Array<{ a: string; b: string; delta: number }>;
  };
  quality: {
    total_items: number; answered_items: number; completion_rate: number;
    avg_response_ms: number|null; fast_response_pct: number;
    straightline_pct: number; quality_tier: string;
  };
}
interface ConfidenceRow {
  cohort_id: string; cohort_name: string; cohort_type: string;
  competency_id: string; canonical_name: string;
  n: number; tier: 'A'|'B'|'C'|'D'|'provisional';
  ci_low: number; ci_high: number; freshness_days: number; reasoning: string;
}
interface ConfidenceData { tier_summary: Record<string, number>; rows: ConfidenceRow[] }
interface LayerBenchmark {
  cohort: { id: string; name: string; type: string; n: number; tier: string; k_anonymous: boolean; k_min: number };
  layer_id: string;
  competencies: Array<{ competency_id: string; canonical_name: string; user_score: number; percentile: number|null; band: string|null }>;
}
interface Aspirational {
  current: { role_id: string; alignment: number; fit_band: string }|null;
  target:  { role_id: string; alignment: number; fit_band: string;
             weighted_percentile_in_cohort: number; cohort: any };
  readiness_index: number;
  critical_gaps: Array<{ canonical_name: string; user_score: number; expected_anchor: number; gap: number; status: string }>;
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'request_failed');
  return j.data as T;
}

export default function BenchmarkDashboardPage({ onNavigate }: Props) {
  // ---- context selectors --------------------------------------------------
  const [roles, setRoles]   = useState<Role[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [roleId, setRoleId] = useState<string>('');
  const [targetRoleId, setTargetRoleId] = useState<string>('');
  const [layerId, setLayerId] = useState<string>('');
  const [seniority, setSeniority] = useState<string>('mid');
  const [orgMaturity, setOrgMaturity] = useState<string>('established');
  const [teamScale, setTeamScale] = useState<string>('medium');
  const [geography, setGeography] = useState<string>('global');
  const sessionId = useMemo(() => `dash-${Math.random().toString(36).slice(2, 9)}`, []);

  // ---- data ---------------------------------------------------------------
  const [role, setRole] = useState<RoleBenchmark | null>(null);
  const [reliability, setReliability] = useState<Reliability | null>(null);
  const [aspirational, setAspirational] = useState<Aspirational | null>(null);
  const [dist, setDist] = useState<DistRow | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceData | null>(null);
  const [layerBench, setLayerBench] = useState<LayerBenchmark | null>(null);
  const [selectedComp, setSelectedComp] = useState<string>('');
  const [selectedCompBench, setSelectedCompBench] = useState<CompetencyBenchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // initial fetch
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/ontology/roles').then(x => x.json());
        const l = await fetch('/api/ontology/layers').then(x => x.json());
        setRoles(r.data || []);
        setLayers(l.data || []);
        if (r.data?.length) {
          setRoleId(r.data[0].id);
          setTargetRoleId(r.data.find((x: Role) => x.id !== r.data[0].id)?.id ?? r.data[0].id);
        }
      } catch (e: any) { setErr(e.message); }
    })();
  }, []);

  // fetch role/aspirational/reliability whenever inputs change
  useEffect(() => {
    if (!roleId || !targetRoleId) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const params = new URLSearchParams({
          demo: 'true', session_id: sessionId,
          role_id: roleId, target_role_id: targetRoleId,
          layer_id: layerId || '', seniority, org_maturity: orgMaturity,
          team_scale: teamScale, geography,
        });
        const [r, a, rel, conf, layer] = await Promise.all([
          getJSON<RoleBenchmark>(`/api/benchmark/role?${params}`),
          getJSON<Aspirational>(`/api/benchmark/aspirational?${params}`),
          getJSON<Reliability>(`/api/benchmark/reliability?demo=true&session_id=${sessionId}`),
          getJSON<ConfidenceData>(`/api/benchmark/confidence`),
          layerId ? getJSON<LayerBenchmark>(`/api/benchmark/layer?layer_id=${layerId}&demo=true&session_id=${sessionId}`) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setRole(r); setAspirational(a); setReliability(rel);
        setConfidence(conf); setLayerBench(layer);
        if (r.competencies.length && !selectedComp) setSelectedComp(r.competencies[0].competency_id);
      } catch (e: any) { if (!cancelled) setErr(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId, targetRoleId, layerId, seniority, orgMaturity, teamScale, geography]);

  // fetch distribution + competency benchmark for selected competency
  useEffect(() => {
    if (!selectedComp || !role) return;
    const userScore = role.competencies.find(c => c.competency_id === selectedComp)?.user_score;
    if (typeof userScore !== 'number') return;
    let cancelled = false;
    (async () => {
      try {
        const [d, c] = await Promise.all([
          fetch(`/api/ontology/methodology`).then(()=>null), // touch (warm)
          getJSON<CompetencyBenchmark>(
            `/api/benchmark/competency?competency_id=${selectedComp}&score=${userScore}&cohort=role&role_id=${roleId}`),
        ]);
        void d;
        if (!cancelled) {
          setSelectedCompBench(c);
          // histogram via percentile_distributions table is internal — derive
          // a quick histogram view from the competency aggregates instead.
        }
        // dedicated histogram fetch:
        try {
          const histResp = await fetch(
            `/api/benchmark/competency?competency_id=${selectedComp}&score=${userScore}&cohort=role&role_id=${roleId}`);
          await histResp.json();
        } catch {}
      } catch (e: any) { if (!cancelled) setErr(e.message); }
    })();
    return () => { cancelled = true; };
  }, [selectedComp, role, roleId]);

  if (err) return (
    <div className="p-8 text-sm text-red-700 bg-red-50">Error: {err}</div>
  );

  return (
    <div className="min-h-screen" style={{ background: BRAND.bg }}>
      {/* Top bar */}
      <header className="border-b" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => onNavigate?.('landing')}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16}/> Home
          </button>
          <div className="h-6 w-px bg-gray-200"/>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500">MetryxOne · Phase 2</div>
            <h1 className="text-xl font-bold" style={{ color: BRAND.primary }}>
              Adaptive Benchmark Intelligence
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => onNavigate?.('career-builder?tab=assessment')}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all hover:brightness-110 active:scale-95"
              style={{ background: BRAND.primary }}
              data-testid="benchmark-take-assessment"
            >
              Take / Retake Competency Assessment
            </button>
            <div className="text-[11px] text-gray-500">
              Methodology v2.0.0 · Empirical percentile · k-anonymous
            </div>
          </div>
        </div>
      </header>

      <DashboardIntro
        title="Adaptive Benchmark"
        whatItIs="Your competency scores compared to real peer cohorts — same role, industry and layer. Empirical percentiles with a confidence tier (A/B/C/D)."
        whenToUse="Open right after taking the Competency Assessment, and any time you want a peer-relative read on a specific skill."
        prereq="Take the Competency Assessment first"
        audience="Individuals"
      />

      {/* Phase 3 — Contextual Benchmark V2 (additive, feature-flagged) */}
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <ContextualBenchmarkV2Panel
          context={{ role: roleId, layer: layerId, seniority, geography }}
        />
      </div>

      {/* Context bar */}
      <div className="border-b" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap gap-3 items-center text-[12px]">
          <Selector label="Role" value={roleId} onChange={setRoleId}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.title}{r.seniority ? ` (${r.seniority})` : ''}</option>)}
          </Selector>
          <Selector label="Target (aspirational)" value={targetRoleId} onChange={setTargetRoleId}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.title}{r.seniority ? ` (${r.seniority})` : ''}</option>)}
          </Selector>
          <Selector label="Layer" value={layerId} onChange={setLayerId}>
            <option value="">— none —</option>
            {layers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Selector>
          <Selector label="Seniority" value={seniority} onChange={setSeniority}>
            {['junior','mid','senior','lead','executive'].map(s => <option key={s} value={s}>{s}</option>)}
          </Selector>
          <Selector label="Maturity" value={orgMaturity} onChange={setOrgMaturity}>
            {['startup','scaleup','established','enterprise'].map(s => <option key={s} value={s}>{s}</option>)}
          </Selector>
          <Selector label="Team scale" value={teamScale} onChange={setTeamScale}>
            {['small','medium','large','massive'].map(s => <option key={s} value={s}>{s}</option>)}
          </Selector>
          <Selector label="Geography" value={geography} onChange={setGeography}>
            {['apac','emea','amer','global'].map(s => <option key={s} value={s}>{s}</option>)}
          </Selector>
          {loading && <span className="ml-auto flex items-center gap-1 text-gray-500"><Loader2 size={12} className="animate-spin"/>computing…</span>}
        </div>
      </div>

      {/* Body */}
      <main className="max-w-7xl mx-auto px-6 py-6 grid lg:grid-cols-3 gap-4">
        {/* Role alignment */}
        <div className="lg:col-span-2 rounded-xl border p-5" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
          <SectionHeader icon={<Target size={14}/>} title="Role Alignment" right={role &&
            <Pill tone={fitTone(role.fit_band)}>{role.fit_band}</Pill>}/>
          {role && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Metric label="Alignment score"           value={`${role.alignment_score.toFixed(1)} / 100`}/>
                <Metric label="Empirical percentile (cohort)" value={`${role.weighted_percentile_in_cohort}%`}/>
                <Metric label="Coverage"                  value={`${(role.coverage * 100).toFixed(0)}%`}/>
              </div>
              <CompetencyRadar comps={role.competencies}
                onSelect={setSelectedComp} selected={selectedComp}/>
            </>
          )}
        </div>

        {/* Cohort & confidence */}
        <div className="rounded-xl border p-5" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
          <SectionHeader icon={<Shield size={14}/>} title="Cohort & Confidence"/>
          {role && (
            <div className="space-y-3 text-[12.5px]">
              <Row k="Cohort"          v={role.cohort.name}/>
              <Row k="Type"            v={role.cohort.type}/>
              <Row k="Sample size (n)" v={String(role.cohort.n ?? '—')}/>
              <Row k="Confidence tier" v={<Pill tone={tierTone(role.cohort.tier)}>{role.cohort.tier}</Pill>}/>
              <Row k="k-anonymous"     v={role.cohort.k_anonymous ? 'yes' : 'no'}/>
              <div className="text-[11.5px] text-gray-600 mt-3 pt-3 border-t" style={{ borderColor: BRAND.border }}>
                <div className="flex items-center gap-1 mb-1"><Info size={11}/> Privacy</div>
                Aggregate-only · raw peer records never exposed · k-min = 30.
              </div>
              <div className="text-[11.5px] text-gray-600">
                <div className="flex items-center gap-1 mb-1"><Info size={11}/> Methodology</div>
                Empirical (count(samples ≤ score) / n) — no Gaussian assumption.
              </div>
            </div>
          )}
        </div>

        {/* Selected competency deep-dive */}
        <div className="lg:col-span-2 rounded-xl border p-5" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
          <SectionHeader icon={<TrendingUp size={14}/>} title={`Competency Deep-Dive`}
            right={selectedCompBench && <Pill tone={bandTone(selectedCompBench.band)}>{selectedCompBench.band}</Pill>}/>
          {selectedCompBench && (
            <>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <Metric label="Your score" value={String(selectedCompBench.user_score)}/>
                <Metric label="Percentile" value={`${selectedCompBench.percentile}%`}/>
                <Metric label="Cohort median" value={String(Math.round(selectedCompBench.cohort_aggregates.median))}/>
                <Metric label="z (diagnostic)" value={selectedCompBench.z_diagnostic?.toFixed(2) ?? '—'}/>
              </div>
              <PercentileDistribution
                aggregates={selectedCompBench.cohort_aggregates}
                userScore={selectedCompBench.user_score}
                ci={selectedCompBench.confidence_interval_95}/>
            </>
          )}
        </div>

        {/* Reliability */}
        <div className="rounded-xl border p-5" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
          <SectionHeader icon={<Activity size={14}/>} title="Psychometric Reliability"/>
          {reliability && (
            <div className="space-y-3 text-[12.5px]">
              <Bar k="Reliability index"     v={reliability.reliability.reliability_index}/>
              <Bar k="Response consistency"  v={reliability.reliability.response_consistency}/>
              <Bar k="Reverse-item validity" v={reliability.reliability.reverse_item_validity}/>
              <Bar k="Confidence score"      v={reliability.reliability.confidence_score}/>
              <Bar k="Completion quality"    v={reliability.reliability.completion_quality}/>
              <Row k="Contradictions" v={String(reliability.reliability.contradiction_count)}/>
              <Row k="Anomaly flags"  v={reliability.reliability.anomaly_flags.length
                ? reliability.reliability.anomaly_flags.join(', ') : '— none —'}/>
              <Row k="Quality tier"   v={<Pill tone={tierTone(reliability.quality.quality_tier)}>{reliability.quality.quality_tier}</Pill>}/>
            </div>
          )}
        </div>

        {/* Aspirational role */}
        <div className="lg:col-span-3 rounded-xl border p-5" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
          <SectionHeader icon={<GitCompare size={14}/>} title="Aspirational Role Readiness"/>
          {aspirational && (
            <div className="grid lg:grid-cols-[280px_1fr] gap-5">
              <div className="space-y-3 text-[12.5px]">
                {aspirational.current && (
                  <Row k="Current role alignment" v={`${aspirational.current.alignment.toFixed(1)} (${aspirational.current.fit_band})`}/>
                )}
                <Row k="Target alignment" v={`${aspirational.target.alignment.toFixed(1)} (${aspirational.target.fit_band})`}/>
                <Row k="Target percentile" v={`${aspirational.target.weighted_percentile_in_cohort}%`}/>
                <Row k="Readiness index" v={
                  <span style={{ color: aspirational.readiness_index >= 70 ? BRAND.green : BRAND.amber, fontWeight: 600 }}>
                    {aspirational.readiness_index.toFixed(1)}
                  </span>
                }/>
                <Row k="Target cohort" v={`${aspirational.target.cohort?.name ?? '—'} (${aspirational.target.cohort?.tier ?? '—'})`}/>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  Critical gaps (top 5 below target anchor)
                </div>
                <div className="space-y-2">
                  {aspirational.critical_gaps.length === 0 && (
                    <div className="text-[12px] text-gray-500">No critical gaps — meeting target anchors.</div>
                  )}
                  {aspirational.critical_gaps.map(g => (
                    <div key={g.canonical_name} className="rounded-lg border p-3" style={{ borderColor: BRAND.border }}>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="font-medium" style={{ color: BRAND.primary }}>{g.canonical_name}</span>
                        <span className="tabular-nums" style={{ color: BRAND.red }}>{g.gap}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Your {g.user_score} → target anchor {g.expected_anchor}
                      </div>
                      <div className="h-2 mt-2 rounded-full bg-gray-100 relative overflow-hidden">
                        <div className="absolute h-full" style={{ width: `${g.user_score}%`, background: BRAND.amber }}/>
                        <div className="absolute h-full w-[2px]" style={{ left: `${g.expected_anchor}%`, background: BRAND.primary }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Layer-cohort benchmark */}
        {layerBench && (
          <div className="lg:col-span-2 rounded-xl border p-5" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
            <SectionHeader icon={<LayersIcon size={14}/>} title={`Layer Cohort — ${layerBench.cohort.name}`}
              right={<span className="text-[11px] text-gray-500">n={layerBench.cohort.n} · tier {layerBench.cohort.tier} · {layerBench.cohort.k_anonymous ? 'k-anon ✓' : 'k-anon ✗'}</span>}/>
            <div className="space-y-1.5 text-[12px]">
              {layerBench.competencies.slice(0, 12).map(c => (
                <div key={c.competency_id} className="flex items-center gap-3">
                  <div className="w-44 truncate" style={{ color: BRAND.primary }}>{c.canonical_name}</div>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full" style={{ width: c.percentile == null ? '0%' : `${c.percentile}%`,
                      background: c.percentile == null ? BRAND.border : c.percentile >= 75 ? BRAND.green : c.percentile >= 25 ? BRAND.blue : BRAND.amber }}/>
                  </div>
                  <div className="w-24 text-right tabular-nums text-gray-700">
                    {c.percentile == null ? 'suppressed' : `${c.percentile}% · ${c.band}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence tier summary */}
        {confidence && (
          <div className="rounded-xl border p-5" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
            <SectionHeader icon={<Shield size={14}/>} title="Tier Distribution (all cohorts)"/>
            <div className="flex flex-wrap gap-2 mb-3">
              {(['A','B','C','D','provisional'] as const).map(t => (
                <div key={t} className="rounded border px-2 py-1 text-[11px]" style={{ borderColor: BRAND.border, background: BRAND.bg }}>
                  <Pill tone={tierTone(t)}>{t}</Pill>
                  <span className="ml-1 tabular-nums">{confidence.tier_summary[t] ?? 0}</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-gray-600">
              Confidence tier cutoffs: A=n≥1000 · B≥300 · C≥100 · D≥30 · provisional&lt;30 (k-anonymity floor).
            </div>
          </div>
        )}

        {/* Weighting modifiers applied */}
        <div className="lg:col-span-3 rounded-xl border p-5" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
          <SectionHeader icon={<LayersIcon size={14}/>} title="Dynamic Weighting Explainability"/>
          {role && (
            <div className="text-[12px]">
              <div className="text-gray-600 mb-2">
                {role.weighting.modifiers.length} contextual modifiers applied to base Role-DNA weights
                — weighting version {role.weighting.version}.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-[10px] uppercase tracking-wider text-gray-500">
                    <tr className="border-b" style={{ borderColor: BRAND.border }}>
                      <th className="text-left py-2">Competency</th>
                      <th className="text-left py-2">Factor</th>
                      <th className="text-left py-2">Rule</th>
                      <th className="text-right py-2">Multiplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {role.weighting.modifiers.slice(0, 20).map((m, i) => (
                      <tr key={i} className="border-b" style={{ borderColor: BRAND.border }}>
                        <td className="py-2">{m.competency}</td>
                        <td className="py-2 text-gray-600">{m.factor}</td>
                        <td className="py-2 text-gray-600">{m.reason}</td>
                        <td className="py-2 text-right tabular-nums">×{m.multiplier.toFixed(2)}</td>
                      </tr>
                    ))}
                    {role.weighting.modifiers.length === 0 && (
                      <tr><td colSpan={4} className="py-3 text-gray-500">No modifiers applied for current context.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: BRAND.border }}>
      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND.primary }}>
        {icon} {title}
      </div>
      {right}
    </div>
  );
}
function Selector({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string)=>void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-gray-500">{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="px-2 py-1 rounded border bg-white text-[12px]"
        style={{ borderColor: BRAND.border }}>{children}</select>
    </label>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: BRAND.border, background: BRAND.bg }}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-lg font-bold tabular-nums" style={{ color: BRAND.primary }}>{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-800">{v}</span>
    </div>
  );
}
function Bar({ k, v }: { k: string; v: number }) {
  const pct = Math.max(0, Math.min(1, v));
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-gray-500">{k}</span>
        <span className="tabular-nums font-semibold" style={{ color: BRAND.primary }}>{(pct * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
        <div className="h-full" style={{ width: `${pct * 100}%`,
          background: pct >= 0.8 ? BRAND.green : pct >= 0.6 ? BRAND.amber : BRAND.red }}/>
      </div>
    </div>
  );
}
function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
      style={{ background: tone + '22', color: tone, border: `1px solid ${tone}55` }}>
      {children}
    </span>
  );
}
function fitTone(b: string)  { return b === 'high' ? BRAND.green : b === 'moderate' ? BRAND.blue : b === 'developing' ? BRAND.amber : BRAND.red; }
function tierTone(t: string) { return t === 'A' ? BRAND.green : t === 'B' ? BRAND.blue : t === 'C' ? BRAND.amber : t === 'D' ? '#9333EA' : BRAND.red; }
function bandTone(b: string) { return b === 'top' ? BRAND.green : b === 'upper' ? BRAND.blue : b === 'mid' ? BRAND.amber : BRAND.red; }

/**
 * Lightweight SVG radar chart (no chart library dependency).
 */
function CompetencyRadar({ comps, onSelect, selected }: {
  comps: CompPct[]; onSelect: (id: string) => void; selected: string;
}) {
  const N = comps.length;
  if (N < 3) return (
    <div className="space-y-1 text-[12px]">
      {comps.map(c => (
        <button key={c.competency_id} onClick={() => onSelect(c.competency_id)}
          className={`w-full text-left px-2 py-1 rounded ${selected === c.competency_id ? 'bg-orange-50' : ''}`}>
          <div className="flex justify-between"><span>{c.canonical_name}</span><span className="tabular-nums">{c.percentile}%</span></div>
        </button>
      ))}
    </div>
  );

  const size = 320, cx = size / 2, cy = size / 2, R = size / 2 - 40;
  const angle = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const pt = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;

  const userPath = comps.map((c, i) => pt(i, R * (c.percentile / 100))).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';
  const targetPath = comps.map((_, i) => pt(i, R * 0.5)).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
        {[0.25, 0.5, 0.75, 1].map(r => (
          <polygon key={r}
            points={comps.map((_, i) => pt(i, R * r).join(',')).join(' ')}
            fill="none" stroke={BRAND.border} strokeWidth={1}/>
        ))}
        <path d={targetPath} fill={BRAND.amber + '22'} stroke={BRAND.amber} strokeDasharray="4 3"/>
        <path d={userPath}   fill={BRAND.blue + '33'}  stroke={BRAND.blue}  strokeWidth={1.5}/>
        {comps.map((c, i) => {
          const [x, y] = pt(i, R * (c.percentile / 100));
          return <circle key={c.competency_id} cx={x} cy={y} r={selected === c.competency_id ? 5 : 3}
            fill={selected === c.competency_id ? BRAND.accent : BRAND.blue}
            onClick={() => onSelect(c.competency_id)} style={{ cursor: 'pointer' }}/>;
        })}
        {comps.map((c, i) => {
          const [x, y] = pt(i, R + 18);
          return <text key={c.competency_id} x={x} y={y} fontSize="9" textAnchor="middle"
            fill={BRAND.primary} style={{ cursor: 'pointer' }}
            onClick={() => onSelect(c.competency_id)}>
            {c.canonical_name.length > 14 ? c.canonical_name.slice(0, 12) + '…' : c.canonical_name}
          </text>;
        })}
      </svg>
      <div className="space-y-1 text-[12px]">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
          Empirical percentile by competency (cohort)
        </div>
        {comps.map(c => (
          <button key={c.competency_id} onClick={() => onSelect(c.competency_id)}
            className={`w-full text-left px-2 py-1.5 rounded border ${selected === c.competency_id ? 'border-orange-300 bg-orange-50' : 'border-transparent hover:bg-gray-50'}`}>
            <div className="flex justify-between items-center">
              <span style={{ color: BRAND.primary }}>{c.canonical_name}</span>
              <span className="tabular-nums text-[11px]" style={{ color: BRAND.primary }}>
                {c.percentile}% · w{(c.weight * 100).toFixed(0)}%
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PercentileDistribution({ aggregates, userScore, ci }: {
  aggregates: { mean: number; median: number; stddev: number;
                p10: number; p25: number; p50: number; p75: number; p90: number; p95: number };
  userScore: number;
  ci: [number, number] | null;
}) {
  const W = 600, H = 90;
  const xScale = (v: number) => (v / 100) * W;

  // Build a stylised distribution shape from the percentile anchors
  const anchors: Array<[number, number]> = [
    [0, 0],
    [10, aggregates.p10], [25, aggregates.p25], [50, aggregates.p50],
    [75, aggregates.p75], [90, aggregates.p90], [95, aggregates.p95],
    [100, 100],
  ];
  // density ∝ d(percentile)/d(score) — invert anchors
  const points: Array<[number, number]> = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [p1, s1] = anchors[i]; const [p2, s2] = anchors[i + 1];
    if (s2 === s1) continue;
    const density = (p2 - p1) / (s2 - s1);
    points.push([(s1 + s2) / 2, density]);
  }
  const maxD = Math.max(...points.map(p => p[1]), 0.001);
  const pathD = points.map(([x, d], i) =>
    `${i === 0 ? 'M' : 'L'}${xScale(x)},${H - (d / maxD) * (H - 14)}`).join(' ') +
    ` L${W},${H} L0,${H} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full">
        <path d={pathD} fill={BRAND.blue + '22'} stroke={BRAND.blue} strokeWidth={1.2}/>
        {/* median + percentile markers */}
        <line x1={xScale(aggregates.p25)} x2={xScale(aggregates.p25)} y1={0} y2={H} stroke={BRAND.border} strokeDasharray="3 3"/>
        <line x1={xScale(aggregates.p50)} x2={xScale(aggregates.p50)} y1={0} y2={H} stroke={BRAND.amber} strokeDasharray="4 3"/>
        <line x1={xScale(aggregates.p75)} x2={xScale(aggregates.p75)} y1={0} y2={H} stroke={BRAND.border} strokeDasharray="3 3"/>
        {/* user marker */}
        <line x1={xScale(userScore)} x2={xScale(userScore)} y1={0} y2={H} stroke={BRAND.accent} strokeWidth={2}/>
        <circle cx={xScale(userScore)} cy={10} r={5} fill={BRAND.accent}/>
        {/* x labels */}
        {[0, 25, 50, 75, 100].map(t => (
          <text key={t} x={xScale(t)} y={H + 16} fontSize="9" textAnchor="middle" fill="#64748B">{t}</text>
        ))}
      </svg>
      <div className="text-[11px] text-gray-600 mt-1 flex flex-wrap gap-3">
        <span style={{ color: BRAND.amber }}>● median {Math.round(aggregates.median)}</span>
        <span>p25 {Math.round(aggregates.p25)} · p75 {Math.round(aggregates.p75)}</span>
        <span style={{ color: BRAND.accent }}>● you {userScore}</span>
        {ci && <span>95% CI: [{ci[0]}, {ci[1]}]</span>}
      </div>
    </div>
  );
}
