import { useState, useEffect } from 'react';
import { CheckCircle, ChevronRight } from 'lucide-react';

interface Props {
  childId: string;
  childName: string;
  onComplete?: () => void;
}

const MOOD_OPTIONS = [
  { emoji: '😄', label: 'Great', value: 'great', color: '#4ECDC4' },
  { emoji: '🙂', label: 'Good', value: 'good', color: '#4ECDC4' },
  { emoji: '😐', label: 'Okay', value: 'okay', color: '#D97706' },
  { emoji: '😔', label: 'Low', value: 'low', color: '#EA580C' },
  { emoji: '😟', label: 'Struggling', value: 'struggling', color: '#DC2626' },
];

const SLEEP_OPTIONS = [
  { emoji: '😴', label: 'Well rested', value: 'good' },
  { emoji: '🥱', label: 'Okay', value: 'okay' },
  { emoji: '😩', label: 'Not enough', value: 'poor' },
];

const STRESS_OPTIONS = [
  { emoji: '😌', label: 'Relaxed', value: 'low' },
  { emoji: '🤔', label: 'Some pressure', value: 'medium' },
  { emoji: '😰', label: 'Stressed', value: 'high' },
];

const DAYS_BETWEEN_CHECKINS = 7;

function getDaysSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

export function QuickCheckIn({ childId, childName, onComplete }: Props) {
  const storageKey = `metryx_quick_checkin_${childId}`;
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0); // 0=mood, 1=sleep, 2=stress, 3=done
  const [mood, setMood] = useState('');
  const [sleep, setSleep] = useState('');
  const [stress, setStress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastDate, setLastDate] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      setVisible(true);
    } else {
      const days = getDaysSince(stored);
      setLastDate(stored);
      if (days >= DAYS_BETWEEN_CHECKINS) setVisible(true);
    }
  }, [childId]);

  const select = (field: 'mood' | 'sleep' | 'stress', value: string) => {
    if (field === 'mood') setMood(value);
    if (field === 'sleep') setSleep(value);
    if (field === 'stress') setStress(value);
    setTimeout(() => setStep(s => s + 1), 280);
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = localStorage.getItem('metryx_token');
      const now = new Date();
      await fetch('/api/survey/parent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          childId,
          period: now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
          emotionalState: { moodStability: mood === 'great' ? 5 : mood === 'good' ? 4 : mood === 'okay' ? 3 : mood === 'low' ? 2 : 1 },
          physicalWellness: { sleepHours: sleep === 'good' ? '8–9h' : sleep === 'okay' ? '7–8h' : 'Less than 6h' },
          homeEnvironment: { studyRoutine: stress === 'low' ? 5 : stress === 'medium' ? 3 : 1 },
          overallMood: mood,
        }),
      });
      localStorage.setItem(storageKey, new Date().toISOString());
      setStep(3);
      onComplete?.();
    } catch {
      setSubmitError("Couldn't load data. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  const nextCheckIn = lastDate
    ? new Date(new Date(lastDate).getTime() + DAYS_BETWEEN_CHECKINS * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;

  if (step === 3) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3 border" style={{ background: 'rgba(78,205,196,0.06)', borderColor: 'rgba(78,205,196,0.2)', fontFamily: 'Inter, sans-serif' }}>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(78,205,196,0.12)' }}>
          <CheckCircle size={18} style={{ color: '#4ECDC4' }} />
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: '#4ECDC4' }}>Thanks! Check-in saved.</p>
          <p className="text-[10px] text-gray-400 mt-0.5">We'll remind you again around {nextCheckIn ?? 'next week'}. No app needed.</p>
        </div>
      </div>
    );
  }

  const questions = [
    {
      question: `How is ${childName} feeling this week?`,
      options: MOOD_OPTIONS,
      selected: mood,
      field: 'mood' as const,
    },
    {
      question: `How has ${childName}'s sleep been?`,
      options: SLEEP_OPTIONS,
      selected: sleep,
      field: 'sleep' as const,
    },
    {
      question: `School stress level right now?`,
      options: STRESS_OPTIONS,
      selected: stress,
      field: 'stress' as const,
    },
  ];

  const current = questions[step];
  const isLast = step === 2;
  const allAnswered = mood && sleep && stress;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(11,60,93,0.12)', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2" style={{ background: 'rgba(11,60,93,0.04) 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold tracking-widest uppercase text-gray-400">Weekly Quick Check-in</p>
            <p className="text-xs font-semibold" style={{ color: '#0B3C5D' }}>{childName} · 3 taps, 10 seconds</p>
          </div>
          {/* Step dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-1.5 w-1.5 rounded-full transition-all" style={{ background: i <= step ? '#0B3C5D' : '#E8ECF2', transform: i === step ? 'scale(1.3)' : 'scale(1)' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="px-4 py-3">
        <p className="text-xs font-medium text-gray-600 mb-3">{current.question}</p>
        <div className="flex gap-2 flex-wrap">
          {current.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                select(current.field, opt.value);
              }}
              className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-all flex-1 min-w-0"
              style={{
                background: current.selected === opt.value ? '#0B3C5D' : 'rgba(11,60,93,0.04)',
                border: `1.5px solid ${current.selected === opt.value ? '#0B3C5D' : 'rgba(11,60,93,0.1)'}`,
                transform: current.selected === opt.value ? 'scale(1.04)' : 'scale(1)',
              }}
            >
              <span className="text-xl leading-none">{opt.emoji}</span>
              <span className="text-[9px] font-semibold" style={{ color: current.selected === opt.value ? '#ffffff' : '#64748B' }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Submit error notice */}
      {submitError && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl text-[10px] font-medium" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#DC2626' }}>
          {submitError}
        </div>
      )}

      {/* Navigation footer */}
      <div className="px-4 pb-3.5 flex items-center justify-between">
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Back
          </button>
        ) : (
          <span className="text-[10px] text-gray-300">Takes under 15 seconds</span>
        )}

        {isLast && allAnswered ? (
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: '#4ECDC4' }}
          >
            {submitting ? 'Saving…' : 'Done'}
            {!submitting && <CheckCircle size={12} />}
          </button>
        ) : (
          <span className="text-[10px] text-gray-400">{step + 1} of 3</span>
        )}
      </div>
    </div>
  );
}
