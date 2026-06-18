import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Target, Download, Loader2, AlertTriangle, CheckCircle2, XCircle,
  Eye, X, Gauge, ListChecks, Route as RouteIcon,
} from 'lucide-react';

type Stakeholder = 'student' | 'parent' | 'teacher' | 'counselor' | 'professional';
type InterventionType = 'immediate_actions' | 'seven_day' | 'thirty_day' | 'ninety_day' | 'habit' | 'skill_building';

interface ValidatorResult { rate: number; target: number; pass: boolean }
interface Stats {
  generated_at: string;
  totals: { interventions: number; pathways: number; plans: number; duplicate_reviews: number; archetypes: number };
  coverage: { complete_pathways: number; pathways: number };
  type_distribution: Record<InterventionType, number>;
  stakeholder_distribution: Record<Stakeholder, number>;
  quality_averages: { practicality: number; actionability: number; outcome_clarity: number; stakeholder_relevance: number; archetype_alignment: number; composite: number };
  outcome_averages: { confidence_impact: number; risk_reduction_impact: number };
  duplicate_breakdown: { identical: number; semantic: number; stakeholder: number; redundant: number; variants: number };
  link_integrity: { linked: number; orphans: number };
  validation: {
    practicality: ValidatorResult;
    actionability: ValidatorResult;
    archetype_alignment: ValidatorResult;
    duplicate_rate: ValidatorResult;
    coverage: ValidatorResult;
  };
  transformation_readiness_score: number;
}

interface InterventionRow {
  intervention_id: number;
  archetype_key: string;
  archetype_name: string;
  problem_id: number;
  stakeholder_type: Stakeholder;
  intervention_type: InterventionType;
  intervention_text: string;
  realism_pass: boolean;
  aligned: boolean;
  is_duplicate: boolean;
  practicality: number;
  actionability: number;
  outcome_clarity: number;
  stakeholder_relevance: number;
  archetype_alignment: number;
  composite: number;
  expected_outcome: string;
  success_indicator: string;
  progress_indicator: string;
  confidence_impact: number;
  risk_reduction_impact: number;
}
interface PathwayRow {
  pathway_key: string; stakeholder_type: Stakeholder; stage_count: number; complete: boolean;
  stages: { intervention_type: InterventionType; text: string; composite: number; horizon_days: number }[];
  avg_composite: number; avg_confidence_impact: number; avg_risk_reduction: number; summary: string;
}
interface PlanRow {
  template_key: string; stakeholder_type: Stakeholder; plan_title: string;
  step_immediate: string; step_week: string; step_month: string; step_quarter: string;
  total_days: number; avg_composite: number; is_duplicate: boolean;
}
interface ArchetypeDetail { ok: boolean; archetype_key: string; archetype_name: string; interventions: InterventionRow[]; pathways: PathwayRow[]; plans: PlanRow[] }

async function getJSON(url: string) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

const TYPE_LABELS: Record<InterventionType, string> = {
  immediate_actions: 'Immediate Actions',
  seven_day: '7-Day Plan',
  thirty_day: '30-Day Plan',
  ninety_day: '90-Day Development',
  habit: 'Habit',
  skill_building: 'Skill-Building',
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
        target {lessIsBetter ? '<' : '>'}{(result.target * 100).toFixed(0)}% · {sub}
      </div>
    </div>
  );
}

function Flags({ practical, aligned, dup }: { practical: boolean; aligned: boolean; dup: boolean }) {
  return (
    <span className="ml-2 inline-flex gap-1 align-middle">
      {!practical && <span title="fails practicality (vague / not concrete)" className="rounded bg-rose-100 px-1 text-[9px] font-bold text-rose-700">VAGUE</span>}
      {!aligned && <span title="does not touch the archetype lexicon" className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">OFF-LEXICON</span>}
      {dup && <span title="redundant near-duplicate" className="rounded bg-orange-100 px-1 text-[9px] font-bold text-orange-700">DUP</span>}
    </span>
  );
}

function ArchetypeDrawer({ archetypeKey, onClose }: { archetypeKey: string; onClose: () => void }) {
  const detailQ = useQuery<ArchetypeDetail>({
    queryKey: ['intervention', 'archetype', archetypeKey],
    queryFn: () => getJSON(`/api/admin/pil/intervention/${encodeURIComponent(archetypeKey)}`),
  });
  const d = detailQ.data;
  const byType = (t: InterventionType) => (d?.interventions || []).filter((i) => i.intervention_type === t);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8EBF4] bg-white px-5 py-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Intervention Intelligence</div>
            <h3 className="text-lg font-black text-[#1F2A44]">{d?.archetype_name || archetypeKey}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {detailQ.isLoading && (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        )}
        {detailQ.error && (
          <div className="m-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> Failed to load archetype interventions.</div>
        )}

        {d && (
          <div className="space-y-6 p-5">
            {(Object.keys(TYPE_LABELS) as InterventionType[]).map((t) => (
              <section key={t}>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#344E86]">
                  <Target className="h-3.5 w-3.5" /> {TYPE_LABELS[t]} ({byType(t).length})
                </div>
                <ul className="space-y-1.5">
                  {byType(t).map((i) => (
                    <li key={i.intervention_id} className="rounded-lg border border-[#E8EBF4] bg-white px-3 py-2 text-sm text-[#1F2A44]">
                      <div>
                        <span className={`mr-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${STAKEHOLDER_STYLE[i.stakeholder_type]}`}>{STAKEHOLDER_LABELS[i.stakeholder_type]}</span>
                        {i.intervention_text}
                        <span className="ml-2 text-[10px] font-bold text-slate-400">{i.composite?.toFixed?.(1) ?? i.composite}/5</span>
                        <Flags practical={i.realism_pass} aligned={i.aligned} dup={i.is_duplicate} />
                      </div>
                      {i.expected_outcome && (
                        <div className="mt-1 text-xs text-slate-500">
                          <span className="font-bold text-slate-600">Outcome:</span> {i.expected_outcome}
                          <span className="ml-2 text-[10px] text-slate-400">conf +{(i.confidence_impact * 100).toFixed(0)}% · risk −{(i.risk_reduction_impact * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {!!d.plans?.length && (
              <section>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#344E86]">
                  <ListChecks className="h-3.5 w-3.5" /> Action Plans ({d.plans.length})
                </div>
                <ul className="space-y-2">
                  {d.plans.map((p) => (
                    <li key={p.template_key} className="rounded-lg border border-[#E8EBF4] bg-[#F7F8FC] px-3 py-2 text-xs text-[#1F2A44]">
                      <div className="mb-1 font-bold">
                        <span className={`mr-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${STAKEHOLDER_STYLE[p.stakeholder_type]}`}>{STAKEHOLDER_LABELS[p.stakeholder_type]}</span>
                        {p.plan_title} <span className="text-[10px] font-bold text-slate-400">{p.total_days}d · {p.avg_composite.toFixed(1)}/5</span>
                      </div>
                      <ol className="ml-4 list-decimal space-y-0.5 text-slate-600">
                        <li>{p.step_immediate}</li>
                        <li>{p.step_week}</li>
                        <li>{p.step_month}</li>
                        <li>{p.step_quarter}</li>
                      </ol>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterventionIntelligencePanel() {
  const [stakeFilter, setStakeFilter] = useState<'' | Stakeholder>('');
  const [selected, setSelected] = useState<string | null>(null);

  const statsQ = useQuery<{ ok: boolean; stats: Stats }>({
    queryKey: ['intervention', 'stats'],
    queryFn: () => getJSON('/api/admin/pil/intervention/stats'),
  });
  const intsQ = useQuery<{ ok: boolean; interventions: InterventionRow[] }>({
    queryKey: ['intervention', 'interventions'],
    queryFn: () => getJSON('/api/admin/pil/intervention/interventions?limit=1000'),
  });

  const stats = statsQ.data?.stats;
  const interventions = intsQ.data?.interventions || [];

  // group by archetype for the index table
  const byArchetype = new Map<string, { name: string; rows: InterventionRow[] }>();
  for (const i of interventions) {
    if (stakeFilter && i.stakeholder_type !== stakeFilter) continue;
    const e = byArchetype.get(i.archetype_key) || { name: i.archetype_name, rows: [] };
    e.rows.push(i);
    byArchetype.set(i.archetype_key, e);
  }
  const archetypes = [...byArchetype.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  const loading = statsQ.isLoading || intsQ.isLoading;
  const error = statsQ.error || intsQ.error;
  const trs = stats?.transformation_readiness_score ?? 0;
  const trsTone = trs >= 85 ? 'text-emerald-700' : trs >= 70 ? 'text-amber-600' : 'text-rose-700';

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FC] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Target className="h-5 w-5 text-[#344E86]" />
          <div>
            <h2 className="text-lg font-black text-[#1F2A44]">Intervention Intelligence</h2>
            <p className="text-xs text-slate-500">
              What to actually do for each of the 22 archetypes — 5 stakeholders × 6 intervention types, scored, with outcomes & growth pathways.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['interventions', 'pathways', 'plans', 'duplicates'] as const).map((k) => (
            <a key={k} href={`/api/admin/pil/intervention/${k}.csv`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#344E86] px-3 py-1.5 text-xs font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white">
              <Download className="h-3.5 w-3.5" /> {k}
            </a>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading intervention intelligence…</div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4" /> Failed to load. Run the Phase-5 pipeline first.
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Interventions" value={stats.totals.interventions} sub={`${stats.coverage.complete_pathways}/${stats.coverage.pathways} complete pathways`} />
            <StatCard label="Action Plans" value={stats.totals.plans} sub="archetype × stakeholder" />
            <StatCard label="Avg Composite" value={`${stats.quality_averages.composite.toFixed(2)}/5`} sub="quality across 5 scores" />
            <StatCard label="Orphan Links" value={stats.link_integrity.orphans} sub={`${stats.link_integrity.linked} linked to a problem`} tone={stats.link_integrity.orphans === 0 ? 'text-emerald-700' : 'text-rose-700'} />
          </div>

          {/* Transformation Readiness Score */}
          <div className="mt-4 rounded-xl border border-[#E8EBF4] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                <Gauge className="h-4 w-4 text-[#344E86]" /> Transformation Readiness Score
              </div>
              <div className={`text-3xl font-black ${trsTone}`}>{trs.toFixed(1)}<span className="text-base text-slate-400"> / 100</span></div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${trs >= 85 ? 'bg-emerald-500' : trs >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, trs)}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-slate-500">practicality 25% · actionability 20% · alignment 15% · non-dup 15% · coverage 15% · link 10%</div>
          </div>

          {/* validators */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
            <ValidatorCard label="Practicality" sub="concrete & doable" result={stats.validation.practicality} />
            <ValidatorCard label="Actionability" sub="clear next step" result={stats.validation.actionability} />
            <ValidatorCard label="Alignment" sub="touches lexicon" result={stats.validation.archetype_alignment} />
            <ValidatorCard label="Duplicate Rate" sub="redundant only" result={stats.validation.duplicate_rate} lessIsBetter />
            <ValidatorCard label="Coverage" sub="of 660 target" result={stats.validation.coverage} />
          </div>

          {/* distributions + outcomes */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#E8EBF4] bg-white p-3">
              <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">Intervention-Type Distribution</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {(Object.keys(TYPE_LABELS) as InterventionType[]).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-md border border-[#E8EBF4] px-2 py-1">
                    {TYPE_LABELS[t]} <span className="font-bold text-[#344E86]">{stats.type_distribution[t] || 0}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#E8EBF4] bg-white p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                <RouteIcon className="h-3.5 w-3.5" /> Projected Outcomes (avg)
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E8EBF4] px-2 py-1">Confidence impact <span className="font-bold text-emerald-700">+{(stats.outcome_averages.confidence_impact * 100).toFixed(0)}%</span></span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E8EBF4] px-2 py-1">Risk reduction <span className="font-bold text-emerald-700">−{(stats.outcome_averages.risk_reduction_impact * 100).toFixed(0)}%</span></span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2 py-1">Redundant dup <span className="font-bold text-orange-700">{stats.duplicate_breakdown.redundant}</span></span>
              </div>
            </div>
          </div>

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
                  <th className="px-4 py-2">Sample intervention</th>
                  <th className="px-4 py-2 w-24 text-center">Interventions</th>
                  <th className="px-4 py-2 w-16 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {archetypes.map(([key, { name, rows }]) => (
                  <tr key={key} className="border-b border-[#F0F2F8] last:border-0 hover:bg-[#F7F8FC]">
                    <td className="px-4 py-2.5 font-bold text-[#1F2A44]">{name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{rows[0]?.intervention_text}</td>
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
