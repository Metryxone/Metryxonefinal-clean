import { useState, useEffect } from 'react';
import { CheckCircle, X, Send, Heart, Book, Home, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  childId: string;
  childName: string;
  onClose?: () => void;
  onSubmitted?: () => void;
}

type MoodLevel = 1 | 2 | 3 | 4 | 5;

interface Section {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  questions: { key: string; label: string; type: 'slider' | 'select'; options?: string[] }[];
}

const SECTIONS: Section[] = [
  {
    key: 'homeEnvironment',
    label: 'Home Environment',
    icon: <Home size={14} />,
    color: '#0B3C5D',
    questions: [
      { key: 'sleepQuality', label: 'Sleep quality this month', type: 'slider' },
      { key: 'studyRoutine', label: 'Consistency of study routine', type: 'slider' },
      { key: 'screenTime', label: 'Screen time (1=excessive, 5=healthy)', type: 'slider' },
      { key: 'mealPattern', label: 'Meal pattern & nutrition', type: 'slider' },
    ],
  },
  {
    key: 'emotionalState',
    label: 'Emotional Wellbeing',
    icon: <Heart size={14} />,
    color: '#4ECDC4',
    questions: [
      { key: 'moodStability', label: 'Mood stability at home', type: 'slider' },
      { key: 'anxietyLevel', label: 'Anxiety about school/exams (1=high, 5=calm)', type: 'slider' },
      { key: 'socialWithdrawal', label: 'Social engagement (1=withdrawn, 5=very social)', type: 'slider' },
      { key: 'confidence', label: 'Self-confidence expressed at home', type: 'slider' },
    ],
  },
  {
    key: 'academicEngagement',
    label: 'Academic Engagement',
    icon: <Book size={14} />,
    color: '#0B3C5D',
    questions: [
      { key: 'homeworkCompletion', label: 'Homework completion without reminders', type: 'slider' },
      { key: 'interestInStudy', label: 'Genuine interest in studies', type: 'slider' },
      { key: 'askingQuestions', label: 'Curiosity — asks questions, shows interest', type: 'slider' },
      { key: 'revisionHabits', label: 'Self-initiated revision habits', type: 'slider' },
    ],
  },
  {
    key: 'physicalWellness',
    label: 'Physical Wellness',
    icon: <Activity size={14} />,
    color: '#4ECDC4',
    questions: [
      { key: 'sleepHours', label: 'Average sleep hours per night', type: 'select', options: ['Less than 6h', '6–7h', '7–8h', '8–9h', '9h+'] },
      { key: 'exerciseFreq', label: 'Physical activity frequency', type: 'select', options: ['None', 'Rarely (1x/week)', 'Sometimes (2-3x/week)', 'Often (4-5x/week)', 'Daily'] },
      { key: 'complaints', label: 'Physical health complaints (1=frequent, 5=none)', type: 'slider' },
      { key: 'energyLevels', label: 'General energy & vitality', type: 'slider' },
    ],
  },
];

const MOOD_OPTIONS = [
  { value: 'excellent', label: 'Excellent', color: '#4ECDC4', emoji: '😄' },
  { value: 'good', label: 'Good', color: '#4ECDC4', emoji: '😊' },
  { value: 'average', label: 'Average', color: '#D97706', emoji: '😐' },
  { value: 'concerning', label: 'Concerning', color: '#D97706', emoji: '😟' },
  { value: 'critical', label: 'Critical', color: '#EF4444', emoji: '😰' },
];

function SliderQuestion({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const getColor = (v: number) => v >= 4 ? '#4ECDC4' : v === 3 ? '#D97706' : '#EF4444';
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-bold" style={{ color: getColor(value) }}>{value}/5</span>
      </div>
      <div className="flex gap-1.5">
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => onChange(n)}
            className="flex-1 h-7 rounded-lg text-[11px] font-bold transition-all"
            style={{
              background: value === n ? getColor(n) : '#F5F7FA',
              color: value === n ? '#fff' : '#9AA4B2',
              border: value === n ? 'none' : '1px solid #E8ECF2',
            }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ParentPeriodicSurvey({ childId, childName, onClose, onSubmitted }: Props) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [overallMood, setOverallMood] = useState<string>('good');
  const [parentConcerns, setParentConcerns] = useState('');
  const [notableChanges, setNotableChanges] = useState('');
  const [supportNeeded, setSupportNeeded] = useState('');
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, Record<string, number | string>>>({
    homeEnvironment: { sleepQuality: 3, studyRoutine: 3, screenTime: 3, mealPattern: 3 },
    emotionalState: { moodStability: 3, anxietyLevel: 3, socialWithdrawal: 3, confidence: 3 },
    academicEngagement: { homeworkCompletion: 3, interestInStudy: 3, askingQuestions: 3, revisionHabits: 3 },
    physicalWellness: { sleepHours: '7–8h', exerciseFreq: 'Sometimes (2-3x/week)', complaints: 3, energyLevels: 3 },
  });

  useEffect(() => {
    const key = `metryx_parent_survey_${childId}`;
    const stored = localStorage.getItem(key);
    if (stored) setLastSubmitted(stored);
  }, [childId]);

  const setAnswer = (section: string, qKey: string, value: number | string) => {
    setAnswers(prev => ({ ...prev, [section]: { ...prev[section], [qKey]: value } }));
  };

  const getCurrentPeriod = () => {
    const now = new Date();
    return now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('metryx_token');
      const res = await fetch('/api/survey/parent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          childId,
          period: getCurrentPeriod(),
          homeEnvironment: answers.homeEnvironment,
          emotionalState: answers.emotionalState,
          academicEngagement: answers.academicEngagement,
          physicalWellness: answers.physicalWellness,
          parentConcerns,
          notableChanges,
          supportNeeded,
          overallMood,
        }),
      });

      if (!res.ok) throw new Error('Submission failed');

      localStorage.setItem(`metryx_parent_survey_${childId}`, new Date().toISOString());
      setSubmitted(true);
      onSubmitted?.();
      toast({ title: 'Monthly check-in saved', description: `Your observations for ${childName} have been added to their growth profile.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to save check-in. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-8 text-center">
        <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(78,205,196,0.1)' }}>
          <CheckCircle size={32} style={{ color: '#4ECDC4' }} />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Check-in Saved</h3>
        <p className="text-sm text-gray-500 mb-2">Your monthly observations for <strong>{childName}</strong> have been saved to their growth profile.</p>
        <p className="text-xs text-gray-400">Next check-in: {new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        {onClose && <button onClick={onClose} className="mt-4 text-sm font-medium text-gray-500 hover:text-gray-700">Close</button>}
      </div>
    );
  }

  const currentSection = SECTIONS[activeSection];
  const isLast = activeSection === SECTIONS.length - 1;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Monthly Parent Check-in</p>
            <h3 className="text-sm font-bold text-gray-900">{childName} · {getCurrentPeriod()}</h3>
            {lastSubmitted && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Last submitted: {new Date(lastSubmitted).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>
        {/* Section tabs */}
        <div className="flex gap-1.5">
          {SECTIONS.map((s, i) => (
            <button key={s.key} onClick={() => setActiveSection(i)}
              className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all"
              style={{ background: activeSection === i ? s.color : 'transparent' }}>
              <span style={{ color: activeSection === i ? '#fff' : '#9AA4B2' }}>{s.icon}</span>
              <span className="text-[8px] font-semibold" style={{ color: activeSection === i ? '#fff' : '#9AA4B2' }}>
                {s.label.split(' ')[0]}
              </span>
            </button>
          ))}
          <button onClick={() => setActiveSection(4)}
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all"
            style={{ background: activeSection === 4 ? '#0B3C5D' : 'transparent' }}>
            <Heart size={14} style={{ color: activeSection === 4 ? '#fff' : '#9AA4B2' }} />
            <span className="text-[8px] font-semibold" style={{ color: activeSection === 4 ? '#fff' : '#9AA4B2' }}>Summary</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 max-h-96 overflow-y-auto">
        {activeSection < 4 && currentSection ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${currentSection.color}15`, color: currentSection.color }}>
                {currentSection.icon}
              </div>
              <p className="text-sm font-semibold" style={{ color: currentSection.color }}>{currentSection.label}</p>
            </div>
            {currentSection.questions.map(q => (
              q.type === 'slider' ? (
                <SliderQuestion key={q.key} label={q.label}
                  value={answers[currentSection.key][q.key] as number}
                  onChange={v => setAnswer(currentSection.key, q.key, v)}
                />
              ) : (
                <div key={q.key} className="mb-3">
                  <p className="text-xs text-gray-600 mb-1.5">{q.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(q.options || []).map(opt => (
                      <button key={opt} onClick={() => setAnswer(currentSection.key, q.key, opt)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: answers[currentSection.key][q.key] === opt ? currentSection.color : '#F5F7FA',
                          color: answers[currentSection.key][q.key] === opt ? '#fff' : '#64748B',
                          border: answers[currentSection.key][q.key] === opt ? 'none' : '1px solid #E8ECF2',
                        }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Overall this month, {childName} is doing…</p>
              <div className="flex gap-2">
                {MOOD_OPTIONS.map(m => (
                  <button key={m.value} onClick={() => setOverallMood(m.value)}
                    className="flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all"
                    style={{
                      background: overallMood === m.value ? m.color : '#F5F7FA',
                      border: overallMood === m.value ? 'none' : '1px solid #E8ECF2',
                    }}>
                    <span className="text-lg">{m.emoji}</span>
                    <span className="text-[9px] font-semibold mt-1" style={{ color: overallMood === m.value ? '#fff' : '#9AA4B2' }}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Notable changes observed this month</p>
              <textarea value={notableChanges} onChange={e => setNotableChanges(e.target.value)}
                placeholder="e.g. Became more interested in reading, showing increased confidence..."
                rows={2} className="w-full text-xs rounded-xl px-3 py-2.5 border outline-none resize-none"
                style={{ borderColor: '#E8ECF2', fontFamily: 'Inter, sans-serif' }} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Areas of concern (if any)</p>
              <textarea value={parentConcerns} onChange={e => setParentConcerns(e.target.value)}
                placeholder="e.g. Seems anxious about upcoming exams, less social than usual..."
                rows={2} className="w-full text-xs rounded-xl px-3 py-2.5 border outline-none resize-none"
                style={{ borderColor: '#E8ECF2', fontFamily: 'Inter, sans-serif' }} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Support needed from MetryxOne</p>
              <textarea value={supportNeeded} onChange={e => setSupportNeeded(e.target.value)}
                placeholder="e.g. Need more guidance on stress management resources, mentor sessions..."
                rows={2} className="w-full text-xs rounded-xl px-3 py-2.5 border outline-none resize-none"
                style={{ borderColor: '#E8ECF2', fontFamily: 'Inter, sans-serif' }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-3 flex gap-2 border-t border-gray-100">
        {activeSection > 0 && (
          <button onClick={() => setActiveSection(s => s - 1)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 border border-gray-200">
            Back
          </button>
        )}
        <div className="flex-1" />
        {activeSection < 4 ? (
          <button onClick={() => setActiveSection(s => s + 1)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: currentSection?.color || '#0B3C5D' }}>
            Continue
          </button>
        ) : (
          <button onClick={submit} disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: '#4ECDC4' }}>
            <Send size={14} />
            {submitting ? 'Saving...' : 'Save Check-in'}
          </button>
        )}
      </div>
    </div>
  );
}
