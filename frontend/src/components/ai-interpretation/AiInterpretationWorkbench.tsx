import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, ShieldCheck, Gauge, ScanSearch, Calculator, Building2, MessageSquareText } from 'lucide-react';
import { BRAND } from '@/design-system/tokens';
import { Button } from '../ui/button';

const BASE = '/api/admin/ai-interpretation';

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

function strArray(s: string): string[] {
  return String(s).split(/[,\n]+/).map((x) => x.trim()).filter(Boolean);
}

/**
 * AiInterpretationWorkbench — interactive, deterministic demos of the PURE interpretation mechanisms that
 * engineering-close the AI Interpretation & Explainability gaps via reuse-before-build:
 *   • deterministic interpretation (rule-select via 3.8 AST → grounded {{token}} render → confidence + abstention)
 *   • confidence scoring (facet presence + k_min cohort floor → band + abstained + human_review)
 *   • 8-facet explanation composer (why / evidence_basis / data_sources / verified references)
 *   • hallucination scan (unsupported numeric-claim detection + cited-reference verification)
 *   • composite interpretation index — structured-AST formula (NO eval / new Function; whitelisted interpreter)
 *   • scoped policy resolve (most-specific-wins; no match → resolved:false, never fabricated)
 * Persists NOTHING (persist flag omitted) — the write paths are exercised only from the panel/API.
 */
export default function AiInterpretationWorkbench() {
  // ── deterministic interpretation ──
  const [tmpl, setTmpl] = React.useState('{{kind}} interpretation: strength in {{top_facet}} (percentile {{percentile}}).');
  const [ivars, setIvars] = React.useState('{ "kind": "competency", "top_facet": "collaboration", "percentile": 82 }');
  const [grounded, setGrounded] = React.useState('kind, top_facet, percentile');
  const [ireq, setIreq] = React.useState('score, benchmark, evidence');
  const [ievi, setIevi] = React.useState('{ "score": true, "benchmark": true, "evidence": false }');
  const [icohort, setIcohort] = React.useState('30');
  const [ik, setIk] = React.useState('30');
  const interpM = useMutation({ mutationFn: () => {
    let vars: unknown, evidence: unknown;
    try { vars = JSON.parse(ivars); } catch { throw new Error('vars is not valid JSON'); }
    try { evidence = JSON.parse(ievi); } catch { throw new Error('evidence_present is not valid JSON'); }
    return post('/compute/interpret', {
      template: tmpl, vars, grounded_tokens: strArray(grounded),
      required_facets: strArray(ireq), evidence_present: evidence,
      cohort_size: Number(icohort), k_min: Number(ik),
    });
  } });

  // ── confidence scoring ──
  const [cevi, setCevi] = React.useState('{ "score": true, "benchmark": true, "evidence": false }');
  const [creq, setCreq] = React.useState('score, benchmark, evidence');
  const [ccohort, setCcohort] = React.useState('12');
  const [ck, setCk] = React.useState('30');
  const confM = useMutation({ mutationFn: () => {
    let evidence: unknown;
    try { evidence = JSON.parse(cevi); } catch { throw new Error('evidence_present is not valid JSON'); }
    return post('/compute/confidence', {
      evidence_present: evidence, required_facets: strArray(creq),
      cohort_size: Number(ccohort), k_min: Number(ck),
    });
  } });

  // ── explanation composer ──
  const [why, setWhy] = React.useState('Interpretation rule competency@v1 matched for competency');
  const [ebasis, setEbasis] = React.useState('score_ref, benchmark_ref');
  const [esrc, setEsrc] = React.useState('astd_standard_scores, abmk_results');
  const [eruleKey, setEruleKey] = React.useState('competency-core');
  const explM = useMutation({ mutationFn: () => post('/compute/explain', {
    why, evidence_basis: strArray(ebasis), data_sources: strArray(esrc),
    rule_reference: { key: eruleKey, version: 1 },
  }) });

  // ── hallucination scan ──
  const [htext, setHtext] = React.useState('Strength in collaboration (percentile 82). Ranked #1 of 4200 candidates nationally.');
  const [hvars, setHvars] = React.useState('{ "percentile": 82 }');
  const [hgrounded, setHgrounded] = React.useState('percentile');
  const [hrefs, setHrefs] = React.useState('{ "rule_reference": "competency-core@v1", "score_reference": "astd:demo" }');
  const halM = useMutation({ mutationFn: () => {
    let vars: unknown, refs: unknown;
    try { vars = JSON.parse(hvars); } catch { throw new Error('vars is not valid JSON'); }
    try { refs = JSON.parse(hrefs); } catch { throw new Error('references is not valid JSON'); }
    return post('/compute/hallucination-scan', { text: htext, vars, grounded_tokens: strArray(hgrounded), references: refs });
  } });

  // ── composite interpretation index (structured AST) ──
  const defaultAst = JSON.stringify(
    { type: 'op', op: '+', args: [{ type: 'var', name: 'percentile' }, { type: 'op', op: '*', args: [{ type: 'var', name: 'confidence' }, { type: 'const', value: 0.5 }] }] },
    null, 2,
  );
  const [ast, setAst] = React.useState(defaultAst);
  const [fvars, setFvars] = React.useState('{ "percentile": 82, "confidence": 74 }');
  const [astErr, setAstErr] = React.useState<string | null>(null);
  const fEval = useMutation({ mutationFn: () => {
    let parsedAst: unknown, parsedVars: unknown;
    try { parsedAst = JSON.parse(ast); } catch { throw new Error('AST is not valid JSON'); }
    try { parsedVars = JSON.parse(fvars); } catch { throw new Error('vars is not valid JSON'); }
    return post('/compute/formula', { ast: parsedAst, vars: parsedVars });
  } });
  React.useEffect(() => { setAstErr(fEval.error ? String((fEval.error as Error).message) : null); }, [fEval.error]);

  // ── scoped policy resolver ──
  const [resolveCtx, setResolveCtx] = React.useState('{ "organization": "acme", "industry": "it" }');
  const resolveM = useMutation({ mutationFn: () => {
    let parsed: unknown;
    try { parsed = JSON.parse(resolveCtx); } catch { throw new Error('context is not valid JSON'); }
    return post('/policies/resolve', { context: parsed });
  } });

  const iR = interpM.data?.result;
  const cR = confM.data?.result;
  const eR = explM.data?.result;
  const hR = halM.data?.result;
  const fEvalR = fEval.data?.result;
  const resolveR = resolveM.data?.result;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="ai-interpretation-workbench">
      {/* Deterministic interpretation */}
      <Card title="Deterministic interpretation (rule → grounded render → confidence)" icon={<Sparkles className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Renders a grounded {{token}} template against vars, then scores confidence + abstains below the k_min cohort floor. The CORE is deterministic — LLM narration is an OPTIONAL, output-validated seam elsewhere. Never fabricated.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="Template ({{token}})"><textarea className={`${inputCls} h-14 font-mono`} value={tmpl} onChange={e => setTmpl(e.target.value)} /></Field>
          <Field label="vars (JSON)"><input className={inputCls} value={ivars} onChange={e => setIvars(e.target.value)} /></Field>
          <Field label="grounded tokens (comma)"><input className={inputCls} value={grounded} onChange={e => setGrounded(e.target.value)} /></Field>
          <Field label="required facets (comma)"><input className={inputCls} value={ireq} onChange={e => setIreq(e.target.value)} /></Field>
          <Field label="evidence present (JSON)"><input className={inputCls} value={ievi} onChange={e => setIevi(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="cohort size"><input className={inputCls} value={icohort} onChange={e => setIcohort(e.target.value)} /></Field>
            <Field label="k_min"><input className={inputCls} value={ik} onChange={e => setIk(e.target.value)} /></Field>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => interpM.mutate()} disabled={interpM.isPending}>Interpret</Button>
        {interpM.error && <div className="mt-2 text-[11px] text-red-600">{String((interpM.error as Error).message)}</div>}
        {iR && (
          <div className="mt-2 space-y-1 text-[11px]">
            <div className="rounded bg-slate-50 p-2 font-normal normal-case">{iR.text || <span className="text-amber-600 italic">no text (abstained)</span>}</div>
            <div className="grid grid-cols-3 gap-2">
              <div>source: <Val value={iR.source} /></div>
              <div>confidence: <Val value={iR.confidence?.score} /></div>
              <div>band: <Val value={iR.confidence?.band} /></div>
              <div>abstained: <Val value={String(iR.abstained)} /></div>
              <div>human review: <Val value={String(iR.human_review)} /></div>
              <div>tokens: <Val value={Array.isArray(iR.tokens_used) ? iR.tokens_used.length : null} /></div>
            </div>
            {iR.abstained && <div className="text-amber-600 italic">abstained — {iR.reason}</div>}
          </div>
        )}
      </Card>

      {/* Confidence scoring */}
      <Card title="Confidence scoring (facet presence + k_min floor)" icon={<Gauge className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Scores interpretation confidence from required-facet presence and the k_min cohort floor. Below k_min → abstained + human_review, score/band null — never fabricated.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="evidence present (JSON)"><input className={inputCls} value={cevi} onChange={e => setCevi(e.target.value)} /></Field>
          <Field label="required facets (comma)"><input className={inputCls} value={creq} onChange={e => setCreq(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="cohort size"><input className={inputCls} value={ccohort} onChange={e => setCcohort(e.target.value)} /></Field>
            <Field label="k_min"><input className={inputCls} value={ck} onChange={e => setCk(e.target.value)} /></Field>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => confM.mutate()} disabled={confM.isPending}>Score confidence</Button>
        {confM.error && <div className="mt-2 text-[11px] text-red-600">{String((confM.error as Error).message)}</div>}
        {cR && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <div>score: <Val value={cR.score} /></div>
            <div>band: <Val value={cR.band} /></div>
            <div>abstained: <Val value={String(cR.abstained)} /></div>
            <div>human review: <Val value={String(cR.human_review)} /></div>
            <div className="col-span-3">present: {Array.isArray(cR.present) && cR.present.length ? cR.present.join(', ') : <span className="text-amber-600 italic">none</span>}</div>
            <div className="col-span-3">missing: {Array.isArray(cR.missing) && cR.missing.length ? cR.missing.join(', ') : <span className="text-emerald-700">none</span>}</div>
            <div className="col-span-3">reason: <Val value={cR.reason} /></div>
          </div>
        )}
      </Card>

      {/* Explanation composer */}
      <Card title="Explanation composer (why + evidence basis + verified references)" icon={<MessageSquareText className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Composes the structured explanation: why, evidence basis, data sources, and cited references verified via the reference resolver. Unresolvable references are dropped, never fabricated.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="why"><textarea className={`${inputCls} h-12 font-mono`} value={why} onChange={e => setWhy(e.target.value)} /></Field>
          <Field label="evidence basis (comma)"><input className={inputCls} value={ebasis} onChange={e => setEbasis(e.target.value)} /></Field>
          <Field label="data sources (comma)"><input className={inputCls} value={esrc} onChange={e => setEsrc(e.target.value)} /></Field>
          <Field label="rule reference key"><input className={inputCls} value={eruleKey} onChange={e => setEruleKey(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => explM.mutate()} disabled={explM.isPending}>Compose explanation</Button>
        {eR && (
          <div className="mt-2 space-y-1 text-[11px]">
            <div>why: <span className="font-normal normal-case">{eR.why || <span className="text-amber-600 italic">—</span>}</span></div>
            <div>rule ref: <Val value={eR.rule_reference} /></div>
            <div>data sources: {Array.isArray(eR.data_sources) && eR.data_sources.length ? eR.data_sources.join(', ') : <span className="text-amber-600 italic">none</span>}</div>
            <div>evidence basis: <Val value={Array.isArray(eR.evidence_basis) ? eR.evidence_basis.length : null} /> item(s)</div>
          </div>
        )}
      </Card>

      {/* Hallucination scan */}
      <Card title="Hallucination scan (unsupported claims + reference verification)" icon={<ScanSearch className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Scans narration text for numeric claims NOT supported by grounded vars/tokens and verifies cited references resolve. protected=true only when zero unsupported claims. Never fabricated.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="text"><textarea className={`${inputCls} h-14 font-mono`} value={htext} onChange={e => setHtext(e.target.value)} /></Field>
          <Field label="vars (JSON)"><input className={inputCls} value={hvars} onChange={e => setHvars(e.target.value)} /></Field>
          <Field label="grounded tokens (comma)"><input className={inputCls} value={hgrounded} onChange={e => setHgrounded(e.target.value)} /></Field>
          <Field label="references (JSON)"><input className={inputCls} value={hrefs} onChange={e => setHrefs(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => halM.mutate()} disabled={halM.isPending}>Scan</Button>
        {halM.error && <div className="mt-2 text-[11px] text-red-600">{String((halM.error as Error).message)}</div>}
        {hR && (
          <div className="mt-2 space-y-1 text-[11px]">
            <div>protected: <span className={hR.protected ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>{String(hR.protected)}</span></div>
            <div>unsupported claims: <Val value={hR.unsupported?.count} /></div>
            {Array.isArray(hR.unsupported?.claims) && hR.unsupported.claims.length > 0 && (
              <div className="text-red-600">claims: {hR.unsupported.claims.join('; ')}</div>
            )}
            {hR.references && Array.isArray(hR.references.dropped) && hR.references.dropped.length > 0 && (
              <div className="text-amber-600">dropped refs: {hR.references.dropped.join(', ')}</div>
            )}
          </div>
        )}
      </Card>

      {/* Composite interpretation index (structured AST) */}
      <Card title="Composite interpretation index (structured-AST formula)" icon={<Calculator className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="The composite interpretation index is a STRUCTURED AST evaluated by a whitelisted interpreter — NO eval / new Function. Invalid AST → valid:false + error, value null.">
        <div className="mb-2 grid grid-cols-1 gap-2">
          <Field label="AST (JSON)"><textarea className={`${inputCls} h-24 font-mono`} value={ast} onChange={e => setAst(e.target.value)} /></Field>
          <Field label="vars (JSON)"><input className={inputCls} value={fvars} onChange={e => setFvars(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" onClick={() => fEval.mutate()} disabled={fEval.isPending}>Validate + evaluate</Button>
        {astErr && <div className="mt-2 text-[11px] text-red-600">{astErr}</div>}
        {fEvalR && (
          <div className="mt-2 text-[11px]">
            <div>value: <Val value={fEvalR.value} /></div>
            <div>valid: <Val value={String(fEvalR.valid)} /></div>
            {fEvalR.error && <div className="text-red-600">error: {fEvalR.error}</div>}
          </div>
        )}
      </Card>

      {/* Scoped policy resolver */}
      <Card title="Scoped policy resolver" icon={<Building2 className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Resolve the most-specific-wins interpretation policy for a context (organization → institution → custom → industry → country). No matching row → resolved:false — never fabricated. Populated scoped policies are a SEPARATE adoption axis, honest 0.">
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
        <ShieldCheck className="h-3 w-3" style={{ color: BRAND.primary }} />
        All computations are pure + deterministic and persist nothing. Interpretation ABSTAINS below the confidence / k_min evidence floor — never fabricated. LLM narration is an optional, output-validated seam. null (not measurable) ≠ 0.
      </div>
    </div>
  );
}
