import { BRAND } from '@/design-system/tokens';
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
import { RefreshCw, Boxes, AlertTriangle, Info, CheckCircle2, FlaskConical, ClipboardCheck, XCircle, Archive, Search, Sparkles, Target, Layers, ShieldCheck, PlayCircle, Gauge, TrendingUp, Award } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';


const BASE = '/api/admin/question-factory';
// MX-101B — Assessment Readiness Acceleration. Sub-sections are probe-gated by `assessmentReadiness`
// (GET /enabled). With the flag OFF the probe returns {enabled:false} → the Readiness tab is never
// rendered (byte-identical), and the routes themselves 503 regardless.
const AR_BASE = '/api/admin/assessment-readiness';

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

type Axis = { competencies: number; pct: number; questions?: number };
type Founder = {
  ok: boolean; version?: string; genome_competencies: number;
  coverage: { draft: Axis; approved: Axis; assessment_ready: Axis };
  role_dna: { role_dna_competencies: number; draft_coverage: Axis; approved_coverage: Axis; assessment_ready_coverage: Axis; target_pct: number };
  tiers: Array<{ tier: number; tier_label: string; n: number }>;
  target_progress: Record<'approved_coverage_pct' | 'assessment_ready_competencies' | 'role_dna_ready_pct', { value: number; target: number; met: boolean; remaining: number }>;
  verdict_note: string;
};
type Quality = {
  ok: boolean; schema_initialized: boolean; note?: string;
  draft_corpus?: { questions: number; with_confidence: number; avg_confidence: number | null };
  duplication?: { duplicate_groups: number; redundant_rows: number; status: string };
  structural?: { short_prompt: number; too_few_options: number; bad_best_option: number; total_issues: number; status: string };
  confidence_distribution?: { low_lt_0_4: number; moderate_0_4_0_5: number; higher_gte_0_5: number };
  spread?: { competencies: number; multi_type: number; multi_difficulty: number; ready_shaped: number };
};
type Tiers = { ok: boolean; tier_summary: Array<{ tier: number; tier_label: string; n: number }>; rows: Array<{ id: string; canonical_name: string; domain_id: string | null; type_key: string; tier: number; dna_refs: number; live_approved: number; draft_pipeline: number }> };

type Tab = 'founder' | 'population' | 'quality' | 'workbench' | 'readiness';

// MX-101B response shapes (matched to the service return blocks — these surfaces degrade, never throw).
type ArAxis = { competencies: number; pct: number; questions?: number };
type ArDashboard = {
  ok: boolean;
  readiness?: { base_ready: number; ready_assured: number; ready_unverified: number; ready_quality_concern: number };
  coverage_axes?: { draft: ArAxis; approved: ArAxis; assessment_ready: ArAxis };
  certification?: {
    ok: boolean; schema_initialized?: boolean; certified: number; needs_review: number; failed: number; total: number;
    uncertified_actionable_drafts: number | null; avg_structural: number | null; avg_heuristic: number | null; note?: string;
  };
  backlog?: {
    ok: boolean; total_pending: number; by_age?: { last_7d: number; days_7_to_30: number; older_than_30d: number };
    by_certification?: { certified: number; needs_review: number; failed: number } | null; certification_available?: boolean; note?: string;
  };
  trends?: {
    ok: boolean; schema_initialized?: boolean; points: number; trend: string;
    series: Array<{ captured_at: string; label?: string | null; base_ready_competencies: number; quality_assured_competencies: number; approved_competencies: number }>;
    deltas?: { approved_competencies: number; base_ready_competencies: number; quality_assured_competencies: number; approved_questions: number };
    note?: string;
  };
  note?: string;
};
type ArReviewers = { ok: boolean; reviewers: Array<{ reviewer_id: string; approved: number; rejected: number; retired: number; last_review_at?: string | null }>; actions_last_30d?: number; note?: string };

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
  const [tab, setTab] = useState<Tab>('founder');
  const [search, setSearch] = useState('');
  const [gapOnly, setGapOnly] = useState(true);
  const [selectedComp, setSelectedComp] = useState<CompRow | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const founder = useQuery<Founder>({ queryKey: [`${BASE}/population/founder`], queryFn: () => fetchJson(`${BASE}/population/founder`) });
  const quality = useQuery<Quality>({ queryKey: [`${BASE}/population/quality`], queryFn: () => fetchJson(`${BASE}/population/quality`) });
  const tiers = useQuery<Tiers>({ queryKey: [`${BASE}/population/priority`], queryFn: () => fetchJson(`${BASE}/population/priority`) });

  const coverage = useQuery<Coverage>({ queryKey: [`${BASE}/coverage`], queryFn: () => fetchJson(`${BASE}/coverage`) });
  const drafts = useQuery<{ ok: boolean; count: number; rows: DraftRow[] }>({ queryKey: [`${BASE}/drafts`], queryFn: () => fetchJson(`${BASE}/drafts?limit=200`) });
  const comps = useQuery<{ ok: boolean; count: number; ready_threshold: number; rows: CompRow[] }>({
    queryKey: [`${BASE}/competencies`, search, gapOnly],
    queryFn: () => fetchJson(`${BASE}/competencies?limit=400${gapOnly ? '&gap_only=1' : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`),
  });

  // MX-101B — probe the assessmentReadiness flag. enabled:false (flag OFF) → tab never rendered.
  const arEnabled = useQuery<{ enabled: boolean }>({
    queryKey: [`${AR_BASE}/enabled`],
    queryFn: () => fetchJson(`${AR_BASE}/enabled`),
    retry: false,
  });
  const arOn = arEnabled.data?.enabled === true;
  const arDash = useQuery<ArDashboard>({ queryKey: [`${AR_BASE}/dashboard`], queryFn: () => fetchJson(`${AR_BASE}/dashboard`), enabled: arOn });
  const arReviewers = useQuery<ArReviewers>({ queryKey: [`${AR_BASE}/workbench/reviewers`], queryFn: () => fetchJson(`${AR_BASE}/workbench/reviewers`), enabled: arOn });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: [`${BASE}/coverage`] });
    qc.invalidateQueries({ queryKey: [`${BASE}/drafts`] });
    qc.invalidateQueries({ queryKey: [`${BASE}/competencies`] });
    qc.invalidateQueries({ queryKey: [`${BASE}/population/founder`] });
    qc.invalidateQueries({ queryKey: [`${BASE}/population/quality`] });
    qc.invalidateQueries({ queryKey: [`${BASE}/population/priority`] });
    if (arOn) {
      qc.invalidateQueries({ queryKey: [`${AR_BASE}/dashboard`] });
      qc.invalidateQueries({ queryKey: [`${AR_BASE}/workbench/reviewers`] });
    }
  };

  // Certification + snapshot are the only MX-101B write paths the agent exposes. Neither flips
  // coverage: certify pre-qualifies (Confidence axis), snapshot is an append-only time-series point.
  const certifyDrafts = useMutation({
    mutationFn: () => postJson(`${AR_BASE}/certification/certify-drafts`, {}),
    onSuccess: (r) => { setNotice({ kind: 'ok', msg: `Certified ${r.evaluated ?? 0} drafts — ${r.certified ?? 0} certified, ${r.needs_review ?? 0} need review, ${r.failed ?? 0} failed. Certification ≠ approval; coverage unchanged.` }); refreshAll(); },
    onError: (e: any) => setNotice({ kind: 'err', msg: `Certification run failed: ${e.message}` }),
  });
  const snapshot = useMutation({
    mutationFn: () => postJson(`${AR_BASE}/readiness/snapshot`, {}),
    onSuccess: () => { setNotice({ kind: 'ok', msg: 'Coverage snapshot captured (append-only trend point).' }); refreshAll(); },
    onError: (e: any) => setNotice({ kind: 'err', msg: `Snapshot failed: ${e.message}` }),
  });

  const bulkRun = useMutation({
    mutationFn: (opts: { tier?: number; dry_run?: boolean }) => postJson(`${BASE}/population/run`, opts),
    onSuccess: (r) => {
      const msg = r.dry_run
        ? `Dry-run: would generate ${r.would_generate ?? 0} drafts across ${r.targeted_competencies ?? 0} competencies (nothing written).`
        : `Generated ${r.questions_generated ?? 0} DRAFT questions across ${r.competencies_generated ?? 0} competencies (pending review — live coverage unchanged).`;
      setNotice({ kind: 'ok', msg });
      refreshAll();
    },
    onError: (e: any) => setNotice({ kind: 'err', msg: `Population run failed: ${e.message}` }),
  });

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

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b">
        {([
          ['founder', 'Founder Coverage', Target],
          ['population', 'Population', Layers],
          ['quality', 'Quality', ShieldCheck],
          ['workbench', 'Coverage & Review', ClipboardCheck],
          ...(arOn ? [['readiness', 'Assessment Readiness', Gauge] as [Tab, string, any]] : []),
        ] as Array<[Tab, string, any]>).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === id ? 'border-[#344E86] text-[#344E86]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ===== FOUNDER COVERAGE DASHBOARD (3 axes + target progress) ===== */}
      {tab === 'founder' && (
        <div className="space-y-5">
          {founder.isLoading && <div className="text-sm text-gray-400">Loading…</div>}
          {founder.isError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Failed to load founder dashboard.</div>}
          {founder.data && (() => {
            const f = founder.data;
            const tp = f.target_progress;
            return (
              <>
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  <Info className="mr-1 inline h-3.5 w-3.5" />
                  Three SEPARATE axes. Drafts NEVER count toward approved or assessment-ready coverage — only a human approval makes a question live. {f.verdict_note}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Stat tone="pipeline" label="Draft Coverage" value={`${f.coverage.draft.competencies}`} sub={`${pctText(f.coverage.draft.pct)} of ${f.genome_competencies} · ${f.coverage.draft.questions ?? 0} drafts`} />
                  <Stat tone="live" label="Approved Coverage" value={`${f.coverage.approved.competencies}`} sub={`${pctText(f.coverage.approved.pct)} · ≥1 approved+active`} />
                  <Stat tone="live" label="Assessment-Ready" value={`${f.coverage.assessment_ready.competencies}`} sub={`${pctText(f.coverage.assessment_ready.pct)} · ≥4 approved, ≥2 types & diffs`} />
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold text-gray-700">Target progress (earned only by human approval)</div>
                  <div className="space-y-2">
                    <ProgressRow label="Approved coverage %" value={tp.approved_coverage_pct.value} target={tp.approved_coverage_pct.target} met={tp.approved_coverage_pct.met} suffix="%" remaining={`${tp.approved_coverage_pct.remaining}% remaining`} />
                    <ProgressRow label="Assessment-ready competencies" value={tp.assessment_ready_competencies.value} target={tp.assessment_ready_competencies.target} met={tp.assessment_ready_competencies.met} remaining={`${tp.assessment_ready_competencies.remaining} remaining`} />
                    <ProgressRow label="Role-DNA ready %" value={tp.role_dna_ready_pct.value} target={tp.role_dna_ready_pct.target} met={tp.role_dna_ready_pct.met} suffix="%" remaining={`${tp.role_dna_ready_pct.remaining}% remaining`} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border bg-white p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Role-DNA / consumer coverage</div>
                    <div className="text-sm text-gray-700">Denominator: <strong>{f.role_dna.role_dna_competencies}</strong> competencies (Employer + Career consume this same set).</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                      <div><div className="text-lg font-bold text-amber-600">{f.role_dna.draft_coverage.pct}%</div>Draft</div>
                      <div><div className="text-lg font-bold text-green-600">{f.role_dna.approved_coverage.pct}%</div>Approved</div>
                      <div><div className="text-lg font-bold text-green-700">{f.role_dna.assessment_ready_coverage.pct}%</div>Ready</div>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-white p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Priority tiers</div>
                    <div className="space-y-1">
                      {f.tiers.map((t) => (
                        <div key={t.tier} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{t.tier_label}</span>
                          <span className="font-medium tabular-nums text-gray-900">{t.n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ===== POPULATION (priority tiers + bulk run control) ===== */}
      {tab === 'population' && (
        <div className="space-y-5">
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700"><PlayCircle className="h-4 w-4" /> Bulk draft population</div>
            <p className="mb-3 max-w-3xl text-xs text-gray-600">
              Drives the deterministic template generator across prioritized genome gaps. DRAFT-only and idempotent —
              competencies already holding a full draft pack are skipped, and live coverage never changes. Dry-run counts only.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={bulkRun.isPending} onClick={() => bulkRun.mutate({ dry_run: true })}>Dry-run (count only)</Button>
              <Button size="sm" variant="default" disabled={bulkRun.isPending} onClick={() => bulkRun.mutate({})} style={{ backgroundColor: BRAND.primary }}>
                {bulkRun.isPending ? 'Running…' : 'Run full population'}
              </Button>
              {[1, 2, 3, 4].map((t) => (
                <Button key={t} size="sm" variant="ghost" disabled={bulkRun.isPending} onClick={() => bulkRun.mutate({ tier: t })}>Tier {t} only</Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-white">
            <div className="border-b p-3 text-sm font-semibold text-gray-700">Priority tiers</div>
            {tiers.isLoading && <div className="p-3 text-sm text-gray-400">Loading…</div>}
            {tiers.data && (
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
                {tiers.data.tier_summary.map((t) => (
                  <Stat key={t.tier} tone="neutral" label={`Tier ${t.tier}`} value={String(t.n)} sub={t.tier_label.split('—')[1]?.trim()} />
                ))}
              </div>
            )}
            <div className="max-h-96 overflow-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competency</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">DNA refs</TableHead>
                    <TableHead className="text-right">Live</TableHead>
                    <TableHead className="text-right">Drafts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.data?.rows?.slice(0, 250).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-gray-900">{r.canonical_name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">T{r.tier}</Badge></TableCell>
                      <TableCell className="text-xs text-gray-500">{r.type_key}</TableCell>
                      <TableCell className="text-right tabular-nums text-gray-600">{r.dna_refs}</TableCell>
                      <TableCell className="text-right"><Badge variant={r.live_approved >= 4 ? 'default' : 'outline'} className="tabular-nums">{r.live_approved}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-gray-600">{r.draft_pipeline}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ===== QUALITY ===== */}
      {tab === 'quality' && (
        <div className="space-y-5">
          {quality.isLoading && <div className="text-sm text-gray-400">Loading…</div>}
          {quality.data && quality.data.schema_initialized === false && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{quality.data.note || 'Factory schema not initialized.'}</div>
          )}
          {quality.data?.draft_corpus && (
            <>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <Info className="mr-1 inline h-3.5 w-3.5" />
                Structural checks only — content quality (relevance, distractor validity) requires human review. Every draft stays pending_review.
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat tone="neutral" label="Draft Questions" value={String(quality.data.draft_corpus.questions)} sub={`${quality.data.draft_corpus.with_confidence} with confidence`} />
                <Stat tone="neutral" label="Avg Confidence" value={quality.data.draft_corpus.avg_confidence == null ? '—' : String(quality.data.draft_corpus.avg_confidence)} />
                <Stat tone={quality.data.duplication?.status === 'pass' ? 'live' : 'pipeline'} label="Duplicate Groups" value={String(quality.data.duplication?.duplicate_groups ?? 0)} sub={`${quality.data.duplication?.redundant_rows ?? 0} redundant · ${quality.data.duplication?.status}`} />
                <Stat tone={quality.data.structural?.status === 'pass' ? 'live' : 'pipeline'} label="Structural Issues" value={String(quality.data.structural?.total_issues ?? 0)} sub={quality.data.structural?.status} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Breakdown title="Confidence distribution" rows={[
                  { k: 'Low (<0.4)', n: quality.data.confidence_distribution?.low_lt_0_4 ?? 0 },
                  { k: 'Moderate (0.4–0.5)', n: quality.data.confidence_distribution?.moderate_0_4_0_5 ?? 0 },
                  { k: 'Higher (≥0.5)', n: quality.data.confidence_distribution?.higher_gte_0_5 ?? 0 },
                ]} />
                <Breakdown title="Per-competency spread (draft)" rows={[
                  { k: 'Competencies with drafts', n: quality.data.spread?.competencies ?? 0 },
                  { k: 'Multi-type (≥2)', n: quality.data.spread?.multi_type ?? 0 },
                  { k: 'Multi-difficulty (≥2)', n: quality.data.spread?.multi_difficulty ?? 0 },
                  { k: 'Ready-shaped (≥4, ≥2 types & diffs)', n: quality.data.spread?.ready_shaped ?? 0 },
                ]} />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'workbench' && coverage.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Failed to load coverage.</div>
      )}

      {/* Coverage summary — HONEST live vs PIPELINE */}
      {tab === 'workbench' && cov && (
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
      {tab === 'workbench' && (
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
      )}

      {/* Review queue */}
      {tab === 'workbench' && (
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
      )}

      {/* ===== MX-101B — ASSESSMENT READINESS (probe-gated by assessmentReadiness) ===== */}
      {tab === 'readiness' && arOn && (() => {
        const d = arDash.data;
        const r = d?.readiness;
        const cert = d?.certification;
        const bl = d?.backlog;
        const tr = d?.trends;
        const ax = d?.coverage_axes;
        return (
          <div className="space-y-5">
            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
              <Info className="mr-1 inline h-3.5 w-3.5" />
              <strong>Coverage ⟂ Confidence.</strong> <em>Base-ready</em> is the live Coverage gate (≥4 approved, ≥2 types & difficulties).
              <em> Quality-assured</em> is a SEPARATE Confidence axis layered on via certification — it is always ≤ base-ready and is NEVER
              composited into the coverage number. Certification pre-qualifies questions; it is <strong>not</strong> approval. Only a human
              approval in the review workbench changes live coverage.
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={arDash.isFetching} onClick={() => refreshAll()}>
                <RefreshCw className={`mr-2 h-4 w-4 ${arDash.isFetching ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button size="sm" variant="default" disabled={certifyDrafts.isPending} style={{ backgroundColor: BRAND.primary }} onClick={() => certifyDrafts.mutate()}>
                <ShieldCheck className="mr-2 h-4 w-4" /> {certifyDrafts.isPending ? 'Certifying…' : 'Certify actionable drafts'}
              </Button>
              <Button size="sm" variant="outline" disabled={snapshot.isPending} onClick={() => snapshot.mutate()}>
                <TrendingUp className="mr-2 h-4 w-4" /> {snapshot.isPending ? 'Capturing…' : 'Capture trend snapshot'}
              </Button>
            </div>

            {arDash.isLoading && <div className="text-sm text-gray-400">Loading readiness…</div>}
            {arDash.isError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Failed to load assessment readiness.</div>}

            {d && (
              <>
                {/* Readiness breakdown — Coverage vs Confidence side by side */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <Stat tone="live" label="Base-ready (Coverage)" value={`${r?.base_ready ?? 0}`} sub="live assessment-ready gate" />
                  <Stat tone="neutral" label="Quality-assured (Confidence)" value={`${r?.ready_assured ?? 0}`} sub="base-ready AND certified" />
                  <Stat tone="pipeline" label="Ready, unverified" value={`${r?.ready_unverified ?? 0}`} sub="base-ready, not yet certified" />
                  <Stat tone="pipeline" label="Ready, quality concern" value={`${r?.ready_quality_concern ?? 0}`} sub="certification flagged a concern" />
                </div>

                {ax && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Stat tone="pipeline" label="Draft coverage" value={`${ax.draft.competencies}`} sub={`${pctText(ax.draft.pct)} · ${ax.draft.questions ?? 0} drafts`} />
                    <Stat tone="live" label="Approved coverage" value={`${ax.approved.competencies}`} sub={pctText(ax.approved.pct)} />
                    <Stat tone="live" label="Assessment-ready coverage" value={`${ax.assessment_ready.competencies}`} sub={pctText(ax.assessment_ready.pct)} />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Certification ledger */}
                  <div className="rounded-lg border bg-white p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700"><Award className="h-4 w-4" /> Certification ledger</div>
                    {cert?.schema_initialized === false ? (
                      <div className="text-xs text-gray-500">{cert?.note || 'Certification ledger not initialized — run “Certify actionable drafts”.'}</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div><div className="text-lg font-bold text-green-600">{cert?.certified ?? 0}</div>Certified</div>
                          <div><div className="text-lg font-bold text-amber-600">{cert?.needs_review ?? 0}</div>Needs review</div>
                          <div><div className="text-lg font-bold text-red-600">{cert?.failed ?? 0}</div>Failed</div>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-gray-600">
                          <div className="flex justify-between"><span>Uncertified actionable drafts</span><span className="tabular-nums font-medium text-gray-900">{cert?.uncertified_actionable_drafts ?? '—'}</span></div>
                          <div className="flex justify-between"><span>Avg structural (high-confidence)</span><span className="tabular-nums font-medium text-gray-900">{cert?.avg_structural ?? '—'}</span></div>
                          <div className="flex justify-between"><span>Avg heuristic (proxy)</span><span className="tabular-nums font-medium text-gray-900">{cert?.avg_heuristic ?? '—'}</span></div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Review backlog */}
                  <div className="rounded-lg border bg-white p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700"><ClipboardCheck className="h-4 w-4" /> Review backlog (pipeline, not coverage)</div>
                    <div className="text-sm text-gray-700">Drafts awaiting human review: <strong className="tabular-nums">{bl?.total_pending ?? 0}</strong></div>
                    {bl?.by_age && (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div><div className="text-lg font-bold text-gray-900">{bl.by_age.last_7d}</div>≤7d</div>
                        <div><div className="text-lg font-bold text-gray-900">{bl.by_age.days_7_to_30}</div>7–30d</div>
                        <div><div className="text-lg font-bold text-gray-900">{bl.by_age.older_than_30d}</div>&gt;30d</div>
                      </div>
                    )}
                    {bl?.by_certification && (
                      <div className="mt-3 text-xs text-gray-500">Of these, certified: <strong>{bl.by_certification.certified}</strong> · needs review: <strong>{bl.by_certification.needs_review}</strong> · failed: <strong>{bl.by_certification.failed}</strong> (cert-passed are the fast-track for bulk approval).</div>
                    )}
                  </div>
                </div>

                {/* Reviewer productivity */}
                <div className="rounded-lg border bg-white">
                  <div className="flex items-center gap-2 border-b p-3 text-sm font-semibold text-gray-700"><Target className="h-4 w-4" /> Reviewer productivity
                    <span className="ml-2 text-xs font-normal text-gray-400">canonical reviewed_by (most-recent reviewer per question)</span>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Reviewer</TableHead><TableHead className="text-right">Approved</TableHead><TableHead className="text-right">Rejected</TableHead><TableHead className="text-right">Retired</TableHead><TableHead className="text-right">Last review</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {(!arReviewers.data?.reviewers || arReviewers.data.reviewers.length === 0) && <TableRow><TableCell colSpan={5} className="text-center text-sm text-gray-400">No human reviews recorded yet.</TableCell></TableRow>}
                        {arReviewers.data?.reviewers?.map((rv) => (
                          <TableRow key={rv.reviewer_id}>
                            <TableCell className="text-xs text-gray-700">{rv.reviewer_id}</TableCell>
                            <TableCell className="text-right tabular-nums text-green-700">{rv.approved}</TableCell>
                            <TableCell className="text-right tabular-nums text-red-600">{rv.rejected}</TableCell>
                            <TableCell className="text-right tabular-nums text-gray-500">{rv.retired}</TableCell>
                            <TableCell className="text-right text-xs text-gray-500">{rv.last_review_at ? new Date(rv.last_review_at).toLocaleDateString() : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Trends */}
                <div className="rounded-lg border bg-white p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700"><TrendingUp className="h-4 w-4" /> Coverage & readiness trend</div>
                  {!tr || tr.trend === 'insufficient_history' ? (
                    <div className="text-xs text-gray-500">{tr?.note || 'Need at least two snapshots to compute a trend. Capture snapshots over time to build the series.'}</div>
                  ) : (
                    <>
                      {tr.deltas && (
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <DeltaStat label="Approved comps" v={tr.deltas.approved_competencies} />
                          <DeltaStat label="Base-ready comps" v={tr.deltas.base_ready_competencies} />
                          <DeltaStat label="Quality-assured comps" v={tr.deltas.quality_assured_competencies} />
                          <DeltaStat label="Approved questions" v={tr.deltas.approved_questions} />
                        </div>
                      )}
                      <div className="mt-3 max-h-48 overflow-auto">
                        <Table>
                          <TableHeader><TableRow><TableHead>Captured</TableHead><TableHead className="text-right">Approved</TableHead><TableHead className="text-right">Base-ready</TableHead><TableHead className="text-right">Quality-assured</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {tr.series.map((s, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs text-gray-600">{new Date(s.captured_at).toLocaleString()}{s.label ? ` · ${s.label}` : ''}</TableCell>
                                <TableCell className="text-right tabular-nums">{s.approved_competencies}</TableCell>
                                <TableCell className="text-right tabular-nums">{s.base_ready_competencies}</TableCell>
                                <TableCell className="text-right tabular-nums">{s.quality_assured_competencies}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </div>

                {d.note && <div className="text-[11px] text-gray-400">{d.note}</div>}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function DeltaStat({ label, v }: { label: string; v: number }) {
  const tone = v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : 'text-gray-500';
  return (
    <div className="rounded-lg border bg-white p-2 text-center">
      <div className={`text-lg font-bold ${tone}`}>{v > 0 ? `+${v}` : v}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}

function ProgressRow({ label, value, target, met, suffix, remaining }: { label: string; value: number; target: number; met: boolean; suffix?: string; remaining?: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-800">{label}</span>
        <span className="tabular-nums text-gray-600">
          {value}{suffix || ''} / {target}{suffix || ''}
          {met
            ? <Badge className="ml-2 bg-green-600 text-[10px]">met</Badge>
            : <span className="ml-2 text-xs text-amber-600">{remaining}</span>}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: met ? '#16a34a' : '#d97706' }} />
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
