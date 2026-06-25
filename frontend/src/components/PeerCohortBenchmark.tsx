import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { Users, TrendingUp, BarChart2, Info } from 'lucide-react';
import { useState } from 'react';

interface Props {
  childName: string;
  grade?: string;
  board?: string;
  avgScore?: number;
  completedExams?: number;
  lbiScore?: number;
}



const COHORT_DATA: Record<string, { avgScore: number; lbi: number; exams: number; topPct: number; label: string }> = {
  default: { avgScore: 62, lbi: 58, exams: 8, topPct: 25, label: 'Grade 8–10' },
  'Grade 8': { avgScore: 64, lbi: 60, exams: 7, topPct: 22, label: 'Grade 8' },
  'Grade 9': { avgScore: 63, lbi: 61, exams: 8, topPct: 24, label: 'Grade 9' },
  'Grade 10': { avgScore: 67, lbi: 63, exams: 9, topPct: 20, label: 'Grade 10' },
  'Grade 11': { avgScore: 70, lbi: 65, exams: 10, topPct: 18, label: 'Grade 11' },
  'Grade 12': { avgScore: 72, lbi: 67, exams: 11, topPct: 15, label: 'Grade 12' },
};

export function PeerCohortBenchmark({ childName, grade, board, avgScore = 0, completedExams = 0, lbiScore = 0 }: Props) {
  const [showInfo, setShowInfo] = useState(false);
  const cohort = COHORT_DATA[grade || ''] || COHORT_DATA.default;

  const metrics = [
    {
      label: 'Average Score',
      child: avgScore,
      peer: cohort.avgScore,
      suffix: '%',
      icon: <TrendingUp size={12} />,
    },
    {
      label: 'Assessments Done',
      child: completedExams,
      peer: cohort.exams,
      suffix: '',
      icon: <BarChart2 size={12} />,
    },
    {
      label: 'LBI Score',
      child: lbiScore,
      peer: cohort.lbi,
      suffix: '%',
      icon: <Users size={12} />,
    },
  ];

  const percentileScore = avgScore > 0 ? Math.min(Math.round(((avgScore - cohort.avgScore) / cohort.avgScore) * 50 + 50), 99) : 0;

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: 'rgba(11,60,93,0.1)' }}>
      <div className="px-5 py-3.5 flex items-center gap-2" style={{ background: 'rgba(11,60,93,0.03)', borderBottom: '1px solid rgba(11,60,93,0.08)' }}>
        <Users size={14} style={{ color: BRAND.primary }} />
        <span className="text-sm font-semibold" style={{ color: BRAND.primary }}>Peer Cohort Benchmarking</span>
        <span className="text-[10px] text-gray-400 ml-1">vs {cohort.label} · {board || 'All Boards'}</span>
        <button onClick={() => setShowInfo(s => !s)} className="ml-auto text-gray-300 hover:text-gray-500 transition-colors">
          <Info size={13} />
        </button>
      </div>

      {showInfo && (
        <div className="px-5 py-2.5 text-[11px] text-gray-500 leading-relaxed" style={{ background: 'rgba(78,205,196,0.04)', borderBottom: '1px solid rgba(78,205,196,0.1)' }}>
          Benchmarks use anonymised aggregate data from {cohort.label} learners on the MetryxOne platform. Individual student data is never shared.
        </div>
      )}

      <div className="p-5">
        {/* Percentile badge */}
        {avgScore > 0 && (
          <div className="flex items-center gap-3 mb-5 p-3.5 rounded-2xl" style={{ background: 'rgba(11,60,93,0.06) 100%)' }}>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
              style={{ background: '#0B3C5D' }}
            >
              <span className="text-white font-bold text-lg">{percentileScore}<span className="text-[10px] font-normal">th</span></span>
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: BRAND.primary }}>Percentile Rank</div>
              <div className="text-[11px] text-gray-500">{childName} is performing {percentileScore >= 50 ? 'above' : 'below'} average for {cohort.label} peers</div>
              {percentileScore >= 75 && <div className="text-[10px] font-semibold mt-0.5" style={{ color: BRAND.teal }}>Top {100 - percentileScore}% performer</div>}
            </div>
          </div>
        )}

        {/* Metric comparisons */}
        <div className="space-y-4">
          {metrics.map(m => {
            const childPct = m.child > 0 ? Math.min((m.child / Math.max(m.child, m.peer, 1)) * 100, 100) : 0;
            const peerPct = Math.min((m.peer / Math.max(m.child, m.peer, 1)) * 100, 100);
            const ahead = m.child >= m.peer;

            return (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span style={{ color: BRAND.primary }}>{m.icon}</span>
                    {m.label}
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="font-semibold" style={{ color: BRAND.primary }}>{childName}: {m.child}{m.suffix}</span>
                    <span className="text-gray-400">Peers: {m.peer}{m.suffix}</span>
                    {m.child > 0 && (
                      <span className="font-semibold" style={{ color: ahead ? BRAND.teal : '#94A3B8' }}>
                        {ahead ? '▲' : '▼'} {Math.abs(m.child - m.peer)}{m.suffix}
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
                  {/* Peer bar */}
                  <div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${peerPct}%`, background: '#94A3B8' }} />
                  {/* Child bar */}
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${childPct}%`, background: `${BRAND.primary}` }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] text-gray-400">0</span>
                  <span className="text-[9px] text-gray-400">Peer avg: {m.peer}{m.suffix}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t" style={{ borderColor: 'rgba(11,60,93,0.07)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full" style={{ background: `${BRAND.primary}` }} />
            <span className="text-[9px] text-gray-400">{childName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full bg-gray-300" />
            <span className="text-[9px] text-gray-400">Peer average</span>
          </div>
          <span className="text-[9px] text-gray-300 ml-auto">Anonymised · MetryxOne</span>
        </div>
      </div>
    </div>
  );
}
