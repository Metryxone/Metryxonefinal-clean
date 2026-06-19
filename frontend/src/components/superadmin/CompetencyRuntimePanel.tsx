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

const TYPE_LABELS: Record<string, string> = {
  behavioral: 'Behavioral',
  cognitive: 'Cognitive',
  functional: 'Functional',
  technical: 'Technical',
  future_skills: 'Future Skills',
};

const FIT_COLORS: Record<string, string> = {
  strong: 'bg-emerald-100 text-emerald-800',
  good: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  low: 'bg-red-100 text-red-700',
};

const BAND_COLORS: Record<string, string> = {
  ready: 'bg-emerald-100 text-emerald-800',
  nearly_ready: 'bg-green-100 text-green-800',
  developing: 'bg-amber-100 text-amber-800',
  early: 'bg-red-100 text-red-700',
};

const GAP_PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-yellow-100 text-yellow-800',
  none: 'bg-emerald-100 text-emerald-800',
  unprioritized: 'bg-gray-100 text-gray-600',
};

const GAP_PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'Met',
  unprioritized: 'Unprioritized',
};

interface TypeBucket {
  type_key: string;
  competency_count: number;
  measured_count: number;
  avg_score: number | null;
  avg_level: number | null;
}

interface ReadinessComp {
  competency_id: string;
  competency_name: string;
  required_level: number;
  actual_level: number | null;
  weight: number;
  criticality: string;
  attainment: number | null;
  gap: number | null;
}

interface Dashboard {
  subject_id: string;
  profile: { measured: boolean; overall_score: number | null; overall_level: number | null };
  type_profile: {
    measured?: boolean;
    total_competencies: number;
    classified_competencies: number;
    classification_coverage_pct: number | null;
    buckets: TypeBucket[];
    unclassified: { competency_count: number };
    notes?: string[];
  };
  role_readiness: {
    role_id: string | null;
    readiness: {
      role_title: string;
      readiness_score: number;
      readiness_band: string;
      readiness_label: string;
      coverage_pct: number;
      role_fit: { band: string; label: string; score: number; capped_by_critical: boolean };
      strengths: ReadinessComp[];
      gap_areas: ReadinessComp[];
      critical_gaps: ReadinessComp[];
      notes?: string[];
    } | null;
    notes: string[];
  };
  history: {
    count: number;
    history: { instance_id: string; overall_score: number | null; overall_level: number | null; created_at: string | null }[];
  };
}

interface PrioritizedGapRow {
  competency_id: string;
  competency_name: string | null;
  required_level: number;
  current_level: number | null;
  gap: number | null;
  criticality: string;
  priority: 'high' | 'medium' | 'low' | 'none' | 'unprioritized';
  development_need: string;
  measurement: 'domain_proxy' | 'unmeasurable';
}

interface GapEngine {
  measured: boolean;
  coverage_pct: number | null;
  summary: { high: number; medium: number; low: number; none: number; unprioritized: number; development_needs: number };
  gaps: PrioritizedGapRow[];
  notes?: string[];
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

  const [profileSubject, setProfileSubject] = useState('demo_subj_pm');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [gapEngine, setGapEngine] = useState<GapEngine | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadDashboard = async (subject: string) => {
    const [dRes, gRes] = await Promise.all([
      fetch(`/api/competency-runtime/profiles/${encodeURIComponent(subject)}/dashboard`, { credentials: 'include' }),
      fetch(`/api/competency-runtime/gap-engine/${encodeURIComponent(subject)}`, { credentials: 'include' }),
    ]);
    const d = await dRes.json();
    if (!dRes.ok || !d.ok) throw new Error(d.error || `Dashboard failed (${dRes.status})`);
    setDashboard(d.data as Dashboard);
    const g = await gRes.json();
    setGapEngine(gRes.ok && g.ok ? (g.data as GapEngine) : null);
  };

  const loadProfile = async () => {
    setProfileBusy(true);
    setProfileError(null);
    try {
      await loadDashboard(profileSubject);
    } catch (e: any) {
      setProfileError(e?.message || 'Network error');
    } finally {
      setProfileBusy(false);
    }
  };

  // Run the Phase-2 generate→score path (feeds onto_competency_profiles, which
  // the Phase 2.5/2.6 engines read), then load the dashboard.
  const runProfileAssessment = async () => {
    setProfileBusy(true);
    setProfileError(null);
    try {
      const gen = await fetch('/api/competency-runtime/assessment-instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ blueprint_id: blueprintId, subject_id: profileSubject }),
      });
      const gd = await gen.json();
      if (!gen.ok || !gd.ok) throw new Error(gd.error || `Generate failed (${gen.status})`);
      const instanceId = gd.data?.instance_id;
      const total = Number(gd.data?.total_questions ?? 0);
      if (!instanceId || total === 0) throw new Error('No questions generated for this blueprint (empty 7-code bank).');
      // Auto-answer "Agree" (index 3) for every item — a deterministic demo response set.
      const responses = Array.from({ length: total }, (_, i) => ({ index: i, selected_index: 3 }));
      const sc = await fetch(`/api/competency-runtime/assessment-instances/${instanceId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ responses }),
      });
      const sd = await sc.json();
      if (!sc.ok || !sd.ok) throw new Error(sd.error || `Score failed (${sc.status})`);
      await loadDashboard(profileSubject);
    } catch (e: any) {
      setProfileError(e?.message || 'Network error');
    } finally {
      setProfileBusy(false);
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

      {/* Phase 2.5 · 2.6 — Profile & Role Readiness */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-800">Competency Profile & Role Readiness</h3>
          <span className="text-xs font-normal text-gray-500">Phase 2.5 · 2.6</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          5-TYPE competency profile (curated classification) · append-only history · role readiness
          (Readiness % · Role Fit · Strengths · Gaps · Critical Gaps). Reads the domain-proxy profile;
          UNCLASSIFIED / unmeasured is reported honestly, never fabricated.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={profileSubject}
            onChange={(e) => setProfileSubject(e.target.value)}
            placeholder="subject_id"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono w-56"
          />
          <span className="text-xs text-gray-400">role from blueprint: <span className="font-mono">{blueprintId}</span></span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={loadProfile} disabled={profileBusy || !profileSubject.trim()}>
            {profileBusy ? 'Loading…' : 'Load profile'}
          </Button>
          <Button size="sm" onClick={runProfileAssessment} disabled={profileBusy || !profileSubject.trim()}>
            {profileBusy ? 'Running…' : 'Run profile assessment'}
          </Button>
        </div>

        {profileError && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{profileError}</div>
        )}

        {dashboard && !dashboard.profile?.measured && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No scored profile for <span className="font-mono">{dashboard.subject_id}</span> yet. Click
            “Run profile assessment” to generate and score one.
          </div>
        )}

        {dashboard && dashboard.profile?.measured && (
          <div className="mt-5 space-y-5">
            {/* Overall profile */}
            <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-white p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Overall profile</div>
                <div className="text-2xl font-bold text-gray-900">
                  {dashboard.profile.overall_score != null ? `${dashboard.profile.overall_score}/100` : '—'}
                </div>
              </div>
              {levelBadge(dashboard.profile.overall_level, dashboard.profile.overall_level != null ? `Level ${dashboard.profile.overall_level}` : null, 'measured')}
            </div>

            {/* Type profile buckets */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-700">5-TYPE Profile</h4>
                <span className="text-xs text-gray-400">
                  classification coverage {dashboard.type_profile.classification_coverage_pct ?? 0}% ·
                  {' '}{dashboard.type_profile.classified_competencies}/{dashboard.type_profile.total_competencies} classified
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {dashboard.type_profile.buckets.map((b) => (
                  <div key={b.type_key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs font-medium text-gray-700">{TYPE_LABELS[b.type_key] || b.type_key}</div>
                    <div className="text-lg font-bold text-gray-900 mt-0.5">
                      {b.avg_score != null ? `${b.avg_score}` : <span className="text-gray-400 text-sm">unmeasured</span>}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      {b.measured_count}/{b.competency_count} measured
                    </div>
                    <div className="mt-1">
                      {b.avg_level != null
                        ? <Badge className={`${LEVEL_COLORS[b.avg_level] || 'bg-gray-100'} text-[10px]`}>L{b.avg_level}</Badge>
                        : <Badge className="bg-gray-100 text-gray-500 text-[10px]">—</Badge>}
                    </div>
                  </div>
                ))}
              </div>
              {dashboard.type_profile.unclassified.competency_count > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {dashboard.type_profile.unclassified.competency_count} competency(ies) UNCLASSIFIED (no type mapping — honest, not force-bucketed).
                </p>
              )}
            </div>

            {/* Role readiness */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Role Readiness (Phase 2.6)</h4>
              {!dashboard.role_readiness.readiness && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {dashboard.role_readiness.notes?.[0] || 'Readiness unmeasured for this subject.'}
                </div>
              )}
              {dashboard.role_readiness.readiness && (() => {
                const rr = dashboard.role_readiness.readiness!;
                return (
                  <div className="space-y-3">
                    <div className="rounded-xl border bg-white p-4 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">{rr.role_title}</div>
                        <div className="text-2xl font-bold text-gray-900">{rr.readiness_score}%</div>
                        <div className="text-xs text-gray-500 mt-0.5">coverage {rr.coverage_pct}% of role weight</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge className={BAND_COLORS[rr.readiness_band] || 'bg-gray-100'}>{rr.readiness_label}</Badge>
                        <Badge className={FIT_COLORS[rr.role_fit.band] || 'bg-gray-100'}>Fit: {rr.role_fit.label}</Badge>
                        {rr.role_fit.capped_by_critical && (
                          <span className="text-[10px] text-red-600">capped by critical gap</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs font-semibold text-emerald-800 mb-1.5">Strengths ({rr.strengths.length})</div>
                        {rr.strengths.length === 0 && <div className="text-xs text-emerald-700/70">None met-or-exceeded.</div>}
                        {rr.strengths.map((c) => (
                          <div key={c.competency_id} className="text-xs text-emerald-900 flex justify-between gap-2 py-0.5">
                            <span className="truncate">{c.competency_name}</span>
                            <span className="font-mono shrink-0">L{c.actual_level}/{c.required_level}</span>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xs font-semibold text-amber-800 mb-1.5">Gap Areas ({rr.gap_areas.length})</div>
                        {rr.gap_areas.length === 0 && <div className="text-xs text-amber-700/70">No gaps.</div>}
                        {rr.gap_areas.map((c) => (
                          <div key={c.competency_id} className="text-xs text-amber-900 flex justify-between gap-2 py-0.5">
                            <span className="truncate">{c.competency_name}</span>
                            <span className="font-mono shrink-0">{c.actual_level != null ? `L${c.actual_level}` : '—'}/{c.required_level}</span>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="text-xs font-semibold text-red-800 mb-1.5">Critical Gaps ({rr.critical_gaps.length})</div>
                        {rr.critical_gaps.length === 0 && <div className="text-xs text-red-700/70">None blocking.</div>}
                        {rr.critical_gaps.map((c) => (
                          <div key={c.competency_id} className="text-xs text-red-900 flex justify-between gap-2 py-0.5">
                            <span className="truncate">{c.competency_name}</span>
                            <span className="font-mono shrink-0">{c.actual_level != null ? `L${c.actual_level}` : '—'}/{c.required_level}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Phase 2.7 — Competency Gap Analysis (prioritized) */}
            {gapEngine && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  Competency Gap Analysis
                  <span className="text-xs font-normal text-gray-500">Phase 2.7</span>
                </h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge className="bg-red-100 text-red-800">High {gapEngine.summary.high}</Badge>
                  <Badge className="bg-amber-100 text-amber-800">Medium {gapEngine.summary.medium}</Badge>
                  <Badge className="bg-yellow-100 text-yellow-800">Low {gapEngine.summary.low}</Badge>
                  <Badge className="bg-emerald-100 text-emerald-800">Met {gapEngine.summary.none}</Badge>
                  <Badge className="bg-gray-100 text-gray-700">Unprioritized {gapEngine.summary.unprioritized}</Badge>
                  <Badge className="bg-blue-100 text-blue-800">{gapEngine.summary.development_needs} development need(s)</Badge>
                </div>
                <div className="overflow-x-auto rounded-xl border bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-500 text-left">
                        <th className="px-3 py-2 font-semibold">Competency</th>
                        <th className="px-3 py-2 font-semibold text-center">Required</th>
                        <th className="px-3 py-2 font-semibold text-center">Current</th>
                        <th className="px-3 py-2 font-semibold text-center">Gap</th>
                        <th className="px-3 py-2 font-semibold text-center">Priority</th>
                        <th className="px-3 py-2 font-semibold">Development Need</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapEngine.gaps.map((g) => (
                        <tr key={g.competency_id} className="border-b last:border-0 align-top">
                          <td className="px-3 py-2 text-gray-900">
                            {g.competency_name}
                            {g.measurement === 'unmeasurable' && (
                              <span className="ml-1 text-[10px] text-gray-400">(unmeasurable)</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-gray-700">L{g.required_level}</td>
                          <td className="px-3 py-2 text-center font-mono text-gray-700">{g.current_level != null ? `L${g.current_level}` : '—'}</td>
                          <td className="px-3 py-2 text-center font-mono text-gray-700">{g.gap != null ? (g.gap > 0 ? `+${g.gap}` : g.gap) : '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge className={GAP_PRIORITY_COLORS[g.priority] || 'bg-gray-100'}>{GAP_PRIORITY_LABELS[g.priority]}</Badge>
                          </td>
                          <td className="px-3 py-2 text-gray-600 max-w-md">{g.development_need}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {gapEngine.summary.unprioritized > 0 && (
                  <p className="text-[11px] text-gray-500 mt-2">
                    Unprioritized competencies are unmeasurable or not yet scored — surfaced honestly, never assigned a fabricated priority.
                  </p>
                )}
              </div>
            )}

            {/* History */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Profile History ({dashboard.history.count})</h4>
              <div className="space-y-1">
                {dashboard.history.history.slice(0, 8).map((h, i) => (
                  <div key={h.instance_id + i} className="flex items-center justify-between text-xs text-gray-600 border-b last:border-0 py-1.5">
                    <span className="font-mono text-gray-400">{h.created_at ? new Date(h.created_at).toLocaleString() : '—'}</span>
                    <span>{h.overall_score != null ? `${h.overall_score}/100` : '—'} {h.overall_level != null && <Badge className={`${LEVEL_COLORS[h.overall_level] || 'bg-gray-100'} text-[10px] ml-1`}>L{h.overall_level}</Badge>}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
