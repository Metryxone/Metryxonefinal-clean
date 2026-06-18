import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, Download, Loader2, AlertTriangle, RefreshCw, ShieldAlert,
  Copy, Activity, Archive, CheckCircle2, Grid3x3, CheckCircle, XCircle,
} from 'lucide-react';

type Status =
  | 'draft' | 'testing' | 'active'
  | 'candidate_for_retirement' | 'deprecated' | 'archived';

const STATUSES: Status[] = [
  'draft', 'testing', 'active', 'candidate_for_retirement', 'deprecated', 'archived',
];

const STATUS_STYLE: Record<Status, string> = {
  draft:                    'bg-slate-100 text-slate-600 border-slate-200',
  testing:                  'bg-amber-50 text-amber-700 border-amber-200',
  active:                   'bg-emerald-50 text-emerald-700 border-emerald-200',
  candidate_for_retirement: 'bg-orange-50 text-orange-700 border-orange-200',
  deprecated:               'bg-rose-50 text-rose-700 border-rose-200',
  archived:                 'bg-slate-200 text-slate-500 border-slate-300',
};

interface RegistryRow {
  question_id: string;
  question: string | null;
  master_bridge_tag: string | null;
  version: number;
  status: Status;
  quality_score: number | null;
  quality_overridden: boolean;
  usage_count: number;
  last_used_at: string | null;
  signal_value: number | null;
  report_impact: number | null;
  duplicate_of: string | null;
  duplicate_score: number | null;
  metrics_computed_at: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  review_notes: string | null;
}

interface GovernanceItem {
  question_id: string;
  question: string | null;
  master_bridge_tag: string | null;
  status: Status;
  quality_score: number | null;
  usage_count: number;
  signal_value: number | null;
  report_impact: number | null;
  duplicate_of: string | null;
  duplicate_score: number | null;
  reasons: string[];
}

interface Stats {
  total_questions: number;
  registered: number;
  status_counts: Record<Status, number>;
  metrics: {
    measured_usage: number;
    measured_signal: number;
    measured_report_impact: number;
    avg_quality: number | null;
    last_refreshed_at: string | null;
  };
  governance: {
    weak: number;
    duplicate: number;
    low_signal: number;
    dead_end: number;
    utility_mapped: boolean;
    human_retirement_candidates: number;
    suggested_for_review: number;
  };
  thresholds: { weak_quality: number; low_signal: number; semantic_duplicate: number };
}

interface DimensionCoverage {
  dimension: string;
  label: string;
  question_count: number;
  covered: boolean;
}

interface ConcernCoverage {
  concern_id: string;
  concern: string | null;
  master_bridge_tag: string | null;
  total_questions: number;
  classified_questions: number;
  unclassified_questions: number;
  covered_count: number;
  coverage_ratio: number;
  dimensions: DimensionCoverage[];
  gaps: string[];
}

interface CoverageStats {
  generated_at: string;
  total_questions: number;
  classified_questions: number;
  unclassified_questions: number;
  total_concerns: number;
  fully_covered_concerns: number;
  avg_coverage_ratio: number | null;
  dimension_distribution: Record<string, number>;
  method_distribution: Record<string, number>;
}

interface CoverageResponse {
  ok: boolean;
  generated_at: string;
  dimensions: Array<{ key: string; label: string }>;
  stats: CoverageStats;
  concerns: ConcernCoverage[];
}

async function getJSON(url: string) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

function num(n: number | null, digits = 2): string {
  return n === null || n === undefined ? '—' : Number(n).toFixed(digits);
}

function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#E8EBF4] bg-white p-4">
      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-black ${tone || 'text-[#344E86]'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${STATUS_STYLE[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

const PAGE_SIZE = 50;

export default function QuestionRegistryPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'governance' | 'registry' | 'coverage'>('governance');
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<RegistryRow | GovernanceItem | null>(null);

  const statsQ = useQuery<{ ok: boolean; stats: Stats }>({
    queryKey: ['qregistry', 'stats'],
    queryFn: () => getJSON('/api/admin/capadex/question-registry/stats'),
  });
  const govQ = useQuery<{
    ok: boolean; stats: Stats;
    weak: GovernanceItem[]; duplicate: GovernanceItem[];
    low_signal: GovernanceItem[]; dead_end: GovernanceItem[];
    retirement_candidates: GovernanceItem[];
  }>({
    queryKey: ['qregistry', 'governance'],
    queryFn: () => getJSON('/api/admin/capadex/question-registry/governance'),
    enabled: tab === 'governance',
  });
  const regParams = new URLSearchParams();
  if (statusFilter) regParams.set('status', statusFilter);
  if (search.trim()) regParams.set('q', search.trim());
  regParams.set('limit', String(PAGE_SIZE));
  regParams.set('offset', String(offset));
  const regQ = useQuery<{ ok: boolean; total: number; rows: RegistryRow[] }>({
    queryKey: ['qregistry', 'registry', statusFilter, search, offset],
    queryFn: () => getJSON(`/api/admin/capadex/question-registry/registry?${regParams.toString()}`),
    enabled: tab === 'registry',
  });
  const covQ = useQuery<CoverageResponse>({
    queryKey: ['qregistry', 'coverage'],
    queryFn: () => getJSON('/api/admin/capadex/question-registry/coverage'),
    enabled: tab === 'coverage',
  });

  const refreshM = useMutation({
    mutationFn: () => fetch('/api/admin/capadex/question-registry/refresh', {
      method: 'POST', credentials: 'include',
    }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qregistry'] });
    },
  });

  const transitionM = useMutation({
    mutationFn: (payload: { question_id: string; status: Status; review_notes?: string }) =>
      fetch(`/api/admin/capadex/question-registry/${encodeURIComponent(payload.question_id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: payload.status, review_notes: payload.review_notes }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['qregistry'] });
    },
  });

  const stats = statsQ.data?.stats || govQ.data?.stats;

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FC] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="h-5 w-5 text-[#344E86]" />
          <div>
            <h2 className="text-lg font-black text-[#1F2A44]">Question Registry &amp; Governance</h2>
            <p className="text-xs text-slate-500">
              Lifecycle tracking for the clarity-question bank. Status changes are human-only — nothing is auto-deprecated.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshM.mutate()}
            disabled={refreshM.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#344E86] px-3 py-1.5 text-xs font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white disabled:opacity-50"
          >
            {refreshM.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh metrics
          </button>
          <a
            href="/api/admin/capadex/question-registry/export.csv"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#344E86] px-3 py-1.5 text-xs font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        </div>
      </div>

      {refreshM.data?.ok && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Snapshotted {refreshM.data.total_clarity_questions?.toLocaleString()} questions ·
          measured usage {refreshM.data.metrics_measured?.usage}, signal {refreshM.data.metrics_measured?.signal},
          report impact {refreshM.data.metrics_measured?.report_impact}.
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Registered" value={stats.registered.toLocaleString()} sub={`${stats.total_questions.toLocaleString()} tracked`} />
            <StatCard label="Active" value={(stats.status_counts.active || 0).toLocaleString()} tone="text-emerald-600" />
            <StatCard label="Avg quality" value={num(stats.metrics.avg_quality)} sub="0–1 composite" />
            <StatCard label="Measured usage" value={stats.metrics.measured_usage.toLocaleString()} sub="≥1 response" />
            <StatCard label="Measured signal" value={stats.metrics.measured_signal.toLocaleString()} sub="from evidence" />
            <StatCard label="Retirement (human)" value={stats.governance.human_retirement_candidates}
              tone={stats.governance.human_retirement_candidates > 0 ? 'text-orange-600' : undefined} sub="marked for review" />
          </div>

          {/* lifecycle distribution */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E8EBF4] bg-white p-3 text-xs">
            <span className="font-black uppercase tracking-widest text-slate-400">Lifecycle</span>
            {STATUSES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <StatusBadge status={s} />
                <span className="font-bold text-slate-700">{(stats.status_counts[s] || 0).toLocaleString()}</span>
              </span>
            ))}
            {stats.metrics.last_refreshed_at && (
              <span className="ml-auto text-[11px] text-slate-400">
                metrics as of {new Date(stats.metrics.last_refreshed_at).toLocaleString()}
              </span>
            )}
          </div>
        </>
      )}

      {/* tab switcher */}
      <div className="mt-6 mb-3 flex gap-1">
        {(['governance', 'registry', 'coverage'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setOffset(0); }}
            className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize ${
              tab === t ? 'bg-[#344E86] text-white' : 'bg-white text-slate-500 border border-[#E8EBF4]'
            }`}
          >
            {t === 'governance' ? 'Governance dashboard' : t === 'registry' ? 'Full registry' : 'Behavioral coverage'}
          </button>
        ))}
      </div>

      {tab === 'governance' && (
        <GovernanceView
          q={govQ}
          thresholds={stats?.thresholds}
          onReview={(item) => setEditing(item)}
        />
      )}

      {tab === 'registry' && (
        <RegistryView
          q={regQ}
          statusFilter={statusFilter}
          setStatusFilter={(s) => { setStatusFilter(s); setOffset(0); }}
          search={search}
          setSearch={(s) => { setSearch(s); setOffset(0); }}
          offset={offset}
          setOffset={setOffset}
          onEdit={(row) => setEditing(row)}
        />
      )}

      {tab === 'coverage' && <CoverageView q={covQ} />}

      {editing && (
        <TransitionModal
          item={editing}
          pending={transitionM.isPending}
          error={transitionM.data && transitionM.data.ok === false ? transitionM.data.error : null}
          onClose={() => setEditing(null)}
          onSubmit={(status, notes) =>
            transitionM.mutate({ question_id: editing.question_id, status, review_notes: notes })}
        />
      )}
    </div>
  );
}

function GovernanceView({
  q, thresholds, onReview,
}: {
  q: ReturnType<typeof useQuery<any>>;
  thresholds?: Stats['thresholds'];
  onReview: (item: GovernanceItem) => void;
}) {
  if (q.isLoading) {
    return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading governance…</div>;
  }
  if (q.error) {
    return <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> Failed to load. Try “Refresh metrics”.</div>;
  }
  const d = q.data;
  const buckets: Array<{ key: string; title: string; desc: string; icon: any; tone: string; items: GovernanceItem[] }> = [
    { key: 'weak', title: 'Weak questions', desc: `quality < ${thresholds?.weak_quality ?? 0.45}`, icon: ShieldAlert, tone: 'text-amber-600', items: d?.weak || [] },
    { key: 'duplicate', title: 'Duplicate questions', desc: `≥ ${thresholds?.semantic_duplicate ?? 0.82} overlap within bridge tag`, icon: Copy, tone: 'text-rose-600', items: d?.duplicate || [] },
    { key: 'low_signal', title: 'Low-signal questions', desc: `signal < ${thresholds?.low_signal ?? 0.3}, or never asked`, icon: Activity, tone: 'text-blue-600', items: d?.low_signal || [] },
    { key: 'dead_end', title: 'Dead-end questions', desc: 'answer reaches no intervention (chain breaks upstream)', icon: XCircle, tone: 'text-rose-600', items: d?.dead_end || [] },
    { key: 'retirement', title: 'Retirement candidates', desc: 'human-marked + suggested (review required)', icon: Archive, tone: 'text-orange-600', items: d?.retirement_candidates || [] },
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 text-[11px] text-blue-700">
        These are triage lists, not actions. Questions are <strong>never auto-deprecated</strong> — open one and set a new lifecycle status to record a human decision.
      </div>
      {buckets.map((b) => (
        <div key={b.key} className="rounded-xl border border-[#E8EBF4] bg-white">
          <div className="flex items-center gap-2 border-b border-[#EEF1F8] px-4 py-2.5">
            <b.icon className={`h-4 w-4 ${b.tone}`} />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">{b.title}</span>
            <span className="text-xs text-slate-400">{b.desc}</span>
            <span className="ml-auto text-xs font-bold text-slate-600">{b.items.length}</span>
          </div>
          {b.items.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">None.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-[#EEF1F8]">
              {b.items.map((it) => (
                <div key={it.question_id} className="flex items-start gap-3 px-4 py-2 hover:bg-[#F7F8FC]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#1F2A44]">{it.question_id}</span>
                      <StatusBadge status={it.status} />
                      {it.master_bridge_tag && <span className="font-mono text-[10px] text-slate-400">{it.master_bridge_tag}</span>}
                    </div>
                    {it.question && <div className="mt-0.5 truncate text-xs text-slate-600">{it.question}</div>}
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {it.reasons.join(' · ')}
                      {'  ·  '}q {num(it.quality_score)} · use {it.usage_count} · sig {num(it.signal_value)} · impact {num(it.report_impact)}
                    </div>
                  </div>
                  <button
                    onClick={() => onReview(it)}
                    className="shrink-0 rounded-md border border-[#344E86] px-2 py-1 text-[10px] font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function coverageTone(ratio: number): string {
  if (ratio >= 0.7) return 'text-emerald-600';
  if (ratio >= 0.4) return 'text-amber-600';
  return 'text-rose-600';
}

function CoverageView({ q }: { q: ReturnType<typeof useQuery<CoverageResponse>> }) {
  if (q.isLoading) {
    return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Analysing behavioural coverage…</div>;
  }
  if (q.error) {
    return <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> Failed to load coverage. Try “Refresh metrics”.</div>;
  }
  const d = q.data;
  if (!d) return null;
  const dims = d.dimensions;
  const s = d.stats;
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 text-[11px] text-blue-700">
        CAPADEX investigates each concern across <strong>10 behavioural dimensions</strong>. A question with no recognisable
        dimension is left <strong>unclassified</strong> (never force-tagged); a dimension with zero questions is a real
        <strong> gap</strong>, surfaced for human authoring — nothing is fabricated.
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Concerns" value={s.total_concerns.toLocaleString()} sub="grouped" />
        <StatCard label="Fully covered" value={s.fully_covered_concerns.toLocaleString()} tone="text-emerald-600" sub="all 10 dims" />
        <StatCard label="Avg coverage" value={s.avg_coverage_ratio === null ? '—' : `${Math.round(s.avg_coverage_ratio * 100)}%`} sub="of 10 dims" />
        <StatCard label="Classified Qs" value={s.classified_questions.toLocaleString()} sub={`${s.total_questions.toLocaleString()} total`} />
        <StatCard label="Unclassified" value={s.unclassified_questions.toLocaleString()}
          tone={s.unclassified_questions > 0 ? 'text-amber-600' : undefined} sub="no dimension" />
        <StatCard label="Dimensions" value={dims.length} sub="probed per concern" />
      </div>

      {/* dimension distribution */}
      <div className="rounded-xl border border-[#E8EBF4] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-[#344E86]" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">Dimension distribution</span>
          <span className="text-xs text-slate-400">primary-dimension question counts across the whole bank</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {dims.map((dim) => {
            const count = s.dimension_distribution[dim.key] ?? 0;
            return (
              <div key={dim.key} className="rounded-lg border border-[#EEF1F8] bg-[#F7F8FC] p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{dim.label}</div>
                <div className={`mt-0.5 text-lg font-black ${count > 0 ? 'text-[#344E86]' : 'text-rose-500'}`}>
                  {count.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* per-concern coverage grid */}
      <div className="overflow-hidden rounded-xl border border-[#E8EBF4] bg-white">
        <div className="flex items-center gap-2 border-b border-[#EEF1F8] px-4 py-2.5">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">Coverage by concern</span>
          <span className="text-xs text-slate-400">worst-covered first</span>
          <a
            href="/api/admin/capadex/question-registry/coverage.csv"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[#344E86] px-2 py-1 text-[10px] font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white"
          >
            <Download className="h-3 w-3" /> CSV
          </a>
        </div>
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#F2F4FA] text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Concern</th>
                <th className="px-3 py-2 text-right">Qs</th>
                <th className="px-3 py-2 text-right">Cov</th>
                {dims.map((dim) => (
                  <th key={dim.key} className="px-1.5 py-2 text-center" title={dim.label}>
                    {dim.label.split(' ').map((w) => w[0]).join('')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F8]">
              {d.concerns.map((c) => (
                <tr key={c.concern_id} className="hover:bg-[#F7F8FC]">
                  <td className="px-3 py-1.5">
                    <div className="max-w-xs truncate font-bold text-[#1F2A44]" title={c.concern || c.concern_id}>
                      {c.concern || c.concern_id}
                    </div>
                    {c.master_bridge_tag && <div className="font-mono text-[10px] text-slate-400">{c.master_bridge_tag}</div>}
                    {c.unclassified_questions > 0 && (
                      <div className="text-[10px] text-amber-600">{c.unclassified_questions} unclassified</div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{c.total_questions}</td>
                  <td className={`px-3 py-1.5 text-right font-black ${coverageTone(c.coverage_ratio)}`}>
                    {c.covered_count}/10
                  </td>
                  {dims.map((dim) => {
                    const cell = c.dimensions.find((x) => x.dimension === dim.key);
                    const covered = cell?.covered;
                    return (
                      <td key={dim.key} className="px-1.5 py-1.5 text-center" title={`${dim.label}: ${cell?.question_count ?? 0} questions`}>
                        {covered
                          ? <CheckCircle className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                          : <XCircle className="mx-auto h-3.5 w-3.5 text-rose-300" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.concerns.length === 0 && <div className="p-4 text-center text-xs text-slate-400">No concerns. Run “Refresh metrics” to backfill.</div>}
      </div>
    </div>
  );
}

function RegistryView({
  q, statusFilter, setStatusFilter, search, setSearch, offset, setOffset, onEdit,
}: {
  q: ReturnType<typeof useQuery<any>>;
  statusFilter: '' | Status;
  setStatusFilter: (s: '' | Status) => void;
  search: string;
  setSearch: (s: string) => void;
  offset: number;
  setOffset: (n: number) => void;
  onEdit: (row: RegistryRow) => void;
}) {
  const total = q.data?.total ?? 0;
  const rows: RegistryRow[] = q.data?.rows || [];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search id or text…"
          className="rounded-md border border-[#E8EBF4] px-2.5 py-1.5 text-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | Status)}
          className="rounded-md border border-[#E8EBF4] px-2 py-1.5 text-xs"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <span className="ml-auto text-xs text-slate-500">{total.toLocaleString()} rows</span>
      </div>

      {q.isLoading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {q.error && <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> Failed to load.</div>}

      <div className="overflow-hidden rounded-xl border border-[#E8EBF4] bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F2F4FA] text-[10px] font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">v</th>
              <th className="px-3 py-2 text-right">Quality</th>
              <th className="px-3 py-2 text-right">Usage</th>
              <th className="px-3 py-2 text-right">Signal</th>
              <th className="px-3 py-2 text-right">Impact</th>
              <th className="px-3 py-2">Dup</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF1F8]">
            {rows.map((r) => (
              <tr key={r.question_id} className="hover:bg-[#F7F8FC]">
                <td className="px-3 py-1.5">
                  <div className="font-mono font-bold text-[#1F2A44]">{r.question_id}</div>
                  {r.question && <div className="max-w-md truncate text-[11px] text-slate-500">{r.question}</div>}
                </td>
                <td className="px-3 py-1.5"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-1.5 text-right">{r.version}</td>
                <td className="px-3 py-1.5 text-right">
                  {num(r.quality_score)}{r.quality_overridden && <span title="human override" className="text-[#344E86]">*</span>}
                </td>
                <td className="px-3 py-1.5 text-right">{r.usage_count.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right">{num(r.signal_value)}</td>
                <td className="px-3 py-1.5 text-right">{num(r.report_impact)}</td>
                <td className="px-3 py-1.5">
                  {r.duplicate_score !== null
                    ? <span className="text-rose-600" title={r.duplicate_of || ''}>{num(r.duplicate_score)}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    onClick={() => onEdit(r)}
                    className="rounded-md border border-[#344E86] px-2 py-0.5 text-[10px] font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !q.isLoading && <div className="p-4 text-center text-xs text-slate-400">No rows. Run “Refresh metrics” to backfill the registry.</div>}
      </div>

      {/* pagination */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <button
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          className="rounded-md border border-[#E8EBF4] px-3 py-1 font-bold text-slate-600 disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-slate-500">
          {total === 0 ? '0' : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)}`} of {total.toLocaleString()}
        </span>
        <button
          disabled={offset + PAGE_SIZE >= total}
          onClick={() => setOffset(offset + PAGE_SIZE)}
          className="rounded-md border border-[#E8EBF4] px-3 py-1 font-bold text-slate-600 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function TransitionModal({
  item, pending, error, onClose, onSubmit,
}: {
  item: RegistryRow | GovernanceItem;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (status: Status, notes: string) => void;
}) {
  const [status, setStatus] = useState<Status>(item.status);
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[#E8EBF4] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-black text-[#1F2A44]">Change lifecycle status</h3>
        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{item.question_id}</p>
        {item.question && <p className="mt-1 text-xs text-slate-600">{item.question}</p>}

        <div className="mt-4">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">New status</label>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-md border px-2 py-1.5 text-[11px] font-bold capitalize ${
                  status === s ? STATUS_STYLE[s] + ' ring-2 ring-[#344E86]' : 'border-[#E8EBF4] bg-white text-slate-500'
                }`}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Review note</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Why is this changing? (recorded in the audit trail)"
            className="mt-1.5 w-full rounded-md border border-[#E8EBF4] px-2.5 py-1.5 text-xs"
          />
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-[#E8EBF4] px-3 py-1.5 text-xs font-bold text-slate-500">Cancel</button>
          <button
            onClick={() => onSubmit(status, notes)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#344E86] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save status
          </button>
        </div>
      </div>
    </div>
  );
}
