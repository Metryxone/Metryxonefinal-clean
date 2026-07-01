import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Play, CheckCircle2, XCircle, Calculator, Sigma, ListChecks, Sliders, FileCheck } from 'lucide-react';
import { BRAND } from '@/design-system/tokens';

const BASE = '/api/admin/assessment-scoring';

type TabKey = 'score' | 'formula' | 'rule' | 'config' | 'responses';

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
    key: 'score',
    label: 'Score',
    icon: <Calculator className="h-3.5 w-3.5" />,
    endpoint: '/compute/score',
    hint: 'PURE deterministic score computation across the 13 canonical scoring models — no eval, no DB write (persist only when you pass persist=true).',
    sample: JSON.stringify(
      {
        options: { model: 'percentage', missing_policy: 'skip' },
        items: [
          { ref: 'q1', value: 4, max: 5, weight: 1, group: 'communication' },
          { ref: 'q2', value: 3, max: 5, weight: 2, group: 'communication' },
          { ref: 'q3', value: 5, max: 5, weight: 1, group: 'problem_solving' },
          { ref: 'q4', value: null, max: 5, mandatory: true, group: 'problem_solving' },
        ],
      },
      null,
      2,
    ),
    build: (p) => ({ items: p?.items ?? [], options: p?.options ?? {} }),
  },
  {
    key: 'formula',
    label: 'Formula',
    icon: <Sigma className="h-3.5 w-3.5" />,
    endpoint: '/validate/formula',
    hint: 'A formula is a STRUCTURED object (kind + terms), NEVER a code string — this guarantees there is no eval / new Function surface.',
    sample: JSON.stringify(
      {
        formula: {
          kind: 'weighted_sum',
          op: 'weighted_sum',
          terms: [
            { var: 'communication', weight: 0.6 },
            { var: 'problem_solving', weight: 0.4 },
          ],
        },
      },
      null,
      2,
    ),
    build: (p) => ({ formula: p?.formula ?? p }),
  },
  {
    key: 'rule',
    label: 'Rule',
    icon: <ListChecks className="h-3.5 w-3.5" />,
    endpoint: '/validate/rule',
    hint: 'Scoring rules — positive/negative weighting, partial credit, bonus/penalty (negative marking), mandatory, section & assessment rules.',
    sample: JSON.stringify(
      { rule: { rule_type: 'penalty_marks', scope: 'question', definition: { value: 0.25 } } },
      null,
      2,
    ),
    build: (p) => ({ rule: p?.rule ?? p }),
  },
  {
    key: 'config',
    label: 'Configuration',
    icon: <Sliders className="h-3.5 w-3.5" />,
    endpoint: '/validate/config',
    hint: 'A scoring configuration binds a scoring model + versioned formula + thresholds. Version must be a positive integer.',
    sample: JSON.stringify(
      {
        config: {
          scoring_model: 'weighted_score',
          version: 1,
          formula: { kind: 'weighted_sum', terms: [{ var: 'communication', weight: 1 }] },
          thresholds: [{ band: 'proficient', min: 70 }],
        },
      },
      null,
      2,
    ),
    build: (p) => ({ config: p?.config ?? p }),
  },
  {
    key: 'responses',
    label: 'Responses',
    icon: <FileCheck className="h-3.5 w-3.5" />,
    endpoint: '/validate/responses',
    hint: 'Response validation (type / range / option + missing / mandatory) BEFORE scoring. Runs no scoring — a clean pre-score gate.',
    sample: JSON.stringify(
      {
        items: [
          { ref: 'q1', value: 4, max: 5 },
          { ref: 'q2', value: 'text answer' },
          { ref: 'q3', value: null, mandatory: true },
        ],
      },
      null,
      2,
    ),
    build: (p) => ({ items: p?.items ?? p?.responses ?? p }),
  },
];

function ResultView({ tab, result }: { tab: TabKey; result: any }) {
  if (!result) return null;
  const r = result.result ?? result;
  if (tab === 'score') {
    return (
      <div className="space-y-2 text-xs">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">model: {String(r.model)}</Badge>
          <Badge variant="outline">raw: {String(r.raw)}</Badge>
          <Badge variant="outline">value: {typeof r.value === 'number' ? r.value.toFixed(2) : String(r.value)}</Badge>
          <Badge variant="outline">max: {String(r.maximum)}</Badge>
          <Badge variant="outline">%: {r.percentage === null || r.percentage === undefined ? '—' : Number(r.percentage).toFixed(1)}</Badge>
          <Badge variant="outline">answered: {String(r.answered)}</Badge>
          <Badge variant="outline">missing: {String(r.missing)}</Badge>
        </div>
        {Array.isArray(r.mandatory_missing) && r.mandatory_missing.length > 0 && (
          <div className="text-red-600">mandatory unanswered: {r.mandatory_missing.join(', ')}</div>
        )}
        {Array.isArray(r.groups) && r.groups.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3">Group</th><th className="py-1 pr-3">Raw</th>
                <th className="py-1 pr-3">Value</th><th className="py-1 pr-3">Max</th><th className="py-1 pr-3">Answered</th>
              </tr>
            </thead>
            <tbody>
              {r.groups.map((g: any) => (
                <tr key={g.group} className="border-t">
                  <td className="py-1 pr-3 font-medium">{g.group}</td>
                  <td className="py-1 pr-3 tabular-nums">{Number(g.raw).toFixed(2)}</td>
                  <td className="py-1 pr-3 tabular-nums">{Number(g.value).toFixed(2)}</td>
                  <td className="py-1 pr-3 tabular-nums">{Number(g.maximum).toFixed(2)}</td>
                  <td className="py-1 pr-3 tabular-nums">{g.answered}/{g.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }
  // validation-shaped results
  const valid = r.valid === true;
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        {valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
        <span className={valid ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{valid ? 'VALID' : 'INVALID'}</span>
        {typeof r.answered === 'number' && <Badge variant="outline">answered: {r.answered}</Badge>}
        {typeof r.missing === 'number' && <Badge variant="outline">missing: {r.missing}</Badge>}
      </div>
      {Array.isArray(r.errors) && r.errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-red-600">
          {r.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
        </ul>
      )}
      {Array.isArray(r.mandatory_missing) && r.mandatory_missing.length > 0 && (
        <div className="text-red-600">mandatory unanswered: {r.mandatory_missing.join(', ')}</div>
      )}
    </div>
  );
}

export default function ScoringWorkbench() {
  const [tab, setTab] = React.useState<TabKey>('score');
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
        <span className="text-[10px] text-muted-foreground">Read-only compute — persists nothing unless a write mechanism is called explicitly.</span>
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
