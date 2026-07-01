import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sigma, Sliders, ListChecks, ShieldCheck, Layers, Calculator } from 'lucide-react';
import { BRAND } from '@/design-system/tokens';
import { Button } from '../ui/button';

const BASE = '/api/admin/score-standardization';

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

/** null/undefined → "not measurable" (amber); 0 stays 0. null ≠ 0. */
function Val({ value }: { value: number | string | null | undefined }) {
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

/**
 * StandardizationWorkbench — interactive, deterministic demos of the PURE compute mechanisms that
 * engineering-close the Score Standardization gaps via reuse-before-build:
 *   • standard-score set (z / percentile / T / standard / stanine / sten / band) — ABSTAINS below k_min
 *   • structured-AST formula validate + evaluate (NO eval / new Function — whitelisted interpreter)
 *   • performance-band classification
 *   • deterministic interpretation-rule verdict
 *   • validation checks (distribution / range / boundary / statistical / formula)
 * Persists NOTHING (persist flag omitted) — the write paths are exercised only from the panel/API.
 */
export default function StandardizationWorkbench() {
  // ── standard-score set ──
  const [ss, setSs] = React.useState({ value: '78', mean: '65', sd: '12', n: '40' });
  const ssM = useMutation({ mutationFn: () => post('/compute/standard-scores', {
    value: Number(ss.value), mean: Number(ss.mean), sd: Number(ss.sd), n: Number(ss.n),
  }) });

  // ── structured-AST formula ──
  const defaultAst = JSON.stringify(
    { op: 'add', args: [{ var: 'domain' }, { op: 'mul', args: [{ var: 'behaviour' }, { const: 0.5 }] }] },
    null, 2,
  );
  const [ast, setAst] = React.useState(defaultAst);
  const [vars, setVars] = React.useState('{ "domain": 70, "behaviour": 40 }');
  const [astErr, setAstErr] = React.useState<string | null>(null);
  const fEval = useMutation({ mutationFn: () => {
    let parsedAst: unknown, parsedVars: unknown;
    try { parsedAst = JSON.parse(ast); } catch { throw new Error('AST is not valid JSON'); }
    try { parsedVars = JSON.parse(vars); } catch { throw new Error('vars is not valid JSON'); }
    return post('/compute/formula/evaluate', { ast: parsedAst, vars: parsedVars });
  } });
  React.useEffect(() => { setAstErr(fEval.error ? String((fEval.error as Error).message) : null); }, [fEval.error]);

  // ── band classify ──
  const [pct, setPct] = React.useState('82');
  const bandM = useMutation({ mutationFn: () => post('/compute/band', { percentile: Number(pct) }) });

  // ── interpretation rule ──
  const [interpPct, setInterpPct] = React.useState('45');
  const interpM = useMutation({ mutationFn: () => post('/compute/interpretation', {
    input: { rule_type: 'percentile_band', percentile: Number(interpPct) },
  }) });

  // ── validation ──
  const [val, setVal] = React.useState({ n: '40', mean: '65', sd: '12' });
  const valM = useMutation({ mutationFn: () => post('/compute/validation', {
    check_type: 'distribution', input: { n: Number(val.n), mean: Number(val.mean), sd: Number(val.sd) },
  }) });

  const ssR = ssM.data?.result;
  const bandR = bandM.data?.result;
  const interpR = interpM.data?.result;
  const valR = valM.data?.result;
  const fEvalR = fEval.data?.result;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="standardization-workbench">
      {/* Standard-score set */}
      <Card title="Standard-score set" icon={<Sigma className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Reuses the pure psychometric z→percentile/T/standard/stanine/sten transforms. ABSTAINS below k_min (returns abstained=true, scores null) — never fabricated.">
        <div className="mb-2 grid grid-cols-4 gap-2">
          <Field label="Value"><input className={inputCls} value={ss.value} onChange={e => setSs({ ...ss, value: e.target.value })} /></Field>
          <Field label="Mean"><input className={inputCls} value={ss.mean} onChange={e => setSs({ ...ss, mean: e.target.value })} /></Field>
          <Field label="SD"><input className={inputCls} value={ss.sd} onChange={e => setSs({ ...ss, sd: e.target.value })} /></Field>
          <Field label="n"><input className={inputCls} value={ss.n} onChange={e => setSs({ ...ss, n: e.target.value })} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => ssM.mutate()} disabled={ssM.isPending}>Compute</Button>
        {ssR && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <div>z: <Val value={ssR.z} /></div>
            <div>percentile: <Val value={ssR.percentile} /></div>
            <div>T: <Val value={ssR.t_score} /></div>
            <div>standard: <Val value={ssR.standard_score} /></div>
            <div>stanine: <Val value={ssR.stanine} /></div>
            <div>sten: <Val value={ssR.sten} /></div>
            <div className="col-span-3">band: <Val value={ssR.band} /> {ssR.abstained && <span className="text-amber-600 italic">· abstained (below k_min)</span>}</div>
          </div>
        )}
      </Card>

      {/* Structured-AST formula */}
      <Card title="Structured-AST composite formula" icon={<Calculator className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Composite scores are a STRUCTURED AST evaluated by a whitelisted interpreter — NO eval / new Function. Invalid AST → validation errors, value null.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="AST (JSON)"><textarea className={`${inputCls} h-24 font-mono`} value={ast} onChange={e => setAst(e.target.value)} /></Field>
          <Field label="vars (JSON)"><input className={inputCls} value={vars} onChange={e => setVars(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => fEval.mutate()} disabled={fEval.isPending}>Validate + evaluate</Button>
        {astErr && <div className="mt-2 text-[11px] text-red-600">{astErr}</div>}
        {fEvalR && (
          <div className="mt-2 text-[11px]">
            <div>value: <Val value={fEvalR.value} /></div>
            <div>valid: <Val value={String(fEvalR.validation?.valid)} /></div>
            {Array.isArray(fEvalR.validation?.errors) && fEvalR.validation.errors.length > 0 && (
              <div className="text-red-600">errors: {fEvalR.validation.errors.join('; ')}</div>
            )}
          </div>
        )}
      </Card>

      {/* Band classify */}
      <Card title="Performance-band classification" icon={<Layers className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Deterministic percentile → performance band using the default 9-band ladder (or custom bands).">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Field label="Percentile"><input className={inputCls} value={pct} onChange={e => setPct(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => bandM.mutate()} disabled={bandM.isPending}>Classify</Button>
        {bandR && (
          <div className="mt-2 text-[11px]">
            <div>band: <Val value={bandR.band ?? bandR.key ?? bandR.label} /></div>
            {bandR.abstained && <div className="text-amber-600 italic">abstained (percentile not measurable)</div>}
          </div>
        )}
      </Card>

      {/* Interpretation rule */}
      <Card title="Interpretation-rule verdict" icon={<ListChecks className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Deterministic interpretation-rule verdict from percentile band — a repository rule, not an AI narrative.">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Field label="Percentile"><input className={inputCls} value={interpPct} onChange={e => setInterpPct(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => interpM.mutate()} disabled={interpM.isPending}>Evaluate</Button>
        {interpR && (
          <div className="mt-2 text-[11px]">
            <div>verdict: <Val value={interpR.verdict ?? interpR.band} /></div>
            <div>rule type: <Val value={interpR.rule_type} /></div>
            {interpR.abstained && <div className="text-amber-600 italic">abstained</div>}
          </div>
        )}
      </Card>

      {/* Validation */}
      <Card title="Validation checks" icon={<ShieldCheck className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Distribution validation ABSTAINS below k_min. Range / boundary / statistical / formula checks are also available via the API.">
        <div className="mb-2 grid grid-cols-3 gap-2">
          <Field label="n"><input className={inputCls} value={val.n} onChange={e => setVal({ ...val, n: e.target.value })} /></Field>
          <Field label="Mean"><input className={inputCls} value={val.mean} onChange={e => setVal({ ...val, mean: e.target.value })} /></Field>
          <Field label="SD"><input className={inputCls} value={val.sd} onChange={e => setVal({ ...val, sd: e.target.value })} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => valM.mutate()} disabled={valM.isPending}>Validate distribution</Button>
        {valR && (
          <div className="mt-2 text-[11px]">
            <div>check: <Val value={valR.check_type} /></div>
            <div>passed: <Val value={String(valR.passed)} /></div>
            {Array.isArray(valR.errors) && valR.errors.length > 0 && (
              <div className="text-red-600">errors: {valR.errors.join('; ')}</div>
            )}
          </div>
        )}
      </Card>

      <div className="md:col-span-2 flex items-center gap-2 rounded-lg border bg-slate-50 p-2 text-[10px] text-muted-foreground">
        <Sliders className="h-3 w-3" style={{ color: BRAND.primary }} />
        All computations are pure + deterministic and persist nothing. Norm-referenced standardization ABSTAINS below k_min real members — never fabricated. null (not measurable) ≠ 0.
      </div>
    </div>
  );
}
