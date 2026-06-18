import React from 'react';
import { Zap } from 'lucide-react';
import { COLOR } from '@/design-system';

interface RecommendationCardProps {
  rank: number;
  title: string;
  type: string;
  hours: number;
  eiLift: number;
  competencyLabel: string;
  status?: 'pending' | 'in-progress' | 'done';
  onStatusChange?: (status: 'pending' | 'in-progress' | 'done') => void;
}

const STATUS_STYLES = {
  pending:     { label: 'Start',       bg: '#f1f5f9', color: '#64748b' },
  'in-progress':{ label: 'In Progress', bg: '#344E8615', color: '#344E86' },
  done:        { label: 'Done ✓',      bg: '#2A9D8F15', color: '#2A9D8F' },
};

export function RecommendationCard({
  rank, title, type, hours, eiLift, competencyLabel, status = 'pending', onStatusChange
}: RecommendationCardProps) {
  const s = STATUS_STYLES[status];
  const nextStatus: Record<string, 'pending' | 'in-progress' | 'done'> = {
    pending: 'in-progress', 'in-progress': 'done', done: 'pending',
  };
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">{title}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {type} · {hours}h · closes <span className="font-medium text-gray-600">{competencyLabel}</span> gap
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Zap size={10} style={{ color: COLOR.orange }} />
            <span className="text-[10px]" style={{ color: COLOR.orange }}>+{eiLift} EI lift</span>
          </div>
        </div>
        {onStatusChange && (
          <button
            onClick={() => onStatusChange(nextStatus[status])}
            className="text-[10px] font-medium px-2 py-1 rounded-lg shrink-0 transition-colors"
            style={{ backgroundColor: s.bg, color: s.color }}
          >
            {s.label}
          </button>
        )}
      </div>
    </div>
  );
}
