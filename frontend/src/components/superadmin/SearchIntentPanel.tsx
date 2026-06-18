import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Download, Loader2, AlertTriangle, CheckCircle2, XCircle,
  Eye, X, Layers, Copy, Gauge,
} from 'lucide-react';

type Stakeholder = 'student' | 'parent' | 'teacher' | 'counselor' | 'professional';
type IntentType = 'informational' | 'diagnostic' | 'emotional' | 'help_seeking' | 'future_planning';

interface ValidatorResult { rate: number; target: number; pass: boolean }
interface Stats {
  generated_at: string;
  totals: { intents: number; clusters: number; duplicate_reviews: number; archetypes: number };
  coverage: { fully_covered: number; archetypes: number };
  intent_distribution: Record<IntentType, number>;
  stakeholder_distribution: Record<Stakeholder, number>;
  quality_averages: { search_realism: number; human_language: number; archetype_alignment: number; intent_clarity: number; composite: number };
  duplicate_breakdown: { identical: number; semantic: number; stakeholder: number; redundant: number; variants: number };
  link_integrity: { linked: number; orphans: number };
  validation: {
    search_realism: ValidatorResult;
    archetype_alignment: ValidatorResult;
    duplicate_rate: ValidatorResult;
    intent_clarity: { rate: number };
  };
  discovery_readiness_score: number;
}

interface IntentRow {
  intent_id: number;
  archetype_key: string;
  archetype_name: string;
  problem_id: number;
  stakeholder_type: Stakeholder;
  intent_type: IntentType;
  search_phrase: string;
  realism_pass: boolean;
  aligned: boolean;
  intent_clear: boolean;
  is_duplicate: boolean;
  search_realism: number;
  human_language: number;
  archetype_alignment: number;
  intent_clarity: number;
  composite: number;
}
interface ArchetypeDetail { ok: boolean; archetype_key: string; archetype_name: string; intents: IntentRow[] }

async function getJSON(url: string) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

const INTENT_LABELS: Record<IntentType, string> = {
  informational: 'Informational',
  diagnostic: 'Diagnostic',
  emotional: 'Emotional',
  help_seeking: 'Help-Seeking',
  future_planning: 'Future-Planning',
};
const STAKEHOLDER_LABELS: Record<Stakeholder, string> = {
  student: 'Student', parent: 'Parent', teacher: 'Teacher', counselor: 'Counselor', professional: 'Professional',
};
const STAKEHOLDER_STYLE: Record<Stakeholder, string> = {
  student: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  parent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  teacher: 'bg-amber-50 text-amber-700 border-amber-200',
  counselor: 'bg-violet-50 text-violet-700 border-violet-200',
  professional: 'bg-blue-50 text-blue-700 border-blue-200',
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

function ValidatorCard({ label, sub, result, lessIsBetter }: { label: string; sub: string; result: ValidatorResult; lessIsBetter?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${result.pass ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</div>
        {result.pass ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
      </div>
      <div className={`mt-1 text-2xl font-black ${result.pass ? 'text-emerald-700' : 'text-rose-700'}`}>
        {(result.rate * 100).toFixed(1)}%
      </div>
      <div className="mt-0.5 text-xs text-slate-500">
        target {lessIsBetter ? '≤' : '≥'}{(result.target * 100).toFixed(0)}% · {sub}
      </div>
    </div>
  );
}

function Flags({ realism, aligned, clear, dup }: { realism: boolean; aligned: boolean; clear: boolean; dup: boolean }) {
  return (
    <span className="ml-2 inline-flex gap-1 align-middle">
      {!realism && <span title="fails search realism (jargon / length)" className="rounded bg-rose-100 px-1 text-[9px] font-bold text-rose-700">UNREAL</span>}
      {!aligned && <span title="does not touch the archetype lexicon" className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">OFF-LEXICON</span>}
      {!clear && <span title="intent is ambiguous" className="rounded bg-yellow-100 px-1 text-[9px] font-bold text-yellow-700">VAGUE</span>}
      {dup && <span title="redundant near-duplicate" className="rounded bg-orange-100 px-1 text-[9px] font-bold text-orange-700">DUP</span>}
    </span>
  );
}

function ArchetypeDrawer({ archetypeKey, onClose }: { archetypeKey: string; onClose: () => void }) {
  const detailQ = useQuery<ArchetypeDetail>({
    queryKey: ['search', 'archetype', archetypeKey],
    queryFn: () => getJSON(`/api/admin/pil/search/${encodeURIComponent(archetypeKey)}`),
  });
  const d = detailQ.data;
  const byIntent = (t: IntentType) => (d?.intents || []).filter((i) => i.intent_type === t);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8EBF4] bg-white px-5 py-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Search Intent</div>
            <h3 className="text-lg font-black text-[#1F2A44]">{d?.archetype_name || archetypeKey}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {detailQ.isLoading && (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        )}
        {detailQ.error && (
          <div className="m-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> Failed to load archetype intents.</div>
        )}

        {d && (
          <div className="space-y-6 p-5">
            {(Object.keys(INTENT_LABELS) as IntentType[]).map((t) => (
              <section key={t}>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#344E86]">
                  <Search className="h-3.5 w-3.5" /> {INTENT_LABELS[t]} ({byIntent(t).length})
                </div>
                <ul className="space-y-1.5">
                  {byIntent(t).map((i) => (
                    <li key={i.intent_id} className="rounded-lg border border-[#E8EBF4] bg-white px-3 py-2 text-sm text-[#1F2A44]">
                      <span className={`mr-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${STAKEHOLDER_STYLE[i.stakeholder_type]}`}>{STAKEHOLDER_LABELS[i.stakeholder_type]}</span>
                      “{i.search_phrase}”
                      <span className="ml-2 text-[10px] font-bold text-slate-400">{i.composite?.toFixed?.(1) ?? i.composite}/5</span>
                      <Flags realism={i.realism_pass} aligned={i.aligned} clear={i.intent_clear} dup={i.is_duplicate} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchIntentPanel() {
  const [stakeFilter, setStakeFilter] = useState<'' | Stakeholder>('');
  const [selected, setSelected] = useState<string | null>(null);

  const statsQ = useQuery<{ ok: boolean; stats: Stats }>({
    queryKey: ['search', 'stats'],
    queryFn: () => getJSON('/api/admin/pil/search/stats'),
  });
  const intentsQ = useQuery<{ ok: boolean; intents: IntentRow[] }>({
    queryKey: ['search', 'intents'],
    queryFn: () => getJSON('/api/admin/pil/search/intents?limit=1000'),
  });
  const clustersQ = useQuery<{ ok: boolean; clusters: Array<{ cluster_key: string; cluster_label: string; intent_type: IntentType; member_count: number; avg_composite: number; sample_phrase: string }> }>({
    queryKey: ['search', 'clusters'],
    queryFn: () => getJSON('/api/admin/pil/search/clusters'),
  });

  const stats = statsQ.data?.stats;
  const intents = intentsQ.data?.intents || [];
  const clusters = clustersQ.data?.clusters || [];

  // group intents by archetype for the index table
  const byArchetype = new Map<string, { name: string; rows: IntentRow[] }>();
  for (const i of intents) {
    if (stakeFilter && i.stakeholder_type !== stakeFilter) continue;
    const e = byArchetype.get(i.archetype_key) || { name: i.archetype_name, rows: [] };
    e.rows.push(i);
    byArchetype.set(i.archetype_key, e);
  }
  const archetypes = [...byArchetype.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  const loading = statsQ.isLoading || intentsQ.isLoading;
  const error = statsQ.error || intentsQ.error;
  const drs = stats?.discovery_readiness_score ?? 0;
  const drsTone = drs >= 85 ? 'text-emerald-700' : drs >= 70 ? 'text-amber-600' : 'text-rose-700';

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FC] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Search className="h-5 w-5 text-[#344E86]" />
          <div>
            <h2 className="text-lg font-black text-[#1F2A44]">Search Intent</h2>
            <p className="text-xs text-slate-500">
              How each of the 22 archetypes is searched for — 5 stakeholders × 5 intent types, scored & linked to real problems.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['intents', 'clusters', 'duplicates'] as const).map((k) => (
            <a key={k} href={`/api/admin/pil/search/${k}.csv`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#344E86] px-3 py-1.5 text-xs font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white">
              <Download className="h-3.5 w-3.5" /> {k}
            </a>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading search intelligence…</div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4" /> Failed to load. Run the Phase-4 pipeline first.
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Search Intents" value={stats.totals.intents} sub={`${stats.coverage.fully_covered}/${stats.coverage.archetypes} archetypes with all 25`} />
            <StatCard label="Demand Clusters" value={stats.totals.clusters} sub="archetype × intent type" />
            <StatCard label="Avg Composite" value={`${stats.quality_averages.composite.toFixed(2)}/5`} sub="quality across 4 scores" />
            <StatCard label="Orphan Links" value={stats.link_integrity.orphans} sub={`${stats.link_integrity.linked} linked to a problem`} tone={stats.link_integrity.orphans === 0 ? 'text-emerald-700' : 'text-rose-700'} />
          </div>

          {/* Discovery Readiness Score */}
          <div className="mt-4 rounded-xl border border-[#E8EBF4] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                <Gauge className="h-4 w-4 text-[#344E86]" /> Discovery Readiness Score
              </div>
              <div className={`text-3xl font-black ${drsTone}`}>{drs.toFixed(1)}<span className="text-base text-slate-400"> / 100</span></div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${drs >= 85 ? 'bg-emerald-500' : drs >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, drs)}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-slate-500">realism 25% · alignment 20% · clarity 15% · non-dup 15% · coverage 15% · link 10%</div>
          </div>

          {/* validators */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <ValidatorCard label="Search Realism" sub="how people really search" result={stats.validation.search_realism} />
            <ValidatorCard label="Archetype Alignment" sub="touches lay lexicon" result={stats.validation.archetype_alignment} />
            <ValidatorCard label="Duplicate Rate" sub="redundant phrasing only" result={stats.validation.duplicate_rate} lessIsBetter />
          </div>

          {/* distributions + duplicate breakdown */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#E8EBF4] bg-white p-3">
              <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">Intent Distribution</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {(Object.keys(INTENT_LABELS) as IntentType[]).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-md border border-[#E8EBF4] px-2 py-1">
                    {INTENT_LABELS[t]} <span className="font-bold text-[#344E86]">{stats.intent_distribution[t] || 0}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#E8EBF4] bg-white p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                <Copy className="h-3.5 w-3.5" /> Duplicate Review
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E8EBF4] px-2 py-1">Identical <span className="font-bold text-[#344E86]">{stats.duplicate_breakdown.identical}</span></span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E8EBF4] px-2 py-1">Semantic <span className="font-bold text-[#344E86]">{stats.duplicate_breakdown.semantic}</span></span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E8EBF4] px-2 py-1">Cross-audience <span className="font-bold text-[#344E86]">{stats.duplicate_breakdown.stakeholder}</span></span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2 py-1">Redundant (counted) <span className="font-bold text-orange-700">{stats.duplicate_breakdown.redundant}</span></span>
              </div>
            </div>
          </div>

          {/* top demand clusters */}
          {clusters.length > 0 && (
            <div className="mt-4 rounded-xl border border-[#E8EBF4] bg-white p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                <Layers className="h-3.5 w-3.5" /> Top Demand Clusters
              </div>
              <ul className="space-y-1">
                {clusters.slice(0, 8).map((c) => (
                  <li key={c.cluster_key} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 font-bold text-[#344E86]">{c.avg_composite.toFixed(2)}</span>
                    <span className="shrink-0 text-slate-500">{INTENT_LABELS[c.intent_type]}</span>
                    <span className="truncate text-slate-600">{c.cluster_label} — “{c.sample_phrase}”</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* archetype index */}
          <div className="mt-5 flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Archetypes ({archetypes.length})</div>
            <div className="flex items-center gap-1.5">
              {(['', 'student', 'parent', 'teacher', 'counselor', 'professional'] as const).map((s) => (
                <button key={s || 'all'} onClick={() => setStakeFilter(s)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-bold ${stakeFilter === s ? 'border-[#344E86] bg-[#344E86] text-white' : 'border-[#E8EBF4] bg-white text-slate-600 hover:border-[#344E86]'}`}>
                  {s ? STAKEHOLDER_LABELS[s] : 'all'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 overflow-hidden rounded-xl border border-[#E8EBF4] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EBF4] text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-2">Archetype</th>
                  <th className="px-4 py-2">Sample search</th>
                  <th className="px-4 py-2 w-20 text-center">Intents</th>
                  <th className="px-4 py-2 w-16 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {archetypes.map(([key, { name, rows }]) => (
                  <tr key={key} className="border-b border-[#F0F2F8] last:border-0 hover:bg-[#F7F8FC]">
                    <td className="px-4 py-2.5 font-bold text-[#1F2A44]">{name}</td>
                    <td className="px-4 py-2.5 text-slate-600">“{rows[0]?.search_phrase}”</td>
                    <td className="px-4 py-2.5 text-center font-bold text-[#344E86]">{rows.length}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setSelected(key)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E8EBF4] px-2 py-1 text-xs font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && <ArchetypeDrawer archetypeKey={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
