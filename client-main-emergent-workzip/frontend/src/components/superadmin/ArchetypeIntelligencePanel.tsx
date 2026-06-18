import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Download, Loader2, AlertTriangle, CheckCircle2, Eye, X,
  ShieldCheck, RotateCcw, Trash2, ArrowRightLeft, Inbox, Gauge, Sparkles,
} from 'lucide-react';

type Status = 'strong' | 'moderate' | 'weak';
type Grounding = 'direct_cpb' | 'propagated' | 'name_only';

interface LibraryRow {
  archetype_key: string;
  archetype_name: string;
  definition: string;
  primary_behavior_category: string;
  stage_note: string;
  member_count: number;
  capability_count: number;
  problem_count: number;
  behavior_grounded_count: number;
  coherence: number | null;
  distinctiveness: number | null;
  validation_status: Status | null;
  notes: string | null;
  grounding_ceiling: number | null;
  weak_reason: string | null;
  stabilization_recommendation: string | null;
}
interface ConcernRow {
  concern_id: string;
  concern_name: string;
  canonical_type: string;
  archetype_key: string;
  assignment_score: number;
  token_matches: number;
  assignment_method: string;
  grounding_source: Grounding;
  governed: boolean;
}
interface UnmatchedRow {
  concern_id: string;
  concern_name: string;
  canonical_type: string;
  best_archetype_key: string;
  best_score: number;
  reason: string;
}
interface Stats {
  generated_at: string;
  total_concerns: number;
  assigned: number;
  unmatched: number;
  coverage: number;
  archetype_count: number;
  status_counts: Record<Status, number>;
  grounding: Record<Grounding, number>;
  relationship_grounding: number;
  mean_coherence: number;
  balance: number;
  similarity_capture: { evaluated: number; captured: number; ratio: number };
  readiness: number;
  governance: { active: number; reassign: number; reject: number; resolve_unmatched: number; approve: number };
  weak_archetypes: Array<{ archetype_key: string; archetype_name: string; member_count: number; coherence: number; notes: string; grounding_ceiling: number; weak_reason: string; stabilization_recommendation: string }>;
}
interface DecisionRecord {
  concern_id: string;
  decision_type: string;
  target_archetype_key: string | null;
  rationale: string;
  decided_by: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

const BASE = '/api/admin/pil/archetypes';

async function getJSON(url: string) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function sendJSON(url: string, method: string, body?: unknown) {
  const r = await fetch(url, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `${r.status}`);
  return data;
}

const STATUS_STYLE: Record<Status, string> = {
  strong: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  weak: 'bg-rose-50 text-rose-700 border-rose-200',
};
const GROUNDING_STYLE: Record<Grounding, { bg: string; label: string }> = {
  direct_cpb: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'direct' },
  propagated: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'propagated' },
  name_only: { bg: 'bg-slate-50 text-slate-600 border-slate-200', label: 'name-only' },
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
function StatusBadge({ status }: { status: Status | null }) {
  if (!status) return <span className="text-slate-300">—</span>;
  return <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${STATUS_STYLE[status]}`}>{status}</span>;
}
function GroundingBadge({ g }: { g: Grounding }) {
  const s = GROUNDING_STYLE[g];
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

/** Archetype detail drawer — definition, behavior profile, members + per-member reassign/reject. */
function ArchetypeDrawer({
  archKey, archetypeKeys, onClose, onMutate,
}: { archKey: string; archetypeKeys: { key: string; name: string }[]; onClose: () => void; onMutate: () => void }) {
  const detailQ = useQuery<{ ok: boolean; archetype: LibraryRow; behavior_profile: Array<{ behavior_category: string; behavior_count: number; pct: number }>; members: ConcernRow[]; member_sample_capped: boolean }>({
    queryKey: ['archetype', 'detail', archKey],
    queryFn: () => getJSON(`${BASE}/${encodeURIComponent(archKey)}`),
  });
  const arch = detailQ.data?.archetype;
  const members = detailQ.data?.members || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8EBF4] bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#344E86]" />
            <span className="font-mono text-sm font-black text-[#1F2A44]">{archKey}</span>
            {arch?.validation_status && <StatusBadge status={arch.validation_status} />}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>

        {detailQ.isLoading && <div className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
        {arch && (
          <div className="space-y-5 p-5">
            <div className="rounded-xl border border-[#E8EBF4] p-4">
              <div className="text-base font-black text-[#1F2A44]">{arch.archetype_name}</div>
              <div className="mt-1 text-sm text-slate-600">{arch.definition}</div>
              <div className="mt-3 grid grid-cols-3 gap-4">
                <Field label="Primary category" value={arch.primary_behavior_category} />
                <Field label="Members" value={arch.member_count} />
                <Field label="Behavior-grounded" value={`${arch.behavior_grounded_count}/${arch.member_count}`} />
                <Field label="Capabilities" value={arch.capability_count} />
                <Field label="Problems" value={arch.problem_count} />
                <Field label="Coherence" value={arch.coherence ?? '—'} />
                <Field label="Distinctiveness" value={arch.distinctiveness ?? '—'} />
                <Field label="Grounding ceiling" value={arch.grounding_ceiling ?? '—'} />
              </div>
              {arch.stage_note && <div className="mt-3"><Field label="Stage note" value={arch.stage_note} /></div>}
              {arch.notes && <div className="mt-3"><Field label="Validation notes" value={arch.notes} /></div>}
              {arch.weak_reason && <div className="mt-3"><Field label="Weak reason" value={arch.weak_reason} /></div>}
              {arch.stabilization_recommendation && arch.stabilization_recommendation !== 'none' && (
                <div className="mt-3"><Field label="Stabilization recommendation" value={arch.stabilization_recommendation} /></div>
              )}
            </div>

            {(detailQ.data?.behavior_profile?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-[#E8EBF4] p-4">
                <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Behavior profile</div>
                <div className="flex flex-wrap gap-2">
                  {detailQ.data!.behavior_profile.map((b) => (
                    <span key={b.behavior_category} className="rounded-md border border-[#E8EBF4] bg-[#F7F8FC] px-2 py-1 text-[11px]">
                      <span className="font-bold text-[#1F2A44]">{b.behavior_category}</span>
                      <span className="text-slate-500"> · {b.pct}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-[#E8EBF4]">
              <div className="flex items-center justify-between border-b border-[#E8EBF4] px-4 py-2.5">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Members ({members.length}{detailQ.data?.member_sample_capped ? '+' : ''})</div>
              </div>
              <div className="max-h-[40vh] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#F2F4FA] text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Concern</th>
                      <th className="px-3 py-2 text-right">Score</th>
                      <th className="px-3 py-2">Grounding</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2 text-right">Govern</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF1F8]">
                    {members.map((m) => (
                      <tr key={m.concern_id} className="hover:bg-[#F7F8FC]">
                        <td className="px-3 py-1.5">
                          <div className="font-semibold text-[#1F2A44]">{m.concern_name}</div>
                          <div className="font-mono text-[10px] text-slate-400">{m.concern_id} · {m.canonical_type}</div>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{m.assignment_score}</td>
                        <td className="px-3 py-1.5"><GroundingBadge g={m.grounding_source} /></td>
                        <td className="px-3 py-1.5">
                          {m.governed
                            ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700"><ShieldCheck className="h-3 w-3" />override</span>
                            : <span className="text-[10px] text-slate-500">{m.assignment_method}</span>}
                        </td>
                        <td className="px-3 py-1.5">
                          <MemberGovernance member={m} archetypeKeys={archetypeKeys} onMutate={() => { detailQ.refetch(); onMutate(); }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Per-member reassign / reject controls inside the archetype drawer. */
function MemberGovernance({ member, archetypeKeys, onMutate }: { member: ConcernRow; archetypeKeys: { key: string; name: string }[]; onMutate: () => void }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const qc = useQueryClient();
  const post = useMutation({
    mutationFn: (body: any) => sendJSON(`${BASE}/governance`, 'POST', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['archetype'] }); setOpen(false); onMutate(); },
  });
  const del = useMutation({
    mutationFn: () => sendJSON(`${BASE}/governance/${encodeURIComponent(member.concern_id)}`, 'DELETE'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['archetype'] }); onMutate(); },
  });

  if (!open) {
    return (
      <div className="flex items-center justify-end gap-1">
        <button onClick={() => setOpen(true)} title="Reassign / reject" className="inline-flex items-center gap-1 rounded-md border border-[#E8EBF4] px-1.5 py-0.5 text-[10px] font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white">
          <ArrowRightLeft className="h-3 w-3" /> Govern
        </button>
        {member.governed && (
          <button onClick={() => del.mutate()} disabled={del.isPending} title="Retract override" className="inline-flex items-center rounded-md border border-[#E8EBF4] px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100">
            {del.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="max-w-[120px] rounded-md border border-[#E8EBF4] px-1 py-0.5 text-[10px]">
        <option value="">Reassign to…</option>
        {archetypeKeys.filter((a) => a.key !== member.archetype_key).map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
      </select>
      <button
        disabled={!target || post.isPending}
        onClick={() => post.mutate({ concern_id: member.concern_id, decision_type: 'reassign', target_archetype_key: target, rationale: 'reassigned via panel' })}
        className="rounded-md bg-[#344E86] px-1.5 py-0.5 text-[10px] font-bold text-white disabled:opacity-40">
        {post.isPending ? '…' : 'Move'}
      </button>
      <button
        disabled={post.isPending}
        onClick={() => post.mutate({ concern_id: member.concern_id, decision_type: 'reject', rationale: 'rejected via panel' })}
        title="Reject (drop to unmatched)"
        className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
        <Trash2 className="h-3 w-3" />
      </button>
      <button onClick={() => setOpen(false)} className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100"><X className="h-3 w-3" /></button>
    </div>
  );
}

/** Inline resolve control for an unmatched concern. */
function ResolveControl({ row, archetypeKeys, onMutate }: { row: UnmatchedRow; archetypeKeys: { key: string; name: string }[]; onMutate: () => void }) {
  const [target, setTarget] = useState(row.best_archetype_key || '');
  const qc = useQueryClient();
  const post = useMutation({
    mutationFn: () => sendJSON(`${BASE}/governance`, 'POST', { concern_id: row.concern_id, decision_type: 'resolve_unmatched', target_archetype_key: target, rationale: 'resolved via panel' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['archetype'] }); onMutate(); },
  });
  return (
    <div className="flex items-center justify-end gap-1">
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="max-w-[150px] rounded-md border border-[#E8EBF4] px-1.5 py-0.5 text-[10px]">
        <option value="">Resolve to…</option>
        {archetypeKeys.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
      </select>
      <button
        disabled={!target || post.isPending}
        onClick={() => post.mutate()}
        className="inline-flex items-center gap-1 rounded-md bg-[#344E86] px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-40">
        {post.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Resolve
      </button>
    </div>
  );
}

export default function ArchetypeIntelligencePanel() {
  const [selectedArch, setSelectedArch] = useState<string | null>(null);
  const [unmatchedQ, setUnmatchedQ] = useState('');
  const qc = useQueryClient();
  const refetchAll = () => qc.invalidateQueries({ queryKey: ['archetype'] });

  const statsQ = useQuery<{ ok: boolean; stats: Stats }>({ queryKey: ['archetype', 'stats'], queryFn: () => getJSON(`${BASE}/stats`) });
  const libQ = useQuery<{ ok: boolean; library: LibraryRow[] }>({ queryKey: ['archetype', 'library'], queryFn: () => getJSON(`${BASE}/library`) });
  const unmatchedListQ = useQuery<{ ok: boolean; total: number; unmatched: UnmatchedRow[] }>({
    queryKey: ['archetype', 'unmatched', unmatchedQ],
    queryFn: () => getJSON(`${BASE}/unmatched?limit=100${unmatchedQ ? `&q=${encodeURIComponent(unmatchedQ)}` : ''}`),
  });
  const decisionsQ = useQuery<{ ok: boolean; decisions: DecisionRecord[] }>({ queryKey: ['archetype', 'decisions'], queryFn: () => getJSON(`${BASE}/decisions`) });

  const stats = statsQ.data?.stats;
  const library = libQ.data?.library || [];
  const unmatched = unmatchedListQ.data?.unmatched || [];
  const decisions = (decisionsQ.data?.decisions || []).filter((d) => d.active);
  const archetypeKeys = library.map((l) => ({ key: l.archetype_key, name: l.archetype_name }));

  const loading = statsQ.isLoading || libQ.isLoading;
  const error = statsQ.error || libQ.error;

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FC] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Layers className="h-5 w-5 text-[#344E86]" />
          <div>
            <h2 className="text-lg font-black text-[#1F2A44]">Archetype Intelligence</h2>
            <p className="text-xs text-slate-500">
              Deterministic behavioural archetypes over the concern ontology, with human governance overrides that survive every re-run.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`${BASE}/library.csv`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#344E86] bg-[#344E86] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a3f6d]">
            <Download className="h-3.5 w-3.5" /> Library CSV
          </a>
          <a href={`${BASE}/unmatched.csv`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#344E86] px-3 py-1.5 text-xs font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white">
            <Download className="h-3.5 w-3.5" /> Unmatched CSV
          </a>
        </div>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading archetype intelligence…</div>}
      {error && <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> Failed to load.</div>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Readiness" value={`${stats.readiness}`} tone={stats.readiness >= 70 ? 'text-emerald-600' : 'text-amber-600'} sub="discovery score / 100" />
            <StatCard label="Coverage" value={`${(stats.coverage * 100).toFixed(1)}%`} sub={`${stats.assigned}/${stats.total_concerns} concerns`} />
            <StatCard label="Unmatched" value={stats.unmatched} tone="text-blue-600" sub="flagged for review" />
            <StatCard label="Rel. grounding" value={`${(stats.relationship_grounding * 100).toFixed(1)}%`} sub="direct + propagated" />
            <StatCard label="Mean coherence" value={stats.mean_coherence} sub={`${stats.archetype_count} archetypes`} />
            <StatCard label="Overrides" value={stats.governance.active} tone={stats.governance.active > 0 ? 'text-violet-600' : undefined} sub="active human decisions" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E8EBF4] bg-white p-3 text-xs">
            <span className="font-black uppercase tracking-widest text-slate-400">Validation</span>
            <span className="inline-flex items-center gap-1"><StatusBadge status="strong" /> <span className="font-bold text-slate-700">{stats.status_counts.strong}</span></span>
            <span className="inline-flex items-center gap-1"><StatusBadge status="moderate" /> <span className="font-bold text-slate-700">{stats.status_counts.moderate}</span></span>
            <span className="inline-flex items-center gap-1"><StatusBadge status="weak" /> <span className="font-bold text-slate-700">{stats.status_counts.weak}</span></span>
            <span className="mx-1 h-4 w-px bg-[#E8EBF4]" />
            <span className="inline-flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 text-slate-400" /> Similarity capture <span className="font-bold text-slate-700">{(stats.similarity_capture.ratio * 100).toFixed(1)}%</span> <span className="text-slate-400">({stats.similarity_capture.captured}/{stats.similarity_capture.evaluated})</span></span>
            <span className="inline-flex items-center gap-1.5">Balance <span className="font-bold text-slate-700">{stats.balance}</span></span>
          </div>

          {stats.weak_archetypes.length > 0 && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-rose-600">
                <AlertTriangle className="h-4 w-4" /> Weak archetypes ({stats.weak_archetypes.length}) — review candidates
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.weak_archetypes.map((w) => (
                  <button key={w.archetype_key} onClick={() => setSelectedArch(w.archetype_key)}
                    className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-left text-xs hover:border-rose-300">
                    <div className="font-bold text-[#1F2A44]">{w.archetype_name}</div>
                    <div className="text-[11px] text-slate-500">{w.member_count} members · coherence {w.coherence} · ceiling {w.grounding_ceiling}{w.weak_reason ? ` · ${w.weak_reason}` : ''}</div>
                    {w.stabilization_recommendation && w.stabilization_recommendation !== 'none' && (
                      <div className="mt-0.5 text-[11px] font-semibold text-rose-600">→ {w.stabilization_recommendation}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Active governance decisions */}
      {decisions.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <ShieldCheck className="h-4 w-4" /> Active overrides ({decisions.length})
          </h3>
          <div className="overflow-hidden rounded-xl border border-violet-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-violet-50 text-[10px] font-black uppercase tracking-wider text-violet-700">
                <tr>
                  <th className="px-3 py-2">Concern</th>
                  <th className="px-3 py-2">Decision</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">By</th>
                  <th className="px-3 py-2">Rationale</th>
                  <th className="px-3 py-2 text-right">Retract</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF1F8]">
                {decisions.map((d) => <DecisionRow key={d.concern_id} d={d} onMutate={refetchAll} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmatched review queue */}
      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <Inbox className="h-4 w-4" /> Unmatched queue {stats && `(${stats.unmatched})`}
          </h3>
          <input
            value={unmatchedQ} onChange={(e) => setUnmatchedQ(e.target.value)}
            placeholder="Search unmatched…"
            className="ml-auto w-56 rounded-md border border-[#E8EBF4] px-2 py-1 text-xs focus:border-[#344E86] focus:outline-none"
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-[#E8EBF4] bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F2F4FA] text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Concern</th>
                <th className="px-3 py-2">Best candidate</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2 text-right">Resolve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F8]">
              {unmatched.map((r) => (
                <tr key={r.concern_id} className="hover:bg-[#F7F8FC]">
                  <td className="px-3 py-1.5">
                    <div className="font-semibold text-[#1F2A44]">{r.concern_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{r.concern_id} · {r.canonical_type}</div>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-[#344E86]">{r.best_archetype_key || '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.best_score}</td>
                  <td className="px-3 py-1.5 text-[11px] text-slate-500">{r.reason}</td>
                  <td className="px-3 py-1.5"><ResolveControl row={r} archetypeKeys={archetypeKeys} onMutate={refetchAll} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {unmatched.length === 0 && <div className="p-4 text-center text-xs text-slate-400">No unmatched concerns.</div>}
        </div>
      </div>

      {/* Archetype library */}
      <div className="mt-6">
        <h3 className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <Sparkles className="h-4 w-4" /> Archetype library
        </h3>
        <div className="overflow-hidden rounded-xl border border-[#E8EBF4] bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F2F4FA] text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Archetype</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Members</th>
                <th className="px-3 py-2 text-right">Grounded</th>
                <th className="px-3 py-2 text-right">Coherence</th>
                <th className="px-3 py-2 text-right">Distinct.</th>
                <th className="px-3 py-2 text-right">Ceiling</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Recommendation</th>
                <th className="px-3 py-2 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F8]">
              {library.map((r) => (
                <tr key={r.archetype_key} className="hover:bg-[#F7F8FC]">
                  <td className="px-3 py-1.5">
                    <div className="font-bold text-[#1F2A44]">{r.archetype_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{r.archetype_key}</div>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600">{r.primary_behavior_category}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.member_count}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{r.behavior_grounded_count}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.coherence ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.distinctiveness ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{r.grounding_ceiling ?? '—'}</td>
                  <td className="px-3 py-1.5"><StatusBadge status={r.validation_status} /></td>
                  <td className="px-3 py-1.5 text-[11px] text-slate-500">{r.stabilization_recommendation && r.stabilization_recommendation !== 'none' ? r.stabilization_recommendation : '—'}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end">
                      <button onClick={() => setSelectedArch(r.archetype_key)} title="View detail + members"
                        className="inline-flex items-center gap-1 rounded-md border border-[#E8EBF4] px-2 py-1 text-[10px] font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white">
                        <Eye className="h-3 w-3" /> View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedArch && (
        <ArchetypeDrawer archKey={selectedArch} archetypeKeys={archetypeKeys} onClose={() => setSelectedArch(null)} onMutate={refetchAll} />
      )}
    </div>
  );
}

function DecisionRow({ d, onMutate }: { d: DecisionRecord; onMutate: () => void }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => sendJSON(`${BASE}/governance/${encodeURIComponent(d.concern_id)}`, 'DELETE'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['archetype'] }); onMutate(); },
  });
  return (
    <tr className="hover:bg-violet-50/40">
      <td className="px-3 py-1.5 font-mono text-[11px] text-[#1F2A44]">{d.concern_id}</td>
      <td className="px-3 py-1.5"><span className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">{d.decision_type}</span></td>
      <td className="px-3 py-1.5 font-mono text-[11px] text-[#344E86]">{d.target_archetype_key || '—'}</td>
      <td className="px-3 py-1.5 text-slate-500">{d.decided_by}</td>
      <td className="px-3 py-1.5 text-slate-500">{d.rationale || '—'}</td>
      <td className="px-3 py-1.5 text-right">
        <button onClick={() => del.mutate()} disabled={del.isPending} title="Retract"
          className="inline-flex items-center gap-1 rounded-md border border-[#E8EBF4] px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100">
          {del.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Retract
        </button>
      </td>
    </tr>
  );
}
