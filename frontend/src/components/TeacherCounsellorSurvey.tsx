import { useEffect, useState } from 'react';
import { CheckCircle, ChevronDown, Send, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  childId: string;
  childName: string;
  onClose?: () => void;
  onSubmitted?: () => void;
  observerType?: 'teacher' | 'counsellor' | 'school_admin';
  observerName?: string;
  observerOrg?: string;
}

const ACADEMIC_ITEMS = [
  { key: 'attention', label: 'Attention & Focus in class' },
  { key: 'participation', label: 'Class participation & engagement' },
  { key: 'homework', label: 'Homework completion rate' },
  { key: 'conceptGrasp', label: 'Speed of concept grasping' },
  { key: 'peerInteraction', label: 'Positive peer interaction' },
];

const EMOTIONAL_ITEMS = [
  { key: 'mood', label: 'Overall mood stability' },
  { key: 'stressSignals', label: 'Signs of exam/academic stress' },
  { key: 'confidence', label: 'Self-confidence in expressing ideas' },
  { key: 'resilience', label: 'Resilience after setbacks' },
  { key: 'motivation', label: 'Intrinsic motivation to learn' },
];

const SOCIAL_ITEMS = [
  { key: 'teamwork', label: 'Teamwork & collaboration' },
  { key: 'leadership', label: 'Leadership / initiative-taking' },
  { key: 'communication', label: 'Verbal communication clarity' },
  { key: 'empathy', label: 'Empathy towards peers' },
  { key: 'discipline', label: 'Classroom discipline & respect' },
];

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Needs Help', color: '#EF4444' },
  2: { label: 'Below Average', color: '#D97706' },
  3: { label: 'Average', color: '#D97706' },
  4: { label: 'Good', color: '#4ECDC4' },
  5: { label: 'Excellent', color: '#0B3C5D' },
};

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-600 flex-1 pr-3">{label}</p>
      <div className="flex gap-1.5 shrink-0">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className="h-7 w-7 rounded-lg text-[11px] font-bold transition-all"
            style={{
              background: value === n ? RATING_LABELS[n].color : 'rgba(0,0,0,0.04)',
              color: value === n ? '#ffffff' : '#9AA4B2',
              border: value === n ? 'none' : '1px solid #E8ECF2',
              transform: value === n ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TeacherCounsellorSurvey({
  childId, childName, onClose, onSubmitted,
  observerType = 'teacher', observerName = '', observerOrg = '',
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const defaultRatings = () => ({ attention: 3, participation: 3, homework: 3, conceptGrasp: 3, peerInteraction: 3 });
  const [academic, setAcademic] = useState<Record<string, number>>(defaultRatings());
  const [emotional, setEmotional] = useState<Record<string, number>>({ mood: 3, stressSignals: 3, confidence: 3, resilience: 3, motivation: 3 });
  const [social, setSocial] = useState<Record<string, number>>({ teamwork: 3, leadership: 3, communication: 3, empathy: 3, discipline: 3 });
  const [concerns, setConcerns] = useState('');
  const [strengths, setStrengths] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [overallRating, setOverallRating] = useState(3);
  const [observerTypeState] = useState(observerType);

  // Task #293 — Journey Tail Completion. When `journeyTailCompletion` is ON, the submit
  // routes the observation into the live downstream store (`/api/journey-tail/observations`),
  // which surfaces it to the parent and a counsellor follow-up queue. When OFF (or probe
  // fails) the legacy `/api/survey/stakeholder` path is used unchanged → byte-identical.
  const [journeyTailEnabled, setJourneyTailEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/journey-tail/enabled', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive) setJourneyTailEnabled(!!j?.enabled); })
      .catch(() => { if (alive) setJourneyTailEnabled(false); });
    return () => { alive = false; };
  }, []);

  const overallAvg = Math.round(
    (Object.values(academic).reduce((a, b) => a + b, 0) / ACADEMIC_ITEMS.length +
     Object.values(emotional).reduce((a, b) => a + b, 0) / EMOTIONAL_ITEMS.length +
     Object.values(social).reduce((a, b) => a + b, 0) / SOCIAL_ITEMS.length) / 3
  );

  const submit = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('metryx_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      // Flag ON → live downstream store (surfaced to parent + counsellor follow-up queue).
      // Flag OFF → legacy dead-end route, byte-identical to prior behaviour.
      const res = journeyTailEnabled
        ? await fetch('/api/journey-tail/observations', {
            method: 'POST', headers, credentials: 'include',
            body: JSON.stringify({
              child_id: childId,
              observer_type: observerTypeState,
              observer_name: observerName,
              organization: observerOrg,
              academic, emotional, social,
              concerns, strengths, recommendations,
              overall_rating: overallRating,
              follow_up_required: followUpRequired,
              share_with_parent: true,
            }),
          })
        : await fetch('/api/survey/stakeholder', {
            method: 'POST', headers, credentials: 'include',
            body: JSON.stringify({
              childId,
              observerType: observerTypeState,
              observerName,
              observerOrg,
              academicBehavior: academic,
              emotionalBehavior: emotional,
              socialBehavior: social,
              concerns,
              strengths,
              recommendations,
              overallRating,
              followUpRequired,
              sharedWithParent: true,
            }),
          });

      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
      onSubmitted?.();
      toast({ title: 'Observation submitted', description: `Your assessment for ${childName} has been saved and shared with the parent.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to submit observation. Please try again.', variant: 'destructive' });
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
        <h3 className="text-base font-bold text-gray-900 mb-1">Observation Submitted</h3>
        <p className="text-sm text-gray-500 mb-4">Your assessment for <strong>{childName}</strong> has been saved and will be visible to the parent in their dashboard.</p>
        {followUpRequired && (
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
            <AlertCircle size={13} />
            Follow-up flagged — parent will be notified
          </div>
        )}
        {onClose && (
          <button onClick={onClose} className="mt-4 block mx-auto text-sm font-medium text-gray-500 hover:text-gray-700">
            Close
          </button>
        )}
      </div>
    );
  }

  const stepTitle = ['Academic Behavior', 'Emotional Wellbeing', 'Social Behavior', 'Summary & Notes'];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
              {observerTypeState === 'counsellor' ? 'Counsellor' : observerTypeState === 'school_admin' ? 'School Admin' : 'Teacher'} Observation
            </p>
            <h3 className="text-sm font-bold text-gray-900">{childName}</h3>
          </div>
          {onClose && (
            <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Step bar */}
        <div className="flex gap-1">
          {stepTitle.map((t, i) => (
            <div key={i} className="flex-1">
              <div className="h-1 rounded-full" style={{ background: i < step ? '#0B3C5D' : i === step - 1 ? '#4ECDC4' : '#E8ECF2' }} />
              <p className="text-[9px] mt-1 font-medium" style={{ color: i === step - 1 ? '#0B3C5D' : '#9AA4B2' }}>
                {t}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 max-h-96 overflow-y-auto">
        {step === 1 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-3">Rate each dimension from 1 (Needs Help) to 5 (Excellent)</p>
            {ACADEMIC_ITEMS.map(item => (
              <RatingRow key={item.key} label={item.label} value={academic[item.key]} onChange={v => setAcademic(p => ({ ...p, [item.key]: v }))} />
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-3">Rate emotional wellbeing indicators</p>
            {EMOTIONAL_ITEMS.map(item => (
              <RatingRow key={item.key} label={item.label} value={emotional[item.key]} onChange={v => setEmotional(p => ({ ...p, [item.key]: v }))} />
            ))}
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-3">Rate social and behavioral traits</p>
            {SOCIAL_ITEMS.map(item => (
              <RatingRow key={item.key} label={item.label} value={social[item.key]} onChange={v => setSocial(p => ({ ...p, [item.key]: v }))} />
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {/* Overall rating */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Overall Assessment Rating</p>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setOverallRating(n)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: overallRating === n ? RATING_LABELS[n].color : '#F5F7FA',
                      color: overallRating === n ? '#ffffff' : '#9AA4B2',
                    }}>
                    {n} — {RATING_LABELS[n].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Key Strengths Observed</p>
              <textarea
                value={strengths}
                onChange={e => setStrengths(e.target.value)}
                placeholder="e.g. Strong memory recall, excellent teamwork in group projects..."
                rows={2}
                className="w-full text-xs rounded-xl px-3 py-2.5 border outline-none resize-none transition-colors"
                style={{ borderColor: '#E8ECF2', fontFamily: 'Inter, sans-serif' }}
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Areas of Concern</p>
              <textarea
                value={concerns}
                onChange={e => setConcerns(e.target.value)}
                placeholder="e.g. Increased withdrawal in class, declining homework submission..."
                rows={2}
                className="w-full text-xs rounded-xl px-3 py-2.5 border outline-none resize-none"
                style={{ borderColor: '#E8ECF2', fontFamily: 'Inter, sans-serif' }}
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Recommendations</p>
              <textarea
                value={recommendations}
                onChange={e => setRecommendations(e.target.value)}
                placeholder="e.g. Consider peer tutoring for Math, weekly counsellor check-in recommended..."
                rows={2}
                className="w-full text-xs rounded-xl px-3 py-2.5 border outline-none resize-none"
                style={{ borderColor: '#E8ECF2', fontFamily: 'Inter, sans-serif' }}
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={followUpRequired}
                onChange={e => setFollowUpRequired(e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: '#EF4444' }}
              />
              <span className="text-xs font-medium text-gray-700">Flag for follow-up (urgent attention required)</span>
            </label>

            {/* Computed composite */}
            <div className="p-3 rounded-xl" style={{ background: 'rgba(11,60,93,0.05)', border: '1px solid rgba(11,60,93,0.1)' }}>
              <p className="text-[10px] text-gray-500 mb-1">Computed composite score</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: '#0B3C5D' }}>{overallAvg}/5</span>
                <span className="text-xs font-semibold" style={{ color: RATING_LABELS[overallAvg]?.color }}>{RATING_LABELS[overallAvg]?.label}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="px-5 pb-5 pt-3 flex gap-2 border-t border-gray-100">
        {step > 1 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 border border-gray-200 transition-colors"
          >
            Back
          </button>
        )}
        <div className="flex-1" />
        {step < 4 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: '#0B3C5D' }}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: '#4ECDC4' }}
          >
            <Send size={14} />
            {submitting ? 'Submitting...' : 'Submit Observation'}
          </button>
        )}
      </div>
    </div>
  );
}
