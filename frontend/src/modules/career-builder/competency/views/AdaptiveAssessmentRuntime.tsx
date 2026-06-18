/**
 * Adaptive Assessment Runtime — Phase 2 V2 UI (additive).
 *
 * Renders a self-contained, feature-flagged adaptive assessment session
 * using the backend orchestrator. Does NOT replace the existing AssessmentTab.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adaptiveAssessmentV2 } from '@/lib/services/adaptiveAssessmentV2Service';
import { pickByPool, type AdaptiveQuestion, type PickContext } from '@/data/catalogs/assessment-question-bank-v2';

type StartResult = {
  session_id: string;
  blueprint_id: string;
  blueprint: {
    blueprint_name: string;
    intensity: number;
    difficulty_band: string;
    total_questions_planned: number;
    estimated_duration_min: number;
    competencies: Array<{
      competency_code: string;
      importance_weight: number;
      expected_level: number;
      depth_band: string;
      question_count_planned: number;
      pool_keys: string[];
    }>;
  };
  initial_competency: string;
  total_questions: number;
};

type SessionState = {
  competency_code: string;
  questions_planned: number;
  questions_served: number;
  difficulty_band: 'easy' | 'medium' | 'hard';
  depth_band: 'shallow' | 'standard' | 'deep';
  rolling_score: number;
  rolling_confidence: number;
  completed: boolean;
};

type Decision = {
  action: string;
  branching_fired: string | null;
  rationale: string;
  next_competency: string | null;
};

export default function AdaptiveAssessmentRuntime({
  userInputs,
  onComplete,
  variant = 'preview',
  autoStart = false,
}: {
  userInputs: {
    currentRole?: string;
    targetRole?: string;
    industry?: string;
    careerStage?: string;
    orgLayer?: string;
    orgMaturity?: string;
    experienceYears?: number | null;
    currentDepartment?: string | null;
    currentSubDepartment?: string | null;
  };
  /** Called when the adaptive session finishes (so the parent can route to the results screen). */
  onComplete?: (result: { final_score: number; signals: Array<{ signal_type: string; signal_value: number; signal_band: string }> }) => void;
  /** 'preview' (default) = compact preview panel. 'fullscreen' = primary assessment flow (suppresses preview chrome). */
  variant?: 'preview' | 'fullscreen';
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [start, setStart] = useState<StartResult | null>(null);
  const [states, setStates] = useState<SessionState[]>([]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [currentCompetency, setCurrentCompetency] = useState<string | null>(null);
  const [question, setQuestion] = useState<AdaptiveQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(0.6);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState<{ final_score: number; signals: Array<{ signal_type: string; signal_value: number; signal_band: string }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const questionShownAt = useRef<number>(Date.now());

  useEffect(() => { adaptiveAssessmentV2.isEnabled().then(setEnabled); }, []);

  // autoStart: when the parent mounts us as the primary flow, kick off the session as soon as the flag resolves.
  // Guarded against double-start because onStart sets `start` which the effect re-evaluates.
  const autoStartedRef = useRef(false);

  const mapContext = useCallback(() => {
    const i = (userInputs.industry || '').toLowerCase();
    const s = (userInputs.careerStage || '').toLowerCase();
    // Prefer explicit orgLayer/orgMaturity if provided; fall back to string sniffing on careerStage.
    const layerExplicit = (userInputs.orgLayer || '').toLowerCase();
    const layerSniffed = s.includes('exec') || s.includes('director') ? 'executive'
                       : s.includes('lead') || s.includes('principal') ? 'leadership'
                       : s.includes('manager') ? 'managerial'
                       : s.includes('senior') || s.includes('specialist') ? 'specialist'
                       : null;
    const maturityExplicit = (userInputs.orgMaturity || '').toLowerCase();
    const maturitySniffed = s.includes('founder') || s.includes('startup') ? 'startup'
                          : s.includes('senior') || s.includes('exec') || s.includes('director') ? 'enterprise'
                          : null;
    return {
      industry_id: i.includes('ai') || i.includes('ml') ? 'ai_ml' : i.includes('health') ? 'healthcare' : i.includes('finance') || i.includes('bank') ? 'regulated' : null,
      layer_id: layerExplicit || layerSniffed,
      org_maturity: maturityExplicit || maturitySniffed,
      seniority_band: userInputs.careerStage || null,
      experience_years: userInputs.experienceYears ?? null,
      department: userInputs.currentDepartment ?? null,
      sub_department: userInputs.currentSubDepartment ?? null,
      assessment_mode: 'adaptive',
    };
  }, [userInputs.industry, userInputs.careerStage, userInputs.orgLayer, userInputs.orgMaturity, userInputs.experienceYears, userInputs.currentDepartment, userInputs.currentSubDepartment]);

  const pickCtx: PickContext = useMemo(() => ({
    role: userInputs.currentRole || '',
    industry: userInputs.industry || '',
    stage: [userInputs.careerStage, userInputs.orgLayer].filter(Boolean).join(' '),
    department: userInputs.currentDepartment || '',
    subDepartment: userInputs.currentSubDepartment || '',
  }), [userInputs.currentRole, userInputs.industry, userInputs.careerStage, userInputs.orgLayer, userInputs.currentDepartment, userInputs.currentSubDepartment]);

  const pickQuestionForState = useCallback((s: SessionState | undefined, blueprintCompetencies: StartResult['blueprint']['competencies']) => {
    if (!s) return null;
    const bpComp = blueprintCompetencies.find((c) => c.competency_code === s.competency_code);
    const poolKey = bpComp?.pool_keys?.[0] ?? `${s.competency_code.toLowerCase()}_mcq_med`;
    return pickByPool(poolKey, s.questions_served, pickCtx);
  }, [pickCtx]);

  const onStart = useCallback(async () => {
    setError(null);
    const r = await adaptiveAssessmentV2.start(mapContext());
    if (!r?.result) { setError('Failed to start session'); return; }
    const result = r.result as unknown as StartResult;
    setStart(result);
    setCurrentCompetency(result.initial_competency);
    const initStates: SessionState[] = result.blueprint.competencies.map((c) => ({
      competency_code: c.competency_code,
      questions_planned: c.question_count_planned,
      questions_served: 0,
      difficulty_band: result.blueprint.difficulty_band as SessionState['difficulty_band'],
      depth_band: c.depth_band as SessionState['depth_band'],
      rolling_score: 0,
      rolling_confidence: 0,
      completed: false,
    }));
    setStates(initStates);
    const cur = initStates.find((s) => s.competency_code === result.initial_competency);
    const q = pickQuestionForState(cur, result.blueprint.competencies);
    setQuestion(q);
    setSelected(null);
    questionShownAt.current = Date.now();
  }, [mapContext, pickQuestionForState]);

  const onSubmit = useCallback(async () => {
    if (!start || !currentCompetency || !question || selected == null) return;
    setSubmitting(true);
    try {
      const score = question.best_option != null && selected === question.best_option ? 90 : 40;
      const r = await adaptiveAssessmentV2.submitResponse({
        sessionId: start.session_id,
        competencyCode: currentCompetency,
        score,
        confidence,
        responseTimeMs: Date.now() - questionShownAt.current,
        questionId: question.id,
        questionType: question.question_type,
        difficulty: question.difficulty,
      });
      if (!r) { setError('Submit failed'); return; }
      setDecision(r.decision as unknown as Decision);
      setStates(r.states as unknown as SessionState[]);

      if ((r.decision as unknown as Decision).action === 'complete_session') {
        const done = await adaptiveAssessmentV2.complete(start.session_id);
        if (done?.result) {
          const payload = {
            final_score: done.result.final_score,
            signals: done.result.behavioural_signals as Array<{ signal_type: string; signal_value: number; signal_band: string }>,
          };
          setComplete(payload);
          if (onComplete) onComplete(payload);
        }
        return;
      }
      const nextComp = (r.decision as unknown as Decision).next_competency ?? currentCompetency;
      setCurrentCompetency(nextComp);
      const nextState = (r.states as unknown as SessionState[]).find((s) => s.competency_code === nextComp);
      const nextQ = pickQuestionForState(nextState, start.blueprint.competencies);
      setQuestion(nextQ);
      setSelected(null);
      questionShownAt.current = Date.now();
    } finally {
      setSubmitting(false);
    }
  }, [start, currentCompetency, question, selected, confidence, pickQuestionForState]);

  const totalServed = useMemo(() => states.reduce((s, x) => s + x.questions_served, 0), [states]);
  const totalPlanned = start?.total_questions ?? 0;

  if (enabled === null) return null;
  if (enabled === false) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 border border-indigo-200 rounded-2xl p-5 space-y-4" data-testid="adaptive-assessment-runtime">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-semibold tracking-wide">V2 ADAPTIVE</span>
          <h3 className="text-base font-semibold text-gray-900">Adaptive Assessment Runtime</h3>
        </div>
        {start && !complete && (
          <div className="text-xs text-gray-600 tabular-nums">{totalServed} / {totalPlanned} questions</div>
        )}
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Developmental signals only — not a hiring, promotion, or suitability prediction.
        Powered by ontology-driven Role DNA + adaptive runtime.
      </p>

      {!start && !complete && (
        <button
          type="button"
          onClick={onStart}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          data-testid="adaptive-start-btn"
        >
          Start adaptive session
        </button>
      )}

      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      {start && !complete && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border border-indigo-100 rounded-xl p-4 space-y-3">
            {question ? (
              <>
                <div className="text-[10px] uppercase tracking-wide text-indigo-700 font-semibold">
                  {currentCompetency} · {question.difficulty} · {question.depth} · {question.question_type}
                </div>
                <div className="text-sm text-gray-900 font-medium">{question.prompt}</div>
                <div className="space-y-1.5">
                  {(question.options ?? []).map((o, i) => (
                    <label key={i} className={`flex items-start gap-2 p-2 rounded-lg border text-sm cursor-pointer ${selected === i ? 'bg-indigo-50 border-indigo-300' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="opt" checked={selected === i} onChange={() => setSelected(i)} className="mt-1" />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <label className="text-[11px] text-gray-600">Your confidence
                    <input type="range" min={0} max={1} step={0.05} value={confidence}
                      onChange={(e) => setConfidence(Number(e.target.value))} className="ml-2 align-middle" />
                    <span className="ml-1 tabular-nums">{(confidence * 100).toFixed(0)}%</span>
                  </label>
                  <button type="button" disabled={selected == null || submitting} onClick={onSubmit}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40">
                    {submitting ? 'Submitting…' : 'Submit response'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-500 italic">No question available for this pool — backend orchestrator will advance.</div>
            )}
          </div>

          <div className="bg-white border border-indigo-100 rounded-xl p-3 space-y-2 text-[11px]">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Competency progress</div>
            {states.map((s) => (
              <div key={s.competency_code} className="flex items-center gap-2">
                <span className="w-10 font-mono font-semibold text-gray-700">{s.competency_code}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${s.completed ? 'bg-green-500' : 'bg-indigo-500'}`}
                       style={{ width: `${Math.min(100, (s.questions_served / Math.max(1, s.questions_planned)) * 100)}%` }} />
                </div>
                <span className="w-10 text-right tabular-nums text-gray-500">{s.questions_served}/{s.questions_planned}</span>
              </div>
            ))}
            {decision?.branching_fired && (
              <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                <b>Branching:</b> {decision.branching_fired}<br />
                <span className="text-[10px]">{decision.rationale}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {complete && (
        <div className="bg-white border border-emerald-200 rounded-xl p-4 space-y-3">
          <div className="text-base font-semibold text-emerald-900">Session complete</div>
          <div className="text-xs text-gray-600">Final composite signal: <b className="text-gray-900 tabular-nums">{complete.final_score.toFixed(1)}</b></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
            {complete.signals.map((s) => (
              <div key={s.signal_type} className="border border-gray-200 rounded p-2">
                <div className="font-semibold text-gray-800 capitalize">{s.signal_type}</div>
                <div className="tabular-nums text-gray-700">{s.signal_value.toFixed(1)} <span className="text-gray-400">({s.signal_band})</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
