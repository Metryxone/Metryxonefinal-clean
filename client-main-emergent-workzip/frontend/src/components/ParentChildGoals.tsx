import { useState, useEffect } from 'react';
import {
  Target, Plus, CheckCircle, Circle, Trash2, Flag, Calendar, Sparkles,
  BookOpen, Brain, Heart, Briefcase, ChevronRight, ChevronLeft,
  Lightbulb, BarChart3, ListChecks, Clock, X, Info,
} from 'lucide-react';

// ── Brand ────────────────────────────────────────────────────────────────────
const B = { blue: '#0B3C5D', green: '#4ECDC4' };

// ── Types ─────────────────────────────────────────────────────────────────────
interface Goal {
  id: string;
  childId: string;
  title: string;
  kpi: string;
  category: 'academic' | 'behaviour' | 'wellness' | 'career';
  targetDate: string;
  status: 'active' | 'completed' | 'paused';
  progress: number;
  milestones: { label: string; done: boolean }[];
  createdAt: string;
}
interface Props { childId: string; childName: string }

// ── Category meta ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key: 'academic' as const,
    label: 'Academic',
    icon: BookOpen,
    color: B.blue,
    bg: 'rgba(11,60,93,0.06)',
    tagBg: 'rgba(11,60,93,0.1)',
    tagText: B.blue,
    desc: 'Scores, subjects, study habits, exams',
    hint: 'Academic goals work best when they target a specific subject or skill rather than "do better at school."',
    kpiHint: 'Be precise — e.g. "Score 75%+ in Physics across the next 3 tests" or "Complete 1 past-paper per week for 8 weeks." Numbers make progress visible.',
    goalExamples: ['Improve Physics score to 75%', 'Complete daily maths revision', 'Master quadratic equations', 'Improve English essay writing', 'Build a reading habit'],
    milestoneTemplates: ['Set a study schedule', 'Complete first practice test', 'Review all weak topics', 'Score improvement check'],
  },
  {
    key: 'behaviour' as const,
    label: 'Behaviour',
    icon: Brain,
    color: '#0B3C5D',
    bg: 'rgba(124,58,237,0.05)',
    tagBg: 'rgba(124,58,237,0.1)',
    tagText: '#0B3C5D',
    desc: 'Habits, focus, consistency, discipline',
    hint: 'Behaviour goals are about building or breaking a habit. They need a time-boundary and a daily/weekly frequency to track.',
    kpiHint: 'Describe the habit and how often — e.g. "Study for 90 minutes every weekday for 4 consecutive weeks" or "No phone during study time, tracked for 3 weeks." Streaks are measurable.',
    goalExamples: ['Build a daily study habit', 'Reduce phone use during study', 'Improve classroom focus', 'Complete homework before dinner', 'Wake up 30 min earlier for revision'],
    milestoneTemplates: ['Start 3-day streak', 'Complete 1-week streak', 'Complete 2-week streak', 'Full habit locked in'],
  },
  {
    key: 'wellness' as const,
    label: 'Wellness',
    icon: Heart,
    color: '#D97706',
    bg: 'rgba(217,119,6,0.05)',
    tagBg: 'rgba(217,119,6,0.1)',
    tagText: '#D97706',
    desc: 'Sleep, stress, energy, mental balance',
    hint: 'Wellness goals directly affect cognitive performance. A child sleeping 8 hrs vs 6 hrs has measurably different focus and recall.',
    kpiHint: 'Track something observable — e.g. "In bed by 10pm on school nights for 3 weeks" or "Rate stress ≤3/5 in weekly check-in for 4 weeks." Keep it gentle, not punitive.',
    goalExamples: ['Sleep by 10pm on school nights', 'Take a 10-minute walk daily', 'Reduce exam-week anxiety', 'Maintain energy through the school day', 'Practice mindful breathing'],
    milestoneTemplates: ['Set a bedtime routine', '3-day sleep goal met', '1-week streak', 'Sustained for 3 weeks'],
  },
  {
    key: 'career' as const,
    label: 'Career',
    icon: Briefcase,
    color: B.green,
    bg: 'rgba(78,205,196,0.05)',
    tagBg: 'rgba(78,205,196,0.1)',
    tagText: B.green,
    desc: 'Interests, career paths, exploration',
    hint: 'Career goals are about curiosity and discovery — not pressure. Research, conversations, and a mentor session count as real milestones at this stage.',
    kpiHint: 'Define an output — e.g. "Research 3 career paths aligned with LBI profile" or "Complete 1 informational chat with a professional by end of month." Curiosity is measurable.',
    goalExamples: ['Explore 3 career paths using LBI profile', 'Talk to 1 professional in a field of interest', 'Identify top 2 subject strengths', 'Create a 5-year interest map', 'Book a mentor session'],
    milestoneTemplates: ['Read 1 career guide', 'Shortlist top 3 options', 'Informational interview done', 'Action plan created'],
  },
];

// ── Wizard steps ──────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Area', icon: Target },
  { id: 2, label: 'Goal', icon: Flag },
  { id: 3, label: 'KPI', icon: BarChart3 },
  { id: 4, label: 'Milestones', icon: ListChecks },
  { id: 5, label: 'Timeline', icon: Clock },
];

// ── Suggested goals ───────────────────────────────────────────────────────────
const SUGGESTED: Omit<Goal, 'id' | 'childId' | 'status' | 'progress' | 'createdAt'>[] = [
  { title: 'Improve Maths Score', kpi: 'Score 80%+ in the next 3 maths assessments', category: 'academic', targetDate: '', milestones: [{ label: 'Set weekly study schedule', done: false }, { label: 'Complete 2 practice tests', done: false }, { label: 'Review all wrong answers', done: false }, { label: 'Score 80%+ confirmed', done: false }] },
  { title: 'Build Daily Study Habit', kpi: 'Study uninterrupted for 90 min every weekday for 4 weeks', category: 'behaviour', targetDate: '', milestones: [{ label: '3-day streak started', done: false }, { label: '1-week streak done', done: false }, { label: '2-week streak done', done: false }, { label: '4-week habit locked', done: false }] },
  { title: 'Improve Sleep Routine', kpi: 'In bed by 10pm on school nights for 3 consecutive weeks', category: 'wellness', targetDate: '', milestones: [{ label: 'Set phone-off alarm', done: false }, { label: '3-night streak', done: false }, { label: '1-week streak', done: false }, { label: '3-week goal met', done: false }] },
  { title: 'Explore Career Path', kpi: 'Research 3 career paths aligned with LBI profile and shortlist top 1', category: 'career', targetDate: '', milestones: [{ label: 'Read LBI career report', done: false }, { label: 'Research 3 options', done: false }, { label: 'Talk to 1 professional', done: false }, { label: 'Plan next step', done: false }] },
];

// ── Persistence ───────────────────────────────────────────────────────────────
function loadGoals(cid: string): Goal[] {
  try { return JSON.parse(localStorage.getItem(`metryx_goals_${cid}`) || '[]'); }
  catch { return []; }
}
function saveGoals(cid: string, goals: Goal[]) {
  localStorage.setItem(`metryx_goals_${cid}`, JSON.stringify(goals));
}

// ── Hint bubble ───────────────────────────────────────────────────────────────
function Hint({ text }: { text: string }) {
  return (
    <div className="flex gap-2 px-3 py-2.5 rounded-xl mt-2" style={{ background: 'rgba(78,205,196,0.07)', border: '1px solid rgba(78,205,196,0.18)' }}>
      <Lightbulb size={13} className="shrink-0 mt-0.5" style={{ color: B.green }} />
      <p className="text-[11px] leading-relaxed" style={{ color: '#1A4030' }}>{text}</p>
    </div>
  );
}

// ── Step progress bar ─────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-5">
      {STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: done ? B.green : active ? B.blue : 'rgba(11,60,93,0.08)',
                  border: `2px solid ${done ? B.green : active ? B.blue : 'rgba(11,60,93,0.15)'}`,
                }}
              >
                {done
                  ? <CheckCircle size={12} color="#fff" />
                  : <span className="text-[9px] font-bold" style={{ color: active ? '#fff' : 'rgba(11,60,93,0.3)' }}>{s.id}</span>}
              </div>
              <span className="text-[8px] font-semibold tracking-wider uppercase" style={{ color: active ? B.blue : done ? B.green : 'rgba(11,60,93,0.3)' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-1 mb-3 transition-all" style={{ background: done ? B.green : 'rgba(11,60,93,0.12)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function ParentChildGoals({ childId, childName }: Props) {
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals(childId));
  const [showWizard, setShowWizard] = useState(false);
  const [showSuggested, setShowSuggested] = useState(false);
  const [step, setStep] = useState(1);

  // Wizard state
  const [category, setCategory] = useState<Goal['category']>('academic');
  const [title, setTitle] = useState('');
  const [kpi, setKpi] = useState('');
  const [milestones, setMilestones] = useState(['', '', '', '']);
  const [targetDate, setTargetDate] = useState('');
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => { setGoals(loadGoals(childId)); }, [childId]);

  const persist = (updated: Goal[]) => { setGoals(updated); saveGoals(childId, updated); };

  const catMeta = CATEGORIES.find(c => c.key === category)!;

  const resetWizard = () => {
    setStep(1); setTitle(''); setKpi(''); setMilestones(['', '', '', '']); setTargetDate(''); setShowExamples(false);
  };

  const openWizard = () => { resetWizard(); setShowWizard(true); setShowSuggested(false); };

  const handleCategorySelect = (key: Goal['category']) => {
    setCategory(key);
    const meta = CATEGORIES.find(c => c.key === key)!;
    setMilestones(meta.milestoneTemplates);
  };

  const canNext = () => {
    if (step === 1) return true;
    if (step === 2) return title.trim().length > 0;
    if (step === 3) return kpi.trim().length > 0;
    if (step === 4) return true;
    if (step === 5) return true;
    return false;
  };

  const createGoal = () => {
    if (!title.trim()) return;
    const newGoal: Goal = {
      id: `goal_${Date.now()}`,
      childId,
      title,
      kpi,
      category,
      targetDate: targetDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      status: 'active',
      progress: 0,
      milestones: milestones.filter(m => m.trim()).map(label => ({ label, done: false })),
      createdAt: new Date().toISOString(),
    };
    persist([...goals, newGoal]);
    setShowWizard(false);
    resetWizard();
  };

  const addSuggested = (sg: typeof SUGGESTED[0]) => {
    const goal: Goal = {
      id: `goal_${Date.now()}`,
      childId,
      ...sg,
      targetDate: sg.targetDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      status: 'active',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    persist([...goals, goal]);
    setShowSuggested(false);
  };

  const toggleMilestone = (goalId: string, mi: number) => {
    const updated = goals.map(g => {
      if (g.id !== goalId) return g;
      const ms = g.milestones.map((m, i) => i === mi ? { ...m, done: !m.done } : m);
      const progress = ms.length ? Math.round(ms.filter(m => m.done).length / ms.length * 100) : 0;
      return { ...g, milestones: ms, progress, status: progress === 100 ? 'completed' as const : 'active' as const };
    });
    persist(updated);
  };

  const deleteGoal = (id: string) => persist(goals.filter(g => g.id !== id));

  const active = goals.filter(g => g.status !== 'completed');
  const completed = goals.filter(g => g.status === 'completed');

  return (
    <div className="space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={15} style={{ color: B.blue }} />
          <span className="text-sm font-semibold" style={{ color: B.blue }}>Goal Contracts</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-semibold" style={{ background: B.blue }}>{active.length}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowSuggested(s => !s); setShowWizard(false); }}
            className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: 'rgba(78,205,196,0.1)', color: B.green }}
          >
            <Sparkles size={10} /> Suggested
          </button>
          <button
            onClick={openWizard}
            className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg text-white transition-opacity hover:opacity-80"
            style={{ background: B.blue }}
          >
            <Plus size={10} /> New Goal
          </button>
        </div>
      </div>

      {/* ── Suggested ──────────────────────────────────────────────────── */}
      {showSuggested && (
        <div className="bg-white rounded-2xl border p-4 shadow-sm space-y-2" style={{ borderColor: 'rgba(78,205,196,0.2)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: B.green }}>AI-Suggested Goals for {childName}</div>
            <button onClick={() => setShowSuggested(false)}><X size={13} className="text-gray-400" /></button>
          </div>
          {SUGGESTED.map((sg, i) => {
            const meta = CATEGORIES.find(c => c.key === sg.category)!;
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: meta.bg, border: `1px solid ${meta.color}18` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: meta.tagBg, color: meta.tagText }}>{meta.label}</span>
                    <span className="text-[11px] font-semibold" style={{ color: B.blue }}>{sg.title}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">{sg.kpi}</p>
                </div>
                <button onClick={() => addSuggested(sg)} className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: meta.color }}>
                  Add
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Wizard ─────────────────────────────────────────────────────── */}
      {showWizard && (
        <div className="bg-white rounded-2xl border shadow-sm" style={{ borderColor: 'rgba(11,60,93,0.15)' }}>
          {/* Wizard header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b" style={{ borderColor: 'rgba(11,60,93,0.07)' }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New Goal for {childName}</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: B.blue }}>
                {step === 1 && 'Choose a focus area'}
                {step === 2 && 'Name the goal'}
                {step === 3 && 'Define what success looks like'}
                {step === 4 && 'Add stepping-stone milestones'}
                {step === 5 && 'Set the timeline'}
              </p>
            </div>
            <button onClick={() => setShowWizard(false)} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button>
          </div>

          <div className="px-5 py-4">
            <StepBar current={step} />

            {/* ── Step 1: Category ─────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-500 mb-3">Which area of {childName}'s life does this goal cover?</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(c => {
                    const Icon = c.icon;
                    const sel = category === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => handleCategorySelect(c.key)}
                        className="text-left p-3 rounded-xl border-2 transition-all"
                        style={{ background: sel ? c.bg : '#fff', borderColor: sel ? c.color : 'rgba(11,60,93,0.1)' }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}18` }}>
                            <Icon size={13} style={{ color: c.color }} />
                          </div>
                          <span className="text-[11px] font-bold" style={{ color: sel ? c.color : B.blue }}>{c.label}</span>
                          {sel && <CheckCircle size={11} style={{ color: c.color }} />}
                        </div>
                        <p className="text-[9px] text-gray-400 leading-relaxed">{c.desc}</p>
                      </button>
                    );
                  })}
                </div>
                <Hint text={catMeta.hint} />
              </div>
            )}

            {/* ── Step 2: Title ─────────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-3">
                <p className="text-[11px] text-gray-500">What is {childName} working towards? Keep it short and specific.</p>
                <div className="relative">
                  <input
                    autoFocus
                    className="w-full text-sm border-2 rounded-xl px-4 py-3 outline-none transition-all"
                    style={{ borderColor: title.length > 3 ? B.blue : 'rgba(11,60,93,0.15)', background: '#fafafa' }}
                    placeholder={`e.g. "${catMeta.goalExamples[0]}"`}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    onClick={() => setShowExamples(v => !v)}
                    className="flex items-center gap-1 text-[10px] font-semibold"
                    style={{ color: B.green }}
                  >
                    <Info size={10} /> {showExamples ? 'Hide examples' : 'Show goal examples for ' + catMeta.label}
                  </button>
                  {showExamples && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {catMeta.goalExamples.map((ex, i) => (
                        <button
                          key={i}
                          onClick={() => setTitle(ex)}
                          className="text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors hover:opacity-80"
                          style={{ background: catMeta.bg, borderColor: `${catMeta.color}30`, color: catMeta.color }}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Hint text={`A great goal has one clear focus. Instead of "get better at school" try "${catMeta.goalExamples[0]}." The more specific the goal, the easier it is to track and celebrate.`} />
              </div>
            )}

            {/* ── Step 3: KPI ───────────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: catMeta.bg, border: `1px solid ${catMeta.color}25` }}>
                  <Flag size={12} style={{ color: catMeta.color }} />
                  <span className="text-[11px] font-semibold" style={{ color: B.blue }}>{title}</span>
                </div>
                <p className="text-[11px] text-gray-500">What does success actually look like? Write a measurable target — not just a wish.</p>
                <textarea
                  autoFocus
                  className="w-full text-sm border-2 rounded-xl px-4 py-3 outline-none resize-none transition-all"
                  style={{ borderColor: kpi.length > 5 ? B.blue : 'rgba(11,60,93,0.15)', background: '#fafafa' }}
                  placeholder="e.g. Score 75%+ in the next 3 Physics tests"
                  rows={3}
                  value={kpi}
                  onChange={e => setKpi(e.target.value)}
                />
                <Hint text={catMeta.kpiHint} />
              </div>
            )}

            {/* ── Step 4: Milestones ────────────────────────────────────── */}
            {step === 4 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: catMeta.bg, border: `1px solid ${catMeta.color}25` }}>
                  <BarChart3 size={12} style={{ color: catMeta.color }} />
                  <span className="text-[11px] font-semibold italic text-gray-600 truncate">{kpi}</span>
                </div>
                <p className="text-[11px] text-gray-500">Break the journey into 2–4 stepping stones. We've pre-filled some suggestions — edit or clear any you don't need.</p>
                <div className="space-y-2">
                  {milestones.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 text-[9px] font-bold" style={{ borderColor: 'rgba(11,60,93,0.2)', color: 'rgba(11,60,93,0.4)' }}>{i + 1}</div>
                      <input
                        className="flex-1 text-[11px] border rounded-xl px-3 py-2 outline-none transition-all"
                        style={{ borderColor: m.trim() ? 'rgba(11,60,93,0.25)' : 'rgba(11,60,93,0.1)', background: m.trim() ? '#fafafa' : '#f8f8f8' }}
                        placeholder={`Milestone ${i + 1} (optional)`}
                        value={m}
                        onChange={e => setMilestones(ms => ms.map((x, xi) => xi === i ? e.target.value : x))}
                      />
                      {m.trim() && (
                        <button onClick={() => setMilestones(ms => ms.map((x, xi) => xi === i ? '' : x))} className="text-gray-300 hover:text-gray-400"><X size={11} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <Hint text="Milestones are the checkpoints that keep momentum alive. Each one should feel achievable within 1–2 weeks. Completing a milestone triggers a progress update — even small wins matter for motivation." />
              </div>
            )}

            {/* ── Step 5: Timeline ─────────────────────────────────────── */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: catMeta.bg, border: `1px solid ${catMeta.color}25` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: catMeta.tagBg, color: catMeta.tagText }}>{catMeta.label}</span>
                    <span className="text-[11px] font-semibold" style={{ color: B.blue }}>{title}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{kpi}</p>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {milestones.filter(m => m.trim()).map((m, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(11,60,93,0.07)', color: 'rgba(11,60,93,0.5)' }}>✓ {m}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1.5">Target completion date</label>
                  <input
                    type="date"
                    className="w-full text-sm border-2 rounded-xl px-4 py-3 outline-none transition-all"
                    style={{ borderColor: targetDate ? B.blue : 'rgba(11,60,93,0.15)', background: '#fafafa' }}
                    value={targetDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setTargetDate(e.target.value)}
                  />
                </div>

                <Hint text="30-day goals have the highest completion rate. If the goal needs longer, break it into a 30-day first phase and add a second goal later. Short timelines keep energy up." />
              </div>
            )}

            {/* ── Navigation ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t" style={{ borderColor: 'rgba(11,60,93,0.07)' }}>
              <button
                onClick={() => step > 1 ? setStep(s => s - 1) : setShowWizard(false)}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-xl border transition-all hover:bg-gray-50"
                style={{ borderColor: 'rgba(11,60,93,0.15)', color: '#64748B' }}
              >
                <ChevronLeft size={13} /> {step > 1 ? 'Back' : 'Cancel'}
              </button>
              {step < 5 ? (
                <button
                  onClick={() => canNext() && setStep(s => s + 1)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-5 py-2 rounded-xl text-white transition-all"
                  style={{ background: canNext() ? B.blue : 'rgba(11,60,93,0.25)' }}
                >
                  Continue <ChevronRight size={13} />
                </button>
              ) : (
                <button
                  onClick={createGoal}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-5 py-2 rounded-xl text-white transition-all"
                  style={{ background: B.green }}
                >
                  <CheckCircle size={13} /> Create Goal Contract
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {active.length === 0 && !showWizard && !showSuggested && (
        <div className="bg-white rounded-2xl border py-10 text-center shadow-sm" style={{ borderColor: 'rgba(11,60,93,0.08)' }}>
          <Target size={28} className="mx-auto mb-3" style={{ color: 'rgba(11,60,93,0.2)' }} />
          <p className="text-sm font-semibold" style={{ color: B.blue }}>No goals yet</p>
          <p className="text-[11px] text-gray-400 mt-1 mb-4">Set a goal to track {childName}'s progress together</p>
          <button onClick={openWizard} className="text-[11px] font-semibold px-4 py-2 rounded-xl text-white" style={{ background: B.blue }}>
            + Set First Goal
          </button>
        </div>
      )}

      {/* ── Active goals ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {active.map(goal => <GoalCard key={goal.id} goal={goal} onToggle={toggleMilestone} onDelete={deleteGoal} />)}
      </div>

      {/* ── Completed ───────────────────────────────────────────────────── */}
      {completed.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: B.green }}>Completed</p>
          <div className="space-y-2 opacity-60">
            {completed.map(goal => <GoalCard key={goal.id} goal={goal} onToggle={toggleMilestone} onDelete={deleteGoal} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function GoalCard({ goal, onToggle, onDelete }: { goal: Goal; onToggle: (id: string, i: number) => void; onDelete: (id: string) => void }) {
  const meta = CATEGORIES.find(c => c.key === goal.category)!;
  const daysLeft = goal.targetDate ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000) : null;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: `${meta.color}22` }}>
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: meta.bg }}>
          <Flag size={13} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: meta.tagBg, color: meta.tagText }}>{meta.label.toUpperCase()}</span>
            {goal.status === 'completed' && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(78,205,196,0.12)', color: B.green }}>DONE</span>}
          </div>
          <div className="text-[12px] font-semibold" style={{ color: B.blue }}>{goal.title}</div>
          {goal.kpi && <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{goal.kpi}</p>}
        </div>
        <button onClick={() => onDelete(goal.id)} className="text-gray-200 hover:text-gray-400 transition-colors shrink-0 mt-0.5"><Trash2 size={13} /></button>
      </div>

      {/* Progress */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => setExpanded(v => !v)} className="text-[9px] font-semibold" style={{ color: meta.color }}>
            {expanded ? '▲ Hide milestones' : `▼ ${goal.milestones.filter(m => m.done).length}/${goal.milestones.length} milestones`}
          </button>
          <div className="flex items-center gap-2">
            {daysLeft !== null && (
              <span className="text-[9px] flex items-center gap-0.5" style={{ color: daysLeft < 7 ? '#DC2626' : '#94A3B8' }}>
                <Calendar size={9} /> {daysLeft > 0 ? `${daysLeft}d left` : 'Overdue'}
              </span>
            )}
            <span className="text-[10px] font-bold" style={{ color: meta.color }}>{goal.progress}%</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 mb-2">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${goal.progress}%`, background: meta.color }} />
        </div>

        {expanded && goal.milestones.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {goal.milestones.map((m, i) => (
              <button key={i} onClick={() => onToggle(goal.id, i)} className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity">
                {m.done
                  ? <CheckCircle size={13} style={{ color: meta.color, flexShrink: 0 }} />
                  : <Circle size={13} className="text-gray-200 shrink-0" />}
                <span className={`text-[10px] ${m.done ? 'line-through text-gray-300' : 'text-gray-600'}`}>{m.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
