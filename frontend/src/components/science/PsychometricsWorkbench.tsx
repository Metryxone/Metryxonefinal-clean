import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Play, CheckCircle2, XCircle, Sigma, ListChecks, Ruler, ShieldCheck, LayoutGrid } from 'lucide-react';
import { BRAND } from '@/design-system/tokens';

const BASE = '/api/admin/assessment-science';

type TabKey = 'item' | 'reliability' | 'validity' | 'quality' | 'blueprint';

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
    key: 'item',
    label: 'Item analysis',
    icon: <Ruler className="h-3.5 w-3.5" />,
    endpoint: '/compute/item-analysis',
    hint: 'PURE per-item difficulty (p-value), corrected item-total discrimination, distractor analysis, facility, composite quality score & retirement recommendation. ABSTAINS below k_min real responses — a value is NEVER fabricated on thin data (k_min lowered here only to demo on sample content).',
    sample: JSON.stringify(
      {
        options: { k_min: 4 },
        items: [
          { ref: 'q1', responses: [1, 1, 0, 1, 1, 0, 1, 1], max: 1 },
          { ref: 'q2', responses: [1, 0, 0, 0, 1, 0, 0, 0], max: 1 },
          { ref: 'q3', responses: [1, 1, 1, 1, 1, 1, 1, 1], max: 1 },
        ],
      },
      null,
      2,
    ),
    build: (p) => ({ items: p?.items ?? [], options: p?.options ?? {} }),
  },
  {
    key: 'reliability',
    label: 'Reliability',
    icon: <Sigma className="h-3.5 w-3.5" />,
    endpoint: '/compute/reliability',
    hint: 'Internal consistency (Cronbach α), split-half (Spearman-Brown), optional test-retest / inter-rater, SEM and a 95% score CI over a respondents × items matrix. ABSTAINS below k_min respondents (k_min lowered here only to demo).',
    sample: JSON.stringify(
      {
        options: { k_min: 5 },
        matrix: [
          [1, 1, 0, 1, 1],
          [1, 0, 0, 1, 1],
          [0, 0, 1, 0, 1],
          [1, 1, 1, 1, 1],
          [0, 1, 0, 1, 0],
          [1, 1, 0, 1, 1],
        ],
      },
      null,
      2,
    ),
    build: (p) => ({ matrix: p?.matrix ?? [], options: p?.options ?? {} }),
  },
  {
    key: 'validity',
    label: 'Validity',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    endpoint: '/compute/validity',
    hint: 'Content (blueprint coverage passthrough), construct, criterion, convergent, discriminant & factor-loading evidence. Each type ABSTAINS per-type below k_min aligned pairs (k_min lowered here only to demo).',
    sample: JSON.stringify(
      {
        input: {
          k_min: 5,
          contentCoverage: 0.86,
          scores: [72, 65, 80, 55, 90, 61, 77, 48],
          criterion: [70, 60, 82, 58, 88, 63, 75, 50],
          convergent: [68, 66, 79, 57, 85, 60, 74, 52],
          discriminant: [40, 55, 30, 62, 25, 58, 44, 60],
        },
      },
      null,
      2,
    ),
    build: (p) => ({ input: p?.input ?? p }),
  },
  {
    key: 'quality',
    label: 'Question quality',
    icon: <ListChecks className="h-3.5 w-3.5" />,
    endpoint: '/validate/question-quality',
    hint: 'Deterministic question-quality checks (stem clarity, option balance, no clueing / negatives, single answer, distractor plausibility, reading level). Runs no scoring — a pure authoring gate.',
    sample: JSON.stringify(
      {
        question: {
          ref: 'q-demo',
          text: 'Which of the following is NOT a benefit of active listening in a team setting?',
          options: ['Builds trust', 'Reduces misunderstanding', 'Improves morale', 'All of the above'],
          correct: 3,
          type: 'mcq',
        },
      },
      null,
      2,
    ),
    build: (p) => ({ question: p?.question ?? p }),
  },
  {
    key: 'blueprint',
    label: 'Blueprint',
    icon: <LayoutGrid className="h-3.5 w-3.5" />,
    endpoint: '/validate/blueprint',
    hint: 'Blueprint (test specification) validation — coverage against declared competencies/domains, distribution balance and gaps. A clean pre-publish gate on the instrument design.',
    sample: JSON.stringify(
      {
        input: {
          domains: [
            { key: 'communication', target: 0.4, items: 8 },
            { key: 'problem_solving', target: 0.4, items: 7 },
            { key: 'collaboration', target: 0.2, items: 1 },
          ],
        },
      },
      null,
      2,
    ),
    build: (p) => ({ input: p?.input ?? p }),
  },
];

function ItemResult({ result }: { result: any }) {
  const items: any[] = result?.items ?? [];
  if (!items.length) return <div className="text-xs text-muted-foreground">No items.</div>;
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">k_min: {String(result.k_min)}</Badge>
        <Badge variant="outline">items: {String(result.item_count)}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3">Item</th><th className="py-1 pr-3">n</th>
              <th className="py-1 pr-3">Difficulty</th><th className="py-1 pr-3">Discrim.</th>
              <th className="py-1 pr-3">Quality</th><th className="py-1 pr-3">Retire?</th><th className="py-1 pr-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.ref} className="border-t align-top">
                <td className="py-1 pr-3 font-medium">{it.ref}</td>
                <td className="py-1 pr-3 tabular-nums">{it.n_responses}</td>
                <td className="py-1 pr-3 tabular-nums">{it.abstained ? <span className="italic text-amber-600">abstained</span> : `${it.difficulty} (${it.difficulty_band})`}</td>
                <td className="py-1 pr-3 tabular-nums">{it.abstained ? '—' : `${it.discrimination} (${it.discrimination_band})`}</td>
                <td className="py-1 pr-3 tabular-nums">{it.quality_score ?? '—'}</td>
                <td className="py-1 pr-3">{it.retire_recommended ? <span className="text-red-600">yes</span> : 'no'}</td>
                <td className="py-1 pr-3 text-[10px] text-muted-foreground">{(it.flags ?? []).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReliabilityResult({ result }: { result: any }) {
  if (result?.abstained) return <div className="text-xs italic text-amber-600">Abstained — {result.reason}</div>;
  const methods: any[] = result?.methods ?? [];
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">respondents: {String(result.n_respondents)}</Badge>
        <Badge variant="outline">items: {String(result.k_items)}</Badge>
        <Badge variant="outline">SEM: {result.sem === null ? '—' : String(result.sem)}</Badge>
        {result.ci && <Badge variant="outline">95% CI: {result.ci.low}–{result.ci.high} @ {result.ci.at}</Badge>}
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 pr-3">Method</th><th className="py-1 pr-3">Coefficient</th><th className="py-1 pr-3">Tier</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((m: any) => (
            <tr key={m.method} className="border-t">
              <td className="py-1 pr-3 font-medium">{m.method}</td>
              <td className="py-1 pr-3 tabular-nums">{m.coefficient === null ? '—' : m.coefficient}</td>
              <td className="py-1 pr-3">{m.tier ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValidityResult({ result }: { result: any }) {
  const evidence: any[] = result?.evidence ?? [];
  if (!evidence.length) return <div className="text-xs text-muted-foreground">No evidence.</div>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 pr-3">Type</th><th className="py-1 pr-3">Coefficient</th>
          <th className="py-1 pr-3">n</th><th className="py-1 pr-3">Note</th>
        </tr>
      </thead>
      <tbody>
        {evidence.map((e: any) => (
          <tr key={e.validity_type} className="border-t align-top">
            <td className="py-1 pr-3 font-medium">{e.validity_type}</td>
            <td className="py-1 pr-3 tabular-nums">{e.abstained ? <span className="italic text-amber-600">abstained</span> : e.coefficient}</td>
            <td className="py-1 pr-3 tabular-nums">{e.n}</td>
            <td className="py-1 pr-3 text-[10px] text-muted-foreground">{e.note ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ValidationResult({ result }: { result: any }) {
  const valid = result?.valid === true;
  const checks: any[] = result?.checks ?? [];
  const gaps: any[] = result?.gaps ?? [];
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        {valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
        <span className={valid ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{valid ? 'VALID' : 'ISSUES FOUND'}</span>
        {typeof result?.coverage === 'number' && <Badge variant="outline">coverage: {(result.coverage * 100).toFixed(0)}%</Badge>}
        {typeof result?.quality_score === 'number' && <Badge variant="outline">quality: {result.quality_score}</Badge>}
      </div>
      {checks.length > 0 && (
        <ul className="space-y-0.5">
          {checks.map((c: any, i: number) => (
            <li key={i} className="flex items-center gap-2">
              {c.passed ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <XCircle className="h-3 w-3 text-red-600" />}
              <span className="font-medium">{c.check_type}</span>
              {c.severity && <span className="text-[10px] text-muted-foreground">[{c.severity}]</span>}
              {c.detail && <span className="text-[10px] text-muted-foreground">— {String(c.detail)}</span>}
            </li>
          ))}
        </ul>
      )}
      {gaps.length > 0 && <div className="text-red-600">gaps: {gaps.map((g: any) => (typeof g === 'string' ? g : g.key ?? JSON.stringify(g))).join(', ')}</div>}
    </div>
  );
}

function ResultView({ tab, result }: { tab: TabKey; result: any }) {
  if (!result) return null;
  const r = result.result ?? result;
  if (tab === 'item') return <ItemResult result={r} />;
  if (tab === 'reliability') return <ReliabilityResult result={r} />;
  if (tab === 'validity') return <ValidityResult result={r} />;
  return <ValidationResult result={r} />;
}

export default function PsychometricsWorkbench() {
  const [tab, setTab] = React.useState<TabKey>('item');
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
