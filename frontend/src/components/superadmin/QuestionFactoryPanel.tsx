/**
 * MX-101X — Question Factory admin panel.
 *
 * Generates DRAFT-only question packs grounded in the real onto_competencies genome, routes them
 * through an approval workflow, and shows a coverage dashboard that keeps HONEST live coverage
 * (approved + active-mapped) strictly separate from the draft PIPELINE. Generation NEVER inflates
 * coverage; only a human approval flips a question live.
 *
 * The tab is only mounted when the `questionFactory` flag probe (/feature-flag) returns ok, so
 * with the flag OFF the UI is byte-identical.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Boxes, AlertTriangle, Info, CheckCircle2, FlaskConical, ClipboardCheck, XCircle, Archive, Search, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const BRAND = { primary: '#344E86' };
const BASE = '/api/admin/question-factory';

type Coverage = {
  ok: boolean;
  version?: string;
  genome_competencies: number;
  live_coverage: {
    assessable_competencies: number;
    assessment_ready_competencies: number;
    assessable_pct: number;
    assessment_ready_pct: number;
    definition: string;
  };
  pipeline: {
    competencies_with_drafts: number;
    competencies_with_drafts_pct: number;
    by_type_and_difficulty: Array<{ question_type: string; difficulty_band: string; n: number }>;
    note: string;
  };
  provenance_breakdown: Array<{ provenance: string; n: number }>;
  review_status_breakdown: Array<{ quality_review_status: string; n: number }>;
  status_breakdown: Array<{ status: string; n: number }>;
};
type DraftRow = {
  id: string; competency_code: string; question_type: string; difficulty_band: string; status: string;
  provenance: string; confidence_score: number | null; quality_review_status: string; created_at: string;
  prompt: string | null; onto_competency_id: string | null; competency_name: string | null;
};
type CompRow = { id: string; canonical_name: string; domain_id: string | null; live_approved: number; draft_pipeline: number };

const fetchJson = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};
const postJson = async (url: string, body?: any) => {
  const res = await fetch(url, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `${res.status}`);
  return json;
};

const pctText = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n}%`);

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'live' | 'pipeline' | 'neutral' }) {
  const border = tone === 'live' ? '#16a34a' : tone === 'pipeline' ? '#d97706' : BRAND.primary;
  return (
    <div className="rounded-lg border bg-white p-4" style={{ borderLeft: `4px solid ${border}` }}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export default function QuestionFactoryPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [gapOnly, setGapOnly] = useState(true);
  const [selectedComp, setSelectedComp] = useState<CompRow | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const coverage = useQuery<Coverage>({ queryKey: [`${BASE}/coverage`], queryFn: () => fetchJson(`${BASE}/coverage`) });
  const drafts = useQuery<{ ok: boolean; count: number; rows: DraftRow[] }>({ queryKey: [`${BASE}/drafts`], queryFn: () => fetchJson(`${BASE}/drafts?limit=200`) });
  const comps = useQuery<{ ok: boolean; count: number; ready_threshold: number; rows: CompRow[] }>({
    queryKey: [`${BASE}/competencies`, search, gapOnly],
    queryFn: () => fetchJson(`${BASE}/competencies?limit=400${gapOnly ? '&gap_only=1' : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: [`${BASE}/coverage`] });
    qc.invalidateQueries({ queryKey: [`${BASE}/drafts`] });
    qc.invalidateQueries({ queryKey: [`${BASE}/competencies`] });
  };

  const generate = useMutation({
    mutationFn: (competencyId: string) => postJson(`${BASE}/generate`, { competency_id: competencyId }),
    onSuccess: (r) => { setNotice({ kind: 'ok', msg: `Generated ${r.generated ?? 0} DRAFT questions (pending review — coverage unchanged).` }); refreshAll(); },
    onError: (e: any) => setNotice({ kind: 'err', msg: `Generate failed: ${e.message}` }),
  });
  const generateAi = useMutation({
    mutationFn: (competencyId: string) => postJson(`${BASE}/generate-ai`, { competency_id: competencyId }),
    onSuccess: (r) => { setNotice({ kind: r.ok ? 'ok' : 'err', msg: r.ok ? `AI generated ${r.generated ?? 0} drafts.` : `AI path inert: ${r.error || 'OPENAI_API_KEY not configured'}` }); refreshAll(); },
    onError: (e: any) => setNotice({ kind: 'err', msg: `AI generation unavailable: ${e.message}` }),
  });
  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => postJson(`${BASE}/${id}/review`, { action }),
    onSuccess: (_r, v) => { setNotice({ kind: 'ok', msg: `Review action "${v.action}" applied.` }); refreshAll(); },
    onError: (e: any) => setNotice({ kind: 'err', msg: `Review failed: ${e.message}` }),
  });
  const retire = useMutation({
    mutationFn: (id: string) => postJson(`${BASE}/${id}/retire`),
    onSuccess: () => { setNotice({ kind: 'ok', msg: 'Question retired (archived — never deleted).' }); refreshAll(); },
    onError: (e: any) => setNotice({ kind: 'err', msg: `Retire failed: ${e.message}` }),
  });

  const cov = coverage.data;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-6 w-6" style={{ color: BRAND.primary }} />
            <h1 className="text-xl font-bold text-gray-900">Question Factory</h1>
            {cov?.version && <Badge variant="outline" className="text-[10px]">{cov.version}</Badge>}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Generate <strong>draft-only</strong> question packs grounded in the live competency genome, route them
            through human review, and approve them into the assessment bank. Drafts never count toward coverage —
            only a human approval makes a question live.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={coverage.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${coverage.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 rounded-md border p-3 text-sm ${notice.kind === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {notice.kind === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{notice.msg}</span>
          <button className="ml-auto text-xs underline" onClick={() => setNotice(null)}>dismiss</button>
        </div>
      )}

      {coverage.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Failed to load coverage.</div>
      )}

      {/* Coverage summary — HONEST live vs PIPELINE */}
      {cov && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Boxes className="h-4 w-4" /> Coverage — honest live vs draft pipeline
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat tone="neutral" label="Genome Competencies" value={String(cov.genome_competencies)} sub="onto_competencies (active)" />
            <Stat tone="live" label="Live Assessable" value={`${cov.live_coverage.assessable_competencies}`} sub={`${pctText(cov.live_coverage.assessable_pct)} · ≥1 approved+mapped`} />
            <Stat tone="live" label="Assessment-Ready" value={`${cov.live_coverage.assessment_ready_competencies}`} sub={`${pctText(cov.live_coverage.assessment_ready_pct)} · ≥4 approved+mapped`} />
            <Stat tone="pipeline" label="In Draft Pipeline" value={`${cov.pipeline.competencies_with_drafts}`} sub={`${pctText(cov.pipeline.competencies_with_drafts_pct)} · awaiting review`} />
          </div>
          <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{cov.pipeline.note} {cov.live_coverage.definition}</span>
          </div>

          {/* Breakdowns */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Breakdown title="By Provenance" rows={cov.provenance_breakdown.map(r => ({ k: r.provenance, n: r.n }))} />
            <Breakdown title="By Review Status" rows={cov.review_status_breakdown.map(r => ({ k: r.quality_review_status, n: r.n }))} />
            <Breakdown title="By Bank Status" rows={cov.status_breakdown.map(r => ({ k: r.status, n: r.n }))} />
          </div>
        </div>
      )}

      {/* Generate controls — pick a genome competency */}
      <div className="rounded-lg border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Sparkles className="h-4 w-4" /> Generate draft pack
          </div>
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search competency…" className="h-9 w-56 pl-8" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={gapOnly} onChange={(e) => setGapOnly(e.target.checked)} />
            Coverage gaps only (&lt;{comps.data?.ready_threshold ?? 4} live)
          </label>
        </div>
        <div className="max-h-80 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competency</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead className="text-right">Live</TableHead>
                <TableHead className="text-right">Drafts</TableHead>
                <TableHead className="text-right">Generate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comps.isLoading && <TableRow><TableCell colSpan={5} className="text-center text-sm text-gray-400">Loading…</TableCell></TableRow>}
              {comps.data?.rows?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-gray-400">No competencies match.</TableCell></TableRow>}
              {comps.data?.rows?.map((c) => (
                <TableRow key={c.id} className={selectedComp?.id === c.id ? 'bg-blue-50' : ''}>
                  <TableCell className="font-medium text-gray-900">{c.canonical_name}</TableCell>
                  <TableCell className="text-xs text-gray-500">{c.domain_id || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={c.live_approved >= 4 ? 'default' : 'outline'} className="tabular-nums">{c.live_approved}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-gray-600 tabular-nums">{c.draft_pipeline}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" disabled={generate.isPending}
                        onClick={() => { setSelectedComp(c); generate.mutate(c.id); }}>
                        <Boxes className="mr-1 h-3.5 w-3.5" /> Pack
                      </Button>
                      <Button size="sm" variant="ghost" title="AI generation (inert without OPENAI_API_KEY)" disabled={generateAi.isPending}
                        onClick={() => { setSelectedComp(c); generateAi.mutate(c.id); }}>
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Review queue */}
      <div className="rounded-lg border bg-white">
        <div className="flex items-center gap-2 border-b p-3 text-sm font-semibold text-gray-700">
          <ClipboardCheck className="h-4 w-4" /> Review queue
          <Badge variant="outline" className="ml-1">{drafts.data?.count ?? 0}</Badge>
          <span className="ml-2 text-xs font-normal text-gray-400">Approve to add to the live bank · reject/retire archive (never delete)</span>
        </div>
        <div className="max-h-[28rem] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prompt</TableHead>
                <TableHead>Competency</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Provenance</TableHead>
                <TableHead>Conf.</TableHead>
                <TableHead>Review</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.isLoading && <TableRow><TableCell colSpan={8} className="text-center text-sm text-gray-400">Loading…</TableCell></TableRow>}
              {drafts.data?.rows?.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-gray-400">Review queue is empty.</TableCell></TableRow>}
              {drafts.data?.rows?.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="max-w-sm">
                    <div className="truncate text-sm text-gray-900" title={d.prompt || ''}>{d.prompt || <span className="text-gray-400">(no prompt)</span>}</div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">{d.competency_name || d.onto_competency_id || d.competency_code}</TableCell>
                  <TableCell className="text-xs">{d.question_type}</TableCell>
                  <TableCell className="text-xs">{d.difficulty_band}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{d.provenance}</Badge></TableCell>
                  <TableCell className="text-xs tabular-nums">{d.confidence_score != null ? Number(d.confidence_score).toFixed(2) : '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{d.quality_review_status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" title="Start review" disabled={review.isPending} onClick={() => review.mutate({ id: d.id, action: 'start_review' })}>Review</Button>
                      <Button size="sm" variant="default" title="Approve → live" disabled={review.isPending} onClick={() => review.mutate({ id: d.id, action: 'approve' })}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" title="Reject" disabled={review.isPending} onClick={() => review.mutate({ id: d.id, action: 'reject' })}><XCircle className="h-3.5 w-3.5 text-red-600" /></Button>
                      <Button size="sm" variant="ghost" title="Retire (archive)" disabled={retire.isPending} onClick={() => retire.mutate(d.id)}><Archive className="h-3.5 w-3.5 text-gray-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ k: string; n: number }> }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
      <div className="space-y-1">
        {rows.length === 0 && <div className="text-xs text-gray-400">No data.</div>}
        {rows.map((r) => (
          <div key={r.k} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">{r.k}</span>
            <span className="font-medium tabular-nums text-gray-900">{r.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
