import { useEffect, useState } from 'react';
import { Award, Star, TrendingUp, X } from 'lucide-react';

interface Milestone {
  type: 'score' | 'streak' | 'completion' | 'improvement';
  title: string;
  desc: string;
  value?: number;
}

interface Props {
  milestones: Milestone[];
  childName: string;
  onDismiss: () => void;
}

export function MilestoneCelebration({ milestones, childName, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
  }, []);

  if (!milestones.length) return null;

  const m = milestones[current];
  const icons = {
    score: <Star size={28} className="text-white" />,
    streak: <TrendingUp size={28} className="text-white" />,
    completion: <Award size={28} className="text-white" />,
    improvement: <TrendingUp size={28} className="text-white" />,
  };

  const handleNext = () => {
    if (current < milestones.length - 1) setCurrent(c => c + 1);
    else onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onDismiss}
    >
      <style>{`
        @keyframes ms-pop {
          0%  { transform: scale(0.7) translateY(30px); opacity: 0; }
          60% { transform: scale(1.05) translateY(-6px); opacity: 1; }
          100%{ transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes ms-confetti {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(60px) rotate(360deg); opacity: 0; }
        }
        @keyframes ms-glow {
          0%,100% { box-shadow: 0 0 30px rgba(78,205,196,0.4); }
          50%      { box-shadow: 0 0 60px rgba(78,205,196,0.7); }
        }
        .ms-card { animation: ms-pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        .ms-glow  { animation: ms-glow 2s ease-in-out infinite; }
      `}</style>

      <div
        className="ms-card ms-glow relative bg-white rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{
          opacity: visible ? 1 : 0,
          border: '2px solid rgba(78,205,196,0.3)',
        }}
      >
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
        >
          <X size={16} />
        </button>

        <div
          className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: '#0B3C5D' }}
        >
          {icons[m.type]}
        </div>

        <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#4ECDC4' }}>
          Milestone Achieved
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#0B3C5D' }}>{m.title}</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-1">{childName}</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">{m.desc}</p>

        {milestones.length > 1 && (
          <div className="flex justify-center gap-1.5 mb-4">
            {milestones.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === current ? 20 : 6,
                  height: 6,
                  background: i === current ? '#0B3C5D' : '#CBD5E1',
                }}
              />
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#0B3C5D' }}
          >
            {current < milestones.length - 1 ? 'Next →' : 'Awesome!'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function detectMilestones(
  childId: string,
  completedExams: any[],
  lbiData: any
): Milestone[] {
  const key = `metryx_milestones_seen_${childId}`;
  const seen: string[] = JSON.parse(localStorage.getItem(key) || '[]');
  const milestones: Milestone[] = [];
  const newSeen: string[] = [...seen];

  if (completedExams.length >= 5) {
    const avg = Math.round(completedExams.reduce((s, e) => s + (e.score || 0), 0) / completedExams.length);
    if (avg >= 85 && !seen.includes('avg85')) {
      milestones.push({ type: 'score', title: 'Excellence Streak!', desc: `Average score crossed 85% across ${completedExams.length} assessments. Outstanding academic performance!`, value: avg });
      newSeen.push('avg85');
    } else if (avg >= 70 && !seen.includes('avg70')) {
      milestones.push({ type: 'score', title: 'Strong Performer!', desc: `Average score above 70% — consistently strong academic effort across ${completedExams.length} assessments.`, value: avg });
      newSeen.push('avg70');
    }
  }

  if (completedExams.length === 1 && !seen.includes('first_exam')) {
    milestones.push({ type: 'completion', title: 'First Assessment Done!', desc: 'First assessment completed — the learning journey begins. Every data point builds a sharper picture.' });
    newSeen.push('first_exam');
  }

  if (completedExams.length === 10 && !seen.includes('ten_exams')) {
    milestones.push({ type: 'streak', title: '10 Assessments!', desc: 'Ten assessments completed. Consistent effort like this builds lasting academic resilience.' });
    newSeen.push('ten_exams');
  }

  if (lbiData?.overallScore && lbiData.overallScore >= 75 && !seen.includes('lbi75')) {
    milestones.push({ type: 'improvement', title: 'LBI High Performer!', desc: `Behavioral Intelligence Score crossed 75 — placing in the top learner tier across all domains.`, value: lbiData.overallScore });
    newSeen.push('lbi75');
  }

  localStorage.setItem(key, JSON.stringify(newSeen));
  return milestones;
}
