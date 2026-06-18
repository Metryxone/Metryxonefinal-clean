import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MessageCircle, Download, Loader2, AlertTriangle, CheckCircle2, XCircle,
  Eye, X, Users, Heart, MessageSquareQuote,
} from 'lucide-react';

type Voice = 'student' | 'professional' | 'general';
type EmotionType = 'frustration' | 'fear' | 'motivation' | 'growth_signal' | 'success_indicator';
type Stakeholder = 'student' | 'parent' | 'teacher' | 'counselor' | 'professional';

interface ValidatorResult { rate: number; target: number; pass: boolean }
interface Stats {
  generated_at: string;
  totals: { problems: number; emotions: number; narratives: number; archetypes: number };
  coverage: { problems_ok: number; stakeholders_ok: number; emotions_ok: number; archetypes: number };
  emotion_distribution: Record<EmotionType, number>;
  stakeholder_distribution: Record<Stakeholder, number>;
  voice_distribution: Record<Voice, number>;
  validation: {
    human_realism: ValidatorResult;
    duplicate_rate: ValidatorResult;
    archetype_alignment: ValidatorResult;
  };
}

interface ProblemRow { problem_id: number; archetype_key: string; archetype_name: string; voice: Voice; problem_statement: string; realism_pass: boolean; aligned: boolean; is_duplicate: boolean }
interface ArchetypeDetail {
  ok: boolean;
  archetype_key: string;
  archetype_name: string;
  problems: Array<{ problem_id: number; voice: Voice; problem_statement: string; realism_pass: boolean; aligned: boolean; is_duplicate: boolean }>;
  emotions: Array<{ emotion_id: number; emotion_type: EmotionType; statement: string; realism_pass: boolean; aligned: boolean; is_duplicate: boolean }>;
  narratives: Array<{ narrative_id: number; stakeholder: Stakeholder; narrative: string; realism_pass: boolean; aligned: boolean; is_duplicate: boolean }>;
}

async function getJSON(url: string) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

const EMOTION_LABELS: Record<EmotionType, string> = {
  frustration: 'Frustrations',
  fear: 'Fears',
  motivation: 'Motivations',
  growth_signal: 'Growth Signals',
  success_indicator: 'Success Indicators',
};
const STAKEHOLDER_LABELS: Record<Stakeholder, string> = {
  student: 'Student', parent: 'Parent', teacher: 'Teacher', counselor: 'Counselor', professional: 'Professional',
};
const VOICE_STYLE: Record<Voice, string> = {
  student: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  professional: 'bg-blue-50 text-blue-700 border-blue-200',
  general: 'bg-slate-100 text-slate-600 border-slate-200',
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
        {result.pass
          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          : <XCircle className="h-4 w-4 text-rose-600" />}
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

function Flags({ realism, aligned, dup }: { realism: boolean; aligned: boolean; dup: boolean }) {
  return (
    <span className="ml-2 inline-flex gap-1 align-middle">
      {!realism && <span title="fails realism (jargon / length)" className="rounded bg-rose-100 px-1 text-[9px] font-bold text-rose-700">JARGON</span>}
      {!aligned && <span title="does not touch the archetype lexicon" className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">OFF-LEXICON</span>}
      {dup && <span title="near-duplicate within this archetype" className="rounded bg-orange-100 px-1 text-[9px] font-bold text-orange-700">DUP</span>}
    </span>
  );
}

function ArchetypeDrawer({ archetypeKey, onClose }: { archetypeKey: string; onClose: () => void }) {
  const detailQ = useQuery<ArchetypeDetail>({
    queryKey: ['human', 'archetype', archetypeKey],
    queryFn: () => getJSON(`/api/admin/pil/human/${encodeURIComponent(archetypeKey)}`),
  });
  const d = detailQ.data;
  const emotionsByType = (type: EmotionType) => (d?.emotions || []).filter((e) => e.emotion_type === type);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8EBF4] bg-white px-5 py-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Human Intelligence</div>
            <h3 className="text-lg font-black text-[#1F2A44]">{d?.archetype_name || archetypeKey}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {detailQ.isLoading && (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        )}
        {detailQ.error && (
          <div className="m-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="h-4 w-4" /> Failed to load archetype content.</div>
        )}

        {d && (
          <div className="space-y-6 p-5">
            {/* problems */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#344E86]">
                <MessageSquareQuote className="h-3.5 w-3.5" /> Problems ({d.problems.length})
              </div>
              <ul className="space-y-1.5">
                {d.problems.map((p) => (
                  <li key={p.problem_id} className="rounded-lg border border-[#E8EBF4] bg-white px-3 py-2 text-sm text-[#1F2A44]">
                    <span className={`mr-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${VOICE_STYLE[p.voice]}`}>{p.voice}</span>
                    “{p.problem_statement}”
                    <Flags realism={p.realism_pass} aligned={p.aligned} dup={p.is_duplicate} />
                  </li>
                ))}
              </ul>
            </section>

            {/* emotions */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#344E86]">
                <Heart className="h-3.5 w-3.5" /> Emotions ({d.emotions.length})
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(EMOTION_LABELS) as EmotionType[]).map((t) => (
                  <div key={t} className="rounded-lg border border-[#E8EBF4] bg-[#F7F8FC] p-3">
                    <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{EMOTION_LABELS[t]}</div>
                    <ul className="space-y-1">
                      {emotionsByType(t).map((e) => (
                        <li key={e.emotion_id} className="text-sm text-[#1F2A44]">
                          “{e.statement}”
                          <Flags realism={e.realism_pass} aligned={e.aligned} dup={e.is_duplicate} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* stakeholder narratives */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#344E86]">
                <Users className="h-3.5 w-3.5" /> Stakeholder Narratives ({d.narratives.length})
              </div>
              <div className="space-y-2">
                {d.narratives.map((n) => (
                  <div key={n.narrative_id} className="rounded-lg border border-[#E8EBF4] bg-white px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{STAKEHOLDER_LABELS[n.stakeholder]}</div>
                    <div className="mt-0.5 text-sm text-[#1F2A44]">
                      “{n.narrative}”
                      <Flags realism={n.realism_pass} aligned={n.aligned} dup={n.is_duplicate} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HumanIntelligencePanel() {
  const [voiceFilter, setVoiceFilter] = useState<'' | Voice>('');
  const [selected, setSelected] = useState<string | null>(null);

  const statsQ = useQuery<{ ok: boolean; stats: Stats }>({
    queryKey: ['human', 'stats'],
    queryFn: () => getJSON('/api/admin/pil/human/stats'),
  });
  const problemsQ = useQuery<{ ok: boolean; problems: ProblemRow[] }>({
    queryKey: ['human', 'problems'],
    queryFn: () => getJSON('/api/admin/pil/human/problems?limit=1000'),
  });

  const stats = statsQ.data?.stats;
  const problems = problemsQ.data?.problems || [];

  // group problems by archetype for the index table
  const byArchetype = new Map<string, { name: string; rows: ProblemRow[] }>();
  for (const p of problems) {
    if (voiceFilter && p.voice !== voiceFilter) continue;
    const e = byArchetype.get(p.archetype_key) || { name: p.archetype_name, rows: [] };
    e.rows.push(p);
    byArchetype.set(p.archetype_key, e);
  }
  const archetypes = [...byArchetype.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  const loading = statsQ.isLoading || problemsQ.isLoading;
  const error = statsQ.error || problemsQ.error;

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FC] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MessageCircle className="h-5 w-5 text-[#344E86]" />
          <div>
            <h2 className="text-lg font-black text-[#1F2A44]">Human Intelligence</h2>
            <p className="text-xs text-slate-500">
              Plain-language translation of the 22 archetypes — problems, stakeholder narratives & emotion sets.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['problems', 'emotions', 'narratives'] as const).map((k) => (
            <a key={k} href={`/api/admin/pil/human/${k}.csv`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#344E86] px-3 py-1.5 text-xs font-bold text-[#344E86] hover:bg-[#344E86] hover:text-white">
              <Download className="h-3.5 w-3.5" /> {k}
            </a>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading human intelligence…</div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4" /> Failed to load. Run the Phase-3 pipeline first.
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Archetypes" value={stats.totals.archetypes} sub="with human content" />
            <StatCard label="Problems" value={stats.totals.problems}
              sub={`${stats.coverage.problems_ok}/${stats.coverage.archetypes} with ≥3`} />
            <StatCard label="Emotions" value={stats.totals.emotions}
              sub={`${stats.coverage.emotions_ok}/${stats.coverage.archetypes} full set`} />
            <StatCard label="Narratives" value={stats.totals.narratives}
              sub={`${stats.coverage.stakeholders_ok}/${stats.coverage.archetypes} all 5 voices`} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <ValidatorCard label="Human Realism" sub="jargon-free" result={stats.validation.human_realism} />
            <ValidatorCard label="Duplicate Rate" sub="within archetype" result={stats.validation.duplicate_rate} lessIsBetter />
            <ValidatorCard label="Archetype Alignment" sub="touches lay lexicon" result={stats.validation.archetype_alignment} />
          </div>

          {/* distributions */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#E8EBF4] bg-white p-3">
              <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">Emotion Distribution</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {(Object.keys(EMOTION_LABELS) as EmotionType[]).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-md border border-[#E8EBF4] px-2 py-1">
                    {EMOTION_LABELS[t]} <span className="font-bold text-[#344E86]">{stats.emotion_distribution[t] || 0}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#E8EBF4] bg-white p-3">
              <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">Stakeholder Distribution</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {(Object.keys(STAKEHOLDER_LABELS) as Stakeholder[]).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 rounded-md border border-[#E8EBF4] px-2 py-1">
                    {STAKEHOLDER_LABELS[s]} <span className="font-bold text-[#344E86]">{stats.stakeholder_distribution[s] || 0}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* archetype index */}
          <div className="mt-5 flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Archetypes ({archetypes.length})</div>
            <div className="flex items-center gap-1.5">
              {(['', 'student', 'professional', 'general'] as const).map((v) => (
                <button key={v || 'all'} onClick={() => setVoiceFilter(v)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-bold ${voiceFilter === v ? 'border-[#344E86] bg-[#344E86] text-white' : 'border-[#E8EBF4] bg-white text-slate-600 hover:border-[#344E86]'}`}>
                  {v || 'all voices'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 overflow-hidden rounded-xl border border-[#E8EBF4] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EBF4] text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-2">Archetype</th>
                  <th className="px-4 py-2">Sample problem</th>
                  <th className="px-4 py-2 w-20 text-center">Problems</th>
                  <th className="px-4 py-2 w-16 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {archetypes.map(([key, { name, rows }]) => (
                  <tr key={key} className="border-b border-[#F0F2F8] last:border-0 hover:bg-[#F7F8FC]">
                    <td className="px-4 py-2.5 font-bold text-[#1F2A44]">{name}</td>
                    <td className="px-4 py-2.5 text-slate-600">“{rows[0]?.problem_statement}”</td>
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
