import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Network, Download, Loader2, AlertTriangle, CheckCircle2, RefreshCw, Search, Layers,
} from 'lucide-react';

type Band = 'strong' | 'moderate' | 'weak' | 'none';

interface Stats {
  generated_at: string;
  total_concerns: number;
  mapped_concerns: number;
  orphan_concerns: number;
  coverage_pct: number;
  tier3_mappings: number;
  atomic_mappings: number;
  composite_mappings: number;
  strong: number;
  moderate: number;
  weak: number;
  avg_confidence: number;
  by_band: Record<string, number>;
  by_method: Record<string, number>;
  by_tier: Record<string, number>;
}

interface RegistryRow {
  concern_pk: number;
  concern_id: string | null;
  display_label: string | null;
  domain: string | null;
  bridge_tag: string | null;
  tier3_count: number;
  composite_count: number;
  atomic_count: number;
  top_signal: string | null;
  coverage_confidence: number;
  coverage_band: Band;
  is_orphan: boolean;
}

interface ChainReport {
  generated_at: string;
  total_concerns: number;
  complete: number;
  orphan: number;
  breaks: Record<'signal' | 'composite' | 'pattern' | 'intervention', number>;
  signals_without_composite: string[];
  signals_without_intervention: string[];
}

const BASE = '/api/admin/capadex/concern-signal-map';

async function getJSON(url: string) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

const BAND_STYLE: Record<Band, string> = {
  strong: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  moderate: 'bg-blue-50 text-blue-700 border-blue-200',
  weak: 'bg-amber-50 text-amber-700 border-amber-200',
  none: 'bg-rose-50 text-rose-700 border-rose-200',
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

function BandBadge({ band }: { band: Band }) {
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${BAND_STYLE[band]}`}>
      {band}
    </span>
  );
}

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="text-slate-400">{value.toLocaleString()} · {pct}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ConcernSignalMapPanel() {
  const qc = useQueryClient();
  const [band, setBand] = useState<'all' | Band>('all');
  const [onlyOrphans, setOnlyOrphans] = useState(false);
  const [search, setSearch] = useState('');

  const statsQ = useQuery<{ ok: boolean; stats: Stats }>({
    queryKey: ['csm-stats'],
    queryFn: () => getJSON(`${BASE}/stats`),
  });
  const chainQ = useQuery<{ ok: boolean } & ChainReport>({
    queryKey: ['csm-chain'],
    queryFn: () => getJSON(`${BASE}/chain`),
  });
  const regParams = new URLSearchParams({ limit: '200' });
  if (band !== 'all') regParams.set('band', band);
  if (onlyOrphans) regParams.set('orphans', '1');
  if (search.trim()) regParams.set('q', search.trim());
  const regQ = useQuery<{ ok: boolean; total: number; registry: RegistryRow[] }>({
    queryKey: ['csm-registry', band, onlyOrphans, search],
    queryFn: () => getJSON(`${BASE}/registry?${regParams.toString()}`),
  });

  const rebuild = useMutation({
    mutationFn: () => fetch(`${BASE}/rebuild?mode=replace`, { method: 'POST', credentials: 'include' }).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csm-stats'] });
      qc.invalidateQueries({ queryKey: ['csm-chain'] });
      qc.invalidateQueries({ queryKey: ['csm-registry'] });
    },
  });

  const stats = statsQ.data?.stats;
  const chain = chainQ.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#344E86]">
            <Network className="h-5 w-5" />
            <h2 className="text-lg font-black uppercase tracking-widest">Concern → Signal Coverage</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Maps every concern in the Concerns Master to its Tier-3, composite and atomic signals, scores each
            mapping, and validates the Concern → Signal → Composite → Pattern → Intervention chain end-to-end.
            Orphans are flagged for review, never fabricated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${BASE}/export.csv`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8EBF4] bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <button
            onClick={() => rebuild.mutate()}
            disabled={rebuild.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#344E86] px-3 py-2 text-xs font-bold text-white hover:bg-[#2b4170] disabled:opacity-60"
          >
            {rebuild.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Rebuild mappings
          </button>
        </div>
      </div>

      {rebuild.isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          Rebuild failed. Check the Backend API logs.
        </div>
      )}

      {/* Stat cards */}
      {statsQ.isLoading ? (
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading coverage…</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Concerns" value={stats.total_concerns.toLocaleString()} sub="in Concerns Master" />
            <StatCard
              label="Mapped"
              value={`${stats.coverage_pct}%`}
              sub={`${stats.mapped_concerns.toLocaleString()} concerns`}
              tone="text-emerald-600"
            />
            <StatCard
              label="Orphans"
              value={stats.orphan_concerns.toLocaleString()}
              sub="no Tier-3 signal"
              tone={stats.orphan_concerns > 0 ? 'text-rose-600' : 'text-emerald-600'}
            />
            <StatCard label="Avg confidence" value={stats.avg_confidence.toFixed(2)} sub="Tier-3 mappings" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Band distribution */}
            <div className="rounded-xl border border-[#E8EBF4] bg-white p-4">
              <div className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Layers className="h-4 w-4" /> Confidence (Tier-3)
              </div>
              <div className="space-y-3">
                <Bar label="Strong" value={stats.strong} total={stats.tier3_mappings} tone="bg-emerald-500" />
                <Bar label="Moderate" value={stats.moderate} total={stats.tier3_mappings} tone="bg-blue-500" />
                <Bar label="Weak" value={stats.weak} total={stats.tier3_mappings} tone="bg-amber-500" />
              </div>
            </div>

            {/* Tier mix */}
            <div className="rounded-xl border border-[#E8EBF4] bg-white p-4">
              <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Mappings by tier</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Tier-3 (curated)</span><span className="font-bold text-[#344E86]">{stats.tier3_mappings.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Composite (derived)</span><span className="font-bold text-[#344E86]">{stats.composite_mappings.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Atomic (bridge-tag)</span><span className="font-bold text-[#344E86]">{stats.atomic_mappings.toLocaleString()}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-600">Orphans</span><span className="font-bold text-rose-600">{(stats.by_tier?.orphan || 0).toLocaleString()}</span></div>
              </div>
            </div>

            {/* Chain validation */}
            <div className="rounded-xl border border-[#E8EBF4] bg-white p-4">
              <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Chain validation</div>
              {chainQ.isLoading ? (
                <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Validating…</div>
              ) : chain ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Complete chains</span>
                    <span className="font-bold text-emerald-600">{chain.complete.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600"><AlertTriangle className="h-4 w-4 text-rose-500" /> Orphan (no signal)</span>
                    <span className="font-bold text-rose-600">{chain.orphan.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2 text-xs text-slate-500">
                    Breaks — composite {chain.breaks.composite} · pattern {chain.breaks.pattern} · intervention {chain.breaks.intervention}
                  </div>
                  {chain.signals_without_composite.length > 0 && (
                    <div className="text-[11px] text-amber-600">
                      {chain.signals_without_composite.length} signal(s) never reach a composite
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-rose-500">Validation unavailable.</div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Coverage data unavailable. Run the backfill (Rebuild mappings) and ensure the Backend API is running.
        </div>
      )}

      {/* Registry */}
      <div className="rounded-xl border border-[#E8EBF4] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EBF4] p-3">
          <div className="flex items-center gap-2">
            {(['all', 'strong', 'moderate', 'weak', 'none'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBand(b)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold capitalize ${band === b ? 'bg-[#344E86] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {b === 'none' ? 'orphan' : b}
              </button>
            ))}
            <label className="ml-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={onlyOrphans} onChange={(e) => setOnlyOrphans(e.target.checked)} />
              Orphans only
            </label>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search concern / signal / bridge tag"
              className="rounded-md border border-[#E8EBF4] py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#344E86]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-3 py-2">Concern</th>
                <th className="px-3 py-2">Bridge tag</th>
                <th className="px-3 py-2">Top signal</th>
                <th className="px-3 py-2 text-center">T3</th>
                <th className="px-3 py-2 text-center">Comp</th>
                <th className="px-3 py-2 text-center">Atom</th>
                <th className="px-3 py-2 text-center">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {regQ.isLoading ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : (regQ.data?.registry || []).length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No matching concerns.</td></tr>
              ) : (
                regQ.data!.registry.map((r) => (
                  <tr key={r.concern_pk} className="border-t border-slate-50 hover:bg-slate-50/60">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-700">{r.display_label || r.concern_id || `#${r.concern_pk}`}</div>
                      <div className="text-[10px] text-slate-400">{r.domain}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.bridge_tag}</td>
                    <td className="px-3 py-2 text-slate-600">{r.top_signal || <span className="text-rose-400">— orphan —</span>}</td>
                    <td className="px-3 py-2 text-center font-bold text-[#344E86]">{r.tier3_count}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{r.composite_count}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{r.atomic_count}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="tabular-nums text-slate-500">{r.coverage_confidence.toFixed(2)}</span>
                        <BandBadge band={r.coverage_band} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {regQ.data && (
          <div className="border-t border-[#E8EBF4] px-3 py-2 text-[11px] text-slate-400">
            Showing {regQ.data.registry.length.toLocaleString()} of {regQ.data.total.toLocaleString()} concerns
          </div>
        )}
      </div>
    </div>
  );
}
