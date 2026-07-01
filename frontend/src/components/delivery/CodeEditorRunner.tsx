import React from 'react';
import { BRAND } from '@/design-system/tokens';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

/**
 * CodeEditorRunner — first-class CODING delivery mode (GAP-AD-1).
 *
 * In-browser code editor + JS execution + expected-vs-actual test harness.
 * The candidate authors a single JS function; each test case calls it and the
 * runner compares the actual return against the expected value. Scope boundary:
 * multi-language SERVER execution sandboxes are Phase 3.5+ infrastructure — this
 * delivery-layer runner is JS-only by design (not a gap).
 *
 * onCommit fires with the final source + per-case results so the parent can POST
 * to /api/admin/assessment-delivery/coding/run (evaluateCodingRun) and persist to
 * ad_responses. Never throws — a bad case surfaces as a failing row, not a crash.
 */
export interface CodingTestCase { input: unknown[]; expected: unknown; label?: string }
export interface CodingCaseResult { label: string; passed: boolean; actual: string; expected: string; error?: string }

export interface CodeEditorRunnerProps {
  prompt: string;
  functionName: string;
  starterCode?: string;
  testCases: CodingTestCase[];
  onCommit?: (payload: { source: string; results: CodingCaseResult[]; passed: number; total: number }) => void;
}

function stringify(v: unknown): string {
  try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); }
}

export default function CodeEditorRunner({ prompt, functionName, starterCode, testCases, onCommit }: CodeEditorRunnerProps) {
  const [source, setSource] = React.useState(
    starterCode ?? `function ${functionName}(/* args */) {\n  // your code here\n}`,
  );
  const [results, setResults] = React.useState<CodingCaseResult[] | null>(null);
  const [runError, setRunError] = React.useState<string | null>(null);

  const run = React.useCallback(() => {
    setRunError(null);
    const out: CodingCaseResult[] = [];
    let fn: (...args: unknown[]) => unknown;
    try {
      // eslint-disable-next-line no-new-func
      const factory = new Function(`${source}\nreturn ${functionName};`);
      fn = factory();
      if (typeof fn !== 'function') throw new Error(`${functionName} is not defined as a function`);
    } catch (e: any) {
      setRunError(e?.message ?? 'Failed to compile');
      setResults(null);
      return;
    }
    testCases.forEach((tc, i) => {
      const label = tc.label ?? `Case ${i + 1}`;
      try {
        const actual = fn(...tc.input);
        const passed = stringify(actual) === stringify(tc.expected);
        out.push({ label, passed, actual: stringify(actual), expected: stringify(tc.expected) });
      } catch (e: any) {
        out.push({ label, passed: false, actual: '—', expected: stringify(tc.expected), error: e?.message ?? 'runtime error' });
      }
    });
    setResults(out);
    const passed = out.filter((r) => r.passed).length;
    onCommit?.({ source, results: out, passed, total: out.length });
  }, [source, functionName, testCases, onCommit]);

  const passed = results ? results.filter((r) => r.passed).length : 0;

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>Coding · {functionName}()</span>
        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">JS runner</Badge>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{prompt}</p>
      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        spellCheck={false}
        rows={7}
        className="w-full resize-y rounded-md border bg-slate-950 p-2 font-mono text-[12px] leading-relaxed text-slate-100 outline-none"
        aria-label="Code editor"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={run}>Run tests</Button>
        {results && (
          <span className={`text-xs font-semibold ${passed === results.length ? 'text-emerald-700' : 'text-amber-700'}`}>
            {passed}/{results.length} passed
          </span>
        )}
      </div>
      {runError && <p className="mt-2 text-xs text-red-600">Compile error: {runError}</p>}
      {results && (
        <ul className="mt-2 space-y-1">
          {results.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px]">
              <span className={r.passed ? 'text-emerald-600' : 'text-red-600'}>{r.passed ? '✓' : '✗'}</span>
              <span className="text-slate-700">
                {r.label}: expected <code>{r.expected}</code>, got <code>{r.error ? `error: ${r.error}` : r.actual}</code>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
