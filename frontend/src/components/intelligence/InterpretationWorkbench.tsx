import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Play, Ruler, Sigma, GitCompare, Brain, FileText, TrendingUp } from 'lucide-react';
import { BRAND } from '@/design-system/tokens';

const BASE = '/api/admin/assessment-intelligence';

type TabKey = 'standard' | 'norm' | 'benchmark' | 'interpretation' | 'report' | 'performance';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  endpoint: string;
  hint: string;
  sample: string;
  build: (parsed: any) => Record<string, unknown>;
}

const TABS: TabDef[] = [
  {
    key: 'standard',
    label: 'Standard scores',
    icon: <Ruler className="h-3.5 w-3.5" />,
    endpoint: '/compute/standard-scores',
    hint: 'PURE standardization — transform a raw value into percentile / z / T (μ=50,σ=10) / stanine / sten / deviation (μ=100,σ=15) against a reference distribution (mean, sd). If the distribution is undefined (sd null/≤0) every standard score is null — NEVER fabricated.',
    sample: JSON.stringify({ value: 72, mean: 60, sd: 12 }, null, 2),
    build: (p) => ({ value: p?.value, mean: p?.mean, sd: p?.sd }),
  },
  {
    key: 'norm',
    label: 'Norm reference',
    icon: <Sigma className="h-3.5 w-3.5" />,
    endpoint: '/compute/norm-reference',
    hint: 'PURE norm-referencing — interpret a raw value against a norm reference group (cohort / role / stage / self). ABSTAINS below k_min real members in the reference group (k_min lowered here only to demo).',
    sample: JSON.stringify({ value: 72, reference: { norm_type: 'cohort_norm', label: 'Peer cohort', mean: 60, sd: 12, n: 40 }, options: { k_min: 5 } }, null, 2),
    build: (p) => ({ value: p?.value, reference: p?.reference ?? {}, options: p?.options ?? {} }),
  },
  {
    key: 'benchmark',
    label: 'Benchmark',
    icon: <GitCompare className="h-3.5 w-3.5" />,
    endpoint: '/compute/benchmark',
    hint: 'PURE benchmarking — compare a value against one or more reference groups (peer / role / stage / temporal). Each group ABSTAINS below k_min real members; relative is above/at/below the group mean (k_min lowered here only to demo).',
    sample: JSON.stringify({
      value: 72,
      groups: [
        { scope: 'peer_cohort', label: 'Peers', mean: 60, sd: 12, n: 40 },
        { scope: 'role', label: 'Role', mean: 68, sd: 10, n: 8 },
      ],
      options: { k_min: 5 },
    }, null, 2),
    build: (p) => ({ value: p?.value, groups: p?.groups ?? [], options: p?.options ?? {} }),
  },
  {
    key: 'interpretation',
    label: 'AI narrative',
    icon: <Brain className="h-3.5 w-3.5" />,
    endpoint: '/compute/interpretation',
    hint: 'PURE interpretation — deterministically compose a narrative (strengths / development areas / reasoning chain / recommendations) from per-dimension scores. The deterministic seam the AI narrative engine enriches when adopted; confidence stays null while cold-start — never fabricated.',
    sample: JSON.stringify({
      input: {
        ref: 'candidate-demo',
        dimensions: [
          { key: 'communication', label: 'Communication', score: 82, max: 100 },
          { key: 'problem_solving', label: 'Problem solving', score: 45, max: 100 },
          { key: 'collaboration', label: 'Collaboration', score: 70, max: 100 },
        ],
      },
    }, null, 2),
    build: (p) => ({ input: p?.input ?? p }),
  },
  {
    key: 'report',
    label: 'Report',
    icon: <FileText className="h-3.5 w-3.5" />,
    endpoint: '/compute/report',
    hint: 'PURE report composition — assemble the 8 canonical interpretation-report sections (overview → score summary → norm → benchmark → narrative → strengths/development → recommendations → next steps) from the provided artefacts. A section is present:false when its artefact is absent — never a fabricated placeholder.',
    sample: JSON.stringify({
      input: {
        ref: 'candidate-demo',
        overview: 'Overview of the candidate profile.',
        score_summary: { overall: 72 },
        norm: { percentile: 84 },
        benchmark: { peer_cohort: 'above' },
        narrative: 'Deterministic narrative goes here.',
        strengths_development: { strengths: ['Communication'], development: ['Problem solving'] },
        recommendations: ['Prioritize problem-solving practice.'],
      },
    }, null, 2),
    build: (p) => ({ input: p?.input ?? p }),
  },
  {
    key: 'performance',
    label: 'Performance',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    endpoint: '/compute/performance',
    hint: 'PURE candidate-performance analytics — overall standing / percentile (ABSTAINS below k_min) / peer-relative / readiness band / growth trajectory / dimension profile. Percentile + peer-relative ABSTAIN on a thin reference; growth is null with < 2 history points (k_min lowered here only to demo).',
    sample: JSON.stringify({
      input: {
        ref: 'candidate-demo',
        score: 72,
        reference: { mean: 60, sd: 12, n: 40 },
        history: [58, 64, 72],
        dimensions: [
          { key: 'communication', label: 'Communication', score: 82, max: 100 },
          { key: 'problem_solving', label: 'Problem solving', score: 45, max: 100 },
        ],
      },
      options: { k_min: 5 },
    }, null, 2),
    build: (p) => ({ input: p?.input ?? p, options: p?.options ?? {} }),
  },
];

function StandardResult({ result }: { result: any }) {
  if (result?.abstained) return <div className="text-xs italic text-amber-600">Abstained — {result.reason}</div>;
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <Badge variant="outline">z: {result.z ?? '—'}</Badge>
      <Badge variant="outline">percentile: {result.percentile ?? '—'}</Badge>
      <Badge variant="outline">T: {result.t_score ?? '—'}</Badge>
      <Badge variant="outline">stanine: {result.stanine ?? '—'}</Badge>
      <Badge variant="outline">sten: {result.sten ?? '—'}</Badge>
      <Badge variant="outline">deviation: {result.deviation_score ?? '—'}</Badge>
      {result.band && <Badge variant="outline">band: {result.band}</Badge>}
    </div>
  );
}

function NormResult({ result }: { result: any }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">type: {result.norm_type}</Badge>
        {result.reference_label && <Badge variant="outline">{result.reference_label}</Badge>}
        <Badge variant="outline">n: {String(result.n_members)}</Badge>
      </div>
      {result.abstained
        ? <div className="italic text-amber-600">Abstained — {result.reason}</div>
        : (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">z: {result.z ?? '—'}</Badge>
            <Badge variant="outline">percentile: {result.percentile ?? '—'}</Badge>
            {result.band && <Badge variant="outline">band: {result.band}</Badge>}
          </div>
        )}
    </div>
  );
}

function BenchmarkResult({ result }: { result: any }) {
  const groups: any[] = result?.groups ?? [];
  if (!groups.length) return <div className="text-xs text-muted-foreground">No groups.</div>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 pr-3">Scope</th><th className="py-1 pr-3">n</th>
          <th className="py-1 pr-3">Percentile</th><th className="py-1 pr-3">Relative</th><th className="py-1 pr-3">Band</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g: any) => (
          <tr key={g.scope} className="border-t align-top">
            <td className="py-1 pr-3 font-medium">{g.label ?? g.scope}</td>
            <td className="py-1 pr-3 tabular-nums">{g.n_members}</td>
            <td className="py-1 pr-3 tabular-nums">{g.abstained ? <span className="italic text-amber-600">abstained</span> : g.percentile}</td>
            <td className="py-1 pr-3">{g.relative ?? '—'}</td>
            <td className="py-1 pr-3">{g.band ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InterpretationResult({ result }: { result: any }) {
  if (result?.abstained) return <div className="text-xs italic text-amber-600">Abstained — {result.reason}</div>;
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">dimensions: {String(result.dimension_count)}</Badge>
        <Badge variant="outline">confidence: {result.confidence ?? 'null (cold-start)'}</Badge>
        <Badge variant="outline">source: {result.source}</Badge>
      </div>
      <p className="text-slate-700">{result.narrative}</p>
      {(result.strengths ?? []).length > 0 && <div><span className="font-medium text-emerald-700">Strengths:</span> {result.strengths.map((d: any) => `${d.label} (${d.pct}%)`).join(', ')}</div>}
      {(result.development_areas ?? []).length > 0 && <div><span className="font-medium text-amber-700">Development:</span> {result.development_areas.map((d: any) => `${d.label} (${d.pct}%)`).join(', ')}</div>}
      {(result.recommendations ?? []).length > 0 && (
        <ul className="list-disc pl-4 text-muted-foreground">
          {result.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
        </ul>
      )}
    </div>
  );
}

function ReportResult({ result }: { result: any }) {
  const sections: any[] = result?.sections ?? [];
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">sections: {String(result.section_count)}</Badge>
        <Badge variant="outline">present: {String(result.present_count)}</Badge>
      </div>
      <ul className="space-y-0.5">
        {sections.map((s: any) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className={s.present ? 'text-emerald-700' : 'text-slate-400'}>{s.present ? '●' : '○'}</span>
            <span className="font-medium">{s.label}</span>
            {!s.present && <span className="text-[10px] text-muted-foreground">— absent (not fabricated)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PerformanceResult({ result }: { result: any }) {
  const dims: any[] = result?.dimension_profile ?? [];
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">score: {result.overall_score ?? '—'}</Badge>
        <Badge variant="outline">standing: {result.overall_standing ?? '—'}</Badge>
        <Badge variant="outline">percentile: {result.percentile_abstained ? <span className="italic text-amber-600">abstained</span> : (result.percentile ?? '—')}</Badge>
        <Badge variant="outline">peer: {result.peer_relative ?? '—'}</Badge>
        <Badge variant="outline">readiness: {result.readiness_band ?? '—'}</Badge>
        <Badge variant="outline">growth: {result.growth_trajectory ?? '—'}</Badge>
      </div>
      {dims.length > 0 && (
        <table className="w-full">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-3">Dimension</th><th className="py-1 pr-3">%</th></tr></thead>
          <tbody>
            {dims.map((d: any) => (
              <tr key={d.key} className="border-t"><td className="py-1 pr-3 font-medium">{d.label}</td><td className="py-1 pr-3 tabular-nums">{d.pct ?? '—'}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ResultView({ tab, result }: { tab: TabKey; result: any }) {
  if (!result) return null;
  const r = result.result ?? result;
  if (tab === 'standard') return <StandardResult result={r} />;
  if (tab === 'norm') return <NormResult result={r} />;
  if (tab === 'benchmark') return <BenchmarkResult result={r} />;
  if (tab === 'interpretation') return <InterpretationResult result={r} />;
  if (tab === 'report') return <ReportResult result={r} />;
  return <PerformanceResult result={r} />;
}

export default function InterpretationWorkbench() {
  const [tab, setTab] = React.useState<TabKey>('standard');
  const active = TABS.find((t) => t.key === tab)!;
  const [input, setInput] = React.useState<string>(active.sample);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setInput(active.sample);
    setResult(null);
    setError(null);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let parsed: any;
      try { parsed = JSON.parse(input); } catch { setError('Input is not valid JSON.'); setBusy(false); return; }
      const body = active.build(parsed);
      const res = await fetch(`${BASE}${active.endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError(`Request failed: ${res.status}`); setBusy(false); return; }
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={t.key === tab ? 'default' : 'outline'}
            onClick={() => setTab(t.key)}
            className="h-7 gap-1 text-xs"
          >
            {t.icon}{t.label}
          </Button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{active.hint}</p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        className="h-56 w-full rounded-lg border bg-white p-3 font-mono text-[11px] leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={run} disabled={busy} style={{ backgroundColor: BRAND.primary }}>
          <Play className={`mr-1 h-3 w-3 ${busy ? 'animate-pulse' : ''}`} /> Run
        </Button>
        <span className="text-[10px] text-muted-foreground">Read-only compute — persists nothing unless a write mechanism is called explicitly (persist=true).</span>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {result && (
        <div className="rounded-lg border bg-slate-50/50 p-3">
          <ResultView tab={tab} result={result} />
        </div>
      )}
    </div>
  );
}
