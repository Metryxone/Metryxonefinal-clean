import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sigma, GitCompare, TrendingUp, BarChart3, Calculator, Building2, Percent, Layers } from 'lucide-react';
import { BRAND } from '@/design-system/tokens';
import { Button } from '../ui/button';

const BASE = '/api/admin/benchmark-intelligence';

async function post(path: string, body: unknown): Promise<any> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

/** null/undefined/'' → "not measurable" (amber); 0 stays 0. null ≠ 0. */
function Val({ value }: { value: number | string | boolean | null | undefined }) {
  if (value === null || value === undefined || value === '')
    return <span className="text-amber-600 italic text-xs">not measurable</span>;
  return <span className="font-semibold tabular-nums">{String(value)}</span>;
}

function Card({ title, icon, subtitle, children }: { title: string; icon?: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <h4 className="text-xs font-semibold" style={{ color: BRAND.primary }}>{title}</h4>
      </div>
      {subtitle && <p className="mb-2 text-[10px] text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

const inputCls = 'rounded border px-2 py-1 text-xs font-normal normal-case tabular-nums';

function numArray(s: string): number[] {
  return String(s).split(/[,\s]+/).map((x) => Number(x)).filter((x) => Number.isFinite(x));
}

/**
 * BenchmarkIntelligenceWorkbench — interactive, deterministic demos of the PURE benchmark mechanisms that
 * engineering-close the Benchmark Intelligence gaps via reuse-before-build:
 *   • reference-group descriptive stats (mean / sd / quartiles) — sufficient=false below k_min
 *   • benchmark comparison (z / percentile / delta / quartile) — ABSTAINS below k_min (reuses pure z→percentile transforms)
 *   • percentile rank (empirical below/equal)
 *   • multi-group comparison (each independently ABSTAINS below k_min)
 *   • trend over a series (least-squares slope + direction)
 *   • distribution histogram
 *   • composite benchmark index — structured-AST formula (NO eval / new Function; whitelisted interpreter)
 *   • scoped config resolve (most-specific-wins; no match → resolved:false, never fabricated)
 * Persists NOTHING (persist flag omitted) — the write paths are exercised only from the panel/API.
 */
export default function BenchmarkIntelligenceWorkbench() {
  // ── reference-group stats ──
  const [refVals, setRefVals] = React.useState('62, 55, 71, 48, 80, 66, 59, 74');
  const [refK, setRefK] = React.useState('30');
  const refM = useMutation({ mutationFn: () => post('/compute/reference-stats', { values: numArray(refVals), k_min: Number(refK) }) });

  // ── benchmark comparison ──
  const [bcm, setBcm] = React.useState({ value: '78', reference: '62, 55, 71, 48, 80, 66, 59, 74', k: '5' });
  const bcM = useMutation({ mutationFn: () => post('/compute/benchmark', {
    value: Number(bcm.value), reference: numArray(bcm.reference), k_min: Number(bcm.k),
  }) });

  // ── percentile rank ──
  const [prm, setPrm] = React.useState({ value: '70', values: '62, 55, 71, 48, 80, 66, 59, 74' });
  const prM = useMutation({ mutationFn: () => post('/compute/percentile-rank', { value: Number(prm.value), values: numArray(prm.values) }) });

  // ── multi-group comparison ──
  const defaultGroups = JSON.stringify([
    { label: 'Peer cohort', values: [62, 55, 71, 48, 80, 66] },
    { label: 'Organization', stats: { n: 120, mean: 64, sd: 11 } },
  ], null, 2);
  const [gcVal, setGcVal] = React.useState('78');
  const [gcGroups, setGcGroups] = React.useState(defaultGroups);
  const [gcK, setGcK] = React.useState('5');
  const gcM = useMutation({ mutationFn: () => {
    let parsed: unknown;
    try { parsed = JSON.parse(gcGroups); } catch { throw new Error('groups is not valid JSON'); }
    if (!Array.isArray(parsed)) throw new Error('groups must be a JSON array');
    return post('/compute/group-comparison', { value: Number(gcVal), groups: parsed, k_min: Number(gcK) });
  } });

  // ── trend ──
  const [series, setSeries] = React.useState('40, 48, 55, 61, 69');
  const trM = useMutation({ mutationFn: () => post('/compute/trend', { series: numArray(series) }) });

  // ── distribution ──
  const [distVals, setDistVals] = React.useState('62, 55, 71, 48, 80, 66, 59, 74, 90, 33, 41, 58');
  const [distBins, setDistBins] = React.useState('5');
  const distM = useMutation({ mutationFn: () => post('/compute/distribution', { values: numArray(distVals), bins: Number(distBins) }) });

  // ── composite benchmark index (structured AST) ──
  const defaultAst = JSON.stringify(
    { type: 'op', op: '+', args: [{ type: 'var', name: 'percentile' }, { type: 'op', op: '*', args: [{ type: 'var', name: 'delta' }, { type: 'const', value: 0.5 }] }] },
    null, 2,
  );
  const [ast, setAst] = React.useState(defaultAst);
  const [vars, setVars] = React.useState('{ "percentile": 82, "delta": 14 }');
  const [astErr, setAstErr] = React.useState<string | null>(null);
  const fEval = useMutation({ mutationFn: () => {
    let parsedAst: unknown, parsedVars: unknown;
    try { parsedAst = JSON.parse(ast); } catch { throw new Error('AST is not valid JSON'); }
    try { parsedVars = JSON.parse(vars); } catch { throw new Error('vars is not valid JSON'); }
    return post('/compute/formula', { ast: parsedAst, vars: parsedVars });
  } });
  React.useEffect(() => { setAstErr(fEval.error ? String((fEval.error as Error).message) : null); }, [fEval.error]);

  // ── scoped config resolver ──
  const [resolveCtx, setResolveCtx] = React.useState('{ "organization": "acme", "industry": "it" }');
  const resolveM = useMutation({ mutationFn: () => {
    let parsed: unknown;
    try { parsed = JSON.parse(resolveCtx); } catch { throw new Error('context is not valid JSON'); }
    return post('/configs/resolve', { context: parsed });
  } });

  const refR = refM.data?.result;
  const bcR = bcM.data?.result;
  const prR = prM.data?.result;
  const gcR = gcM.data?.result;
  const trR = trM.data?.result;
  const distR = distM.data?.result;
  const fEvalR = fEval.data?.result;
  const resolveR = resolveM.data?.result;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="benchmark-intelligence-workbench">
      {/* Reference-group stats */}
      <Card title="Reference-group statistics" icon={<Sigma className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Descriptive statistics of a reference group (mean / SD / quartiles). sufficient=false below k_min — a thin cohort is flagged, never fabricated.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="Reference values (comma/space)"><input className={inputCls} value={refVals} onChange={e => setRefVals(e.target.value)} /></Field>
          <Field label="k_min"><input className={inputCls} value={refK} onChange={e => setRefK(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => refM.mutate()} disabled={refM.isPending}>Compute stats</Button>
        {refR && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <div>n: <Val value={refR.n} /></div>
            <div>mean: <Val value={refR.mean} /></div>
            <div>sd: <Val value={refR.sd} /></div>
            <div>q1: <Val value={refR.q1} /></div>
            <div>median: <Val value={refR.median} /></div>
            <div>q3: <Val value={refR.q3} /></div>
            <div className="col-span-3">sufficient (n≥k_min): <Val value={String(refR.sufficient)} /></div>
          </div>
        )}
      </Card>

      {/* Benchmark comparison */}
      <Card title="Benchmark comparison (z / percentile / delta / quartile)" icon={<GitCompare className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Reuses the pure psychometric z→percentile transforms. ABSTAINS below k_min (suppressed=true, z / percentile / delta / quartile null) — never fabricated.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="Value"><input className={inputCls} value={bcm.value} onChange={e => setBcm({ ...bcm, value: e.target.value })} /></Field>
          <Field label="Reference values (comma/space)"><input className={inputCls} value={bcm.reference} onChange={e => setBcm({ ...bcm, reference: e.target.value })} /></Field>
          <Field label="k_min"><input className={inputCls} value={bcm.k} onChange={e => setBcm({ ...bcm, k: e.target.value })} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => bcM.mutate()} disabled={bcM.isPending}>Benchmark</Button>
        {bcR && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <div>z: <Val value={bcR.z} /></div>
            <div>percentile: <Val value={bcR.percentile} /></div>
            <div>delta: <Val value={bcR.delta} /></div>
            <div>quartile: <Val value={bcR.quartile} /></div>
            <div>cohort: <Val value={bcR.cohort_size} /></div>
            <div>reason: <Val value={bcR.reason} /></div>
            {bcR.abstained && <div className="col-span-3 text-amber-600 italic">abstained (below k_min)</div>}
          </div>
        )}
      </Card>

      {/* Percentile rank */}
      <Card title="Empirical percentile rank" icon={<Percent className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Empirical percentile rank of a value within a value set (below + half-equal). Empty set → percentile null.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="Value"><input className={inputCls} value={prm.value} onChange={e => setPrm({ ...prm, value: e.target.value })} /></Field>
          <Field label="Values (comma/space)"><input className={inputCls} value={prm.values} onChange={e => setPrm({ ...prm, values: e.target.value })} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => prM.mutate()} disabled={prM.isPending}>Rank</Button>
        {prR && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <div>percentile: <Val value={prR.percentile} /></div>
            <div>below: <Val value={prR.below} /></div>
            <div>equal: <Val value={prR.equal} /></div>
            <div>n: <Val value={prR.n} /></div>
          </div>
        )}
      </Card>

      {/* Multi-group comparison */}
      <Card title="Multi-group comparison" icon={<Layers className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Compare one value against MULTIPLE reference groups side-by-side. Each group independently ABSTAINS below k_min — never fabricated.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="Value"><input className={inputCls} value={gcVal} onChange={e => setGcVal(e.target.value)} /></Field>
          <Field label="Groups (JSON: [{label, values[] | stats:{n,mean,sd}}])"><textarea className={`${inputCls} h-24 font-mono`} value={gcGroups} onChange={e => setGcGroups(e.target.value)} /></Field>
          <Field label="k_min"><input className={inputCls} value={gcK} onChange={e => setGcK(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => gcM.mutate()} disabled={gcM.isPending}>Compare groups</Button>
        {gcM.error && <div className="mt-2 text-[11px] text-red-600">{String((gcM.error as Error).message)}</div>}
        {gcR && Array.isArray(gcR.groups) && (
          <div className="mt-2 overflow-x-auto">
            <table className="text-[10px] tabular-nums">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-2 py-1">Group</th><th className="px-2 py-1 text-right">n</th>
                  <th className="px-2 py-1 text-right">z</th><th className="px-2 py-1 text-right">pct</th>
                  <th className="px-2 py-1 text-right">Δ</th><th className="px-2 py-1 text-right">quartile</th>
                </tr>
              </thead>
              <tbody>
                {gcR.groups.map((row: any, i: number) => (
                  <tr key={`${row.label ?? 'grp'}-${i}`} className="border-t">
                    <td className="px-2 py-1">{row.label}{row.comparison?.abstained ? <span className="ml-1 text-amber-600 italic">abst</span> : null}</td>
                    <td className="px-2 py-1 text-right">{row.comparison?.cohort_size}</td>
                    <td className="px-2 py-1 text-right"><Val value={row.comparison?.z} /></td>
                    <td className="px-2 py-1 text-right"><Val value={row.comparison?.percentile} /></td>
                    <td className="px-2 py-1 text-right"><Val value={row.comparison?.delta} /></td>
                    <td className="px-2 py-1 text-right"><Val value={row.comparison?.quartile} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Trend */}
      <Card title="Benchmark trend" icon={<TrendingUp className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Least-squares slope + direction over a benchmark series (chronological). Fewer than 2 finite points → direction null (never fabricated).">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="Series (comma/space, chronological)"><input className={inputCls} value={series} onChange={e => setSeries(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => trM.mutate()} disabled={trM.isPending}>Compute trend</Button>
        {trR && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <div>first: <Val value={trR.first} /></div>
            <div>last: <Val value={trR.last} /></div>
            <div>delta: <Val value={trR.delta} /></div>
            <div>slope: <Val value={trR.slope} /></div>
            <div className="col-span-2">direction: <Val value={trR.direction} /></div>
          </div>
        )}
      </Card>

      {/* Distribution */}
      <Card title="Distribution histogram" icon={<BarChart3 className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Equal-width histogram binning of a value set. Empty set → 0 bins (never fabricated).">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Field label="Values (comma/space)"><input className={inputCls} value={distVals} onChange={e => setDistVals(e.target.value)} /></Field>
          <Field label="Bins"><input className={inputCls} value={distBins} onChange={e => setDistBins(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => distM.mutate()} disabled={distM.isPending}>Compute distribution</Button>
        {distR && Array.isArray(distR.bins) && (
          <div className="mt-2 text-[11px]">
            <div className="mb-1">n: <Val value={distR.n} /> · mean: <Val value={distR.mean} /> · sd: <Val value={distR.sd} /></div>
            <div className="flex items-end gap-1" style={{ height: 60 }}>
              {distR.bins.map((b: any, i: number) => {
                const maxCount = Math.max(1, ...distR.bins.map((x: any) => x.count));
                return (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`[${b.min}, ${b.max}] → ${b.count}`}>
                    <div className="w-full rounded-t" style={{ height: `${(b.count / maxCount) * 100}%`, background: BRAND.primary, minHeight: b.count > 0 ? 3 : 0 }} />
                    <div className="mt-0.5 text-[9px] tabular-nums text-muted-foreground">{b.count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Composite benchmark index (structured AST) */}
      <Card title="Composite benchmark index (structured-AST formula)" icon={<Calculator className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="The composite benchmark index is a STRUCTURED AST evaluated by a whitelisted interpreter — NO eval / new Function. Invalid AST → validation errors, value null.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="AST (JSON)"><textarea className={`${inputCls} h-24 font-mono`} value={ast} onChange={e => setAst(e.target.value)} /></Field>
          <Field label="vars (JSON)"><input className={inputCls} value={vars} onChange={e => setVars(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => fEval.mutate()} disabled={fEval.isPending}>Validate + evaluate</Button>
        {astErr && <div className="mt-2 text-[11px] text-red-600">{astErr}</div>}
        {fEvalR && (
          <div className="mt-2 text-[11px]">
            <div>value: <Val value={fEvalR.value} /></div>
            <div>valid: <Val value={String(fEvalR.valid)} /></div>
            {Array.isArray(fEvalR.variables) && fEvalR.variables.length > 0 && <div>variables: {fEvalR.variables.join(', ')}</div>}
            {Array.isArray(fEvalR.errors) && fEvalR.errors.length > 0 && (
              <div className="text-red-600">errors: {fEvalR.errors.join('; ')}</div>
            )}
          </div>
        )}
      </Card>

      {/* Scoped config resolver */}
      <Card title="Scoped config resolver" icon={<Building2 className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Resolve the most-specific-wins benchmark config for a context (organization → institution → custom → industry → country). No matching row → resolved:false — never fabricated. Populated scoped configs are a SEPARATE adoption axis, honest 0.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="Context (JSON)"><textarea className={`${inputCls} h-16 font-mono`} value={resolveCtx} onChange={e => setResolveCtx(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => resolveM.mutate()} disabled={resolveM.isPending}>Resolve</Button>
        {resolveM.error && <div className="mt-2 text-[11px] text-red-600">{String((resolveM.error as Error).message)}</div>}
        {resolveR && (
          <div className="mt-2 text-[11px]">
            <div>resolved: <Val value={String(resolveR.resolved)} /></div>
            <div>scope: <Val value={resolveR.scope} /></div>
            <div>scope ref: <Val value={resolveR.scope_ref} /></div>
            <div>candidates considered: <Val value={resolveR.candidates_considered} /></div>
            <div>reason: <Val value={resolveR.reason} /></div>
          </div>
        )}
      </Card>

      <div className="md:col-span-2 flex items-center gap-2 rounded-lg border bg-slate-50 p-2 text-[10px] text-muted-foreground">
        <GitCompare className="h-3 w-3" style={{ color: BRAND.primary }} />
        All computations are pure + deterministic and persist nothing. Benchmarking ABSTAINS below k_min real members in the reference group — never fabricated. null (not measurable) ≠ 0.
      </div>
    </div>
  );
}
