import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Map, Download, Loader2, AlertTriangle, CheckCircle2, ArrowRight, Layers,
  Eye, X,
} from 'lucide-react';

type Route = 'covered_self' | 'override' | 'keyword' | 'general' | 'none';
type Tier = 1 | 2 | 3;

interface RegistryRow {
  bridge_tag: string;
  question_count: number;
  concern_count: number;
  coverage_status: 'covered' | 'uncovered';
  runtime_remap_target: string | null;
  runtime_route: Route;
  in_covered_set: boolean;
}

interface RecoveryRow {
  bridge_tag: string;
  concern_count: number;
  cluster_count: number;
  remap_target: string | null;
  remap_route: Route;
  tier: Tier;
  hypothesis_profile: {
    modal_persona: string | null;
    modal_cluster: string | null;
    domains: string[];
    severity_mix: Record<string, number>;
    top_priority: string | null;
  };
  behavioral_intent: string;
  root_cause_categories: string[];
  signal_clusters: string[];
  estimated_question_inventory: number;
  sample_concerns: string[];
}

interface Stats {
  generated_at: string;
  total_bridge_tags: number;
  covered_tags: number;
  uncovered_tags: number;
  remap_routes: Record<Route, number>;
  general_concern_dependent_tags: number;
  total_questions_existing: number;
  estimated_questions_required: number;
  tier_counts: Record<Tier, number>;
  covered_set_size: number;
}

async function getJSON(url: string) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

const ROUTE_STYLE: Record<Route, { bg: string; label: string }> = {
  covered_self: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Covered' },
  override:     { bg: 'bg-blue-50 text-blue-700 border-blue-200',          label: 'Sibling (override)' },
  keyword:      { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',    label: 'Sibling (keyword)' },
  general:      { bg: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'GENERAL_CONCERN' },
  none:         { bg: 'bg-rose-50 text-rose-700 border-rose-200',          label: 'Unresolved' },
};

const TIER_META: Record<Tier, { label: string; desc: string; bg: string }> = {
  1: { label: 'Tier 1', desc: 'Still routes to GENERAL_CONCERN — highest priority', bg: 'border-amber-300 bg-amber-50' },
  2: { label: 'Tier 2', desc: 'Sibling remap, real volume (≥2 concerns)',           bg: 'border-blue-200 bg-blue-50/40' },
  3: { label: 'Tier 3', desc: 'Low-volume sibling remap (1 concern)',               bg: 'border-slate-200 bg-slate-50' },
};

function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#E8EBF4] bg-white p-4">
      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-black ${tone || 'text-[#344E86]'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function RouteBadge({ route }: { route: Route }) {
  const s = ROUTE_STYLE[route];
  return <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${s.bg}`}>{s.label}</span>;
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm text-[#1F2A44] ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</div>
    </div>
  );
}

interface TagDetail {
  ok: boolean;
  bridge_tag: string;
  registry: RegistryRow;
  recovery: RecoveryRow | null;
}

function TagDetailDrawer({ tag, onClose }: { tag: string; onClose: () => void }) {
  const detailQ = useQuery<TagDetail>({
    queryKey: ['coverage', 'tag', tag],
    queryFn: () => getJSON(`/api/admin/capadex/coverage/tag/${encodeURIComponent(tag)}`),
  });
  const reg = detailQ.data?.registry;
  const rec = detailQ.data?.recovery;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[#E8EBF4] bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-[#344E86]" />
            <span className="font-mono text-sm font-black text-[#1F2A44]">{tag}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/admin/capadex/coverage/tag/${encodeURIComponent(tag)}/export.csv`}
              className="inline-flex items-center gap-1 rounded-md border border-[#344E86] px-2.5 py-1 text-[11px] font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white"
            >
              <Download className="h-3 w-3" /> Export CSV
            </a>
            <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {detailQ.isLoading && (
          <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {detailQ.error && (
          <div className="m-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4" /> Failed to load detail.
          </div>
        )}

        {reg && (
          <div className="space-y-5 p-5">
            <div className="rounded-xl border border-[#E8EBF4] p-4">
              <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Coverage</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Status" value={
                  reg.coverage_status === 'covered'
                    ? <span className="font-bold text-emerald-600">covered</span>
                    : <span className="font-bold text-blue-600">uncovered</span>} />
                <Field label="In covered set" value={reg.in_covered_set ? 'yes' : 'no'} />
                <Field label="Clarity questions" value={reg.question_count.toLocaleString()} />
                <Field label="Master concerns" value={reg.concern_count} />
                <Field label="Runtime route" value={<RouteBadge route={reg.runtime_route} />} />
                <Field label="Runtime target" value={reg.runtime_remap_target || '—'} mono />
              </div>
            </div>

            {rec ? (
              <div className="rounded-xl border border-[#E8EBF4] p-4">
                <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Recovery profile · Tier {rec.tier}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Remap target" value={rec.remap_target || '—'} mono />
                  <Field label="Remap route" value={<RouteBadge route={rec.remap_route} />} />
                  <Field label="Cluster count" value={rec.cluster_count} />
                  <Field label="Est. questions to author" value={rec.estimated_question_inventory} />
                  <Field label="Modal persona" value={rec.hypothesis_profile.modal_persona || '—'} />
                  <Field label="Modal cluster" value={rec.hypothesis_profile.modal_cluster || '—'} />
                  <Field label="Top priority" value={rec.hypothesis_profile.top_priority || '—'} />
                </div>
                <div className="mt-4 space-y-3">
                  <Field label="Behavioral intent" value={rec.behavioral_intent} />
                  <Field label="Domains" value={rec.hypothesis_profile.domains.join(', ') || '—'} />
                  <Field label="Root cause categories" value={rec.root_cause_categories.join(', ') || '—'} />
                  <Field label="Signal clusters" value={rec.signal_clusters.join(', ') || '—'} />
                  <Field label="Sample concerns" value={rec.sample_concerns.join(', ') || '—'} />
                  <Field
                    label="Severity mix"
                    value={Object.entries(rec.hypothesis_profile.severity_mix)
                      .map(([k, n]) => `${k}: ${n}`).join('  ·  ') || '—'}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
                This bridge tag is covered by its own curated clarity bank — no recovery profile needed.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CoverageDashboardPanel() {
  const [registryFilter, setRegistryFilter] = useState<'all' | 'covered' | 'uncovered'>('uncovered');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const statsQ = useQuery<{ ok: boolean; stats: Stats }>({
    queryKey: ['coverage', 'stats'],
    queryFn: () => getJSON('/api/admin/capadex/coverage/stats'),
  });
  const registryQ = useQuery<{ ok: boolean; registry: RegistryRow[] }>({
    queryKey: ['coverage', 'registry'],
    queryFn: () => getJSON('/api/admin/capadex/coverage/registry'),
  });
  const roadmapQ = useQuery<{ ok: boolean; roadmap: RecoveryRow[] }>({
    queryKey: ['coverage', 'roadmap'],
    queryFn: () => getJSON('/api/admin/capadex/coverage/roadmap'),
  });

  const stats = statsQ.data?.stats;
  const registry = registryQ.data?.registry || [];
  const roadmap = roadmapQ.data?.roadmap || [];
  const filteredRegistry = registry.filter((r) =>
    registryFilter === 'all' ? true : r.coverage_status === registryFilter);

  const loading = statsQ.isLoading || registryQ.isLoading || roadmapQ.isLoading;
  const error = statsQ.error || registryQ.error || roadmapQ.error;

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FC] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Map className="h-5 w-5 text-[#344E86]" />
          <div>
            <h2 className="text-lg font-black text-[#1F2A44]">Bridge-Tag Coverage</h2>
            <p className="text-xs text-slate-500">
              Clarity-question coverage of concern bridge tags, runtime remap routing & recovery roadmap.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/admin/capadex/coverage/registry.csv"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#344E86] bg-[#344E86] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a3f6d]"
          >
            <Download className="h-3.5 w-3.5" /> Export registry CSV
          </a>
          <a
            href="/api/admin/capadex/coverage/roadmap.csv"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#344E86] px-3 py-1.5 text-xs font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Export roadmap CSV
          </a>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Computing coverage…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4" /> Failed to load coverage data.
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Bridge tags" value={stats.total_bridge_tags} sub="master ∪ clarity" />
            <StatCard label="Covered" value={stats.covered_tags} tone="text-emerald-600"
              sub={`${stats.total_questions_existing.toLocaleString()} questions`} />
            <StatCard label="Uncovered" value={stats.uncovered_tags} tone="text-blue-600" sub="remapped to siblings" />
            <StatCard label="→ GENERAL_CONCERN" value={stats.general_concern_dependent_tags}
              tone={stats.general_concern_dependent_tags === 0 ? 'text-emerald-600' : 'text-amber-600'}
              sub="generic catch-all" />
            <StatCard label="Est. questions to author" value={stats.estimated_questions_required.toLocaleString()}
              sub="for full coverage" />
            <StatCard label="Curated buckets" value={stats.covered_set_size} sub="canonical covered set" />
          </div>

          {/* remap route breakdown */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E8EBF4] bg-white p-3 text-xs">
            <span className="font-black uppercase tracking-widest text-slate-400">Uncovered routing</span>
            {(['override', 'keyword', 'general', 'none'] as Route[]).map((r) => (
              <span key={r} className="inline-flex items-center gap-1.5">
                <RouteBadge route={r} />
                <span className="font-bold text-slate-700">{stats.remap_routes[r] || 0}</span>
              </span>
            ))}
            {stats.general_concern_dependent_tags === 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Zero tags fall back to GENERAL_CONCERN
              </span>
            )}
          </div>
        </>
      )}

      {/* Tiered recovery roadmap */}
      {roadmap.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <Layers className="h-4 w-4" /> Recovery roadmap ({roadmap.length} uncovered tags)
          </h3>
          {([1, 2, 3] as Tier[]).map((tier) => {
            const rows = roadmap.filter((r) => r.tier === tier);
            if (rows.length === 0) return null;
            const meta = TIER_META[tier];
            return (
              <div key={tier} className={`mb-4 rounded-xl border ${meta.bg} p-3`}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-sm font-black text-[#1F2A44]">{meta.label}</span>
                  <span className="text-xs text-slate-500">{meta.desc}</span>
                  <span className="ml-auto text-xs font-bold text-slate-600">{rows.length} tags</span>
                </div>
                <div className="space-y-2">
                  {rows.map((r) => (
                    <div key={r.bridge_tag} className="rounded-lg border border-[#E8EBF4] bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#1F2A44]">{r.bridge_tag}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="font-mono text-xs font-bold text-[#344E86]">{r.remap_target || '—'}</span>
                        <RouteBadge route={r.remap_route} />
                        <span className="ml-auto text-[11px] text-slate-500">
                          {r.concern_count} concern{r.concern_count === 1 ? '' : 's'} · {r.cluster_count} cluster{r.cluster_count === 1 ? '' : 's'}
                          {' · est. '}<span className="font-bold text-slate-700">{r.estimated_question_inventory}</span> Q
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs text-slate-600">{r.behavioral_intent}</div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        {r.hypothesis_profile.modal_persona && (
                          <span><span className="font-semibold text-slate-600">Persona:</span> {r.hypothesis_profile.modal_persona}</span>
                        )}
                        {r.hypothesis_profile.domains.length > 0 && (
                          <span><span className="font-semibold text-slate-600">Domains:</span> {r.hypothesis_profile.domains.slice(0, 3).join(', ')}</span>
                        )}
                        {r.root_cause_categories.length > 0 && (
                          <span><span className="font-semibold text-slate-600">Root causes:</span> {r.root_cause_categories.slice(0, 3).join(', ')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full registry */}
      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Registry</h3>
          <div className="ml-auto flex gap-1">
            {(['uncovered', 'covered', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setRegistryFilter(f)}
                className={`rounded-md px-2 py-1 text-[11px] font-bold capitalize ${
                  registryFilter === f ? 'bg-[#344E86] text-white' : 'bg-white text-slate-500 border border-[#E8EBF4]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#E8EBF4] bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F2F4FA] text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Bridge tag</th>
                <th className="px-3 py-2 text-right">Questions</th>
                <th className="px-3 py-2 text-right">Concerns</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Runtime target</th>
                <th className="px-3 py-2">Route</th>
                <th className="px-3 py-2 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F8]">
              {filteredRegistry.map((r) => (
                <tr key={r.bridge_tag} className="hover:bg-[#F7F8FC]">
                  <td className="px-3 py-1.5 font-mono font-bold text-[#1F2A44]">{r.bridge_tag}</td>
                  <td className="px-3 py-1.5 text-right">{r.question_count.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right">{r.concern_count}</td>
                  <td className="px-3 py-1.5">
                    {r.coverage_status === 'covered'
                      ? <span className="font-bold text-emerald-600">covered</span>
                      : <span className="font-bold text-blue-600">uncovered</span>}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[#344E86]">{r.runtime_remap_target || '—'}</td>
                  <td className="px-3 py-1.5"><RouteBadge route={r.runtime_route} /></td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedTag(r.bridge_tag)}
                        title="View detail"
                        className="inline-flex items-center gap-1 rounded-md border border-[#E8EBF4] px-2 py-1 text-[10px] font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white"
                      >
                        <Eye className="h-3 w-3" /> View
                      </button>
                      <a
                        href={`/api/admin/capadex/coverage/tag/${encodeURIComponent(r.bridge_tag)}/export.csv`}
                        title="Export this row (detailed CSV)"
                        className="inline-flex items-center gap-1 rounded-md border border-[#E8EBF4] px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                      >
                        <Download className="h-3 w-3" /> Export
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRegistry.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-400">No rows.</div>
          )}
        </div>
      </div>

      {selectedTag && (
        <TagDetailDrawer tag={selectedTag} onClose={() => setSelectedTag(null)} />
      )}
    </div>
  );
}
