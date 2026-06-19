import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const BLUEPRINTS = [
  { id: 'bp_pm_v1', label: 'Product Manager' },
  { id: 'bp_be_v1', label: 'Backend Engineer' },
  { id: 'bp_srbe_v1', label: 'Senior Backend Engineer' },
];

const LEVEL_COLORS: Record<number, string> = {
  5: 'bg-emerald-100 text-emerald-800',
  4: 'bg-green-100 text-green-800',
  3: 'bg-amber-100 text-amber-800',
  2: 'bg-orange-100 text-orange-800',
  1: 'bg-red-100 text-red-700',
};

interface AssembledQuestion {
  question_id: string;
  competency_id: string;
  difficulty_level: string;
  question_type: string;
  prompt?: string;
  stem?: string;
}

interface CompetencyScore {
  competency_id: string;
  achieved_points: number;
  max_points: number;
  item_count: number;
  normalized_score: number | null;
  normalization_basis: string;
  level: number | null;
  level_label: string | null;
  level_status: string;
}

interface ScoreRun {
  run_id: string | null;
  status: string;
  total_questions: number;
  scored_questions: number;
  competency_scores: CompetencyScore[];
  overall: {
    normalized_score: number | null;
    level: number | null;
    level_label: string | null;
    status: string;
    competencies_scored: number;
  };
}

function levelBadge(level: number | null, label: string | null, status: string) {
  if (level == null) {
    return <Badge className="bg-gray-100 text-gray-500">Unmeasurable</Badge>;
  }
  return <Badge className={LEVEL_COLORS[level] || 'bg-gray-100'}>L{level} · {label}</Badge>;
}

export default function CompetencyRuntimePanel() {
  const [blueprintId, setBlueprintId] = useState('bp_pm_v1');
  const [questions, setQuestions] = useState<AssembledQuestion[]>([]);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [correctMap, setCorrectMap] = useState<Record<string, boolean>>({});
  const [run, setRun] = useState<ScoreRun | null>(null);
  const [persist, setPersist] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assemble = async () => {
    setAssembling(true);
    setError(null);
    setRun(null);
    setQuestions([]);
    try {
      const path = persist ? 'assemble' : 'assessment-preview';
      const r = await fetch(`/api/competency-runtime/blueprints/${blueprintId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seed: Math.floor(Math.random() * 100000) }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setError(d.error || `Assemble failed (${r.status})`);
        return;
      }
      const qs: AssembledQuestion[] = d.data?.questions || [];
      setQuestions(qs);
      setAssessmentId(d.data?.assessment_id || null);
      // default: 2 of every 3 marked correct, for a realistic spread
      const cm: Record<string, boolean> = {};
      qs.forEach((q, i) => { cm[q.question_id] = i % 3 !== 0; });
      setCorrectMap(cm);
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setAssembling(false);
    }
  };

  const setAll = (val: boolean) => {
    const cm: Record<string, boolean> = {};
    questions.forEach((q) => { cm[q.question_id] = val; });
    setCorrectMap(cm);
  };

  const toggle = (qid: string) => {
    setCorrectMap((m) => ({ ...m, [qid]: !m[qid] }));
  };

  const score = async () => {
    setScoring(true);
    setError(null);
    try {
      const responses = questions.map((q) => ({
        question_id: q.question_id,
        competency_id: q.competency_id,
        difficulty_level: q.difficulty_level,
        question_type: q.question_type,
        correct: !!correctMap[q.question_id],
      }));
      const r = await fetch('/api/competency-runtime/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assessment_id: assessmentId, blueprint_id: blueprintId, subject_id: `admin_validate_${Date.now()}`, responses, persist }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setError(d.error || `Score failed (${r.status})`);
        return;
      }
      setRun(d.data as ScoreRun);
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setScoring(false);
    }
  };

  const correctCount = questions.filter((q) => correctMap[q.question_id]).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Competency Runtime
          <span className="text-sm font-normal text-gray-500 ml-2">Phase 2.3 · 2.4</span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Assemble an assessment from a role blueprint, answer it, and score it end-to-end:
          Question → Raw Score → Competency Score → Normalized Score → Level.
        </p>
      </div>

      {/* Step 1: Assemble */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">1</span>
          <h3 className="font-semibold text-gray-800">Assemble assessment</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {BLUEPRINTS.map((b) => (
            <Button
              key={b.id}
              variant={blueprintId === b.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBlueprintId(b.id)}
            >
              {b.label}
            </Button>
          ))}
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} className="rounded border-gray-300" />
            Persist run
          </label>
          <Button onClick={assemble} disabled={assembling} size="sm">
            {assembling ? 'Assembling…' : 'Assemble'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {persist
            ? 'Persist ON — the assembled assessment and score run are saved to the database.'
            : 'Preview mode — nothing is saved (read-only validation). Enable “Persist run” to store results.'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Step 2: Answer */}
      {questions.length > 0 && (
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">2</span>
            <h3 className="font-semibold text-gray-800">Answer ({correctCount}/{questions.length} marked correct)</h3>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setAll(true)}>All correct</Button>
            <Button variant="outline" size="sm" onClick={() => setAll(false)}>All wrong</Button>
            <Button onClick={score} disabled={scoring} size="sm">
              {scoring ? 'Scoring…' : 'Score'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {questions.map((q, i) => {
              const ok = !!correctMap[q.question_id];
              return (
                <button
                  key={q.question_id}
                  onClick={() => toggle(q.question_id)}
                  className={`flex items-center justify-between text-left rounded-lg border px-3 py-2 transition ${ok ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                >
                  <span className="text-xs text-gray-600 truncate">
                    <span className="font-medium text-gray-800">Q{i + 1}</span> · {q.competency_id} · <span className="capitalize">{q.difficulty_level}</span>
                  </span>
                  <Badge className={ok ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}>
                    {ok ? 'Correct' : 'Wrong'}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {run && (
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">3</span>
            <h3 className="font-semibold text-gray-800">Results</h3>
            {run.run_id && <span className="text-xs text-gray-400 font-mono">run {run.run_id}</span>}
          </div>

          {/* Overall */}
          <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-white p-5 mb-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Overall</div>
                <div className="text-3xl font-bold text-gray-900">
                  {run.overall.normalized_score != null ? `${run.overall.normalized_score}/100` : '—'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {run.scored_questions}/{run.total_questions} questions scored · {run.overall.competencies_scored} competencies
                </div>
              </div>
              <div className="text-right">
                {levelBadge(run.overall.level, run.overall.level_label, run.overall.status)}
                <div className="text-xs text-gray-400 mt-1">status: {run.status}</div>
              </div>
            </div>
          </div>

          {/* Per-competency chain */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b">
                  <th className="py-2 pr-4">Competency</th>
                  <th className="py-2 pr-4">Raw (pts)</th>
                  <th className="py-2 pr-4">Normalized</th>
                  <th className="py-2 pr-4">Basis</th>
                  <th className="py-2 pr-4">Level</th>
                </tr>
              </thead>
              <tbody>
                {run.competency_scores.map((cs) => (
                  <tr key={cs.competency_id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium text-gray-800">{cs.competency_id}</td>
                    <td className="py-2 pr-4 text-gray-600">{cs.achieved_points}/{cs.max_points}</td>
                    <td className="py-2 pr-4 text-gray-800">{cs.normalized_score != null ? `${cs.normalized_score}/100` : '—'}</td>
                    <td className="py-2 pr-4 text-xs text-gray-500">{cs.normalization_basis.replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-4">{levelBadge(cs.level, cs.level_label, cs.level_status)}</td>
                  </tr>
                ))}
                {!run.competency_scores.length && (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-400">No competencies scored (unmeasurable)</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
