import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useRef } from 'react';
import {
  Brain, Play, ChevronRight, Clock, Award, BarChart2, Target,
  Users, Zap, TrendingUp, CheckCircle, AlertTriangle, ArrowRight,
  RotateCcw, Star, Shield, MessageSquare, RefreshCw, ChevronDown, ChevronUp,
  Flame, Activity, Flag
} from 'lucide-react';
import { Button } from '@/components/ui/button';



const api = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(`/api/career${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
};

interface Scenario {
  id: string; title: string; type: string; difficulty: string;
  description: string; estimatedMinutes: number; competencyFocus: string[];
  tags: string[]; nodeCount: number;
}
interface CatalogGroup { type: string; label: string; scenarios: Scenario[] }
interface Choice { id: string; label: string; subtext?: string; signalTags: string[] }
interface Node {
  id: string; sequence: number; prompt: string; context?: string;
  choices: Choice[]; requiresReflection: boolean; timePressure?: number;
}
interface Session {
  sessionId: string; scenario: { id: string; title: string; type: string; context: string; objective: string; estimatedMinutes: number; nodeCount: number };
  currentNode: Node; npcStates: Record<string, { state: string; escalationLevel: number }>;
  progress?: { current: number; total: number };
}
interface Report {
  overallScore: number; overallLabel: string; optimalPct: number;
  behavioralArchetype: string; behavioralSignals: Record<string, number>;
  overallBehavioralEI: number;
  leadershipSignals: { signal: string; strength: string }[];
  competencyMapping: { competencyId: string; evidenceScore: number }[];
  growthPrompts: string[];
  stakeholderOutcomes: { name: string; role: string; satisfactionScore: number; finalState: string; outcomeLabel: string }[];
  reflectionQuality: { avgScore: number; reflectionsSubmitted: number; depthLabel: string };
  keyDecisions: { nodeId: string; choiceLabel: string; score: number; impact: string }[];
}

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: BRAND.green, intermediate: BRAND.orange, advanced: BRAND.red,
};
const TYPE_ICON: Record<string, React.ReactNode> = {
  leadership: <Users size={18} />, strategic: <Target size={18} />,
  conflict: <Shield size={18} />, operational: <Activity size={18} />,
  'emotional-intelligence': <Brain size={18} />, negotiation: <MessageSquare size={18} />,
};
const SIGNAL_LABELS: Record<string, string> = {
  empathy: 'Empathy', hesitation: 'Decisiveness', confidence: 'Confidence',
  strategy: 'Strategic Thinking', stressHandling: 'Stress Management',
  communicationStructure: 'Communication', ambiguityTolerance: 'Ambiguity Tolerance',
};
const STRENGTH_COLOR: Record<string, string> = {
  strong: BRAND.green, emerging: BRAND.orange, absent: '#94a3b8',
};

function ScenarioCard({ s, groupType, onStart }: { s: Scenario; groupType: string; onStart: () => void }) {
  const displayType = s.type ?? groupType ?? '';
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: BRAND.primary }}>
            {TYPE_ICON[displayType] ?? <Brain size={18} />}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{displayType.replace(/-/g, ' ')}</p>
            <h3 className="font-semibold text-gray-800 text-[14px] leading-tight">{s.title}</h3>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: DIFFICULTY_COLOR[s.difficulty] ?? BRAND.primary }}>
          {s.difficulty}
        </span>
      </div>
      <p className="text-[12px] text-gray-500 mb-3 leading-relaxed">{s.description}</p>
      <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-4">
        <span className="flex items-center gap-1"><Clock size={11} /> {s.estimatedMinutes} min</span>
        <span className="flex items-center gap-1"><Target size={11} /> {s.competencyFocus.slice(0, 2).join(', ')}</span>
      </div>
      <div className="flex flex-wrap gap-1 mb-4">
        {s.tags.map(t => (
          <span key={t} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{t}</span>
        ))}
      </div>
      <button onClick={onStart}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: BRAND.primary }}>
        <Play size={13} /> Start Simulation
      </button>
    </div>
  );
}

function SignalBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? BRAND.green : value >= 50 ? BRAND.orange : '#94a3b8';
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export function SimulationsTab({ profile: _profile, eiScore: _eiScore }: { profile: unknown; eiScore: number }) {
  const [catalog, setCatalog] = useState<CatalogGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<'catalog' | 'playing' | 'reflecting' | 'report'>('catalog');
  const [sessionId, setSessionId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [starting, setStarting] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [reflectText, setReflectText] = useState('');
  const [reflectSubmitting, setReflectSubmitting] = useState(false);
  const [lastDecision, setLastDecision] = useState<{ choiceLabel: string; score: number; isOptimal: boolean; npcReaction: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [completedSessionIds, setCompletedSessionIds] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api('GET', '/simulations/catalog').then(d => {
      setCatalog(d.catalog ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const startTimer = (secs: number) => {
    setTimeLeft(secs);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const startSim = async (scenarioId: string) => {
    setStarting(scenarioId);
    const d = await api('POST', '/simulations/start', { scenarioId });
    setStarting('');
    if (d.sessionId) {
      setSessionId(d.sessionId);
      setSession(d);
      setLastDecision(null);
      setPhase('playing');
      if (d.currentNode?.timePressure) startTimer(d.currentNode.timePressure);
    }
  };

  const decide = async (choiceId: string) => {
    if (!sessionId || deciding) return;
    setDeciding(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const d = await api('POST', `/simulations/session/${sessionId}/decide`, { choiceId });
    setDeciding(false);
    if (d.choiceScore !== undefined) {
      setLastDecision({ choiceLabel: session?.currentNode.choices.find(c => c.id === choiceId)?.label ?? '', score: d.choiceScore, isOptimal: d.isOptimal, npcReaction: d.npcReaction ?? '' });
      if (d.sessionComplete) {
        await completeSession();
        return;
      }
      if (d.nextNode) {
        setSession(prev => prev ? { ...prev, currentNode: d.nextNode, npcStates: d.npcStates ?? prev.npcStates, progress: d.progress } : prev);
        if (d.nextNode.requiresReflection) {
          setPhase('reflecting');
          setReflectText('');
        } else {
          if (d.nextNode.timePressure) startTimer(d.nextNode.timePressure);
        }
      }
    }
  };

  const submitReflect = async () => {
    if (!sessionId || reflectText.trim().length < 20) return;
    setReflectSubmitting(true);
    await api('POST', `/simulations/session/${sessionId}/reflect`, { response: reflectText, nodeId: session?.currentNode.id });
    setReflectSubmitting(false);
    setPhase('playing');
    setReflectText('');
    if (session?.currentNode.timePressure) startTimer(session.currentNode.timePressure);
  };

  const completeSession = async () => {
    const d = await api('POST', `/simulations/session/${sessionId}/complete`, {});
    const r = d.report ?? d;
    setReport(r);
    setCompletedSessionIds(prev => [...prev, sessionId]);
    setPhase('report');
  };

  const resetToCalog = () => {
    setPhase('catalog');
    setSession(null);
    setReport(null);
    setLastDecision(null);
    setSessionId('');
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(null);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
      <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-sm">Loading simulations…</p>
    </div>
  );

  if (phase === 'report' && report) return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Simulation Complete</h2>
          <p className="text-sm text-gray-500 mt-0.5">Your behavioral intelligence report</p>
        </div>
        <button onClick={resetToCalog} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-all">
          <RotateCcw size={13} /> New simulation
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Overall Score', value: `${report.overallScore}`, sub: report.overallLabel, color: report.overallScore >= 70 ? BRAND.green : report.overallScore >= 50 ? BRAND.orange : BRAND.red },
          { label: 'Optimal Choices', value: `${report.optimalPct}%`, sub: 'of decisions', color: BRAND.primary },
          { label: 'Behavioral EI', value: `${report.overallBehavioralEI}`, sub: '/ 100', color: BRAND.accent },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <p className="text-3xl font-black mb-1" style={{ color: m.color }}>{m.value}</p>
            <p className="text-[11px] text-gray-400">{m.sub}</p>
            <p className="text-[12px] font-semibold text-gray-600 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Brain size={16} style={{ color: BRAND.primary }} />
          <h3 className="font-semibold text-gray-800">Behavioral Archetype</h3>
        </div>
        <p className="text-2xl font-black mb-1" style={{ color: BRAND.primary }}>{report.behavioralArchetype}</p>
        <p className="text-sm text-gray-500">Based on your decision patterns, reaction signals, and reflective quality across this scenario.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><BarChart2 size={15} style={{ color: BRAND.primary }} /> Behavioral Signals</h3>
          {Object.entries(report.behavioralSignals).map(([k, v]) => (
            <SignalBar key={k} label={SIGNAL_LABELS[k] ?? k} value={Math.round(v)} />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Zap size={15} style={{ color: BRAND.orange }} /> Leadership Signals</h3>
          <div className="space-y-3">
            {report.leadershipSignals.map(s => (
              <div key={s.signal} className="flex items-center justify-between">
                <span className="text-[12px] text-gray-700">{s.signal}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: STRENGTH_COLOR[s.strength] ?? '#94a3b8' }}>
                  {s.strength}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {report.growthPrompts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><TrendingUp size={15} style={{ color: BRAND.green }} /> Growth Prompts</h3>
          <div className="space-y-2">
            {report.growthPrompts.filter(Boolean).map((p, i) => (
              <div key={i} className="flex gap-3 p-3 bg-blue-50 rounded-xl">
                <div className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5" style={{ background: BRAND.primary }}>{i + 1}</div>
                <p className="text-[12px] text-gray-700 leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.stakeholderOutcomes?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Users size={15} style={{ color: BRAND.accent }} /> Stakeholder Outcomes</h3>
          <div className="grid grid-cols-2 gap-3">
            {report.stakeholderOutcomes.map(o => (
              <div key={o.name} className="p-3 bg-gray-50 rounded-xl">
                <p className="font-semibold text-[12px] text-gray-800">{o.name}</p>
                <p className="text-[10px] text-gray-400 mb-2">{o.role}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold" style={{ color: o.satisfactionScore >= 70 ? BRAND.green : o.satisfactionScore >= 50 ? BRAND.orange : BRAND.red }}>
                    {o.satisfactionScore}% satisfied
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">{o.outcomeLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (phase === 'reflecting') return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h3 className="font-bold text-amber-800 mb-1 flex items-center gap-2"><MessageSquare size={15} /> Reflection Required</h3>
        <p className="text-[13px] text-amber-700">The next phase requires a reflection. Write honestly — quality matters more than length.</p>
      </div>
      {lastDecision && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-[11px] text-gray-400 mb-1">Your last choice</p>
          <p className="font-medium text-gray-800 text-sm">"{lastDecision.choiceLabel}"</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[12px] font-bold" style={{ color: lastDecision.score >= 70 ? BRAND.green : BRAND.orange }}>Score: {lastDecision.score}</span>
            {lastDecision.isOptimal && <span className="text-[11px] px-2 py-0.5 rounded-full text-white font-semibold" style={{ background: BRAND.green }}>Optimal</span>}
          </div>
          {lastDecision.npcReaction && <p className="text-[12px] italic text-gray-500 mt-2">{lastDecision.npcReaction}</p>}
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Your reflection</label>
          <p className="text-[11px] text-gray-400 mb-3">What drove your decision? What trade-off did you accept? What would change your mind?</p>
          <textarea
            value={reflectText}
            onChange={e => setReflectText(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-[13px] text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
            rows={5}
            placeholder="I chose this because… The trade-off I accepted was… I would reconsider if…"
          />
          <p className="text-[10px] text-gray-400 mt-1">{reflectText.trim().split(/\s+/).filter(Boolean).length} words — aim for 30+</p>
        </div>
        <div className="flex gap-3">
          <button onClick={submitReflect} disabled={reflectSubmitting || reflectText.trim().length < 20}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: BRAND.primary }}>
            {reflectSubmitting ? 'Submitting…' : 'Submit Reflection →'}
          </button>
          <button onClick={() => setPhase('playing')} className="px-4 py-2.5 rounded-xl text-[13px] text-gray-500 border border-gray-200 hover:border-gray-300">
            Skip
          </button>
        </div>
      </div>
    </div>
  );

  if (phase === 'playing' && session) return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">{session.scenario.title}</h2>
          <p className="text-[12px] text-gray-400 capitalize">{session.scenario.type.replace('-', ' ')} · {session.scenario.estimatedMinutes} min</p>
        </div>
        <div className="flex items-center gap-3">
          {timeLeft !== null && (
            <div className="flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-lg" style={{ background: timeLeft < 30 ? '#fef2f2' : '#f0fdf4', color: timeLeft < 30 ? BRAND.red : BRAND.green }}>
              <Clock size={13} />{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          )}
          {session.progress && (
            <span className="text-[12px] text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
              {session.progress.current}/{session.progress.total}
            </span>
          )}
        </div>
      </div>

      {session.scenario.objective && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-blue-600 mb-1 uppercase tracking-wide">Objective</p>
          <p className="text-[13px] text-blue-800">{session.scenario.objective}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {session.currentNode.context && (
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <p className="text-[12px] text-gray-500 italic">{session.currentNode.context}</p>
          </div>
        )}
        <p className="font-medium text-gray-800 text-[15px] leading-relaxed mb-6">{session.currentNode.prompt}</p>
        <div className="space-y-3">
          {session.currentNode.choices.map(c => (
            <button key={c.id} onClick={() => decide(c.id)} disabled={deciding}
              className="w-full text-left p-4 rounded-xl border-2 border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group disabled:opacity-50">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg font-bold text-[13px] flex items-center justify-center text-white shrink-0 mt-0.5" style={{ background: BRAND.primary }}>
                  {c.id.toUpperCase()}
                </span>
                <div>
                  <p className="font-medium text-gray-800 text-[13px] group-hover:text-blue-900">{c.label}</p>
                  {c.subtext && <p className="text-[11px] text-gray-400 mt-0.5 italic">{c.subtext}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {lastDecision && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-[12px] font-semibold text-green-700 mb-1">Last decision: "{lastDecision.choiceLabel}"</p>
          {lastDecision.npcReaction && <p className="text-[12px] text-green-600 italic">{lastDecision.npcReaction}</p>}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={resetToCalog} className="text-sm text-gray-400 hover:text-gray-600">← Exit</button>
        <button onClick={completeSession} className="text-sm text-gray-400 hover:text-gray-600">Skip to report →</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Brain size={20} style={{ color: BRAND.primary }} /> AI Leadership Simulations
          </h2>
          <p className="text-sm text-gray-500 mt-1">Practice high-stakes scenarios. Get a behavioral intelligence report based on your decisions.</p>
        </div>
        {completedSessionIds.length > 0 && (
          <div className="flex items-center gap-1.5 text-[12px] text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
            <CheckCircle size={12} /> {completedSessionIds.length} completed
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 bg-blue-50 rounded-2xl p-5">
        {[
          { icon: <Brain size={18} />, label: '6 Scenarios', sub: 'Across 6 competency domains' },
          { icon: <BarChart2 size={18} />, label: 'Behavioral Report', sub: 'Signal scoring + archetype' },
          { icon: <TrendingUp size={18} />, label: 'EI Mapping', sub: 'Competency evidence capture' },
        ].map(f => (
          <div key={f.label} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: BRAND.primary }}>{f.icon}</div>
            <div>
              <p className="font-semibold text-gray-800 text-[13px]">{f.label}</p>
              <p className="text-[11px] text-gray-500">{f.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {catalog.map(group => (
        <div key={group.type}>
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-[13px] uppercase tracking-wide">
            {TYPE_ICON[group.type]} {group.label}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {group.scenarios.map(s => (
              <ScenarioCard key={s.id} s={s} groupType={group.type} onStart={() => startSim(s.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
