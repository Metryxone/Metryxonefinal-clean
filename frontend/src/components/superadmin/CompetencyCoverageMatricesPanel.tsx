import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Grid3x3, AlertTriangle, Info, CheckCircle2, Layers, ClipboardList, BarChart3 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const BRAND = { primary: '#344E86' };
const BASE = '/api/v2/competency-coverage-matrices';

type TypeRow = { type_key: string; label: string; count: number; pct: number | null };
type DomainRow = { domain_id: string; name: string; count: number; pct: number | null };
type Competency = {
  total_competencies: number | null;
  classified: number | null;
  coverage_pct: number | null;
  by_type: TypeRow[] | null;
  by_domain: DomainRow[] | null;
};
type AsmtTypeRow = { type_key: string; label: string; total: number | null; with_any_approved: number; assessment_ready: number; coverage_pct: number | null };
type ReadyRow = { competency_id: string; canonical_name: string | null; type_key: string | null; domain_id: string | null; approved_questions: number };
type Assessment = {
  genome_total: number | null;
  competencies_with_any_approved: number | null;
  competencies_assessment_ready: number | null;
  coverage_pct_any: number | null;
  coverage_pct_ready: number | null;
  threshold_min_questions: number;
  question_count_distribution: Array<{ at_least: number; competencies: number }> | null;
  by_type: AsmtTypeRow[] | null;
  ready_list: ReadyRow[] | null;
  bank_context: { distinct_bank_codes: number | null; total_templates: number | null; by_status: Array<{ status: string; count: number }> | null; note: string } | null;
};
type BenchTypeRow = { type_key: string; label: string; total: number | null; benchmarked: number; coverage_pct: number | null };
type BenchDomainRow = { domain_id: string; name: string; total: number | null; benchmarked: number; coverage_pct: number | null };
type Benchmark = {
  genome_total: number | null;
  competencies_with_benchmark: number | null;
  competencies_benchmark_ready: number | null;
  competencies_suppressed_below_k: number | null;
  coverage_pct: number | null;
  total_benchmark_rows: number | null;
  distinct_cohorts: number | null;
  k_min: number;
  orphan_competency_ids: string[] | null;
  by_type: BenchTypeRow[] | null;
  by_domain: BenchDomainRow[] | null;
};
type Finding = { severity: 'info' | 'gap'; area: string; finding: string };
type Overview = {
  ok: boolean;
  overview: {
    headline: {
      competency_coverage_pct: number | null;
      assessment_coverage_pct: number | null;
      assessment_ready_count: number | null;
      benchmark_coverage_pct: number | null;
      genome_total: number | null;
    };
    competency: Competency;
    assessment: Assessment;
    benchmark: Benchmark;
    findings: Finding[];
    note: string;
  };
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  return res.json();
}

function pct(p: number | null | undefined): string {
  return p == null ? '—' : `${p}%`;
}

// null = missing/not-measurable → '—' (never coerce to 0).
function n(v: number | null | undefined): string {
  return v == null ? '—' : String(v);
}

function NotMeasurable({ label }: { label: string }) {
  return <div className="text-sm text-gray-400 italic">{label}: not measurable (source unavailable).</div>;
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: BRAND.primary }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function CoverageBar({ p }: { p: number | null }) {
  const width = p == null ? 0 : Math.max(0, Math.min(100, p));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden min-w-[60px]">
        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: BRAND.primary }} />
      </div>
      <span className="text-xs text-gray-600 w-12 text-right">{pct(p)}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2 mb-3">
      <Icon className="w-5 h-5 mt-0.5" style={{ color: BRAND.primary }} />
      <div>
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

export default function CompetencyCoverageMatricesPanel() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<Overview>({
    queryKey: [`${BASE}/overview`],
    queryFn: () => getJson<Overview>('/overview'),
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading coverage matrices…</div>;
  }
  if (isError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load coverage matrices: {(error as Error)?.message ?? 'unknown error'}
        </div>
      </div>
    );
  }

  const ov = data!.overview;
  const { headline, competency, assessment, benchmark, findings, note } = ov;

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3x3 className="w-6 h-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Competency Coverage Matrices</h2>
            <p className="text-sm text-gray-500">Read-only. Coverage (data exists) is reported separately from readiness / k-anonymity. Sparse cells &amp; authoring gaps are honest.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Headline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Genome competencies" value={headline.genome_total ?? '—'} />
        <StatCard label="Type-classified" value={pct(headline.competency_coverage_pct)} sub="competency coverage" />
        <StatCard label="Assessment coverage" value={pct(headline.assessment_coverage_pct)} sub="≥1 approved question" />
        <StatCard label="Assessment-ready" value={headline.assessment_ready_count ?? '—'} sub={`≥${assessment.threshold_min_questions} approved Q`} />
        <StatCard label="Benchmark coverage" value={pct(headline.benchmark_coverage_pct)} sub={`k_min=${benchmark.k_min}`} />
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <div className="space-y-2">
          {findings.map((f, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-md border p-3 text-sm ${f.severity === 'gap' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
              {f.severity === 'gap' ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
              <span><Badge variant="outline" className="mr-2 uppercase text-[10px]">{f.area}</Badge>{f.finding}</span>
            </div>
          ))}
        </div>
      )}

      {/* 1. Competency coverage */}
      <div>
        <SectionTitle icon={Layers} title="1. Competency coverage" sub={`${competency.classified ?? '—'} of ${competency.total_competencies ?? '—'} classified (${pct(competency.coverage_pct)})`} />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">By type</div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Type</TableHead><TableHead className="w-20 text-right">Count</TableHead><TableHead className="w-40">% of genome</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {competency.by_type == null ? (
                  <TableRow><TableCell colSpan={3} className="text-gray-400 italic">not measurable (source unavailable)</TableCell></TableRow>
                ) : competency.by_type.map((t) => (
                  <TableRow key={t.type_key}>
                    <TableCell className="font-medium">{t.label}{t.count === 0 && <Badge variant="outline" className="ml-2 text-[10px] text-amber-700 border-amber-300">gap</Badge>}</TableCell>
                    <TableCell className="text-right">{t.count}</TableCell>
                    <TableCell><CoverageBar p={t.pct} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">By domain</div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Domain</TableHead><TableHead className="w-20 text-right">Count</TableHead><TableHead className="w-40">% of genome</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {competency.by_domain == null ? (
                  <TableRow><TableCell colSpan={3} className="text-gray-400 italic">not measurable (source unavailable)</TableCell></TableRow>
                ) : competency.by_domain.map((d) => (
                  <TableRow key={d.domain_id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-right">{d.count}</TableCell>
                    <TableCell><CoverageBar p={d.pct} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* 2. Assessment coverage */}
      <div>
        <SectionTitle icon={ClipboardList} title="2. Assessment coverage (genome bridge)" sub={`${n(assessment.competencies_with_any_approved)}/${n(assessment.genome_total)} with ≥1 approved Q · ${n(assessment.competencies_assessment_ready)} assessment-ready (≥${assessment.threshold_min_questions})`} />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">Approved-question distribution</div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>At least N approved</TableHead><TableHead className="w-32 text-right">Competencies</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {assessment.question_count_distribution == null ? (
                  <TableRow><TableCell colSpan={2} className="text-gray-400 italic">not measurable (source unavailable)</TableCell></TableRow>
                ) : assessment.question_count_distribution.map((d) => (
                  <TableRow key={d.at_least}><TableCell>≥{d.at_least}</TableCell><TableCell className="text-right">{d.competencies}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-xs font-medium text-gray-500 mt-4 mb-1.5">By type</div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Type</TableHead><TableHead className="text-right w-16">Cov.</TableHead><TableHead className="text-right w-16">Total</TableHead><TableHead className="text-right w-16">Ready</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {assessment.by_type == null ? (
                  <TableRow><TableCell colSpan={4} className="text-gray-400 italic">not measurable (source unavailable)</TableCell></TableRow>
                ) : assessment.by_type.map((t) => (
                  <TableRow key={t.type_key}>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell className="text-right">{t.with_any_approved}</TableCell>
                    <TableCell className="text-right text-gray-500">{t.total ?? '—'}</TableCell>
                    <TableCell className="text-right">{t.assessment_ready}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">Assessment-ready / linked competencies</div>
            {(assessment.ready_list ?? []).length === 0 ? (
              <div className="text-sm text-gray-400 italic">No linked competencies.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Competency</TableHead><TableHead>Type</TableHead><TableHead className="text-right w-20">Approved Q</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(assessment.ready_list ?? []).map((r) => (
                    <TableRow key={r.competency_id}>
                      <TableCell className="font-medium">{r.canonical_name ?? r.competency_id}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{r.type_key ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {r.approved_questions}
                        {r.approved_questions >= assessment.threshold_min_questions && <CheckCircle2 className="inline w-3.5 h-3.5 ml-1 text-green-600" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {assessment.bank_context && (
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <div className="font-medium text-gray-700 mb-1">Bank context — DISJOINT namespace</div>
                <div>Distinct bank codes: <strong>{assessment.bank_context.distinct_bank_codes ?? '—'}</strong> · templates: <strong>{assessment.bank_context.total_templates ?? '—'}</strong>
                  {(assessment.bank_context.by_status ?? []).length > 0 && (
                    <> ({(assessment.bank_context.by_status ?? []).map((s) => `${s.status} ${s.count}`).join(', ')})</>
                  )}
                </div>
                <div className="mt-1 text-gray-500">{assessment.bank_context.note}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Benchmark coverage */}
      <div>
        <SectionTitle icon={BarChart3} title="3. Benchmark coverage" sub={`${n(benchmark.competencies_benchmark_ready)}/${n(benchmark.genome_total)} with a k-cleared benchmark (${pct(benchmark.coverage_pct)}) · ${n(benchmark.total_benchmark_rows)} rows / ${n(benchmark.distinct_cohorts)} cohorts · suppressed below k: ${n(benchmark.competencies_suppressed_below_k)} · orphans: ${benchmark.orphan_competency_ids == null ? '—' : benchmark.orphan_competency_ids.length}`} />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">By type</div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Type</TableHead><TableHead className="text-right w-20">Bench.</TableHead><TableHead className="text-right w-16">Total</TableHead><TableHead className="w-32">Coverage</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {benchmark.by_type == null ? (
                  <TableRow><TableCell colSpan={4} className="text-gray-400 italic">not measurable (source unavailable)</TableCell></TableRow>
                ) : benchmark.by_type.map((t) => (
                  <TableRow key={t.type_key}>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell className="text-right">{t.benchmarked}</TableCell>
                    <TableCell className="text-right text-gray-500">{t.total ?? '—'}</TableCell>
                    <TableCell><CoverageBar p={t.coverage_pct} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">By domain</div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Domain</TableHead><TableHead className="text-right w-20">Bench.</TableHead><TableHead className="text-right w-16">Total</TableHead><TableHead className="w-32">Coverage</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {benchmark.by_domain == null ? (
                  <TableRow><TableCell colSpan={4} className="text-gray-400 italic">not measurable (source unavailable)</TableCell></TableRow>
                ) : benchmark.by_domain.map((d) => (
                  <TableRow key={d.domain_id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-right">{d.benchmarked}</TableCell>
                    <TableCell className="text-right text-gray-500">{d.total ?? '—'}</TableCell>
                    <TableCell><CoverageBar p={d.coverage_pct} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 border-t pt-4">{note}</p>
    </div>
  );
}
